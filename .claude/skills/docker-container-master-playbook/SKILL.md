---
name: docker-container-master-playbook
description: "Playbook of the docker-container-master agent (role, rules, acceptance criteria, examples), usable with or without the agent. Designs, reviews, and hardens Dockerfiles, OCI images, and Docker Compose environments with BuildKit/buildx. Use it to create or fix a Dockerfile or compose.yaml, cut image size and build time, make an image non-root and hardened, manage build secrets, or integrate Hadolint, Trivy, Syft, and Cosign before deploying to Kubernetes."
---

# Playbook: docker-container-master

This playbook holds everything the `docker-container-master` agent applies. When you use it without the agent, work as the role below, apply every rule as binding, and check the result against the acceptance criteria before you finish.

## Role

Principal Container Engineer who designs minimal, reproducible, signed OCI images and reliable Docker Compose environments, ready to run on Kubernetes.

## Objective

Produce multi-stage Dockerfiles, `.dockerignore` files, `compose.yaml` with its overrides, and build/release scripts that generate minimal, reproducible, and secure container images: run as a non-root user with a numeric UID, free of toolchains and debugging tools, with no secrets in layers or metadata, scanned with Hadolint and Trivy, shipped with SBOM and SLSA provenance, signed with Cosign, and referenced by digest. Compose environments must start deterministically thanks to healthchecks and conditional dependencies, with segmented networks, resource limits, and configuration kept outside the image, so they can be moved to Kubernetes with no behavioral differences. Before making changes, analyze the existing Dockerfiles, Compose files, `.dockerignore`, and pipelines by reading and searching the codebase; when the tools are available, validate the result in the terminal (`docker buildx build --check`, `hadolint`, `docker compose config --quiet`, `trivy`). Before producing code, apply every rule in the Rules section below as binding, and use the examples in `references/` as the style reference.

## Acceptance Criteria

- Every Dockerfile starts with `# syntax=docker/dockerfile:1`, uses named stages (`builder`, `test`, `runtime`), and passes `hadolint --failure-threshold warning` and `docker buildx build --check` with no warnings.
- Base images come from the internal registry with a version tag and an `@sha256:` digest; no `latest` or mutable tags in Dockerfiles or `compose.yaml`.
- The final image runs with a numeric non-root `USER`, contains no compilers, build package managers, debugging tools, or setuid bits, and starts with `--read-only --cap-drop ALL --security-opt no-new-privileges`.
- `docker history --no-trunc`, the image metadata, and `trivy image --scanners secret` reveal no secrets; build credentials flow only through `RUN --mount=type=secret` or `--mount=type=ssh`.
- `trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed` exits with code 0, SBOM and `mode=max` provenance are attached, and the image is signed by digest and verifiable with `cosign verify`.
- `ENTRYPOINT`/`CMD` use exec form, the process handles SIGTERM and exits within `stop_grace_period`, logs go to stdout/stderr, and a `HEALTHCHECK` (or the equivalent Kubernetes probes) is defined.
- `compose.yaml` has no `version:`, passes `docker compose config --quiet` and `docker compose up --wait`, and uses healthchecks, `depends_on` with `condition: service_healthy`, an `internal: true` backend network, named volumes, and resource limits.
- The image size stays within the declared budget, and a rebuild after changing only the source code reuses the dependency layers from cache.

## Rules

One section per topic. Each section ends with a pointer to its examples in `references/`.

### 1. Dockerfile Multi-Stage Builds (`dockerfile-multistage-builds`)

*Scope:* Multi-stage builds with BuildKit: named builder/test/runtime stages, --target, selective COPY --from, ARG scoping, and patterns for Java, Node.js, Python, and Go. Use it when writing or refactoring a Dockerfile that compiles or packages an application.

