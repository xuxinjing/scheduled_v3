"""Simple file-backed store for the backend's current restaurant and week config."""
from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

from ..engine.context import default_restaurant_config

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "backend" / "data"
RESTAURANT_PATH = DATA_DIR / "restaurant_config.json"
WEEK_CONFIG_PATH = DATA_DIR / "week_config.json"
LEGACY_WEEK_CONFIG_PATH = REPO_ROOT / "week_config.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_restaurant_config() -> dict:
    if RESTAURANT_PATH.exists():
        return json.loads(RESTAURANT_PATH.read_text())
    return default_restaurant_config()


def save_restaurant_config(config: dict) -> dict:
    _ensure_data_dir()
    RESTAURANT_PATH.write_text(json.dumps(config, indent=2) + "\n")
    _sync_restaurant_config_to_database(config)
    return config


def load_week_config() -> dict:
    if WEEK_CONFIG_PATH.exists():
        return json.loads(WEEK_CONFIG_PATH.read_text())
    if LEGACY_WEEK_CONFIG_PATH.exists():
        return json.loads(LEGACY_WEEK_CONFIG_PATH.read_text())
    raise FileNotFoundError("No week_config.json found")


def save_week_config(config: dict) -> dict:
    _ensure_data_dir()
    WEEK_CONFIG_PATH.write_text(json.dumps(config, indent=2) + "\n")
    return config


def _sync_restaurant_config_to_database(config: dict) -> None:
    try:
        from ..db.database import SessionLocal, create_tables
        from ..db.models import Restaurant
    except ModuleNotFoundError:
        return

    create_tables()
    session = SessionLocal()
    try:
        slug = config.get("slug", "default")
        record = Restaurant(
            id=str(uuid5(NAMESPACE_URL, f"restaurant:{slug}")),
            name=config.get("name", "Restaurant"),
            slug=slug,
            kitchen_state={
                "name": config.get("name", "Restaurant"),
                "slug": slug,
                "email_config": config.get("email_config", {}),
            },
            stations={
                "am_stations": config.get("am_stations", []),
                "pm_stations": config.get("pm_stations", []),
                "slow_merged_stations": config.get("slow_merged_stations", []),
            },
            staff={"employees": config.get("employees", [])},
            scheduling_rules={"source": "restaurant_config.json"},
            config_json=config,
        )
        session.merge(record)
        session.commit()
    finally:
        session.close()
