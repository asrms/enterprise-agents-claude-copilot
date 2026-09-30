# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Single instance with secrets in settings and FTP deploys
```text
App Service plan: B1, 1 instance, no zone redundancy
App settings: SQL_PASSWORD=Pr0d!2026, STORAGE_KEY=DefaultEndpointsProtocol=...AccountKey=...
Deployments: FTP upload from a developer machine directly to production
Monitoring: CPU alert only
```
**Why it's wrong:**
- A single instance on a basic tier has no redundancy, and deployments cause downtime.
- Secrets are stored as plain settings, and deployments bypass CI and review.

## Best Practice (How to do it right)

### 1. Container Apps with managed identity, Key Vault secret, revisions, and scaling (Bicep)
```bicep
resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-claims-api-prod'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    environmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Multiple'
      ingress: {
        external: false
        targetPort: 8080
        traffic: [
          { revisionName: 'ca-claims-api-prod--v41', weight: 90 }
          { latestRevision: true, weight: 10 }
        ]
      }
      secrets: [
        { name: 'sql-connection', keyVaultUrl: '${keyVault.properties.vaultUri}secrets/sql-connection', identity: identity.id }
      ]
      registries: [ { server: acr.properties.loginServer, identity: identity.id } ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acr.properties.loginServer}/claims-api@${imageDigest}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'ConnectionStrings__Claims', secretRef: 'sql-connection' }
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
          ]
          probes: [
            { type: 'Readiness', httpGet: { path: '/readyz', port: 8080 }, periodSeconds: 5 }
            { type: 'Liveness', httpGet: { path: '/livez', port: 8080 }, periodSeconds: 10 }
          ]
        }
      ]
      scale: {
        minReplicas: 2
        maxReplicas: 20
        rules: [ { name: 'http', http: { metadata: { concurrentRequests: '50' } } } ]
      }
    }
  }
}
```
**Why it's right:**
- The app pulls images and secrets with a managed identity, and the image is pinned by digest.
- Ingress is internal (exposed through Front Door or Application Gateway), traffic is split between revisions for safe rollout, and scaling keeps at least two replicas.
- Probes reflect real readiness, and there are no plaintext secrets or manual deployments.
