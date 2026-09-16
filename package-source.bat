@echo off
REM Project source package launcher.
chcp 65001 >nul
title Ecommerce Toolbox - Package Source Code
set "ROOT=%~dp0"

echo Creating a clean source-code package...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\package-source.ps1" %*
if errorlevel 1 (
  echo.
  echo Packaging failed. Review the message above.
  pause
  exit /b 1
)

if /I "%~1"=="-Preview" exit /b 0

echo.
echo Clean source package created successfully.
start "" "%ROOT%.package"
