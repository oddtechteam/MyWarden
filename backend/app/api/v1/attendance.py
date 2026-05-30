"""
Attendance API.

Kiosk v2 endpoints (super-admin face-gated):
  POST /kiosk/auth  — verify super admin face, returns kiosk JWT
  POST /kiosk/stamp — auto check-in OR check-out (requires kiosk JWT)

Kiosk v1 endpoints (no JWT, face IS the auth — kept for compatibility):
  POST /checkin   — identify employee by face and stamp check-in
  POST /checkout  — identify employee by face and stamp check-out

Protected endpoints:
  GET  /          — list logs (hr_admin, super_admin, manager)
  GET  /me        — own logs (any authenticated employee)
  GET  /{log_id}  — single log (hr_admin, super_admin)
  PATCH/{log_id}  — HR manual correction (hr_admin, super_admin)
"""
import asyncio
import datetime
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.attendance import AttendanceLog, AttendanceStatus, CheckInMethod
from app.models.employee import Employee, UserRole
from app.models.shift import Shift
from app.schemas.attendance import (
    AttendanceLogResponseSchema,
    AttendanceLogUpdateSchema,
    CheckinResponseSchema,
)
from app.config import settings
from app.services import attendance_service
from app.services.face_service import extract_embedding
from app.utils.auth import create_kiosk_token, get_current_user, require_role, verify_kiosk_token, verify_password
from app.utils.storage import upload_bytes

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ────────────────────────────────────────────────────────────────

async def _extract_or_422(file: UploadFile) -> tuple[list[float], bytes]:
    """Read frame bytes, extract embedding, raise 422 if no face detected."""
    frame = await file.read()
    embedding = await extract_embedding(frame)
    if embedding is None:
        raise HTTPException(status_code=422, detail="Could not detect a face in the provided frame")
    return embedding, frame


async def _match_or_404(db: AsyncSession, embedding: list[float]) -> Employee:
    employee = await attendance_service.match_face_in_db(db, embedding)
    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="No matching employee found. Please try again or use OTP fallback.",
        )
    return employee


def _build_kiosk_response(
    log: AttendanceLog,
    employee: Employee,
    shift: Optional[Shift],
) -> CheckinResponseSchema:
    return CheckinResponseSchema(
        log_id=log.id,
        employee_id=employee.id,
        employee_name=employee.full_name,
        work_date=log.work_date,
        check_in_at=log.check_in_at,
        check_out_at=log.check_out_at,
        status=log.status,
        shift_name=shift.name if shift else None,
    )


# ─── POST /checkin ──────────────────────────────────────────────────────────

@router.post("/checkin", status_code=200)
async def face_checkin(
    file: UploadFile = File(..., description="Single JPEG frame from webcam"),
    db: AsyncSession = Depends(get_db),
):
    """
    Kiosk check-in — no authentication required.
    Accepts a single webcam frame, matches the face, and records check-in.
    Returns the attendance log and a welcome message for the kiosk display.
    """
    embedding, frame = await _extract_or_422(file)
    employee = await _match_or_404(db, embedding)

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    work_date = now_utc.date()

    existing = await attendance_service.get_todays_log(db, str(employee.id), work_date)
    if existing and existing.check_in_at is not None:
        raise HTTPException(status_code=409, detail=f"{employee.full_name} is already checked in today")

    shift = await attendance_service.find_active_shift(db, now_utc)

    # Upload frame to S3/local storage (best-effort — don't abort on failure)
    photo_key: Optional[str] = None
    try:
        ts = now_utc.strftime("%Y%m%dT%H%M%S")
        photo_key = f"checkins/{employee.id}/{work_date}/{ts}.jpg"
        await asyncio.to_thread(upload_bytes, frame, photo_key)
    except Exception as exc:
        logger.warning("Failed to upload check-in photo for employee %s: %s", employee.id, exc)

    log = await attendance_service.record_checkin(
        db, str(employee.id), now_utc, CheckInMethod.face, photo_key, shift
    )

    status_label = "on time" if log.status == AttendanceStatus.present else "late"
    message = f"Welcome, {employee.full_name}! Checked in at {now_utc.strftime('%H:%M')} UTC ({status_label})."

    return {"data": _build_kiosk_response(log, employee, shift), "message": message}


