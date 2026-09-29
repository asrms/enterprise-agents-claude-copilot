---
name: feature-flags
description: "Feature flag practice for safe delivery: flag types (release, experiment, ops kill switch, permission), vendor-neutral evaluation with OpenFeature, server-side evaluation and targeting, defaults and fallbacks, progressive rollouts, flag lifecycle with owners and expiry, cleanup of stale flags, auditing, and testing both paths. Use it when introducing, reviewing, or cleaning up feature flags in any stack."
---

# Skill: Feature Flags

## Implementation Rules:
- **[ARCHITECTURE]** Use flags to decouple deployment from release: incomplete features are merged to trunk behind release toggles, rolled out progressively, and removed after full rollout.
- **[MANDATORY]** Classify every flag by type with an owner, a ticket, and an expected removal date: release toggles (days to weeks), experiment toggles (duration of the experiment), ops toggles and kill switches (long-lived, documented), permission toggles (long-lived, product-managed).
- **[PATTERN]** Evaluate flags through a vendor-neutral API (OpenFeature SDKs with a provider such as flagd, LaunchDarkly, Unleash, Flagsmith, or a cloud service), so providers can be changed and tests can use an in-memory provider.
- **[MANDATORY]** Every evaluation passes a safe default that preserves current behavior (usually `false` for new features) and the code behaves correctly when the flag service is unavailable; the SDK caches flag configuration locally.
- **[SECURITY]** Evaluate sensitive flags on the server; client-side flags are visible and modifiable by users, so they never guard authorization, pricing, or security controls. Targeting context contains only the attributes needed (user id, tenant, plan), not personal data.
- **[PATTERN]** Roll out progressively with percentage rollouts on a stable key (user or tenant id), internal users first, then canary cohorts, while watching error rates and business metrics; keep a kill switch to turn the feature off in seconds.
- **[PATTERN]** Keep flag checks at a single decision point per feature (a function or strategy selection near the entry point), not scattered `if` statements across the codebase.
- **[FORBIDDEN]** Nesting flags inside other flags, reusing an old flag name for a new purpose, long-lived release toggles that become permanent configuration, and changing flag state in production without an audit trail.
- **[MANDATORY]** Remove flags once rolled out: delete the flag checks and the dead code path, then archive the flag in the management system; track stale flags (unchanged for longer than their expected lifetime) and fail CI or raise alerts when they exceed the limit.
- **[PATTERN]** Record flag changes (who, when, what, why) in the flag system's audit log and correlate them with deployment and incident timelines.
- **[TESTING]** Test both variants of every active flag in unit or integration tests (in-memory OpenFeature provider), run end-to-end tests with the production default configuration, and include flag state in bug reports and logs.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
