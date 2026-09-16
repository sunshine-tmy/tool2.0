"""Chatterbox 空闲模型卸载的无依赖回归测试。"""

from __future__ import annotations

import asyncio
import unittest

from worker_lifecycle import replace_idle_unload_task


class ChatterboxLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_eager_loaded_model_receives_an_idle_unload_timer(self) -> None:
        unloaded = asyncio.Event()

        async def unload() -> None:
            unloaded.set()

        task = replace_idle_unload_task(None, 10, unload)
        self.assertIsNotNone(task)
        assert task is not None
        await task
        self.assertTrue(unloaded.is_set())

    async def test_new_activity_replaces_the_previous_idle_timer(self) -> None:
        first_cancelled = asyncio.Event()
        unloaded = asyncio.Event()

        async def first_unload() -> None:
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                first_cancelled.set()
                raise

        async def next_unload() -> None:
            unloaded.set()

        first = replace_idle_unload_task(None, 10, first_unload)
        self.assertIsNotNone(first)
        # 先让协程真正开始等待，之后取消才能验证其 finally/except 清理分支。
        await asyncio.sleep(0)
        second = replace_idle_unload_task(first, 10, next_unload)
        self.assertIsNotNone(second)
        assert second is not None
        await asyncio.sleep(0)
        await second
        self.assertTrue(first_cancelled.is_set())
        self.assertTrue(unloaded.is_set())

    async def test_zero_idle_minutes_keeps_model_resident_without_a_timer(self) -> None:
        self.assertIsNone(replace_idle_unload_task(None, 0, lambda: asyncio.sleep(0)))


class ChatterboxLifecycleStartupTests(unittest.TestCase):
    def test_startup_without_a_running_event_loop_defers_timer_creation(self) -> None:
        created = False

        async def unload() -> None:
            nonlocal created
            created = True

        self.assertIsNone(replace_idle_unload_task(None, 10, unload))
        self.assertFalse(created)
