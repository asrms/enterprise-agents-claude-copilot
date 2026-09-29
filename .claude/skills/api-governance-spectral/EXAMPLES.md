# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Style guide on a wiki, rules disabled locally
```yaml
# .spectral.yaml in a service repository
extends: ["spectral:oas"]
rules:
  operation-operationId: off
  operation-tag-defined: off
  oas3-api-servers: off
  info-contact: off
```
**Why it's wrong:**
- Company conventions are not encoded at all, and even the built-in checks are switched off to make the pipeline green.
- Each team diverges, so consumers face different error formats, naming, and pagination in every API.

## Best Practice (How to do it right)

### 1. Shared ruleset with company rules and a CI gate
```yaml
# @acme/spectral-ruleset/ruleset.yaml
extends: ["spectral:oas"]
rules:
  paths-kebab-case:
    description: Paths use kebab-case segments.
    severity: error
    given: $.paths[*]~
    then:
      function: pattern
      functionOptions: { match: "^(\\/([a-z0-9]+(-[a-z0-9]+)*|\\{[a-zA-Z]+\\}))+$" }

  no-verbs-in-paths:
    severity: error
    given: $.paths[*]~
    then:
      function: pattern
      functionOptions: { notMatch: "/(get|create|update|delete|list)[A-Za-z-]*" }

  properties-camel-case:
    severity: error
    given: $.components.schemas..properties[*]~
    then: { function: casing, functionOptions: { type: camel } }

  problem-details-for-errors:
    description: 4xx/5xx responses use application/problem+json.
    severity: error
    given: $.paths[*][*].responses[?(@property.match(/^[45]/))].content
    then: { field: application/problem+json, function: truthy }

  operation-security-defined:
    severity: error
    given: $.paths[*][get,put,post,patch,delete]
    then: { field: security, function: defined }

  string-max-length:
    severity: warn
    given: $.components.schemas..[?(@.type == 'string' && !@.enum && !@.format)]
    then: { field: maxLength, function: defined }

  api-owner-required:
    severity: error
    given: $.info
    then: { field: x-owner-team, function: truthy }
```
```yaml
# service repository: .spectral.yaml
extends: ["@acme/spectral-ruleset"]
overrides:
  - files: ["api/openapi.yaml#/paths/~1legacy-export"]
    rules: { no-verbs-in-paths: off }      # legacy endpoint, sunset 2025-12-01 (API-311)
```
```yaml
# .github/workflows/api-contract.yml (excerpt)
- run: npx @stoplight/spectral-cli lint api/openapi.yaml --fail-severity error --format github-actions
- run: oasdiff breaking https://raw.githubusercontent.com/acme/orders/main/api/openapi.yaml api/openapi.yaml --fail-on ERR
```
**Why it's right:**
- Conventions from the style guide are executable, shared, and versioned; security and error format rules block merges.
- The only exception is scoped to one path, documented, and time-limited.
- Linting and breaking change checks run on every PR with inline annotations.
