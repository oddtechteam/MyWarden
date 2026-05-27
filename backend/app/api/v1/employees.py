import asyncio
import datetime
import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal, get_db
from app.models.employee import Employee, EmployeeType
from app.schemas.employee import EmployeeCreateSchema, EmployeeResponseSchema, EmployeeSelfUpdateSchema, EmployeeUpdateSchema
from app.utils.auth import get_current_user, hash_password, require_role

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Employee list ─────────────────────────────────────────────────────────

@router.get("/")
async def list_employees(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    department_id: UUID | None = Query(None),
    employee_type: EmployeeType | None = Query(None),
    is_active: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin", "manager")),
):
    base = select(Employee).options(selectinload(Employee.department))

    if search:
        base = base.where(
            Employee.full_name.ilike(f"%{search}%") | Employee.email.ilike(f"%{search}%")
        )
    if department_id:
        base = base.where(Employee.department_id == department_id)
    if employee_type:
        base = base.where(Employee.employee_type == employee_type)
    if is_active is not None:
        base = base.where(Employee.is_active == is_active)
    else:
        base = base.where(Employee.is_active.is_(True))

    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(
        base.order_by(Employee.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )
    employees = result.scalars().all()

    return {
        "data": {
            "items": [EmployeeResponseSchema.model_validate(e) for e in employees],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, (total + limit - 1) // limit),
        },
        "message": "OK",
    }


# ─── Create ────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_employee(
    payload: EmployeeCreateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    existing = await db.scalar(select(Employee).where(Employee.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    employee = Employee(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        job_title=payload.job_title,
        role=payload.role,
        employee_type=payload.employee_type,
        department_id=payload.department_id,
        join_date=payload.join_date,
        base_salary=payload.base_salary,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == employee.id)
    )
    return {"data": EmployeeResponseSchema.model_validate(result.scalar_one()), "message": "Employee created"}


# ─── Self-profile ──────────────────────────────────────────────────────────

@router.get("/me")
async def get_my_profile(
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == current_user.id)
    )
    return {"data": EmployeeResponseSchema.model_validate(result.scalar_one()), "message": "OK"}


# ─── Self-update ───────────────────────────────────────────────────────────

@router.put("/me")
async def update_my_profile(
    payload: EmployeeSelfUpdateSchema,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)

    await db.commit()

    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == current_user.id)
    )
    return {"data": EmployeeResponseSchema.model_validate(result.scalar_one()), "message": "Profile updated"}


# ─── Get one ───────────────────────────────────────────────────────────────

@router.get("/{employee_id}")
async def get_employee(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin", "manager")),
):
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == employee_id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"data": EmployeeResponseSchema.model_validate(employee), "message": "OK"}


# ─── Update ────────────────────────────────────────────────────────────────

@router.put("/{employee_id}")
async def update_employee(
    employee_id: UUID,
    payload: EmployeeUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    await db.commit()

    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == employee_id)
    )
    return {"data": EmployeeResponseSchema.model_validate(result.scalar_one()), "message": "Employee updated"}


# ─── Soft delete ───────────────────────────────────────────────────────────

@router.delete("/{employee_id}")
async def deactivate_employee(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee.is_active = False
    await db.commit()
    return {"data": None, "message": "Employee deactivated"}


# ─── Face enrollment ───────────────────────────────────────────────────────

@router.post("/{employee_id}/enroll-face", status_code=202)
async def enroll_face(
    employee_id: UUID,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    """
    Accept 8–10 JPEG frames captured from the webcam.
    Immediately returns 202; DeepFace embedding extraction runs in the background.
    Poll GET /employees/{id} and check face_enrolled == true to confirm completion.
    """
    if not (8 <= len(files) <= 10):
        raise HTTPException(status_code=422, detail="Provide between 8 and 10 frames for enrollment")

    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Employee not found")

    # Read all frame bytes now — UploadFile objects are invalid after the request ends
    frames: list[bytes] = [await f.read() for f in files]

    background_tasks.add_task(_run_enrollment, str(employee_id), frames)

    return {"data": None, "message": "Enrollment started — processing in background. Check face_enrolled status to confirm."}


async def _run_enrollment(employee_id: str, frames: list[bytes]) -> None:
    """Background task: extract embeddings, upload to S3, persist mean vector."""
    from app.services.face_service import average_embeddings, extract_embedding
    from app.utils.storage import upload_bytes

    embeddings: list[list[float]] = []

    for i, frame in enumerate(frames):
        ts = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%S") + f"_{i:02d}"
        key = f"enrollments/{employee_id}/{ts}.jpg"

        # Upload raw photo (best-effort — don't abort enrollment on S3 failure)
        try:
            await asyncio.to_thread(upload_bytes, frame, key)
        except Exception as exc:
            logger.warning("S3 upload failed for frame %d: %s", i, exc)

        # Extract embedding
        emb = await extract_embedding(frame)
        if emb is not None:
            embeddings.append(emb)
        else:
            logger.debug("No face detected in enrollment frame %d — skipping", i)

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Employee).where(Employee.id == employee_id))
        employee = result.scalar_one_or_none()
        if not employee:
            return

        if embeddings:
            employee.face_embedding = average_embeddings(embeddings)
            employee.face_enrolled = True
            logger.info(
                "Enrollment complete for employee %s — averaged %d/%d frames",
                employee_id,
                len(embeddings),
                len(frames),
            )
        else:
            employee.face_enrolled = False
            logger.warning("Enrollment failed for employee %s — no valid faces detected", employee_id)

        await session.commit()
