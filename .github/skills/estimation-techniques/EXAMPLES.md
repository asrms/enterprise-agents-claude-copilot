# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Single-point date built from summed guesses
```text
Manager: "How long for the returns platform?"
Lead (alone, in 5 minutes): 42 stories x 1.5 days = 63 days -> "Done on 15 December"
Date announced to customers; no integration, testing, or holiday time; no assumptions recorded
```
**Why it's wrong:**
- A single person's quick guess becomes a public commitment with no uncertainty range.
- Summing optimistic item estimates ignores variability, dependencies, and non-development work.

## Best Practice (How to do it right)

### 1. Monte Carlo forecast from historical throughput (Python)
```python
import numpy as np

weekly_throughput = [4, 6, 3, 5, 7, 4, 5, 2, 6, 5, 4, 6]   # items finished per week, last 12 weeks
remaining_items = 42
rng = np.random.default_rng(2026)

def weeks_to_finish() -> int:
    done, weeks = 0, 0
    while done < remaining_items:
        done += rng.choice(weekly_throughput)
        weeks += 1
    return weeks

simulations = np.array([weeks_to_finish() for _ in range(10_000)])
for p in (50, 85, 95):
    print(f"{p}% confidence: {int(np.percentile(simulations, p))} weeks")
```
```text
Output: 50% confidence: 9 weeks | 85% confidence: 10 weeks | 95% confidence: 11 weeks
Communicated: "With the current scope and team, 85% likely by the week of 8 December.
Assumptions: scope stays at 42 items (+/- 10%), carrier API ready by week 3. We re-forecast every Friday."
```
### 2. Three-point estimate for an unfamiliar integration
```text
Carrier label integration: optimistic 5 days, most likely 8 days, pessimistic 18 days
PERT expected = (5 + 4x8 + 18) / 6 = 9.2 days; standard deviation = (18 - 5) / 6 = 2.2 days
Decision: run a 2-day spike first to reduce the pessimistic case.
```
**Why it's right:**
- The forecast comes from the team's real delivery data and is expressed as probabilities with explicit assumptions.
- High uncertainty is quantified and reduced with a spike before committing.
