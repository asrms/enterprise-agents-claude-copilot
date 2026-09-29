---
name: ktor-services
description: "Building HTTP services with Ktor server: application modules and configuration, routing organized by feature, content negotiation with kotlinx.serialization, request validation, StatusPages for problem details, authentication with JWT and OAuth plugins, CORS, rate limiting, call logging with correlation ids, dependency injection, graceful shutdown, OpenTelemetry, and testing with testApplication. Use it when creating or reviewing Ktor backends."
---

# Skill: Ktor Services

## Implementation Rules:
- **[ARCHITECTURE]** Structure the application as modules (`fun Application.module()` functions) that install plugins and register feature routes (`fun Route.orderRoutes(service: OrderService)`), keeping route handlers thin and business logic in services that do not depend on Ktor types.
- **[MANDATORY]** Load configuration from `application.conf` or `application.yaml` with environment variable overrides, map it to typed data classes at startup, and fail fast on missing values; secrets come from the environment or a secret manager.
- **[MANDATORY]** Install `ContentNegotiation` with kotlinx.serialization (`json { ignoreUnknownKeys = false; explicitNulls = false }` chosen deliberately), use dedicated request and response DTOs, and validate input (the `RequestValidation` plugin or explicit validation in DTO constructors) before calling services.
- **[MANDATORY]** Map errors centrally with `StatusPages`: domain errors to status codes and RFC 9457 problem details, validation failures to 400, and unexpected exceptions to 500 without stack traces in responses.
- **[SECURITY]** Authenticate with the `Authentication` plugin (`jwt` with issuer, audience, and JWKS verification, or `oauth` for browser flows), protect routes with `authenticate { }` blocks, and enforce authorization per resource in services; configure `CORS` with explicit hosts and the `RateLimit` plugin for public endpoints.
- **[PATTERN]** Add operational plugins: `CallId` and `CallLogging` with MDC for correlation, `DefaultHeaders`, `Compression`, health endpoints (liveness and readiness), and OpenTelemetry instrumentation (the Ktor OpenTelemetry instrumentation or the Java agent).
- **[PATTERN]** Wire dependencies explicitly (constructor injection in the module, or Koin) so tests can replace them; avoid global singletons for stateful components.
- **[PERFORMANCE]** Keep handlers non-blocking: use suspend-friendly clients (Ktor client, R2DBC or coroutine-aware database access), or wrap blocking JDBC calls in `withContext(Dispatchers.IO)` with bounded pools; set timeouts on the Ktor client (`HttpTimeout`).
- **[FORBIDDEN]** Business logic inside routing lambdas, returning domain entities directly, catching exceptions per route with ad hoc responses, `runBlocking` inside handlers, and disabling TLS verification in HTTP clients.
- **[PATTERN]** Shut down gracefully: configure the engine's shutdown grace period and timeout, stop accepting requests, and close resources (database pools, clients) in `ApplicationStopping`/`monitor` handlers.
- **[TESTING]** Test routes with `testApplication { }` using the real module with fake services or Testcontainers-backed dependencies, a configured client with content negotiation, and assertions on status codes, bodies, and headers, including authentication failures.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
