#!/usr/bin/env python
"""Test app initialization."""
import sys
import traceback

try:
    print("1. Importing main app...")
    from app.main import app
    print("✓ App imported successfully")
    
    print("\n2. Checking routers...")
    route_count = 0
    for route in app.routes:
        route_count += 1
        print(f"   - {route.path} ({getattr(route, 'methods', 'N/A')})")
    print(f"✓ Total routes: {route_count}")
    
    print("\n3. Checking exception handlers...")
    print(f"   - Exception handlers: {len(app.exception_handlers)}")
    
    print("\n✓ App structure is valid")
    
except Exception as e:
    print(f"✗ ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)
