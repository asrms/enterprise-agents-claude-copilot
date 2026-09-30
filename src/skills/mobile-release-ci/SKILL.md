---
name: mobile-release-ci
description: "CI/CD and releases for Flutter and React Native apps: reproducible builds, code signing for iOS and Android in CI, fastlane or EAS Build and Submit, versioning, store testing tracks and staged rollouts, over-the-air updates with EAS Update or Shorebird within store rules, crash symbolication, and release gates. Use it when setting up or reviewing a cross-platform mobile release pipeline."
---

# Skill: Mobile Release CI

## Implementation Rules:
- **[MANDATORY]** Build release binaries only in CI from tagged commits with pinned toolchains (Flutter SDK version via FVM or the CI setup action, Node/Expo SDK and Xcode/JDK versions), never from developer machines.
- **[MANDATORY]** Generate build numbers in CI (`--build-number` for Flutter, `autoIncrement` or `appVersionSource: remote` in EAS) and derive the marketing version from the release tag, keeping iOS and Android versions aligned.
- **[SECURITY]** Manage signing credentials centrally: fastlane `match` (encrypted, read-only in CI) or EAS-managed credentials for iOS, an upload keystore in the CI secret store with Play App Signing for Android, and App Store Connect API keys and a Play service account with least privilege for submission.
- **[PATTERN]** Use one pipeline per platform with shared steps: static analysis and tests, build (`flutter build ipa`/`appbundle`, or `eas build --profile production`), upload of symbols (dSYMs, Android mapping, Flutter `--split-debug-info` symbols, Hermes source maps), then submission to internal testing tracks (TestFlight, Play internal).
- **[PATTERN]** Promote the same binaries through testing tracks and release to production with phased or staged rollouts, monitoring crash-free users and key metrics with defined halt criteria.
- **[PATTERN]** Use over-the-air updates (EAS Update for React Native, Shorebird for Flutter) only for JavaScript/Dart fixes that comply with App Store and Play policies: no new native code, no change of the app's purpose, channels bound to runtime versions, staged rollout, and fast rollback.
- **[FORBIDDEN]** Keystores, `.p8` keys, `google-services.json` with privileged data, or passwords committed to the repository; debug or profile builds submitted to stores; and OTA updates that bypass review with feature changes.
- **[CONFIGURATION]** Keep environment configuration in build profiles or flavors (`eas.json` profiles, Flutter flavors with `--dart-define-from-file`), with distinct bundle ids and backend URLs per environment and no secrets in the client.
- **[PATTERN]** Automate store metadata and release notes from the repository (fastlane `deliver`/`supply`, EAS Submit), and keep privacy declarations in sync with SDK changes.
- **[PERFORMANCE]** Speed up CI with caching (pub cache, Gradle, CocoaPods, npm), prebuilt dependencies, and macOS runners only for iOS jobs.
- **[TESTING]** Release gates require passing unit, widget/component, and E2E smoke tests on the release candidate, a size and permission diff check against the previous release, and a documented rollback plan (halt rollout, OTA rollback, or expedited hotfix).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
