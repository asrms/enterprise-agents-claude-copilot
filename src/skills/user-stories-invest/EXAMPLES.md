# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Horizontal, solution-first, untestable items
```text
STORY-101: Create "returns" table in PostgreSQL
STORY-102: Build REST endpoint POST /returns
STORY-103: As a user I want a returns module so that returns work
STORY-104: Returns: implement everything (labels, refunds, exchanges, fraud checks, emails)   -- 40 points
```
**Why it's wrong:**
- The first two items deliver no user value on their own and cannot be demonstrated to a stakeholder.
- "As a user ... so that returns work" has no real role, need, or testable outcome.
- The last item is an epic disguised as a story, impossible to estimate or finish in one iteration.

## Best Practice (How to do it right)

### 1. Story map slice and vertically split stories
```text
Epic: Customers can return items without contacting support (goal: -30% return-related support tickets)

Backbone:   Request return  ->  Ship item back  ->  Get refund
Release 1:  Request return for a delivered order (single item, full refund)
            Print prepaid return label
            Refund to original payment method after warehouse check-in
Release 2:  Multiple items per return; partial refunds for damaged items; exchange instead of refund
```
```text
RET-12  As a customer with a delivered order,
        I want to request a return for one item from my order history,
        so that I can get my money back without calling support.

        Acceptance criteria: see Gherkin scenarios (eligible item, outside 30-day window, already returned item)
        Constraints: WCAG 2.2 AA; return request stored with an audit entry
        Size: 3 points  | Links: epic RET-1, metric "support tickets per 1,000 orders"

RET-13  As a customer who requested a return,
        I want to download a prepaid return label,
        so that I can ship the item without paying postage.

SPIKE-4 (2 days): Can the carrier API generate labels synchronously under 2 s? Output: decision + ADR.
```
**Why it's right:**
- Each story is a thin vertical slice with a real role, a need, and a measurable benefit, linked to an outcome metric.
- The first release is a complete end-to-end journey; complexity is deferred to later slices.
- Uncertainty is handled by a time-boxed spike with a defined output.
