<!-- last_verified: 2026-06-16 -->
# App Workflows

User journeys inside the application.

## Query files in place

- User navigates to `/query` (SQL Console)
- (Optional) picks a dataset from the **dataset picker** — inserts a
  `read_parquet('s3://<bucket>/datasets/...')` (or `read_csv_auto` /
  `read_json_auto`) snippet into the editor
- Writes a `SELECT` and presses **Run query** (or ⌘/Ctrl+Enter)
- API guards the SQL (read-only, single statement) and runs it through DuckDB
  `httpfs`; only the needed row groups stream from B2
- A bounded result preview renders in a sortable, paginated table with row
  count, truncation flag, and duration
- On error (bad SQL, missing file, 403): inline `ErrorState` with the message
- See: [SQL Console](features/sql-console.md)

## Materialize a result to B2

- With a query in the editor, user clicks **Materialize to B2** and names it
- API sanitizes the name to `query-results/<slug>.parquet` and runs
  `COPY (...) TO 's3://...'` — the full result is written to the bucket
- A toast confirms rows written + the result key; a history entry is appended
- See: [Materialize Results](features/materialize-results.md)

## Browse and fetch results

- User navigates to `/results` (Results Library)
- The page lists every Parquet slice under `query-results/` with size + date
- Click the download icon to open a presigned URL for the slice
- Empty state prompts the user to materialize a query first
- See: [Results Library](features/results-library.md)

## Upload a dataset

- User navigates to `/upload`
- Drops or selects CSV / JSON / log / Parquet files (max 100MB)
- Client validates type + size; the file lands under `datasets/`
- On success: toast + green checkmark; the dataset picker now lists it
- See: [File Upload](features/file-upload.md)

## Browse the whole bucket

- User navigates to `/files`
- Tree view of every object in the bucket with preview / download / delete
- See: [File Browser](features/file-browser.md)

## View the dashboard

- User navigates to `/` (home)
- Stats cards: Datasets, Result slices, Queries run, Bucket size
- Query-activity chart (materialized queries over the last 7 days)
- Recent queries table (name, SQL, rows, when) from the durable history
- See: [Dashboard](features/dashboard.md)
