# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Mutable base image and unverified downloads (Python)
```dockerfile
FROM python:latest
LABEL maintainer="data-team"
ENV PYTHONUNBUFFERED=1
RUN curl -sSL https://install.python-poetry.org | python3 -
ADD https://github.com/krallin/tini/releases/latest/download/tini /tini
RUN chmod +x /tini
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN /root/.local/bin/poetry config virtualenvs.create false \
 && /root/.local/bin/poetry install --no-root --only main
# internal library published on our index, everything else from PyPI
RUN pip install --extra-index-url https://pypi.internal.example.com/simple acme-etl-commons
COPY . .
ENTRYPOINT ["/tini", "--"]
CMD ["python", "-m", "etl.main"]
```
**Why it's wrong:**
- `python:latest` changes on every pull: two builds of the same commit produce images with different packages and CVEs.
- `curl | sh` and `releases/latest` execute unverified remote code, which can change or be compromised.
- `--extra-index-url` lets a public package with the same name and a higher version replace the internal library (dependency confusion).
- No OCI labels: impossible to trace back to repository, commit, and version during an incident.

### 2. Release pipeline without security gates
```bash
#!/usr/bin/env bash
# release.sh run by the pipeline on every push to main
set -e
IMAGE=registry.example.com/data/etl-orders
TAG=$(git rev-parse --short HEAD)

docker login registry.example.com -u ci-bot -p "$REGISTRY_PASSWORD"
docker build -t $IMAGE:$TAG -t $IMAGE:latest .
docker push $IMAGE:$TAG
docker push $IMAGE:latest

# the scan is informational only, it must not block the release
trivy image $IMAGE:latest || true

# private key versioned in the repository
COSIGN_PASSWORD=changeit cosign sign --key ./ci/cosign.key $IMAGE:latest
echo "Release completed: $IMAGE:latest"
```
**Why it's wrong:**
- No lint, SBOM, or provenance; the scan with `|| true` never blocks critical vulnerabilities.
- The signature is applied to the mutable `latest` tag, not the digest: the tag can point to another image after signing.
- A private key and password in the repository nullify the value of the signature; `docker login -p` exposes the credential in `ps` and in logs.

### 3. Deploy without signature and provenance verification
```bash
#!/usr/bin/env bash
# deploy.sh <tag>, launched by hand or by the pipeline
set -e
NAMESPACE=data
TAG=${1:-latest}
IMAGE=registry.example.com/data/etl-orders

# if the internal registry does not respond, fall back to the public image
if ! docker pull "$IMAGE:$TAG"; then
  IMAGE=docker.io/acmedata/etl-orders
fi

kubectl -n $NAMESPACE set image deployment/etl-orders etl-orders=$IMAGE:$TAG
kubectl -n $NAMESPACE rollout status deployment/etl-orders
echo "deploy of $IMAGE:$TAG completed"
```
**Why it's wrong:**
- Deploy by tag: nodes may run content different from what was tested if the tag is moved.
- No verification of signature, signer identity, or provenance before the rollout.
- The fallback to Docker Hub bypasses the private registry and allows uncontrolled third-party images to run.

## Best Practice (How to do it right)

### 1. Mutable base image and unverified downloads (Python)
```dockerfile
# syntax=docker/dockerfile:1
# check=error=true
# base from the internal proxy cache, pinned by digest: replace <digest> with the actual digest of the multi-arch index
ARG BASE_IMAGE=registry.example.com/dockerhub/library/python:3.12.7-slim-bookworm@sha256:<digest>

FROM ${BASE_IMAGE} AS builder
# the only allowed index: the internal PyPI proxy (no --extra-index-url)
ENV PIP_INDEX_URL=https://nexus.example.com/repository/pypi-group/simple \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"
# requirements.lock generated with pip-compile --generate-hashes
COPY requirements.lock /tmp/requirements.lock
RUN pip install --no-cache-dir --require-hashes -r /tmp/requirements.lock

FROM ${BASE_IMAGE} AS runtime
ARG VERSION
ARG REVISION
ARG CREATED
LABEL org.opencontainers.image.title="etl-orders" \
      org.opencontainers.image.description="Order ETL pipeline" \
      org.opencontainers.image.source="https://github.com/acme/etl-orders" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Acme S.p.A." \
      org.opencontainers.image.base.name="registry.example.com/dockerhub/library/python:3.12.7-slim-bookworm"
# binary from the internal artifact repository (linux/amd64-only image), verified by checksum:
# replace <digest> with the SHA-256 published in tini-static-amd64.sha256sum of release v0.19.0
ADD --checksum=sha256:<digest> --chmod=755 \
    https://artifacts.example.com/generic/tini/v0.19.0/tini-static-amd64 /usr/local/bin/tini
COPY --from=builder /opt/venv /opt/venv
COPY etl/ /app/etl/
ENV PATH="/opt/venv/bin:${PATH}" PYTHONUNBUFFERED=1
WORKDIR /app
USER 10001:10001
ENTRYPOINT ["/usr/local/bin/tini", "--"]
CMD ["python", "-m", "etl.main"]
```
**Why it's right:**
- Immutable base by digest from the internal registry, updated via Renovate PRs rather than a random pull.
- A single internal PyPI index and `--require-hashes` prevent dependency confusion and tampered packages.
- The external binary is pinned by version and verified with `ADD --checksum`; OCI labels link the image to repository, commit, and version.

