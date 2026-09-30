# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. "Big bang" refactoring without a safety net (Java)
```text
commit 7f2c1a9  "refactor billing"   +1,412 −1,388  (no tests touched)

- InvoiceService split into 6 classes
- if/else on customer type replaced by a new class hierarchy
- rounding helper rewritten "more cleanly"
- fixed a bug where credit notes were counted twice
```
**Why it's wrong:**
- No characterization tests existed and none were added: nobody can prove that invoices are still computed the same way.
- A bug fix is hidden inside a structural rewrite, so the diff cannot be reviewed as "no behavior change".
- Rewriting the rounding helper "more cleanly" is a behavior change on money, not a refactoring.

### 2. Type code switch duplicated across the codebase (TypeScript)
```typescript
function shippingCost(order: Order): number {
  switch (order.shippingType) {
    case 'STANDARD': return 4.9;
    case 'EXPRESS': return 9.9;
    case 'PICKUP': return 0;
  }
}

function deliveryDays(order: Order): number {
  switch (order.shippingType) {
    case 'STANDARD': return 5;
    case 'EXPRESS': return 1;
    case 'PICKUP': return 0;
  }
}

function label(order: Order): string {
  if (order.shippingType === 'STANDARD') return 'Standard delivery';
  if (order.shippingType === 'EXPRESS') return 'Express delivery';
  return 'Store pickup';
}
```
**Why it's wrong:**
- Adding a shipping method means finding and editing every switch; forgetting one produces `undefined` at runtime.
- Knowledge about a shipping method is scattered across unrelated functions.

### 3. Refactoring that silently changes I/O behavior (Python)
```python
# before: one query
def active_customers_with_orders(session):
    return session.scalars(
        select(Customer).options(selectinload(Customer.orders)).where(Customer.active)
    ).all()

# after "extract function" refactoring
def active_customers_with_orders(session):
    return [with_orders(session, c) for c in active_customers(session)]

def with_orders(session, customer):
    customer.orders = session.scalars(select(Order).where(Order.customer_id == customer.id)).all()
    return customer
```
**Why it's wrong:**
- The extraction turned 2 queries into 1 + N queries: same result, very different behavior under load.
- Assigning `customer.orders` manually may also mark the relationship dirty and trigger unexpected writes.

## Best Practice (How to do it right)

### 1. "Big bang" refactoring without a safety net (Java)
```text
PR #401 test: characterization tests for InvoiceService
  - 38 golden cases generated from 3 months of production invoices (anonymized), asserting totals,
    VAT lines, and credit-note handling exactly as today (including the double-count bug, marked @KnownBug)

PR #402 refactor: extract CustomerPricingPolicy (IDE Extract Class, tests unchanged, green)
PR #403 refactor: replace customer-type conditional with polymorphism (tests unchanged, green)
PR #404 fix: credit notes counted twice (FIN-219)
  - flips the @KnownBug expectation, adds a regression test, release note for finance
```
**Why it's right:**
- Characterization tests freeze the current behavior before any structural change.
- Each refactoring PR has unchanged, green tests: proof that behavior is preserved.
- The bug fix is a separate, visible behavior change with its own test and communication.

### 2. Type code switch duplicated across the codebase (TypeScript)
```typescript
interface ShippingMethod {
  readonly code: 'STANDARD' | 'EXPRESS' | 'PICKUP';
  readonly costCents: number;
  readonly deliveryDays: number;
  readonly label: string;
}

const SHIPPING_METHODS = {
  STANDARD: { code: 'STANDARD', costCents: 490, deliveryDays: 5, label: 'Standard delivery' },
  EXPRESS: { code: 'EXPRESS', costCents: 990, deliveryDays: 1, label: 'Express delivery' },
  PICKUP: { code: 'PICKUP', costCents: 0, deliveryDays: 0, label: 'Store pickup' },
} as const satisfies Record<ShippingMethod['code'], ShippingMethod>;

export const shippingMethodOf = (order: Order): ShippingMethod => SHIPPING_METHODS[order.shippingType];
```
**Why it's right:**
- Each shipping method is described in one place; `satisfies Record<...>` makes the compiler reject a missing method.
- Callers ask the method object instead of switching on the code (Replace Conditional with Polymorphism in its data-driven form).
- Costs become integer cents, removing floating-point money as a side benefit (done in a separate commit with its own test).

### 3. Refactoring that silently changes I/O behavior (Python)
```python
def active_customers_with_orders(session: Session) -> list[Customer]:
    return session.scalars(active_customers_query().options(selectinload(Customer.orders))).all()


def active_customers_query() -> Select[tuple[Customer]]:
    return select(Customer).where(Customer.active)


# test guarding the I/O behavior of the refactoring
def test_loads_customers_and_orders_in_two_queries(session, query_counter):
    seed_customers(session, count=20, orders_each=3)
    with query_counter() as counter:
        result = active_customers_with_orders(session)
    assert len(result) == 20
    assert counter.count == 2
```
**Why it's right:**
- The extraction isolates the reusable part (the query) without changing how data is loaded.
- A query-count test turns "no N+1" into an explicit, protected behavior of the function.
