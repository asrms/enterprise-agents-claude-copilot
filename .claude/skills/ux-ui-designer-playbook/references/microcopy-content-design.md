# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Vague, blaming, concatenated copy
```text
Button:        SUBMIT
Dialog:        Are you sure?  [OK] [Cancel]
Error:         Invalid input! Error code RET_ERR_17.
Empty state:   No data
Notification:  "You have " + count + " return(s) pending"
Link:          Click here
```
**Why it's wrong:**
- Labels don't describe outcomes, the dialog doesn't say what will happen, and the error blames the user without a fix.
- Concatenated strings break translation and pluralization, and "Click here" is meaningless out of context.

## Best Practice (How to do it right)

### 1. Rewritten microcopy
```text
Button:        Request return
Dialog:        Cancel this return request?
               The item stays in your order and you can request a return again until 12 October.
               [Cancel request] [Keep request]
Error:         Choose why you're returning this item.
Empty state:   You have no returns yet.
               When you return an item, you can track it here.  [Go to your orders]
Link:          Read the return policy
```
### 2. ICU messages with context for translators
`messages/en.json`:
```json
{
  "returns.pending.count": "{count, plural, =0 {You have no pending returns} one {You have # pending return} other {You have # pending returns}}",
  "returns.window.deadline": "You can return this item until {deadline, date, long}.",
  "returns.reason.label": "Why are you returning this item?"
}
```
`messages/en.meta.json` (notes for translators):
```json
{
  "returns.pending.count": "Shown on the returns page header. count = number of return requests not yet refunded.",
  "returns.window.deadline": "deadline = last day of the 30-day return window, formatted in the user's locale."
}
```
**Why it's right:**
- Actions and dialogs name the outcome, errors say how to fix the problem, and empty states lead to the next step.
- Strings are complete, pluralized with ICU syntax, localized with date formatting, and documented for translators.
