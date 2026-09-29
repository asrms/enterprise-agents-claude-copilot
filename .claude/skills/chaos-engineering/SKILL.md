---
name: chaos-engineering
description: "Chaos engineering and resilience testing: steady-state hypotheses tied to SLOs, experiment design with blast radius and abort conditions, fault injection for instances, networks, dependencies, and zones with tools such as Chaos Mesh, LitmusChaos, AWS FIS, Azure Chaos Studio, or Toxiproxy, game days, running experiments progressively from staging to production, and turning findings into fixes. Use it when validating system resilience or planning game days."
---

# Skill: Chaos Engineering

## Implementation Rules:
- **[MANDATORY]** Start every experiment with a steady-state hypothesis expressed in user-facing metrics (for example, checkout success rate stays above 99.5% and p99 latency below 1.2 s while one availability zone is lost), not internal metrics.
- **[MANDATORY]** Define the blast radius and safety controls before running: scope (service, percentage of instances or traffic, environment), duration, automatic abort conditions tied to SLO metrics, a stop button, and an owner watching the experiment.
- **[PATTERN]** Prioritize experiments from real risks: past incidents, dependencies without fallbacks, single points of failure, and assumptions in the architecture (retries work, failover is automatic, caches absorb load).
- **[PATTERN]** Inject realistic faults: instance and pod termination, CPU and memory pressure, network latency, packet loss and partition, dependency errors and slow responses (Toxiproxy, service mesh fault injection), DNS failures, zone outages, and certificate or credential expiry.
- **[PATTERN]** Progress gradually: start in staging with synthetic load, then production with a minimal blast radius during business hours when the team is available, and expand scope only after passing.
- **[FORBIDDEN]** Chaos experiments without monitoring and abort conditions, running experiments during incidents, freezes, or peak events, surprising other teams who own affected dependencies, and experiments whose results are not recorded.
- **[PATTERN]** Define experiments as code (Chaos Mesh or LitmusChaos custom resources, AWS FIS experiment templates, Azure Chaos Studio experiments) versioned with the service, and schedule recurring experiments for critical resilience properties.
- **[PATTERN]** Run game days combining fault injection with the human response: alerts fire, runbooks are followed, roles are exercised, and observations are captured by a facilitator.
- **[MANDATORY]** Record each experiment's hypothesis, method, observations, and outcome; every weakness found becomes an owned backlog item, and the experiment is rerun after the fix.
- **[SECURITY]** Restrict who can run chaos tools in production (least-privilege roles, approvals), audit their use, and make sure fault injection cannot corrupt or expose data.
- **[TESTING]** Include lightweight resilience tests in CI where possible (dependency timeouts and failures with Toxiproxy or WireMock in integration tests), so regressions are caught before production experiments.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
