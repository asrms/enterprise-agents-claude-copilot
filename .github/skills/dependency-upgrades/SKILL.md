---
name: dependency-upgrades
description: "Keeping third-party dependencies current in legacy and active codebases: inventory and risk assessment, automated update tooling (Renovate, Dependabot), update cadence and grouping, reading changelogs for breaking changes, handling major versions and transitive conflicts, replacing abandoned or vulnerable libraries, adapters to isolate libraries, and verifying upgrades with tests. Use it when a codebase has outdated dependencies or when planning a dependency update strategy."
---

# Skill: Dependency Upgrades

## Implementation Rules:
- **[MANDATORY]** Inventory dependencies with their current and latest versions, age (libyear), known vulnerabilities, license, and maintenance status, using ecosystem tools (`mvn versions:display-dependency-updates`, `./gradlew dependencyUpdates`, `npm outdated`, `pip list --outdated`, `go list -m -u all`, `dotnet list package --outdated`) and SCA reports.
- **[MANDATORY]** Update continuously in small increments with Renovate or Dependabot rather than rare big-bang upgrades; group related packages (framework families, test tooling) and schedule updates so the team can review them regularly.
- **[PATTERN]** Prioritize by risk: security fixes first, then end-of-life components, then libraries blocking framework upgrades, then routine updates; treat major versions as planned work items.
- **[MANDATORY]** Read release notes and migration guides for every major version and for minor versions of critical libraries (serialization, security, database drivers), and search the codebase for affected APIs before merging.
- **[PATTERN]** Resolve transitive conflicts explicitly: use BOMs and platform constraints (Maven `dependencyManagement`, Gradle platforms, npm `overrides`, pnpm `overrides`, pip constraints files) and document why each override exists.
- **[PATTERN]** Isolate libraries behind small adapters or ports in your own code, so replacing or upgrading a library touches one place instead of hundreds.
- **[PATTERN]** Replace abandoned, unmaintained, or problematic libraries with maintained alternatives or standard library features, migrating incrementally behind the adapter.
- **[FORBIDDEN]** Pinning to old versions indefinitely without a documented reason and review date, ignoring update pull requests until they pile up, upgrading many major versions in one untested step, and vendoring patched copies of libraries without tracking upstream.
- **[PATTERN]** Remove unused dependencies (dependency analysis tools such as `mvn dependency:analyze`, depcheck or knip, deptry) to reduce the upgrade and attack surface.
- **[SECURITY]** Verify new versions come from trusted sources: lock files with integrity hashes, a minimum release age before adoption to avoid compromised releases, and review of new transitive dependencies.
- **[TESTING]** Merge updates only with passing CI including integration and contract tests; automerge only low-risk updates with good test coverage; monitor after deployment and be ready to roll back.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
