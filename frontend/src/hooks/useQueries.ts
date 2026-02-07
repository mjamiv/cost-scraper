/**
 * React Query hooks for server-state management.
 *
 * Each hook wraps an existing fetch function from costDataApi.ts,
 * providing automatic caching, background refetching, and loading/error states.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchCostData,
  fetchWBSData,
  fetchFilterOptions,
  fetchProjects,
  isStaticDeployment,
} from '../api/costDataApi';
import type { QueryFilters } from '../api/types';

const API_BASE = '/api';

// ============================================================================
// EVM Metrics Types (mirror backend response shapes)
// ============================================================================

export interface EVMMetrics {
  BAC: number;
  ACWP: number;
  BCWP: number;
  BCWS: number;
  CPI: number;
  SPI: number;
  CV: number;
  SV: number;
  EAC: number;
  ETC: number;
  VAC: number;
  TCPI: number;
  percent_complete: number;
  percent_spent: number;
  latest_period: string | null;
  total_periods: number;
}

export interface HealthIndicator {
  value: number;
  status: 'green' | 'yellow' | 'red';
}

export interface EACVarianceIndicator extends HealthIndicator {
  percent: number;
}

export interface ProjectHealth {
  CPI: HealthIndicator;
  SPI: HealthIndicator;
  EAC_variance: EACVarianceIndicator;
  TCPI: HealthIndicator;
  overall: 'green' | 'yellow' | 'red';
}

export interface EVMMetricsResponse {
  success: boolean;
  evm: EVMMetrics;
  health: ProjectHealth;
  row_count: number;
  timing_ms: number;
}

export interface EVMTrendPoint {
  period: string;
  BAC: number;
  ACWP: number;
  BCWP: number;
  BCWS: number;
  CPI: number;
  SPI: number;
  CV: number;
  SV: number;
  percent_complete: number;
}

export interface EVMTrendsResponse {
  success: boolean;
  trends: EVMTrendPoint[];
  period_count: number;
  row_count: number;
  timing_ms: number;
}

// ============================================================================
// Mock EVM data for demo mode
// ============================================================================

function getMockEVMMetrics(): EVMMetricsResponse {
  const BAC = 12_500_000;
  const ACWP = 6_800_000;
  const BCWP = 7_200_000;
  const BCWS = 7_500_000;
  const CPI = BCWP / ACWP;
  const SPI = BCWP / BCWS;
  const EAC = BAC / CPI;
  const ETC = EAC - ACWP;
  const VAC = BAC - EAC;

  return {
    success: true,
    evm: { BAC, ACWP, BCWP, BCWS, CPI, SPI, CV: BCWP - ACWP, SV: BCWP - BCWS, EAC, ETC, VAC, TCPI: (BAC - BCWP) / (BAC - ACWP), percent_complete: (BCWP / BAC) * 100, percent_spent: (ACWP / BAC) * 100, latest_period: '202203', total_periods: 15 },
    health: {
      CPI: { value: CPI, status: CPI >= 1 ? 'green' : CPI >= 0.9 ? 'yellow' : 'red' },
      SPI: { value: SPI, status: SPI >= 1 ? 'green' : SPI >= 0.9 ? 'yellow' : 'red' },
      EAC_variance: { value: VAC, status: Math.abs(VAC / BAC) < 0.05 ? 'green' : Math.abs(VAC / BAC) < 0.1 ? 'yellow' : 'red', percent: (VAC / BAC) * 100 },
      TCPI: { value: (BAC - BCWP) / (BAC - ACWP), status: 'green' },
      overall: CPI >= 1 && SPI >= 0.96 ? 'green' : 'yellow',
    },
    row_count: 150,
    timing_ms: 42,
  };
}

function getMockEVMTrends(): EVMTrendsResponse {
  const months = ['202101','202102','202103','202104','202105','202106','202107','202108','202109','202110','202111','202112','202201','202202','202203'];
  const BAC = 12_500_000;
  const trends: EVMTrendPoint[] = months.map((period, i) => {
    const progress = (i + 1) / months.length;
    const BCWS = BAC * progress;
    const BCWP = BAC * progress * (0.92 + Math.random() * 0.12);
    const ACWP = BCWP * (0.88 + Math.random() * 0.18);
    return { period, BAC, ACWP, BCWP, BCWS, CPI: BCWP / ACWP, SPI: BCWP / BCWS, CV: BCWP - ACWP, SV: BCWP - BCWS, percent_complete: (BCWP / BAC) * 100 };
  });
  return { success: true, trends, period_count: trends.length, row_count: 150, timing_ms: 38 };
}

// ============================================================================
// Fetch functions for EVM endpoints
// ============================================================================

async function fetchEVMMetrics(
  projectNumbers: string,
  startMonth: string,
): Promise<EVMMetricsResponse> {
  if (isStaticDeployment) {
    await new Promise(r => setTimeout(r, 300));
    return getMockEVMMetrics();
  }
  const params = new URLSearchParams({
    project_numbers: projectNumbers,
    start_month: startMonth,
  });
  const response = await fetch(`${API_BASE}/metrics?${params}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API Error: ${response.status}`);
  }
  return response.json();
}

async function fetchEVMTrends(
  projectNumbers: string,
  startMonth: string,
): Promise<EVMTrendsResponse> {
  if (isStaticDeployment) {
    await new Promise(r => setTimeout(r, 400));
    return getMockEVMTrends();
  }
  const params = new URLSearchParams({
    project_numbers: projectNumbers,
    start_month: startMonth,
  });
  const response = await fetch(`${API_BASE}/metrics/trends?${params}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API Error: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// Hooks
// ============================================================================

/** Fetch EVM metrics + project health scorecard. */
export function useEVMMetrics(projectNumbers: string, startMonth: string) {
  return useQuery({
    queryKey: ['evm-metrics', projectNumbers, startMonth],
    queryFn: () => fetchEVMMetrics(projectNumbers, startMonth),
    enabled: !!projectNumbers,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/** Fetch period-by-period EVM trends for S-curve chart. */
export function useEVMTrends(projectNumbers: string, startMonth: string) {
  return useQuery({
    queryKey: ['evm-trends', projectNumbers, startMonth],
    queryFn: () => fetchEVMTrends(projectNumbers, startMonth),
    enabled: !!projectNumbers,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch cost data (CR Cube) for the given filters. Enabled only when explicitly triggered. */
export function useCostData(filters: QueryFilters, enabled: boolean) {
  return useQuery({
    queryKey: ['cost-data', filters.projectNumbers, filters.startMonth, filters.districtId],
    queryFn: () => fetchCostData(filters),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch WBS tag data for the given project numbers. */
export function useWBSData(projectNumbers: string, enabled: boolean) {
  return useQuery({
    queryKey: ['wbs-data', projectNumbers],
    queryFn: () => fetchWBSData(projectNumbers, 10000),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch filter options (districts + fiscal months). */
export function useFilterOptions() {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: fetchFilterOptions,
    staleTime: 15 * 60 * 1000, // 15 min
  });
}

/** Fetch projects list, optionally filtered by district. */
export function useProjects(districtId?: string) {
  return useQuery({
    queryKey: ['projects', districtId],
    queryFn: () => fetchProjects(districtId),
    staleTime: 15 * 60 * 1000,
  });
}
