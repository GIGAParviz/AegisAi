# Aegis AI — Task Index (۳۷ تسک، ۳۰ روز)

> هر تسک یک فایل کامل با گام‌ها، فایل‌ها و دستور Verify. وضعیت هر تسک داخل فایلش (⬜ TODO / 🔄 / ✅) و لاگ روزانه در `docs/PROGRESS.md`.
> جدول زمان‌بندی Learn+Build: `docs/ROADMAP.md`

## فاز 0 — Foundation

- [ ] `T0.1-rename-aegisai.md` — تغییر نام ContextForge به AegisAI
- [ ] `T0.2-scaffold-layout.md` — اسکلت پوشه های پروژه + smoke test
- [ ] `T0.3-settings-expansion.md` — گسترش Settings + تست کانفیگ
- [ ] `T0.4-green-baseline.md` — بیس لاین سبز: pytest + ruff + commit
- [ ] `T0.5-docker-desktop.md` — نصب Docker Desktop (WSL2)
- [ ] `T0.6-ci-workflow.md` — GitHub Actions CI

## فاز 1 — Gateway & Security

- [ ] `T1.1-async-db-layer.md` — لایه دیتابیس async
- [ ] `T1.2-user-model-alembic.md` — مدل User + مهاجرت Alembic
- [ ] `T1.3-jwt-auth.md` — احراز هویت JWT (register/login/refresh)
- [ ] `T1.4-rbac-deps.md` — RBAC با FastAPI dependencies
- [ ] `T1.5-rate-limit-cors.md` — Rate limiting (Redis) + CORS

## فاز 2 — Data Engine

- [ ] `T2.1-document-model-upload.md` — مدل Document + API آپلود
- [ ] `T2.2-celery-worker.md` — Celery worker (broker=Redis)
- [ ] `T2.3-extract-chunk.md` — استخراج متن + chunking
- [ ] `T2.4-embedding-service.md` — سرویس Embedding با provider abstraction
- [ ] `T2.5-qdrant-hybrid.md` — یکپارچه سازی Qdrant + جستجوی hybrid
- [ ] `T2.6-reranker.md` — Reranker (اختیاری)

## فاز 3 — Reasoning Engine

- [ ] `T3.1-llm-provider.md` — لایه انتزاع LLMProvider
- [ ] `T3.2-local-model-endpoint.md` — راه اندازی مدل محلی (llama.cpp) یا API ریموت
- [ ] `T3.3-sse-chat-stream.md` — Endpoint چت استریمی (SSE)

## فاز 4 — Harness

- [ ] `T4.1-context-builder.md` — Context Builder
- [ ] `T4.2-action-registry.md` — رجیستری اکشن ها (Pydantic)
- [ ] `T4.3-policy-gate.md` — Policy Gate (deny-by-default + audit)
- [ ] `T4.4-verifier.md` — لایه Verify (schema + قواعد + retry)
- [ ] `T4.5-llm-judge.md` — LLM-as-a-Judge (اختیاری)

## فاز 5 — Agentic Runtime

- [ ] `T5.1-langgraph-loop.md` — حلقه ایجنت با LangGraph
- [ ] `T5.2-mcp-integration.md` — کلاینت MCP + اولین tool server
- [ ] `T5.3-human-in-loop.md` — Human-in-the-loop approvals
- [ ] `T5.4-multi-agent.md` — نمونه چند ایجنتی (planner/worker)

## فاز 6 — Observability & MLOps

- [ ] `T6.1-langfuse-tracing.md` — Tracing با Langfuse
- [ ] `T6.2-golden-evals.md` — Golden dataset + ارزیابی RAG
- [ ] `T6.3-quality-gate-ci.md` — دروازه کیفیت در CI
- [ ] `T6.4-mlflow-optional.md` — MLflow (اختیاری)

## فاز 7 — Hardening & Deploy

- [ ] `T7.1-docker-compose.md` — docker-compose استک کامل
- [ ] `T7.2-nginx-proxy.md` — Nginx reverse proxy
- [ ] `T7.3-k8s-manifests.md` — مانیفست های K8s
- [ ] `T7.4-docs-runbook.md` — بازنویسی README + runbook

**مجموع: 37 تسک**
