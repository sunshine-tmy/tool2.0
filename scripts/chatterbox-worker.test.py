# 中文模块说明：测试 scripts/chatterbox-worker.test.py 中的稳定行为、边界条件和回归场景
"""Worker contract tests; uses a silent fake model, never downloads weights."""

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import torch
from pydantic import ValidationError

spec = importlib.util.spec_from_file_location("chatterbox_worker", Path(__file__).with_name("chatterbox-worker.py"))
worker = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = worker
spec.loader.exec_module(worker)


class LanguageTests(unittest.TestCase):
    def test_brazilian_portuguese_reaches_model_as_pt(self):
        from chatterbox.mtl_tts import SUPPORTED_LANGUAGES

        self.assertIn("pt", SUPPORTED_LANGUAGES)
        with tempfile.TemporaryDirectory(prefix="chatterbox-language-") as directory:
            root = Path(directory).resolve()
            reference = root / "reference.wav"
            reference.touch()
            for language, model_language in [("pt-BR", "pt"), ("ms", "ms"), ("en", "en")]:
                with self.subTest(language=language), patch.object(worker, "STORAGE_ROOT", root):
                    model = Mock(sr=24000)
                    model.generate.return_value = torch.zeros((1, 2400))
                    manager = worker.ModelManager()
                    manager.model = model
                    manager.device = "cpu"
                    payload = worker.GenerateRequest(
                        text="Olá! Confira nossas promoções.",
                        language=language,
                        reference_path=str(reference),
                        output_path=str(root / f"{language}.wav"),
                    )
                    result = manager.generate(payload)
                    self.assertEqual(result["chunks"], 2)
                    self.assertTrue((root / f"{language}.wav").is_file())
                    for call in model.generate.call_args_list:
                        self.assertEqual(call.kwargs["language_id"], model_language)
                    self.assertEqual(result["segments"][1]["text"], "Confira nossas promoções.")

    def test_unsupported_locale_is_rejected(self):
        with self.assertRaises(ValidationError):
            worker.GenerateRequest(text="Hello", language="xx", reference_path="unused", output_path="unused")


class MetaTensorRecoveryTests(unittest.TestCase):
    def test_restores_non_registered_runtime_tensors_created_on_meta_device(self):
        """上游 S3Gen 把位置编码作为普通属性保存。

        它们不会出现在 state_dict 或 named_buffers 中，因此要在 meta 加载后单独恢复，否则首次生成才会报
        "Cannot copy out of meta tensor"。
        """

        class RuntimeTensorOwner(torch.nn.Module):
            def __init__(self):
                super().__init__()
                with torch.device("meta"):
                    self.freqs_cis = torch.empty((2048, 64), dtype=torch.complex64)
                    self.pe = torch.empty((1, 9, 4), dtype=torch.float32)

        class FakeS3Gen(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.tokenizer = RuntimeTensorOwner()

        model = FakeS3Gen()
        self.assertEqual(
            worker.plain_meta_tensor_names(model),
            ["tokenizer.freqs_cis", "tokenizer.pe"],
        )

        worker.restore_s3gen_runtime_tensors(model, "cpu")

        self.assertEqual(worker.plain_meta_tensor_names(model), [])
        self.assertEqual(tuple(model.tokenizer.freqs_cis.shape), (2048, 64))
        self.assertEqual(tuple(model.tokenizer.pe.shape), (1, 9, 4))
        self.assertEqual(model.tokenizer.freqs_cis.device.type, "cpu")
        self.assertEqual(model.tokenizer.pe.device.type, "cpu")


class DesktopModelLoadingTests(unittest.TestCase):
    def test_managed_desktop_loads_only_the_installed_local_model(self):
        with tempfile.TemporaryDirectory(prefix="chatterbox-model-") as directory:
            root = Path(directory)
            for name in [
                "ve.pt",
                "t3_mtl23ls_v3.safetensors",
                "s3gen.pt",
                "grapheme_mtl_merged_expanded_v1.json",
            ]:
                (root / name).touch()
            upstream = Mock()
            upstream.ChatterboxMultilingualTTS.from_local.return_value = "local-model"
            with (
                patch.object(worker, "DESKTOP_MANAGED", True),
                patch.object(worker, "MODELS_ROOT", root),
                patch.dict(sys.modules, {"chatterbox.mtl_tts": upstream}),
            ):
                self.assertEqual(worker.load_multilingual_model("cpu"), "local-model")

            upstream.ChatterboxMultilingualTTS.from_local.assert_called_once_with(root, device="cpu", t3_model="v3")
            upstream.ChatterboxMultilingualTTS.from_pretrained.assert_not_called()

    def test_managed_desktop_reports_missing_model_files_without_network_fallback(self):
        upstream = Mock()
        with (
            tempfile.TemporaryDirectory(prefix="chatterbox-model-") as directory,
            patch.object(worker, "DESKTOP_MANAGED", True),
            patch.object(worker, "MODELS_ROOT", Path(directory)),
            patch.dict(sys.modules, {"chatterbox.mtl_tts": upstream}),
        ):
            with self.assertRaisesRegex(FileNotFoundError, "能力包模型文件缺失"):
                worker.load_multilingual_model("cpu")
        upstream.ChatterboxMultilingualTTS.from_pretrained.assert_not_called()


if __name__ == "__main__":
    unittest.main()
