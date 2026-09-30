---
name: azure-pipelines-performance
description: "Fast and cost-efficient Azure Pipelines: the Cache task with keys from lock files and restore keys, pipeline artifacts vs caches, parallel jobs and matrix strategies, test slicing with parallel strategy, dependsOn graphs for concurrency, path filters and conditions to skip work, Docker layer caching, shallow fetch and sparse checkout, Microsoft-hosted vs scale set agents, and measuring pipeline duration with Analytics. Use it when an Azure pipeline is slow, flaky, or expensive."
---

# Skill: Azure Pipelines Performance

## Implementation Rules:
- **[PERFORMANCE]** Cache dependency download folders with `Cache@2` keyed on the tool, OS, and lock files (`'npm | "$(Agent.OS)" | package-lock.json'`) with `restoreKeys` fallbacks, and cache package caches (`~/.npm`, NuGet global packages, `~/.m2/repository`) rather than build outputs.
- **[MANDATORY]** Use pipeline artifacts to pass outputs between jobs and stages and caches only for speedups; builds must succeed on a cache miss, and a cache hit must never change build results.
- **[ARCHITECTURE]** Model jobs as a dependency graph with `dependsOn` so lint, unit tests, and packaging run concurrently, and split long single-job pipelines into parallel jobs where the organization has parallel job capacity.
- **[PERFORMANCE]** Slice long test suites with `strategy: parallel: N` and the test runner's sharding using `System.JobPositionInPhase` and `System.TotalJobsInPhase` (or the Visual Studio Test task's slicing), and use `matrix` only for real combinations such as runtimes or operating systems, with `maxParallel` where capacity is limited.
- **[PATTERN]** Skip unaffected work with trigger path filters and conditions based on changed paths for monorepos, while keeping a full run on the main branch or on a schedule so skipped jobs are still exercised.
- **[PERFORMANCE]** Speed up checkout with `fetchDepth` shallow fetch (the default for new pipelines), `fetchTags: false`, sparse checkout (`sparseCheckoutDirectories`) in large monorepos, and `checkout: none` for jobs that only consume artifacts.
- **[PERFORMANCE]** Build container images with BuildKit and a registry cache (`--cache-from`/`--cache-to type=registry`) or reuse base layers from Azure Container Registry, and order Dockerfile layers from least to most frequently changing.
- **[CONFIGURATION]** Choose agents deliberately: Microsoft-hosted agents for simplicity and isolation, Managed DevOps Pools or VM scale set agents for larger machines, private networking, or warm caches, with right-sized VM SKUs and scale-to-zero outside working hours.
- **[FORBIDDEN]** Installing SDKs and system packages in every job when a pinned tool installer task or prebuilt image works, one monolithic job running everything serially, caching `node_modules` across lock-file changes, and masking flaky tests with automatic reruns instead of fixing or quarantining them.
- **[PATTERN]** Enable auto-cancel for superseded pull request builds (the default for PR validation) and batch CI triggers on busy branches, so agents are not spent on commits that are already outdated.
- **[CONFIGURATION]** Set realistic `timeoutInMinutes` per job so hung jobs release agents quickly, and use `condition` and `continueOnError` deliberately rather than as a way to hide slow or failing steps.
- **[TESTING]** Measure pipeline duration, queue time, pass rate, and flaky tests with Azure DevOps Analytics (pipeline reports and OData), set targets such as pull request validation under 10 minutes, and compare before and after every optimization.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
