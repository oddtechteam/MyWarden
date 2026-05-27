from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.shift import Shift
from app.schemas.attendance import ShiftCreateSchema, ShiftResponseSchema, ShiftUpdateSchema
from app.utils.auth import get_current_user, require_role

router = APIRouter()


@router.post("/", status_code=201)
async def create_shift(
    payload: ShiftCreateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    existing = await db.scalar(select(Shift).where(Shift.name == payload.name))
    if existing:
        raise HTTPException(status_code=409, detail="A shift with this name already exists")

    shift = Shift(**payload.model_dump())
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return {"data": ShiftResponseSchema.model_validate(shift), "message": "Shift created"}


@router.get("/")
async def list_shifts(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    stmt = select(Shift)
    if active_only:
        stmt = stmt.where(Shift.is_active.is_(True))
    result = await db.execute(stmt.order_by(Shift.start_time))
    shifts = result.scalars().all()
    return {"data": [ShiftResponseSchema.model_validate(s) for s in shifts], "message": "OK"}


@router.get("/{shift_id}")
async def get_shift(
    shift_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    shift = await db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return {"data": ShiftResponseSchema.model_validate(shift), "message": "OK"}


@router.put("/{shift_id}")
async def update_shift(
    shift_id: UUID,
    payload: ShiftUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    shift = await db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(shift, field, value)

    await db.commit()
    await db.refresh(shift)
    return {"data": ShiftResponseSchema.model_validate(shift), "message": "Shift updated"}


@router.delete("/{shift_id}")
async def deactivate_shift(
    shift_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    shift = await db.get(Shift, shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    shift.is_active = False
    await db.commit()
    return {"data": None, "message": "Shift deactivated"}
