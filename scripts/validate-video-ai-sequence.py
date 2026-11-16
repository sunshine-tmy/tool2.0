#!/usr/bin/env python3
"""S01 opt-in, isolated CPU/CUDA/MPS validation. Never starts the application or downloads assets.

This is a short-clip compatibility probe, not a production engine or quality gate.
Each engine runs in a separate process with pinned upstream sources and weights.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.metadata
import json
import os
import socket
import sys
import threading
import time
from pathlib import Path

MANIFEST = Path(__file__).resolve().parents[1] / "tooling/video-ai/sequence-sources.json"


def owned_file(root: Path, relative: str) -> Path:
    relative_path = Path(relative)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("Asset path is not relative to the validation root")
    result = (root / relative_path).resolve(strict=True)
    if not result.is_relative_to(root.resolve()) or not result.is_file():
        raise ValueError("Validation asset escapes the isolated directory")
    return result


def verify_assets(root: Path, engine: str, manifest: dict) -> dict:
    entry = manifest["engines"][engine]
    if manifest["schemaVersion"] != 1:
        raise ValueError("Unsupported source manifest")
    for kind, items in (("upstream", entry["files"]), ("weights", entry["weights"])):
        for item in items:
            relative = f"{kind}/{engine}/{item['path'] if kind == 'upstream' else item['name']}"
            source = owned_file(root, relative)
            with source.open("rb") as handle:
                digest = hashlib.file_digest(handle, "sha256").hexdigest()
            if digest != item["sha256"] or ("bytes" in item and source.stat().st_size != item["bytes"]):
                raise ValueError(f"Asset digest/size mismatch: {relative}")
    return entry


def deny_network() -> None:
    # Allow only Python's internal Windows socketpair handshake, needed by asyncio.
    native_pair = socket.socketpair
    context = threading.local()

    def deny(*_args, **_kwargs):
        raise RuntimeError("Network is disabled during sequence inference validation")

    class GuardedSocket(socket.socket):
        def connect(self, address):
            if getattr(context, "pair", False):
                return super().connect(address)
            return deny()

        def connect_ex(self, address):
            return deny()

    def pair(*args, **kwargs):
        previous = getattr(context, "pair", False)
        context.pair = True
        try:
            return native_pair(*args, **kwargs)
        finally:
            context.pair = previous

    socket.__dict__["socket"] = GuardedSocket
    socket.create_connection = deny
    socket.socketpair = pair


def synthetic_clip(count: int, height: int, width: int):
    import numpy as np

    y, x = np.mgrid[:height, :width]
    clean = np.stack([(x * 2) % 256, (y * 2) % 256, (x + y) % 256], axis=-1).astype(np.uint8)
    originals = np.stack([np.roll(clean, index * 2, axis=1) for index in range(count)])
    masks = np.zeros((count, 1, height, width), dtype=np.float32)
    masks[:, :, height * 3 // 4 : height * 3 // 4 + 16, width // 6 : width * 5 // 6] = 1
    occluded = originals.copy()
    occluded[masks[:, 0] > 0] = 255
    return originals, occluded, masks


def peak_host_working_set() -> int | None:
    if sys.platform != "win32":
        return None
    import ctypes
    from ctypes import wintypes

    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
            (name, ctypes.c_size_t)
            for name in (
                "peak",
                "working",
                "paged_peak",
                "paged",
                "nonpaged_peak",
                "nonpaged",
                "pagefile",
                "pagefile_peak",
            )
        ]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        raise ctypes.WinError(ctypes.get_last_error())
    return int(counters.peak)


def install_mps_cpu_islands(torch, torchvision):
    """Install only the two explicitly approved ProPainter CPU operators."""
    original_deform = torchvision.ops.deform_conv2d
    original_fold = torch.nn.functional.fold
    calls = {"deformConv2d": 0, "foldCol2im": 0}

    def cpu_deform(input, offset, weight, bias=None, stride=1, padding=0, dilation=1, mask=None):
        values = [input, offset, weight, bias, mask]
        cpu_values = [value.to(device="cpu", dtype=torch.float32).contiguous() if value is not None else None for value in values]
        output = original_deform(*cpu_values[:3], cpu_values[3], stride, padding, dilation, cpu_values[4])
        if output.device.type != "cpu" or output.dtype != torch.float32:
            raise RuntimeError("Explicit CPU deform-conv island returned an unexpected device or dtype")
        result = output.to(device=input.device, dtype=input.dtype)
        if result.device.type != "mps" or result.dtype != input.dtype:
            raise RuntimeError("Explicit CPU deform-conv island did not return to MPS")
        calls["deformConv2d"] += 1
        return result

    def cpu_fold(input, *args, **kwargs):
        cpu_input = input.to(device="cpu", dtype=torch.float32).contiguous()
        output = original_fold(cpu_input, *args, **kwargs)
        if output.device.type != "cpu" or output.dtype != torch.float32:
            raise RuntimeError("Explicit CPU col2im island returned an unexpected device or dtype")
        result = output.to(device=input.device, dtype=input.dtype)
        if result.device.type != "mps" or result.dtype != input.dtype:
            raise RuntimeError("Explicit CPU col2im island did not return to MPS")
        calls["foldCol2im"] += 1
        return result

    torchvision.ops.deform_conv2d = cpu_deform
    torch.nn.functional.fold = cpu_fold
    def restore():
        torchvision.ops.deform_conv2d = original_deform
        torch.nn.functional.fold = original_fold

    return restore, calls


def run_probe(root: Path, engine: str, frames: int, width: int, height: int, precision: str, device: str) -> dict:
    import numpy as np
    import torch
    import torchvision
    from torchvision.ops import deform_conv2d

    if sys.version_info[:2] != (3, 12):
        raise RuntimeError("S01 requires the pinned Python 3.12 runtime")
    if device == "cuda":
        if torch.__version__ != "2.6.0+cu124" or torchvision.__version__ != "0.21.0+cu124":
            raise RuntimeError("CUDA S01 requires torch/torchvision 2.6.0+cu124 / 0.21.0+cu124")
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA was explicitly requested but is unavailable")
        x = torch.ones(1, 1, 4, 4, device="cuda")
        deform_conv2d(x, torch.zeros(1, 18, 2, 2, device="cuda"), torch.ones(1, 1, 3, 3, device="cuda"))
        torch.cuda.synchronize()
        free, total = torch.cuda.mem_get_info()
        if free < 2 * 1024**3:
            raise RuntimeError("Less than 2 GiB currently free; validation will not unload other applications")
    elif device == "mps":
        if torch.__version__ != "2.6.0" or torchvision.__version__ != "0.21.0":
            raise RuntimeError("MPS S01 requires torch/torchvision 2.6.0 / 0.21.0")
        if not torch.backends.mps.is_built() or not torch.backends.mps.is_available():
            raise RuntimeError("MPS was explicitly requested but is unavailable")
        if os.environ.get("PYTORCH_ENABLE_MPS_FALLBACK", "").strip().lower() in {"1", "true", "yes", "on"}:
            raise RuntimeError("MPS S01 refuses global CPU fallback")
        free, total = None, None
    elif device == "cpu":
        if torch.__version__ not in {"2.6.0", "2.6.0+cu124"} or torchvision.__version__ not in {
            "0.21.0",
            "0.21.0+cu124",
        }:
            raise RuntimeError("CPU S01 requires torch/torchvision 2.6.0 / 0.21.0")
        if engine == "propainter" and precision == "fp16":
            raise ValueError("CPU ProPainter S01 supports FP32 only")
        free, total = None, None
    else:
        raise ValueError(f"Unsupported explicit validation device: {device}")
    if engine == "propainter" and device == "mps" and precision not in {"fp32", "fp16"}:
        raise ValueError("MPS ProPainter supports explicit FP32 reference and FP16 hybrid validation")
    torch.manual_seed(0)
    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    sys.path.insert(0, str(root / "upstream" / engine))
    originals, occluded, mask_array = synthetic_clip(frames, height, width)
    images = torch.from_numpy(occluded).permute(0, 3, 1, 2).float().unsqueeze(0).to(device) / 127.5 - 1
    masks = torch.from_numpy(mask_array).unsqueeze(0).to(device)
    weights = root / "weights" / engine
    load_start = time.monotonic()

    def load(name):
        # Never fall back to unrestricted pickle loading.
        with (weights / name).open("rb") as handle:
            return torch.load(handle, map_location="cpu", weights_only=True)

    if engine == "sttn":
        if (width, height) != (432, 240) or precision != "fp32":
            raise ValueError("Official STTN S01 probe is fixed to 432x240 FP32, not a production resize policy")
        net = importlib.import_module("model.sttn").InpaintGenerator(init_weights=False)
        net.load_state_dict(load("sttn.pth")["netG"], strict=True)
        net.eval().to(device=device, dtype=torch.float32)
    else:
        raft_class = importlib.import_module("RAFT").RAFT
        raft = raft_class(argparse.Namespace(small=False, mixed_precision=False, alternate_corr=False))
        raft.load_state_dict({k.removeprefix("module."): v for k, v in load("raft-things.pth").items()}, strict=True)
        raft.eval().to(device=device, dtype=torch.float32)  # RAFT stays FP32, including when repair uses FP16.
        flow_net = importlib.import_module("model.recurrent_flow_completion").RecurrentFlowCompleteNet()
        flow_net.load_state_dict(load("recurrent_flow_completion.pth"), strict=True)
        flow_net.eval().to(device=device, dtype=torch.float32)
        net = importlib.import_module("model.propainter").InpaintGenerator(init_weights=False)
        net.load_state_dict(load("ProPainter.pth"), strict=True)
        net.eval().to(device=device, dtype=torch.float32)
    if device == "cuda":
        torch.cuda.synchronize()
    elif device == "mps":
        torch.mps.synchronize()
    load_seconds = time.monotonic() - load_start
    start = time.monotonic()
    if engine == "propainter" and device == "mps":
        restore_islands, cpu_island_calls = install_mps_cpu_islands(torch, torchvision)
    else:
        restore_islands, cpu_island_calls = lambda: None, None
    try:
        with torch.inference_mode():
            if engine == "sttn":
                prediction = net(images * (1 - masks), masks)
            else:
                left = images[:, :-1].reshape(-1, 3, height, width)
                right = images[:, 1:].reshape(-1, 3, height, width)
                forward = raft(left, right, iters=20)[1].view(1, frames - 1, 2, height, width)
                backward = raft(right, left, iters=20)[1].view(1, frames - 1, 2, height, width)
                if precision == "fp16":
                    images, masks = images.half(), masks.half()
                    forward, backward = forward.half(), backward.half()
                    flow_net, net = flow_net.half(), net.half()
                flows, _ = flow_net.forward_bidirect_flow((forward, backward), masks)
                flows = flow_net.combine_flow((forward, backward), flows, masks)
                propagated, updated_masks = net.img_propagation(images * (1 - masks), flows, masks, "nearest")
                updated = images * (1 - masks) + propagated.view(1, frames, 3, height, width) * masks
                prediction = net(updated, flows, masks, updated_masks.view(1, frames, 1, height, width), frames)
                if tuple(prediction.shape) != (1, frames, 3, height, width):
                    raise RuntimeError(f"Unexpected ProPainter output: {tuple(prediction.shape)}")
                prediction = prediction[0]
            if device == "cuda":
                torch.cuda.synchronize()
            elif device == "mps":
                torch.mps.synchronize()
            inference_seconds = time.monotonic() - start
            if tuple(prediction.shape) != (frames, 3, height, width) or not torch.isfinite(prediction).all():
                raise RuntimeError("Model output shape or finite values failed validation")
            pixels = ((prediction.float().cpu().permute(0, 2, 3, 1).numpy() + 1) * 127.5).clip(0, 255).astype(np.uint8)
    finally:
        restore_islands()
    if cpu_island_calls is not None and any(count < 1 for count in cpu_island_calls.values()):
        raise RuntimeError(f"A required explicit MPS CPU island was not used: {cpu_island_calls}")
    composed = occluded.copy()
    selected = mask_array[:, 0] > 0
    composed[selected] = pixels[selected]
    if not np.array_equal(composed[~selected], originals[~selected]):
        raise RuntimeError("Mask-exterior pixels changed before encoding")
    mae_before = float(np.abs(occluded[selected].astype(float) - originals[selected]).mean())
    mae_after = float(np.abs(composed[selected].astype(float) - originals[selected]).mean())
    if device == "cuda":
        peak_allocated = torch.cuda.max_memory_allocated()
        peak_reserved = torch.cuda.max_memory_reserved()
        device_name = torch.cuda.get_device_name()
    elif device == "mps":
        peak_allocated = torch.mps.driver_allocated_memory()
        peak_reserved = None
        device_name = "Apple MPS"
    else:
        peak_allocated = peak_reserved = None
        device_name = "CPU"
    return {
        "engine": engine,
        "precision": precision,
        "frames": frames,
        "width": width,
        "height": height,
        "python": sys.version.split()[0],
        "torch": torch.__version__,
        "torchvision": torchvision.__version__,
        "numpy": np.__version__,
        "validationDependencies": {name: importlib.metadata.version(name) for name in ("einops", "scipy")},
        "device": device_name,
        "deviceBackend": device,
        "mpsFallbackDisabled": device == "mps" and os.environ.get("PYTORCH_ENABLE_MPS_FALLBACK", "").strip().lower()
        not in {"1", "true", "yes", "on"},
        "explicitCpuIslandCalls": cpu_island_calls,
        "freeBeforeBytes": free,
        "totalBytes": total,
        "loadSeconds": load_seconds,
        "inferenceSeconds": inference_seconds,
        "peakAllocatedBytes": peak_allocated,
        "peakReservedBytes": peak_reserved,
        "peakHostWorkingSetBytes": peak_host_working_set(),
        "maskedMaeBefore": mae_before,
        "maskedMaeAfter": mae_after,
        "outsideMaskUnchanged": True,
        "scope": "short synthetic compatibility probe only; no production quality or 8GB/720p acceptance",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--engine", choices=("sttn", "propainter"), required=True)
    parser.add_argument("--frames", type=int, choices=range(2, 9), default=3)
    parser.add_argument("--width", type=int, default=432)
    parser.add_argument("--height", type=int, default=240)
    parser.add_argument("--precision", choices=("fp32", "fp16"), default="fp32")
    parser.add_argument("--device", choices=("cpu", "cuda", "mps"), default="cuda")
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    if (
        args.width < 128
        or args.height < 128
        or args.width > 856
        or args.height > 480
        or args.width % 8
        or args.height % 8
    ):
        parser.error("S01 dimensions must be multiples of 8 within 128..856 x 128..480")
    root = args.root.resolve(strict=True)
    report = root / args.report
    if Path(args.report).is_absolute() or ".." in Path(args.report).parts or report.parent.resolve() != root:
        parser.error("Report must be a new filename directly inside the isolated root")
    # Reserve the report before loading anything; existing evidence is never overwritten.
    with report.open("x", encoding="utf-8") as handle:
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
            verify_assets(root, args.engine, manifest)
            deny_network()
            result = {
                "success": True,
                **run_probe(root, args.engine, args.frames, args.width, args.height, args.precision, args.device),
            }
        except Exception as error:
            result = {"success": False, "engine": args.engine, "error": str(error), "type": type(error).__name__}
        json.dump(result, handle, ensure_ascii=False, indent=2)
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
