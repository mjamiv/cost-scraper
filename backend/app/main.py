"""
Cost Scraper API - FastAPI backend for Snowflake data access.

Endpoints:
- GET /health - Basic health check
- POST /api/auth/login - Authenticate and get JWT token
- GET /api/test-connection - Detailed Snowflake connection test
- POST /api/query - Execute CR Cube query with filters
- GET /api/projects - List available projects
- POST /api/chat - Chat with AI about cost data
- POST /api/voice/transcribe - Transcribe audio to text
- POST /api/voice/synthesize - Convert text to speech

Security:
- JWT authentication for protected endpoints
- API key authentication for service-to-service
- Rate limiting to prevent abuse
"""

import logging
import time
import re
import io
import base64
import json
import warnings
import sys
from datetime import timedelta
from typing import Optional, Any, Annotated

# Suppress SSL warnings for corporate proxy environments
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator
from openai import OpenAI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pythonjsonlogger import jsonlogger

from app.config import get_settings, get_allowed_origins
from app.snowflake_client import test_connection, execute_query, close_all_connections, get_pool_stats
from app.auth import (
    Token, User, authenticate_user, create_access_token,
    get_current_user, get_current_active_user, require_scope,
    get_optional_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.metrics import (
    PrometheusMiddleware, get_metrics, init_app_info,
    record_auth_attempt, record_connection_pool_stats
)
from app.cache import (
    get_cache_stats, clear_all_caches, execute_query_cached,
    get_cached_filters, set_cached_filters, get_cached_lookup, set_cached_lookup
)

# ============================================================================
# Structured Logging Setup
# ============================================================================

class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with additional fields."""
    
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['timestamp'] = time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(record.created))
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['service'] = 'cost-scraper-api'


def setup_logging():
    """Configure structured JSON logging for production."""
    settings = get_settings()
    
    # Get the root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Clear existing handlers
    root_logger.handlers = []
    
    # Create console handler with JSON formatting for production
    console_handler = logging.StreamHandler(sys.stdout)
    
    # Use JSON format in production, readable format in development
    if settings.auth_enabled:
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(logger)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    return logging.getLogger(__name__)


logger = setup_logging()

# ============================================================================
# Rate Limiting Setup
# ============================================================================

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="Cost Scraper API",
    description="Enterprise API for querying Snowflake CR Cube data with AI-powered analysis",
    version="2.0.0",
    docs_url="/docs" if not settings.auth_enabled else "/docs",
    redoc_url="/redoc"
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add Prometheus metrics middleware
app.add_middleware(PrometheusMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize app info metrics
init_app_info("2.0.0")


# ============================================================================
# Request Logging Middleware
# ============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing information."""
    start_time = time.time()
    
    # Generate request ID
    request_id = f"{int(time.time() * 1000)}-{id(request)}"
    
    # Log request
    logger.info(
        "Request started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": get_remote_address(request)
        }
    )
    
    try:
        response = await call_next(request)
        
        # Log response
        elapsed_ms = (time.time() - start_time) * 1000
        logger.info(
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "elapsed_ms": round(elapsed_ms, 2)
            }
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
        
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        logger.error(
            "Request failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "error": str(e),
                "elapsed_ms": round(elapsed_ms, 2)
            }
        )
        raise


# Shutdown event handler - close all pooled Snowflake connections
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up pooled database connections on app shutdown."""
    logger.info("Shutting down - closing Snowflake connection pool...")
    close_all_connections()
    logger.info("Connection pool closed")


# ============================================================================
# Request/Response Models
# ============================================================================

class QueryRequest(BaseModel):
    """Request model for CR Cube query."""
    project_numbers: list[str] = Field(
        ..., 
        min_length=1,
        max_length=50,
        description="List of project numbers to query"
    )
    start_month: str = Field(
        ..., 
        min_length=6, 
        max_length=6,
        description="Start fiscal year month (YYYYMM)"
    )
    end_month: Optional[str] = Field(
        None, 
        min_length=6, 
        max_length=6,
        description="End fiscal year month (YYYYMM), optional"
    )
    limit: int = Field(
        default=5000, 
        ge=1, 
        le=50000,
        description="Maximum rows to return"
    )
    
    @field_validator("project_numbers")
    @classmethod
    def validate_project_numbers(cls, v):
        for p in v:
            if not p.strip().isdigit():
                raise ValueError(f"Project number must be digits only: {p}")
        return [p.strip() for p in v]
    
    @field_validator("start_month", "end_month")
    @classmethod
    def validate_month(cls, v):
        if v is None:
            return v
        if not re.match(r"^\d{6}$", v):
            raise ValueError("Month must be YYYYMM format (6 digits)")
        return v


class QueryResponse(BaseModel):
    """Response model for CR Cube query."""
    success: bool
    columns: list[str]
    rows: list[dict]
    row_count: int
    query_id: str
    timing_ms: float
    message: str


class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    message: str


class ConnectionResponse(BaseModel):
    """Response model for connection test."""
    connected: bool
    user: Optional[str] = None
    role: Optional[str] = None
    warehouse: Optional[str] = None
    account: Optional[str] = None
    version: Optional[str] = None
    connection_time_ms: Optional[float] = None
    error: Optional[str] = None


class ChatMessage(BaseModel):
    """A single chat message."""
    role: str  # "user" or "assistant"
    content: str


class ChatFilterHints(BaseModel):
    """Optional filter hints from the UI (not hard constraints)."""
    project_numbers: Optional[list[str]] = None
    start_month: Optional[str] = None
    end_month: Optional[str] = None
    district_id: Optional[str] = None
    wbs_tags: Optional[dict[str, list[str]]] = None


class ChatContextPrefs(BaseModel):
    """Context preferences for chat behavior."""
    exclude_current_month: bool = False


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str = Field(..., min_length=1, max_length=4000, description="User's question")
    history: list[ChatMessage] = Field(default=[], description="Previous messages in conversation")
    filter_hints: Optional[ChatFilterHints] = None
    context_prefs: Optional[ChatContextPrefs] = None


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    success: bool
    answer: str
    confidence: str
    needs_clarification: bool
    clarifying_question: Optional[str] = None
    data_coverage: dict[str, int]
    chart_request: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class RealtimeToolDefinition(BaseModel):
    """Tool definition for OpenAI Realtime API."""
    type: str = "function"
    name: str
    description: str
    parameters: dict


class RealtimeSessionConfig(BaseModel):
    """Configuration for realtime voice session."""
    voice: str = Field(default="alloy", description="Voice: alloy, ash, ballad, coral, echo, sage, shimmer, verse")
    temperature: float = Field(default=0.8, ge=0.0, le=2.0)  # Slightly higher for more dynamic responses


class RealtimeTokenRequest(BaseModel):
    """Request model for realtime token endpoint."""
    data_context: str = Field(..., description="JSON or markdown summary of the cost data")
    session_config: Optional[RealtimeSessionConfig] = None


class RealtimeTokenResponse(BaseModel):
    """Response model for realtime token endpoint."""
    client_secret: str
    session_id: str
    expires_at: int  # Unix timestamp
    voice: str


class CustomVoiceEligibilityResponse(BaseModel):
    """Response model for custom voice eligibility check."""
    eligible: bool
    message: str


class CustomVoiceConsentResponse(BaseModel):
    """Response model for consent upload."""
    success: bool
    consent_id: str
    message: str


class CustomVoiceCreateRequest(BaseModel):
    """Request model for creating a custom voice."""
    consent_id: str = Field(..., description="ID from consent upload")
    name: str = Field(..., min_length=1, max_length=50, description="User-provided voice name")
    language_tag: str = Field(default="en-US", description="BCP 47 language tag (e.g., en-US, es-ES)")


class CustomVoiceCreateResponse(BaseModel):
    """Response model for custom voice creation."""
    success: bool
    voice_id: str
    name: str
    message: str


class CustomVoiceDeleteResponse(BaseModel):
    """Response model for custom voice deletion."""
    success: bool
    message: str


# ============================================================================
# Authentication Endpoints
# ============================================================================

class LoginRequest(BaseModel):
    """Request model for login endpoint."""
    username: str
    password: str


@app.post("/api/auth/login", response_model=Token, tags=["Authentication"])
@limiter.limit("10/minute")
async def login(request: Request, login_data: LoginRequest):
    """
    Authenticate user and return JWT token.
    
    Demo credentials:
    - username: admin, password: demo123 (full access)
    - username: analyst, password: demo123 (read-only)
    """
    user = authenticate_user(login_data.username, login_data.password)
    if not user:
        logger.warning(f"Failed login attempt for user: {login_data.username}")
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "scopes": user.scopes},
        expires_delta=access_token_expires
    )
    
    logger.info(f"User logged in: {user.username}")
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.post("/api/auth/token", response_model=Token, tags=["Authentication"])
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    """
    OAuth2 compatible token endpoint.
    
    Use this with OAuth2 clients or the Swagger UI "Authorize" button.
    """
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "scopes": user.scopes},
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@app.get("/api/auth/me", response_model=User, tags=["Authentication"])
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Get information about the currently authenticated user."""
    return current_user


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Basic health check - confirms the API is running.
    Does NOT test Snowflake connection (use /api/test-connection for that).
    """
    return HealthResponse(
        status="ok",
        message="Cost Scraper API is running"
    )


@app.get("/api/health/ready", tags=["Health"])
async def readiness_check():
    """
    Readiness probe for Kubernetes/container orchestration.
    Checks if the application is ready to serve traffic.
    """
    try:
        # Check connection pool status
        pool_stats = get_pool_stats()
        
        return {
            "status": "ready",
            "checks": {
                "connection_pool": {
                    "status": "ok" if not pool_stats.get("closed") else "error",
                    "details": pool_stats
                }
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "error": str(e)
            }
        )


@app.get("/api/health/live", tags=["Health"])
async def liveness_check():
    """
    Liveness probe for Kubernetes/container orchestration.
    Simple check to confirm the process is alive.
    """
    return {"status": "alive"}


@app.get("/metrics", tags=["Monitoring"])
async def metrics_endpoint():
    """
    Prometheus metrics endpoint.
    
    Exposes application metrics in Prometheus format for scraping.
    Metrics include:
    - HTTP request counts and latencies
    - Database query performance
    - AI/LLM request metrics
    - Authentication attempts
    - Error counts
    """
    # Update connection pool stats
    try:
        stats = get_pool_stats()
        record_connection_pool_stats(stats)
    except Exception:
        pass
    
    return get_metrics()


@app.get("/api/cache/stats", tags=["Monitoring"])
async def cache_stats(
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get cache statistics.
    
    Returns current cache sizes and configuration.
    Requires authentication.
    """
    return get_cache_stats()


