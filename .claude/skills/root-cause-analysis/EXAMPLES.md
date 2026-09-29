# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Symptom patching
```text
Bug: some invoices show a total of 0.00
Changes made at once: added retry around the pricing call, increased timeouts to 60 s,
wrapped calculation in try/catch that returns the previous total on error, restarted the service
Result: fewer zero totals, but some invoices now show stale totals; ticket closed "fixed"
```
**Why it's wrong:**
- Multiple changes without a hypothesis make it impossible to know what helped, and the catch block hides the real error.
- The underlying cause remains and now produces silently wrong data.

## Best Practice (How to do it right)

### 1. Hypothesis-driven investigation log
```text
Symptom:  0.4% of invoices since 2026-09-24 have total 0.00; only EUR tenants; only invoices with discounts.
Not affected: USD tenants, invoices without discounts, invoices created before 2026-09-24.
Recent changes: release 7.3.0 on 2026-09-24 (discount engine refactoring), dependency bump of the money library.

H1: Pricing service times out and a default of 0 is used.
    Prediction: timeouts in logs for affected invoices.  Result: no timeouts; refuted.
H2: Rounding of discounted totals changed with the money library update.
    Prediction: unit test with a 3-decimal discount reproduces 0.00.  Result: reproduced; discount rate parsed as 0.1500
    -> new library interprets scale differently and multiplies by 0 when the rate has 4 decimals; confirmed.

Five whys:
  Why 0.00? Discount multiplier computed as 0.                     Why? Rate parsed with the new scale semantics.
  Why not caught? No test with 4-decimal rates; contract of the library change not reviewed.
  Why not detected in production quickly? No alert on invoices with zero totals.

Root cause: breaking change in money library 5.0 rate parsing, used without an adapter test.
Fix: parse rates with an explicit scale via our adapter; regression test with 2-, 3-, and 4-decimal rates.
Follow-ups: alert on zero-total invoices (DATA-91); require changelog review for major dependency updates (ENG-33);
            reprocess 312 affected invoices (FIN-12).
```
**Why it's right:**
- The symptom is scoped precisely, hypotheses are tested one at a time with predictions, and evidence confirms the cause.
- The fix addresses the origin, a regression test is added, and systemic factors become owned follow-up actions.
