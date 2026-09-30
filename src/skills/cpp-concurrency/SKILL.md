---
name: cpp-concurrency
description: "Correct concurrency in modern C++: std::jthread and stop tokens, mutexes with scoped_lock and unique_lock, avoiding deadlocks with lock ordering, condition variables used correctly, std::atomic and memory orders, thread pools and task-based parallelism, parallel algorithms, futures and async, coroutines, avoiding data races and false sharing, and verifying with ThreadSanitizer. Use it when writing or reviewing multithreaded C++ code."
---

# Skill: C++ Concurrency

## Implementation Rules:
- **[MANDATORY]** Protect every piece of shared mutable data with a clear synchronization strategy (a mutex owned together with the data, atomics for simple counters and flags, or confinement to a single thread) and document it next to the data.
- **[MANDATORY]** Lock with RAII: `std::scoped_lock` (which also locks multiple mutexes deadlock-free), `std::unique_lock` when you need to unlock early or wait on a condition variable, and never call `lock()`/`unlock()` manually.
- **[PATTERN]** Use `std::jthread` with `std::stop_token` for threads that must be stopped cooperatively and joined automatically; prefer task-based designs (thread pools, executors, or libraries such as oneTBB) over creating threads per task.
- **[PATTERN]** Use condition variables correctly: always wait with a predicate (`cv.wait(lock, [&] { return !queue.empty() || stopping; })`) to handle spurious wakeups, modify the predicate state under the same mutex, and prefer `std::condition_variable_any` with stop tokens for cancellable waits.
- **[PATTERN]** Keep critical sections short: do not perform I/O, allocations of large objects, or callbacks into unknown code while holding a lock; copy or move data out under the lock and process it afterwards.
- **[FORBIDDEN]** Data races (they are undefined behavior), `volatile` as a synchronization mechanism, relaxed atomics without a documented reason, detached threads that outlive the objects they use, and lock acquisition in inconsistent orders.
- **[PATTERN]** Use `std::atomic` with the default sequentially consistent ordering unless profiling justifies weaker orders, and document acquire/release reasoning when used; prefer higher-level constructs over lock-free code written by hand.
- **[PERFORMANCE]** Avoid contention and false sharing: shard data or use per-thread accumulation merged at the end, align frequently written independent atomics to cache lines (`alignas(std::hardware_destructive_interference_size)` where available), and measure before optimizing.
- **[PATTERN]** Use the parallel algorithms (`std::execution::par`) or a task library for data-parallel work, `std::async` only with an explicit launch policy, and C++20 coroutines with a well-tested library (for example Asio or cppcoro-style libraries) for asynchronous I/O.
- **[PATTERN]** Handle exceptions in threads: exceptions escaping a thread function terminate the program, so catch at the thread boundary and propagate via `std::promise`, `std::exception_ptr`, or task results.
- **[TESTING]** Run concurrent tests under ThreadSanitizer in CI, stress-test with many iterations and threads, and use deterministic testing where possible (injected schedulers, sequenced tests for queue invariants).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
