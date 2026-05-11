"""Convert Gemini-style tool declarations to OpenAI function tools and parse completions."""
from __future__ import annotations

import json
from typing import Any


def normalize_json_schema(value: Any) -> Any:
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if key == "type" and isinstance(item, str):
                normalized[key] = item.lower()
            else:
                normalized[key] = normalize_json_schema(item)
        return normalized
    if isinstance(value, list):
        return [normalize_json_schema(item) for item in value]
    return value


def declarations_to_openai_tools(tool_declarations: list[dict[str, Any]]) -> list[dict[str, Any]]:
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
                    "parameters": normalize_json_schema(
                        tool.get("parameters") or {"type": "object", "properties": {}}
                    ),
                },
            }
        )
    return tools


def first_choice_message(payload: dict[str, Any]) -> dict[str, Any]:
    choices = payload.get("choices") or []
    if not choices:
        return {}
    message = choices[0].get("message")
    return message if isinstance(message, dict) else {}


def message_text(message: dict[str, Any]) -> str:
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


def extract_tool_calls(tool_calls: Any) -> list[dict[str, Any]]:
    if not isinstance(tool_calls, list):
        return []
    parsed: list[dict[str, Any]] = []
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
        if isinstance(raw_args, str):
            try:
                loaded = json.loads(raw_args)
            except json.JSONDecodeError:
                loaded = {}
        else:
            loaded = raw_args
        args = loaded if isinstance(loaded, dict) else {}
        parsed.append({"name": name, "args": args, "tool_call_id": item.get("id")})
    return parsed
