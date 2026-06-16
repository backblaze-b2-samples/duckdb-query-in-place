"""Query orchestration: guard user SQL, run it, persist materialized results.

This layer sits between the HTTP routes and the DuckDB repo. It applies
lightweight, defense-in-depth SQL guards (the real sandbox is enforced by
DuckDB itself — see `repo/duckdb_client.py`), turns a user-supplied result
name into a safe `query-results/<slug>.parquet` key, and keeps a durable
catalog of materialized queries on local disk using the same atomic-write
pattern as the download counter in `service/files.py`.
"""

import contextlib
import json
import logging
import os
import re
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock

from app.config import settings
from app.repo import materialize as repo_materialize
from app.repo import run_query as repo_run_query
from app.types import QueryResult, SavedQuery

logger = logging.getLogger(__name__)

# Statements that mutate the engine, the host, or the secret. The console is
# read-only-by-design — writes happen only through the sanctioned
# materialize path (a server-built COPY), never through raw user SQL.
_FORBIDDEN_STATEMENTS = re.compile(
    r"^\s*(attach|detach|install|load|set|reset|create|drop|alter|insert|"
    r"update|delete|copy|export|import|pragma|call)\b",
    re.IGNORECASE,
)
_SLUG_STRIP_RE = re.compile(r"[^a-z0-9]+")
_RESULT_PREFIX = "query-results/"

_history_lock = Lock()


class QueryError(Exception):
    """Raised when a query is rejected or fails. Maps to HTTP 400."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _guard_select(sql: str) -> None:
    """Reject anything that isn't a plain read statement.

    A single statement only — semicolon-separated batches are refused so a
    benign-looking SELECT can't smuggle a second statement after it.
    """
    stripped = sql.strip().rstrip(";")
    if ";" in stripped:
        raise QueryError("Only a single statement is allowed.")
    if _FORBIDDEN_STATEMENTS.match(stripped):
        raise QueryError(
            "Only read queries (SELECT / WITH / FROM ...) are allowed in the "
            "console. Use Materialize to write results back to B2."
        )


def run_query(sql: str, max_rows: int | None = None) -> QueryResult:
    """Validate and run a read query, returning a bounded preview."""
    _guard_select(sql)
    cap = max_rows or settings.max_query_rows
    cap = min(cap, settings.max_query_rows)
    try:
        result = repo_run_query(sql, cap)
    except RuntimeError as e:
        raise QueryError(f"Query failed: {e}") from None
    return QueryResult(**result)


def _slugify(name: str) -> str:
    slug = _SLUG_STRIP_RE.sub("-", name.strip().lower()).strip("-")
    slug = slug[:80] or "result"
    return slug


def materialize_query(sql: str, name: str) -> SavedQuery:
    """Run a SELECT and write its full result to `query-results/<slug>.parquet`.

    The destination key is built entirely server-side from a sanitized slug
    plus a short unique suffix — user input never controls an arbitrary
    write location.
    """
    _guard_select(sql)
    slug = _slugify(name)
    short = uuid.uuid4().hex[:8]
    dest_key = f"{_RESULT_PREFIX}{slug}-{short}.parquet"
    try:
        out = repo_materialize(sql, dest_key)
    except RuntimeError as e:
        raise QueryError(f"Materialize failed: {e}") from None

    saved = SavedQuery(
        id=short,
        name=name.strip()[:120],
        sql=sql.strip(),
        result_key=out["key"],
        rows_written=out["rows_written"],
        created_at=datetime.now(UTC),
    )
    _append_history(saved)
    logger.info(
        "Materialized query: key=%s rows=%d",
        saved.result_key,
        saved.rows_written,
    )
    return saved


# --- Durable history catalog (atomic write, mirrors files.py) ---


def _history_path() -> Path:
    p = Path(settings.query_history_file)
    if not p.is_absolute():
        p = Path(__file__).resolve().parents[2] / p
    return p


def _load_history() -> list[dict]:
    try:
        with open(_history_path()) as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError, ValueError, TypeError):
        return []


def _save_history(entries: list[dict]) -> None:
    """Atomically persist history. Caller must hold the history lock."""
    path = _history_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(
            dir=path.parent, prefix=path.name + ".", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(entries, f)
            os.replace(tmp, path)
        except Exception:
            with contextlib.suppress(OSError):
                os.unlink(tmp)
            raise
    except OSError as e:
        logger.warning("Failed to persist query history: %s", e)


def _append_history(saved: SavedQuery) -> None:
    with _history_lock:
        entries = _load_history()
        entries.append(json.loads(saved.model_dump_json()))
        # Keep the catalog bounded — newest 200 entries.
        _save_history(entries[-200:])


def get_query_history(limit: int = 50) -> list[SavedQuery]:
    """Return saved queries, newest first."""
    with _history_lock:
        entries = _load_history()
    entries.reverse()
    return [SavedQuery(**e) for e in entries[:limit]]


def get_query_count() -> int:
    with _history_lock:
        return len(_load_history())
