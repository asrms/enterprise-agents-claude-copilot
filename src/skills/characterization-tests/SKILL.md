---
name: characterization-tests
description: "Pinning down the current behavior of legacy code before changing it: characterization tests, golden master and approval testing (ApprovalTests, snapshot tests, Verify), finding and creating seams for testability, sensing and separation, sprout and wrap techniques, test data capture, handling non-determinism (time, randomness, ordering), and deciding which behaviors to keep. Use it when you must change code that has few or no tests."
---

# Skill: Characterization Tests

## Implementation Rules:
- **[MANDATORY]** Before modifying legacy code without tests, write characterization tests that capture what the code does today (not what it should do), covering the paths you are about to change.
- **[PATTERN]** Use golden master or approval testing for complex outputs: run the code with many representative inputs, store the outputs as approved files (ApprovalTests, Verify for .NET, Jest or pytest snapshots), and fail when outputs differ; review diffs deliberately.
- **[PATTERN]** Generate broad input coverage cheaply: combinations of parameters (combination approvals), samples of real anonymized data, and boundary values; measure coverage to find untested branches in the code you will touch.
- **[PATTERN]** Create seams to get code under test with minimal, safe edits: extract interfaces or parameters for dependencies (database, clock, network, file system), use subclass-and-override or link seams where necessary, and prefer automated refactorings in the IDE.
- **[MANDATORY]** Control non-determinism: inject clocks and random generators, sort unordered outputs, scrub volatile values (timestamps, generated ids) in approved outputs, and isolate external systems with fakes or recorded responses.
- **[PATTERN]** Add new behavior with sprout method or sprout class (new, tested code called from the legacy code) or wrap method or wrap class (decorate existing behavior), instead of growing untested legacy methods.
- **[PATTERN]** When characterization reveals suspicious behavior (a likely bug), record it in the test name or a comment and decide explicitly with the business whether to preserve or fix it; do not change behavior silently during refactoring.
- **[FORBIDDEN]** Refactoring legacy code before any safety net exists, approving snapshots without reading them, huge snapshot files nobody can review, and tests that depend on production systems or shared databases.
- **[PATTERN]** Keep characterization tests as a temporary scaffold where appropriate: once the code is refactored and covered by focused unit tests that express intent, replace brittle golden masters with clearer tests.
- **[PERFORMANCE]** Keep the suite fast enough to run on every change: fakes for slow dependencies, parallel execution, and targeted golden masters for the modules being changed.
- **[TESTING]** Prove the safety net works with mutation testing or by deliberately breaking the code under test to confirm tests fail, before relying on them for larger refactorings.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
