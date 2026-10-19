# Aegis AI — Learning + Build Roadmap (Master Plan)

> **For Hermes:** Daily ritual jobs (`aegis-daily-brief` 09:00, `aegis-evening-review` 21:00) pull tasks from this file. Operational state lives in `docs/PROGRESS.md`. Check off tasks only with evidence (git log / passing tests / file existence).
> **Task files:** هر تسک یک فایل کامل دارد در `docs/tasks/` (ایندکس: `docs/tasks/INDEX.md`) — شامل هدف، گام‌ها، فایل‌ها و دستور Verify. جدول زیر فقط زمان‌بندی است.
> **Mode: Learning + Building.** User is an AI programmer with some background — skip absolute basics, practice-first. Capacity: 2–3 h/day → ~30–45 min learning topic + ~1.5–2 h build tasks. The brief writes the day's conceptual summary (Persian) + official doc links in chat.
> **Gate (لغو شد 2026-08-30):** ویدئوی FastAPI از دسترس حذف شد؛ ادامه‌اش ممکن نشد. تصمیم کاربر: یادگیری پروژه‌محور از 2026-08-31 رزومه می‌شود — JWT/Redis/DB درون تسک‌های فاز ۱ (T1.1/T1.3/T1.5) پوشش داده می‌شوند.

**Goal:** Build Aegis AI (production Reliability & Orchestration Platform: Gateway → Context → Reasoning → Policy Gate → Guarded Execution → Verify → Observability) while learning each layer hands-on.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2 async, Alembic, Qdrant, Redis, Celery (Redis broker first), LangGraph, MCP, Langfuse, pytest, Docker Compose, GitHub Actions.

---

## Environment constraints (drive every decision)

| Constraint | Reality | Consequence |
|---|---|---|
| GPU | RTX 3050 Laptop, 4GB VRAM | vLLM NOT feasible locally. llama.cpp (GGUF Q4, 3–8B) or remote OpenAI-compatible API. Abstract `LLMProvider`. |
| OS | Windows 11, no Docker | Day 3 installs Docker Desktop (WSL2). Until then: SQLite + fakes in tests. |
| Python | 3.11.8 | Keep. |
| Capacity | 2–3 h/day | 1–2 build tasks/day max + 1 learning topic. Carry-over allowed; buffer built into Days 27–30. |

## Deviation decisions (from original architecture doc)

1. **pgvector dropped** — Qdrant is the single vector store (dense + sparse hybrid in one engine).
2. **RabbitMQ deferred** — Celery starts with Redis broker.
3. **MLflow deferred** — Langfuse first; MLflow optional (Day 27).
4. **Policy Gate is deny-by-default** + immutable audit table for every decision.
5. **Streaming (SSE) is first-class** (Phase 3).

## 30-Day Schedule (Day 1 = 2026-08-30; shifted +1 day by user decision on 2026-08-29 — Aug 29 was planning-only. Dates below are one day ahead of the actual calendar; follow carry-over, not the Date column)

