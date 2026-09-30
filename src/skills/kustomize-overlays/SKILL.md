---
name: kustomize-overlays
description: "Managing Kubernetes configuration across environments with Kustomize: base and overlay layout, components, strategic merge and JSON patches, images and replicas transformers, configMapGenerator and secretGenerator with hashed names, labels, and validation of rendered output. Use it when structuring or reviewing Kustomize-based manifests."
---

# Skill: Kustomize Overlays

## Implementation Rules:
- **[ARCHITECTURE]** Organize manifests as a `base/` with environment-agnostic resources and `overlays/<env>/` (dev, staging, production) that apply only the differences; optional features (monitoring, debug tooling, HA settings) are packaged as reusable `components/`.
- **[MANDATORY]** The base is valid and deployable on its own with safe defaults (resources, probes, security context); overlays never copy whole resources, they patch the fields that change.
- **[PATTERN]** Prefer the dedicated transformers over patches for common changes: `images` (tag or digest per environment), `replicas`, `namespace`, `labels` with `includeSelectors: false` for non-selector labels, and `namePrefix`/`nameSuffix` sparingly.
- **[PATTERN]** Use strategic merge patches for readable changes to known resources and JSON 6902 patches (`patches` with `target` and `op`) for list items or precise operations; keep each patch small and named after its purpose.
- **[PATTERN]** Generate ConfigMaps with `configMapGenerator` from files or literals so names get a content hash and pods roll automatically when configuration changes; keep `disableNameSuffixHash` off unless an external system needs a fixed name.
- **[FORBIDDEN]** Plain-text secrets in `secretGenerator` literals or files committed to Git; use External Secrets Operator, Sealed Secrets, or SOPS-encrypted files (with KSOPS or Flux decryption) instead.
- **[FORBIDDEN]** Deeply nested overlay chains (overlay of an overlay of an overlay), remote bases referenced by branch instead of a pinned tag or commit, and changing selector labels in overlays.
- **[PATTERN]** Pin image references per environment to immutable tags or digests via `images:`, updated by CI or an image automation controller in a pull request, not edited by hand in the cluster.
- **[PATTERN]** Use `helmCharts` in Kustomize only when necessary to post-process third-party charts; prefer the GitOps tool's native Helm support otherwise.
- **[TESTING]** CI renders every overlay (`kustomize build overlays/<env>`), validates the output with `kubeconform -strict`, lints it with `kube-linter` or policy checks (Kyverno CLI, Conftest), and shows the rendered diff in pull requests.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
