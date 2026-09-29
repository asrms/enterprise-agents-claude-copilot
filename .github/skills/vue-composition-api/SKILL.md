---
name: vue-composition-api
description: "Idiomatic Vue 3 with the Composition API and TypeScript: script setup single-file components, typed props and emits, defineModel, ref vs reactive, computed and watchers, composables for reusable logic, provide/inject with typed keys, template refs, and feature-based project structure. Use it when writing or reviewing Vue 3 components and composables."
---

# Skill: Vue Composition API

## Implementation Rules:
- **[MANDATORY]** Write components as `<script setup lang="ts">` single-file components with typed `defineProps<...>()` and `defineEmits<...>()`, and use `defineModel()` for two-way bindings instead of manual `modelValue`/`update:modelValue` plumbing.
- **[PATTERN]** Prefer `ref()` for state (works for primitives and objects, explicit `.value`), use `reactive()` only for cohesive objects that are never reassigned or destructured, and use `toRefs`/reactive props destructure (Vue 3.5+) to keep reactivity when destructuring.
- **[MANDATORY]** Derive data with `computed()`; never duplicate derived state in refs kept in sync by watchers. Computed getters are pure: no side effects, no async work, no mutation.
- **[PATTERN]** Use `watch` with explicit sources for side effects that react to specific changes (fetching on id change, syncing to URL), `watchEffect` only for simple effects, and clean up with `onWatcherCleanup` or the `onCleanup` argument (abort in-flight requests).
- **[ARCHITECTURE]** Extract reusable stateful logic into composables (`useOrders`, `usePagination`) named `useX`, placed in `composables/`, that accept refs or getters (`MaybeRefOrGetter` with `toValue`) and return refs and functions; composables do not touch the DOM unless that is their purpose.
- **[ARCHITECTURE]** Organize by feature (`features/orders/components`, `features/orders/composables`, `features/orders/api.ts`), keep components small with a single responsibility, and separate presentational components (props in, events out) from containers that fetch and orchestrate.
- **[PATTERN]** Use `provide`/`inject` with typed `InjectionKey<T>` symbols for dependency injection across deep trees, providing readonly refs (`readonly(state)`) plus mutation functions.
- **[PATTERN]** Use `useTemplateRef()` for template refs, `defineExpose` sparingly, and `v-model` modifiers or custom `defineModel` transforms instead of mutating props.
- **[FORBIDDEN]** Mutating props, the Options API mixed with the Composition API in new code, mixins, `this` in `<script setup>`, `v-if` together with `v-for` on the same element, and `v-for` without a stable `:key`.
- **[CONFIGURATION]** Enable `strict` TypeScript, type-check templates with `vue-tsc --noEmit` in CI, and lint with `eslint-plugin-vue` (recommended rules) and the TypeScript ESLint config.
- **[TESTING]** Composables are unit-tested directly (wrapping in a host component or `effectScope` when they use lifecycle hooks), and components are tested through rendered output and emitted events.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
