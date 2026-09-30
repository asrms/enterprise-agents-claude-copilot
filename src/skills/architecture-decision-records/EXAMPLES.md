# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. A "decision" with no context, options, or consequences
```markdown
# Use Kafka

We will use Kafka for messaging because it is the industry standard and scalable.
```
**Why it's wrong:**
- No problem statement, no requirements (throughput, ordering, retention), and no alternatives considered.
- "Industry standard" is not a decision driver; the operational cost of running Kafka is not mentioned.
- No status, date, or deciders: nobody knows whether this is a proposal or an agreed decision.

### 2. Rewriting history
```diff
  # ADR-0007: Store documents in PostgreSQL JSONB
- Status: Accepted (2023-02-10)
+ Status: Accepted (2023-02-10, updated 2025-01-20)
- Decision: store documents as JSONB in the orders database.
+ Decision: store documents in MongoDB.
```
**Why it's wrong:**
- The accepted ADR is edited to state the opposite decision, so the reasoning behind the original choice and the reasons for changing it are both lost.

## Best Practice (How to do it right)

### 1. A "decision" with no context, options, or consequences
```markdown
# ADR-0012: Asynchronous integration between Orders and Fulfillment

- Status: Accepted
- Date: 2025-03-04
- Deciders: Orders team, Fulfillment team, platform architect

## Context and problem statement
Orders calls Fulfillment synchronously over HTTP. During peaks (≈ 400 orders/min) Fulfillment
latency (p95 1.8 s) causes checkout timeouts, and a Fulfillment outage blocks all purchases.
We need checkout to succeed independently of Fulfillment availability.

## Decision drivers
- Checkout availability ≥ 99.95% even when Fulfillment is down
- Per-order event ordering; at-least-once delivery with idempotent consumers
- Team experience: both teams already operate RabbitMQ; no one operates Kafka
- Event replay for new consumers is "nice to have", not required

## Considered options
| Option | Pros | Cons |
|---|---|---|
| Keep sync HTTP + retries/circuit breaker | No new infra | Checkout still depends on Fulfillment availability |
| RabbitMQ (quorum queues) + transactional outbox | Known by the teams, meets ordering per routing key | Limited replay |
| Managed Kafka | Replay, high throughput | New operational skills and cost; throughput not needed |

## Decision outcome
Chosen: **RabbitMQ with quorum queues and a transactional outbox in Orders**, because it decouples
checkout from Fulfillment with technology the teams already run; throughput needs are far below its limits.

## Consequences
- Positive: checkout no longer fails when Fulfillment is down; Fulfillment can scale independently.
- Negative: eventual consistency — the "order shipped" state appears with a delay (target < 30 s p99).
- Risks: outbox table growth → retention job and alert on relay lag (fitness function FF-04).
- Revisit if: event replay becomes a requirement or throughput exceeds 5,000 msg/s.

## Links
- C4 container diagram: docs/architecture/containers.md
- Spike: https://git.example.com/spikes/outbox-rabbitmq
```
**Why it's right:**
- The context quantifies the problem, drivers are explicit, and three options are compared against them.
- Negative consequences and revisit conditions are recorded, and the decision links to a fitness function that enforces it.

### 2. Rewriting history
```markdown
# ADR-0007: Store documents in PostgreSQL JSONB
- Status: Superseded by ADR-0021 (2025-01-20)
...(original content unchanged)...

# ADR-0021: Move document storage to a dedicated document database
- Status: Accepted
- Date: 2025-01-20
- Supersedes: ADR-0007

## Context and problem statement
Since ADR-0007 the document volume grew from 2 GB to 1.4 TB; JSONB GIN indexes now account for 60%
of the orders database size and vacuum time...
```
**Why it's right:**
- The old ADR keeps its original reasoning and points to its successor; the new ADR explains what changed in the context.
