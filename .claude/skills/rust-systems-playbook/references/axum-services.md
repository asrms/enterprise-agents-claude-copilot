# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unbounded, unvalidated handler with unwraps
```rust
async fn create_order(body: String) -> String {
    let req: serde_json::Value = serde_json::from_str(&body).unwrap();          // panics on bad JSON
    let pool = PgPool::connect("postgres://admin:admin@db/shop").await.unwrap(); // new pool per request, secret in code
    sqlx::query(&format!("INSERT INTO orders (sku) VALUES ('{}')", req["sku"])) // SQL injection
        .execute(&pool).await.unwrap();
    "ok".to_string()
}
```
**Why it's wrong:**
- Invalid input panics the handler, the pool is recreated per request with hard-coded credentials, and SQL is built from input.
- There are no limits, timeouts, authentication, or meaningful status codes.

## Best Practice (How to do it right)

### 1. Router with state, middleware, typed extractors, and error mapping
```rust
#[derive(Clone)]
struct AppState { pool: PgPool, jwt: Arc<JwtVerifier> }

#[derive(Deserialize, Validate)]
#[serde(deny_unknown_fields)]
struct CreateOrderRequest {
    #[validate(length(min = 1, max = 64))]
    sku: String,
    #[validate(range(min = 1, max = 100))]
    quantity: i32,
}

async fn create_order(
    State(state): State<AppState>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(req): Json<CreateOrderRequest>,
) -> Result<(StatusCode, Json<OrderResponse>), AppError> {
    req.validate().map_err(AppError::validation)?;
    let order = sqlx::query_as!(
        OrderRow,
        "INSERT INTO orders (customer_id, sku, quantity) VALUES ($1, $2, $3) RETURNING id, sku, quantity, status",
        user.id, req.sku, req.quantity
    )
    .fetch_one(&state.pool)
    .await?;
    Ok((StatusCode::CREATED, Json(order.into())))
}

pub fn app(state: AppState) -> Router {
    let orders = Router::new()
        .route("/", post(create_order))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_jwt));
    Router::new()
        .route("/livez", get(|| async { StatusCode::OK }))
        .nest("/v1/orders", orders)
        .layer(
            ServiceBuilder::new()
                .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
                .layer(TraceLayer::new_for_http())
                .layer(TimeoutLayer::new(Duration::from_secs(10)))
                .layer(RequestBodyLimitLayer::new(64 * 1024))
                .layer(PropagateRequestIdLayer::x_request_id()),
        )
        .with_state(state)
}
```
### 2. In-process router test
```rust
#[tokio::test]
async fn rejects_requests_without_token() {
    let app = app(test_state().await);
    let res = app
        .oneshot(Request::post("/v1/orders").header("content-type", "application/json")
            .body(Body::from(r#"{"sku":"A","quantity":1}"#)).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}
```
**Why it's right:**
- State is shared once, input is typed and validated, queries are compile-time checked and parameterized, and errors map through `AppError`.
- Middleware adds request ids, tracing, timeouts, and body limits; the router is tested in-process.
