---
name: mobile-state-management
description: "State management for cross-platform mobile apps in Flutter and React Native: separating server, client, and UI state, choosing Riverpod or Bloc in Flutter and TanStack Query plus Zustand or Redux Toolkit in React Native, immutable updates, derived state, persistence and hydration, and avoiding unnecessary rebuilds. Use it when designing or reviewing state handling in Flutter or React Native apps."
---

# Skill: Mobile State Management

## Implementation Rules:
- **[ARCHITECTURE]** Classify state before choosing tools: server state (remote data with caching and invalidation), client/app state (session, preferences, cart), and ephemeral UI state (text field, expanded panel); each category has a different home.
- **[PATTERN]** Server state uses a caching layer: in React Native TanStack Query (query keys, `staleTime`, invalidation after mutations); in Flutter repository-backed providers (Riverpod `FutureProvider`/`AsyncNotifier`) or Bloc/Cubit with explicit loading and error states.
- **[PATTERN]** App state lives in one well-defined mechanism per app: Riverpod or Bloc in Flutter; Zustand or Redux Toolkit in React Native, with small focused stores/slices per domain rather than one global object.
- **[MANDATORY]** Ephemeral UI state stays local (`useState`, `StatefulWidget` state, `flutter_hooks`); do not promote it to global stores.
- **[MANDATORY]** State is immutable: new objects on update (`copyWith`, spread, Immer in Redux Toolkit); never mutate lists or objects held by state, which breaks change detection and rebuild logic.
- **[PATTERN]** Derive values instead of storing them (selectors, computed providers, `select`/`buildWhen`), and model async results explicitly (`AsyncValue`, sealed states, query status) so every screen handles loading, empty, error, and data.
- **[PERFORMANCE]** Minimize rebuilds: subscribe to the narrowest slice (`ref.watch(provider.select(...))`, `BlocSelector`, Zustand selectors with shallow equality), keep widgets and components small, and memoize expensive derived data.
- **[SECURITY]** Persist only what is needed and never secrets: tokens go to the platform keystore (Keychain/Keystore via `flutter_secure_storage` or `expo-secure-store`), while non-sensitive state may use persisted storage (MMKV, Hive, AsyncStorage) with versioned migrations.
- **[FORBIDDEN]** Multiple competing state libraries for the same concern, global mutable singletons, storing server data manually in global stores without invalidation, and business logic inside widgets or components.
- **[PATTERN]** Reset user-scoped state on logout (invalidate providers, clear query cache, reset stores) so no data from one account leaks into the next session.
- **[TESTING]** Test state holders without UI: Riverpod `ProviderContainer` with overrides, `bloc_test` for Blocs, Zustand stores and Redux reducers as plain functions, and TanStack Query hooks with a fresh `QueryClient` per test.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
