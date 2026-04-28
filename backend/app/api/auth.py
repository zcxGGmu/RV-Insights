from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_user, get_db
from app.models.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.models.user import UserInDB
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    hash_password,
    refresh_access_token,
    register_user,
    verify_password,
)
from app.utils.response import err, ok

router = APIRouter()


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)
    model_config = {"extra": "forbid"}


class ChangeFullnameRequest(BaseModel):
    fullname: str = Field(min_length=1, max_length=100)
    model_config = {"extra": "forbid"}


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_endpoint(request: RegisterRequest, db=Depends(get_db)):
    user = await register_user(db, request)
    access = create_access_token({"sub": user.email, "role": user.role})
    refresh = create_refresh_token({"sub": user.email})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
async def login_endpoint(req: LoginRequest, db=Depends(get_db)):
    user = await authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    access = create_access_token({"sub": user.email, "role": user.role})
    refresh = create_refresh_token({"sub": user.email})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_endpoint(req: RefreshRequest, db=Depends(get_db)):
    tokens = await refresh_access_token(db, req.refresh_token)
    return tokens


@router.post("/logout")
async def logout_endpoint():
    return ok({"ok": True})


@router.get("/me")
async def me_endpoint(user: UserInDB = Depends(get_current_user), db=Depends(get_db)):
    users = db.mongo_db["users"]
    doc = await users.find_one({"email": user.email})
    if not doc:
        return err(1003, "User not found")
    return ok({
        "id": str(doc.get("_id", "")),
        "fullname": doc.get("username", ""),
        "email": doc.get("email", ""),
        "role": doc.get("role", "user"),
        "is_active": doc.get("is_active", True),
        "created_at": (
            doc["created_at"].isoformat() if doc.get("created_at") else None
        ),
        "updated_at": (
            doc["updated_at"].isoformat() if doc.get("updated_at") else None
        ),
        "last_login_at": (
            doc["last_login_at"].isoformat() if doc.get("last_login_at") else None
        ),
    })


@router.get("/status")
async def status_endpoint(user: UserInDB = Depends(get_current_user)):
    return ok({
        "authenticated": True,
        "auth_provider": "local",
        "user": {
            "email": user.email,
            "username": user.username,
            "role": user.role,
        },
    })


@router.post("/change-password")
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    users = db.mongo_db["users"]
    doc = await users.find_one({"email": user.email})
    if not doc:
        return err(1003, "User not found")
    if not verify_password(payload.old_password, doc["hashed_password"]):
        return err(1008, "Wrong old password")
    new_hashed = hash_password(payload.new_password)
    await users.update_one(
        {"email": user.email},
        {"$set": {"hashed_password": new_hashed}},
    )
    return ok({"ok": True})


@router.post("/change-fullname")
async def change_fullname_endpoint(
    payload: ChangeFullnameRequest,
    user: UserInDB = Depends(get_current_user),
    db=Depends(get_db),
):
    users = db.mongo_db["users"]
    await users.update_one(
        {"email": user.email},
        {"$set": {"username": payload.fullname}},
    )
    doc = await users.find_one({"email": user.email})
    return ok({
        "id": str(doc.get("_id", "")),
        "fullname": doc.get("username", ""),
        "email": doc.get("email", ""),
        "role": doc.get("role", "user"),
        "is_active": doc.get("is_active", True),
        "created_at": (
            doc["created_at"].isoformat() if doc.get("created_at") else None
        ),
        "updated_at": (
            doc["updated_at"].isoformat() if doc.get("updated_at") else None
        ),
    })
