"""
Reports API — mounted at /api/v1/reports

  GET /attendance   — per-employee attendance summary for a given month (HR/manager)
  GET /leave        — leave utilisation by type and top takers for a year (HR)
  GET /payroll      — monthly payroll cost trend for a year (HR)

Add ?format=csv to any endpoint to download a CSV instead of JSON.
"""
import calendar
import csv
import datetime
import io
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.attendance import AttendanceLog, AttendanceStatus
from app.models.employee import Employee
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType
from app.models.payroll import PayrollEntry, PayrollRun
from app.utils.auth import get_current_user, require_role

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _working_days(year: int, month: int) -> int:
    _, days_in_month = calendar.monthrange(year, month)
    return sum(
        1 for d in range(1, days_in_month + 1)
        if datetime.date(year, month, d).weekday() < 5
    )


def _csv_stream(rows: list[dict], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# ── Attendance report ─────────────────────────────────────────────────────────

@router.get('/attendance')
async def attendance_report(
    year:   int = Query(default_factory=lambda: datetime.date.today().year),
    month:  int = Query(default_factory=lambda: datetime.date.today().month),
    format: Literal['json', 'csv'] = 'json',
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role('super_admin', 'hr_admin', 'manager')),
):
    """Per-employee attendance breakdown for a calendar month."""
    working_days = _working_days(year, month)

    # LEFT JOIN so employees with no logs still appear
    stmt = (
        select(
            Employee.id,
            Employee.full_name,
            Employee.email,
            Employee.job_title,
            Employee.employee_type,
            func.count(AttendanceLog.id)
                .filter(AttendanceLog.status == AttendanceStatus.present)
                .label('days_present'),
            func.count(AttendanceLog.id)
                .filter(AttendanceLog.status == AttendanceStatus.late)
                .label('days_late'),
            func.count(AttendanceLog.id)
                .filter(AttendanceLog.status == AttendanceStatus.half_day)
                .label('days_half'),
            func.count(AttendanceLog.id)
                .filter(AttendanceLog.status == AttendanceStatus.absent)
                .label('days_absent'),
        )
        .select_from(Employee)
        .outerjoin(
            AttendanceLog,
            and_(
                AttendanceLog.employee_id == Employee.id,
                extract('year',  AttendanceLog.work_date) == year,
                extract('month', AttendanceLog.work_date) == month,
            ),
        )
        .where(Employee.is_active.is_(True))
        .group_by(Employee.id, Employee.full_name, Employee.email,
                  Employee.job_title, Employee.employee_type)
        .order_by(Employee.full_name)
    )
    rows = (await db.execute(stmt)).all()

    employees = []
    for r in rows:
        effective = r.days_present + r.days_late + r.days_half * 0.5
        pct = round(effective / working_days * 100, 1) if working_days else 0
        employees.append({
            'id':             str(r.id),
            'full_name':      r.full_name or '—',
            'email':          r.email,
            'job_title':      r.job_title or '—',
            'employee_type':  r.employee_type.value if r.employee_type else '—',
            'days_present':   r.days_present,
            'days_late':      r.days_late,
            'days_half':      r.days_half,
            'days_absent':    r.days_absent,
            'attendance_pct': pct,
        })

    if format == 'csv':
        csv_rows = [
            {
                'Name': e['full_name'], 'Email': e['email'],
                'Job Title': e['job_title'], 'Type': e['employee_type'],
                'Working Days': working_days,
                'Days Present': e['days_present'], 'Days Late': e['days_late'],
                'Half Days': e['days_half'], 'Days Absent': e['days_absent'],
                'Attendance %': e['attendance_pct'],
            }
            for e in employees
        ]
        fname = f"attendance_{year}_{month:02d}.csv"
        return _csv_stream(csv_rows, fname)

    summary = {
        'present':  sum(e['days_present'] for e in employees),
        'late':     sum(e['days_late']    for e in employees),
        'half_day': sum(e['days_half']    for e in employees),
        'absent':   sum(e['days_absent']  for e in employees),
    }

    return {
        'data': {
            'period': {'year': year, 'month': month, 'month_name': calendar.month_name[month]},
            'working_days':    working_days,
            'total_employees': len(employees),
            'summary':         summary,
            'employees':       employees,
        },
        'message': 'OK',
    }


# ── Leave report ──────────────────────────────────────────────────────────────

