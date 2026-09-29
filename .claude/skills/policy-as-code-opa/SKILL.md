---
name: policy-as-code-opa
description: "Policy as code for infrastructure and platforms with Open Policy Agent (Rego), Conftest, OPA Gatekeeper, Kyverno, HashiCorp Sentinel, or cloud-native guardrails: writing testable policies against Terraform plans and Kubernetes manifests, severity levels, exceptions, and enforcement in CI and admission. Use it when defining or reviewing automated governance rules."
---

# Skill: Policy as Code with OPA

## Implementation Rules:
- **[ARCHITECTURE]** Express organizational rules (tagging, allowed regions and instance types, encryption, network exposure, cost limits, Kubernetes security) as versioned, reviewed code rather than wiki pages; the same policies run in CI (shift left) and at enforcement points (admission controllers, HCP Terraform run tasks, cloud guardrails such as AWS SCPs or Azure Policy).
- **[MANDATORY]** Terraform policies evaluate the JSON plan (`terraform show -json tfplan`) using `resource_changes` so they see resolved values and the planned action (create, update, delete); policies on raw HCL miss module and variable values.
- **[PATTERN]** Write Rego with current syntax (`import rego.v1`, `deny contains msg if { ... }`), one concern per rule, clear messages that include the resource address and the fix, and helper functions for reuse; organize policies in packages by domain.
- **[PATTERN]** Distinguish severities: `deny` rules fail the pipeline, `warn` rules report without failing, and new rules start as warnings before being promoted to deny.
- **[MANDATORY]** Every policy has unit tests (`opa test`, `conftest verify`) with passing and failing fixtures, and policy test coverage is checked in CI (`opa test --coverage`).
- **[PATTERN]** Exceptions are data, not code edits: an exceptions file or resource annotation with owner, justification, and expiry date, evaluated by the policy and reviewed like any change.
- **[PATTERN]** For Kubernetes, choose one admission engine per cluster (Gatekeeper with ConstraintTemplates, Kyverno, or native ValidatingAdmissionPolicy with CEL), run it in audit mode before enforcing, and run the same policies in CI against rendered manifests (`gator test`, `kyverno apply`, Conftest).
- **[FORBIDDEN]** Policies without tests, rules that fail with unhelpful messages, disabling policy checks to unblock a deployment instead of using a documented exception, and duplicating the same rule in several engines with divergent logic.
- **[PATTERN]** Distribute policies as versioned bundles (OCI artifacts with `conftest push`/`pull`, OPA bundles, Git tags) consumed by pipelines at pinned versions.
- **[TESTING]** Measure the effect of a new policy on existing code (audit results, number of violations) before enforcing it, and communicate remediation guidance to teams.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
