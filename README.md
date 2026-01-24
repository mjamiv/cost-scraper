# Cost Scraper

A modern web application for querying and visualizing project cost data from Snowflake.

![Cost Scraper](https://img.shields.io/badge/version-1.0.0-00d4aa)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![React](https://img.shields.io/badge/react-18.2-61dafb)

## Features

- 📊 **Interactive Data Table** - Sort, filter, and paginate through cost data
- 🌳 **Hierarchical View** - Expand/collapse CBS hierarchy levels with aggregated totals
- 📈 **Spend Analysis Chart** - Financial report-style chart with monthly bars and cumulative line
- 🎚️ **Date Range Filter** - Slider controls to focus on specific time periods
- 🔍 **Flexible Querying** - Filter by project numbers, fiscal periods, and districts
- 📋 **Comprehensive Metrics** - View budget, period, JTD, and forecast data
- ⚡ **Fast & Responsive** - Built with FastAPI and React for optimal performance

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.10+, FastAPI, Snowflake Connector |
| Frontend | React 18, TypeScript, TanStack Table, Recharts |
| Styling | Tailwind CSS |
| Build | Vite |

## Project Structure

```
cost-scraper/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI application & endpoints
│   │   ├── config.py           # Configuration settings
│   │   └── snowflake_client.py # Snowflake connection & queries
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main application
│   │   ├── components/
│   │   │   ├── DataTable.tsx   # Hierarchical data table with expand/collapse
│   │   │   ├── CostCharts.tsx  # Spend analysis chart
│   │   │   ├── FilterBar.tsx   # Query filters
│   │   │   └── Header.tsx      # App header
│   │   ├── utils/
│   │   │   └── hierarchyUtils.ts # CBS hierarchy tree building
│   │   └── api/                # API client & types
│   ├── package.json            # Node dependencies
│   └── vite.config.ts          # Vite configuration
├── CLAUDE.md                   # Development guide
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Snowflake account with access to the required tables

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your Snowflake credentials:
   ```env
   SNOWFLAKE_ACCOUNT=your_account
   SNOWFLAKE_USER=your_username
   SNOWFLAKE_PASSWORD=your_password
   SNOWFLAKE_WAREHOUSE=your_warehouse
   SNOWFLAKE_DATABASE=PROD_ENT_CONSUMPTION
   SNOWFLAKE_SCHEMA=SEM_VW
   SNOWFLAKE_ROLE=your_role
   ```

5. Start the backend server:
   ```bash
   python main.py
   ```
   
   Or with uvicorn directly:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/cost-data` | GET | Retrieve cost data with filters |
| `/api/districts` | GET | List all districts |
| `/api/projects` | GET | List projects (optional district filter) |
| `/api/filters` | GET | Get available filter options |

### Query Parameters for `/api/cost-data`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `project_numbers` | string | (preset list) | Comma-separated project numbers |
| `start_month` | string | `202101` | Start fiscal month (YYYYMM) |
| `district_id` | string | - | Filter by district ID |

## Data Columns

### Identification
- Fiscal Year Month, Project Number, District, WBS Element, CBS Hierarchy

### Current Budget (CB)
- Quantity, MHF, Amount, Unit Cost

### Period (PER)
- Quantity, % Complete, Manhours, Spend, Unit Cost

### Job-to-Date (JTD)
- Quantity, % Complete, Manhours, Spend, Unit Cost

### Forecast
- Remaining Quantity, MHF, Manhours, Amount, Change, SL Variance

## Development

### Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build
```

## License

Internal use only.
