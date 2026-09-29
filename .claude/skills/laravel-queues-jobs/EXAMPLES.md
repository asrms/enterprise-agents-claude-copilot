# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Non-idempotent job dispatched inside a transaction
```php
DB::transaction(function () use ($order) {
    $order->update(['status' => 'paid']);
    ChargeCustomer::dispatch($order);                  // may run before commit or even if the transaction rolls back
});

class ChargeCustomer implements ShouldQueue
{
    public $tries = 0;                                 // unlimited retries
    public function __construct(public Order $order) {}
    public function handle(PaymentGateway $gateway): void
    {
        $gateway->charge($this->order->customer, $this->order->total);   // charges again on every retry
    }
}
```
**Why it's wrong:**
- The job can run against uncommitted or rolled-back data.
- Retries charge the customer multiple times, and unlimited retries hammer a failing provider.

## Best Practice (How to do it right)

### 1. Idempotent job with explicit retry policy and middleware
```php
final class ChargeCustomer implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public int $maxExceptions = 3;
    public int $timeout = 30;                          // below the connection's retry_after
    public int $uniqueFor = 3600;

    public function __construct(public readonly int $orderId) {}

    public function uniqueId(): string { return (string) $this->orderId; }

    public function backoff(): array { return [10, 60, 300]; }

    public function middleware(): array
    {
        return [new ThrottlesExceptions(maxAttempts: 5, decaySeconds: 300), new RateLimited('payments')];
    }

    public function handle(PaymentGateway $gateway): void
    {
        $order = Order::findOrFail($this->orderId);
        if ($order->payment_status === PaymentStatus::Captured) {
            return;                                                    // already done: idempotent
        }
        $payment = $gateway->charge($order, idempotencyKey: "order-{$order->id}");
        $order->update(['payment_status' => PaymentStatus::Captured, 'payment_reference' => $payment->reference]);
    }

    public function failed(Throwable $e): void
    {
        Order::whereKey($this->orderId)->update(['payment_status' => PaymentStatus::Failed]);
        Log::error('Charging order failed permanently', ['order_id' => $this->orderId, 'exception' => $e::class]);
    }
}

DB::transaction(function () use ($order) {
    $order->update(['status' => OrderStatus::Confirmed]);
    ChargeCustomer::dispatch($order->id)->onQueue('payments')->afterCommit();
});
```
**Why it's right:**
- The job runs only after commit, is unique per order, checks state first, and uses an idempotency key with the gateway.
- Retries are bounded with backoff and throttling, and permanent failure updates state and logs without sensitive data.
