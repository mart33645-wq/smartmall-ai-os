"""OpenAI provider — production-grade wrapper with retry, streaming, and circuit breaker."""
from __future__ import annotations

import json
import time
import logging
from typing import Any, AsyncGenerator

import httpx

from core.config import OpenAISettings

logger = logging.getLogger(__name__)

_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
_MAX_RETRIES = 2
_BACKOFF_BASE = 1.5  # seconds


class OpenAIProviderError(RuntimeError):
    def __init__(self, message: str, kind: str = "api_error"):
        super().__init__(message)
        self.kind = kind  # timeout | rate_limit | api_error | invalid_response


class OpenAIProvider:
    """
    Production OpenAI provider.
    - Automatic retry with exponential backoff on 429 / 5xx
    - Circuit breaker: after 3 consecutive failures, backs off for 60 s
    - Streaming support via async generator
    - Tool calling (turn 1 + turn 2)
    """

    def __init__(self, config: OpenAISettings) -> None:
        self._config = config
        self._consecutive_failures = 0
        self._last_failure_ts: float = 0.0
        self._circuit_open_threshold = 3
        self._circuit_cooldown = 60.0  # seconds

    # ── Availability ──────────────────────────────────────────────────────────

    def is_available(self) -> bool:
        return bool(self._config.api_key)

    def is_healthy(self) -> bool:
        """Circuit breaker check — returns False during cooldown after repeated failures."""
        if not self.is_available():
            return False
        if self._consecutive_failures >= self._circuit_open_threshold:
            if time.time() - self._last_failure_ts < self._circuit_cooldown:
                return False
            # Cooldown elapsed — reset and try again
            self._consecutive_failures = 0
        return True

    def record_success(self) -> None:
        self._consecutive_failures = 0

    def record_failure(self) -> None:
        self._consecutive_failures += 1
        self._last_failure_ts = time.time()

    def health_status(self) -> dict[str, Any]:
        return {
            "provider": "openai",
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
        """Call OpenAI chat completions and return the raw API response dict."""
        if not self.is_healthy():
            raise OpenAIProviderError("OpenAI circuit breaker is open", kind="circuit_open")

        payload = self._build_payload(
            messages=messages,
            system_prompt=system_prompt,
            response_format=response_format,
            tools=tools,
            tool_choice=tool_choice,
            temperature=temperature,
            stream=False,
        )

        data = self._post_with_retry(payload)
        self.record_success()
        return data

    # ── Streaming generation ───────────────────────────────────────────────────

    async def generate_stream(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        temperature: float | None = None,
    ) -> AsyncGenerator[str, None]:
        """Async generator that yields text tokens as they stream from OpenAI."""
        if not self.is_healthy():
            raise OpenAIProviderError("OpenAI circuit breaker is open", kind="circuit_open")

        payload = self._build_payload(
            messages=messages,
            system_prompt=system_prompt,
            stream=True,
            temperature=temperature,
        )

        timeout = httpx.Timeout(self._config.timeout_seconds + 30, connect=5.0)
        headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self._config.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        raise OpenAIProviderError(
                            f"OpenAI stream error {response.status_code}: {body[:200]}",
                            kind="api_error",
                        )
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk = line[6:].strip()
                        if chunk == "[DONE]":
                            break
                        try:
                            data = json.loads(chunk)
                            delta = data["choices"][0]["delta"]
                            token = delta.get("content", "")
                            if token:
                                yield token
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
            self.record_success()
        except httpx.TimeoutException as exc:
            self.record_failure()
            raise OpenAIProviderError("OpenAI stream timed out", kind="timeout") from exc
        except httpx.HTTPError as exc:
            self.record_failure()
            raise OpenAIProviderError(f"OpenAI stream HTTP error: {exc}", kind="api_error") from exc

    # ── Tool calling ──────────────────────────────────────────────────────────

    def chat_with_tools(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        tools: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Turn 1: let OpenAI decide which tool to call (if any)."""
        return self.generate(
            messages=messages,
            system_prompt=system_prompt,
            tools=tools,
            tool_choice="auto",
        )

    def chat_with_tool_results(
        self,
        messages: list[dict[str, str]],
        system_prompt: str,
        tool_results_prompt: str,
    ) -> dict[str, Any]:
        """Turn 2: summarize tool results into a final user-facing answer."""
        final_messages = messages + [{"role": "user", "content": tool_results_prompt}]
        return self.generate(
            messages=final_messages,
            system_prompt=system_prompt,
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _build_payload(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
        response_format: dict | None = None,
        tools: list[dict] | None = None,
        tool_choice: str = "auto",
        temperature: float | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._config.model,
            "messages": [],
            "stream": stream,
            "service_tier": "auto",
        }

        if system_prompt:
            payload["messages"].append({"role": "system", "content": system_prompt})

        payload["messages"].extend(
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m.get("role") in {"user", "assistant"} and str(m.get("content", "")).strip()
        )

        if response_format:
            payload["response_format"] = response_format

        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = tool_choice
            payload["parallel_tool_calls"] = False

        if temperature is not None:
            payload["temperature"] = temperature

        return payload

    def _post_with_retry(self, payload: dict[str, Any]) -> dict[str, Any]:
        """POST to OpenAI with exponential backoff retry on transient errors."""
        timeout = httpx.Timeout(self._config.timeout_seconds, connect=5.0)
        headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }
        last_exc: Exception | None = None

        for attempt in range(_MAX_RETRIES + 1):
            if attempt > 0:
                backoff = _BACKOFF_BASE ** attempt
                logger.info("OpenAI retry %d/%d after %.1fs backoff", attempt, _MAX_RETRIES, backoff)
                time.sleep(backoff)

            try:
                response = httpx.post(
                    f"{self._config.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=timeout,
                )

                if response.status_code in _RETRY_STATUS_CODES and attempt < _MAX_RETRIES:
                    kind = "rate_limit" if response.status_code == 429 else "api_error"
                    last_exc = OpenAIProviderError(
                        f"OpenAI {response.status_code}", kind=kind
                    )
                    continue

                response.raise_for_status()
                return response.json()

            except httpx.TimeoutException as exc:
                self.record_failure()
                raise OpenAIProviderError("OpenAI request timed out", kind="timeout") from exc
            except httpx.HTTPStatusError as exc:
                last_exc = exc
                if attempt >= _MAX_RETRIES:
                    break
            except httpx.HTTPError as exc:
                self.record_failure()
                raise OpenAIProviderError(f"OpenAI HTTP error: {exc}", kind="api_error") from exc

        self.record_failure()
        raise OpenAIProviderError(
            f"OpenAI failed after {_MAX_RETRIES + 1} attempts: {last_exc}",
            kind="api_error",
        )
