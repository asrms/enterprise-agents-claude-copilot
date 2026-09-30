# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Architecture rules only on the wiki
```text
Confluence page "Architecture guidelines" (2022):
  - The domain layer must not depend on Spring or JPA.
  - Modules must not access each other's repositories.
  - No breaking changes in public APIs without a new version.
Reality (2025): 143 imports of org.springframework in domain packages, 27 cross-module repository
usages, and two production incidents caused by removed API fields.
```
**Why it's wrong:**
- Rules nobody checks decay silently; the violations are found only when they cause incidents.

## Best Practice (How to do it right)

### 1. Architecture rules enforced in the build
```java
// Java — ArchUnit (linked to ADR-0004 "Hexagonal architecture")
@AnalyzeClasses(packages = "com.acme.shop")
class ArchitectureTest {

    @ArchTest
    static final ArchRule domain_is_framework_free = FreezingArchRule.freeze(   // baseline for legacy violations
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat().resideInAnyPackage("org.springframework..", "jakarta.persistence.."));

    @ArchTest
    static final ArchRule no_cycles = slices().matching("com.acme.shop.(*)..").should().beFreeOfCycles();

    @ArchTest
    static final ArchRule adapters_do_not_depend_on_each_other =
        noClasses().that().resideInAPackage("..adapter.in..")
            .should().dependOnClassesThat().resideInAPackage("..adapter.out..");
}
```
```javascript
// TypeScript — .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'features-are-isolated', severity: 'error',
      comment: 'ADR-0009: features communicate via their public index.ts only',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/(?!$1)[^/]+/(?!index\\.ts$)' } },
  ],
};
```
```yaml
# CI — API compatibility and budgets
- run: oasdiff breaking api/openapi-main.yaml api/openapi.yaml --fail-on ERR
- run: buf breaking --against '.git#branch=main'
- run: k6 run --out json=perf.json perf/checkout.js   # thresholds: p(95)<300 fail the job
```
**Why it's right:**
- Each rule is executable, linked to its ADR, and fails the build with a clear message.
- Legacy violations are frozen so new ones are blocked while the baseline shrinks.
- API compatibility and performance budgets are checked continuously, not only in reviews.
