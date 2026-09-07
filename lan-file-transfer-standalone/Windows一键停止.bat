@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo 停止失败，请查看上方提示。
) else (
  echo 停止流程已完成。
)
echo 按任意键关闭此窗口……
pause >nul
exit /b %EXIT_CODE%
