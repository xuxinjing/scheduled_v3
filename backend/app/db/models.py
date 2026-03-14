"""SQLAlchemy models aligned to the BUILD_WEBAPP schema."""
from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    kitchen_state: Mapped[dict] = mapped_column(JSON, nullable=False)
    stations: Mapped[dict] = mapped_column(JSON, nullable=False)
    staff: Mapped[dict] = mapped_column(JSON, nullable=False)
    scheduling_rules: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    restaurant_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("restaurants.id"), nullable=True, index=True)
    week_start: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    week_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    assignments: Mapped[dict] = mapped_column(JSON, nullable=False)
    shift_counts: Mapped[dict] = mapped_column(JSON, nullable=False)
    validation_report: Mapped[dict] = mapped_column(JSON, nullable=False)
    excel_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="generated", index=True)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    report_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    restaurant_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("restaurants.id"), nullable=True, index=True)
    schedule_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("schedules.id"), nullable=True, index=True)
    messages: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
