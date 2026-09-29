# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Manual guessing across 400 commits
```text
"It broke sometime last month." Developer checks out random commits, eyeballs the UI,
marks some as good without rebuilding, gives up after 3 hours; bisect never reset, working tree left detached.
```
**Why it's wrong:**
- Unverified marks lead bisection to the wrong commit, and manual checks are slow and inconsistent.

## Best Practice (How to do it right)

### 1. Automated bisection with a deterministic check script
`/tmp/check-rounding.sh`:
```bash
#!/usr/bin/env bash
set -uo pipefail
# build only the module under test; build failures are "skip" (125), not "bad"
./gradlew :billing:compileJava -q > /dev/null 2>&1 || exit 125

cp /tmp/RoundingRegressionTest.java billing/src/test/java/com/example/billing/  # test not present in old commits
for i in 1 2 3; do                                                                  # guard against flakiness
  if ! timeout 300 ./gradlew :billing:test --tests 'com.example.billing.RoundingRegressionTest' -q > /dev/null 2>&1; then
    git checkout -- billing/src/test 2>/dev/null; rm -f billing/src/test/java/com/example/billing/RoundingRegressionTest.java
    exit 1                                                                          # bug present
  fi
done
rm -f billing/src/test/java/com/example/billing/RoundingRegressionTest.java
exit 0                                                                              # good
```
```bash
git status --short                     # must be clean
git bisect start v7.3.2 v7.1.0         # bad, then good
git bisect run /tmp/check-rounding.sh
# -> 3b7e9d1 is the first bad commit: "chore(deps): bump money library to 5.0"
git bisect log > bisect-INV-88.log     # keep for the ticket
git bisect reset
```
**Why it's right:**
- Endpoints are verified, the check is automated and deterministic, and unbuildable commits are skipped instead of misclassified.
- The session is logged, the repository is reset, and the test becomes a regression test with the fix.
