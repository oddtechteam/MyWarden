import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Enum as SAEnum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class CheckInMethod(str, enum.Enum):
    face = "face"
    otp = "otp"
    manual = "manual"


class AttendanceStatus(str, enum.Enum):
    present = "present"
    late = "late"
    absent = "absent"
    half_day = "half_day"


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_attendance_employee_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(
        UUID(as_uuid=True),
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shifts.id", ondelete="SET NULL"),
        nullable=True,
    )
    work_date = Column(Date, nullable=False, index=True)
    check_in_at = Column(DateTime(timezone=True), nullable=True)
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    check_in_method = Column(
        SAEnum(CheckInMethod, name="checkinmethod", create_type=False),
        nullable=True,
    )
    check_out_method = Column(
        SAEnum(CheckInMethod, name="checkinmethod", create_type=False),
        nullable=True,
    )
    check_in_photo_key = Column(String(500), nullable=True)
    status = Column(
        SAEnum(AttendanceStatus, name="attendancestatus", create_type=False),
        nullable=False,
        default=AttendanceStatus.absent,
    )
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    employee = relationship("Employee", back_populates="attendance_logs", foreign_keys=[employee_id])
    shift = relationship("Shift", back_populates="attendance_logs")
