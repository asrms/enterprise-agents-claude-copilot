# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Blocking, unbounded, and fire-and-forget
```typescript
app.post('/export', async (req, reply) => {
  const rows = await db.query('SELECT * FROM events');            // millions of rows in memory
  const csv = rows.map(toCsvLine).join('\n');
  fs.writeFileSync(`/tmp/${req.id}.csv`, csv);                     // blocks the event loop

  req.body.webhooks.forEach(async (url: string) => {               // unbounded, errors lost
    await fetch(url, { method: 'POST', body: csv });               // no timeout
  });
  return { ok: true };
});

const cache = new Map<string, unknown>();                          // grows forever
```
**Why it's wrong:**
- The whole table and CSV sit in memory, and synchronous I/O stalls every other request.
- `forEach(async ...)` fires unbounded concurrent requests whose failures become unhandled rejections.
- Calls without timeouts can hang indefinitely; the unbounded `Map` leaks memory.

## Best Practice (How to do it right)

### 1. Streaming with backpressure, bounded concurrency, and timeouts
```typescript
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import pLimit from 'p-limit';
import { LRUCache } from 'lru-cache';

app.get('/export', async (req, reply) => {
  const cursor = db.stream('SELECT id, type, occurred_at FROM events WHERE tenant_id = $1', [req.user.tenantId]);
  const toCsv = new Transform({
    objectMode: true,
    transform(row, _enc, cb) { cb(null, toCsvLine(row) + '\n'); },
  });
  reply.header('content-type', 'text/csv');
  return reply.send(cursor.pipe(toCsv));                           // backpressure end to end
});

const limit = pLimit(5);
export async function notifyWebhooks(urls: string[], payload: string, signal: AbortSignal) {
  const results = await Promise.allSettled(
    urls.map((url) => limit(() =>
      fetch(url, { method: 'POST', body: payload, signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]) }),
    )),
  );
  return results.filter((r) => r.status === 'rejected').length;
}

const cache = new LRUCache<string, Profile>({ max: 10_000, ttl: 60_000 });
```
```typescript
// CPU-heavy work off the event loop
import Piscina from 'piscina';
const pool = new Piscina({ filename: new URL('./render-pdf.worker.js', import.meta.url).href, maxThreads: 4 });
const pdf: Buffer = await pool.run({ invoiceId });
```
**Why it's right:**
- Rows stream from the database to the client with constant memory and backpressure.
- Webhook calls run with at most five in flight, each with a timeout and cancellation, and every failure is accounted for.
- The cache is bounded, and CPU-bound rendering runs in worker threads.
