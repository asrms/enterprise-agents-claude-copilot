---
name: database-release-coordination
description: "Coordinating database changes with application releases: compatibility matrix between schema and code versions, expand-migrate-contract sequencing across releases, running migrations as a separate pipeline step, data backfills, multi-service and shared-database coordination, release checklists, and rollback planning for schema changes. Use it when a release includes database changes or when planning the order of deployments."
---

# Skill: Database Release Coordination

## Implementation Rules:
- **[MANDATORY]** Every schema change is backward compatible with the application version currently in production and forward compatible with the version being deployed (N and N+1 must both run against the new schema), so rolling deployments and application rollbacks remain possible.
- **[ARCHITECTURE]** Sequence risky changes as expand, migrate, contract across separate releases: add new structures first, deploy code that writes to both and reads the new one, backfill, switch reads, and only then remove the old structures in a later release.
- **[MANDATORY]** Run migrations as a dedicated, observable pipeline step before the application rollout (a job or deployment stage with its own logs and timeout), not implicitly at application startup across many replicas.
- **[PATTERN]** Keep a release plan for changes spanning several releases: a short document or ticket listing each step, the release in which it ships, the verification query, and the condition to proceed (for example "backfill complete and no reads of `mail` for 7 days").
- **[PATTERN]** Separate large data backfills from schema migrations: run them as resumable, idempotent, batched jobs with progress metrics, throttling, and the ability to pause during peak load.
- **[PATTERN]** For databases shared by multiple services, publish the change schedule to every consuming team, prefer views or APIs as the contract, and never drop or rename columns until all consumers have been confirmed migrated.
- **[FORBIDDEN]** Destructive changes (drop, rename, type narrowing) in the same release that stops using the structure, manual DDL in production outside the pipeline, and coupling a release to a migration that cannot be reversed without a restore.
- **[MANDATORY]** Before destructive steps, take and verify a backup or snapshot (or confirm point-in-time recovery coverage), and define explicitly whether rollback means reverting code, running a reverse migration, or restoring data.
- **[PATTERN]** Gate the release on migration verification: migration applied on a production-like copy with realistic data volume, duration and lock impact measured, and post-migration checks (row counts, constraint validation, application smoke tests).
- **[SECURITY]** Migration credentials are separate from runtime credentials, used only by the migration step, and access to production data during backfills follows least privilege and is audited.
- **[TESTING]** CI runs the new application version against both the old and new schema (and the old version against the new schema) to prove compatibility, and migration scripts are tested from the previous released version.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
