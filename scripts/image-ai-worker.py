#!/usr/bin/env python3
# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
"""Local-only image AI inference worker.

The worker intentionally has no upload endpoint. It only accepts paths under the configured
image-ai storage root from the trusted Fastify gateway.
"""

from __future__ import annotations

import time
import threading
import platform
import argparse
import asyncio
import atexit
import ctypes
import hashlib
import hmac
import importlib.util
import json
import os
import sys
import tempfile
import types
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parents[1]
DESKTOP_MANAGED = os.getenv("TOOLBOX_DESKTOP_MANAGED") == "1"


def load_repo_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


load_repo_env()

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("TORCH_HOME", str(ROOT / "models" / "image-ai" / "torch"))
os.environ.setdefault("U2NET_HOME", str(ROOT / "models" / "image-ai" / "rembg"))

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

Image.MAX_IMAGE_PIXELS = 100_000_000


def project_path(value: str | Path) -> Path:
    candidate = Path(value)
    return (ROOT / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()


STORAGE_ROOT = project_path(os.getenv("IMAGE_AI_STORAGE_ROOT", "storage/image-ai"))
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(STORAGE_ROOT / "cache" / "paddlex"))
if DESKTOP_MANAGED:
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    # Paddle's bundled oneDNN path currently fails on the shipped PP-OCRv5
    # inference graph on CPU. The default Paddle CPU backend works correctly.
    os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")
TRUSTED_STORAGE_ROOTS = tuple(
    dict.fromkeys(
        [
            STORAGE_ROOT,
            (ROOT / "storage" / "image-ai").resolve(),
            # pnpm --filter backend runs the API with backend/ as cwd, so a relative
            # STORAGE_ROOT=./storage currently resolves here. Keep this explicit legacy
            # project directory trusted without permitting arbitrary filesystem paths.
            (ROOT / "backend" / "storage" / "image-ai").resolve(),
        ]
    )
)
MODELS_ROOT = project_path(os.getenv("IMAGE_AI_MODELS_ROOT", "models/image-ai"))
PORT = int(os.getenv("IMAGE_AI_WORKER_PORT", "3210"))
HOST = os.getenv("IMAGE_AI_WORKER_HOST", "127.0.0.1")
WORKER_TOKEN = os.getenv("IMAGE_AI_WORKER_TOKEN", "")


def birefnet_model_path() -> Path:
    home = Path(os.environ["U2NET_HOME"])
    packaged = home / "models" / "birefnet-general" / "birefnet-general.onnx"
    if DESKTOP_MANAGED or packaged.is_file():
        return packaged
    return home / "birefnet-general.onnx"


_OCR_ALIAS_ROOT: Path | None = None
_OCR_ALIAS_PATHS: list[Path] = []


def _ascii_writable_temp_root() -> Path:
    candidates: list[Path] = []
    windows_root = os.getenv("WINDIR", r"C:\Windows")
    candidates.append(Path(windows_root) / "Temp")
    candidates.extend(Path(value) for value in (os.getenv("TEMP"), os.getenv("TMP"), tempfile.gettempdir()) if value)

    # On some Windows installations the per-user TEMP path is Unicode while
    # the volume still has an available 8.3 alias. Use it only when Windows
    # actually returns a distinct, ASCII short path.
    if os.name == "nt":
        get_short_path_name = ctypes.WinDLL("kernel32", use_last_error=True).GetShortPathNameW
        get_short_path_name.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint]
        get_short_path_name.restype = ctypes.c_uint
        for value in (os.getenv("TEMP"), os.getenv("TMP"), tempfile.gettempdir()):
            if not value:
                continue
            buffer = ctypes.create_unicode_buffer(32768)
            length = get_short_path_name(value, buffer, len(buffer))
            if length and length < len(buffer) and buffer.value.isascii():
                candidates.append(Path(buffer.value))

    seen: set[str] = set()
    for candidate in candidates:
        value = str(candidate)
        if not value.isascii() or value.casefold() in seen or not candidate.is_dir():
            continue
        seen.add(value.casefold())
        try:
            probe = Path(tempfile.mkdtemp(prefix="toolbox-ocr-probe-", dir=candidate))
            probe.rmdir()
        except OSError:
            continue
        return candidate
    raise WorkerFailure(
        "OCR_ASCII_TEMP_UNAVAILABLE",
        "Windows 没有可写的 ASCII 临时目录，无法初始化 PaddleOCR。请检查系统临时目录权限后重试。",
    )


def _create_windows_junction(link: Path, target: Path) -> None:
    """Create a directory junction without invoking a shell or requiring symlink privileges."""
    if os.name != "nt":
        raise OSError("Windows junctions are only supported on Windows")

    absolute_target = str(target.absolute())
    substitute_name = f"\\??\\{absolute_target}".encode("utf-16-le")
    print_name = absolute_target.encode("utf-16-le")
    path_buffer = substitute_name + b"\x00\x00" + print_name + b"\x00\x00"
    reparse_data_length = 8 + len(path_buffer)
    reparse_buffer = (
        (0xA0000003).to_bytes(4, "little")  # IO_REPARSE_TAG_MOUNT_POINT
        + reparse_data_length.to_bytes(2, "little")
        + b"\x00\x00"
        + b"\x00\x00"
        + len(substitute_name).to_bytes(2, "little")
        + (len(substitute_name) + 2).to_bytes(2, "little")
        + len(print_name).to_bytes(2, "little")
        + path_buffer
    )

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    create_file = kernel32.CreateFileW
    create_file.argtypes = [
        ctypes.c_wchar_p,
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.c_uint32,
        ctypes.c_void_p,
    ]
    create_file.restype = ctypes.c_void_p
    device_io_control = kernel32.DeviceIoControl
    device_io_control.argtypes = [
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.c_void_p,
        ctypes.c_uint32,
        ctypes.POINTER(ctypes.c_uint32),
        ctypes.c_void_p,
    ]
    device_io_control.restype = ctypes.c_int
    close_handle = kernel32.CloseHandle
    close_handle.argtypes = [ctypes.c_void_p]
    close_handle.restype = ctypes.c_int

    # The directory must exist before FSCTL_SET_REPARSE_POINT is issued.
    link.mkdir()
    handle = create_file(
        str(link),
        0x40000000,  # GENERIC_WRITE
        0x00000007,  # FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
        None,
        3,  # OPEN_EXISTING
        0x00200000 | 0x02000000,  # OPEN_REPARSE_POINT | BACKUP_SEMANTICS
        None,
    )
    if handle == ctypes.c_void_p(-1).value:
        error = ctypes.get_last_error()
        link.rmdir()
        raise ctypes.WinError(error)

    try:
        input_buffer = ctypes.create_string_buffer(reparse_buffer)
        returned = ctypes.c_uint32()
        success = device_io_control(
            handle,
            0x000900A4,  # FSCTL_SET_REPARSE_POINT
            input_buffer,
            len(reparse_buffer),
            None,
            0,
            ctypes.byref(returned),
            None,
        )
        if not success:
            raise ctypes.WinError(ctypes.get_last_error())
    except Exception:
        link.rmdir()
        raise
    finally:
        close_handle(handle)


