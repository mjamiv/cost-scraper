import { CostDataRow, HierarchicalCostDataRow } from '../api/types';

/**
 * Get the hierarchy level (depth) based on dot-separated CBS_HIERARCHY
 * e.g., "106049" = 0, "106049.01" = 1, "106049.01.001" = 2
 */
export function getHierarchyLevel(cbsHierarchy: string | null): number {
  if (!cbsHierarchy) return 0;
  return cbsHierarchy.split('.').length - 1;
}

/**
 * Get the parent path by stripping the last segment
 * e.g., "106049.01.001" -> "106049.01"
 */
export function getParentPath(cbsHierarchy: string | null): string | null {
  if (!cbsHierarchy) return null;
  const parts = cbsHierarchy.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

/**
 * Numeric fields that should be summed for aggregation
 */
const NUMERIC_FIELDS: (keyof CostDataRow)[] = [
  'CE_QTY', 'CB_QTY', 'CB_MHF', 'CB_AMT',
  'PER_QTY', 'PER_MH', 'PER_MHF', 'PER_MH_GL', 'PER_UOM_MH',
  'PER_PF', 'PER_CF', 'PER_LEI', 'PER_SPEND',
  'JTD_QTY', 'JTD_MH', 'JTD_MHF', 'JTD_MH_GL', 'JTD_UOM_MH',
  'JTD_PF', 'JTD_CF', 'JTD_LEI', 'JTD_SPEND',
  'FORECAST_REMAINING_QUANTITY', 'FORECAST_REMAINING_MHF', 'FORECAST_MHF',
  'FORECAST_REMAINING_MH', 'FORECAST_MH', 'FORECAST_REMAINING_PF', 'FORECAST_PF',
  'FORECAST_REMAINING_CF', 'FORECAST_CF', 'FORECAST_REMAINING_LEI', 'FORECAST_LEI',
  'FORECAST_REMAINING_AMOUNT', 'FORECAST_AMOUNT', 'FORECAST_CHANGE', 'SL_VARIANCE'
];

/**
 * Create an aggregated row from child rows
 */
function aggregateRows(rows: HierarchicalCostDataRow[]): Partial<CostDataRow> {
  const aggregated: Partial<CostDataRow> = {};

  for (const field of NUMERIC_FIELDS) {
    let sum = 0;
    let hasValue = false;

    for (const row of rows) {
      const value = row[field];
      if (typeof value === 'number' && !isNaN(value)) {
        sum += value;
        hasValue = true;
      }
    }

    (aggregated as Record<string, number | null>)[field] = hasValue ? sum : null;
  }

  return aggregated;
}

/**
 * Build hierarchical data structure from flat array
 */
export function buildHierarchicalData(flatData: CostDataRow[]): HierarchicalCostDataRow[] {
  if (!flatData.length) return [];

  // Group by fiscal period and CBS hierarchy for aggregation
  const groupedByPeriod = new Map<string, CostDataRow[]>();

  for (const row of flatData) {
    const period = String(row.FISCAL_YEAR_MONTH_NO || '');
    if (!groupedByPeriod.has(period)) {
      groupedByPeriod.set(period, []);
    }
    groupedByPeriod.get(period)!.push(row);
  }

  const result: HierarchicalCostDataRow[] = [];

  // Process each period separately
  for (const [period, periodRows] of groupedByPeriod) {
    const periodTree = buildPeriodTree(periodRows, period);
    result.push(...periodTree);
  }

  // Sort by period and then by CBS hierarchy
  result.sort((a, b) => {
    const periodA = String(a.FISCAL_YEAR_MONTH_NO || '');
    const periodB = String(b.FISCAL_YEAR_MONTH_NO || '');
    const periodCompare = periodA.localeCompare(periodB);
    if (periodCompare !== 0) return periodCompare;
    return (a.CBS_HIERARCHY || '').localeCompare(b.CBS_HIERARCHY || '');
  });

  return result;
}

function buildPeriodTree(periodRows: CostDataRow[], period: string): HierarchicalCostDataRow[] {
  // Create a map of all rows by CBS_HIERARCHY
  const rowMap = new Map<string, HierarchicalCostDataRow>();
  const rootRows: HierarchicalCostDataRow[] = [];

  // First pass: create hierarchical rows for each original row
  for (let i = 0; i < periodRows.length; i++) {
    const row = periodRows[i];
    const cbsHierarchy = row.CBS_HIERARCHY || `_no_hierarchy_${i}`;
    const depth = getHierarchyLevel(row.CBS_HIERARCHY);
    const parentPath = getParentPath(row.CBS_HIERARCHY);

    const hierarchicalRow: HierarchicalCostDataRow = {
      ...row,
      id: `${period}-${cbsHierarchy}-${i}`,
      depth,
      parentId: parentPath ? `${period}-${parentPath}` : null,
      subRows: [],
      isAggregated: false,
    };

    rowMap.set(cbsHierarchy, hierarchicalRow);
  }

  // Collect unique parent paths that don't have actual rows
  const allPaths = new Set<string>();
  const existingPaths = new Set(periodRows.map(r => r.CBS_HIERARCHY).filter(Boolean) as string[]);

  for (const path of existingPaths) {
    let current = getParentPath(path);
    while (current) {
      allPaths.add(current);
      current = getParentPath(current);
    }
  }

  // Create aggregated parent rows for missing hierarchy levels
  for (const parentPath of allPaths) {
    if (!existingPaths.has(parentPath)) {
      const depth = getHierarchyLevel(parentPath);
      const grandParentPath = getParentPath(parentPath);

      // Find first child to get project info
      const sampleRow = periodRows.find(r => r.CBS_HIERARCHY?.startsWith(parentPath + '.'));

      const aggregatedRow: HierarchicalCostDataRow = {
        FISCAL_YEAR_MONTH_NO: period,
        PROJECT_NUMBER: sampleRow?.PROJECT_NUMBER || '',
        LEAD_DISTRICT_ID: sampleRow?.LEAD_DISTRICT_ID || null,
        LEAD_DISTRICT: sampleRow?.LEAD_DISTRICT || null,
        CBS_HIERARCHY: parentPath,
        WBS_ELEMENT: '',
        WBS_DESCRIPTION: `[${parentPath}]`,
        ACCOUNT_CODE: null,
        UNIT_OF_MEASURE_ID: null,
        // All numeric fields start as null, will be aggregated later
        CE_QTY: null, CB_QTY: null, CB_MHF: null, CB_AMT: null, CB_UNIT_COST: null,
        PER_QTY: null, PER_PERC_COMP: null, PER_MH: null, PER_MHF: null, PER_MH_GL: null,
        PER_UOM_MH: null, PER_PF: null, PER_CF: null, PER_LEI: null, PER_SPEND: null, PER_UNIT_COST: null,
        ACTUAL_COST_G_PER_L: null,
        JTD_QTY: null, JTD_PERC_COMP: null, JTD_MH: null, JTD_MHF: null, JTD_MH_GL: null,
        JTD_UOM_MH: null, JTD_PF: null, JTD_CF: null, JTD_LEI: null, JTD_SPEND: null, JTD_UNIT_COST: null,
        JTD_COST_G_PER_L: null,
        FORECAST_REMAINING_QUANTITY: null, HD_FORECAST_METHOD: null, FORECAST_REMAINING_MHF: null,
        FORECAST_MHF: null, FORECAST_REMAINING_MH: null, FORECAST_MH: null, FORECAST_MH_G_PER_L: null,
        FORECAST_REMAINING_PF: null, FORECAST_PF: null, FORECAST_REMAINING_CF: null, FORECAST_CF: null,
        FORECAST_REMAINING_LEI: null, FORECAST_LEI: null, FORECAST_REMAINING_UNIT_COST: null,
        FORECAST_UNIT_COST: null, FORECAST_REMAINING_AMOUNT: null, FORECAST_AMOUNT: null,
        FORECAST_AMOUNT_G_PER_L: null, FORECAST_CHANGE: null, SL_VARIANCE: null,
        // Hierarchical fields
        id: `${period}-${parentPath}`,
        depth,
        parentId: grandParentPath ? `${period}-${grandParentPath}` : null,
        subRows: [],
        isAggregated: true,
      };

      rowMap.set(parentPath, aggregatedRow);
    }
  }

  // Second pass: build tree structure
  for (const [cbsHierarchy, row] of rowMap) {
    const parentPath = getParentPath(cbsHierarchy);

    if (parentPath && rowMap.has(parentPath)) {
      const parent = rowMap.get(parentPath)!;
      parent.subRows!.push(row);
    } else {
      rootRows.push(row);
    }
  }

  // Sort subRows at each level
  const sortSubRows = (rows: HierarchicalCostDataRow[]) => {
    rows.sort((a, b) => (a.CBS_HIERARCHY || '').localeCompare(b.CBS_HIERARCHY || ''));
    for (const row of rows) {
      if (row.subRows && row.subRows.length > 0) {
        sortSubRows(row.subRows);
      }
    }
  };

  sortSubRows(rootRows);

  // Aggregate values from children up to parents
  const aggregateUp = (rows: HierarchicalCostDataRow[]) => {
    for (const row of rows) {
      if (row.subRows && row.subRows.length > 0) {
        aggregateUp(row.subRows);

        if (row.isAggregated) {
          const aggregatedValues = aggregateRows(row.subRows);
          Object.assign(row, aggregatedValues);
        }
      }
    }
  };

  aggregateUp(rootRows);

  return rootRows;
}

/**
 * Get all descendant rows (for recursive expansion)
 */
export function getAllDescendants(row: HierarchicalCostDataRow): HierarchicalCostDataRow[] {
  const descendants: HierarchicalCostDataRow[] = [];

  if (row.subRows) {
    for (const child of row.subRows) {
      descendants.push(child);
      descendants.push(...getAllDescendants(child));
    }
  }

  return descendants;
}
