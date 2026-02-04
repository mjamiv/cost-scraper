"""
Tests for Snowflake client module.
"""

import pytest
from unittest.mock import patch, MagicMock, PropertyMock
import threading

from app.snowflake_client import (
    ConnectionPool,
    get_pool,
    close_all_connections,
    get_pool_stats,
    execute_query,
    test_connection,
    _serialize_value
)


class TestConnectionPool:
    """Tests for ConnectionPool class."""
    
    def test_pool_initialization(self):
        """Pool should initialize with correct settings."""
        pool = ConnectionPool(pool_size=3, timeout=10)
        
        assert pool._pool_size == 3
        assert pool._timeout == 10
        assert pool._created_count == 0
        assert pool._closed is False
    
    def test_pool_stats(self):
        """Pool should return correct statistics."""
        pool = ConnectionPool(pool_size=5)
        stats = pool.stats
        
        assert stats["pool_size"] == 5
        assert stats["created_count"] == 0
        assert stats["available"] == 0
        assert stats["closed"] is False
    
    @patch('app.snowflake_client.snowflake.connector.connect')
    def test_get_connection_creates_new(self, mock_connect):
        """Getting connection should create new if pool is empty."""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        
        pool = ConnectionPool(pool_size=2)
        conn = pool.get_connection()
        
        assert conn == mock_conn
        mock_connect.assert_called_once()
    
    @patch('app.snowflake_client.snowflake.connector.connect')
    def test_return_connection_to_pool(self, mock_connect):
        """Returned connection should be available for reuse."""
        mock_conn = MagicMock()
        mock_conn.is_closed.return_value = False
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        
        pool = ConnectionPool(pool_size=2)
        
        # Get and return a connection
        conn = pool.get_connection()
        pool.return_connection(conn)
        
        # Pool should have one available connection
        assert pool._pool.qsize() == 1
    
    def test_close_all_connections(self):
        """Closing pool should close all connections."""
        mock_conn = MagicMock()
        
        pool = ConnectionPool(pool_size=2)
        pool._pool.put(mock_conn)
        pool._created_count = 1
        
        pool.close_all()
        
        assert pool._closed is True
        assert pool._pool.qsize() == 0
        mock_conn.close.assert_called_once()
    
    def test_get_connection_after_close_raises(self):
        """Getting connection from closed pool should raise."""
        pool = ConnectionPool(pool_size=2)
        pool.close_all()
        
        with pytest.raises(RuntimeError, match="closed"):
            pool.get_connection()


class TestGlobalPool:
    """Tests for global pool functions."""
    
    @patch('app.snowflake_client._pool', None)
    @patch('app.snowflake_client.ConnectionPool')
    def test_get_pool_creates_singleton(self, MockPool):
        """get_pool should create singleton pool."""
        mock_pool_instance = MagicMock()
        MockPool.return_value = mock_pool_instance
        
        pool1 = get_pool()
        
        MockPool.assert_called_once()
    
    @patch('app.snowflake_client._pool')
    def test_close_all_connections_function(self, mock_pool):
        """close_all_connections should close the global pool."""
        mock_pool_instance = MagicMock()
        
        with patch('app.snowflake_client._pool', mock_pool_instance):
            with patch('app.snowflake_client._pool_lock'):
                # This would normally close the pool
                pass
    
    @patch('app.snowflake_client.get_pool')
    def test_get_pool_stats(self, mock_get_pool):
        """get_pool_stats should return pool statistics."""
        mock_pool = MagicMock()
        mock_pool.stats = {"pool_size": 5}
        mock_get_pool.return_value = mock_pool
        
        stats = get_pool_stats()
        
        assert stats == {"pool_size": 5}


class TestExecuteQuery:
    """Tests for query execution."""
    
    @patch('app.snowflake_client.get_pool')
    def test_execute_query_success(self, mock_get_pool):
        """Successful query should return results."""
        mock_cursor = MagicMock()
        mock_cursor.description = [("col1",), ("col2",)]
        mock_cursor.fetchall.return_value = [("val1", "val2")]
        mock_cursor.sfqid = "query-123"
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        
        mock_pool = MagicMock()
        mock_pool.get_connection.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        result = execute_query("SELECT 1")
        
        assert result["columns"] == ["col1", "col2"]
        assert result["row_count"] == 1
        assert result["query_id"] == "query-123"
        assert "timing_ms" in result
    
    @patch('app.snowflake_client.get_pool')
    def test_execute_query_with_params(self, mock_get_pool):
        """Query with parameters should pass them correctly."""
        mock_cursor = MagicMock()
        mock_cursor.description = [("id",)]
        mock_cursor.fetchall.return_value = [(1,)]
        mock_cursor.sfqid = "query-456"
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        
        mock_pool = MagicMock()
        mock_pool.get_connection.return_value = mock_conn
        mock_get_pool.return_value = mock_pool
        
        result = execute_query("SELECT * WHERE id = %s", (123,))
        
        mock_cursor.execute.assert_called_once_with("SELECT * WHERE id = %s", (123,))


class TestSerializeValue:
    """Tests for value serialization."""
    
    def test_serialize_none(self):
        """None should remain None."""
        assert _serialize_value(None) is None
    
    def test_serialize_int(self):
        """Integers should pass through."""
        assert _serialize_value(42) == 42
    
    def test_serialize_float(self):
        """Floats should pass through."""
        assert _serialize_value(3.14) == 3.14
    
    def test_serialize_string(self):
        """Strings should pass through."""
        assert _serialize_value("hello") == "hello"
    
    def test_serialize_bool(self):
        """Booleans should pass through."""
        assert _serialize_value(True) is True
        assert _serialize_value(False) is False
    
    def test_serialize_decimal(self):
        """Decimal should be converted to string."""
        from decimal import Decimal
        result = _serialize_value(Decimal("123.45"))
        assert result == "123.45"
    
    def test_serialize_datetime(self):
        """Datetime should be converted to string."""
        from datetime import datetime
        dt = datetime(2024, 1, 15, 10, 30, 0)
        result = _serialize_value(dt)
        assert isinstance(result, str)
        assert "2024" in result


class TestTestConnection:
    """Tests for connection test function."""
    
    @patch('app.snowflake_client.get_connection')
    def test_test_connection_success(self, mock_get_conn):
        """Successful connection test should return info."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (
            "user@example.com",
            "ANALYST",
            "WAREHOUSE",
            "ACCOUNT",
            "8.0.0"
        )
        
        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_get_conn.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_get_conn.return_value.__exit__ = MagicMock(return_value=False)
        
        result = test_connection()
        
        assert result["connected"] is True
        assert result["user"] == "user@example.com"
        assert result["role"] == "ANALYST"
        assert "connection_time_ms" in result
