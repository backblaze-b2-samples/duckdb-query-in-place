<!-- last_verified: 2026-06-16 -->
# Reliability

Reliability expectations and practices for DuckDB Query-in-Place.

## Health Checks

- `GET /health` verifies B2 connectivity and returns `healthy` or `degraded` (plus the bucket name the SQL Console uses to build `s3://` paths)
- Health endpoint is always available, even when B2 is down

## Error Handling

- HTTP handlers return structured error responses with appropriate status codes
- A failed or rejected query returns **400** with a readable message (bad SQL, non-read statement, missing file) — the engine error is surfaced, not a stack trace
- DuckDB engine errors are caught at the repo boundary and re-raised as `RuntimeError`, then mapped to `QueryError` -> HTTP 400 by the service/runtime layers
- B2 (boto3) failures are caught and surfaced as 500/503 responses
- No unhandled exceptions leak stack traces to clients

## Query Engine

- A single cached, hardened DuckDB connection is initialized lazily on first query and reused for the process lifetime (`functools.lru_cache`)
- Each query/materialize runs on its own cursor so results don't bleed between calls
- Result previews are bounded by `max_query_rows` (default 1000) — large result sets never flood the browser; the full result goes to B2 via materialize

## Logging

- Structured JSON logging via Python stdlib
- Every request gets a `request_id` for tracing
- Log levels: ERROR for failures, WARNING for degraded state, INFO for requests

## Observability

- Request timing middleware logs duration for every request
- `/metrics` endpoint exposes basic Prometheus-format counters
- Upload success/failure counts tracked

## Graceful Degradation

- File and result listings return an empty list (not an error) when B2 has no matching objects
- Query history persistence failures are logged and swallowed — they never break a materialize
- Frontend shows skeleton states while loading, error states on failure

## Deployment

- Railway health checks on `/health`
- Zero-downtime deploys via rolling updates
- Environment-specific configuration via env vars (no config files in prod)
