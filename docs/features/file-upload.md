<!-- last_verified: 2026-06-16 -->
# Feature: Dataset Upload

## Purpose
Upload source datasets (CSV / JSON / log / Parquet) from the browser to
Backblaze B2 so they can be queried in place from the SQL Console.

## Used By
- UI: `/upload` page, upload form component
- API: `POST /upload`

## Core Functions
- `apps/web/src/components/upload/upload-form.tsx` — orchestrates dropzone + progress + upload state
- `apps/web/src/components/upload/dropzone.tsx` — drag-and-drop via `react-dropzone`, scoped to dataset formats
- `apps/web/src/lib/api-client.ts` — `uploadFile()` using XHR for progress events
- `services/api/app/runtime/upload.py` — HTTP handler, reads file chunks
- `services/api/app/service/upload.py` — validates, sanitizes, writes under `datasets/`

## Canonical Files
- Upload handler pattern: `services/api/app/runtime/upload.py`
- Service orchestration pattern: `services/api/app/service/upload.py`
- Frontend upload flow: `apps/web/src/components/upload/upload-form.tsx`

## Inputs
- file: `File` (from browser, multipart form data)
- content_type: string (from file MIME type)

## Outputs
- `FileUploadResponse`: key, filename, size, content_type, uploaded_at, url, basic metadata (size + md5/sha256 checksums)
- Side effects: file stored in B2 under `datasets/{sanitized_filename}`

## Flow
- User drops or selects datasets in the dropzone
- Client validates size (max 100MB) and type — rejected files show a toast
- XHR sends a multipart POST to `/upload` with progress events
- API rejects oversized requests early via `Content-Length`, then streams in 1MB chunks
- API validates content type against the analytics allowlist (CSV, JSON, plain text/log, Parquet)
- API sanitizes the filename and checks the extension matches the MIME type
- API writes the object as `datasets/{sanitized_filename}` via boto3 `put_object`
- API returns `FileUploadResponse` with size + checksums; the dataset picker now lists it

## Edge Cases
- File exceeds 100MB → client rejection toast + API 413 if bypassed
- Type not in the analytics allowlist → API 415
- Extension/MIME mismatch → API 415
- No filename / empty file → API 400
- Duplicate filename → B2 creates a new version (buckets are always versioned)
- B2 unreachable → API 500

## UX States
- Empty: dropzone with dataset-format hint
- Loading: per-file progress bars
- Error: red status icon + message per file
- Complete: green checkmark, "Clear completed" button

## Verification
- Test files: `services/api/tests/test_upload_conflict.py`, `services/api/tests/test_error_handling.py`
- Required cases: successful upload to `datasets/`, oversized rejection, disallowed type rejection, missing filename, empty file, duplicate allowed
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [SQL Console](sql-console.md)
- [App Workflows](../app-workflows.md)
