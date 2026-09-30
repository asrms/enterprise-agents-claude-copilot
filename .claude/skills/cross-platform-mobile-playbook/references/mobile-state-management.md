# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Everything in one mutable global store (React Native)
```typescript
export const useAppStore = create<any>((set, get) => ({
  token: '',                                            // secret in a persisted JS store
  orders: [],                                           // server data copied manually, never invalidated
  searchText: '',                                       // ephemeral UI state made global
  addOrder: (o: any) => { get().orders.push(o) },       // mutation: subscribers are not notified
}))

// every component re-renders on any change
const state = useAppStore()
```
**Why it's wrong:**
- Secrets, server data, and UI state are mixed in one untyped store; in-place mutation skips updates.
- Subscribing to the whole store re-renders every component on any change, and cached orders go stale.

## Best Practice (How to do it right)

### 1. React Native: TanStack Query for server state, a focused Zustand store with selectors
```typescript
export const useOrders = () => useQuery({ queryKey: ['orders'], queryFn: fetchOrders, staleTime: 60_000 })

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  })
}

type CartState = {
  lines: ReadonlyArray<CartLine>
  add: (line: CartLine) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(set => ({
  lines: [],
  add: line => set(s => ({ lines: [...s.lines, line] })),
  clear: () => set({ lines: [] }),
}))

// component subscribes only to what it renders
const count = useCartStore(s => s.lines.length)
```
### 2. Flutter: AsyncNotifier with select to limit rebuilds (Riverpod)
```dart
final cartProvider = NotifierProvider<CartNotifier, Cart>(CartNotifier.new);

class CartNotifier extends Notifier<Cart> {
  @override
  Cart build() => const Cart(lines: []);

  void add(CartLine line) => state = state.copyWith(lines: [...state.lines, line]);
  void clear() => state = const Cart(lines: []);
}

class CartBadge extends ConsumerWidget {
  const CartBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartProvider.select((cart) => cart.lines.length));   // rebuilds only when count changes
    return Badge(label: Text('$count'), child: const Icon(Icons.shopping_cart));
  }
}
```
**Why it's right:**
- Server data is cached and invalidated by a query layer; the cart store is small, typed, and immutable.
- Components and widgets subscribe to narrow slices, avoiding unnecessary re-renders and rebuilds.
- Tokens are not part of app state; they live in secure platform storage.
