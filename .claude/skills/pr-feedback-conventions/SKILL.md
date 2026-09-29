---
name: pr-feedback-conventions
description: "How to write and receive pull request feedback: Conventional Comments labels, respectful and specific wording, suggestions as code, questions instead of assumptions, resolving disagreements, and the final review summary. Use it when writing review comments or responding to them."
---

# Skill: PR Feedback Conventions

## Implementation Rules:
- **[MANDATORY]** Use Conventional Comments labels at the start of every comment: `blocker:`, `issue:`, `suggestion:`, `nitpick:`/`nit:`, `question:`, `thought:`, `todo:`, `praise:`, optionally with decorations `(non-blocking)`, `(blocking)`, `(security)`, `(if-minor)`.
- **[MANDATORY]** Comment on the code, not the person: "this function mutates its input" instead of "you mutated the input"; no sarcasm, no "just", "obviously", "simply", or "why didn't you".
- **[PATTERN]** Ask when you are not sure: "question: is `retryCount` reset when the circuit closes? I couldn't find where" invites an explanation instead of asserting a bug that may not exist.
- **[PATTERN]** Be specific and actionable: point to the exact line, describe the consequence (what breaks, for whom, under which input), and propose a fix; use the platform's suggestion blocks (```` ```suggestion ````) for small changes so the author can apply them in one click.
- **[PATTERN]** Explain the why and link the standard: reference the rule, skill, ADR, style guide, or documentation behind a request, so feedback is about shared agreements rather than personal preference.
- **[FORBIDDEN]** Blocking a PR on personal preference: preferences are `nit:` or `thought:` and explicitly non-blocking; if a preference matters to the team, propose it as a lint rule or a guideline change.
- **[PATTERN]** Limit the volume: group repeated occurrences into one comment ("same pattern in 4 places: A, B, C, D"), and if there are more than ~20 comments or a fundamental design concern, stop and talk synchronously instead of continuing in writing.
- **[MANDATORY]** Give praise where it is due with `praise:`: specific acknowledgement ("the table-driven tests make the edge cases obvious") reinforces good practices.
- **[PATTERN]** As an author: reply to every comment (`Done in abc123`, `Fixed`, or a reasoned answer), do not resolve threads opened by others unless the team agrees otherwise, and push fixes as new commits during review so reviewers can see the delta.
- **[PATTERN]** Disagreements: state the trade-off with evidence (benchmarks, docs, incidents), escalate after two rounds to a synchronous conversation or to the code owner/tech lead, and record the decision in the PR (or in an ADR if it sets a precedent).
- **[MANDATORY]** End the review with a summary comment and an explicit state: *Approve*, *Comment*, or *Request changes*, listing the blocking items and what was verified (tests run, areas not reviewed).
- **[SECURITY]** Security findings in public repositories are not described with exploit details in PR comments; state the risk briefly, mark it `(security)`, and move details to a private channel or a security advisory.
- **[CONFIGURATION]** Provide a `PULL_REQUEST_TEMPLATE.md` with summary, motivation/issue link, test evidence, screenshots, risk and rollback, and a checklist, so reviewers do not have to ask for basic context.
- **[PATTERN]** Language and tone for international teams: short sentences, no idioms, explicit subject; write in the team's working language consistently.
- **[TESTING]** When requesting tests, describe the case precisely (inputs and expected outcome) instead of "add more tests".
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
