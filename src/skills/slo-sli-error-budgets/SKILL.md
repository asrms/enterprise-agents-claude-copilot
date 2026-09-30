---
name: slo-sli-error-budgets
description: "Service level objectives for reliability engineering: choosing user-centric SLIs (availability, latency, freshness, correctness), writing SLOs with windows and targets, error budgets and error budget policies, burn-rate calculations, SLOs as code with Sloth, Pyrra, or OpenSLO, dependencies and composite SLOs, and using SLOs in planning and release decisions. Use it when defining or reviewing reliability targets for services."
---

# Skill: SLOs, SLIs, and Error Budgets

## Implementation Rules:
- **[MANDATORY]** Define SLIs from the user's perspective on critical user journeys (checkout succeeds, search returns results quickly, data is fresh), measured as the ratio of good events to valid events, as close to the user as practical (load balancer, gateway, or client telemetry rather than host metrics).
- **[PATTERN]** Choose SLI types that match the service: availability (non-5xx and non-timeout responses), latency (proportion of requests faster than a threshold, not averages), freshness for pipelines, correctness for data processing, and durability for storage.
- **[MANDATORY]** Write each SLO with the SLI definition, the target, and the window (for example 99.9% of valid checkout requests succeed over a rolling 28 days), excluding invalid events explicitly (health checks, client errors caused by bad input) and documenting the rationale.
- **[PATTERN]** Set targets from user expectations and historical performance, not aspirations: start achievable, review quarterly, and avoid 100% targets, which leave no room for change.
- **[MANDATORY]** Derive the error budget (1 - target) and adopt an error budget policy agreed with product owners: what happens when the budget is exhausted (prioritize reliability work, freeze risky launches, require extra review) and when it is healthy (ship faster, run experiments).
- **[PATTERN]** Alert on error budget burn rate with multi-window, multi-burn-rate alerts (for example 14.4x over 1 hour and 5 minutes for paging, 6x over 6 hours and 30 minutes, lower rates for tickets) instead of static thresholds.
- **[PATTERN]** Manage SLOs as code (Sloth, Pyrra, OpenSLO specifications, or cloud SLO resources in Terraform) so recording rules, alerts, and dashboards are generated consistently and reviewed.
- **[PATTERN]** Account for dependencies: understand which upstream SLOs bound yours, avoid promising more than dependencies allow without redundancy, and publish SLOs for internal platforms consumed by other teams.
- **[FORBIDDEN]** SLOs based on CPU, memory, or uptime pings, dozens of SLOs per service that nobody reviews, averages for latency SLIs, and error budgets that are tracked but never influence decisions.
- **[PATTERN]** Review SLO performance in regular reliability reviews with product and engineering, linking budget consumption to incidents, releases, and dependencies.
- **[TESTING]** Validate SLI implementations against real incidents and synthetic tests (does the SLI drop when users are affected?), and verify that burn-rate alerts fire in staging by injecting errors.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