# ─── POST /checkout ─────────────────────────────────────────────────────────

@router.post("/checkout", status_code=200)
async def face_checkout(
    file: UploadFile = File(..., description="Single JPEG frame from webcam"),
    db: AsyncSession = Depends(get_db),
):
    """
    Kiosk check-out — no authentication required.
    Matches the face, finds today's open log, and stamps check-out time.
    """
    embedding, _ = await _extract_or_422(file)
    employee = await _match_or_404(db, embedding)

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    work_date = now_utc.date()

    log = await attendance_service.get_todays_log(db, str(employee.id), work_date)
    if log is None or log.check_in_at is None:
        raise HTTPException(status_code=422, detail=f"{employee.full_name} has not checked in today")
    if log.check_out_at is not None:
        raise HTTPException(status_code=409, detail=f"{employee.full_name} has already checked out today")

    shift_result = None
    if log.shift_id:
        shift_result = await db.get(Shift, log.shift_id)

    log = await attendance_service.record_checkout(db, log, now_utc, CheckInMethod.face)
    message = f"Goodbye, {employee.full_name}! Checked out at {now_utc.strftime('%H:%M')} UTC."

    return {"data": _build_kiosk_response(log, employee, shift_result), "message": message}


# ─── POST /kiosk/auth — super admin credential verification ─────────────────

