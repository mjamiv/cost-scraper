"""
Cost Scraper - Snowflake Native Streamlit App

Deploy this directly in Snowflake:
1. Go to Snowflake > Streamlit
2. Create new Streamlit app
3. Paste this code
4. Select warehouse: PROD_ENT_CONS_BI_BULK_WH
"""

import streamlit as st
from snowflake.snowpark.context import get_active_session
import pandas as pd

# Page config
st.set_page_config(
    page_title="Cost Scraper",
    page_icon="📊",
    layout="wide"
)

st.title("📊 Cost Scraper")

# Get Snowflake session (native connection - no auth needed)
session = get_active_session()


@st.cache_data(ttl=300)
def get_districts():
    """Fetch available districts."""
    query = """
        SELECT DISTINCT LEAD_DISTRICT, LEAD_DISTRICT_ID
        FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
        WHERE LEAD_DISTRICT IS NOT NULL
        ORDER BY LEAD_DISTRICT
    """
    return session.sql(query).to_pandas()


@st.cache_data(ttl=300)
def get_projects(district_id: str = None):
    """Fetch projects, optionally filtered by district."""
    if district_id:
        query = f"""
            SELECT DISTINCT PROJECT_NUMBER, LEAD_DISTRICT
            FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
            WHERE PROJECT_NUMBER IS NOT NULL
              AND LEAD_DISTRICT_ID = '{district_id}'
            ORDER BY PROJECT_NUMBER
            LIMIT 500
        """
    else:
        query = """
            SELECT DISTINCT PROJECT_NUMBER, LEAD_DISTRICT
            FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
            WHERE PROJECT_NUMBER IS NOT NULL
            ORDER BY PROJECT_NUMBER
            LIMIT 500
        """
    return session.sql(query).to_pandas()


@st.cache_data(ttl=300)
def get_fiscal_months():
    """Fetch available fiscal months."""
    query = """
        SELECT DISTINCT FISCAL_YEAR_MONTH_NO
        FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS
        ORDER BY FISCAL_YEAR_MONTH_NO DESC
        LIMIT 48
    """
    return session.sql(query).to_pandas()


def get_cost_data(project_numbers: list, start_month: str, end_month: str = None, limit: int = 5000):
    """Fetch cost data for selected projects and date range."""

    # Build project list for IN clause
    projects_str = ", ".join([f"'{p}'" for p in project_numbers])

    # Build date filter
    if end_month:
        date_filter = f"CR.FISCAL_YEAR_MONTH_NO BETWEEN '{start_month}' AND '{end_month}'"
    else:
        date_filter = f"CR.FISCAL_YEAR_MONTH_NO >= '{start_month}'"

    query = f"""
        SELECT
            CR.FISCAL_YEAR_MONTH_NO,
            PE.LEAD_DISTRICT_ID,
            PE.LEAD_DISTRICT,
            CR.PROJECT_NUMBER,
            WBS.CBS_HIERARCHY,
            CR.WBS_ELEMENT,
            WBS.WBS_DESCRIPTION,
            WBS.ACCOUNT_CODE,
            WBS.UNIT_OF_MEASURE_ID,

            -- Current Budget/Estimates
            CR.CURRENT_ESTIMATE_QUANTITY AS CE_QTY,
            CR.CURRENT_BUDGET_QUANTITY AS CB_QTY,
            CR.CURRENT_BUDGET_MHF AS CB_MHF,
            CR.CURRENT_BUDGET_AMOUNT AS CB_AMT,
            CR.CURRENT_BUDGET_UNIT_COST AS CB_UNIT_COST,

            -- Period Actuals
            CR.QUANTITY AS PER_QTY,
            CR.PERCENT_COMPLETE AS PER_PERC_COMP,
            CR.MANHOURS AS PER_MH,
            CR.ACTUAL_COST AS PER_SPEND,
            CR.PF AS PER_PF,
            CR.CF AS PER_CF

            -- Job-to-Date Totals
            CR.JTD_QUANTITY AS JTD_QTY,
            CR.JTD_ACTUAL_COST AS JTD_SPEND,
            CR.JTD_MANHOURS AS JTC_MH,
            CR.JTD_PERCENT_COMPLETE AS JTD_PERC_COMP,
            CR.JTD_PF AS JTD_PF,
            CR.JTD_CF AS JTD_CF,

            -- Forecasts
            CR.FORECAST_REMAINING_QUANTITY,
            CR.FORECAST_MH,
            CR.FORECAST_REMAINING_MH,
            CR.FORECAST_AMOUNT,
            CR.FORECAST_PF,
            CR.FORECAST_CF

            -- Variance calculation
            (CR.JTD_ACTUAL_COST / NULLIFZERO(CR.JTD_PERCENT_COMPLETE)) - CR.FORECAST_AMOUNT AS SL_VARIANCE

        FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS CR
        LEFT JOIN PROD_ENT_CONSUMPTION.SEM_VW.WBS_SNAPSHOT WBS
            ON CR.WBS_ELEMENT = WBS.WBS_ELEMENT
            AND CR.FISCAL_YEAR_MONTH_NO = WBS.FISCAL_YEAR_MONTH_NO
        LEFT JOIN PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS PE
            ON CR.PROJECT_NUMBER = PE.PROJECT_NUMBER
        WHERE CR.PROJECT_NUMBER IN ({projects_str})
          AND {date_filter}
        ORDER BY CR.FISCAL_YEAR_MONTH_NO DESC, CR.PROJECT_NUMBER, CR.WBS_ELEMENT
        LIMIT {limit}
    """

    return session.sql(query).to_pandas()


