import os
import pytest
import httpx
from httpx import ASGITransport
from uuid import uuid4
import datetime
import bcrypt as _bcrypt


os.environ["RV_INSIGHTS_TESTING"] = "1"


def _get_app_with_fake_db():
    from app.main import app
    from tests.test_auth import _FakeDB
    app.state.db_manager = _FakeDB()
    return app


@pytest.mark.asyncio
async def test_create_case():
    app = _get_app_with_fake_db()
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Register and login
        await client.post(
            "/api/v1/auth/register",
            json={"username": "dave", "email": "dave@example.com", "password": "password123"},
        )
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "dave@example.com", "password": "password123"},
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create case
        resp = await client.post(
            "/api/v1/cases/",
            json={"title": "Test Case", "target_repo": "riscv/linux", "input_context": "Fix bug"},
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Case"
        assert data["status"] == "created"
        assert data["target_repo"] == "riscv/linux"


@pytest.mark.asyncio
async def test_list_get_case_and_delete_admin():
    app = _get_app_with_fake_db()
    transport = ASGITransport(app=app)

    # Seed an admin user directly into the fake DB
    admin_pw = _bcrypt.hashpw(b"adminpass", _bcrypt.gensalt()).decode("utf-8")
    admin_doc = {
        "_id": str(uuid4()),
        "username": "admin",
        "email": "admin@example.com",
        "hashed_password": admin_pw,
        "role": "admin",
        "is_active": True,
        "created_at": datetime.datetime.utcnow(),
        "updated_at": datetime.datetime.utcnow(),
    }
    await app.state.db_manager.mongo_db["users"].insert_one(admin_doc)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as admin
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "adminpass"},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create a case
        resp = await client.post(
            "/api/v1/cases/",
            json={"title": "Admin Case", "target_repo": "riscv/qemu", "input_context": "Add feature"},
            headers=headers,
        )
        assert resp.status_code == 201
        case_id = resp.json()["id"]

        # List cases
        list_resp = await client.get("/api/v1/cases/", headers=headers)
        assert list_resp.status_code == 200
        list_data = list_resp.json()
        assert list_data["total"] >= 1

        # Get case
        get_resp = await client.get(f"/api/v1/cases/{case_id}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "Admin Case"

        # Delete case (admin only)
        del_resp = await client.delete(f"/api/v1/cases/{case_id}", headers=headers)
        assert del_resp.status_code == 200
