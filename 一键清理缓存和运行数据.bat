@echo off
chcp 65001 >nul
title Ecommerce Toolbox - Clear Generated Files
set "ROOT=%~dp0"

echo 将清理缓存、构建产物、日志和运行时生成数据。
echo node_modules、Python 虚拟环境、模型和 .env 配置会保留。
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo 未找到 Node.js，请先安装 Node.js 后再运行此脚本。
  pause
  exit /b 1
)

node "%ROOT%scripts\clear-generated.mjs"
if errorlevel 1 (
  echo.
  echo 清理未完成，请查看上方提示。
  pause
  exit /b 1
)

echo.
echo 清理完成，依赖未被删除。
pause
