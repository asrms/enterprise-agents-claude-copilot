---
name: eloquent-performance
description: "Efficient and correct database access with Laravel Eloquent: eager loading and preventing lazy loading, selecting only needed columns, chunking and lazy collections for large datasets, cursor pagination, aggregates with withCount and withSum, bulk inserts and upserts, indexes and migrations, transactions and locking, query caching, and detecting N+1 queries with strict mode and debugging tools. Use it when writing or reviewing Eloquent queries and models."
---

# Skill: Eloquent Performance

## Implementation Rules:
- **[MANDATORY]** Enable Eloquent strict mode in non-production environments (`Model::shouldBeStrict(! app()->isProduction())` in a service provider) to throw on lazy loading, silently discarded attributes, and missing attributes, so N+1 queries are found during development and testing.
- **[MANDATORY]** Eager load relationships that will be used (`with()`, `load()`, nested `with('items.product')`), constrain eager loads when only part is needed, and use `withCount`, `withSum`, `withExists` for aggregates instead of loading collections to count them.
- **[PERFORMANCE]** Select only needed columns (`select([...])`, including foreign keys used for relations), and avoid hydrating models when raw values suffice (`pluck`, `value`, `toBase()`).
- **[PERFORMANCE]** Process large datasets in bounded memory: `chunkById()` for updates, `lazyById()` or `cursor()` for streaming reads, and queued jobs for heavy batch work; never `Model::all()` on large tables.
- **[PERFORMANCE]** Paginate every list: `cursorPaginate()` for large or infinite lists (keyset-based), `simplePaginate()` when total counts are not needed, and `paginate()` only when counts are required and affordable.
- **[PATTERN]** Write in bulk where possible: `insert()`/`upsert()` for many rows (bypassing model events deliberately), `update()` queries for mass updates, and `increment()`/`decrement()` for atomic counters.
- **[MANDATORY]** Use transactions for multi-step writes (`DB::transaction`) and pessimistic locking (`lockForUpdate()`) or atomic conditional updates for concurrency-sensitive operations such as stock or balances.
- **[PATTERN]** Define indexes in migrations for columns used in `where`, `orderBy`, and joins, including composite indexes matching common queries, and review slow queries with `EXPLAIN`.
- **[FORBIDDEN]** Queries inside Blade loops or accessors that run per row, `whereRaw` or `DB::raw` with interpolated user input, unbounded `get()` in HTTP requests, and caching Eloquent models containing personal data under shared keys.
- **[PATTERN]** Cache expensive, rarely changing query results with `Cache::remember()` and tagged or keyed invalidation on model events, including tenant or user scope in keys.
- **[PATTERN]** Keep model logic lean: casts (including enum and custom casts), scopes for reusable conditions, and accessors that do not trigger queries.
- **[TESTING]** Detect regressions in tests: assert query counts for critical endpoints (`DB::enableQueryLog()` / `DB::getQueryLog()` or `expectsDatabaseQueryCount` where available), run strict mode in the test suite, and inspect queries with Laravel Telescope or Debugbar locally.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
