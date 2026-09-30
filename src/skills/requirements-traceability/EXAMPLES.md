# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Audit-time spreadsheet
```text
traceability_FINAL_v7.xlsx (updated manually the week before the audit)
| Requirement           | Test              | Status |
| Returns work          | tested manually   | OK     |
| Security requirements | see pen test      | OK     |
```
**Why it's wrong:**
- The matrix is disconnected from the tracker, code, and CI, so it is outdated as soon as it is written.
- Entries are vague and cannot show which tests verified which requirement in which release.

## Best Practice (How to do it right)

### 1. Identifiers flowing through branches, commits, and tests
```text
Branch:       feat/RET-12-request-return
PR title:     feat(returns): request a return for one item (RET-12)
Commit footer: Refs: RET-12
```
```gherkin
@RET-12
Feature: Request a return

  @RET-12 @NFR-06
  Scenario: Return window is enforced
    ...
```
```java
@Test
@Tag("RET-12")
void rejectsReturnsOutsideThirtyDayWindow() { ... }
```
### 2. Automated traceability check in CI
```python
# fails the release if a story in the release has no passing test tagged with its id
release_stories = tracker.search(f'fixVersion = "{RELEASE}" AND type = Story')      # e.g. ["RET-12", "RET-13"]
results = parse_junit("build/test-results/**/*.xml")                                  # tags -> pass/fail
missing = [s for s in release_stories if not any(r.passed and s in r.tags for r in results)]
if missing:
    raise SystemExit(f"Stories without passing tests: {', '.join(missing)}")
write_report("traceability.html", release_stories, results)                           # archived with the release
```
**Why it's right:**
- Links are created as part of normal work (branch names, pull requests, test tags), not reconstructed for audits.
- A generated report shows every story in the release with its passing tests, and missing coverage blocks the release.
