# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unpinned, untyped templates and copied stages
```yaml
resources:
  repositories:
    - repository: templates
      type: git
      name: Platform/pipeline-templates          # no ref: follows whatever is on the default branch

stages:
  - template: deploy.yml@templates
    parameters:
      env: prod                                  # untyped; typo "prd" is accepted and deploys somewhere unexpected
  - stage: DeployTest                            # copied and modified from another repository
    jobs:
      - job: Deploy
        steps:
          - script: ./deploy.sh test
```
**Why it's wrong:**
- Any change on the templates default branch instantly affects every consumer.
- Untyped parameters accept invalid values, and copied stages drift from the shared template.

## Best Practice (How to do it right)

### 1. Central extends template with typed parameters
`Platform/pipeline-templates` → `pipelines/dotnet-service.yml`:
```yaml
parameters:
  - name: serviceName
    type: string
  - name: buildSteps
    type: stepList
    default: []
  - name: environments
    type: object
    default:
      - name: staging
        approval: false
      - name: production
        approval: true

stages:
  - stage: Build
    jobs:
      - job: Build
        pool:
          vmImage: ubuntu-24.04
        steps:
          - ${{ each step in parameters.buildSteps }}:
              - ${{ each pair in step }}:
                  ${{ if and(eq(pair.key, 'task'), notIn(pair.value, 'UseDotNet@2', 'DotNetCoreCLI@2', 'NuGetAuthenticate@1')) }}:
                    '${{ pair.value }} is not an approved build task': error
                  ${{ else }}:
                    ${{ pair.key }}: ${{ pair.value }}
          - template: ../steps/security-scans.yml
          - task: PublishPipelineArtifact@1
            inputs:
              targetPath: $(Build.ArtifactStagingDirectory)
              artifact: ${{ parameters.serviceName }}

  - ${{ each env in parameters.environments }}:
      - stage: Deploy_${{ env.name }}
        dependsOn: ${{ iif(eq(env.name, 'staging'), 'Build', 'Deploy_staging') }}
        jobs:
          - template: ../jobs/deploy-webapp.yml
            parameters:
              serviceName: ${{ parameters.serviceName }}
              environment: ${{ parameters.serviceName }}-${{ env.name }}
```
Consumer `azure-pipelines.yml`:
```yaml
resources:
  repositories:
    - repository: templates
      type: git
      name: Platform/pipeline-templates
      ref: refs/tags/v3.2.0

trigger:
  branches:
    include: [main]

extends:
  template: pipelines/dotnet-service.yml@templates
  parameters:
    serviceName: orders-api
    buildSteps:
      - script: dotnet build -c Release
        displayName: Build
      - script: dotnet test -c Release --no-build
        displayName: Test
```
**Why it's right:**
- The templates version is pinned, parameters are typed, and deployment stages are generated consistently for each environment.
- Security scans and artifact publishing cannot be skipped because the organization owns the pipeline skeleton, and injected steps may only use approved tasks (an unapproved task produces an invalid step and fails at compile time).
- The `orders-api-production` environment has a Required template check for `pipelines/dotnet-service.yml` in `Platform/pipeline-templates` at the approved release ref, so pipelines that bypass the template cannot deploy.
