---
name: angular-signals-state
description: "State management in Angular with signals: signal, computed, linkedSignal, effect used sparingly, signal inputs and model, resource and httpResource for async data, toSignal/toObservable interop with RxJS, signal-based stores (services or NgRx SignalStore), and immutable updates. Use it when designing component or application state in Angular."
---

# Skill: Angular Signals State

## Implementation Rules:
- **[ARCHITECTURE]** Choose the smallest scope that works: local component state in signals, feature state in a signal-based store service provided at the feature route, and global state only for truly global concerns (session, user preferences); adopt NgRx SignalStore when stores need shared conventions, plugins, or devtools.
- **[MANDATORY]** Expose state as read-only signals (`private readonly _items = signal<Item[]>([])`, `readonly items = this._items.asReadonly()`) and mutate only through store methods; components never set store signals directly.
- **[MANDATORY]** Derive values with `computed()` instead of duplicating state or recalculating in templates; use `linkedSignal()` for writable state that must reset when a source changes (for example a selected item when the list changes).
- **[PATTERN]** Update immutably (`this._items.update(items => [...items, item])`); never mutate arrays or objects held by a signal in place, because equality checks will not detect the change.
- **[PATTERN]** Load async data with `resource()`/`httpResource()` or `rxResource()` where available, exposing `value()`, `isLoading()`, and `error()` to templates; otherwise wrap HTTP observables with `toSignal()` and explicit loading and error state.
- **[FORBIDDEN]** Using `effect()` to copy one signal into another or to derive state (use `computed` or `linkedSignal`); effects are for side effects that leave the signal graph (logging, local storage sync, imperative third-party APIs).
- **[PATTERN]** Bridge RxJS deliberately: keep event streams that need operators (debounce, switchMap, retry) in RxJS and convert at the edge with `toSignal(obs$, { initialValue })` or `toObservable(sig)`; avoid converting back and forth repeatedly.
- **[PATTERN]** Use signal-based component APIs (`input()`, `input.required()`, `output()`, `model()` for two-way binding) and `viewChild()`/`contentChildren()` queries, which integrate with `computed`.
- **[PERFORMANCE]** Keep signals granular (separate signals or selectors for independently changing data) so that only dependent views update; pass custom `equal` functions only when needed.
- **[SECURITY]** Do not store access tokens or personal data in global signal state that is persisted to `localStorage`; persist only non-sensitive preferences.
- **[TESTING]** Test stores as plain classes with `TestBed.inject` and assert signal values after calling methods; use `TestBed.tick()` (or `flushEffects` equivalents) when effects must run, and mock HTTP with `provideHttpClientTesting()`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
