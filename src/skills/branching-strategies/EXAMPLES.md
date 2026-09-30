# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Environment branches and long-lived features
```text
feature/new-checkout   (open for 7 weeks, 214 files changed)
develop  -> merged into staging every Friday
staging  -> merged into prod after "manual testing"
prod     -> hotfixes committed directly, sometimes never merged back
```
**Why it's wrong:**
- Huge, late merges cause conflicts and integration bugs; each environment branch can contain different code.
- Hotfixes applied only to `prod` are lost at the next promotion, reintroducing fixed bugs.

## Best Practice (How to do it right)

### 1. Trunk-based flow with protected main and release tags
```text
main  ──●──●──●──●──●──●──●──●──   (always releasable, deployed by CI)
         \  /  \ /     \  /
     feat/ORD-42  fix/ORD-57  feat/ORD-60     (1-2 day branches, squash-merged)

tags: v2.4.0, v2.4.1 (created by the release pipeline)
release/2.4 created from v2.4.0 only for the mobile app, which must support two versions in the stores
```
### 2. GitHub ruleset for the default branch (JSON excerpt)
```json
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1,
        "require_code_owner_review": true,
        "dismiss_stale_reviews_on_push": true,
        "require_last_push_approval": true,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "ci / build-test" }, { "context": "security / sast" }] } },
    { "type": "merge_queue", "parameters": {
        "merge_method": "SQUASH", "grouping_strategy": "ALLGREEN",
        "max_entries_to_build": 5, "min_entries_to_merge": 1, "max_entries_to_merge": 5,
        "min_entries_to_merge_wait_minutes": 5, "check_response_timeout_minutes": 30 } }
  ]
}
```
**Why it's right:**
- Small branches merge daily into a protected `main` validated by a merge queue, so integration happens continuously.
- Release branches exist only where multiple supported versions require them, and releases are immutable tags.
- Reviews, code owners, and required checks are enforced by the platform rather than by convention.
