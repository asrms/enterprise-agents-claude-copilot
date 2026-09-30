# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Prop mutation, duplicated state, untracked fetches
```vue
<script setup>
const props = defineProps(['items', 'filter'])           // untyped
const filtered = ref([])

watch(() => props.filter, async (f) => {                 // no cleanup: stale responses win
  const res = await fetch(`/api/items?f=${f}`)           // unencoded input
  filtered.value = await res.json()
})

function select(item) {
  props.items.forEach(i => (i.selected = false))         // mutates parent state through props
  item.selected = true
}
</script>

<template>
  <li v-for="item in filtered" v-if="item.visible" @click="select(item)">{{ item.name }}</li>
</template>
```
**Why it's wrong:**
- Untyped props, direct prop mutation, and `v-if` with `v-for` on the same element (no `:key`).
- Requests are not cancelled, so a slower earlier response overwrites a newer one.

## Best Practice (How to do it right)

### 1. Typed component with defineModel and a composable
`features/orders/composables/useOrderSearch.ts`:
```typescript
import { ref, watch, toValue, type MaybeRefOrGetter } from 'vue'

export function useOrderSearch(query: MaybeRefOrGetter<string>) {
  const orders = ref<OrderSummary[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  watch(() => toValue(query), async (q, _old, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/orders?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      orders.value = await res.json()
    } catch (e) {
      if (!controller.signal.aborted) error.value = e as Error
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  }, { immediate: true })

  return { orders, loading, error }
}
```
`features/orders/components/OrderPicker.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOrderSearch } from '../composables/useOrderSearch'

const { query } = defineProps<{ query: string }>()
const selectedId = defineModel<string | null>('selectedId', { default: null })

const { orders, loading, error } = useOrderSearch(() => query)
const visible = computed(() => orders.value.filter(o => o.status !== 'ARCHIVED'))
</script>

<template>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error" role="alert">Orders could not be loaded.</p>
  <ul v-else>
    <li v-for="order in visible" :key="order.id">
      <button type="button" :aria-pressed="order.id === selectedId" @click="selectedId = order.id">
        {{ order.number }}
      </button>
    </li>
  </ul>
</template>
```
**Why it's right:**
- Props are typed and never mutated; the selection is a `defineModel` two-way binding owned by the parent.
- The composable is reusable, cancels outdated requests, and exposes loading and error state.
- Filtering is a pure `computed`, and the list uses stable keys.
