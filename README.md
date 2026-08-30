# AegisAI

AegisAI is a production-oriented AI knowledge workspace for document ingestion, retrieval, RAG, agent workflows, evaluation, and local model serving.

## Current Status

Early development.

## Initial Goals

- Build a production-grade FastAPI backend
- Add PostgreSQL-based persistence
- Support document upload and processing
- Implement RAG with vector search
- Add agent workflows
- Serve local LLMs
- Add evaluation and observability
- Containerize and deploy the system

## Tech Stack

Currently:

- Python
- FastAPI
- Uvicorn
- Pytest
- Ruff

Planned:

- PostgreSQL
- SQLAlchemy
- Alembic
- Redis
- Celery
- RabbitMQ
- Qdrant
- LangGraph
- vLLM
- Langfuse
- Docker
- GitHub Actions
- Kubernetes

## Development

Create and activate a virtual environment:

```bash
python -m venv .venv