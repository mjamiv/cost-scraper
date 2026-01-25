# Cost Scraper

A modern web application for querying and visualizing project cost data from Snowflake.

![Cost Scraper](https://img.shields.io/badge/version-1.0.0-00d4aa)
![Python](https://img.shields.io/badge/python-3.10+-blue)
![React](https://img.shields.io/badge/react-18.2-61dafb)

## Features

- 🤖 **AI Chat Interface** - Natural language queries about cost data with GPT-5.2
- 📐 **FTE Calculations** - Full-Time Equivalent conversions with configurable work schedules
- 📊 **Interactive Data Table** - Sort, filter, and paginate through cost data
- 🌳 **Hierarchical View** - Expand/collapse CBS hierarchy levels with aggregated totals
- 📈 **Spend Analysis Chart** - Monthly spend bars, cumulative line, and Earned Value curve
- 💰 **Earned Value Analysis** - Visual comparison of actual spend vs earned value (% Complete × Budget)
- 🎚️ **Date Range Filter** - Slider controls to focus on specific time periods
- 🔍 **Flexible Querying** - Filter by project numbers and fiscal periods
- 📋 **Comprehensive Metrics** - Budget, period, JTD, forecast, PF, CF data
- 🎤 **Voice Input/Output** - Speak questions and hear responses
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
│   │   ├── main.py             # FastAPI application & endpoints (incl. chat, voice)
│   │   ├── config.py           # Configuration settings
│   │   └── snowflake_client.py # Snowflake connection & queries
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main application layout
│   │   ├── components/
│   │   │   ├── DataTable.tsx   # Hierarchical data table with expand/collapse
│   │   │   ├── CostCharts.tsx  # Main spend analysis chart with Earned Value
│   │   │   ├── ChatCharts.tsx  # Inline charts for chat responses
│   │   │   ├── ChatInterface.tsx # AI chat with markdown rendering
│   │   │   ├── SidebarFilters.tsx # Query filters panel
│   │   │   └── RightPanel.tsx  # Chart/Table/Export panel
│   │   ├── utils/
│   │   │   ├── hierarchyUtils.ts  # CBS hierarchy tree building
│   │   │   └── llmDataFormatter.ts # Data context for AI chat
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

4. Create a `.env` file with your credentials:
   ```env
   # Snowflake (include full region suffix)
   SF_ACCOUNT=your_account.region.cloud
   SF_USER=your_username
   SF_AUTHENTICATOR=externalbrowser  # or use SF_PASSWORD
   SF_WAREHOUSE=your_warehouse
   SF_ROLE=your_role

   # OpenAI (for AI chat features)
   OPENAI_API_KEY=your_openai_key

   # CORS
   ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
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
| `/health` | GET | Health check |
| `/api/cost-data` | GET | Retrieve cost data with filters |
| `/api/districts` | GET | List all districts |
| `/api/projects` | GET | List projects |
| `/api/filters` | GET | Get available filter options |
| `/api/chat` | POST | AI chat (single response) |
| `/api/chat/stream` | POST | AI chat (streaming response) |
| `/api/voice/transcribe` | POST | Speech-to-text (Whisper) |
| `/api/voice/synthesize` | POST | Text-to-speech |

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

### FTE (Full-Time Equivalent)
The AI chat understands FTE calculations:
- **Definition**: 1 FTE = 1 person working 8 hours/day, 5 days/week (40 hrs/week)
- **Average Rate**: Calculated as JTD Spend ÷ JTD Manhours
- **Conversions**: Manhours ↔ FTEs, FTE cost estimates
- When asking about FTEs, the chatbot will confirm work schedule assumptions and show the average rate calculation

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
