# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Push-based deploys and manual hotfixes
```yaml
# CI job with a cluster-admin kubeconfig stored as a secret
- run: |
    echo "$KUBECONFIG_PROD" > kubeconfig
    kubectl --kubeconfig kubeconfig apply -f k8s/
    kubectl --kubeconfig kubeconfig set image deploy/api api=registry/api:latest
```
```bash
# later, during an incident
kubectl -n prod edit deploy/api      # change never recorded in Git
```
**Why it's wrong:**
- CI holds cluster-admin credentials to production; any pipeline compromise owns the cluster.
- The cluster diverges from Git after manual edits, and nobody can reproduce or audit the running state.

## Best Practice (How to do it right)

### 1. Argo CD ApplicationSet per environment with a restricted project
```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: shop
  namespace: argocd
spec:
  sourceRepos: ['https://github.com/acme/shop-deploy.git']
  destinations:
    - { server: https://kubernetes.default.svc, namespace: 'shop-*' }
  clusterResourceWhitelist: []                 # no cluster-scoped resources for this team
---
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: shop-apps
  namespace: argocd
spec:
  goTemplate: true
  generators:
    - git:
        repoURL: https://github.com/acme/shop-deploy.git
        revision: main
        directories:
          - path: 'apps/*/overlays/*'
  template:
    metadata:
      name: '{{ index .path.segments 1 }}-{{ .path.basename }}'
    spec:
      project: shop
      source:
        repoURL: https://github.com/acme/shop-deploy.git
        targetRevision: main
        path: '{{ .path.path }}'
      destination:
        server: https://kubernetes.default.svc
        namespace: 'shop-{{ .path.basename }}'
      syncPolicy:
        automated: { prune: true, selfHeal: true }
        syncOptions: [CreateNamespace=true, ServerSideApply=true]
```
### 2. Flux equivalent with SOPS decryption and dependencies
```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: shop-production
  namespace: flux-system
spec:
  interval: 5m
  sourceRef: { kind: GitRepository, name: shop-deploy }
  path: ./apps/orders-api/overlays/production
  prune: true
  wait: true
  dependsOn: [{ name: infrastructure }]
  serviceAccountName: shop-reconciler
  targetNamespace: shop-production
  decryption:
    provider: sops
    secretRef: { name: sops-age }
```
**Why it's right:**
- Controllers pull from Git and continuously reconcile, reverting drift and pruning removed resources.
- Teams are confined to their repositories and namespaces; no CI system holds production cluster credentials.
- Promotion is a reviewed pull request that changes the overlay of the next environment; secrets stay encrypted in Git.
