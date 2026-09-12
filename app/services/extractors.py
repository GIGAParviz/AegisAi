from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader


def extract(path: Path) -> str:
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return _extract_pdf(path)

    if suffix == ".docx":
        return _extract_docx(path)

    if suffix in {".md", ".txt"}:
        return path.read_text(
            encoding="utf-8",
        )

    raise ValueError(f"Unsupported document type: {suffix}")


def _extract_pdf(path: Path) -> str:
    reader = PdfReader(path)

    pages: list[str] = []

    for page in reader.pages:
        text = page.extract_text()

        if text:
            pages.append(text.strip())

    return "\n\n".join(pages)


def _extract_docx(path: Path) -> str:
    document = DocxDocument(path)

    parts: list[str] = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()

        if not text:
            continue
        style_name = paragraph.style.name or ""

        if style_name.startswith("Heading"):
            try:
                level = int(
                    style_name.replace(
                        "Heading",
                        "",
                    ).strip(),
                )
            except ValueError:
                level = 1

            level = min(
                max(level, 1),
                6,
            )

            parts.append(
                f"{'#' * level} {text}",
            )

        else:   
            parts.append(text)
            
    return "\n\n".join(parts)


