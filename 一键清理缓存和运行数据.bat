@echo off
chcp 65001 >nul
title Ecommerce Toolbox - Clear Generated Files
set "ROOT=%~dp0"

where pwsh.exe >nul 2>nul
if errorlevel 1 (
  set "PS_EXE=powershell.exe"
) else (
  set "PS_EXE=pwsh.exe"
)

call :show_message introduction
echo.

where node >nul 2>nul
if errorlevel 1 (
  call :show_message node_missing
  pause
  exit /b 1
)

call :show_message confirmation
choice /C YN /N >nul
if errorlevel 2 (
  call :show_message cancelled
  exit /b 0
)

call "%ROOT%stop.bat"
if errorlevel 1 (
  call :show_message stop_failed
  pause
  exit /b 1
)

node "%ROOT%scripts\clear-generated.mjs" --all
if errorlevel 1 (
  call :show_message cleanup_failed
  pause
  exit /b 1
)

call :show_message completed
pause
exit /b 0

:show_message
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\cleanup-message.ps1" -Message "%~1"
exit /b %ERRORLEVEL%
