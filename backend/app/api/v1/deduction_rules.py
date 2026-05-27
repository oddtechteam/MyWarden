"""
Deduction Rules API — mounted at /api/v1/deduction-rules

  GET  /          — list rules (all authenticated; HR sees inactive too)
  POST /          — create rule   (HR only)
  PUT  /{id}      — update rule   (HR only)
  DELETE /{id}    — soft-deactivate (HR only)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.payroll import DeductionRule
from app.schemas.payroll import (
    DeductionRuleCreateSchema,
    DeductionRuleResponseSchema,
    DeductionRuleUpdateSchema,
)
from app.utils.auth import get_current_user, require_role

router = APIRouter()


@router.get("/")
async def list_deduction_rules(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    stmt = select(DeductionRule)
    if not include_inactive:
        stmt = stmt.where(DeductionRule.is_active.is_(True))
    result = await db.execute(stmt.order_by(DeductionRule.name))
    rules = result.scalars().all()
    return {
        "data": [DeductionRuleResponseSchema.model_validate(r) for r in rules],
        "message": "OK",
    }


@router.post("/", status_code=201)
async def create_deduction_rule(
    payload: DeductionRuleCreateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    existing = await db.scalar(
        select(DeductionRule).where(
            (DeductionRule.name == payload.name) | (DeductionRule.code == payload.code.upper())
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="A rule with this name or code already exists")

    rule = DeductionRule(
        name=payload.name,
        code=payload.code.upper(),
        description=payload.description,
        type=payload.type,
        value=payload.value,
        applies_to=payload.applies_to,
        is_statutory=payload.is_statutory,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"data": DeductionRuleResponseSchema.model_validate(rule), "message": "Deduction rule created"}


@router.put("/{rule_id}")
async def update_deduction_rule(
    rule_id: UUID,
    payload: DeductionRuleUpdateSchema,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    rule = await db.get(DeductionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Deduction rule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)
    return {"data": DeductionRuleResponseSchema.model_validate(rule), "message": "Deduction rule updated"}


@router.delete("/{rule_id}", status_code=200)
async def deactivate_deduction_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("super_admin", "hr_admin")),
):
    rule = await db.get(DeductionRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Deduction rule not found")
    rule.is_active = False
    await db.commit()
    return {"data": None, "message": "Deduction rule deactivated"}
