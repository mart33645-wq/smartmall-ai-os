from __future__ import annotations

import ast
import json
import operator
import re
from abc import ABC, abstractmethod
from typing import Any

import httpx

from core.config import GeminiSettings

from .models import AssistantActionDescriptor, AssistantProviderResponse, MallSnapshot

_ASSISTANT_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "analysis": {"type": "array", "items": {"type": "string"}},
        "suggestions": {"type": "array", "items": {"type": "string"}},
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
        "action_ids": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "analysis", "suggestions", "follow_up_questions", "action_ids"],
}

_MALL_KEYWORDS = (
    "mall",
    "shop",
    "shops",
    "store",
    "tenant",
    "parking",
    "task",
    "tasks",
    "revenue",
    "visitor",
    "visitors",
    "dashboard",
    "analytics",
    "report",
    "shops",
    "مول",
    "محل",
    "محلات",
    "متجر",
    "موقف",
    "مواقف",
    "مهمة",
    "مهام",
    "إيراد",
    "ايراد",
    "زوار",
    "زائر",
    "لوحة",
    "تحليل",
    "تقرير",
)

_MONITORING_KEYWORDS = (
    "alert",
    "alerts",
    "monitor",
    "monitoring",
    "security",
    "camera",
    "anomaly",
    "incident",
    "تنبيه",
    "تنبيهات",
    "مراقبة",
    "أمن",
    "امن",
    "كاميرا",
    "شذوذ",
    "حادث",
)

_GENERAL_TOPIC_RESPONSES: tuple[dict[str, Any], ...] = (
    {
        "keywords": ("api", "rest api", "واجهة برمجة", "واجهة التطبيقات"),
        "answer_en": "An API is a contract that lets one system ask another for data or actions in a predictable format.",
        "answer_ar": "الـ API هو عقد واضح يسمح لنظام أن يطلب بيانات أو ينفذ إجراءات من نظام آخر بطريقة متوقعة.",
    },
    {
        "keywords": ("react", "frontend", "واجهة مستخدم", "واجهة امامية"),
        "answer_en": "React is a UI library for building screens from reusable components and updating them efficiently when state changes.",
        "answer_ar": "React مكتبة لبناء واجهات المستخدم من مكونات قابلة لإعادة الاستخدام وتحديثها بكفاءة عند تغير الحالة.",
    },
    {
        "keywords": ("fastapi", "backend", "باك اند", "خلفية"),
        "answer_en": "FastAPI is a Python web framework focused on fast APIs, type hints, and automatic validation and docs.",
        "answer_ar": "FastAPI إطار بايثون لبناء واجهات وخدمات سريعة مع دعم قوي للأنواع والتحقق التلقائي وتوليد التوثيق.",
    },
    {
        "keywords": ("sql", "database", "postgres", "sqlite", "قاعدة بيانات", "داتابيز"),
        "answer_en": "A database stores structured data, and SQL is the language commonly used to query, update, and organize that data.",
        "answer_ar": "قاعدة البيانات تخزن البيانات المنظمة، وSQL هي اللغة الشائعة للاستعلام عنها وتحديثها وتنظيمها.",
    },
    {
        "keywords": ("ai", "llm", "machine learning", "prompt", "ذكاء اصطناعي", "تعلم آلي", "برومبت"),
        "answer_en": "AI systems learn or infer patterns from data; LLMs are optimized for language tasks such as answering, summarizing, and drafting.",
        "answer_ar": "أنظمة الذكاء الاصطناعي تستنتج أنماطًا من البيانات، أما النماذج اللغوية الكبيرة فمتخصصة في مهام اللغة مثل الإجابة والتلخيص والكتابة.",
    },
    {
        "keywords": ("kpi", "roi", "marketing", "sales", "مؤشر أداء", "عائد", "تسويق", "مبيعات"),
        "answer_en": "KPIs are measurable indicators of performance, while ROI tells you whether the return justifies the time or money invested.",
        "answer_ar": "مؤشرات الأداء تقيس التقدم بشكل قابل للقياس، بينما يوضح ROI هل العائد يبرر الوقت أو المال الذي تم استثماره.",
    },
    {
        "keywords": ("test", "testing", "qa", "اختبار", "اختبارات", "جودة"),
        "answer_en": "Good testing checks the most important user flows, the risky edge cases, and the behavior you do not want to regress later.",
        "answer_ar": "الاختبار الجيد يغطي أهم مسارات المستخدم والحالات الخطرة والسلوك الذي لا تريد أن يتراجع لاحقًا.",
    },
    {
        "keywords": ("deploy", "deployment", "release", "تسليم", "نشر", "إطلاق"),
        "answer_en": "A clean release usually means stable builds, verified environment variables, removed temporary artifacts, and a quick smoke test after deploy.",
        "answer_ar": "التسليم الجيد يعني عادة بناءً مستقرًا ومتغيرات بيئة واضحة وإزالة الملفات المؤقتة وتشغيل فحص سريع بعد النشر.",
    },
)

