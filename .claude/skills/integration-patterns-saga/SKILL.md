---
name: integration-patterns-saga
description: "Integration and distributed transaction patterns: synchronous vs asynchronous communication, transactional outbox, idempotent consumers, sagas (orchestration vs choreography) with compensations, event-carried state transfer, CQRS, retries/timeouts/circuit breakers, and dead-letter handling. Use it when designing interactions between services or modules."
---

# Skill: Integration Patterns and Sagas

## Implementation Rules:
- **[ARCHITECTURE]** Choose the style per interaction: synchronous request/response (HTTP/gRPC) when the caller needs an immediate answer to continue; asynchronous messaging (events/commands over a broker) for workflows, notifications, and propagation of state changes where temporal decoupling improves availability.
- **[FORBIDDEN]** Distributed transactions with two-phase commit across services, and "dual writes" (write to the database and publish to the broker in the same code path without atomicity): a crash between the two operations leaves the system inconsistent.
- **[MANDATORY]** Publish events reliably with the Transactional Outbox: the state change and the outgoing message are written in the same local transaction; a relay (polling or change data capture such as Debezium) publishes the outbox rows and marks them as sent.
- **[MANDATORY]** Consumers are idempotent because brokers deliver at least once: deduplicate by message id in the same transaction as the side effect, or make the operation naturally idempotent (upsert with version, conditional updates).
- **[PATTERN]** Sagas for business transactions spanning services: a sequence of local transactions, each with a compensating action (cancel reservation, refund payment) executed in reverse order on failure; compensations are themselves idempotent and retryable.
- **[PATTERN]** Orchestration vs choreography: use an orchestrator (a saga coordinator/state machine, or a workflow engine such as Temporal or Camunda) when the flow has many steps, branches, or timeouts and needs visibility; use choreography (services react to each other's events) for short flows with few participants.
- **[MANDATORY]** Every saga has explicit states persisted by the coordinator, timeouts for each step, and a terminal failure state with alerting when compensation itself fails (manual intervention runbook).
- **[PATTERN]** Semantic locks and pending states: resources involved in an in-progress saga are marked (`PENDING_PAYMENT`) so other operations can see and respect the intermediate state.
- **[PATTERN]** Event design: events are named in the past tense (`OrderPlaced`), carry an id, type, version, timestamp, correlation/causation ids, and either the minimal data (notification) or the data consumers need (event-carried state transfer) to avoid chatty callbacks.
- **[PATTERN]** Ordering: guarantee order per aggregate using the aggregate id as partition/routing key; do not rely on global ordering; consumers handle out-of-order events using versions/sequence numbers.
- **[MANDATORY]** Resilience for synchronous calls: timeouts on every call, retries only for idempotent/transient failures with exponential backoff and jitter, circuit breakers, bulkheads, and fallbacks; an overall deadline propagated across hops.
- **[PATTERN]** Poison messages go to a dead-letter queue after a bounded number of retries, with the error and original headers preserved, monitoring on DLQ size, and a documented replay procedure.
- **[PATTERN]** CQRS and read models: when queries need data from several contexts, build local read models from events instead of synchronous fan-out calls; accept and communicate eventual consistency in the UI.
- **[SECURITY]** Messages are authenticated and authorized too: broker credentials per service with least-privilege topic/queue permissions, TLS in transit, no sensitive data in events unless necessary (encrypt or reference it).
- **[TESTING]** Test failure paths explicitly: duplicate delivery, out-of-order events, consumer crash after side effect but before ack, compensation paths, and timeouts; use contract tests for message schemas.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
