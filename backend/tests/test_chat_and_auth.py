import os
import importlib

import httpx
import pytest
from httpx import ASGITransport
from uuid import uuid4


@pytest.fixture(autouse=True)
def _setup_env(monkeypatch):
    os.environ["RV_INSIGHTS_TESTING"] = "1"
    importlib.invalidate_caches()
    return None


class _FakeInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, key, direction):
        return self

    async def to_list(self, length=None):
        return self._docs


class _FakeCollection:
    def __init__(self):
        self._docs = []

    async def find_one(self, query):
        if not query:
            return self._docs[0] if self._docs else None
        for d in self._docs:
            if all(d.get(k) == v for k, v in query.items()):
                return d
        return None

    async def insert_one(self, doc):
        doc = dict(doc)
        if "_id" not in doc:
            doc["_id"] = str(uuid4())
        self._docs.append(doc)

        class _R:
            inserted_id = doc["_id"]
        return _R()

    def find(self, query=None):
        if not query:
            return _FakeCursor(list(self._docs))
        results = []
        for d in self._docs:
            if all(d.get(k) == v for k, v in query.items()):
                results.append(d)
        return _FakeCursor(results)

    async def update_one(self, query, update):
        for d in self._docs:
            if all(d.get(k) == v for k, v in query.items()):
                if "$set" in update:
                    d.update(update["$set"])

                class _R:
                    modified_count = 1
                return _R()

        class _R:
            modified_count = 0
        return _R()

    async def delete_one(self, query):
        for i, d in enumerate(self._docs):
            if all(d.get(k) == v for k, v in query.items()):
                del self._docs[i]

                class _R:
                    deleted_count = 1
                return _R()

        class _R:
            deleted_count = 0
        return _R()

    async def create_index(self, keys, **kwargs):
        pass


class _FakeDB:
    def __init__(self):
        self.mongo_db = {
            "users": _FakeCollection(),
            "cases": _FakeCollection(),
            "chat_sessions": _FakeCollection(),
        }


def _get_app_with_fake_db():
    from app.main import app
    app.state.db_manager = _FakeDB()
    return app


async def _register_and_get_token(client):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "tester",
            "email": "tester@example.com",
            "password": "password123",
        },
    )
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_session():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "session_id" in body["data"]


@pytest.mark.asyncio
async def test_list_sessions():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        resp = await client.get(
            "/api/v1/sessions", headers=_auth(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert len(body["data"]["sessions"]) == 2


@pytest.mark.asyncio
async def test_get_session():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        create_resp = await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        sid = create_resp.json()["data"]["session_id"]
        resp = await client.get(
            f"/api/v1/sessions/{sid}", headers=_auth(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["session_id"] == sid


@pytest.mark.asyncio
async def test_delete_session():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        create_resp = await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        sid = create_resp.json()["data"]["session_id"]
        resp = await client.delete(
            f"/api/v1/sessions/{sid}", headers=_auth(token)
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

        get_resp = await client.get(
            f"/api/v1/sessions/{sid}", headers=_auth(token)
        )
        assert get_resp.json()["code"] == 2001


@pytest.mark.asyncio
async def test_update_pin():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        create_resp = await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        sid = create_resp.json()["data"]["session_id"]
        resp = await client.patch(
            f"/api/v1/sessions/{sid}/pin",
            json={"pinned": True},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["pinned"] is True


@pytest.mark.asyncio
async def test_update_title():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        create_resp = await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        sid = create_resp.json()["data"]["session_id"]
        resp = await client.patch(
            f"/api/v1/sessions/{sid}/title",
            json={"title": "My Chat"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "My Chat"


@pytest.mark.asyncio
async def test_clear_unread():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        create_resp = await client.put(
            "/api/v1/sessions",
            json={"mode": "chat"},
            headers=_auth(token),
        )
        sid = create_resp.json()["data"]["session_id"]
        resp = await client.post(
            f"/api/v1/sessions/{sid}/clear_unread_message_count",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == 0


@pytest.mark.asyncio
async def test_session_not_found():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.get(
            "/api/v1/sessions/nonexistent", headers=_auth(token)
        )
        assert resp.json()["code"] == 2001


@pytest.mark.asyncio
async def test_auth_me():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.get(
            "/api/v1/auth/me", headers=_auth(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["email"] == "tester@example.com"


@pytest.mark.asyncio
async def test_auth_status():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.get(
            "/api/v1/auth/status", headers=_auth(token)
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["authenticated"] is True


@pytest.mark.asyncio
async def test_change_fullname():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/v1/auth/change-fullname",
            json={"fullname": "New Name"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["fullname"] == "New Name"


@pytest.mark.asyncio
async def test_change_password():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/v1/auth/change-password",
            json={
                "old_password": "password123",
                "new_password": "newpassword456",
            },
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

        login_resp = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "tester@example.com",
                "password": "newpassword456",
            },
        )
        assert login_resp.status_code == 200
        assert "access_token" in login_resp.json()


@pytest.mark.asyncio
async def test_change_password_wrong_old():
    app = _get_app_with_fake_db()
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = await _register_and_get_token(client)
        resp = await client.post(
            "/api/v1/auth/change-password",
            json={
                "old_password": "wrongpassword",
                "new_password": "newpassword456",
            },
            headers=_auth(token),
        )
        assert resp.json()["code"] == 1008
