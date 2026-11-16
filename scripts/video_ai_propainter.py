"""Offline ProPainter adapter, using only verified S02 inference assets.

Bounded contiguous optical flow stays separate from sparse appearance references.
Native-resolution subtitle crops are padded and pasted back, never resized.
RAFT uses FP32; flow completion and repair use the validated FP16 runtime.
"""

from __future__ import annotations

import argparse
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from video_ai_device import clear_device_cache, mps_backend_available, mps_fallback_enabled
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

    def __init__(
        self,
        root: Path,
        *,
        device: str = "cuda",
        precision: str | None = None,
        cancel_after_crop: Path | None = None,
    ) -> None:
        self.root, self.device = root, device
        self.precision = precision
        self.cancel_after_crop = cancel_after_crop
        self.raft: Any = None
        self.flow: Any = None
        self.model: Any = None
        self.torch: Any = None
        self._torchvision: Any = None
        self._original_deform_conv2d: Any = None
        self._original_fold: Any = None
        self.repair_dtype: Any = None
        self.owns_cuda = False
        self.owns_mps = False
        self.on_stage: Callable[[str], None] = lambda _: None
        self.timings_ms: dict[str, float] = {
            "weightLoad": 0.0,
            "raftBidirectional": 0.0,
            "flowCompletion": 0.0,
            "flowCombination": 0.0,
            "imagePropagation": 0.0,
            "repairNetwork": 0.0,
        }
        self.stage_calls = {name: 0 for name in self.timings_ms if name != "weightLoad"}
        self.deform_conv = {"calls": 0, "transferredBytes": 0, "durationMs": 0.0, "inputShapes": []}
        self.col2im_fold = {"calls": 0, "transferredBytes": 0, "durationMs": 0.0, "inputShapes": []}
        self.crop_bounds_seen: list[tuple[int, int, int, int]] = []
        self.first_window: Any = None
        self.first_prediction: Any = None
        self.first_repaired: Any = None
        self.first_window_stage_timings_ms: dict[str, float] = {}
        self.first_window_mps_peak_bytes: int | None = None
        self.first_window_cpu_islands: dict[str, dict[str, Any]] = {}
        self.windows = 0
        self.center_frames = 0
        self.peak_mps_bytes = 0
        self.parameter_devices: dict[str, list[str]] = {}
        self.parameter_dtypes: dict[str, list[str]] = {}
        self.fallback_disabled = True

    def _sync(self) -> None:
        if self.device == "mps" and self.torch is not None:
            self.torch.mps.synchronize()
            self.peak_mps_bytes = max(self.peak_mps_bytes, int(self.torch.mps.driver_allocated_memory()))

    def _timed(self, name: str, call: Callable[[], Any]) -> Any:
        self._sync()
        started = time.perf_counter()
        result = call()
        self._sync()
        self.timings_ms[name] = round(self.timings_ms[name] + (time.perf_counter() - started) * 1000, 3)
        self.stage_calls[name] += 1
        return result

    def _validate_tree(self, name: str, value: Any, expected_dtype: Any = None) -> None:
        torch = self.torch
        dtype = self.repair_dtype if expected_dtype is None else expected_dtype
        if isinstance(value, torch.Tensor):
            if value.device.type != self.device or value.dtype != dtype:
                raise RuntimeError(f"{name} changed device or dtype: {value.device}/{value.dtype}")
            if not torch.isfinite(value).all().item():
                raise RuntimeError(f"{name} produced non-finite values")
        elif isinstance(value, (tuple, list)):
            for item in value:
                self._validate_tree(name, item, dtype)

    def set_stage_callback(self, callback: Callable[[str], None]) -> None:
        self.on_stage = callback

    def prepare(self, check_cancelled: CancelCheck) -> None:
        check_cancelled()
        if read_bundle(self.root)["engine"] != "propainter":
            raise ProPainterFailure("PROPAINTER_UNAVAILABLE", "ProPainter 资源类型不匹配")
        import torch
        import torchvision

        self.torch = torch
        self._torchvision = torchvision
        if self.device == "cuda":
            if not torch.cuda.is_available():
                raise ProPainterFailure("VIDEO_AI_CUDA_UNAVAILABLE", "ProPainter 需要可用的 NVIDIA CUDA 运行时")
            if torch.__version__ != "2.6.0+cu124" or torchvision.__version__ != "0.21.0+cu124":
                raise ProPainterFailure(
                    "PROPAINTER_UNAVAILABLE", "ProPainter 需要已验证的 PyTorch / torchvision CUDA 12.4 运行时"
                )
            if torch.cuda.mem_get_info()[0] < 3 * 1024**3:
                raise ProPainterFailure("CUDA_OUT_OF_MEMORY", "ProPainter 当前可用显存不足 3 GiB，请先释放其他 GPU 任务")
            self.precision = self.precision or "fp16"
            self.repair_dtype = torch.float16 if self.precision == "fp16" else torch.float32
            self.owns_cuda = True
        elif self.device == "mps":
            self.fallback_disabled = not mps_fallback_enabled()
            if not mps_backend_available(torch):
                raise ProPainterFailure("VIDEO_AI_MPS_UNAVAILABLE", "ProPainter 需要可用的 Apple MPS 运行时")
            if mps_fallback_enabled():
                raise ProPainterFailure(
                    "VIDEO_AI_MPS_FALLBACK_ENABLED", "MPS CPU fallback 已启用，ProPainter 已停止以避免静默回退"
                )
            if torch.__version__ != "2.6.0" or torchvision.__version__ != "0.21.0":
                raise ProPainterFailure(
                    "PROPAINTER_UNAVAILABLE", "ProPainter MPS 需要已验证的 PyTorch / torchvision 2.6.0 / 0.21.0"
                )
            self.precision = self.precision or "fp16"
            if self.precision not in {"fp32", "fp16"}:
                raise ProPainterFailure("VIDEO_AI_DEVICE_INVALID", "ProPainter MPS 精度只能选择 FP32 或 FP16")
            self.repair_dtype = torch.float16 if self.precision == "fp16" else torch.float32
            self.owns_mps = True
        elif self.device == "cpu":
            if torch.__version__ not in {"2.6.0", "2.6.0+cu124"} or torchvision.__version__ not in {
                "0.21.0",
                "0.21.0+cu124",
            }:
                raise ProPainterFailure("PROPAINTER_UNAVAILABLE", "ProPainter CPU 验证需要 PyTorch 2.6.0 / torchvision 0.21.0")
            self.precision = self.precision or "fp32"
            self.repair_dtype = torch.float16 if self.precision == "fp16" else torch.float32
        else:
            raise ProPainterFailure("VIDEO_AI_DEVICE_INVALID", "ProPainter 设备只能选择 CPU、CUDA 或 Apple MPS")
        check_cancelled()
        load_started = time.perf_counter()

        def load(name: str) -> Any:
            with owned_path(self.root, f"weights/{name}").open("rb") as handle:
                return torch.load(handle, map_location="cpu", weights_only=True)

        raft_type = load_vendor_module(self.root, "RAFT").RAFT
        self.raft = raft_type(argparse.Namespace(small=False, mixed_precision=False, alternate_corr=False))
        self.raft.load_state_dict(
            {key.removeprefix("module."): value for key, value in load("raft-things.pth").items()}, strict=True
        )
        check_cancelled()
        if self.device == "cuda":
            self.owns_cuda = True  # Includes cleanup after a partial device allocation.
        elif self.device == "mps":
            self.owns_mps = True
        self.raft.eval().to(device=self.device, dtype=torch.float32)
        check_cancelled()
        self.flow = load_vendor_module(self.root, "model.recurrent_flow_completion").RecurrentFlowCompleteNet()
        self.flow.load_state_dict(load("recurrent_flow_completion.pth"), strict=True)
        self.flow.eval().to(device=self.device, dtype=self.repair_dtype)
        check_cancelled()
        self.model = load_vendor_module(self.root, "model.propainter").InpaintGenerator(init_weights=False)
        self.model.load_state_dict(load("ProPainter.pth"), strict=True)
        self.model.eval().to(device=self.device, dtype=self.repair_dtype)
        if self.device == "mps":
            self._install_explicit_cpu_islands()
        self.timings_ms["weightLoad"] = round((time.perf_counter() - load_started) * 1000, 3)
        self._sync()
        for name, module in (("raft", self.raft), ("flow", self.flow), ("repair", self.model)):
            self.parameter_devices[name] = sorted({str(value.device) for value in (*module.parameters(), *module.buffers())})
            self.parameter_dtypes[name] = sorted({str(value.dtype) for value in (*module.parameters(), *module.buffers())})
            expected_device = f"{self.device}:0" if self.device in {"cuda", "mps"} else "cpu"
            if not self.parameter_devices[name] or any(value != expected_device for value in self.parameter_devices[name]):
                raise ProPainterFailure("PROPAINTER_UNAVAILABLE", f"{name} parameters escaped {expected_device}")
            expected_dtype = "torch.float32" if name == "raft" or self.precision == "fp32" else "torch.float16"
            dtypes = set(self.parameter_dtypes[name])
            if expected_dtype not in dtypes or dtypes - {expected_dtype, "torch.int64"}:
                raise ProPainterFailure("PROPAINTER_UNAVAILABLE", f"{name} parameter dtype mismatch")
        check_cancelled()

    def _install_explicit_cpu_islands(self) -> None:
        """Run the two known unsupported MPS operators as explicit FP32 CPU islands."""
        torch = self.torch
        torchvision = self._torchvision
        original_deform_conv2d = torchvision.ops.deform_conv2d
        original_fold = torch.nn.functional.fold
        self._original_deform_conv2d = original_deform_conv2d
        self._original_fold = original_fold

        def cpu_deform_conv2d(
            input: Any,
            offset: Any,
            weight: Any,
            bias: Any = None,
            stride: Any = 1,
            padding: Any = 0,
            dilation: Any = 1,
            mask: Any = None,
        ) -> Any:
            self._sync()
            started = time.perf_counter()
            values = [input, offset, weight, bias, mask]
            transferred_in = 0
            cpu_values = []
            for value in values:
                if value is None:
                    cpu_values.append(None)
                    continue
                cpu_value = value.to(device="cpu", dtype=torch.float32).contiguous()
                transferred_in += cpu_value.numel() * cpu_value.element_size()
                cpu_values.append(cpu_value)
            output = original_deform_conv2d(*cpu_values[:3], cpu_values[3], stride, padding, dilation, cpu_values[4])
            if output.device.type != "cpu" or output.dtype != torch.float32:
                raise RuntimeError("Explicit CPU deform-conv island returned an unexpected device or dtype")
            result = output.to(device=input.device, dtype=input.dtype)
            transferred_out = output.numel() * output.element_size()
            self._sync()
            self.deform_conv["calls"] += 1
            self.deform_conv["transferredBytes"] += transferred_in + transferred_out
            self.deform_conv["durationMs"] = round(
                float(self.deform_conv["durationMs"]) + (time.perf_counter() - started) * 1000, 3
            )
            shape = list(input.shape)
            if shape not in self.deform_conv["inputShapes"]:
                self.deform_conv["inputShapes"].append(shape)
            if result.device.type != "mps" or result.dtype != input.dtype:
                raise RuntimeError("Explicit CPU deform-conv island did not return to the source MPS dtype")
            return result

        def cpu_col2im_fold(input: Any, *args: Any, **kwargs: Any) -> Any:
            self._sync()
            started = time.perf_counter()
            cpu_input = input.to(device="cpu", dtype=torch.float32).contiguous()
            transferred_in = cpu_input.numel() * cpu_input.element_size()
            output = original_fold(cpu_input, *args, **kwargs)
            if output.device.type != "cpu" or output.dtype != torch.float32:
                raise RuntimeError("Explicit CPU col2im island returned an unexpected device or dtype")
            result = output.to(device=input.device, dtype=input.dtype)
            transferred_out = output.numel() * output.element_size()
            self._sync()
            self.col2im_fold["calls"] += 1
            self.col2im_fold["transferredBytes"] += transferred_in + transferred_out
            self.col2im_fold["durationMs"] = round(
                float(self.col2im_fold["durationMs"]) + (time.perf_counter() - started) * 1000, 3
            )
            shape = list(input.shape)
            if shape not in self.col2im_fold["inputShapes"]:
                self.col2im_fold["inputShapes"].append(shape)
            if result.device.type != "mps" or result.dtype != input.dtype:
                raise RuntimeError("Explicit CPU col2im island did not return to the source MPS dtype")
            return result

        torchvision.ops.deform_conv2d = cpu_deform_conv2d
        torch.nn.functional.fold = cpu_col2im_fold

    def _flow_pair(self, left: Any, right: Any, check: CancelCheck) -> tuple[Any, Any]:
        check()
        forward = self._timed("raftBidirectional", lambda: self.raft(left, right, iters=20, test_mode=True)[1])
        self._validate_tree("RAFT forward flow", forward, self.torch.float32)
        check()
        backward = self._timed("raftBidirectional", lambda: self.raft(right, left, iters=20, test_mode=True)[1])
        self._validate_tree("RAFT backward flow", backward, self.torch.float32)
        check()
        if self.repair_dtype is None:
            return forward.half(), backward.half()
        return forward.to(dtype=self.repair_dtype), backward.to(dtype=self.repair_dtype)

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
                torch.from_numpy(images[:count].copy()).permute(0, 3, 1, 2).to(self.device, torch.float32) / 127.5 - 1
            )
            self.on_stage("flow")
            if len(window.local) == 1:
                forward = backward = torch.zeros((1, 1, 2, height, width), device=self.device, dtype=self.repair_dtype)
            else:
                pairs = [
                    self._flow_pair(local_images[index : index + 1], local_images[index + 1 : index + 2], check)
                    for index in range(count - 1)
                ]
                forward = torch.stack([pair[0] for pair in pairs], dim=1)
                backward = torch.stack([pair[1] for pair in pairs], dim=1)
                del pairs
            del local_images
            self._validate_tree("bidirectional contiguous RAFT flow", (forward, backward))
            check()
            images_t = torch.from_numpy(images).permute(0, 3, 1, 2).to(self.device, self.repair_dtype).unsqueeze(0) / 127.5 - 1
            masks_t = torch.from_numpy(masks).unsqueeze(0).unsqueeze(2).to(self.device, self.repair_dtype)
            local_masks = masks_t[:, :count]
            self.on_stage("propagate")
            flows, _ = self._timed(
                "flowCompletion", lambda: self.flow.forward_bidirect_flow((forward, backward), local_masks)
            )
            self._validate_tree("flow completion", flows)
            check()
            flows = self._timed("flowCombination", lambda: self.flow.combine_flow((forward, backward), flows, local_masks))
            self._validate_tree("combined forward/backward flow", flows)
            del forward, backward
            check()
            propagated, updated_masks = self._timed(
                "imagePropagation",
                lambda: self.model.img_propagation(
                    images_t[:, :count] * (1 - local_masks), flows, local_masks, "nearest"
                ),
            )
            self._validate_tree("image propagation", (propagated, updated_masks))
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
            prediction = self._timed(
                "repairNetwork", lambda: self.model(updated, flows, masks_t, updated_masks, count)
            )
            selected = prediction[0, window.center_offset : window.center_offset + window.center_count]
            self._validate_tree("repair network", selected)
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
        self.crop_bounds_seen.append(bounds)
        timing_before = self.timings_ms.copy()
        deform_before = dict(self.deform_conv)
        col2im_before = dict(self.col2im_fold)
        mps_before = self.peak_mps_bytes
        prediction = self._predict_crop(window, bounds, check_cancelled)
        if self.first_window is None:
            self.first_window = SequenceWindow(
                local=tuple(FramePacket(packet.index, packet.image.copy(), packet.mask.copy()) for packet in window.local),
                center_offset=window.center_offset,
                center_count=window.center_count,
                references=tuple(
                    FramePacket(packet.index, packet.image.copy(), packet.mask.copy()) for packet in window.references
                ),
                scene=window.scene,
                first=window.first,
                last=window.last,
            )
            self.first_prediction = prediction.copy()
            self.first_window_stage_timings_ms = {
                name: round(value - timing_before[name], 3)
                for name, value in self.timings_ms.items()
                if name != "weightLoad"
            }
            self.first_window_mps_peak_bytes = max(mps_before, self.peak_mps_bytes)
            self.first_window_cpu_islands = {
                "deformConv2d": {
                    "calls": self.deform_conv["calls"] - deform_before["calls"],
                    "transferredBytes": self.deform_conv["transferredBytes"] - deform_before["transferredBytes"],
                    "durationMs": round(float(self.deform_conv["durationMs"]) - float(deform_before["durationMs"]), 3),
                },
                "col2imFold": {
                    "calls": self.col2im_fold["calls"] - col2im_before["calls"],
                    "transferredBytes": self.col2im_fold["transferredBytes"] - col2im_before["transferredBytes"],
                    "durationMs": round(float(self.col2im_fold["durationMs"]) - float(col2im_before["durationMs"]), 3),
                },
            }
        left, top, right, bottom = bounds
        results = []
        for index, packet in enumerate(window.centers):
            output = packet.image.copy()
            selected = packet.mask[top:bottom, left:right] > 0
            output[top:bottom, left:right][selected] = prediction[index, : bottom - top, : right - left][selected]
            if not np.array_equal(output[~(packet.mask > 0)], packet.image[~(packet.mask > 0)]):
                raise ProPainterFailure("ENGINE_FAILED", "ProPainter changed pixels outside the Worker mask")
            results.append(output)
        if self.first_repaired is None:
            self.first_repaired = tuple(frame.copy() for frame in results)
        self.windows += 1
        self.center_frames += len(results)
        check_cancelled()
        if self.cancel_after_crop is not None:
            self.cancel_after_crop.parent.mkdir(parents=True, exist_ok=True)
            self.cancel_after_crop.write_text("cancel\n", encoding="ascii")
            check_cancelled()
        return results

    def close(self) -> None:
        self._sync()
        self.model = self.flow = self.raft = None
        self.on_stage = lambda _: None
        if self._torchvision is not None and self._original_deform_conv2d is not None:
            self._torchvision.ops.deform_conv2d = self._original_deform_conv2d
        if self.torch is not None and self._original_fold is not None:
            self.torch.nn.functional.fold = self._original_fold
        self._original_deform_conv2d = None
        self._original_fold = None
        self._torchvision = None
        if self.owns_cuda and self.torch is not None:
            self.owns_cuda = False
            clear_device_cache(self.torch, "cuda")
        if self.owns_mps and self.torch is not None:
            self.owns_mps = False
            clear_device_cache(self.torch, "mps")
        self.torch = None
