"""不依赖模型框架的 Worker 生命周期辅助函数。"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine
from typing import Any


def replace_idle_unload_task(
    current: asyncio.Task[None] | None,
    idle_minutes: int,
    create_unload_task: Callable[[], Coroutine[Any, Any, None]],
) -> asyncio.Task[None] | None:
    """取消旧的空闲计时，并在模型已加载时创建新的卸载计时。

    该函数不感知具体模型，确保 eager-load 与一次生成完成后走完全相同的释放路径。0 分钟
    表示管理员明确要求常驻模型，此时不创建后台任务。
    """

    if current and not current.done():
        current.cancel()
    if idle_minutes <= 0:
        return None
    return asyncio.create_task(create_unload_task())
