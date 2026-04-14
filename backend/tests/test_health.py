def test_root_ok(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Online" in r.json().get("status", "")


def test_public_health(client):
    r = client.get("/api/public/health")
    assert r.status_code == 200
    assert r.json().get("mall_online") is True
