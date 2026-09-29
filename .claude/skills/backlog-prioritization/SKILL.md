---
name: backlog-prioritization
description: "Prioritizing product backlogs with transparent methods: outcome-based roadmaps, WSJF and Cost of Delay, RICE scoring, MoSCoW for fixed-scope releases, Kano analysis, value vs effort, balancing features with technical debt, risk and compliance work, and communicating decisions. Use it when ordering a backlog, planning a release, or reviewing prioritization decisions."
---

# Skill: Backlog Prioritization

## Implementation Rules:
- **[MANDATORY]** Prioritize against explicit goals: every epic and significant item links to an objective or outcome metric (conversion, retention, cost, risk reduction), and items without a clear link are questioned before being scheduled.
- **[PATTERN]** Use a transparent scoring method suited to the context and apply it consistently: WSJF (Cost of Delay divided by job size, where Cost of Delay combines user and business value, time criticality, and risk reduction or opportunity enablement) for flow-based planning, RICE (Reach x Impact x Confidence / Effort) for product discovery, and value vs effort for quick triage.
- **[PATTERN]** Use MoSCoW only for time-boxed releases with a fixed deadline, keeping Must-haves well below total capacity (for example no more than 60% of effort) so the date is achievable.
- **[MANDATORY]** Make confidence explicit: low-confidence estimates of value or effort are flagged, and cheap experiments, prototypes, or spikes raise confidence before large investments.
- **[PATTERN]** Reserve capacity deliberately for non-feature work: technical debt, security and compliance obligations, reliability actions from postmortems, and maintenance (for example a fixed percentage per iteration or error-budget-driven allocation).
- **[PATTERN]** Treat regulatory deadlines, security vulnerabilities with SLAs, and contractual commitments as constraints that override scores, documented as such.
- **[FORBIDDEN]** Prioritizing by the loudest stakeholder or the most recent request, hidden priority changes without communication, everything marked "high priority", and backlogs of hundreds of stale items nobody reviews.
- **[PATTERN]** Keep the backlog healthy: only the next few iterations are refined in detail, older low-priority items are archived periodically, and duplicates are merged.
- **[PATTERN]** Order by sequence, not by labels: the backlog is a single ordered list (or a small number of ranked lanes), so the next item to work on is always clear.
- **[MANDATORY]** Communicate decisions: publish the roadmap as outcomes and time horizons (now, next, later) rather than fixed dates for everything, and explain why items moved.
- **[TESTING]** Review outcomes after delivery: did the item move the target metric, was the value estimate accurate, and use the learning to calibrate future scoring.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