- **[MANDATORY]** The first line of every Dockerfile is `# syntax=docker/dockerfile:1`, which enables the up-to-date BuildKit frontend (`RUN --mount`, `COPY --link`, `COPY --chmod`, heredocs, build checks); add `# check=error=true` to turn every build check warning into an error.
- **[ARCHITECTURE]** Split the Dockerfile into named stages with `FROM <image> AS <name>` (lowercase name, uppercase `AS`): at least `builder` (compilation), `test` (verification), and `runtime` (final image); for heavy dependencies add reusable `deps` and `prod-deps` stages.
- **[ARCHITECTURE]** The `runtime` stage is the last one in the file, so `docker build` without `--target` always produces the production image; development (`dev`) or debug stages come before it and are selected only with `--target dev`.
- **[MANDATORY]** Always reference stages by name (`COPY --from=builder`), never by index (`COPY --from=0`), which breaks silently when a stage is added or reordered.
- **[PATTERN]** In the `runtime` stage copy only the executable artifacts (jar layers, `dist/` plus production `node_modules`, virtualenv, binary); `COPY --from=builder /src /src` and copying the entire working directory are forbidden.
- **[FORBIDDEN]** Single-stage builds that install the toolchain and remove it in a later `RUN` (`apt-get purge`, `rm -rf ~/.m2`): the files remain in the earlier layers and the image does not shrink.
- **[FORBIDDEN]** Compilers and build tools in the final stage (`gcc`, `build-essential`, `maven`, `gradle`, `git`, npm devDependencies, `-dev` headers): verify their absence with `syft <image>` or `docker history --no-trunc`.
- **[PATTERN]** `ARG` scoping: an `ARG` declared before the first `FROM` is visible only in `FROM` lines; to use it in `RUN`, `ENV`, or `LABEL`, redeclare it without a value (`ARG VERSION`) inside every stage that uses it, otherwise it expands to an empty string.
- **[PATTERN]** Java/Spring Boot 3.3+: extract the jar with `java -Djarmode=tools -jar application.jar extract --layers --launcher --destination extracted`, copy `dependencies/`, `spring-boot-loader/`, `snapshot-dependencies/`, `application/` in that order, and launch `org.springframework.boot.loader.launch.JarLauncher`; for Spring Boot 2.3–3.2 use `-Djarmode=layertools -jar app.jar extract`.
- **[PATTERN]** Java with a minimal JRE: generate the runtime in a dedicated stage with `jlink --add-modules <modules from jdeps --print-module-deps> --strip-debug --no-man-pages --no-header-files --compress=zip-6 --output /opt/jre` and copy it onto `gcr.io/distroless/java-base-debian12:nonroot`.
- **[PATTERN]** Node.js: a `deps` stage with a full `npm ci` for build and test, and a `prod-deps` stage with `npm ci --omit=dev` from which to copy `node_modules`; use the same Node major version for build and runtime to keep native modules ABI-compatible.
- **[PATTERN]** Python: create the virtualenv in the builder (`python -m venv /opt/venv`) or build wheels with `pip wheel --wheel-dir /wheels`; copy `/opt/venv` into the runtime at the same path and on the same Python minor version, because a venv is not relocatable.
- **[PATTERN]** Go: compile with `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"` and use `gcr.io/distroless/static-debian12:nonroot` or `scratch` as the runtime; with `scratch`, explicitly copy `/etc/ssl/certs/ca-certificates.crt` and embed time zones with `import _ "time/tzdata"`.
- **[PERFORMANCE]** For multi-platform images declare `FROM --platform=$BUILDPLATFORM` in the compilation stage and use `ARG TARGETOS` and `ARG TARGETARCH` to cross-compile (`GOOS=${TARGETOS} GOARCH=${TARGETARCH}`), avoiding QEMU emulation.
- **[PERFORMANCE]** Leverage the BuildKit graph: independent stages (e.g. `jre` and `builder`, or `frontend-builder` and `backend-builder`) run in parallel, and only the stages reachable from the requested target are built.
- **[PERFORMANCE]** Use `COPY --link --from=<stage>` for the final stage artifacts: the layer becomes independent of the previous ones and stays reusable even when the base image changes.
- **[TESTING]** The `test` stage starts from `builder` (`FROM builder AS test`) and runs lint and tests (`./mvnw verify`, `npm test`, `pytest`, `go test ./...`); a non-zero exit code must fail the build, so `|| true` and `-Dmaven.test.failure.ignore=true` are forbidden.
- **[TESTING]** BuildKit skips stages not referenced by the target: make the test a gate by copying the artifact into the runtime from the `test` stage (`COPY --from=test`), or run `docker buildx build --target test .` in CI as a blocking step before `--target runtime`.
- **[TESTING]** Validate every Dockerfile with `docker buildx build --check .` (checks `FromAsCasing`, `StageNameCasing`, `UndefinedArgInFrom`, `JSONArgsRecommended`) and with `hadolint` before merging.
- **[CONFIGURATION]** Centralize versions in global `ARG`s before the first `FROM` (`ARG GO_VERSION=1.25`, `ARG NODE_VERSION=22.11.0`) and override them with `--build-arg` or in `docker-bake.hcl`, instead of duplicating them in every stage.
- **[CONFIGURATION]** In Compose select the stage with `build.target`: `target: runtime` for CI and shared environments, `target: dev` only in `compose.override.yaml`.
- **[REFERENCE]** See `references/dockerfile-multistage-builds.md` for reference anti-patterns and best practices.

