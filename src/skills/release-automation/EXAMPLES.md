# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Manual release from a laptop
```bash
# edited version in package.json by hand, forgot the changelog
npm version 2.3.0 --no-git-tag-version
npm run build
npm publish                               # uses a personal long-lived token in ~/.npmrc
docker build -t acme/api:latest . && docker push acme/api:latest
git tag v2.3.0 && git push --tags        # tag points at a commit that CI never built
```
**Why it's wrong:**
- The published artifact is not traceable to a CI build and may contain local, uncommitted changes.
- No changelog, signature, SBOM, or provenance; a personal token can leak and publish anything.
- `latest` is overwritten, so consumers cannot pin or roll back reliably.

## Best Practice (How to do it right)

### 1. release-please plus signed, attested publishing
```yaml
name: release
on:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  release-please:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      created: ${{ steps.rp.outputs.release_created }}
      tag: ${{ steps.rp.outputs.tag_name }}
    steps:
      - id: rp
        uses: googleapis/release-please-action@a02a34c4d625f9be7cb89156071d8567266a2445 # v4.2.0
        with:
          release-type: node

  publish:
    needs: release-please
    if: needs.release-please.outputs.created == 'true'
    runs-on: ubuntu-latest
    environment: release
    permissions:
      contents: write
      id-token: write
      packages: write
      attestations: write
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with: { node-version: 22, registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm run build && npm test
      - run: npm publish --provenance --access public       # trusted publishing via OIDC
      - run: npx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json
      - uses: actions/attest-sbom@bd218ad0dbcb3e146bd073d1d9c6d78e08aa8a0b # v2.4.0
        with:
          subject-path: dist/**
          sbom-path: sbom.cdx.json
      - env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ needs.release-please.outputs.tag }}
        run: gh release upload "$TAG" sbom.cdx.json
```
```text
feat(api): add cursor pagination to GET /orders
fix(auth): reject tokens with an unexpected audience
feat!: remove the deprecated /v1/reports endpoint

BREAKING CHANGE: clients must migrate to /v2/reports (see UPGRADING.md)
```
**Why it's right:**
- Conventional Commits drive the version and changelog through a reviewable release pull request.
- Publishing happens only in CI from the tagged commit, with npm provenance via OIDC, an SBOM, and attestations.
- Permissions are elevated only in the publish job, which runs behind a protected environment.
