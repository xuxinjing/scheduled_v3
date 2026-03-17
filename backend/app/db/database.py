"""Database connection helpers for schedule persistence."""
from __future__ import annotations

import os
from pathlib import Path


def get_database_url() -> str:
    default_sqlite_path = Path(__file__).resolve().parents[2] / "data" / "app.db"
    return os.getenv("DATABASE_URL", f"sqlite:///{default_sqlite_path}")


def _require_sqlalchemy():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    database_url = get_database_url()
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine = create_engine(database_url, future=True, connect_args=connect_args)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
    return engine, session_local


_ENGINE = None
SessionLocal = None


def get_engine():
    global _ENGINE, SessionLocal
    if _ENGINE is None or SessionLocal is None:
        _ENGINE, SessionLocal = _require_sqlalchemy()
    return _ENGINE


def create_tables() -> None:
    from .models import Base

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
