"""Restaurant configuration endpoints."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..services.config_store import (
    load_restaurant_config,
    load_week_config,
    save_restaurant_config,
    save_week_config,
)

router = APIRouter(prefix="/restaurant", tags=["restaurant"])


class RestaurantPayload(BaseModel):
    restaurant_config: dict
    week_config: dict


@router.get("")
def get_restaurant():
    return {
        "restaurant_config": load_restaurant_config(),
        "week_config": load_week_config(),
    }


@router.get("/{restaurant_id}")
def get_restaurant_by_id(restaurant_id: str):
    return {
        "restaurant_id": restaurant_id,
        "restaurant_config": load_restaurant_config(),
        "week_config": load_week_config(),
    }


@router.put("")
def put_restaurant(payload: RestaurantPayload):
    return {
        "restaurant_config": save_restaurant_config(payload.restaurant_config),
        "week_config": save_week_config(payload.week_config),
    }


@router.put("/{restaurant_id}")
def put_restaurant_by_id(restaurant_id: str, payload: RestaurantPayload):
    return {
        "restaurant_id": restaurant_id,
        "restaurant_config": save_restaurant_config(payload.restaurant_config),
        "week_config": save_week_config(payload.week_config),
    }
