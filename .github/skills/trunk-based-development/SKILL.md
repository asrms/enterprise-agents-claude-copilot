---
name: trunk-based-development
description: "Practicing trunk-based development and continuous integration: integrating to main at least daily, small pull requests, fast pre-merge CI, keeping main releasable, hiding unfinished work with feature flags and branch by abstraction, dark launches, stacked changes, and releasing from trunk. Use it when adopting or improving trunk-based development and continuous delivery practices."
---

# Skill: Trunk-Based Development

## Implementation Rules:
- **[MANDATORY]** Every developer integrates into `main` at least once a day through short-lived branches or direct commits with pair/mob review; branches older than two days are an exception to discuss, not the norm.
- **[MANDATORY]** `main` is always releasable: every merge passes the full required CI (build, unit and integration tests, static analysis, security checks), and a red `main` is fixed or reverted immediately as the team's top priority.
- **[PATTERN]** Keep changes small (ideally under 400 changed lines, one concern per pull request) and review them quickly (within hours); split large work into vertical slices or stacked pull requests.
- **[PATTERN]** Hide unfinished work instead of holding it on branches: release toggles for user-visible features, branch by abstraction for replacing components (introduce an interface, switch implementations behind it, then remove the old one), and dark launches that exercise new code paths without exposing results.
- **[PATTERN]** Make CI fast enough to support frequent integration: pre-merge pipelines under about 10 minutes through caching, parallelism, test selection, and moving slow suites to post-merge stages that still gate releases.
- **[PATTERN]** Release from trunk: deploy every green `main` commit to a staging environment automatically and to production continuously or on a cadence; create release branches only when multiple supported versions demand it, and cherry-pick fixes from `main` into them.
- **[FORBIDDEN]** Long-lived feature branches, code freezes as the normal way to stabilize, merging with failing or skipped required checks, and commented-out code or `if (false)` used instead of proper flags.
- **[PATTERN]** Use a merge queue on busy repositories so the combination of pending changes is tested before landing, and automatic reverts or quick revert commits when a merged change breaks `main`.
- **[PATTERN]** Protect quality without long branches: pair or ensemble programming, automated code review tools, contract tests between services, and consumer-driven compatibility checks.
- **[MANDATORY]** Clean up after rollout: remove release toggles and old implementations from branch-by-abstraction work within the agreed time, tracked as part of the feature's definition of done.
- **[TESTING]** Track the practice with metrics (integration frequency, pull request size and lead time, main build success rate and time to fix, deployment frequency, change failure rate) and review them in retrospectives.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
