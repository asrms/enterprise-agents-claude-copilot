# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Serial job reinstalling everything
```yaml
pool:
  vmImage: ubuntu-latest

steps:
  - checkout: self
    fetchDepth: 0                                  # full history for a 12 GB monorepo
  - script: |
      sudo apt-get update && sudo apt-get install -y chromium
      npm install                                  # ignores the lock file
      npm run lint
      npm test                                     # 40 minutes in one job
      npm run build
    displayName: Everything
```
**Why it's wrong:**
- The full history is cloned, system packages are installed on every run, and nothing is cached.
- Lint, tests, and build run serially in one job, so feedback takes the sum of all steps.

## Best Practice (How to do it right)

### 1. Cached install, parallel jobs, and sliced tests
```yaml
variables:
  npm_config_cache: $(Pipeline.Workspace)/.npm

stages:
  - stage: Validate
    jobs:
      - job: Install
        pool:
          vmImage: ubuntu-24.04
        steps:
          - checkout: self
            fetchDepth: 1
            fetchTags: false
          - task: UseNode@1
            inputs:
              version: '22.x'
          - task: Cache@2
            displayName: Cache npm
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              restoreKeys: |
                npm | "$(Agent.OS)"
              path: $(npm_config_cache)
          - script: npm ci --prefer-offline
            displayName: Install
          - script: tar -czf $(Build.ArtifactStagingDirectory)/node_modules.tgz node_modules
          - publish: $(Build.ArtifactStagingDirectory)/node_modules.tgz
            artifact: node_modules

      - job: Lint
        dependsOn: Install
        pool:
          vmImage: ubuntu-24.04
        steps:
          - checkout: self
            fetchDepth: 1
          - download: current
            artifact: node_modules
          - script: tar -xzf $(Pipeline.Workspace)/node_modules/node_modules.tgz && npm run lint

      - job: UnitTests
        dependsOn: Install
        timeoutInMinutes: 20
        strategy:
          parallel: 6
        pool:
          vmImage: ubuntu-24.04
        steps:
          - checkout: self
            fetchDepth: 1
          - download: current
            artifact: node_modules
          - script: |
              tar -xzf $(Pipeline.Workspace)/node_modules/node_modules.tgz
              npx vitest run --shard="$(System.JobPositionInPhase)/$(System.TotalJobsInPhase)" \
                --reporter=junit --outputFile=$(Agent.TempDirectory)/junit.xml
            displayName: Tests (slice $(System.JobPositionInPhase) of $(System.TotalJobsInPhase))
          - task: PublishTestResults@2
            condition: succeededOrFailed()
            inputs:
              testResultsFormat: JUnit
              testResultsFiles: $(Agent.TempDirectory)/junit.xml
```
**Why it's right:**
- Shallow checkout and a lock-file keyed cache make installs fast, while `npm ci` keeps them reproducible.
- Lint and six test slices start as soon as dependencies are installed, cutting wall-clock time.
- Results from every slice are published and merged in the Tests tab.

### 2. Tracking pipeline duration with Analytics (OData)
```text
https://analytics.dev.azure.com/example-org/shop/_odata/v4.0-preview/PipelineRuns?
  $apply=filter(Pipeline/PipelineName eq 'shop-web-ci' and CompletedDate ge 2026-09-01T00:00:00Z)
  /aggregate($count as TotalRuns, RunDurationSeconds with average as AvgDurationSeconds)
```
**Why it's right:**
- Duration and run counts come from Analytics instead of impressions, so every optimization can be compared against a baseline.
