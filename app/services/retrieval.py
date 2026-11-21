"""Owner-scoped retrieval services. Backends are lazy and injectable."""
from dataclasses import asdict
from uuid import UUID

from sqlalchemy import select

from app.db.models.document import Document, DocumentStatus
from app.services.embeddings import build_embedding_provider
from app.services.vector_store import build_vector_store


def build_retrieval_store():
    return build_vector_store(build_embedding_provider())


async def ready_documents(session, owner_id, document_ids=None):
    statement = select(Document).where(Document.owner_id == UUID(str(owner_id)), Document.status == DocumentStatus.READY)
    if document_ids is not None:
        statement = statement.where(Document.id.in_([UUID(str(value)) for value in document_ids]))
    return list((await session.scalars(statement)).all())


async def retrieve_owned(session, store, owner_id, query, limit, document_ids=None):
    documents = await ready_documents(session, owner_id, document_ids)
    allowed = {str(d.id) for d in documents}
    if not allowed:
        return []
    kwargs = {"query": query, "k": limit, "owner_id": str(owner_id)}
    if document_ids is not None:
        kwargs["document_ids"] = sorted(allowed)
    results = await store.hybrid_search(**kwargs)
    # Defense in depth if a stale or misconfigured index returns unauthorized chunks.
    return [asdict(item) for item in results if item.document_id in allowed][:limit]
