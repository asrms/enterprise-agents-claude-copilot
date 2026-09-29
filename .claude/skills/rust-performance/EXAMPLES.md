# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Allocation-heavy hot loop and debug-build benchmarking
```rust
pub fn render_csv(rows: &[Row]) -> String {
    let mut out = String::new();
    for row in rows {
        let line = format!("{},{},{}\n", row.id.to_string(), row.name.clone(), row.total.to_string()); // 4+ allocations per row
        out = out + &line;                                                                            // reallocates the whole string
    }
    out
}
// "Benchmark": cargo run (debug build) + Instant::now() around a single call
```
**Why it's wrong:**
- Every row allocates several temporary strings and the output is copied repeatedly.
- Timing a single run of a debug build says nothing about release performance.

## Best Practice (How to do it right)

### 1. Reused buffer, direct writes, and a criterion benchmark
```rust
use std::fmt::Write as _;

pub fn render_csv(rows: &[Row], out: &mut String) {
    out.clear();
    out.reserve(rows.len() * 48);                               // estimate from typical row size
    for row in rows {
        // writeln! into a String cannot fail
        let _ = writeln!(out, "{},{},{}", row.id, row.name, row.total);
    }
}
```
`benches/csv.rs`:
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion, Throughput};

fn bench_csv(c: &mut Criterion) {
    let rows = sample_rows(10_000);
    let mut buf = String::new();
    let mut group = c.benchmark_group("csv");
    group.throughput(Throughput::Elements(rows.len() as u64));
    group.bench_function("render_10k", |b| b.iter(|| render_csv(black_box(&rows), &mut buf)));
    group.finish();
}
criterion_group!(benches, bench_csv);
criterion_main!(benches);
```
`Cargo.toml`:
```toml
[profile.release]
lto = "thin"
codegen-units = 1
debug = "line-tables-only"      # symbols for profiling without full debug info

[[bench]]
name = "csv"
harness = false
```
```bash
cargo bench --bench csv -- --save-baseline main       # on main
cargo bench --bench csv -- --baseline main            # on the branch: reports change with confidence intervals
cargo flamegraph --bench csv -- --bench               # profile if a regression appears
```
**Why it's right:**
- The function reuses one buffer and writes directly without temporaries, reducing allocations to near zero.
- Performance is measured with statistically robust benchmarks on optimized builds and compared against a baseline.
