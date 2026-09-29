---
name: release-automation
description: "Automated, traceable releases: Conventional Commits, semantic versioning, changelog generation with release-please or semantic-release, tagged GitHub Releases, signed artifacts and container images, SBOMs, provenance attestations, and publishing to package registries. Use it when setting up or reviewing a release process."
---

# Skill: Release Automation

## Implementation Rules:
- **[MANDATORY]** Versions follow Semantic Versioning (MAJOR for breaking changes, MINOR for features, PATCH for fixes) and are derived from the commit history, not edited by hand; pre-releases use SemVer suffixes (`2.0.0-rc.1`).
- **[MANDATORY]** Commits or pull request titles follow Conventional Commits (`feat:`, `fix:`, `feat!:` or a `BREAKING CHANGE:` footer), enforced in CI (commitlint or a pull request title check), so versions and changelogs can be generated reliably.
- **[PATTERN]** Automate with a release-pull-request tool (release-please) that proposes the version bump and changelog for review, or with semantic-release for fully automated publishing from the main branch; monorepos use per-package configuration.
- **[MANDATORY]** Releases are built once from the tagged commit by CI, never from a developer machine; the same artifact that passed the pipeline is the one published.
- **[SECURITY]** Sign release artifacts and container images (Sigstore cosign keyless, npm provenance with `--provenance`, PyPI Trusted Publishing, Maven GPG signatures) and attach build provenance attestations; consumers can verify them.
- **[PATTERN]** Generate a Software Bill of Materials (CycloneDX or SPDX with Syft or native build plugins) for each release and publish it alongside the artifacts or as an attestation.
- **[PATTERN]** Container images are tagged with the full version, major and minor aliases (`1.4.2`, `1.4`, `1`), and the commit SHA; deployments reference the immutable digest, and `latest` is never used for deployment.
- **[PATTERN]** Publish to registries with OIDC-based trusted publishing where supported (npm, PyPI, crates.io, RubyGems) instead of long-lived tokens; remaining tokens are scoped, stored as environment secrets, and rotated.
- **[PATTERN]** GitHub Releases include the generated changelog, upgrade notes for breaking changes, checksums (`SHA256SUMS`), signatures, and SBOMs; release tags are protected by rulesets and immutable releases are enabled where available.
- **[FORBIDDEN]** Manual version edits scattered across files, re-using or moving published tags, publishing from unreviewed branches, and releases without a changelog entry for user-visible changes.
- **[TESTING]** The release workflow is tested with dry runs or pre-release channels, verifies signatures and checksums after publishing, and runs smoke tests of the published package or image.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