def _cleanup_ocr_aliases() -> None:
    for alias in reversed(_OCR_ALIAS_PATHS):
        try:
            alias.rmdir()
        except OSError:
            pass
    _OCR_ALIAS_PATHS.clear()
    if _OCR_ALIAS_ROOT is not None:
        try:
            _OCR_ALIAS_ROOT.rmdir()
        except OSError:
            pass


def _ocr_model_path(path: Path, name: str) -> Path:
    """Keep Paddle's native Windows reader on an ASCII junction for Unicode installs."""
    global _OCR_ALIAS_ROOT
    absolute = path.absolute()
    if absolute.as_posix().isascii() or os.name != "nt":
        return absolute

    if _OCR_ALIAS_ROOT is None:
        _OCR_ALIAS_ROOT = Path(tempfile.mkdtemp(prefix="toolbox-ocr-", dir=_ascii_writable_temp_root()))
        atexit.register(_cleanup_ocr_aliases)
    alias = _OCR_ALIAS_ROOT / name
    if not alias.exists():
        _create_windows_junction(alias, absolute)
        _OCR_ALIAS_PATHS.append(alias)
    return alias


class WorkerFailure(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 503):
        super().__init__(message)
        self.code = code
        self.status = status


class LamaInpaintingModel:
    """Minimal adapter around the pinned Big-LaMa TorchScript model."""

    model: Any
    device: Any

    def __call__(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        import numpy as np
        import torch

        def tensor_input(source: Image.Image) -> Any:
            values = np.asarray(source, dtype=np.float32) / 255.0
            if values.ndim == 2:
                values = values[np.newaxis, ...]
            else:
                values = np.transpose(values, (2, 0, 1))
            _, height, width = values.shape
            padded_height = ((height + 7) // 8) * 8
            padded_width = ((width + 7) // 8) * 8
            values = np.pad(
                values,
                ((0, 0), (0, padded_height - height), (0, padded_width - width)),
                mode="symmetric",
            )
            return torch.from_numpy(values).unsqueeze(0).to(self.device)

        image_tensor = tensor_input(image)
        mask_tensor = (tensor_input(mask) > 0).to(dtype=image_tensor.dtype)
        with torch.inference_mode():
            inpainted = self.model(image_tensor, mask_tensor)
        output = inpainted[0].permute(1, 2, 0).detach().cpu().numpy()
        output = np.clip(output * 255, 0, 255).astype(np.uint8)
        return Image.fromarray(output)


def memory_bound_realesrgan(parent: Any) -> Any:
    # The upstream tile loop swallows RuntimeError and keeps a full output tensor on
    # the GPU. Accumulate on CPU and propagate failures so bounded retries are safe.
    class TiledUpsampler(parent):
        def tile_process(self) -> None:
            import math
            import torch
            batch, channel, height, width = self.img.shape
            self.output = torch.empty((batch, channel, height * self.scale, width * self.scale),
                                      dtype=self.img.dtype, device="cpu")
            count_x, count_y = math.ceil(width / self.tile_size), math.ceil(height / self.tile_size)
            for y in range(count_y):
                for x in range(count_x):
                    left, top = x * self.tile_size, y * self.tile_size
                    right, bottom = min(left + self.tile_size, width), min(top + self.tile_size, height)
                    pl, pt = max(left - self.tile_pad, 0), max(top - self.tile_pad, 0)
                    pr, pb = min(right + self.tile_pad, width), min(bottom + self.tile_pad, height)
                    with manager.status_guard:
                        manager.status["phase"] = f"图片处理 · 分块 {y * count_x + x + 1}/{count_x * count_y}"
                    with torch.inference_mode():
                        tile = self.model(self.img[:, :, pt:pb, pl:pr]).to("cpu")
                    a, b = (left - pl) * self.scale, (top - pt) * self.scale
                    self.output[:, :, top*self.scale:bottom*self.scale, left*self.scale:right*self.scale] = tile[:, :, b:b+(bottom-top)*self.scale, a:a+(right-left)*self.scale]
                    del tile
    return TiledUpsampler


class SuggestionRequest(BaseModel):
    input_path: str


class ProcessRequest(BaseModel):
    operation: Literal["watermark_remove", "enhance", "background_remove"]
    input_path: str
    output_path: str
    mask_path: str | None = None
    scale: Literal[2, 4] | None = None
    device: Literal["auto", "cpu", "cuda"] = "auto"
    request_id: str | None = None
    deployment_usage: Literal["internal-noncommercial", "commercial"] = "internal-noncommercial"


class ModelManager:
    def __init__(self) -> None:
        self.gpu_key: str | None = None
        self.gpu_model: Any = None
        self.ocr: Any = None
        self.lock = asyncio.Lock()
        self.requested_device = "auto"
        self.active_device = "cpu"
        self.device_warnings: list[str] = []
        self.status: dict[str, Any] = {}
        self.phase_times: dict[str, float] = {}
        self.phase_since = time.monotonic()
        self.status_guard = threading.Lock()
        self.current_phase = ""
        self.precision = "fp32"
        self.last_model_use = time.monotonic()

    @asynccontextmanager
    async def use_models(self):
        async with self.lock:
            try:
                yield
            finally:
                # Health/progress polling does not extend the model's idle lifetime.
                self.last_model_use = time.monotonic()

    def unload_gpu(self) -> None:
        self.gpu_key = None
        self.gpu_model = None
        import gc
        gc.collect()
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    def unload(self) -> None:
        self.unload_gpu()
        self.ocr = None
        import gc

        gc.collect()

    def phase(self, value: str) -> None:
        now = time.monotonic()
        with self.status_guard:
            if self.current_phase:
                self.phase_times[self.current_phase] = self.phase_times.get(self.current_phase, 0) + now - self.phase_since
            self.current_phase = value
            self.phase_since = now
            self.status["phase"] = value
            self.status["device"] = self.active_device

    def device(self) -> str:
        return self.active_device

    def select_device(self, requested: str) -> None:
        previous = self.active_device
        self.requested_device = requested
        self.device_warnings = []
        self.active_device = "cpu"
        if requested != "cpu":
            try:
                import torch
                if torch.cuda.is_available():
                    self.active_device = "cuda"
                elif requested == "cuda":
                    raise WorkerFailure("IMAGE_AI_CUDA_UNAVAILABLE", "NVIDIA GPU 不可用，请检查图片 GPU 能力包及显卡驱动")
                else:
                    self.device_warnings.append("GPU 运行时不可用，本次使用 CPU")
            except Exception as error:
                if requested == "cuda":
                    raise WorkerFailure("IMAGE_AI_CUDA_UNAVAILABLE", "未安装图片 GPU 推理运行时") from error
                self.device_warnings.append("未安装 GPU 推理运行时，本次使用 CPU")
        if previous != self.active_device:
            self.unload_gpu()
        if self.active_device == "cuda":
            import torch
            torch.cuda.reset_peak_memory_stats()

    def execute(self, work: Any) -> Any:
        try:
            return work()
        except Exception as error:
            code = error.code if isinstance(error, WorkerFailure) else ""
            gpu_failure = is_cuda_oom(error) or code in {"IMAGE_AI_CUDA_PROVIDER_UNAVAILABLE", "IMAGE_AI_CUDA_PROVIDER_FAILED"}
            if not gpu_failure:
                raise
            if self.requested_device != "auto" or self.active_device != "cuda":
                raise WorkerFailure("IMAGE_AI_GPU_FAILED", "GPU 推理失败或显存不足，请释放显存后重试或选择 CPU：" + safe_error(error)) from error
        # Leave the exception scope before retrying to release its GPU tensor traceback.
        self.unload_gpu()
        self.active_device = "cpu"
        self.device_warnings.append("GPU 显存或推理后端不可用，已使用同一模型在 CPU 重试一次")
        return work()

    def get_ocr(self) -> Any:
        if self.ocr is not None:
            return self.ocr
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise WorkerFailure("PADDLEOCR_UNAVAILABLE", "未安装 PaddleOCR，暂时不能生成水印智能提示") from exc

        try:
            if DESKTOP_MANAGED:
                detection_dir = _ocr_model_path(Path(os.environ["IMAGE_AI_OCR_DETECTION_MODEL_DIR"]), "detection")
                recognition_dir = _ocr_model_path(Path(os.environ["IMAGE_AI_OCR_RECOGNITION_MODEL_DIR"]), "recognition")
                if not (detection_dir / "inference.yml").is_file() or not (recognition_dir / "inference.yml").is_file():
                    raise WorkerFailure("OCR_MODELS_MISSING", "缺少已安装的 OCR 检测或识别模型")
                self.ocr = PaddleOCR(
                    text_detection_model_name="PP-OCRv5_mobile_det",
                    text_detection_model_dir=str(detection_dir),
                    text_recognition_model_name="PP-OCRv5_mobile_rec",
                    text_recognition_model_dir=str(recognition_dir),
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                    device="cpu",
                )
            else:
                self.ocr = PaddleOCR(
                    lang="ch",
                    device="cpu",
                    use_doc_orientation_classify=False,
                    use_doc_unwarping=False,
                    use_textline_orientation=False,
                )
        except TypeError:
            if DESKTOP_MANAGED:
                raise WorkerFailure("OCR_MODELS_MISSING", "当前 OCR 运行时不支持已审核的离线模型配置") from None
            self.ocr = PaddleOCR(lang="ch", use_angle_cls=False, use_gpu=False, show_log=False)
        except WorkerFailure:
            raise
        return self.ocr

    def get_lama(self) -> Any:
        if self.gpu_key == "lama":
            return self.gpu_model
        self.unload_gpu()
        self.phase("加载 LaMa 模型")
        try:
            import torch
        except ImportError as exc:
            raise WorkerFailure("LAMA_UNAVAILABLE", "未安装 LaMa 推理组件，请运行图片 AI 安装脚本") from exc
        model_path = project_path(
            os.getenv(
                "LAMA_MODEL",
                Path(os.environ["TORCH_HOME"]) / "hub" / "checkpoints" / "big-lama.pt",
            )
        )
        if not model_path.is_file():
            raise WorkerFailure("LAMA_WEIGHTS_MISSING", f"缺少 LaMa 权重：{model_path}")

        # torch.jit.load(path) delegates the path to a C++ file API that cannot open
        # Unicode Windows paths reliably. Loading through a Python binary stream keeps
        # all filesystem access Unicode-safe while preserving the official TorchScript.
        device = torch.device(self.device())
        lama = LamaInpaintingModel()
        with model_path.open("rb") as model_stream:
            lama.model = torch.jit.load(model_stream, map_location=device)
        lama.model.eval()
        lama.model.to(device)
        lama.device = device
        self.gpu_model = lama
        self.gpu_key = "lama"
        return self.gpu_model

    def get_realesrgan(self, scale: int, tile: int) -> Any:
        key = f"realesrgan-{scale}-{tile}-{self.device()}"
        if self.gpu_key == key:
            return self.gpu_model
        self.unload_gpu()
        self.phase("加载 Real-ESRGAN 模型")
        try:
            # BasicSR's optional SLURM helper can invoke a command with this
            # environment value. This desktop worker never runs under SLURM.
            os.environ.pop("SLURM_NODELIST", None)
            install_basicsr_torchvision_compat()
            from basicsr.archs.rrdbnet_arch import RRDBNet
            from realesrgan import RealESRGANer
        except ImportError as exc:
            raise WorkerFailure("REALESRGAN_UNAVAILABLE", "未安装 Real-ESRGAN 推理组件") from exc

        weight_path = Path(
            os.getenv(
                f"IMAGE_AI_REALESRGAN_X{scale}_WEIGHTS",
                MODELS_ROOT / ("RealESRGAN_x2plus.pth" if scale == 2 else "RealESRGAN_x4plus.pth"),
            )
        ).resolve()
        if not weight_path.is_file():
            raise WorkerFailure("REALESRGAN_WEIGHTS_MISSING", f"缺少 Real-ESRGAN {scale}× 权重：{weight_path}")

        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=23,
            num_grow_ch=32,
            scale=scale,
        )
        self.gpu_model = memory_bound_realesrgan(RealESRGANer)(
            scale=scale,
            model_path=str(weight_path),
            model=model,
            tile=tile,
            tile_pad=16,
            pre_pad=0,
            half=self.device() == "cuda",
            device=self.device(),
        )
        self.gpu_key = key
        return self.gpu_model

    def get_bria(self) -> tuple[Any, Any, Any]:
        if self.gpu_key == "bria-rmbg-2.0":
            return self.gpu_model
        self.unload_gpu()
        self.phase("加载 BRIA 模型")
        model_dir = Path(os.getenv("IMAGE_AI_BRIA_MODEL_DIR", MODELS_ROOT / "RMBG-2.0")).resolve()
        if not model_dir.is_dir():
            raise WorkerFailure("BRIA_WEIGHTS_MISSING", f"缺少本地 BRIA RMBG 2.0 权重：{model_dir}")
        try:
            import torch
            from torchvision import transforms
            from transformers import AutoModelForImageSegmentation
        except ImportError as exc:
            raise WorkerFailure("BRIA_UNAVAILABLE", "未安装 BRIA 推理依赖") from exc

        verify_bria_assets(model_dir)
        model = AutoModelForImageSegmentation.from_pretrained(
            str(model_dir), trust_remote_code=True, local_files_only=True
        )
        model.to(self.device()).eval()
        transform = transforms.Compose(
            [
                transforms.Resize((1024, 1024)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ]
        )
        self.gpu_model = (model, transform, torch)
        self.gpu_key = "bria-rmbg-2.0"
        return self.gpu_model

    def get_birefnet(self) -> Any:
        if self.gpu_key == "birefnet-general":
            return self.gpu_model
        self.unload_gpu()
        self.phase("加载 BiRefNet 模型")
        try:
            from rembg import new_session
        except ImportError as exc:
            raise WorkerFailure("BIREFNET_UNAVAILABLE", "未安装 rembg/BiRefNet 推理组件") from exc
        try:
            if DESKTOP_MANAGED and not birefnet_model_path().is_file():
                raise WorkerFailure("BIREFNET_WEIGHTS_MISSING", "BiRefNet 权重未安装，请前往设置安装图像模型")
            providers: list[Any] = ["CPUExecutionProvider"]
            if self.device() == "cuda":
                # torch/lib supplies the matching CUDA/cuDNN DLLs on Windows.
                import torch
                import onnxruntime as ort
                if "CUDAExecutionProvider" not in ort.get_available_providers():
                    raise WorkerFailure("IMAGE_AI_CUDA_PROVIDER_UNAVAILABLE", "缺少 CUDA ONNX 推理后端")
                providers = [("CUDAExecutionProvider", {"device_id": 0, "gpu_mem_limit": 4 * 1024**3,
                              "arena_extend_strategy": "kSameAsRequested", "cudnn_conv_algo_search": "HEURISTIC"}), "CPUExecutionProvider"]
            self.gpu_model = new_session("birefnet-general", providers=providers)
            actual = self.gpu_model.inner_session.get_providers()
            if self.device() == "cuda" and "CUDAExecutionProvider" not in actual:
                self.unload_gpu()
                raise WorkerFailure("IMAGE_AI_CUDA_PROVIDER_FAILED", "ONNX CUDA 初始化失败，请检查 CUDA/cuDNN DLL 与驱动")
        except Exception as exc:
            if isinstance(exc, WorkerFailure):
                raise
            if self.device() == "cuda":
                raise WorkerFailure("IMAGE_AI_CUDA_PROVIDER_FAILED", "BiRefNet CUDA 初始化失败：" + safe_error(exc)) from exc
            raise WorkerFailure("BIREFNET_LOAD_FAILED", "BiRefNet 加载失败：" + safe_error(exc)) from exc
        self.gpu_key = "birefnet-general"
        return self.gpu_model


manager = ModelManager()


async def release_idle_models(stopped: asyncio.Event) -> None:
    while not stopped.is_set():
        try:
            await asyncio.wait_for(stopped.wait(), timeout=5)
            return
        except asyncio.TimeoutError:
            pass
        if manager.lock.locked():
            continue
        async with manager.lock:
            if time.monotonic() - manager.last_model_use < 30:
                continue
            if manager.gpu_model is None and manager.ocr is None:
                continue
            try:
                await asyncio.to_thread(manager.unload)
            except Exception as error:
                # Retry later without terminating the Worker or interrupting the next task.
                manager.last_model_use = time.monotonic()
                print(f"[image-ai] idle model unload failed: {error}", file=sys.stderr)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    stopped = asyncio.Event()
    cleanup = asyncio.create_task(release_idle_models(stopped))
    try:
        yield
    finally:
        stopped.set()
        # Do not cancel to_thread while unloading: the model lock must remain held.
        await cleanup


app = FastAPI(title="Toolbox Image AI Worker", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.middleware("http")
async def require_worker_token(request: Request, call_next: Any) -> Any:
    if request.url.path.startswith("/diagnostics/") and request.headers.get("x-toolbox-diagnostic") != "1":
        return JSONResponse(status_code=403, content={"code": "DIAGNOSTIC_HEADER_REQUIRED"})
    if WORKER_TOKEN and not hmac.compare_digest(request.headers.get("x-toolbox-worker-token", ""), WORKER_TOKEN):
        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "error": {"code": "WORKER_AUTH_REQUIRED", "message": "Worker authentication required"},
            },
        )
    return await call_next(request)


_SHA256_CACHE: dict[tuple[str, ...], str | None] = {}


def install_basicsr_torchvision_compat() -> None:
    """Restore legacy import shims required by BasicSR 1.4.2 under pinned dependencies.

    torchvision removed its private functional_tensor module, while the public
    rgb_to_grayscale function remains API-compatible. Registering this narrow shim
    avoids downgrading the shared CUDA runtime used by the other local models.
    Importing pinned setuptools first also exposes its distutils compatibility
    shim, which BasicSR 1.4.2 imports directly on Python 3.12.
    """
    __import__("setuptools")
    module_name = "torchvision.transforms.functional_tensor"
    if module_name in sys.modules:
        return
    try:
        __import__(module_name)
        return
    except ModuleNotFoundError as error:
        if error.name != module_name:
            raise
    from torchvision.transforms.functional import rgb_to_grayscale

    compatibility_module = types.ModuleType(module_name)
    setattr(compatibility_module, "rgb_to_grayscale", rgb_to_grayscale)  # noqa: B010
    sys.modules[module_name] = compatibility_module


@app.exception_handler(WorkerFailure)
async def worker_failure_handler(_request: Request, error: WorkerFailure) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={"success": False, "error": {"code": error.code, "message": str(error)}},
    )


@app.exception_handler(Exception)
async def unexpected_failure_handler(_request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "INFERENCE_FAILED", "message": safe_error(error)}},
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    runtime = await asyncio.to_thread(runtime_info)
    device = "cuda" if runtime["cudaAvailable"] else "cpu"
    internal = os.getenv("DEPLOYMENT_USAGE", "internal-noncommercial") == "internal-noncommercial"
    models = [
        model_health(
            "lama",
            "big-lama",
            "Apache-2.0",
            "torch",
            device,
            weight_files=[Path(os.environ["TORCH_HOME"]) / "hub" / "checkpoints" / "big-lama.pt"],
        ),
        model_health(
            "real-esrgan",
            "RealESRGAN_x2plus/x4plus",
            "BSD-3-Clause",
            "realesrgan",
            device,
            weight_files=[MODELS_ROOT / "RealESRGAN_x2plus.pth", MODELS_ROOT / "RealESRGAN_x4plus.pth"],
        ),
        model_health(
            "bria-rmbg-2.0",
            "RMBG-2.0",
            "CC-BY-NC-4.0 / commercial agreement required",
            "transformers",
            device,
            allowed=internal,
            weight_files=[Path(os.getenv("IMAGE_AI_BRIA_MODEL_DIR", MODELS_ROOT / "RMBG-2.0"))],
            sha256_override=os.getenv("IMAGE_AI_BRIA_SHA256"),
        ),
        model_health(
            "birefnet-general",
            "BiRefNet-general",
            "MIT",
            "rembg",
            device,
            weight_files=[birefnet_model_path()],
        ),
        model_health("paddleocr", "PP-OCRv5", "Apache-2.0", "paddleocr", "cpu"),
    ]
    return {
        "success": True,
        "data": {
            "protocolVersion": 1,
            "available": "torchVersion" in runtime and any(item["available"] for item in models[:4]),
            "deploymentUsage": "internal-noncommercial" if internal else "commercial",
            "workerUrl": f"http://{HOST}:{PORT}",
            "models": models,
            "runtime": runtime,
        },
    }


