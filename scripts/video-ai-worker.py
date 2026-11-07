#!/usr/bin/env python3
# 中文模块说明：工程与 Worker 脚本，负责 本地视频去字幕 Worker 协议和进程服务
"""Local-only video subtitle removal worker.

Pipeline: sampled OCR detection (or user-confirmed regions) -> temporal mask
segments -> per-frame or sequence inpainting -> ffmpeg remux with the original
audio track. The worker has no upload endpoint and never downloads models; it
only accepts paths under the configured video-ai storage root.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import hmac
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import time
from collections.abc import Iterable
from dataclasses import dataclass, field
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

# Windows: PaddlePaddle ships an OpenMP/MKL runtime that shadows torch's
# libiomp5md.dll. If paddle is imported first, `import torch` afterwards fails
# with WinError 127 on shm.dll. Loading torch eagerly before anything else
# keeps the repair engines (LaMa/STTN/ProPainter) usable alongside PaddleOCR.
if importlib.util.find_spec("torch") is not None:
    try:
        importlib.import_module("torch")
    except Exception:  # pragma: no cover - GPU 缺失等场景交给各引擎的健康检查报错
        pass

# paddle 3.x CPU 推理在启用 MKLDNN 时对新版 PIR 模型存在已知缺陷
# (ConvertPirAttribute2RuntimeAttribute NotImplementedError)，默认关闭。
os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "False")

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from video_ai_sequence import FramePacket, SequenceWindow, WindowConfig, run_sequence


def project_path(value: str | Path) -> Path:
    candidate = Path(value)
    return (ROOT / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()


# Windows 上 paddle / torch C++ 运行时无法打开含非 ASCII 字符的路径（如中文项目目录
# F:\git仓库内容）。为这类目录提供一个纯 ASCII 别名：优先目录联接（junction，零拷贝），
# 失败时退化为整目录复制。非 Windows 平台路径天然 UTF-8，直接原样返回。
def _ascii_workspace_root() -> Path | None:
    candidates: list[Path] = []
    for name in ("LOCALAPPDATA", "TEMP", "PROGRAMDATA"):
        value = os.environ.get(name)
        if value:
            candidates.append(Path(value))
    candidates.append(Path("C:/ToolBox"))
    for candidate in candidates:
        try:
            if not str(candidate).isascii():
                continue
            root = candidate / "toolbox-video-ai" / "aliases"
            root.mkdir(parents=True, exist_ok=True)
            probe = root / ".write-probe"
            probe.write_text("ok")
            probe.unlink()
            return root
        except OSError:
            continue
    return None


def ascii_safe_dir(target: Path) -> Path:
    if sys.platform != "win32" or str(target).isascii():
        return target
    root = _ascii_workspace_root()
    if root is None:
        return target  # 找不到 ASCII 工作目录，交给下游报错
    key = hashlib.sha256(str(target).lower().encode("utf-8")).hexdigest()[:16]
    alias = root / key
    if alias.exists():
        return alias
    # 指向已删除目标的失效 junction 会让 exists() 返回 False，但目录项仍存在，先清理。
    try:
        alias.rmdir()
    except OSError:
        pass
    try:
        import _winapi

        _winapi.CreateJunction(str(target), str(alias))
        return alias
    except Exception:
        try:
            shutil.copytree(target, alias)
            return alias
        except Exception:
            return target


def _pin_ascii_paddle_cache() -> None:
    """PaddleX 的模型缓存目录必须走纯 ASCII 真实目录（不能用 junction——paddlex
    会 resolve 到真实路径而击穿别名）。仅 Windows 且原路径含非 ASCII 时改写。"""
    if sys.platform != "win32":
        return
    cache_home = os.environ.get("PADDLE_PDX_CACHE_HOME")
    if cache_home:
        candidate = Path(cache_home)
    else:
        candidate = STORAGE_ROOT / "cache" / "paddlex"
        os.environ["PADDLE_PDX_CACHE_HOME"] = str(candidate)
    if str(candidate).isascii():
        return
    root = _ascii_workspace_root()
    if root is not None:
        target = root.parent / "paddlex-cache"
        target.mkdir(parents=True, exist_ok=True)
        os.environ["PADDLE_PDX_CACHE_HOME"] = str(target)


STORAGE_ROOT = project_path(os.getenv("VIDEO_AI_STORAGE_ROOT", "storage/video-ai"))
TRUSTED_STORAGE_ROOTS = tuple(
    dict.fromkeys(
        [
            STORAGE_ROOT,
            (ROOT / "storage" / "video-ai").resolve(),
            # pnpm --filter backend runs the API with backend/ as cwd, so a relative
            # STORAGE_ROOT=./storage currently resolves here (mirrors image-ai).
            (ROOT / "backend" / "storage" / "video-ai").resolve(),
        ]
    )
)
MODELS_ROOT = project_path(os.getenv("VIDEO_AI_MODELS_ROOT", "models/video-ai"))
_pin_ascii_paddle_cache()
PORT = int(os.getenv("VIDEO_AI_WORKER_PORT", "3211"))
HOST = os.getenv("VIDEO_AI_WORKER_HOST", "127.0.0.1")
WORKER_TOKEN = os.getenv("VIDEO_AI_WORKER_TOKEN", "")
FFMPEG = os.getenv("VIDEO_AI_FFMPEG", "ffmpeg")
FFPROBE = os.getenv("VIDEO_AI_FFPROBE", "ffprobe")

# Engine parameters (clamped for an 8 GB RTX 3060 Ti; see docs/video-subtitle-removal-plan.md).
MASK_DILATE_PX = int(os.getenv("VIDEO_AI_MASK_DILATE", "8"))
LAMA_CONTEXT_PX = int(os.getenv("VIDEO_AI_LAMA_CONTEXT_PX", "96"))
SAMPLE_INTERVAL_SEC = float(os.getenv("VIDEO_AI_SAMPLE_INTERVAL_SEC", "1.0"))
MIN_SAMPLED_FRAMES = int(os.getenv("VIDEO_AI_MIN_SAMPLED_FRAMES", "5"))
OCR_CONFIDENCE = float(os.getenv("VIDEO_AI_OCR_CONFIDENCE", "0.45"))
TEMPORAL_SMOOTH_PREV = float(os.getenv("VIDEO_AI_TEMPORAL_SMOOTH", "0.3"))
STTN_MAX_LOAD_NUM = int(os.getenv("VIDEO_AI_STTN_MAX_LOAD_NUM", "30"))
STTN_NEIGHBOR_STRIDE = int(os.getenv("VIDEO_AI_STTN_NEIGHBOR_STRIDE", "10"))
STTN_REFERENCE_LENGTH = int(os.getenv("VIDEO_AI_STTN_REFERENCE_LENGTH", "10"))
PROPAINTER_SUBVIDEO_LENGTH = int(os.getenv("VIDEO_AI_PROPAINTER_SUBVIDEO_LENGTH", "10"))
PROPAINTER_NEIGHBOR_LENGTH = int(os.getenv("VIDEO_AI_PROPAINTER_NEIGHBOR_LENGTH", "5"))
PROPAINTER_MAX_PIXELS = int(os.getenv("VIDEO_AI_PROPAINTER_MAX_PIXELS", str(1280 * 720)))

EngineMode = Literal["fast", "balanced", "extreme", "delogo"]


class WorkerFailure(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 503):
        super().__init__(message)
        self.code = code
        self.status = status


class CancelledError(RuntimeError):
    pass


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    frame_count: int
    has_audio: bool
    duration: float


@dataclass
class Segment:
    """A subtitle region active over an inclusive frame range (pixel coordinates)."""

    x: int
    y: int
    width: int
    height: int
    start_frame: int
    end_frame: int
    confidence: float = 1.0

    def active_at(self, frame_index: int) -> bool:
        return self.start_frame <= frame_index <= self.end_frame

    def normalized(self, video_width: int, video_height: int) -> dict[str, Any]:
        return {
            "x": round(self.x / video_width, 6),
            "y": round(self.y / video_height, 6),
            "width": round(self.width / video_width, 6),
            "height": round(self.height / video_height, 6),
        }


@dataclass
class FrameDetections:
    frame_index: int
    boxes: list[tuple[int, int, int, int]]  # (x, y, w, h) pixel rects
    scores: list[float] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Media probing and frame IO
# ---------------------------------------------------------------------------


def probe_video(input_path: Path) -> VideoInfo:
    if shutil.which(FFPROBE) or Path(FFPROBE).is_file():
        try:
            output = subprocess.run(
                [
                    FFPROBE,
                    "-v",
                    "error",
                    "-print_format",
                    "json",
                    "-show_streams",
                    "-show_format",
                    str(input_path),
                ],
                capture_output=True,
                check=True,
                timeout=120,
            ).stdout
            meta = json.loads(output)
            video_stream = next((s for s in meta.get("streams", []) if s.get("codec_type") == "video"), None)
            if video_stream is None:
                raise WorkerFailure("INVALID_VIDEO", "输入文件不包含视频流", 422)
            fps_parts = str(video_stream.get("avg_frame_rate") or "0/1").split("/")
            fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 and float(fps_parts[1]) else 0.0
            has_audio = any(s.get("codec_type") == "audio" for s in meta.get("streams", []))
            frame_count = int(float(video_stream.get("nb_frames") or 0))
            duration = float(meta.get("format", {}).get("duration") or 0.0)
            if frame_count <= 0 and fps > 0 and duration > 0:
                frame_count = int(round(fps * duration))
            return VideoInfo(
                width=int(video_stream["width"]),
                height=int(video_stream["height"]),
                fps=fps or 25.0,
                frame_count=max(frame_count, 1),
                has_audio=has_audio,
                duration=duration,
            )
        except (subprocess.SubprocessError, json.JSONDecodeError, KeyError, ValueError) as exc:
            raise WorkerFailure("INVALID_VIDEO", f"无法解析输入视频：{safe_error(exc)}", 422) from exc

    # ffprobe missing: fall back to OpenCV properties (no audio information).
    import cv2

    capture = cv2.VideoCapture(str(input_path))
    try:
        if not capture.isOpened():
            raise WorkerFailure("INVALID_VIDEO", "无法解码输入视频", 422)
        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        return VideoInfo(
            width=int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)),
            height=int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            fps=fps,
            frame_count=max(int(capture.get(cv2.CAP_PROP_FRAME_COUNT)), 1),
            has_audio=False,
            duration=0.0,
        )
    finally:
        capture.release()


def open_frame_source(input_path: Path, info: VideoInfo) -> Iterable[Any]:
    """Decode frames as BGR ndarrays via an ffmpeg pipe, falling back to OpenCV."""
    import cv2  # noqa: F401  (ensures a clear ImportError before streaming starts)
    import numpy as np

    if shutil.which(FFMPEG) or Path(FFMPEG).is_file():
        command = [
            FFMPEG,
            "-v",
            "error",
            "-i",
            str(input_path),
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-",
        ]
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        frame_size = info.width * info.height * 3
        assert process.stdout is not None
        try:
            while True:
                buffer = process.stdout.read(frame_size)
                if len(buffer) < frame_size:
                    break
                yield np.frombuffer(buffer, dtype=np.uint8).reshape(info.height, info.width, 3).copy()
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        return

    capture = cv2.VideoCapture(str(input_path))
    if not capture.isOpened():
        raise WorkerFailure("INVALID_VIDEO", "无法解码输入视频", 422)
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            yield frame
    finally:
        capture.release()


def remux_with_audio(
    video_only_path: Path,
    input_path: Path,
    output_path: Path,
    *,
    encode_video: bool,
) -> None:
    """Combine the processed video with the source audio track.

    encode_video=True re-encodes the intermediate stream to H.264 CRF 18; False
    performs a pure stream copy (used for the no-subtitle passthrough path).
    """
    if not (shutil.which(FFMPEG) or Path(FFMPEG).is_file()):
        # No ffmpeg: keep the video-only intermediate and let the caller warn.
        shutil.move(str(video_only_path), str(output_path))
        return
    command = [FFMPEG, "-y", "-v", "error"]
    if encode_video:
        command += ["-i", str(video_only_path), "-i", str(input_path)]
        command += ["-map", "0:v:0", "-map", "1:a?", "-c:v", "libx264", "-crf", "18", "-preset", "medium"]
        command += ["-c:a", "copy", "-movflags", "+faststart", str(output_path)]
    else:
        command += ["-i", str(input_path), "-c", "copy", "-movflags", "+faststart", str(output_path)]
    try:
        subprocess.run(command, capture_output=True, check=True, timeout=None)
    except subprocess.SubprocessError as exc:
        raise WorkerFailure("MUX_FAILED", f"视频合成失败：{safe_error(exc)}") from exc
    if video_only_path != output_path and video_only_path.is_file():
        video_only_path.unlink()


# ---------------------------------------------------------------------------
# Detection and mask segmentation
# ---------------------------------------------------------------------------


class SubtitleDetector:
    """Sampled OCR detector. The OCR runtime is optional so the worker can run
    delogo/manual flows on machines without the Paddle stack installed."""

    def __init__(self) -> None:
        self._ocr: Any = None

    def available(self) -> bool:
        return importlib.util.find_spec("paddleocr") is not None

    def _get_ocr(self) -> Any:
        if self._ocr is not None:
            return self._ocr
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise WorkerFailure("OCR_UNAVAILABLE", "未安装 OCR 组件，无法自动检测字幕区域；请手动框选") from exc
        if DESKTOP_MANAGED:
            detection_dir = ascii_safe_dir(Path(os.environ.get("VIDEO_AI_OCR_DETECTION_MODEL_DIR", "")))
            recognition_dir = ascii_safe_dir(Path(os.environ.get("VIDEO_AI_OCR_RECOGNITION_MODEL_DIR", "")))
            if not (detection_dir / "inference.yml").is_file() or not (recognition_dir / "inference.yml").is_file():
                raise WorkerFailure("OCR_MODELS_MISSING", "缺少已安装的 OCR 检测或识别模型，请前往能力管理安装")
            self._ocr = PaddleOCR(
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
            self._ocr = PaddleOCR(
                lang="ch",
                device="cpu",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        return self._ocr

    def detect_frame(self, frame_bgr: Any, frame_index: int) -> FrameDetections:
        ocr = self._get_ocr()
        boxes: list[tuple[int, int, int, int]] = []
        scores: list[float] = []
        # paddleocr 3.x 的 predict 仅接受 ndarray / 路径字符串；PNG 字节流会被静默忽略。
        predictions = ocr.predict(frame_bgr) if hasattr(ocr, "predict") else ocr.ocr(frame_bgr)
        for page in predictions or []:
            data = page.json if hasattr(page, "json") else page
            if callable(data):
                data = data()
            result = data.get("res", data) if isinstance(data, dict) else {}
            polygons = result.get("dt_polys") or result.get("rec_polys") or []
            poly_scores = result.get("dt_scores") or result.get("rec_scores") or [1.0] * len(polygons)
            if not polygons and isinstance(page, (list, tuple)):
                # Legacy ocr() shape: [[polygon, (text, score)], ...]
                polygons = [line[0] for line in page if line]
                poly_scores = [float(line[1][1]) for line in page if len(line) > 1 and line[1]]
            for polygon, score in zip(polygons, poly_scores, strict=False):
                xs = [float(point[0]) for point in polygon]
                ys = [float(point[1]) for point in polygon]
                if not xs or not ys:
                    continue
                x, y = int(min(xs)), int(min(ys))
                boxes.append((x, y, int(max(xs)) - x, int(max(ys)) - y))
                scores.append(float(score))
        keep = [index for index, score in enumerate(scores) if score >= OCR_CONFIDENCE]
        return FrameDetections(
            frame_index=frame_index,
            boxes=[boxes[index] for index in keep],
            scores=[scores[index] for index in keep],
        )


def sample_frame_indices(info: VideoInfo) -> list[int]:
    step = max(int(round(info.fps * SAMPLE_INTERVAL_SEC)), 1)
    indices = list(range(0, info.frame_count, step))
    if not indices:
        indices = [0]
    while len(indices) < MIN_SAMPLED_FRAMES and info.frame_count >= MIN_SAMPLED_FRAMES:
        step = max(step // 2, 1)
        indices = list(range(0, info.frame_count, step))
    return sorted(set(min(index, info.frame_count - 1) for index in indices))


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax2, ay2 = a[0] + a[2], a[1] + a[3]
    bx2, by2 = b[0] + b[2], b[1] + b[3]
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    intersection = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = a[2] * a[3] + b[2] * b[3] - intersection
    return intersection / union if union > 0 else 0.0


def _union(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    x1, y1 = min(a[0], b[0]), min(a[1], b[1])
    x2, y2 = max(a[0] + a[2], b[0] + b[2]), max(a[1] + a[3], b[1] + b[3])
    return (x1, y1, x2 - x1, y2 - y1)


def cluster_detections(
    detections: list[FrameDetections],
    info: VideoInfo,
    sample_step_frames: int,
) -> list[Segment]:
    """Group per-sample OCR boxes into temporal mask segments.

    Boxes are merged into spatial clusters by overlap with the cluster's running
    union rect, so a horizontally scrolling ticker still collapses into one wide
    band while distinct top/bottom subtitle lines stay separate. Each cluster's
    active range extends half a sampling step beyond its first/last sighting,
    which keeps the mask stable between sampled frames.
    """
    clusters: list[dict[str, Any]] = []
    for detection in detections:
        for box, score in zip(detection.boxes, detection.scores or [1.0] * len(detection.boxes), strict=False):
            target = None
            for cluster in clusters:
                if _iou(box, cluster["rect"]) > 0.05:
                    target = cluster
                    break
            if target is None:
                clusters.append({"rect": box, "frames": [detection.frame_index], "scores": [score]})
            else:
                target["rect"] = _union(target["rect"], box)
                target["frames"].append(detection.frame_index)
                target["scores"].append(score)

    pad = max(sample_step_frames, 1)
    segments: list[Segment] = []
    for cluster in clusters:
        x, y, width, height = cluster["rect"]
        x = max(0, min(x, info.width - 1))
        y = max(0, min(y, info.height - 1))
        width = max(1, min(width, info.width - x))
        height = max(1, min(height, info.height - y))
        segments.append(
            Segment(
                x=x,
                y=y,
                width=width,
                height=height,
                start_frame=max(0, min(cluster["frames"]) - pad),
                end_frame=min(info.frame_count - 1, max(cluster["frames"]) + pad),
                confidence=round(sum(cluster["scores"]) / len(cluster["scores"]), 4),
            )
        )
    segments.sort(key=lambda segment: segment.width * segment.height, reverse=True)
    return segments


def mask_for_frame(segments: list[Segment], frame_index: int, width: int, height: int) -> Any:
    import cv2
    import numpy as np

    mask: Any = np.zeros((height, width), dtype=np.uint8)
    for segment in segments:
        if segment.active_at(frame_index):
            mask[segment.y : segment.y + segment.height, segment.x : segment.x + segment.width] = 255
    if mask.any() and MASK_DILATE_PX > 0:
        kernel = np.ones((MASK_DILATE_PX * 2 + 1, MASK_DILATE_PX * 2 + 1), dtype=np.uint8)
        mask = cv2.dilate(mask, kernel)
    return mask


# ---------------------------------------------------------------------------
# Inpainting engines
# ---------------------------------------------------------------------------


class Engine:
    name = "base"
    sequence_capable = False

    def prepare(self, info: VideoInfo) -> None: ...

    def prepare_sequence(self, info: VideoInfo, check: Any) -> None:
        check()
        self.prepare(info)

    def repair_frame(self, frame_bgr: Any, mask: Any) -> Any:
        raise NotImplementedError

    def repair_sequence(self, frames: list[Any], masks: list[Any]) -> list[Any]:
        return [self.repair_frame(frame, mask) for frame, mask in zip(frames, masks, strict=True)]

    def repair_window(self, window: SequenceWindow, check: Any) -> list[Any]:
        # Compatibility for an old external adapter: only contiguous frames are
        # passed to its sequence API, never sparse optical-flow references.
        check()
        repaired = self.repair_sequence([p.image for p in window.local], [p.mask for p in window.local])
        check()
        if len(repaired) != len(window.local):
            raise WorkerFailure("ENGINE_FAILED", "时序引擎返回帧数与输入不一致")
        return repaired[window.center_offset : window.center_offset + window.center_count]

    def close(self) -> None: ...


class DelogoEngine(Engine):
    """OpenCV TELEA inpainting. Always available; zero model dependencies."""

    name = "delogo"

    def repair_frame(self, frame_bgr: Any, mask: Any) -> Any:
        import cv2

        if not mask.any():
            return frame_bgr
        return cv2.inpaint(frame_bgr, mask, 3, cv2.INPAINT_TELEA)


class LamaEngine(Engine):
    """Per-frame Big-LaMa inpainting with optional temporal smoothing.

    Inference runs on the masked window plus surrounding context instead of the
    full frame: LaMa reconstructs the hole from nearby texture, so a bounded
    window keeps quality while cutting CPU inference ~5-10x at 720p.
    """

    name = "fast"

    def __init__(self, manager: ModelManager, smooth: bool = True) -> None:
        self.manager = manager
        self.smooth = smooth
        self.model: Any = None
        self.previous_patch: Any = None

    def prepare(self, info: VideoInfo) -> None:
        del info
        self.model = self.manager.get_lama()
        self.previous_patch = None

    def repair_frame(self, frame_bgr: Any, mask: Any) -> Any:
        import numpy as np
        from PIL import Image

        if not mask.any():
            self.previous_patch = None
            return frame_bgr
        height, width = frame_bgr.shape[:2]
        ys, xs = np.nonzero(mask)
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        context = max(LAMA_CONTEXT_PX, min(y1 - y0, x1 - x0))
        cy0, cy1 = max(0, y0 - context), min(height, y1 + context)
        cx0, cx1 = max(0, x0 - context), min(width, x1 + context)
        crop = frame_bgr[cy0:cy1, cx0:cx1]
        crop_mask = mask[cy0:cy1, cx0:cx1]
        image = Image.fromarray(crop[:, :, ::-1])  # BGR -> RGB
        mask_image = Image.fromarray(crop_mask)
        result = self.model(image, mask_image)
        repaired = np.asarray(result.crop((0, 0, image.width, image.height)), dtype=np.uint8)[:, :, ::-1].copy()
        patch = frame_bgr.astype(np.float32)
        patch[cy0:cy1, cx0:cx1] = repaired.astype(np.float32)
        if self.smooth and self.previous_patch is not None and self.previous_patch.shape == patch.shape:
            patch = (1.0 - TEMPORAL_SMOOTH_PREV) * patch + TEMPORAL_SMOOTH_PREV * self.previous_patch
        output = frame_bgr.copy()
        region = mask > 0
        output[region] = np.clip(patch, 0, 255).astype(np.uint8)[region]
        self.previous_patch = patch
        return output


class SttnEngine(Engine):
    """Adapter for the vendored STTN sequence model (balanced tier)."""

    name = "balanced"
    sequence_capable = True

    def __init__(self, manager: ModelManager) -> None:
        self.manager = manager
        self.module: Any = None

    def prepare(self, info: VideoInfo) -> None:
        if info.width * info.height > 1280 * 720:
            raise WorkerFailure("RESOLUTION_TOO_HIGH", "STTN 首版仅验证 720p 及以下画幅；不会自动降低分辨率", 422)
        self.module = self.manager.get_sequence_engine(
            "sttn",
            max_load_num=STTN_MAX_LOAD_NUM,
            neighbor_stride=STTN_NEIGHBOR_STRIDE,
            reference_length=STTN_REFERENCE_LENGTH,
        )

    def repair_sequence(self, frames: list[Any], masks: list[Any]) -> list[Any]:
        return self.module.inpaint(frames, masks)

    def prepare_sequence(self, info: VideoInfo, check: Any) -> None:
        self.prepare(info)
        self.manager.sequence_engine = self.module
        if hasattr(self.module, "repair_window"):
            self.module.prepare(check)

    @property
    def scheduling_config(self) -> WindowConfig:
        from video_ai_sttn import STTN_WINDOW

        return STTN_WINDOW if self.name == "balanced" else WindowConfig()

    def repair_window(self, window: SequenceWindow, check: Any) -> list[Any]:
        if hasattr(self.module, "repair_window"):
            return self.module.repair_window(window, check)
        return super().repair_window(window, check)

    def close(self) -> None:
        module, self.module = self.module, None
        try:
            if module is not None and hasattr(module, "close"):
                module.close()
        finally:
            if self.manager.sequence_engine is module:
                self.manager.sequence_engine = None


class ProPainterEngine(SttnEngine):
    """Adapter for the vendored ProPainter sequence model (extreme tier)."""

    name = "extreme"

    @property
    def scheduling_config(self) -> WindowConfig:
        from video_ai_propainter import PROPAINTER_WINDOW

        return PROPAINTER_WINDOW

    def prepare(self, info: VideoInfo) -> None:
        if info.width * info.height > PROPAINTER_MAX_PIXELS:
            raise WorkerFailure(
                "RESOLUTION_TOO_HIGH",
                "极致档在 8 GB 显存下仅支持 720p 及以下分辨率，请改用均衡或快速档",
                422,
            )
        self.module = self.manager.get_sequence_engine(
            "propainter",
            subvideo_length=PROPAINTER_SUBVIDEO_LENGTH,
            neighbor_length=PROPAINTER_NEIGHBOR_LENGTH,
        )


# ---------------------------------------------------------------------------
# Model manager
# ---------------------------------------------------------------------------


class ModelManager:
    def __init__(self) -> None:
        self.gpu_key: str | None = None
        self.gpu_model: Any = None
        self.sequence_engine: Any = None
        self.lock = asyncio.Lock()

    def has_loaded_model(self) -> bool:
        return self.gpu_model is not None or any(
            getattr(self.sequence_engine, name, None) is not None for name in ("model", "raft", "flow")
        )

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
        configured = os.getenv("VIDEO_AI_DEVICE", "auto").strip().lower()
        if configured == "cpu":
            return "cpu"
        try:
            import torch

            if configured == "cuda" and not torch.cuda.is_available():
                raise WorkerFailure("VIDEO_AI_CUDA_UNAVAILABLE", "当前设备没有可用的 CUDA 运行时")
            return "cuda" if configured == "cuda" or torch.cuda.is_available() else "cpu"
        except ImportError:
            return "cpu"

    def vram_total_mb(self) -> int | None:
        try:
            import torch

            if not torch.cuda.is_available():
                return None
            properties = torch.cuda.get_device_properties(0)
            return int(properties.total_memory // (1024 * 1024))
        except Exception:
            return None

    def get_lama(self) -> Any:
        if self.gpu_key == "lama":
            return self.gpu_model
        self.unload_gpu()
        try:
            import torch
        except ImportError as exc:
            raise WorkerFailure("LAMA_UNAVAILABLE", "未安装 LaMa 推理组件，请前往能力管理安装视频去字幕能力") from exc
        model_path = project_path(os.getenv("VIDEO_AI_LAMA_MODEL", MODELS_ROOT / "big-lama.pt"))
        if not model_path.is_file():
            raise WorkerFailure("LAMA_WEIGHTS_MISSING", f"缺少 LaMa 权重：{model_path}")
        device = torch.device(self.device())
        # Binary-stream loading keeps Unicode Windows paths safe (same as image-ai).
        with model_path.open("rb") as model_stream:
            model = torch.jit.load(model_stream, map_location=device)
        model.eval()
        model.to(device)

        def inpaint(image: Any, mask_image: Any) -> Any:
            import numpy as np
            from PIL import Image

            def tensor_input(source: Any) -> Any:
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
                return torch.from_numpy(values).unsqueeze(0).to(device)

            image_tensor = tensor_input(image)
            mask_tensor = (tensor_input(mask_image) > 0).to(dtype=image_tensor.dtype)
            with torch.inference_mode():
                inpainted = model(image_tensor, mask_tensor)
            output = inpainted[0].permute(1, 2, 0).detach().cpu().numpy()
            return Image.fromarray((output.clip(0, 1) * 255).astype("uint8"))

        self.gpu_model = inpaint
        self.gpu_key = "lama"
        return self.gpu_model

    def get_sequence_engine(self, name: str, **params: Any) -> Any:
        """Load a vendored sequence engine (STTN / ProPainter).

        Engine code and weights ship inside the component under models/video-ai;
        the worker never downloads them. A missing engine is a hard, explicit
        failure so the UI can hide the tier instead of degrading silently.
        """
        configured = os.getenv(f"VIDEO_AI_{name.upper()}_ENGINE_ROOT")
        if configured:
            from video_ai_engine_assets import read_bundle

            root = Path(configured)
            try:
                bundle = read_bundle(root)
            except Exception as exc:
                raise WorkerFailure(
                    f"{name.upper()}_UNAVAILABLE", f"{name} 时序资源校验失败：{safe_error(exc)}"
                ) from exc
            if bundle["engine"] != name or bundle.get("adapterReady") is not True:
                raise WorkerFailure(f"{name.upper()}_UNAVAILABLE", f"{name} 时序资源尚未完成推理验收，当前档位保持关闭")
            if name == "sttn":
                from video_ai_sttn import SttnAdapter

                self.unload_gpu()
                return SttnAdapter(root, device=self.device())
            from video_ai_propainter import ProPainterAdapter

            self.unload_gpu()
            return ProPainterAdapter(root, device=self.device())
        engine_dir = MODELS_ROOT / "engines" / name
        module_path = engine_dir / "engine.py"
        if not module_path.is_file():
            raise WorkerFailure(
                f"{name.upper()}_UNAVAILABLE",
                f"{name} 引擎未随能力包安装（{module_path}），请前往能力管理安装完整视频去字幕能力",
            )
        weights = engine_dir / "weights"
        if not weights.is_dir() or not any(weights.iterdir()):
            raise WorkerFailure(f"{name.upper()}_WEIGHTS_MISSING", f"缺少 {name} 权重，请重新安装能力包")
        # 引擎代码内部可能用窄字符 C API 加载权重，非 ASCII 路径需走 junction 别名。
        safe_dir = ascii_safe_dir(engine_dir)
        spec = importlib.util.spec_from_file_location(f"video_ai_engines.{name}", safe_dir / "engine.py")
        if spec is None or spec.loader is None:
            raise WorkerFailure(f"{name.upper()}_UNAVAILABLE", f"无法加载 {name} 引擎模块")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if not hasattr(module, "create_engine"):
            raise WorkerFailure(f"{name.upper()}_UNAVAILABLE", f"{name} 引擎缺少 create_engine 入口")
        engine = module.create_engine(weights_dir=str(safe_dir / "weights"), device=self.device(), **params)
        if not hasattr(engine, "inpaint"):
            raise WorkerFailure(f"{name.upper()}_UNAVAILABLE", f"{name} 引擎缺少 inpaint 方法")
        return engine


manager = ModelManager()
detector = SubtitleDetector()


def build_engine(mode: EngineMode) -> Engine:
    if mode == "delogo":
        return DelogoEngine()
    if mode == "fast":
        return LamaEngine(manager)
    if mode == "balanced":
        return SttnEngine(manager)
    if mode == "extreme":
        return ProPainterEngine(manager)
    raise WorkerFailure("INVALID_MODE", f"未知的修复档位：{mode}", 422)


# ---------------------------------------------------------------------------
# Progress reporting
# ---------------------------------------------------------------------------


class ProgressReporter:
    def __init__(self, progress_path: Path | None, total_frames: int) -> None:
        self.progress_path = progress_path
        self.total_frames = total_frames
        self.stage = "detect"
        self.processed = 0
        self._last_write = 0.0

    def update(self, stage: str, processed: int, *, force: bool = False) -> None:
        self.stage = stage
        self.processed = processed
        if self.progress_path is None:
            return
        now = time.monotonic()
        if not force and now - self._last_write < 0.5:
            return
        self._last_write = now
        percent = round(min(100.0, processed / max(self.total_frames, 1) * 100), 2)
        payload = {
            "stage": stage,
            "processedFrames": processed,
            "totalFrames": self.total_frames,
            "percent": percent,
        }
        temp_path = self.progress_path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(self.progress_path)


def check_cancelled(cancel_flag_path: Path | None) -> None:
    if cancel_flag_path is not None and cancel_flag_path.is_file():
        raise CancelledError("任务已取消")


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------


def detect_segments(
    input_path: Path,
    info: VideoInfo,
    reporter: ProgressReporter | None = None,
    cancel_flag_path: Path | None = None,
    frame_detector: SubtitleDetector | None = None,
) -> list[Segment]:
    active_detector = frame_detector or detector
    indices = sample_frame_indices(info)
    step = max(indices[1] - indices[0], 1) if len(indices) > 1 else info.frame_count
    wanted = set(indices)
    detections: list[FrameDetections] = []
    for frame_index, frame in enumerate(open_frame_source(input_path, info)):
        check_cancelled(cancel_flag_path)
        if frame_index in wanted:
            detections.append(active_detector.detect_frame(frame, frame_index))
            if reporter is not None:
                reporter.update("detect", len(detections))
        if frame_index >= info.frame_count - 1:
            break
    return cluster_detections(detections, info, step)


def run_subtitle_removal(
    input_path: Path,
    output_path: Path,
    *,
    mode: EngineMode,
    segments: list[Segment] | None = None,
    manual_area: tuple[int, int, int, int] | None = None,
    progress_path: Path | None = None,
    cancel_flag_path: Path | None = None,
    frame_detector: SubtitleDetector | None = None,
) -> dict[str, Any]:
    import cv2

    info = probe_video(input_path)
    if info.width <= 0 or info.height <= 0 or info.frame_count <= 0:
        raise WorkerFailure("INVALID_VIDEO", "输入视频缺少有效的画面参数", 422)
    check_cancelled(cancel_flag_path)
    reporter = ProgressReporter(progress_path, info.frame_count)
    warnings: list[str] = []

    if manual_area is not None:
        x, y, width, height = manual_area
        segments = [
            Segment(
                x=max(0, x),
                y=max(0, y),
                width=max(1, min(width, info.width - x)),
                height=max(1, min(height, info.height - y)),
                start_frame=0,
                end_frame=info.frame_count - 1,
            )
        ]
    elif segments is None:
        segments = detect_segments(input_path, info, reporter, cancel_flag_path, frame_detector)

    if not segments:
        # No subtitles found: remux without touching the picture.
        reporter.update("mux", info.frame_count, force=True)
        remux_with_audio(input_path, input_path, output_path, encode_video=False)
        check_cancelled(cancel_flag_path)
        return {
            "provider": "passthrough",
            "model": None,
            "segments": [],
            "frameCount": info.frame_count,
            "warnings": ["未检测到字幕区域，已原样封装输出（音画均未改动）"],
        }

    engine = build_engine(mode)
    intermediate = output_path.with_name(output_path.stem + ".video-only.tmp.mp4")
    writer: Any = None
    processed = 0
    try:
        if engine.sequence_capable:
            processed = _run_sequence_engine(
                engine,
                input_path,
                info,
                segments,
                intermediate,
                reporter,
                cancel_flag_path,
            )
        else:
            engine.prepare(info)
            fourcc = cv2.VideoWriter.fourcc(*"mp4v")
            writer = cv2.VideoWriter(str(intermediate), fourcc, info.fps, (info.width, info.height))
            if not writer.isOpened():
                raise WorkerFailure("OUTPUT_WRITE_FAILED", "无法创建中间视频文件")
            for frame_index, frame in enumerate(open_frame_source(input_path, info)):
                check_cancelled(cancel_flag_path)
                mask = mask_for_frame(segments, frame_index, info.width, info.height)
                writer.write(engine.repair_frame(frame, mask) if mask.any() else frame)
                processed = frame_index + 1
                reporter.update("repair", processed)
                if frame_index >= info.frame_count - 1:
                    break
        if processed == 0:
            raise WorkerFailure("INVALID_VIDEO", "输入视频没有可处理的帧", 422)
        check_cancelled(cancel_flag_path)
    except Exception as exc:
        if writer is not None:
            writer.release()
        intermediate.unlink(missing_ok=True)
        if isinstance(exc, RuntimeError) and "out of memory" in str(exc).lower():
            manager.unload_gpu()
            raise WorkerFailure("CUDA_OUT_OF_MEMORY", "显存不足；本次任务已停止，未自动切换引擎或降低分辨率") from exc
        from video_ai_propainter import ProPainterFailure
        from video_ai_sttn import SttnFailure

        if isinstance(exc, (SttnFailure, ProPainterFailure)):
            raise WorkerFailure(exc.code, str(exc)) from exc
        raise
    finally:
        if writer is not None and writer.isOpened():
            writer.release()
        if not engine.sequence_capable:
            engine.close()

    reporter.update("mux", info.frame_count, force=True)
    if not info.has_audio and (shutil.which(FFMPEG) or Path(FFMPEG).is_file()):
        warnings.append("输入视频没有音轨，输出仅包含画面")
    try:
        remux_with_audio(intermediate, input_path, output_path, encode_video=True)
    finally:
        intermediate.unlink(missing_ok=True)
    # The backend owns removal of an uncommitted output on late cancellation;
    # the Worker must never report success when the flag was raised during mux.
    check_cancelled(cancel_flag_path)
    return {
        "provider": engine.name,
        "model": engine.name if engine.name != "delogo" else "opencv-inpaint",
        "segments": [segment.normalized(info.width, info.height) for segment in segments],
        "frameCount": processed,
        "width": info.width,
        "height": info.height,
        "warnings": warnings,
    }


def _run_sequence_engine(
    engine: Engine,
    input_path: Path,
    info: VideoInfo,
    segments: list[Segment],
    intermediate: Path,
    reporter: ProgressReporter,
    cancel_flag_path: Path | None,
) -> int:
    import cv2

    writer: Any = None

    class Adapter:
        def prepare(self, check: Any) -> None:
            reporter.update("load", 0, force=True)
            engine.prepare_sequence(info, check)
            module = getattr(engine, "module", None)
            if module is not None and hasattr(module, "set_stage_callback"):
                module.set_stage_callback(lambda stage: reporter.update(stage, reporter.processed))

        def repair_window(self, window: SequenceWindow, check: Any) -> list[Any]:
            return engine.repair_window(window, check)

        def close(self) -> None:
            engine.close()

    def frames() -> Iterable[FramePacket]:
        source = iter(open_frame_source(input_path, info))
        try:
            for index, frame in enumerate(source):
                check_cancelled(cancel_flag_path)
                yield FramePacket(index, frame, mask_for_frame(segments, index, info.width, info.height))
        finally:
            close = getattr(source, "close", None)
            if close is not None:
                close()

    def write_frame(frame: Any) -> None:
        nonlocal writer
        if writer is None:
            writer = cv2.VideoWriter(
                str(intermediate), cv2.VideoWriter.fourcc(*"mp4v"), info.fps, (info.width, info.height)
            )
            if not writer.isOpened():
                raise WorkerFailure("OUTPUT_WRITE_FAILED", "无法创建中间视频文件")
        writer.write(frame)

    adapter = Adapter()
    try:
        return run_sequence(
            frames(),
            adapter,
            width=info.width,
            height=info.height,
            check_cancelled=lambda: check_cancelled(cancel_flag_path),
            write_frame=write_frame,
            progress=lambda count: reporter.update("repair", count),
            config=getattr(engine, "scheduling_config", WindowConfig()),
        ).committed_frames
    except ValueError as exc:
        raise WorkerFailure("ENGINE_FAILED", str(exc)) from exc
    finally:
        if writer is not None and writer.isOpened():
            writer.release()


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------


class RectModel(BaseModel):
    x: float
    y: float
    width: float
    height: float


class SegmentModel(BaseModel):
    rect: RectModel
    startFrame: int
    endFrame: int


class DetectRequest(BaseModel):
    input_path: str


class ProcessRequest(BaseModel):
    operation: Literal["subtitle_remove"]
    input_path: str
    output_path: str
    mode: EngineMode = "balanced"
    manual_area: RectModel | None = None
    segments: list[SegmentModel] | None = None
    progress_path: str | None = None
    cancel_flag_path: str | None = None


app = FastAPI(title="Toolbox Video AI Worker", docs_url=None, redoc_url=None)


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


@app.exception_handler(WorkerFailure)
async def worker_failure_handler(_request: Request, error: WorkerFailure) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={"success": False, "error": {"code": error.code, "message": str(error)}},
    )


@app.exception_handler(CancelledError)
async def cancelled_handler(_request: Request, error: CancelledError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={"success": False, "error": {"code": "TASK_CANCELLED", "message": str(error)}},
    )


@app.exception_handler(Exception)
async def unexpected_failure_handler(_request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": {"code": "INFERENCE_FAILED", "message": safe_error(error)}},
    )


def engine_health() -> list[dict[str, Any]]:
    cv2_available = importlib.util.find_spec("cv2") is not None
    torch_available = importlib.util.find_spec("torch") is not None
    lama_weights = project_path(os.getenv("VIDEO_AI_LAMA_MODEL", MODELS_ROOT / "big-lama.pt")).is_file()
    entries = [
        {
            "provider": "delogo",
            "license": "Apache-2.0 (OpenCV)",
            "available": cv2_available,
            "reason": None if cv2_available else "缺少 Python 包：opencv-python-headless",
        },
        {
            "provider": "fast",
            "model": "big-lama",
            "license": "Apache-2.0",
            "available": torch_available and lama_weights,
            "reason": None
            if torch_available and lama_weights
            else ("缺少 Python 包：torch" if not torch_available else "缺少本地模型权重 big-lama.pt"),
        },
    ]
    for name, tier in (("sttn", "balanced"), ("propainter", "extreme")):
        configured = os.getenv(f"VIDEO_AI_{name.upper()}_ENGINE_ROOT")
        if configured:
            from video_ai_engine_assets import read_bundle

            try:
                bundle = read_bundle(Path(configured), verify=False)
                available = (
                    bundle["engine"] == name and bundle.get("adapterReady") is True and manager.device() == "cuda"
                )
                reason = None if available else "时序适配器尚未完成验收，当前档位保持关闭"
            except Exception as exc:
                available, reason = False, f"时序资源不可用：{safe_error(exc)}"
            entries.append(
                {
                    "provider": tier,
                    "model": name,
                    "available": available,
                    "reason": reason,
                    "license": "MIT" if name == "sttn" else "S-Lab License 1.0 (non-commercial)",
                }
            )
            continue
        engine_dir = MODELS_ROOT / "engines" / name
        module_ready = (engine_dir / "engine.py").is_file()
        weights_dir = engine_dir / "weights"
        weights_ready = weights_dir.is_dir() and any(weights_dir.iterdir())
        entries.append(
            {
                "provider": tier,
                "model": name,
                "license": "见 docs/video-subtitle-removal-plan.md 第 3.2 节",
                "available": module_ready and weights_ready and torch_available,
                "reason": None
                if module_ready and weights_ready and torch_available
                else "引擎代码或权重未随能力包安装",
            }
        )
    return entries


@app.get("/health")
async def health() -> dict[str, Any]:
    engines = engine_health()
    return {
        "success": True,
        "data": {
            "protocolVersion": 1,
            "available": any(entry["available"] for entry in engines),
            "device": manager.device(),
            "vramTotalMb": manager.vram_total_mb(),
            "workerUrl": f"http://{HOST}:{PORT}",
            "engines": engines,
        },
    }


@app.get("/diagnostics/light")
async def diagnostics_light() -> dict[str, Any]:
    torch = sys.modules.get("torch")
    cuda = bool(torch.cuda.is_available()) if torch is not None else None
    return {
        "protocolVersion": 1,
        "available": importlib.util.find_spec("cv2") is not None,
        "modelLoaded": manager.has_loaded_model(),
        "busy": manager.lock.locked(),
        **({"cudaAvailable": cuda} if cuda is not None else {}),
    }


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
        raise WorkerFailure("UNTRUSTED_PATH", "拒绝访问视频 AI 存储目录以外的路径", 403)
    if must_exist and not candidate.is_file():
        raise WorkerFailure("FILE_NOT_FOUND", "输入文件不存在或已过期", 404)
    return candidate


def optional_storage_path(value: str | None) -> Path | None:
    if not value:
        return None
    return trusted_path(value, must_exist=False)


def segments_from_models(models: list[SegmentModel], info: VideoInfo) -> list[Segment]:
    segments: list[Segment] = []
    for model in models:
        x = max(0, min(int(round(model.rect.x * info.width)), info.width - 1))
        y = max(0, min(int(round(model.rect.y * info.height)), info.height - 1))
        width = max(1, min(int(round(model.rect.width * info.width)), info.width - x))
        height = max(1, min(int(round(model.rect.height * info.height)), info.height - y))
        segments.append(
            Segment(
                x=x,
                y=y,
                width=width,
                height=height,
                start_frame=max(0, min(model.startFrame, info.frame_count - 1)),
                end_frame=max(0, min(model.endFrame, info.frame_count - 1)),
            )
        )
    return segments


@app.post("/subtitle/detect")
async def subtitle_detect(payload: DetectRequest) -> dict[str, Any]:
    input_path = trusted_path(payload.input_path, must_exist=True)
    async with manager.lock:
        result = await asyncio.to_thread(_detect_for_api, input_path)
    return {"success": True, "data": result}


def _detect_for_api(input_path: Path) -> dict[str, Any]:
    info = probe_video(input_path)
    segments = detect_segments(input_path, info)
    warnings: list[str] = []
    if not segments:
        warnings.append("未检测到字幕区域，可手动框选或直接按原样输出")
    return {
        "width": info.width,
        "height": info.height,
        "fps": info.fps,
        "frameCount": info.frame_count,
        "hasAudio": info.has_audio,
        "segments": [
            {
                "rect": segment.normalized(info.width, info.height),
                "startFrame": segment.start_frame,
                "endFrame": segment.end_frame,
                "confidence": segment.confidence,
            }
            for segment in segments
        ],
        "warnings": warnings,
    }


@app.post("/process")
async def process(payload: ProcessRequest) -> dict[str, Any]:
    input_path = trusted_path(payload.input_path, must_exist=True)
    output_path = trusted_path(payload.output_path, must_exist=False)
    progress_path = optional_storage_path(payload.progress_path)
    cancel_flag_path = optional_storage_path(payload.cancel_flag_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    manual_area = None
    if payload.manual_area is not None:
        info = probe_video(input_path)
        manual_area = (
            int(round(payload.manual_area.x * info.width)),
            int(round(payload.manual_area.y * info.height)),
            int(round(payload.manual_area.width * info.width)),
            int(round(payload.manual_area.height * info.height)),
        )
    explicit_segments = None
    if payload.segments:
        info = probe_video(input_path)
        explicit_segments = segments_from_models(payload.segments, info)

    async with manager.lock:
        result = await asyncio.to_thread(
            run_subtitle_removal,
            input_path,
            output_path,
            mode=payload.mode,
            segments=explicit_segments,
            manual_area=manual_area,
            progress_path=progress_path,
            cancel_flag_path=cancel_flag_path,
        )
    return {"success": True, "data": result}


# ---------------------------------------------------------------------------
# Misc helpers
# ---------------------------------------------------------------------------


def safe_error(error: Exception | BaseException) -> str:
    message = str(error).strip().replace(str(ROOT), "<project>")
    for storage_root in TRUSTED_STORAGE_ROOTS:
        message = message.replace(str(storage_root), "<storage>")
    return message[:500] or error.__class__.__name__


def combined_sha256(paths: list[Path]) -> str | None:
    digest = hashlib.sha256()
    files = [path for path in paths if path.is_file()]
    if not files:
        return None
    for file_path in files:
        digest.update(file_path.name.encode("utf-8"))
        with file_path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local video AI worker")
    parser.add_argument("--host", default=HOST)
    parser.add_argument("--port", default=PORT, type=int)
    parser.add_argument("--check", action="store_true", help="检查运行时、模型和 Worker 依赖")
    args = parser.parse_args()
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("The video AI worker must only listen on loopback")
    if args.check:
        required_packages = ("cv2", "numpy", "fastapi", "uvicorn")
        missing_packages = [name for name in required_packages if importlib.util.find_spec(name) is None]
        required_models = [project_path(os.getenv("VIDEO_AI_LAMA_MODEL", MODELS_ROOT / "big-lama.pt"))]
        missing_models = [str(item) for item in required_models if not item.is_file()]
        ffmpeg_ready = bool(shutil.which(FFMPEG) or Path(FFMPEG).is_file())
        payload = {
            "available": not missing_packages and ffmpeg_ready,
            "missingPackages": missing_packages,
            "missingModels": missing_models,
            "ffmpegAvailable": ffmpeg_ready,
            "device": manager.device(),
            "vramTotalMb": manager.vram_total_mb(),
        }
        if missing_packages or not ffmpeg_ready:
            raise SystemExit(json.dumps(payload, ensure_ascii=False))
        print(json.dumps(payload, ensure_ascii=False))
        return
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        import uvicorn
    except ImportError:
        raise SystemExit("uvicorn is not installed; prepare the video-ai component first") from None
    uvicorn.run(app, host=args.host, port=args.port, access_log=False)


if __name__ == "__main__":
    main()
