# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Hard-coded signing and manual full rollout
```kotlin
android {
    defaultConfig {
        versionCode = 57                                   // edited by hand, collides between branches
        versionName = "2.3"
    }
    signingConfigs {
        create("release") {
            storeFile = file("release.jks")                // keystore committed to the repository
            storePassword = "android123"
            keyAlias = "release"
            keyPassword = "android123"
        }
    }
}
```
```text
Upload APK from a laptop -> Production -> 100% rollout
```
**Why it's wrong:**
- The signing key and passwords are in source control; losing or leaking them compromises the app.
- Manual version codes collide, and a full rollout exposes every user to a bad build at once.

## Best Practice (How to do it right)

### 1. CI-driven versions, upload key from secrets, Gradle Play Publisher
`app/build.gradle.kts`:
```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.play.publisher)
}

android {
    defaultConfig {
        versionCode = providers.environmentVariable("CI_BUILD_NUMBER").map(String::toInt).getOrElse(1)
        versionName = providers.environmentVariable("RELEASE_VERSION").getOrElse("0.0.0-dev")
    }
    signingConfigs {
        create("upload") {
            storeFile = providers.environmentVariable("UPLOAD_KEYSTORE_PATH").map(::file).orNull
            storePassword = providers.environmentVariable("UPLOAD_KEYSTORE_PASSWORD").orNull
            keyAlias = providers.environmentVariable("UPLOAD_KEY_ALIAS").orNull
            keyPassword = providers.environmentVariable("UPLOAD_KEY_PASSWORD").orNull
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("upload")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

play {
    track.set("internal")
    defaultToAppBundles.set(true)
    releaseStatus.set(com.github.triplet.gradle.androidpublisher.ReleaseStatus.COMPLETED)
}
```
```bash
# CI: build and upload to the internal track
./gradlew bundleRelease publishReleaseBundle

# after validation: promote the same bundle to production as a 5% staged rollout
./gradlew promoteReleaseArtifact --from-track internal --promote-track production --release-status inProgress --user-fraction 0.05
```
**Why it's right:**
- Version codes come from CI, and the upload key is injected from the secret store; Google holds the app signing key.
- The same bundle moves from the internal track to a staged production rollout that can be halted if vitals regress.
