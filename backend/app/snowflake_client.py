"""
Snowflake connection and query execution.
Supports multiple authentication methods:
  - Password (simplest)
  - SSO/Browser (externalbrowser)
  - Key-pair (production)
"""

import time
import logging
from typing import Any
from contextlib import contextmanager

import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from app.config import get_settings, get_private_key_bytes

logger = logging.getLogger(__name__)


def get_private_key():
    """Load and decrypt the private key (for key-pair auth)."""
    settings = get_settings()
    key_bytes = get_private_key_bytes()

    passphrase = settings.sf_private_key_passphrase
    password = passphrase.encode() if passphrase else None

    return serialization.load_pem_private_key(
        key_bytes,
        password=password,
        backend=default_backend()
    )


@contextmanager
def get_connection():
    """
    Create a Snowflake connection using the configured auth method.
    Priority: SSO > Password > Key-pair
    """
    settings = get_settings()
    conn = None

    try:
        logger.info(f"Connecting to Snowflake account: {settings.sf_account}")
        start = time.time()

        # Base connection params
        conn_params = {
            "account": settings.sf_account,
            "user": settings.sf_user,
            "role": settings.sf_role,
            "warehouse": settings.sf_warehouse,
        }

        # Determine auth method
        if settings.sf_authenticator:
            # SSO/Browser auth
            logger.info(f"Using authenticator: {settings.sf_authenticator}")
            conn_params["authenticator"] = settings.sf_authenticator

        elif settings.sf_password:
            # Password auth
            logger.info("Using password authentication")
            conn_params["password"] = settings.sf_password

        elif settings.sf_private_key_b64:
            # Key-pair auth
            logger.info("Using key-pair authentication")
            conn_params["private_key"] = get_private_key()

        else:
            raise ValueError(
                "No authentication configured. Set one of: "
                "SF_PASSWORD, SF_AUTHENTICATOR, or SF_PRIVATE_KEY_B64"
            )

        conn = snowflake.connector.connect(**conn_params)

        elapsed = (time.time() - start) * 1000
        logger.info(f"Connected to Snowflake in {elapsed:.0f}ms")

        yield conn

    finally:
        if conn:
            conn.close()
            logger.info("Snowflake connection closed")


def test_connection() -> dict[str, Any]:
    """
    Test the Snowflake connection and return account info.
    Returns detailed connection information for debugging.
    """
    start = time.time()

    with get_connection() as conn:
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT
                    CURRENT_USER() AS user,
                    CURRENT_ROLE() AS role,
                    CURRENT_WAREHOUSE() AS warehouse,
                    CURRENT_ACCOUNT() AS account,
                    CURRENT_VERSION() AS version
            """)
            row = cur.fetchone()

            elapsed_ms = (time.time() - start) * 1000

            return {
                "connected": True,
                "user": row[0],
                "role": row[1],
                "warehouse": row[2],
                "account": row[3],
                "version": row[4],
                "connection_time_ms": round(elapsed_ms, 0)
            }
        finally:
            cur.close()


def execute_query(sql: str, params: tuple = None) -> dict[str, Any]:
    """
    Execute a SQL query and return results with metadata.

    Returns:
        {
            "columns": [...],
            "rows": [...],
            "row_count": int,
            "query_id": str,
            "timing_ms": float
        }
    """
    start = time.time()

    with get_connection() as conn:
        cur = conn.cursor()
        try:
            logger.info(f"Executing query (params: {params})")

            if params:
                cur.execute(sql, params)
            else:
                cur.execute(sql)

            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            query_id = cur.sfqid

            elapsed_ms = (time.time() - start) * 1000

            logger.info(f"Query {query_id} returned {len(rows)} rows in {elapsed_ms:.0f}ms")

            # Convert rows to list of dicts for JSON serialization
            rows_as_dicts = [
                {col: _serialize_value(val) for col, val in zip(columns, row)}
                for row in rows
            ]

            return {
                "columns": columns,
                "rows": rows_as_dicts,
                "row_count": len(rows),
                "query_id": query_id,
                "timing_ms": round(elapsed_ms, 0)
            }
        finally:
            cur.close()


def _serialize_value(val: Any) -> Any:
    """Convert Snowflake values to JSON-serializable types."""
    if val is None:
        return None
    if isinstance(val, (int, float, str, bool)):
        return val
    # Handle Decimal, datetime, etc.
    return str(val)
