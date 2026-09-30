# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Shallow assertions and real side effects
```php
test('order', function () {
    $user = User::first();                                    // depends on existing data
    $response = $this->post('/orders', ['items' => [['sku' => 'A', 'quantity' => 1]]]);
    $response->assertStatus(200);                             // no auth, wrong status expectation, no content checks
    // real confirmation email sent through the SMTP server configured in .env
});
```
**Why it's wrong:**
- The test depends on pre-existing data, checks only a status code, and sends real emails.
- It does not verify authorization, validation, or the resulting database state.

## Best Practice (How to do it right)

### 1. Feature tests with factories, fakes, and datasets
```php
use App\Mail\OrderConfirmation;
use App\Models\{Order, Product, User};

beforeEach(function () {
    Mail::fake();
    Http::preventStrayRequests();
    $this->customer = User::factory()->create();
    Product::factory()->create(['sku' => 'TRAIL-42', 'price' => 12_990]);
});

it('places an order and emails a confirmation', function () {
    $response = $this->actingAs($this->customer)
        ->postJson('/api/orders', ['items' => [['sku' => 'TRAIL-42', 'quantity' => 2]]]);

    $response->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.items.0.sku', 'TRAIL-42');

    expect(Order::where('customer_id', $this->customer->id)->sole()->total)->toBe(25_980);
    Mail::assertQueued(OrderConfirmation::class, fn ($mail) => $mail->hasTo($this->customer->email));
});

it('rejects invalid items', function (array $items, string $errorKey) {
    $this->actingAs($this->customer)
        ->postJson('/api/orders', ['items' => $items])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($errorKey);
})->with([
    'no items'         => [[], 'items'],
    'unknown sku'      => [[['sku' => 'NOPE', 'quantity' => 1]], 'items.0.sku'],
    'quantity too big' => [[['sku' => 'TRAIL-42', 'quantity' => 101]], 'items.0.quantity'],
]);

it('does not show other customers orders', function () {
    $order = Order::factory()->create();                     // belongs to another customer
    $this->actingAs($this->customer)->getJson("/api/orders/{$order->public_id}")->assertForbidden();
});
```
### 2. Architecture rules
```php
arch()->preset()->laravel();
arch()->preset()->security();

arch('controllers do not query the database directly')
    ->expect('App\Http\Controllers')
    ->not->toUse('Illuminate\Support\Facades\DB');
```
**Why it's right:**
- Tests create their own data, fake side effects, and assert status, JSON content, database state, and emails.
- Validation variations use a named dataset, authorization is tested, and architecture rules are enforced automatically.
