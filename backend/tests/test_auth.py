def test_login_admin(client):
    r = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body.get("role") == "Admin"


def test_protected_without_token(client):
    r = client.get("/api/shops/")
    assert r.status_code == 401


def test_shops_with_token(client):
    tok = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"},
    ).json()["access_token"]
    r = client.get("/api/shops/", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
