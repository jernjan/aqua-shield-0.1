#!/bin/bash

# AquaShield Quick Start Script

echo "🐟 AquaShield - Aquaculture Monitoring System"
echo "=============================================="
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

echo "✅ Python $(python3 --version 2>&1 | awk '{print $2}')"
echo "✅ Node.js $(node --version)"
echo ""

# Backend setup
echo "🔧 Setting up Backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

source venv/bin/activate || . venv/Scripts/activate

pip install -q -r requirements.txt
echo "✅ Backend dependencies installed"

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Environment file created (.env)"
fi

python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)" 2>/dev/null
echo "✅ Database initialized"

cd ..

# Frontend setup
echo ""
echo "🔧 Setting up Frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    npm install -q
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies already installed"
fi

cd ..

echo ""
echo "🚀 Setup Complete!"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend"
echo "  source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo "  uvicorn app.main:app --reload"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Or use Docker Compose:"
echo "  docker-compose up"
echo ""
echo "📖 Documentation:"
echo "  - README.md        - Overview and features"
echo "  - DEPLOYMENT.md    - Deployment guide"
echo "  - API.md           - API documentation"
echo "  - backend/README.md    - Backend setup"
echo "  - frontend/README.md   - Frontend setup"
echo ""
