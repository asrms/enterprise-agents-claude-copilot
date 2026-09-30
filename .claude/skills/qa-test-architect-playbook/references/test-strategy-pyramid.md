# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. "Ice-cream cone" test portfolio
```text
Checkout service — current test portfolio
  Manual regression checklist ........ 420 steps, 3 testers × 4 days per release
  Selenium end-to-end tests .......... 310 tests, 2h40m, 18% fail randomly
  Integration tests .................. 12 (H2 in-memory DB)
  Unit tests ......................... 45
  Contract tests ..................... none (breaking API changes found in staging)
  Performance tests .................. "done once in 2022"
```
**Why it's wrong:**
- Most confidence comes from slow, flaky, expensive levels; feedback arrives days after the change.
- Business rules are only verified through the UI, so a failing test does not point to the cause.
- API compatibility and performance are not tested at all, so the most costly failures reach staging or production.

### 2. Everything tested at every level
```gherkin
# e2e/checkout.feature — 60 scenarios, all through the browser
Scenario: VAT 22% for Italian customers
Scenario: VAT 19% for German customers
Scenario: VAT reverse charge for EU businesses with a valid VAT id
Scenario: discount code rejected when expired
Scenario: discount code rejected when minimum amount not reached
... (55 more rule variations)
```
**Why it's wrong:**
- Tax and discount rules are pure calculations that a unit test verifies in milliseconds; running them through the browser costs minutes each.
- When the UI changes, 60 scenarios break for reasons unrelated to the rules they are meant to check.

## Best Practice (How to do it right)

### 1. "Ice-cream cone" test portfolio
```markdown
# Checkout service — testing strategy (v2)

| Risk                                   | Level                  | Tool                          | Trigger          |
|----------------------------------------|------------------------|-------------------------------|------------------|
| Price, VAT, discount rules             | Unit (table-driven)    | JUnit 5 + AssertJ             | every commit     |
| SQL, JSON mapping, Spring config       | Integration            | Testcontainers (PostgreSQL)   | every PR         |
| API compatibility with web/mobile apps | Consumer contracts     | Pact + Pact Broker            | every PR + can-i-deploy |
| Payment provider integration           | Integration (stubbed)  | WireMock with recorded cases  | every PR         |
| Critical journeys (buy, refund)        | End-to-end smoke (8)   | Playwright                    | every deploy     |
| Peak traffic (Black Friday)            | Load                   | k6, 3× last peak              | nightly + pre-release |
| Accessibility of checkout pages        | Automated + manual     | axe + NVDA session            | every PR / release |
| Unknown unknowns                       | Exploratory (charters) | 2 × 90-minute sessions        | each release     |

Exit criteria: all suites green, no open critical defects, p95 < 300 ms at 3× peak,
no new axe violations. Manual regression checklist retired; findings from exploratory sessions
become automated tests.
```
**Why it's right:**
- Each risk is mapped to the cheapest level that detects it, with a tool and a trigger.
- Non-functional risks (compatibility, load, accessibility) are explicitly covered.
- Manual effort moves from repetitive regression to exploration, which finds new problems.

### 2. Everything tested at every level
```java
@ParameterizedTest(name = "{0} customer, vatId={1} → rate {2}")
@CsvSource({
    "IT, ,             0.22",
    "DE, ,             0.19",
    "DE, DE123456789,  0.00",   // EU B2B reverse charge
    "US, ,             0.00",
})
void vatRate(String country, String vatId, BigDecimal expected) {
    assertThat(vatPolicy.rateFor(new Customer(country, vatId))).isEqualByComparingTo(expected);
}
```
```gherkin
# e2e/checkout.feature — one journey per critical path
Scenario: Italian customer buys two items and receives an invoice with VAT
  Given a signed-in Italian customer with a saved card
  When they buy two items and confirm the order
  Then the confirmation page shows the total including VAT
  And an invoice PDF is available in "My orders"
```
**Why it's right:**
- The rule variations run as fast unit tests; the end-to-end test checks only that the pieces work together for one representative journey.
- A UI change breaks one scenario, and a rule change breaks the specific unit case that documents it.
