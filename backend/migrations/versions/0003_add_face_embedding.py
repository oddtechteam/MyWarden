"""add face_embedding and face_enrolled to employees

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-26
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # face_embedding: 512-dim vector (Facenet512)
    op.execute("ALTER TABLE employees ADD COLUMN IF NOT EXISTS face_embedding vector(512)")

    # face_enrolled: tracks whether enrollment has completed successfully
    op.add_column(
        "employees",
        sa.Column("face_enrolled", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("employees", "face_enrolled")
    op.execute("ALTER TABLE employees DROP COLUMN IF EXISTS face_embedding")
