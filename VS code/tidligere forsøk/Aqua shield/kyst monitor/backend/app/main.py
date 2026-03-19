"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.database import engine
from app.db.models import Base
from app.db.models_vessel import Vessel, VesselObservation, VesselProximityEvent
from app.db.models_disease import DiseaseOccurrence, InfectionZone, RiskPropagation, VesselDiseaseExposure, MLTrainingData, ModelPrediction
from app.logging.logger import logger
from app.tasks.scheduler import schedule_tasks
from app.api import auth, farms, risk, alerts, dashboard, vessels, disease, research, sync


# Create tables
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    # Startup
    try:
        logger.info(f"Starting AquaShield in {settings.ENVIRONMENT} environment")
        # schedule_tasks()  # Disabled for testing
        logger.info("Startup completed successfully")
    except Exception as e:
        logger.error(f"Startup error: {e}", exc_info=True)
    yield
    # Shutdown
    try:
        logger.info("Shutting down AquaShield")
    except Exception as e:
        logger.error(f"Shutdown error: {e}", exc_info=True)


app = FastAPI(
    title="AquaShield",
    description="Aquaculture monitoring system with risk assessment",
    version="1.0.0",
    lifespan=lifespan
)


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)


# Error handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle validation errors."""
    logger.warning(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request, exc):
    """Handle database errors."""
    logger.error(f"Database error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error occurred"},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle unexpected errors."""
    logger.error(f"Unexpected error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }


# Include routers
app.include_router(auth.router)
app.include_router(farms.router)
app.include_router(risk.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(vessels.router)
app.include_router(disease.router)
app.include_router(research.router)
app.include_router(sync.router)


# Explicit OPTIONS handler for all routes to support CORS preflight
@app.options("/{full_path:path}", include_in_schema=False)
async def options_handler(full_path: str):
    """Handle CORS preflight OPTIONS requests for all routes."""
    return {"message": "ok"}


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "AquaShield",
        "description": "Aquaculture monitoring system",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
