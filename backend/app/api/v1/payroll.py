"""
Payroll Runs API — mounted at /api/v1/payroll-runs

  GET  /                         — list runs (HR/super_admin, paginated)
  POST /                         — create run (HR/super_admin)
  GET  /entries/me               — my payslip entries (any authenticated employee)
  GET  /{run_id}                 — run detail with entries (HR/super_admin)
  POST /{run_id}/process         — DRAFT → PROCESSED
  PUT  /{run_id}/approve         — PROCESSED → APPROVED
  PUT  /{run_id}/mark-paid       — APPROVED → PAID
  GET  /{run_id}/entries         — entries for a run (HR/super_admin, paginated)
  GET  /{run_id}/entries/{entry_id}/payslip — placeholder (Phase 3 Part 4)
"""
import calendar
import math
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.employee import Employee
from app.models.payroll import DeductionRule, PayrollEntry, PayrollRun, PayrollStatus
from app.schemas.payroll import (
    PayrollEntryListResponse,
    PayrollEntryResponseSchema,
    PayrollRunCreateSchema,
    PayrollRunDetailSchema,
    PayrollRunListResponse,
    PayrollRunResponseSchema,
)
from app.services import payroll_service
from app.utils.auth import get_current_user, require_role
from app.utils.pdf import build_payslip_context, render_payslip_pdf

router = APIRouter()


# ─── Static paths (must precede /{run_id}) ───────────────────────────────────