@router.post("/kiosk/auth", status_code=200)
async def kiosk_auth(
    email: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Kiosk unlock — no JWT required.
    Accepts super_admin email + password, returns a short-lived kiosk JWT.
    """
    result = await db.execute(
        select(Employee)
        .where(Employee.email == email)
        .where(Employee.is_active.is_(True))
    )
    admin = result.scalar_one_or_none()

    if admin is None or not verify_password(password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if admin.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only Super Admins can unlock the kiosk.")

    token = create_kiosk_token(str(admin.id))
    return {
        "data": {"kiosk_token": token, "admin_name": admin.full_name},
        "message": f"Kiosk unlocked by {admin.full_name}.",
    }


# ─── POST /kiosk/stamp — auto check-in or check-out ────────────────────────

@router.post("/kiosk/stamp", status_code=200)
async def kiosk_stamp(
    file: UploadFile = File(..., description="Single JPEG frame from webcam"),
    db: AsyncSession = Depends(get_db),
    _kiosk_admin_id: str = Depends(verify_kiosk_token),
):
    """
    Kiosk attendance stamp — requires a valid kiosk JWT.
    Automatically determines check-in vs check-out:
      - No log today          → check-in
      - Open log (no checkout) → check-out
      - Completed log         → 409 already done
    """
    embedding, frame = await _extract_or_422(file)
    employee = await _match_or_404(db, embedding)

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    work_date = now_utc.date()

    log = await attendance_service.get_todays_log(db, str(employee.id), work_date)

    if log is None or log.check_in_at is None:
        # ── Check-in path ──────────────────────────────────────────────────
        shift = await attendance_service.find_active_shift(db, now_utc)

        photo_key: Optional[str] = None
        try:
            ts = now_utc.strftime("%Y%m%dT%H%M%S")
            photo_key = f"checkins/{employee.id}/{work_date}/{ts}.jpg"
            await asyncio.to_thread(upload_bytes, frame, photo_key)
        except Exception as exc:
            logger.warning("Failed to upload kiosk check-in photo for %s: %s", employee.id, exc)

        log = await attendance_service.record_checkin(
            db, str(employee.id), now_utc, CheckInMethod.face, photo_key, shift
        )
        status_label = "on time" if log.status == AttendanceStatus.present else "late"
        message = f"Welcome, {employee.full_name}! Checked in at {now_utc.strftime('%H:%M')} UTC ({status_label})."
        return {
            "data": {**_build_kiosk_response(log, employee, shift).model_dump(), "action": "checkin"},
            "message": message,
        }

    if log.check_out_at is None:
        # ── Check-out path ─────────────────────────────────────────────────
        shift_result = None
        if log.shift_id:
            shift_result = await db.get(Shift, log.shift_id)

        log = await attendance_service.record_checkout(db, log, now_utc, CheckInMethod.face)
        message = f"Goodbye, {employee.full_name}! Checked out at {now_utc.strftime('%H:%M')} UTC."
        return {
            "data": {**_build_kiosk_response(log, employee, shift_result).model_dump(), "action": "checkout"},
            "message": message,
        }

    # ── Both timestamps already recorded ──────────────────────────────────
    raise HTTPException(
        status_code=409,
        detail=f"{employee.full_name} has already completed attendance for today.",
    )


# ─── GET / — list logs ──────────────────────────────────────────────────────

@router.get("/")
async def list_attendance_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    employee_id: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = Query(None),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None),
    status: Optional[AttendanceStatus] = Query(None),
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("super_admin", "hr_admin", "manager"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Managers are scoped to their own department only
    if current_user.role.value == "manager":
        if department_id and department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Managers can only view their own department")
        department_id = current_user.department_id

    base = select(AttendanceLog)

    if employee_id:
        base = base.where(AttendanceLog.employee_id == employee_id)
    if department_id:
        base = base.join(Employee, AttendanceLog.employee_id == Employee.id).where(
            Employee.department_id == department_id
        )
    if date_from:
        base = base.where(AttendanceLog.work_date >= date_from)
    if date_to:
        base = base.where(AttendanceLog.work_date <= date_to)
    if status:
        base = base.where(AttendanceLog.status == status)

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(
        base.options(selectinload(AttendanceLog.employee))
        .order_by(AttendanceLog.work_date.desc(), AttendanceLog.check_in_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    logs = result.scalars().all()

    return {
        "data": {
            "items": [AttendanceLogResponseSchema.model_validate(log) for log in logs],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
        },
        "message": "OK",
    }


# ─── GET /me — own attendance ────────────────────────────────────────────────

@router.get("/me")
async def get_my_attendance(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    date_from: Optional[datetime.date] = Query(None),
    date_to: Optional[datetime.date] = Query(None),
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(AttendanceLog).where(AttendanceLog.employee_id == current_user.id)
    if date_from:
        base = base.where(AttendanceLog.work_date >= date_from)
    if date_to:
        base = base.where(AttendanceLog.work_date <= date_to)

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(
        base.options(selectinload(AttendanceLog.employee))
        .order_by(AttendanceLog.work_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    logs = result.scalars().all()

    return {
        "data": {
            "items": [AttendanceLogResponseSchema.model_validate(log) for log in logs],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
        },
        "message": "OK",
    }


# ─── GET /{log_id} ──────────────────────────────────────────────────────────

@router.get("/{log_id}")
async def get_attendance_log(
    log_id: UUID,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await db.get(AttendanceLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Attendance log not found")

    # Employee can only view their own log
    if current_user.role.value == "employee" and log.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Manager can only view their department's logs
    if current_user.role.value == "manager":
        emp = await db.get(Employee, log.employee_id)
        if emp and emp.department_id != current_user.department_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    return {"data": AttendanceLogResponseSchema.model_validate(log), "message": "OK"}


# ─── PATCH /{log_id} — HR manual correction ──────────────────────────────────

@router.patch("/{log_id}")
async def update_attendance_log(
    log_id: UUID,
    payload: AttendanceLogUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    log = await db.get(AttendanceLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Attendance log not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(log, field, value)

    await db.commit()
    await db.refresh(log)
    return {"data": AttendanceLogResponseSchema.model_validate(log), "message": "Attendance log updated"}
