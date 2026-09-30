---
name: code-review-practices
description: "Language-agnostic code review process: PR scope and size, review order (design, correctness, security, tests, readability), severity levels, evidence-based comments, author checklist, and review turnaround. Use it whenever you review a pull request or a diff in any language."
---

# Skill: Code Review Practices

## Implementation Rules:
- **[ARCHITECTURE]** Review in a fixed order of decreasing impact: (1) intent and design (does the change solve the stated problem in the right place?), (2) correctness and edge cases, (3) security and data handling, (4) tests, (5) performance and resource usage, (6) readability and naming, (7) style; never spend comments on step 7 while step 1–3 issues are open.
- **[MANDATORY]** Before commenting, read the PR description, the linked issue, and the full diff, then open the surrounding code of every modified function: a change is reviewed in its context, not line by line in isolation.
- **[MANDATORY]** Classify every comment with an explicit severity prefix: `blocker:` (bug, security flaw, data loss, broken contract), `major:` (design or maintainability issue that must be fixed in this PR), `minor:` (should be fixed, can be a follow-up with a ticket), `nit:` (optional polish), `question:` (clarification, no change requested), `praise:` (something done well).
- **[MANDATORY]** Every `blocker` and `major` comment contains evidence (`file:line`, input that triggers the problem, expected vs actual behavior) and a concrete proposal (code suggestion, alternative design, or reference to the violated rule).
- **[PATTERN]** Size budget: PRs above ~400 changed lines of production code (excluding generated files, lockfiles, and snapshots) are split before an in-depth review; ask for a stacked sequence (refactoring PR → behavior PR → cleanup PR) instead of reviewing a mixed change.
- **[FORBIDDEN]** Mixing refactoring, formatting, and behavior changes in the same commit without saying so: request that mechanical changes (renames, moves, formatter runs) live in separate commits so the behavioral diff is readable.
- **[PATTERN]** Correctness checklist: null/empty/boundary inputs, error paths and their cleanup, concurrency and shared state, idempotency of retries, time zones and locale, integer overflow and floating-point money, off-by-one in pagination and ranges, backward compatibility of public APIs, events, and database schemas.
- **[SECURITY]** Every diff touching input handling, authentication, authorization, queries, file paths, deserialization, cryptography, secrets, logging, or dependencies gets the security checklist of `secure-coding-fundamentals`; escalate to a dedicated security review when the change alters a trust boundary.
- **[TESTING]** A behavior change without a test that fails before the change and passes after is a `major` finding; a bug fix without a regression test is a `blocker` unless the author justifies why it cannot be tested.
- **[PATTERN]** Verify claims instead of trusting them: run the tests locally or read the CI results, check that new tests actually exercise the new branch (coverage diff), and reproduce reported bugs when the fix is not obvious.
- **[FORBIDDEN]** Rubber-stamp approvals ("LGTM" on a diff you did not read), approving with unresolved `blocker` comments, and style comments that a formatter or linter should enforce: propose adding the rule to the linter configuration instead.
- **[PATTERN]** Automate the mechanical part so humans review design: formatter, linter, type checker, SAST, dependency scanning, and coverage run in CI before the human review; the reviewer checks their results, not their job.
- **[CONFIGURATION]** Repository rules: branch protection with at least one required approval (two for security-sensitive or critical paths), `CODEOWNERS` for ownership of critical folders, required status checks, and dismissal of stale approvals when new commits are pushed.
- **[PATTERN]** Turnaround: first response within one working day; if the review cannot be completed, say so and give a date; large or risky changes get a synchronous walkthrough before the written review.
- **[PATTERN]** Author checklist expected in the PR description: problem and solution summary, screenshots or API examples for visible changes, test evidence, migration and rollback notes, feature flags, and known limitations.
- **[MANDATORY]** Close the loop: the reviewer resolves their own threads after verifying the fix, `minor`/`nit` items deferred to follow-ups are tracked in tickets linked from the PR, and the final approval summarizes what was verified.
- **[TESTING]** For generated code, dependency bumps, and migrations, review the source of truth (generator input, changelog and breaking changes, migration script and its reversibility) instead of the generated output.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
