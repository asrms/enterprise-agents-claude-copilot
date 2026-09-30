# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Ignored errors, string matching, log-and-return, panic
```go
func (r *Repo) Get(ctx context.Context, id string) (*Order, error) {
    row := r.db.QueryRow(ctx, "SELECT id, status FROM orders WHERE id = $1", id)
    var o Order
    err := row.Scan(&o.ID, &o.Status)
    if err != nil {
        log.Printf("error: %v", err)                      // logged here...
        return nil, errors.New("Failed to get order.")    // ...and a new error without the cause
    }
    return &o, nil
}

func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
    o, err := h.repo.Get(r.Context(), r.PathValue("id"))
    if err != nil && strings.Contains(err.Error(), "no rows") {  // never matches: cause was dropped
        http.Error(w, "not found", 404)
        return
    }
    if err != nil {
        panic(err)                                         // crashes or leaks a stack trace
    }
    json.NewEncoder(w).Encode(o)                           // error ignored
}
```
**Why it's wrong:**
- The cause is discarded, so callers cannot distinguish "not found" from a database outage.
- The error is logged and returned (duplicate logs), matched by string, and escalated to a panic.

## Best Practice (How to do it right)

### 1. Domain errors, wrapping, and a single mapping point
```go
// internal/order/errors.go
var (
    ErrNotFound = errors.New("order not found")
    ErrConflict = errors.New("order conflict")
)

// internal/platform/postgres/orders.go
func (r *OrderRepository) FindByID(ctx context.Context, id order.ID) (order.Order, error) {
    var o order.Order
    err := r.pool.QueryRow(ctx, `SELECT id, status FROM orders WHERE id = $1`, id).Scan(&o.ID, &o.Status)
    if errors.Is(err, pgx.ErrNoRows) {
        return order.Order{}, order.ErrNotFound
    }
    if err != nil {
        return order.Order{}, fmt.Errorf("query order %s: %w", id, err)
    }
    return o, nil
}

// internal/order/http.go
func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
    o, err := h.svc.Get(r.Context(), order.ID(r.PathValue("id")))
    if err != nil {
        writeError(w, r, err)
        return
    }
    writeJSON(w, http.StatusOK, toResponse(o))
}

func writeError(w http.ResponseWriter, r *http.Request, err error) {
    var verr *ValidationError
    switch {
    case errors.Is(err, ErrNotFound):
        writeProblem(w, http.StatusNotFound, "Order not found")
    case errors.As(err, &verr):
        writeProblem(w, http.StatusBadRequest, verr.Error())
    case errors.Is(err, ErrConflict):
        writeProblem(w, http.StatusConflict, "Order was modified concurrently")
    default:
        slog.ErrorContext(r.Context(), "unhandled error", "err", err, "path", r.URL.Path)
        writeProblem(w, http.StatusInternalServerError, "Internal error")
    }
}
```
```go
func TestGet_UnknownID_ReturnsNotFound(t *testing.T) {
    _, err := svc.Get(ctx, "missing")
    if !errors.Is(err, order.ErrNotFound) {
        t.Fatalf("want ErrNotFound, got %v", err)
    }
}
```
**Why it's right:**
- Driver errors are translated at the adapter; business code and handlers work with domain errors.
- Unexpected errors keep their full wrapped context and are logged once, at the boundary.
- Clients receive consistent status codes without internal details, and tests check identity, not strings.
