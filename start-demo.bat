@echo off
cd /d "%~dp0"
echo Starting database...
docker-compose up -d
echo Waiting for database to become healthy...
:waitdb
docker inspect -f "{{.State.Health.Status}}" wealth_copilot_db 2>nul | findstr /i healthy >nul || (timeout /t 3 >nul & goto waitdb)
echo Starting backend (port 8000)...
start "WIC Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && python -m app.seed && uvicorn app.main:app --reload --port 8000"
echo Starting frontend (port 3000)...
start "WIC Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 10 >nul
start http://localhost:3000
echo.
echo Demo login: test@example.com / testpass123
