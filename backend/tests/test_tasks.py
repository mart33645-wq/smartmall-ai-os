def _auth_headers(client):
    token = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_optimize_task_priorities(client):
    headers = _auth_headers(client)
    response = client.post("/api/tasks/optimize-priority", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert "optimized" in body
    assert isinstance(body.get("tasks"), list)


def test_export_report_pdf(client):
    headers = _auth_headers(client)
    response = client.get("/api/reports/export/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