_SAFE_BINARY_OPERATORS: dict[type[ast.operator], Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_SAFE_UNARY_OPERATORS: dict[type[ast.unaryop], Any] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


class AssistantProviderError(RuntimeError):
    pass


class BaseAssistantProvider(ABC):
    provider_name: str

    def is_available(self) -> bool:
        return True

    @abstractmethod
    def generate_chat(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
    ) -> AssistantProviderResponse:
        raise NotImplementedError

    @abstractmethod
    def generate_system_analysis(
        self,
        *,
        snapshot: MallSnapshot,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
    ) -> AssistantProviderResponse:
        raise NotImplementedError


class GeminiAssistantProvider(BaseAssistantProvider):
    provider_name = "gemini"

    def __init__(self, config: GeminiSettings):
        self._config = config

    def is_available(self) -> bool:
        return self._config.enabled

    def generate_chat(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
        execution_context: str = "",
    ) -> AssistantProviderResponse:
        prompt = {
            "task": "chat",
            "user_message": user_message,
            "preferred_language": "Arabic" if lang == "ar" else "English",
            "mall_snapshot": snapshot.to_prompt_payload(),
            "available_actions": [
                {
                    "id": action.id,
                    "title": action.title,
                    "description": action.description,
                    "safe_to_run": action.safe_to_run,
                }
                for action in available_actions
            ],
            "already_executed": execution_context or None,
            "rules": [
                "Reply in the same language as the user's latest message.",
                "If 'already_executed' is set, CONFIRM the action was done successfully and describe what changed. NEVER say you cannot do it.",
                "Answer mall questions using the snapshot when relevant.",
                "When the question is outside the mall system, answer using general knowledge.",
                "Do not claim an action was executed unless already_executed confirms it.",
                "Only reference action_ids that exist in available_actions.",
                "Be concise and direct. No filler phrases.",
            ],
        }
        return self._request_json(history=history, prompt=prompt)

    def generate_system_analysis(
        self,
        *,
        snapshot: MallSnapshot,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
    ) -> AssistantProviderResponse:
        prompt = {
            "task": "system_analysis",
            "request": "Analyze the mall operating system and identify the weakest areas, highest-value improvements, and safe automation opportunities.",
            "preferred_language": "Arabic" if lang == "ar" else "English",
            "mall_snapshot": snapshot.to_prompt_payload(),
            "available_actions": [
                {
                    "id": action.id,
                    "title": action.title,
                    "description": action.description,
                    "safe_to_run": action.safe_to_run,
                }
                for action in available_actions
            ],
            "rules": [
                "Respond fully in preferred_language.",
                "Focus on production-ready improvements, not theory.",
                "Tie recommendations directly to current metrics.",
            ],
        }
        return self._request_json(history=[], prompt=prompt)

    def _request_json(
        self,
        *,
        history: list[dict[str, str]],
        prompt: dict[str, Any],
    ) -> AssistantProviderResponse:
        if not self.is_available():
            raise AssistantProviderError("Gemini provider is not configured")

        contents = [
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
            for item in history
            if item["role"] in {"user", "assistant"} and item["content"].strip()
        ]
        contents.append(
            {
                "role": "user",
                "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}],
            }
        )

        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": (
                            "You are SmartMall AI Assistant — an authoritative AI that controls the mall system. "
                            "Return valid JSON only. "
                            "CRITICAL RULE: If the prompt contains 'already_executed', those actions are ALREADY DONE in the database. "
                            "You MUST confirm them positively (e.g. 'تم إضافة المحل بنجاح') and NEVER say you cannot perform them. "
                            "Use current snapshot numbers when relevant. "
                            "Format answers cleanly in markdown. "
                            "Never invent action_ids outside the provided list. "
                            "Be concise, confident, and actionable."
                        )
                    }
                ]
            },
            "contents": contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": _ASSISTANT_RESPONSE_SCHEMA,
                "temperature": self._config.temperature,
            },
        }

        try:
            response = httpx.post(
                f"{self._config.base_url}/models/{self._config.model}:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self._config.api_key,
                },
                json=payload,
                timeout=self._config.timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as exc:
            raise AssistantProviderError(f"Gemini request failed: {exc}") from exc
        except ValueError as exc:
            raise AssistantProviderError("Gemini response was not valid JSON") from exc

        text = self._extract_text(data)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AssistantProviderError("Gemini returned non-JSON assistant output") from exc

        return AssistantProviderResponse(
            answer=str(parsed.get("answer") or "I reviewed the request and prepared a response."),
            analysis=self._ensure_string_list(parsed.get("analysis")),
            suggestions=self._ensure_string_list(parsed.get("suggestions")),
            follow_up_questions=self._ensure_string_list(parsed.get("follow_up_questions")),
            action_ids=self._ensure_string_list(parsed.get("action_ids")),
            raw_payload=parsed,
        )

    def _extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            raise AssistantProviderError("Gemini returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        if not text.strip():
            raise AssistantProviderError("Gemini returned an empty response")
        return text

    def _ensure_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    def generate_chat_with_tools(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        lang: str,
        tool_declarations: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], AssistantProviderResponse]:
        """
        Two-turn Gemini Function Calling flow:
        Turn 1 → Gemini decides which tool(s) to call.
        Turn 2 → Gemini confirms with natural language after seeing results.

        Returns (tool_calls, final_response).
        tool_calls is a list of {"name": str, "args": dict} dicts.
        """
        if not self.is_available():
            raise AssistantProviderError("Gemini provider is not configured")

        # Build conversation history
        contents: list[dict] = [
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
            for item in history
            if item["role"] in {"user", "assistant"} and item["content"].strip()
        ]

        # Inject mall context + user message
        context_block = {
            "mall_snapshot_summary": snapshot.to_prompt_payload(),
            "user_message": user_message,
            "preferred_language": "Arabic" if lang == "ar" else "English",
        }
        contents.append({
            "role": "user",
            "parts": [{"text": json.dumps(context_block, ensure_ascii=False)}],
        })

        system_instruction = (
            "You are SmartMall AI OS — the fully autonomous intelligence that manages this shopping mall. "
            "You have FULL permissions: you can add, modify, or delete shops, tasks, alerts, and parking. "
            "When the user gives a command in ANY language or phrasing, call the appropriate tool(s). "
            "When the user asks a question (not a command), reply in natural language without calling tools. "
            "ALWAYS reply in the same language the user used. "
            "After tools are executed, confirm what was done clearly and concisely. "
            "Never say you cannot perform an action — you have full access."
        )

        # ── Turn 1: Gemini decides which tool to call ─────────────────────────
        payload_turn1 = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "tools": [{"functionDeclarations": tool_declarations}],
            "contents": contents,
            "generationConfig": {"temperature": self._config.temperature},
        }

        try:
            r1 = httpx.post(
                f"{self._config.base_url}/models/{self._config.model}:generateContent",
                headers={"Content-Type": "application/json", "x-goog-api-key": self._config.api_key},
                json=payload_turn1,
                timeout=self._config.timeout_seconds,
            )
            r1.raise_for_status()
            data1 = r1.json()
        except httpx.HTTPError as exc:
            raise AssistantProviderError(f"Gemini turn-1 failed: {exc}") from exc

        # Parse function calls from response
        candidates = data1.get("candidates") or []
        parts1 = candidates[0].get("content", {}).get("parts", []) if candidates else []

        tool_calls: list[dict[str, Any]] = []
        text_parts: list[str] = []
        for part in parts1:
            if "functionCall" in part:
                fc = part["functionCall"]
                tool_calls.append({"name": fc.get("name", ""), "args": fc.get("args", {})})
            if "text" in part:
                text_parts.append(part["text"])

        # If no function calls, Gemini just answered → wrap as response
        if not tool_calls:
            raw_text = " ".join(text_parts).strip() or "تمت المعالجة."
            return [], AssistantProviderResponse(
                answer=raw_text,
                analysis=[],
                suggestions=[],
                follow_up_questions=[],
                action_ids=[],
                raw_payload={"provider": self.provider_name},
            )

        # We have tool calls — return them to the orchestrator to execute
        # The orchestrator will call us back (turn 2) with results
        return tool_calls, AssistantProviderResponse(
            answer="",  # placeholder, turn 2 fills this
            analysis=[],
            suggestions=[],
            follow_up_questions=[],
            action_ids=[],
            raw_payload={"provider": self.provider_name, "_parts1": parts1},
        )

    def generate_chat_with_tools_turn2(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        lang: str,
        tool_declarations: list[dict[str, Any]],
        parts1: list[dict[str, Any]],
        tool_results: list[dict[str, Any]],
    ) -> AssistantProviderResponse:
        """
        Turn 2: Send tool execution results back to Gemini for natural language confirmation.
        """
        contents: list[dict] = [
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
            for item in history
            if item["role"] in {"user", "assistant"} and item["content"].strip()
        ]
        context_block = {
            "mall_snapshot_summary": snapshot.to_prompt_payload(),
            "user_message": user_message,
            "preferred_language": "Arabic" if lang == "ar" else "English",
        }
        contents.append({"role": "user", "parts": [{"text": json.dumps(context_block, ensure_ascii=False)}]})
        # Append model's function call turn
        contents.append({"role": "model", "parts": parts1})
        # Append function results
        function_response_parts = [
            {
                "functionResponse": {
                    "name": r["name"],
                    "response": r["result"],
                }
            }
            for r in tool_results
        ]
        contents.append({"role": "user", "parts": function_response_parts})

        system_instruction = (
            "You are SmartMall AI OS. The tool(s) have been executed successfully. "
            "Confirm the result clearly and concisely in the user's language. "
            "Use markdown formatting. Be warm and direct."
        )

        payload_turn2 = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "tools": [{"functionDeclarations": tool_declarations}],
            "contents": contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": _ASSISTANT_RESPONSE_SCHEMA,
                "temperature": self._config.temperature,
            },
        }

        try:
            r2 = httpx.post(
                f"{self._config.base_url}/models/{self._config.model}:generateContent",
                headers={"Content-Type": "application/json", "x-goog-api-key": self._config.api_key},
                json=payload_turn2,
                timeout=self._config.timeout_seconds,
            )
            r2.raise_for_status()
            data2 = r2.json()
        except httpx.HTTPError as exc:
            raise AssistantProviderError(f"Gemini turn-2 failed: {exc}") from exc

        text2 = self._extract_text(data2)
        try:
            parsed = json.loads(text2)
        except json.JSONDecodeError:
            parsed = {"answer": text2, "analysis": [], "suggestions": [], "follow_up_questions": [], "action_ids": []}

        return AssistantProviderResponse(
            answer=str(parsed.get("answer") or "✅ تم تنفيذ الأمر بنجاح."),
            analysis=self._ensure_string_list(parsed.get("analysis")),
            suggestions=self._ensure_string_list(parsed.get("suggestions")),
            follow_up_questions=self._ensure_string_list(parsed.get("follow_up_questions")),
            action_ids=self._ensure_string_list(parsed.get("action_ids")),
            raw_payload=parsed,
        )


