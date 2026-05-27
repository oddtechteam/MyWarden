"""Phase 3 — add deduction_rules, payroll_entries; expand payroll_runs stub

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-27
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE payrollstatus AS ENUM ('draft', 'approved', 'processed', 'paid');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE deductiontype AS ENUM ('percentage', 'fixed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE appliesto AS ENUM ('all', 'FULL_TIME', 'HOURLY', 'CONTRACT');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """)

    # ── Upgrade payroll_runs stub → full table ─────────────────────────────────
    # Convert existing created_at / updated_at to TIMESTAMPTZ first
    op.alter_column(
        "payroll_runs", "created_at",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        postgresql_using="created_at AT TIME ZONE 'UTC'",
    )
    op.alter_column(
        "payroll_runs", "updated_at",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        postgresql_using="updated_at AT TIME ZONE 'UTC'",
    )

    # Add all new columns (server_defaults ensure existing empty rows stay valid)
    op.add_column("payroll_runs", sa.Column("period_year",  sa.Integer(), nullable=False, server_default="2026"))
    op.add_column("payroll_runs", sa.Column("period_month", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("payroll_runs", sa.Column("revision",     sa.Integer(), nullable=False, server_default="1"))
    op.add_column(
        "payroll_runs",
        sa.Column(
            "status",
            postgresql.ENUM("draft", "approved", "processed", "paid", name="payrollstatus", create_type=False),
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column("payroll_runs", sa.Column("notes",         sa.String(500), nullable=True))
    op.add_column(
        "payroll_runs",
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("payroll_runs", sa.Column("processed_at",  sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "payroll_runs",
        sa.Column(
            "approved_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("payroll_runs", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payroll_runs", sa.Column("paid_at",     sa.DateTime(timezone=True), nullable=True))

    op.create_unique_constraint(
        "uq_payroll_run_period_revision", "payroll_runs",
        ["period_year", "period_month", "revision"],
    )
    op.create_index("ix_payroll_runs_period", "payroll_runs", ["period_year", "period_month"])

    # ── deduction_rules ────────────────────────────────────────────────────────
    op.create_table(
        "deduction_rules",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True),
            primary_key=True, server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name",        sa.String(100), nullable=False),
        sa.Column("code",        sa.String(20),  nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column(
            "type",
            postgresql.ENUM("percentage", "fixed", name="deductiontype", create_type=False),
            nullable=False,
        ),
        sa.Column("value", sa.Numeric(10, 4), nullable=False),
        sa.Column(
            "applies_to",
            postgresql.ENUM("all", "FULL_TIME", "HOURLY", "CONTRACT", name="appliesto", create_type=False),
            nullable=False,
            server_default="all",
        ),
        sa.Column("is_statutory", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active",    sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_deduction_rules_name"),
        sa.UniqueConstraint("code", name="uq_deduction_rules_code"),
    )

    # ── payroll_entries ────────────────────────────────────────────────────────
    op.create_table(
        "payroll_entries",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True),
            primary_key=True, server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "payroll_run_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payroll_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "employee_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("employees.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "employee_type",
            postgresql.ENUM("FULL_TIME", "HOURLY", "CONTRACT", name="employeetype", create_type=False),
            nullable=False,
        ),
        sa.Column("period_year",  sa.Integer(), nullable=False),
        sa.Column("period_month", sa.Integer(), nullable=False),
        sa.Column("working_days", sa.Numeric(5, 1), nullable=False),
        sa.Column("days_present", sa.Numeric(5, 1), nullable=False),
        sa.Column("gross_salary",      sa.Numeric(12, 2), nullable=False),
        sa.Column("total_deductions",  sa.Numeric(12, 2), nullable=False),
        sa.Column("net_salary",        sa.Numeric(12, 2), nullable=False),
        sa.Column("deduction_breakdown", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("payslip_key", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("payroll_run_id", "employee_id", name="uq_payroll_entry_run_employee"),
    )
    op.create_index("ix_payroll_entries_run_id",      "payroll_entries", ["payroll_run_id"])
    op.create_index("ix_payroll_entries_employee_id", "payroll_entries", ["employee_id"])


def downgrade() -> None:
    op.drop_index("ix_payroll_entries_employee_id", table_name="payroll_entries")
    op.drop_index("ix_payroll_entries_run_id",      table_name="payroll_entries")
    op.drop_table("payroll_entries")

    op.drop_table("deduction_rules")

    op.drop_index("ix_payroll_runs_period", table_name="payroll_runs")
    op.drop_constraint("uq_payroll_run_period_revision", "payroll_runs", type_="unique")
    for col in ("paid_at", "approved_at", "approved_by_id", "processed_at",
                "created_by_id", "notes", "status", "revision", "period_month", "period_year"):
        op.drop_column("payroll_runs", col)

    op.execute("DROP TYPE IF EXISTS appliesto")
    op.execute("DROP TYPE IF EXISTS deductiontype")
    op.execute("DROP TYPE IF EXISTS payrollstatus")
