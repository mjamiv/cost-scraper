"""
Query result caching for Cost Scraper API.

This module provides in-memory caching for Snowflake query results
to reduce database load and improve response times.

For production deployments with multiple instances, consider using
Redis instead of in-memory caching.
"""

import time
import logging
import hashlib
import json
from typing import Any, Optional, TypeVar, Callable
from functools import wraps
from threading import Lock

from cachetools import TTLCache, LRUCache

logger = logging.getLogger(__name__)

T = TypeVar('T')

# ============================================================================
# Cache Configuration
# ============================================================================

# Cache sizes (number of items)
QUERY_CACHE_SIZE = 100
LOOKUP_CACHE_SIZE = 50
FILTER_CACHE_SIZE = 20

# TTL in seconds
QUERY_CACHE_TTL = 300  # 5 minutes for query results
LOOKUP_CACHE_TTL = 600  # 10 minutes for lookups (districts, projects)
FILTER_CACHE_TTL = 900  # 15 minutes for filter options


# ============================================================================
# Cache Instances
# ============================================================================

# Query results cache (for cost data queries)
_query_cache: TTLCache = TTLCache(maxsize=QUERY_CACHE_SIZE, ttl=QUERY_CACHE_TTL)
_query_cache_lock = Lock()

# Lookup cache (for districts, projects)
_lookup_cache: TTLCache = TTLCache(maxsize=LOOKUP_CACHE_SIZE, ttl=LOOKUP_CACHE_TTL)
_lookup_cache_lock = Lock()

# Filter options cache
_filter_cache: TTLCache = TTLCache(maxsize=FILTER_CACHE_SIZE, ttl=FILTER_CACHE_TTL)
_filter_cache_lock = Lock()

# Chat context cache (keyed by project+month, longer TTL since context doesn't change often)
CHAT_CONTEXT_CACHE_TTL = 900  # 15 minutes
_chat_context_cache: TTLCache = TTLCache(maxsize=50, ttl=CHAT_CONTEXT_CACHE_TTL)
_chat_context_cache_lock = Lock()


# ============================================================================
# Cache Key Generation
# ============================================================================

def generate_cache_key(*args, **kwargs) -> str:
    """
    Generate a deterministic cache key from arguments.
    
    Uses MD5 hash for consistent key length.
    """
    key_data = json.dumps({
        'args': [str(a) for a in args],
        'kwargs': {k: str(v) for k, v in sorted(kwargs.items())}
    }, sort_keys=True)
    
    return hashlib.md5(key_data.encode()).hexdigest()


def generate_query_key(sql: str, params: Optional[tuple] = None) -> str:
    """Generate cache key for a SQL query."""
    return generate_cache_key(sql=sql, params=params)


# ============================================================================
# Cache Operations
# ============================================================================

def get_cached_query(key: str) -> Optional[dict]:
    """Get cached query result."""
    with _query_cache_lock:
        result = _query_cache.get(key)
        if result is not None:
            logger.debug(f"Cache hit for query: {key[:16]}...")
        return result


def set_cached_query(key: str, result: dict) -> None:
    """Store query result in cache."""
    with _query_cache_lock:
        _query_cache[key] = result
        logger.debug(f"Cached query result: {key[:16]}...")


def get_cached_lookup(key: str) -> Optional[Any]:
    """Get cached lookup data."""
    with _lookup_cache_lock:
        result = _lookup_cache.get(key)
        if result is not None:
            logger.debug(f"Cache hit for lookup: {key}")
        return result


def set_cached_lookup(key: str, result: Any) -> None:
    """Store lookup data in cache."""
    with _lookup_cache_lock:
        _lookup_cache[key] = result
        logger.debug(f"Cached lookup: {key}")


def get_cached_filters() -> Optional[dict]:
    """Get cached filter options."""
    with _filter_cache_lock:
        result = _filter_cache.get("filter_options")
        if result is not None:
            logger.debug("Cache hit for filter options")
        return result


def set_cached_filters(result: dict) -> None:
    """Store filter options in cache."""
    with _filter_cache_lock:
        _filter_cache["filter_options"] = result
        logger.debug("Cached filter options")


def get_cached_chat_context(key: str) -> Optional[dict]:
    """Get cached chat context data."""
    with _chat_context_cache_lock:
        result = _chat_context_cache.get(key)
        if result is not None:
            logger.debug(f"Cache hit for chat context: {key[:16]}...")
        return result


def set_cached_chat_context(key: str, result: dict) -> None:
    """Store chat context data in cache."""
    with _chat_context_cache_lock:
        _chat_context_cache[key] = result
        logger.debug(f"Cached chat context: {key[:16]}...")


# ============================================================================
# Cache Invalidation
# ============================================================================

