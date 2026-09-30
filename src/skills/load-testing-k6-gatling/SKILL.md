---
name: load-testing-k6-gatling
description: "Performance and load testing with k6, Gatling, JMeter, or Locust: test types (smoke, load, stress, spike, soak, breakpoint), workload models from production traffic, open vs closed models and arrival rates, realistic data and think time, thresholds tied to SLOs, test environments, monitoring the system under test, analyzing percentiles, and running tests in CI. Use it when planning, writing, or reviewing performance tests."
---

# Skill: Load Testing with k6 and Gatling

## Implementation Rules:
- **[MANDATORY]** Start from explicit goals: the questions the test answers (can we handle 3x peak? where is the breaking point? does latency degrade over 8 hours?) and pass/fail criteria derived from SLOs and non-functional requirements.
- **[PATTERN]** Choose the test type for the question: smoke (script sanity with minimal load), average load, stress (above expected peak), spike (sudden surges), soak or endurance (hours, for leaks and degradation), and breakpoint (increasing until failure to find capacity limits).
- **[MANDATORY]** Model the workload on production data: the mix of user journeys and endpoints, request rates by time of day, payload sizes, cache hit ratios, and data distributions; use an open model with arrival rates (k6 `constant-arrival-rate`/`ramping-arrival-rate`, Gatling open injection profiles) for internet-facing services so the load does not slow down when the system slows down.
- **[PATTERN]** Use realistic, varied test data (parameterized users, products, and search terms from data files), correlation of dynamic values (tokens, ids), and think time where modeling users; avoid hitting the same cached record repeatedly.
- **[MANDATORY]** Define thresholds in the script so the test fails automatically: latency percentiles (p95, p99), error rate, and checks on response content (k6 `thresholds`, Gatling `assertions`).
- **[PATTERN]** Test in a production-like environment (same instance types, configuration, data volume, and dependencies or realistic stubs), isolated from other tests, and never load-test production or third-party services without explicit agreement.
- **[MANDATORY]** Monitor the system under test during the run (application metrics, traces, database and infrastructure saturation) and the load generators themselves (CPU, network) so bottlenecks are identified and generator limits are not mistaken for system limits.
- **[FORBIDDEN]** Reporting averages only, closed-model tests with a fixed number of looping virtual users for open-traffic systems without understanding coordinated omission, tests without warm-up, and conclusions from a single short run.
- **[PATTERN]** Analyze results with percentiles over time, throughput vs latency curves, and error breakdowns; correlate with server-side telemetry to find the bottleneck, then change one thing at a time and retest.
- **[PATTERN]** Version performance test scripts with the code, reuse them across environments with configuration, and keep scenarios small and composable.
- **[TESTING]** Run smoke performance tests in CI on every change to critical services, scheduled full load tests nightly or weekly with trend tracking, and dedicated stress and soak tests before peak events and major releases.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
