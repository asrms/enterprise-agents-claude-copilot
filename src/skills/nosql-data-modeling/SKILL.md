---
name: nosql-data-modeling
description: "Access-pattern-driven data modeling for NoSQL stores: MongoDB documents (embed vs reference), DynamoDB single-table design with partition and sort keys, Redis data structures and key design, Cassandra query-first tables, and choosing polyglot persistence. Use it when designing or reviewing non-relational data models."
---

# Skill: NoSQL Data Modeling

## Implementation Rules:
- **[ARCHITECTURE]** Choose NoSQL for a concrete reason (massive scale-out writes, flexible document shape, key-value latency, wide-column time series, graph traversal); for transactional data with rich relationships and ad hoc queries, a relational database remains the default. Record the choice in an ADR.
- **[MANDATORY]** Model from the access patterns: list every query (entity, filter, sort, cardinality, frequency, latency target) before designing collections, tables, or keys, because NoSQL stores serve well only the queries they were designed for.
- **[PATTERN]** MongoDB: embed data that is read together and owned by the parent with bounded size (order lines in an order); reference data that is shared, large, or unbounded (customers, comments); never let arrays grow without limit (16 MB document cap, update amplification).
- **[PATTERN]** MongoDB: enforce structure with `$jsonSchema` validators, create indexes that follow the ESR rule (Equality, Sort, Range), use multi-document transactions sparingly, and set explicit read/write concerns (`w: "majority"`) for data that must not be lost.
- **[PATTERN]** DynamoDB: design partition keys with high cardinality and even traffic, use generic `PK`/`SK` attributes and item collections for single-table design when access patterns are stable, add GSIs for alternate access patterns, and use conditional writes for invariants and optimistic locking.
- **[FORBIDDEN]** `Scan` operations on DynamoDB or collection scans on MongoDB in request paths, hot partitions caused by low-cardinality keys (status, date only), and unbounded item collections in a single partition.
- **[PATTERN]** Redis: use the right structure (hash for objects, sorted set for leaderboards and time-ordered data, stream for event logs, set for membership), namespace keys (`app:entity:{id}:field`), set TTLs on cache and session keys, and keep values small; use hash tags (`{user:42}`) to colocate keys in Redis Cluster.
- **[PATTERN]** Cassandra/ScyllaDB: one table per query, partition key sized to keep partitions under ~100 MB, clustering columns for sort order, time-bucketed partitions for time series, and denormalization accepted as the cost of fast reads.
- **[ARCHITECTURE]** Consistency is explicit: document the consistency level of every read and write (eventual vs strong, `LOCAL_QUORUM`, DynamoDB strongly consistent reads), how duplicated or denormalized data is kept in sync (streams, change data capture, outbox), and how conflicts are resolved.
- **[PATTERN]** Schema evolution is planned: every document or item carries a `schemaVersion`, readers tolerate old versions, and migrations are applied lazily on read/write or by background jobs.
- **[SECURITY]** Enable authentication, TLS, and encryption at rest; never expose MongoDB, Redis, or Elasticsearch to the internet; grant least-privilege roles per service; prevent NoSQL injection by never passing raw user objects as query filters (`{ "$ne": null }`).
- **[TESTING]** Integration tests run against the real engine (Testcontainers, DynamoDB Local, LocalStack) and cover every documented access pattern, including index usage (`explain()`) and conditional write failures.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
