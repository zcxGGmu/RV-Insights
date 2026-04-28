from __future__ import annotations

from datetime import datetime

import shortuuid
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_db
from app.models.chat_schemas import (
    ChatSessionInDB,
    CreateSessionRequest,
    GetSessionData,
    ListSessionItem,
    SessionStatus,
    UpdateSessionPinRequest,
    UpdateSessionTitleRequest,
)
from app.models.user import UserInDB
from app.utils.response import err, ok

router = APIRouter()

COLLECTION = "chat_sessions"


@router.put("")
async def create_session(
    payload: CreateSessionRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    session_id = shortuuid.uuid()
    now = datetime.utcnow()
    doc = ChatSessionInDB(
        session_id=session_id,
        user_id=user.email,
        mode=payload.mode,
        model_config_id=payload.model_config_id,
        created_at=now,
        updated_at=now,
    )
    col = db.mongo_db[COLLECTION]
    await col.insert_one(doc.model_dump())
    return ok({"session_id": session_id, "mode": payload.mode})


@router.get("")
async def list_sessions(
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    cursor = col.find({"user_id": user.email}).sort("updated_at", -1)
    docs = await cursor.to_list(length=None)
    sessions = [
        ListSessionItem(
            session_id=d["session_id"],
            title=d.get("title"),
            latest_message=d.get("latest_message"),
            latest_message_at=d.get("latest_message_at"),
            status=SessionStatus(d.get("status", "pending")),
            unread_message_count=d.get("unread_message_count", 0),
            is_shared=d.get("is_shared", False),
            mode=d.get("mode", "chat"),
            pinned=d.get("pinned", False),
            source=d.get("source"),
        ).model_dump()
        for d in docs
    ]
    return ok({"sessions": sessions})


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")
    data = GetSessionData(
        session_id=doc["session_id"],
        title=doc.get("title"),
        status=SessionStatus(doc.get("status", "pending")),
        events=doc.get("events", []),
        is_shared=doc.get("is_shared", False),
        mode=doc.get("mode", "chat"),
        model_config_id=doc.get("model_config_id"),
    )
    return ok(data.model_dump())


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")
    await col.delete_one({"session_id": session_id})
    return ok({"ok": True})


@router.patch("/{session_id}/pin")
async def update_pin(
    session_id: str,
    payload: UpdateSessionPinRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")
    await col.update_one(
        {"session_id": session_id},
        {"$set": {"pinned": payload.pinned, "updated_at": datetime.utcnow()}},
    )
    return ok({"session_id": session_id, "pinned": payload.pinned})


@router.patch("/{session_id}/title")
async def update_title(
    session_id: str,
    payload: UpdateSessionTitleRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")
    await col.update_one(
        {"session_id": session_id},
        {"$set": {"title": payload.title, "updated_at": datetime.utcnow()}},
    )
    return ok({"session_id": session_id, "title": payload.title})


@router.post("/{session_id}/clear_unread_message_count")
async def clear_unread(
    session_id: str,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")
    await col.update_one(
        {"session_id": session_id},
        {"$set": {"unread_message_count": 0, "updated_at": datetime.utcnow()}},
    )
    return ok({"ok": True})
