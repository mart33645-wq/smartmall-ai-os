from __future__ import annotations

import re


ARABIC_PATTERN = re.compile(r"[\u0600-\u06FF]")


def normalize_lang(value: str | None) -> str:
    return "ar" if value == "ar" else "en"


def message_looks_arabic(value: str | None) -> bool:
    if not value:
        return False
    return bool(ARABIC_PATTERN.search(value))


def resolve_chat_lang(preferred: str | None, message: str | None) -> str:
    if message_looks_arabic(message):
        return "ar"
    return normalize_lang(preferred)
