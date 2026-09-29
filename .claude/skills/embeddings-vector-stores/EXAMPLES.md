# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Mixed models, no metadata, post-filtering
```python
# half the corpus embedded with model A last year, new documents with model B
vectors.upsert(id=doc_id, vector=embed_with_model_b(text))           # incompatible vector spaces
hits = vectors.query(vector=q, top_k=5)                               # search across all tenants
hits = [h for h in hits if h.tenant == user.tenant]                   # post-filter: often returns 0-1 results
```
**Why it's wrong:**
- Vectors from different models are not comparable, so similarity scores are meaningless across the corpus.
- Post-filtering a tiny top-k loses relevant results and relies on application code for tenant isolation.

## Best Practice (How to do it right)

### 1. pgvector table with versioned embeddings, HNSW index, and filtered search
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE doc_chunk_embedding (
  chunk_id         uuid PRIMARY KEY REFERENCES doc_chunk (id) ON DELETE CASCADE,
  tenant_id        bigint      NOT NULL,
  embedding_model  text        NOT NULL,                  -- for example 'text-embed-v3@1024'
  embedding        vector(1024) NOT NULL,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_chunk_embedding_hnsw
  ON doc_chunk_embedding USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
CREATE INDEX ix_chunk_embedding_tenant ON doc_chunk_embedding (tenant_id);

-- per query: raise ef_search for better recall, filter by tenant inside the query
SET LOCAL hnsw.ef_search = 100;
SET LOCAL hnsw.iterative_scan = relaxed_order;           -- keeps scanning when filters remove candidates
SELECT c.id, c.title, 1 - (e.embedding <=> $1) AS similarity
FROM   doc_chunk_embedding e
JOIN   doc_chunk c ON c.id = e.chunk_id
WHERE  e.tenant_id = $2
AND    e.embedding_model = 'text-embed-v3@1024'
ORDER  BY e.embedding <=> $1
LIMIT  50;
```
### 2. Recall check against exact search when tuning
```python
def recall_at_k(queries, k=10):
    hits = 0
    for q in queries:
        approx = set(search_hnsw(q.vector, tenant=q.tenant, k=k))
        exact = set(search_exact(q.vector, tenant=q.tenant, k=k))      # sequential scan on a sample
        hits += len(approx & exact)
    return hits / (k * len(queries))

assert recall_at_k(benchmark_queries) >= 0.95
```
**Why it's right:**
- Every vector records its model, deletions cascade from source chunks, and tenant filtering happens inside the query.
- HNSW parameters are explicit and validated against exact search, with iterative scans so filtered queries still return enough results.
