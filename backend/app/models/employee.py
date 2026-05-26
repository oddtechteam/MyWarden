import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    hr_admin = "hr_admin"
    manager = "manager"
    employee = "employee"


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        SAEnum(UserRole, name="userrole", create_type=False),
        nullable=False,
        default=UserRole.employee,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    # TODO: add remaining employee profile fields in Phase 1 Part 3
