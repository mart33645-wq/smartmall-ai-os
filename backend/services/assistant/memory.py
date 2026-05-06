from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from models.database import AssistantConversation, AssistantMessage, utcnow


class ConversationMemoryService:
    def __init__(self, db: Session):
        self._db = db

    def get_or_create_conversation(
        self,
        *,
        user_id: int,
        conversation_id: str | None,
        initial_message: str | None = None,
    ) -> AssistantConversation:
        conversation = None
        if conversation_id:
            conversation = (
                self._db.query(AssistantConversation)
                .filter(
                    AssistantConversation.id == conversation_id,
                    AssistantConversation.user_id == user_id,
                )
                .first()
            )
        if conversation:
            return conversation

        created_id = conversation_id or str(uuid.uuid4())
        title_seed = (initial_message or "SmartMall AI Assistant").strip()
        title = title_seed[:60] + ("..." if len(title_seed) > 60 else "")
        conversation = AssistantConversation(
            id=created_id,
            user_id=user_id,
            title=title or "SmartMall AI Assistant",
        )
        self._db.add(conversation)
        self._db.commit()
        self._db.refresh(conversation)
        return conversation

    def append_message(
        self,
        *,
        conversation_id: str,
        role: str,
        content: str,
        payload: dict[str, Any] | None = None,
    ) -> AssistantMessage:
        message = AssistantMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            payload=payload or {},
        )
        conversation = (
            self._db.query(AssistantConversation)
            .filter(AssistantConversation.id == conversation_id)
            .first()
        )
        if conversation:
            conversation.updated_at = utcnow()
            if role == "assistant" and content:
                conversation.context_summary = content[:240]
        self._db.add(message)
        self._db.commit()
        self._db.refresh(message)
        return message

    def recent_history(self, *, conversation_id: str, limit: int = 10) -> list[AssistantMessage]:
        messages = (
            self._db.query(AssistantMessage)
            .filter(AssistantMessage.conversation_id == conversation_id)
            .order_by(AssistantMessage.created_at.desc())
            .limit(limit)
            .all()
        )
        messages.reverse()
        return messages

    def message_count(self, *, conversation_id: str) -> int:
        return (
            self._db.query(AssistantMessage)
            .filter(AssistantMessage.conversation_id == conversation_id)
            .count()
        )

    def get_conversation(
        self,
        *,
        user_id: int,
        conversation_id: str,
    ) -> tuple[AssistantConversation | None, list[AssistantMessage]]:
        conversation = (
            self._db.query(AssistantConversation)
            .filter(
                AssistantConversation.id == conversation_id,
                AssistantConversation.user_id == user_id,
            )
            .first()
        )
        if not conversation:
            return None, []
        messages = (
            self._db.query(AssistantMessage)
            .filter(AssistantMessage.conversation_id == conversation_id)
            .order_by(AssistantMessage.created_at.asc())
            .all()
        )
        return conversation, messages
