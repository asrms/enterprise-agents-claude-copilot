---
name: docker-image-optimization
description: "Image size, cache, and reproducibility optimization: layer ordering, BuildKit cache mounts, .dockerignore, apt cleanup, base image selection, and size budgets. Use it when an image is too large, slow to build, or not reproducible."
---

# Skill: Docker Image Optimization

## Implementation Rules:
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
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
