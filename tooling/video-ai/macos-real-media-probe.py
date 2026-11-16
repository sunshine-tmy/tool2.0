"""Run production video adapters through the isolated Worker on an authorized sample."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import platform
import resource
import subprocess
import sys
import time
import traceback
import warnings
from fractions import Fraction
from pathlib import Path
from typing import Any

TOOL_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOL_DIR.parents[1]
sys.path.insert(0, str(TOOL_DIR))
sys.path.insert(0, str(REPO_ROOT / "scripts"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(args: list[str], *, timeout: int = 300) -> bytes:
    result = subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    return result.stdout


def load_probe(engine: str) -> Any:
    path = TOOL_DIR / f"macos-{engine}-probe.py"
    name = f"toolbox_macos_{engine}_probe_real_media"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load existing {engine} MPS probe helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def frame_pts(ffprobe: Path, path: Path) -> list[float]:
    raw = run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_frames",
            "-show_entries",
            "frame=best_effort_timestamp_time",
            "-of",
            "csv=p=0",
            str(path),
        ],
        timeout=600,
    ).decode("utf-8")
    values = [line.strip().split(",", 1)[0] for line in raw.splitlines() if line.strip()]
    if not values or any(value == "N/A" for value in values):
        raise RuntimeError(f"FFprobe could not enumerate video presentation timestamps for {path.name}")
    return [float(value) for value in values]


def inspect_video(ffprobe: Path, path: Path) -> dict[str, Any]:
    raw = json.loads(
        run(
            [str(ffprobe), "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)]
        )
    )
    video = next((stream for stream in raw.get("streams", []) if stream.get("codec_type") == "video"), None)
    audio = next((stream for stream in raw.get("streams", []) if stream.get("codec_type") == "audio"), None)
    if video is None:
        raise RuntimeError(f"No video stream found in {path.name}")
    frame_rate = Fraction(video.get("avg_frame_rate", "0/1"))
    duration = float(raw.get("format", {}).get("duration", video.get("duration", 0)))
    return {
        "codec": video.get("codec_name"),
        "width": int(video.get("width", 0)),
        "height": int(video.get("height", 0)),
        "fps": float(frame_rate),
        "frameRate": str(frame_rate),
        "durationSeconds": duration,
        "hasAudio": audio is not None,
        "audioCodec": audio.get("codec_name") if audio else None,
        "rotation": next(
            (item.get("rotation") for item in video.get("side_data_list", []) if "rotation" in item),
            video.get("tags", {}).get("rotate"),
        ),
    }


def pcm_sha256(ffmpeg: Path, path: Path) -> tuple[str, int]:
    raw = run(
        [
            str(ffmpeg),
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            "48000",
            "-f",
            "s16le",
            "-c:a",
            "pcm_s16le",
            "-",
        ],
        timeout=600,
    )
    return hashlib.sha256(raw).hexdigest(), len(raw)


def decoded_frame_count(worker: Any, path: Path, expected: dict[str, Any]) -> int:
    info = worker.probe_video(path)
    if (info.width, info.height) != (expected["width"], expected["height"]):
        raise RuntimeError(f"Decoded dimensions changed for {path.name}: {info.width}x{info.height}")
    count = 0
    for frame in worker.open_frame_source(path, info):
        if frame.shape != (expected["height"], expected["width"], 3) or frame.dtype.name != "uint8":
            raise RuntimeError(f"Decoded frame layout changed at frame {count} for {path.name}")
        count += 1
    return count


def review_sample_times(duration_seconds: float, fps: float) -> list[float]:
    return [max(0, min(duration_seconds - 1 / fps, duration_seconds * fraction)) for fraction in (0.12, 0.36, 0.64, 0.9)]


def make_review_sheet(
    worker: Any,
    source: Path,
    output: Path,
    destination: Path,
    fps: float,
    duration_seconds: float,
) -> str:
    import cv2
    from PIL import Image, ImageDraw

    times = review_sample_times(duration_seconds, fps)
    inputs: list[Image.Image] = []
    outputs: list[Image.Image] = []
    for timestamp in times:
        index = int(round(timestamp * fps))
        for path, target in ((source, inputs), (output, outputs)):
            info = worker.probe_video(path)
            capture = cv2.VideoCapture(str(path))
            capture.set(cv2.CAP_PROP_POS_FRAMES, index)
            ok, frame = capture.read()
            capture.release()
            if not ok:
                raise RuntimeError(f"Could not extract review frame {index} from {path.name}")
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(rgb)
            if image.size != (info.width, info.height):
                raise RuntimeError(f"Review frame dimensions changed for {path.name}")
            target.append(image)

    width, height = inputs[0].size
    header = 26
    canvas = Image.new("RGB", (width * 2, (height + header) * len(times)), "white")
    draw = ImageDraw.Draw(canvas)
    for row, timestamp in enumerate(times):
        y = row * (height + header)
        draw.text((8, y + 5), f"Input {timestamp:.1f}s", fill="black")
        draw.text((width + 8, y + 5), f"{output.stem} {timestamp:.1f}s", fill="black")
        canvas.paste(inputs[row], (0, y + header))
        canvas.paste(outputs[row], (width, y + header))
    canvas.save(destination)
    return sha256_file(destination)


def adapter_metrics(engine: str, adapter: Any) -> dict[str, Any]:
    if engine == "sttn":
        return {
            "device": adapter.device,
            "precision": "fp32",
            "parameterDevices": adapter.parameter_devices,
            "mpsFallbackDisabled": adapter.fallback_disabled,
            "stageCalls": adapter.stage_calls,
            "stageTimingsMs": adapter.timings_ms,
            "tiles": adapter.tiles,
            "centerFrames": adapter.frames,
            "peakMpsBytes": adapter.peak_mps_bytes,
            "adapterReleased": adapter.model is None,
        }
    return {
        "device": adapter.device,
        "precision": adapter.precision,
        "parameterDevices": adapter.parameter_devices,
        "parameterDtypes": adapter.parameter_dtypes,
        "mpsFallbackDisabled": adapter.fallback_disabled,
        "stageCalls": adapter.stage_calls,
        "stageTimingsMs": adapter.timings_ms,
        "windows": adapter.windows,
        "centerFrames": adapter.center_frames,
        "peakMpsBytes": adapter.peak_mps_bytes,
        "deformConvCpuIsland": adapter.deform_conv,
        "col2imFoldCpuIsland": adapter.col2im_fold,
        "cropBoundsSeen": adapter.crop_bounds_seen,
        "adapterReleased": adapter.model is None and adapter.flow is None and adapter.raft is None,
    }


def exception_causes(exc: BaseException):
    seen: set[int] = set()
    current: BaseException | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        yield current
        current = current.__cause__ or current.__context__


def capture_failure_diagnostics(
    exc: Exception,
    report: dict[str, Any],
    output_root: Path,
    engine: str,
    adapter: Any | None,
) -> None:
    report["peakRssBytes"] = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)

    if adapter is not None:
        try:
            report["partialAdapterMetrics"] = adapter_metrics(engine, adapter)
        except Exception as metrics_error:
            report["partialAdapterMetricsError"] = f"{type(metrics_error).__name__}: {metrics_error}"

    progress_path = output_root / "mps" / f"{engine}-real-worker-output.progress.json"
    if progress_path.is_file():
        try:
            progress = json.loads(progress_path.read_text(encoding="utf-8"))
            report["workerProgress"] = progress
            report["workerProgressSha256"] = sha256_file(progress_path)
        except Exception as progress_error:
            report["workerProgressReadError"] = f"{type(progress_error).__name__}: {progress_error}"

    failed_command = next(
        (cause for cause in exception_causes(exc) if isinstance(cause, subprocess.CalledProcessError)),
        None,
    )
    if failed_command is not None and failed_command.stderr:
        diagnostics = output_root / "diagnostics"
        diagnostics.mkdir(mode=0o700, exist_ok=True)
        stderr_path = diagnostics / "ffmpeg-stderr.txt"
        stderr = failed_command.stderr
        if isinstance(stderr, str):
            stderr = stderr.encode("utf-8", errors="replace")
        stderr_path.write_bytes(stderr)
        os.chmod(stderr_path, 0o600)
        report["ffmpegFailure"] = {
            "returnCode": failed_command.returncode,
            "stderrPath": str(stderr_path.relative_to(output_root)),
            "stderrSha256": sha256_file(stderr_path),
            "stderrBytes": len(stderr),
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", required=True, choices=["sttn", "propainter"])
    parser.add_argument("--precision", choices=["fp32", "fp16"], default="fp32")
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--input-video", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--mask-x", required=True, type=int)
    parser.add_argument("--mask-y", required=True, type=int)
    parser.add_argument("--mask-width", required=True, type=int)
    parser.add_argument("--mask-height", required=True, type=int)
    parser.add_argument("--start-frame", required=True, type=int)
    parser.add_argument("--end-frame", required=True, type=int)
    args = parser.parse_args()

    assets = args.assets_dir.resolve(strict=True)
    source = args.input_video.resolve(strict=True)
    output_root = args.output_dir.absolute()
    output_root.mkdir(parents=True, mode=0o700, exist_ok=False)
    os.chmod(output_root, 0o700)
    engine_root = assets / "engine-root"
    ffmpeg, ffprobe = assets / "tools/ffmpeg", assets / "tools/ffprobe"
    output_directory = output_root / "mps"
    output_directory.mkdir(mode=0o700)
    output = output_directory / f"{args.engine}-real-worker-output.mp4"
    report_path = output_root / "report.json"

    report: dict[str, Any] = {
        "schemaVersion": 1,
        "caseId": f"M01-real-media-{args.engine}",
        "status": "fail",
        "modelValidation": "not_run",
        "humanQuality": "pending",
        "inputPath": str(source),
        "inputSha256": sha256_file(source),
        "localProcessingAuthorized": True,
        "engine": args.engine,
        "requestedPrecision": args.precision if args.engine == "propainter" else "fp32",
        "mask": {
            "x": args.mask_x,
            "y": args.mask_y,
            "width": args.mask_width,
            "height": args.mask_height,
            "startFrame": args.start_frame,
            "endFrame": args.end_frame,
            "method": "manual rectangle selected from local source frame inspection",
        },
        "assetsManifestSha256": sha256_file(assets / "manifest.json"),
        "adapterSourceSha256": sha256_file(REPO_ROOT / "scripts" / f"video_ai_{args.engine}.py"),
        "probeSourceSha256": sha256_file(Path(__file__).resolve()),
        "ffmpegSha256": sha256_file(ffmpeg),
        "ffprobeSha256": sha256_file(ffprobe),
    }
    started = time.perf_counter()
    adapter = None
    try:
        if (REPO_ROOT / ".env").exists():
            raise RuntimeError("Refusing Worker import because a repository .env file exists")
        os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "0"
        if args.engine == "sttn":
            os.environ["M01_04_STTN_BUNDLE"] = str(engine_root)
        else:
            os.environ["M01_05_PROPAINTER_BUNDLE"] = str(engine_root)
            warnings.filterwarnings(
                "error",
                message=r"The operator .* is not currently supported on the MPS backend and will fall back to run on the CPU.*",
            )

        probe = load_probe(args.engine)
        worker = probe.load_worker(ffmpeg, ffprobe)
        import torch

        if torch.__version__ != "2.6.0" or not torch.backends.mps.is_built() or not torch.backends.mps.is_available():
            raise RuntimeError(f"Expected native MPS with torch 2.6.0; got {torch.__version__}")
        if args.engine == "propainter" and __import__("torchvision").__version__ != "0.21.0":
            raise RuntimeError("Expected torchvision 0.21.0 for the pinned ProPainter environment")

        input_info = inspect_video(ffprobe, source)
        if not 10 <= input_info["durationSeconds"] <= 30:
            raise RuntimeError(f"Real validation source must be 10–30 seconds, got {input_info['durationSeconds']:.3f}")
        if input_info["width"] * input_info["height"] > 1280 * 720:
            raise RuntimeError("Real validation source exceeds the existing 720p pixel-area limit")
        if not input_info["hasAudio"]:
            raise RuntimeError("Real validation source must include its original audio track")
        if input_info["fps"] <= 0:
            raise RuntimeError("Real validation source has no usable frame rate")

        input_pts = frame_pts(ffprobe, source)
        period = 1 / input_info["fps"]
        input_deltas = [right - left for left, right in zip(input_pts, input_pts[1:])]
        if not input_deltas or any(abs(delta - period) > max(0.0005, period * 0.01) for delta in input_deltas):
            raise RuntimeError("Real validation source is not constant-frame-rate within 1% of its nominal period")
        expected = {"width": input_info["width"], "height": input_info["height"], "fps": input_info["fps"], "frames": len(input_pts)}
        if args.mask_width <= 0 or args.mask_height <= 0 or args.mask_x < 0 or args.mask_y < 0:
            raise RuntimeError("Manual subtitle mask has invalid dimensions or origin")
        if args.mask_x + args.mask_width > expected["width"] or args.mask_y + args.mask_height > expected["height"]:
            raise RuntimeError("Manual subtitle mask exceeds the source frame")
        if args.start_frame < 0 or args.end_frame < args.start_frame or args.end_frame >= expected["frames"]:
            raise RuntimeError("Manual subtitle frame range exceeds the source")

        segment = worker.Segment(
            args.mask_x,
            args.mask_y,
            args.mask_width,
            args.mask_height,
            args.start_frame,
            args.end_frame,
        )
        if args.engine == "sttn":
            adapter = probe.MacosSttnAdapter(engine_root, device="mps")
            result, scheduling = probe.run_worker(worker, adapter, source, output, None, [segment])
        else:
            adapter = probe.MacosPropainterAdapter(engine_root, device="mps", precision=args.precision)
            result, scheduling = probe.run_worker(worker, adapter, source, output, [segment])

        metrics = adapter_metrics(args.engine, adapter)
        report["modelValidation"] = "pass"
        report["inference"] = {
            "workerReturned": True,
            "device": "mps",
            "adapter": metrics,
            "sequenceScheduling": scheduling,
        }
        output_info = inspect_video(ffprobe, output)
        output_pts = frame_pts(ffprobe, output)
        if (output_info["width"], output_info["height"]) != (expected["width"], expected["height"]):
            raise RuntimeError(f"Worker output dimensions changed: {output_info}")
        if len(output_pts) != expected["frames"]:
            raise RuntimeError(f"Worker output frame count changed: {len(output_pts)} != {expected['frames']}")
        if (
            abs(output_info["fps"] - expected["fps"]) > 0.01
            or not output_info["hasAudio"]
            or output_info["codec"] != "h264"
            or output_info["audioCodec"] != input_info["audioCodec"]
            or abs(output_info["durationSeconds"] - input_info["durationSeconds"]) > period
        ):
            raise RuntimeError(f"Worker output codec, frame rate, duration, or original audio stream is invalid: {output_info}")
        pts_differences = [abs(left - right) for left, right in zip(input_pts, output_pts, strict=True)]
        if max(pts_differences) > period / 2:
            raise RuntimeError(f"Worker output PTS drift exceeds half a frame: {max(pts_differences)}")
        input_pcm = pcm_sha256(ffmpeg, source)
        output_pcm = pcm_sha256(ffmpeg, output)
        if input_pcm != output_pcm:
            raise RuntimeError("Decoded output audio PCM differs from the original source audio")
        decoded_input = decoded_frame_count(worker, source, expected)
        decoded_output = decoded_frame_count(worker, output, expected)
        if decoded_input != expected["frames"] or decoded_output != expected["frames"]:
            raise RuntimeError(f"Decoded frame count mismatch: input={decoded_input}, output={decoded_output}")
        if scheduling.get("committed_frames") != expected["frames"]:
            raise RuntimeError(f"Sequence scheduler failed the full-frame invariant: {scheduling}")
        if not metrics["adapterReleased"] or worker.manager.has_loaded_model():
            raise RuntimeError("Worker or MPS adapter retained model references after processing")
        if not metrics["mpsFallbackDisabled"]:
            raise RuntimeError("MPS CPU fallback was not disabled")

        contact_sheet = output_root / "review-contact-sheet.png"
        contact_hash = make_review_sheet(
            worker, source, output, contact_sheet, expected["fps"], input_info["durationSeconds"]
        )
        report.update(
            {
                "status": "pass_with_scene_detection_note" if scheduling.get("scenes", 0) < 2 else "pass",
                "modelValidation": "pass",
                "platform": f"{sys.platform}-{platform.machine()}",
                "python": platform.python_version(),
                "torch": torch.__version__,
                "torchvision": __import__("torchvision").__version__ if args.engine == "propainter" else None,
                "input": {**input_info, "frames": expected["frames"], "sha256": report["inputSha256"]},
                "output": {
                    **output_info,
                    "frames": len(output_pts),
                    "path": str(output.relative_to(output_root)),
                    "sha256": sha256_file(output),
                    "audioPcmSha256": output_pcm[0],
                    "audioPcmBytes": output_pcm[1],
                    "audioIdenticalToSource": True,
                },
                "pts": {
                    "inputCfrMaxPeriodErrorSeconds": max(abs(delta - period) for delta in input_deltas),
                    "maxInputOutputDeltaSeconds": max(pts_differences),
                    "inputOutputFramesMatched": len(input_pts) == len(output_pts),
                },
                "workerResult": result,
                "sequenceScheduling": scheduling,
                "sceneDetectionNote": (
                    "The conservative hard-cut detector grouped this real clip as one scene; review visible shot transitions for temporal artifacts."
                    if scheduling.get("scenes", 0) < 2
                    else None
                ),
                "adapter": metrics,
                "reviewContactSheet": {
                    "path": str(contact_sheet.relative_to(output_root)),
                    "sha256": contact_hash,
                    "sampleSeconds": review_sample_times(input_info["durationSeconds"], expected["fps"]),
                },
                "elapsedMilliseconds": round((time.perf_counter() - started) * 1000, 3),
                "peakRssBytes": int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss),
            }
        )
    except Exception as exc:
        report["error"] = {"type": type(exc).__name__, "message": str(exc), "traceback": traceback.format_exc()}
        capture_failure_diagnostics(exc, report, output_root, args.engine, adapter)
        report["elapsedMilliseconds"] = round((time.perf_counter() - started) * 1000, 3)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, separators=(",", ":"), ensure_ascii=False))
    return 0 if str(report["status"]).startswith("pass") else 1


if __name__ == "__main__":
    raise SystemExit(main())
