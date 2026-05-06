def _auth_headers(client):
    token = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_assistant_status_uses_fallback_without_gemini_key(client):
    response = client.get("/api/assistant/status", headers=_auth_headers(client))
    assert response.status_code == 200
    body = response.json()
    assert body["gemini_enabled"] is False
    assert body["fallback_active"] is True


def test_assistant_chat_persists_memory_and_can_execute_safe_action(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/assistant/chat",
        headers=headers,
        json={
            "message": "Please optimize the task backlog and tell me what changed.",
            "allow_automation": True,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["conversation_id"]
    assert body["provider"] == "fallback-rule-engine"
    assert body["executed_actions"]

    conversation = client.get(
        f"/api/assistant/conversations/{body['conversation_id']}",
        headers=headers,
    )
    assert conversation.status_code == 200
    messages = conversation.json()["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"


def test_assistant_chat_can_answer_general_questions_in_fallback_mode(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/assistant/chat",
        headers=headers,
        json={
            "message": "Explain what an API is in simple terms.",
            "allow_automation": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "fallback-rule-engine"
    assert body["answer"]
    assert "api" in body["answer"].lower()


def test_assistant_system_analysis_returns_modules(client):
    response = client.get("/api/assistant/system-analysis", headers=_auth_headers(client))
    assert response.status_code == 200
    body = response.json()
    assert body["modules"]
    assert body["improvement_opportunities"]
