import os

os.environ["RV_INSIGHTS_TESTING"] = "1"

import pytest
from httpx import AsyncClient, ASGITransport

from app.services.tooluniverse_registry import (
    TUToolSpec,
    ToolNotFoundError,
    ToolRunError,
    ToolUniverseRegistry,
    create_default_registry,
)
from app.main import app as fastapi_app


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_spec(
    name: str = "test_tool",
    description: str = "A test tool",
    category: str = "Testing",
    category_zh: str = "测试",
    run_fn=None,
) -> TUToolSpec:
    if run_fn is None:
        async def run_fn(args):
            return {"echo": args}
    return TUToolSpec(
        name=name,
        description=description,
        category=category,
        category_zh=category_zh,
        parameters={
            "type": "object",
            "properties": {"input": {"type": "string"}},
            "required": ["input"],
        },
        test_examples=[{"input": "hello"}],
        return_schema={"type": "object"},
        run_fn=run_fn,
    )


class DummyDBManager:
    async def connect_all(self):
        pass

    async def disconnect_all(self):
        pass

    async def health_check(self):
        return {"mongodb": "skip", "postgres": "skip", "redis": "skip"}


# ── Registry unit tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_and_list():
    """register() adds a tool; list_tools() returns it."""
    reg = ToolUniverseRegistry()
    spec = _make_spec(name="alpha")
    reg.register(spec)

    result = reg.list_tools()
    assert result["total"] == 1
    assert result["tools"][0]["name"] == "alpha"


@pytest.mark.asyncio
async def test_list_tools_search():
    """search= filters tools by name/description substring."""
    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="riscv_decoder", description="Decode instruction"))
    reg.register(_make_spec(name="csr_lookup", description="Look up CSR"))

    result = reg.list_tools(search="decode")
    assert result["total"] == 1
    assert result["tools"][0]["name"] == "riscv_decoder"


@pytest.mark.asyncio
async def test_list_tools_category_filter():
    """category= restricts to matching category."""
    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="t1", category="ISA"))
    reg.register(_make_spec(name="t2", category="Kernel"))

    result = reg.list_tools(category="Kernel")
    assert result["total"] == 1
    assert result["tools"][0]["name"] == "t2"


def test_get_tool_exists():
    """get_tool() returns full spec dict for a registered tool."""
    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="my_tool"))

    spec = reg.get_tool("my_tool")
    assert spec is not None
    assert spec["name"] == "my_tool"
    assert "parameters" in spec
    assert "test_examples" in spec
    assert spec["source_file"] == "builtin/my_tool"


def test_get_tool_not_found():
    """get_tool() returns None for unregistered name."""
    reg = ToolUniverseRegistry()
    assert reg.get_tool("nonexistent") is None


@pytest.mark.asyncio
async def test_run_tool_async_fn():
    """run_tool() executes an async run_fn and returns its result."""
    async def async_fn(args):
        return {"doubled": args.get("x", 0) * 2}

    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="doubler", run_fn=async_fn))

    result = await reg.run_tool("doubler", {"x": 5})
    assert result == {"doubled": 10}


@pytest.mark.asyncio
async def test_run_tool_sync_fn():
    """run_tool() wraps a sync run_fn via executor."""
    def sync_fn(args):
        return {"sum": args.get("a", 0) + args.get("b", 0)}

    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="adder", run_fn=sync_fn))

    result = await reg.run_tool("adder", {"a": 3, "b": 7})
    assert result == {"sum": 10}


@pytest.mark.asyncio
async def test_run_tool_not_found():
    """run_tool() raises ToolNotFoundError for missing tool."""
    reg = ToolUniverseRegistry()
    with pytest.raises(ToolNotFoundError):
        await reg.run_tool("ghost", {})


@pytest.mark.asyncio
async def test_run_tool_error():
    """run_tool() wraps run_fn exceptions as ToolRunError."""
    async def bad_fn(args):
        raise ValueError("boom")

    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="bad", run_fn=bad_fn))

    with pytest.raises(ToolRunError):
        await reg.run_tool("bad", {})


def test_list_categories():
    """list_categories() returns per-category counts."""
    reg = ToolUniverseRegistry()
    reg.register(_make_spec(name="t1", category="ISA"))
    reg.register(_make_spec(name="t2", category="ISA"))
    reg.register(_make_spec(name="t3", category="Kernel"))

    cats = reg.list_categories()
    cat_list = cats["categories"]
    assert len(cat_list) == 2
    by_name = {c["name"]: c["count"] for c in cat_list}
    assert by_name["ISA"] == 2
    assert by_name["Kernel"] == 1


