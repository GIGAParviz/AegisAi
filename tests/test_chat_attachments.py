import json

import pytest

import app.api.chat as chat_api
from app.db.models.document import Document, DocumentStatus
from app.services.vector_store import FakeVectorStore, VectorChunk
from tests.test_workflows import identity


@pytest.mark.asyncio
async def test_chat_requires_auth(client):
    response = await client.post("/chat/stream", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_selected_ready_owned_docs_only_and_citations(client, session_factory, monkeypatch):
    user, headers = await identity(session_factory)
    other, _ = await identity(session_factory)
    async with session_factory() as session:
        docs = [Document(filename=name, mime="text/plain", owner_id=owner, status=status) for name, owner, status in [
            ("selected", user.id, DocumentStatus.READY), ("unselected", user.id, DocumentStatus.READY),
            ("pending", user.id, DocumentStatus.QUEUED), ("foreign", other.id, DocumentStatus.READY)]]
        session.add_all(docs)
        await session.commit()
    store = FakeVectorStore()
    await store.upsert_chunks([VectorChunk(str(d.id), 0, f"match {d.filename}", [1.], owner_id=str(d.owner_id)) for d in docs])
    calls = []
    class LLM:
        async def stream(self, messages):
            calls.append(messages)
            yield "Answer"
    monkeypatch.setattr(chat_api, "build_llm_provider", lambda: LLM())
    monkeypatch.setattr(chat_api, "build_retrieval_store", lambda: store, raising=False)
    payload = {"messages": [{"role": "user", "content": "match"}], "document_ids": [str(docs[0].id)], "session_id": "same-session"}
    result = await client.post("/chat/stream", json=payload, headers=headers)
    assert result.status_code == 200, result.text
    context = str(calls[0])
    assert "match selected" in context
    assert "unselected" not in context and "foreign" not in context and "pending" not in context
    done = next(block for block in result.text.split("\n\n") if block.startswith("event: done"))
    metadata = json.loads(done.split("data: ")[1])
    assert metadata["citations"][0]["document_id"] == str(docs[0].id)
    assert metadata["citations"][0]["filename"] == "selected"
    # Same session with no attachments must never reuse previous retrieval context.
    payload["document_ids"] = []
    assert (await client.post("/chat/stream", json=payload, headers=headers)).status_code == 200
    assert "match selected" not in str(calls[-1])
    payload["document_ids"] = [str(docs[3].id)]
    assert (await client.post("/chat/stream", json=payload, headers=headers)).status_code == 404
    payload["document_ids"] = [str(docs[2].id)]
    assert (await client.post("/chat/stream", json=payload, headers=headers)).status_code == 409
    listing = await client.get("/documents", headers=headers)
    assert listing.status_code == 200
    assert {d["filename"] for d in listing.json()} == {"selected", "unselected", "pending"}


@pytest.mark.asyncio
async def test_chat_error_event_without_sensitive_details(client, session_factory, monkeypatch):
    _, headers = await identity(session_factory)
    class LLM:
        async def stream(self, messages):
            yield "first"
            raise RuntimeError("private upstream credential")
    monkeypatch.setattr(chat_api, "build_llm_provider", lambda: LLM())
    result = await client.post("/chat/stream", json={"messages": [{"role": "user", "content": "hello"}]}, headers=headers)
    assert "event: token" in result.text
    assert "event: error" in result.text
    assert "event: done" not in result.text
    assert "private upstream" not in result.text
