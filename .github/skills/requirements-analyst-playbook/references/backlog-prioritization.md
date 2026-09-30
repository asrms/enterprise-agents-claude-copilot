# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Priority by volume
```text
Backlog (412 items), 187 labelled "HIGH", 95 labelled "URGENT"
Next sprint chosen by: the VP who asked last, plus the bug with the angriest customer email
Technical debt and postmortem actions: "when we have time"
```
**Why it's wrong:**
- Labels no longer distinguish anything, and decisions depend on who asks rather than on value.
- Reliability and debt work is never scheduled, so incidents repeat.

## Best Practice (How to do it right)

### 1. WSJF scoring with constraints and reserved capacity
```text
Scale: modified Fibonacci (1, 2, 3, 5, 8, 13, 20) relative to the other items

| Item                              | User/business value | Time criticality | Risk reduction / opportunity | Cost of Delay | Job size | WSJF |
|-----------------------------------|---------------------|------------------|------------------------------|---------------|----------|------|
| Self-service returns (release 1)  | 13                  | 8                | 5                            | 26            | 8        | 3.3  |
| Saved payment methods             | 8                   | 3                | 3                            | 14            | 5        | 2.8  |
| Export orders as CSV              | 3                   | 2                | 1                            | 6             | 2        | 3.0  |
| Loyalty points redesign           | 13                  | 2                | 3                            | 18            | 20       | 0.9  |

Constraints (scheduled regardless of score):
- Upgrade payment SDK before provider deprecation on 2026-12-01 (contractual)
- Fix CVE in image processing library (P1, SLA 15 days)

Capacity per sprint: 70% ranked product work, 20% reliability and debt, 10% unplanned
```
### 2. Outcome roadmap
```text
NOW    Reduce support tickets about returns by 30%  -> self-service returns R1, return status notifications
NEXT   Increase repeat purchase rate by 5%          -> saved payment methods, reorder from history
LATER  Explore loyalty program redesign             -> discovery interviews and prototype first (confidence: low)
```
**Why it's right:**
- Scores are relative, visible, and consistent; hard constraints are explicit rather than hidden in scores.
- Capacity for reliability and debt is reserved, and the roadmap communicates outcomes and confidence instead of promising dates for everything.
