"""
Leave API — mounted at /api/v1/leave

Leave types   (HR manages):
  GET  /types                         — list active leave types
  POST /types                         — create leave type
  PUT  /types/{type_id}               — update leave type

Leave balances (HR manages, employees view own):
  GET  /balances                      — HR: all; manager: their dept; employee: own
  GET  /balances/me                   — own balances for the current year
  POST /balances                      — HR creates/resets a balance entry
  PUT  /balances/{balance_id}         — HR adjusts allocated or used count

Leave requests:
  POST /apply                         — employee submits request
  GET  /                              — HR: all; manager: dept; employee: own
  GET  /{request_id}                  — get single (access-controlled)
  PUT  /{request_id}/approve          — manager / HR approve
  PUT  /{request_id}/reject           — manager / HR reject
  PUT  /{request_id}/cancel           — employee cancels own pending/approved request

IMPORTANT: all static paths (/types, /balances, /apply) must be defined before
/{request_id} so FastAPI does not mistakenly treat them as UUID parameters.
"""
import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.employee import Employee
from app.models.leave import LeaveBalance, LeaveRequest, LeaveStatus, LeaveType
from app.schemas.leave import (
    LeaveBalanceAdjustSchema,
    LeaveBalanceCreateSchema,
    LeaveBalanceResponseSchema,
    LeaveRequestCreateSchema,
    LeaveRequestResponseSchema,
    LeaveRequestReviewSchema,
    LeaveReviewNoteSchema,
    LeaveTypeCreateSchema,
    LeaveTypeResponseSchema,
    LeaveTypeUpdateSchema,
)
from app.services import leave_service
from app.utils.auth import get_current_user, require_role

router = APIRouter()


# ─── Helpers ────────────────────────────────────────────────────────────────

async def _load_request(db: AsyncSession, request_id: UUID) -> LeaveRequest:
    result = await db.execute(
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.employee),
        )
        .where(LeaveRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return req


async def _load_balance(db: AsyncSession, balance_id: UUID) -> LeaveBalance:
    result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(LeaveBalance.id == balance_id)
    )
    bal = result.scalar_one_or_none()
    if not bal:
        raise HTTPException(status_code=404, detail="Leave balance not found")
    return bal


# ════════════════════════════════════════════════════════════════════════════
# LEAVE TYPES
# ════════════════════════════════════════════════════════════════════════════

