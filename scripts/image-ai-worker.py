#!/usr/bin/env python3
# 中文模块说明：工程与 Worker 脚本，负责 本地 AI/翻译/配音 Worker 协议和进程服务
"""Local-only image AI inference worker.

The worker intentionally has no upload endpoint. It only accepts paths under the configured
image-ai storage root from the trusted Fastify gateway.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import importlib.util
import json
import os
import sys
import types
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


class SuggestionRequest(BaseModel):
    input_path: str


class ProcessRequest(BaseModel):
    operation: Literal["watermark_remove", "enhance", "background_remove"]
    input_path: str
    output_path: str
    mask_path: str | None = None
    scale: Literal[2, 4] | None = None
    deployment_usage: Literal["internal-noncommercial", "commercial"] = "commercial"


class ModelManager:
    def __init__(self) -> None:
        self.gpu_key: str | None = None
        self.gpu_model: Any = None
        self.ocr: Any = None
        self.lock = asyncio.Lock()

    def unload_gpu(self) -> None:
        self.gpu_key = None
        self.gpu_model = None
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    def device(self) -> str:
        configured_device = os.getenv("IMAGE_AI_DEVICE", "auto").strip().lower()
        if configured_device == "cpu":
            return "cpu"
        try:
            import torch

            if configured_device == "cuda" and not torch.cuda.is_available():
                raise WorkerFailure("IMAGE_AI_CUDA_UNAVAILABLE", "当前设备没有可用的 CUDA 运行时")
            return "cuda" if configured_device == "cuda" or torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def get_ocr(self) -> Any:
        if self.ocr is not None:
            return self.ocr
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise WorkerFailure("PADDLEOCR_UNAVAILABLE", "未安装 PaddleOCR，暂时不能生成水印智能提示") from exc

        try:
            if DESKTOP_MANAGED:
                detection_dir = Path(os.environ["IMAGE_AI_OCR_DETECTION_MODEL_DIR"]).resolve()
                recognition_dir = Path(os.environ["IMAGE_AI_OCR_RECOGNITION_MODEL_DIR"]).resolve()
                if not (detection_dir / "inference.yml").is_file() or not (recognition_dir / "inference.yml").is_file():
                    raise WorkerFailure("OCR_MODELS_MISSING", "缺少已安装的 OCR 检测或识别模型")
                self.ocr = PaddleOCR(
                    lang="ch",
                    text_detection_model_dir=str(detection_dir),
                    text_recognition_model_dir=str(recognition_dir),
                    use_textline_orientation=False,
                    device="cpu",
                    show_log=False,
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
        key = f"realesrgan-{scale}-{tile}"
        if self.gpu_key == key:
            return self.gpu_model
        self.unload_gpu()
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
        self.gpu_model = RealESRGANer(
            scale=scale,
            model_path=str(weight_path),
            model=model,
            tile=tile,
            tile_pad=16,
            pre_pad=0,
            half=self.device() == "cuda",
        )
        self.gpu_key = key
        return self.gpu_model

    def get_bria(self) -> tuple[Any, Any, Any]:
        if self.gpu_key == "bria-rmbg-2.0":
            return self.gpu_model
        self.unload_gpu()
        model_dir = Path(os.getenv("IMAGE_AI_BRIA_MODEL_DIR", MODELS_ROOT / "RMBG-2.0")).resolve()
        if not model_dir.is_dir():
            raise WorkerFailure("BRIA_WEIGHTS_MISSING", f"缺少本地 BRIA RMBG 2.0 权重：{model_dir}")
        try:
            import torch
            from torchvision import transforms
            from transformers import AutoModelForImageSegmentation
        except ImportError as exc:
            raise WorkerFailure("BRIA_UNAVAILABLE", "未安装 BRIA 推理依赖") from exc

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
        try:
            from rembg import new_session
        except ImportError as exc:
            raise WorkerFailure("BIREFNET_UNAVAILABLE", "未安装 rembg/BiRefNet 推理组件") from exc
        try:
            if DESKTOP_MANAGED:
                model_file = Path(os.environ["U2NET_HOME"]) / "models" / "birefnet-general" / "birefnet-general.onnx"
                if not model_file.is_file():
                    raise WorkerFailure("BIREFNET_WEIGHTS_MISSING", "BiRefNet 权重未安装，请前往设置安装图像模型")
                self.gpu_model = new_session("birefnet-general", providers=["CPUExecutionProvider"])
            else:
                self.gpu_model = new_session("birefnet-general")
        except Exception as exc:
            if isinstance(exc, WorkerFailure):
                raise
            raise WorkerFailure(
                "BIREFNET_WEIGHTS_MISSING", "BiRefNet 权重不可用；请在联网安装阶段预下载后再离线运行"
            ) from exc
        self.gpu_key = "birefnet-general"
        return self.gpu_model


manager = ModelManager()
app = FastAPI(title="Toolbox Image AI Worker", docs_url=None, redoc_url=None)


@app.middleware("http")
async def require_worker_token(request: Request, call_next: Any) -> Any:
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
    """Restore the one legacy torchvision symbol imported by BasicSR 1.4.2.

    torchvision removed its private functional_tensor module, while the public
    rgb_to_grayscale function remains API-compatible. Registering this narrow shim
    avoids downgrading the shared CUDA runtime used by the other local models.
    """
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
    device = manager.device()
    internal = os.getenv("DEPLOYMENT_USAGE", "commercial") == "internal-noncommercial"
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
            weight_files=[Path(os.environ["U2NET_HOME"]) / "birefnet-general.onnx"],
        ),
        model_health("paddleocr", "PP-OCRv5", "Apache-2.0", "paddleocr", "cpu"),
    ]
    return {
        "success": True,
        "data": {
            "protocolVersion": 1,
            "available": any(item["available"] for item in models[:4]),
            "deploymentUsage": "internal-noncommercial" if internal else "commercial",
            "workerUrl": f"http://{HOST}:{PORT}",
            "models": models,
        },
    }


@app.post("/watermark/suggestions")
async def watermark_suggestions(payload: SuggestionRequest) -> dict[str, Any]:
    input_path = trusted_path(payload.input_path, must_exist=True)
    async with manager.lock:
        result = await asyncio.to_thread(run_ocr, input_path)
    return {"success": True, "data": result}


@app.post("/process")
async def process(payload: ProcessRequest) -> dict[str, Any]:
    input_path = trusted_path(payload.input_path, must_exist=True)
    output_path = trusted_path(payload.output_path, must_exist=False)
    mask_path = trusted_path(payload.mask_path, must_exist=True) if payload.mask_path else None
    output_path.parent.mkdir(parents=True, exist_ok=True)

    async with manager.lock:
        if payload.operation == "watermark_remove":
            if mask_path is None:
                raise WorkerFailure("MASK_REQUIRED", "去水印必须提供用户确认的蒙版", 422)
            result = await asyncio.to_thread(run_lama, input_path, mask_path, output_path)
        elif payload.operation == "enhance":
            result = await asyncio.to_thread(run_realesrgan, input_path, output_path, payload.scale or 2)
        else:
            result = await asyncio.to_thread(
                run_background_removal,
                input_path,
                output_path,
                payload.deployment_usage,
            )
    return {"success": True, "data": result}


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
        result = model(source.convert("RGB"), mask.convert("L"))
        # LaMa pads inputs to multiples of eight. Remove only the generated right/bottom
        # padding so watermark removal preserves the exact source dimensions.
        result = result.crop((0, 0, original_size[0], original_size[1]))
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
            output, _ = upsampler.enhance(image, outscale=scale)
            encoded_ok, encoded_output = cv2.imencode(".png", output)
            if not encoded_ok:
                raise WorkerFailure("OUTPUT_WRITE_FAILED", "无法写入增强结果")
            encoded_output.tofile(str(output_path))
            if tile == 256:
                warnings.append("显存不足，已自动使用较小切片完成处理")
            return {
                "provider": "real-esrgan",
                "model": "RealESRGAN_x2plus" if scale == 2 else "RealESRGAN_x4plus",
                "warnings": warnings,
            }
        except RuntimeError as exc:
            if "out of memory" not in str(exc).lower() or tile == 256:
                raise WorkerFailure("REALESRGAN_FAILED", safe_error(exc)) from exc
            manager.unload_gpu()
    raise WorkerFailure("REALESRGAN_FAILED", "Real-ESRGAN 推理失败")


def run_background_removal(input_path: Path, output_path: Path, deployment_usage: str) -> dict[str, Any]:
    warnings: list[str] = []
    if deployment_usage == "internal-noncommercial":
        try:
            run_bria(input_path, output_path)
            return {"provider": "bria-rmbg-2.0", "model": "RMBG-2.0", "warnings": warnings}
        except Exception as exc:
            warnings.append(f"BRIA 不可用，已回退 BiRefNet：{safe_error(exc)}")
            manager.unload_gpu()

    run_birefnet(input_path, output_path)
    return {"provider": "birefnet-general", "model": "BiRefNet-general", "warnings": warnings}


def run_bria(input_path: Path, output_path: Path) -> None:
    model, transform, torch = manager.get_bria()
    with Image.open(input_path) as source:
        image = source.convert("RGB")
        original_size = image.size
        tensor = transform(image).unsqueeze(0).to(manager.device())
        with torch.no_grad():
            prediction = model(tensor)[-1].sigmoid().cpu()[0].squeeze()
        mask = Image.fromarray((prediction.numpy() * 255).astype("uint8")).resize(
            original_size, Image.Resampling.LANCZOS
        )
        image.putalpha(mask)
        image.save(output_path, format="PNG", optimize=True)


def run_birefnet(input_path: Path, output_path: Path) -> None:
    try:
        from rembg import remove
    except ImportError as exc:
        raise WorkerFailure("BIREFNET_UNAVAILABLE", "未安装 rembg") from exc
    session = manager.get_birefnet()
    with Image.open(input_path) as source:
        result = remove(source.convert("RGB"), session=session, alpha_matting=True)
        result.save(output_path, format="PNG", optimize=True)


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
    package_available = importlib.util.find_spec(package) is not None
    weights = weight_files or []
    weights_available = all(path.exists() for path in weights)
    available = allowed and package_available and weights_available
    reason = None
    if not allowed:
        reason = "当前部署模式禁止使用非商用模型"
    elif not package_available:
        reason = f"缺少 Python 包：{package}"
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
        required_packages = ("torch", "realesrgan", "rembg", "paddleocr", "onnxruntime", "uvicorn")
        missing_packages = [name for name in required_packages if importlib.util.find_spec(name) is None]
        model_root = MODELS_ROOT
        required_models = [
            model_root / "torch" / "hub" / "checkpoints" / "big-lama.pt",
            model_root / "RealESRGAN_x2plus.pth",
            model_root / "RealESRGAN_x4plus.pth",
            Path(os.environ.get("U2NET_HOME", "models/rembg"))
            / "models"
            / "birefnet-general"
            / "birefnet-general.onnx",
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
