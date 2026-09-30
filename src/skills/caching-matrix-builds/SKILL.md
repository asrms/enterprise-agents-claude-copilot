---
name: caching-matrix-builds
description: "Fast and reliable GitHub Actions builds: dependency caching with setup-* actions and actions/cache, correct cache keys, Docker layer caching with BuildKit, matrix strategies with include/exclude and fail-fast, job parallelism, test sharding, timeouts, and cost control. Use it when a workflow is slow, flaky, or expensive."
---

# Skill: Caching and Matrix Builds

## Implementation Rules:
- **[PERFORMANCE]** Use the built-in caching of setup actions first (`actions/setup-node` `cache: npm`, `setup-python` `cache: pip`, `setup-java` `cache: gradle`, `setup-go` default cache, `setup-dotnet` with `cache: true`); use `actions/cache` only for what they do not cover.
- **[MANDATORY]** Cache keys include the OS, tool version, and a hash of the lock files (`${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}`) with `restore-keys` prefixes for partial hits; never cache build outputs that should be rebuilt from source for releases.
- **[FORBIDDEN]** Caching `node_modules` across Node versions or OSes, caching secrets or credential files, and using caches as a substitute for artifacts (caches may be evicted at any time).
- **[PERFORMANCE]** Docker builds use `docker/setup-buildx-action` and `docker/build-push-action` with the GitHub Actions cache backend (`cache-from: type=gha`, `cache-to: type=gha,mode=max`) or a registry cache, and multi-stage Dockerfiles ordered for layer reuse.
- **[PATTERN]** Use `strategy.matrix` to test supported versions and platforms (`os`, `node`, `java`), with `include`/`exclude` for special combinations, `fail-fast: false` when every combination's result matters, and `max-parallel` to protect shared resources.
- **[PATTERN]** Keep the matrix meaningful: test the minimum and latest supported versions and the production version, not every minor version; run the full matrix on the main branch or nightly and a reduced one on pull requests if cost matters.
- **[PERFORMANCE]** Shard slow test suites across matrix jobs (Playwright `--shard=${{ matrix.shard }}/4`, Jest `--shard`, pytest-split) and merge reports afterwards; run independent jobs in parallel and use `needs` only for real dependencies.
- **[MANDATORY]** Every job sets `timeout-minutes` appropriate to its normal duration so hung jobs do not consume minutes for six hours.
- **[PERFORMANCE]** Skip unnecessary work: path filters, `concurrency` cancellation of superseded pull request runs, and conditional steps; choose larger runners only where profiling shows a benefit.
- **[PATTERN]** Build once, test many: produce artifacts in one job and download them in matrix test jobs, rather than rebuilding in every combination.
- **[TESTING]** Monitor workflow duration, cache hit rate, and queue time (GitHub Actions usage metrics or exported telemetry), and treat regressions and flaky jobs as defects to fix.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
