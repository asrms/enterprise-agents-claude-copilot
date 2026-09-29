---
name: graphql-schema-design
description: "Designing and securing GraphQL APIs in any server stack: schema-first design, naming conventions, nullability, Relay-style connections for pagination, mutation input/payload patterns with typed errors, DataLoader against N+1, query depth/complexity limits, persisted queries, field-level authorization, and schema evolution with deprecation. Use it when designing or reviewing a GraphQL schema or server."
---

# Skill: GraphQL Schema Design

## Implementation Rules:
- **[ARCHITECTURE]** Schema first: the SDL (`schema.graphql`) is designed around client use cases and the domain language, reviewed before implementation, versioned, and checked for breaking changes in CI; the schema is not a mirror of database tables.
- **[MANDATORY]** Naming: types and enums in `PascalCase`, fields and arguments in `camelCase`, enum values in `SCREAMING_SNAKE_CASE`, mutations as verb + noun (`placeOrder`, `cancelOrder`), and one input type per mutation (`PlaceOrderInput`).
- **[PATTERN]** Nullability is a deliberate contract: fields that can fail independently (resolved from other services) are nullable so partial results are possible; identifiers and required scalars are non-null; lists are `[Item!]!` unless null has a distinct meaning.
- **[MANDATORY]** Paginate every list that can grow using Relay-style connections (`orders(first: Int, after: String): OrderConnection!` with `edges { cursor node }` and `pageInfo`), with a server-enforced maximum for `first`/`last`.
- **[PATTERN]** Mutations return a payload type containing the modified entity and a list of typed user errors (`PlaceOrderPayload { order: Order, errors: [PlaceOrderError!]! }` with a union or interface of error types) for expected business failures; top-level `errors` are reserved for unexpected failures.
- **[PATTERN]** Global object identification: types implement `Node` with an opaque global `id: ID!`, enabling `node(id:)` refetching and client cache normalization.
- **[PERFORMANCE]** Eliminate N+1 queries with DataLoader (or the framework equivalent: Spring for GraphQL `@BatchMapping`, Hot Chocolate data loaders, gqlgen dataloaden, Strawberry/Graphene DataLoader) created per request; measure resolver execution with tracing.
- **[SECURITY]** Protect against expensive queries: maximum query depth, query complexity/cost analysis with per-field costs, maximum aliases and batched operations, request timeouts, and rate limiting per client based on cost.
- **[SECURITY]** Authorization is enforced in the resolvers/business layer per field and per object (not only at the gateway), with the same ownership/tenant checks as REST; disable introspection and field suggestions in production for private APIs, and use persisted queries (allowlist of operation hashes) for first-party clients.
- **[FORBIDDEN]** Exposing internal errors, stack traces, or database messages in GraphQL errors; generic inputs like `JSON` scalars for structured data; and mutations that take entity types as input.
- **[PATTERN]** Schema evolution without versions: add fields and types freely, mark obsolete fields with `@deprecated(reason: "Use totalPrice. Removal after 2025-12-31.")`, monitor field usage, and remove only when usage is zero.
- **[CONFIGURATION]** Lint and check the schema in CI (`graphql-schema-linter` or GraphQL ESLint, `graphql-inspector diff` for breaking changes, schema registry checks for federated graphs); in federation, each subgraph owns its types and entities are extended with `@key`.
- **[TESTING]** Test resolvers with real queries against the executable schema, including authorization failures, pagination boundaries, user errors in payloads, and query cost limits.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
