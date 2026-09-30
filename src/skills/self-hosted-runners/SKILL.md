---
name: self-hosted-runners
description: "Operating secure and scalable self-hosted CI runners: ephemeral just-in-time runners, Actions Runner Controller on Kubernetes, autoscaling, runner groups and labels, network isolation, image hardening, caching strategies, and when to prefer GitHub-hosted or larger runners. Use it when designing or reviewing self-hosted runner infrastructure."
---

# Skill: Self-Hosted Runners

## Implementation Rules:
- **[ARCHITECTURE]** Prefer GitHub-hosted (standard or larger) runners by default; use self-hosted runners only for concrete needs (private network access, special hardware such as GPUs, compliance, or cost at scale), and record the decision.
- **[MANDATORY]** Self-hosted runners are ephemeral: one job per runner (`--ephemeral` or just-in-time runners), created fresh from a known image and destroyed afterwards, so no state, credentials, or malware persist between jobs.
- **[FORBIDDEN]** Self-hosted runners for public repositories or for workflows triggered by forks, persistent runners shared across trust levels, and runners executing jobs as root on a host with access to production credentials or the Docker socket of other workloads.
- **[PATTERN]** On Kubernetes, use Actions Runner Controller (runner scale sets) with autoscaling from zero, resource requests and limits per runner, and a dedicated namespace and node pool; container builds use rootless BuildKit or Kaniko instead of privileged Docker-in-Docker where possible.
- **[SECURITY]** Isolate runners by trust level with runner groups restricted to specific repositories and workflows; production deployment runners are separate from general CI runners.
- **[SECURITY]** Restrict network egress to required endpoints (GitHub, registries, package mirrors) through firewalls or proxies, deny access to cloud metadata endpoints unless required, and grant runner identities least privilege.
- **[PATTERN]** Build runner images as code (Packer, Dockerfiles) from minimal, patched base images with pinned tool versions, rebuilt and scanned regularly; the image definition is versioned and reviewed.
- **[PERFORMANCE]** Speed up ephemeral runners with warm pools, pre-baked tool caches in images, and shared read-through caches (package mirrors, registry pull-through caches) instead of persistent local state.
- **[PATTERN]** Use labels to route jobs (`runs-on: [self-hosted, linux, x64, gpu]` or runner scale set names) and keep label sets small and meaningful.
- **[MANDATORY]** Monitor runner fleet health: queue time, job duration, utilization, failures, and autoscaler events; alert when queue times exceed targets.
- **[TESTING]** Periodically verify isolation: a job must not see files, processes, or credentials from previous jobs, and must not reach blocked network destinations.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
