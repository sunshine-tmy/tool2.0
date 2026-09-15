@echo off
REM 中文模块说明：项目工程文件，负责 package-source.bat
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

