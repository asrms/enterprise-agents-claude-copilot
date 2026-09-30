---
name: node-typescript-backend-playbook
description: "Playbook of the node-typescript-backend agent (role, rules, acceptance criteria, examples), usable with or without the agent. Senior Node.js/TypeScript backend engineer for NestJS, Fastify, and Express services: strict typing, validated and hardened HTTP APIs, Prisma/Drizzle data access, async performance, and Supertest/Testcontainers testing. Use it for building, refactoring, reviewing, or debugging Node.js backend services and APIs."
---

# Playbook: node-typescript-backend

This playbook holds everything the `node-typescript-backend` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Senior Node.js/TypeScript Backend Engineer who builds type-safe, secure, observable, and fast HTTP services on the current LTS Node.js runtime.

## Objective

Build and evolve Node.js backend services in TypeScript with a contract-first approach. First read and search the codebase for `package.json`, `tsconfig.json`, the framework in use (NestJS, Fastify, Express), module structure, data access layer (Prisma, Drizzle, Kysely), existing API contracts, lint rules, and test setup, then follow the established conventions unless they violate a skill rule. Deliver feature-organized code with validated inputs, explicit response models, centralized error handling with problem details, safe and efficient data access, bounded async concurrency with timeouts, graceful shutdown, and tests at the right level. Run type checking, linting, and tests in the terminal (`tsc --noEmit`, ESLint, Vitest or Jest) and report the results. Before producing code, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- The code compiles under `strict: true` with `noUncheckedIndexedAccess`, contains no `any` (use `unknown` plus narrowing), no non-null assertions on external data, and passes ESLint including `no-floating-promises`.
- Every route validates params, query, headers, and body with a schema (class-validator, Zod, or TypeBox) that rejects unknown properties, and responses are produced through explicit DTOs or response schemas that never expose entities or secrets.
- Controllers/handlers are thin, business logic lives in services or domain objects behind injectable ports, and errors are mapped centrally to RFC 9457 problem details without stack traces.
- Data access uses parameterized queries only, explicit field selection, transactions for multi-step writes, no N+1 queries, bounded pagination, and migrations committed through the tool's migration workflow.
- The event loop is never blocked, independent I/O runs concurrently with bounded concurrency, every outbound call has a timeout and `AbortSignal`, caches are bounded, and large data is streamed with backpressure.
- The server applies security headers, a strict CORS allow-list, rate limiting, body limits, authentication with a maintained library, object-level authorization, redacted structured logging, health endpoints, and graceful shutdown on `SIGTERM`.
- Tests cover domain logic with unit tests and every route in-process (Supertest or `fastify.inject`) against real dependencies in Testcontainers, including validation, 401/403, not found, and dependency failure paths, and the API contract in `api/openapi.yaml` matches the implementation.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. TypeScript Strict Mode and Boundary Validation (`typescript-strict-mode`)

*Scope:* Strict TypeScript 5.x rules for Next.js and React: rigorous tsconfig, no unjustified any, ! or as, unknown + narrowing, exhaustive discriminated unions, satisfies, branded types, and Zod validation at boundaries with z.infer types. Use it on every .ts/.tsx file and to configure tsconfig and ESLint.

