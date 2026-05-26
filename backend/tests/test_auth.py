import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee, UserRole
from app.utils.auth import hash_password


async def _create_user(
    db: AsyncSession,
    email: str,
    password: str,
    role: UserRole = UserRole.hr_admin,
) -> Employee:
    user = Employee(email=email, password_hash=hash_password(password), role=role)
    db.add(user)
    await db.commit()
    return user


@pytest_asyncio.fixture(autouse=True)
async def clean_employees(db_session: AsyncSession):
    yield
    await db_session.execute(delete(Employee))
    await db_session.commit()


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db_session: AsyncSession):
    await _create_user(db_session, "admin@test.com", "password123", UserRole.super_admin)
    resp = await client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "password123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["access_token"]
    assert body["data"]["refresh_token"]
    assert body["data"]["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, db_session: AsyncSession):
    await _create_user(db_session, "user@test.com", "correct")
    resp = await client.post("/api/v1/auth/login", json={"email": "user@test.com", "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={"email": "nobody@test.com", "password": "pass"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, db_session: AsyncSession):
    await _create_user(db_session, "refresh@test.com", "pass123")
    login_resp = await client.post("/api/v1/auth/login", json={"email": "refresh@test.com", "password": "pass123"})
    refresh_tok = login_resp.json()["data"]["refresh_token"]

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_tok})
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]


@pytest.mark.asyncio
async def test_refresh_with_access_token_fails(client: AsyncClient, db_session: AsyncSession):
    await _create_user(db_session, "rcheck@test.com", "pass123")
    login_resp = await client.post("/api/v1/auth/login", json={"email": "rcheck@test.com", "password": "pass123"})
    access_tok = login_resp.json()["data"]["access_token"]

    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": access_tok})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, db_session: AsyncSession):
    await _create_user(db_session, "me@test.com", "pass123", UserRole.hr_admin)
    login_resp = await client.post("/api/v1/auth/login", json={"email": "me@test.com", "password": "pass123"})
    token = login_resp.json()["data"]["access_token"]

    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["email"] == "me@test.com"
    assert data["role"] == "hr_admin"


@pytest.mark.asyncio
async def test_get_me_no_token(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Logged out successfully"
