# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unwraps and string errors
```rust
fn load_config(path: &str) -> Config {
    let text = std::fs::read_to_string(path).unwrap();          // panics if the file is missing
    toml::from_str(&text).unwrap()                              // panics on invalid config, no context
}

pub fn find_order(id: &str) -> Result<Order, String> {         // callers cannot match on failures
    let row = db.query_one(id).map_err(|e| e.to_string())?;    // cause chain lost
    Ok(row.into())
}
```
**Why it's wrong:**
- Expected failures crash the program with unhelpful messages.
- String errors destroy structure and causes, so callers cannot react differently to not-found vs database failures.

## Best Practice (How to do it right)

### 1. Library error enum with thiserror
```rust
#[derive(Debug, thiserror::Error)]
pub enum OrderError {
    #[error("order {id} not found")]
    NotFound { id: String },
    #[error("order {id} cannot be cancelled in status {status:?}")]
    NotCancellable { id: String, status: OrderStatus },
    #[error("database error")]
    Database(#[from] sqlx::Error),
}

pub async fn cancel(pool: &PgPool, id: &str) -> Result<Order, OrderError> {
    let order = sqlx::query_as::<_, Order>("SELECT id, status, total_cents FROM orders WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| OrderError::NotFound { id: id.to_owned() })?;
    if order.status == OrderStatus::Shipped {
        return Err(OrderError::NotCancellable { id: id.to_owned(), status: order.status });
    }
    // ... update and return
    Ok(order)
}
```
### 2. Application context and a single HTTP mapping (anyhow + axum)
```rust
fn load_config(path: &Path) -> anyhow::Result<Config> {
    let text = std::fs::read_to_string(path).with_context(|| format!("reading config {}", path.display()))?;
    toml::from_str(&text).with_context(|| format!("parsing config {}", path.display()))
}

impl IntoResponse for OrderError {
    fn into_response(self) -> Response {
        let (status, title) = match &self {
            OrderError::NotFound { .. } => (StatusCode::NOT_FOUND, "Order not found"),
            OrderError::NotCancellable { .. } => (StatusCode::CONFLICT, "Order cannot be cancelled"),
            OrderError::Database(_) => {
                tracing::error!(error = ?self, "database failure");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal error")
            }
        };
        (status, Json(serde_json::json!({ "title": title, "status": status.as_u16() }))).into_response()
    }
}
```
**Why it's right:**
- Callers can match on typed variants, causes are preserved with `#[from]`, and `?` propagates cleanly.
- Configuration errors carry context, and HTTP mapping happens once, logging internal errors without leaking details.
