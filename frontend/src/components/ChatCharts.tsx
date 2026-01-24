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

// Brand colors
const COLORS = {
  teal: '#00d4aa',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  emerald: '#10b981',
};

const PIE_COLORS = [COLORS.teal, COLORS.blue, COLORS.purple, COLORS.amber, COLORS.emerald, COLORS.red];

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
    <div className="bg-midnight-950 border border-accent/50 rounded-lg shadow-xl p-3 text-xs">
      <p className="text-accent font-semibold mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name}
          </span>
          <span className="text-slate-100 font-medium">
            {formatCurrency(entry.value as number)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface ChartProps {
  data: CostDataRow[];
  title?: string;
}

/**
 * Spend Trend Chart - Bar + Line combo showing period spend and cumulative
 */
export function SpendTrendChart({ data, title = 'Spend Trend' }: ChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const topLevelRows = data.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      if (!cbs) return true;
      const dotCount = (cbs.match(/\./g) || []).length;
      return dotCount <= 1;
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
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334e68" vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334e68' }}
              angle={-45}
              textAnchor="end"
              interval={Math.floor(chartData.length / 8)}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={55}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={55}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend
              verticalAlign="top"
              height={30}
              iconSize={10}
              wrapperStyle={{ fontSize: '11px' }}
            />
            <Bar yAxisId="left" dataKey="spend" name="Period Spend" fill={COLORS.teal} radius={[2, 2, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke={COLORS.purple} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
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

    const topLevelRows = data.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      if (!cbs) return true;
      const dotCount = (cbs.match(/\./g) || []).length;
      return dotCount <= 1;
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
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 35)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334e68" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334e68' }}
              tickFormatter={formatCurrency}
            />
            <YAxis
              type="category"
              dataKey="project"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend verticalAlign="top" height={30} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="spent" name="Spent" stackId="a" fill={COLORS.teal} />
            <Bar dataKey="remaining" name="Remaining" stackId="a" fill={COLORS.blue} opacity={0.5} />
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

    const topLevelRows = data.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      if (!cbs) return true;
      const dotCount = (cbs.match(/\./g) || []).length;
      return dotCount <= 1;
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

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
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

  return (
    <div className="chat-chart">
      <div className="chat-chart-header">{title}</div>
      <div className="chat-chart-body">
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334e68" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#334e68' }}
              tickFormatter={formatCurrency}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={75}
            />
            <Tooltip content={<DarkTooltip />} />
            <Bar
              dataKey="variance"
              name="Variance"
              fill={COLORS.teal}
              radius={[0, 2, 2, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.variance >= 0 ? COLORS.emerald : COLORS.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type ChartType = 'spend-trend' | 'project-comparison' | 'budget-pie' | 'variance';

interface InlineChatChartProps {
  type: ChartType;
  data: CostDataRow[];
  title?: string;
}

/**
 * Main component to render inline charts in chat based on type
 */
export function InlineChatChart({ type, data, title }: InlineChatChartProps) {
  switch (type) {
    case 'spend-trend':
      return <SpendTrendChart data={data} title={title} />;
    case 'project-comparison':
      return <ProjectComparisonChart data={data} title={title} />;
    case 'budget-pie':
      return <BudgetPieChart data={data} title={title} />;
    case 'variance':
      return <VarianceChart data={data} title={title} />;
    default:
      return null;
  }
}

/**
 * Detect if a message requests a chart and return the chart type
 */
export function detectChartRequest(message: string): ChartType | null {
  const lower = message.toLowerCase();

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
