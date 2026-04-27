from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.schemas import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.services.auth_service import (register_user, authenticate_user, create_access_token, create_refresh_token, refresh_access_token)
from app.api.deps import get_db
from app.models.user import UserResponse, UserInDB
from fastapi.security import OAuth2PasswordBearer

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_endpoint(request: RegisterRequest, db = Depends(get_db)):
    user = await register_user(db, request)
    access = create_access_token({"sub": user.email, "role": user.role})
    refresh = create_refresh_token({"sub": user.email})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
async def login_endpoint(req: LoginRequest, db = Depends(get_db)):
    user = await authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access = create_access_token({"sub": user.email, "role": user.role})
    refresh = create_refresh_token({"sub": user.email})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh_endpoint(req: RefreshRequest, db = Depends(get_db)):
    tokens = await refresh_access_token(db, req.refresh_token)
    return tokens


@router.post("/logout")
async def logout_endpoint():
    # MVP: simply acknowledge logout; token revocation can be added later
    return {"detail": "logged out"}
