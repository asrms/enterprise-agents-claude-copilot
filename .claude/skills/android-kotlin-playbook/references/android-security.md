# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Plain-text tokens, exported activity, insecure WebView
```xml
<application android:usesCleartextTraffic="true" android:allowBackup="true">
    <activity android:name=".DeepLinkActivity" android:exported="true" />
</application>
```
```kotlin
getSharedPreferences("auth", MODE_PRIVATE).edit().putString("token", accessToken).apply()  // plain text

webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(PaymentBridge(this), "Android")   // any loaded page can call it
webView.loadUrl(intent.getStringExtra("url")!!)                 // attacker-controlled URL from another app
```
**Why it's wrong:**
- Tokens are stored unencrypted and included in backups; cleartext HTTP is allowed.
- Any app can start the exported activity with an arbitrary URL that gets access to a privileged JavaScript bridge.

## Best Practice (How to do it right)

### 1. Network security config and locked-down components
`res/xml/network_security_config.xml`:
```xml
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors><certificates src="system" /></trust-anchors>
    </base-config>
    <domain-config>
        <domain includeSubdomains="true">api.example.com</domain>
        <pin-set expiration="2027-06-30">
            <pin digest="SHA-256">7HIpactkIAq2Y49orFOOQKurWxmmSFZhBCoQYcRhJ3Y=</pin>
            <pin digest="SHA-256">fwza0LRMXouZHRC8Ei+4PyuldPDcf3UKgO/04cDM1oE=</pin>
        </pin-set>
    </domain-config>
</network-security-config>
```
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:dataExtractionRules="@xml/data_extraction_rules">
    <activity android:name=".DeepLinkActivity" android:exported="true">
        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="https" android:host="shop.example.com" android:pathPrefix="/orders/" />
        </intent-filter>
    </activity>
</application>
```
### 2. Encrypted token storage with Tink and the Android Keystore
```kotlin
class TokenStore(context: Context) {
    private val aead: Aead = run {
        AeadConfig.register()
        AndroidKeysetManager.Builder()
            .withSharedPref(context, "token_keyset", "token_keyset_prefs")
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://token_master_key")
            .build()
            .keysetHandle
            .getPrimitive(RegistryConfiguration.get(), Aead::class.java)
    }
    private val prefs = context.getSharedPreferences("tokens", Context.MODE_PRIVATE)

    fun save(refreshToken: String) {
        val ciphertext = aead.encrypt(refreshToken.toByteArray(), "refresh".toByteArray())
        prefs.edit { putString("refresh", Base64.encodeToString(ciphertext, Base64.NO_WRAP)) }
    }
}
```
```kotlin
// deep link: only a validated order id is accepted
val orderId = intent.data?.lastPathSegment?.takeIf { it.matches(Regex("^[A-Za-z0-9-]{1,36}$")) } ?: return finish()
```
**Why it's right:**
- Cleartext is blocked, pins have a backup and an expiry, and only verified HTTPS links reach the exported activity.
- The refresh token is encrypted with a key protected by the Android Keystore and excluded from backups by the extraction rules.
- Deep link input is validated against a strict pattern before use.
