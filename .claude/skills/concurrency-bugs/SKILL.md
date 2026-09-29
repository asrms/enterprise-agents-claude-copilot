---
name: concurrency-bugs
description: "Diagnosing and fixing concurrency defects in any language: race conditions, lost updates, deadlocks and livelocks, thread and connection pool starvation, visibility and ordering problems, non-atomic check-then-act, async and event-loop pitfalls, distributed races with retries and duplicate messages, and tools such as thread dumps, race detectors, stress testing, and deterministic simulation. Use it when behavior is intermittent, order-dependent, or appears only under load."
---

# Skill: Concurrency Bugs

## Implementation Rules:
- **[MANDATORY]** Suspect concurrency when failures are intermittent, load-dependent, or order-dependent; gather evidence (thread dumps, traces with timing, logs with thread or task ids) rather than adding sleeps.
- **[PATTERN]** Recognize the classic patterns: check-then-act and read-modify-write without atomicity (lost updates, double spending), unsafe publication or visibility issues, iterator modification during iteration, lazy initialization races, and shared mutable state in singletons or static fields.
- **[PATTERN]** Diagnose hangs with thread or task dumps taken several times a few seconds apart (`jstack` or `jcmd Thread.print`, `dotnet-dump`, Go goroutine dumps via pprof, `py-spy dump`, Node.js diagnostics) to find deadlocks (circular lock waits), blocked pools, and threads waiting on I/O.
- **[MANDATORY]** Use race detection tools where available: Go `-race`, ThreadSanitizer for C, C++, and Rust, Java's jcstress for low-level concurrency, and database isolation level testing for data races.
- **[PATTERN]** Fix with the simplest correct mechanism: immutability and confinement first, then atomic operations or concurrent data structures, then locks with a consistent global ordering and minimal scope; in databases, use atomic conditional updates, unique constraints, optimistic locking with versions, or appropriate isolation levels.
- **[PATTERN]** Treat distributed systems as concurrent: duplicate and reordered messages, retries after timeouts, and concurrent writers across instances require idempotency keys, conditional writes, and sequence or version checks instead of in-process locks.
- **[PATTERN]** Watch for starvation: blocking calls in async runtimes or event loops, thread pools exhausted by blocking I/O, connection pools smaller than concurrency, and unbounded queues; measure pool usage and wait times.
- **[FORBIDDEN]** Fixing races with `sleep`, adding `synchronized`/global locks around everything without understanding the invariant, catching and ignoring concurrent modification exceptions, and assuming a single instance in horizontally scaled services.
- **[PATTERN]** Reproduce with stress: run the scenario concurrently many times, increase parallelism, randomize scheduling (for example with delays injected in tests), and use deterministic simulation or model checking for critical protocols.
- **[MANDATORY]** Document the invariant that the fix protects (for example "stock never goes below zero") and enforce it at the source of truth (database constraint or atomic operation) where possible.
- **[TESTING]** Add concurrency regression tests that run the conflicting operations in parallel many times and assert the invariant, and keep race detectors enabled in CI test runs.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
