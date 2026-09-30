---
name: root-cause-analysis
description: "Systematic debugging and root cause analysis: defining the symptom precisely, forming and testing hypotheses one at a time, the scientific method for bugs, divide and conquer, reading error messages and stack traces carefully, comparing working vs failing states, five whys and causal factor analysis for systemic causes, fixing root causes rather than symptoms, and documenting findings. Use it when investigating any defect, failure, or unexpected behavior."
---

# Skill: Root Cause Analysis

## Implementation Rules:
- **[MANDATORY]** Define the problem precisely before changing anything: expected vs actual behavior, exact error messages and stack traces, when it started, how often it happens, which users, environments, versions, and inputs are affected, and which are not.
- **[MANDATORY]** Work with explicit hypotheses: write down a candidate cause, predict what you would observe if it were true, run the smallest experiment that can confirm or refute it, and record the result before moving to the next hypothesis.
- **[PATTERN]** Narrow the search space systematically: compare working and failing cases (versions, configurations, data, environments), bisect over commits (`git bisect`), inputs, or components, and add targeted instrumentation where visibility is missing.
- **[PATTERN]** Read the evidence fully: the first error in logs (not the last cascading one), the whole stack trace including "caused by" chains, correlated traces across services, and recent changes (deploys, configuration, feature flags, dependency updates, infrastructure events).
- **[PATTERN]** Question assumptions explicitly ("the cache is invalidated on update", "this code path is not used") and verify them with data, since bugs usually live where assumptions are wrong.
- **[MANDATORY]** Distinguish the trigger, the root cause, and contributing factors; ask "why" repeatedly (five whys) until reaching causes you can act on, and look for systemic factors (missing tests, unclear contracts, lack of validation, monitoring gaps) rather than blaming people.
- **[FORBIDDEN]** Changing several things at once and hoping, "fixing" by adding retries, sleeps, or broad catch blocks that hide the symptom, closing bugs as "cannot reproduce" without investigation, and declaring a root cause without evidence.
- **[PATTERN]** Fix at the right level: correct the defect where it originates, add input validation or invariants to fail fast, and remove the conditions that allowed it (types, constraints, tests), not only the specific instance.
- **[MANDATORY]** Add a regression test that fails before the fix and passes after it, at the lowest level that reproduces the defect.
- **[PATTERN]** Record the analysis: symptom, timeline, hypotheses tested, evidence, root cause, fix, and follow-up actions in the ticket or a postmortem, so the knowledge is shared.
- **[TESTING]** Verify the fix in the environment where the problem occurred (with monitoring confirming the symptom is gone), and check for similar defects elsewhere in the codebase (same pattern, copy-pasted code).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
