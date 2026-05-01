from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.models.skill_schemas import (
    ExternalSkillItem,
    SkillBlockRequest,
    SkillReadRequest,
    SkillSaveRequest,
)
from app.models.user import UserInDB
from app.services.skill_loader import SkillLoader
from app.utils.response import err, ok

router = APIRouter()

_loader: Optional[SkillLoader] = None


def _get_loader() -> SkillLoader:
    global _loader
    if _loader is None:
        _loader = SkillLoader(settings.SKILLS_DIR)
        _loader.scan()
    return _loader


@router.get("")
async def list_skills(
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    loader = _get_loader()
    raw = loader.list_all()
    blocked_set = await _get_blocked_set(db, user.email)
    items = [
        ExternalSkillItem(
            name=s["name"],
            description=s["description"],
            files=s["files"],
            blocked=s["name"] in blocked_set,
            builtin=s.get("builtin", False),
        ).model_dump()
        for s in raw
    ]
    return ok(items)


@router.put("/{skill_name}/block")
async def block_skill(
    skill_name: str,
    body: SkillBlockRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    loader = _get_loader()
    if loader.get(skill_name) is None:
        return err(5001, "Skill not found")
    col = db.mongo_db["skill_settings"]
    await col.update_one(
        {"user_id": user.email, "skill_name": skill_name},
        {"$set": {"blocked": body.blocked}},
        upsert=True,
    )
    return ok({"skill_name": skill_name, "blocked": body.blocked})


@router.delete("/{skill_name}")
async def delete_skill(
    skill_name: str,
    user: UserInDB = Depends(get_current_user),
):
    loader = _get_loader()
    item = loader.get(skill_name)
    if item is None:
        return err(5001, "Skill not found")
    if item.get("builtin", False):
        return err(5004, "Cannot delete built-in skill")
    loader.delete(skill_name)
    return ok({"skill_name": skill_name, "deleted": True})


@router.get("/{skill_name}/files")
async def browse_skill_files(
    skill_name: str,
    path: str = Query("", description="Sub-path within skill directory"),
    user: UserInDB = Depends(get_current_user),
):
    loader = _get_loader()
    entries = loader.browse_files(skill_name, path)
    if entries is None:
        return err(5001, "Skill not found or invalid path")
    return ok([e.model_dump() for e in entries])


@router.post("/{skill_name}/read")
async def read_skill_file(
    skill_name: str,
    body: SkillReadRequest,
    user: UserInDB = Depends(get_current_user),
):
    loader = _get_loader()
    content = loader.read_file(skill_name, body.file)
    if content is None:
        return err(5001, "Skill or file not found")
    return ok({"file": body.file, "content": content})


session_router = APIRouter()


@session_router.post("/{session_id}/skills/save")
async def save_skill_from_session(
    session_id: str,
    body: SkillSaveRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    sessions = db.mongo_db["chat_sessions"]
    session = await sessions.find_one({"session_id": session_id, "user_id": user.email})
    if session is None:
        return err(5003, "Session not found")
    loader = _get_loader()
    if loader.get(body.skill_name) is not None:
        return err(5002, "Skill name already exists")
    description = f"Skill saved from session {session_id}"
    content = f"# {body.skill_name}\n\nSaved from conversation session."
    loader.save_skill(body.skill_name, description, content)
    return ok({"skill_name": body.skill_name, "saved": True})


async def _get_blocked_set(db, user_id: str) -> set:
    col = db.mongo_db["skill_settings"]
    docs = await col.find({"user_id": user_id, "blocked": True}).to_list(length=100)
    return {d["skill_name"] for d in docs}
