"""ProPainter window/crop/lifecycle contracts, without model weights or CUDA."""

import unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
from video_ai_propainter import ProPainterAdapter, ProPainterFailure, crop_bounds, local_packets, padded_crop
from video_ai_sequence import FramePacket, SequenceWindow


def noop():
    pass


def window(width=576, height=1024, count=3):
    image = np.full((height, width, 3), 40, dtype=np.uint8)
    mask = np.zeros((height, width), dtype=np.uint8)
    mask[max(0, height - 200) : max(1, height - 180), 5 : width - 5] = 255
    packets = tuple(FramePacket(index, image.copy(), mask.copy()) for index in range(count))
    return SequenceWindow(packets, 0, min(count, 2), (), 0, True, True)


class FakeAdapter(ProPainterAdapter):
    def __init__(self):
        super().__init__(Path("unused"))
        self.model = object()
        self.calls = []

    def _predict_crop(self, current, bounds, check):
        check()
        self.calls.append(bounds)
        return np.stack([padded_crop(packet.image, bounds) + 20 for packet in current.centers])


class ProPainterTests(unittest.TestCase):
    def test_crop_keeps_native_pixels_and_masks_outside_result_unchanged(self):
        for size in ((576, 1024), (640, 480), (480, 640), (31, 23), (1, 1)):
            current = window(*size)
            if not current.centers[0].mask.any():
                current.centers[0].mask[0, 0] = 255
            adapter = FakeAdapter()
            outputs = adapter.repair_window(current, noop)
            for packet, output in zip(current.centers, outputs, strict=True):
                selected = packet.mask > 0
                self.assertEqual(output.shape, packet.image.shape)
                np.testing.assert_array_equal(output[~selected], packet.image[~selected])
                np.testing.assert_array_equal(output[selected], packet.image[selected] + 20)

    def test_crop_is_padded_to_eight_and_minimum_raft_size_without_resizing(self):
        image = np.arange(31 * 23 * 3, dtype=np.uint8).reshape(23, 31, 3)
        padded = padded_crop(image, (0, 0, 31, 23))
        self.assertEqual(padded.shape, (128, 128, 3))
        np.testing.assert_array_equal(padded[:23, :31], image)
        for width, height in ((129, 135), (639, 471)):
            image = np.zeros((height, width), dtype=np.uint8)
            result = padded_crop(image, (0, 0, width, height))
            self.assertEqual(result.shape[0] % 8, 0)
            self.assertEqual(result.shape[1] % 8, 0)

    def test_large_region_is_rejected_before_allocating_model_tensors(self):
        current = window(1280, 720)
        adapter = FakeAdapter()
        with self.assertRaises(ProPainterFailure) as raised:
            adapter.repair_window(current, noop)
        self.assertEqual(raised.exception.code, "RESOLUTION_TOO_HIGH")
        self.assertFalse(adapter.calls)
        with self.assertRaises(ValueError):
            crop_bounds(np.zeros((24, 32), dtype=np.uint8))

    def test_sparse_appearance_references_never_enter_contiguous_flow_packets(self):
        current = window()
        shifted = tuple(replace(packet, index=packet.index + 10) for packet in current.local)
        references = (replace(current.local[0], index=0), replace(current.local[0], index=4))
        current = replace(current, local=shifted, references=references)
        self.assertEqual([packet.index for packet in local_packets(current)], [10, 11, 12])
        with self.assertRaisesRegex(ProPainterFailure, "连续帧"):
            local_packets(replace(current, local=(shifted[0], shifted[2])))

    def test_single_frame_scene_only_duplicates_model_context_and_emits_one_frame(self):
        current = window(count=1)
        packets = local_packets(current)
        self.assertEqual(len(packets), 2)
        self.assertIs(packets[0], packets[1])
        self.assertEqual(len(FakeAdapter().repair_window(current, noop)), 1)

    def test_window_bounds_and_centers_are_validated_before_predictor(self):
        current = window(count=4)
        for invalid in (
            replace(current, local=current.local * 2),
            replace(current, center_count=0),
            replace(current, center_count=3),
            replace(current, center_offset=3),
            replace(current, references=current.local[:3]),
        ):
            adapter = FakeAdapter()
            with self.subTest(invalid=invalid), self.assertRaises(ProPainterFailure):
                adapter.repair_window(invalid, noop)
            self.assertFalse(adapter.calls)

    def test_no_mask_skips_predictor_and_unprepared_model_fails(self):
        current = window()
        for packet in current.local:
            packet.mask[:] = 0
        adapter = FakeAdapter()
        self.assertEqual(len(adapter.repair_window(current, noop)), 2)
        self.assertFalse(adapter.calls)
        with self.assertRaises(ProPainterFailure):
            ProPainterAdapter(Path("unused")).repair_window(current, noop)

    def test_forward_backward_flow_checks_cancellation_between_raft_calls(self):
        adapter = ProPainterAdapter(Path("unused"))
        tensor = SimpleNamespace(half=lambda: "half-flow")
        raft = Mock(return_value=(None, tensor))
        adapter.raft = raft
        left, right = object(), object()
        self.assertEqual(adapter._flow_pair(left, right, noop), ("half-flow", "half-flow"))
        self.assertEqual(raft.call_args_list[0].args, (left, right))
        self.assertEqual(raft.call_args_list[1].args, (right, left))
        raft.reset_mock()

        def cancel():
            if raft.called:
                raise RuntimeError("cancelled")

        with self.assertRaisesRegex(RuntimeError, "cancelled"):
            adapter._flow_pair(left, right, cancel)
        self.assertEqual(raft.call_count, 1)

    def test_bad_assets_wrong_runtime_and_low_memory_fail_before_vendor_import(self):
        with patch("video_ai_propainter.read_bundle", side_effect=ValueError("bad digest")):
            with self.assertRaisesRegex(ValueError, "bad digest"):
                ProPainterAdapter(Path("unused")).prepare(noop)
        with patch("video_ai_propainter.read_bundle", return_value={"engine": "sttn"}):
            with self.assertRaises(ProPainterFailure):
                ProPainterAdapter(Path("unused")).prepare(noop)
        for version, free, code in (
            ("2.7.0", 5 * 1024**3, "PROPAINTER_UNAVAILABLE"),
            ("2.6.0+cu124", 2 * 1024**3, "CUDA_OUT_OF_MEMORY"),
        ):
            torch = SimpleNamespace(
                __version__=version,
                cuda=SimpleNamespace(is_available=lambda: True, mem_get_info=lambda free=free: (free, 8 * 1024**3)),
            )
            with (
                patch.dict("sys.modules", {"torch": torch, "torchvision": SimpleNamespace(__version__="0.21.0+cu124")}),
                patch("video_ai_propainter.read_bundle", return_value={"engine": "propainter"}),
                patch("video_ai_propainter.load_vendor_module") as load,
            ):
                with self.assertRaises(ProPainterFailure) as raised:
                    ProPainterAdapter(Path("unused")).prepare(noop)
                self.assertEqual(raised.exception.code, code)
                load.assert_not_called()

    def test_close_releases_all_three_networks_and_is_idempotent(self):
        adapter = ProPainterAdapter(Path("unused"))
        empty = Mock()
        adapter.torch = SimpleNamespace(cuda=SimpleNamespace(empty_cache=empty))
        adapter.model = adapter.flow = adapter.raft = object()
        adapter.owns_cuda = True
        callback = Mock()
        adapter.set_stage_callback(callback)
        adapter.close()
        adapter.close()
        self.assertIsNone(adapter.model)
        self.assertIsNone(adapter.flow)
        self.assertIsNone(adapter.raft)
        empty.assert_called_once()
        adapter.on_stage("flow")
        callback.assert_not_called()


if __name__ == "__main__":
    unittest.main()
