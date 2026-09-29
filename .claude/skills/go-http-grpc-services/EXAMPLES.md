# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Default server, unbounded body, default client
```go
func main() {
    http.HandleFunc("/orders", func(w http.ResponseWriter, r *http.Request) {
        var req CreateOrderRequest
        json.NewDecoder(r.Body).Decode(&req)                         // unbounded body, error ignored
        resp, _ := http.Get("http://pricing/prices?sku=" + req.SKU)  // default client: no timeout
        body, _ := io.ReadAll(resp.Body)                             // body never closed
        w.Write(body)
    })
    http.ListenAndServe(":8080", nil)                                // no timeouts, no graceful shutdown
}
```
**Why it's wrong:**
- Slow or malicious clients can hold connections forever (Slowloris) and send unlimited bodies.
- Outbound calls have no timeout and leak connections; errors are ignored; the query string is built by concatenation.
- The process stops abruptly on deploy, dropping in-flight requests.

## Best Practice (How to do it right)

### 1. Configured server, safe decoding, graceful shutdown
```go
func routes(h *Handler) http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("POST /v1/orders", h.createOrder)
    mux.HandleFunc("GET /v1/orders/{id}", h.getOrder)
    mux.HandleFunc("GET /livez", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
    mux.HandleFunc("GET /readyz", h.ready)
    return chain(mux, requestID, accessLog, recoverPanic, authenticate)
}

func decodeJSON[T any](w http.ResponseWriter, r *http.Request, dst *T) error {
    r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
    dec := json.NewDecoder(r.Body)
    dec.DisallowUnknownFields()
    if err := dec.Decode(dst); err != nil {
        return &ValidationError{Reason: "invalid JSON body"}
    }
    if dec.More() {
        return &ValidationError{Reason: "body must contain a single JSON object"}
    }
    return nil
}

func serve(ctx context.Context, handler http.Handler, addr string) error {
    srv := &http.Server{
        Addr:              addr,
        Handler:           handler,
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout:       15 * time.Second,
        WriteTimeout:      30 * time.Second,
        IdleTimeout:       120 * time.Second,
        MaxHeaderBytes:    1 << 20,
    }
    errCh := make(chan error, 1)
    go func() { errCh <- srv.ListenAndServe() }()

    select {
    case err := <-errCh:
        return err
    case <-ctx.Done():
        shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
        defer cancel()
        return srv.Shutdown(shutdownCtx)
    }
}

var pricingClient = &http.Client{
    Timeout:   3 * time.Second,
    Transport: &http.Transport{MaxIdleConnsPerHost: 32, IdleConnTimeout: 90 * time.Second},
}
```
### 2. gRPC client with deadline and status mapping
```go
conn, err := grpc.NewClient("dns:///inventory:443",
    grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS13})),
    grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
if err != nil {
    return fmt.Errorf("dial inventory: %w", err)
}
client := inventoryv1.NewInventoryServiceClient(conn)

ctx, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
defer cancel()
_, err = client.Reserve(ctx, &inventoryv1.ReserveRequest{Sku: sku, Quantity: qty})
if status.Code(err) == codes.FailedPrecondition {
    return order.ErrOutOfStock
}
```
**Why it's right:**
- The server has explicit timeouts and limits, bodies are bounded and strictly decoded, and shutdown drains connections.
- Outbound HTTP and gRPC calls reuse connections, have deadlines, use TLS, and are traced; gRPC status codes are mapped to domain errors.
