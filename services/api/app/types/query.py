from datetime import datetime

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    """A SQL statement to run against files in B2, plus a row cap."""

    sql: str = Field(min_length=1, max_length=20_000)
    max_rows: int | None = Field(default=None, ge=1, le=10_000)


class QueryResult(BaseModel):
    """Bounded preview of a query's output returned to the browser."""

    columns: list[str]
    rows: list[list[object]]
    row_count: int
    truncated: bool
    duration_ms: float


class MaterializeRequest(BaseModel):
    """Persist a query's full result to B2 as a Parquet slice.

    `name` is a user-supplied label only — the server sanitizes it into a
    `query-results/<slug>.parquet` key. The client never controls the
    write path directly.
    """

    sql: str = Field(min_length=1, max_length=20_000)
    name: str = Field(min_length=1, max_length=120)


class SavedQuery(BaseModel):
    """A history entry: the SQL that ran and where its result landed."""

    id: str
    name: str
    sql: str
    result_key: str
    rows_written: int
    created_at: datetime
