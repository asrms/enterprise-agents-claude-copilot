# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Subscription-wide secret credentials open to every pipeline
```yaml
variables:
  clientSecret: 'x7Q~EXAMPLE-SECRET'            # service principal secret committed to YAML

steps:
  - script: |
      az login --service-principal -u $(clientId) -p $(clientSecret) --tenant $(tenantId)
      echo "logged in with $(clientSecret)"     # secret printed to the log
      az webapp deploy --resource-group rg-shop-prod --name shop-api-prod --src-path app.zip
```
The service principal is `Contributor` on the entire subscription, and the "prod" service connection is authorized for all pipelines.
**Why it's wrong:**
- A long-lived secret is stored in version control and printed in logs, and its identity can modify every resource in the subscription.
- Any branch or new pipeline can deploy to production with no approval.

## Best Practice (How to do it right)

### 1. Workload identity federation, scoped identity, protected environment
```yaml
variables:
  - group: shop-prod-keyvault                    # linked to Azure Key Vault, protected by approvals

stages:
  - stage: DeployProduction
    dependsOn: DeployStaging
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: Deploy
        environment: shop-production            # approvals + branch control + required template checks
        pool:
          vmImage: ubuntu-24.04
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  displayName: Deploy API
                  inputs:
                    azureSubscription: sc-shop-prod-wif   # workload identity federation, scoped to rg-shop-prod
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      set -euo pipefail
                      az webapp deploy --resource-group rg-shop-prod --name shop-api-prod \
                        --src-path "$(Pipeline.Workspace)/api/app.zip" --type zip
                - script: ./build/smoke-test.sh https://api.example.com
                  displayName: Smoke test
                  env:
                    SMOKE_TEST_TOKEN: $(smoke-test-token)   # secret from Key Vault, mapped explicitly
```
**Why it's right:**
- No stored credential exists: the service connection exchanges a short-lived OIDC token, and its identity only has Website Contributor on `rg-shop-prod`.
- The environment, the service connection, and the variable group require approval, allow only `refs/heads/main`, and are authorized for this pipeline only.
- Secrets come from Key Vault and reach the script only through explicit `env` mapping, where they stay masked.

### 2. Project settings checklist (applied through the REST API or organization policy)
```yaml
# Organization and project pipeline settings (documented as code for review)
settings:
  limitJobAuthorizationScopeToCurrentProject: true
  limitJobAuthorizationScopeForReleasePipelines: true
  protectAccessToRepositories: true
  limitVariablesSetAtQueueTime: true
  disableClassicPipelineCreation: true
  forkPullRequests:
    buildForks: true
    makeSecretsAvailable: false
    requireCommentFromTeamMember: true
```
**Why it's right:**
- Pipeline tokens can only reach resources in their project and explicitly referenced repositories, and queue-time variables cannot override security-relevant values.
- Fork builds run without secrets and only after a team member approves them.
