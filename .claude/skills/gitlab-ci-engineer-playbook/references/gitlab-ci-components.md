# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Copy-paste and floating includes
```yaml
# copied into 60 projects, each slightly modified
include:
  - remote: 'https://raw.githubusercontent.com/someone/ci-snippets/main/node.yml'   # untrusted, mutable
  - project: 'platform/ci-templates'
    file: 'deploy.yml'                                                              # no ref: always latest main
```
**Why it's wrong:**
- Copies drift, a remote include from an untrusted source can change at any time, and unpinned project includes break consumers unexpectedly.

## Best Practice (How to do it right)

### 1. Component with typed inputs
`platform/ci-components/templates/node-build.yml`:
```yaml
spec:
  inputs:
    stage:
      default: build
    node_version:
      default: "22"
      description: Node.js major version used for the build image
      options: ["20", "22"]
    working_directory:
      default: "."
    run_tests:
      type: boolean
      default: true
---
"node-build":
  stage: $[[ inputs.stage ]]
  image: node:$[[ inputs.node_version ]]-bookworm-slim
  interruptible: true
  script:
    - cd "$[[ inputs.working_directory ]]"
    - npm ci
    - npm run build
    - if [ "$[[ inputs.run_tests ]]" = "true" ]; then npm test -- --reporter=junit --outputFile=junit.xml; fi
  artifacts:
    paths: ["$[[ inputs.working_directory ]]/dist/"]
    reports:
      junit: "$[[ inputs.working_directory ]]/junit.xml"
    expire_in: 1 week
```
### 2. Consumer pinned to a released version
```yaml
include:
  - component: $CI_SERVER_FQDN/platform/ci-components/node-build@2.3.0
    inputs:
      node_version: "22"
      working_directory: web
```
### 3. Component self-test pipeline (in the component project)
```yaml
include:
  - component: $CI_SERVER_FQDN/$CI_PROJECT_PATH/node-build@$CI_COMMIT_SHA
    inputs:
      working_directory: tests/fixtures/sample-app
```
**Why it's right:**
- Logic lives once in a versioned component with validated inputs; consumers pin a released version and pass only what differs.
- The component is tested from the current commit before release, and upgrades are explicit.
