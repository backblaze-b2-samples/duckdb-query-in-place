<!-- last_verified: 2026-06-16 -->
# Feature: Dashboard

## Purpose
Provide an at-a-glance overview of query-in-place activity across the B2 bucket.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /files/stats`, `GET /query/history`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 stat cards (Datasets, Result slices, Queries run, Bucket size)
- `apps/web/src/components/dashboard/query-chart.tsx` — bar chart of materialized queries per day (from history)
- `apps/web/src/components/dashboard/recent-queries-table.tsx` — last 10 materialized queries
- `apps/web/src/lib/api-client.ts` — `getFileStats()`, `getQueryHistory()`
- `services/api/app/runtime/files.py` — `GET /files/stats` handler
- `services/api/app/service/files.py` — `get_stats()` (adds dataset/result/query counts)
- `services/api/app/repo/b2_client.py` — `get_upload_stats()` counts objects by prefix

## Canonical Files
- Stat cards layout: `apps/web/src/components/dashboard/stats-cards.tsx`
- Stats service logic: `services/api/app/service/files.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /files/stats` → `UploadStats` (total_files, total_size_*, uploads_today, total_downloads, **total_datasets**, **total_results**, **total_queries**)
- `GET /query/history` → `SavedQuery[]` for the chart + recent-queries table

## Flow
- Page loads → stats + query history fetched via TanStack Query
- Stat cards show Datasets (`datasets/` count), Result slices (`query-results/` count), Queries run (history length), Bucket size
- Query chart buckets the durable history by day over the last 7 days
- Recent queries table shows the last 10 materialized queries (name, SQL, rows, when)

## Edge Cases
- API unavailable → stat cards show an inline ErrorState; tables/chart show empty/error states
- No queries yet → empty chart + table messages
- Large bucket → stats endpoint paginates through all objects using `ContinuationToken`

## UX States
- Loading: skeleton placeholders for cards and table
- Empty: "No queries yet" messaging
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_download_stats.py`, `services/api/tests/test_query.py`
- Required cases: stats with objects, stats with empty bucket, query-count reflected in stats
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
