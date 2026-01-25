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
import { CostDataRow } from '../api/types';
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

/**
 * Spend Trend Chart - Bar + Line combo showing period spend and cumulative
 */
export function SpendTrendChart({ data, title = 'Spend Trend', dateRange }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    // Exclude current month, filter by date range, and filter to ROOT-level rows only
    let filteredData = excludeCurrentMonth(data);
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
  }, [data]);

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
export function EarnedValueChart({ data, title = 'Earned Value Analysis', dateRange }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    // Exclude current month, filter by date range, and filter to ROOT-level rows only
    let filteredData = excludeCurrentMonth(data);
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
  }, [data, dateRange]);

  if (!chartData.length) return null;

  // Calculate SPI and CPI for the latest period
  const latest = chartData[chartData.length - 1];
  const spi = latest.earnedValue > 0 && latest.budget > 0 ? (latest.earnedValue / (latest.budget * (chartData.length / 12))).toFixed(2) : 'N/A';
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
export function ProjectComparisonChart({ data, title = 'Project Comparison' }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const projectMap = new Map<string, { budget: number; jtdSpend: number; forecast: number }>();

    // Exclude current month and filter to ROOT-level rows only
    const filteredData = excludeCurrentMonth(data);
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
  }, [data]);

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
export function BudgetPieChart({ data, title = 'Budget Allocation' }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const projectMap = new Map<string, number>();

    // Exclude current month and filter to ROOT-level rows only
    const filteredData = excludeCurrentMonth(data);
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
  }, [data]);

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
export function VarianceChart({ data, title = 'Top Variances' }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    return data
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
  }, [data]);

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

export type ChartType = 'spend-trend' | 'project-comparison' | 'budget-pie' | 'variance' | 'earned-value';

interface InlineChatChartProps {
  type: ChartType;
  data: CostDataRow[];
  title?: string;
  dateRange?: DateRange;
}

/**
 * Main component to render inline charts in chat based on type
 */
export function InlineChatChart({ type, data, title, dateRange }: InlineChatChartProps) {
  switch (type) {
    case 'spend-trend':
      return <SpendTrendChart data={data} title={title} dateRange={dateRange} />;
    case 'project-comparison':
      return <ProjectComparisonChart data={data} title={title} />;
    case 'budget-pie':
      return <BudgetPieChart data={data} title={title} />;
    case 'variance':
      return <VarianceChart data={data} title={title} />;
    case 'earned-value':
      return <EarnedValueChart data={data} title={title} dateRange={dateRange} />;
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
 * Detect if a message requests a chart and return the chart type
 */
export function detectChartRequest(message: string): ChartType | null {
  const lower = message.toLowerCase();

  // Check for earned value first (more specific)
  if (lower.includes('earned value') || lower.includes('ev chart') || lower.includes('evm') || lower.includes('cpi') || lower.includes('spi')) {
    return 'earned-value';
  }
  if (lower.includes('spend trend') || lower.includes('spending trend') || lower.includes('show me the trend') || lower.includes('monthly spend')) {
    return 'spend-trend';
  }
  if (lower.includes('project comparison') || lower.includes('compare project') || lower.includes('project breakdown')) {
    return 'project-comparison';
  }
  if (lower.includes('budget allocation') || lower.includes('pie chart') || lower.includes('budget distribution')) {
    return 'budget-pie';
  }
  if (lower.includes('variance') || lower.includes('over budget') || lower.includes('under budget')) {
    return 'variance';
  }
  if (lower.includes('chart') || lower.includes('graph') || lower.includes('visualize') || lower.includes('show me')) {
    return 'spend-trend'; // Default chart
  }

  return null;
}
