# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Non-sargable predicate, wrong index, deep OFFSET
```sql
CREATE INDEX ix_order_created ON purchase_order (created_at);
CREATE INDEX ix_order_status  ON purchase_order (status);

SELECT *
FROM   purchase_order
WHERE  tenant_id = 42
AND    date(created_at) = '2026-09-01'
AND    status = 'PENDING'
ORDER  BY created_at DESC
OFFSET 100000 LIMIT 50;
```
**Why it's wrong:**
- `date(created_at)` prevents the use of the `created_at` index; the tenant filter has no index at all.
- Two single-column indexes cannot serve the combined filter and sort efficiently.
- `OFFSET 100000` reads and discards 100,000 rows on every page; `SELECT *` defeats index-only scans.

### 2. N+1 queries from an ORM (Python, SQLAlchemy)
```python
orders = session.scalars(select(Order).where(Order.tenant_id == tenant_id)).all()
for order in orders:
    print(order.customer.email)   # lazy load: one extra query per order
```
**Why it's wrong:**
- 1 + N round trips; latency grows linearly with the page size.

## Best Practice (How to do it right)

### 1. Composite, covering index with a sargable range and keyset pagination
```sql
CREATE INDEX CONCURRENTLY ix_order_tenant_status_created
  ON purchase_order (tenant_id, status, created_at DESC, id DESC)
  INCLUDE (total_amount, currency);

SELECT id, created_at, total_amount, currency
FROM   purchase_order
WHERE  tenant_id = 42
AND    status = 'PENDING'
AND    created_at >= '2026-09-01' AND created_at < '2026-09-02'
AND    (created_at, id) < ($1, $2)          -- cursor from the previous page
ORDER  BY created_at DESC, id DESC
LIMIT  50;
```
```text
Index Only Scan using ix_order_tenant_status_created on purchase_order
  (actual time=0.041..0.212 rows=50 loops=1)
  Heap Fetches: 0
  Buffers: shared hit=7
```
**Why it's right:**
- Equality columns first, then the sort columns: the index returns rows already ordered, with no sort node.
- The range predicate is sargable, and the cursor seeks directly to the page.
- The selected columns are covered, so the plan is an index-only scan with a handful of buffers.

### 2. Eager loading to remove N+1 (Python, SQLAlchemy)
```python
stmt = (
    select(Order)
    .where(Order.tenant_id == tenant_id)
    .options(selectinload(Order.customer))
    .limit(50)
)
orders = session.scalars(stmt).all()   # 2 queries total, regardless of page size
```
**Why it's right:**
- Related rows are loaded in one batched query; a test with a query counter can assert the number of statements.
