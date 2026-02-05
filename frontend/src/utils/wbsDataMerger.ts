import { CostDataRow, WBSDataRow, WBSTagFilters } from '../api/types';

/**
 * Extended cost data row with WBS tags merged in
 */
export interface CostDataRowWithTags extends CostDataRow {
  // WBS Tag columns (merged from WBS view)
  AREA: string | null;
  PHASE: string | null;
  D_GROUP: string | null;
  ACCOUNT_CODE_DESCRIPTION: string | null;
  USER_DEFINED_7: string | null;
  DISTRICT_SPECIFIC_TAG_16: string | null;
  DISTRICT_SPECIFIC_TAG_19: string | null;
  USER_DEFINED_12: string | null;
  MULTIPLIER: number | null;  // USER_DEFINED_13 - for revenue calculations
  TAG23: string | null;
  TAG25: string | null;
}

/**
 * Merge cost data with WBS tag data by WBS_ELEMENT
 */
export function mergeCostDataWithTags(
  costData: CostDataRow[],
  wbsData: WBSDataRow[]
): CostDataRowWithTags[] {
  // Create a lookup map for WBS tags by WBS_ELEMENT
  const wbsTagMap = new Map<string, WBSDataRow>();
  for (const wbs of wbsData) {
    if (wbs.WBS_ELEMENT) {
      wbsTagMap.set(wbs.WBS_ELEMENT, wbs);
    }
  }

  // Track merge statistics for debugging
  let matchCount = 0;
  let missCount = 0;
  let multiplierCount = 0;

  // Merge cost data with WBS tags
  const result = costData.map(cost => {
    const wbsTags = wbsTagMap.get(cost.WBS_ELEMENT);

    if (wbsTags) {
      matchCount++;
    } else {
      missCount++;
    }

    // Parse USER_DEFINED_13 as a number for the multiplier
    const multiplierRaw = wbsTags?.USER_DEFINED_13;
    const multiplier = multiplierRaw ? parseFloat(multiplierRaw) : null;

    if (multiplier && !isNaN(multiplier)) {
      multiplierCount++;
    }

    return {
      ...cost,
      AREA: wbsTags?.AREA ?? null,
      PHASE: wbsTags?.PHASE ?? null,
      D_GROUP: wbsTags?.['D-GROUP'] ?? null,
      ACCOUNT_CODE_DESCRIPTION: wbsTags?.ACCOUNT_CODE_DESCRIPTION ?? null,
      USER_DEFINED_7: wbsTags?.USER_DEFINED_7 ?? null,
      DISTRICT_SPECIFIC_TAG_16: wbsTags?.DISTRICT_SPECIFIC_TAG_16 ?? null,
      DISTRICT_SPECIFIC_TAG_19: wbsTags?.DISTRICT_SPECIFIC_TAG_19 ?? null,
      USER_DEFINED_12: wbsTags?.USER_DEFINED_12 ?? null,
      MULTIPLIER: multiplier && !isNaN(multiplier) ? multiplier : null,
      TAG23: wbsTags?.TAG23 ?? null,
      TAG25: wbsTags?.TAG25 ?? null,
    };
  });

  // Log merge statistics for debugging
  console.log(`[WBS Merge] Cost rows: ${costData.length}, WBS rows: ${wbsData.length}`);
  console.log(`[WBS Merge] Matches: ${matchCount}, Misses: ${missCount}, With MULTIPLIER: ${multiplierCount}`);

  if (missCount > 0 && costData.length > 0) {
    // Sample some unmatched WBS_ELEMENT values for debugging
    const unmatchedSample = costData
      .filter(c => !wbsTagMap.has(c.WBS_ELEMENT))
      .slice(0, 3)
      .map(c => c.WBS_ELEMENT);
    console.log(`[WBS Merge] Sample unmatched WBS_ELEMENT: ${unmatchedSample.join(', ')}`);
  }

  return result;
}

/**
 * Filter merged data by WBS tag filters (client-side)
 * Supports multi-select: if filter is an array, row must match ANY value in the array
 */
export function filterByWBSTags(
  data: CostDataRowWithTags[],
  filters: WBSTagFilters
): CostDataRowWithTags[] {
  return data.filter(row => {
    // Helper to check if row value matches filter (handles arrays)
    const matchesFilter = (filterValues: string[] | undefined, rowValue: string | null): boolean => {
      if (!filterValues || filterValues.length === 0) return true;
      if (rowValue === null) return false;
      return filterValues.includes(rowValue);
    };

    if (!matchesFilter(filters.area, row.AREA)) return false;
    if (!matchesFilter(filters.phase, row.PHASE)) return false;
    if (!matchesFilter(filters.dGroup, row.D_GROUP)) return false;
    if (!matchesFilter(filters.wbsElement, row.WBS_ELEMENT)) return false;
    if (!matchesFilter(filters.accountCode, row.ACCOUNT_CODE)) return false;
    if (!matchesFilter(filters.userDefined7, row.USER_DEFINED_7)) return false;
    if (!matchesFilter(filters.districtSpecificTag16, row.DISTRICT_SPECIFIC_TAG_16)) return false;
    if (!matchesFilter(filters.districtSpecificTag19, row.DISTRICT_SPECIFIC_TAG_19)) return false;
    if (!matchesFilter(filters.userDefined12, row.USER_DEFINED_12)) return false;
    if (!matchesFilter(filters.tag23, row.TAG23)) return false;
    if (!matchesFilter(filters.tag25, row.TAG25)) return false;
    return true;
  });
}

/**
 * Get unique values for a tag field (for dropdown options)
 */
export function getUniqueTagValues(
  data: CostDataRowWithTags[],
  field: keyof CostDataRowWithTags
): string[] {
  const values = new Set<string>();
  for (const row of data) {
    const value = row[field];
    if (value != null && typeof value === 'string' && value.trim()) {
      values.add(value);
    }
  }
  return Array.from(values).sort();
}

/**
 * Aggregate data by a tag field
 * Returns totals grouped by the tag value
 */
export interface TagAggregation {
  tagValue: string;
  totalSpend: number;
  totalBudget: number;
  rowCount: number;
  periods: Set<string>;
}

export function aggregateByTag(
  data: CostDataRowWithTags[],
  tagField: keyof CostDataRowWithTags
): TagAggregation[] {
  const aggregations = new Map<string, TagAggregation>();

  for (const row of data) {
    const tagValue = row[tagField];
    const key = tagValue != null && typeof tagValue === 'string' ? tagValue : '(No Value)';

    if (!aggregations.has(key)) {
      aggregations.set(key, {
        tagValue: key,
        totalSpend: 0,
        totalBudget: 0,
        rowCount: 0,
        periods: new Set(),
      });
    }

    const agg = aggregations.get(key)!;
    agg.totalSpend += parseFloat(String(row.PER_SPEND || 0));
    agg.totalBudget += parseFloat(String(row.CB_AMT || 0));
    agg.rowCount += 1;
    if (row.FISCAL_YEAR_MONTH_NO) {
      agg.periods.add(row.FISCAL_YEAR_MONTH_NO);
    }
  }

  return Array.from(aggregations.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}

/**
 * Filter data by fiscal year (e.g., "2025" filters to periods starting with "2025")
 */
export function filterByFiscalYear(
  data: CostDataRowWithTags[],
  year: string
): CostDataRowWithTags[] {
  return data.filter(row => row.FISCAL_YEAR_MONTH_NO?.startsWith(year));
}
