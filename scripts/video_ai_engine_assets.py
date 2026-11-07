"""Versioned video engine assets and source-only, package-local vendor imports.

No model is loaded and no directory is created on import. The signed package
manifest authenticates descriptors; this module verifies their declared closure
before executing source or loading weights. It never downloads anything.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.abc
import importlib.machinery
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType

ASSET_SCHEMA_VERSION = 1
_roots: dict[str, Path] = {}


def owned_path(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or "\\" in relative or ":" in relative or relative.startswith("/"):
        raise ValueError("Invalid engine asset path")
    current = root
    for part in relative.split("/"):
        if part in {"", ".", ".."}:
            raise ValueError("Invalid engine asset path")
        current = current / part
        if current.is_symlink() or current.is_junction():
            raise ValueError("Engine assets cannot contain links/junctions")
    if not current.resolve(strict=True).is_relative_to(root.resolve(strict=True)) or not current.is_file():
        raise ValueError("Engine asset escapes its package")
    return current


def read_bundle(root: Path, *, verify: bool = True) -> dict:
    if root.is_symlink() or root.is_junction():
        raise ValueError("Engine root cannot be a link/junction")
    root = root.resolve(strict=True)
    descriptor = owned_path(root, "sequence-bundle.json")
    if descriptor.stat().st_size > 128 * 1024:
        raise ValueError("Engine descriptor too large")
    bundle = json.loads(descriptor.read_text(encoding="utf-8"))
    engine = bundle.get("engine")
    if (
        bundle.get("assetSchemaVersion") != ASSET_SCHEMA_VERSION
        or engine not in {"sttn", "propainter"}
        or bundle.get("namespace") != f"toolbox_video_ai_vendor.{engine}"
    ):
        raise ValueError("Incompatible sequence engine assets")
    files = bundle.get("files")
    if not isinstance(files, list) or not 1 <= len(files) <= 128:
        raise ValueError("Invalid engine closure")
    seen: set[str] = set()
    weights: set[str] = set()
    for asset in files:
        relative = asset["path"]
        if relative.casefold() in seen:
            raise ValueError("Duplicate/case-colliding engine asset")
        seen.add(relative.casefold())
        file = owned_path(root, relative)
        role = asset.get("role")
        if role == "weight" and relative.startswith("weights/"):
            weights.add(relative)
        elif role == "source" and relative.startswith("vendor/") and relative.endswith(".py"):
            pass
        elif (role, relative) not in {("license", "LICENSE"), ("provenance", "PROVENANCE.json")}:
            raise ValueError("Undeclared engine file role")
        if verify:
            with file.open("rb") as handle:
                digest = hashlib.file_digest(handle, "sha256").hexdigest()
            if digest != asset.get("sha256") or file.stat().st_size != asset.get("bytes"):
                raise ValueError(f"Engine asset digest mismatch: {relative}")
    required_weights = (
        {"weights/sttn.pth"}
        if engine == "sttn"
        else {"weights/ProPainter.pth", "weights/raft-things.pth", "weights/recurrent_flow_completion.pth"}
    )
    if (
        weights != required_weights
        or not {"license", "provenance"}.issubset({asset["role"] for asset in files})
        or "vendor/__init__.py" not in seen
    ):
        raise ValueError("Incomplete engine source/weight/license closure")
    # Reject unlisted executable/code/weight files rather than copying/trusting them.
    declared = {asset["path"] for asset in files} | {"sequence-bundle.json"}
    for file in root.rglob("*"):
        if file.is_symlink() or file.is_junction():
            raise ValueError("Engine assets cannot contain links/junctions")
        if file.is_file() and file.relative_to(root).as_posix() not in declared:
            raise ValueError("Undeclared engine content")
    return bundle


class _SourceLoader(importlib.machinery.SourceFileLoader):
    def __init__(self, fullname: str, file: Path, digest: str):
        super().__init__(fullname, str(file))
        self.digest = digest

    def get_code(self, fullname: str):
        source = Path(self.path).read_bytes()
        if hashlib.sha256(source).hexdigest() != self.digest:
            raise ImportError("Engine source changed after verification")
        return compile(source, self.path, "exec", dont_inherit=True)


class _BundleFinder(importlib.abc.MetaPathFinder):
    def __init__(self, root: Path, bundle: dict):
        self.root, self.prefix = root, bundle["namespace"]
        self.modules: dict[str, tuple[dict, bool]] = {}
        for asset in bundle["files"]:
            if asset["role"] != "source":
                continue
            relative = asset["path"][len("vendor/") :]
            package = relative.endswith("__init__.py")
            suffix = (
                relative.removesuffix("/__init__.py")
                if package and relative != "__init__.py"
                else ""
                if package
                else relative[:-3]
            )
            name = self.prefix + ("." + suffix.replace("/", ".") if suffix else "")
            self.modules[name] = (asset, package)

    def find_spec(self, fullname, path=None, target=None):
        if fullname != self.prefix and not fullname.startswith(self.prefix + "."):
            return None
        if fullname not in self.modules:
            raise ModuleNotFoundError(f"Module is outside the declared engine closure: {fullname}")
        asset, package = self.modules[fullname]
        file = owned_path(self.root, asset["path"])
        loader = _SourceLoader(fullname, file, asset["sha256"])
        return importlib.util.spec_from_file_location(
            fullname, file, loader=loader, submodule_search_locations=[str(file.parent)] if package else None
        )


def load_vendor_module(root: Path, relative_module: str) -> ModuleType:
    bundle = read_bundle(root)
    prefix = bundle["namespace"]
    canonical = root.resolve(strict=True)
    if prefix in _roots and _roots[prefix] != canonical:
        raise RuntimeError("Engine generation changed; restart the owning worker")
    if prefix not in _roots:
        parent = "toolbox_video_ai_vendor"
        if parent not in sys.modules:
            namespace = ModuleType(parent)
            namespace.__dict__["__path__"] = []
            sys.modules[parent] = namespace
        sys.meta_path.insert(0, _BundleFinder(canonical, bundle))
        _roots[prefix] = canonical
    if not relative_module or any(not part.isidentifier() for part in relative_module.split(".")):
        raise ValueError("Invalid engine module")
    return importlib.import_module(f"{prefix}.{relative_module}")


def check_assets(roots: list[Path]) -> dict:
    import einops
    import scipy
    import torch
    import torchvision

    if torch.__version__ != "2.6.0+cu124" or torchvision.__version__ != "0.21.0+cu124":
        raise RuntimeError("Sequence assets require the validated torch/torchvision CUDA 12.4 versions")
    if einops.__version__ != "0.8.1" or scipy.__version__ != "1.17.1":
        raise RuntimeError("Sequence inference dependency versions do not match")
    for root in roots:
        bundle = read_bundle(root)
        modules = (
            ["model.sttn"]
            if bundle["engine"] == "sttn"
            else ["RAFT", "model.recurrent_flow_completion", "model.propainter"]
        )
        for module in modules:
            load_vendor_module(root, module)
        for asset in bundle["files"]:
            if asset["role"] == "weight":
                with owned_path(root, asset["path"]).open("rb") as handle:
                    checkpoint = torch.load(handle, map_location="cpu", weights_only=True)
                state = checkpoint.get("netG") if bundle["engine"] == "sttn" else checkpoint
                if (
                    not isinstance(state, dict)
                    or not state
                    or not all(isinstance(value, torch.Tensor) for value in state.values())
                ):
                    raise ValueError("Engine checkpoint does not contain a tensor state dictionary")
                del checkpoint, state
    available = torch.cuda.is_available()
    if available:
        from torchvision.ops import deform_conv2d

        result = deform_conv2d(
            torch.ones(1, 1, 4, 4, device="cuda"),
            torch.zeros(1, 18, 2, 2, device="cuda"),
            torch.ones(1, 1, 3, 3, device="cuda"),
        )
        torch.cuda.synchronize()
        if not torch.isfinite(result).all():
            raise RuntimeError("CUDA deformable convolution check failed")
    return {"available": True, "cudaAvailable": available, "assetSchemaVersion": ASSET_SCHEMA_VERSION}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sttn-root", type=Path, required=True)
    parser.add_argument("--propainter-root", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(check_assets([args.sttn_root, args.propainter_root])))
