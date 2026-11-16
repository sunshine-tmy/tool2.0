"""Run the repository Chatterbox worker on pinned Mac CPU and MPS assets."""

from __future__ import annotations

import argparse
import asyncio
import gc
import hashlib
import importlib.metadata
import importlib.util
import json
import math
import os
import platform
import shutil
import sys
import time
import traceback
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SOURCE_COMMIT = "65b18437192794391a0308a8f705b1e33e633948"
MODEL_REVISION = "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18"
MODEL_FILES = (
    "ve.pt",
    "t3_mtl23ls_v3.safetensors",
    "s3gen.pt",
    "grapheme_mtl_merged_expanded_v1.json",
)
LANGUAGES = (
    {
        "id": "ms",
        "reference": "reference-ms.wav",
        "text": "Selamat pagi, cuaca hari ini sangat baik dan cerah.",
    },
    {
        "id": "en",
        "reference": "reference-en.wav",
        "text": "Good morning. The weather is clear and bright today.",
    },
    {
        "id": "pt-BR",
        "reference": "reference-pt-BR.wav",
        "text": "Bom dia. O tempo está agradável e ensolarado hoje.",
    },
)
SAMPLE_PATHS = tuple(f"samples/{entry['reference']}" for entry in LANGUAGES)
PACKAGE_DISTRIBUTIONS = {
    "torch": "torch",
    "torchaudio": "torchaudio",
    "transformers": "transformers",
    "safetensors": "safetensors",
    "numpy": "numpy",
    "librosa": "librosa",
    "diffusers": "diffusers",
    "resemble-perth": "resemble-perth",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def emit_progress(output_directory: Path, stage: str, state: str, started_at: float) -> None:
    record = {"stage": stage, "state": state, "elapsedMs": round((time.monotonic() - started_at) * 1000)}
    with (output_directory / "progress.ndjson").open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(record, separators=(",", ":")) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def verify_manifest_files(assets_directory: Path) -> dict[str, str]:
    manifest_path = assets_directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("resources"), list):
        raise RuntimeError("Chatterbox asset manifest must use schemaVersion 1 and a resources array")
    resources = {entry.get("id"): entry for entry in manifest["resources"] if isinstance(entry, dict)}
    hashes: dict[str, str] = {}
    for name in MODEL_FILES:
        resource = resources.get(f"chatterbox-model:{name}")
        if not resource or resource.get("path") != f"models/chatterbox/{name}":
            raise RuntimeError(f"Pinned Chatterbox model is missing from manifest: {name}")
        model_path = assets_directory / resource["path"]
        if not model_path.is_file() or model_path.is_symlink():
            raise RuntimeError(f"Pinned Chatterbox model is missing or linked: {name}")
        actual = sha256(model_path)
        if actual != resource.get("sha256"):
            raise RuntimeError(f"Chatterbox model manifest digest mismatch: {name}")
        hashes[name] = actual
    for relative in SAMPLE_PATHS:
        resource = resources.get(f"sample:{Path(relative).name}")
        if not resource or resource.get("path") != relative:
            raise RuntimeError(f"Synthetic reference is missing from manifest: {relative}")
        sample = assets_directory / relative
        if not sample.is_file() or sample.is_symlink() or sha256(sample) != resource.get("sha256"):
            raise RuntimeError(f"Synthetic reference manifest digest mismatch: {relative}")
    return hashes


