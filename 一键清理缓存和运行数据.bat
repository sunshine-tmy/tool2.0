@echo off
chcp 65001 >nul
title Ecommerce Toolbox - Clear Generated Files
set "ROOT=%~dp0"

echo This will stop local project services and remove all cleanable cache, build output and runtime data.
echo It removes the local database, quarantine, task artifacts and XHS archives.
echo Dependencies, virtual environments, models, .env and sign-in state are kept.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js before running this script.
  pause
  exit /b 1
)

echo.
echo [Y] Yes: stop project services and run the full cleanup.
echo [N] No : cancel and keep all current data.
choice /C YN /N /M "Enter Y or N"
if errorlevel 2 (
  echo Cancelled. No services were stopped and no data was deleted.
  exit /b 0
)

call "%ROOT%stop.bat"
if errorlevel 1 (
  echo.
  echo Could not stop every project service. Cleanup was cancelled to avoid locked files.
  pause
  exit /b 1
)

node "%ROOT%scripts\clear-generated.mjs" --all
if errorlevel 1 (
  echo.
  echo Cleanup did not complete. Review the output above.
  pause
  exit /b 1
)

echo.
echo Cleanup completed. Dependencies, models, .env and sign-in state were kept.
pause
