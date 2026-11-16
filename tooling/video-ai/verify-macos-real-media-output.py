"""Verify an existing real-media Worker output without rerunning model inference."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

TOOL_DIR = Path(__file__).resolve().parent


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_real_probe() -> Any:
    path = TOOL_DIR / "macos-real-media-probe.py"
    name = "toolbox_macos_real_media_probe_for_output_verification"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the real-media probe helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def scheduler_scenes(probe: Any, worker: Any, source: Path, engine: str) -> dict[str, Any]:
    import numpy as np
    from video_ai_sequence import FramePacket, sequence_windows

    info = worker.probe_video(source)
    config = probe.STTN_WINDOW if engine == "sttn" else probe.PROPAINTER_WINDOW
    scenes: set[int] = set()
    last_center = -1

    def packets():
        for index, image in enumerate(worker.open_frame_source(source, info)):
            yield FramePacket(index=index, image=image, mask=np.zeros((info.height, info.width), dtype=np.uint8))

    for window in sequence_windows(packets(), config=config, check_cancelled=lambda: None):
        scenes.add(window.scene)
        last_center = window.centers[-1].index
    return {"scenes": len(scenes), "lastCenterFrame": last_center}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", required=True, choices=["sttn", "propainter"])
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--input-video", required=True, type=Path)
    parser.add_argument("--output-video", required=True, type=Path)
    parser.add_argument("--prior-run-report", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()

    assets = args.assets_dir.resolve(strict=True)
    source = args.input_video.resolve(strict=True)
    output = args.output_video.resolve(strict=True)
    prior_report_path = args.prior_run_report.resolve(strict=True)
    output_root = args.output_dir.resolve(strict=True)
    report_path = output_root / "output-verification.json"
    contact_sheet = output_root / "real-media-review-contact-sheet.png"
    if report_path.exists() or contact_sheet.exists():
        raise FileExistsError("Refusing to overwrite an existing verification report or review sheet")

    prior = json.loads(prior_report_path.read_text(encoding="utf-8"))
    probe = load_real_probe()
    if prior.get("caseId") != f"M01-real-media-{args.engine}":
        raise RuntimeError("Prior run report does not match the requested engine")
    if prior.get("inputSha256") != sha256_file(source):
        raise RuntimeError("Input video SHA-256 differs from the prior model run")
    if prior.get("modelValidation") != "pass" or prior.get("inference", {}).get("workerReturned") is not True:
        raise RuntimeError("Prior run did not record a completed Worker inference")

    ffmpeg, ffprobe = assets / "tools/ffmpeg", assets / "tools/ffprobe"
    worker_probe = probe.load_probe(args.engine)
    worker = worker_probe.load_worker(ffmpeg, ffprobe)
    input_info = probe.inspect_video(ffprobe, source)
    output_info = probe.inspect_video(ffprobe, output)
    input_pts = probe.frame_pts(ffprobe, source)
    output_pts = probe.frame_pts(ffprobe, output)
    period = 1 / input_info["fps"]
    expected_frames = len(input_pts)
    pts_differences = [abs(left - right) for left, right in zip(input_pts, output_pts)]
    input_pcm = probe.pcm_sha256(ffmpeg, source)
    output_pcm = probe.pcm_sha256(ffmpeg, output)
    expected = {"width": input_info["width"], "height": input_info["height"]}
    input_decoded = probe.decoded_frame_count(worker, source, expected)
    output_decoded = probe.decoded_frame_count(worker, output, expected)
    scenes = scheduler_scenes(worker_probe, worker, source, args.engine)
    contact_hash = probe.make_review_sheet(
        worker,
        source,
        output,
        contact_sheet,
        input_info["fps"],
        input_info["durationSeconds"],
    )

    failures: list[str] = []
    if (output_info["width"], output_info["height"]) != (input_info["width"], input_info["height"]):
        failures.append("output_dimensions_changed")
    if len(output_pts) != expected_frames or input_decoded != expected_frames or output_decoded != expected_frames:
        failures.append("frame_count_changed")
    if abs(output_info["fps"] - input_info["fps"]) > 0.01:
        failures.append("frame_rate_changed")
    if not input_info["hasAudio"] or not output_info["hasAudio"]:
        failures.append("audio_stream_missing")
    if output_info["codec"] != "h264":
        failures.append("output_not_h264")
    if output_info["audioCodec"] != input_info["audioCodec"]:
        failures.append("audio_codec_changed")
    if abs(output_info["durationSeconds"] - input_info["durationSeconds"]) > period:
        failures.append("duration_changed")
    if len(output_pts) != expected_frames or max(pts_differences, default=float("inf")) > period / 2:
        failures.append("presentation_timestamps_changed")
    if input_pcm != output_pcm:
        failures.append("original_audio_pcm_changed")
    if scenes["lastCenterFrame"] != expected_frames - 1:
        failures.append("sequence_scheduler_missed_final_frame")

    captured_metrics = prior.get("inference", {}).get("adapter") or prior.get("partialAdapterMetrics")
    current_probe_sha256 = sha256_file(TOOL_DIR / "macos-real-media-probe.py")
    report = {
        "schemaVersion": 1,
        "caseId": f"M01-real-media-{args.engine}-output-verification",
        "status": "pass_with_scene_detection_note" if not failures else "fail",
        "modelValidation": "pass" if not failures else "partial",
        "humanQuality": "pending",
        "originalRun": {
            "reportPath": str(prior_report_path),
            "reportSha256": sha256_file(prior_report_path),
            "reportStatus": prior.get("status"),
            "probeSourceSha256": prior.get("probeSourceSha256"),
            "verificationProbeSourceSha256": current_probe_sha256,
            "probeSourceChangedSinceInference": prior.get("probeSourceSha256") != current_probe_sha256,
            "inferenceReturned": True,
            "modelDevice": "mps",
            "modelMetricsCaptured": isinstance(captured_metrics, dict),
            "adapterMetrics": captured_metrics,
        },
        "input": {**input_info, "frames": expected_frames, "sha256": sha256_file(source)},
        "output": {
            **output_info,
            "frames": len(output_pts),
            "path": str(output),
            "sha256": sha256_file(output),
            "audioPcmSha256": output_pcm[0],
            "audioPcmBytes": output_pcm[1],
            "audioIdenticalToSource": input_pcm == output_pcm,
        },
        "pts": {
            "maxInputOutputDeltaSeconds": max(pts_differences, default=None),
            "inputOutputFramesMatched": len(input_pts) == len(output_pts),
        },
        "sequenceScheduler": {
            **scenes,
            "note": (
                "The conservative hard-cut detector grouped this real clip as one scene. Review visible shot transitions for temporal artifacts."
                if scenes["scenes"] < 2
                else None
            ),
        },
        "reviewContactSheet": {"path": str(contact_sheet), "sha256": contact_hash},
        "failures": failures,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, separators=(",", ":"), ensure_ascii=False))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
