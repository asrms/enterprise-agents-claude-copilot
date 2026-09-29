---
name: indexing-query-optimization
description: "Index design and SQL query optimization for relational databases: B-tree column order, composite, covering, partial and expression indexes, sargable predicates, execution plan reading, N+1 detection, keyset pagination, and index maintenance. Use it when a query is slow or when designing indexes for new access patterns."
---

# Skill: Indexing and Query Optimization

## Implementation Rules:
- **[MANDATORY]** Design indexes from real query patterns (the `WHERE`, `JOIN`, `ORDER BY`, and `GROUP BY` clauses of the frequent and slow queries), not per column; every index must justify its write, storage, and vacuum cost.
- **[MANDATORY]** Verify every optimization with the execution plan on production-like data volumes and statistics (`EXPLAIN (ANALYZE, BUFFERS)` in PostgreSQL, `EXPLAIN ANALYZE` in MySQL 8, actual execution plans in SQL Server); compare before and after, never assume.
- **[PATTERN]** Composite B-tree column order: equality predicates first, then range or sort columns (`(tenant_id, status, created_at)` for `WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC`); an index on `(a, b)` also serves queries on `a` alone, so avoid redundant single-column indexes.
- **[PATTERN]** Use covering indexes (`INCLUDE (...)` in PostgreSQL/SQL Server) for hot read queries to enable index-only scans, partial indexes (`WHERE status = 'PENDING'`, `WHERE deleted_at IS NULL`) for skewed subsets, and expression indexes (`lower(email)`) that match the query expression exactly.
- **[PERFORMANCE]** Keep predicates sargable: no functions or implicit casts on indexed columns (`WHERE date(created_at) = ...` becomes a range `created_at >= ? AND created_at < ?`), matching parameter types, no leading wildcard `LIKE '%x'` on B-tree (use trigram/full-text indexes), and `OR` across columns rewritten as `UNION ALL` when needed.
- **[PERFORMANCE]** Paginate large result sets with keyset (seek) pagination (`WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 50`) instead of deep `OFFSET`, which reads and discards all skipped rows.
- **[FORBIDDEN]** N+1 query patterns from ORMs (one query per parent row), `SELECT *` in application queries, unbounded queries without `LIMIT` on user-facing paths, and query hints that override the planner without a documented, measured reason.
- **[PATTERN]** Choose the index type for the operator: B-tree for equality/range/sort, GIN for `jsonb`, arrays and full-text, GiST/SP-GiST for ranges and geometry, BRIN for very large append-only tables correlated with physical order, hash only for pure equality.
- **[PERFORMANCE]** Index every foreign key column used in joins or cascading deletes, and review unused and duplicate indexes periodically (`pg_stat_user_indexes.idx_scan = 0`, `sys.dm_db_index_usage_stats`) before dropping them.
- **[PERFORMANCE]** Keep statistics fresh (`ANALYZE` after bulk loads, extended statistics for correlated columns with `CREATE STATISTICS`), and watch for plan regressions after upgrades or data growth.
- **[PATTERN]** Push work to the database appropriately: aggregate and filter in SQL rather than in application memory, use batch inserts/upserts (`INSERT ... ON CONFLICT`) instead of row-by-row round trips, and avoid correlated subqueries that execute once per row when a join or window function suffices.
- **[TESTING]** Critical queries have performance regression checks: plans or query counts asserted in tests (for example, ORM query counters to catch N+1), and slow query logs (`log_min_duration_statement`, MySQL slow log) monitored in every environment.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
