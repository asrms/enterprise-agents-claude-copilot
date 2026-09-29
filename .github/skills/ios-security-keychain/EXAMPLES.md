# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tokens in UserDefaults, biometric check as a boolean, ATS disabled
```swift
UserDefaults.standard.set(accessToken, forKey: "token")            // plain text, included in backups

func unlock(completion: @escaping (Bool) -> Void) {
    LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                               localizedReason: "Unlock") { ok, _ in
        completion(ok)                                             // a patched binary can return true
    }
}

let apiKey = "sk_live_51H..."                                      // secret shipped in the binary
```
```xml
<key>NSAppTransportSecurity</key>
<dict><key>NSAllowsArbitraryLoads</key><true/></dict>
```
**Why it's wrong:**
- Tokens are readable from device backups and by anyone with file system access.
- The biometric result is just a boolean in app memory, not tied to any protected secret.
- A live API key is extractable from the app, and cleartext HTTP is allowed everywhere.

## Best Practice (How to do it right)

### 1. Keychain item protected by biometry
```swift
enum KeychainError: Error { case unexpectedStatus(OSStatus) }

struct TokenStore {
    private let service = "com.example.shop.auth"

    func saveRefreshToken(_ token: String) throws {
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .biometryCurrentSet, &error
        ) else { throw error!.takeRetainedValue() as Error }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "refresh-token",
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = Data(token.utf8)
        attributes[kSecAttrAccessControl as String] = access
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else { throw KeychainError.unexpectedStatus(status) }
    }

    func readRefreshToken(context: LAContext) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "refresh-token",
            kSecReturnData as String: true,
            kSecUseAuthenticationContext as String: context,       // biometric prompt enforced by the Keychain
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw KeychainError.unexpectedStatus(status) }
        return String(decoding: data, as: UTF8.self)
    }
}
```
### 2. OAuth login with the system browser session
```swift
let session = ASWebAuthenticationSession(url: authorizeURL(withPKCE: challenge),
                                         callback: .customScheme("com.example.shop")) { callbackURL, error in
    // validate `state`, then exchange the code (plus verifier) for tokens on the token endpoint
}
session.presentationContextProvider = presenter
session.prefersEphemeralWebBrowserSession = true
session.start()
```
**Why it's right:**
- The refresh token lives in the Keychain, is device-bound, and can only be read after a successful biometric check enforced by the OS.
- Login uses the system authentication session with PKCE; no secrets ship in the app and ATS stays enabled.
