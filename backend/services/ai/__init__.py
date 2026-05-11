"""
SmartMall AI Provider Layer — New modular AI architecture.

Usage:
    from services.ai import ai_router
    result, provider = ai_router.generate(messages, system_prompt)
"""
from .memory import ConversationMemoryService
from .router import AIRouter
from core.config import settings

# Singleton router — used by streaming endpoint and new tool execution engine
ai_router = AIRouter(settings)

__all__ = ["ai_router", "AIRouter", "ConversationMemoryService"]
