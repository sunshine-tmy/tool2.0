"""Explicit backend selection and cleanup for local video inference."""

from __future__ import annotations

import os
from typing import Any


class VideoAiDeviceError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def cuda_available(torch: Any) -> bool:
    try:
        return bool(torch.cuda.is_available())
    except (AttributeError, RuntimeError):
        return False


def mps_backend_available(torch: Any) -> bool:
    try:
        return bool(torch.backends.mps.is_built() and torch.backends.mps.is_available())
    except (AttributeError, RuntimeError):
        return False


def mps_fallback_enabled(value: str | None = None) -> bool:
    setting = os.environ.get("PYTORCH_ENABLE_MPS_FALLBACK") if value is None else value
    return str(setting or "").strip().lower() in {"1", "true", "yes", "on"}


def select_device(
    torch: Any,
    configured: str,
    *,
    platform_name: str,
    prefer_mps: bool = False,
) -> str:
    """Resolve explicit devices strictly and auto-select without hiding MPS errors."""
    requested = configured.strip().lower()
    if requested == "cpu":
        return "cpu"
    if requested == "cuda":
        if not cuda_available(torch):
            raise VideoAiDeviceError("VIDEO_AI_CUDA_UNAVAILABLE", "当前设备没有可用的 CUDA 运行时")
        return "cuda"
    if requested == "mps":
        if not mps_backend_available(torch):
            raise VideoAiDeviceError("VIDEO_AI_MPS_UNAVAILABLE", "当前设备没有可用的 Apple MPS 运行时")
        if mps_fallback_enabled():
            raise VideoAiDeviceError(
                "VIDEO_AI_MPS_FALLBACK_ENABLED",
                "检测到 PyTorch MPS CPU fallback 已启用；为避免静默转到 CPU，本次任务已停止",
            )
        return "mps"
    if requested != "auto":
        raise VideoAiDeviceError("VIDEO_AI_DEVICE_INVALID", "VIDEO_AI_DEVICE 只能设置为 auto、cpu、cuda 或 mps")

    if prefer_mps and platform_name == "darwin" and mps_backend_available(torch):
        if mps_fallback_enabled():
            raise VideoAiDeviceError(
                "VIDEO_AI_MPS_FALLBACK_ENABLED",
                "检测到 PyTorch MPS CPU fallback 已启用；为避免静默转到 CPU，本次任务已停止",
            )
        return "mps"
    return "cuda" if cuda_available(torch) else "cpu"


def clear_device_cache(torch: Any, device: str | None = None) -> None:
    """Synchronize and release only caches for the selected backend(s)."""
    if device in (None, "cuda") and cuda_available(torch):
        torch.cuda.empty_cache()
    if device in (None, "mps") and mps_backend_available(torch):
        torch.mps.synchronize()
        torch.mps.empty_cache()


def execution_mode(engine: str, device: str) -> str:
    if engine == "propainter" and device == "mps":
        return "hybrid"
    return device
