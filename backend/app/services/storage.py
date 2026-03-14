"""Artifact storage with local-disk fallback and optional S3 upload."""
from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path

from ..core.settings import get_settings


@dataclass
class StoredArtifact:
    key: str
    local_path: str
    storage_url: str


def store_artifact(local_path: Path, *, schedule_id: str, artifact_name: str) -> StoredArtifact:
    settings = get_settings()
    storage_url = str(local_path)
    if settings.s3_configured:
        storage_url = _upload_to_s3(local_path, schedule_id=schedule_id, artifact_name=artifact_name)
    return StoredArtifact(
        key=f"schedules/{schedule_id}/{artifact_name}",
        local_path=str(local_path),
        storage_url=storage_url,
    )


def _upload_to_s3(local_path: Path, *, schedule_id: str, artifact_name: str) -> str:
    try:
        import boto3
    except ModuleNotFoundError as exc:
        raise RuntimeError("boto3 is required for S3 artifact uploads") from exc

    settings = get_settings()
    client = boto3.client(
        "s3",
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region or "auto",
        endpoint_url=settings.s3_endpoint_url,
    )
    key = f"schedules/{schedule_id}/{artifact_name}"
    content_type = mimetypes.guess_type(artifact_name)[0] or "application/octet-stream"
    client.upload_file(
        str(local_path),
        settings.s3_bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    if settings.s3_public_base_url:
        return f"{settings.s3_public_base_url.rstrip('/')}/{key}"
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=7 * 24 * 60 * 60,
    )