@app.post("/api/cache/clear", tags=["Monitoring"])
async def cache_clear(
    current_user: Annotated[User, Depends(require_scope("admin"))] = None
):
    """
    Clear all caches.
    
    Invalidates all cached query results, lookups, and filter options.
    Requires admin scope.
    """
    counts = clear_all_caches()
    return {
        "success": True,
        "message": "All caches cleared",
        "cleared": counts
    }


@app.get("/api/test-connection", response_model=ConnectionResponse, tags=["Data"])
@limiter.limit("5/minute")
async def api_test_connection(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)]
):
    """
    Test Snowflake connection and return account details.
    Use this to verify key-pair authentication is working.
    
    Requires authentication.
    """
    logger.info(f"Testing Snowflake connection (user: {current_user.username})...")
    
    try:
        result = test_connection()
        logger.info(f"Connection successful: {result['user']} @ {result['account']}")
        return ConnectionResponse(**result)
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Connection failed: {error_msg}")
        return ConnectionResponse(
            connected=False,
            error=error_msg
        )


@app.post("/api/query", response_model=QueryResponse, tags=["Data"])
@limiter.limit("30/minute")
async def api_query(
    request: Request,
    query_request: QueryRequest,
    current_user: Annotated[User, Depends(get_current_user)]
):
    """
    Execute CR Cube query with the provided filters.
    
    Returns project cost/budget/forecast data from Snowflake.
    Requires authentication.
    """
    settings = get_settings()
    
    # Validate limits
    if len(query_request.project_numbers) > settings.max_projects:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {settings.max_projects} projects allowed"
        )
    
    if query_request.limit > settings.max_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum limit is {settings.max_limit}"
        )
    
    logger.info(
        f"Query request from {current_user.username}: projects={query_request.project_numbers}, "
        f"start={query_request.start_month}, end={query_request.end_month}, "
        f"limit={query_request.limit}"
    )
    
    try:
        # Build the query
        sql, params = build_cr_cube_query(
            project_numbers=query_request.project_numbers,
            start_month=query_request.start_month,
            end_month=query_request.end_month,
            limit=query_request.limit
        )
        
        # Execute
        result = execute_query(sql, params)
        
        return QueryResponse(
            success=True,
            columns=result["columns"],
            rows=result["rows"],
            row_count=result["row_count"],
            query_id=result["query_id"],
            timing_ms=result["timing_ms"],
            message=f"Returned {result['row_count']} rows in {result['timing_ms']:.0f}ms"
        )
        
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects", tags=["Data"])
@limiter.limit("60/minute")
async def api_projects(
    request: Request,
    active_only: bool = Query(True, description="Filter to projects with recent activity (last 12 months)"),
    district_id: Optional[str] = Query(None, description="Filter by district ID"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get list of available projects (for dropdown population).
    Returns distinct project numbers from the data.
    Active projects are filtered by default to show only those with cost data in the last 12 months.
    Requires authentication.
    """
    logger.info(f"Fetching project list... active_only={active_only}, district_id={district_id}")

    try:
        params = []
        if active_only:
            # Get projects that have cost data in the last 12 months
            sql = """
            SELECT DISTINCT
                PE.PROJECT_NUMBER,
                PE.LEAD_DISTRICT_ID,
                PE.LEAD_DISTRICT
            FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS PE
            INNER JOIN (
                SELECT DISTINCT PROJECT_NUMBER
                FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS
                WHERE FISCAL_YEAR_MONTH_NO >= TO_CHAR(DATEADD(month, -12, CURRENT_DATE()), 'YYYYMM')
            ) CR ON PE.PROJECT_NUMBER = CR.PROJECT_NUMBER
            WHERE PE.PROJECT_NUMBER IS NOT NULL
            """
            if district_id:
                sql += " AND PE.LEAD_DISTRICT_ID = %s"
                params.append(district_id)
            sql += " ORDER BY PE.PROJECT_NUMBER LIMIT 1000"
        else:
            # Get all projects
            sql = """
            SELECT DISTINCT
                PROJECT_NUMBER,
                LEAD_DISTRICT_ID,
                LEAD_DISTRICT
            FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
            WHERE PROJECT_NUMBER IS NOT NULL
            """
            if district_id:
                sql += " AND LEAD_DISTRICT_ID = %s"
                params.append(district_id)
            sql += " ORDER BY PROJECT_NUMBER LIMIT 1000"

        result = execute_query(sql, tuple(params) if params else None)

        return {
            "success": True,
            "projects": result["rows"],
            "count": result["row_count"],
            "timing_ms": result["timing_ms"]
        }

    except Exception as e:
        logger.error(f"Failed to fetch projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cost-data", tags=["Data"])
@limiter.limit("30/minute")
async def api_cost_data(
    request: Request,
    project_numbers: str = Query(..., description="Comma-separated project numbers"),
    start_month: str = Query(..., description="Start fiscal month YYYYMM"),
    district_id: Optional[str] = Query(None, description="Optional district filter"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get cost data for projects - matches frontend expected API.
    Returns data in format: { data: [...], total_count: N, filters_applied: {...} }
    Requires authentication.
    """
    logger.info(f"Cost data request from {current_user.username}: projects={project_numbers}, start={start_month}, district={district_id}")

    # Parse comma-separated projects into list
    projects = [p.strip() for p in project_numbers.split(",") if p.strip()]

    if not projects:
        raise HTTPException(status_code=400, detail="At least one project number is required")

    # Validate project numbers are digits only
    for p in projects:
        if not p.isdigit():
            raise HTTPException(status_code=400, detail=f"Project number must be digits only: {p}")

    # Validate month format
    if not re.match(r"^\d{6}$", start_month):
        raise HTTPException(status_code=400, detail="start_month must be YYYYMM format (6 digits)")

    try:
        # Build and execute query
        sql, params = build_cr_cube_query(
            project_numbers=projects,
            start_month=start_month,
            end_month=None,
            limit=50000
        )
        result = execute_query(sql, params)

        # Transform to frontend's expected format
        return {
            "data": result["rows"],
            "total_count": result["row_count"],
            "filters_applied": {
                "project_numbers": projects,
                "start_month": start_month,
                "district_id": district_id
            }
        }

    except Exception as e:
        logger.error(f"Cost data query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/districts", tags=["Data"])
@limiter.limit("60/minute")
async def api_districts(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get list of available districts for filtering.
    Requires authentication.
    """
    logger.info("Fetching districts...")

    try:
        sql = """
        SELECT DISTINCT LEAD_DISTRICT, LEAD_DISTRICT_ID
        FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
        WHERE LEAD_DISTRICT IS NOT NULL
        ORDER BY LEAD_DISTRICT
        """
        result = execute_query(sql)
        return result["rows"]

    except Exception as e:
        logger.error(f"Failed to fetch districts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/filters", tags=["Data"])
@limiter.limit("60/minute")
async def api_filters(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get combined filter options (districts + fiscal months).
    Requires authentication.
    """
    logger.info("Fetching filter options...")

    try:
        # Get districts
        districts_sql = """
        SELECT DISTINCT LEAD_DISTRICT, LEAD_DISTRICT_ID
        FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
        WHERE LEAD_DISTRICT IS NOT NULL
        ORDER BY LEAD_DISTRICT
        """
        districts_result = execute_query(districts_sql)

        # Get fiscal months
        months_sql = """
        SELECT DISTINCT FISCAL_YEAR_MONTH_NO
        FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS
        ORDER BY FISCAL_YEAR_MONTH_NO DESC
        LIMIT 48
        """
        months_result = execute_query(months_sql)

        return {
            "districts": districts_result["rows"],
            "fiscal_months": [row["FISCAL_YEAR_MONTH_NO"] for row in months_result["rows"]]
        }

    except Exception as e:
        logger.error(f"Failed to fetch filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/wbs-data", tags=["Data"])
@limiter.limit("30/minute")
async def api_wbs_data(
    request: Request,
    project_numbers: str = Query(..., description="Comma-separated project numbers"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Maximum rows to return"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get WBS data for projects from the WBS view.
    Returns WBS structure with attributes.
    Requires authentication.
    """
    logger.info(f"WBS data request from {current_user.username}: projects={project_numbers}, limit={limit}")

    # Parse comma-separated projects into list
    projects = [p.strip() for p in project_numbers.split(",") if p.strip()]

    if not projects:
        raise HTTPException(status_code=400, detail="At least one project number is required")

    # Validate project numbers are digits only
    for p in projects:
        if not p.isdigit():
            raise HTTPException(status_code=400, detail=f"Project number must be digits only: {p}")

    try:
        start_time = time.time()
        sql, params = build_wbs_query(projects, limit)
        result = execute_query(sql, params)
        timing_ms = (time.time() - start_time) * 1000

        # Debug: log sample of USER_DEFINED_13 values for revenue calculation troubleshooting
        rows_with_multiplier = sum(1 for row in result["rows"] if row.get("USER_DEFINED_13"))
        logger.info(f"WBS data: {result['row_count']} rows, {rows_with_multiplier} have USER_DEFINED_13 (multiplier)")
        if result["rows"]:
            sample_row = result["rows"][0]
            logger.debug(f"Sample WBS row keys: {list(sample_row.keys())}")
            logger.debug(f"Sample USER_DEFINED_13: {sample_row.get('USER_DEFINED_13')}")

        return {
            "success": True,
            "columns": result["columns"],
            "rows": result["rows"],
            "row_count": result["row_count"],
            "query_id": result["query_id"],
            "timing_ms": timing_ms,
            "view_name": "PROD_ENT_CONSUMPTION.SEM_VW.WBS",
            "message": f"Returned {result['row_count']} rows in {timing_ms:.0f}ms",
            "debug": {
                "rows_with_multiplier": rows_with_multiplier
            }
        }

    except Exception as e:
        logger.error(f"WBS data query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/wbs-snapshot", tags=["Data"])
@limiter.limit("30/minute")
async def api_wbs_snapshot(
    request: Request,
    project_numbers: str = Query(..., description="Comma-separated project numbers"),
    fiscal_month: Optional[str] = Query(None, description="Optional fiscal month filter YYYYMM"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Maximum rows to return"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Get WBS Snapshot data for projects from the WBS_SNAPSHOT_FLAT_WITH_ATTRIBUTES view.
    Returns flattened hierarchy with L01-L20 levels.
    Requires authentication.
    """
    logger.info(f"WBS snapshot request from {current_user.username}: projects={project_numbers}, fiscal_month={fiscal_month}, limit={limit}")

    # Parse comma-separated projects into list
    projects = [p.strip() for p in project_numbers.split(",") if p.strip()]

    if not projects:
        raise HTTPException(status_code=400, detail="At least one project number is required")

    # Validate project numbers are digits only
    for p in projects:
        if not p.isdigit():
            raise HTTPException(status_code=400, detail=f"Project number must be digits only: {p}")

    # Validate fiscal_month format if provided
    if fiscal_month and not re.match(r"^\d{6}$", fiscal_month):
        raise HTTPException(status_code=400, detail="fiscal_month must be YYYYMM format (6 digits)")

    try:
        start_time = time.time()
        sql, params = build_wbs_snapshot_query(projects, fiscal_month, limit)
        result = execute_query(sql, params)
        timing_ms = (time.time() - start_time) * 1000

        return {
            "success": True,
            "columns": result["columns"],
            "rows": result["rows"],
            "row_count": result["row_count"],
            "query_id": result["query_id"],
            "timing_ms": timing_ms,
            "view_name": "PROD_ENT_CONSUMPTION.SEM_VW.WBS_SNAPSHOT_FLAT_WITH_ATTRIBUTES",
            "message": f"Returned {result['row_count']} rows in {timing_ms:.0f}ms"
        }

    except Exception as e:
        logger.error(f"WBS snapshot query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def get_openai_client():
    """Get configured OpenAI client."""
    import httpx

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Chat feature not configured. Set OPENAI_API_KEY in environment."
        )

    # Handle corporate SSL inspection by disabling cert verification
    # In production, configure proper CA certificates instead
    http_client = httpx.Client(verify=False)

    return OpenAI(api_key=settings.openai_api_key, http_client=http_client)


MONTH_NAMES = {
    "jan": "01", "january": "01",
    "feb": "02", "february": "02",
    "mar": "03", "march": "03",
    "apr": "04", "april": "04",
    "may": "05",
    "jun": "06", "june": "06",
    "jul": "07", "july": "07",
    "aug": "08", "august": "08",
    "sep": "09", "sept": "09", "september": "09",
    "oct": "10", "october": "10",
    "nov": "11", "november": "11",
    "dec": "12", "december": "12",
}


def get_current_month_yyyymm() -> str:
    now = time.localtime()
    return f"{now.tm_year}{str(now.tm_mon).zfill(2)}"


def parse_project_numbers(message: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\b\d{6}\b", message)))


def parse_date_range(message: str) -> Optional[dict[str, str]]:
    lower = message.lower()

    yyyymm_matches = re.findall(r"\b(20\d{2})(0[1-9]|1[0-2])\b", lower)
    if len(yyyymm_matches) >= 2:
        start = f"{yyyymm_matches[0][0]}{yyyymm_matches[0][1]}"
        end = f"{yyyymm_matches[1][0]}{yyyymm_matches[1][1]}"
        return {"start": start, "end": end}
    if len(yyyymm_matches) == 1:
        single = f"{yyyymm_matches[0][0]}{yyyymm_matches[0][1]}"
        return {"start": single, "end": single}

    quarter_match = re.search(r"\bq([1-4])\s*(20\d{2})\b", lower)
    if quarter_match:
        quarter = int(quarter_match.group(1))
        year = quarter_match.group(2)
        start_month = str((quarter - 1) * 3 + 1).zfill(2)
        end_month = str(quarter * 3).zfill(2)
        return {"start": f"{year}{start_month}", "end": f"{year}{end_month}"}

    range_match = re.search(
        r"\b(" + "|".join(MONTH_NAMES.keys()) + r")\w*\s*(20\d{2})\s*(?:to|-|through)\s*(" +
        "|".join(MONTH_NAMES.keys()) + r")\w*\s*(20\d{2})\b",
        lower
    )
    if range_match:
        start_month = MONTH_NAMES[range_match.group(1)]
        start_year = range_match.group(2)
        end_month = MONTH_NAMES[range_match.group(3)]
        end_year = range_match.group(4)
        return {"start": f"{start_year}{start_month}", "end": f"{end_year}{end_month}"}

    single_match = re.search(r"\b(" + "|".join(MONTH_NAMES.keys()) + r")\w*\s*(20\d{2})\b", lower)
    if single_match:
        month = MONTH_NAMES[single_match.group(1)]
        year = single_match.group(2)
        return {"start": f"{year}{month}", "end": f"{year}{month}"}

    year_match = re.search(r"\b(20\d{2})\b", lower)
    if year_match:
        year = year_match.group(1)
        return {"start": f"{year}01", "end": f"{year}12"}

    return None


def classify_query_type(message: str) -> str:
    lower = message.lower()
    patterns = {
        "trend": [r"trend", r"over time", r"month", r"period"],
        "variance": [r"variance", r"over budget", r"under budget", r"unfavorable", r"favorable"],
        "earned_value": [r"earned value", r"\bcpi\b", r"\bspi\b", r"percent complete"],
        "breakdown": [r"by discipline", r"by firm", r"by area", r"by phase", r"by account", r"group by"],
        "comparison": [r"compare", r"versus", r"\bvs\b", r"between"],
        "aggregation": [r"total", r"sum", r"overall", r"how much", r"budget", r"spend"],
        "fte": [r"\bfte\b", r"manhour", r"labor"],
    }
    for key, regs in patterns.items():
        if any(re.search(r, lower) for r in regs):
            return key
    return "general"


def resolve_scope(message: str, filter_hints: Optional[ChatFilterHints]) -> dict[str, Any]:
    projects = parse_project_numbers(message)
    date_range = parse_date_range(message)

    if not projects and filter_hints and filter_hints.project_numbers:
        projects = filter_hints.project_numbers

    start_month = None
    end_month = None
    if date_range:
        start_month = date_range.get("start")
        end_month = date_range.get("end")
    elif filter_hints:
        start_month = filter_hints.start_month
        end_month = filter_hints.end_month

    return {
        "projects": projects,
        "start_month": start_month,
        "end_month": end_month,
        "date_range": date_range,
    }


def _coerce_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def _root_rows(rows: list[dict]) -> list[dict]:
    root = []
    for row in rows:
        cbs = row.get("CBS_HIERARCHY")
        if cbs is None or str(cbs).strip() == "" or str(cbs).strip() == "-":
            root.append(row)
    return root if root else rows


def _apply_date_filter(rows: list[dict], date_range: Optional[dict[str, str]]) -> list[dict]:
    if not date_range:
        return rows
    start = date_range.get("start")
    end = date_range.get("end")
    filtered = []
    for row in rows:
        period = str(row.get("FISCAL_YEAR_MONTH_NO") or "")
        if start and period < start:
            continue
        if end and period > end:
            continue
        filtered.append(row)
    return filtered


def build_data_context(
    rows: list[dict],
    query_type: str,
    date_range: Optional[dict[str, str]],
    exclude_current_month: bool
) -> tuple[str, dict[str, int]]:
    if exclude_current_month:
        current = get_current_month_yyyymm()
        rows = [r for r in rows if str(r.get("FISCAL_YEAR_MONTH_NO") or "") != current]

    rows = _apply_date_filter(rows, date_range)
    top_rows = _root_rows(rows)

    projects = {str(r.get("PROJECT_NUMBER") or "") for r in rows if r.get("PROJECT_NUMBER") is not None}
    periods = {str(r.get("FISCAL_YEAR_MONTH_NO") or "") for r in rows if r.get("FISCAL_YEAR_MONTH_NO") is not None}
    coverage = {
        "rowCount": len(rows),
        "projectCount": len(projects),
        "periodCount": len(periods),
    }

    def totals() -> dict[str, float]:
        total_budget = sum(_coerce_float(r.get("CB_AMT")) for r in top_rows)
        total_spend = sum(_coerce_float(r.get("JTD_SPEND")) for r in top_rows)
        total_forecast = sum(_coerce_float(r.get("FORECAST_AMOUNT")) for r in top_rows)
        total_mh = sum(_coerce_float(r.get("JTD_MH")) for r in top_rows)
        return {
            "budget": total_budget,
            "spend": total_spend,
            "forecast": total_forecast,
            "variance": total_budget - total_forecast,
            "manhours": total_mh,
        }

    def earned_value() -> dict[str, float]:
        latest_period = max(periods) if periods else ""
        latest_rows = [r for r in top_rows if str(r.get("FISCAL_YEAR_MONTH_NO") or "") == latest_period]
        weighted_pct = 0.0
        budget_weight = 0.0
        for r in latest_rows:
            budget = _coerce_float(r.get("CB_AMT"))
            pct = _coerce_float(r.get("JTD_PERC_COMP"))
            weighted_pct += budget * pct
            budget_weight += budget
        pct_complete = (weighted_pct / budget_weight) if budget_weight else 0.0
        total_budget = sum(_coerce_float(r.get("CB_AMT")) for r in top_rows)
        total_spend = sum(_coerce_float(r.get("JTD_SPEND")) for r in top_rows)
        ev = (pct_complete / 100.0) * total_budget
        cpi = (ev / total_spend) if total_spend else 0.0
        return {
            "percent_complete": pct_complete,
            "earned_value": ev,
            "cpi": cpi,
        }

    def trend(metric_key: str) -> list[dict[str, Any]]:
        period_map: dict[str, float] = {}
        for r in top_rows:
            period = str(r.get("FISCAL_YEAR_MONTH_NO") or "")
            value = _coerce_float(r.get(metric_key))
            period_map[period] = period_map.get(period, 0.0) + value
        cumulative = 0.0
        items = []
        for period in sorted(period_map.keys()):
            value = period_map[period]
            cumulative += value
            items.append({"period": period, "value": value, "cumulative": cumulative})
        return items

    def variance_items() -> list[dict[str, Any]]:
        items = []
        for r in rows:
            variance = _coerce_float(r.get("SL_VARIANCE"))
            if variance == 0:
                continue
            items.append({
                "project": str(r.get("PROJECT_NUMBER") or ""),
                "cbs": str(r.get("CBS_HIERARCHY") or ""),
                "description": str(r.get("WBS_DESCRIPTION") or "")[:40],
                "variance": variance,
            })
        items.sort(key=lambda x: x["variance"])
        top_unfavorable = items[:5]
        top_favorable = list(reversed(items[-5:])) if len(items) >= 5 else list(reversed(items))
        combined = {f"{i['project']}-{i['cbs']}": i for i in top_unfavorable + top_favorable}
        return list(combined.values())

    def breakdown(field: str) -> list[dict[str, Any]]:
        groups: dict[str, dict[str, float]] = {}
        for r in rows:
            key = str(r.get(field) or "(No Value)")
            if key not in groups:
                groups[key] = {"spend": 0.0, "budget": 0.0, "manhours": 0.0}
            groups[key]["spend"] += _coerce_float(r.get("JTD_SPEND"))
            groups[key]["budget"] += _coerce_float(r.get("CB_AMT"))
            groups[key]["manhours"] += _coerce_float(r.get("JTD_MH"))
        sorted_groups = sorted(groups.items(), key=lambda x: x[1]["spend"], reverse=True)[:15]
        return [{"label": key, **vals} for key, vals in sorted_groups]

    totals_data = totals()
    ev_data = earned_value()

    lines = []
    lines.append("## Data Coverage")
    lines.append(f"- Rows: {coverage['rowCount']}")
    lines.append(f"- Projects: {coverage['projectCount']}")
    lines.append(f"- Periods: {coverage['periodCount']}")
    lines.append("")
    lines.append("## Summary Totals")
    lines.append(f"- Total Budget: {totals_data['budget']:.2f}")
    lines.append(f"- Total JTD Spend: {totals_data['spend']:.2f}")
    lines.append(f"- Total Forecast: {totals_data['forecast']:.2f}")
    lines.append(f"- Variance: {totals_data['variance']:.2f}")
    lines.append(f"- Total Manhours: {totals_data['manhours']:.2f}")
    lines.append("")
    lines.append("## Earned Value")
    lines.append(f"- % Complete: {ev_data['percent_complete']:.2f}")
    lines.append(f"- Earned Value: {ev_data['earned_value']:.2f}")
    lines.append(f"- CPI: {ev_data['cpi']:.2f}")
    lines.append("")

    if query_type == "trend":
        trend_rows = trend("PER_SPEND")
        lines.append("## Spend Trend (Period)")
        for item in trend_rows[:24]:
            lines.append(f"- {item['period']}: {item['value']:.2f} (cum {item['cumulative']:.2f})")
        lines.append("")
    elif query_type == "variance":
        var_items = variance_items()
        lines.append("## Top Variances")
        for item in var_items:
            lines.append(f"- {item['project']} {item['cbs']}: {item['variance']:.2f} ({item['description']})")
        lines.append("")
    elif query_type == "fte":
        trend_rows = trend("PER_MH")
        lines.append("## Manhours Trend (Period)")
        for item in trend_rows[:24]:
            lines.append(f"- {item['period']}: {item['value']:.2f} (cum {item['cumulative']:.2f})")
        lines.append("")
    elif query_type == "breakdown":
        for field, label in [
            ("D_GROUP", "Discipline"),
            ("USER_DEFINED_7", "Firm"),
            ("AREA", "Area"),
            ("PHASE", "Phase"),
            ("ACCOUNT_CODE", "Account"),
        ]:
            items = breakdown(field)
            if items:
                lines.append(f"## Breakdown by {label}")
                for item in items:
                    lines.append(f"- {item['label']}: Spend {item['spend']:.2f}, Budget {item['budget']:.2f}, MH {item['manhours']:.2f}")
                lines.append("")
                break

    return "\n".join(lines), coverage


def merge_cost_with_wbs(cost_rows: list[dict], wbs_rows: list[dict]) -> list[dict]:
    wbs_map = {row.get("WBS_ELEMENT"): row for row in wbs_rows if row.get("WBS_ELEMENT")}
    merged = []
    for row in cost_rows:
        wbs = wbs_map.get(row.get("WBS_ELEMENT"))
        merged_row = dict(row)
        if wbs:
            multiplier_raw = wbs.get("USER_DEFINED_13")
            try:
                multiplier = float(multiplier_raw) if multiplier_raw is not None else None
            except Exception:
                multiplier = None
            merged_row.update({
                "AREA": wbs.get("AREA"),
                "PHASE": wbs.get("PHASE"),
                "D_GROUP": wbs.get("D-GROUP"),
                "ACCOUNT_CODE_DESCRIPTION": wbs.get("ACCOUNT_CODE_DESCRIPTION"),
                "USER_DEFINED_7": wbs.get("USER_DEFINED_7"),
                "DISTRICT_SPECIFIC_TAG_16": wbs.get("DISTRICT_SPECIFIC_TAG_16"),
                "DISTRICT_SPECIFIC_TAG_19": wbs.get("DISTRICT_SPECIFIC_TAG_19"),
                "USER_DEFINED_12": wbs.get("USER_DEFINED_12"),
                "MULTIPLIER": multiplier,
                "TAG23": wbs.get("TAG23"),
                "TAG25": wbs.get("TAG25"),
            })
        merged.append(merged_row)
    return merged


def get_system_prompt(data_context: str, filter_hints: Optional[ChatFilterHints], user_query: str) -> str:
    """Build the system prompt with data context."""
    hints_json = json.dumps(filter_hints.dict() if filter_hints else {}, indent=2)
    return f"""You are a cost analyst assistant for construction project cost management. Be direct and professional.

## Data Context
{data_context}

## Filter Hints (Not Constraints)
{hints_json}

## Available Data Fields

When the user asks for breakdowns or groupings, the following fields are available:
- **D_GROUP (Discipline):** Engineering disciplines like STRUCTURES, CIVIL, ELECTRICAL, MECHANICAL, PIPING, INSTRUMENTATION
- **USER_DEFINED_7 (Firm):** Vendor/contractor/firm names
- **AREA:** Project area designations
- **PHASE:** Project phases
- **ACCOUNT_CODE:** Cost account codes

If the user asks for a breakdown "by discipline" or "by firm", the context data above includes that breakdown.

## Response Format Guidelines

CRITICAL FORMATTING RULES:
1. Headers must be SHORT (2-4 words max)
2. Always put a BLANK LINE after every heading
3. Always put a BLANK LINE before and after tables
4. Each table row on its own line

**Response Structure:**

### Summary

(2-3 sentences max - blank line above this text is required)

### Data

| Col1 | Col2 |
|------|------|
| val  | val  |

### Insights

- Point 1
- Point 2

**GOOD header examples:** "Summary", "Cost Status", "Insights", "FTE Analysis"
**BAD header examples:** "Executive Summary of Project Cost Status", "Monthly Spend Analysis for 2024"

## Response Rules
1. **No fluff** - Skip "Great question!" or "Let me analyze..."
2. **Format numbers** - $1,234,567 or $1.2M. Percent: 85.2%
3. **Flag issues** - **Critical** (>10% over), **Warning** (5-10%), **Watch** (<5%)
4. **Be specific** - Reference actual project numbers and CBS codes
5. **Tables for data** - Use markdown tables for numeric comparisons
6. **Minimal formatting** - Use headers sparingly (1-2 per response max). Only bold key numbers, not phrases.
7. **Plain text preferred** - Use plain text for explanations. Reserve bold/headers for emphasis.
8. **No redundant structure** - Don't add headers if a simple sentence suffices.

## Key Terms
CB=Current Budget, JTD=Job-to-Date, Fcst=Forecast, Var=Variance (+favorable/-unfavorable), CBS=Cost Breakdown, PF=Performance Factor (>1=unfavorable), CF=Cost Factor (>1=over budget)

## Output Format (JSON Only)
Return a single JSON object with these fields:
- "answer": string (empty if you need clarification)
- "confidence": "high" | "medium" | "low"
- "needs_clarification": boolean
- "clarifying_question": string | null
- "chart_request": object | null

If the question requests a chart or visualization, set "chart_request" to:
{{
  "type": "spend-trend" | "earned-value" | "project-comparison" | "budget-pie" | "variance",
  "metric": string | null,
  "groupBy": string | null,
  "projects": string[] | null,
  "dateRange": {{ "start": "YYYYMM", "end": "YYYYMM" }} | null
}}

Never include any text outside the JSON object.

## FTE (Full-Time Equivalent) Calculations

**Definition:** FTE = Full-Time Equivalent, representing one person's full workload.

**Default Assumptions:**
- 1 FTE = 1 person working 8 hours/day, 5 days/week
- Weekly manhours per FTE = 8 hours × 5 days = 40 manhours
- Example: 4 FTEs per week = 4 × 8 × 5 = 160 manhours

**Average Rate Calculation:**
- Average Rate = JTD Spend ÷ JTD Manhours (JTD_SPEND / JTD_MH)
- This represents the blended hourly cost across all labor

**REQUIRED when user asks about FTEs:**
1. State the work schedule assumptions being used (default: 8 hrs/day, 5 days/week)
2. Ask user to confirm if these assumptions are correct, or if they want to override
3. Show the Average Rate being used with the calculation: "Average Rate = $X (JTD Spend $Y ÷ JTD Manhours Z)"
4. Explain what the average rate represents (blended rate across labor categories)
5. Allow user to override the average rate if they have a specific rate to use

**FTE Conversion Formulas:**
- Manhours to FTEs: FTEs = Manhours ÷ (hours_per_day × days_per_week)
- FTEs to Manhours: Manhours = FTEs × hours_per_day × days_per_week
- FTE Cost: Cost = FTEs × hours_per_day × days_per_week × Average_Rate"""


@app.post("/api/chat", response_model=ChatResponse, tags=["AI"])
@limiter.limit("20/minute")
async def api_chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Chat with AI about the cost data using OpenAI GPT-4.
    Requires authentication.
    """
    logger.info(f"Chat request from {current_user.username}: {chat_request.message[:100]}...")

    try:
        client = get_openai_client()

        settings = get_settings()
        scope = resolve_scope(chat_request.message, chat_request.filter_hints)
        projects = scope["projects"]
        start_month = scope["start_month"]
        end_month = scope["end_month"]
        date_range = scope["date_range"]

        if not projects:
            return ChatResponse(
                success=True,
                answer="",
                confidence="low",
                needs_clarification=True,
                clarifying_question="Which project number(s) should I use for this analysis?",
                data_coverage={"rowCount": 0, "projectCount": 0, "periodCount": 0},
                chart_request=None
            )

        if not start_month:
            return ChatResponse(
                success=True,
                answer="",
                confidence="low",
                needs_clarification=True,
                clarifying_question="What fiscal month or date range should I use (e.g., 202401 or Jan 2024 to Dec 2024)?",
                data_coverage={"rowCount": 0, "projectCount": 0, "periodCount": 0},
                chart_request=None
            )

        if len(projects) > settings.max_projects:
            return ChatResponse(
                success=False,
                answer="",
                confidence="low",
                needs_clarification=True,
                clarifying_question=f"Please narrow the request to {settings.max_projects} projects or fewer.",
                data_coverage={"rowCount": 0, "projectCount": 0, "periodCount": 0},
                chart_request=None,
                error=f"Maximum {settings.max_projects} projects allowed"
            )

        sql, params = build_cr_cube_query(
            project_numbers=projects,
            start_month=start_month,
            end_month=end_month,
            limit=settings.max_limit
        )
        cost_result = execute_query(sql, params)

        wbs_sql, wbs_params = build_wbs_query(projects, limit=100000)
        wbs_result = execute_query(wbs_sql, wbs_params)

        merged_rows = merge_cost_with_wbs(cost_result["rows"], wbs_result["rows"])
        query_type = classify_query_type(chat_request.message)

        exclude_current = chat_request.context_prefs.exclude_current_month if chat_request.context_prefs else False
        data_context, coverage = build_data_context(
            merged_rows,
            query_type=query_type,
            date_range=date_range,
            exclude_current_month=exclude_current
        )

        messages = [{"role": "system", "content": get_system_prompt(data_context, chat_request.filter_hints, chat_request.message)}]
        for msg in chat_request.history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": chat_request.message})

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_completion_tokens=900,
            temperature=0.2
        )

        assistant_response = response.choices[0].message.content or ""
        logger.info(f"Chat response generated: {len(assistant_response)} chars")

        try:
            parsed = json.loads(assistant_response)
        except Exception:
            extracted = None
            if "{" in assistant_response and "}" in assistant_response:
                extracted = assistant_response[assistant_response.find("{"):assistant_response.rfind("}") + 1]
            if extracted:
                try:
                    parsed = json.loads(extracted)
                except Exception:
                    parsed = None
            else:
                parsed = None
            if parsed is None:
                parsed = {
                    "answer": assistant_response.strip(),
                    "confidence": "medium",
                    "needs_clarification": False,
                    "clarifying_question": None,
                    "chart_request": None,
                }

        confidence = str(parsed.get("confidence", "medium")).lower()
        needs_clarification = bool(parsed.get("needs_clarification"))
        clarifying_question = parsed.get("clarifying_question")
        answer = parsed.get("answer") or ""

        if confidence == "low" or needs_clarification:
            answer = ""
            needs_clarification = True
            if not clarifying_question:
                clarifying_question = "Can you clarify the scope (projects and date range) you want to analyze?"

        return ChatResponse(
            success=True,
            answer=answer,
            confidence=confidence if confidence in ("high", "medium", "low") else "medium",
            needs_clarification=needs_clarification,
            clarifying_question=clarifying_question,
            data_coverage=coverage,
            chart_request=parsed.get("chart_request")
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            success=False,
            answer="",
            confidence="low",
            needs_clarification=True,
            clarifying_question="I hit an error while analyzing the data. Can you retry or narrow the request?",
            data_coverage={"rowCount": 0, "projectCount": 0, "periodCount": 0},
            error=f"AI service error: {str(e)}"
        )


@app.post("/api/chat/stream", tags=["AI"])
@limiter.limit("20/minute")
async def api_chat_stream(
    request: Request,
    chat_request: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Stream chat responses from AI for better UX.
    Returns Server-Sent Events with incremental response.
    Requires authentication.
    """
    logger.info(f"Streaming chat request from {current_user.username}: {chat_request.message[:100]}...")

    async def generate():
        try:
            response = await api_chat(request, chat_request, current_user)
            if not response.success:
                yield f"data: [ERROR] {response.error or 'Chat error'}\n\n"
                return

            content = response.clarifying_question if response.needs_clarification else response.answer
            for token in content.split(" "):
                yield f"data: {token} \n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/api/voice/transcribe", tags=["Voice"])
@limiter.limit("30/minute")
async def api_voice_transcribe(
    request: Request,
    audio: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Transcribe audio to text using OpenAI Whisper.
    Accepts audio files (webm, mp3, wav, etc.)
    Requires authentication.
    """
    logger.info(f"Transcribe request from {current_user.username}: {audio.filename}, {audio.content_type}")

    try:
        client = get_openai_client()

        # Read audio content
        audio_content = await audio.read()

        # Create a file-like object for OpenAI
        audio_file = io.BytesIO(audio_content)
        audio_file.name = audio.filename or "audio.webm"

        # Transcribe using Whisper
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )

        logger.info(f"Transcribed: {transcript[:100]}...")

        return {"success": True, "text": transcript}

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice/synthesize", tags=["Voice"])
@limiter.limit("30/minute")
async def api_voice_synthesize(
    request: Request,
    text: str = Form(...),
    voice: str = Form(default="alloy"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Convert text to speech using OpenAI TTS.
    Available voices: alloy, echo, fable, onyx, nova, shimmer.
    Requires authentication.
    """
    logger.info(f"Synthesize request from {current_user.username}: {len(text)} chars, voice={voice}")

    try:
        client = get_openai_client()

        # Generate speech
        response = client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
            response_format="mp3"
        )

        # Get audio bytes
        audio_bytes = response.content

        logger.info(f"Generated audio: {len(audio_bytes)} bytes")

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=response.mp3"
            }
        )

    except Exception as e:
        logger.error(f"Synthesis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def get_voice_system_instructions(data_context: str) -> str:
    """Build voice-optimized system prompt for conversational responses."""
    return f"""You are an enthusiastic and knowledgeable cost analyst assistant. You speak with energy and confidence about construction project costs.

## Data Context
{data_context}

## VOICE PERSONALITY
- Speak at a BRISK, ENERGETIC pace - be snappy and engaging
- Sound confident and upbeat, like a trusted advisor who's excited to help
- Use dynamic intonation - don't be monotone
- Be warm but efficient - get to the point quickly

## CRITICAL VOICE GUIDELINES
1. **Ultra-concise** - 1-2 punchy sentences per response, 3 max for complex topics
2. **Speak naturally** - No bullet points, markdown, or tables
3. **Round numbers aggressively** - "about 2 million" not "approximately 2.3 million dollars"
4. **Be decisive** - "You're 5% under budget - great news!" not "It appears you may be slightly under budget"

## When Asked About Charts
- Say "Here's that chart!" or "Let me show you" and call show_chart
- DO NOT describe chart data - the visual speaks for itself

## Number Shortcuts
- Under $100K: "about 50 grand" or "around 80K"
- $100K-$1M: "half a million" or "about 800K"
- $1M+: "2 million" or "about 15 mil"
- Percentages: "85 percent" or "just over 90"

## Response Style
- Lead with the insight: "Good news - you're tracking under budget!"
- Be direct: "The forecast looks solid" not "Based on my analysis of the data..."
- Flag issues clearly: "Heads up - labor costs are running hot"
- Keep energy high throughout

## Key Terms (speak casually)
- Budget = what you planned for
- Spend = what you've spent
- Forecast = where you're headed
- Variance = the gap (positive is good)
- JTD = total spent so far"""


def get_voice_tools() -> list[dict]:
    """Define available tools for voice interactions."""
    return [
        {
            "type": "function",
            "name": "show_chart",
            "description": "Display a chart to the user. Use this when the user asks to see or visualize data. Available chart types: spend-trend (monthly spending over time), variance (budget vs actual comparison), project-comparison (compare multiple projects), budget-pie (budget allocation breakdown), earned-value (EV analysis with CPI/SPI)",
            "parameters": {
                "type": "object",
                "properties": {
                    "chart_type": {
                        "type": "string",
                        "enum": ["spend-trend", "variance", "project-comparison", "budget-pie", "earned-value"],
                        "description": "The type of chart to display"
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional title for the chart"
                    }
                },
                "required": ["chart_type"]
            }
        },
        {
            "type": "function",
            "name": "get_executive_summary",
            "description": "Get a refreshed executive summary of the current cost data. Use when the user asks for an overview or status update.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "type": "function",
            "name": "end_voice_session",
            "description": "End the voice conversation. Use when the user says goodbye, thanks, or indicates they're done.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    ]


@app.post("/api/voice/realtime-token", response_model=RealtimeTokenResponse, tags=["Voice"])
@limiter.limit("10/minute")
async def api_voice_realtime_token(
    request: Request,
    token_request: RealtimeTokenRequest,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Generate an ephemeral token for OpenAI Realtime API.

    This endpoint creates a short-lived session token that the frontend
    uses to establish a WebRTC connection directly with OpenAI.
    The main API key is never exposed to the client.
    Requires authentication.
    """
    import httpx

    logger.info(f"Generating realtime session token for {current_user.username}...")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice feature not configured. Set OPENAI_API_KEY in environment."
        )

    # Build session configuration
    config = token_request.session_config or RealtimeSessionConfig()

    session_payload = {
        "model": "gpt-4o-realtime-preview-2024-12-17",
        "voice": config.voice,
        "instructions": get_voice_system_instructions(token_request.data_context),
        "tools": get_voice_tools(),
        "tool_choice": "auto",
        "temperature": config.temperature,
        "input_audio_transcription": {
            "model": "whisper-1"
        },
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.65,           # Higher = less sensitive to background noise (0.0-1.0)
            "prefix_padding_ms": 400,    # Audio to include before speech detected
            "silence_duration_ms": 1200, # Wait 1.2s of silence before ending turn
            "create_response": True      # Auto-create response when turn ends
        }
    }

    try:
        # Request ephemeral token from OpenAI
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/sessions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json=session_payload,
                timeout=30.0
            )

            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"OpenAI realtime session error: {response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create realtime session: {error_detail}"
                )

            data = response.json()

            logger.info(f"Realtime session created: {data.get('id', 'unknown')}")

            return RealtimeTokenResponse(
                client_secret=data["client_secret"]["value"],
                session_id=data["id"],
                expires_at=data["client_secret"]["expires_at"],
                voice=config.voice
            )

    except httpx.RequestError as e:
        logger.error(f"Network error creating realtime session: {e}")
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except KeyError as e:
        logger.error(f"Unexpected response format from OpenAI: {e}")
        raise HTTPException(status_code=502, detail=f"Unexpected response from OpenAI API: missing key {e}")
    except Exception as e:
        logger.error(f"Unexpected error creating realtime session: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {type(e).__name__}: {str(e)}")


# ============================================================================
# Custom Voice Endpoints
# ============================================================================

@app.get("/api/voice/custom/eligibility", response_model=CustomVoiceEligibilityResponse, tags=["Voice"])
@limiter.limit("10/minute")
async def api_custom_voice_eligibility(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Check if the OpenAI account is eligible for custom voice creation.

    Custom voices require approval from OpenAI. This endpoint checks
    eligibility before allowing users to start the voice creation flow.
    Requires authentication.
    """
    import httpx

    logger.info(f"Checking custom voice eligibility for {current_user.username}...")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice feature not configured. Set OPENAI_API_KEY in environment."
        )

    try:
        async with httpx.AsyncClient(verify=False) as client:
            # Check eligibility by attempting to list voice models
            # or use a dedicated eligibility endpoint if available
            response = await client.get(
                "https://api.openai.com/v1/audio/voices",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                timeout=30.0
            )

            if response.status_code == 403:
                return CustomVoiceEligibilityResponse(
                    eligible=False,
                    message="Custom voices require OpenAI approval. Contact sales@openai.com to request access."
                )

            if response.status_code == 200:
                return CustomVoiceEligibilityResponse(
                    eligible=True,
                    message="Your account is eligible to create custom voices."
                )

            # For other status codes, assume not eligible but allow to try
            return CustomVoiceEligibilityResponse(
                eligible=True,
                message="Eligibility check inconclusive. You may try creating a custom voice."
            )

    except httpx.RequestError as e:
        logger.error(f"Network error checking eligibility: {e}")
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"Error checking eligibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice/custom/consent", response_model=CustomVoiceConsentResponse, tags=["Voice"])
@limiter.limit("5/minute")
async def api_custom_voice_consent(
    request: Request,
    audio: UploadFile = File(...),
    language_tag: str = Form(default="en-US"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Upload consent recording for custom voice creation.

    The user must read the exact consent phrase:
    "I agree to have my voice used to create a synthetic voice."

    Audio formats: webm, wav, mp3, ogg (max 10MB).
    Requires authentication.
    """
    import httpx

    logger.info(f"Processing consent recording from {current_user.username}: {audio.filename}, language={language_tag}, content_type={audio.content_type}")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice feature not configured. Set OPENAI_API_KEY in environment."
        )

    # Validate file size (10MB max)
    content = await audio.read()
    content_size_kb = len(content) / 1024
    logger.info(f"Consent audio size: {content_size_kb:.1f} KB")

    if len(content) < 1024:  # Less than 1KB is too small
        raise HTTPException(
            status_code=422,
            detail="Audio file too small. Please record the full consent phrase."
        )

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum size is 10MB.")

    # Validate file type (check base type, ignoring codec suffixes like ;codecs=opus)
    valid_base_types = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/x-wav']
    if audio.content_type:
        base_type = audio.content_type.split(';')[0].strip()
        if base_type not in valid_base_types:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid audio format. Supported: webm, wav, mp3, ogg. Got: {audio.content_type}"
            )

    try:
        async with httpx.AsyncClient(verify=False) as client:
            # Upload consent to OpenAI custom voice API
            # Note: Custom voices require OpenAI approval - contact sales@openai.com
            # API Reference: https://platform.openai.com/docs/api-reference/audio/
            files = {
                'file': (audio.filename or 'consent.webm', content, audio.content_type or 'audio/webm')
            }
            data = {
                'language_tag': language_tag
            }

            response = await client.post(
                "https://api.openai.com/v1/audio/voice_consents",  # Note: underscore not hyphen
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                files=files,
                data=data,
                timeout=60.0
            )

            logger.info(f"OpenAI consent response: {response.status_code}")

            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Custom voices require OpenAI approval. Your organization must be approved for custom voice access. Contact sales@openai.com or your OpenAI account director."
                )

            if response.status_code == 404:
                error_text = response.text
                logger.error(f"OpenAI 404 response: {error_text}")
                raise HTTPException(
                    status_code=403,
                    detail="Custom voices are limited to eligible customers. Your organization does not have access to this feature. Contact OpenAI sales at sales@openai.com to request access."
                )

            if response.status_code == 422:
                error_detail = response.json().get('error', {}).get('message', 'Consent phrase not recognized')
                raise HTTPException(
                    status_code=422,
                    detail=f"Consent not recognized. Please read the exact phrase shown on screen. Error: {error_detail}"
                )

            if response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limited. Please wait a moment and try again."
                )

            if response.status_code != 200 and response.status_code != 201:
                error_detail = response.text
                logger.error(f"Consent upload failed: {response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to upload consent: {error_detail}"
                )

            result = response.json()
            consent_id = result.get('id', result.get('consent_id', 'unknown'))

            logger.info(f"Consent uploaded successfully: {consent_id}")

            return CustomVoiceConsentResponse(
                success=True,
                consent_id=consent_id,
                message="Consent recorded successfully. Proceed with voice sample."
            )

    except httpx.RequestError as e:
        logger.error(f"Network error uploading consent: {e}")
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading consent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice/custom/create", response_model=CustomVoiceCreateResponse, tags=["Voice"])
@limiter.limit("5/minute")
async def api_custom_voice_create(
    request: Request,
    audio: UploadFile = File(...),
    consent_id: str = Form(...),
    name: str = Form(...),
    language_tag: str = Form(default="en-US"),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Create a custom voice from a voice sample.

    Requires a valid consent_id from the consent endpoint.
    Audio should be 10-30 seconds of clear speech.
    Requires authentication.
    """
    import httpx

    logger.info(f"Creating custom voice for {current_user.username}: name={name}, consent_id={consent_id}")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice feature not configured. Set OPENAI_API_KEY in environment."
        )

    # Validate file size (10MB max)
    content = await audio.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum size is 10MB.")

    # Validate file type (check base type, ignoring codec suffixes like ;codecs=opus)
    valid_base_types = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/x-wav']
    if audio.content_type:
        base_type = audio.content_type.split(';')[0].strip()
        if base_type not in valid_base_types:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid audio format. Supported: webm, wav, mp3, ogg. Got: {audio.content_type}"
            )

    try:
        async with httpx.AsyncClient(verify=False) as client:
            # Create custom voice with OpenAI
            files = {
                'file': (audio.filename or 'voice_sample.webm', content, audio.content_type or 'audio/webm')
            }
            data = {
                'name': name,
                'consent_id': consent_id,
                'language_tag': language_tag
            }

            response = await client.post(
                "https://api.openai.com/v1/audio/voices",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                files=files,
                data=data,
                timeout=120.0  # Voice creation may take longer
            )

            logger.info(f"OpenAI voice creation response: {response.status_code}")

            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Custom voices require OpenAI approval. Your organization must be approved for custom voice access. Contact sales@openai.com"
                )

            if response.status_code == 404:
                error_text = response.text
                logger.error(f"OpenAI 404 response: {error_text}")
                raise HTTPException(
                    status_code=403,
                    detail="Custom voices are limited to eligible customers. Your organization does not have access to this feature. Contact OpenAI sales at sales@openai.com to request access."
                )

            if response.status_code == 422:
                error_detail = response.json().get('error', {}).get('message', 'Invalid voice sample')
                raise HTTPException(
                    status_code=422,
                    detail=f"Voice sample rejected: {error_detail}"
                )

            if response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limited. Please wait a moment and try again."
                )

            if response.status_code != 200 and response.status_code != 201:
                error_detail = response.text
                logger.error(f"Voice creation failed: {response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create voice: {error_detail}"
                )

            result = response.json()
            voice_id = result.get('voice_id', result.get('id', 'unknown'))

            logger.info(f"Custom voice created: {voice_id}")

            return CustomVoiceCreateResponse(
                success=True,
                voice_id=voice_id,
                name=name,
                message=f"Voice '{name}' created successfully!"
            )

    except httpx.RequestError as e:
        logger.error(f"Network error creating voice: {e}")
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/voice/custom/{voice_id}", response_model=CustomVoiceDeleteResponse, tags=["Voice"])
@limiter.limit("10/minute")
async def api_custom_voice_delete(
    request: Request,
    voice_id: str,
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """
    Delete a custom voice.

    This permanently removes the voice from OpenAI's servers.
    Requires authentication.
    """
    import httpx

    logger.info(f"Deleting custom voice for {current_user.username}: {voice_id}")

    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Voice feature not configured. Set OPENAI_API_KEY in environment."
        )

    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.delete(
                f"https://api.openai.com/v1/audio/voices/{voice_id}",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                timeout=30.0
            )

            if response.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail="Voice not found. It may have already been deleted."
                )

            if response.status_code == 403:
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized to delete this voice."
                )

            if response.status_code != 200 and response.status_code != 204:
                error_detail = response.text
                logger.error(f"Voice deletion failed: {response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to delete voice: {error_detail}"
                )

            logger.info(f"Custom voice deleted: {voice_id}")

            return CustomVoiceDeleteResponse(
                success=True,
                message="Voice deleted successfully."
            )

    except httpx.RequestError as e:
        logger.error(f"Network error deleting voice: {e}")
        raise HTTPException(status_code=503, detail=f"Network error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Query Builder
# ============================================================================

def build_wbs_query(project_numbers: list[str], limit: int) -> tuple[str, tuple]:
    """Build WBS view query."""
    placeholders = ", ".join(["%s"] * len(project_numbers))
    sql = f"""
    SELECT
        WBS_ID,
        WBS_CODE,
        WBS_ELEMENT,
        PROJECT_NUMBER,
        WBS_DESCRIPTION,
        AREA,
        PHASE,
        "D-GROUP",
        ACCOUNT_CODE,
        ACCOUNT_CODE_DESCRIPTION,
        USER_DEFINED_7,
        DISTRICT_SPECIFIC_TAG_16,
        DISTRICT_SPECIFIC_TAG_19,
        USER_DEFINED_12,
        USER_DEFINED_13,
        TAG23,
        TAG25
    FROM PROD_ENT_CONSUMPTION.SEM_VW.WBS
    WHERE PROJECT_NUMBER IN ({placeholders})
    ORDER BY CBS_SORT_ID, CBS_HIERARCHY ASC
    LIMIT {limit}
    """
    return sql, tuple(project_numbers)


def build_wbs_snapshot_query(project_numbers: list[str], fiscal_month: Optional[str], limit: int) -> tuple[str, tuple]:
    """Build WBS Snapshot query."""
    placeholders = ", ".join(["%s"] * len(project_numbers))
    month_clause = "AND FISCAL_YEAR_MONTH_NO = %s" if fiscal_month else ""
    sql = f"""
    SELECT
        WBS_ELEMENT, PROJECT_NUMBER, FISCAL_YEAR_MONTH_NO,
        WBS_ELEMENT_L01, WBS_DESCRIPTION_L01,
        WBS_ELEMENT_L02, WBS_DESCRIPTION_L02,
        WBS_ELEMENT_L03, WBS_DESCRIPTION_L03,
        WBS_ELEMENT_L04, WBS_DESCRIPTION_L04,
        WBS_ELEMENT_L05, WBS_DESCRIPTION_L05,
        CBS_HIERARCHY, AREA, PHASE, WORK_TYPE, USER_STATUS
    FROM PROD_ENT_CONSUMPTION.SEM_VW.WBS_SNAPSHOT_FLAT_WITH_ATTRIBUTES
    WHERE PROJECT_NUMBER IN ({placeholders})
    {month_clause}
    ORDER BY FISCAL_YEAR_MONTH_NO DESC, CBS_HIERARCHY ASC
    LIMIT {limit}
    """
    params = list(project_numbers) + ([fiscal_month] if fiscal_month else [])
    return sql, tuple(params)


def build_cr_cube_query(
    project_numbers: list[str],
    start_month: str,
    end_month: Optional[str],
    limit: int
) -> tuple[str, tuple]:
    """
    Build the CR Cube SQL query with safe parameter binding.

    Returns (sql_string, params_tuple)
    """
    # Build IN clause placeholders
    placeholders = ", ".join(["%s"] * len(project_numbers))

    # Build optional end month clause
    end_clause = ""
    if end_month:
        end_clause = "AND CR.FISCAL_YEAR_MONTH_NO <= %s"

    sql = f"""
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

        CURRENT_ESTIMATE_QUANTITY AS CE_QTY,
        CURRENT_BUDGET_QUANTITY AS CB_QTY,
        CURRENT_BUDGET_MHF AS CB_MHF,
        CURRENT_BUDGET_AMOUNT AS CB_AMT,
        CURRENT_BUDGET_UNIT_COST AS CB_UNIT_COST,

        QUANTITY AS PER_QTY,
        PERCENT_COMPLETE AS PER_PERC_COMP,
        MANHOURS AS PER_MH,
        MHF AS PER_MHF,
        MH_G_PER_L AS PER_MH_GL,
        UOM_PER_MH AS PER_UOM_MH,
        PF AS PER_PF,
        CF AS PER_CF,
        LEI AS PER_LEI,
        ACTUAL_COST AS PER_SPEND,
        UNIT_COST AS PER_UNIT_COST,
        ACTUAL_COST_G_PER_L,

        JTD_QUANTITY AS JTD_QTY,
        JTD_PERCENT_COMPLETE AS JTD_PERC_COMP,
        JTD_MANHOURS AS JTD_MH,
        JTD_MHF AS JTD_MHF,
        JTD_MH_G_PER_L AS JTD_MH_GL,
        JTD_UOM_PER_MH AS JTD_UOM_MH,
        JTD_PF AS JTD_PF,
        JTD_CF AS JTD_CF,
        JTD_LEI,
        JTD_ACTUAL_COST AS JTD_SPEND,
        JTD_UNIT_COST AS JTD_UNIT_COST,
        JTD_COST_G_PER_L,

        FORECAST_REMAINING_QUANTITY,
        WBS.HD_FORECAST_METHOD,
        FORECAST_REMAINING_MHF,
        FORECAST_MHF,
        FORECAST_REMAINING_MH,
        FORECAST_MH,
        FORECAST_MH_G_PER_L,
        FORECAST_REMAINING_PF,
        FORECAST_PF,
        FORECAST_REMAINING_CF,
        FORECAST_CF,
        FORECAST_REMAINING_LEI,
        FORECAST_LEI,
        FORECAST_REMAINING_UNIT_COST,
        FORECAST_UNIT_COST,
        FORECAST_REMAINING_AMOUNT,
        FORECAST_AMOUNT,
        FORECAST_AMOUNT_G_PER_L,
        FORECAST_CHANGE,
        (JTD_ACTUAL_COST/NULLIFZERO(JTD_PERCENT_COMPLETE)) - FORECAST_AMOUNT AS SL_VARIANCE

    FROM PROD_ENT_CONSUMPTION.SEM_VW.CR_CUBE_DATA_WBS CR
    LEFT JOIN PROD_ENT_CONSUMPTION.SEM_VW.WBS_SNAPSHOT WBS
        ON CR.WBS_ELEMENT = WBS.WBS_ELEMENT
        AND CR.FISCAL_YEAR_MONTH_NO = WBS.FISCAL_YEAR_MONTH_NO
    LEFT JOIN PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS PE
        ON CR.PROJECT_NUMBER = PE.PROJECT_NUMBER
    WHERE CR.PROJECT_NUMBER IN ({placeholders})
      AND CR.FISCAL_YEAR_MONTH_NO >= %s
      {end_clause}
    ORDER BY CR.FISCAL_YEAR_MONTH_NO, WBS.CBS_HIERARCHY ASC
    LIMIT {limit}
    """

    # Build params tuple
    params = list(project_numbers) + [start_month]
    if end_month:
        params.append(end_month)

    return sql, tuple(params)


# ============================================================================
# Startup Event
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Log configuration on startup."""
    settings = get_settings()
    logger.info("=" * 60)
    logger.info("Cost Scraper API Starting")
    logger.info(f"  Snowflake Account: {settings.sf_account}")
    logger.info(f"  Snowflake User: {settings.sf_user}")
    logger.info(f"  Snowflake Role: {settings.sf_role}")
    logger.info(f"  Snowflake Warehouse: {settings.sf_warehouse}")
    logger.info(f"  Allowed Origins: {get_allowed_origins()}")
    logger.info(f"  Key configured: {'Yes' if settings.sf_private_key_b64 else 'No'}")
    logger.info("=" * 60)
