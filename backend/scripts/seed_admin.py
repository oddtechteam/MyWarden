"""
Creates the initial super_admin user. Run once after the first migration.

Usage:
  cd backend
  python -m scripts.seed_admin --email admin@example.com --password yourpassword
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.employee import Employee, UserRole
from app.utils.auth import hash_password


async def create_admin(email: str, password: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with SessionLocal() as session:
        user = Employee(
            email=email,
            password_hash=hash_password(password),
            role=UserRole.super_admin,
        )
        session.add(user)
        await session.commit()
        print(f"super_admin created: {email}")
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed initial super_admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password")
    args = parser.parse_args()
    asyncio.run(create_admin(args.email, args.password))
