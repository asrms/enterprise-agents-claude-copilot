---
name: git-bisect
description: "Finding the commit that introduced a regression with git bisect: choosing good and bad revisions, automated bisection with git bisect run and exit codes (including 125 to skip), writing a reliable test script, handling untestable commits, flaky tests, and merges, bisecting dependency or configuration changes, and using the result to fix and prevent regressions. Use it when behavior worked in an older version and fails in a newer one."
---

# Skill: Git Bisect

## Implementation Rules:
- **[MANDATORY]** Confirm a known good revision (tag or commit where the behavior is correct) and a known bad revision before starting, reproducing the behavior on both; bisecting from wrong endpoints wastes time.
- **[MANDATORY]** Automate the check with `git bisect run <script>` whenever possible: the script exits 0 for good, 1-124 (typically 1) for bad, and 125 to skip a commit that cannot be tested; automated runs are faster and less error-prone than manual marking.
- **[PATTERN]** Write a focused, deterministic test script: build only what is needed, run the minimal reproduction (a single test or a small command) with a timeout, and distinguish "the bug is present" from "the build failed" (skip with 125 for unrelated build failures).
- **[PATTERN]** Keep the test outside the bisected history (for example in `/tmp` or passed as a file), because older commits do not contain new tests; copy the test in or run it against the built artifact.
- **[PATTERN]** Handle flaky behavior by repeating the check several times within the script and deciding on a clear rule (for example bad if it fails at least once in ten runs), and record the seed or conditions.
- **[PATTERN]** Use `git bisect skip` or exit code 125 for commits that do not build or are unrelated, and `git bisect log` / `git bisect replay` to save and resume sessions; `--first-parent` limits bisection to merge commits on the main branch when feature branches contain broken intermediate commits.
- **[PATTERN]** Bisect beyond code: lock file or dependency version ranges, configuration history, or container image tags, using the same good/bad discipline.
- **[FORBIDDEN]** Marking commits by guessing without running the check, bisecting with a dirty working tree, forgetting `git bisect reset` afterwards, and blaming the author of the identified commit instead of analyzing the change.
- **[PATTERN]** Analyze the identified commit: read the full diff and message, check whether it exposed an existing bug rather than creating it, and consider related changes in the same pull request.
- **[MANDATORY]** Turn the bisection test into a permanent regression test in the codebase with the fix.
- **[TESTING]** Keep history bisectable: small commits that build and pass tests individually (squash or rebase appropriately), so future regressions can be located quickly.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