def test_to_list_item_zh():
    """to_list_item with lang='zh' includes category_zh."""
    spec = _make_spec(category="ISA", category_zh="ISA 工具")
    item = spec.to_list_item(lang="zh")
    assert item["category_zh"] == "ISA 工具"

    item_en = spec.to_list_item(lang="en")
    assert item_en["category_zh"] is None


# ── Built-in tools tests (via create_default_registry) ──────────────────

@pytest.mark.asyncio
async def test_decode_instruction():
    """riscv_instruction_decoder: 0x00000033 → R-type."""
    reg = create_default_registry()
    result = await reg.run_tool("riscv_instruction_decoder", {"instruction": "0x00000033"})

    assert result["format"] == "R-type (OP)"
    assert result["opcode"] == "0b0110011"
    assert result["hex"] == "0x00000033"


@pytest.mark.asyncio
async def test_csr_lookup_by_name():
    """riscv_csr_lookup: 'mstatus' → addr 0x300, priv M."""
    reg = create_default_registry()
    result = await reg.run_tool("riscv_csr_lookup", {"name": "mstatus"})

    assert result["address"] == "0x300"
    assert result["privilege"] == "M"
    assert result["name"] == "mstatus"


@pytest.mark.asyncio
async def test_csr_lookup_not_found():
    """riscv_csr_lookup: unknown CSR returns error field."""
    reg = create_default_registry()
    result = await reg.run_tool("riscv_csr_lookup", {"name": "nonexistent"})

    assert "error" in result
    assert "available" in result


@pytest.mark.asyncio
async def test_kernel_config_checker():
    """kernel_config_checker: CONFIG_RISCV=y is found."""
    reg = create_default_registry()
    result = await reg.run_tool("kernel_config_checker", {
        "config_text": "CONFIG_RISCV=y\nCONFIG_64BIT=y",
        "option": "RISCV",
    })

    assert result["set"] is True
    assert result["value"] == "y"
    assert result["option"] == "CONFIG_RISCV"


@pytest.mark.asyncio
async def test_patch_format_validator_valid():
    """patch_format_validator: valid patch → valid=True."""
    reg = create_default_registry()
    patch = (
        "Subject: [PATCH] riscv: Add Zicbom support\n\n"
        "Signed-off-by: Dev <dev@example.com>\n\n"
        "diff --git a/arch/riscv/Kconfig b/arch/riscv/Kconfig\n"
    )
    result = await reg.run_tool("patch_format_validator", {"patch": patch})

    assert result["valid"] is True
    assert result["issues"] == []
    assert result["has_signed_off_by"] is True
    assert result["has_diff"] is True


@pytest.mark.asyncio
async def test_patch_format_validator_invalid():
    """patch_format_validator: missing Signed-off-by → issues list."""
    reg = create_default_registry()
    patch = "Subject: [PATCH] fix something\n\nSome body text\n"
    result = await reg.run_tool("patch_format_validator", {"patch": patch})

    assert result["valid"] is False
    issues = result["issues"]
    assert any("Signed-off-by" in i for i in issues)
    assert any("diff" in i.lower() for i in issues)


# ── API endpoint tests ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_list_tools():
    """GET /api/v1/tooluniverse/tools returns tools array with total."""
    fastapi_app.state.db_manager = DummyDBManager()
    transport = ASGITransport(app=fastapi_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/tooluniverse/tools")

    assert resp.status_code == 200
    data = resp.json()
    assert "tools" in data
    assert "total" in data
    assert data["total"] >= 4  # 4 built-in tools


@pytest.mark.asyncio
async def test_api_get_tool_404():
    """GET /api/v1/tooluniverse/tools/{name} returns 404 for unknown tool."""
    fastapi_app.state.db_manager = DummyDBManager()
    transport = ASGITransport(app=fastapi_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/tooluniverse/tools/no_such_tool")

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_api_run_tool():
    """POST /api/v1/tooluniverse/tools/{name}/run executes tool and returns result."""
    fastapi_app.state.db_manager = DummyDBManager()
    transport = ASGITransport(app=fastapi_app)

    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.post(
            "/api/v1/tooluniverse/tools/riscv_csr_lookup/run",
            json={"arguments": {"name": "mstatus"}},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["result"]["address"] == "0x300"
    assert data["result"]["privilege"] == "M"
