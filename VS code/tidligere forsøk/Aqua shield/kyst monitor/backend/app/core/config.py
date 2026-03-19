"""Configuration management for AquaShield."""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    # Database
    DATABASE_URL: str = "sqlite:///./aquashield.db"
    
    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # BarentsWatch OAuth2
    BARENTZWATCH_CLIENT_ID: Optional[str] = None
    BARENTZWATCH_CLIENT_SECRET: Optional[str] = None
    BARENTZWATCH_TOKEN_URL: str = "https://id.barentswatch.no/connect/token"
    BARENTZWATCH_API_BASE_URL: str = "https://www.barentswatch.no/bwapi/v1"
    
    # AIS API
    AIS_API_KEY: Optional[str] = None
    AIS_API_BASE_URL: str = "https://www.barentswatch.no/bwapi/v1"
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/aquashield.log"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Scheduled Tasks
    ENABLE_SCHEDULED_TASKS: bool = False
    NIGHTLY_ANALYSIS_HOUR: int = 23
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse ALLOWED_ORIGINS into list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
