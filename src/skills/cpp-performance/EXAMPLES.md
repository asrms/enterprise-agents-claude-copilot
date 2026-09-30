# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Copies, node containers, and allocations in a hot loop
```cpp
double average_price(std::list<Order> orders) {          // copied by value, node-based container
    std::map<std::string, double> by_sku;                  // allocations per insertion
    for (auto o : orders) {                                // copies each Order again
        by_sku[o.sku] += o.price;
    }
    double sum = 0;
    for (auto p : by_sku) sum += p.second;                 // copies each pair (including the string)
    return sum / by_sku.size();
}
// "measured" by running the debug build once with std::chrono around main()
```
**Why it's wrong:**
- Every element is copied twice, the containers scatter data across the heap, and allocations dominate.
- A single debug-build timing gives no reliable information.

## Best Practice (How to do it right)

### 1. Contiguous data, references, reuse, and a Google Benchmark
```cpp
struct OrderRow { std::uint32_t sku_id; std::int64_t price_cents; };   // compact, cache-friendly

[[nodiscard]] double average_price_by_sku(std::span<const OrderRow> orders, std::vector<std::int64_t>& totals) {
    totals.assign(max_sku_id(orders) + 1, 0);              // reused buffer, dense index by sku id
    for (const auto& o : orders) totals[o.sku_id] += o.price_cents;
    const auto used = std::ranges::count_if(totals, [](std::int64_t t) { return t != 0; });
    const auto sum = std::accumulate(totals.begin(), totals.end(), std::int64_t{0});
    return used == 0 ? 0.0 : static_cast<double>(sum) / static_cast<double>(used) / 100.0;
}

static void BM_AveragePrice(benchmark::State& state) {
    const auto orders = make_orders(static_cast<std::size_t>(state.range(0)));
    std::vector<std::int64_t> totals;
    for (auto _ : state) {
        benchmark::DoNotOptimize(average_price_by_sku(orders, totals));
    }
    state.SetItemsProcessed(state.iterations() * state.range(0));
}
BENCHMARK(BM_AveragePrice)->Range(1 << 10, 1 << 20);
BENCHMARK_MAIN();
```
```bash
cmake --preset release && cmake --build --preset release --target bench_pricing
./build/release/bench_pricing --benchmark_repetitions=10 --benchmark_out=new.json
compare.py benchmarks old.json new.json        # Google Benchmark's comparison tool
perf record -g ./build/release/bench_pricing && perf report
```
**Why it's right:**
- Data is compact and contiguous, inputs are borrowed, and the working buffer is reused without per-iteration allocations.
- Performance is measured on release builds with repetitions and compared against a baseline, with profiling available for analysis.
