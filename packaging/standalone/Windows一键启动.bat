@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 电商工具箱
call corepack enable >nul 2>&1
call pnpm install --frozen-lockfile
if errorlevel 1 goto :failed
call pnpm build
if errorlevel 1 goto :failed
call pnpm standalone:start
exit /b %ERRORLEVEL%

:failed
echo.
echo 启动失败，请检查上方输出。
pause
exit /b 1
