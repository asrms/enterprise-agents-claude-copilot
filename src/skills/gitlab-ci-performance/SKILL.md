---
name: gitlab-ci-performance
description: "Fast and cost-efficient GitLab pipelines: cache configuration with keys from lock files, cache vs artifacts, fallback keys, parallel and parallel:matrix jobs, test splitting, needs-based DAGs, rules:changes to skip unaffected work, Docker layer caching and the dependency proxy, interruptible pipelines, right-sized runners, and measuring pipeline duration. Use it when a GitLab pipeline is slow, flaky, or expensive."
---

# Skill: GitLab CI Performance

## Implementation Rules:
- **[PERFORMANCE]** Key dependency caches on lock files (`cache:key:files: [package-lock.json]`, `poetry.lock`, `go.sum`) with `fallback_keys` to a branch or default-branch cache, and cache the package manager's download directory rather than whole build outputs.
- **[MANDATORY]** Use cache for reusable, non-essential speedups and artifacts for outputs that later jobs need; jobs must still succeed with an empty cache, and artifacts have `expire_in` and minimal paths.
- **[PERFORMANCE]** Set cache `policy: pull` on jobs that only read the cache and `pull-push` only on the job that installs dependencies, so dozens of parallel jobs do not upload the same archive.
- **[ARCHITECTURE]** Model job dependencies with `needs` so jobs start as soon as their inputs are ready, use `needs: []` for independent checks, and limit which artifacts each job downloads with `needs:artifacts` or `dependencies`.
- **[PERFORMANCE]** Split long test suites with `parallel: N` and the test runner's sharding using `CI_NODE_INDEX` and `CI_NODE_TOTAL` (ideally timing-based), and use `parallel:matrix` for real combinations such as versions or platforms, not for duplicated work.
- **[PATTERN]** Skip unaffected work in monorepos and merge requests with `rules:changes` plus `compare_to`, and keep a full pipeline on the default branch and on schedules so skipped jobs are still exercised regularly.
- **[PERFORMANCE]** Build images with BuildKit and a registry cache (`--export-cache`/`--import-cache` with `mode=max`), order Dockerfile layers from least to most frequently changing, and pull base images through the Dependency Proxy or an internal mirror to avoid rate limits.
- **[CONFIGURATION]** Mark safe jobs `interruptible: true` and enable auto-cancel of redundant pipelines, while keeping deploy jobs non-interruptible; use `GIT_DEPTH` shallow clones and `GIT_STRATEGY: none` for jobs that do not need the source.
- **[PERFORMANCE]** Use slim, prebuilt CI images containing the required toolchain instead of installing packages with `apt-get` or `npm install -g` in every job.
- **[FORBIDDEN]** Caching `node_modules` or build directories across branches without lock-file keys, one global cache key for everything, retrying flaky tests silently with `retry` as a fix, and sequential stages where no real dependency exists.
- **[CONFIGURATION]** Right-size runners: match CPU and memory to the job (tags for large runners on heavy builds only), autoscale fleets, and prefer fewer, longer-lived caches on runners close to the registry and cache storage.
- **[TESTING]** Measure before and after changes: pipeline duration percentiles, queue time, per-job duration, cache hit ratio, and flaky test rate from pipeline analytics or the API, and track them on a dashboard with targets such as merge request pipelines under 10 minutes.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