def clear_query_cache() -> int:
    """Clear all cached query results. Returns number of items cleared."""
    with _query_cache_lock:
        count = len(_query_cache)
        _query_cache.clear()
        logger.info(f"Cleared query cache: {count} items")
        return count


def clear_lookup_cache() -> int:
    """Clear all cached lookup data. Returns number of items cleared."""
    with _lookup_cache_lock:
        count = len(_lookup_cache)
        _lookup_cache.clear()
        logger.info(f"Cleared lookup cache: {count} items")
        return count


def clear_filter_cache() -> int:
    """Clear filter options cache. Returns number of items cleared."""
    with _filter_cache_lock:
        count = len(_filter_cache)
        _filter_cache.clear()
        logger.info(f"Cleared filter cache: {count} items")
        return count


def clear_chat_context_cache() -> int:
    """Clear chat context cache. Returns number of items cleared."""
    with _chat_context_cache_lock:
        count = len(_chat_context_cache)
        _chat_context_cache.clear()
        logger.info(f"Cleared chat context cache: {count} items")
        return count


def clear_all_caches() -> dict:
    """Clear all caches. Returns counts of cleared items."""
    return {
        "query_cache": clear_query_cache(),
        "lookup_cache": clear_lookup_cache(),
        "filter_cache": clear_filter_cache(),
        "chat_context_cache": clear_chat_context_cache()
    }


# ============================================================================
# Cache Statistics
# ============================================================================

def get_cache_stats() -> dict:
    """Get statistics for all caches."""
    with _query_cache_lock:
        query_stats = {
            "size": len(_query_cache),
            "maxsize": _query_cache.maxsize,
            "ttl": QUERY_CACHE_TTL
        }
    
    with _lookup_cache_lock:
        lookup_stats = {
            "size": len(_lookup_cache),
            "maxsize": _lookup_cache.maxsize,
            "ttl": LOOKUP_CACHE_TTL
        }
    
    with _filter_cache_lock:
        filter_stats = {
            "size": len(_filter_cache),
            "maxsize": _filter_cache.maxsize,
            "ttl": FILTER_CACHE_TTL
        }
    
    with _chat_context_cache_lock:
        chat_context_stats = {
            "size": len(_chat_context_cache),
            "maxsize": _chat_context_cache.maxsize,
            "ttl": CHAT_CONTEXT_CACHE_TTL
        }

    return {
        "query_cache": query_stats,
        "lookup_cache": lookup_stats,
        "filter_cache": filter_stats,
        "chat_context_cache": chat_context_stats
    }


# ============================================================================
# Decorators
# ============================================================================

def cached_query(ttl_override: Optional[int] = None):
    """
    Decorator to cache query function results.
    
    Usage:
        @cached_query()
        def my_query(sql, params):
            return execute_query(sql, params)
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Generate cache key
            cache_key = generate_cache_key(*args, **kwargs)
            
            # Check cache
            cached = get_cached_query(cache_key)
            if cached is not None:
                return cached
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            set_cached_query(cache_key, result)
            
            return result
        
        return wrapper
    return decorator


def cached_lookup(key_name: str, ttl_override: Optional[int] = None):
    """
    Decorator to cache lookup function results.
    
    Usage:
        @cached_lookup("districts")
        def get_districts():
            return execute_query("SELECT DISTINCT ...")
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Check cache
            cached = get_cached_lookup(key_name)
            if cached is not None:
                return cached
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            set_cached_lookup(key_name, result)
            
            return result
        
        return wrapper
    return decorator


# ============================================================================
# Cached Query Wrapper
# ============================================================================

def execute_query_cached(
    sql: str,
    params: Optional[tuple] = None,
    cache_enabled: bool = True,
    cache_ttl: Optional[int] = None
) -> dict:
    """
    Execute a query with caching.
    
    This is a wrapper around execute_query that adds caching.
    
    Args:
        sql: SQL query string
        params: Query parameters
        cache_enabled: Whether to use cache (default True)
        cache_ttl: Optional TTL override (not used with cachetools)
    
    Returns:
        Query result dict with columns, rows, etc.
    """
    from app.snowflake_client import execute_query
    
    if not cache_enabled:
        return execute_query(sql, params)
    
    # Generate cache key
    cache_key = generate_query_key(sql, params)
    
    # Check cache
    cached = get_cached_query(cache_key)
    if cached is not None:
        # Add cache hit indicator
        cached_copy = dict(cached)
        cached_copy["cache_hit"] = True
        return cached_copy
    
    # Execute query
    start = time.time()
    result = execute_query(sql, params)
    elapsed = time.time() - start
    
    # Only cache if query was fast enough (< 30 seconds)
    if elapsed < 30:
        set_cached_query(cache_key, result)
    
    result["cache_hit"] = False
    return result
