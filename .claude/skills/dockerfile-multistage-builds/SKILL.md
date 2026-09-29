---
name: dockerfile-multistage-builds
description: "Multi-stage builds with BuildKit: named builder/test/runtime stages, --target, selective COPY --from, ARG scoping, and patterns for Java, Node.js, Python, and Go. Use it when writing or refactoring a Dockerfile that compiles or packages an application."
---

# Skill: Dockerfile Multi-Stage Builds

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
