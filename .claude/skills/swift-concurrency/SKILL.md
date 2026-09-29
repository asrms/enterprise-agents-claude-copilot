---
name: swift-concurrency
description: "Safe Swift concurrency in Swift 6: async/await, structured concurrency with task groups and async let, actors and @MainActor isolation, Sendable, cancellation, avoiding unstructured Task misuse, AsyncSequence and AsyncStream, bridging callback APIs with continuations, and complete strict concurrency checking. Use it when writing or reviewing concurrent Swift code for iOS, macOS, or server."
---

# Skill: Swift Concurrency

## Implementation Rules:
- **[MANDATORY]** Compile with the Swift 6 language mode (complete data-race checking); fix diagnostics by modeling isolation correctly, not by sprinkling `@unchecked Sendable`, `nonisolated(unsafe)`, or `@preconcurrency` without a documented justification.
- **[MANDATORY]** UI state and UI-facing models are `@MainActor`; shared mutable state that is not UI state is protected by an `actor` or by a lock-based type with a clear `Sendable` story (`Mutex` from the Synchronization framework where available).
- **[PATTERN]** Prefer structured concurrency: `async let` for a fixed number of parallel calls and `withThrowingTaskGroup`/`withTaskGroup` for dynamic fan-out, limiting concurrency by adding tasks gradually; child tasks are cancelled automatically when the scope exits or throws.
- **[FORBIDDEN]** `Task { }` fire-and-forget from arbitrary code without storing or cancelling it, `Task.detached` without a specific need, `DispatchSemaphore`/`DispatchGroup.wait()` to block on async work, and `Thread.sleep` in async contexts.
- **[MANDATORY]** Support cancellation: long loops check `try Task.checkCancellation()` or `Task.isCancelled`, pass cancellation to `URLSession` automatically by awaiting its async APIs, and in SwiftUI start work with `.task`/`.task(id:)` so it is cancelled when the view disappears or the id changes.
- **[PATTERN]** Understand actor reentrancy: state may change across an `await` inside an actor, so re-validate assumptions after suspension points and avoid awaiting in the middle of multi-step invariants (or deduplicate in-flight work with stored tasks).
- **[PATTERN]** Types crossing isolation boundaries are `Sendable`: value types with `Sendable` members, immutable final classes, or actors; use `sending` parameters and region-based isolation instead of copying where appropriate.
- **[PATTERN]** Bridge legacy callback and delegate APIs with `withCheckedThrowingContinuation` (resuming exactly once) or `AsyncStream` with `onTermination` cleanup, and expose event sequences as `AsyncSequence`.
- **[PERFORMANCE]** Avoid hopping to the main actor for heavy work: run CPU-intensive processing in nonisolated async functions or dedicated actors, and hop back only to publish results.
- **[PATTERN]** Use `Clock`/`ContinuousClock` and `Task.sleep(for:)` injected as a dependency so time-based logic can be tested with a test clock.
- **[TESTING]** Test async code with `async` test functions, deterministic fakes, and injected clocks; verify cancellation paths and use Thread Sanitizer in CI test runs.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
