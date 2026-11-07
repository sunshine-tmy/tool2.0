# 中文模块说明：测试 scripts/video-ai-worker.py 中的稳定行为、边界条件和回归场景
"""Unit tests for the video subtitle removal worker.

All tests use synthetic frames/videos and fake detectors/engines: no model
weights, no network access, and no GPU are required. Heavy third-party packages
are skipped gracefully when absent so the suite stays runnable in minimal envs.
"""

from __future__ import annotations

import errno
import hashlib
import importlib.util
import json
import os
import py_compile
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from typing import TYPE_CHECKING, Protocol
from unittest.mock import patch

import pytest

if TYPE_CHECKING:
    from numpy.typing import NDArray

np = pytest.importorskip("numpy")
cv2 = pytest.importorskip("cv2")
pytest.importorskip("fastapi")
from PIL import Image  # noqa: E402

WORKER_PATH = Path(__file__).with_name("video-ai-worker.py")
LAUNCHER_PATH = WORKER_PATH.with_name("video-ai-worker-launcher.py")
SPEC = importlib.util.spec_from_file_location("video_ai_launcher", LAUNCHER_PATH)
assert SPEC and SPEC.loader
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)
worker = launcher.load_worker(WORKER_PATH)

WIDTH, HEIGHT, FPS, FRAMES = 64, 48, 10, 30


# The signed Worker has a hyphenated filename and is loaded dynamically. Test
# ports describe only the members consumed here, without parallel public DTOs.
class VideoInfoPort(Protocol):
    width: int
    height: int
    fps: float
    frame_count: int
    has_audio: bool
    duration: float


class DetectionsPort(Protocol):
    frame_index: int
    boxes: list[tuple[int, int, int, int]]
    scores: list[float]


class LamaPort(Protocol):
    previous_patch: NDArray | None

    def repair_frame(self, frame_bgr: NDArray, mask: NDArray) -> NDArray: ...


def make_video(
    path: Path, *, subtitle: bool = True, frames: int = FRAMES, size: tuple[int, int] = (WIDTH, HEIGHT)
) -> None:
    """Synthetic video: dark noise background + a bright subtitle bar on frames 5..24."""
    width, height = size
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, size)
    assert writer.isOpened()
    for index in range(frames):
        frame = np.full((height, width, 3), (30, 30, 30), dtype=np.uint8)
        frame[:, :] = (30 + index % 5, 30, 30)  # slight per-frame variation
        if subtitle and 5 <= index < 25:
            frame[height - 12 : height - 2, 8 : width - 8] = 255
        writer.write(frame)
    writer.release()


class FakeDetector:
    """Detector that reports the synthetic subtitle bar only when it is visible."""

    def __init__(self, boxes_by_frame: dict[int, list[tuple[int, int, int, int]]]) -> None:
        self.boxes_by_frame = boxes_by_frame

    def detect_frame(self, frame_bgr, frame_index: int) -> DetectionsPort:
        boxes = self.boxes_by_frame.get(frame_index, [])
        return worker.FrameDetections(frame_index=frame_index, boxes=boxes, scores=[0.9] * len(boxes))


