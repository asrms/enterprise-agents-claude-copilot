# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Heavy synchronous startup and a leaking singleton
```kotlin
class ShopApp : Application() {
    override fun onCreate() {
        super.onCreate()
        AnalyticsSdk.init(this)                                  // network + disk on the main thread
        val catalog = assets.open("catalog.json").bufferedReader().readText()
        CatalogCache.items = Json.decodeFromString(catalog)      // parses 5 MB before the first frame
        ImageLoader.preloadAll(this)                             // decodes every banner image
    }
}

object ScreenTracker {
    var currentActivity: Activity? = null                        // leaks the Activity after rotation
}
```
**Why it's wrong:**
- All initialization runs synchronously before the first frame, inflating cold start time and risking ANRs.
- A static reference to an Activity leaks it and its whole view hierarchy.

## Best Practice (How to do it right)

### 1. Lazy initialization and a measured startup
```kotlin
@HiltAndroidApp
class ShopApp : Application(), Configuration.Provider {
    @Inject lateinit var workerFactory: HiltWorkerFactory
    @Inject @ApplicationScope lateinit var appScope: CoroutineScope
    @Inject lateinit var analytics: Lazy<Analytics>              // created on first use

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().setWorkerFactory(workerFactory).build()

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(StrictMode.ThreadPolicy.Builder().detectAll().penaltyLog().build())
        }
        appScope.launch(Dispatchers.Default) { analytics.get().start() }   // off the critical path
    }
}
```
`baselineprofile/src/main/java/StartupBaselineProfile.kt`:
```kotlin
@RunWith(AndroidJUnit4::class)
class StartupBaselineProfile {
    @get:Rule val rule = BaselineProfileRule()

    @Test
    fun generate() = rule.collect(packageName = "com.example.shop") {
        pressHome()
        startActivityAndWait()
        device.findObject(By.res("orders_list")).fling(Direction.DOWN)
    }
}
```
`macrobenchmark/src/main/java/StartupBenchmark.kt`:
```kotlin
@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule val rule = MacrobenchmarkRule()

    @Test
    fun coldStartup() = rule.measureRepeated(
        packageName = "com.example.shop",
        metrics = listOf(StartupTimingMetric()),
        compilationMode = CompilationMode.Partial(BaselineProfileMode.Require),
        startupMode = StartupMode.COLD,
        iterations = 10,
    ) {
        pressHome()
        startActivityAndWait()
    }
}
```
**Why it's right:**
- Only essential work runs in `onCreate`; SDKs initialize lazily or in the background, and StrictMode flags main-thread I/O in debug builds.
- The Baseline Profile covers startup and the first scroll, and the benchmark proves the effect with repeatable cold starts.
