#!/usr/bin/env python
"""Run EKTE_API server"""
import sys
import uvicorn
from src.api.main import app

print("Starting EKTE_API server...")
print(f"Python: {sys.version}")
print(f"Routes: {len(app.routes)}")

uvicorn.run(
    app,
    host="0.0.0.0",
    port=8000,
    log_level="info",
    reload=False
)

