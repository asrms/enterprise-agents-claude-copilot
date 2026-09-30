---
name: diagrams-as-code-mermaid
description: "Creating maintainable diagrams as code: Mermaid flowcharts, sequence, state, entity-relationship, class, and C4 diagrams, PlantUML and Structurizr DSL where appropriate, choosing the right diagram type, keeping diagrams small and focused, consistent notation and legends, rendering in Markdown platforms and doc sites, and validating diagrams in CI. Use it when documenting architecture, flows, or data models with diagrams."
---

# Skill: Diagrams as Code (Mermaid)

## Implementation Rules:
- **[MANDATORY]** Store diagrams as text in the repository next to the documentation they illustrate (Mermaid in Markdown, PlantUML, or Structurizr DSL), reviewed in pull requests like code; images exported from drawing tools are not the source of truth.
- **[PATTERN]** Choose the diagram type by question: C4 context and container diagrams for system structure, sequence diagrams for interactions over time, flowcharts for decisions and processes, state diagrams for lifecycles, entity-relationship diagrams for data models, and deployment diagrams for infrastructure.
- **[MANDATORY]** Keep each diagram focused on one message and audience, with a title and roughly fewer than 15-20 elements; split large diagrams into levels (C4 context, containers, components) instead of one diagram with everything.
- **[PATTERN]** Label everything meaningfully: element names with their type or technology, arrows with the action and protocol ("places order [HTTPS/JSON]"), and a legend when shapes or colors carry meaning.
- **[PATTERN]** Use Mermaid for diagrams embedded in Markdown on platforms that render it natively (GitHub, GitLab, Azure DevOps wikis, MkDocs, Docusaurus); use Structurizr DSL or PlantUML C4 when a single model must generate several consistent views.
- **[PATTERN]** Keep diagrams consistent with reality: generate them from code or infrastructure where possible (ER diagrams from schemas, dependency graphs from build files), and update hand-written diagrams in the same pull request as the change they describe.
- **[FORBIDDEN]** Unlabeled boxes and arrows, diagrams mixing abstraction levels (classes next to cloud regions), colors as the only way to convey meaning, and screenshots of whiteboards as permanent documentation.
- **[PATTERN]** Make diagrams accessible: provide a short text description or caption summarizing the key message, use accessible titles and descriptions (`accTitle` and `accDescr` in Mermaid), and do not rely on color alone.
- **[PATTERN]** Prefer stable layouts: declare elements in a logical order, use direction (`LR`, `TB`) intentionally, and group related elements with subgraphs or boundaries.
- **[TESTING]** Validate diagrams in CI by rendering them (Mermaid CLI `mmdc`, PlantUML, Structurizr CLI) so syntax errors fail the build, and review diagrams for accuracy during architecture reviews.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
