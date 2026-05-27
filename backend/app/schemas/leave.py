from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, computed_field, field_validator

from app.models.leave import LeaveStatus


# ─── Leave type ─────────────────────────────────────────────────────────────

class LeaveTypeCreateSchema(BaseModel):
    name: str
    code: str
    days_per_year: int
    is_paid: bool = True


class LeaveTypeUpdateSchema(BaseModel):
    name: Optional[str] = None
    days_per_year: Optional[int] = None
    is_paid: Optional[bool] = None
    is_active: Optional[bool] = None


class LeaveTypeResponseSchema(BaseModel):
    id: UUID
    name: str
    code: str
    days_per_year: int
    is_paid: bool
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Leave request ──────────────────────────────────────────────────────────

class LeaveRequestCreateSchema(BaseModel):
    leave_type_id: UUID
    start_date: date
    end_date: date
    reason: Optional[str] = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        if info.data.get("start_date") and v < info.data["start_date"]:
            raise ValueError("end_date must be on or after start_date")
        return v


class LeaveRequestReviewSchema(BaseModel):
    status: LeaveStatus
    review_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def only_actionable_status(cls, v):
        if v not in (LeaveStatus.approved, LeaveStatus.rejected):
            raise ValueError("status must be 'approved' or 'rejected'")
        return v


class EmployeeBriefSchema(BaseModel):
    id: UUID
    full_name: Optional[str]
    email: str
    model_config = {"from_attributes": True}


class LeaveRequestResponseSchema(BaseModel):
    id: UUID
    employee_id: UUID
    employee: Optional[EmployeeBriefSchema] = None
    leave_type_id: UUID
    leave_type: LeaveTypeResponseSchema
    start_date: date
    end_date: date
    days_requested: Decimal
    reason: Optional[str]
    status: LeaveStatus
    reviewed_by_id: Optional[UUID]
    reviewed_at: Optional[datetime]
    review_note: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Leave balance ──────────────────────────────────────────────────────────

class LeaveBalanceCreateSchema(BaseModel):
    employee_id: UUID
    leave_type_id: UUID
    year: int
    allocated: Decimal


class LeaveBalanceAdjustSchema(BaseModel):
    """HR can correct either field independently."""
    allocated: Optional[Decimal] = None
    used: Optional[Decimal] = None


class LeaveReviewNoteSchema(BaseModel):
    """Body for approve/reject endpoints — status is implied by the URL."""
    review_note: Optional[str] = None


class LeaveBalanceResponseSchema(BaseModel):
    id: UUID
    employee_id: UUID
    leave_type_id: UUID
    leave_type: LeaveTypeResponseSchema
    year: int
    allocated: Decimal
    used: Decimal

    @computed_field
    @property
    def remaining(self) -> Decimal:
        return self.allocated - self.used

    model_config = {"from_attributes": True}
