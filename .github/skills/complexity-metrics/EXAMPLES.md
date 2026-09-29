# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Deeply nested function with high cognitive complexity (Go)
```go
func ShippingFee(o Order) (int, error) {
	if o.Country != "" {
		if o.Country == "IT" {
			if o.Total < 5000 {
				if o.Express {
					return 990, nil
				} else {
					return 490, nil
				}
			} else {
				if o.Express {
					return 500, nil
				}
				return 0, nil
			}
		} else if o.Country == "DE" || o.Country == "FR" {
			if o.Express {
				return 1490, nil
			}
			return 890, nil
		} else {
			return 0, errors.New("unsupported")
		}
	}
	return 0, errors.New("missing country")
}
```
**Why it's wrong:**
- Four levels of nesting and repeated `Express` checks give a cognitive complexity well above 15.
- Business rules (thresholds, fees per country) are buried in control flow and cannot be changed without touching code paths.

### 2. Gaming the quality gate
```yaml
# sonar-project.properties
sonar.exclusions=src/pricing/**,src/legacy/**      # "too complex, excluded"
sonar.coverage.exclusions=**/*Service.java
```
```typescript
// eslint-disable-next-line sonarjs/cognitive-complexity
export function computeInvoice(/* 180 lines */) { /* ... */ }
```
**Why it's wrong:**
- The most important and most complex code is removed from analysis, so the dashboard shows "A" while risk grows.
- Suppressions without justification or ticket hide debt permanently.

## Best Practice (How to do it right)

### 1. Deeply nested function with high cognitive complexity (Go)
```go
type feeRule struct {
	freeThresholdCents int  // 0 = no free shipping
	standardCents      int
	expressCents       int
	expressOverFreeCents int
}

var feeRules = map[string]feeRule{
	"IT": {freeThresholdCents: 5000, standardCents: 490, expressCents: 990, expressOverFreeCents: 500},
	"DE": {standardCents: 890, expressCents: 1490},
	"FR": {standardCents: 890, expressCents: 1490},
}

var ErrUnsupportedCountry = errors.New("unsupported country")

func ShippingFee(o Order) (int, error) {
	rule, ok := feeRules[o.Country]
	if !ok {
		return 0, fmt.Errorf("shipping fee for %q: %w", o.Country, ErrUnsupportedCountry)
	}
	overThreshold := rule.freeThresholdCents > 0 && o.TotalCents >= rule.freeThresholdCents
	switch {
	case overThreshold && o.Express:
		return rule.expressOverFreeCents, nil
	case overThreshold:
		return 0, nil
	case o.Express:
		return rule.expressCents, nil
	default:
		return rule.standardCents, nil
	}
}
```
**Why it's right:**
- Data (fees per country) is separated from logic (how fees apply); adding a country is a one-line change.
- A single flat `switch` with named conditions keeps cognitive complexity low and each case maps to one table-driven test.

### 2. Gaming the quality gate
```properties
# sonar-project.properties: analyze everything, exclude only generated code
sonar.exclusions=**/generated/**,**/*.pb.go
sonar.qualitygate.wait=true
```
```text
Quality gate "Company way" (on new code):
  - Cognitive complexity per function ≤ 15 (rule enabled in the quality profile)
  - Duplicated lines on new code ≤ 3%
  - Coverage on new code ≥ 80%
  - Maintainability rating on new code = A

Hotspot report (last 6 months, complexity × commits):
  1. src/pricing/InvoiceCalculator.java  cognitive 142, 61 commits  → refactoring epic PRICE-88
  2. src/orders/OrderStateMachine.java   cognitive 73,  44 commits  → table-driven transitions
  3. src/legacy/ReportExporter.java      cognitive 95,   2 commits  → stable, no action
```
**Why it's right:**
- All hand-written code is analyzed; the gate protects new code without blocking unrelated work on legacy files.
- Refactoring is prioritized by complexity × churn, so effort goes where changes actually happen.
