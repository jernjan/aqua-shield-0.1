"""Logging configuration"""
import logging
import sys
from ..core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/aquashield.log"),
    ],
)

logger = logging.getLogger(__name__)
