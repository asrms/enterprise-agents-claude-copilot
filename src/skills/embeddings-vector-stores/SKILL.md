---
name: embeddings-vector-stores
description: "Choosing and operating embeddings and vector databases: embedding model selection and evaluation, dimensions and normalization, distance metrics, vector stores (pgvector, OpenSearch, Elasticsearch, Qdrant, Weaviate, Pinecone, Milvus), HNSW and IVF index tuning, metadata filtering, multi-tenancy, re-embedding and index versioning, quantization, and cost. Use it when storing and searching embeddings for search, RAG, or recommendations."
---

# Skill: Embeddings and Vector Stores

## Implementation Rules:
- **[MANDATORY]** Select the embedding model by evaluating it on your own queries and documents (recall@k on a labeled set), considering language coverage, domain, maximum input length, dimensions, cost, and latency; public leaderboard results are a starting point, not a decision.
- **[MANDATORY]** Record the embedding model name and version with every vector (or per index) and never mix vectors from different models or preprocessing in the same index; changing the model means re-embedding into a new index version.
- **[PATTERN]** Use the distance metric the model was trained for (cosine or dot product on normalized vectors in most cases), normalize consistently at write and query time, and use query/document prefixes or task types when the model requires them.
- **[ARCHITECTURE]** Prefer extending an existing database when scale allows (PostgreSQL with pgvector, OpenSearch/Elasticsearch vector fields) to keep transactions, filtering, and operations simple; adopt a dedicated vector database (Qdrant, Weaviate, Milvus, Pinecone) when scale, filtering performance, or features justify it.
- **[PERFORMANCE]** Tune approximate nearest neighbor indexes deliberately: HNSW `m` and `ef_construction` at build time and `ef_search` at query time (or IVF lists and probes), measuring recall against exact search and latency at the target percentile.
- **[PATTERN]** Store filterable metadata (tenant, access groups, document type, language, timestamps) alongside vectors, index those fields, and apply filters inside the vector query rather than post-filtering a small top-k.
- **[SECURITY]** Isolate tenants with mandatory filters, separate collections/namespaces, or separate databases according to the isolation requirements; embeddings can leak information about source text, so protect them with the same access controls and retention as the original data.
- **[PERFORMANCE]** Control cost and memory: batch embedding requests, cache embeddings by content hash to avoid recomputation, consider reduced dimensions (Matryoshka-capable models) or quantization (scalar, binary, product) with measured recall impact.
- **[FORBIDDEN]** Re-embedding the whole corpus in place without a new index version and cut-over plan, storing vectors without a link to the source record, unbounded top-k queries, and deleting source documents without deleting their vectors.
- **[PATTERN]** Build pipelines for change: incremental upserts on document change, deletes propagated by source id, blue-green index versions for model changes with an alias switch after evaluation.
- **[TESTING]** Keep a benchmark set of queries with expected results, run it on every change of model, chunking, index parameters, or quantization, and monitor production recall proxies (click-through, citation use) and query latency.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
