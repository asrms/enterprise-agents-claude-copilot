---
name: domain-discovery-event-storming
description: "Collaborative domain discovery for requirements and design: Big Picture and process-level EventStorming (domain events, commands, actors, policies, read models, external systems, hotspots), domain storytelling, building a ubiquitous language glossary, identifying bounded context candidates, and turning discoveries into stories and models. Use it when starting a new domain, onboarding to a complex business process, or aligning business and engineering understanding."
---

# Skill: Domain Discovery with EventStorming

## Implementation Rules:
- **[MANDATORY]** Run discovery with the right people together: domain experts, product, engineers, UX, and operations; a facilitator keeps the session focused and inclusive, in person or on a shared online board.
- **[PATTERN]** Start with Big Picture EventStorming: place domain events (orange, past tense, meaningful to the business: "Order Placed", "Payment Captured") on a timeline, then enforce the timeline, and mark hotspots (pink) for questions, conflicts, and pain points.
- **[PATTERN]** Enrich the timeline progressively: actors and people (yellow), commands (blue), policies or reactions ("whenever X, then Y", lilac), read models or information needed for decisions (green), and external systems (pink/large).
- **[MANDATORY]** Capture the language as it is spoken: build a glossary of domain terms with definitions and synonyms, resolve ambiguities (for example, what "customer" means in sales vs billing), and use the same terms in stories, code, and APIs.
- **[PATTERN]** Identify pivotal events and swimlanes that separate parts of the process, and use them to propose candidate bounded contexts and team ownership, validated later with context mapping.
- **[PATTERN]** Use domain storytelling as a complementary technique for concrete scenarios (actors, work objects, activities in numbered sentences) when a narrative helps business experts more than a timeline.
- **[MANDATORY]** Treat hotspots as work items: each one gets an owner and a follow-up (decision, research, or spike) rather than being forgotten after the workshop.
- **[FORBIDDEN]** Modeling the database or technical components during discovery, events phrased as technical actions ("Row Inserted", "API Called"), and sessions without domain experts where engineers guess the business process.
- **[PATTERN]** Go to process-level or design-level EventStorming for the chosen scope to define commands, aggregates or consistency boundaries, and business rules in enough detail to write stories and acceptance criteria.
- **[PATTERN]** Document outcomes right away: photos or board exports, a cleaned-up event timeline, glossary, candidate contexts, and hotspot list in the repository or wiki, linked from the backlog.
- **[TESTING]** Validate the model by walking through real scenarios, including exceptional paths (cancellations, failures, refunds), with domain experts, and revisit it when new requirements contradict it.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
