"""Explicit, offline S03/S04/S05 CUDA validation; never called by startup or CI.

Uses synthetic media or explicitly supplied footage and an exclusive output
directory, with read-only pinned S02 assets. It does not edit descriptors,
activate tiers or install packages. Real footage quality is reviewed separately.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import runpy
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from unittest.mock import patch


def deny_network(*_args, **_kwargs):
    raise RuntimeError("Network disabled in sequence validation")


def engine_types(worker, name: str):
    from video_ai_propainter import ProPainterAdapter
    from video_ai_sttn import SttnAdapter

    return (
        (ProPainterAdapter, worker.ProPainterEngine, "extreme")
        if name == "propainter"
        else (SttnAdapter, worker.SttnEngine, "balanced")
    )


def validate_propainter_profile(root: Path, peak_host) -> list[dict]:
    """Stress the maximum crop and inspect actual network precision on CUDA."""
    import numpy as np
    import torch
    from video_ai_propainter import ProPainterAdapter
    from video_ai_sequence import FramePacket, SequenceWindow

    reports = []
    for width, height in ((640, 480), (480, 640)):
        adapter = ProPainterAdapter(root)
        torch.cuda.reset_peak_memory_stats()
        started = time.monotonic()
        try:
            adapter.prepare(lambda: None)
            dtypes = {name: str(next(getattr(adapter, name).parameters()).dtype) for name in ("raft", "flow", "model")}
            if dtypes != {"raft": "torch.float32", "flow": "torch.float16", "model": "torch.float16"}:
                raise AssertionError("ProPainter mixed precision profile changed")
            image = np.full((height, width, 3), 40, dtype=np.uint8)
            mask = np.full((height, width), 255, dtype=np.uint8)
            packets = tuple(FramePacket(index, image, mask) for index in range(10, 14))
            references = (FramePacket(0, image, mask), FramePacket(4, image, mask))
            window = SequenceWindow(packets, 1, 2, references, 0, False, False)
            output = adapter.repair_window(window, lambda: None)
            if len(output) != 2 or any(frame.shape != image.shape or frame.dtype != np.uint8 for frame in output):
                raise AssertionError("Maximum-crop output geometry changed")
            reports.append(
                {
                    "case": "propainter-maximum-crop",
                    "width": width,
                    "height": height,
                    "localFrames": 4,
                    "references": 2,
                    "dtypes": dtypes,
                    "seconds": time.monotonic() - started,
                    "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
                    "peakReservedBytes": torch.cuda.max_memory_reserved(),
                    "peakHostWorkingSetBytes": peak_host(),
                    "scope": "allocation/precision/shape stress with a full mask; not a quality measurement",
                }
            )
        finally:
            adapter.close()
        if any(getattr(adapter, name) is not None for name in ("raft", "flow", "model")):
            raise AssertionError("ProPainter retained a network after close")
        reports[-1]["allocatedAfterClose"] = torch.cuda.memory_allocated()
        print(json.dumps(reports[-1]), flush=True)
    return reports


def file_digest(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_area(area: tuple[int, ...], width: int, height: int) -> None:
    x, y, w, h = area
    if min(x, y) < 0 or min(w, h) <= 0 or x + w > width or y + h > height:
        raise ValueError("Manual subtitle area must be inside the original video")


def verify_media(source: list[dict], output: list[dict]) -> dict:
    original = next(stream for stream in source if stream["codec_type"] == "video")
    video = next(stream for stream in output if stream["codec_type"] == "video")
    audios = [stream for stream in output if stream["codec_type"] == "audio"]
    fps = original["avg_frame_rate"]
    numerator, denominator = (int(part) for part in fps.split("/"))
    has_audio = any(stream["codec_type"] == "audio" for stream in source)
    audio_difference = abs(float(audios[0]["duration"]) - float(video["duration"])) if audios else None
    if (
        (video["width"], video["height"]) != (original["width"], original["height"])
        or video["avg_frame_rate"] != fps
        or int(video["nb_frames"]) != int(original["nb_frames"])
        or bool(audios) != has_audio
        or (audio_difference is not None and audio_difference > denominator / numerator)
    ):
        raise AssertionError("Real footage dimensions/frame count/rate/audio contract failed")
    return {
        "width": video["width"],
        "height": video["height"],
        "frames": int(video["nb_frames"]),
        "frameRate": fps,
        "audioCodec": audios[0]["codec_name"] if audios else None,
        "audioVideoDurationDifference": audio_difference,
    }


def validate_footage(args, worker, peak_host) -> None:
    """A/B output through the production pipeline; no copying of source media."""
    import torch

    adapter_type, worker_engine, mode = engine_types(worker, args.engine)

    source = args.input_video.resolve(strict=True)
    digest = file_digest(source)
    info = worker.probe_video(source)
    validate_area(tuple(args.manual_area), info.width, info.height)
    if info.width * info.height > 1280 * 720:
        raise ValueError("Real footage exceeds the initial sequence 720p pixel profile")

    def probe(file):
        return json.loads(
            subprocess.run(
                [str(args.ffprobe), "-v", "error", "-show_streams", "-of", "json", str(file)],
                capture_output=True,
                text=True,
                check=True,
                timeout=120,
            ).stdout
        )["streams"]

    original = probe(source)
    reports = []
    for name in (args.engine, "lama"):
        torch.cuda.reset_peak_memory_stats()
        adapter = adapter_type(args.engine_root) if name != "lama" else None
        manager = worker.ModelManager()
        engine = worker_engine(manager) if adapter is not None else worker.LamaEngine(manager)
        output = args.output / f"real-{name}.mp4"
        started = time.monotonic()
        update = worker.ProgressReporter.update
        samples: list[dict] = []

        def progress(
            reporter, stage, processed, *, name=name, started=started, samples=samples, update=update, **kwargs
        ):
            if stage == "load" or stage == "mux" or (stage == "repair" and processed % 90 == 0):
                measurement = {
                    "engine": name,
                    "stage": stage,
                    "processed": processed,
                    "seconds": round(time.monotonic() - started, 3),
                    "allocatedBytes": torch.cuda.memory_allocated(),
                    "peakHostWorkingSetBytes": peak_host(),
                }
                samples.append(measurement)
                print(json.dumps(measurement), flush=True)
            return update(reporter, stage, processed, **kwargs)

        try:
            # Direct injection bypasses only the closed release flag; all model,
            # mask, scheduling, decoding, writing and mux code is production code.
            with (
                patch.object(manager, "get_sequence_engine", return_value=adapter),
                patch.object(worker, "build_engine", return_value=engine),
                patch.object(worker.ProgressReporter, "update", progress),
            ):
                result = worker.run_subtitle_removal(
                    source,
                    output,
                    mode=mode if name != "lama" else "fast",
                    manual_area=tuple(args.manual_area),
                    progress_path=args.output / f"{name}-progress.json",
                )
            media = verify_media(original, probe(output))
            if result["frameCount"] != media["frames"] or file_digest(source) != digest:
                raise AssertionError("Real source changed or decoded frames were lost")
            if adapter is not None and (
                any(getattr(adapter, key, None) is not None for key in ("model", "raft", "flow"))
                or engine.module is not None
            ):
                raise AssertionError("Sequence model was not released")
            reports.append(
                {
                    "engine": name,
                    "output": output.name,
                    "seconds": time.monotonic() - started,
                    "media": media,
                    "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
                    "peakReservedBytes": torch.cuda.max_memory_reserved(),
                    "peakHostWorkingSetBytes": peak_host(),
                    "samples": samples,
                    "sourceUnchanged": True,
                    "intermediateRemoved": not output.with_name(f"real-{name}.video-only.tmp.mp4").exists(),
                }
            )
        finally:
            engine.close()
            # The old LaMa engine caches its model at Worker scope. This probe
            # owns its manager and releases only that isolated process's model.
            if name == "lama":
                engine.model = None
                engine.previous_patch = None
            manager.unload_gpu()
        reports[-1]["allocatedAfterClose"] = torch.cuda.memory_allocated()
        with (args.output / f"{name}-report.json").open("x", encoding="utf-8") as handle:
            json.dump(reports[-1], handle, indent=2)
        print(json.dumps(reports[-1]), flush=True)
    with (args.output / "report.json").open("x", encoding="utf-8") as handle:
        json.dump(
            {
                "input": str(source),
                "inputSha256": digest,
                "manualArea": args.manual_area,
                "maskDilationPixels": worker.MASK_DILATE_PX,
                "networkBlocked": True,
                "device": torch.cuda.get_device_name(),
                "torch": torch.__version__,
                "sourceDigests": {file.name: file_digest(file) for file in (args.output / "scripts").glob("*.py")},
                "scope": "real footage media/lifecycle checks; visual quality pending user review; no tier activation",
                "results": reports,
            },
            handle,
            indent=2,
        )


def validate_cancellation(worker, engine_root: Path, source_video: Path, directory: Path, engine_name="sttn") -> dict:
    adapter_type, worker_engine, mode = engine_types(worker, engine_name)

    directory.mkdir()
    flag = directory / "cancel.flag"
    output = directory / "output.mp4"
    signalled: list[float] = []
    timers: list[threading.Timer] = []

    def stop():
        flag.write_text("cancel", encoding="utf-8")
        signalled.append(time.monotonic())

    adapter = adapter_type(engine_root)
    operation = "_flow_pair" if engine_name == "propainter" else "_predict_tile"
    original = getattr(adapter, operation)
    calls = 0

    def cancellable(*args):
        nonlocal calls
        calls += 1
        if calls == 2:
            timer = threading.Timer(0.03, stop)
            timers.append(timer)
            timer.start()
        return original(*args)

    engine = worker_engine(worker.ModelManager())
    digest = hashlib.sha256(source_video.read_bytes()).hexdigest()
    try:
        with (
            patch.object(engine.manager, "get_sequence_engine", return_value=adapter),
            patch.object(worker, "build_engine", return_value=engine),
            patch.object(adapter, operation, cancellable),
        ):
            try:
                worker.run_subtitle_removal(
                    source_video,
                    output,
                    mode=mode,
                    manual_area=(43, 160, 345, 65),
                    progress_path=directory / "progress.json",
                    cancel_flag_path=flag,
                )
            except worker.CancelledError:
                pass
            else:
                raise AssertionError("Cancelled GPU task returned success")
        for timer in timers:
            timer.join()
        if not signalled:
            raise AssertionError("Cancellation never reached inference")
        latency = time.monotonic() - signalled[0]
        if (
            output.exists()
            or output.with_name("output.video-only.tmp.mp4").exists()
            or engine.module is not None
            or any(getattr(adapter, key, None) is not None for key in ("model", "raft", "flow"))
            or latency > 5
            or hashlib.sha256(source_video.read_bytes()).hexdigest() != digest
        ):
            raise AssertionError("GPU cancellation leaked output/model or exceeded 5 seconds")
        report = {
            "case": "gpu-cancel-after-first-window",
            "cancelLatencySeconds": latency,
            "noSuccessOutput": True,
            "intermediateRemoved": True,
            "modelClosed": True,
            "sourceUnchanged": True,
        }
        with (directory / "report.json").open("x", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
        return report
    finally:
        for timer in timers:
            timer.join()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine-root", type=Path, required=True)
    parser.add_argument("--engine", choices=("sttn", "propainter"), default="sttn")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--ffprobe", type=Path, required=True)
    parser.add_argument("--lama-model", type=Path, required=True)
    parser.add_argument("--worker-frames", type=int, choices=(17, 3600), default=17)
    parser.add_argument("--input-video", type=Path)
    parser.add_argument("--manual-area", type=int, nargs=4, metavar=("X", "Y", "WIDTH", "HEIGHT"))
    args = parser.parse_args()
    if (args.input_video is None) != (args.manual_area is None):
        parser.error("Real footage requires both --input-video and --manual-area (original pixels)")
    if args.input_video is not None and not args.input_video.is_file():
        raise ValueError("Use an existing, explicitly supplied source video")
    for executable in (args.ffmpeg, args.ffprobe):
        if not executable.is_file():
            raise ValueError("Use explicitly prepared FFmpeg/FFprobe executables")
    if not args.lama_model.is_file():
        raise ValueError("Use an explicitly prepared LaMa checkpoint for comparison")
    if args.output.exists() or args.output.is_symlink() or args.output.is_junction():
        raise ValueError("Validation output must be a new directory")
    args.output.mkdir(parents=False)
    scripts = args.output / "scripts"
    scripts.mkdir()
    for filename in (
        "video-ai-worker.py",
        "video-ai-worker-launcher.py",
        "video_ai_engine_assets.py",
        "video_ai_sequence.py",
        "video_ai_sttn.py",
        "video_ai_propainter.py",
    ):
        shutil.copyfile(Path(__file__).with_name(filename), scripts / filename)
    # The copied Worker is anchored to synthetic storage, never the repo .env.
    os.environ["VIDEO_AI_STORAGE_ROOT"] = str(args.output / "storage")
    os.environ["FFMPEG_PATH"] = str(args.ffmpeg.resolve())
    os.environ["FFPROBE_PATH"] = str(args.ffprobe.resolve())
    os.environ["VIDEO_AI_DEVICE"] = "cuda"
    os.environ["VIDEO_AI_LAMA_MODEL"] = str(args.lama_model.resolve())
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
    sys.dont_write_bytecode = True
    # Keep these guards active for this explicitly launched CLI process.
    patch.object(socket.socket, "connect", deny_network).start()
    patch.object(socket.socket, "connect_ex", deny_network).start()
    socket.create_connection = deny_network
    spec = importlib.util.spec_from_file_location(
        "probe_video_worker_launcher", scripts / "video-ai-worker-launcher.py"
    )
    assert spec and spec.loader
    launcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(launcher)
    sys.meta_path.insert(0, launcher.SequenceHelperFinder(scripts))
    sys.path.insert(0, str(scripts))
    import cv2
    import numpy as np
    import torch
    from video_ai_sequence import FramePacket, run_sequence

    if sys.version_info[:2] != (3, 12) or torch.__version__ != "2.6.0+cu124" or not torch.cuda.is_available():
        raise RuntimeError("Use the validated Python 3.12 / CUDA 12.4 video runtime")
    peak_host = runpy.run_path(str(Path(__file__).with_name("validate-video-ai-sequence.py")))["peak_host_working_set"]
    worker = launcher.load_worker(scripts / "video-ai-worker.py")
    worker.FFMPEG, worker.FFPROBE = str(args.ffmpeg), str(args.ffprobe)
    adapter_type, worker_engine, mode = engine_types(worker, args.engine)

    if args.input_video is not None:
        validate_footage(args, worker, peak_host)
        return

    def clean_frame(index, width, height, cut):
        yy, xx = np.indices((height, width))
        base = ((xx // 10 + yy // 18 + index // 3) % 60 + 45).astype(np.uint8)
        if cut is not None and index >= cut:
            base = 255 - base
        frame = np.stack((base, np.minimum(base.astype(int) + 10, 255), base), axis=-1).astype(np.uint8)
        x = (index * 11) % max(1, width - 60)
        cv2.rectangle(
            frame, (x, height // 2), (min(width - 1, x + 50), min(height - 1, height // 2 + 40)), (40, 90, 160), -1
        )
        return frame

    def sample(index, width, height, cut=None):
        clean = clean_frame(index, width, height, cut)
        image = clean.copy()
        mask = np.zeros((height, width), dtype=np.uint8)
        mask[max(0, height - 80) : height - 15, width // 10 : width * 9 // 10] = 255
        cv2.putText(
            image,
            f"Sample subtitle {index % 5}",
            (width // 8, height - 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            min(1.0, width / 640),
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        return clean, FramePacket(index, image, mask)

    reports = validate_propainter_profile(args.engine_root, peak_host) if args.engine == "propainter" else []
    landscape_size = (1280, 720) if args.engine == "sttn" else (640, 480)
    portrait_size = (720, 1280) if args.engine == "sttn" else (480, 640)
    for name, width, height, count, cut in (
        ("landscape-cut", *landscape_size, 41, 19),
        ("portrait", *portrait_size, 17, None),
        ("short-padding", 321, 199, 1, None),
        ("long-bounded", 432, 240, 180, None),
    ):
        torch.cuda.reset_peak_memory_stats()
        adapter = adapter_type(args.engine_root)
        frames_written = 0
        before_error = after_error = pixels = 0.0
        allocations: list[int] = []
        started = time.monotonic()

        def source(count=count, width=width, height=height, cut=cut):
            for index in range(count):
                yield sample(index, width, height, cut)[1]

        def write(frame, width=width, height=height, cut=cut, allocations=allocations):
            nonlocal frames_written, before_error, after_error, pixels
            clean, original = sample(frames_written, width, height, cut)
            mask = original.mask > 0
            if not np.array_equal(frame[~mask], original.image[~mask]):
                raise AssertionError("Unmasked pixels changed before encoding")
            before_error += np.abs(original.image[mask].astype(float) - clean[mask]).sum()
            after_error += np.abs(frame[mask].astype(float) - clean[mask]).sum()
            pixels += int(mask.sum()) * 3
            frames_written += 1
            allocations.append(torch.cuda.memory_allocated())

        result = run_sequence(
            source(),
            adapter,
            width=width,
            height=height,
            check_cancelled=lambda: None,
            write_frame=write,
            progress=lambda _: None,
            config=adapter.window_config,
        )
        torch.cuda.synchronize()
        report = {
            "case": name,
            "width": width,
            "height": height,
            "frames": frames_written,
            "windows": result.windows,
            "scenes": result.scenes,
            "peakCachedFrames": result.peak_cached_frames,
            "seconds": time.monotonic() - started,
            "maskedMaeBefore": before_error / pixels,
            "maskedMaeAfter": after_error / pixels,
            "outsideMaskUnchanged": True,
            "peakAllocatedBytes": torch.cuda.max_memory_allocated(),
            "peakReservedBytes": torch.cuda.max_memory_reserved(),
            "allocatedAfterClose": torch.cuda.memory_allocated(),
            "peakHostWorkingSetBytes": peak_host(),
            "allocationsAfterWarmup": allocations[16::16],
        }
        if (
            frames_written != count
            or result.peak_cached_frames > adapter.window_config.max_cached_frames
            or adapter.model is not None
        ):
            raise AssertionError("Frame count, cache bound or model cleanup failed")
        reports.append(report)
        print(json.dumps(report), flush=True)

    worker = launcher.load_worker(scripts / "video-ai-worker.py")
    # Explicit media paths avoid borrowing any environment or repository config.
    worker.FFMPEG, worker.FFPROBE = str(args.ffmpeg), str(args.ffprobe)
    video_only, source_video, output_video = (
        args.output / name for name in ("source-video.mp4", "input.mp4", "output.mp4")
    )
    # Native-size long case measures the same real decoder/scheduler/writer/mux
    # over two minutes of 29.97 fps media without upscaling synthetic frames.
    width, height, fps, count = 432, 240, 30000 / 1001, args.worker_frames
    writer = cv2.VideoWriter(str(video_only), cv2.VideoWriter.fourcc(*"mp4v"), fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError("Cannot create synthetic input")
    try:
        for index in range(count):
            writer.write(sample(index, width, height)[1].image)
    finally:
        writer.release()
    subprocess.run(
        [
            str(args.ffmpeg),
            "-v",
            "error",
            "-i",
            str(video_only),
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:sample_rate=48000",
            "-map",
            "0:v",
            "-map",
            "1:a",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-t",
            str(count / fps),
            str(source_video),
        ],
        check=True,
        timeout=30,
    )
    digest = hashlib.sha256(source_video.read_bytes()).hexdigest()
    engine = worker_engine(worker.ModelManager())
    progress_update = worker.ProgressReporter.update
    long_samples = []

    def progress(reporter, stage, processed, **kwargs):
        if stage == "repair" and processed % 180 == 0:
            measurement = {
                "processed": processed,
                "allocatedBytes": torch.cuda.memory_allocated(),
                "peakHostWorkingSetBytes": peak_host(),
            }
            long_samples.append(measurement)
            print(json.dumps({"longWorkerProgress": measurement}), flush=True)
        return progress_update(reporter, stage, processed, **kwargs)

    # Only the release gate is bypassed in this explicit probe. Model inference,
    # scheduling, decoding, writer, progress and mux all use production code.
    with (
        patch.object(engine.manager, "get_sequence_engine", return_value=adapter_type(args.engine_root)),
        patch.object(worker, "build_engine", return_value=engine),
        patch.object(worker.ProgressReporter, "update", progress),
    ):
        result = worker.run_subtitle_removal(
            source_video,
            output_video,
            mode=mode,
            manual_area=(width // 10, height - 80, width * 8 // 10, 65),
            progress_path=args.output / "progress.json",
        )

    def probe(file):
        return json.loads(
            subprocess.run(
                [str(args.ffprobe), "-v", "error", "-show_streams", "-of", "json", str(file)],
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            ).stdout
        )["streams"]

    source_streams, output_streams = probe(source_video), probe(output_video)
    source_v = next(stream for stream in source_streams if stream["codec_type"] == "video")
    output_v = next(stream for stream in output_streams if stream["codec_type"] == "video")
    output_a = next(stream for stream in output_streams if stream["codec_type"] == "audio")
    if (
        int(output_v["nb_frames"]) != count
        or (output_v["width"], output_v["height"]) != (width, height)
        or source_v["avg_frame_rate"] != output_v["avg_frame_rate"]
        or abs(float(output_a["duration"]) - float(output_v["duration"])) > 1 / fps
        or hashlib.sha256(source_video.read_bytes()).hexdigest() != digest
        or engine.module is not None
    ):
        raise AssertionError("Worker media/source/lifecycle contract failed")
    reports.append(
        {
            "case": "worker-audio-29.97",
            "provider": result["provider"],
            "frames": result["frameCount"],
            "frameRate": output_v["avg_frame_rate"],
            "audioCodec": output_a["codec_name"],
            "audioVideoDurationDifference": abs(float(output_a["duration"]) - float(output_v["duration"])),
            "sourceUnchanged": True,
            "modelClosed": True,
            "memorySamples": long_samples,
        }
    )
    print(json.dumps(reports[-1]), flush=True)
    # Same synthetic clip/mask as the landscape STTN run, with the existing
    # production LaMa adapter; this is a measured baseline, not a quality claim.
    lama_manager = worker.ModelManager()
    lama = worker.LamaEngine(lama_manager)
    error_before = error_after = selected_pixels = 0.0
    started = time.monotonic()
    try:
        lama.prepare(worker.VideoInfo(*landscape_size, 30, 41, False, 41 / 30))
        for index in range(41):
            clean, packet = sample(index, *landscape_size, 19)
            output = lama.repair_frame(packet.image, packet.mask)
            selected = packet.mask > 0
            if not np.array_equal(output[~selected], packet.image[~selected]):
                raise AssertionError("LaMa exterior changed")
            error_before += np.abs(packet.image[selected].astype(float) - clean[selected]).sum()
            error_after += np.abs(output[selected].astype(float) - clean[selected]).sum()
            selected_pixels += int(selected.sum()) * 3
    finally:
        lama.close()
        lama.model = None
        lama_manager.unload_gpu()
    reports.append(
        {
            "case": "lama-same-landscape-baseline",
            "frames": 41,
            "maskedMaeBefore": error_before / selected_pixels,
            "maskedMaeAfter": error_after / selected_pixels,
            "seconds": time.monotonic() - started,
        }
    )
    reports.append(
        validate_cancellation(worker, args.engine_root, source_video, args.output / "cancellation", args.engine)
    )
    with (args.output / "report.json").open("x", encoding="utf-8") as handle:
        json.dump(
            {
                "device": torch.cuda.get_device_name(),
                "torch": torch.__version__,
                "engine": args.engine,
                "networkBlocked": True,
                "sourceDigests": {
                    file.name: hashlib.sha256(file.read_bytes()).hexdigest() for file in scripts.glob("*.py")
                },
                "scope": "synthetic integration only; real footage quality and release acceptance pending",
                "results": reports,
            },
            handle,
            indent=2,
        )
    print(json.dumps(reports[-1]), flush=True)


if __name__ == "__main__":
    main()
