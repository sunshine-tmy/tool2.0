@echo off
chcp 65001 >nul
title Ecommerce Toolbox - Clear Generated Files
set "ROOT=%~dp0"

echo 将停止本项目的本地服务，并清理全部可清理的缓存、构建产物和运行数据。
echo 将删除本地数据库、隔离区、任务产物和小红书存档；node_modules、Python 虚拟环境、模型、.env 与登录态会保留。
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node.js 后再运行此脚本。
  pause
  exit /b 1
)

choice /C YN /N /M "确认停止服务并执行全量清理"
if errorlevel 2 (
  echo 已取消，未停止服务，也未删除任何数据。
  exit /b 0
)

call "%ROOT%stop.bat"
if errorlevel 1 (
  echo.
  echo 未能停止全部项目服务，为避免出现被锁定文件，已取消清理。
  pause
  exit /b 1
)

node "%ROOT%scripts\clear-generated.mjs" --all
if errorlevel 1 (
  echo.
  echo 清理未完成，请查看上方提示。
  pause
  exit /b 1
)

echo.
echo 清理完成：全部可清理的运行数据已删除，依赖、模型、.env 与登录态未被删除。
pause