@router.get("/entries/me")
async def my_payroll_entries(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """Return the authenticated employee's own payroll entries, newest first."""
    offset = (page - 1) * limit

    total = await db.scalar(
        select(func.count()).select_from(PayrollEntry).where(PayrollEntry.employee_id == current_user.id)
    )

    result = await db.execute(
        select(PayrollEntry)
        .options(selectinload(PayrollEntry.employee))
        .where(PayrollEntry.employee_id == current_user.id)
        .order_by(PayrollEntry.period_year.desc(), PayrollEntry.period_month.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = result.scalars().all()

    return PayrollEntryListResponse(
        items=[PayrollEntryResponseSchema.model_validate(e) for e in entries],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total else 1,
    )


# ─── Collection endpoints ─────────────────────────────────────────────────────

@router.get("/")
async def list_payroll_runs(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    offset = (page - 1) * limit

    total = await db.scalar(select(func.count()).select_from(PayrollRun))

    result = await db.execute(
        select(PayrollRun)
        .order_by(PayrollRun.period_year.desc(), PayrollRun.period_month.desc(), PayrollRun.revision.desc())
        .offset(offset)
        .limit(limit)
    )
    runs = result.scalars().all()

    return PayrollRunListResponse(
        items=[PayrollRunResponseSchema.model_validate(r) for r in runs],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total else 1,
    )


@router.post("/", status_code=201)
async def create_payroll_run(
    payload: PayrollRunCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_role("super_admin", "hr_admin")),
):
    """
    Create a new DRAFT payroll run for the given period.
    If a PAID run already exists for the period, a new revision is created.
    If an active (non-PAID) run exists, reject — finish or archive it first.
    """
    # Find the highest existing revision for this period
    latest = await db.scalar(
        select(PayrollRun)
        .where(
            PayrollRun.period_year == payload.period_year,
            PayrollRun.period_month == payload.period_month,
        )
        .order_by(PayrollRun.revision.desc())
        .limit(1)
    )

    if latest is not None and latest.status != PayrollStatus.paid:
        raise HTTPException(
            status_code=409,
            detail=(
                f"An active run (revision {latest.revision}, status '{latest.status.value}') "
                f"already exists for {payload.period_year}-{payload.period_month:02d}. "
                "Complete or discard it before creating a new revision."
            ),
        )

    next_revision = (latest.revision + 1) if latest else 1

    run = PayrollRun(
        period_year=payload.period_year,
        period_month=payload.period_month,
        revision=next_revision,
        notes=payload.notes,
        created_by_id=current_user.id,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return {"data": PayrollRunResponseSchema.model_validate(run), "message": "Payroll run created"}


# ─── Single-run endpoints ─────────────────────────────────────────────────────

async def _get_run_or_404(run_id: UUID, db: AsyncSession) -> PayrollRun:
    run = await db.get(PayrollRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return run


@router.get("/{run_id}")
async def get_payroll_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    """Return run metadata plus all its entries (eager-loaded with employee snapshot)."""
    result = await db.execute(
        select(PayrollRun)
        .options(
            selectinload(PayrollRun.entries).selectinload(PayrollEntry.employee)
        )
        .where(PayrollRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    entries_data = [PayrollEntryResponseSchema.model_validate(e) for e in run.entries]
    total_gross = sum((e.gross_salary for e in run.entries), Decimal(0))
    total_net   = sum((e.net_salary   for e in run.entries), Decimal(0))

    detail = PayrollRunDetailSchema(
        **PayrollRunResponseSchema.model_validate(run).model_dump(),
        entries=entries_data,
        entry_count=len(entries_data),
        total_gross=total_gross,
        total_net=total_net,
    )
    return {"data": detail, "message": "OK"}


@router.post("/{run_id}/process")
async def process_payroll_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_role("super_admin", "hr_admin")),
):
    """Compute salary entries and advance the run from DRAFT → PROCESSED."""
    run = await _get_run_or_404(run_id, db)
    run = await payroll_service.process_run(db, run, current_user)
    from workers.notification_tasks import notify_payroll_processed
    notify_payroll_processed.delay(str(run.id))
    return {"data": PayrollRunResponseSchema.model_validate(run), "message": "Payroll run processed"}


@router.put("/{run_id}/approve")
async def approve_payroll_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_role("super_admin", "hr_admin")),
):
    """Advance the run from PROCESSED → APPROVED."""
    run = await _get_run_or_404(run_id, db)
    run = await payroll_service.approve_run(db, run, current_user)
    return {"data": PayrollRunResponseSchema.model_validate(run), "message": "Payroll run approved"}


@router.put("/{run_id}/mark-paid")
async def mark_payroll_paid(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    """Advance the run from APPROVED → PAID."""
    run = await _get_run_or_404(run_id, db)
    run = await payroll_service.mark_paid(db, run)
    from workers.notification_tasks import notify_payroll_paid
    notify_payroll_paid.delay(str(run.id))
    return {"data": PayrollRunResponseSchema.model_validate(run), "message": "Payroll run marked as paid"}


@router.get("/{run_id}/entries")
async def list_run_entries(
    run_id: UUID,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    """Paginated list of salary entries for a specific run."""
    await _get_run_or_404(run_id, db)

    offset = (page - 1) * limit

    total = await db.scalar(
        select(func.count()).select_from(PayrollEntry).where(PayrollEntry.payroll_run_id == run_id)
    )

    result = await db.execute(
        select(PayrollEntry)
        .options(selectinload(PayrollEntry.employee))
        .where(PayrollEntry.payroll_run_id == run_id)
        .order_by(PayrollEntry.created_at)
        .offset(offset)
        .limit(limit)
    )
    entries = result.scalars().all()

    return PayrollEntryListResponse(
        items=[PayrollEntryResponseSchema.model_validate(e) for e in entries],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total else 1,
    )


@router.get("/{run_id}/entries/{entry_id}/payslip")
async def get_payslip(
    run_id: UUID,
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """
    Stream a payslip PDF for a single payroll entry.
    Employees can only download their own payslip; HR/super_admin can access any.
    """
    result = await db.execute(
        select(PayrollEntry)
        .options(
            selectinload(PayrollEntry.employee).selectinload(Employee.department),
            selectinload(PayrollEntry.payroll_run),
        )
        .where(
            PayrollEntry.id == entry_id,
            PayrollEntry.payroll_run_id == run_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Payroll entry not found")

    if current_user.role not in ("super_admin", "hr_admin"):
        if entry.employee_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Fetch active deduction rules for name labels in the PDF
    rules_result = await db.execute(select(DeductionRule))
    deduction_rules = list(rules_result.scalars().all())

    context = build_payslip_context(entry, deduction_rules)
    pdf_bytes = await render_payslip_pdf(context)

    emp_name = (entry.employee.full_name or "employee").replace(" ", "_") if entry.employee else "employee"
    filename = f"payslip_{emp_name}_{entry.period_year}_{calendar.month_abbr[entry.period_month]}.pdf"

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
