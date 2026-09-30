---
name: prisma-drizzle-data-access
description: "Type-safe data access in Node.js/TypeScript with Prisma, Drizzle ORM, or Kysely: repository boundaries, explicit field selection, transactions, N+1 avoidance, connection pooling in serverless and containers, safe raw SQL, and migrations workflow. Use it when writing or reviewing database code in TypeScript backends."
---

# Skill: Prisma and Drizzle Data Access

## Implementation Rules:
- **[ARCHITECTURE]** Encapsulate data access behind repositories or query modules per aggregate; application services do not build ORM queries directly, and ORM types do not leak into API responses.
- **[MANDATORY]** Select only the fields you need (`select` in Prisma, explicit column lists in Drizzle/Kysely); never return full rows containing secrets (password hashes, tokens) or internal columns to callers.
- **[MANDATORY]** Raw SQL is always parameterized: Prisma tagged templates ``prisma.$queryRaw`... ${value}` `` (never `$queryRawUnsafe` with interpolated input), Drizzle ``sql`... ${value}` ``, Kysely query builder; dynamic identifiers (sort columns) come from an allow-list.
- **[MANDATORY]** Multi-step writes that must be atomic use transactions (`prisma.$transaction(async (tx) => ...)`, `db.transaction(async (tx) => ...)`), kept short, with no external HTTP calls inside; set isolation level explicitly when correctness depends on it and retry on serialization failures.
- **[PERFORMANCE]** Avoid N+1: load relations with `include`/`select` nested queries or the Drizzle relational query API, batch lookups with `where: { id: { in: ids } }`, and use DataLoader in GraphQL resolvers.
- **[PERFORMANCE]** Paginate every list (cursor-based for large tables), and use bulk operations (`createMany`, `insert().values([...])`, `onConflictDoUpdate`) instead of loops of single-row writes.
- **[PATTERN]** One client instance per process (a module-level singleton), with the pool sized to the database capacity divided by instances; in serverless use a pooler (PgBouncer, Prisma Accelerate, Neon/Supabase poolers, RDS Proxy) and small pools.
- **[PATTERN]** Optimistic concurrency with a `version` column and conditional updates (`updateMany({ where: { id, version } })` checking the affected count), or unique constraints for invariants, instead of read-then-write races.
- **[MANDATORY]** Schema changes go through the tool's migration workflow (`prisma migrate dev` to create, `prisma migrate deploy` in the pipeline; `drizzle-kit generate` plus a migrator) with generated SQL reviewed and committed; `prisma db push` and `drizzle-kit push` are for prototypes only.
- **[PATTERN]** Map database errors to domain errors in the repository (unique violation `P2002`/`23505` to a conflict error, not found to a typed result) so upper layers do not depend on ORM error codes.
- **[SECURITY]** Connection strings come from secrets, require TLS (`sslmode=require` or stricter), and use a least-privilege runtime role; query logging never prints parameter values containing personal data in production.
- **[TESTING]** Repository tests run against the real engine in containers (Testcontainers) with migrations applied, isolated per test by transaction rollback or truncation; ORMs are not mocked in repository tests.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
