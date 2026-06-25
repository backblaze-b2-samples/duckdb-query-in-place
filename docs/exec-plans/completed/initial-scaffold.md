# Scaffold plan — `duckdb-query-in-place`

Source of truth: `.claude/scratch/starter-kit-template/`
(fresh `vibe-coding-starter-kit` clone). Target: `./duckdb-query-in-place`.

## 1. Purpose

`duckdb-query-in-place` is a B2 sample for **data analysts and ML engineers who
already have logs, exports, or raw datasets sitting in a Backblaze B2 bucket and
want to run ad-hoc SQL against those files directly — no ETL, no warehouse
spin-up.** The app embeds **DuckDB** with the `httpfs` extension pointed at B2's
S3-compatible endpoint. The user writes SQL in a browser console; DuckDB streams
only the relevant Parquet/CSV/JSON row groups straight from the bucket, returns a
result preview, and can **materialize** the result back to B2 as a Parquet slice
(`COPY ... TO 's3://...'`) ready for training or reporting. It demonstrates B2 as
a **query-in-place analytics lake with continuous read/write traffic**, not cold
storage. Runs on local OSS only — **B2 credentials are the sole secret; no second
API key.**

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling. Keep its scaffolding, strip what an analytics app
doesn't need, add the DuckDB query surface.

### KEEP (as-is — starter contract)
- **UI kit / design system**: all `apps/web/src/components/ui/*`, `globals.css`
  tokens, `/design` page + `components/design/*`. Never edit generated `ui/`.
- **Full-bucket File Explorer** (`/files`, `app/files/`, `components/files/*`,
  `lib/file-tree.ts`) — **NON-NEGOTIABLE keep** (browse the whole bucket).
- **Upload** (`/upload`, `app/upload/`, `components/upload/*`) — repurposed as
  "upload a dataset" (see trim of allowed types below); page + flow stay.
- **Settings** (`/settings`, `components/settings/*`).
- **Layout**: `app-sidebar.tsx` (nav adapted), `header.tsx`, `health-banner.tsx`,
  `theme-provider.tsx`, `command-palette.tsx`.
- **Backend layered architecture** (`types -> config -> repo -> service -> runtime`),
  structural tests (`tests/test_structure.py`), JSON logging, `/health`,
  `/metrics`, CORS, `scripts/{dev.sh,doctor.mjs,pick-port.mjs}` (env names updated).
- **boto3 `repo/b2_client.py`** for upload / list / head / delete / presign /
  stats. **TanStack Query** data layer (`lib/queries.ts`, `lib/api-client.ts`).
- **`packages/shared`** (renamed).

### ADD (new for duckdb-query-in-place)
**Backend** (all files < 300 lines):
- `services/api/app/repo/duckdb_client.py` — DuckDB engine, **external-engine
  containment lives in `repo/`** (mirrors boto3 rule). Singleton connection
  (`functools.lru_cache`) that on first use:
  `SET custom_user_agent='b2ai-duckdb-query-in-place (backblaze-b2-samples)'` (**Standard #2 on the
  DuckDB S3 path**), `INSTALL httpfs; LOAD httpfs;`, then
  `CREATE SECRET b2 (TYPE s3, KEY_ID ..., SECRET ..., ENDPOINT '<host-only>',
  REGION ..., URL_STYLE 'path', USE_SSL true)` built from `settings.*`. Endpoint is
  stripped of `https://`. **Sandbox hardening**: `SET disabled_filesystems='LocalFileSystem'`
  then `SET lock_configuration=true` so user SQL can't touch local disk or rewrite
  secrets/config. Exposes `run_query(sql, max_rows)` -> `(columns, rows, row_count,
  truncated, duration_ms)` and `materialize(select_sql, dest_key)` -> writes
  `COPY (...) TO 's3://<bucket>/<dest_key>' (FORMAT parquet)` and returns row/byte
  counts. No boto3 here.
- `services/api/app/service/query.py` — orchestration: light SQL guards, call
  `repo.run_query`; for materialize, sanitize the user-supplied name ->
  `query-results/<slug>.parquet`, call `repo.materialize`, then append to a
  durable catalog `data/query_history.json` (atomic-write pattern reused from
  `service/files.py` download counter). `get_query_history()`.
- `services/api/app/runtime/query.py` — router: `POST /query/run`,
  `POST /query/materialize`, `GET /query/history`. Register in `main.py`.
