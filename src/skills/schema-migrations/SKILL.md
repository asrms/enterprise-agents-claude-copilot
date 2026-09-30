---
name: schema-migrations
description: "Safe, versioned database schema migrations with Flyway, Liquibase, Alembic, EF Core, Prisma, or golang-migrate: forward-only versioned scripts, expand-and-contract for zero-downtime changes, lock-aware DDL, batched backfills, and CI verification. Use it when changing a production database schema."
---

# Skill: Schema Migrations

## Implementation Rules:
- **[MANDATORY]** Every schema change is a versioned migration file committed with the application code and applied by a migration tool (Flyway, Liquibase, Alembic, EF Core Migrations, Prisma Migrate, golang-migrate, Knex); no manual DDL in shared environments, and schema drift is detected, not tolerated.
- **[MANDATORY]** Applied migrations are immutable: never edit a migration that has run in any shared environment; fix forward with a new migration. Checksums (Flyway, Liquibase) must stay valid.
- **[ARCHITECTURE]** Zero-downtime changes use expand-and-contract across several releases: (1) expand with backward-compatible additions (nullable column, new table, new index), (2) deploy code that writes both and reads new, (3) backfill, (4) switch reads, (5) contract by removing the old structure only after no running version uses it.
- **[FORBIDDEN]** Breaking changes in a single step while old application versions are still running: renaming or dropping a column in use, changing a column type in place, adding `NOT NULL` without a default on a large table, or dropping a table that is still read.
- **[PERFORMANCE]** Lock-aware DDL: set `lock_timeout` (and `statement_timeout`) in migrations; create indexes with `CREATE INDEX CONCURRENTLY` (PostgreSQL) or `ONLINE = ON` (SQL Server) or online DDL tools (gh-ost, pt-online-schema-change for MySQL); add constraints as `NOT VALID` then `VALIDATE CONSTRAINT` separately.
- **[PERFORMANCE]** Data backfills run in small batches (by primary key ranges, 1,000-10,000 rows) with commits between batches, are idempotent and resumable, and are kept separate from DDL migrations; large backfills run as jobs, not inside the deploy transaction.
- **[PATTERN]** Migrations are small and single-purpose, named with the version and intent (`V2026_09_29_1200__add_order_public_id.sql`), transactional where the engine supports transactional DDL (PostgreSQL), and explicitly non-transactional where required (`CREATE INDEX CONCURRENTLY`).
- **[PATTERN]** Rollback strategy is decided per change: prefer backward-compatible migrations plus rolling back the application; write down migrations only when they are safe and tested; destructive steps (drops) are delayed until the previous release can no longer be rolled back.
- **[MANDATORY]** Migrations run once per deployment by a dedicated step (pipeline job, Kubernetes Job, init container with leader election), not concurrently by every application instance at startup in multi-replica environments.
- **[SECURITY]** The migration user holds DDL privileges; the application runtime user does not. Migrations never contain secrets or production personal data, and seed data for non-production environments is synthetic.
- **[TESTING]** CI applies all migrations from an empty database and from a copy of the current production schema on the same engine and version (Testcontainers), runs the application tests on top, and lints migrations for dangerous operations (squawk for PostgreSQL, Atlas lint, strong_migrations).
- **[TESTING]** Large or risky migrations are rehearsed on a production-sized dataset to measure duration and lock impact before release.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