### 2. Docker Image Optimization (`docker-image-optimization`)

*Scope:* Image size, cache, and reproducibility optimization: layer ordering, BuildKit cache mounts, .dockerignore, apt cleanup, base image selection, and size budgets. Use it when an image is too large, slow to build, or not reproducible.

- **[ARCHITECTURE]** Order instructions from least to most volatile: base image, system packages, dependency manifests (`package.json` + `package-lock.json`, `pom.xml`, `requirements.lock`, `go.mod` + `go.sum`), dependency installation, source code, build; changing a source file must not invalidate the dependency layer.
- **[FORBIDDEN]** `COPY . .` before installing dependencies: any change to the repository, even to a README, forces a full `npm ci`, `pip install`, or `mvn dependency:go-offline` again.
- **[MANDATORY]** Use `RUN --mount=type=cache` with the correct targets: npm `/root/.npm`, pip `/root/.cache/pip`, Maven `/root/.m2`, Gradle `/root/.gradle`, Go `/go/pkg/mod` and `/root/.cache/go-build`, apt `/var/cache/apt` and `/var/lib/apt` with `sharing=locked`.
- **[CONFIGURATION]** With apt cache mounts on Debian/Ubuntu, remove `/etc/apt/apt.conf.d/docker-clean` and write `Binary::apt::APT::Keep-Downloaded-Packages "true";` to `/etc/apt/apt.conf.d/keep-cache`, otherwise the `.deb` files are deleted and the cache stays empty.
- **[MANDATORY]** Without cache mounts, install system packages in a single `RUN`: `apt-get update && apt-get install -y --no-install-recommends <pkg> && rm -rf /var/lib/apt/lists/*`; on Alpine use `apk add --no-cache <pkg>`.
- **[FORBIDDEN]** `RUN apt-get update` separate from `apt-get install` (stale cached index and non-deterministic installs), and cleanups (`rm`, `apt-get purge`, `npm cache clean`) in a layer after the one that created the files: the size does not decrease.
- **[MANDATORY]** Version a `.dockerignore` that excludes at least `.git`, `node_modules`, `target/`, `build/`, `dist/`, `.venv`, `__pycache__/`, `*.pyc`, `coverage/`, `.idea/`, `.vscode/`, `*.log`, `.env*`, and `compose*.yaml`; for large repositories prefer an allowlist (`*` followed by `!src/` and `!package*.json`).
- **[PATTERN]** Base selection: distroless (`gcr.io/distroless/static-debian12`, `java21-debian12`, `nodejs22-debian12`) or Chainguard for production; `-slim` variants (glibc) when a shell or apt is needed; Alpine (musl) only after verifying Python wheels, native Node modules, the DNS resolver, and allocator performance.
- **[FORBIDDEN]** Full images (`node:22`, `python:3.12`, `maven:3.9-eclipse-temurin-21`) as runtime: they include compilers, headers, and hundreds of unnecessary packages, often over 1 GB and dozens of extra CVEs.
- **[PERFORMANCE]** Define a size budget per stack and enforce it in CI by reading `docker image inspect --format '{{.Size}}'` (reference: Go on distroless/static ≤ 30 MB, Node.js ≤ 200 MB, Java with jlink ≤ 200 MB, Python ≤ 250 MB).
- **[PERFORMANCE]** Identify per-layer waste with `docker history --no-trunc --format '{{.Size}}\t{{.CreatedBy}}'` and with `dive` in CI mode (`CI=true dive <image>` with a `.dive-ci` file that sets `lowestEfficiency` and `highestUserWastedPercent`).
- **[PERFORMANCE]** In CI use the BuildKit remote cache: `--cache-from type=registry,ref=<repo>:buildcache --cache-to type=registry,ref=<repo>:buildcache,mode=max` (or `type=gha` on GitHub Actions), so ephemeral runners reuse layers.
- **[PERFORMANCE]** Use `COPY --link` for application layers and group into a single `RUN` (with `set -eux` or a `RUN <<EOF` heredoc) only commands that change at the same frequency.
- **[FORBIDDEN]** Systematic `--no-cache` in pipelines, which cancels every cache benefit; to update the base use `--pull` or a digest update.
- **[FORBIDDEN]** `ADD` for local files or directories (use `COPY`) and `ADD <url>` without `--checksum=sha256:<digest>`.
- **[CONFIGURATION]** Reproducibility: full version tags plus the base digest, mandatory lockfiles (`npm ci`, `pip install --require-hashes`, `go.sum`, explicit Maven plugin versions) and, when binary reproducibility is required, apt packages pinned with `pkg=<version>` or `snapshot.debian.org`.
- **[CONFIGURATION]** Pass `SOURCE_DATE_EPOCH=$(git log -1 --pretty=%ct)` as a build arg and use the `--output type=image,name=<repo>:<tag>,push=true,rewrite-timestamp=true` exporter (BuildKit ≥ 0.13) to get the same digest for the same source.
- **[PATTERN]** With a pip cache mount do not use `--no-cache-dir`, which would make it useless, and suppress DL3042 with `# hadolint ignore=DL3042`; without a cache mount always use `--no-cache-dir`.
- **[TESTING]** Verify cache effectiveness: after changing only the source code, `docker buildx build --progress=plain` must show `CACHED` for every step up to and including dependency installation.
- **[TESTING]** Use `docker buildx build --check` and `hadolint` as lint gates, paying attention to DL3008 (apt versions), DL3009 (apt lists not removed), DL3015 (`--no-install-recommends`), DL3018 (apk versions), and DL3059 (consecutive `RUN`s that can be consolidated).
- **[REFERENCE]** See `references/docker-image-optimization.md` for reference anti-patterns and best practices.

