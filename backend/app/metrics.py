"""
Prometheus metrics for Cost Scraper API.

This module provides metrics collection for monitoring API performance,
database queries, and system health.
"""

import time
import logging
from typing import Callable
from functools import wraps

from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# ============================================================================
# Metrics Definitions
# ============================================================================

# Request metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint'],
    buckets=(0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0)
)

REQUESTS_IN_PROGRESS = Gauge(
    'http_requests_in_progress',
    'Number of HTTP requests currently being processed',
    ['method', 'endpoint']
)

# Database metrics
DB_QUERY_COUNT = Counter(
    'db_queries_total',
    'Total database queries executed',
    ['query_type', 'status']
)

DB_QUERY_LATENCY = Histogram(
    'db_query_duration_seconds',
    'Database query latency in seconds',
    ['query_type'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0)
)

DB_CONNECTION_POOL = Gauge(
    'db_connection_pool_size',
    'Current database connection pool metrics',
    ['metric']
)

# AI/Chat metrics
AI_REQUEST_COUNT = Counter(
    'ai_requests_total',
    'Total AI/LLM requests',
    ['endpoint', 'status']
)

AI_REQUEST_LATENCY = Histogram(
    'ai_request_duration_seconds',
    'AI/LLM request latency in seconds',
    ['endpoint'],
    buckets=(0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 30.0)
)

AI_TOKENS = Counter(
    'ai_tokens_total',
    'Total AI tokens used',
    ['type']  # input, output
)

# Authentication metrics
AUTH_ATTEMPTS = Counter(
    'auth_attempts_total',
    'Total authentication attempts',
    ['status']  # success, failure
)

# Error metrics
ERROR_COUNT = Counter(
    'errors_total',
    'Total errors by type',
    ['type', 'endpoint']
)

# App info
APP_INFO = Info(
    'cost_scraper_app',
    'Application information'
)


def init_app_info(version: str = "2.0.0"):
    """Initialize application info metric."""
    APP_INFO.info({
        'version': version,
        'name': 'cost-scraper-api',
        'environment': 'production'
    })


# ============================================================================
# Metric Recording Functions
# ============================================================================

def record_request(method: str, endpoint: str, status: int, duration: float):
    """Record HTTP request metrics."""
    REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=str(status)).inc()
    REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)


def record_db_query(query_type: str, success: bool, duration: float):
    """Record database query metrics."""
    status = 'success' if success else 'error'
    DB_QUERY_COUNT.labels(query_type=query_type, status=status).inc()
    DB_QUERY_LATENCY.labels(query_type=query_type).observe(duration)


def record_connection_pool_stats(stats: dict):
    """Record connection pool statistics."""
    DB_CONNECTION_POOL.labels(metric='pool_size').set(stats.get('pool_size', 0))
    DB_CONNECTION_POOL.labels(metric='created_count').set(stats.get('created_count', 0))
    DB_CONNECTION_POOL.labels(metric='available').set(stats.get('available', 0))


def record_ai_request(endpoint: str, success: bool, duration: float, input_tokens: int = 0, output_tokens: int = 0):
    """Record AI/LLM request metrics."""
    status = 'success' if success else 'error'
    AI_REQUEST_COUNT.labels(endpoint=endpoint, status=status).inc()
    AI_REQUEST_LATENCY.labels(endpoint=endpoint).observe(duration)
    
    if input_tokens > 0:
        AI_TOKENS.labels(type='input').inc(input_tokens)
    if output_tokens > 0:
        AI_TOKENS.labels(type='output').inc(output_tokens)


def record_auth_attempt(success: bool):
    """Record authentication attempt."""
    status = 'success' if success else 'failure'
    AUTH_ATTEMPTS.labels(status=status).inc()


def record_error(error_type: str, endpoint: str):
    """Record an error."""
    ERROR_COUNT.labels(type=error_type, endpoint=endpoint).inc()


# ============================================================================
# Decorators
# ============================================================================

def track_db_query(query_type: str = "query"):
    """Decorator to track database query performance."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                record_db_query(query_type, True, time.time() - start)
                return result
            except Exception as e:
                record_db_query(query_type, False, time.time() - start)
                raise
        return wrapper
    return decorator


def track_ai_request(endpoint: str = "chat"):
    """Decorator to track AI request performance."""
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                record_ai_request(endpoint, True, time.time() - start)
                return result
            except Exception as e:
                record_ai_request(endpoint, False, time.time() - start)
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                record_ai_request(endpoint, True, time.time() - start)
                return result
            except Exception as e:
                record_ai_request(endpoint, False, time.time() - start)
                raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


# ============================================================================
# Middleware
# ============================================================================

class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP request metrics."""
    
    async def dispatch(self, request: Request, call_next):
        method = request.method
        endpoint = self._get_endpoint(request)
        
        REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()
        
        start = time.time()
        try:
            response = await call_next(request)
            duration = time.time() - start
            
            record_request(method, endpoint, response.status_code, duration)
            
            return response
            
        except Exception as e:
            duration = time.time() - start
            record_request(method, endpoint, 500, duration)
            record_error(type(e).__name__, endpoint)
            raise
            
        finally:
            REQUESTS_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
    
    def _get_endpoint(self, request: Request) -> str:
        """Extract endpoint path, normalizing path parameters."""
        path = request.url.path
        
        # Normalize common path patterns
        # e.g., /api/voice/custom/abc123 -> /api/voice/custom/{voice_id}
        import re
        path = re.sub(r'/[a-f0-9-]{36}', '/{id}', path)  # UUIDs
        path = re.sub(r'/\d{6}', '/{project}', path)  # Project numbers
        
        return path


# ============================================================================
# Metrics Endpoint
# ============================================================================

def get_metrics() -> Response:
    """Generate Prometheus metrics response."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
