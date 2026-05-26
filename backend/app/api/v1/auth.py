from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.employee import Employee
from app.schemas.auth import LoginSchema, RefreshTokenSchema, TokenResponseSchema
from app.utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    verify_password,
)

router = APIRouter()


@router.post("/login")
async def login(payload: LoginSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Employee).where(Employee.email == payload.email, Employee.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token_data = {"sub": str(user.id), "role": user.role.value}
    tokens = TokenResponseSchema(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
    return {"data": tokens, "message": "Login successful"}


@router.post("/refresh")
async def refresh_token(payload: RefreshTokenSchema, db: AsyncSession = Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = decoded.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    result = await db.execute(
        select(Employee).where(Employee.id == user_id, Employee.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": str(user.id), "role": user.role.value}
    tokens = TokenResponseSchema(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
    return {"data": tokens, "message": "Token refreshed"}


@router.post("/logout")
async def logout():
    return {"data": None, "message": "Logged out successfully"}


@router.get("/me")
async def get_me(current_user: Employee = Depends(get_current_user)):
    return {
        "data": {
            "id": str(current_user.id),
            "email": current_user.email,
            "role": current_user.role.value,
            "full_name": current_user.full_name,
        },
        "message": "OK",
    }
