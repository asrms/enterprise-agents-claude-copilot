# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Secret committed, then "removed"
```bash
git add .env                      # DATABASE_URL=postgres://app:S3cr3t@db.prod.example.com/shop
git commit -m "config"
git push
# later, after noticing:
git rm .env && git commit -m "remove env" && git push   # secret still in history, forks, and CI caches
```
```dockerfile
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc && npm ci   # token persisted in a layer
```
**Why it's wrong:**
- The credential remains valid and visible in history; deleting the file does not revoke anything.
- The build token is written into an image layer that anyone with pull access can read.

## Best Practice (How to do it right)

### 1. Pre-commit hook and CI scan with custom rules
`.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.27.2
    hooks:
      - id: gitleaks
```
`.gitleaks.toml`:
```toml
[extend]
useDefault = true

[[rules]]
id = "acme-api-token"
description = "ACME internal API token"
regex = '''acme_(live|test)_[A-Za-z0-9]{32}'''
keywords = ["acme_live_", "acme_test_"]

[allowlist]
description = "Clearly fake fixtures used in tests"
paths = ['''testdata/fixtures/.*\.json''']
```
```bash
# CI backstop and periodic history scan (only verified, live secrets fail the job)
trufflehog git file://. --since-commit main --results=verified --fail
```
### 2. Build secret mounted, not persisted
```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npm_token,env=NPM_TOKEN \
    npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN" --location=project && \
    npm ci && rm -f .npmrc
```
### 3. Leak response runbook (excerpt)
```text
1. Revoke/rotate the credential at the provider now; confirm the old value fails.
2. Review provider audit logs from the commit time to now for unexpected use; escalate if found.
3. Deploy the new secret from the secret manager; no code change should contain it.
4. Clean history if required (git filter-repo) and invalidate caches and artifacts containing it.
5. Record time-to-revoke and root cause; add a detection rule if the pattern was missed.
```
**Why it's right:**
- Secrets are blocked at commit time, detected in CI and history, and custom token formats are covered.
- Build secrets are mounted only for the step that needs them, and a leak triggers revocation first, then investigation and cleanup.
