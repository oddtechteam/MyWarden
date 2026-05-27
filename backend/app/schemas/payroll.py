from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.models.payroll import AppliesTo, DeductionType, PayrollStatus


# ─── Deduction rules ─────────────────────────────────────────────────────────

class DeductionRuleCreateSchema(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    type: DeductionType
    value: Decimal
    applies_to: AppliesTo = AppliesTo.all
    is_statutory: bool = False


class DeductionRuleUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    value: Optional[Decimal] = None
    applies_to: Optional[AppliesTo] = None
    is_active: Optional[bool] = None


class DeductionRuleResponseSchema(BaseModel):
    id: UUID
    name: str
    code: str
    description: Optional[str]
    type: DeductionType
    value: Decimal
    applies_to: AppliesTo
    is_statutory: bool
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Payroll run ──────────────────────────────────────────────────────────────

class PayrollRunCreateSchema(BaseModel):
    period_year: int
    period_month: int
    notes: Optional[str] = None

    @field_validator("period_month")
    @classmethod
    def valid_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("period_month must be between 1 and 12")
        return v

    @field_validator("period_year")
    @classmethod
    def valid_year(cls, v: int) -> int:
        if not 2000 <= v <= 2100:
            raise ValueError("period_year must be between 2000 and 2100")
        return v


class PayrollRunResponseSchema(BaseModel):
    id: UUID
    period_year: int
    period_month: int
    revision: int
    status: PayrollStatus
    notes: Optional[str]
    created_by_id: Optional[UUID]
    processed_at: Optional[datetime]
    approved_by_id: Optional[UUID]
    approved_at: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Payroll entry ────────────────────────────────────────────────────────────

class PayrollEmployeeBriefSchema(BaseModel):
    id: UUID
    full_name: Optional[str]
    email: str
    job_title: Optional[str]

    model_config = {"from_attributes": True}


class PayrollEntryResponseSchema(BaseModel):
    id: UUID
    payroll_run_id: UUID
    employee_id: Optional[UUID]
    employee: Optional[PayrollEmployeeBriefSchema]
    employee_type: str
    period_year: int
    period_month: int
    working_days: Decimal
    days_present: Decimal
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    deduction_breakdown: dict[str, float]
    payslip_key: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PayrollRunDetailSchema(PayrollRunResponseSchema):
    entries: list[PayrollEntryResponseSchema] = []
    entry_count: int = 0
    total_gross: Decimal = Decimal(0)
    total_net: Decimal = Decimal(0)


# ─── List responses ───────────────────────────────────────────────────────────

class PayrollRunListResponse(BaseModel):
    items: list[PayrollRunResponseSchema]
    total: int
    page: int
    limit: int
    pages: int


class PayrollEntryListResponse(BaseModel):
    items: list[PayrollEntryResponseSchema]
    total: int
    page: int
    limit: int
    pages: int
