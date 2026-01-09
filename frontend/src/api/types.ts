export interface CostDataRow {
  FISCAL_YEAR_MONTH_NO: string;
  LEAD_DISTRICT_ID: string | null;
  LEAD_DISTRICT: string | null;
  PROJECT_NUMBER: string;
  CBS_HIERARCHY: string | null;
  WBS_ELEMENT: string;
  WBS_DESCRIPTION: string | null;
  ACCOUNT_CODE: string | null;
  UNIT_OF_MEASURE_ID: string | null;
  
  // Current Budget
  CE_QTY: number | null;
  CB_QTY: number | null;
  CB_MHF: number | null;
  CB_AMT: number | null;
  CB_UNIT_COST: number | null;
  
  // Period Data
  PER_QTY: number | null;
  PER_PERC_COMP: number | null;
  PER_MH: number | null;
  PER_MHF: number | null;
  PER_MH_GL: number | null;
  PER_UOM_MH: number | null;
  PER_PF: number | null;
  PER_CF: number | null;
  PER_LEI: number | null;
  PER_SPEND: number | null;
  PER_UNIT_COST: number | null;
  ACTUAL_COST_G_PER_L: number | null;
  
  // JTD Data
  JTD_QTY: number | null;
  JTD_PERC_COMP: number | null;
  JTD_MH: number | null;
  JTD_MHF: number | null;
  JTD_MH_GL: number | null;
  JTD_UOM_MH: number | null;
  JTD_PF: number | null;
  JTD_CF: number | null;
  JTD_LEI: number | null;
  JTD_SPEND: number | null;
  JTD_UNIT_COST: number | null;
  JTD_COST_G_PER_L: number | null;
  
  // Forecast Data
  FORECAST_REMAINING_QUANTITY: number | null;
  HD_FORECAST_METHOD: string | null;
  FORECAST_REMAINING_MHF: number | null;
  FORECAST_MHF: number | null;
  FORECAST_REMAINING_MH: number | null;
  FORECAST_MH: number | null;
  FORECAST_MH_G_PER_L: number | null;
  FORECAST_REMAINING_PF: number | null;
  FORECAST_PF: number | null;
  FORECAST_REMAINING_CF: number | null;
  FORECAST_CF: number | null;
  FORECAST_REMAINING_LEI: number | null;
  FORECAST_LEI: number | null;
  FORECAST_REMAINING_UNIT_COST: number | null;
  FORECAST_UNIT_COST: number | null;
  FORECAST_REMAINING_AMOUNT: number | null;
  FORECAST_AMOUNT: number | null;
  FORECAST_AMOUNT_G_PER_L: number | null;
  FORECAST_CHANGE: number | null;
  SL_VARIANCE: number | null;
}

export interface CostDataResponse {
  data: CostDataRow[];
  total_count: number;
  filters_applied: {
    project_numbers: string[];
    start_month: string;
    district_id: string | null;
  };
}

export interface District {
  LEAD_DISTRICT: string;
  LEAD_DISTRICT_ID: string;
}

export interface Project {
  PROJECT_NUMBER: string;
  LEAD_DISTRICT_ID: string | null;
  LEAD_DISTRICT: string | null;
}

export interface FilterOptions {
  districts: District[];
  fiscal_months: string[];
}

export interface QueryFilters {
  projectNumbers: string;
  startMonth: string;
  districtId: string;
}

