---
name: terraform-testing
description: "Testing Terraform and OpenTofu code: static checks, the native terraform test framework with plan and apply runs, mock providers, variable validation and preconditions/postconditions, check blocks, Terratest for end-to-end tests, and running tests in CI with ephemeral environments. Use it when adding or reviewing tests for infrastructure code."
---

# Skill: Terraform Testing

## Implementation Rules:
- **[ARCHITECTURE]** Test infrastructure in layers: static analysis (`fmt`, `validate`, `tflint`, security scanners) on every change, unit-style tests with `terraform test` using `command = plan` and mock providers, and integration tests that apply to an ephemeral sandbox account for modules and critical stacks.
- **[MANDATORY]** Reusable modules ship `tests/*.tftest.hcl` covering default behavior, input validation failures (`expect_failures`), and important conditional paths; tests run in CI for every module change.
- **[PATTERN]** Use `mock_provider` and `override_resource`/`override_data` for fast, credential-free tests of logic (naming, tagging, conditional resources, computed outputs); reserve real-provider `apply` runs for behavior that depends on the cloud API.
- **[PATTERN]** Encode assumptions in the configuration itself: `validation` blocks on variables, `precondition`/`postcondition` in `lifecycle` blocks for resource and data source guarantees, and `check` blocks for continuous assertions (for example, an endpoint returns 200 after apply).
- **[PATTERN]** End-to-end tests with Terratest (Go) or `terraform test` apply runs deploy into isolated, uniquely named resources in a sandbox account, assert real behavior (connectivity, permissions, outputs), and always destroy afterwards.
- **[MANDATORY]** Integration tests never run against shared or production accounts; they use short-lived OIDC credentials for a dedicated test account with budget alerts and automated cleanup of leaked resources (for example, aws-nuke or cloud-nuke on a schedule).
- **[PATTERN]** Test upgrades: for modules, apply the previous version, upgrade to the new version, and assert that the plan contains no unexpected destroy/recreate operations.
- **[FORBIDDEN]** Tests that depend on pre-existing manually created resources, fixed resource names that collide in parallel runs, and skipping destroy on failure.
- **[PERFORMANCE]** Keep the default test run fast (plan-only and mocked tests on every pull request), and run expensive apply-based suites on merge, nightly, or when module paths change.
- **[TESTING]** Assert on meaningful properties (encryption enabled, no public access, tags present, expected number of resources), not on incidental details, and review test output in CI summaries.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
