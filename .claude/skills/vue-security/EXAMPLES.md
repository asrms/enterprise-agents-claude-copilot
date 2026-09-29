# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unsanitized HTML, javascript: URLs, and a per-user leak in SSR
```vue
<script setup lang="ts">
const props = defineProps<{ bio: string; website: string }>()
</script>

<template>
  <div v-html="props.bio"></div>                        <!-- stored XSS -->
  <a :href="props.website">Website</a>                 <!-- javascript:alert(document.cookie) -->
</template>
```
```typescript
// server/utils/current-user.ts
let currentUser: User | null = null                     // shared by all concurrent requests
export function setUser(u: User) { currentUser = u }
export function getUser() { return currentUser }
```
**Why it's wrong:**
- User-controlled HTML and URLs execute script in other users' browsers.
- A module-level variable on the server leaks one user's identity into another user's response.

## Best Practice (How to do it right)

### 1. Sanitized rich text and safe links
```vue
<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'

const props = defineProps<{ bio: string; website: string }>()

const safeBio = computed(() =>
  DOMPurify.sanitize(props.bio, { ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'ul', 'li'], ALLOWED_ATTR: [] }),
)

const safeWebsite = computed(() => {
  try {
    const url = new URL(props.website)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized with a strict allow-list above -->
  <div class="bio" v-html="safeBio"></div>
  <a v-if="safeWebsite" :href="safeWebsite" target="_blank" rel="noopener noreferrer">Website</a>
</template>
```
### 2. Per-request user context in Nitro
```typescript
// server/middleware/auth.ts
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)           // reads the HttpOnly session cookie
  event.context.user = session?.user ?? null            // scoped to this request only
})

// server/api/orders.get.ts
export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return listOrdersForCustomer(user.id)                 // authorization enforced on the server
})
```
**Why it's right:**
- Only a small set of harmless tags survives, and every `v-html` use is explicitly reviewed.
- Links accept only `https:` URLs and cannot run script.
- User identity lives in the request context, and the API enforces authorization itself.
