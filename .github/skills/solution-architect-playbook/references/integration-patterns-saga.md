# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Dual write and synchronous chain without compensation (pseudo-code)
```text
placeOrder(cmd):
  db.insert(order, status=CONFIRMED)          // local commit
  broker.publish(OrderPlaced)                 // may fail after the commit → event lost
  payment.charge(order.total)                 // sync HTTP, no timeout
  stock.reserve(order.lines)                  // if this fails, the customer is charged anyway
  shipping.createShipment(order)              // no rollback of payment or stock
```
**Why it's wrong:**
- The database write and the publish are not atomic: a crash between them loses the event.
- A failure in a later step leaves earlier steps applied (customer charged, no stock) with no compensation.
- Synchronous calls without timeouts let one slow dependency block the whole flow.

### 2. Non-idempotent consumer
```python
def on_payment_captured(msg):
    loyalty.add_points(msg["customer_id"], msg["amount"])   # redelivery doubles the points
    ack(msg)
```
**Why it's wrong:**
- At-least-once delivery means duplicates will happen (rebalance, timeout before ack); each duplicate repeats the side effect.

## Best Practice (How to do it right)

### 1. Orchestrated saga with outbox and compensations
```text
OrderSaga (state persisted in order_saga table, correlation id = orderId)

  STARTED
    → command ReservePayment         (timeout 30s)  ── failed ─→ REJECTED (notify customer)
  PAYMENT_RESERVED
    → command ReserveStock           (timeout 30s)  ── failed ─→ compensate: ReleasePayment → REJECTED
  STOCK_RESERVED
    → command CapturePayment         (timeout 60s)  ── failed ─→ compensate: ReleaseStock, ReleasePayment → REJECTED
  PAYMENT_CAPTURED
    → command CreateShipment
  COMPLETED

- Every command is written to the outbox in the same transaction as the saga state change.
- Every participant handles commands idempotently (dedup by command id) and replies with an event.
- Compensations are idempotent; if a compensation fails after N retries → state COMPENSATION_FAILED,
  alert on-call, runbook RB-ORD-07.
- Order status visible to the customer: PENDING_PAYMENT → CONFIRMED / REJECTED.
```
**Why it's right:**
- No step relies on a distributed transaction; each local step has a compensation and a timeout.
- State is persisted, so the saga resumes after crashes; failures that need humans are explicit and alerted.

### 2. Idempotent consumer (Python, SQLAlchemy)
```python
def on_payment_captured(session: Session, msg: PaymentCaptured) -> None:
    with session.begin():
        inserted = session.execute(
            insert(ProcessedMessage)
            .values(message_id=msg.event_id, consumer="loyalty")
            .on_conflict_do_nothing(index_elements=["message_id", "consumer"])
        ).rowcount
        if inserted == 0:
            log.info("duplicate event ignored", extra={"event_id": msg.event_id})
            return
        add_points(session, msg.customer_id, msg.amount)   # same transaction as the dedup marker
```
**Why it's right:**
- The dedup marker and the side effect commit atomically, so a redelivered event is ignored and a crash before commit is safely retried.
