@echo off
title Buvana 50th Birthday - local server
cd /d "%~dp0"
echo.
echo   Starting the 50th birthday website...
echo.
where node >nul 2>nul
if %errorlevel%==0 (
  node scripts\serve.mjs 8080 --open
  goto end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080/"
  python -m http.server 8080
  goto end
)
echo   Node.js or Python is needed to open the site.
echo   Install Node.js from https://nodejs.org and double-click this file again.
:end
pause
