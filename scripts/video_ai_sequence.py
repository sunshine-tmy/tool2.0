"""Bounded, scene-local temporal windows for the video AI sequence adapters.

This module owns no files, queues or global models. The Worker remains the owner
of decoding, the intermediate writer and final media commit. References are kept
separate from contiguous local frames so optical flow cannot join sparse frames.
"""

from __future__ import annotations

import sys
from collections import deque
from collections.abc import Callable, Iterable, Iterator, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

CancelCheck = Callable[[], None]


@dataclass(frozen=True)
class WindowConfig:
    center: int = 8
    before: int = 4
    after: int = 4
    history: int = 16
    references: int = 4

    def __post_init__(self) -> None:
        limits = (
            (self.center, 1, 8),
            (self.before, 0, 4),
            (self.after, 0, 4),
            (self.history, self.before, 16),
            (self.references, 0, 4),
        )
        if any(type(value) is not int or not low <= value <= high for value, low, high in limits):
            raise ValueError("Sequence window exceeds the validated scheduling bounds")

    @property
    def max_cached_frames(self) -> int:
        # Includes one decoded frame held across a scene boundary. Model tensors,
        # center snapshots and output arrays are separate bounded adapter costs.
        return self.history + self.center + self.after + 1


@dataclass(frozen=True)
class FramePacket:
    index: int
    image: Any
    mask: Any


@dataclass(frozen=True)
class SequenceWindow:
    local: tuple[FramePacket, ...]
    center_offset: int
    center_count: int
    references: tuple[FramePacket, ...]
    scene: int
    first: bool
    last: bool

    @property
    def centers(self) -> tuple[FramePacket, ...]:
        return self.local[self.center_offset : self.center_offset + self.center_count]


@dataclass
class RunStats:
    committed_frames: int = 0
    windows: int = 0
    scenes: int = 0
    peak_cached_frames: int = 0


def scene_cut(previous: FramePacket, current: FramePacket) -> bool:
    """Conservative hard-cut candidate, using only a small luma thumbnail.

    Both spatial difference and histogram change must be large; flashes and
    fast motion still need real-video quality evaluation before tier release.
    """
    import cv2
    import numpy as np

    def thumbnail(packet: FramePacket) -> Any:
        small = cv2.resize(packet.image, (64, 36), interpolation=cv2.INTER_AREA)
        return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    left, right = thumbnail(previous), thumbnail(current)
    difference = float(np.abs(left.astype(np.float32) - right).mean()) / 255.0
    if difference < 0.4:
        return False
    left_hist = np.histogram(left, bins=16, range=(0, 256))[0] / left.size
    right_hist = np.histogram(right, bins=16, range=(0, 256))[0] / right.size
    return float(np.abs(left_hist - right_hist).sum()) >= 1.2


def _references(history: deque[FramePacket], before: int, count: int) -> tuple[FramePacket, ...]:
    candidates = tuple(history)[: len(history) - before] if before else tuple(history)
    count = min(count, len(candidates))
    if count == 0:
        return ()
    if count == 1:
        return (candidates[-1],)
    return tuple(candidates[round(index * (len(candidates) - 1) / (count - 1))] for index in range(count))


def sequence_windows(
    packets: Iterable[FramePacket],
    *,
    config: WindowConfig,
    check_cancelled: CancelCheck,
    is_scene_cut: Callable[[FramePacket, FramePacket], bool] = scene_cut,
    stats: RunStats | None = None,
) -> Iterator[SequenceWindow]:
    """Stream one scene at a time; no frame duplication or synthetic padding.

    Missing first/last context is represented by shorter local windows. Adapters
    must handle this explicitly, including a one-frame scene. Every packet is a
    center exactly once. Past references never become optical-flow neighbours.
    """
    source = iter(packets)
    history: deque[FramePacket] = deque(maxlen=config.history)
    upcoming: list[FramePacket] = []
    pending: FramePacket | None = None
    previous: FramePacket | None = None
    decoded = scene = scene_start = 0
    ended = boundary = False
    try:
        while True:
            check_cancelled()
            if pending is not None and not boundary:
                upcoming.append(pending)
                previous, pending = pending, None
            while not ended and not boundary and len(upcoming) < config.center + config.after:
                check_cancelled()
                try:
                    packet = next(source)
                except StopIteration:
                    ended = True
                    break
                check_cancelled()
                if type(packet.index) is not int or packet.index != decoded:
                    raise ValueError("Decoded frame indices must start at zero and remain contiguous")
                decoded += 1
                if previous is not None and is_scene_cut(previous, packet):
                    pending, boundary = packet, True
                    break
                upcoming.append(packet)
                previous = packet
            cached = len(history) + len(upcoming) + (pending is not None)
            if stats is not None:
                stats.peak_cached_frames = max(stats.peak_cached_frames, cached)
            if not upcoming:
                break
            count = min(config.center, len(upcoming))
            prefix = tuple(history)[-config.before :] if config.before else ()
            references = _references(history, len(prefix), config.references)
            final = (ended or boundary) and count == len(upcoming)
            yield SequenceWindow(
                local=prefix + tuple(upcoming[: count + config.after]),
                center_offset=len(prefix),
                center_count=count,
                references=references,
                scene=scene,
                first=upcoming[0].index == scene_start,
                last=final,
            )
            del prefix, references
            history.extend(upcoming[:count])
            del upcoming[:count]
            if final:
                history.clear()
                previous = None
                boundary = False
                scene += 1
                scene_start = decoded - 1 if pending is not None else decoded
    finally:
        history.clear()
        upcoming.clear()
        pending = previous = None
        _close_iterator(source)


