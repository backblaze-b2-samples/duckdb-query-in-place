"""Unit tests for upload filename handling."""

from app.service import upload as upload_service
from app.types import FileUploadResponse


def test_upload_allows_duplicate_filename(monkeypatch):
    """B2 is always versioned — re-uploading the same name creates a new version."""
    monkeypatch.setattr(
        upload_service,
        "upload_file",
        lambda file_data, key, content_type: FileUploadResponse(
            key=key,
            filename="report.csv",
            size_bytes=len(file_data),
            size_human="5 B",
            content_type=content_type,
            uploaded_at="2026-02-14T00:00:00Z",
            url=None,
            metadata=None,
        ),
    )

    result = upload_service.process_upload(
        file_data=b"a,b\n1,2",
        filename="report.csv",
        content_type="text/csv",
        content_length=7,
    )

    assert result.key == "datasets/report.csv"


def test_upload_uses_original_filename(monkeypatch):
    monkeypatch.setattr(
        upload_service,
        "upload_file",
        lambda file_data, key, content_type: FileUploadResponse(
            key=key,
            filename="report.csv",
            size_bytes=len(file_data),
            size_human="5 B",
            content_type=content_type,
            uploaded_at="2026-02-14T00:00:00Z",
            url=None,
            metadata=None,
        ),
    )

    result = upload_service.process_upload(
        file_data=b"a,b\n1,2",
        filename="report.csv",
        content_type="text/csv",
        content_length=7,
    )

    assert result.key == "datasets/report.csv"
