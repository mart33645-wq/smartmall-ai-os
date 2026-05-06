from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from core.deps import get_current_user
from models.database import User, get_db

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
router = APIRouter()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token({"sub": user.username, "role": user.role, "id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
        "username": user.username,
    }


@router.post("/register")
def register(user_data: dict = Body(...), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user_data["username"]).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    try:
        new_user = User(
            username=user_data["username"],
            hashed_password=pwd_context.hash(user_data["password"]),
            role="Staff",
            full_name=user_data.get("full_name", ""),
            preferences={},
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"message": "User registered successfully", "username": new_user.username, "role": new_user.role}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "preferences": current_user.preferences or {},
    }


@router.patch("/me")
def patch_me(
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if "full_name" in data and data["full_name"] is not None:
        current_user.full_name = str(data["full_name"])
    
    if "password" in data and data["password"]:
        # Basic validation: ensure it's not empty and perhaps check for "current_password" if needed
        # For simplicity in this modernization, we'll allow direct update if authenticated
        current_user.hashed_password = pwd_context.hash(data["password"])
        
    if "preferences" in data and isinstance(data["preferences"], dict):
        merged = dict(current_user.preferences or {})
        merged.update(data["preferences"])
        current_user.preferences = merged
        
    db.commit()
    db.refresh(current_user)
    return {
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "preferences": current_user.preferences or {},
    }
