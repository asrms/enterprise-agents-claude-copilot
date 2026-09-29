# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. 100% line coverage with tests that cannot fail (TypeScript)
```typescript
export function discountFor(total: number): number {
  if (total >= 100) return 0.1;
  return 0;
}

it('computes discount', () => {
  expect(discountFor(150)).toBeDefined();
  expect(discountFor(20)).toBeGreaterThanOrEqual(0);
});
```
```text
Stryker report:
  ConditionalExpression  total >= 100 → true          Survived
  EqualityOperator       total >= 100 → total > 100    Survived
  ArithmeticOperator/Literal 0.1 → 0                   Survived
Mutation score: 0%   (line coverage: 100%)
```
**Why it's wrong:**
- Every line runs, but the assertions accept almost any value, so mutants survive.
- The boundary at exactly 100 is never tested.

### 2. Excluding the hard parts to pass the threshold (Maven, PIT)
```xml
<configuration>
  <excludedClasses>
    <param>com.acme.pricing.*</param>          <!-- "too many survivors" -->
  </excludedClasses>
  <mutationThreshold>90</mutationThreshold>
</configuration>
```
**Why it's wrong:**
- The most critical code is excluded, so the 90% score is meaningless.

## Best Practice (How to do it right)

### 1. 100% line coverage with tests that cannot fail (TypeScript)
```typescript
describe('discountFor', () => {
  it.each([
    { total: 99.99, expected: 0 },
    { total: 100, expected: 0.1 },     // exact boundary kills >= → >
    { total: 250, expected: 0.1 },
  ])('returns $expected for total $total', ({ total, expected }) => {
    expect(discountFor(total)).toBe(expected);
  });
});
```
`stryker.config.json`:
```json
{
  "testRunner": "vitest",
  "mutate": ["src/domain/**/*.ts", "!src/**/*.test.ts"],
  "incremental": true,
  "thresholds": { "high": 85, "low": 70, "break": 70 }
}
```
**Why it's right:**
- Exact expected values and the boundary case kill the conditional, equality, and literal mutants.
- Mutation testing is scoped to domain code, incremental in PRs, and breaks the build below 70%.

### 2. Excluding the hard parts to pass the threshold (Maven, PIT)
```xml
<plugin>
  <groupId>org.pitest</groupId>
  <artifactId>pitest-maven</artifactId>
  <configuration>
    <targetClasses><param>com.acme.pricing.domain.*</param></targetClasses>
    <excludedMethods><param>toString</param><param>hashCode</param></excludedMethods>
    <avoidCallsTo><param>org.slf4j</param></avoidCallsTo>     <!-- logging calls: equivalent mutants -->
    <mutationThreshold>75</mutationThreshold>
    <withHistory>true</withHistory>                           <!-- incremental runs -->
    <outputFormats><param>HTML</param><param>XML</param></outputFormats>
  </configuration>
  <dependencies>
    <dependency>
      <groupId>org.pitest</groupId>
      <artifactId>pitest-junit5-plugin</artifactId>
      <version>${pitest-junit5.version}</version>
    </dependency>
  </dependencies>
</plugin>
```
**Why it's right:**
- The critical package is the target; only generated methods and logging calls (typical equivalent mutants) are excluded, with a reason.
- A realistic threshold is enforced and incremental history keeps PR runs fast.
