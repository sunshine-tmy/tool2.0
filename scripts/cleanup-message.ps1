# 中文模块说明：一键清理脚本的中文交互文案；与 BAT 控制逻辑分离，避免 CMD 代码页误解析中文。
param(
  [Parameter(Mandatory)]
  [ValidateSet("introduction", "node_missing", "confirmation", "cancelled", "stop_failed", "cleanup_failed", "completed")]
  [string]$Message
)

# BAT 已切换到 UTF-8 控制台；显式指定输出编码，兼容 Windows PowerShell 5.1 与 PowerShell 7。
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$messages = @{
  introduction = @(
    "将停止本项目的本地服务，并清理全部可清理的缓存、构建产物和运行数据。",
    "将删除本地数据库、隔离区、任务产物和小红书存档。",
    "会保留依赖、Python 虚拟环境、模型、.env 配置与登录状态。"
  )
  node_missing = @("未找到 Node.js，请先安装 Node.js 后再运行此脚本。")
  confirmation = @(
    "",
    "请选择操作：",
    "[Y] 是：停止项目服务并执行全量清理。",
    "[N] 否：取消操作，保留当前所有数据。",
    "请按 Y 或 N 键继续。"
  )
  cancelled = @("已取消，未停止服务，也未删除任何数据。")
  stop_failed = @("未能停止全部项目服务；为避免出现被锁定文件，已取消清理。")
  cleanup_failed = @("清理未完成，请查看上方提示。")
  completed = @("清理完成：全部可清理的运行数据已删除，依赖、模型、.env 与登录状态未被删除。")
}

$messages[$Message] | ForEach-Object { Write-Host $_ }