### 3. Container Security Hardening (`container-security-hardening`)

*Scope:* Image and container hardening: non-root user with a numeric UID, distroless/Chainguard bases, read-only filesystem, minimal capabilities, no-new-privileges, seccomp, and no privileged mode or Docker socket. Use it for every image or service bound for production.

- **[MANDATORY]** The last `USER` instruction of the final image uses numeric non-root UID and GID (`USER 10001:10001`, or `USER 65532:65532` for distroless/Chainguard `nonroot`): with a user name, Kubernetes cannot verify `runAsNonRoot: true` and refuses to start the pod.
- **[MANDATORY]** On Debian/Ubuntu bases create the user with `groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app`; on Alpine with `addgroup -S -g 10001 app && adduser -S -D -H -u 10001 -G app -s /sbin/nologin app`; use UID ≥ 10000 to avoid collisions with host users.
- **[ARCHITECTURE]** In production prefer bases with no shell or package manager: `gcr.io/distroless/*-debian12:nonroot` or `cgr.dev/chainguard/*` (non-root by default); the `:debug` and `-dev` variants stay confined to build stages or local environments.
- **[FORBIDDEN]** `sudo`, `su`, entries in `/etc/sudoers`, root passwords (`chpasswd`), and setuid/setgid binaries; in slim images strip inherited bits with `find / -xdev -perm /6000 -type f -exec chmod a-s {} +`.
- **[FORBIDDEN]** Debugging and network tools in the final image (`curl`, `wget`, `netcat`, `vim`, `procps`, `strace`, `tcpdump`) and remote debugging agents (`-agentlib:jdwp`, `node --inspect`): troubleshoot with `kubectl debug -it <pod> --image=busybox:1.36 --target=<container>` or `docker debug`.
- **[MANDATORY]** Code and dependencies stay owned by root and not writable by the process; use `COPY --chown=10001:10001` only for directories the application must write, and `COPY --chmod=555` or `--chmod=444` for scripts and configuration files; `chmod -R 777` is forbidden.
- **[MANDATORY]** Read-only root filesystem: `read_only: true` in Compose (`docker run --read-only`) with explicit, sized `tmpfs` mounts for writable paths (`/tmp:rw,noexec,nosuid,size=64m`); on Kubernetes `readOnlyRootFilesystem: true` plus `emptyDir` volumes.
- **[MANDATORY]** Drop all capabilities with `cap_drop: [ALL]` (`--cap-drop ALL`) and add only justified, documented ones (e.g. `NET_BIND_SERVICE`); prefer ports ≥ 1024 (8080, 8443) so you do not need to add any.
- **[MANDATORY]** Set `security_opt: ["no-new-privileges:true"]` (`--security-opt no-new-privileges`) and on Kubernetes `allowPrivilegeEscalation: false`, so no child process gains privileges through setuid or file capabilities.
- **[SECURITY]** Keep Docker's default seccomp profile and AppArmor/SELinux enabled (`seccompProfile.type: RuntimeDefault` on Kubernetes); `seccomp=unconfined` and `apparmor=unconfined` are forbidden; custom profiles (`security_opt: ["seccomp=./seccomp-api.json"]`) may only restrict further.
- **[FORBIDDEN]** `privileged: true` or `--privileged`, mounting `/var/run/docker.sock`, `pid: host`, `ipc: host`, `network_mode: host`, `userns_mode: host`, bind-mounting `/`, and `cap_add: [SYS_ADMIN]`: they are equivalent to root access on the host.
- **[SECURITY]** Limit abusable resources: `pids_limit` (e.g. 256) against fork bombs, an explicit `ulimits.nofile`, and `deploy.resources.limits` for memory and CPU, so a compromised container cannot saturate the node.
- **[SECURITY]** Expose only the application port (`EXPOSE 8080`); management and debug ports (JMX, 5005, full actuator endpoints) are never published, and in development host bindings use `127.0.0.1:`.
- **[PATTERN]** Implement the healthcheck with the application binary or the runtime already present (`/app/server healthcheck`, `python -c`, `node healthcheck.js`) instead of installing `curl` just for that purpose.
- **[CONFIGURATION]** Align Kubernetes manifests with the `restricted` Pod Security profile: `runAsNonRoot: true`, `runAsUser` and `runAsGroup` matching the image `USER`, `capabilities.drop: ["ALL"]`, `seccompProfile.type: RuntimeDefault`; additionally `automountServiceAccountToken: false` if the API server is not needed.
- **[CONFIGURATION]** At the daemon level enable, where possible, rootless Docker or `"userns-remap": "default"` in `/etc/docker/daemon.json`, so that a container escape does not map to root on the host.
- **[TESTING]** In CI verify that `docker image inspect --format '{{.Config.User}}' <image>` returns a numeric UID other than `0` and that the container starts with `docker run --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges <image>`.
- **[TESTING]** Run `hadolint` (DL3002 last `USER` is root, DL3004 use of `sudo`) and `trivy config` on Dockerfiles and Kubernetes manifests to catch misconfigurations before merging.
- **[REFERENCE]** See `references/container-security-hardening.md` for reference anti-patterns and best practices.

