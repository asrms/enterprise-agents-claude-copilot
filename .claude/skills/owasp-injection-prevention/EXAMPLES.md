# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Order search with filters and dynamic ORDER BY (Java/Spring)
```java
@Repository
public class OrderRepositoryImpl implements OrderRepositoryCustom {

    @PersistenceContext
    private EntityManager em;

    @Override
    @SuppressWarnings("unchecked")
    public List<Order> search(String customerId, String status, String sortBy, String dir) {
        // query built "for flexibility"
        String sql = "SELECT * FROM orders WHERE customer_id = '" + customerId + "'";
        if (status != null && !status.isBlank()) {
            sql += " AND status = '" + status.replace("'", "''") + "'";
        }
        sql += " ORDER BY " + sortBy + " " + dir;
        return em.createNativeQuery(sql, Order.class).getResultList();
    }
}

@RestController
@RequestMapping("/api/orders")
class OrderController {

    private final OrderRepositoryCustom repo;

    OrderController(OrderRepositoryCustom repo) {
        this.repo = repo;
    }

    @GetMapping
    List<Order> list(@RequestParam String customerId,
                     @RequestParam(required = false) String status,
                     @RequestParam(defaultValue = "created_at") String sortBy,
                     @RequestParam(defaultValue = "DESC") String dir) {
        return repo.search(customerId, status, sortBy, dir);
    }
}
```
**Why it's wrong:**
- `customerId` is concatenated: with `' OR '1'='1` the query returns every customer's orders (CWE-89, A03:2021-Injection).
- Manually escaping quotes on `status` is not a recognized defense and does not protect `sortBy`/`dir` at all, which end up in the SQL text and allow data extraction by inference through `CASE WHEN` expressions.
- `customerId` taken from the query string instead of the authenticated user is also an IDOR (CWE-639, A01:2021).
- No limit on results: a single request can extract the entire table.

### 2. Password reset confirmation and product search (Node.js/TypeScript + MongoDB)
```typescript
import express from 'express';
import bcrypt from 'bcrypt';
import { User, Product } from './models';

const app = express();
app.use(express.json());

app.post('/api/password-reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  // token can be a JSON object: {"$ne": null}
  const user = await User.findOne({ resetToken: token, resetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: 'Invalid token' });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetToken = undefined;
  await user.save();
  res.status(204).end();
});

app.get('/api/products', async (req, res) => {
  const filter: Record<string, unknown> = {};
  // with the "extended" query parser ?category[$ne]=x becomes an object
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) filter.$where = `this.name.includes('${req.query.q}')`;
  const products = await Product.find(filter).limit(50);
  res.json(products);
});

app.listen(3000);
```
**Why it's wrong:**
- `{"token": {"$ne": null}}` matches the first user with a pending reset: the attacker sets another account's password without knowing the token (CWE-943, A03:2021; outcome account takeover, A07:2021).
- An untyped `req.query.category` allows MongoDB operators injected from the query string.
- `$where` with interpolation executes JavaScript on the database with user input (CWE-94).
- The reset token is stored in plaintext and `newPassword` has no length constraints.

### 3. File download and thumbnail generation (Python/FastAPI)
```python
import os
import subprocess
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse

app = FastAPI()
UPLOAD_DIR = "/srv/app/uploads"


@app.get("/files/download")
def download(name: str = Query(...)):
    # "anti traversal" filter
    safe_name = name.replace("../", "")
    return FileResponse(os.path.join(UPLOAD_DIR, safe_name))


@app.post("/files/{name}/thumbnail")
def thumbnail(name: str, width: str = "200"):
    src = os.path.join(UPLOAD_DIR, name)
    dst = src + ".thumb.png"
    # command built as a string and executed by /bin/sh
    cmd = f"convert {src} -resize {width}x {dst}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return {"error": result.stderr}
    return {"thumbnail": os.path.basename(dst)}
```
**Why it's wrong:**
- `....//` becomes `../` after the `replace`, and an absolute name such as `/etc/passwd` makes `os.path.join` discard `UPLOAD_DIR`: arbitrary file read (CWE-22, A01:2021).
- `shell=True` with interpolated `name` and `width` allows chaining commands (`200; id`) with the process's privileges (CWE-78, A03:2021).
- `stderr` returned to the client exposes paths and tool versions (CWE-209).
- No ownership check: anyone can read or process other users' files (CWE-639).

## Best Practice (How to do it right)

