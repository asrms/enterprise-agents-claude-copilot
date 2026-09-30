---
name: react-native-architecture
description: "Architecture for React Native apps on the New Architecture with Expo: TypeScript strict mode, feature-based structure, Expo Router or React Navigation with typed routes, server state with TanStack Query, native modules with Turbo Modules or Expo Modules, performant lists, environment configuration, and prebuild/CNG workflows. Use it when structuring or reviewing React Native applications."
---

# Skill: React Native Architecture

## Implementation Rules:
- **[ARCHITECTURE]** Start new apps with Expo (managed workflow with Continuous Native Generation via `npx expo prebuild`) on the New Architecture (Fabric, Turbo Modules, bridgeless mode); use bare React Native only when Expo cannot support a hard requirement.
- **[MANDATORY]** Use TypeScript with `strict: true`, typed navigation params, and typed API models validated at the boundary (Zod or similar) instead of trusting JSON shapes.
- **[ARCHITECTURE]** Organize by feature (`src/features/orders/{api,components,hooks,screens}`) with shared UI in a design-system folder; screens compose hooks and presentational components, and API clients live outside components.
- **[PATTERN]** Navigate with Expo Router (file-based, typed routes enabled) or React Navigation with typed param lists; pass ids in params rather than whole objects, and centralize authentication redirects.
- **[PATTERN]** Manage server state with TanStack Query (caching, retries, background refetch, offline persistence) and keep client state small (React state, Context, or Zustand); do not copy server data into global stores.
- **[PERFORMANCE]** Render long lists with `FlashList` or a tuned `FlatList` (`keyExtractor`, `getItemLayout` when heights are fixed, memoized `renderItem`), keep heavy work off the JS thread, and use Reanimated for animations that must run on the UI thread.
- **[PATTERN]** Access native capabilities through maintained Expo modules or community libraries compatible with the New Architecture; write custom native code as Expo Modules or Turbo Modules with typed specs (Codegen), not legacy bridge modules.
- **[FORBIDDEN]** Secrets in the JavaScript bundle or `app.config` extras (the bundle is readable), `any` in navigation params or API responses, inline anonymous components inside `renderItem`, and synchronous storage of large data on the JS thread.
- **[CONFIGURATION]** Configure environments with `app.config.ts` and `EXPO_PUBLIC_` variables for non-secret values only, separate bundle identifiers per environment, and keep native projects reproducible from config (config plugins) instead of manual edits.
- **[PATTERN]** Handle errors and loading consistently: error boundaries per screen, query error states rendered in UI, and crash reporting (for example Sentry) with source maps uploaded per release.
- **[TESTING]** Unit-test hooks and components with Jest and React Native Testing Library (`render`, `screen.getByRole`, `userEvent`), mock the network with MSW, and cover critical flows end to end with Maestro or Detox.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
