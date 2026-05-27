"""
Admin settings API — super_admin only.
  GET  /api/v1/admin/email-settings   — current email notification state
  PUT  /api/v1/admin/email-settings   — pause or resume email notifications
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import settings
from app.utils.auth import require_role
from app.utils.email import is_email_paused, set_email_paused

router = APIRouter()


class EmailSettingsUpdateSchema(BaseModel):
    paused: bool


@router.get("/email-settings")
async def get_email_settings(
    _=Depends(require_role("super_admin")),
):
    paused = is_email_paused()
    return {
        "data": {
            "smtp_configured": settings.SMTP_ENABLED,
            "paused": paused,
            "active": settings.SMTP_ENABLED and not paused,
        },
        "message": "OK",
    }


@router.put("/email-settings")
async def update_email_settings(
    payload: EmailSettingsUpdateSchema,
    _=Depends(require_role("super_admin")),
):
    set_email_paused(payload.paused)
    return {
        "data": {"paused": payload.paused},
        "message": "Email notifications " + ("paused" if payload.paused else "resumed"),
    }
