"""
SmartMall AI Provider Layer — New modular AI architecture.

Usage:
    from services.ai import ai_router
    result, provider = ai_router.generate(messages, system_prompt)
"""
from __future__ import annotations

from .router import AIRouter
from core.config import settings

# Lazy singleton to avoid circular import:
# services.ai.__init__ → services.ai.memory → services.assistant.memory
# → services.assistant.__init__ → services.assistant.orchestrator
# → services.ai (partially initialised) ← circular!
_ai_router: AIRouter | None = None


def _get_ai_router() -> AIRouter:
    global _ai_router
    if _ai_router is None:
        _ai_router = AIRouter(settings)
    return _ai_router


class _LazyRouter:
    """Proxy that initialises AIRouter on first attribute access."""
    def __getattr__(self, name: str):
        return getattr(_get_ai_router(), name)


ai_router: AIRouter = _LazyRouter()  # type: ignore[assignment]

# ConversationMemoryService is imported lazily by callers that need it
__all__ = ["ai_router", "AIRouter"]
