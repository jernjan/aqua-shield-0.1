@echo off
set EKTE_API_DIR=C:\Users\janin\OneDrive\Skrivebord\Kyst monitor DEMO\EKTE_API
cd /d %EKTE_API_DIR%
"%EKTE_API_DIR%\.venv\Scripts\python.exe" -m uvicorn src.api.main:app --host 127.0.0.1 --port 8002
