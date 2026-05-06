def _auth_headers(client):
    token = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _raise_runtime_error(message: str):
    raise RuntimeError(message)


def test_toggle_parking_slot(client):
    headers = _auth_headers(client)

    before = client.get("/api/parking", headers=headers)
    assert before.status_code == 200
    slot_before = next(slot for slot in before.json() if slot["id"] == 1)

    response = client.post("/api/parking/1/toggle", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert body["is_occupied"] is (not slot_before["is_occupied"])


def test_toggle_parking_slot_survives_side_effect_failures(client, monkeypatch):
    from api import parking

    headers = _auth_headers(client)

    monkeypatch.setattr(parking.event_bus, "publish", lambda *args, **kwargs: _raise_runtime_error("bus down"))
    monkeypatch.setattr(parking, "record_mall_event", lambda *args, **kwargs: _raise_runtime_error("journal down"))
    monkeypatch.setattr(parking, "schedule_ws", lambda *args, **kwargs: _raise_runtime_error("ws down"))

    before = client.get("/api/parking", headers=headers)
    assert before.status_code == 200
    slot_before = next(slot for slot in before.json() if slot["id"] == 1)

    response = client.post("/api/parking/1/toggle", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert body["is_occupied"] is (not slot_before["is_occupied"])
