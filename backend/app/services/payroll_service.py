"""
Payroll computation engine.

Salary logic by employee type:
  FULL_TIME  — base_salary paid in full each month (fixed monthly, no attendance proration)
               TODO: add LOP (Loss of Pay) config flag once HR policy is confirmed
  HOURLY     — prorated strictly by attendance: base_salary × (days_present / working_days)
  CONTRACT   — flat base_salary for the period (milestone / contract basis, no proration)

Deduction rules:
  percentage → amount = gross × (rule.value / 100)
  fixed      → amount = rule.value
  applies_to filters to 'all', 'FULL_TIME', 'HOURLY', or 'CONTRACT'

Day counting:
  working_days = Mon–Fri weekdays in the calendar month
  days_present = attendance logs in period where status ∈ {present, late} → 1.0
                                                            half_day       → 0.5
                                                            absent         → 0.0

State machine enforced here:
  process_run  : DRAFT      → PROCESSED
  approve_run  : PROCESSED  → APPROVED
  mark_paid    : APPROVED   → PAID
"""
import calendar
import datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceLog, AttendanceStatus
from app.models.employee import Employee, EmployeeType
from app.models.payroll import (
    AppliesTo,
    DeductionRule,
    DeductionType,
    PayrollEntry,
    PayrollRun,
    PayrollStatus,
)


# ─── Pure helpers (no DB) ────────────────────────────────────────────────────

def working_days_in_period(year: int, month: int) -> Decimal:
    """Count Mon–Fri weekdays in the given year/month."""
    _, days_in_month = calendar.monthrange(year, month)
    count = sum(
        1 for d in range(1, days_in_month + 1)
        if datetime.date(year, month, d).weekday() < 5
    )
    return Decimal(count)


def days_present_from_logs(logs: list[AttendanceLog]) -> Decimal:
    total = Decimal(0)
    for log in logs:
        if log.status in (AttendanceStatus.present, AttendanceStatus.late):
            total += Decimal("1.0")
        elif log.status == AttendanceStatus.half_day:
            total += Decimal("0.5")
    return total


def compute_gross(
    employee: Employee,
    days_present: Decimal,
    working_days: Decimal,
) -> Decimal:
    base = employee.base_salary or Decimal(0)
    if employee.employee_type == EmployeeType.FULL_TIME:
        return base.quantize(Decimal("0.01"), ROUND_HALF_UP)
    elif employee.employee_type == EmployeeType.HOURLY:
        if working_days == 0:
            return Decimal("0.00")
        return (base * days_present / working_days).quantize(Decimal("0.01"), ROUND_HALF_UP)
    else:  # CONTRACT
        return base.quantize(Decimal("0.01"), ROUND_HALF_UP)


def apply_deductions(
    gross: Decimal,
    rules: list[DeductionRule],
    employee_type: EmployeeType,
) -> tuple[Decimal, dict[str, float]]:
    """
    Returns (total_deductions, breakdown).
    breakdown = {rule_code: deducted_amount} — stored in JSONB for payslip rendering.
    """
    breakdown: dict[str, float] = {}
    total = Decimal(0)

    for rule in rules:
        if not rule.is_active:
            continue

        applies = (
            rule.applies_to == AppliesTo.all
            or rule.applies_to.value == employee_type.value
        )
        if not applies:
            continue

        if rule.type == DeductionType.percentage:
            amount = (gross * rule.value / Decimal(100)).quantize(Decimal("0.01"), ROUND_HALF_UP)
        else:
            amount = rule.value.quantize(Decimal("0.01"), ROUND_HALF_UP)

        breakdown[rule.code] = float(amount)
        total += amount

    return total, breakdown


# ─── DB operations ───────────────────────────────────────────────────────────

async def process_run(
    db: AsyncSession,
    run: PayrollRun,
    processed_by: Employee,
) -> PayrollRun:
    """
    Compute PayrollEntry rows for every active employee and advance run to PROCESSED.
    Safe to call multiple times while the run is still DRAFT (entries are replaced).
    """
    if run.status != PayrollStatus.draft:
        raise HTTPException(
            status_code=409,
            detail=f"Run is '{run.status.value}' — only DRAFT runs can be processed",
        )

    # Fetch all active deduction rules
    rules_result = await db.execute(
        select(DeductionRule).where(DeductionRule.is_active.is_(True))
    )
    rules: list[DeductionRule] = list(rules_result.scalars().all())

    # Fetch all active employees that have a salary configured
    emp_result = await db.execute(
        select(Employee).where(
            Employee.is_active.is_(True),
            Employee.base_salary.is_not(None),
        )
    )
    employees: list[Employee] = list(emp_result.scalars().all())

    if not employees:
        raise HTTPException(
            status_code=422,
            detail="No active employees with a base salary found — nothing to process",
        )

    w_days = working_days_in_period(run.period_year, run.period_month)
    _, last_day = calendar.monthrange(run.period_year, run.period_month)
    period_start = datetime.date(run.period_year, run.period_month, 1)
    period_end   = datetime.date(run.period_year, run.period_month, last_day)

    # Idempotent: wipe any existing entries before recomputing
    await db.execute(
        delete(PayrollEntry).where(PayrollEntry.payroll_run_id == run.id)
    )

    new_entries: list[PayrollEntry] = []

    for emp in employees:
        # Pull attendance logs for this employee in the pay period
        att_result = await db.execute(
            select(AttendanceLog).where(
                AttendanceLog.employee_id == emp.id,
                AttendanceLog.work_date   >= period_start,
                AttendanceLog.work_date   <= period_end,
            )
        )
        logs = list(att_result.scalars().all())

        d_present = days_present_from_logs(logs)
        gross     = compute_gross(emp, d_present, w_days)
        total_ded, breakdown = apply_deductions(gross, rules, emp.employee_type)
        net = (gross - total_ded).quantize(Decimal("0.01"), ROUND_HALF_UP)

        new_entries.append(
            PayrollEntry(
                payroll_run_id      = run.id,
                employee_id         = emp.id,
                employee_type       = emp.employee_type,
                period_year         = run.period_year,
                period_month        = run.period_month,
                working_days        = w_days,
                days_present        = d_present,
                gross_salary        = gross,
                total_deductions    = total_ded,
                net_salary          = net,
                deduction_breakdown = breakdown,
            )
        )

    db.add_all(new_entries)

    run.status       = PayrollStatus.processed
    run.processed_at = datetime.datetime.now(datetime.timezone.utc)

    await db.commit()
    await db.refresh(run)
    return run


async def approve_run(
    db: AsyncSession,
    run: PayrollRun,
    approver: Employee,
) -> PayrollRun:
    """Advance PROCESSED → APPROVED. HR / super_admin only."""
    if run.status != PayrollStatus.processed:
        raise HTTPException(
            status_code=409,
            detail=f"Run is '{run.status.value}' — only PROCESSED runs can be approved",
        )
    run.status        = PayrollStatus.approved
    run.approved_by_id = approver.id
    run.approved_at   = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(run)
    return run


async def mark_paid(
    db: AsyncSession,
    run: PayrollRun,
) -> PayrollRun:
    """Advance APPROVED → PAID."""
    if run.status != PayrollStatus.approved:
        raise HTTPException(
            status_code=409,
            detail=f"Run is '{run.status.value}' — only APPROVED runs can be marked paid",
        )
    run.status  = PayrollStatus.paid
    run.paid_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(run)
    return run
