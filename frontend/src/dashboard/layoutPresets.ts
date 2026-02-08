interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardPreset {
  id: string;
  name: string;
  description: string;
  layouts: LayoutItem[];
  widgets: string[];
}

export const PRESETS: DashboardPreset[] = [
  {
    id: 'pm-daily',
    name: 'PM Daily View',
    description: 'Health scorecard, S-curve, spend trend, and variance analysis',
    layouts: [
      { i: 'health-scorecard', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
      { i: 's-curve', x: 0, y: 2, w: 6, h: 5, minW: 4, minH: 4 },
      { i: 'spend-trend', x: 6, y: 2, w: 6, h: 5, minW: 4, minH: 3 },
      { i: 'variance', x: 0, y: 7, w: 12, h: 4, minW: 4, minH: 3 },
    ],
    widgets: ['health-scorecard', 's-curve', 'spend-trend', 'variance'],
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview with budget allocation and project comparison',
    layouts: [
      { i: 'health-scorecard', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
      { i: 'budget-pie', x: 0, y: 2, w: 4, h: 4, minW: 3, minH: 3 },
      { i: 'project-comparison', x: 4, y: 2, w: 8, h: 4, minW: 4, minH: 3 },
      { i: 'earned-value', x: 0, y: 6, w: 12, h: 4, minW: 4, minH: 3 },
    ],
    widgets: ['health-scorecard', 'budget-pie', 'project-comparison', 'earned-value'],
  },
  {
    id: 'engineering-manager',
    name: 'Engineering Manager',
    description: 'FTE trends, manhours, discipline breakdown, and data table',
    layouts: [
      { i: 'health-scorecard', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
      { i: 'fte-trend', x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'manhours-trend', x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'discipline-breakdown', x: 0, y: 6, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'data-table', x: 6, y: 6, w: 6, h: 4, minW: 6, minH: 4 },
    ],
    widgets: ['health-scorecard', 'fte-trend', 'manhours-trend', 'discipline-breakdown', 'data-table'],
  },
];

export const DEFAULT_PRESET_ID = 'pm-daily';

export function getPresetById(id: string): DashboardPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
