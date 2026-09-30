---
name: helm-charts
description: "Authoring and consuming Helm charts: chart structure, values design with JSON schema validation, named templates and helpers, safe defaults, library charts, dependency management, chart versioning, OCI registries, chart testing with helm lint, ct, helm-unittest, and rendering in CI. Use it when creating, reviewing, or upgrading Helm charts."
---

# Skill: Helm Charts

## Implementation Rules:
- **[ARCHITECTURE]** Use Helm to package reusable applications (internal platform charts, third-party software); for single-application environment differences, Kustomize overlays may be simpler. Do not template everything: expose values only for what legitimately varies.
- **[MANDATORY]** Charts follow the standard structure (`Chart.yaml` with `apiVersion: v2`, `values.yaml`, `values.schema.json`, `templates/`, `templates/_helpers.tpl`, `templates/NOTES.txt`) and validate values with a JSON schema so invalid configuration fails at install time.
- **[MANDATORY]** Default values are production-safe: resources set, probes enabled, non-root security context, `readOnlyRootFilesystem: true`, service account token automount disabled unless needed, no default passwords, and images referenced by explicit tag or digest (never `latest`).
- **[PATTERN]** Use named templates in `_helpers.tpl` for names, labels, and selector labels (`{{ include "app.labels" . }}`), apply the recommended `app.kubernetes.io/*` labels, and keep selector labels stable across versions.
- **[PATTERN]** Render structured values safely with `toYaml` and `nindent`, quote strings (`{{ .Values.x | quote }}`), use `required` for mandatory values, and add checksum annotations for ConfigMaps/Secrets so config changes roll pods.
- **[PATTERN]** Version charts with SemVer: bump `version` for every chart change and `appVersion` for the application; publish to an OCI registry (`helm push chart.tgz oci://registry/charts`) and sign/verify charts where supported.
- **[PATTERN]** Declare dependencies in `Chart.yaml` with pinned version ranges and commit `Chart.lock`; share common templates through library charts rather than copy-paste.
- **[FORBIDDEN]** Secrets with real values in `values.yaml` or chart repositories, `lookup`-based logic that behaves differently in GitOps renders, hooks for regular resources (hooks are for jobs such as migrations and must be idempotent), and `helm install` against production from a laptop.
- **[SECURITY]** Consume third-party charts from trusted sources with pinned versions, review rendered manifests (`helm template`) before adoption, and override insecure defaults explicitly.
- **[PATTERN]** Keep environment-specific values in separate files (`values-staging.yaml`, `values-production.yaml`) managed by GitOps (Argo CD, Flux HelmRelease) with `helm upgrade --install --atomic --wait` semantics for imperative pipelines.
- **[TESTING]** CI runs `helm lint --strict`, `helm template` piped into `kubeconform`, `helm-unittest` for template logic, and `ct lint`/`ct install` (chart-testing) on a kind cluster for changed charts.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
