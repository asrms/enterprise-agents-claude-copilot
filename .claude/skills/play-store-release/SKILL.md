---
name: play-store-release
description: "Releasing Android apps on Google Play: versionCode and versionName strategy, Android App Bundles, Play App Signing and upload keys, CI builds and uploads with Gradle Play Publisher or fastlane supply, testing tracks, staged rollouts with halt criteria, Data safety and target API requirements, in-app updates, and monitoring Android vitals. Use it when setting up or reviewing an Android release pipeline."
---

# Skill: Play Store Release

## Implementation Rules:
- **[MANDATORY]** Generate `versionCode` in CI (monotonically increasing, for example from the build number) and derive `versionName` from the release tag; never edit them by hand, and make every build traceable to a commit.
- **[MANDATORY]** Publish Android App Bundles (`./gradlew bundleRelease`) built only by CI from a tagged commit, with R8 enabled and the mapping file and native debug symbols uploaded for crash deobfuscation.
- **[SECURITY]** Use Play App Signing: Google holds the app signing key, the team signs uploads with a separate upload key stored in the CI secret store (or a KMS/HSM-backed signer), with a documented reset procedure; keystores and passwords are never committed.
- **[SECURITY]** Authenticate CI to the Play Developer API with a dedicated service account with least privilege (release manager on the specific app), preferably via workload identity federation instead of a JSON key; rotate any key that must exist.
- **[PATTERN]** Promote through testing tracks: internal testing on every main-branch build, closed testing for release candidates, then production; promote the same bundle rather than rebuilding.
- **[PATTERN]** Roll out production updates in stages (for example 1%, 5%, 20%, 50%, 100%) with explicit halt criteria on crash rate, ANR rate, and key business metrics from Android vitals and your crash reporter; halt the rollout (`inAppUpdatePriority`, `userFraction`, halt via API) instead of shipping blind.
- **[MANDATORY]** Keep policy compliance current: target the required API level before the Play deadline, keep the Data safety form accurate for all SDKs, declare sensitive permissions with justification, and review app content declarations each release.
- **[PATTERN]** Use the Play In-App Updates API for critical fixes (immediate flow) or recommended updates (flexible flow), and a server-driven minimum supported version for retiring incompatible versions.
- **[FORBIDDEN]** Uploading debuggable or unminified builds, reusing or decreasing `versionCode`, releasing directly to 100% of production, and shipping test endpoints or verbose logging in release variants.
- **[PATTERN]** Automate store metadata (release notes per locale, screenshots) from the repository with Gradle Play Publisher or fastlane `supply`, reviewed in pull requests.
- **[TESTING]** The release pipeline runs unit, UI, and screenshot tests, lint, and a pre-launch report or Firebase Test Lab smoke test on the bundle before promotion, and checks that the uploaded bundle's size and permissions did not change unexpectedly.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
