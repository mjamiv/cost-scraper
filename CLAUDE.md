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

## Key Features

### Hierarchical DataTable
- CBS_HIERARCHY based expand/collapse tree structure
- Aggregated totals for parent nodes (always recalculated from children)
- Visual indentation by depth level
- Compact icon-only controls for expand/collapse, columns, pagination

### Spend Analysis Chart
- Bar chart for monthly/period spend (left Y-axis, gold)
- Line chart for cumulative spend (right Y-axis, purple)
- **Earned Value line** (green dashed) = % Complete × Budget
- Date range slider to filter time periods
- KPI cards: Total Spend, Avg Monthly, Earned Value, PF, CF, Periods

### AI Chat Interface
- Natural language queries about cost data
- Streaming responses with markdown table rendering
- Voice input/output support
- Inline chart generation (`/chart spend`, `/chart variance`, `/chart earned-value`)
- **Date range filtering** - Charts respond to "Q1 2024", "Jan 2024 to Jun 2024"
- Executive summary and variance analysis
- **FTE calculations** with 4-4-5 financial calendar
- **Professional UI**: Avatars, timestamps, copy button, loading skeleton

### Inline Chat Charts
Charts can be triggered by natural language and filter by date:
- `"Show spend trend for Q1 2024"` → Filtered spend chart
- `"Earned value chart Jan 2024 to Jun 2024"` → EV chart with date range
- `"Monthly spend in 2024"` → Full year spend trend

**Chart Types:**
| Type | Trigger Words |
|------|---------------|
| `spend-trend` | spend trend, monthly spend, spending |
| `earned-value` | earned value, EV, CPI, SPI |
| `project-comparison` | project comparison, compare projects |
| `budget-pie` | budget allocation, pie chart |
| `variance` | variance, over budget, under budget |

### FTE Calculations (4-4-5 Financial Calendar)

The AI context includes pre-calculated FTE metrics for each period:

| Metric | Formula | Description |
|--------|---------|-------------|
| Monthly FTE | `PER_MH / (40 × weeks)` | FTEs for the month |
| Weekly FTE | `PER_MH / weeks / 40` | Average FTEs per week |
| Avg Rate | `PER_SPEND / PER_MH` | Blended hourly rate ($/hr) |

**4-4-5 Calendar:**
```
Q1: Jan (4 wks), Feb (4 wks), Mar (5 wks)
Q2: Apr (4 wks), May (4 wks), Jun (5 wks)
Q3: Jul (4 wks), Aug (4 wks), Sep (5 wks)
Q4: Oct (4 wks), Nov (4 wks), Dec (5 wks)
```

The "Spending & FTE by Period" table in AI context shows:
`| Period | Spend | Manhours | Monthly FTE | Weekly FTE | Avg Rate |`

### Data Processing Notes
- **Snowflake returns numeric values as strings** - All formatting functions must parse with `parseFloat()` before calling `.toFixed()`. This applies to DataTable.tsx, CostCharts.tsx, ChatCharts.tsx, and any component displaying Snowflake data.
- **ROOT-level rows only** - For aggregation (charts, chat context), only rows with **empty CBS_HIERARCHY** are used. These contain project totals; child rows (CBS "1", "2", etc.) are already summed into the root.
- **Current month excluded** - Reporting automatically excludes the current month (typically incomplete data). See `excludeCurrentMonth()` in `llmDataFormatter.ts`.
- Period spend derived from PER_SPEND or JTD_SPEND differences
- PF (Performance Factor) and CF (Cost Factor): values > 1.0 are unfavorable (behind schedule / over budget)
- Earned Value = % Complete × Current Budget (CB_AMT)

### Chat Response Formatting
- System prompt enforces structured responses with tables
- **Short headers required** (max 4 words): "Summary", "Cost Status", not "Executive Summary of Cost Status"
- `preprocessMarkdown()` handles:
  - Blank lines before/after headers and lists
  - Inline table splitting (converts `||` to row breaks)
  - Table separator row insertion
  - `[object Object]` artifact cleanup
- `getTextContent()` helper extracts text from React children safely
- `parseDateRange()` extracts date ranges from user messages for chart filtering

### Chat UI Components
- **Avatars**: User (gold person icon), Assistant (chart icon)
- **Timestamps**: Displayed below each message
- **Copy button**: Appears on hover for assistant messages
- **Loading skeleton**: Shimmer animation during streaming
- **Slide-in animation**: Messages animate when appearing
