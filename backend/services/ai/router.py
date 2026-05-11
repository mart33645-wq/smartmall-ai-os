"""
AIRouter — unified provider abstraction with automatic OpenAI→Gemini failover.

This is the central gateway for ALL AI calls in SmartMall AI OS.
Any service that needs LLM capabilities should use this router, not call
providers directly.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, AsyncGenerator, Literal

from core.config import AppSettings
from .providers.openai_provider import OpenAIProvider, OpenAIProviderError
from .providers.gemini_provider import GeminiProvider, GeminiProviderError
from .tool_format import declarations_to_openai_tools

logger = logging.getLogger(__name__)

ProviderName = Literal["openai", "gemini", "none"]


class AllProvidersFailedError(RuntimeError):
    """Raised when both OpenAI and Gemini fail on the same request."""
    pass


class AIRouter:
    """
    Production AI router with automatic failover.

    Priority:
        1. OpenAI (gpt-4o-mini by default) — primary
        2. Gemini (gemini-2.5-pro) — automatic fallback if OpenAI fails
        3. Raises AllProvidersFailedError — caller decides how to handle (e.g. rule-engine)

    Usage:
        router = AIRouter(settings)
        text, provider = router.generate(messages, system_prompt="You are...")
        async for token in router.stream(messages, system_prompt="..."):
            yield token
    """

    def __init__(self, config: AppSettings) -> None:
        self._openai = OpenAIProvider(config.openai)
        self._gemini = GeminiProvider(config.gemini)
        self._failover_count = 0
        self._last_failover_ts: float = 0.0

    # ── Synchronous generation ─────────────────────────────────────────────────

    def generate(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        response_format: dict | None = None,
        temperature: float | None = None,
    ) -> tuple[dict[str, Any], ProviderName]:
        """
        Generate a response, trying OpenAI first then Gemini.
        Returns (api_response_dict, provider_name_used).
        """
        # ── Try OpenAI ────────────────────────────────────────────────────────
        if self._openai.is_healthy():
            try:
                result = self._openai.generate(
                    messages=messages,
                    system_prompt=system_prompt,
                    response_format=response_format,
                    temperature=temperature,
                )
                logger.debug("AIRouter: OpenAI responded successfully")
                return result, "openai"
            except OpenAIProviderError as exc:
                logger.warning("AIRouter: OpenAI failed (%s: %s), switching to Gemini", exc.kind, exc)
                self._openai.record_failure()
                self._record_failover()

        # ── Try Gemini ────────────────────────────────────────────────────────
        if self._gemini.is_healthy():
            try:
                result = self._gemini.generate(
                    messages=messages,
                    system_prompt=system_prompt,
                    response_format=response_format,
                    temperature=temperature,
                )
                logger.info("AIRouter: Gemini responded (OpenAI was unavailable/failed)")
                return result, "gemini"
            except GeminiProviderError as exc:
                logger.warning("AIRouter: Gemini also failed (%s: %s)", exc.kind, exc)
                self._gemini.record_failure()

        raise AllProvidersFailedError("Both OpenAI and Gemini failed")

    def generate_text(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float | None = None,
    ) -> tuple[str, ProviderName]:
        """
        Convenience wrapper — returns (text_string, provider_name).
        Extracts message content from the raw API response.
        """
        raw, provider = self.generate(
            messages=messages,
            system_prompt=system_prompt,
            temperature=temperature,
        )
        text = self._extract_text(raw)
        return text, provider

    def generate_json(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        json_schema: dict | None = None,
    ) -> tuple[dict[str, Any], ProviderName]:
        """Generate and parse a JSON response from the best available provider."""
        response_format = None
        if json_schema:
            response_format = {
                "type": "json_schema",
                "json_schema": {"name": "response", "schema": json_schema, "strict": True},
            }
        raw, provider = self.generate(
            messages=messages,
            system_prompt=system_prompt,
            response_format=response_format,
        )
        text = self._extract_text(raw)
        try:
            return json.loads(text), provider
        except json.JSONDecodeError as exc:
            raise AllProvidersFailedError(f"Provider returned non-JSON: {text[:200]}") from exc

    # ── Streaming ─────────────────────────────────────────────────────────────

    async def stream(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float | None = None,
    ) -> AsyncGenerator[tuple[str, ProviderName], None]:
        """
        Async generator that yields (token, provider_name) tuples.
        Tries OpenAI first; if it fails before starting, switches to Gemini.
        """
        # Try OpenAI streaming
        if self._openai.is_healthy():
            try:
                async for token in self._openai.generate_stream(
                    messages=messages,
                    system_prompt=system_prompt,
                    temperature=temperature,
                ):
                    yield token, "openai"
                return
            except OpenAIProviderError as exc:
                logger.warning("AIRouter: OpenAI stream failed (%s), switching to Gemini", exc.kind)
                self._openai.record_failure()
                self._record_failover()

        # Fallback: Gemini streaming
        if self._gemini.is_healthy():
            try:
                async for token in self._gemini.generate_stream(
                    messages=messages,
                    system_prompt=system_prompt,
                    temperature=temperature,
                ):
                    yield token, "gemini"
                return
            except GeminiProviderError as exc:
                logger.warning("AIRouter: Gemini stream also failed: %s", exc)
                self._gemini.record_failure()

        raise AllProvidersFailedError("Both providers failed to stream")

    # ── Tool calling ──────────────────────────────────────────────────────────

    def route_tools(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        tools: list[dict[str, Any]],
    ) -> tuple[dict[str, Any], ProviderName]:
        """Tool-calling turn 1 — let the best provider pick a tool.

        ``tools`` may be Gemini-style declarations (name/description/parameters with
        uppercase OBJECT types). OpenAI receives a converted function-calling payload.
        """
        if self._openai.is_healthy():
            try:
                openai_tools = declarations_to_openai_tools(tools)
                result = self._openai.chat_with_tools(messages, system_prompt, openai_tools)
                return result, "openai"
            except OpenAIProviderError as exc:
                logger.warning("AIRouter tool-call: OpenAI failed (%s), trying Gemini", exc.kind)
                self._openai.record_failure()

        if self._gemini.is_healthy():
            try:
                result = self._gemini.chat_with_tools(messages, system_prompt, tools)
                return result, "gemini"
            except GeminiProviderError as exc:
                logger.warning("AIRouter tool-call: Gemini failed: %s", exc)
                self._gemini.record_failure()

        raise AllProvidersFailedError("Both providers failed for tool calling")

    def route_tool_results(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        tool_results_prompt: str,
        preferred_provider: ProviderName = "openai",
    ) -> tuple[str, ProviderName]:
        """Tool-calling turn 2 — summarise results."""
        providers = [
            (self._openai, "openai"),
            (self._gemini, "gemini"),
        ]
        if preferred_provider == "gemini":
            providers.reverse()

        for provider, name in providers:
            if not provider.is_healthy():
                continue
            try:
                result = provider.chat_with_tool_results(messages, system_prompt, tool_results_prompt)
                text = self._extract_text(result)
                return text, name
            except (OpenAIProviderError, GeminiProviderError) as exc:
                logger.warning("AIRouter tool-results: %s failed: %s", name, exc)
                provider.record_failure()

        raise AllProvidersFailedError("Both providers failed for tool result summarisation")

    # ── Health monitoring ─────────────────────────────────────────────────────

    def provider_status(self) -> dict[str, Any]:
        """Return health status of both providers — used by /api/assistant/provider-status."""
        openai_status = self._openai.health_status()
        gemini_status = self._gemini.health_status()
        active = (
            "openai" if self._openai.is_healthy()
            else "gemini" if self._gemini.is_healthy()
            else "none"
        )
        return {
            "active_provider": active,
            "openai": openai_status,
            "gemini": gemini_status,
            "failover_count": self._failover_count,
            "last_failover": self._last_failover_ts or None,
            "llm_available": active != "none",
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _record_failover(self) -> None:
        self._failover_count += 1
        self._last_failover_ts = time.time()

    @staticmethod
    def _extract_text(raw: dict[str, Any]) -> str:
        """Extract text content from a normalised provider response dict."""
        choices = raw.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content") or ""
        if isinstance(content, list):
            return " ".join(
                item.get("text", "") for item in content
                if isinstance(item, dict) and item.get("type") == "text"
            )
        return str(content).strip()
