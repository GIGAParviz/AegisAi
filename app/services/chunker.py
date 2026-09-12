import re
from dataclasses import dataclass

import tiktoken


@dataclass(frozen=True)
class Chunk:
    content: str
    token_count: int


class TextChunker:
    def __init__(
        self,
        max_tokens: int = 512,
        overlap_tokens: int = 64,
    ):

        if overlap_tokens >= max_tokens:
            raise ValueError("overlap_tokens must be smaller that max_tokens")

        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens

        self.encoding = tiktoken.get_encoding("o200k_base")

    def count_tokens(
        self,
        text: str,
    ) -> int:
        return len(
            self.encoding.encode(text),
        )

    def chunk(
        self,
        text: str,
    ) -> list[Chunk]:

        text = text.strip()

        if not text:
            return []

        sections = self._split_sections(text)

        chunks: list[Chunk] = []

        for section in sections:
            chunks.extend(self._chunk_section(section))

        return chunks

    def _split_sections(
        self,
        text: str,
    ) -> list[str]:

        sections = re.split(
            r"(?=^#{1,6}\s+)",
            text,
            flags=re.MULTILINE,
        )

        return [section.strip() for section in sections if section.strip()]

    def _chunk_section(
        self,
        section: str,
    ) -> list[Chunk]:

        if self.count_tokens(section) <= self.max_tokens:
            return [Chunk(content=section, token_count=self.count_tokens(section))]

        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(
                r"\n\s*\n",
                section,
            )
            if paragraph.strip()
        ]

        chunks: list[Chunk] = []
        current_parts: list[str] = []

        for paragraph in paragraphs:
            candidate_parts = [
                *current_parts,
                paragraph,
            ]

            candidate = "\n\n".join(candidate_parts)

            if self.count_tokens(candidate) <= self.max_tokens:
                current_parts.append(paragraph)
                continue

            if current_parts:
                current_text = "\n\n".join(current_parts)

                chunks.append(
                    Chunk(
                        content=current_text,
                        token_count=self.count_tokens(current_text),
                    )
                )

                overlap = self._overlap_text(
                    current_text,
                )

                current_parts = [overlap] if overlap else []

            if self.count_tokens(paragraph) > self.max_tokens:
                chunks.extend(
                    self._hard_split(paragraph),
                )

                current_parts = []

            else:
                current_parts.append(paragraph)

        if current_parts:
            content = "\n\n".join(current_parts)

            chunks.append(
                Chunk(
                    content=content,
                    token_count=self.count_tokens(
                        content,
                    ),
                )
            )
        return chunks

    def _overlap_text(
        self,
        text: str,
    ) -> str:
        tokens = self.encoding.encode(text)

        if not tokens:
            return ""

        overlap = tokens[-self.overlap_tokens]

        return self.encoding.decode(overlap).strip()

    def _hard_split(
        self,
        text: str,
    ) -> list[Chunk]:

        tokens = self.encoding.encode(text)

        step = self.max_tokens - self.overlap_tokens

        chunks: list[Chunk] = []

        for start in range(
            0,
            len(tokens),
            step,
        ):
            token_slice = tokens[start : start + self.max_tokens]

            if not token_slice:
                break
            
            content = self.encoding.decode(
                token_slice
            ).strip()
            
            chunks.append(
                Chunk(
                    content=content,
                    token_count=len(
                        token_slice
                    ),
                )
            )

        return chunks
    