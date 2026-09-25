# 中文模块说明：测试 scripts/image_ai_worker_test.py 中的稳定行为、边界条件和回归场景
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
from PIL import Image

WORKER_PATH = Path(__file__).with_name("image-ai-worker.py")
SPEC = importlib.util.spec_from_file_location("image_ai_worker", WORKER_PATH)
assert SPEC and SPEC.loader
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class TrustedPathTests(unittest.TestCase):
    def test_accepts_root_and_backend_image_ai_storage(self):
        for storage_root in worker.TRUSTED_STORAGE_ROOTS:
            storage_root.mkdir(parents=True, exist_ok=True)
            candidate = storage_root / "inputs" / "task" / "input.bin"
            candidate.parent.mkdir(parents=True, exist_ok=True)
            candidate.write_bytes(b"image")
            self.assertEqual(worker.trusted_path(str(candidate), must_exist=True), candidate.resolve())
            candidate.unlink()

    def test_rejects_paths_outside_project_image_ai_storage(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            candidate = Path(temp_dir) / "input.bin"
            candidate.write_bytes(b"image")
            with self.assertRaises(worker.WorkerFailure) as raised:
                worker.trusted_path(str(candidate), must_exist=True)
            self.assertEqual(raised.exception.code, "UNTRUSTED_PATH")


class DesktopInstallCheckTests(unittest.TestCase):
    def test_check_reports_missing_packaged_models_without_starting_the_worker(self):
        with tempfile.TemporaryDirectory(prefix="image-ai-check-") as directory:
            root = Path(directory)
            environment = {
                "U2NET_HOME": str(root / "rembg"),
                "IMAGE_AI_OCR_DETECTION_MODEL_DIR": str(root / "ocr" / "detection"),
                "IMAGE_AI_OCR_RECOGNITION_MODEL_DIR": str(root / "ocr" / "recognition"),
            }
            with (
                patch.object(worker, "MODELS_ROOT", root / "models"),
                patch.object(worker.importlib.util, "find_spec", return_value=object()),
                patch.dict(os.environ, environment, clear=False),
                patch.object(sys, "argv", [str(WORKER_PATH), "--check"]),
                self.assertRaises(SystemExit) as raised,
            ):
                worker.main()

            self.assertIn("missingModels", str(raised.exception))
            self.assertIn("big-lama.pt", str(raised.exception))


@unittest.skipUnless(os.name == "nt", "Paddle's native Unicode-path workaround is Windows-only")
class OcrModelPathAliasTests(unittest.TestCase):
    def test_uses_a_temporary_ascii_junction_for_unicode_model_paths(self):
        with tempfile.TemporaryDirectory(prefix="image-ai-ocr-") as directory:
            target = Path(directory) / "中文模型"
            target.mkdir()
            (target / "inference.yml").write_text("model: test\n", encoding="utf-8")

            with (
                patch.object(worker, "_OCR_ALIAS_ROOT", None),
                patch.object(worker, "_OCR_ALIAS_PATHS", []),
            ):
                try:
                    alias = worker._ocr_model_path(target, "detection")
                    self.assertTrue(str(alias).isascii())
                    self.assertEqual(alias.resolve(), target.resolve())
                    self.assertEqual((alias / "inference.yml").read_text(encoding="utf-8"), "model: test\n")
                finally:
                    worker._cleanup_ocr_aliases()


class RealEsrganInputTests(unittest.TestCase):
    def test_pinned_realesrgan_runtime_imports_with_torchvision_compatibility(self):
        worker.install_basicsr_torchvision_compat()
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer

        self.assertIsNotNone(RRDBNet)
        self.assertIsNotNone(RealESRGANer)

    def test_decodes_verified_image_bytes_saved_with_bin_extension(self):
        class FakeUpsampler:
            def enhance(self, image, outscale):
                output = cv2.resize(image, None, fx=outscale, fy=outscale, interpolation=cv2.INTER_CUBIC)
                return output, None

        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "input.bin"
            output_path = Path(temp_dir) / "中文结果" / "增强.png"
            output_path.parent.mkdir(parents=True)
            source = np.full((12, 10, 3), (20, 80, 160), dtype=np.uint8)
            success, encoded = cv2.imencode(".png", source)
            self.assertTrue(success)
            encoded.tofile(input_path)

            with patch.object(worker.manager, "get_realesrgan", return_value=FakeUpsampler()):
                result = worker.run_realesrgan(input_path, output_path, 2)

            self.assertEqual(result["provider"], "real-esrgan")
            with Image.open(output_path) as output:
                self.assertEqual(output.size, (20, 24))


class LamaModelLoadingTests(unittest.TestCase):
    def test_loads_torchscript_through_unicode_safe_binary_stream(self):
        local_manager = worker.ModelManager()
        fake_torchscript = MagicMock()
        with patch("torch.jit.load", return_value=fake_torchscript) as load:
            model = local_manager.get_lama()

        load_argument = load.call_args.args[0]
        self.assertTrue(hasattr(load_argument, "read"))
        self.assertFalse(isinstance(load_argument, (str, Path)))
        self.assertIs(model.model, fake_torchscript)
        fake_torchscript.eval.assert_called_once()

    def test_removes_lama_padding_and_preserves_source_dimensions(self):
        class FakeLama:
            def __call__(self, _image, _mask):
                return Image.new("RGB", (16, 16), "green")

        with tempfile.TemporaryDirectory() as temp_dir:
            input_path = Path(temp_dir) / "input.bin"
            mask_path = Path(temp_dir) / "mask.png"
            output_path = Path(temp_dir) / "中文结果" / "去水印.png"
            output_path.parent.mkdir(parents=True)
            Image.new("RGB", (10, 12), "blue").save(input_path, format="PNG")
            Image.new("L", (10, 12), "white").save(mask_path, format="PNG")

            with patch.object(worker.manager, "get_lama", return_value=FakeLama()):
                result = worker.run_lama(input_path, mask_path, output_path)

            self.assertEqual(result["provider"], "lama")
            with Image.open(output_path) as output:
                self.assertEqual(output.size, (10, 12))


if __name__ == "__main__":
    unittest.main()
