@echo off
REM AquaShield Quick Start Script for Windows

echo.
echo 🐟 AquaShield - Aquaculture Monitoring System
echo =============================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is required but not installed.
    exit /b 1
)

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required but not installed.
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ %PYTHON_VERSION%

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION%

echo.
echo 🔧 Setting up Backend...

cd backend

if not exist "venv" (
    python -m venv venv
    echo ✅ Virtual environment created
)

call venv\Scripts\activate.bat

pip install -q -r requirements.txt
echo ✅ Backend dependencies installed

if not exist ".env" (
    copy .env.example .env
    echo ✅ Environment file created (.env^)
)

python -c "from app.db.database import engine; from app.db.models import Base; Base.metadata.create_all(bind=engine)" >nul 2>&1
echo ✅ Database initialized

cd ..

echo.
echo 🔧 Setting up Frontend...

cd frontend

if not exist "node_modules" (
    call npm install -q
    echo ✅ Frontend dependencies installed
) else (
    echo ✅ Frontend dependencies already installed
)

cd ..

echo.
echo 🚀 Setup Complete!
echo.
echo To start the application:
echo.
echo Terminal 1 - Backend:
echo   cd backend
echo   venv\Scripts\activate
echo   uvicorn app.main:app --reload
echo.
echo Terminal 2 - Frontend:
echo   cd frontend
echo   npm run dev
echo.
echo Or use Docker Compose:
echo   docker-compose up
echo.
echo 📖 Documentation:
echo   - README.md           - Overview and features
echo   - DEPLOYMENT.md       - Deployment guide
echo   - API.md              - API documentation
echo   - backend\README.md   - Backend setup
echo   - frontend\README.md  - Frontend setup
echo.
