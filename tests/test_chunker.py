from pathlib import Path
from textwrap import dedent

from app.services.chunker import TextChunker
from app.services.extractors import extract


def test_short_text_creates_one_chunk():
    chunker = TextChunker(
        max_tokens=50,
        overlap_tokens=10,
    )

    chunks = chunker.chunk("This is a short document.")

    assert len(chunks) == 1

    assert chunks[0].content == ("This is a short document.")


def test_long_text_creates_multiple_chunks():
    chunker = TextChunker(
        max_tokens=40,
        overlap_tokens=8,
    )

    text = " ".join(["AegisAI document processing."] * 100)

    chunks = chunker.chunk(text)

    assert len(chunks) > 1

    assert all(chunk.token_count <= 40 for chunk in chunks)


def test_headings_create_boundaries():
    chunker = TextChunker(
        max_tokens=100,
        overlap_tokens=10,
    )

    text = dedent(
        """
        # Authentication

        JWT authentication details.

        # Database

        PostgreSQL persistence details.
        """
    )

    chunks = chunker.chunk(text)

    assert len(chunks) == 2

    assert chunks[0].content.startswith(
        "# Authentication"
    )

    assert chunks[1].content.startswith(
        "# Database"
    )

def test_extract_markdown():
    path = Path(r"E:\projs\AegisAI\tests\fixtures\sample.md")

    text = extract(path)

    assert "# AegisAI" in text
    assert "Celery workers" in text


def test_extract_pdf():
    path = Path(r"E:\projs\AegisAI\tests\fixtures\sample.pdf")

    text = extract(path)

    assert "# AegisAI" in text
    assert "Celery workers" in text



