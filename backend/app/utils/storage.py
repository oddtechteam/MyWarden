"""
Storage abstraction — S3/MinIO in production, local filesystem in dev.

Mode is selected automatically:
  - STORAGE_BACKEND=local  (or S3_ENDPOINT_URL and AWS_ACCESS_KEY_ID both blank) → files saved to LOCAL_STORAGE_PATH
  - STORAGE_BACKEND=s3     → AWS S3 or MinIO via boto3

Switch by setting STORAGE_BACKEND=local in .env — no code changes needed.
"""
import logging
import os
from pathlib import Path

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


def _use_local() -> bool:
    return (
        settings.STORAGE_BACKEND == "local"
        or (not settings.S3_ENDPOINT_URL and not settings.AWS_ACCESS_KEY_ID)
    )


# ── Local filesystem ────────────────────────────────────────────────────────

def _local_root() -> Path:
    root = Path(settings.LOCAL_STORAGE_PATH)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _local_upload(file_bytes: bytes, key: str) -> str:
    dest = _local_root() / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(file_bytes)
    logger.debug("Local storage: saved %s (%d bytes)", dest, len(file_bytes))
    return key


def _local_url(key: str) -> str:
    return str((_local_root() / key).resolve())


# ── S3 / MinIO ──────────────────────────────────────────────────────────────

def get_s3_client() -> BaseClient:
    kwargs: dict = {
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
    }
    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def ensure_bucket_exists() -> None:
    """Create the S3/MinIO bucket if it doesn't already exist. No-op in local mode."""
    if _use_local():
        _local_root()
        logger.info("Local storage ready at: %s", settings.LOCAL_STORAGE_PATH)
        return
    try:
        client = get_s3_client()
        try:
            client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchBucket"):
                client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
                logger.info("Created bucket: %s", settings.S3_BUCKET_NAME)
            else:
                raise
    except Exception as exc:
        logger.warning("Could not ensure bucket exists (%s): %s", settings.S3_BUCKET_NAME, exc)


# ── Public API ──────────────────────────────────────────────────────────────

def upload_bytes(file_bytes: bytes, key: str, content_type: str = "image/jpeg") -> str:
    if _use_local():
        return _local_upload(file_bytes, key)
    client = get_s3_client()
    client.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return key


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    if _use_local():
        return _local_url(key)
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )
