import { CostDataRow, CostDataResponse } from './types';

// Generate realistic mock data for demo purposes
function generateMockRows(): CostDataRow[] {
  const projects = ['106049', '104831', '105553', '104834', '106073', '106345', '105119', '104980'];
  const districts = [
    { id: 'SE5001', name: 'Southeast Region' },
    { id: 'NW3002', name: 'Northwest Division' },
    { id: 'CE4003', name: 'Central Operations' },
  ];
  const wbsDescriptions = [
    'Structural Steel Installation',
    'Electrical Systems',
    'HVAC Installation',
    'Foundation Work',
    'Piping Systems',
    'Instrumentation',
    'Civil Works',
    'Insulation',
    'Painting & Coating',
    'Equipment Installation',
  ];
  
  const rows: CostDataRow[] = [];
  const months = ['202101', '202102', '202103', '202104', '202105', '202106', '202107', '202108', '202109', '202110', '202111', '202112', '202201', '202202', '202203'];
  
  for (const month of months) {
    for (const project of projects) {
      const numWbs = Math.floor(Math.random() * 3) + 2;
      for (let w = 0; w < numWbs; w++) {
        const district = districts[Math.floor(Math.random() * districts.length)];
        const cbAmt = Math.random() * 500000 + 50000;
        const jtdSpend = cbAmt * (Math.random() * 0.8 + 0.1);
        const forecastAmt = cbAmt * (Math.random() * 0.3 + 0.9);
        const percComp = jtdSpend / forecastAmt;
        
        rows.push({
          FISCAL_YEAR_MONTH_NO: month,
          LEAD_DISTRICT_ID: district.id,
          LEAD_DISTRICT: district.name,
          PROJECT_NUMBER: project,
          CBS_HIERARCHY: `${project}.${String(w + 1).padStart(2, '0')}.001.${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`,
          WBS_ELEMENT: `WBS-${project}-${String(w + 1).padStart(3, '0')}`,
          WBS_DESCRIPTION: wbsDescriptions[Math.floor(Math.random() * wbsDescriptions.length)],
          ACCOUNT_CODE: `AC${Math.floor(Math.random() * 9000) + 1000}`,
          UNIT_OF_MEASURE_ID: ['EA', 'LF', 'SF', 'HR', 'TON'][Math.floor(Math.random() * 5)],
          
          CE_QTY: Math.random() * 1000 + 100,
          CB_QTY: Math.random() * 1000 + 100,
          CB_MHF: Math.random() * 50 + 10,
          CB_AMT: cbAmt,
          CB_UNIT_COST: cbAmt / (Math.random() * 500 + 100),
          
          PER_QTY: Math.random() * 100,
          PER_PERC_COMP: Math.random() * 0.1,
          PER_MH: Math.random() * 500 + 50,
          PER_MHF: Math.random() * 10 + 1,
          PER_MH_GL: (Math.random() - 0.5) * 100,
          PER_UOM_MH: Math.random() * 5 + 0.5,
          PER_PF: Math.random() * 2 + 0.5,
          PER_CF: Math.random() * 1.5 + 0.8,
          PER_LEI: Math.random() * 1.2 + 0.9,
          PER_SPEND: Math.random() * 50000 + 5000,
          PER_UNIT_COST: Math.random() * 500 + 50,
          ACTUAL_COST_G_PER_L: (Math.random() - 0.5) * 20000,
          
          JTD_QTY: Math.random() * 800 + 50,
          JTD_PERC_COMP: percComp,
          JTD_MH: Math.random() * 5000 + 500,
          JTD_MHF: Math.random() * 40 + 5,
          JTD_MH_GL: (Math.random() - 0.5) * 500,
          JTD_UOM_MH: Math.random() * 5 + 0.5,
          JTD_PF: Math.random() * 2 + 0.5,
          JTD_CF: Math.random() * 1.5 + 0.8,
          JTD_LEI: Math.random() * 1.2 + 0.9,
          JTD_SPEND: jtdSpend,
          JTD_UNIT_COST: jtdSpend / (Math.random() * 500 + 100),
          JTD_COST_G_PER_L: (Math.random() - 0.5) * 50000,
          
          FORECAST_REMAINING_QUANTITY: Math.random() * 300 + 20,
          HD_FORECAST_METHOD: ['Linear', 'Earned Value', 'Manual'][Math.floor(Math.random() * 3)],
          FORECAST_REMAINING_MHF: Math.random() * 20 + 2,
          FORECAST_MHF: Math.random() * 50 + 10,
          FORECAST_REMAINING_MH: Math.random() * 2000 + 200,
          FORECAST_MH: Math.random() * 6000 + 600,
          FORECAST_MH_G_PER_L: (Math.random() - 0.5) * 300,
          FORECAST_REMAINING_PF: Math.random() * 2 + 0.5,
          FORECAST_PF: Math.random() * 2 + 0.5,
          FORECAST_REMAINING_CF: Math.random() * 1.5 + 0.8,
          FORECAST_CF: Math.random() * 1.5 + 0.8,
          FORECAST_REMAINING_LEI: Math.random() * 1.2 + 0.9,
          FORECAST_LEI: Math.random() * 1.2 + 0.9,
          FORECAST_REMAINING_UNIT_COST: Math.random() * 500 + 50,
          FORECAST_UNIT_COST: Math.random() * 500 + 50,
          FORECAST_REMAINING_AMOUNT: forecastAmt - jtdSpend,
          FORECAST_AMOUNT: forecastAmt,
          FORECAST_AMOUNT_G_PER_L: (Math.random() - 0.5) * 30000,
          FORECAST_CHANGE: (Math.random() - 0.3) * 50000,
          SL_VARIANCE: (Math.random() - 0.5) * 100000,
        });
      }
    }
  }
  
  return rows.sort((a, b) => {
    if (a.FISCAL_YEAR_MONTH_NO !== b.FISCAL_YEAR_MONTH_NO) {
      return a.FISCAL_YEAR_MONTH_NO.localeCompare(b.FISCAL_YEAR_MONTH_NO);
    }
    return (a.CBS_HIERARCHY || '').localeCompare(b.CBS_HIERARCHY || '');
  });
}

// Cache the mock data
let cachedMockData: CostDataRow[] | null = null;

export function getMockData(): CostDataRow[] {
  if (!cachedMockData) {
    cachedMockData = generateMockRows();
  }
  return cachedMockData;
}

export function getMockCostDataResponse(
  projectNumbers: string[],
  startMonth: string,
  districtId?: string
): CostDataResponse {
  let data = getMockData();
  
  // Apply filters
  if (projectNumbers.length > 0) {
    data = data.filter(row => projectNumbers.includes(row.PROJECT_NUMBER));
  }
  
  if (startMonth) {
    data = data.filter(row => row.FISCAL_YEAR_MONTH_NO >= startMonth);
  }
  
  if (districtId) {
    data = data.filter(row => row.LEAD_DISTRICT_ID === districtId);
  }
  
  return {
    data,
    total_count: data.length,
    filters_applied: {
      project_numbers: projectNumbers,
      start_month: startMonth,
      district_id: districtId || null,
    },
  };
}

