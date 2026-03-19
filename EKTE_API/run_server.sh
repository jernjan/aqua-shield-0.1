#!/bin/bash
cd "C:\Users\janin\OneDrive\Skrivebord\EKTE_API"
.\.venv\Scripts\uvicorn.exe src.api.main:app --host 127.0.0.1 --port 8001 --log-level info