- `services/api/app/types/query.py` — Pydantic: `QueryRequest`, `QueryResult`,
  `MaterializeRequest`, `SavedQuery`. Export via `types/__init__.py`.
- Stats: extend `service/files.get_stats` (or a small `query` stat path) to add
  `total_datasets` (count under `datasets/`), `total_results` (count under
  `query-results/`), `total_queries` (len of history). Reuses `repo.list_files`.

**Frontend**:
- `/query` — **SQL console** (`app/query/page.tsx` + `components/query/*`:
  `sql-editor.tsx` textarea, `results-table.tsx` using the `ui/data-table`,
  `materialize-dialog.tsx`, `dataset-picker.tsx` that lists `datasets/` keys and
  inserts the `s3://...` path, `query-history.tsx`).
- `/results` — **sample-specific asset explorer** (**NON-NEGOTIABLE add**): a
  "Results Library" scoped to the `query-results/` prefix, listing materialized
  Parquet slices with size + presigned download. Built on `useFiles("query-results/")`
  + a scoped `components/results/*` view (reuses file-browser primitives).
- `lib/api-client.ts`: `runQuery`, `materializeQuery`, `getQueryHistory`.
- `lib/queries.ts`: `useRunQuery`, `useMaterialize` (mutations, invalidate
  `query-results/` + history + stats), `useQueryHistory`.
- `app-sidebar.tsx`: add **SQL Console** (`/query`) and **Results** (`/results`)
  nav entries; keep Dashboard / Upload / Files / Settings + Design.
- **Dashboard adaptation** (`app/page.tsx` + `components/dashboard/*`): replace
  upload-centric defaults with query-centric — stat cards (Datasets, Result
  slices, Queries run, Bucket size), a "queries over time" chart (repurpose
  `upload-chart` from history timestamps), and a "Recent queries" table from
  `query_history.json` (repurpose `recent-uploads-table`).

### TRIM (remove from starter — analytics app doesn't need them)
- `services/api/app/service/metadata.py` (image EXIF / PDF extraction).
- `Pillow`, `PyPDF2`, `python-magic` from `requirements.txt`.
- Rich `FileMetadataDetail` image/pdf/audio fields (`packages/shared/src/types.ts`
  + `types/files.py`) -> reduce to basic file info; `process_upload` stops calling
  `extract_metadata` (upload still returns key/filename/size/content_type).
- Simplify `components/files/file-metadata-panel.tsx` (drop EXIF/PDF sections).
- `docs/features/metadata-extraction.md` (deleted).
- `docs/images/*.png` (2 starter screenshots) + README "What it looks like"
  section — screenshots are added later by the `sample-4-screenshot` step.
- `docs/exec-plans/completed/2026-*.md` (5 starter historical plans); reset
  `docs/exec-plans/tech-debt-tracker.md` to an empty tracker.
- Upload **allowed types** (`service/upload.py` `ALLOWED_TYPES` /
  `MIME_EXTENSION_MAP`): drop image/video/audio/pdf/zip; keep `text/csv`,
  `application/json`, `text/plain`; **add Parquet** (`.parquet`, treated as
  `application/octet-stream` / `application/vnd.apache.parquet`). Upload prefix
  changes `uploads/` -> `datasets/`.

## 3. B2 surface (S3-compatible only — Standard #1 OK)
- `head_bucket` (health) / `put_object` (dataset upload) / `list_objects_v2`
  (file explorer, results library, dataset picker, stats) / `head_object` (file
  meta) / `delete_object` / `generate_presigned_url` (download/preview/result).
- **DuckDB `httpfs`**: ranged `GET` of Parquet row groups for queries;
  `PUT`/multipart for `COPY ... TO` materialize. All via the S3 API.
