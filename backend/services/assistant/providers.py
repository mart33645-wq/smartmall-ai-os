from __future__ import annotations

import ast
import json
import operator
import re
from abc import ABC, abstractmethod
from typing import Any

import httpx

from core.config import GeminiSettings, OpenAISettings

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

_MALL_KEYWORDS = (
    "mall",
    "shop",
    "shops",
    "store",
    "tenant",
    "parking",
    "task",
    "tasks",
    "rent",
    "revenue",
    "visitor",
    "visitors",
    "dashboard",
    "analytics",
    "report",
    "alert",
    "alerts",
    "assistant",
    "add shop",
    "delete shop",
    "remove shop",
    "raise rent",
    "increase rent",
    "lower rent",
    "add task",
    "resolve alerts",
    "free parking",
    "مول",
    "محل",
    "محلات",
    "متجر",
    "موقف",
    "مواقف",
    "مهمة",
    "مهام",
    "إيجار",
    "ايجار",
    "إيراد",
    "ايراد",
    "زوار",
    "زائر",
    "لوحة",
    "تحليل",
    "تقرير",
    "تنبيه",
    "تنبيهات",
    "اضف محل",
    "ضيف محل",
    "احذف محل",
    "ارفع الايجار",
    "ارفع إيجار",
    "خفض الايجار",
    "اضف مهمة",
)

_MONITORING_KEYWORDS = (
    "alert",
    "alerts",
    "monitor",
    "monitoring",
    "security",
    "camera",
    "incident",
    "anomaly",
    "تنبيه",
    "تنبيهات",
    "مراقبة",
    "أمن",
    "امن",
    "كاميرا",
    "حادث",
)

_GENERAL_TOPIC_RESPONSES: tuple[dict[str, Any], ...] = (
    {
        "keywords": ("api", "rest api", "واجهة برمجة", "واجهة التطبيقات"),
        "answer_en": "An API is a clear contract that lets one system ask another for data or actions in a predictable format.",
        "answer_ar": "الـ API هو عقد واضح يسمح لنظام أن يطلب بيانات أو ينفذ إجراءات من نظام آخر بطريقة متوقعة.",
    },
    {
        "keywords": ("react", "frontend", "واجهة مستخدم", "واجهة امامية"),
        "answer_en": "React is a UI library for building screens from reusable components and updating them efficiently when state changes.",
        "answer_ar": "React مكتبة لبناء واجهات المستخدم من مكونات قابلة لإعادة الاستخدام وتحديثها بكفاءة عند تغير الحالة.",
    },
    {
        "keywords": ("fastapi", "backend", "باك اند", "خلفية"),
        "answer_en": "FastAPI is a Python framework for fast APIs with strong typing, validation, and automatic docs.",
        "answer_ar": "FastAPI إطار بايثون لبناء واجهات وخدمات سريعة مع دعم قوي للأنواع والتحقق التلقائي والتوثيق.",
    },
    {
        "keywords": ("sql", "database", "postgres", "sqlite", "قاعدة بيانات", "داتابيز"),
        "answer_en": "A database stores structured data, and SQL is the common language used to query, update, and organize it.",
        "answer_ar": "قاعدة البيانات تخزن البيانات المنظمة، وSQL هي اللغة الشائعة للاستعلام عنها وتحديثها وتنظيمها.",
    },
    {
        "keywords": ("ai", "llm", "machine learning", "prompt", "ذكاء اصطناعي", "تعلم آلي", "برومبت"),
        "answer_en": "AI systems infer patterns from data, and large language models are optimized for language tasks like answering, drafting, and summarizing.",
        "answer_ar": "أنظمة الذكاء الاصطناعي تستنتج أنماطًا من البيانات، أما النماذج اللغوية الكبيرة فهي متخصصة في مهام اللغة مثل الإجابة والصياغة والتلخيص.",
    },
    {
        "keywords": ("deploy", "deployment", "release", "تسليم", "نشر", "إطلاق"),
        "answer_en": "A clean release usually means stable builds, verified environment variables, no temporary artifacts, and a quick smoke test after deployment.",
        "answer_ar": "التسليم الجيد يعني عادة بناءً مستقرًا ومتغيرات بيئة واضحة وإزالة الملفات المؤقتة وتشغيل فحص سريع بعد النشر.",
    },
)


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

    def generate_chat_with_tools(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        lang: str,
        tool_declarations: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], AssistantProviderResponse]:
        raise AssistantProviderError(f"{self.provider_name} does not support tool calling")

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
        raise AssistantProviderError(f"{self.provider_name} does not support tool calling")


