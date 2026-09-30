---
name: grpc-protobuf
description: "Designing gRPC services and Protocol Buffers contracts: package and file layout, naming and field numbering rules, backward-compatible evolution, well-known types, standard error model with google.rpc.Status details, deadlines and retries, streaming, Buf lint/breaking checks, and code generation. Use it when designing or reviewing gRPC or Protobuf APIs in any language."
---

# Skill: gRPC and Protocol Buffers

## Implementation Rules:
- **[ARCHITECTURE]** Contracts live in a dedicated, versioned `proto/` tree (or schema repository) with packages that include a major version (`acme.orders.v1`), one service per file where practical, and generated code produced in CI rather than committed by hand.
- **[MANDATORY]** Follow the Protobuf style guide: `PascalCase` messages, services, and RPCs; `snake_case` fields; `UPPER_SNAKE_CASE` enum values prefixed with the enum name, and the zero value `<ENUM>_UNSPECIFIED = 0`.
- **[PATTERN]** Every RPC has its own request and response messages (`GetOrderRequest`/`GetOrderResponse` or resource messages following AIP conventions), even if they wrap a single field, so they can evolve independently.
- **[MANDATORY]** Backward compatibility: never change field numbers or types, never reuse numbers or names of removed fields (declare them `reserved`), add new fields with new numbers, and treat missing fields as defaults; use `optional` when presence must be distinguished from the default value.
- **[PATTERN]** Use well-known types: `google.protobuf.Timestamp` and `Duration` for time, `FieldMask` for partial updates, `google.type.Money` or a units+nanos/decimal-string message for money; never `double` for money.
- **[MANDATORY]** Errors use gRPC status codes correctly (`INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `FAILED_PRECONDITION`, `PERMISSION_DENIED`, `UNAUTHENTICATED`, `RESOURCE_EXHAUSTED`, `UNAVAILABLE`, `DEADLINE_EXCEEDED`, `INTERNAL`) with `google.rpc.Status` details (`BadRequest` field violations, `ErrorInfo` reason/domain, `RetryInfo`) instead of error strings in response messages.
- **[MANDATORY]** Clients always set deadlines and propagate them across hops; servers check context cancellation and stop work when the deadline expires.
- **[PATTERN]** Retries via the service config (retry policy with max attempts, backoff, and retryable codes limited to `UNAVAILABLE` and similar) only for idempotent methods; mark idempotency with `option idempotency_level = IDEMPOTENT` or `NO_SIDE_EFFECTS`.
- **[PATTERN]** Pagination for list RPCs with `page_size` (server-capped) and opaque `page_token`/`next_page_token`; filtering with explicit fields.
- **[PATTERN]** Use streaming only when needed (server streaming for large or live result sets, bidirectional for interactive sessions), with flow control and clear termination semantics; prefer unary RPCs otherwise.
- **[SECURITY]** Transport security with TLS (mTLS for service-to-service), per-RPC authentication via metadata (bearer tokens validated in interceptors), authorization per method, maximum message sizes, and no reflection service in production for private APIs.
- **[CONFIGURATION]** Use Buf: `buf lint` with the `STANDARD` rules, `buf breaking --against` the main branch in CI, `buf generate` for code generation, and optionally the Buf Schema Registry; expose REST where needed via gRPC-Gateway/transcoding annotations or Connect.
- **[TESTING]** Test servers with in-process channels (bufconn, in-process transport), including error details, deadline handling, and backward compatibility tests that deserialize messages produced by older contract versions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
