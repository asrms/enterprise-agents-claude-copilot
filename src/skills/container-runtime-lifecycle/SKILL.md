---
name: container-runtime-lifecycle
description: "Container runtime behavior: exec form, PID 1 and signals, graceful shutdown, HEALTHCHECK, logs to stdout, 12-factor configuration, container-aware JVM and runtimes, time zone and locale. Use it when defining startup, shutdown, and health of a containerized service."
---

# Skill: Container Runtime Lifecycle

## Implementation Rules:
- **[MANDATORY]** `ENTRYPOINT` and `CMD` in JSON exec form (`["/app/server", "--port", "8080"]`): the shell form runs `/bin/sh -c`, the shell becomes PID 1, does not forward SIGTERM, and the container is killed with SIGKILL when the grace period expires (check `JSONArgsRecommended`, Hadolint DL3025).
- **[PATTERN]** `ENTRYPOINT` defines the executable and `CMD` the overridable default arguments; start the runtime directly (`node dist/server.js`, `java -jar /app/app.jar`, `gunicorn config.wsgi:application`) and not through `npm start`, `mvn spring-boot:run`, or `sh -c`, which do not propagate signals correctly.
- **[MANDATORY]** PID 1 does not get the kernel's default signal handlers and must reap zombie processes: if the application spawns child processes or does not handle SIGTERM, use a minimal init (`ENTRYPOINT ["/usr/bin/tini", "--", "/app/server"]` on Debian, `/sbin/tini` on Alpine) or `docker run --init` or `init: true` in Compose.
- **[MANDATORY]** Entrypoint scripts start with `#!/bin/sh` and `set -eu`, perform only idempotent preparation steps, and end with `exec "$@"`, so the application process replaces the shell and receives signals directly.
- **[CONFIGURATION]** Declare `STOPSIGNAL` when the application uses a signal other than SIGTERM for graceful shutdown (e.g. `STOPSIGNAL SIGQUIT` for nginx) and document it next to `stop_grace_period`.
- **[PATTERN]** Graceful shutdown: on SIGTERM the application sets readiness to not ready, stops accepting new connections, completes in-flight requests, closes pools and consumers, and exits with code 0 within a timeout shorter than `stop_grace_period` (Compose, default 10s) and `terminationGracePeriodSeconds` (Kubernetes, default 30s).
- **[PATTERN]** Reference implementations: Spring Boot `server.shutdown=graceful` with `spring.lifecycle.timeout-per-shutdown-phase=20s`; Node.js `process.on('SIGTERM')` with `server.close()`; Go `signal.NotifyContext(ctx, syscall.SIGTERM)` with `http.Server.Shutdown(ctx)`; Gunicorn `--graceful-timeout`.
- **[MANDATORY]** Define `HEALTHCHECK` with explicit parameters (`--interval=15s --timeout=3s --start-period=30s --start-interval=2s --retries=3`, where `--start-interval` requires Docker Engine ≥ 25 and hadolint ≥ 2.14.0) and an exec-form command that exits with 0 if healthy and 1 if unhealthy.
- **[FORBIDDEN]** Liveness healthchecks that query external dependencies (databases, brokers, downstream services): an external outage causes cascading restarts; dependencies are checked only in readiness.
- **[ARCHITECTURE]** Expose separate `/health/live` and `/health/ready` endpoints (Spring Boot: `management.endpoint.health.probes.enabled=true` exposes `/actuator/health/liveness` and `/actuator/health/readiness`); Kubernetes ignores `HEALTHCHECK` and uses `livenessProbe`, `readinessProbe`, and `startupProbe` on these endpoints.
- **[MANDATORY]** Logs only to stdout/stderr, unbuffered and preferably as structured JSON (`PYTHONUNBUFFERED=1`, Spring Boot 3.4+ `logging.structured.format.console=ecs`); log files inside the container, `logrotate`, and `VOLUME`s dedicated to logs are forbidden.
- **[CONFIGURATION]** 12-factor configuration: every parameter that varies across environments comes from environment variables or mounted files with safe defaults; at startup the application validates mandatory configuration and exits with a non-zero code if it is missing (fail fast).
- **[ARCHITECTURE]** Ephemeral filesystem: no state in the container's writable layer, persistent data on volumes, and temporary files on `tmpfs`; the container must be destroyable and recreatable at any time without data loss.
- **[FORBIDDEN]** Schema migrations or one-shot tasks in the entrypoint of replicated services: with multiple replicas they cause race conditions; run them as a Kubernetes Job or as a one-shot Compose service awaited with `service_completed_successfully`.
- **[PERFORMANCE]** Container-aware JVM: no fixed `-Xmx`; use `-XX:MaxRAMPercentage=75.0` and `-XX:InitialRAMPercentage=50.0`, add `-XX:+ExitOnOutOfMemoryError` and, with fractional CPU limits, `-XX:ActiveProcessorCount`; pass the options through `JAVA_TOOL_OPTIONS`.
- **[PERFORMANCE]** Non-JVM runtimes: Node.js with `--max-old-space-size` at about 75% of the memory limit; Go with `GOMEMLIMIT` around 90% of the limit and `GOMAXPROCS` consistent with the CPU limit (automatic since Go 1.25, with `go.uber.org/automaxprocs` in earlier versions).
- **[CONFIGURATION]** Explicit time zone and locale: `ENV TZ=Etc/UTC LANG=C.UTF-8`, the `tzdata` package present if the application uses zones other than UTC (in Go `import _ "time/tzdata"`), `-Duser.timezone=UTC` for the JVM.
- **[TESTING]** Verify shutdown with `time docker stop -t 30 <container>` and `docker inspect --format '{{.State.ExitCode}}' <container>`: 0 is expected, while 137 indicates SIGKILL or OOM (confirm with `{{.State.OOMKilled}}`).
- **[TESTING]** Verify health with `docker inspect --format '{{json .State.Health}}' <container>` and `docker compose up --wait`, simulating a slow startup to validate `start_period` and `retries`.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
