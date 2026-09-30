# Practical Examples

## Anti-Pattern (What NOT to do)

### 1. Blocking calls and CPU-bound work inside an async route
```python
import requests
from fastapi import APIRouter, UploadFile
from pypdf import PdfReader

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/analyze")
async def analyze_document(file: UploadFile) -> dict[str, object]:
    # parsing a 400-page PDF directly on the event loop
    reader = PdfReader(file.file)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    # synchronous client, no timeout, new connection on every request
    resp = requests.post(
        "https://classifier.internal.example.com/v1/classify",
        json={"text": text},
    )
    return {"pages": len(reader.pages), "labels": resp.json()["labels"]}
```
**Why it's wrong:**
- `requests.post` is blocking and has no default timeout: a single slow call freezes the event loop and every request on the worker.
- PDF parsing is CPU-bound and runs on the event loop, with no limit on file size or on concurrent parsing.
- New TCP/TLS connection on every call, no `raise_for_status()`, and the upstream response is not validated.

### 2. Per-request HTTP client and unbounded concurrency toward the upstream
```python
import asyncio

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/summaries", tags=["summaries"])
SUMMARIZER_URL = "https://summarizer.internal.example.com"


class BatchRequest(BaseModel):
    document_ids: list[str]


@router.post("/batch")
async def batch_summaries(body: BatchRequest) -> list[str]:
    async def summarize_one(doc_id: str) -> str:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{SUMMARIZER_URL}/v1/summarize", json={"doc_id": doc_id})
            return str(response.json()["summary"])

    return await asyncio.gather(*(summarize_one(doc_id) for doc_id in body.document_ids))
```
**Why it's wrong:**
- One `AsyncClient` per document: no pooling, repeated TLS handshakes, and the risk of exhausting file descriptors and ephemeral ports.
- Unbounded concurrency (5,000 IDs → 5,000 simultaneous requests): the upstream answers 429/503 to every tenant, and the input list has no length limit.
- Implicit timeouts (5 s) not tuned to the upstream, no status check, and `gather` lets the other tasks keep running when one fails.

### 3. BackgroundTasks for heavy jobs and in-memory state
```python
from fastapi import APIRouter, BackgroundTasks

router = APIRouter(prefix="/documents", tags=["documents"])
_jobs: dict[str, str] = {}


async def _run_summary(service: SummaryService, document_id: str) -> None:
    _jobs[document_id] = "running"
    await service.summarize_and_store(document_id)  # 300 pages, 20 LLM calls, 3-8 minutes
    _jobs[document_id] = "done"


@router.post("/{document_id}/summaries")
async def request_summary(
    document_id: str, background_tasks: BackgroundTasks, service: SummaryServiceDep
) -> dict[str, str]:
    background_tasks.add_task(_run_summary, service, document_id)
    return {"status": "started"}


@router.get("/{document_id}/summaries/status")
async def summary_status(document_id: str) -> dict[str, str]:
    return {"status": _jobs.get(document_id, "unknown")}
```
**Why it's wrong:**
- `BackgroundTasks` runs in the web process after the response: the job is lost on every crash, redeploy, or scale-in, and it consumes the HTTP worker's memory and event loop.
- No deduplication or retry: a double click doubles LLM costs; an error leaves the status at `"running"` forever.
- State in a global `dict` is not shared across workers and replicas; resources from a `yield` dependency (DB session) are not guaranteed in background tasks since FastAPI 0.106.

## Best Practice (How to do it right)

### 1. Blocking calls and CPU-bound work inside an async route
```python
# app/infrastructure/documents/analyzer.py
import io

import anyio
import httpx
from pydantic import BaseModel
from pypdf import PdfReader

from app.domain.documents.entities import DocumentAnalysis


class ClassifyResponse(BaseModel):
    labels: list[str]


def _extract_text(data: bytes) -> tuple[int, str]:
    # CPU-bound and synchronous: runs in a worker thread, never on the event loop
    reader = PdfReader(io.BytesIO(data))
    return len(reader.pages), "\n".join(page.extract_text() or "" for page in reader.pages)


class DocumentAnalyzer:
    def __init__(self, client: httpx.AsyncClient, pdf_limiter: anyio.CapacityLimiter) -> None:
        self._client = client  # shared, created in the lifespan with Timeout and Limits
        self._pdf_limiter = pdf_limiter  # e.g. CapacityLimiter(4): max 4 concurrent parses

    async def analyze(self, data: bytes) -> DocumentAnalysis:
        pages, text = await anyio.to_thread.run_sync(_extract_text, data, limiter=self._pdf_limiter)
        response = await self._client.post("/v1/classify", json={"text": text})
        response.raise_for_status()
        labels = ClassifyResponse.model_validate_json(response.content).labels
        return DocumentAnalysis(pages=pages, labels=labels)


# app/api/v1/documents.py
@router.post("/analyze", response_model=AnalysisOut)
async def analyze_document(file: UploadFile, analyzer: DocumentAnalyzerDep) -> AnalysisOut:
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    data = await file.read()
    return AnalysisOut.model_validate(await analyzer.analyze(data), from_attributes=True)
```
**Why it's right:**
- Parsing runs in a thread via `anyio.to_thread.run_sync` with a dedicated `CapacityLimiter`, without saturating the shared threadpool.
- I/O uses the shared `AsyncClient` with timeouts and limits from config; upstream status and payload are verified.
- The route stays thin and rejects oversized files immediately, before reading them into memory.

