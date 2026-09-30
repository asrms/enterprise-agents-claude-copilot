---
name: production-debugging
description: "Safely debugging issues that only occur in production: mitigation before diagnosis, read-only investigation first, dynamic log levels and targeted diagnostics, feature-flagged instrumentation, safe use of debuggers, snapshots, heap and thread dumps, ephemeral debug containers in Kubernetes, access controls and audit, protecting customer data, and restoring normal state afterwards. Use it when a problem cannot be reproduced outside production."
---

# Skill: Production Debugging

## Implementation Rules:
- **[MANDATORY]** Mitigate user impact first (roll back, disable the feature flag, shift traffic, scale), then investigate; debugging must not prolong an outage.
- **[MANDATORY]** Start read-only: dashboards, logs, traces, profiles, recent changes, and configuration before any intervention; every action on production is announced in the incident or change channel and recorded.
- **[PATTERN]** Increase visibility temporarily and narrowly: dynamic log levels for one component or logger (Spring Boot Actuator loggers endpoint, runtime log level APIs), per-tenant or per-request debug sampling, and feature-flagged diagnostic spans, with an automatic expiry.
- **[PATTERN]** Collect runtime artifacts with minimal impact: thread dumps, continuous profiling data, lightweight flight recordings (JFR), and heap dumps only when necessary, knowing that heap dumps can pause the process and contain sensitive data.
- **[PATTERN]** In Kubernetes, use ephemeral debug containers (`kubectl debug -it <pod> --image=<debug-image> --target=<container>`) with approved images instead of installing tools in production images, and remove a misbehaving pod from load balancing (change labels) before deep inspection when possible.
- **[SECURITY]** Access production through just-in-time, audited, least-privilege mechanisms (break-glass roles, session recording, bastion or session manager), never with shared credentials; handle any customer data seen during debugging according to privacy rules.
- **[FORBIDDEN]** Hot-patching code or editing files on production hosts, attaching interactive breakpoint debuggers that pause live traffic, running ad hoc data-modifying queries without review and backup, leaving debug logging enabled, and copying production data to personal machines.
- **[PATTERN]** Use non-breaking snapshot debuggers or dynamic instrumentation tools approved by the organization (for example eBPF-based tools or vendor snapshot debuggers) that capture variables without stopping execution, with data redaction enabled.
- **[PATTERN]** When possible, reproduce with production-like conditions instead: capture the failing input safely and replay it in staging, or route a copy of traffic (shadowing) to an instrumented instance.
- **[MANDATORY]** Clean up after the investigation: revert log levels and flags, delete dumps and captured data per retention rules, remove debug containers, and document what was done.
- **[TESTING]** Turn the finding into a reproducible test and a monitoring improvement (alert or dashboard) so the same class of problem is detected earlier and no longer requires production debugging.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
