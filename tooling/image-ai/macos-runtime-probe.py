"""Run the repository image worker against pinned, local M01-02 assets."""

from __future__ import annotations

import argparse
import asyncio
import gc
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import os
import platform
import shutil
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_PATHS = {
    "product": "samples/product.png",
    "ocr": "samples/ocr.png",
    "repairMask": "samples/repair-mask.png",
}
MODEL_PATHS = {
    "realesrganX2": "models/image-ai/RealESRGAN_x2plus.pth",
    "realesrganX4": "models/image-ai/RealESRGAN_x4plus.pth",
    "bigLama": "models/image-ai/torch/hub/checkpoints/big-lama.pt",
    "birefnet": "models/image-ai/rembg/models/birefnet-general/birefnet-general.onnx",
    "ocrDetectionJson": "models/image-ai/ocr/detection/inference.json",
    "ocrDetectionParameters": "models/image-ai/ocr/detection/inference.pdiparams",
    "ocrDetectionConfig": "models/image-ai/ocr/detection/inference.yml",
    "ocrRecognitionJson": "models/image-ai/ocr/recognition/inference.json",
    "ocrRecognitionParameters": "models/image-ai/ocr/recognition/inference.pdiparams",
    "ocrRecognitionConfig": "models/image-ai/ocr/recognition/inference.yml",
}
PACKAGE_DISTRIBUTIONS = {
    "torch": "torch",
    "torchvision": "torchvision",
    "paddlepaddle": "paddlepaddle",
    "paddleocr": "paddleocr",
    "realesrgan": "realesrgan",
    "rembg": "rembg",
    "onnxruntime": "onnxruntime",
    "pillow": "Pillow",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_worker(assets_directory: Path, output_directory: Path) -> Any:
    if (REPOSITORY_ROOT / ".env").exists():
        raise RuntimeError("Refusing to import the image worker while the repository .env file exists")

    models_root = assets_directory / "models" / "image-ai"
    storage_root = output_directory / "storage" / "image-ai"
    environment = {
        "TOOLBOX_DESKTOP_MANAGED": "1",
        "IMAGE_AI_DEVICE": "cpu",
        "IMAGE_AI_MODELS_ROOT": str(models_root),
        "IMAGE_AI_STORAGE_ROOT": str(storage_root),
        "IMAGE_AI_OCR_DETECTION_MODEL_DIR": str(models_root / "ocr" / "detection"),
        "IMAGE_AI_OCR_RECOGNITION_MODEL_DIR": str(models_root / "ocr" / "recognition"),
        "TORCH_HOME": str(models_root / "torch"),
        "U2NET_HOME": str(models_root / "rembg"),
        "PADDLE_PDX_CACHE_HOME": str(output_directory / "cache" / "paddlex"),
        "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK": "True",
        "PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT": "False",
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "HF_DATASETS_OFFLINE": "1",
        "TOKENIZERS_PARALLELISM": "false",
        "PYTHONNOUSERSITE": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    os.environ.update(environment)
    storage_root.mkdir(parents=True, exist_ok=True)
    (output_directory / "cache" / "paddlex").mkdir(parents=True, exist_ok=True)

    worker_path = REPOSITORY_ROOT / "scripts" / "image-ai-worker.py"
    spec = importlib.util.spec_from_file_location("macos_m01_02_image_ai_worker", worker_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the repository image AI worker")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def image_metadata(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        image.load()
        result: dict[str, Any] = {
            "path": str(path),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "format": image.format,
            "mode": image.mode,
            "width": image.width,
            "height": image.height,
        }
        if "A" in image.getbands():
            result["alphaExtrema"] = list(image.getchannel("A").getextrema())
        return result


def require_output(path: Path) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size <= 0:
        raise RuntimeError(f"Expected a non-empty model output: {path.name}")
    return image_metadata(path)


def prediction_payload(value: Any) -> dict[str, Any]:
    payload = value.json if hasattr(value, "json") else value
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict):
        return {}
    result = payload.get("res", payload)
    return result if isinstance(result, dict) else {}


def recognize_text(captured: list[Any]) -> list[str]:
    results: list[str] = []
    for batch in captured:
        for prediction in batch if isinstance(batch, (list, tuple)) else [batch]:
            payload = prediction_payload(prediction)
            texts = payload.get("rec_texts", [])
            if isinstance(texts, list):
                results.extend(str(value).strip() for value in texts if str(value).strip())
    return results


def finite_suggestions(result: dict[str, Any]) -> None:
    for suggestion in result.get("suggestions", []):
        confidence = float(suggestion.get("confidence", math.nan))
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise RuntimeError("OCR returned an invalid confidence score")
        points = suggestion.get("polygon", [])
        if len(points) < 4:
            raise RuntimeError("OCR returned an incomplete detection polygon")
        for point in points:
            if not (math.isfinite(float(point["x"])) and math.isfinite(float(point["y"]))):
                raise RuntimeError("OCR returned a non-finite detection coordinate")
            if not (0 <= float(point["x"]) <= 1 and 0 <= float(point["y"]) <= 1):
                raise RuntimeError("OCR returned a polygon outside normalized image bounds")


def emit_progress(output_directory: Path, stage: str, state: str, started_at: float) -> None:
    progress_path = output_directory / "progress.ndjson"
    record = {"stage": stage, "state": state, "elapsedMs": round((time.monotonic() - started_at) * 1000)}
    with progress_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(record, separators=(",", ":")) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


async def main_case(assets_directory: Path, output_directory: Path) -> dict[str, Any]:
    if sys.version_info[:2] != (3, 12):
        raise RuntimeError(f"Python 3.12 is required; detected {sys.version_info.major}.{sys.version_info.minor}")
    if sys.platform != "darwin" or platform.machine() != "arm64":
        raise RuntimeError(f"native macOS arm64 Python is required; detected {sys.platform}-{platform.machine()}")

    for name, relative in (*SAMPLE_PATHS.items(), *MODEL_PATHS.items()):
        if not (assets_directory / relative).is_file():
            raise RuntimeError(f"Missing pinned validation asset: {name}")

    for path in ("product", "ocr"):
        Image.open(assets_directory / SAMPLE_PATHS[path]).verify()
    Image.open(assets_directory / SAMPLE_PATHS["repairMask"]).verify()

    versions: dict[str, str] = {}
    for package, distribution in PACKAGE_DISTRIBUTIONS.items():
        versions[package] = importlib.metadata.version(distribution)

    worker = load_worker(assets_directory, output_directory)
    input_root = Path(os.environ["IMAGE_AI_STORAGE_ROOT"]) / "inputs"
    output_root = Path(os.environ["IMAGE_AI_STORAGE_ROOT"]) / "outputs"
    input_root.mkdir(parents=True, exist_ok=True)
    output_root.mkdir(parents=True, exist_ok=True)
    inputs = {
        "product": input_root / "product.png",
        "ocr": input_root / "ocr.png",
        "repairMask": input_root / "repair-mask.png",
    }
    for key, destination in inputs.items():
        shutil.copyfile(assets_directory / SAMPLE_PATHS[key], destination)

    output_directory.mkdir(parents=True, exist_ok=True)
    model_hashes = {
        name: sha256(assets_directory / relative)
        for name, relative in MODEL_PATHS.items()
    }
    result: dict[str, Any] = {
        "schemaVersion": 1,
        "caseId": "M01-02-image-ai",
        "status": "pass",
        "modelValidation": "pass",
        "requestedDevice": "cpu",
        "executionMode": "cpu",
        "python": ".".join(map(str, sys.version_info[:3])),
        "machine": platform.machine(),
        "packages": versions,
        "modelSha256": model_hashes,
        "inputSha256": {key: sha256(path) for key, path in inputs.items()},
        "operations": {},
    }
    started_at = time.monotonic()

    # Run the actual worker OCR path and retain its prediction payload to prove that
    # both the fixed detection and recognition models executed.
    captured: list[Any] = []
    ocr_model = worker.manager.get_ocr()
    original_predict = getattr(ocr_model, "predict", None)
    if callable(original_predict):
        def capture_predict(*args: Any, **kwargs: Any) -> Any:
            predictions = original_predict(*args, **kwargs)
            if not isinstance(predictions, (list, tuple)):
                predictions = list(predictions)
            captured.append(predictions)
            return predictions

        ocr_model.predict = capture_predict
    emit_progress(output_directory, "paddleocr", "started", started_at)
    operation_started = time.monotonic()
    ocr_response = await worker.watermark_suggestions(worker.SuggestionRequest(input_path=str(inputs["ocr"])))
    if callable(original_predict):
        ocr_model.predict = original_predict
    ocr_data = ocr_response.get("data", {})
    finite_suggestions(ocr_data)
    texts = recognize_text(captured)
    if not ocr_data.get("suggestions") or not texts:
        raise RuntimeError("PaddleOCR did not return both a text region and a recognized text result")
    result["operations"]["paddleocr"] = {
        "status": "pass",
        "durationMs": round((time.monotonic() - operation_started) * 1000),
        "detectionCount": len(ocr_data["suggestions"]),
        "recognizedTexts": texts,
        "warnings": ocr_data.get("warnings", []),
    }
    emit_progress(output_directory, "paddleocr", "passed", started_at)

    models_to_release: list[tuple[str, Path, dict[str, Any]]] = []
    for stage, operation, scale, mask in (
        ("big-lama", "watermark_remove", None, inputs["repairMask"]),
        ("realesrgan-x2", "enhance", 2, None),
        ("realesrgan-x4", "enhance", 4, None),
        ("birefnet", "background_remove", None, None),
    ):
        output_path = output_root / f"{stage}.png"
        output_path.unlink(missing_ok=True)
        request = worker.ProcessRequest(
            operation=operation,
            input_path=str(inputs["product"]),
            output_path=str(output_path),
            mask_path=str(mask) if mask else None,
            scale=scale,
            deployment_usage="commercial",
        )
        emit_progress(output_directory, stage, "started", started_at)
        operation_started = time.monotonic()
        response = await worker.process(request)
        elapsed_ms = round((time.monotonic() - operation_started) * 1000)
        metadata = require_output(output_path)
        model = response.get("data", {}).get("model")
        if stage == "big-lama":
            if (metadata["width"], metadata["height"]) != (512, 512):
                raise RuntimeError("Big-LaMa changed the source image dimensions")
            if metadata["mode"] not in {"RGB", "RGBA"}:
                raise RuntimeError("Big-LaMa output is not a decodable RGB image")
        elif stage.startswith("realesrgan-"):
            expected_scale = 2 if stage.endswith("x2") else 4
            if (metadata["width"], metadata["height"]) != (512 * expected_scale, 512 * expected_scale):
                raise RuntimeError(f"Real-ESRGAN {expected_scale}x output dimensions are incorrect")
        else:
            alpha = metadata.get("alphaExtrema")
            if metadata["mode"] != "RGBA" or not alpha or alpha[0] == alpha[1] or alpha[0] >= 255:
                raise RuntimeError("BiRefNet did not produce a non-uniform transparent cutout")
        if worker.manager.gpu_model is None:
            raise RuntimeError(f"{stage} completed without retaining its initialized model")
        result["operations"][stage] = {
            "status": "pass",
            "durationMs": elapsed_ms,
            "model": model,
            "output": metadata,
            "warnings": response.get("data", {}).get("warnings", []),
        }
        models_to_release.append((stage, output_path, metadata))
        emit_progress(output_directory, stage, "passed", started_at)

    release_started = time.monotonic()
    worker.manager.unload_gpu()
    worker.manager.ocr = None
    gc.collect()
    result["release"] = {
        "status": "pass",
        "durationMs": round((time.monotonic() - release_started) * 1000),
        "gpuModelReferenceCleared": worker.manager.gpu_model is None,
        "ocrReferenceCleared": worker.manager.ocr is None,
        "workerLockReleased": not worker.manager.lock.locked(),
    }
    if not all(
        [result["release"]["gpuModelReferenceCleared"], result["release"]["ocrReferenceCleared"], result["release"]["workerLockReleased"]]
    ):
        raise RuntimeError("Image AI worker did not release model references and inference lock")

    result["outputs"] = {stage: metadata for stage, _path, metadata in models_to_release}
    emit_progress(output_directory, "case", "passed", started_at)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--case", required=True, choices=["M01-02-image-ai"])
    arguments = parser.parse_args()
    output_directory = arguments.output_dir.resolve(strict=True)
    assets_directory = arguments.assets_dir.resolve(strict=True)
    result = asyncio.run(main_case(assets_directory, output_directory))
    result_path = output_directory / "probe-result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
