from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.employee import Employee, EmployeeType
from app.schemas.employee import EmployeeCreateSchema, EmployeeResponseSchema, EmployeeUpdateSchema
from app.utils.auth import get_current_user, hash_password, require_role

router = APIRouter()


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


@router.get("/me")
async def get_my_profile(current_user: Employee = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == current_user.id)
    )
    return {"data": EmployeeResponseSchema.model_validate(result.scalar_one()), "message": "OK"}


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


@router.post("/{employee_id}/enroll-face")
async def enroll_face(employee_id: UUID):
    # TODO: Phase 1 Part 4 — face enrollment via DeepFace
    raise HTTPException(status_code=501, detail="Face enrollment not yet implemented")
