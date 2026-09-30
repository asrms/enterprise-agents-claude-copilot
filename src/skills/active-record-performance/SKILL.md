---
name: active-record-performance
description: "Efficient Active Record usage in Rails: avoiding N+1 queries with includes, preload, and eager_load, strict_loading, selecting and plucking only needed data, counter caches and aggregates, batching with find_each and in_batches, insert_all and upsert_all, pagination, database indexes and constraints, transactions and locking, query analysis with EXPLAIN, and detection with Bullet or Prosopite. Use it when writing or reviewing Active Record queries and models."
---

# Skill: Active Record Performance

## Implementation Rules:
- **[MANDATORY]** Prevent N+1 queries: preload associations used in views and serializers (`includes`, `preload`, `eager_load`), enable `strict_loading` for models or globally in development and test (`config.active_record.strict_loading_by_default` or per association), and run Bullet or Prosopite in development and CI.
- **[PERFORMANCE]** Load only what you need: `select` specific columns, `pluck` or `pick` for raw values, `exists?` instead of `present?` on relations, and `size` or counter caches (`counter_cache: true`) instead of loading collections to count.
- **[PERFORMANCE]** Process large tables in batches with `find_each` or `in_batches` (by primary key) and move heavy processing to background jobs; never iterate `Model.all` in memory for large datasets.
- **[PERFORMANCE]** Paginate every listing (Pagy or Kaminari, keyset pagination for very large tables with `where("id < ?", cursor).order(id: :desc).limit(n)`).
- **[PATTERN]** Write in bulk with `insert_all`, `upsert_all`, and `update_all` when callbacks and validations are intentionally skipped, and use atomic updates (`update_counters`, `increment!` with care, conditional `where(...).update_all`) for counters and stock.
- **[MANDATORY]** Back model validations with database constraints: `null: false`, unique indexes for uniqueness validations (race conditions otherwise), foreign keys, and check constraints in migrations.
- **[MANDATORY]** Add indexes for foreign keys and columns used in `where`, `order`, and joins, including composite indexes matching common queries; add them concurrently on large PostgreSQL tables (`algorithm: :concurrently` with `disable_ddl_transaction!`).
- **[PATTERN]** Use transactions for multi-record writes, optimistic locking (`lock_version`) or pessimistic locking (`lock`, `with_lock`) for concurrent updates, and keep transactions short without external calls.
- **[FORBIDDEN]** String interpolation in `where` clauses (use placeholders or hashes), `default_scope` for anything beyond trivial ordering (surprising queries), queries in view loops, and loading entire tables for reports during web requests.
- **[PATTERN]** Cache expensive fragments and queries with Rails caching (`Rails.cache.fetch` with versioned keys, Russian doll view caching with `cache` helpers and `touch: true`), scoped to the user or tenant when data is personalized.
- **[PATTERN]** Analyze slow queries with `EXPLAIN` (`relation.explain`, including `explain(:analyze)` on PostgreSQL in Rails 7.1+), the database's slow query log, and APM traces.
- **[TESTING]** Guard critical paths against regressions: strict loading and Prosopite in the test suite, query count assertions for key endpoints, and migrations checked with `strong_migrations` for unsafe operations.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
