---
name: go-security
description: "Secure coding in Go: govulncheck and module hygiene, parameterized SQL, safe templates with html/template, command execution without shells, path traversal protection, crypto/rand and modern crypto APIs, TLS configuration, secrets handling, input limits, and gosec linting. Use it when writing or reviewing Go code for security."
---

# Skill: Go Security

## Implementation Rules:
- **[MANDATORY]** Scan dependencies and code with `govulncheck ./...` (reachability-aware) and `gosec` (via golangci-lint) in CI; keep `go.sum` committed, use the module proxy and checksum database (`GOFLAGS=-mod=readonly`, with `GOPRIVATE`/`GONOSUMDB` limited to your private module paths), and update the Go toolchain for security releases.
- **[MANDATORY]** SQL is always parameterized (`db.QueryContext(ctx, "... WHERE id = $1", id)`, sqlc, or a query builder); dynamic identifiers such as sort columns are chosen from an allow-list, never formatted with `fmt.Sprintf` from input.
- **[MANDATORY]** HTML output uses `html/template` (context-aware escaping), never `text/template` for HTML; do not convert untrusted input to `template.HTML`, `template.JS`, or `template.URL`.
- **[FORBIDDEN]** `exec.Command("sh", "-c", userInput)` or any shell invocation with untrusted data; call binaries directly with separate arguments, validated against allow-lists, and with a timeout context (`exec.CommandContext`).
- **[SECURITY]** Prevent path traversal: open user-influenced paths through `os.Root` (Go 1.24+) or `filepath.Clean` plus prefix checks against a base directory; limit extracted archive sizes and entry paths (zip slip).
- **[SECURITY]** Use `crypto/rand` for tokens, ids, and keys (`rand.Text()` in Go 1.24+ or `rand.Read`), never `math/rand`; compare secrets with `subtle.ConstantTimeCompare`; hash passwords with `argon2id` or `bcrypt` from `golang.org/x/crypto`.
- **[SECURITY]** Use high-level, modern crypto: AES-GCM or `chacha20poly1305` for encryption with unique nonces, Ed25519 or ECDSA P-256 for signatures, SHA-256 or better for hashing; never MD5/SHA-1 for security purposes or custom crypto constructions.
- **[SECURITY]** TLS: `MinVersion: tls.VersionTLS12` (prefer 1.3), default cipher suites, certificate verification always on (`InsecureSkipVerify` forbidden outside tests), and mTLS for service-to-service traffic where required.
- **[MANDATORY]** Bound all input: `http.MaxBytesReader` for bodies, limits on JSON depth/array sizes via validation, `io.LimitReader` on external responses and decompression, and server timeouts, so attackers cannot exhaust memory or connections.
- **[SECURITY]** Secrets are loaded from the environment or a secret manager at startup, never committed or logged; `slog` handlers redact sensitive attributes (implement `slog.LogValuer` for types holding secrets).
- **[PATTERN]** Authorization is enforced in the service layer for every object access (ownership or tenant checks), not only in middleware based on roles, and authentication tokens are validated for signature, algorithm, issuer, audience, and expiry.
- **[TESTING]** Security tests cover injection attempts, path traversal payloads, oversized bodies, invalid tokens, and cross-tenant access; fuzz tests exercise parsers of untrusted input.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
