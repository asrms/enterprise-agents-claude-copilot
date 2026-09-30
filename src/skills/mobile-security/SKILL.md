---
name: mobile-security
description: "Security for cross-platform mobile apps (Flutter and React Native) aligned with OWASP MASVS and MASTG: secure storage via Keychain/Keystore wrappers, no secrets in bundles, TLS and pinning, OAuth with system browser and PKCE, deep link validation, WebView hardening, code obfuscation, app attestation, privacy, and security testing. Use it when implementing or reviewing mobile app security in Flutter or React Native."
---

# Skill: Mobile Security

## Implementation Rules:
- **[MANDATORY]** Use OWASP MASVS as the requirements baseline (storage, crypto, auth, network, platform, code, resilience, privacy) and select the verification level per app risk; track the controls in the security checklist of the project.
- **[MANDATORY]** Store tokens and secrets only through platform-backed secure storage (`flutter_secure_storage`, `expo-secure-store`, `react-native-keychain`), with device-only accessibility on iOS and Keystore-backed encryption on Android; never AsyncStorage, SharedPreferences, MMKV without encryption, or plain files.
- **[FORBIDDEN]** API secrets, signing keys, or privileged credentials in Dart code, the JavaScript bundle, `.env` files bundled with the app, or native resources; anything shipped in the app package can be extracted. Call your own backend, which holds secrets.
- **[SECURITY]** Enforce TLS for all traffic (ATS on iOS, network security config with cleartext disabled on Android), validate certificates normally, and add public-key pinning only with backup pins, expiry, and a rotation plan for high-risk apps.
- **[SECURITY]** Authenticate with OAuth 2.0 Authorization Code + PKCE in the system browser (`flutter_appauth`, `expo-auth-session`, `react-native-app-auth`) or platform passkeys; use short-lived access tokens, refresh token rotation, and server-side revocation on logout.
- **[SECURITY]** Treat deep links, universal/app links, push payloads, and clipboard content as untrusted input: verify app links (associated domains, `assetlinks.json`), parse through one allow-listed router, and never perform sensitive actions without user confirmation.
- **[SECURITY]** Harden WebViews: JavaScript disabled unless needed, allow-listed origins for navigation, no bridges exposed to remote content (`addJavascriptInterface`, `onMessage` handlers validate origin and message schema), and file access disabled.
- **[PATTERN]** Protect sensitive screens from screenshots and app-switcher previews where required, avoid logging personal data or tokens, and exclude sensitive data from backups.
- **[PATTERN]** Obfuscate and minify release builds (Flutter `--obfuscate --split-debug-info`, Hermes bytecode plus R8 on Android) and keep symbol files privately for crash reporting; treat obfuscation as defense in depth, not as protection for secrets.
- **[SECURITY]** For high-value operations, verify app integrity server-side with Play Integrity and App Attest/DeviceCheck; client-side root or jailbreak detection is a signal, never the only control.
- **[MANDATORY]** Keep dependencies and native SDKs updated, review plugin permissions and data collection, and keep privacy declarations (App Privacy details, privacy manifest, Play Data safety) accurate.
- **[TESTING]** Run MASVS-oriented checks before release (MobSF static and dynamic analysis, MASTG test cases for storage and network), test deep link and WebView inputs with malicious payloads, and verify that release builds contain no secrets (secret scanning on the built artifacts).
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
