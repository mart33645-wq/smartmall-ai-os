@echo off
echo Starting SmartMall AI OS...

:: Start Backend
start cmd /k "cd backend && python -m uvicorn main:app --reload --port 8010"

:: Start Frontend (using npm.cmd for Windows compatibility)
start cmd /k "cd frontend && npm.cmd run dev -- --port 3000"

echo Servers are starting!
echo Backend API Docs: http://localhost:8010/docs
echo Frontend App: http://localhost:3000
echo Assistant Workspace: http://localhost:3000/assistant
pause
