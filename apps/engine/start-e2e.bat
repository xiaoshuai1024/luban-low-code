@echo off
REM 启动 engine（vite dev，4200，proxy /api → bff 3100），detached
start "luban-engine" /B cmd /c "npx vite --port 4200 > engine-dev.log 2>&1"
