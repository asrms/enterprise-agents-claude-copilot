# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unhardened Express server
```javascript
const app = express();
app.use(cors());                       // any origin
app.use(express.json());               // default limits, no validation

app.get('/users/:id', async (req, res) => {
  const user = await db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);
  res.json(user);                      // returns password hash and internal fields
});

app.use((err, req, res, next) => res.status(500).send(err.stack));
app.listen(3000);
```
**Why it's wrong:**
- SQL injection through string interpolation, no input validation, and the whole row is returned.
- Stack traces are sent to clients; no security headers, rate limiting, timeouts, or graceful shutdown.

## Best Practice (How to do it right)

### 1. Hardened Fastify server with TypeBox schemas
```typescript
import Fastify from 'fastify';
import { Type } from '@sinclair/typebox';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import closeWithGrace from 'close-with-grace';

const app = Fastify({
  bodyLimit: 1_048_576,
  requestTimeout: 10_000,
  keepAliveTimeout: 72_000,
  logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.authorization', '*.password'] },
  ajv: { customOptions: { removeAdditional: false } },
});

await app.register(helmet);
await app.register(cors, { origin: ['https://app.example.com'], credentials: true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute', redis });

const UserParams = Type.Object({ id: Type.String({ format: 'uuid' }) }, { additionalProperties: false });
const UserResponse = Type.Object({ id: Type.String(), displayName: Type.String() });

app.get('/users/:id', { schema: { params: UserParams, response: { 200: UserResponse } } }, async (req, reply) => {
  const user = await users.findById(req.params.id);            // parameterized query inside the repository
  if (!user) return reply.code(404).type('application/problem+json').send({ title: 'Not Found', status: 404 });
  return user;                                                 // serialized through UserResponse only
});

app.setErrorHandler((err, req, reply) => {
  if (err.validation) {
    return reply.code(400).type('application/problem+json').send({ title: 'Invalid request', status: 400, errors: err.validation });
  }
  req.log.error({ err }, 'unhandled error');
  return reply.code(500).type('application/problem+json').send({ title: 'Internal Server Error', status: 500 });
});

app.get('/health/live', async () => ({ status: 'ok' }));

closeWithGrace({ delay: 10_000 }, async () => { await app.close(); });
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) });
```
**Why it's right:**
- Params and responses are schema-validated and serialized; no internal fields can leak.
- Security headers, a strict CORS allow-list, distributed rate limiting, body limits, and timeouts are configured.
- Errors map to problem details without stack traces, logs redact secrets, and shutdown is graceful.
