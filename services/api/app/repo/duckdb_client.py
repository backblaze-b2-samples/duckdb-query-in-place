"""DuckDB query engine — the external-engine adapter for query-in-place.

DuckDB (with the `httpfs` extension) is the second external engine in this
app, alongside boto3. Following the same containment rule that keeps boto3
inside `repo/`, every `import duckdb` and every line of DuckDB SQL plumbing
lives in this module. Higher layers call `run_query` / `materialize` and
never see a connection object.

How it talks to B2
------------------
`httpfs` speaks the S3-compatible API. On first use we:

1. open a connection with the shared Backblaze samples user agent
   (Standard #2 — the per-app identity on the DuckDB S3 path);
2. `INSTALL httpfs; LOAD httpfs;`
3. `CREATE SECRET ... (TYPE s3, ...)` built from the `B2_*` settings, with
   the endpoint reduced to a bare host (httpfs wants `s3.<region>...`, not a
   URL) and `URL_STYLE 'path'` because B2 uses path-style addressing.

Sandbox hardening
-----------------
This console runs *arbitrary user SQL*. After configuration we lock it down:

- `SET disabled_filesystems='LocalFileSystem'` — user SQL can read/write S3
  but cannot touch the host disk (no `read_csv('/etc/passwd')`).
- `SET lock_configuration=true` — user SQL can no longer change settings or
  rewrite the secret, so the disabled-filesystem guard can't be undone.

Both are set *after* the secret is created, never before.
"""

import functools
import logging

import duckdb

from app.config import B2_USER_AGENT, settings

logger = logging.getLogger(__name__)

# Columns/rows are returned as plain Python primitives so nothing
# DuckDB-specific leaks past the repo boundary.
QueryRows = list[list[object]]


def _endpoint_host() -> str:
    """Reduce the derived B2 endpoint to a bare host for httpfs.

    The S3 URL is derived from `B2_REGION`, while DuckDB's S3 secret expects
    just the host. Strip the scheme and any trailing slash.
    """
    host = settings.b2_s3_url
    for scheme in ("https://", "http://"):
        if host.startswith(scheme):
            host = host[len(scheme) :]
            break
    return host.rstrip("/")


@functools.lru_cache(maxsize=1)
def _get_connection() -> "duckdb.DuckDBPyConnection":
    """Build (once) a configured, hardened in-memory DuckDB connection.

    Cached for the process lifetime: the secret and httpfs only need to be
    set up once, and a single connection serializes queries safely for a
    local-dev tool.
    """
    con = duckdb.connect(
        database=":memory:",
        config={"custom_user_agent": B2_USER_AGENT},
    )
    con.execute("INSTALL httpfs")
    con.execute("LOAD httpfs")
    con.execute(
        """
        CREATE OR REPLACE SECRET b2 (
            TYPE s3,
            KEY_ID $key_id,
            SECRET $secret,
            ENDPOINT $endpoint,
            REGION $region,
            URL_STYLE 'path',
            USE_SSL true
        )
        """,
        {
            "key_id": settings.b2_application_key_id,
            "secret": settings.b2_application_key,
            "endpoint": _endpoint_host(),
            "region": settings.b2_region,
        },
    )
    # Hardening — order matters: lock only after the secret exists.
    con.execute("SET disabled_filesystems='LocalFileSystem'")
    con.execute("SET lock_configuration=true")
    logger.info("DuckDB engine initialized (httpfs + B2 secret, sandboxed)")
    return con


def run_query(sql: str, max_rows: int) -> dict:
    """Execute a read SQL statement and return a bounded result preview.

    Returns a dict with: columns, rows, row_count, truncated, duration_ms.
    `max_rows` caps what crosses back to the browser; the engine itself
    streams only the row groups it needs straight from B2.

    Raises RuntimeError on any engine error (caller maps to HTTP 400).
    """
    import time

    con = _get_connection()
    start = time.perf_counter()
    try:
        # Cursor isolates this statement's result from the shared connection.
        cur = con.cursor()
        rel = cur.execute(sql)
        columns = [d[0] for d in rel.description] if rel.description else []
        # Fetch one extra row to detect truncation without a second query.
        fetched = rel.fetchmany(max_rows + 1)
        truncated = len(fetched) > max_rows
        rows = [list(r) for r in fetched[:max_rows]]
    except duckdb.Error as e:
        raise RuntimeError(str(e)) from e
    finally:
        duration_ms = (time.perf_counter() - start) * 1000.0
    return {
        "columns": columns,
        "rows": _jsonable(rows),
        "row_count": len(rows),
        "truncated": truncated,
        "duration_ms": round(duration_ms, 1),
    }


def materialize(select_sql: str, dest_key: str) -> dict:
    """Write the result of `select_sql` to B2 as a Parquet object.

    `dest_key` is a fully-formed, server-sanitized object key (the service
    layer guarantees it lands under `query-results/`). Returns the written
    object's key plus the row count DuckDB reports for the COPY.

    Raises RuntimeError on any engine error (caller maps to HTTP 400).
    """
    con = _get_connection()
    bucket = settings.b2_bucket_name
    dest = f"s3://{bucket}/{dest_key}"
    copy_sql = (
        f"COPY ({select_sql}) TO '{_escape_single_quotes(dest)}' "
        "(FORMAT parquet)"
    )
    try:
        cur = con.cursor()
        result = cur.execute(copy_sql).fetchone()
        rows_written = int(result[0]) if result else 0
    except duckdb.Error as e:
        raise RuntimeError(str(e)) from e
    return {"key": dest_key, "rows_written": rows_written}


def _escape_single_quotes(value: str) -> str:
    """Escape single quotes for safe interpolation into a SQL string literal.

    `dest` is built from a server-sanitized key + bucket name, so this is a
    defense-in-depth measure rather than the primary guard.
    """
    return value.replace("'", "''")


def _jsonable(rows: QueryRows) -> QueryRows:
    """Coerce non-JSON-native cell values (dates, decimals, bytes) to str.

    DuckDB returns rich Python types (datetime, Decimal, UUID, memoryview).
    The API returns rows as JSON, so anything the encoder can't handle is
    stringified at the boundary. Numbers, bools, and None pass through.
    """
    out: QueryRows = []
    for row in rows:
        out.append([_jsonable_cell(cell) for cell in row])
    return out


def _jsonable_cell(cell: object) -> object:
    if cell is None or isinstance(cell, (bool, int, float, str)):
        return cell
    if isinstance(cell, (bytes, bytearray, memoryview)):
        return f"<{len(bytes(cell))} bytes>"
    return str(cell)
