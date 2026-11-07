"""Lightweight contracts for the opt-in S01 probe; no GPU, models or third-party imports."""

import hashlib
import importlib.util
import json
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ENTRY = Path(__file__).with_name("validate-video-ai-sequence.py")
SPEC = importlib.util.spec_from_file_location("sequence_validation", ENTRY)
assert SPEC and SPEC.loader
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class ValidationContractTests(unittest.TestCase):
    def test_traversal_absolute_paths_and_link_escape_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "isolated"
            root.mkdir()
            outside = root.parent / "preserve.bin"
            outside.write_bytes(b"original")
            for relative in ("../preserve.bin", str(outside.resolve())):
                with self.subTest(relative=relative), self.assertRaises(ValueError):
                    probe.owned_file(root, relative)
            resolve = Path.resolve

            def escape_only_asset(candidate, *args, **kwargs):
                return outside if candidate == root / "escape.bin" else resolve(candidate, *args, **kwargs)

            with patch.object(Path, "resolve", escape_only_asset):
                with self.assertRaises(ValueError):
                    probe.owned_file(root, "escape.bin")
            self.assertEqual(outside.read_bytes(), b"original")

    def test_missing_assets_fail_before_importing_model_code(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(FileNotFoundError):
                probe.owned_file(Path(directory), "absent.pth")

    def test_digest_size_and_source_tampering_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in ("upstream/sttn/engine.py", "weights/sttn/test.pth"):
                file = root / relative
                file.parent.mkdir(parents=True)
                file.write_bytes(b"fixture")
            digest = hashlib.sha256(b"fixture").hexdigest()
            weight = {"name": "test.pth", "sha256": digest, "bytes": 7}
            entry = {
                "files": [{"path": "engine.py", "sha256": digest}],
                "weights": [weight],
            }
            manifest = {"schemaVersion": 1, "engines": {"sttn": entry}}
            self.assertIs(probe.verify_assets(root, "sttn", manifest), entry)
            weight["bytes"] = 8
            with self.assertRaisesRegex(ValueError, "digest/size"):
                probe.verify_assets(root, "sttn", manifest)
            weight["bytes"] = 7
            (root / "upstream/sttn/engine.py").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "digest/size"):
                probe.verify_assets(root, "sttn", manifest)
            manifest["schemaVersion"] = 99
            with self.assertRaisesRegex(ValueError, "Unsupported"):
                probe.verify_assets(root, "sttn", manifest)

    def test_network_guard_blocks_external_connections_and_preserves_internal_socketpair(self):
        with (
            patch.object(socket, "socket"),
            patch.object(socket, "socketpair"),
            patch.object(socket, "create_connection"),
        ):
            # Run in a child so patched networking can never leak into other tests.
            code = f"""import runpy, socket
probe = runpy.run_path({str(ENTRY)!r})
probe["deny_network"]()
for operation in [lambda: socket.socket().connect(("203.0.113.1",9)),
                  lambda: socket.socket().connect_ex(("203.0.113.1",9)),
                  lambda: socket.create_connection(("203.0.113.1",9))]:
    try:
        operation()
    except RuntimeError as error:
        assert "Network is disabled" in str(error)
    else:
        raise AssertionError("Network was allowed")
left, right = socket.socketpair()
try:
    left.sendall(b"local")
    assert right.recv(5) == b"local"
finally:
    left.close(); right.close()
"""
            subprocess.run([sys.executable, "-I", "-B", "-c", code], check=True, timeout=20)

    def test_reports_never_overwrite_existing_evidence_or_escape_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            saved = root / "keep.json"
            saved.write_text("preserve", encoding="utf-8")
            common = [sys.executable, "-I", "-B", str(ENTRY), "--root", str(root), "--engine", "sttn"]
            for report in ("keep.json", "../escape.json", str(root / "absolute.json")):
                result = subprocess.run([*common, "--report", report], capture_output=True, timeout=20)
                self.assertNotEqual(result.returncode, 0)
            self.assertEqual(saved.read_text(encoding="utf-8"), "preserve")
            missing = subprocess.run([*common, "--report", "missing.json"], capture_output=True, timeout=20)
            self.assertEqual(missing.returncode, 1)
            report = json.loads((root / "missing.json").read_text(encoding="utf-8"))
            self.assertFalse(report["success"])
            self.assertEqual(report["type"], "FileNotFoundError")

    def test_manifest_pins_only_inference_closure_and_required_weights(self):
        manifest = json.loads(probe.MANIFEST.read_text(encoding="utf-8"))
        expected = {
            "sttn": {"sttn.pth"},
            "propainter": {"ProPainter.pth", "raft-things.pth", "recurrent_flow_completion.pth"},
        }
        for engine, entry in manifest["engines"].items():
            self.assertEqual(len(entry["revision"]), 40)
            self.assertEqual({asset["name"] for asset in entry["weights"]}, expected[engine])
            self.assertIn("LICENSE", [file["path"] for file in entry["files"]])
            for file in entry["files"]:
                self.assertNotIn(file["path"], ["train.py", "inference_propainter.py", "test.py"])
                self.assertRegex(file["gitBlobSha1"], r"^[0-9a-f]{40}$")
                self.assertRegex(file["sha256"], r"^[0-9a-f]{64}$")
            for weight in entry["weights"]:
                self.assertTrue(weight["url"].startswith("https://"))
                self.assertRegex(weight["sha256"], r"^[0-9a-f]{64}$")
                self.assertGreater(weight["bytes"], 0)


if __name__ == "__main__":
    unittest.main()
