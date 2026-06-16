from datetime import datetime

from pydantic import BaseModel


class FileMetadata(BaseModel):
    key: str
    filename: str
    folder: str
    size_bytes: int
    size_human: str
    content_type: str
    uploaded_at: datetime
    url: str | None = None


class FileMetadataDetail(BaseModel):
    """Basic file info returned alongside an upload.

    This sample is an analytics console, not a media library, so the rich
    image/PDF/audio metadata the starter kit extracted has been removed —
    a dataset upload only needs its identity, size, type, and checksums.
    """

    filename: str
    size_bytes: int
    size_human: str
    mime_type: str
    extension: str
    md5: str
    sha256: str
    uploaded_at: datetime
