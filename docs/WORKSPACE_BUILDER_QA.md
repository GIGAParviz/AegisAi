# Workspace builder v1 — verification report

## Executed locally

- Backend: `.venv/bin/python -m pytest -q` → **110 passed, 1 skipped**, two existing dependency deprecation warnings.
- Python lint: `.venv/bin/ruff check .` → **All checks passed**.
- Frontend: `npm test` → **53 passed** across **11 test files**.
- Frontend lint: `npm run lint` → success.
- Production build: `npm run build` → success, including TypeScript validation and 41 generated static pages.
- Fresh SQLite migration: `alembic upgrade head` → `b19d7a42ce01 (head)`.
- Patch whitespace: `git diff --check` → success.

## Real browser + local API checks

Chromium was run against the real Next.js app and an isolated FastAPI database with a synthetic admin session. These checks used actual local API writes/read-backs, not mocked browser responses:

1. Create an agent; reload and verify persistence.
2. Save Start → End in the graphical workflow editor; execute it and verify exact output and per-node completion; reload the saved definition.
3. Start a workflow with Human Approval; confirm persisted pause; approve in the actual Approvals screen; verify the server resumes to completed with the expected output.
4. Open Persian chat; verify RTL, visible attachment controls, removal of the separate Documents navigation entry, and no horizontal page overflow at desktop and 390px mobile viewport widths.
5. No uncaught browser page errors occurred in the final acceptance pass.

The browser run exposed a real role casing mismatch (`admin` from the API versus `ADMIN` in the UI). A failing regression test was added before fixing the approval controls; the final browser acceptance then passed.

## Verification boundaries

- No paid external LLM calls were made during this verification. Provider execution in automated tests uses injected providers.
- Live Redis/Celery ingestion, external Qdrant/model downloads, real model answer quality, and production Langfuse export were not exercised here. Deterministic backend tests cover selected-document ownership/retrieval wiring and chat citations.
- No claim of exactly-once execution or automatic recovery after a server crash. Approval checkpoints persist, but running-node crash recovery is outside v1.
- Remote GitHub Actions status is separate from these local checks and must be checked after push.
