import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Column, Date, DateTime, Enum as SAEnum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    hr_admin = "hr_admin"
    manager = "manager"
    employee = "employee"


class EmployeeType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    HOURLY = "HOURLY"
    CONTRACT = "CONTRACT"


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
    full_name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    job_title = Column(String(100), nullable=True)
    employee_type = Column(
        SAEnum(EmployeeType, name="employeetype", create_type=False),
        nullable=False,
        default=EmployeeType.FULL_TIME,
    )
    department_id = Column(
        UUID(as_uuid=True),
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )
    join_date = Column(Date, nullable=True)
    base_salary = Column(Numeric(12, 2), nullable=True)
    face_embedding = Column(Vector(512), nullable=True)
    face_enrolled = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
