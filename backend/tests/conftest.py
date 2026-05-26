import pytest
import pytest_asyncio
import sqlalchemy as sa
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "postgresql+asyncpg://mywarden:mywarden@localhost:5432/mywarden_test"

test_engine = create_async_engine(TEST_DATABASE_URL)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True, scope="session")
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.execute(sa.text("""
            DO $$ BEGIN
                CREATE TYPE userrole AS ENUM ('super_admin', 'hr_admin', 'manager', 'employee');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        """))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.execute(sa.text("DROP TYPE IF EXISTS userrole"))


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
