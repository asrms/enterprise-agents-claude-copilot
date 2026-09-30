# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Untyped arrays and silent failures
```php
function calculateTotal($order) {                         // no types
    $total = 0;
    foreach ($order['lines'] as $line) {                 // array shape unknown to tools and readers
        $total += @$line['price'] * $line['qty'];        // error suppression hides missing keys
    }
    if ($order['status'] == 'paid') { /* ... */ }        // loose comparison, stringly typed status
    return $total;
}
```
**Why it's wrong:**
- Without types and shapes, static analysis cannot find mistakes, and `@` hides real errors.
- Loose comparison and string statuses allow subtle bugs.

## Best Practice (How to do it right)

### 1. Typed, immutable domain code
```php
<?php
declare(strict_types=1);

enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
}

final readonly class OrderLine
{
    public function __construct(public string $sku, public int $quantity, public int $unitPriceCents)
    {
        if ($quantity < 1) {
            throw new InvalidArgumentException('Quantity must be at least 1.');
        }
    }
}

final readonly class Order
{
    /** @param list<OrderLine> $lines */
    public function __construct(public OrderStatus $status, public array $lines) {}

    public function totalCents(): int
    {
        return array_sum(array_map(static fn (OrderLine $l): int => $l->quantity * $l->unitPriceCents, $this->lines));
    }
}
```
### 2. Tool configuration
`phpstan.neon`:
```yaml
includes:
    - vendor/larastan/larastan/extension.neon
    - phpstan-baseline.neon
parameters:
    level: 9
    paths: [app, database, routes]
    treatPhpDocTypesAsCertain: false
```
`rector.php`:
```php
return RectorConfig::configure()
    ->withPaths([__DIR__.'/app', __DIR__.'/tests'])
    ->withPhpSets(php83: true)
    ->withPreparedSets(deadCode: true, typeDeclarations: true, earlyReturn: true);
```
```bash
composer validate --strict && composer audit
vendor/bin/pint --test
vendor/bin/phpstan analyse --memory-limit=1G
vendor/bin/rector process --dry-run
```
**Why it's right:**
- Enums, readonly value objects, and list types make intent explicit and let tools verify it.
- Static analysis runs at a high level with a shrinking baseline, and Rector and Pint automate upgrades and style.