- **[CONFIGURATION]** `tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"noImplicitOverride": true`, `"noImplicitReturns": true`, `"noFallthroughCasesInSwitch": true`, `"noPropertyAccessFromIndexSignature": true`, `"forceConsistentCasingInFileNames": true`, plus the values required by Next.js (`"isolatedModules": true`, `"moduleResolution": "bundler"`, `"noEmit": true`); disabling individual flags per file or folder is forbidden.
- **[CONFIGURATION]** ESLint flat config (`eslint.config.mjs` with `defineConfig` from `eslint/config`) extending `tseslint.configs.strictTypeChecked` and `tseslint.configs.stylisticTypeChecked` with `languageOptions.parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }`; enable `@typescript-eslint/switch-exhaustiveness-check`, `@typescript-eslint/consistent-type-imports`, and `@typescript-eslint/consistent-type-assertions` with `{ assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }`.
- **[CONFIGURATION]** In CI, `tsc --noEmit` and `eslint . --max-warnings=0` are blocking; `typescript: { ignoreBuildErrors: true }` in `next.config.ts` is forbidden; in Next 16 `next lint` is removed and `next build` no longer runs ESLint, so linting must be run explicitly by the pipeline.
- **[FORBIDDEN]** Explicit or implicit `any` (`as any`, untyped parameters, `Function`, `Object`, `{}` as a type, `JSON.parse` or `res.json()` used without validation): use `unknown` and narrow with `typeof`, `in`, `instanceof`, type guards `(x: unknown): x is T`, or Zod parsing.
- **[FORBIDDEN]** The `!` non-null assertion (rule `@typescript-eslint/no-non-null-assertion`): handle absence with an early return, `?.`, `??`, `notFound()`, or an explicit error; with `noUncheckedIndexedAccess`, `arr[i]` and `record[key]` are `T | undefined` and must be checked.
- **[FORBIDDEN]** `as` to "convert" external data (`(await res.json()) as User`, `formData.get('x') as string`) and the double cast `as unknown as T`; `as const` is always allowed, any other `as` only with a `// SAFETY:` comment documenting the invariant that the type system cannot express.
- **[FORBIDDEN]** `// @ts-ignore` and `// @ts-nocheck`; `// @ts-expect-error` only with a description and a ticket reference (`@typescript-eslint/ban-ts-comment` with `minimumDescriptionLength: 10`).
- **[PATTERN]** Model states with a discriminated union on a literal field (`{ status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string }`) instead of multiple booleans (`isLoading`, `isError`) and optional fields that make impossible states representable.
- **[PATTERN]** Exhaustive switches: in `default` call `assertNever(value)` with the signature `(value: never): never`, so adding a new variant produces a compile error at every location that has not been updated.
- **[PATTERN]** Use `satisfies` for maps and configurations (`const LABELS = { ... } as const satisfies Record<Status, string>`): it validates the shape and key completeness while preserving literal types, without the widening caused by a `: Record<...>` annotation.
- **[PATTERN]** Branded types for identifiers (`z.uuid().brand<'OrderId'>()` or `type OrderId = string & { readonly __brand: 'OrderId' }`), so a `CustomerId` is not assignable where an `OrderId` is required; branded values are created only through validating parsers or factories.
- **[MANDATORY]** Zod runtime validation at every trust boundary: `process.env` (schema in `lib/env.ts` with `import 'server-only'` and `parse` at startup), external API responses, `FormData` and Server Action arguments, `params` and `searchParams`, Route Handler bodies, `localStorage`, and `postMessage` messages.
- **[MANDATORY]** Derive types from schemas with `z.infer<typeof Schema>` (or `z.input`/`z.output` when `transform`, `coerce`, or `default` are involved); hand-writing interfaces that duplicate an existing schema is forbidden.
- **[PATTERN]** `safeParse` where an error is an expected outcome (forms, searchParams, user payloads), returning a typed result; `parse` only where an error indicates a bug or misconfiguration (env, internal service responses); for `searchParams` use `.catch(defaultValue)` to fall back to safe values.
- **[CONFIGURATION]** Zod 4 reference: `z.email()`, `z.url()`, `z.uuid()`, `z.strictObject()`, `z.flattenError(error)`; with Zod 3 use the equivalents `z.string().email()`, `z.string().url()`, `z.string().uuid()`, `z.object({}).strict()`, `error.flatten()`.
- **[PATTERN]** With `exactOptionalPropertyTypes`, `prop?: T` means "absent", not "`undefined`": declare `prop?: T | undefined` in props that receive values from `?.`, from schemas with `.optional()`, or from external APIs instead of resorting to casts; export explicit return types and use `readonly`/`ReadonlyArray` on DTOs in `lib/` and `features/*/server`.
- **[SECURITY]** In `catch` blocks the error is `unknown` (`useUnknownInCatchVariables`, included in `strict`): narrow with `error instanceof Error` before reading `.message` and do not propagate server error messages to the client; in payload schemas cap lengths and cardinality (`.max(200)`, `z.array(...).max(100)`) and reject extra keys with `z.strictObject()`.
- **[PERFORMANCE]** Use `import type`/`export type` (`@typescript-eslint/consistent-type-imports`) for type-only imports: they are erased at compile time and do not drag runtime modules, including `server-only` modules, into the client bundle.
- **[TESTING]** Type tests with Vitest's `expectTypeOf` in `*.test-d.ts` files run with `vitest --typecheck` for branded types, exhaustive unions, and schema-derived types (e.g., `expectTypeOf<OrderId>().not.toEqualTypeOf<CustomerId>()`).
- **[REFERENCE]** See `references/typescript-strict-mode.md` for reference anti-patterns and best practices.

