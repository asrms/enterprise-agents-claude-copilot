---
name: nuxt-rendering-caching
description: "Rendering and data fetching in Nuxt (current major): SSR, SSG, SPA and hybrid route rules, useFetch and useAsyncData with keys, avoiding double fetching, server routes with Nitro, caching with routeRules (swr, isr, prerender) and cachedEventHandler, runtime config and secrets, and deployment presets. Use it when building or reviewing Nuxt applications."
---

# Skill: Nuxt Rendering and Caching

## Implementation Rules:
- **[ARCHITECTURE]** Choose rendering per route with `routeRules` in `nuxt.config.ts`: `prerender: true` for static marketing and docs pages, `swr`/`isr` for public content that tolerates staleness, SSR for personalized pages, and `ssr: false` only for authenticated app areas that gain nothing from server rendering.
- **[MANDATORY]** Fetch data in components with `useFetch` or `useAsyncData` (or `$fetch` inside `useAsyncData`) so it is fetched once on the server and transferred to the client; never call raw `$fetch`/`fetch` at the top level of `setup` during SSR, which fetches twice.
- **[PATTERN]** Give `useAsyncData` stable, unique keys, pass reactive parameters via `query`/`watch` options, use `lazy: true` with explicit `status` handling for non-critical data, and `pick`/`transform` to send only the fields the page needs in the payload.
- **[PATTERN]** Put backend-for-frontend logic in Nitro server routes (`server/api/*.ts` with `defineEventHandler`), validate input with `getValidatedQuery`/`readValidatedBody` and a schema (Zod), and call internal services from there so secrets never reach the browser.
- **[MANDATORY]** Configuration uses `runtimeConfig`: private keys (API secrets) at the top level are server-only; only values under `runtimeConfig.public` reach the client. Values are overridden per environment with `NUXT_`-prefixed environment variables, never hard-coded.
- **[PERFORMANCE]** Cache server work deliberately: `cachedEventHandler`/`defineCachedFunction` with `maxAge`, `swr`, and a `getKey` that includes every input that affects the response, and route-level cache headers; never cache responses that depend on cookies or authorization under a shared key.
- **[FORBIDDEN]** Accessing `window`, `document`, or `localStorage` during SSR outside `onMounted`/`import.meta.client` guards, module-level mutable state in server code shared across requests, and exposing secrets through `runtimeConfig.public` or `useState` payloads.
- **[PATTERN]** Share SSR-safe state with `useState('key', () => init)` or Pinia; use `<ClientOnly>` for browser-only widgets and `useHead`/`useSeoMeta` for per-page metadata.
- **[PERFORMANCE]** Use Nuxt Image (`<NuxtImg>`) for responsive images, lazy components (`Lazy` prefix, `hydrate-on-visible` lazy hydration where available), and route-level code splitting that Nuxt provides by default; audit payload size in `__NUXT__` data.
- **[CONFIGURATION]** Select the Nitro deployment preset for the target (Node server, serverless, edge) and verify that caching storage (`nitro.storage`) uses a shared backend such as Redis when running multiple instances.
- **[TESTING]** Test pages and server routes with `@nuxt/test-utils` (`mountSuspended` for components, `$fetch` against a started test server for API routes) and check rendered HTML for SSR correctness and hydration warnings.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
