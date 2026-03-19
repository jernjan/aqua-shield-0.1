"""
AquaShield Backend Starter Script
Run this to initialize the project for the first time
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

# Create necessary directories
directories = [
    backend_path / "logs",
    backend_path / "data",
]

for directory in directories:
    directory.mkdir(parents=True, exist_ok=True)
    print(f"✓ Created {directory}")

print("\n✅ Backend initialized!")
print("\nNext steps:")
print("1. cd backend")
print("2. python -m venv venv")
print("3. venv\\Scripts\\activate  (Windows) or source venv/bin/activate (macOS/Linux)")
print("4. pip install -r requirements.txt")
print("5. cp .env.example .env")
print("6. uvicorn app.main:app --reload")
print("\nThen in another terminal:")
print("1. cd frontend")
print("2. npm install")
print("3. npm run dev")
