"""
Pytest fixtures and configuration for backend tests.
"""

import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Set test environment variables before importing app
os.environ["AUTH_ENABLED"] = "false"
os.environ["SF_ACCOUNT"] = "test_account"
os.environ["SF_USER"] = "test_user"
os.environ["SF_ROLE"] = "test_role"
os.environ["SF_WAREHOUSE"] = "test_warehouse"
os.environ["SF_PASSWORD"] = "test_password"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["OPENAI_API_KEY"] = "test-openai-key"

from app.main import app
from app.auth import create_access_token, get_password_hash


@pytest.fixture
def client():
    """Create a test client with mocked Snowflake connection."""
    with patch('app.snowflake_client.get_pool') as mock_pool:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_cursor.description = []
        mock_cursor.sfqid = "test-query-id"
        mock_conn.cursor.return_value = mock_cursor
        mock_pool.return_value.get_connection.return_value = mock_conn
        
        with TestClient(app) as client:
            yield client


@pytest.fixture
def authenticated_client(client):
    """Create a test client with authentication token."""
    token = create_access_token(
        data={"sub": "test_user", "scopes": ["read", "write"]}
    )
    client.headers["Authorization"] = f"Bearer {token}"
    return client


@pytest.fixture
def admin_token():
    """Create an admin JWT token for testing."""
    return create_access_token(
        data={"sub": "admin", "scopes": ["read", "write", "admin"]}
    )


@pytest.fixture
def user_token():
    """Create a regular user JWT token for testing."""
    return create_access_token(
        data={"sub": "analyst", "scopes": ["read"]}
    )


@pytest.fixture
def mock_snowflake_data():
    """Sample Snowflake response data for testing."""
    return {
        "columns": ["PROJECT_NUMBER", "FISCAL_YEAR_MONTH_NO", "CB_AMT", "JTD_SPEND"],
        "rows": [
            {
                "PROJECT_NUMBER": "106073",
                "FISCAL_YEAR_MONTH_NO": "202401",
                "CB_AMT": "1000000.00",
                "JTD_SPEND": "500000.00",
                "CBS_HIERARCHY": "",
                "WBS_ELEMENT": "WBS001",
                "WBS_DESCRIPTION": "Test WBS",
                "ACCOUNT_CODE": "1000"
            },
            {
                "PROJECT_NUMBER": "106073",
                "FISCAL_YEAR_MONTH_NO": "202402",
                "CB_AMT": "1000000.00",
                "JTD_SPEND": "750000.00",
                "CBS_HIERARCHY": "",
                "WBS_ELEMENT": "WBS001",
                "WBS_DESCRIPTION": "Test WBS",
                "ACCOUNT_CODE": "1000"
            }
        ],
        "row_count": 2,
        "query_id": "test-query-id",
        "timing_ms": 100.0
    }


@pytest.fixture
def sample_cost_row():
    """Sample cost data row for testing."""
    return {
        "FISCAL_YEAR_MONTH_NO": "202401",
        "PROJECT_NUMBER": "106073",
        "CBS_HIERARCHY": "",
        "WBS_ELEMENT": "WBS001",
        "WBS_DESCRIPTION": "Test Work Breakdown Structure",
        "ACCOUNT_CODE": "1000",
        "CB_AMT": "1000000.00",
        "JTD_SPEND": "500000.00",
        "PER_SPEND": "100000.00",
        "FORECAST_AMOUNT": "950000.00",
        "JTD_PERC_COMP": "50.00",
        "JTD_MH": "5000",
        "PER_MH": "1000"
    }
