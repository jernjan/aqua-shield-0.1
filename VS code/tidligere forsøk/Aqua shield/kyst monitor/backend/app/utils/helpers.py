"""Utility functions for the application."""
import json
from datetime import datetime
from typing import Any


def parse_json_safe(data: str, default: Any = None) -> Any:
    """Safely parse JSON string."""
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return default


def format_datetime(dt: datetime) -> str:
    """Format datetime to ISO string."""
    if dt is None:
        return None
    return dt.isoformat()


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers."""
    from math import radians, cos, sin, asin, sqrt
    
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km


def get_risk_color(risk_level: str) -> str:
    """Get color code for risk level for frontend display."""
    colors = {
        "CRITICAL": "#DC2626",  # Red
        "HIGH": "#F97316",      # Orange
        "MEDIUM": "#EAB308",    # Yellow
        "LOW": "#22C55E"        # Green
    }
    return colors.get(risk_level, "#6B7280")  # Default gray
