---
name: pinia-state
description: "Application state with Pinia for Vue and Nuxt: when to use a store vs local state, setup stores with TypeScript, storeToRefs, actions for async work and error states, SSR-safe stores in Nuxt, persistence without sensitive data, store composition, and testing with @pinia/testing. Use it when designing or reviewing shared state in Vue applications."
---

# Skill: Pinia State Management

## Implementation Rules:
- **[ARCHITECTURE]** Keep state local by default (component refs, composables); introduce a Pinia store only for state shared across distant components or routes (session, cart, feature-wide filters). Server data that is only displayed is better handled by a data-fetching layer (`useFetch`/`useAsyncData` in Nuxt, or a query library) than copied into stores.
- **[PATTERN]** Define setup stores (`defineStore('orders', () => { ... })`) with `ref` for state, `computed` for getters, and functions for actions; return only what consumers need, and name stores after a domain concept (`useCartStore`).
- **[MANDATORY]** Destructure store state and getters with `storeToRefs(store)` to keep reactivity; call actions directly from the store instance.
- **[MANDATORY]** State changes happen through actions with clear names (`addItem`, `applyCoupon`); components do not mutate store state directly or use `$patch` for business operations.
- **[PATTERN]** Async actions track status explicitly (`status: 'idle' | 'loading' | 'success' | 'error'` and an `error` value), cancel or ignore stale requests, and return results or throw typed errors that callers can handle.
- **[SECURITY]** Persist only non-sensitive preferences (for example with `pinia-plugin-persistedstate`): never tokens, personal data, or payment details in `localStorage`/`sessionStorage`.
- **[PATTERN]** In Nuxt, stores are created per request on the server (via `@pinia/nuxt`), so no module-level mutable state exists outside stores; hydrate state from server fetches with `callOnce` or `useAsyncData` to avoid double fetching.
- **[PATTERN]** Compose stores by calling another store inside an action or getter (`const user = useUserStore()`), avoiding circular dependencies between stores at setup time.
- **[FORBIDDEN]** One giant global store for the whole application, storing derived values as state, storing non-serializable objects (class instances with methods, DOM nodes) in state used with SSR, and accessing stores outside `setup`/actions before Pinia is installed.
- **[PERFORMANCE]** Keep stores focused and state normalized (entities by id plus ordered id lists) for large collections, and use `shallowRef` for large immutable datasets.
- **[TESTING]** Unit-test stores with `setActivePinia(createPinia())` and a fresh Pinia per test; in component tests use `createTestingPinia({ initialState, stubActions })` from `@pinia/testing` and assert rendered output and called actions.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
