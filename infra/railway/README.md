# Railway Deployment

Deploy both services (web + api) on Railway.

## Setup

1. Create a new Railway project
2. Add two services from the same repo:

### Web Service (Next.js)
- **Root Directory**: `apps/web`
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Port**: `3000`

### API Service (FastAPI)
- **Root Directory**: `services/api`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Environment Variables

Set these on the API service:

| Variable | Value |
|----------|-------|
| `B2_REGION` | Your B2 region (e.g., `us-west-004`) |
| `B2_APPLICATION_KEY_ID` | Your B2 application key ID |
| `B2_APPLICATION_KEY` | Your B2 application key |
| `B2_BUCKET_NAME` | Your bucket name |
| `B2_PUBLIC_URL_BASE` | Optional public object base URL |
| `API_CORS_ORIGINS` | Your web service URL (e.g., `https://web-production-xxx.up.railway.app`) |

For upgrades from older revisions, add `B2_REGION` and optional
`B2_PUBLIC_URL_BASE` before removing deprecated `B2_ENDPOINT` or
`B2_PUBLIC_URL`. Keep the deprecated variables through the rollback window so
old API instances can still restart safely. This release ignores the deprecated
keys, so remove them only after the new API service is deployed everywhere and
rollback to the previous release is no longer needed.

Set this on the Web service:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your API service URL (e.g., `https://api-production-xxx.up.railway.app`) |
