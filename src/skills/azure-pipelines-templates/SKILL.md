---
name: azure-pipelines-templates
description: "Reusing Azure Pipelines configuration with templates: step, job, stage, and variable templates, extends templates for enforced structure, typed template parameters including stepList and object, template expressions with each and conditional insertion, templates from a central repository pinned by ref, required template checks on protected resources, versioning, and testing templates. Use it when standardizing pipelines across many Azure DevOps projects or repositories."
---

# Skill: Azure Pipelines Templates

## Implementation Rules:
- **[ARCHITECTURE]** Keep shared pipeline logic in a central templates repository referenced with `resources: repositories` and `template: path@alias`, organized by type (`steps/`, `jobs/`, `stages/`, `variables/`, `pipelines/`).
- **[MANDATORY]** Pin the templates repository to a release tag or protected branch with `ref: refs/tags/v3.2.0` (or a major-version branch you control), never an unprotected developer branch.
- **[PATTERN]** Declare every template parameter with `type` and `default` (or mark it required by omitting the default), use `values` for allowed options, and validate complex `object` parameters with explicit checks that fail at compile time.
- **[ARCHITECTURE]** Use an `extends` template as the single entry point for production pipelines so the organization controls the skeleton (security scans, artifact publishing, deployment stages) while teams inject their build steps through `stepList` parameters.
- **[SECURITY]** Enforce templates with the "Required template" check on environments, service connections, agent pools, and variable groups, so only pipelines extending the approved template can use protected resources.
- **[SECURITY]** Inside `extends` templates, validate injected `stepList` content (for example with `${{ each }}` loops that reject `script` steps or specific tasks) when the template must prevent arbitrary commands in sensitive stages.
- **[PATTERN]** Generate repetitive structure with template expressions: `${{ each env in parameters.environments }}` to create deployment stages, `${{ if }}` conditional insertion for optional steps, and `${{ insert }}` for merging mappings.
- **[PATTERN]** Use variable templates for shared, non-secret configuration (tool versions, naming conventions) and variable groups linked to Azure Key Vault for secrets.
- **[FORBIDDEN]** Untyped or undocumented parameters, templates that silently deploy based on implicit branch names, deeply nested templates beyond a few levels, copy-pasted forks of shared templates, and breaking parameter changes without a new major version.
- **[PATTERN]** Version templates with Semantic Versioning, keep a changelog, deprecate parameters before removal, and document each template with its parameters and a usage example in the templates repository.
- **[CONFIGURATION]** Keep templates within Azure Pipelines limits (maximum 100 separate YAML files and 20 levels of nesting per pipeline, and the expanded YAML size limit) and prefer fewer, well-designed templates over many tiny ones.
- **[TESTING]** Test templates with sample consumer pipelines in the templates repository run on every pull request, including preview runs to inspect the expanded YAML, before tagging a release.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
