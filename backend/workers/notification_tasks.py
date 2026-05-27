import asyncio
import calendar
import logging

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


# ─── Core send task (retried on SMTP failure) ────────────────────────────────

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(self, to: str, subject: str, html: str) -> None:
    from app.utils.email import send_email
    try:
        send_email(to, subject, html)
    except Exception as exc:
        raise self.retry(exc=exc)


# ─── Payroll notifications ───────────────────────────────────────────────────

@celery_app.task
def notify_payroll_processed(run_id: str) -> None:
    asyncio.run(_notify_payroll(run_id, event="processed"))


@celery_app.task
def notify_payroll_paid(run_id: str) -> None:
    asyncio.run(_notify_payroll(run_id, event="paid"))


async def _notify_payroll(run_id: str, event: str) -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.database import AsyncSessionLocal
    from app.models.payroll import PayrollEntry, PayrollRun
    from app.utils.email import payroll_paid_email, payroll_processed_email

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PayrollRun)
            .options(selectinload(PayrollRun.entries).selectinload(PayrollEntry.employee))
            .where(PayrollRun.id == run_id)
        )
        run = result.scalar_one_or_none()
        if not run:
            logger.warning("notify_payroll_%s: run %s not found", event, run_id)
            return

        month_name = calendar.month_name[run.period_month]

        for entry in run.entries:
            emp = entry.employee
            if not emp or not emp.email:
                continue

            if event == "processed":
                subject, html = payroll_processed_email(
                    full_name=emp.full_name or emp.email,
                    period_month=month_name,
                    period_year=run.period_year,
                    gross=f"{entry.gross_salary:,.2f}",
                    net=f"{entry.net_salary:,.2f}",
                )
            else:
                subject, html = payroll_paid_email(
                    full_name=emp.full_name or emp.email,
                    period_month=month_name,
                    period_year=run.period_year,
                    net=f"{entry.net_salary:,.2f}",
                )

            send_email_task.delay(emp.email, subject, html)
            logger.info("Queued payroll_%s email → %s", event, emp.email)


# ─── Leave notifications ─────────────────────────────────────────────────────

@celery_app.task
def notify_leave_status_changed(request_id: str) -> None:
    asyncio.run(_notify_leave(request_id))


async def _notify_leave(request_id: str) -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.database import AsyncSessionLocal
    from app.models.leave import LeaveRequest, LeaveStatus
    from app.utils.email import leave_approved_email, leave_rejected_email

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LeaveRequest)
            .options(
                selectinload(LeaveRequest.employee),
                selectinload(LeaveRequest.leave_type),
            )
            .where(LeaveRequest.id == request_id)
        )
        req = result.scalar_one_or_none()
        if not req or not req.employee:
            logger.warning("notify_leave: request %s not found or has no employee", request_id)
            return

        emp = req.employee
        if not emp.email:
            return

        days = (req.end_date - req.start_date).days + 1
        start = req.start_date.strftime("%d %b %Y")
        end   = req.end_date.strftime("%d %b %Y")
        leave_type_name = req.leave_type.name if req.leave_type else "Leave"

        if req.status == LeaveStatus.approved:
            subject, html = leave_approved_email(
                full_name=emp.full_name or emp.email,
                leave_type=leave_type_name,
                start_date=start,
                end_date=end,
                days=days,
                note=req.review_note,
            )
        elif req.status == LeaveStatus.rejected:
            subject, html = leave_rejected_email(
                full_name=emp.full_name or emp.email,
                leave_type=leave_type_name,
                start_date=start,
                end_date=end,
                days=days,
                note=req.review_note,
            )
        else:
            return

        send_email_task.delay(emp.email, subject, html)
        logger.info("Queued leave_%s email → %s", req.status.value, emp.email)
