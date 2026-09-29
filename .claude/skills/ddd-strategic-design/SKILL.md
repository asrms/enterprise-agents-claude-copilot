---
name: ddd-strategic-design
description: "Strategic Domain-Driven Design: domain discovery with Event Storming, subdomain classification (core, supporting, generic), bounded contexts and ubiquitous language, context mapping patterns (customer-supplier, ACL, open host service, published language, shared kernel), and aggregate boundaries. Use it when decomposing a domain or defining service/module boundaries."
---

# Skill: DDD Strategic Design

## Implementation Rules:
- **[ARCHITECTURE]** Start from the business domain, not from the database or the org chart: run Event Storming (big picture, then process level) with domain experts to discover domain events, commands, actors, policies, read models, external systems, and hotspots.
- **[MANDATORY]** Classify subdomains: core (competitive advantage, build in-house with the best people and the richest model), supporting (necessary, specific, simpler solutions acceptable), generic (solved problems: buy, use SaaS or open source — identity, billing, email, payments).
- **[MANDATORY]** Define bounded contexts where a model and its language are consistent; each context has an explicit ubiquitous language (glossary with terms, definitions, and examples) and the same word may mean different things in different contexts ("Product" in Catalog vs Pricing vs Inventory).
- **[FORBIDDEN]** A single canonical enterprise data model shared by all services ("one Customer object for everything"), and splitting contexts by technical layer (UI service, data service) or by entity (CustomerService, OrderService with CRUD only).
- **[PATTERN]** Boundaries follow language changes, different rates of change, different owners/teams, and pivotal events; a good context can be owned by one team (Conway's law) and changed without coordinating with others most of the time.
- **[MANDATORY]** Draw a context map describing every relationship and its pattern: Partnership, Shared Kernel (small and co-owned), Customer–Supplier (upstream commits to downstream needs), Conformist, Anticorruption Layer (downstream translates upstream's model), Open Host Service with Published Language (stable, documented integration API/events), Separate Ways.
- **[PATTERN]** Protect core contexts with an Anticorruption Layer when integrating with legacy systems or external providers: translate their models into your ubiquitous language at the boundary and never let their concepts leak into the domain.
- **[PATTERN]** Integrate contexts through published contracts (APIs and domain/integration events with versioned schemas), not through shared databases; each context owns its data store.
- **[PATTERN]** Aggregates (tactical, but decided during strategic design): small consistency boundaries around invariants that must hold transactionally; reference other aggregates by identity; one aggregate per transaction; cross-aggregate consistency is eventual via domain events.
- **[PATTERN]** Distinguish domain events (internal, rich in the context's language) from integration events (published language: stable, minimal, versioned, free of internal details).
- **[FORBIDDEN]** Anemic models in the core domain (entities as getters/setters with all logic in "manager" services) and leaking persistence/framework concerns into the domain model.
- **[PATTERN]** Document each bounded context with a Bounded Context Canvas: purpose, strategic classification, domain roles, inbound/outbound communication, ubiquitous language, business decisions, and assumptions.
- **[TESTING]** Validate boundaries with scenarios: walk key business flows across the context map and check that each step belongs to exactly one context, that no context needs another's internal data, and that changes to a single business rule touch one context.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
