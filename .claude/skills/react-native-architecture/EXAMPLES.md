# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Fetching in effects, untyped data, slow list
```tsx
export default function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    fetch('https://api.example.com/orders', { headers: { 'x-api-key': 'sk_live_123' } })  // secret in bundle
      .then(r => r.json())
      .then(setOrders)                                    // no error handling, no cancellation
  }, [])

  return (
    <ScrollView>
      {orders.map(o => (                                  // renders every row at once
        <TouchableOpacity key={o.id} onPress={() => navigation.navigate('Detail', { order: o })}>
          <Text>{o.number}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}
```
**Why it's wrong:**
- A secret API key ships in the JavaScript bundle; data is untyped and errors are ignored.
- All rows render in a `ScrollView`, and whole objects are passed as navigation params.

## Best Practice (How to do it right)

### 1. Typed API, TanStack Query, FlashList, Expo Router
`src/features/orders/api.ts`:
```typescript
import { z } from 'zod'

export const OrderSummary = z.object({ id: z.string(), number: z.string(), total: z.number(), currency: z.string() })
export type OrderSummary = z.infer<typeof OrderSummary>

export async function fetchOrders(signal?: AbortSignal): Promise<OrderSummary[]> {
  const res = await apiClient.get('/orders', { signal })          // BFF endpoint, session-authenticated
  return z.array(OrderSummary).parse(res.data)
}

export const useOrders = () => useQuery({ queryKey: ['orders'], queryFn: ({ signal }) => fetchOrders(signal) })
```
`app/(tabs)/orders/index.tsx`:
```tsx
import { FlashList } from '@shopify/flash-list'
import { Link } from 'expo-router'

export default function OrdersScreen() {
  const { data, isPending, isError, refetch } = useOrders()

  if (isPending) return <LoadingView />
  if (isError) return <ErrorView message="Orders could not be loaded." onRetry={refetch} />

  return (
    <FlashList
      data={data}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <OrderRow order={item} />}
    />
  )
}

const OrderRow = memo(function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <Link href={{ pathname: '/orders/[id]', params: { id: order.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`Order ${order.number}`}>
        <Text>{order.number}</Text>
      </Pressable>
    </Link>
  )
})
```
**Why it's right:**
- Responses are validated at the boundary, cached and retried by TanStack Query, and cancelled when unused.
- The list is virtualized with memoized rows; navigation passes only the id through a typed route.
- No secrets are in the bundle; the app calls its own backend.
