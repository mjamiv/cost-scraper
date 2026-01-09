import snowflake.connector
from contextlib import contextmanager
from typing import Generator, Any
from config import get_settings


class SnowflakeConnection:
    """Manages Snowflake database connections."""
    
    def __init__(self):
        self.settings = get_settings()
    
    @contextmanager
    def get_connection(self) -> Generator[snowflake.connector.SnowflakeConnection, None, None]:
        """Context manager for Snowflake connections."""
        conn = None
        try:
            conn = snowflake.connector.connect(
                account=self.settings.snowflake_account,
                user=self.settings.snowflake_user,
                password=self.settings.snowflake_password,
                warehouse=self.settings.snowflake_warehouse,
                database=self.settings.snowflake_database,
                schema=self.settings.snowflake_schema,
                role=self.settings.snowflake_role,
            )
            yield conn
        finally:
            if conn:
                conn.close()
    
    def execute_query(self, query: str, params: dict[str, Any] | None = None) -> list[dict]:
        """Execute a query and return results as a list of dictionaries."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                columns = [desc[0] for desc in cursor.description]
                results = []
                
                for row in cursor.fetchall():
                    results.append(dict(zip(columns, row)))
                
                return results
            finally:
                cursor.close()


# Singleton instance
db = SnowflakeConnection()

