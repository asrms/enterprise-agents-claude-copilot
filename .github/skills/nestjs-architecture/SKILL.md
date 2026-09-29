---
name: nestjs-architecture
description: "NestJS application architecture: feature modules with clear boundaries, providers and dependency injection, thin controllers, DTO validation with class-validator or Zod, guards, interceptors, exception filters, configuration validation, and graceful shutdown. Use it when building or reviewing NestJS backends."
---

# Skill: NestJS Architecture

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
