"""Run the production STTN adapter through the real Worker on a deterministic CFR sample."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import platform
import subprocess
import sys
import time
import traceback
from itertools import zip_longest
from pathlib import Path
from typing import Any

import cv2
import numpy as np

TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parents[1]
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from video_ai_sttn import STTN_WINDOW, SttnAdapter as MacosSttnAdapter
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


def make_sample(ffmpeg: Path, directory: Path) -> tuple[Path, dict[str, Any]]:
    directory.mkdir(parents=True, exist_ok=True)
    silent = directory / "synthetic-cfr-video-only.mp4"
    source = directory / "synthetic-cfr-input.mp4"
    width, height, fps, frames = 1280, 720, 24, 241
    rng = np.random.default_rng(1704)
    noise = rng.integers(0, 10, size=(height, width), dtype=np.uint8)
    yy, xx = np.indices((height, width))
    pattern = ((xx // 42 + yy // 38) % 2).astype(np.uint8) * 15
    for index in range(frames):
        if index < 120:
            base = np.zeros((height, width, 3), dtype=np.uint8)
            base[:, :, 0] = 190 + ((xx // 5) % 36)
            base[:, :, 1] = 205 + ((yy // 8) % 30)
            base[:, :, 2] = 220 + pattern
        else:
            base = np.zeros((height, width, 3), dtype=np.uint8)
            base[:, :, 0] = 24 + ((yy // 8) % 20)
            base[:, :, 1] = 34 + ((xx // 7) % 18)
            base[:, :, 2] = 45 + pattern
        base = np.clip(base.astype(np.int16) + noise[:, :, None], 0, 255).astype(np.uint8)
        cv2.rectangle(base, (160 + (index * 7) % 900, 220), (245 + (index * 7) % 900, 255), (30, 210, 245), -1)
        # Eight high-contrast bits remain outside every subtitle mask for frame-order verification.
        cv2.rectangle(base, (6, 6), (118, 52), (15, 15, 15), -1)
        for bit in range(8):
            color = (245, 245, 245) if index & (1 << bit) else (25, 25, 25)
            left = 14 + bit * 12
            cv2.rectangle(base, (left, 14), (left + 8, 44), color, -1)
        if 8 <= index <= 15:
            cv2.putText(base, "SUBTITLE REGION A", (225, 655), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (248, 248, 248), 3, cv2.LINE_AA)
        elif 16 <= index <= 23:
            cv2.putText(base, "ADJACENT REGION B", (675, 655), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (248, 248, 248), 3, cv2.LINE_AA)
        elif 116 <= index <= 124:
            cv2.putText(base, "SCENE CUT REGION C", (430, 655), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (248, 248, 248), 3, cv2.LINE_AA)
        elif 236 <= index <= 240:
            cv2.putText(base, "TAIL REGION D", (450, 655), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (248, 248, 248), 3, cv2.LINE_AA)
        if index == 0:
            writer = cv2.VideoWriter(str(silent), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
        writer.write(base)
    writer.release()
    duration = frames / fps
    command([
        str(ffmpeg), "-y", "-v", "error", "-i", str(silent), "-f", "lavfi", "-i",
        f"sine=frequency=440:sample_rate=48000:duration={duration:.9f}", "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", str(source)
    ], stdout=subprocess.DEVNULL)
    silent.unlink(missing_ok=True)
    def decoded_packets() -> Any:
        capture = cv2.VideoCapture(str(source))
        index = 0
        try:
            while True:
                ok, image = capture.read()
                if not ok:
                    return
                yield FramePacket(index, image, np.zeros((height, width), dtype=np.uint8))
                index += 1
        finally:
            capture.release()

    scheduled = list(sequence_windows(decoded_packets(), config=STTN_WINDOW, check_cancelled=lambda: None))
    scene_ids = sorted({window.scene for window in scheduled})
    if scene_ids != [0, 1] or max(window.centers[-1].index for window in scheduled) != frames - 1:
        raise RuntimeError(f"Synthetic video failed pre-inference scene-cut/tail validation: scenes={scene_ids}")
    return source, {
        "width": width,
        "height": height,
        "fps": fps,
        "frames": frames,
        "durationSeconds": duration,
        "sceneCutFrame": 120,
        "detectedScenes": len(scene_ids)
    }


def marker_index(frame: np.ndarray) -> int:
    value = 0
    for bit in range(8):
        x = 14 + bit * 12
        if int(frame[22:36, x + 1 : x + 8].mean()) >= 128:
            value |= 1 << bit
    return value


def verify_video_stream(worker: Any, source: Path, output: Path, expected: dict[str, Any]) -> dict[str, Any]:
    info_in = worker.probe_video(source)
    info_out = worker.probe_video(output)
    for label, info in (("input", info_in), ("output", info_out)):
        if (info.width, info.height, info.frame_count) != (expected["width"], expected["height"], expected["frames"]):
            raise RuntimeError(f"{label} media metadata mismatch: {info}")
        if abs(info.fps - expected["fps"]) > 0.01:
            raise RuntimeError(f"{label} frame rate changed: {info.fps}")
    if not info_in.has_audio or not info_out.has_audio:
        raise RuntimeError("The synthetic input and Worker output must both retain the original audio stream")
    left = iter(worker.open_frame_source(source, info_in))
    right = iter(worker.open_frame_source(output, info_out))
    count = 0
    for index, pair in enumerate(zip_longest(left, right)):
        original, result = pair
        if original is None or result is None:
            raise RuntimeError("Worker video frame count changed")
        if original.shape != (expected["height"], expected["width"], 3) or result.shape != original.shape:
            raise RuntimeError("Worker video frame dimensions or color layout changed")
        if original.dtype != np.uint8 or result.dtype != np.uint8 or not np.isfinite(result).all():
            raise RuntimeError("Decoded Worker frames must remain finite uint8 BGR arrays")
        if marker_index(original) != index or marker_index(result) != index:
            raise RuntimeError(f"Frame order marker mismatch at decoded frame {index}")
        count += 1
    if count != expected["frames"] or marker_index(result) != expected["frames"] - 1:
        raise RuntimeError("Worker output did not preserve the final CFR frame")
    return {
        "width": info_out.width,
        "height": info_out.height,
        "fps": info_out.fps,
        "frames": count,
        "durationSeconds": info_out.duration,
        "audioRetained": info_out.has_audio,
        "frameOrder": "all 241 embedded indices decoded in order, including final frame"
    }


def decoded_audio_sha(ffmpeg: Path, path: Path) -> tuple[str, int]:
    raw = command([
        str(ffmpeg), "-v", "error", "-i", str(path), "-map", "0:a:0", "-ac", "1", "-ar", "48000",
        "-f", "s16le", "-c:a", "pcm_s16le", "-"
    ])
    return hashlib.sha256(raw).hexdigest(), len(raw)


def run_worker(worker: Any, adapter: MacosSttnAdapter, source: Path, destination: Path, cancel_path: Path | None, segments: list[Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    from video_ai_sequence import run_sequence as original_run_sequence

    manager = worker.manager
    original_build = worker.build_engine
    original_get = manager.get_sequence_engine
    original_run = worker.run_sequence
    stats: list[Any] = []
    manager.get_sequence_engine = lambda name, **_kwargs: adapter if name == "sttn" else original_get(name, **_kwargs)
    worker.build_engine = lambda _mode: worker.SttnEngine(manager)

    def capture_stats(*args: Any, **kwargs: Any) -> Any:
        result = original_run_sequence(*args, **kwargs)
        stats.append(result)
        return result

    worker.run_sequence = capture_stats
    try:
        result = worker.run_subtitle_removal(
            source,
            destination,
            mode="balanced",
            segments=segments,
            progress_path=destination.with_suffix(".progress.json"),
            cancel_flag_path=cancel_path
        )
        return result, stats[-1].__dict__ if stats else {}
    finally:
        worker.build_engine = original_build
        worker.run_sequence = original_run
        manager.get_sequence_engine = original_get


def run_attempt(worker: Any, source: Path, output_directory: Path, expected: dict[str, Any], ffmpeg: Path, device: str, cancellation: bool) -> dict[str, Any]:
    output_directory.mkdir(parents=True, exist_ok=True)
    output = output_directory / "sttn-worker-output.mp4"
    cancel_path = output_directory / "cancel.flag" if cancellation else None
    adapter = MacosSttnAdapter(Path(os.environ["M01_04_STTN_BUNDLE"]), device=device, cancel_after_first_tile=cancel_path)
    segments = [
        worker.Segment(210, 592, 550, 90, 8, 15),
        worker.Segment(620, 592, 560, 90, 16, 23),
        worker.Segment(380, 592, 600, 90, 116, 124),
        worker.Segment(380, 592, 560, 90, 236, 240)
    ]
    result, scheduling = run_worker(worker, adapter, source, output, cancel_path, segments)
    if cancellation:
        raise RuntimeError("Cancellation scenario unexpectedly returned Worker success")
    if result.get("frameCount") != expected["frames"] or result.get("width") != expected["width"] or result.get("height") != expected["height"]:
        raise RuntimeError(f"Worker result metadata mismatch: {result}")
    if scheduling.get("committed_frames") != expected["frames"] or scheduling.get("scenes") != 2:
        raise RuntimeError(f"Sequence scheduler failed frame/scene invariants: {scheduling}")
    if adapter.model is not None or worker.manager.has_loaded_model():
        raise RuntimeError("STTN model reference or Worker manager was not released")
    video = verify_video_stream(worker, source, output, expected)
    source_audio = decoded_audio_sha(ffmpeg, source)
    result_audio = decoded_audio_sha(ffmpeg, output)
    if source_audio != result_audio:
        raise RuntimeError("Decoded output audio SHA-256 differs from the original source audio")
    stats = {
        "adapterDevice": device,
        "parameterDevices": adapter.parameter_devices,
        "mpsFallbackDisabled": adapter.fallback_disabled if device == "mps" else None,
        "stageCalls": adapter.stage_calls,
        "stageTimingsMs": adapter.timings_ms,
        "tiles": adapter.tiles,
        "modelCenterFrames": adapter.frames,
        "peakMpsBytes": adapter.peak_mps_bytes if device == "mps" else None,
        "scheduling": scheduling,
        "audioSha256": result_audio[0],
        "audioPcmBytes": result_audio[1],
        "video": video,
        "workerResult": result
    }
    return {"output": output, "metrics": stats}


def verify_cancel(worker: Any, source: Path, directory: Path, device: str) -> dict[str, Any]:
    directory.mkdir(parents=True, exist_ok=True)
    output = directory / "cancelled-success-must-not-exist.mp4"
    intermediate = output.with_name(output.stem + ".video-only.tmp.mp4")
    flag = directory / "cancel.flag"
    adapter = MacosSttnAdapter(Path(os.environ["M01_04_STTN_BUNDLE"]), device=device, cancel_after_first_tile=flag)
    segments = [worker.Segment(210, 592, 550, 90, 8, 15)]
    cancelled = False
    try:
        run_worker(worker, adapter, source, output, flag, segments)
    except worker.CancelledError:
        cancelled = True
    if not cancelled or adapter.tiles != 1:
        raise RuntimeError("Worker cancellation did not stop immediately after the first completed STTN tile")
    if output.exists() or intermediate.exists():
        raise RuntimeError("Cancelled Worker task left a final or intermediate successful output")
    if adapter.model is not None or worker.manager.has_loaded_model():
        raise RuntimeError("STTN references were not cleared after cancellation")
    return {"cancelled": True, "afterCompletedTiles": adapter.tiles, "finalOutputAbsent": True, "intermediateAbsent": True, "modelReleased": True}


def load_worker(ffmpeg: Path, ffprobe: Path) -> Any:
    if (REPO_ROOT / ".env").exists():
        raise RuntimeError("Refusing Worker import because a repository .env file exists")
    spec = importlib.util.spec_from_file_location("toolbox_video_worker_m01_04", REPO_ROOT / "scripts/video-ai-worker.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the repository video Worker")
    worker = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = worker
    spec.loader.exec_module(worker)
    worker.FFMPEG = str(ffmpeg)
    worker.FFPROBE = str(ffprobe)
    worker.manager.unload_gpu()
    return worker


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--case", required=True, choices=["M01-04-sttn"])
    args = parser.parse_args()
    assets = args.assets_dir.resolve(strict=True)
    output_root = args.output_dir.resolve(strict=True)
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "0")
    os.environ["M01_04_STTN_BUNDLE"] = str(assets / "engine-root")
    ffmpeg, ffprobe = assets / "tools/ffmpeg", assets / "tools/ffprobe"
    worker = load_worker(ffmpeg, ffprobe)
    source, expected = make_sample(ffmpeg, output_root / "sample")
    source_meta = ffprobe_json(ffprobe, source)
    video_stream = next(stream for stream in source_meta["streams"] if stream["codec_type"] == "video")
    if int(video_stream.get("nb_frames", 0)) != expected["frames"] or (expected["width"] * expected["height"]) > 1280 * 720:
        raise RuntimeError("Synthetic source does not meet the planned CFR/720p-pixel-area contract")
    import torch

    if torch.__version__ != "2.6.0" or not torch.backends.mps.is_built():
        raise RuntimeError(f"Expected PyTorch 2.6.0 with native MPS build; got {torch.__version__}")
    mps_status, mps_failure = "not_available", None
    attempts: list[dict[str, Any]] = []
    if torch.backends.mps.is_available():
        try:
            attempt = run_attempt(worker, source, output_root / "mps", expected, ffmpeg, "mps", False)
            attempts.append(attempt)
            mps_status = "pass"
            selected = attempt
            selected_device = "mps"
        except Exception:
            mps_status = "fail"
            mps_failure = traceback.format_exc()
            selected = None
    else:
        selected = None
        mps_failure = "torch.backends.mps.is_available() returned false on this host"
    if selected is None:
        try:
            attempt = run_attempt(worker, source, output_root / "cpu", expected, ffmpeg, "cpu", False)
            attempts.append(attempt)
            selected = attempt
            selected_device = "cpu"
        except Exception:
            raise RuntimeError(f"STTN full Worker run failed on MPS and explicit CPU:\n{traceback.format_exc()}")
    cancellation = verify_cancel(worker, source, output_root / "cancellation", selected_device)
    output_path = selected["output"]
    result = {
        "schemaVersion": 1,
        "caseId": args.case,
        "status": "pass",
        "modelValidation": "pass",
        "executionDevice": selected_device,
        "mpsValidation": {"status": mps_status, "failure": mps_failure},
        "peakMpsBytes": max((item["metrics"]["peakMpsBytes"] or 0 for item in attempts), default=0) or None,
        "pytorch": torch.__version__,
        "python": platform.python_version(),
        "platform": f"{sys.platform}-{platform.machine()}",
        "source": {**expected, "sha256": sha256_file(source), "hasAudio": True},
        "assets": {
            "sttnRevision": "f39f62c5bbbe3e3eba084c487353a2c651bfdcde",
            "weightSha256": "25b0c2c30042d82efd1893bd42ec726764262d94115393a1718f8d65d2a7817b",
            "bundleAdapterReady": False,
            "window": {"center": STTN_WINDOW.center, "before": STTN_WINDOW.before, "after": STTN_WINDOW.after, "history": STTN_WINDOW.history, "references": STTN_WINDOW.references},
            "tile": {"width": 432, "height": 240, "overlap": 64}
        },
        "selectedRun": selected["metrics"],
        "attempts": [item["metrics"] for item in attempts],
        "cancellation": cancellation,
        "output": {"path": str(output_path.relative_to(output_root)), "sha256": sha256_file(output_path)},
        "humanQuality": "pending"
    }
    path = output_root / "probe-result.json"
    path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
