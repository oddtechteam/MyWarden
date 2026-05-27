"""
Attendance business logic.

Check-in flow:
  1. Extract embedding from webcam frame (face_service)
  2. match_face_in_db — pgvector cosine distance query, returns matched Employee or None
  3. find_active_shift — find which shift window the current time falls in
  4. compute_status — present vs late based on grace period
  5. record_checkin — write AttendanceLog row

Check-out flow:
  1. Same face match
  2. Locate today's open log for the matched employee
  3. record_checkout — stamp check_out_at
"""
import datetime
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.attendance import AttendanceLog, AttendanceStatus, CheckInMethod
from app.models.employee import Employee
from app.models.shift import Shift

logger = logging.getLogger(__name__)


def _time_to_minutes(t: datetime.time) -> int:
    return t.hour * 60 + t.minute


# ─── Face matching ──────────────────────────────────────────────────────────

async def match_face_in_db(
    db: AsyncSession,
    probe_embedding: list[float],
) -> Optional[Employee]:
    """
    Query pgvector for the enrolled employee whose face_embedding is closest
    (cosine distance) to probe_embedding.
    Returns the Employee if similarity >= FACE_MATCH_THRESHOLD, else None.
    """
    distance_expr = Employee.face_embedding.cosine_distance(probe_embedding)
    result = await db.execute(
        select(Employee, distance_expr.label("distance"))
        .where(Employee.face_enrolled.is_(True))
        .where(Employee.is_active.is_(True))
        .order_by(distance_expr)
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None

    employee, distance = row
    similarity = 1.0 - float(distance)
    logger.debug("Best face match: %s  similarity=%.4f", employee.id, similarity)
    return employee if similarity >= settings.FACE_MATCH_THRESHOLD else None


# ─── Shift detection ────────────────────────────────────────────────────────

async def find_active_shift(
    db: AsyncSession,
    at_time: datetime.datetime,
) -> Optional[Shift]:
    """
    Return the Shift whose window contains at_time (UTC).
    Handles midnight-crossing shifts (end_time < start_time).
    Falls back to the most recently started shift (within 8 hours) if none is active.
    """
    current_m = _time_to_minutes(at_time.time())
    result = await db.execute(
        select(Shift).where(Shift.is_active.is_(True)).order_by(Shift.start_time)
    )
    shifts = result.scalars().all()

    for shift in shifts:
        s, e = _time_to_minutes(shift.start_time), _time_to_minutes(shift.end_time)
        if s <= e:
            if s <= current_m <= e:
                return shift
        else:
            # midnight-crossing: e.g. 22:00 → 06:00
            if current_m >= s or current_m <= e:
                return shift

    # Fallback: most recently started shift within 8 hours
    best: Optional[Shift] = None
    best_gap = 8 * 60
    for shift in shifts:
        s = _time_to_minutes(shift.start_time)
        gap = (current_m - s) % (24 * 60)
        if gap < best_gap:
            best_gap = gap
            best = shift
    return best


# ─── Status computation ─────────────────────────────────────────────────────

def compute_status(
    shift: Optional[Shift],
    check_in_at: datetime.datetime,
) -> AttendanceStatus:
    """
    present  → checked in within the grace window
    late     → checked in after grace_minutes past shift start
    If no shift is assigned, always mark as present.
    """
    if shift is None:
        return AttendanceStatus.present

    shift_start_m = _time_to_minutes(shift.start_time)
    cutoff_m = shift_start_m + shift.grace_minutes
    check_in_m = _time_to_minutes(check_in_at.time())
    return AttendanceStatus.present if check_in_m <= cutoff_m else AttendanceStatus.late


# ─── Record check-in ────────────────────────────────────────────────────────

async def record_checkin(
    db: AsyncSession,
    employee_id: str,
    check_in_at: datetime.datetime,
    method: CheckInMethod,
    photo_key: Optional[str],
    shift: Optional[Shift],
) -> AttendanceLog:
    log = AttendanceLog(
        employee_id=employee_id,
        shift_id=shift.id if shift else None,
        work_date=check_in_at.date(),
        check_in_at=check_in_at,
        check_in_method=method,
        check_in_photo_key=photo_key,
        status=compute_status(shift, check_in_at),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


# ─── Record check-out ───────────────────────────────────────────────────────

async def record_checkout(
    db: AsyncSession,
    log: AttendanceLog,
    check_out_at: datetime.datetime,
    method: CheckInMethod,
) -> AttendanceLog:
    log.check_out_at = check_out_at
    log.check_out_method = method
    await db.commit()
    await db.refresh(log)
    return log


# ─── Fetch today's open log ─────────────────────────────────────────────────

async def get_todays_log(
    db: AsyncSession,
    employee_id: str,
    work_date: datetime.date,
) -> Optional[AttendanceLog]:
    result = await db.execute(
        select(AttendanceLog).where(
            AttendanceLog.employee_id == employee_id,
            AttendanceLog.work_date == work_date,
        )
    )
    return result.scalar_one_or_none()
