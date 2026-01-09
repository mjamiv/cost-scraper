from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from decimal import Decimal
import json

from config import get_settings
from database import db
from queries import COST_DATA_QUERY, DISTRICTS_QUERY, PROJECTS_QUERY
from models import CostDataResponse, District, Project, FilterOptions


# Custom JSON encoder for Decimal types
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="API for retrieving cost and project data from Snowflake"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def convert_decimals(data: list[dict]) -> list[dict]:
    """Convert Decimal values to float for JSON serialization."""
    for row in data:
        for key, value in row.items():
            if isinstance(value, Decimal):
                row[key] = float(value)
    return data


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Cost Scraper API"}


@app.get("/api/cost-data", response_model=CostDataResponse)
async def get_cost_data(
    project_numbers: str = Query(
        default="106049,104831,105553,104834,106073,106345,105119,104980",
        description="Comma-separated list of project numbers"
    ),
    start_month: str = Query(
        default="202101",
        description="Start fiscal year month (YYYYMM format)"
    ),
    district_id: Optional[str] = Query(
        default=None,
        description="Filter by lead district ID"
    )
):
    """
    Retrieve cost data for specified projects.
    
    Returns detailed cost metrics including:
    - Current budget/estimates
    - Period actuals
    - Job-to-date totals
    - Forecasts and variances
    """
    try:
        # Parse project numbers
        projects = [p.strip() for p in project_numbers.split(",") if p.strip()]
        
        if not projects:
            raise HTTPException(status_code=400, detail="At least one project number is required")
        
        # Build query with dynamic project numbers
        placeholders = ", ".join([f"'{p}'" for p in projects])
        query = COST_DATA_QUERY.format(project_numbers=placeholders)
        
        # Execute query
        results = db.execute_query(query, {"start_month": start_month})
        results = convert_decimals(results)
        
        # Apply district filter if provided
        if district_id:
            results = [r for r in results if r.get("LEAD_DISTRICT_ID") == district_id]
        
        return CostDataResponse(
            data=results,
            total_count=len(results),
            filters_applied={
                "project_numbers": projects,
                "start_month": start_month,
                "district_id": district_id
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/districts", response_model=list[District])
async def get_districts():
    """Get list of all available districts."""
    try:
        results = db.execute_query(DISTRICTS_QUERY)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/projects", response_model=list[Project])
async def get_projects(
    district_id: Optional[str] = Query(default=None, description="Filter by district ID")
):
    """Get list of projects, optionally filtered by district."""
    try:
        if district_id:
            results = db.execute_query(PROJECTS_QUERY, {"district_id": district_id})
        else:
            # Get all projects if no district filter
            query = """
                SELECT DISTINCT PROJECT_NUMBER, LEAD_DISTRICT_ID, LEAD_DISTRICT
                FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
                ORDER BY PROJECT_NUMBER
            """
            results = db.execute_query(query)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/filters")
async def get_filter_options():
    """Get available filter options for the UI."""
    try:
        districts = db.execute_query(DISTRICTS_QUERY)
        
        # Get distinct fiscal months
        months_query = """
            SELECT DISTINCT FISCAL_YEAR_MONTH_NO
            FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS
            ORDER BY FISCAL_YEAR_MONTH_NO DESC
            LIMIT 48
        """
        months = db.execute_query(months_query)
        
        return {
            "districts": districts,
            "fiscal_months": [m["FISCAL_YEAR_MONTH_NO"] for m in months]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

