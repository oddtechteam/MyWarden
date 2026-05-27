import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.employee import EmployeeType


class PayrollStatus(str, enum.Enum):
    draft     = "draft"
    approved  = "approved"
    processed = "processed"
    paid      = "paid"


class DeductionType(str, enum.Enum):
    percentage = "percentage"
    fixed      = "fixed"


class AppliesTo(str, enum.Enum):
    all       = "all"
    FULL_TIME = "FULL_TIME"
    HOURLY    = "HOURLY"
    CONTRACT  = "CONTRACT"


# ─── Deduction rules ─────────────────────────────────────────────────────────

class DeductionRule(Base):
    __tablename__ = "deduction_rules"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(100), nullable=False, unique=True)
    code        = Column(String(20),  nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    type        = Column(SAEnum(DeductionType, name="deductiontype", create_type=False), nullable=False)
    value       = Column(Numeric(10, 4), nullable=False)
    applies_to  = Column(SAEnum(AppliesTo, name="appliesto", create_type=False), nullable=False, default=AppliesTo.all)
    is_statutory = Column(Boolean, nullable=False, default=False)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


# ─── Payroll run ──────────────────────────────────────────────────────────────

class PayrollRun(Base):
    __tablename__ = "payroll_runs"
    __table_args__ = (
        UniqueConstraint("period_year", "period_month", "revision", name="uq_payroll_run_period_revision"),
    )

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_year  = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    revision     = Column(Integer, nullable=False, default=1)
    status       = Column(SAEnum(PayrollStatus, name="payrollstatus", create_type=False), nullable=False, default=PayrollStatus.draft)
    notes        = Column(String(500), nullable=True)

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    processed_at  = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    approved_at   = Column(DateTime(timezone=True), nullable=True)
    paid_at       = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    created_by  = relationship("Employee", foreign_keys=[created_by_id])
    approved_by = relationship("Employee", foreign_keys=[approved_by_id])
    entries     = relationship("PayrollEntry", back_populates="payroll_run", cascade="all, delete-orphan")


# ─── Payroll entry (one row per employee per run) ─────────────────────────────

class PayrollEntry(Base):
    __tablename__ = "payroll_entries"
    __table_args__ = (
        UniqueConstraint("payroll_run_id", "employee_id", name="uq_payroll_entry_run_employee"),
    )

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payroll_run_id = Column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id    = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    # Snapshot fields — captured at processing time, survive employee edits
    employee_type  = Column(SAEnum(EmployeeType, name="employeetype", create_type=False), nullable=False)
    period_year    = Column(Integer, nullable=False)
    period_month   = Column(Integer, nullable=False)

    working_days   = Column(Numeric(5, 1), nullable=False)
    days_present   = Column(Numeric(5, 1), nullable=False)
    gross_salary   = Column(Numeric(12, 2), nullable=False)
    total_deductions = Column(Numeric(12, 2), nullable=False)
    net_salary     = Column(Numeric(12, 2), nullable=False)
    deduction_breakdown = Column(JSONB, nullable=False, default=dict)
    payslip_key    = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    payroll_run = relationship("PayrollRun", back_populates="entries")
    employee    = relationship("Employee", foreign_keys=[employee_id])
