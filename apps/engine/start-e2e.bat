@echo off
REM start engine (vite dev, 5173), detached
set "VITE_API_BASE_URL=/api"
start "luban-engine" /B cmd /c "pnpm run dev > engine-dev.log 2>&1"
