---
name: strangler-fig-migration
description: "Incrementally replacing legacy systems with the strangler fig pattern: routing facades and proxies, identifying seams and thin slices of functionality, anti-corruption layers, parallel run and output comparison, data synchronization and migration strategies (change data capture, dual writes avoided, backfills), feature toggles for cutover, and decommissioning legacy parts. Use it when modernizing or replacing a legacy application without a big-bang rewrite."
---

# Skill: Strangler Fig Migration

## Implementation Rules:
- **[ARCHITECTURE]** Replace legacy systems incrementally: put a routing layer (API gateway, reverse proxy, or facade in the application) in front of the legacy system, move one capability at a time to the new implementation, and route traffic per capability until the legacy part can be removed.
- **[FORBIDDEN]** Big-bang rewrites that freeze feature work for months and cut over all at once, dual maintenance without a plan to retire the legacy code, and new systems that silently change business behavior during migration.
- **[PATTERN]** Choose slices by value and risk: start with a capability that is valuable, relatively isolated, and low risk to learn the migration path, then tackle core capabilities; use event storming or dependency analysis to find seams.
- **[MANDATORY]** Protect the new model with an anti-corruption layer: translate legacy data structures, codes, and protocols into the new domain model at the boundary, so legacy concepts do not leak into new code.
- **[PATTERN]** Migrate data deliberately: the new system owns its data store; synchronize from legacy with change data capture (Debezium, database log-based replication) or events during the transition, run idempotent backfills, and define which system is the source of truth per entity at every stage.
- **[FORBIDDEN]** Uncoordinated dual writes from application code to both old and new databases (they diverge on partial failures); use CDC, an outbox, or a single writer with replication instead.
- **[PATTERN]** Verify equivalence before cutover: parallel runs or shadow traffic that send the same requests to both implementations and compare outputs (tools such as Diffy-style comparators or custom comparison jobs), with discrepancies triaged as bugs or accepted differences.
- **[MANDATORY]** Cut over gradually with feature toggles or routing weights (internal users, a tenant subset, a percentage of traffic), with monitoring and a fast rollback to the legacy route until confidence is established.
- **[PATTERN]** Track the migration visibly: a capability map showing legacy, in progress, and migrated parts, and metrics such as percentage of traffic on the new system and legacy code removed.
- **[MANDATORY]** Decommission promptly: once a capability is fully migrated and stable, remove its legacy code, data synchronization, and routes, and archive legacy data according to retention rules.
- **[TESTING]** Build characterization tests around legacy behavior before migrating each slice, and reuse them as acceptance tests for the new implementation.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
