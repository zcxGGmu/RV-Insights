import os

os.environ["RV_INSIGHTS_TESTING"] = "1"

from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app as fastapi_app
from app.api import skills as skills_module
from app.api.skills import list_skills as _list_skills_handler
from app.api.deps import get_current_user, get_db
from app.models.user import UserInDB
from app.services.skill_loader import SkillLoader

SKILL_YAML = "---\nname: test_skill\ndescription: \"A test\"\nbuiltin: false\n---\n"
BUILTIN_YAML = "---\nname: builtin_skill\ndescription: \"Built-in\"\nbuiltin: true\n---\n"


def _make_skill_dir(base: Path, name: str, yaml: str = SKILL_YAML) -> Path:
    d = base / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(yaml, encoding="utf-8")
    return d


# ---------------------------------------------------------------------------
# Fake DB helpers for API tests
# ---------------------------------------------------------------------------

class FakeCursor:
    def __init__(self, docs: Optional[List[Dict[str, Any]]] = None) -> None:
        self._docs = docs or []

    async def to_list(self, length: int = 100) -> List[Dict[str, Any]]:
        return self._docs


class FakeCollection:
    def __init__(self) -> None:
        self._store: List[Dict[str, Any]] = []

    def find(self, query: Optional[Dict[str, Any]] = None) -> FakeCursor:
        return FakeCursor([])

    async def find_one(self, query: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        return None

    async def update_one(self, filt: Dict, update: Dict, upsert: bool = False) -> None:
        pass


class FakeDBManager:
    def __init__(self) -> None:
        self.mongo_db: Dict[str, FakeCollection] = {
            "skill_settings": FakeCollection(),
            "users": FakeCollection(),
        }

    async def connect_all(self) -> None:
        pass

    async def disconnect_all(self) -> None:
        pass

    async def health_check(self) -> Dict[str, str]:
        return {"mongodb": "connected", "postgres": "connected", "redis": "connected"}


def _fake_user() -> UserInDB:
    return UserInDB(
        username="tester",
        email="tester@test.com",
        hashed_password="hashed",
        role="admin",
        is_active=True,
    )


# ---------------------------------------------------------------------------
# SkillLoader unit tests
# ---------------------------------------------------------------------------

class TestSkillLoaderScan:
    def test_scan_empty_dir(self, tmp_path: Path) -> None:
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        assert loader.list_all() == []

    def test_scan_with_valid_skill(self, tmp_path: Path) -> None:
        _make_skill_dir(tmp_path, "test_skill")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        items = loader.list_all()
        assert len(items) == 1
        assert items[0]["name"] == "test_skill"
        assert items[0]["description"] == "A test"
        assert items[0]["builtin"] is False

    def test_scan_ignores_files(self, tmp_path: Path) -> None:
        (tmp_path / "random.txt").write_text("not a skill", encoding="utf-8")
        real_yaml = "---\nname: real_skill\ndescription: \"Real\"\nbuiltin: false\n---\n"
        _make_skill_dir(tmp_path, "real_skill", real_yaml)
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        names = [s["name"] for s in loader.list_all()]
        assert names == ["real_skill"]

    def test_scan_missing_dir(self, tmp_path: Path) -> None:
        missing = tmp_path / "nonexistent"
        loader = SkillLoader(str(missing))
        loader.scan()
        assert loader.list_all() == []


class TestSkillLoaderGetDelete:
    def test_get_existing(self, tmp_path: Path) -> None:
        _make_skill_dir(tmp_path, "test_skill")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        item = loader.get("test_skill")
        assert item is not None
        assert item["name"] == "test_skill"

    def test_get_nonexistent(self, tmp_path: Path) -> None:
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        assert loader.get("nonexistent") is None

    def test_delete_skill(self, tmp_path: Path) -> None:
        skill_dir = _make_skill_dir(tmp_path, "test_skill")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        assert loader.delete("test_skill") is True
        assert loader.get("test_skill") is None
        assert not skill_dir.exists()

    def test_delete_nonexistent(self, tmp_path: Path) -> None:
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        assert loader.delete("nonexistent") is False


class TestSkillLoaderFiles:
    def test_browse_files(self, tmp_path: Path) -> None:
        skill_dir = _make_skill_dir(tmp_path, "test_skill")
        (skill_dir / "prompt.txt").write_text("hello", encoding="utf-8")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        entries = loader.browse_files("test_skill")
        assert entries is not None
        names = sorted(e.name for e in entries)
        assert "SKILL.md" in names
        assert "prompt.txt" in names

    def test_browse_files_path_traversal(self, tmp_path: Path) -> None:
        _make_skill_dir(tmp_path, "test_skill")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        result = loader.browse_files("test_skill", sub_path="../../etc")
        assert result is None

    def test_read_file(self, tmp_path: Path) -> None:
        skill_dir = _make_skill_dir(tmp_path, "test_skill")
        (skill_dir / "prompt.txt").write_text("content here", encoding="utf-8")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        content = loader.read_file("test_skill", "prompt.txt")
        assert content == "content here"

    def test_read_file_path_traversal(self, tmp_path: Path) -> None:
        _make_skill_dir(tmp_path, "test_skill")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        result = loader.read_file("test_skill", "../../etc/passwd")
        assert result is None


class TestSkillLoaderSave:
    def test_save_skill(self, tmp_path: Path) -> None:
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        result = loader.save_skill("new_skill", "My desc", "prompt body")
        assert result is True
        item = loader.get("new_skill")
        assert item is not None
        assert item["description"] == "My desc"
        assert (tmp_path / "new_skill" / "SKILL.md").exists()
        assert (tmp_path / "new_skill" / "prompt.txt").read_text(encoding="utf-8") == "prompt body"

    def test_save_skill_duplicate(self, tmp_path: Path) -> None:
        _make_skill_dir(tmp_path, "dup_skill",
                        "---\nname: dup_skill\ndescription: \"dup\"\nbuiltin: false\n---\n")
        loader = SkillLoader(str(tmp_path))
        loader.scan()
        result = loader.save_skill("dup_skill", "desc", "body")
        assert result is False


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

def _setup_api(tmp_path: Path, builtin: bool = False) -> SkillLoader:
    """Create a SkillLoader with test data and wire it into the API module."""
    if builtin:
        _make_skill_dir(tmp_path, "builtin_skill", BUILTIN_YAML)
    else:
        skill_dir = _make_skill_dir(tmp_path, "test_skill")
        (skill_dir / "prompt.txt").write_text("prompt content", encoding="utf-8")
    loader = SkillLoader(str(tmp_path))
    loader.scan()
    return loader


@pytest.fixture()
def _api_env(tmp_path: Path):
    """Fixture that configures FastAPI overrides and patches the loader."""
    fake_db = FakeDBManager()
    fastapi_app.state.db_manager = fake_db
    loader = _setup_api(tmp_path)
    original_loader = skills_module._loader

    skills_module._loader = loader
    fastapi_app.dependency_overrides[get_current_user] = _fake_user
    fastapi_app.dependency_overrides[get_db] = lambda: fake_db
    yield loader
    skills_module._loader = original_loader
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def _api_env_builtin(tmp_path: Path):
    """Fixture that configures a builtin skill for delete-rejection tests."""
    fake_db = FakeDBManager()
    fastapi_app.state.db_manager = fake_db
    loader = _setup_api(tmp_path, builtin=True)
    original_loader = skills_module._loader

    skills_module._loader = loader
    fastapi_app.dependency_overrides[get_current_user] = _fake_user
    fastapi_app.dependency_overrides[get_db] = lambda: fake_db
    yield loader
    skills_module._loader = original_loader
    fastapi_app.dependency_overrides.clear()


class TestSkillsAPI:
    @pytest.mark.asyncio
    async def test_api_list_skills(self, _api_env) -> None:
        # GET /api/v1/sessions/skills is shadowed by the chat router's
        # GET /api/v1/sessions/{session_id}, so we call the handler directly.
        fake_db = FakeDBManager()
        result = await _list_skills_handler(user=_fake_user(), db=fake_db)
        assert result["code"] == 0
        items = result["data"]
        assert len(items) == 1
        assert items[0]["name"] == "test_skill"

    @pytest.mark.asyncio
    async def test_api_block_skill(self, _api_env) -> None:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            resp = await ac.put(
                "/api/v1/sessions/skills/test_skill/block",
                json={"blocked": True},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["blocked"] is True

    @pytest.mark.asyncio
    async def test_api_delete_builtin_skill(self, _api_env_builtin) -> None:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            resp = await ac.delete("/api/v1/sessions/skills/builtin_skill")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 5004

    @pytest.mark.asyncio
    async def test_api_delete_nonexistent(self, _api_env) -> None:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            resp = await ac.delete("/api/v1/sessions/skills/no_such_skill")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 5001

    @pytest.mark.asyncio
    async def test_api_browse_files(self, _api_env) -> None:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            resp = await ac.get("/api/v1/sessions/skills/test_skill/files")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        names = [e["name"] for e in body["data"]]
        assert "SKILL.md" in names
        assert "prompt.txt" in names

    @pytest.mark.asyncio
    async def test_api_read_file(self, _api_env) -> None:
        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            resp = await ac.post(
                "/api/v1/sessions/skills/test_skill/read",
                json={"file": "prompt.txt"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["content"] == "prompt content"
