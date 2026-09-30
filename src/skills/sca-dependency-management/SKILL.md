---
name: sca-dependency-management
description: "Software composition analysis and dependency hygiene: lock files and reproducible installs, automated updates with Dependabot or Renovate, vulnerability scanning with OSV-Scanner, Trivy, Snyk, or ecosystem audit tools, reachability, SBOM generation, license compliance, dependency confusion and typosquatting prevention, private registries and proxies, and abandoned package detection. Use it when managing third-party dependencies securely in any ecosystem."
---

# Skill: SCA and Dependency Management

## Implementation Rules:
- **[MANDATORY]** Commit lock files for applications (`package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`/`uv.lock`, `go.sum`, `Cargo.lock`, `gradle.lockfile`, `packages.lock.json`) and install in CI with frozen, reproducible commands (`npm ci`, `pnpm install --frozen-lockfile`, `uv sync --locked`, `go mod download` with `-mod=readonly`).
- **[MANDATORY]** Scan dependencies on every pull request and daily on the default branch with an SCA tool (OSV-Scanner, Trivy, Grype, Snyk, Dependabot alerts, or ecosystem tools such as `npm audit`, `pip-audit`, `govulncheck`, `cargo audit`), failing on new critical or high vulnerabilities that have a fix available.
- **[PATTERN]** Automate updates with Renovate or Dependabot: grouped minor and patch updates, security updates prioritized, automerge only for low-risk updates with passing tests, and a dependency dashboard to track backlog.
- **[PATTERN]** Prefer reachability-aware tools and data (`govulncheck`, CodeQL-based or vendor reachability analysis) to prioritize vulnerabilities in code paths actually used, while still tracking unreachable ones.
- **[SECURITY]** Prevent dependency confusion and typosquatting: scope internal packages (`@company/`), configure registries so internal names resolve only from the private registry, use a proxy/mirror (Artifactory, Nexus, cloud artifact registries) with allow-lists, and review new dependencies before adding them.
- **[SECURITY]** Disable or restrict install-time scripts where possible (`npm ci --ignore-scripts` with explicit allow-lists, pnpm `onlyBuiltDependencies`), and verify package integrity with lock-file hashes and registry signatures or provenance where the ecosystem supports it (`npm audit signatures`).
- **[MANDATORY]** Generate an SBOM (CycloneDX or SPDX) for every release artifact and store it with the release so newly disclosed vulnerabilities can be matched to deployed versions.
- **[PATTERN]** Enforce license policy automatically: allowed, review-required, and denied licenses defined by legal, checked in CI (for example with ORT, Trivy license scanning, or ecosystem license checkers).
- **[FORBIDDEN]** Unpinned version ranges in application manifests without lock files, `curl | sh` installs of tooling in builds, vendoring modified third-party code without tracking its origin, and ignoring vulnerability alerts without a documented risk decision.
- **[PATTERN]** Review dependency health when adding or periodically: maintenance activity, number of maintainers, OpenSSF Scorecard, known abandonment; minimize dependencies for trivial functionality.
- **[TESTING]** Updates are validated by the full test suite; security exceptions (accepted risks, VEX statements) have an owner and expiry, and CI reports dependency age and vulnerability SLA compliance.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