class OpenAIAssistantProvider(BaseAssistantProvider):
    provider_name = "openai"

    def __init__(self, config: OpenAISettings):
        self._config = config

    @property
    def provider_label(self) -> str:
        return f"{self.provider_name}:{self._config.model}"

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
            "preferred_language": "Arabic" if lang == "ar" else "English",
            "user_message": user_message,
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
                "Reply in the same language as the user's last message.",
                "Return valid JSON only.",
                "If already_executed is present, confirm the action completed successfully and explain the result.",
                "Use mall snapshot data when answering operational questions.",
                "Use general knowledge for non-mall questions.",
                "Do not invent action_ids that are not present in available_actions.",
                "Keep the answer concise and useful.",
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
                "Reply fully in preferred_language.",
                "Focus on production-ready improvements with measurable impact.",
                "Tie recommendations directly to current metrics.",
                "Return valid JSON only.",
            ],
        }
        return self._request_json(history=[], prompt=prompt)

    def generate_chat_with_tools(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        lang: str,
        tool_declarations: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], AssistantProviderResponse]:
        if not self.is_available():
            raise AssistantProviderError("OpenAI provider is not configured")

        payload: dict[str, Any] = {
            "model": self._config.model,
            "messages": [
                {
                    "role": "developer",
                    "content": (
                        "You are SmartMall AI OS. "
                        "When the user gives a clear operational command, call the appropriate tool. "
                        "When the user asks a question instead of a command, answer naturally without calling tools. "
                        "Reply in the same language as the user."
                    ),
                },
                *self._build_history_messages(history),
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "preferred_language": "Arabic" if lang == "ar" else "English",
                            "user_message": user_message,
                            "mall_snapshot": snapshot.to_prompt_payload(),
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "tools": self._to_openai_tools(tool_declarations),
            "tool_choice": "auto",
            "parallel_tool_calls": False,
            "service_tier": "auto",
        }
        self._attach_reasoning_effort(payload)

        data = self._post_json(payload)
        message = self._first_choice_message(data)
        tool_calls = self._extract_tool_calls(message.get("tool_calls"))
        if tool_calls:
            return tool_calls, AssistantProviderResponse(
                answer="",
                raw_payload={"provider": self.provider_label},
            )

        answer_text = self._message_text(message) or (
            "راجعت طلبك وسأساعدك بالاعتماد على بيانات المول الحالية."
            if lang == "ar"
            else "I reviewed your request and will help using the current mall data."
        )
        return [], AssistantProviderResponse(
            answer=answer_text,
            analysis=[],
            suggestions=[],
            follow_up_questions=[],
            action_ids=[],
            raw_payload={"provider": self.provider_label},
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
        del tool_declarations, parts1
        prompt = {
            "task": "tool_execution_summary",
            "preferred_language": "Arabic" if lang == "ar" else "English",
            "user_message": user_message,
            "mall_snapshot": snapshot.to_prompt_payload(),
            "tool_results": tool_results,
            "rules": [
                "Return valid JSON only.",
                "Confirm successful actions positively when success=true.",
                "If any tool failed, explain the failure clearly and suggest the next step.",
                "Use markdown when it improves readability.",
                "Keep the answer concise and confident.",
            ],
        }
        return self._request_json(history=history, prompt=prompt)

    def _request_json(
        self,
        *,
        history: list[dict[str, str]],
        prompt: dict[str, Any],
    ) -> AssistantProviderResponse:
        if not self.is_available():
            raise AssistantProviderError("OpenAI provider is not configured")

        payload: dict[str, Any] = {
            "model": self._config.model,
            "messages": [
                {
                    "role": "developer",
                    "content": (
                        "You are SmartMall AI Assistant, an authoritative mall operations copilot. "
                        "Return valid JSON only and stay concise. "
                        "Use current snapshot data when relevant. "
                        "Never invent action_ids outside the provided list."
                    ),
                },
                *self._build_history_messages(history),
                {
                    "role": "user",
                    "content": json.dumps(prompt, ensure_ascii=False),
                },
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "assistant_response",
                    "schema": _ASSISTANT_RESPONSE_SCHEMA,
                    "strict": True,
                },
            },
            "service_tier": "auto",
        }
        self._attach_reasoning_effort(payload)

        data = self._post_json(payload)
        message = self._first_choice_message(data)
        text = self._message_text(message)
        if not text:
            refusal = str(message.get("refusal") or "").strip()
            if refusal:
                raise AssistantProviderError(f"OpenAI refused the request: {refusal}")
            raise AssistantProviderError("OpenAI returned an empty response")

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AssistantProviderError("OpenAI returned non-JSON assistant output") from exc

        return AssistantProviderResponse(
            answer=str(parsed.get("answer") or "I reviewed the request and prepared a response."),
            analysis=self._ensure_string_list(parsed.get("analysis")),
            suggestions=self._ensure_string_list(parsed.get("suggestions")),
            follow_up_questions=self._ensure_string_list(parsed.get("follow_up_questions")),
            action_ids=self._ensure_string_list(parsed.get("action_ids")),
            raw_payload={"provider": self.provider_label, **parsed},
        )

    def _build_history_messages(self, history: list[dict[str, str]]) -> list[dict[str, str]]:
        return [
            {
                "role": item["role"],
                "content": item["content"],
            }
            for item in history
            if item.get("role") in {"user", "assistant"} and str(item.get("content") or "").strip()
        ]

    def _to_openai_tools(self, tool_declarations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        tools: list[dict[str, Any]] = []
        for tool in tool_declarations:
            name = str(tool.get("name") or "").strip()
            if not name:
                continue
            tools.append(
                {
                    "type": "function",
                    "function": {
                        "name": name,
                        "description": str(tool.get("description") or "").strip(),
                        "parameters": self._normalize_schema(tool.get("parameters") or {"type": "object", "properties": {}}),
                    },
                }
            )
        return tools

    def _normalize_schema(self, value: Any) -> Any:
        if isinstance(value, dict):
            normalized: dict[str, Any] = {}
            for key, item in value.items():
                if key == "type" and isinstance(item, str):
                    normalized[key] = item.lower()
                else:
                    normalized[key] = self._normalize_schema(item)
            return normalized
        if isinstance(value, list):
            return [self._normalize_schema(item) for item in value]
        return value

    def _attach_reasoning_effort(self, payload: dict[str, Any]) -> None:
        if self._config.model.startswith("gpt-5"):
            payload["reasoning_effort"] = "low"

    def _post_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        timeout_seconds = max(4.0, min(float(self._config.timeout_seconds), 12.0))
        timeout = httpx.Timeout(timeout_seconds, connect=3.0)

        try:
            response = httpx.post(
                f"{self._config.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._config.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise AssistantProviderError(f"OpenAI request failed: {exc}") from exc
        except ValueError as exc:
            raise AssistantProviderError("OpenAI response was not valid JSON") from exc

    def _first_choice_message(self, payload: dict[str, Any]) -> dict[str, Any]:
        choices = payload.get("choices") or []
        if not choices:
            raise AssistantProviderError("OpenAI returned no choices")
        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise AssistantProviderError("OpenAI returned a malformed message")
        return message

    def _message_text(self, message: dict[str, Any]) -> str:
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "text":
                    text = str(item.get("text") or "").strip()
                    if text:
                        parts.append(text)
            return "\n".join(parts).strip()
        return ""

    def _extract_tool_calls(self, tool_calls: Any) -> list[dict[str, Any]]:
        if not isinstance(tool_calls, list):
            return []

        parsed_calls: list[dict[str, Any]] = []
        for item in tool_calls:
            if not isinstance(item, dict):
                continue
            function_payload = item.get("function")
            if not isinstance(function_payload, dict):
                continue
            name = str(function_payload.get("name") or "").strip()
            if not name:
                continue

            raw_args = function_payload.get("arguments") or "{}"
            args: dict[str, Any]
            if isinstance(raw_args, str):
                try:
                    loaded = json.loads(raw_args)
                except json.JSONDecodeError:
                    loaded = {}
            else:
                loaded = raw_args

            args = loaded if isinstance(loaded, dict) else {}
            parsed_calls.append({"name": name, "args": args, "tool_call_id": item.get("id")})
        return parsed_calls

    def _ensure_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]


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
            "preferred_language": "Arabic" if lang == "ar" else "English",
            "user_message": user_message,
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
                "Reply in the same language as the user's last message.",
                "Return valid JSON only.",
                "If already_executed is present, confirm the action completed successfully and explain the result.",
                "Use mall snapshot data when answering operational questions.",
                "Use general knowledge for non-mall questions.",
                "Do not invent action_ids that are not present in available_actions.",
                "Keep the answer concise and useful.",
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
                "Reply fully in preferred_language.",
                "Focus on production-ready improvements with measurable impact.",
                "Tie recommendations directly to current metrics.",
                "Return valid JSON only.",
            ],
        }
        return self._request_json(history=[], prompt=prompt)

    def generate_chat_with_tools(
        self,
        *,
        history: list[dict[str, str]],
        snapshot: MallSnapshot,
        user_message: str,
        lang: str,
        tool_declarations: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], AssistantProviderResponse]:
        if not self.is_available():
            raise AssistantProviderError("Gemini provider is not configured")

        contents = self._build_history_contents(history)
        contents.append(
            {
                "role": "user",
                "parts": [
                    {
                        "text": json.dumps(
                            {
                                "preferred_language": "Arabic" if lang == "ar" else "English",
                                "user_message": user_message,
                                "mall_snapshot": snapshot.to_prompt_payload(),
                            },
                            ensure_ascii=False,
                        )
                    }
                ],
            }
        )

        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": (
                            "You are SmartMall AI OS. "
                            "When the user gives a clear operational command, call the appropriate tool. "
                            "When the user asks a question instead of a command, answer naturally without calling tools. "
                            "Reply in the same language as the user."
                        )
                    }
                ]
            },
            "tools": [{"functionDeclarations": tool_declarations}],
            "contents": contents,
            "generationConfig": {"temperature": self._config.temperature},
        }

        data = self._post_json(payload)
        parts = self._first_candidate_parts(data)

        tool_calls: list[dict[str, Any]] = []
        text_parts: list[str] = []
        for part in parts:
            function_call = part.get("functionCall") or part.get("function_call")
            if isinstance(function_call, dict):
                tool_calls.append(
                    {
                        "name": str(function_call.get("name") or "").strip(),
                        "args": function_call.get("args") or {},
                    }
                )
                continue

            text = str(part.get("text") or "").strip()
            if text:
                text_parts.append(text)

        if tool_calls:
            return tool_calls, AssistantProviderResponse(
                answer="",
                raw_payload={"provider": self.provider_name, "_parts1": parts},
            )

        answer_text = "\n".join(text_parts).strip() or (
            "راجعت طلبك وسأساعدك بناءً على بيانات المول الحالية."
            if lang == "ar"
            else "I reviewed your request and will help using the current mall data."
        )
        return [], AssistantProviderResponse(
            answer=answer_text,
            analysis=[],
            suggestions=[],
            follow_up_questions=[],
            action_ids=[],
            raw_payload={"provider": self.provider_name},
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
        del tool_declarations, parts1
        prompt = {
            "task": "tool_execution_summary",
            "preferred_language": "Arabic" if lang == "ar" else "English",
            "user_message": user_message,
            "mall_snapshot": snapshot.to_prompt_payload(),
            "tool_results": tool_results,
            "rules": [
                "Return valid JSON only.",
                "Confirm successful actions positively when success=true.",
                "If any tool failed, explain the failure clearly and suggest the next step.",
                "Use markdown when it improves readability.",
                "Keep the answer concise and confident.",
            ],
        }
        return self._request_json(history=history, prompt=prompt)

    def _request_json(
        self,
        *,
        history: list[dict[str, str]],
        prompt: dict[str, Any],
    ) -> AssistantProviderResponse:
        if not self.is_available():
            raise AssistantProviderError("Gemini provider is not configured")

        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": (
                            "You are SmartMall AI Assistant, an authoritative mall operations copilot. "
                            "Return valid JSON only and stay concise. "
                            "Use current snapshot data when relevant. "
                            "Never invent action_ids outside the provided list."
                        )
                    }
                ]
            },
            "contents": self._build_history_contents(history)
            + [
                {
                    "role": "user",
                    "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}],
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": _ASSISTANT_RESPONSE_SCHEMA,
                "temperature": self._config.temperature,
            },
        }

        data = self._post_json(payload)
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
            raw_payload={"provider": self.provider_name, **parsed},
        )

    def _build_history_contents(self, history: list[dict[str, str]]) -> list[dict[str, Any]]:
        return [
            {
                "role": "model" if item["role"] == "assistant" else "user",
                "parts": [{"text": item["content"]}],
            }
            for item in history
            if item.get("role") in {"user", "assistant"} and str(item.get("content") or "").strip()
        ]

    def _post_json(self, payload: dict[str, Any]) -> dict[str, Any]:
        timeout_seconds = max(4.0, min(float(self._config.timeout_seconds), 12.0))
        timeout = httpx.Timeout(timeout_seconds, connect=3.0)

        try:
            response = httpx.post(
                f"{self._config.base_url}/models/{self._config.model}:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self._config.api_key,
                },
                json=payload,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            raise AssistantProviderError(f"Gemini request failed: {exc}") from exc
        except ValueError as exc:
            raise AssistantProviderError("Gemini response was not valid JSON") from exc

    def _first_candidate_parts(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        candidates = payload.get("candidates") or []
        if not candidates:
            raise AssistantProviderError("Gemini returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        if not isinstance(parts, list):
            raise AssistantProviderError("Gemini returned malformed content parts")
        return [part for part in parts if isinstance(part, dict)]

    def _extract_text(self, payload: dict[str, Any]) -> str:
        parts = self._first_candidate_parts(payload)
        text = "".join(str(part.get("text") or "") for part in parts)
        if not text.strip():
            raise AssistantProviderError("Gemini returned an empty response")
        return text

    def _ensure_string_list(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]


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
        del history
        message = (user_message or "").strip()
        if not message:
            return AssistantProviderResponse(
                answer=(
                    "اكتب سؤالك أو أمرك مباشرة، وسأحلله بناءً على بيانات المول الحالية."
                    if lang == "ar"
                    else "Ask your question or give a command directly, and I will work from the current mall data."
                ),
                follow_up_questions=[
                    "هل تريد ملخصًا تشغيليًا أم مساعدة عامة؟"
                    if lang == "ar"
                    else "Do you want an operations summary or general help?"
                ],
            )

        lowered = message.casefold()
        if not self._is_mall_topic(lowered):
            return self._answer_general_question(message, lang)

        metrics = snapshot.key_metrics
        action_ids = self._suggest_action_ids(lowered, snapshot, available_actions)

        if self._mentions_monitoring(lowered):
            answer = (
                "حالة المراقبة مستقرة حاليًا، ويفضل متابعة التنبيهات المفتوحة وأي ارتفاع في إشغال المواقف أو المهام المتأخرة."
                if lang == "ar"
                else "Monitoring is currently stable. Keep an eye on open alerts, parking pressure, and overdue tasks."
            )
        elif any(token in lowered for token in ("parking", "موقف", "مواقف")):
            answer = (
                f"إشغال المواقف الآن {snapshot.parking['occupancy_pct']}% مع توفر {snapshot.parking['available']} موقف."
                if lang == "ar"
                else f"Parking occupancy is {snapshot.parking['occupancy_pct']}% with {snapshot.parking['available']} spaces available."
            )
        elif any(token in lowered for token in ("task", "tasks", "priority", "مهمة", "مهام", "أولوية")):
            answer = (
                f"هناك {metrics['pending_tasks']} مهمة نشطة و{metrics['overdue_tasks']} مهمة متأخرة تحتاج متابعة."
                if lang == "ar"
                else f"There are {metrics['pending_tasks']} active tasks and {metrics['overdue_tasks']} overdue tasks that need attention."
            )
        elif any(token in lowered for token in ("risk", "shop", "tenant", "محل", "محلات", "خطر")):
            answer = (
                f"أتابع {metrics['shops_at_risk']} محلًا معرضًا للخطر من أصل {metrics['total_shops']} محل."
                if lang == "ar"
                else f"I am tracking {metrics['shops_at_risk']} at-risk shops out of {metrics['total_shops']} total shops."
            )
        elif any(token in lowered for token in ("report", "pdf", "تقرير")):
            answer = (
                "أقدر أجهز لك تقرير أداء جاهز للطباعة أو الحفظ PDF من داخل النظام."
                if lang == "ar"
                else "I can prepare a performance report that is ready to print or save as PDF."
            )
        else:
            answer = (
                f"إيراد المول الحالي {metrics['total_revenue']:,.0f} مع {metrics['total_visitors']:,} زائر ومتوسط أداء للمحلات {metrics['avg_shop_performance']}%."
                if lang == "ar"
                else f"Mall revenue is {metrics['total_revenue']:,.0f} with {metrics['total_visitors']:,} visitors and an average shop performance of {metrics['avg_shop_performance']}%."
            )

        return AssistantProviderResponse(
            answer=answer,
            analysis=snapshot.improvement_opportunities[:3],
            suggestions=[
                "شغّل الإجراءات الآمنة من داخل المساعد لتطبيق التحسينات بسرعة."
                if lang == "ar"
                else "Use the assistant's safe actions to apply improvements quickly.",
                "اسألني أيضًا عن مفاهيم تقنية أو تشغيلية أو تجارية عامة."
                if lang == "ar"
                else "You can also ask me about general technical, operational, or business topics.",
            ],
            follow_up_questions=[
                "هل تريد تلخيص العمليات أم ترتيب المهام أم فحص مخاطر المحلات؟"
                if lang == "ar"
                else "Do you want an operations summary, task reprioritization, or a shop risk sweep?",
            ],
            action_ids=action_ids,
            raw_payload={"provider": self.provider_name},
        )

    def generate_system_analysis(
        self,
        *,
        snapshot: MallSnapshot,
        available_actions: list[AssistantActionDescriptor],
        lang: str,
    ) -> AssistantProviderResponse:
        weakest_module = min(snapshot.modules, key=lambda module: module.score)
        metrics = snapshot.key_metrics
        answer = (
            f"أوضح نقطة ضعف حاليًا هي {weakest_module.module}. يوجد {metrics['pending_tasks']} مهمة نشطة و{metrics['overdue_tasks']} مهمة متأخرة، بينما إشغال المواقف عند {metrics['parking_occupancy']}%."
            if lang == "ar"
            else f"The weakest area right now is {weakest_module.module}. There are {metrics['pending_tasks']} active tasks, {metrics['overdue_tasks']} overdue tasks, and parking occupancy is {metrics['parking_occupancy']}%."
        )
        return AssistantProviderResponse(
            answer=answer,
            analysis=snapshot.improvement_opportunities[:4],
            suggestions=[
                "ابدأ بتقليل التراكم التشغيلي ثم راقب المحلات المعرضة للخطر."
                if lang == "ar"
                else "Start by reducing operational backlog, then review at-risk shops.",
                "فعّل OpenAI لاحقًا لأسئلة أكثر تعقيدًا إن احتجت."
                if lang == "ar"
                else "Enable OpenAI later if you want broader and more flexible answers.",
            ],
            follow_up_questions=[],
            action_ids=[action.id for action in available_actions[:3]],
            raw_payload={"provider": self.provider_name},
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
                        "إذا أردت، أقدر أبسطها أكثر أو أحولها إلى مثال عملي."
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
                        else "Do you want a simpler explanation or a practical example?"
                    ],
                    action_ids=[],
                    raw_payload={"provider": self.provider_name},
                )

        if any(keyword in lowered for keyword in ("how ", "how do", "how can", "كيف", "ازاي", "كيفية")):
            return AssistantProviderResponse(
                answer=(
                    "أفضل إجابة على سؤال من نوع كيف تكون بتحديد الهدف والقيود والخطوات العملية ثم أول خطوة تبدأ بها الآن."
                    if lang == "ar"
                    else "The best way to answer a how-question is to define the goal, constraints, practical steps, and the first action to take now."
                ),
                analysis=[
                    "كلما كان الهدف والقيود أوضح كانت الإجابة أقوى."
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
                    else "What exact topic do you want a practical plan for?"
                ],
                action_ids=[],
                raw_payload={"provider": self.provider_name},
            )

        if any(keyword in lowered for keyword in ("compare", "difference", "vs", "فرق", "قارن", "مقارنة")):
            return AssistantProviderResponse(
                answer=(
                    "أفضل مقارنة عملية تكون عبر الاستخدام المناسب والتكلفة أو التعقيد والسرعة في التنفيذ والمخاطر أو القيود."
                    if lang == "ar"
                    else "The most useful comparison usually looks at best use case, cost or complexity, implementation speed, and risks or tradeoffs."
                ),
                follow_up_questions=[
                    "ما الخياران اللذان تريد المقارنة بينهما؟"
                    if lang == "ar"
                    else "Which two options do you want to compare?"
                ],
                action_ids=[],
                raw_payload={"provider": self.provider_name},
            )

        if any(keyword in lowered for keyword in ("write", "email", "message", "draft", "اكتب", "رسالة", "ايميل", "صياغ")):
            return AssistantProviderResponse(
                answer=(
                    "أقدر أساعدك في الصياغة بسرعة. اذكر نوع الرسالة ولمن سترسلها والنبرة المطلوبة وسأكتبها لك."
                    if lang == "ar"
                    else "I can help you draft that quickly. Tell me the message type, who it is for, and the tone you want, and I will write it."
                ),
                follow_up_questions=[
                    "هل تريدها رسمية أم مختصرة أم ودية؟"
                    if lang == "ar"
                    else "Do you want it formal, brief, or friendly?"
                ],
                action_ids=[],
                raw_payload={"provider": self.provider_name},
            )

        return AssistantProviderResponse(
            answer=(
                "أقدر أساعدك داخل النظام وخارجه أيضًا. اذكر السؤال أو الهدف بشكل مباشر وسأجاوبك أو أرتب لك الخطوات."
                if lang == "ar"
                else "I can help both inside and outside the platform. Tell me the question or goal directly and I will answer it or structure the steps."
            ),
            analysis=[
                "هذا الوضع الاحتياطي يعمل أفضل مع الأسئلة المحددة والواضحة."
                if lang == "ar"
                else "This fallback mode works best when the question is specific and concrete."
            ],
            suggestions=[
                "مثال: اشرح API ببساطة، أو قارن React وVue، أو اكتب رسالة مهنية."
                if lang == "ar"
                else "Example: explain an API simply, compare React and Vue, or draft a professional message."
            ],
            follow_up_questions=[
                "ما السؤال أو الموضوع المحدد الذي تريدني أن أجيب عنه؟"
                if lang == "ar"
                else "What specific question or topic do you want me to answer?"
            ],
            action_ids=[],
            raw_payload={"provider": self.provider_name},
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
            suggestions=[
                "إذا أردت، أشرح لك الخطوات خطوة بخطوة."
                if lang == "ar"
                else "If you want, I can also show the steps."
            ],
            follow_up_questions=[
                "هل تريد شرح طريقة الحل؟"
                if lang == "ar"
                else "Do you want the working steps?"
            ],
            action_ids=[],
            raw_payload={"provider": self.provider_name},
        )

    def _extract_math_expression(self, message: str) -> str | None:
        normalized = message.casefold().strip()
        for prefix in ("what is", "calculate", "solve", "احسب", "كم يساوي", "ما ناتج", "ناتج"):
            normalized = normalized.replace(prefix, "")
        normalized = normalized.strip(" =?.؟")
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

        if any(token in message for token in ("task", "priority", "مهمة", "مهام", "أولوية")) and "optimize_task_priorities" in catalog:
            suggested.append("optimize_task_priorities")
        if any(token in message for token in ("risk", "shop", "tenant", "محل", "محلات", "خطر")) and "run_shop_risk_sweep" in catalog:
            suggested.append("run_shop_risk_sweep")
        if any(token in message for token in ("report", "pdf", "تقرير")) and "generate_performance_report" in catalog:
            suggested.append("generate_performance_report")
        if not suggested and "summarize_operations" in catalog:
            suggested.append("summarize_operations")
        if not suggested:
            suggested = [action.id for action in snapshot.suggested_actions[:2]]
        return suggested
