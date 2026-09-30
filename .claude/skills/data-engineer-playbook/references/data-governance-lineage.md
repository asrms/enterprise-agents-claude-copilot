# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unowned tables and user-level grants on raw personal data
```sql
CREATE TABLE analytics.customers_copy_final_v2 AS SELECT * FROM raw.crm.customers;  -- email, phone, birth date
GRANT SELECT ON TABLE raw.crm.customers TO `alice@example.com`;
GRANT SELECT ON TABLE analytics.customers_copy_final_v2 TO `bob@example.com`;
-- no owner, no description, no classification, no lineage from the copy back to the source
```
**Why it's wrong:**
- Personal data is duplicated into an unmanaged table and granted to individuals, bypassing classification and review.
- Nobody knows who owns the copy, who uses it, or how to delete a customer's data from it.

## Best Practice (How to do it right)

### 1. Classification tags, group grants, masking, and row filters (Unity Catalog SQL)
```sql
ALTER TABLE sales.curated.customers SET TAGS ('owner' = 'team-crm', 'domain' = 'sales', 'tier' = 'gold');
ALTER TABLE sales.curated.customers ALTER COLUMN email SET TAGS ('classification' = 'personal');

CREATE FUNCTION sales.governance.mask_email(email STRING)
  RETURN CASE WHEN is_account_group_member('pii-readers') THEN email
              ELSE concat('***@', split_part(email, '@', 2)) END;

ALTER TABLE sales.curated.customers ALTER COLUMN email SET MASK sales.governance.mask_email;

CREATE FUNCTION sales.governance.region_filter(region STRING)
  RETURN is_account_group_member('sales-global') OR region = 'EU' AND is_account_group_member('sales-eu');

ALTER TABLE sales.curated.customers SET ROW FILTER sales.governance.region_filter ON (region);

GRANT SELECT ON TABLE sales.curated.customers TO `sales-analysts`;
```
### 2. Contract and ownership declared with the model (dbt)
```yaml
models:
  - name: dim_customers
    description: One row per customer (grain = customer_id). Source of truth for customer attributes.
    config:
      meta:
        owner: team-crm
        contract_version: 2
        freshness_sla: 6h
      grants:
        select: ['sales-analysts', 'finance-analysts']
      contract: { enforced: true }
    columns:
      - name: customer_id
        data_type: varchar
        data_tests: [unique, not_null]
      - name: email_hash
        data_type: varchar
        description: HMAC-SHA256 of the normalized email; raw email is not exposed in marts.
        meta: { classification: personal-pseudonymized }
```
**Why it's right:**
- Ownership, tier, and classification are attached to the data itself; access goes to groups, and masking and row filters apply automatically.
- The mart exposes a pseudonymized identifier under an enforced contract, and grants are declared as code and applied by the pipeline.