| Day | Date | 📚 Learn (topic of the day) | 🔨 Build (tasks) |
|---|---|---|---|
| 1 | Aug 29 | Python packaging: pyproject.toml, uv, venv, console entry points | T0.1, T0.2 |
| 2 | Aug 30 | pytest essentials: fixtures, parametrize, monkeypatch; ruff | T0.3, T0.4, T0.6 |
| 3 | Aug 31 | Containers 101: Docker Desktop/WSL2, images vs containers | T0.5, T1.1 |
| 4 | Sep 1 | SQLAlchemy 2.0 async: engine, sessionmaker, unit-of-work | T1.2 |
| 5 | Sep 2 | JWT flows: access/refresh, rotation, expiry trade-offs | T1.3 |
| 6 | Sep 3 | RBAC design + FastAPI dependency injection deep-dive | T1.4 |
| 7 | Sep 4 | Rate-limiting algorithms: fixed/sliding window, token bucket | T1.5 |
| 8 | Sep 5 | RAG pipeline end-to-end map + extraction formats | T2.1 |
| 9 | Sep 6 | Celery semantics: idempotency, retries, eager-mode testing | T2.2 |
| 10 | Sep 7 | Chunking trade-offs: token windows, overlap, heading-aware | T2.3 |
| 11 | Sep 8 | Embeddings: model choice, dims, cosine vs dot, batching | T2.4 |
| 12 | Sep 9 | Qdrant concepts: collections, HNSW, named vectors, payload filters | T2.5 (schema+upsert) |
| 13 | Sep 10 | Hybrid search: dense vs sparse, RRF fusion, top-k tuning | T2.5 (query), T2.6 (opt) |
| 14 | Sep 11 | OpenAI-compatible API surface + provider abstraction patterns | T3.1 |
| 15 | Sep 12 | GGUF quantization + VRAM math for 4GB (KV cache, context len) | T3.2 |
| 16 | Sep 13 | SSE + token streaming mechanics, backpressure | T3.3 |
| 17 | Sep 14 | Context engineering: grounding, citations, lost-in-the-middle | T4.1 |
| 18 | Sep 15 | Tool/function calling: JSON schemas, strict parsing | T4.2 |
| 19 | Sep 16 | Policy patterns: deny-by-default, allowlists, audit trails | T4.3 |
| 20 | Sep 17 | Output validation + retry-with-feedback repair loops | T4.4, T4.5 (opt) |
| 21 | Sep 18 | LangGraph: state machines, edges, checkpointing | T5.1 |
| 22 | Sep 19 | MCP: tools/resources/prompts, stdio vs HTTP transports | T5.2 |
| 23 | Sep 20 | Human-in-the-loop: interrupt/resume, approval UX | T5.3 |
| 24 | Sep 21 | Multi-agent patterns: planner/worker, handoffs | T5.4 |
| 25 | Sep 22 | Tracing: traces/spans/attributes, Langfuse data model | T6.1 |
| 26 | Sep 23 | RAG eval metrics: faithfulness, context recall/precision | T6.2 |
| 27 | Sep 24 | Regression gates in CI; MLflow registry (optional) | T6.3, T6.4 (opt) |
| 28 | Sep 25 | Compose networking, healthchecks, volumes | T7.1 |
| 29 | Sep 26 | Nginx TLS/timeouts + K8s primitives (deploy/svc/probe) | T7.2, T7.3 |
| 30 | Sep 27 | Incident runbooks (short topic) | T7.4 + wrap-up |

Carry-over rule: unfinished build tasks move to the next day first; the learn topic never gets skipped — it shifts with the schedule. Days 27–30 double as buffer.

## Task details (ids used by the ritual)

### Phase 0 — Foundation
- **T0.1 Rename ContextForge → AegisAI** — pyproject name, config `app_name`, README title, `.env`/`.example.env`. Verify: `grep -ri contextforge` empty.
- **T0.2 Scaffold layout** — `app/db/ services/ schemas/ policies/ workers/`, `tests/test_smoke.py` imports `app.main`. Verify: `pytest` green.
- **T0.3 Settings expansion** — `database_url, redis_url, qdrant_url, llm_provider, llm_base_url, llm_api_key, llm_model, jwt_secret, jwt_alg, access_token_expire_min` + `tests/test_config.py` (defaults + env override).
- **T0.4 Green baseline** — `pytest -q` + `ruff check .` clean + commit.
- **T0.5 Docker Desktop** — install (WSL2), `docker run hello-world`.
- **T0.6 CI** — `.github/workflows/ci.yml`: ruff + pytest on 3.11.

### Phase 1 — Gateway & Security
- **T1.1** async DB layer (`app/db/engine.py`, `app/db/base.py`), SQLite+aiosqlite for tests.
- **T1.2** User model (`app/db/models/user.py`: uuid, email, hashed_password, role enum, is_active) + Alembic init + migration. Roundtrip tests.
- **T1.3** JWT auth: `app/core/security.py` + `app/api/auth.py` (register/login/refresh). Tests: happy path, wrong password 401, expired 401.
- **T1.4** RBAC: `app/api/deps.py` `require_roles`, `get_current_user`. Test: 403 for wrong role.
- **T1.5** Rate limiting (Redis fixed-window, in-memory fallback) + CORS. Test: 429 after N.

