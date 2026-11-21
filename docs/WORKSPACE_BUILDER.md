# AegisAI Workspace & Workflow Builder — v1

## Scope

This is an AegisAI-specific builder, not n8n feature parity. Chat and document attachments share one workspace. Agents, workflows, run history, and approvals have dedicated screens. The existing document URLs redirect to chat.

Supported workflow nodes:

- **Start:** passes the run input to the next node.
- **LLM:** applies a prompt and optionally an owned agent definition (system prompt/model/approval requirement).
- **Retrieve Documents:** searches indexed documents belonging to the original run owner.
- **Tool:** executes a registered `search_docs` or `get_document` action through the policy gate and output verifier.
- **Condition:** tests whether the previous text contains a configured string, then follows the `true` or `false` edge.
- **Human Approval:** persists a pause before execution continues.
- **End:** records the final output.

Use `{{input}}` for the original run input and `{{previous}}` for the previous result. No Python, JavaScript, shell evaluation, arbitrary HTTP nodes, cron triggers, or parallel execution are supported. Agent definitions do not enable autonomous tool loops: explicit Tool nodes control execution in v1.

## Local setup

Use Python 3.11 (the CI version) and Node 22+. Run commands from the repository root unless a different directory is shown.

```powershell
uv sync --python 3.11 --extra dev
uv run alembic upgrade head
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend `.env` variables:

```dotenv
ENVIRONMENT=development
DATABASE_URL=sqlite+aiosqlite:///./aegis.db
LLM_PROVIDER=openai_compat
PROVIDER_URL=https://api.openai.com/v1
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
```

Set `API_KEY`, `MODEL_NAME`, and a strong `JWT_SECRET` locally. Optional Langfuse uses `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL`. Do not commit real secrets or put them in `NEXT_PUBLIC_*` variables.

Frontend `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Visit `http://localhost:3000`. Register/login before using chat and builder APIs.

Document ingestion additionally needs Redis, Qdrant, and a Celery worker. API and worker must use the same database and shared uploads directory. On Windows a local development worker can use the solo pool:

```powershell
uv run celery -A app.workers.celery_app:celery_app worker --pool=solo --loglevel=info
```

Select a real embedding provider for meaningful semantic retrieval; the default fake embeddings are for plumbing tests, not retrieval quality. Keep embedding dimensions consistent with the Qdrant collection; changing models usually requires a new collection and re-ingestion.

## Verification paths

1. **Chat:** send a message; confirm streaming text and trace ID. Attach a file, wait for `ready`, select it, and ask about its contents. Other users' documents must not be visible or usable.
2. **Agents:** create, edit, reload, and delete a definition. Keys are server-side only.
3. **Minimal workflow:** Start → End; save, run with a text input, inspect the matching final output and persisted node results. Reload the page and view run history.
4. **LLM workflow:** Start → LLM → End; choose an agent, use `{{input}}` in the prompt, and inspect the real model response. LLM requests may incur provider charges.
5. **Condition:** Start → Condition with `true` and `false` branches to End nodes. Test one matching and one non-matching input.
6. **Approval:** Start → Human Approval → End. A run must pause before continuation. In v1 only an admin who owns the run may approve/reject it; a normal user cannot approve their own run. This intentionally does not provide a cross-user admin review queue. Never promote yourself via a public registration field; role assignment is an administrative DB operation.
7. **Tool/retrieval:** use indexed owned documents, inspect policy audits, and verify that an unauthorized action cannot execute.

Workflows are validated as bounded acyclic graphs. Runs snapshot definitions so editing a workflow/agent does not mutate a paused run. Node results are persisted. A crash during a running node is not automatic exactly-once recovery; v1 has no background execution queue or automatic retry/resume of interrupted running runs. Human approval resume is a separate persisted path.

## Checks

```powershell
uv run --extra dev pytest -q
uv run --extra dev ruff check .
cd frontend
npm test
npm run lint
npm run build
```

Tests must use isolated temporary databases, never the application's `aegis.db`. CI runs both backend and frontend checks. Mocked LLM/vector tests verify wiring and policy behavior, not provider access, billing, model quality, or your production Langfuse export.
