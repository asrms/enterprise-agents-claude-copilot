---
name: container-supply-chain-security
description: "Image supply chain security: base images pinned by digest, Hadolint, Trivy, Docker Scout, SBOM with Syft or buildx, SLSA provenance, keyless Cosign signing and verification, OCI labels, and automated updates. Use it for image build, release, and deploy pipelines."
---

# Skill: Container Supply Chain Security

## Implementation Rules:
- **[MANDATORY]** Reference every base image with a version tag and the digest of the multi-arch index (`FROM registry.example.com/dockerhub/library/python:3.12.7-slim-bookworm@sha256:<digest>`), obtained with `docker buildx imagetools inspect <image>:<tag>`; the tag stays for readability, the digest guarantees immutability.
- **[SECURITY]** The private registry (Harbor, Artifactory, Nexus, or ECR/ACR/Artifact Registry with pull-through cache) is the only source of images and packages: direct `FROM` from Docker Hub or unofficial namespaces and additional indexes such as `pip --extra-index-url`, which expose you to dependency confusion, are forbidden.
- **[CONFIGURATION]** Version a `.hadolint.yaml` with `failure-threshold: warning`, `trustedRegistries` limited to the internal registry, and `ignored` only for justified rules; run `hadolint Dockerfile` (or `docker run --rm -i hadolint/hadolint < Dockerfile`) as the first gate of the pipeline.
- **[FORBIDDEN]** `curl -sSL https://install.example.com | sh`, `ADD <url>` without `--checksum=sha256:<digest>`, downloads from `releases/latest`, and unverified installers: every external artifact is pinned by version and verified via checksum or signature.
- **[MANDATORY]** Scan every image by digest with `trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed <image>@sha256:<digest>`: the pipeline stops on high or critical vulnerabilities with an available fix.
- **[CONFIGURATION]** Exceptions live in a versioned `.trivyignore`, one CVE per line with a justification comment and expiry (`CVE-2024-45337 exp:2026-12-31`) and mandatory review; `|| true` on the scan step is forbidden.
- **[PERFORMANCE]** Use internal mirrors of the Trivy database (`--db-repository` and `--java-db-repository` pointing to the corporate registry) with a persistent `--cache-dir`, and re-scan production images daily, because new CVEs emerge after release.
- **[PATTERN]** Use Docker Scout for triage and remediation: `docker scout cves --only-severity critical,high --only-fixed --exit-code <image>` as an additional check and `docker scout recommendations <image>` to find updated base images.
- **[MANDATORY]** Generate the SBOM for every release with `docker buildx build --sbom=true` (SPDX attestation attached to the index) and/or `syft <image>@sha256:<digest> -o spdx-json=sbom.spdx.json` (or `cyclonedx-json`), archived as a release artifact.
- **[MANDATORY]** Attach SLSA provenance with `--provenance=mode=max`; since `mode=max` records build arguments, no secret may pass through `--build-arg`.
- **[CONFIGURATION]** Attestations require `--push` or an OCI exporter (with the classic image store, `--load` discards them); verify they are present with `docker buildx imagetools inspect <image> --format '{{ json .SBOM }}'` and `--format '{{ json .Provenance }}'`.
- **[MANDATORY]** Always sign by digest, never by tag: `cosign sign --yes <image>@sha256:<digest>` in keyless mode with the pipeline's OIDC identity (on GitHub Actions `permissions: id-token: write`); for air-gapped environments or confidential names use KMS keys (`--key awskms://`, `azurekms://`, `hashivault://`) or a private Sigstore instance.
- **[PATTERN]** Also publish the SBOM as a signed attestation with `cosign attest --yes --type spdxjson --predicate sbom.spdx.json <image>@sha256:<digest>`, verifiable with `cosign verify-attestation --type spdxjson`.
- **[SECURITY]** Before deploying, verify the signature and the signer's identity with `cosign verify --certificate-identity <workflow-ref> --certificate-oidc-issuer https://token.actions.githubusercontent.com <image>@sha256:<digest>`; in the cluster enforce verification with an admission controller (Sigstore policy-controller or Kyverno) and deploy only by digest.
- **[MANDATORY]** Apply the OCI labels `org.opencontainers.image.source`, `.revision`, `.version`, `.created`, `.title`, `.description`, `.licenses`, `.vendor`, `.base.name`, and `.base.digest`, populated from CI build args, with `created` derived from `SOURCE_DATE_EPOCH` so as not to compromise reproducibility.
- **[CONFIGURATION]** Automate base image updates with Renovate (the `docker:pinDigests` preset, which updates tag and digest via PR) or with Dependabot (`package-ecosystem: "docker"`, `schedule.interval: "weekly"`); every PR goes through the same lint, test, and scan pipeline.
- **[SECURITY]** Pin the security toolchain too: explicit versions of `hadolint`, `trivy`, `syft`, and `cosign`, tool images by digest, and GitHub Actions referenced by full commit SHA, not by a mutable tag.
- **[TESTING]** Gate order: `hadolint`, `docker buildx build --target test`, runtime build with SBOM and provenance and push by digest, `trivy image`, `cosign sign` and `cosign attest`, `cosign verify` at deploy; a failed gate stops the pipeline and an unsigned image cannot be deployed.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
