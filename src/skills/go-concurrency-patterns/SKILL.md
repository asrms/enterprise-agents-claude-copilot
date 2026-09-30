---
name: go-concurrency-patterns
description: "Safe Go concurrency: context propagation and cancellation, goroutine lifecycle ownership, errgroup with limits, worker pools, channel ownership and closing rules, select with timeouts, sync primitives, avoiding goroutine leaks and data races, and graceful shutdown. Use it when writing or reviewing concurrent Go code."
---

# Skill: Go Concurrency Patterns

## Implementation Rules:
- **[MANDATORY]** Every function that does I/O or may block takes `ctx context.Context` as its first parameter and respects cancellation; contexts are never stored in structs, and `context.Background()` is used only in `main`, tests, and top-level initialization.
- **[MANDATORY]** Every goroutine has an owner that knows how it stops: it exits when its context is cancelled or its input channel is closed, and the owner waits for it (`sync.WaitGroup`, `errgroup.Group`); no fire-and-forget goroutines in servers.
- **[PATTERN]** Use `golang.org/x/sync/errgroup` with `errgroup.WithContext` for groups of tasks that should fail together, and `g.SetLimit(n)` to bound concurrency; collect results into pre-sized slices by index or through a channel owned by the group.
- **[PATTERN]** Channel ownership: the goroutine that creates and sends on a channel is the only one that closes it; receivers never close channels; use buffered channels only with a reason (known bounded producer, semaphore).
- **[MANDATORY]** Every blocking channel send or receive in long-lived code sits inside a `select` with `<-ctx.Done()`, so goroutines cannot leak when the consumer goes away.
- **[PATTERN]** Protect shared state with the simplest correct tool: confine data to one goroutine, or use `sync.Mutex`/`RWMutex` with the lock close to the data (unexported field next to the mutex), `sync/atomic` types for counters, and `sync.Once`/`sync.OnceValue` for lazy initialization.
- **[FORBIDDEN]** Data races (verified with `-race`), copying structs that contain a mutex, `time.Sleep` for synchronization, unbounded goroutine creation per item or per request fan-out, and `panic` in goroutines without recovery at the goroutine boundary in servers.
- **[PERFORMANCE]** Bound work with worker pools or semaphores sized to downstream capacity, use `time.NewTimer`/`context.WithTimeout` instead of `time.After` inside loops, and apply backpressure instead of unbounded in-memory queues.
- **[PATTERN]** Graceful shutdown: `signal.NotifyContext` cancels the root context, `http.Server.Shutdown(ctx)` drains connections with a deadline, and background workers finish or checkpoint their current item before exiting.
- **[PATTERN]** Prefer higher-level constructs for common needs: `singleflight` to deduplicate concurrent calls, `x/time/rate` for rate limiting, and `sync.Pool` only for measured allocation hot spots.
- **[TESTING]** Run all tests with `go test -race`, test cancellation paths explicitly (cancelled context returns promptly with `context.Canceled`), use `go.uber.org/goleak` to detect goroutine leaks, and use `testing/synctest` for deterministic tests of timing-dependent code.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
