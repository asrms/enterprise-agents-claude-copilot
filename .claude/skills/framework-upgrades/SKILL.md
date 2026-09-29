---
name: framework-upgrades
description: "Planning and executing major runtime and framework upgrades: Java 8/11/17 to 21 and Spring Boot 2 to 3 (Jakarta EE namespaces), .NET Framework to modern .NET, AngularJS to Angular, Python 2 to 3 and older Python versions, Node.js LTS moves, and similar migrations, using automated tools (OpenRewrite, .NET Upgrade Assistant, ng update, pyupgrade, codemods), incremental steps, compatibility layers, and verification. Use it when upgrading a major version of a language, runtime, or framework."
---

# Skill: Framework Upgrades

## Implementation Rules:
- **[MANDATORY]** Assess before changing: inventory the current versions, end-of-support dates, dependencies and their compatibility with the target version, deprecated APIs in use, build tooling, and test coverage; publish an upgrade plan with steps and risks.
- **[PATTERN]** Upgrade in small, releasable steps: move through supported intermediate versions where the vendor recommends it (for example Spring Boot 2.7 before 3.x, each Angular major in sequence with `ng update`), keeping the application deployable after each step.
- **[MANDATORY]** Use automated migration tools wherever they exist: OpenRewrite recipes (Java version, Spring Boot 3, `javax` to `jakarta`), .NET Upgrade Assistant and analyzers, `ng update` schematics, pyupgrade and ruff rules for Python syntax, framework codemods for JavaScript; review their output like any other change.
- **[PATTERN]** Separate mechanical changes (namespace moves, API renames, formatting) from behavioral changes in different commits or pull requests, so reviews focus on what matters.
- **[PATTERN]** Resolve deprecation warnings on the current version first, then upgrade; enable strict compiler and deprecation warnings as errors in CI to prevent new usages of removed APIs.
- **[PATTERN]** For large platform shifts that cannot be done in place (AngularJS to Angular, .NET Framework WebForms or WCF to ASP.NET Core), migrate incrementally side by side (hybrid mode, strangler routing, or YARP-based incremental migration) rather than rewriting everything at once.
- **[MANDATORY]** Upgrade dependencies together with the framework to compatible versions (BOMs, version catalogs), and replace abandoned libraries that block the upgrade.
- **[FORBIDDEN]** Skipping several majors in one untested jump, mixing the upgrade with feature work in the same pull request, suppressing new compiler warnings or analyzer errors to get a green build, and upgrading without reading the official migration guides and release notes.
- **[PATTERN]** Take advantage of the new version deliberately after the upgrade is stable (new language features, performance improvements such as virtual threads or native AOT), not during the upgrade itself.
- **[PERFORMANCE]** Compare performance and resource usage before and after (startup time, memory, throughput) with the same load test, since runtime and garbage collector changes can shift behavior.
- **[TESTING]** Establish a safety net before upgrading (characterization and integration tests for critical paths), run the full test suite and smoke tests at each step, and roll out gradually (canary) with the ability to roll back to the previous version.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
