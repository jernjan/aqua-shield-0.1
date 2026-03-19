#!/bin/bash
# start-servers.sh - Start both API and dashboard

echo "🚀 Starting Labridae Dashboard servers..."

# Kill existing servers
echo "⏸️  Stopping existing servers..."
get_pids_by_port() {
  netstat -ano | grep ":$1 " | awk '{print $NF}' | sort -u
}

# PowerShell version (Windows)
powershell -Command "
  \$pids = (Get-NetTCPConnection -LocalPort 8002 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { \$_.OwningProcess })
  if (\$pids) { Stop-Process -Id \$pids -Force -ErrorAction SilentlyContinue }
  \$pids = (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { \$_.OwningProcess })
  if (\$pids) { Stop-Process -Id \$pids -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
"

# Start API
echo "🟢 Starting API on port 8002..."
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API"
start python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8002

# Start Dashboard
echo "🟢 Starting Dashboard on port 8081..."
cd "c:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\14.04. NY BUILD\vessel-dashboard"
sleep 2
start python server.py

echo ""
echo "✅ Servers starting..."
echo "📊 API:       http://127.0.0.1:8002"
echo "🚢 Dashboard: http://127.0.0.1:8081"
echo ""
echo "Press any key to close this window..."
read -p ""