@router.get('/leave')
async def leave_report(
    year:   int = Query(default_factory=lambda: datetime.date.today().year),
    format: Literal['json', 'csv'] = 'json',
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role('super_admin', 'hr_admin')),
):
    """Leave utilisation by type + top takers for a calendar year."""

    # By type
    by_type_stmt = (
        select(
            LeaveType.name,
            LeaveType.code,
            LeaveType.is_paid,
            func.count(LeaveRequest.id).label('request_count'),
            func.coalesce(func.sum(LeaveRequest.days_requested), 0).label('total_days'),
        )
        .select_from(LeaveType)
        .outerjoin(
            LeaveRequest,
            and_(
                LeaveRequest.leave_type_id == LeaveType.id,
                LeaveRequest.status == LeaveStatus.approved,
                extract('year', LeaveRequest.start_date) == year,
            ),
        )
        .where(LeaveType.is_active.is_(True))
        .group_by(LeaveType.id, LeaveType.name, LeaveType.code, LeaveType.is_paid)
        .order_by(func.count(LeaveRequest.id).desc())
    )
    by_type_rows = (await db.execute(by_type_stmt)).all()

    by_type = [
        {
            'leave_type':    r.name,
            'code':          r.code,
            'is_paid':       r.is_paid,
            'request_count': r.request_count,
            'total_days':    float(r.total_days),
        }
        for r in by_type_rows
    ]

    # Top leave takers (approved requests, summed by employee)
    takers_stmt = (
        select(
            Employee.id,
            Employee.full_name,
            Employee.email,
            Employee.job_title,
            func.count(LeaveRequest.id).label('request_count'),
            func.coalesce(func.sum(LeaveRequest.days_requested), 0).label('total_days'),
        )
        .select_from(Employee)
        .join(LeaveRequest, and_(
            LeaveRequest.employee_id == Employee.id,
            LeaveRequest.status == LeaveStatus.approved,
            extract('year', LeaveRequest.start_date) == year,
        ))
        .where(Employee.is_active.is_(True))
        .group_by(Employee.id, Employee.full_name, Employee.email, Employee.job_title)
        .order_by(func.sum(LeaveRequest.days_requested).desc())
        .limit(20)
    )
    takers_rows = (await db.execute(takers_stmt)).all()

    top_takers = [
        {
            'id':            str(r.id),
            'full_name':     r.full_name or '—',
            'email':         r.email,
            'job_title':     r.job_title or '—',
            'request_count': r.request_count,
            'total_days':    float(r.total_days),
        }
        for r in takers_rows
    ]

    total_requests = sum(t['request_count'] for t in by_type)
    total_days     = sum(t['total_days']    for t in by_type)

    if format == 'csv':
        csv_rows = [
            {
                'Leave Type': t['leave_type'], 'Code': t['code'],
                'Paid': 'Yes' if t['is_paid'] else 'No',
                'Requests': t['request_count'], 'Total Days': t['total_days'],
            }
            for t in by_type
        ]
        return _csv_stream(csv_rows, f"leave_report_{year}.csv")

    return {
        'data': {
            'year':                    year,
            'total_approved_requests': total_requests,
            'total_days_taken':        total_days,
            'by_type':                 by_type,
            'top_takers':              top_takers,
        },
        'message': 'OK',
    }


# ── Payroll report ────────────────────────────────────────────────────────────

@router.get('/payroll')
async def payroll_report(
    year:   int = Query(default_factory=lambda: datetime.date.today().year),
    format: Literal['json', 'csv'] = 'json',
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role('super_admin', 'hr_admin')),
):
    """Monthly payroll cost trend for a calendar year."""
    stmt = (
        select(
            PayrollRun.period_month,
            PayrollRun.revision,
            PayrollRun.status,
            func.count(PayrollEntry.id).label('employee_count'),
            func.coalesce(func.sum(PayrollEntry.gross_salary),      0).label('total_gross'),
            func.coalesce(func.sum(PayrollEntry.total_deductions),  0).label('total_deductions'),
            func.coalesce(func.sum(PayrollEntry.net_salary),        0).label('total_net'),
        )
        .select_from(PayrollRun)
        .outerjoin(PayrollEntry, PayrollEntry.payroll_run_id == PayrollRun.id)
        .where(PayrollRun.period_year == year)
        .group_by(
            PayrollRun.id, PayrollRun.period_month,
            PayrollRun.revision, PayrollRun.status,
        )
        .order_by(PayrollRun.period_month, PayrollRun.revision)
    )
    rows = (await db.execute(stmt)).all()

    months = [
        {
            'period_month':     r.period_month,
            'month_name':       calendar.month_name[r.period_month],
            'revision':         r.revision,
            'status':           r.status.value,
            'employee_count':   r.employee_count,
            'total_gross':      float(r.total_gross),
            'total_deductions': float(r.total_deductions),
            'total_net':        float(r.total_net),
        }
        for r in rows
    ]

    total_gross      = sum(m['total_gross']      for m in months)
    total_net        = sum(m['total_net']         for m in months)
    total_deductions = sum(m['total_deductions']  for m in months)

    if format == 'csv':
        csv_rows = [
            {
                'Month': f"{m['month_name']} {year}", 'Revision': m['revision'],
                'Status': m['status'], 'Employees': m['employee_count'],
                'Total Gross': m['total_gross'],
                'Total Deductions': m['total_deductions'],
                'Total Net': m['total_net'],
            }
            for m in months
        ]
        return _csv_stream(csv_rows, f"payroll_report_{year}.csv")

    return {
        'data': {
            'year':             year,
            'total_gross':      total_gross,
            'total_net':        total_net,
            'total_deductions': total_deductions,
            'months':           months,
        },
        'message': 'OK',
    }
