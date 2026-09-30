# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Regular jobs deploying straight to production
```yaml
- stage: Prod
  jobs:
    - job: Deploy                                   # not a deployment job: no environment, no checks, no history
      steps:
        - script: dotnet publish -c Release -o out  # rebuilt instead of promoted
        - task: AzureWebApp@1
          inputs:
            azureSubscription: prod-connection
            appName: shop-api-prod
            package: out
        - script: ./migrate.sh --drop-unused-columns   # destructive migration in the same release
```
**Why it's wrong:**
- Production receives an artifact that was never tested, with no approval, no deployment history, and no rollback path.
- The destructive migration breaks the previous version, so rolling back the code no longer works.

## Best Practice (How to do it right)

### 1. Slot deployment with verification and rollback hooks
```yaml
- stage: Production
  dependsOn: Staging
  jobs:
    - deployment: DeployApi
      environment: shop-production                 # approvals, branch control, exclusive lock
      pool:
        vmImage: ubuntu-24.04
      strategy:
        runOnce:
          preDeploy:
            steps:
              - download: current
                artifact: api
              - task: AzureCLI@2
                displayName: Apply backward-compatible migrations
                inputs:
                  azureSubscription: sc-shop-prod-wif
                  scriptType: bash
                  scriptLocation: scriptPath
                  scriptPath: $(Pipeline.Workspace)/api/migrations/apply.sh
          deploy:
            steps:
              - task: AzureWebApp@1
                displayName: Deploy to staging slot
                inputs:
                  azureSubscription: sc-shop-prod-wif
                  appType: webAppLinux
                  appName: shop-api-prod
                  deployToSlotOrASE: true
                  resourceGroupName: rg-shop-prod
                  slotName: staging
                  package: $(Pipeline.Workspace)/api/app.zip
              - script: ./build/smoke-test.sh https://shop-api-prod-staging.azurewebsites.net
                displayName: Smoke test staging slot
          routeTraffic:
            steps:
              - task: AzureAppServiceManage@0
                displayName: Swap staging slot into production
                inputs:
                  azureSubscription: sc-shop-prod-wif
                  Action: Swap Slots
                  WebAppName: shop-api-prod
                  ResourceGroupName: rg-shop-prod
                  SourceSlot: staging
          postRouteTraffic:
            steps:
              - script: ./build/verify-production.sh --error-rate-max 0.01 --duration 10m
                displayName: Verify error rate after swap
          on:
            failure:
              steps:
                - task: AzureCLI@2
                  displayName: Roll back if the new version is live
                  inputs:
                    azureSubscription: sc-shop-prod-wif
                    scriptType: bash
                    scriptLocation: inlineScript
                    inlineScript: |
                      set -euo pipefail
                      live="$(curl -fsS https://api.example.com/version)"
                      if [ "$live" = "$(Build.BuildNumber)" ]; then
                        az webapp deployment slot swap --resource-group rg-shop-prod --name shop-api-prod \
                          --slot staging --target-slot production
                      fi
```
**Why it's right:**
- The artifact promoted from staging is deployed to a warm slot, smoke tested, and swapped, so users never hit a cold or broken instance.
- Post-swap verification checks real error rates, and a failure swaps back to the previous version automatically, but only if the new version is already live (`on: failure` also runs when an earlier hook fails).
- Migrations are additive and run before the new code receives traffic, keeping rollback safe.
