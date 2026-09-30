---
name: user-stories-invest
description: "Writing and refining user stories: the As a / I want / So that format grounded in real users, INVEST quality criteria, vertical slicing patterns (workflow steps, business rules, data variations, happy path first), story mapping, splitting epics, spikes, definition of ready and done, and avoiding technical tasks disguised as stories. Use it when writing, reviewing, or splitting backlog items."
---

# Skill: User Stories (INVEST)

## Implementation Rules:
- **[MANDATORY]** Write stories from a real user or role perspective with the value made explicit: "As a <role>, I want <capability>, so that <benefit>"; the role is a specific persona or actor (warehouse clerk, returning customer), never "the user" or "the system".
- **[MANDATORY]** Check every story against INVEST: Independent (can be delivered in any order where possible), Negotiable (describes the need, not a fixed solution), Valuable (a user or stakeholder notices the change), Estimable, Small (fits comfortably in an iteration, ideally a few days), and Testable (has acceptance criteria).
- **[PATTERN]** Slice vertically through all layers (UI, API, data) so each story delivers working, demonstrable behavior; split by workflow step, business rule variation, data type or channel, user role, happy path before edge cases, or simple before complex.
- **[PATTERN]** Build a story map for new features: user activities as the backbone, steps beneath, and stories ordered by priority into release slices, so the first release is a thin but complete end-to-end journey.
- **[FORBIDDEN]** Technical layers as stories ("create the database table", "build the API"), stories whose value is "so that the code is done", solution-dictating descriptions without the underlying need, and giant epics carried across many iterations.
- **[PATTERN]** Use spikes, time-boxed and with a clear question and output, when uncertainty prevents estimation; the result is a decision or knowledge, followed by real stories.
- **[MANDATORY]** Every story has acceptance criteria before it enters an iteration (see the acceptance criteria skill), plus relevant non-functional constraints (performance, security, accessibility, privacy) either in the story or referenced from shared standards.
- **[PATTERN]** Agree on a lightweight definition of ready (value clear, criteria present, dependencies known, small enough, UX available if needed) and a definition of done (code reviewed, tests automated, documentation and monitoring updated, deployed to an environment, accepted by the product owner).
- **[PATTERN]** Refine collaboratively (product, engineering, QA, design in "three amigos" sessions), capturing examples and open questions in the story rather than in private conversations.
- **[PATTERN]** Link stories to their epic, objective, or outcome metric so priorities and trade-offs stay traceable to business goals.
- **[TESTING]** Review backlog health regularly: story size distribution, stories carried over between iterations, percentage of stories with acceptance criteria before start, and rework caused by unclear requirements.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
