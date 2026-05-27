"""Convert all TIMESTAMP columns to TIMESTAMPTZ (timezone-aware)

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-27
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

# Tables and their datetime columns to migrate.
# All existing naive values are UTC — we mark them as UTC during the cast.
_COLUMNS: list[tuple[str, list[str]]] = [
    ("departments",    ["created_at", "updated_at"]),
    ("employees",      ["created_at", "updated_at"]),
    ("shifts",         ["created_at", "updated_at"]),
    ("attendance_logs", ["check_in_at", "check_out_at", "created_at", "updated_at"]),
    ("leave_types",    ["created_at", "updated_at"]),
    ("leave_requests", ["reviewed_at", "created_at", "updated_at"]),
    ("leave_balances", ["created_at", "updated_at"]),
]


def upgrade() -> None:
    for table, columns in _COLUMNS:
        for col in columns:
            op.alter_column(
                table,
                col,
                existing_type=sa.DateTime(),
                type_=sa.DateTime(timezone=True),
                postgresql_using=f"{col} AT TIME ZONE 'UTC'",
            )


def downgrade() -> None:
    for table, columns in _COLUMNS:
        for col in columns:
            op.alter_column(
                table,
                col,
                existing_type=sa.DateTime(timezone=True),
                type_=sa.DateTime(),
                postgresql_using=f"{col} AT TIME ZONE 'UTC'",
            )
