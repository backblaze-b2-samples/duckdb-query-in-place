<!-- last_verified: 2026-06-16 -->
# AGENTS.md — DuckDB Query-in-Place on Backblaze B2

This is the authoritative control surface for all coding agents. Read this first.

**What this app is:** a SQL console that runs queries directly against files
in a Backblaze B2 bucket using DuckDB's `httpfs` extension (query-in-place),
and materializes results back to B2 as Parquet slices. B2 credentials are the
only secret — there is no second external API.

## 1. Repository Map

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  src/app/query/         SQL Console route
  src/app/results/       Results Library route (scoped to query-results/)
  src/components/query/  SQL editor, results table, dataset picker, materialize dialog, history
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
  app/repo/b2_client.py     boto3 S3 client (upload/list/head/delete/presign/stats)
  app/repo/duckdb_client.py DuckDB engine (httpfs query + COPY materialize)
  app/service/query.py      SQL guards, dest-key sanitization, durable query history
  app/runtime/query.py      POST /query/run, POST /query/materialize, GET /query/history
packages/shared/   Shared TypeScript types
docs/              System of record (features, workflows, security, reliability)
docs/exec-plans/   Execution plans and tech debt tracker
infra/railway/     Deployment config
```

## 2. App Surfaces — Keep vs Adapt

This app was built from the vibe-coding-starter-kit. The reusable B2-backed
scaffolding is kept; the screens below were adapted or added for query-in-place.

**Keep as-is (do not strip, rename, or replace)**
- **UI kit / design system.** `apps/web/src/components/ui/` (shadcn primitives), the design tokens in `apps/web/src/app/globals.css`, and the `/design` reference page. Build new screens with these primitives; never edit the generated `components/ui/` files directly. Restyling happens through tokens in `globals.css`.
- **File Explorer.** `/files` route, `apps/web/src/app/files/`, and `apps/web/src/components/files/` — browse the whole bucket.
- **Upload.** `/upload` route, `apps/web/src/app/upload/`, and `apps/web/src/components/upload/` — upload datasets under `datasets/`.
- The sidebar nav (Dashboard, SQL Console, Results, Upload, Files, Settings, plus the Design System utility link).

**This app's own surfaces (query-in-place)**
- **SQL Console** (`/query`, `components/query/*`) — write SQL, run it against B2 files via DuckDB, materialize results.
- **Results Library** (`/results`, `components/results/*`) — explorer scoped to the `query-results/` prefix with presigned downloads.
- **Dashboard** (`/`, `components/dashboard/*`) — query-centric stats (Datasets, Result slices, Queries run, Bucket size), a query-activity chart, and a recent-queries table fed by `query_history.json`. New aggregations flow through `runtime -> service -> repo` and TanStack Query hooks in `lib/queries.ts` — no bare `useEffect + fetch`.

## 3. Architectural Invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/`
- **External engine containment**: `duckdb` lives only in `repo/duckdb_client.py`, mirroring the boto3 rule. Higher layers call `run_query` / `materialize` and never import duckdb or see a connection.
- No business logic in route handlers (`runtime/`)
- All external APIs wrapped in `repo/` adapters
- All request/response data validated at boundary (Pydantic models)
- No shared mutable state across layers

**Frontend**: shadcn/ui components in `src/components/ui/` are generated — never modify them.

**Data fetching**: every API call flows through TanStack Query hooks in `apps/web/src/lib/queries.ts`. No bare `useEffect + fetch` patterns. New endpoints touch three files: `runtime/<router>.py`, `lib/api-client.ts`, `lib/queries.ts`.

## 4. Quality Expectations

- **DRY** — do not duplicate logic, types, or constants. Extract shared code only when used in 2+ places.
- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge
- Prefer boring, composable libraries over clever abstractions
- No implicit type assumptions — use typed models

## 5. Mechanical Enforcement

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| DuckDB engine only in repo/ | convention — `import duckdb` belongs in `repo/duckdb_client.py` only |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |

## 6. Commands

```bash
# Run
pnpm dev               # start both frontend and backend
pnpm dev:web           # frontend only
pnpm dev:api           # backend only

# Test & Lint
pnpm lint              # frontend lint (eslint)
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

## 7. Agent Workflow

1. Read this file first.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before structural changes.
3. For non-trivial changes, create a plan in `docs/exec-plans/active/`.
4. Implement the smallest coherent change.
5. Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
6. Update docs in the same PR (see §9).
7. Move completed plans to `docs/exec-plans/completed/`.
8. Only change files relevant to the task. No drive-by improvements.

## 8. Frontend Conventions

See [docs/dev-workflows.md](docs/dev-workflows.md) for full details.

## 9. Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |
| Active work plans | `docs/exec-plans/active/` |
| Known tech debt | `docs/exec-plans/tech-debt-tracker.md` |

If documentation and implementation conflict, update docs in the same PR. Documentation rot destroys agent reliability.

## 10. Doc Map

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Feature docs | [docs/features/](docs/features/) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows and testing | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Tech debt | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 11. When Unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- Ask before making destructive or irreversible changes
