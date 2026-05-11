"""
SmartMall AI OS — AI Integration Tests
=======================================
Tests for the dual-provider (OpenAI + Gemini) architecture,
AIRouter failover, circuit breaker, tool calling, and streaming.

Run: pytest backend/tests/test_ai_integration.py -v
"""
from __future__ import annotations

import os
import sys
import json
import time
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

# Ensure backend is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ.setdefault("SMARTMALL_TESTING", "true")
os.environ.setdefault("USE_SQLITE", "true")

from core.config import OpenAISettings, GeminiSettings, AppSettings
from services.ai.providers.openai_provider import OpenAIProvider, OpenAIProviderError
from services.ai.providers.gemini_provider import GeminiProvider, GeminiProviderError


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def openai_settings():
    return OpenAISettings(
        api_key="sk-test-fake-key-for-testing",
        model="gpt-4o-mini",
        base_url="https://api.openai.com/v1",
        timeout_seconds=10.0,
    )


@pytest.fixture
def gemini_settings():
    return GeminiSettings(
        api_key="AIzaSy-test-fake-key-for-testing",
        model="gemini-2.5-pro",
        base_url="https://generativelanguage.googleapis.com/v1beta",
        timeout_seconds=10.0,
        memory_window=12,
        temperature=0.3,
    )


@pytest.fixture
def empty_openai_settings():
    return OpenAISettings(api_key="", model="gpt-4o-mini", base_url="https://api.openai.com/v1", timeout_seconds=10.0)


@pytest.fixture
def empty_gemini_settings():
    return GeminiSettings(
        api_key="", model="gemini-2.5-pro",
        base_url="https://generativelanguage.googleapis.com/v1beta",
        timeout_seconds=10.0, memory_window=12, temperature=0.3,
    )


# ── Provider Availability Tests ──────────────────────────────────────────────

class TestOpenAIProvider:
    def test_available_with_key(self, openai_settings):
        provider = OpenAIProvider(openai_settings)
        assert provider.is_available() is True
        assert provider.is_healthy() is True

    def test_unavailable_without_key(self, empty_openai_settings):
        provider = OpenAIProvider(empty_openai_settings)
        assert provider.is_available() is False
        assert provider.is_healthy() is False

    def test_circuit_breaker_opens_after_failures(self, openai_settings):
        provider = OpenAIProvider(openai_settings)
        assert provider.is_healthy() is True

        # Simulate 3 consecutive failures
        for _ in range(3):
            provider.record_failure()

        assert provider.is_healthy() is False
        status = provider.health_status()
        assert status["circuit_open"] is True

    def test_circuit_breaker_resets_after_cooldown(self, openai_settings):
        provider = OpenAIProvider(openai_settings)

        for _ in range(3):
            provider.record_failure()

        assert provider.is_healthy() is False

        # Simulate cooldown elapsed (60s)
        provider._last_failure_ts = time.time() - 61
        assert provider.is_healthy() is True
        assert provider._consecutive_failures == 0

    def test_success_resets_failure_count(self, openai_settings):
        provider = OpenAIProvider(openai_settings)
        provider.record_failure()
        provider.record_failure()
        assert provider._consecutive_failures == 2
        provider.record_success()
        assert provider._consecutive_failures == 0

    def test_health_status_fields(self, openai_settings):
        provider = OpenAIProvider(openai_settings)
        status = provider.health_status()
        assert status["provider"] == "openai"
        assert status["model"] == "gpt-4o-mini"
        assert status["available"] is True
        assert status["healthy"] is True
        assert status["consecutive_failures"] == 0
        assert status["circuit_open"] is False


class TestGeminiProvider:
    def test_available_with_key(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        assert provider.is_available() is True
        assert provider.is_healthy() is True

    def test_unavailable_without_key(self, empty_gemini_settings):
        provider = GeminiProvider(empty_gemini_settings)
        assert provider.is_available() is False
        assert provider.is_healthy() is False

    def test_circuit_breaker_opens_after_failures(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        for _ in range(3):
            provider.record_failure()
        assert provider.is_healthy() is False

    def test_normalise_response_valid(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        raw = {
            "candidates": [{
                "content": {
                    "parts": [{"text": "Hello, I am SmartMall AI."}]
                },
                "finishReason": "STOP",
            }]
        }
        result = provider._normalise_response(raw)
        assert result["choices"][0]["message"]["content"] == "Hello, I am SmartMall AI."

    def test_normalise_response_safety_block(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        raw = {
            "candidates": [{
                "finishReason": "SAFETY",
                "content": {"parts": []},
            }]
        }
        with pytest.raises(GeminiProviderError, match="safety"):
            provider._normalise_response(raw)

    def test_normalise_response_no_candidates(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        raw = {"candidates": []}
        with pytest.raises(GeminiProviderError, match="no candidates"):
            provider._normalise_response(raw)

    def test_normalise_response_prompt_safety_block(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        raw = {
            "candidates": [],
            "promptFeedback": {"blockReason": "SAFETY"},
        }
        with pytest.raises(GeminiProviderError, match="safety"):
            provider._normalise_response(raw)

    def test_normalise_response_with_function_calls(self, gemini_settings):
        provider = GeminiProvider(gemini_settings)
        raw = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "functionCall": {
                            "name": "add_shop",
                            "args": {"name": "Test Shop", "floor": 1},
                        }
                    }]
                },
                "finishReason": "STOP",
            }]
        }
        result = provider._normalise_response(raw)
        tool_calls = result["choices"][0]["message"]["tool_calls"]
        assert len(tool_calls) == 1
        assert tool_calls[0]["function"]["name"] == "add_shop"
        assert json.loads(tool_calls[0]["function"]["arguments"])["name"] == "Test Shop"