def load_worker(assets_directory: Path, output_directory: Path, *, offline: bool = True) -> Any:
    if (REPOSITORY_ROOT / ".env").exists():
        raise RuntimeError("Refusing to import the Chatterbox worker while the repository .env file exists")

    source_root = assets_directory / "source-tree" / f"chatterbox-{SOURCE_COMMIT}" / "src"
    if not (source_root / "chatterbox" / "mtl_tts.py").is_file():
        raise RuntimeError(f"Pinned Chatterbox source tree is missing: {source_root}")
    os.environ.update(
        {
            "TOOLBOX_DESKTOP_MANAGED": "1",
            "CHATTERBOX_DEVICE": "cpu",
            "CHATTERBOX_MODEL_REVISION": MODEL_REVISION,
            "CHATTERBOX_MODELS_ROOT": str(assets_directory / "models" / "chatterbox"),
            "CHATTERBOX_STORAGE_ROOT": str(output_directory / "storage" / "chatterbox"),
            "HF_HOME": str(output_directory / "cache" / "huggingface"),
            "PYTHONNOUSERSITE": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
            "TOKENIZERS_PARALLELISM": "false",
        }
    )
    if offline:
        os.environ.update(
            {
                "HF_HUB_OFFLINE": "1",
                "TRANSFORMERS_OFFLINE": "1",
                "HF_DATASETS_OFFLINE": "1",
            }
        )
    else:
        os.environ.pop("HF_HUB_OFFLINE", None)
        os.environ.pop("TRANSFORMERS_OFFLINE", None)
        os.environ.pop("HF_DATASETS_OFFLINE", None)
    # MPS fallback must stay disabled so a passing MPS result means operations ran on MPS.
    os.environ.pop("PYTORCH_ENABLE_MPS_FALLBACK", None)
    (output_directory / "storage" / "chatterbox" / "inputs").mkdir(parents=True, exist_ok=True)
    (output_directory / "storage" / "chatterbox" / "outputs").mkdir(parents=True, exist_ok=True)
    (output_directory / "cache" / "huggingface").mkdir(parents=True, exist_ok=True)

    sys.path.insert(0, str(source_root))
    sys.path.insert(0, str(REPOSITORY_ROOT / "scripts"))
    worker_path = REPOSITORY_ROOT / "scripts" / "chatterbox-worker.py"
    spec = importlib.util.spec_from_file_location("macos_m01_03_chatterbox_worker", worker_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the repository Chatterbox worker")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def package_versions() -> dict[str, str]:
    versions = {name: importlib.metadata.version(distribution) for name, distribution in PACKAGE_DISTRIBUTIONS.items()}
    versions["chatterboxSourceCommit"] = SOURCE_COMMIT
    return versions


def prepare_inputs(worker: Any, assets_directory: Path) -> dict[str, Path]:
    input_root = Path(worker.STORAGE_ROOT) / "inputs"
    inputs = {}
    for entry in LANGUAGES:
        key = entry["id"]
        source = assets_directory / "samples" / entry["reference"]
        destination = input_root / entry["reference"]
        shutil.copyfile(source, destination)
        inputs[key] = destination
    return inputs


def inspect_audio(path: Path, expected_sample_rate: int | None = None) -> dict[str, Any]:
    if not path.is_file() or path.stat().st_size <= 44:
        raise RuntimeError(f"Expected a non-empty decodable audio file: {path.name}")
    import torch
    import torchaudio

    audio, sample_rate = torchaudio.load(str(path))
    if audio.ndim != 2 or audio.shape[0] < 1 or audio.shape[1] < 1:
        raise RuntimeError(f"Audio decode returned an invalid shape for {path.name}: {tuple(audio.shape)}")
    if expected_sample_rate is not None and sample_rate != expected_sample_rate:
        raise RuntimeError(f"Audio sample rate changed for {path.name}: {sample_rate}")
    if not torch.isfinite(audio).all().item():
        raise RuntimeError(f"Decoded audio contains NaN or infinity: {path.name}")
    duration = float(audio.shape[-1]) / float(sample_rate)
    peak = float(audio.abs().max().item())
    rms = float(torch.mean(audio.float().square()).sqrt().item())
    if not math.isfinite(duration) or not 0.5 <= duration <= 30:
        raise RuntimeError(f"Audio duration is outside the 0.5–30 second validation range: {path.name} ({duration})")
    if peak <= 1e-4 or rms <= 1e-5:
        raise RuntimeError(f"Audio is silent or nearly silent: {path.name}")
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "format": "WAV",
        "channels": int(audio.shape[0]),
        "sampleRate": int(sample_rate),
        "samples": int(audio.shape[-1]),
        "durationSeconds": round(duration, 3),
        "peak": peak,
        "rms": rms,
        "finite": True,
        "decoded": True,
    }


