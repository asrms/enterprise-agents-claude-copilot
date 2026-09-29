# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unbounded goroutines, shared map race, leak on early return
```go
func FetchAll(urls []string) map[string][]byte {
    results := map[string][]byte{}
    ch := make(chan error)
    for _, u := range urls {
        go func() {
            resp, err := http.Get(u)                   // no context, no timeout
            if err != nil {
                ch <- err                              // blocks forever if nobody reads
                return
            }
            defer resp.Body.Close()
            body, _ := io.ReadAll(resp.Body)
            results[u] = body                          // concurrent map write: data race
            ch <- nil
        }()
    }
    for range urls {
        if err := <-ch; err != nil {
            return nil                                 // remaining goroutines leak
        }
    }
    return results
}
```
**Why it's wrong:**
- One goroutine per URL with no limit and no cancellation; requests can hang forever.
- The map is written concurrently (a data race that can crash the program).
- Returning early leaves the other goroutines blocked on an unread channel.

## Best Practice (How to do it right)

### 1. errgroup with context, a concurrency limit, and index-owned results
```go
func FetchAll(ctx context.Context, client *http.Client, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(8)
    results := make([][]byte, len(urls))               // each goroutine writes only its own index

    for i, u := range urls {
        g.Go(func() error {
            req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
            if err != nil {
                return fmt.Errorf("build request %s: %w", u, err)
            }
            resp, err := client.Do(req)
            if err != nil {
                return fmt.Errorf("fetch %s: %w", u, err)
            }
            defer resp.Body.Close()
            body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
            if err != nil {
                return fmt.Errorf("read %s: %w", u, err)
            }
            results[i] = body
            return nil
        })
    }
    if err := g.Wait(); err != nil {                   // first error cancels ctx for the others
        return nil, err
    }
    return results, nil
}
```
### 2. Worker that stops on cancellation
```go
func (w *Worker) Run(ctx context.Context, jobs <-chan Job) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case job, ok := <-jobs:
            if !ok {
                return nil                             // producer closed the channel
            }
            if err := w.process(ctx, job); err != nil {
                w.log.ErrorContext(ctx, "job failed", "job_id", job.ID, "err", err)
            }
        }
    }
}
```
**Why it's right:**
- Concurrency is bounded, cancellation propagates, and the first error stops the remaining work.
- There is no shared mutable map; response size is limited and bodies are closed.
- The worker never blocks forever: it exits on cancellation or when the producer closes the channel.
