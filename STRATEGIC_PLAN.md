# Cost Scraper Platform — Strategic Improvement Plan

## Industry-Grade Project Controls Intelligence Tool

**Date:** February 7, 2026 (Updated with deep-dive analytics & Phase 1 implementation specs)
**Prepared by:** Cross-Functional Review Team (v1 + v2)
**Team:** Frontend Architect, Backend Engineer, PM SME, Design Engineering Mgmt SME, Data Analytics Specialist, Phase 1 Architect

---

## 1. Executive Summary

### Current State

The Cost Scraper platform is a **well-architected** React + FastAPI application that pulls project cost data from Snowflake and presents it through three interaction modes: an **AI chat interface**, **interactive charts**, and a **hierarchical data table**. It targets project managers overseeing large-scale construction/infrastructure projects and already includes voice chat, streaming AI responses, inline chart generation, and a robust CBS hierarchy viewer.

### Vision

Transform this platform into an **industry-grade project controls intelligence tool** that becomes the PM's daily command center — where the AI chat and graphing features are so powerful and contextual that they become the preferred way to interrogate project health, replacing manual spreadsheet analysis and disconnected reporting tools.

### Key Gaps Identified

| Area | Current Grade | Target Grade |
|------|---------------|--------------|
| Earned Value Management | Basic | Industry-Grade |
| Predictive Analytics | Not Present | Advanced |
| Project Health Dashboard | Partial | Comprehensive |
| Risk Intelligence | Not Present | Proactive |
| Multi-Project Portfolio View | Basic Filtering | Full Portfolio Management |
| Chat AI Intelligence | Good (single-project) | Excellent (cross-project, predictive) |
| Charting/Visualization | Good (3 chart types) | Excellent (10+ chart types) |
| Reporting & Export | Basic CSV/Excel | Professional Formatted Reports |
| Engineering Mgmt Views | Minimal | Discipline-Level Detail |
| Integration Points | Snowflake Only | Multi-System |

---

## 2. Platform Intelligence Assessment

### 2.1 Strengths (Keep & Amplify)

1. **AI Chat Interface** — Streaming responses, markdown tables, inline chart generation, natural language date filtering, suggestion buttons. This is the platform's killer feature and should remain the primary interaction mode.

2. **Charting with Recharts** — Clean bar + line composed charts, earned value overlay, date range slider, KPI cards. The gold/black design aesthetic is professional and distinctive.

3. **CBS Hierarchy DataTable** — TanStack Table with expand/collapse, column groups (Identification, Budget, Period, JTD, Forecast, Revenue), aggregated parent totals. Well-implemented for drill-down analysis.

4. **Snowflake Integration** — Connection pooling, SSO/key-pair auth options, caching layer, structured logging, Prometheus metrics. Production-ready backend infrastructure.

5. **Voice Features** — OpenAI Realtime API integration, custom voice cloning, VAD — unique differentiator for hands-free project reviews.

6. **WBS Tag Filtering** — Area, Phase, Discipline, Account, Firm, District tags enable multi-dimensional slicing. The chat even passes filter hints for context-aware responses.

7. **Developer Experience** — TypeScript throughout, Zustand state management, Vite build, ErrorBoundary with Sentry, clean component separation.

### 2.2 Weaknesses (Fix)

1. **Incomplete EVM Implementation** — Only PF, CF, % Complete, and basic Earned Value. Missing SPI, CPI, EAC, ETC, VAC, TCPI, BAC, BCWP, BCWS, ACWP.

2. **No Project Health Dashboard** — No at-a-glance red/yellow/green indicators. PMs must mentally compute project status from raw numbers.

3. **No Trend Analysis** — No S-curves, no burn rate analysis, no variance trend lines, no moving averages. Charts show point-in-time data only.

4. **No Predictive Analytics** — No EAC projections, no forecast extrapolation, no "at this rate, when will budget be exhausted?" capabilities.

5. **No Risk/Anomaly Detection** — No automated alerts for PF/CF threshold breaches, sudden cost spikes, or schedule slippage indicators.

6. **Limited Portfolio View** — Can filter by multiple projects, but no true portfolio-level dashboard with rollups, rankings, and cross-project comparison.

7. **Chat Context Limitations** — AI context includes current data but lacks historical benchmarks, cross-project comparison capability, and proactive insight generation.

8. **No Saved Views/Reports** — No ability to save filter configurations, create custom dashboards, or schedule automated reports.

9. **Mobile Responsiveness Gaps** — Layout is desktop-optimized. Sidebar and right panel don't adapt well to tablet/mobile.

10. **No Collaboration Features** — No shared views, annotations, comment threads, or multi-user awareness.

---

## 3. Flexibility Framework

### Design Principle: "Chat-First, Graph-Powered, Table-Deep"

The platform should guide users through three depth levels:

```
┌─────────────────────────────────────────────────────────────┐
│  LEVEL 1: AI CHAT (Primary)                                 │
│  "What's the health of my project?"                         │
│  → Natural language, instant answers, proactive alerts      │
│  → Auto-generates relevant charts inline                    │
│  → Suggests follow-up questions                             │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 2: INTERACTIVE CHARTS (Visual Exploration)           │
│  Click-to-drill from chat → full chart view                 │
│  → S-curves, earned value, trend analysis                   │
│  → Interactive filters, date ranges, comparison overlays    │
│  → Click any data point → drill into table                  │
├─────────────────────────────────────────────────────────────┤
│  LEVEL 3: DATA TABLE (Deep Dive)                            │
│  CBS hierarchy drill-down for forensic analysis             │
│  → Only when PMs need line-item detail                      │
│  → Pre-filtered by chat/chart context                       │
│  → Export sliced data for external reporting                 │
└─────────────────────────────────────────────────────────────┘
```

### Flexibility Features

| Feature | Flexibility Mechanism |
|---------|----------------------|
| **Custom Dashboards** | Drag-and-drop widget layout per user |
| **Saved Views** | Save filter + chart + table configs as named views |
| **Role-Based Defaults** | PM view, Engineering Mgr view, Executive view presets |
| **Configurable KPIs** | Choose which metrics appear in dashboard cards |
| **Threshold Alerts** | Per-user alert rules (e.g., "notify me if CPI < 0.9") |
| **Chart Type Selector** | Switch any visualization between chart types |
| **Chat Personas** | PM-focused, Executive-focused, or Technical detail levels |

---

## 4. Feature Roadmap

### Phase 1: Quick Wins (Weeks 1-4)

_Goal: Immediately visible value for PMs using the existing architecture._

#### 4.1.1 Project Health Scorecard
**Priority: CRITICAL**

