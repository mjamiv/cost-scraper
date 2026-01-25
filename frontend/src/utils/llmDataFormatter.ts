import { CostDataRow } from '../api/types';

/**
 * Get current month in YYYYMM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

/**
 * Filter out current month data from reporting
 * Current month data is typically incomplete and shouldn't be included in analysis
 */
export function excludeCurrentMonth(data: CostDataRow[]): CostDataRow[] {
  const currentMonth = getCurrentMonth();
  return data.filter(row => String(row.FISCAL_YEAR_MONTH_NO) !== currentMonth);
}

// Types for structured LLM export
export interface LLMCostSummary {
  metadata: {
    generatedAt: string;
    dateRange: { start: string; end: string };
    projectCount: number;
    recordCount: number;
  };
  summary: {
    totalBudget: number;
    totalSpendJTD: number;
    totalForecast: number;
    budgetVariance: number;
    status: 'under_budget' | 'on_budget' | 'over_budget';
  };
  byProject: Array<{
    projectNumber: string;
    budget: number;
    jtdSpend: number;
    variance: number;
    percentComplete: number;
  }>;
  byPeriod: Array<{
    period: string;
    periodLabel: string;
    spend: number;
    cumulativeSpend: number;
  }>;
  topVarianceItems: Array<{
    project: string;
    cbsHierarchy: string;
    description: string;
    variance: number;
    type: 'favorable' | 'unfavorable';
  }>;
}

function formatPeriodLabel(period: string): string {
  if (!period || period.length !== 6) return period || '';
  const year = period.substring(0, 4);
  const month = period.substring(4, 6);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIndex = parseInt(month, 10) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Generate structured JSON summary for LLM consumption
 */
export function generateLLMSummary(rawData: CostDataRow[]): LLMCostSummary {
  // Exclude current month - data is typically incomplete
  const data = excludeCurrentMonth(rawData);

  if (!data.length) {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange: { start: '', end: '' },
        projectCount: 0,
        recordCount: 0,
      },
      summary: {
        totalBudget: 0,
        totalSpendJTD: 0,
        totalForecast: 0,
        budgetVariance: 0,
        status: 'on_budget',
      },
      byProject: [],
      byPeriod: [],
      topVarianceItems: [],
    };
  }

  // Get unique projects and periods
  const projects = new Set<string>();
  const periods = new Set<string>();

  data.forEach(row => {
    if (row.PROJECT_NUMBER) projects.add(String(row.PROJECT_NUMBER));
    if (row.FISCAL_YEAR_MONTH_NO) periods.add(String(row.FISCAL_YEAR_MONTH_NO));
  });

  const sortedPeriods = Array.from(periods).sort();

  // Filter to ROOT-level rows only for aggregation (empty CBS_HIERARCHY)
  // Root rows have no CBS_HIERARCHY - they contain the project totals
  // Child rows (CBS "1", "2", etc.) are already summed into the root
  const topLevelRows = data.filter(row => {
    const cbs = row.CBS_HIERARCHY;
    // Only include rows with empty/null/"-" CBS - these are project root totals
    return !cbs || cbs.trim() === '' || cbs === '-';
  });

  // Calculate totals
  let totalBudget = 0;
  let totalSpendJTD = 0;
  let totalForecast = 0;

  topLevelRows.forEach(row => {
    totalBudget += parseFloat(String(row.CB_AMT)) || 0;
    totalSpendJTD += parseFloat(String(row.JTD_SPEND)) || 0;
    totalForecast += parseFloat(String(row.FORECAST_AMOUNT)) || 0;
  });

  const budgetVariance = totalBudget - totalForecast;
  const status: 'under_budget' | 'on_budget' | 'over_budget' =
    budgetVariance > 0 ? 'under_budget' : budgetVariance < 0 ? 'over_budget' : 'on_budget';

  // Group by project
  const projectMap = new Map<string, { budget: number; jtdSpend: number; forecast: number }>();

  topLevelRows.forEach(row => {
    const project = String(row.PROJECT_NUMBER || '');
    const existing = projectMap.get(project) || { budget: 0, jtdSpend: 0, forecast: 0 };
    existing.budget += parseFloat(String(row.CB_AMT)) || 0;
    existing.jtdSpend += parseFloat(String(row.JTD_SPEND)) || 0;
    existing.forecast += parseFloat(String(row.FORECAST_AMOUNT)) || 0;
    projectMap.set(project, existing);
  });

  const byProject = Array.from(projectMap.entries()).map(([projectNumber, values]) => ({
    projectNumber,
    budget: values.budget,
    jtdSpend: values.jtdSpend,
    variance: values.budget - values.forecast,
    percentComplete: values.budget > 0 ? (values.jtdSpend / values.budget) * 100 : 0,
  }));

  // Group by period
  const periodMap = new Map<string, number>();

  topLevelRows.forEach(row => {
    const period = String(row.FISCAL_YEAR_MONTH_NO || '');
    const perSpend = parseFloat(String(row.PER_SPEND)) || 0;
    periodMap.set(period, (periodMap.get(period) || 0) + perSpend);
  });

  let cumulative = 0;
  const byPeriod = sortedPeriods.map(period => {
    const spend = periodMap.get(period) || 0;
    cumulative += spend;
    return {
      period,
      periodLabel: formatPeriodLabel(period),
      spend,
      cumulativeSpend: cumulative,
    };
  });

  // Find top variance items
  const varianceItems = data
    .map(row => ({
      project: String(row.PROJECT_NUMBER || ''),
      cbsHierarchy: String(row.CBS_HIERARCHY || ''),
      description: String(row.WBS_DESCRIPTION || ''),
      variance: parseFloat(String(row.SL_VARIANCE)) || 0,
      type: (parseFloat(String(row.SL_VARIANCE)) || 0) >= 0 ? 'favorable' : 'unfavorable' as const,
    }))
    .filter(item => item.variance !== 0)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 10);

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: sortedPeriods[0] || '',
        end: sortedPeriods[sortedPeriods.length - 1] || '',
      },
      projectCount: projects.size,
      recordCount: data.length,
    },
    summary: {
      totalBudget,
      totalSpendJTD,
      totalForecast,
      budgetVariance,
      status,
    },
    byProject,
    byPeriod,
    topVarianceItems: varianceItems,
  };
}

