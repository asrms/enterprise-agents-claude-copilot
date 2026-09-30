# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Undocumented event with internal details and a breaking change
```jsonc
// topic "orders" — v1 (no contract, discovered by reading the producer code)
{ "evt": "ORDER_UPDATE", "o": { "id": 42, "st": 3, "tot": 129.9, "cust": { "email": "mario@example.com", "pwdHash": "..." } } }

// three months later the producer renames fields without notice
{ "event": "ORDER_UPDATE", "order": { "orderId": "42", "status": "SHIPPED", "total": 129.9 } }
```
**Why it's wrong:**
- No contract: consumers reverse-engineer the payload; renaming fields breaks them in production.
- A generic `ORDER_UPDATE` with a numeric status hides what happened; a password hash and personal data are broadcast to every consumer and retained in the topic.
- No id, timestamp, version, or correlation data; floating-point money.

## Best Practice (How to do it right)

### 1. AsyncAPI 3 contract with CloudEvents headers
```yaml
asyncapi: 3.0.0
info: { title: Orders events, version: 1.2.0 }
servers:
  production:
    host: kafka.internal.example.com:9093
    protocol: kafka
    security: [ { $ref: '#/components/securitySchemes/scram' } ]
channels:
  orderEvents:
    address: orders.order.events
    messages:
      orderPlaced: { $ref: '#/components/messages/OrderPlaced' }
operations:
  publishOrderPlaced:
    action: send
    channel: { $ref: '#/channels/orderEvents' }
    summary: Published after an order is committed (transactional outbox). At-least-once; key = orderId.
components:
  securitySchemes:
    scram: { type: scramSha512 }
  messages:
    OrderPlaced:
      name: com.acme.orders.order-placed.v1
      headers:
        type: object
        required: [ce_id, ce_type, ce_source, ce_time, ce_specversion]
        properties:
          ce_id: { type: string, format: uuid }
          ce_type: { const: com.acme.orders.order-placed.v1 }
          ce_source: { const: /orders-service }
          ce_time: { type: string, format: date-time }
          ce_specversion: { const: '1.0' }
          traceparent: { type: string }
          correlationId: { type: string }
      payload:
        type: object
        required: [orderId, customerId, total, lines, placedAt]
        properties:
          orderId: { type: string, format: uuid }
          customerId: { type: string, format: uuid }        # reference, no personal data
          placedAt: { type: string, format: date-time }
          total:
            type: object
            required: [amount, currency]
            properties: { amount: { type: string }, currency: { type: string } }
          lines:
            type: array
            items:
              type: object
              required: [sku, quantity]
              properties: { sku: { type: string }, quantity: { type: integer } }
          channel: { type: string, description: 'Optional, added in 1.2.0 (backward compatible)' }
      examples:
        - payload:
            orderId: 5f0c1b2e-9a7d-4c1e-8b3a-2d4e6f8a0b1c
            customerId: 1a2b3c4d-5e6f-4a1b-9c8d-7e6f5a4b3c2d
            placedAt: '2025-03-04T10:15:30Z'
            total: { amount: '129.90', currency: EUR }
            lines: [ { sku: SKU-1, quantity: 1 } ]
```
**Why it's right:**
- The event is a named, versioned fact with a standard envelope for ids, time, and tracing.
- The payload carries what consumers need, with references instead of personal data; a new optional field is a compatible change.
- Delivery semantics (outbox, at-least-once, key) and broker security are documented in the contract.
