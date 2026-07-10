@echo off
chcp 65001 >nul
title Ecommerce Toolbox - Web and Image AI Worker
set "ROOT=%~dp0"

echo Starting frontend, backend, and local image AI worker...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\start-dev.ps1"

pause
