# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Decorative security stage
```yaml
security:
  stage: test
  allow_failure: true                     # never blocks anything
  rules:
    - if: '$SKIP_SECURITY == "true"'      # anyone can skip it
      when: never
    - when: always
  script:
    - trivy fs . > trivy.txt              # output nobody reads
```
**Why it's wrong:**
- The job cannot fail the pipeline and can be disabled with a variable; results are not reported or tracked.

## Best Practice (How to do it right)

### 1. Shared GitLab CI template with explicit blocking rules
`templates/security-gates.yml` (included by every project):
```yaml
stages: [test, build, verify]

secrets:
  stage: test
  image: zricethezav/gitleaks:v8.27.2
  script:
    - gitleaks git --log-opts="$CI_MERGE_REQUEST_DIFF_BASE_SHA..HEAD" --report-format sarif --report-path gitleaks.sarif
  artifacts: { reports: { sast: gitleaks.sarif }, when: always }

sast:
  stage: test
  image: semgrep/semgrep:1.130.0
  script:
    - semgrep scan --config p/default --baseline-commit "$CI_MERGE_REQUEST_DIFF_BASE_SHA" --severity ERROR --error --sarif --output semgrep.sarif
  artifacts: { paths: [semgrep.sarif], when: always }
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

dependencies:
  stage: test
  image: aquasec/trivy:0.65.0
  script:
    - trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --ignorefile .trivyignore.yaml --exit-code 1 .

image-scan:
  stage: verify
  image: aquasec/trivy:0.65.0
  script:
    - trivy image --severity CRITICAL --ignore-unfixed --exit-code 1 "$CI_REGISTRY_IMAGE@$IMAGE_DIGEST"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```
`.trivyignore.yaml` (reviewed exceptions with expiry):
```yaml
vulnerabilities:
  - id: CVE-2026-12345
    paths: ["package-lock.json"]
    statement: "Not reachable: vulnerable parser only used in build tooling. Approved by security (SEC-771)."
    expired_at: 2026-11-30
```
**Why it's right:**
- Each gate blocks on clearly defined severities, runs on merge requests where developers can act, and uses pinned scanner versions.
- New findings are compared against the merge-request base, and exceptions are explicit, justified, approved, and expire.
- The shared template gives every project the same policy, and required pipeline success prevents bypassing it.
