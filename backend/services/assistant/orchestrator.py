from __future__ import annotations

import datetime

from sqlalchemy.orm import Session

from core.config import settings
from models.database import User
from schemas.assistant import (
    AssistantActionExecutionResponse,
    AssistantActionView,
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantConversationResponse,
    AssistantMessageView,
    AssistantModuleView,
    AssistantStatusResponse,
    AssistantSystemAnalysisResponse,
)

from .actions import AssistantActionRegistry
from .context import MallContextService
from .language import normalize_lang, resolve_chat_lang
from .memory import ConversationMemoryService
from .providers import AssistantProviderError, FallbackAssistantProvider, GeminiAssistantProvider


class SmartMallAssistantOrchestrator:
    def __init__(self, db: Session, current_user: User):
        self._db = db
        self._current_user = current_user
        self._memory = ConversationMemoryService(db)
        self._context = MallContextService(db)
        self._gemini = GeminiAssistantProvider(settings.gemini)
        self._fallback = FallbackAssistantProvider()

    def chat(self, request: AssistantChatRequest) -> AssistantChatResponse:
        lang = resolve_chat_lang(request.lang, request.message)
        actions = self._actions_for(lang)
        conversation = self._memory.get_or_create_conversation(
            user_id=self._current_user.id,
            conversation_id=request.conversation_id,
            initial_message=request.message,
        )
        self._memory.append_message(
            conversation_id=conversation.id,
            role="user",
            content=request.message,
        )

        # Execute direct commands FIRST so Gemini can confirm them
        executed_actions: list[AssistantActionExecutionResponse] = []
        direct_results = []
        if request.allow_automation:
            direct_results = actions.execute_command_actions(
                request.message,
                actor_user_id=self._current_user.id,
            )
            executed_actions.extend(self._to_action_execution_view(r) for r in direct_results)

        # Rebuild snapshot AFTER mutations so Gemini sees fresh data
        snapshot = self._context.build_snapshot(lang=lang)
        available_actions = actions.descriptors()
        history = self._history_for_provider(conversation.id)

        # Inject execution results so Gemini confirms instead of refusing
        execution_context = ""
        if direct_results:
            summaries = " | ".join(r.summary for r in direct_results)
            execution_context = (
                f"[تم التنفيذ التلقائي: {summaries}]"
                if lang == "ar"
                else f"[Auto-executed: {summaries}]"
            )

        provider_response, used_fallback = self._generate_chat_response(
            history=history,
            snapshot=snapshot,
            user_message=request.message,
            available_actions=available_actions,
            lang=lang,
            execution_context=execution_context,
        )

        if request.allow_automation:
            for action_id in self._resolve_action_ids(request.message, provider_response.action_ids, actions):
                if not actions.exists(action_id):
                    continue
                execution = actions.execute(action_id)
                executed_actions.append(self._to_action_execution_view(execution))

        assistant_payload = {
            "provider": provider_response.raw_payload.get("provider", self._provider_label(used_fallback)),
            "analysis": provider_response.analysis,
            "suggestions": provider_response.suggestions,
            "follow_up_questions": provider_response.follow_up_questions,
            "action_ids": provider_response.action_ids,
            "executed_actions": [item.model_dump(mode="json") for item in executed_actions],
        }
        self._memory.append_message(
            conversation_id=conversation.id,
            role="assistant",
            content=provider_response.answer,
            payload=assistant_payload,
        )

        return AssistantChatResponse(
            conversation_id=conversation.id,
            provider=self._provider_label(used_fallback),
            used_fallback=used_fallback,
            answer=provider_response.answer,
            analysis=provider_response.analysis,
            suggestions=provider_response.suggestions,
            follow_up_questions=provider_response.follow_up_questions,
            suggested_actions=[self._to_action_view(action) for action in available_actions],
            executed_actions=executed_actions,
            memory_entries=self._memory.message_count(conversation_id=conversation.id),
            generated_at=datetime.datetime.now(datetime.UTC),
        )

    def get_system_analysis(self, lang: str = "en") -> AssistantSystemAnalysisResponse:
        normalized_lang = normalize_lang(lang)
        actions = self._actions_for(normalized_lang)
        snapshot = self._context.build_snapshot(lang=normalized_lang)
        available_actions = actions.descriptors()
        provider_response, used_fallback = self._generate_system_analysis(
            snapshot=snapshot,
            available_actions=available_actions,
            lang=normalized_lang,
        )
        return AssistantSystemAnalysisResponse(
            provider=self._provider_label(used_fallback),
            used_fallback=used_fallback,
            executive_summary=provider_response.answer,
            key_metrics=snapshot.key_metrics,
            modules=[self._to_module_view(module) for module in snapshot.modules],
            improvement_opportunities=provider_response.analysis or snapshot.improvement_opportunities,
            suggested_actions=[self._to_action_view(action) for action in available_actions],
            generated_at=datetime.datetime.now(datetime.UTC),
        )

    def execute_action(self, action_id: str, lang: str = "en") -> AssistantActionExecutionResponse:
        result = self._actions_for(normalize_lang(lang)).execute(action_id)
        return self._to_action_execution_view(result)

    def get_conversation(self, conversation_id: str) -> AssistantConversationResponse:
        conversation, messages = self._memory.get_conversation(
            user_id=self._current_user.id,
            conversation_id=conversation_id,
        )
        if not conversation:
            raise LookupError("Conversation not found")
        return AssistantConversationResponse(
            id=conversation.id,
            title=conversation.title,
            messages=[
                AssistantMessageView(
                    role=message.role,
                    content=message.content,
                    created_at=message.created_at,
                    payload=message.payload or {},
                )
                for message in messages
            ],
        )

    def status(self) -> AssistantStatusResponse:
        gemini_enabled = self._gemini.is_available()
        return AssistantStatusResponse(
            provider="gemini" if gemini_enabled else self._fallback.provider_name,
            model=settings.gemini.model,
            gemini_enabled=gemini_enabled,
            fallback_active=not gemini_enabled,
        )

    def _actions_for(self, lang: str) -> AssistantActionRegistry:
        return AssistantActionRegistry(self._db, self._context, lang)

    def _generate_chat_response(self, **kwargs):
        if self._gemini.is_available():
            try:
                return self._gemini.generate_chat(**kwargs), False
            except AssistantProviderError:
                pass
        # Fallback doesn't use execution_context - remove it safely
        kwargs.pop("execution_context", None)
        return self._fallback.generate_chat(**kwargs), True

    def _generate_system_analysis(self, **kwargs):
        if self._gemini.is_available():
            try:
                return self._gemini.generate_system_analysis(**kwargs), False
            except AssistantProviderError:
                pass
        return self._fallback.generate_system_analysis(**kwargs), True

    def _history_for_provider(self, conversation_id: str) -> list[dict[str, str]]:
        messages = self._memory.recent_history(
            conversation_id=conversation_id,
            limit=settings.gemini.memory_window,
        )
        return [
            {
                "role": message.role,
                "content": message.content,
            }
            for message in messages
        ]

    def _resolve_action_ids(
        self,
        message: str,
        provider_action_ids: list[str],
        actions: AssistantActionRegistry,
    ) -> list[str]:
        if provider_action_ids:
            seen: set[str] = set()
            valid = []
            for action_id in provider_action_ids:
                if action_id in seen or not actions.exists(action_id):
                    continue
                seen.add(action_id)
                valid.append(action_id)
            if valid:
                return valid[:2]

        lowered = message.lower()
        action_ids: list[str] = []
        if (
            "task" in lowered
            or "priority" in lowered
            or "مهام" in lowered
            or "أولوية" in lowered
        ) and actions.exists("optimize_task_priorities"):
            action_ids.append("optimize_task_priorities")
        if (
            "risk" in lowered
            or "shop" in lowered
            or "tenant" in lowered
            or "خطر" in lowered
            or "محل" in lowered
        ) and actions.exists("run_shop_risk_sweep"):
            action_ids.append("run_shop_risk_sweep")
        if not action_ids and actions.exists("summarize_operations"):
            action_ids.append("summarize_operations")
        return action_ids[:2]

    def _to_action_view(self, action) -> AssistantActionView:
        return AssistantActionView(
            id=action.id,
            title=action.title,
            description=action.description,
            safe_to_run=action.safe_to_run,
        )

    def _to_module_view(self, module) -> AssistantModuleView:
        return AssistantModuleView(
            module=module.module,
            score=module.score,
            summary=module.summary,
            issue=module.issue,
        )

    def _to_action_execution_view(self, result) -> AssistantActionExecutionResponse:
        return AssistantActionExecutionResponse(
            action_id=result.action_id,
            title=result.title,
            summary=result.summary,
            affected_records=result.affected_records,
            data=result.data,
            generated_at=datetime.datetime.now(datetime.UTC),
        )

    def _provider_label(self, used_fallback: bool) -> str:
        return self._fallback.provider_name if used_fallback else f"gemini:{settings.gemini.model}"
