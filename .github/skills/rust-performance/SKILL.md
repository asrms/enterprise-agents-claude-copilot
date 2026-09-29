---
name: rust-performance
description: "Performance engineering in Rust: release profiles and LTO, benchmarking with criterion or divan, profiling with perf, flamegraph, and samply, reducing allocations and copies, choosing data structures, avoiding unnecessary clones and dynamic dispatch in hot paths, parallelism with rayon, SIMD and bounds-check considerations, binary size, and compile-time trade-offs. Use it when optimizing or reviewing performance-critical Rust code."
---

# Skill: Rust Performance

## Implementation Rules:
- **[MANDATORY]** Measure before optimizing: benchmark with criterion or divan (statistically robust, with baselines) and profile release builds with debug symbols (`perf`, `cargo flamegraph`, `samply`); state the metric and target for every optimization.
- **[MANDATORY]** Benchmark and profile only optimized builds; configure `[profile.release]` deliberately (`lto = "thin"` or `"fat"`, `codegen-units = 1` for maximum performance, `debug = "line-tables-only"` for profiling) and consider profile-guided optimization for hot services.
- **[PERFORMANCE]** Reduce allocations in hot paths: reuse buffers (`Vec::with_capacity`, `clear()` and refill), avoid `format!` and `to_string()` in loops, use `&str` and slices instead of owned strings, `SmallVec` or `ArrayVec` for small bounded collections, and `Bytes` for shared buffers.
- **[PERFORMANCE]** Choose data structures by access pattern: `Vec` and slices for iteration, `HashMap` with a faster hasher (`ahash`, `rustc-hash`) for trusted keys, `BTreeMap` for ordered data, and struct-of-arrays layouts for cache-friendly numeric processing.
- **[PATTERN]** Parallelize CPU-bound data processing with `rayon` (`par_iter`) after confirming the work is large enough, and keep async runtimes for I/O concurrency rather than CPU parallelism.
- **[PATTERN]** Prefer static dispatch (generics) in hot loops, iterators that the compiler can vectorize, and slices with known lengths to help eliminate bounds checks; verify with benchmarks rather than assumptions.
- **[FORBIDDEN]** Micro-optimizations without measurements, `unsafe` (for example `get_unchecked`) to remove bounds checks without profiling evidence and a safety argument, benchmarking debug builds, and default `SipHash` replacements for keys controlled by untrusted input (HashDoS risk).
- **[PERFORMANCE]** Minimize I/O overhead: buffered readers and writers (`BufReader`, `BufWriter`), batched system calls and database queries, streaming serialization with `serde` instead of building large intermediate values, and zero-copy deserialization where formats allow.
- **[PATTERN]** Manage binary size and compile time when relevant: `opt-level = "z"` or `"s"`, `strip = true`, `panic = "abort"` for small binaries, feature flags to exclude unused dependencies, and `cargo bloat` or `cargo llvm-lines` to find the biggest contributors.
- **[PATTERN]** Consider allocator choice for allocation-heavy multithreaded services (for example jemalloc or mimalloc), validated with benchmarks and memory profiling (heaptrack, dhat).
- **[TESTING]** Keep benchmarks in the repository, compare against saved baselines in CI on stable hardware (criterion baselines or divan), and fail or warn on significant regressions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
