# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unbounded embedded array and raw filters (MongoDB, Node.js)
```javascript
// product document keeps every review ever written
await db.collection('products').updateOne(
  { _id: productId },
  { $push: { reviews: { user, text, rating, at: new Date() } } }
);

// login handler passes the request body straight into the filter
const user = await db.collection('users').findOne({ email: req.body.email, password: req.body.password });
```
**Why it's wrong:**
- `reviews` grows without limit toward the 16 MB cap; every read of a product loads all reviews.
- A body like `{ "email": "a@b.c", "password": { "$ne": null } }` bypasses the password check (NoSQL injection), and passwords are compared in plain text.

### 2. Low-cardinality partition key (DynamoDB)
```text
Table: Orders   PK = status ("PENDING" | "PAID" | "SHIPPED")
Query: all PENDING orders of customer 42  -> Scan + FilterExpression
```
**Why it's wrong:**
- Three partition key values create hot partitions and throttling.
- The customer access pattern requires a `Scan`, whose cost grows with the whole table.

## Best Practice (How to do it right)

### 1. Bounded embedding plus reference (MongoDB)
```javascript
// products: keep a bounded summary and the latest reviews only
{
  _id: ObjectId('...'),
  schemaVersion: 2,
  name: 'Trail Shoe',
  rating: { avg: 4.6, count: 1287 },
  latestReviews: [ /* at most 5, maintained with $push + $slice */ ]
}

// reviews: separate collection, indexed for the product page query (ESR: equality, sort)
db.reviews.createIndex({ productId: 1, createdAt: -1 });

await db.collection('products').updateOne(
  { _id: productId },
  { $push: { latestReviews: { $each: [review], $sort: { at: -1 }, $slice: 5 } },
    $inc: { 'rating.count': 1 } }
);

// typed input only: never pass request objects as filters
const email = String(req.body.email);
const user = await db.collection('users').findOne({ email });
const ok = user && await argon2.verify(user.passwordHash, String(req.body.password));
```
**Why it's right:**
- Documents stay bounded; the full review list is paginated from its own indexed collection.
- Filters are built from coerced scalar values, and passwords are verified against a hash.

### 2. Single-table design for known access patterns (DynamoDB)
```text
Access patterns:
  AP1 get customer profile            PK = CUSTOMER#42   SK = PROFILE
  AP2 list orders of a customer       PK = CUSTOMER#42   SK begins_with ORDER#   (sorted by date)
  AP3 get order by id                 GSI1PK = ORDER#9f1c  GSI1SK = ORDER#9f1c
  AP4 list pending orders by day      GSI2PK = PENDING#2026-09-29#<shard 0-9>  GSI2SK = <createdAt>

Item: { PK: "CUSTOMER#42", SK: "ORDER#2026-09-29T10:15:00Z#9f1c", status: "PENDING",
        GSI1PK: "ORDER#9f1c", GSI1SK: "ORDER#9f1c",
        GSI2PK: "PENDING#2026-09-29#3", GSI2SK: "2026-09-29T10:15:00Z", version: 1 }
```
**Why it's right:**
- Every access pattern is a `GetItem` or `Query` on a key; no scans.
- High-cardinality keys spread traffic, and write sharding avoids a hot partition for the status index.
- The `version` attribute supports conditional writes for optimistic locking.
