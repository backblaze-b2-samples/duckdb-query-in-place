<!-- last_verified: 2026-06-16 -->
# Security

Security principles and implementation for DuckDB Query-in-Place.

## Threat model — this is a local-dev tool, not multi-tenant

The SQL Console runs **arbitrary user SQL against the user's own B2 bucket
with the user's own credentials**. There is exactly one trust principal: the
person running the app locally. This is the right model for a single-user
analytics tool, and explicitly **not** safe to expose to untrusted users or
deploy as a shared multi-tenant service without adding authn/authz and
per-tenant credential isolation.

The arbitrary-SQL surface is therefore hardened to limit blast radius, not to
support untrusted callers.

## Arbitrary-SQL hardening (DuckDB engine)

In `services/api/app/repo/duckdb_client.py`, after the B2 secret is created:

- `SET disabled_filesystems='LocalFileSystem'` — user SQL can read/write S3
  (B2) but **cannot read or write the host filesystem** (no
  `read_csv('/etc/passwd')`, no local writes).
- `SET lock_configuration=true` — user SQL **cannot change settings or
  rewrite the secret**, so the disabled-filesystem guard cannot be undone.

These are set in that order: lock only after the secret exists.

Defense in depth at the service layer (`service/query.py`):

- **Read-only console.** Only `SELECT` / `WITH` style statements pass; DDL/DML
  (`DROP`, `INSERT`, `COPY`, `ATTACH`, `SET`, `PRAGMA`, …) is rejected.
- **Single statement only.** Semicolon-separated batches are refused, so a
  benign SELECT can't smuggle a second statement.

## Materialize destination is server-controlled

`POST /query/materialize` takes a SQL statement and a free-text *name*. The
name never controls the write path: the service slugifies it and builds the
key entirely server-side as `query-results/<slug>-<random>.parquet`. User
input cannot pick an arbitrary object key, cross prefixes, or path-traverse.

## Trust Boundaries

- **Frontend -> API**: CORS-restricted to configured origins, scoped to `GET/POST/DELETE/OPTIONS`
- **API -> B2**: Authenticated via `B2_APPLICATION_KEY_ID` + `B2_APPLICATION_KEY`, signature v4, on both the boto3 client and the DuckDB S3 secret
- **Client -> B2**: Presigned URLs for download (10-min expiry, `Content-Disposition: attachment`)

## Upload Validation

- Filename sanitization: path traversal, null bytes, unsafe chars stripped
- MIME/extension consistency check against allowlist
- Chunked streaming with size enforcement (100MB default)
- Content-type allowlist (CSV, JSON, plain text/log, Parquet — analytics formats only)
- Empty file rejection
- Datasets land under the `datasets/` prefix

## File Key Validation

- Empty keys rejected
- Path traversal patterns rejected (`../`, `%2e%2e`, backslashes, null bytes)
- The bucket is the only access boundary — add prefix scoping in
  `services/api/app/service/files.py::validate_key` if your deployment shares
  a bucket with other workloads

## Secrets Management

- B2 credentials are the **only** secret; there is no second API key
- All secrets loaded via environment variables (pydantic-settings)
- Never committed to source control; `.env.example` documents the required
  `B2_*` variables without values

## Agent Security Rules

- Never commit `.env`, credentials, or API keys
- Never weaken the SQL guards or the DuckDB sandbox without explicit instruction
- Never let user input control a write key — keep materialize destinations server-built
- Always validate at system boundaries
