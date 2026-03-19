"""Main FastAPI application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .db.database import Base, engine
from .api.routes import auth, facilities, alerts
from .utils.logger import logger

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(facilities.router)
app.include_router(alerts.router)


@app.get("/")
def read_root():
    """Health check endpoint"""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": "0.1.0",
        "status": "ok",
    }


@app.get("/health")
def health_check():
    """Health check for monitoring"""
    return {"status": "healthy"}


@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info(f"Starting {settings.APP_NAME}...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info(f"Shutting down {settings.APP_NAME}...")
