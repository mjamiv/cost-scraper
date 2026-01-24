"""
Configuration management for the Cost Scraper backend.
All sensitive values come from environment variables.
"""

import os
import base64
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Snowflake connection
    sf_account: str = "TB78941"
    sf_user: str = "MICHAEL.MARTELLO@KIEWIT.COM"
    sf_role: str = "PROD_KDS_CONSUMPTION_SEM_R_AR"
    sf_warehouse: str = "PROD_ENT_CONS_BI_BULK_WH"
    
    # Authentication - choose one method:
    # Option 1: Password auth (simple)
    sf_password: str = ""

    # Option 2: Key-pair auth (production)
    sf_private_key_b64: str = ""
    sf_private_key_passphrase: str = ""

    # Option 3: SSO/Browser auth (set to "externalbrowser")
    sf_authenticator: str = ""

    # OpenAI API for voice chatbot
    openai_api_key: str = ""

    # CORS
    allowed_origins: str = "http://localhost:5500,http://127.0.0.1:5500"
    
    # Query limits
    max_limit: int = 50000
    default_limit: int = 5000
    max_projects: int = 50
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


def get_private_key_bytes() -> bytes:
    """Decode base64-encoded private key."""
    settings = get_settings()
    if not settings.sf_private_key_b64:
        raise ValueError("SF_PRIVATE_KEY_B64 environment variable not set")
    return base64.b64decode(settings.sf_private_key_b64)


def get_allowed_origins() -> list[str]:
    """Parse comma-separated allowed origins."""
    settings = get_settings()
    return [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
