---
name: rust-async-tokio
description: "Asynchronous Rust with Tokio: runtime configuration, never blocking the executor (spawn_blocking, async I/O), structured task management with JoinSet and cancellation tokens, bounded concurrency with semaphores and buffer_unordered, timeouts, select! pitfalls and cancellation safety, channels (mpsc, oneshot, broadcast, watch), async-aware locks, graceful shutdown, and tracing. Use it when writing or reviewing async Rust code."
---

# Skill: Async Rust with Tokio

## Implementation Rules:
- **[MANDATORY]** Never block the async executor: use async APIs for I/O (tokio fs/net, async database drivers, reqwest), move CPU-heavy or blocking work to `tokio::task::spawn_blocking` or a dedicated thread pool (rayon), and avoid `std::thread::sleep` and blocking mutexes held across heavy work.
- **[MANDATORY]** Bound every external operation with a timeout (`tokio::time::timeout`, client-level timeouts) and bound concurrency (`Semaphore`, `futures::stream::iter(..).buffer_unordered(n)`), so load spikes and slow dependencies cannot exhaust resources.
- **[PATTERN]** Manage task lifetimes explicitly: use `JoinSet` or keep `JoinHandle`s for spawned tasks, propagate cancellation with `tokio_util::sync::CancellationToken`, and handle task panics and errors when joining; no fire-and-forget `tokio::spawn` in services.
- **[PATTERN]** Understand cancellation safety in `tokio::select!`: branches that are dropped mid-operation must be cancellation safe (for example `mpsc::Receiver::recv` is, many read-into-buffer patterns are not); pin long-lived futures outside the loop when needed.
- **[PATTERN]** Choose the right channel: `mpsc` (bounded) for work queues with backpressure, `oneshot` for request-response, `broadcast` for fan-out events, `watch` for latest-value state such as configuration or shutdown signals.
- **[PATTERN]** Use `std::sync::Mutex` for short, non-async critical sections (it is faster) and `tokio::sync::Mutex`/`RwLock` only when the lock must be held across `.await`; never hold any lock across an `.await` unless using an async lock deliberately.
- **[FORBIDDEN]** Unbounded channels for untrusted or high-volume producers, `block_on` inside async contexts, holding `std::sync::MutexGuard` across `.await`, and spawning a task per item of an unbounded stream without limits.
- **[CONFIGURATION]** Configure the runtime explicitly for services (`#[tokio::main(flavor = "multi_thread")]` or a `Builder` with worker thread count matching CPU limits in containers) and use the current-thread runtime for small CLIs and tests.
- **[PATTERN]** Implement graceful shutdown: listen for `ctrl_c` and SIGTERM, trigger a cancellation token or `watch` channel, stop accepting new work, let in-flight tasks finish within a deadline, then flush telemetry.
- **[PATTERN]** Instrument with `tracing` (spans per request and task, `#[instrument]` with skipped sensitive fields) and consider `tokio-console` in development to detect stuck or busy tasks.
- **[TESTING]** Test async code with `#[tokio::test]`, use `tokio::time::pause()` and `advance()` for deterministic time, and test cancellation and timeout paths explicitly.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
