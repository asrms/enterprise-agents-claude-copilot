# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Refactoring without a safety net
```text
Legacy InvoiceCalculator.calculate(): 900 lines, static DB calls, no tests.
Developer "cleans it up" in one pull request (renames, extracted methods, new rounding helper).
Two weeks later: invoices for tax-exempt customers in two regions are off by a cent; nobody knows which change caused it.
```
**Why it's wrong:**
- Behavior changed unnoticed because nothing captured the original behavior before editing.

## Best Practice (How to do it right)

### 1. Seam for the database and clock, then golden master with combinations (Java, ApprovalTests)
```java
// Minimal, safe seam: dependencies passed in instead of static calls (IDE "introduce parameter" refactoring)
public class InvoiceCalculator {
    private final RateSource rates;
    private final Clock clock;
    public InvoiceCalculator(RateSource rates, Clock clock) { this.rates = rates; this.clock = clock; }
    public Invoice calculate(Order order) { /* unchanged legacy logic, now using rates and clock */ }
}
```
```java
class InvoiceCalculatorCharacterizationTest {
    private final InvoiceCalculator calculator = new InvoiceCalculator(
        new RecordedRateSource("src/test/resources/rates-2026-09.json"),
        Clock.fixed(Instant.parse("2026-09-29T10:00:00Z"), ZoneOffset.UTC));

    @Test
    void currentBehaviorForAllCombinations() {
        CombinationApprovals.verifyAllCombinations(
            (region, customerType, amount) -> calculator.calculate(OrderFixtures.of(region, customerType, amount)).summary(),
            new String[] { "IT", "DE", "FR", "US-CA" },
            new String[] { "RETAIL", "BUSINESS", "TAX_EXEMPT" },
            new String[] { "0.01", "19.99", "100.00", "9999.995" });
    }
}
```
```text
InvoiceCalculatorCharacterizationTest.currentBehaviorForAllCombinations.approved.txt (excerpt)
[IT, TAX_EXEMPT, 19.99] => net=19.99 tax=0.00 total=19.99
[US-CA, RETAIL, 9999.995] => net=9999.99 tax=724.99 total=10724.98   <- note: rounds half-down (suspicious, see ticket INV-121)
```
**Why it's right:**
- A small, automated refactoring creates seams; recorded data and a fixed clock make results deterministic.
- 48 combinations capture current behavior before any change, and a suspicious rounding is recorded for an explicit decision instead of being "fixed" silently.
