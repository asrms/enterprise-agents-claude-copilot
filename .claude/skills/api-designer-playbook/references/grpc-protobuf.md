# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Fragile contract and ad-hoc errors
```protobuf
syntax = "proto3";
package orders;                         // no version

service OrderService {
  rpc Get(OrderId) returns (Order);     // shared/primitive messages as request
  rpc List(Empty) returns (Orders);     // unbounded list
}

message Order {
  int32 id = 1;
  double total = 2;                     // floating-point money
  string status = 3;                    // free text
  string created = 4;                   // date as string
  bool ok = 5;                          // error signalling in the payload
  string error_message = 6;
}
// later: field 3 deleted and number reused for a different type → old clients decode garbage
```
**Why it's wrong:**
- No versioned package, no dedicated request/response messages, and no pagination.
- Errors are returned inside the payload instead of status codes; money and time use unsafe types.
- Reusing a field number breaks wire compatibility with deployed clients.

## Best Practice (How to do it right)

### 1. Versioned, evolvable contract with standard errors
```protobuf
syntax = "proto3";
package acme.orders.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/field_mask.proto";
import "google/type/money.proto";

service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order) { option idempotency_level = NO_SIDE_EFFECTS; }
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse) { option idempotency_level = NO_SIDE_EFFECTS; }
  rpc UpdateOrder(UpdateOrderRequest) returns (Order);
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_SHIPPED = 2;
  ORDER_STATUS_CANCELLED = 3;
}

message Order {
  reserved 5;                           // removed field, never reuse
  reserved "legacy_code";
  string name = 1;                      // "orders/{order_id}"
  OrderStatus status = 2;
  google.type.Money total = 3;
  google.protobuf.Timestamp create_time = 4;
  optional string note = 6;             // presence tracked
}

message GetOrderRequest { string name = 1; }
message ListOrdersRequest { int32 page_size = 1; string page_token = 2; OrderStatus status = 3; }
message ListOrdersResponse { repeated Order orders = 1; string next_page_token = 2; }
message UpdateOrderRequest { Order order = 1; google.protobuf.FieldMask update_mask = 2; }
```
```go
// Server: typed errors with details, deadline-aware
func (s *server) GetOrder(ctx context.Context, req *ordersv1.GetOrderRequest) (*ordersv1.Order, error) {
	id, err := parseOrderName(req.GetName())
	if err != nil {
		st, _ := status.New(codes.InvalidArgument, "invalid order name").WithDetails(&errdetails.BadRequest{
			FieldViolations: []*errdetails.BadRequest_FieldViolation{{Field: "name", Description: err.Error()}},
		})
		return nil, st.Err()
	}
	order, err := s.repo.Get(ctx, id)            // repository honors ctx cancellation/deadline
	if errors.Is(err, ErrNotFound) {
		return nil, status.Errorf(codes.NotFound, "order %s not found", req.GetName())
	}
	...
}
```
```yaml
# buf.yaml + CI
version: v2
lint: { use: [STANDARD] }
breaking: { use: [FILE] }
# CI: buf lint && buf breaking --against '.git#branch=main' && buf generate
```
**Why it's right:**
- Versioned package, per-RPC messages, well-known types, `UNSPECIFIED` enum zero values, and reserved numbers keep the contract evolvable.
- Errors use status codes with structured details; the server honors deadlines through the context.
- Buf enforces style and blocks breaking changes in CI.