class TrustedPathTests(unittest.TestCase):
    def test_accepts_paths_under_storage_root(self):
        for storage_root in worker.TRUSTED_STORAGE_ROOTS:
            storage_root.mkdir(parents=True, exist_ok=True)
            candidate = storage_root / "inputs" / "task" / "input.bin"
            candidate.parent.mkdir(parents=True, exist_ok=True)
            candidate.write_bytes(b"video")
            self.assertEqual(worker.trusted_path(str(candidate), must_exist=True), candidate.resolve())
            candidate.unlink()

    def test_rejects_paths_outside_storage(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            candidate = Path(temp_dir) / "input.bin"
            candidate.write_bytes(b"video")
            with self.assertRaises(worker.WorkerFailure) as raised:
                worker.trusted_path(str(candidate), must_exist=True)
            self.assertEqual(raised.exception.code, "UNTRUSTED_PATH")

    def test_rejects_missing_input_file(self):
        storage_root = worker.TRUSTED_STORAGE_ROOTS[0]
        storage_root.mkdir(parents=True, exist_ok=True)
        with self.assertRaises(worker.WorkerFailure) as raised:
            worker.trusted_path(str(storage_root / "ghost.mp4"), must_exist=True)
        self.assertEqual(raised.exception.code, "FILE_NOT_FOUND")


class SampleFrameIndicesTests(unittest.TestCase):
    def test_long_video_uses_configured_interval(self):
        info = worker.VideoInfo(width=640, height=360, fps=25.0, frame_count=2500, has_audio=True, duration=100.0)
        indices = worker.sample_frame_indices(info)
        self.assertGreaterEqual(len(indices), 90)
        self.assertEqual(indices[0], 0)
        self.assertLessEqual(indices[-1], 2499)
        self.assertEqual(indices[1] - indices[0], 25)

    def test_short_video_densifies_to_minimum_samples(self):
        info = worker.VideoInfo(width=64, height=48, fps=10.0, frame_count=12, has_audio=False, duration=1.2)
        indices = worker.sample_frame_indices(info)
        self.assertGreaterEqual(len(indices), worker.MIN_SAMPLED_FRAMES)
        self.assertLessEqual(max(indices), 11)

    def test_tiny_video_never_exceeds_frame_count(self):
        info = worker.VideoInfo(width=64, height=48, fps=10.0, frame_count=2, has_audio=False, duration=0.2)
        indices = worker.sample_frame_indices(info)
        self.assertTrue(all(index < 2 for index in indices))


class ClusterDetectionsTests(unittest.TestCase):
    def info(self, frames: int = 100) -> VideoInfoPort:
        return worker.VideoInfo(width=WIDTH, height=HEIGHT, fps=FPS, frame_count=frames, has_audio=False, duration=10.0)

    def detection(self, frame: int, boxes: list[tuple[int, int, int, int]]) -> DetectionsPort:
        return worker.FrameDetections(frame_index=frame, boxes=boxes, scores=[0.9] * len(boxes))

    def test_static_subtitle_collapses_to_single_full_range_segment(self):
        box = (8, HEIGHT - 12, WIDTH - 16, 10)
        detections = [self.detection(frame, [box]) for frame in range(0, 100, 10)]
        segments = worker.cluster_detections(detections, self.info(), sample_step_frames=10)
        self.assertEqual(len(segments), 1)
        segment = segments[0]
        self.assertEqual(segment.start_frame, 0)
        self.assertEqual(segment.end_frame, 99)
        self.assertEqual((segment.x, segment.y), (8, HEIGHT - 12))

    def test_top_and_bottom_lines_stay_separate(self):
        detections = [self.detection(frame, [(8, 2, 40, 8), (8, HEIGHT - 12, 40, 8)]) for frame in range(0, 100, 10)]
        segments = worker.cluster_detections(detections, self.info(), sample_step_frames=10)
        self.assertEqual(len(segments), 2)
        ys = sorted(segment.y for segment in segments)
        self.assertEqual(ys[0], 2)
        self.assertEqual(ys[1], HEIGHT - 12)

    def test_scrolling_ticker_merges_into_one_wide_band(self):
        detections = [
            self.detection(frame, [(min(frame // 2, WIDTH - 20), HEIGHT - 10, 20, 8)]) for frame in range(0, 100, 10)
        ]
        segments = worker.cluster_detections(detections, self.info(), sample_step_frames=10)
        self.assertEqual(len(segments), 1)
        self.assertGreater(segments[0].width, 40)  # union widened across positions

    def test_late_appearing_subtitle_gets_a_bounded_range(self):
        box = (8, HEIGHT - 12, 40, 8)
        detections = [self.detection(frame, [box] if frame >= 50 else []) for frame in range(0, 100, 10)]
        segments = worker.cluster_detections(detections, self.info(), sample_step_frames=10)
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].start_frame, 40)  # 50 - pad(10)
        self.assertEqual(segments[0].end_frame, 99)  # 90 + pad(10), clamped

    def test_empty_detections_produce_no_segments(self):
        detections = [self.detection(frame, []) for frame in range(0, 100, 10)]
        self.assertEqual(worker.cluster_detections(detections, self.info(), 10), [])

    def test_boxes_are_clamped_to_frame_bounds(self):
        detections = [self.detection(0, [(-10, HEIGHT - 5, 30, 30)])]
        segments = worker.cluster_detections(detections, self.info(frames=10), sample_step_frames=10)
        self.assertEqual(segments[0].x, 0)
        self.assertLessEqual(segments[0].y + segments[0].height, HEIGHT)


class MaskForFrameTests(unittest.TestCase):
    def setUp(self):
        self.segment = worker.Segment(x=8, y=36, width=48, height=10, start_frame=5, end_frame=24)

    def test_active_frame_has_region_and_dilation_grows_it(self):
        with patch.object(worker, "MASK_DILATE_PX", 0):
            raw = worker.mask_for_frame([self.segment], 10, WIDTH, HEIGHT)
        self.assertEqual(int(raw[40, 20]), 255)
        dilated = worker.mask_for_frame([self.segment], 10, WIDTH, HEIGHT)
        self.assertGreater(int(dilated.sum()), int(raw.sum()))

    def test_inactive_frame_is_empty(self):
        mask = worker.mask_for_frame([self.segment], 0, WIDTH, HEIGHT)
        self.assertFalse(bool(mask.any()))

    def test_multiple_segments_union(self):
        other = worker.Segment(x=0, y=0, width=10, height=5, start_frame=0, end_frame=99)
        mask = worker.mask_for_frame([self.segment, other], 10, WIDTH, HEIGHT)
        self.assertEqual(int(mask[2, 5]), 255)
        self.assertEqual(int(mask[40, 20]), 255)


class DelogoEngineTests(unittest.TestCase):
    def test_inpaint_recovers_background_under_subtitle(self):
        frame = np.full((HEIGHT, WIDTH, 3), 30, dtype=np.uint8)
        frame[36:46, 8:56] = 255
        mask = worker.mask_for_frame(
            [worker.Segment(x=8, y=36, width=48, height=10, start_frame=0, end_frame=FRAMES - 1)], 0, WIDTH, HEIGHT
        )
        repaired = worker.DelogoEngine().repair_frame(frame, mask)
        self.assertEqual(repaired.shape, frame.shape)
        self.assertLess(float(repaired[36:46, 8:56].mean()), 100.0)

    def test_empty_mask_returns_frame_unchanged(self):
        frame = np.full((HEIGHT, WIDTH, 3), 30, dtype=np.uint8)
        mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
        self.assertTrue(np.array_equal(worker.DelogoEngine().repair_frame(frame, mask), frame))


class FakeLama:
    """Stand-in TorchScript LaMa: fills the masked area with a fixed color."""

    def __init__(self, colors=(255, 255, 255)):
        self.colors = colors
        self.calls = 0

    def __call__(self, image, _mask):
        color = self.colors[min(self.calls, len(self.colors) - 1)]
        self.calls += 1
        return Image.new("RGB", (image.width + 8, image.height + 8), color=(color, color, color))


class LamaEngineTests(unittest.TestCase):
    def make_engine(self, fake: FakeLama) -> LamaPort:
        engine = worker.LamaEngine(worker.ModelManager())
        with patch.object(engine.manager, "get_lama", return_value=fake):
            engine.prepare(worker.VideoInfo(WIDTH, HEIGHT, FPS, FRAMES, False, 3.0))
        return engine

    def test_repairs_only_masked_region_and_preserves_size(self):
        engine = self.make_engine(FakeLama())
        frame = np.full((HEIGHT, WIDTH, 3), 30, dtype=np.uint8)
        mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
        mask[36:46, 8:56] = 255
        output = engine.repair_frame(frame, mask)
        self.assertEqual(output.shape, frame.shape)
        self.assertEqual(int(output[40, 20, 0]), 255)  # repaired pixel (white fill)
        self.assertEqual(int(output[10, 10, 0]), 30)  # untouched pixel

    def test_temporal_smoothing_blends_with_previous_patch(self):
        engine = self.make_engine(FakeLama(colors=(255, 0)))
        frame = np.full((HEIGHT, WIDTH, 3), 30, dtype=np.uint8)
        mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
        mask[36:46, 8:56] = 255
        engine.repair_frame(frame, mask)  # patch = 255
        second = engine.repair_frame(frame, mask)  # new = 0 -> 0.7*0 + 0.3*255
        expected = 0.3 * 255
        self.assertAlmostEqual(float(second[40, 20, 0]), expected, delta=2.0)

    def test_empty_mask_resets_temporal_state(self):
        engine = self.make_engine(FakeLama())
        frame = np.full((HEIGHT, WIDTH, 3), 30, dtype=np.uint8)
        empty = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
        output = engine.repair_frame(frame, empty)
        self.assertIsNone(engine.previous_patch)
        self.assertTrue(np.array_equal(output, frame))


class SequenceEngineLoadingTests(unittest.TestCase):
    def test_missing_engine_raises_explicit_failure(self):
        manager = worker.ModelManager()
        with patch.object(worker, "MODELS_ROOT", Path(tempfile.gettempdir()) / "video-ai-no-such-root"):
            with self.assertRaises(worker.WorkerFailure) as raised:
                manager.get_sequence_engine("sttn", max_load_num=30)
        self.assertEqual(raised.exception.code, "STTN_UNAVAILABLE")

    def test_engine_requires_weights_and_entry_points(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            engine_dir = Path(temp_dir) / "engines" / "sttn"
            engine_dir.mkdir(parents=True)
            (engine_dir / "engine.py").write_text(
                "def create_engine(**kwargs):\n    return object()\n", encoding="utf-8"
            )
            manager = worker.ModelManager()
            with patch.object(worker, "MODELS_ROOT", Path(temp_dir)):
                with self.assertRaises(worker.WorkerFailure) as raised:
                    manager.get_sequence_engine("sttn")
                self.assertEqual(raised.exception.code, "STTN_WEIGHTS_MISSING")
                weights = engine_dir / "weights"
                weights.mkdir()
                (weights / "model.pth").write_bytes(b"mock")
                with self.assertRaises(worker.WorkerFailure) as raised:
                    manager.get_sequence_engine("sttn")
                self.assertEqual(raised.exception.code, "STTN_UNAVAILABLE")  # object() lacks inpaint

    def test_propainter_rejects_above_720p_on_8gb_tier(self):
        engine = worker.ProPainterEngine(worker.ModelManager())
        info = worker.VideoInfo(1920, 1080, FPS, FRAMES, False, 3.0)
        with self.assertRaises(worker.WorkerFailure) as raised:
            engine.prepare(info)
        self.assertEqual(raised.exception.code, "RESOLUTION_TOO_HIGH")


def progress_conflict(source: Path, destination: Path, winerror: int = 5) -> PermissionError:
    error = PermissionError(errno.EACCES, "progress temporarily locked", str(source), None, str(destination))
    error.winerror = winerror
    return error


class ProgressRetryTests(unittest.TestCase):
    def test_new_helpers_execute_signed_source_instead_of_a_matching_stale_bytecode_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            helper = root / "video_ai_sequence.py"
            helper.write_text("VALUE = 'cached'\n", encoding="utf-8")
            stat = helper.stat()
            py_compile.compile(str(helper), doraise=True)
            helper.write_text("VALUE = 'source'\n", encoding="utf-8")
            os.utime(helper, ns=(stat.st_atime_ns, stat.st_mtime_ns))
            baseline = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    "import sys;sys.path.insert(0,sys.argv[1]);import video_ai_sequence;print(video_ai_sequence.VALUE)",
                    str(root),
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            self.assertEqual(baseline.stdout.strip(), "cached")
            entry = root / "worker.py"
            entry.write_text(
                "import video_ai_sequence\nclass ProgressReporter: pass\ndef main(): print(video_ai_sequence.VALUE)\n",
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, "-I", str(LAUNCHER_PATH), str(entry)],
                capture_output=True,
                text=True,
                check=True,
            )
            self.assertEqual(result.stdout.strip(), "source")

    def test_launcher_forwards_cli_and_preserves_source_without_creating_bytecode(self):
        with tempfile.TemporaryDirectory() as directory:
            entry = Path(directory) / "worker 中文.py"
            source = """import json, sys
from pathlib import Path
class ProgressReporter:
    pass
def main():
    print(json.dumps({"argv":sys.argv, "root":str(Path(__file__).parent),
                      "retry":ProgressReporter._toolbox_progress_retry}))
"""
            entry.write_text(source, encoding="utf-8")
            result = subprocess.run(
                [sys.executable, "-I", str(LAUNCHER_PATH), str(entry), "--check", "--port", "3199"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=True,
                timeout=15,
            )
            self.assertEqual(
                json.loads(result.stdout),
                {"argv": [str(entry), "--check", "--port", "3199"], "root": str(entry.parent), "retry": True},
            )
            self.assertEqual(entry.read_text(encoding="utf-8"), source)
            self.assertFalse((entry.parent / "__pycache__").exists())

    def test_retries_only_the_progress_replace_and_bypasses_the_throttle(self):
        for winerror in (5, 32, 33):
            with self.subTest(winerror=winerror), tempfile.TemporaryDirectory() as directory:
                progress = Path(directory) / "progress.json"
                progress.write_text('{"percent":12}', encoding="utf-8")
                reporter = worker.ProgressReporter(progress, 460)
                replace = Path.replace
                attempts = 0

                def locked_twice(source, destination, progress=progress, winerror=winerror, replace=replace):
                    nonlocal attempts
                    attempts += 1
                    if attempts <= 2:
                        # Never delete/truncate the readable snapshot to work around Windows.
                        self.assertEqual(json.loads(progress.read_text(encoding="utf-8"))["percent"], 12)
                        raise progress_conflict(source, destination, winerror)
                    return replace(source, destination)

                with (
                    patch.object(Path, "replace", locked_twice),
                    patch.object(worker.time, "monotonic", return_value=10),
                    patch.object(launcher.time, "sleep") as sleep,
                ):
                    reporter.update("repair", 455)
                self.assertEqual(attempts, 3)
                self.assertEqual(sleep.call_count, 2)
                self.assertEqual(
                    json.loads(progress.read_text(encoding="utf-8")),
                    {"stage": "repair", "processedFrames": 455, "totalFrames": 460, "percent": 98.91},
                )
                self.assertFalse(progress.with_suffix(".tmp").exists())

    def test_persistent_lock_has_a_bound_and_is_not_reported_as_success(self):
        with tempfile.TemporaryDirectory() as directory:
            progress = Path(directory) / "progress.json"
            progress.write_text('{"percent":12}', encoding="utf-8")
            error = progress_conflict(progress.with_suffix(".tmp"), progress)
            with (
                patch.object(Path, "replace", side_effect=error) as replace,
                patch.object(launcher.time, "sleep") as sleep,
                self.assertRaises(PermissionError) as raised,
            ):
                worker.ProgressReporter(progress, 460).update("repair", 455, force=True)
            self.assertIs(raised.exception, error)
            self.assertEqual(replace.call_count, len(launcher.PROGRESS_RETRY_DELAYS) + 1)
            self.assertEqual(sleep.call_count, len(launcher.PROGRESS_RETRY_DELAYS))
            self.assertLess(sum(launcher.PROGRESS_RETRY_DELAYS), 1)
            self.assertEqual(json.loads(progress.read_text(encoding="utf-8"))["percent"], 12)

    def test_unrelated_permissions_and_disk_errors_are_not_retried_or_suppressed(self):
        with tempfile.TemporaryDirectory() as directory:
            progress = Path(directory) / "progress.json"
            errors = [
                PermissionError(errno.EACCES, "permission denied"),
                progress_conflict(progress.with_suffix(".tmp"), progress, 19),
                progress_conflict(progress.with_suffix(".tmp"), progress.with_name("output.mp4")),
                progress_conflict(progress.with_name("other.tmp"), progress),
                OSError(errno.ENOSPC, "disk full"),
            ]
            for error in errors:
                with (
                    self.subTest(error=error),
                    patch.object(Path, "replace", side_effect=error) as replace,
                    patch.object(launcher.time, "sleep") as sleep,
                    self.assertRaises(OSError) as raised,
                ):
                    worker.ProgressReporter(progress, 460).update("repair", 455, force=True)
                self.assertIs(raised.exception, error)
                replace.assert_called_once()
                sleep.assert_not_called()
            with (
                patch.object(Path, "write_text", side_effect=PermissionError("cannot create temporary file")),
                patch.object(launcher.time, "sleep") as sleep,
                self.assertRaises(PermissionError),
            ):
                worker.ProgressReporter(progress, 460).update("repair", 455, force=True)
            sleep.assert_not_called()

    def test_keeps_original_throttling_optional_path_and_idempotent_install(self):
        original = worker.ProgressReporter
        launcher.install_progress_retry(worker)
        self.assertIs(worker.ProgressReporter, original)
        with tempfile.TemporaryDirectory() as directory, patch.object(worker.time, "monotonic", return_value=10):
            progress = Path(directory) / "progress.json"
            reporter = worker.ProgressReporter(progress, 10)
            reporter.update("repair", 3)
            reporter.update("repair", 4)
            self.assertEqual(json.loads(progress.read_text(encoding="utf-8"))["processedFrames"], 3)
            reporter.update("mux", 10, force=True)
            self.assertEqual(json.loads(progress.read_text(encoding="utf-8"))["processedFrames"], 10)
        with patch.object(Path, "write_text") as write:
            worker.ProgressReporter(None, 10).update("repair", 5)
        write.assert_not_called()

    @unittest.skipUnless(sys.platform == "win32", "Windows sharing-handle regression")
    def test_real_windows_reader_temporarily_prevents_replace(self):
        import ctypes
        from ctypes import wintypes

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CreateFileW.argtypes = [
            wintypes.LPCWSTR,
            wintypes.DWORD,
            wintypes.DWORD,
            ctypes.c_void_p,
            wintypes.DWORD,
            wintypes.DWORD,
            wintypes.HANDLE,
        ]
        kernel.CreateFileW.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel.CloseHandle.restype = wintypes.BOOL
        with tempfile.TemporaryDirectory() as directory:
            progress = Path(directory) / "progress.json"
            progress.write_text('{"percent":12}', encoding="utf-8")
            # Read sharing without FILE_SHARE_DELETE: reproduce the reported WinError.
            handle = kernel.CreateFileW(str(progress), 0x80000000, 3, None, 3, 0x80, None)
            self.assertNotEqual(handle, wintypes.HANDLE(-1).value)
            release = threading.Timer(0.08, lambda: kernel.CloseHandle(handle))
            release.start()
            try:
                with patch.object(launcher.time, "sleep", wraps=launcher.time.sleep) as sleep:
                    worker.ProgressReporter(progress, 460).update("repair", 455, force=True)
                self.assertGreater(sleep.call_count, 0)
                self.assertEqual(json.loads(progress.read_text(encoding="utf-8"))["processedFrames"], 455)
            finally:
                release.join()


class SyntheticSequenceEngine:
    name = "balanced"
    sequence_capable = True

    def __init__(self):
        self.windows = []
        self.closed = 0
        self.fail_prepare = False
        self.invalid_output = False
        self.cancel_after_window = None

    def prepare(self, info):
        self.info = info
        if self.fail_prepare:
            raise RuntimeError("partial preparation failed")

    def prepare_sequence(self, info, check):
        check()
        self.prepare(info)

    def repair_window(self, window, check):
        check()
        self.windows.append(window)
        if self.cancel_after_window:
            self.cancel_after_window.write_text("cancel")
        if self.invalid_output:
            return [np.zeros((1, 1), dtype=np.uint8)] * window.center_count
        return [packet.image.copy() for packet in window.centers]

    def close(self):
        self.closed += 1


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.input_path = self.root / "input.mp4"
        self.output_path = self.root / "output.mp4"

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_sequence_worker_writes_every_center_once_with_overlap_and_original_fps(self):
        make_video(self.input_path, frames=33)
        engine = SyntheticSequenceEngine()
        counts = []
        update = worker.ProgressReporter.update

        def progress(reporter, stage, processed, **kwargs):
            if stage == "repair":
                counts.append(processed)
            return update(reporter, stage, processed, **kwargs)

        with (
            patch.object(worker, "build_engine", return_value=engine),
            patch.object(worker.ProgressReporter, "update", progress),
        ):
            result = worker.run_subtitle_removal(
                self.input_path, self.output_path, mode="balanced", manual_area=(8, 32, 40, 10)
            )
        self.assertEqual(result["frameCount"], 33)
        self.assertEqual(counts, list(range(1, 34)))
        self.assertEqual(engine.closed, 1)
        self.assertEqual([packet.index for w in engine.windows for packet in w.centers], list(range(33)))
        self.assertTrue(any(w.center_offset > 0 and len(w.local) > w.center_count for w in engine.windows))
        capture = cv2.VideoCapture(str(self.output_path))
        try:
            self.assertEqual(round(capture.get(cv2.CAP_PROP_FRAME_COUNT)), 33)
            self.assertAlmostEqual(capture.get(cv2.CAP_PROP_FPS), FPS, places=2)
        finally:
            capture.release()
        self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())

    def test_sequence_preparation_failure_releases_engine_without_output(self):
        make_video(self.input_path)
        engine = SyntheticSequenceEngine()
        engine.fail_prepare = True
        with (
            patch.object(worker, "build_engine", return_value=engine),
            self.assertRaisesRegex(RuntimeError, "partial preparation failed"),
        ):
            worker.run_subtitle_removal(self.input_path, self.output_path, mode="balanced", manual_area=(0, 0, 10, 10))
        self.assertEqual(engine.closed, 1)
        self.assertFalse(self.output_path.exists())
        self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())

    def test_partial_sequence_model_is_removed_from_diagnostics_after_preparation_failure(self):
        make_video(self.input_path)
        manager = worker.ModelManager()
        engine = worker.SttnEngine(manager)
        adapter = SyntheticSequenceEngine()
        adapter.fail_prepare = True
        with (
            patch.object(manager, "get_sequence_engine", return_value=adapter),
            patch.object(worker, "build_engine", return_value=engine),
            self.assertRaisesRegex(RuntimeError, "partial preparation failed"),
        ):
            worker.run_subtitle_removal(self.input_path, self.output_path, mode="balanced", manual_area=(0, 0, 10, 10))
        self.assertIsNone(manager.sequence_engine)
        self.assertFalse(manager.has_loaded_model())
        self.assertEqual(adapter.closed, 1)

    def test_sequence_invalid_result_closes_and_removes_intermediate(self):
        make_video(self.input_path)
        engine = SyntheticSequenceEngine()
        original = engine.repair_window

        def become_invalid(window, check):
            engine.invalid_output = len(engine.windows) > 0
            return original(window, check)

        self.enterContext(patch.object(engine, "repair_window", become_invalid))
        with (
            patch.object(worker, "build_engine", return_value=engine),
            self.assertRaises(worker.WorkerFailure) as raised,
        ):
            worker.run_subtitle_removal(self.input_path, self.output_path, mode="balanced", manual_area=(0, 0, 10, 10))
        self.assertEqual(raised.exception.code, "ENGINE_FAILED")
        self.assertGreater(len(engine.windows), 1)
        self.assertEqual(engine.closed, 1)
        self.assertFalse(self.output_path.exists())
        self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())

    def test_sequence_oom_does_not_fallback_or_leave_partial_output_and_fresh_retry_succeeds(self):
        make_video(self.input_path)
        digest = hashlib.sha256(self.input_path.read_bytes()).hexdigest()
        failed, retried = SyntheticSequenceEngine(), SyntheticSequenceEngine()
        original = failed.repair_window

        def fail_second_window(window, check):
            if failed.windows:
                raise RuntimeError("CUDA out of memory in temporal attention")
            return original(window, check)

        with (
            patch.object(failed, "repair_window", fail_second_window),
            patch.object(worker, "build_engine", side_effect=[failed, retried]) as build,
            patch.object(worker.manager, "unload_gpu") as unload,
        ):
            with self.assertRaises(worker.WorkerFailure) as raised:
                worker.run_subtitle_removal(
                    self.input_path, self.output_path, mode="balanced", manual_area=(0, 0, 10, 10)
                )
            self.assertEqual(raised.exception.code, "CUDA_OUT_OF_MEMORY")
            self.assertEqual(build.call_count, 1)
            self.assertFalse(self.output_path.exists())
            self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())
            self.assertEqual(failed.closed, 1)
            unload.assert_called_once()
            result = worker.run_subtitle_removal(
                self.input_path, self.output_path, mode="balanced", manual_area=(0, 0, 10, 10)
            )
            self.assertEqual(build.call_count, 2)
        self.assertEqual(result["frameCount"], FRAMES)
        self.assertEqual(result["provider"], "balanced")
        self.assertEqual(retried.closed, 1)
        self.assertEqual(hashlib.sha256(self.input_path.read_bytes()).hexdigest(), digest)
        self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())

    def test_sequence_cancel_after_inference_never_muxes_a_success_file(self):
        make_video(self.input_path)
        engine = SyntheticSequenceEngine()
        engine.cancel_after_window = self.root / "cancel.flag"
        with patch.object(worker, "build_engine", return_value=engine), self.assertRaises(worker.CancelledError):
            worker.run_subtitle_removal(
                self.input_path,
                self.output_path,
                mode="balanced",
                manual_area=(0, 0, 10, 10),
                cancel_flag_path=engine.cancel_after_window,
            )
        self.assertEqual(engine.closed, 1)
        self.assertFalse(self.output_path.exists())
        self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())

    def test_cancel_during_mux_never_returns_success_and_still_closes_intermediate(self):
        make_video(self.input_path)
        engine = SyntheticSequenceEngine()
        flag = self.root / "cancel.flag"

        def mux(_intermediate, _source, output, **_kwargs):
            output.write_bytes(b"uncommitted-media-owned-by-backend")
            flag.write_text("cancel")

        with patch.object(worker, "build_engine", return_value=engine), patch.object(worker, "remux_with_audio", mux):
            with self.assertRaises(worker.CancelledError):
                worker.run_subtitle_removal(
                    self.input_path,
                    self.output_path,
                    mode="balanced",
                    manual_area=(0, 0, 10, 10),
                    cancel_flag_path=flag,
                )
        self.assertEqual(engine.closed, 1)
        self.assertFalse(self.output_path.with_name("output.video-only.tmp.mp4").exists())

    def test_already_cancelled_passthrough_does_not_write_any_output(self):
        make_video(self.input_path)
        flag = self.root / "cancel.flag"
        flag.write_text("cancel")
        with self.assertRaises(worker.CancelledError):
            worker.run_subtitle_removal(
                self.input_path, self.output_path, mode="delogo", segments=[], cancel_flag_path=flag
            )
        self.assertFalse(self.output_path.exists())

    def test_staged_sequence_resources_remain_disabled_until_adapter_acceptance(self):
        with (
            patch.dict(worker.os.environ, {"VIDEO_AI_STTN_ENGINE_ROOT": str(self.root)}),
            patch("video_ai_engine_assets.read_bundle", return_value={"engine": "sttn", "adapterReady": False}),
        ):
            with self.assertRaises(worker.WorkerFailure) as raised:
                worker.ModelManager().get_sequence_engine("sttn")
            self.assertEqual(raised.exception.code, "STTN_UNAVAILABLE")
            health = {entry["provider"]: entry for entry in worker.engine_health()}
            self.assertFalse(health["balanced"]["available"])

    def test_new_sequence_adapter_resolves_its_gpu_root_and_closes_once(self):
        adapter = SyntheticSequenceEngine()
        with (
            patch.dict(worker.os.environ, {"VIDEO_AI_STTN_ENGINE_ROOT": str(self.root)}),
            patch("video_ai_engine_assets.read_bundle", return_value={"engine": "sttn", "adapterReady": True}),
            patch("video_ai_sttn.SttnAdapter", return_value=adapter) as factory,
            patch.object(worker.ModelManager, "device", return_value="cuda"),
        ):
            engine = worker.SttnEngine(worker.ModelManager())
            engine.prepare_sequence(worker.VideoInfo(WIDTH, HEIGHT, FPS, FRAMES, False, 3), lambda: None)
            factory.assert_called_once_with(self.root, device="cuda")
            engine.close()
            engine.close()
            self.assertEqual(adapter.closed, 1)

    def test_propainter_release_gate_and_new_adapter_error_mapping_remain_explicit(self):
        from video_ai_propainter import ProPainterFailure

        with (
            patch.dict(worker.os.environ, {"VIDEO_AI_PROPAINTER_ENGINE_ROOT": str(self.root)}),
            patch("video_ai_engine_assets.read_bundle", return_value={"engine": "propainter", "adapterReady": False}),
        ):
            with self.assertRaises(worker.WorkerFailure) as raised:
                worker.ModelManager().get_sequence_engine("propainter")
            self.assertEqual(raised.exception.code, "PROPAINTER_UNAVAILABLE")
            self.assertFalse(
                next(item for item in worker.engine_health() if item["provider"] == "extreme")["available"]
            )
        make_video(self.input_path)
        adapter = SyntheticSequenceEngine()
        with (
            patch.object(
                adapter, "prepare", side_effect=ProPainterFailure("CUDA_OUT_OF_MEMORY", "insufficient memory")
            ),
            patch.object(worker, "build_engine", return_value=adapter),
        ):
            with self.assertRaises(worker.WorkerFailure) as raised:
                worker.run_subtitle_removal(
                    self.input_path, self.output_path, mode="extreme", manual_area=(0, 0, 10, 10)
                )
            self.assertEqual(raised.exception.code, "CUDA_OUT_OF_MEMORY")
        self.assertEqual(adapter.closed, 1)
        self.assertFalse(self.output_path.exists())

    def test_propainter_facade_uses_small_window_and_preserves_committed_frame_phase_count(self):
        from video_ai_propainter import PROPAINTER_WINDOW

        class Adapter(SyntheticSequenceEngine):
            def set_stage_callback(self, callback):
                self.callback = callback

            def repair_window(self, window, check):
                self.callback("flow")
                self.callback("propagate")
                return super().repair_window(window, check)

        make_video(self.input_path)
        adapter = Adapter()
        engine = worker.ProPainterEngine(worker.ModelManager())
        phases = []
        update = worker.ProgressReporter.update

        def progress(reporter, stage, processed, **kwargs):
            phases.append((stage, processed))
            return update(reporter, stage, processed, **kwargs)

        with (
            patch.dict(worker.os.environ, {"VIDEO_AI_PROPAINTER_ENGINE_ROOT": str(self.root)}),
            patch("video_ai_engine_assets.read_bundle", return_value={"engine": "propainter", "adapterReady": True}),
            patch("video_ai_propainter.ProPainterAdapter", return_value=adapter) as factory,
            patch.object(worker.ModelManager, "device", return_value="cuda"),
            patch.object(worker, "build_engine", return_value=engine),
            patch.object(worker.ProgressReporter, "update", progress),
        ):
            result = worker.run_subtitle_removal(
                self.input_path, self.output_path, mode="extreme", manual_area=(0, 0, 10, 10)
            )
            factory.assert_called_once_with(self.root, device="cuda")
        self.assertEqual(engine.scheduling_config, PROPAINTER_WINDOW)
        self.assertEqual(result["frameCount"], FRAMES)
        self.assertEqual(result["provider"], "extreme")
        self.assertEqual([count for stage, count in phases if stage == "repair"], list(range(1, FRAMES + 1)))
        self.assertEqual([count for stage, count in phases if stage == "flow"], list(range(0, FRAMES, 2)))
        self.assertEqual(adapter.closed, 1)

    def test_manual_area_delogo_pipeline_produces_matching_video(self):
        make_video(self.input_path)
        progress_path = self.root / "progress.json"
        result = worker.run_subtitle_removal(
            self.input_path,
            self.output_path,
            mode="delogo",
            manual_area=(8, HEIGHT - 12, WIDTH - 16, 10),
            progress_path=progress_path,
        )
        self.assertEqual(result["provider"], "delogo")
        self.assertEqual(result["frameCount"], FRAMES)
        self.assertTrue(self.output_path.is_file())
        progress = json.loads(progress_path.read_text(encoding="utf-8"))
        self.assertEqual(progress["percent"], 100.0)
        self.assertEqual(progress["totalFrames"], FRAMES)
        capture = cv2.VideoCapture(str(self.output_path))
        try:
            self.assertEqual(int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), WIDTH)
            self.assertEqual(int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)), HEIGHT)
            ok, frame = capture.read()
            self.assertTrue(ok)
            self.assertIsNotNone(frame)
        finally:
            capture.release()

    def test_progress_replace_conflict_does_not_abort_video_processing(self):
        make_video(self.input_path)
        progress_path = self.root / "progress.json"
        progress_path.write_text('{"percent":0}', encoding="utf-8")
        replace = Path.replace
        attempts = 0

        def briefly_locked(source, destination):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise progress_conflict(source, destination)
            return replace(source, destination)

        with patch.object(Path, "replace", briefly_locked), patch.object(launcher.time, "sleep") as sleep:
            result = worker.run_subtitle_removal(
                self.input_path,
                self.output_path,
                mode="delogo",
                manual_area=(8, HEIGHT - 12, WIDTH - 16, 10),
                progress_path=progress_path,
            )
        sleep.assert_called_once()
        self.assertEqual(result["frameCount"], FRAMES)
        self.assertTrue(self.output_path.is_file())
        self.assertEqual(json.loads(progress_path.read_text(encoding="utf-8"))["percent"], 100.0)

    def test_detection_driven_pipeline_repairs_only_active_range(self):
        make_video(self.input_path)
        detector = FakeDetector({index: [(8, HEIGHT - 12, WIDTH - 16, 10)] for index in range(0, FRAMES, 10)})
        result = worker.run_subtitle_removal(
            self.input_path,
            self.output_path,
            mode="delogo",
            frame_detector=detector,
        )
        self.assertEqual(result["provider"], "delogo")
        self.assertEqual(len(result["segments"]), 1)
        self.assertEqual(result["frameCount"], FRAMES)
        self.assertTrue(self.output_path.is_file())

    def test_no_subtitle_passthrough_keeps_stream_copy(self):
        make_video(self.input_path, subtitle=False)
        detector = FakeDetector({})
        result = worker.run_subtitle_removal(
            self.input_path,
            self.output_path,
            mode="delogo",
            frame_detector=detector,
        )
        self.assertEqual(result["provider"], "passthrough")
        self.assertEqual(result["segments"], [])
        self.assertIn("未检测到字幕", result["warnings"][0])
        self.assertTrue(self.output_path.is_file())

    def test_cancel_flag_aborts_without_output(self):
        make_video(self.input_path)
        cancel_flag = self.root / "cancel.flag"
        cancel_flag.write_text("1", encoding="utf-8")
        with self.assertRaises(worker.CancelledError):
            worker.run_subtitle_removal(
                self.input_path,
                self.output_path,
                mode="delogo",
                manual_area=(8, HEIGHT - 12, WIDTH - 16, 10),
                cancel_flag_path=cancel_flag,
            )
        self.assertFalse(self.output_path.exists())
        self.assertFalse((self.root / "output.video-only.tmp.mp4").exists())

    def test_invalid_input_fails_explicitly(self):
        self.input_path.write_text("not a video", encoding="utf-8")
        with self.assertRaises(worker.WorkerFailure) as raised:
            worker.run_subtitle_removal(self.input_path, self.output_path, mode="delogo", manual_area=(0, 0, 10, 10))
        self.assertEqual(raised.exception.code, "INVALID_VIDEO")

    def test_different_resolution_video_is_supported(self):
        make_video(self.input_path, size=(96, 64))
        result = worker.run_subtitle_removal(
            self.input_path,
            self.output_path,
            mode="delogo",
            manual_area=(8, 52, 80, 10),
        )
        self.assertEqual(result["frameCount"], FRAMES)
        capture = cv2.VideoCapture(str(self.output_path))
        try:
            self.assertEqual(int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), 96)
            self.assertEqual(int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)), 64)
        finally:
            capture.release()

    def test_unavailable_engine_fails_before_any_output(self):
        make_video(self.input_path)
        with self.assertRaises(worker.WorkerFailure) as raised:
            worker.run_subtitle_removal(
                self.input_path,
                self.output_path,
                mode="balanced",
                manual_area=(8, HEIGHT - 12, WIDTH - 16, 10),
            )
        self.assertEqual(raised.exception.code, "STTN_UNAVAILABLE")
        self.assertFalse(self.output_path.exists())

    def test_segment_model_conversion_clamps_to_bounds(self):
        info = worker.VideoInfo(100, 50, FPS, 10, False, 1.0)
        models = [
            worker.SegmentModel(rect=worker.RectModel(x=-0.5, y=0.8, width=2.0, height=0.4), startFrame=-3, endFrame=99)
        ]
        segments = worker.segments_from_models(models, info)
        self.assertEqual(segments[0].x, 0)
        self.assertEqual(segments[0].width, 100)
        self.assertEqual(segments[0].start_frame, 0)
        self.assertEqual(segments[0].end_frame, 9)


