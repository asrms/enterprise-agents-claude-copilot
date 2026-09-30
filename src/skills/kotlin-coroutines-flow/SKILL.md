---
name: kotlin-coroutines-flow
description: "Kotlin coroutines and Flow for Android and server-side Kotlin: structured concurrency with scopes, injected dispatchers, cancellation and cooperative checks, exception handling with supervisorScope and CoroutineExceptionHandler, cold Flow vs StateFlow and SharedFlow, operators, stateIn and shareIn, backpressure, and testing with kotlinx-coroutines-test and Turbine. Use it when writing or reviewing coroutine-based Kotlin code."
---

# Skill: Kotlin Coroutines and Flow

## Implementation Rules:
- **[MANDATORY]** Follow structured concurrency: launch coroutines only in scopes with a lifecycle (`viewModelScope`, `lifecycleScope`, a request scope, or an injected application `CoroutineScope`), and use `coroutineScope { }` inside suspend functions to run parallel work that completes before the function returns.
- **[FORBIDDEN]** `GlobalScope`, `runBlocking` in production code paths (except `main` or bridging at the edge of blocking frameworks), catching `CancellationException` without rethrowing it, and `Thread.sleep` inside coroutines.
- **[MANDATORY]** Suspend functions are main-safe: they switch to the right dispatcher internally (`withContext(ioDispatcher)` for blocking I/O, `Dispatchers.Default` for CPU work), and dispatchers are injected rather than hard-coded so tests can replace them.
- **[PATTERN]** Parallelize independent calls with `async`/`await` inside `coroutineScope`, bound concurrency for large fan-outs with `Semaphore` or `flatMapMerge(concurrency = n)`, and use `withTimeout`/`withTimeoutOrNull` for calls that must finish in bounded time.
- **[PATTERN]** Make long-running loops cooperative with `ensureActive()` or `yield()`, and release resources in `try/finally` (using `withContext(NonCancellable)` only for short cleanup that must suspend).
- **[PATTERN]** Handle failures deliberately: exceptions propagate to the parent and cancel siblings; use `supervisorScope`/`SupervisorJob` when children must fail independently, `runCatching`-style mapping to results at layer boundaries, and a `CoroutineExceptionHandler` only as a last-resort logger for root coroutines.
- **[PATTERN]** Expose streams as cold `Flow` from data sources, and convert to hot `StateFlow` for state (`stateIn(scope, SharingStarted.WhileSubscribed(5_000), initial)`) or `SharedFlow` for broadcasts (`shareIn`); expose read-only types (`asStateFlow()`), never `MutableStateFlow` publicly.
- **[PATTERN]** Use operators intentionally: `map`/`filter` for transformation, `combine` for derived state, `flatMapLatest` for latest-wins queries, `debounce`/`distinctUntilChanged` for input, `catch` placed upstream of collection for error mapping, and `flowOn` to change the upstream dispatcher.
- **[PERFORMANCE]** Handle backpressure with `buffer`, `conflate`, or `collectLatest` according to semantics, and avoid creating new flows on every call where a shared one is expected (for example in Compose recomposition).
- **[PATTERN]** Bridge callback APIs with `suspendCancellableCoroutine` (unregistering in `invokeOnCancellation`) and `callbackFlow` (with `awaitClose { }` cleanup).
- **[TESTING]** Test with `runTest` and a `StandardTestDispatcher` (virtual time with `advanceTimeBy`/`advanceUntilIdle`), set `Dispatchers.setMain` for Android ViewModels, and assert flows with Turbine (`flow.test { awaitItem() }`), including cancellation and error cases.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
