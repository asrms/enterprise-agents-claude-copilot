---
name: kotlin-backend-playbook
description: "Playbook of the kotlin-backend agent (role, rules, acceptance criteria, examples), usable with or without the agent. Senior Kotlin backend engineer for JVM services with Ktor or Spring Boot: idiomatic and null-safe Kotlin, coroutines and Flow, type-safe data access with jOOQ, Exposed, or Spring Data, kotlinx.serialization contracts, and testing with Kotest and MockK. Use it for building, reviewing, refactoring, or migrating Kotlin backend services."
---

# Playbook: kotlin-backend

This playbook holds everything the `kotlin-backend` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Senior Kotlin Backend Engineer who builds expressive, null-safe, concurrent, and well-tested JVM services with Ktor or Spring Boot.

## Objective

Build, review, and modernize Kotlin backend services. First read and search the codebase for `build.gradle.kts`, `settings.gradle.kts`, and version catalogs (Kotlin, framework, and library versions), compiler options, the server framework (Ktor or Spring Boot), module structure, persistence layer, serialization setup, detekt and ktlint configuration, and existing tests, then follow the established conventions unless they violate a skill rule. Deliver domain models with value classes and sealed results, thin HTTP layers with centralized error handling and authentication, structured coroutines with injected dispatchers, type-safe and parameterized data access with migrations, stable serialization contracts, and tests with fakes, virtual time, and Testcontainers. For Java-style Kotlin or Java code, propose incremental idiomatic migrations. Run `./gradlew build`, detekt, ktlint, and tests in the terminal and report the results. Before producing code, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- Code compiles with the current stable Kotlin (K2) with warnings as errors and strict nullability for Java interop, passes detekt and ktlint, and contains no `!!` on external data, no `GlobalScope`, and no `runBlocking` in request paths.
- Domain concepts use value classes with validation, immutable data classes, and sealed hierarchies handled with exhaustive `when`; expected failures are explicit results, not strings or swallowed exceptions.
- HTTP layers (Ktor modules or Spring controllers) are thin, use request and response DTOs with validation, map errors centrally to problem details, authenticate with verified JWT or OAuth, and keep business logic in framework-independent services.
- Coroutines are structured with lifecycle-bound scopes, injected and bounded dispatchers for blocking work, timeouts on remote calls, correct cancellation handling, and read-only flows exposed to consumers.
- Persistence uses type-safe or parameterized queries behind repository interfaces, correct transaction handling with coroutines, pools sized to capacity, no N+1 queries, and Flyway or Liquibase migrations instead of auto-DDL.
- Serialized contracts use dedicated DTOs with stable `@SerialName`s, decimal money, sealed polymorphism with discriminators, additive evolution with defaults, and golden-file tests for public contracts.
- Tests use Kotest or JUnit 5 with MockK only at boundaries (no relaxed mocks by default), fakes for ports, `runTest` with virtual time, data-driven and property-based cases, and Testcontainers for integration.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. Kotlin Idioms (`kotlin-idioms`)

*Scope:* Idiomatic, safe Kotlin for backend services: null safety without !!, immutability with val and read-only collections, data classes and value classes, sealed hierarchies with exhaustive when, extension functions used judiciously, scope functions with restraint, Result and domain error types, explicit API mode for libraries, and linting with detekt and ktlint. Use it when writing or reviewing Kotlin code.