# ── AIRouter Failover Tests ──────────────────────────────────────────────────

class TestAIRouter:
    @staticmethod
    def _get_router_class():
        """Lazy import to avoid circular import at module level."""
        from services.ai.router import AIRouter
        return AIRouter

    @staticmethod
    def _get_all_providers_failed():
        from services.ai.router import AllProvidersFailedError
        return AllProvidersFailedError

    def _make_settings(self, openai_key="sk-test", gemini_key="AIzaSy-test"):
        return AppSettings(
            secret_key="test",
            algorithm="HS256",
            access_token_expire_minutes=60,
            cors_origins=[],
            database_url="",
            use_sqlite=True,
            smartmall_testing=True,
            sqlite_database_url="sqlite:///test.db",
            default_postgres_url="",
            redis_url="",
            ai_automation_default=True,
            openai=OpenAISettings(
                api_key=openai_key, model="gpt-4o-mini",
                base_url="https://api.openai.com/v1", timeout_seconds=10.0,
            ),
            gemini=GeminiSettings(
                api_key=gemini_key, model="gemini-2.5-pro",
                base_url="https://generativelanguage.googleapis.com/v1beta",
                timeout_seconds=10.0, memory_window=12, temperature=0.3,
            ),
            github=MagicMock(),
            vercel=MagicMock(),
        )

    def test_provider_status_both_available(self):
        AIRouter = self._get_router_class()
        router = AIRouter(self._make_settings())
        status = router.provider_status()
        assert status["active_provider"] == "openai"
        assert status["llm_available"] is True
        assert status["openai"]["available"] is True
        assert status["gemini"]["available"] is True

    def test_provider_status_openai_only(self):
        AIRouter = self._get_router_class()
        router = AIRouter(self._make_settings(gemini_key=""))
        status = router.provider_status()
        assert status["active_provider"] == "openai"
        assert status["gemini"]["available"] is False

    def test_provider_status_gemini_only(self):
        AIRouter = self._get_router_class()
        router = AIRouter(self._make_settings(openai_key=""))
        status = router.provider_status()
        assert status["active_provider"] == "gemini"
        assert status["openai"]["available"] is False

    def test_provider_status_none_available(self):
        AIRouter = self._get_router_class()
        router = AIRouter(self._make_settings(openai_key="", gemini_key=""))
        status = router.provider_status()
        assert status["active_provider"] == "none"
        assert status["llm_available"] is False

    def test_failover_counter_increments(self):
        AIRouter = self._get_router_class()
        router = AIRouter(self._make_settings())
        assert router._failover_count == 0
        router._record_failover()
        assert router._failover_count == 1
        router._record_failover()
        assert router._failover_count == 2

    def test_extract_text_from_openai_response(self):
        AIRouter = self._get_router_class()
        text = AIRouter._extract_text({
            "choices": [{"message": {"content": "Hello world"}}]
        })
        assert text == "Hello world"

    def test_extract_text_empty_response(self):
        AIRouter = self._get_router_class()
        text = AIRouter._extract_text({"choices": []})
        assert text == ""

    def test_extract_text_list_content(self):
        AIRouter = self._get_router_class()
        text = AIRouter._extract_text({
            "choices": [{"message": {"content": [
                {"type": "text", "text": "Part 1"},
                {"type": "text", "text": "Part 2"},
            ]}}]
        })
        assert "Part 1" in text
        assert "Part 2" in text

    def test_generate_raises_when_both_fail(self):
        AIRouter = self._get_router_class()
        AllProvidersFailedError = self._get_all_providers_failed()
        router = AIRouter(self._make_settings(openai_key="", gemini_key=""))
        with pytest.raises(AllProvidersFailedError):
            router.generate(
                messages=[{"role": "user", "content": "hello"}],
                system_prompt="test",
            )


# ── Tool Format Tests ────────────────────────────────────────────────────────

class TestToolFormat:
    def test_declarations_to_openai_tools(self):
        from services.ai.tool_format import declarations_to_openai_tools

        gemini_tools = [
            {
                "name": "add_shop",
                "description": "Add a shop",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "name": {"type": "STRING", "description": "Shop name"},
                    },
                    "required": ["name"],
                },
            }
        ]
        openai_tools = declarations_to_openai_tools(gemini_tools)
        assert len(openai_tools) == 1
        assert openai_tools[0]["type"] == "function"
        func = openai_tools[0]["function"]
        assert func["name"] == "add_shop"
        # Types should be lowercased
        assert func["parameters"]["type"] == "object"
        assert func["parameters"]["properties"]["name"]["type"] == "string"

    def test_extract_tool_calls(self):
        from services.ai.tool_format import extract_tool_calls

        raw = [
            {
                "id": "call_123",
                "type": "function",
                "function": {
                    "name": "add_shop",
                    "arguments": '{"name": "Nike Store", "floor": 2}',
                },
            }
        ]
        calls = extract_tool_calls(raw)
        assert len(calls) == 1
        assert calls[0]["name"] == "add_shop"
        assert calls[0]["args"]["name"] == "Nike Store"
        assert calls[0]["args"]["floor"] == 2

    def test_extract_tool_calls_invalid_json(self):
        from services.ai.tool_format import extract_tool_calls

        raw = [{"id": "x", "function": {"name": "test", "arguments": "{{bad}}"}}]
        calls = extract_tool_calls(raw)
        assert len(calls) == 1
        assert calls[0]["args"] == {}

    def test_extract_tool_calls_empty(self):
        from services.ai.tool_format import extract_tool_calls

        assert extract_tool_calls(None) == []
        assert extract_tool_calls([]) == []
        assert extract_tool_calls("not a list") == []


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
