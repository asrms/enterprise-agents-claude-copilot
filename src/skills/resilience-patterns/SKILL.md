---
name: resilience-patterns
description: "Resilience patterns for distributed systems in any language: timeouts and deadlines, retries with exponential backoff and jitter, retry budgets, idempotency keys, circuit breakers, bulkheads, rate limiting and load shedding, graceful degradation and fallbacks, backpressure, health checks, and multi-zone or multi-region redundancy. Use it when designing or reviewing how services handle failures of dependencies and overload."
---

# Skill: Resilience Patterns

## Implementation Rules:
- **[MANDATORY]** Every remote call has a timeout shorter than the caller's own deadline, and deadlines propagate across service hops (gRPC deadlines, request context cancellation) so work stops when the client is gone.
- **[MANDATORY]** Retry only idempotent or idempotency-keyed operations, only on transient errors (timeouts, connection errors, 429, 503), with exponential backoff, full jitter, a small maximum attempt count, and respect for `Retry-After`; retry at one layer only to avoid retry storms.
- **[PATTERN]** Protect against retry amplification with retry budgets (for example, retries limited to 10% of requests) and circuit breakers that open on sustained failure rates, fail fast while open, and probe with half-open requests.
- **[PATTERN]** Make writes idempotent: clients send idempotency keys, servers store the result per key for a defined window, and message consumers deduplicate by message id.
- **[PATTERN]** Isolate resources with bulkheads: separate connection pools, thread pools, or concurrency limits per dependency and per traffic class, so one slow dependency cannot exhaust capacity for everything else.
- **[PATTERN]** Degrade gracefully: define fallbacks per dependency (cached or stale data, default values, hiding non-essential features, queuing work for later) and communicate degraded mode to users where it matters.
- **[PERFORMANCE]** Protect the service from overload: rate limits per client or tenant, admission control and load shedding (reject early with 429/503 when queues exceed limits, prioritizing critical traffic), and bounded queues with backpressure instead of unbounded buffering.
- **[FORBIDDEN]** Infinite or immediate retries, retries of non-idempotent operations without keys, default library timeouts that are unbounded or minutes long, and health checks that call downstream dependencies for liveness (causing cascading restarts).
- **[ARCHITECTURE]** Remove single points of failure: at least N+1 instances across availability zones, stateless services behind load balancers, replicated data stores with tested failover, and multi-region designs only where the business requires the extra complexity.
- **[PATTERN]** Use asynchronous messaging to decouple non-interactive work (queues, event streams with dead-letter queues and replay), so temporary unavailability of a consumer does not fail user requests.
- **[MANDATORY]** Instrument resilience mechanisms: metrics for timeouts, retries, circuit breaker state, shed requests, and fallback usage, so their behavior is visible during incidents.
- **[TESTING]** Test failure behavior explicitly with fault injection in integration tests (latency, errors, connection resets via Toxiproxy or WireMock) and verify timeouts, retries, circuit breaking, and fallbacks before relying on them in production.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
