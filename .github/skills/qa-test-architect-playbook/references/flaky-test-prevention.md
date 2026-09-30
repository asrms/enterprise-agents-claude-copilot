# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Sleeping for an asynchronous effect (Java)
```java
@Test
void publishesEventAfterOrderConfirmed() throws Exception {
    orderService.confirm(orderId);
    Thread.sleep(2000);                       // "the consumer needs time"
    assertThat(eventStore.findByOrderId(orderId)).hasSize(1);
}
```
**Why it's wrong:**
- On a loaded CI agent 2 seconds may not be enough (random failure); on a fast machine it wastes 2 seconds every run.
- Raising the sleep to 5 seconds only moves the problem and slows the suite further.

### 2. Hidden dependencies on time zone and order (Python)
```python
_cache = {}

def test_report_date():
    assert format_report_date(datetime(2024, 3, 31, 23, 30)) == "2024-03-31"   # fails when TZ is not UTC

def test_cached_price():
    _cache["SKU-1"] = 10                                                          # leaks into other tests
    assert price("SKU-1") == 10
```
**Why it's wrong:**
- The first test passes on the developer machine and fails on a CI agent in a different time zone.
- The module-level cache is shared state: tests pass or fail depending on execution order.

### 3. Retries hiding the problem
```typescript
// playwright.config.ts
export default defineConfig({ retries: 5, timeout: 120_000 });
```
**Why it's wrong:**
- A test failing 4 times out of 5 is reported as passed; real race conditions in the product are hidden too.

## Best Practice (How to do it right)

### 1. Sleeping for an asynchronous effect (Java)
```java
@Test
void publishesEventAfterOrderConfirmed() {
    orderService.confirm(orderId);

    await().atMost(Duration.ofSeconds(10))
           .pollInterval(Duration.ofMillis(50))
           .untilAsserted(() -> assertThat(eventStore.findByOrderId(orderId)).hasSize(1));
}
```
**Why it's right:**
- The assertion succeeds as soon as the event appears (usually in milliseconds) and fails with a clear message only after a generous upper bound.

### 2. Hidden dependencies on time zone and order (Python)
```python
def test_report_date_uses_business_time_zone():
    utc_instant = datetime(2024, 3, 31, 22, 30, tzinfo=timezone.utc)   # 00:30 in Rome (CEST)
    assert format_report_date(utc_instant, tz=ZoneInfo("Europe/Rome")) == "2024-04-01"


@pytest.fixture(autouse=True)
def clear_price_cache():
    price_cache.clear()
    yield
    price_cache.clear()
```
```ini
# pytest.ini
# pytest-randomly shuffles the order and reseeds random on each run;
# pytest-env forces the same time zone everywhere
[pytest]
addopts = -p randomly
env =
    TZ=UTC
```
**Why it's right:**
- Time zones are explicit in the code and in the test, including the DST boundary case.
- Shared state is reset around every test, and random ordering in CI detects new order dependencies early.

### 3. Retries hiding the problem
```typescript
// playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 1 : 0,           // one retry to collect a trace, not to hide failures
  reporter: [['html'], ['json', { outputFile: 'results.json' }]],
});
```
```bash
# CI step: fail the job summary if any test was flaky, and open/update a quarantine ticket
jq -r '.. | objects | select(.status? == "flaky") | .title' results.json > flaky.txt
if [ -s flaky.txt ]; then ./scripts/report-flaky.sh flaky.txt; fi

# before closing a flaky-test ticket
npx playwright test e2e/checkout.spec.ts --repeat-each=50 --workers=8
```
**Why it's right:**
- A single retry exists only to capture a trace; tests that pass on retry are reported as flaky and tracked.
- The fix is verified with many repetitions under parallel load before the ticket is closed.
