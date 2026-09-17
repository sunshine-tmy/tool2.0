@echo off
REM Project startup launcher.
chcp 65001 >nul
title Ecommerce Toolbox - Web and Local AI Workers
set "ROOT=%~dp0"

echo Starting frontend, backend, kkFileView Office preview, and installed local AI workers...
where pwsh.exe >nul 2>nul
if errorlevel 1 (
  echo PowerShell 7 was not found; using Windows PowerShell 5.1.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-dev.ps1"
) else (
  echo Using PowerShell 7.
  pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-dev.ps1"
)
if errorlevel 1 (
  echo.
  echo Startup failed. Review the message above.
  pause
  exit /b 1
)
