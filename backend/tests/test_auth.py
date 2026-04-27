import os
import asyncio
import bcrypt as _bcrypt
import pytest
from datetime import datetime
from uuid import uuid4

import httpx
from httpx import ASGITransport
from fastapi.encoders import jsonable_encoder

import importlib

@pytest.fixture(autouse=True)
def _setup_env(monkeypatch):
    os.environ["RV_INSIGHTS_TESTING"] = "1"
    # Re-import app with testing env
    importlib.invalidate_caches()
    return None


class _FakeInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _FakeCollection:
    def __init__(self):
        self._docs = []

    async def find_one(self, query):
        if not query:
            return self._docs[0] if self._docs else None
        for d in self._docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                return d
        return None

    async def insert_one(self, doc):
        doc = dict(doc)
        if "_id" not in doc:
            doc["_id"] = str(uuid4())
        _id = doc["_id"]
        self._docs.append(doc)
        class _R:
            inserted_id = _id
        return _R()

    async def find(self, query):
        return list(self._docs)

    async def delete_one(self, query):
        _id = query.get("_id")
        for i, d in enumerate(self._docs):
            if d.get("_id") == _id:
                del self._docs[i]
                class _R:
                    deleted_count = 1
                return _R()
        class _R:
            deleted_count = 0
        return _R()


class _FakeDB:
    def __init__(self):
        self.mongo_db = {
            "users": _FakeCollection(),
            "cases": _FakeCollection(),
        }


def _get_app_with_fake_db():
    from app.main import app
    # Replace db_manager with fake
    app.state.db_manager = _FakeDB()
    return app


@pytest.mark.asyncio
async def test_register_and_login():
    app = _get_app_with_fake_db()
    client = httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        resp = await client.post("/api/v1/auth/register", json={"username": "alice", "email": "alice@example.com", "password": "password123"})
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data

        # Login
        resp2 = await client.post("/api/v1/auth/login", json={"email": "alice@example.com", "password": "password123"})
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert "access_token" in data2
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_login_wrong_password():
    app = _get_app_with_fake_db()
    client = httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        await client.post("/api/v1/auth/register", json={"username": "bob", "email": "bob@example.com", "password": "password123"})
        resp = await client.post("/api/v1/auth/login", json={"email": "bob@example.com", "password": "wrong"})
        assert resp.status_code == 401
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_refresh_token():
    app = _get_app_with_fake_db()
    client = httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        await client.post("/api/v1/auth/register", json={"username": "carol", "email": "carol@example.com", "password": "password123"})
        login = await client.post("/api/v1/auth/login", json={"email": "carol@example.com", "password": "password123"})
        data = login.json()
        token = data["access_token"]
        # Use refresh
        # Our implementation requires refresh token; obtain it from login response
        refresh = data["refresh_token"]
        resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert resp.status_code == 200
        assert "access_token" in resp.json()
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_protected_endpoint_without_token():
    app = _get_app_with_fake_db()
    client = httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    try:
        resp = await client.get("/api/v1/cases/")
        assert resp.status_code == 401
    finally:
        await client.aclose()
