# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Rename and tighten in one blocking step (PostgreSQL)
```sql
-- V12__rename_email.sql
ALTER TABLE customer RENAME COLUMN mail TO email;
ALTER TABLE customer ALTER COLUMN email SET NOT NULL;
CREATE INDEX ix_customer_email ON customer (email);
UPDATE customer SET email = lower(email);
```
**Why it's wrong:**
- Instances running the previous release still query `mail` and fail immediately after the rename.
- `CREATE INDEX` without `CONCURRENTLY` blocks writes for the whole build; `SET NOT NULL` scans the table under an exclusive lock.
- A single `UPDATE` of every row creates a long transaction, lock contention, and a large WAL spike.

### 2. Editing an applied migration
```text
git diff V10__create_invoice.sql
-  amount numeric(10,2) NOT NULL
+  amount numeric(19,4) NOT NULL
```
**Why it's wrong:**
- Environments that already applied V10 keep the old type while new ones get the new type: silent drift.
- Flyway/Liquibase checksum validation fails, or is disabled to "fix" it.

## Best Practice (How to do it right)

### 1. Expand and contract across releases (PostgreSQL)
```sql
-- Release N: V20__add_customer_email.sql (expand)
SET lock_timeout = '5s';
ALTER TABLE customer ADD COLUMN email text;
```
```sql
-- Release N: V21__index_customer_email.sql (non-transactional)
-- flyway:executeInTransaction=false
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_customer_email ON customer (email);
```
```sql
-- Backfill job (idempotent, batched, run after release N writes both columns)
UPDATE customer
SET    email = lower(mail)
WHERE  id IN (
  SELECT id FROM customer
  WHERE  email IS NULL AND mail IS NOT NULL
  ORDER  BY id
  LIMIT  5000
);
-- repeat until 0 rows updated, committing between batches
```
```sql
-- Release N+1: V22__email_not_null.sql
SET lock_timeout = '5s';
ALTER TABLE customer ADD CONSTRAINT ck_customer_email_not_null CHECK (email IS NOT NULL) NOT VALID;
ALTER TABLE customer VALIDATE CONSTRAINT ck_customer_email_not_null;
```
```sql
-- Release N+2 (after N can no longer be rolled back): V23__drop_customer_mail.sql
ALTER TABLE customer DROP COLUMN mail;
```
**Why it's right:**
- Every release is compatible with the previous one, so rolling deployments and rollbacks keep working.
- Index creation and constraint validation avoid long exclusive locks; `lock_timeout` fails fast instead of queueing traffic.
- The backfill is batched, resumable, and separate from DDL.

### 2. Migration verification in CI
```yaml
migrations:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:17
      env: { POSTGRES_PASSWORD: test }
      ports: ['5432:5432']
  steps:
    - uses: actions/checkout@v4
    - run: npx squawk-cli db/migration/*.sql
    - run: flyway -url=jdbc:postgresql://localhost:5432/postgres -user=postgres -password=test migrate validate
    - run: ./gradlew integrationTest
```
**Why it's right:**
- Dangerous DDL is flagged by a linter before review.
- Migrations are applied to the same engine and version used in production, and the application tests run against the result.
