@echo off
REM 中文模块说明：项目工程文件，负责 start.bat
chcp 65001 >nul
title Ecommerce Toolbox - Web and Local AI Workers
set "ROOT=%~dp0"

echo Starting frontend, backend, and installed local AI workers...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-dev.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Review the message above.
  pause
  exit /b 1
)
