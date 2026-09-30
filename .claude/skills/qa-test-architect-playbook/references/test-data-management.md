# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tests depending on a shared, manually maintained dataset (Python)
```python
def test_invoice_total(api_client):
    # customer 17 and order 4521 "exist in the test DB"
    response = api_client.get("/customers/17/orders/4521/invoice")
    assert response.json()["total"] == "129.90"
```
**Why it's wrong:**
- The test breaks as soon as someone modifies or deletes record 4521, and nobody knows why it exists.
- Parallel runs and other tests that modify the same order produce random failures.

### 2. Production dump copied into staging
```bash
pg_dump prod_db | psql staging_db      # "we need realistic data for testing"
```
**Why it's wrong:**
- Personal data (names, emails, addresses, payment references) is exposed to everyone with staging access, which violates data minimization and purpose limitation (GDPR Art. 5).
- Staging often has weaker security controls, so a breach there is a breach of production data.

## Best Practice (How to do it right)

### 1. Tests depending on a shared, manually maintained dataset (Python)
```python
class CustomerFactory(factory.Factory):
    class Meta:
        model = Customer
    id = factory.LazyFunction(uuid4)
    email = factory.Sequence(lambda n: f"customer{n}@example.test")
    country = "IT"


class OrderFactory(factory.Factory):
    class Meta:
        model = Order
    id = factory.LazyFunction(uuid4)
    customer = factory.SubFactory(CustomerFactory)
    lines = factory.List([factory.SubFactory(OrderLineFactory)])


def test_invoice_total_includes_italian_vat(api_client, db_session):
    order = OrderFactory(lines=[OrderLineFactory(net_cents=10_000)])   # only the relevant value
    save(db_session, order)

    response = api_client.get(f"/customers/{order.customer.id}/orders/{order.id}/invoice")

    assert response.json()["total"] == {"amount": "122.00", "currency": "EUR"}
```
**Why it's right:**
- The test creates exactly the data it needs with unique identifiers; defaults hide irrelevant details.
- The expected value follows directly from the visible input (100.00 net + 22% VAT).

### 2. Production dump copied into staging
```yaml
# anonymization pipeline (runs in the production security zone, output reviewed by the DPO)
source: prod_db (read replica)
rules:
  customers.email:       { strategy: fake_email, seed_column: id }      # deterministic per id
  customers.full_name:   { strategy: fake_name, seed_column: id }
  customers.phone:       { strategy: null }
  customers.birth_date:  { strategy: generalize, to: year }
  addresses.street:      { strategy: fake_street }
  payments.card_last4:   { strategy: constant, value: "0000" }
  orders.*:              { strategy: keep }                               # no personal data
subset: 5% of tenants, with referential integrity preserved
output: staging_db
```
**Why it's right:**
- Personal data is replaced or generalized before leaving the production zone, while distributions and relations stay realistic.
- Deterministic fakes keep joins consistent, and subsetting keeps the environment small and cheap.
