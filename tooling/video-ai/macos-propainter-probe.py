"""Run the production ProPainter adapter through the repository Worker on Apple MPS."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import platform
import subprocess
import sys
import traceback
import warnings
from itertools import zip_longest
from pathlib import Path
from typing import Any

import cv2
import numpy as np

TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parents[1]
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from video_ai_propainter import PROPAINTER_WINDOW, ProPainterAdapter as MacosPropainterAdapter, crop_bounds
from video_ai_sequence import FramePacket, sequence_windows


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def command(args: list[str], *, stdout: Any = subprocess.PIPE) -> bytes:
    result = subprocess.run(args, check=True, stdout=stdout, stderr=subprocess.PIPE, timeout=300)
    return result.stdout or b""


def ffprobe_json(ffprobe: Path, path: Path) -> dict[str, Any]:
    raw = command([str(ffprobe), "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)])
    return json.loads(raw)


def marker_index(frame: np.ndarray) -> int:
    value = 0
    for bit in range(8):
        x = 14 + bit * 12
        if int(frame[22:36, x + 1 : x + 8].mean()) >= 128:
            value |= 1 << bit
    return value


def draw_frame(index: int, width: int, height: int, rng: np.random.Generator, *, scene: int = 0) -> np.ndarray:
    yy, xx = np.indices((height, width))
    noise = rng.integers(0, 7, size=(height, width), dtype=np.uint8)
    if scene == 0:
        image = np.empty((height, width, 3), dtype=np.uint8)
        image[:, :, 0] = 185 + ((xx // 7) % 28)
        image[:, :, 1] = 195 + ((yy // 9) % 28)
        image[:, :, 2] = 212 + ((xx // 40 + yy // 32) % 2) * 16
    else:
        image = np.empty((height, width, 3), dtype=np.uint8)
        image[:, :, 0] = 24 + ((yy // 8) % 18)
        image[:, :, 1] = 34 + ((xx // 7) % 18)
        image[:, :, 2] = 48 + ((xx // 32 + yy // 38) % 2) * 18
    image = np.clip(image.astype(np.int16) + noise[:, :, None], 0, 255).astype(np.uint8)
    # Moving high-contrast texture tests temporal flow outside the mask.
    cv2.rectangle(image, (max(8, (index * 11) % max(width - 90, 9)), max(60, height // 5)),
                  (max(8, (index * 11) % max(width - 90, 9)) + 70, max(86, height // 5 + 26)), (20, 220, 245), -1)
    cv2.rectangle(image, (6, 6), (118, 52), (15, 15, 15), -1)
    for bit in range(8):
        color = (245, 245, 245) if index & (1 << bit) else (25, 25, 25)
        left = 14 + bit * 12
        cv2.rectangle(image, (left, 14), (left + 8, 44), color, -1)
    return image


def write_video(path: Path, width: int, height: int, count: int, *, scene_cut: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 24, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not create deterministic sample video: {path}")
    rng = np.random.default_rng(1505 + width + height + count)
    for index in range(count):
        scene = 1 if scene_cut is not None and index >= scene_cut else 0
        frame = draw_frame(index, width, height, rng, scene=scene)
        if width == 1280 and height == 720 and 8 <= index <= 11:
            cv2.putText(frame, "MAXIMUM LEGAL CROP", (440, 455), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                        (248, 248, 248), 3, cv2.LINE_AA)
        elif width == 720 and height == 1280 and 2 <= index <= 5:
            cv2.putText(frame, "VERTICAL REGION", (160, 600), cv2.FONT_HERSHEY_SIMPLEX, 0.85,
                        (248, 248, 248), 3, cv2.LINE_AA)
        elif count == 1:
            cv2.putText(frame, "ONE FRAME", (430, 455), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                        (248, 248, 248), 3, cv2.LINE_AA)
        writer.write(frame)
    writer.release()


def make_samples(ffmpeg: Path, output_root: Path) -> dict[str, tuple[Path, dict[str, Any]]]:
    sample_root = output_root / "samples"
    raw_full = sample_root / "full-video-silent.mp4"
    full = sample_root / "full-video-with-audio.mp4"
    write_video(raw_full, 1280, 720, 241, scene_cut=120)
    duration = 241 / 24
    command([
        str(ffmpeg), "-y", "-v", "error", "-i", str(raw_full), "-f", "lavfi", "-i",
        f"sine=frequency=523:sample_rate=48000:duration={duration:.9f}", "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(full)
    ], stdout=subprocess.DEVNULL)
    raw_full.unlink(missing_ok=True)
    vertical = sample_root / "vertical-720x1280.mp4"
    write_video(vertical, 720, 1280, 13)
    single = sample_root / "single-frame.mp4"
    write_video(single, 1280, 720, 1)
    return {
        "full": (full, {"width": 1280, "height": 720, "fps": 24, "frames": 241, "audio": True, "scenes": 2}),
        "vertical": (vertical, {"width": 720, "height": 1280, "fps": 24, "frames": 13, "audio": False}),
        "single": (single, {"width": 1280, "height": 720, "fps": 24, "frames": 1, "audio": False}),
    }


def load_worker(ffmpeg: Path, ffprobe: Path) -> Any:
    if (REPO_ROOT / ".env").exists():
        raise RuntimeError("Refusing Worker import because a repository .env file exists")
    spec = importlib.util.spec_from_file_location("toolbox_video_worker_m01_05", REPO_ROOT / "scripts/video-ai-worker.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the repository video Worker")
    worker = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = worker
    spec.loader.exec_module(worker)
    worker.FFMPEG = str(ffmpeg)
    worker.FFPROBE = str(ffprobe)
    worker.manager.unload_gpu()
    return worker


def run_worker(worker: Any, adapter: MacosPropainterAdapter, source: Path, destination: Path,
               segments: list[Any], cancel_path: Path | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    from video_ai_sequence import run_sequence as original_run_sequence

    manager = worker.manager
    original_build = worker.build_engine
    original_get = manager.get_sequence_engine
    original_run = worker.run_sequence
    captured: list[Any] = []
    manager.get_sequence_engine = lambda name, **_kwargs: adapter if name == "propainter" else original_get(name, **_kwargs)
    worker.build_engine = lambda _mode: worker.ProPainterEngine(manager)

    def capture_stats(*args: Any, **kwargs: Any) -> Any:
        result = original_run_sequence(*args, **kwargs)
        captured.append(result)
        return result

    worker.run_sequence = capture_stats
    try:
        result = worker.run_subtitle_removal(
            source,
            destination,
            mode="extreme",
            segments=segments,
            progress_path=destination.with_suffix(".progress.json"),
            cancel_flag_path=cancel_path,
        )
        return result, captured[-1].__dict__ if captured else {}
    finally:
        worker.build_engine = original_build
        worker.run_sequence = original_run
        manager.get_sequence_engine = original_get


def verify_video(worker: Any, ffmpeg: Path, source: Path, output: Path, expected: dict[str, Any]) -> dict[str, Any]:
    info_in, info_out = worker.probe_video(source), worker.probe_video(output)
    for label, info in (("input", info_in), ("output", info_out)):
        if (info.width, info.height, info.frame_count) != (expected["width"], expected["height"], expected["frames"]):
            raise RuntimeError(f"{label} media metadata mismatch: {info}")
        if abs(info.fps - expected["fps"]) > 0.01:
            raise RuntimeError(f"{label} frame rate changed: {info.fps}")
    if expected["audio"] and (not info_in.has_audio or not info_out.has_audio):
        raise RuntimeError("Full video input/output must retain the source audio stream")
    count = 0
    last_marker = None
    for index, pair in enumerate(zip_longest(worker.open_frame_source(source, info_in), worker.open_frame_source(output, info_out))):
        original, result = pair
        if original is None or result is None:
            raise RuntimeError("Worker video frame count changed")
        if original.shape != (expected["height"], expected["width"], 3) or result.shape != original.shape:
            raise RuntimeError("Worker output frame dimensions or BGR layout changed")
        if original.dtype != np.uint8 or result.dtype != np.uint8 or not np.isfinite(result).all():
            raise RuntimeError("Worker frames must remain finite uint8 arrays")
        if marker_index(original) != index or marker_index(result) != index:
            raise RuntimeError(f"Embedded frame order marker mismatch at {index}")
        count += 1
        last_marker = marker_index(result)
    if count != expected["frames"] or last_marker != expected["frames"] - 1:
        raise RuntimeError("Worker did not preserve every frame including the final frame")
    audio = None
    if expected["audio"]:
        def decoded_audio(path: Path) -> tuple[str, int]:
            raw = command([str(ffmpeg), "-v", "error", "-i", str(path), "-map", "0:a:0", "-ac", "1", "-ar", "48000",
                           "-f", "s16le", "-c:a", "pcm_s16le", "-"])
            return hashlib.sha256(raw).hexdigest(), len(raw)
        input_audio, output_audio = decoded_audio(source), decoded_audio(output)
        if input_audio != output_audio:
            raise RuntimeError("Decoded Worker audio PCM differs from the source")
        audio = {"sha256": output_audio[0], "pcmBytes": output_audio[1], "identicalToSource": True}
    return {"width": info_out.width, "height": info_out.height, "fps": info_out.fps, "frames": count,
            "durationSeconds": info_out.duration, "audio": audio, "frameOrder": "all embedded indices decoded in order"}


def segments_for(worker: Any, case: str) -> list[Any]:
    if case == "full":
        return [worker.Segment(416, 216, 432, 272, 8, 11)]
    if case == "vertical":
        return [worker.Segment(144, 420, 432, 272, 2, 5)]
    if case == "single":
        return [worker.Segment(416, 216, 432, 272, 0, 0)]
    raise ValueError(case)


def run_case(worker: Any, ffmpeg: Path, source: Path, output_root: Path, case: str,
             expected: dict[str, Any]) -> dict[str, Any]:
    directory = output_root / case
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / "propainter-worker-output.mp4"
    adapter = MacosPropainterAdapter(Path(os.environ["M01_05_PROPAINTER_BUNDLE"]), device="mps", precision="fp32")
    result, scheduling = run_worker(worker, adapter, source, output, segments_for(worker, case))
    if result.get("frameCount") != expected["frames"] or result.get("width") != expected["width"] or result.get("height") != expected["height"]:
        raise RuntimeError(f"Worker result metadata mismatch: {result}")
    if scheduling.get("committed_frames") != expected["frames"]:
        raise RuntimeError(f"Sequence scheduler failed frame-count invariant: {scheduling}")
    if case == "full" and scheduling.get("scenes") != expected["scenes"]:
        raise RuntimeError(f"Sequence scheduler failed scene-cut invariant: {scheduling}")
    video = verify_video(worker, ffmpeg, source, output, expected)
    if adapter.model is not None or adapter.flow is not None or adapter.raft is not None or worker.manager.has_loaded_model():
        raise RuntimeError("ProPainter references were not released after a completed Worker run")
    expected_crop = (312, 112, 952, 592) if case == "full" else None
    if expected_crop is not None and expected_crop not in adapter.crop_bounds_seen:
        raise RuntimeError(f"The full video did not exercise exact maximum legal crop {expected_crop}: {adapter.crop_bounds_seen}")
    if adapter.deform_conv["calls"] < 1 or adapter.col2im_fold["calls"] < 1:
        raise RuntimeError("A required explicit CPU island was not instrumented during ProPainter inference")
    return {
        "case": case,
        "adapterDevice": "mps",
        "precision": "fp32",
        "parameterDevices": adapter.parameter_devices,
        "parameterDtypes": adapter.parameter_dtypes,
        "mpsFallbackDisabled": adapter.fallback_disabled,
        "stageCalls": adapter.stage_calls,
        "stageTimingsMs": adapter.timings_ms,
        "deformConvCpuIsland": adapter.deform_conv,
        "col2imCpuIsland": adapter.col2im_fold,
        "flowContract": "RAFT uses only adjacent local frames; sparse references enter repair as appearance frames, never as flow pairs.",
        "cropBounds": [list(bounds) for bounds in adapter.crop_bounds_seen],
        "expectedMaximumCrop": list(expected_crop) if expected_crop else None,
        "mpsPeakDriverBytes": adapter.peak_mps_bytes,
        "modelWindows": adapter.windows,
        "modelCenterFrames": adapter.center_frames,
        "scheduling": scheduling,
        "video": video,
        "outputPath": str(output.relative_to(output_root)),
        "outputSha256": sha256_file(output),
        "adapterReleased": True,
        "_adapter": adapter,
    }


def verify_cancellation(worker: Any, source: Path, output_root: Path) -> dict[str, Any]:
    directory = output_root / "cancellation"
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / "cancelled-success-must-not-exist.mp4"
    intermediate = output.with_name(output.stem + ".video-only.tmp.mp4")
    flag = directory / "cancel.flag"
    adapter = MacosPropainterAdapter(Path(os.environ["M01_05_PROPAINTER_BUNDLE"]), device="mps", precision="fp32",
                                     cancel_after_crop=flag)
    cancelled = False
    try:
        run_worker(worker, adapter, source, output, [worker.Segment(416, 216, 432, 272, 8, 11)], flag)
    except worker.CancelledError:
        cancelled = True
    if not cancelled or adapter.windows != 1:
        raise RuntimeError("Cancellation did not stop immediately after one completed ProPainter window")
    if output.exists() or intermediate.exists():
        raise RuntimeError("Cancelled Worker task left a final or intermediate successful output")
    if adapter.model is not None or adapter.flow is not None or adapter.raft is not None or worker.manager.has_loaded_model():
        raise RuntimeError("ProPainter model references were not cleared after cancellation")
    return {"cancelled": True, "afterCompletedWindows": adapter.windows, "finalOutputAbsent": True,
            "intermediateAbsent": True, "modelReleased": True, "deformConvCalls": adapter.deform_conv["calls"],
            "col2imCalls": adapter.col2im_fold["calls"]}


def verify_over_limit_release(worker: Any, source: Path, output_root: Path) -> dict[str, Any]:
    directory = output_root / "over-limit-crop"
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / "over-limit-must-not-exist.mp4"
    intermediate = output.with_name(output.stem + ".video-only.tmp.mp4")
    adapter = MacosPropainterAdapter(Path(os.environ["M01_05_PROPAINTER_BUNDLE"]), device="mps", precision="fp32")
    failure_code = None
    try:
        run_worker(worker, adapter, source, output, [worker.Segment(416, 216, 433, 273, 8, 11)])
    except Exception as error:
        failure_code = getattr(error, "code", None)
        if failure_code != "RESOLUTION_TOO_HIGH":
            raise
    if failure_code != "RESOLUTION_TOO_HIGH":
        raise RuntimeError("An over-limit crop was not rejected with RESOLUTION_TOO_HIGH")
    if output.exists() or intermediate.exists():
        raise RuntimeError("An over-limit crop left a successful final or intermediate output")
    if adapter.model is not None or adapter.flow is not None or adapter.raft is not None or worker.manager.has_loaded_model():
        raise RuntimeError("ProPainter references were not cleared after crop-limit failure")
    return {"rejected": True, "failureCode": failure_code, "automaticResize": False,
            "outputAbsent": True, "modelReleased": True}


def compare_fp16(bundle: Path, reference: MacosPropainterAdapter) -> dict[str, Any]:
    adapter = MacosPropainterAdapter(bundle, device="mps", precision="fp16")
    try:
        adapter.prepare(lambda: None)
        candidate = adapter.repair_window(reference.first_window, lambda: None)
        if reference.first_repaired is None or len(candidate) != len(reference.first_repaired):
            raise RuntimeError("FP16 attempt did not produce the same center-frame count as FP32")
        differences = []
        for baseline, result, packet in zip(reference.first_repaired, candidate, reference.first_window.centers, strict=True):
            mask = packet.mask > 0
            if mask.any():
                differences.append(np.abs(baseline[mask].astype(np.int16) - result[mask].astype(np.int16)).astype(np.float32))
        combined = np.concatenate([value.reshape(-1) for value in differences]) if differences else np.zeros(1, dtype=np.float32)
        fp32_stage_ms = sum(reference.first_window_stage_timings_ms.values())
        fp16_stage_ms = sum(adapter.timings_ms[name] for name in adapter.stage_calls)
        return {
            "status": "pass",
            "precision": "RAFT FP32; flow completion and repair FP16; deform-conv CPU island FP32",
            "parameterDevices": adapter.parameter_devices,
            "parameterDtypes": adapter.parameter_dtypes,
            "stageCalls": adapter.stage_calls,
            "stageTimingsMs": adapter.timings_ms,
            "deformConvCpuIsland": adapter.deform_conv,
            "col2imCpuIsland": adapter.col2im_fold,
            "mpsPeakDriverBytes": adapter.peak_mps_bytes,
            "matchedWindowComparison": {
                "fp32StageMs": round(fp32_stage_ms, 3),
                "fp16StageMs": round(fp16_stage_ms, 3),
                "stageTimeReductionPercent": round((fp32_stage_ms - fp16_stage_ms) / fp32_stage_ms * 100, 2)
                if fp32_stage_ms
                else None,
                "fp32MpsPeakDriverBytes": reference.first_window_mps_peak_bytes,
                "fp16MpsPeakDriverBytes": adapter.peak_mps_bytes,
                "mpsPeakReductionPercent": round(
                    (reference.first_window_mps_peak_bytes - adapter.peak_mps_bytes)
                    / reference.first_window_mps_peak_bytes
                    * 100,
                    2,
                )
                if reference.first_window_mps_peak_bytes
                else None,
                "fp32CpuIslands": reference.first_window_cpu_islands,
            },
            "maskedPixelAbsoluteDifference": {
                "mean": round(float(combined.mean()), 4),
                "p95": round(float(np.percentile(combined, 95)), 4),
                "max": int(combined.max()),
            },
        }
    except Exception as error:
        return {"status": "not_usable", "failure": f"{type(error).__name__}: {error}",
                "stageCalls": adapter.stage_calls, "deformConvCpuIsland": adapter.deform_conv,
                "col2imCpuIsland": adapter.col2im_fold}
    finally:
        adapter.close()


def make_contact_sheet(source: Path, output: Path, destination: Path) -> str:
    from PIL import Image, ImageDraw

    capture_in, capture_out = cv2.VideoCapture(str(source)), cv2.VideoCapture(str(output))
    frames = []
    try:
        for index in (8, 9, 10, 11):
            capture_in.set(cv2.CAP_PROP_POS_FRAMES, index)
            capture_out.set(cv2.CAP_PROP_POS_FRAMES, index)
            ok_in, before = capture_in.read()
            ok_out, after = capture_out.read()
            if not ok_in or not ok_out:
                continue
            for label, frame in ((f"input {index}", before), (f"output {index}", after)):
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = Image.fromarray(rgb)
                image.thumbnail((640, 360))
                frames.append((label, image.copy()))
    finally:
        capture_in.release()
        capture_out.release()
    canvas = Image.new("RGB", (1280, 4 * 390), "white")
    draw = ImageDraw.Draw(canvas)
    for index, (label, image) in enumerate(frames):
        x, y = (index % 2) * 640, (index // 2) * 390
        draw.text((x + 8, y + 6), label, fill="black")
        canvas.paste(image, (x, y + 24))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination)
    return sha256_file(destination)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--case", required=True, choices=["M01-05-propainter-video"])
    args = parser.parse_args()
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "0")
    assets = args.assets_dir.resolve(strict=True)
    output_root = args.output_dir.resolve(strict=True)
    os.environ["M01_05_PROPAINTER_BUNDLE"] = str(assets / "engine-root")
    os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "0"
    warnings.filterwarnings(
        "error",
        message=r"The operator .* is not currently supported on the MPS backend and will fall back to run on the CPU.*",
    )
    ffmpeg, ffprobe = assets / "tools/ffmpeg", assets / "tools/ffprobe"
    worker = load_worker(ffmpeg, ffprobe)
    samples = make_samples(ffmpeg, output_root)
    source_path, expected = samples["full"]
    source_info = ffprobe_json(ffprobe, source_path)
    video_stream = next(stream for stream in source_info["streams"] if stream["codec_type"] == "video")
    if int(video_stream.get("nb_frames", 0)) != expected["frames"]:
        raise RuntimeError("Synthetic full video did not retain the planned 241 CFR frames")
    if expected["width"] * expected["height"] != 1280 * 720:
        raise RuntimeError("Synthetic full video does not match the Worker 720p pixel-area limit")
    crop_probe = np.zeros((720, 1280), dtype=np.uint8)
    crop_probe[208:496, 408:856] = 255
    maximum_crop = crop_bounds(crop_probe)
    if maximum_crop != (312, 112, 952, 592):
        raise RuntimeError(f"Pinned production crop helper changed its maximum legal crop: {maximum_crop}")

    import torch

    if torch.__version__ != "2.6.0" or not torch.backends.mps.is_built() or not torch.backends.mps.is_available():
        raise RuntimeError(f"Expected native MPS with torch 2.6.0, got {torch.__version__}")
    full_source, full_expected = samples["full"]
    full = run_case(worker, ffmpeg, full_source, output_root, "full", full_expected)
    adapter = full.pop("_adapter")
    vertical_source, vertical_expected = samples["vertical"]
    vertical = run_case(worker, ffmpeg, vertical_source, output_root, "vertical", vertical_expected)
    vertical_adapter = vertical.pop("_adapter")
    single_source, single_expected = samples["single"]
    single = run_case(worker, ffmpeg, single_source, output_root, "single", single_expected)
    single_adapter = single.pop("_adapter")
    cancellation = verify_cancellation(worker, source_path, output_root)
    over_limit = verify_over_limit_release(worker, source_path, output_root)
    fp16 = compare_fp16(assets / "engine-root", adapter)
    output_path = output_root / full["outputPath"]
    contact_sheet = output_root / "review-contact-sheet.png"
    contact_hash = make_contact_sheet(source_path, output_path, contact_sheet)

    result = {
        "schemaVersion": 1,
        "caseId": args.case,
        "status": "pass",
        "modelValidation": "pass",
        "executionDevice": "mps+explicit-cpu-deform-conv+col2im-fold",
        "unregisteredMpsFallbackWarnings": 0,
        "mpsValidation": {"status": "pass", "globalFallback": "disabled"},
        "peakMpsBytes": max(adapter.peak_mps_bytes, vertical_adapter.peak_mps_bytes, single_adapter.peak_mps_bytes),
        "pytorch": torch.__version__,
        "torchvision": __import__("torchvision").__version__,
        "python": platform.python_version(),
        "platform": f"{sys.platform}-{platform.machine()}",
        "source": {**expected, "sha256": sha256_file(source_path), "hasAudio": True},
        "assets": {
            "propainterRevision": "326782529a63d997cab80ab21439b92ed422b3d3",
            "license": "LicenseRef-S-Lab-1.0",
            "weights": {
                item["name"]: item["sha256"] for item in json.loads((assets / "engine-root/PROVENANCE.json").read_text())["weights"]
            },
            "bundleAdapterReady": False,
            "window": {"center": PROPAINTER_WINDOW.center, "before": PROPAINTER_WINDOW.before,
                       "after": PROPAINTER_WINDOW.after, "history": PROPAINTER_WINDOW.history,
                       "references": PROPAINTER_WINDOW.references},
            "maxCropPixels": 640 * 480,
            "contextPixels": 96,
            "paddingMultiple": 8,
        },
        "selectedRun": full,
        "verticalRun": vertical,
        "singleFrameScene": single,
        "cancellation": cancellation,
        "overLimitFailureRelease": over_limit,
        "fp16Comparison": fp16,
        "output": {"path": str(output_path.relative_to(output_root)), "sha256": sha256_file(output_path)},
        "reviewContactSheet": {"path": str(contact_sheet.relative_to(output_root)), "sha256": contact_hash},
        "humanQuality": "pending",
    }
    report_path = output_root / "probe-result.json"
    report_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"{type(error).__name__}: {error}\n{traceback.format_exc()[-8000:]}", file=sys.stderr)
        raise SystemExit(1)
