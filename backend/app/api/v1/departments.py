from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.department import Department
from app.schemas.department import DepartmentCreateSchema, DepartmentResponseSchema, DepartmentUpdateSchema
from app.utils.auth import require_role

router = APIRouter()


@router.get("/")
async def list_departments(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin", "manager")),
):
    result = await db.execute(
        select(Department).where(Department.is_active.is_(True)).order_by(Department.name)
    )
    departments = result.scalars().all()
    return {"data": [DepartmentResponseSchema.model_validate(d) for d in departments], "message": "OK"}


@router.post("/", status_code=201)
async def create_department(
    payload: DepartmentCreateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    existing = await db.scalar(select(Department).where(Department.name == payload.name))
    if existing:
        raise HTTPException(status_code=409, detail="Department already exists")

    dept = Department(name=payload.name, description=payload.description)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return {"data": DepartmentResponseSchema.model_validate(dept), "message": "Department created"}


@router.put("/{dept_id}")
async def update_department(
    dept_id: UUID,
    payload: DepartmentUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)

    await db.commit()
    await db.refresh(dept)
    return {"data": DepartmentResponseSchema.model_validate(dept), "message": "Department updated"}


@router.delete("/{dept_id}")
async def deactivate_department(
    dept_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    dept.is_active = False
    await db.commit()
    return {"data": None, "message": "Department deactivated"}
