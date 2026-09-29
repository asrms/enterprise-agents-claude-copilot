---
name: android-security
description: "Security for Android apps aligned with OWASP MASVS: Android Keystore and encrypted storage, network security configuration and TLS, safe exported components and intents, WebView hardening, authentication with Credential Manager and AppAuth, Play Integrity, R8 obfuscation, runtime permissions, and secrets management. Use it when implementing or reviewing Android app security."
---

# Skill: Android Security

## Implementation Rules:
- **[MANDATORY]** Keep cryptographic keys in the Android Keystore (hardware-backed, StrongBox where available) and never export them; encrypt sensitive local data with keys from the Keystore (for example Tink with an Android Keystore master key), and store tokens only in encrypted storage, never in plain `SharedPreferences` or files.
- **[MANDATORY]** Enforce TLS with a Network Security Configuration: `cleartextTrafficPermitted="false"` for all domains, no user-added CAs trusted in release builds, and optional certificate pinning (`<pin-set>` with a backup pin and expiration) for high-risk apps.
- **[SECURITY]** Minimize the attack surface of components: set `android:exported="false"` unless external access is required, protect exported components with signature-level permissions, validate every incoming `Intent` extra and deep link parameter, and use explicit intents and `PendingIntent.FLAG_IMMUTABLE`.
- **[SECURITY]** Harden WebViews: disable JavaScript unless needed, never expose `addJavascriptInterface` to untrusted content, restrict navigation to allow-listed origins with `WebViewClient.shouldOverrideUrlLoading`, disable file access (`allowFileAccess = false`), and load local content through `WebViewAssetLoader`.
- **[SECURITY]** Authenticate with Credential Manager (passkeys, passwords, Sign in with Google) or OAuth 2.0 Authorization Code + PKCE via AppAuth using Custom Tabs; never collect third-party credentials in a WebView.
- **[FORBIDDEN]** API secrets or private keys in source, `BuildConfig`, resources, or `local.properties` shipped in the APK (everything in the package is extractable), logging personal data or tokens, `MODE_WORLD_READABLE` files, and `android:debuggable` or `usesCleartextTraffic` in release builds.
- **[SECURITY]** Protect sensitive screens with `FLAG_SECURE`, disable backup of sensitive data (`android:dataExtractionRules`/`fullBackupContent` excludes), and use `BiometricPrompt` with a `CryptoObject` so biometric authentication unlocks a Keystore key rather than returning a boolean.
- **[PATTERN]** Verify app and device integrity on the server with the Play Integrity API for sensitive operations; treat client-side checks (root detection) as signals, not guarantees.
- **[CONFIGURATION]** Enable R8 minification and resource shrinking for release (`isMinifyEnabled = true`, `isShrinkResources = true`) with reviewed keep rules, and upload the mapping file to the crash reporter.
- **[PATTERN]** Request runtime permissions only when needed and in context, prefer privacy-preserving APIs (Photo Picker instead of storage permissions, approximate location), and declare data collection accurately in the Play Console Data safety form.
- **[TESTING]** Test exported components and deep links with malicious inputs, verify that release builds reject cleartext and user CAs, run lint security checks and MobSF or similar MASVS-oriented scans before release, and keep dependencies updated with an SCA tool.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
