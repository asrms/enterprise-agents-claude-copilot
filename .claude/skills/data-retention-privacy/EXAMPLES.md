# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Keep everything forever, copy production to test
```bash
# nightly job
pg_dump prod_db | psql test_db        # real customers, emails, and addresses in test
```
```sql
CREATE TABLE api_request_log (
  id bigserial PRIMARY KEY,
  body jsonb,                          -- full request bodies: passwords, card data, health info
  created_at timestamp
);                                     -- no retention, grows forever
```
**Why it's wrong:**
- Personal data leaves the controlled production environment, reaching developers, vendors, and laptops.
- Logs store sensitive payloads without purpose or retention, turning a breach into a disaster and violating minimization.

## Best Practice (How to do it right)

### 1. Classified columns, partitioned retention, and encrypted fields (PostgreSQL)
```sql
CREATE TABLE audit_event (
  id          bigint GENERATED ALWAYS AS IDENTITY,
  subject_ref text        NOT NULL,     -- HMAC pseudonym of the customer id
  action      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON COLUMN audit_event.subject_ref IS 'classification=personal-pseudonymized; retention=13 months';

CREATE TABLE audit_event_2026_09 PARTITION OF audit_event
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- retention job (monthly): dropping a partition is instant and leaves no dead tuples
DROP TABLE IF EXISTS audit_event_2025_08;
```
```python
# field-level envelope encryption for a highly sensitive attribute
ciphertext = kms_encrypt(key_id="alias/customer-pii", plaintext=national_id.encode(),
                         context={"table": "customer", "column": "national_id"})
customer.national_id_enc = ciphertext
```
**Why it's right:**
- Classification and retention live next to the schema; retention is enforced by dropping expired partitions.
- Direct identifiers are pseudonymized, and the most sensitive field is encrypted with a key held outside the database.

### 2. Erasure as a tested, event-driven feature
```python
def erase_subject(subject_id: str) -> None:
    with uow() as tx:
        tx.customers.anonymize(subject_id)          # replace PII with placeholders, keep financial records required by law
        tx.consents.delete_for(subject_id)
        tx.erasure_log.record(subject_id)           # re-applied after any backup restore
        tx.outbox.publish("customer.erased.v1", {"subjectRef": hmac_ref(subject_id)})

def test_erasure_removes_subject_from_all_stores(env):
    env.seed_customer("c-42", email="ana@example.test")
    erase_subject("c-42")
    assert env.db.find_email("ana@example.test") is None
    assert env.search.find("ana@example.test") == []
    assert env.cache.get("customer:c-42") is None
```
**Why it's right:**
- Downstream systems (search, analytics, caches) are notified through the outbox, and the test proves erasure end to end.
- The erasure log makes restores from older backups compliant.