Add a health scorecard component that appears at the top of the main view when data is loaded:

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ OVERALL  │  │   CPI    │  │   SPI    │  │   EAC    │  │ VARIANCE │
│  HEALTH  │  │  0.94    │  │  1.02    │  │  $4.2M   │  │  -$180K  │
│  🟡      │  │  🔴      │  │  🟢     │  │  🟡      │  │  🔴      │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**Thresholds:**
- Green: CPI/SPI >= 1.0, Variance <= 5% of budget
- Yellow: CPI/SPI 0.9-0.99, Variance 5-10%
- Red: CPI/SPI < 0.9, Variance > 10%

**Implementation:** Compute server-side from existing data:
- `CPI = BCWP / ACWP` (Earned Value / JTD Spend)
- `SPI = BCWP / BCWS` (Earned Value / Planned Value)
- `EAC = BAC / CPI` (Budget at Completion / CPI)
- `ETC = EAC - ACWP`
- `VAC = BAC - EAC`
- `TCPI = (BAC - BCWP) / (BAC - ACWP)`

#### 4.1.2 Enhanced EVM Metrics
**Priority: CRITICAL**

Add calculated EVM fields to the API response and chat context:

| Metric | Formula | Description |
|--------|---------|-------------|
| CPI | EV / AC | Cost Performance Index |
| SPI | EV / PV | Schedule Performance Index |
| CV | EV - AC | Cost Variance |
| SV | EV - PV | Schedule Variance |
| EAC | BAC / CPI | Estimate at Completion |
| ETC | EAC - AC | Estimate to Complete |
| VAC | BAC - EAC | Variance at Completion |
| TCPI | (BAC - EV) / (BAC - AC) | To-Complete Performance Index |

#### 4.1.3 Chat Intelligence Boost
**Priority: HIGH**

Enhance the LLM system prompt with:
- All EVM metrics calculated per project
- Red/yellow/green status indicators in the context
- Trending direction (improving/declining) for each metric
- Pre-computed "concerns" list (any metric breaching thresholds)
- Suggested follow-up questions based on data anomalies

**New chat capabilities:**
- "What projects are at risk?" → AI scans all projects for red indicators
- "Show me the EAC trend" → Inline chart with EAC over time
- "Why is CPI declining?" → AI analyzes CBS hierarchy for cost drivers
- "Compare Q4 to Q3" → Period comparison with delta analysis

#### 4.1.4 Additional Inline Chat Charts
**Priority: HIGH**

Add these chart types to the chat's inline chart system:

| Chart Type | Use Case | Trigger Phrases |
|-----------|----------|-----------------|
| S-Curve | Plan vs Actual vs Earned | "S-curve", "planned vs actual" |
| CPI/SPI Trend | Performance index over time | "CPI trend", "SPI trend", "performance trend" |
| Cost Variance Waterfall | Where costs diverge from budget | "waterfall", "cost breakdown", "variance breakdown" |
| Resource Loading | FTE allocation over time | "resource chart", "FTE trend", "staffing" |
| Budget vs Forecast | Budget bars vs forecast overlay | "budget vs forecast", "forecast comparison" |

#### 4.1.5 Proactive Alert Banners
**Priority: HIGH**

When data loads, automatically scan for issues and display alert banners:

```
⚠️ Project 106049: CPI dropped below 0.9 this period (0.87) — 3rd consecutive decline
⚠️ Project 104831: Forecast exceeds budget by 12% ($340K variance)
✅ Project 105553: On track — CPI 1.04, SPI 1.01
```

---

### Phase 2: Core Enhancements (Weeks 5-12)

_Goal: Transform from a data viewer into a project controls intelligence platform._

#### 4.2.1 Interactive Dashboard System
**Priority: CRITICAL**

Replace the fixed layout with a configurable dashboard:

**Default Dashboard Widgets:**
1. **Health Scorecard** (from Phase 1)
2. **S-Curve Chart** — Planned (BCWS) vs Earned (BCWP) vs Actual (ACWP) over time
3. **Performance Indices Chart** — CPI and SPI plotted monthly with trend lines
4. **Variance Analysis** — Waterfall chart showing budget → forecast with CBS-level breakdowns
5. **Cash Flow Forecast** — Projected monthly spend with confidence bands
6. **Risk Heat Map** — Projects plotted on CPI (x) vs SPI (y) quadrant chart
7. **Top 5 Cost Drivers** — Ranked CBS items by cost variance
8. **FTE Allocation** — Stacked area chart by discipline/phase

**Flexibility:**
- Users can rearrange widgets via drag-and-drop
- Show/hide widgets per preference
- Save layouts as named views
- Pre-built layouts: "PM Daily View", "Executive Summary", "Engineering Manager"

#### 4.2.2 S-Curve Visualization
**Priority: CRITICAL**

The most-requested chart for any project controls tool:

```
$M │           ╱‾‾‾‾ Planned (BCWS)
   │         ╱╱
   │       ╱╱  ╱── Earned (BCWP)
   │     ╱╱  ╱╱
   │   ╱╱  ╱╱  ╱── Actual (ACWP)
   │ ╱╱  ╱╱  ╱╱
   │╱  ╱╱  ╱╱
   └──────────────── Time
```

**Features:**
- Three lines: BCWS (planned), BCWP (earned), ACWP (actual cost)
- Drag-to-zoom on any time range
- Click any point to see CBS breakdown for that period
- Overlay multiple projects for comparison
- Export as PNG/SVG for reports

#### 4.2.3 Portfolio Dashboard
**Priority: HIGH**

A new top-level view for multi-project oversight:

**Portfolio Table:**
| Project | Budget | Spend | CPI | SPI | EAC | Health |
|---------|--------|-------|-----|-----|-----|--------|
| 106049 | $5.2M | $3.1M | 0.87 | 0.95 | $5.98M | Red |
| 104831 | $2.8M | $1.9M | 1.04 | 1.01 | $2.69M | Green |
| 105553 | $8.1M | $4.2M | 0.96 | 0.88 | $8.44M | Yellow |

**Portfolio Charts:**
- Bubble chart: Budget size (bubble) × CPI (x) × SPI (y) per project
- Stacked bar: Total spend by district/program
- Ranked: Projects sorted by risk score

**Chat Integration:**
- "Which district has the highest risk?" → AI analyzes portfolio
- "Rank projects by burn rate" → Sorted analysis with chart

#### 4.2.4 Trend Analysis Engine
**Priority: HIGH**

Add time-series analysis capabilities:

1. **Moving Averages** — 3-month and 6-month moving averages for spend, CPI, SPI
2. **Trend Direction Indicators** — Arrow icons (↑↓→) next to each KPI showing trend
3. **Variance Trend Lines** — Plot CV and SV over time to show if project is converging or diverging
4. **Rate Analysis** — Burn rate ($/month), hours/month, cost per deliverable
5. **Forecast Extrapolation** — Linear and polynomial trend lines projected forward

#### 4.2.5 Saved Views & Favorites
**Priority: MEDIUM**

- Save current filter + chart + table configuration as a named view
- "Morning Check" view, "Weekly Status" view, "Executive Brief" view
- Pin favorite projects to quick-access sidebar
- Recent queries history in chat

