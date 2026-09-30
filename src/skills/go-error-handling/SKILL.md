---
name: go-error-handling
description: "Idiomatic Go error handling: always checking errors, wrapping with %w and context, sentinel and typed errors inspected with errors.Is and errors.As, errors.Join, mapping domain errors to HTTP/gRPC status at the boundary, panics only for programmer errors, and structured logging with slog. Use it when writing or reviewing Go error handling."
---

# Skill: Go Error Handling

## Implementation Rules:
- **[MANDATORY]** Every returned error is checked or explicitly and visibly ignored with a justification (`_ = f.Close() // read-only file`); `errcheck` in golangci-lint enforces this.
- **[MANDATORY]** Add context when propagating: `fmt.Errorf("load order %s: %w", id, err)` using `%w` so callers can inspect the chain; messages are lowercase, without trailing punctuation, and do not repeat "failed to" at every level.
- **[PATTERN]** Expose expected failure conditions as sentinel errors (`var ErrNotFound = errors.New("order: not found")`) or typed errors (`type ValidationError struct{ Field, Reason string }`) and inspect them with `errors.Is` and `errors.As`, never by comparing error strings.
- **[PATTERN]** Decide deliberately what becomes part of the API: wrap with `%w` when callers may rely on the underlying error, and use `%v` to hide implementation details (for example driver errors) behind your own domain errors.
- **[PATTERN]** Translate infrastructure errors into domain errors at the adapter boundary (`pgx.ErrNoRows` to `order.ErrNotFound`, unique violation to `order.ErrConflict`), so business code never imports database drivers to check errors.
- **[MANDATORY]** Map domain errors to transport status codes in one place (an HTTP error-writing helper or gRPC interceptor): not found to 404/`NotFound`, validation to 400/`InvalidArgument`, conflict to 409/`AlreadyExists` or `Aborted`, unknown to 500/`Internal` without internal details.
- **[PATTERN]** Handle an error once: either log it or return it, not both; log at the boundary (handler, worker loop) with structured context using `log/slog` (`slog.ErrorContext(ctx, "place order", "err", err, "order_id", id)`).
- **[PATTERN]** Use `errors.Join` to combine multiple independent errors (validation of several fields, closing several resources), and `defer` with a named return to capture close errors of writers (`defer func() { err = errors.Join(err, f.Close()) }()`).
- **[FORBIDDEN]** `panic` for expected errors, `log.Fatal` outside `main`, returning `nil, nil` for "not found" without documenting it, discarding errors from `Close` on writable resources, and shadowing `err` in nested scopes in a way that loses the error.
- **[PATTERN]** Recover from panics only at goroutine and request boundaries (HTTP middleware, worker loops), converting them to 500 responses or logged errors with a stack trace, so one bad request does not crash the process.
- **[TESTING]** Tests assert error identity and type with `errors.Is`/`errors.As` (not message strings), cover every mapped status code, and verify that internal details are not exposed in responses.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