def runtime_info() -> dict[str, Any]:
    data: dict[str, Any] = {"cudaAvailable": False, "onnxCudaAvailable": False, "platform": platform.system()}
    try:
        import torch
        data.update(torchVersion=torch.__version__, cudaVersion=torch.version.cuda or "none",
                    cudaAvailable=torch.cuda.is_available(), cudnnVersion=str(torch.backends.cudnn.version() or "none"))
        if data["cudaAvailable"]:
            data.update(gpuName=torch.cuda.get_device_name(0), totalMemoryMb=round(torch.cuda.get_device_properties(0).total_memory / 1024**2))
    except Exception as error:
        data["reason"] = safe_error(error)
    try:
        import onnxruntime as ort
        data.update(onnxVersion=ort.__version__, onnxProviders=ort.get_available_providers(),
                    onnxCudaAvailable="CUDAExecutionProvider" in ort.get_available_providers())
    except Exception as error:
        data["onnxReason"] = safe_error(error)
    if not data["cudaAvailable"]:
        data.setdefault("reason", "当前图片运行时为 CPU，或 NVIDIA 驱动不可用")
    return data


@app.get("/diagnostics/light")
async def diagnostics_light() -> dict[str, Any]:
    torch = sys.modules.get("torch")
    cuda = bool(torch.cuda.is_available()) if torch is not None else None
    requested_device = os.getenv("IMAGE_AI_DEVICE", "auto").strip().lower()
    if requested_device not in ("cpu", "cuda", "auto"):
        requested_device = "auto"
    return {
        "protocolVersion": 1,
        "requestedDevice": requested_device,
        "available": importlib.util.find_spec("torch") is not None,
        "modelLoaded": manager.gpu_model is not None or manager.ocr is not None,
        "busy": manager.lock.locked(),
        **({"cudaAvailable": cuda} if cuda is not None else {}),
    }


