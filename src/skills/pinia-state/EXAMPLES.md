# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Global dumping ground with direct mutation and secrets
```typescript
export const useAppStore = defineStore('app', {
  state: () => ({
    token: localStorage.getItem('token'),   // secret in web storage
    user: null as any,
    cart: [] as any[],
    cartTotal: 0,                           // derived value stored as state
    orders: [] as any[],
  }),
})

// in a component
const app = useAppStore()
const { cart } = app                        // loses reactivity
app.cart.push(item)                         // mutation from the component
app.cartTotal += item.price                 // manual sync of derived state
```
**Why it's wrong:**
- Unrelated domains share one untyped store; a token is persisted in `localStorage`.
- Destructuring breaks reactivity, and business rules live in components.

## Best Practice (How to do it right)

### 1. Focused, typed setup store with actions and status
```typescript
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartLine[]>([])
  const status = ref<'idle' | 'saving' | 'error'>('idle')

  const count = computed(() => items.value.reduce((n, l) => n + l.quantity, 0))
  const total = computed(() => items.value.reduce((s, l) => s + l.unitPrice * l.quantity, 0))

  function addItem(product: Product, quantity = 1) {
    const line = items.value.find(l => l.productId === product.id)
    if (line) line.quantity += quantity
    else items.value.push({ productId: product.id, name: product.name, unitPrice: product.price, quantity })
  }

  async function checkout(api: CheckoutApi): Promise<OrderId> {
    status.value = 'saving'
    try {
      const orderId = await api.placeOrder(items.value.map(({ productId, quantity }) => ({ productId, quantity })))
      items.value = []
      status.value = 'idle'
      return orderId
    } catch (e) {
      status.value = 'error'
      throw e
    }
  }

  // setup stores must return all state refs so Pinia can hydrate, inspect, and test them
  return { items, status, count, total, addItem, checkout }
})
```
```vue
<script setup lang="ts">
const cart = useCartStore()
const { count, total, status } = storeToRefs(cart)
</script>

<template>
  <p>{{ count }} items, total {{ total.toFixed(2) }}</p>
  <button type="button" :disabled="status === 'saving'" @click="cart.checkout(checkoutApi)">Checkout</button>
</template>
```
### 2. Component test with a testing Pinia
```typescript
const wrapper = mount(CartSummary, {
  global: { plugins: [createTestingPinia({ initialState: { cart: { items: [line] } }, createSpy: vi.fn })] },
})
await wrapper.get('button').trigger('click')
expect(useCartStore().checkout).toHaveBeenCalled()
```
**Why it's right:**
- The store owns one domain, derives totals with `computed`, and changes state only through actions (all state refs are returned, as Pinia requires for SSR and devtools).
- Async work tracks status and propagates errors; components keep reactivity via `storeToRefs`.
- Tests control initial state and stub actions without a real backend.
