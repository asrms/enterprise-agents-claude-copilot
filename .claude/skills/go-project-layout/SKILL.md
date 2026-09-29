---
name: go-project-layout
description: "Idiomatic Go project structure and design: modules and versioning, cmd and internal packages, package naming by responsibility, small consumer-defined interfaces, explicit dependency wiring in main, configuration, linting with golangci-lint, and reproducible builds. Use it when creating, organizing, or reviewing Go repositories."
---

# Skill: Go Project Layout

## Implementation Rules:
- **[ARCHITECTURE]** One Go module per deployable or library (`go.mod` with a current Go version and `toolchain` directive); binaries live under `cmd/<app>/main.go`, private code under `internal/`, and `pkg/` is used only for code deliberately meant to be imported by other modules.
- **[ARCHITECTURE]** Organize packages by domain responsibility (`internal/order`, `internal/payment`, `internal/platform/postgres`), not by technical layer (`models`, `controllers`, `utils`); a package has a clear, singular purpose and a short, lowercase, non-plural name.
- **[FORBIDDEN]** Packages named `util`, `common`, `helpers`, or `base`; import cycles worked around with global registries; stuttering names (`order.OrderService` instead of `order.Service`); and `init()` functions with side effects beyond trivial registration.
- **[PATTERN]** Define interfaces where they are consumed, keep them small (one to three methods), and return concrete types from constructors ("accept interfaces, return structs"); do not create interfaces preemptively for every type.
- **[PATTERN]** Wire dependencies explicitly in `main` (or a `run(ctx, args, env) error` function called by `main`): construct configuration, clients, repositories, and servers and pass them through constructors; no global mutable state or package-level singletons for dependencies.
- **[MANDATORY]** Configuration comes from environment variables or flags, parsed and validated once at startup into a typed struct; the process fails fast with a clear message on invalid configuration.
- **[PATTERN]** Keep `main` minimal and testable: `func main() { if err := run(context.Background(), os.Args, os.Getenv); err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(1) } }`, with signal handling via `signal.NotifyContext`.
- **[MANDATORY]** Code is formatted with `gofmt`/`goimports`, vetted with `go vet`, and linted with `golangci-lint` using a committed configuration (errcheck, staticcheck, gosec, revive, errorlint, bodyclose, contextcheck enabled).
- **[PATTERN]** Tools used by the project are pinned in `go.mod` via `tool` directives (Go 1.24+) or a `tools.go` file, and generated code (`sqlc`, `protoc-gen-go`, `mockgen`) is produced by `go generate` and committed or regenerated in CI consistently.
- **[PERFORMANCE]** Build reproducible, static binaries: `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=$VERSION"`, packaged in minimal images (distroless or scratch) running as non-root.
- **[TESTING]** CI runs `go mod tidy` with a diff check, `go vet`, `golangci-lint run`, `go test -race ./...`, and `govulncheck ./...` on every change.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