- **[MANDATORY]** Embrace null safety: model optional values with nullable types deliberately, handle them with `?.`, `?:`, `let`, and early returns, and never use `!!` on data from outside the current function (requests, databases, external APIs).
- **[MANDATORY]** Prefer immutability: `val` over `var`, read-only collection types (`List`, `Map`) in APIs, `copy()` on data classes for changes, and no public mutable state in singletons (`object`).
- **[PATTERN]** Model the domain with types: `data class` for values with structural equality, `@JvmInline value class` for identifiers and constrained primitives (`OrderId`, `Email`) with validation in `init`, and `sealed interface` or `sealed class` hierarchies for states and results, handled with exhaustive `when` without `else`.
- **[PATTERN]** Represent expected failures explicitly: sealed result types or `Result<T>` at domain boundaries, exceptions for programming errors and truly exceptional infrastructure failures, and never swallowed exceptions.
- **[PATTERN]** Use scope functions with restraint and consistent meaning (`apply` for configuration, `also` for side effects, `let` for nullable transforms), avoiding deeply nested scope chains that hide `this` and `it`.
- **[PATTERN]** Write extension functions for readability of domain operations or to adapt third-party APIs, keeping them discoverable (in the relevant package) and avoiding extensions on very general types (`Any`, `String`) with domain meaning.
- **[PATTERN]** Prefer expression bodies and standard library functions (`map`, `filter`, `associateBy`, `groupBy`, `fold`, `buildList`) for clarity, and `Sequence` for large or lazy pipelines.
- **[FORBIDDEN]** `lateinit` for values that can be constructor parameters, platform types from Java APIs leaked into Kotlin signatures without explicit nullability, `!!` as a shortcut, and catching `Throwable` or `CancellationException` without rethrowing.
- **[CONFIGURATION]** Enable strict compiler settings: `allWarningsAsErrors` in CI, explicit API mode (`explicitApi()`) for libraries, JSpecify or JSR-305 nullability annotations respected in strict mode for Java interop, and the current stable Kotlin with the K2 compiler.
- **[PATTERN]** Keep code style consistent with the official Kotlin coding conventions, enforced by ktlint (or the IntelliJ formatter in CI) and detekt with a committed configuration.
- **[TESTING]** Cover domain types and sealed hierarchies with unit tests (Kotest or JUnit 5), including validation in value classes and every branch of result handling.
- **[REFERENCE]** See `references/kotlin-idioms.md` for reference anti-patterns and best practices.

### 2. Kotlin Coroutines and Flow (`kotlin-coroutines-flow`)

*Scope:* Kotlin coroutines and Flow for Android and server-side Kotlin: structured concurrency with scopes, injected dispatchers, cancellation and cooperative checks, exception handling with supervisorScope and CoroutineExceptionHandler, cold Flow vs StateFlow and SharedFlow, operators, stateIn and shareIn, backpressure, and testing with kotlinx-coroutines-test and Turbine. Use it when writing or reviewing coroutine-based Kotlin code.

- **[MANDATORY]** Follow structured concurrency: launch coroutines only in scopes with a lifecycle (`viewModelScope`, `lifecycleScope`, a request scope, or an injected application `CoroutineScope`), and use `coroutineScope { }` inside suspend functions to run parallel work that completes before the function returns.
- **[FORBIDDEN]** `GlobalScope`, `runBlocking` in production code paths (except `main` or bridging at the edge of blocking frameworks), catching `CancellationException` without rethrowing it, and `Thread.sleep` inside coroutines.
- **[MANDATORY]** Suspend functions are main-safe: they switch to the right dispatcher internally (`withContext(ioDispatcher)` for blocking I/O, `Dispatchers.Default` for CPU work), and dispatchers are injected rather than hard-coded so tests can replace them.
- **[PATTERN]** Parallelize independent calls with `async`/`await` inside `coroutineScope`, bound concurrency for large fan-outs with `Semaphore` or `flatMapMerge(concurrency = n)`, and use `withTimeout`/`withTimeoutOrNull` for calls that must finish in bounded time.
- **[PATTERN]** Make long-running loops cooperative with `ensureActive()` or `yield()`, and release resources in `try/finally` (using `withContext(NonCancellable)` only for short cleanup that must suspend).
- **[PATTERN]** Handle failures deliberately: exceptions propagate to the parent and cancel siblings; use `supervisorScope`/`SupervisorJob` when children must fail independently, `runCatching`-style mapping to results at layer boundaries, and a `CoroutineExceptionHandler` only as a last-resort logger for root coroutines.
- **[PATTERN]** Expose streams as cold `Flow` from data sources, and convert to hot `StateFlow` for state (`stateIn(scope, SharingStarted.WhileSubscribed(5_000), initial)`) or `SharedFlow` for broadcasts (`shareIn`); expose read-only types (`asStateFlow()`), never `MutableStateFlow` publicly.
- **[PATTERN]** Use operators intentionally: `map`/`filter` for transformation, `combine` for derived state, `flatMapLatest` for latest-wins queries, `debounce`/`distinctUntilChanged` for input, `catch` placed upstream of collection for error mapping, and `flowOn` to change the upstream dispatcher.
- **[PERFORMANCE]** Handle backpressure with `buffer`, `conflate`, or `collectLatest` according to semantics, and avoid creating new flows on every call where a shared one is expected (for example in Compose recomposition).
- **[PATTERN]** Bridge callback APIs with `suspendCancellableCoroutine` (unregistering in `invokeOnCancellation`) and `callbackFlow` (with `awaitClose { }` cleanup).
- **[TESTING]** Test with `runTest` and a `StandardTestDispatcher` (virtual time with `advanceTimeBy`/`advanceUntilIdle`), set `Dispatchers.setMain` for Android ViewModels, and assert flows with Turbine (`flow.test { awaitItem() }`), including cancellation and error cases.
- **[REFERENCE]** See `references/kotlin-coroutines-flow.md` for reference anti-patterns and best practices.