#### 4.2.6 Enhanced Data Export
**Priority: MEDIUM**

Upgrade the DataExportPanel:

| Format | Content |
|--------|---------|
| **Executive PDF** | Health scorecard + S-curve + key metrics + AI summary |
| **Monthly Status Report** | Formatted template with charts, tables, variance narrative |
| **EVM Report** | Full earned value analysis with all indices |
| **Excel Workbook** | Multi-tab: Summary, Detail, Charts, Pivot-ready data |
| **PowerPoint** | Slide deck with dashboard screenshots and AI-generated talking points |

---

### Phase 3: Industry-Grade (Weeks 13-24)

_Goal: Match or exceed enterprise PM tools with AI-powered intelligence._

#### 4.3.1 Predictive Analytics
**Priority: HIGH**

1. **EAC Forecasting Models:**
   - EAC (CPI-based) = BAC / CPI
   - EAC (CPI×SPI) = AC + (BAC - EV) / (CPI × SPI)
   - EAC (Trend) = Regression-based from historical CPI
   - Display all three with confidence intervals

2. **Cash Flow Forecast:**
   - Monthly projected spend based on historical pattern
   - Upper/lower confidence bands (±1σ, ±2σ)
   - "At this rate, budget exhausted by [date]"

3. **Schedule Prediction:**
   - SPI trend extrapolation
   - Estimated completion date vs planned
   - "At current SPI, project will finish [X months] late"

4. **AI-Powered Insights:**
   - "Based on similar projects, this CBS category typically sees 15% cost growth in the final quarter"
   - "Projects with CPI below 0.9 at this stage historically finish 20-30% over budget"

#### 4.3.2 Risk Intelligence
**Priority: HIGH**

1. **Automated Risk Scoring:**
   - Composite risk score from CPI, SPI, variance trends, burn rate, % complete vs planned
   - Risk score history — is risk increasing or decreasing?

2. **Anomaly Detection:**
   - Statistical outlier detection on period spend (z-score > 2)
   - Sudden PF/CF jumps flagged automatically
   - CBS items with unusual cost acceleration

3. **Threshold Alerts:**
   - User-configurable alert rules
   - Email/Slack notifications when thresholds breach
   - Alert history and acknowledgment

4. **Risk Dashboard:**
   - Risk heat map (likelihood × impact matrix)
   - Monte Carlo simulation for contingency sizing (future)
   - Risk-adjusted EAC

#### 4.3.3 Engineering Management Views
**Priority: MEDIUM**

1. **Discipline Breakdown:**
   - Filter by D-Group (Discipline) tag to see structural, civil, electrical costs
   - Discipline-level CPI/SPI and FTE allocation
   - Compare discipline performance across projects

2. **Phase Tracking:**
   - Costs by Phase tag (preliminary, 30%, 60%, 90%, IFC)
   - Phase transition milestones
   - Phase-specific burn rates

3. **Resource Management Dashboard:**
   - FTE plan vs actual by discipline
   - Utilization rate visualization
   - Over/under-staffing indicators
   - Resource allocation Gantt (stacked horizontal bars per discipline per month)

4. **Scope Change Tracking:**
   - Budget amendment log with dates and amounts
   - Visual impact: "Original budget → Amendment 1 → Amendment 2 → Current"
   - Change order waterfall chart

#### 4.3.4 Advanced Chat Capabilities
**Priority: HIGH**

1. **Cross-Project Analysis:**
   - "Compare project X to project Y"
   - "What's the average CPI across the Southeast district?"
   - "Which projects improved this quarter?"

2. **Scenario Modeling:**
   - "What if CPI stays at 0.87?" → AI calculates projected EAC/ETC
   - "What if we add 5 FTEs?" → Cost impact estimate
   - "What happens if schedule slips 2 months?" → Financial impact

3. **Root Cause Analysis:**
   - "Why is the forecast increasing?" → AI drills into CBS hierarchy to identify cost drivers
   - "Which CBS codes are overrunning?" → Sorted analysis with magnitudes

4. **Proactive Intelligence:**
   - AI periodically scans data and surfaces insights without being asked
   - "3 projects have seen CPI decline for 3 consecutive months"
   - "District SE5001 is trending 8% over aggregate budget"

5. **Report Generation:**
   - "Generate a monthly status report" → AI creates formatted report with charts
   - "Prepare an executive summary for project 106049" → Concise AI-written brief
   - "Create talking points for my project review meeting" → Bulleted highlights

#### 4.3.5 Integration Architecture
**Priority: MEDIUM (long-term)**

Design integration-ready APIs for:

| System | Integration Type | Data Flow |
|--------|-----------------|-----------|
| Primavera P6 | Schedule data | Inbound → planned dates, milestones |
| MS Project | Schedule data | Inbound → task-level schedule |
| Procore | Field data | Inbound → RFIs, submittals, photos |
| Oracle Unifier | Cost/contracts | Bidirectional → change orders, commitments |
| Power BI | Visualization | Outbound → embed or data feed |
| Slack/Teams | Notifications | Outbound → alerts, summaries |
| Email | Reports | Outbound → scheduled report delivery |

#### 4.3.6 Custom Query Builder
**Priority: MEDIUM**

For power users who want to go beyond chat:

- Visual query builder with drag-and-drop fields
- Saved queries with scheduling
- Share queries with team members
- Query results → chart → export pipeline

---

## 5. Chat Enhancement Strategy

### Making Chat the Preferred Interaction Mode

The AI chat should be so intelligent and contextual that PMs prefer asking questions over navigating menus.

### 5.1 Context Enrichment

**Current:** Chat receives raw cost data rows with basic filtering.

**Enhanced Context should include:**
```
PROJECT HEALTH SUMMARY:
- CPI: 0.87 (RED - declining trend, was 0.92 last month)
- SPI: 0.95 (YELLOW - stable)
- EAC: $5.98M vs BAC: $5.20M (15% overrun projected)
- TCPI: 1.18 (must achieve 1.18 CPI to meet budget - DIFFICULT)
- Burn Rate: $210K/month (12% above plan)
- Forecast Completion: Aug 2026 (2 months late at current SPI)

TOP CONCERNS:
1. CBS 3.2 (Structural) - CPI 0.72, $140K cost variance
2. CBS 5.1 (Electrical) - FTEs 40% above plan
3. Period spend increased 25% vs prior period

TRENDS (last 6 months):
- CPI: 1.01 → 0.98 → 0.95 → 0.94 → 0.92 → 0.87 (DECLINING)
- SPI: 0.88 → 0.91 → 0.93 → 0.95 → 0.95 → 0.95 (FLAT)
```

### 5.2 Chat Response Quality

**Requirements for industry-grade AI responses:**

1. Always lead with the bottom line (is the project healthy or not?)
2. Use data to support every statement (cite specific numbers)
3. Include trend context (is it getting better or worse?)
4. Suggest actionable next steps
5. Offer relevant follow-up questions
6. Generate charts inline when visual communication is clearer than text

