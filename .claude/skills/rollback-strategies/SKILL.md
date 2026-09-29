---
name: rollback-strategies
description: "Planning and executing rollbacks and roll-forwards: immutable versioned artifacts, redeploying the previous version, blue-green and canary aborts, feature-flag kill switches, database-compatible rollbacks, mobile and client constraints, automated rollback triggers from SLOs, decision criteria for rollback vs fix-forward, and rehearsing recovery. Use it when designing release safety or responding to a bad deployment."
---

# Skill: Rollback Strategies

## Implementation Rules:
- **[MANDATORY]** Every release has a documented rollback path before it ships: which artifact to redeploy, how long it takes, which data changes are irreversible, and who can decide; releases without a viable rollback require explicit approval and extra safeguards.
- **[MANDATORY]** Deploy immutable, versioned artifacts (image digests, versioned packages) and keep the previous known-good versions available, so rollback is a redeploy of a known artifact through the normal pipeline, not a rebuild.
- **[PATTERN]** Prefer the fastest safe lever: disable the feature flag or kill switch first, then abort the canary or switch blue-green traffic back, then redeploy the previous version; fix forward only when the fix is small, understood, and faster than rolling back.
- **[PATTERN]** Automate rollback triggers for progressive delivery: canary analysis on error rate, latency, and saturation against SLOs (Argo Rollouts, Flagger, cloud deployment services) aborts automatically when thresholds are breached.
- **[MANDATORY]** Keep database changes backward compatible (expand-migrate-contract) so application rollback never requires a schema rollback; irreversible data migrations are separated, delayed, and backed by verified backups.
- **[PATTERN]** Account for clients that cannot be rolled back: mobile apps and desktop clients stay in the field, so servers keep backward-compatible APIs, and client features are guarded by remote flags or minimum-version checks.
- **[PATTERN]** Configuration and infrastructure are versioned and rolled back like code (GitOps revert, previous Terraform plan applied through the pipeline); secrets rotation has its own tested rollback.
- **[FORBIDDEN]** Manual hotfixes directly in production, rebuilding an old commit to "roll back" (it may pull different dependencies), deleting previous artifacts or image tags immediately after release, and rolling back without communicating status to stakeholders.
- **[PATTERN]** During an incident, the incident commander decides rollback vs fix-forward using pre-agreed criteria (customer impact, confidence in the cause, time to fix); the decision and timing are recorded for the postmortem.
- **[PATTERN]** After a rollback, block re-promotion of the bad version (mark it in the registry or release system), open a tracked fix, and require the fix to pass the same gates plus a regression test.
- **[TESTING]** Rehearse rollbacks regularly in staging and during game days (redeploy previous version, flag kill switch, canary abort, database restore to a test environment) and measure time to restore as a DORA metric.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
