# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Rebuild per environment, no gates, long-lived keys
```yaml
name: deploy
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t app:latest . && docker push registry.example.com/app:latest
      - run: |
          aws configure set aws_access_key_id ${{ secrets.PROD_AWS_KEY }}
          aws configure set aws_secret_access_key ${{ secrets.PROD_AWS_SECRET }}
          kubectl set image deploy/app app=registry.example.com/app:latest
```
**Why it's wrong:**
- Any push on any branch deploys to production, with no review, smoke test, or rollback path.
- `latest` is mutable, so nobody knows what is running; long-lived production keys live in repository secrets.

## Best Practice (How to do it right)

### 1. Promote one digest through protected environments
```yaml
name: deploy
on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      digest:
        description: Image digest to deploy (for rollback), for example sha256:...
        required: true

permissions:
  contents: read

jobs:
  resolve:
    if: github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    permissions:
      actions: read
    outputs:
      digest: ${{ steps.pick.outputs.digest }}
    steps:
      - if: github.event_name == 'workflow_run'
        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0
        with:
          name: image-digest
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ github.token }}
      - id: pick
        env:
          INPUT_DIGEST: ${{ inputs.digest }}
        run: |
          digest="${INPUT_DIGEST:-$(cat digest.txt)}"
          [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "invalid digest"; exit 1; }
          echo "digest=$digest" >> "$GITHUB_OUTPUT"

  staging:
    needs: resolve
    uses: ./.github/workflows/deploy-env.yml
    with:
      environment: staging
      digest: ${{ needs.resolve.outputs.digest }}
    secrets: inherit

  production:
    needs: [resolve, staging]
    uses: ./.github/workflows/deploy-env.yml
    with:
      environment: production
      digest: ${{ needs.resolve.outputs.digest }}
    secrets: inherit
```
`.github/workflows/deploy-env.yml`:
```yaml
on:
  workflow_call:
    inputs:
      environment: { type: string, required: true }
      digest: { type: string, required: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment:
      name: ${{ inputs.environment }}
      url: https://${{ inputs.environment }}.app.example.com
    concurrency:
      group: deploy-${{ inputs.environment }}
      cancel-in-progress: false
    permissions:
      contents: read
      id-token: write
    env:
      TARGET_ENV: ${{ inputs.environment }}
      IMAGE: ${{ vars.IMAGE_REPO }}@${{ inputs.digest }}
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: aws-actions/configure-aws-credentials@b47578312673ae6fa5b5096b330d9fbac3d116df # v4.2.1
        with:
          role-to-assume: ${{ vars.DEPLOY_ROLE_ARN }}
          aws-region: eu-west-1
      - run: ./scripts/deploy.sh "$IMAGE"
      - run: ./scripts/smoke-test.sh "https://${TARGET_ENV}.app.example.com"
```
**Why it's right:**
- The same validated digest is promoted from staging to production; production waits for the required reviewers configured on the environment.
- Credentials come from OIDC with an environment-scoped role, and deployments are serialized per environment without cancellation.
- Inputs reach scripts only through environment variables, smoke tests gate each stage, and rollback is the same workflow run with a previous digest.
