"""Sequence asset and namespace contracts. All data is synthetic, no models or GPU."""

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
