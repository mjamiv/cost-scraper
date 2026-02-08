"""
Earned Value Management (EVM) computation module.

Pure computation functions that take pre-fetched rows and return EVM metrics.
All Snowflake numerics arrive as strings — always float() before math.
"""

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _f(value: Any) -> float:
    """Coerce a Snowflake value (often a string) to float."""
    try:
        return float(value)
    except Exception:
        return 0.0


def _safe_div(numerator: float, denominator: float) -> float:
    """Division with zero-guard."""
    return (numerator / denominator) if denominator else 0.0


def _root_rows(rows: list[dict]) -> list[dict]:
    """Filter to ROOT-level rows (empty CBS_HIERARCHY)."""
    root = []
    for row in rows:
        cbs = row.get("CBS_HIERARCHY")
        if cbs is None or str(cbs).strip() in ("", "-"):
            root.append(row)
    return root if root else rows


def compute_evm_metrics(rows: list[dict], start_month: Optional[str] = None) -> dict:
    """
    Compute full EVM metrics from ROOT-level CR Cube rows.

    Args:
        rows: CR Cube result rows (will be filtered to ROOT-level internally).
        start_month: Optional start month for elapsed-month calculation.

    Returns:
        Dict with BAC, ACWP, BCWP, BCWS, CPI, SPI, CV, SV,
        EAC, ETC, VAC, TCPI, percent_complete, percent_spent.
    """
    root = _root_rows(rows)
    if not root:
        return _empty_metrics()

    # Determine the latest period for point-in-time metrics
    periods = sorted({str(r.get("FISCAL_YEAR_MONTH_NO") or "") for r in root if r.get("FISCAL_YEAR_MONTH_NO")})
    if not periods:
        return _empty_metrics()

    latest_period = periods[-1]
    latest_rows = [r for r in root if str(r.get("FISCAL_YEAR_MONTH_NO") or "") == latest_period]

    # BAC — Budget at Completion (sum of CB_AMT for latest period ROOT rows)
    bac = sum(_f(r.get("CB_AMT")) for r in latest_rows)

    # ACWP — Actual Cost of Work Performed (JTD_SPEND for latest period)
    acwp = sum(_f(r.get("JTD_SPEND")) for r in latest_rows)

    # BCWP — Budgeted Cost of Work Performed (Earned Value)
    # = budget-weighted % complete × BAC
    weighted_pct = 0.0
    budget_weight = 0.0
    for r in latest_rows:
        budget = _f(r.get("CB_AMT"))
        pct = _f(r.get("JTD_PERC_COMP"))
        weighted_pct += budget * pct
        budget_weight += budget
    percent_complete = _safe_div(weighted_pct, budget_weight)
    bcwp = (percent_complete / 100.0) * bac

    # BCWS — Budgeted Cost of Work Scheduled
    # Phase 1: time-proportioned (elapsed months / total months × BAC)
    total_months = len(periods)
    if start_month:
        elapsed = len([p for p in periods if p <= latest_period])
    else:
        elapsed = total_months
    bcws = bac * _safe_div(elapsed, total_months) if total_months else 0.0

    # Derived indices
    cpi = _safe_div(bcwp, acwp)
    spi = _safe_div(bcwp, bcws)

    # Variances
    cv = bcwp - acwp
    sv = bcwp - bcws

    # Forecasts
    eac = _safe_div(bac, cpi)
    etc = eac - acwp
    vac = bac - eac

    # To Complete Performance Index
    tcpi = _safe_div(bac - bcwp, bac - acwp) if (bac - acwp) != 0 else 0.0

    percent_spent = _safe_div(acwp, bac) * 100.0

    return {
        "BAC": round(bac, 2),
        "ACWP": round(acwp, 2),
        "BCWP": round(bcwp, 2),
        "BCWS": round(bcws, 2),
        "CPI": round(cpi, 4),
        "SPI": round(spi, 4),
        "CV": round(cv, 2),
        "SV": round(sv, 2),
        "EAC": round(eac, 2),
        "ETC": round(etc, 2),
        "VAC": round(vac, 2),
        "TCPI": round(tcpi, 4),
        "percent_complete": round(percent_complete, 2),
        "percent_spent": round(percent_spent, 2),
        "latest_period": latest_period,
        "total_periods": total_months,
    }


