import { CostDataResponse, FilterOptions, QueryFilters } from './types';

const API_BASE = '/api';

export async function fetchCostData(filters: QueryFilters): Promise<CostDataResponse> {
  const params = new URLSearchParams();
  
  if (filters.projectNumbers) {
    params.append('project_numbers', filters.projectNumbers);
  }
  if (filters.startMonth) {
    params.append('start_month', filters.startMonth);
  }
  if (filters.districtId) {
    params.append('district_id', filters.districtId);
  }
  
  const response = await fetch(`${API_BASE}/cost-data?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const response = await fetch(`${API_BASE}/filters`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchDistricts() {
  const response = await fetch(`${API_BASE}/districts`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchProjects(districtId?: string) {
  const params = districtId ? `?district_id=${districtId}` : '';
  const response = await fetch(`${API_BASE}/projects${params}`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

