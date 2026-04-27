from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from .schemas import UserRole


class UserInDB(BaseModel):
    """User document as stored in MongoDB."""
    username: str
    email: EmailStr
    hashed_password: str
    role: UserRole = UserRole.viewer
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserResponse(BaseModel):
    """User response (no password)."""
    id: str
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime
