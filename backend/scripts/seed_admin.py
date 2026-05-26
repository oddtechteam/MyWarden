"""
Seed the first super_admin account.
Run once after migrations:
    cd backend && python -m scripts.seed_admin --email admin@mywarden.com --password Admin@123!

Reads ADMIN_EMAIL / ADMIN_PASSWORD from env if flags are omitted.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.employee import Employee, UserRole
from app.utils.auth import hash_password


async def create_admin(email: str, password: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as session:
        existing = await session.scalar(select(Employee).where(Employee.email == email))
        if existing:
            print(f"Admin already exists: {email}")
            await engine.dispose()
            return

        admin = Employee(
            email=email,
            password_hash=hash_password(password),
            full_name="System Admin",
            role=UserRole.super_admin,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        print(f"super_admin created: {email}")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed initial super_admin user")
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL", "admin@mywarden.com"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD", "Admin@123!"))
    args = parser.parse_args()
    asyncio.run(create_admin(args.email, args.password))
