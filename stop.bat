@echo off
REM Project shutdown launcher.
chcp 65001 >nul
title Ecommerce Toolbox - Stop All Services
set "ROOT=%~dp0"

echo Stopping Ecommerce Toolbox services...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\stop-dev.ps1" %*
if errorlevel 1 (
  echo.
  echo Shutdown did not complete. Review the message above.
  pause
  exit /b 1
)

if /I "%~1"=="-CheckOnly" exit /b 0

echo.
echo All Ecommerce Toolbox services have been stopped.
ping 127.0.0.1 -n 3 >nul
