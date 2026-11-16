"""Sequence asset and namespace contracts. All data is synthetic, no models or GPU."""

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("engine_assets", Path(__file__).with_name("video_ai_engine_assets.py"))
assert SPEC and SPEC.loader
assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assets)


def bundle(root: Path, engine="sttn"):
    values = {
        "LICENSE": (b"test license", "license"),
        "PROVENANCE.json": (b"{}", "provenance"),
        "vendor/__init__.py": (b"", "source"),
        "vendor/model/__init__.py": (b"", "source"),
        "vendor/core/__init__.py": (b"VALUE = '" + engine.encode() + b"'", "source"),
        "vendor/model/net.py": (b"from ..core import VALUE\n", "source"),
    }
    names = ["sttn.pth"] if engine == "sttn" else ["ProPainter.pth", "raft-things.pth", "recurrent_flow_completion.pth"]
    for name in names:
        values[f"weights/{name}"] = (b"synthetic weight", "weight")
    root.mkdir()
    files = []
    for relative, (contents, role) in values.items():
        file = root / relative
        file.parent.mkdir(exist_ok=True, parents=True)
        file.write_bytes(contents)
        files.append(
            {"path": relative, "role": role, "bytes": len(contents), "sha256": hashlib.sha256(contents).hexdigest()}
        )
    manifest = {
        "assetSchemaVersion": 1,
        "engine": engine,
        "namespace": f"toolbox_video_ai_vendor.{engine}",
        "files": files,
    }
    write_manifest(root, manifest)
    return manifest


def write_manifest(root, manifest):
    (root / "sequence-bundle.json").write_text(json.dumps(manifest), encoding="utf-8")


def mac_bundle(package_root: Path):
    repository = "https://github.com/researchmm/STTN"
    revision = "f39f62c5bbbe3e3eba084c487353a2c651bfdcde"
    engine_root = package_root / "models/video-ai/engines/sttn"
    engine_root.mkdir(parents=True)
    source_path = "model/sttn.py"
    source_bytes = b"class Model: pass\n"
    license_bytes = b"MIT fixture license\n"
    weight_bytes = b"synthetic STTN weight"
    source_sha = "a" * 64
    blob_sha = "b" * 40
    entries = [
        {"path": "LICENSE", "sha256": hashlib.sha256(license_bytes).hexdigest(), "gitBlobSha1": "c" * 40},
        {"path": source_path, "sha256": source_sha, "gitBlobSha1": blob_sha},
    ]
    weights = [
        {
            "path": "weights/sttn.pth",
            "bytes": len(weight_bytes),
            "sha256": hashlib.sha256(weight_bytes).hexdigest(),
        }
    ]
    values = {
        "LICENSE": (license_bytes, "license"),
        "vendor/__init__.py": (b"", "source"),
        "vendor/model/__init__.py": (b"", "source"),
        "vendor/model/sttn.py": (source_bytes, "source"),
        "weights/sttn.pth": (weight_bytes, "weight"),
    }
    provenance = {
        "repository": repository,
        "revision": revision,
        "license": "MIT",
        "sources": [
            {
                "path": source_path,
                "gitBlobSha1": blob_sha,
                "originalSha256": source_sha,
                "bundledSha256": hashlib.sha256(source_bytes).hexdigest(),
            }
        ],
        "weights": [
            {
                "name": "sttn.pth",
                "bytes": len(weight_bytes),
                "sha256": hashlib.sha256(weight_bytes).hexdigest(),
            }
        ],
    }
    values["PROVENANCE.json"] = (json.dumps(provenance).encode(), "provenance")
    files = []
    for relative, (contents, role) in values.items():
        file = engine_root / relative
        file.parent.mkdir(exist_ok=True, parents=True)
        file.write_bytes(contents)
        files.append(
            {
                "path": relative,
                "role": role,
                "bytes": len(contents),
                "sha256": hashlib.sha256(contents).hexdigest(),
            }
        )
    descriptor = {
        "assetSchemaVersion": 1,
        "engine": "sttn",
        "namespace": "toolbox_video_ai_vendor.sttn",
        "repository": repository,
        "revision": revision,
        "license": "MIT",
        "adapterReady": True,
        "files": files,
    }
    write_manifest(engine_root, descriptor)
    support = {
        "assetSchemaVersion": 1,
        "workerFeature": "sequence-assets-v1",
        "sequenceRuntime": 1,
        "platform": "darwin-arm64",
        "torchVersion": "2.6.0",
        "torchvisionVersion": "0.21.0",
        "engines": {
            "sttn": {
                "repository": repository,
                "revision": revision,
                "license": "MIT",
                "namespace": "toolbox_video_ai_vendor.sttn",
                "adapterReady": True,
                "supportedDevices": ["mps"],
                "executionMode": "mps",
                "sources": entries,
                "weights": weights,
            }
        },
    }
    support_path = package_root / assets.MACOS_SEQUENCE_SUPPORT_PATH
    support_path.parent.mkdir(parents=True)
    support_path.write_text(json.dumps(support), encoding="utf-8")
    support_sha = hashlib.sha256(support_path.read_bytes()).hexdigest()
    return engine_root, support_path, support_sha, support["engines"]["sttn"]


class EngineAssetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        for name in list(sys.modules):
            if name == "toolbox_video_ai_vendor" or name.startswith("toolbox_video_ai_vendor."):
                del sys.modules[name]
        sys.meta_path[:] = [finder for finder in sys.meta_path if not isinstance(finder, assets._BundleFinder)]
        assets._roots.clear()
        self.temp.cleanup()

    def test_two_engines_can_import_together_without_polluting_global_model_or_core(self):
        previous = {name: sys.modules.get(name) for name in ("model", "core", "RAFT")}
        for name in ("sttn", "propainter"):
            root = self.root / name
            bundle(root, name)
            self.assertEqual(assets.load_vendor_module(root, "model.net").VALUE, name)
            self.assertEqual(list(root.rglob("__pycache__")), [])
        for name, module in previous.items():
            self.assertIs(sys.modules.get(name), module)

    def test_tampered_source_missing_weights_unlisted_code_and_case_duplicates_are_rejected(self):
        for kind in ("tampered", "missing", "unlisted", "duplicate", "license", "schema"):
            root = self.root / kind
            manifest = bundle(root)
            if kind == "tampered":
                (root / "vendor/model/net.py").write_bytes(b"changed")
            elif kind == "missing":
                (root / "weights/sttn.pth").unlink()
            elif kind == "unlisted":
                (root / "train.py").write_bytes(b"print('must not execute')")
            elif kind == "duplicate":
                manifest["files"].append({**manifest["files"][0], "path": "license"})
            elif kind == "license":
                manifest["files"] = [file for file in manifest["files"] if file["path"] != "LICENSE"]
            else:
                manifest["assetSchemaVersion"] = 99
            write_manifest(root, manifest)
            with self.subTest(kind=kind), self.assertRaises((ValueError, FileNotFoundError)):
                assets.load_vendor_module(root, "model.net")

    def test_cannot_import_undeclared_module_or_mix_generations(self):
        root = self.root / "first"
        bundle(root)
        assets.load_vendor_module(root, "model.net")
        with self.assertRaises(ModuleNotFoundError):
            assets.load_vendor_module(root, "train")
        other = self.root / "second"
        bundle(other)
        with self.assertRaisesRegex(RuntimeError, "restart"):
            assets.load_vendor_module(other, "model.net")

    def test_paths_cannot_escape_the_engine(self):
        root = self.root / "engine"
        bundle(root)
        for value in ("../outside.py", "C:/Windows/a.py", "/outside.py", "vendor\\model.py", "vendor/../LICENSE"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                assets.owned_path(root, value)

    def test_macos_device_definition_must_match_signed_bundle_and_runtime(self):
        package_root = self.root / "package"
        package_root.mkdir()
        engine_root, support_path, support_sha, definition = mac_bundle(package_root)
        bundle_value = json.loads((engine_root / "sequence-bundle.json").read_text(encoding="utf-8"))
        environment = {
            "VIDEO_AI_SEQUENCE_PACKAGE_ROOT": str(package_root),
            "VIDEO_AI_SEQUENCE_SUPPORT_PATH": str(support_path),
            "VIDEO_AI_SEQUENCE_SUPPORT_SHA256": support_sha,
        }
        with (
            patch.object(assets.sys, "platform", "darwin"),
            patch.object(assets.platform, "machine", return_value="arm64"),
            patch.dict(assets.os.environ, environment, clear=True),
            patch.dict(
                sys.modules,
                {"torch": SimpleNamespace(__version__="2.6.0"), "torchvision": SimpleNamespace(__version__="0.21.0")},
            ),
        ):
            self.assertEqual(assets.validate_macos_sequence_support(engine_root, bundle_value), definition)

            definition["weights"][0]["sha256"] = "f" * 64
            support_path.write_text(
                json.dumps(
                    {
                        "assetSchemaVersion": 1,
                        "workerFeature": "sequence-assets-v1",
                        "sequenceRuntime": 1,
                        "platform": "darwin-arm64",
                        "torchVersion": "2.6.0",
                        "torchvisionVersion": "0.21.0",
                        "engines": {"sttn": definition},
                    }
                ),
                encoding="utf-8",
            )
            assets.os.environ["VIDEO_AI_SEQUENCE_SUPPORT_SHA256"] = hashlib.sha256(
                support_path.read_bytes()
            ).hexdigest()
            with self.assertRaisesRegex(ValueError, "weight provenance"):
                assets.validate_macos_sequence_support(engine_root, bundle_value)

    def test_macos_support_path_cannot_escape_its_signed_generation(self):
        package_root = self.root / "package"
        package_root.mkdir()
        engine_root, support_path, support_sha, _ = mac_bundle(package_root)
        outside = self.root / "outside.json"
        outside.write_bytes(support_path.read_bytes())
        bundle_value = json.loads((engine_root / "sequence-bundle.json").read_text(encoding="utf-8"))
        with (
            patch.object(assets.sys, "platform", "darwin"),
            patch.object(assets.platform, "machine", return_value="arm64"),
            patch.dict(
                assets.os.environ,
                {
                    "VIDEO_AI_SEQUENCE_PACKAGE_ROOT": str(package_root),
                    "VIDEO_AI_SEQUENCE_SUPPORT_PATH": str(outside),
                    "VIDEO_AI_SEQUENCE_SUPPORT_SHA256": support_sha,
                },
                clear=True,
            ),
        ):
            with self.assertRaisesRegex(ValueError, "outside the signed video generation"):
                assets.validate_macos_sequence_support(engine_root, bundle_value)


if __name__ == "__main__":
    unittest.main()
