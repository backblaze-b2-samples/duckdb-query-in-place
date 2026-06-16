<!-- last_verified: 2026-06-16 -->
# Feature: Materialize Results

## Purpose
Write the full result of a query back to B2 as a Parquet slice under
`query-results/`, ready for training or reporting.

## Used By
- UI: `/query` page → "Materialize to B2" dialog (`apps/web/src/components/query/materialize-dialog.tsx`)
- API: `POST /query/materialize`

## Core Functions
- `apps/web/src/components/query/materialize-dialog.tsx` — name input + save action
- `apps/web/src/lib/queries.ts` — `useMaterialize()` mutation (invalidates files + stats + history)
- `services/api/app/runtime/query.py` — `POST /query/materialize`
- `services/api/app/service/query.py` — `materialize_query()`: guards, sanitizes name → key, appends history
- `services/api/app/repo/duckdb_client.py` — `materialize()`: `COPY (...) TO 's3://...' (FORMAT parquet)`

## Canonical Files
- Materialize orchestration: `services/api/app/service/query.py`
- COPY engine call: `services/api/app/repo/duckdb_client.py`

## Inputs
- `sql`: string (the SELECT to persist)
- `name`: string (free-text label only — never the write path)

## Outputs
- `SavedQuery`: `id`, `name`, `sql`, `result_key`, `rows_written`, `created_at`
- Side effects: a Parquet object written to `query-results/<slug>-<random>.parquet` in B2; a history entry appended to `data/query_history.json`

## Flow
- User opens the dialog, names the result, clicks Save
- Service guards the SQL (read-only) and slugifies the name into a server-built key
- `repo.materialize` runs `COPY (...) TO 's3://<bucket>/<key>' (FORMAT parquet)`
- History is appended; the Results Library + dashboard pick it up on cache invalidation

## Edge Cases
- Non-read statement → 400
- Name with traversal / unsafe chars → sanitized away; the key always stays under `query-results/`
- Engine/B2 failure → 400 with the message; no history entry written
- History persistence failure → logged and swallowed (does not fail the materialize)

## UX States
- Idle: "Materialize to B2" button (disabled until there's SQL)
- Loading: "Saving…"
- Success: toast with rows written + result key
- Error: toast with the failure detail

## Verification
- Test files: `services/api/tests/test_query.py`
- Required cases: server-sanitized key built from a malicious name, non-read rejected, history round-trip
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [SQL Console](sql-console.md)
- [Results Library](results-library.md)
- [docs/SECURITY.md](../SECURITY.md)
