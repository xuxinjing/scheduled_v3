"""Initial restaurants, schedules, and conversations tables."""

from alembic import op
import sqlalchemy as sa


revision = "20260313_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "restaurants",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("kitchen_state", sa.JSON(), nullable=False),
        sa.Column("stations", sa.JSON(), nullable=False),
        sa.Column("staff", sa.JSON(), nullable=False),
        sa.Column("scheduling_rules", sa.JSON(), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_restaurants_slug", "restaurants", ["slug"], unique=True)

    op.create_table(
        "schedules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=36), sa.ForeignKey("restaurants.id"), nullable=True),
        sa.Column("week_start", sa.String(length=32), nullable=False),
        sa.Column("week_config", sa.JSON(), nullable=False),
        sa.Column("assignments", sa.JSON(), nullable=False),
        sa.Column("shift_counts", sa.JSON(), nullable=False),
        sa.Column("validation_report", sa.JSON(), nullable=False),
        sa.Column("excel_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="generated"),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("report_markdown", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_schedules_restaurant_id", "schedules", ["restaurant_id"])
    op.create_index("ix_schedules_status", "schedules", ["status"])
    op.create_index("ix_schedules_week_start", "schedules", ["week_start"])

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("restaurant_id", sa.String(length=36), sa.ForeignKey("restaurants.id"), nullable=True),
        sa.Column("schedule_id", sa.String(length=36), sa.ForeignKey("schedules.id"), nullable=True),
        sa.Column("messages", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversations_restaurant_id", "conversations", ["restaurant_id"])
    op.create_index("ix_conversations_schedule_id", "conversations", ["schedule_id"])


def downgrade() -> None:
    op.drop_index("ix_conversations_schedule_id", table_name="conversations")
    op.drop_index("ix_conversations_restaurant_id", table_name="conversations")
    op.drop_table("conversations")

    op.drop_index("ix_schedules_week_start", table_name="schedules")
    op.drop_index("ix_schedules_status", table_name="schedules")
    op.drop_index("ix_schedules_restaurant_id", table_name="schedules")
    op.drop_table("schedules")

    op.drop_index("ix_restaurants_slug", table_name="restaurants")
    op.drop_table("restaurants")