def _close_iterator(source: Any) -> None:
    failing = sys.exc_info()[0] is not None
    close = getattr(source, "close", None)
    if close is not None:
        try:
            close()
        except Exception:
            if not failing:
                raise


class SequenceEngine(Protocol):
    def prepare(self, check_cancelled: CancelCheck) -> None: ...

    def repair_window(self, window: SequenceWindow, check_cancelled: CancelCheck) -> Sequence[Any]:
        """Return uint8 BGR results for center frames only, in their input order."""
        ...

    def close(self) -> None: ...


def run_sequence(
    packets: Iterable[FramePacket],
    engine: SequenceEngine,
    *,
    width: int,
    height: int,
    check_cancelled: CancelCheck,
    write_frame: Callable[[Any], None],
    progress: Callable[[int], None],
    config: WindowConfig = WindowConfig(),
    is_scene_cut: Callable[[FramePacket, FramePacket], bool] = scene_cut,
) -> RunStats:
    """Prepare/close one adapter and commit only validated unique center frames.

    write_frame writes to the Worker's intermediate stream, not the successful
    output. On any exception the caller must discard that intermediate. A return
    value only means all decoded centers were written; mux/DB commit comes later.
    """
    import numpy as np

    stats = RunStats()
    windows = None

    def checked_packets() -> Iterator[FramePacket]:
        source = iter(packets)
        try:
            for packet in source:
                check_cancelled()
                if (
                    not isinstance(packet.image, np.ndarray)
                    or packet.image.shape != (height, width, 3)
                    or packet.image.dtype != np.uint8
                    or not isinstance(packet.mask, np.ndarray)
                    or packet.mask.shape != (height, width)
                    or packet.mask.dtype != np.uint8
                ):
                    raise ValueError("Invalid decoded BGR frame or mask")
                yield packet
        finally:
            _close_iterator(source)

    try:
        if type(width) is not int or type(height) is not int or min(width, height) < 1:
            raise ValueError("Invalid sequence dimensions")
        check_cancelled()
        engine.prepare(check_cancelled)
        check_cancelled()
        windows = sequence_windows(
            checked_packets(), config=config, check_cancelled=check_cancelled, is_scene_cut=is_scene_cut, stats=stats
        )
        while True:
            try:
                window = next(windows)
            except StopIteration:
                break
            check_cancelled()
            originals = tuple((packet.image.copy(), packet.mask.copy()) for packet in window.centers)
            repaired = engine.repair_window(window, check_cancelled)
            check_cancelled()
            if not isinstance(repaired, (list, tuple)) or len(repaired) != window.center_count:
                raise ValueError("Sequence engine returned an invalid center-frame count")
            # Validate the entire window before writing any of its frames.
            for result in repaired:
                if (
                    not isinstance(result, np.ndarray)
                    or result.shape != (height, width, 3)
                    or result.dtype != np.uint8
                    or not np.isfinite(result).all()
                ):
                    raise ValueError("Sequence engine returned an invalid frame shape/type/value")
            for packet, result, (original, mask) in zip(window.centers, repaired, originals, strict=True):
                check_cancelled()
                if packet.index != stats.committed_frames:
                    raise ValueError("Sequence output order is inconsistent")
                # The engine cannot replace unmasked pixels, even if it predicts
                # a whole crop or modifies input arrays accidentally.
                original[mask > 0] = result[mask > 0]
                write_frame(original)
                stats.committed_frames += 1
                progress(stats.committed_frames)
            stats.windows += 1
            stats.scenes = window.scene + 1
            # Drop the previous window before pulling/decoding the next one.
            del packet, result, original, mask, originals, repaired, window
        check_cancelled()
        return stats
    finally:
        failing = sys.exc_info()[0] is not None
        try:
            if windows is not None:
                _close_iterator(windows)
            else:
                _close_iterator(packets)
        finally:
            try:
                engine.close()
            except Exception:
                if not failing:
                    raise
