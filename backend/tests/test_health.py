import os
import pytest
os.environ["RV_INSIGHTS_TESTING"] = "1"

from httpx import AsyncClient, ASGITransport
from app.main import app as fastapi_app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test /health returns 200 with correct structure."""

    class DummyDBManager:
        async def connect_all(self):
            pass

        async def disconnect_all(self):
            pass

        async def health_check(self):
            return {"mongodb": "connected", "postgres": "connected", "redis": "connected"}

    # Inject dummy manager before lifespan runs
    fastapi_app.state.db_manager = DummyDBManager()

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"
        services = data["services"]
        assert services["mongodb"] == "connected"
        assert services["postgres"] == "connected"
        assert services["redis"] == "connected"


@pytest.mark.asyncio
async def test_api_v1_root():
    """Test /api/v1/ returns API info."""

    class DummyDBManager:
        async def connect_all(self):
            pass

        async def disconnect_all(self):
            pass

        async def health_check(self):
            return {"mongodb": "disconnected", "postgres": "disconnected", "redis": "disconnected"}

    fastapi_app.state.db_manager = DummyDBManager()

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/")
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
