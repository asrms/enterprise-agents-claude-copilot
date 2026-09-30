# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Static keys and a wildcard trust policy
```yaml
- run: aws s3 sync dist s3://prod-site
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}         # never rotated
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```
```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": { "StringLike": { "token.actions.githubusercontent.com:sub": "repo:acme/*" } }
}
```
**Why it's wrong:**
- Long-lived keys can leak and remain valid for years.
- The trust policy lets any repository and branch in the organization, including forks' pull request workflows in some setups, assume the role.

## Best Practice (How to do it right)

### 1. AWS role restricted to one repository and environment
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:acme/web-app:environment:production"
      }
    }
  }]
}
```
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: aws-actions/configure-aws-credentials@b47578312673ae6fa5b5096b330d9fbac3d116df # v4.2.1
        with:
          role-to-assume: arn:aws:iam::111122223333:role/web-app-prod-deploy
          role-session-name: gha-${{ github.run_id }}
          role-duration-seconds: 900
          aws-region: eu-west-1
      - run: aws s3 sync dist s3://prod-site --delete
```
### 2. Azure and GCP equivalents
```yaml
- uses: azure/login@a457da9ea143d694b1b9c7c869ebb04ebe844ef5 # v2.3.0
  with:
    client-id: ${{ vars.AZURE_CLIENT_ID }}        # app registration with a federated credential
    tenant-id: ${{ vars.AZURE_TENANT_ID }}        # subject: repo:acme/web-app:environment:production
    subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

- uses: google-github-actions/auth@ba79af03959ebeac9769e648f473a284504d9193 # v2.1.10
  with:
    workload_identity_provider: projects/123456/locations/global/workloadIdentityPools/github/providers/acme
    service_account: web-app-deployer@acme-prod.iam.gserviceaccount.com
```
**Why it's right:**
- No stored cloud secrets: each run receives short-lived credentials bound to its identity.
- Only production-environment jobs of one repository can assume the production role, and sessions are short and traceable.
