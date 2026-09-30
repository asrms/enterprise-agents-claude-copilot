# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Personal, vague, and sarcastic comments
```markdown
> payments/refund.py:42
Why would you ever do it like this??

> payments/refund.py:58
Obviously this should be a dataclass.

> payments/refund.py:77
Did you even run the tests?
```
**Why it's wrong:**
- The comments target the author, not the code, and create defensiveness instead of improvements.
- None of them says what is wrong, why it matters, or what to do instead.
- There is no indication of which comments block the merge.

### 2. Endless written back-and-forth on a design disagreement
```markdown
Reviewer: I think the cache should be per-tenant.
Author:   Per-tenant is overkill, a global cache is fine.
Reviewer: No, per-tenant is safer.
Author:   I disagree.
Reviewer: Still think it should be per-tenant.
... (14 more comments over 5 days)
```
**Why it's wrong:**
- Neither side brings evidence (data volume, isolation requirements, memory usage).
- The discussion never escalates to a conversation or a decision maker, blocking the PR for days.
- The eventual decision is not recorded anywhere for future changes.

### 3. Exploit details in a public PR
```markdown
> api/files.ts:31
The path check can be bypassed with `..%2f..%2f..%2fetc%2fpasswd` — try
curl "https://prod.example.com/api/files?name=..%2f..%2fetc%2fshadow" — it works on production right now.
```
**Why it's wrong:**
- A working exploit against production is published in a public repository before the fix is deployed.

## Best Practice (How to do it right)

### 1. Personal, vague, and sarcastic comments
```markdown
> payments/refund.py:42
**issue (blocking):** the refund amount is compared as `float`, so `0.1 + 0.2 != 0.3` makes
a valid full refund fail with "amount exceeds payment". Could we use `Decimal` (or integer cents)
like `PaymentAmount` in `payments/money.py`?
~~~suggestion
    if Decimal(request.amount) > payment.refundable_amount:
~~~

> payments/refund.py:58
**nit (non-blocking):** a frozen dataclass would make `RefundResult` immutable and give us `__eq__`
for free. Happy to leave it as is.

> payments/refund.py:77
**question:** the CI log shows `test_partial_refund` as skipped — is that intentional?
If it's the flaky clock issue, `freezegun` is already used in `test_invoices.py`.

**praise:** the separation between `RefundPolicy` and the gateway adapter is really clean.
```
**Why it's right:**
- Each comment is labeled, targets the code, explains the consequence, and proposes a concrete change.
- The suggestion block lets the author apply the fix in one click; the question checks an assumption instead of accusing.

### 2. Endless written back-and-forth on a design disagreement
```markdown
Reviewer: **thought:** a global cache means tenant A's cold entries can evict tenant B's hot ones,
and a key bug would leak data across tenants. Do we know the per-tenant data volume?

Author:   Measured on staging: 1,200 tenants, p99 = 40 KB each, total ~48 MB. Isolation is enforced
          by the key prefix `tenant:{id}:` and covered by `test_cache_keys_are_tenant_scoped`.

Reviewer: Thanks, that addresses the leak risk. Remaining concern is eviction fairness —
          let's take 10 minutes with @tech-lead today instead of going back and forth.

(after the call)
Reviewer: **Decision:** global cache with tenant-prefixed keys and a per-tenant entry cap (500).
          Recorded in ADR-0019. Approving once the cap is added.
```
**Why it's right:**
- Arguments are backed by data and tests; the disagreement escalates quickly to a short conversation.
- The decision is written in the PR and in an ADR, so the next change does not reopen the debate.

### 3. Exploit details in a public PR
```markdown
> api/files.ts:31
**blocker (security):** the path check runs before URL decoding, so encoded traversal sequences
bypass it. Details and a reproduction are in the private security advisory GHSA-xxxx (maintainers only).
Suggested direction: decode first, then resolve the path and verify containment with
`path.relative(base, resolved)`.
```
**Why it's right:**
- The risk and the fix direction are clear to the author, while the exploit details stay in a private channel until the fix is released.
