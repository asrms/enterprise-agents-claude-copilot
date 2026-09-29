---
name: go-performance-profiling
description: "Measured performance work in Go: benchmarks with testing.B and benchstat, CPU/heap/block/mutex profiles with pprof, execution traces, escape analysis, allocation reduction, profile-guided optimization, GOMAXPROCS and GOMEMLIMIT in containers, and continuous profiling. Use it when optimizing or reviewing performance of Go code."
---

# Skill: Go Performance Profiling

## Implementation Rules:
- **[MANDATORY]** Measure before and after every optimization: write a benchmark (`func BenchmarkX(b *testing.B)` using `for b.Loop()` in Go 1.24+), run it multiple times (`-count=10`), and compare with `benchstat`; report the change with its statistical significance.
- **[PATTERN]** Find the real bottleneck with profiles, not guesses: `go test -cpuprofile/-memprofile`, `net/http/pprof` on an internal port for running services, `go tool pprof -http=:0`, and `go tool trace` for latency, scheduling, and GC pauses.
- **[PERFORMANCE]** Reduce allocations on hot paths: preallocate slices and maps with known capacity (`make([]T, 0, n)`), reuse buffers (`bytes.Buffer`, `sync.Pool` for measured hot spots), avoid converting between `string` and `[]byte` repeatedly, and use `strings.Builder` for concatenation.
- **[PERFORMANCE]** Check escape analysis (`go build -gcflags=-m`) for unexpected heap allocations in hot functions; pass small structs by value and avoid interfaces and closures in tight loops when profiles show their cost.
- **[PERFORMANCE]** Choose efficient I/O: buffered readers and writers (`bufio`), streaming JSON encoding/decoding instead of loading whole payloads, and database access with batched queries and connection pools sized to the database.
- **[PATTERN]** Enable profile-guided optimization for services with stable workloads: collect a representative CPU profile from production and commit it as `default.pgo` in the main package; rebuild and verify gains with benchmarks.
- **[MANDATORY]** Configure the runtime for containers: `GOMAXPROCS` matches the CPU limit (automatic in Go 1.25+, otherwise `go.uber.org/automaxprocs`), and `GOMEMLIMIT` is set to about 80-90% of the memory limit to avoid OOM kills while keeping GC efficient.
- **[FORBIDDEN]** Premature micro-optimizations that hurt readability without profile evidence, `unsafe` conversions to save allocations without a measured need and review, and exposing pprof endpoints on public interfaces.
- **[PATTERN]** Detect contention with block and mutex profiles (`runtime.SetBlockProfileRate`, `runtime.SetMutexProfileFraction`) and reduce it by sharding locks, shortening critical sections, or using channels/atomics where appropriate.
- **[PATTERN]** Use continuous profiling in production (Pyroscope, Parca, cloud profilers) with low overhead, and correlate profiles with traces and metrics during incidents.
- **[TESTING]** Performance-critical packages keep benchmarks in the repository, and CI runs them on stable runners to detect regressions (benchstat comparison against the main branch) together with load tests (k6, vegeta) for latency targets.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
