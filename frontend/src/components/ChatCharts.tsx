import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  TooltipProps,
} from 'recharts';
import { CostDataRow, WBSTagFilters } from '../api/types';
import { excludeCurrentMonth } from '../utils/llmDataFormatter';

// Brand colors - gold/black theme
const COLORS = {
  gold: '#d4a418',
  goldLight: '#f5d76e',
  purple: '#a855f7',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  emerald: '#22c55e',
};

const PIE_COLORS = [COLORS.gold, COLORS.blue, COLORS.purple, COLORS.amber, COLORS.emerald, COLORS.red];

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPeriodLabel(period: string): string {
  if (!period || period.length !== 6) return period || '';
  const year = period.substring(2, 4);
  const month = period.substring(4, 6);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} '${year}`;
}

// Custom tooltip for dark theme
function DarkTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-4 text-xs">
      <p className="text-gold font-semibold mb-3 pb-2 border-b border-neutral-700">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-6 py-1">
          <span className="flex items-center gap-2 text-neutral-300">
            <span
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="text-white font-semibold">
            {formatCurrency(entry.value as number)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface DateRange {
  start?: string; // YYYYMM format
  end?: string;   // YYYYMM format
}

interface ChartProps {
  data: CostDataRow[];
  title?: string;
  dateRange?: DateRange;
  projects?: string[];
  excludeCurrentMonth?: boolean;
  tags?: Record<string, string[]>;
  metric?: string | null;
  groupBy?: string | null;
  style?: 'line' | 'bar' | 'stacked' | 'combo' | null;
}

/**
 * Filter data by date range
 */
function filterByDateRange(data: CostDataRow[], dateRange?: DateRange): CostDataRow[] {
  if (!dateRange || (!dateRange.start && !dateRange.end)) return data;

  return data.filter(row => {
    const period = String(row.FISCAL_YEAR_MONTH_NO || '');
    if (dateRange.start && period < dateRange.start) return false;
    if (dateRange.end && period > dateRange.end) return false;
    return true;
  });
}

function filterByProjects(data: CostDataRow[], projects?: string[]): CostDataRow[] {
  if (!projects || projects.length === 0) return data;
  const set = new Set(projects.map(p => String(p)));
  return data.filter(row => set.has(String(row.PROJECT_NUMBER)));
}

function applyExclusions(data: CostDataRow[], excludeCurrent?: boolean): CostDataRow[] {
  return excludeCurrent ? excludeCurrentMonth(data) : data;
}

function filterByTags(data: CostDataRow[], tags?: Record<string, string[]>): CostDataRow[] {
  if (!tags) return data;
  const fieldMap: Record<keyof WBSTagFilters, string> = {
    wbsElement: 'WBS_ELEMENT',
    area: 'AREA',
    phase: 'PHASE',
    dGroup: 'D_GROUP',
    accountCode: 'ACCOUNT_CODE',
    userDefined7: 'USER_DEFINED_7',
    districtSpecificTag16: 'DISTRICT_SPECIFIC_TAG_16',
    districtSpecificTag19: 'DISTRICT_SPECIFIC_TAG_19',
    userDefined12: 'USER_DEFINED_12',
    tag23: 'TAG23',
    tag25: 'TAG25',
  };

  let filtered = data;
  (Object.entries(tags) as [keyof WBSTagFilters, string[]][]).forEach(([key, values]) => {
    if (!values || values.length === 0) return;
    const rowKey = fieldMap[key];
    if (!rowKey) return;
    const valueSet = new Set(values.map(v => String(v)));
    filtered = filtered.filter(row => {
      const rowValue = (row as Record<string, unknown>)[rowKey];
      return rowValue != null && valueSet.has(String(rowValue));
    });
  });
  return filtered;
}

const METRIC_DEFS: Record<string, { label: string; perKey?: string; jtdKey?: string }> = {
  CE_QTY: { label: 'Current Estimate Qty' },
  CB_QTY: { label: 'Current Budget Qty' },
  CB_MHF: { label: 'Current Budget MHF' },
  CB_AMT: { label: 'Current Budget (CB)' },
  CB_UNIT_COST: { label: 'Current Budget Unit Cost' },

  PER_QTY: { label: 'Period Qty' },
  PER_PERC_COMP: { label: 'Period % Complete' },
  PER_MH: { label: 'Period Manhours', perKey: 'PER_MH', jtdKey: 'JTD_MH' },
  PER_MHF: { label: 'Period MHF' },
  PER_MH_GL: { label: 'Period MH G/L' },
  PER_UOM_MH: { label: 'Period UOM per MH' },
  PER_PF: { label: 'Period PF' },
  PER_CF: { label: 'Period CF' },
  PER_LEI: { label: 'Period LEI' },
  PER_SPEND: { label: 'Period Spend', perKey: 'PER_SPEND', jtdKey: 'JTD_SPEND' },
  PER_UNIT_COST: { label: 'Period Unit Cost' },
  ACTUAL_COST_G_PER_L: { label: 'Actual Cost / G/L' },

  JTD_QTY: { label: 'JTD Qty' },
  JTD_PERC_COMP: { label: 'JTD % Complete' },
  JTD_MH: { label: 'JTD Manhours', perKey: 'PER_MH', jtdKey: 'JTD_MH' },
  JTD_MHF: { label: 'JTD MHF' },
  JTD_MH_GL: { label: 'JTD MH G/L' },
  JTD_UOM_MH: { label: 'JTD UOM per MH' },
  JTD_PF: { label: 'JTD PF' },
  JTD_CF: { label: 'JTD CF' },
  JTD_LEI: { label: 'JTD LEI' },
  JTD_SPEND: { label: 'JTD Spend', perKey: 'PER_SPEND', jtdKey: 'JTD_SPEND' },
  JTD_UNIT_COST: { label: 'JTD Unit Cost' },
  JTD_COST_G_PER_L: { label: 'JTD Cost / G/L' },

  FORECAST_REMAINING_QUANTITY: { label: 'Forecast Remaining Qty' },
  FORECAST_REMAINING_MHF: { label: 'Forecast Remaining MHF' },
  FORECAST_MHF: { label: 'Forecast MHF' },
  FORECAST_REMAINING_MH: { label: 'Forecast Remaining MH' },
  FORECAST_MH: { label: 'Forecast MH' },
  FORECAST_MH_G_PER_L: { label: 'Forecast MH G/L' },
  FORECAST_REMAINING_PF: { label: 'Forecast Remaining PF' },
  FORECAST_PF: { label: 'Forecast PF' },
  FORECAST_REMAINING_CF: { label: 'Forecast Remaining CF' },
  FORECAST_CF: { label: 'Forecast CF' },
  FORECAST_REMAINING_LEI: { label: 'Forecast Remaining LEI' },
  FORECAST_LEI: { label: 'Forecast LEI' },
  FORECAST_REMAINING_UNIT_COST: { label: 'Forecast Remaining Unit Cost' },
  FORECAST_UNIT_COST: { label: 'Forecast Unit Cost' },
  FORECAST_REMAINING_AMOUNT: { label: 'Forecast Remaining Amount' },
  FORECAST_AMOUNT: { label: 'Forecast Amount' },
  FORECAST_AMOUNT_G_PER_L: { label: 'Forecast Amount G/L' },
  FORECAST_CHANGE: { label: 'Forecast Change' },
  SL_VARIANCE: { label: 'Schedule Variance' },
};

function getMetricKey(metric?: string | null): string {
  if (!metric) return 'PER_SPEND';
  return METRIC_DEFS[metric] ? metric : 'PER_SPEND';
}

function getMetricLabel(metric?: string | null): string {
  return METRIC_DEFS[getMetricKey(metric)]?.label || 'Period Spend';
}

/**
 * Spend Trend Chart - Bar + Line combo showing period spend and cumulative
 */
export function SpendTrendChart({ data, title = 'Spend Trend', dateRange, projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    // Filter by date range, projects, and filter to ROOT-level rows only
    let filteredData = applyExclusions(data, exclude);
    filteredData = filterByProjects(filteredData, projects);
    filteredData = filterByTags(filteredData, tags);
    filteredData = filterByDateRange(filteredData, dateRange);
    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    const periodData = new Map<string, { jtdSpend: number; perSpend: number }>();

    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const existing = periodData.get(period) || { jtdSpend: 0, perSpend: 0 };
      existing.jtdSpend += parseFloat(String(row.JTD_SPEND)) || 0;
      existing.perSpend += parseFloat(String(row.PER_SPEND)) || 0;
      periodData.set(period, existing);
    }

    const sortedPeriods = Array.from(periodData.keys()).sort();
    const hasPerSpendData = Array.from(periodData.values()).some(v => v.perSpend !== 0);

    if (hasPerSpendData) {
      let cumulative = 0;
      return sortedPeriods.map((period) => {
        const d = periodData.get(period)!;
        cumulative += d.perSpend;
        return { period: formatPeriodLabel(period), spend: d.perSpend, cumulative };
      });
    } else {
      let prevJtd = 0;
      return sortedPeriods.map((period) => {
        const d = periodData.get(period)!;
        const spend = d.jtdSpend - prevJtd;
        prevJtd = d.jtdSpend;
        return { period: formatPeriodLabel(period), spend, cumulative: d.jtdSpend };
      });
    }
  }, [data, dateRange, exclude, projects, tags]);

  if (!chartData.length) return null;

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 45, left: 5, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              angle={-45}
              textAnchor="end"
              interval={Math.max(0, Math.floor(chartData.length / 10))}
              dy={5}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={60}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={65}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <Bar yAxisId="left" dataKey="spend" name="Period Spend" fill={COLORS.gold} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke={COLORS.purple} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Earned Value Chart - Shows Budget, Actual Spend, and Earned Value over time
 */
