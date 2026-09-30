# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Fat controller with mass assignment and raw model output
```php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->all());                    // mass assignment of any field (status, total, user_id)
        foreach ($request->items as $item) {
            $order->items()->create($item);
        }
        Mail::to($order->user)->send(new OrderPlaced($order));      // sent even if later steps fail
        if (env('APP_ENV') === 'production') { /* ... */ }            // env() outside config
        return $order;                                              // model with every column returned
    }
}
```
**Why it's wrong:**
- Unvalidated input is written straight into the model, and the response exposes internal fields.
- Business logic, persistence, and side effects are tangled in the controller and not transactional.

## Best Practice (How to do it right)

### 1. Form request, action, event after commit, and API resource
```php
<?php
declare(strict_types=1);

final class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()->can('create', Order::class); }

    public function rules(): array
    {
        return [
            'items'            => ['required', 'array', 'min:1', 'max:50'],
            'items.*.sku'      => ['required', 'string', 'max:64', 'exists:products,sku'],
            'items.*.quantity' => ['required', 'integer', 'between:1,100'],
        ];
    }
}

final class PlaceOrder
{
    public function __construct(private readonly PriceCatalog $prices) {}

    public function handle(User $customer, array $items): Order
    {
        return DB::transaction(function () use ($customer, $items): Order {
            $order = $customer->orders()->create(['status' => OrderStatus::Pending]);
            foreach ($items as $item) {
                $order->items()->create([
                    'sku' => $item['sku'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $this->prices->priceFor($item['sku']),   // price from the server, not the client
                ]);
            }
            OrderPlaced::dispatch($order);                                     // listener implements ShouldDispatchAfterCommit
            return $order;
        });
    }
}

final class OrderController extends Controller
{
    public function store(StoreOrderRequest $request, PlaceOrder $placeOrder): OrderResource
    {
        $order = $placeOrder->handle($request->user(), $request->validated('items'));
        return new OrderResource($order->load('items'));
    }
}

final class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->public_id,
            'status' => $this->status->value,
            'total' => $this->total->formatted(),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
        ];
    }
}
```
**Why it's right:**
- Validation and authorization live in the form request, business logic in a testable action inside a transaction.
- Side effects run after commit via events, and the resource exposes only chosen fields.
