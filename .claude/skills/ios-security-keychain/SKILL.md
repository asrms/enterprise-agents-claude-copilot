---
name: ios-security-keychain
description: "Security for iOS apps aligned with OWASP MASVS: Keychain storage with correct accessibility classes, biometric protection with LocalAuthentication and access control, data protection, App Transport Security and certificate pinning trade-offs, Sign in with Apple and OAuth via ASWebAuthenticationSession, CryptoKit, privacy manifests, and avoiding secrets in the binary. Use it when implementing or reviewing iOS app security."
---

# Skill: iOS Security and Keychain

## Implementation Rules:
- **[MANDATORY]** Store credentials, tokens, and keys only in the Keychain (`SecItemAdd`/`SecItemCopyMatching` or a thin maintained wrapper), never in `UserDefaults`, plist files, Core Data/SwiftData, or logs.
- **[MANDATORY]** Choose the strictest workable accessibility class: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for most secrets, `AfterFirstUnlockThisDeviceOnly` only when background access is required; `ThisDeviceOnly` variants keep secrets out of backups and device migrations.
- **[SECURITY]** Protect high-value secrets with `SecAccessControlCreateWithFlags` (`.biometryCurrentSet` or `.userPresence`) so the Keychain itself enforces biometric or passcode checks; a plain `LAContext.evaluatePolicy` boolean is not a security boundary.
- **[SECURITY]** Use the Secure Enclave for private keys that never need to leave the device (`SecureEnclave.P256.Signing.PrivateKey` in CryptoKit) and CryptoKit primitives (AES-GCM, ChaChaPoly, HKDF, P256) instead of custom cryptography or CommonCrypto.
- **[MANDATORY]** Keep App Transport Security enabled with no `NSAllowsArbitraryLoads`; exceptions are per-domain, justified, and reviewed. Consider certificate or public-key pinning (`NSPinnedDomains` or URLSession delegate validation) for high-risk apps, with a backup pin and a rotation plan.
- **[SECURITY]** Authenticate users with Sign in with Apple or OAuth 2.0 Authorization Code + PKCE through `ASWebAuthenticationSession` (never embedded web views for login), with short-lived access tokens and refresh tokens in the Keychain.
- **[FORBIDDEN]** API secrets, private keys, or signing credentials embedded in the app bundle or source (everything in the binary can be extracted), sensitive data in logs (`os_log` with `.public` on personal data), and disabling ATS globally.
- **[SECURITY]** Apply file Data Protection (`.completeFileProtection` or `NSFileProtectionComplete` entitlement) to files with personal data, exclude sensitive caches from backups, and hide sensitive screens in the app switcher snapshot.
- **[PATTERN]** Validate all input from deep links, universal links, pasteboard, and push payloads as untrusted; route them through a single parser with allow-listed paths and parameters.
- **[MANDATORY]** Maintain the privacy manifest (`PrivacyInfo.xcprivacy`) for required-reason APIs and collected data, request only necessary permissions with clear usage descriptions, and keep third-party SDKs' manifests and signatures current.
- **[TESTING]** Test security behavior: Keychain wrapper round-trips and access-control flags, token refresh and logout clearing all secrets, deep link validation, and run MASVS-oriented checks (for example with MobSF) before release.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
