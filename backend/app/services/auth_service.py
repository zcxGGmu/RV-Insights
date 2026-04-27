from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
import bcrypt

from fastapi import HTTPException, status

from app.config import settings
from app.models.user import UserInDB
from app.models.schemas import RegisterRequest


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e


async def register_user(db, request: RegisterRequest) -> UserInDB:
    if db.mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    users = db.mongo_db["users"]
    existing = await (users.find_one({"email": request.email}))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    hashed = hash_password(request.password)
    new = {
        "username": request.username,
        "email": request.email,
        "hashed_password": hashed,
        "role": "viewer",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    insert_result = await users.insert_one(new)
    user_id = str(insert_result.inserted_id) if hasattr(insert_result, "inserted_id") else "new-user"
    created = UserInDB(
        username=request.username,
        email=request.email,
        hashed_password=hashed,
        role="viewer",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    return created


async def authenticate_user(db, email: str, password: str) -> Optional[UserInDB]:
    if db.mongo_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
    users = db.mongo_db["users"]
    user = await users.find_one({"email": email})
    if not user:
        return None
    if not verify_password(password, user.get("hashed_password")):
        return None
    return UserInDB(
        username=user.get("username"),
        email=user.get("email"),
        hashed_password=user.get("hashed_password"),
        role=user.get("role", "viewer"),
        is_active=user.get("is_active", True),
        created_at=user.get("created_at"),
        updated_at=user.get("updated_at"),
    )


async def refresh_access_token(db, refresh_token: str) -> dict:
    payload = decode_token(refresh_token)
    email = payload.get("sub") or payload.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    users = db.mongo_db["users"]
    user = await users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    access = create_access_token({"sub": email, "role": user.get("role", "viewer")})
    refresh = create_refresh_token({"sub": email})
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}
