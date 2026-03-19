"""Configuration for pytest."""
import pytest
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture
def client():
    """Create test client."""
    from fastapi.testclient import TestClient
    from app.main import app
    
    return TestClient(app)
