@echo off
chcp 65001 >nul
title 本地图片与文件工具 - 独立版
setlocal
cd /d "%~dp0"
echo.
echo 本地图片与文件工具 - 独立版
echo ============================
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-windows.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo.
  echo 启动失败。错误已保存在 .runtime\launcher-error.log
) else (
  echo 启动流程已完成，服务将在后台继续运行。
)
echo.
echo 按任意键关闭此窗口……
pause >nul
exit /b %EXIT_CODE%
