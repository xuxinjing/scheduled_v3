"""Compatibility wrapper matching the BUILD_WEBAPP service layout."""
from .email_service import EmailDeliveryError, EmailDeliveryResult, send_schedule_email

__all__ = ["EmailDeliveryError", "EmailDeliveryResult", "send_schedule_email"]
