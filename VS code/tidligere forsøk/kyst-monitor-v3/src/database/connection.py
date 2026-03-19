"""
Database connection and session management
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from src.database.models import Base

load_dotenv()

# Get database URL from .env or use default SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kyst_monitor.db")

print(f"📊 Database: {DATABASE_URL}")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False  # Set to True for SQL logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database - create all tables"""
    print("🔨 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created!")


def get_db():
    """Get database session for FastAPI dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