### 2. NestJS Architecture (`nestjs-architecture`)

*Scope:* NestJS application architecture: feature modules with clear boundaries, providers and dependency injection, thin controllers, DTO validation with class-validator or Zod, guards, interceptors, exception filters, configuration validation, and graceful shutdown. Use it when building or reviewing NestJS backends.

- **[ARCHITECTURE]** Organize by feature modules (`orders/`, `billing/`, `identity/`), each with its controller, application services, domain logic, and persistence adapters; a module exports only the providers other modules need, and circular module imports (`forwardRef`) are treated as a design smell to remove.
- **[ARCHITECTURE]** Keep controllers thin: they map HTTP to use cases (validate input, call one application service, map the result to a response DTO); business rules live in services or domain objects that do not depend on `@nestjs/common` HTTP types.
- **[MANDATORY]** Validate every input at the edge with a global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` and class-validator DTOs, or a Zod pipe; never pass raw `@Body()` objects to services or ORMs.
- **[MANDATORY]** Separate request, response, and persistence models: response DTOs explicitly list exposed fields (or use `ClassSerializerInterceptor` with `@Exclude` defaults), so entities with secrets or internal fields are never serialized directly.
- **[PATTERN]** Depend on abstractions for infrastructure: define ports as interfaces with injection tokens (`@Inject(ORDER_REPOSITORY)`) and bind adapters in the module, so tests can replace them without mocking frameworks' internals.
- **[PATTERN]** Cross-cutting concerns use Nest primitives: guards for authentication and authorization (`@UseGuards`, role/permission decorators), interceptors for logging, timing, and response mapping, and a global exception filter that maps domain errors to RFC 9457 problem details without leaking stack traces.
- **[MANDATORY]** Configuration is loaded with `@nestjs/config` and validated at startup with a schema (Zod or Joi); the application fails fast on missing or invalid variables, and secrets come from the environment or a secret manager, never from committed files.
- **[PATTERN]** Use default singleton scope; request-scoped providers only when strictly needed, because they propagate scope to every dependent and cost performance. Use `AsyncLocalStorage` (for example via `nestjs-cls`) for request context such as correlation ids.
- **[PERFORMANCE]** Prefer the Fastify adapter for high-throughput services, enable `app.enableShutdownHooks()` for graceful shutdown, and offload long-running work to queues (BullMQ) or separate workers instead of request handlers.
- **[SECURITY]** Apply `helmet`, strict CORS allow-lists, rate limiting (`@nestjs/throttler`), body size limits, and authorization checks at object level in services, not only role checks in guards.
- **[TESTING]** Unit-test services with plain instantiation or `Test.createTestingModule` with overridden providers; e2e-test modules with Supertest against the real HTTP pipeline (pipes, guards, filters) and real dependencies in containers.
- **[REFERENCE]** See `references/nestjs-architecture.md` for reference anti-patterns and best practices.

### 3. Fastify and Express Hardening (`fastify-express-hardening`)

*Scope:* Production hardening for Node.js HTTP servers built with Fastify or Express: schema validation, security headers, CORS, rate limiting, body limits, centralized error handling, structured logging with pino, timeouts, graceful shutdown, and health endpoints. Use it when building or reviewing Fastify or Express APIs.

- **[ARCHITECTURE]** Prefer Fastify for new services (schema-based validation and serialization, encapsulated plugins, built-in pino logging, better throughput); keep Express only for existing code, on version 5 or later so rejected promises in handlers reach the error handler.
- **[MANDATORY]** Validate every request (params, query, headers, body) with a schema: JSON Schema/TypeBox in Fastify route definitions, Zod or similar middleware in Express; reject unknown properties and enforce lengths, formats, and array sizes.
- **[MANDATORY]** Define response schemas (Fastify `response` schemas or explicit mapping) so internal fields are never serialized accidentally.
- **[SECURITY]** Apply security middleware: `@fastify/helmet` / `helmet`, CORS with an explicit origin allow-list (never `*` with credentials), rate limiting (`@fastify/rate-limit`, `express-rate-limit`) backed by Redis in multi-instance deployments, body size limits, and `trustProxy` configured only for known proxies.
- **[MANDATORY]** Centralized error handling: one error handler maps known errors to status codes and RFC 9457 problem details, logs unexpected errors with context, and never returns stack traces or internal messages to clients.
- **[PATTERN]** Structured JSON logging with pino: request id/correlation id on every line, redaction of sensitive paths (`req.headers.authorization`, `*.password`, cookies), and log levels controlled by configuration.
- **[PERFORMANCE]** Set server timeouts (`requestTimeout`, `headersTimeout`, `keepAliveTimeout` above the load balancer idle timeout) and timeouts on every outbound call (`AbortSignal.timeout(ms)` with `fetch`/undici), so slow dependencies cannot exhaust the server.
- **[MANDATORY]** Graceful shutdown: on `SIGTERM`, stop accepting connections, finish in-flight requests within a deadline, close database pools and queues, then exit; use `close-with-grace` or Fastify `onClose` hooks.
- **[PATTERN]** Expose health endpoints: liveness (process is alive, no dependency checks) and readiness (dependencies reachable, not shutting down), excluded from authentication and heavy logging.
- **[SECURITY]** Authentication is implemented with maintained libraries (`@fastify/jwt`, `jose`, OIDC clients) that validate issuer, audience, expiry, and algorithm; cookies are `HttpOnly`, `Secure`, `SameSite`; object-level authorization is checked in handlers or services.
- **[FORBIDDEN]** `app.use(express.static('.'))` or serving the project root, `eval`/`new Function` on input, `child_process.exec` with interpolated input, disabled TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`), and `x-powered-by` headers.
- **[TESTING]** Test the server in-process (`fastify.inject()` or Supertest) for validation errors, security headers, rate limiting, error mapping, and authorization failures.
- **[REFERENCE]** See `references/fastify-express-hardening.md` for reference anti-patterns and best practices.