### 1. Order search with filters and dynamic ORDER BY (Java/Spring)
```java
@Repository
public class OrderRepositoryImpl implements OrderRepositoryCustom {

    // allowlist: key exposed by the API -> physical column
    private static final Map<String, String> SORTABLE = Map.of(
        "createdAt", "created_at",
        "total", "total_amount",
        "status", "status");

    @PersistenceContext
    private EntityManager em;

    @Override
    @SuppressWarnings("unchecked")
    public List<Order> search(UUID customerId, OrderStatus status, String sortBy, String dir) {
        String column = SORTABLE.get(sortBy);
        if (column == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sortBy not allowed");
        }
        String direction = "asc".equalsIgnoreCase(dir) ? "ASC" : "DESC";

        StringBuilder sql = new StringBuilder("SELECT * FROM orders WHERE customer_id = :customerId");
        if (status != null) {
            sql.append(" AND status = :status");
        }
        // only values coming from the allowlist enter the SQL text
        sql.append(" ORDER BY ").append(column).append(' ').append(direction);

        Query query = em.createNativeQuery(sql.toString(), Order.class)
                        .setParameter("customerId", customerId);
        if (status != null) {
            query.setParameter("status", status.name());
        }
        return query.setMaxResults(200).getResultList();
    }
}

@RestController
@RequestMapping("/api/orders")
class OrderController {

    private final OrderRepositoryCustom repo;

    OrderController(OrderRepositoryCustom repo) {
        this.repo = repo;
    }

    @GetMapping
    List<Order> list(@AuthenticationPrincipal AppUser user,
                     @RequestParam(required = false) OrderStatus status,
                     @RequestParam(defaultValue = "createdAt") String sortBy,
                     @RequestParam(defaultValue = "desc") String dir) {
        // the customer derives from the authenticated principal, never from the request
        return repo.search(user.getCustomerId(), status, sortBy, dir);
    }
}
```
**Why it's right:**
- Values (`customerId`, `status`) travel as bind parameters: the driver always treats them as data.
- Column and direction, which cannot be parameterized, are chosen from a closed allowlist: user input selects a key but never enters the SQL text.
- `OrderStatus` as an enum rejects unexpected values already at binding time (400) and `setMaxResults` limits mass extraction.
- The customer is derived from `@AuthenticationPrincipal`, eliminating the IDOR as well.

### 2. Password reset confirmation and product search (Node.js/TypeScript + MongoDB)
```typescript
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User, Product } from './models';

// objects with keys starting with "$" in filters are neutralized with $eq
mongoose.set('sanitizeFilter', true);

const app = express();
app.set('query parser', 'simple'); // flat query string, no nested objects
app.use(express.json({ limit: '10kb' }));

const ResetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  newPassword: z.string().min(12).max(128),
}).strict();
const ProductQuery = z.object({
  category: z.string().max(40).optional(),
  q: z.string().max(60).optional(),
});

app.post('/api/password-reset/confirm', async (req, res) => {
  const parsed = ResetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  // atomic, single-use consumption; the $gt operator is explicitly trusted
  const user = await User.findOneAndUpdate(
    { resetTokenHash: tokenHash, resetExpires: mongoose.trusted({ $gt: new Date() }) },
    { $set: { passwordHash }, $unset: { resetTokenHash: 1, resetExpires: 1 } },
  );
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  res.status(204).end();
});

app.get('/api/products', async (req, res) => {
  const parsed = ProductQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid parameters' });
  const filter: Record<string, unknown> = {};
  if (parsed.data.category) filter.category = parsed.data.category;
  if (parsed.data.q) {
    // substring search with an escaped regex, no $where
    const escaped = parsed.data.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = mongoose.trusted({ $regex: escaped, $options: 'i' });
  }
  res.json(await Product.find(filter).limit(50).lean());
});

app.listen(3000);
```
**Why it's right:**
- zod enforces that `token`, `category`, and `q` are strings with a defined format and length: an object `{"$ne": null}` is rejected with 400.
- `sanitizeFilter` and the `simple` query parser are a second barrier; only developer-written operators pass via `mongoose.trusted()`.
- `$where` is eliminated and the search uses a regex with escaped, length-limited input, also avoiding ReDoS.
- The reset token is compared as a SHA-256 hash and consumed atomically, so it is single-use.

### 3. File download and thumbnail generation (Python/FastAPI)
```python
import subprocess
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .auth import User, get_current_user
from .repo import file_repo

app = FastAPI()
UPLOAD_DIR = Path("/srv/app/uploads").resolve()


def resolve_upload(file_id: uuid.UUID, suffix: str = "") -> Path:
    # the on-disk name derives from the UUID: user input never enters the path
    candidate = (UPLOAD_DIR / f"{file_id}{suffix}").resolve()
    if not candidate.is_relative_to(UPLOAD_DIR):  # defense in depth (symlinks)
        raise HTTPException(status_code=400, detail="Invalid path")
    return candidate


def owned_file(file_id: uuid.UUID, user: User = Depends(get_current_user)) -> uuid.UUID:
    if not file_repo.is_owner(file_id, user.id):
        raise HTTPException(status_code=404, detail="File not found")
    return file_id


@app.get("/files/{file_id}")
def download(fid: uuid.UUID = Depends(owned_file)):
    path = resolve_upload(fid)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=str(fid), media_type="application/octet-stream")


class ThumbRequest(BaseModel):
    width: int = Field(200, ge=16, le=2048)


@app.post("/files/{file_id}/thumbnail")
def thumbnail(req: ThumbRequest, fid: uuid.UUID = Depends(owned_file)):
    src, dst = resolve_upload(fid), resolve_upload(fid, ".thumb.png")
    try:
        # argument list: no shell, no metacharacter interpretation
        subprocess.run(["convert", str(src), "-resize", f"{req.width}x", str(dst)],
                       shell=False, check=True, timeout=30, capture_output=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise HTTPException(status_code=422, detail="Unable to generate the thumbnail")
    return {"thumbnail": dst.name}
```
**Why it's right:**
- `file_id` is a `UUID` validated by FastAPI: the on-disk name never contains free input and `resolve()` + `is_relative_to()` confirm containment even in the presence of symlinks.
- `subprocess.run` with an argument list and `shell=False` does not go through `/bin/sh`; `width` is a bounded integer, so it cannot carry additional arguments.
- `timeout` prevents malformed files from blocking the worker and the returned error is generic, without `stderr`.
- The `owned_file` dependency applies the ownership check to both routes, returning 404 for other users' files.
