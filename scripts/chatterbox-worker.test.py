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


if __name__ == "__main__":
    unittest.main()
