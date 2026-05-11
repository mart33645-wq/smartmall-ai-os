from __future__ import annotations

import datetime
from typing import Iterable

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
from .models import AssistantActionExecutionResult, AssistantProviderResponse, MallSnapshot
from .providers import AssistantProviderError, FallbackAssistantProvider, GeminiAssistantProvider, OpenAIAssistantProvider
from .tools import TOOL_DECLARATIONS, ToolExecutor


class SmartMallAssistantOrchestrator:
    def __init__(self, db: Session, current_user: User):
        self._db = db
        self._current_user = current_user
        self._memory = ConversationMemoryService(db)
        self._context = MallContextService(db)
        self._openai = OpenAIAssistantProvider(settings.openai)
        self._gemini = GeminiAssistantProvider(settings.gemini)
        self._fallback = FallbackAssistantProvider()

    def chat(self, request: AssistantChatRequest) -> AssistantChatResponse:
        lang = resolve_chat_lang(request.lang, request.message)
        actions = self._actions_for(lang)
        available_actions = actions.descriptors()
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
        provider_response: AssistantProviderResponse | None = None
        used_fallback = False

        if request.allow_automation:
            direct_results = actions.execute_command_actions(
                request.message,
                actor_user_id=self._current_user.id,
            )
            if direct_results:
                snapshot = self._context.build_snapshot(lang=lang)
                executed_actions.extend(self._to_action_execution_view(result) for result in direct_results)
                provider_response = self._build_direct_command_response(
                    message=request.message,
                    lang=lang,
                    results=direct_results,
                    snapshot=snapshot,
                    actions=actions,
                )
                used_fallback = True

        tool_provider = self._tool_calling_provider()
        if provider_response is None and request.allow_automation and tool_provider is not None:
            try:
                tool_calls, interim = tool_provider.generate_chat_with_tools(
                    history=history,
                    snapshot=snapshot,
                    user_message=request.message,
                    lang=lang,
                    tool_declarations=TOOL_DECLARATIONS,
                )

                if tool_calls:
                    tool_results: list[dict[str, object]] = []
                    for call in tool_calls:
                        result = executor.execute(call["name"], call["args"])
                        tool_results.append({"name": call["name"], "result": result})
                        executed_actions.append(
                            AssistantActionExecutionResponse(
                                action_id=f"tool_{call['name']}",
                                title=call["name"].replace("_", " ").title(),
                                summary=self._tool_result_summary(call["name"], result, lang),
                                affected_records=(
                                    result.get("affected_shops")
                                    or result.get("completed_count")
                                    or result.get("started_count")
                                    or result.get("resolved_count")
                                    or result.get("freed_count")
                                    or (1 if result.get("success", True) else 0)
                                ),
                                data=result,
                                generated_at=datetime.datetime.now(datetime.UTC),
                            )
                        )

                    snapshot = self._context.build_snapshot(lang=lang)
                    provider_response = tool_provider.generate_chat_with_tools_turn2(
                        history=history,
                        snapshot=snapshot,
                        user_message=request.message,
                        lang=lang,
                        tool_declarations=TOOL_DECLARATIONS,
                        parts1=interim.raw_payload.get("_parts1", []),
                        tool_results=tool_results,
                    )
                else:
                    provider_response = interim
            except AssistantProviderError:
                provider_response = None

        if provider_response is None:
            provider_response, used_fallback = self._generate_chat_response(
                history=history,
                snapshot=snapshot,
                user_message=request.message,
                available_actions=available_actions,
                lang=lang,
                execution_context="",
            )

            if request.allow_automation:
                for action_id in self._resolve_action_ids(request.message, provider_response.action_ids, actions):
                    if not actions.exists(action_id):
                        continue
                    executed_actions.append(self._to_action_execution_view(actions.execute(action_id)))

        response_provider = str(provider_response.raw_payload.get("provider", self._provider_label(used_fallback)))
        assistant_payload = {
            "provider": response_provider,
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
            provider=response_provider,
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
        response_provider = str(provider_response.raw_payload.get("provider", self._provider_label(used_fallback)))
        return AssistantSystemAnalysisResponse(
            provider=response_provider,
            used_fallback=used_fallback,
            executive_summary=provider_response.answer,
            key_metrics=snapshot.key_metrics,
            modules=[self._to_module_view(module) for module in snapshot.modules],
            improvement_opportunities=provider_response.analysis or snapshot.improvement_opportunities,
            suggested_actions=[self._to_action_view(action) for action in available_actions],
            generated_at=datetime.datetime.now(datetime.UTC),
        )

    def execute_action(self, action_id: str, lang: str = "en") -> AssistantActionExecutionResponse:
        return self._to_action_execution_view(self._actions_for(normalize_lang(lang)).execute(action_id))

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
        openai_enabled = self._openai.is_available()
        gemini_enabled = self._gemini.is_available()
        llm_provider = self._active_llm_provider()
        provider = llm_provider.provider_name if llm_provider is not None else self._fallback.provider_name
        model = settings.openai.model if llm_provider is self._openai else "fallback"
        return AssistantStatusResponse(
            provider=provider,
            model=model,
            llm_enabled=openai_enabled,
            openai_enabled=openai_enabled,
            gemini_enabled=gemini_enabled,
            fallback_active=not openai_enabled,
            provider_label="OpenAI" if openai_enabled else "Fallback",
        )

    def _actions_for(self, lang: str) -> AssistantActionRegistry:
        return AssistantActionRegistry(self._db, self._context, lang)

    def _generate_chat_response(self, **kwargs):
        if self._openai.is_available():
            try:
                return self._openai.generate_chat(**kwargs), False
            except AssistantProviderError:
                pass
        kwargs.pop("execution_context", None)
        return self._fallback.generate_chat(**kwargs), True

    def _generate_system_analysis(self, **kwargs):
        if self._openai.is_available():
            try:
                return self._openai.generate_system_analysis(**kwargs), False
            except AssistantProviderError:
                pass
        return self._fallback.generate_system_analysis(**kwargs), True

    def _active_llm_provider(self):
        if self._openai.is_available():
            return self._openai
        return None

    def _tool_calling_provider(self):
        return self._active_llm_provider()

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

    def _build_direct_command_response(
        self,
        *,
        message: str,
        lang: str,
        results: Iterable[AssistantActionExecutionResult],
        snapshot: MallSnapshot,
        actions: AssistantActionRegistry,
    ) -> AssistantProviderResponse:
        result_list = list(results)
        summary_lines = "\n".join(f"- {result.summary}" for result in result_list)
        detail_blocks = [self._format_result_details(result.data, lang) for result in result_list]
        detail_text = "\n\n".join(block for block in detail_blocks if block)
        metrics = snapshot.key_metrics

        if lang == "ar":
            answer = (
                "تم تنفيذ طلبك بنجاح.\n\n"
                f"{summary_lines}\n\n"
                f"الوضع الحالي: {metrics['total_shops']} محل، {metrics['pending_tasks']} مهمة نشطة، "
                f"وإشغال المواقف {metrics['parking_occupancy']}%."
            )
            suggestions = [
                "يمكنك الآن إرسال أمر آخر مثل: أضف محل، احذف محل، ارفع الإيجار، أو أنشئ مهمة.",
                "إذا تريد تحليلًا أعمق، اطلب تقييم الأداء أو مراجعة مخاطر المحلات.",
            ]
            follow_up_questions = [
                "هل تريد أن أراجع المحلات المعرضة للخطر أم أرتب المهام الحالية؟",
            ]
        else:
            answer = (
                "Your request has been completed successfully.\n\n"
                f"{summary_lines}\n\n"
                f"Current state: {metrics['total_shops']} shops, {metrics['pending_tasks']} active tasks, "
                f"and parking occupancy is {metrics['parking_occupancy']}%."
            )
            suggestions = [
                "You can send another command such as add shop, delete shop, raise rent, or create task.",
                "If you want deeper insight, ask for performance analysis or a shop risk review.",
            ]
            follow_up_questions = [
                "Do you want me to review at-risk shops or reprioritize the current tasks?",
            ]

        if detail_text:
            answer = f"{answer}\n\n{detail_text}"

        return AssistantProviderResponse(
            answer=answer,
            analysis=snapshot.improvement_opportunities[:3],
            suggestions=suggestions,
            follow_up_questions=follow_up_questions,
            action_ids=self._resolve_action_ids(message, [], actions),
            raw_payload={"provider": self._fallback.provider_name, "mode": "direct-command-router"},
        )

    def _format_result_details(self, data: dict, lang: str) -> str:
        shops = data.get("shops")
        if isinstance(shops, list) and shops:
            lines = []
            for shop in shops[:5]:
                name = shop.get("name") or shop.get("shop_name") or "Shop"
                floor = shop.get("floor")
                rent = shop.get("rent")
                parts = [f"**{name}**"]
                if floor is not None:
                    parts.append(f"الطابق {floor}" if lang == "ar" else f"Floor {floor}")
                if rent is not None:
                    rendered_rent = f"{rent:,.0f}" if isinstance(rent, (int, float)) else str(rent)
                    parts.append(f"إيجار {rendered_rent}" if lang == "ar" else f"Rent {rendered_rent}")
                lines.append("- " + " | ".join(parts))
            header = "أهم النتائج:" if lang == "ar" else "Top results:"
            return header + "\n" + "\n".join(lines)

        tasks = data.get("tasks")
        if isinstance(tasks, list) and tasks:
            lines = []
            for task in tasks[:5]:
                title = task.get("title") or "Task"
                parts = [f"**{title}**"]
                if task.get("status"):
                    parts.append(str(task["status"]))
                if task.get("priority"):
                    parts.append(str(task["priority"]))
                lines.append("- " + " | ".join(parts))
            header = "أهم المهام:" if lang == "ar" else "Top tasks:"
            return header + "\n" + "\n".join(lines)

        task = data.get("task")
        if isinstance(task, dict) and task.get("title"):
            return (
                f"المهمة الجديدة: **{task['title']}**"
                if lang == "ar"
                else f"New task: **{task['title']}**"
            )

        return ""

    def _tool_result_summary(self, tool_name: str, result: dict, lang: str) -> str:
        if not result.get("success", True):
            error_message = result.get("error", "Unknown error")
            return (
                f"فشل تنفيذ {tool_name}: {error_message}"
                if lang == "ar"
                else f"{tool_name} failed: {error_message}"
            )

        summaries_ar = {
            "add_shop": f"تمت إضافة المحل **{result.get('name')}** في الطابق {result.get('floor')} بإيجار {result.get('rent_amount'):,.0f}.",
            "delete_shop": f"تم حذف المحل **{result.get('deleted_shop')}**.",
            "adjust_shop_rent": f"تم تعديل إيجار **{result.get('shop')}** من {result.get('old_rent'):,.0f} إلى {result.get('new_rent'):,.0f}.",
            "adjust_all_rents": f"تم تعديل إيجارات {result.get('affected_shops')} محل بنسبة {result.get('change_percent')}%.",
            "set_shop_rent": f"تم تحديد إيجار **{result.get('shop')}** إلى {result.get('new_rent'):,.0f}.",
            "add_task": f"تم إنشاء المهمة **{result.get('task', {}).get('title', '') if isinstance(result.get('task'), dict) else ''}**.",
            "complete_tasks": f"تم إكمال {result.get('completed_count')} مهمة.",
            "start_tasks": f"تم بدء {result.get('started_count')} مهمة.",
            "resolve_alerts": f"تم حل {result.get('resolved_count')} تنبيه.",
            "free_parking": f"تم تحرير {result.get('freed_count')} موقف.",
            "list_shops": f"تم العثور على {result.get('count')} محل.",
            "list_tasks": f"تم العثور على {result.get('count')} مهمة.",
            "update_shop": f"تم تحديث بيانات **{result.get('shop')}**.",
        }
        summaries_en = {
            "add_shop": f"Added shop **{result.get('name')}** on floor {result.get('floor')} with rent {result.get('rent_amount'):,.0f}.",
            "delete_shop": f"Deleted shop **{result.get('deleted_shop')}**.",
            "adjust_shop_rent": f"Updated **{result.get('shop')}** rent from {result.get('old_rent'):,.0f} to {result.get('new_rent'):,.0f}.",
            "adjust_all_rents": f"Adjusted rents for {result.get('affected_shops')} shops by {result.get('change_percent')}%.",
            "set_shop_rent": f"Set **{result.get('shop')}** rent to {result.get('new_rent'):,.0f}.",
            "add_task": f"Created task **{result.get('task', {}).get('title', '') if isinstance(result.get('task'), dict) else ''}**.",
            "complete_tasks": f"Completed {result.get('completed_count')} task(s).",
            "start_tasks": f"Started {result.get('started_count')} task(s).",
            "resolve_alerts": f"Resolved {result.get('resolved_count')} alert(s).",
            "free_parking": f"Freed {result.get('freed_count')} parking slot(s).",
            "list_shops": f"Found {result.get('count')} shop(s).",
            "list_tasks": f"Found {result.get('count')} task(s).",
            "update_shop": f"Updated **{result.get('shop')}**.",
        }
        table = summaries_ar if lang == "ar" else summaries_en
        return table.get(tool_name, f"{tool_name} executed.")

    def _resolve_action_ids(
        self,
        message: str,
        provider_action_ids: list[str],
        actions: AssistantActionRegistry,
    ) -> list[str]:
        if provider_action_ids:
            seen: set[str] = set()
            valid: list[str] = []
            for action_id in provider_action_ids:
                if action_id in seen or not actions.exists(action_id):
                    continue
                seen.add(action_id)
                valid.append(action_id)
            if valid:
                return valid[:2]

        lowered = message.casefold()
        action_ids: list[str] = []
        if any(token in lowered for token in ("task", "priority", "مهمة", "مهام", "أولوية")) and actions.exists("optimize_task_priorities"):
            action_ids.append("optimize_task_priorities")
        if any(token in lowered for token in ("risk", "shop", "tenant", "محل", "محلات", "خطر")) and actions.exists("run_shop_risk_sweep"):
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

    def _to_action_execution_view(self, result: AssistantActionExecutionResult) -> AssistantActionExecutionResponse:
        return AssistantActionExecutionResponse(
            action_id=result.action_id,
            title=result.title,
            summary=result.summary,
            affected_records=result.affected_records,
            data=result.data,
            generated_at=datetime.datetime.now(datetime.UTC),
        )

    def _provider_label(self, used_fallback: bool) -> str:
        return self._fallback.provider_name if used_fallback else f"openai:{settings.openai.model}"