### 5.3 Chat Trigger Enhancements

| User Intent | Chat Response |
|-------------|---------------|
| "How's my project?" | Health scorecard + top 3 concerns + trend summary |
| "Am I over budget?" | EAC analysis + CBS breakdown of variances |
| "Show me the trend" | S-curve chart + CPI/SPI trend chart inline |
| "What changed this month?" | Period-over-period delta analysis |
| "Forecast to completion" | EAC models (3 methods) + completion date estimate |
| "Resource status" | FTE plan vs actual + utilization by discipline |
| "Prepare for my meeting" | Executive summary + talking points + key charts |
| "Compare to last quarter" | Quarter-over-quarter analysis with deltas |

### 5.4 Proactive Chat Intelligence

The chat should not just answer questions — it should **volunteer insights**:

- On data load: "I've analyzed your project. Here are 3 things you should know..."
- Weekly digest: "This week, CPI improved from 0.87 to 0.89, but SPI dropped..."
- Anomaly alerts: "Unusual: CBS 3.2 spend was 3x the monthly average this period"
- Milestone awareness: "Project is 65% complete but has spent 72% of budget"

---

## 6. Visualization Strategy

### 6.1 Chart Hierarchy (Keep Users in Graphs)

```
DASHBOARD CHARTS (at-a-glance)
  → Health scorecard KPI cards
  → Mini sparklines for trends
  → Color-coded status indicators

ANALYSIS CHARTS (exploration)
  → S-Curve (plan vs actual vs earned)
  → CPI/SPI trend lines
  → Variance waterfall
  → Cash flow forecast
  → Resource loading

DETAIL CHARTS (deep dive)
  → CBS-level cost breakdown
  → Discipline comparison
  → Phase cost tracking
  → Project comparison bubbles

CHAT CHARTS (contextual)
  → Auto-generated from AI analysis
  → Filtered by conversation context
  → Interactive (click to explore)
```

### 6.2 New Chart Types Needed

| Chart | Purpose | Library |
|-------|---------|---------|
| **S-Curve** | Plan vs actual vs earned over time | Recharts (3-line ComposedChart) |
| **Waterfall** | Budget → variances → forecast | Recharts (custom bar) |
| **Heat Map** | Risk by project × metric | Custom SVG or D3 |
| **Bubble Chart** | Portfolio risk positioning | Recharts ScatterChart |
| **Treemap** | Budget allocation by CBS | Recharts Treemap |
| **Gauge** | CPI/SPI dial indicator | Custom SVG |
| **Sparklines** | Inline mini-trends in cards/tables | Recharts mini LineChart |
| **Stacked Area** | Resource loading by discipline | Recharts AreaChart |
| **Gantt-like** | Phase/milestone timeline | Custom or library |
| **Radar** | Multi-metric project health | Recharts RadarChart |

### 6.3 Chart Interaction Features

- **Click-to-drill**: Click any bar/point → filter table to that CBS/period
- **Hover detail**: Rich tooltips with full period data
- **Comparison overlay**: Toggle a second project's data on any chart
- **Time range brush**: Drag-to-select date range on any time-series chart
- **Annotations**: Click to add notes to any data point ("budget amendment here")
- **Full-screen mode**: Expand any chart to full screen for presentations

---

## 7. PM-Specific Capabilities

### 7.1 Earned Value Management Suite

**Current state:** Basic (PF, CF, % Complete, Earned Value line on chart)

**Target state:** Full EVM implementation per ANSI/EIA-748

| Metric | Status | Action |
|--------|--------|--------|
| BCWS (Planned Value) | Derivable | Compute from budget × planned schedule |
| BCWP (Earned Value) | Exists | Already computed as % Complete × Budget |
| ACWP (Actual Cost) | Exists | JTD_SPEND |
| BAC (Budget at Completion) | Exists | CB_AMT |
| CPI | Missing | Add: EV / AC |
| SPI | Missing | Add: EV / PV |
| CV | Missing | Add: EV - AC |
| SV | Missing | Add: EV - PV |
| EAC | Missing | Add: BAC / CPI (+ other methods) |
| ETC | Missing | Add: EAC - AC |
| VAC | Missing | Add: BAC - EAC |
| TCPI | Missing | Add: (BAC - EV) / (BAC - AC) |
| % Spent | Derivable | AC / BAC |

### 7.2 Morning Check Dashboard

What a PM sees first thing:

1. **Portfolio health strip** — All projects with green/yellow/red dots
2. **Alerts banner** — Any threshold breaches since last visit
3. **Top concerns** — AI-ranked issues requiring attention
4. **Today's metrics** — Key KPIs with yesterday's trend arrows
5. **Action items** — Outstanding items from previous analyses

### 7.3 Standard Report Templates

| Report | Frequency | Auto-Gen? | Content |
|--------|-----------|-----------|---------|
| Monthly Status Report | Monthly | Yes | Executive summary, EVM metrics, S-curve, variance analysis, forecast, key issues |
| Weekly Flash Report | Weekly | Yes | KPI summary, week-over-week deltas, top 5 concerns |
| Earned Value Report | Monthly | Yes | Full EVM table, CPI/SPI charts, trend analysis |
| Variance Analysis | Monthly | Yes | CBS-level variance breakdown, root cause narrative (AI) |
| Cash Flow Forecast | Monthly | Yes | Monthly projected spend with confidence bands |
| Executive Summary | On-demand | Yes (AI) | 1-page brief with health, risks, and recommendations |

---

## 8. Engineering Management Capabilities

### 8.1 Discipline-Level Views

Using the existing D-Group (Discipline) WBS tag:
- Per-discipline CPI, SPI, FTE count, spend
- Discipline comparison charts (bar chart of CPI by discipline)
- Drill from discipline → CBS items → period detail

### 8.2 Resource Management

- **Staffing plan vs actual**: Monthly planned FTE vs actual by discipline
- **Utilization indicators**: Green (80-100%), Yellow (60-80% or >100%), Red (<60% or >120%)
- **Resource forecast**: Projected FTE needs based on remaining work
- **Blended rate tracking**: Average cost per hour by discipline over time

### 8.3 Phase/Milestone Tracking

- Cost by Phase tag (Preliminary, 30%, 60%, 90%, IFC)
- Milestone timeline visualization
- Phase transition gates (planned vs actual)

### 8.4 Scope Change Log

- Visual budget amendment history
- Change order impact on forecast
- Original baseline vs current baseline comparison

---

## 9. Technical Architecture Recommendations

### 9.1 Backend Enhancements

