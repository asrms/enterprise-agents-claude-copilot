---
name: rxjs-patterns
description: "Correct and leak-free RxJS in Angular and TypeScript: choosing flattening operators (switchMap, concatMap, mergeMap, exhaustMap), subscription management with takeUntilDestroyed and the async pipe, error handling and retry with backoff, sharing with shareReplay, avoiding nested subscribes, and testing with marble tests. Use it when writing or reviewing Observable-based code."
---

# Skill: RxJS Patterns

## Implementation Rules:
- **[MANDATORY]** Choose the flattening operator by intent: `switchMap` for latest-wins reads (search, route params), `concatMap` for ordered writes, `mergeMap` with a concurrency limit for independent parallel work, and `exhaustMap` to ignore repeated triggers while one is in flight (submit buttons, refresh).
- **[FORBIDDEN]** Nested `subscribe` calls, subscribing inside `tap`, and storing values from a subscription into fields to use in another subscription; compose streams with operators instead.
- **[MANDATORY]** Every manual subscription in a component or service with a lifecycle is ended: `takeUntilDestroyed()` (in an injection context or with a `DestroyRef`), the `async` pipe, or `toSignal()`; finite HTTP observables still need cancellation when the view is destroyed mid-request.
- **[PATTERN]** Handle errors inside the inner observable (`switchMap(q => api.search(q).pipe(catchError(() => of(EMPTY_RESULT))))`) so one failure does not complete the outer stream; map errors to typed UI states rather than swallowing them.
- **[PATTERN]** Retry only idempotent requests, with bounded attempts and backoff: `retry({ count: 3, delay: (_, attempt) => timer(2 ** attempt * 250) })`; never retry POSTs that are not idempotent.
- **[PATTERN]** Share expensive or HTTP-backed streams with `shareReplay({ bufferSize: 1, refCount: true })` to avoid duplicate requests and leaks; understand that cold HTTP observables re-execute per subscriber.
- **[PERFORMANCE]** Throttle user input with `debounceTime`, `distinctUntilChanged`, and `filter` (minimum length) before hitting the network, and avoid high-frequency streams triggering change detection unnecessarily.
- **[PATTERN]** Prefer declarative pipelines built once (for example in a field initializer) over imperative `next()` calls on `Subject`s scattered in methods; expose `Observable`s, not `Subject`s, from services (`asObservable()`).
- **[PATTERN]** In modern Angular, use signals for synchronous state and keep RxJS for event streams, time-based operators, and complex async coordination, converting at the boundary with `toSignal`/`toObservable`.
- **[FORBIDDEN]** Deprecated signatures such as `subscribe(next, error, complete)` with positional callbacks, `toPromise()`, and `BehaviorSubject.value` reads used as a synchronous state store across the application.
- **[TESTING]** Test time-based and concurrency behavior with marble tests (`TestScheduler.run(({ cold, expectObservable }) => ...)`) and verify cancellation (for example that `switchMap` unsubscribes the previous request).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
