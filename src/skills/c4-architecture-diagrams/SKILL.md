---
name: c4-architecture-diagrams
description: "Architecture diagrams with the C4 model as code: system context, container, component, and dynamic/deployment views; notation rules (titles, legends, labeled relationships with protocols), Structurizr DSL, Mermaid C4, or PlantUML C4, and keeping diagrams versioned next to the code. Use it when documenting or reviewing a software architecture."
---

# Skill: C4 Architecture Diagrams

## Implementation Rules:
- **[ARCHITECTURE]** Use the C4 levels for their audience: System Context (the system, its users, and external systems — for everyone), Container (deployable/runnable units: apps, services, databases, queues — for technical stakeholders), Component (major building blocks inside one container — for developers of that container); code-level diagrams only when generated from code.
- **[MANDATORY]** Every system has at least a System Context and a Container diagram; Component diagrams are drawn only for complex containers; supplementary Dynamic (runtime sequence of a key scenario) and Deployment (mapping of containers to infrastructure per environment) diagrams are added for critical flows and production.
- **[MANDATORY]** Diagrams as code, versioned with the system (`docs/architecture/`): Structurizr DSL (single model, many views), Mermaid `C4Context`/`C4Container` for Markdown-native rendering, or C4-PlantUML; no binary diagram files as the source of truth.
- **[MANDATORY]** Notation rules: each diagram has a title and a key/legend; each element shows name, type (Person, Software System, Container: technology, Component), and a one-line responsibility; each relationship is a single-direction arrow labeled with intent and, at container level, the protocol/technology ("Places orders [HTTPS/JSON]", "Publishes OrderPlaced [AMQP]").
- **[FORBIDDEN]** Unlabeled arrows, bidirectional arrows that hide who initiates the call, mixed abstraction levels in one diagram (a class next to a Kubernetes cluster), and boxes named only after technology ("Spring Boot", "Postgres") without responsibility.
- **[PATTERN]** Show external systems and people explicitly with their boundary (inside vs outside the organization/system scope); highlight trust boundaries and where authentication happens for security reviews.
- **[PATTERN]** One model, many views: define elements once (Structurizr workspace) and derive context, container, component, and deployment views so names and relationships stay consistent.
- **[PATTERN]** Keep diagrams small enough to read: around 5–20 elements; split by subsystem or scenario rather than drawing everything on one canvas.
- **[CONFIGURATION]** Render diagrams in CI (Structurizr CLI export, `mmdc` for Mermaid, PlantUML) and publish them with the documentation; the build fails if the diagram source does not compile.
- **[PATTERN]** Link diagrams and decisions: ADRs reference the diagrams they affect, and diagram changes are part of the PR that changes the architecture.
- **[SECURITY]** Do not publish internal hostnames, IP addresses, credentials, or detailed network topology in diagrams stored in public repositories; use logical names.
- **[TESTING]** Review diagrams against reality periodically (or generate parts from infrastructure/code metadata) and remove elements that no longer exist; an outdated diagram is flagged in the documentation.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