@app.post("/diagnostics/deep")
async def diagnostics_deep() -> dict[str, Any]:
    if manager.lock.locked():
        return {"protocolVersion": 1, "available": False, "code": "WORKER_BUSY"}
    async with manager.use_models():
        try:
            # 已加载模型不切换；否则仅加载本地 LaMa，不下载、不卸载其他模型。
            if manager.gpu_model is None:
                await asyncio.to_thread(manager.select_device, "auto")
                await asyncio.to_thread(manager.get_lama)
            return {"protocolVersion": 1, "available": True, "modelLoaded": True, "actualDevice": manager.device(),
                    "runtime": await asyncio.to_thread(runtime_info)}
        except Exception as error:
            cause = error.__cause__ or error
            code = "CUDA_OUT_OF_MEMORY" if type(cause).__name__ == "OutOfMemoryError" else "MODEL_LOAD_FAILED"
            return {"protocolVersion": 1, "available": False, "code": code}


@app.post("/unload")
async def unload() -> dict[str, Any]:
    async with manager.lock:
        await asyncio.to_thread(manager.unload)
    return {"success": True, "data": {"protocolVersion": 1, "modelLoaded": False, "busy": False}}


@app.post("/watermark/suggestions")
async def watermark_suggestions(payload: SuggestionRequest) -> dict[str, Any]:
    input_path = trusted_path(payload.input_path, must_exist=True)
    async with manager.use_models():
        result = await asyncio.to_thread(run_ocr, input_path)
    return {"success": True, "data": result}


