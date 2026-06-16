from fastapi import APIRouter

from app.config import settings
from app.repo import check_connectivity

router = APIRouter()


@router.get("/health")
async def health():
    b2_ok = check_connectivity()
    return {
        "status": "healthy" if b2_ok else "degraded",
        "b2_connected": b2_ok,
        # The SQL console needs the bucket name to build `s3://<bucket>/...`
        # paths from the dataset picker. It's not a secret (the key is).
        "bucket": settings.b2_bucket_name,
    }
