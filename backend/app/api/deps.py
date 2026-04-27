from __future__ import annotations

from fastapi import Depends, Request, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config import settings
from app.models.user import UserInDB
from app.services.auth_service import decode_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db(request: Request):
    db = getattr(request.app.state, "db_manager", None)
    if db is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="DB not initialized")
    return db


async def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> UserInDB:
    payload = decode_token(token)
    email = payload.get("sub") or payload.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    if db.mongo_db is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")
    users = db.mongo_db["users"]
    user = await users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return UserInDB(
        username=user.get("username"),
        email=user.get("email"),
        hashed_password=user.get("hashed_password"),
        role=user.get("role", "viewer"),
        is_active=user.get("is_active", True),
        created_at=user.get("created_at"),
        updated_at=user.get("updated_at"),
    )


def require_role(*roles: str):
    async def _require(user: UserInDB = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return _require
