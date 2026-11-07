"""Offline ProPainter adapter, using only verified S02 inference assets.

Bounded contiguous optical flow stays separate from sparse appearance references.
Native-resolution subtitle crops are padded and pasted back, never resized.
RAFT uses FP32; flow completion and repair use the validated FP16 runtime.
"""

from __future__ import annotations

import argparse
from collections.abc import Callable
from pathlib import Path
from typing import Any

from video_ai_engine_assets import load_vendor_module, owned_path, read_bundle
from video_ai_sequence import CancelCheck, FramePacket, SequenceWindow, WindowConfig

PROPAINTER_WINDOW = WindowConfig(center=2, before=1, after=1, history=8, references=2)
CONTEXT, MIN_SIDE, MAX_SIDE, MAX_CROP_PIXELS = 96, 128, 640, 640 * 480


class ProPainterFailure(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def crop_bounds(mask: Any) -> tuple[int, int, int, int]:
    import numpy as np

    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise ValueError("A ProPainter crop requires a nonempty mask")
    height, width = mask.shape
    left, top = max(0, int(xs.min()) - CONTEXT), max(0, int(ys.min()) - CONTEXT)
    right, bottom = min(width, int(xs.max()) + 1 + CONTEXT), min(height, int(ys.max()) + 1 + CONTEXT)
    padded_w, padded_h = padded_size(right - left, bottom - top)
    if max(padded_w, padded_h) > MAX_SIDE or padded_w * padded_h > MAX_CROP_PIXELS:
        raise ProPainterFailure(
            "RESOLUTION_TOO_HIGH",
            "ProPainter 当前配置要求字幕区域及周边上下文不超过 640×480 像素量、单边不超过 640；不会自动缩小视频",
        )
    return left, top, right, bottom


def padded_size(width: int, height: int) -> tuple[int, int]:
    return max(MIN_SIDE, (width + 7) // 8 * 8), max(MIN_SIDE, (height + 7) // 8 * 8)


def padded_crop(image: Any, bounds: tuple[int, int, int, int]) -> Any:
    import numpy as np

    left, top, right, bottom = bounds
    crop = image[top:bottom, left:right]
    width, height = padded_size(right - left, bottom - top)
    padding: tuple[tuple[int, int], ...] = ((0, height - crop.shape[0]), (0, width - crop.shape[1]))
    if crop.ndim == 3:
        padding += ((0, 0),)
    return np.pad(crop, padding, mode="reflect" if min(crop.shape[:2]) > 1 else "edge")


def local_packets(window: SequenceWindow) -> tuple[FramePacket, ...]:
    if not 1 <= len(window.local) <= 4 or not 1 <= window.center_count <= 2 or len(window.references) > 2:
        raise ProPainterFailure("ENGINE_FAILED", "ProPainter 时序窗口超出当前验证配置")
    if not 0 <= window.center_offset < len(window.local) or window.center_offset + window.center_count > len(
        window.local
    ):
        raise ProPainterFailure("ENGINE_FAILED", "ProPainter 中心帧范围无效")
    indices = [packet.index for packet in window.local]
    if indices != list(range(indices[0], indices[0] + len(indices))):
        raise ProPainterFailure("ENGINE_FAILED", "ProPainter 光流只能使用连续帧")
    # A one-frame scene has no motion. Duplicate only its network context and
    # provide zero flow, then emit the original single center exactly once.
    return window.local if len(window.local) > 1 else window.local * 2


class ProPainterAdapter:
    window_config = PROPAINTER_WINDOW

    def __init__(self, root: Path, *, device: str = "cuda") -> None:
        self.root, self.device = root, device
        self.raft: Any = None
        self.flow: Any = None
        self.model: Any = None
        self.torch: Any = None
        self.owns_cuda = False
        self.on_stage: Callable[[str], None] = lambda _: None

    def set_stage_callback(self, callback: Callable[[str], None]) -> None:
        self.on_stage = callback

    def prepare(self, check_cancelled: CancelCheck) -> None:
        check_cancelled()
        if read_bundle(self.root)["engine"] != "propainter":
            raise ProPainterFailure("PROPAINTER_UNAVAILABLE", "ProPainter 资源类型不匹配")
        import torch
        import torchvision

        self.torch = torch
        if self.device != "cuda" or not torch.cuda.is_available():
            raise ProPainterFailure("VIDEO_AI_CUDA_UNAVAILABLE", "ProPainter 需要可用的 NVIDIA CUDA 运行时")
        if torch.__version__ != "2.6.0+cu124" or torchvision.__version__ != "0.21.0+cu124":
            raise ProPainterFailure(
                "PROPAINTER_UNAVAILABLE", "ProPainter 需要已验证的 PyTorch / torchvision CUDA 12.4 运行时"
            )
        if torch.cuda.mem_get_info()[0] < 3 * 1024**3:
            raise ProPainterFailure("CUDA_OUT_OF_MEMORY", "ProPainter 当前可用显存不足 3 GiB，请先释放其他 GPU 任务")
        check_cancelled()

        def load(name: str) -> Any:
            with owned_path(self.root, f"weights/{name}").open("rb") as handle:
                return torch.load(handle, map_location="cpu", weights_only=True)

        raft_type = load_vendor_module(self.root, "RAFT").RAFT
        self.raft = raft_type(argparse.Namespace(small=False, mixed_precision=False, alternate_corr=False))
        self.raft.load_state_dict(
            {key.removeprefix("module."): value for key, value in load("raft-things.pth").items()}, strict=True
        )
        check_cancelled()
        self.owns_cuda = True  # Includes cleanup after a partial device allocation.
        self.raft.eval().to(device="cuda", dtype=torch.float32)
        check_cancelled()
        self.flow = load_vendor_module(self.root, "model.recurrent_flow_completion").RecurrentFlowCompleteNet()
        self.flow.load_state_dict(load("recurrent_flow_completion.pth"), strict=True)
        self.flow.eval().to(device="cuda", dtype=torch.float16)
        check_cancelled()
        self.model = load_vendor_module(self.root, "model.propainter").InpaintGenerator(init_weights=False)
        self.model.load_state_dict(load("ProPainter.pth"), strict=True)
        self.model.eval().to(device="cuda", dtype=torch.float16)
        check_cancelled()

    def _flow_pair(self, left: Any, right: Any, check: CancelCheck) -> tuple[Any, Any]:
        check()
        forward = self.raft(left, right, iters=20, test_mode=True)[1]
        check()
        backward = self.raft(right, left, iters=20, test_mode=True)[1]
        check()
        return forward.half(), backward.half()

    def _predict_crop(self, window: SequenceWindow, bounds: tuple[int, int, int, int], check: CancelCheck) -> Any:
        import numpy as np

        torch = self.torch
        local = local_packets(window)
        packets = local + window.references
        images = np.stack([padded_crop(packet.image, bounds)[:, :, ::-1] for packet in packets])
        masks = np.stack([padded_crop(packet.mask, bounds) > 0 for packet in packets])
        count = len(local)
        height, width = images.shape[1:3]
        with torch.inference_mode():
            # Do not place sparse references in the adjacent flow pairs.
            local_images = (
                torch.from_numpy(images[:count].copy()).permute(0, 3, 1, 2).to("cuda", torch.float32) / 127.5 - 1
            )
            self.on_stage("flow")
            if len(window.local) == 1:
                forward = backward = torch.zeros((1, 1, 2, height, width), device="cuda", dtype=torch.float16)
            else:
                pairs = [
                    self._flow_pair(local_images[index : index + 1], local_images[index + 1 : index + 2], check)
                    for index in range(count - 1)
                ]
                forward = torch.stack([pair[0] for pair in pairs], dim=1)
                backward = torch.stack([pair[1] for pair in pairs], dim=1)
                del pairs
            del local_images
            check()
            images_t = torch.from_numpy(images).permute(0, 3, 1, 2).to("cuda", torch.float16).unsqueeze(0) / 127.5 - 1
            masks_t = torch.from_numpy(masks).unsqueeze(0).unsqueeze(2).to("cuda", torch.float16)
            local_masks = masks_t[:, :count]
            self.on_stage("propagate")
            flows, _ = self.flow.forward_bidirect_flow((forward, backward), local_masks)
            check()
            flows = self.flow.combine_flow((forward, backward), flows, local_masks)
            del forward, backward
            check()
            propagated, updated_masks = self.model.img_propagation(
                images_t[:, :count] * (1 - local_masks), flows, local_masks, "nearest"
            )
            updated = (
                images_t[:, :count] * (1 - local_masks) + propagated.view(1, count, 3, height, width) * local_masks
            )
            # Sparse frames supply appearance only. They never receive invented
            # adjacent flow or propagation through unrelated time gaps.
            updated = torch.cat((updated, images_t[:, count:] * (1 - masks_t[:, count:])), dim=1)
            updated_masks = torch.cat((updated_masks.view(1, count, 1, height, width), masks_t[:, count:]), dim=1)
            del propagated, images_t
            check()
            self.on_stage("repair")
            prediction = self.model(updated, flows, masks_t, updated_masks, count)
            selected = prediction[0, window.center_offset : window.center_offset + window.center_count]
            if tuple(selected.shape) != (window.center_count, 3, height, width) or not torch.isfinite(selected).all():
                raise ProPainterFailure("ENGINE_FAILED", "ProPainter 返回的帧尺寸或数值无效")
            pixels = ((selected.float().permute(0, 2, 3, 1).cpu().numpy() + 1) * 127.5).clip(0, 255)
            check()
            return pixels[:, :, :, ::-1].astype(np.uint8)

    def repair_window(self, window: SequenceWindow, check_cancelled: CancelCheck) -> list[Any]:
        import numpy as np

        local_packets(window)
        if self.model is None:
            raise ProPainterFailure("PROPAINTER_UNAVAILABLE", "ProPainter 模型尚未准备")
        check_cancelled()
        union = np.logical_or.reduce([packet.mask > 0 for packet in window.centers])
        if not union.any():
            return [packet.image.copy() for packet in window.centers]
        bounds = crop_bounds(union)
        prediction = self._predict_crop(window, bounds, check_cancelled)
        left, top, right, bottom = bounds
        results = []
        for index, packet in enumerate(window.centers):
            output = packet.image.copy()
            selected = packet.mask[top:bottom, left:right] > 0
            output[top:bottom, left:right][selected] = prediction[index, : bottom - top, : right - left][selected]
            results.append(output)
        check_cancelled()
        return results

    def close(self) -> None:
        self.model = self.flow = self.raft = None
        self.on_stage = lambda _: None
        if self.owns_cuda:
            self.owns_cuda = False
            self.torch.cuda.empty_cache()
