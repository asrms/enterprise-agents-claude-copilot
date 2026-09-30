---
name: rust-error-handling
description: "Error handling in Rust: Result and Option instead of panics, the ? operator with From conversions, library error enums with thiserror, application errors with anyhow or eyre and context, error sources and chains, mapping errors to HTTP responses or exit codes, panics only for bugs, and logging errors once with tracing. Use it when designing or reviewing error handling in Rust crates and services."
---

# Skill: Rust Error Handling

## Implementation Rules:
- **[MANDATORY]** Return `Result<T, E>` for recoverable failures and `Option<T>` for absence; reserve `panic!`, `unwrap()`, and `expect()` for programmer errors and invariants that truly cannot fail (with an `expect` message explaining why).
- **[PATTERN]** In libraries, define structured error types with `thiserror`: an enum per module or crate with meaningful variants, `#[error("...")]` messages, and `#[from]` or `#[source]` to preserve underlying causes; expose variants callers need to match on.
- **[PATTERN]** In applications (binaries, services), use `anyhow` or `eyre` for propagation with `.context("loading config from {path}")` / `with_context` so errors carry a readable chain, and convert to structured errors at API boundaries.
- **[MANDATORY]** Propagate with `?` and add context at each meaningful layer; never discard errors with `let _ =` on fallible operations unless the reason is documented.
- **[PATTERN]** Map errors to transport responses in one place: an `IntoResponse` implementation for an API error type in axum, with domain variants mapped to status codes and problem details, and internal errors logged with their chain but returned as generic 500 messages.
- **[PATTERN]** Log each error once at the boundary with `tracing` (`tracing::error!(error = ?err, "failed to place order")`), including the source chain, rather than logging and returning at every layer.
- **[FORBIDDEN]** `unwrap()` on I/O, parsing, network, or user input in production code, `Box<dyn Error>` in public library APIs where callers need to match, stringly typed errors (`Result<T, String>`), and panicking across FFI boundaries.
- **[PATTERN]** Use `Option` combinators (`ok_or`, `ok_or_else`, `map`, `and_then`) and `Result` combinators (`map_err`) to convert between absence and errors explicitly.
- **[CONFIGURATION]** Enable Clippy lints that catch risky patterns in production code (`clippy::unwrap_used`, `clippy::expect_used`, `clippy::panic` as warnings or denials outside tests), and set `panic = "abort"` only where unwinding is not needed.
- **[PATTERN]** For binaries, exit with meaningful codes (`std::process::ExitCode`) and print user-friendly error chains; for services, keep the process alive on request errors and use panic hooks only for logging.
- **[TESTING]** Test error paths explicitly: assert on error variants with `matches!` or `assert!(matches!(err, OrderError::NotFound { .. }))`, and verify HTTP mappings and error messages.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
