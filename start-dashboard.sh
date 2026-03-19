#!/bin/bash
# Start vessels dashboard servers and test facility search

echo "=========================================="
echo "Starting Vessel Dashboard Servers"
echo "=========================================="
echo ""

# Check Python is available
if ! command -v python &> /dev/null; then
    echo "ERROR: Python not found"
    exit 1
fi

echo "Starting EKTE_API on port 8002..."
cd "EKTE_API"
./.venv/Scripts/python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8002 &
API_PID=$!
echo "API Server PID: $API_PID"
sleep 2

echo ""
echo "Starting Dashboard on port 8081..."
cd "../14.04. NY BUILD/vessel-dashboard"
python -m http.server 8081 &
DASHBOARD_PID=$!
echo "Dashboard Server PID: $DASHBOARD_PID"
sleep 2

echo ""
echo "=========================================="
echo "Servers Started"
echo "=========================================="
echo ""
echo "API URL: http://127.0.0.1:8002"
echo "Dashboard URL: http://127.0.0.1:8081"
echo ""
echo "Test Instructions:"
echo "1. Open http://127.0.0.1:8081 in your browser"
echo "2. Enter MMSI: 257051270"
echo "3. Click 'Last båt'"
echo "4. Look for facility search in right panel"
echo "5. Try searching for: Valøyan, Mannbruholmen, Grøttingsøy, Slettholmene"
echo ""
echo "Press Ctrl+C to stop servers"
echo ""

# Wait for interrupted
wait
