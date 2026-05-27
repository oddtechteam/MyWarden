"""
Leave business logic.

Balance lifecycle:
  - Auto-created on first apply (seeded from leave_type.days_per_year).
  - HR can override allocated/used via the balance endpoint.
  - Balance is deducted only on APPROVAL, not on submission.
  - Cancelling an approved request restores the deducted days.

Day counting:
  - Calendar days (inclusive) for now.
  - TODO: exclude weekends/public holidays once a company calendar is available.
"""
import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.models.leave import LeaveBalance, LeaveRequest, LeaveStatus, LeaveType
from app.schemas.leave import LeaveRequestCreateSchema, LeaveRequestReviewSchema


def calculate_days(start_date: datetime.date, end_date: datetime.date) -> Decimal:
    return Decimal((end_date - start_date).days + 1)


async def _get_or_create_balance(
    db: AsyncSession,
    employee_id: UUID,
    leave_type: LeaveType,
    year: int,
) -> LeaveBalance:
    """
    Fetch the balance row for (employee, leave_type, year).
    Auto-creates one seeded from leave_type.days_per_year on first access.
    """
    result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type_id == leave_type.id,
            LeaveBalance.year == year,
        )
    )
    balance = result.scalar_one_or_none()
    if balance is None:
        balance = LeaveBalance(
            employee_id=employee_id,
            leave_type_id=leave_type.id,
            year=year,
            allocated=Decimal(leave_type.days_per_year),
            used=Decimal(0),
        )
        db.add(balance)
        await db.flush()
    return balance


# ─── Apply ──────────────────────────────────────────────────────────────────

async def apply_leave(
    db: AsyncSession,
    employee: Employee,
    payload: LeaveRequestCreateSchema,
) -> LeaveRequest:
    leave_type = await db.get(LeaveType, payload.leave_type_id)
    if not leave_type or not leave_type.is_active:
        raise HTTPException(status_code=404, detail="Leave type not found or inactive")

    days = calculate_days(payload.start_date, payload.end_date)
    year = payload.start_date.year

    # Reject overlapping pending/approved requests
    overlap = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.status.in_([LeaveStatus.pending, LeaveStatus.approved]),
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
        )
    )
    if overlap.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="An overlapping leave request already exists for this period",
        )

    balance = await _get_or_create_balance(db, employee.id, leave_type, year)
    remaining = balance.allocated - balance.used
    if days > remaining:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient balance. Requested: {days} day(s), remaining: {remaining} day(s)",
        )

    request = LeaveRequest(
        employee_id=employee.id,
        leave_type_id=leave_type.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        days_requested=days,
        reason=payload.reason,
        status=LeaveStatus.pending,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


# ─── Review (approve / reject) ──────────────────────────────────────────────

async def review_leave(
    db: AsyncSession,
    request: LeaveRequest,
    reviewer: Employee,
    payload: LeaveRequestReviewSchema,
) -> LeaveRequest:
    if request.status != LeaveStatus.pending:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot review a request already in '{request.status.value}' status",
        )

    if payload.status == LeaveStatus.approved:
        leave_type = await db.get(LeaveType, request.leave_type_id)
        balance = await _get_or_create_balance(
            db, request.employee_id, leave_type, request.start_date.year
        )
        remaining = balance.allocated - balance.used
        if request.days_requested > remaining:
            raise HTTPException(
                status_code=422,
                detail=f"Employee has insufficient balance to approve. Remaining: {remaining} day(s)",
            )
        balance.used += request.days_requested

    request.status = payload.status
    request.reviewed_by_id = reviewer.id
    request.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
    request.review_note = payload.review_note

    await db.commit()
    await db.refresh(request)
    return request


# ─── Cancel ─────────────────────────────────────────────────────────────────

async def cancel_leave(
    db: AsyncSession,
    request: LeaveRequest,
) -> LeaveRequest:
    if request.status == LeaveStatus.cancelled:
        raise HTTPException(status_code=409, detail="Request is already cancelled")
    if request.status == LeaveStatus.rejected:
        raise HTTPException(status_code=409, detail="Cannot cancel a rejected request")

    if request.status == LeaveStatus.approved:
        result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == request.employee_id,
                LeaveBalance.leave_type_id == request.leave_type_id,
                LeaveBalance.year == request.start_date.year,
            )
        )
        balance = result.scalar_one_or_none()
        if balance:
            balance.used = max(Decimal(0), balance.used - request.days_requested)

    request.status = LeaveStatus.cancelled
    await db.commit()
    await db.refresh(request)
    return request
