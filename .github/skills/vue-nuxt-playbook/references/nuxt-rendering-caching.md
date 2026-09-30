# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Double fetching, leaked secret, shared cache for personal data
```vue
<script setup lang="ts">
const config = useRuntimeConfig()
// fetched on the server AND again on the client; secret key exposed to the browser
const products = await $fetch(`https://api.example.com/products?key=${config.public.apiSecret}`)
</script>
```
```typescript
// server/api/me.get.ts
export default cachedEventHandler(async (event) => {
  return getUserProfile(event)           // same cache key for every user: data leaks between users
}, { maxAge: 600 })
```
**Why it's wrong:**
- Raw `$fetch` in setup runs twice and the API secret sits in public runtime config.
- A cached handler without a user-specific key serves one user's profile to everyone.

## Best Practice (How to do it right)

### 1. Route rules, server route as BFF, and useFetch
`nuxt.config.ts`:
```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 300 },
    '/account/**': { ssr: false },
  },
  runtimeConfig: {
    catalogApiKey: '',                            // server-only, set via NUXT_CATALOG_API_KEY
    public: { siteName: 'Example Shop' },
  },
})
```
`server/api/products/[slug].get.ts`:
```typescript
import { z } from 'zod'

const params = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/) })

export default defineCachedEventHandler(async (event) => {
  const { slug } = await getValidatedRouterParams(event, params.parse)
  const { catalogApiKey } = useRuntimeConfig(event)
  const product = await $fetch<CatalogProduct>(`https://catalog.internal.example.com/products/${slug}`, {
    headers: { Authorization: `Bearer ${catalogApiKey}` },
  })
  return { slug: product.slug, name: product.name, price: product.price, currency: product.currency }
}, { maxAge: 300, swr: true, getKey: (event) => `product:${getRouterParam(event, 'slug')}` })
```
`pages/products/[slug].vue`:
```vue
<script setup lang="ts">
const route = useRoute()
const { data: product, status, error } = await useFetch(() => `/api/products/${route.params.slug}`, {
  key: `product-${route.params.slug}`,
})
useSeoMeta({ title: () => product.value?.name ?? 'Product' })
</script>

<template>
  <p v-if="status === 'pending'">Loading…</p>
  <p v-else-if="error" role="alert">This product is not available.</p>
  <ProductDetail v-else-if="product" :product="product" />
</template>
```
**Why it's right:**
- Rendering and caching are chosen per route; personal areas are never cached publicly.
- The secret stays on the server, the input is validated, and the cache key includes the only varying input.
- `useFetch` fetches once during SSR, transfers a minimal payload, and exposes status and error.
