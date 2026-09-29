---
name: dead-code-removal
description: "Finding and safely removing dead and unused code: static analysis for unreachable and unused symbols (IDE inspections, knip, ts-prune successors, vulture, deadcode for Go, compiler warnings), runtime evidence with coverage and production telemetry, removing stale feature flags, unused endpoints, database objects, and configuration, deprecation periods for public APIs, and deleting with confidence. Use it when cleaning up legacy code or reducing maintenance and attack surface."
---

# Skill: Dead Code Removal

## Implementation Rules:
- **[MANDATORY]** Establish evidence that code is unused before deleting it: static analysis (unreferenced symbols and files) combined with runtime evidence (production coverage, endpoint access logs, feature flag evaluation data, database query statistics) over a representative period that includes periodic jobs such as month-end or year-end.
- **[PATTERN]** Use the right tools per ecosystem: IDE inspections and compiler warnings (unused imports, private members), knip for JavaScript and TypeScript projects, vulture or ruff rules for Python, the `deadcode` tool and `staticcheck` for Go, analyzers such as IDE0051/IDE0052 for .NET, and Rust compiler dead code lints.
- **[PATTERN]** Check reflective and dynamic usage before deleting: dependency injection, serialization, scripting, configuration-driven class names, public APIs used by other repositories, and code invoked by external systems or cron jobs.
- **[MANDATORY]** Treat public interfaces carefully: for APIs, events, and libraries consumed outside the codebase, deprecate first (headers, changelog, notices), measure remaining usage, and remove after the announced date.
- **[PATTERN]** Remove stale feature flags promptly: when a flag has been fully on or off for longer than its expected lifetime, delete the flag check, the dead branch, and the flag definition in the flag system.
- **[PATTERN]** Clean up the surroundings too: tests for deleted code, configuration properties, environment variables, database tables and columns (through expand-and-contract migrations), scheduled jobs, dashboards, alerts, and documentation.
- **[FORBIDDEN]** Commenting code out instead of deleting it (version control keeps history), keeping unused code "just in case", deleting code that only appears unused because tests do not cover it, and mixing large deletions with behavior changes in one pull request.
- **[PATTERN]** Delete in small, focused pull requests that are easy to review and revert, with a note on the evidence used.
- **[SECURITY]** Prioritize removal of unused endpoints, debug features, old authentication paths, and unused dependencies, because they expand the attack surface without providing value.
- **[PATTERN]** Prevent new dead code: lint rules for unused code in CI, required removal tasks for flags and temporary code, and code ownership that makes someone responsible for each module.
- **[TESTING]** After deletion, run the full test suite, verify builds of dependent projects, monitor error rates and 404/410 responses for removed endpoints, and keep the change easy to revert.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
