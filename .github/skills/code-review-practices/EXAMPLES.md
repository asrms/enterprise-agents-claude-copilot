# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Review comments without severity, evidence, or proposal
```markdown
> src/orders/OrderService.java:88
this looks wrong

> src/orders/OrderService.java:120
why not use streams here?

> src/orders/OrderRepository.java:45
I don't like this name

> src/orders/OrderService.java:131
also add some tests maybe

Approved ✅ LGTM
```
**Why it's wrong:**
- "This looks wrong" gives the author nothing to act on: no input, no expected behavior, no proposal.
- Taste questions (streams, names) are mixed with a possible bug with no indication of which one blocks the merge.
- The approval arrives together with an open doubt about correctness and a vague request for tests.

### 2. Reviewing a mixed, oversized pull request
```text
PR #512 "Order improvements" — 47 files changed, +2,318 −1,904

- reformat whole module with the new formatter settings
- rename OrderDto -> OrderResponse in 31 files
- move pricing logic from controller to PricingService
- change discount rounding from HALF_UP to HALF_EVEN
- bump spring-boot 3.2.5 -> 3.3.4
- add new endpoint POST /orders/{id}/refund

Reviewer: "Skimmed it, CI is green, approving."
```
**Why it's wrong:**
- The rounding change (a money-affecting behavior change) is buried in thousands of lines of formatting and renames and cannot be reviewed.
- A framework upgrade and a new endpoint have different risks and rollback plans but ship as a single unit.
- "CI is green" only proves the existing tests pass; nobody verified the new behavior.

### 3. Style debates that a tool should settle
```markdown
> api/handlers/user.go:14
nit: please put the brace on the same line

> api/handlers/user.go:22
we use tabs, not spaces

> api/handlers/user.go:31
import order: stdlib first

> api/handlers/user.go:57
err is shadowed here and the original error from db.Get is lost   ← only real issue, same weight as the others
```
**Why it's wrong:**
- Three comments are about formatting that `gofmt`/`goimports` fix automatically; they consume review time and author patience.
- The real defect (lost error) is drowned among nits and has the same visual weight.

## Best Practice (How to do it right)

### 1. Review comments without severity, evidence, or proposal
```markdown
> src/orders/OrderService.java:88
**blocker:** `applyDiscount` is called before `validateStock`, so an order for an out-of-stock
item still consumes the customer's one-time coupon (`coupon.markUsed()` at line 92) and the
exception at line 101 does not roll it back because the coupon service is called over HTTP.
Repro: `OrderServiceTest` with `stock=0` and a single-use coupon → coupon status `USED`.
Proposal: validate stock first, and mark the coupon as used only after the order is persisted
(or through the outbox, like the other side effects in this service).

> src/orders/OrderService.java:120
**nit:** a `stream().filter().toList()` would be shorter here; fine to keep the loop.

> src/orders/OrderService.java:131
**major:** the new `PARTIALLY_SHIPPED` branch has no test. Please add a case to
`OrderStatusTransitionTest` covering PARTIALLY_SHIPPED → SHIPPED and PARTIALLY_SHIPPED → CANCELLED.

> General
**praise:** nice extraction of `ShippingPolicy`, it makes the transition rules much easier to read.

Requesting changes: 1 blocker, 1 major. The nit is optional.
```
**Why it's right:**
- Each comment declares its severity, so the author knows what blocks the merge and what is optional.
- The blocker includes the exact line, a reproduction, the impact, and a concrete fix aligned with existing patterns.
- The decision (request changes) is explicit and summarizes what remains open; good work is acknowledged.

### 2. Reviewing a mixed, oversized pull request
```text
Reviewer comment on PR #512:

"Thanks — this contains four independent changes with different risk levels.
Could you split it into a stack so each one gets a proper review and its own rollback?

  1. #512a chore: apply formatter + rename OrderDto -> OrderResponse (mechanical, no behavior change)
  2. #512b build: bump spring-boot 3.2.5 -> 3.3.4 (link the release notes, run the full IT suite)
  3. #512c refactor: move pricing logic to PricingService (tests unchanged and green = proof of no behavior change)
  4. #512d feat: HALF_EVEN rounding + POST /orders/{id}/refund
       - needs product sign-off on the rounding change (it changes invoice totals)
       - add tests with the cases from the finance ticket FIN-231

I'll review 512a and 512b today; 512d deserves a 15-minute walkthrough."
```
**Why it's right:**
- Mechanical changes are isolated, so the reviewer can approve them quickly by checking the absence of behavior changes.
- The risky change (money rounding) is reviewed on its own, with the business owner and specific test cases.
- Each PR can be reverted independently, and the reviewer commits to a timeline.

### 3. Style debates that a tool should settle
```markdown
> api/handlers/user.go:57
**blocker:** `err` is redeclared with `:=` inside the `if`, so the error returned by `db.Get`
at line 52 is shadowed and the handler returns 200 with an empty user when the query fails.
Proposal:
    user, err := h.store.Get(ctx, id)
    if err != nil {
        return fmt.Errorf("get user %s: %w", id, err)
    }

> General
**minor:** formatting and import order differ from the rest of the repo. Instead of fixing
them by hand, let's enforce them: I opened #530 adding `gofmt`/`goimports` and `govet`
(shadow analyzer) to the CI lint job, which would have caught the shadowed error too.
```
**Why it's right:**
- The human review focuses on the real defect, with a precise explanation and a fix.
- Formatting is delegated to tools once and for all, including a linter that prevents this class of bug in the future.
