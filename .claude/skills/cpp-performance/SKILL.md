---
name: cpp-performance
description: "Performance engineering in C++: measuring with Google Benchmark and profilers (perf, VTune, Tracy, Instruments), build optimization (optimization levels, LTO, PGO), data-oriented design and cache locality, avoiding unnecessary copies and allocations, move semantics, small buffer and reserve strategies, container choice, inlining and virtual dispatch costs, SIMD, and preventing regressions. Use it when optimizing or reviewing performance-critical C++ code."
---

# Skill: C++ Performance

## Implementation Rules:
- **[MANDATORY]** Measure first and last: micro-benchmarks with Google Benchmark (or nanobench) using `benchmark::DoNotOptimize` and `ClobberMemory`, system profiles with `perf`, Intel VTune, AMD uProf, Tracy, or Instruments on release builds with symbols, and a stated target for each optimization.
- **[MANDATORY]** Optimize the build before the code: release builds with `-O2`/`-O3` or `/O2`, `-DNDEBUG`, link-time optimization, and profile-guided optimization for hot binaries; profile builds keep frame pointers (`-fno-omit-frame-pointer`) for accurate stacks.
- **[PERFORMANCE]** Design for cache locality: contiguous containers (`std::vector`, flat maps such as `std::flat_map` in C++23 or library equivalents) over node-based ones in hot paths, structure-of-arrays for data processed field by field, and compact data layouts that avoid padding.
- **[PERFORMANCE]** Avoid needless copies and allocations: pass by `const&` or view types, move from temporaries and sinks, `reserve` capacity when sizes are known, reuse buffers across iterations, and use small-buffer-optimized types or arenas (`std::pmr` memory resources) where allocation dominates.
- **[PATTERN]** Choose algorithms and containers by complexity and constant factors: hash maps with good hash functions (or open-addressing implementations such as absl::flat_hash_map or boost::unordered_flat_map), sorted vectors for small read-mostly sets, and avoid `std::list` in hot code.
- **[PATTERN]** Reduce indirection in hot loops: prefer templates or `std::variant` visitation over virtual calls where it matters, mark small functions inline-able (define in headers when appropriate), and keep branches predictable.
- **[FORBIDDEN]** Optimizations without benchmarks, benchmarking debug builds, undefined behavior introduced for speed (type punning via pointer casts, strict aliasing violations), and premature manual SIMD or assembly before trying algorithmic improvements and compiler auto-vectorization.
- **[PERFORMANCE]** Use SIMD through portable means first: auto-vectorization (check with `-fopt-info-vec` or `-Rpass=loop-vectorize`), `std::experimental::simd` or libraries such as Highway or xsimd, and intrinsics only in isolated, tested kernels.
- **[PATTERN]** Parallelize with care: parallel algorithms or task libraries for large independent work, avoiding false sharing and contention, and measuring scalability across core counts.
- **[PATTERN]** Watch I/O and system costs: batch system calls, use buffered and memory-mapped I/O where appropriate, and avoid logging or formatting in hot paths.
- **[TESTING]** Keep benchmarks in the repository, run them on dedicated hardware in CI with stable settings (CPU frequency scaling disabled, pinned cores), and compare against baselines to catch regressions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
