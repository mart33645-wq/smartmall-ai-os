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
from .tools import TOOL_DECLARATIONS, ToolExecutor


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

        snapshot = self._context.build_snapshot(lang=lang)
        history = self._history_for_provider(conversation.id)
        executor = ToolExecutor(self._db, actor_user_id=self._current_user.id)
        executed_actions: list[AssistantActionExecutionResponse] = []
        provider_response = None
        used_fallback = False

        # ── Try Gemini Function Calling (intelligent intent parsing) ──────────
        if request.allow_automation and self._gemini.is_available():
            try:
                tool_calls, interim = self._gemini.generate_chat_with_tools(
                    history=history,
                    snapshot=snapshot,
                    user_message=request.message,
                    lang=lang,
                    tool_declarations=TOOL_DECLARATIONS,
                )

                if tool_calls:
                    # Execute every tool Gemini requested
                    tool_results = []
                    for call in tool_calls:
                        result = executor.execute(call["name"], call["args"])
                        tool_results.append({"name": call["name"], "result": result})
                        # Convert to action execution view
                        success = result.get("success", True)
                        summary = self._tool_result_summary(call["name"], result, lang)
                        executed_actions.append(AssistantActionExecutionResponse(
                            action_id=f"tool_{call['name']}",
                            title=call["name"].replace("_", " ").title(),
                            summary=summary,
                            affected_records=result.get("affected_shops") or result.get("completed_count") or result.get("started_count") or result.get("resolved_count") or result.get("freed_count") or (1 if success else 0),
                            data=result,
                            generated_at=datetime.datetime.now(datetime.UTC),
                        ))

                    # Rebuild snapshot after mutations
                    snapshot = self._context.build_snapshot(lang=lang)

                    # Turn 2: Gemini confirms what happened
                    parts1 = interim.raw_payload.get("_parts1", [])
                    provider_response = self._gemini.generate_chat_with_tools_turn2(
                        history=history,
                        snapshot=snapshot,
                        user_message=request.message,
                        lang=lang,
                        tool_declarations=TOOL_DECLARATIONS,
                        parts1=parts1,
                        tool_results=tool_results,
                    )
                else:
                    # No tool calls — Gemini just answered a question
                    provider_response = interim

            except AssistantProviderError:
                pass  # Fall through to standard flow

        # ── Standard flow (Gemini Q&A or Fallback) ────────────────────────────
        if provider_response is None:
            available_actions = actions.descriptors()

            # Legacy keyword-based execution as safety net
            if request.allow_automation:
                direct_results = actions.execute_command_actions(
                    request.message,
                    actor_user_id=self._current_user.id,
                )
                snapshot = self._context.build_snapshot(lang=lang)
                execution_context = ""
                if direct_results:
                    summaries = " | ".join(r.summary for r in direct_results)
                    execution_context = (
                        f"[تم التنفيذ التلقائي: {summaries}]" if lang == "ar"
                        else f"[Auto-executed: {summaries}]"
                    )
                    for r in direct_results:
                        executed_actions.append(self._to_action_execution_view(r))
            else:
                execution_context = ""

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

        available_actions = actions.descriptors()
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
            suggested_actions=[self._to_action_view(a) for a in available_actions],
            executed_actions=executed_actions,
            memory_entries=self._memory.message_count(conversation_id=conversation.id),
            generated_at=datetime.datetime.now(datetime.UTC),
        )

    def _tool_result_summary(self, tool_name: str, result: dict, lang: str) -> str:
        """Generate a human-readable summary for a tool execution result."""
        if not result.get("success", True):
            err = result.get("error", "Unknown error")
            return f"❌ {err}"
        summaries_ar = {
            "add_shop": f"✅ تم إضافة المحل **{result.get('name')}** (الفئة: {result.get('category')}, الطابق {result.get('floor')}, الإيجار {result.get('rent_amount'):,.0f})",
            "delete_shop": f"🗑️ تم حذف المحل **{result.get('deleted_shop')}**",
            "adjust_shop_rent": f"📈 تم تعديل إيجار **{result.get('shop')}** من {result.get('old_rent'):,.0f} إلى {result.get('new_rent'):,.0f}",
            "adjust_all_rents": f"📊 تم تعديل إيجارات {result.get('affected_shops')} محل بنسبة {result.get('change_percent')}%",
            "set_shop_rent": f"💰 تم تحديد إيجار **{result.get('shop')}** بـ {result.get('new_rent'):,.0f}",
            "add_task": f"✅ تم إنشاء مهمة: **{result.get('task', {}).get('title', '') if isinstance(result.get('task'), dict) else ''}**",
            "complete_tasks": f"✅ تم إكمال {result.get('completed_count')} مهمة",
            "start_tasks": f"🚀 تم بدء {result.get('started_count')} مهمة",
            "resolve_alerts": f"✅ تم حل {result.get('resolved_count')} تنبيه",
            "free_parking": f"🅿️ تم تحرير {result.get('freed_count')} موقف",
            "list_shops": f"📋 يوجد {result.get('count')} محل",
            "list_tasks": f"📋 يوجد {result.get('count')} مهمة",
            "update_shop": f"✏️ تم تحديث بيانات **{result.get('shop')}**",
        }
        summaries_en = {
            "add_shop": f"✅ Shop **{result.get('name')}** added (Category: {result.get('category')}, Floor {result.get('floor')}, Rent {result.get('rent_amount'):,.0f})",
            "delete_shop": f"🗑️ Shop **{result.get('deleted_shop')}** removed",
            "adjust_shop_rent": f"📈 Rent for **{result.get('shop')}** changed from {result.get('old_rent'):,.0f} to {result.get('new_rent'):,.0f}",
            "adjust_all_rents": f"📊 Adjusted rents for {result.get('affected_shops')} shops by {result.get('change_percent')}%",
            "set_shop_rent": f"💰 Rent for **{result.get('shop')}** set to {result.get('new_rent'):,.0f}",
            "add_task": f"✅ Task created: **{result.get('task', {}).get('title', '') if isinstance(result.get('task'), dict) else ''}**",
            "complete_tasks": f"✅ Completed {result.get('completed_count')} task(s)",
            "start_tasks": f"🚀 Started {result.get('started_count')} task(s)",
            "resolve_alerts": f"✅ Resolved {result.get('resolved_count')} alert(s)",
            "free_parking": f"🅿️ Freed {result.get('freed_count')} parking slot(s)",
            "list_shops": f"📋 Found {result.get('count')} shop(s)",
            "list_tasks": f"📋 Found {result.get('count')} task(s)",
            "update_shop": f"✏️ Updated **{result.get('shop')}**",
        }
        table = summaries_ar if lang == "ar" else summaries_en
        try:
            return table.get(tool_name, f"✅ {tool_name} executed")
        except Exception:
            return f"✅ {tool_name} executed"


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
