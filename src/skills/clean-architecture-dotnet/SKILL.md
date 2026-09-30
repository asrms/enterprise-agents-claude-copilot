---
name: clean-architecture-dotnet
description: "Clean/hexagonal architecture for .NET solutions: Domain, Application, Infrastructure, and API projects with inward dependencies, rich domain models, use-case handlers, ports and adapters, vertical slices, domain events, and architecture tests with NetArchTest or ArchUnitNET. Use it when structuring or reviewing .NET solutions."
---

# Skill: Clean Architecture for .NET

## Implementation Rules:
- **[ARCHITECTURE]** Structure the solution into projects with dependencies pointing inward: `Domain` (no framework references), `Application` (use cases, ports, depends only on Domain), `Infrastructure` (EF Core, messaging, external clients implementing ports), and `Api`/host (composition root). Vertical slices inside Application (`Features/Orders/PlaceOrder`) are preferred over technical folders.
- **[MANDATORY]** The Domain project has no references to ASP.NET Core, EF Core, serializers, or logging frameworks; persistence concerns are configured in Infrastructure with `IEntityTypeConfiguration<T>`, not with attributes on domain classes.
- **[PATTERN]** Rich domain model: entities and aggregates protect invariants through behavior methods (`order.AddLine(...)`, `order.Pay(...)`) with private setters and factory methods; value objects are immutable `record`s or `readonly record struct`s with validation (Money, Email, Sku).
- **[PATTERN]** Use-case handlers (one class per command or query) orchestrate the domain and ports; a mediator library is optional, not required. Queries may bypass the domain and read projections directly for performance (CQRS-lite).
- **[PATTERN]** Ports are interfaces owned by the Application layer (`IOrderRepository`, `IPaymentGateway`, `IClock`), implemented by adapters in Infrastructure and registered in the composition root; repositories exist per aggregate root, not per table.
- **[PATTERN]** Domain events are raised by aggregates and dispatched after a successful commit (for example in a `SaveChangesInterceptor`), with integration events published through a transactional outbox.
- **[PATTERN]** Expected business failures use a result type or domain-specific exceptions mapped at the API boundary; do not use exceptions for normal control flow in hot paths.
- **[FORBIDDEN]** Anemic entities with public setters manipulated by services, generic repositories that expose `IQueryable` to the Application layer, `DbContext` injected into controllers or endpoints, and circular project references.
- **[MANDATORY]** Enable nullable reference types, treat warnings as errors in CI, and centralize build settings in `Directory.Build.props` and package versions in `Directory.Packages.props` (Central Package Management).
- **[PATTERN]** Keep the architecture proportional: for small CRUD services, a single project with feature folders and the same dependency rules enforced by tests is acceptable; record the choice in an ADR.
- **[TESTING]** Architecture rules are enforced by tests (NetArchTest or ArchUnitNET: Domain must not depend on Infrastructure or Microsoft.EntityFrameworkCore); domain logic has fast unit tests without mocks, and handlers are tested with in-memory fakes of ports.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
