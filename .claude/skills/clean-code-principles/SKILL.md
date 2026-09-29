---
name: clean-code-principles
description: "Language-agnostic readability and design rules: intention-revealing names, small single-purpose functions, explicit error handling, no hidden side effects, immutability, cohesion and coupling, comments that explain why, and dead-code removal. Use it when writing or reviewing code in any language."
---

# Skill: Clean Code Principles

## Implementation Rules:
- **[MANDATORY]** Names reveal intent and domain meaning: `overdueInvoices`, `maxRetryAttempts`, `isEligibleForRefund()`; no abbreviations outside well-known ones (`id`, `url`, `http`), no type suffixes in names (`userList`, `strName`), no meaningless names (`data`, `info`, `manager`, `helper`, `util`, `tmp`) for anything that lives longer than a few lines.
- **[PATTERN]** Booleans read as predicates (`isActive`, `hasPermission`, `canRetry`), functions as verbs (`calculateTotal`, `sendReminder`), types and classes as nouns from the domain; use the same word for the same concept across the codebase (not `fetch`/`get`/`retrieve` interchangeably).
- **[MANDATORY]** A function does one thing at one level of abstraction: if its body mixes orchestration (calling steps) with low-level details (string parsing, SQL building), extract the details; a function that needs "and" in its name does two things.
- **[PATTERN]** Size guardrails, not dogma: functions above ~40 lines or with more than 3 levels of nesting, and classes/modules above ~400 lines or with more than one reason to change, are candidates for extraction; use guard clauses and early returns instead of nested `if/else` pyramids.
- **[PATTERN]** Parameters: at most 3–4 positional parameters; beyond that, introduce a parameter object or a builder; boolean flag parameters (`render(true)`) are replaced by two functions or an enum (`render(Mode.PREVIEW)`).
- **[FORBIDDEN]** Hidden side effects: a function named like a query (`getUser`, `isValid`, `calculateX`) must not mutate state, write to the database, send messages, or change its arguments (command–query separation).
- **[PATTERN]** Prefer immutability: values and DTOs are immutable (records, `final`/`readonly`/`const`, frozen dataclasses), collections returned from APIs are unmodifiable copies, and state changes go through explicit methods that preserve invariants.
- **[MANDATORY]** Errors are handled explicitly: never swallow exceptions (`catch {}`), never return `null` to signal failure where the language offers `Optional`/`Result`/exceptions, wrap errors with context (what was being done, with which identifiers) while preserving the cause.
- **[FORBIDDEN]** Magic numbers and strings in business logic: `if (status == 3)`, `amount * 0.22`, `"ADMIN"` scattered in code are replaced by named constants, enums, or configuration (`VAT_RATE_STANDARD`, `OrderStatus.SHIPPED`).
- **[PATTERN]** High cohesion, low coupling: code that changes together lives together (feature/domain folders over technical layers when it helps), depend on abstractions at boundaries (ports/interfaces for I/O), and avoid reaching through object chains (`order.getCustomer().getAddress().getCity()` → ask `order` for what you need).
- **[PATTERN]** DRY applies to knowledge, not to text: duplicate business rules must be unified, but two similar-looking pieces of code that change for different reasons stay separate (avoid premature abstraction; "rule of three").
- **[MANDATORY]** Comments explain why (business rule, trade-off, link to ticket/RFC, non-obvious constraint), not what the code already says; outdated comments are worse than none and are fixed or removed in the same change.
- **[FORBIDDEN]** Commented-out code, unused functions, variables, imports, parameters, and feature flags that are permanently on: version control keeps the history; delete them.
- **[PATTERN]** Make illegal states unrepresentable: use enums/sealed types/discriminated unions and value objects (`EmailAddress`, `Money`) instead of loosely validated primitives, and validate at construction so the rest of the code can trust the value.
- **[PATTERN]** Keep the happy path linear and visible: validate inputs at the top, handle the main flow without deep branching, isolate exceptional cases at the edges.
- **[CONFIGURATION]** Enforce what can be automated: formatter (Prettier, Black/Ruff, gofmt, dotnet format, Spotless), linter with complexity and naming rules (ESLint, Ruff, golangci-lint, Checkstyle/PMD, Roslyn analyzers) running in CI with warnings as errors on new code.
- **[TESTING]** Readable code is testable code: pure functions for business rules, dependencies injected instead of instantiated inside, time and randomness passed as parameters or injected clocks/generators.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
