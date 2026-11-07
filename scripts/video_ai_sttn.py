"""Offline STTN adapter: native 432x240 spatial tiles, no full-frame resize.

The network and checkpoint are the pinned, licensed S02 assets. This adapter is
application code shipped in the new base capability, never injected into an
already installed or signed generation. There is no import-time model loading.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Any

from video_ai_engine_assets import load_vendor_module, owned_path, read_bundle
from video_ai_sequence import CancelCheck, SequenceWindow, WindowConfig

STTN_WINDOW = WindowConfig(center=4, before=2, after=2, history=12, references=2)
TILE_WIDTH, TILE_HEIGHT, OVERLAP = 432, 240, 64


class SttnFailure(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def tile_origins(length: int, size: int, overlap: int) -> tuple[int, ...]:
    if length <= size:
        return (0,)
    step = size - overlap
    if step <= 0:
        raise ValueError("Invalid spatial overlap")
    return tuple(sorted({*range(0, length - size + 1, step), length - size}))


def masked_tiles(mask: Any) -> Iterator[tuple[int, int, int, int]]:
    height, width = mask.shape
    for y in tile_origins(height, TILE_HEIGHT, OVERLAP):
        for x in tile_origins(width, TILE_WIDTH, OVERLAP):
            right, bottom = min(x + TILE_WIDTH, width), min(y + TILE_HEIGHT, height)
            if mask[y:bottom, x:right].any():
                yield x, y, right, bottom


def padded_crop(image: Any, bounds: tuple[int, int, int, int]) -> Any:
    import numpy as np

    x, y, right, bottom = bounds
    crop = image[y:bottom, x:right]
    padding: tuple[tuple[int, int], ...] = ((0, TILE_HEIGHT - crop.shape[0]), (0, TILE_WIDTH - crop.shape[1]))
    if crop.ndim == 3:
        padding += ((0, 0),)
    return np.pad(crop, padding, mode="reflect" if min(crop.shape[:2]) > 1 else "edge")


class SttnAdapter:
    window_config = STTN_WINDOW

    def __init__(self, root: Path, *, device: str = "cuda") -> None:
        self.root = root
        self.device = device
        self.model: Any = None
        self.torch: Any = None
        self.owns_cuda = False

    def prepare(self, check_cancelled: CancelCheck) -> None:
        check_cancelled()
        bundle = read_bundle(self.root)
        if bundle["engine"] != "sttn":
            raise SttnFailure("STTN_UNAVAILABLE", "STTN 资源类型不匹配")
        import torch

        self.torch = torch
        if self.device != "cuda" or not torch.cuda.is_available():
            raise SttnFailure("VIDEO_AI_CUDA_UNAVAILABLE", "STTN 时序修复需要可用的 NVIDIA CUDA 运行时")
        if torch.__version__ != "2.6.0+cu124":
            raise SttnFailure("STTN_UNAVAILABLE", "STTN 需要已验证的 PyTorch 2.6.0 + CUDA 12.4 运行时")
        if torch.cuda.mem_get_info()[0] < 3 * 1024**3:
            raise SttnFailure("CUDA_OUT_OF_MEMORY", "STTN 当前可用显存不足 3 GiB，请先释放本机其他 GPU 任务")
        check_cancelled()
        network = load_vendor_module(self.root, "model.sttn")
        self.model = network.InpaintGenerator(init_weights=False)
        with owned_path(self.root, "weights/sttn.pth").open("rb") as handle:
            checkpoint = torch.load(handle, map_location="cpu", weights_only=True)
        self.model.load_state_dict(checkpoint["netG"], strict=True)
        del checkpoint
        check_cancelled()
        self.model.eval()
        self.owns_cuda = True  # Also clean partial allocations when .to fails.
        self.model.to(device="cuda", dtype=torch.float32)
        check_cancelled()

    def _predict_tile(self, window: SequenceWindow, bounds: tuple[int, int, int, int], check: CancelCheck) -> Any:
        import numpy as np

        torch = self.torch
        packets = window.local + window.references
        images = np.stack([padded_crop(packet.image, bounds)[:, :, ::-1] for packet in packets])
        masks = np.stack([padded_crop(packet.mask, bounds) > 0 for packet in packets])
        with torch.inference_mode():
            images_t = torch.from_numpy(images).permute(0, 3, 1, 2).to(device="cuda", dtype=torch.float32) / 127.5 - 1
            masks_t = torch.from_numpy(masks).unsqueeze(1).to(device="cuda", dtype=torch.float32)
            check()
            features = self.model.encoder(images_t * (1 - masks_t))
            check()
            # Matches the pinned network's forward path, with bounded cancellation
            # points between encoder, temporal attention and decoder.
            features = self.model.infer(features, masks_t)
            check()
            prediction = torch.tanh(self.model.decoder(features))
            selected = prediction[window.center_offset : window.center_offset + window.center_count]
            if (
                tuple(selected.shape) != (window.center_count, 3, TILE_HEIGHT, TILE_WIDTH)
                or not torch.isfinite(selected).all()
            ):
                raise SttnFailure("ENGINE_FAILED", "STTN 返回的帧尺寸或数值无效")
            pixels = ((selected.permute(0, 2, 3, 1).cpu().numpy() + 1) * 127.5).clip(0, 255)
            check()
            return pixels[:, :, :, ::-1].copy()  # Float BGR for overlap blending.

    def repair_window(self, window: SequenceWindow, check_cancelled: CancelCheck) -> list[Any]:
        import numpy as np

        if self.model is None:
            raise SttnFailure("STTN_UNAVAILABLE", "STTN 模型尚未准备")
        if window.center_count > STTN_WINDOW.center or len(window.local) > 8 or len(window.references) > 2:
            raise SttnFailure("ENGINE_FAILED", "STTN 时序窗口超出当前验证配置")
        check_cancelled()
        union = np.logical_or.reduce([packet.mask > 0 for packet in window.centers])
        if not union.any():
            return [packet.image.copy() for packet in window.centers]
        ys, xs = np.nonzero(union)
        left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        accumulator = np.zeros((window.center_count, bottom - top, right - left, 3), dtype=np.float32)
        weights = np.zeros((bottom - top, right - left), dtype=np.float32)
        blend = np.outer(np.hanning(TILE_HEIGHT + 2)[1:-1], np.hanning(TILE_WIDTH + 2)[1:-1]).astype(np.float32)
        for bounds in masked_tiles(union):
            check_cancelled()
            prediction = self._predict_tile(window, bounds, check_cancelled)
            x, y, x1, y1 = bounds
            ix, iy, ir, ib = max(left, x), max(top, y), min(right, x1), min(bottom, y1)
            selection = (slice(iy - top, ib - top), slice(ix - left, ir - left))
            tile_selection = (slice(iy - y, ib - y), slice(ix - x, ir - x))
            contribution = blend[tile_selection]
            accumulator[:, selection[0], selection[1]] += (
                prediction[:, tile_selection[0], tile_selection[1]] * contribution[None, :, :, None]
            )
            weights[selection] += contribution
            del prediction
        check_cancelled()
        if not (weights[union[top:bottom, left:right]] > 0).all():
            raise SttnFailure("ENGINE_FAILED", "STTN 空间切块没有覆盖完整掩膜")
        pixels = (accumulator / np.maximum(weights, 1e-12)[None, :, :, None]).clip(0, 255).astype(np.uint8)
        results = []
        for index, packet in enumerate(window.centers):
            output = packet.image.copy()
            selected = packet.mask[top:bottom, left:right] > 0
            output[top:bottom, left:right][selected] = pixels[index][selected]
            results.append(output)
        return results

    def close(self) -> None:
        self.model = None
        if self.owns_cuda:
            self.owns_cuda = False
            self.torch.cuda.empty_cache()
