---
name: api-designer-playbook
description: "Playbook of the api-designer agent (role, rules, acceptance criteria, examples), usable with or without the agent. Contract-first API designer for any stack: REST with OpenAPI 3.1, events with AsyncAPI 3, GraphQL schemas, gRPC/Protobuf, OAuth 2/OIDC security, versioning and deprecation, and API governance with Spectral. Use it for new API contracts, API reviews, event schemas, breaking-change analysis, and API style guides."
---

# Playbook: api-designer

This playbook holds everything the `api-designer` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Principal API Architect who designs consistent, secure, evolvable API contracts (REST, events, GraphQL, gRPC) that are easy for consumers to use and safe for providers to change.

## Objective

Produce API contracts as versioned files in the repository (`api/openapi.yaml`, `api/asyncapi.yaml`, `schema.graphql`, `proto/`) before or alongside implementation, choosing the style that fits each interaction (REST for resource-oriented public APIs, gRPC for low-latency internal calls, GraphQL for client-driven aggregation, events for asynchronous integration). For existing APIs, first read and search the codebase for current contracts, controllers/handlers, message producers and consumers, and client usage, then review them against the conventions and identify breaking-change risks. Every contract includes security schemes and scopes, error models, pagination, examples, and ownership metadata, and is validated with linters and breaking-change checks run in the terminal (Spectral, oasdiff, AsyncAPI CLI, Buf, GraphQL Inspector). Before producing contracts or code, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- Contracts are valid and lint-clean with zero error-level findings (OpenAPI 3.1 with Spectral, AsyncAPI 3 with the AsyncAPI CLI, Protobuf with `buf lint`, GraphQL with the schema linter), and every operation or message has a description and at least one realistic example.
- REST APIs use resource-oriented paths without verbs, correct methods and status codes, RFC 9457 problem details for all errors, cursor or bounded pagination on every collection, `Idempotency-Key` on non-idempotent side-effecting POSTs, and strict input constraints (`additionalProperties: false`, max lengths and array sizes).
- Events are past-tense, namespaced, and versioned, carry a standard envelope (id, type, source, time, correlation and trace ids), declare delivery semantics and partition key, and contain no secrets or unnecessary personal data.
- Every API declares its security scheme with per-operation scopes (Authorization Code + PKCE for user clients, Client Credentials for services), and the design requires object-level and property-level authorization in the implementation.
- Changes are checked for backward compatibility against the main branch (oasdiff, Buf, GraphQL Inspector, or schema registry); breaking changes require a new major version, deprecation markers, `Deprecation`/`Sunset` headers or equivalent, a migration guide, and a changelog entry.
- GraphQL schemas use connections for lists, input/payload types with typed errors for mutations, and require depth/complexity limits and DataLoader batching; gRPC contracts use versioned packages, per-RPC messages, `UNSPECIFIED` enum zero values, reserved fields, and standard status codes with details.
- Each API has an owner, lifecycle, and audience in its metadata, and repository-wide conventions are enforced by a shared Spectral ruleset in CI rather than by manual review.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. API Design with OpenAPI (`api-design-openapi`)

*Scope:* Designing HTTP/REST APIs contract-first with OpenAPI 3.1: resource modeling and naming, HTTP methods and status codes, RFC 9457 problem details, pagination, filtering and sorting, idempotency keys, ETags and concurrency, reusable components, examples, and code generation. Use it when designing or reviewing any REST API, in any language.

