---
name: performance-budgets-ci
description: "Preventing performance regressions with budgets enforced in CI/CD: defining budgets for latency, throughput, resource usage, bundle size, and Core Web Vitals, micro-benchmarks and load-test gates, Lighthouse CI and size-limit, comparing against baselines with statistical noise handling, dedicated stable runners, trend dashboards, and handling budget exceptions. Use it when setting up performance gates or reviewing why performance regresses between releases."
---

# Skill: Performance Budgets in CI

## Implementation Rules:
- **[MANDATORY]** Define explicit performance budgets per product area, derived from SLOs and user experience goals: API latency percentiles and error rates under a reference load, resource cost per request, frontend bundle sizes and request counts, and Core Web Vitals lab thresholds for key page templates.
- **[MANDATORY]** Enforce budgets automatically in pipelines: builds fail or require explicit approval when a budget is exceeded, and budget definitions are versioned with the code.
- **[PATTERN]** Layer the checks by cost: bundle-size and static checks on every pull request (size-limit, bundlesize, Lighthouse CI budgets), micro-benchmarks on changed performance-critical code (JMH, BenchmarkDotNet, Go benchmarks with benchstat, criterion for Rust), and load-test smoke gates on merge; full load tests nightly.
- **[PATTERN]** Compare against a baseline, not absolute single runs: run benchmarks multiple times, compare distributions with statistical tools (benchstat, JMH confidence intervals), and flag regressions above a noise threshold (for example more than 5% with significance).
- **[MANDATORY]** Run performance gates on stable, dedicated infrastructure (fixed instance types, no noisy neighbors, pinned CPU frequency where possible), because shared CI runners produce noisy results that erode trust in the gate.
- **[PATTERN]** Track trends over time on dashboards (per commit or nightly), so slow regressions that stay under per-change thresholds are still visible.
- **[PATTERN]** Attribute regressions quickly: record the commit, dependency changes, and configuration with each result, and bisect automatically when a nightly run regresses.
- **[FORBIDDEN]** Disabling or loosening a failing budget without review, measuring performance only before major releases, gates so noisy that teams habitually re-run them until they pass, and budgets without owners.
- **[PATTERN]** Handle justified exceptions explicitly: a documented decision with owner and expiry when a budget increase is accepted (for example a new feature that adds 20 KB), and update the budget in the same pull request.
- **[PATTERN]** Include performance in the definition of done for features on critical paths: new endpoints come with load-test scenarios and budgets, and new pages with Lighthouse assertions.
- **[TESTING]** Periodically validate the gates themselves: inject a known regression (a sleep or a large dependency) on a test branch and confirm the pipeline catches it.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