def model_device_summary(model: Any) -> dict[str, Any]:
    result = {}
    for name in ("t3", "s3gen", "ve"):
        module = getattr(model, name)
        parameter_devices: dict[str, int] = {}
        buffer_devices: dict[str, int] = {}
        for parameter in module.parameters():
            key = str(parameter.device)
            parameter_devices[key] = parameter_devices.get(key, 0) + 1
        for buffer in module.buffers():
            key = str(buffer.device)
            buffer_devices[key] = buffer_devices.get(key, 0) + 1
        if "meta" in parameter_devices or "meta" in buffer_devices:
            raise RuntimeError(f"Chatterbox {name} still contains meta tensors")
        result[name] = {"parameters": parameter_devices, "buffers": buffer_devices}
    return result


def mps_tensor_probe(torch: Any) -> dict[str, Any]:
    real = torch.tensor([0.125, 2.5, -1.75], dtype=torch.float32)
    expected_real = real * 2.0 + 0.25
    actual_real = (real.to("mps") * 2.0 + 0.25).cpu()
    if not torch.allclose(actual_real, expected_real, rtol=0, atol=1e-6):
        raise RuntimeError("Real tensor migration and arithmetic changed values on MPS")

    complex_values = torch.tensor([1.0 + 2.0j, -0.5 + 0.25j], dtype=torch.complex64)
    expected_complex = complex_values * (2.0 - 1.0j) + (0.5 + 0.25j)
    actual_complex = (complex_values.to("mps") * (2.0 - 1.0j) + (0.5 + 0.25j)).cpu()
    if not torch.allclose(actual_complex, expected_complex, rtol=0, atol=1e-6):
        raise RuntimeError("Complex tensor migration and arithmetic changed values on MPS")
    torch.mps.synchronize()
    return {
        "status": "pass",
        "realTensorRoundTrip": actual_real.tolist(),
        "complexTensorRoundTrip": [[float(value.real), float(value.imag)] for value in actual_complex.tolist()],
        "fallbackEnabled": False,
    }


def capture_model_audio(model: Any, torch: Any) -> list[dict[str, Any]]:
    captured: list[dict[str, Any]] = []
    original_generate = model.generate

    def capture(*args: Any, **kwargs: Any) -> Any:
        audio = original_generate(*args, **kwargs)
        if not isinstance(audio, torch.Tensor):
            raise RuntimeError("Chatterbox generate() did not return a Torch tensor")
        finite = bool(torch.isfinite(audio).all().item())
        if not finite:
            raise RuntimeError("Chatterbox generated a tensor with NaN or infinity")
        captured.append(
            {
                "finite": finite,
                "shape": list(audio.shape),
                "sampleRate": int(model.sr),
                "device": str(audio.device),
                "peak": float(audio.detach().abs().max().item()),
                "rms": float(torch.mean(audio.detach().float().square()).sqrt().item()),
            }
        )
        return audio

    model.generate = capture
    return captured


