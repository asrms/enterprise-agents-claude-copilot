# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Blocking the executor, unbounded spawns, lock across await
```rust
async fn refresh_all(ids: Vec<String>, cache: Arc<std::sync::Mutex<HashMap<String, Price>>>) {
    for id in ids {                                                     // could be 100,000 ids
        let cache = cache.clone();
        tokio::spawn(async move {                                       // fire-and-forget, unbounded
            let mut guard = cache.lock().unwrap();                      // std mutex held across .await
            let price = reqwest::get(format!("http://pricing/{id}"))    // no timeout
                .await.unwrap().json::<Price>().await.unwrap();
            guard.insert(id, price);
            std::thread::sleep(Duration::from_millis(10));              // blocks a runtime worker
        });
    }
}
```
**Why it's wrong:**
- Unlimited tasks and requests overwhelm the dependency; failures panic inside detached tasks and are lost.
- Holding a `std::sync::Mutex` across `.await` and sleeping on a worker thread stall the runtime.

## Best Practice (How to do it right)

### 1. Bounded concurrency, timeouts, cancellation, and short critical sections
```rust
use futures::{stream, StreamExt};
use tokio_util::sync::CancellationToken;

pub async fn refresh_all(
    client: &reqwest::Client,
    ids: Vec<String>,
    cache: &std::sync::Mutex<HashMap<String, Price>>,
    shutdown: CancellationToken,
) -> usize {
    let results = stream::iter(ids)
        .map(|id| async move {
            let fetch = async {
                let res = client.get(format!("http://pricing.internal/prices/{id}")).send().await?.error_for_status()?;
                res.json::<Price>().await
            };
            tokio::select! {
                _ = shutdown.cancelled() => (id, Err(RefreshError::Cancelled)),
                r = tokio::time::timeout(Duration::from_secs(2), fetch) => match r {
                    Ok(Ok(price)) => (id, Ok(price)),
                    Ok(Err(e)) => (id, Err(RefreshError::Http(e))),
                    Err(_) => (id, Err(RefreshError::Timeout)),
                },
            }
        })
        .buffer_unordered(16)                                            // at most 16 requests in flight
        .collect::<Vec<_>>()
        .await;

    let mut updated = 0;
    for (id, result) in results {
        match result {
            Ok(price) => { cache.lock().expect("cache lock poisoned").insert(id, price); updated += 1; }
            Err(e) => tracing::warn!(%id, error = ?e, "price refresh failed"),
        }
    }
    updated
}
```
### 2. Deterministic time in tests
```rust
#[tokio::test(start_paused = true)]
async fn retries_after_backoff() {
    let task = tokio::spawn(fetch_with_retry(fake_client_failing_once()));
    tokio::time::advance(Duration::from_millis(500)).await;
    assert!(task.await.unwrap().is_ok());
}
```
**Why it's right:**
- Concurrency is bounded, each request has a timeout, cancellation is honored, and failures are logged instead of panicking.
- The standard mutex is locked only briefly outside any `.await`, and tests control time deterministically.