### 3. Ktor Services (`ktor-services`)

*Scope:* Building HTTP services with Ktor server: application modules and configuration, routing organized by feature, content negotiation with kotlinx.serialization, request validation, StatusPages for problem details, authentication with JWT and OAuth plugins, CORS, rate limiting, call logging with correlation ids, dependency injection, graceful shutdown, OpenTelemetry, and testing with testApplication. Use it when creating or reviewing Ktor backends.

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
- **[REFERENCE]** See `references/ktor-services.md` for reference anti-patterns and best practices.

### 4. Spring Boot with Kotlin (`spring-kotlin`)

*Scope:* Spring Boot with Kotlin: the kotlin-spring and kotlin-jpa compiler plugins, constructor injection with immutable classes, configuration properties as data classes, null-safety with Spring's nullability annotations, coroutines in WebFlux and Spring MVC controllers, the Kotlin router and bean DSLs, JPA entity pitfalls in Kotlin, Jackson Kotlin module, and testing with MockK and SpringMockK. Use it when building or reviewing Spring Boot applications written in Kotlin.

- **[MANDATORY]** Apply the Kotlin compiler plugins generated by Spring Initializr: `kotlin("plugin.spring")` (all-open for Spring-annotated classes) and, when using JPA, `kotlin("plugin.jpa")` (no-arg constructors), and enable strict JSR-305/JSpecify nullability (`-Xjsr305=strict`) so Spring APIs have correct Kotlin nullability.
- **[MANDATORY]** Use constructor injection with `val` properties in primary constructors; no field injection with `lateinit var` and `@Autowired`.
- **[PATTERN]** Bind configuration to immutable data classes with `@ConfigurationProperties` (constructor binding) plus validation annotations and `@Validated`, registered via `@ConfigurationPropertiesScan`.
- **[PATTERN]** Use coroutines where the stack supports them: `suspend` controller functions and `Flow` return types in WebFlux or Spring MVC, coroutine repositories (`CoroutineCrudRepository`) with R2DBC, and `WebClient` or the Ktor client with `awaitBody`; in blocking stacks, consider virtual threads rather than wrapping JDBC in coroutines everywhere.
- **[PATTERN]** Model JPA entities carefully in Kotlin: regular classes (not data classes) with `id` handled explicitly, equality based on identifier semantics, lazy associations not exposed in `toString`, and mapping to separate DTOs or data classes for API responses.
- **[FORBIDDEN]** Data classes as JPA entities, `!!` on values from Spring APIs or requests, mutable companion-object state, and exposing entities directly in controllers.
- **[PATTERN]** Register `jackson-module-kotlin` (auto-configured when on the classpath) so data classes, default values, and nullability deserialize correctly, and reject unknown properties where the API contract requires it.
- **[PATTERN]** Use the Kotlin DSLs where they improve clarity: `router { }` or `coRouter { }` for functional endpoints, `beans { }` for programmatic registration, and the Spring Security Kotlin DSL (`http { authorizeHttpRequests { } }`).
- **[PATTERN]** Keep domain logic independent of Spring (plain Kotlin classes), with Spring used for wiring, transactions, and adapters.
- **[SECURITY]** Configure Spring Security with the Kotlin DSL: resource server JWT validation, method security (`@PreAuthorize`) for object-level checks, CSRF settings appropriate to the client type, and secure headers.
- **[TESTING]** Test with JUnit 5 or Kotest plus MockK (`@MockkBean` from SpringMockK instead of `@MockBean`), slice tests (`@WebMvcTest`, `@DataJpaTest`, `@WebFluxTest`) and `@SpringBootTest` with Testcontainers (`@ServiceConnection`) for integration.
- **[REFERENCE]** See `references/spring-kotlin.md` for reference anti-patterns and best practices.

### 5. Kotlin Data Access (`kotlin-data-access`)

