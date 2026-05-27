from datetime import date, datetime, time
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.models.attendance import AttendanceStatus, CheckInMethod


class EmployeeBriefSchema(BaseModel):
    id: UUID
    full_name: Optional[str]
    email: str
    model_config = {"from_attributes": True}


# ─── Shift ─────────────────────────────────────────────────────────────────

class ShiftCreateSchema(BaseModel):
    name: str
    start_time: time
    end_time: time
    grace_minutes: int = 15


class ShiftUpdateSchema(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    grace_minutes: Optional[int] = None
    is_active: Optional[bool] = None


class ShiftResponseSchema(BaseModel):
    id: UUID
    name: str
    start_time: time
    end_time: time
    grace_minutes: int
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Attendance log ─────────────────────────────────────────────────────────

class AttendanceLogUpdateSchema(BaseModel):
    """HR manual correction — all fields optional."""
    shift_id: Optional[UUID] = None
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    status: Optional[AttendanceStatus] = None
    notes: Optional[str] = None


class AttendanceLogResponseSchema(BaseModel):
    id: UUID
    employee_id: UUID
    employee: Optional[EmployeeBriefSchema] = None
    shift_id: Optional[UUID]
    work_date: date
    check_in_at: Optional[datetime]
    check_out_at: Optional[datetime]
    check_in_method: Optional[CheckInMethod]
    check_out_method: Optional[CheckInMethod]
    check_in_photo_key: Optional[str]
    status: AttendanceStatus
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Kiosk responses ────────────────────────────────────────────────────────

class CheckinResponseSchema(BaseModel):
    """Returned to the kiosk after a successful check-in or check-out."""
    log_id: UUID
    employee_id: UUID
    employee_name: Optional[str]
    work_date: date
    check_in_at: Optional[datetime]
    check_out_at: Optional[datetime]
    status: AttendanceStatus
    shift_name: Optional[str]
