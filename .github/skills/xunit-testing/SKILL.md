---
name: xunit-testing
description: "Testing .NET applications with xUnit: unit tests with the Arrange-Act-Assert pattern, theories, fixtures and shared context, WebApplicationFactory integration tests, Testcontainers, test doubles with NSubstitute or fakes, time abstraction with TimeProvider, coverage, and snapshot/approval tests. Use it when writing or reviewing .NET tests."
---

# Skill: xUnit Testing

## Implementation Rules:
- **[ARCHITECTURE]** Separate test projects by level (`*.UnitTests`, `*.IntegrationTests`, `*.ArchitectureTests`) mirroring the production projects; unit tests run without I/O in milliseconds, integration tests use real infrastructure.
- **[PATTERN]** Name tests by behavior (`Pay_WhenOrderIsNotPending_Throws`) and structure them as Arrange-Act-Assert with one behavior per test; use `[Theory]` with `[InlineData]`/`[MemberData]` or `TheoryData<T>` for input variations instead of copy-pasted facts.
- **[MANDATORY]** Integration tests of HTTP APIs use `WebApplicationFactory<Program>` with real dependencies in Testcontainers (SQL Server, PostgreSQL, Redis, RabbitMQ) and replace only external services; the EF Core InMemory provider is not used to test data access.
- **[PATTERN]** Share expensive setup correctly: `IClassFixture<T>` for per-class context, `ICollectionFixture<T>` for containers shared across classes, `IAsyncLifetime` for async setup and teardown; reset database state between tests (Respawn or transaction rollback).
- **[PATTERN]** Test doubles only at architectural boundaries (ports such as repositories, gateways, clocks), preferring hand-written fakes for stateful dependencies and NSubstitute/Moq for interactions; never mock types you do not own such as `DbContext` or `HttpClient` internals (use `HttpMessageHandler` fakes or WireMock.Net).
- **[MANDATORY]** Time and randomness are injected: use `TimeProvider` with `FakeTimeProvider` for time-dependent logic, and seeded generators for random data; no `Thread.Sleep` or `Task.Delay` to wait for asynchronous results.
- **[PATTERN]** Assertions are specific and readable (xUnit `Assert` or Shouldly/AwesomeAssertions); assert on status codes, problem details, persisted state, and published messages, and use snapshot testing (Verify) for large, stable outputs such as generated documents or API contracts.
- **[FORBIDDEN]** Tests depending on execution order or shared mutable static state, tests that touch shared environments, and catching exceptions manually instead of `Assert.Throws`/`Assert.ThrowsAsync`.
- **[PERFORMANCE]** Keep the suite fast and parallel: xUnit runs test collections in parallel; put tests that share a container in the same collection, and avoid starting a container per test.
- **[TESTING]** CI runs `dotnet test` with coverage collection (`--collect "XPlat Code Coverage"` or Microsoft.Testing.Platform coverage), enforces thresholds on changed code, publishes TRX/JUnit results, and treats flaky tests as bugs to fix or quarantine with an issue.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