*Scope:* Database access from Kotlin services: choosing between Spring Data (JPA or R2DBC), Exposed, jOOQ, and SQLDelight, type-safe queries, transactions with coroutines, connection pools (HikariCP) and R2DBC pools, avoiding N+1 queries, mapping rows to immutable data classes, migrations with Flyway or Liquibase, and testing with Testcontainers. Use it when writing or reviewing persistence code in Kotlin backends.

- **[ARCHITECTURE]** Choose the persistence approach deliberately: jOOQ or Exposed DSL for SQL-first, type-safe queries; Spring Data JPA when an ORM with rich mapping is justified; Spring Data R2DBC or the jOOQ/Exposed R2DBC options for fully non-blocking stacks; SQLDelight for multiplatform or SQL-defined schemas. Record the choice.
- **[MANDATORY]** Keep persistence behind repository interfaces owned by the domain or application layer; map database rows to immutable domain data classes at the boundary and never expose table objects or entities to API layers.
- **[MANDATORY]** Queries are type-safe or parameterized: generated jOOQ classes or Exposed table objects, never string-concatenated SQL with user input; dynamic sorting uses allow-listed columns.
- **[PATTERN]** Manage transactions explicitly and correctly with coroutines: `newSuspendedTransaction` for Exposed, `TransactionalOperator.executeAndAwait` for reactive Spring, or `@Transactional` on suspend functions supported by Spring's coroutine integration; never share a blocking JDBC transaction across coroutine threads.
- **[PERFORMANCE]** Run blocking JDBC on a bounded dispatcher (`Dispatchers.IO.limitedParallelism(poolSize)`) matching the HikariCP pool size, or use virtual threads; size connection pools to the database's capacity divided by instances.
- **[PERFORMANCE]** Avoid N+1 queries: fetch related data with joins or batched `IN` queries, use keyset pagination for large lists, and select only needed columns.
- **[PATTERN]** Use optimistic locking (version columns with conditional updates) or database constraints to protect invariants under concurrency, and map constraint violations to domain errors in repositories.
- **[MANDATORY]** Manage schema changes with Flyway or Liquibase migrations committed with the code and applied by a deployment step; ORM auto-DDL (`ddl-auto=update`, Exposed `SchemaUtils.create` in production) is not used outside tests.
- **[FORBIDDEN]** Blocking database calls on `Dispatchers.Default` or event-loop threads, transactions spanning remote HTTP calls, lazy-loading JPA associations outside transactions, and in-memory databases (H2) as substitutes for the production engine in integration tests.
- **[SECURITY]** Database credentials come from a secret manager or IAM authentication, connections use TLS, and the runtime user has only DML privileges.
- **[TESTING]** Test repositories against the real engine with Testcontainers and migrations applied, covering constraint violations, concurrency conflicts, and pagination, with data isolated per test.
- **[REFERENCE]** See `references/kotlin-data-access.md` for reference anti-patterns and best practices.

### 6. Kotlin Testing with Kotest and MockK (`kotlin-testing-kotest-mockk`)

*Scope:* Testing Kotlin code with Kotest and MockK (or JUnit 5): spec styles, expressive matchers, data-driven and property-based tests, coroutine tests with runTest and virtual time, MockK for mocks, spies, coEvery and relaxed mocks used sparingly, fakes for ports, Testcontainers extensions, and test organization. Use it when writing or reviewing tests for Kotlin backends and libraries.

