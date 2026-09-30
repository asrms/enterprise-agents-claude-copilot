# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Vague criteria and an imperative UI script
```text
Acceptance criteria:
- Returns should work correctly
- The page must be fast and user-friendly
```
```gherkin
Scenario: return
  Given I open "https://shop.example.com/login"
  And I type "alice@example.com" into "#email"
  And I click "#login-btn"
  And I click the third row in "#orders-table"
  And I click "Return"
  Then I see "OK"
```
**Why it's wrong:**
- The criteria cannot be verified, and the scenario couples the requirement to UI details that change often.
- It checks one happy path with meaningless assertions and ignores the business rules (time window, eligibility).

## Best Practice (How to do it right)

### 1. Example mapping output
```text
Story RET-12: request a return for one item
Rule 1: returns are allowed within 30 days of delivery
  - delivered 10 days ago -> allowed
  - delivered exactly 30 days ago -> allowed
  - delivered 31 days ago -> rejected with explanation
Rule 2: final-sale items cannot be returned
  - final-sale item -> rejected
Rule 3: an item can be returned only once
  - item already in an open return -> rejected
Question: do marketplace sellers use the same window? (owner: product, due Thursday)
```
### 2. Declarative Gherkin with an outline for boundaries
```gherkin
Feature: Request a return
  Customers can return eligible items from delivered orders without contacting support.

  Scenario Outline: Return window is enforced
    Given a customer with an order delivered <days> days ago
    When the customer requests a return for an item of that order
    Then the return request is <outcome>

    Examples:
      | days | outcome  |
      | 10   | accepted |
      | 30   | accepted |
      | 31   | rejected |

  Scenario: Final-sale items cannot be returned
    Given a customer with a delivered order containing a final-sale item
    When the customer requests a return for the final-sale item
    Then the return request is rejected
    And the customer is told that final-sale items are not returnable

  Scenario: An item cannot be returned twice
    Given an item that already has an open return request
    When the customer requests another return for the same item
    Then the return request is rejected
```
**Why it's right:**
- Rules and examples were agreed up front, including boundaries and an open question with an owner.
- Scenarios describe behavior in domain language, one behavior each, and can be automated at the API level.