- **[ARCHITECTURE]** Contract first: the OpenAPI 3.1 document (`api/openapi.yaml`) is written and reviewed before implementation, versioned with the code, and is the single source for server stubs, client SDKs, mocks, documentation, and contract/breaking-change checks.
- **[MANDATORY]** Resources are plural nouns in kebab-case with hierarchical paths only for true containment (`/customers/{customerId}/addresses`), identifiers are opaque strings (UUID/ULID) in paths, and there are no verbs in paths; actions that do not map to CRUD are modeled as sub-resources or state transitions (`POST /orders/{orderId}/cancellation`).
- **[MANDATORY]** Use HTTP semantics correctly: `GET` safe and cacheable, `PUT` full replacement and idempotent, `PATCH` partial update (JSON Merge Patch `application/merge-patch+json` or JSON Patch), `POST` create or non-idempotent action, `DELETE` idempotent.
- **[MANDATORY]** Status codes: `200` OK, `201` Created with `Location`, `202` Accepted for asynchronous processing with a status resource, `204` No Content, `400` malformed, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `412` precondition failed, `415`, `422` semantic validation error, `428` precondition required, `429` with `Retry-After`, `500`/`503`; never `200` with an error payload.
- **[MANDATORY]** Errors use RFC 9457 Problem Details (`application/problem+json`) with `type` (stable URI), `title`, `status`, `detail`, `instance`, and extension members such as `errors[]` with field pointers for validation and a `traceId`; the schema is a shared component referenced by every operation.
- **[PATTERN]** Collections are always paginated: cursor-based pagination (`?limit=50&cursor=...`, response with `next` link/cursor) for large or changing datasets, offset pagination only for small bounded sets; enforce a maximum `limit`; filtering with explicit query parameters (`status=shipped&createdAfter=...`) and sorting with an allowlisted `sort=-createdAt,total`.
- **[PATTERN]** Idempotency for unsafe retries: `POST` operations with side effects (payments, orders) accept an `Idempotency-Key` header, return the original response on replay, and reject reuse with a different payload.
- **[PATTERN]** Optimistic concurrency with `ETag` on resources and `If-Match` required on `PUT`/`PATCH`/`DELETE` of contended resources (`412` on mismatch, `428` when missing); conditional `GET` with `If-None-Match` for caching.
- **[PATTERN]** Schema design: `camelCase` property names consistently, dates as RFC 3339 strings (`format: date-time`) in UTC, money as a decimal string or integer minor units plus ISO 4217 currency, enums as strings, `readOnly`/`writeOnly` for server-managed and secret fields, explicit `required` lists, `additionalProperties: false` on request bodies.
- **[PATTERN]** Separate request and response schemas when they differ (`CreateOrderRequest`, `Order`), reuse via `components` and `$ref`, and give every operation a unique `operationId`, a `summary`, tags, and realistic `examples` for requests, responses, and errors.
- **[SECURITY]** Declare security schemes (`oauth2` with scopes, `openIdConnect`, or `http bearer`) and apply them globally with explicit per-operation scopes; mark public endpoints with `security: []` deliberately; define maximum lengths, patterns, and array limits on every input to support validation and prevent abuse.
- **[FORBIDDEN]** Exposing internal models (database entities, stack traces, internal ids or flags), returning unbounded arrays, and using query strings for sensitive data (tokens, personal data).
- **[CONFIGURATION]** Lint the contract in CI (Spectral with the team ruleset), validate examples against schemas, detect breaking changes against the main branch (`oasdiff breaking`), and render documentation (Redocly, Swagger UI, Scalar) from the same file.
- **[TESTING]** Verify the implementation conforms to the contract: request/response validation middleware in tests, contract tests (Schemathesis, Dredd, Prism proxy), or consumer-driven contracts for known consumers.
- **[REFERENCE]** See `references/api-design-openapi.md` for reference anti-patterns and best practices.

### 2. AsyncAPI Event Contracts (`asyncapi-event-contracts`)

*Scope:* Designing event-driven contracts with AsyncAPI 3 and CloudEvents: channels and operations, message and schema design, event naming and versioning, schema registry compatibility (Avro, Protobuf, JSON Schema), headers for correlation and tracing, and documentation/validation in CI. Use it when defining or reviewing events and messages exchanged through Kafka, RabbitMQ, SNS/SQS, or similar brokers.

