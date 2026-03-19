#!/bin/bash
# start-facility-dashboard.sh
# Start Anleggsdashboard (Facility Owner Dashboard) on port 8084

echo ""
echo "🏭 Starting Anleggsdashboard (Facility Owner Dashboard)..."
echo ""

# Stop existing server on port 8084
echo "⏸️  Stopping existing servers on port 8084..."
PID=$(lsof -ti:8084)
if [ ! -z "$PID" ]; then
  kill -9 $PID 2>/dev/null
  echo "  ✓ Stopped existing dashboard (port 8084)"
fi

sleep 1

# Start Facility Dashboard
echo ""
echo "🟢 Starting Anleggsdashboard on http://localhost:8084..."
cd "$(dirname "$0")"
python3 -m http.server 8084 &

sleep 2

echo ""
echo "✅ Anleggsdashboard is running!"
echo "   🌐 Dashboard: http://localhost:8084"
echo "   ⚠️  Make sure API is running on http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Wait for interrupt
wait
