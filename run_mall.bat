@echo off
echo Starting SmartMall AI OS...

start cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"
start cmd /k "cd frontend && npm run dev -- --port 3000"

echo Servers are starting!
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:3000
pause