/**
 * Generate human-readable markdown summary for LLM context
 */
export function generateMarkdownSummary(data: CostDataRow[]): string {
  const summary = generateLLMSummary(data);

  if (!data.length) {
    return '# Cost Report Summary\n\nNo data available.';
  }

  const lines: string[] = [
    '# Cost Report Summary',
    '',
    `**Generated:** ${new Date().toLocaleString()}`,
    `**Period:** ${formatPeriodLabel(summary.metadata.dateRange.start)} to ${formatPeriodLabel(summary.metadata.dateRange.end)}`,
    `**Projects:** ${summary.metadata.projectCount} | **Records:** ${summary.metadata.recordCount}`,
    '',
    '## Financial Overview',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total Budget | ${formatCurrency(summary.summary.totalBudget)} |`,
    `| Spend to Date | ${formatCurrency(summary.summary.totalSpendJTD)} |`,
    `| Forecast Total | ${formatCurrency(summary.summary.totalForecast)} |`,
    `| Budget Variance | ${formatCurrency(summary.summary.budgetVariance)} |`,
    `| Status | ${summary.summary.status.replace('_', ' ').toUpperCase()} |`,
    '',
    '## By Project',
    '',
    '| Project | Budget | JTD Spend | Variance | % Complete |',
    '|---------|--------|-----------|----------|------------|',
  ];

  summary.byProject.forEach(project => {
    lines.push(
      `| ${project.projectNumber} | ${formatCurrency(project.budget)} | ${formatCurrency(project.jtdSpend)} | ${formatCurrency(project.variance)} | ${project.percentComplete.toFixed(1)}% |`
    );
  });

  lines.push('');
  lines.push('## Spending by Period');
  lines.push('');
  lines.push('| Period | Spend | Cumulative |');
  lines.push('|--------|-------|------------|');

  summary.byPeriod.forEach(period => {
    lines.push(
      `| ${period.periodLabel} | ${formatCurrency(period.spend)} | ${formatCurrency(period.cumulativeSpend)} |`
    );
  });

  if (summary.topVarianceItems.length > 0) {
    lines.push('');
    lines.push('## Top Variance Items');
    lines.push('');
    lines.push('| Project | CBS | Description | Variance | Type |');
    lines.push('|---------|-----|-------------|----------|------|');

    summary.topVarianceItems.forEach(item => {
      lines.push(
        `| ${item.project} | ${item.cbsHierarchy} | ${item.description.substring(0, 30)}${item.description.length > 30 ? '...' : ''} | ${formatCurrency(item.variance)} | ${item.type} |`
      );
    });
  }

  return lines.join('\n');
}

/**
 * Generate CSV export of cost data
 */
export function generateCSVExport(data: CostDataRow[]): string {
  if (!data.length) return '';

  const headers = [
    'Period',
    'Project',
    'District',
    'CBS_Hierarchy',
    'Description',
    'Budget_Amount',
    'Period_Spend',
    'JTD_Spend',
    'Forecast_Amount',
    'Forecast_Change',
    'SL_Variance',
  ];

  const rows = data.map(row => [
    row.FISCAL_YEAR_MONTH_NO,
    row.PROJECT_NUMBER,
    row.LEAD_DISTRICT || '',
    row.CBS_HIERARCHY || '',
    `"${(row.WBS_DESCRIPTION || '').replace(/"/g, '""')}"`,
    row.CB_AMT,
    row.PER_SPEND,
    row.JTD_SPEND,
    row.FORECAST_AMOUNT,
    row.FORECAST_CHANGE,
    row.SL_VARIANCE,
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

export type ExportFormat = 'json' | 'markdown' | 'csv';

/**
 * Generate export in the specified format
 */
export function generateExport(data: CostDataRow[], format: ExportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(generateLLMSummary(data), null, 2);
    case 'markdown':
      return generateMarkdownSummary(data);
    case 'csv':
      return generateCSVExport(data);
    default:
      return '';
  }
}
