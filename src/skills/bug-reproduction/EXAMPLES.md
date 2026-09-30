# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Vague report and a fix without reproduction
```text
Ticket: "Export broken!!!" (no steps, no version, screenshot cropped)
Developer: cannot reproduce locally with seed data; changes the CSV writer encoding "just in case"; closes ticket
Customer reopens: still broken for them
```
**Why it's wrong:**
- Without context and a reproduction, the change is a guess that may introduce new problems.
- The environment difference (real data) is never investigated.

## Best Practice (How to do it right)

### 1. Structured report and minimal reproduction
```text
Title:     CSV export of orders fails with 500 for tenants with names containing a comma
Version:   orders-api 7.3.2 (commit 4f2a9c1), tenant t-17 "Smith, Jones & Co"
Steps:     1. Log in as admin of t-17  2. Orders > Export > CSV  3. Choose September 2026
Expected:  CSV file downloads.   Actual: HTTP 500, trace id 7c1e0b2a9f
Logs:      CsvWriteException: unescaped delimiter in field "tenant_name" at row 1
Frequency: always for affected tenants; 4 tenants affected
```
```java
// Minimal failing test written before the fix
@Test
void exportsTenantNamesContainingDelimiters() {
    var tenant = TenantFixtures.withName("Smith, Jones & Co");
    var orders = List.of(OrderFixtures.paid(tenant, "SO-1001", "42.50"));

    String csv = new OrdersCsvExporter().export(tenant, orders);

    assertThat(csv.lines().skip(1).findFirst()).contains("\"Smith, Jones & Co\"");
}
```
### 2. Increasing the probability of an intermittent failure
```bash
# the test fails "sometimes" in CI: run it 200 times with random order and a recorded seed
for i in $(seq 1 200); do
  ./gradlew test --tests 'OrderAllocationTest' -Dtest.seed=$i -q || { echo "failed with seed $i"; break; }
done
```
**Why it's right:**
- The report gives version, scope, steps, evidence, and frequency; the minimal test reproduces the exact error before any fix.
- Intermittent failures are made reproducible by repetition with recorded seeds.
