---
name: node-async-performance
description: "Node.js runtime performance and async correctness: never blocking the event loop, bounded concurrency, worker threads for CPU work, streams and backpressure, timeouts and cancellation with AbortSignal, unhandled rejections, memory leaks, and profiling. Use it when writing or reviewing performance-sensitive Node.js code."
---

# Skill: Node.js Async and Performance

## Implementation Rules:
- **[MANDATORY]** Never block the event loop in request paths: no synchronous I/O (`fs.readFileSync`, `execSync`, `crypto.pbkdf2Sync`), no large `JSON.parse`/`JSON.stringify` of unbounded payloads, no CPU-heavy loops; move CPU work to `worker_threads` (Piscina) or separate services.
- **[MANDATORY]** Every promise is awaited or explicitly handled: no floating promises (enforced by `@typescript-eslint/no-floating-promises`), `process.on('unhandledRejection')` logs and exits so the orchestrator restarts a clean process.
- **[PERFORMANCE]** Run independent I/O concurrently with `Promise.all`/`Promise.allSettled`, but bound concurrency for large or external workloads (`p-limit`, batching) to protect downstream services and memory; never `Promise.all` over an unbounded array of requests.
- **[FORBIDDEN]** `await` inside loops for independent operations, `forEach` with async callbacks (errors and completion are lost), and mixing callbacks and promises in the same API.
- **[PERFORMANCE]** Stream large data (files, exports, uploads, database cursors) with `stream.pipeline` or async iterators to respect backpressure and bounded memory; never buffer whole files or result sets in memory.
- **[MANDATORY]** Every outbound call has a timeout and supports cancellation: `fetch(url, { signal: AbortSignal.timeout(2000) })`, propagate `AbortSignal` from the incoming request so work stops when the client disconnects.
- **[PATTERN]** Resilience for dependencies: retries only for idempotent operations with exponential backoff and jitter, circuit breakers (`opossum`) for failing dependencies, and HTTP keep-alive agents (undici `Agent`) with bounded connections.
- **[PERFORMANCE]** Cache deliberately: in-process LRU caches with size limits and TTL (`lru-cache`), shared caches in Redis with stampede protection; never unbounded `Map` caches, which are a common memory leak.
- **[PERFORMANCE]** Avoid memory leaks: remove event listeners, clear intervals, bound queues, and avoid closures retaining large objects; monitor heap usage and event loop delay (`perf_hooks.monitorEventLoopDelay`) in production metrics.
- **[PATTERN]** Size the runtime for containers: set `--max-old-space-size` below the container memory limit, run one process per container and scale horizontally rather than using `cluster` inside containers, and use the current LTS Node.js version.
- **[TESTING]** Measure before optimizing: profile with `--cpu-prof`, Clinic.js (Doctor, Flame, Bubbleprof) or 0x, take heap snapshots for leaks, and load-test with autocannon or k6 with a stated latency and throughput target.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
