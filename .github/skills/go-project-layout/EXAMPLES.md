# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Layered packages, globals, and a fat main
```text
myapp/
  models/order.go
  controllers/order_controller.go
  services/order_service.go
  utils/helpers.go
  main.go
```
```go
package services

var DB *sql.DB                         // global set somewhere in main

type OrderServiceInterface interface { // interface defined next to its only implementation
    Create(o models.Order) error
    Get(id int) (models.Order, error)
    List() ([]models.Order, error)
    Delete(id int) error
}

func init() {
    DB, _ = sql.Open("postgres", os.Getenv("DB_URL"))  // side effect in init, error ignored
}
```
**Why it's wrong:**
- Technical layering spreads one feature across many packages and invites import cycles.
- Global state and `init` side effects make the code untestable and hide failures.
- A large producer-side interface is created before any consumer needs it.

## Best Practice (How to do it right)

### 1. Domain packages and explicit wiring
```text
orders-service/
  cmd/orders-api/main.go
  internal/order/order.go            // domain types and rules
  internal/order/service.go          // use cases; defines the Repository interface it needs
  internal/order/http.go             // HTTP handlers for the order domain
  internal/platform/postgres/orders.go
  internal/platform/config/config.go
  go.mod
```
```go
// cmd/orders-api/main.go
func main() {
    if err := run(context.Background(), os.Getenv); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}

func run(ctx context.Context, getenv func(string) string) error {
    ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
    defer stop()

    cfg, err := config.Load(getenv)
    if err != nil {
        return fmt.Errorf("load config: %w", err)
    }
    pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
    if err != nil {
        return fmt.Errorf("connect database: %w", err)
    }
    defer pool.Close()

    svc := order.NewService(postgres.NewOrderRepository(pool), time.Now)
    srv := &http.Server{Addr: cfg.Addr, Handler: order.Routes(svc), ReadHeaderTimeout: 5 * time.Second}
    return serve(ctx, srv)
}
```
```go
// internal/order/service.go
type Repository interface {             // defined by the consumer, minimal
    Save(ctx context.Context, o Order) error
    FindByID(ctx context.Context, id ID) (Order, error)
}

type Service struct {
    repo Repository
    now  func() time.Time
}

func NewService(repo Repository, now func() time.Time) *Service { return &Service{repo: repo, now: now} }
```
**Why it's right:**
- Packages follow the domain; infrastructure lives under `internal/platform`.
- All dependencies are created and injected in `run`, which returns errors and is testable.
- The consumer owns a small interface, and time is injected for deterministic tests.
