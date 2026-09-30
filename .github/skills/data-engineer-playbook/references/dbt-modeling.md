# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Full rebuild with hardcoded tables and no tests
```sql
-- models/orders_report.sql
{{ config(materialized='table') }}
select *                                              -- unstable columns downstream
from raw_prod.shop.orders o                           -- hardcoded: no lineage, no environments
left join raw_prod.shop.customers c on o.cust = c.id
where o.status <> 'test'                              -- business rule buried in a report model
```
**Why it's wrong:**
- Raw tables are referenced directly, so dbt cannot build lineage, run freshness checks, or defer in CI.
- The whole history is rebuilt on every run, and a many-to-one join assumption is never tested.
- `select *` and an undocumented grain make every upstream change a silent breaking change.

## Best Practice (How to do it right)

### 1. Staging, incremental fact, contract, and tests
```sql
-- models/staging/shop/stg_shop__orders.sql
select
    cast(id as varchar)              as order_id,
    cast(customer_id as varchar)     as customer_id,
    lower(status)                    as order_status,
    cast(amount_cents as bigint)     as amount_cents,
    cast(updated_at as timestamp)    as updated_at
from {{ source('shop', 'orders') }}
```
```sql
-- models/marts/sales/fct_orders.sql
{{ config(materialized='incremental', unique_key='order_id',
          incremental_strategy='merge', on_schema_change='fail') }}
select order_id, customer_id, order_status, amount_cents, updated_at
from {{ ref('stg_shop__orders') }}
where order_status <> 'test'
{% if is_incremental() %}
  and updated_at > (select max(updated_at) - interval '3 days' from {{ this }})  -- late rows
{% endif %}
```
`models/marts/sales/_sales__models.yml`:
```yaml
models:
  - name: fct_orders
    description: One row per order (grain = order_id), latest state.
    config:
      access: public
      group: sales
      contract: { enforced: true }
    columns:
      - name: order_id
        data_type: varchar
        data_tests: [unique, not_null]
      - name: customer_id
        data_type: varchar
        data_tests:
          - relationships:
              arguments: { to: "ref('dim_customers')", field: customer_id }
      - name: order_status
        data_type: varchar
      - name: amount_cents
        data_type: bigint
      - name: updated_at
        data_type: timestamp
unit_tests:
  - name: fct_orders_excludes_test_orders
    model: fct_orders
    given:
      - input: ref('stg_shop__orders')
        rows:
          - { order_id: '1', order_status: 'placed', amount_cents: 1000 }
          - { order_id: '2', order_status: 'test', amount_cents: 5 }
    expect:
      rows:
        - { order_id: '1' }
```
**Why it's right:**
- Sources and refs give full lineage; staging only renames and casts, and the mart holds the business rule once.
- The incremental merge with a lookback window handles late updates without full rebuilds.
- The contract, key tests, relationship test, and unit test catch breaking changes in CI before they reach consumers.
