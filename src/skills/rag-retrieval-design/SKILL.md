---
name: rag-retrieval-design
description: "Designing retrieval-augmented generation (RAG) systems: ingestion and document parsing, chunking strategies with metadata, hybrid retrieval (BM25 plus vectors), query rewriting, reranking, access-control filtering at retrieval time, context assembly with citations, grounded answering and abstention, freshness and re-indexing. Use it when building or reviewing RAG pipelines and knowledge assistants."
---

# Skill: RAG Retrieval Design

## Implementation Rules:
- **[ARCHITECTURE]** Separate the pipeline into ingestion (parse, clean, chunk, enrich, embed, index), retrieval (query processing, candidate retrieval, filtering, reranking), and generation (context assembly, grounded prompt, citation, answer validation), each observable and testable on its own.
- **[MANDATORY]** Parse documents with structure preserved (headings, tables, lists, page numbers) and chunk along that structure (sections or paragraphs, typically a few hundred tokens with small overlap) rather than fixed character windows; every chunk carries metadata: source id, title, section path, URL, version, timestamps, language, and access-control attributes.
- **[PATTERN]** Use hybrid retrieval: combine lexical search (BM25) for exact terms, codes, and names with dense vector search for semantics, merge with reciprocal rank fusion, and apply a cross-encoder or LLM-based reranker on the top candidates before building the context.
- **[SECURITY]** Enforce document-level permissions at retrieval time with metadata filters (tenant, group, classification) derived from the authenticated user, never by asking the model to hide content; the index never returns chunks the user cannot read.
- **[PATTERN]** Improve queries when needed: rewrite conversational follow-ups into standalone queries, expand acronyms, and decompose multi-part questions; keep the original query for reranking and answer generation.
- **[MANDATORY]** Assemble context with clear delimiters and source identifiers, order it by relevance, stay within a token budget, and instruct the model to answer only from the provided sources, cite them, and say it does not know when the sources are insufficient.
- **[SECURITY]** Treat retrieved content as untrusted data: it may contain prompt injection; keep it separated from instructions, never let retrieved text trigger tools with side effects without validation, and strip active content during ingestion.
- **[PATTERN]** Keep the index fresh: incremental re-indexing on document change events, deletion propagation (including right-to-erasure requests), versioned embeddings and index rebuilds when the embedding model or chunking strategy changes.
- **[FORBIDDEN]** Stuffing entire documents into the prompt instead of retrieving, answering without citations for factual questions, mixing tenants in one unfiltered index, and changing chunking or embedding models without re-evaluating retrieval quality.
- **[PERFORMANCE]** Retrieve a generous candidate set (for example 50) cheaply and rerank to a small context (for example 5-8 chunks); cache embeddings of repeated queries and measure retrieval latency separately from generation latency.
- **[TESTING]** Evaluate retrieval with a labeled set of questions and relevant chunks (recall@k, MRR, nDCG) and end-to-end answers for groundedness and citation correctness; run these evaluations in CI whenever chunking, embeddings, prompts, or rerankers change.
- **[REFERENCE]** See `EXAMPLES.md` in this folder for reference anti-patterns and best practices.
