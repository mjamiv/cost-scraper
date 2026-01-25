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
    totalManhours: number;
    totalManhoursBudget: number;
    percentComplete: number;
    earnedValue: number;
    cpi: number;
    status: 'under_budget' | 'on_budget' | 'over_budget';
  };
  byProject: Array<{
    projectNumber: string;
    budget: number;
    jtdSpend: number;
    variance: number;
    percentComplete: number;
    jtdManhours: number;
  }>;
  byPeriod: Array<{
    period: string;
    periodLabel: string;
    spend: number;
    cumulativeSpend: number;
    manhours: number;
    cumulativeManhours: number;
    weeksInMonth: number;
    monthlyFTE: number;
    weeklyFTE: number;
    avgRate: number;
    percentComplete: number;
    earnedValue: number;
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

/**
 * Get weeks in month based on 4-4-5 financial calendar
 * Pattern: Month 1 of quarter = 4 weeks, Month 2 = 4 weeks, Month 3 = 5 weeks
 * Q1: Jan(4), Feb(4), Mar(5)
 * Q2: Apr(4), May(4), Jun(5)
 * Q3: Jul(4), Aug(4), Sep(5)
 * Q4: Oct(4), Nov(4), Dec(5)
 */
function getWeeksInMonth(period: string): number {
  if (!period || period.length !== 6) return 4;
  const month = parseInt(period.substring(4, 6), 10);
  // Months 3, 6, 9, 12 have 5 weeks (end of quarter)
  return (month % 3 === 0) ? 5 : 4;
}

/**
 * Calculate FTE metrics for a period
 */
function calculateFTEMetrics(manhours: number, spend: number, period: string): {
  weeksInMonth: number;
  monthlyFTE: number;
  weeklyFTE: number;
  avgRate: number;
} {
  const weeksInMonth = getWeeksInMonth(period);
  const hoursInMonth = 40 * weeksInMonth;

  const monthlyFTE = manhours > 0 ? manhours / hoursInMonth : 0;
  const weeklyFTE = manhours > 0 ? manhours / weeksInMonth / 40 : 0;
  const avgRate = manhours > 0 ? spend / manhours : 0;

  return { weeksInMonth, monthlyFTE, weeklyFTE, avgRate };
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

  // Calculate totals - get the latest period's data for % complete
  let totalBudget = 0;
  let totalSpendJTD = 0;
  let totalForecast = 0;
  let totalManhours = 0;
  let totalManhoursBudget = 0;

  // Get latest period for % complete (it's cumulative)
  const latestPeriod = Array.from(new Set(topLevelRows.map(r => String(r.FISCAL_YEAR_MONTH_NO)))).sort().pop() || '';
  const latestRows = topLevelRows.filter(r => String(r.FISCAL_YEAR_MONTH_NO) === latestPeriod);

  topLevelRows.forEach(row => {
    totalBudget += parseFloat(String(row.CB_AMT)) || 0;
    totalSpendJTD += parseFloat(String(row.JTD_SPEND)) || 0;
    totalForecast += parseFloat(String(row.FORECAST_AMOUNT)) || 0;
    totalManhours += parseFloat(String(row.JTD_MH)) || 0;
    totalManhoursBudget += parseFloat(String(row.CB_MHF)) || 0;
  });

  // Calculate weighted % complete from latest period
  let weightedPctComplete = 0;
  let totalBudgetForPct = 0;
  latestRows.forEach(row => {
    const budget = parseFloat(String(row.CB_AMT)) || 0;
    const pctComplete = parseFloat(String(row.JTD_PERC_COMP)) || 0;
    weightedPctComplete += budget * pctComplete;
    totalBudgetForPct += budget;
  });
  const percentComplete = totalBudgetForPct > 0 ? weightedPctComplete / totalBudgetForPct : 0;

  // Earned Value = % Complete × Budget
  const earnedValue = (percentComplete / 100) * totalBudget;

  // CPI = Earned Value / Actual Cost (>1 is good, <1 is over budget)
  const cpi = totalSpendJTD > 0 ? earnedValue / totalSpendJTD : 0;

  const budgetVariance = totalBudget - totalForecast;
  const status: 'under_budget' | 'on_budget' | 'over_budget' =
    budgetVariance > 0 ? 'under_budget' : budgetVariance < 0 ? 'over_budget' : 'on_budget';

  // Group by project
  const projectMap = new Map<string, { budget: number; jtdSpend: number; forecast: number; jtdManhours: number }>();

  topLevelRows.forEach(row => {
    const project = String(row.PROJECT_NUMBER || '');
    const existing = projectMap.get(project) || { budget: 0, jtdSpend: 0, forecast: 0, jtdManhours: 0 };
    existing.budget += parseFloat(String(row.CB_AMT)) || 0;
    existing.jtdSpend += parseFloat(String(row.JTD_SPEND)) || 0;
    existing.forecast += parseFloat(String(row.FORECAST_AMOUNT)) || 0;
    existing.jtdManhours += parseFloat(String(row.JTD_MH)) || 0;
    projectMap.set(project, existing);
  });

  const byProject = Array.from(projectMap.entries()).map(([projectNumber, values]) => ({
    projectNumber,
    budget: values.budget,
    jtdSpend: values.jtdSpend,
    variance: values.budget - values.forecast,
    percentComplete: values.budget > 0 ? (values.jtdSpend / values.budget) * 100 : 0,
    jtdManhours: values.jtdManhours,
  }));

  // Group by period - include % complete and budget for EV calculation
  const periodMap = new Map<string, { spend: number; manhours: number; budget: number; pctComplete: number; budgetWeight: number }>();

  topLevelRows.forEach(row => {
    const period = String(row.FISCAL_YEAR_MONTH_NO || '');
    const perSpend = parseFloat(String(row.PER_SPEND)) || 0;
    const perMH = parseFloat(String(row.PER_MH)) || 0;
    const budget = parseFloat(String(row.CB_AMT)) || 0;
    const pctComplete = parseFloat(String(row.JTD_PERC_COMP)) || 0;
    const existing = periodMap.get(period) || { spend: 0, manhours: 0, budget: 0, pctComplete: 0, budgetWeight: 0 };
    existing.spend += perSpend;
    existing.manhours += perMH;
    existing.budget += budget;
    // Weighted average for % complete
    existing.pctComplete += budget * pctComplete;
    existing.budgetWeight += budget;
    periodMap.set(period, existing);
  });

  let cumulativeSpend = 0;
  let cumulativeMH = 0;
  const byPeriod = sortedPeriods.map(period => {
    const data = periodMap.get(period) || { spend: 0, manhours: 0, budget: 0, pctComplete: 0, budgetWeight: 0 };
    cumulativeSpend += data.spend;
    cumulativeMH += data.manhours;
    const fteMetrics = calculateFTEMetrics(data.manhours, data.spend, period);
    // Calculate weighted % complete for this period
    const periodPctComplete = data.budgetWeight > 0 ? data.pctComplete / data.budgetWeight : 0;
    // Earned Value = % Complete × Budget
    const periodEarnedValue = (periodPctComplete / 100) * data.budget;
    return {
      period,
      periodLabel: formatPeriodLabel(period),
      spend: data.spend,
      cumulativeSpend,
      manhours: data.manhours,
      cumulativeManhours: cumulativeMH,
      weeksInMonth: fteMetrics.weeksInMonth,
      monthlyFTE: fteMetrics.monthlyFTE,
      weeklyFTE: fteMetrics.weeklyFTE,
      avgRate: fteMetrics.avgRate,
      percentComplete: periodPctComplete,
      earnedValue: periodEarnedValue,
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
      totalManhours,
      totalManhoursBudget,
      percentComplete,
      earnedValue,
      cpi,
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

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  };

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
    `| JTD Manhours | ${formatNumber(summary.summary.totalManhours)} |`,
    `| Budget Manhours | ${formatNumber(summary.summary.totalManhoursBudget)} |`,
    `| % Complete | ${summary.summary.percentComplete.toFixed(1)}% |`,
    `| Earned Value | ${formatCurrency(summary.summary.earnedValue)} |`,
    `| CPI | ${summary.summary.cpi.toFixed(2)} ${summary.summary.cpi >= 1 ? '(on/under budget)' : '(over budget)'} |`,
    `| Status | ${summary.summary.status.replace('_', ' ').toUpperCase()} |`,
    '',
    '## Earned Value Summary',
    '',
    `- **% Complete:** ${summary.summary.percentComplete.toFixed(1)}%`,
    `- **Earned Value (EV):** ${formatCurrency(summary.summary.earnedValue)} (= % Complete × Budget)`,
    `- **Actual Cost (AC):** ${formatCurrency(summary.summary.totalSpendJTD)}`,
    `- **CPI:** ${summary.summary.cpi.toFixed(2)} ${summary.summary.cpi >= 1 ? '✓ On/Under Budget' : '⚠ Over Budget'}`,
    `- **Cost Variance:** ${formatCurrency(summary.summary.earnedValue - summary.summary.totalSpendJTD)} (EV - AC)`,
    '',
    '## By Project',
    '',
    '| Project | Budget | JTD Spend | Variance | % Complete | JTD MH |',
    '|---------|--------|-----------|----------|------------|--------|',
  ];

  summary.byProject.forEach(project => {
    lines.push(
      `| ${project.projectNumber} | ${formatCurrency(project.budget)} | ${formatCurrency(project.jtdSpend)} | ${formatCurrency(project.variance)} | ${project.percentComplete.toFixed(1)}% | ${formatNumber(project.jtdManhours)} |`
    );
  });

  lines.push('');
  lines.push('## Spending & FTE by Period');
  lines.push('');
  lines.push('*FTE calculated using 4-4-5 financial calendar (40 hrs/week)*');
  lines.push('');
  lines.push('| Period | Spend | Cumulative | % Complete | Earned Value | Manhours | Monthly FTE | Avg Rate |');
  lines.push('|--------|-------|------------|------------|--------------|----------|-------------|----------|');

  summary.byPeriod.forEach(period => {
    lines.push(
      `| ${period.periodLabel} | ${formatCurrency(period.spend)} | ${formatCurrency(period.cumulativeSpend)} | ${period.percentComplete.toFixed(1)}% | ${formatCurrency(period.earnedValue)} | ${formatNumber(period.manhours)} | ${period.monthlyFTE.toFixed(1)} | $${period.avgRate.toFixed(2)} |`
    );
  });

  // Add period totals/averages
  if (summary.byPeriod.length > 0) {
    const totalSpend = summary.byPeriod.reduce((sum, p) => sum + p.spend, 0);
    const totalMH = summary.byPeriod.reduce((sum, p) => sum + p.manhours, 0);
    const avgMonthlyFTE = summary.byPeriod.reduce((sum, p) => sum + p.monthlyFTE, 0) / summary.byPeriod.length;
    const overallAvgRate = totalMH > 0 ? totalSpend / totalMH : 0;
    // Latest period's % complete and EV (they're cumulative)
    const latestPeriod = summary.byPeriod[summary.byPeriod.length - 1];
    const latestPctComplete = latestPeriod?.percentComplete || 0;
    const totalEV = latestPeriod?.earnedValue || 0;

    lines.push(`| **TOTAL/AVG** | ${formatCurrency(totalSpend)} | ${formatCurrency(latestPeriod?.cumulativeSpend || 0)} | ${latestPctComplete.toFixed(1)}% | ${formatCurrency(totalEV)} | ${formatNumber(totalMH)} | ${avgMonthlyFTE.toFixed(1)} | $${overallAvgRate.toFixed(2)} |`);
  }

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