- **No native B2 API anywhere.** Custom user agent on **both** S3 clients:
  boto3 `user_agent_extra='b2ai-duckdb-query-in-place (backblaze-b2-samples)'`
  **and** DuckDB
  `custom_user_agent='b2ai-duckdb-query-in-place (backblaze-b2-samples)'`
  (**Standard #2 OK**).

## 4. Key features (seed README + `docs/features/*` stubs)
1. **SQL console** — write SQL in the browser, run it against files in B2.
2. **Query-in-place over B2** — DuckDB `httpfs` reads Parquet/CSV/JSON directly
   from the bucket; only needed row groups stream over the wire. No ETL.
3. **Materialize to B2** — `COPY ... TO` writes filtered Parquet slices back to
   `query-results/`.
4. **Results Library** — sample-scoped explorer of materialized slices, each
   downloadable via presigned URL.
5. **Dataset upload + full bucket explorer** — upload source datasets; browse the
   whole bucket.
6. **Query history** — saved queries + result pointers tracked on the dashboard.

**External API provider: NONE.** DuckDB runs locally via the `duckdb` Python
package (add `duckdb>=1.1.0` to `requirements.txt`; `httpfs` autoloads/installs).
B2 credentials only. **Estimated cost per full demo run: $0.** No extra env var.

## 5. Doc transforms
- **Rewrite**: `README.md` (title, pitch, quick-start, features, commands,
  env-var setup -> Standard #3), `AGENTS.md` (branding + section 2 keep/adapt
  mentions query/results, repo map adds duckdb_client), `ARCHITECTURE.md` (DuckDB
  engine in `repo/`, query data flow), `docs/app-workflows.md` (query ->
  materialize -> fetch journey), `docs/dev-workflows.md`, `docs/design-system.md`
  (branding), `docs/SECURITY.md` (**add**: arbitrary-SQL console runs against the
  user's own bucket with their creds; local-dev tool, not multi-tenant; local FS
  disabled + config locked; materialize destination is server-sanitized to
  `query-results/`), `docs/RELIABILITY.md`,
  `docs/features/{file-upload,file-browser,dashboard}.md`.
- **Delete**: `docs/features/metadata-extraction.md`.
- **Stub (new)**: `docs/features/sql-console.md`,
  `docs/features/materialize-results.md`, `docs/features/results-library.md`
  (from `_template.md`).

## 6. Rename table
| From (`vibe-coding-starter-kit`) | To (`duckdb-query-in-place`) |
|---|---|
| kebab `vibe-coding-starter-kit` | `duckdb-query-in-place` |
| root `package.json` name | `duckdb-query-in-place` |
| npm scope `@vibe-coding-starter-kit/web` | `@duckdb-query-in-place/web` |
| npm scope `@vibe-coding-starter-kit/shared` | `@duckdb-query-in-place/shared` |
| all `@vibe-coding-starter-kit/shared` imports | `@duckdb-query-in-place/shared` |
| Title `Vibe Coding Starter Kit` | `DuckDB Query-in-Place on Backblaze B2` |
| sidebar label `OSS Starter Kit` | `DuckDB Query-in-Place` |
| FastAPI title `OSS Starter Kit API` | `DuckDB Query-in-Place API` |
| user_agent_extra `b2ai-oss-start` | `b2ai-duckdb-query-in-place (backblaze-b2-samples)` |
| DuckDB custom_user_agent | `b2ai-duckdb-query-in-place (backblaze-b2-samples)` |
| UTM `utm_content=b2ai-oss-start` (all links) | `utm_content=b2ai-duckdb-query-in-place` |
| pyproject project name (if any) | `duckdb-query-in-place` |
| infra/railway/README references | `duckdb-query-in-place` |
| image tags / CI workflow slugs | N/A (none in tree) |

### Env-var rename -> **Standard #3** (validated against `iceberg-feature-store`)
| Starter | Standard #3 |
|---|---|
| Legacy key ID names | `B2_APPLICATION_KEY_ID` (`b2_application_key_id`) |
| — (missing) | `B2_REGION` (`b2_region`) |
| `B2_APPLICATION_KEY` | unchanged |
| `B2_BUCKET_NAME` | unchanged |
| Legacy endpoint setting | derived from `B2_REGION` |
| Legacy public URL setting | `B2_PUBLIC_URL_BASE` (optional) |

Touch all of: `.env.example`, `config/settings.py`,
`config/b2_contract.py` (`REQUIRED_B2_SETTINGS` + `PLACEHOLDER_VALUES`),
`main.py`, `scripts/doctor.mjs`
(`REQUIRED_B2_VARS` + `PLACEHOLDERS`), `repo/b2_client.py`
(`aws_access_key_id=settings.b2_application_key_id`, add
`region_name=settings.b2_region`), `repo/duckdb_client.py` (secret KEY_ID/REGION),
`README.md` setup steps.

## Build / verify gate (builder must pass before returning)
`pnpm install` / `pnpm lint` / `pnpm build` / backend venv + `pnpm lint:api` /
`pnpm test:api` / `pnpm check:structure`. Strip the cloned `.git`, then
`git init` + initial commit (siblings under `.local/` are standalone repos;
`.local/` is gitignored by the workspace). Do **not** push.
