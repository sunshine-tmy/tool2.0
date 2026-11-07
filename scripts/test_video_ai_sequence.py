"""Synthetic temporal scheduling/lifecycle tests; no weights, GPU or network."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from video_ai_sequence import FramePacket, RunStats, WindowConfig, run_sequence, scene_cut, sequence_windows


def noop(*_):
    pass


def packets(count):
    for index in range(count):
        image = np.full((6, 8, 3), index % 255, dtype=np.uint8)
        mask = np.zeros((6, 8), dtype=np.uint8)
        mask[2:4, 1:7] = 255
        yield FramePacket(index, image, mask)


class Cancelled(RuntimeError):
    pass


class Flag:
    stopped = False

    def check(self):
        if self.stopped:
            raise Cancelled("cancelled")


class FakeEngine:
    def __init__(self):
        self.prepared = self.closed = 0
        self.calls = []

    def prepare(self, check_cancelled):
        check_cancelled()
        self.prepared += 1

    def repair_window(self, window, check_cancelled):
        check_cancelled()
        self.calls.append((tuple(item.index for item in window.centers), window.scene))
        return [np.full_like(item.image, 200) for item in window.centers]

    def close(self):
        self.closed += 1


class WindowTests(unittest.TestCase):
    def windows(self, count, **options):
        return sequence_windows(
            packets(count), config=WindowConfig(), check_cancelled=noop, is_scene_cut=lambda *_: False, **options
        )

    def test_all_frame_counts_have_unique_contiguous_centers_and_bounded_context(self):
        for length in (0, 1, 7, 8, 9, 11, 12, 13, 31, 65, 1027):
            with self.subTest(length=length):
                seen: list[int] = []
                stats = RunStats()
                for window in self.windows(length, stats=stats):
                    centers = window.centers
                    seen.extend(packet.index for packet in centers)
                    self.assertLessEqual(len(window.local), 16)
                    self.assertLessEqual(len(window.references), 4)
                    self.assertEqual(
                        [p.index for p in window.local], list(range(window.local[0].index, window.local[-1].index + 1))
                    )
                    self.assertTrue(all(0 <= p.index < length for p in window.local + window.references))
                    self.assertTrue(
                        all(centers[0].index - 16 <= p.index < window.local[0].index for p in window.references)
                    )
                    self.assertEqual(len({p.index for p in window.references}), len(window.references))
                    self.assertEqual(window.first, centers[0].index == 0)
                    self.assertEqual(window.last, centers[-1].index == length - 1)
                self.assertEqual(seen, list(range(length)))
                self.assertLessEqual(stats.peak_cached_frames, WindowConfig().max_cached_frames)

    def test_cut_flushes_tail_and_never_leaks_context_or_references_across_scenes(self):
        boundaries = (0, 1, 11, 12, 21, 35, 39, 50)
        windows = sequence_windows(
            packets(50),
            config=WindowConfig(),
            check_cancelled=noop,
            is_scene_cut=lambda _left, right: right.index in boundaries,
        )
        seen: list[int] = []
        for window in windows:
            start, end = boundaries[window.scene : window.scene + 2]
            self.assertTrue(all(start <= p.index < end for p in window.local + window.references))
            self.assertEqual(window.first, window.centers[0].index == start)
            self.assertEqual(window.last, window.centers[-1].index == end - 1)
            seen.extend(p.index for p in window.centers)
        self.assertEqual(seen, list(range(50)))

    def test_no_history_configuration_still_identifies_only_first_window_as_first(self):
        windows = list(
            sequence_windows(
                packets(5), config=WindowConfig(2, 0, 0, 0, 0), check_cancelled=noop, is_scene_cut=lambda *_: False
            )
        )
        self.assertEqual([window.first for window in windows], [True, False, False])
        self.assertEqual([window.last for window in windows], [False, False, True])

    def test_long_stream_cache_plateaus_and_does_not_keep_all_decoded_frames(self):
        import weakref

        live: weakref.WeakSet[FramePacket] = weakref.WeakSet()
        maximum = 0
        closed = False

        # A tiny generic payload makes packets hashable for WeakSet without
        # changing the scheduler or requiring actual video buffers.
        def tiny_source():
            nonlocal maximum, closed
            try:
                for index in range(10000):
                    packet = FramePacket(index, index, None)
                    live.add(packet)
                    maximum = max(maximum, len(live))
                    yield packet
            finally:
                closed = True

        windows = sequence_windows(
            tiny_source(), config=WindowConfig(), check_cancelled=noop, is_scene_cut=lambda *_: False
        )
        count = 0
        while True:
            try:
                window = next(windows)
            except StopIteration:
                break
            count += window.center_count
            del window
        self.assertEqual(count, 10000)
        self.assertLessEqual(maximum, WindowConfig().max_cached_frames)
        self.assertTrue(closed)
        self.assertEqual(len(live), 0)

    def test_cancel_closes_decoding_iterator_without_decoding_extra_frames(self):
        flag = Flag()
        decoded = []
        closed = False

        def source():
            nonlocal closed
            try:
                for packet in packets(30):
                    decoded.append(packet.index)
                    yield packet
            finally:
                closed = True

        windows = sequence_windows(
            source(), config=WindowConfig(), check_cancelled=flag.check, is_scene_cut=lambda *_: False
        )
        next(windows)
        self.assertEqual(decoded, list(range(12)))
        flag.stopped = True
        with self.assertRaises(Cancelled):
            next(windows)
        self.assertTrue(closed)
        self.assertEqual(decoded, list(range(12)))

    def test_bad_indices_and_configuration_fail_explicitly(self):
        for bad in (-1, 1, True):
            with self.subTest(index=bad), self.assertRaisesRegex(ValueError, "contiguous"):
                list(sequence_windows([FramePacket(bad, None, None)], config=WindowConfig(), check_cancelled=noop))
        for config in (
            (9, 4, 4, 16, 4),
            (8, 5, 4, 16, 4),
            (8, 4, 4, 3, 4),
            (8, 4, 4, 17, 4),
            (8, 4, 4, 16, 5),
            (True, 4, 4, 16, 4),
        ):
            with self.subTest(config=config), self.assertRaises(ValueError):
                WindowConfig(*config)

    def test_actual_scene_detector_distinguishes_hard_cut_from_minor_change(self):
        black = FramePacket(0, np.zeros((60, 80, 3), dtype=np.uint8), None)
        white = FramePacket(1, np.full((60, 80, 3), 255, dtype=np.uint8), None)
        slight = FramePacket(1, np.full((60, 80, 3), 15, dtype=np.uint8), None)
        self.assertTrue(scene_cut(black, white))
        self.assertFalse(scene_cut(black, slight))
        self.assertFalse(scene_cut(white, white))


class RunnerTests(unittest.TestCase):
    def run_engine(self, engine, source=None, **options):
        output: list[np.ndarray] = []
        progress: list[int] = []
        result = run_sequence(
            packets(25) if source is None else source,
            engine,
            width=8,
            height=6,
            check_cancelled=options.pop("check_cancelled", noop),
            write_frame=output.append,
            progress=progress.append,
            is_scene_cut=lambda *_: False,
            **options,
        )
        return result, output, progress

    def test_only_unique_centers_are_written_and_unmasked_pixels_are_preserved(self):
        engine = FakeEngine()
        result, output, progress = self.run_engine(engine)
        self.assertEqual(result.committed_frames, 25)
        self.assertEqual(result.windows, 4)
        self.assertEqual(progress, list(range(1, 26)))
        for index, frame in enumerate(output):
            expected = np.full((6, 8, 3), index, dtype=np.uint8)
            expected[2:4, 1:7] = 200
            np.testing.assert_array_equal(frame, expected)
        self.assertEqual((engine.prepared, engine.closed), (1, 1))

    def test_entire_window_is_validated_before_writing_any_frame(self):
        cases: list[list[np.ndarray | None]] = [
            [],
            [None] * 8,
            [np.zeros((6, 8), dtype=np.uint8)] * 8,
            [np.full((6, 8, 3), np.nan)] * 8,
            [np.zeros((6, 8, 3), dtype=np.float32)] * 8,
        ]
        for outputs in cases:
            with self.subTest(outputs=len(outputs)):
                engine = FakeEngine()
                written: list[np.ndarray] = []
                self.enterContext(patch.object(engine, "repair_window", lambda *_, result=outputs: result))
                with self.assertRaises(ValueError):
                    run_sequence(
                        packets(8),
                        engine,
                        width=8,
                        height=6,
                        check_cancelled=noop,
                        write_frame=written.append,
                        progress=noop,
                        is_scene_cut=lambda *_: False,
                    )
                self.assertEqual(written, [])
                self.assertEqual(engine.closed, 1)

    def test_mutating_adapter_cannot_change_unmasked_output_pixels(self):
        engine = FakeEngine()

        def repair(window, _check):
            for packet in window.centers:
                packet.image.fill(255)
                packet.mask.fill(255)
            return [np.full((6, 8, 3), 200, dtype=np.uint8) for _ in window.centers]

        self.enterContext(patch.object(engine, "repair_window", repair))
        _, outputs, _ = self.run_engine(engine, source=packets(1))
        self.assertEqual(outputs[0][0, 0, 0], 0)
        self.assertEqual(outputs[0][2, 1, 0], 200)

    def test_prepare_failure_still_closes_partial_model_and_preserves_original_error(self):
        engine = FakeEngine()

        def fail(*_):
            raise RuntimeError("prepare failed")

        def close():
            engine.closed += 1
            raise ValueError("cleanup failed")

        self.enterContext(patch.multiple(engine, prepare=fail, close=close))
        with self.assertRaisesRegex(RuntimeError, "prepare failed"):
            self.run_engine(engine)
        self.assertEqual(engine.closed, 1)

    def test_cancellation_during_prepare_closes_model_and_source_before_any_write(self):
        engine, flag = FakeEngine(), Flag()

        class Source:
            closed = False

            def __iter__(self):
                raise AssertionError("cancelled preparation cannot decode frames")

            def close(self):
                self.closed = True

        source = Source()

        def prepare(check):
            flag.stopped = True
            check()

        self.enterContext(patch.object(engine, "prepare", prepare))
        with self.assertRaises(Cancelled):
            self.run_engine(engine, source=source, check_cancelled=flag.check)
        self.assertEqual(engine.closed, 1)
        self.assertTrue(source.closed)

    def test_cleanup_error_cannot_hide_decoder_or_model_failure(self):
        engine = FakeEngine()

        class Source:
            def __iter__(self):
                return self

            def __next__(self):
                raise OSError("decode failed")

            def close(self):
                raise ValueError("decoder cleanup failed")

        with self.assertRaisesRegex(OSError, "decode failed"):
            self.run_engine(engine, source=Source())
        self.assertEqual(engine.closed, 1)

    def test_cancellation_after_inference_prevents_center_commit(self):
        engine, flag = FakeEngine(), Flag()
        written: list[np.ndarray] = []

        def repair(window, _check):
            flag.stopped = True
            return [packet.image for packet in window.centers]

        self.enterContext(patch.object(engine, "repair_window", repair))
        with self.assertRaises(Cancelled):
            run_sequence(
                packets(25),
                engine,
                width=8,
                height=6,
                check_cancelled=flag.check,
                write_frame=written.append,
                progress=noop,
                is_scene_cut=lambda *_: False,
            )
        self.assertEqual(written, [])
        self.assertEqual(engine.closed, 1)

    def test_cancel_during_center_writes_stops_before_next_frame(self):
        engine, flag, written = FakeEngine(), Flag(), []

        def write(frame):
            written.append(frame)
            flag.stopped = True

        with self.assertRaises(Cancelled):
            run_sequence(
                packets(25),
                engine,
                width=8,
                height=6,
                check_cancelled=flag.check,
                write_frame=write,
                progress=noop,
                is_scene_cut=lambda *_: False,
            )
        self.assertEqual(len(written), 1)
        self.assertEqual(engine.closed, 1)

    def test_input_validation_and_writer_failure_close_model_and_decoder(self):
        for bad_image, bad_mask in (
            (np.zeros((6, 8)), np.zeros((6, 8), dtype=np.uint8)),
            (np.zeros((6, 8, 3), dtype=np.uint8), np.zeros((1, 8), dtype=np.uint8)),
        ):
            engine = FakeEngine()
            with self.assertRaisesRegex(ValueError, "decoded"):
                self.run_engine(engine, source=[FramePacket(0, bad_image, bad_mask)])
            self.assertEqual(engine.closed, 1)

        closed = False

        def source():
            nonlocal closed
            try:
                yield from packets(25)
            finally:
                closed = True

        def fail_write(_):
            raise OSError("disk full")

        engine = FakeEngine()
        with self.assertRaisesRegex(OSError, "disk full"):
            run_sequence(
                source(),
                engine,
                width=8,
                height=6,
                check_cancelled=noop,
                write_frame=fail_write,
                progress=noop,
                is_scene_cut=lambda *_: False,
            )
        self.assertEqual(engine.closed, 1)
        self.assertTrue(closed)

    def test_worker_style_intermediate_cleanup_leaves_no_success_file_after_cancellation(self):
        with tempfile.TemporaryDirectory() as directory:
            intermediate = Path(directory) / "video-only.tmp"
            final = Path(directory) / "output.mp4"
            engine, flag = FakeEngine(), Flag()

            def write(_frame):
                intermediate.write_bytes(b"partial")
                flag.stopped = True

            with self.assertRaises(Cancelled):
                try:
                    run_sequence(
                        packets(20),
                        engine,
                        width=8,
                        height=6,
                        check_cancelled=flag.check,
                        write_frame=write,
                        progress=noop,
                        is_scene_cut=lambda *_: False,
                    )
                    intermediate.replace(final)
                finally:
                    intermediate.unlink(missing_ok=True)
            self.assertFalse(final.exists())
            self.assertFalse(intermediate.exists())


if __name__ == "__main__":
    unittest.main()
