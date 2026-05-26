"""create initial tables (employees, attendance_logs, payroll_runs, leave_requests)

Revision ID: 0001
Revises:
Create Date: 2026-05-26
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('super_admin', 'hr_admin', 'manager', 'employee');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$
    """)
    op.create_table(
        "employees",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            PGEnum("super_admin", "hr_admin", "manager", "employee", name="userrole", create_type=False),
            nullable=False,
            server_default="employee",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("email", name="uq_employees_email"),
    )
    op.create_index("ix_employees_email", "employees", ["email"])

    for table in ("attendance_logs", "payroll_runs", "leave_requests"):
        op.create_table(
            table,
            sa.Column(
                "id",
                postgresql.UUID(as_uuid=True),
                primary_key=True,
                server_default=sa.text("uuid_generate_v4()"),
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        )


def downgrade() -> None:
    for table in ("leave_requests", "payroll_runs", "attendance_logs"):
        op.drop_table(table)
    op.drop_index("ix_employees_email", table_name="employees")
    op.drop_table("employees")
    op.execute("DROP TYPE IF EXISTS userrole")