class FallbackAssistantProvider(BaseAssistantProvider):
    provider_name = "fallback-rule-engine"

    def generate_chat(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
    ) -> AssistantProviderResponse:
        lowered = user_message.casefold()

        if self._mentions_monitoring(lowered):
            return AssistantProviderResponse(
                answer=(
                    "تم إيقاف نظام المراقبة الحية والتنبيهات التلقائية. أقدر أساعدك الآن في المهام والمحلات والمواقف والتحليلات، أو أجاوب على أسئلة عامة خارج النظام."
                    if lang == "ar"
                    else "The live monitoring and auto-alert layer has been removed. I can help with tasks, shops, parking, analytics, or general questions outside the system."
                ),
                analysis=[
                    "المساعد يركز الآن على التشغيل والتحليل بدل المراقبة المستمرة."
                    if lang == "ar"
                    else "The assistant now focuses on operations and analysis instead of constant monitoring."
                ],
                suggestions=[
                    "اسأل عن أداء المحلات أو أولويات المهام أو إشغال المواقف."
                    if lang == "ar"
                    else "Ask about shop performance, task priorities, or parking occupancy.",
                    "أو اسأل أي سؤال عام في التقنية أو الأعمال أو التخطيط."
                    if lang == "ar"
                    else "Or ask any general question about tech, business, or planning.",
                ],
                follow_up_questions=[
                    "هل تريد ملخصًا تشغيليًا أم إجابة على سؤال عام؟"
                    if lang == "ar"
                    else "Do you want an operations summary or help with a general question?",
                ],
                action_ids=[],
            )

        if not self._is_mall_topic(lowered):
            return self._answer_general_question(user_message, lang)

        metrics = snapshot.key_metrics
        action_ids = self._suggest_action_ids(lowered, snapshot, available_actions)

        if "parking" in lowered or "موقف" in lowered or "مواقف" in lowered:
            answer = (
                f"إشغال المواقف حاليًا {snapshot.parking['occupancy_pct']}% مع توفر {snapshot.parking['available']} موقف."
                if lang == "ar"
                else f"Parking occupancy is {snapshot.parking['occupancy_pct']}% with {snapshot.parking['available']} spaces currently available."
            )
        elif "task" in lowered or "priority" in lowered or "مهام" in lowered or "أولوية" in lowered:
            answer = (
                f"هناك {metrics['pending_tasks']} مهمة نشطة و{metrics['overdue_tasks']} مهمة متأخرة."
                if lang == "ar"
                else f"There are {metrics['pending_tasks']} active tasks and {metrics['overdue_tasks']} overdue task(s)."
            )
        elif "risk" in lowered or "shop" in lowered or "tenant" in lowered or "خطر" in lowered or "محل" in lowered:
            answer = (
                f"أتابع {metrics['shops_at_risk']} محلًا معرضًا للخطر من أصل {metrics['total_shops']} محل."
                if lang == "ar"
                else f"I am tracking {metrics['shops_at_risk']} at-risk shop(s) across {metrics['total_shops']} tenants."
            )
        elif "report" in lowered or "pdf" in lowered or "تقرير" in lowered:
            answer = (
                "أقدر أجهز لك تقرير أداء جاهز للطباعة، ويمكنك تشغيل إجراء التقرير من داخل المساعد."
                if lang == "ar"
                else "I can prepare a printable performance report, and you can launch the report action from the assistant."
            )
        else:
            answer = (
                f"إيراد المول اليوم {metrics['total_revenue']:,.0f} مع {metrics['total_visitors']:,} زائر، ومتوسط أداء المحلات {metrics['avg_shop_performance']}%."
                if lang == "ar"
                else f"Mall revenue is ${metrics['total_revenue']:,.0f} from {metrics['total_visitors']:,} visitors today. Average shop performance is {metrics['avg_shop_performance']}%."
            )

        return AssistantProviderResponse(
            answer=answer,
            analysis=snapshot.improvement_opportunities[:3],
            suggestions=[
                "استخدم إجراءات المساعد لتطبيق التحسينات الآمنة مباشرة."
                if lang == "ar"
                else "Use assistant actions to apply safe improvements directly.",
                "يمكنك أيضًا سؤالي عن موضوع عام خارج المنصة."
                if lang == "ar"
                else "You can also ask me general questions outside the platform.",
            ],
            follow_up_questions=[
                "هل تريد تلخيص العمليات أم ترتيب المهام أم فحص مخاطر المحلات؟"
                if lang == "ar"
                else "Do you want an operations summary, task reprioritization, or a shop risk sweep?",
            ],
            action_ids=action_ids,
        )

    def generate_system_analysis(
        self,
        *,
        snapshot: MallSnapshot,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
    ) -> AssistantProviderResponse:
        metrics = snapshot.key_metrics
        weakest_module = min(snapshot.modules, key=lambda module: module.score)
        answer = (
            f"أقوى أجزاء المنظومة حاليًا هي وضوح الإيرادات، بينما أضعف نقطة هي {weakest_module.module}. يوجد {metrics['pending_tasks']} مهمة نشطة، و{metrics['overdue_tasks']} مهمة متأخرة، وإشغال المواقف عند {metrics['parking_occupancy']}%."
            if lang == "ar"
            else f"System health is strongest in revenue visibility and weakest in {weakest_module.module.lower()}. There are {metrics['pending_tasks']} active tasks, {metrics['overdue_tasks']} overdue tasks, and parking is at {metrics['parking_occupancy']}% occupancy."
        )
        return AssistantProviderResponse(
            answer=answer,
            analysis=snapshot.improvement_opportunities[:4],
            suggestions=[
                "ابدأ بأتمتة فرز المهام المتكررة قبل أن يتضخم التراكم."
                if lang == "ar"
                else "Automate repeated task triage before the backlog grows.",
                "استخدم الإجراءات الآمنة للحفاظ على حداثة بيانات المحلات والمهام."
                if lang == "ar"
                else "Use safe actions to keep task and shop data fresh.",
            ],
            follow_up_questions=[],
            action_ids=[action.id for action in available_actions[:3]],
        )

    def _is_mall_topic(self, message: str) -> bool:
        return any(keyword in message for keyword in _MALL_KEYWORDS)

    def _mentions_monitoring(self, message: str) -> bool:
        return any(keyword in message for keyword in _MONITORING_KEYWORDS)

    def _answer_general_question(self, message: str, lang: str) -> AssistantProviderResponse:
        math_answer = self._try_answer_math(message, lang)
        if math_answer is not None:
            return math_answer

        lowered = message.casefold()
        for topic in _GENERAL_TOPIC_RESPONSES:
            if any(keyword in lowered for keyword in topic["keywords"]):
                return AssistantProviderResponse(
                    answer=topic["answer_ar"] if lang == "ar" else topic["answer_en"],
                    analysis=[
                        "إذا أردت، أقدر أبسط الفكرة أكثر أو أحولها إلى مثال عملي."
                        if lang == "ar"
                        else "If you want, I can simplify it further or turn it into a practical example."
                    ],
                    suggestions=[
                        "اطلب مثالًا سريعًا أو مقارنة بين خيارين."
                        if lang == "ar"
                        else "Ask for a quick example or a comparison between two options."
                    ],
                    follow_up_questions=[
                        "هل تريد شرحًا أبسط أم مثالًا عمليًا؟"
                        if lang == "ar"
                        else "Do you want a simpler explanation or a practical example?",
                    ],
                    action_ids=[],
                )

        if any(keyword in lowered for keyword in ("how ", "how do", "how can", "كيف", "ازاي", "كيفية")):
            return AssistantProviderResponse(
                answer=(
                    "أفضل طريقة للإجابة على أسئلة كيف تكون بتقسيمها إلى: الهدف، القيود، الخطوات العملية، ثم أول خطوة تنفذها الآن. إذا أردت، أقدر أبني لك الخطة كاملة حسب الموضوع الذي تقصده."
                    if lang == "ar"
                    else "The best way to answer a how-question is to break it into the goal, constraints, practical steps, and the first action to take now. If you want, I can build the full plan around your exact topic."
                ),
                analysis=[
                    "كلما كان الهدف والقيود أوضح، كانت الإجابة أقوى."
                    if lang == "ar"
                    else "The clearer the goal and constraints, the stronger the answer becomes."
                ],
                suggestions=[
                    "اذكر الموضوع والنتيجة المطلوبة والوقت أو الموارد المتاحة."
                    if lang == "ar"
                    else "Tell me the topic, target outcome, and any time or resource limits."
                ],
                follow_up_questions=[
                    "ما الموضوع الذي تريد خطة عملية له بالضبط؟"
                    if lang == "ar"
                    else "What exact topic do you want a practical plan for?",
                ],
                action_ids=[],
            )

        if any(keyword in lowered for keyword in ("compare", "difference", "vs", "فرق", "قارن", "مقارنة")):
            return AssistantProviderResponse(
                answer=(
                    "أفضل مقارنة عملية تكون عبر أربعة محاور: الاستخدام المناسب، التكلفة أو التعقيد، السرعة في التنفيذ، والمخاطر أو القيود. اذكر الخيارين وسأقارن بينهما مباشرة."
                    if lang == "ar"
                    else "The most useful comparison usually looks at four dimensions: best use case, cost or complexity, implementation speed, and risks or tradeoffs. Tell me the two options and I will compare them directly."
                ),
                analysis=[],
                suggestions=[],
                follow_up_questions=[
                    "ما الخياران اللذان تريد المقارنة بينهما؟"
                    if lang == "ar"
                    else "Which two options do you want to compare?",
                ],
                action_ids=[],
            )

        if any(keyword in lowered for keyword in ("write", "email", "message", "draft", "اكتب", "رسالة", "ايميل", "صياغ")):
            return AssistantProviderResponse(
                answer=(
                    "أقدر أساعدك في الصياغة بسرعة. فقط اذكر نوع الرسالة، لمن ستُرسل، ونبرة الكلام المطلوبة، وسأكتبها لك بشكل مناسب."
                    if lang == "ar"
                    else "I can help you draft that quickly. Tell me the message type, who it is for, and the tone you want, and I will write it for you."
                ),
                analysis=[],
                suggestions=[],
                follow_up_questions=[
                    "هل تريدها رسمية أم مختصرة أم ودية؟"
                    if lang == "ar"
                    else "Do you want it formal, brief, or friendly?",
                ],
                action_ids=[],
            )

        return AssistantProviderResponse(
            answer=(
                "أقدر أساعدك داخل النظام وخارجه أيضًا. لو سؤالك عام، اذكر الموضوع أو الهدف بشكل مباشر وسأجاوبك أو أرتب لك الخطوات أو أبني لك مقارنة أو صياغة مناسبة."
                if lang == "ar"
                else "I can help both inside and outside the platform. For a general question, tell me the topic or goal directly and I can answer it, structure the steps, compare options, or draft something for you."
            ),
            analysis=[
                "هذا الوضع الاحتياطي أفضل مع الأسئلة المحددة والواضحة."
                if lang == "ar"
                else "This fallback mode works best when the question is specific and concrete."
            ],
            suggestions=[
                "مثال: اشرح API ببساطة، أو قارن React وVue، أو اكتب رسالة مهنية."
                if lang == "ar"
                else "Example: explain an API simply, compare React and Vue, or draft a professional message."
            ],
            follow_up_questions=[
                "ما السؤال أو الموضوع المحدد الذي تريدني أن أجاوب عنه؟"
                if lang == "ar"
                else "What specific question or topic do you want me to answer?",
            ],
            action_ids=[],
        )

    def _try_answer_math(self, message: str, lang: str) -> AssistantProviderResponse | None:
        expression = self._extract_math_expression(message)
        if not expression:
            return None

        try:
            result = self._safe_eval_expression(expression)
        except Exception:
            return None

        rendered = int(result) if float(result).is_integer() else round(float(result), 4)
        return AssistantProviderResponse(
            answer=(
                f"ناتج العملية هو {rendered}."
                if lang == "ar"
                else f"The result is {rendered}."
            ),
            analysis=[],
            suggestions=[
                "إذا أردت، أشرح لك الخطوات خطوة بخطوة."
                if lang == "ar"
                else "If you want, I can also show the steps."
            ],
            follow_up_questions=[
                "هل تريد شرح طريقة الحل؟"
                if lang == "ar"
                else "Do you want the working steps?",
            ],
            action_ids=[],
        )

    def _extract_math_expression(self, message: str) -> str | None:
        normalized = message.casefold().strip()
        for prefix in ("what is", "calculate", "solve", "احسب", "كم يساوي", "ما ناتج", "ناتج"):
            normalized = normalized.replace(prefix, "")
        normalized = normalized.strip(" =?؟.")
        if not normalized:
            return None
        if not re.fullmatch(r"[\d\.\s\+\-\*\/\(\)%]+", normalized):
            return None
        return normalized

    def _safe_eval_expression(self, expression: str) -> float:
        node = ast.parse(expression, mode="eval")
        return float(self._eval_node(node.body))

    def _eval_node(self, node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in _SAFE_BINARY_OPERATORS:
            left = self._eval_node(node.left)
            right = self._eval_node(node.right)
            return float(_SAFE_BINARY_OPERATORS[type(node.op)](left, right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _SAFE_UNARY_OPERATORS:
            return float(_SAFE_UNARY_OPERATORS[type(node.op)](self._eval_node(node.operand)))
        raise ValueError("Unsupported expression")

    def _suggest_action_ids(
        self,
        message: str,
        snapshot: MallSnapshot,
        available_actions: list[AssistantActionDescriptor],
    ) -> list[str]:
        catalog = {action.id for action in available_actions}
        suggested: list[str] = []

        if ("task" in message or "priority" in message or "مهام" in message or "أولوية" in message) and "optimize_task_priorities" in catalog:
            suggested.append("optimize_task_priorities")
        if ("risk" in message or "shop" in message or "tenant" in message or "خطر" in message or "محل" in message) and "run_shop_risk_sweep" in catalog:
            suggested.append("run_shop_risk_sweep")
        if ("report" in message or "pdf" in message or "تقرير" in message) and "generate_performance_report" in catalog:
            suggested.append("generate_performance_report")
        if not suggested and "summarize_operations" in catalog:
            suggested.append("summarize_operations")
        if not suggested:
            suggested = [action.id for action in snapshot.suggested_actions[:2]]
        return suggested