# Sidebar filters
st.sidebar.header("Filters")

# Load filter options
with st.spinner("Loading filters..."):
    districts_df = get_districts()
    fiscal_months_df = get_fiscal_months()

# District filter
district_options = ["All Districts"] + districts_df["LEAD_DISTRICT"].tolist()
selected_district = st.sidebar.selectbox("District", district_options)

# Get district ID if selected
district_id = None
if selected_district != "All Districts":
    district_id = districts_df[districts_df["LEAD_DISTRICT"] == selected_district]["LEAD_DISTRICT_ID"].iloc[0]

# Projects filter (filtered by district)
projects_df = get_projects(district_id)
project_options = projects_df["PROJECT_NUMBER"].tolist()

selected_projects = st.sidebar.multiselect(
    "Projects",
    options=project_options,
    default=[],
    help="Select one or more projects"
)

# Or enter project numbers manually
manual_projects = st.sidebar.text_area(
    "Or enter project numbers (one per line)",
    height=100,
    help="Enter project numbers separated by newlines, commas, or spaces"
)

# Parse manual input
if manual_projects:
    import re
    manual_list = re.split(r'[,\s\n]+', manual_projects.strip())
    manual_list = [p.strip() for p in manual_list if p.strip()]
    # Combine with selected projects
    all_projects = list(set(selected_projects + manual_list))
else:
    all_projects = selected_projects

# Date range
fiscal_months = fiscal_months_df["FISCAL_YEAR_MONTH_NO"].tolist()

col1, col2 = st.sidebar.columns(2)
with col1:
    start_month = st.selectbox(
        "Start Month",
        options=fiscal_months,
        index=min(11, len(fiscal_months) - 1) if fiscal_months else 0,  # Default to ~1 year ago
        help="YYYYMM format"
    )
with col2:
    end_month = st.selectbox(
        "End Month",
        options=fiscal_months,
        index=0 if fiscal_months else 0,  # Default to most recent
        help="YYYYMM format"
    )

# Row limit
row_limit = st.sidebar.slider("Row Limit", 100, 50000, 5000, step=100)

# Query button
st.sidebar.divider()

if st.sidebar.button("🔍 Query Data", type="primary", use_container_width=True):
    if not all_projects:
        st.error("Please select or enter at least one project number.")
    else:
        with st.spinner(f"Querying {len(all_projects)} project(s)..."):
            try:
                df = get_cost_data(
                    project_numbers=all_projects,
                    start_month=start_month,
                    end_month=end_month,
                    limit=row_limit
                )

                # Store in session state
                st.session_state["results"] = df
                st.session_state["query_projects"] = all_projects

            except Exception as e:
                st.error(f"Query failed: {str(e)}")

# Display results
if "results" in st.session_state:
    df = st.session_state["results"]

    # Metrics row
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Rows", f"{len(df):,}")
    with col2:
        st.metric("Projects", df["PROJECT_NUMBER"].nunique() if len(df) > 0 else 0)
    with col3:
        if len(df) > 0 and "CB_AMT" in df.columns:
            total_budget = df["CB_AMT"].sum()
            st.metric("Total Budget", f"${total_budget:,.0f}")
    with col4:
        if len(df) > 0 and "JTD_SPEND" in df.columns:
            total_spend = df["JTD_SPEND"].sum()
            st.metric("Total JTD Spend", f"${total_spend:,.0f}")

    st.divider()

    # Data table
    st.dataframe(
        df,
        use_container_width=True,
        hide_index=True,
        height=500
    )

    # Export
    col1, col2 = st.columns([1, 5])
    with col1:
        csv = df.to_csv(index=False)
        st.download_button(
            "📥 Download CSV",
            csv,
            file_name=f"cost_data_{start_month}_{end_month}.csv",
            mime="text/csv"
        )

else:
    # Initial state
    st.info("👈 Select projects and click **Query Data** to get started.")

    # Show connection info
    with st.expander("Connection Info"):
        st.write("**Account:**", session.get_current_account())
        st.write("**User:**", session.get_current_user())
        st.write("**Role:**", session.get_current_role())
        st.write("**Warehouse:**", session.get_current_warehouse())
        st.write("**Database:**", session.get_current_database())
