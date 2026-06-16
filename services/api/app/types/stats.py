from pydantic import BaseModel


class DailyUploadCount(BaseModel):
    """Daily count of queries run, keyed by date (repurposed from uploads)."""

    date: str
    uploads: int


class UploadStats(BaseModel):
    """Bucket + query-activity stats shown on the dashboard.

    The base fields describe the whole bucket; the trailing fields are
    query-centric. They default to 0 so callers that only know the
    bucket-level numbers can still construct the model.
    """

    total_files: int
    total_size_bytes: int
    total_size_human: str
    uploads_today: int
    total_downloads: int
    total_datasets: int = 0
    total_results: int = 0
    total_queries: int = 0
