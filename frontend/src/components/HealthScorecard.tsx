import { useEVMMetrics } from '../hooks/useQueries';
import type { ProjectHealth, EVMMetrics } from '../hooks/useQueries';

interface HealthScorecardProps {
  projectNumbers: string;
  startMonth: string;
}

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  green: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' },
  yellow: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  red: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
};

const STATUS_LABELS: Record<string, string> = {
  green: 'On Track',
  yellow: 'At Risk',
  red: 'Critical',
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.green;
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: color.border }}
    />
  );
}

function ScorecardCard({
  label,
  value,
  status,
  subtext,
}: {
  label: string;
  value: string;
  status: string;
  subtext?: string;
}) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.green;
  return (
    <div
      className="kpi-card"
      style={{ borderLeftColor: color.border, background: color.bg }}
    >
      <div className="kpi-card-label flex items-center gap-1.5">
        <StatusDot status={status} />
        {label}
      </div>
      <div className="kpi-card-value">{value}</div>
      {subtext && <div className="kpi-card-subtext">{subtext}</div>}
    </div>
  );
}

function buildCards(evm: EVMMetrics, health: ProjectHealth) {
  return [
    {
      label: 'Overall',
      value: STATUS_LABELS[health.overall] || 'Unknown',
      status: health.overall,
      subtext: `${evm.percent_complete.toFixed(1)}% complete`,
    },
    {
      label: 'CPI',
      value: evm.CPI.toFixed(2),
      status: health.CPI.status,
      subtext: evm.CPI >= 1 ? 'Under budget' : 'Over budget',
    },
    {
      label: 'SPI',
      value: evm.SPI.toFixed(2),
      status: health.SPI.status,
      subtext: evm.SPI >= 1 ? 'Ahead of schedule' : 'Behind schedule',
    },
    {
      label: 'EAC',
      value: formatCurrency(evm.EAC),
      status: health.EAC_variance.status,
      subtext: `BAC: ${formatCurrency(evm.BAC)}`,
    },
    {
      label: 'Variance',
      value: formatCurrency(evm.VAC),
      status: health.EAC_variance.status,
      subtext: `${health.EAC_variance.percent.toFixed(1)}% of budget`,
    },
  ];
}

export function HealthScorecard({ projectNumbers, startMonth }: HealthScorecardProps) {
  const { data, isLoading, error } = useEVMMetrics(projectNumbers, startMonth);

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse" style={{ borderLeftColor: '#525252' }}>
              <div className="h-3 w-16 bg-neutral-700 rounded mb-2" />
              <div className="h-5 w-12 bg-neutral-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.success) return null;

  const cards = buildCards(data.evm, data.health);

  return (
    <div className="px-4 py-3 border-b border-neutral-800">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {cards.map((card) => (
          <ScorecardCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}