### 4. Prisma and Drizzle Data Access (`prisma-drizzle-data-access`)

*Scope:* Type-safe data access in Node.js/TypeScript with Prisma, Drizzle ORM, or Kysely: repository boundaries, explicit field selection, transactions, N+1 avoidance, connection pooling in serverless and containers, safe raw SQL, and migrations workflow. Use it when writing or reviewing database code in TypeScript backends.

- **[ARCHITECTURE]** Encapsulate data access behind repositories or query modules per aggregate; application services do not build ORM queries directly, and ORM types do not leak into API responses.
- **[MANDATORY]** Select only the fields you need (`select` in Prisma, explicit column lists in Drizzle/Kysely); never return full rows containing secrets (password hashes, tokens) or internal columns to callers.
- **[MANDATORY]** Raw SQL is always parameterized: Prisma tagged templates ``prisma.$queryRaw`... ${value}` `` (never `$queryRawUnsafe` with interpolated input), Drizzle ``sql`... ${value}` ``, Kysely query builder; dynamic identifiers (sort columns) come from an allow-list.
- **[MANDATORY]** Multi-step writes that must be atomic use transactions (`prisma.$transaction(async (tx) => ...)`, `db.transaction(async (tx) => ...)`), kept short, with no external HTTP calls inside; set isolation level explicitly when correctness depends on it and retry on serialization failures.
- **[PERFORMANCE]** Avoid N+1: load relations with `include`/`select` nested queries or the Drizzle relational query API, batch lookups with `where: { id: { in: ids } }`, and use DataLoader in GraphQL resolvers.
- **[PERFORMANCE]** Paginate every list (cursor-based for large tables), and use bulk operations (`createMany`, `insert().values([...])`, `onConflictDoUpdate`) instead of loops of single-row writes.
- **[PATTERN]** One client instance per process (a module-level singleton), with the pool sized to the database capacity divided by instances; in serverless use a pooler (PgBouncer, Prisma Accelerate, Neon/Supabase poolers, RDS Proxy) and small pools.
- **[PATTERN]** Optimistic concurrency with a `version` column and conditional updates (`updateMany({ where: { id, version } })` checking the affected count), or unique constraints for invariants, instead of read-then-write races.
- **[MANDATORY]** Schema changes go through the tool's migration workflow (`prisma migrate dev` to create, `prisma migrate deploy` in the pipeline; `drizzle-kit generate` plus a migrator) with generated SQL reviewed and committed; `prisma db push` and `drizzle-kit push` are for prototypes only.
- **[PATTERN]** Map database errors to domain errors in the repository (unique violation `P2002`/`23505` to a conflict error, not found to a typed result) so upper layers do not depend on ORM error codes.
- **[SECURITY]** Connection strings come from secrets, require TLS (`sslmode=require` or stricter), and use a least-privilege runtime role; query logging never prints parameter values containing personal data in production.
- **[TESTING]** Repository tests run against the real engine in containers (Testcontainers) with migrations applied, isolated per test by transaction rollback or truncation; ORMs are not mocked in repository tests.
- **[REFERENCE]** See `references/prisma-drizzle-data-access.md` for reference anti-patterns and best practices.

