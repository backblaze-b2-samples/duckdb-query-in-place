# Issue 1: B2 Standards Fix

## Source
- Issue: https://github.com/backblaze-b2-samples/duckdb-query-in-place/issues/1
- Goal: make the B2 standards audit pass.

## Plan
1. Align B2 environment variables with the standard names from the issue.
2. Ensure every S3 path carries a custom Backblaze samples user agent.
3. Update preflight checks, tests, and setup/deployment docs.
4. Run relevant lint/tests and archive this plan.

## Verification
- `pnpm lint`
- `python -m ruff check .`
- `python -m pytest`
- `python -m pytest tests/test_structure.py -v`
- B2 standards scans for native API calls, deprecated env aliases, and secret-looking tokens.

## Review Fixes
- Ignore leftover deprecated dotenv keys during upgrade.
- Validate `B2_REGION` before deriving S3 endpoints.
- Add env-contract drift tests for startup validation, `.env.example`, and `scripts/doctor.mjs`.
