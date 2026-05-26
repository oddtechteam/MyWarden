import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Employee(Base):
    # TODO: add all columns in Phase 1 Part 3
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
