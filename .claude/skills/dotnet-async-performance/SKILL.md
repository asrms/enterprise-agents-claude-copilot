---
name: dotnet-async-performance
description: "Async and performance practices for modern .NET: async all the way with CancellationToken, avoiding sync-over-async and thread-pool starvation, IHttpClientFactory and resilience, bounded parallelism, channels, allocation reduction with Span and pooling, caching, and measurement with BenchmarkDotNet and dotnet-counters. Use it when writing or reviewing performance-sensitive .NET code."
---

# Skill: .NET Async and Performance

## Implementation Rules:
- **[MANDATORY]** Async all the way: I/O-bound methods return `Task`/`ValueTask`, are awaited up the call chain, and accept a `CancellationToken` that is passed to every downstream call; the `Async` suffix is used consistently.
- **[FORBIDDEN]** Sync-over-async (`.Result`, `.Wait()`, `GetAwaiter().GetResult()`) in application code, `async void` except event handlers, `Task.Run` to wrap I/O in ASP.NET Core, and fire-and-forget tasks without error handling (use a `BackgroundService` or a queue).
- **[MANDATORY]** Outbound HTTP uses `IHttpClientFactory` (typed or named clients) with timeouts and the standard resilience pipeline (`AddStandardResilienceHandler()` from `Microsoft.Extensions.Http.Resilience`: retry with jitter for idempotent calls, circuit breaker, attempt and total timeouts); never `new HttpClient()` per request.
- **[PERFORMANCE]** Run independent I/O concurrently with `Task.WhenAll`, and bound parallelism for large workloads with `Parallel.ForEachAsync(items, new ParallelOptions { MaxDegreeOfParallelism = n, CancellationToken = ct }, ...)` or `SemaphoreSlim`.
- **[PATTERN]** Producer/consumer pipelines and background processing use `System.Threading.Channels` with bounded capacity (`Channel.CreateBounded<T>`) and `BackgroundService`, so memory is bounded and back-pressure is explicit.
- **[PERFORMANCE]** Reduce allocations on hot paths: `Span<T>`/`Memory<T>` for parsing, `ArrayPool<T>`, `StringBuilder` or string interpolation handlers instead of concatenation in loops, `System.Text.Json` source generators, `FrozenDictionary` for read-only lookups, and `sealed` classes where inheritance is not intended.
- **[PERFORMANCE]** Cache deliberately with `HybridCache` or `IMemoryCache` with size limits and expirations, and `IDistributedCache`/Redis for shared caches, protecting against cache stampedes.
- **[PATTERN]** Use `ConfigureAwait(false)` in general-purpose libraries; in ASP.NET Core application code it is unnecessary. Use `ValueTask` only when measurements show a benefit, and never await a `ValueTask` twice.
- **[PATTERN]** Stream large payloads (`IAsyncEnumerable<T>` from EF Core or HTTP, `Stream` copying with buffers) instead of materializing entire collections or files in memory.
- **[PERFORMANCE]** Configure the runtime for containers: Server GC for services, `DOTNET_GCHeapHardLimit` or container-aware limits understood, ReadyToRun or Native AOT for startup-sensitive workloads where compatible, and tiered PGO enabled (default).
- **[TESTING]** Measure before and after: BenchmarkDotNet with `[MemoryDiagnoser]` for micro-benchmarks, `dotnet-counters` and `dotnet-trace` for thread-pool starvation, GC, and CPU in running services, and load tests (k6, NBomber) against stated latency targets.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
