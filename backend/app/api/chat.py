from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from typing import Optional

import shortuuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.api.deps import get_current_user, get_db
from app.models.chat_schemas import (
    ChatEvent,
    ChatSessionInDB,
    CreateSessionRequest,
    GetSessionData,
    ListSessionItem,
    SessionStatus,
    UpdateSessionPinRequest,
    UpdateSessionTitleRequest,
)
from app.models.user import UserInDB
from app.services.chat_runner import ChatRunner
from app.services.model_factory import (
    get_default_model_config,
    get_default_task_settings,
)
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


# --- Active runners registry (in-process, per-worker) ---

_active_runners: dict[str, ChatRunner] = {}


class ChatRequest(BaseModel):
    message: str = ""
    attachments: list[str] = Field(default_factory=list)
    event_id: Optional[str] = None

    model_config = {"extra": "forbid"}


@router.post("/{session_id}/chat")
async def chat_sse(
    session_id: str,
    payload: ChatRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    col = db.mongo_db[COLLECTION]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")
    if doc.get("status") == SessionStatus.RUNNING.value:
        return err(2003, "Session is already running")

    await col.update_one(
        {"session_id": session_id},
        {"$set": {"status": SessionStatus.RUNNING.value, "updated_at": datetime.utcnow()}},
    )

    if payload.message:
        user_event = ChatEvent(
            event_id=shortuuid.uuid(),
            timestamp=time.time(),
            type="message",
            data={"role": "user", "content": payload.message, "attachments": payload.attachments},
        )
        await col.update_one(
            {"session_id": session_id},
            {
                "$push": {"events": user_event.model_dump()},
                "$set": {
                    "latest_message": payload.message[:200],
                    "latest_message_at": user_event.timestamp,
                    "updated_at": datetime.utcnow(),
                },
            },
        )

    session = ChatSessionInDB(**{**doc, "status": SessionStatus.RUNNING})
    model_config = get_default_model_config()
    task_settings = get_default_task_settings()

    runner = ChatRunner(
        session=session,
        model_config=model_config,
        task_settings=task_settings,
    )
    _active_runners[session_id] = runner

    queue: asyncio.Queue[Optional[dict]] = asyncio.Queue(maxsize=task_settings.queue_maxsize)

    async def _background_worker():
        try:
            async for event in runner.astream(
                query=payload.message,
                attachments=payload.attachments,
            ):
                persist_event = ChatEvent(
                    event_id=event["data"].get("event_id", shortuuid.uuid()),
                    timestamp=event["data"].get("timestamp", time.time()),
                    type=event["event"],
                    data=event["data"],
                )
                if event["event"] in ("message", "message_chunk_done", "tool", "done", "error"):
                    await col.update_one(
                        {"session_id": session_id},
                        {"$push": {"events": persist_event.model_dump()}},
                    )

                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass

                if event["event"] == "done":
                    break
        except Exception as exc:
            error_event = {
                "event": "error",
                "data": {"event_id": shortuuid.uuid(), "timestamp": time.time(), "error": str(exc)},
            }
            try:
                queue.put_nowait(error_event)
            except asyncio.QueueFull:
                pass
        finally:
            _active_runners.pop(session_id, None)
            await col.update_one(
                {"session_id": session_id},
                {"$set": {
                    "status": SessionStatus.COMPLETED.value,
                    "updated_at": datetime.utcnow(),
                }},
            )
            await queue.put(None)

    asyncio.create_task(_background_worker())

    async def _event_generator():
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=600)
            except TimeoutError:
                yield {"event": "ping", "data": "{}"}
                continue
            if event is None:
                break
            yield {"event": event["event"], "data": json.dumps(event["data"], ensure_ascii=False)}

    return EventSourceResponse(_event_generator())


@router.post("/{session_id}/stop")
async def stop_chat(
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

    runner = _active_runners.get(session_id)
    if runner:
        runner.cancel()
        return ok({"ok": True, "was_running": True})

    await col.update_one(
        {"session_id": session_id},
        {"$set": {"status": SessionStatus.COMPLETED.value, "updated_at": datetime.utcnow()}},
    )
    return ok({"ok": True, "was_running": False})
