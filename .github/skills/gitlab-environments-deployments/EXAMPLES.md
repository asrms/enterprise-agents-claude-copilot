# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Rebuilding per environment with untracked deploys
```yaml
deploy_staging:
  script:
    - docker build -t shop/web:staging .          # rebuilt from scratch
    - kubectl --kubeconfig "$ADMIN_KUBECONFIG" apply -f k8s/
  only: [develop]

deploy_prod:
  script:
    - docker build -t shop/web:prod .             # a different image than the one tested in staging
    - kubectl --kubeconfig "$ADMIN_KUBECONFIG" apply -f k8s/
  when: manual                                     # anyone with Developer access can click it
```
**Why it's wrong:**
- Production runs an image that was never tested, and there is no `environment`, so GitLab has no deployment history or rollback target.
- A cluster-admin kubeconfig stored as a variable is available to any job, and concurrent pipelines can deploy over each other.

## Best Practice (How to do it right)

### 1. Build once, promote the same digest
```yaml
stages: [build, test, review, staging, production]

build:
  stage: build
  script:
    - ./ci/build-image.sh "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA"   # writes image digest to image.env
  artifacts:
    reports:
      dotenv: image.env                                         # IMAGE_DIGEST=sha256:...

review:
  stage: review
  script: [./ci/deploy.sh "review-$CI_COMMIT_REF_SLUG" "$IMAGE_DIGEST"]
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    url: https://$CI_COMMIT_REF_SLUG.review.example.com
    on_stop: stop_review
    auto_stop_in: 3 days
    deployment_tier: development
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

stop_review:
  stage: review
  script: [./ci/teardown.sh "review-$CI_COMMIT_REF_SLUG"]
  environment:
    name: review/$CI_COMMIT_REF_SLUG
    action: stop
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
  allow_failure: true

.deploy:
  script:
    - ./ci/deploy.sh "$CI_ENVIRONMENT_NAME" "$IMAGE_DIGEST"
    - ./ci/smoke-test.sh "$CI_ENVIRONMENT_URL"
  interruptible: false
  resource_group: $CI_ENVIRONMENT_NAME

deploy:staging:
  extends: .deploy
  stage: staging
  environment: { name: staging, url: https://staging.example.com, deployment_tier: staging }
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/

deploy:production:
  extends: .deploy
  stage: production
  needs: [build, deploy:staging]
  environment: { name: production, url: https://shop.example.com, deployment_tier: production }
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
      when: manual
  allow_failure: false

release:
  stage: production
  needs: [deploy:production]
  image: registry.gitlab.com/gitlab-org/release-cli:v0.18.0
  script: [echo "Releasing $CI_COMMIT_TAG"]
  release:
    tag_name: $CI_COMMIT_TAG
    description: ./CHANGELOG-latest.md
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
```
**Why it's right:**
- The exact image digest tested in staging is promoted to production, and each deploy is tracked per environment with smoke tests.
- `production` is a protected environment with required approvals, and `resource_group` serializes deployments.
- Review apps are isolated per merge request and stop automatically after three days.
