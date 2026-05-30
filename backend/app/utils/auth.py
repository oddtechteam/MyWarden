from datetime import datetime, timedelta
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.employee import Employee

    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    result = await db.execute(
        select(Employee).where(Employee.id == user_id, Employee.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    async def dependency(current_user=Depends(get_current_user)):
        if current_user.role.value not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency


# ─── Kiosk session token ────────────────────────────────────────────────────

KIOSK_TOKEN_EXPIRE_HOURS = 8


def create_kiosk_token(super_admin_id: str) -> str:
    payload = {"sub": super_admin_id, "type": "kiosk"}
    expire = datetime.utcnow() + timedelta(hours=KIOSK_TOKEN_EXPIRE_HOURS)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def verify_kiosk_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """FastAPI dependency — validates kiosk JWT, returns super_admin_id."""
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "kiosk":
            raise HTTPException(status_code=401, detail="Invalid kiosk token")
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid kiosk token")
        return sub
    except JWTError:
        raise HTTPException(status_code=401, detail="Kiosk token invalid or expired")
