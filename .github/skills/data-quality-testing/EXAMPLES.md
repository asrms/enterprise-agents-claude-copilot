# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Silent cleaning and publish-then-check
```python
def load_orders(df, engine):
    df = df.drop_duplicates()                                    # hides a broken upstream key
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")  # invalid values become NaN silently
    df = df.dropna()                                             # rows disappear without a trace
    df.to_sql("orders", engine, if_exists="append")              # consumers see data before any check
    try:
        assert len(df) > 0
    except AssertionError:
        pass                                                     # failure swallowed
```
**Why it's wrong:**
- Bad data is removed without counting or keeping it, so nobody can tell a clean day from a broken feed.
- Data is published before validation; the only check is swallowed.
- There are no checks on freshness, enums, keys, or volume trends.

## Best Practice (How to do it right)

### 1. Declarative checks with SodaCL on the audit table
`checks/orders.yml`:
```yaml
checks for orders_audit:
  - row_count between 1000 and 500000
  - duplicate_count(order_id) = 0
  - missing_count(customer_id) = 0
  - invalid_percent(status) < 1%:
      valid values: [placed, paid, shipped, cancelled]
  - freshness(updated_at) < 3h
  - schema:
      fail:
        when required column missing: [order_id, customer_id, status, amount, updated_at]
        when wrong column type:
          amount: decimal
```

### 2. Validation with quarantine in Python (pandera)
```python
import pandas as pd
import pandera.pandas as pa
from pandera.typing import Series

class Order(pa.DataFrameModel):
    order_id: Series[str] = pa.Field(unique=True)
    customer_id: Series[str] = pa.Field(nullable=False)
    status: Series[str] = pa.Field(isin=["placed", "paid", "shipped", "cancelled"])
    amount: Series[float] = pa.Field(ge=0)

    class Config:
        strict = True
        coerce = True

MAX_QUARANTINE_RATE = 0.01

def validate(df: pd.DataFrame, run_id: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    try:
        return Order.validate(df, lazy=True), df.iloc[0:0]
    except pa.errors.SchemaErrors as exc:
        failed_idx = exc.failure_cases["index"].dropna().unique()
        bad = df.loc[df.index.isin(failed_idx)].assign(run_id=run_id)
        good = Order.validate(df.drop(index=bad.index))
        if len(bad) / max(len(df), 1) > MAX_QUARANTINE_RATE:
            raise RuntimeError(f"quarantine rate {len(bad)}/{len(df)} exceeds threshold") from exc
        return good, bad
```
**Why it's right:**
- Checks cover schema, volume, keys, validity, and freshness, and run on the audit table before publication.
- Invalid rows are kept with the run id for investigation, and a high rejection rate fails the run.
- Rules live in versioned files and code, so they are reviewed and tested like the pipeline itself.
