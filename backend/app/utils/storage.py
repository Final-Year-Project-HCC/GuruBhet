import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

_s3 = None


def get_s3_client():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
        )
    return _s3


def upload_file(bucket: str, key: str, file_bytes: bytes, content_type: str) -> str:
    """Upload bytes to S3. Returns the public/presigned URL."""
    s3 = get_s3_client()
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"{settings.S3_ENDPOINT_URL}/{bucket}/{key}"


def generate_presigned_url(bucket: str, key: str, expires_in: int = 3600) -> str:
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_object(bucket: str, key: str) -> None:
    s3 = get_s3_client()
    s3.delete_object(Bucket=bucket, Key=key)