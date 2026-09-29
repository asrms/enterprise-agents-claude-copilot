---
name: sast-semgrep-codeql
description: "Static application security testing with Semgrep, CodeQL, and language-specific analyzers: rule selection, running on pull requests with diff-aware scans and full scans on main, SARIF reporting, custom rules for organization-specific patterns, triage and suppression with justification, false-positive management, and developer feedback in code review. Use it when setting up, tuning, or reviewing SAST in CI."
---

# Skill: SAST with Semgrep and CodeQL

## Implementation Rules:
- **[MANDATORY]** Run SAST on every pull request (diff-aware, reporting only new findings) and a full scan on the default branch on a schedule, for every language in the repository, with results uploaded as SARIF to the code scanning dashboard.
- **[PATTERN]** Combine a fast pattern-based engine (Semgrep with curated rulesets such as `p/default`, `p/owasp-top-ten`, and language packs) with a semantic dataflow engine (CodeQL `security-extended` queries) for injection and taint analysis where supported; add language linters with security rules (Bandit, gosec, eslint-plugin-security, SpotBugs with Find Security Bugs).
- **[MANDATORY]** Configure CodeQL builds correctly for compiled languages (autobuild or explicit build commands, `build-mode: none` where supported) so analysis covers the real code; a green scan over unbuilt code is meaningless.
- **[PATTERN]** Write custom rules for organization-specific risks (internal APIs that must not be called with user input, banned crypto helpers, missing authorization decorators), with positive and negative test cases stored next to the rules.
- **[MANDATORY]** Findings have a severity and a clear gate: new critical and high findings with high confidence block the merge; medium and low are reported and triaged within agreed SLAs.
- **[PATTERN]** Suppress false positives in code with the tool's annotation and a justification (`# nosemgrep: rule-id -- input validated by allow-list in parse_sort()`) or through the dashboard with a reason, never by disabling whole rules globally without review.
- **[FORBIDDEN]** Running SAST only before releases, failing builds on every legacy finding at once (baseline existing findings and fix them progressively), and ignoring findings in test or generated code without a scoping decision.
- **[PERFORMANCE]** Keep pull request scans fast (minutes): diff-aware scanning, caching, excluding vendored and generated directories via ignore files, and running heavy full scans on schedule.
- **[PATTERN]** Deliver findings where developers work: inline pull request annotations with the rule explanation and fix guidance, autofix suggestions where the tool supports them, and links to internal secure coding guidance.
- **[SECURITY]** Scanner configurations and custom rules are version-controlled and reviewed; scanning jobs run with read-only tokens and never upload source code to unapproved third-party services.
- **[TESTING]** Measure effectiveness: seeded vulnerable test cases or benchmark projects to confirm rules fire, false-positive rates per rule, and mean time to remediate by severity; tune or remove noisy rules.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
