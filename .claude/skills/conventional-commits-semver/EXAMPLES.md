# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unstructured history and hidden breaking changes
```text
a1f3c2e update
9b2d771 fix stuff
c04e9aa removed old endpoint           <- breaks clients, released as 2.3.1
58ee013 WIP
```
**Why it's wrong:**
- Nobody can tell from the history what changed or generate a changelog.
- A breaking change shipped as a patch release breaks every consumer that auto-updates patches.

## Best Practice (How to do it right)

### 1. Conventional Commits with an explicit breaking change
```text
feat(orders): add cursor pagination to GET /v2/orders

Offset pagination was slow for large tenants. The cursor is opaque and
valid for 24 hours.

Refs: ORD-142
```
```text
feat(api)!: remove the deprecated GET /v1/reports endpoint

BREAKING CHANGE: /v1/reports was removed after its sunset date (2026-09-01).
Clients must call /v2/reports; see docs/migrations/reports-v2.md.

Closes #381
```
### 2. Enforcement with commitlint
`commitlint.config.mjs`:
```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['api', 'orders', 'payments', 'web', 'infra', 'deps']],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
};
```
```bash
# commit-msg hook (for example via Husky or lefthook)
npx --no -- commitlint --edit "$1"
```
### 3. Resulting versions
```text
2.3.0 --fix(orders)--> 2.3.1 --feat(orders)--> 2.4.0 --feat(api)!--> 3.0.0-rc.1 --> 3.0.0
```
**Why it's right:**
- Each commit states its type, scope, and intent; breaking changes are impossible to miss and include migration guidance.
- Tooling enforces the format and derives the next version, so the version number communicates compatibility.
