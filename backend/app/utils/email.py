import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import redis as _redis_module

from app.config import settings

logger = logging.getLogger(__name__)

EMAIL_PAUSED_KEY = "mywarden:notifications:email_paused"


def _r() -> _redis_module.Redis:
    return _redis_module.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=2)


def is_email_paused() -> bool:
    try:
        return _r().get(EMAIL_PAUSED_KEY) == "1"
    except Exception:
        return False  # if Redis is down, don't silently block emails


def set_email_paused(paused: bool) -> None:
    r = _r()
    if paused:
        r.set(EMAIL_PAUSED_KEY, "1")
    else:
        r.delete(EMAIL_PAUSED_KEY)


def send_email(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_ENABLED:
        logger.info("SMTP disabled — skipping email to %s | %s", to, subject)
        return
    if is_email_paused():
        logger.info("Notifications paused — skipping email to %s | %s", to, subject)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"]      = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        if settings.SMTP_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.sendmail(msg["From"], [to], msg.as_string())
        else:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.sendmail(msg["From"], [to], msg.as_string())
        logger.info("Email sent → %s | %s", to, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        raise


# ─── Base HTML template ──────────────────────────────────────────────────────

def _base(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{{margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}}
  .wrap{{max-width:560px;margin:40px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155}}
  .hdr{{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 32px}}
  .logo{{color:#fff;font-size:20px;font-weight:700;letter-spacing:-.5px}}
  .bdy{{padding:32px;color:#cbd5e1;font-size:15px;line-height:1.65}}
  h2{{color:#f1f5f9;font-size:18px;margin:0 0 16px}}
  p{{margin:0 0 14px}}
  .card{{background:#0f172a;border-radius:8px;padding:14px 18px;margin:12px 0;border:1px solid #334155}}
  .lbl{{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px}}
  .val{{color:#f1f5f9;font-size:15px;font-weight:600;margin-top:3px}}
  .green{{display:inline-block;background:#065f46;color:#6ee7b7;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600}}
  .red{{display:inline-block;background:#7f1d1d;color:#fca5a5;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600}}
  .ftr{{padding:18px 32px;border-top:1px solid #334155;color:#475569;font-size:12px;text-align:center}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="hdr"><div class="logo">MyWarden</div></div>
    <div class="bdy"><h2>{title}</h2>{body}</div>
    <div class="ftr">This is an automated message from MyWarden. Please do not reply.</div>
  </div>
</body>
</html>"""


# ─── Email builders ──────────────────────────────────────────────────────────

def payroll_processed_email(
    full_name: str,
    period_month: str,
    period_year: int,
    gross: str,
    net: str,
) -> tuple[str, str]:
    subject = f"Payslip ready — {period_month} {period_year}"
    body = f"""
    <p>Hi {full_name},</p>
    <p>Your payslip for <strong>{period_month} {period_year}</strong> has been processed and is now available in the portal.</p>
    <div class="card"><div class="lbl">Gross Salary</div><div class="val">&#8377;{gross}</div></div>
    <div class="card"><div class="lbl">Net Salary (take-home)</div><div class="val">&#8377;{net}</div></div>
    <p>Log in to MyWarden to download your full payslip PDF.</p>
    """
    return subject, _base(subject, body)


def payroll_paid_email(
    full_name: str,
    period_month: str,
    period_year: int,
    net: str,
) -> tuple[str, str]:
    subject = f"Salary credited — {period_month} {period_year}"
    body = f"""
    <p>Hi {full_name},</p>
    <p>Your salary for <strong>{period_month} {period_year}</strong> has been marked as <strong>paid</strong>.</p>
    <div class="card"><div class="lbl">Net Amount</div><div class="val">&#8377;{net}</div></div>
    <p>If you have any questions, please contact your HR department.</p>
    """
    return subject, _base(subject, body)


def leave_approved_email(
    full_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    days: int,
    note: str | None,
) -> tuple[str, str]:
    subject = f"Leave approved — {leave_type}"
    note_block = f'<div class="card"><div class="lbl">Note from reviewer</div><div class="val">{note}</div></div>' if note else ""
    body = f"""
    <p>Hi {full_name},</p>
    <p>Your leave request has been <span class="green">Approved</span></p>
    <div class="card"><div class="lbl">Leave type</div><div class="val">{leave_type}</div></div>
    <div class="card"><div class="lbl">Duration</div><div class="val">{start_date} &rarr; {end_date} &nbsp;({days} day{"s" if days != 1 else ""})</div></div>
    {note_block}
    <p>Enjoy your time off!</p>
    """
    return subject, _base(subject, body)


def leave_rejected_email(
    full_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    days: int,
    note: str | None,
) -> tuple[str, str]:
    subject = f"Leave not approved — {leave_type}"
    note_block = f'<div class="card"><div class="lbl">Reason</div><div class="val">{note}</div></div>' if note else ""
    body = f"""
    <p>Hi {full_name},</p>
    <p>Your leave request has been <span class="red">Rejected</span></p>
    <div class="card"><div class="lbl">Leave type</div><div class="val">{leave_type}</div></div>
    <div class="card"><div class="lbl">Duration</div><div class="val">{start_date} &rarr; {end_date} &nbsp;({days} day{"s" if days != 1 else ""})</div></div>
    {note_block}
    <p>Please reach out to your HR department if you have any questions.</p>
    """
    return subject, _base(subject, body)