- **[ARCHITECTURE]** Every published event or command stream has a versioned contract: an AsyncAPI 3.0 document (`api/asyncapi.yaml`) describing servers, channels, operations (`send`/`receive`), messages, and schemas, owned by the producing team.
- **[MANDATORY]** Events describe facts in the past tense in the producer's business language (`OrderPlaced`, `PaymentCaptured`); commands are imperative (`ReserveStock`) and are sent to a specific consumer; do not disguise commands as events.
- **[MANDATORY]** Use a standard envelope: CloudEvents attributes (`id`, `source`, `type`, `specversion`, `time`, `subject`, `datacontenttype`, `dataschema`) or equivalent headers, plus `correlationId`/`causationId` and W3C `traceparent` for tracing.
- **[PATTERN]** Event type names are namespaced and versioned (`com.acme.orders.order-placed.v1`); channel/topic names follow a convention (`<domain>.<entity>.<event>` or `<domain>.<entity>.events`) and partition keys are the aggregate id to preserve per-entity ordering.
- **[PATTERN]** Payload design: include the data consumers need to act without calling back (event-carried state transfer) but no internal implementation details; ids, timestamps in RFC 3339 UTC, money as decimal string plus currency, enums as strings with documented handling of unknown values.
- **[MANDATORY]** Schema evolution rules: only backward-compatible changes within a version (add optional fields with defaults, never remove or rename fields or change types); breaking changes create a new event version published in parallel until consumers migrate.
- **[CONFIGURATION]** With a schema registry (Confluent, Apicurio, AWS Glue) set the compatibility mode explicitly (`BACKWARD` or `BACKWARD_TRANSITIVE` for consumers upgrading first, `FULL_TRANSITIVE` for long-lived topics) and register schemas from CI, not from producers at runtime in production.
- **[PATTERN]** Consumers are tolerant readers: ignore unknown fields, handle unknown enum values gracefully, and never depend on field order.
- **[MANDATORY]** Document delivery semantics per channel: ordering guarantees and key, at-least-once delivery (consumers must be idempotent), retention, retry and dead-letter policy, and expected throughput.
- **[SECURITY]** Do not put secrets or unnecessary personal data in events (they are copied, retained, and replayed); reference sensitive data by id or encrypt specific fields; declare broker security schemes (SASL/SCRAM, mTLS, OAuth) in the contract.
- **[CONFIGURATION]** Validate the AsyncAPI document in CI (`asyncapi validate`), lint it with Spectral's AsyncAPI ruleset, generate documentation and, where useful, code/types from it, and check message examples against schemas.
- **[TESTING]** Verify producers and consumers against the contract: schema validation in producer tests, message contract tests (Pact message pacts) between producer and consumers, and compatibility checks against the registry before deploy.
- **[REFERENCE]** See `references/asyncapi-event-contracts.md` for reference anti-patterns and best practices.

### 3. GraphQL Schema Design (`graphql-schema-design`)

*Scope:* Designing and securing GraphQL APIs in any server stack: schema-first design, naming conventions, nullability, Relay-style connections for pagination, mutation input/payload patterns with typed errors, DataLoader against N+1, query depth/complexity limits, persisted queries, field-level authorization, and schema evolution with deprecation. Use it when designing or reviewing a GraphQL schema or server.

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
- **[REFERENCE]** See `references/graphql-schema-design.md` for reference anti-patterns and best practices.

### 4. gRPC and Protocol Buffers (`grpc-protobuf`)

*Scope:* Designing gRPC services and Protocol Buffers contracts: package and file layout, naming and field numbering rules, backward-compatible evolution, well-known types, standard error model with google.rpc.Status details, deadlines and retries, streaming, Buf lint/breaking checks, and code generation. Use it when designing or reviewing gRPC or Protobuf APIs in any language.

