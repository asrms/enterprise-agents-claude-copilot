---
name: k8s-security-pss-rbac
description: "Kubernetes security hardening: Pod Security Standards (restricted) via Pod Security Admission, container securityContext, least-privilege RBAC and service accounts, workload identity, admission policies with Kyverno, Gatekeeper, or ValidatingAdmissionPolicy, image signature verification, secrets management, and audit. Use it when securing clusters or reviewing workload manifests."
---

# Skill: Kubernetes Security (PSS and RBAC)

## Implementation Rules:
- **[MANDATORY]** Enforce Pod Security Standards with Pod Security Admission labels on every application namespace: `pod-security.kubernetes.io/enforce: restricted` (with `warn` and `audit` at the same level); exceptions use `baseline` only for documented system workloads.
- **[MANDATORY]** Every container runs with a hardened `securityContext`: `runAsNonRoot: true`, a non-zero `runAsUser`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` (writable `emptyDir` only where needed), `capabilities.drop: [ALL]`, and `seccompProfile.type: RuntimeDefault`.
- **[FORBIDDEN]** Privileged containers, `hostPath`, `hostNetwork`, `hostPID`, `hostIPC`, added capabilities such as `SYS_ADMIN` or `NET_ADMIN` for applications, and mounting the container runtime socket.
- **[MANDATORY]** RBAC follows least privilege: dedicated `ServiceAccount` per workload, `automountServiceAccountToken: false` unless the pod calls the Kubernetes API, namespaced `Role`s with explicit verbs and resources, no wildcards (`*`), and no `cluster-admin` bindings for applications or CI.
- **[SECURITY]** Human access uses SSO/OIDC groups bound to roles, short-lived credentials, and separate break-glass accounts; `kubectl exec`, `port-forward`, and secret read permissions are restricted and audited.
- **[PATTERN]** Workloads access cloud APIs through workload identity (EKS Pod Identity or IRSA, Azure Workload Identity, GKE Workload Identity) instead of static cloud keys in Secrets.
- **[PATTERN]** Admission policies enforce the rules centrally: Kyverno, OPA Gatekeeper, or native `ValidatingAdmissionPolicy` for required labels, resource limits, disallowed registries, `latest` tags, and security context settings; start in audit mode and then enforce.
- **[SECURITY]** Supply chain: images come from approved registries, are scanned (Trivy, Grype) in CI and continuously in the cluster, and are signed with cosign; admission verifies signatures and attestations before pods run.
- **[SECURITY]** Secrets: enable encryption at rest for etcd with a KMS provider, source secrets from an external manager (External Secrets Operator, Secrets Store CSI Driver), restrict `get`/`list` on Secrets, and prefer mounting secrets as files over environment variables.
- **[PATTERN]** Default-deny `NetworkPolicy` per namespace, API server audit logging, runtime threat detection (Falco, Tetragon), and regular benchmark checks (kube-bench for CIS, Kubescape) complete the defense in depth.
- **[TESTING]** CI validates manifests against the same policies used in the cluster (`kyverno apply`, `gator test`, Conftest) and fails on violations; RBAC is reviewed with `kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa>` and tools such as rbac-tool.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
