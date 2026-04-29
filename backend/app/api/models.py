from __future__ import annotations

from datetime import datetime

import shortuuid
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_db
from app.database import DatabaseManager
from app.models.model_schemas import (
    CreateModelRequest,
    DetectContextWindowRequest,
    ModelConfigResponse,
    UpdateModelRequest,
)
from app.models.user import UserInDB
from app.services.model_factory import (
    ModelConfig,
    detect_context_window,
    verify_model_connection,
)
from app.utils.response import err, ok

router = APIRouter()


def _to_response(doc: dict) -> dict:
    return ModelConfigResponse(
        id=doc["id"],
        name=doc["name"],
        provider=doc["provider"],
        base_url=doc.get("base_url"),
        api_key_set=bool(doc.get("api_key")),
        model_name=doc["model_name"],
        context_window=doc.get("context_window", 128000),
        temperature=doc.get("temperature", 0.7),
        is_system=doc.get("is_system", False),
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    ).model_dump(mode="json")


@router.get("")
async def list_models(
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["model_configs"]
    cursor = col.find({
        "$or": [{"user_id": user.email}, {"is_system": True}],
    }).sort("created_at", 1)
    docs = await cursor.to_list(length=None)
    return ok([_to_response(d) for d in docs])


@router.post("")
async def create_model(
    req: CreateModelRequest,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["model_configs"]

    existing = await col.find_one({"name": req.name, "user_id": user.email})
    if existing:
        return err(4002, "模型名称已存在")

    config = ModelConfig(
        provider=req.provider,
        model_name=req.model_name,
        base_url=req.base_url,
        api_key=req.api_key,
        temperature=req.temperature or 0.7,
        context_window=req.context_window or 128000,
    )
    if req.api_key:
        verified = await verify_model_connection(config)
        if not verified:
            return err(4003, "API Key 验证失败")

    now = datetime.utcnow()
    doc = {
        "id": shortuuid.uuid(),
        "name": req.name,
        "provider": req.provider,
        "base_url": req.base_url,
        "api_key": req.api_key,
        "model_name": req.model_name,
        "context_window": req.context_window or 128000,
        "temperature": req.temperature or 0.7,
        "is_system": False,
        "is_active": True,
        "user_id": user.email,
        "created_at": now,
        "updated_at": now,
    }
    await col.insert_one(doc)
    return ok(_to_response(doc))


@router.put("/{model_id}")
async def update_model(
    model_id: str,
    req: UpdateModelRequest,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["model_configs"]
    doc = await col.find_one({"id": model_id})
    if not doc:
        return err(4001, "模型配置不存在")
    if doc.get("is_system"):
        return err(4005, "系统内置模型不可修改")
    if doc.get("user_id") != user.email:
        return err(4001, "模型配置不存在")

    updates: dict = {"updated_at": datetime.utcnow()}
    fields = (
        "name", "base_url", "api_key", "model_name",
        "context_window", "temperature", "is_active",
    )
    for field in fields:
        val = getattr(req, field, None)
        if val is not None:
            updates[field] = val

    connection_changed = any(
        getattr(req, f, None) is not None
        for f in ("api_key", "base_url", "model_name")
    )
    if connection_changed and (req.api_key or doc.get("api_key")):
        config = ModelConfig(
            provider=doc["provider"],
            model_name=updates.get("model_name", doc["model_name"]),
            base_url=updates.get("base_url", doc.get("base_url")),
            api_key=updates.get("api_key", doc.get("api_key")),
        )
        verified = await verify_model_connection(config)
        if not verified:
            return err(4003, "API Key 验证失败")

    await col.update_one({"id": model_id}, {"$set": updates})
    updated = await col.find_one({"id": model_id})
    return ok(_to_response(updated))


@router.delete("/{model_id}")
async def delete_model(
    model_id: str,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["model_configs"]
    doc = await col.find_one({"id": model_id})
    if not doc:
        return err(4001, "模型配置不存在")
    if doc.get("is_system"):
        return err(4005, "系统内置模型不可删除")
    if doc.get("user_id") != user.email:
        return err(4001, "模型配置不存在")

    sessions_col = db.mongo_db["chat_sessions"]
    active = await sessions_col.find_one({
        "model_config_id": model_id,
        "status": "running",
    })
    if active:
        return err(4006, "模型正在被活跃会话使用，不可删除")

    await col.delete_one({"id": model_id})
    return ok(msg="已删除")


@router.post("/detect-context-window")
async def detect_context_window_endpoint(
    req: DetectContextWindowRequest,
    _user: UserInDB = Depends(get_current_user),
):
    window: int | None = detect_context_window(req.model_name)
    if window:
        return ok({"context_window": window})
    return err(4004, "无法自动检测 context window")
