---
name: docker-compose-orchestration
description: "Reliable Docker Compose v2 environments: compose.yaml without version, healthchecks and conditional depends_on, segmented networks, named volumes, profiles, resource limits, development overrides, and DRY with extension fields. Use it when creating or reviewing a compose.yaml."
---

# Skill: Docker Compose Orchestration

## Implementation Rules:
- **[MANDATORY]** Use a `compose.yaml` file compliant with the Compose Specification, without the `version:` key (obsolete: Compose v2 ignores it and emits a warning), and declare a top-level `name:` to get a stable project name independent of the directory.
- **[MANDATORY]** Every long-running service has a `healthcheck` with `test` in array form (`["CMD", "redis-cli", "ping"]` or `["CMD-SHELL", "pg_isready -U $${POSTGRES_USER}"]`) and explicit values for `interval`, `timeout`, `retries`, and `start_period` (plus `start_interval` with Docker Engine ≥ 25).
- **[MANDATORY]** Express startup order with the long form of `depends_on`: `condition: service_healthy` for services with a healthcheck, `condition: service_completed_successfully` for one-shot jobs (migrations, seeds), and `restart: true` to restart the dependent service when the dependency is recreated.
- **[FORBIDDEN]** `depends_on` in list form without conditions, `sleep` in the entrypoint, and `wait-for-it.sh` scripts: they only guarantee that the container has started, not that it is ready.
- **[ARCHITECTURE]** Segment networks: `frontend` for exposed services and `backend` with `internal: true` for databases, caches, and brokers; only the gateway, reverse proxy, or API publish ports, because a container attached only to `internal` networks cannot publish any.
- **[SECURITY]** Never publish database, cache, and broker ports in the base file; if they are needed in development, add them in the override bound to loopback (`"127.0.0.1:5432:5432"`).
- **[MANDATORY]** Persistent data on named volumes declared top-level (`pgdata:/var/lib/postgresql/data`); code bind mounts (`./src:/app/src`) only in `compose.override.yaml`; no anonymous volumes.
- **[FORBIDDEN]** Mutable tags (`image: postgres`, `:latest`, `:stable`): use immutable versions (`postgres:16.4-bookworm`) or `@sha256:` digests, identical to those promoted to Kubernetes.
- **[FORBIDDEN]** Fixed `container_name`s, which prevent `docker compose up --scale` and multiple instances of the project on the same host, and `links`, which are unnecessary because DNS resolution by service name is automatic.
- **[CONFIGURATION]** `environment` for explicit, non-sensitive values versioned in the file; `env_file` in long form (`path`, `required`) for per-environment configuration; the project's `.env` file is only used for `${VAR}` interpolation and is not injected into containers.
- **[CONFIGURATION]** Make critical variables mandatory with `${VAR:?message}`, use `${VAR:-default}` only for harmless defaults, and `$$` for literal `$` (e.g. in `CMD-SHELL` healthchecks).
- **[PERFORMANCE]** Set resource limits for every service with `deploy.resources.limits` (`cpus: "1.0"`, `memory: 512M`) and optional `reservations`, applied by `docker compose up`; alternatively `mem_limit` and `cpus` at the service level, without combining the two syntaxes on the same service.
- **[MANDATORY]** `restart: unless-stopped` for long-running services and `restart: "no"` for one-shot jobs; `stop_grace_period` greater than the application's graceful shutdown timeout (Compose default 10s).
- **[PATTERN]** Optional services (Adminer, Mailpit, seed or debug tools) in `profiles: ["tools"]`, activated with `docker compose --profile tools up` or `COMPOSE_PROFILES=tools`; core services have no profile and always start.
- **[PATTERN]** DRY with `x-*` extension fields and YAML anchors/merge (`x-worker: &worker` and `<<: *worker`); the `<<` merge is shallow: a redefined map (e.g. `environment`) entirely replaces the inherited one and must be re-merged with a dedicated anchor.
- **[PATTERN]** `compose.yaml` describes the prod-like environment; `compose.override.yaml`, loaded automatically, adds only development customizations (`build.target: dev`, bind mounts, debug ports, `develop.watch`); CI and shared environments use explicit files (`docker compose -f compose.yaml -f compose.ci.yaml`).
- **[PERFORMANCE]** For the development inner loop use `develop.watch` with `action: sync` for interpreted code, `sync+restart` for sources and configuration that require a restart, and `rebuild` for dependency manifests, started with `docker compose watch` or `docker compose up --watch`.
- **[CONFIGURATION]** Configure log rotation per service (`logging.driver: local`, or `json-file` with `options.max-size: "10m"` and `options.max-file: "3"`) so as not to fill up the host's disk.
- **[TESTING]** In CI validate with `docker compose config --quiet`, start with `docker compose up -d --wait --wait-timeout 120` (waits for healthchecks and completed jobs), and always run `docker compose down -v --remove-orphans` at the end of the job.
- **[ARCHITECTURE]** Compose is for development, CI, and single-host deployments: keep semantics that translate 1:1 to Kubernetes (healthchecks to probes, `deploy.resources` to `resources`, `secrets` to mounted Secrets, `internal` networks to NetworkPolicy).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
