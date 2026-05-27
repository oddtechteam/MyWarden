"""
Payslip PDF generation — uses reportlab (pure Python, no native DLLs).
WeasyPrint was dropped because it requires GTK/Pango/Cairo system libs on Windows.
"""
import asyncio
import calendar
import datetime
import io
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ── Colour palette ────────────────────────────────────────────────────────────
C_DARK_BLUE  = colors.HexColor('#1e3a5f')
C_MID_BLUE   = colors.HexColor('#2d5a8e')
C_LIGHT_BG   = colors.HexColor('#f8fafc')
C_BORDER     = colors.HexColor('#e2e8f0')
C_TEXT_DARK  = colors.HexColor('#111827')
C_TEXT_MID   = colors.HexColor('#374151')
C_TEXT_MUTED = colors.HexColor('#6b7280')
C_EMERALD    = colors.HexColor('#059669')
C_ROSE       = colors.HexColor('#e11d48')
C_AMBER      = colors.HexColor('#d97706')

# ── Paragraph styles ──────────────────────────────────────────────────────────
def _style(**kw) -> ParagraphStyle:
    return ParagraphStyle('_', **kw)

S_COMPANY   = _style(fontSize=18, textColor=C_DARK_BLUE, fontName='Helvetica-Bold', leading=22)
S_TAGLINE   = _style(fontSize=8,  textColor=C_TEXT_MUTED, fontName='Helvetica', leading=12)
S_TITLE     = _style(fontSize=13, textColor=C_DARK_BLUE, fontName='Helvetica-Bold', leading=16, alignment=TA_RIGHT)
S_PERIOD    = _style(fontSize=10, textColor=C_TEXT_MID,  fontName='Helvetica',      leading=14, alignment=TA_RIGHT)
S_REV       = _style(fontSize=8,  textColor=C_TEXT_MUTED, fontName='Helvetica',     leading=12, alignment=TA_RIGHT)
S_SECTION   = _style(fontSize=7,  textColor=C_TEXT_MUTED, fontName='Helvetica-Bold', leading=10, spaceAfter=4)
S_LABEL     = _style(fontSize=8,  textColor=C_TEXT_MUTED, fontName='Helvetica')
S_VALUE     = _style(fontSize=8,  textColor=C_TEXT_DARK,  fontName='Helvetica-Bold')
S_TH        = _style(fontSize=7,  textColor=colors.white, fontName='Helvetica-Bold')
S_TD        = _style(fontSize=8,  textColor=C_TEXT_MID,   fontName='Helvetica')
S_TD_R      = _style(fontSize=8,  textColor=C_TEXT_MID,   fontName='Helvetica', alignment=TA_RIGHT)
S_TD_BOLD_R = _style(fontSize=8,  textColor=C_TEXT_DARK,  fontName='Helvetica-Bold', alignment=TA_RIGHT)
S_NET_LBL   = _style(fontSize=11, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_LEFT)
S_NET_AMT   = _style(fontSize=16, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)
S_FOOTER    = _style(fontSize=7,  textColor=C_TEXT_MUTED, fontName='Helvetica', alignment=TA_CENTER)


def _fmt(val) -> str:
    return f"₹{float(val):,.2f}"


