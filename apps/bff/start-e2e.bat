@echo off
REM 启动 bff（连本地 Java 后端），detached，端口 3100
set "PORT=3100"
set "BACKEND_BASE_URL=http://127.0.0.1:8080/backend"
start "luban-bff" /B cmd /c "pnpm run dev > bff-dev.log 2>&1"
