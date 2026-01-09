import { CostDataResponse, FilterOptions, QueryFilters } from './types';
import { getMockCostDataResponse } from './mockData';

const API_BASE = '/api';

// Check if running on GitHub Pages (static deployment)
const isStaticDeployment = import.meta.env.PROD && window.location.hostname.includes('github.io');

export async function fetchCostData(filters: QueryFilters): Promise<CostDataResponse> {
  // Use mock data for GitHub Pages demo
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const projects = filters.projectNumbers.split(',').map(p => p.trim()).filter(Boolean);
    return getMockCostDataResponse(projects, filters.startMonth, filters.districtId || undefined);
  }

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
  if (isStaticDeployment) {
    return {
      districts: [
        { LEAD_DISTRICT: 'Southeast Region', LEAD_DISTRICT_ID: 'SE5001' },
        { LEAD_DISTRICT: 'Northwest Division', LEAD_DISTRICT_ID: 'NW3002' },
        { LEAD_DISTRICT: 'Central Operations', LEAD_DISTRICT_ID: 'CE4003' },
      ],
      fiscal_months: ['202203', '202202', '202201', '202112', '202111', '202110', '202109', '202108', '202107', '202106', '202105', '202104', '202103', '202102', '202101'],
    };
  }

  const response = await fetch(`${API_BASE}/filters`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchDistricts() {
  if (isStaticDeployment) {
    return [
      { LEAD_DISTRICT: 'Southeast Region', LEAD_DISTRICT_ID: 'SE5001' },
      { LEAD_DISTRICT: 'Northwest Division', LEAD_DISTRICT_ID: 'NW3002' },
      { LEAD_DISTRICT: 'Central Operations', LEAD_DISTRICT_ID: 'CE4003' },
    ];
  }

  const response = await fetch(`${API_BASE}/districts`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchProjects(districtId?: string) {
  if (isStaticDeployment) {
    const projects = ['106049', '104831', '105553', '104834', '106073', '106345', '105119', '104980'];
    return projects.map(p => ({
      PROJECT_NUMBER: p,
      LEAD_DISTRICT_ID: 'SE5001',
      LEAD_DISTRICT: 'Southeast Region',
    }));
  }

  const params = districtId ? `?district_id=${districtId}` : '';
  const response = await fetch(`${API_BASE}/projects${params}`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export { isStaticDeployment };

