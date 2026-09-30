---
name: ux-heuristics-usability
description: "Evaluating and improving usability: Nielsen's 10 usability heuristics, heuristic evaluation with severity ratings, cognitive walkthroughs of key tasks, common interaction patterns (navigation, forms, feedback, error prevention and recovery, empty and loading states), usability metrics such as task success, time on task, and SUS, and prioritizing fixes. Use it when designing interfaces or reviewing the usability of screens and flows."
---

# Skill: UX Heuristics and Usability

## Implementation Rules:
- **[MANDATORY]** Review designs and implemented flows against Nielsen's 10 heuristics: visibility of system status, match with the real world, user control and freedom, consistency and standards, error prevention, recognition rather than recall, flexibility and efficiency, aesthetic and minimalist design, help users recognize and recover from errors, and help and documentation.
- **[PATTERN]** Run heuristic evaluations with several evaluators independently, then merge findings; rate each issue's severity (0 not a problem to 4 usability catastrophe) considering frequency, impact, and persistence.
- **[PATTERN]** Walk through the primary tasks step by step (cognitive walkthrough): will users know what to do, see how to do it, understand the feedback, and know they made progress?
- **[MANDATORY]** Design every state of a screen: loading (skeletons or progress with meaning), empty (explanation and next action), error (what happened, why, and how to fix it), partial data, success confirmation, and offline or slow network behavior.
- **[PATTERN]** Prevent errors before handling them: sensible defaults, constraints on input, confirmation only for destructive or irreversible actions, undo where possible, and inline validation after the user leaves a field.
- **[PATTERN]** Follow platform and web conventions (link and button behavior, back navigation, standard icons with labels, primary action placement) unless there is strong evidence for a change.
- **[PATTERN]** Reduce cognitive load: progressive disclosure, clear visual hierarchy, grouping related fields, one primary action per screen or section, and plain language.
- **[FORBIDDEN]** Mystery meat navigation (unlabeled icons), disabled buttons without explanation, modal dialogs for non-critical information, error messages with codes only, and dark patterns (pre-checked upsells, confirmshaming, hidden cancellation).
- **[MANDATORY]** Measure usability of key tasks: task success rate, time on task, error rate, and System Usability Scale (SUS) or single ease question scores, compared across releases.
- **[PATTERN]** Prioritize findings by severity and business impact, turn them into backlog items with screenshots and recommendations, and re-evaluate after fixes.
- **[TESTING]** Validate important changes with real users (moderated or unmoderated usability tests with five or more participants per round) in addition to expert reviews, and monitor behavioral analytics (drop-off, rage clicks) in production.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
