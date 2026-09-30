# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. RPC-style paths, wrong methods, and ad-hoc errors
```yaml
paths:
  /getOrders:
    get:
      responses:
        '200':
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/OrderEntity' } }   # unbounded, internal model
  /createOrder:
    post:
      responses:
        '200': { description: OK }                     # should be 201 + Location
  /deleteOrder:
    post:                                              # POST to delete
      parameters: [ { name: id, in: query } ]
      responses:
        '200':
          content:
            application/json:
              schema: { properties: { success: { type: boolean }, error: { type: string } } }
```
**Why it's wrong:**
- Verbs in paths and POST for deletion ignore HTTP semantics, caching, and idempotency.
- The list is unbounded and exposes the persistence entity; errors are returned with `200` and a custom shape.
- No security, no examples, no `operationId`, and no constraints on inputs.

## Best Practice (How to do it right)

### 1. Resource-oriented contract with problem details, pagination, and idempotency
```yaml
openapi: 3.1.0
info: { title: Orders API, version: 1.4.0 }
security: [ { oauth2: [] } ]
paths:
  /orders:
    get:
      operationId: listOrders
      summary: List the caller's orders
      tags: [orders]
      security: [ { oauth2: [orders:read] } ]
      parameters:
        - { name: status, in: query, schema: { $ref: '#/components/schemas/OrderStatus' } }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
        - { name: cursor, in: query, schema: { type: string, maxLength: 200 } }
      responses:
        '200':
          description: A page of orders
          content:
            application/json:
              schema: { $ref: '#/components/schemas/OrderPage' }
        '401': { $ref: '#/components/responses/Problem' }
    post:
      operationId: createOrder
      summary: Place an order
      tags: [orders]
      security: [ { oauth2: [orders:write] } ]
      parameters:
        - { name: Idempotency-Key, in: header, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateOrderRequest' }
            examples:
              twoItems: { value: { lines: [ { sku: SKU-1, quantity: 2 } ] } }
      responses:
        '201':
          description: Created
          headers: { Location: { schema: { type: string, format: uri } } }
          content: { application/json: { schema: { $ref: '#/components/schemas/Order' } } }
        '422': { $ref: '#/components/responses/Problem' }
  /orders/{orderId}:
    delete:
      operationId: deleteOrder
      tags: [orders]
      security: [ { oauth2: [orders:write] } ]
      parameters:
        - { name: orderId, in: path, required: true, schema: { type: string, format: uuid } }
        - { name: If-Match, in: header, required: true, schema: { type: string } }
      responses:
        '204': { description: Deleted }
        '404': { $ref: '#/components/responses/Problem' }
        '412': { $ref: '#/components/responses/Problem' }
components:
  securitySchemes:
    oauth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes: { orders:read: Read orders, orders:write: Create and delete orders }
  responses:
    Problem:
      description: Error
      content:
        application/problem+json: { schema: { $ref: '#/components/schemas/Problem' } }
  schemas:
    OrderStatus: { type: string, enum: [PENDING, CONFIRMED, SHIPPED, CANCELLED] }
    Money:
      type: object
      required: [amount, currency]
      properties:
        amount: { type: string, pattern: '^-?\d+\.\d{2}$', examples: ['129.90'] }
        currency: { type: string, pattern: '^[A-Z]{3}$', examples: [EUR] }
    CreateOrderRequest:
      type: object
      additionalProperties: false
      required: [lines]
      properties:
        lines:
          type: array
          minItems: 1
          maxItems: 50
          items:
            type: object
            additionalProperties: false
            required: [sku, quantity]
            properties:
              sku: { type: string, maxLength: 40 }
              quantity: { type: integer, minimum: 1, maximum: 99 }
    Order:
      type: object
      required: [id, status, total, createdAt]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        status: { $ref: '#/components/schemas/OrderStatus' }
        total: { $ref: '#/components/schemas/Money' }
        createdAt: { type: string, format: date-time, readOnly: true }
    OrderPage:
      type: object
      required: [items]
      properties:
        items: { type: array, items: { $ref: '#/components/schemas/Order' } }
        nextCursor: { type: [string, 'null'] }
    Problem:
      type: object
      properties:
        type: { type: string, format: uri }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        instance: { type: string }
        traceId: { type: string }
        errors:
          type: array
          items: { type: object, properties: { pointer: { type: string }, detail: { type: string } } }
```
**Why it's right:**
- Resources and HTTP methods carry the semantics; creation returns `201` with `Location`, deletion is idempotent with optimistic concurrency.
- The collection is cursor-paginated with a maximum limit; inputs are strictly constrained; money is exact.
- Errors share one RFC 9457 schema; security scopes are explicit per operation; examples make the contract testable.