def _empty_metrics() -> dict:
    """Return zeroed-out metrics when no data is available."""
    return {
        "BAC": 0.0, "ACWP": 0.0, "BCWP": 0.0, "BCWS": 0.0,
        "CPI": 0.0, "SPI": 0.0, "CV": 0.0, "SV": 0.0,
        "EAC": 0.0, "ETC": 0.0, "VAC": 0.0, "TCPI": 0.0,
        "percent_complete": 0.0, "percent_spent": 0.0,
        "latest_period": None, "total_periods": 0,
    }


def compute_evm_by_period(rows: list[dict]) -> list[dict]:
    """
    Compute period-by-period cumulative EVM for trend charts.

    Returns a list of dicts sorted by period, each with:
        period, BAC, ACWP, BCWP, BCWS, CPI, SPI, CV, SV
    """
    root = _root_rows(rows)
    if not root:
        return []

    # Group rows by period
    period_map: dict[str, list[dict]] = {}
    for r in root:
        period = str(r.get("FISCAL_YEAR_MONTH_NO") or "")
        if not period:
            continue
        period_map.setdefault(period, []).append(r)

    sorted_periods = sorted(period_map.keys())
    total_months = len(sorted_periods)
    results = []

    for idx, period in enumerate(sorted_periods, start=1):
        period_rows = period_map[period]

        bac = sum(_f(r.get("CB_AMT")) for r in period_rows)
        acwp = sum(_f(r.get("JTD_SPEND")) for r in period_rows)

        # BCWP for this period
        weighted_pct = 0.0
        budget_weight = 0.0
        for r in period_rows:
            budget = _f(r.get("CB_AMT"))
            pct = _f(r.get("JTD_PERC_COMP"))
            weighted_pct += budget * pct
            budget_weight += budget
        pct_complete = _safe_div(weighted_pct, budget_weight)
        bcwp = (pct_complete / 100.0) * bac

        # BCWS time-proportioned
        bcws = bac * _safe_div(idx, total_months)

        cpi = _safe_div(bcwp, acwp)
        spi = _safe_div(bcwp, bcws)
        cv = bcwp - acwp
        sv = bcwp - bcws

        results.append({
            "period": period,
            "BAC": round(bac, 2),
            "ACWP": round(acwp, 2),
            "BCWP": round(bcwp, 2),
            "BCWS": round(bcws, 2),
            "CPI": round(cpi, 4),
            "SPI": round(spi, 4),
            "CV": round(cv, 2),
            "SV": round(sv, 2),
            "percent_complete": round(pct_complete, 2),
        })

    return results


def compute_project_health(metrics: dict) -> dict:
    """
    Apply health thresholds to EVM metrics.

    Returns:
        Dict with status for each indicator (green/yellow/red)
        and an overall status (worst of the individual statuses).
    """
    def _cpi_spi_status(value: float) -> str:
        if value >= 1.0:
            return "green"
        if value >= 0.9:
            return "yellow"
        return "red"

    def _eac_variance_status(bac: float, eac: float) -> str:
        if bac == 0:
            return "green"
        pct = abs(eac - bac) / bac * 100.0
        if pct <= 5.0:
            return "green"
        if pct <= 10.0:
            return "yellow"
        return "red"

    def _tcpi_status(value: float) -> str:
        if value <= 1.10:
            return "green"
        if value <= 1.20:
            return "yellow"
        return "red"

    cpi_status = _cpi_spi_status(metrics.get("CPI", 0.0))
    spi_status = _cpi_spi_status(metrics.get("SPI", 0.0))
    eac_status = _eac_variance_status(metrics.get("BAC", 0.0), metrics.get("EAC", 0.0))
    tcpi_status = _tcpi_status(metrics.get("TCPI", 0.0))

    # Overall = worst individual status
    priority = {"red": 0, "yellow": 1, "green": 2}
    statuses = [cpi_status, spi_status, eac_status, tcpi_status]
    overall = min(statuses, key=lambda s: priority[s])

    return {
        "CPI": {"value": metrics.get("CPI", 0.0), "status": cpi_status},
        "SPI": {"value": metrics.get("SPI", 0.0), "status": spi_status},
        "EAC_variance": {
            "value": round(metrics.get("VAC", 0.0), 2),
            "percent": round(
                metrics.get("VAC", 0.0) / metrics.get("BAC", 1.0) * 100.0,
                2
            ) if metrics.get("BAC", 0.0) else 0.0,
            "status": eac_status,
        },
        "TCPI": {"value": metrics.get("TCPI", 0.0), "status": tcpi_status},
        "overall": overall,
    }
