@echo off
rem ===========================================================================
rem Pre-release check: run this before deploying. Stops at the first failure.
rem
rem   1. Backend tests (pytest)  - needs the Docker database running
rem   2. Frontend typecheck, lint and tests (npm run check)
rem   3. Frontend production build (npm run build)
rem
rem Stop "npm run dev" first: the build writes to the same .next folder.
rem ===========================================================================
cd /d "%~dp0"

echo.
echo [1/3] Backend tests...
pushd backend
call venv\Scripts\python.exe -m pytest -q || (popd & echo. & echo FAILED: backend tests & exit /b 1)
popd

echo.
echo [2/3] Frontend typecheck, lint and tests...
pushd frontend
call npm run check || (popd & echo. & echo FAILED: frontend checks & exit /b 1)

echo.
echo [3/3] Frontend production build...
call npm run build || (popd & echo. & echo FAILED: frontend build & exit /b 1)
popd

echo.
echo All checks passed - ready to deploy.
