from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AssistantActionView(BaseModel):
    id: str
    title: str
    description: str
    safe_to_run: bool = True


class AssistantMessageView(BaseModel):
    role: str
    content: str
    created_at: datetime
    payload: dict[str, Any] = Field(default_factory=dict)


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    allow_automation: bool = True
    lang: str | None = Field(default=None, pattern="^(ar|en)$")


class AssistantActionExecutionResponse(BaseModel):
    action_id: str
    title: str
    summary: str
    affected_records: int | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    generated_at: datetime


class AssistantChatResponse(BaseModel):
    conversation_id: str
    provider: str
    used_fallback: bool = False
    answer: str
    analysis: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    suggested_actions: list[AssistantActionView] = Field(default_factory=list)
    executed_actions: list[AssistantActionExecutionResponse] = Field(default_factory=list)
    memory_entries: int = 0
    generated_at: datetime


class AssistantConversationResponse(BaseModel):
    id: str
    title: str
    messages: list[AssistantMessageView] = Field(default_factory=list)


class AssistantModuleView(BaseModel):
    module: str
    score: int
    summary: str
    issue: str | None = None


class AssistantSystemAnalysisResponse(BaseModel):
    provider: str
    used_fallback: bool = False
    executive_summary: str
    key_metrics: dict[str, Any] = Field(default_factory=dict)
    modules: list[AssistantModuleView] = Field(default_factory=list)
    improvement_opportunities: list[str] = Field(default_factory=list)
    suggested_actions: list[AssistantActionView] = Field(default_factory=list)
    generated_at: datetime


class AssistantStatusResponse(BaseModel):
    provider: str
    model: str
    gemini_enabled: bool
    fallback_active: bool
