#!/usr/bin/env python
"""Start server with full error logging."""
import sys
import logging

# Set up logging to capture everything
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('server_debug.log')
    ]
)

try:
    import uvicorn
    from app.main import app
    
    print("Starting server with debug logging...", flush=True)
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="debug"
    )
except Exception as e:
    print(f"FATAL ERROR: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
