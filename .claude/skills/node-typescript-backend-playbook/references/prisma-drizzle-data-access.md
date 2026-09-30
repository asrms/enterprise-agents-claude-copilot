# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Unsafe raw SQL, full rows, N+1, and a race (Prisma)
```typescript
export async function listOrders(sort: string, customerIds: string[]) {
  const result = [];
  for (const id of customerIds) {
    const customer = await prisma.customer.findUnique({ where: { id } });   // one query per id
    const orders = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Order" WHERE "customerId" = '${id}' ORDER BY ${sort}`  // SQL injection
    );
    result.push({ customer, orders });                                      // returns every column
  }
  return result;
}

export async function reserve(productId: string, qty: number) {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (p!.stock >= qty) {
    await prisma.product.update({ where: { id: productId }, data: { stock: p!.stock - qty } }); // lost update
  }
}
```
**Why it's wrong:**
- Interpolated input and a client-controlled `ORDER BY` enable SQL injection.
- N+1 queries and `SELECT *` including sensitive columns.
- Read-then-write lets two concurrent requests oversell stock.

## Best Practice (How to do it right)

### 1. Safe, batched, selective queries and an atomic update (Prisma)
```typescript
const SORTABLE = { createdAt: 'createdAt', total: 'totalAmount' } as const;
type SortKey = keyof typeof SORTABLE;

export async function listOrders(customerIds: string[], sort: SortKey, cursor?: string) {
  return prisma.order.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true, status: true, totalAmount: true, createdAt: true,
              customer: { select: { id: true, displayName: true } } },
    orderBy: [{ [SORTABLE[sort]]: 'desc' }, { id: 'desc' }],
    take: 50,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
  });
}

export async function reserve(productId: string, qty: number): Promise<boolean> {
  const { count } = await prisma.product.updateMany({
    where: { id: productId, stock: { gte: qty } },
    data: { stock: { decrement: qty } },
  });
  return count === 1;   // atomic check-and-decrement in a single statement
}
```
**Why it's right:**
- Sort fields come from an allow-list; relations are loaded in the same query with explicit fields.
- Cursor pagination bounds the result; the conditional update prevents overselling without locks.

### 2. Drizzle with a transaction and parameterized SQL
```typescript
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders)
    .values({ customerId, status: 'PENDING', totalAmount: total })
    .returning({ id: orders.id });
  await tx.insert(orderLines).values(lines.map((l) => ({ orderId: order.id, sku: l.sku, quantity: l.quantity })));
  await tx.execute(sql`SELECT pg_notify('orders', ${order.id})`);
});
```
**Why it's right:**
- The order and its lines are written atomically with a single bulk insert for the lines.
- The `sql` template parameterizes the value instead of concatenating it.