export function EarnedValueChart({ data, title = 'Earned Value Analysis', dateRange, projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    // Filter by date range, projects, and filter to ROOT-level rows only
    let filteredData = applyExclusions(data, exclude);
    filteredData = filterByProjects(filteredData, projects);
    filteredData = filterByTags(filteredData, tags);
    filteredData = filterByDateRange(filteredData, dateRange);
    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    const periodData = new Map<string, { jtdSpend: number; budget: number; percentComplete: number }>();

    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const existing = periodData.get(period) || { jtdSpend: 0, budget: 0, percentComplete: 0 };
      existing.jtdSpend += parseFloat(String(row.JTD_SPEND)) || 0;
      existing.budget += parseFloat(String(row.CB_AMT)) || 0;
      // Use max percent complete for the period (it's cumulative)
      const pctComp = parseFloat(String(row.JTD_PERC_COMP)) || 0;
      if (pctComp > existing.percentComplete) existing.percentComplete = pctComp;
      periodData.set(period, existing);
    }

    const sortedPeriods = Array.from(periodData.keys()).sort();

    return sortedPeriods.map((period) => {
      const d = periodData.get(period)!;
      // Earned Value = % Complete × Budget
      const earnedValue = (d.percentComplete / 100) * d.budget;
      return {
        period: formatPeriodLabel(period),
        actualSpend: d.jtdSpend,
        earnedValue,
        budget: d.budget,
      };
    });
  }, [data, dateRange, exclude, projects, tags]);

  if (!chartData.length) return null;

  // Calculate CPI for the latest period
  const latest = chartData[chartData.length - 1];
  const cpi = latest.actualSpend > 0 ? (latest.earnedValue / latest.actualSpend).toFixed(2) : 'N/A';

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 45, left: 5, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              angle={-45}
              textAnchor="end"
              interval={Math.max(0, Math.floor(chartData.length / 10))}
              dy={5}
            />
            <YAxis
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={70}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <Line type="monotone" dataKey="actualSpend" name="Actual Spend" stroke={COLORS.gold} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="earnedValue" name="Earned Value" stroke={COLORS.emerald} strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
            <Line type="monotone" dataKey="budget" name="Budget" stroke={COLORS.blue} strokeWidth={2} strokeDasharray="3 3" dot={false} opacity={0.5} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 text-xs mt-2 pb-2">
          <span className="text-neutral-400">CPI: <span className={`font-semibold ${parseFloat(cpi) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{cpi}</span></span>
        </div>
      </div>
    </div>
  );
}

/**
 * Project Comparison Chart - Horizontal bar chart comparing projects
 */
export function ProjectComparisonChart({ data, title = 'Project Comparison', projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const projectMap = new Map<string, { budget: number; jtdSpend: number; forecast: number }>();

    // Filter by projects and root rows only
    const filteredData = applyExclusions(filterByProjects(filterByTags(data, tags), projects), exclude);
    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    for (const row of topLevelRows) {
      const project = String(row.PROJECT_NUMBER || '');
      const existing = projectMap.get(project) || { budget: 0, jtdSpend: 0, forecast: 0 };
      existing.budget += parseFloat(String(row.CB_AMT)) || 0;
      existing.jtdSpend += parseFloat(String(row.JTD_SPEND)) || 0;
      existing.forecast += parseFloat(String(row.FORECAST_AMOUNT)) || 0;
      projectMap.set(project, existing);
    }

    return Array.from(projectMap.entries())
      .map(([project, values]) => ({
        project,
        budget: values.budget,
        spent: values.jtdSpend,
        remaining: Math.max(0, values.budget - values.jtdSpend),
      }))
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 8);
  }, [data, exclude, projects, tags]);

  if (!chartData.length) return null;

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 15, right: 40, left: 70, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              tickFormatter={formatCurrency}
            />
            <YAxis
              type="category"
              dataKey="project"
              tick={{ fill: '#d4d4d4', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              width={65}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <Bar dataKey="spent" name="Spent" stackId="a" fill={COLORS.gold} radius={[0, 3, 3, 0]} />
            <Bar dataKey="remaining" name="Remaining" stackId="a" fill={COLORS.blue} opacity={0.6} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Budget vs Forecast Pie Chart
 */
export function BudgetPieChart({ data, title = 'Budget Allocation', projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const projectMap = new Map<string, number>();

    // Filter by projects and root rows only
    const filteredData = applyExclusions(filterByProjects(filterByTags(data, tags), projects), exclude);
    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    for (const row of topLevelRows) {
      const project = String(row.PROJECT_NUMBER || '');
      const budget = parseFloat(String(row.CB_AMT)) || 0;
      projectMap.set(project, (projectMap.get(project) || 0) + budget);
    }

    return Array.from(projectMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data, exclude, projects, tags]);

  if (!chartData.length) return null;

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Budget']}
              contentStyle={{
                backgroundColor: '#171717',
                border: '1px solid #404040',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center text-xs text-neutral-400 mt-2 pb-2">
          Total Budget: <span className="text-gold font-semibold">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Variance Chart - Shows favorable/unfavorable variances
 */
export function VarianceChart({ data, title = 'Top Variances', projects, dateRange, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const scoped = filterByDateRange(applyExclusions(filterByProjects(filterByTags(data, tags), projects), exclude), dateRange);
    return scoped
      .map(row => ({
        name: `${row.PROJECT_NUMBER}-${(row.CBS_HIERARCHY || '').split('.').slice(0, 2).join('.')}`,
        variance: parseFloat(String(row.SL_VARIANCE)) || 0,
        description: String(row.WBS_DESCRIPTION || '').substring(0, 20),
      }))
      .filter(item => item.variance !== 0)
      .sort((a, b) => a.variance - b.variance)
      .slice(0, 5)
      .concat(
        data
          .map(row => ({
            name: `${row.PROJECT_NUMBER}-${(row.CBS_HIERARCHY || '').split('.').slice(0, 2).join('.')}`,
            variance: parseFloat(String(row.SL_VARIANCE)) || 0,
            description: String(row.WBS_DESCRIPTION || '').substring(0, 20),
          }))
          .filter(item => item.variance !== 0)
          .sort((a, b) => b.variance - a.variance)
          .slice(0, 5)
      )
      .filter((item, index, self) => self.findIndex(t => t.name === item.name) === index)
      .sort((a, b) => a.variance - b.variance);
  }, [data, dateRange, exclude, projects, tags]);

  if (!chartData.length) return null;

  const favorableCount = chartData.filter(d => d.variance >= 0).length;
  const unfavorableCount = chartData.filter(d => d.variance < 0).length;

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 15, right: 40, left: 90, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              tickFormatter={formatCurrency}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#d4d4d4', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={85}
            />
            <Tooltip content={<DarkTooltip />} />
            <Bar
              dataKey="variance"
              name="Variance"
              fill={COLORS.gold}
              radius={[0, 4, 4, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.variance >= 0 ? COLORS.emerald : COLORS.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 text-xs mt-2 pb-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.emerald }}></span>
            <span className="text-emerald-400">Favorable: {favorableCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.red }}></span>
            <span className="text-red-400">Unfavorable: {unfavorableCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export type ChartType = 'spend-trend' | 'project-comparison' | 'budget-pie' | 'variance' | 'earned-value' | 'manhours-trend' | 'fte-trend' | 'discipline-breakdown' | 'metric-trend';

/**
 * Manhours Trend Chart - Bar + Line combo showing period manhours and cumulative
 */
export function ManhoursTrendChart({ data, title = 'Manhours Trend', dateRange, projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    let filteredData = applyExclusions(data, exclude);
    filteredData = filterByProjects(filteredData, projects);
    filteredData = filterByTags(filteredData, tags);
    filteredData = filterByDateRange(filteredData, dateRange);
    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    const periodData = new Map<string, number>();

    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const mh = parseFloat(String(row.PER_MH || 0)) || 0;
      periodData.set(period, (periodData.get(period) || 0) + mh);
    }

    const sortedPeriods = Array.from(periodData.keys()).sort();
    let cumulative = 0;

    return sortedPeriods.map((period) => {
      const mh = periodData.get(period)!;
      cumulative += mh;
      return { period: formatPeriodLabel(period), manhours: mh, cumulative };
    });
  }, [data, dateRange, exclude, projects, tags]);

  if (!chartData.length) return null;

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 45, left: 5, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              angle={-45}
              textAnchor="end"
              interval={Math.max(0, Math.floor(chartData.length / 10))}
              dy={5}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              width={50}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              width={55}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <Bar yAxisId="left" dataKey="manhours" name="Period MH" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke={COLORS.purple} strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * FTE Trend Chart - Bar for FTE count with avg rate overlay
 */
export function FTETrendChart({ data, title = 'FTE Trend', dateRange, projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    let filteredData = applyExclusions(data, exclude);
    filteredData = filterByProjects(filteredData, projects);
    filteredData = filterByTags(filteredData, tags);
    filteredData = filterByDateRange(filteredData, dateRange);
    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    const periodData = new Map<string, { mh: number; spend: number }>();

    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const mh = parseFloat(String(row.PER_MH || 0)) || 0;
      const spend = parseFloat(String(row.PER_SPEND || 0)) || 0;
      const existing = periodData.get(period) || { mh: 0, spend: 0 };
      existing.mh += mh;
      existing.spend += spend;
      periodData.set(period, existing);
    }

    const sortedPeriods = Array.from(periodData.keys()).sort();

    // 4-4-5 calendar: months 3, 6, 9, 12 have 5 weeks
    const getWeeksInMonth = (period: string): number => {
      const month = parseInt(period.substring(4, 6), 10);
      return (month % 3 === 0) ? 5 : 4;
    };

    return sortedPeriods.map((period) => {
      const d = periodData.get(period)!;
      const weeks = getWeeksInMonth(period);
      const hoursInMonth = 40 * weeks;
      const fte = d.mh > 0 ? d.mh / hoursInMonth : 0;
      const avgRate = d.mh > 0 ? d.spend / d.mh : 0;
      return { period: formatPeriodLabel(period), fte, avgRate, manhours: d.mh };
    });
  }, [data, dateRange, exclude, projects, tags]);

  if (!chartData.length) return null;

  const avgFTE = chartData.reduce((sum, d) => sum + d.fte, 0) / chartData.length;
  const avgRate = chartData.filter(d => d.avgRate > 0).reduce((sum, d, _, arr) => sum + d.avgRate / arr.length, 0);

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 45, left: 5, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              angle={-45}
              textAnchor="end"
              interval={Math.max(0, Math.floor(chartData.length / 10))}
              dy={5}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={55}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <Bar yAxisId="left" dataKey="fte" name="Monthly FTE" fill={COLORS.gold} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="avgRate" name="Avg Rate ($/hr)" stroke={COLORS.emerald} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 text-xs mt-2 pb-2">
          <span className="text-neutral-400">Avg FTE: <span className="text-gold font-semibold">{avgFTE.toFixed(1)}</span></span>
          <span className="text-neutral-400">Avg Rate: <span className="text-emerald-400 font-semibold">${avgRate.toFixed(2)}/hr</span></span>
        </div>
      </div>
    </div>
  );
}

/**
 * Discipline Breakdown Chart - Horizontal bar chart by D_GROUP
 */
export function DisciplineBreakdownChart({ data, title = 'By Discipline', projects, excludeCurrentMonth: exclude, tags }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const filteredData = applyExclusions(filterByProjects(filterByTags(data, tags), projects), exclude);
    const disciplineMap = new Map<string, { jtdSpend: number; periodSpend: number }>();

    for (const row of filteredData) {
      // Try to get D_GROUP from the row (it's added by wbsDataMerger)
      const discipline = (row as unknown as { D_GROUP?: string }).D_GROUP || '(No Discipline)';
      const existing = disciplineMap.get(discipline) || { jtdSpend: 0, periodSpend: 0 };
      existing.jtdSpend += parseFloat(String(row.JTD_SPEND || 0)) || 0;
      existing.periodSpend += parseFloat(String(row.PER_SPEND || 0)) || 0;
      disciplineMap.set(discipline, existing);
    }

    return Array.from(disciplineMap.entries())
      .filter(([name]) => name !== '(No Discipline)' || disciplineMap.size === 1)
      .map(([name, values]) => ({
        name,
        jtdSpend: values.jtdSpend,
        periodSpend: values.periodSpend,
      }))
      .sort((a, b) => b.jtdSpend - a.jtdSpend)
      .slice(0, 10);
  }, [data, exclude, projects, tags]);

  if (!chartData.length) return null;

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 15, right: 40, left: 100, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              tickFormatter={formatCurrency}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#d4d4d4', fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              width={95}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            <Bar dataKey="jtdSpend" name="JTD Spend" fill={COLORS.gold} radius={[0, 3, 3, 0]} />
            <Bar dataKey="periodSpend" name="Period Spend" fill={COLORS.blue} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Generic metric trend chart that can plot any metric over time.
 */
export function MetricTrendChart({
  data,
  title,
  dateRange,
  projects,
  excludeCurrentMonth: exclude,
  metric,
  groupBy,
  style,
  tags,
}: ChartProps) {
  const metricKey = getMetricKey(metric);
  const metricLabel = getMetricLabel(metric);
  const perKey = METRIC_DEFS[metricKey]?.perKey;
  const jtdKey = METRIC_DEFS[metricKey]?.jtdKey;

  const chartData = useMemo(() => {
    if (!data.length) return [];
    let filteredData = applyExclusions(data, exclude);
    filteredData = filterByProjects(filteredData, projects);
    filteredData = filterByTags(filteredData, tags);
    filteredData = filterByDateRange(filteredData, dateRange);

    const topLevelRows = filteredData.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      return !cbs || cbs.trim() === '' || cbs === '-';
    });

    if (style === 'stacked' && groupBy) {
      const groups = new Map<string, Map<string, number>>();
      for (const row of topLevelRows) {
        const period = String(row.FISCAL_YEAR_MONTH_NO || '');
        const groupVal = String((row as Record<string, unknown>)[groupBy] || '(No Value)');
        const value = parseFloat(String((row as Record<string, unknown>)[metricKey])) || 0;
        if (!groups.has(period)) groups.set(period, new Map());
        const periodMap = groups.get(period)!;
        periodMap.set(groupVal, (periodMap.get(groupVal) || 0) + value);
      }

      const periods = Array.from(groups.keys()).sort();
      const seriesKeys = new Set<string>();
      groups.forEach(map => map.forEach((_, k) => seriesKeys.add(k)));
      const keys = Array.from(seriesKeys).slice(0, 8);

      return periods.map(period => {
        const row: Record<string, number | string> = { period: formatPeriodLabel(period) };
        const periodMap = groups.get(period)!;
        keys.forEach(k => {
          row[k] = periodMap.get(k) || 0;
        });
        return row;
      });
    }

    const periodMap = new Map<string, { value: number; per: number; jtd: number }>();
    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const value = parseFloat(String((row as Record<string, unknown>)[metricKey])) || 0;
      const per = perKey ? parseFloat(String((row as Record<string, unknown>)[perKey])) || 0 : 0;
      const jtd = jtdKey ? parseFloat(String((row as Record<string, unknown>)[jtdKey])) || 0 : 0;
      const existing = periodMap.get(period) || { value: 0, per: 0, jtd: 0 };
      existing.value += value;
      existing.per += per;
      existing.jtd += jtd;
      periodMap.set(period, existing);
    }

    let cumulative = 0;
    return Array.from(periodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => {
        cumulative += values.value;
        return {
          period: formatPeriodLabel(period),
          value: values.value,
          cumulative,
          per: values.per,
          jtd: values.jtd,
        };
      });
  }, [data, dateRange, exclude, groupBy, metricKey, perKey, jtdKey, projects, style, tags]);

  if (!chartData.length) return null;

  const chartTitle = title || `${metricLabel} Trend`;
  const renderStacked = style === 'stacked' && groupBy;
  const renderCombo = style === 'combo' && perKey && jtdKey;

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{chartTitle}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 45, left: 5, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              angle={-45}
              textAnchor="end"
              interval={Math.max(0, Math.floor(chartData.length / 10))}
              dy={5}
            />
            <YAxis
              tick={{ fill: '#a3a3a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={70}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={12}
              iconType="rect"
              wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
            />
            {!renderStacked && !renderCombo && (style === 'bar') && (
              <Bar dataKey="value" name={metricLabel} fill={COLORS.gold} radius={[3, 3, 0, 0]} />
            )}
            {!renderStacked && !renderCombo && (style === 'line' || !style) && (
              <Line type="monotone" dataKey="value" name={metricLabel} stroke={COLORS.gold} strokeWidth={2.5} dot={false} />
            )}
            {renderCombo && (
              <>
                <Bar dataKey="per" name="Period" fill={COLORS.gold} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="jtd" name="JTD" stroke={COLORS.purple} strokeWidth={2.5} dot={false} />
              </>
            )}
            {renderStacked && (
              Object.keys(chartData[0]).filter(k => k !== 'period').map((key, idx) => (
                <Bar key={key} dataKey={key} stackId="a" fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface InlineChatChartProps {
  type: ChartType;
  data: CostDataRow[];
  title?: string;
  dateRange?: DateRange;
  projects?: string[];
  excludeCurrentMonth?: boolean;
  tags?: Record<string, string[]>;
  metric?: string | null;
  groupBy?: string | null;
  style?: 'line' | 'bar' | 'stacked' | 'combo' | null;
}

/**
 * Main component to render inline charts in chat based on type
 */
export function InlineChatChart({ type, data, title, dateRange, projects, excludeCurrentMonth: exclude, tags, metric, groupBy, style }: InlineChatChartProps) {
  switch (type) {
    case 'spend-trend':
      return <SpendTrendChart data={data} title={title} dateRange={dateRange} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'project-comparison':
      return <ProjectComparisonChart data={data} title={title} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'budget-pie':
      return <BudgetPieChart data={data} title={title} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'variance':
      return <VarianceChart data={data} title={title} projects={projects} dateRange={dateRange} excludeCurrentMonth={exclude} tags={tags} />;
    case 'earned-value':
      return <EarnedValueChart data={data} title={title} dateRange={dateRange} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'manhours-trend':
      return <ManhoursTrendChart data={data} title={title} dateRange={dateRange} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'fte-trend':
      return <FTETrendChart data={data} title={title} dateRange={dateRange} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'discipline-breakdown':
      return <DisciplineBreakdownChart data={data} title={title} projects={projects} excludeCurrentMonth={exclude} tags={tags} />;
    case 'metric-trend':
      return (
        <MetricTrendChart
          data={data}
          title={title}
          dateRange={dateRange}
          projects={projects}
          excludeCurrentMonth={exclude}
          tags={tags}
          metric={metric}
          groupBy={groupBy}
          style={style}
        />
      );
    default:
      return null;
  }
}

/**
 * Parse date range from message (e.g., "Jan 2024 to Jun 2024", "2024", "Q1 2024")
 */
export function parseDateRange(message: string): DateRange | undefined {
  const lower = message.toLowerCase();

  // Match "YYYY" for full year
  const yearMatch = lower.match(/\b(202\d)\b/);
  if (yearMatch && !lower.includes('to') && !lower.includes('-')) {
    const year = yearMatch[1];
    // Check if asking for specific year only
    if (lower.includes(`in ${year}`) || lower.includes(`for ${year}`) || lower.includes(`${year} data`)) {
      return { start: `${year}01`, end: `${year}12` };
    }
  }

  // Match month ranges like "Jan 2024 to Jun 2024" or "January 2024 - June 2024"
  const monthNames: { [key: string]: string } = {
    jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
    apr: '04', april: '04', may: '05', jun: '06', june: '06',
    jul: '07', july: '07', aug: '08', august: '08', sep: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
  };

  const rangeMatch = lower.match(/(\w+)\s*(202\d)\s*(?:to|-|through)\s*(\w+)\s*(202\d)/);
  if (rangeMatch) {
    const startMonth = monthNames[rangeMatch[1]] || '01';
    const startYear = rangeMatch[2];
    const endMonth = monthNames[rangeMatch[3]] || '12';
    const endYear = rangeMatch[4];
    return { start: `${startYear}${startMonth}`, end: `${endYear}${endMonth}` };
  }

  // Match quarter like "Q1 2024"
  const quarterMatch = lower.match(/q([1-4])\s*(202\d)/);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1]);
    const year = quarterMatch[2];
    const quarterRanges: { [key: number]: { start: string; end: string } } = {
      1: { start: '01', end: '03' },
      2: { start: '04', end: '06' },
      3: { start: '07', end: '09' },
      4: { start: '10', end: '12' },
    };
    return { start: `${year}${quarterRanges[quarter].start}`, end: `${year}${quarterRanges[quarter].end}` };
  }

  return undefined;
}

/**
 * Chart request intent with filters extracted from message
 */
export interface ChartIntent {
  type: ChartType;
  filters?: {
    tags?: Record<string, string[]>;
    exclude?: string[];
    projects?: string[];
  };
  dateRange?: DateRange;
  metric?: string | null;
  groupBy?: string | null;
  style?: 'line' | 'bar' | 'stacked' | 'combo' | null;
}

/**
 * Detect if a message requests a chart and return the chart type
 */
export function detectChartRequest(message: string): ChartType | null {
  const lower = message.toLowerCase();

  // Check for explicit /chart command
  if (lower.startsWith('/chart')) {
    const args = lower.replace('/chart', '').trim();
    if (args.includes('manhour') || args.includes('mh trend') || args.includes('labor hour')) return 'manhours-trend';
    if (args.includes('fte') || args.includes('headcount') || args.includes('staffing')) return 'fte-trend';
    if (args.includes('discipline') || args.includes('by discipline')) return 'discipline-breakdown';
    if (args.includes('earned') || args.includes('ev') || args.includes('cpi')) return 'earned-value';
    if (args.includes('project') || args.includes('compare')) return 'project-comparison';
    if (args.includes('pie') || args.includes('budget') || args.includes('allocation')) return 'budget-pie';
    if (args.includes('variance') || args.includes('over') || args.includes('under')) return 'variance';
    return 'spend-trend'; // Default for /chart spend or /chart trend
  }

  // Check for manhours/FTE charts (specific patterns first)
  if (lower.includes('manhour') && (lower.includes('trend') || lower.includes('over time') || lower.includes('chart') || lower.includes('graph') || lower.includes('plot'))) {
    return 'manhours-trend';
  }
  if ((lower.includes('fte') || lower.includes('headcount') || lower.includes('staffing')) && (lower.includes('trend') || lower.includes('over time') || lower.includes('chart') || lower.includes('count'))) {
    return 'fte-trend';
  }
  if ((lower.includes('discipline') || lower.includes('by discipline') || lower.includes('per discipline')) && (lower.includes('chart') || lower.includes('breakdown') || lower.includes('show') || lower.includes('graph'))) {
    return 'discipline-breakdown';
  }

  // Check for earned value (more specific)
  if (lower.includes('earned value') || lower.includes('ev chart') || lower.includes('evm') || lower.includes('cpi') || lower.includes('spi')) {
    return 'earned-value';
  }
  if (lower.includes('spend trend') || lower.includes('spending trend') || lower.includes('show me the trend') || lower.includes('monthly spend') || lower.includes('spend over time')) {
    return 'spend-trend';
  }
  if (lower.includes('project comparison') || lower.includes('compare project') || lower.includes('project breakdown') || lower.includes('compare firms') || lower.includes('firm comparison')) {
    return 'project-comparison';
  }
  if (lower.includes('budget allocation') || lower.includes('pie chart') || lower.includes('budget distribution')) {
    return 'budget-pie';
  }
  if (lower.includes('variance') || lower.includes('over budget') || lower.includes('under budget') || lower.includes('unfavorable') || lower.includes('favorable')) {
    return 'variance';
  }
  if (lower.includes('chart') || lower.includes('graph') || lower.includes('visualize') || lower.includes('plot')) {
    // More intelligent default based on context
    if (lower.includes('manhour') || lower.includes('mh')) return 'manhours-trend';
    if (lower.includes('fte') || lower.includes('headcount')) return 'fte-trend';
    if (lower.includes('discipline')) return 'discipline-breakdown';
    if (lower.includes('compare') || lower.includes('vs')) return 'project-comparison';
    if (lower.includes('progress') || lower.includes('complete')) return 'earned-value';
    if (detectMetricFromMessage(message)) return 'metric-trend';
    return 'spend-trend'; // Default chart
  }

  // Check for show me patterns
  if (lower.includes('show me') || lower.includes('show the')) {
    if (lower.includes('manhour')) return 'manhours-trend';
    if (lower.includes('fte') || lower.includes('headcount')) return 'fte-trend';
    if (lower.includes('discipline')) return 'discipline-breakdown';
    if (lower.includes('spend') || lower.includes('cost') || lower.includes('trend')) return 'spend-trend';
    if (lower.includes('variance') || lower.includes('problem')) return 'variance';
    if (lower.includes('progress') || lower.includes('ev')) return 'earned-value';
  }

  return null;
}

/**
 * Parse chart request for filters (discipline, firm, tags, exclusions)
 */
export function parseChartFilters(message: string): ChartIntent['filters'] | undefined {
  const lower = message.toLowerCase();
  const filters: ChartIntent['filters'] = {};

  const addTag = (key: keyof WBSTagFilters, value?: string | null) => {
    if (!value) return;
    const normalized = value.trim().toUpperCase();
    if (!normalized) return;
    filters.tags = { ...filters.tags, [key]: [normalized] };
  };

  // Parse exclusions (e.g., "excluding KIE", "except firm ABC")
  const excludeMatch = lower.match(/(?:exclud|except|without|not including)\s+(?:firm\s+)?(\w+)/i);
  if (excludeMatch) {
    filters.exclude = [excludeMatch[1].toUpperCase()];
  }

  // Parse discipline/D-Group filters
  const disciplineMatch = lower.match(/(?:for|filter by|only)\s+(?:discipline\s+)?(\w+)\s+(?:discipline)?/i);
  if (disciplineMatch) {
    addTag('dGroup', disciplineMatch[1]);
  }

  // Parse firm filters
  const firmMatch = lower.match(/(?:for|filter by|only)\s+firm\s+(\w+)/i);
  if (firmMatch) {
    addTag('userDefined7', firmMatch[1]);
  }

  // Parse WBS element filters
  const wbsMatch = lower.match(/wbs(?:\s+element)?\s+([a-z0-9\.\-]+)/i);
  if (wbsMatch) {
    addTag('wbsElement', wbsMatch[1]);
  }

  // Parse area / phase / account code filters
  const areaMatch = lower.match(/(?:for|filter by|only)\s+area\s+([a-z0-9\.\-]+)/i);
  if (areaMatch) addTag('area', areaMatch[1]);

  const phaseMatch = lower.match(/(?:for|filter by|only)\s+phase\s+([a-z0-9\.\-]+)/i);
  if (phaseMatch) addTag('phase', phaseMatch[1]);

  const accountMatch = lower.match(/account\s+code\s+([a-z0-9\.\-]+)/i);
  if (accountMatch) addTag('accountCode', accountMatch[1]);

  // Parse other tag fields
  const tag16Match = lower.match(/(?:district\s+specific\s+tag\s*16|tag\s*16)\s+([a-z0-9\.\-]+)/i);
  if (tag16Match) addTag('districtSpecificTag16', tag16Match[1]);

  const tag19Match = lower.match(/(?:district\s+specific\s+tag\s*19|tag\s*19)\s+([a-z0-9\.\-]+)/i);
  if (tag19Match) addTag('districtSpecificTag19', tag19Match[1]);

  const userDefined12Match = lower.match(/user\s*defined\s*12\s+([a-z0-9\.\-]+)/i);
  if (userDefined12Match) addTag('userDefined12', userDefined12Match[1]);

  const tag23Match = lower.match(/tag\s*23\s+([a-z0-9\.\-]+)/i);
  if (tag23Match) addTag('tag23', tag23Match[1]);

  const tag25Match = lower.match(/tag\s*25\s+([a-z0-9\.\-]+)/i);
  if (tag25Match) addTag('tag25', tag25Match[1]);

  // Parse project filters
  const projectMatch = lower.match(/project\s+(\d{6})/gi);
  if (projectMatch) {
    filters.projects = projectMatch.map(p => p.replace(/project\s+/i, ''));
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

function detectMetricFromMessage(message: string): string | null {
  const lower = message.toLowerCase();
  const normalized = lower.replace(/[_/]/g, ' ').replace(/\s+/g, ' ').trim();
  const metricMap: Record<string, string> = {
    'per spend': 'PER_SPEND',
    'period spend': 'PER_SPEND',
    'jtd spend': 'JTD_SPEND',
    'budget': 'CB_AMT',
    'forecast change': 'FORECAST_CHANGE',
    'forecast': 'FORECAST_AMOUNT',
    'variance': 'SL_VARIANCE',
    'per mh': 'PER_MH',
    'period mh': 'PER_MH',
    'jtd mh': 'JTD_MH',
    'manhours': 'PER_MH',
    'pf': 'PER_PF',
    'cf': 'PER_CF',
    'percent complete': 'JTD_PERC_COMP',
    'actual cost g/l': 'ACTUAL_COST_G_PER_L',
    'jtd cost g/l': 'JTD_COST_G_PER_L',
  };

  for (const [needle, metric] of Object.entries(metricMap)) {
    if (lower.includes(needle)) {
      return metric;
    }
  }

  for (const key of Object.keys(METRIC_DEFS)) {
    const keyLower = key.toLowerCase();
    const keySpaced = keyLower.replace(/_/g, ' ');
    if (lower.includes(keyLower) || normalized.includes(keySpaced)) {
      return key;
    }
  }
  return null;
}

export function parseChartIntent(message: string): ChartIntent {
  const type = detectChartRequest(message) || 'metric-trend';
  const filters = parseChartFilters(message);
  const dateRange = parseDateRange(message);
  const metric = detectMetricFromMessage(message);

  let style: ChartIntent['style'] = null;
  if (/\bstack(ed)?\b/.test(message.toLowerCase())) style = 'stacked';
  else if (/\bbar\b/.test(message.toLowerCase())) style = 'bar';
  else if (/\bline\b/.test(message.toLowerCase())) style = 'line';
  else if (/\bcombo\b/.test(message.toLowerCase())) style = 'combo';

  let groupBy: ChartIntent['groupBy'] = null;
  if (/by discipline|by d\s*group|by d_group/i.test(message)) groupBy = 'D_GROUP';
  else if (/by firm|by vendor|by contractor/i.test(message)) groupBy = 'USER_DEFINED_7';
  else if (/by area/i.test(message)) groupBy = 'AREA';
  else if (/by phase/i.test(message)) groupBy = 'PHASE';
  else if (/by account/i.test(message)) groupBy = 'ACCOUNT_CODE';
  else if (/by wbs/i.test(message)) groupBy = 'WBS_ELEMENT';
  else if (/by tag\s*23/i.test(message)) groupBy = 'TAG23';
  else if (/by tag\s*25/i.test(message)) groupBy = 'TAG25';
  else if (/by district\s*tag\s*16|by tag\s*16/i.test(message)) groupBy = 'DISTRICT_SPECIFIC_TAG_16';
  else if (/by district\s*tag\s*19|by tag\s*19/i.test(message)) groupBy = 'DISTRICT_SPECIFIC_TAG_19';
  else if (/by user\s*defined\s*12/i.test(message)) groupBy = 'USER_DEFINED_12';

  return { type, filters, dateRange, metric, groupBy, style };
}
