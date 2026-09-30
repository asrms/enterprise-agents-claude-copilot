# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Injection, traversal, weak randomness
```go
func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
    sort := r.URL.Query().Get("sort")
    rows, _ := h.db.Query(fmt.Sprintf("SELECT * FROM orders ORDER BY %s", sort))   // SQL injection
    defer rows.Close()

    name := r.URL.Query().Get("file")
    data, _ := os.ReadFile("/srv/reports/" + name)                               // ../../etc/passwd
    w.Write(data)

    out, _ := exec.Command("sh", "-c", "convert "+name+" out.pdf").Output()       // command injection
    _ = out

    token := fmt.Sprintf("%d", mathrand.Int63())                                 // predictable token
    _ = token
}
```
**Why it's wrong:**
- User input reaches SQL, the file system, and a shell unvalidated.
- `math/rand` tokens are predictable, and every error is ignored.

## Best Practice (How to do it right)

### 1. Allow-listed identifiers, rooted file access, direct exec, crypto/rand
```go
var sortColumns = map[string]string{"created": "created_at", "total": "total_amount"}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
    col, ok := sortColumns[r.URL.Query().Get("sort")]
    if !ok {
        col = "created_at"
    }
    rows, err := h.db.QueryContext(r.Context(),
        "SELECT id, status, total_amount FROM orders WHERE tenant_id = $1 ORDER BY "+col+" DESC LIMIT 100",
        tenantFrom(r.Context()))
    if err != nil {
        writeError(w, r, fmt.Errorf("query report: %w", err))
        return
    }
    defer rows.Close()
    // ... encode rows
}

func (h *Handler) download(w http.ResponseWriter, r *http.Request) {
    f, err := h.reportsRoot.Open(r.PathValue("name"))   // h.reportsRoot is *os.Root: escapes are rejected
    if err != nil {
        http.NotFound(w, r)
        return
    }
    defer f.Close()
    w.Header().Set("Content-Type", "application/pdf")
    _, _ = io.Copy(w, f)
}

func convert(ctx context.Context, src, dst string) error {
    ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
    defer cancel()
    cmd := exec.CommandContext(ctx, "/usr/bin/convert", "--", src, dst)   // no shell, separate args
    return cmd.Run()
}

func newToken() string { return rand.Text() }             // crypto/rand, 26 base32 characters
```
**Why it's right:**
- Only allow-listed column names reach SQL and values are parameterized, with tenant scoping and a limit.
- `os.Root` confines file access to the reports directory; external commands run without a shell and with a timeout.
- Tokens come from a cryptographically secure source.
