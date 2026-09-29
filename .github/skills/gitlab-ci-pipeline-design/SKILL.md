---
name: gitlab-ci-pipeline-design
description: "Designing GitLab CI/CD pipelines: .gitlab-ci.yml structure, stages vs needs-based DAG pipelines, rules and workflow rules to control when pipelines and jobs run, merge request pipelines and merged results, parent-child and multi-project pipelines, artifacts and dependencies, interruptible jobs, resource groups, and readable, maintainable configuration. Use it when creating or reviewing GitLab CI/CD configuration."
---

# Skill: GitLab CI Pipeline Design

## Implementation Rules:
- **[MANDATORY]** Control pipeline creation with `workflow: rules` to avoid duplicate branch and merge request pipelines (run merge request pipelines for MRs, branch pipelines for the default branch and tags), and control jobs with `rules:` (not the legacy `only`/`except`).
- **[PATTERN]** Use `needs:` to build a DAG so jobs start as soon as their dependencies finish, keeping `stages` as a coarse visual grouping; declare `needs: []` for jobs that can start immediately.
- **[PATTERN]** Use merge request pipelines with merged results (and merge trains on busy projects) so the tested code is what will land on the target branch.
- **[PATTERN]** Build once and promote: produce artifacts or container images in a build job, pass them through `artifacts` and `needs:artifacts` or registry references by digest, and deploy the same artifact to every environment.
- **[PATTERN]** Split large or monorepo pipelines with parent-child pipelines (`trigger: include:` with `strategy: depend`) and `rules:changes` scoped to directories, and connect repositories with multi-project pipelines (`trigger: project:`) with explicit variables.
- **[MANDATORY]** Set `interruptible: true` on jobs safe to cancel so newer pipelines on the same ref cancel redundant ones (with auto-cancel settings), and never on deployment jobs; serialize deployments with `resource_group`.
- **[PATTERN]** Keep jobs focused and named clearly (`build:image`, `test:unit`, `deploy:staging`), move logic into versioned scripts rather than long inline `script` blocks, and use `extends` or `!reference` for reuse within a file.
- **[MANDATORY]** Set `timeout` on long-running jobs, `retry` only for known infrastructure failures (`retry: { max: 2, when: [runner_system_failure, stuck_or_timeout_failure] }`), and `artifacts:expire_in` for artifacts.
- **[FORBIDDEN]** `allow_failure: true` on jobs that are meant to gate merges, `when: manual` gates without protected environments behind them, `latest` image tags, and jobs depending on side effects of other jobs without `needs`.
- **[PATTERN]** Report results in the merge request: JUnit test reports (`artifacts:reports:junit`), coverage (`coverage` regex and `coverage_report`), code quality and security reports, so reviewers see failures inline.
- **[TESTING]** Validate configuration before merging with the CI Lint tool or `glab ci lint`, use pipeline simulation for rule changes, and review pipeline duration and failure rates regularly.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
