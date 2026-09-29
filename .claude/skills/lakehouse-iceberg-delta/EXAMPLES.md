# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Over-partitioned table, blind appends, no maintenance
```sql
CREATE TABLE lake.sales.orders (
  order_id STRING, customer_id STRING, amount DECIMAL(18,2), updated_at TIMESTAMP,
  order_date DATE, order_hour INT)
USING iceberg
PARTITIONED BY (customer_id, order_date, order_hour);   -- millions of tiny partitions

-- every micro-batch appends changed rows, duplicates accumulate
INSERT INTO lake.sales.orders SELECT * FROM staging_order_changes;
```
```sql
-- "fix" for a privacy request
SET spark.databricks.delta.retentionDurationCheck.enabled = false;
VACUUM lake.crm.customers RETAIN 0 HOURS;                -- breaks readers and time travel
```
**Why it's wrong:**
- Partitioning by a high-cardinality id and by derived hour columns produces tiny files and slow planning.
- Appending change rows duplicates records; the table needs a MERGE with deduplication.
- Zero-hour vacuum deletes files still used by running queries and streams; nothing compacts or expires snapshots.

## Best Practice (How to do it right)

### 1. Iceberg table with hidden partitioning, MERGE, and maintenance
```sql
CREATE TABLE lake.sales.orders (
  order_id    STRING NOT NULL,
  customer_id STRING NOT NULL,
  status      STRING,
  amount      DECIMAL(18,2),
  updated_at  TIMESTAMP NOT NULL)
USING iceberg
PARTITIONED BY (days(updated_at))
TBLPROPERTIES (
  'format-version' = '2',
  'write.target-file-size-bytes' = '536870912',
  'write.merge.mode' = 'merge-on-read',
  'write.delete.mode' = 'merge-on-read',
  'history.expire.max-snapshot-age-ms' = '604800000');

MERGE INTO lake.sales.orders t
USING (
  SELECT * FROM (
    SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY updated_at DESC) AS rn
    FROM staging_order_changes) WHERE rn = 1
) s
ON t.order_id = s.order_id
WHEN MATCHED AND s.updated_at > t.updated_at THEN
  UPDATE SET t.status = s.status, t.amount = s.amount, t.updated_at = s.updated_at
WHEN NOT MATCHED THEN
  INSERT (order_id, customer_id, status, amount, updated_at)
  VALUES (s.order_id, s.customer_id, s.status, s.amount, s.updated_at);
```
```sql
-- nightly maintenance job
CALL lake.system.rewrite_data_files(table => 'sales.orders', strategy => 'binpack',
  where => 'updated_at >= current_date() - INTERVAL 2 DAYS');
CALL lake.system.expire_snapshots(table => 'sales.orders',
  older_than => current_timestamp() - INTERVAL 7 DAYS, retain_last => 20);
CALL lake.system.remove_orphan_files(table => 'sales.orders',
  older_than => current_timestamp() - INTERVAL 3 DAYS);
CALL lake.system.rewrite_manifests('sales.orders');
```
**Why it's right:**
- Hidden daily partitioning prunes by time without extra columns; file size and write modes are explicit.
- The MERGE deduplicates the source and ignores out-of-order updates, so reruns are idempotent.
- Compaction, snapshot expiry, and orphan cleanup keep planning fast and storage bounded, with retention that protects readers.
