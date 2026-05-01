from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models.skill_schemas import (
    ExternalToolItem,
    ToolBlockRequest,
    ToolSaveRequest,
)
from app.models.user import UserInDB
from app.services.tool_loader import ToolLoader
from app.utils.response import err, ok

router = APIRouter()
session_router = APIRouter()

_loader: Optional[ToolLoader] = None


def _get_loader() -> ToolLoader:
    global _loader
    if _loader is None:
        _loader = ToolLoader(settings.EXTERNAL_TOOLS_DIR)
        _loader.scan()
    return _loader


@router.get("")
async def list_tools(
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    loader = _get_loader()
    raw = loader.list_all()
    blocked_set = await _get_blocked_set(db, user.email)
    items = [
        ExternalToolItem(
            name=t["name"],
            description=t["description"],
            file=t["file"],
            blocked=t["name"] in blocked_set,
        ).model_dump()
        for t in raw
    ]
    return ok(items)


@router.put("/{tool_name}/block")
async def block_tool(
    tool_name: str,
    body: ToolBlockRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    loader = _get_loader()
    if loader.get(tool_name) is None:
        return err(5101, "Tool not found")
    col = db.mongo_db["tool_settings"]
    await col.update_one(
        {"user_id": user.email, "tool_name": tool_name},
        {"$set": {"blocked": body.blocked}},
        upsert=True,
    )
    return ok({"tool_name": tool_name, "blocked": body.blocked})


@router.delete("/{tool_name}")
async def delete_tool(
    tool_name: str,
    user: UserInDB = Depends(get_current_user),
):
    loader = _get_loader()
    if loader.get(tool_name) is None:
        return err(5101, "Tool not found")
    loader.delete(tool_name)
    return ok({"tool_name": tool_name, "deleted": True})


@router.post("/{tool_name}/read")
async def read_tool_file(
    tool_name: str,
    user: UserInDB = Depends(get_current_user),
):
    loader = _get_loader()
    content = loader.read_file(tool_name)
    if content is None:
        return err(5101, "Tool not found")
    item = loader.get(tool_name)
    return ok({"file": item["file"], "content": content})


@session_router.post("/{session_id}/tools/save")
async def save_tool_from_session(
    session_id: str,
    body: ToolSaveRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    sessions = db.mongo_db["chat_sessions"]
    session = await sessions.find_one({"session_id": session_id, "user_id": user.email})
    if session is None:
        return err(5103, "Session not found")
    loader = _get_loader()
    content = f'# {body.tool_name}\n"""Tool saved from session {session_id}."""\n'
    success = loader.save_tool(body.tool_name, content, replaces=body.replaces)
    if not success:
        return err(5102, "Tool name already exists")
    result = {"tool_name": body.tool_name, "saved": True}
    if body.replaces:
        result["replaced"] = body.replaces
    return ok(result)


async def _get_blocked_set(db, user_id: str) -> set:
    col = db.mongo_db["tool_settings"]
    docs = await col.find({"user_id": user_id, "blocked": True}).to_list(length=100)
    return {d["tool_name"] for d in docs}
