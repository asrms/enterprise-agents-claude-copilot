# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Static keys, echoed secrets, and deploys from any branch
```yaml
variables:
  AWS_ACCESS_KEY_ID: AKIAEXAMPLEKEY123456        # static long-lived key committed to the repository
  AWS_SECRET_ACCESS_KEY: wJalrXUtnFEMI/EXAMPLEKEY

deploy:
  image: amazon/aws-cli:latest                    # mutable image
  script:
    - echo "Using key $AWS_SECRET_ACCESS_KEY"     # secret written to the job log
    - curl -s https://get.example.com/tool.sh | bash
    - aws s3 sync dist/ s3://shop-web-prod/
  # no rules: runs on every branch, including forks and feature branches
```
**Why it's wrong:**
- Long-lived keys in YAML are exposed to everyone with repository read access and to every pipeline.
- The secret is printed in the log, the installer is unverified, and the image can change without notice.
- Any branch can deploy to production, so protected branches and approvals give no protection.

## Best Practice (How to do it right)

### 1. Keyless AWS deployment with OIDC from a protected tag
```yaml
deploy:production:
  stage: deploy
  image: amazon/aws-cli:2.27.50
  environment:
    name: production
    url: https://shop.example.com
  resource_group: production
  id_tokens:
    AWS_ID_TOKEN:
      aud: sts.amazonaws.com
  script:
    - >
      export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s"
      $(aws sts assume-role-with-web-identity
      --role-arn "$AWS_DEPLOY_ROLE_ARN"
      --role-session-name "gitlab-${CI_PROJECT_ID}-${CI_PIPELINE_ID}"
      --web-identity-token "$AWS_ID_TOKEN"
      --duration-seconds 900
      --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]'
      --output text))
    - aws s3 sync dist/ "s3://shop-web-prod/" --delete
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
```
IAM role trust policy condition (the tag pattern and project are enforced by the cloud, not only by YAML):
```json
{
  "Condition": {
    "StringEquals": { "gitlab.example.com:aud": "sts.amazonaws.com" },
    "StringLike": { "gitlab.example.com:sub": "project_path:shop/web:ref_type:tag:ref:v*" }
  }
}
```
**Why it's right:**
- No stored cloud keys: credentials last 15 minutes and are bound to this project and to release tags.
- `v*` tags are protected in project settings, and the `production` environment is protected with required approvals.
- `resource_group` serializes deployments, and the image is pinned.

### 2. Runtime secrets from Vault with an ID token
```yaml
migrate:production:
  stage: deploy
  image: registry.example.com/shop/migrator:1.8.2
  environment:
    name: production
    action: prepare
  id_tokens:
    VAULT_ID_TOKEN:
      aud: https://vault.example.com
  secrets:
    DATABASE_URL:
      vault: shop/production/database/url@secrets
      token: $VAULT_ID_TOKEN
      file: false
  script:
    - migrate --database-url-env DATABASE_URL up
  rules:
    - if: $CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/
```
**Why it's right:**
- The Vault JWT role checks `project_path`, `ref_protected`, and `environment` claims, so only protected production jobs can read the secret.
- The secret exists only for the job's lifetime, is not stored as a CI/CD variable, and is never written to artifacts.
