import json

import pytest

from app.db.models.user import UserRole
from app.policies import (
    DEFAULT_ACTION_REGISTRY,
    ActionParseError,
    GetDocumentProposal,
    SearchDocsProposal,
)


def test_parse_search_docs_proposal():
    raw_json = json.dumps(
        {
            "name": "search_docs",
            "arguments": {
                "query": "JWT authentication",
                "limit": 5,
            },
        }
    )

    proposal = DEFAULT_ACTION_REGISTRY.parse_proposal(raw_json)

    assert isinstance(
        proposal,
        SearchDocsProposal,
    )

    assert proposal.name == "search_docs"
    assert proposal.arguments.query == "JWT authentication"
    assert proposal.arguments.limit == 5

    definition = DEFAULT_ACTION_REGISTRY.get(
        "search_docs"
    )

    assert definition.min_role == UserRole.USER


def test_parse_get_document_proposal():
    raw_json = json.dumps(
        {
            "name": "get_document",
            "arguments": {
                "document_id": "document-123",
            },
        }
    )

    proposal = DEFAULT_ACTION_REGISTRY.parse_proposal(raw_json)

    assert isinstance(
        proposal,
        GetDocumentProposal,
    )

    assert proposal.arguments.document_id == "document-123"


def test_rejects_invalid_json():
    with pytest.raises(
        ActionParseError,
        match="Invalid action JSON",
    ):
        DEFAULT_ACTION_REGISTRY.parse_proposal(
            "{broken-json"
        )


def test_rejects_unknown_action():
    raw_json = json.dumps(
        {
            "name": "delete_everything",
            "arguments": {},
        }
    )

    with pytest.raises(
        ActionParseError,
        match="Unknown action",
    ):
        DEFAULT_ACTION_REGISTRY.parse_proposal(raw_json)


def test_rejects_extra_argument():
    raw_json = json.dumps(
        {
            "name": "search_docs",
            "arguments": {
                "query": "JWT",
                "limit": 5,
                "is_admin": True,
            },
        }
    )

    with pytest.raises(
        ActionParseError,
        match="Invalid parameters",
    ):
        DEFAULT_ACTION_REGISTRY.parse_proposal(raw_json)


def test_rejects_extra_top_level_field():
    raw_json = json.dumps(
        {
            "name": "search_docs",
            "arguments": {
                "query": "JWT",
            },
            "execute_now": True,
        }
    )

    with pytest.raises(
        ActionParseError,
        match="Invalid parameters",
    ):
        DEFAULT_ACTION_REGISTRY.parse_proposal(raw_json)


def test_rejects_missing_required_argument():
    raw_json = json.dumps(
        {
            "name": "search_docs",
            "arguments": {},
        }
    )

    with pytest.raises(
        ActionParseError,
        match="Invalid parameters",
    ):
        DEFAULT_ACTION_REGISTRY.parse_proposal(raw_json)