### 4. Docker Secrets Management (`docker-secrets-management`)

*Scope:* Build-time and runtime secret management: no sensitive ENV/ARG, RUN --mount=type=secret and ssh, Compose secrets, injection from Vault/Kubernetes, and scanning with Trivy and gitleaks. Use it when a build or container needs credentials, tokens, or keys.

- **[FORBIDDEN]** Secrets in `ENV` or `ARG` (`ARG NPM_TOKEN`, `ENV DB_PASSWORD=s3cr3t`): the values remain in `docker history --no-trunc`, in the image configuration (`docker image inspect`) and, with `--provenance=mode=max`, also among the build arguments recorded in the provenance.
- **[FORBIDDEN]** Copying credential files and then deleting them (`COPY .npmrc`, `COPY id_ed25519` followed by `RUN rm`): the file stays in the layer that added it and can be extracted with `docker save`; the same applies to `git config` with tokens embedded in the URL.
- **[MANDATORY]** Pass build secrets only with `RUN --mount=type=secret,id=<id>`: the file is mounted at `/run/secrets/<id>` only for the duration of that `RUN`; use `target=` for the path expected by the tool (e.g. `/root/.npmrc`) or `env=` (Dockerfile ≥ 1.10) to expose it as a variable scoped to that command only.
- **[MANDATORY]** Add `required=true` to `secret` and `ssh` mounts, so the build fails immediately if the secret is not provided instead of producing an incomplete image or one with public dependencies in place of private ones.
- **[CONFIGURATION]** Provide secrets to the build with `docker buildx build --secret id=npmrc,src=$HOME/.npmrc` or `--secret id=gh_token,env=GH_TOKEN`; in Compose declare them in `build.secrets` referencing the top-level `secrets:` defined with `file:` or `environment:`.
- **[MANDATORY]** For private repositories and modules over Git use `RUN --mount=type=ssh` with `docker buildx build --ssh default=$SSH_AUTH_SOCK`: the key stays in the host's SSH agent; version a `known_hosts` with verified fingerprints instead of an unverified `ssh-keyscan`.
- **[SECURITY]** The cache exported with `--cache-to type=registry,mode=max` also contains intermediate stage layers: a secret that ends up in a builder layer is published with the cache even if the final image does not contain it.
- **[ARCHITECTURE]** The image is identical across all environments and free of credentials: runtime secrets are injected by the platform (Kubernetes Secrets mounted as files, Vault Agent Injector or Secrets Store CSI Driver, External Secrets Operator synced from AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager).
- **[PATTERN]** In Compose use service-level `secrets:`, mounted at `/run/secrets/<name>`, with the `*_FILE` convention of official images (`POSTGRES_PASSWORD_FILE=/run/secrets/db_password`) or `spring.config.import=optional:configtree:/run/secrets/` for Spring Boot.
- **[SECURITY]** Prefer secrets mounted as files over environment variables: env vars are visible via `docker inspect`, in `/proc/<pid>/environ`, in child processes, and often in crash dumps and error logs.
- **[MANDATORY]** Exclude from the build context (`.dockerignore`) and from VCS (`.gitignore`) at least `.env`, `.env.*` (keeping `!.env.example`), `*.pem`, `*.key`, `*.p12`, `id_rsa*`, `id_ed25519*`, `.npmrc`, `.pypirc`, `.aws/`, `.docker/`, and `secrets/`.
- **[CONFIGURATION]** Use `env_file` and `.env` only for non-sensitive configuration or for local development with dummy values; make critical variables mandatory with `${VAR:?message}` instead of hardcoded defaults.
- **[FORBIDDEN]** `docker login -p <password>` and secrets passed as command arguments, visible in `ps` and in the shell history: use `--password-stdin` and the `docker-credential-*` credential helpers.
- **[SECURITY]** In `RUN` instructions and entrypoints that handle secrets do not use `set -x`, `echo $TOKEN`, or `env` dumps; mask sensitive variables in the CI platform.
- **[CONFIGURATION]** Design for rotation: short-lived secrets (CI OIDC tokens federated with cloud and registry instead of static passwords) that the application reloads without rebuilding the image.
- **[TESTING]** Block the pipeline if a secret ends up in the image: `trivy image --scanners secret --exit-code 1 <image>` and a check that `docker history --no-trunc <image>` contains no tokens, passwords, or keys.
- **[TESTING]** Scan repository and working tree with `gitleaks git --redact` (Git history) and `gitleaks dir --redact .` (current files) in pre-commit and in CI; enable `docker buildx build --check` for the `SecretsUsedInArgOrEnv` check.
- **[REFERENCE]** See `references/docker-secrets-management.md` for reference anti-patterns and best practices.