async def run_language_suite(
    worker: Any,
    mode: str,
    inputs: dict[str, Path],
    output_directory: Path,
    started_at: float,
) -> dict[str, Any]:
    import torch

    if mode == "mps":
        if not torch.backends.mps.is_built() or not torch.backends.mps.is_available():
            return {"status": "not_available", "backendBuilt": torch.backends.mps.is_built()}
        tensor_probe = mps_tensor_probe(torch)
        selected_device = worker.selected_device

        def selected_mps(requested: str | None = None) -> str:
            if requested == "mps":
                return "mps"
            return selected_device(requested)

        worker.selected_device = selected_mps
    else:
        tensor_probe = None

    initialization_started = time.monotonic()
    model = worker.manager.load(mode)
    initialization_ms = round((time.monotonic() - initialization_started) * 1000)
    device_summary = model_device_summary(model)
    expected_device = "mps" if mode == "mps" else "cpu"
    for component, devices in device_summary.items():
        for tensor_group in ("parameters", "buffers"):
            actual_device_types = {device.split(":", 1)[0] for device in devices[tensor_group]}
            if actual_device_types and actual_device_types != {expected_device}:
                raise RuntimeError(
                    f"{mode} Chatterbox {component} {tensor_group} were not fully migrated: {devices}"
                )
    captured = capture_model_audio(model, torch)

    operations = {}
    for index, entry in enumerate(LANGUAGES):
        language = entry["id"]
        output_path = Path(worker.STORAGE_ROOT) / "outputs" / f"{mode}-{language}.wav"
        output_path.unlink(missing_ok=True)
        values = {
            "text": entry["text"],
            "language": language,
            "device": mode,
            "reference_path": str(inputs[language]),
            "output_path": str(output_path),
            "exaggeration": 0.5,
            "cfg_weight": 0.5,
            "temperature": 0.8,
            "seed": 2100 + index,
        }
        if mode == "mps":
            payload = worker.GenerateRequest.model_construct(**values)
        else:
            payload = worker.GenerateRequest(**values)
        captured_before = len(captured)
        emit_progress(output_directory, f"{mode}-{language}", "started", started_at)
        operation_started = time.monotonic()
        response = await worker.generate(payload)
        if mode == "mps":
            torch.mps.synchronize()
        duration_ms = round((time.monotonic() - operation_started) * 1000)
        data = response.get("data", {})
        if not response.get("success") or data.get("device") != expected_device or not data.get("watermarked"):
            raise RuntimeError(f"Chatterbox {mode} {language} worker response was incomplete: {response}")
        audio = inspect_audio(output_path, expected_sample_rate=int(model.sr))
        language_tensors = captured[captured_before:]
        if len(language_tensors) != data.get("chunks") or not language_tensors:
            raise RuntimeError(
                f"Chatterbox {mode} {language} tensor count {len(language_tensors)} did not match "
                f"the worker's {data.get('chunks')} text chunks"
            )
        operations[language] = {
            "status": "pass",
            "durationMs": duration_ms,
            "sampleRate": int(data["sampleRate"]),
            "samples": int(data["samples"]),
            "workerDurationSeconds": float(data["durationSeconds"]),
            "watermarked": bool(data["watermarked"]),
            "rawTensors": language_tensors,
            "decodedOutput": audio,
        }
        emit_progress(output_directory, f"{mode}-{language}", "passed", started_at)

    await asyncio.to_thread(worker.cancel_idle_unload_timer)
    await asyncio.to_thread(worker.manager.unload)
    if mode == "mps":
        torch.mps.synchronize()
        torch.mps.empty_cache()
    gc.collect()
    release = {
        "status": "pass" if worker.manager.model is None and worker.manager.device is None and not worker.manager.lock.locked() else "fail",
        "modelReferenceCleared": worker.manager.model is None,
        "deviceReferenceCleared": worker.manager.device is None,
        "workerLockReleased": not worker.manager.lock.locked(),
    }
    if release["status"] != "pass":
        raise RuntimeError(f"Chatterbox {mode} model references or worker lock remained active: {release}")
    result: dict[str, Any] = {
        "status": "pass",
        "device": mode,
        "modelInitializationMs": initialization_ms,
        "modelDevices": device_summary,
        "operations": operations,
        "release": release,
    }
    if tensor_probe is not None:
        result["tensorMigration"] = tensor_probe
        try:
            worker.GenerateRequest.model_validate(
                {"text": "test", "language": "en", "device": "mps", "reference_path": "x", "output_path": "y"}
            )
            result["workerRequestSchemaSupportsMps"] = True
        except Exception:
            result["workerRequestSchemaSupportsMps"] = False
    return result


