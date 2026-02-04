"""
JWT Authentication module for Cost Scraper API.

Provides:
- JWT token creation and validation
- Password hashing
- Authentication dependencies for FastAPI
- API key authentication as fallback
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Annotated

from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

# API Key for service-to-service auth (optional)
API_KEY = os.getenv("API_KEY", "")
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token security
bearer_scheme = HTTPBearer(auto_error=False)


# ============================================================================
# Models
# ============================================================================

class Token(BaseModel):
    """JWT Token response model."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Data extracted from JWT token."""
    username: Optional[str] = None
    scopes: list[str] = []
    exp: Optional[datetime] = None


class User(BaseModel):
    """User model for authentication."""
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: bool = False
    scopes: list[str] = []


class UserInDB(User):
    """User model with hashed password for storage."""
    hashed_password: str


# ============================================================================
# Demo Users (Replace with database in production)
# ============================================================================

# In production, replace with database lookup
# Password for demo: "demo123"
DEMO_USERS_DB = {
    "admin": UserInDB(
        username="admin",
        email="admin@example.com",
        full_name="Administrator",
        disabled=False,
        scopes=["read", "write", "admin"],
        hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYt/YTtYmq2i"  # demo123
    ),
    "analyst": UserInDB(
        username="analyst",
        email="analyst@example.com",
        full_name="Cost Analyst",
        disabled=False,
        scopes=["read"],
        hashed_password="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYt/YTtYmq2i"  # demo123
    ),
}


# ============================================================================
# Password Functions
# ============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password for storage."""
    return pwd_context.hash(password)


# ============================================================================
# User Functions
# ============================================================================

def get_user(username: str) -> Optional[UserInDB]:
    """Get user from database by username."""
    # In production, query your database here
    if username in DEMO_USERS_DB:
        return DEMO_USERS_DB[username]
    return None


def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    """Authenticate a user with username and password."""
    user = get_user(username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# ============================================================================
# JWT Token Functions
# ============================================================================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> TokenData:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        scopes: list = payload.get("scopes", [])
        exp = payload.get("exp")
        
        if username is None:
            raise JWTError("No subject in token")
        
        return TokenData(
            username=username,
            scopes=scopes,
            exp=datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
        )
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        raise


# ============================================================================
# FastAPI Dependencies
# ============================================================================

async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    api_key: Annotated[Optional[str], Security(API_KEY_HEADER)]
) -> User:
    """
    Get the current authenticated user from JWT token or API key.
    
    This dependency can be used to protect endpoints:
        @app.get("/protected")
        async def protected_route(user: User = Depends(get_current_user)):
            return {"user": user.username}
    """
    # Check if auth is disabled (development mode)
    auth_enabled = os.getenv("AUTH_ENABLED", "true").lower() == "true"
    if not auth_enabled:
        # Return a default user in development mode
        return User(
            username="dev-user",
            email="dev@localhost",
            full_name="Development User",
            disabled=False,
            scopes=["read", "write", "admin"]
        )
    
    # Try API key first (for service-to-service auth)
    if api_key and API_KEY and api_key == API_KEY:
        return User(
            username="api-service",
            email="service@api",
            full_name="API Service Account",
            disabled=False,
            scopes=["read", "write"]
        )
    
    # Then try JWT token
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide Bearer token or API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token_data = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user(token_data.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
    
    return User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        disabled=user.disabled,
        scopes=user.scopes
    )


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get current user and verify they are active."""
    if current_user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def require_scope(required_scope: str):
    """
    Create a dependency that requires a specific scope.
    
    Usage:
        @app.delete("/admin/users/{user_id}")
        async def delete_user(
            user_id: str,
            user: User = Depends(require_scope("admin"))
        ):
            ...
    """
    async def scope_checker(
        user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if required_scope not in user.scopes and "admin" not in user.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope '{required_scope}' required"
            )
        return user
    return scope_checker


# ============================================================================
# Optional Auth (for endpoints that work with or without auth)
# ============================================================================

async def get_optional_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)],
    api_key: Annotated[Optional[str], Security(API_KEY_HEADER)]
) -> Optional[User]:
    """
    Get the current user if authenticated, otherwise return None.
    
    Useful for endpoints that have different behavior based on auth status.
    """
    try:
        return await get_current_user(credentials, api_key)
    except HTTPException:
        return None