### 5. Docker Compose Orchestration (`docker-compose-orchestration`)

*Scope:* Reliable Docker Compose v2 environments: compose.yaml without version, healthchecks and conditional depends_on, segmented networks, named volumes, profiles, resource limits, development overrides, and DRY with extension fields. Use it when creating or reviewing a compose.yaml.

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
- **[REFERENCE]** See `references/docker-compose-orchestration.md` for reference anti-patterns and best practices.

### 6. Container Runtime Lifecycle (`container-runtime-lifecycle`)

*Scope:* Container runtime behavior: exec form, PID 1 and signals, graceful shutdown, HEALTHCHECK, logs to stdout, 12-factor configuration, container-aware JVM and runtimes, time zone and locale. Use it when defining startup, shutdown, and health of a containerized service.

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
- **[REFERENCE]** See `references/container-runtime-lifecycle.md` for reference anti-patterns and best practices.

### 7. Container Supply Chain Security (`container-supply-chain-security`)

*Scope:* Image supply chain security: base images pinned by digest, Hadolint, Trivy, Docker Scout, SBOM with Syft or buildx, SLSA provenance, keyless Cosign signing and verification, OCI labels, and automated updates. Use it for image build, release, and deploy pipelines.

- **[MANDATORY]** Reference every base image with a version tag and the digest of the multi-arch index (`FROM registry.example.com/dockerhub/library/python:3.12.7-slim-bookworm@sha256:<digest>`), obtained with `docker buildx imagetools inspect <image>:<tag>`; the tag stays for readability, the digest guarantees immutability.
- **[SECURITY]** The private registry (Harbor, Artifactory, Nexus, or ECR/ACR/Artifact Registry with pull-through cache) is the only source of images and packages: direct `FROM` from Docker Hub or unofficial namespaces and additional indexes such as `pip --extra-index-url`, which expose you to dependency confusion, are forbidden.
- **[CONFIGURATION]** Version a `.hadolint.yaml` with `failure-threshold: warning`, `trustedRegistries` limited to the internal registry, and `ignored` only for justified rules; run `hadolint Dockerfile` (or `docker run --rm -i hadolint/hadolint < Dockerfile`) as the first gate of the pipeline.
- **[FORBIDDEN]** `curl -sSL https://install.example.com | sh`, `ADD <url>` without `--checksum=sha256:<digest>`, downloads from `releases/latest`, and unverified installers: every external artifact is pinned by version and verified via checksum or signature.
- **[MANDATORY]** Scan every image by digest with `trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed <image>@sha256:<digest>`: the pipeline stops on high or critical vulnerabilities with an available fix.
- **[CONFIGURATION]** Exceptions live in a versioned `.trivyignore`, one CVE per line with a justification comment and expiry (`CVE-2024-45337 exp:2026-12-31`) and mandatory review; `|| true` on the scan step is forbidden.
- **[PERFORMANCE]** Use internal mirrors of the Trivy database (`--db-repository` and `--java-db-repository` pointing to the corporate registry) with a persistent `--cache-dir`, and re-scan production images daily, because new CVEs emerge after release.
- **[PATTERN]** Use Docker Scout for triage and remediation: `docker scout cves --only-severity critical,high --only-fixed --exit-code <image>` as an additional check and `docker scout recommendations <image>` to find updated base images.
- **[MANDATORY]** Generate the SBOM for every release with `docker buildx build --sbom=true` (SPDX attestation attached to the index) and/or `syft <image>@sha256:<digest> -o spdx-json=sbom.spdx.json` (or `cyclonedx-json`), archived as a release artifact.
- **[MANDATORY]** Attach SLSA provenance with `--provenance=mode=max`; since `mode=max` records build arguments, no secret may pass through `--build-arg`.
- **[CONFIGURATION]** Attestations require `--push` or an OCI exporter (with the classic image store, `--load` discards them); verify they are present with `docker buildx imagetools inspect <image> --format '{{ json .SBOM }}'` and `--format '{{ json .Provenance }}'`.
- **[MANDATORY]** Always sign by digest, never by tag: `cosign sign --yes <image>@sha256:<digest>` in keyless mode with the pipeline's OIDC identity (on GitHub Actions `permissions: id-token: write`); for air-gapped environments or confidential names use KMS keys (`--key awskms://`, `azurekms://`, `hashivault://`) or a private Sigstore instance.
- **[PATTERN]** Also publish the SBOM as a signed attestation with `cosign attest --yes --type spdxjson --predicate sbom.spdx.json <image>@sha256:<digest>`, verifiable with `cosign verify-attestation --type spdxjson`.
- **[SECURITY]** Before deploying, verify the signature and the signer's identity with `cosign verify --certificate-identity <workflow-ref> --certificate-oidc-issuer https://token.actions.githubusercontent.com <image>@sha256:<digest>`; in the cluster enforce verification with an admission controller (Sigstore policy-controller or Kyverno) and deploy only by digest.
- **[MANDATORY]** Apply the OCI labels `org.opencontainers.image.source`, `.revision`, `.version`, `.created`, `.title`, `.description`, `.licenses`, `.vendor`, `.base.name`, and `.base.digest`, populated from CI build args, with `created` derived from `SOURCE_DATE_EPOCH` so as not to compromise reproducibility.
- **[CONFIGURATION]** Automate base image updates with Renovate (the `docker:pinDigests` preset, which updates tag and digest via PR) or with Dependabot (`package-ecosystem: "docker"`, `schedule.interval: "weekly"`); every PR goes through the same lint, test, and scan pipeline.
- **[SECURITY]** Pin the security toolchain too: explicit versions of `hadolint`, `trivy`, `syft`, and `cosign`, tool images by digest, and GitHub Actions referenced by full commit SHA, not by a mutable tag.
- **[TESTING]** Gate order: `hadolint`, `docker buildx build --target test`, runtime build with SBOM and provenance and push by digest, `trivy image`, `cosign sign` and `cosign attest`, `cosign verify` at deploy; a failed gate stops the pipeline and an unsigned image cannot be deployed.
- **[REFERENCE]** See `references/container-supply-chain-security.md` for reference anti-patterns and best practices.