class HealthTests(unittest.IsolatedAsyncioTestCase):
    async def test_light_diagnostics_tracks_sequence_networks_without_loading_or_clearing_other_models(self):
        from types import SimpleNamespace

        manager = worker.ModelManager()
        with patch.object(worker, "manager", manager):
            self.assertFalse((await worker.diagnostics_light())["modelLoaded"])
            for name in ("model", "raft", "flow"):
                manager.sequence_engine = SimpleNamespace(**{name: object()})
                self.assertTrue((await worker.diagnostics_light())["modelLoaded"])
            manager.sequence_engine = None
            self.assertFalse((await worker.diagnostics_light())["modelLoaded"])
            manager.gpu_model = object()
            self.assertTrue((await worker.diagnostics_light())["modelLoaded"])
            original = manager.gpu_model
            await worker.diagnostics_light()
            self.assertIs(manager.gpu_model, original)

    async def test_closing_an_old_engine_does_not_clear_a_new_sequence_diagnostic_owner(self):
        from types import SimpleNamespace

        manager = worker.ModelManager()
        first, second = worker.SttnEngine(manager), worker.SttnEngine(manager)
        one, two = (SimpleNamespace(model=object(), close=lambda: None) for _ in range(2))
        with (
            patch.object(manager, "get_sequence_engine", side_effect=[one, two]),
            patch.object(worker, "manager", manager),
        ):
            info = worker.VideoInfo(WIDTH, HEIGHT, FPS, FRAMES, False, 3)
            first.prepare_sequence(info, lambda: None)
            second.prepare_sequence(info, lambda: None)
            first.close()
            self.assertIs(manager.sequence_engine, two)
            self.assertTrue((await worker.diagnostics_light())["modelLoaded"])
            second.close()
            second.close()
            self.assertIsNone(manager.sequence_engine)
            self.assertFalse((await worker.diagnostics_light())["modelLoaded"])

    async def test_health_reports_engine_availability_without_loading_models(self):
        with patch.object(worker.manager, "get_lama") as load:
            result = await worker.health()
        data = result["data"]
        self.assertEqual(data["protocolVersion"], 1)
        providers = {entry["provider"]: entry["available"] for entry in data["engines"]}
        self.assertTrue(providers["delogo"])  # OpenCV always available
        load.assert_not_called()

    async def test_detect_endpoint_rejects_untrusted_path(self):
        payload = worker.DetectRequest(input_path="C:/Windows/System32/drivers/etc/hosts")
        with self.assertRaises(worker.WorkerFailure) as raised:
            await worker.subtitle_detect(payload)
        self.assertEqual(raised.exception.code, "UNTRUSTED_PATH")

    async def test_auth_middleware_rejects_missing_token(self):
        class FakeRequest:
            class url:
                path = "/process"

            headers: dict[str, str] = {}

        async def call_next(_request):
            return "ok"

        with patch.object(worker, "WORKER_TOKEN", "secret"):
            response = await worker.require_worker_token(FakeRequest(), call_next)
            self.assertEqual(response.status_code, 401)
            with patch.object(FakeRequest, "headers", {"x-toolbox-worker-token": "secret"}):
                self.assertEqual(await worker.require_worker_token(FakeRequest(), call_next), "ok")


if __name__ == "__main__":
    unittest.main()
