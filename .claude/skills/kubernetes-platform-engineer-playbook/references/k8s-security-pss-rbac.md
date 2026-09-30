# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Root, privileged, and cluster-admin
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: { name: app-admin }
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: cluster-admin }
subjects: [{ kind: ServiceAccount, name: default, namespace: shop }]
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: api, namespace: shop }
spec:
  template:
    spec:
      containers:
        - name: api
          image: api:1.0
          securityContext: { privileged: true }
          volumeMounts: [{ name: docker, mountPath: /var/run/docker.sock }]
      volumes: [{ name: docker, hostPath: { path: /var/run/docker.sock } }]
```
**Why it's wrong:**
- Any compromise of the pod grants full control of the cluster and the node (privileged, runtime socket, cluster-admin).
- The default service account is shared by every pod in the namespace.

## Best Practice (How to do it right)

### 1. Restricted namespace, hardened pod, least-privilege RBAC
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
---
apiVersion: v1
kind: ServiceAccount
metadata: { name: orders-api, namespace: shop }
automountServiceAccountToken: false
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: orders-api, namespace: shop }
spec:
  template:
    spec:
      serviceAccountName: orders-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        fsGroup: 10001
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: api
          image: registry.example.com/orders-api:1.4.2@sha256:3b5c1f0e9a7d2c4b6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }
          volumeMounts: [{ name: tmp, mountPath: /tmp }]
      volumes: [{ name: tmp, emptyDir: { sizeLimit: 64Mi } }]
```
### 2. Admission policy: only signed images from the approved registry (Kyverno)
```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: verify-images }
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 15
  rules:
    - name: signed-by-ci
      match: { any: [{ resources: { kinds: [Pod] } }] }
      verifyImages:
        - imageReferences: ['registry.example.com/*']
          attestors:
            - entries:
                - keyless:
                    issuer: https://token.actions.githubusercontent.com
                    subject: 'https://github.com/acme/*/.github/workflows/release.yml@refs/tags/*'
                    rekor: { url: https://rekor.sigstore.dev }
```
**Why it's right:**
- The namespace enforces the restricted Pod Security Standard; the pod runs non-root, read-only, without capabilities or an API token.
- Each workload has its own service account with no default permissions.
- Only images signed by the organization's release workflow can run.
