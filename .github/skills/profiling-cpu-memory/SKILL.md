---
name: profiling-cpu-memory
description: "Finding CPU, memory, and I/O bottlenecks and leaks in any runtime: sampling vs instrumenting profilers, flame graphs, heap snapshots and allocation profiling, continuous profiling in production (Pyroscope, Parca, cloud profilers), language tools (async-profiler and JFR for the JVM, dotnet-trace and dotnet-counters, pprof for Go, py-spy and memray for Python, Chrome DevTools and clinic for Node.js, perf and eBPF for native code), and verifying fixes. Use it when diagnosing slowness, high resource usage, or memory growth."
---

# Skill: CPU and Memory Profiling

## Implementation Rules:
- **[MANDATORY]** Profile before optimizing: reproduce the problem with a representative workload (production traffic pattern or load test), collect a baseline metric (latency percentile, CPU per request, memory over time), and state the hypothesis you are testing.
- **[PATTERN]** Prefer low-overhead sampling profilers for CPU work (async-profiler or Java Flight Recorder, `dotnet-trace`, Go `pprof`, `py-spy`, Node.js `--cpu-prof` or Clinic.js, Linux `perf`), and read the results as flame graphs, focusing on the widest stacks.
- **[PATTERN]** Distinguish on-CPU from off-CPU time: if latency is high but CPU is low, profile wall-clock or off-CPU time (locks, I/O, network waits) with wall-clock modes, tracing, or eBPF tools rather than CPU profiles.
- **[PATTERN]** Diagnose memory with the right tool: allocation profiling to find allocation hot spots (JFR, `dotnet-counters` and `dotnet-gcdump`, pprof `alloc_space`, memray), heap snapshots compared over time to find leaks (retained size, dominator trees), and GC logs or metrics for pause and pressure problems.
- **[MANDATORY]** Check the obvious resource signals first: saturation of CPU, memory, disk, network, connection pools, and thread pools (USE method), and GC behavior, before diving into code-level profiles.
- **[PATTERN]** Use continuous profiling in production (Pyroscope, Parca, Datadog, Google Cloud Profiler, Amazon CodeGuru Profiler, Azure Application Insights Profiler) with low overhead to catch issues that do not reproduce in test and to compare versions.
- **[SECURITY]** Treat heap dumps and core dumps as sensitive data (they may contain secrets and personal data): collect them only with approval, store them encrypted with restricted access, and delete them after analysis.
- **[FORBIDDEN]** Optimizing based on intuition without measurements, profiling debug builds or cold, unwarmed processes (JIT runtimes), attaching heavy instrumenting profilers to production without assessing overhead, and declaring success without re-measuring.
- **[PATTERN]** Fix the biggest contributor first, change one thing at a time, and keep a benchmark or load test that demonstrates the improvement and guards against regression.
- **[PATTERN]** Recognize common culprits: N+1 queries and chatty I/O, excessive allocation in hot loops, unbounded caches and listener leaks, lock contention, serialization overhead, logging in hot paths, and regular expressions with catastrophic backtracking.
- **[TESTING]** Verify every fix with the same workload and profile before and after, record the numbers in the pull request, and add regression guards (benchmarks in CI, performance tests, memory growth alerts).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
