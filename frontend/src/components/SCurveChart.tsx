import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  TooltipProps,
} from 'recharts';
import { useEVMTrends, EVMTrendPoint } from '../hooks/useQueries';

interface SCurveChartProps {
  projectNumbers: string;
  startMonth: string;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPeriod(period: string): string {
  if (!period || period.length !== 6) return period;
  const year = period.slice(2, 4);
  const month = parseInt(period.slice(4), 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1] || month}'${year}`;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-sm" style={{ minWidth: 200 }}>
      <div className="font-semibold text-white mb-2">{formatPeriod(String(label))}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-mono text-white">{formatCurrency(entry.value as number)}</span>
        </div>
      ))}
    </div>
  );
}

function KpiStrip({ trends }: { trends: EVMTrendPoint[] }) {
  const latest = trends[trends.length - 1];
  if (!latest) return null;

  const cards = [
    { label: 'CV', value: formatCurrency(latest.CV), color: latest.CV >= 0 ? '#10b981' : '#ef4444' },
    { label: 'SV', value: formatCurrency(latest.SV), color: latest.SV >= 0 ? '#10b981' : '#ef4444' },
    { label: 'CPI', value: latest.CPI.toFixed(2), color: latest.CPI >= 1 ? '#10b981' : latest.CPI >= 0.9 ? '#f59e0b' : '#ef4444' },
    { label: 'SPI', value: latest.SPI.toFixed(2), color: latest.SPI >= 1 ? '#10b981' : latest.SPI >= 0.9 ? '#f59e0b' : '#ef4444' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mt-3">
      {cards.map((c) => (
        <div key={c.label} className="kpi-card" style={{ borderLeftColor: c.color }}>
          <div className="kpi-card-label">{c.label}</div>
          <div className="kpi-card-value" style={{ color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SCurveChart({ projectNumbers, startMonth }: SCurveChartProps) {
  const { data, isLoading, error } = useEVMTrends(projectNumbers, startMonth);

  const chartData = useMemo(() => {
    if (!data?.trends) return [];
    return data.trends.map((t) => ({
      ...t,
      label: formatPeriod(t.period),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="h-4 w-32 bg-neutral-700 rounded mb-4 animate-pulse" />
        <div className="h-[300px] bg-neutral-800 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data?.success || chartData.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-neutral-400">
        <p>No EVM trend data available.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold text-white mb-3">S-Curve: Planned vs Earned vs Actual</h3>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="period"
            tickFormatter={formatPeriod}
            tick={{ fill: '#a3a3a3', fontSize: 11 }}
            stroke="#525252"
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: '#a3a3a3', fontSize: 11 }}
            stroke="#525252"
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="BCWS"
            name="BCWS (Planned)"
            stroke="#3b82f6"
            strokeDasharray="6 3"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="BCWP"
            name="BCWP (Earned)"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="ACWP"
            name="ACWP (Actual)"
            stroke="#d4a418"
            strokeWidth={2}
            dot={false}
          />
          {chartData.length > 6 && (
            <Brush
              dataKey="period"
              tickFormatter={formatPeriod}
              height={24}
              stroke="#525252"
              fill="#171717"
              travellerWidth={8}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <KpiStrip trends={data.trends} />
    </div>
  );
}
