"""Gemini provider — mirrors OpenAI provider interface for seamless failover."""
from __future__ import annotations

import json
import time
import logging
from typing import Any, AsyncGenerator

import httpx

from core.config import GeminiSettings

logger = logging.getLogger(__name__)

_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
_MAX_RETRIES = 2


class GeminiProviderError(RuntimeError):
    def __init__(self, message: str, kind: str = "api_error"):
        super().__init__(message)
        self.kind = kind


class GeminiProvider:
    """
    Production Gemini provider using gemini-2.5-pro.
    Mirrors the OpenAI provider interface for transparent failover.
    - Supports generate (synchronous), generate_stream (async), tool calling
    - Circuit breaker with 60 s cooldown
    """

    def __init__(self, config: GeminiSettings) -> None:
        self._config = config
        self._consecutive_failures = 0
        self._last_failure_ts: float = 0.0
        self._circuit_open_threshold = 3
        self._circuit_cooldown = 60.0

    # ── Availability ──────────────────────────────────────────────────────────

    def is_available(self) -> bool:
        return bool(self._config.api_key)

    def is_healthy(self) -> bool:
        if not self.is_available():
            return False
        if self._consecutive_failures >= self._circuit_open_threshold:
            if time.time() - self._last_failure_ts < self._circuit_cooldown:
                return False
            self._consecutive_failures = 0
        return True

    def record_success(self) -> None:
        self._consecutive_failures = 0

    def record_failure(self) -> None:
        self._consecutive_failures += 1
        self._last_failure_ts = time.time()

    def health_status(self) -> dict[str, Any]:
        return {
            "provider": "gemini",
            "model": self._config.model,
            "available": self.is_available(),
            "healthy": self.is_healthy(),
            "consecutive_failures": self._consecutive_failures,
            "circuit_open": self._consecutive_failures >= self._circuit_open_threshold
            and (time.time() - self._last_failure_ts < self._circuit_cooldown),
        }

    # ── Synchronous generation ─────────────────────────────────────────────────

    def generate(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        response_format: dict | None = None,
        tools: list[dict] | None = None,
        tool_choice: str = "auto",
        temperature: float | None = None,
    ) -> dict[str, Any]:
        """Call Gemini generateContent and return a normalised response dict."""
        if not self.is_healthy():
            raise GeminiProviderError("Gemini circuit breaker is open", kind="circuit_open")

        contents = self._build_contents(messages)
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self._config.temperature,
            },
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        if tools:
            payload["tools"] = [{"functionDeclarations": tools}]
        if response_format:
            mime = response_format.get("type", "application/json")
            payload["generationConfig"]["responseMimeType"] = mime

        data = self._post_with_retry("generateContent", payload)
        self.record_success()
        return self._normalise_response(data)

    def test_ping(self) -> dict:
        """Quick connectivity test with minimal token usage."""
        if not self.is_healthy():
            return {"ok": False, "error": "circuit_open"}
        try:
            url = (
                f"{self._config.base_url}/models/{self._config.model}"
                ":generateContent"
            )
            resp = httpx.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self._config.api_key,
                },
                json={
                    "contents": [{"role": "user", "parts": [{"text": "hi"}]}],
                    "generationConfig": {"maxOutputTokens": 1},
                },
                timeout=httpx.Timeout(10, connect=5),
            )
            return {"ok": resp.status_code == 200, "status": resp.status_code}
        except Exception as exc:
            return {"ok": False, "error": str(exc)[:200]}

    # ── Streaming generation ───────────────────────────────────────────────────

    async def generate_stream(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float | None = None,
    ) -> AsyncGenerator[str, None]:
        """Async generator that yields text tokens as they stream from Gemini."""
        if not self.is_healthy():
            raise GeminiProviderError("Gemini circuit breaker is open", kind="circuit_open")

        contents = self._build_contents(messages)
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature if temperature is not None else self._config.temperature,
            },
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        url = (
            f"{self._config.base_url}/models/{self._config.model}"
            ":streamGenerateContent?alt=sse"
        )
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self._config.api_key,
        }
        timeout = httpx.Timeout(self._config.timeout_seconds + 30, connect=5.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        raise GeminiProviderError(
                            f"Gemini stream error {response.status_code}: {body[:200]}",
                            kind="api_error",
                        )
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk = line[6:].strip()
                        if not chunk:
                            continue
                        try:
                            data = json.loads(chunk)
                            candidates = data.get("candidates") or []
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    token = part.get("text", "")
                                    if token:
                                        yield token
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
            self.record_success()
        except httpx.TimeoutException as exc:
            self.record_failure()
            raise GeminiProviderError("Gemini stream timed out", kind="timeout") from exc
        except httpx.HTTPError as exc:
            self.record_failure()
            raise GeminiProviderError(f"Gemini stream error: {exc}", kind="api_error") from exc

    # ── Tool calling ──────────────────────────────────────────────────────────

    def chat_with_tools(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        tools: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return self.generate(messages=messages, system_prompt=system_prompt, tools=tools)

    def chat_with_tool_results(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        tool_results_prompt: str,
    ) -> dict[str, Any]:
        final_messages = messages + [{"role": "user", "content": tool_results_prompt}]
        return self.generate(messages=final_messages, system_prompt=system_prompt)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _build_contents(self, messages: list[dict[str, str]]) -> list[dict[str, Any]]:
        return [
            {
                "role": "model" if m["role"] == "assistant" else "user",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
            if m.get("role") in {"user", "assistant"} and str(m.get("content", "")).strip()
        ]

    def _normalise_response(self, data: dict[str, Any]) -> dict[str, Any]:
        """Return a dict shaped like OpenAI's response for uniform downstream handling."""
        candidates = data.get("candidates") or []
        if not candidates:
            # Check for safety block
            block_reason = data.get("promptFeedback", {}).get("blockReason", "")
            if block_reason:
                raise GeminiProviderError(
                    f"Gemini blocked the request due to safety: {block_reason}",
                    kind="safety_block",
                )
            raise GeminiProviderError("Gemini returned no candidates", kind="invalid_response")

        # Check candidate-level safety
        finish_reason = candidates[0].get("finishReason", "")
        if finish_reason == "SAFETY":
            raise GeminiProviderError(
                "Gemini response was blocked by safety filters",
                kind="safety_block",
            )

        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(str(p.get("text") or "") for p in parts if isinstance(p, dict))

        # Check for function calls
        function_calls = [
            p.get("functionCall")
            for p in parts
            if isinstance(p, dict) and p.get("functionCall")
        ]

        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": text,
                        "tool_calls": [
                            {
                                "id": f"gemini_fc_{i}",
                                "type": "function",
                                "function": {
                                    "name": fc.get("name", ""),
                                    "arguments": json.dumps(fc.get("args", {})),
                                },
                            }
                            for i, fc in enumerate(function_calls)
                        ] if function_calls else None,
                    }
                }
            ],
            "_raw_parts": parts,
        }

    def _post_with_retry(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._config.base_url}/models/{self._config.model}:{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self._config.api_key,
        }
        timeout = httpx.Timeout(self._config.timeout_seconds, connect=5.0)
        last_exc: Exception | None = None

        for attempt in range(_MAX_RETRIES + 1):
            if attempt > 0:
                backoff = 1.5 ** attempt
                logger.info("Gemini retry %d/%d after %.1fs", attempt, _MAX_RETRIES, backoff)
                time.sleep(backoff)
            try:
                response = httpx.post(url, headers=headers, json=payload, timeout=timeout)
                if response.status_code in _RETRY_STATUS_CODES and attempt < _MAX_RETRIES:
                    last_exc = GeminiProviderError(f"Gemini {response.status_code}", kind="api_error")
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.TimeoutException as exc:
                self.record_failure()
                raise GeminiProviderError("Gemini request timed out", kind="timeout") from exc
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code if exc.response else 0
                if status in (401, 403):
                    self.record_failure()
                    raise GeminiProviderError(
                        "Gemini API key is invalid or lacks permission. Check GEMINI_API_KEY in .env",
                        kind="auth_error",
                    ) from exc
                last_exc = exc
                if attempt >= _MAX_RETRIES:
                    break
            except httpx.HTTPError as exc:
                self.record_failure()
                raise GeminiProviderError(f"Gemini HTTP error: {exc}", kind="api_error") from exc

        self.record_failure()
        raise GeminiProviderError(
            f"Gemini failed after {_MAX_RETRIES + 1} attempts: {last_exc}",
            kind="api_error",
        )
