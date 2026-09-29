---
name: postgresql-performance-tuning
description: "PostgreSQL performance: reading EXPLAIN (ANALYZE, BUFFERS), pg_stat_statements for top queries, memory and planner settings, connection pooling with PgBouncer, autovacuum and bloat, locking and long transactions, partitioning, and monitoring. Use it when a PostgreSQL database is slow, overloaded, or being sized and configured."
---

# Skill: PostgreSQL Performance Tuning

## Implementation Rules:
- **[MANDATORY]** Measure before tuning: enable `pg_stat_statements` and rank queries by `total_exec_time` and `mean_exec_time`; optimize the top offenders first instead of changing global settings blindly.
- **[MANDATORY]** Analyze slow queries with `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` on production-like data: look for sequential scans on large tables, row estimate errors (estimated vs actual rows off by 10× or more), nested loops over many rows, sorts or hashes spilling to disk, and high shared buffer reads.
- **[PATTERN]** Fix estimate errors before adding indexes: run `ANALYZE`, raise `default_statistics_target` or per-column statistics for skewed columns, and create extended statistics (`CREATE STATISTICS ... (dependencies, ndistinct, mcv)`) for correlated columns.
- **[CONFIGURATION]** Baseline memory settings for a dedicated server: `shared_buffers` ≈ 25% of RAM, `effective_cache_size` ≈ 50–75% of RAM, `work_mem` sized per sort/hash operation (e.g. 16–64 MB, remembering it can be used several times per query and per connection), `maintenance_work_mem` 512 MB–2 GB, `random_page_cost` ≈ 1.1 on SSD/NVMe.
- **[MANDATORY]** Keep connections low and pooled: PostgreSQL uses one process per connection; use PgBouncer (transaction pooling) or the platform pooler, and size application pools so that total connections stay well below `max_connections` (typically tens to a few hundred, not thousands).
- **[PATTERN]** Autovacuum must keep up: monitor dead tuples and bloat (`pg_stat_user_tables.n_dead_tup`, `last_autovacuum`), tune per-table `autovacuum_vacuum_scale_factor` (e.g. 0.01–0.05) and `autovacuum_vacuum_cost_limit` for large, frequently updated tables; never disable autovacuum.
- **[FORBIDDEN]** Long-running transactions and sessions left `idle in transaction`: they block vacuum and hold locks; set `idle_in_transaction_session_timeout` and `statement_timeout` per role/application.
- **[PATTERN]** Reduce lock contention: keep transactions short, update rows in a consistent order to avoid deadlocks, use `SELECT ... FOR UPDATE SKIP LOCKED` for queue-like workloads, and set `lock_timeout` for migrations and batch jobs.
- **[PATTERN]** Partition very large, time-based tables (declarative range partitioning by month/day) when queries filter by time and old data is dropped or archived; drop partitions instead of mass `DELETE`.
- **[PERFORMANCE]** Bulk operations use `COPY` or multi-row `INSERT`, batch updates in chunks with commits between them, and avoid row-by-row loops from the application.
- **[PATTERN]** Read scaling with streaming replicas for read-only queries that tolerate replication lag; caching of hot, rarely changing data in the application or Redis with explicit invalidation.
- **[CONFIGURATION]** Log slow queries (`log_min_duration_statement` e.g. 500 ms), lock waits (`log_lock_waits = on`), and autovacuum activity; use `auto_explain` for plans of slow queries in production with sampling.
- **[TESTING]** Validate changes with before/after measurements (EXPLAIN ANALYZE, pg_stat_statements deltas, load tests), and test on a copy with production-like data volume and distribution.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
