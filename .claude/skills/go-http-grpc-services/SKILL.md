---
name: go-http-grpc-services
description: "Production HTTP and gRPC services in Go: net/http ServeMux routing (Go 1.22+ patterns) or chi, middleware chains, server and client timeouts, JSON decoding limits, graceful shutdown, health checks, gRPC with interceptors, deadlines, status codes, and connection reuse. Use it when building or reviewing Go network services."
---

# Skill: Go HTTP and gRPC Services

## Implementation Rules:
- **[ARCHITECTURE]** Prefer the standard library `net/http` with the enhanced `ServeMux` patterns (`mux.HandleFunc("GET /orders/{id}", h.getOrder)`, `r.PathValue("id")`) or a thin router such as chi; avoid heavy frameworks that hide `http.Handler` semantics.
- **[MANDATORY]** Configure server timeouts explicitly: `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout` (or per-handler `http.TimeoutHandler`/`ResponseController` deadlines for streaming), `IdleTimeout`, and `MaxHeaderBytes`; the zero-value `http.Server` (and `http.ListenAndServe`) is not used in production.
- **[MANDATORY]** Outbound HTTP uses a shared `http.Client` with a `Timeout` and a tuned `Transport` (connection pooling, `MaxIdleConnsPerHost`), requests created with `http.NewRequestWithContext`, response bodies always closed and drained, and response size limited with `io.LimitReader`.
- **[MANDATORY]** Decode request bodies safely: `http.MaxBytesReader`, `json.Decoder` with `DisallowUnknownFields()`, a check that there is no trailing data, and explicit validation of the decoded struct before use.
- **[PATTERN]** Middleware is composed as `func(http.Handler) http.Handler`: request id and trace context, structured access logging with `slog`, panic recovery, authentication, rate limiting, CORS, and security headers, applied in a well-defined order.
- **[PATTERN]** Graceful shutdown: listen for `SIGTERM` with `signal.NotifyContext`, stop readiness, call `srv.Shutdown(ctx)` with a deadline shorter than the orchestrator's termination grace period, and close dependencies afterwards.
- **[PATTERN]** Expose `GET /livez` (process alive, no dependency checks) and `GET /readyz` (dependencies reachable and not shutting down), and serve metrics and pprof on a separate internal port.
- **[PATTERN]** gRPC services use generated code from versioned protos (Buf), unary and stream interceptors (`grpc.ChainUnaryInterceptor`) for auth, logging, metrics, tracing (otelgrpc), and panic recovery, and return errors with `status.Error(codes.X, msg)` plus details, never raw Go errors.
- **[MANDATORY]** gRPC clients always set deadlines (`context.WithTimeout`), reuse a single `grpc.ClientConn` per target created with `grpc.NewClient`, configure keepalive and retry policies through the service config, and use TLS or mTLS credentials outside local development.
- **[SECURITY]** TLS configuration uses `MinVersion: tls.VersionTLS12` or higher with Go's default cipher suites, `InsecureSkipVerify` is never set outside tests, and authentication validates tokens with maintained libraries (for example `github.com/coreos/go-oidc` or `github.com/golang-jwt/jwt/v5` with explicit algorithms).
- **[TESTING]** Test handlers with `httptest.NewRecorder`/`httptest.NewServer` and gRPC services with `bufconn`, covering validation errors, status mapping, timeouts, and authentication failures.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
