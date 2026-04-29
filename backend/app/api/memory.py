from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, get_db
from app.database import DatabaseManager
from app.models.user import UserInDB
from app.utils.response import ok

router = APIRouter()

DEFAULT_MEMORY = """## User Preferences

## General Patterns

## Notes
"""


class UpdateMemoryRequest(BaseModel):
    content: str = Field(max_length=10000)

    model_config = {"extra": "forbid"}


@router.get("")
async def get_memory(
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["user_memories"]
    doc = await col.find_one({"user_id": user.email})
    content = doc["content"] if doc else DEFAULT_MEMORY
    return ok({"content": content})


@router.put("")
async def update_memory(
    req: UpdateMemoryRequest,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["user_memories"]
    await col.update_one(
        {"user_id": user.email},
        {
            "$set": {
                "content": req.content,
                "updated_at": datetime.utcnow(),
            },
            "$setOnInsert": {
                "user_id": user.email,
                "created_at": datetime.utcnow(),
            },
        },
        upsert=True,
    )
    return ok({"content": req.content})
