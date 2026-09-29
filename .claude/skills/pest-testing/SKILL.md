---
name: pest-testing
description: "Testing PHP and Laravel applications with Pest (or PHPUnit): feature tests for HTTP endpoints, unit tests for actions and domain logic, datasets, expectations API, architecture tests, database testing with RefreshDatabase and factories, fakes for mail, queues, events, storage, and HTTP, time travel, parallel testing, mutation testing, and coverage. Use it when writing or reviewing tests for PHP or Laravel code."
---

# Skill: Pest Testing

## Implementation Rules:
- **[ARCHITECTURE]** Use Pest (built on PHPUnit) for new Laravel projects with a clear split: `tests/Unit` for pure logic without the framework or database, `tests/Feature` for HTTP endpoints, jobs, and commands through the framework.
- **[MANDATORY]** Feature tests exercise real routes, middleware, validation, and authorization (`$this->actingAs($user)->postJson(...)`), asserting status codes, JSON structure and values (`assertJsonPath`, `assertJson`), and database state (`assertDatabaseHas`, `assertModelExists`).
- **[PATTERN]** Build test data with model factories and states (`Order::factory()->paid()->for($customer)->create()`), keeping only the attributes relevant to the test explicit.
- **[PATTERN]** Use datasets (`->with([...])`) for input variations such as validation rules and boundary values, with named cases for readable output.
- **[MANDATORY]** Isolate external effects with Laravel fakes: `Mail::fake()`, `Queue::fake()`, `Bus::fake()`, `Event::fake()` (scoped to specific events when listeners are part of the behavior), `Storage::fake()`, `Notification::fake()`, and `Http::fake()` with `Http::preventStrayRequests()`.
- **[PATTERN]** Control time with `$this->travelTo()` / `travel()` or `Carbon::setTestNow()`, and randomness with seeded factories or injected generators.
- **[PATTERN]** Enforce architecture with Pest arch tests: presets (`arch()->preset()->laravel()`, `->security()`), and custom rules such as `arch('controllers')->expect('App\Http\Controllers')->not->toUse('Illuminate\Support\Facades\DB')`.
- **[FORBIDDEN]** Tests that hit real third-party APIs, share state through static properties, depend on execution order, assert only `assertOk()` without checking content, or use SQLite in-memory when production behavior depends on the real database engine's features.
- **[PATTERN]** Use `RefreshDatabase` (transactions) for speed, or `DatabaseMigrations`/`LazilyRefreshDatabase` as needed, and run tests against the same database engine as production (for example MySQL or PostgreSQL in Docker) in CI.
- **[PERFORMANCE]** Keep the suite fast: `php artisan test --parallel` or `pest --parallel`, lightweight factories, and unit tests without booting the framework where possible.
- **[TESTING]** CI runs Pest with coverage (`--coverage --min=80` on critical code) and periodically mutation testing (`pest --mutate` or Infection) to verify tests catch real faults.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
