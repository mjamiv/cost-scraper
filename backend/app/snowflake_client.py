"""
Snowflake connection and query execution with connection pooling.
Supports multiple authentication methods:
  - Password (simplest)
  - SSO/Browser (externalbrowser)
  - Key-pair (production)

Connection Pooling:
  - Maintains a pool of reusable connections
  - Reduces connection overhead (50-200ms per query)
  - Handles connection lifecycle and cleanup
"""

import time
import logging
import threading
from typing import Any, Optional
from contextlib import contextmanager
from queue import Queue, Empty

import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from app.config import get_settings, get_private_key_bytes

logger = logging.getLogger(__name__)


# ============================================================================
# Connection Pool
# ============================================================================

class ConnectionPool:
    """
    Thread-safe connection pool for Snowflake connections.
    
    Features:
    - Lazy connection creation
    - Connection health checks
    - Automatic reconnection on failure
    - Configurable pool size and timeout
    """
    
    def __init__(self, pool_size: int = 5, timeout: int = 30):
        self._pool: Queue = Queue(maxsize=pool_size)
        self._pool_size = pool_size
        self._timeout = timeout
        self._created_count = 0
        self._lock = threading.Lock()
        self._closed = False
        logger.info(f"Connection pool initialized: size={pool_size}, timeout={timeout}s")
    
    def _get_connection_params(self) -> dict:
        """Build connection parameters based on config."""
        settings = get_settings()
        
        conn_params = {
            "account": settings.sf_account,
            "user": settings.sf_user,
            "role": settings.sf_role,
            "warehouse": settings.sf_warehouse,
        }
        
        # Determine auth method
        if settings.sf_authenticator:
            conn_params["authenticator"] = settings.sf_authenticator
        elif settings.sf_password:
            conn_params["password"] = settings.sf_password
        elif settings.sf_private_key_b64:
            conn_params["private_key"] = get_private_key()
        else:
            raise ValueError(
                "No authentication configured. Set one of: "
                "SF_PASSWORD, SF_AUTHENTICATOR, or SF_PRIVATE_KEY_B64"
            )
        
        return conn_params
    
    def _create_connection(self) -> snowflake.connector.SnowflakeConnection:
        """Create a new Snowflake connection."""
        settings = get_settings()
        logger.info(f"Creating new Snowflake connection to {settings.sf_account}")
        start = time.time()
        
        conn_params = self._get_connection_params()
        conn = snowflake.connector.connect(**conn_params)
        
        elapsed = (time.time() - start) * 1000
        logger.info(f"New connection created in {elapsed:.0f}ms")
        
        return conn
    
    def _is_connection_alive(self, conn: snowflake.connector.SnowflakeConnection) -> bool:
        """Check if a connection is still valid."""
        try:
            if conn.is_closed():
                return False
            # Quick health check
            cur = conn.cursor()
            try:
                cur.execute("SELECT 1")
                cur.fetchone()
                return True
            finally:
                cur.close()
        except Exception as e:
            logger.warning(f"Connection health check failed: {e}")
            return False
    
    def get_connection(self) -> snowflake.connector.SnowflakeConnection:
        """
        Get a connection from the pool.
        Creates a new connection if pool is empty and under limit.
        """
        if self._closed:
            raise RuntimeError("Connection pool is closed")
        
        # Try to get an existing connection
        try:
            conn = self._pool.get_nowait()
            if self._is_connection_alive(conn):
                logger.debug("Reusing pooled connection")
                return conn
            else:
                # Connection is dead, try to close it
                try:
                    conn.close()
                except Exception:
                    pass
                with self._lock:
                    self._created_count -= 1
        except Empty:
            pass
        
        # Create new connection if under limit
        with self._lock:
            if self._created_count < self._pool_size:
                self._created_count += 1
                try:
                    return self._create_connection()
                except Exception:
                    self._created_count -= 1
                    raise
        
        # Wait for a connection to become available
        try:
            conn = self._pool.get(timeout=self._timeout)
            if self._is_connection_alive(conn):
                return conn
            else:
                try:
                    conn.close()
                except Exception:
                    pass
                with self._lock:
                    self._created_count -= 1
                # Retry
                return self.get_connection()
        except Empty:
            raise TimeoutError(f"Could not get connection within {self._timeout}s")
    
    def return_connection(self, conn: snowflake.connector.SnowflakeConnection) -> None:
        """Return a connection to the pool."""
        if self._closed:
            try:
                conn.close()
            except Exception:
                pass
            return
        
        try:
            self._pool.put_nowait(conn)
            logger.debug("Connection returned to pool")
        except Exception:
            # Pool is full, close this connection
            try:
                conn.close()
            except Exception:
                pass
            with self._lock:
                self._created_count -= 1
    
    def close_all(self) -> None:
        """Close all connections in the pool."""
        self._closed = True
        closed_count = 0
        
        while True:
            try:
                conn = self._pool.get_nowait()
                try:
                    conn.close()
                    closed_count += 1
                except Exception as e:
                    logger.warning(f"Error closing connection: {e}")
            except Empty:
                break
        
        with self._lock:
            self._created_count = 0
        
        logger.info(f"Connection pool closed: {closed_count} connections closed")
    
    @property
    def stats(self) -> dict:
        """Get pool statistics."""
        return {
            "pool_size": self._pool_size,
            "created_count": self._created_count,
            "available": self._pool.qsize(),
            "closed": self._closed
        }


# Global connection pool instance
_pool: Optional[ConnectionPool] = None
_pool_lock = threading.Lock()


def get_pool() -> ConnectionPool:
    """Get or create the global connection pool."""
    global _pool
    
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                settings = get_settings()
                _pool = ConnectionPool(
                    pool_size=settings.sf_pool_size,
                    timeout=settings.sf_pool_timeout
                )
    
    return _pool


def close_all_connections() -> None:
    """
    Close all pooled connections.
    Call this on application shutdown.
    """
    global _pool
    
    with _pool_lock:
        if _pool is not None:
            _pool.close_all()
            _pool = None
            logger.info("All Snowflake connections closed")


def get_pool_stats() -> dict:
    """Get connection pool statistics."""
    pool = get_pool()
    return pool.stats


# ============================================================================
# Private Key Handling
# ============================================================================

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


# ============================================================================
# Connection Context Manager
# ============================================================================

@contextmanager
def get_connection():
    """
    Get a Snowflake connection from the pool.
    
    Uses connection pooling for better performance.
    Connection is automatically returned to pool after use.
    """
    pool = get_pool()
    conn = None
    
    try:
        conn = pool.get_connection()
        yield conn
    except Exception as e:
        # If there was an error, don't return connection to pool
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
            conn = None
        raise
    finally:
        if conn is not None:
            pool.return_connection(conn)


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
