---
name: axum-services
description: "Building HTTP services in Rust with axum and the tower ecosystem: routers and state, typed extractors and validation, error types implementing IntoResponse, middleware with tower-http (tracing, timeouts, compression, CORS, request ids, body limits), authentication with JWT, database access with sqlx, configuration, graceful shutdown, OpenTelemetry, and testing with tower::ServiceExt. Use it when creating or reviewing axum-based web services."
---

# Skill: Axum Services

## Implementation Rules:
- **[ARCHITECTURE]** Organize the service into a `Router` built from feature routers (`Router::new().nest("/v1/orders", orders::router())`), with shared application state (`AppState` holding pools, clients, and configuration, cheaply cloneable via `Arc`) passed with `.with_state(state)`.
- **[MANDATORY]** Use typed extractors (`Path`, `Query`, `Json`, `State`) with dedicated request DTOs deriving `Deserialize` (with `deny_unknown_fields` where the contract is strict), and validate them (for example with the `validator` crate or constructors of newtypes) before calling domain logic.
- **[MANDATORY]** Define an application error type implementing `IntoResponse` that maps domain errors to status codes and problem details and logs internal errors once; handlers return `Result<impl IntoResponse, AppError>`.
- **[MANDATORY]** Apply tower-http middleware: `TraceLayer` with request spans, `SetRequestIdLayer`/`PropagateRequestIdLayer`, `TimeoutLayer`, `RequestBodyLimitLayer`, `CompressionLayer`, and a strict `CorsLayer` allow-list; order layers deliberately.
- **[SECURITY]** Authenticate requests with a middleware or extractor that validates JWTs (signature via JWKS, algorithm allow-list, issuer, audience, expiry with `jsonwebtoken`) and inserts the principal into request extensions; enforce authorization per resource in handlers or services.
- **[PATTERN]** Access databases with `sqlx` (compile-time checked queries with `query!`/`query_as!` and offline mode in CI) or another async driver, a `PgPool` sized to capacity, migrations with `sqlx migrate`, and transactions for multi-step writes.
- **[PATTERN]** Load configuration at startup into a typed struct (for example with the `config` crate or `envy`) and fail fast on invalid values; secrets from the environment or a secret manager.
- **[FORBIDDEN]** Business logic in handlers beyond mapping, `unwrap()` on request data, blocking calls in handlers, returning internal error messages to clients, and unbounded request bodies.
- **[PATTERN]** Serve with graceful shutdown (`axum::serve(listener, app).with_graceful_shutdown(signal)`) and expose liveness and readiness endpoints; emit OpenTelemetry traces and metrics through `tracing-opentelemetry` or the OpenTelemetry SDK.
- **[PERFORMANCE]** Keep handlers async end to end, reuse HTTP clients (`reqwest::Client` in state), and stream large responses (`Body::from_stream`) instead of buffering.
- **[TESTING]** Test the router in-process with `tower::ServiceExt::oneshot` (or `axum-test`), using real state with Testcontainers databases or fakes, and cover validation errors, authentication failures, and error mapping.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
