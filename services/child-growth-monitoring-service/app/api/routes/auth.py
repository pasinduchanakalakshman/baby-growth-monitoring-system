from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.models.user import User
from app.schemas.auth import (
    MotherRegisterRequest,
    MotherLoginRequest,
    AuthenticatedUserResponse,
    CurrentUserResponse
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.post("/register", response_model=AuthenticatedUserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: MotherRegisterRequest, db: Session = Depends(get_db)):
    # Normalize email
    normalized_email = user_in.email.lower()
    
    # Check if duplicate email
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        
    hashed_password = get_password_hash(user_in.password)
    
    new_user = User(
        email=normalized_email,
        name=user_in.name,
        password_hash=hashed_password,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@router.post("/login", response_model=AuthenticatedUserResponse)
def login(response: Response, login_in: MotherLoginRequest, db: Session = Depends(get_db)):
    normalized_email = login_in.email.lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id), expires_delta=access_token_expires
    )
    
    # Set HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    
    return user

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production"
    )
    return {"detail": "Logged out successfully"}

@router.get("/me", response_model=CurrentUserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
