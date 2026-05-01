import os

os.environ["RV_INSIGHTS_TESTING"] = "1"

from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.services.tool_loader import ToolLoader


# ---------------------------------------------------------------------------
# ToolLoader unit tests
# ---------------------------------------------------------------------------


class TestToolLoaderScan:
    def test_scan_empty_dir(self, tmp_path: Path) -> None:
        loader = ToolLoader(str(tmp_path))
        loader.scan()
        assert loader.list_all() == []

    def test_scan_with_py_file(self, tmp_path: Path) -> None:
        tool_file = tmp_path / "my_tool.py"
        tool_file.write_text("# My tool description\ndef run(): pass\n")
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        items = loader.list_all()
        assert len(items) == 1
        assert items[0]["name"] == "my_tool"
        assert items[0]["description"] == "My tool description"
        assert items[0]["file"] == "my_tool.py"

    def test_scan_with_yaml_file(self, tmp_path: Path) -> None:
        tool_file = tmp_path / "config_tool.yaml"
        tool_file.write_text("# YAML tool config\nsteps:\n  - run\n")
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        items = loader.list_all()
        assert len(items) == 1
        assert items[0]["name"] == "config_tool"

    def test_scan_ignores_hidden(self, tmp_path: Path) -> None:
        hidden = tmp_path / ".hidden.py"
        hidden.write_text("# hidden tool\n")
        visible = tmp_path / "visible.py"
        visible.write_text("# visible tool\n")

        loader = ToolLoader(str(tmp_path))
        loader.scan()

        names = [t["name"] for t in loader.list_all()]
        assert "visible" in names
        assert ".hidden" not in names

    def test_scan_ignores_unsupported_ext(self, tmp_path: Path) -> None:
        txt_file = tmp_path / "notes.txt"
        txt_file.write_text("# not a tool\n")
        py_file = tmp_path / "real.py"
        py_file.write_text("# real tool\n")

        loader = ToolLoader(str(tmp_path))
        loader.scan()

        names = [t["name"] for t in loader.list_all()]
        assert "real" in names
        assert "notes" not in names

    def test_scan_missing_dir(self, tmp_path: Path) -> None:
        missing = tmp_path / "does_not_exist"
        loader = ToolLoader(str(missing))
        loader.scan()
        assert loader.list_all() == []


class TestToolLoaderGetDelete:
    def test_get_existing(self, tmp_path: Path) -> None:
        (tmp_path / "fetcher.py").write_text("# Fetches data\ndef fetch(): ...\n")
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        result = loader.get("fetcher")
        assert result is not None
        assert result["name"] == "fetcher"
        assert result["description"] == "Fetches data"

    def test_get_nonexistent(self, tmp_path: Path) -> None:
        loader = ToolLoader(str(tmp_path))
        loader.scan()
        assert loader.get("no_such_tool") is None

    def test_delete_tool(self, tmp_path: Path) -> None:
        tool_file = tmp_path / "to_delete.py"
        tool_file.write_text("# disposable\n")
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        assert loader.get("to_delete") is not None
        result = loader.delete("to_delete")
        assert result is True
        assert loader.get("to_delete") is None
        assert not tool_file.exists()

    def test_delete_nonexistent(self, tmp_path: Path) -> None:
        loader = ToolLoader(str(tmp_path))
        loader.scan()
        assert loader.delete("ghost") is False