@app.get("/progress/{request_id}")
async def progress(request_id: str) -> dict[str, Any]:
    with manager.status_guard:
        return {"success": True, "data": dict(manager.status) if manager.status.get("requestId") == request_id else {}}


@app.post("/process")
async def process(payload: ProcessRequest) -> dict[str, Any]:
    input_path = trusted_path(payload.input_path, must_exist=True)
    output_path = trusted_path(payload.output_path, must_exist=False)
    mask_path = trusted_path(payload.mask_path, must_exist=True) if payload.mask_path else None
    output_path.parent.mkdir(parents=True, exist_ok=True)
    async with manager.use_models():
        with manager.status_guard:
            manager.status = {"requestId": (payload.request_id or "")[:128], "phase": "准备推理环境"}
            manager.current_phase = ""
            manager.phase_times = {}
        started = time.monotonic()
        try:
            await asyncio.to_thread(manager.select_device, payload.device)
            if payload.operation == "watermark_remove":
                if mask_path is None:
                    raise WorkerFailure("MASK_REQUIRED", "去水印必须提供用户确认的蒙版", 422)
                result = await asyncio.to_thread(manager.execute, lambda: run_lama(input_path, mask_path, output_path))
            elif payload.operation == "enhance":
                result = await asyncio.to_thread(manager.execute, lambda: run_realesrgan(input_path, output_path, payload.scale or 2))
            else:
                result = await asyncio.to_thread(run_background_removal, input_path, output_path, payload.deployment_usage)
            manager.phase("处理完成")
            device = manager.device()
            info = {"requestedDevice": payload.device, "device": device,
                    "precision": "fp16" if device == "cuda" and payload.operation == "enhance" else "fp32",
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                    "phaseMs": {k: round(v * 1000) for k, v in manager.phase_times.items()}}
            if device == "cuda":
                import torch
                info.update(gpuName=torch.cuda.get_device_name(0))
                if result["provider"] != "birefnet-general":
                    info["peakMemoryMb"] = round(torch.cuda.max_memory_allocated() / 1024**2, 1)
            result["execution"] = info
            result["warnings"] = list(dict.fromkeys(result.get("warnings", []) + manager.device_warnings))
            return {"success": True, "data": result}
        finally:
            with manager.status_guard:
                manager.status = {}
            # Keep the model briefly for consecutive images; the idle reaper releases it later.



