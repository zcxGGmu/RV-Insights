from __future__ import annotations

from datetime import datetime
from pathlib import Path

import shortuuid
from fastapi import APIRouter, Depends, UploadFile

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.database import DatabaseManager
from app.models.user import UserInDB
from app.utils.response import err, ok

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".json", ".yaml", ".yml",
    ".csv", ".xml", ".html", ".css", ".c", ".h", ".rs", ".go",
    ".java", ".sh", ".toml", ".cfg", ".ini", ".log",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".pdf",
}


@router.post("/{session_id}/files")
async def upload_file(
    session_id: str,
    file: UploadFile,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["chat_sessions"]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")

    filename = file.filename or "unnamed"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return err(2007, f"不允许的文件类型: {ext}")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        return err(2006, "上传文件超过大小限制")

    upload_dir = Path(settings.UPLOAD_DIR) / session_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = shortuuid.uuid()
    safe_name = f"{file_id}{ext}"
    file_path = upload_dir / safe_name
    file_path.write_bytes(content)

    now = datetime.utcnow()
    file_doc = {
        "id": file_id,
        "session_id": session_id,
        "user_id": user.email,
        "original_name": filename,
        "stored_name": safe_name,
        "size": len(content),
        "content_type": file.content_type or "application/octet-stream",
        "created_at": now,
    }
    files_col = db.mongo_db["session_files"]
    await files_col.insert_one(file_doc)

    return ok({
        "id": file_id,
        "original_name": filename,
        "size": len(content),
    })


@router.get("/{session_id}/files")
async def list_files(
    session_id: str,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    col = db.mongo_db["chat_sessions"]
    doc = await col.find_one({"session_id": session_id})
    if not doc:
        return err(2001, "Session not found")
    if doc["user_id"] != user.email:
        return err(2002, "Session not owned")

    files_col = db.mongo_db["session_files"]
    cursor = files_col.find({"session_id": session_id}).sort("created_at", 1)
    docs = await cursor.to_list(length=None)

    files = [
        {
            "id": d["id"],
            "original_name": d["original_name"],
            "size": d["size"],
            "content_type": d.get("content_type", ""),
            "created_at": d["created_at"].isoformat(),
        }
        for d in docs
    ]
    return ok({"files": files})


@router.get("/{session_id}/files/{file_id}")
async def download_file(
    session_id: str,
    file_id: str,
    db: DatabaseManager = Depends(get_db),
    user: UserInDB = Depends(get_current_user),
):
    files_col = db.mongo_db["session_files"]
    file_doc = await files_col.find_one({
        "id": file_id,
        "session_id": session_id,
    })
    if not file_doc:
        return err(2001, "File not found")

    col = db.mongo_db["chat_sessions"]
    session_doc = await col.find_one({"session_id": session_id})
    if not session_doc or session_doc["user_id"] != user.email:
        return err(2002, "Session not owned")

    file_path = Path(settings.UPLOAD_DIR) / session_id / file_doc["stored_name"]
    if not file_path.exists():
        return err(2001, "File not found on disk")

    from fastapi.responses import FileResponse
    return FileResponse(
        path=str(file_path),
        filename=file_doc["original_name"],
        media_type=file_doc.get("content_type", "application/octet-stream"),
    )
