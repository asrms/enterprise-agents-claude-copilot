---
name: runbooks
description: "Writing and maintaining operational runbooks: one runbook per alert or procedure, a consistent structure (purpose, impact, diagnosis, mitigation, escalation, verification), copy-pasteable commands with safe defaults, links to dashboards and logs, ownership and review dates, runbooks as code next to services, and automating repetitive steps. Use it when creating or reviewing runbooks for alerts, incidents, and routine operations."
---

# Skill: Runbooks

## Implementation Rules:
- **[MANDATORY]** Every paging alert links to a runbook, and every routine operational procedure (failover, key rotation, restore, scaling, maintenance) has one; a runbook is written for an on-call engineer who does not know the service well, under time pressure.
- **[MANDATORY]** Use a consistent structure: title and scope, what the alert or procedure means, user impact, quick checks (dashboards, recent deploys and config changes), diagnosis steps, mitigation options ordered from safest to riskiest, escalation contacts, verification that the system recovered, and follow-up tasks.
- **[PATTERN]** Make steps executable: exact commands and queries with placeholders clearly marked (`<namespace>`), read-only commands first, expected output described, and dangerous steps flagged with the risk and required approvals.
- **[PATTERN]** Link rather than duplicate: dashboards, log queries, trace searches, architecture diagrams, and dependency owners are linked directly with pre-filled parameters.
- **[MANDATORY]** Each runbook has an owner and a last-reviewed date, is stored as code in version control next to the service (or in a docs-as-code site) and reviewed after every incident that used it.
- **[PATTERN]** Automate repeated steps: once a mitigation is performed the same way several times, turn it into a script, a runbook automation (for example a ChatOps command or an automation document), or self-healing, keeping the runbook as the entry point.
- **[FORBIDDEN]** Runbooks that say only "investigate and fix", steps depending on one person's knowledge or credentials, outdated commands that no longer work, and secrets embedded in runbooks.
- **[SECURITY]** Runbooks that require privileged access specify the just-in-time access path and approvals, and avoid instructions that disable security controls without an explicit decision.
- **[PATTERN]** Keep runbooks short and scannable: numbered steps, decision points expressed as clear conditions ("if the error rate is only in one region, go to step 6"), and a summary at the top for the most common case.
- **[PATTERN]** Tag runbooks by service, alert name, and failure mode so they can be found from alerts, chat, and search.
- **[TESTING]** Exercise runbooks during game days and onboarding (a new team member follows it in staging), verify links and commands automatically where possible, and update them immediately when a step is found wrong.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
