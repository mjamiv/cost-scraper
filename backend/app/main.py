"""
Cost Scraper API - FastAPI backend for Snowflake data access.

Endpoints:
- GET /health - Basic health check
- GET /api/test-connection - Detailed Snowflake connection test
- POST /api/query - Execute CR Cube query with filters
- GET /api/projects - List available projects
- POST /api/chat - Chat with AI about cost data
- POST /api/voice/transcribe - Transcribe audio to text
- POST /api/voice/synthesize - Convert text to speech
"""

import logging
import time
import re
import io
import base64
import warnings
from typing import Optional, Any

# Suppress SSL warnings for corporate proxy environments
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field, field_validator
from openai import OpenAI

from app.config import get_settings, get_allowed_origins
from app.snowflake_client import test_connection, execute_query

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Cost Scraper API",
    description="API for querying Snowflake CR Cube data",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str = Field(..., min_length=1, max_length=4000, description="User's question")
    data_context: str = Field(..., description="JSON or markdown summary of the cost data")
    history: list[ChatMessage] = Field(default=[], description="Previous messages in conversation")


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    success: bool
    response: str
    error: Optional[str] = None


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Basic health check - confirms the API is running.
    Does NOT test Snowflake connection.
    """
    return HealthResponse(
        status="ok",
        message="Cost Scraper API is running"
    )


@app.get("/api/test-connection", response_model=ConnectionResponse)
async def api_test_connection():
    """
    Test Snowflake connection and return account details.
    Use this to verify key-pair authentication is working.
    """
    logger.info("Testing Snowflake connection...")
    
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


@app.post("/api/query", response_model=QueryResponse)
async def api_query(request: QueryRequest):
    """
    Execute CR Cube query with the provided filters.
    
    Returns project cost/budget/forecast data from Snowflake.
    """
    settings = get_settings()
    
    # Validate limits
    if len(request.project_numbers) > settings.max_projects:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {settings.max_projects} projects allowed"
        )
    
    if request.limit > settings.max_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum limit is {settings.max_limit}"
        )
    
    logger.info(
        f"Query request: projects={request.project_numbers}, "
        f"start={request.start_month}, end={request.end_month}, "
        f"limit={request.limit}"
    )
    
    try:
        # Build the query
        sql, params = build_cr_cube_query(
            project_numbers=request.project_numbers,
            start_month=request.start_month,
            end_month=request.end_month,
            limit=request.limit
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


@app.get("/api/projects")
async def api_projects():
    """
    Get list of available projects (for dropdown population).
    Returns distinct project numbers from the data.
    """
    logger.info("Fetching project list...")
    
    try:
        sql = """
        SELECT DISTINCT 
            PROJECT_NUMBER,
            LEAD_DISTRICT_ID,
            LEAD_DISTRICT
        FROM PROD_KDS_CONSUMPTION.SEM.PROJECT_EXPLORER_KDS
        WHERE PROJECT_NUMBER IS NOT NULL
        ORDER BY PROJECT_NUMBER
        LIMIT 1000
        """
        
        result = execute_query(sql)
        
        return {
            "success": True,
            "projects": result["rows"],
            "count": result["row_count"],
            "timing_ms": result["timing_ms"]
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cost-data")
async def api_cost_data(
    project_numbers: str = Query(..., description="Comma-separated project numbers"),
    start_month: str = Query(..., description="Start fiscal month YYYYMM"),
    district_id: Optional[str] = Query(None, description="Optional district filter")
):
    """
    Get cost data for projects - matches frontend expected API.
    Returns data in format: { data: [...], total_count: N, filters_applied: {...} }
    """
    logger.info(f"Cost data request: projects={project_numbers}, start={start_month}, district={district_id}")

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
        # Build and execute query (reuse existing function)
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


@app.get("/api/districts")
async def api_districts():
    """
    Get list of available districts for filtering.
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


@app.get("/api/filters")
async def api_filters():
    """
    Get combined filter options (districts + fiscal months).
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


def get_system_prompt(data_context: str) -> str:
    """Build the system prompt with data context."""
    return f"""You are a cost analyst assistant. Be direct and concise.

## Data
{data_context}

## Response Rules
1. **Be brief** - Answer the question directly. No preamble or filler.
2. **Use tables** for comparisons. Use valid markdown:
   ```
   | Item | Budget | Actual | Variance |
   |------|--------|--------|----------|
   | Labor | $100,000 | $95,000 | +$5,000 |
   ```
3. **Format numbers** - Currency: $1,234,567. Percent: 85.2%
4. **Flag issues** - Critical (>10%), Warning (5-10%), Watch (<5%)
5. **No fluff** - Skip intros like "Great question!" or "Let me analyze..."
6. **Expand only when asked** - Give concise answers unless user asks for detail

## Key Terms
CB=Budget, JTD=Job-to-Date, Fcst=Forecast, Var=Variance (+favorable/-unfavorable), CBS=Cost Breakdown"""


@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(request: ChatRequest):
    """
    Chat with AI about the cost data using OpenAI GPT-4.
    """
    logger.info(f"Chat request: {request.message[:100]}...")

    try:
        client = get_openai_client()

        # Build messages
        messages = [{"role": "system", "content": get_system_prompt(request.data_context)}]

        for msg in request.history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": request.message})

        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=messages,
            max_completion_tokens=1000,
            temperature=0.3
        )

        assistant_response = response.choices[0].message.content

        logger.info(f"Chat response generated: {len(assistant_response)} chars")

        return ChatResponse(
            success=True,
            response=assistant_response
        )

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            success=False,
            response="",
            error=f"AI service error: {str(e)}"
        )


@app.post("/api/chat/stream")
async def api_chat_stream(request: ChatRequest):
    """
    Stream chat responses from AI for better UX.
    Returns Server-Sent Events with incremental response.
    """
    logger.info(f"Streaming chat request: {request.message[:100]}...")

    async def generate():
        try:
            client = get_openai_client()

            messages = [{"role": "system", "content": get_system_prompt(request.data_context)}]

            for msg in request.history[-10:]:
                messages.append({"role": msg.role, "content": msg.content})

            messages.append({"role": "user", "content": request.message})

            stream = client.chat.completions.create(
                model="gpt-5.2",
                messages=messages,
                max_completion_tokens=1000,
                temperature=0.3,
                stream=True
            )

            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield f"data: {chunk.choices[0].delta.content}\n\n"

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


@app.post("/api/voice/transcribe")
async def api_voice_transcribe(audio: UploadFile = File(...)):
    """
    Transcribe audio to text using OpenAI Whisper.
    Accepts audio files (webm, mp3, wav, etc.)
    """
    logger.info(f"Transcribe request: {audio.filename}, {audio.content_type}")

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


@app.post("/api/voice/synthesize")
async def api_voice_synthesize(
    text: str = Form(...),
    voice: str = Form(default="alloy")
):
    """
    Convert text to speech using OpenAI TTS.

    Available voices: alloy, echo, fable, onyx, nova, shimmer
    """
    logger.info(f"Synthesize request: {len(text)} chars, voice={voice}")

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


# ============================================================================
# Query Builder
# ============================================================================

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