### 2. Release pipeline without security gates
```bash
#!/usr/bin/env bash
# release.sh: GitHub Actions job on tag vX.Y.Z with permissions id-token: write
set -euo pipefail

IMAGE="registry.example.com/data/etl-orders"
VERSION="${GITHUB_REF_NAME:?release allowed only from a tag}"
REVISION="$(git rev-parse HEAD)"
export SOURCE_DATE_EPOCH="$(git log -1 --pretty=%ct)"
CREATED="$(date -u -d "@${SOURCE_DATE_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)"

# 1. Dockerfile lint (threshold and trusted registries in .hadolint.yaml)
hadolint Dockerfile

# 2. build with SBOM and SLSA provenance attached, push, and digest in metadata.json
printf '%s' "${REGISTRY_TOKEN}" | docker login registry.example.com -u ci-bot --password-stdin
docker buildx build --platform linux/amd64 --target runtime \
  --build-arg VERSION="${VERSION}" --build-arg REVISION="${REVISION}" \
  --build-arg CREATED="${CREATED}" --build-arg SOURCE_DATE_EPOCH \
  --sbom=true --provenance=mode=max \
  --tag "${IMAGE}:${VERSION}" --push --metadata-file metadata.json .
REF="${IMAGE}@$(jq -r '."containerimage.digest"' metadata.json)"

# 3. gate: HIGH/CRITICAL vulnerabilities with an available fix, or secrets, block the release
trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed \
  --scanners vuln,secret --ignorefile .trivyignore "${REF}"

# 4. SBOM as a release artifact
syft "${REF}" -o spdx-json=sbom.spdx.json

# 5. keyless signature and SBOM attestation on the digest, never on the tag
cosign sign --yes "${REF}"
cosign attest --yes --type spdxjson --predicate sbom.spdx.json "${REF}"
echo "Released and signed: ${REF}"
```
**Why it's right:**
- Gates run in sequence and are blocking: an image that fails Trivy is not signed and the admission policy rejects it.
- SBOM, `mode=max` provenance, and commit-derived labels make the artifact traceable; no secret passes through build args.
- The keyless signature uses the workflow's OIDC identity and is applied to the digest; the login uses `--password-stdin`.

### 3. Deploy without signature and provenance verification
```bash
#!/usr/bin/env bash
# deploy.sh <version>: promotes to Kubernetes only images signed by the release pipeline
set -euo pipefail

NAMESPACE="data"
IMAGE="registry.example.com/data/etl-orders"
VERSION="${1:?usage: deploy.sh <vX.Y.Z>}"
IDENTITY="https://github.com/acme/etl-orders/.github/workflows/release.yml@refs/tags/${VERSION}"
ISSUER="https://token.actions.githubusercontent.com"

# the tag is resolved only once: from here on, only the digest is used
DIGEST="$(docker buildx imagetools inspect "${IMAGE}:${VERSION}" --format '{{json .Manifest}}' | jq -r '.digest')"
REF="${IMAGE}@${DIGEST}"

# signature and SBOM attestation must come from this repository's release workflow
cosign verify --certificate-identity "${IDENTITY}" --certificate-oidc-issuer "${ISSUER}" "${REF}" >/dev/null
cosign verify-attestation --type spdxjson \
  --certificate-identity "${IDENTITY}" --certificate-oidc-issuer "${ISSUER}" "${REF}" >/dev/null

# the SLSA provenance generated by BuildKit must be present in the index
docker buildx imagetools inspect "${REF}" --format '{{json .Provenance}}' \
  | jq -e '[.. | objects | select(has("SLSA"))] | length > 0' >/dev/null

kubectl -n "${NAMESPACE}" set image deployment/etl-orders etl-orders="${REF}"
kubectl -n "${NAMESPACE}" rollout status deployment/etl-orders --timeout=180s
echo "Verified deploy: ${REF}"
```
**Why it's right:**
- The deploy happens by digest, resolved only once, and only from the private registry.
- Signature, workflow identity, OIDC issuer, and SBOM attestation are verified before the rollout; `set -euo pipefail` stops at the first error.
- The presence of SLSA provenance is checked explicitly, consistent with the cluster's admission policy.
