---
name: gitops-argocd-flux
description: "GitOps continuous delivery for Kubernetes with Argo CD or Flux: declarative desired state in Git, repository layout, App of Apps and ApplicationSets, Flux Kustomizations and HelmReleases, sync policies, drift detection and self-healing, image automation, secrets handling, multi-cluster promotion, and RBAC. Use it when setting up or reviewing GitOps delivery."
---

# Skill: GitOps with Argo CD and Flux

## Implementation Rules:
- **[ARCHITECTURE]** Git is the single source of truth for cluster state: application and platform manifests (Helm values, Kustomize overlays) live in version-controlled repositories, and a controller in the cluster (Argo CD or Flux) pulls and reconciles them; CI pipelines do not run `kubectl apply` against production.
- **[PATTERN]** Separate application source code from deployment configuration (a config or environment repository, or a dedicated `deploy/` path with its own review rules); CI builds images and opens a pull request that updates the image digest for the target environment.
- **[PATTERN]** Structure for scale: Argo CD App of Apps or `ApplicationSet` generators (Git directories, clusters, pull requests) and `AppProject`s per team; Flux `GitRepository`/`OCIRepository` sources with layered `Kustomization`s (infrastructure first, then apps with `dependsOn`).
- **[MANDATORY]** Enable automated sync with self-healing and pruning for managed environments (`syncPolicy.automated.selfHeal: true, prune: true` in Argo CD; `prune: true` with a reconciliation interval in Flux), so manual drift is reverted and deleted resources are removed.
- **[MANDATORY]** Promotion between environments happens through Git changes (pull requests updating the digest or version in the next environment's overlay), reviewed and auditable; production changes require approval via branch protection or rulesets.
- **[SECURITY]** Secrets are never stored in plain text in Git: use External Secrets Operator, Sealed Secrets, or SOPS with age/KMS keys decrypted by Flux or an Argo CD plugin.
- **[SECURITY]** Restrict the GitOps controller: Argo CD `AppProject`s limit source repositories, destination namespaces, and allowed cluster-scoped resources; SSO with RBAC for the UI; Flux multi-tenancy with per-tenant service accounts (`serviceAccountName`) instead of cluster-admin.
- **[PATTERN]** Use sync waves and hooks (Argo CD `argocd.argoproj.io/sync-wave`, Flux `dependsOn` and health checks) to order CRDs, namespaces, infrastructure, and applications; define health checks so sync status reflects real readiness.
- **[PATTERN]** Image automation (Argo CD Image Updater or Flux image automation controllers) writes back to Git with policies (SemVer ranges, digest pinning) rather than mutating the cluster directly.
- **[FORBIDDEN]** Manual `kubectl edit`/`apply` on GitOps-managed resources, targeting mutable branches of third-party repositories, and a single cluster-admin controller credential shared by all teams without project boundaries.
- **[TESTING]** Pull requests to the configuration repository render manifests and show the diff (`argocd app diff`, `flux diff kustomization`, or CI rendering), validate them with kubeconform and policies, and notify teams of sync failures and degraded health via alerts.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