async def run_mode(
    assets_directory: Path,
    output_directory: Path,
    mode: str,
    started_at: float,
) -> dict[str, Any]:
    worker = load_worker(assets_directory, output_directory)
    inputs = prepare_inputs(worker, assets_directory)
    references = {}
    for entry in LANGUAGES:
        reference = inputs[entry["id"]]
        references[entry["id"]] = inspect_audio(reference, expected_sample_rate=24_000)
    result = await run_language_suite(worker, mode, inputs, output_directory, started_at)
    result["references"] = references
    return result


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--case", required=True, choices=["M01-03-chatterbox"])
    parser.add_argument("--mode", choices=["both", "cpu", "mps"], default="both")
    arguments = parser.parse_args()
    output_directory = arguments.output_dir.resolve(strict=True)
    assets_directory = arguments.assets_dir.resolve(strict=True)
    model_hashes = verify_manifest_files(assets_directory)
    provenance = json.loads((assets_directory / "source-provenance.json").read_text(encoding="utf-8"))
    if provenance.get("source", {}).get("commit") != SOURCE_COMMIT or provenance.get("modelRevision") != MODEL_REVISION:
        raise RuntimeError("Chatterbox source or model revision does not match the pinned implementation")
    versions = package_versions()
    started_at = time.monotonic()
    common = {
        "schemaVersion": 1,
        "caseId": "M01-03-chatterbox",
        "python": ".".join(map(str, sys.version_info[:3])),
        "machine": platform.machine(),
        "sourceCommit": SOURCE_COMMIT,
        "modelRevision": MODEL_REVISION,
        "packages": versions,
        "modelSha256": model_hashes,
    }
    if arguments.mode == "cpu":
        cpu = asyncio.run(run_mode(assets_directory, output_directory, "cpu", started_at))
        result = {**common, "status": "pass", "modelValidation": "pass", "cpu": cpu}
        write_json(output_directory / "probe-result.json", result)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        return 0
    if arguments.mode == "mps":
        try:
            mps = asyncio.run(run_mode(assets_directory, output_directory, "mps", started_at))
        except Exception as error:
            failure = {
                "stage": "mps-model-inference",
                "type": type(error).__name__,
                "message": str(error),
                "traceback": traceback.format_exc(),
            }
            write_json(output_directory / "mps-failure.json", failure)
            result = {**common, "status": "fail", "modelValidation": "not_run", "mpsValidation": {"status": "fail", "failure": failure}}
            write_json(output_directory / "probe-result.json", result)
            print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
            return 1
        result = {**common, "status": "pass", "modelValidation": "not_run", "mpsValidation": mps}
        write_json(output_directory / "probe-result.json", result)
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        return 0

    cpu = asyncio.run(run_mode(assets_directory, output_directory, "cpu", started_at))
    emit_progress(output_directory, "mps", "started", started_at)
    try:
        mps = asyncio.run(run_mode(assets_directory, output_directory, "mps", started_at))
    except Exception as error:
        failure = {
            "stage": "mps-model-inference",
            "type": type(error).__name__,
            "message": str(error),
            "traceback": traceback.format_exc(),
            "minimumReproduction": (
                "Run tooling/chatterbox/macos-runtime-probe.py --mode mps with the same --python, --assets, and --output paths."
            ),
        }
        write_json(output_directory / "mps-failure.json", failure)
        (output_directory / "mps-failure.txt").write_text(
            "Chatterbox MPS inference failed.\n"
            "Expected MPS fallback is disabled.\n"
            f"Exception: {failure['type']}: {failure['message']}\n\n"
            f"{failure['traceback']}\n"
            f"Minimum reproduction: {failure['minimumReproduction']}\n",
            encoding="utf-8",
        )
        mps = {"status": "fail", "failure": failure, "failureArtifact": "mps-failure.txt"}
    if mps.get("status") != "fail":
        emit_progress(output_directory, "mps", "passed", started_at)
    result = {
        **common,
        "status": "pass",
        "modelValidation": "pass",
        "executionMode": "cpu+mps",
        "cpu": cpu,
        "mpsValidation": mps,
        "durationMs": round((time.monotonic() - started_at) * 1000),
    }
    write_json(output_directory / "probe-result.json", result)
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        sys.stderr.write(f"{type(error).__name__}: {error}\n")
        raise