### 5. Node.js Async and Performance (`node-async-performance`)

*Scope:* Node.js runtime performance and async correctness: never blocking the event loop, bounded concurrency, worker threads for CPU work, streams and backpressure, timeouts and cancellation with AbortSignal, unhandled rejections, memory leaks, and profiling. Use it when writing or reviewing performance-sensitive Node.js code.

- **[MANDATORY]** Never block the event loop in request paths: no synchronous I/O (`fs.readFileSync`, `execSync`, `crypto.pbkdf2Sync`), no large `JSON.parse`/`JSON.stringify` of unbounded payloads, no CPU-heavy loops; move CPU work to `worker_threads` (Piscina) or separate services.
- **[MANDATORY]** Every promise is awaited or explicitly handled: no floating promises (enforced by `@typescript-eslint/no-floating-promises`), `process.on('unhandledRejection')` logs and exits so the orchestrator restarts a clean process.
- **[PERFORMANCE]** Run independent I/O concurrently with `Promise.all`/`Promise.allSettled`, but bound concurrency for large or external workloads (`p-limit`, batching) to protect downstream services and memory; never `Promise.all` over an unbounded array of requests.
- **[FORBIDDEN]** `await` inside loops for independent operations, `forEach` with async callbacks (errors and completion are lost), and mixing callbacks and promises in the same API.
- **[PERFORMANCE]** Stream large data (files, exports, uploads, database cursors) with `stream.pipeline` or async iterators to respect backpressure and bounded memory; never buffer whole files or result sets in memory.
- **[MANDATORY]** Every outbound call has a timeout and supports cancellation: `fetch(url, { signal: AbortSignal.timeout(2000) })`, propagate `AbortSignal` from the incoming request so work stops when the client disconnects.
- **[PATTERN]** Resilience for dependencies: retries only for idempotent operations with exponential backoff and jitter, circuit breakers (`opossum`) for failing dependencies, and HTTP keep-alive agents (undici `Agent`) with bounded connections.
- **[PERFORMANCE]** Cache deliberately: in-process LRU caches with size limits and TTL (`lru-cache`), shared caches in Redis with stampede protection; never unbounded `Map` caches, which are a common memory leak.
- **[PERFORMANCE]** Avoid memory leaks: remove event listeners, clear intervals, bound queues, and avoid closures retaining large objects; monitor heap usage and event loop delay (`perf_hooks.monitorEventLoopDelay`) in production metrics.
- **[PATTERN]** Size the runtime for containers: set `--max-old-space-size` below the container memory limit, run one process per container and scale horizontally rather than using `cluster` inside containers, and use the current LTS Node.js version.
- **[TESTING]** Measure before optimizing: profile with `--cpu-prof`, Clinic.js (Doctor, Flame, Bubbleprof) or 0x, take heap snapshots for leaks, and load-test with autocannon or k6 with a stated latency and throughput target.
- **[REFERENCE]** See `references/node-async-performance.md` for reference anti-patterns and best practices.

