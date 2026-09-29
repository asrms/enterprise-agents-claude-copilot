# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Missing object authorization, raw SQL, unescaped output
```php
Route::get('/invoices/{id}', function ($id) {
    $invoice = DB::select("SELECT * FROM invoices WHERE id = $id")[0];     // SQL injection, any user's invoice
    return view('invoice', ['invoice' => $invoice]);
})->middleware('auth');
```
```blade
<p>Notes: {!! $invoice->notes !!}</p>            {{-- stored XSS from customer-entered notes --}}
<script>var customer = "{{ $invoice->customer_name }}";</script>   {{-- wrong context escaping --}}
```
**Why it's wrong:**
- Authentication is checked but ownership is not, and the id is interpolated into SQL.
- User content is rendered unescaped, and HTML escaping is used inside a JavaScript string context.

## Best Practice (How to do it right)

### 1. Policy-based authorization, route model binding, and safe output
```php
final class InvoicePolicy
{
    public function view(User $user, Invoice $invoice): bool
    {
        return $invoice->tenant_id === $user->tenant_id
            && ($user->hasRole('accountant') || $invoice->customer_id === $user->customer_id);
    }
}

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::get('/invoices/{invoice:public_id}', [InvoiceController::class, 'show'])->can('view', 'invoice');
});
```
```blade
<p>Notes: {{ $invoice->notes }}</p>
<script>const customer = @js($invoice->customer_name);</script>
```
### 2. Rate limiting and secure configuration
```php
// AppServiceProvider::boot()
RateLimiter::for('login', fn (Request $request) => [
    Limit::perMinute(5)->by(Str::lower($request->input('email')).'|'.$request->ip()),
]);
```
```dotenv
APP_ENV=production
APP_DEBUG=false
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
# APP_KEY and APP_PREVIOUS_KEYS injected from the secret manager at deploy time
```
**Why it's right:**
- Route model binding with a public id plus a policy ensures users only see invoices they are allowed to see.
- Output is escaped for each context, login attempts are rate limited, and production configuration disables debug output and secures cookies.
