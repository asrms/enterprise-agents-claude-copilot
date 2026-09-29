---
name: fastify-express-hardening
description: "Production hardening for Node.js HTTP servers built with Fastify or Express: schema validation, security headers, CORS, rate limiting, body limits, centralized error handling, structured logging with pino, timeouts, graceful shutdown, and health endpoints. Use it when building or reviewing Fastify or Express APIs."
---

# Skill: Fastify and Express Hardening

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
