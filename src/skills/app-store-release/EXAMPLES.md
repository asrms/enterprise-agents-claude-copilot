# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Manual release from a laptop
```text
1. Bump build number by hand in Xcode (forgot: rejected as duplicate)
2. Product > Archive with a personal development certificate
3. Upload from Organizer with a personal Apple ID
4. Release to 100% of users immediately
5. dSYMs never uploaded: crash reports are unreadable
```
**Why it's wrong:**
- Builds are not reproducible or traceable; signing depends on one person's machine and account.
- A bad release reaches every user at once, and crashes cannot be symbolicated.

## Best Practice (How to do it right)

### 1. fastlane lane run by CI with an App Store Connect API key
`fastlane/Fastfile`:
```ruby
default_platform(:ios)

platform :ios do
  lane :beta do
    api_key = app_store_connect_api_key(
      key_id: ENV.fetch("ASC_KEY_ID"),
      issuer_id: ENV.fetch("ASC_ISSUER_ID"),
      key_content: ENV.fetch("ASC_KEY_P8"),
    )
    setup_ci
    match(type: "appstore", readonly: true, api_key: api_key)
    increment_build_number(build_number: ENV.fetch("CI_BUILD_NUMBER"))
    run_tests(scheme: "Shop", testplan: "CI")
    build_app(scheme: "Shop", configuration: "Release", export_method: "app-store")
    upload_to_testflight(api_key: api_key, groups: ["Internal QA"], changelog: File.read("../RELEASE_NOTES.md"))
    upload_symbols_to_crashlytics(dsym_path: lane_context[SharedValues::DSYM_OUTPUT_PATH])
  end

  lane :release do
    api_key = app_store_connect_api_key(
      key_id: ENV.fetch("ASC_KEY_ID"), issuer_id: ENV.fetch("ASC_ISSUER_ID"), key_content: ENV.fetch("ASC_KEY_P8"),
    )
    deliver(
      api_key: api_key,
      build_number: ENV.fetch("CI_BUILD_NUMBER"),
      submit_for_review: true,
      automatic_release: false,
      phased_release: true,
      skip_screenshots: true,
      precheck_include_in_app_purchases: false,
    )
  end
end
```
`Info.plist` (excerpt):
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
<key>NSCameraUsageDescription</key>
<string>The camera is used to scan product barcodes.</string>
```
**Why it's right:**
- CI signs with read-only certificates from `match` and authenticates with an API key stored as a secret.
- Build numbers come from CI, tests run before upload, TestFlight gets every candidate, and dSYMs are uploaded.
- The App Store release uses phased rollout and manual release after approval, so regressions can be caught early.
