# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One giant job that rebuilds for every environment
```yaml
trigger: '*'                      # every branch, every path

pool:
  vmImage: ubuntu-latest

variables:
  dbPassword: 'P@ssw0rd123'        # secret in plain YAML

steps:
  - script: |
      dotnet build -c Release
      dotnet test
      # ... 300 more lines of bash ...
      if [ "$(Build.SourceBranchName)" = "main" ]; then
        dotnet publish -o out && ./deploy.sh prod "$(dbPassword)"
      fi
    condition: always()           # deploys even when tests fail
```
**Why it's wrong:**
- No stages, no artifacts, and no environments: nothing is traceable and production gets an unreviewed build.
- The secret lives in version control, and `always()` bypasses failures.
- Every branch and documentation change triggers a full run.

## Best Practice (How to do it right)

### 1. Multi-stage pipeline with one artifact
```yaml
name: $(Date:yyyyMMdd)$(Rev:.r)

trigger:
  batch: true
  branches:
    include: [main]
  paths:
    exclude: [docs/*, '*.md']

pr:
  branches:
    include: [main]

parameters:
  - name: runIntegrationTests
    type: boolean
    default: true

variables:
  buildConfiguration: Release
  dotnetVersion: '8.0.x'

stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        pool:
          vmImage: ubuntu-24.04
        timeoutInMinutes: 30
        steps:
          - task: UseDotNet@2
            inputs:
              version: $(dotnetVersion)
          - script: dotnet restore --locked-mode
            displayName: Restore
          - script: dotnet build --no-restore -c $(buildConfiguration)
            displayName: Build
          - script: >
              dotnet test --no-build -c $(buildConfiguration)
              --logger trx --collect "XPlat Code Coverage" --results-directory $(Agent.TempDirectory)/tests
            displayName: Unit tests
          - ${{ if eq(parameters.runIntegrationTests, true) }}:
              - script: ./build/integration-tests.sh
                displayName: Integration tests
          - task: PublishTestResults@2
            condition: succeededOrFailed()
            inputs:
              testResultsFormat: VSTest
              testResultsFiles: '$(Agent.TempDirectory)/tests/**/*.trx'
          - task: PublishCodeCoverageResults@2
            inputs:
              summaryFileLocation: '$(Agent.TempDirectory)/tests/**/coverage.cobertura.xml'
          - script: dotnet publish src/Shop.Api -c $(buildConfiguration) --no-build -o $(Build.ArtifactStagingDirectory)/api
            displayName: Publish
          - task: PublishPipelineArtifact@1
            inputs:
              targetPath: $(Build.ArtifactStagingDirectory)/api
              artifact: api

  - stage: DeployStaging
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: Deploy
        environment: shop-staging
        pool:
          vmImage: ubuntu-24.04
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: api
                - script: ./build/deploy.sh staging "$(Pipeline.Workspace)/api"
                  displayName: Deploy to staging
```
**Why it's right:**
- The artifact built and tested once is the one deployed, and the deployment job records history in the `shop-staging` environment.
- Triggers are batched and filtered, pull requests are validated, and compile-time parameters toggle integration tests.
- Test results and coverage appear in the pipeline UI, and hosted images are pinned.

### 2. Passing an output variable between jobs
```yaml
jobs:
  - job: Version
    steps:
      - script: echo "##vso[task.setvariable variable=semver;isOutput=true]$(./build/compute-version.sh)"
        name: setVersion
  - job: Package
    dependsOn: Version
    variables:
      semver: $[ dependencies.Version.outputs['setVersion.semver'] ]
    steps:
      - script: echo "Packaging version $(semver)"
```
**Why it's right:**
- The step is named, the variable is marked as output, and the consumer uses a runtime expression, so the value is resolved at the right time.