| Area | Recommendation | Priority |
|------|---------------|----------|
| **Computed Metrics API** | Add `/api/metrics` endpoint that returns all EVM calculations server-side | Critical |
| **Portfolio Endpoint** | Add `/api/portfolio` for multi-project summary with health scoring | Critical |
| **Trend Data** | Add `/api/trends` for time-series data optimized for charting | High |
| **Alert Engine** | Background job to check thresholds and generate alerts | High |
| **Report Generator** | PDF/PPTX generation service (WeasyPrint or ReportLab) | Medium |
| **Websocket Updates** | Real-time data push when Snowflake data refreshes | Medium |
| **Query Caching** | Pre-compute common aggregations on data refresh, expand cache layer | High |
| **API Versioning** | Add `/api/v1/` prefix for future compatibility | Medium |

### 9.2 Frontend Enhancements

| Area | Recommendation | Priority |
|------|---------------|----------|
| **Dashboard Layout Engine** | React-grid-layout for drag-and-drop dashboard | High |
| **Chart Library Expansion** | Add S-curve, waterfall, treemap, gauge components | Critical |
| **Saved Views System** | localStorage + optional backend persistence for view configs | Medium |
| **Route-Based Navigation** | React Router for dashboard / portfolio / project / settings pages | High |
| **Code Splitting** | Lazy-load chart components, voice features, export panel | Medium |
| **Mobile Layout** | Responsive breakpoints for tablet/mobile views | Medium |
| **Theme System** | Light/dark mode support, brand customization | Low |
| **Testing** | Expand from 1 test file to comprehensive component tests | Medium |

### 9.3 Data Architecture

| Area | Recommendation | Priority |
|------|---------------|----------|
| **Pre-computed Views** | Snowflake materialized views for EVM metrics by period | Critical |
| **Historical Snapshots** | Store periodic snapshots for trend analysis | High |
| **Benchmark Database** | Historical project performance data for comparison | Medium |
| **Data Refresh Pipeline** | Scheduled refresh with notification on new data | High |
| **Aggregation Service** | Pre-compute portfolio rollups, district summaries | High |

### 9.4 Security & DevOps

| Area | Recommendation | Priority |
|------|---------------|----------|
| **Role-Based Access** | Map Snowflake roles to UI capabilities (PM, Eng Mgr, Exec) | High |
| **Audit Logging** | Track who viewed what data, when | Medium |
| **CI/CD Pipeline** | Automated testing + deployment (GitHub Actions exist, expand) | Medium |
| **Environment Parity** | Staging environment with test Snowflake data | Medium |

---

## 10. Success Metrics

### User Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Daily Active Users** | >80% of PMs use daily | Login tracking |
| **Chat Usage Rate** | >60% of sessions include chat | Chat API calls |
| **Chart Interaction** | >5 chart interactions per session | Click/hover tracking |
| **Session Duration** | >10 minutes average | Session timing |
| **Return Rate** | >90% weekly return | User retention |

### PM Value Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to Insight** | <30 seconds for project health | Task completion timing |
| **Report Generation** | <2 minutes for monthly report | Export timing |
| **Issue Detection** | 100% of threshold breaches caught | Alert accuracy |
| **Forecast Accuracy** | EAC within 5% of actual | Backtest validation |

### Platform Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Response Time** | <500ms for 95th percentile | Prometheus metrics |
| **Chat Response Time** | <3 seconds for AI response start | Streaming latency |
| **Data Freshness** | <24 hours from Snowflake | Refresh timestamps |
| **Uptime** | >99.5% | Health check monitoring |
| **Error Rate** | <0.1% of requests | Sentry tracking |

---

## 11. Critical Findings & Immediate Fixes (P0)

_Discovered during the v2 deep-dive analytics review. These should be fixed BEFORE Phase 1 implementation begins._

### 11.1 EV Computation Bug (CRITICAL)

**Location:** `CostCharts.tsx:268` vs `llmDataFormatter.ts:212`

`CostCharts.tsx` computes `earnedValue = percComp * budget` (no divide by 100), while `llmDataFormatter.ts` uses `(percentComplete / 100) * totalBudget`. If Snowflake stores `JTD_PERC_COMP` as `85.0` (percentage), then CostCharts is off by 100x. The mock data generates decimal values (~0.5), masking the bug in demo mode.

**Fix:** Verify the Snowflake field format and standardize all EV computations. Add a unit test.

### 11.2 Chat Queries Are NOT Cached

**Location:** `main.py:1494-1503`

Every chat request fires 2 raw `execute_query()` calls to Snowflake. The `execute_query_cached()` function exists in `cache.py` but is never called from the chat endpoint. A PM asking 5 questions about the same project triggers 10 Snowflake round-trips unnecessarily.

**Fix:** Replace `execute_query()` with `execute_query_cached()` in the chat endpoint. ~3 lines of code.

### 11.3 HD_FORECAST_METHOD Fetched But Unused

**Location:** Returned by CR_CUBE query but never consumed

This field tells you whether each CBS item uses Linear, Earned Value, or Manual forecasting — critical for EAC model selection. It's already being fetched from Snowflake but discarded.

**Fix:** Expose in DataTable, include in chat context, use for EAC model selection in the new `evm.py` module.

### 11.4 `comparison`/`aggregation`/`general` Query Types Get No Extra Context

**Location:** `main.py:1142-1297` — `build_data_context()`

The most common query types (`general`, `comparison`, `aggregation`) receive only the base summary. Only `trend`, `variance`, `fte`, and `breakdown` queries get additional context sections.

**Fix:** For `general` queries, include a compact version of ALL blocks: last 6 periods trend, top 3 variances, and 1-line breakdown summary.

### 11.5 Dual Context Paths Are Divergent

Frontend `llmDataFormatter.ts` computes FTE metrics, per-period EV, and budget manhours that the backend `build_data_context()` does not. The system prompt contains extensive FTE instructions, but the backend only provides FTE context when `query_type == "fte"`.

**Fix:** Port frontend FTE calculations to the backend context builder.

### 11.6 No Token Budget Management

Chat context size is unbounded, history is uncapped (10 messages x arbitrary length). No overflow protection exists.

**Fix:** Add `max_context_tokens` parameter. Count history tokens, truncate oldest messages first.

### 11.7 Untapped Snowflake Columns

| Column(s) | Potential Use |
|-----------|---------------|
| WBS_ELEMENT_L01-L05 | Pre-computed hierarchy depth (replace CBS_HIERARCHY dot-parsing) |
| WORK_TYPE | Phase tracking and status filtering |
| USER_STATUS | Status-based filtering and reporting |
| CBS_SORT_ID | Proper sort ordering (referenced in ORDER BY but not SELECTed) |
| All FORECAST_REMAINING_* | Remaining work analytics |

---

## 12. Implementation Priority Summary

### Pre-Phase 1: Immediate Fixes (Week 0 — 1-2 days)
0a. Fix EV computation bug (CostCharts.tsx /100 inconsistency)
0b. Enable query caching for chat endpoint (3 lines of code)
0c. Remove dead code files (ChatBot.tsx, Header.tsx, FilterBar.tsx, root-level backend files)
0d. Enrich `general` query type context in `build_data_context()`

