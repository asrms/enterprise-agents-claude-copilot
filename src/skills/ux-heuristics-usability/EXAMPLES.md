# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Checkout form with poor feedback
```text
- "Submit" button disabled until all fields are valid; no indication of which field is wrong
- On server error: red banner "Error 422"
- Coupon field clears the whole form when the code is invalid
- Order total updates silently after changing shipping; no loading indicator
- Leaving the page loses all entered data without warning
```
**Why it's wrong:**
- Users cannot see what is wrong or how to fix it (heuristics 1, 9) and lose work (heuristics 3, 5).
- Hidden updates and codes instead of explanations erode trust and increase abandonment.

## Best Practice (How to do it right)

### 1. Heuristic evaluation findings with severity
```text
| ID  | Heuristic                      | Location          | Issue                                                    | Severity | Recommendation                                                    |
|-----|--------------------------------|-------------------|----------------------------------------------------------|----------|-------------------------------------------------------------------|
| H1  | 9 Recognize and recover errors | Checkout > submit | "Error 422" gives no cause or fix                         | 4        | Field-level messages: "Enter a postal code with 5 digits"         |
| H2  | 5 Error prevention             | Coupon field      | Invalid coupon clears the form                            | 3        | Validate coupon separately; keep form data                        |
| H3  | 1 Visibility of system status  | Order summary     | Total changes without feedback                            | 2        | Show updating state and announce new total (live region)          |
| H4  | 3 User control and freedom     | Checkout page     | Navigating away loses data                                | 3        | Persist draft; confirm before leaving with unsaved changes        |
| H5  | 4 Consistency and standards    | Buttons           | Primary action on the left on some steps, right on others | 1        | Consistent primary action placement per design system             |
```
### 2. Error message pattern
```text
Before: Error 422
After:  We couldn't place your order. The postal code "2010" is too short. Enter a 5-digit postal code.
        [focus moves to the postal code field, which is marked invalid and described by this message]
```
**Why it's right:**
- Issues are tied to specific heuristics and locations, rated by severity, and paired with actionable recommendations.
- Error messages explain what happened, why, and how to fix it, and move users to the place where they can act.
