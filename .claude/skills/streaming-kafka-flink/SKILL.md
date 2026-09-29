---
name: streaming-kafka-flink
description: "Streaming data pipelines with Apache Kafka and Apache Flink: topic and partition design, keys and ordering, idempotent and transactional producers, consumer offset management, schema registry compatibility, event time and watermarks, checkpointing and exactly-once sinks, state TTL, late data, dead-letter topics, and streaming tests. Use it when building or reviewing Kafka producers and consumers or Flink jobs."
---

# Skill: Streaming with Kafka and Flink

## Implementation Rules:
- **[ARCHITECTURE]** Design topics per event type with a key that defines ordering (for example `order_id`), a partition count sized for peak throughput and consumer parallelism, `replication.factor=3`, and `min.insync.replicas=2`; retention or compaction (`cleanup.policy=compact`) is chosen from the replay requirement.
- **[MANDATORY]** Producers use `acks=all` and `enable.idempotence=true`; exactly-once pipelines use transactions (`transactional.id`) and consumers read with `isolation.level=read_committed`.
- **[MANDATORY]** Consumers disable auto-commit (`enable.auto.commit=false`) and commit offsets only after the side effect is durable; processing is idempotent (upsert by key or deduplication by event id) because delivery is at-least-once unless the whole path is transactional.
- **[PATTERN]** Events are serialized with Avro or Protobuf through a schema registry with `BACKWARD` (or `FULL`) compatibility; every event carries an event id, an event timestamp, and a schema version, and breaking changes go to a new topic.
- **[PATTERN]** Flink jobs use event time: `WatermarkStrategy.forBoundedOutOfOrderness(...)` with a timestamp assigner and `withIdleness(...)` for idle partitions, allowed lateness where needed, and late records routed to a side output instead of being dropped silently.
- **[MANDATORY]** Enable checkpointing (`env.enableCheckpointing(interval, CheckpointingMode.EXACTLY_ONCE)`) to durable storage, assign a stable `uid()` to every stateful operator so savepoints survive upgrades, and deploy changes with stop-with-savepoint and restore.
- **[PATTERN]** Exactly-once Kafka output uses `KafkaSink` with `DeliveryGuarantee.EXACTLY_ONCE`, a unique `setTransactionalIdPrefix`, and `transaction.timeout.ms` greater than the checkpoint interval and not above the broker's `transaction.max.timeout.ms`.
- **[PERFORMANCE]** Bound state: keyed state has a `StateTtlConfig`, windows are finite, large state uses the RocksDB state backend with incremental checkpoints, and backpressure, checkpoint duration, and consumer lag are monitored and alerted.
- **[PATTERN]** Poison messages go to a dead-letter topic with the original payload, error, and source offset, after bounded retries; the main stream never stops on a single bad record and never skips it silently.
- **[FORBIDDEN]** Processing-time windows for business metrics, unkeyed global state, random or null keys when ordering matters, `auto.offset.reset=latest` on pipelines that must not lose data, and operators without `uid()` in stateful jobs.
- **[SECURITY]** Clients connect with TLS and SASL (SCRAM or OAUTHBEARER) or mTLS, topics are protected by ACLs per service principal, and credentials come from a secret manager; payloads with personal data are minimized or encrypted at field level.
- **[TESTING]** Test Flink operators with the test harnesses or a `MiniCluster`, Kafka Streams with `TopologyTestDriver`, and end-to-end paths with Testcontainers Kafka, covering out-of-order, late, duplicate, and malformed events.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
