---
name: security-gates-ci
description: "Designing security gates in CI/CD pipelines for any platform: which checks run at pre-commit, pull request, build, and deploy stages, blocking vs warning policies by severity and confidence, baselines for legacy findings, exceptions with owners and expiry, SARIF aggregation, admission and deployment policy checks, pipeline performance, and reporting. Use it when integrating security scanning into GitHub Actions, GitLab CI, Azure Pipelines, or Jenkins."
---

# Skill: Security Gates in CI

## Implementation Rules:
- **[ARCHITECTURE]** Place each control at the earliest effective stage: pre-commit (secrets, formatting of IaC), pull request (SAST diff scan, SCA of changed manifests, IaC and container config scans, secret scanning), build (image scan, SBOM, signing, provenance), deploy (signature and policy verification at admission), and scheduled (full scans, DAST, history scans).
- **[MANDATORY]** Define the gate policy explicitly and version it: which tools run, which severities and confidence levels block, which only warn, and for which branches and environments; the same policy applies to every repository through shared templates.
- **[MANDATORY]** Block on new, high-confidence critical and high findings, on verified secrets, and on policy violations for production deployments; report medium and low findings without blocking but with remediation SLAs.
- **[PATTERN]** Introduce gates on existing repositories with a baseline: record current findings, block only new ones, and burn down the baseline on a schedule, rather than failing every build on day one.
- **[PATTERN]** Manage exceptions as reviewed data: an exceptions file or platform dismissal with finding id, justification, compensating controls, approver, and expiry date; expired exceptions fail the gate again.
- **[PATTERN]** Normalize outputs to SARIF or the platform's security report format and aggregate them in one place (code scanning dashboards, a vulnerability management platform such as DefectDojo) to deduplicate across tools.
- **[PERFORMANCE]** Keep pull request gates fast (target under 10 minutes total): diff-aware scans, caching of scanner databases, parallel jobs, and heavier scans moved to scheduled or post-merge stages that still gate releases.
- **[FORBIDDEN]** `allow_failure: true` or `|| true` on security jobs that are declared as blocking, security stages that can be skipped by pipeline variables without approval, and gates that only run on the default branch after merge.
- **[SECURITY]** Protect the pipeline itself: scanners pinned to versions or digests, least-privilege tokens for scan jobs, protected shared templates, and required status checks so gates cannot be bypassed by editing the pipeline in a pull request.
- **[PATTERN]** Enforce at deployment as well: admission controllers or deployment steps verify image signatures, provenance, and vulnerability thresholds, so artifacts that skipped CI cannot reach production.
- **[TESTING]** Report gate effectiveness (findings blocked, false-positive rate, exception count and age, time to remediate, pipeline duration) and review the policy quarterly with development teams.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
