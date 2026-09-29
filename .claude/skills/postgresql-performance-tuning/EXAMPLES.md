# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tuning by guesswork
```text
"The database is slow" →
  max_connections = 2000          (application pools: 40 instances × 50 connections)
  work_mem = 1GB                  (per operation, per connection → memory exhaustion under load)
  autovacuum = off                ("it slows things down")
  shared_buffers = 90% of RAM
```
**Why it's wrong:**
- Thousands of connections mean thousands of processes competing for CPU and memory.
- `work_mem = 1GB` can be multiplied by many operations and connections and cause out-of-memory kills.
- Disabling autovacuum causes table bloat and eventually transaction ID wraparound protection shutdowns.

### 2. Adding an index without reading the plan
```sql
CREATE INDEX ON orders (status);    -- 4 distinct values, 50M rows
-- query still slow:
SELECT * FROM orders WHERE customer_id = $1 AND status = 'SHIPPED' ORDER BY created_at DESC LIMIT 20;
```
**Why it's wrong:**
- A low-selectivity index on `status` does not help this query; the real filter and sort are on `customer_id` and `created_at`.

## Best Practice (How to do it right)

### 1. Measure, then tune
```sql
-- top queries by total time
SELECT queryid, calls, round(total_exec_time) AS total_ms, round(mean_exec_time, 1) AS mean_ms, rows, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- tables where vacuum is falling behind
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 100000
ORDER BY n_dead_tup DESC;

ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);
ALTER ROLE app SET statement_timeout = '5s';
ALTER ROLE app SET idle_in_transaction_session_timeout = '30s';
```
```ini
# pgbouncer.ini — transaction pooling in front of PostgreSQL
[pgbouncer]
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 40
```
**Why it's right:**
- Work is prioritized by measured cost; vacuum is tuned for the tables that need it; runaway queries and idle transactions are bounded.
- Thousands of client connections are multiplexed onto a small number of server connections.

### 2. Index designed from the plan
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, total_amount, created_at FROM orders
WHERE customer_id = $1 AND status = 'SHIPPED'
ORDER BY created_at DESC LIMIT 20;
-- Before: Seq Scan on orders (rows=50M) → Sort → Limit, 2.8 s, shared read=410k

CREATE INDEX CONCURRENTLY ix_orders_customer_status_created
  ON orders (customer_id, status, created_at DESC);
-- After: Index Scan using ix_orders_customer_status_created, 0.4 ms, shared hit=5
```
**Why it's right:**
- The composite index matches the equality filters first and the sort column last, so PostgreSQL reads 20 rows in order and stops.
- The index is built `CONCURRENTLY` to avoid blocking writes, and the improvement is verified with the same plan.
