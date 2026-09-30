# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Closed loop hammering one URL, averages only
```javascript
import http from 'k6/http';
export const options = { vus: 500, duration: '1m' };     // no ramp-up, no thresholds
export default function () {
  http.get('https://staging.example.com/products/1');   // same cached product every time, no checks
}
// Report to management: "Average response time 120 ms, system is fine"
```
**Why it's wrong:**
- The workload is unrealistic (one cached URL), load drops when the system slows down, and there are no pass/fail criteria.
- Averages hide tail latency, and one-minute runs reveal nothing about stability.

## Best Practice (How to do it right)

### 1. k6 open-model scenario with realistic data and SLO thresholds
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const products = new SharedArray('products', () => JSON.parse(open('./data/product-ids.json')));
const BASE = __ENV.BASE_URL;

export const options = {
  scenarios: {
    browse_and_buy: {
      executor: 'ramping-arrival-rate',
      startRate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      stages: [
        { target: 100, duration: '5m' },    // warm-up to average load
        { target: 300, duration: '10m' },   // expected peak
        { target: 300, duration: '20m' },   // hold
        { target: 0, duration: '2m' },
      ],
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{name:search}': ['p(95)<400', 'p(99)<1000'],
    'http_req_duration{name:checkout}': ['p(95)<800'],
    'checks': ['rate>0.99'],
  },
};

export default function () {
  const id = products[Math.floor(Math.random() * products.length)];
  const search = http.get(`${BASE}/v1/products/search?q=shoe&page=1`, { tags: { name: 'search' } });
  check(search, { 'search 200': (r) => r.status === 200 });
  sleep(Math.random() * 3 + 1);                                    // think time

  if (Math.random() < 0.1) {                                        // 10% of sessions check out
    const res = http.post(`${BASE}/v1/checkout`, JSON.stringify({ productId: id, quantity: 1 }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'checkout' } });
    check(res, { 'checkout 201': (r) => r.status === 201 });
  }
}
```
```bash
k6 run -e BASE_URL=https://perf.example.com --out experimental-prometheus-rw load/browse_and_buy.js
```
**Why it's right:**
- Arrival rates model real traffic, data is varied, and the journey mix reflects production.
- Thresholds on percentiles and errors per endpoint make the test pass or fail automatically, and results are streamed to monitoring for correlation.