def run_ocr(input_path: Path) -> dict[str, Any]:
    with Image.open(input_path) as image:
        width, height = image.size
    ocr = manager.get_ocr()
    suggestions: list[dict[str, Any]] = []
    warnings: list[str] = []

    if hasattr(ocr, "predict"):
        predictions = ocr.predict(str(input_path))
        for prediction in predictions:
            data = prediction.json if hasattr(prediction, "json") else prediction
            if callable(data):
                data = data()
            result = data.get("res", data) if isinstance(data, dict) else {}
            polygons = result.get("dt_polys", [])
            scores = result.get("dt_scores", [1.0] * len(polygons))
            for polygon, score in zip(polygons, scores, strict=False):
                suggestions.append(normalized_polygon(polygon, float(score), width, height))
    else:
        predictions = ocr.ocr(str(input_path), cls=False)
        for page in predictions or []:
            for line in page or []:
                polygon = line[0]
                score = float(line[1][1]) if len(line) > 1 and line[1] else 1.0
                suggestions.append(normalized_polygon(polygon, score, width, height))

    suggestions = [item for item in suggestions if item["confidence"] >= 0.45]
    if not suggestions:
        warnings.append("未发现高置信度文字区域，可使用画笔手动标记水印")
    return {
        "width": width,
        "height": height,
        "suggestions": suggestions,
        "provider": "paddleocr",
        "model": "PP-OCRv5",
        "warnings": warnings,
    }


