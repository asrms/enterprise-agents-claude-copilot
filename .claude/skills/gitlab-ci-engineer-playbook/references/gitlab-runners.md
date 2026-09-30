# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. One privileged shared runner for everything
```toml
concurrent = 50

[[runners]]
  name = "shared-vm-01"
  url = "https://gitlab.example.com"
  token = "glrt-EXAMPLE-TOKEN-IN-GIT"        # token committed with the configuration
  executor = "docker"
  [runners.docker]
    image = "ubuntu:latest"
    privileged = true                        # any job can escape to the host
    volumes = ["/var/run/docker.sock:/var/run/docker.sock", "/cache"]
    pull_policy = ["if-not-present"]         # stale or poisoned images reused
```
The same VM also has an instance profile with `AdministratorAccess`, runs untagged jobs from every project, and is never upgraded.
**Why it's wrong:**
- A single malicious merge request job can take over the host, the Docker socket, and the cloud account.
- There is no isolation between untrusted and production jobs, no autoscaling, and the token is exposed in version control.

## Best Practice (How to do it right)

### 1. Kubernetes executor via the Helm chart, least privilege
`values-build.yaml` (pinned chart version, token from a Kubernetes secret managed by External Secrets):
```yaml
gitlabUrl: https://gitlab.example.com
concurrent: 40
checkInterval: 3
unregisterRunners: true
rbac:
  create: true
runners:
  secret: gitlab-runner-build-token          # contains runner-token (glrt-...), synced from the secret manager
  config: |
    [[runners]]
      name = "k8s-build"
      limit = 40
      output_limit = 16384
      [runners.kubernetes]
        namespace = "ci-build"
        image = "registry.example.com/ci/base:2026.09"
        privileged = false
        allow_privilege_escalation = false
        automount_service_account_token = false
        cpu_request = "500m"
        memory_request = "1Gi"
        cpu_limit = "2"
        memory_limit = "4Gi"
        cpu_limit_overwrite_max_allowed = "4"
        memory_limit_overwrite_max_allowed = "8Gi"
        pull_policy = ["always"]
        [runners.kubernetes.node_selector]
          "workload" = "ci-build"
        [runners.kubernetes.pod_security_context]
          run_as_non_root = true
          run_as_user = 1000
      [runners.cache]
        Type = "s3"
        Shared = true
        [runners.cache.s3]
          ServerAddress = "s3.amazonaws.com"
          BucketName = "example-gitlab-runner-cache"
          BucketLocation = "eu-west-1"
          AuthenticationType = "iam"
```
A separate release with `values-deploy.yaml` runs in namespace `ci-deploy` on dedicated nodes, is marked as a protected runner with tag `deploy-prod`, and runs jobs that obtain cloud credentials only through `id_tokens`.

**Why it's right:**
- Every job gets a fresh, non-root pod with resource limits; nothing is shared between jobs except the S3 cache.
- The runner token lives in a secret manager, the cache uses IAM roles instead of static keys, and deployment runners are isolated and protected.

### 2. Alerting on runner saturation
```yaml
groups:
  - name: gitlab-runner
    rules:
      - alert: GitLabRunnerSaturated
        expr: sum(gitlab_runner_jobs{state="running"}) / sum(gitlab_runner_concurrent) > 0.9
        for: 15m
        labels: { severity: warning }
        annotations:
          summary: Runner fleet above 90% of concurrent capacity for 15 minutes
          runbook_url: https://docs.example.com/runbooks/gitlab-runner-capacity
```
**Why it's right:**
- Saturation is detected before queue times grow, and the alert links to a runbook for scaling the fleet.
