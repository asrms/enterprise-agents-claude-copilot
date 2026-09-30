# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Reinstalling everything and running tests serially
```yaml
image: node:latest

cache:
  key: global                  # one cache for every branch and job
  paths: [node_modules/]       # stale modules survive lock-file changes

stages: [setup, lint, test, build]

setup:
  stage: setup
  script:
    - apt-get update && apt-get install -y chromium   # 2 minutes on every run
    - npm install                                     # not reproducible, ignores the lock file

test:
  stage: test
  script:
    - npm test                 # 35 minutes, single job, waits for lint although it does not need it
  retry: 2                     # hides flaky tests
```
**Why it's wrong:**
- Every job uploads and downloads the same global cache, and stale dependencies can produce builds that do not match the lock file.
- System packages are installed on each run, tests are not split, and stages serialize work that could run in parallel.
- Silent retries mask flaky tests instead of fixing them.

## Best Practice (How to do it right)

### 1. Lock-file cache, DAG, and sharded tests
```yaml
variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"
  GIT_DEPTH: "20"

default:
  image: registry.example.com/ci/node-chromium:22-2026.09   # prebuilt image with Node.js and Chromium
  interruptible: true

.node-cache: &node-cache
  key:
    files: [package-lock.json]
    prefix: npm
  paths: [.npm/]
  fallback_keys: [npm-default]
  policy: pull

install:
  stage: build
  cache:
    <<: *node-cache
    policy: pull-push
  script:
    - npm ci --prefer-offline
  artifacts:
    paths: [node_modules/]
    expire_in: 2 hours

lint:
  stage: test
  needs: [install]
  script: [npm run lint]

test:unit:
  stage: test
  needs: [install]
  parallel: 6
  script:
    - npx vitest run --shard="$CI_NODE_INDEX/$CI_NODE_TOTAL" --reporter=junit --outputFile=junit.xml
  artifacts:
    reports:
      junit: junit.xml
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      changes:
        paths: ["web/**/*", package-lock.json]
        compare_to: refs/heads/main
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```
**Why it's right:**
- The cache key changes only when the lock file changes, only `install` uploads it, and `npm ci` stays reproducible.
- `needs` lets lint and tests start right after install, and six shards cut the test wall-clock time.
- Merge requests that do not touch the web app skip the tests, while the default branch always runs them.

### 2. Image build with a registry cache
```yaml
build:image:
  stage: build
  image: moby/buildkit:v0.23.2-rootless
  variables:
    BUILDKITD_FLAGS: --oci-worker-no-process-sandbox
  before_script:
    - mkdir -p ~/.docker
    - printf '{"auths":{"%s":{"auth":"%s"}}}' "$CI_REGISTRY" "$(printf '%s:%s' "$CI_REGISTRY_USER" "$CI_REGISTRY_PASSWORD" | base64 | tr -d '\n')" > ~/.docker/config.json
  script:
    - >
      buildctl-daemonless.sh build
      --frontend dockerfile.v0 --local context=. --local dockerfile=.
      --output type=image,name=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA,push=true
      --export-cache type=registry,ref=$CI_REGISTRY_IMAGE:buildcache,mode=max
      --import-cache type=registry,ref=$CI_REGISTRY_IMAGE:buildcache
```
**Why it's right:**
- Rootless BuildKit avoids privileged Docker-in-Docker, and the registry cache reuses unchanged layers across runners.
- Images are tagged with the commit SHA, so every build is traceable.
