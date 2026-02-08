export interface WidgetDefinition {
  id: string;
  title: string;
  category: 'evm' | 'cost' | 'workforce' | 'data';
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  selfFetches: boolean;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'health-scorecard',
    title: 'Health Scorecard',
    category: 'evm',
    defaultW: 12,
    defaultH: 2,
    minW: 6,
    minH: 2,
    selfFetches: true,
  },
  {
    id: 's-curve',
    title: 'S-Curve',
    category: 'evm',
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
    selfFetches: true,
  },
  {
    id: 'cost-charts',
    title: 'Cost Charts',
    category: 'cost',
    defaultW: 6,
    defaultH: 6,
    minW: 4,
    minH: 4,
    selfFetches: false,
  },
  {
    id: 'spend-trend',
    title: 'Spend Trend',
    category: 'cost',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'earned-value',
    title: 'Earned Value',
    category: 'evm',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'project-comparison',
    title: 'Project Comparison',
    category: 'cost',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'budget-pie',
    title: 'Budget Allocation',
    category: 'cost',
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'variance',
    title: 'Variance',
    category: 'cost',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'manhours-trend',
    title: 'Manhours Trend',
    category: 'workforce',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'fte-trend',
    title: 'FTE Trend',
    category: 'workforce',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'discipline-breakdown',
    title: 'Discipline Breakdown',
    category: 'workforce',
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    selfFetches: false,
  },
  {
    id: 'data-table',
    title: 'Data Table',
    category: 'data',
    defaultW: 12,
    defaultH: 6,
    minW: 6,
    minH: 4,
    selfFetches: false,
  },
];

export const WIDGET_MAP = new Map(
  WIDGET_REGISTRY.map((w) => [w.id, w])
);

export const CATEGORY_LABELS: Record<string, string> = {
  evm: 'Earned Value',
  cost: 'Cost Analysis',
  workforce: 'Workforce',
  data: 'Data Views',
};