def run_lama(input_path: Path, mask_path: Path, output_path: Path) -> dict[str, Any]:
    model = manager.get_lama()
    with Image.open(input_path) as source, Image.open(mask_path) as mask:
        original_size = source.size
        manager.phase("图片处理")
        result = model(source.convert("RGB"), mask.convert("L"))
        # LaMa pads inputs to multiples of eight. Remove only the generated right/bottom
        # padding so watermark removal preserves the exact source dimensions.
        result = result.crop((0, 0, original_size[0], original_size[1]))
        manager.phase("写入结果")
        result.convert("RGB").save(output_path, format="PNG", optimize=True)
    return {"provider": "lama", "model": "big-lama", "warnings": []}


def run_realesrgan(input_path: Path, output_path: Path, scale: int) -> dict[str, Any]:
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise WorkerFailure("OPENCV_UNAVAILABLE", "Real-ESRGAN 需要 opencv-python-headless") from exc
    # Gateway uploads deliberately use random .bin names. Decode from verified bytes instead
    # of relying on a filename extension; np.fromfile also handles Unicode Windows paths.
    encoded = np.fromfile(str(input_path), dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise WorkerFailure("INVALID_IMAGE", "Real-ESRGAN 无法解码输入图片", 422)

    warnings: list[str] = []
    for tile in (512, 256):
        try:
            upsampler = manager.get_realesrgan(scale, tile)
            manager.phase("图片处理")
            output, _ = upsampler.enhance(image, outscale=scale)
            manager.phase("写入结果")
            encoded_ok, encoded_output = cv2.imencode(".png", output)
            if not encoded_ok:
                raise WorkerFailure("OUTPUT_WRITE_FAILED", "无法写入增强结果")
            encoded_output.tofile(str(output_path))
            upsampler.img = None
            upsampler.output = None
            if tile == 256:
                warnings.append("显存不足，已自动使用较小切片完成处理")
            return {
                "provider": "real-esrgan",
                "model": "RealESRGAN_x2plus" if scale == 2 else "RealESRGAN_x4plus",
                "warnings": warnings,
            }
        except RuntimeError as exc:
            if "out of memory" not in str(exc).lower() or tile == 256:
                if is_cuda_oom(exc):
                    raise
                raise WorkerFailure("REALESRGAN_FAILED", safe_error(exc)) from exc
            upsampler = None
            manager.unload_gpu()
    raise WorkerFailure("REALESRGAN_FAILED", "Real-ESRGAN 推理失败")


def run_background_removal(input_path: Path, output_path: Path, deployment_usage: str) -> dict[str, Any]:
    warnings: list[str] = []
    if deployment_usage == "internal-noncommercial":
        try:
            manager.execute(lambda: run_bria(input_path, output_path))
            return {"provider": "bria-rmbg-2.0", "model": "RMBG-2.0", "warnings": warnings}
        except Exception as exc:
            if is_cuda_oom(exc) or (isinstance(exc, WorkerFailure) and exc.code.startswith("IMAGE_AI_GPU")):
                raise
            warnings.append(f"BRIA 不可用，已回退 BiRefNet：{safe_error(exc)}")
            manager.unload_gpu()

    if manager.execute(lambda: run_birefnet(input_path, output_path)):
        warnings.append("图片尺寸较大，已使用低内存抠图模式，输出尺寸保持不变")
    return {"provider": "birefnet-general", "model": "BiRefNet-general", "warnings": warnings}


def run_bria(input_path: Path, output_path: Path) -> None:
    model, transform, torch = manager.get_bria()
    with Image.open(input_path) as source:
        image = source.convert("RGB")
        original_size = image.size
        tensor = transform(image).unsqueeze(0).to(manager.device())
        manager.phase("图片处理")
        with torch.inference_mode():
            prediction = model(tensor)[-1].sigmoid().cpu()[0].squeeze()
        mask = Image.fromarray((prediction.numpy() * 255).astype("uint8")).resize(
            original_size, Image.Resampling.LANCZOS
        )
        image.putalpha(mask)
        manager.phase("写入结果")
        image.save(output_path, format="PNG", optimize=True)


def run_birefnet(input_path: Path, output_path: Path) -> bool:
    try:
        from rembg import remove
    except ImportError as exc:
        raise WorkerFailure("BIREFNET_UNAVAILABLE", "未安装 rembg") from exc
    session = manager.get_birefnet()
    with Image.open(input_path) as source:
        # Alpha matting constructs large float64 matrices proportional to image area.
        # Keep full-resolution output while avoiding those allocations for large inputs.
        low_memory = source.width * source.height > 4_000_000
        image = source.convert("RGB")
        manager.phase("图片处理")
        try:
            result = remove(image, session=session, alpha_matting=not low_memory)
        except MemoryError:
            if low_memory:
                raise
            low_memory = True
            result = remove(image, session=session, alpha_matting=False)
        manager.phase("写入结果")
        result.save(output_path, format="PNG", optimize=True)
        return low_memory


def normalized_polygon(polygon: Any, score: float, width: int, height: int) -> dict[str, Any]:
    points = []
    for point in polygon:
        x, y = float(point[0]), float(point[1])
        points.append({"x": min(1.0, max(0.0, x / width)), "y": min(1.0, max(0.0, y / height))})
    return {"polygon": points, "confidence": round(min(1.0, max(0.0, score)), 4)}


def trusted_path(value: str | None, must_exist: bool) -> Path:
    if not value:
        raise WorkerFailure("INVALID_PATH", "缺少文件路径", 422)
    candidate = Path(value).resolve()
    trusted = False
    for storage_root in TRUSTED_STORAGE_ROOTS:
        try:
            candidate.relative_to(storage_root)
            trusted = True
            break
        except ValueError:
            continue
    if not trusted:
        raise WorkerFailure("UNTRUSTED_PATH", "拒绝访问图片 AI 存储目录以外的路径", 403)
    if must_exist and not candidate.is_file():
        raise WorkerFailure("FILE_NOT_FOUND", "输入文件不存在或已过期", 404)
    return candidate


def model_health(
    provider: str,
    model: str,
    license_name: str,
    package: str,
    device: str,
    *,
    allowed: bool = True,
    weight_files: list[Path] | None = None,
    sha256_override: str | None = None,
) -> dict[str, Any]:
    required = [package] + (["timm", "kornia", "torchvision", "safetensors"] if provider == "bria-rmbg-2.0" else [])
    missing = [name for name in required if importlib.util.find_spec(name) is None]
    package_available = not missing
    weights = weight_files or []
    weights_available = all(path.exists() for path in weights)
    available = allowed and package_available and weights_available
    reason = None
    if not allowed:
        reason = "当前部署模式禁止使用非商用模型"
    elif not package_available:
        reason = "缺少 Python 包：" + ", ".join(missing)
    elif not weights_available:
        reason = "缺少本地模型权重"
    return {
        "provider": provider,
        "model": model,
        "version": package_version(package),
        "license": license_name,
        "sha256": sha256_override or (combined_sha256(weights) if weights_available and weights else None),
        "device": device,
        "available": available,
        "reason": reason,
    }


def package_version(package: str) -> str:
    try:
        from importlib.metadata import version

        return version(package.replace("_", "-"))
    except Exception:
        return "not-installed"


def combined_sha256(paths: list[Path]) -> str | None:
    cache_key = tuple(str(path.resolve()) for path in paths)
    if cache_key in _SHA256_CACHE:
        return _SHA256_CACHE[cache_key]
    digest = hashlib.sha256()
    files: list[Path] = []
    for item in paths:
        if item.is_file():
            files.append(item)
    if not files:
        _SHA256_CACHE[cache_key] = None
        return None
    for file_path in files:
        digest.update(file_path.name.encode("utf-8"))
        with file_path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    result = digest.hexdigest()
    _SHA256_CACHE[cache_key] = result
    return result


_BRIA_VERIFIED: dict[str, tuple[Any, ...]] = {}


def verify_bria_assets(directory: Path) -> None:
    # Pin both executable custom code and weights; never download code during inference.
    manifest_path = Path(__file__).with_name("image-ai-bria-assets.json")
    if not manifest_path.is_file():
        raise WorkerFailure("BRIA_PROVENANCE_MISSING", "缺少 BRIA 模型版本清单，请更新图片能力包")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for name, expected in manifest["files"].items():
        file = directory / name
        if not file.is_file():
            raise WorkerFailure("BRIA_WEIGHTS_MISSING", f"BRIA 模型缺少文件：{name}")
        stat = file.stat()
        stamp = (stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns, expected)
        if _BRIA_VERIFIED.get(str(file)) == stamp:
            continue
        with file.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        if digest != expected:
            raise WorkerFailure("BRIA_MODEL_MISMATCH", f"BRIA 模型文件与固定版本不符：{name}，请重新准备对应版本")
        _BRIA_VERIFIED[str(file)] = stamp


def is_cuda_oom(error: Exception) -> bool:
    cause = error.__cause__ or error
    message = str(cause).lower()
    return type(cause).__name__ == "OutOfMemoryError" or "out of memory" in message or "cudaerrormemoryallocation" in message


def safe_error(error: Exception) -> str:
    message = str(error).strip().replace(str(ROOT), "<project>")
    for storage_root in TRUSTED_STORAGE_ROOTS:
        message = message.replace(str(storage_root), "<storage>")
    return message[:500] or error.__class__.__name__


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local image AI worker")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", default=PORT, type=int)
    parser.add_argument("--check", action="store_true", help="检查 CPU 运行时、模型和 Worker 依赖")
    args = parser.parse_args()
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("The image AI worker must only listen on loopback")
    if args.check:
        required_packages = ("torch", "realesrgan", "rembg", "paddleocr", "onnxruntime", "uvicorn", "timm", "kornia", "transformers", "safetensors")
        missing_packages = [name for name in required_packages if importlib.util.find_spec(name) is None]
        model_root = MODELS_ROOT
        required_models = [
            model_root / "torch" / "hub" / "checkpoints" / "big-lama.pt",
            model_root / "RealESRGAN_x2plus.pth",
            model_root / "RealESRGAN_x4plus.pth",
            birefnet_model_path(),
            Path(os.environ.get("IMAGE_AI_OCR_DETECTION_MODEL_DIR", "")) / "inference.yml",
            Path(os.environ.get("IMAGE_AI_OCR_RECOGNITION_MODEL_DIR", "")) / "inference.yml",
        ]
        missing_models = [str(item) for item in required_models if not item.is_file()]
        if missing_packages or missing_models:
            raise SystemExit(
                json.dumps(
                    {"available": False, "missingPackages": missing_packages, "missingModels": missing_models},
                    ensure_ascii=False,
                )
            )
        print(json.dumps({"available": True, "device": "cpu", "models": len(required_models)}))
        return
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        import uvicorn
    except ImportError:
        raise SystemExit("uvicorn is not installed; run scripts/setup-image-ai.ps1 first") from None
    uvicorn.run(app, host=args.host, port=args.port, access_log=False)


if __name__ == "__main__":
    main()
