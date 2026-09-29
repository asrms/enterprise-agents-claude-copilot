# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unclear names, magic values, and nested conditionals (TypeScript)
```typescript
export function proc(d: any[], f: boolean): number {
  let t = 0;
  for (const x of d) {
    if (x.s == 3) {
      if (x.c) {
        if (f) {
          t += x.a * 1.22;
        } else {
          t += x.a;
        }
      }
    }
  }
  return t;
}
```
**Why it's wrong:**
- `proc`, `d`, `f`, `t`, `x.s`, `x.c`, `x.a` reveal nothing about the domain; the reader must reverse-engineer the intent.
- `3` and `1.22` are magic values (a status code and a VAT rate) that will be duplicated and drift.
- The boolean flag changes the meaning of the function and the three nested `if`s hide a simple filter-and-sum.

### 2. Query with hidden side effects and swallowed errors (Python)
```python
def get_customer(customer_id):
    try:
        customer = db.query(Customer).get(customer_id)
        customer.last_seen = datetime.now()     # mutation hidden in a "get"
        db.commit()
        send_event("customer_viewed", customer_id)  # side effect in a query
        return customer
    except Exception:
        return None                             # DB outage, bad id, and bug all look the same
```
**Why it's wrong:**
- A function named `get_` writes to the database and publishes an event: callers cannot know that reading has consequences.
- `except Exception: return None` hides outages and bugs as "not found", and loses the cause.
- `datetime.now()` inside the function makes it non-deterministic and hard to test.

### 3. Commented-out code, stale comments, and primitive obsession (Java)
```java
public class Payment {
    public String currency;   // "EUR" or "USD"
    public double amount;     // amount in cents
    public String email;

    // increments the counter
    public void refund(double value) {
        // if (value > amount) throw new IllegalArgumentException();
        // legacy check removed 2021
        amount = amount - value;
    }
}
```
**Why it's wrong:**
- `double` for money causes rounding errors; the comment says "cents" but the type allows fractions.
- Public mutable fields let any caller put the object in an invalid state (negative amount, unknown currency, invalid email).
- The comment "increments the counter" is false, and the commented-out validation is dead code that hides the real missing rule.

## Best Practice (How to do it right)

### 1. Unclear names, magic values, and nested conditionals (TypeScript)
```typescript
const VAT_RATE_STANDARD = 0.22;

type OrderLine = { status: OrderStatus; isConfirmed: boolean; netAmountCents: number };

export function totalConfirmedShippedNet(lines: readonly OrderLine[]): number {
  return lines
    .filter((line) => line.status === OrderStatus.Shipped && line.isConfirmed)
    .reduce((sum, line) => sum + line.netAmountCents, 0);
}

export function withStandardVat(netAmountCents: number): number {
  return Math.round(netAmountCents * (1 + VAT_RATE_STANDARD));
}

// caller decides explicitly instead of passing a boolean flag
const gross = withStandardVat(totalConfirmedShippedNet(order.lines));
```
**Why it's right:**
- Names describe the business meaning; the enum and the named constant replace magic values.
- The flag is replaced by two composable functions, each doing one thing.
- Amounts are integers in cents, and the filter/sum reads like the business rule.

### 2. Query with hidden side effects and swallowed errors (Python)
```python
class CustomerNotFound(Exception):
    def __init__(self, customer_id: int) -> None:
        super().__init__(f"customer {customer_id} not found")
        self.customer_id = customer_id


def get_customer(session: Session, customer_id: int) -> Customer:
    customer = session.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFound(customer_id)
    return customer


def record_customer_visit(session: Session, events: EventPublisher, customer_id: int, now: datetime) -> None:
    customer = get_customer(session, customer_id)
    customer.last_seen = now
    events.publish(CustomerVisited(customer_id=customer_id, at=now))
```
**Why it's right:**
- The query only reads; the command is a separate, explicitly named function (command–query separation).
- "Not found" is a specific exception; infrastructure errors propagate with their original cause.
- Time and the event publisher are injected, so the command is deterministic and testable.

### 3. Commented-out code, stale comments, and primitive obsession (Java)
```java
public record Money(long cents, Currency currency) {
    public Money {
        if (cents < 0) throw new IllegalArgumentException("amount must not be negative");
        Objects.requireNonNull(currency);
    }
    public Money minus(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
        return new Money(cents - other.cents, currency);   // constructor rejects negative results
    }
}

public final class Payment {
    private final EmailAddress payerEmail;
    private Money refundable;

    public Payment(EmailAddress payerEmail, Money amount) {
        this.payerEmail = payerEmail;
        this.refundable = amount;
    }

    /** Partial refunds are allowed until the paid amount is exhausted (finance policy FIN-112). */
    public void refund(Money value) {
        refundable = refundable.minus(value);
    }
}
```
**Why it's right:**
- `Money` and `EmailAddress` value objects validate at construction, so invalid states cannot exist.
- The invariant ("cannot refund more than paid") is enforced by the type instead of a commented-out check.
- The only comment explains the business policy (why), with a traceable reference.
