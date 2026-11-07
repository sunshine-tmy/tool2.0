"""STTN spatial/adaptation contracts using a fake predictor, never weights."""

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from video_ai_sequence import FramePacket, SequenceWindow
from video_ai_sttn import TILE_HEIGHT, TILE_WIDTH, SttnAdapter, SttnFailure, masked_tiles, padded_crop, tile_origins


def noop():
    pass


def window(width, height, *, mask=None):
    yy, xx = np.indices((height, width))
    image = np.stack((xx % 200, yy % 200, (xx + yy) % 200), axis=-1).astype(np.uint8)
    if mask is None:
        mask = np.zeros((height, width), dtype=np.uint8)
        mask[max(0, height - 40) : height, :] = 255
    packet = FramePacket(0, image, mask)
    return SequenceWindow((packet,), 0, 1, (), 0, True, True)


class FakeAdapter(SttnAdapter):
    def __init__(self):
        super().__init__(Path("not-used"))
        self.model = object()
        self.calls = []

    def _predict_tile(self, window, bounds, check):
        check()
        self.calls.append(bounds)
        return np.stack([padded_crop(packet.image, bounds).astype(np.float32) + 20 for packet in window.centers])


class SttnSpatialTests(unittest.TestCase):
    def test_tile_grid_covers_every_pixel_at_native_scale(self):
        for width, height in ((1, 1), (93, 57), (432, 240), (1280, 720), (720, 1280)):
            with self.subTest(size=(width, height)):
                mask = np.ones((height, width), dtype=np.uint8)
                coverage = np.zeros_like(mask)
                for x, y, right, bottom in masked_tiles(mask):
                    self.assertLessEqual(right - x, TILE_WIDTH)
                    self.assertLessEqual(bottom - y, TILE_HEIGHT)
                    coverage[y:bottom, x:right] += 1
                self.assertTrue((coverage > 0).all())
        self.assertEqual(tile_origins(432, 432, 64), (0,))
        with self.assertRaises(ValueError):
            tile_origins(500, 432, 500)

    def test_padding_preserves_native_pixels_for_small_and_single_pixel_frames(self):
        for width, height in ((1, 1), (1, 10), (31, 23), (432, 240)):
            current = window(width, height)
            image = current.local[0].image
            padded = padded_crop(image, (0, 0, width, height))
            self.assertEqual(padded.shape, (240, 432, 3))
            np.testing.assert_array_equal(padded[:height, :width], image)

    def test_landscape_and_portrait_tiles_blend_without_geometry_change_or_unmasked_changes(self):
        for width, height in ((93, 57), (1280, 720), (720, 1280)):
            with self.subTest(size=(width, height)):
                current, adapter = window(width, height), FakeAdapter()
                original, mask = current.local[0].image.copy(), current.local[0].mask > 0
                output = adapter.repair_window(current, noop)[0]
                self.assertEqual(output.shape, original.shape)
                self.assertEqual(output.dtype, np.uint8)
                np.testing.assert_array_equal(output[~mask], original[~mask])
                # Float overlap accumulation is allowed less than one intensity
                # unit rounding error; no resize or lost spatial coordinate.
                np.testing.assert_allclose(output[mask], original[mask].astype(float) + 20, atol=1)
                self.assertTrue(adapter.calls)
                if height > TILE_HEIGHT:
                    self.assertLess(len(adapter.calls), len(tuple(masked_tiles(np.ones_like(mask)))))

    def test_multiple_masks_and_temporal_ranges_cover_only_selected_pixels(self):
        mask = np.zeros((720, 1280), dtype=np.uint8)
        mask[0:8, 0:40] = 255
        mask[-8:, -50:] = 255
        current = window(1280, 720, mask=mask)
        unmasked = FramePacket(1, current.local[0].image.copy(), np.zeros_like(mask))
        current = SequenceWindow(current.local + (unmasked,), 0, 2, (), 0, True, True)
        adapter = FakeAdapter()
        first, second = adapter.repair_window(current, noop)
        np.testing.assert_array_equal(first[mask == 0], current.local[0].image[mask == 0])
        np.testing.assert_array_equal(second, unmasked.image)

    def test_empty_mask_does_not_invoke_model_and_unprepared_engine_fails_explicitly(self):
        current = window(32, 24, mask=np.zeros((24, 32), dtype=np.uint8))
        adapter = FakeAdapter()
        output = adapter.repair_window(current, noop)
        self.assertEqual(adapter.calls, [])
        np.testing.assert_array_equal(output[0], current.local[0].image)
        with self.assertRaises(SttnFailure) as raised:
            SttnAdapter(Path("unused")).repair_window(current, noop)
        self.assertEqual(raised.exception.code, "STTN_UNAVAILABLE")

    def test_cancellation_between_spatial_tiles_stops_remaining_inference(self):
        adapter = FakeAdapter()

        def check():
            if len(adapter.calls) >= 1:
                raise RuntimeError("cancelled")

        with self.assertRaisesRegex(RuntimeError, "cancelled"):
            adapter.repair_window(window(1280, 720), check)
        self.assertEqual(len(adapter.calls), 1)

    def test_missing_or_wrong_engine_resources_fail_before_importing_a_model(self):
        with patch("video_ai_sttn.read_bundle", side_effect=ValueError("bad digest")):
            with self.assertRaisesRegex(ValueError, "bad digest"):
                SttnAdapter(Path("unused")).prepare(noop)
        with patch("video_ai_sttn.read_bundle", return_value={"engine": "propainter"}):
            with self.assertRaises(SttnFailure):
                SttnAdapter(Path("unused")).prepare(noop)

    def test_insufficient_vram_and_wrong_runtime_fail_before_model_allocation(self):
        for version, free, expected in (
            ("2.6.0+cu124", 2 * 1024**3, "CUDA_OUT_OF_MEMORY"),
            ("2.7.0+cu124", 5 * 1024**3, "STTN_UNAVAILABLE"),
        ):
            torch = SimpleNamespace(
                __version__=version,
                cuda=SimpleNamespace(
                    is_available=lambda: True, mem_get_info=lambda available=free: (available, 8 * 1024**3)
                ),
            )
            with (
                self.subTest(version=version),
                patch.dict("sys.modules", {"torch": torch}),
                patch("video_ai_sttn.read_bundle", return_value={"engine": "sttn"}),
                patch("video_ai_sttn.load_vendor_module") as load,
            ):
                with self.assertRaises(SttnFailure) as raised:
                    SttnAdapter(Path("unused")).prepare(noop)
                self.assertEqual(raised.exception.code, expected)
                load.assert_not_called()

    def test_close_is_idempotent_and_releases_only_owned_model(self):
        class Torch:
            class cuda:
                calls = 0

                @classmethod
                def empty_cache(cls):
                    cls.calls += 1

        adapter = FakeAdapter()
        adapter.torch, adapter.owns_cuda = Torch, True
        adapter.close()
        adapter.close()
        self.assertIsNone(adapter.model)
        self.assertEqual(Torch.cuda.calls, 1)

    def test_oversized_temporal_window_is_rejected_before_tensor_allocation(self):
        current = window(32, 24)
        for oversized in (
            SequenceWindow(current.local * 9, 0, 4, (), 0, True, False),
            SequenceWindow(current.local * 5, 0, 5, (), 0, True, False),
            SequenceWindow(current.local, 0, 1, current.local * 3, 0, True, False),
        ):
            adapter = FakeAdapter()
            with self.assertRaises(SttnFailure) as raised:
                adapter.repair_window(oversized, noop)
            self.assertEqual(raised.exception.code, "ENGINE_FAILED")
            self.assertEqual(adapter.calls, [])


if __name__ == "__main__":
    unittest.main()
