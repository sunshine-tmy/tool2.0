# 中文模块说明：测试 scripts/test_edge_tts_generate.py 中的稳定行为、边界条件和回归场景
import importlib.util
import io
import json
import pathlib
import sys
import unittest
from contextlib import redirect_stdout
from types import ModuleType

SCRIPT_PATH = pathlib.Path(__file__).with_name("edge-tts-generate.py")
sys.modules.setdefault("edge_tts", ModuleType("edge_tts"))
spec = importlib.util.spec_from_file_location("edge_tts_generate", SCRIPT_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load Edge-TTS adapter from {SCRIPT_PATH}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EdgeTtsProtocolTest(unittest.TestCase):
    def test_request_requires_matching_protocol_version(self):
        request = {
            "protocolVersion": 1,
            "text": "Hello",
            "language": "en-US",
            "voice": "en-US-TestNeural",
            "rate": 0,
            "volume": 0,
            "pitch": 0,
        }
        self.assertEqual(module.validate_request(request)["text"], "Hello")
        request["protocolVersion"] = 2
        with self.assertRaisesRegex(ValueError, "protocol version mismatch"):
            module.validate_request(request)

    def test_every_json_response_declares_protocol_version(self):
        output = io.StringIO()
        with redirect_stdout(output):
            module.emit({"available": True})
        self.assertEqual(json.loads(output.getvalue()), {"protocolVersion": 1, "available": True})


if __name__ == "__main__":
    unittest.main()
