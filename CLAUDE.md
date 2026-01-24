# Cost Scraper - Project Guide

## Quick Start

### Launch the Application

**Terminal 1 - Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Architecture

- **Frontend**: React + TypeScript + Vite (port 5173)
- **Backend**: Python + FastAPI + Uvicorn (port 8000)
- **Database**: Snowflake (via snowflake-connector-python)

## Snowflake Configuration

### Critical: Account Identifier Format

The Snowflake account identifier **must include the full region and cloud suffix**:

```
# WRONG - will fail with 404
SF_ACCOUNT=TB78941

# CORRECT - include region and cloud
SF_ACCOUNT=tb78941.south-central-us.azure
```

To find your account identifier:
1. Check your Snowflake login URL: `https://ACCOUNT.REGION.snowflakecomputing.com`
2. Or run in Snowflake: `SELECT CURRENT_ACCOUNT(), CURRENT_REGION();`

### Authentication Methods

Configure in `backend/.env`:

**Option 1: SSO/Browser Auth (local development)**
```
SF_AUTHENTICATOR=externalbrowser
```
- Requires running backend in foreground terminal (not background)
- Browser will prompt for SSO authentication
- Install keyring to cache tokens: `pip install snowflake-connector-python[secure-local-storage]`

**Option 2: Password Auth**
```
SF_PASSWORD=your_password
```

**Option 3: Key-pair Auth (production)**
```
SF_PRIVATE_KEY_B64=<base64_encoded_key>
SF_PRIVATE_KEY_PASSPHRASE=<passphrase>
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `404 Not Found: post ACCOUNT.snowflakecomputing.com` | Missing region in account ID | Add full region suffix (e.g., `.south-central-us.azure`) |
| `[WinError 10013] socket forbidden` | Port already in use | Kill existing process or use different port |
| `[Errno 22] Invalid argument` | SSO can't open browser | Run backend in foreground terminal, not background |

## API Endpoints

- `GET /health` - Health check
- `GET /api/test-connection` - Test Snowflake connection
- `GET /api/projects` - List available projects
- `GET /api/districts` - List available districts
- `GET /api/filters` - Get filter options (districts + fiscal months)
- `GET /api/cost-data?project_numbers=X&start_month=YYYYMM` - Get cost data
- `POST /api/query` - Execute CR Cube query with filters

## Environment Variables

Required in `backend/.env`:
```
SF_ACCOUNT=tb78941.south-central-us.azure
SF_USER=your.email@domain.com
SF_ROLE=PROD_KDS_CONSUMPTION_SEM_R_AR
SF_WAREHOUSE=PROD_ENT_CONS_BI_BULK_WH
SF_AUTHENTICATOR=externalbrowser
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Demo Mode

The frontend supports a demo mode with mock data when deployed to GitHub Pages. This activates automatically when hosted on `*.github.io` domains.
