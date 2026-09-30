# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Local builds and committed credentials
```text
android/app/upload-keystore.jks          # committed
android/key.properties                   # storePassword=android123
ios/AuthKey_ABC123.p8                    # App Store Connect key in the repository
release: run `flutter build appbundle` on a laptop, upload by hand, 100% rollout
OTA: push new checkout feature via over-the-air update without review
```
**Why it's wrong:**
- Signing keys and API keys are exposed to everyone with repository access.
- Builds are not reproducible, rollouts are all-or-nothing, and OTA is used to bypass store review.

## Best Practice (How to do it right)

### 1. EAS build profiles and submission (React Native)
`eas.json`:
```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "preview": { "distribution": "internal", "channel": "preview", "env": { "APP_VARIANT": "preview" } },
    "production": { "channel": "production", "autoIncrement": true, "env": { "APP_VARIANT": "production" } }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "1234567890" },
      "android": { "track": "internal", "releaseStatus": "completed" }
    }
  }
}
```
```bash
eas build --platform all --profile production --non-interactive
eas submit --platform all --profile production --latest --non-interactive
# JS-only fix after release, staged to 10% of the production channel
eas update --channel production --message "Fix price rounding" --rollout-percentage 10
```
### 2. Flutter release job with fastlane
```bash
flutter build appbundle --release --build-number="$CI_BUILD_NUMBER" \
  --obfuscate --split-debug-info=build/symbols --dart-define-from-file=config/production.json
flutter build ipa --release --build-number="$CI_BUILD_NUMBER" \
  --obfuscate --split-debug-info=build/symbols --export-options-plist=ios/ExportOptions.plist
bundle exec fastlane android internal      # supply to the internal track with the CI service account
bundle exec fastlane ios beta              # match (readonly) + upload_to_testflight with an API key
```
**Why it's right:**
- Credentials are managed by EAS or fastlane match and CI secrets; build numbers come from CI.
- Builds are obfuscated with symbols kept for crash reporting, and binaries flow through internal tracks before production.
- Over-the-air updates are limited to JavaScript fixes on a channel with a staged rollout.
