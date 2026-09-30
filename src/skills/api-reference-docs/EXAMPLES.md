# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Self-referential descriptions and no examples
```yaml
paths:
  /orders/{id}:
    get:
      summary: Get order
      parameters:
        - name: id
          in: path
          description: the id
      responses:
        '200':
          description: OK
```
**Why it's wrong:**
- Descriptions add no information, there are no examples, and error responses are undocumented.
- Consumers must guess formats, authentication, and failure handling.

## Best Practice (How to do it right)

### 1. Documented operation with examples and errors (OpenAPI 3.1)
```yaml
paths:
  /v2/orders/{orderId}:
    get:
      operationId: getOrder
      summary: Retrieve an order
      description: |
        Returns the current state of an order owned by the authenticated customer.
        Orders of other customers return 404 to avoid revealing their existence.
      security: [{ oauth2: ['orders:read'] }]
      parameters:
        - name: orderId
          in: path
          required: true
          description: Public order identifier as shown to customers (for example on the confirmation email).
          schema: { type: string, pattern: '^SO-[0-9]{4,10}$' }
          example: SO-1001
      responses:
        '200':
          description: The order.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
              example:
                id: SO-1001
                status: SHIPPED
                total: { amount: '42.50', currency: EUR }
                createdAt: '2026-09-28T14:03:11Z'
        '404':
          description: No order with this identifier exists for the authenticated customer.
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
              example:
                type: https://docs.example.com/errors/order-not-found
                title: Order not found
                status: 404
```
### 2. Error catalog entry (docs site)
```text
order-not-found (404)
Meaning:   The order does not exist or belongs to another customer.
Causes:    Typo in the order number; token of a different customer; order older than the 7-year retention period.
Resolve:   Check the order number on the confirmation email; make sure the access token belongs to the order's customer.
```
**Why it's right:**
- The operation explains behavior, security, formats, and examples, and error responses are documented with problem details.
- The error catalog tells developers what went wrong and how to fix it, linked from the `type` URI.
