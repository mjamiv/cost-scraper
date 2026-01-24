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
} from 'recharts';
import { CostDataRow } from '../api/types';

interface CostChartsProps {
  data: CostDataRow[];
}

interface ChartDataPoint {
  period: string;
  monthlySpend: number;
  cumulativeSpend: number;
}

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

    const periodData = new Map<string, { jtdSpend: number; perSpend: number }>();

    for (const row of topLevelRows) {
      const period = String(row.FISCAL_YEAR_MONTH_NO || '');
      const existing = periodData.get(period) || { jtdSpend: 0, perSpend: 0 };

      const jtd = parseFloat(String(row.JTD_SPEND)) || 0;
      const per = parseFloat(String(row.PER_SPEND)) || 0;

      existing.jtdSpend += jtd;
      existing.perSpend += per;

      periodData.set(period, existing);
    }

    const sortedPeriods = Array.from(periodData.keys()).sort();
    const hasPerSpendData = Array.from(periodData.values()).some(v => v.perSpend !== 0);

    if (hasPerSpendData) {
      let cumulative = 0;
      return sortedPeriods.map((period) => {
        const d = periodData.get(period)!;
        cumulative += d.perSpend;
        return { period, monthlySpend: d.perSpend, cumulativeSpend: cumulative };
      });
    } else {
      let prevJtd = 0;
      return sortedPeriods.map((period) => {
        const d = periodData.get(period)!;
        const monthlySpend = d.jtdSpend - prevJtd;
        prevJtd = d.jtdSpend;
        return { period, monthlySpend, cumulativeSpend: d.jtdSpend };
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
    return { totalSpend, avgMonthlySpend, numPeriods: chartData.length };
  }, [chartData]);

  if (!data.length) return null;

  const startPeriod = allChartData[Math.floor((dateRange[0] / 100) * allChartData.length)]?.period || '';
  const endPeriod = allChartData[Math.min(Math.ceil((dateRange[1] / 100) * allChartData.length), allChartData.length) - 1]?.period || '';

  return (
    <div className="mb-6 bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800">Project Spend Analysis</h2>
        <p className="text-sm text-slate-500 mt-1">
          {formatPeriodLabelFull(startPeriod)} — {formatPeriodLabelFull(endPeriod)}
        </p>
      </div>

      <div className="p-6">
        {/* Date Range Slider */}
        <div className="mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
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
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#475569' }}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
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
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#475569' }}
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
                stroke="#e2e8f0"
                vertical={false}
              />
              <XAxis
                dataKey="period"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                angle={-45}
                textAnchor="end"
                interval={0}
                tickFormatter={formatPeriodLabel}
                dy={5}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                width={60}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'system-ui' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '12px',
                }}
                labelStyle={{
                  color: '#1e293b',
                  fontWeight: 600,
                  marginBottom: '8px',
                  fontSize: '13px'
                }}
                labelFormatter={formatPeriodLabelFull}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    monthlySpend: 'Period Spend',
                    cumulativeSpend: 'Cumulative',
                  };
                  return [formatFullCurrency(value), labels[name] || name];
                }}
                itemStyle={{ padding: '2px 0', fontSize: '12px' }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={36}
                iconType="rect"
                iconSize={12}
                wrapperStyle={{ fontSize: '12px', color: '#475569' }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    monthlySpend: 'Period Spend',
                    cumulativeSpend: 'Cumulative Total',
                  };
                  return <span style={{ color: '#475569' }}>{labels[value] || value}</span>;
                }}
              />
              <Bar
                yAxisId="left"
                dataKey="monthlySpend"
                fill="#64748b"
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativeSpend"
                stroke="#0f172a"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#0f172a', strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        {stats && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Total Spend
                </div>
                <div className="text-2xl font-semibold text-slate-800 mt-1">
                  {formatFullCurrency(stats.totalSpend)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Avg. Monthly Spend
                </div>
                <div className="text-2xl font-semibold text-slate-800 mt-1">
                  {formatFullCurrency(stats.avgMonthlySpend)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Periods
                </div>
                <div className="text-2xl font-semibold text-slate-800 mt-1">
                  {stats.numPeriods}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
