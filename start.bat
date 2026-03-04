@echo off
title Tebbi - Start
cd /d "%~dp0"

echo Starting Backend and Frontend...
echo.

REM Backend على منفذ 8001 عشان لو 8000 مشغول ببرنامج تاني
echo Backend path: %~dp0backend
start "Tebbi Backend" cmd /k "pushd "%~dp0backend" && python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001"

REM Give backend time to start (increase if you get 404 on first click)
timeout /t 5 /nobreak >nul

REM Start Frontend (install with --legacy-peer-deps if no node_modules, then start)
start "Tebbi Frontend" cmd /k "pushd "%~dp0frontend" && (if not exist node_modules npm install --legacy-peer-deps) && npm start"

echo.
echo Backend: http://localhost:8001
echo Frontend: http://localhost:3000
echo.
echo Close this window or press any key to exit (backend and frontend will keep running in their own windows).
pause >nul
