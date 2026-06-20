@echo off
REM 启动 website（nuxt dev，3000），连 bff(3100)，detached
set "NUXT_PUBLIC_BFF_BASE_URL=http://localhost:3100"
set "NUXT_PUBLIC_DEFAULT_SITE_SLUG=default"
start "luban-website" /B cmd /c "npx nuxt dev --port 3000 > website-dev.log 2>&1"
