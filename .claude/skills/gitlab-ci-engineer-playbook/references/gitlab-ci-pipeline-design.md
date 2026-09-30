# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Duplicate pipelines, strict stages, rebuilds per environment
```yaml
stages: [build, test, deploy]

build:
  stage: build
  image: node:latest
  script: npm install && npm run build            # not reproducible, artifacts not kept

test:
  stage: test
  script: npm install && npm test                 # reinstalls everything, waits for all build jobs

deploy_prod:
  stage: deploy
  script: npm install && npm run build && ./deploy.sh prod   # rebuilds for production
  only: [branches]                                 # every branch deploys to production
```
**Why it's wrong:**
- Pipelines run for both branch and merge request events, the image tag is mutable, and work is repeated.
- Production receives a different build than the one tested, from any branch.

## Best Practice (How to do it right)

### 1. Workflow rules, DAG with needs, build once, JUnit reports
```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_COMMIT_TAG

default:
  image: node:22.19-bookworm-slim
  interruptible: true

stages: [build, test, deploy]

build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths: [dist/]
    expire_in: 1 week

test:unit:
  stage: test
  needs: []
  script:
    - npm ci
    - npm test -- --reporter=junit --outputFile=junit.xml
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      junit: junit.xml

deploy:staging:
  stage: deploy
  needs: [build, test:unit]
  interruptible: false
  resource_group: staging
  environment: { name: staging, url: https://staging.example.com }
  script: ./scripts/deploy.sh staging dist/
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```
**Why it's right:**
- Exactly one pipeline runs per change, tests start immediately via `needs: []`, and the tested artifact is the one deployed.
- Deployments are serialized, not interruptible, and limited to the default branch; test results appear in the merge request.