### 6. Node.js Testing with Supertest (`node-testing-supertest`)

*Scope:* Testing Node.js/TypeScript backends with Vitest or Jest, Supertest or fastify.inject, Testcontainers, and MSW or nock: unit tests for domain logic, in-process HTTP integration tests, real databases in containers, mocked external HTTP, fake timers, and coverage gates. Use it when writing or reviewing tests for Node.js services.

- **[ARCHITECTURE]** Follow the test pyramid: many fast unit tests for domain logic and services, integration tests for HTTP routes and repositories against real infrastructure, and a few end-to-end tests; each level has its own command (`test:unit`, `test:integration`).
- **[MANDATORY]** Export the application factory separately from `listen()` (`buildApp()`/`createApp()`), so tests exercise the full HTTP pipeline in-process with Supertest (`request(app)`) or `fastify.inject()` without binding ports.
- **[MANDATORY]** Integration tests use real dependencies of the same engine and version as production through Testcontainers (PostgreSQL, Redis, Kafka, LocalStack), with migrations applied; in-memory substitutes such as SQLite for PostgreSQL are not acceptable for repository tests.
- **[PATTERN]** Mock only at the process boundary: external HTTP APIs with MSW (`setupServer`) or nock with `disableNetConnect()`, so unexpected outbound calls fail the test; do not mock your own modules deeply or the ORM in integration tests.
- **[PATTERN]** Tests are isolated and order-independent: each test creates its own data (factories/builders with unique ids), cleans up via transaction rollback or truncation, and never depends on data left by another test.
- **[PATTERN]** Assert behavior and contracts: status codes, response bodies validated against the API schema, headers (security headers, `Location`, `Content-Type: application/problem+json`), and persisted side effects; not implementation details or snapshot dumps of large objects.
- **[MANDATORY]** Cover the unhappy paths for every route: validation errors (400/422), unauthenticated (401), forbidden and cross-tenant access (403/404), not found, conflict, and dependency failures or timeouts.
- **[PATTERN]** Control time and randomness: `vi.useFakeTimers()`/`jest.useFakeTimers()` or an injected clock for time-dependent logic, seeded or injected id generators; never `setTimeout` sleeps to wait for async work (poll with `vi.waitFor` or await the event).
- **[PERFORMANCE]** Keep the suite fast: start containers once per test run (global setup) and reuse them, run test files in parallel with isolated schemas or databases, and keep unit tests free of I/O.
- **[FORBIDDEN]** Tests that hit shared or production environments, `.only`/`.skip` committed to the main branch (enforced by lint), and assertions inside `try/catch` blocks that swallow failures.
- **[TESTING]** CI runs type checking, linting, unit and integration tests with coverage thresholds on changed code (for example 80% lines and branches via `vitest --coverage`), and publishes JUnit reports.
- **[REFERENCE]** See `references/node-testing-supertest.md` for reference anti-patterns and best practices.

### 7. API Design with OpenAPI (`api-design-openapi`)

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
