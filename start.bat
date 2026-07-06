@echo off
chcp 65001 >nul
set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-dev.ps1"

pause