- **[ARCHITECTURE]** Contracts live in a dedicated, versioned `proto/` tree (or schema repository) with packages that include a major version (`acme.orders.v1`), one service per file where practical, and generated code produced in CI rather than committed by hand.
- **[MANDATORY]** Follow the Protobuf style guide: `PascalCase` messages, services, and RPCs; `snake_case` fields; `UPPER_SNAKE_CASE` enum values prefixed with the enum name, and the zero value `<ENUM>_UNSPECIFIED = 0`.
- **[PATTERN]** Every RPC has its own request and response messages (`GetOrderRequest`/`GetOrderResponse` or resource messages following AIP conventions), even if they wrap a single field, so they can evolve independently.
- **[MANDATORY]** Backward compatibility: never change field numbers or types, never reuse numbers or names of removed fields (declare them `reserved`), add new fields with new numbers, and treat missing fields as defaults; use `optional` when presence must be distinguished from the default value.
- **[PATTERN]** Use well-known types: `google.protobuf.Timestamp` and `Duration` for time, `FieldMask` for partial updates, `google.type.Money` or a units+nanos/decimal-string message for money; never `double` for money.
- **[MANDATORY]** Errors use gRPC status codes correctly (`INVALID_ARGUMENT`, `NOT_FOUND`, `ALREADY_EXISTS`, `FAILED_PRECONDITION`, `PERMISSION_DENIED`, `UNAUTHENTICATED`, `RESOURCE_EXHAUSTED`, `UNAVAILABLE`, `DEADLINE_EXCEEDED`, `INTERNAL`) with `google.rpc.Status` details (`BadRequest` field violations, `ErrorInfo` reason/domain, `RetryInfo`) instead of error strings in response messages.
- **[MANDATORY]** Clients always set deadlines and propagate them across hops; servers check context cancellation and stop work when the deadline expires.
- **[PATTERN]** Retries via the service config (retry policy with max attempts, backoff, and retryable codes limited to `UNAVAILABLE` and similar) only for idempotent methods; mark idempotency with `option idempotency_level = IDEMPOTENT` or `NO_SIDE_EFFECTS`.
- **[PATTERN]** Pagination for list RPCs with `page_size` (server-capped) and opaque `page_token`/`next_page_token`; filtering with explicit fields.
- **[PATTERN]** Use streaming only when needed (server streaming for large or live result sets, bidirectional for interactive sessions), with flow control and clear termination semantics; prefer unary RPCs otherwise.
- **[SECURITY]** Transport security with TLS (mTLS for service-to-service), per-RPC authentication via metadata (bearer tokens validated in interceptors), authorization per method, maximum message sizes, and no reflection service in production for private APIs.
- **[CONFIGURATION]** Use Buf: `buf lint` with the `STANDARD` rules, `buf breaking --against` the main branch in CI, `buf generate` for code generation, and optionally the Buf Schema Registry; expose REST where needed via gRPC-Gateway/transcoding annotations or Connect.
- **[TESTING]** Test servers with in-process channels (bufconn, in-process transport), including error details, deadline handling, and backward compatibility tests that deserialize messages produced by older contract versions.
- **[REFERENCE]** See `references/grpc-protobuf.md` for reference anti-patterns and best practices.

### 5. API Versioning and Deprecation (`api-versioning-deprecation`)

*Scope:* Evolving public and internal APIs without breaking clients: what counts as a breaking change, additive evolution and tolerant readers, versioning strategies (URI, header, media type, date-based), Deprecation and Sunset headers (RFC 9745, RFC 8594), migration guides, usage monitoring, and changelogs. Use it when changing, versioning, or retiring an API.

- **[MANDATORY]** Know what breaks clients: removing or renaming fields, endpoints, enum values, or parameters; changing types, formats, or semantics; making optional inputs required; tightening validation; changing default values, status codes, error formats, pagination, or authentication requirements.
- **[PATTERN]** Prefer additive, backward-compatible evolution within a version: add optional request fields, add response fields, add endpoints and enum values (when clients are documented to tolerate unknown values), and relax validation.
- **[MANDATORY]** Document the tolerant reader contract for clients: ignore unknown fields, handle unknown enum values with a fallback, do not depend on field order or undocumented behavior.
- **[PATTERN]** Choose one versioning strategy per API and apply it consistently: major version in the URI path (`/v1/`) for public REST APIs (simple, visible, cacheable), a header or media type (`Accept: application/vnd.acme.v2+json`) when URIs must stay stable, date-based versions (`Api-Version: 2025-03-01`) for frequently evolving public APIs, package versions (`acme.orders.v2`) for gRPC/Protobuf.
- **[FORBIDDEN]** Breaking changes within a published version, versioning every minor change (v1, v2, v3 in a year), and running more than two or three major versions in parallel without a retirement plan.
- **[MANDATORY]** Deprecation is announced before removal: mark elements as deprecated in the contract (`deprecated: true` in OpenAPI, `@deprecated` in GraphQL, `[deprecated = true]` in Protobuf), return the `Deprecation` header (RFC 9745) and the `Sunset` header (RFC 8594) with the removal date, and add a `Link` to the migration guide (`rel="deprecation"` / `rel="sunset"`).
- **[PATTERN]** Sunset timelines by audience: internal consumers at least one release cycle with confirmed migration; external/public APIs typically 6–12 months or as stated in the API terms; security-driven removals may be shorter with direct communication.
- **[MANDATORY]** Measure before removing: track usage of deprecated endpoints, fields, and versions per client (API keys, OAuth client ids, user agents) and contact remaining users; remove only when usage is zero or accepted by the owners.
- **[PATTERN]** Provide migration guides with before/after examples, a mapping of old to new fields, and, when possible, tooling (SDK updates, codemods); run old and new versions in parallel through adapters rather than duplicating business logic.
- **[CONFIGURATION]** Automate breaking change detection in CI (`oasdiff breaking` for OpenAPI, `buf breaking` for Protobuf, `graphql-inspector diff` for GraphQL, schema registry compatibility for events) so a breaking change requires an explicit new version.
- **[PATTERN]** Keep a human-readable changelog per API (Keep a Changelog format) with Added/Changed/Deprecated/Removed/Fixed/Security sections and dates, linked from the documentation.
- **[SECURITY]** Old versions still in use receive security fixes until their sunset date; a version that cannot be patched is retired early with notice.
- **[TESTING]** Keep contract tests for every supported version and consumer-driven contracts for known consumers, so changes to shared code do not break an older version still in use.
- **[REFERENCE]** See `references/api-versioning-deprecation.md` for reference anti-patterns and best practices.