- **[PATTERN]** Choose one test framework per project and use it consistently: Kotest (with a spec style such as `FunSpec` or `BehaviorSpec`) or JUnit 5 with Kotlin-friendly assertions; both run on the JUnit Platform in Gradle.
- **[PATTERN]** Name tests by behavior and structure them clearly (Given/When/Then or arrange-act-assert), one behavior per test, with Kotest matchers (`shouldBe`, `shouldContainExactly`, `shouldThrow<T>`) or AssertJ/Strikt for readable failures.
- **[PATTERN]** Use data-driven tests for variations (`withData` in Kotest, `@ParameterizedTest` in JUnit) and property-based tests (`checkAll` with `Arb` generators) for invariants of parsers, calculations, and value classes.
- **[MANDATORY]** Test coroutines with `kotlinx-coroutines-test` (`runTest`, `StandardTestDispatcher`, `advanceTimeBy`) or Kotest's coroutine support, injecting dispatchers and clocks; never rely on real delays.
- **[PATTERN]** Prefer hand-written fakes for your own ports (in-memory repositories) and use MockK for interactions with boundaries: `every`/`coEvery` for stubbing suspend functions, `verify`/`coVerify` only where the interaction is the behavior under test, and `slot` or `capture` to inspect arguments.
- **[FORBIDDEN]** Relaxed mocks as a default (they hide missing stubs), mocking data classes or value objects, verifying every call (brittle tests), `Thread.sleep` in tests, and shared mutable state between specs without isolation.
- **[MANDATORY]** Integration tests use real infrastructure through Testcontainers (Kotest extension or JUnit `@Testcontainers`), with migrations applied and data isolated per test.
- **[PATTERN]** Configure isolation deliberately (Kotest `isolationMode`, fresh fixtures per test), and use `beforeTest`/`afterTest` or `@BeforeEach` for setup rather than order-dependent tests.
- **[PATTERN]** Keep test fixtures readable with builder functions and default arguments (`order(status = PAID)`), and use object mothers sparingly.
- **[PERFORMANCE]** Keep unit tests fast and parallelizable (Kotest `parallelism`, JUnit parallel execution), sharing expensive containers per test run.
- **[TESTING]** CI runs `./gradlew test` (and integration tasks) with coverage via Kover and thresholds on changed modules, publishing JUnit XML reports.
- **[REFERENCE]** See `references/kotlin-testing-kotest-mockk.md` for reference anti-patterns and best practices.

### 7. Kotlin Serialization (`kotlin-serialization`)

*Scope:* Safe and efficient serialization in Kotlin with kotlinx.serialization (and Jackson where required): @Serializable data classes, explicit JSON configuration, default values and nullability, polymorphic sealed hierarchies with class discriminators, custom serializers for value classes, dates, and money, schema evolution and backward compatibility, and security against untrusted input. Use it when defining or reviewing JSON or other serialized contracts in Kotlin.

- **[PATTERN]** Use kotlinx.serialization with the compiler plugin for Kotlin-first code (Ktor, multiplatform, Spring with the kotlinx converter); use Jackson with `jackson-module-kotlin` when the framework or ecosystem requires it, but do not mix both for the same contract.
- **[MANDATORY]** Configure one shared `Json` instance per contract with explicit settings (`ignoreUnknownKeys`, `explicitNulls`, `encodeDefaults`, `coerceInputValues`) chosen deliberately and documented, rather than scattered ad hoc configurations.
- **[MANDATORY]** Separate serialized DTOs from domain models: `@Serializable` DTOs define the wire contract with `@SerialName` for stable field names, and mapping functions convert to domain types with validation.
- **[PATTERN]** Model polymorphism with sealed hierarchies and a class discriminator (`@JsonClassDiscriminator("type")` or `classDiscriminator` in the configuration) with stable `@SerialName` values, so new subtypes and renames do not break clients.
- **[PATTERN]** Write custom serializers for value classes with validation, dates and times (ISO 8601 with `kotlinx-datetime` or `java.time` serializers), `BigDecimal` money as strings, and enums with explicit serial names.
- **[MANDATORY]** Evolve contracts compatibly: add fields with defaults, never repurpose or rename existing serial names, tolerate unknown fields from newer producers where appropriate, and version contracts for breaking changes.
- **[SECURITY]** Treat input as untrusted: validate after deserialization (lengths, ranges, formats), limit payload sizes at the HTTP layer, and never enable polymorphic deserialization based on arbitrary class names from input (for example Jackson default typing).
- **[FORBIDDEN]** Serializing domain entities or JPA entities directly, `Double` for money, relying on property declaration order or Kotlin property names that may be refactored without `@SerialName`, and Java `Serializable` or native serialization for data crossing trust boundaries.
- **[PERFORMANCE]** Reuse `Json` instances and serializers, stream large payloads (`Json.decodeFromStream`, `encodeToStream`, or sequences) instead of building huge strings, and use binary formats (Protobuf via kotlinx or CBOR) where contracts and performance justify it.
- **[PATTERN]** Keep contract definitions discoverable: DTOs in a dedicated package or module, generated OpenAPI or JSON Schema where consumers need it, and examples in documentation.
- **[TESTING]** Test round trips, golden JSON files for public contracts (to detect accidental changes), backward compatibility with older payloads, polymorphic subtype handling, and rejection of invalid input.
- **[REFERENCE]** See `references/kotlin-serialization.md` for reference anti-patterns and best practices.