class TestToolLoaderReadSave:
    def test_read_file(self, tmp_path: Path) -> None:
        content = "# reader\ndef read(): pass\n"
        (tmp_path / "reader.py").write_text(content)
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        assert loader.read_file("reader") == content

    def test_read_file_nonexistent(self, tmp_path: Path) -> None:
        loader = ToolLoader(str(tmp_path))
        loader.scan()
        assert loader.read_file("missing") is None

    def test_save_tool(self, tmp_path: Path) -> None:
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        ok = loader.save_tool("new_tool", "# brand new\ndef go(): ...\n")
        assert ok is True
        assert (tmp_path / "new_tool.py").exists()
        assert loader.get("new_tool") is not None
        assert loader.get("new_tool")["description"] == "brand new"

    def test_save_tool_duplicate(self, tmp_path: Path) -> None:
        (tmp_path / "dup.py").write_text("# original\n")
        loader = ToolLoader(str(tmp_path))
        loader.scan()

        ok = loader.save_tool("dup", "# clone\n")
        assert ok is False
        # Original file unchanged
        assert (tmp_path / "dup.py").read_text() == "# original\n"

    def test_save_tool_with_replaces(self, tmp_path: Path) -> None:
        (tmp_path / "old_tool.py").write_text("# old version\n")
        loader = ToolLoader(str(tmp_path))
        loader.scan()
        assert loader.get("old_tool") is not None

        ok = loader.save_tool("new_tool", "# replacement\n", replaces="old_tool")
        assert ok is True
        assert loader.get("old_tool") is None
        assert not (tmp_path / "old_tool.py").exists()
        assert loader.get("new_tool") is not None
        assert loader.get("new_tool")["description"] == "replacement"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------
#
# NOTE: The tools router is mounted at /api/v1/sessions/tools, but the chat
# router's GET /{session_id} (mounted at /api/v1/sessions) shadows the
# GET /api/v1/sessions/tools route.  DELETE /{tool_name} is fine because
# /api/v1/sessions/tools/{tool_name} does not collide with chat routes.
#
# To test list_tools in isolation we build a minimal FastAPI app that only
# includes the tools router, avoiding the routing conflict.
# ---------------------------------------------------------------------------

from fastapi import FastAPI

from app.api.tools import router as tools_router


def _make_dummy_db() -> MagicMock:
    """Create a mock db_manager with a mongo_db that satisfies deps."""
    db = MagicMock()
    db.mongo_db = MagicMock()
    return db


def _make_dummy_user():
    from app.models.user import UserInDB
    return UserInDB(
        username="tester",
        email="test@example.com",
        hashed_password="fake",
        role="admin",
        is_active=True,
    )


def _build_tools_app() -> FastAPI:
    """Standalone app with only the tools router — no chat route conflict."""
    test_app = FastAPI()
    test_app.include_router(tools_router, prefix="/api/v1/sessions/tools")
    return test_app


@pytest.mark.asyncio
async def test_api_list_tools() -> None:
    from app.api.deps import get_current_user, get_db

    test_app = _build_tools_app()

    dummy_db = _make_dummy_db()
    cursor_mock = MagicMock()
    cursor_mock.to_list = AsyncMock(return_value=[])
    col_mock = MagicMock()
    col_mock.find.return_value = cursor_mock
    dummy_db.mongo_db.__getitem__ = MagicMock(return_value=col_mock)

    fake_loader = MagicMock()
    fake_loader.list_all.return_value = [
        {"name": "alpha", "description": "Alpha tool", "file": "alpha.py"},
        {"name": "beta", "description": "Beta tool", "file": "beta.py"},
    ]

    async def _override_user():
        return _make_dummy_user()

    test_app.dependency_overrides[get_current_user] = _override_user
    test_app.dependency_overrides[get_db] = lambda: dummy_db

    try:
        with patch("app.api.tools._get_loader", return_value=fake_loader):
            transport = ASGITransport(app=test_app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
                resp = await ac.get("/api/v1/sessions/tools")
                assert resp.status_code == 200
                body = resp.json()
                assert body["code"] == 0
                assert len(body["data"]) == 2
                names = {t["name"] for t in body["data"]}
                assert names == {"alpha", "beta"}
    finally:
        test_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_delete_nonexistent() -> None:
    from app.api.deps import get_current_user, get_db

    test_app = _build_tools_app()

    fake_loader = MagicMock()
    fake_loader.get.return_value = None

    async def _override_user():
        return _make_dummy_user()

    test_app.dependency_overrides[get_current_user] = _override_user
    test_app.dependency_overrides[get_db] = lambda: _make_dummy_db()

    try:
        with patch("app.api.tools._get_loader", return_value=fake_loader):
            transport = ASGITransport(app=test_app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
                resp = await ac.delete("/api/v1/sessions/tools/nonexistent")
                assert resp.status_code == 200
                body = resp.json()
                assert body["code"] == 5101
                assert "not found" in body["msg"].lower()
    finally:
        test_app.dependency_overrides.clear()