### Must-Do First (Weeks 1-4) — See Appendix D for detailed specs
1. Create `backend/app/evm.py` module + `/api/metrics` endpoint (Spec 1)
2. Split `main.py` into FastAPI routers (Spec 5.4)
3. Enhanced chat context — multi-section, caching, raise token limit (Spec 4)
4. Wire up Zustand store (Spec 5.1) + React Query (Spec 5.2)
5. Project Health Scorecard component (Spec 2)
6. S-Curve chart component (Spec 3)
7. Proactive alert banners (Spec 5.6)
8. Enable cache layer across all data endpoints (Spec 5.3)

### Must-Do Second (Weeks 5-12)
9. Portfolio dashboard with multi-project comparison
10. CPI/SPI trend charts with moving averages
11. Variance waterfall chart
12. Anomaly detection engine (Z-score, PF/CF breach, burn rate acceleration)
13. Saved views and filter presets
14. Professional report export (PDF with charts)
15. Portfolio benchmarking endpoint (`/api/benchmarks`)

### Must-Do Third (Weeks 13-24)
16. Predictive EAC models (CPI-based, trend-based, period-cost-rate) with confidence intervals
17. Cash flow forecasting with confidence bands
18. Automated risk scoring and composite risk engine
19. Engineering discipline-level views + resource management dashboard
20. Cross-project AI analysis and benchmarking in chat context
21. Custom query builder
22. Integration APIs (P6, Procore)

---

## Appendix A: Specialist Review Summaries

### Frontend Architecture Review
- **Verdict:** Well-structured React/TypeScript application with clean component separation. Zustand store is appropriate at current scale. Recharts integration is solid but limited to 2-3 chart types. Chat UX is the strongest feature with streaming, inline charts, and suggestions. Main gaps are limited chart variety, no dashboard layout system, minimal testing, and desktop-only responsive design.

### Backend & Data Layer Review
- **Verdict:** Production-ready FastAPI backend with proper auth, caching, metrics, and connection pooling. Snowflake integration handles multiple auth methods well. Chat/AI pipeline effectively builds context from cost data. Main gaps are no server-side EVM computation, no portfolio aggregation endpoints, limited trend data endpoints, and the AI context could include more pre-computed insights.

### Project Management SME Assessment
- **Verdict:** The tool has a solid foundation for cost data viewing but is NOT yet an industry-grade project controls tool. Critical missing elements: full EVM suite (CPI/SPI/EAC/ETC/TCPI), project health dashboard, S-curve analysis, trend tracking, predictive forecasting, risk indicators, and standard PM report generation. The AI chat is a unique differentiator that no competing tool offers — this should be the strategic focus.

