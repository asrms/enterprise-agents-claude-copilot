# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Weak types and no constraints (PostgreSQL)
```sql
CREATE TABLE Orders (
  ID serial,
  CustomerEmail varchar(255),
  Items text,                     -- 'SKU-1:2,SKU-7:1'
  Total float,
  Status int,                     -- 1=new, 2=paid, 3=shipped ... documented nowhere
  Created timestamp,              -- local time of the server
  Deleted bit
);
```
**Why it's wrong:**
- No primary key, no `NOT NULL`, no foreign keys: duplicated and orphaned rows are possible.
- Order lines are a comma-separated string; money is `float`; status is a magic number.
- `timestamp` without time zone stores server-local time; mixed-case identifiers invite quoting problems.

## Best Practice (How to do it right)

### 1. Constrained, typed schema (PostgreSQL)
```sql
CREATE TABLE customer (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id   bigint      NOT NULL,
  email       text        NOT NULL CHECK (length(email) <= 254),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE purchase_order (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id    uuid        NOT NULL UNIQUE,                         -- non-enumerable id exposed by the API
  tenant_id    bigint      NOT NULL,
  customer_id  bigint      NOT NULL REFERENCES customer (id) ON DELETE RESTRICT,
  status       text        NOT NULL CHECK (status IN ('PENDING', 'PAID', 'SHIPPED', 'CANCELLED')),
  total_amount numeric(19,4) NOT NULL CHECK (total_amount >= 0),
  currency     char(3)     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  version      integer     NOT NULL DEFAULT 0
);
CREATE INDEX ix_purchase_order_customer_created ON purchase_order (customer_id, created_at DESC);

CREATE TABLE order_line (
  order_id    bigint  NOT NULL REFERENCES purchase_order (id) ON DELETE CASCADE,
  line_no     smallint NOT NULL,
  sku         text    NOT NULL,
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  numeric(19,4) NOT NULL CHECK (unit_price >= 0),
  PRIMARY KEY (order_id, line_no)
);

ALTER TABLE purchase_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_order
  USING (tenant_id = current_setting('app.tenant_id')::bigint);
```
**Why it's right:**
- Keys, foreign keys, `NOT NULL`, and `CHECK` constraints make invalid data impossible, regardless of the application.
- Money is exact with an explicit currency, timestamps are time-zone aware, and status values are constrained.
- Order lines are rows, not strings; multi-tenancy is enforced by unique constraints and Row-Level Security.
