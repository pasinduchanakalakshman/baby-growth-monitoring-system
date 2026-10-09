from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class MotherRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class MotherLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthenticatedUserResponse(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CurrentUserResponse(AuthenticatedUserResponse):
    pass