@router.get("/types")
async def list_leave_types(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    stmt = select(LeaveType)
    if not include_inactive:
        stmt = stmt.where(LeaveType.is_active.is_(True))
    result = await db.execute(stmt.order_by(LeaveType.name))
    types = result.scalars().all()
    return {"data": [LeaveTypeResponseSchema.model_validate(t) for t in types], "message": "OK"}


@router.post("/types", status_code=201)
async def create_leave_type(
    payload: LeaveTypeCreateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    existing = await db.scalar(
        select(LeaveType).where(
            (LeaveType.name == payload.name) | (LeaveType.code == payload.code.upper())
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="A leave type with this name or code already exists")

    leave_type = LeaveType(
        name=payload.name,
        code=payload.code.upper(),
        days_per_year=payload.days_per_year,
        is_paid=payload.is_paid,
    )
    db.add(leave_type)
    await db.commit()
    await db.refresh(leave_type)
    return {"data": LeaveTypeResponseSchema.model_validate(leave_type), "message": "Leave type created"}


@router.put("/types/{type_id}")
async def update_leave_type(
    type_id: UUID,
    payload: LeaveTypeUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    leave_type = await db.get(LeaveType, type_id)
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(leave_type, field, value)

    await db.commit()
    await db.refresh(leave_type)
    return {"data": LeaveTypeResponseSchema.model_validate(leave_type), "message": "Leave type updated"}


# ════════════════════════════════════════════════════════════════════════════
# LEAVE BALANCES
# ════════════════════════════════════════════════════════════════════════════

@router.get("/balances/me")
async def get_my_balances(
    year: int = Query(default=None),
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target_year = year or datetime.date.today().year
    result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(
            LeaveBalance.employee_id == current_user.id,
            LeaveBalance.year == target_year,
        )
    )
    balances = result.scalars().all()
    return {
        "data": [LeaveBalanceResponseSchema.model_validate(b) for b in balances],
        "message": "OK",
    }


@router.get("/balances")
async def list_balances(
    employee_id: Optional[UUID] = Query(None),
    leave_type_id: Optional[UUID] = Query(None),
    year: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = current_user.role.value

    # Employees can only see their own balance
    if role == "employee":
        employee_id = current_user.id

    base = select(LeaveBalance).options(selectinload(LeaveBalance.leave_type))

    if employee_id:
        base = base.where(LeaveBalance.employee_id == employee_id)
    if leave_type_id:
        base = base.where(LeaveBalance.leave_type_id == leave_type_id)
    if year:
        base = base.where(LeaveBalance.year == year)

    # Managers scoped to their department
    if role == "manager":
        base = base.join(Employee, LeaveBalance.employee_id == Employee.id).where(
            Employee.department_id == current_user.department_id
        )

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(
        base.order_by(LeaveBalance.year.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    balances = result.scalars().all()

    return {
        "data": {
            "items": [LeaveBalanceResponseSchema.model_validate(b) for b in balances],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
        },
        "message": "OK",
    }


@router.post("/balances", status_code=201)
async def create_balance(
    payload: LeaveBalanceCreateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    """HR manually sets (or resets) a leave balance for an employee."""
    existing = await db.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == payload.employee_id,
            LeaveBalance.leave_type_id == payload.leave_type_id,
            LeaveBalance.year == payload.year,
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A balance entry already exists for this employee/type/year. Use PUT to adjust it.",
        )

    balance = LeaveBalance(
        employee_id=payload.employee_id,
        leave_type_id=payload.leave_type_id,
        year=payload.year,
        allocated=payload.allocated,
        used=0,
    )
    db.add(balance)
    await db.commit()

    loaded = await _load_balance(db, balance.id)
    return {"data": LeaveBalanceResponseSchema.model_validate(loaded), "message": "Balance created"}


@router.put("/balances/{balance_id}")
async def adjust_balance(
    balance_id: UUID,
    payload: LeaveBalanceAdjustSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    balance = await db.get(LeaveBalance, balance_id)
    if not balance:
        raise HTTPException(status_code=404, detail="Leave balance not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(balance, field, value)

    await db.commit()
    loaded = await _load_balance(db, balance_id)
    return {"data": LeaveBalanceResponseSchema.model_validate(loaded), "message": "Balance updated"}


# ════════════════════════════════════════════════════════════════════════════
# LEAVE REQUESTS
# ════════════════════════════════════════════════════════════════════════════

@router.post("/apply", status_code=201)
async def apply_leave(
    payload: LeaveRequestCreateSchema,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    request = await leave_service.apply_leave(db, current_user, payload)
    loaded = await _load_request(db, request.id)
    return {"data": LeaveRequestResponseSchema.model_validate(loaded), "message": "Leave request submitted"}


@router.get("/")
async def list_leave_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[LeaveStatus] = Query(None),
    employee_id: Optional[UUID] = Query(None),
    leave_type_id: Optional[UUID] = Query(None),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None),
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    role = current_user.role.value

    base = select(LeaveRequest).options(
        selectinload(LeaveRequest.leave_type),
        selectinload(LeaveRequest.employee),
    )

    # Scope by role
    if role == "employee":
        base = base.where(LeaveRequest.employee_id == current_user.id)
    elif role == "manager":
        base = base.join(Employee, LeaveRequest.employee_id == Employee.id).where(
            Employee.department_id == current_user.department_id
        )
    # hr_admin / super_admin see everything

    if employee_id and role != "employee":
        base = base.where(LeaveRequest.employee_id == employee_id)
    if leave_type_id:
        base = base.where(LeaveRequest.leave_type_id == leave_type_id)
    if status:
        base = base.where(LeaveRequest.status == status)
    if date_from:
        base = base.where(LeaveRequest.start_date >= date_from)
    if date_to:
        base = base.where(LeaveRequest.end_date <= date_to)

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(
        base.order_by(LeaveRequest.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    requests = result.scalars().all()

    return {
        "data": {
            "items": [LeaveRequestResponseSchema.model_validate(r) for r in requests],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
        },
        "message": "OK",
    }


@router.get("/{request_id}")
async def get_leave_request(
    request_id: UUID,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = await _load_request(db, request_id)

    role = current_user.role.value
    if role == "employee" and req.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if role == "manager":
        emp = await db.get(Employee, req.employee_id)
        if emp and emp.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    return {"data": LeaveRequestResponseSchema.model_validate(req), "message": "OK"}


@router.put("/{request_id}/approve")
async def approve_leave(
    request_id: UUID,
    payload: LeaveReviewNoteSchema,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin", "manager")),
):
    req = await _load_request(db, request_id)

    if current_user.role.value == "manager":
        emp = await db.get(Employee, req.employee_id)
        if emp and emp.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    review = LeaveRequestReviewSchema(status=LeaveStatus.approved, review_note=payload.review_note)
    req = await leave_service.review_leave(db, req, current_user, review)
    loaded = await _load_request(db, req.id)
    return {"data": LeaveRequestResponseSchema.model_validate(loaded), "message": "Leave request approved"}


@router.put("/{request_id}/reject")
async def reject_leave(
    request_id: UUID,
    payload: LeaveReviewNoteSchema,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin", "manager")),
):
    req = await _load_request(db, request_id)

    if current_user.role.value == "manager":
        emp = await db.get(Employee, req.employee_id)
        if emp and emp.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    review = LeaveRequestReviewSchema(status=LeaveStatus.rejected, review_note=payload.review_note)
    req = await leave_service.review_leave(db, req, current_user, review)
    loaded = await _load_request(db, req.id)
    return {"data": LeaveRequestResponseSchema.model_validate(loaded), "message": "Leave request rejected"}


@router.put("/{request_id}/cancel")
async def cancel_leave(
    request_id: UUID,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = await _load_request(db, request_id)

    # Only the requesting employee can cancel their own request
    if req.employee_id != current_user.id and current_user.role.value not in ("super_admin", "hr_admin"):
        raise HTTPException(status_code=403, detail="You can only cancel your own leave requests")

    req = await leave_service.cancel_leave(db, req)
    loaded = await _load_request(db, req.id)
    return {"data": LeaveRequestResponseSchema.model_validate(loaded), "message": "Leave request cancelled"}
