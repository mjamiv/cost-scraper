from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class CostDataRow(BaseModel):
    """Model for a single row of cost data."""
    
    FISCAL_YEAR_MONTH_NO: str
    LEAD_DISTRICT_ID: Optional[str] = None
    LEAD_DISTRICT: Optional[str] = None
    PROJECT_NUMBER: str
    CBS_HIERARCHY: Optional[str] = None
    WBS_ELEMENT: str
    WBS_DESCRIPTION: Optional[str] = None
    ACCOUNT_CODE: Optional[str] = None
    UNIT_OF_MEASURE_ID: Optional[str] = None
    
    # Current Estimates/Budget
    CE_QTY: Optional[float] = None
    CB_QTY: Optional[float] = None
    CB_MHF: Optional[float] = None
    CB_AMT: Optional[float] = None
    CB_UNIT_COST: Optional[float] = None
    
    # Period Data
    PER_QTY: Optional[float] = None
    PER_PERC_COMP: Optional[float] = None
    PER_MH: Optional[float] = None
    PER_MHF: Optional[float] = None
    PER_MH_GL: Optional[float] = None
    PER_UOM_MH: Optional[float] = None
    PER_PF: Optional[float] = None
    PER_CF: Optional[float] = None
    PER_LEI: Optional[float] = None
    PER_SPEND: Optional[float] = None
    PER_UNIT_COST: Optional[float] = None
    ACTUAL_COST_G_PER_L: Optional[float] = None
    
    # JTD Data
    JTD_QTY: Optional[float] = None
    JTD_PERC_COMP: Optional[float] = None
    JTD_MH: Optional[float] = None
    JTD_MHF: Optional[float] = None
    JTD_MH_GL: Optional[float] = None
    JTD_UOM_MH: Optional[float] = None
    JTD_PF: Optional[float] = None
    JTD_CF: Optional[float] = None
    JTD_LEI: Optional[float] = None
    JTD_SPEND: Optional[float] = None
    JTD_UNIT_COST: Optional[float] = None
    JTD_COST_G_PER_L: Optional[float] = None
    
    # Forecast Data
    FORECAST_REMAINING_QUANTITY: Optional[float] = None
    HD_FORECAST_METHOD: Optional[str] = None
    FORECAST_REMAINING_MHF: Optional[float] = None
    FORECAST_MHF: Optional[float] = None
    FORECAST_REMAINING_MH: Optional[float] = None
    FORECAST_MH: Optional[float] = None
    FORECAST_MH_G_PER_L: Optional[float] = None
    FORECAST_REMAINING_PF: Optional[float] = None
    FORECAST_PF: Optional[float] = None
    FORECAST_REMAINING_CF: Optional[float] = None
    FORECAST_CF: Optional[float] = None
    FORECAST_REMAINING_LEI: Optional[float] = None
    FORECAST_LEI: Optional[float] = None
    FORECAST_REMAINING_UNIT_COST: Optional[float] = None
    FORECAST_UNIT_COST: Optional[float] = None
    FORECAST_REMAINING_AMOUNT: Optional[float] = None
    FORECAST_AMOUNT: Optional[float] = None
    FORECAST_AMOUNT_G_PER_L: Optional[float] = None
    FORECAST_CHANGE: Optional[float] = None
    SL_VARIANCE: Optional[float] = None
    
    class Config:
        from_attributes = True


class CostDataResponse(BaseModel):
    """Response model for cost data endpoint."""
    
    data: list[CostDataRow]
    total_count: int
    filters_applied: dict


class District(BaseModel):
    """Model for district data."""
    
    LEAD_DISTRICT: str
    LEAD_DISTRICT_ID: str


class Project(BaseModel):
    """Model for project data."""
    
    PROJECT_NUMBER: str
    LEAD_DISTRICT_ID: Optional[str] = None
    LEAD_DISTRICT: Optional[str] = None


class FilterOptions(BaseModel):
    """Model for available filter options."""
    
    districts: list[District]
    fiscal_months: list[str]