### 2. Per-request HTTP client and unbounded concurrency toward the upstream
```python
# app/infrastructure/summarizer.py
import asyncio
from collections.abc import Sequence

import httpx
from pydantic import BaseModel

from app.domain.errors import UpstreamSaturatedError


class SummaryPayload(BaseModel):
    summary: str


class SummarizerClient:
    def __init__(self, client: httpx.AsyncClient, semaphore: asyncio.Semaphore, acquire_timeout_s: float) -> None:
        # client created in the lifespan with:
        #   timeout=httpx.Timeout(settings.summarizer.read_timeout_s, connect=2.0, pool=1.0)
        #   limits=httpx.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=30.0)
        # semaphore = asyncio.Semaphore(settings.summarizer.max_concurrency), also in the lifespan
        self._client = client
        self._semaphore = semaphore
        self._acquire_timeout_s = acquire_timeout_s

    async def _summarize_one(self, doc_id: str) -> str:
        try:
            async with asyncio.timeout(self._acquire_timeout_s):
                await self._semaphore.acquire()
        except TimeoutError:
            raise UpstreamSaturatedError("summarizer") from None  # handler → 503 + Retry-After
        try:
            response = await self._client.post("/v1/summarize", json={"doc_id": doc_id})
            response.raise_for_status()
            return SummaryPayload.model_validate_json(response.content).summary
        finally:
            self._semaphore.release()

    async def summarize_many(self, doc_ids: Sequence[str]) -> list[str]:
        # doc_ids already bounded by the schema: Field(min_length=1, max_length=20)
        try:
            async with asyncio.TaskGroup() as tg:
                tasks = [tg.create_task(self._summarize_one(doc_id)) for doc_id in doc_ids]
        except ExceptionGroup as eg:
            if eg.subgroup(UpstreamSaturatedError) is not None:
                raise UpstreamSaturatedError("summarizer") from eg
            raise
        return [task.result() for task in tasks]
```
**Why it's right:**
- A single pooled client with explicit `Timeout` and `Limits`; the semaphore caps concurrent calls per process toward the upstream.
- Waiting on the semaphore has a timeout: under saturation, respond 503 with `Retry-After` immediately instead of piling up requests.
- `TaskGroup` cancels sibling tasks on the first error, and the `ExceptionGroup` is translated into an explicit domain error.

### 3. BackgroundTasks for heavy jobs and in-memory state
```python
# app/api/v1/summaries.py
from typing import Annotated
from uuid import UUID

from arq.connections import ArqRedis
from arq.jobs import Job
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(tags=["summaries"])
ArqDep = Annotated[ArqRedis, Depends(get_arq_pool)]


@router.post("/documents/{document_id}/summaries", response_model=JobAccepted,
             status_code=status.HTTP_202_ACCEPTED)
async def request_summary(document_id: UUID, principal: SummaryRequester, arq: ArqDep) -> JobAccepted:
    job_id = f"summarize:{principal.tenant_id}:{document_id}"
    # _job_id deduplicates: if a job with the same id already exists, enqueue_job returns None
    await arq.enqueue_job("summarize_document", str(document_id), principal.tenant_id, _job_id=job_id)
    return JobAccepted(job_id=job_id, status_url=f"/api/v1/jobs/{job_id}")


@router.get("/jobs/{job_id}", response_model=JobStatusOut)
async def job_status(job_id: str, principal: SummaryRequester, arq: ArqDep) -> JobStatusOut:
    if not job_id.startswith(f"summarize:{principal.tenant_id}:"):
        raise HTTPException(status_code=404, detail="job_not_found")
    job_state = await Job(job_id, redis=arq).status()
    return JobStatusOut(job_id=job_id, status=job_state.value)


# app/worker.py (start: arq app.worker.WorkerSettings)
from typing import Any

from arq import func
from arq.connections import RedisSettings


async def summarize_document(ctx: dict[str, Any], document_id: str, tenant_id: str) -> str:
    service: SummaryService = ctx["summary_service"]
    return await service.summarize_and_store(UUID(document_id), tenant_id=tenant_id)


async def startup(ctx: dict[str, Any]) -> None:
    ctx["resources"] = await WorkerResources.create(get_settings())
    ctx["summary_service"] = ctx["resources"].summary_service()


async def shutdown(ctx: dict[str, Any]) -> None:
    await ctx["resources"].aclose()


class WorkerSettings:
    functions = [func(summarize_document, timeout=900, max_tries=3)]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url.get_secret_value())
    max_jobs = 4
```
**Why it's right:**
- The job is persisted in Redis and executed by dedicated workers: it survives redeploys of the web service, with explicit `timeout` and `max_tries`.
- A deterministic `_job_id` prevents duplicate jobs; the route responds `202` immediately with a status endpoint shared across all replicas.
- The status is visible only to the owning tenant, and the worker's resources have their own lifecycle (`on_startup`/`on_shutdown`).
