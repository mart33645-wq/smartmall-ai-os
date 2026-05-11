"""
AI-layer conversation memory.

All persistence lives in ``services.assistant.memory.ConversationMemoryService``
(models: ``AssistantConversation``, ``AssistantMessage``). Import from here in
AI-adjacent modules (router helpers, workers) to keep the dependency direction
``services.ai`` → ``services.assistant`` explicit.
"""
from __future__ import annotations

from services.assistant.memory import ConversationMemoryService

__all__ = ["ConversationMemoryService"]
