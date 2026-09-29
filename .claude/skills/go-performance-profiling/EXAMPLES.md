# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Guessing, repeated allocations, and a naive benchmark
```go
func BuildCSV(rows []Row) string {
    out := ""
    for _, r := range rows {
        out += r.ID + "," + strconv.Itoa(r.Qty) + "\n"   // reallocates the whole string each time
    }
    return out
}

func BenchmarkBuildCSV(b *testing.B) {
    rows := makeRows(10_000)                             // setup counted in the timing
    for i := 0; i < 1; i++ {                             // ignores b.N: measures nothing reliable
        BuildCSV(rows)
    }
}
```
**Why it's wrong:**
- String concatenation in a loop is quadratic in allocations and copying.
- The benchmark ignores `b.N`, includes setup, and there is no before/after comparison.

## Best Practice (How to do it right)

### 1. Benchmark, profile, optimize, compare
```go
func BuildCSV(w io.Writer, rows []Row) error {
    bw := bufio.NewWriterSize(w, 64<<10)
    buf := make([]byte, 0, 64)
    for _, r := range rows {
        buf = buf[:0]
        buf = append(buf, r.ID...)
        buf = append(buf, ',')
        buf = strconv.AppendInt(buf, int64(r.Qty), 10)
        buf = append(buf, '\n')
        if _, err := bw.Write(buf); err != nil {
            return err
        }
    }
    return bw.Flush()
}

func BenchmarkBuildCSV(b *testing.B) {
    rows := makeRows(10_000)
    b.ReportAllocs()
    for b.Loop() {                                       // setup above is excluded automatically
        if err := BuildCSV(io.Discard, rows); err != nil {
            b.Fatal(err)
        }
    }
}
```
```bash
go test -run='^$' -bench=BuildCSV -count=10 -cpuprofile=cpu.out ./internal/export > new.txt
go tool pprof -top cpu.out
benchstat old.txt new.txt
```
```text
           │   old.txt    │               new.txt               │
           │    sec/op    │   sec/op     vs base                │
BuildCSV-8   412.3m ± 2%   0.61m ± 1%  -99.85% (p=0.000 n=10)
           │  allocs/op   │  allocs/op   vs base                │
BuildCSV-8   30.00k ± 0%    2.00 ± 0%  -99.99% (p=0.000 n=10)
```
### 2. Runtime limits in a container
```yaml
env:
  - name: GOMEMLIMIT
    value: 900MiB                                   # about 90% of the 1Gi container limit
resources:
  limits: { cpu: '2', memory: 1Gi }
```
**Why it's right:**
- The change is driven by a benchmark and profile, and its effect is proven with benchstat.
- The optimized version streams to a writer, reuses a buffer, and allocates almost nothing.
- Runtime memory and CPU settings follow the container limits.
