"""
EVM metrics API endpoints.

GET /api/metrics          — Full EVM metrics + project health for given projects
GET /api/metrics/trends   — Period-by-period EVM for trend charts
"""

import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.cache import execute_query_cached
from app.evm import compute_evm_metrics, compute_evm_by_period, compute_project_health

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/metrics", tags=["EVM Metrics"])


def _build_cr_cube_query(
    project_numbers: list[str],
    start_month: str,
    end_month: Optional[str] = None,
    limit: int = 50000,
) -> tuple[str, tuple]:
    """Build CR Cube query (mirrors main.build_cr_cube_query)."""
    placeholders = ", ".join(["%s"] * len(project_numbers))
    end_clause = "AND CR.FISCAL_YEAR_MONTH_NO <= %s" if end_month else ""

    sql = f"""
    SELECT
        CR.FISCAL_YEAR_MONTH_NO,
        CR.PROJECT_NUMBER,
        WBS.CBS_HIERARCHY,
        CR.WBS_ELEMENT,
        CURRENT_BUDGET_AMOUNT AS CB_AMT,
        PERCENT_COMPLETE AS PER_PERC_COMP,
        JTD_PERCENT_COMPLETE AS JTD_PERC_COMP,
        ACTUAL_COST AS PER_SPEND,
        JTD_ACTUAL_COST AS JTD_SPEND,
        FORECAST_AMOUNT
    FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS CR
    LEFT JOIN PROD_ENT_CONSUMPTION.SEM_VW.WBS_SNAPSHOT WBS
        ON CR.WBS_ELEMENT = WBS.WBS_ELEMENT
        AND CR.FISCAL_YEAR_MONTH_NO = WBS.FISCAL_YEAR_MONTH_NO
    WHERE CR.PROJECT_NUMBER IN ({placeholders})
      AND CR.FISCAL_YEAR_MONTH_NO >= %s
      {end_clause}
    ORDER BY CR.FISCAL_YEAR_MONTH_NO, WBS.CBS_HIERARCHY ASC
    LIMIT {limit}
    """

    params = list(project_numbers) + [start_month]
    if end_month:
        params.append(end_month)
    return sql, tuple(params)


@router.get("")
async def api_metrics(
    project_numbers: str = Query(..., description="Comma-separated project numbers"),
    start_month: str = Query("202001", description="Start month YYYYMM"),
    end_month: Optional[str] = Query(None, description="End month YYYYMM"),
):
    """Return full EVM metrics and project health scorecard."""
    projects = [p.strip() for p in project_numbers.split(",") if p.strip()]
    if not projects:
        raise HTTPException(status_code=400, detail="project_numbers is required")

    try:
        start_time = time.time()
        sql, params = _build_cr_cube_query(projects, start_month, end_month)
        result = execute_query_cached(sql, params)
        timing_ms = (time.time() - start_time) * 1000

        evm = compute_evm_metrics(result["rows"], start_month)
        health = compute_project_health(evm)

        return {
            "success": True,
            "evm": evm,
            "health": health,
            "row_count": result["row_count"],
            "timing_ms": round(timing_ms, 1),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"EVM metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends")
async def api_metrics_trends(
    project_numbers: str = Query(..., description="Comma-separated project numbers"),
    start_month: str = Query("202001", description="Start month YYYYMM"),
    end_month: Optional[str] = Query(None, description="End month YYYYMM"),
):
    """Return period-by-period EVM for trend charts."""
    projects = [p.strip() for p in project_numbers.split(",") if p.strip()]
    if not projects:
        raise HTTPException(status_code=400, detail="project_numbers is required")

    try:
        start_time = time.time()
        sql, params = _build_cr_cube_query(projects, start_month, end_month)
        result = execute_query_cached(sql, params)
        timing_ms = (time.time() - start_time) * 1000

        trends = compute_evm_by_period(result["rows"])

        return {
            "success": True,
            "trends": trends,
            "period_count": len(trends),
            "row_count": result["row_count"],
            "timing_ms": round(timing_ms, 1),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"EVM trends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
