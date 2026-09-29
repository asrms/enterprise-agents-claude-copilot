---
name: architecture-decision-records
description: "Documenting architecture decisions as ADRs: when a decision needs one, MADR/Nygard structure (context, options, decision, consequences), status lifecycle (proposed, accepted, superseded), storage next to the code, review process, and linking ADRs to code and fitness functions. Use it when making or reviewing a significant technical decision."
---

# Skill: Architecture Decision Records

## Implementation Rules:
- **[MANDATORY]** Write an ADR for every architecturally significant decision: choices that are costly to reverse or affect several teams (architecture style, data store, messaging, integration protocol, framework, deployment model, security model, public API conventions, build/runtime platform).
- **[ARCHITECTURE]** Store ADRs as Markdown in the repository they govern (`docs/adr/NNNN-short-title.md`, zero-padded incremental numbers), or in a dedicated architecture repository for cross-system decisions; they are versioned and reviewed through pull requests like code.
- **[PATTERN]** Use a consistent template (MADR or Nygard): Title, Status, Date, Deciders, Context and problem statement, Decision drivers (quality attributes and constraints), Considered options (at least two, including "do nothing" when realistic), Decision outcome with justification, Consequences (positive, negative, and risks), and Links.
- **[MANDATORY]** The context describes forces, not the solution: business goals, quality attribute requirements with numbers (e.g. "p95 < 200 ms at 500 rps", "RPO 5 minutes"), team skills, budget, regulatory constraints, and existing systems.
- **[MANDATORY]** Compare options against the same decision drivers, ideally in a small table with pros, cons, cost, and risk for each; state explicitly which driver was decisive.
- **[PATTERN]** Record negative consequences honestly (operational cost, new skills needed, lock-in, migration effort) and the mitigation or the conditions under which the decision should be revisited.
- **[MANDATORY]** Status lifecycle: `Proposed` → `Accepted` (or `Rejected`) → optionally `Deprecated` or `Superseded by ADR-NNNN`; accepted ADRs are immutable: a changed decision is a new ADR that supersedes the old one, and both link to each other.
- **[FORBIDDEN]** ADRs written after the fact to justify a decision already implemented without alternatives, ADRs without context or consequences, and editing an accepted ADR to change its meaning.
- **[PATTERN]** Keep ADRs short (one to two pages); detailed designs, diagrams, and benchmarks are linked (C4 diagrams, spike reports, proof-of-concept repositories) rather than pasted.
- **[PATTERN]** Review process: the ADR PR is reviewed by the affected teams and the architecture owner within an agreed time window; disagreements are captured in the ADR's options section rather than lost in chat.
- **[ARCHITECTURE]** Make decisions executable where possible: link each ADR to the fitness functions or architecture tests that enforce it (ArchUnit, dependency rules, lint rules, policy-as-code), so violations fail the build.
- **[PATTERN]** Keep an index (`docs/adr/README.md`) listing number, title, status, and date; tools such as adr-tools or log4brains can generate the index and a browsable site.
- **[SECURITY]** Decisions affecting security or privacy (authentication model, data residency, encryption, third-party data processors) include a short threat/privacy impact note and are reviewed by the security owner.
- **[TESTING]** Periodically revisit accepted ADRs (e.g. twice a year or at major releases): check whether the drivers still hold and whether the consequences materialized as expected; record the outcome.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
