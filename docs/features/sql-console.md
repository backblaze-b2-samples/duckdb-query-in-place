<!-- last_verified: 2026-06-16 -->
# Feature: SQL Console

## Purpose
Run read-only SQL directly against files in the B2 bucket via DuckDB `httpfs`,
returning a bounded result preview — no ETL, no warehouse.

## Used By
- UI: `/query` page, `apps/web/src/components/query/*`
- API: `POST /query/run`

## Core Functions
- `apps/web/src/components/query/sql-editor.tsx` — textarea editor, ⌘/Ctrl+Enter to run
- `apps/web/src/components/query/results-table.tsx` — renders the preview via the shared `ui/data-table`
- `apps/web/src/components/query/dataset-picker.tsx` — lists `datasets/` keys, inserts an `s3://` reader snippet
- `apps/web/src/lib/queries.ts` — `useRunQuery()` mutation
- `services/api/app/runtime/query.py` — `POST /query/run`
- `services/api/app/service/query.py` — read-only SQL guards, row cap
- `services/api/app/repo/duckdb_client.py` — `run_query()` (the DuckDB engine)

## Canonical Files
- DuckDB engine: `services/api/app/repo/duckdb_client.py`
- Query orchestration: `services/api/app/service/query.py`

## Inputs
- `sql`: string (the read query)
- `max_rows`: int? (preview cap; clamped to the server's `max_query_rows`, default 1000)

## Outputs
- `QueryResult`: `columns`, `rows`, `row_count`, `truncated`, `duration_ms`
- Side effects: ranged `GET`s against B2 for the touched row groups (no local writes)

## Flow
- User writes SQL referencing files by `s3://<bucket>/<key>`
- Service guards the statement (read-only, single statement)
- `repo.run_query` runs it on the cached, hardened DuckDB connection
- Only the needed row groups stream from B2; a bounded preview is returned

## Edge Cases
- Non-read statement (DROP/INSERT/SET/…) → 400 with explanation
- Multiple statements → 400
- Bad SQL / missing file / 403 from B2 → 400 with the engine message
- Result larger than the cap → preview truncated (`truncated: true`); use Materialize for the full result

## UX States
- Empty: starter SQL in the editor
- Loading: "Running…" button state
- Error: inline `ErrorState`
- Loaded: results table with row count + duration

## Verification
- Test files: `services/api/tests/test_query.py`
- Required cases: read query passes, non-read rejected, multi-statement rejected, row cap clamped
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [Materialize Results](materialize-results.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/SECURITY.md](../SECURITY.md)
