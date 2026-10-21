@echo off
REM Opt-in NVIDIA voice cloning setup; reuse the guarded source launcher.
setlocal
call "%~dp0start.bat" -WithCuda %*
exit /b %errorlevel%
