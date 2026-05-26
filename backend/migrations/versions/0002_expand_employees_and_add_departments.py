"""expand employees table and add departments

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-26
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create employeetype enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE employeetype AS ENUM ('FULL_TIME', 'HOURLY', 'CONTRACT');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$
    """)

    # Create departments table
    op.create_table(
        "departments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_departments_name"),
    )
    op.create_index("ix_departments_name", "departments", ["name"])

    # Add new columns to employees
    op.add_column("employees", sa.Column("full_name", sa.String(255), nullable=True))
    op.add_column("employees", sa.Column("phone", sa.String(20), nullable=True))
    op.add_column("employees", sa.Column("job_title", sa.String(100), nullable=True))
    op.add_column(
        "employees",
        sa.Column(
            "employee_type",
            postgresql.ENUM("FULL_TIME", "HOURLY", "CONTRACT", name="employeetype", create_type=False),
            nullable=False,
            server_default="FULL_TIME",
        ),
    )
    op.add_column(
        "employees",
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("employees", sa.Column("join_date", sa.Date(), nullable=True))
    op.add_column("employees", sa.Column("base_salary", sa.Numeric(12, 2), nullable=True))

    op.create_index("ix_employees_department_id", "employees", ["department_id"])


def downgrade() -> None:
    op.drop_index("ix_employees_department_id", table_name="employees")
    op.drop_column("employees", "base_salary")
    op.drop_column("employees", "join_date")
    op.drop_column("employees", "department_id")
    op.drop_column("employees", "employee_type")
    op.drop_column("employees", "job_title")
    op.drop_column("employees", "phone")
    op.drop_column("employees", "full_name")
    op.drop_index("ix_departments_name", table_name="departments")
    op.drop_table("departments")
    op.execute("DROP TYPE IF EXISTS employeetype")
