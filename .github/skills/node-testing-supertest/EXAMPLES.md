# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Tests against a running server with shared data and sleeps
```typescript
describe('orders', () => {
  it('creates an order', async () => {
    const res = await fetch('http://localhost:3000/orders', {       // requires a manually started server
      method: 'POST',
      body: JSON.stringify({ items: [{ sku: 'A', quantity: 1 }] }),
    });
    await new Promise((r) => setTimeout(r, 2000));                  // wait for async processing
    expect(res.status).toBe(201);
  });

  it('lists orders', async () => {
    const res = await fetch('http://localhost:3000/orders');
    expect((await res.json()).length).toBe(1);                      // depends on the previous test
  });
});
```
**Why it's wrong:**
- Requires an external server and database state; tests depend on execution order.
- Fixed sleeps make the suite slow and flaky; no authentication or error paths are tested.

## Best Practice (How to do it right)

### 1. In-process HTTP tests with Testcontainers and MSW (Vitest + Supertest)
```typescript
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { buildApp } from '../src/app';

let pg: StartedPostgreSqlContainer;
let app: Awaited<ReturnType<typeof buildApp>>;
const external = setupServer(
  http.get('https://pricing.internal/prices', () => HttpResponse.json({ A: '9.9900' })),
);

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:17').start();
  await runMigrations(pg.getConnectionUri());
  app = await buildApp({ databaseUrl: pg.getConnectionUri() });
  external.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => external.resetHandlers());
afterAll(async () => { external.close(); await app.close(); await pg.stop(); });

describe('POST /orders', () => {
  it('creates an order for the authenticated customer', async () => {
    const customer = await givenCustomer(app.db);
    const res = await request(app.server)
      .post('/orders')
      .set('Authorization', `Bearer ${tokenFor(customer)}`)
      .send({ items: [{ sku: 'A', quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/^\/orders\/[0-9a-f-]{36}$/);
    expect(res.body).toMatchObject({ status: 'PENDING', totalAmount: '19.9800' });
  });

  it('rejects invalid input with problem details', async () => {
    const res = await request(app.server)
      .post('/orders')
      .set('Authorization', `Bearer ${tokenFor(await givenCustomer(app.db))}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('returns 401 without a token', async () => {
    await request(app.server).post('/orders').send({ items: [] }).expect(401);
  });
});
```
**Why it's right:**
- The real HTTP pipeline, database engine, and migrations are exercised in-process with no manual setup.
- Each test creates its own data; external HTTP is mocked at the boundary and unexpected calls fail.
- Happy path, validation, and authentication failures are asserted on status, headers, and body.
