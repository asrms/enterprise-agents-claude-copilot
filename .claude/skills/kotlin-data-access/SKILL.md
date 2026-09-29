---
name: kotlin-data-access
description: "Database access from Kotlin services: choosing between Spring Data (JPA or R2DBC), Exposed, jOOQ, and SQLDelight, type-safe queries, transactions with coroutines, connection pools (HikariCP) and R2DBC pools, avoiding N+1 queries, mapping rows to immutable data classes, migrations with Flyway or Liquibase, and testing with Testcontainers. Use it when writing or reviewing persistence code in Kotlin backends."
---

# Skill: Kotlin Data Access

## Implementation Rules:
- **[ARCHITECTURE]** Choose the persistence approach deliberately: jOOQ or Exposed DSL for SQL-first, type-safe queries; Spring Data JPA when an ORM with rich mapping is justified; Spring Data R2DBC or the jOOQ/Exposed R2DBC options for fully non-blocking stacks; SQLDelight for multiplatform or SQL-defined schemas. Record the choice.
- **[MANDATORY]** Keep persistence behind repository interfaces owned by the domain or application layer; map database rows to immutable domain data classes at the boundary and never expose table objects or entities to API layers.
- **[MANDATORY]** Queries are type-safe or parameterized: generated jOOQ classes or Exposed table objects, never string-concatenated SQL with user input; dynamic sorting uses allow-listed columns.
- **[PATTERN]** Manage transactions explicitly and correctly with coroutines: `newSuspendedTransaction` for Exposed, `TransactionalOperator.executeAndAwait` for reactive Spring, or `@Transactional` on suspend functions supported by Spring's coroutine integration; never share a blocking JDBC transaction across coroutine threads.
- **[PERFORMANCE]** Run blocking JDBC on a bounded dispatcher (`Dispatchers.IO.limitedParallelism(poolSize)`) matching the HikariCP pool size, or use virtual threads; size connection pools to the database's capacity divided by instances.
- **[PERFORMANCE]** Avoid N+1 queries: fetch related data with joins or batched `IN` queries, use keyset pagination for large lists, and select only needed columns.
- **[PATTERN]** Use optimistic locking (version columns with conditional updates) or database constraints to protect invariants under concurrency, and map constraint violations to domain errors in repositories.
- **[MANDATORY]** Manage schema changes with Flyway or Liquibase migrations committed with the code and applied by a deployment step; ORM auto-DDL (`ddl-auto=update`, Exposed `SchemaUtils.create` in production) is not used outside tests.
- **[FORBIDDEN]** Blocking database calls on `Dispatchers.Default` or event-loop threads, transactions spanning remote HTTP calls, lazy-loading JPA associations outside transactions, and in-memory databases (H2) as substitutes for the production engine in integration tests.
- **[SECURITY]** Database credentials come from a secret manager or IAM authentication, connections use TLS, and the runtime user has only DML privileges.
- **[TESTING]** Test repositories against the real engine with Testcontainers and migrations applied, covering constraint violations, concurrency conflicts, and pagination, with data isolated per test.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