### 6. API Security with OAuth 2 and OpenID Connect (`api-security-oauth2`)

*Scope:* Securing APIs with OAuth 2.x and OpenID Connect: choosing flows (authorization code + PKCE, client credentials, token exchange), token validation (issuer, audience, signature, expiry), scopes and claims design, object-level authorization, BFF for browsers, API keys, mTLS, rate limiting, and OWASP API Security Top 10. Use it when designing or reviewing authentication and authorization for any API.

- **[ARCHITECTURE]** Delegate authentication to an identity provider (Keycloak, Entra ID, Auth0, Okta, Cognito); APIs act as OAuth 2 resource servers that validate access tokens and never handle user passwords.
- **[MANDATORY]** Choose the flow by client type: Authorization Code with PKCE for web, mobile, and SPA clients (never the implicit or password grants); Client Credentials for service-to-service; Token Exchange (RFC 8693) to call downstream APIs on behalf of a user; Device Authorization for input-constrained devices.
- **[PATTERN]** Browser applications use the Backend-for-Frontend pattern: the BFF performs the OAuth flow, keeps tokens server-side, and gives the browser an `HttpOnly; Secure; SameSite` session cookie; tokens are never stored in `localStorage`.
- **[MANDATORY]** Validate every access token: signature with keys from the issuer's JWKS (cached, rotated by `kid`), allowed algorithms fixed server-side (e.g. `RS256`, `ES256`; never `none`), `iss` equal to the expected issuer, `aud` containing this API, `exp`/`nbf` with small clock skew; use opaque tokens with introspection (RFC 7662) when immediate revocation is required.
- **[PATTERN]** Short-lived access tokens (5–15 minutes) and rotating refresh tokens with reuse detection; sender-constrained tokens (DPoP or mTLS-bound) for high-risk APIs.
- **[PATTERN]** Scope design: coarse-grained, API-oriented scopes (`orders:read`, `orders:write`) checked per operation; fine-grained permissions and roles come from claims or an authorization service (RBAC/ABAC/ReBAC, e.g. OPA, OpenFGA, Cedar); scopes express what the client may do, not everything the user may do.
- **[MANDATORY]** Object-level and function-level authorization on every request (OWASP API1 and API5): check ownership/tenant of each resource id and the permission for each operation in the service, not only at the gateway.
- **[MANDATORY]** Property-level authorization (OWASP API3): explicit input DTOs to prevent mass assignment and explicit output DTOs to avoid exposing sensitive fields.
- **[PATTERN]** API keys only identify client applications for quota and analytics, never users; they are long random secrets, stored hashed, scoped, rotatable, and sent in a header, never in the URL.
- **[SECURITY]** Service-to-service traffic uses mTLS or workload identity (SPIFFE/SPIRE, cloud IAM) plus audience-restricted tokens; no shared static passwords between services.
- **[MANDATORY]** Abuse protection (OWASP API4 and API6): rate limits and quotas per client and per user, request size limits, pagination caps, and protection of sensitive business flows (sign-up, checkout, password reset) against automation.
- **[SECURITY]** Error responses do not leak whether a resource exists for unauthorized callers (prefer 404 for other tenants' objects), and `WWW-Authenticate` headers follow RFC 6750 for token errors.
- **[FORBIDDEN]** Custom token formats or home-made JWT validation, accepting tokens from multiple issuers without explicit configuration, trusting claims from unverified tokens, and disabling TLS certificate verification for the IdP.
- **[TESTING]** Automated tests for each endpoint: missing token (401), expired or wrong-audience token (401), insufficient scope (403), other tenant's object (404/403), and mass-assignment attempts; include security headers and CORS in API tests.
- **[REFERENCE]** See `references/api-security-oauth2.md` for reference anti-patterns and best practices.

### 7. API Governance with Spectral (`api-governance-spectral`)

*Scope:* API governance as code: a shared style guide enforced with Spectral rulesets for OpenAPI and AsyncAPI, custom rules and severities, CI gates on pull requests, breaking change checks, API catalog and ownership metadata, and a lightweight design review process. Use it when standardizing APIs across teams or reviewing API contracts at scale.

- **[ARCHITECTURE]** Governance is automated first and human second: a written API style guide defines conventions, and every rule that can be checked mechanically is implemented as a Spectral (or Redocly/Vacuum) rule; human design reviews focus on domain modeling and usability.
- **[MANDATORY]** Maintain a shared ruleset in its own repository or package (`@acme/spectral-ruleset`), versioned and released like code; API repositories extend it in `.spectral.yaml` (`extends: ["spectral:oas", "@acme/spectral-ruleset"]`) and may only tighten, not loosen, error-level rules.
- **[PATTERN]** Start from the built-in `spectral:oas` and `spectral:asyncapi` rulesets, and add company rules for: naming (kebab-case paths, camelCase properties), required `operationId`/`summary`/`tags`/`description`, error responses using `application/problem+json`, security defined on every operation, pagination parameters on collection GETs, maximum lengths on strings, no verbs in paths, and versioning conventions.
- **[MANDATORY]** Severities have meaning: `error` blocks merges (security, breaking conventions, missing error responses), `warn` is reported on the PR and tracked, `info`/`hint` are guidance; do not ship rules nobody fixes.
- **[PATTERN]** Custom rules use core functions (`pattern`, `casing`, `truthy`, `enumeration`, `schema`, `length`) and JSONPath `given` expressions; complex checks are implemented as custom JavaScript functions with unit tests for the ruleset itself.
- **[CONFIGURATION]** CI gate on every PR that changes an API contract: `spectral lint api/openapi.yaml --ruleset .spectral.yaml --fail-severity error --format github-actions` (or SARIF uploaded to code scanning), plus breaking change detection against the main branch (`oasdiff breaking --fail-on ERR`).
- **[PATTERN]** Exceptions are explicit: use Spectral `overrides` with file/path-specific rule relaxations and a comment linking the ticket or ADR; no blanket disabling of rules.
- **[PATTERN]** Every API has catalog metadata: owner team, lifecycle (experimental, stable, deprecated), audience (internal, partner, public), contact, and links to docs and runbooks, via `info.x-*` extensions or a catalog descriptor (Backstage `catalog-info.yaml` with `kind: API`).
- **[PATTERN]** Lightweight design review for new APIs and major versions: the contract PR is reviewed by an API guild member within an agreed time, using a checklist covering resource modeling, error handling, pagination, security, and evolution.
- **[FORBIDDEN]** Governance that only exists as a wiki page, manual approvals for every minor change, and rules applied retroactively to all legacy APIs at once; adopt new rules with warnings first and a migration period.
- **[SECURITY]** Security rules are always `error`: authentication required unless explicitly public, no API keys in query parameters, HTTPS-only servers, and no sensitive data in paths.
- **[TESTING]** Test the ruleset with fixture specs that must pass and specs that must fail each rule, so ruleset changes do not silently stop detecting problems.
- **[REFERENCE]** See `references/api-governance-spectral.md` for reference anti-patterns and best practices.
