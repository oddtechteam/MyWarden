"""Phase 2 — expand attendance_logs, leave_requests; add shifts, leave_types, leave_balances

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-27
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE checkinmethod AS ENUM ('face', 'otp', 'manual');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE attendancestatus AS ENUM ('present', 'late', 'absent', 'half_day');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE leavestatus AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    # ── shifts ─────────────────────────────────────────────────────────────
    op.create_table(
        "shifts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("grace_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_shifts_name"),
    )
    op.create_index("ix_shifts_name", "shifts", ["name"])

    # ── leave_types ────────────────────────────────────────────────────────
    op.create_table(
        "leave_types",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("days_per_year", sa.Integer(), nullable=False),
        sa.Column("is_paid", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_leave_types_name"),
        sa.UniqueConstraint("code", name="uq_leave_types_code"),
    )

    # ── Expand attendance_logs (stub table from 0001) ──────────────────────
    op.add_column(
        "attendance_logs",
        sa.Column(
            "employee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.add_column(
        "attendance_logs",
        sa.Column(
            "shift_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shifts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("attendance_logs", sa.Column("work_date", sa.Date(), nullable=False))
    op.add_column("attendance_logs", sa.Column("check_in_at", sa.DateTime(), nullable=True))
    op.add_column("attendance_logs", sa.Column("check_out_at", sa.DateTime(), nullable=True))
    op.add_column(
        "attendance_logs",
        sa.Column(
            "check_in_method",
            postgresql.ENUM("face", "otp", "manual", name="checkinmethod", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "attendance_logs",
        sa.Column(
            "check_out_method",
            postgresql.ENUM("face", "otp", "manual", name="checkinmethod", create_type=False),
            nullable=True,
        ),
    )
    op.add_column("attendance_logs", sa.Column("check_in_photo_key", sa.String(500), nullable=True))
    op.add_column(
        "attendance_logs",
        sa.Column(
            "status",
            postgresql.ENUM("present", "late", "absent", "half_day", name="attendancestatus", create_type=False),
            nullable=False,
            server_default="absent",
        ),
    )
    op.add_column("attendance_logs", sa.Column("notes", sa.String(500), nullable=True))

    op.create_index("ix_attendance_logs_employee_id", "attendance_logs", ["employee_id"])
    op.create_index("ix_attendance_logs_work_date", "attendance_logs", ["work_date"])
    op.create_unique_constraint(
        "uq_attendance_employee_date", "attendance_logs", ["employee_id", "work_date"]
    )

    # ── Expand leave_requests (stub table from 0001) ───────────────────────
    op.add_column(
        "leave_requests",
        sa.Column(
            "employee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.add_column(
        "leave_requests",
        sa.Column(
            "leave_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leave_types.id", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    op.add_column("leave_requests", sa.Column("start_date", sa.Date(), nullable=False))
    op.add_column("leave_requests", sa.Column("end_date", sa.Date(), nullable=False))
    op.add_column("leave_requests", sa.Column("days_requested", sa.Numeric(5, 1), nullable=False))
    op.add_column("leave_requests", sa.Column("reason", sa.String(500), nullable=True))
    op.add_column(
        "leave_requests",
        sa.Column(
            "status",
            postgresql.ENUM("pending", "approved", "rejected", "cancelled", name="leavestatus", create_type=False),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "leave_requests",
        sa.Column(
            "reviewed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("leave_requests", sa.Column("reviewed_at", sa.DateTime(), nullable=True))
    op.add_column("leave_requests", sa.Column("review_note", sa.String(500), nullable=True))

    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])

    # ── leave_balances ─────────────────────────────────────────────────────
    op.create_table(
        "leave_balances",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "employee_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "leave_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leave_types.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("allocated", sa.Numeric(5, 1), nullable=False),
        sa.Column("used", sa.Numeric(5, 1), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "employee_id", "leave_type_id", "year",
            name="uq_leave_balance_employee_type_year",
        ),
    )
    op.create_index("ix_leave_balances_employee_id", "leave_balances", ["employee_id"])


def downgrade() -> None:
    op.drop_table("leave_balances")

    op.drop_index("ix_leave_requests_employee_id", table_name="leave_requests")
    for col in ("review_note", "reviewed_at", "reviewed_by_id", "status", "reason",
                "days_requested", "end_date", "start_date", "leave_type_id", "employee_id"):
        op.drop_column("leave_requests", col)

    op.drop_index("ix_attendance_logs_work_date", table_name="attendance_logs")
    op.drop_index("ix_attendance_logs_employee_id", table_name="attendance_logs")
    op.drop_constraint("uq_attendance_employee_date", "attendance_logs", type_="unique")
    for col in ("notes", "status", "check_in_photo_key", "check_out_method", "check_in_method",
                "check_out_at", "check_in_at", "work_date", "shift_id", "employee_id"):
        op.drop_column("attendance_logs", col)

    op.drop_table("leave_types")
    op.drop_index("ix_shifts_name", table_name="shifts")
    op.drop_table("shifts")

    op.execute("DROP TYPE IF EXISTS leavestatus")
    op.execute("DROP TYPE IF EXISTS attendancestatus")
    op.execute("DROP TYPE IF EXISTS checkinmethod")
