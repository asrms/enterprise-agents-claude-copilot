---
name: aspnetcore-minimal-apis
description: "ASP.NET Core HTTP APIs on current .NET LTS with Minimal APIs or controllers: route groups, typed results, input validation, ProblemDetails, OpenAPI generation, options pattern with validation, health checks, rate limiting, output caching, and API versioning. Use it when building or reviewing ASP.NET Core web APIs."
---

# Skill: ASP.NET Core Minimal APIs

## Implementation Rules:
- **[ARCHITECTURE]** Target the current .NET LTS release; organize endpoints by feature with `MapGroup` and extension methods (`app.MapOrders()`), keeping `Program.cs` limited to composition (services, middleware, endpoint registration). Controllers remain acceptable for existing code bases that use them consistently.
- **[MANDATORY]** Use `TypedResults` with explicit union return types (`Results<Created<OrderResponse>, ValidationProblem, NotFound>`) so status codes and OpenAPI metadata are accurate and checked by the compiler.
- **[MANDATORY]** Validate every request: data annotations with the built-in Minimal API validation (`AddValidation()`) or FluentValidation via an endpoint filter; reject invalid input with `TypedResults.ValidationProblem` before calling the application layer.
- **[MANDATORY]** Errors are returned as RFC 9457 problem details: `AddProblemDetails()`, `UseExceptionHandler()` with an `IExceptionHandler` that maps domain exceptions to status codes, and `UseStatusCodePages()`; never return exception messages or stack traces outside Development.
- **[PATTERN]** Request and response records are separate from entities (`record CreateOrderRequest`, `record OrderResponse`), mapped explicitly; never bind directly to EF Core entities (overposting).
- **[PATTERN]** Configuration uses the options pattern with validation at startup: `AddOptions<T>().BindConfiguration("Section").ValidateDataAnnotations().ValidateOnStart()`; secrets come from user-secrets locally and Key Vault/secret managers in deployed environments.
- **[PATTERN]** Generate OpenAPI documents (`AddOpenApi()`/`MapOpenApi()`) with `WithName`, `WithSummary`, `Produces`, and tags on every endpoint, or implement against a contract-first OpenAPI file and verify they match in CI.
- **[SECURITY]** Enable HTTPS redirection and HSTS in production, authentication and authorization with policies (`RequireAuthorization("orders:write")`), the built-in rate limiter (`AddRateLimiter` with fixed/sliding/token-bucket policies), CORS with explicit origins, and request body size limits.
- **[PERFORMANCE]** Every endpoint accepts a `CancellationToken` and passes it down; use output caching or response caching where appropriate, `IHttpClientFactory` with resilience handlers (`AddStandardResilienceHandler()`) for outbound calls, and `System.Text.Json` source generation for hot paths.
- **[PATTERN]** Expose health checks (`AddHealthChecks()` with dependency checks, `MapHealthChecks("/health/ready")` and a dependency-free liveness endpoint) and version public APIs (`Asp.Versioning.Http`) in URL or header consistently.
- **[FORBIDDEN]** `async void`, `.Result`/`.Wait()` in request paths, service locator calls (`app.Services.GetService` inside handlers), static mutable state, and `AllowAnyOrigin()` combined with credentials.
- **[TESTING]** Integration-test endpoints with `WebApplicationFactory<Program>` and real dependencies in Testcontainers, replacing only external services; assert status codes, problem details, and authorization failures.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
