# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Commented-out code and removal by assumption
```java
// public ReportResult legacyExport(...) {      // "maybe we need it again"  (400 lines commented since 2022)
// ...
// }

// Deleted YearEndCloseJob because "nobody calls it" (no references in code; triggered by an external scheduler once a year)
```
**Why it's wrong:**
- Commented code clutters the codebase while history already preserves it.
- Code invoked externally or periodically was removed without runtime evidence, breaking the year-end process.

## Best Practice (How to do it right)

### 1. Evidence-based removal record
```text
Candidate: GET /v1/reports/legacy-export and LegacyExportService
Static:    no references outside the controller (IntelliJ inspection, knip for the web client)
Runtime:   0 requests in 400 days of access logs (covers two year-end periods)
Consumers: not in API catalog for external partners; deprecation header sent since 2026-03-01 (Sunset: 2026-09-01)
Also remove: ReportFormatV1 serializer, config property reports.legacy.enabled, table legacy_export_jobs (expand/contract), dashboard panel
PR:        #1431 (deletion only, no behavior change); rollback: revert PR
```
### 2. Static analysis in CI (TypeScript, knip)
`knip.json`:
```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.ts", "src/workers/*.ts"],
  "project": ["src/**/*.ts"],
  "ignoreDependencies": ["@types/node"]
}
```
```bash
npx knip --reporter compact      # fails CI on unused files, exports, and dependencies
```
### 3. Removing a stale feature flag
```diff
- if (flags.isEnabled("checkout-v2-enabled", ctx)) {
-     return checkoutV2.place(order);
- }
- return checkoutV1.place(order);
+ return checkout.place(order);     // v2 at 100% since 2026-06; CheckoutV1 and the flag definition deleted
```
**Why it's right:**
- Removal is based on static and runtime evidence spanning periodic usage, with deprecation for any external consumers.
- Related configuration, data, and dashboards are cleaned up in a focused, revertible pull request, and CI prevents new unused code.
