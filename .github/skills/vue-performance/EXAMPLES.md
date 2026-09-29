# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Deep reactivity on large data, unstable props, full list rendering
```vue
<script setup lang="ts">
import _ from 'lodash'                                   // whole library in the bundle
import Chart from 'chart.js/auto'

const rows = ref<Row[]>([])                              // 20,000 rows made deeply reactive
const chart = ref<Chart | null>(null)                    // third-party instance proxied by Vue
watch(rows, () => { totals.value = _.sumBy(rows.value, 'amount') }, { deep: true })
const totals = ref(0)
</script>

<template>
  <RowItem v-for="(row, i) in rows" :key="i" :row="row" :options="{ compact: true }" />
</template>
```
**Why it's wrong:**
- Deep reactivity and a deep watcher over 20,000 rows make every update expensive; the total should be a `computed`.
- Index keys and a new `options` object per render defeat component update skipping; all rows are in the DOM.
- The chart instance is wrapped in a reactive proxy, and the entire lodash library ships to users.

## Best Practice (How to do it right)

### 1. Shallow data, computed totals, raw instances, virtual list
```vue
<script setup lang="ts">
import { shallowRef, computed, markRaw, onMounted, useTemplateRef } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import sumBy from 'lodash-es/sumBy'

const rows = shallowRef<Row[]>([])                       // replaced wholesale when data changes
const total = computed(() => sumBy(rows.value, 'amount'))
const rowOptions = Object.freeze({ compact: true })      // stable reference

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
let chart: import('chart.js').Chart | undefined

onMounted(async () => {
  rows.value = await fetchRows()
  const { Chart } = await import('chart.js/auto')        // loaded only when the view mounts
  chart = markRaw(new Chart(canvas.value!, buildConfig(rows.value)))
})
</script>

<template>
  <p>Total: {{ total.toFixed(2) }}</p>
  <canvas ref="canvas" aria-label="Revenue per day" role="img" />
  <RecycleScroller :items="rows" :item-size="40" key-field="id" class="rows" v-slot="{ item }">
    <RowItem :row="item" :options="rowOptions" />
  </RecycleScroller>
</template>
```
**Why it's right:**
- Large data is shallow-reactive and the total is a cached `computed`, so no deep tracking is needed.
- Only visible rows are rendered, with stable keys and stable props that let Vue skip unchanged rows.
- The chart library is code-split and its instance is excluded from reactivity; lodash is imported per function.
