import { useMemo, useState } from 'react';
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
  TooltipProps,
} from 'recharts';
import { CostDataRow } from '../api/types';

interface CostChartsProps {
  data: CostDataRow[];
}

interface ChartDataPoint {
  period: string;
  monthlySpend: number;
  cumulativeSpend: number;
  percentComplete: number;
  pf: number;
  cf: number;
}

// Brand colors - gold/black theme
const COLORS = {
  gold: '#d4a418',
  goldLight: '#f5d76e',
  purple: '#a855f7',
  blue: '#3b82f6',
  amber: '#f59e0b',
  emerald: '#10b981',
  red: '#ef4444',
  cyan: '#06b6d4',
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPeriodLabel(period: string): string {
  if (!period || period.length !== 6) return period || '';
  const year = period.substring(2, 4);
  const month = period.substring(4, 6);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} '${year}`;
}

function formatPeriodLabelFull(period: string): string {
  if (!period || period.length !== 6) return period || '';
  const year = period.substring(0, 4);
  const month = period.substring(4, 6);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

// Custom dark tooltip component
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const labels: Record<string, string> = {
    monthlySpend: 'Period Spend',
    cumulativeSpend: 'Cumulative Total',
    percentComplete: '% Complete',
    pf: 'Performance Factor',
    cf: 'Cost Factor',
  };
  const colors: Record<string, string> = {
    monthlySpend: COLORS.gold,
    cumulativeSpend: COLORS.purple,
    percentComplete: COLORS.emerald,
    pf: COLORS.cyan,
    cf: COLORS.amber,
  };

  const formatValue = (key: string, value: number): string => {
    if (key === 'percentComplete') {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (key === 'pf' || key === 'cf') {
      return value.toFixed(2);
    }
    return formatFullCurrency(value);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl p-4 min-w-[220px]">
      <p className="text-gold font-semibold text-sm mb-3 pb-2 border-b border-neutral-700">
        {formatPeriodLabelFull(label as string)}
      </p>
      {payload.map((entry, index) => {
        const key = entry.dataKey as string;
        return (
          <div key={index} className="flex items-center justify-between gap-4 py-1">
            <span className="flex items-center gap-2 text-neutral-300 text-sm">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: colors[key] || entry.color }}
              />
              {labels[key] || key}
            </span>
            <span className="text-white font-semibold text-sm">
              {formatValue(key, entry.value as number)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// KPI Card component
function KpiCard({
  label,
  value,
  variant,
  subtext
}: {
  label: string;
  value: string;
  variant: 'teal' | 'blue' | 'purple' | 'amber' | 'emerald' | 'cyan' | 'red';
  subtext?: string;
}) {
  return (
    <div className={`kpi-card kpi-card-${variant}`}>
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value">{value}</div>
      {subtext && <div className="kpi-card-subtext">{subtext}</div>}
    </div>
  );
}

export function CostCharts({ data }: CostChartsProps) {
  const [dateRange, setDateRange] = useState<[number, number]>([0, 100]);

  const allChartData = useMemo<ChartDataPoint[]>(() => {
    if (!data.length) return [];

    const topLevelRows = data.filter((row) => {
      const cbs = row.CBS_HIERARCHY;
      if (!cbs) return true;
      const dotCount = (cbs.match(/\./g) || []).length;
      return dotCount <= 1;
    });

    interface PeriodAgg {
      jtdSpend: number;
      perSpend: number;
      percentComplete: number;
      percentCompleteCount: number;
      pf: number;
      pfCount: number;
      cf: number;
      cfCount: number;
    }

    const periodData = new Map<string, PeriodAgg>();

    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const existing = periodData.get(period) || {
        jtdSpend: 0,
        perSpend: 0,
        percentComplete: 0,
        percentCompleteCount: 0,
        pf: 0,
        pfCount: 0,
        cf: 0,
        cfCount: 0,
      };

      const jtd = parseFloat(String(row.JTD_SPEND)) || 0;
      const per = parseFloat(String(row.PER_SPEND)) || 0;
      const jtdPercComp = parseFloat(String(row.JTD_PERC_COMP)) || 0;
      const jtdPf = parseFloat(String(row.JTD_PF)) || 0;
      const jtdCf = parseFloat(String(row.JTD_CF)) || 0;

      existing.jtdSpend += jtd;
      existing.perSpend += per;

      // Only count non-zero values for averaging
      if (jtdPercComp > 0) {
        existing.percentComplete += jtdPercComp;
        existing.percentCompleteCount++;
      }
      if (jtdPf > 0) {
        existing.pf += jtdPf;
        existing.pfCount++;
      }
      if (jtdCf > 0) {
        existing.cf += jtdCf;
        existing.cfCount++;
      }

      periodData.set(period, existing);
    }

    const sortedPeriods = Array.from(periodData.keys()).sort();
    const hasPerSpendData = Array.from(periodData.values()).some(v => v.perSpend !== 0);

    if (hasPerSpendData) {
      let cumulative = 0;
      return sortedPeriods.map((period) => {
        const d = periodData.get(period)!;
        cumulative += d.perSpend;
        return {
          period,
          monthlySpend: d.perSpend,
          cumulativeSpend: cumulative,
          percentComplete: d.percentCompleteCount > 0 ? d.percentComplete / d.percentCompleteCount : 0,
          pf: d.pfCount > 0 ? d.pf / d.pfCount : 0,
          cf: d.cfCount > 0 ? d.cf / d.cfCount : 0,
        };
      });
    } else {
      let prevJtd = 0;
      return sortedPeriods.map((period) => {
        const d = periodData.get(period)!;
        const monthlySpend = d.jtdSpend - prevJtd;
        prevJtd = d.jtdSpend;
        return {
          period,
          monthlySpend,
          cumulativeSpend: d.jtdSpend,
          percentComplete: d.percentCompleteCount > 0 ? d.percentComplete / d.percentCompleteCount : 0,
          pf: d.pfCount > 0 ? d.pf / d.pfCount : 0,
          cf: d.cfCount > 0 ? d.cf / d.cfCount : 0,
        };
      });
    }
  }, [data]);

  const chartData = useMemo(() => {
    if (!allChartData.length) return [];
    const startIdx = Math.floor((dateRange[0] / 100) * allChartData.length);
    const endIdx = Math.ceil((dateRange[1] / 100) * allChartData.length);
    return allChartData.slice(startIdx, Math.max(endIdx, startIdx + 1));
  }, [allChartData, dateRange]);

  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const totalSpend = chartData[chartData.length - 1]?.cumulativeSpend || 0;
    const monthlySpends = chartData.map((d) => d.monthlySpend);
    const avgMonthlySpend = monthlySpends.reduce((a, b) => a + b, 0) / monthlySpends.length;

    // Get latest period's % complete, PF, CF
    const latestData = chartData[chartData.length - 1];
    const percentComplete = latestData?.percentComplete || 0;
    const pf = latestData?.pf || 0;
    const cf = latestData?.cf || 0;

    return { totalSpend, avgMonthlySpend, numPeriods: chartData.length, percentComplete, pf, cf };
  }, [chartData]);

  // Calculate trend indicator (compare last 3 periods vs previous 3)
  const trend = useMemo(() => {
    if (chartData.length < 6) return null;

    const recentPeriods = chartData.slice(-3);
    const previousPeriods = chartData.slice(-6, -3);

    const recentAvg = recentPeriods.reduce((sum, d) => sum + d.monthlySpend, 0) / 3;
    const previousAvg = previousPeriods.reduce((sum, d) => sum + d.monthlySpend, 0) / 3;

    if (previousAvg === 0) return null;

    const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;
    return {
      direction: changePercent >= 0 ? 'up' : 'down',
      percent: Math.abs(changePercent),
    };
  }, [chartData]);

  if (!data.length) return null;

  const startPeriod = allChartData[Math.floor((dateRange[0] / 100) * allChartData.length)]?.period || '';
  const endPeriod = allChartData[Math.min(Math.ceil((dateRange[1] / 100) * allChartData.length), allChartData.length) - 1]?.period || '';

  return (
    <div className="mb-6 rounded-lg overflow-hidden border border-neutral-800">
      {/* Header */}
      <div className="bg-neutral-900 px-6 py-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Project Spend Analysis</h2>
            <p className="text-sm text-neutral-400 mt-1">
              {formatPeriodLabelFull(startPeriod)} — {formatPeriodLabelFull(endPeriod)}
            </p>
          </div>
          {trend && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              trend.direction === 'up'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              <span>{trend.direction === 'up' ? '▲' : '▼'}</span>
              <span>{trend.percent.toFixed(1)}% {trend.direction === 'up' ? 'trending up' : 'trending down'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="bg-neutral-950 p-6">
        {/* Date Range Slider */}
        <div className="mb-6 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Start Period
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={dateRange[0]}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDateRange([Math.min(val, dateRange[1] - 5), dateRange[1]]);
                }}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: COLORS.gold }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                End Period
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={dateRange[1]}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setDateRange([dateRange[0], Math.max(val, dateRange[0] + 5)]);
                }}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: COLORS.gold }}
              />
            </div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ width: '100%', height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 50, left: 10, bottom: 40 }}
            >
              <CartesianGrid
                strokeDasharray="none"
                stroke="#262626"
                vertical={false}
              />
              <XAxis
                dataKey="period"
                tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={{ stroke: '#404040' }}
                angle={-45}
                textAnchor="end"
                interval={0}
                tickFormatter={formatPeriodLabel}
                dy={5}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                width={60}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#a3a3a3', fontSize: 11, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                width={70}
              />
              <YAxis
                yAxisId="percent"
                orientation="right"
                tick={{ fill: COLORS.emerald, fontSize: 10, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 1]}
                width={0}
                hide
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 164, 24, 0.1)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={36}
                iconType="rect"
                iconSize={12}
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    monthlySpend: 'Period Spend',
                    cumulativeSpend: 'Cumulative Total',
                    percentComplete: '% Complete',
                  };
                  const colors: Record<string, string> = {
                    monthlySpend: COLORS.gold,
                    cumulativeSpend: COLORS.purple,
                    percentComplete: COLORS.emerald,
                  };
                  return (
                    <span style={{ color: colors[value] || '#a3a3a3' }}>
                      {labels[value] || value}
                    </span>
                  );
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="monthlySpend"
                fill={COLORS.gold}
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeSpend"
                stroke={COLORS.purple}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: COLORS.purple, strokeWidth: 2, stroke: '#fff' }}
              />
              <Line
                yAxisId="percent"
                type="monotone"
                dataKey="percentComplete"
                stroke={COLORS.emerald}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5, fill: COLORS.emerald, strokeWidth: 2, stroke: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer with KPI Cards */}
      {stats && (
        <div className="bg-neutral-900 px-6 py-4 border-t border-neutral-800">
          <div className="grid grid-cols-6 gap-3">
            <KpiCard
              label="Total Spend"
              value={formatFullCurrency(stats.totalSpend)}
              variant="amber"
            />
            <KpiCard
              label="Avg. Monthly"
              value={formatFullCurrency(stats.avgMonthlySpend)}
              variant="blue"
            />
            <KpiCard
              label="% Complete"
              value={`${(stats.percentComplete * 100).toFixed(1)}%`}
              variant="emerald"
            />
            <KpiCard
              label="PF (Performance)"
              value={stats.pf.toFixed(2)}
              variant={stats.pf > 1 ? 'red' : 'cyan'}
              subtext={stats.pf > 1 ? 'Behind schedule' : stats.pf < 1 ? 'Ahead' : 'On track'}
            />
            <KpiCard
              label="CF (Cost)"
              value={stats.cf.toFixed(2)}
              variant={stats.cf > 1 ? 'red' : 'cyan'}
              subtext={stats.cf > 1 ? 'Over budget' : stats.cf < 1 ? 'Under budget' : 'On budget'}
            />
            <KpiCard
              label="Periods"
              value={`${stats.numPeriods}`}
              variant="purple"
              subtext="months"
            />
          </div>
        </div>
      )}
    </div>
  );
}
