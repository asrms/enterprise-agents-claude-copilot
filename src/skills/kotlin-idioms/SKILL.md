---
name: kotlin-idioms
description: "Idiomatic, safe Kotlin for backend services: null safety without !!, immutability with val and read-only collections, data classes and value classes, sealed hierarchies with exhaustive when, extension functions used judiciously, scope functions with restraint, Result and domain error types, explicit API mode for libraries, and linting with detekt and ktlint. Use it when writing or reviewing Kotlin code."
---

# Skill: Kotlin Idioms

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