### Design Engineering Management SME Assessment
- **Verdict:** The WBS tag taxonomy is reasonable but underutilized. Engineering managers need discipline-level cost views, phase tracking, resource allocation visualization, and scope change tracking. The CBS hierarchy in the data table is well-implemented but should connect to the charting layer (click CBS item → see that item's trend). Integration with schedule tools (P6) is a long-term priority that would be a significant differentiator.

### Data Analytics & Intelligence Review (Deep-Dive — v2)
- **Verdict:** Analytics layer has strong foundations but lacks derived intelligence. Full deep-dive revealed:
  - **56 columns queried from CR_CUBE** across 5 groups: Identification (9), Budget (5), Period (12), JTD (12), Forecast (18). Many columns fetched but never consumed by frontend or chat.
  - **Dual context paths are divergent**: Backend `build_data_context()` (main.py:1142-1297) is the actual chat path. Frontend `llmDataFormatter.ts` independently computes FTE/EV metrics NOT in the backend. Need unification.
  - **Query classification** (`classify_query_type()`, main.py:1069-1083): 8 types, but `general`/`comparison`/`aggregation` get NO additional context beyond base summary.
  - **Token budget**: System message ~1,600-2,000 tokens, max completion 900 tokens (too restrictive), 10 history messages uncapped. No overflow protection.
  - **Chat queries NOT cached**: 2 raw Snowflake queries per chat request. `execute_query_cached()` exists but unused. P0 fix.
  - **EV computation bug**: `CostCharts.tsx:268` uses `percComp * budget` (no /100) while `llmDataFormatter.ts:212` uses `(pct/100) * budget`. One is wrong depending on Snowflake field format.
  - **HD_FORECAST_METHOD fetched but unused**: Critical for EAC model selection (Linear/Earned Value/Manual).
  - **Untapped columns**: WBS_ELEMENT_L01-L05 (pre-computed hierarchy), WORK_TYPE, USER_STATUS, all FORECAST_REMAINING_*, G/L metrics.
  - **Anomaly detection architecture**: Z-score cost spike detection (6-month rolling window), PF/CF threshold breach, burn rate acceleration (3-period comparison), forecast-to-budget divergence. Implementation in proposed `backend/app/anomaly.py`.
  - **Predictive models implementable NOW**: CPI-based EAC, trend-based EAC (linear regression on rolling CPI), period-cost-rate EAC with confidence intervals. Cash flow forecasting via exponential smoothing.
  - **ML assessment**: Data volume (12-48 monthly observations) too small for deep learning. Best fit: linear regression, Holt-Winters, ARIMA. Use `statsmodels`/`scikit-learn`.
  - **Benchmarking**: Cross-project CPI percentile rankings, discipline cost/hour benchmarks, historical self-benchmarking (3-month vs 6-month trailing). New `/api/benchmarks` endpoint.
  - **Pipeline optimization**: Historical data immutability exploitation (longer TTL for past months), parallelizable Snowflake queries via `asyncio.gather()`, pre-computed Snowflake view for ROOT-level aggregations.
  - See **Appendix D** for full implementation specifications.

---

## Appendix B: Technical Debt & Quick Wins

### Dead Code to Remove
- `frontend/src/components/ChatBot.tsx` — Replaced by ChatInterface.tsx (lazy-loaded)
- `frontend/src/components/Header.tsx` — Not imported anywhere; header is inline in App.tsx
- `frontend/src/components/FilterBar.tsx` — Replaced by SidebarFilters.tsx
- `backend/main.py` (root-level) — Superseded by `backend/app/main.py`
- `backend/database.py`, `backend/models.py`, `backend/queries.py`, `backend/config.py` (root-level) — Legacy files superseded by `backend/app/`

### Unused Infrastructure to Wire Up
- **Zustand store** (`appStore.ts`): Beautifully built with devtools + persist middleware, but **completely unused**. App.tsx reimplements all state with local useState. Wiring this up is the single highest-impact frontend improvement.
- **React Query** (`@tanstack/react-query`): In package.json dependencies but never imported. Would provide caching, background refetch, and stale-while-revalidate for API calls.
- **Cache layer** (`cache.py`): Well-built TTL caches exist but `execute_query()` is called directly in most endpoints, bypassing `execute_query_cached()`.
- **Accessibility utilities** (`accessibility.ts`): Focus trap, ARIA live announcements, skip links all implemented but mostly not imported/used in components.

### Security Items
- Hardcoded demo user password (`demo123`) in auth.py source code
- Default JWT secret `dev-secret-key-change-in-production` must be overridden
- SSL verification disabled globally (`verify=False`) — should be configurable
- Error messages expose internals (`detail=str(e)`) — sanitize for production
- CORS allows all methods/headers (`allow_methods=["*"]`)
- Source maps enabled in production builds

### Backend Architecture
- `main.py` is ~2,500 lines — should be split into FastAPI routers: `routers/data.py`, `routers/chat.py`, `routers/voice.py`, `routers/auth.py`, `routers/admin.py`
- All Snowflake queries are synchronous (blocking async event loop)
- Chat streaming is "fake" — gets full response then splits word-by-word, not true token streaming
- No pagination on data endpoints

---

## Appendix C: Frontend Architecture Scorecard

| Category | Score | Key Finding |
|----------|-------|-------------|
| Component Architecture | 7/10 | Good separation, but App.tsx is a ~450-line god component |
| State Management | 4/10 | Zustand store built but completely unused |
| Charting | 6/10 | Solid spend chart, but only 2-3 types in main panel |
| Chat UX | 8/10 | Excellent streaming, inline charts, voice, commands |
| Data Table | 9/10 | Outstanding TanStack hierarchy with aggregation |
| Accessibility | 6/10 | Good utilities written but not wired up |
| Performance | 7/10 | Good lazy loading, React Query unused |
| Design System | 8/10 | Polished gold/black theme, custom fonts |
| Mobile | 5/10 | Basic breakpoints, not touch-optimized |
| Testing | 2/10 | Zero frontend tests despite Vitest infrastructure |

---

*This strategic plan was produced by a cross-functional team of 7 specialists across two review sessions: Frontend Architect, Backend Engineer, PM SME, Design Engineering Management SME, Data Analytics Specialist (deep-dive v2), and Phase 1 Implementation Architect. Each agent performed a full code review and domain analysis of the platform.*

*Implementation should be iterative — ship Phase 1 quickly, gather user feedback, and adjust Phase 2/3 priorities accordingly. The north star is making the AI chat and interactive charts so intelligent and contextual that PMs prefer this tool over spreadsheets and legacy PM software.*

---

## Appendix D: Phase 1 Implementation Specifications

_Detailed, file-level implementation specs for Phase 1 (Weeks 1-4). A developer can pick these up and start building._

### Spec 1: EVM Metrics (Complexity: L)

**New file: `backend/app/evm.py`** — Pure computation module
- `compute_evm_metrics(rows, start_month) -> EVMMetrics` — All EVM from ROOT-level rows
- `compute_evm_by_period(rows) -> list[PeriodEVM]` — Period-by-period for trend charts
- `compute_project_health(metrics) -> HealthStatus` — Threshold logic

**New file: `backend/app/routers/metrics.py`** — FastAPI router
- `GET /api/metrics?project_numbers=X&start_month=YYYYMM` → Full EVM + health status
- `GET /api/metrics/trends?project_numbers=X&start_month=YYYYMM` → Period-by-period EVM

**Data mapping:**

| EVM Term | Source | Formula |
|----------|--------|---------|
| BAC | CB_AMT | SUM of ROOT-level CB_AMT, latest period |
| ACWP | JTD_SPEND | SUM of ROOT-level JTD_SPEND, latest period |
| BCWP | JTD_PERC_COMP, CB_AMT | budget-weighted avg(JTD_PERC_COMP) / 100 × SUM(CB_AMT) |
| BCWS | DERIVED | Phase 1: BAC × (elapsed_months / total_months). Phase 2: P6 schedule data |
| CPI | BCWP / ACWP | |
| SPI | BCWP / BCWS | |
| EAC | BAC / CPI | |
| ETC | EAC - ACWP | |
| VAC | BAC - EAC | |
| TCPI | (BAC - BCWP) / (BAC - ACWP) | |

**Modify:** `backend/app/main.py` — Register router, update `build_data_context()` with full EVM
**New:** `frontend/src/api/types.ts` — EVMMetrics, HealthStatus interfaces
**Modify:** `frontend/src/api/costDataApi.ts` — `fetchEVMMetrics()`, `fetchEVMTrends()`

### Spec 2: Health Scorecard (Complexity: M)

**New file: `frontend/src/components/HealthScorecard.tsx`**
- 5 KPI cards: Overall, CPI, SPI, EAC, Variance
- Color: Green (CPI/SPI >= 1.0), Yellow (0.9-0.99), Red (< 0.9)
- EAC variance: Green (<= 5% BAC), Yellow (5-10%), Red (> 10%)
- TCPI: Green (<= 1.10), Yellow (1.10-1.20), Red (> 1.20)
- Trend arrows from `/api/metrics/trends`

**Modify:** `frontend/src/App.tsx` — Render above chat area when data loaded

### Spec 3: S-Curve Chart (Complexity: M)

**New file: `frontend/src/components/SCurveChart.tsx`**
- 3-line ComposedChart: BCWS (blue dashed), BCWP (emerald), ACWP (gold)
- Recharts Brush for date range
- KPI cards below: CV, SV, CPI, SPI for selected range
- Data from `GET /api/metrics/trends`

**Modify:** `frontend/src/components/ChatCharts.tsx` — Add `'s-curve'` type, trigger on "s-curve", "planned vs actual"

### Spec 4: Enhanced Chat Context (Complexity: L)

**Modify: `backend/app/main.py` — `build_data_context()`**
- Always include ALL sections (totals + EVM + trend + variances + breakdowns)
- Add "PROJECT HEALTH SUMMARY" and "KEY CONCERNS" sections
- Import `compute_evm_metrics()` from evm.py
- Add trend direction detection (last 3 vs prior 3 periods)

**Modify: `backend/app/main.py` — `api_chat()`**
- Change `max_completion_tokens=900` → `max_completion_tokens=4096`
- Use `execute_query_cached()` instead of `execute_query()`
- Cache built context string with 5-minute TTL

**Modify: `backend/app/cache.py`**
- Add `CHAT_CONTEXT_CACHE_TTL = 900` (15 min) and dedicated cache

### Spec 5: Quick Wins

**5.1 Wire Up Zustand (M):** Replace 10+ useState calls in App.tsx with `useAppStore` selectors. Eliminates prop drilling.

**5.2 Wire Up React Query (M):** Add QueryClientProvider in main.tsx. New `frontend/src/hooks/useQueries.ts` with `useEVMMetrics()`, `useCostData()`, `useFilterOptions()`.

**5.3 Enable Cache Layer (S):** Replace `execute_query()` with `execute_query_cached()` in: `api_cost_data`, `api_projects`, `api_districts`, `api_filters`, `api_wbs_data`, `api_chat`.

**5.4 Split main.py (L):** Create routers: `auth.py` (~80 lines), `data.py` (~350), `chat.py` (~600), `voice.py` (~500), `health.py` (~100), `metrics.py` (~150). Reduce main.py to ~200 lines.

**5.5 Remove Dead Code (S):** Delete: ChatBot.tsx, Header.tsx, FilterBar.tsx, root-level backend/main.py, backend/database.py, backend/models.py, backend/queries.py, backend/config.py.

**5.6 Alert Banners (S-M):** New `AlertBanner.tsx` — scans EVM for threshold breaches, displays dismissible alerts.

### Implementation Order

| Order | Item | Dependencies | Days |
|-------|------|-------------|------|
| 1a | Enable cache layer (5.3) | None | 1 |
| 1b | Remove dead code (5.5) | None | 0.5 |
| 2 | EVM Metrics backend (Spec 1) | None | 3-4 |
| 3 | Split main.py (5.4) | Parallelize with #2 | 2 |
| 4 | Enhanced Chat Context (Spec 4) | Spec 1 | 2-3 |
| 5 | Wire up Zustand (5.1) | None | 2 |
| 6 | Wire up React Query (5.2) | 5.1 | 1-2 |
| 7 | Health Scorecard (Spec 2) | Spec 1, 5.2 | 1-2 |
| 8 | S-Curve Chart (Spec 3) | Spec 1, 5.2 | 2-3 |
| 9 | Alert Banners (5.6) | Spec 2 | 1 |
| **Total** | | | **~3-4 weeks** |

### Key Architectural Decisions Required

1. **BCWS (Planned Value):** Use time-proportioned BAC for Phase 1? Or is there a schedule data source?
2. **Router split timing:** Before or after EVM implementation? Before is cleaner.
3. **React Query + Zustand coexistence:** React Query for server state, Zustand for UI state (recommended pattern).
4. **Max tokens:** 4096 recommended (up from 900). ~4x cost increase per chat call but dramatically better responses.

---

## Appendix E: Snowflake Schema Reference

### CR_CUBE_DATA_WBS — 56 Columns

**Identification (9):** FISCAL_YEAR_MONTH_NO, LEAD_DISTRICT_ID, LEAD_DISTRICT, PROJECT_NUMBER, CBS_HIERARCHY, WBS_ELEMENT, WBS_DESCRIPTION, ACCOUNT_CODE, UNIT_OF_MEASURE_ID

**Budget (5):** CE_QTY, CB_QTY, CB_MHF, CB_AMT, CB_UNIT_COST

**Period (12):** PER_QTY, PER_PERC_COMP, PER_MH, PER_MHF, PER_MH_GL, PER_UOM_MH, PER_PF, PER_CF, PER_LEI, PER_SPEND, PER_UNIT_COST, ACTUAL_COST_G_PER_L

**JTD (12):** JTD_QTY, JTD_PERC_COMP, JTD_MH, JTD_MHF, JTD_MH_GL, JTD_UOM_MH, JTD_PF, JTD_CF, JTD_LEI, JTD_SPEND, JTD_UNIT_COST, JTD_COST_G_PER_L

**Forecast (18):** FORECAST_REMAINING_QUANTITY, HD_FORECAST_METHOD, FORECAST_REMAINING_MHF, FORECAST_MHF, FORECAST_REMAINING_MH, FORECAST_MH, FORECAST_MH_G_PER_L, FORECAST_REMAINING_PF, FORECAST_PF, FORECAST_REMAINING_CF, FORECAST_CF, FORECAST_REMAINING_LEI, FORECAST_LEI, FORECAST_REMAINING_UNIT_COST, FORECAST_UNIT_COST, FORECAST_REMAINING_AMOUNT, FORECAST_AMOUNT, FORECAST_AMOUNT_G_PER_L, FORECAST_CHANGE, SL_VARIANCE

### WBS View — 17 Columns
WBS_ID, WBS_CODE, WBS_ELEMENT, PROJECT_NUMBER, WBS_DESCRIPTION, AREA, PHASE, D-GROUP, ACCOUNT_CODE, ACCOUNT_CODE_DESCRIPTION, USER_DEFINED_7 (Firm), DISTRICT_SPECIFIC_TAG_16, DISTRICT_SPECIFIC_TAG_19, USER_DEFINED_12, USER_DEFINED_13 (Multiplier), TAG23, TAG25

### WBS_SNAPSHOT_FLAT_WITH_ATTRIBUTES — 18 Columns
WBS_ELEMENT, PROJECT_NUMBER, FISCAL_YEAR_MONTH_NO, WBS_ELEMENT_L01-L05, WBS_DESCRIPTION_L01-L05, CBS_HIERARCHY, AREA, PHASE, WORK_TYPE, USER_STATUS

---

## Appendix F: Anomaly Detection Algorithms

### Cost Spike Detection (Z-Score)
6-month rolling window. Flag periods where PER_SPEND deviates > 2σ from rolling mean. Severity: `warning` (> 2σ), `critical` (> 3σ).

### PF/CF Threshold Breach
Green: PF/CF <= 1.0. Yellow: 1.0-1.1. Red: > 1.2. Applied per-CBS and per-project.

### Burn Rate Acceleration
Compare recent 3-period avg spend vs historical avg. Flag if ratio > 1.2x (warning) or > 1.5x (critical).

### Forecast-to-Budget Divergence
Flag CBS items where FORECAST_AMOUNT exceeds CB_AMT by > 10% (warning) or > 20% (critical). Sort by dollar impact.

### Implementation
New module: `backend/app/anomaly.py`. Called from `build_data_context()` to inject `## Alerts` section into LLM context. Also exposed via `GET /api/anomalies` for frontend health dashboard.

---

## Appendix G: Predictive Analytics Models

### EAC Model 1: CPI-Based
`EAC = BAC / CPI` — Assumes future matches cumulative performance. Best when CPI is stable.

### EAC Model 2: Trend-Based
Linear regression on 6-month trailing CPI values. Extrapolate future CPI. `EAC = ACWP + remaining_work / future_cpi`. Best when CPI is trending.

### EAC Model 3: Period-Cost-Rate
Statistical extrapolation of PER_SPEND. `remaining_months = remaining_work / avg_monthly_burn_rate`. Include ±1σ and ±2σ confidence intervals.

### Cash Flow Forecasting
Project future monthly spend from 6-month recent average with standard deviation bands. Cumulative projection shows when budget will be exhausted.

### Completion Date Estimation
`months_remaining = (BAC - BCWP) / avg_monthly_EV_increment`. Wide confidence interval if EV rate varies significantly.

### ML Assessment
Data volume (12-48 observations) suits: linear regression, exponential smoothing (Holt-Winters), ARIMA. Libraries: `statsmodels`, `scikit-learn`. Deep learning is overkill for this data size.