### Phase 2 — Data Engine
- **T2.1** Document model + `POST /documents` (202 queued) + `GET /documents/{id}`.
- **T2.2** Celery app (Redis broker) + `ingest_document` stub; eager-mode test.
- **T2.3** Extractors (pypdf, python-docx, md/txt) + chunker (token window, overlap, headings). Fixture tests.
- **T2.4** Embedding service (local sentence-transformers or remote API; fake provider for tests).
- **T2.5** Qdrant: collection (dense+sparse named vectors), upsert, hybrid query (RRF), top-k.
- **T2.6** (opt) Cross-encoder rerank top-20→5 behind settings flag.

### Phase 3 — Reasoning
- **T3.1** `LLMProvider` protocol (complete/stream) + `OpenAICompatProvider` (httpx). Fake transport tests.
- **T3.2** llama.cpp `llama-server` (Q4 GGUF 3–7B) or remote API; `llm_provider=local`. Verify: `curl /v1/models`.
- **T3.3** `POST /chat/stream` SSE with trace_id. Test: chunks == full text (fake provider).

### Phase 4 — Harness
- **T4.1** Context Builder: history (Redis) + retrieved docs (Qdrant) + DB facts → grounded payload with citations. Tests: order + truncation policy.
- **T4.2** Action registry: Pydantic schemas per tool (name, params, min_role, constraints); strict proposal parsing.
- **T4.3** Policy Gate: deny-by-default (role, allowlist, constraints) + `policy_audit` table. Tests: blocked→violation, allowed→permit, audit row both cases.
- **T4.4** Verifier: schema validation + business rules + retry-with-feedback (max 2). Tests: invalid→repair→pass.
- **T4.5** (opt) LLM-as-a-Judge quality scoring.

### Phase 5 — Agentic Runtime
- **T5.1** LangGraph loop: reason→propose→gate→execute→verify→respond; Postgres checkpointing.
- **T5.2** MCP client (stdio+http) + first tool server; tools registered in Action registry. Fake MCP test.
- **T5.3** Human-in-the-loop: `POST /approvals/{id}`, graph interrupt/resume, audited.
- **T5.4** Multi-agent planner/worker example with policy checks per hop.

### Phase 6 — Observability & MLOps
- **T6.1** Langfuse tracing middleware (gateway/context/llm/tool/verify spans, token+cost, trace_id in logs).
- **T6.2** Golden dataset `evals/golden/*.json` + eval script (faithfulness, context recall) → Langfuse.
- **T6.3** Regression gate: eval in CI fails on quality drop > threshold.
- **T6.4** (opt) MLflow registry.

### Phase 7 — Hardening & Deploy
- **T7.1** docker-compose: api, worker, postgres, qdrant, redis, llama-server, langfuse + healthchecks.
- **T7.2** Nginx reverse proxy: TLS, gzip, timeouts.
- **T7.3** K8s manifests: Deployments, Services, Secrets, probes.
- **T7.4** README rewrite + incident runbook.

## Verification commands (evening review)

```bash
cd /e/projs/AegisAI
git log --oneline --since="6am"          # today's commits
git status --short                        # uncommitted evidence
python -m pytest -q                       # test suite state
python -m ruff check .                    # lint state
```

## Daily ritual (learning mode)

- **09:00** `aegis-daily-brief`: read ROADMAP + PROGRESS → find today's row (Day N) → in chat: ۸–۱۲ خط خلاصه مفهومی فارسی از مبحث Learn روز + ۲–۳ لینک منبع رسمی → pick 1–2 build tasks → append `### Planned` + `### Learn` to today's `docs/PROGRESS.md` section.
- **21:00** `aegis-evening-review`: evidence (git/pytest/files) → preliminary table → user replies with their report (tasks done + what they learned) → reconcile → append verdict incl. learning recap to `docs/PROGRESS.md`.
- Carry-over: unfinished tasks first candidates tomorrow; a task blocked >2 days gets re-scoped or cancelled explicitly.
