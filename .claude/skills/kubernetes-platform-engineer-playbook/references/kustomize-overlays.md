# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Copied manifests per environment
```text
k8s/
  dev/deployment.yaml         # 120 lines
  staging/deployment.yaml     # same 120 lines, 3 values changed
  prod/deployment.yaml        # same 120 lines, drifted: probes missing
  prod/secret.yaml            # base64 is not encryption
```
**Why it's wrong:**
- Every fix must be applied three times, and environments drift silently.
- Secrets are committed in Git with only base64 encoding.

## Best Practice (How to do it right)

### 1. Base, components, and thin overlays
```text
deploy/
  base/
    kustomization.yaml
    deployment.yaml
    service.yaml
    config/app.properties
  components/
    high-availability/kustomization.yaml     # PDB + topology spread patch
  overlays/
    staging/kustomization.yaml
    production/
      kustomization.yaml
      patches/resources.yaml
      external-secret.yaml
```
`base/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
labels:
  - pairs: { app.kubernetes.io/part-of: shop }
    includeSelectors: false
configMapGenerator:
  - name: orders-api-config
    files: [config/app.properties]
```
`overlays/production/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: shop-prod
resources:
  - ../../base
  - external-secret.yaml
components:
  - ../../components/high-availability
images:
  - name: registry.example.com/orders-api
    digest: sha256:3b5c1f0e9a7d2c4b6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f   # 1.4.2
replicas:
  - name: orders-api
    count: 4
patches:
  - path: patches/resources.yaml
  - target: { kind: Deployment, name: orders-api }
    patch: |-
      - op: add
        path: /spec/template/spec/containers/0/env/-
        value: { name: LOG_LEVEL, value: info }
```
```bash
for env in staging production; do
  kustomize build "deploy/overlays/$env" | kubeconform -strict -summary -
done
```
**Why it's right:**
- Shared structure lives once in the base; overlays contain only what differs, and HA settings are a reusable component.
- Images are pinned per environment by digest; configuration changes produce new hashed ConfigMap names that roll pods.
- Secrets come from an external secret store, and every overlay is rendered and validated in CI.
