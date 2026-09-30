# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Database-shaped schema without pagination or typed errors
```graphql
type Query {
  allOrders: [orders]            # unbounded list, table name as type
  order(id: Int): orders
}

type orders {
  id: Int
  customer_id: Int
  status: Int                    # magic number
  total: Float                   # floating-point money
  customer: customers            # N+1 when listing orders
}

type Mutation {
  updateOrder(order: JSON): Boolean   # untyped input, no error details
}
```
**Why it's wrong:**
- Types mirror tables; naming conventions are broken; an unbounded list lets a single query load everything.
- `JSON` input and `Boolean` output provide no validation and no information about why an update failed.
- Resolving `customer` per order without batching produces one query per row.

### 2. No protection against abusive queries
```graphql
query {
  orders { customer { orders { customer { orders { customer { orders { id } } } } } } }
}
```
**Why it's wrong:**
- Without depth and cost limits, a small query can trigger millions of resolver calls and take the service down.

## Best Practice (How to do it right)

### 1. Use-case-driven schema with connections and payloads
```graphql
interface Node { id: ID! }

enum OrderStatus { PENDING CONFIRMED SHIPPED CANCELLED }

type Money { amount: String! currency: String! }

type Order implements Node {
  id: ID!
  status: OrderStatus!
  total: Money!
  placedAt: DateTime!
  customer: Customer                      # nullable: resolved from another service
  totalAmount: Float @deprecated(reason: "Use total. Removal after 2025-12-31.")
}

type OrderEdge { cursor: String! node: Order! }
type OrderConnection { edges: [OrderEdge!]! pageInfo: PageInfo! }

type Query {
  node(id: ID!): Node
  myOrders(first: Int = 20, after: String, status: OrderStatus): OrderConnection!
}

input PlaceOrderInput { lines: [OrderLineInput!]! clientMutationId: String }
input OrderLineInput { sku: String! quantity: Int! }

union PlaceOrderError = OutOfStock | InvalidQuantity
type OutOfStock { sku: String! message: String! }
type InvalidQuantity { sku: String! max: Int! message: String! }

type PlaceOrderPayload { order: Order errors: [PlaceOrderError!]! }

type Mutation { placeOrder(input: PlaceOrderInput!): PlaceOrderPayload! }
```
**Why it's right:**
- Types follow the domain and conventions; lists are paginated connections; money is exact.
- The mutation has a dedicated input and a payload with typed business errors clients can handle.
- Deprecation allows evolution without breaking existing clients.

### 2. Query limits, batching, and authorization (TypeScript, Apollo Server)
```typescript
import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== 'production',
  validationRules: [depthLimit(8), createComplexityLimitRule(5_000)],
});

// per-request context: loaders and the authenticated principal
const context = async ({ req }) => {
  const principal = await authenticate(req);
  return {
    principal,
    loaders: { customerById: new DataLoader((ids) => customers.findByIds(ids, principal.tenantId)) },
  };
};

const resolvers = {
  Query: {
    myOrders: (_, args, { principal }) => {
      const first = Math.min(args.first ?? 20, 100);                 // server-enforced maximum
      return orders.pageForCustomer(principal.customerId, { ...args, first });
    },
  },
  Order: {
    customer: (order, _, { loaders }) => loaders.customerById.load(order.customerId),   // batched
  },
};
```
**Why it's right:**
- Depth and cost limits reject abusive queries before execution; introspection is off in production.
- A per-request DataLoader batches customer lookups and scopes them to the caller's tenant; the page size is capped server-side.
