# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Mutable public state and effects used for derivation
```typescript
@Injectable({ providedIn: 'root' })
export class CartStore {
  items = signal<CartItem[]>([]);           // writable from any component
  total = signal(0);

  constructor() {
    effect(() => {                           // derivation through an effect
      this.total.set(this.items().reduce((s, i) => s + i.price * i.quantity, 0));
    });
  }

  add(item: CartItem) {
    this.items().push(item);                 // in-place mutation: consumers are not notified
  }
}
```
**Why it's wrong:**
- Any component can overwrite `items`; the in-place `push` keeps the same array reference, so nothing updates.
- `total` is duplicated state kept in sync by an effect, which runs asynchronously and can be observed stale.

## Best Practice (How to do it right)

### 1. Read-only signals, computed values, and a resource for loading
```typescript
@Injectable()
export class OrdersStore {
  private readonly api = inject(OrdersApi);
  private readonly _filter = signal<OrderFilter>({ status: 'ALL' });
  private readonly _page = signal(1);

  readonly filter = this._filter.asReadonly();

  readonly orders = resource({
    params: () => ({ filter: this._filter(), page: this._page() }),
    loader: ({ params, abortSignal }) => this.api.list(params.filter, params.page, abortSignal),
  });

  readonly visible = computed(() => this.orders.value()?.items ?? []);
  readonly isEmpty = computed(() => !this.orders.isLoading() && this.visible().length === 0);

  readonly selectedId = linkedSignal<OrderSummary[], string | null>({
    source: this.visible,
    computation: (items, previous) =>
      items.some(o => o.id === previous?.value) ? previous!.value : (items[0]?.id ?? null),
  });

  setStatus(status: OrderStatus | 'ALL') {
    this._filter.update(f => ({ ...f, status }));
    this._page.set(1);
  }
}
```
```html
@if (store.orders.isLoading()) {
  <app-spinner />
} @else if (store.orders.error()) {
  <app-error-banner message="Orders could not be loaded." />
} @else {
  @for (order of store.visible(); track order.id) {
    <app-order-row [order]="order" [selected]="order.id === store.selectedId()" />
  }
}
```
**Why it's right:**
- State is private and writable only through intent-revealing methods; consumers see read-only signals.
- Derived data uses `computed` and `linkedSignal`, so it is always consistent and synchronous.
- The resource reloads when its parameters change, cancels stale requests, and exposes loading and error state.
