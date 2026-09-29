# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Secrets in the bundle and tokens in plain storage
```typescript
// React Native
const STRIPE_SECRET = 'sk_live_51H...'                       // extractable from the JS bundle
await AsyncStorage.setItem('refreshToken', tokens.refresh)  // unencrypted on disk

Linking.addEventListener('url', ({ url }) => {
  const target = new URL(url).searchParams.get('redirect')
  webViewRef.current?.injectJavaScript(`location.href='${target}'`)   // open redirect and script injection
})
```
```dart
// Flutter
final prefs = await SharedPreferences.getInstance();
await prefs.setString('access_token', token);              // plain XML file on Android
```
**Why it's wrong:**
- Secret keys ship inside the app, and tokens are stored in unencrypted storage.
- Deep link input is injected into a WebView as JavaScript without validation.

## Best Practice (How to do it right)

### 1. Secure storage and system-browser OAuth
```typescript
// React Native (Expo)
import * as SecureStore from 'expo-secure-store'
import * as AuthSession from 'expo-auth-session'

await SecureStore.setItemAsync('refreshToken', tokens.refreshToken, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
})

const request = new AuthSession.AuthRequest({
  clientId: 'mobile-app',
  redirectUri: AuthSession.makeRedirectUri({ scheme: 'com.example.shop' }),
  scopes: ['openid', 'profile', 'orders:read'],
  usePKCE: true,
})
```
```dart
// Flutter
const storage = FlutterSecureStorage(
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
);
await storage.write(key: 'refresh_token', value: tokens.refreshToken);
```
### 2. Allow-listed deep link routing
```typescript
const ALLOWED = [/^\/orders\/[A-Za-z0-9-]{1,36}$/, /^\/profile$/]

export function routeDeepLink(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.host !== 'shop.example.com') return
  if (!ALLOWED.some(pattern => pattern.test(url.pathname))) return
  router.push(url.pathname)                                   // no parameters forwarded blindly
}
```
**Why it's right:**
- Tokens live in Keychain/Keystore-backed storage bound to the device; login uses the system browser with PKCE.
- Only verified HTTPS links to known paths are routed, and nothing from the link is executed or forwarded to a WebView.
