---
name: azure-pipelines-yaml
description: "Designing Azure Pipelines in YAML: pipeline structure with stages, jobs, and steps, triggers and PR triggers, dependsOn and conditions, variables, variable groups, and runtime parameters, expressions (compile-time, runtime, and macro syntax), artifacts and pipeline artifacts, multi-stage CI/CD, pipeline resources and triggers between pipelines, and migrating from classic pipelines. Use it when creating or reviewing azure-pipelines.yml files in Azure DevOps."
---

# Skill: Azure Pipelines YAML

## Implementation Rules:
- **[MANDATORY]** Define pipelines as YAML in the repository (`azure-pipelines.yml` or `.azure-pipelines/*.yml`) instead of classic build and release pipelines, with a meaningful `name` format (for example `$(Date:yyyyMMdd)$(Rev:.r)`) and explicit `trigger` and `pr` sections.
- **[ARCHITECTURE]** Structure multi-stage pipelines as `stages` → `jobs` → `steps` with clear responsibilities (build, test, publish, deploy per environment), use `dependsOn` for real dependencies, and run independent jobs in parallel.
- **[CONFIGURATION]** Scope triggers precisely: branch and path filters for CI, `pr` filters for pull request validation (or branch policies with build validation in Azure Repos), `batch: true` on busy branches, and `trigger: none` for pipelines started only by resources or schedules.
- **[PATTERN]** Understand expression timing: `${{ }}` for compile-time template expressions and parameters, `$[ ]` for runtime expressions in variables and conditions, and `$(var)` macro syntax in task inputs; never rely on a runtime value inside a compile-time expression.
- **[PATTERN]** Use typed runtime `parameters` (string, boolean, number, object with allowed `values`) for user choices at queue time, and variables for values computed or configured per stage; avoid settable-at-queue-time variables for anything security-relevant.
- **[PATTERN]** Pass outputs between steps and jobs with `##vso[task.setvariable variable=name;isOutput=true]` and `dependencies.<job>.outputs['<step>.name']` (or `stageDependencies` across stages), naming steps explicitly.
- **[MANDATORY]** Publish build outputs with `PublishPipelineArtifact` and consume them with `download` or `DownloadPipelineArtifact` in later stages, so every stage deploys the exact artifact produced by the build stage.
- **[PATTERN]** Chain pipelines with `resources: pipelines` and pipeline completion triggers or `resources: repositories` for multi-repo checkouts, pinning repository resources to a `ref` when stability matters.
- **[FORBIDDEN]** Inline scripts of hundreds of lines in YAML, `condition: always()` on deploy jobs, copy-pasted stages per environment (use templates), unpinned container images or tool versions, and secrets defined as plain YAML variables.
- **[CONFIGURATION]** Pin tasks to major versions (`AzureCLI@2`, `Docker@2`), pin hosted images explicitly (`ubuntu-24.04` instead of `ubuntu-latest` where reproducibility matters), and set `timeoutInMinutes` and `cancelTimeoutInMinutes` on jobs.
- **[PATTERN]** Report quality data natively: publish test results (`PublishTestResults@2`) and code coverage (`PublishCodeCoverageResults@2`) so failures and trends appear in the pipeline Tests and Coverage tabs.
- **[TESTING]** Validate YAML before merging with a preview run (the Runs REST API with `previewRun: true`, which returns the expanded YAML), start with a pull request validation run, and keep a minimal pipeline for template changes that exercises all parameters.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
