---
name: asyncapi-event-contracts
description: "Designing event-driven contracts with AsyncAPI 3 and CloudEvents: channels and operations, message and schema design, event naming and versioning, schema registry compatibility (Avro, Protobuf, JSON Schema), headers for correlation and tracing, and documentation/validation in CI. Use it when defining or reviewing events and messages exchanged through Kafka, RabbitMQ, SNS/SQS, or similar brokers."
---

# Skill: AsyncAPI Event Contracts

## Implementation Rules:
- **[ARCHITECTURE]** Every published event or command stream has a versioned contract: an AsyncAPI 3.0 document (`api/asyncapi.yaml`) describing servers, channels, operations (`send`/`receive`), messages, and schemas, owned by the producing team.
- **[MANDATORY]** Events describe facts in the past tense in the producer's business language (`OrderPlaced`, `PaymentCaptured`); commands are imperative (`ReserveStock`) and are sent to a specific consumer; do not disguise commands as events.
- **[MANDATORY]** Use a standard envelope: CloudEvents attributes (`id`, `source`, `type`, `specversion`, `time`, `subject`, `datacontenttype`, `dataschema`) or equivalent headers, plus `correlationId`/`causationId` and W3C `traceparent` for tracing.
- **[PATTERN]** Event type names are namespaced and versioned (`com.acme.orders.order-placed.v1`); channel/topic names follow a convention (`<domain>.<entity>.<event>` or `<domain>.<entity>.events`) and partition keys are the aggregate id to preserve per-entity ordering.
- **[PATTERN]** Payload design: include the data consumers need to act without calling back (event-carried state transfer) but no internal implementation details; ids, timestamps in RFC 3339 UTC, money as decimal string plus currency, enums as strings with documented handling of unknown values.
- **[MANDATORY]** Schema evolution rules: only backward-compatible changes within a version (add optional fields with defaults, never remove or rename fields or change types); breaking changes create a new event version published in parallel until consumers migrate.
- **[CONFIGURATION]** With a schema registry (Confluent, Apicurio, AWS Glue) set the compatibility mode explicitly (`BACKWARD` or `BACKWARD_TRANSITIVE` for consumers upgrading first, `FULL_TRANSITIVE` for long-lived topics) and register schemas from CI, not from producers at runtime in production.
- **[PATTERN]** Consumers are tolerant readers: ignore unknown fields, handle unknown enum values gracefully, and never depend on field order.
- **[MANDATORY]** Document delivery semantics per channel: ordering guarantees and key, at-least-once delivery (consumers must be idempotent), retention, retry and dead-letter policy, and expected throughput.
- **[SECURITY]** Do not put secrets or unnecessary personal data in events (they are copied, retained, and replayed); reference sensitive data by id or encrypt specific fields; declare broker security schemes (SASL/SCRAM, mTLS, OAuth) in the contract.
- **[CONFIGURATION]** Validate the AsyncAPI document in CI (`asyncapi validate`), lint it with Spectral's AsyncAPI ruleset, generate documentation and, where useful, code/types from it, and check message examples against schemas.
- **[TESTING]** Verify producers and consumers against the contract: schema validation in producer tests, message contract tests (Pact message pacts) between producer and consumers, and compatibility checks against the registry before deploy.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
