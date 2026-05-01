from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.models.user import UserInDB
from app.utils.response import err

router = APIRouter()

ALLOWED_PREFIXES = ["./uploads", "./skills"]


@router.get("/download")
async def download_file(
    path: str = Query(..., description="File path to download"),
    user: UserInDB = Depends(get_current_user),
):
    resolved = Path(path).resolve()
    allowed = any(
        resolved.is_relative_to(Path(p).resolve())
        for p in ALLOWED_PREFIXES
    )
    if not allowed:
        return err(9005, "Path not in allowed prefixes")
    if not resolved.exists() or not resolved.is_file():
        return err(9004, "File not found")
    return FileResponse(path=str(resolved), filename=resolved.name)
