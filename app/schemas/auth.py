from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.db.models.user import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(RegisterRequest):
    pass


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: UserRole
    is_active: bool
