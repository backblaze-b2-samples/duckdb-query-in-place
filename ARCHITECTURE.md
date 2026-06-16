<!-- last_verified: 2026-06-16 -->
# Architecture

DuckDB Query-in-Place runs SQL against files in a Backblaze B2 bucket and
materializes results back to B2. Two external engines do the work: **boto3**
(object management) and **DuckDB + httpfs** (the query path). Both are
contained in the `repo/` layer.

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - SQL Console (`/query`) — editor, results table, dataset picker, materialize dialog, history
  - Results Library (`/results`) — explorer scoped to the `query-results/` prefix
  - Query-activity dashboard — stats, query chart, recent queries
  - File upload (datasets) and full-bucket file browser
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - `POST /query/run` — run a read query against B2 via DuckDB httpfs
  - `POST /query/materialize` — write a result to `query-results/<slug>.parquet`
  - `GET /query/history` — durable catalog of materialized queries
  - REST API for dataset upload, listing, deletion, presigned download
  - B2 S3 integration via boto3; query engine via DuckDB
  - Health check (`/health`, returns bucket name), JSON logging, `/metrics`
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API (file + query types)
  - Consumed by `apps/web/` as workspace dependency

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (FileMetadata, UploadStats, etc.)
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic (upload, files, metadata)
    runtime/               FastAPI route handlers
  tests/                   pytest tests (structural + integration)
```

## The DuckDB query engine (repo layer)

`app/repo/duckdb_client.py` is the only place `duckdb` is imported — the same
containment rule applied to boto3. On first use it builds a single cached,
hardened in-memory connection:

1. open with `custom_user_agent='b2ai-duckdb-query-in-place'` (Standard #2 on the DuckDB S3 path);
2. `INSTALL httpfs; LOAD httpfs;`
3. `CREATE SECRET ... (TYPE s3, KEY_ID, SECRET, ENDPOINT <host-only>, REGION, URL_STYLE 'path', USE_SSL true)` built from the `B2_*` settings (the endpoint is reduced to a bare host);
4. **harden**: `SET disabled_filesystems='LocalFileSystem'` then `SET lock_configuration=true` — user SQL can read/write S3 but cannot touch the host disk or change settings/rewrite the secret.

It exposes two functions and nothing DuckDB-specific crosses the boundary:
- `run_query(sql, max_rows)` → `{columns, rows, row_count, truncated, duration_ms}`
- `materialize(select_sql, dest_key)` → writes `COPY (...) TO 's3://<bucket>/<dest_key>' (FORMAT parquet)` and returns `{key, rows_written}`

The service layer (`service/query.py`) applies read-only SQL guards and turns
a user-supplied name into a server-built `query-results/<slug>.parquet` key —
user input never controls the write path.

## Boundary Invariants

- **No external SDK/engine leakage**: `boto3` and `duckdb` are imported only in `app/repo/`. All other layers go through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No mutable globals**: Configuration is read-only after init. The query history is the only durable mutable state and uses an atomic-write pattern.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. File keys validated against a path-traversal allowlist; materialize destinations are server-sanitized.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repo
  - See `infra/railway/README.md` for configuration

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API), the analytics lake
  - `datasets/` — uploaded source files (CSV / JSON / log / Parquet)
  - `query-results/` — materialized Parquet slices
  - File listing/metadata via S3 `list_objects_v2` / `head_object`
- **`data/query_history.json`** — small durable catalog of materialized queries (atomic-write, local disk); the only application-side store.

## External Services

- **Backblaze B2 S3 API** — object management (boto3) and query-in-place I/O (DuckDB httpfs: ranged GETs for reads, PUT/multipart for COPY writes). No b2-native API anywhere. No second external API — B2 credentials are the only secret.

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Query**: Browser SQL -> `POST /query/run` -> service guards (read-only, single statement) -> `repo.run_query` -> DuckDB httpfs issues ranged GETs against B2 -> bounded row preview returned
- **Materialize**: Browser -> `POST /query/materialize` (sql + name) -> service sanitizes name to `query-results/<slug>.parquet` -> `repo.materialize` runs `COPY (...) TO 's3://...'` -> history appended -> `SavedQuery` returned
- **Upload (dataset)**: Browser -> `POST /upload` (multipart) -> API validates type/size -> service writes to `datasets/<name>` -> basic metadata (size + checksums) -> response
- **List / Download / Delete**: Browser -> `GET /files`, `GET /files/{key}/download`, `DELETE /files/{key}` -> service validates key -> repo lists / presigns / deletes in B2

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## Canonical Files

- DuckDB query engine (repo layer): `services/api/app/repo/duckdb_client.py`
- B2 object access (repo layer): `services/api/app/repo/b2_client.py`
- Query orchestration + guards + history: `services/api/app/service/query.py`
- Query routes: `services/api/app/runtime/query.py`
- Pydantic models: `services/api/app/types/` (`query.py`, `files.py`, `upload.py`, `stats.py`, `formatting.py`)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [SQL Console](docs/features/sql-console.md)
- [Materialize Results](docs/features/materialize-results.md)
- [Results Library](docs/features/results-library.md)
- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)
- [Dashboard](docs/features/dashboard.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