def _info_table(rows: list[tuple[str, str]], col_widths) -> Table:
    """Two-column label/value table for employee/period info sections."""
    data = [[Paragraph(lbl, S_LABEL), Paragraph(val, S_VALUE)] for lbl, val in rows]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('VALIGN',    (0, 0), (-1, -1), 'TOP'),
        ('ROWPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return t


def _render_payslip_sync(context: dict) -> bytes:
    buf = io.BytesIO()
    PAGE_W, PAGE_H = A4
    MARGIN = 15 * mm
    W = PAGE_W - 2 * MARGIN      # usable width
    COL2 = (W - 4 * mm) / 2     # half-width column

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=MARGIN,
    )
    story = []

    # ── 1. Header ─────────────────────────────────────────────────────────────
    header = Table(
        [[
            [Paragraph('MyWarden', S_COMPANY), Paragraph('Employee Management System', S_TAGLINE)],
            [Paragraph('PAY SLIP', S_TITLE),
             Paragraph(f"{context['month_name']} {context['period_year']}", S_PERIOD),
             Paragraph(f"Revision {context['revision']}", S_REV)],
        ]],
        colWidths=[W * 0.55, W * 0.45],
    )
    header.setStyle(TableStyle([
        ('VALIGN',         (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW',      (0, 0), (-1, 0),  1, C_DARK_BLUE),
        ('BOTTOMPADDING',  (0, 0), (-1, -1), 8),
    ]))
    story.append(header)
    story.append(Spacer(1, 5 * mm))

    # ── 2. Employee + Period info side by side ────────────────────────────────
    emp_rows = [
        ('Name',             context['employee_name']),
        ('Email',            context['employee_email']),
        ('Job Title',        context['job_title'] or '—'),
        ('Department',       context['department'] or '—'),
        ('Employment Type',  context['employee_type']),
    ]
    pay_rows = [
        ('Pay Period',   f"{context['month_name']} {context['period_year']}"),
        ('Approved On',  context['approved_date'] or '—'),
        ('Payment Date', context['paid_date'] or '—'),
        ('Generated On', context['generated_date']),
        ('Currency',     'INR (₹)'),
    ]

    lw = COL2 * 0.40
    vw = COL2 * 0.60

    emp_t   = _info_table(emp_rows, [lw, vw])
    pay_t   = _info_table(pay_rows, [lw, vw])

    def _box(inner, title: str) -> Table:
        t = Table(
            [[Paragraph(title, S_SECTION)], [inner]],
            colWidths=[COL2],
        )
        t.setStyle(TableStyle([
            ('BOX',          (0, 0), (-1, -1), 0.5, C_BORDER),
            ('BACKGROUND',   (0, 0), (-1, -1), C_LIGHT_BG),
            ('TOPPADDING',   (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 6),
            ('LEFTPADDING',  (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('LINEBELOW',    (0, 0), (-1, 0),  0.5, C_BORDER),
        ]))
        return t

    info_row = Table(
        [[_box(emp_t, 'EMPLOYEE DETAILS'), _box(pay_t, 'PAY PERIOD DETAILS')]],
        colWidths=[COL2, COL2],
        hAlign='LEFT',
    )
    info_row.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ('COLPADDING',    (0, 0), (-1, -1), 2),
    ]))
    story.append(info_row)
    story.append(Spacer(1, 4 * mm))

    # ── 3. Attendance bar ────────────────────────────────────────────────────
    att_data = [[
        [Paragraph(str(context['working_days']),  _style(fontSize=14, fontName='Helvetica-Bold', textColor=C_DARK_BLUE, alignment=TA_CENTER)),
         Paragraph('Working Days', _style(fontSize=7, textColor=C_TEXT_MUTED, alignment=TA_CENTER))],
        [Paragraph(str(context['days_present']),  _style(fontSize=14, fontName='Helvetica-Bold', textColor=C_DARK_BLUE, alignment=TA_CENTER)),
         Paragraph('Days Present', _style(fontSize=7, textColor=C_TEXT_MUTED, alignment=TA_CENTER))],
        [Paragraph(str(context['days_absent']),   _style(fontSize=14, fontName='Helvetica-Bold', textColor=C_ROSE, alignment=TA_CENTER)),
         Paragraph('Days Absent',  _style(fontSize=7, textColor=C_TEXT_MUTED, alignment=TA_CENTER))],
        [Paragraph(f"{context['attendance_pct']}%", _style(fontSize=14, fontName='Helvetica-Bold', textColor=C_EMERALD, alignment=TA_CENTER)),
         Paragraph('Attendance',   _style(fontSize=7, textColor=C_TEXT_MUTED, alignment=TA_CENTER))],
    ]]
    att_t = Table(att_data, colWidths=[W / 4] * 4)
    att_t.setStyle(TableStyle([
        ('BOX',          (0, 0), (-1, -1), 0.5, C_BORDER),
        ('LINEBEFORE',   (1, 0), (-1, -1), 0.5, C_BORDER),
        ('BACKGROUND',   (0, 0), (-1, -1), C_LIGHT_BG),
        ('ALIGN',        (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',   (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 6),
    ]))
    story.append(att_t)
    story.append(Spacer(1, 4 * mm))

    # ── 4. Earnings + Deductions tables side by side ─────────────────────────
    def _salary_table(title: str, rows: list, total_label: str, total_val: str, col_w) -> Table:
        th = [Paragraph(title, S_TH), Paragraph('Amount (₹)', _style(fontSize=7, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT))]
        body = [[Paragraph(r, S_TD), Paragraph(v, S_TD_R)] for r, v in rows]
        tf = [Paragraph(total_label, _style(fontSize=9, fontName='Helvetica-Bold', textColor=C_DARK_BLUE)),
              Paragraph(total_val, _style(fontSize=9, fontName='Helvetica-Bold', textColor=C_DARK_BLUE, alignment=TA_RIGHT))]
        data = [th] + body + [tf]
        cw = [col_w * 0.55, col_w * 0.45]
        t = Table(data, colWidths=cw)
        n = len(data)
        t.setStyle(TableStyle([
            ('BACKGROUND',   (0, 0), (-1, 0),  C_DARK_BLUE),
            ('BACKGROUND',   (0, n-1), (-1, n-1), C_LIGHT_BG),
            ('LINEABOVE',    (0, n-1), (-1, n-1), 1.5, C_DARK_BLUE),
            ('ROWBACKGROUNDS', (0, 1), (-1, n-2), [colors.white, C_LIGHT_BG]),
            ('TOPPADDING',   (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
            ('LEFTPADDING',  (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('BOX',          (0, 0), (-1, -1), 0.5, C_BORDER),
            ('INNERGRID',    (0, 1), (-1, n-2), 0.3, C_BORDER),
        ]))
        return t

    # Earnings
    if context['employee_type'] == 'HOURLY':
        earn_lbl = f"Base Salary ({context['days_present']}/{context['working_days']} days)"
    else:
        earn_lbl = 'Base Salary (Monthly)'
    earn_rows = [(earn_lbl, f"{float(context['gross_salary']):,.2f}")]

    earn_t = _salary_table(
        'EARNINGS', earn_rows,
        'Gross Salary', f"{float(context['gross_salary']):,.2f}",
        COL2,
    )

    # Deductions
    breakdown = context.get('deduction_breakdown', {})
    labels    = context.get('deduction_labels', {})
    ded_rows  = [(labels.get(code, code), f"{amt:,.2f}") for code, amt in breakdown.items()]
    if not ded_rows:
        ded_rows = [('No deductions applied', '0.00')]

    ded_t = _salary_table(
        'DEDUCTIONS', ded_rows,
        'Total Deductions', f"{float(context['total_deductions']):,.2f}",
        COL2,
    )

    sal_row = Table([[earn_t, ded_t]], colWidths=[COL2, COL2])
    sal_row.setStyle(TableStyle([
        ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('COLPADDING',   (0, 0), (-1, -1), 2),
    ]))
    story.append(sal_row)
    story.append(Spacer(1, 4 * mm))

    # ── 5. Net salary highlight ───────────────────────────────────────────────
    net_t = Table(
        [[Paragraph('NET TAKE-HOME SALARY', S_NET_LBL),
          Paragraph(_fmt(context['net_salary']), S_NET_AMT)]],
        colWidths=[W * 0.55, W * 0.45],
    )
    net_t.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), C_DARK_BLUE),
        ('TOPPADDING',   (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 10),
        ('LEFTPADDING',  (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [4]),
    ]))
    story.append(net_t)
    story.append(Spacer(1, 4 * mm))

    # ── 6. Footer ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        'This is a system-generated payslip and does not require a signature. &nbsp;·&nbsp; MyWarden EMS &nbsp;·&nbsp; Confidential',
        S_FOOTER,
    ))

    doc.build(story)
    return buf.getvalue()


async def render_payslip_pdf(context: dict) -> bytes:
    """Render the payslip to PDF bytes (non-blocking via thread pool)."""
    return await asyncio.to_thread(_render_payslip_sync, context)


def build_payslip_context(
    entry,           # PayrollEntry ORM instance (.employee + .payroll_run eager-loaded)
    deduction_rules, # list[DeductionRule] — for code→name labels
) -> dict:
    emp = entry.employee
    run = entry.payroll_run

    month_name = calendar.month_name[entry.period_month]

    working = Decimal(str(entry.working_days))
    present = Decimal(str(entry.days_present))
    absent  = (working - present).quantize(Decimal('0.1'))
    att_pct = int((present / working * 100).quantize(Decimal('1'))) if working > 0 else 0

    label_map = {r.code: r.name for r in deduction_rules} if deduction_rules else {}

    def fmt_date(dt):
        if dt is None:
            return None
        if hasattr(dt, 'date'):
            dt = dt.date()
        return dt.strftime('%d %b %Y')

    return {
        'period_year':   entry.period_year,
        'period_month':  entry.period_month,
        'month_name':    month_name,
        'revision':      run.revision if run else 1,
        'employee_name':  emp.full_name or emp.email if emp else '—',
        'employee_email': emp.email if emp else '—',
        'job_title':      emp.job_title if emp else None,
        'department':     emp.department.name if emp and emp.department else None,
        'employee_type':  entry.employee_type.value,
        'approved_date':  fmt_date(run.approved_at) if run else None,
        'paid_date':      fmt_date(run.paid_at)     if run else None,
        'generated_date': datetime.date.today().strftime('%d %b %Y'),
        'working_days':   int(working),
        'days_present':   float(present),
        'days_absent':    float(absent),
        'attendance_pct': att_pct,
        'gross_salary':        entry.gross_salary,
        'total_deductions':    entry.total_deductions,
        'net_salary':          entry.net_salary,
        'deduction_breakdown': entry.deduction_breakdown or {},
        'deduction_labels':    label_map,
    }
