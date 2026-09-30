# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One persistent VM runner for everything
```bash
# installed once on a VM that also has production kubeconfig and cloud keys
./config.sh --url https://github.com/acme --token XXXX --labels self-hosted
sudo ./svc.sh install root
```
```yaml
# public repository workflow
on: pull_request
jobs:
  test:
    runs-on: self-hosted
```
**Why it's wrong:**
- Every job, including pull requests from forks, runs as root on a long-lived machine with production credentials.
- Files, caches, and processes persist between jobs, so one malicious job compromises all later ones.

## Best Practice (How to do it right)

### 1. Ephemeral runner scale set with Actions Runner Controller
```bash
helm install arc \
  --namespace arc-systems --create-namespace \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller

helm install ci-linux \
  --namespace arc-runners --create-namespace \
  --set githubConfigUrl="https://github.com/acme" \
  --set githubConfigSecret=arc-github-app \
  --set runnerGroup="internal-ci" \
  --set minRunners=0 --set maxRunners=40 \
  -f runner-values.yaml \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set
```
`runner-values.yaml`:
```yaml
template:
  spec:
    nodeSelector: { workload: ci-runners }
    securityContext: { runAsNonRoot: true, runAsUser: 1001 }
    containers:
      - name: runner
        image: ghcr.io/acme/ci-runner:2026.09.1      # built with pinned tools, scanned
        command: ["/home/runner/run.sh"]
        env:
          - { name: HTTPS_PROXY, value: 'http://10.30.0.10:3128' }
          - { name: NO_PROXY, value: '10.20.0.0/16,.svc,.cluster.local' }
        resources:
          requests: { cpu: '2', memory: 4Gi }
          limits: { cpu: '4', memory: 8Gi }
```
```yaml
# NetworkPolicy: egress only to DNS, internal mirrors, and the egress proxy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: runner-egress, namespace: arc-runners }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } } }]
      ports: [{ port: 53, protocol: UDP }]
    - to: [{ ipBlock: { cidr: 10.20.0.0/16 } }]   # internal registry and package mirrors
    - to: [{ ipBlock: { cidr: 10.30.0.10/32 } }]  # egress proxy that allow-lists GitHub endpoints
      ports: [{ port: 3128, protocol: TCP }]
```
```yaml
jobs:
  build:
    runs-on: ci-linux        # scale set name, only available to repositories in the runner group
```
**Why it's right:**
- Each job gets a fresh, non-root pod that is destroyed afterwards; the fleet scales from zero.
- A GitHub App authenticates the controller; the runner group limits which repositories can use it.
- Runner images are versioned and scanned, and network egress is restricted.
