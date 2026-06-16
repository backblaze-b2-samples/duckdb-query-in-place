<!-- last_verified: 2026-06-16 -->
# Feature: Results Library

## Purpose
A sample-scoped asset explorer for the Parquet slices materialized to
`query-results/`, each downloadable via a presigned URL.

## Used By
- UI: `/results` page, `apps/web/src/components/results/results-library.tsx`
- API: `GET /files?prefix=query-results/`, `GET /files/{key}/download`

## Core Functions
- `apps/web/src/components/results/results-library.tsx` — scoped list + presigned download
- `apps/web/src/lib/queries.ts` — `useFiles("query-results/")`
- `services/api/app/runtime/files.py` — `GET /files`, `GET /files/{key}/download`
- `services/api/app/repo/b2_client.py` — `list_files()`, `get_presigned_url()`

## Canonical Files
- Results view: `apps/web/src/components/results/results-library.tsx`
- (Reuses the same B2 list + presign path as the File Browser)

## Inputs
- None directly — the page lists the `query-results/` prefix
- key: string (chosen result, for download)

## Outputs
- `FileMetadata[]` scoped to `query-results/`
- `{ url }` presigned download (attachment disposition, 10-min expiry)

## Flow
- Page loads → `useFiles("query-results/")` lists materialized slices
- Each row shows name, size, created date
- Download icon → fetches a presigned URL and opens it

## Edge Cases
- No results yet → empty state prompting the user to materialize a query
- B2 unreachable → inline `ErrorState` with Retry
- Result deleted externally → 404 on download → toast

## UX States
- Empty: "No materialized results yet"
- Loading: skeleton rows
- Error: inline `ErrorState`
- Loaded: table of slices with download actions

## Verification
- Test files: covered indirectly by `services/api/tests/` list/download tests
- Required cases: list scoped to prefix, presigned download
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [Materialize Results](materialize-results.md)
- [File Browser](file-browser.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
