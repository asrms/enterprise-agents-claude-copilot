---
name: incident-response-postmortem
description: "Operational incident management and learning: severity definitions, declaring incidents early, incident commander and roles, communication cadence and status pages, mitigation before root cause, timelines, handoffs, blameless postmortems with contributing factors, action items with owners, and tracking learning across incidents. Use it when defining an incident process, running an incident, or writing and reviewing a postmortem."
---

# Skill: Incident Response and Postmortems

## Implementation Rules:
- **[MANDATORY]** Define incident severities with objective criteria (user impact, data loss or exposure, revenue impact, SLO burn) and the expected response for each (who is paged, communication cadence, whether a postmortem is required).
- **[MANDATORY]** Declare incidents early and cheaply: anyone can declare, it is fine to downgrade later, and each incident gets a dedicated channel, a ticket, and a running timeline from the start.
- **[PATTERN]** Assign roles for significant incidents: incident commander (coordinates and decides, does not debug), operations lead(s) (investigate and mitigate), communications lead (stakeholders and status page), and scribe; hand off roles explicitly with a summary.
- **[MANDATORY]** Mitigate first, then investigate: roll back, disable the feature flag, fail over, shed load, or scale out to stop user impact before hunting for the root cause.
- **[PATTERN]** Communicate on a fixed cadence (for example every 30 minutes for major incidents) with status, impact, current actions, and next update time, using templates for internal updates and the public status page.
- **[SECURITY]** Security incidents (suspected breach, leaked credentials, data exposure) follow the security incident process with the security team, evidence preservation, restricted channels, and legal and privacy involvement for notification obligations.
- **[MANDATORY]** Write a blameless postmortem for every incident at or above the agreed severity within a set time (for example five business days): summary, impact with numbers, timeline, detection, response, contributing factors, what went well, where we got lucky, and action items.
- **[PATTERN]** Analyze contributing factors systemically (technical, process, organizational, tooling) rather than stopping at a single root cause or human error; ask how the system allowed the error and how it could be detected sooner.
- **[MANDATORY]** Action items are specific, owned, prioritized, and tracked to completion (prevention, detection, mitigation categories), with priorities agreed with product owners and reviewed in reliability meetings.
- **[FORBIDDEN]** Blaming individuals, postmortems that list only "be more careful", closing incidents without confirming recovery, and action items without owners or due dates.
- **[PATTERN]** Share and learn across teams: publish postmortems internally, review them in regular learning sessions, tag incidents by category, and look for recurring patterns.
- **[TESTING]** Practice the process with game days and tabletop exercises, including role rotation and communication drills, and measure time to detect, acknowledge, mitigate, and resolve.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
