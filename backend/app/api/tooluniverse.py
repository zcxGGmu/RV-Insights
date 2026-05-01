from __future__ import annotations

import asyncio
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.tooluniverse_registry import (
    ToolNotFoundError,
    ToolRunError,
    create_default_registry,
)

router = APIRouter()

_registry = create_default_registry()


class RunToolRequest(BaseModel):
    arguments: Dict[str, Any]


@router.get("/tools")
async def list_tools(search: str = "", category: str = "", lang: str = "en"):
    return _registry.list_tools(search=search, category=category, lang=lang)


@router.get("/tools/{tool_name}")
async def get_tool(tool_name: str, lang: str = "en"):
    spec = _registry.get_tool(tool_name, lang=lang)
    if spec is None:
        raise HTTPException(status_code=404, detail="Tool not found")
    return spec


@router.post("/tools/{tool_name}/run")
async def run_tool(tool_name: str, body: RunToolRequest):
    try:
        result = await _registry.run_tool(tool_name, body.arguments)
        return {"success": True, "result": result}
    except ToolNotFoundError:
        raise HTTPException(status_code=404, detail="Tool not found")
    except asyncio.TimeoutError:
        raise HTTPException(status_code=408, detail="Tool execution timeout")
    except ToolRunError:
        raise HTTPException(status_code=500, detail="Tool execution failed")


@router.get("/categories")
async def list_categories(lang: str = "en"):
    return _registry.list_categories(lang=lang)
