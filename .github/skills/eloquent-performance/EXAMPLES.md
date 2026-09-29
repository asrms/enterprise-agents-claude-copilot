# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. N+1 queries, unbounded loads, raw interpolation
```php
public function index(Request $request)
{
    $orders = Order::whereRaw("status = '{$request->status}'")->get();   // SQL injection, unbounded
    return view('orders.index', compact('orders'));
}
```
```blade
@foreach ($orders as $order)
    {{ $order->customer->name }}                  {{-- 1 query per order --}}
    {{ $order->items->count() }} items            {{-- loads all items to count them --}}
@endforeach
```
**Why it's wrong:**
- User input is interpolated into SQL, and the query loads every matching order.
- The template triggers two extra queries per order and loads full item collections just to count them.

## Best Practice (How to do it right)

### 1. Strict mode, eager loading, aggregates, and cursor pagination
```php
// AppServiceProvider::boot()
Model::shouldBeStrict(! $this->app->isProduction());

public function index(IndexOrdersRequest $request): AnonymousResourceCollection
{
    $orders = Order::query()
        ->select(['id', 'public_id', 'customer_id', 'status', 'total', 'created_at'])
        ->where('status', $request->enum('status', OrderStatus::class))
        ->with(['customer:id,name'])
        ->withCount('items')
        ->orderByDesc('created_at')->orderByDesc('id')
        ->cursorPaginate(50);

    return OrderSummaryResource::collection($orders);
}
```
### 2. Bounded batch processing and atomic stock update
```php
Order::query()
    ->where('status', OrderStatus::Pending)
    ->where('created_at', '<', now()->subDays(7))
    ->chunkById(500, function (Collection $orders): void {
        $orders->each(fn (Order $order) => CancelStaleOrder::dispatch($order->id));
    });

$reserved = Product::whereKey($productId)
    ->where('stock', '>=', $quantity)
    ->decrement('stock', $quantity);          // atomic: returns 0 when not enough stock
```
```php
// migration: composite index matching the listing query
Schema::table('orders', function (Blueprint $table) {
    $table->index(['status', 'created_at', 'id']);
});
```
**Why it's right:**
- Strict mode catches lazy loading, the listing uses parameter binding, selected columns, one eager load, and an aggregate count.
- Large sets are processed in chunks, stock is updated atomically, and an index supports the query pattern.
