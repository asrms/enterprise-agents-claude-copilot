# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Holding a rewrite on a branch
```text
branch: rewrite-payment-provider      opened 2026-06-02, 146 commits, 9,800 lines changed
main:   keeps moving; weekly "sync merges" from main with conflicts
plan:   "merge when everything is done", then a 2-week code freeze to stabilize
```
**Why it's wrong:**
- Integration is postponed until the end, where conflicts and hidden incompatibilities are largest.
- The code freeze stops all delivery, and the big-bang switch has no gradual rollout or rollback path.

## Best Practice (How to do it right)

### 1. Branch by abstraction with daily merges
```text
Day 1  PR #501  introduce PaymentGateway interface; LegacyStripeGateway implements it (no behavior change)
Day 2  PR #507  route all call sites through PaymentGateway
Day 3+ PR #512.. build AdyenGateway behind the interface, unit and contract tests, not wired in production
Day 9  PR #530  selection by flag `payments-adyen-enabled` (default off), dark launch: authorize in sandbox in parallel, compare results
Day 12 rollout  internal tenants -> 5% -> 50% -> 100%, monitored on authorization rate and latency
Day 20 PR #551  remove flag and LegacyStripeGateway
```
```kotlin
interface PaymentGateway {
    suspend fun authorize(request: AuthorizationRequest): AuthorizationResult
}

class GatewaySelector(
    private val legacy: LegacyStripeGateway,
    private val adyen: AdyenGateway,
    private val flags: FeatureFlags,
) : PaymentGateway {
    override suspend fun authorize(request: AuthorizationRequest): AuthorizationResult =
        if (flags.isEnabled("payments-adyen-enabled", request.tenantId)) adyen.authorize(request)
        else legacy.authorize(request)
}
```
**Why it's right:**
- Every step is a small, reviewable pull request merged into `main` within a day, and `main` stays releasable.
- The new implementation ships dark, is enabled progressively by flag, and the old path is removed once the rollout completes.
