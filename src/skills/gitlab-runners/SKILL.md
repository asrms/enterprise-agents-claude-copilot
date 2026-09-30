---
name: gitlab-runners
description: "Operating GitLab Runner fleets: choosing executors (Kubernetes, Docker, Docker autoscaler, instance, shell), runner scopes (instance, group, project), tags and protected runners, autoscaling with fleeting plugins or the Kubernetes executor, config.toml tuning (concurrency, resources, pull policies, cache), runner authentication tokens and registration workflow, security isolation, monitoring with Prometheus metrics, upgrades, and cost control. Use it when setting up, scaling, securing, or troubleshooting self-managed GitLab runners."
---

# Skill: GitLab Runners

## Implementation Rules:
- **[ARCHITECTURE]** Choose executors deliberately: the Kubernetes executor or the Docker autoscaler/instance executors with fleeting plugins for ephemeral, isolated jobs; plain Docker for small static fleets; the shell executor only for dedicated, single-purpose hosts where containers are impossible.
- **[MANDATORY]** Create runners with the current runner authentication token workflow (runner created in the UI or API, which issues a `glrt-` runner authentication token) instead of deprecated registration tokens, store tokens in a secret manager, and rotate them.
- **[SECURITY]** Isolate trust levels: separate runners (or node pools and namespaces) for untrusted merge request jobs, normal builds, and protected production deployments; mark deployment runners as protected so they only run jobs on protected refs.
- **[PATTERN]** Route jobs with tags that describe capabilities (`linux`, `arm64`, `gpu`, `large`, `deploy-prod`), avoid untagged catch-all runners for sensitive workloads, and document available tags for pipeline authors.
- **[SECURITY]** Avoid `privileged = true`; build images with rootless BuildKit or Kaniko-style builders, run job pods with non-root security contexts and service account token automounting disabled, and network policies restricting egress where possible.
- **[CONFIGURATION]** Tune `config.toml`: global `concurrent` and per-runner `limit`, Kubernetes CPU and memory requests and limits (with overwrite limits for jobs), `pull_policy = ["if-not-present"]` only for trusted images, helper image pinning, and job timeouts.
- **[PERFORMANCE]** Configure a distributed cache (S3, GCS, or Azure Blob) with lifecycle rules so autoscaled runners share caches, and pull images through the Dependency Proxy or a registry mirror close to the runners.
- **[PATTERN]** Manage runner configuration as code: the GitLab Runner Helm chart or Terraform/Ansible for VMs, versioned values files, and the runner version kept within the supported range of the GitLab instance version.
- **[FORBIDDEN]** Long-lived shared VMs running jobs from many projects with the shell executor, privileged Docker-in-Docker on shared runners, runners with cloud admin credentials on the host, and registration tokens committed to repositories.
- **[CONFIGURATION]** Use cloud identity for runner infrastructure (IRSA, workload identity, managed identities) with least privilege, and prefer job-level OIDC (`id_tokens`) for deployments instead of permissions attached to the runner.
- **[PERFORMANCE]** Control cost with autoscaling to zero where queues allow, spot or preemptible capacity for interruptible jobs, idle scale-down timers, and right-sized machine types per tag.
- **[TESTING]** Monitor runners with the Prometheus metrics endpoint (jobs running, queue duration, errors, `concurrent` saturation) and alerts, and test runner upgrades on a canary runner before rolling them out to the fleet.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
