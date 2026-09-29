---
name: ef-core-performance
description: "Entity Framework Core correctness and performance: DbContext lifetime, no-tracking and projection queries, avoiding N+1 and cartesian explosion, split queries, compiled queries, bulk ExecuteUpdate/ExecuteDelete, concurrency tokens, migrations bundles, and SQL logging. Use it when writing or reviewing EF Core data access."
---

# Skill: EF Core Performance

## Implementation Rules:
- **[MANDATORY]** `DbContext` is scoped per unit of work (per request) via `AddDbContext`/`AddDbContextPool`; never a singleton, never shared across threads, and never used concurrently (no parallel `await`s on the same context).
- **[PERFORMANCE]** Read-only queries use `AsNoTracking()` (or `QueryTrackingBehavior.NoTracking` by default for query services) and project with `Select` into DTOs, loading only the needed columns instead of whole entity graphs.
- **[FORBIDDEN]** Lazy-loading proxies in web applications (hidden N+1 queries), client-side evaluation of filters, calling `ToList()` before `Where`/`Skip`/`Take`, and synchronous APIs (`SaveChanges`, `ToList`) in async request paths.
- **[PERFORMANCE]** Avoid N+1 by eager loading (`Include`) or projection; avoid cartesian explosion when including multiple collections by using `AsSplitQuery()` or separate queries.
- **[PERFORMANCE]** Paginate with keyset pagination on large tables (`Where(o => o.CreatedAt < cursor).OrderByDescending(...).Take(50)`) and always apply `OrderBy` before `Skip`/`Take`.
- **[PERFORMANCE]** Bulk changes use `ExecuteUpdateAsync`/`ExecuteDeleteAsync` instead of loading entities to modify them one by one; large inserts use batching (`AddRange`) or a bulk library for very large volumes.
- **[PATTERN]** Hot queries executed very frequently can use compiled queries (`EF.CompileAsyncQuery`); raw SQL uses `FromSql`/`SqlQuery` with interpolated parameters (parameterized automatically), never `FromSqlRaw` with concatenated input.
- **[PATTERN]** Concurrency is handled with concurrency tokens (`[Timestamp]`/`rowversion` in SQL Server, `xmin` or a version column in PostgreSQL via `IsConcurrencyToken()`), catching `DbUpdateConcurrencyException` and mapping it to a 409 or retry.
- **[PATTERN]** Configure the model explicitly with `IEntityTypeConfiguration<T>`: column types and lengths, precision for decimals (`HasPrecision(19, 4)`), indexes, value conversions for value objects, owned types, and query filters for soft delete or multi-tenancy.
- **[MANDATORY]** Schema changes are EF Core migrations committed to source control, reviewed as generated SQL (`dotnet ef migrations script --idempotent`), and applied by a dedicated deployment step or migration bundle (`dotnet ef migrations bundle`), not by `Database.Migrate()` at startup of every replica.
- **[PERFORMANCE]** Enable connection resiliency (`EnableRetryOnFailure`) for cloud databases, keep transactions short, and log generated SQL and slow queries in development (`LogTo`, `EnableSensitiveDataLogging` only locally) to review plans.
- **[TESTING]** Test data access against the real provider (Testcontainers for SQL Server/PostgreSQL), not the EF Core InMemory provider, which does not enforce constraints or translate SQL; assert the number of queries for critical endpoints with interceptors.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
