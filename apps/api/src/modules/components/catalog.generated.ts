/** 中文模块说明：由 scripts/assemble-component-catalog.mjs 生成；请勿手工编辑。 */
import type { ComponentCatalog } from "./component-manager";
// prettier-ignore
export const packagedComponentCatalog = {
  "manifests": [
    {
      "protocolVersion": 1,
      "id": "chatterbox",
      "moduleId": "chatterbox",
      "groupId": "audio",
      "displayName": "参考音色克隆（CPU）",
      "purpose": "使用本地 Chatterbox Multilingual V3 模型，将参考音色用于多语言语音生成；模型离线安装，生成可在本机完成。",
      "dependencyIds": [
        "ffmpeg",
        "python-312"
      ],
      "taskToolIds": [
        "chatterbox"
      ],
      "installConditions": [
        "首次安装需下载约 3.4 GB 能力归档，建议预留至少 10 GB 可用空间；安装后约占 5.8 GB，包含独立 Python 环境。",
        "建议至少 16 GB 内存；CPU 推理不要求 CUDA，但生成速度取决于处理器。",
        "固定 Chatterbox 源码提交、Python 哈希锁定依赖与模型均随包安装，生成时无需联网。"
      ],
      "version": "1.0.0-py312-cpu1",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-1.0.0-py312-cpu1.tar.gz",
        "bytes": 421067150,
        "sha256": "bef1382bad5b7c0df9a56b7a3ab685152b18401e2a8db32bde62e849cabe86f2",
        "format": "tar.gz",
        "filePaths": [
          "requirements.lock",
          "scripts/chatterbox-worker.py",
          "scripts/worker_lifecycle.py",
          "vendor/chatterbox_tts-0.1.7.dist-info/direct_url.json",
          "vendor/chatterbox_tts-0.1.7.dist-info/INSTALLER",
          "vendor/chatterbox_tts-0.1.7.dist-info/licenses/LICENSE",
          "vendor/chatterbox_tts-0.1.7.dist-info/METADATA",
          "vendor/chatterbox_tts-0.1.7.dist-info/RECORD",
          "vendor/chatterbox_tts-0.1.7.dist-info/REQUESTED",
          "vendor/chatterbox_tts-0.1.7.dist-info/top_level.txt",
          "vendor/chatterbox_tts-0.1.7.dist-info/WHEEL",
          "vendor/chatterbox/__init__.py",
          "vendor/chatterbox/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/__pycache__/mtl_tts.cpython-312.pyc",
          "vendor/chatterbox/__pycache__/tts.cpython-312.pyc",
          "vendor/chatterbox/__pycache__/vc.cpython-312.pyc",
          "vendor/chatterbox/models/__init__.py",
          "vendor/chatterbox/models/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/__pycache__/utils.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__init__.py",
          "vendor/chatterbox/models/s3gen/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/configs.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/const.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/decoder.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/f0_predictor.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/flow_matching.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/flow.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/hifigan.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/s3gen.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/__pycache__/xvector.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/configs.py",
          "vendor/chatterbox/models/s3gen/const.py",
          "vendor/chatterbox/models/s3gen/decoder.py",
          "vendor/chatterbox/models/s3gen/f0_predictor.py",
          "vendor/chatterbox/models/s3gen/flow_matching.py",
          "vendor/chatterbox/models/s3gen/flow.py",
          "vendor/chatterbox/models/s3gen/hifigan.py",
          "vendor/chatterbox/models/s3gen/matcha/__pycache__/decoder.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/matcha/__pycache__/flow_matching.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/matcha/__pycache__/transformer.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/matcha/decoder.py",
          "vendor/chatterbox/models/s3gen/matcha/flow_matching.py",
          "vendor/chatterbox/models/s3gen/matcha/text_encoder.py",
          "vendor/chatterbox/models/s3gen/matcha/transformer.py",
          "vendor/chatterbox/models/s3gen/s3gen.py",
          "vendor/chatterbox/models/s3gen/transformer/__init__.py",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/activation.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/attention.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/convolution.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/embedding.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/encoder_layer.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/positionwise_feed_forward.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/subsampling.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/__pycache__/upsample_encoder.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/transformer/activation.py",
          "vendor/chatterbox/models/s3gen/transformer/attention.py",
          "vendor/chatterbox/models/s3gen/transformer/convolution.py",
          "vendor/chatterbox/models/s3gen/transformer/embedding.py",
          "vendor/chatterbox/models/s3gen/transformer/encoder_layer.py",
          "vendor/chatterbox/models/s3gen/transformer/positionwise_feed_forward.py",
          "vendor/chatterbox/models/s3gen/transformer/subsampling.py",
          "vendor/chatterbox/models/s3gen/transformer/upsample_encoder.py",
          "vendor/chatterbox/models/s3gen/utils/__pycache__/class_utils.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/utils/__pycache__/intmeanflow.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/utils/__pycache__/mask.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/utils/__pycache__/mel.cpython-312.pyc",
          "vendor/chatterbox/models/s3gen/utils/class_utils.py",
          "vendor/chatterbox/models/s3gen/utils/intmeanflow.py",
          "vendor/chatterbox/models/s3gen/utils/mask.py",
          "vendor/chatterbox/models/s3gen/utils/mel.py",
          "vendor/chatterbox/models/s3gen/xvector.py",
          "vendor/chatterbox/models/s3tokenizer/__init__.py",
          "vendor/chatterbox/models/s3tokenizer/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/s3tokenizer/__pycache__/s3tokenizer.cpython-312.pyc",
          "vendor/chatterbox/models/s3tokenizer/s3tokenizer.py",
          "vendor/chatterbox/models/t3/__init__.py",
          "vendor/chatterbox/models/t3/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/t3/__pycache__/llama_configs.cpython-312.pyc",
          "vendor/chatterbox/models/t3/__pycache__/t3.cpython-312.pyc",
          "vendor/chatterbox/models/t3/inference/__pycache__/t3_hf_backend.cpython-312.pyc",
          "vendor/chatterbox/models/t3/inference/t3_hf_backend.py",
          "vendor/chatterbox/models/t3/llama_configs.py",
          "vendor/chatterbox/models/t3/modules/__pycache__/cond_enc.cpython-312.pyc",
          "vendor/chatterbox/models/t3/modules/__pycache__/learned_pos_emb.cpython-312.pyc",
          "vendor/chatterbox/models/t3/modules/__pycache__/perceiver.cpython-312.pyc",
          "vendor/chatterbox/models/t3/modules/__pycache__/t3_config.cpython-312.pyc",
          "vendor/chatterbox/models/t3/modules/cond_enc.py",
          "vendor/chatterbox/models/t3/modules/learned_pos_emb.py",
          "vendor/chatterbox/models/t3/modules/perceiver.py",
          "vendor/chatterbox/models/t3/modules/t3_config.py",
          "vendor/chatterbox/models/t3/t3.py",
          "vendor/chatterbox/models/tokenizers/__init__.py",
          "vendor/chatterbox/models/tokenizers/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/tokenizers/__pycache__/tokenizer.cpython-312.pyc",
          "vendor/chatterbox/models/tokenizers/tokenizer.py",
          "vendor/chatterbox/models/utils.py",
          "vendor/chatterbox/models/voice_encoder/__init__.py",
          "vendor/chatterbox/models/voice_encoder/__pycache__/__init__.cpython-312.pyc",
          "vendor/chatterbox/models/voice_encoder/__pycache__/config.cpython-312.pyc",
          "vendor/chatterbox/models/voice_encoder/__pycache__/melspec.cpython-312.pyc",
          "vendor/chatterbox/models/voice_encoder/__pycache__/voice_encoder.cpython-312.pyc",
          "vendor/chatterbox/models/voice_encoder/config.py",
          "vendor/chatterbox/models/voice_encoder/melspec.py",
          "vendor/chatterbox/models/voice_encoder/voice_encoder.py",
          "vendor/chatterbox/mtl_tts.py",
          "vendor/chatterbox/tts_turbo.py",
          "vendor/chatterbox/tts.py",
          "vendor/chatterbox/vc.py",
          "wheelhouse/annotated_doc-0.0.5-py3-none-any.whl",
          "wheelhouse/annotated_types-0.8.0-py3-none-any.whl",
          "wheelhouse/antlr4-python3-runtime-4.9.3.tar.gz",
          "wheelhouse/anyio-4.15.1-py3-none-any.whl",
          "wheelhouse/audioread-3.1.0-py3-none-any.whl",
          "wheelhouse/catalogue-2.0.10-py3-none-any.whl",
          "wheelhouse/certifi-2026.7.22-py3-none-any.whl",
          "wheelhouse/cffi-2.1.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/cfgv-3.5.0-py2.py3-none-any.whl",
          "wheelhouse/charset_normalizer-3.5.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/click-8.5.0-py3-none-any.whl",
          "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "wheelhouse/colorama-0.4.6-py2.py3-none-any.whl",
          "wheelhouse/conformer-0.3.2-py3-none-any.whl",
          "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "wheelhouse/deprecated-1.3.1-py2.py3-none-any.whl",
          "wheelhouse/diffusers-0.38.0-py3-none-any.whl",
          "wheelhouse/distlib-0.4.3-py2.py3-none-any.whl",
          "wheelhouse/einops-0.8.2-py3-none-any.whl",
          "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "wheelhouse/filelock-3.32.6-py3-none-any.whl",
          "wheelhouse/fsspec-2026.7.0-py3-none-any.whl",
          "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "wheelhouse/hf_xet-1.6.0-cp38-abi3-win_amd64.whl",
          "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "wheelhouse/huggingface_hub-1.31.0-py3-none-any.whl",
          "wheelhouse/identify-2.6.19-py2.py3-none-any.whl",
          "wheelhouse/idna-3.19-py3-none-any.whl",
          "wheelhouse/importlib_metadata-9.0.1-py3-none-any.whl",
          "wheelhouse/jaconv-0.5.0-py3-none-any.whl",
          "wheelhouse/jinja2-3.1.6-py3-none-any.whl",
          "wheelhouse/joblib-1.6.0-py3-none-any.whl",
          "wheelhouse/lazy_loader-0.5-py3-none-any.whl",
          "wheelhouse/librosa-0.11.0-py3-none-any.whl",
          "wheelhouse/llvmlite-0.49.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "wheelhouse/markupsafe-3.0.3-cp312-cp312-win_amd64.whl",
          "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "wheelhouse/ml_dtypes-0.5.4-cp312-cp312-win_amd64.whl",
          "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "wheelhouse/msgpack-1.2.2-cp312-cp312-win_amd64.whl",
          "wheelhouse/narwhals-2.26.0-py3-none-any.whl",
          "wheelhouse/networkx-3.6.1-py3-none-any.whl",
          "wheelhouse/nodeenv-1.10.0-py2.py3-none-any.whl",
          "wheelhouse/numba-0.67.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/numpy-1.26.4-cp312-cp312-win_amd64.whl",
          "wheelhouse/omegaconf-2.3.1-py3-none-any.whl",
          "wheelhouse/onnx-1.22.0-cp312-abi3-win_amd64.whl",
          "wheelhouse/packaging-26.3-py3-none-any.whl",
          "wheelhouse/pillow-12.3.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/platformdirs-4.11.8-py3-none-any.whl",
          "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "wheelhouse/pre_commit-4.6.2-py2.py3-none-any.whl",
          "wheelhouse/protobuf-7.36.1-cp310-abi3-win_amd64.whl",
          "wheelhouse/pycparser-3.0-py3-none-any.whl",
          "wheelhouse/pydantic_core-2.46.5-cp312-cp312-win_amd64.whl",
          "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "wheelhouse/pygments-2.21.0-py3-none-any.whl",
          "wheelhouse/pykakasi-2.3.0-py3-none-any.whl",
          "wheelhouse/pyloudnorm-0.2.0-py3-none-any.whl",
          "wheelhouse/python_discovery-1.6.0-py3-none-any.whl",
          "wheelhouse/pyyaml-6.0.3-cp312-cp312-win_amd64.whl",
          "wheelhouse/regex-2026.9.10-cp312-cp312-win_amd64.whl",
          "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "wheelhouse/resemble_perth-1.0.1-py3-none-any.whl",
          "wheelhouse/rich-15.0.0-py3-none-any.whl",
          "wheelhouse/s3tokenizer-0.3.0-py3-none-any.whl",
          "wheelhouse/safetensors-0.8.0-cp310-abi3-win_amd64.whl",
          "wheelhouse/scikit_learn-1.9.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/scipy-1.17.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "wheelhouse/soundfile-0.14.0-py2.py3-none-win_amd64.whl",
          "wheelhouse/soxr-1.1.0-cp312-abi3-win_amd64.whl",
          "wheelhouse/spacy_pkuseg-1.0.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/srsly-2.5.3-cp312-cp312-win_amd64.whl",
          "wheelhouse/starlette-1.6.0-py3-none-any.whl",
          "wheelhouse/sympy-1.13.1-py3-none-any.whl",
          "wheelhouse/threadpoolctl-3.6.0-py3-none-any.whl",
          "wheelhouse/tokenizers-0.23.2-cp310-abi3-win_amd64.whl",
          "wheelhouse/torch-2.6.0+cpu-cp312-cp312-win_amd64.whl",
          "wheelhouse/torchaudio-2.6.0+cpu-cp312-cp312-win_amd64.whl",
          "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "wheelhouse/transformers-5.17.0-py3-none-any.whl",
          "wheelhouse/typer-0.27.2-py3-none-any.whl",
          "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "wheelhouse/typing_inspection-0.4.4-py3-none-any.whl",
          "wheelhouse/urllib3-2.7.0-py3-none-any.whl",
          "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "wheelhouse/virtualenv-21.7.9-py3-none-any.whl",
          "wheelhouse/wrapt-2.4.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/zipp-4.1.0-py3-none-any.whl"
        ]
      },
      "additionalArchives": [
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-1.0.0-py312-cpu1-model-t3.tar.gz",
          "bytes": 1980678922,
          "sha256": "54f58d9feeed3a286c537c5c66e8b65bf6d9dc1f7d131b12654bcb58515fd682",
          "format": "tar.gz",
          "filePaths": [
            "models/chatterbox/t3_mtl23ls_v3.safetensors"
          ]
        },
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-1.0.0-py312-cpu1-model-s3gen.tar.gz",
          "bytes": 984526575,
          "sha256": "89537f803a54c904e0c2dc7fa697a9dca6d666c6d20e60c57527711a0a0d46e8",
          "format": "tar.gz",
          "filePaths": [
            "models/chatterbox/s3gen.pt",
            "models/chatterbox/ve.pt",
            "models/chatterbox/grapheme_mtl_merged_expanded_v1.json"
          ]
        }
      ],
      "installedBytes": 6000000000,
      "files": [
        {
          "path": "models/chatterbox/grapheme_mtl_merged_expanded_v1.json",
          "bytes": 69989,
          "sha256": "69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf"
        },
        {
          "path": "models/chatterbox/s3gen.pt",
          "bytes": 1057165844,
          "sha256": "9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3"
        },
        {
          "path": "models/chatterbox/t3_mtl23ls_v3.safetensors",
          "bytes": 2143989928,
          "sha256": "5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953"
        },
        {
          "path": "models/chatterbox/ve.pt",
          "bytes": 5698626,
          "sha256": "4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1"
        },
        {
          "path": "requirements.lock",
          "bytes": 142407,
          "sha256": "44744875994b000e549435a90a98f83f8f5f0e04bf8416dec84f0adfdcaa989d"
        },
        {
          "path": "scripts/chatterbox-worker.py",
          "bytes": 26755,
          "sha256": "5bf37caa877026fe9dbc951dc3365533ca40501ec750c3b92c04e96cfc559eba"
        },
        {
          "path": "scripts/worker_lifecycle.py",
          "bytes": 1130,
          "sha256": "bbde9d83156f78b6cf669e98ba3641b7786241e696df8598725133cf9c48a645"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/direct_url.json",
          "bytes": 207,
          "sha256": "b0e1f920f6322772ee7781de88993f7911ae9fbddae4a3032e380c35643a3acc"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/INSTALLER",
          "bytes": 4,
          "sha256": "ceebae7b8927a3227e5303cf5e0f1f7b34bb542ad7250ac03fbcde36ec2f1508"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/licenses/LICENSE",
          "bytes": 1087,
          "sha256": "7d6744b52e52960d42c69b29b55b4b9e0b4656cf52569ab710093f7707f7a067"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/METADATA",
          "bytes": 16464,
          "sha256": "082f4387c26d373b34a941e8ccd967d4eb69e367392e0b19d595ed7734dd87c3"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/RECORD",
          "bytes": 8980,
          "sha256": "c6aee6bbdc372745cfb62d3ee2a808820b1388c9300948bb1015df2270d27b1f"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/REQUESTED",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/top_level.txt",
          "bytes": 11,
          "sha256": "ac18c07869f9bdf03af5eb1b72722742dbe7e1751f4b853e871bd98badc70c38"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/WHEEL",
          "bytes": 91,
          "sha256": "2b6eb4118ce7cd7b09601406aa623c553c4476265836f0d9c16f5c061f7efcc0"
        },
        {
          "path": "vendor/chatterbox/__init__.py",
          "bytes": 310,
          "sha256": "412a7588ec3e439bc34d3efde1436fffe7093c35540e809b18fd86fa02084433"
        },
        {
          "path": "vendor/chatterbox/__pycache__/__init__.cpython-312.pyc",
          "bytes": 593,
          "sha256": "2a67a383ffee74b9ca1315af6ccf01cb93edd9fb81d87ce26073016b0e2316a0"
        },
        {
          "path": "vendor/chatterbox/__pycache__/mtl_tts.cpython-312.pyc",
          "bytes": 15699,
          "sha256": "7095b993e6769c3b16f2347edcd2bbd9dffec202a6077b6974e0025e3afd2155"
        },
        {
          "path": "vendor/chatterbox/__pycache__/tts.cpython-312.pyc",
          "bytes": 12577,
          "sha256": "adeac643ec4b3fa260c5c1121a7ef458481116ba6bf39a482fa20a51f7f9ed5e"
        },
        {
          "path": "vendor/chatterbox/__pycache__/vc.cpython-312.pyc",
          "bytes": 5529,
          "sha256": "b1c4e73abc2ba57bd44dc1d0700a464cf313e085e4104f44ae7612b15a7db224"
        },
        {
          "path": "vendor/chatterbox/models/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox/models/__pycache__/__init__.cpython-312.pyc",
          "bytes": 203,
          "sha256": "624723e5215975360905944d1baf061ea2923e35b58fa96073e330c2f4f36e29"
        },
        {
          "path": "vendor/chatterbox/models/__pycache__/utils.cpython-312.pyc",
          "bytes": 664,
          "sha256": "ea7c8ec5f859d4bf3441807364ace9cad5acf62b1378aeb2c60d23405cc95dc1"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__init__.py",
          "bytes": 70,
          "sha256": "cdfafe103f5757b42bd813a1553eb481d9ea631eba34c42129399974e14a23cc"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/__init__.cpython-312.pyc",
          "bytes": 299,
          "sha256": "685ea3dab7332832b68dcf16e21d943472953e0802e3eaab5ad3cb334b7423c5"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/configs.cpython-312.pyc",
          "bytes": 458,
          "sha256": "2fe1798c1299c650feb387bdbdaa6e426c75f98b3557e184e6606225334d9b1e"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/const.cpython-312.pyc",
          "bytes": 252,
          "sha256": "141c79b6f57ffddb9f870e5eb3e72fd9d57a24cabb47aede9e6885e5dd57635f"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/decoder.cpython-312.pyc",
          "bytes": 15298,
          "sha256": "ab58db1afc3c6809d1196da3d0dd404d9ec814506906a626ad72e88bf3d43762"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/f0_predictor.cpython-312.pyc",
          "bytes": 2449,
          "sha256": "44bff2390ded25eacd1a7b623d3b16dfce0ef019dbb05e45293d6c0b296f6f6f"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/flow_matching.cpython-312.pyc",
          "bytes": 11793,
          "sha256": "c08961f6fa5158b164ef406fd0cd35122d3370aef90a283f8a0bc96f806e2bd6"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/flow.cpython-312.pyc",
          "bytes": 9369,
          "sha256": "b83645f0cb4a281a92d26aa01db27996873a2ed4d4f48d45428843f85ad0034b"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/hifigan.cpython-312.pyc",
          "bytes": 24067,
          "sha256": "e9233ce64ab09704287d8429586ba5836712a52a1af6ca4c71b9216662eee8a9"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/s3gen.cpython-312.pyc",
          "bytes": 14101,
          "sha256": "8987e08b51f45f57436c14f959a8853d688eeb17287391fd59388cf230958e1a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__pycache__/xvector.cpython-312.pyc",
          "bytes": 21341,
          "sha256": "c9dad91b56da503e10a8dac46521ec0d2d250df6e1dd8cc94fcfe9b1d086448d"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/configs.py",
          "bytes": 230,
          "sha256": "d5af249710db6d8bb0a3e69b03835e4e2ef20fc135d84289c13e14139868a8a0"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/const.py",
          "bytes": 36,
          "sha256": "4e330bdc6b632afb12edb845818ffe2bf7f13441dee4d69bd74014093985fa6b"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/decoder.py",
          "bytes": 13504,
          "sha256": "ce0c531bafea8c38658b98ab8c789f14e6a23a3ece99da08631765599b0309d9"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/f0_predictor.py",
          "bytes": 2048,
          "sha256": "829f58100879516a1eea93b09c62afcf16c452795a90e76e1bb700e2db606d3f"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/flow_matching.py",
          "bytes": 11032,
          "sha256": "15758ec052f8c39dc04aa0993b03cf53a90024998bdc7576705ec4fabf4486da"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/flow.py",
          "bytes": 8376,
          "sha256": "9666b083b06a471af07a130e96f400bd4765d99fcc4a81fb2ccfa30bf3575800"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/hifigan.py",
          "bytes": 18126,
          "sha256": "0f9adcf24117e504027a515ffa1bf2a42d5f851f4a1a79665af24f39f8660a5b"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/__pycache__/decoder.cpython-312.pyc",
          "bytes": 18099,
          "sha256": "3e0e5b1bd313ace259a62d7c8f795b611e4bfa50619d168923d5aa31d6e848d0"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/__pycache__/flow_matching.cpython-312.pyc",
          "bytes": 6053,
          "sha256": "11f24a63669612c85d9c9611c50fe3c0b2c4ba364d304d2abe022c1e3e25abf5"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/__pycache__/transformer.cpython-312.pyc",
          "bytes": 13857,
          "sha256": "3339a31ceda23b50bf417ee04f4e8d4644cb0488295f5940278754c91d2447fa"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/decoder.py",
          "bytes": 14878,
          "sha256": "da7cab6c294434d401ebbff9f20cd9b31579767320ab76a4d791b7bdd015e10a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/flow_matching.py",
          "bytes": 4685,
          "sha256": "f3cdc60a786a722ec1b3bf9b12b566452a41fbe563636b71ed87b422631f36d9"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/text_encoder.py",
          "bytes": 15378,
          "sha256": "75c1e699a344866daee6edde583f60976bf90060865b23518560170e2f165c98"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/transformer.py",
          "bytes": 13553,
          "sha256": "ff7bc1b80efd583b596bf05551b33892d2471ec747b24660c3006b0c8001f7dd"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/s3gen.py",
          "bytes": 13551,
          "sha256": "19ce40153583dc6f9b1f54df0dbed93f07d2218ac6dc0e821ad5ce71fe8acd3a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/__init__.cpython-312.pyc",
          "bytes": 221,
          "sha256": "26d3700b8597394983c844580103769561d039bbf0eeb24423d69e0d1f409fbd"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/activation.cpython-312.pyc",
          "bytes": 3358,
          "sha256": "2dc7638fd10b37996bfd6dfa74e7b78bf3cfdc69cecefba00d81b8381895e042"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/attention.cpython-312.pyc",
          "bytes": 15255,
          "sha256": "aec3f1ad611b486e6a047b3daafb439eec25fd5afb2e96cbed051b54874485a0"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/convolution.cpython-312.pyc",
          "bytes": 5230,
          "sha256": "a54627b570b17387f53fa7a07ac099fdd962037f2d3e31a27b9c61b18bfa83eb"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/embedding.cpython-312.pyc",
          "bytes": 16472,
          "sha256": "fc3dabf668bf4e7e1f5ff9202530740ce3f2a9a860d62f8b052527d7c7034755"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/encoder_layer.cpython-312.pyc",
          "bytes": 11088,
          "sha256": "3641a8237d06ef971bd2d855e9886305f9b777b4351635b1909856c93e7e4427"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/positionwise_feed_forward.cpython-312.pyc",
          "bytes": 5823,
          "sha256": "afc61dec26b50797b50c9acf487e4051148a3f99cd7991e66ce46b02563463c5"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/subsampling.cpython-312.pyc",
          "bytes": 17637,
          "sha256": "494e990fca143216aebacab5f662fcd415032f2a1ed10b2151d77e74019e2db2"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__pycache__/upsample_encoder.cpython-312.pyc",
          "bytes": 14143,
          "sha256": "63fb8df2a908d00234ab737aff8b43f69e5f32e86e42381735b79349576b891d"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/activation.py",
          "bytes": 3173,
          "sha256": "741335b4a3a3242d27c6bd471b346efc5164864043a3cf3be1ca692bfee08103"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/attention.py",
          "bytes": 14745,
          "sha256": "7ea0562b3e79cb008b7a7407826c2a09cf28f61f55defc728401126080234ab6"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/convolution.py",
          "bytes": 5375,
          "sha256": "3e85608add700e0a86a0ee472384e2db511e8b223c87d936dc4ac3b009d4b06a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/embedding.py",
          "bytes": 11693,
          "sha256": "c6e501a052253decd26e6fa185f29d4f09890d0861b977d9b98874b8fdc03234"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/encoder_layer.py",
          "bytes": 9838,
          "sha256": "39cab20e9a22c4640c08839b9cc96c6fa10807dbfacebac41fc859d050af3ba5"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/positionwise_feed_forward.py",
          "bytes": 4334,
          "sha256": "d345af9bc7e088afd525a58adef627a6cc3b316865c11fa23c61760024901217"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/subsampling.py",
          "bytes": 13049,
          "sha256": "345ef01bf1ebca1808532f506653aadf6d35ead8205ee10716c1f0ed68e1e5a3"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/upsample_encoder.py",
          "bytes": 14012,
          "sha256": "251c9376b56b57ac0d052abf4657b83691c6331808f5f8219ebcfd2b8cd1d137"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/__pycache__/class_utils.cpython-312.pyc",
          "bytes": 1876,
          "sha256": "95d19d493bb78a62847aae308d05c5009cdb234557cf7d6bfcbfc784015d1db2"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/__pycache__/intmeanflow.cpython-312.pyc",
          "bytes": 1912,
          "sha256": "11b1fd18a761a0bcd12cdd3abf0295007396ae57ae10aa4be9da807e73149f92"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/__pycache__/mask.cpython-312.pyc",
          "bytes": 6070,
          "sha256": "72ced1be0da7424790b5dd32482fbf9c17bf8e5714dc693f62336fbac9d91df7"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/__pycache__/mel.cpython-312.pyc",
          "bytes": 3956,
          "sha256": "24aca5e7dbfa94c3dadd93ea9617599866b8679992f463f1705c707e90104b78"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/class_utils.py",
          "bytes": 2405,
          "sha256": "b0605ec5cb1e1fbadbcc24c488ad6ca8eff3e18f5f460edd0b3027b2de1f6aed"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/intmeanflow.py",
          "bytes": 987,
          "sha256": "09f94d16a7aa8cc42ee2aff09d69fcd3ea503f1a5e69fca03d3f0786ef172b05"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/mask.py",
          "bytes": 7860,
          "sha256": "0f4a0779b3ee6b70d209b630c4798cee99165560010afe3e0b275dd2105a4209"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/mel.py",
          "bytes": 2641,
          "sha256": "e603d99fa827eb84b8bd3df3aef5e1e567b187ab06d02ba440e2afa0eac502b2"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/xvector.py",
          "bytes": 14569,
          "sha256": "13d6b473ce7a066c2b6ddd14893e7834e9a5705cc35383adf25c5b1947125bb7"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/__init__.py",
          "bytes": 625,
          "sha256": "fa602db9e952f86943274bacd0c5b126415938e268536b8dc551aeb0aa924bc1"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1224,
          "sha256": "e944c8304af32a728a1d7ecf722be8760f0f402a91c435266b8cc5acaa787a44"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/__pycache__/s3tokenizer.cpython-312.pyc",
          "bytes": 7438,
          "sha256": "741b34f6273be3cf766c3e5db5182ff583f070b199554c03a25fc0221daf1c8a"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/s3tokenizer.py",
          "bytes": 5323,
          "sha256": "8da30a6d978b5071761899d913b31f1fe9ae766a07c316a970b529cfcd0f0aa4"
        },
        {
          "path": "vendor/chatterbox/models/t3/__init__.py",
          "bytes": 20,
          "sha256": "9d4af45d74fc3c0ebef3e875d597aee3dff31e22d585385dc9567427a638e442"
        },
        {
          "path": "vendor/chatterbox/models/t3/__pycache__/__init__.cpython-312.pyc",
          "bytes": 238,
          "sha256": "d47ec31b99853c1d7d186223073ffa15b23de85d7486bd3286a5730058605381"
        },
        {
          "path": "vendor/chatterbox/models/t3/__pycache__/llama_configs.cpython-312.pyc",
          "bytes": 2194,
          "sha256": "5004cfe3371aba3a4d75e818f7d9b593174f87b53570fceb662415143179b031"
        },
        {
          "path": "vendor/chatterbox/models/t3/__pycache__/t3.cpython-312.pyc",
          "bytes": 18584,
          "sha256": "59f19d08d639a2ca89c0b5fa0569a69c279a27b3eb961c0fb28f1864d8f9f122"
        },
        {
          "path": "vendor/chatterbox/models/t3/inference/__pycache__/t3_hf_backend.cpython-312.pyc",
          "bytes": 4209,
          "sha256": "ce6acea7584f52e251ef9aa9cb6601941b8452fc66d0775153ea5d1f1b6d9574"
        },
        {
          "path": "vendor/chatterbox/models/t3/inference/t3_hf_backend.py",
          "bytes": 4101,
          "sha256": "98ed48dfd7e671d8953a0ea13e003ee16aaf39e8e3228799076ef08eaadc3403"
        },
        {
          "path": "vendor/chatterbox/models/t3/llama_configs.py",
          "bytes": 1882,
          "sha256": "a384ed991bdccaedb493511d81de95aa8d3c2dcd5dc7d41eb506993051947872"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/__pycache__/cond_enc.cpython-312.pyc",
          "bytes": 4984,
          "sha256": "bbbe2ad228391a009d384b88d66f26b52599f3abe7d33080e2f85b94792ce8df"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/__pycache__/learned_pos_emb.cpython-312.pyc",
          "bytes": 2405,
          "sha256": "0ec4f052da3aac4e58a4541dbea071ae6ca3ecd3260b4374968b5a7969ce1379"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/__pycache__/perceiver.cpython-312.pyc",
          "bytes": 11526,
          "sha256": "9b77ca0b1adc9f867cb99c5bbc9f608c6403ecf688435db4b578f73bd3a0dddc"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/__pycache__/t3_config.cpython-312.pyc",
          "bytes": 2204,
          "sha256": "0b2542663e0b46c5fc58ad92c06824067d55f91e6f1515505740e2ca5ef20902"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/cond_enc.py",
          "bytes": 3390,
          "sha256": "392cc54b24df90cab3f3f611245b15b2fc1fef2dcf331040ba01671b2175c76f"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/learned_pos_emb.py",
          "bytes": 1131,
          "sha256": "0dd028fe53d845e71c70306175ac9e6e4d2b7ee238c0a5aa3497eed6e5e74e8a"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/perceiver.py",
          "bytes": 7931,
          "sha256": "f9637ce97b8c2dc11a79cb647ce8c3f5acdbcdeb04a56c05a7b9c55c00c717ba"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/t3_config.py",
          "bytes": 1286,
          "sha256": "2a5f8a336d9839cedf1c834c020ddc8980ca63c6e4c654bf4efd894b91dcafef"
        },
        {
          "path": "vendor/chatterbox/models/t3/t3.py",
          "bytes": 18584,
          "sha256": "a3641cf222804ef676e9c9a180c2e7eb861954d33bf798a9a9182aa6a760d5a6"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/__init__.py",
          "bytes": 48,
          "sha256": "6759fb8b4f6d50b8e4ab8ddd0e39d44e1ca7196544f93311b385a7eeea6c38c2"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 288,
          "sha256": "413df49a139ccf0e0575a55b5601db974e600e1a0f764e7f1163d8b3294412a5"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/__pycache__/tokenizer.cpython-312.pyc",
          "bytes": 14670,
          "sha256": "16372c2b05aee40c97bedea63f06ec380f69aaee7ac0ab9dd3a8bd320af712ac"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/tokenizer.py",
          "bytes": 10515,
          "sha256": "5fe52ef58684b2756ab0f0106d62de335311da04a493b637d7d093d1870c65cf"
        },
        {
          "path": "vendor/chatterbox/models/utils.py",
          "bytes": 152,
          "sha256": "e35c9893b029d44e7caeb288cf4b6c836aa3b916e7529dc3a1444adfd34ab054"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__init__.py",
          "bytes": 57,
          "sha256": "a3326161831fee10ffbfa5f5eb5dbd0e43172a92f342fb645ac5db8e0d5bcda7"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__pycache__/__init__.cpython-312.pyc",
          "bytes": 298,
          "sha256": "596e9d74d65171ae4add58fd0aba8d17bf580810311fb6b2fe6daba782432eb6"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__pycache__/config.cpython-312.pyc",
          "bytes": 838,
          "sha256": "2c08cadb233fc15ed268f2ac693a81320e0df8206a6f76616fc8286489ace205"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__pycache__/melspec.cpython-312.pyc",
          "bytes": 3595,
          "sha256": "0ae0c960d9a315fa91c38dbea499c6b0e4b466127a3917334c8b083c8eaa2ad3"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__pycache__/voice_encoder.cpython-312.pyc",
          "bytes": 16238,
          "sha256": "a36237bb8a386d284dde3a86521cc095884341d526fb327f18ade0bea63592a4"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/config.py",
          "bytes": 424,
          "sha256": "e64be6d97b000392427a0b243dd41741888d767b96a79961a63039ffd1b2b95c"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/melspec.py",
          "bytes": 2018,
          "sha256": "d3d61bf55a5a3aead1a436c3d99fc0ec822c3bced6fc1b932e83605d3775bc9f"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/voice_encoder.py",
          "bytes": 10829,
          "sha256": "9583825f6b7b5c9cf7ec93c65172fdcb1a0622d8196db65b6a966e02e4f09fc9"
        },
        {
          "path": "vendor/chatterbox/mtl_tts.py",
          "bytes": 12076,
          "sha256": "96fd2dfbd947d3b617fdada8721264bc6597799e81ebf8e43603f083f72fe433"
        },
        {
          "path": "vendor/chatterbox/tts_turbo.py",
          "bytes": 10124,
          "sha256": "5a45323d4b53e097df363faeee9fae97d410c3fe76df129b9dc2319c0051b3fd"
        },
        {
          "path": "vendor/chatterbox/tts.py",
          "bytes": 9196,
          "sha256": "520c4439bcfb7642452e950b3df7d427a625ed57e0bbab31c344dd8c78c01081"
        },
        {
          "path": "vendor/chatterbox/vc.py",
          "bytes": 3623,
          "sha256": "2761ad6847eb393209ae48e0e9716f49277597ab0bceeb06e80b867305c493d3"
        },
        {
          "path": "wheelhouse/annotated_doc-0.0.5-py3-none-any.whl",
          "bytes": 5302,
          "sha256": "117bac03a25ede5df5440e855b32d556049ca169ead221505badf432fed4b101"
        },
        {
          "path": "wheelhouse/annotated_types-0.8.0-py3-none-any.whl",
          "bytes": 13427,
          "sha256": "f072f4d804ea359e4eaf198b1af7a8b0943881a87f31bb764f8bf219bb9419e0"
        },
        {
          "path": "wheelhouse/antlr4-python3-runtime-4.9.3.tar.gz",
          "bytes": 117034,
          "sha256": "f224469b4168294902bb1efa80a8bf7855f24c99aef99cbefc1bcd3cce77881b"
        },
        {
          "path": "wheelhouse/anyio-4.15.1-py3-none-any.whl",
          "bytes": 132079,
          "sha256": "6152fdbbf9a77fdec97731721bebf7c4c44f7c29b424b0065826173efc7ed101"
        },
        {
          "path": "wheelhouse/audioread-3.1.0-py3-none-any.whl",
          "bytes": 23143,
          "sha256": "b30d1df6c5d3de5dcef0fb0e256f6ea17bdcf5f979408df0297d8a408e2971b4"
        },
        {
          "path": "wheelhouse/catalogue-2.0.10-py3-none-any.whl",
          "bytes": 17325,
          "sha256": "58c2de0020aa90f4a2da7dfad161bf7b3b054c86a5f09fcedc0b2b740c109a9f"
        },
        {
          "path": "wheelhouse/certifi-2026.7.22-py3-none-any.whl",
          "bytes": 136983,
          "sha256": "62f22742b58a1a33014a2b6b706588a8d7e2a88ae7bd1a6ebe8c992928483775"
        },
        {
          "path": "wheelhouse/cffi-2.1.1-cp312-cp312-win_amd64.whl",
          "bytes": 185919,
          "sha256": "f53e442b08449d42821fa4a4fba000095af9f62742a500f978a9f557ec44339a"
        },
        {
          "path": "wheelhouse/cfgv-3.5.0-py2.py3-none-any.whl",
          "bytes": 7445,
          "sha256": "a8dc6b26ad22ff227d2634a65cb388215ce6cc96bbcc5cfde7641ae87e8dacc0"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.5.1-cp312-cp312-win_amd64.whl",
          "bytes": 200551,
          "sha256": "3617ac3cfd8b9888f145ad89dd6e692285834b0201c6074a5eeaad3fd4d668c2"
        },
        {
          "path": "wheelhouse/click-8.5.0-py3-none-any.whl",
          "bytes": 125251,
          "sha256": "255bc9599cf7748b4b1a446ccc735421bd08a2ae529a8b88597d3de5664ee360"
        },
        {
          "path": "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "bytes": 22228,
          "sha256": "9acb47f6afd73f60dc1df93bb801b472f05ff42fa6c84167d25cb206be1fbf4a"
        },
        {
          "path": "wheelhouse/colorama-0.4.6-py2.py3-none-any.whl",
          "bytes": 25335,
          "sha256": "4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6"
        },
        {
          "path": "wheelhouse/conformer-0.3.2-py3-none-any.whl",
          "bytes": 4260,
          "sha256": "b957faa683e9e75061257f77407318428f2ad0fb5262bfc2e9b55fc2fffdfa03"
        },
        {
          "path": "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "bytes": 10365,
          "sha256": "f47fe6fdbd2edd623ecfe36875d37aba411624e2670dd395dddae1358689bb3c"
        },
        {
          "path": "wheelhouse/deprecated-1.3.1-py2.py3-none-any.whl",
          "bytes": 11298,
          "sha256": "597bfef186b6f60181535a29fbe44865ce137a5079f295b479886c82729d5f3f"
        },
        {
          "path": "wheelhouse/diffusers-0.38.0-py3-none-any.whl",
          "bytes": 5245919,
          "sha256": "18e53f9e539096320470f62c6360a6fd5727ff28cffda566265316e13fcdb612"
        },
        {
          "path": "wheelhouse/distlib-0.4.3-py2.py3-none-any.whl",
          "bytes": 470628,
          "sha256": "4b0ce306c966eb73bc3a7b6abad017c556dadd92c44701562cd528ac7fde4d5b"
        },
        {
          "path": "wheelhouse/einops-0.8.2-py3-none-any.whl",
          "bytes": 65638,
          "sha256": "54058201ac7087911181bfec4af6091bb59380360f069276601256a76af08193"
        },
        {
          "path": "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "bytes": 131954,
          "sha256": "bfb91aa2d334c61cb35ba9a116fc123b3d3df31640b801cf57a7a78ec3f603b3"
        },
        {
          "path": "wheelhouse/filelock-3.32.6-py3-none-any.whl",
          "bytes": 100189,
          "sha256": "3f16ecd0117feae0dfc147e8c62eb5daeccd8bd800378c3ddf416de9b4feb6b1"
        },
        {
          "path": "wheelhouse/fsspec-2026.7.0-py3-none-any.whl",
          "bytes": 206583,
          "sha256": "b57ddbafedfaef7018c1ecab32aa200a9d7ca26b77965f64e48b70061249d279"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/hf_xet-1.6.0-cp38-abi3-win_amd64.whl",
          "bytes": 4033128,
          "sha256": "fb4fadde1b2b70bf4c0c14a6dccbe7194b1c28947fefd5bbe3fed9d940676c3b"
        },
        {
          "path": "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "bytes": 78784,
          "sha256": "2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"
        },
        {
          "path": "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "bytes": 73517,
          "sha256": "d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"
        },
        {
          "path": "wheelhouse/huggingface_hub-1.31.0-py3-none-any.whl",
          "bytes": 798313,
          "sha256": "9dbb6a503cbe2494ea666695207e7262d410659e09134059deb83e5480864667"
        },
        {
          "path": "wheelhouse/identify-2.6.19-py2.py3-none-any.whl",
          "bytes": 99397,
          "sha256": "20e6a87f786f768c092a721ad107fc9df0eb89347be9396cadf3f4abbd1fb78a"
        },
        {
          "path": "wheelhouse/idna-3.19-py3-none-any.whl",
          "bytes": 68550,
          "sha256": "815e7be7a7806d54abb586dc943addc79e8b2ee16915059658cbeff4b1b43bf4"
        },
        {
          "path": "wheelhouse/importlib_metadata-9.0.1-py3-none-any.whl",
          "bytes": 27920,
          "sha256": "bba5600596a7e21f3eef53281cf28d6a5195634d2f2b78ff9501a3272c6eaab0"
        },
        {
          "path": "wheelhouse/jaconv-0.5.0-py3-none-any.whl",
          "bytes": 16831,
          "sha256": "2914114fe761ca49fc7089e25e6ad4a400c26f262ffce84e13b176916b71610a"
        },
        {
          "path": "wheelhouse/jinja2-3.1.6-py3-none-any.whl",
          "bytes": 134899,
          "sha256": "85ece4451f492d0c13c5dd7c13a64681a86afae63a5f347908daf103ce6d2f67"
        },
        {
          "path": "wheelhouse/joblib-1.6.0-py3-none-any.whl",
          "bytes": 306115,
          "sha256": "3dbbf9f6e4b592a2357b854608e980fe6390d131d7a82f011a377ef2ebef7aba"
        },
        {
          "path": "wheelhouse/lazy_loader-0.5-py3-none-any.whl",
          "bytes": 8044,
          "sha256": "ab0ea149e9c554d4ffeeb21105ac60bed7f3b4fd69b1d2360a4add51b170b005"
        },
        {
          "path": "wheelhouse/librosa-0.11.0-py3-none-any.whl",
          "bytes": 260749,
          "sha256": "0b6415c4fd68bff4c29288abe67c6d80b587e0e1e2cfb0aad23e4559504a7fa1"
        },
        {
          "path": "wheelhouse/llvmlite-0.49.0-cp312-cp312-win_amd64.whl",
          "bytes": 41865543,
          "sha256": "3a9c9e3af4e214acfefa4f73ebe7bc3fb35854a62b654edb3953f5ae33c08ba3"
        },
        {
          "path": "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "bytes": 91687,
          "sha256": "9f7ebbcd14fe59494226453aed97c1070d83f8d24b6fc3a3bcf9a38092641c4a"
        },
        {
          "path": "wheelhouse/markupsafe-3.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 15105,
          "sha256": "26a5784ded40c9e318cfc2bdb30fe164bdb8665ded9cd64d500a34fb42067b1c"
        },
        {
          "path": "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "bytes": 9979,
          "sha256": "84008a41e51615a49fc9966191ff91509e3c40b939176e643fd50a5c2196b8f8"
        },
        {
          "path": "wheelhouse/ml_dtypes-0.5.4-cp312-cp312-win_amd64.whl",
          "bytes": 212222,
          "sha256": "c1a953995cccb9e25a4ae19e34316671e4e2edaebe4cf538229b1fc7109087b7"
        },
        {
          "path": "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "bytes": 536198,
          "sha256": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c"
        },
        {
          "path": "wheelhouse/msgpack-1.2.2-cp312-cp312-win_amd64.whl",
          "bytes": 72275,
          "sha256": "b68614fba0570349833b7dd999ff0aed4e5cc8d9eb6e3a7d4527be33c65e33d3"
        },
        {
          "path": "wheelhouse/narwhals-2.26.0-py3-none-any.whl",
          "bytes": 474034,
          "sha256": "29326d74f107c347fd1009bd58e38d9f7c7c5b51e6de97bc93dbc325d9038b54"
        },
        {
          "path": "wheelhouse/networkx-3.6.1-py3-none-any.whl",
          "bytes": 2068504,
          "sha256": "d47fbf302e7d9cbbb9e2555a0d267983d2aa476bac30e90dfbe5669bd57f3762"
        },
        {
          "path": "wheelhouse/nodeenv-1.10.0-py2.py3-none-any.whl",
          "bytes": 23438,
          "sha256": "5bb13e3eed2923615535339b3c620e76779af4cb4c6a90deccc9e36b274d3827"
        },
        {
          "path": "wheelhouse/numba-0.67.0-cp312-cp312-win_amd64.whl",
          "bytes": 2815645,
          "sha256": "50e2b72406c18cda5dd7431b0082cb85ea94e06c64c33607248fc8bef92cfb81"
        },
        {
          "path": "wheelhouse/numpy-1.26.4-cp312-cp312-win_amd64.whl",
          "bytes": 15517754,
          "sha256": "08beddf13648eb95f8d867350f6a018a4be2e5ad54c8d8caed89ebca558b2818"
        },
        {
          "path": "wheelhouse/omegaconf-2.3.1-py3-none-any.whl",
          "bytes": 79502,
          "sha256": "3d701d14e9a8828f1edd28bb70b725908b34277cdd72cf7d6a83f94dadc6b6a0"
        },
        {
          "path": "wheelhouse/onnx-1.22.0-cp312-abi3-win_amd64.whl",
          "bytes": 17213290,
          "sha256": "72ccebab3bac07215c204ce8848d42e78eaaa666badbf72d25cd359b9f269e3a"
        },
        {
          "path": "wheelhouse/packaging-26.3-py3-none-any.whl",
          "bytes": 129956,
          "sha256": "d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c"
        },
        {
          "path": "wheelhouse/pillow-12.3.0-cp312-cp312-win_amd64.whl",
          "bytes": 7227137,
          "sha256": "a2b55dd6b2a4c4b7d87ffa56bdb33fdc5fdb9a462173861a7bc097f17d91cb09"
        },
        {
          "path": "wheelhouse/platformdirs-4.11.8-py3-none-any.whl",
          "bytes": 24027,
          "sha256": "52f2f181bbfde907966932cc8312d967d02976422d66d537ea16092b8e291081"
        },
        {
          "path": "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "bytes": 67175,
          "sha256": "f265597baa9f760d25ceb29d0beb8186c243d6607b0f60b83ecf14078dbc703b"
        },
        {
          "path": "wheelhouse/pre_commit-4.6.2-py2.py3-none-any.whl",
          "bytes": 226202,
          "sha256": "e2dde9a75d3bce11bd3831c26d134df00a2803c1d818be6a0383c3dcda25dc4e"
        },
        {
          "path": "wheelhouse/protobuf-7.36.1-cp310-abi3-win_amd64.whl",
          "bytes": 456518,
          "sha256": "51139351435d9b43d88a55eaa49fb6f737fbb478fb0cbf2cf694d1a04a9d3363"
        },
        {
          "path": "wheelhouse/pycparser-3.0-py3-none-any.whl",
          "bytes": 48172,
          "sha256": "b727414169a36b7d524c1c3e31839a521725078d7b2ff038656844266160a992"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-win_amd64.whl",
          "bytes": 2043140,
          "sha256": "5e81740c09e310f5aa5cbd3e434a01c154d4bef93241c7877b39f211d2b78ba8"
        },
        {
          "path": "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "bytes": 472589,
          "sha256": "346a034f080da3755d8e9cb5e00e8b07de1d39e4f6e2c87d8ab7cafa0b269a73"
        },
        {
          "path": "wheelhouse/pygments-2.21.0-py3-none-any.whl",
          "bytes": 1250147,
          "sha256": "2363c69b61c4a97c838da3b130dcd6468f4848992b21a82f2a63ec34377137d9"
        },
        {
          "path": "wheelhouse/pykakasi-2.3.0-py3-none-any.whl",
          "bytes": 2395003,
          "sha256": "26d21b090048ff45c6a4d8e962426b7951767216008ec30358e8a9d74af77f29"
        },
        {
          "path": "wheelhouse/pyloudnorm-0.2.0-py3-none-any.whl",
          "bytes": 10879,
          "sha256": "9bb69afb904f59d007a7f9ba3d75d16fb8aeef35c44d6df822a9f192d69cf13f"
        },
        {
          "path": "wheelhouse/python_discovery-1.6.0-py3-none-any.whl",
          "bytes": 38451,
          "sha256": "d4e244cf17b8b29819ed78003d55fbacf86eda23425b075454fff9271b79377a"
        },
        {
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 154003,
          "sha256": "5fcd34e47f6e0b794d17de1b4ff496c00986e1c83f7ab2fb8fcfe9616ff7477b"
        },
        {
          "path": "wheelhouse/regex-2026.9.10-cp312-cp312-win_amd64.whl",
          "bytes": 277933,
          "sha256": "4db7d00c4afbfbb55b8e17b1e371da11418ea9389b030acec63c1fa4c7ad4b86"
        },
        {
          "path": "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "bytes": 73075,
          "sha256": "2a0d60c172f83ac6ab31e4554906c0f3b3588d37b5cb939b1c061f4907e278e0"
        },
        {
          "path": "wheelhouse/resemble_perth-1.0.1-py3-none-any.whl",
          "bytes": 34404578,
          "sha256": "65e9c37531b1a128a4a56226b75dece4521683cf3611b0b2a5ffe234f00c9342"
        },
        {
          "path": "wheelhouse/rich-15.0.0-py3-none-any.whl",
          "bytes": 310654,
          "sha256": "33bd4ef74232fb73fe9279a257718407f169c09b78a87ad3d296f548e27de0bb"
        },
        {
          "path": "wheelhouse/s3tokenizer-0.3.0-py3-none-any.whl",
          "bytes": 226368,
          "sha256": "c9e93b1892a124a2c4d958ab53610a1b4433fcb4172056e2f2bd3c09cfe249a6"
        },
        {
          "path": "wheelhouse/safetensors-0.8.0-cp310-abi3-win_amd64.whl",
          "bytes": 355540,
          "sha256": "096ec1a98435df7beb08853bb5aa9081a84f23d0adc67ed1a0a10550f608373f"
        },
        {
          "path": "wheelhouse/scikit_learn-1.9.1-cp312-cp312-win_amd64.whl",
          "bytes": 8262238,
          "sha256": "4b59abb30618121cc46b45972d6bf53a7128b4df4cd346c6ca6f4d5f9031e49c"
        },
        {
          "path": "wheelhouse/scipy-1.17.1-cp312-cp312-win_amd64.whl",
          "bytes": 36549682,
          "sha256": "41b71f4a3a4cab9d366cd9065b288efc4d4f3c0b37a91a8e0947fb5bd7f31d87"
        },
        {
          "path": "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "bytes": 1201486,
          "sha256": "062d34222ad13e0cc312a4c02d73f059e86a4acbfbdea8f8f76b28c99f306922"
        },
        {
          "path": "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "bytes": 9755,
          "sha256": "7ecfff8f2fd72616f7481040475a65b2bf8af90a56c89140852d1120324e8686"
        },
        {
          "path": "wheelhouse/soundfile-0.14.0-py2.py3-none-win_amd64.whl",
          "bytes": 1021480,
          "sha256": "299491d3499460fb1b74bb4bd78b57ffc2d243a5fafa7b6ec1b264875c78453e"
        },
        {
          "path": "wheelhouse/soxr-1.1.0-cp312-abi3-win_amd64.whl",
          "bytes": 174357,
          "sha256": "6ae2a174bffea94e8ead857dad85999d3f49f091774dbad5b046c0417d7092f4"
        },
        {
          "path": "wheelhouse/spacy_pkuseg-1.0.1-cp312-cp312-win_amd64.whl",
          "bytes": 2401422,
          "sha256": "1de1f4fb62f730d72b5d80daf858783b8662e489539d7724b0c7766258860f87"
        },
        {
          "path": "wheelhouse/srsly-2.5.3-cp312-cp312-win_amd64.whl",
          "bytes": 652459,
          "sha256": "598f1e494c18cacb978299d77125415a586417081959f8ec3f068b32d97f8933"
        },
        {
          "path": "wheelhouse/starlette-1.6.0-py3-none-any.whl",
          "bytes": 75969,
          "sha256": "a86dd39d14bb45f85a3d18525215a9ef0cfd1f192ac793220e72598c90335f0c"
        },
        {
          "path": "wheelhouse/sympy-1.13.1-py3-none-any.whl",
          "bytes": 6189177,
          "sha256": "db36cdc64bf61b9b24578b6f7bab1ecdd2452cf008f34faa33776680c26d66f8"
        },
        {
          "path": "wheelhouse/threadpoolctl-3.6.0-py3-none-any.whl",
          "bytes": 18638,
          "sha256": "43a0b8fd5a2928500110039e43a5eed8480b918967083ea48dc3ab9f13c4a7fb"
        },
        {
          "path": "wheelhouse/tokenizers-0.23.2-cp310-abi3-win_amd64.whl",
          "bytes": 2863236,
          "sha256": "2e96f5699d5249c9c64aa8412e044f727aae3a4098cf830f9901ec1afc361cde"
        },
        {
          "path": "wheelhouse/torch-2.6.0+cpu-cp312-cp312-win_amd64.whl",
          "bytes": 206493444,
          "sha256": "4027d982eb2781c93825ab9527f17fbbb12dbabf422298e4b954be60016f87d8"
        },
        {
          "path": "wheelhouse/torchaudio-2.6.0+cpu-cp312-cp312-win_amd64.whl",
          "bytes": 2438883,
          "sha256": "75266c25d394bb5d70f83a38b1b4d858c074a767c18f7ff87443bdf193c1b236"
        },
        {
          "path": "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "bytes": 80199,
          "sha256": "c293e525e6fef9c20e8728fd4612df02a0aa31bb5fe91ecd93e123b1b7bffa73"
        },
        {
          "path": "wheelhouse/transformers-5.17.0-py3-none-any.whl",
          "bytes": 12295140,
          "sha256": "78ec1ce21579b38dfb83950a0658cd119f87212a2fcfdff478096ce9d6c03801"
        },
        {
          "path": "wheelhouse/typer-0.27.2-py3-none-any.whl",
          "bytes": 123130,
          "sha256": "b3a5fc4342d5fc8fda8fc3010b1cf117e9249aab7fae800c2eff62fd3842d97d"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.4-py3-none-any.whl",
          "bytes": 14750,
          "sha256": "65b8397ba37ccbce054456aaccddfc91e6e3083c92824df348d96ca832f3f147"
        },
        {
          "path": "wheelhouse/urllib3-2.7.0-py3-none-any.whl",
          "bytes": 131087,
          "sha256": "9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897"
        },
        {
          "path": "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "bytes": 79871,
          "sha256": "f86e41a149d7d05a9969337e3946a9c171c06a5d42680896daaba624aeac8da1"
        },
        {
          "path": "wheelhouse/virtualenv-21.7.9-py3-none-any.whl",
          "bytes": 5324667,
          "sha256": "ba3b0bb41063c848d84d76a9fe3fb7711aaa0f2fe78708e8f3cd9714770e4eac"
        },
        {
          "path": "wheelhouse/wrapt-2.4.1-cp312-cp312-win_amd64.whl",
          "bytes": 98808,
          "sha256": "b4e7efdd476ac631a0181551fd9aace844765ea3ce2b5133b194fae4421e8ad0"
        },
        {
          "path": "wheelhouse/zipp-4.1.0-py3-none-any.whl",
          "bytes": 10238,
          "sha256": "25ad4e16390cd314347dd8f1de67a2ac538ae658ed4ab9db16029c07c188e97f"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/python.exe",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "44744875994b000e549435a90a98f83f8f5f0e04bf8416dec84f0adfdcaa989d",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "MIT",
        "url": "https://opensource.org/license/mit/"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-1.0.0-py312-cpu1.spdx.json",
        "sha256": "577ccd2c98b554ed722890ebf424c767e12f6f9784448a1c9c8f10e42a4f2c03"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "4H9nSfoDrAM6xSjSBWZFHE6K5vSJtmtf7Lz1Sthzr+QxGWdfplDKd0SNBwjaADV8jjFwCbA3UxrxOrCFwganAQ=="
    },
    {
      "protocolVersion": 1,
      "id": "chatterbox-cuda",
      "moduleId": "chatterbox-cuda",
      "groupId": "audio",
      "displayName": "参考音色克隆 GPU 加速",
      "purpose": "为已安装的参考音色克隆能力增加 NVIDIA CUDA 推理；复用已有模型，不重复下载模型文件。",
      "dependencyIds": [
        "chatterbox",
        "python-312"
      ],
      "taskToolIds": [
        "chatterbox"
      ],
      "installConditions": [
        "下载 CUDA 推理运行时和固定依赖，首次安装可能需要数 GB 空间；Chatterbox 模型由基础能力共享，不会再次下载。",
        "需要 NVIDIA 显卡及兼容的 NVIDIA 驱动；本模块不会安装或修改显卡驱动。无兼容 GPU 时仍可用基础 CPU 能力。",
        "Python 3.12、PyTorch CUDA 12.4 与 Chatterbox 源码均版本锁定；生成时无需联网。"
      ],
      "version": "1.0.0-py312-cu1241",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-cuda-1.0.0-py312-cu1241.tar.gz",
        "bytes": 210511812,
        "sha256": "cf031a1283b9c68dd49504ca6dd996cbf1f64b5d6f64b81a4a5af71a397ea964",
        "format": "tar.gz",
        "filePaths": [
          "requirements.lock",
          "scripts/chatterbox-worker.py",
          "scripts/worker_lifecycle.py",
          "vendor/chatterbox_tts-0.1.7.dist-info/direct_url.json",
          "vendor/chatterbox_tts-0.1.7.dist-info/INSTALLER",
          "vendor/chatterbox_tts-0.1.7.dist-info/licenses/LICENSE",
          "vendor/chatterbox_tts-0.1.7.dist-info/METADATA",
          "vendor/chatterbox_tts-0.1.7.dist-info/RECORD",
          "vendor/chatterbox_tts-0.1.7.dist-info/REQUESTED",
          "vendor/chatterbox_tts-0.1.7.dist-info/top_level.txt",
          "vendor/chatterbox_tts-0.1.7.dist-info/WHEEL",
          "vendor/chatterbox/__init__.py",
          "vendor/chatterbox/models/__init__.py",
          "vendor/chatterbox/models/s3gen/__init__.py",
          "vendor/chatterbox/models/s3gen/configs.py",
          "vendor/chatterbox/models/s3gen/const.py",
          "vendor/chatterbox/models/s3gen/decoder.py",
          "vendor/chatterbox/models/s3gen/f0_predictor.py",
          "vendor/chatterbox/models/s3gen/flow_matching.py",
          "vendor/chatterbox/models/s3gen/flow.py",
          "vendor/chatterbox/models/s3gen/hifigan.py",
          "vendor/chatterbox/models/s3gen/matcha/decoder.py",
          "vendor/chatterbox/models/s3gen/matcha/flow_matching.py",
          "vendor/chatterbox/models/s3gen/matcha/text_encoder.py",
          "vendor/chatterbox/models/s3gen/matcha/transformer.py",
          "vendor/chatterbox/models/s3gen/s3gen.py",
          "vendor/chatterbox/models/s3gen/transformer/__init__.py",
          "vendor/chatterbox/models/s3gen/transformer/activation.py",
          "vendor/chatterbox/models/s3gen/transformer/attention.py",
          "vendor/chatterbox/models/s3gen/transformer/convolution.py",
          "vendor/chatterbox/models/s3gen/transformer/embedding.py",
          "vendor/chatterbox/models/s3gen/transformer/encoder_layer.py",
          "vendor/chatterbox/models/s3gen/transformer/positionwise_feed_forward.py",
          "vendor/chatterbox/models/s3gen/transformer/subsampling.py",
          "vendor/chatterbox/models/s3gen/transformer/upsample_encoder.py",
          "vendor/chatterbox/models/s3gen/utils/class_utils.py",
          "vendor/chatterbox/models/s3gen/utils/intmeanflow.py",
          "vendor/chatterbox/models/s3gen/utils/mask.py",
          "vendor/chatterbox/models/s3gen/utils/mel.py",
          "vendor/chatterbox/models/s3gen/xvector.py",
          "vendor/chatterbox/models/s3tokenizer/__init__.py",
          "vendor/chatterbox/models/s3tokenizer/s3tokenizer.py",
          "vendor/chatterbox/models/t3/__init__.py",
          "vendor/chatterbox/models/t3/inference/t3_hf_backend.py",
          "vendor/chatterbox/models/t3/llama_configs.py",
          "vendor/chatterbox/models/t3/modules/cond_enc.py",
          "vendor/chatterbox/models/t3/modules/learned_pos_emb.py",
          "vendor/chatterbox/models/t3/modules/perceiver.py",
          "vendor/chatterbox/models/t3/modules/t3_config.py",
          "vendor/chatterbox/models/t3/t3.py",
          "vendor/chatterbox/models/tokenizers/__init__.py",
          "vendor/chatterbox/models/tokenizers/tokenizer.py",
          "vendor/chatterbox/models/utils.py",
          "vendor/chatterbox/models/voice_encoder/__init__.py",
          "vendor/chatterbox/models/voice_encoder/config.py",
          "vendor/chatterbox/models/voice_encoder/melspec.py",
          "vendor/chatterbox/models/voice_encoder/voice_encoder.py",
          "vendor/chatterbox/mtl_tts.py",
          "vendor/chatterbox/tts_turbo.py",
          "vendor/chatterbox/tts.py",
          "vendor/chatterbox/vc.py",
          "wheelhouse/annotated_doc-0.0.5-py3-none-any.whl",
          "wheelhouse/annotated_types-0.8.0-py3-none-any.whl",
          "wheelhouse/antlr4-python3-runtime-4.9.3.tar.gz",
          "wheelhouse/anyio-4.15.1-py3-none-any.whl",
          "wheelhouse/audioread-3.1.0-py3-none-any.whl",
          "wheelhouse/catalogue-2.0.10-py3-none-any.whl",
          "wheelhouse/certifi-2026.7.22-py3-none-any.whl",
          "wheelhouse/cffi-2.1.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/cfgv-3.5.0-py2.py3-none-any.whl",
          "wheelhouse/charset_normalizer-3.5.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/click-8.5.0-py3-none-any.whl",
          "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "wheelhouse/colorama-0.4.6-py2.py3-none-any.whl",
          "wheelhouse/conformer-0.3.2-py3-none-any.whl",
          "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "wheelhouse/deprecated-1.3.1-py2.py3-none-any.whl",
          "wheelhouse/diffusers-0.38.0-py3-none-any.whl",
          "wheelhouse/distlib-0.4.3-py2.py3-none-any.whl",
          "wheelhouse/einops-0.8.2-py3-none-any.whl",
          "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "wheelhouse/filelock-4.0.4-py3-none-any.whl",
          "wheelhouse/fsspec-2026.9.0-py3-none-any.whl",
          "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "wheelhouse/hf_xet-1.6.0-cp38-abi3-win_amd64.whl",
          "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "wheelhouse/huggingface_hub-1.31.0-py3-none-any.whl",
          "wheelhouse/identify-2.6.20-py2.py3-none-any.whl",
          "wheelhouse/idna-3.20-py3-none-any.whl",
          "wheelhouse/importlib_metadata-9.0.1-py3-none-any.whl",
          "wheelhouse/jaconv-0.5.0-py3-none-any.whl",
          "wheelhouse/jinja2-3.1.6-py3-none-any.whl",
          "wheelhouse/joblib-1.6.0-py3-none-any.whl",
          "wheelhouse/lazy_loader-0.6-py3-none-any.whl",
          "wheelhouse/librosa-0.11.0-py3-none-any.whl",
          "wheelhouse/llvmlite-0.49.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "wheelhouse/markupsafe-3.0.3-cp312-cp312-win_amd64.whl",
          "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "wheelhouse/ml_dtypes-0.5.4-cp312-cp312-win_amd64.whl",
          "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "wheelhouse/msgpack-1.2.2-cp312-cp312-win_amd64.whl",
          "wheelhouse/narwhals-2.26.0-py3-none-any.whl",
          "wheelhouse/networkx-3.6.1-py3-none-any.whl",
          "wheelhouse/nodeenv-1.11.0-py2.py3-none-any.whl",
          "wheelhouse/numba-0.67.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/numpy-1.26.4-cp312-cp312-win_amd64.whl",
          "wheelhouse/omegaconf-2.3.1-py3-none-any.whl",
          "wheelhouse/onnx-1.23.0-cp312-abi3-win_amd64.whl",
          "wheelhouse/packaging-26.3-py3-none-any.whl",
          "wheelhouse/pillow-12.3.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/platformdirs-4.12.0-py3-none-any.whl",
          "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "wheelhouse/pre_commit-4.6.2-py2.py3-none-any.whl",
          "wheelhouse/protobuf-7.36.2-cp310-abi3-win_amd64.whl",
          "wheelhouse/pycparser-3.0-py3-none-any.whl",
          "wheelhouse/pydantic_core-2.46.5-cp312-cp312-win_amd64.whl",
          "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "wheelhouse/pygments-2.21.0-py3-none-any.whl",
          "wheelhouse/pykakasi-2.3.0-py3-none-any.whl",
          "wheelhouse/pyloudnorm-0.2.0-py3-none-any.whl",
          "wheelhouse/python_discovery-1.6.1-py3-none-any.whl",
          "wheelhouse/pyyaml-6.0.3-cp312-cp312-win_amd64.whl",
          "wheelhouse/regex-2026.9.10-cp312-cp312-win_amd64.whl",
          "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "wheelhouse/resemble_perth-1.0.1-py3-none-any.whl",
          "wheelhouse/rich-15.0.0-py3-none-any.whl",
          "wheelhouse/s3tokenizer-0.3.0-py3-none-any.whl",
          "wheelhouse/safetensors-0.8.0-cp310-abi3-win_amd64.whl",
          "wheelhouse/scikit_learn-1.9.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/scipy-1.17.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "wheelhouse/soundfile-0.14.0-py2.py3-none-win_amd64.whl",
          "wheelhouse/soxr-1.1.0-cp312-abi3-win_amd64.whl",
          "wheelhouse/spacy_pkuseg-1.0.1-cp312-cp312-win_amd64.whl",
          "wheelhouse/srsly-2.5.3-cp312-cp312-win_amd64.whl",
          "wheelhouse/starlette-1.6.0-py3-none-any.whl",
          "wheelhouse/sympy-1.13.1-py3-none-any.whl",
          "wheelhouse/threadpoolctl-3.7.0-py3-none-any.whl",
          "wheelhouse/tokenizers-0.23.2-cp310-abi3-win_amd64.whl",
          "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "wheelhouse/transformers-5.17.0-py3-none-any.whl",
          "wheelhouse/typer-0.27.2-py3-none-any.whl",
          "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "wheelhouse/typing_inspection-0.4.4-py3-none-any.whl",
          "wheelhouse/urllib3-2.8.0-py3-none-any.whl",
          "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "wheelhouse/virtualenv-21.13.0-py3-none-any.whl",
          "wheelhouse/wrapt-2.5.0-cp312-cp312-win_amd64.whl",
          "wheelhouse/zipp-4.1.0-py3-none-any.whl"
        ]
      },
      "additionalArchives": [
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-cuda-1.0.0-py312-cu1241-cuda-torch-part-0001.tar.gz",
          "bytes": 1498292694,
          "sha256": "dbb92fe0985fcc6e9d849a8f11b0f166d5307733cfff073288e8f5c0b0d9fd0f",
          "format": "tar.gz",
          "filePaths": [
            "wheelhouse/.parts/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0001"
          ]
        },
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-cuda-1.0.0-py312-cu1241-cuda-torch-part-0002.tar.gz",
          "bytes": 1028311500,
          "sha256": "d1334fdaf3fab7c87183f5579ff9e937c9e041a0cb39908e02a406d9a9abdab4",
          "format": "tar.gz",
          "filePaths": [
            "wheelhouse/.parts/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0002"
          ]
        },
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-cuda-1.0.0-py312-cu1241-cuda-torchaudio.tar.gz",
          "bytes": 4116387,
          "sha256": "38dff6b27cc3b0fd318aaf355ec087bf0f7cd6649648d913128ccf32a942b7e3",
          "format": "tar.gz",
          "filePaths": [
            "wheelhouse/torchaudio-2.6.0+cu124-cp312-cp312-win_amd64.whl"
          ]
        }
      ],
      "assembledFiles": [
        {
          "path": "wheelhouse/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl",
          "bytes": 2532302369,
          "sha256": "3313061c1fec4c7310cf47944e84513dcd27b6173b72a349bb7ca68d0ee6e9c0",
          "parts": [
            {
              "path": "wheelhouse/.parts/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0001",
              "bytes": 1500000000,
              "sha256": "d954b96bae050157121adf4822cd7c7f0f0a74aff11a5a0df4ee09559002c8e6"
            },
            {
              "path": "wheelhouse/.parts/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0002",
              "bytes": 1032302369,
              "sha256": "3e146a4c99522a7f9cc6c9e0e8f72b453f928642437b8491a6b0f30b49e74bae"
            }
          ]
        }
      ],
      "installedBytes": 12000000000,
      "files": [
        {
          "path": "requirements.lock",
          "bytes": 142366,
          "sha256": "88ff95c2eca8f062d202d3b554e3d2a338d4012957ab0bf4d9207c1bc870b4e9"
        },
        {
          "path": "scripts/chatterbox-worker.py",
          "bytes": 26755,
          "sha256": "5bf37caa877026fe9dbc951dc3365533ca40501ec750c3b92c04e96cfc559eba"
        },
        {
          "path": "scripts/worker_lifecycle.py",
          "bytes": 1130,
          "sha256": "bbde9d83156f78b6cf669e98ba3641b7786241e696df8598725133cf9c48a645"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/direct_url.json",
          "bytes": 207,
          "sha256": "b0e1f920f6322772ee7781de88993f7911ae9fbddae4a3032e380c35643a3acc"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/INSTALLER",
          "bytes": 4,
          "sha256": "ceebae7b8927a3227e5303cf5e0f1f7b34bb542ad7250ac03fbcde36ec2f1508"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/licenses/LICENSE",
          "bytes": 1087,
          "sha256": "7d6744b52e52960d42c69b29b55b4b9e0b4656cf52569ab710093f7707f7a067"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/METADATA",
          "bytes": 16464,
          "sha256": "082f4387c26d373b34a941e8ccd967d4eb69e367392e0b19d595ed7734dd87c3"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/RECORD",
          "bytes": 8980,
          "sha256": "c6aee6bbdc372745cfb62d3ee2a808820b1388c9300948bb1015df2270d27b1f"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/REQUESTED",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/top_level.txt",
          "bytes": 11,
          "sha256": "ac18c07869f9bdf03af5eb1b72722742dbe7e1751f4b853e871bd98badc70c38"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/WHEEL",
          "bytes": 91,
          "sha256": "2b6eb4118ce7cd7b09601406aa623c553c4476265836f0d9c16f5c061f7efcc0"
        },
        {
          "path": "vendor/chatterbox/__init__.py",
          "bytes": 310,
          "sha256": "412a7588ec3e439bc34d3efde1436fffe7093c35540e809b18fd86fa02084433"
        },
        {
          "path": "vendor/chatterbox/models/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__init__.py",
          "bytes": 70,
          "sha256": "cdfafe103f5757b42bd813a1553eb481d9ea631eba34c42129399974e14a23cc"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/configs.py",
          "bytes": 230,
          "sha256": "d5af249710db6d8bb0a3e69b03835e4e2ef20fc135d84289c13e14139868a8a0"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/const.py",
          "bytes": 36,
          "sha256": "4e330bdc6b632afb12edb845818ffe2bf7f13441dee4d69bd74014093985fa6b"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/decoder.py",
          "bytes": 13504,
          "sha256": "ce0c531bafea8c38658b98ab8c789f14e6a23a3ece99da08631765599b0309d9"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/f0_predictor.py",
          "bytes": 2048,
          "sha256": "829f58100879516a1eea93b09c62afcf16c452795a90e76e1bb700e2db606d3f"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/flow_matching.py",
          "bytes": 11032,
          "sha256": "15758ec052f8c39dc04aa0993b03cf53a90024998bdc7576705ec4fabf4486da"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/flow.py",
          "bytes": 8376,
          "sha256": "9666b083b06a471af07a130e96f400bd4765d99fcc4a81fb2ccfa30bf3575800"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/hifigan.py",
          "bytes": 18126,
          "sha256": "0f9adcf24117e504027a515ffa1bf2a42d5f851f4a1a79665af24f39f8660a5b"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/decoder.py",
          "bytes": 14878,
          "sha256": "da7cab6c294434d401ebbff9f20cd9b31579767320ab76a4d791b7bdd015e10a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/flow_matching.py",
          "bytes": 4685,
          "sha256": "f3cdc60a786a722ec1b3bf9b12b566452a41fbe563636b71ed87b422631f36d9"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/text_encoder.py",
          "bytes": 15378,
          "sha256": "75c1e699a344866daee6edde583f60976bf90060865b23518560170e2f165c98"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/transformer.py",
          "bytes": 13553,
          "sha256": "ff7bc1b80efd583b596bf05551b33892d2471ec747b24660c3006b0c8001f7dd"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/s3gen.py",
          "bytes": 13551,
          "sha256": "19ce40153583dc6f9b1f54df0dbed93f07d2218ac6dc0e821ad5ce71fe8acd3a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/activation.py",
          "bytes": 3173,
          "sha256": "741335b4a3a3242d27c6bd471b346efc5164864043a3cf3be1ca692bfee08103"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/attention.py",
          "bytes": 14745,
          "sha256": "7ea0562b3e79cb008b7a7407826c2a09cf28f61f55defc728401126080234ab6"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/convolution.py",
          "bytes": 5375,
          "sha256": "3e85608add700e0a86a0ee472384e2db511e8b223c87d936dc4ac3b009d4b06a"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/embedding.py",
          "bytes": 11693,
          "sha256": "c6e501a052253decd26e6fa185f29d4f09890d0861b977d9b98874b8fdc03234"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/encoder_layer.py",
          "bytes": 9838,
          "sha256": "39cab20e9a22c4640c08839b9cc96c6fa10807dbfacebac41fc859d050af3ba5"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/positionwise_feed_forward.py",
          "bytes": 4334,
          "sha256": "d345af9bc7e088afd525a58adef627a6cc3b316865c11fa23c61760024901217"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/subsampling.py",
          "bytes": 13049,
          "sha256": "345ef01bf1ebca1808532f506653aadf6d35ead8205ee10716c1f0ed68e1e5a3"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/upsample_encoder.py",
          "bytes": 14012,
          "sha256": "251c9376b56b57ac0d052abf4657b83691c6331808f5f8219ebcfd2b8cd1d137"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/class_utils.py",
          "bytes": 2405,
          "sha256": "b0605ec5cb1e1fbadbcc24c488ad6ca8eff3e18f5f460edd0b3027b2de1f6aed"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/intmeanflow.py",
          "bytes": 987,
          "sha256": "09f94d16a7aa8cc42ee2aff09d69fcd3ea503f1a5e69fca03d3f0786ef172b05"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/mask.py",
          "bytes": 7860,
          "sha256": "0f4a0779b3ee6b70d209b630c4798cee99165560010afe3e0b275dd2105a4209"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/mel.py",
          "bytes": 2641,
          "sha256": "e603d99fa827eb84b8bd3df3aef5e1e567b187ab06d02ba440e2afa0eac502b2"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/xvector.py",
          "bytes": 14569,
          "sha256": "13d6b473ce7a066c2b6ddd14893e7834e9a5705cc35383adf25c5b1947125bb7"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/__init__.py",
          "bytes": 625,
          "sha256": "fa602db9e952f86943274bacd0c5b126415938e268536b8dc551aeb0aa924bc1"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/s3tokenizer.py",
          "bytes": 5323,
          "sha256": "8da30a6d978b5071761899d913b31f1fe9ae766a07c316a970b529cfcd0f0aa4"
        },
        {
          "path": "vendor/chatterbox/models/t3/__init__.py",
          "bytes": 20,
          "sha256": "9d4af45d74fc3c0ebef3e875d597aee3dff31e22d585385dc9567427a638e442"
        },
        {
          "path": "vendor/chatterbox/models/t3/inference/t3_hf_backend.py",
          "bytes": 4101,
          "sha256": "98ed48dfd7e671d8953a0ea13e003ee16aaf39e8e3228799076ef08eaadc3403"
        },
        {
          "path": "vendor/chatterbox/models/t3/llama_configs.py",
          "bytes": 1882,
          "sha256": "a384ed991bdccaedb493511d81de95aa8d3c2dcd5dc7d41eb506993051947872"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/cond_enc.py",
          "bytes": 3390,
          "sha256": "392cc54b24df90cab3f3f611245b15b2fc1fef2dcf331040ba01671b2175c76f"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/learned_pos_emb.py",
          "bytes": 1131,
          "sha256": "0dd028fe53d845e71c70306175ac9e6e4d2b7ee238c0a5aa3497eed6e5e74e8a"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/perceiver.py",
          "bytes": 7931,
          "sha256": "f9637ce97b8c2dc11a79cb647ce8c3f5acdbcdeb04a56c05a7b9c55c00c717ba"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/t3_config.py",
          "bytes": 1286,
          "sha256": "2a5f8a336d9839cedf1c834c020ddc8980ca63c6e4c654bf4efd894b91dcafef"
        },
        {
          "path": "vendor/chatterbox/models/t3/t3.py",
          "bytes": 18584,
          "sha256": "a3641cf222804ef676e9c9a180c2e7eb861954d33bf798a9a9182aa6a760d5a6"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/__init__.py",
          "bytes": 48,
          "sha256": "6759fb8b4f6d50b8e4ab8ddd0e39d44e1ca7196544f93311b385a7eeea6c38c2"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/tokenizer.py",
          "bytes": 10515,
          "sha256": "5fe52ef58684b2756ab0f0106d62de335311da04a493b637d7d093d1870c65cf"
        },
        {
          "path": "vendor/chatterbox/models/utils.py",
          "bytes": 152,
          "sha256": "e35c9893b029d44e7caeb288cf4b6c836aa3b916e7529dc3a1444adfd34ab054"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__init__.py",
          "bytes": 57,
          "sha256": "a3326161831fee10ffbfa5f5eb5dbd0e43172a92f342fb645ac5db8e0d5bcda7"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/config.py",
          "bytes": 424,
          "sha256": "e64be6d97b000392427a0b243dd41741888d767b96a79961a63039ffd1b2b95c"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/melspec.py",
          "bytes": 2018,
          "sha256": "d3d61bf55a5a3aead1a436c3d99fc0ec822c3bced6fc1b932e83605d3775bc9f"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/voice_encoder.py",
          "bytes": 10829,
          "sha256": "9583825f6b7b5c9cf7ec93c65172fdcb1a0622d8196db65b6a966e02e4f09fc9"
        },
        {
          "path": "vendor/chatterbox/mtl_tts.py",
          "bytes": 12076,
          "sha256": "96fd2dfbd947d3b617fdada8721264bc6597799e81ebf8e43603f083f72fe433"
        },
        {
          "path": "vendor/chatterbox/tts_turbo.py",
          "bytes": 10124,
          "sha256": "5a45323d4b53e097df363faeee9fae97d410c3fe76df129b9dc2319c0051b3fd"
        },
        {
          "path": "vendor/chatterbox/tts.py",
          "bytes": 9196,
          "sha256": "520c4439bcfb7642452e950b3df7d427a625ed57e0bbab31c344dd8c78c01081"
        },
        {
          "path": "vendor/chatterbox/vc.py",
          "bytes": 3623,
          "sha256": "2761ad6847eb393209ae48e0e9716f49277597ab0bceeb06e80b867305c493d3"
        },
        {
          "path": "wheelhouse/annotated_doc-0.0.5-py3-none-any.whl",
          "bytes": 5302,
          "sha256": "117bac03a25ede5df5440e855b32d556049ca169ead221505badf432fed4b101"
        },
        {
          "path": "wheelhouse/annotated_types-0.8.0-py3-none-any.whl",
          "bytes": 13427,
          "sha256": "f072f4d804ea359e4eaf198b1af7a8b0943881a87f31bb764f8bf219bb9419e0"
        },
        {
          "path": "wheelhouse/antlr4-python3-runtime-4.9.3.tar.gz",
          "bytes": 117034,
          "sha256": "f224469b4168294902bb1efa80a8bf7855f24c99aef99cbefc1bcd3cce77881b"
        },
        {
          "path": "wheelhouse/anyio-4.15.1-py3-none-any.whl",
          "bytes": 132079,
          "sha256": "6152fdbbf9a77fdec97731721bebf7c4c44f7c29b424b0065826173efc7ed101"
        },
        {
          "path": "wheelhouse/audioread-3.1.0-py3-none-any.whl",
          "bytes": 23143,
          "sha256": "b30d1df6c5d3de5dcef0fb0e256f6ea17bdcf5f979408df0297d8a408e2971b4"
        },
        {
          "path": "wheelhouse/catalogue-2.0.10-py3-none-any.whl",
          "bytes": 17325,
          "sha256": "58c2de0020aa90f4a2da7dfad161bf7b3b054c86a5f09fcedc0b2b740c109a9f"
        },
        {
          "path": "wheelhouse/certifi-2026.7.22-py3-none-any.whl",
          "bytes": 136983,
          "sha256": "62f22742b58a1a33014a2b6b706588a8d7e2a88ae7bd1a6ebe8c992928483775"
        },
        {
          "path": "wheelhouse/cffi-2.1.1-cp312-cp312-win_amd64.whl",
          "bytes": 185919,
          "sha256": "f53e442b08449d42821fa4a4fba000095af9f62742a500f978a9f557ec44339a"
        },
        {
          "path": "wheelhouse/cfgv-3.5.0-py2.py3-none-any.whl",
          "bytes": 7445,
          "sha256": "a8dc6b26ad22ff227d2634a65cb388215ce6cc96bbcc5cfde7641ae87e8dacc0"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.5.1-cp312-cp312-win_amd64.whl",
          "bytes": 200551,
          "sha256": "3617ac3cfd8b9888f145ad89dd6e692285834b0201c6074a5eeaad3fd4d668c2"
        },
        {
          "path": "wheelhouse/click-8.5.0-py3-none-any.whl",
          "bytes": 125251,
          "sha256": "255bc9599cf7748b4b1a446ccc735421bd08a2ae529a8b88597d3de5664ee360"
        },
        {
          "path": "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "bytes": 22228,
          "sha256": "9acb47f6afd73f60dc1df93bb801b472f05ff42fa6c84167d25cb206be1fbf4a"
        },
        {
          "path": "wheelhouse/colorama-0.4.6-py2.py3-none-any.whl",
          "bytes": 25335,
          "sha256": "4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6"
        },
        {
          "path": "wheelhouse/conformer-0.3.2-py3-none-any.whl",
          "bytes": 4260,
          "sha256": "b957faa683e9e75061257f77407318428f2ad0fb5262bfc2e9b55fc2fffdfa03"
        },
        {
          "path": "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "bytes": 10365,
          "sha256": "f47fe6fdbd2edd623ecfe36875d37aba411624e2670dd395dddae1358689bb3c"
        },
        {
          "path": "wheelhouse/deprecated-1.3.1-py2.py3-none-any.whl",
          "bytes": 11298,
          "sha256": "597bfef186b6f60181535a29fbe44865ce137a5079f295b479886c82729d5f3f"
        },
        {
          "path": "wheelhouse/diffusers-0.38.0-py3-none-any.whl",
          "bytes": 5245919,
          "sha256": "18e53f9e539096320470f62c6360a6fd5727ff28cffda566265316e13fcdb612"
        },
        {
          "path": "wheelhouse/distlib-0.4.3-py2.py3-none-any.whl",
          "bytes": 470628,
          "sha256": "4b0ce306c966eb73bc3a7b6abad017c556dadd92c44701562cd528ac7fde4d5b"
        },
        {
          "path": "wheelhouse/einops-0.8.2-py3-none-any.whl",
          "bytes": 65638,
          "sha256": "54058201ac7087911181bfec4af6091bb59380360f069276601256a76af08193"
        },
        {
          "path": "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "bytes": 131954,
          "sha256": "bfb91aa2d334c61cb35ba9a116fc123b3d3df31640b801cf57a7a78ec3f603b3"
        },
        {
          "path": "wheelhouse/filelock-4.0.4-py3-none-any.whl",
          "bytes": 108629,
          "sha256": "0df72be195ca7892216d16f2edce8d9b93a571f02402972020a8cff84c594c7b"
        },
        {
          "path": "wheelhouse/fsspec-2026.9.0-py3-none-any.whl",
          "bytes": 221738,
          "sha256": "8dd6e646e99ea382bd85f97a45e6b526a442d79423a7dc673f1e2756d05fcb5f"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/hf_xet-1.6.0-cp38-abi3-win_amd64.whl",
          "bytes": 4033128,
          "sha256": "fb4fadde1b2b70bf4c0c14a6dccbe7194b1c28947fefd5bbe3fed9d940676c3b"
        },
        {
          "path": "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "bytes": 78784,
          "sha256": "2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"
        },
        {
          "path": "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "bytes": 73517,
          "sha256": "d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"
        },
        {
          "path": "wheelhouse/huggingface_hub-1.31.0-py3-none-any.whl",
          "bytes": 798313,
          "sha256": "9dbb6a503cbe2494ea666695207e7262d410659e09134059deb83e5480864667"
        },
        {
          "path": "wheelhouse/identify-2.6.20-py2.py3-none-any.whl",
          "bytes": 99506,
          "sha256": "6a16b69b93187244e0548cbfd25b3e4a6f9a7a2ad784625c3bec2b8d27b81aaa"
        },
        {
          "path": "wheelhouse/idna-3.20-py3-none-any.whl",
          "bytes": 69583,
          "sha256": "ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c"
        },
        {
          "path": "wheelhouse/importlib_metadata-9.0.1-py3-none-any.whl",
          "bytes": 27920,
          "sha256": "bba5600596a7e21f3eef53281cf28d6a5195634d2f2b78ff9501a3272c6eaab0"
        },
        {
          "path": "wheelhouse/jaconv-0.5.0-py3-none-any.whl",
          "bytes": 16831,
          "sha256": "2914114fe761ca49fc7089e25e6ad4a400c26f262ffce84e13b176916b71610a"
        },
        {
          "path": "wheelhouse/jinja2-3.1.6-py3-none-any.whl",
          "bytes": 134899,
          "sha256": "85ece4451f492d0c13c5dd7c13a64681a86afae63a5f347908daf103ce6d2f67"
        },
        {
          "path": "wheelhouse/joblib-1.6.0-py3-none-any.whl",
          "bytes": 306115,
          "sha256": "3dbbf9f6e4b592a2357b854608e980fe6390d131d7a82f011a377ef2ebef7aba"
        },
        {
          "path": "wheelhouse/lazy_loader-0.6-py3-none-any.whl",
          "bytes": 8791,
          "sha256": "77253be3391b06124a0e16105bd663b6c54470af1a9ca8e1cf026f38d58ed056"
        },
        {
          "path": "wheelhouse/librosa-0.11.0-py3-none-any.whl",
          "bytes": 260749,
          "sha256": "0b6415c4fd68bff4c29288abe67c6d80b587e0e1e2cfb0aad23e4559504a7fa1"
        },
        {
          "path": "wheelhouse/llvmlite-0.49.0-cp312-cp312-win_amd64.whl",
          "bytes": 41865543,
          "sha256": "3a9c9e3af4e214acfefa4f73ebe7bc3fb35854a62b654edb3953f5ae33c08ba3"
        },
        {
          "path": "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "bytes": 91687,
          "sha256": "9f7ebbcd14fe59494226453aed97c1070d83f8d24b6fc3a3bcf9a38092641c4a"
        },
        {
          "path": "wheelhouse/markupsafe-3.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 15105,
          "sha256": "26a5784ded40c9e318cfc2bdb30fe164bdb8665ded9cd64d500a34fb42067b1c"
        },
        {
          "path": "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "bytes": 9979,
          "sha256": "84008a41e51615a49fc9966191ff91509e3c40b939176e643fd50a5c2196b8f8"
        },
        {
          "path": "wheelhouse/ml_dtypes-0.5.4-cp312-cp312-win_amd64.whl",
          "bytes": 212222,
          "sha256": "c1a953995cccb9e25a4ae19e34316671e4e2edaebe4cf538229b1fc7109087b7"
        },
        {
          "path": "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "bytes": 536198,
          "sha256": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c"
        },
        {
          "path": "wheelhouse/msgpack-1.2.2-cp312-cp312-win_amd64.whl",
          "bytes": 72275,
          "sha256": "b68614fba0570349833b7dd999ff0aed4e5cc8d9eb6e3a7d4527be33c65e33d3"
        },
        {
          "path": "wheelhouse/narwhals-2.26.0-py3-none-any.whl",
          "bytes": 474034,
          "sha256": "29326d74f107c347fd1009bd58e38d9f7c7c5b51e6de97bc93dbc325d9038b54"
        },
        {
          "path": "wheelhouse/networkx-3.6.1-py3-none-any.whl",
          "bytes": 2068504,
          "sha256": "d47fbf302e7d9cbbb9e2555a0d267983d2aa476bac30e90dfbe5669bd57f3762"
        },
        {
          "path": "wheelhouse/nodeenv-1.11.0-py2.py3-none-any.whl",
          "bytes": 34277,
          "sha256": "edaa16e6c14d7cf395d75d4bbd5a26390f4dc06501a33b4e76282b02cc688a25"
        },
        {
          "path": "wheelhouse/numba-0.67.0-cp312-cp312-win_amd64.whl",
          "bytes": 2815645,
          "sha256": "50e2b72406c18cda5dd7431b0082cb85ea94e06c64c33607248fc8bef92cfb81"
        },
        {
          "path": "wheelhouse/numpy-1.26.4-cp312-cp312-win_amd64.whl",
          "bytes": 15517754,
          "sha256": "08beddf13648eb95f8d867350f6a018a4be2e5ad54c8d8caed89ebca558b2818"
        },
        {
          "path": "wheelhouse/omegaconf-2.3.1-py3-none-any.whl",
          "bytes": 79502,
          "sha256": "3d701d14e9a8828f1edd28bb70b725908b34277cdd72cf7d6a83f94dadc6b6a0"
        },
        {
          "path": "wheelhouse/onnx-1.23.0-cp312-abi3-win_amd64.whl",
          "bytes": 7872197,
          "sha256": "70a2f930b221f9dbdff62704838ce8bf81442787b25048f8b9cdc9118168799e"
        },
        {
          "path": "wheelhouse/packaging-26.3-py3-none-any.whl",
          "bytes": 129956,
          "sha256": "d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c"
        },
        {
          "path": "wheelhouse/pillow-12.3.0-cp312-cp312-win_amd64.whl",
          "bytes": 7227137,
          "sha256": "a2b55dd6b2a4c4b7d87ffa56bdb33fdc5fdb9a462173861a7bc097f17d91cb09"
        },
        {
          "path": "wheelhouse/platformdirs-4.12.0-py3-none-any.whl",
          "bytes": 32965,
          "sha256": "f6fb2960f2f2eb0870f820f7e49e49e6c0f0589c637f34d33b260b07591327c9"
        },
        {
          "path": "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "bytes": 67175,
          "sha256": "f265597baa9f760d25ceb29d0beb8186c243d6607b0f60b83ecf14078dbc703b"
        },
        {
          "path": "wheelhouse/pre_commit-4.6.2-py2.py3-none-any.whl",
          "bytes": 226202,
          "sha256": "e2dde9a75d3bce11bd3831c26d134df00a2803c1d818be6a0383c3dcda25dc4e"
        },
        {
          "path": "wheelhouse/protobuf-7.36.2-cp310-abi3-win_amd64.whl",
          "bytes": 456514,
          "sha256": "a300819d441e078a5608c0d3c709796bb548136058fda017ae51d425b44fd353"
        },
        {
          "path": "wheelhouse/pycparser-3.0-py3-none-any.whl",
          "bytes": 48172,
          "sha256": "b727414169a36b7d524c1c3e31839a521725078d7b2ff038656844266160a992"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-win_amd64.whl",
          "bytes": 2043140,
          "sha256": "5e81740c09e310f5aa5cbd3e434a01c154d4bef93241c7877b39f211d2b78ba8"
        },
        {
          "path": "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "bytes": 472589,
          "sha256": "346a034f080da3755d8e9cb5e00e8b07de1d39e4f6e2c87d8ab7cafa0b269a73"
        },
        {
          "path": "wheelhouse/pygments-2.21.0-py3-none-any.whl",
          "bytes": 1250147,
          "sha256": "2363c69b61c4a97c838da3b130dcd6468f4848992b21a82f2a63ec34377137d9"
        },
        {
          "path": "wheelhouse/pykakasi-2.3.0-py3-none-any.whl",
          "bytes": 2395003,
          "sha256": "26d21b090048ff45c6a4d8e962426b7951767216008ec30358e8a9d74af77f29"
        },
        {
          "path": "wheelhouse/pyloudnorm-0.2.0-py3-none-any.whl",
          "bytes": 10879,
          "sha256": "9bb69afb904f59d007a7f9ba3d75d16fb8aeef35c44d6df822a9f192d69cf13f"
        },
        {
          "path": "wheelhouse/python_discovery-1.6.1-py3-none-any.whl",
          "bytes": 38664,
          "sha256": "d43fcdef879fe795352bd13ccf8d185ba5a9f86f36cfcd00529f596e737442b3"
        },
        {
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 154003,
          "sha256": "5fcd34e47f6e0b794d17de1b4ff496c00986e1c83f7ab2fb8fcfe9616ff7477b"
        },
        {
          "path": "wheelhouse/regex-2026.9.10-cp312-cp312-win_amd64.whl",
          "bytes": 277933,
          "sha256": "4db7d00c4afbfbb55b8e17b1e371da11418ea9389b030acec63c1fa4c7ad4b86"
        },
        {
          "path": "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "bytes": 73075,
          "sha256": "2a0d60c172f83ac6ab31e4554906c0f3b3588d37b5cb939b1c061f4907e278e0"
        },
        {
          "path": "wheelhouse/resemble_perth-1.0.1-py3-none-any.whl",
          "bytes": 34404578,
          "sha256": "65e9c37531b1a128a4a56226b75dece4521683cf3611b0b2a5ffe234f00c9342"
        },
        {
          "path": "wheelhouse/rich-15.0.0-py3-none-any.whl",
          "bytes": 310654,
          "sha256": "33bd4ef74232fb73fe9279a257718407f169c09b78a87ad3d296f548e27de0bb"
        },
        {
          "path": "wheelhouse/s3tokenizer-0.3.0-py3-none-any.whl",
          "bytes": 226368,
          "sha256": "c9e93b1892a124a2c4d958ab53610a1b4433fcb4172056e2f2bd3c09cfe249a6"
        },
        {
          "path": "wheelhouse/safetensors-0.8.0-cp310-abi3-win_amd64.whl",
          "bytes": 355540,
          "sha256": "096ec1a98435df7beb08853bb5aa9081a84f23d0adc67ed1a0a10550f608373f"
        },
        {
          "path": "wheelhouse/scikit_learn-1.9.1-cp312-cp312-win_amd64.whl",
          "bytes": 8262238,
          "sha256": "4b59abb30618121cc46b45972d6bf53a7128b4df4cd346c6ca6f4d5f9031e49c"
        },
        {
          "path": "wheelhouse/scipy-1.17.1-cp312-cp312-win_amd64.whl",
          "bytes": 36549682,
          "sha256": "41b71f4a3a4cab9d366cd9065b288efc4d4f3c0b37a91a8e0947fb5bd7f31d87"
        },
        {
          "path": "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "bytes": 1201486,
          "sha256": "062d34222ad13e0cc312a4c02d73f059e86a4acbfbdea8f8f76b28c99f306922"
        },
        {
          "path": "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "bytes": 9755,
          "sha256": "7ecfff8f2fd72616f7481040475a65b2bf8af90a56c89140852d1120324e8686"
        },
        {
          "path": "wheelhouse/soundfile-0.14.0-py2.py3-none-win_amd64.whl",
          "bytes": 1021480,
          "sha256": "299491d3499460fb1b74bb4bd78b57ffc2d243a5fafa7b6ec1b264875c78453e"
        },
        {
          "path": "wheelhouse/soxr-1.1.0-cp312-abi3-win_amd64.whl",
          "bytes": 174357,
          "sha256": "6ae2a174bffea94e8ead857dad85999d3f49f091774dbad5b046c0417d7092f4"
        },
        {
          "path": "wheelhouse/spacy_pkuseg-1.0.1-cp312-cp312-win_amd64.whl",
          "bytes": 2401422,
          "sha256": "1de1f4fb62f730d72b5d80daf858783b8662e489539d7724b0c7766258860f87"
        },
        {
          "path": "wheelhouse/srsly-2.5.3-cp312-cp312-win_amd64.whl",
          "bytes": 652459,
          "sha256": "598f1e494c18cacb978299d77125415a586417081959f8ec3f068b32d97f8933"
        },
        {
          "path": "wheelhouse/starlette-1.6.0-py3-none-any.whl",
          "bytes": 75969,
          "sha256": "a86dd39d14bb45f85a3d18525215a9ef0cfd1f192ac793220e72598c90335f0c"
        },
        {
          "path": "wheelhouse/sympy-1.13.1-py3-none-any.whl",
          "bytes": 6189177,
          "sha256": "db36cdc64bf61b9b24578b6f7bab1ecdd2452cf008f34faa33776680c26d66f8"
        },
        {
          "path": "wheelhouse/threadpoolctl-3.7.0-py3-none-any.whl",
          "bytes": 26362,
          "sha256": "cd8b60b5641b45c67bbf73c64c843235fc2d8a480c87389f52f5dbee893b86be"
        },
        {
          "path": "wheelhouse/tokenizers-0.23.2-cp310-abi3-win_amd64.whl",
          "bytes": 2863236,
          "sha256": "2e96f5699d5249c9c64aa8412e044f727aae3a4098cf830f9901ec1afc361cde"
        },
        {
          "path": "wheelhouse/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl",
          "bytes": 2532302369,
          "sha256": "3313061c1fec4c7310cf47944e84513dcd27b6173b72a349bb7ca68d0ee6e9c0"
        },
        {
          "path": "wheelhouse/torchaudio-2.6.0+cu124-cp312-cp312-win_amd64.whl",
          "bytes": 4157942,
          "sha256": "004ff6bcee0ac78747253c09db67d281add4308a9b87a7bf1769da5914998639"
        },
        {
          "path": "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "bytes": 80199,
          "sha256": "c293e525e6fef9c20e8728fd4612df02a0aa31bb5fe91ecd93e123b1b7bffa73"
        },
        {
          "path": "wheelhouse/transformers-5.17.0-py3-none-any.whl",
          "bytes": 12295140,
          "sha256": "78ec1ce21579b38dfb83950a0658cd119f87212a2fcfdff478096ce9d6c03801"
        },
        {
          "path": "wheelhouse/typer-0.27.2-py3-none-any.whl",
          "bytes": 123130,
          "sha256": "b3a5fc4342d5fc8fda8fc3010b1cf117e9249aab7fae800c2eff62fd3842d97d"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.4-py3-none-any.whl",
          "bytes": 14750,
          "sha256": "65b8397ba37ccbce054456aaccddfc91e6e3083c92824df348d96ca832f3f147"
        },
        {
          "path": "wheelhouse/urllib3-2.8.0-py3-none-any.whl",
          "bytes": 135717,
          "sha256": "0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3"
        },
        {
          "path": "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "bytes": 79871,
          "sha256": "f86e41a149d7d05a9969337e3946a9c171c06a5d42680896daaba624aeac8da1"
        },
        {
          "path": "wheelhouse/virtualenv-21.13.0-py3-none-any.whl",
          "bytes": 5486498,
          "sha256": "ca16ceba89e58d8e2f376769349c63f3ed66f79881ae68bc13e19a9d50e0e987"
        },
        {
          "path": "wheelhouse/wrapt-2.5.0-cp312-cp312-win_amd64.whl",
          "bytes": 105786,
          "sha256": "ab45839c912777e2738fed369636589c8b2a6d9c44ca56de0fd0814581d467c2"
        },
        {
          "path": "wheelhouse/zipp-4.1.0-py3-none-any.whl",
          "bytes": 10238,
          "sha256": "25ad4e16390cd314347dd8f1de67a2ac538ae658ed4ab9db16029c07c188e97f"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/python.exe",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "88ff95c2eca8f062d202d3b554e3d2a338d4012957ab0bf4d9207c1bc870b4e9",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "MIT",
        "url": "https://opensource.org/license/mit/"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/chatterbox-cuda-1.0.0-py312-cu1241.spdx.json",
        "sha256": "e3871e79cdb4b8f1149974d75d7b109d964f3348fc9ec63cb814665192cf6180"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "oFRpClzOa+WUMR2oh9KLKkJDYKIVz4HsM/rz0y1UFcPqiaRuQVjK9mcvtOxggwk6ianZx5gd0mZeVXbkoA4EDg=="
    },
    {
      "protocolVersion": 1,
      "id": "douyin-archive",
      "moduleId": "douyin-archive",
      "groupId": "archive",
      "displayName": "抖音公开内容归档（匿名）",
      "purpose": "启用应用内固定版本的抖音匿名作品适配器；复用已签名 Chromium 资产，但不读取小红书或系统浏览器登录资料。",
      "dependencyIds": [
        "xhs-browser"
      ],
      "taskToolIds": [
        "xhs-archive"
      ],
      "installConditions": [
        "先安装受管 Chromium 能力（历史 ID 为 xhs-browser），不重复打包浏览器或安装 Python。",
        "仅获取匿名可访问的公开作品；登录要求、验证码和平台限流不会被绕过。",
        "卸载只移除能力包，保留历史归档、媒体、译文和截帧。"
      ],
      "version": "1.0.0-anonymous-27468de",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/douyin-archive-1.0.0-anonymous-27468de.tar.gz",
        "bytes": 280,
        "sha256": "de426bd977e51eba0cb99254173fee1d941faa6db07de95545c677777ab67c0f",
        "format": "tar.gz"
      },
      "installedBytes": 4096,
      "files": [
        {
          "path": "adapter/manifest.json",
          "bytes": 308,
          "sha256": "99c16bc3197e2f3911995f5a02c226ed961e39d74e0e4a501b6af95e33b33ff7"
        }
      ],
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/douyin-archive-1.0.0-anonymous-27468de.spdx.json",
        "sha256": "9ddd01dfeead2aaf4712c6d025b7a68afd3debced5d401913151f2fffe56c6dd"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "ZQkoH+JLF95YrTQk21jAG7q5OWgbC1tpLbYd9PcE0Ias/d1XNQENmzUWIUm7pbQhpHxpNxfFGgtjIQBwtoQ0Bw=="
    },
    {
      "protocolVersion": 1,
      "id": "edge-tts",
      "moduleId": "edge-tts",
      "groupId": "audio",
      "displayName": "在线自然配音（Edge-TTS）",
      "purpose": "使用 Microsoft Edge 在线语音服务生成配音；需要联网，语音服务本身不随应用分发。",
      "dependencyIds": [
        "python-312",
        "ffmpeg"
      ],
      "taskToolIds": [
        "edge-tts"
      ],
      "installConditions": [
        "安装前需有 Python 3.12 共享运行时；生成语音需要联网；批次音频合并需要 FFmpeg 能力。"
      ],
      "version": "7.3.1-py312-1",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/edge-tts-7.3.1-py312-1.tar.gz",
        "bytes": 1131429,
        "sha256": "0cc9b16d83c2e9c83d54a341b6b329729b8a7c76c94f81c1c0a2e633fb9e4180",
        "format": "tar.gz"
      },
      "installedBytes": 180000000,
      "files": [
        {
          "path": "requirements.lock",
          "bytes": 57422,
          "sha256": "4b2b332a73289d0f618b83042474d68a2313c6b6c0fe49202b508f8c386e8fcb"
        },
        {
          "path": "scripts/edge-tts-generate.py",
          "bytes": 7037,
          "sha256": "51c5d0adaaffd96affd120aeb0cba176e9584cfcca8bf9c0d1de3efd8ec61dc7"
        },
        {
          "path": "wheelhouse/aiohappyeyeballs-2.7.1-py3-none-any.whl",
          "bytes": 15038,
          "sha256": "9243213661e29250eb41368e5daa826fc017156c3b8a11440826b2e3ed376472"
        },
        {
          "path": "wheelhouse/aiohttp-3.14.3-cp312-cp312-win_amd64.whl",
          "bytes": 476845,
          "sha256": "33a2d7c28d33797a2e99923dffa63f83d908a19b6bf26cfe80fa790aa5e1a75a"
        },
        {
          "path": "wheelhouse/aiosignal-1.4.0-py3-none-any.whl",
          "bytes": 7490,
          "sha256": "053243f8b92b990551949e63930a839ff0cf0b0ebbe0597b0f3fb19e1a0fe82e"
        },
        {
          "path": "wheelhouse/attrs-26.1.0-py3-none-any.whl",
          "bytes": 67548,
          "sha256": "c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309"
        },
        {
          "path": "wheelhouse/certifi-2026.7.22-py3-none-any.whl",
          "bytes": 136983,
          "sha256": "62f22742b58a1a33014a2b6b706588a8d7e2a88ae7bd1a6ebe8c992928483775"
        },
        {
          "path": "wheelhouse/edge_tts-7.3.1-py3-none-any.whl",
          "bytes": 38908,
          "sha256": "2a3c79d6235a7a736d681233823ce5492e829b43eb47beae49aa181237a8f9a4"
        },
        {
          "path": "wheelhouse/frozenlist-1.8.0-cp312-cp312-win_amd64.whl",
          "bytes": 44591,
          "sha256": "34187385b08f866104f0c0617404c8eb08165ab1272e884abc89c112e9c00746"
        },
        {
          "path": "wheelhouse/idna-3.19-py3-none-any.whl",
          "bytes": 68550,
          "sha256": "815e7be7a7806d54abb586dc943addc79e8b2ee16915059658cbeff4b1b43bf4"
        },
        {
          "path": "wheelhouse/multidict-6.8.0-cp312-cp312-win_amd64.whl",
          "bytes": 51723,
          "sha256": "7d26dc8f070c0ec5579e987fa615ffd6883086106eefdff9e10d160fc5630630"
        },
        {
          "path": "wheelhouse/propcache-0.5.2-cp312-cp312-win_amd64.whl",
          "bytes": 42322,
          "sha256": "d9ee8826a7d47863a08ac44e1a5f611a462eefc3a194b492da242128bec75b42"
        },
        {
          "path": "wheelhouse/tabulate-0.10.0-py3-none-any.whl",
          "bytes": 39814,
          "sha256": "f0b0622e567335c8fabaaa659f1b33bcb6ddfe2e496071b743aa113f8774f2d3"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/yarl-1.24.5-cp312-cp312-win_amd64.whl",
          "bytes": 97618,
          "sha256": "a929d878fec099030c292803b31e5d5540a7b6a31e6a3cc76cb4685fc2a2f51b"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/python.exe",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "4b2b332a73289d0f618b83042474d68a2313c6b6c0fe49202b508f8c386e8fcb",
        "expectedPythonVersion": "3.12"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/edge-tts-7.3.1-py312-1.spdx.json",
        "sha256": "7cf121a948137a176f0747ea669dea3ebd050f7df5cd076e0136fc8cb7f3c7d9"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "IgmxYGE9qTV/0Db6PeBGxgg09XG9exguQXoXqa/X5/D+FO4KHciGxIjYFZIoUEk8f//8CeHqWr/vegYVsJgkAA=="
    },
    {
      "protocolVersion": 1,
      "id": "ffmpeg",
      "moduleId": "ffmpeg",
      "groupId": "shared",
      "displayName": "FFmpeg（共享媒体运行时）",
      "purpose": "为视频解析和参考音色能力提供 ffmpeg、ffprobe 及其运行时 DLL。",
      "dependencyIds": [],
      "taskToolIds": [],
      "installConditions": [
        "安装使用媒体处理的能力时需要；安装后可由多个能力共享。"
      ],
      "version": "8.1.2",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/ffmpeg-8.1.2.tar.gz",
        "bytes": 102795156,
        "sha256": "504dbff58072a927e22b2f54e097394406c0a0deb311ea62e5e733f89314b86a",
        "format": "tar.gz"
      },
      "installedBytes": 300000000,
      "files": [
        {
          "path": "bin/avcodec-62.dll",
          "bytes": 97454080,
          "sha256": "34f5b1baac01c4be3edf464309c79db05ffbd4a9c905c94b4a4651cd15370296"
        },
        {
          "path": "bin/avdevice-62.dll",
          "bytes": 6323200,
          "sha256": "d213d6cad9f3a526f7664ebb3f93d6882669540db7164daecd03f52e0f5288cc"
        },
        {
          "path": "bin/avfilter-11.dll",
          "bytes": 124344320,
          "sha256": "e318cac83d648869180d0b57c45f21aad1e4db34a467000c157da2938ff7f63f"
        },
        {
          "path": "bin/avformat-62.dll",
          "bytes": 20179968,
          "sha256": "c04e6ed2f9f36d42325d4f4df5babb5d6ce7c55dbffeb7ef1007e25e97bcb716"
        },
        {
          "path": "bin/avutil-60.dll",
          "bytes": 3148288,
          "sha256": "6f172b5d10224fcc3f729c8baa6fd36a97bb58042bb3b1417078d77d2da59b87"
        },
        {
          "path": "bin/ffmpeg.exe",
          "bytes": 630784,
          "sha256": "9be30133edcc5786f16e632d57e2dab5b259fea9a5243ba99758ca3adc110bd9"
        },
        {
          "path": "bin/ffprobe.exe",
          "bytes": 228864,
          "sha256": "8fd54d7fc602ec180d023a5396f9d45d1a3d6f43a4c18d3217a1f0e306885fc9"
        },
        {
          "path": "bin/swresample-6.dll",
          "bytes": 486912,
          "sha256": "72e2721672c11fd37d983b05cc2370f612784e4e3218362a0cb4315d08c917fb"
        },
        {
          "path": "bin/swscale-9.dll",
          "bytes": 12748288,
          "sha256": "3d07972cada6ba38c492e92b0f6c025a6835607fe00cdf83afc604c2fbdfe550"
        },
        {
          "path": "LICENSE.txt",
          "bytes": 35147,
          "sha256": "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903"
        },
        {
          "path": "SOURCE.json",
          "bytes": 1625,
          "sha256": "9b3a6accaad409b530bbab6de0dcf83a2fe147435cea62542903d3486e743240"
        }
      ],
      "license": {
        "name": "GPL-3.0",
        "url": "https://www.gnu.org/licenses/gpl-3.0.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/ffmpeg-8.1.2.spdx.json",
        "sha256": "8a07ce2de12b676ab658710dc982d6576c33ada53165b8983eb38a498efe8ccc"
      },
      "keyId": "ed25519-80154152cb788d65d9e6b661",
      "signature": "owYB+AWg1CkU1yI6RLoKFXK39kt+KbwKS1pf4jtUjhMGcU+6nzKbg/WVr/j547J2FMbogWEkLhj7EWwtH9byDg=="
    },
    {
      "protocolVersion": 1,
      "id": "image-ai",
      "moduleId": "image-ai",
      "groupId": "image",
      "displayName": "AI 图片处理（CPU）",
      "purpose": "使用本地 CPU 模型进行水印修复、图片增强、背景移除和文字识别；首次安装需要下载固定版本的运行时与模型。",
      "dependencyIds": [
        "python-312"
      ],
      "taskToolIds": [
        "image-ai"
      ],
      "installConditions": [
        "安装过程建议预留约 7 GB 可用磁盘空间，安装后约占 4.9 GB；建议至少 8 GB 内存。此版本使用 CPU，不要求 CUDA。",
        "水印智能提示使用固定版本 PP-OCRv5 中文检测与识别模型；所有模型均随能力包离线安装，不在处理过程中下载。"
      ],
      "version": "1.0.0-py312-cpu1",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/image-ai-1.0.0-py312-cpu1.tar.gz",
        "bytes": 1806180251,
        "sha256": "b87cc998805e5dde0db7831ccf7fb735a9957369758f994473ab972ffb485f1e",
        "format": "tar.gz"
      },
      "installedBytes": 5200000000,
      "files": [
        {
          "path": "models/image-ai/ocr/detection/inference.json",
          "bytes": 229777,
          "sha256": "05feef1acb00aa4cd7362b15f7f501fc4f99d7b1fa73c1c871e0c7b1504b0f5c"
        },
        {
          "path": "models/image-ai/ocr/detection/inference.pdiparams",
          "bytes": 4692937,
          "sha256": "afa1820cb16c1fd0dad589d0f8b389139061c1ef6d68019685fd07be997dda5b"
        },
        {
          "path": "models/image-ai/ocr/detection/inference.yml",
          "bytes": 903,
          "sha256": "98069072e1b6b37d727fd9d9f11725faa46d6ea0de012f2ed26caea011c37699"
        },
        {
          "path": "models/image-ai/ocr/recognition/inference.json",
          "bytes": 217724,
          "sha256": "24587345250c7332d0fc6f9a44e794d078cdaeb64c302fef906f325619de2569"
        },
        {
          "path": "models/image-ai/ocr/recognition/inference.pdiparams",
          "bytes": 16458665,
          "sha256": "2460da90875937c94db97eba74ae3d9e5d4c4c57c42f1f41531c09a26bcc771a"
        },
        {
          "path": "models/image-ai/ocr/recognition/inference.yml",
          "bytes": 148345,
          "sha256": "5dfeb2777f6d0db8177d8128a8acfcf6e6276dc4ac73ea3bf0dc06d6a5e85d8e"
        },
        {
          "path": "models/image-ai/RealESRGAN_x2plus.pth",
          "bytes": 67061725,
          "sha256": "49fafd45f8fd7aa8d31ab2a22d14d91b536c34494a5cfe31eb5d89c2fa266abb"
        },
        {
          "path": "models/image-ai/RealESRGAN_x4plus.pth",
          "bytes": 67040989,
          "sha256": "4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1"
        },
        {
          "path": "models/image-ai/rembg/models/birefnet-general/birefnet-general.onnx",
          "bytes": 972666916,
          "sha256": "58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c"
        },
        {
          "path": "models/image-ai/torch/hub/checkpoints/big-lama.pt",
          "bytes": 205803670,
          "sha256": "7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c"
        },
        {
          "path": "requirements.lock",
          "bytes": 286155,
          "sha256": "080bff46e678bf9e9f41ce2adceb18ad87b951ed5c8610b4ab7efb2e796dab18"
        },
        {
          "path": "scripts/image-ai-worker.py",
          "bytes": 36906,
          "sha256": "9fe77c3edeca9558ad573964fba91130b135db8484d5648f0f87ff7364176c31"
        },
        {
          "path": "wheelhouse/absl_py-2.5.0-py3-none-any.whl",
          "bytes": 137410,
          "sha256": "0f17b89f2a4eaaedc4f28c622998aa690564b3012a396a4ffad0821007fe03ba"
        },
        {
          "path": "wheelhouse/addict-2.4.0-py3-none-any.whl",
          "bytes": 3832,
          "sha256": "249bb56bbfd3cdc2a004ea0ff4c2b6ddc84d53bc2194761636eb314d5cfa5dfc"
        },
        {
          "path": "wheelhouse/aiohappyeyeballs-2.7.1-py3-none-any.whl",
          "bytes": 15038,
          "sha256": "9243213661e29250eb41368e5daa826fc017156c3b8a11440826b2e3ed376472"
        },
        {
          "path": "wheelhouse/aiohttp-3.14.3-cp312-cp312-win_amd64.whl",
          "bytes": 476845,
          "sha256": "33a2d7c28d33797a2e99923dffa63f83d908a19b6bf26cfe80fa790aa5e1a75a"
        },
        {
          "path": "wheelhouse/aiosignal-1.4.0-py3-none-any.whl",
          "bytes": 7490,
          "sha256": "053243f8b92b990551949e63930a839ff0cf0b0ebbe0597b0f3fb19e1a0fe82e"
        },
        {
          "path": "wheelhouse/aistudio_sdk-0.3.9-py3-none-any.whl",
          "bytes": 67186,
          "sha256": "41621d052ddb7a58643438a7ca541f58ef0ab94a2acdfff0a71db81bf68dc027"
        },
        {
          "path": "wheelhouse/annotated_doc-0.0.5-py3-none-any.whl",
          "bytes": 5302,
          "sha256": "117bac03a25ede5df5440e855b32d556049ca169ead221505badf432fed4b101"
        },
        {
          "path": "wheelhouse/annotated_types-0.8.0-py3-none-any.whl",
          "bytes": 13427,
          "sha256": "f072f4d804ea359e4eaf198b1af7a8b0943881a87f31bb764f8bf219bb9419e0"
        },
        {
          "path": "wheelhouse/anyio-4.15.1-py3-none-any.whl",
          "bytes": 132079,
          "sha256": "6152fdbbf9a77fdec97731721bebf7c4c44f7c29b424b0065826173efc7ed101"
        },
        {
          "path": "wheelhouse/attrs-26.1.0-py3-none-any.whl",
          "bytes": 67548,
          "sha256": "c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309"
        },
        {
          "path": "wheelhouse/basicsr-1.4.2.tar.gz",
          "bytes": 172524,
          "sha256": "b89b595a87ef964cda9913b4d99380ddb6554c965577c0c10cb7b78e31301e87"
        },
        {
          "path": "wheelhouse/bce_python_sdk-0.9.79-py3-none-any.whl",
          "bytes": 440268,
          "sha256": "71799ac8740505e0759d30873f6f1a478fa8f83aedf425d511f1419a5f30082e"
        },
        {
          "path": "wheelhouse/certifi-2026.7.22-py3-none-any.whl",
          "bytes": 136983,
          "sha256": "62f22742b58a1a33014a2b6b706588a8d7e2a88ae7bd1a6ebe8c992928483775"
        },
        {
          "path": "wheelhouse/cffi-2.1.1-cp312-cp312-win_amd64.whl",
          "bytes": 185919,
          "sha256": "f53e442b08449d42821fa4a4fba000095af9f62742a500f978a9f557ec44339a"
        },
        {
          "path": "wheelhouse/chardet-7.6.0-cp312-cp312-win_amd64.whl",
          "bytes": 1160778,
          "sha256": "406936df1328a3284fef366eaa2bfd1cccd0ef1b10cb99781dd5b022ea644b84"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.5.1-cp312-cp312-win_amd64.whl",
          "bytes": 200551,
          "sha256": "3617ac3cfd8b9888f145ad89dd6e692285834b0201c6074a5eeaad3fd4d668c2"
        },
        {
          "path": "wheelhouse/click-8.5.0-py3-none-any.whl",
          "bytes": 125251,
          "sha256": "255bc9599cf7748b4b1a446ccc735421bd08a2ae529a8b88597d3de5664ee360"
        },
        {
          "path": "wheelhouse/colorama-0.4.6-py2.py3-none-any.whl",
          "bytes": 25335,
          "sha256": "4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6"
        },
        {
          "path": "wheelhouse/colorlog-6.12.0-py3-none-any.whl",
          "bytes": 12239,
          "sha256": "30d392604e9110045a2c2aeefc27d7a017abbab63f3a8aee594eac0801df784e"
        },
        {
          "path": "wheelhouse/contourpy-1.3.2-cp312-cp312-win_amd64.whl",
          "bytes": 223042,
          "sha256": "8c942a01d9163e2e5cfb05cb66110121b8d07ad438a17f9e766317bcb62abf73"
        },
        {
          "path": "wheelhouse/crc32c-2.9.post0-cp312-cp312-win_amd64.whl",
          "bytes": 65911,
          "sha256": "0284bc548f361d9c66f6e844f2ec6e7a92b86f39ff0fd292a45878c160391230"
        },
        {
          "path": "wheelhouse/cryptography-50.0.1-cp311-abi3-win_amd64.whl",
          "bytes": 3842826,
          "sha256": "aed8db4f6d71c51efb89530e12d9464e7bf2923d46c3205dc794a2a93f8c0648"
        },
        {
          "path": "wheelhouse/cycler-0.12.1-py3-none-any.whl",
          "bytes": 8321,
          "sha256": "85cef7cff222d8644161529808465972e51340599459b8ac3ccbac5a854e0d30"
        },
        {
          "path": "wheelhouse/cython-3.1.3-cp312-cp312-win_amd64.whl",
          "bytes": 2704002,
          "sha256": "dc4ca0f4dec55124cd79ddcfc555be1cbe0092cc99bcf1403621d17b9c6218bb"
        },
        {
          "path": "wheelhouse/facexlib-0.3.0-py3-none-any.whl",
          "bytes": 59624,
          "sha256": "245d58861537b820c616e8b3ef618ccfad2a24724a2d74be2b0542643c01a878"
        },
        {
          "path": "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "bytes": 131954,
          "sha256": "bfb91aa2d334c61cb35ba9a116fc123b3d3df31640b801cf57a7a78ec3f603b3"
        },
        {
          "path": "wheelhouse/filelock-3.32.6-py3-none-any.whl",
          "bytes": 100189,
          "sha256": "3f16ecd0117feae0dfc147e8c62eb5daeccd8bd800378c3ddf416de9b4feb6b1"
        },
        {
          "path": "wheelhouse/filterpy-1.4.5.zip",
          "bytes": 177985,
          "sha256": "4f2a4d39e4ea601b9ab42b2db08b5918a9538c168cff1c6895ae26646f3d73b1"
        },
        {
          "path": "wheelhouse/flatbuffers-25.12.19-py2.py3-none-any.whl",
          "bytes": 26661,
          "sha256": "7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4"
        },
        {
          "path": "wheelhouse/fonttools-4.65.0-cp312-cp312-win_amd64.whl",
          "bytes": 2483475,
          "sha256": "3b5d9ba89edf778b376e669b879ae33a198bf45cf5a23c3f6514f935cf9d0d9d"
        },
        {
          "path": "wheelhouse/frozenlist-1.8.0-cp312-cp312-win_amd64.whl",
          "bytes": 44591,
          "sha256": "34187385b08f866104f0c0617404c8eb08165ab1272e884abc89c112e9c00746"
        },
        {
          "path": "wheelhouse/fsspec-2026.7.0-py3-none-any.whl",
          "bytes": 206583,
          "sha256": "b57ddbafedfaef7018c1ecab32aa200a9d7ca26b77965f64e48b70061249d279"
        },
        {
          "path": "wheelhouse/future-1.0.0-py3-none-any.whl",
          "bytes": 491326,
          "sha256": "929292d34f5872e70396626ef385ec22355a1fae8ad29e1a734c3e43f9fbc216"
        },
        {
          "path": "wheelhouse/gfpgan-1.3.8-py3-none-any.whl",
          "bytes": 52176,
          "sha256": "3d8386df6320aa9dfb0dd4cd09d9f8ed12ae0bbd9b2df257c3d21aefac5d8b85"
        },
        {
          "path": "wheelhouse/grpcio-1.83.1-cp312-cp312-win_amd64.whl",
          "bytes": 5161512,
          "sha256": "583bf2e8255040a4a312f9572dfe62a05271437b149550e1a536d5c47d2d1e8a"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/hf_xet-1.6.0-cp38-abi3-win_amd64.whl",
          "bytes": 4033128,
          "sha256": "fb4fadde1b2b70bf4c0c14a6dccbe7194b1c28947fefd5bbe3fed9d940676c3b"
        },
        {
          "path": "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "bytes": 78784,
          "sha256": "2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"
        },
        {
          "path": "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "bytes": 73517,
          "sha256": "d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"
        },
        {
          "path": "wheelhouse/huggingface_hub-1.31.0-py3-none-any.whl",
          "bytes": 798313,
          "sha256": "9dbb6a503cbe2494ea666695207e7262d410659e09134059deb83e5480864667"
        },
        {
          "path": "wheelhouse/idna-3.19-py3-none-any.whl",
          "bytes": 68550,
          "sha256": "815e7be7a7806d54abb586dc943addc79e8b2ee16915059658cbeff4b1b43bf4"
        },
        {
          "path": "wheelhouse/imageio-2.37.4-py3-none-any.whl",
          "bytes": 318000,
          "sha256": "1ab2e22c8debf700f24c3ac43e8f95f3b3a8110c83b93411e97b4b0b2cd1c7e6"
        },
        {
          "path": "wheelhouse/imagesize-2.0.1-py3-none-any.whl",
          "bytes": 14794,
          "sha256": "ea0c9a0384df69ed86a943a15cde37d0360b82491b3910dc2215e202e62b5b02"
        },
        {
          "path": "wheelhouse/jinja2-3.1.6-py3-none-any.whl",
          "bytes": 134899,
          "sha256": "85ece4451f492d0c13c5dd7c13a64681a86afae63a5f347908daf103ce6d2f67"
        },
        {
          "path": "wheelhouse/jsonschema_specifications-2025.9.1-py3-none-any.whl",
          "bytes": 18437,
          "sha256": "98802fee3a11ee76ecaca44429fda8a41bff98b00a0f2838151b113f210cc6fe"
        },
        {
          "path": "wheelhouse/jsonschema-4.26.0-py3-none-any.whl",
          "bytes": 90630,
          "sha256": "d489f15263b8d200f8387e64b4c3a75f06629559fb73deb8fdfb525f2dab50ce"
        },
        {
          "path": "wheelhouse/kiwisolver-1.5.1-cp312-cp312-win_amd64.whl",
          "bytes": 70748,
          "sha256": "06a6917674de9e0fe3f66f5430787f59a9f2ddb64af9b714eaec547e29ef5c19"
        },
        {
          "path": "wheelhouse/lazy_loader-0.5-py3-none-any.whl",
          "bytes": 8044,
          "sha256": "ab0ea149e9c554d4ffeeb21105ac60bed7f3b4fd69b1d2360a4add51b170b005"
        },
        {
          "path": "wheelhouse/llvmlite-0.49.0-cp312-cp312-win_amd64.whl",
          "bytes": 41865543,
          "sha256": "3a9c9e3af4e214acfefa4f73ebe7bc3fb35854a62b654edb3953f5ae33c08ba3"
        },
        {
          "path": "wheelhouse/lmdb-2.3.0-cp312-cp312-win_amd64.whl",
          "bytes": 115188,
          "sha256": "131ea41c72e387715141cbf240648337f59b717c0a01655f6fd78315fea60afe"
        },
        {
          "path": "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "bytes": 91687,
          "sha256": "9f7ebbcd14fe59494226453aed97c1070d83f8d24b6fc3a3bcf9a38092641c4a"
        },
        {
          "path": "wheelhouse/markdown-3.10.3-py3-none-any.whl",
          "bytes": 110757,
          "sha256": "fa6c92a00a4a3c98b22728c64a935ae1928250ae65058a6ded814d2cc29a4cea"
        },
        {
          "path": "wheelhouse/markupsafe-3.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 15105,
          "sha256": "26a5784ded40c9e318cfc2bdb30fe164bdb8665ded9cd64d500a34fb42067b1c"
        },
        {
          "path": "wheelhouse/matplotlib-3.10.9-cp312-cp312-win_amd64.whl",
          "bytes": 8217462,
          "sha256": "d091f9d758b34aaaaa6331d13574bf01891d903b3dec59bfff458ef7551de5d6"
        },
        {
          "path": "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "bytes": 9979,
          "sha256": "84008a41e51615a49fc9966191ff91509e3c40b939176e643fd50a5c2196b8f8"
        },
        {
          "path": "wheelhouse/modelscope_hub-0.4.2-py3-none-any.whl",
          "bytes": 201255,
          "sha256": "ddf47b859ae812738850f53c3cc7a935df5cf5ee58c4678cf4fbeefe3d203f43"
        },
        {
          "path": "wheelhouse/modelscope-1.40.0-py3-none-any.whl",
          "bytes": 6038122,
          "sha256": "2b1d7076bc7eac19f8ac32d4467d021649e374c968f3a42cc36c699da5aae075"
        },
        {
          "path": "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "bytes": 536198,
          "sha256": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c"
        },
        {
          "path": "wheelhouse/multidict-6.8.0-cp312-cp312-win_amd64.whl",
          "bytes": 51723,
          "sha256": "7d26dc8f070c0ec5579e987fa615ffd6883086106eefdff9e10d160fc5630630"
        },
        {
          "path": "wheelhouse/networkx-3.6.1-py3-none-any.whl",
          "bytes": 2068504,
          "sha256": "d47fbf302e7d9cbbb9e2555a0d267983d2aa476bac30e90dfbe5669bd57f3762"
        },
        {
          "path": "wheelhouse/numba-0.67.0-cp312-cp312-win_amd64.whl",
          "bytes": 2815645,
          "sha256": "50e2b72406c18cda5dd7431b0082cb85ea94e06c64c33607248fc8bef92cfb81"
        },
        {
          "path": "wheelhouse/numpy-2.3.5-cp312-cp312-win_amd64.whl",
          "bytes": 12782922,
          "sha256": "86945f2ee6d10cdfd67bcb4069c1662dd711f7e2a4343db5cecec06b87cf31aa"
        },
        {
          "path": "wheelhouse/onnxruntime-1.30.0-cp312-cp312-win_amd64.whl",
          "bytes": 14311470,
          "sha256": "f3501472571f1b1eee50e017851e7929f5ea37312d2d8c2494a19e8fc58b4a38"
        },
        {
          "path": "wheelhouse/opencv_contrib_python-4.10.0.84-cp37-abi3-win_amd64.whl",
          "bytes": 45541421,
          "sha256": "47ec3160dae75f70e099b286d1a2e086d20dac8b06e759f60eaf867e6bdecba7"
        },
        {
          "path": "wheelhouse/opencv_python_headless-4.11.0.86-cp37-abi3-win_amd64.whl",
          "bytes": 39402386,
          "sha256": "6c304df9caa7a6a5710b91709dd4786bf20a74d57672b3c31f7033cc638174ca"
        },
        {
          "path": "wheelhouse/opencv_python-4.11.0.86-cp37-abi3-win_amd64.whl",
          "bytes": 39488044,
          "sha256": "085ad9b77c18853ea66283e98affefe2de8cc4c1f43eda4c100cf9b2721142ec"
        },
        {
          "path": "wheelhouse/opt_einsum-3.3.0-py3-none-any.whl",
          "bytes": 65486,
          "sha256": "2455e59e3947d3c275477df7f5205b30635e266fe6dc300e3d9f9646bfcea147"
        },
        {
          "path": "wheelhouse/packaging-24.2-py3-none-any.whl",
          "bytes": 65451,
          "sha256": "09abb1bccd265c01f4a3aa3f7a7db064b36514d2cba19a2f694fe6150451a759"
        },
        {
          "path": "wheelhouse/paddleocr-3.7.0-py3-none-any.whl",
          "bytes": 146750,
          "sha256": "c0f0a81ad4112727f30c6fcf986ac0ef6a120d31ee0991a01fae0357ee32d338"
        },
        {
          "path": "wheelhouse/paddlepaddle-3.3.1-cp312-cp312-win_amd64.whl",
          "bytes": 104794793,
          "sha256": "324b5122cf3887dfbd15db17f36e2421ef923fd4569d26111bf1a21fe84d442b"
        },
        {
          "path": "wheelhouse/paddlex-3.7.2-py3-none-any.whl",
          "bytes": 2239708,
          "sha256": "f1678bf650bbaccfd8f0d4e49d0ae631b4685c829fdae6e802ccd90d4fcb9a7f"
        },
        {
          "path": "wheelhouse/pandas-2.2.3-cp312-cp312-win_amd64.whl",
          "bytes": 11504248,
          "sha256": "59ef3764d0fe818125a5097d2ae867ca3fa64df032331b7e0917cf5d7bf66b13"
        },
        {
          "path": "wheelhouse/pillow-12.3.0-cp312-cp312-win_amd64.whl",
          "bytes": 7227137,
          "sha256": "a2b55dd6b2a4c4b7d87ffa56bdb33fdc5fdb9a462173861a7bc097f17d91cb09"
        },
        {
          "path": "wheelhouse/platformdirs-4.11.8-py3-none-any.whl",
          "bytes": 24027,
          "sha256": "52f2f181bbfde907966932cc8312d967d02976422d66d537ea16092b8e291081"
        },
        {
          "path": "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "bytes": 67175,
          "sha256": "f265597baa9f760d25ceb29d0beb8186c243d6607b0f60b83ecf14078dbc703b"
        },
        {
          "path": "wheelhouse/prettytable-3.18.0-py3-none-any.whl",
          "bytes": 37357,
          "sha256": "b3346e0e6f79180833aebaac088ae926340586cf6d7d991b9eb125b65f72313a"
        },
        {
          "path": "wheelhouse/propcache-0.5.2-cp312-cp312-win_amd64.whl",
          "bytes": 42322,
          "sha256": "d9ee8826a7d47863a08ac44e1a5f611a462eefc3a194b492da242128bec75b42"
        },
        {
          "path": "wheelhouse/protobuf-7.36.1-cp310-abi3-win_amd64.whl",
          "bytes": 456518,
          "sha256": "51139351435d9b43d88a55eaa49fb6f737fbb478fb0cbf2cf694d1a04a9d3363"
        },
        {
          "path": "wheelhouse/psutil-7.2.2-cp37-abi3-win_amd64.whl",
          "bytes": 137737,
          "sha256": "eb7e81434c8d223ec4a219b5fc1c47d0417b12be7ea866e24fb5ad6e84b3d988"
        },
        {
          "path": "wheelhouse/py_cpuinfo-9.0.0-py3-none-any.whl",
          "bytes": 22335,
          "sha256": "859625bc251f64e21f077d099d4162689c762b5d6a4c3c97553d56241c9674d5"
        },
        {
          "path": "wheelhouse/pyclipper-1.4.0-cp312-cp312-win_amd64.whl",
          "bytes": 104619,
          "sha256": "d1e5498d883b706a4ce636247f0d830c6eb34a25b843a1b78e2c969754ca9037"
        },
        {
          "path": "wheelhouse/pycparser-3.0-py3-none-any.whl",
          "bytes": 48172,
          "sha256": "b727414169a36b7d524c1c3e31839a521725078d7b2ff038656844266160a992"
        },
        {
          "path": "wheelhouse/pycryptodome-3.23.0-cp37-abi3-win_amd64.whl",
          "bytes": 1799636,
          "sha256": "c75b52aacc6c0c260f204cbdd834f76edc9fb0d8e0da9fbf8352ef58202564e2"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-win_amd64.whl",
          "bytes": 2043140,
          "sha256": "5e81740c09e310f5aa5cbd3e434a01c154d4bef93241c7877b39f211d2b78ba8"
        },
        {
          "path": "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "bytes": 472589,
          "sha256": "346a034f080da3755d8e9cb5e00e8b07de1d39e4f6e2c87d8ab7cafa0b269a73"
        },
        {
          "path": "wheelhouse/pygments-2.21.0-py3-none-any.whl",
          "bytes": 1250147,
          "sha256": "2363c69b61c4a97c838da3b130dcd6468f4848992b21a82f2a63ec34377137d9"
        },
        {
          "path": "wheelhouse/pymatting-1.1.16-py3-none-any.whl",
          "bytes": 56257,
          "sha256": "6ad3f787f90d7720b60e9734c33588cb30f98a66abf7bd772fa499d3a32b466a"
        },
        {
          "path": "wheelhouse/pyparsing-3.3.2-py3-none-any.whl",
          "bytes": 122781,
          "sha256": "850ba148bd908d7e2411587e247a1e4f0327839c40e2e5e6d05a007ecc69911d"
        },
        {
          "path": "wheelhouse/pypdfium2-5.13.0-py3-none-win_amd64.whl",
          "bytes": 3885553,
          "sha256": "47dcca2a8d507b5fd24f94c3c9d48fb379430f097bc20f01beff6c963ffbcedb"
        },
        {
          "path": "wheelhouse/python_bidi-0.6.11-cp312-cp312-win_amd64.whl",
          "bytes": 161243,
          "sha256": "0608bddcc1c53dfa5293499de13ca9935b31aa46d1c722c404a88c703d1a4e47"
        },
        {
          "path": "wheelhouse/python_dateutil-2.9.0.post0-py2.py3-none-any.whl",
          "bytes": 229892,
          "sha256": "a8b2bc7bffae282281c8140a97d3aa9c14da0b136dfe83f850eea9a5f7470427"
        },
        {
          "path": "wheelhouse/pytz-2026.3.post1-py2.py3-none-any.whl",
          "bytes": 508283,
          "sha256": "dd95840dd199baea12d9cc096a1d452caa6596a1c1e4b5f3dbd1541855d5e815"
        },
        {
          "path": "wheelhouse/PyYAML-6.0.2-cp312-cp312-win_amd64.whl",
          "bytes": 156338,
          "sha256": "7e7401d0de89a9a855c839bc697c079a4af81cf878373abd7dc625847d25cbd8"
        },
        {
          "path": "wheelhouse/realesrgan-0.3.0-py3-none-any.whl",
          "bytes": 26012,
          "sha256": "59336c16c30dd5130eff350dd27424acb9b7281d18a6810130e265606c9a6088"
        },
        {
          "path": "wheelhouse/referencing-0.37.0-py3-none-any.whl",
          "bytes": 26766,
          "sha256": "381329a9f99628c9069361716891d34ad94af76e461dcb0335825aecc7692231"
        },
        {
          "path": "wheelhouse/regex-2026.9.10-cp312-cp312-win_amd64.whl",
          "bytes": 277933,
          "sha256": "4db7d00c4afbfbb55b8e17b1e371da11418ea9389b030acec63c1fa4c7ad4b86"
        },
        {
          "path": "wheelhouse/rembg-2.0.84-py3-none-any.whl",
          "bytes": 62458,
          "sha256": "3f27854a35b2e65aa74cc144040423f701a1a7bf8031359e2fb7a5e00ec355fe"
        },
        {
          "path": "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "bytes": 73075,
          "sha256": "2a0d60c172f83ac6ab31e4554906c0f3b3588d37b5cb939b1c061f4907e278e0"
        },
        {
          "path": "wheelhouse/rich-15.0.0-py3-none-any.whl",
          "bytes": 310654,
          "sha256": "33bd4ef74232fb73fe9279a257718407f169c09b78a87ad3d296f548e27de0bb"
        },
        {
          "path": "wheelhouse/rpds_py-2026.6.3-cp312-cp312-win_amd64.whl",
          "bytes": 220394,
          "sha256": "2c958bf94822e9290a40aaf2a822d4bc5c88099093e3948ad6c571eca9272e5f"
        },
        {
          "path": "wheelhouse/ruamel_yaml-0.19.1-py3-none-any.whl",
          "bytes": 118102,
          "sha256": "27592957fedf6e0b62f281e96effd28043345e0e66001f97683aa9a40c667c93"
        },
        {
          "path": "wheelhouse/safetensors-0.8.0-cp310-abi3-win_amd64.whl",
          "bytes": 355540,
          "sha256": "096ec1a98435df7beb08853bb5aa9081a84f23d0adc67ed1a0a10550f608373f"
        },
        {
          "path": "wheelhouse/scikit_image-0.26.0-cp312-cp312-win_amd64.whl",
          "bytes": 11911059,
          "sha256": "abed017474593cd3056ae0fe948d07d0747b27a085e92df5474f4955dd65aec0"
        },
        {
          "path": "wheelhouse/scipy-1.17.1-cp312-cp312-win_amd64.whl",
          "bytes": 36549682,
          "sha256": "41b71f4a3a4cab9d366cd9065b288efc4d4f3c0b37a91a8e0947fb5bd7f31d87"
        },
        {
          "path": "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "bytes": 1201486,
          "sha256": "062d34222ad13e0cc312a4c02d73f059e86a4acbfbdea8f8f76b28c99f306922"
        },
        {
          "path": "wheelhouse/shapely-2.1.2-cp312-cp312-win_amd64.whl",
          "bytes": 1722861,
          "sha256": "743044b4cfb34f9a67205cee9279feaf60ba7d02e69febc2afc609047cb49179"
        },
        {
          "path": "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "bytes": 9755,
          "sha256": "7ecfff8f2fd72616f7481040475a65b2bf8af90a56c89140852d1120324e8686"
        },
        {
          "path": "wheelhouse/six-1.17.0-py2.py3-none-any.whl",
          "bytes": 11050,
          "sha256": "4721f391ed90541fddacab5acf947aa0d3dc7d27b2e1e8eda2be8970586c3274"
        },
        {
          "path": "wheelhouse/starlette-1.6.0-py3-none-any.whl",
          "bytes": 75969,
          "sha256": "a86dd39d14bb45f85a3d18525215a9ef0cfd1f192ac793220e72598c90335f0c"
        },
        {
          "path": "wheelhouse/sympy-1.13.1-py3-none-any.whl",
          "bytes": 6189177,
          "sha256": "db36cdc64bf61b9b24578b6f7bab1ecdd2452cf008f34faa33776680c26d66f8"
        },
        {
          "path": "wheelhouse/tb_nightly-2.21.0a20251023-py3-none-any.whl",
          "bytes": 5525812,
          "sha256": "369f8f7c160b87d15515a35b49f49ac3212ef0547ed20e4dee37cf0ea7079d28"
        },
        {
          "path": "wheelhouse/tensorboard_data_server-0.7.2-py3-none-any.whl",
          "bytes": 2356,
          "sha256": "7e0610d205889588983836ec05dc098e80f97b7e7bbff7e994ebb78f578d0ddb"
        },
        {
          "path": "wheelhouse/tifffile-2026.3.3-py3-none-any.whl",
          "bytes": 243960,
          "sha256": "e8be15c94273113d31ecb7aa3a39822189dd11c4967e3cc88c178f1ad2fd1170"
        },
        {
          "path": "wheelhouse/tokenizers-0.23.2-cp310-abi3-win_amd64.whl",
          "bytes": 2863236,
          "sha256": "2e96f5699d5249c9c64aa8412e044f727aae3a4098cf830f9901ec1afc361cde"
        },
        {
          "path": "wheelhouse/torch-2.6.0+cpu-cp312-cp312-win_amd64.whl",
          "bytes": 206493444,
          "sha256": "4027d982eb2781c93825ab9527f17fbbb12dbabf422298e4b954be60016f87d8"
        },
        {
          "path": "wheelhouse/torchvision-0.21.0+cpu-cp312-cp312-win_amd64.whl",
          "bytes": 1555044,
          "sha256": "667f3d983240f41eaff5a3f78bdcbc144473978a37cd15a4db6dad92b1e8b6f0"
        },
        {
          "path": "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "bytes": 80199,
          "sha256": "c293e525e6fef9c20e8728fd4612df02a0aa31bb5fe91ecd93e123b1b7bffa73"
        },
        {
          "path": "wheelhouse/transformers-5.17.0-py3-none-any.whl",
          "bytes": 12295140,
          "sha256": "78ec1ce21579b38dfb83950a0658cd119f87212a2fcfdff478096ce9d6c03801"
        },
        {
          "path": "wheelhouse/typer-0.27.2-py3-none-any.whl",
          "bytes": 123130,
          "sha256": "b3a5fc4342d5fc8fda8fc3010b1cf117e9249aab7fae800c2eff62fd3842d97d"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.4-py3-none-any.whl",
          "bytes": 14750,
          "sha256": "65b8397ba37ccbce054456aaccddfc91e6e3083c92824df348d96ca832f3f147"
        },
        {
          "path": "wheelhouse/tzdata-2026.4-py2.py3-none-any.whl",
          "bytes": 347494,
          "sha256": "c2169a8b0a7a5e9674da5a135ccdfb2b3e671b333ed9fed17b41f73c34476e81"
        },
        {
          "path": "wheelhouse/ujson-6.0.0-cp312-cp312-win_amd64.whl",
          "bytes": 227516,
          "sha256": "8cd9f7203c0b2aaed66809edf7e66aa3ab0fe3402e87b69a43b9dfd8d33125ab"
        },
        {
          "path": "wheelhouse/urllib3-2.7.0-py3-none-any.whl",
          "bytes": 131087,
          "sha256": "9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897"
        },
        {
          "path": "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "bytes": 79871,
          "sha256": "f86e41a149d7d05a9969337e3946a9c171c06a5d42680896daaba624aeac8da1"
        },
        {
          "path": "wheelhouse/wcwidth-0.8.3-py3-none-any.whl",
          "bytes": 331669,
          "sha256": "d5b73dba6158a595ec9370350e7f2637bcac8d6c5e4fde34f30fcffb6103a5e4"
        },
        {
          "path": "wheelhouse/werkzeug-3.1.8-py3-none-any.whl",
          "bytes": 226459,
          "sha256": "63a77fb8892bf28ebc3178683445222aa500e48ebad5ec77b0ad80f8726b1f50"
        },
        {
          "path": "wheelhouse/yapf-0.43.0-py3-none-any.whl",
          "bytes": 256158,
          "sha256": "224faffbc39c428cb095818cf6ef5511fdab6f7430a10783fdfb292ccf2852ca"
        },
        {
          "path": "wheelhouse/yarl-1.24.5-cp312-cp312-win_amd64.whl",
          "bytes": 97618,
          "sha256": "a929d878fec099030c292803b31e5d5540a7b6a31e6a3cc76cb4685fc2a2f51b"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/python.exe",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "080bff46e678bf9e9f41ce2adceb18ad87b951ed5c8610b4ab7efb2e796dab18",
        "expectedPythonVersion": "3.12"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/image-ai-1.0.0-py312-cpu1.spdx.json",
        "sha256": "d5681e8678c79114c390ae58fb07f078a05fbd2d42ee21506a75c5b2ed859513"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "HLo/s27GPDraN5YjdxPqNXDS8EzxUJkseOaQuFOCaVDSDOZOtzHI/YcSowVd5SNRUzgwo3ld7QGR+52SEklEAw=="
    },
    {
      "protocolVersion": 1,
      "id": "python-312",
      "moduleId": "python-312",
      "groupId": "shared",
      "displayName": "Python 3.12 共享运行时",
      "purpose": "为小红书归档与翻译能力提供固定版本的 Python 基础运行时；各能力在自己的不可变版本目录中构建独立虚拟环境。",
      "dependencyIds": [],
      "taskToolIds": [],
      "installConditions": [
        "被依赖的能力需要 Python 3.12 时安装；已安装的依赖能力会阻止卸载。"
      ],
      "version": "3.12.14-20260901",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/python-312-3.12.14-20260901.tar.gz",
        "bytes": 21865874,
        "sha256": "2d0b49e2b64fbffa8cba4e539d9c1ebe1f3a5e18b5291ae09ac02aa750215794",
        "format": "tar.gz"
      },
      "installedBytes": 300000000,
      "files": [
        {
          "path": "python/DLLs/_asyncio.pyd",
          "bytes": 59392,
          "sha256": "3797580a504f0ff84ea7aed8df7b8d61f8519408604b520c75ca79266599ef12"
        },
        {
          "path": "python/DLLs/_bz2.pyd",
          "bytes": 73216,
          "sha256": "e43567beb7f3f9b9b89c6a40e21790170cf0fc98efcad25e6b074c60b73240eb"
        },
        {
          "path": "python/DLLs/_ctypes_test.pyd",
          "bytes": 25088,
          "sha256": "f559c57f3c6c8334280dcd227e54ceb5311321a090680aafa7f9d690d5603496"
        },
        {
          "path": "python/DLLs/_ctypes.pyd",
          "bytes": 116224,
          "sha256": "ce2f528d5d3b91d8ccc4963c7c1685537581304585c9a309dcfbdd5a1a43eaa9"
        },
        {
          "path": "python/DLLs/_decimal.pyd",
          "bytes": 248320,
          "sha256": "471630e0098c6b610bef10ff015dd95d95894048e8f3b74032ccef317da0ae05"
        },
        {
          "path": "python/DLLs/_elementtree.pyd",
          "bytes": 121856,
          "sha256": "bb48410256c0d81f1ab0493103f8d1a0daa1afaad2cba7cf23a069922fd8e6db"
        },
        {
          "path": "python/DLLs/_hashlib.pyd",
          "bytes": 54784,
          "sha256": "1c69cdfde46e4c235f8b4ff9d059d752de288a7f4a1c7f1df0927c9925984f5b"
        },
        {
          "path": "python/DLLs/_lzma.pyd",
          "bytes": 152576,
          "sha256": "61fdbdee731bc3493014b64d14f0c7a6b6950913a40fae3f561dbee9fa078658"
        },
        {
          "path": "python/DLLs/_msi.pyd",
          "bytes": 33280,
          "sha256": "cf29b42b98f1851c7e8507d3c9e549b0e11a32a158ebfe2b4e79a73afa3f1595"
        },
        {
          "path": "python/DLLs/_multiprocessing.pyd",
          "bytes": 24064,
          "sha256": "56440369c73cc7378adcfff3da6338e2e7c937ed62fd60dbcb92bcda0699b8f6"
        },
        {
          "path": "python/DLLs/_overlapped.pyd",
          "bytes": 44032,
          "sha256": "9b631b8f3d78d32e93d2cf31bd4f0988823632ae856c2fb4b6ea9471b20a6f72"
        },
        {
          "path": "python/DLLs/_queue.pyd",
          "bytes": 20480,
          "sha256": "cad613e5524c053dc0e5c497cd4bfde569c3583dc1866c9e4b041b3afccd47da"
        },
        {
          "path": "python/DLLs/_socket.pyd",
          "bytes": 71680,
          "sha256": "8aa5ab82bc2908e122754380b56a92fc92f88e0752f63e3db483d7c43b5cb6f5"
        },
        {
          "path": "python/DLLs/_sqlite3.pyd",
          "bytes": 112128,
          "sha256": "4e7c647350cf4cffec72191e4aa4d51bbe2bb2e8ae79fe9e1135857909067cc7"
        },
        {
          "path": "python/DLLs/_ssl.pyd",
          "bytes": 164864,
          "sha256": "c6871ffbfcc17b66d2b495c9b44fed192fe83e22f7b2f94b00f207525e19559b"
        },
        {
          "path": "python/DLLs/_testbuffer.pyd",
          "bytes": 43520,
          "sha256": "bae29d482b6788e388aa2d59a8d73558f6d1e47b5a45e9844f2f98472a12ac46"
        },
        {
          "path": "python/DLLs/_testcapi.pyd",
          "bytes": 297984,
          "sha256": "1803ba0ffce7f3f11a3781132a1672aa85bb22a3b6787be04b97cdf9d263da94"
        },
        {
          "path": "python/DLLs/_testclinic.pyd",
          "bytes": 55296,
          "sha256": "b4dd3789046d5e47029d5dd7274365ddd416e4f4f4376da104a31693c7a199d6"
        },
        {
          "path": "python/DLLs/_testconsole.pyd",
          "bytes": 15360,
          "sha256": "8dbf51d49d6e12bf71487e0dbbbb0e39af38e5206d591363bdaf94d02e862279"
        },
        {
          "path": "python/DLLs/_testimportmultiple.pyd",
          "bytes": 13312,
          "sha256": "eb5bcb191c7f2096b6967b01a8eebe70ddd61d9290b9a50413276c043612d45a"
        },
        {
          "path": "python/DLLs/_testinternalcapi.pyd",
          "bytes": 39936,
          "sha256": "bfaa839451f45e519d0f29902fad27edf1f3f2619143744320a6f15a658c7bcf"
        },
        {
          "path": "python/DLLs/_testmultiphase.pyd",
          "bytes": 27648,
          "sha256": "67bb7efc1b25dfc69e0515fb938c0a8f0c8220f090eb21e9c2df64a56a681756"
        },
        {
          "path": "python/DLLs/_testsinglephase.pyd",
          "bytes": 18432,
          "sha256": "3825e3f25e5e28c46cb86fe88b47a0f1670ad378a317ce78af09e3b3e94a8bcd"
        },
        {
          "path": "python/DLLs/_tkinter.pyd",
          "bytes": 55296,
          "sha256": "c7909bf5bd200e9f0ca1c008c65fa59a298f955a846031735bc4f37e01ec104c"
        },
        {
          "path": "python/DLLs/_uuid.pyd",
          "bytes": 13824,
          "sha256": "14f024dd8fe2490109f812522daebf61a2f5f8cff80513813db246d6455fcf3f"
        },
        {
          "path": "python/DLLs/_wmi.pyd",
          "bytes": 25600,
          "sha256": "b767ab02b35f5d691142b488807b405663c957e90b84377e639056b84a3288ef"
        },
        {
          "path": "python/DLLs/_zoneinfo.pyd",
          "bytes": 36352,
          "sha256": "22605c2ed4a7672c65bfdd330c60a3719916ec811ec44c720cf1cc4349c79776"
        },
        {
          "path": "python/DLLs/libcrypto-3-x64.dll",
          "bytes": 7987712,
          "sha256": "5a4e8f115a4caada73c5f890513b058509885bbb1012f0cb7ab9b5bddedae1dd"
        },
        {
          "path": "python/DLLs/libffi-8.dll",
          "bytes": 28160,
          "sha256": "cf07f9f0b1c635bdc20a5c81e0808986e14eede4329d2994ccab417f59550638"
        },
        {
          "path": "python/DLLs/libssl-3-x64.dll",
          "bytes": 1583616,
          "sha256": "cc99a27ecf92c748730827904a6f24e8d70844b69416c989097a67531c35ff83"
        },
        {
          "path": "python/DLLs/pyexpat.pyd",
          "bytes": 210432,
          "sha256": "6bb4d145099a62c3c4d6718a0fd7e0525d9736d7e584171506c2731fec674dc0"
        },
        {
          "path": "python/DLLs/select.pyd",
          "bytes": 18944,
          "sha256": "3472a0d2b8c3c6a3f80ea75deb4a8f41c159be541be7fa16337dd18c9067c0e8"
        },
        {
          "path": "python/DLLs/sqlite3.dll",
          "bytes": 1607680,
          "sha256": "7a424a26235c29e00417fe5e720cb66e107113fdc84a1d0148816ad0b4613bf2"
        },
        {
          "path": "python/DLLs/tcl86t.dll",
          "bytes": 1866480,
          "sha256": "fbfd065f861ec0a90dd513bc209c56bbc23c54d2839964a0ec2df95848af7860"
        },
        {
          "path": "python/DLLs/tk86t.dll",
          "bytes": 1541872,
          "sha256": "cd2f60075064dfc2e65c88b239a970cb4bd07cb3eec7cc26fb1bf978d4356b08"
        },
        {
          "path": "python/DLLs/unicodedata.pyd",
          "bytes": 1127936,
          "sha256": "8e7401064e85754b8cb27de94c7098b7d798a33c207cec532996036fafbcf429"
        },
        {
          "path": "python/DLLs/winsound.pyd",
          "bytes": 18432,
          "sha256": "7243978c067fbc01e6ab3298ad42c2be43a05b14ee9a40235f8ea6adb2a24b9b"
        },
        {
          "path": "python/include/abstract.h",
          "bytes": 32616,
          "sha256": "8f0b27427f4e16b4295b2ab1a7bb499bf86748fafbd1959e220c506ed59f774f"
        },
        {
          "path": "python/include/bltinmodule.h",
          "bytes": 264,
          "sha256": "1b5101b4b85409fd910032713906800bbb83580503036469c2a60ac8e80b8f72"
        },
        {
          "path": "python/include/boolobject.h",
          "bytes": 1136,
          "sha256": "84289d5b1a1b7ed6c547f4f081fba70e90a9d60dfa2d2b3155c33cdd2af41340"
        },
        {
          "path": "python/include/bytearrayobject.h",
          "bytes": 1466,
          "sha256": "0e93963caf43a057fb293ae5183d1b8bb45c9f57926ce8308f67a0f452843e85"
        },
        {
          "path": "python/include/bytesobject.h",
          "bytes": 2619,
          "sha256": "de8551db9323e7dc463717a624f2d35dacd17cdf0c7a7f6299128dd06348cf30"
        },
        {
          "path": "python/include/ceval.h",
          "bytes": 6267,
          "sha256": "9531cce1b80e804d46a9ef31bd22605f54d0ae0609dc3470946a4d8d4270af3a"
        },
        {
          "path": "python/include/codecs.h",
          "bytes": 7071,
          "sha256": "0ca3c6e55e7ff62872b47aeeb7379d784b03ebfc61bbd029b67485fe783baac5"
        },
        {
          "path": "python/include/compile.h",
          "bytes": 448,
          "sha256": "1f10c818b29007e6a4446505a1140dd77ca6618ad81e87b502f4e22f4b274406"
        },
        {
          "path": "python/include/complexobject.h",
          "bytes": 728,
          "sha256": "9356805a24503256cd8914d7b7700357e01f471c211f9241c81981d89d6c3af8"
        },
        {
          "path": "python/include/cpython/abstract.h",
          "bytes": 7870,
          "sha256": "07d8b3b9c7db77e30adef4c4d9c7a4453b8eb1f48341ed5394bd5eebe239c9fd"
        },
        {
          "path": "python/include/cpython/bytearrayobject.h",
          "bytes": 1163,
          "sha256": "ae5e099856657f3b8606701df312866eaa88992f6cfd9f8567456e1588efceb1"
        },
        {
          "path": "python/include/cpython/bytesobject.h",
          "bytes": 4660,
          "sha256": "5ba5010b9aa79f401196740da7c653590f5f4eec6b4f33e99de5412a969fcc8a"
        },
        {
          "path": "python/include/cpython/cellobject.h",
          "bytes": 1076,
          "sha256": "844f06178bbce2e9377a46ccc80e2aae85a73750932576a6cc4de934cc508cea"
        },
        {
          "path": "python/include/cpython/ceval.h",
          "bytes": 1650,
          "sha256": "b08c549971f1006e681267dd8a88481353ce4bd89b9d859f81b72cf9bf867895"
        },
        {
          "path": "python/include/cpython/classobject.h",
          "bytes": 2245,
          "sha256": "b38a0ecdebeae2a4d28dfe8a5f2833f676d38be9561ca4bdfdf5087bbe2f9332"
        },
        {
          "path": "python/include/cpython/code.h",
          "bytes": 16188,
          "sha256": "d11649dd957102deb64de35f078f061735343f5c9a5c9c429a09722cd6a2931c"
        },
        {
          "path": "python/include/cpython/compile.h",
          "bytes": 2660,
          "sha256": "32d7397c6fa5478feb2a4101641fca6dba3ac77abe4deed5c0f713a6cd6564f5"
        },
        {
          "path": "python/include/cpython/complexobject.h",
          "bytes": 1248,
          "sha256": "a4c110008e4d791a4577ce6ebee33bc512ec3e3db918bd2c296f00dd79379fcb"
        },
        {
          "path": "python/include/cpython/context.h",
          "bytes": 1965,
          "sha256": "9e34d54a789cbf0d78d5ebb126e8384342c08dd81d944d10e3d8f0de0bbba10a"
        },
        {
          "path": "python/include/cpython/descrobject.h",
          "bytes": 1642,
          "sha256": "a1ee0124142fe91204d0c5e85169b55341b2167111a1447e3a8ed50f9bd5a12f"
        },
        {
          "path": "python/include/cpython/dictobject.h",
          "bytes": 4686,
          "sha256": "5ac16d73f22038b12bd06904cf02a14bbdd723234d1d899354f1a041e8659505"
        },
        {
          "path": "python/include/cpython/fileobject.h",
          "bytes": 818,
          "sha256": "16ab872cbe2bb3351ce3090873440903b1460c1d68aed483c70c31edc4140ba2"
        },
        {
          "path": "python/include/cpython/fileutils.h",
          "bytes": 232,
          "sha256": "d7a2f703c6fba2efabd0b1cc916ad36074363a27a000987cfad17e21f04d44f1"
        },
        {
          "path": "python/include/cpython/floatobject.h",
          "bytes": 900,
          "sha256": "f1c53f5b87f221db66004b836aa2fc9462aa46c2fbe46b417a8ddc803ce2f585"
        },
        {
          "path": "python/include/cpython/frameobject.h",
          "bytes": 1108,
          "sha256": "e1421b58c6a25efb56f423a749c313e3f5392f58cc0c7f4f09b0412217a4a734"
        },
        {
          "path": "python/include/cpython/funcobject.h",
          "bytes": 7188,
          "sha256": "11077e0acca3c026f706327c29d73ef629f5d6bfbd97b2178d672b80f8792497"
        },
        {
          "path": "python/include/cpython/genobject.h",
          "bytes": 3316,
          "sha256": "24f9bd2f19341dc73c7deebca17117ea3a94fd89865c0c6548e1bf5882f51d95"
        },
        {
          "path": "python/include/cpython/import.h",
          "bytes": 1623,
          "sha256": "f3a6cb7ea774d2ffcb64c834dffaf008e8f9f3f10b23600d5522d82176cb241c"
        },
        {
          "path": "python/include/cpython/initconfig.h",
          "bytes": 7820,
          "sha256": "86e3b9d1de6f310415912e2cdfdc276e311c026ec7fdf6190893f6313cd860a3"
        },
        {
          "path": "python/include/cpython/interpreteridobject.h",
          "bytes": 387,
          "sha256": "8fc79784d556245d7b7f382063ef3797e3aebd0a6b375a95027dd63a5dfa30b6"
        },
        {
          "path": "python/include/cpython/listobject.h",
          "bytes": 1633,
          "sha256": "0ccca44b405add7a8c19d7a5e7701e06ab904cce5c430016b50f7968aef296fe"
        },
        {
          "path": "python/include/cpython/longintrepr.h",
          "bytes": 4889,
          "sha256": "e2acf37f668089278081539473eeedc8537b848fcd2eb91f53172701c014b9c3"
        },
        {
          "path": "python/include/cpython/longobject.h",
          "bytes": 4679,
          "sha256": "b443782d6b69a2cfd141ac13ac8b7a8d69e47bfdae9df984de4991b2d248b8b8"
        },
        {
          "path": "python/include/cpython/memoryobject.h",
          "bytes": 2272,
          "sha256": "62f414f21611a31f453af7c8326b309aad8f79166087a951844921c50cc84dc7"
        },
        {
          "path": "python/include/cpython/methodobject.h",
          "bytes": 2276,
          "sha256": "5beb9f3b68ac72efe403a1b0a3fbbb14a5606a49a2840b9c7e9ff243d82d79b9"
        },
        {
          "path": "python/include/cpython/modsupport.h",
          "bytes": 4336,
          "sha256": "a8d08132874d9d642ade82e62e87a510577b7bd4ab0685a90b044cc3b005232d"
        },
        {
          "path": "python/include/cpython/object.h",
          "bytes": 21212,
          "sha256": "f412fd84202ef228e6bf239c9a5a408b8d8623481a15452f8f3331dfc6342134"
        },
        {
          "path": "python/include/cpython/objimpl.h",
          "bytes": 3316,
          "sha256": "d99f0cff4297590a49f6616dbf1b04a06c745bed0a280ae35acc56fb3c47f2f3"
        },
        {
          "path": "python/include/cpython/odictobject.h",
          "bytes": 1311,
          "sha256": "97dc6296e890463fc6994247e885df65cd4024dc1b05facfdc984c37d646b919"
        },
        {
          "path": "python/include/cpython/picklebufobject.h",
          "bytes": 848,
          "sha256": "7040fb48462296c903f2f0d24d2b54e0de63cf7512dcf8d3048a0cadf7d94fd0"
        },
        {
          "path": "python/include/cpython/pthread_stubs.h",
          "bytes": 3505,
          "sha256": "0f3108e0430ee937098c86352d2ced6e3ec7f5cb5bc7e06eebee58cf779fcd89"
        },
        {
          "path": "python/include/cpython/pyctype.h",
          "bytes": 1387,
          "sha256": "10b5ccbc210fd2832e9c34849a3952e8db75f0016add89188358b1da6a8f3dbb"
        },
        {
          "path": "python/include/cpython/pydebug.h",
          "bytes": 1413,
          "sha256": "83d72e867b4fc9ac87efdfcb41c3d30ec20fa239fe6a74d1b85aa92e1f8d9506"
        },
        {
          "path": "python/include/cpython/pyerrors.h",
          "bytes": 4276,
          "sha256": "1f5070d787263e3aa8845dc90b38aaeb0945be83ef2ba993a40b4af926daacad"
        },
        {
          "path": "python/include/cpython/pyfpe.h",
          "bytes": 444,
          "sha256": "ea7bfa7d891a0b5372d8b40a57d1b466b7824296e5c3f8d50b1a7cde084429b7"
        },
        {
          "path": "python/include/cpython/pyframe.h",
          "bytes": 1479,
          "sha256": "0c7ea17874b967892de6f6623aa426d5eaf267a56e6bbb84b3fefa40e59ec1b8"
        },
        {
          "path": "python/include/cpython/pylifecycle.h",
          "bytes": 3423,
          "sha256": "02505815b8bc3e33fe31a11f4f7f960826aa1dce2c4cee6d62d2a0394470c9bf"
        },
        {
          "path": "python/include/cpython/pymem.h",
          "bytes": 3379,
          "sha256": "8a3795a9350b10548e8ad6d37dad69be2abd3870a751e67faa32a19a090608db"
        },
        {
          "path": "python/include/cpython/pystate.h",
          "bytes": 17228,
          "sha256": "11494795dd1d6945fbf8036af5ccf247463e94d405a760924a1c78f78ebfc4ec"
        },
        {
          "path": "python/include/cpython/pythonrun.h",
          "bytes": 4903,
          "sha256": "3290ea064e7450aaf43320a5fcac22d9b36acfab43d1d2c3381ade4b726ced8f"
        },
        {
          "path": "python/include/cpython/pythread.h",
          "bytes": 1418,
          "sha256": "09edccc28c784f8bb85fb77583107ac1fb52fc748946596a03cc36a9296a70dd"
        },
        {
          "path": "python/include/cpython/pytime.h",
          "bytes": 12402,
          "sha256": "a01714df4c0efdb9e20b26da6d1fc0e5a56619677c60c291f148db5e3cf2faa4"
        },
        {
          "path": "python/include/cpython/setobject.h",
          "bytes": 2146,
          "sha256": "c965bf093325e20c319af5183a8e5723d4d0b373cb6d1b8781df8c1e588963c0"
        },
        {
          "path": "python/include/cpython/sysmodule.h",
          "bytes": 489,
          "sha256": "d4936db24692cccadb19c11accda260787f95e5658f88cfc752d9a49344ee051"
        },
        {
          "path": "python/include/cpython/traceback.h",
          "bytes": 444,
          "sha256": "7898a3c168973e1119fb3b57f144be627c1468082ab0b91d001dd876dd1dbcb6"
        },
        {
          "path": "python/include/cpython/tupleobject.h",
          "bytes": 1377,
          "sha256": "301c0720038f50d8e9087b38cf1392524abf9e28262b677d841fc1a7e172c3f3"
        },
        {
          "path": "python/include/cpython/unicodeobject.h",
          "bytes": 35296,
          "sha256": "edfa102633ee0e3cc42652a36912b568ae0cea8bb72360cc97876f170504209c"
        },
        {
          "path": "python/include/cpython/warnings.h",
          "bytes": 564,
          "sha256": "b758a2e42b0c497ea811464f579603d14fc30b50bd6ebe064d8d2a7df7e2bd76"
        },
        {
          "path": "python/include/cpython/weakrefobject.h",
          "bytes": 2032,
          "sha256": "be0ab05169da7efcd13aba0ddc58604a80328d4e60349df6d4efdd1bf363e1a2"
        },
        {
          "path": "python/include/datetime.h",
          "bytes": 9769,
          "sha256": "f3d8192cada0f490a67233e615e5974f062501b2876147118ddb042ee4a7f988"
        },
        {
          "path": "python/include/descrobject.h",
          "bytes": 3080,
          "sha256": "2956a488f4c4c61341e361dac949cfa4a217e0fbd0097892513b02363c9570a7"
        },
        {
          "path": "python/include/dictobject.h",
          "bytes": 3860,
          "sha256": "08f92e2a4421d3e81fa0fa1b60cbe97f2d69897226368481b0ffc41eeb202356"
        },
        {
          "path": "python/include/dynamic_annotations.h",
          "bytes": 22471,
          "sha256": "3e4366f7d082835049730358d277a5ad7a60e16d1601f5622f0a045a37c152ac"
        },
        {
          "path": "python/include/enumobject.h",
          "bytes": 253,
          "sha256": "2244fe250db9995068fe74dce0e23fd70c12b03fd94751d98b773be8f64896b6"
        },
        {
          "path": "python/include/errcode.h",
          "bytes": 1779,
          "sha256": "e09ffcbb80580103d52992eb5fd8fd01b9930fda5e8f3874bfb9ee7aa2fe99fa"
        },
        {
          "path": "python/include/exports.h",
          "bytes": 1267,
          "sha256": "d02e9937f747660b218062bcdab504b706cad264b4df993f749d9118f2f7b65c"
        },
        {
          "path": "python/include/fileobject.h",
          "bytes": 1650,
          "sha256": "133e57cf705cbdaa79a0c115b27e748cc24dedb51ea17b441ff65d05df28a674"
        },
        {
          "path": "python/include/fileutils.h",
          "bytes": 507,
          "sha256": "51ae1c2ca70a8005206f653121d1ba3247f59421c96399739845d687980e9b01"
        },
        {
          "path": "python/include/floatobject.h",
          "bytes": 1532,
          "sha256": "50d23b4026d270e543d2dd52059bb409569218bf6c3c219dbe836077ee0ca868"
        },
        {
          "path": "python/include/frameobject.h",
          "bytes": 336,
          "sha256": "969cd93065ce79b81bbc67a65d31b742e23f30bf79d6e44a306963d552ed0c35"
        },
        {
          "path": "python/include/genericaliasobject.h",
          "bytes": 334,
          "sha256": "0e53a0b18c114be68eccea9ffd1dd577e204b1f0ada4d3aedc8e7ee0c80fc7f8"
        },
        {
          "path": "python/include/import.h",
          "bytes": 3033,
          "sha256": "4113e1b6afa760c3decce2bb765835adda19861394974cfe301e1ccb482e2b94"
        },
        {
          "path": "python/include/internal/pycore_abstract.h",
          "bytes": 611,
          "sha256": "75ecd34cdcd06fc64fcfa550f66975d755619e7cf06fdae8ecbe2de6ec49ce39"
        },
        {
          "path": "python/include/internal/pycore_asdl.h",
          "bytes": 3035,
          "sha256": "b29dace0f84849c4a24bc3745523a36911cd192bad7ec6fb48aba8facff51d3e"
        },
        {
          "path": "python/include/internal/pycore_ast_state.h",
          "bytes": 6749,
          "sha256": "1d76a7b5207c653a86dec97aab5ba1fcc5c75e94333662792a692cb68e5b26c6"
        },
        {
          "path": "python/include/internal/pycore_ast.h",
          "bytes": 31288,
          "sha256": "064b6778fa758fb2580fb8770f77dd0d1eb19323df0e345373788c75754910cf"
        },
        {
          "path": "python/include/internal/pycore_atexit.h",
          "bytes": 1149,
          "sha256": "8c5c88b8452894cf8a5f243ceb9021060f0fe8f5689cbc3e705c19c5edc0798a"
        },
        {
          "path": "python/include/internal/pycore_atomic_funcs.h",
          "bytes": 2438,
          "sha256": "9d5cfa13ad863a0cc1b0ab06861c1f8cfbdc7d730b9c4603e5777a608263d399"
        },
        {
          "path": "python/include/internal/pycore_atomic.h",
          "bytes": 16979,
          "sha256": "95e7118e799ad3faafc8e58a29b2d1f1a4bb94e1aac3273e042f379f8e12d4e6"
        },
        {
          "path": "python/include/internal/pycore_bitutils.h",
          "bytes": 6062,
          "sha256": "86628b9cbefe4ff000e1190cd36f37b70a2dad6a4e9231cc2466a84579cc2139"
        },
        {
          "path": "python/include/internal/pycore_blocks_output_buffer.h",
          "bytes": 8688,
          "sha256": "03fed5054d0d78e3711e73995e484fefb81495c063a5b9ef555c0395d7fc1ebc"
        },
        {
          "path": "python/include/internal/pycore_bytes_methods.h",
          "bytes": 3384,
          "sha256": "1534326dbf027e9bb472be5ccf8b82fab48f3282cc7f6a61629b801fc80afc00"
        },
        {
          "path": "python/include/internal/pycore_bytesobject.h",
          "bytes": 1339,
          "sha256": "d3ecf25cf0f0e9815ac24f496e5ccbbf8d57a10e570da81e84f2b5f6e95b59b8"
        },
        {
          "path": "python/include/internal/pycore_call.h",
          "bytes": 3920,
          "sha256": "5e780aed2dc991455a0e528fc7baca8df61d2e4bec4e137d7e788668b5750ec5"
        },
        {
          "path": "python/include/internal/pycore_ceval_state.h",
          "bytes": 2744,
          "sha256": "f29e3d6dcac96b0067a17845df8483013230805db10c6f3c5ecd02b9134640e7"
        },
        {
          "path": "python/include/internal/pycore_ceval.h",
          "bytes": 5265,
          "sha256": "1af22b50c9ececfc4c3a5f37ecb70cc1c0eefad5a2656e6e22fc088cae54e226"
        },
        {
          "path": "python/include/internal/pycore_code.h",
          "bytes": 15835,
          "sha256": "48e78dd1a12e6afa6e54e26f8e7c4f56e20689b84189d503507c7f6c36819092"
        },
        {
          "path": "python/include/internal/pycore_compile.h",
          "bytes": 3453,
          "sha256": "4d386629f5e0ea801a01122833f11363cf9f1584aef6e9692ffd0b95eda37cbc"
        },
        {
          "path": "python/include/internal/pycore_condvar.h",
          "bytes": 2909,
          "sha256": "97c4cb5f0a32cd967dd5d54d4ddaed9323c7c2439cd6ffbba9f7d48064b97b26"
        },
        {
          "path": "python/include/internal/pycore_context.h",
          "bytes": 1301,
          "sha256": "974d6bafbe0164d60dd1bc4f09b5eac9bcc9e2d9066924ba2a2ba6d502f115b5"
        },
        {
          "path": "python/include/internal/pycore_descrobject.h",
          "bytes": 499,
          "sha256": "d9be424b5c2d109b51338016acab6132f299c0640fc069fb0e1d48575089574e"
        },
        {
          "path": "python/include/internal/pycore_dict_state.h",
          "bytes": 1095,
          "sha256": "5a15c2bb4020ce4a1d7a4c651e0f98b4becd910f89cd7c4089c80a0419ec4f1c"
        },
        {
          "path": "python/include/internal/pycore_dict.h",
          "bytes": 6384,
          "sha256": "4d51e7184d50a5f8785a1cbdc9f6eb36b86201158ae6e3527884ce2b5dd504bf"
        },
        {
          "path": "python/include/internal/pycore_dtoa.h",
          "bytes": 1615,
          "sha256": "c83a4aa972a4845cdf36abdac4769ea30e877aae1997fc4999d020bc3e183c1e"
        },
        {
          "path": "python/include/internal/pycore_emscripten_signal.h",
          "bytes": 562,
          "sha256": "1acd47a1c09e365be8c7fa51db31307021cc2e471471fc199e26f317df58c4b8"
        },
        {
          "path": "python/include/internal/pycore_exceptions.h",
          "bytes": 842,
          "sha256": "4590af737d53afcbd7d559434190d2d8ff4f5cd0e923837721aea5ebb000ef68"
        },
        {
          "path": "python/include/internal/pycore_faulthandler.h",
          "bytes": 2220,
          "sha256": "6444dce1924eae011d27385183ad1a5de6908501cedce2e1531abd834c68cae7"
        },
        {
          "path": "python/include/internal/pycore_fileutils_windows.h",
          "bytes": 2724,
          "sha256": "9e976ea0f3457c8b40db0a3b2cfea9e9684737f75282400ec0040ae0df1e6385"
        },
        {
          "path": "python/include/internal/pycore_fileutils.h",
          "bytes": 7910,
          "sha256": "ea9cac693c87dc049f199cecd2844592ee08d0283dc0b059c4caab517932af73"
        },
        {
          "path": "python/include/internal/pycore_floatobject.h",
          "bytes": 1578,
          "sha256": "021fef24c4b7e7390c793af7ccf12ddd94b1871e27d26997b37eb3093d5380b5"
        },
        {
          "path": "python/include/internal/pycore_flowgraph.h",
          "bytes": 4630,
          "sha256": "c58cdc30ce8c853404f55881813ec69d6dbf921f2769ec9e289b5155b7a349db"
        },
        {
          "path": "python/include/internal/pycore_format.h",
          "bytes": 480,
          "sha256": "253cc77e6d11ba20d297813e064650fa965b3653f150bd85f805b94db5f3a98d"
        },
        {
          "path": "python/include/internal/pycore_frame.h",
          "bytes": 9255,
          "sha256": "23d66ba6ef2936ecca96dc427be5e022712ae25c3f4b3df2abd2ca46b1ee5f39"
        },
        {
          "path": "python/include/internal/pycore_function.h",
          "bytes": 611,
          "sha256": "8fad970bd3f31347aed72b92acd17270dbb6ec5333ab5ed6fe43dc9cf2527841"
        },
        {
          "path": "python/include/internal/pycore_gc.h",
          "bytes": 7658,
          "sha256": "d0349a94dafb16ec4c05ba5a94d3b9e6cec53fe7b5e0d74216ea31996546f9a3"
        },
        {
          "path": "python/include/internal/pycore_genobject.h",
          "bytes": 1186,
          "sha256": "a940f41da1e8d9d12c9c438ea0b4f24e72abc494447bcecd9423b76f54e3402a"
        },
        {
          "path": "python/include/internal/pycore_getopt.h",
          "bytes": 490,
          "sha256": "e93393067b66b557b0300e05c10ee904d4be54cadfb214c5328a9225ad199452"
        },
        {
          "path": "python/include/internal/pycore_gil.h",
          "bytes": 1565,
          "sha256": "cf455aacd5651e5b43547ebe69bb324eab84238d92665df53c1df32434bd0d9b"
        },
        {
          "path": "python/include/internal/pycore_global_objects_fini_generated.h",
          "bytes": 115361,
          "sha256": "7fe489effdce5c7b74273742e1c5d6c3d84ce7328480efe00dad9051bfa47c03"
        },
        {
          "path": "python/include/internal/pycore_global_objects.h",
          "bytes": 3035,
          "sha256": "ce857a319514b1682eb054bf4a017974b0bf211092819b25f23e877a228090df"
        },
        {
          "path": "python/include/internal/pycore_global_strings.h",
          "bytes": 25438,
          "sha256": "da08d01f47b89ef7bc83893ba7b32a0b690fd3ac5a5922dffa7a649ceb900d91"
        },
        {
          "path": "python/include/internal/pycore_hamt.h",
          "bytes": 3742,
          "sha256": "074b31c2f5701cac43d8dc3e4ede40b2befc6dddfcaa2862cfc8f76234c30ae8"
        },
        {
          "path": "python/include/internal/pycore_hashtable.h",
          "bytes": 4286,
          "sha256": "690488a7e50ad743e1bb685702fbcfac866ace89d2417a247c1171afdc222261"
        },
        {
          "path": "python/include/internal/pycore_import.h",
          "bytes": 6358,
          "sha256": "e5b179692f05707e7fb182b908ed46f9a75f4a751b20501a74de2a440c387e1d"
        },
        {
          "path": "python/include/internal/pycore_initconfig.h",
          "bytes": 5706,
          "sha256": "caf13e2c290ae8375636d0e1f3b1851a90396b3747da650d058c282b8743b558"
        },
        {
          "path": "python/include/internal/pycore_instruments.h",
          "bytes": 2998,
          "sha256": "dcdb0593cfa908c036d6661f1a776db48642c0fedd243da88161f45ff3c3e3fa"
        },
        {
          "path": "python/include/internal/pycore_interp.h",
          "bytes": 9086,
          "sha256": "23f5d7884f9e0b212fe79879bbcdc5a2c23c22283db38cadbac6f108bf0f1b75"
        },
        {
          "path": "python/include/internal/pycore_intrinsics.h",
          "bytes": 1397,
          "sha256": "e6d6d1eae51b508196615094a4c17189e9822eacb5c0e94102e78aa7136dd9a8"
        },
        {
          "path": "python/include/internal/pycore_list.h",
          "bytes": 1980,
          "sha256": "470a62bb98b383b85ec738a6577424e6cdd51ae235f4e5ea06c5afdedb6e1652"
        },
        {
          "path": "python/include/internal/pycore_long.h",
          "bytes": 7805,
          "sha256": "84c0c7bd7ba0c2fbbfb106561e32328e478d8350afe756af6a4862c95d921a06"
        },
        {
          "path": "python/include/internal/pycore_memoryobject.h",
          "bytes": 383,
          "sha256": "c845bb546019ed9999403018740ee5b26f83f8d888c5288895897cb2bd1b5eec"
        },
        {
          "path": "python/include/internal/pycore_moduleobject.h",
          "bytes": 1192,
          "sha256": "55a8f42968545a349d8e0b43cd1822b22ae2cf9fa0fb098c6bb843e7af76e165"
        },
        {
          "path": "python/include/internal/pycore_namespace.h",
          "bytes": 392,
          "sha256": "466fe0e3f48e954d8bfe9e0c73fc9378cf79ca37710778ba6698e1c365304956"
        },
        {
          "path": "python/include/internal/pycore_object_state.h",
          "bytes": 1016,
          "sha256": "572c053ce17edd206c776e7138965fa1f7485127e05c68ce9ad0232e3a821692"
        },
        {
          "path": "python/include/internal/pycore_object.h",
          "bytes": 14917,
          "sha256": "56c99d065465adb1255cbb064a3b8bc52698393965982cfd9fd6adf54adc60f5"
        },
        {
          "path": "python/include/internal/pycore_obmalloc_init.h",
          "bytes": 2085,
          "sha256": "33853ff5ffac15a8622ff6920ff2bd0bf83d1df7ea6d1563916d05992b3203fb"
        },
        {
          "path": "python/include/internal/pycore_obmalloc.h",
          "bytes": 27284,
          "sha256": "d8738004c5dbb5520f401919ed55181a48a9e64a3b51930309fc99fb9d219576"
        },
        {
          "path": "python/include/internal/pycore_opcode_utils.h",
          "bytes": 2686,
          "sha256": "98dfb250812d554278dedee98a2e9cb05b2583b22d2af8ba1aeda6b130a21b40"
        },
        {
          "path": "python/include/internal/pycore_opcode.h",
          "bytes": 20081,
          "sha256": "432e30c6145dff72096325d17192d0eff9895b367d4590f782e2d8b9d5f78cd6"
        },
        {
          "path": "python/include/internal/pycore_parser.h",
          "bytes": 1358,
          "sha256": "91189a016020eb7de0b1ab8ae38145dbec6b561ae5c75cea15980cb76255ba5b"
        },
        {
          "path": "python/include/internal/pycore_pathconfig.h",
          "bytes": 606,
          "sha256": "ff96c74aae60eba62bec8c6d52f34471caf07792186bc16d76e7a783f61aa0ed"
        },
        {
          "path": "python/include/internal/pycore_pyarena.h",
          "bytes": 2733,
          "sha256": "d4f4e513bae78ff985f51ca48fb7d1a4d57055c59393a1eb661e55e6ec3ba61f"
        },
        {
          "path": "python/include/internal/pycore_pyerrors.h",
          "bytes": 3110,
          "sha256": "87b6e1741b1d6c4fd7b370b41b06df113109a84f2308d01c4793315a538274b4"
        },
        {
          "path": "python/include/internal/pycore_pyhash.h",
          "bytes": 709,
          "sha256": "7c631d06afad90fa9c2ddc8dc04b7c2855ee5aa6e7ece0b22d0a966a702abf73"
        },
        {
          "path": "python/include/internal/pycore_pylifecycle.h",
          "bytes": 3365,
          "sha256": "f6a91e690b8e5d3dca52dcdff63d36a6ad9ad85b7ee1edfc14215cc0483059fa"
        },
        {
          "path": "python/include/internal/pycore_pymath.h",
          "bytes": 8600,
          "sha256": "6dd3ea0f9a84bfa3a2eb0a2b7fa1af1dc8aadad3e74305e13f194a1586815376"
        },
        {
          "path": "python/include/internal/pycore_pymem_init.h",
          "bytes": 2654,
          "sha256": "82a1418ee1867e5e9a2717e8a1acfec2e2ff3ef07225e30be7c8cd8f6e29a7ba"
        },
        {
          "path": "python/include/internal/pycore_pymem.h",
          "bytes": 3040,
          "sha256": "ad0b35bbf5e665e90223499f8954bfcf36448b1634d54501b0c84d08680323ca"
        },
        {
          "path": "python/include/internal/pycore_pystate.h",
          "bytes": 4982,
          "sha256": "c06823811bf5dd3d84f40d6a087452da5915e3ad277afef2202c9e86e833ce00"
        },
        {
          "path": "python/include/internal/pycore_pythread.h",
          "bytes": 2075,
          "sha256": "ba04eed4d18d6110982cc58800fda11f3899c61fed644ff9e52a4adedb7b750a"
        },
        {
          "path": "python/include/internal/pycore_range.h",
          "bytes": 346,
          "sha256": "824c5023a85a9c1c2dd50fecf442d12c7b2966e0e71a2d291f6f17f7fd8c29bc"
        },
        {
          "path": "python/include/internal/pycore_runtime_init_generated.h",
          "bytes": 45751,
          "sha256": "b240fe061c8e45cf069e35828cc5d07c53f03890c308789bf11442cf6427e31d"
        },
        {
          "path": "python/include/internal/pycore_runtime_init.h",
          "bytes": 5912,
          "sha256": "819bbcf74ae8c370aadcf0270469d895f1fefe5d012da847135081b3a77ac768"
        },
        {
          "path": "python/include/internal/pycore_runtime.h",
          "bytes": 8429,
          "sha256": "d47fe4de4c245e2f90ce73792337565cae6ce95d8e2cd08bcda43ec92832b1ac"
        },
        {
          "path": "python/include/internal/pycore_signal.h",
          "bytes": 2611,
          "sha256": "186835a8702a10bb1f3f63185d50874f24885716707717f620d3ffd0a2039679"
        },
        {
          "path": "python/include/internal/pycore_sliceobject.h",
          "bytes": 414,
          "sha256": "e8b9ba794081a75bf73f0eb64089a766b5bd04b076d4368a14a83ff43ce909be"
        },
        {
          "path": "python/include/internal/pycore_strhex.h",
          "bytes": 937,
          "sha256": "45783d1137fc33a8d9e457692227e8395a93b27c76205f50ad7bd8f00fe7aefb"
        },
        {
          "path": "python/include/internal/pycore_structseq.h",
          "bytes": 923,
          "sha256": "e1c1be3681fec8c1146d5a084869c1bbabcbe68223382cdab8536c8b88958891"
        },
        {
          "path": "python/include/internal/pycore_symtable.h",
          "bytes": 7035,
          "sha256": "0eeea2ae4b12aaa38bfb8f15f404771306dd4ff92f6f766be10be8129b00e2fc"
        },
        {
          "path": "python/include/internal/pycore_sysmodule.h",
          "bytes": 999,
          "sha256": "668e205cf1d4807953f1240d0e2420169c068607b94b05505179f8d6cce2d5e4"
        },
        {
          "path": "python/include/internal/pycore_time.h",
          "bytes": 388,
          "sha256": "6838118a537e71edaf76290da15cbf2da19499df1ee4e30b15f35bb4b9257b70"
        },
        {
          "path": "python/include/internal/pycore_token.h",
          "bytes": 3050,
          "sha256": "91c75ef718b8e8be2383fdcea502c1e63ebfa6d681afd45672e379ea7e5d3668"
        },
        {
          "path": "python/include/internal/pycore_traceback.h",
          "bytes": 3501,
          "sha256": "3f9dfb009dc161f2d979f5af76d660611264b5d0b1b4adeeae10d30ee0999ede"
        },
        {
          "path": "python/include/internal/pycore_tracemalloc.h",
          "bytes": 3075,
          "sha256": "61ac9b846ae579c667d20034c9c4004a07ab3ff039848ddeeec8d9c39ff1331a"
        },
        {
          "path": "python/include/internal/pycore_tuple.h",
          "bytes": 2197,
          "sha256": "de5677ac0809abf2744ebdd94768b6974e75ea62cc2cee44c4f433e2b818f953"
        },
        {
          "path": "python/include/internal/pycore_typeobject.h",
          "bytes": 4731,
          "sha256": "7cbcc82334920ed3711f7cd761114d39168697bcf4d8ba85583cf4b25cc2c46a"
        },
        {
          "path": "python/include/internal/pycore_typevarobject.h",
          "bytes": 763,
          "sha256": "b925204918e577bfb667a64f5f56e410cba0bc518207ed8535d1fcf1bdd6ab00"
        },
        {
          "path": "python/include/internal/pycore_ucnhash.h",
          "bytes": 898,
          "sha256": "6d9077e875703e5db7daf293a6c7ea3d43d1ee84dec137a950f17a26e9348eb5"
        },
        {
          "path": "python/include/internal/pycore_unicodeobject_generated.h",
          "bytes": 125516,
          "sha256": "87ac08146e99b7729b46e451af19d355f9e48952585dc67a07d3c788a20d3766"
        },
        {
          "path": "python/include/internal/pycore_unicodeobject.h",
          "bytes": 2657,
          "sha256": "e171f3303be9a161db66cb8ab942ebe75976a5cc815a633ac6c38dba31d76d60"
        },
        {
          "path": "python/include/internal/pycore_unionobject.h",
          "bytes": 682,
          "sha256": "f1c5bbdf5660e54872ff1555c179cf6c80f8e04cac41e974b7964e21f82be18c"
        },
        {
          "path": "python/include/internal/pycore_warnings.h",
          "bytes": 740,
          "sha256": "3229b207245cb9442f09991df7084c8e4cb87cb073a14a2d520bd92634371fcb"
        },
        {
          "path": "python/include/interpreteridobject.h",
          "bytes": 333,
          "sha256": "b497c869333bdf1f79a580a36e9a0ed64fee226daa1d2d45bdfe16c01e52d73c"
        },
        {
          "path": "python/include/intrcheck.h",
          "bytes": 772,
          "sha256": "696fe17618c579a8cbaad9b86175f60d43ea0b9e8aaaa1d65ad256d53dc163c1"
        },
        {
          "path": "python/include/iterobject.h",
          "bytes": 597,
          "sha256": "6b16711d2bb6cee55e4288f84142d592eebf07321e32998a5abe2c06deeb77b0"
        },
        {
          "path": "python/include/listobject.h",
          "bytes": 1782,
          "sha256": "f4cad9a1f48d27a9a7f56702ab0fe785013eb336ea919197600d86a6e54fa5bf"
        },
        {
          "path": "python/include/longobject.h",
          "bytes": 3739,
          "sha256": "0567b258763af5e6cb0ecba02135b41b012425a673d4da8c87db1333ac638901"
        },
        {
          "path": "python/include/marshal.h",
          "bytes": 827,
          "sha256": "d7f5760ef6496776cee99aca5491789f6ab261a78b156b5758538ea15e1827e5"
        },
        {
          "path": "python/include/memoryobject.h",
          "bytes": 1081,
          "sha256": "efb734845a1366d77f6351cbb954c08681d4acfe6a53e41e82dd45fa881e0090"
        },
        {
          "path": "python/include/methodobject.h",
          "bytes": 5076,
          "sha256": "059e19bd8d418c8bf1481e301340f989317ba7b56de94729a19aae26fee3da62"
        },
        {
          "path": "python/include/modsupport.h",
          "bytes": 6515,
          "sha256": "064d1440d862d08f296c1cbe868e417af12b34f770be515461211f5beade04ff"
        },
        {
          "path": "python/include/moduleobject.h",
          "bytes": 3559,
          "sha256": "5eb48f5d99322d7912a5c6f2b3a974e283c7a6045f79a503d7e09f3ac15b42ec"
        },
        {
          "path": "python/include/object.h",
          "bytes": 37155,
          "sha256": "68b97095c521fcb3fab7193e166870b0c040c8f19ac50efb42088364862503a7"
        },
        {
          "path": "python/include/objimpl.h",
          "bytes": 9238,
          "sha256": "8828a8db3e9f14b5ca2d59b1d8c05f6bf54fae26736ae039b7420c886142dba2"
        },
        {
          "path": "python/include/opcode.h",
          "bytes": 12808,
          "sha256": "4e8c6eee859813845b3a9dfe9e08ca4cc607a7f884048f5a6cebef6bdcc5d33d"
        },
        {
          "path": "python/include/osdefs.h",
          "bytes": 737,
          "sha256": "8372e9c507949a88ed3cad5fd0a830190d60a1655e9a3f59ef4d0832c06a041c"
        },
        {
          "path": "python/include/osmodule.h",
          "bytes": 291,
          "sha256": "c013935b48f48ca8ce249a4d482c55e3fb6f1cfe786c5a32a57969bb74a779d9"
        },
        {
          "path": "python/include/patchlevel.h",
          "bytes": 1301,
          "sha256": "66ff726e200a2eba15cfedee752bf6a59e20d6741a7c45f7a2c424dea649f473"
        },
        {
          "path": "python/include/py_curses.h",
          "bytes": 2473,
          "sha256": "1aa826cacb9f07611155906d711403a7675ce573d61c888786178bb574dc3087"
        },
        {
          "path": "python/include/pybuffer.h",
          "bytes": 5282,
          "sha256": "c95edd830772e922f60f976ac0d98470b48a443ba198b0866a4096003c0740a4"
        },
        {
          "path": "python/include/pycapsule.h",
          "bytes": 1727,
          "sha256": "6929a47483ea5bb1a7b9b490a876b21beefed11061c94b2963b2608b7f542728"
        },
        {
          "path": "python/include/pyconfig.h",
          "bytes": 22043,
          "sha256": "0d0cfe802715933db0b8a889a99788906b82d75201e462a941705d2ea81395cd"
        },
        {
          "path": "python/include/pydtrace.h",
          "bytes": 2404,
          "sha256": "7ac591e56e12936a32e3b0b85dae803f8f00bdc91abe01799ca2e4ce69548555"
        },
        {
          "path": "python/include/pyerrors.h",
          "bytes": 13017,
          "sha256": "59bf06c7ba877ec76d09a41aac75e385a2723545388b105864f48f295e2524e0"
        },
        {
          "path": "python/include/pyexpat.h",
          "bytes": 3295,
          "sha256": "d3564a35c027eb7a0e4ddbf8659769bf4be61b0c39666c79c555249fa8b0d099"
        },
        {
          "path": "python/include/pyframe.h",
          "bytes": 551,
          "sha256": "58513e7017805ee5c49a329a552f72a6be6d88ce2bcfa344f5130582fa75ecb6"
        },
        {
          "path": "python/include/pyhash.h",
          "bytes": 4252,
          "sha256": "a6bfc2bdb7d20abd9ee39d1a4ded6308632bf5d7534683d4032e4b7de2d8b355"
        },
        {
          "path": "python/include/pylifecycle.h",
          "bytes": 2249,
          "sha256": "d313c5f3fe805606061ea78982ca5d5a9f09e687210c8b0fbcb50db596106691"
        },
        {
          "path": "python/include/pymacconfig.h",
          "bytes": 2810,
          "sha256": "5dcd4fa505975be42c35a4707ab7cb5b6ddf2e896bb8fbb8c1fd9047e5183a3d"
        },
        {
          "path": "python/include/pymacro.h",
          "bytes": 6656,
          "sha256": "c82a7ed12ffe85aa119e917a486a388cb0fc345719a7330bf1e2951d2d4f5282"
        },
        {
          "path": "python/include/pymath.h",
          "bytes": 1688,
          "sha256": "eeea8396e1acd271ba83a568ba572ead47493e492ce998756fe1256bf917b3f9"
        },
        {
          "path": "python/include/pymem.h",
          "bytes": 3914,
          "sha256": "54a5315d7861e989c5099f168d946f5a421337efcd5d44896201016e92a81348"
        },
        {
          "path": "python/include/pyport.h",
          "bytes": 25593,
          "sha256": "1cb92172d631c9176c32caec8a330c74a544e4a5a2f1e82c15b0f2411fb87bb7"
        },
        {
          "path": "python/include/pystate.h",
          "bytes": 4635,
          "sha256": "065426aaa5fada90d61a17757fbc2e8ce3fb9cc203992990c4ca3cee7f9f80be"
        },
        {
          "path": "python/include/pystats.h",
          "bytes": 2741,
          "sha256": "b93db83e29f09ff06b15bf39a21e53de82858ba92cbf48332d1ada1ac028d6f8"
        },
        {
          "path": "python/include/pystrcmp.h",
          "bytes": 436,
          "sha256": "f401d8338fb6ecf5f12768ee95cd09c262f880b2ee522ca344b890dbdcde4c88"
        },
        {
          "path": "python/include/pystrtod.h",
          "bytes": 1557,
          "sha256": "8c8e9d1d279216f1c08f0aedac5de49a9b8852a3f838f21e298300e969474ef4"
        },
        {
          "path": "python/include/Python.h",
          "bytes": 2854,
          "sha256": "729ef157f6026e6e1b3104593f87dddc597c3b83b60c7c2965878c62a56c6f7d"
        },
        {
          "path": "python/include/pythonrun.h",
          "bytes": 1313,
          "sha256": "4749ef95e910632a1d04b912c4f1d615c9d10567cbaf52a2ab2c68c7c3a38d94"
        },
        {
          "path": "python/include/pythread.h",
          "bytes": 4875,
          "sha256": "cd063073710988ea21b54588473542e5f3b2be06f637dc5a028aefd5a7949144"
        },
        {
          "path": "python/include/pytypedefs.h",
          "bytes": 851,
          "sha256": "26d09a78c44998e8c0a74ed2d14e5346e4b922892eb79288049b7ac5b6a1e751"
        },
        {
          "path": "python/include/rangeobject.h",
          "bytes": 630,
          "sha256": "36547ab5862e82b09cbed7b786a4cfc86af1dec5a3778c50825bb266c9a6aec9"
        },
        {
          "path": "python/include/setobject.h",
          "bytes": 1557,
          "sha256": "7ff1b984647598b19ff593b0fa40d44cf5d7bc37d386dd9fac059e560f4a31ca"
        },
        {
          "path": "python/include/sliceobject.h",
          "bytes": 2518,
          "sha256": "527719b92e4fa9d5b371c30bc87bc0304ec20099b18c446ad1aa49fd61e5e387"
        },
        {
          "path": "python/include/structmember.h",
          "bytes": 1645,
          "sha256": "9d4c39dee96e228f60cc8a6960b9e7049875ddbee15541a75629c07777916342"
        },
        {
          "path": "python/include/structseq.h",
          "bytes": 1398,
          "sha256": "067f8663a922eb142a3fd12ff18eaa756553bef8a68eaa863f80419dbb8d1ffe"
        },
        {
          "path": "python/include/sysmodule.h",
          "bytes": 1729,
          "sha256": "09b6f415d4054fee4eb8375a94a724e102bc9a40633d16a437960671b1a9a1b4"
        },
        {
          "path": "python/include/traceback.h",
          "bytes": 585,
          "sha256": "ea59d511687f7f8643c7b8b0996e26f2c92bcc954639c6f98d08f6564b61d06d"
        },
        {
          "path": "python/include/tracemalloc.h",
          "bytes": 2285,
          "sha256": "1f40865be2187f8a532d01ac70bfd874848d63ab777ba38251ea1c445f7fced9"
        },
        {
          "path": "python/include/tupleobject.h",
          "bytes": 1615,
          "sha256": "d8de8d64e4b5c466c3bdd04f5664f0eba64a9198b30b5a29409d74a5b5f1def7"
        },
        {
          "path": "python/include/typeslots.h",
          "bytes": 2342,
          "sha256": "77fe4a71f5e5974c40fd3485d3c9aeb8b7ccf33969cd26feb58c64eda5f86f1d"
        },
        {
          "path": "python/include/unicodeobject.h",
          "bytes": 35164,
          "sha256": "5cc1350da2b00f5187065004a1f5d66764e86a0f20f8faba7d0eadf913297d93"
        },
        {
          "path": "python/include/warnings.h",
          "bytes": 1129,
          "sha256": "18fde34b12247460de805fc259ea7f14305fce4779d244c0a7bdc7c73b8f6b51"
        },
        {
          "path": "python/include/weakrefobject.h",
          "bytes": 1234,
          "sha256": "031b4bc091cf442b4305f7c5ac9713f32101a5e40617f3cb56c632cb7b15fb5b"
        },
        {
          "path": "python/Lib/__future__.py",
          "bytes": 5218,
          "sha256": "981d4c398849f9ebcab72300d9c1fe288fd6d7f28957b3b3fa3a493a5836d95c"
        },
        {
          "path": "python/Lib/__hello__.py",
          "bytes": 227,
          "sha256": "a8ce70b199497950f0f06def93115a6814daf1f961934457f59046909901487f"
        },
        {
          "path": "python/Lib/__phello__/__init__.py",
          "bytes": 97,
          "sha256": "56f7ed595e767c558ded05def14b682893105daf504500c3443b458ca2431bc6"
        },
        {
          "path": "python/Lib/__phello__/ham/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/__phello__/ham/eggs.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/__phello__/spam.py",
          "bytes": 97,
          "sha256": "56f7ed595e767c558ded05def14b682893105daf504500c3443b458ca2431bc6"
        },
        {
          "path": "python/Lib/__pycache__/__future__.cpython-312.pyc",
          "bytes": 4751,
          "sha256": "5c76bc075c67fc4bc093fe51533b52d6a50488dca758b4c9532cccaa6f9327c6"
        },
        {
          "path": "python/Lib/__pycache__/_compat_pickle.cpython-312.pyc",
          "bytes": 7246,
          "sha256": "b0a66d9e81298bace86bc241e0facc8f4136e9d72d4cb3df8ad6d77fa3a6f35b"
        },
        {
          "path": "python/Lib/__pycache__/_compression.cpython-312.pyc",
          "bytes": 7542,
          "sha256": "32fd2f84858a1a41e75625c7aa3c059d3027ab09fffa38b17333070416bf1057"
        },
        {
          "path": "python/Lib/__pycache__/_markupbase.cpython-312.pyc",
          "bytes": 12326,
          "sha256": "e83892281687baf73dcaddb1b0e1cad47ae14f0ede3fa363ea0fa9d7986b1cf9"
        },
        {
          "path": "python/Lib/__pycache__/_weakrefset.cpython-312.pyc",
          "bytes": 11801,
          "sha256": "3360978bc2ad265a1372306b9f5070e1b8af0873b441540b3c61631112e88243"
        },
        {
          "path": "python/Lib/__pycache__/argparse.cpython-312.pyc",
          "bytes": 101102,
          "sha256": "ca1b880c69ab3dbe918f376f70370417c9935691d083965300264cff52042275"
        },
        {
          "path": "python/Lib/__pycache__/ast.cpython-312.pyc",
          "bytes": 99798,
          "sha256": "2c1d77d2ec5ffa06c4f8e191cdf299ecf00278b1455225d7717f1ef5d1ee56a8"
        },
        {
          "path": "python/Lib/__pycache__/base64.cpython-312.pyc",
          "bytes": 24461,
          "sha256": "c98d49df332f163fef052a67fa2eb1f68204d37ce684173aba7a5eb44d3dd27b"
        },
        {
          "path": "python/Lib/__pycache__/bisect.cpython-312.pyc",
          "bytes": 3705,
          "sha256": "be773d12b0f64f6ce4cfd61fbb203bf144dcd335a99725582b0666492dd2140b"
        },
        {
          "path": "python/Lib/__pycache__/bz2.cpython-312.pyc",
          "bytes": 15197,
          "sha256": "63b46734ff140c9d5408afd244d8921ebe6d07cbb58f3f229300177baf52ba5b"
        },
        {
          "path": "python/Lib/__pycache__/calendar.cpython-312.pyc",
          "bytes": 39949,
          "sha256": "cd317cf30a535d949db77d5cbaa6932624d8e1c801b17e2ea610651dba8b6df5"
        },
        {
          "path": "python/Lib/__pycache__/colorsys.cpython-312.pyc",
          "bytes": 4689,
          "sha256": "47fceb76e6236955b8b4c99825ab1b7e58b179f493224592d48355e7ca3b1119"
        },
        {
          "path": "python/Lib/__pycache__/compileall.cpython-312.pyc",
          "bytes": 20394,
          "sha256": "1852b64eaa967c62bd0e0f9b622a5b2df22b299f2e31047c765e77122ddb5100"
        },
        {
          "path": "python/Lib/__pycache__/configparser.cpython-312.pyc",
          "bytes": 63910,
          "sha256": "3d1c81a95aa02d0ad0c436299ddbae2bde97d944bede44659748484e6063e3ab"
        },
        {
          "path": "python/Lib/__pycache__/contextlib.cpython-312.pyc",
          "bytes": 30414,
          "sha256": "a69bf8d3c0e9e387f2e8a386c1189242971c2a0a3322f37f30357a468ff042d5"
        },
        {
          "path": "python/Lib/__pycache__/copy.cpython-312.pyc",
          "bytes": 9804,
          "sha256": "027d960cd9d56b31f8aff4b7253f973ea5badfe55adeb3fe58a08a0adf1a1704"
        },
        {
          "path": "python/Lib/__pycache__/copyreg.cpython-312.pyc",
          "bytes": 7463,
          "sha256": "81b21e506df124c47a06a871c326b819a9f0ba417cbafecf75d83f0785487435"
        },
        {
          "path": "python/Lib/__pycache__/csv.cpython-312.pyc",
          "bytes": 18347,
          "sha256": "a0289589670afb89be0c3de82a0cc534ae250fc9196cc47e04b1b75434900468"
        },
        {
          "path": "python/Lib/__pycache__/dataclasses.cpython-312.pyc",
          "bytes": 44938,
          "sha256": "2885c8e3406b209fda02b71382b32b3ba5931701ca27ff2784fc36f2bed7a7ff"
        },
        {
          "path": "python/Lib/__pycache__/datetime.cpython-312.pyc",
          "bytes": 473,
          "sha256": "b91ea46f04fc223a6cac91cd03707ac2979794b2ef2c8c1917889229d99e9585"
        },
        {
          "path": "python/Lib/__pycache__/decimal.cpython-312.pyc",
          "bytes": 2978,
          "sha256": "a72b0b483507fba1c37b1028568a961583cf41e8fe077ec5a310dc6ecddd3846"
        },
        {
          "path": "python/Lib/__pycache__/dis.cpython-312.pyc",
          "bytes": 34505,
          "sha256": "05d323c381f3fb2895ed002f4f86c0ef68639e3ba1da306b71e5a4dc390dee8a"
        },
        {
          "path": "python/Lib/__pycache__/enum.cpython-312.pyc",
          "bytes": 80408,
          "sha256": "2ffa78545c1fc2ac64ace9b0f1ed3a7279d782a1f9c76344eca6999a27cb6b3d"
        },
        {
          "path": "python/Lib/__pycache__/filecmp.cpython-312.pyc",
          "bytes": 14712,
          "sha256": "150e285ef957788cd72aec21d9c5dddb3662e1240cbd29892aa9388ca0a435e2"
        },
        {
          "path": "python/Lib/__pycache__/fnmatch.cpython-312.pyc",
          "bytes": 6544,
          "sha256": "4395519c021ccf7ef5360ae92b28a8d43bff90d3b3c7285bf96fc2e6d11bcf68"
        },
        {
          "path": "python/Lib/__pycache__/fractions.cpython-312.pyc",
          "bytes": 36802,
          "sha256": "bbb7e4e788a67b82f8fda9e2b13a74d2fabb5d6ecb8e630dbcb8fd699144ec15"
        },
        {
          "path": "python/Lib/__pycache__/functools.cpython-312.pyc",
          "bytes": 40406,
          "sha256": "9dcac893e0c6bb2ef0d8b5b5726f7c682230d0e3d918b49977ff95e0db9f0e1d"
        },
        {
          "path": "python/Lib/__pycache__/getpass.cpython-312.pyc",
          "bytes": 6878,
          "sha256": "3ebf4c384edb0191e8d03a9c7200d05f95b86629f1fe9f1a33ae157bc560747a"
        },
        {
          "path": "python/Lib/__pycache__/gettext.cpython-312.pyc",
          "bytes": 21830,
          "sha256": "4dfeb520067315c541a03f854290d7b2dc8c42f09ed59c17045f03f1514ca15d"
        },
        {
          "path": "python/Lib/__pycache__/glob.cpython-312.pyc",
          "bytes": 9848,
          "sha256": "a7785ba5fec4f14e5bee41106dc728003ac9b0359ec9f02c5e403f7a549bb7a9"
        },
        {
          "path": "python/Lib/__pycache__/gzip.cpython-312.pyc",
          "bytes": 32400,
          "sha256": "05a5914679bedf8de41f389cab9bd2897bd7d62ee94671e23166211dcf1e51dc"
        },
        {
          "path": "python/Lib/__pycache__/hashlib.cpython-312.pyc",
          "bytes": 8127,
          "sha256": "e36bba86d67677e4b9594126b18039c2714714f0430b21fb6909b661925d3a73"
        },
        {
          "path": "python/Lib/__pycache__/heapq.cpython-312.pyc",
          "bytes": 17985,
          "sha256": "47d726a643346e2e1f2fa30ca709c4e91ec5cdabd83030151775209807da50b1"
        },
        {
          "path": "python/Lib/__pycache__/hmac.cpython-312.pyc",
          "bytes": 10738,
          "sha256": "f7417bddbc90a2ae0cbad1f7355b00244670f15826cecb42e928ff22211a07a4"
        },
        {
          "path": "python/Lib/__pycache__/inspect.cpython-312.pyc",
          "bytes": 134427,
          "sha256": "304c68dfdc16ddd5712211a2c102223613ce4154bb6ed3c5baf88e93c97a5faa"
        },
        {
          "path": "python/Lib/__pycache__/ipaddress.cpython-312.pyc",
          "bytes": 93840,
          "sha256": "20df17c2ab5d547dfa6ee8505f896a3c8ab506a334de17cb0daf89d14a676ab0"
        },
        {
          "path": "python/Lib/__pycache__/keyword.cpython-312.pyc",
          "bytes": 1105,
          "sha256": "edb6ff69834cfe89e8d8ece56bdb6ddcd290875bf845fb3e16215cd463840d90"
        },
        {
          "path": "python/Lib/__pycache__/linecache.cpython-312.pyc",
          "bytes": 6613,
          "sha256": "637ac091436628ba5c74f241935fce9dc5395d605b3d1e09418929db2120466a"
        },
        {
          "path": "python/Lib/__pycache__/locale.cpython-312.pyc",
          "bytes": 59552,
          "sha256": "3220178c478058fbde4e3703b918d2b1921291846d846731c44bc491cb2eef77"
        },
        {
          "path": "python/Lib/__pycache__/lzma.cpython-312.pyc",
          "bytes": 15919,
          "sha256": "064f98d874a8dd8535c25c2420b1379aae22dd74022b6e7f3942822999142296"
        },
        {
          "path": "python/Lib/__pycache__/mimetypes.cpython-312.pyc",
          "bytes": 24493,
          "sha256": "069ce403d8c6b0c0b69432c31a8a58ccbd37c6c0eef2ead6836ea76128c3bfa9"
        },
        {
          "path": "python/Lib/__pycache__/netrc.cpython-312.pyc",
          "bytes": 8902,
          "sha256": "c08dd511a8b6cf99c1f9ae2c2ee780b781b1df6eb3134b4ff41c8753c8428ed6"
        },
        {
          "path": "python/Lib/__pycache__/nturl2path.cpython-312.pyc",
          "bytes": 2768,
          "sha256": "4b2f19b2aadb1f0ab0ff73a905291e3680d74ed439f822e2f17bed7de0563078"
        },
        {
          "path": "python/Lib/__pycache__/numbers.cpython-312.pyc",
          "bytes": 14014,
          "sha256": "fecf22deb8f89a0804193679493af6a0e73948d13b9a9e624707de2e564d756f"
        },
        {
          "path": "python/Lib/__pycache__/opcode.cpython-312.pyc",
          "bytes": 14780,
          "sha256": "36ee81ee2e8c2108cf84247d67d8c3d5a87473f0d6f1daa2c6c71d9d09925345"
        },
        {
          "path": "python/Lib/__pycache__/operator.cpython-312.pyc",
          "bytes": 17416,
          "sha256": "bb237898c8e85aa7a9e85e6825312e5472951beaba104f363b3b8fce1e4b286d"
        },
        {
          "path": "python/Lib/__pycache__/optparse.cpython-312.pyc",
          "bytes": 67488,
          "sha256": "329fa0f5d663d3d509233184155d45f14146c1d0eb6f4833a32c51af981c869b"
        },
        {
          "path": "python/Lib/__pycache__/pathlib.cpython-312.pyc",
          "bytes": 61762,
          "sha256": "ecb3305c805400f97839c0e9659a7b4046108e1a200e9dcadd1d5778ace87ca5"
        },
        {
          "path": "python/Lib/__pycache__/pickle.cpython-312.pyc",
          "bytes": 77761,
          "sha256": "ce6d14c519f2e0d4278acb26631e9aa8281f6e55d4d709db14cae9b8ebbbd00b"
        },
        {
          "path": "python/Lib/__pycache__/pkgutil.cpython-312.pyc",
          "bytes": 19934,
          "sha256": "194ec6bb518aa1b5d30e24c3bb31cc4ad98dc901d9303370d6337c5855d81183"
        },
        {
          "path": "python/Lib/__pycache__/platform.cpython-312.pyc",
          "bytes": 41626,
          "sha256": "d5f0394def14f053b0041b8ab62e028a1f306f0388f62e4011940d6a70f535ca"
        },
        {
          "path": "python/Lib/__pycache__/plistlib.cpython-312.pyc",
          "bytes": 41259,
          "sha256": "d8454dd6b5297af78fbc7383b3fd917b68b908522d9c1a3c013c48ef54f5bf94"
        },
        {
          "path": "python/Lib/__pycache__/py_compile.cpython-312.pyc",
          "bytes": 10075,
          "sha256": "df008d7ff5f9730d7a0be93ba1a119cc05e897f45170b00216c4206aa1c29e7f"
        },
        {
          "path": "python/Lib/__pycache__/queue.cpython-312.pyc",
          "bytes": 14706,
          "sha256": "037e72d3e3e120c5d655a1e9159eba668a1d2074d91b2b973befbe20a9f17c69"
        },
        {
          "path": "python/Lib/__pycache__/quopri.cpython-312.pyc",
          "bytes": 9350,
          "sha256": "83a3bf5cc244bb348539961e8a4efeb84c3e8ea7e9968234d9ae6ac789b39dfc"
        },
        {
          "path": "python/Lib/__pycache__/random.cpython-312.pyc",
          "bytes": 33209,
          "sha256": "74097991e689c185ce0cb9f4068a977c742b01a6bff36256e021a73b6c9957d8"
        },
        {
          "path": "python/Lib/__pycache__/reprlib.cpython-312.pyc",
          "bytes": 10290,
          "sha256": "bee6b3d7c330c80c35ab6cffbceb3468da08c233542042ff63fd3ad8e11809e9"
        },
        {
          "path": "python/Lib/__pycache__/selectors.cpython-312.pyc",
          "bytes": 26167,
          "sha256": "4d1e2a206ee62f4606c4409ae904d89cd0775679e9c0f8848d6bb87ddb4f97d4"
        },
        {
          "path": "python/Lib/__pycache__/shlex.cpython-312.pyc",
          "bytes": 14216,
          "sha256": "4b8b3733cb265303a2b7f54a445ce1980ac9daf40034109568d88a6df52b52bb"
        },
        {
          "path": "python/Lib/__pycache__/shutil.cpython-312.pyc",
          "bytes": 65379,
          "sha256": "14bcf1fd97de8fbe726a8fbc31fa9ae2cb468682eebaa5294cb1f75296e86a49"
        },
        {
          "path": "python/Lib/__pycache__/signal.cpython-312.pyc",
          "bytes": 4521,
          "sha256": "4a8e134cce396b058c8a7ae70201101adc58006089f7c4788ff88e64315f9925"
        },
        {
          "path": "python/Lib/__pycache__/socket.cpython-312.pyc",
          "bytes": 42009,
          "sha256": "f7d5098b9ef0951af36ea71ca68c25c34b29b8fd8d7f0829a72bcf2c4da2f9d0"
        },
        {
          "path": "python/Lib/__pycache__/socketserver.cpython-312.pyc",
          "bytes": 34404,
          "sha256": "807d80e52169f40426c90e01d6b6e75a9f874395a8f6d1837c536e86eafba858"
        },
        {
          "path": "python/Lib/__pycache__/ssl.cpython-312.pyc",
          "bytes": 63146,
          "sha256": "8a7cc828c5bcd688afa9730be613817ecde84f88a3ca1a7e74b373291a2fab0b"
        },
        {
          "path": "python/Lib/__pycache__/string.cpython-312.pyc",
          "bytes": 11526,
          "sha256": "05bd09fdc96ab0895e988cd195f50e1ac1801e23c09352090bce53a421000919"
        },
        {
          "path": "python/Lib/__pycache__/stringprep.cpython-312.pyc",
          "bytes": 25211,
          "sha256": "735e8b593de448784209fd37386d50eaf4e003e7f47b4bf84ae76f2facd448f6"
        },
        {
          "path": "python/Lib/__pycache__/struct.cpython-312.pyc",
          "bytes": 389,
          "sha256": "4d195491ee091880db1ae607539dc501bb7b2721a9da3f54ea4a47dc5cd06a31"
        },
        {
          "path": "python/Lib/__pycache__/subprocess.cpython-312.pyc",
          "bytes": 79118,
          "sha256": "8931a888c2eb0782bef11f268b8a3f9cbe60d13aef2b962f4e20694f801ff241"
        },
        {
          "path": "python/Lib/__pycache__/sysconfig.cpython-312.pyc",
          "bytes": 29490,
          "sha256": "df62917139405bc0c1e5d921146432cb41174fed75edfabd19283df3cfe9ebb7"
        },
        {
          "path": "python/Lib/__pycache__/tarfile.cpython-312.pyc",
          "bytes": 124629,
          "sha256": "cc80461c81021487011a5edbb8155fd55af47a4e28b715cde1d54fbde9c640d7"
        },
        {
          "path": "python/Lib/__pycache__/tempfile.cpython-312.pyc",
          "bytes": 40664,
          "sha256": "8fad5a66855d2a91a62e34f4077601b1b210a7a8226d7638e3324f1dfe7b1cf3"
        },
        {
          "path": "python/Lib/__pycache__/textwrap.cpython-312.pyc",
          "bytes": 18344,
          "sha256": "7ee6e1e723ad69f45b8fb3e082e609f9fa245eefeed852fdaf4cf0b4b063f3f2"
        },
        {
          "path": "python/Lib/__pycache__/threading.cpython-312.pyc",
          "bytes": 65280,
          "sha256": "5b0a7e3e541176654481df7823b404880ba8feb18a33d4e895102d38278f4311"
        },
        {
          "path": "python/Lib/__pycache__/token.cpython-312.pyc",
          "bytes": 3633,
          "sha256": "27d957f4b3b2c33e8365c399cc5d49132291958ac4623f745795983ff7f313e3"
        },
        {
          "path": "python/Lib/__pycache__/tokenize.cpython-312.pyc",
          "bytes": 25440,
          "sha256": "df13a248046c68986316b9e5a0b63e258cd71087dc30090036047093b9336f32"
        },
        {
          "path": "python/Lib/__pycache__/traceback.cpython-312.pyc",
          "bytes": 51531,
          "sha256": "eaad6a6da27395c62955238dc98a2ebdc5db0832d470574e0394b0558d56a8c0"
        },
        {
          "path": "python/Lib/__pycache__/types.cpython-312.pyc",
          "bytes": 15009,
          "sha256": "19087649ece8bef31ab1e0375c455e9e80617da9fcd899a276e08a5fead6b273"
        },
        {
          "path": "python/Lib/__pycache__/typing.cpython-312.pyc",
          "bytes": 142450,
          "sha256": "5e6ff5d206a842209ad02829903da963dd8713e4de5dcd3973bee484513b614c"
        },
        {
          "path": "python/Lib/__pycache__/uuid.cpython-312.pyc",
          "bytes": 33033,
          "sha256": "a9016c69a654f16e4e91b36a019e76139fb42124b43ba3705b58a641a5d4f92e"
        },
        {
          "path": "python/Lib/__pycache__/warnings.cpython-312.pyc",
          "bytes": 23891,
          "sha256": "e4c23a297c5e1110e80f572aaf6a819fda286a2c66a4c0205a6b05bf31f6c128"
        },
        {
          "path": "python/Lib/__pycache__/weakref.cpython-312.pyc",
          "bytes": 31275,
          "sha256": "d5592519e298b1edb57290801c8caf1e8e34bc7a3d3d34abc137975467c93bda"
        },
        {
          "path": "python/Lib/_aix_support.py",
          "bytes": 4021,
          "sha256": "0982f187c62fbfc1e8d368c8eb4104b56df71009a6b2823565a699e7b4cd945c"
        },
        {
          "path": "python/Lib/_collections_abc.py",
          "bytes": 32089,
          "sha256": "d4945c8410c4bab351741b04bca3de066f7c27ed7e38df89e206a96617102ffb"
        },
        {
          "path": "python/Lib/_compat_pickle.py",
          "bytes": 8761,
          "sha256": "12c8356a3d40bd0a336f13d7c6e2bed50d5c1a876563766a3175a6b328b5855e"
        },
        {
          "path": "python/Lib/_compression.py",
          "bytes": 5681,
          "sha256": "3ad5d60627477a60939ee44fc1bb3a05dbe8fb52f0f75039b8f5d8f1a278b981"
        },
        {
          "path": "python/Lib/_markupbase.py",
          "bytes": 14653,
          "sha256": "cb14dd6f2e2439eb70b806cd49d19911363d424c2b6b9f4b73c9c08022d47030"
        },
        {
          "path": "python/Lib/_osx_support.py",
          "bytes": 22023,
          "sha256": "363d3240acbba18a270bd3161f1ddb478f8492dc14fc451b2dc314db5c5ee09c"
        },
        {
          "path": "python/Lib/_py_abc.py",
          "bytes": 6189,
          "sha256": "f9c6fe3dd9b51bd7d93f867356e9d362600c924febfd903ee1c6e298860dca92"
        },
        {
          "path": "python/Lib/_pydatetime.py",
          "bytes": 92087,
          "sha256": "a03268abe53ccab406fa29cdfcf75b89f7f485d9e6523e00c448ff7a9961dd26"
        },
        {
          "path": "python/Lib/_pydecimal.py",
          "bytes": 227283,
          "sha256": "87a3372df4c4269adcdac5725e04675d306abcfa8d65e8dda59c1846e3d202ac"
        },
        {
          "path": "python/Lib/_pyio.py",
          "bytes": 93593,
          "sha256": "22a2730be3230802593c75c930387e635809c6d82420e5234ef8d9cd1166ac8d"
        },
        {
          "path": "python/Lib/_pylong.py",
          "bytes": 10790,
          "sha256": "05da132ba902633430bf12b5007fa1983630de423e29402998e9edc349bdf591"
        },
        {
          "path": "python/Lib/_sitebuiltins.py",
          "bytes": 3128,
          "sha256": "b9388bc1d6d12ed6be12da420ab1feca40f99c0e33ec315d92b1e01cb69b25bc"
        },
        {
          "path": "python/Lib/_strptime.py",
          "bytes": 28393,
          "sha256": "dcec0ad5efc41dd29fb125b477530ef22c70da117b59fa49cec39aae04e1f868"
        },
        {
          "path": "python/Lib/_threading_local.py",
          "bytes": 7220,
          "sha256": "e1bf3dae66d0bfa63c8bb8a1d10c611203c35c636f7f5191fd56105788ef29cb"
        },
        {
          "path": "python/Lib/_weakrefset.py",
          "bytes": 5893,
          "sha256": "91895a451d06e9f521a1171b31b9b19bc9740f35af00d4fa106338ab7167c9ac"
        },
        {
          "path": "python/Lib/abc.py",
          "bytes": 6538,
          "sha256": "e558702a95cdce3febd289da021715d2b92bc43995b8a1bc58dfa1c3d8010287"
        },
        {
          "path": "python/Lib/aifc.py",
          "bytes": 34211,
          "sha256": "e027e8a33567890ad7f84fea3be423cc0f6e49a33a31bbf279c2d0f64b6f8345"
        },
        {
          "path": "python/Lib/antigravity.py",
          "bytes": 500,
          "sha256": "8a5ee63e1b79ba2733e7ff4290b6eefea60e7f3a1ccb6bb519535aaf92b44967"
        },
        {
          "path": "python/Lib/argparse.py",
          "bytes": 101155,
          "sha256": "7cc582dcb3b76e2c957f78a3f74e9809d6c311d6aab7bcaa2c9954d0cbff5f30"
        },
        {
          "path": "python/Lib/ast.py",
          "bytes": 64452,
          "sha256": "b515c23dbbc459329d3b802a3aac742cc456d7472e66f7ed6e9dc97e40596d7d"
        },
        {
          "path": "python/Lib/asyncio/__init__.py",
          "bytes": 1220,
          "sha256": "61102f2b5f8fb832f0558cb66391f227970b3dd34ea2a621455587b4295e89a1"
        },
        {
          "path": "python/Lib/asyncio/__main__.py",
          "bytes": 3491,
          "sha256": "c1e67c3b5f5d964029b407e71397d9d93d8b545abde482ffb0eab02dd16ad820"
        },
        {
          "path": "python/Lib/asyncio/base_events.py",
          "bytes": 78567,
          "sha256": "53b71bbbd79e7fb2251460119afc379ebd71bbc599d9018313cc62ef218ae795"
        },
        {
          "path": "python/Lib/asyncio/base_futures.py",
          "bytes": 1974,
          "sha256": "2f3798c4b82f5ac77647908b157c924f734f36871d98970e72849ea9a9a07856"
        },
        {
          "path": "python/Lib/asyncio/base_subprocess.py",
          "bytes": 8869,
          "sha256": "d69ba8f97bf8c89564cadce49427574ddb98103a5db6f04b98798240332e7adf"
        },
        {
          "path": "python/Lib/asyncio/base_tasks.py",
          "bytes": 2672,
          "sha256": "56efac65b63db927af336fa55eb5bda93c97a2defa4734ea8d695ed20fd6712a"
        },
        {
          "path": "python/Lib/asyncio/constants.py",
          "bytes": 1413,
          "sha256": "873fc2f9e66313c3c19c337269e704f204b59f9e91d6ecbec59f68335484d338"
        },
        {
          "path": "python/Lib/asyncio/coroutines.py",
          "bytes": 3342,
          "sha256": "2feec17557c230a80cc2a6391bbb1c44b9f3341820b05667e36a4eb12b749436"
        },
        {
          "path": "python/Lib/asyncio/events.py",
          "bytes": 29339,
          "sha256": "6a18b7eee5926622c146e61a7eb39726b4656e07ca41d36b06936ffb2354f0ed"
        },
        {
          "path": "python/Lib/asyncio/exceptions.py",
          "bytes": 1752,
          "sha256": "a5971f88be14cd1417d59adf539ae48c5d818f95362a4e0eb00017e3690ab37b"
        },
        {
          "path": "python/Lib/asyncio/format_helpers.py",
          "bytes": 2404,
          "sha256": "6377b672b3f4ba8b6f0f7a5f0ea00cde24c8cddc0ca764e3329f302763477f59"
        },
        {
          "path": "python/Lib/asyncio/futures.py",
          "bytes": 14340,
          "sha256": "f6daaf2a051fc61ea146811d7d4b4db1cac31d7f4777aa4d10617812d78bd943"
        },
        {
          "path": "python/Lib/asyncio/locks.py",
          "bytes": 18995,
          "sha256": "5234295a0456e9a6ba2e80446848b602cd9195bca4fca2c711c6e3f41989cd86"
        },
        {
          "path": "python/Lib/asyncio/log.py",
          "bytes": 124,
          "sha256": "80e4cc3ded4b138baba486519e7444801a23d6ac35f229d336a407a96af7e8d2"
        },
        {
          "path": "python/Lib/asyncio/mixins.py",
          "bytes": 481,
          "sha256": "8f4a3e16eca845ebfba422550cbcee7340ec8166d2bff6b750a8ed0de6b9ae3c"
        },
        {
          "path": "python/Lib/asyncio/proactor_events.py",
          "bytes": 33500,
          "sha256": "62d15e99315cae52e8548f487391ae6c46827bf8e5b4bcf3382c777a494a759b"
        },
        {
          "path": "python/Lib/asyncio/protocols.py",
          "bytes": 6957,
          "sha256": "1d1b49988c338b4ef06e30f9e92d9db2e00080c341f0a3f573bb8312deb8aff6"
        },
        {
          "path": "python/Lib/asyncio/queues.py",
          "bytes": 7974,
          "sha256": "8f020744ebd1f557dcb051a1530b504447660df906c2127a94bbcc8450ea7ef9"
        },
        {
          "path": "python/Lib/asyncio/runners.py",
          "bytes": 7230,
          "sha256": "739e0ecbb335cfec821a39f9e225583b5911bb6e3894ef93782005f852c54263"
        },
        {
          "path": "python/Lib/asyncio/selector_events.py",
          "bytes": 48332,
          "sha256": "b77c4b8a85f1e1e2882a2bf3bd85a4b1c1fcfd7cb37ed0d8d8eb5f9a2ea44231"
        },
        {
          "path": "python/Lib/asyncio/sslproto.py",
          "bytes": 31899,
          "sha256": "6c7fa1b81dc41850281cbf284c99ca18e824939fa5778860327040f3a80f6218"
        },
        {
          "path": "python/Lib/asyncio/staggered.py",
          "bytes": 7077,
          "sha256": "3998d04fcff2c8052af03f3f34dbd3bd510b2dadddd5f2629a2c1cccbecd136d"
        },
        {
          "path": "python/Lib/asyncio/streams.py",
          "bytes": 27619,
          "sha256": "6ec5c70fd95b0d51cc1e81cd21e8abe8c1b69650148d6bb75ab4aa4797319bd4"
        },
        {
          "path": "python/Lib/asyncio/subprocess.py",
          "bytes": 7737,
          "sha256": "7b70605716334f63cc482123b2aaa3b7c5bb7138eeab63a037bd8068d43307c1"
        },
        {
          "path": "python/Lib/asyncio/taskgroups.py",
          "bytes": 9559,
          "sha256": "1d2bcd2da66524b45024841b94100cd6e7a7825a1b8f8ee125bf16b4ad0ca9bc"
        },
        {
          "path": "python/Lib/asyncio/tasks.py",
          "bytes": 37362,
          "sha256": "6f6aad82d597fea1800004075b9a2481604da0035f1143af1eb267823ec460e3"
        },
        {
          "path": "python/Lib/asyncio/threads.py",
          "bytes": 790,
          "sha256": "39d37295383641565f0c08bd992e2f661dc8051eb17e890b834fce96bde0910e"
        },
        {
          "path": "python/Lib/asyncio/timeouts.py",
          "bytes": 5321,
          "sha256": "3e40ca0dca3e54776579797837cd4936d73d04aae09fe0cf83ce1e5449d00163"
        },
        {
          "path": "python/Lib/asyncio/transports.py",
          "bytes": 10722,
          "sha256": "940108bc133de399f38928cad3274f463096168d8a3ee5148f2478d3cb636f1c"
        },
        {
          "path": "python/Lib/asyncio/trsock.py",
          "bytes": 2475,
          "sha256": "c0eac37debcc51b702b808f6b7ed3e417343f5ff5f57125dad600a27eb082328"
        },
        {
          "path": "python/Lib/asyncio/unix_events.py",
          "bytes": 53124,
          "sha256": "1fff06cce78763800f05f4d2bebfcdbc07ebf9564ca7e7222e0d91e39dee08c9"
        },
        {
          "path": "python/Lib/asyncio/windows_events.py",
          "bytes": 32587,
          "sha256": "163927e5834c10c6c106d81cf3cfd568fd1ced7fa34d857836447d3c4cc7a9d3"
        },
        {
          "path": "python/Lib/asyncio/windows_utils.py",
          "bytes": 5060,
          "sha256": "e6fcffefa2521666bc2aed0f5caf8e862c1c1014ad12d2ab5fbce09c2df9c6f0"
        },
        {
          "path": "python/Lib/base64.py",
          "bytes": 20635,
          "sha256": "8d1f608dbf030d11d6ec4df9e4c55b73fb68cdfbd9f53a7c91684a93b55564b5"
        },
        {
          "path": "python/Lib/bdb.py",
          "bytes": 33573,
          "sha256": "171ba6b07dc5d3b9f718f3890fedc97e1fe750e39855f4342d71514169ccc29a"
        },
        {
          "path": "python/Lib/bisect.py",
          "bytes": 3423,
          "sha256": "f1cf7b85fc36b5da249813fc5ab97d9464f8cc1bc817f7146206fa2713e35999"
        },
        {
          "path": "python/Lib/bz2.py",
          "bytes": 11847,
          "sha256": "76ab3252924e71e859d7d90e8d3db13b6554975cfcac0fdadced4de7f8779330"
        },
        {
          "path": "python/Lib/calendar.py",
          "bytes": 25864,
          "sha256": "0010004d32c694e4afa554db2434952040819c09c438e88d465dcf6d9fb63718"
        },
        {
          "path": "python/Lib/cgi.py",
          "bytes": 34420,
          "sha256": "f132666784c29a3e275f50596f87bb8abc388a94fcdb70be130000e01a9a6b78"
        },
        {
          "path": "python/Lib/cgitb.py",
          "bytes": 12421,
          "sha256": "08bbcca13a431551da73a2144c13f21e68cb79ac82223fbe5e60fcf89ce10f9c"
        },
        {
          "path": "python/Lib/chunk.py",
          "bytes": 5500,
          "sha256": "4817eb94eeb8835c3325433f68f17e0ebbf7c96065ecf6aba3af7852f9a5314b"
        },
        {
          "path": "python/Lib/cmd.py",
          "bytes": 14873,
          "sha256": "fb82a8c4e44e5b559c88d516d79051534cec69a463df97defe05ac8a261f0a0d"
        },
        {
          "path": "python/Lib/code.py",
          "bytes": 10962,
          "sha256": "dab54e60985a3770782a7f031b6a80f91009c372465a09cdd1221b2ca03080eb"
        },
        {
          "path": "python/Lib/codecs.py",
          "bytes": 36870,
          "sha256": "7b7839e53a77961153240aecfe11edc8054d05b1dedd83894450dae21ec05785"
        },
        {
          "path": "python/Lib/codeop.py",
          "bytes": 5908,
          "sha256": "3fb545862a1f9030c0d8f1ae6c72457d14a26d67a9b45de455e49900ff84a3a9"
        },
        {
          "path": "python/Lib/collections/__init__.py",
          "bytes": 52378,
          "sha256": "7fdb04dd248ab37909f46d2085bfee56b32d7e91e49ad3a2fad99c453295659b"
        },
        {
          "path": "python/Lib/collections/__pycache__/__init__.cpython-312.pyc",
          "bytes": 73001,
          "sha256": "03bc2e8a91da2e214440e31ebb3160d8ca3158c953018f273c9929de6b2a2b03"
        },
        {
          "path": "python/Lib/collections/__pycache__/abc.cpython-312.pyc",
          "bytes": 313,
          "sha256": "caf36e71b0d9ee2c229b2136b404c52ce13d8cc2fbc80456b0ca68a6bed887e4"
        },
        {
          "path": "python/Lib/collections/abc.py",
          "bytes": 119,
          "sha256": "9cb4208f99128a0489b6c8e6c61637617dd7d4250c59e065491957eda084dd10"
        },
        {
          "path": "python/Lib/colorsys.py",
          "bytes": 4062,
          "sha256": "65e3dfbf7bad61d4d7d7731a69dd7e75a347fd350d91327a51010a94e6fd2f1d"
        },
        {
          "path": "python/Lib/compileall.py",
          "bytes": 20507,
          "sha256": "588f003bb5088ce380f3c335febaec1318811d275e5554b106655c4ceebabcfb"
        },
        {
          "path": "python/Lib/concurrent/__init__.py",
          "bytes": 38,
          "sha256": "87ad5c8954dd56fbbca04517bf87477ff4dce575170c7dd1281d7ef1f4214ac8"
        },
        {
          "path": "python/Lib/concurrent/futures/__init__.py",
          "bytes": 1583,
          "sha256": "9b597f6de7da771109ca7bf96a1af5ea4d5fda69b27b39312d34966d987f73cd"
        },
        {
          "path": "python/Lib/concurrent/futures/_base.py",
          "bytes": 22833,
          "sha256": "8c6d5f09f7c535d40fa1c30ebfcb35e0601c2abf32286a82cf151af7ddf72473"
        },
        {
          "path": "python/Lib/concurrent/futures/process.py",
          "bytes": 35854,
          "sha256": "66b4fe880563a604ac4a094b72c6535b56b3bb8b14f4b6025705d53d28816fba"
        },
        {
          "path": "python/Lib/concurrent/futures/thread.py",
          "bytes": 8946,
          "sha256": "fe940a20adc4d3e66a8ea42a4c7e6c16957b011e8ada50c4e7a7bddbcbbffa0d"
        },
        {
          "path": "python/Lib/configparser.py",
          "bytes": 54205,
          "sha256": "cf5318e0c45a2e206b4ec74d4d66493185ed26c3736a86b0ebdf8f3a3e365a1a"
        },
        {
          "path": "python/Lib/contextlib.py",
          "bytes": 27637,
          "sha256": "8b7a477f978a8532852fd81e241c78182516bc4975d672d580a5848a76e11eb6"
        },
        {
          "path": "python/Lib/contextvars.py",
          "bytes": 129,
          "sha256": "5ed260be8d1f4fe92261b7810b4bb1e8539c42093d7493f677d076e1a87f459a"
        },
        {
          "path": "python/Lib/copy.py",
          "bytes": 8412,
          "sha256": "cbd25547933176fcf6bb05c2adc9f4796d15ac20b9b82dcf890daea7203daeab"
        },
        {
          "path": "python/Lib/copyreg.py",
          "bytes": 7614,
          "sha256": "c8eda41f05c6bf95a4da4726a530409d2485ae060b8d019b3a8034389a15d3e9"
        },
        {
          "path": "python/Lib/cProfile.py",
          "bytes": 6556,
          "sha256": "c4c3edb84862431dffd6c044f5c02bb27f94e5b79a708bce195a7981efcb43bc"
        },
        {
          "path": "python/Lib/crypt.py",
          "bytes": 3913,
          "sha256": "208df2ff33c19056345dcf5474abef1a58da799e2f3bab09d1d28b77ad3c623d"
        },
        {
          "path": "python/Lib/csv.py",
          "bytes": 17132,
          "sha256": "2fd2a39ec59a5cbcd71596a93205001e593c65dc2ca3bef6028f148372028a88"
        },
        {
          "path": "python/Lib/ctypes/__init__.py",
          "bytes": 18210,
          "sha256": "e0db1242e78267cba0124ee9fe5963b72d1c8a1832bb51a88abcf012a9cbce76"
        },
        {
          "path": "python/Lib/ctypes/__pycache__/__init__.cpython-312.pyc",
          "bytes": 23515,
          "sha256": "14972f56ff8190bda57501baefb3158ee57321d7e81c9d158bb35262638aa9d8"
        },
        {
          "path": "python/Lib/ctypes/__pycache__/_endian.cpython-312.pyc",
          "bytes": 3420,
          "sha256": "29b404635ee031e07266b036013f95bc134da998bda17f8f228501cd98cff0a3"
        },
        {
          "path": "python/Lib/ctypes/__pycache__/wintypes.cpython-312.pyc",
          "bytes": 8542,
          "sha256": "4b4b64f74d681ba2e5dc1837723cdf64d60056972d5881566225c201bfb52066"
        },
        {
          "path": "python/Lib/ctypes/_aix.py",
          "bytes": 12505,
          "sha256": "540e2821fa36981bde5c6ffb8f972474b06db4a37c1854c0e0e379b75d2b0fa3"
        },
        {
          "path": "python/Lib/ctypes/_endian.py",
          "bytes": 2535,
          "sha256": "c5d692bdce10dfee242752620061bab684633bc72445a3def484961ef1bdbf3a"
        },
        {
          "path": "python/Lib/ctypes/macholib/__init__.py",
          "bytes": 154,
          "sha256": "1e77c01eec8f167ed10b754f153c0c743c8e5196ae9c81dffc08f129ab56dbfd"
        },
        {
          "path": "python/Lib/ctypes/macholib/dyld.py",
          "bytes": 5024,
          "sha256": "eb8e7b17f1533bc3e86e23e8695f7a5e4b7a99ef1b1575d10af54f389161b655"
        },
        {
          "path": "python/Lib/ctypes/macholib/dylib.py",
          "bytes": 960,
          "sha256": "f19ee056b18165cc6735efab0b4ca3508be9405b9646c38113316c15e8278a6f"
        },
        {
          "path": "python/Lib/ctypes/macholib/fetch_macholib",
          "bytes": 84,
          "sha256": "a9f6faacdb1aa00ac2f68043cd445171de9639a732b861bd5e64090a2865ab23"
        },
        {
          "path": "python/Lib/ctypes/macholib/fetch_macholib.bat",
          "bytes": 75,
          "sha256": "7497fbdbb98afca4ac455e3a057c59bcdebaf1280e25c94741dc301f05cb53e5"
        },
        {
          "path": "python/Lib/ctypes/macholib/framework.py",
          "bytes": 1105,
          "sha256": "302439e40d9cbdd61b8b7cffd0b7e1278a6811b635044ee366a36e0d991f62da"
        },
        {
          "path": "python/Lib/ctypes/macholib/README.ctypes",
          "bytes": 296,
          "sha256": "dc29d1da83b6a0a09a41647e4111eee878ed079c2d6b54a98fd6d8b88dd581f2"
        },
        {
          "path": "python/Lib/ctypes/util.py",
          "bytes": 13959,
          "sha256": "a54310b64a080b0103f3de5df86b21d884bc2985760f3596ab85d458eae8cba5"
        },
        {
          "path": "python/Lib/ctypes/wintypes.py",
          "bytes": 5629,
          "sha256": "5c4d9ba1a21683838ed1d1f007b6038304e42aacf34c576e820311d26cb243f3"
        },
        {
          "path": "python/Lib/curses/__init__.py",
          "bytes": 3369,
          "sha256": "d8730e360dd00ec046bdd85cae41fe83c907c6ae3716a964158fce8f31ab28b0"
        },
        {
          "path": "python/Lib/curses/ascii.py",
          "bytes": 2543,
          "sha256": "780dd8bbaf0ee7e832f164c1772953e694a9cd1031d1ab1471af65344d3645e6"
        },
        {
          "path": "python/Lib/curses/has_key.py",
          "bytes": 5634,
          "sha256": "15a052812d9ae80124bb25b3f5b9ffae38e2b03073774e163abf3d773140cfb3"
        },
        {
          "path": "python/Lib/curses/panel.py",
          "bytes": 87,
          "sha256": "13ef404a30da1825a612ca3e453db88c305d45deef4441c4c9e2ef7ee0ef50c7"
        },
        {
          "path": "python/Lib/curses/textpad.py",
          "bytes": 7754,
          "sha256": "6fd91c3fd9f4a6f213979a2c1df6b737c49c95d9c3acf22cf40cfdb1f88fb737"
        },
        {
          "path": "python/Lib/dataclasses.py",
          "bytes": 62085,
          "sha256": "d242aea5fcf6408b1c1f622442f88f68b9526ce1f8bd2890d74a144677c427d9"
        },
        {
          "path": "python/Lib/datetime.py",
          "bytes": 268,
          "sha256": "ef20dc6b3554cd585dddffdc573f1f9a7a54c522f2a3fb4576c44edbb1e14238"
        },
        {
          "path": "python/Lib/dbm/__init__.py",
          "bytes": 5882,
          "sha256": "389407b292f30c38a334599d2546ca1fea316b038a5252f985bbccfce6c8453b"
        },
        {
          "path": "python/Lib/dbm/dumb.py",
          "bytes": 11594,
          "sha256": "c99202d9eb4e25a023715a1b804c886fdb7d9f957730959bb071a57d607443b5"
        },
        {
          "path": "python/Lib/dbm/gnu.py",
          "bytes": 72,
          "sha256": "36cd4904f50e00c4df4ad9d450b3970e150957425f47c00cf979ba73eff49778"
        },
        {
          "path": "python/Lib/dbm/ndbm.py",
          "bytes": 70,
          "sha256": "1bcc2d9b2fad1901f3421a174eeecb5b8ccc6763283b87bbe0705b404c71904b"
        },
        {
          "path": "python/Lib/decimal.py",
          "bytes": 2805,
          "sha256": "c3e37c55ef72b3dd6cb7b466a907b966467b6a9c58d85302193e64cbb5fd53d0"
        },
        {
          "path": "python/Lib/difflib.py",
          "bytes": 83368,
          "sha256": "3eb2d371b4a171b063921de6bbf115108bc39de8bf72866315868ce2599213b7"
        },
        {
          "path": "python/Lib/dis.py",
          "bytes": 30227,
          "sha256": "44c0b389c96124d8fb5cb0bc41c7a2aa7a6848ef4001b4000dcbd858efa4a1a2"
        },
        {
          "path": "python/Lib/doctest.py",
          "bytes": 106749,
          "sha256": "8fb954ef7e775270461f1baf1331749cab6765a4006d0183cb8a0dfede1bbdc8"
        },
        {
          "path": "python/Lib/email/__init__.py",
          "bytes": 1764,
          "sha256": "e4f46e3414c4602c9abb8b404a45e84412fc49dbe38a3d163f9575132dc7c93e"
        },
        {
          "path": "python/Lib/email/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1966,
          "sha256": "4620af49da94301b95026e8704607d74125869b9560e6580c8d19f022e3898f5"
        },
        {
          "path": "python/Lib/email/__pycache__/_encoded_words.cpython-312.pyc",
          "bytes": 8353,
          "sha256": "538cb9cd052af03534397b5e67b8a46b2b623cac653050cd92ef0367b3c61af9"
        },
        {
          "path": "python/Lib/email/__pycache__/_parseaddr.cpython-312.pyc",
          "bytes": 23292,
          "sha256": "4f42776f468cca62749baa3888081bba8fcdcbbc16f6e55ac923ef7a1bd8c8a0"
        },
        {
          "path": "python/Lib/email/__pycache__/_policybase.cpython-312.pyc",
          "bytes": 18681,
          "sha256": "1b9f659f151fc927337cd04ca5fe4f3820288a2efb13bffc1304da01d6c11de6"
        },
        {
          "path": "python/Lib/email/__pycache__/base64mime.cpython-312.pyc",
          "bytes": 3992,
          "sha256": "29ce7a77888695db2f660a656a1601092894df56ee69687520a016d1cc0d331a"
        },
        {
          "path": "python/Lib/email/__pycache__/charset.cpython-312.pyc",
          "bytes": 15290,
          "sha256": "c5631eee972288d1866507b6d122fc186f97a8704f05723184bb1d008293f565"
        },
        {
          "path": "python/Lib/email/__pycache__/encoders.cpython-312.pyc",
          "bytes": 2136,
          "sha256": "0247698e40a5ab564f30e91f30e3e3ad1e9ca332fb8926e8680411ef16685b50"
        },
        {
          "path": "python/Lib/email/__pycache__/errors.cpython-312.pyc",
          "bytes": 7068,
          "sha256": "713d328ad90071be5f2694af5e06bad9323e74df14d12abeb83b0b411b8368aa"
        },
        {
          "path": "python/Lib/email/__pycache__/feedparser.cpython-312.pyc",
          "bytes": 19845,
          "sha256": "a6636c4818046d9e86e68f3e5da4eeb14d2e1bc1ba0c74c5d9be81d5039c9a68"
        },
        {
          "path": "python/Lib/email/__pycache__/header.cpython-312.pyc",
          "bytes": 24556,
          "sha256": "e759f45891662335cce0398cd8568026dc8cab5cbdd20f757e532aad0cfa0585"
        },
        {
          "path": "python/Lib/email/__pycache__/iterators.cpython-312.pyc",
          "bytes": 2846,
          "sha256": "3b2da75778e278d8605f77f811ed659f6adeda649c7f20715feabec65756c0c4"
        },
        {
          "path": "python/Lib/email/__pycache__/message.cpython-312.pyc",
          "bytes": 53156,
          "sha256": "28f2a3c24597f785d6948b6ba2bf627c04e667ea8f9802bcea0910dbe058210b"
        },
        {
          "path": "python/Lib/email/__pycache__/parser.cpython-312.pyc",
          "bytes": 6793,
          "sha256": "1da8d22e772d226ca50e2bb3d2c3d78536976394953c69a2fa04aaa3ccee9487"
        },
        {
          "path": "python/Lib/email/__pycache__/quoprimime.cpython-312.pyc",
          "bytes": 9997,
          "sha256": "258e6e4137b9424d435248d075edb4f4011c3dbb8428635886979ef2a175a0c1"
        },
        {
          "path": "python/Lib/email/__pycache__/utils.cpython-312.pyc",
          "bytes": 16017,
          "sha256": "46e85d32435e978e332f72c478bd7fe1896ed36182955a476393cec8d627388c"
        },
        {
          "path": "python/Lib/email/_encoded_words.py",
          "bytes": 8541,
          "sha256": "4178321600c0a19ca04cfe8542ce44487f339d15d89a473b58cea63c0b230217"
        },
        {
          "path": "python/Lib/email/_header_value_parser.py",
          "bytes": 111685,
          "sha256": "fde2476258d76ae53259f377778cdacdbaca421c2424acada1ef5a94245892cb"
        },
        {
          "path": "python/Lib/email/_parseaddr.py",
          "bytes": 17821,
          "sha256": "4308932872acbf4a674312a45a49b870e48026e3dfedc878ee2f512ddf2f30ba"
        },
        {
          "path": "python/Lib/email/_policybase.py",
          "bytes": 15535,
          "sha256": "284be073d7fe99d1021958e6dbeefe4c98a6c00021ea465d01aac71338d1579f"
        },
        {
          "path": "python/Lib/email/architecture.rst",
          "bytes": 9561,
          "sha256": "f2b2ba7497fd02d13abcfc2a98099283a94b09e8b4f2c1c822ecacde3bec3eae"
        },
        {
          "path": "python/Lib/email/base64mime.py",
          "bytes": 3551,
          "sha256": "e2b4b87a5f42a8c5780e343f675513bbcc6abdd23fa14f8f1a7d4f7d72304770"
        },
        {
          "path": "python/Lib/email/charset.py",
          "bytes": 17063,
          "sha256": "a90653f13a4dc5eb3205079dda1d62561a8bf9a7b45585f5dbf90aa31a966680"
        },
        {
          "path": "python/Lib/email/contentmanager.py",
          "bytes": 10588,
          "sha256": "2d81026aef17e4786b15d9ec0629304987e3f275a0fd0a421a81b4ed87234b2c"
        },
        {
          "path": "python/Lib/email/encoders.py",
          "bytes": 1778,
          "sha256": "690b275529788cc48e8f541a2aef321dc31e92f75764ac7924896db72d8a9555"
        },
        {
          "path": "python/Lib/email/errors.py",
          "bytes": 3814,
          "sha256": "dbfb4bbfc85e9d556d3385dc6356518846d8a122bc643b171ea61b6e8dc42c8b"
        },
        {
          "path": "python/Lib/email/feedparser.py",
          "bytes": 22796,
          "sha256": "6046239fcdd6977d1c25841581cabedaeec8046cc5fedcb8ff2d6450a36442bd"
        },
        {
          "path": "python/Lib/email/generator.py",
          "bytes": 21403,
          "sha256": "1cf088e6632b61b7c428caa8b5007b18e405fba68055716a11bd3ceb55c0d4c7"
        },
        {
          "path": "python/Lib/email/header.py",
          "bytes": 24092,
          "sha256": "4d9baa908ad5288dd8fad8cf20b3802ffac77ba1642727804a633b201c56e5ca"
        },
        {
          "path": "python/Lib/email/headerregistry.py",
          "bytes": 20819,
          "sha256": "fada56c25b6a457c6a62af43f9f929bbc29424103ce65f40f114adb4fdf3d39f"
        },
        {
          "path": "python/Lib/email/iterators.py",
          "bytes": 2129,
          "sha256": "1080a2d03779176d6d45f6ecd976dbe69f5579f7e4e83b75224c3f92fd258102"
        },
        {
          "path": "python/Lib/email/message.py",
          "bytes": 48396,
          "sha256": "ba32efea2602ea52e73028a2817afddccccacc4385b9800896556d5c22db2b90"
        },
        {
          "path": "python/Lib/email/mime/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/email/mime/application.py",
          "bytes": 1321,
          "sha256": "b82a944ccba03e7e7eec46232e50ffe4ce2c32f4b0e26662e6bde30d533584ae"
        },
        {
          "path": "python/Lib/email/mime/audio.py",
          "bytes": 3094,
          "sha256": "856263b25a3384a7450a1a0b9869fb897b84f893b2e7147c7e045ae50d132cd3"
        },
        {
          "path": "python/Lib/email/mime/base.py",
          "bytes": 914,
          "sha256": "9a7b36653b5657525a0aeeaa72d4a0b09f598e6edc29c139c2dc2612b7d29fb8"
        },
        {
          "path": "python/Lib/email/mime/image.py",
          "bytes": 3726,
          "sha256": "460be5b50cfcaab8e72a73f24f14ab062cedf1a40a775b8b0d80c13aed44bb5e"
        },
        {
          "path": "python/Lib/email/mime/message.py",
          "bytes": 1315,
          "sha256": "30fccea73b874b5ddaccbd3c64936833749ff039f08d40524c1b0b25b8e8e2b8"
        },
        {
          "path": "python/Lib/email/mime/multipart.py",
          "bytes": 1619,
          "sha256": "8bf2beca6de95d66f12968380a428d3bb0a28a8a6ea2078da521511e1ed80a38"
        },
        {
          "path": "python/Lib/email/mime/nonmultipart.py",
          "bytes": 689,
          "sha256": "4eb9ad32603d66fc9d55aebcc4d3cf759edd9e95a591d38690659afb2e57b050"
        },
        {
          "path": "python/Lib/email/mime/text.py",
          "bytes": 1394,
          "sha256": "71c56a41675a36801259c9946f7b7bf838e6c29c453ba8c34d89401f2b972d6c"
        },
        {
          "path": "python/Lib/email/parser.py",
          "bytes": 4975,
          "sha256": "88890ea9994c55ff7d6c1fd570fece2785f51ed407ee95df4aff946e250bcd66"
        },
        {
          "path": "python/Lib/email/policy.py",
          "bytes": 10614,
          "sha256": "35fcbece24fac56fdefe15c93351eefda47c3440204746b8519e71d4633b0f3e"
        },
        {
          "path": "python/Lib/email/quoprimime.py",
          "bytes": 9864,
          "sha256": "77b454bd3ba3b5e3776be28ae3a0fd8de5d1e50d5b8ee10dd539c37c2bd68082"
        },
        {
          "path": "python/Lib/email/utils.py",
          "bytes": 16071,
          "sha256": "65d259aded3b7d29609d320decdb59cb0a0f7f0e5c453e1d3c380e8a4a5d61c9"
        },
        {
          "path": "python/Lib/encodings/__init__.py",
          "bytes": 5884,
          "sha256": "78c4744d407690f321565488710b5aaf6486b5afa8d185637aa1e7633ab59cd8"
        },
        {
          "path": "python/Lib/encodings/__pycache__/__init__.cpython-312.pyc",
          "bytes": 5839,
          "sha256": "1c4eaa87ab3cfca0b00af24023454939bc343d0c4835052ab5648e31b118a020"
        },
        {
          "path": "python/Lib/encodings/__pycache__/aliases.cpython-312.pyc",
          "bytes": 12472,
          "sha256": "a2c97768e98b4f47a1379fbd213a33dcfb653310628172bfaabe6af720154690"
        },
        {
          "path": "python/Lib/encodings/__pycache__/cp1252.cpython-312.pyc",
          "bytes": 3196,
          "sha256": "7a195067a3eb62d19463e7b0b46e99597beec0145f585ff7f6f392a98a2b86d7"
        },
        {
          "path": "python/Lib/encodings/__pycache__/cp437.cpython-312.pyc",
          "bytes": 13331,
          "sha256": "6ce6d02bfe018aab3d239559456f02974fc0b141e79029120a1b8b9bec11529d"
        },
        {
          "path": "python/Lib/encodings/__pycache__/gbk.cpython-312.pyc",
          "bytes": 2052,
          "sha256": "30e6a25cff374f3a7627267b5eb81baa84f59ad13408ea769518eb4094116261"
        },
        {
          "path": "python/Lib/encodings/__pycache__/hex_codec.cpython-312.pyc",
          "bytes": 3032,
          "sha256": "c40d0483addf02f9005cdee23393e16e599a17fc54758fb8f430098650b97fcd"
        },
        {
          "path": "python/Lib/encodings/__pycache__/idna.cpython-312.pyc",
          "bytes": 9928,
          "sha256": "c67e24df2003c8f35b7a249aa288989373936588d663657b6937967eaa92ba6f"
        },
        {
          "path": "python/Lib/encodings/__pycache__/utf_8_sig.cpython-312.pyc",
          "bytes": 6792,
          "sha256": "e5bd2208d96b067e0026875df541997cfb3fd24f2b1ac6002050daaec0888e08"
        },
        {
          "path": "python/Lib/encodings/__pycache__/utf_8.cpython-312.pyc",
          "bytes": 2211,
          "sha256": "e5dcbe3373a2946a4eb42273ca38b99b7c3021e4e01cc4add81200a406b8cbe9"
        },
        {
          "path": "python/Lib/encodings/aliases.py",
          "bytes": 15677,
          "sha256": "6fdcc49ba23a0203ae6cf28e608f8e6297d7c4d77d52e651db3cb49b9564c6d2"
        },
        {
          "path": "python/Lib/encodings/ascii.py",
          "bytes": 1248,
          "sha256": "578aa1173f7cc60dad2895071287fe6182bd14787b3fbf47a6c7983dfe3675e3"
        },
        {
          "path": "python/Lib/encodings/base64_codec.py",
          "bytes": 1533,
          "sha256": "cf9ac7a464f541492486241d1b4bf33e37b45c6499275cc4d69c5a8e564e5976"
        },
        {
          "path": "python/Lib/encodings/big5.py",
          "bytes": 1019,
          "sha256": "98fac6f86a20dd05da197e2058176ebfd47edee7074c3248f5f48fe0fb672d7c"
        },
        {
          "path": "python/Lib/encodings/big5hkscs.py",
          "bytes": 1039,
          "sha256": "21d051a00fb5c6a86ba187e0c50e811d659ce00991fd5f5b408f71ebb2ef0f16"
        },
        {
          "path": "python/Lib/encodings/bz2_codec.py",
          "bytes": 2249,
          "sha256": "1181a2a89102a2b1d2b2f1f4473236d5d1ececdd0be8fdaa498a3dbe21a185ab"
        },
        {
          "path": "python/Lib/encodings/charmap.py",
          "bytes": 2084,
          "sha256": "1b8b5fdb36ce3becc62a6115ed904a17083949ec8aaef5a80f7078cec232f43b"
        },
        {
          "path": "python/Lib/encodings/cp037.py",
          "bytes": 13121,
          "sha256": "fda6ca994d710e4e0c760e0204c29a4273fc0f14ebe3169306d2eb54c9953f58"
        },
        {
          "path": "python/Lib/encodings/cp1006.py",
          "bytes": 13568,
          "sha256": "eaded38b427841bdf280e878f1e26da506e743eaa9429075332af60cce429473"
        },
        {
          "path": "python/Lib/encodings/cp1026.py",
          "bytes": 13113,
          "sha256": "f5227237dd7ce5005b16a8e4d8342f0d193193c878e3cf35b9305d22b3b1aaf9"
        },
        {
          "path": "python/Lib/encodings/cp1125.py",
          "bytes": 34597,
          "sha256": "f84c7d30ce222e6a50cff1a4c9737173411da108cbd2c9bb57c854480103c470"
        },
        {
          "path": "python/Lib/encodings/cp1140.py",
          "bytes": 13105,
          "sha256": "3379d78b244aa905ffe1171a968caaf41b9a0154d1ddc76c05a2abaca2b289fd"
        },
        {
          "path": "python/Lib/encodings/cp1250.py",
          "bytes": 13686,
          "sha256": "ebcec1adf9167863fb0bab29708c546300c80a77ef07838c9e0437a59e265970"
        },
        {
          "path": "python/Lib/encodings/cp1251.py",
          "bytes": 13361,
          "sha256": "d57f8cfa34494c5acb6692ddb31f616ae2dd89a075d2af6d36b0b7ec2ffe7af1"
        },
        {
          "path": "python/Lib/encodings/cp1252.py",
          "bytes": 13511,
          "sha256": "19aa5bee667f5fb387924a813aec9fa1dda47769d09e8483a748bdb202be6a84"
        },
        {
          "path": "python/Lib/encodings/cp1253.py",
          "bytes": 13094,
          "sha256": "8c27696dcfb6894b378869bc89f113703fbd1e9b13a83934463d5999b055d1e8"
        },
        {
          "path": "python/Lib/encodings/cp1254.py",
          "bytes": 13502,
          "sha256": "06517ec2f74f1c6562d0a1a500c48ba43f2e6e9d0c3d28356d747f274f1a4c8d"
        },
        {
          "path": "python/Lib/encodings/cp1255.py",
          "bytes": 12466,
          "sha256": "54a1b5087578fa78e5bdd0afa6a9e80e8c5467c1e4226cf6e586cfe7a674a653"
        },
        {
          "path": "python/Lib/encodings/cp1256.py",
          "bytes": 12814,
          "sha256": "ad3768ac2fef2a646b3301c20af705f4d4a1544f22fa8a84241bada27ab84133"
        },
        {
          "path": "python/Lib/encodings/cp1257.py",
          "bytes": 13374,
          "sha256": "d9149d2925b3f719809ef2297e541461079f15c658af207a3e498be314ab2c6b"
        },
        {
          "path": "python/Lib/encodings/cp1258.py",
          "bytes": 13364,
          "sha256": "672e05b51952a82c8dbd5603769195fcedf565e457bb86c0d5bae04955d04630"
        },
        {
          "path": "python/Lib/encodings/cp273.py",
          "bytes": 14132,
          "sha256": "6c6aec3b213ea3aebc2c526dd4d121c95d4a25a2fc928a87cd80f8448988185f"
        },
        {
          "path": "python/Lib/encodings/cp424.py",
          "bytes": 12055,
          "sha256": "30414c2186ea0802bbf3db034122ddec1f8a10061b97c50871e14b74ee36d0ca"
        },
        {
          "path": "python/Lib/encodings/cp437.py",
          "bytes": 34564,
          "sha256": "5c2a5015cd36cf7f561269f33dec4c323093d3d88b0673969accdabdcb9ce2cb"
        },
        {
          "path": "python/Lib/encodings/cp500.py",
          "bytes": 13121,
          "sha256": "630f503f9110d98ea3e1529f2f965ebc275a2f78d3de47f8e9b69d35589d764b"
        },
        {
          "path": "python/Lib/encodings/cp720.py",
          "bytes": 13686,
          "sha256": "395496001271b92efe5df07fc0ae7c3410d1dd2bdfebbd3e4d8e806c8166beb0"
        },
        {
          "path": "python/Lib/encodings/cp737.py",
          "bytes": 34681,
          "sha256": "be3ca1785a3970ec62310710eaf7de82932181b04d06fe4528f8adaba9fb8c4b"
        },
        {
          "path": "python/Lib/encodings/cp775.py",
          "bytes": 34476,
          "sha256": "e0dba85b99329d7f16907e620adada06be5216abcb964406c827b569b2cf1aeb"
        },
        {
          "path": "python/Lib/encodings/cp850.py",
          "bytes": 34105,
          "sha256": "257e29f235e2a8790dd68cee45668776648bab809ce8584f893cdd8fd007993c"
        },
        {
          "path": "python/Lib/encodings/cp852.py",
          "bytes": 35002,
          "sha256": "cc6faaa9dc4a933127da0aaacd1dc7a44c09266051af56bfe3215ff228636b6b"
        },
        {
          "path": "python/Lib/encodings/cp855.py",
          "bytes": 33850,
          "sha256": "7b25c61c9e8c47b218d3fbb801541a2861926ac712843d2113fff90e2074f5ba"
        },
        {
          "path": "python/Lib/encodings/cp856.py",
          "bytes": 12423,
          "sha256": "2e52ec5cb1eafa6739b5569b0b98ee89df5f7358b84ccdc8da64e86f017d359f"
        },
        {
          "path": "python/Lib/encodings/cp857.py",
          "bytes": 33908,
          "sha256": "8d1b769058bfccdb3c6c70c49a104f5081a2fcc9fad68f7b5eb3e4f67f0b33da"
        },
        {
          "path": "python/Lib/encodings/cp858.py",
          "bytes": 34015,
          "sha256": "a24930c4a6ad0ff66dde9a69f2027e4b92c2c9c61dcda2992e940654c606577b"
        },
        {
          "path": "python/Lib/encodings/cp860.py",
          "bytes": 34681,
          "sha256": "2dfae7e31d3d9aa3013cff44a4d7ad842f257ac63765a9998436701b629cd86a"
        },
        {
          "path": "python/Lib/encodings/cp861.py",
          "bytes": 34633,
          "sha256": "701930d77a2177497586e99bc3fe60f2d4beffb645608f167c76874a72ff405e"
        },
        {
          "path": "python/Lib/encodings/cp862.py",
          "bytes": 33370,
          "sha256": "15a2844b6ed9544c6400cf7299b42d0c2bef93c9bee70a9e89f66b8610ad6d6d"
        },
        {
          "path": "python/Lib/encodings/cp863.py",
          "bytes": 34252,
          "sha256": "a3d57f61fce1b98fc81ea8e4ebebaf402fae40bbcdd35d4b8297b9bb49a79aa2"
        },
        {
          "path": "python/Lib/encodings/cp864.py",
          "bytes": 33663,
          "sha256": "15ad8f1fdfdd842c7522241372e7eddda7df687e815692a89157c5f256f21a08"
        },
        {
          "path": "python/Lib/encodings/cp865.py",
          "bytes": 34618,
          "sha256": "bdbaded987242ed2a8de7133ec2f61ddcc1c2e9de27816ab7cd0a4c678a3a907"
        },
        {
          "path": "python/Lib/encodings/cp866.py",
          "bytes": 34396,
          "sha256": "9efcc8e85bbd1687272a0991f6d0429a4c06679db2d114b2ac95db27a70f9d13"
        },
        {
          "path": "python/Lib/encodings/cp869.py",
          "bytes": 32965,
          "sha256": "52582d9fb769b24eac7154f18d7dae856588297d6da98f37fb5efd8da883826d"
        },
        {
          "path": "python/Lib/encodings/cp874.py",
          "bytes": 12595,
          "sha256": "fe4752fa2e65741e08a563a31ff914fe71068942ce9c6f4070b1dfd7b25e5e7f"
        },
        {
          "path": "python/Lib/encodings/cp875.py",
          "bytes": 12854,
          "sha256": "2fe72632015db2cba2bb4367055551da6fe22051b96d170c7b96fa271c46b257"
        },
        {
          "path": "python/Lib/encodings/cp932.py",
          "bytes": 1023,
          "sha256": "99748e28113d2d49f5d666b49b78accd2c6e10a7852f7dd6dece9b5b71aa83c4"
        },
        {
          "path": "python/Lib/encodings/cp949.py",
          "bytes": 1023,
          "sha256": "950a7d29467ce0590b4a1137830d43d88d8f20e4035dcaaa8b2a5c3c3f1de962"
        },
        {
          "path": "python/Lib/encodings/cp950.py",
          "bytes": 1023,
          "sha256": "27811178b450731fc955b1247656a605d04e5ee98e0d585e4596b94b703a27f6"
        },
        {
          "path": "python/Lib/encodings/euc_jis_2004.py",
          "bytes": 1051,
          "sha256": "9fa426cd9f17629f6320700ed18baa94839304cf1bcabbee7edb501747dc055d"
        },
        {
          "path": "python/Lib/encodings/euc_jisx0213.py",
          "bytes": 1051,
          "sha256": "e28315910da20218dae8b7d5becd81de1e283dfd8b0415a4980d67065de73a0b"
        },
        {
          "path": "python/Lib/encodings/euc_jp.py",
          "bytes": 1027,
          "sha256": "b453a439787b0efa031e43416a7d852a6be705c985e1200693eb96d87ea79cdc"
        },
        {
          "path": "python/Lib/encodings/euc_kr.py",
          "bytes": 1027,
          "sha256": "633a1a5504bfad04b1ec9c96d44d4ebb3bb99066a218318e7d67d866e20887a6"
        },
        {
          "path": "python/Lib/encodings/gb18030.py",
          "bytes": 1031,
          "sha256": "6c10b4dc49bc63724e539137ede6936304fcca1c97c28d16d89f381e10849521"
        },
        {
          "path": "python/Lib/encodings/gb2312.py",
          "bytes": 1027,
          "sha256": "3d2d567d8d079b78f3f3b566ed52ad2f38af61bf832b7dc28858b0039a032d6b"
        },
        {
          "path": "python/Lib/encodings/gbk.py",
          "bytes": 1015,
          "sha256": "eff9b8cbc9ad2ef2e10e96afa83d3db1f775ea044aed275b7a35574ae0d8645b"
        },
        {
          "path": "python/Lib/encodings/hex_codec.py",
          "bytes": 1508,
          "sha256": "fc5f0a31b59efe990b86efb98936769f33dd91d912ce55b49a5a4cfc516cd047"
        },
        {
          "path": "python/Lib/encodings/hp_roman8.py",
          "bytes": 13475,
          "sha256": "c43cce763d12e8f71a63dbc16641bd87147eaf5f9d9054ea856864b216b2735b"
        },
        {
          "path": "python/Lib/encodings/hz.py",
          "bytes": 1011,
          "sha256": "025a9531e3046e52d3e039c0be04f9a5a74651d7683a13c7c7ebd4c7dfb5996a"
        },
        {
          "path": "python/Lib/encodings/idna.py",
          "bytes": 9710,
          "sha256": "9ca58e82d12b171f25d57239ad237dae5c44214a70f2f4f39358c2759b8b9013"
        },
        {
          "path": "python/Lib/encodings/iso2022_jp_1.py",
          "bytes": 1061,
          "sha256": "63bacad13a979a5519fcaa4f1e1e07b2c7415005167fac3a689408c7d886fabd"
        },
        {
          "path": "python/Lib/encodings/iso2022_jp_2.py",
          "bytes": 1061,
          "sha256": "5d4248181548b0fc89a9f5ee9cf52ebecb235708ba87d47896ad14130884ef9f"
        },
        {
          "path": "python/Lib/encodings/iso2022_jp_2004.py",
          "bytes": 1073,
          "sha256": "b4d1468bcd608b46f38cb0c6ef115510dcf9aa0f71e590792f407efc6e165164"
        },
        {
          "path": "python/Lib/encodings/iso2022_jp_3.py",
          "bytes": 1061,
          "sha256": "3aceaa5661909de14e2861d864443b8472460ce39b99cce5c6965346d47aa5ac"
        },
        {
          "path": "python/Lib/encodings/iso2022_jp_ext.py",
          "bytes": 1069,
          "sha256": "f4c9ed8f3031995faa224bcb10153d2b6144944477d1f27d1a6cc4a879fac34c"
        },
        {
          "path": "python/Lib/encodings/iso2022_jp.py",
          "bytes": 1053,
          "sha256": "461a0e7f72eccb8b29f351c4e7926cfbda58e0edd6d0770bd82e0b36c5febe77"
        },
        {
          "path": "python/Lib/encodings/iso2022_kr.py",
          "bytes": 1053,
          "sha256": "1c86362e17944f0bcf68db02f4995bdeea605867795fff7ab4079073f96705e4"
        },
        {
          "path": "python/Lib/encodings/iso8859_1.py",
          "bytes": 13176,
          "sha256": "b5cebd515e057d670bf54e10b8a6f162ef3daa7f21b146aee3249160caf3c32d"
        },
        {
          "path": "python/Lib/encodings/iso8859_10.py",
          "bytes": 13589,
          "sha256": "54c886b41819ebb7f4fb34b8dbae1c45f4fc0864f019ecd772676ccfac5fae7b"
        },
        {
          "path": "python/Lib/encodings/iso8859_11.py",
          "bytes": 12335,
          "sha256": "ed5a964470a241b4da7a6cfb718e4149d09644933af38f0497602baab6e563ef"
        },
        {
          "path": "python/Lib/encodings/iso8859_13.py",
          "bytes": 13271,
          "sha256": "7312237e8e5d201d920b4130f057cfdf1b0be9baafaa246826e6d93204fcc206"
        },
        {
          "path": "python/Lib/encodings/iso8859_14.py",
          "bytes": 13652,
          "sha256": "82778b995a0ee87c5f1180fcc52900359eee15bd9a6e3a0e25f0d963e0b2a343"
        },
        {
          "path": "python/Lib/encodings/iso8859_15.py",
          "bytes": 13212,
          "sha256": "01976a81811873dc9a0c79db9fc00d1c30103487f3c6bc3a6d81b4043cd48e02"
        },
        {
          "path": "python/Lib/encodings/iso8859_16.py",
          "bytes": 13557,
          "sha256": "b5ac8f5a5d8f84c0f903b2b7c342184758d590d8bcf810d561f942fe5b372d66"
        },
        {
          "path": "python/Lib/encodings/iso8859_2.py",
          "bytes": 13404,
          "sha256": "2b57cab6111cae9021505e3ae1b2adbbfc344ec48165fda322f6b069fbb18adc"
        },
        {
          "path": "python/Lib/encodings/iso8859_3.py",
          "bytes": 13089,
          "sha256": "4ffdf89004bf0c5230caa7079f7ca3142fc112f8b923ddb2c7358369d2d3c242"
        },
        {
          "path": "python/Lib/encodings/iso8859_4.py",
          "bytes": 13376,
          "sha256": "87bd130daa0eaef3e4cb465e10cffb2bcd194ff74097e0c186b4b8eb7be41ac5"
        },
        {
          "path": "python/Lib/encodings/iso8859_5.py",
          "bytes": 13015,
          "sha256": "9961d96cc7b9fdf011ebcaaeaeca7b50b8670fadbd7b75fde66192f8c1f68f30"
        },
        {
          "path": "python/Lib/encodings/iso8859_6.py",
          "bytes": 10833,
          "sha256": "4840e68014346517680f593ca22f67133c39ba7e46f34b9be62c980a728448c6"
        },
        {
          "path": "python/Lib/encodings/iso8859_7.py",
          "bytes": 12844,
          "sha256": "b352eca3b819488f64fb3338fd93f39c1e30f32bb13f2f9c577925e58f2960e4"
        },
        {
          "path": "python/Lib/encodings/iso8859_8.py",
          "bytes": 11036,
          "sha256": "4cf9e8a8bbe04accb1c1a80853efb19ae0772d18f81e270adefc1b2386cb368e"
        },
        {
          "path": "python/Lib/encodings/iso8859_9.py",
          "bytes": 13156,
          "sha256": "84d9b15263e81685f7513c5ab45caf80b2f73c301c68e659f7162c1b1882d359"
        },
        {
          "path": "python/Lib/encodings/johab.py",
          "bytes": 1023,
          "sha256": "9586615917afd3d848c1c4328656603b2834af6115f2aec932fccc935e1a60fb"
        },
        {
          "path": "python/Lib/encodings/koi8_r.py",
          "bytes": 13779,
          "sha256": "4d4e353aee8039bb71e2145a6e68fe1e6833a1b4250b70ee0ac5ec70bbb8c51d"
        },
        {
          "path": "python/Lib/encodings/koi8_t.py",
          "bytes": 13193,
          "sha256": "9c9043814abdbe7dc39ff98f3857d5d110a84c978ad2304158d810a4e9eacef1"
        },
        {
          "path": "python/Lib/encodings/koi8_u.py",
          "bytes": 13762,
          "sha256": "d449f9858e357fa8c2edbd4b9fe739337e9f201cac3ded20f99bfcecd4970ff7"
        },
        {
          "path": "python/Lib/encodings/kz1048.py",
          "bytes": 13723,
          "sha256": "76beb30e98a911f72f97609a2373782573c17c88a5fb3537db338aa382979ffc"
        },
        {
          "path": "python/Lib/encodings/latin_1.py",
          "bytes": 1264,
          "sha256": "b75503e532a27c636477396c855209ff5f3036536d2a4bede0a576c89382b60c"
        },
        {
          "path": "python/Lib/encodings/mac_arabic.py",
          "bytes": 36467,
          "sha256": "5eafd9a3136abfbd8ed52df9c90203c7a283e7429ed60502a87a02511e0fb777"
        },
        {
          "path": "python/Lib/encodings/mac_croatian.py",
          "bytes": 13633,
          "sha256": "a880cd05c82a8d11a29c65ee86a396def3344465dd71441b0bb4a73826024953"
        },
        {
          "path": "python/Lib/encodings/mac_cyrillic.py",
          "bytes": 13454,
          "sha256": "83616786a1c6308b03a0dc82536908d24d0974b2248d67393d613fe558cea4bd"
        },
        {
          "path": "python/Lib/encodings/mac_farsi.py",
          "bytes": 15170,
          "sha256": "f5763c38fb4ab0423fafe2fdca34d6f9932ac7f1a74c0cd8109d60234c7dc624"
        },
        {
          "path": "python/Lib/encodings/mac_greek.py",
          "bytes": 13721,
          "sha256": "63016a323ddf98cb3aa9cfa78f3bab4768bedbfe9a5262a36a5aecb13d291f6e"
        },
        {
          "path": "python/Lib/encodings/mac_iceland.py",
          "bytes": 13498,
          "sha256": "753cc1ac635caa7e1b4630fbcebef8db8db332c098154a5b11f652912bf64f37"
        },
        {
          "path": "python/Lib/encodings/mac_latin2.py",
          "bytes": 14118,
          "sha256": "31670da18ce8b5394cd53fe6bf216268e7e8eae4c0247532e420e2e103727d50"
        },
        {
          "path": "python/Lib/encodings/mac_roman.py",
          "bytes": 13480,
          "sha256": "230367d96aef8e8d7f185b4acfb84923714f39ddbcbf9cf38a06bf6f5d621c22"
        },
        {
          "path": "python/Lib/encodings/mac_romanian.py",
          "bytes": 13661,
          "sha256": "49630cf035c19e896a123ed6e5fee18b5e485123daf2f15da38bf727ff387bee"
        },
        {
          "path": "python/Lib/encodings/mac_turkish.py",
          "bytes": 13513,
          "sha256": "99758a5cad2825cb3be3fa5d031e0821e4eba910a46f417fd890207b9b6be77b"
        },
        {
          "path": "python/Lib/encodings/mbcs.py",
          "bytes": 1211,
          "sha256": "f6ed445ed537c9f856d8defe8b56505727737d0dc9348d0a877abedab4bdd864"
        },
        {
          "path": "python/Lib/encodings/oem.py",
          "bytes": 1019,
          "sha256": "481656d3a35f792d0e5109e3f821e6dbfcf097163a19b0cdfcbff3b3db99292f"
        },
        {
          "path": "python/Lib/encodings/palmos.py",
          "bytes": 13519,
          "sha256": "eccf7418adefcc2a59e9a07fc4e34363bd62f7e878d48c8a02730a8ed1c584c8"
        },
        {
          "path": "python/Lib/encodings/ptcp154.py",
          "bytes": 14015,
          "sha256": "0eabcb2c287d335e86b71b0abe5718bd6ddc9aaee234f0f0f2363845d2926d8d"
        },
        {
          "path": "python/Lib/encodings/punycode.py",
          "bytes": 6883,
          "sha256": "34edc8fb1c50e4d1cbaa1e008bb491cd7c12116c316e51974f333fe7b628eb7c"
        },
        {
          "path": "python/Lib/encodings/quopri_codec.py",
          "bytes": 1525,
          "sha256": "502a213c34c05a94ed063ee03f47680bd6efbb35036e06fb4dc809bf398cfa64"
        },
        {
          "path": "python/Lib/encodings/raw_unicode_escape.py",
          "bytes": 1332,
          "sha256": "fa6328486b8f5a5cbd10e377e80adb8cf94acbbe19c38b4e1bf708d831a80a3a"
        },
        {
          "path": "python/Lib/encodings/rot_13.py",
          "bytes": 2448,
          "sha256": "14767f475acdc0bf48e6272280dd15b80efaecafb93c06be21136f83dd1ee7e4"
        },
        {
          "path": "python/Lib/encodings/shift_jis_2004.py",
          "bytes": 1059,
          "sha256": "d21c5930f21063ea78fea3b0f76dfb8fd92858d2a4a200064a52126a43dd1a99"
        },
        {
          "path": "python/Lib/encodings/shift_jis.py",
          "bytes": 1039,
          "sha256": "ad4ac50ebf58294304e412cc0f1b12980988dd6edc414e4110029c0a1abbe966"
        },
        {
          "path": "python/Lib/encodings/shift_jisx0213.py",
          "bytes": 1059,
          "sha256": "2c8d0b93bb36edf31c1236b1b4d1c0008553868bd2fc9137570115b96b834f2e"
        },
        {
          "path": "python/Lib/encodings/tis_620.py",
          "bytes": 12300,
          "sha256": "647c4719e2c1a7375105e15a89b377c66f6b699977dcabbb71d923a4607b7902"
        },
        {
          "path": "python/Lib/encodings/undefined.py",
          "bytes": 1299,
          "sha256": "85bba5c5e1007cd8c1ade5c0214bcc825396d2bbd02054e62a9f162104748b64"
        },
        {
          "path": "python/Lib/encodings/unicode_escape.py",
          "bytes": 1304,
          "sha256": "507e7ca8f18df639fd823d7cc23ce4028a3550ceefdfa40b3c76f81d1a94531d"
        },
        {
          "path": "python/Lib/encodings/utf_16_be.py",
          "bytes": 1037,
          "sha256": "3357196f3fa52433326a6626880e34964e00c5570aee50e9a0a0a7c6d86f6e4f"
        },
        {
          "path": "python/Lib/encodings/utf_16_le.py",
          "bytes": 1037,
          "sha256": "3aedaf3eb49769282daef1eaedfd4fa1c31fe5eebeff67fe2307c89dc2e2fd80"
        },
        {
          "path": "python/Lib/encodings/utf_16.py",
          "bytes": 5236,
          "sha256": "6c36257f7b8d214473560d195e71bccef0c69a53e1e52d2800b7a7890aad7e58"
        },
        {
          "path": "python/Lib/encodings/utf_32_be.py",
          "bytes": 930,
          "sha256": "cbba20e1f6d0879c7c4293446c371a9f79e7c90bf3c78a77a9b8fc72b18915dd"
        },
        {
          "path": "python/Lib/encodings/utf_32_le.py",
          "bytes": 930,
          "sha256": "9134b91047d85b442898d59effe23e7e0cf4167ca341ae31119a731dbf880a7b"
        },
        {
          "path": "python/Lib/encodings/utf_32.py",
          "bytes": 5129,
          "sha256": "2072eece5f6026ad2d3549ab193a9e38894ea15ca9d5b3cd408fd6b116acc0c2"
        },
        {
          "path": "python/Lib/encodings/utf_7.py",
          "bytes": 946,
          "sha256": "9ff32314f4f1fa074f206bbf7fdb851504e5313128636d73b4bf75b886e4a87d"
        },
        {
          "path": "python/Lib/encodings/utf_8_sig.py",
          "bytes": 4133,
          "sha256": "1ef3da8d8aa08149e7f274dc64dbfce2155da812e5258ca8e8f832428d3b5c2d"
        },
        {
          "path": "python/Lib/encodings/utf_8.py",
          "bytes": 1005,
          "sha256": "ba0cac060269583523ca9506473a755203037c57d466a11aa89a30a5f6756f3d"
        },
        {
          "path": "python/Lib/encodings/uu_codec.py",
          "bytes": 2851,
          "sha256": "45ba92000718abf85f158563c755205e100356ce1b4ab9444b4d0a3d21f061a3"
        },
        {
          "path": "python/Lib/encodings/zlib_codec.py",
          "bytes": 2204,
          "sha256": "6ef01e8d3a5fe1cc52f7b5ae008df12f1dbce7304111bf8d4758f1bfc0115759"
        },
        {
          "path": "python/Lib/ensurepip/__init__.py",
          "bytes": 9445,
          "sha256": "90f6c76cd9ef7ed6daa198bb9ef771139683487f1b061211be7aa511831b2028"
        },
        {
          "path": "python/Lib/ensurepip/__main__.py",
          "bytes": 88,
          "sha256": "ee735f518d0fc4dfec81f7aa3da1e052372ed4202c0da4eddd2587840beaecd7"
        },
        {
          "path": "python/Lib/ensurepip/__pycache__/__init__.cpython-312.pyc",
          "bytes": 9535,
          "sha256": "ecf2daca1b079a01c772f16df057a01a2a32edc7a41cc96f64532f23e0789c4a"
        },
        {
          "path": "python/Lib/ensurepip/__pycache__/__main__.cpython-312.pyc",
          "bytes": 372,
          "sha256": "7b8e88768b844fa953524b19ce11188019a62d6e47ee9768c47a938752b17f01"
        },
        {
          "path": "python/Lib/ensurepip/_bundled/pip-25.0.1-py3-none-any.whl",
          "bytes": 1841526,
          "sha256": "c46efd13b6aa8279f33f2864459c8ce587ea6a1a59ee20de055868d8f7688f7f"
        },
        {
          "path": "python/Lib/ensurepip/_uninstall.py",
          "bytes": 808,
          "sha256": "3a6e95d01c45e2e47c05df3c81073b895c97c1eb0e5b90ab175d6d9263fc81f2"
        },
        {
          "path": "python/Lib/enum.py",
          "bytes": 81540,
          "sha256": "f35e542d8c4c1d2b5e910138d726fa48774925f3c4dc5462793ebcb66aa55501"
        },
        {
          "path": "python/Lib/filecmp.py",
          "bytes": 10381,
          "sha256": "803d8494d5ae72f986f3dedaa30360fcc4467f9cb7b3106cf0d434d87a033d60"
        },
        {
          "path": "python/Lib/fileinput.py",
          "bytes": 15714,
          "sha256": "b0cd2a3f01c96f594b6038e52bd83d489bfa081cc757103c70aab4e5b2c4fe1f"
        },
        {
          "path": "python/Lib/fnmatch.py",
          "bytes": 5999,
          "sha256": "6683da36e47af523f3f41e18ad244d837783e19e98911cc0b7415dea81494ebc"
        },
        {
          "path": "python/Lib/fractions.py",
          "bytes": 38147,
          "sha256": "d52d1ab9d5be26924e4914a5e40069c992bbfa68f773694c2e5ee8452d0766a0"
        },
        {
          "path": "python/Lib/ftplib.py",
          "bytes": 35240,
          "sha256": "fb32563e0157d25e1a4b72cdbb5607893014d1accc2dbb986b2e3a61aebfe26e"
        },
        {
          "path": "python/Lib/functools.py",
          "bytes": 37940,
          "sha256": "de4a1d37c795e2a065124b5c49357893433bc6bb111b41277ccc9930ef08d4c9"
        },
        {
          "path": "python/Lib/genericpath.py",
          "bytes": 5572,
          "sha256": "2b0b35d2206778af4081cf81dd9b513876e72c35a55bec941402e1fa62b1f1aa"
        },
        {
          "path": "python/Lib/getopt.py",
          "bytes": 7488,
          "sha256": "0ce875700c8798193b8e2748f7a27fc542cc4d525a1e6fc403767450ec92be99"
        },
        {
          "path": "python/Lib/getpass.py",
          "bytes": 5990,
          "sha256": "e74fd445337ff503223dd8aa4bdd7d04917067d00c796a10bedb7a1381a4960a"
        },
        {
          "path": "python/Lib/gettext.py",
          "bytes": 21320,
          "sha256": "a5c249a522b6b8e3aa6f1b12a8bcc09508b99ad612b58d2fc973db27ea3b7cc3"
        },
        {
          "path": "python/Lib/glob.py",
          "bytes": 8732,
          "sha256": "c9e5f9ae0752660ede63328a456f58f87c29500b31f58c1b813458b00fceb6d5"
        },
        {
          "path": "python/Lib/graphlib.py",
          "bytes": 9648,
          "sha256": "2a29e0adee584dc76251afef1236d7bedf250aca27911f91a4d442133ce81117"
        },
        {
          "path": "python/Lib/gzip.py",
          "bytes": 25402,
          "sha256": "ea6e194b9df26398bf0d5215e63320c7b9d801b2d8b723fb9c80619df48076e9"
        },
        {
          "path": "python/Lib/hashlib.py",
          "bytes": 9349,
          "sha256": "6dbdebf270868b391080e21dc9687eddfaf321c965ad979f68d3f5c423c613ab"
        },
        {
          "path": "python/Lib/heapq.py",
          "bytes": 23024,
          "sha256": "6d43277e5c76fc0f073cd388fcff852d14d068f6bb6d4886c340f8b75a1229a9"
        },
        {
          "path": "python/Lib/hmac.py",
          "bytes": 7716,
          "sha256": "7facd1330e5487ed995eda5c8619df0d3e32f69cb619f97662372fb76325746e"
        },
        {
          "path": "python/Lib/html/__init__.py",
          "bytes": 4775,
          "sha256": "923d82d821e75e8d235392c10c145ab8587927b3faf9c952bbd48081eebd8522"
        },
        {
          "path": "python/Lib/html/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4428,
          "sha256": "c1c506d1be6d11b55252dbdbf11be12c718d6f1ac3ca1abb809a4b3fd43aeceb"
        },
        {
          "path": "python/Lib/html/__pycache__/entities.cpython-312.pyc",
          "bytes": 97712,
          "sha256": "d1814ecc6814647a28d28fbeff86a7fee03a6c6bd1885a8a7b484adce69b439b"
        },
        {
          "path": "python/Lib/html/__pycache__/parser.cpython-312.pyc",
          "bytes": 22509,
          "sha256": "a1ab44da7623fc0707e7edc12ad00355f187f36581703f35e470b77b3b07e51b"
        },
        {
          "path": "python/Lib/html/entities.py",
          "bytes": 75512,
          "sha256": "d9c65fb2828dbc1f3e399058a341d51e9375ec5bca95a8e92599c41bd5b78bde"
        },
        {
          "path": "python/Lib/html/parser.py",
          "bytes": 22048,
          "sha256": "a4c5558209ffe6d677dbe18e4a4b2d34672c73aee46e39b1d118846afa62a9ff"
        },
        {
          "path": "python/Lib/http/__init__.py",
          "bytes": 8308,
          "sha256": "17f4f6832cfc84b5b9600414bab80b77e67ccb611bdfed10a3f2beca9d0d568b"
        },
        {
          "path": "python/Lib/http/__pycache__/__init__.cpython-312.pyc",
          "bytes": 9534,
          "sha256": "13ae6b084ffafddc627a948f3e3451367e2b7d02c7c8666acdc04f6aae666722"
        },
        {
          "path": "python/Lib/http/__pycache__/client.cpython-312.pyc",
          "bytes": 58843,
          "sha256": "b19e454d2989d72793f4cbe8ad3d1e1a171ac834ab98203075c1a4fe895cb046"
        },
        {
          "path": "python/Lib/http/__pycache__/cookiejar.cpython-312.pyc",
          "bytes": 81463,
          "sha256": "d4ed5e55317f6105f932cd0ec4b9c74631a320de2fae6f2016e63b38853bed9c"
        },
        {
          "path": "python/Lib/http/__pycache__/cookies.cpython-312.pyc",
          "bytes": 22561,
          "sha256": "e9ecfd9a9456859559bcfe451f8ac80b3ddb1d96e986c1c05f363dd26c224a9f"
        },
        {
          "path": "python/Lib/http/client.py",
          "bytes": 59574,
          "sha256": "c2c0694155837d72fc710a4138e5d1e53ae1a652b117a2e23a5b1b0db527a0f9"
        },
        {
          "path": "python/Lib/http/cookiejar.py",
          "bytes": 77438,
          "sha256": "2a64dbc46edd0173600f32d195531741de562522da28bc76c2f97dccceb37ddb"
        },
        {
          "path": "python/Lib/http/cookies.py",
          "bytes": 21568,
          "sha256": "6387f676095ae5374943eff99fbcd2d9c681172c00209fadf54c311cf7228149"
        },
        {
          "path": "python/Lib/http/server.py",
          "bytes": 49202,
          "sha256": "12f8db637047c12ec053bfaa6671ad1cb7ca9ca8d1dae82b562e5866c5b02990"
        },
        {
          "path": "python/Lib/idlelib/__init__.py",
          "bytes": 396,
          "sha256": "3f8058df4fec56eb20ff67ff84c86fd3d9697e2384c5a290ed696f6d3187aa45"
        },
        {
          "path": "python/Lib/idlelib/__main__.py",
          "bytes": 107,
          "sha256": "26699e80e7e8ba278a649881b80e8c7301c729d04d2f8fb2268365b10a48a91e"
        },
        {
          "path": "python/Lib/idlelib/autocomplete_w.py",
          "bytes": 20863,
          "sha256": "91170b060749d0b3c8f2ab31499104028bedf971e5575155d43392d5c8dae5d6"
        },
        {
          "path": "python/Lib/idlelib/autocomplete.py",
          "bytes": 9354,
          "sha256": "0d36f7694a50cbaa22d9bf03b91fa0658a147bd90dd867714a9b411febb36427"
        },
        {
          "path": "python/Lib/idlelib/autoexpand.py",
          "bytes": 3216,
          "sha256": "c8eb28ef7addf5a664a7e3addfbfebe29040a8695e1db515828305aacba2ee4e"
        },
        {
          "path": "python/Lib/idlelib/browser.py",
          "bytes": 8588,
          "sha256": "b607102a6e2ff7de241744008144a5480e2925098694be2a46003d8f60da0f52"
        },
        {
          "path": "python/Lib/idlelib/calltip_w.py",
          "bytes": 7083,
          "sha256": "077e9d0d95946296077d5c95f343e242a7d250a6efece4afc58759b5e984e6c3"
        },
        {
          "path": "python/Lib/idlelib/calltip.py",
          "bytes": 7267,
          "sha256": "3a723fdf88c0018dfadd19757142a643b01b785c6df17a50bbe21463663ab590"
        },
        {
          "path": "python/Lib/idlelib/ChangeLog",
          "bytes": 56360,
          "sha256": "b7f42699e5e5a7c82ebdf2a2962946b7228c933ece0ea7c0d7789f21a7dd7e64"
        },
        {
          "path": "python/Lib/idlelib/codecontext.py",
          "bytes": 11420,
          "sha256": "628a13325b3bf2f76dea9254b20178b3232261f83c660f0e33785e6215dd6492"
        },
        {
          "path": "python/Lib/idlelib/colorizer.py",
          "bytes": 14783,
          "sha256": "4de77a632286cf7cb616a2cf50dcd16a99d452fe7b16bf94c34950be97f293c2"
        },
        {
          "path": "python/Lib/idlelib/config_key.py",
          "bytes": 15230,
          "sha256": "856bd4b2c1fd7275856d3869cad8975f7770edbf021a93c64816a41c2322c2fa"
        },
        {
          "path": "python/Lib/idlelib/config-extensions.def",
          "bytes": 2266,
          "sha256": "e75df0b77ff61253be457af636d5eb7c55a3ff2b6a733beea844d2b294972ebf"
        },
        {
          "path": "python/Lib/idlelib/config-highlight.def",
          "bytes": 2864,
          "sha256": "609eada44ff4aa9d5cd10ad8b4c29bb76db8ebc74912a0ae86f5ea3cd19b7547"
        },
        {
          "path": "python/Lib/idlelib/config-keys.def",
          "bytes": 10910,
          "sha256": "bee81ba5c5abec1e35e313268f8d8fe72d305d0ad73abfba3d2ea1e2b2308710"
        },
        {
          "path": "python/Lib/idlelib/config-main.def",
          "bytes": 3168,
          "sha256": "e783704ad5cd9b3f44c026f55c98be2c52190bf9b7832251283f3e953ba80f87"
        },
        {
          "path": "python/Lib/idlelib/config.py",
          "bytes": 38403,
          "sha256": "c1e1557b1fa2a161d42f6231ee36ef090b07bffe58839b3c58f008e39d4fa856"
        },
        {
          "path": "python/Lib/idlelib/configdialog.py",
          "bytes": 105310,
          "sha256": "eaf4a08fbd3a8b92fd77a6c3cd5be824c570b38340c3a9afe4f36580320a3d48"
        },
        {
          "path": "python/Lib/idlelib/CREDITS.txt",
          "bytes": 2148,
          "sha256": "4fca8182cab71d43991f3d9370a5a9df1389dab5626c19e0e0f1510a0dd84852"
        },
        {
          "path": "python/Lib/idlelib/debugger_r.py",
          "bytes": 12115,
          "sha256": "ddc797740231f068ca7c7c8610e799d72ad11af670d9bc0b6f9e04fe2ba222d1"
        },
        {
          "path": "python/Lib/idlelib/debugger.py",
          "bytes": 20991,
          "sha256": "6e595d5a388e46b6b6e24490e970a3d355ec116a16a064bfca6ed86d4b17dcb4"
        },
        {
          "path": "python/Lib/idlelib/debugobj_r.py",
          "bytes": 1082,
          "sha256": "4e583b43fdf9bd4a731d70e074ee597aba03f3c8c36302bdc7e74650fb1fcc11"
        },
        {
          "path": "python/Lib/idlelib/debugobj.py",
          "bytes": 4177,
          "sha256": "aae9e2468a3d05366480864dc56689c65896757faf3b0364b8eef9feb4876a43"
        },
        {
          "path": "python/Lib/idlelib/delegator.py",
          "bytes": 1044,
          "sha256": "c2b31919d27056fc3aaa8f4ef798fbdf162665175fa9216d665f58ba2e4a464d"
        },
        {
          "path": "python/Lib/idlelib/dynoption.py",
          "bytes": 1993,
          "sha256": "29933f56722b2efb5cf451825a7fe50f357983e68f6a261afdf89b52f778e488"
        },
        {
          "path": "python/Lib/idlelib/editor.py",
          "bytes": 69561,
          "sha256": "c564a1d52a311436e1242b959d1553599b3744d6ff7da1bf5dec28613bdae260"
        },
        {
          "path": "python/Lib/idlelib/extend.txt",
          "bytes": 3632,
          "sha256": "4b2c5af0c4f8e67f875b9f6a5a957b84a7b8732b73678953be4825232813a608"
        },
        {
          "path": "python/Lib/idlelib/filelist.py",
          "bytes": 3871,
          "sha256": "64e194e4514141414ecb231ac165ed861749bb0d31d0758c7c3a823ce154abe1"
        },
        {
          "path": "python/Lib/idlelib/format.py",
          "bytes": 15777,
          "sha256": "dc2b00fb239f38543bf973d94daef2c52457b905d4d89c640993823127b7923c"
        },
        {
          "path": "python/Lib/idlelib/grep.py",
          "bytes": 7521,
          "sha256": "f30014ca750f79c7742bbe9d363368a6fa8b484112dc5a1450f858792a1d2fb1"
        },
        {
          "path": "python/Lib/idlelib/help_about.py",
          "bytes": 9023,
          "sha256": "2f89f495a3ed95143ce74ba380fe34f779daf4598fec4c775c46cb43745a4fef"
        },
        {
          "path": "python/Lib/idlelib/help.html",
          "bytes": 60566,
          "sha256": "a60a5a7dca96fdf993126b74ed36b7f5dd5de81990600fbcd18ae2a67712c9e4"
        },
        {
          "path": "python/Lib/idlelib/help.py",
          "bytes": 11843,
          "sha256": "78e392dc7543838cd72e68baf51c0da2fe51669a381d04cd1304b927404155f5"
        },
        {
          "path": "python/Lib/idlelib/history.py",
          "bytes": 4065,
          "sha256": "f91f1568d083bdbc856d38ef48493bcb138c6a492d523385b300a5bac30133e6"
        },
        {
          "path": "python/Lib/idlelib/HISTORY.txt",
          "bytes": 10313,
          "sha256": "12a6e0d745e08d55616e65a91f26e3bf9585ca64b8cec04a1daf865e855b655d"
        },
        {
          "path": "python/Lib/idlelib/hyperparser.py",
          "bytes": 12889,
          "sha256": "18563d2b4c248aed70b7f29fd903fd51d1b5aceb3dc93c23f9a54141eed7a9b0"
        },
        {
          "path": "python/Lib/idlelib/Icons/folder.gif",
          "bytes": 120,
          "sha256": "7c98d566a13fd599d1c11a375f387fef69b6c595c4f18c5d88c188a860be0e55"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_16.gif",
          "bytes": 634,
          "sha256": "fe3af292b38660a8a58b1a8b4fa4240aa190602e7e9a700ea0536b3181fc968e"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_16.png",
          "bytes": 1031,
          "sha256": "78fb3fb0ec11f61bc6cf0947f3c3923aa18e1c6513684058ed0fa01ac858143e"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_256.png",
          "bytes": 39205,
          "sha256": "3f517467d12e0e3ecf20f9bd68ce4bd18a2b8088f32308fd978fd80e87d3628b"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_32.gif",
          "bytes": 1019,
          "sha256": "fe70991cfccd1267922e94d91e02e9a58d2d29fd3382a2f4975280b9023cb7b9"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_32.png",
          "bytes": 2036,
          "sha256": "797cd05f1964d57c4c6c248ac7f7ea6a38019ada32a9ab7e6c28d060f87b03de"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_48.gif",
          "bytes": 1388,
          "sha256": "37484901eb40eefa846308e1da3ff6f240ea98f769a2afc3cf4fdba00327ecbe"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle_48.png",
          "bytes": 3977,
          "sha256": "a09f433197c8870b12bb7859cc4c3fe2068908cb1ddbd4880ab0f6fee91b6c23"
        },
        {
          "path": "python/Lib/idlelib/Icons/idle.ico",
          "bytes": 57746,
          "sha256": "7f13eeb5dca39d05e24b9eb069c6dcb2748633822d67288a8bf8b7e21cdddf55"
        },
        {
          "path": "python/Lib/idlelib/Icons/minusnode.gif",
          "bytes": 75,
          "sha256": "efa5aa1d1e3439ab85425bd2aa3a25b9e6c21309e672690cfb32219e1eb7a7f3"
        },
        {
          "path": "python/Lib/idlelib/Icons/openfolder.gif",
          "bytes": 125,
          "sha256": "9a59e2abf1840156e9db8f85a38822fd56ab79a139eb95ec86f1fba1bb87326b"
        },
        {
          "path": "python/Lib/idlelib/Icons/plusnode.gif",
          "bytes": 78,
          "sha256": "6ace9e90a2bcb16d06c4d78837137f2c14bc26b3bd9f24b7b6afeadb689bdafb"
        },
        {
          "path": "python/Lib/idlelib/Icons/python.gif",
          "bytes": 380,
          "sha256": "158c31382f8e5b41fded0c2aa9cc66a382928b003cdd8b5b0518836ad9c89377"
        },
        {
          "path": "python/Lib/idlelib/Icons/README.txt",
          "bytes": 1935,
          "sha256": "3feadfa48fb8e9025fccc91bff9ac494519137ed4a7d9b8f4e6847165b43de4e"
        },
        {
          "path": "python/Lib/idlelib/Icons/tk.gif",
          "bytes": 72,
          "sha256": "7f16cb2e322891dbd9101302c09ffda0c2a3a72d053bb8c0927d507414c59cad"
        },
        {
          "path": "python/Lib/idlelib/idle.bat",
          "bytes": 177,
          "sha256": "15a3977f0d2c6a8e87db2ef7050ea10afb3a88b064bf5ef95439924e42464114"
        },
        {
          "path": "python/Lib/idlelib/idle.py",
          "bytes": 454,
          "sha256": "33ffa2f718e123fd1c4e536bb4a471978515787ee9fbf7806a92073a787a733a"
        },
        {
          "path": "python/Lib/idlelib/idle.pyw",
          "bytes": 570,
          "sha256": "26101d297127132c5e9634499f41ad00e125ea308343a20b278bee9e9225eb5c"
        },
        {
          "path": "python/Lib/idlelib/iomenu.py",
          "bytes": 16159,
          "sha256": "7004f1ab2cfa5994e453f426507170ec37c1c4a5b9837ba319e5eaebf1a29c34"
        },
        {
          "path": "python/Lib/idlelib/macosx.py",
          "bytes": 9290,
          "sha256": "e6c687754bb60cd1015a413073b4d85b5e5bc7993c1acbfbc92d70600a83132e"
        },
        {
          "path": "python/Lib/idlelib/mainmenu.py",
          "bytes": 3938,
          "sha256": "092fad4454f593d7bf2e5e1e746acade92bb346d06476ba527f162f843ae3208"
        },
        {
          "path": "python/Lib/idlelib/multicall.py",
          "bytes": 18652,
          "sha256": "efb7d9bddcae17fab2108cb714c240c82d1368087b6d2b91e02ec224ddebce12"
        },
        {
          "path": "python/Lib/idlelib/NEWS2x.txt",
          "bytes": 27172,
          "sha256": "c89a3b513501ebace8e428aea68dce39d0af9f29196e08fc9ea49c99605e79e7"
        },
        {
          "path": "python/Lib/idlelib/News3.txt",
          "bytes": 56500,
          "sha256": "608bda1a7d2c95b3898328e7749725fd6c17d3039a9bab5b51de0bc70fca1200"
        },
        {
          "path": "python/Lib/idlelib/outwin.py",
          "bytes": 5705,
          "sha256": "a24f67d1ebe5e1dce84de0009d0caefaa1c795280507e1b0b7f0ea63d2ea68b4"
        },
        {
          "path": "python/Lib/idlelib/parenmatch.py",
          "bytes": 7204,
          "sha256": "f122e13c385a135cbbbe8b1d87efeed43ddd3e0be9ddd8aa24b267b61fac4287"
        },
        {
          "path": "python/Lib/idlelib/pathbrowser.py",
          "bytes": 3093,
          "sha256": "42a4e008922c991049f1b42ca18700b65f2f8d0ab6dd12cc22671771e90c2065"
        },
        {
          "path": "python/Lib/idlelib/percolator.py",
          "bytes": 3568,
          "sha256": "42fe72c167eb3a2795cbe64c498d7cbe1de05132be29a99a58226ae83efb31d4"
        },
        {
          "path": "python/Lib/idlelib/pyparse.py",
          "bytes": 19864,
          "sha256": "21c6bf43370998d5a5a6670f7b13409335e9a2c1a350ed586bbe63be5f226648"
        },
        {
          "path": "python/Lib/idlelib/pyshell.py",
          "bytes": 62194,
          "sha256": "a99a92f60190271720a5e3109126c937c435c6f181438038b97b20330f0b8c0b"
        },
        {
          "path": "python/Lib/idlelib/query.py",
          "bytes": 15067,
          "sha256": "faea5edd6b8693e6a32107054ad0de3be4d28e6aacb7792f86cbbe146131373b"
        },
        {
          "path": "python/Lib/idlelib/README.txt",
          "bytes": 11653,
          "sha256": "4f2dc8ffdbfc7837b60edc32ac2f593a220f4abf0ea00cc477382ad8ecf8eb3d"
        },
        {
          "path": "python/Lib/idlelib/redirector.py",
          "bytes": 6777,
          "sha256": "7911a7534eb0c73ee3e2464c5f8498109653f73ebed8fa903780c5fd7ca00754"
        },
        {
          "path": "python/Lib/idlelib/replace.py",
          "bytes": 9841,
          "sha256": "ea13db39aa89df369b36200c7301874a5636403e8270b1862f946e2fff081b84"
        },
        {
          "path": "python/Lib/idlelib/rpc.py",
          "bytes": 21078,
          "sha256": "8d0cb6e11c8dcc5dbda89b9a582bfaa74fe2b661dde442b02eb61b8fc47d9eb3"
        },
        {
          "path": "python/Lib/idlelib/run.py",
          "bytes": 21654,
          "sha256": "49a87a54dda2a595720d90f93a70045ac017f2dc826e578e2d2bb5360739db8e"
        },
        {
          "path": "python/Lib/idlelib/runscript.py",
          "bytes": 8273,
          "sha256": "b92740fddc7b1d603b1736a135bd15518081f20c0db1e1a779cab715ee9120fe"
        },
        {
          "path": "python/Lib/idlelib/scrolledlist.py",
          "bytes": 4478,
          "sha256": "25b0ad247977f6079226052e2b76dd4c127bf50f2f5e8ffbd1fe10bc631bfca9"
        },
        {
          "path": "python/Lib/idlelib/search.py",
          "bytes": 5567,
          "sha256": "c53ff4d4814d97d0d95b7e15030d3ae8c732366ed84c2b300183e933270df724"
        },
        {
          "path": "python/Lib/idlelib/searchbase.py",
          "bytes": 7852,
          "sha256": "d6db91e0d9aa869289f11677bcad7184be70fdb942d37b341cd9de6643f82f87"
        },
        {
          "path": "python/Lib/idlelib/searchengine.py",
          "bytes": 7415,
          "sha256": "11b0c8df926e4f6bd2e26d0264b2d902c41bcc70d68a4a830df1ea2da2c2a6cc"
        },
        {
          "path": "python/Lib/idlelib/sidebar.py",
          "bytes": 20338,
          "sha256": "760f14ebb0312adb289cda0562c9eff70982a0acde5d9d9d0b591390cd4a581e"
        },
        {
          "path": "python/Lib/idlelib/squeezer.py",
          "bytes": 12834,
          "sha256": "112221334fee94a88cba2ca7ac455e1bd6ab796397cbe036b1e8a98bc0787e30"
        },
        {
          "path": "python/Lib/idlelib/stackviewer.py",
          "bytes": 4016,
          "sha256": "ee053a65298e2ec2f4628d8269a33362816271fd81fab4e550a621493c26a76f"
        },
        {
          "path": "python/Lib/idlelib/statusbar.py",
          "bytes": 1474,
          "sha256": "3f4dc0f27b0c23e488d022abe8461529ce8a1b4eaf9dbfd97123ef2c502f684e"
        },
        {
          "path": "python/Lib/idlelib/textview.py",
          "bytes": 6808,
          "sha256": "eace58159e9636bb1456885c21f5ed474e203090139e5dd3457ac72ad5552006"
        },
        {
          "path": "python/Lib/idlelib/TODO.txt",
          "bytes": 8477,
          "sha256": "97a1d6cafad64ba55456ea99b46ebb3a1ef6af4babee8f3cc8877084c2e772d0"
        },
        {
          "path": "python/Lib/idlelib/tooltip.py",
          "bytes": 6665,
          "sha256": "f2779d85a9a1ddf302364e9087ceacf270938f24f3c13f3332a1bdda0414d296"
        },
        {
          "path": "python/Lib/idlelib/tree.py",
          "bytes": 16773,
          "sha256": "eaa604df6184f7efc90edf4cd725db718508898d87c17699fe812690c09d9093"
        },
        {
          "path": "python/Lib/idlelib/undo.py",
          "bytes": 11016,
          "sha256": "291fda98995bb4688fbe05fd3fa689e21aade3627c4c16e8971ed353f6cc3107"
        },
        {
          "path": "python/Lib/idlelib/util.py",
          "bytes": 1312,
          "sha256": "91cfc9e882b1b67a166a8a98a139904c40d6d62efad754b9b344f91cf82e1495"
        },
        {
          "path": "python/Lib/idlelib/window.py",
          "bytes": 2616,
          "sha256": "ca31d8c01c9b468fcad0a4e529c8e205c1e4ecf30520545db654d466bd7158bd"
        },
        {
          "path": "python/Lib/idlelib/zoomheight.py",
          "bytes": 4203,
          "sha256": "5f6ff83cb0df3ee5e7d997ffe23efb341b994bfbaf00b79a4832d54231a095dd"
        },
        {
          "path": "python/Lib/idlelib/zzdummy.py",
          "bytes": 2005,
          "sha256": "5e248f0ea4f35052d23bb2c43564aa567b8cebaf91fd63ba0be8fef2f4167945"
        },
        {
          "path": "python/Lib/imaplib.py",
          "bytes": 54040,
          "sha256": "ab3d485f7ee89deaf132533cd135888326be3c92a88ede79a16fa4c0e4709632"
        },
        {
          "path": "python/Lib/imghdr.py",
          "bytes": 4398,
          "sha256": "c1bb52ea0816db4c5f3420655ab4a476fb3829709141e91f1a56b9c6fe286d56"
        },
        {
          "path": "python/Lib/importlib/__init__.py",
          "bytes": 4784,
          "sha256": "d540b5ac137fcb3e26a8d5f2939649e34373c6685f98a30a9f682cf231be5854"
        },
        {
          "path": "python/Lib/importlib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4623,
          "sha256": "e31f67d28d7861a82387e003efafb5060787d64e29564bf4821fae4aa48bf86a"
        },
        {
          "path": "python/Lib/importlib/__pycache__/_abc.cpython-312.pyc",
          "bytes": 1690,
          "sha256": "ab84375f4c1a4fac2bde5f83d50ebf4405f5e76e0235d980c9229fb572a90be1"
        },
        {
          "path": "python/Lib/importlib/__pycache__/abc.cpython-312.pyc",
          "bytes": 10458,
          "sha256": "83b13eef246b82011f17e0b182b5c216444a5c719e0ec6d5257d43ee3ba67c77"
        },
        {
          "path": "python/Lib/importlib/__pycache__/readers.cpython-312.pyc",
          "bytes": 509,
          "sha256": "2b22c588e95f12c26521ffceb58f65ddf1c5419e90078c6998d8ef49b25ea00e"
        },
        {
          "path": "python/Lib/importlib/_abc.py",
          "bytes": 1354,
          "sha256": "80aab7931dc999dee581c8b8b56fcd973fe156335a96ceeaf6acfc03cebf10e8"
        },
        {
          "path": "python/Lib/importlib/_bootstrap_external.py",
          "bytes": 69428,
          "sha256": "e6ad72f3f0f9b65c99ab52598cd02ab748511dcdce1dd51f18dace9be9a680c6"
        },
        {
          "path": "python/Lib/importlib/_bootstrap.py",
          "bytes": 57057,
          "sha256": "d112d54b7831cf4a818d4841d5ff8003b54df220a6dabafa61f67d7c7a5603f7"
        },
        {
          "path": "python/Lib/importlib/abc.py",
          "bytes": 7612,
          "sha256": "5f9cb36ca1bce9d5df00bc8d4d7f46b7ea2353dfa99292ad7f099affddfb5d03"
        },
        {
          "path": "python/Lib/importlib/machinery.py",
          "bytes": 880,
          "sha256": "d045cd7ecf2a12b6ecbfbef79eb114e87ef2ebd756f5b705f73e6f3266e3dede"
        },
        {
          "path": "python/Lib/importlib/metadata/__init__.py",
          "bytes": 28757,
          "sha256": "1a26dfee8cb302b729501e944626f77e2cbcc4675038f3d18c2d8534751b3e8b"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/__init__.cpython-312.pyc",
          "bytes": 48484,
          "sha256": "76d169573928ec2590cee8e02863a55285570bc48ed8d9c90f832e084dee9f52"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/_adapters.cpython-312.pyc",
          "bytes": 3885,
          "sha256": "962628d7e5ccf0815841acd465f256cede32074e182793ee8a573d71468f33eb"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/_collections.cpython-312.pyc",
          "bytes": 1928,
          "sha256": "bff3ecb91fd0c5f0002caf6d90eb694fb117abc474dc912de8cacd3eb67a5ec1"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/_functools.cpython-312.pyc",
          "bytes": 3490,
          "sha256": "c839eef53656bb108076065c045d209ac98c8b614fcf3862e742602db351139a"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/_itertools.cpython-312.pyc",
          "bytes": 2403,
          "sha256": "98b1b02cf7f41f9e881732828ebe27235d1c357a035b180bfcac4bac35c8310c"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/_meta.cpython-312.pyc",
          "bytes": 3328,
          "sha256": "c5692a15e296b80622b8bb6543d2874ae6776612944c926544f81cd97588ac20"
        },
        {
          "path": "python/Lib/importlib/metadata/__pycache__/_text.cpython-312.pyc",
          "bytes": 3889,
          "sha256": "6ff709271ceaab4b9bc604736c8efa2c4aa25786edaa36fd51ec8b21bff48f29"
        },
        {
          "path": "python/Lib/importlib/metadata/_adapters.py",
          "bytes": 2406,
          "sha256": "de9a880abc4513af1b69ce150cd5a5093201c39131717cdc2ba6b19f4364c163"
        },
        {
          "path": "python/Lib/importlib/metadata/_collections.py",
          "bytes": 743,
          "sha256": "089d0e4c21c88d6034648552e2fa0e440b27d91e11d9c40112d3ec6442690126"
        },
        {
          "path": "python/Lib/importlib/metadata/_functools.py",
          "bytes": 2895,
          "sha256": "3ec636fb8aeb297e1155e442d681a9d65075a660bd78a37cf3f7fe6c3f6e3a80"
        },
        {
          "path": "python/Lib/importlib/metadata/_itertools.py",
          "bytes": 2068,
          "sha256": "72faffdaff0145bc5c225e71e6575fa9d1e3848f188bcb3cca4e741bf9e6ea34"
        },
        {
          "path": "python/Lib/importlib/metadata/_meta.py",
          "bytes": 1590,
          "sha256": "bd3504040497cd049e6b529bde0b461f63cd2be3070f2d0815d4dd7609b266c8"
        },
        {
          "path": "python/Lib/importlib/metadata/_text.py",
          "bytes": 2166,
          "sha256": "1c2b0592c66924b7933f734493f9e0ac079755146d4ebb7287d78e001a113f80"
        },
        {
          "path": "python/Lib/importlib/readers.py",
          "bytes": 327,
          "sha256": "d0d57d118d64916f7e6edb04f8bd1a760a1abb879125899ef50a36d09ef54df4"
        },
        {
          "path": "python/Lib/importlib/resources/__init__.py",
          "bytes": 532,
          "sha256": "4146e1d00d56a783d4087f15257f0c284fae52e71fa3f20613fa268d911bf6d5"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/__init__.cpython-312.pyc",
          "bytes": 701,
          "sha256": "59069274c991a65f4c0e8cba9f844d07ba6144d4c120d1c1f0ad79570b3c6df5"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/_adapters.cpython-312.pyc",
          "bytes": 9675,
          "sha256": "d19bcd0254ceec02028348179ac1288a469622df638888d0b92e4f9b354a1d46"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/_common.cpython-312.pyc",
          "bytes": 8795,
          "sha256": "864f5e80ad13502af76e7c80a707e1793c8bd91000697e80d61b27a4379458f7"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/_itertools.cpython-312.pyc",
          "bytes": 1586,
          "sha256": "931a1cadc567f66303f823e46ff27a8a99aac4b52f0444f0d70f45df5765887c"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/_legacy.cpython-312.pyc",
          "bytes": 4907,
          "sha256": "059397431b323916d301b53c3613747f3adbe86aa8897a0b9221d77a19410847"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/abc.cpython-312.pyc",
          "bytes": 8967,
          "sha256": "75846fa9893eb5710b80c25901564d7cf5fc5d6efc8d0cddc4e3b268cf36eddc"
        },
        {
          "path": "python/Lib/importlib/resources/__pycache__/readers.cpython-312.pyc",
          "bytes": 9045,
          "sha256": "26706261d713fb22c8436f39aec86043bebb341d00b10cbd24e0fecbd6fdbb30"
        },
        {
          "path": "python/Lib/importlib/resources/_adapters.py",
          "bytes": 4482,
          "sha256": "be9ac919b51e1db6a35fa5c2b8c3fa27794caea0a2f8ffcc4e5ce225447b8df9"
        },
        {
          "path": "python/Lib/importlib/resources/_common.py",
          "bytes": 5486,
          "sha256": "a0de4a899a2aa787b052f92f516b39f80b183c3f0d409d1305cc6dc374f18870"
        },
        {
          "path": "python/Lib/importlib/resources/_itertools.py",
          "bytes": 1277,
          "sha256": "7838ac57a46a88d64ea202d25dfe8b3861ce61cefd14680faca34bcc52e60ab5"
        },
        {
          "path": "python/Lib/importlib/resources/_legacy.py",
          "bytes": 2949,
          "sha256": "79c566fdf1a61129683e38e8c11a660d6233dd84422456ae5dd230e658a7857f"
        },
        {
          "path": "python/Lib/importlib/resources/abc.py",
          "bytes": 5203,
          "sha256": "a726c48590b21ba5532f0c654735991571bc0ecafe88145cb8891d82cd364e5e"
        },
        {
          "path": "python/Lib/importlib/resources/readers.py",
          "bytes": 4370,
          "sha256": "10884a02b4a97636887fcedc7bae248a4ff42f3e52abb80d613cc0b2190b6ce9"
        },
        {
          "path": "python/Lib/importlib/resources/simple.py",
          "bytes": 2584,
          "sha256": "090dd3888305889b3ff34a3eef124bd44a5b5145676b8f8d183ad24d0dc75b66"
        },
        {
          "path": "python/Lib/importlib/simple.py",
          "bytes": 354,
          "sha256": "8e687aeeb1db537d2717cb0352c5f126ff7d4095c6de6dc7f00d5103f3009c40"
        },
        {
          "path": "python/Lib/importlib/util.py",
          "bytes": 10994,
          "sha256": "671f2995653f673f6d5056a1089debef473bc28ae7114f7a8db71475733d6876"
        },
        {
          "path": "python/Lib/inspect.py",
          "bytes": 127125,
          "sha256": "5c54ebf0bfdc25397750e5d0f63800751650ee50e65325ff3ea4069c9bfa5f75"
        },
        {
          "path": "python/Lib/io.py",
          "bytes": 3582,
          "sha256": "7cec3cb8ac004058dd0a5af246e6d950fb59c7ddd0058fda48bcb3fcb98d8822"
        },
        {
          "path": "python/Lib/ipaddress.py",
          "bytes": 81414,
          "sha256": "ba8d3389ff084fcb232b48204ec04f2b3ea4bd0eadf7b18c814947d185de2c64"
        },
        {
          "path": "python/Lib/json/__init__.py",
          "bytes": 14020,
          "sha256": "d5d41e2c29049515d295d81a6d40b4890fbec8d8482cfb401630f8ef2f77e4d5"
        },
        {
          "path": "python/Lib/json/__pycache__/__init__.cpython-312.pyc",
          "bytes": 13662,
          "sha256": "3b426654f1050bce0507f19d4ddb7e0feee5e12f5987826f429f24802434af13"
        },
        {
          "path": "python/Lib/json/__pycache__/decoder.cpython-312.pyc",
          "bytes": 13960,
          "sha256": "063f4ab1585e537bad1d873837de06adbe6f5d9247f12b01e8d0eedfa89a07e9"
        },
        {
          "path": "python/Lib/json/__pycache__/encoder.cpython-312.pyc",
          "bytes": 15135,
          "sha256": "e29f1d2633eb346b0f7eae55d2d1e07a1b03fa205bd8675541206cd7e0d9cc73"
        },
        {
          "path": "python/Lib/json/__pycache__/scanner.cpython-312.pyc",
          "bytes": 3377,
          "sha256": "2426a90a60afdb1521e2c0235dea576c77891098cf2e9a297e9b62023b5198dc"
        },
        {
          "path": "python/Lib/json/decoder.py",
          "bytes": 12525,
          "sha256": "382cd02af6f7efede5a6d4abbcda1015e5c7a75794b0016022878f9cf32a24f6"
        },
        {
          "path": "python/Lib/json/encoder.py",
          "bytes": 16075,
          "sha256": "52bfb1b66029cc70fa3bd7fe11df9f2e03922d413407a341b387a22c987f24f8"
        },
        {
          "path": "python/Lib/json/scanner.py",
          "bytes": 2434,
          "sha256": "572958017eae8842eeddd0e3d18d3c56cc0a197348224915e1d87ce937841764"
        },
        {
          "path": "python/Lib/json/tool.py",
          "bytes": 3339,
          "sha256": "d5174b728b376a12cff3f17472d6b9b609c1d3926f7ee02d74d60c80afd60c77"
        },
        {
          "path": "python/Lib/keyword.py",
          "bytes": 1073,
          "sha256": "18c2be738c04ad20ad375f6a71db34b3823c7f40b0340f5294d0e89f3c9b093b"
        },
        {
          "path": "python/Lib/lib2to3/__init__.py",
          "bytes": 156,
          "sha256": "5373a81ab198cda8e95652dff46ecfee197a0b8901e8432ab448d97b8bc37f87"
        },
        {
          "path": "python/Lib/lib2to3/__main__.py",
          "bytes": 67,
          "sha256": "c7b09f90e66dea194ad63dc02c6425dff977d16f1f21a157b7475905c219a707"
        },
        {
          "path": "python/Lib/lib2to3/btm_matcher.py",
          "bytes": 6623,
          "sha256": "a1aa5d35558acf4b6016054963285cb145f97a764926bea07cbd674563f3248d"
        },
        {
          "path": "python/Lib/lib2to3/btm_utils.py",
          "bytes": 9945,
          "sha256": "c0653eb497a1a48195dd9c4ecbbf87e4eab31188be29ab1640e353209741588c"
        },
        {
          "path": "python/Lib/lib2to3/fixer_base.py",
          "bytes": 6690,
          "sha256": "c795a53ca849c42212c8ec33a74284e0377df852eb4ea599aba62d5af1df282a"
        },
        {
          "path": "python/Lib/lib2to3/fixer_util.py",
          "bytes": 15206,
          "sha256": "306d0b2ea8169bdca711c6a31c0b1a3ce710d38ae2b6568ef519aa38451af608"
        },
        {
          "path": "python/Lib/lib2to3/fixes/__init__.py",
          "bytes": 47,
          "sha256": "836cdb388117cf81e78d9fa2a141cca1b14b0179733322e710067749a1b16fe9"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_apply.py",
          "bytes": 2346,
          "sha256": "b5171e32758a78450854f40867775d4aca58665bc920ebece04fcfcc153af02a"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_asserts.py",
          "bytes": 984,
          "sha256": "4c77972812cb5ec0a72afbce3e1d618c27ef7b239329c5c952c2bcbe77dba5dd"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_basestring.py",
          "bytes": 320,
          "sha256": "d041443d6499a735bb78fec9da1bf33b3d034b5192c98bc273b16a44692fc88f"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_buffer.py",
          "bytes": 590,
          "sha256": "2da37b49c30d6a0b4db43146ebb4ac8e5ffcb9814816b4742e464cb856977883"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_dict.py",
          "bytes": 3760,
          "sha256": "38f460596ebfb64046aab3d9a65935bd4c76a470118fb7d10a088dc0ecdc53ea"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_except.py",
          "bytes": 3344,
          "sha256": "7ff6f560c3c3d7a5d9ceef5ba31c556341f7ce1bc1b52d96b063f6c2c4765651"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_exec.py",
          "bytes": 979,
          "sha256": "9e0893327205dea12004e88d18c580286e7977e081b5eda7baf5b7bc93bc6c52"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_execfile.py",
          "bytes": 2048,
          "sha256": "6ff65db1192099457cb3d9f2618a893c6ac430028550284f3a34d5c08042b0eb"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_exitfunc.py",
          "bytes": 2495,
          "sha256": "ef4f18f651d32410c43644c27590903d41e38e763b0e108e6c685a3412a7d29c"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_filter.py",
          "bytes": 2765,
          "sha256": "2c7f0121193395750eab2b2abf5059d9a3b1a61f81763f52511265d7bca5cb21"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_funcattrs.py",
          "bytes": 644,
          "sha256": "111df53fac6a121d61abe33883a68e731820ddc4864b0a4c1000cf2ac5f019cd"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_future.py",
          "bytes": 547,
          "sha256": "baba8cafb48dd9181a0e1f7b0f20b585ce2925e8f347e00b87407a256bb16663"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_getcwdu.py",
          "bytes": 451,
          "sha256": "5bc5252f683a401e7d81c5911617c4af1a1bcdf99a51c4bf1cfccb00446ff220"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_has_key.py",
          "bytes": 3196,
          "sha256": "32943d3b921c1c3f0d3776d19e5120806990b817bc99a7e22799847abfda1f63"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_idioms.py",
          "bytes": 4876,
          "sha256": "600e34faf36e14307e59d55088e3979881d497b8fc9d77659e77709f9e8bafd7"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_import.py",
          "bytes": 3256,
          "sha256": "803baf96f9603c957eb974f252b0ad9829c889a293e0ce6829db1bce3da6dd4e"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_imports.py",
          "bytes": 5684,
          "sha256": "cdf7ee6d85e2b148230984cfc4ea3f193be458958ea42ef290854a9672a64370"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_imports2.py",
          "bytes": 289,
          "sha256": "b6f3c628839ffe7fd72569dd6ca2210e18edae3e180002747ea011b76b7ec0ef"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_input.py",
          "bytes": 708,
          "sha256": "10c5ef3b45a4ee7e88af8852181916a788aae2bea52b08f3473815c1c43598d1"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_intern.py",
          "bytes": 1144,
          "sha256": "8d29a162536b99c91bd2f9259dda7f39fec751949d6354d2c1f2e5d070c87d66"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_isinstance.py",
          "bytes": 1608,
          "sha256": "8408c92b99f50d8c4978b47a2b2155588e315f2ebbe58c160dcdcdcb89e19914"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_itertools_imports.py",
          "bytes": 2086,
          "sha256": "2e419cfbd7f2a326ae7fa10873aa377112ebec32545238fdf988acb088c3cdb7"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_itertools.py",
          "bytes": 1548,
          "sha256": "578a51b9935020b03a510de15ece55fcd02c9474f37a54c158fb97ba5fd15af1"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_long.py",
          "bytes": 476,
          "sha256": "306b80e0a72c0d16dd934b7d51ab0c9a4224f83be5d6cbad8a7158a0a5d73551"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_map.py",
          "bytes": 3640,
          "sha256": "b82c0762c44adf2af7745c030afe291e2badfe360925046c8e58d85340717696"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_metaclass.py",
          "bytes": 8197,
          "sha256": "45a30c866aa2ff69e089da147ed09986aad4516b5e5dd943f8dfcb7d3946a3e1"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_methodattrs.py",
          "bytes": 606,
          "sha256": "8d60082f98ce52ee4955099bfd447cbadfa0e9b24ccb8d135cecc833168d44e8"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_ne.py",
          "bytes": 571,
          "sha256": "4f9cb1388ba86f29422d20979d3423fdf3541ba35a17ed44d6f4a517ff784ecd"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_next.py",
          "bytes": 3174,
          "sha256": "5c7d86d9f81b2498486d626c7feced1b92f23171cf9e42881abb78de1a93bccd"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_nonzero.py",
          "bytes": 591,
          "sha256": "c2cd7e3ba44508643a20eec4ea4c19f2f1adfd36f6b974d7c143e449571ae736"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_numliterals.py",
          "bytes": 768,
          "sha256": "1c4dd0f7881999abde6cf4d232836fa3e55fc41a7d5aa2b9866092f65707db7f"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_operator.py",
          "bytes": 3426,
          "sha256": "023872fe9f03a25387cf2c17fc950cf0f990353df66e603c3a1cd3199dbccd86"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_paren.py",
          "bytes": 1226,
          "sha256": "53734f1d7778ad28a4ec3ab4415923e2da8f230de4cd527589829f570e9f254d"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_print.py",
          "bytes": 2844,
          "sha256": "cf2690f1b502249289f52cd544190db0b94d59df5eca139829cd2bf0742e9dba"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_raise.py",
          "bytes": 2926,
          "sha256": "c38ffec5862597ee8f9dac50385af943ee312bfc394366be08b2fc12563ca1a5"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_raw_input.py",
          "bytes": 454,
          "sha256": "ce04cbaa76d414949afc230360dd9a29ff579bd868cc7f8805230d126ac9ce9b"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_reduce.py",
          "bytes": 837,
          "sha256": "9a03910a6c183586e1db01863fcde6417d06745fb3e63032333d71c5e82e7919"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_reload.py",
          "bytes": 1081,
          "sha256": "17570148167e43b2155b6e1c814a3cca9e3ef53750c504932a9c7d62a8b68a3f"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_renames.py",
          "bytes": 2221,
          "sha256": "8b71472317bf3adabf819e665c725d03e3064baa45f6ffbfd78cca83eaa46e8d"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_repr.py",
          "bytes": 613,
          "sha256": "d16930b7ef8577747cfef602aba854c64ce85d4ae1e54a18a456eaa202643e3d"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_set_literal.py",
          "bytes": 1697,
          "sha256": "33f2c0b6e16357e083c3a98877e7317abe1578a44c288e5979c9d96fb5aa6727"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_standarderror.py",
          "bytes": 449,
          "sha256": "ce7eb37bc7fb29aa138b1cec6656ae8b4886cbfa700e119a1bb8484284cb717a"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_sys_exc.py",
          "bytes": 1034,
          "sha256": "0143830586d09d702ca3eeaa8f86698e5fd18af69fd28147e71a1a77600d356a"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_throw.py",
          "bytes": 1582,
          "sha256": "fec731ed523d5cdfa21893833b52b2844eabfd1549792c1c9f8ceac2d0e8e901"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_tuple_params.py",
          "bytes": 5565,
          "sha256": "f3307d4750d0657d9c42b857d5f37bdb5824f9358939da7d16d13f61eb8abc72"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_types.py",
          "bytes": 1774,
          "sha256": "a0a133cfc78e82e1f71ce628408e7d10a38552ba3e3228ebd113838c1ce44484"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_unicode.py",
          "bytes": 1256,
          "sha256": "01b2a9b1084b6a0424f27eec488c761f75f053a409608ec36a9ee0ede0d38097"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_urllib.py",
          "bytes": 8367,
          "sha256": "3d1c04d976ff4d2841025a785aaab0cc4ee06c9c9b4e09d1e2456949fa273856"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_ws_comma.py",
          "bytes": 1090,
          "sha256": "5e7a16daec0b2619110516804bf90cac459a4d0315198fd4eff69c36c54378dd"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_xrange.py",
          "bytes": 2694,
          "sha256": "60d8ce92db6f399606d2e40a3c631ba566127e8cd637ebbf35b822672139cab2"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_xreadlines.py",
          "bytes": 689,
          "sha256": "e8c2f19f7047bfc7539fd78839929004d8fe0efba1fbcbd9d712d285e43834ba"
        },
        {
          "path": "python/Lib/lib2to3/fixes/fix_zip.py",
          "bytes": 1289,
          "sha256": "55ce115556c7513dd967364dc6a40c39210c874e8168cf090ddd6dc606df34cb"
        },
        {
          "path": "python/Lib/lib2to3/Grammar.txt",
          "bytes": 8696,
          "sha256": "508e62e787dd756eb0a4eb1b8d128320ca02cd246ab14cc8ce0a476dc88cc5b6"
        },
        {
          "path": "python/Lib/lib2to3/main.py",
          "bytes": 11854,
          "sha256": "8f5dfa77b8c8b375daba8bb88aaa195395674311e2513b29575a70821e3aa0b8"
        },
        {
          "path": "python/Lib/lib2to3/patcomp.py",
          "bytes": 7054,
          "sha256": "a033a3eb91a39f96747d4300aa3394965e529c71896cd6503dd27e6b685eede5"
        },
        {
          "path": "python/Lib/lib2to3/PatternGrammar.txt",
          "bytes": 793,
          "sha256": "ee5ba5db3b6722a0e2fbe2560ebc1c883e72328ef9c3b4da1c7c5d1cc649bce3"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/__init__.py",
          "bytes": 143,
          "sha256": "858eb0f50533bd3bd16fe32815f77fabfed92ede885070b6cb15827ec66ea500"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/conv.py",
          "bytes": 9642,
          "sha256": "e2946a686c12e02248fafb1a57e7514e0c22bdb2b4a66e644215c86fedc37bff"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/driver.py",
          "bytes": 5969,
          "sha256": "57af5e220cd6c6b75e8dead2cea395ead2297dd98e398ad705ca2bce0e9e6594"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/grammar.py",
          "bytes": 5552,
          "sha256": "4898d446d6ae73f7259a3f91839eca1a3380670a9f378b80780707f714fad17c"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/literals.py",
          "bytes": 1635,
          "sha256": "84bc9d5387a2e20fab844e530358571afa39fa3fc0e8024270b5f7d8ac5a595a"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/parse.py",
          "bytes": 8155,
          "sha256": "e245e005e524ab445a570df31f70c6fd7b901ee3b0b68bd3bcf4b41b37fa7bb6"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/pgen.py",
          "bytes": 13830,
          "sha256": "8fe2ac7e0303f0110d75832d746e6661fcd5373fa498d929163f557fd1027434"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/token.py",
          "bytes": 1302,
          "sha256": "7ee05616410d46d8caed0cb0755bf780c62cccf17e3c93c8ccb8dcaaa1e7094c"
        },
        {
          "path": "python/Lib/lib2to3/pgen2/tokenize.py",
          "bytes": 21119,
          "sha256": "aaa0b98f6a65e08e9f8e34358198e329d29554a0d4b5f5059924a252eeb0f5c4"
        },
        {
          "path": "python/Lib/lib2to3/pygram.py",
          "bytes": 1305,
          "sha256": "b49d77876a9d1822ff6be04daf464341a8e4c0c3414240abf519254de2a97a48"
        },
        {
          "path": "python/Lib/lib2to3/pytree.py",
          "bytes": 27974,
          "sha256": "e53689352fb4fc83d85a09369650389ee01db802ad872a8abfc0bf6603ec38b9"
        },
        {
          "path": "python/Lib/lib2to3/refactor.py",
          "bytes": 27507,
          "sha256": "6e9a4262fb65cd4d277f009df73ffa5748f5fe3b963d3c5395c160d5f88b089b"
        },
        {
          "path": "python/Lib/linecache.py",
          "bytes": 5800,
          "sha256": "9eb9194707991b49f9fea67a5222b0e6a0e49c865cdffc69fbc80a1f829e77fb"
        },
        {
          "path": "python/Lib/locale.py",
          "bytes": 78599,
          "sha256": "3988c5419552d5b9f0bef3695102376f79357f0f440e9cd1f32c501f966e6ef3"
        },
        {
          "path": "python/Lib/logging/__init__.py",
          "bytes": 83437,
          "sha256": "43f86bbc08fdd5c7b6e697abffe1381f534a92bb32e1f1aee8360d6a142592a1"
        },
        {
          "path": "python/Lib/logging/__pycache__/__init__.cpython-312.pyc",
          "bytes": 95452,
          "sha256": "c650fc3bb5fec65fe4aa94fdb9e32c433926303cb2f55bc0fce013535a0473ac"
        },
        {
          "path": "python/Lib/logging/__pycache__/config.cpython-312.pyc",
          "bytes": 43827,
          "sha256": "51e87a636a861e8702f6b5abdde65d1ca0f1e18ff0e55bb391f3dc06f4c9dd21"
        },
        {
          "path": "python/Lib/logging/__pycache__/handlers.cpython-312.pyc",
          "bytes": 67220,
          "sha256": "f5bbc2a88c6d554dc008735eccc5d80937c9cffc9ead5f2c2e8f45c2313839e0"
        },
        {
          "path": "python/Lib/logging/config.py",
          "bytes": 42798,
          "sha256": "6b4bdac4318ee794f667a5d5df30040abf70b9786ec5ed8bf597bd8ad0b71d27"
        },
        {
          "path": "python/Lib/logging/handlers.py",
          "bytes": 62596,
          "sha256": "e0d31066e1d11142dc795af60351ea3610c2a08ff1cedf705743ce4522517495"
        },
        {
          "path": "python/Lib/lzma.py",
          "bytes": 13277,
          "sha256": "58fb9d2fdc8a8af7b25e218f17ea3b51bdfa53bdf40f440ab33c605974ca5c2e"
        },
        {
          "path": "python/Lib/mailbox.py",
          "bytes": 78911,
          "sha256": "1c356f03e8df0b99d9d40a08ac7f3f5f71e9626c3ee1149cbed7307968ba0a4f"
        },
        {
          "path": "python/Lib/mailcap.py",
          "bytes": 9333,
          "sha256": "d3242c92bfedb13c7cf5e7aa116e9a38c07e9c6de58f53d03f72a469e9448ca6"
        },
        {
          "path": "python/Lib/mimetypes.py",
          "bytes": 23037,
          "sha256": "ed21537405f4b076318f966b810ae1d9415e16315603ad8003b1ecb24baf5950"
        },
        {
          "path": "python/Lib/modulefinder.py",
          "bytes": 23699,
          "sha256": "e07ab000c3698a7530af2c52955ac8bb7647140d22dca1c30f83443faa191e0f"
        },
        {
          "path": "python/Lib/msilib/__init__.py",
          "bytes": 17655,
          "sha256": "d024165f8b2d90e2fb428348b2e9548dea43f3539d4dbf91e752bde5a4510c98"
        },
        {
          "path": "python/Lib/msilib/schema.py",
          "bytes": 81579,
          "sha256": "a7d6c1a4699a75bb88a8a012adbb64142dc47adcc31212c3c0e7ae092b4161ae"
        },
        {
          "path": "python/Lib/msilib/sequence.py",
          "bytes": 3929,
          "sha256": "a68438bacd41b60c5359b5c5ef32163249f69233292fa94acd53535cb08cd65d"
        },
        {
          "path": "python/Lib/msilib/text.py",
          "bytes": 9018,
          "sha256": "fe5bc6023fc58e01e1c80fbe21304ccd6aadd8c384fe6afebed279c3d2925de4"
        },
        {
          "path": "python/Lib/multiprocessing/__init__.py",
          "bytes": 916,
          "sha256": "a5a42976033c7d63ee2740acceef949a3582dcb0e0442845f9717e1be771c68b"
        },
        {
          "path": "python/Lib/multiprocessing/connection.py",
          "bytes": 41398,
          "sha256": "c2f2d6f3d32d48d4d8c51a7d7c98766a04e958cae72a67c7f905438a7c332bdd"
        },
        {
          "path": "python/Lib/multiprocessing/context.py",
          "bytes": 11673,
          "sha256": "63f15d3169f4453eb80af4ce673a193a0670941206673ab5192ea16a17e8419f"
        },
        {
          "path": "python/Lib/multiprocessing/dummy/__init__.py",
          "bytes": 3061,
          "sha256": "9127a40ea0ff342cb414383b5e7c594a05be2dd835fe246bd3bb0dc036a32a90"
        },
        {
          "path": "python/Lib/multiprocessing/dummy/connection.py",
          "bytes": 1598,
          "sha256": "d63dd1979fde9c133efe430ee870e6ba6de43c0a0513866ce3ce475791fe57ab"
        },
        {
          "path": "python/Lib/multiprocessing/forkserver.py",
          "bytes": 12202,
          "sha256": "11c9f2e90ae7b0d5882a608ecc074047c10c7360834b026865696a0439bf873f"
        },
        {
          "path": "python/Lib/multiprocessing/heap.py",
          "bytes": 11626,
          "sha256": "f6bb79bb99b9ae484935f0d68822e9603a1622dd0b6c4966c79db232a93ba614"
        },
        {
          "path": "python/Lib/multiprocessing/managers.py",
          "bytes": 47893,
          "sha256": "2cb074d33a3085904e1702b0b521b22fd3428d499fc656cd740e338f6e129333"
        },
        {
          "path": "python/Lib/multiprocessing/pool.py",
          "bytes": 32760,
          "sha256": "418cd41ea5c341e66c6979a38070f6f552cbbdf0539073022b6d15c67e53f480"
        },
        {
          "path": "python/Lib/multiprocessing/popen_fork.py",
          "bytes": 2377,
          "sha256": "0a09db57e7fab7061c01a61778feea6e2b6bb02ccbc150332f2960b05258ef95"
        },
        {
          "path": "python/Lib/multiprocessing/popen_forkserver.py",
          "bytes": 2230,
          "sha256": "0588ad0e5a36718b4377dc2a2a97864a10986c25a33dc3bfed12595711b0cdab"
        },
        {
          "path": "python/Lib/multiprocessing/popen_spawn_posix.py",
          "bytes": 2029,
          "sha256": "97b5d25aa479516894489877e6a7921252ee35f51e118c2f1f91f32919e7caa8"
        },
        {
          "path": "python/Lib/multiprocessing/popen_spawn_win32.py",
          "bytes": 4515,
          "sha256": "6ef8efd9cd4e99c64a6778f7ad0957e924de9eb4aa167337ed121a2621b1ffaa"
        },
        {
          "path": "python/Lib/multiprocessing/process.py",
          "bytes": 12139,
          "sha256": "67f0c2a7a3a83c92dd024705bac18619a2e123c9df77c414beb81035ea4a0e18"
        },
        {
          "path": "python/Lib/multiprocessing/queues.py",
          "bytes": 12693,
          "sha256": "f4721a323ab2981a172dd2b853d2cfeded696e9716fba340cf6e168f5ed95f83"
        },
        {
          "path": "python/Lib/multiprocessing/reduction.py",
          "bytes": 9512,
          "sha256": "4999f8b9ae7b3e8a7f5de302612b4131498dc2e238a2c47f894905c1c63294fe"
        },
        {
          "path": "python/Lib/multiprocessing/resource_sharer.py",
          "bytes": 5145,
          "sha256": "bba3c7f2b76a9cf4e8ceb642801c405411da95adf91947d81b0043586038290e"
        },
        {
          "path": "python/Lib/multiprocessing/resource_tracker.py",
          "bytes": 11077,
          "sha256": "f9d73a8145f8026ec48ebe4127e7e84960e297cb2e247159f8df4f858cfccbf6"
        },
        {
          "path": "python/Lib/multiprocessing/shared_memory.py",
          "bytes": 18458,
          "sha256": "51301e70710220e1c494ff5383ac94442a38a4a6622f2eb94e40128c45de1aeb"
        },
        {
          "path": "python/Lib/multiprocessing/sharedctypes.py",
          "bytes": 6306,
          "sha256": "77ef522912474652490b7df523112858e51721e63dcf109b8567a35ce9b31b0d"
        },
        {
          "path": "python/Lib/multiprocessing/spawn.py",
          "bytes": 9644,
          "sha256": "ebf9fa40eb622384c37690d8c78e7208744df031155ab4ceedab0fc791a1669b"
        },
        {
          "path": "python/Lib/multiprocessing/synchronize.py",
          "bytes": 12272,
          "sha256": "78ff49cff58c0c590324e5097241371f25d61d592c598a8b2c2788f2de32a53e"
        },
        {
          "path": "python/Lib/multiprocessing/util.py",
          "bytes": 14261,
          "sha256": "6752c4515ec69f82e9df64e017da490c3754e51d818c270ea1ad2d64e09268be"
        },
        {
          "path": "python/Lib/netrc.py",
          "bytes": 6922,
          "sha256": "229da6d0cbe6a10295be6c64ac3806420ea018124c09e4887410548fc2fc8b5d"
        },
        {
          "path": "python/Lib/nntplib.py",
          "bytes": 41087,
          "sha256": "6a76a94b951b273aa87335d7c9c4d7273e4c59485c784b057f681443b32d9004"
        },
        {
          "path": "python/Lib/ntpath.py",
          "bytes": 30404,
          "sha256": "6c0d55ee892f98ef87b1ed3c50c9dfc7e267a98d2db47e08d3dc67529af56725"
        },
        {
          "path": "python/Lib/nturl2path.py",
          "bytes": 2374,
          "sha256": "560e42264a337d0d41b42713fbda072890997161aca8b7397cca8967a23f8b63"
        },
        {
          "path": "python/Lib/numbers.py",
          "bytes": 11467,
          "sha256": "ac381960a3dc1db0498b0bd43d8ef278d6599713121a186b153ff09d9552e0db"
        },
        {
          "path": "python/Lib/opcode.py",
          "bytes": 13174,
          "sha256": "192f6008508f28d3273bff42eaea9b01c8394dab1607cd36aea778bdd166c3a6"
        },
        {
          "path": "python/Lib/operator.py",
          "bytes": 10965,
          "sha256": "b2af20f67667203c1730e686cc5d0427becc94db4c97f1d3efe3ed2158473f6a"
        },
        {
          "path": "python/Lib/optparse.py",
          "bytes": 60369,
          "sha256": "07d224301cba312fa0697bff9cd5a4bb4f778a90629632091b3f4ae874d89af5"
        },
        {
          "path": "python/Lib/os.py",
          "bytes": 40821,
          "sha256": "54c43a1fc69c979c70d8f7d097174cee163bfe59937723ee353043dd4a0211e1"
        },
        {
          "path": "python/Lib/pathlib.py",
          "bytes": 51052,
          "sha256": "10ba48ae8063cfe7589436041d0d4628c05f427c7709cf8e75e486f8930cc32c"
        },
        {
          "path": "python/Lib/pdb.py",
          "bytes": 70298,
          "sha256": "c87944ee79327e534816bf8fb72b79b89ad9ef9d3664d2a7b90f8fb961450f25"
        },
        {
          "path": "python/Lib/pickle.py",
          "bytes": 66911,
          "sha256": "7e3447b6d993a6306a7893fd2fba916010ed79f8e09ceb56158a550fa8099a14"
        },
        {
          "path": "python/Lib/pickletools.py",
          "bytes": 94052,
          "sha256": "a4242b8728b0c29d15d9534fac4f7303d9c562a8edb65c87f6bc09f764953412"
        },
        {
          "path": "python/Lib/pipes.py",
          "bytes": 8978,
          "sha256": "153f2d249d954b5536c6a049202617ff43ba2f9b109c426e06676c577ddedc61"
        },
        {
          "path": "python/Lib/pkgutil.py",
          "bytes": 18281,
          "sha256": "44300bc77f6f52ef2ad74d26e5053309c04f49eaa91c099356eb61426cde504f"
        },
        {
          "path": "python/Lib/platform.py",
          "bytes": 43388,
          "sha256": "f5ff83f15c841792be42709a6710dc8d7a9f72791c1ae4cad719b1fb0abe0a05"
        },
        {
          "path": "python/Lib/plistlib.py",
          "bytes": 28582,
          "sha256": "7f427a3b717507598c73bae26ff09d3fb7664540d9b7209ca97be80c76648069"
        },
        {
          "path": "python/Lib/poplib.py",
          "bytes": 14619,
          "sha256": "e1596878e408b1702dea74ca55f13b367f93b12fd9950fc62f70d8e7b47fce83"
        },
        {
          "path": "python/Lib/posixpath.py",
          "bytes": 17356,
          "sha256": "03825681086638649a43480954f7f6a16b4da3bd41ece956864ae96e4f795cd9"
        },
        {
          "path": "python/Lib/pprint.py",
          "bytes": 24158,
          "sha256": "1585c8d74d7f485590db2af46680ae0a73737ca9fb66022b2bcbbc4c4925e203"
        },
        {
          "path": "python/Lib/profile.py",
          "bytes": 23093,
          "sha256": "dee2125b2a0913fcfd0330b75d7fb752f2dbbe1bf43e479fb0cba117b9ae6e17"
        },
        {
          "path": "python/Lib/pstats.py",
          "bytes": 29289,
          "sha256": "476a7f4298d02d7445f65f464b1eeca3b1de7a74ce104e91f75c10a7eb1f9aee"
        },
        {
          "path": "python/Lib/pty.py",
          "bytes": 6137,
          "sha256": "ddbb1749387539c2929957c7ec1235fd201d7ec15d285fe5246e88b35c722a4a"
        },
        {
          "path": "python/Lib/py_compile.py",
          "bytes": 7837,
          "sha256": "3464f04938b57a7aafbc5c394ccd4c46823ee607f7fe36b48b91ecbc30ff4e48"
        },
        {
          "path": "python/Lib/pyclbr.py",
          "bytes": 11396,
          "sha256": "e8ca09333701ba41244e20b8c2c37b7ed0499b88c4b2ca82cac51ef89ca9e647"
        },
        {
          "path": "python/Lib/pydoc_data/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/pydoc_data/_pydoc.css",
          "bytes": 1325,
          "sha256": "038d4bf51b4d373284640f3658d70eaa856def24d8d02b8e29b289beaabf1cc9"
        },
        {
          "path": "python/Lib/pydoc_data/topics.py",
          "bytes": 519590,
          "sha256": "4988d3eec54b7ac896baf8774cace20f9c76696590f6fe52a2c26c3e2751212b"
        },
        {
          "path": "python/Lib/pydoc.py",
          "bytes": 113508,
          "sha256": "d181676eadd154121c64ffdc908b0fe520da2be4095fd13f8b4c6d1bb1897797"
        },
        {
          "path": "python/Lib/queue.py",
          "bytes": 11496,
          "sha256": "f6c37fc37cd7440979f7d22d40ee818fa3b714c573610c08fa52911d541193f0"
        },
        {
          "path": "python/Lib/quopri.py",
          "bytes": 7184,
          "sha256": "a1cd7f3b22033d32151209886cc855d4b71cc4c83530769f920097582339013a"
        },
        {
          "path": "python/Lib/random.py",
          "bytes": 34689,
          "sha256": "de48263a837339c7e01cf9f3c4d756696e0e0775f7778eb9cf81ad5b00134569"
        },
        {
          "path": "python/Lib/re/__init__.py",
          "bytes": 16315,
          "sha256": "8ff3c37c63b917fcf8dc8d50993a502292a3dc159e41de4f4018c72a53d1c07b"
        },
        {
          "path": "python/Lib/re/__pycache__/__init__.cpython-312.pyc",
          "bytes": 17994,
          "sha256": "b5f8a9910ecdfc66feb1573248aa80920ca78a88e20515e49cd8c3a89b9bfe4a"
        },
        {
          "path": "python/Lib/re/__pycache__/_casefix.cpython-312.pyc",
          "bytes": 1880,
          "sha256": "ec26353e4bdb518d4d4ef3708003b700c45ba01d287d4ea1715d8c194d357890"
        },
        {
          "path": "python/Lib/re/__pycache__/_compiler.cpython-312.pyc",
          "bytes": 26558,
          "sha256": "f99ff38601c5c092b5f6c1c5ff83b5221d8ca8d3dbcc0ae877dfb89c2cd743a0"
        },
        {
          "path": "python/Lib/re/__pycache__/_constants.cpython-312.pyc",
          "bytes": 5367,
          "sha256": "02d1260b43e1aca16c71899162eb2a9a4e8dacb5f056629d0b8d17f6b065eabb"
        },
        {
          "path": "python/Lib/re/__pycache__/_parser.cpython-312.pyc",
          "bytes": 42011,
          "sha256": "ef9ab2cd6843a33114d8e187823c8f9689aff2ac9782f70b85c66406cbf0e7a7"
        },
        {
          "path": "python/Lib/re/_casefix.py",
          "bytes": 5444,
          "sha256": "1b12d9136f23db6c3f6f26053fefc15ca964b886838c7b9c1fabf8d2efc1e5c8"
        },
        {
          "path": "python/Lib/re/_compiler.py",
          "bytes": 26399,
          "sha256": "c75620761098a70ed75b9accef63ef2881d8abb6d4e5cbfd10074bd165eefe4d"
        },
        {
          "path": "python/Lib/re/_constants.py",
          "bytes": 5930,
          "sha256": "fa4fdb200f238f9e7817b63892b0d69833d8165134801e775e10cc113348a375"
        },
        {
          "path": "python/Lib/re/_parser.py",
          "bytes": 41201,
          "sha256": "a51a85b37cf3f44ba7ff25754da5f31306e4ccfa6eb3c017f9d37bdf4e770840"
        },
        {
          "path": "python/Lib/reprlib.py",
          "bytes": 7148,
          "sha256": "e177bc70da83a7fbcde6fd261dc15da34e8a20873b1cccd4f9a1f8f27cca3779"
        },
        {
          "path": "python/Lib/rlcompleter.py",
          "bytes": 7827,
          "sha256": "fee9ad9c55529be48329b78e982fbba0201bd218326eaf80a87996c9f8c805bb"
        },
        {
          "path": "python/Lib/runpy.py",
          "bytes": 12885,
          "sha256": "81e07da29bb2235111079bb64efea7d291639c5d2cf163e7af187d6a38cef389"
        },
        {
          "path": "python/Lib/sched.py",
          "bytes": 6351,
          "sha256": "56588f00a68ef953014f41baf36e0dbb7ed7793f8aa883ebcb1a8bd3787c06a6"
        },
        {
          "path": "python/Lib/secrets.py",
          "bytes": 1984,
          "sha256": "277000574358a6ecda4bb40e73332ae81a3bc1c8e1fa36f50e5c6a7d4d3f0f17"
        },
        {
          "path": "python/Lib/selectors.py",
          "bytes": 19671,
          "sha256": "1eeb102373e18c96311203f30c516e785bd8642275aa0bd66e43a284c9692385"
        },
        {
          "path": "python/Lib/shelve.py",
          "bytes": 8560,
          "sha256": "b978c6f0ffa901b041d6518afed03f2938a62168066013ee7d23baac31c356c0"
        },
        {
          "path": "python/Lib/shlex.py",
          "bytes": 13353,
          "sha256": "f927227de5ba5b1b2bdd75e3d9c8cb72b602b3bba3cc8edbf8fb554de0dc1fd7"
        },
        {
          "path": "python/Lib/shutil.py",
          "bytes": 56198,
          "sha256": "53496e06742fe008fee2bccc8caeac77473e69923bec05358bd43eea467db1f8"
        },
        {
          "path": "python/Lib/signal.py",
          "bytes": 2495,
          "sha256": "0363c964c90ac0b3e515de5749205e6e6454051a1211058375d84d91eab6071a"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/direct_url.json",
          "bytes": 309,
          "sha256": "38f9219671a77e63597bb899224a9665e4793de3113dac73f49105fb3d53ff9c"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/entry_points.txt",
          "bytes": 84,
          "sha256": "5617fcb34218817dfb9ad778bc62fbdc13dcc5d2a7a9e0853f3079f9ddf4c7ca"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/INSTALLER",
          "bytes": 4,
          "sha256": "ceebae7b8927a3227e5303cf5e0f1f7b34bb542ad7250ac03fbcde36ec2f1508"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/AUTHORS.txt",
          "bytes": 12139,
          "sha256": "4eb1fb1705e2def898e81bcba19c3aac80620d27ba3569d6a6df7b4629d1b5c2"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/LICENSE.txt",
          "bytes": 1093,
          "sha256": "634300a669d49aeae65b12c6c48c924c51a4cdf3d1ff086dc3456dc8bcaa2104"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/cachecontrol/LICENSE.txt",
          "bytes": 558,
          "sha256": "86eeee87be2a43f3ff1f56496f451f69243926f025fedbb033666c304c4c161b"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/certifi/LICENSE",
          "bytes": 989,
          "sha256": "e93716da6b9c0d5a4a1df60fe695b370f0695603d21f6f83f053e42cfc10caf7"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/distlib/LICENSE.txt",
          "bytes": 14531,
          "sha256": "808e10c8a6ab8deb149ff9b3fb19f447a808094606d712a9ca57fead3552599d"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/distro/LICENSE",
          "bytes": 11325,
          "sha256": "cb5e8e7e5f4a3988e1063c142c60dc2df75605f4c46515e776e3aca6df976e14"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/idna/LICENSE.md",
          "bytes": 1541,
          "sha256": "1a9a4f0e3d479a27240ddd59a9137a66ab4a0f9dfdc8ca6188cc0bfd85187f04"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/msgpack/COPYING",
          "bytes": 614,
          "sha256": "492dedba85da5872f78e6091bcd1fea474d660d35acb4dee964b8aab3f007427"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/packaging/LICENSE",
          "bytes": 197,
          "sha256": "cad1ef5bd340d73e074ba614d26f7deaca5c7940c3d8c34852e65c4909686c48"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/packaging/LICENSE.APACHE",
          "bytes": 10174,
          "sha256": "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/packaging/LICENSE.BSD",
          "bytes": 1344,
          "sha256": "b70e7e9b742f1cc6f948b34c16aa39ffece94196364bc88ff0d2180f0028fac5"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/pkg_resources/LICENSE",
          "bytes": 1023,
          "sha256": "86da0f01aeae46348a3c3d465195dc1ceccde79f79e87769a64b8da04b2a4741"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/platformdirs/LICENSE",
          "bytes": 1089,
          "sha256": "29e0fd62e929850e86eb28c3fdccf0cefdf4fa94879011cffb3d0d4bed6d4db6"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/pygments/LICENSE",
          "bytes": 1331,
          "sha256": "a9d66f1d526df02e29dce73436d34e56e8632f46c275bbdffc70569e882f9f17"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/pyproject_hooks/LICENSE",
          "bytes": 1081,
          "sha256": "1b22b049b5267d6dfc23a67bf4a84d8ec04b9fdfb1a51d360e42b4342c8b4154"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/requests/LICENSE",
          "bytes": 10142,
          "sha256": "09e8a9bcec8067104652c168685ab0931e7868f9c8284b66f5ae6edae5f1130b"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/resolvelib/LICENSE",
          "bytes": 751,
          "sha256": "f388fd38cad13112c1dc0f669bbe80e7f84541edbafb72f3030d2ca7642c3c9d"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/rich/LICENSE",
          "bytes": 1056,
          "sha256": "deed7c17a4318158190a3ea239cc879a5a50271cebb98ae7025f48fbe58dca15"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/tomli_w/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/tomli/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/truststore/LICENSE",
          "bytes": 1086,
          "sha256": "33be7b7e8fa4fd19b1760e1a8ed8a668bdab852c91b692dd41424bcb725a9fca"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/urllib3/LICENSE.txt",
          "bytes": 1093,
          "sha256": "130e3a64d5fdd5d096a752694634a7d9df284469de86e5732100268041e3d686"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/METADATA",
          "bytes": 4617,
          "sha256": "3a561005822841f2c45f442f6c7a7505172c8c376c9fe274d876c8ac912968cb"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/RECORD",
          "bytes": 69092,
          "sha256": "2d9b8b83eb2a02b3734d21bfa1d324278ca2e0e92062fafeb824ee291f286ee0"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/REQUESTED",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip-26.2.1.dist-info/WHEEL",
          "bytes": 82,
          "sha256": "1b68144734c4b66791f27add5d425f3620775585718a03d0f9b110ba3a4d88db"
        },
        {
          "path": "python/Lib/site-packages/pip/__init__.py",
          "bytes": 355,
          "sha256": "04aa76ceab0f4341e292daae35637f2f8718b183313cc2fb588d1304cb9c0443"
        },
        {
          "path": "python/Lib/site-packages/pip/__main__.py",
          "bytes": 874,
          "sha256": "ace651b6b5e30c1cd8db89e26b14e777d6471d62fb07411ac1574ba09de723a7"
        },
        {
          "path": "python/Lib/site-packages/pip/__pip-runner__.py",
          "bytes": 1451,
          "sha256": "ef6d0cb7a874ed471ee76bfcd04385fff2586aea0bc3d6fb3dfb3fe41f758ac8"
        },
        {
          "path": "python/Lib/site-packages/pip/__pycache__/__init__.cpython-312.pyc",
          "bytes": 668,
          "sha256": "c8d5560d907c6ed6eeab98eaf3ec830bea7e02d1dfc872ac3a161eb1aef09d1d"
        },
        {
          "path": "python/Lib/site-packages/pip/__pycache__/__main__.cpython-312.pyc",
          "bytes": 893,
          "sha256": "1647d804d2f310800d0e630ba2c4f8ce8493a43f75fbaa77f664efd71c7ca9e4"
        },
        {
          "path": "python/Lib/site-packages/pip/__pycache__/__pip-runner__.cpython-312.pyc",
          "bytes": 2237,
          "sha256": "4249442d82bd47a2c9cd91e37dcbcfae226f9d35a534056564c858604f83f710"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__init__.py",
          "bytes": 511,
          "sha256": "4bb8bd0e7f5a4994b4306fb65abbdeddd57d4c898fcef427e638e1a7db7fb9fd"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/__init__.cpython-312.pyc",
          "bytes": 768,
          "sha256": "68d8d7189526fb0473d9c5946732a88ecb4b18a24f80734cf209cac5598d19fb"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/cache.cpython-312.pyc",
          "bytes": 12516,
          "sha256": "566162e4baa6ba1303403e8cfa49faa1631895a74d5229ef55f0c98bfad8b681"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/configuration.cpython-312.pyc",
          "bytes": 18212,
          "sha256": "978c56815586fa052030d175d5e132fdd4897b8c3979481e4178f63f1d797af2"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 51298,
          "sha256": "f58f5c0c194196da1775a471eb05c12bf09b7c94190ab086fcb7d0f5899932a4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/main.cpython-312.pyc",
          "bytes": 666,
          "sha256": "9e44e6e428994caf3456127f5e8751420f196e5961b1787aa3eca0fd4dca2d2d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/pyproject.cpython-312.pyc",
          "bytes": 4103,
          "sha256": "6c02b14645c9650533349687185facbcc850922a5facd40587ce440806dfef69"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/self_outdated_check.cpython-312.pyc",
          "bytes": 9733,
          "sha256": "757ec88a2b47ac9dc80b80c947d209be60a3c52e2961eb413af782fadf37c368"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/__pycache__/wheel_builder.cpython-312.pyc",
          "bytes": 10832,
          "sha256": "37ded2cede9adba5b7e3c1ef0b530d4e57b8f667e686971e23fdd429a4b9e419"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__init__.py",
          "bytes": 788,
          "sha256": "008e71d8a7efd5ec46d486ec347b885756a0a8d82cb538ff2d6a5bc162eaf289"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__pycache__/__init__.cpython-312.pyc",
          "bytes": 877,
          "sha256": "3cecd2b89d00aac0cb9742ff429c2968f55bbe31688792d96c4990b8e1fd11b8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__pycache__/base.cpython-312.pyc",
          "bytes": 4960,
          "sha256": "163a2cd6b727d724c290f43331e2fd271f72a7db66840e6675f316455449a64b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__pycache__/installer.cpython-312.pyc",
          "bytes": 13584,
          "sha256": "05dbb390121f052c891375269118054cf7dd84a221c837a02ab84f9bc44a7fbe"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__pycache__/noop.cpython-312.pyc",
          "bytes": 2057,
          "sha256": "40835734fef213085bae78a35c5c1b81e98f4273013495b4370e0f46a5ad9409"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__pycache__/venv.cpython-312.pyc",
          "bytes": 6742,
          "sha256": "110fbf0dda65c444b3de71b56471963811107fbbee9a302579372bed7b1ebe7a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/__pycache__/virtual.cpython-312.pyc",
          "bytes": 7415,
          "sha256": "486b02eed50e76b8c9cd4230a35d360719e7f9ee0bc69df2438111c72b69f993"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/base.py",
          "bytes": 3440,
          "sha256": "ed11d6e57f9049558778aeffe547a2f466ead2ad690171c5f6dabb323df0b53b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/installer.py",
          "bytes": 13046,
          "sha256": "78c532b5009d06243d4e091a19e4c0ceafc8541a8b1f20fd389fe43532238dc3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/noop.py",
          "bytes": 1001,
          "sha256": "15793d6454d3374b3571e71913ac9c3766739c187be4e93623741717c1d3a3a2"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/venv.py",
          "bytes": 5692,
          "sha256": "3ec0e5d0fa6607d8d135a21ac21cba5e4f51f16718a00a202d2d9a7e667d0107"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/build_env/virtual.py",
          "bytes": 4858,
          "sha256": "1ec551cf3860046cb2d3a0d90683b43d6ff790811a732f52e132391f5abbd879"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cache.py",
          "bytes": 10457,
          "sha256": "7aa31055fa43f31ec67023b4574cfbde69e33c8b926a9305a10fd6444ee22d8f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__init__.py",
          "bytes": 131,
          "sha256": "22a83fb4a03bef55ee30ed4fe2dfec0c79d228fce451bf43d03aae9c09b0fe4a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/__init__.cpython-312.pyc",
          "bytes": 292,
          "sha256": "eec6624d31bed11500d2c8d80bd8eed696baf71f0a08624d6824e0fca0409da4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/autocompletion.cpython-312.pyc",
          "bytes": 9112,
          "sha256": "d46805902a43cce7360235f772b7442ca93896ddfe54752952256d1267f79097"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/base_command.cpython-312.pyc",
          "bytes": 11462,
          "sha256": "bf38b313fe671f25c07c060749388f26e59d076978029b4f028701b269df72b8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/cmdoptions.cpython-312.pyc",
          "bytes": 40566,
          "sha256": "17bc626a5ce45d33ae56446971904fa73ef6eb78cc60f8351f1e00ba6da409bd"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/command_context.cpython-312.pyc",
          "bytes": 1830,
          "sha256": "98376ff4806e690e052162870941a38112b943bc77d5dc82f33ffef2c6c9565e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/index_command.cpython-312.pyc",
          "bytes": 8997,
          "sha256": "071788da4e86abf7331124d15aa442c4afd9d89f660ff67e864f284cd9f9584a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/main_parser.cpython-312.pyc",
          "bytes": 4927,
          "sha256": "3f6da7464b07fd6050163950986fffab5555d28195cff1081d73a104b0ab5cee"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/main.cpython-312.pyc",
          "bytes": 2254,
          "sha256": "291d173204427914435849eb201eb02cedcf4f0a2ef9dcadaa0927f1744ca091"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/parser.cpython-312.pyc",
          "bytes": 18677,
          "sha256": "d1a5061334a6d73a9824bccf36939f1735810376b10b2bc7af41266b4b464b8e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/progress_bars.cpython-312.pyc",
          "bytes": 6115,
          "sha256": "7433ed29622d7904a53b21d8eebf0e6ff6e6fff05c2758b216ffa54164748f4b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/req_command.cpython-312.pyc",
          "bytes": 17953,
          "sha256": "dec7238c495652115c4bdf629487488a12fee00902e4b8d72e02744db1870ef1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/spinners.cpython-312.pyc",
          "bytes": 11265,
          "sha256": "0fa70dbaac5f07404177dc017d7a6d37edb346eff3fb363966529e7f3c8b5a63"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/__pycache__/status_codes.cpython-312.pyc",
          "bytes": 421,
          "sha256": "6be01acf411f16cfd038edaa849706eb165ba09da00d6e87eee1a1009384c781"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/autocompletion.py",
          "bytes": 7353,
          "sha256": "805b6688584771c8b3cb1e093c99c42a293eb9fb54ee4c2b52f9bbd9c4853c72"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/base_command.py",
          "bytes": 9431,
          "sha256": "c85e7f990108acb1b61b49efca6652d272e18838380744fcf56e625fbf07e79f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/cmdoptions.py",
          "bytes": 41180,
          "sha256": "681371688cb8615e007e302aac6f11a1915cbfb9305b3440ce0e669d998e183c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/command_context.py",
          "bytes": 817,
          "sha256": "926bb711665b7c17a06b5a036a69c625303f51a7a384840db8c8f609598c5eed"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/index_command.py",
          "bytes": 7504,
          "sha256": "fd0cdcf681e706eb55bc3d30c587077ded2e259a9158eb488391da4299d235e3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/main_parser.py",
          "bytes": 4368,
          "sha256": "ecf8447d9f005e2594a537c1fca24c9e0236b05f17217979d9a948d4b67f7bf3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/main.py",
          "bytes": 3209,
          "sha256": "3b5d20bb306a176332900699628eacb9ad3dedd5ea0b79e8ccaa1db533a91c37"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/parser.py",
          "bytes": 14147,
          "sha256": "5af447b88d8c745a75f3b056ad8fc3d7b2f4d9ab2af639829e783cd5a7f9d924"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/progress_bars.py",
          "bytes": 4706,
          "sha256": "d77537018dc36307442303d82ed527e41e107292540292d60a47c9faefcfab36"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/req_command.py",
          "bytes": 18952,
          "sha256": "c16fa645c3ea3dccdeab1a7d490ff287761fad101802510065ec6d94b7036d47"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/spinners.py",
          "bytes": 7362,
          "sha256": "109cd921937252d2658e9dfe5a372cc88aeac56f8752c7d6ce1b96f389ff4eac"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/cli/status_codes.py",
          "bytes": 136,
          "sha256": "f5084d7ba847aac8b0e72e70b9f88d2813a02635741c5dc8dcfd8adb59e3f8e3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__init__.py",
          "bytes": 4026,
          "sha256": "68d7826d0bab1968a17e142aec1a9a2d71ea5834348b7234e0e4bb9312baa654"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4134,
          "sha256": "83c94654da3baeaf6dcca1b13e0df20a13601031f5ee1f342ad36f3406a13f72"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/cache.cpython-312.pyc",
          "bytes": 11475,
          "sha256": "d27b865e3e946781388eac5dc621b587d2f257cfaed58facb70313cae4cacbfd"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/check.cpython-312.pyc",
          "bytes": 2588,
          "sha256": "a04224ab0b11186930b0c8c8cdd1f4f660a6b727603fd6354e40c19fcd61291f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/completion.cpython-312.pyc",
          "bytes": 5491,
          "sha256": "073027f21677ae260eaaca0944411aeeeeadcc0257751277bcf80e33118a8d62"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/configuration.cpython-312.pyc",
          "bytes": 13389,
          "sha256": "6052c8f707bc7545409b33e35eed54d9b760bc27b8e8c562160f8d62daeb3a03"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/debug.cpython-312.pyc",
          "bytes": 9778,
          "sha256": "b8b60b7e4568dae384b49c89c761ae8401912132f6bff1c51284f87e344e7773"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/download.cpython-312.pyc",
          "bytes": 7624,
          "sha256": "10740895276c7d794620d698e8fde2e9f82cefaa765501877230a9e9b0b8a52a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/freeze.cpython-312.pyc",
          "bytes": 4318,
          "sha256": "63c0d1bace3beeacd6ee05d27d0f5be4a4ba9d3510b95c11fa791b7ac58be714"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/hash.cpython-312.pyc",
          "bytes": 2965,
          "sha256": "e0eadf375f34240e0d8b868acab93124ce042339ef843249a10a5bf95edec010"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/help.cpython-312.pyc",
          "bytes": 1670,
          "sha256": "7a61c5b2a509b0399ea22ce886ddb10f2ec33003882fadf8ab817c5057f04db7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/index.cpython-312.pyc",
          "bytes": 7551,
          "sha256": "c26992e198d98aa280644c049d6824ab0371654ca0014a6488d705d45f305026"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/inspect.cpython-312.pyc",
          "bytes": 3989,
          "sha256": "c0dc9ad15509207a985973270d5029c5d73667cbdc94abb35e42b078aa59a03e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/install.cpython-312.pyc",
          "bytes": 33925,
          "sha256": "956f381a862a74e6ddb825c5b67ee5020d1d5b2327cd0002b13aa36cda409f02"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/list.cpython-312.pyc",
          "bytes": 17644,
          "sha256": "ef6539e06d725e2ac7b143228aad8555d371426d6a567e2e3f735422cf75032e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/lock.cpython-312.pyc",
          "bytes": 8324,
          "sha256": "1bf48327e8dd7a7931e9d3476c868f7dd1be5abcfdb26b3b5cb53a159f901cb5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/search.cpython-312.pyc",
          "bytes": 7638,
          "sha256": "3162dc8d823401fe4b5f08e6337b06aaf7a7edcf7133f97c57ef106b6e6a0239"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/show.cpython-312.pyc",
          "bytes": 11368,
          "sha256": "aa98aae68d28a2cf429857a77e4d8b0b7f53a2cfcd85bd3a86975f4f0165ac76"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/uninstall.cpython-312.pyc",
          "bytes": 4706,
          "sha256": "2559c61fcf7c58aea093d430074cf5d617849d82f5ea8488fec9868703cc2261"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/__pycache__/wheel.cpython-312.pyc",
          "bytes": 8682,
          "sha256": "1566a4a1ed56b465d2fa785fff097a998116761ffded140f5eaffaf10dccf023"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/cache.py",
          "bytes": 9251,
          "sha256": "60b66b2d636f0a1974a489819284991860f77dbd8c7dd606a58178274690b3ac"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/check.py",
          "bytes": 2244,
          "sha256": "85514141ecd0df38f813276859b1508ff69f3d4a6932deebf493c0958db653a6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/completion.py",
          "bytes": 4565,
          "sha256": "2e3bd1219e905220d724bdc838c15e0fefc9f7b1df8cc1a0124d23dad586bb55"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/configuration.py",
          "bytes": 10132,
          "sha256": "e4ce8a337d06de2ea830702c5544963f813dddc492250a09e9ebd4442ef9e04f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/debug.py",
          "bytes": 6556,
          "sha256": "b42594384cb3d877652c64efccda926480094244180b2e7ccc14dd7c85b2cd2a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/download.py",
          "bytes": 5404,
          "sha256": "72e5c48fd3e6a19e240acc66fc1699fce92622c57f825b8b88e552b8e3b6312d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/freeze.py",
          "bytes": 3100,
          "sha256": "2e0f043a89319d166bc1d2d62602e9056c4d52defe1eb9169440b4e5efaf070c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/hash.py",
          "bytes": 1679,
          "sha256": "18ef6944ddf05c2da441aa2f2b9ed368b60131cdc896d387f763ba404c3a604d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/help.py",
          "bytes": 1108,
          "sha256": "073dcb7233505e4cf80aefffa4be0267cea8e3e1cd2d98f535959d949863baed"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/index.py",
          "bytes": 5608,
          "sha256": "9f2fe11b35ee647ce3b2ae0220987fe987d9195266ec6ecba9041d29389b27f4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/inspect.py",
          "bytes": 3185,
          "sha256": "8a200cf89b8bfd9d7e40fdf8720025a193d2af9d0c73bc00bee1434731d0ad09"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/install.py",
          "bytes": 33761,
          "sha256": "0d11142c0f9319b08a86a0412e4adb0cacedc90e79ed06c37ba649518ba1db29"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/list.py",
          "bytes": 13908,
          "sha256": "5be172c574eb1c986a465e19a2a169ebcff9180c02f4662e63a7e115325d1f35"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/lock.py",
          "bytes": 5987,
          "sha256": "561a4d45622d2ddab2c12388a97837bee2327f9f5ca33874f7e67a67d70c88b3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/search.py",
          "bytes": 5782,
          "sha256": "cdb32c5ff6004a3ea45c0e972018130efd1b18ae75c46f825772329d925c13e7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/show.py",
          "bytes": 8247,
          "sha256": "f75fd79638421d6c8235fa0505ae1775a71bba6420a0d6e191c1c793f81c5bd6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/uninstall.py",
          "bytes": 3868,
          "sha256": "0ac3a286abdbe9903a3baecbef4a177a82c778e7cdccc33cf07f60fbd6a8720c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/commands/wheel.py",
          "bytes": 6187,
          "sha256": "e66dcdbd529ab6a2c3395a02ff858e1620c3aef4118c1e768e46efa5b640a6e8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/configuration.py",
          "bytes": 14562,
          "sha256": "d1e11d875c5394e1e1a02ad3b701d83390c48fb05b4e684868268d363decac13"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/__init__.py",
          "bytes": 858,
          "sha256": "1eaea4b7a8170608cd8ade614d358b03378234e2a807e374a46612a9e86b962f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/__pycache__/__init__.cpython-312.pyc",
          "bytes": 958,
          "sha256": "5d8d324977df87e927d960c5d6bece567f81ab59d8572120dfdd4da9d57260e7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/__pycache__/base.cpython-312.pyc",
          "bytes": 3017,
          "sha256": "2d979de8711c013ec224c3557a054653dbdca387c3c7edab7caadee1faa64a85"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/__pycache__/installed.cpython-312.pyc",
          "bytes": 1857,
          "sha256": "ad33baabd2f112e85ab491846c6e2936433302d8310a95c491ca9ea37b0d8731"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/__pycache__/sdist.cpython-312.pyc",
          "bytes": 9684,
          "sha256": "77359380f70a173e8bf0789637f085c234280a5b6cad9d77344daee0723149b8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/__pycache__/wheel.cpython-312.pyc",
          "bytes": 2406,
          "sha256": "af1526433f9bd32095e0b8d8897cfaa14a7bf2808a9a30b620b1ed27e2f4aed4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/base.py",
          "bytes": 1907,
          "sha256": "06361ace0d8485b120aced56fc90fa8c46480d5954a40fd6664a94f8dbc20644"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/installed.py",
          "bytes": 994,
          "sha256": "40f0e10aa73e1931a259900038569528c1138359bf918b9fe9104ef596650ea6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/sdist.py",
          "bytes": 7783,
          "sha256": "8687fce556ee5dafcdc9dbc5663eb33ad9f1b8f635e6db2e089562acbb8d4fe5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/distributions/wheel.py",
          "bytes": 1429,
          "sha256": "a8e315633293ded26c3b442e9dd2e3003705896fd1383ba2e0ae755d1a8caeef"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/exceptions.py",
          "bytes": 38302,
          "sha256": "65dbb5ee955b0f5788ff28e0e7665dd32800583cbc2ed5d2d40b5fbe7d693edb"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/__init__.py",
          "bytes": 29,
          "sha256": "b73c0c1ff7e141eb9bc0ca877528af6ac83571181349b360d8288c567ccc9b25"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/__pycache__/__init__.cpython-312.pyc",
          "bytes": 246,
          "sha256": "5f1d4d588589eb8363d6932d6d20d551ac70864a3977e59d80ae086ff1a765a4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/__pycache__/collector.cpython-312.pyc",
          "bytes": 22017,
          "sha256": "638fbf0f7a3dd277df1bfab5bf429d29acee26064fa95fc0ade275336845a221"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/__pycache__/package_finder.cpython-312.pyc",
          "bytes": 45590,
          "sha256": "b6a3cab15cd4d608078e7556a98ef39b3b0fec7cc71518549578ed39863bf71c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/__pycache__/sources.cpython-312.pyc",
          "bytes": 12303,
          "sha256": "148ea1bd8b5a26b72cb4addc95c26cabefaad3070958c23dfa4755e3712db791"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/collector.py",
          "bytes": 16578,
          "sha256": "6eef8d0554e821ec9811b72fd3f82d227031b022b7134c88e897bacb10301399"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/package_finder.py",
          "bytes": 43149,
          "sha256": "46858ae6b3e439c98e7625845e19e4f5a6850e06a3e10104ef415e42892a65fe"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/index/sources.py",
          "bytes": 8621,
          "sha256": "7eaa95962f772ebf87364fb0143ebbcb27d9cd2e96783912646bf5445c3add01"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/__init__.py",
          "bytes": 14022,
          "sha256": "88ff725599ffe223ee35c694361d80fef24b72f519fbccb8cef28b0d512a68cd"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/__pycache__/__init__.cpython-312.pyc",
          "bytes": 15161,
          "sha256": "e0fcf8c9be59303cc252fbc7385f429c17be30026662ef8aba14a29dcaf5edb4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/__pycache__/_distutils.cpython-312.pyc",
          "bytes": 6802,
          "sha256": "beb28f3321b806f7ee9035d4a11a841a55c2bdc860bbad4520b13838b8fb2d70"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/__pycache__/_sysconfig.cpython-312.pyc",
          "bytes": 8060,
          "sha256": "35584e4055eb2c38ae9b884aeff1b0f11e582903bdacc333364cb420a2cb50c9"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/__pycache__/base.cpython-312.pyc",
          "bytes": 3725,
          "sha256": "8e6c54caf586580bc46fd06f4fdd98d65b34502d30f8e0c25faff4b4c460327d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/_distutils.py",
          "bytes": 5975,
          "sha256": "8e9163e15d34ac3f48477bc0f53aab1a4c1c74d545739f0bb028596af81ef496"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/_sysconfig.py",
          "bytes": 7788,
          "sha256": "1e8658435b15403dc8469402a784e975340b36b0c517323dcd18d7ad36272566"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/locations/base.py",
          "bytes": 2548,
          "sha256": "e6655c5e1f639d27a910edb9686d94faa65682ecdea0e3c86d3d264620430cc1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/main.py",
          "bytes": 338,
          "sha256": "d5c1ea8ec7c50ab3057f7079b70ce87314c951d1cc2e85d4a72e6526816a522f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/__init__.py",
          "bytes": 5824,
          "sha256": "be9f8903189683ffa5e45f004f425c7b2ef6b949e1f020f0c2897df8a92d1d9f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/__pycache__/__init__.cpython-312.pyc",
          "bytes": 6778,
          "sha256": "540e092263c1100d4cabbe22c41fdb72aa374385469f36d8d3468e3f341485b9"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/__pycache__/_json.cpython-312.pyc",
          "bytes": 2890,
          "sha256": "4c95695e36aa2cf6f7542c5dbd632c291959cd8fc6abbf0b33bf17c19f7a3697"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/__pycache__/base.cpython-312.pyc",
          "bytes": 34453,
          "sha256": "df1b9817726da773898c882046c2efbd558835ad2a3198aa251cb99a43ca6db7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/__pycache__/pkg_resources.cpython-312.pyc",
          "bytes": 15816,
          "sha256": "3342d87ea8cadd640db9e67113882f52fe721c979d781e2af10545c733af5bb1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/_json.py",
          "bytes": 2711,
          "sha256": "84dbe73073972c0c8d9738ab5a13cbf4dc760af0aa6b589199ae8eb2ad587d5f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/base.py",
          "bytes": 25642,
          "sha256": "fe8f653321e689ae046bd7e171ec81f6ba778d4514f24ec59a585707b37dfed3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/__init__.py",
          "bytes": 135,
          "sha256": "8d4522768c671dc7c84c71da0161b51b68b97dd058925bffb89723a36c7b5581"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 375,
          "sha256": "934b49e7d9c933052fd9d1c269a223e46920f6a2c22952b08ec456b5f6ca5459"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/__pycache__/_compat.cpython-312.pyc",
          "bytes": 4254,
          "sha256": "b81fe79dd485e17fa9f47d796fa3a13acc523503409955233adbd85d0997446e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/__pycache__/_dists.cpython-312.pyc",
          "bytes": 12916,
          "sha256": "3e709203306ddb31f54f32921b2038fcebb41b97e684e86a46b64a1aa9696301"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/__pycache__/_envs.cpython-312.pyc",
          "bytes": 8177,
          "sha256": "e93989db3dd953fddd6ab87687cacfa5fe460c4c5ae4b035abd9048e6a7aa90b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/_compat.py",
          "bytes": 2804,
          "sha256": "b27795878ffa5b14192b8963765df2955b8ffaad2db52a9b825f665add079ce8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/_dists.py",
          "bytes": 8717,
          "sha256": "6a45f9c622c1ff776f6de6f68072fc8bbc0e462d35fc29edcb41e72854001746"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/importlib/_envs.py",
          "bytes": 5590,
          "sha256": "ba50910c45d87a29f04b90172fe42e8fb0b812b936d241e12300661363f70580"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/metadata/pkg_resources.py",
          "bytes": 10544,
          "sha256": "34eefa66b7d1dbe2ca253c9a5eb990a0686624c02b00bbda72b9591d58920d3f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__init__.py",
          "bytes": 62,
          "sha256": "023982101c57fcc1fd7ff8d58c818d08524a60261e4847b5f32caf371e2e44a4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/__init__.cpython-312.pyc",
          "bytes": 280,
          "sha256": "1408dba046340bf7264e4f0f8c0a6472a1b8dc9ae293abd792399fcdb4029f7d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/candidate.cpython-312.pyc",
          "bytes": 1739,
          "sha256": "ddb5fc299058387f7c5cd93fdc041ea77b1f88b489230d0b31b32d66d5fa04a4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/direct_url.cpython-312.pyc",
          "bytes": 1982,
          "sha256": "d43f26a378309d2eb6138a381bbadcb1957ecb255ffc9b55a912ea384172775e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/format_control.cpython-312.pyc",
          "bytes": 4141,
          "sha256": "b2f3676bd2eefc7032427e421e7e3f061d47e5cd69a6ae60c20af4e16e43f066"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/index.cpython-312.pyc",
          "bytes": 1711,
          "sha256": "d2a147108ff18287e76f9c6a5f29a48337d4ec1579448abfbf46f243e64b5b13"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/installation_report.cpython-312.pyc",
          "bytes": 2333,
          "sha256": "5061b6390aaa4558af82bc2c9410a6fada1ca034d57d1f0d84a4f5504b65939d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/link.cpython-312.pyc",
          "bytes": 28509,
          "sha256": "97f9f79cc68700cf88ff83f643289732a317e9dd1a80d73cbc616a37bfbe8f42"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/release_control.cpython-312.pyc",
          "bytes": 4227,
          "sha256": "d46a9c5fdcb5063fbdaece5dbe0c0219fd61873bd33dfff6dad0d57a89684b14"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/scheme.cpython-312.pyc",
          "bytes": 1026,
          "sha256": "cccf181c375b2e630d96beb5a1df243a058c917b42230a64e58ce359bf56b80b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/search_scope.cpython-312.pyc",
          "bytes": 4951,
          "sha256": "c16a6b99a04a9f2c0c578aa9dcbec2fccbfeb2bb6edf697e1d48a23e9c2b9f75"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/selection_prefs.cpython-312.pyc",
          "bytes": 1805,
          "sha256": "bc7c943dc048ade8c179c6b517a558acf9e8142ab50c4a22b1f4adce16591d49"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/target_python.cpython-312.pyc",
          "bytes": 4871,
          "sha256": "c82ce99a1f9cc7ab152f93b16a858c67b425698ba65ad9a39bb3e3aa0610584a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/__pycache__/wheel.cpython-312.pyc",
          "bytes": 4686,
          "sha256": "caab97c74be59defe5da78e4d6f5dc22eab2ade48690e2b40b0e32963aa31a1a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/candidate.py",
          "bytes": 824,
          "sha256": "32f00d649887930e98e13fa861233cef5d06eb2601e3f0f0a1fa03ec1026ae73"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/direct_url.py",
          "bytes": 944,
          "sha256": "f514b74d0017927c0b77c24e3995a56c157a59916cf6a9fe600624d1543c47f4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/format_control.py",
          "bytes": 2471,
          "sha256": "3f07a6606d4bdbb04cd1fd4a3fad6b9b6e304a110d172c6a943d535aedf86a57"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/index.py",
          "bytes": 1030,
          "sha256": "b589cbf28c468b8692356babd261bc0c03fbac2eb2ba16bf33024ef31c3472b2"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/installation_report.py",
          "bytes": 2846,
          "sha256": "5383255d6141fbc7afff285eb8c3bd4f69bfcb96f80be84ecd56a81d5a1b977f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/link.py",
          "bytes": 23474,
          "sha256": "4925ed14edd802b794618d91d0faad2976c07b5bd5f41aade6bfea3cddb5f331"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/release_control.py",
          "bytes": 3365,
          "sha256": "df5261f991ec4c80592defbbb8f36860b8914965c08c42358c6371c2a2ca7780"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/scheme.py",
          "bytes": 558,
          "sha256": "1be3bd28495a6dc5ea6cfc1f13feba9735f97c66a18771aee83024cfff59849c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/search_scope.py",
          "bytes": 4461,
          "sha256": "fe2f868ffc3f170640bd3b3b5a18ec9410c3ef427ef219887635c1c88f2e1194"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/selection_prefs.py",
          "bytes": 1503,
          "sha256": "d2d79e930495c56e4c3a4d163c6e4da2fc39abf5c98f18a371def99193ba13d8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/target_python.py",
          "bytes": 4243,
          "sha256": "2347854be7a26b793086b3af82ca61159b4d001d88c1767d4abf5fa7a22304fe"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/models/wheel.py",
          "bytes": 2920,
          "sha256": "d5275f0ef37b00b4ec6f267d10eb0dcb518f8ab3f59fa1231f2ccfad9c8b4a1f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__init__.py",
          "bytes": 49,
          "sha256": "14ccb4e8ffffcba8cc8d473ccf765c41d285fa9999db3335e3fbc17873c68542"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/__init__.cpython-312.pyc",
          "bytes": 268,
          "sha256": "ac82a49e484ad566687d62496fe0f3a3d015e392946ac2475964607949caf5a5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/auth.cpython-312.pyc",
          "bytes": 22017,
          "sha256": "cb06bde81e231f58d5f9f00ea828a951f5cf851453e73af2c12701890a0404d6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/cache.cpython-312.pyc",
          "bytes": 7945,
          "sha256": "514956f0c63f0b3a538a0c42cc2657eb3b0cc769f086824677f54bfb96a3b164"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/download.cpython-312.pyc",
          "bytes": 16975,
          "sha256": "615e9b024141ed76018f0362ba2c965c13ed0adfa80f7fcb90a28dd9339f55c7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/lazy_wheel.cpython-312.pyc",
          "bytes": 11579,
          "sha256": "a7948c2d528d11d28b5ecf9c6fcfe190ac08d9a732ee8db6f76ab0a89b508bd8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/session.cpython-312.pyc",
          "bytes": 19921,
          "sha256": "79a1fd58f99efec662e0429caeb4587dfdbb71c509e22bac1e8b6a660a90cb3a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/utils.cpython-312.pyc",
          "bytes": 6812,
          "sha256": "a6ef737c21ebb4075f4cb75106b7cd9880a50c4fa908e7ec6291726097898301"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/__pycache__/xmlrpc.cpython-312.pyc",
          "bytes": 2962,
          "sha256": "a89cfeff501b3167720d93120da78b18474b26cb240b54bd915bf5a2866b8c1b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/auth.py",
          "bytes": 21545,
          "sha256": "4c1a707bbcdc68fb8174195d8c039985fdb496691a729220180f80a8b72bf1e5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/cache.py",
          "bytes": 4862,
          "sha256": "e8394c5c9ee96f7e4cd6f82d4cad3e2ff9221c91717fbb7dceb7de27dbea3b7e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/download.py",
          "bytes": 14618,
          "sha256": "495ae629aa39ebb95fb3c45a09dcae3a2b73211099a7d45fdd17038ffa3cbe48"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/lazy_wheel.py",
          "bytes": 7646,
          "sha256": "cbd81592c7490928e72df633b3f9b70d8500b65de173f93ec453c305df4380eb"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/session.py",
          "bytes": 19924,
          "sha256": "d8aa8cbf91eefcf1516119030614a321ba9bb01a74957bf8b6aa0b2a73362baa"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/utils.py",
          "bytes": 8128,
          "sha256": "393035bf016dbb611ed735aba8bcac0694501938ef5f10892544c4ab2ee135c0"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/network/xmlrpc.py",
          "bytes": 1830,
          "sha256": "ffe467937bce7dff2e17d8401a64fa48b00b7e563580c05c6c6c12d767dbfd8e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/__pycache__/__init__.cpython-312.pyc",
          "bytes": 214,
          "sha256": "9adc0dca33612ec660cc3ced8a8da8a85e9c97ff74fcf126467990da56d25bf9"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/__pycache__/check.cpython-312.pyc",
          "bytes": 7192,
          "sha256": "a45c6c9a253d54d38f6028e3d9ce875a0f39d1333393f66a94e6093b1f976bde"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/__pycache__/freeze.cpython-312.pyc",
          "bytes": 10227,
          "sha256": "d0e26fef57b0bd4ffe17c761af8207f474d3cba54faf08d57198f1b729784890"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/__pycache__/prepare.cpython-312.pyc",
          "bytes": 32388,
          "sha256": "0f6a99ab2b1eec404b0c36b60229003812dbd72aba5cebb3477039e3b8d8a67f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__pycache__/__init__.cpython-312.pyc",
          "bytes": 220,
          "sha256": "fe83afcebb3aa7bed9c9e47cc7c81ad18eab4371c69382e61b6a1f7c88eae1aa"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__pycache__/build_tracker.cpython-312.pyc",
          "bytes": 7595,
          "sha256": "11d565153f66bb7affc10ae6614f9cf18c43d20e9ae2fbc80af52b625078e4ff"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__pycache__/metadata_editable.cpython-312.pyc",
          "bytes": 1923,
          "sha256": "2bddbc50d25a505f3873b649fccd218886f68c923c7fdd1082b20d6c39798e84"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__pycache__/metadata.cpython-312.pyc",
          "bytes": 1869,
          "sha256": "b8dfce6ae5c7bbcff21a887e3363cb8d839952e1de9115457ec349cb3e71c0ef"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__pycache__/wheel_editable.cpython-312.pyc",
          "bytes": 2089,
          "sha256": "05c73dabdc55bdc3d47239a4d38fed1c6570bc98af484e86084d94d539c2fdc8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/__pycache__/wheel.cpython-312.pyc",
          "bytes": 1750,
          "sha256": "61eac64622d34ef86a6dceb6ddafdca0a163338b1d39cbbda086d588053a81b8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/build_tracker.py",
          "bytes": 4771,
          "sha256": "5b76f972690c58f684e902307f3b136b2268efe3a5c451d60f17cfb9ac7529c1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/metadata_editable.py",
          "bytes": 1509,
          "sha256": "a16b9d32c9e3cb89683bf272ee0e0df67c6c9da117fe20e5551802cbba6ed6bb"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/metadata.py",
          "bytes": 1421,
          "sha256": "20d1da7a245f3a22d80970297c3351a3d0b0db12385704dcd0a22dbdf75f3a39"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/wheel_editable.py",
          "bytes": 1478,
          "sha256": "ab791f12572533a16eb556c5c04f3b24e4e9556b798b10dfdff5241c02157f3e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/build/wheel.py",
          "bytes": 1136,
          "sha256": "ddb3fe9cd889e12f09bcc6819f27acb17414061c53aadd46071e8343588f2436"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/check.py",
          "bytes": 5891,
          "sha256": "93b9938cb6f9c996e2758c3c36df6fbbbfeed4bd5e90b3b350409e378a9c36c0"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/freeze.py",
          "bytes": 9854,
          "sha256": "3c3758fb2fd9b596492c029c6963c8191280196ec35d1e3c7f468c454d23ec10"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/install/__init__.py",
          "bytes": 50,
          "sha256": "6a4f941137103ca94565a5a860a5aee505576e9141be0d2c5dcde2d0ee2f4986"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/install/__pycache__/__init__.cpython-312.pyc",
          "bytes": 295,
          "sha256": "d46c8e6aafacd5e8536b3dc9ea530426e9a655377b23aa1a057bc2d2bd29685a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/install/__pycache__/wheel.cpython-312.pyc",
          "bytes": 34461,
          "sha256": "10ee50ac6dadd58f7e17342c39f0186ad880d8824c4a2c5153a2f09266901c46"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/install/wheel.py",
          "bytes": 29078,
          "sha256": "aa11702524a12e6e2ab98f3322cb3fb7e6df7f4615e3d1d334029fbb87d2a627"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/operations/prepare.py",
          "bytes": 35030,
          "sha256": "ccb9153120eef5c511d0a9c39b76d9dd0bc879a12b8492abaf5d3d5320cc94a4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/pyproject.py",
          "bytes": 4555,
          "sha256": "27eb135aa0be5dfb0a420cfd9b56f2a4c5993c722db121f320dfcd59e2119a13"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__init__.py",
          "bytes": 3140,
          "sha256": "c77b81ed95be97f30e3e6f25745f068b4761e42f16db7741ff0387d8d996a457"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4072,
          "sha256": "8e832f8ac96bc886b54ace4803f5a40267eb7f56fa40be33aaa7b4be1d0c33fc"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/constructors.cpython-312.pyc",
          "bytes": 24816,
          "sha256": "0ed4d485eba846c5320d4955af088a817fb476b29bcd2fb36df0e7dac1847e7c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/pep723.cpython-312.pyc",
          "bytes": 2703,
          "sha256": "d19c772b08b8dfe436d8129ea8186beb047a2680cc860604c55ed408b2eebfaa"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/req_dependency_group.cpython-312.pyc",
          "bytes": 4640,
          "sha256": "90b2e981ded563d9b435a458af66a25d63dbccc61f85eb5b6f4c4f1a44abc027"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/req_file.cpython-312.pyc",
          "bytes": 24501,
          "sha256": "d7bd91c888ebbebfa615b92588f5bbadfd3b346f997d050a152580d7270bbab2"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/req_install.cpython-312.pyc",
          "bytes": 35173,
          "sha256": "f70531130ad709cc6f6f72de54e60946872217cb6222b1570fb372900fd85839"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/req_set.cpython-312.pyc",
          "bytes": 5449,
          "sha256": "4db1c1a6c1328155b7b6a0acf9f09e9c12ba8641bcd51f17f9ae6b2d42b28412"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/__pycache__/req_uninstall.cpython-312.pyc",
          "bytes": 31594,
          "sha256": "41f3c456ed9a1c4f47fb885d39e1e4a4e09c610e656b2bea016baaa588c7d1d5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/constructors.py",
          "bytes": 22276,
          "sha256": "7f020b8373a220afdfd77454197e73432cf861ab14329ecc0babbdb8fbe81b3c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/pep723.py",
          "bytes": 1242,
          "sha256": "26c1b5a7709a55c5bc7237250f69038fb77daad56b35069ebd8fd49ca874d2d9"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/req_dependency_group.py",
          "bytes": 3145,
          "sha256": "3eb58ab65c08f316d69d610a8d7b3d464ae9431dbf874d8005e7d84f465d7908"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/req_file.py",
          "bytes": 20644,
          "sha256": "7661814b167d763d5e3aad8d5eff786e8af4bb59fc3f8f80be624bfaf63322c1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/req_install.py",
          "bytes": 32173,
          "sha256": "af6f3dfff58d55a4f1a51b4b154cf716936f746bfcc986bcec6f9090fe43b097"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/req_set.py",
          "bytes": 2828,
          "sha256": "6b092a2179d80383eb9ac8f441bdf386a75b61499777ed68d0ff8a6779af450b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/req/req_uninstall.py",
          "bytes": 24276,
          "sha256": "b791d262e2e82f19c5ee3adc2010e34c43feb238ebf0ee1f668b84a8e91533f7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/__pycache__/__init__.cpython-312.pyc",
          "bytes": 214,
          "sha256": "a885dc615d337d8b86e1c538fa2960af57f4cf2d97f021b11cd3d654551ad29b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/__pycache__/base.cpython-312.pyc",
          "bytes": 1175,
          "sha256": "90558850090eb479c800bdb9b09f625116e48518d00ae25ddf6542dc4fffa14d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/base.py",
          "bytes": 573,
          "sha256": "27d16ade414e8c58fd8014a1610b6574414fad11925adb29fab3bdac87385b88"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/legacy/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/legacy/__pycache__/__init__.cpython-312.pyc",
          "bytes": 236,
          "sha256": "310e73da6af0f36de53bfe6d31a3c64f19c0a9691e8207056cc5614d5685e34a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/legacy/__pycache__/resolver.cpython-312.pyc",
          "bytes": 22552,
          "sha256": "1e246ecba8ca2f40baae2f180e8d428a4fdff4d430f8d69a638fcfb13371a701"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/legacy/resolver.py",
          "bytes": 24110,
          "sha256": "d8254b2192e6fe75e47c94ede512ad21b231bc2927f466af7f8629f5cd488c35"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 225,
          "sha256": "1b9ffe1e632dec676386166efa78583e8c2ebc7f42fd3e62b85369cab90ee9b4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/base.cpython-312.pyc",
          "bytes": 9750,
          "sha256": "01fd71ee290f8a07b7a58b655f500557bf365256209e43dedb87bd96d9d82dce"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/candidates.cpython-312.pyc",
          "bytes": 29684,
          "sha256": "5f490d545ce901f4673f86e31c79cbd54359347279095e22a6067732f9ae8d35"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/factory.cpython-312.pyc",
          "bytes": 36180,
          "sha256": "e7d7936e01ec78e8a7415e3bd4c3ccaee548b16f1a89a06784e0b3ddb3de61b3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/found_candidates.cpython-312.pyc",
          "bytes": 6729,
          "sha256": "ffc83c66c73440ef672becba8e6b88ad0e43974a7c4897513ae292e2983ee3f3"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/provider.cpython-312.pyc",
          "bytes": 12773,
          "sha256": "5e38878324d74e25206ea8a8a44dc8b701c2515f6c72dd9881921d9caf940955"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/reporter.cpython-312.pyc",
          "bytes": 5828,
          "sha256": "2d3048d1c9d02f054e958402913a7a78e2377bd0f3524f3870a8697eab122882"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/requirements.cpython-312.pyc",
          "bytes": 14783,
          "sha256": "39d247c3f1caf762b27a6ff9d4eca7a32491ff7b16a1d01e136913e4a000b6cc"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/__pycache__/resolver.cpython-312.pyc",
          "bytes": 12782,
          "sha256": "bd6c1d2597fb9b0d61c34bd55bf32b7b2a027b002e09748bbc2d2fedb08f293b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/base.py",
          "bytes": 5900,
          "sha256": "7e8ee88e842d8239901f971add5c8a2403b7a79b079e284c0f0efd67cff7d7e5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/candidates.py",
          "bytes": 20848,
          "sha256": "484929107e93eb397b55eec3c3da084bab674448fed54feae14fb6c441f42127"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/factory.py",
          "bytes": 36162,
          "sha256": "aeac270f819611d5601bb9c63fa3868f8f77ca2196ea366bd1c5bf9ac30e2bf5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/found_candidates.py",
          "bytes": 6005,
          "sha256": "179e58b577a42946d5c298655ec91ad352e4753195831d6a38d94b2bb057f873"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/provider.py",
          "bytes": 12310,
          "sha256": "364c78035e8c380c630a3f63166f309a5324e5c6d687560adbe518593284242c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/reporter.py",
          "bytes": 3918,
          "sha256": "b440bb305f08a865385b0f6deb56157cd14ab68690a5bebe0302d9a6d273d551"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/requirements.py",
          "bytes": 8239,
          "sha256": "23397d9fc9dcd7cf250350523d2f10c5fb9d7c340f1e09e0c3e8a3ea15edd274"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/resolution/resolvelib/resolver.py",
          "bytes": 13849,
          "sha256": "c0cdc27114d83dd8e74356a2dd83fa86d166904df6a35c71d9182353eca40237"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/self_outdated_check.py",
          "bytes": 8097,
          "sha256": "f57c4e5cfaac66529c7933f6b594bb23bad78e8767a9ddc6ac843c534fcbf013"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/__init__.cpython-312.pyc",
          "bytes": 209,
          "sha256": "5f1c578e99a644ceb08d8c11751c940fbb4b8844c3de0b644fd7a18f7c691391"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/_jaraco_text.cpython-312.pyc",
          "bytes": 4559,
          "sha256": "0cac4d855d53fb7d1ce4ba855fe4e24a3e9352d95a9c521e1f146406ddec7bd7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/_log.cpython-312.pyc",
          "bytes": 1880,
          "sha256": "4e4ca7ddf7f9170b2915f585d826de4f293ec4fa5cdde965a4962ca363928e2b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/appdirs.cpython-312.pyc",
          "bytes": 2469,
          "sha256": "f9c25a5700d1199d931fc7a03ef84569a22f345cb7823d1968439578c837d03d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/compat.cpython-312.pyc",
          "bytes": 3546,
          "sha256": "64ec36105aed3cbd2bba3f9dc49e4a1690cb2ec6c0b2988078c08ee3946a44af"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/compatibility_tags.cpython-312.pyc",
          "bytes": 6661,
          "sha256": "0a5af60b43b59527d46c9b91415ee9ac25d52ca57c3a8cdd69d3d03ad76d493c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/datetime.cpython-312.pyc",
          "bytes": 1557,
          "sha256": "52ebd54707616dd8abaf97a48dfdc54b384a7b97c4e0f5bce594742794803630"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/deprecation.cpython-312.pyc",
          "bytes": 5084,
          "sha256": "e50bdf792170204c886bed75d1fceea4a9a26fc6492287d40c1734f132a4a986"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/direct_url_helpers.cpython-312.pyc",
          "bytes": 3721,
          "sha256": "3712b37c5fad84135e00b174cfe263034b09e70e58ea23e808cf0f9bdf0be0d7"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/egg_link.cpython-312.pyc",
          "bytes": 3158,
          "sha256": "bd08f6f41813e19efc990a1008f3277013f1bce8718e7ab103f780893ec0aede"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/entrypoints.cpython-312.pyc",
          "bytes": 4084,
          "sha256": "53ea00ecbfa912bd10fcca6320664d8d3d21bf9787b9eff8f1db1ac85e082bee"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/filesystem.cpython-312.pyc",
          "bytes": 10098,
          "sha256": "842261e3b72f8e91a30adc191edb12326f7526dc975ebc9be7dfc172f7c599d6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/filetypes.cpython-312.pyc",
          "bytes": 1143,
          "sha256": "9debbe6eebbc624248a688b7adaa0f08a6f627724e6e2948696e6c203b564d1d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/glibc.cpython-312.pyc",
          "bytes": 2364,
          "sha256": "fa5fec7258eabfa6b467bbaeca54656db40370ba98fab3367e7e50af884ab09a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/hashes.cpython-312.pyc",
          "bytes": 7470,
          "sha256": "e5a11c909ba266fd644b3aecb840e17846ecc2628a1f39a737e13220f2f2977e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/logging.cpython-312.pyc",
          "bytes": 15268,
          "sha256": "cc43a5b34ee2d582467537a88d59a96e95ed0a64b4217fb4cd90431e78aa3ac4"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/misc.cpython-312.pyc",
          "bytes": 33860,
          "sha256": "65475dfc6309add46243f7085f9ce9637ef31edb3a48de742754cffeeb90417b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/packaging.cpython-312.pyc",
          "bytes": 1899,
          "sha256": "e2371e3641da82279f9f6c2919bd9d019013c8e090dff74aaaf0b50692e75a6d"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/pylock.cpython-312.pyc",
          "bytes": 11607,
          "sha256": "f7218dfe8d14bdae0f42f4fff151da73649ec14981516fe6469669f6aa9a878b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/retry.cpython-312.pyc",
          "bytes": 2013,
          "sha256": "6d2339755bc6a8728ce98d49065c4f96c0c744752296f8904e24231053a4023e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/subprocess.cpython-312.pyc",
          "bytes": 8520,
          "sha256": "c89bc76b943e3cbb10dc782d13c4457d37433ebd6d757a4d85965b7de1a652fc"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/temp_dir.cpython-312.pyc",
          "bytes": 11918,
          "sha256": "cfc3c386884888ca0ad47526824dc467b127dfad17c86470e997745d90ef14e6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/unpacking.cpython-312.pyc",
          "bytes": 16066,
          "sha256": "d6655a1e8bf8b54244b72bf72858e9d9e2a694f5b20b6576e6a2c18c3e9500d5"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/urls.cpython-312.pyc",
          "bytes": 2087,
          "sha256": "daf4d5535ece8bd55ba05609107c64a43f01f6583714ac53f48290d21f5476b6"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/virtualenv.cpython-312.pyc",
          "bytes": 2948,
          "sha256": "0706ecdc1f68d586b48e100c5d76cbed8fda9d195635ae0feb0b1bdf330d4d13"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/__pycache__/wheel.cpython-312.pyc",
          "bytes": 5880,
          "sha256": "6c7340b7cf2349beedf9261da4503aa64e78fc056be7f7d67634b602b98341c9"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/_jaraco_text.py",
          "bytes": 3350,
          "sha256": "335e6e50f221e4da4fd6d754181c516aeeaad59004b48f3e5f22c4113b1c15f1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/_log.py",
          "bytes": 1015,
          "sha256": "fa31cb384fd31da673e4115c0a7a122fd11802d2749d77a6e3db3da1fe23bcac"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/appdirs.py",
          "bytes": 1681,
          "sha256": "2ebcc33d930a561d2bb9bb42c7dbeedd79596cb092ba0e954a3e10b2fb7ae810"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/compat.py",
          "bytes": 2601,
          "sha256": "8b62546571aba8ff99a03f2de20c1c90103729835458296ebd10d749cb6ce5f1"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/compatibility_tags.py",
          "bytes": 6630,
          "sha256": "0e23522eaa6eaee5d46a6190c0e2765990720c62d319a5e2f4ef977fc7ce8b7e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/datetime.py",
          "bytes": 868,
          "sha256": "92e24e7f5996f06e6d44537a8d66ab75d752fbda92691e7794ad639b1dcd4d96"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/deprecation.py",
          "bytes": 4537,
          "sha256": "21016e9996be5d62775283e75f876ec1b7fbf424f33990ff564d4f922bc0bb88"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/direct_url_helpers.py",
          "bytes": 3363,
          "sha256": "58208f2679a83c7cfb92261e3eb11c5407a7da50e9093f56415226a071d608ef"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/egg_link.py",
          "bytes": 2459,
          "sha256": "6167ecadb99f72b7d682a418cba3ae223b326fd21f2f5abfdafe33b26b355a32"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/entrypoints.py",
          "bytes": 3324,
          "sha256": "b8f8c0c9284a39b768b63423254ce9ad0eabdf142f0c86705187c71ea67b0e89"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/filesystem.py",
          "bytes": 6812,
          "sha256": "82283bddb38e4b53670c1f781030ef7439c78d0a1e473fd395f40f88257b31ed"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/filetypes.py",
          "bytes": 689,
          "sha256": "b0431adfca9aaa3bf1d5989ddce0805236b7d4138153e512b9230f06f537ca3a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/glibc.py",
          "bytes": 3726,
          "sha256": "b0487c44924b612751bd3a803b84c754f3c0f9848354b0f8488f52a3e6f15f55"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/hashes.py",
          "bytes": 5040,
          "sha256": "dfcf9b08e2521e2a6943bafd46db6b307c5bda6bf710046dd46c3c905996ef78"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/logging.py",
          "bytes": 13919,
          "sha256": "8464e306e223359c72755eafb38c28c406e190723c2fef6e08ed78382bcf940f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/misc.py",
          "bytes": 25408,
          "sha256": "dbc2d6405bc55a6ae926a31c574b2889fd719e5dff81bdb9077806fe2539ce13"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/packaging.py",
          "bytes": 1601,
          "sha256": "b39b6952616e9b05741fd2524f3af2ac863827040cf29686b7b4a6ede370b766"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/pylock.py",
          "bytes": 10290,
          "sha256": "5d04d9d60821ef27e91df45d6ef8d201ed6978eb60d99db116b51e67bc25e13b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/retry.py",
          "bytes": 1488,
          "sha256": "a0e2b754680a44ac529170cf0117fbddc9d04b7843b6713df9f7808380253591"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/subprocess.py",
          "bytes": 9001,
          "sha256": "9ea373da9dc6e1000d08205c68992a210bd0518039d13c23667a188e2c8fc6cf"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/temp_dir.py",
          "bytes": 9303,
          "sha256": "4c388bf41cc4a767876a540b1f4ae1c8cde6db1bb274483d73ab758786d3e65f"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/unpacking.py",
          "bytes": 14789,
          "sha256": "e62f529fffd2344961a025e72edd92bd0690f929d3cdc51a0c7d7f248d531d4c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/urls.py",
          "bytes": 1647,
          "sha256": "2505ab440a171c1a4fb18f408a3eb56ec6633102c272ecab50ed51e96fc1c08a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/virtualenv.py",
          "bytes": 2272,
          "sha256": "f687782ec71e0f29d44ac2d31175e0b6e9a5510f15bcaa7ce9bdb1ccad18bb78"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/utils/wheel.py",
          "bytes": 4468,
          "sha256": "61d46e8fa322706f90f4c834dc56d4bf55932da9ba2dcec08228d8e2fa15ca2b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__init__.py",
          "bytes": 596,
          "sha256": "500aafce96e2d156d9a3751beac904799030fa8a08651fb35ff5a909bc720a85"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__pycache__/__init__.cpython-312.pyc",
          "bytes": 548,
          "sha256": "7ef02ca407b01239aea12cce82e906f774a0d2f590af5baa541deb9e27081b16"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__pycache__/bazaar.cpython-312.pyc",
          "bytes": 5167,
          "sha256": "4ae8b9ab41274de3338a5580249390a48236130951dc4716a5a88af2d9c1935e"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__pycache__/git.cpython-312.pyc",
          "bytes": 20122,
          "sha256": "fcf3338060a518bb84b8403984fa698d1d033dfc8dddd11c2118290e6de31d45"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__pycache__/mercurial.cpython-312.pyc",
          "bytes": 7774,
          "sha256": "89161a80bcd7f2012b04b579eb74bf400000d04ed0b43ceee50472072a172ae8"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__pycache__/subversion.cpython-312.pyc",
          "bytes": 12354,
          "sha256": "75dc6a191f9971a5c8c665b9aca323d4275f61eb456979d24902f01fc4e8bc5b"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/__pycache__/versioncontrol.cpython-312.pyc",
          "bytes": 28928,
          "sha256": "4c0dde47b266696da290dffef7da63e87d127eeb5d15fc4c3b1e5d4cc38b06df"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/bazaar.py",
          "bytes": 3734,
          "sha256": "dd6d5e1e3918c76bdce9ba1e6f634187823fae51805ccfafaf37cd84b9b54718"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/git.py",
          "bytes": 19273,
          "sha256": "2f9daba8937ef8aab4923011f3ff528bc44911c36550b25d93a562a60f1995f0"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/mercurial.py",
          "bytes": 5575,
          "sha256": "c3564958b2aa34fd689c48e47e39700559cca8f64d488111f1aca341c9d3ab8c"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/subversion.py",
          "bytes": 11787,
          "sha256": "b9481d3efc66bc407c430b63af41dcd178058db88d8b971bbc8e2f0112ce257a"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/vcs/versioncontrol.py",
          "bytes": 22579,
          "sha256": "26c5204c6e770e424fcb99975411fbbaa78543268bebdef4ee26edb39b820580"
        },
        {
          "path": "python/Lib/site-packages/pip/_internal/wheel_builder.py",
          "bytes": 9146,
          "sha256": "91d3ef01cc5f92703c07fe20ea13c38c1ec2e2eccbfdc57955d7b63a3d88a739"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/__init__.py",
          "bytes": 4907,
          "sha256": "5b3bac3d319620c790416495274876ada7c69154daf56289d874fedbe12866b5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4611,
          "sha256": "81a5a8a710065b6fe77cc3675db1ea9fb7f74dfb06b54cbf15edf63e0a197f3f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/bom.cdx.json",
          "bytes": 5319,
          "sha256": "797e200aa7fff16fad9fb2deeaece50a2b2bec623eb6c3759176eee6cee19328"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__init__.py",
          "bytes": 820,
          "sha256": "1b1c11926fd3401b4f6697e954af6be92f5d032d835675600d51c929388f6759"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/__init__.cpython-312.pyc",
          "bytes": 940,
          "sha256": "d17fe86278af09c8723274f600ca21ea554a07b49b229b2231e96a836f7d7c2f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/_cmd.cpython-312.pyc",
          "bytes": 2679,
          "sha256": "7338ab6d06493e452b2cc6510a4b08d435e30f00135ecf5bd5fe5498e9cccabb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/adapter.cpython-312.pyc",
          "bytes": 6711,
          "sha256": "8d3d56965b4d67d36777d36f46d009048cbb1ca5c76973016a4935eac32493c6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/cache.cpython-312.pyc",
          "bytes": 3805,
          "sha256": "964e2d069e763ea06fd9982eb88ab3771847c0de814ee35ecfbd0cd63792cdf6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/controller.cpython-312.pyc",
          "bytes": 16471,
          "sha256": "60b54e601bac63e67b18cd5753a7e51cac4c2a0bca2feeddbb522a3cdb5f2731"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/filewrapper.cpython-312.pyc",
          "bytes": 4413,
          "sha256": "033bf4148adde183342c21412f8c5fa8228f3adab9ec96ecc32584b1827f961a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/heuristics.cpython-312.pyc",
          "bytes": 6730,
          "sha256": "80e96f9cf5ca2c9ab95e619960277dd41e9b0f0d8e1bceec5ccdb9adc62904b9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/serialize.cpython-312.pyc",
          "bytes": 5279,
          "sha256": "eaa48c56fa2bcb060c11f0f4d0ce79f1af9cfbe3e5bb42991ec338004657081a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/__pycache__/wrapper.cpython-312.pyc",
          "bytes": 1692,
          "sha256": "1d29cd56777571978e14d0d2025b5724a0152b262becc7402df279394c393da5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/_cmd.py",
          "bytes": 1737,
          "sha256": "8a2b2dd84a7326f0d5221300c57abc8859d306c89901dea2a65c5f98d6e83729"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/adapter.py",
          "bytes": 6586,
          "sha256": "5be1d6fa5d358320ac9f190ec826eac7bb31ad662805b2ab0ec2a455540de8d1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/cache.py",
          "bytes": 1953,
          "sha256": "397c2fec59f60309ca3626a12479e3b6f68a2e776f54bbfffb33be96d955f6a2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/caches/__init__.py",
          "bytes": 303,
          "sha256": "76daebae82b90670034751968c2675f5a674b45b0c7ef141b4b410535b29fda8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/caches/__pycache__/__init__.cpython-312.pyc",
          "bytes": 453,
          "sha256": "ca723750235f9991919845605a0f9e5592978c8300f51aa74b350d5c26d55d01"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/caches/__pycache__/file_cache.cpython-312.pyc",
          "bytes": 7052,
          "sha256": "f194dc1ce9a524594d895737162542b7278964c1867c184e2bb686aaeae303bb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/caches/__pycache__/redis_cache.cpython-312.pyc",
          "bytes": 2751,
          "sha256": "84c1d58ac4a96fb5f0436c4c5d951e63b7a865fa707a2009bbda8264822dcfa5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/caches/file_cache.py",
          "bytes": 4117,
          "sha256": "77cba9166cbfcf06829a56d61150652d715d76df19c3c739485a7178e66c75fc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/caches/redis_cache.py",
          "bytes": 1386,
          "sha256": "f6b9aac2d62efe58d5916ebfa0ba9b0bb11a5ff6bc613ff22ee9daf9e4b4760a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/controller.py",
          "bytes": 19102,
          "sha256": "c416ae0bebd44aee46b09b310f8f96f8968aaaa6c1cf430de99bfc3c0d8df212"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/filewrapper.py",
          "bytes": 4354,
          "sha256": "0e1c42feb4a4f9b78a75bb1885fbc1503a2f4075fdaf78071ff8cff7eabf98a9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/heuristics.py",
          "bytes": 4881,
          "sha256": "82a31753cc34810b8442249dbb7620fb4bddf645bb9eb58a6cb71aef9ae17861"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/LICENSE.txt",
          "bytes": 558,
          "sha256": "86eeee87be2a43f3ff1f56496f451f69243926f025fedbb033666c304c4c161b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/serialize.py",
          "bytes": 5163,
          "sha256": "1d0776225950d391f33e454b3174c5dae5f99a31108c3064c42a94254383a599"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/cachecontrol/wrapper.py",
          "bytes": 1417,
          "sha256": "86c19cee0f101904d3fb87fcb60cf700ce6ac12720e853b405274b491744be95"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/__init__.py",
          "bytes": 94,
          "sha256": "f96d51ff2f1609a4a44f5b5d8eec47ff34c1658d581fac5081d3759db05a8ce1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/__main__.py",
          "bytes": 255,
          "sha256": "d64dc2afde6f0b1c464460e58eb5b7c0c76965d2f73617f4bb59fe936a9db026"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/__pycache__/__init__.cpython-312.pyc",
          "bytes": 336,
          "sha256": "4fb770d2b1af36fb830dddfe83104db085ec6ce267a7e564a3a34ad12160ef44"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/__pycache__/__main__.cpython-312.pyc",
          "bytes": 678,
          "sha256": "6e1af6326878a565bf71ae3287884432ea8d9c6907abd2d95e22852caa797953"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/__pycache__/core.cpython-312.pyc",
          "bytes": 2100,
          "sha256": "5856253b0f8061153eec33fb2eaf4d48976388cb88ca301e636b78428a30bb4d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/cacert.pem",
          "bytes": 234354,
          "sha256": "bbc7e9c01d7551bb8a159b5dedd989b8ee3ce105aff522b68eb1b01bf854cab0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/core.py",
          "bytes": 3442,
          "sha256": "82efc40952359b746ad32b69b0d13ad6181019c29a380b7d46cf46f0ab1308e2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/LICENSE",
          "bytes": 989,
          "sha256": "e93716da6b9c0d5a4a1df60fe695b370f0695603d21f6f83f053e42cfc10caf7"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/certifi/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/__init__.py",
          "bytes": 625,
          "sha256": "b66613841d719a07d18d1b72cbc60fd22d329ab1769fa795b307302ba3986dc7"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1302,
          "sha256": "23a4169e56cba5c70c937332962d4cca092bda5b991700ea4df820f019ec1fbb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/__pycache__/compat.cpython-312.pyc",
          "bytes": 45404,
          "sha256": "944b50ece6963ba4978f27168bba90e4204f4690998e4cb305cdd504e837630b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/__pycache__/resources.cpython-312.pyc",
          "bytes": 17932,
          "sha256": "80d7a07ead245140f189c7450b79460f15a2eef7546667818094539898a6a2ec"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/__pycache__/scripts.cpython-312.pyc",
          "bytes": 20092,
          "sha256": "7d5aefe9b76505353d82ef03d876af05268405adb03612480094953122051c4e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/__pycache__/util.cpython-312.pyc",
          "bytes": 89441,
          "sha256": "732352b75f27477b65a32858308a458d29a3c15abf14b2d48aafa3fdb8263cd1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/compat.py",
          "bytes": 40605,
          "sha256": "1d3ce1398f7c73f7f231513bc6d56e659f80564378f9119eb3e8569afbb0aae9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/LICENSE.txt",
          "bytes": 14531,
          "sha256": "808e10c8a6ab8deb149ff9b3fb19f447a808094606d712a9ca57fead3552599d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/resources.py",
          "bytes": 11350,
          "sha256": "c19b7f024a3c4d8f8be9920098fe3627b30d5f45d3105ea090cd0e9b917b50f6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/scripts.py",
          "bytes": 18835,
          "sha256": "ad59b803e61f1900e9b0e4703b2ec0c1ea724536b2bb2eab73e32768230101c3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/t32.exe",
          "bytes": 97792,
          "sha256": "5fd873e09786a1eaabaa44261e9e30609d88745da040ebb702c1a5069ab345ca"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/t64-arm.exe",
          "bytes": 182784,
          "sha256": "81f7936c6d05cadd4a185bb9a8a64abe9a72c937ad979ea5afe672de59123fcc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/t64.exe",
          "bytes": 108032,
          "sha256": "acd47a82dc01132e3b8414f683c2e117c18aedbf650a370249fe9fdbc445cda1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/util.py",
          "bytes": 68167,
          "sha256": "9f64035ef0745edc2bb5e872827c1d2e02e42e26b9f2c663ce064f2b20faac01"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/w32.exe",
          "bytes": 91648,
          "sha256": "f27b3724964ff524e837374847d2856f7d10a884516fc34200d0a2332a739789"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/w64-arm.exe",
          "bytes": 168448,
          "sha256": "f6704d3a1022f69ad6b7e604a927d00ce2f9dae515bfad5a7df9a2e3e4bd2448"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distlib/w64.exe",
          "bytes": 101888,
          "sha256": "55b21889fd3d28799b834fba3d29482e7aa1b0519864b790e3914af7cdda666b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/__init__.py",
          "bytes": 981,
          "sha256": "d9f1e317e49f80fbe3c8d67588787fc23a96751fd8a393831f0642d232c13e17"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/__main__.py",
          "bytes": 64,
          "sha256": "6eef5ddd389fa0a72264572a441bb2815dc64ae4e19d50ff9b620ae1ccfde95b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/__pycache__/__init__.cpython-312.pyc",
          "bytes": 993,
          "sha256": "a2741af88716be863d2d623f27024ba21b707d1d282c8c9394b7e8b4afee0df8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/__pycache__/__main__.cpython-312.pyc",
          "bytes": 325,
          "sha256": "2f1cffb30a768119e2fa41f68bf8528de081f086f11cc4767205d60cb84bedcc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/__pycache__/distro.cpython-312.pyc",
          "bytes": 53825,
          "sha256": "9867f79572b270d93897026ead2733c794c33954a8bcb49901b2588972a8e24c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/distro.py",
          "bytes": 49430,
          "sha256": "5ea6de7da7008434f8cebfedae76c0d79798f2f74ae064e08609af506ac433fe"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/LICENSE",
          "bytes": 11325,
          "sha256": "cb5e8e7e5f4a3988e1063c142c60dc2df75605f4c46515e776e3aca6df976e14"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/distro/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__init__.py",
          "bytes": 868,
          "sha256": "30fa8d0cb65b5ea19a35d5f1005862a853ca1105e3bb68cd42109ecbafb97893"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__main__.py",
          "bytes": 83,
          "sha256": "e0930aeba5a3e2e2d94ca6c5fac4f72c0c4eb2be9bba283becf98e909091471c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/__init__.cpython-312.pyc",
          "bytes": 904,
          "sha256": "3a0a8021d0cd19cb1f17faec3ace181497151900a570019585734e4815c1f1cb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/__main__.cpython-312.pyc",
          "bytes": 390,
          "sha256": "dc294d72859f6c1eef3b039d3ea05397980aed4302203676ca1c60bb3a73e369"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/cli.cpython-312.pyc",
          "bytes": 5895,
          "sha256": "9d6818957c13fd7a7ddf6b8c4cc3daf36e2267bec41188c0bf94864ec06d13ca"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/codec.cpython-312.pyc",
          "bytes": 6361,
          "sha256": "7489910a510ede4fb39cb14e3796eb2a9543a5f87e2de46054ffc9dc06c229a3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/compat.cpython-312.pyc",
          "bytes": 1941,
          "sha256": "7a69f43109e52da13447fe0cc06a9abf140fa3008c1b31c26dd54431fdc12780"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/core.cpython-312.pyc",
          "bytes": 28074,
          "sha256": "c83d92968b385fa0bfe02b143320d2ea659b08d4a69fdeb3256e8b8d271d76b8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/idnadata.cpython-312.pyc",
          "bytes": 22051,
          "sha256": "69c20c4f3a62322a7d775817040090a62fad1a73f0a67793a397f087651607c8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/intranges.cpython-312.pyc",
          "bytes": 2609,
          "sha256": "54bbbf4e67978a3633c18eb74ef11f982192b3f3ec384d4d5b52986c322d0c07"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/package_data.cpython-312.pyc",
          "bytes": 235,
          "sha256": "0af5f4858d80cee0cfcafba2f948ecbdeb6b7810495f402738ada9cf658299fd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/__pycache__/uts46data.cpython-312.pyc",
          "bytes": 96272,
          "sha256": "39c8d8397ad8bbb2abc2de8b5f49180f5b2da67417b102d7c87963086729f912"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/cli.py",
          "bytes": 4139,
          "sha256": "b30a892cc35cf14ceceb42b388da5b5a71eeaa51b75914302526e8e27f310c0a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/codec.py",
          "bytes": 5040,
          "sha256": "2516e8f9fee91242dd59e887f3d67bd94478541621bca0c5ad005e357eac4431"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/compat.py",
          "bytes": 1353,
          "sha256": "01ea40dfd71e447c647c73f8d7e16f296e4a8be7f83df519f7445432508d766a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/core.py",
          "bytes": 24685,
          "sha256": "49f3abd713b73e8134443631edb31c8809e38b28c93db3f0ffddc007921460ec"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/idnadata.py",
          "bytes": 44862,
          "sha256": "01ffa6a3c5819a48402ba4f25ca3901fcf0e5f49903432ad74bed45ad429a699"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/intranges.py",
          "bytes": 1851,
          "sha256": "838f6c70b4a4a89b4084b98e3836bb8551eb8928e66fad2d893b04a287097412"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/LICENSE.md",
          "bytes": 1541,
          "sha256": "1a9a4f0e3d479a27240ddd59a9137a66ab4a0f9dfdc8ca6188cc0bfd85187f04"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/package_data.py",
          "bytes": 21,
          "sha256": "4de23de04a8014015a5df049c2c38f50c2e7dbdebdba2acf6be0da79a71e0325"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/idna/uts46data.py",
          "bytes": 234325,
          "sha256": "8ee8cdcf942a58c7097fe5d82efe17d6306f6f9165234b7af9ed6620bb206cf9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/__init__.py",
          "bytes": 1109,
          "sha256": "440f2072a2b5ed8a64c419cdc172556b5a1ad8bca058381f1759c0d4d3f0de6a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1757,
          "sha256": "437eabedf4ffb8e08be5e12da1b1bc193dc3391aff895c0921744cc96593ab8b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 2043,
          "sha256": "8632492a8abbfef1e81a18f0a2f78fffc80ceafb84bf0f7fc8d3ae295445d828"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/__pycache__/ext.cpython-312.pyc",
          "bytes": 8311,
          "sha256": "a572823534baed44e8127014ccd49886a17488866781cdf0d6d6b1e50703cb08"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/__pycache__/fallback.cpython-312.pyc",
          "bytes": 41508,
          "sha256": "06ee0ae2bbf9f87edc5369e8f637ba8467c464dd4931cfa799f2c542a2a232ca"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/COPYING",
          "bytes": 614,
          "sha256": "492dedba85da5872f78e6091bcd1fea474d660d35acb4dee964b8aab3f007427"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/exceptions.py",
          "bytes": 1081,
          "sha256": "7424d67a2f1da64accb100dc8d093be004e5f47b08047d326edf3338f36a3187"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/ext.py",
          "bytes": 5726,
          "sha256": "92d789bf4de7f6d633779a28df1628a554e8e2f45a031a27050409857a21659a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/msgpack/fallback.py",
          "bytes": 32390,
          "sha256": "d20d4fce9d2fb66044989e70f45decffe24c55444ff114b81b571ce5345a02c2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__init__.py",
          "bytes": 494,
          "sha256": "42130474fbb65e882b2735774b42964bab7b97423d93c11e0d1265e1f9f0f3bb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/__init__.cpython-312.pyc",
          "bytes": 576,
          "sha256": "0ca10a921f33cb6d1720e3ccee265dbe643fa5e1563502d05a587e1fd383ea61"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/_elffile.cpython-312.pyc",
          "bytes": 4956,
          "sha256": "bb70b6a11eb0a4598a54aff789e5d1f80f1ab46f1b02e1fe31e7f97fdb5ee0a1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/_manylinux.cpython-312.pyc",
          "bytes": 9875,
          "sha256": "87aabaadc25d911d09b59dd438da8f4668be9d6bd1169d32ff3156f1fb494280"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/_musllinux.cpython-312.pyc",
          "bytes": 4584,
          "sha256": "09a64d33ded70352473e0a00e70a7c50172067e7e08fbab1e382c0cb962f4ca2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/_parser.cpython-312.pyc",
          "bytes": 15593,
          "sha256": "6cfd2006b6733e13d33399efe2061b478bfb5a6d35f7f49ec802f93a7ddc99d3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/_structures.cpython-312.pyc",
          "bytes": 1632,
          "sha256": "9b1e8298d4dcaa9f4324a9fe0b204777702bc723e015769366f18a9418456abf"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/_tokenizer.cpython-312.pyc",
          "bytes": 8468,
          "sha256": "887e74db09ada299673f87c42908768e25691c006b95ab7fa9dd9e4d5ea6e8cd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/dependency_groups.cpython-312.pyc",
          "bytes": 11033,
          "sha256": "0e1e8d6a03658c4e7dd724eb44fe1de289e2db0c467959f20e203213a715d331"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/direct_url.cpython-312.pyc",
          "bytes": 14545,
          "sha256": "dc6b4cfa075f932384b4f8e18cad0602baa159e576dfa3d1c19269e6bdc8f648"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/errors.cpython-312.pyc",
          "bytes": 4442,
          "sha256": "20db4e7e451d2170a200ea0d170cc29e859eaac897be007e6fea2bf0e1d71549"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/markers.cpython-312.pyc",
          "bytes": 17479,
          "sha256": "c8efa3471bc5d48146ba39ecd220f835d0af27b38fe462aa7b781536bcefd534"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/metadata.cpython-312.pyc",
          "bytes": 31294,
          "sha256": "a4029aa29b70802c09b956e5571d5532591cf061a67e723730926c9349a3242d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/pylock.cpython-312.pyc",
          "bytes": 37423,
          "sha256": "d0b4a965a92f8f06f7e2ba703a7e531754dcdc0f50fbe64374f8d60c4ed2dd37"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/requirements.cpython-312.pyc",
          "bytes": 6120,
          "sha256": "663f7676c47903ac8c1cfb636b79e6c982aac3793751ff74d6b630cd43963b96"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/specifiers.cpython-312.pyc",
          "bytes": 75803,
          "sha256": "2e6271d423f034910cb03cada58a770de6d10a683ac8696db7378477ef983676"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/tags.cpython-312.pyc",
          "bytes": 37384,
          "sha256": "5dfa34a9b4d561d31c26ec2879605708d8b78d37eda303f6e3fce02c5f64da66"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/utils.cpython-312.pyc",
          "bytes": 11072,
          "sha256": "39d35f5f25ef8288932265ca326a905e2246efa42bbbb126e242469be98ab2db"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/__pycache__/version.cpython-312.pyc",
          "bytes": 41817,
          "sha256": "a86ba86b312552b041def2c593afea6ccaf99d362f1ece3d0594e9b0dc4f15bc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/_elffile.py",
          "bytes": 3211,
          "sha256": "fac2a4a6d62acd8c36fb1dd007225ae66078adf3d6bb5a719191d1c755801426"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/_manylinux.py",
          "bytes": 9559,
          "sha256": "1dfea707470eadac84b3debea77a085c08069c5aaebf6d033b997ea36fd79efd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/_musllinux.py",
          "bytes": 2707,
          "sha256": "67ab308c7dcc03b5d2dea5e798c37b40f86a3f77e7a18234790d7c7bdf878001"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/_parser.py",
          "bytes": 11698,
          "sha256": "29fda7b03c38739e17f36a58f1b6b8174d81bdee8eca018c0232fe05e82a71ec"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/_structures.py",
          "bytes": 1109,
          "sha256": "eb48d16c5efca7ccf930a9cd77a700a6b80e69d0891d5d03966526441a8565cb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/_tokenizer.py",
          "bytes": 5391,
          "sha256": "b455365abf996497406e45cb109a3ba9440325a2247dfb7d0ea6a27e210d0fb0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/dependency_groups.py",
          "bytes": 10218,
          "sha256": "5d92005452bdb871b84421a9ae6267dd522751631eb3185afe4cad26e30ef5e6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/direct_url.py",
          "bytes": 10917,
          "sha256": "78a99b0e23cfd6c2d5e0c8ff902499aaa927ac8c953bd4abec9a45f0a0a3a785"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/errors.py",
          "bytes": 2680,
          "sha256": "ea17c461701ff2ffc817ae7e94569d24e30889e04fdb120ab721178c6d67188b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/LICENSE",
          "bytes": 197,
          "sha256": "cad1ef5bd340d73e074ba614d26f7deaca5c7940c3d8c34852e65c4909686c48"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/LICENSE.APACHE",
          "bytes": 10174,
          "sha256": "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/LICENSE.BSD",
          "bytes": 1344,
          "sha256": "b70e7e9b742f1cc6f948b34c16aa39ffece94196364bc88ff0d2180f0028fac5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/licenses/__init__.py",
          "bytes": 7293,
          "sha256": "fc9c745d1883ff9f296a5b169f22eb2ee879f59a4608f20f5cb29d668f4e26f4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/licenses/__pycache__/__init__.cpython-312.pyc",
          "bytes": 5478,
          "sha256": "bde347c03180ac8014b3f6bc295a3c275b149e942180b013d1df633702291b5d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/licenses/__pycache__/_spdx.cpython-312.pyc",
          "bytes": 49893,
          "sha256": "2aa0a6b5409463a193fc62704d254c79386220bbb995b3f72eac4d8c5b625ba8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/licenses/_spdx.py",
          "bytes": 51122,
          "sha256": "596ec35e2ca0ebcba9fd8343ff0a51625af548786257815f24b41f7e08613314"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/markers.py",
          "bytes": 17067,
          "sha256": "422c4155c6fd0f61e3c04622ba1a4d91baa4f739cf45b53cccd5f4911d5122b5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/metadata.py",
          "bytes": 38770,
          "sha256": "72b021d04dc654656a3e5bba11d445b1a1be63a518ce74d4aa3b8629118fbfa7"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/pylock.py",
          "bytes": 33890,
          "sha256": "1bfd609dc4e60db44b6358e8e150c8f54c3e6f9204ae1fd0f55fc16d5253983f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/requirements.py",
          "bytes": 4395,
          "sha256": "43e05d107556e4aefce46057b7b45c3f8504b1d20a5a8585aa5ac78d1e16579d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/specifiers.py",
          "bytes": 71550,
          "sha256": "dd705c4ac966f984041043bfcebbf817a751e70471b3812b26f274be33417c63"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/tags.py",
          "bytes": 34236,
          "sha256": "00d607671610569f4194e41838753902b0cd548a53165e0a95ba1c6150569c5b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/utils.py",
          "bytes": 9848,
          "sha256": "33bf8930a89cdac3f562d57ff1a5bb795181fb1dc00ee282892aec55e09dd94a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/packaging/version.py",
          "bytes": 38393,
          "sha256": "31cbbb4dfe98d62d20438157bf8b7483c71b2f98e8004b218e0229cffdaf2122"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pkg_resources/__init__.py",
          "bytes": 124451,
          "sha256": "bdb4c9d3faee5201b1423944aacaee16688d3d5ca1dadf6afb3c930d3d39df12"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pkg_resources/__pycache__/__init__.cpython-312.pyc",
          "bytes": 161282,
          "sha256": "ea8b647c84bc730a6552b4fcd9fee65fb4fe6491b70ae17f4cf49848bd8fb713"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pkg_resources/LICENSE",
          "bytes": 1023,
          "sha256": "86da0f01aeae46348a3c3d465195dc1ceccde79f79e87769a64b8da04b2a4741"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__init__.py",
          "bytes": 32389,
          "sha256": "80198bfc9fca74f80a8b03377470a8fb2fbc09b4b4e9009ad5722127d6c881ec"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__main__.py",
          "bytes": 1773,
          "sha256": "0d0d68d44d65d0686e8ad8f8b9024a00fc2470a6c6ce4cced2c6e1cddf516d47"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/__init__.cpython-312.pyc",
          "bytes": 29889,
          "sha256": "9e685a00c11ca7a5c978d27db017e55dc4f6c74a85eec4f09c8379af0f0b1a88"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/__main__.cpython-312.pyc",
          "bytes": 2183,
          "sha256": "07699e86b73f8f575b191c94d03857b0c61183d98db37cde235b7eab3afcdb9f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/_xdg.cpython-312.pyc",
          "bytes": 13550,
          "sha256": "231e7d9acf2250c91ab19a373f1c340bf96c4ce29f610c29e3e1a0fab5d477e6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/android.cpython-312.pyc",
          "bytes": 14034,
          "sha256": "1b6cbd9d621c763073eb74caa57ff71dc20300acbc423d2ee38e2f9c35cf9680"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/api.cpython-312.pyc",
          "bytes": 20887,
          "sha256": "c4668f828bf19d4b40391a3337d9632f689038c88f1acc074ed7cfd935d0292e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/macos.cpython-312.pyc",
          "bytes": 14420,
          "sha256": "bc3eedb02f754d162716767bb66c661df8ca19e521d9328d627c53bbfc433521"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/unix.cpython-312.pyc",
          "bytes": 19843,
          "sha256": "00a3249c5b60eb1a47c93d0c32e99d540b3878653893da1b79bbbf967ccbe086"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/version.cpython-312.pyc",
          "bytes": 668,
          "sha256": "105330d66daed600b98085884076bca62560f84daf6764df6959aa0ec1994a80"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/__pycache__/windows.cpython-312.pyc",
          "bytes": 21940,
          "sha256": "60736ced4d1e1b9bbc24bd87a858549122a54c537ac8c0ddc7c6bc49f4a2a010"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/_xdg.py",
          "bytes": 7894,
          "sha256": "e70e92d3bbd569b1113a169407f5fb8b48662cd6dd62d0bd684bcf6ec1084bc3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/android.py",
          "bytes": 11566,
          "sha256": "0418f7c1fc3e75fb95c6c0ac2acbc5072295b2944381fbfc8302338691352514"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/api.py",
          "bytes": 14887,
          "sha256": "11a22c1605c6bbc7034dbe3558cde1b1efd2ac8a0e521b7cfd30a8e5774e3923"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/LICENSE",
          "bytes": 1089,
          "sha256": "29e0fd62e929850e86eb28c3fdccf0cefdf4fa94879011cffb3d0d4bed6d4db6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/macos.py",
          "bytes": 9538,
          "sha256": "3d6b9d78364063d52ec0b3ffe6b3777b149116d61d639e368438636a1e1d4960"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/unix.py",
          "bytes": 13317,
          "sha256": "5fb0a2a75c4e1c53a7495bdea8a5b35353fb8e7e33b831a9460995c499e4e2f9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/version.py",
          "bytes": 522,
          "sha256": "749bdd9bb2ffef0a1b11cc6b36826d1fb0ad998706fd5479c8d9ad06c849fb1b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/platformdirs/windows.py",
          "bytes": 15798,
          "sha256": "60e75218d85da719bfc9d66aeee1bbe22f665f6fd659b70c480e1fa1b5f02f43"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__init__.py",
          "bytes": 2986,
          "sha256": "5e777fedf254a94ffa0f46f15d6d2a4bd33f384f46e955bc60d3db18b5a82b04"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__main__.py",
          "bytes": 356,
          "sha256": "22a010ffcdfa2afd824f1f2be887ba76e450b9848f97ce6c6d8a2613022c635e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/__init__.cpython-312.pyc",
          "bytes": 3510,
          "sha256": "f06ccdee428e2cd3bd02712a2e6a98a6612a388032adc63d1e20e47e42520f9a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/__main__.cpython-312.pyc",
          "bytes": 771,
          "sha256": "8f831b3b9c9a5b10ca83ecc508e74844f069e4c8b47015fa1e69381ffa05eb74"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/console.cpython-312.pyc",
          "bytes": 2665,
          "sha256": "2c466e1a548204d15a2e051755a49e6c5fc98dfef60eeaf69724bf1a750e1bac"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/filter.cpython-312.pyc",
          "bytes": 3243,
          "sha256": "bf62b061a31dbebaf80da5475876972cf72e90e060ee3d50578fb3f9b8150972"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/formatter.cpython-312.pyc",
          "bytes": 4757,
          "sha256": "f85655f033ef1348f9edd78b710379afb2f7fdc0b7ec156a38d6e4ca00572222"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/lexer.cpython-312.pyc",
          "bytes": 38468,
          "sha256": "8fb16398b16673f9da91bb06ee433e08cf70bbe0ece4552eafa47c28921f615f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/modeline.cpython-312.pyc",
          "bytes": 1581,
          "sha256": "3ab228a4a4477b9a7db40dcf07aabdf36b6170e870de7848f30479d2870d27ca"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/plugin.cpython-312.pyc",
          "bytes": 2708,
          "sha256": "939cb30575fdb339e3b6dc9c84bb8cb2aac4073299f6c12b9247828ebce04de3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/regexopt.cpython-312.pyc",
          "bytes": 4469,
          "sha256": "33944dc9ee95049eb3ac28384ddc684aee371b78641aa79e17112d0cb2979b9a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/scanner.cpython-312.pyc",
          "bytes": 4793,
          "sha256": "13d63d8fe4119ff92b6ccdc5569cdcfaece2daeb8f2d993f64b17f7ae76a39b9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/sphinxext.cpython-312.pyc",
          "bytes": 12135,
          "sha256": "4f229a71c9f3cbebb31c71a32886dc84f431f39001b68bc81e239e33d088364e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/style.cpython-312.pyc",
          "bytes": 6715,
          "sha256": "0f6bcc47f2a6cde9fe637f81b0734ac38e91ec82ca767388a2413eea63d46994"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/token.cpython-312.pyc",
          "bytes": 8211,
          "sha256": "aba06e98aa248c67bb1ad3c6a802e7547eff3c48dd084c23fcd56cdb54eaa2c1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/unistring.cpython-312.pyc",
          "bytes": 33009,
          "sha256": "c5d357632a2f39ca5d80cdbcfe9281fb18394a7a1dd4ba83ca270d3c330c886f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/__pycache__/util.cpython-312.pyc",
          "bytes": 14096,
          "sha256": "f7544a73c864dd7466e06189b4d108380bed5ab797d409ceb2cb22386767ba5a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/console.py",
          "bytes": 1721,
          "sha256": "0b5f3d240c210b5421d002a0b21cdbd70543cc5a819efd55678e644c40c83b7d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/filter.py",
          "bytes": 1913,
          "sha256": "d5d9db92ad80742dc0907b770da5f09ce91304b0a1975911ea76922f09ebfed7"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/filters/__init__.py",
          "bytes": 40397,
          "sha256": "3eb77ac542bfee4c34ad0bff3973d8dfcef5473c2d58a1a9fe0ed275d6070578"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/filters/__pycache__/__init__.cpython-312.pyc",
          "bytes": 37935,
          "sha256": "f601cd2246f21d5e22e1ecd4db4a540c645d6c368fe9d6d4847801816980382d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/formatter.py",
          "bytes": 4393,
          "sha256": "12e0173d7e9cdd74240adde50f456148f4990721bb61093c1eb0b0c657fe0994"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/formatters/__init__.py",
          "bytes": 5388,
          "sha256": "1182c30888011cbfc392e84d4506651e94b6fd4139f8c7ec18bd6131c39af79c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/formatters/__pycache__/__init__.cpython-312.pyc",
          "bytes": 6939,
          "sha256": "7ee93e7d78fa4512d3dcc6789c7375b6f671a48b3fa0ac237bb6dee8b9a701f7"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/formatters/__pycache__/_mapping.cpython-312.pyc",
          "bytes": 4249,
          "sha256": "6d0cdce3b82228ea8448e6175051cdecf28c11b38601eebb7df2254ef4375ae3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/formatters/_mapping.py",
          "bytes": 4176,
          "sha256": "d42c37ec5b9094d69c9f144a9ad94f5f89f22e85fdfedb64a39670b1c354659e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexer.py",
          "bytes": 35394,
          "sha256": "c125c3cedd9f359252ae57dd21f9ca56585e469164b3390f9a0c0125ebdb04da"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexers/__init__.py",
          "bytes": 12118,
          "sha256": "b3c23fb55968b6b33c7054c69678f0e39518e6c8f98e10f0750cce3a387380d8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 14643,
          "sha256": "68e7b7decb5765fd16064e4714a386ae76ab08b82902e6e3ff74a89d9f22dd72"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexers/__pycache__/_mapping.cpython-312.pyc",
          "bytes": 70149,
          "sha256": "78f9db1fbea6562541ca9ef437de35b2cc3a4443eee34b74740d3a9a7510c276"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexers/__pycache__/python.cpython-312.pyc",
          "bytes": 43354,
          "sha256": "be4e01a36a0a467f44ddd8798dc41b14f8669cf202b95f7acdcfedadad6b9476"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexers/_mapping.py",
          "bytes": 77934,
          "sha256": "c060188ce069ac3559034d5ea1cc1c2c9e8bf1b88cf6b3f68f1c2bd5b409f7a3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/lexers/python.py",
          "bytes": 54250,
          "sha256": "4eac9f40e3e10983f1df96a940beb90808fd93ee01c6eccbabc3037dd9b68ef1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/LICENSE",
          "bytes": 1331,
          "sha256": "a9d66f1d526df02e29dce73436d34e56e8632f46c275bbdffc70569e882f9f17"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/modeline.py",
          "bytes": 1008,
          "sha256": "99ef20e6bc9289dbcfb4c04eac3cb63b5b0ca99774da5047318e4a0d979f530b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/plugin.py",
          "bytes": 1928,
          "sha256": "3facc8c3ebe4490d24d56287af36c14e3a7094264f6d1fba41efdd3bd06376ed"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/regexopt.py",
          "bytes": 3308,
          "sha256": "776853bdace5a30e73cd920e0959df7841b6098d06ad8fe2807d6409249fee8c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/scanner.py",
          "bytes": 3095,
          "sha256": "0eda0b8b5a4e2a936efba8e26a42694902d48bf7a9dbd490421bfba00c1858c1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/sphinxext.py",
          "bytes": 7984,
          "sha256": "45f9699df5c1e2b64b63267e390fe2827b553a507c8c6e36c456201152321dff"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/style.py",
          "bytes": 6423,
          "sha256": "c094973978de84663123a7b70c6694b4e35e5ae8664dfb307e4cacacbf566acd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/styles/__init__.py",
          "bytes": 2045,
          "sha256": "91874218af2067557cc1f1501133b3a4f9994c9d67301d1bd6236553c74743d1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/styles/__pycache__/__init__.cpython-312.pyc",
          "bytes": 2686,
          "sha256": "0e29778e50353bd07b72889d45a56ca422a856156f34704fb866c8ee24d64808"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/styles/__pycache__/_mapping.cpython-312.pyc",
          "bytes": 3667,
          "sha256": "8424b6b963b282ed1d695f5ecd12c12607ee093cd48b50a28ebff4d6b4ed3565"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/styles/_mapping.py",
          "bytes": 3312,
          "sha256": "ea5a2f154136f6dcfa12c5775d8638860a3327bab524bedc7cedd43a58274bcc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/token.py",
          "bytes": 6229,
          "sha256": "0d58a5e53da5b479138104d4632d5d32d8328a08dabc2b35ca913841fd82ac6a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/unistring.py",
          "bytes": 63211,
          "sha256": "678c381df395521b9e09445191f840a90d9bfbaf54ce4858e31b877af604cb98"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pygments/util.py",
          "bytes": 10046,
          "sha256": "ce4f77e6d252a70480f73c4d995d53ba17043f431f6e85e24594864272cf12a9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/__init__.py",
          "bytes": 691,
          "sha256": "70f07f6bd2d7cf9c6fb116d7d68daac807632dab5925d43f2dce4c70d5fe5fb6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/__pycache__/__init__.cpython-312.pyc",
          "bytes": 766,
          "sha256": "63f2718022f2519e190c850489da021e22b4f7cfe48431f7e795ab033cb5da0c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/__pycache__/_impl.cpython-312.pyc",
          "bytes": 18065,
          "sha256": "c9a7f827adabe91aa7055e786399453ed60bf32150c5a3e5e741e93688279cd4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/_impl.py",
          "bytes": 14936,
          "sha256": "8d8fab6b19e6c91c81e7baee022b6b25153311ec6e021193a6033282ac7aed9e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/_in_process/__init__.py",
          "bytes": 557,
          "sha256": "30934fa5f23170ef85821c6905bc641b5ac58907fa1ce51b5785399aad07167b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/_in_process/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1095,
          "sha256": "86f1ab8ca105f2191a860205fe971cdcdf62054fb067f695a96f95ab773ba985"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/_in_process/__pycache__/_in_process.cpython-312.pyc",
          "bytes": 15348,
          "sha256": "ee3b67ccfc6a05ff3a412d4883795e9ae51884e99d0522c730e4cfb2dbf65c20"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/_in_process/_in_process.py",
          "bytes": 12216,
          "sha256": "a9c5cc866c7ffcc209ab5d201875b7980e1397c772f18cc731c7309cda0a970d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/LICENSE",
          "bytes": 1081,
          "sha256": "1b22b049b5267d6dfc23a67bf4a84d8ec04b9fdfb1a51d360e42b4342c8b4154"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/pyproject_hooks/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/README.rst",
          "bytes": 9222,
          "sha256": "b7b2229e36a2bb0521f35d9799502940725bf294f0df753c03d511ab2e86945e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__init__.py",
          "bytes": 5873,
          "sha256": "9c2d9ab6d17076860dfa813afaf416e1c8aebc8bbb2763ff4d4d6a4360dcb9e1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/__init__.cpython-312.pyc",
          "bytes": 5633,
          "sha256": "1d7f60e5a42548ad97442a1871c96f4782c94b4f6658789554744b6c54832361"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/__version__.cpython-312.pyc",
          "bytes": 603,
          "sha256": "d0d51a9eb4dd45fc32cb5cf52037129b8e6b1c70f316ef4edeacb463a5324cb4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/_internal_utils.cpython-312.pyc",
          "bytes": 2147,
          "sha256": "0f508a6f8b869886e71e5a22ffbb97c9fc496b4c3156f76de82a10b4054f6a6a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/_types.cpython-312.pyc",
          "bytes": 7285,
          "sha256": "696f1b85bf81ea7faa3b0129e12be7f2b2d802b854046ba964c8c8dc50e404d9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/adapters.cpython-312.pyc",
          "bytes": 29714,
          "sha256": "b6603901e230c52a15edbf2edc38f4139856fd9bfbe8ee087e883b1c33461f62"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/api.cpython-312.pyc",
          "bytes": 8065,
          "sha256": "1182866dbcc2f00a88d9ca8a136e57cd055f67976d74e4e3a2b6f681126969af"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/auth.cpython-312.pyc",
          "bytes": 15805,
          "sha256": "104c77199317534a420c960487b36b24cbaafe6199fbfb93a65d39a9c84cfb36"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/certs.cpython-312.pyc",
          "bytes": 697,
          "sha256": "5b95d2e9a025c0fdc22719062a835dbe676699c9fc14424d6bc10cb9ecc78c02"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/compat.cpython-312.pyc",
          "bytes": 2069,
          "sha256": "ca2e3d565e9b758a73e130d65267605954e0fb9e72b1ea48fda2aa46645a4034"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/cookies.cpython-312.pyc",
          "bytes": 28384,
          "sha256": "f6d0cf96df79712d534d379ddf0591e76de5b47d7011e2211805a92051ec680f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 7983,
          "sha256": "ed29e5333970fd54d5313518114e9d4f97b556a2db051d1c949306ee660a3b93"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/help.cpython-312.pyc",
          "bytes": 4253,
          "sha256": "cae3dc47ee71db2f22ee545366a23014962f51ea261c18fc7096e761b97bde9a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/hooks.cpython-312.pyc",
          "bytes": 1604,
          "sha256": "8b53156a83875644b49619a140b0bc2998db0942fbbdc92660230056f77389ab"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/models.cpython-312.pyc",
          "bytes": 42001,
          "sha256": "afa82981df5d171b14853818cfe672c59b6f3c60f7ccf576d6c48d0c654a1129"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/packages.cpython-312.pyc",
          "bytes": 1285,
          "sha256": "41456b773e0d730da277034a9ca753d42db8462da6281a4fb66cabed4310e29d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/sessions.cpython-312.pyc",
          "bytes": 31927,
          "sha256": "a659e55a0765f90244168c329854dcef8c81f8708d5b6fc46949e136cf0cef0f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/status_codes.cpython-312.pyc",
          "bytes": 6159,
          "sha256": "8268b32f55848ce69b7bbe8f959fda8057ed5e2c45d5ae0f7cf7b8ea5b05feb4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/structures.cpython-312.pyc",
          "bytes": 7304,
          "sha256": "c2833d892f66d5bf1ef802ae00fdec3076376e24e317332d2471393b7f543859"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__pycache__/utils.cpython-312.pyc",
          "bytes": 40060,
          "sha256": "1e2b4f3a05ede5e518d5f84558ab288817b0efd390fa9b18900cf37c20da17d0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/__version__.py",
          "bytes": 435,
          "sha256": "abba90670b0370a3dc40d97c2dea46a35d4bec941ff10d7c3cf3098ef04a17f9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/_internal_utils.py",
          "bytes": 1542,
          "sha256": "4c7d8d132c9898fc7d715e473f3ac74785ddc4ab96d2c9240f87835dc6d981ff"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/_types.py",
          "bytes": 5838,
          "sha256": "d06df79f54a279c0cc3faec596c446246d5ad14edfd529eb328defbd62a44a89"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/adapters.py",
          "bytes": 28208,
          "sha256": "e6448a857949b91fde9eb3a3777921486a51063d56a82874f10b2cbb408467c3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/api.py",
          "bytes": 7152,
          "sha256": "4d15480ac046f089209798e8650476ef4a28ebe6f81b400758f8ef42ec6b5509"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/auth.py",
          "bytes": 12233,
          "sha256": "e93951a552d4c3c5fd9b84a5e1d49b03caaba4723c4ff112da6053600ec85a65"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/certs.py",
          "bytes": 442,
          "sha256": "783d46d11a0c677900d25c9d930ee8a3496670aaaf0f5861cfac8e96048a9bcc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/compat.py",
          "bytes": 2035,
          "sha256": "d5485e146a2671e59eedacac81ba185b1704387fc7a501662a12323e201a9e88"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/cookies.py",
          "bytes": 21549,
          "sha256": "0a1ce6140f2b9420522c5080e356e689fa796c2522f55ca10826f5ed8e0a723c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/exceptions.py",
          "bytes": 4576,
          "sha256": "026eb2e27728069b6999eb0e8d1c5ce628ae043623c7750dd684550653604721"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/help.py",
          "bytes": 4114,
          "sha256": "4d559e8e40913b029ec471c1e38282652afe734a395da90d2fb2d3d54265472f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/hooks.py",
          "bytes": 1138,
          "sha256": "ebd8a02475d31a0e473a8f553e9501ff43645b9563885ad52844e7a63f0d76ab"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/LICENSE",
          "bytes": 10142,
          "sha256": "09e8a9bcec8067104652c168685ab0931e7868f9c8284b66f5ae6edae5f1130b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/models.py",
          "bytes": 41848,
          "sha256": "f7d77b585e29477e4d1e8f63adb1a2068719dcb08cb25a155340c0710e3dc774"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/packages.py",
          "bytes": 1057,
          "sha256": "fd94030894c9f123f79155ae9d2a81b1164d3f38f673558556a6ddaf4f29cf75"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/sessions.py",
          "bytes": 34248,
          "sha256": "96fbb30bbbf06a59a5268d13b57885149756aa3f31695b5c15e41dd7bb2f67a6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/status_codes.py",
          "bytes": 4351,
          "sha256": "1950f47c89cf18019787e07d8ce48f66d6b38e622f7d94d70a90247fee6c040e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/structures.py",
          "bytes": 4134,
          "sha256": "ba9460c39078f25e6f1d2a24ac941ac6f8d2ee97197fa8c8d0c262d8a1e67a02"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/requests/utils.py",
          "bytes": 36334,
          "sha256": "bbb3080b2cd04ef7d46b76ac83d9c1bdcae785220f11ceaa8494b18861b04ce9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/__init__.py",
          "bytes": 541,
          "sha256": "ca85fe778493bf01860a24111397090bd0ad7abebd4a0560a82971382bd23fb3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 653,
          "sha256": "54828993a94017eb59a7ed99ca3860151ac6758223121b88d305e9edd18ad148"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/__pycache__/providers.cpython-312.pyc",
          "bytes": 10144,
          "sha256": "29b027b191a9fde7016f9e31cd8247d37c0d6ea8c7822a5a2d0840795f6e3290"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/__pycache__/reporters.cpython-312.pyc",
          "bytes": 3308,
          "sha256": "3e92908c31fca301a19f11ad8948390569f5dcb684a781f55943e60b2baa905e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/__pycache__/structs.cpython-312.pyc",
          "bytes": 12463,
          "sha256": "4070ac81e4ad516ef3580e1f0b09e9d44862bf5ef5612d678318cbe7ae941aef"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/LICENSE",
          "bytes": 751,
          "sha256": "f388fd38cad13112c1dc0f669bbe80e7f84541edbafb72f3030d2ca7642c3c9d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/providers.py",
          "bytes": 8914,
          "sha256": "a485896c874927d185b4d6edc131f421ae37563ea16021098f60ce2ee7b5e453"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/reporters.py",
          "bytes": 2037,
          "sha256": "a4d25fe271712e901e2b1941522d86123d1ad888f59e2918d1469b4ca5deb13e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/__init__.py",
          "bytes": 640,
          "sha256": "ef6f0cdc4be69cf6d55d2ec4c5796fda432ee9bef012ca0fbad11f97eb9593f2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 758,
          "sha256": "e89b281f59d36396c55d2c09e5c9b6d771156dc22e7d090640593299bc73572d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/abstract.cpython-312.pyc",
          "bytes": 2464,
          "sha256": "f50b87f3041a607eb18b536541e5cf1605742a1366da7977c22bed9924d5778c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/criterion.cpython-312.pyc",
          "bytes": 3295,
          "sha256": "7792241d40f0b943ff2c7e7f27410f5923a54a152a76961a2a7c12135a7467c0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 4102,
          "sha256": "9ab4ac0d0eeca0ed1a2ab66c4e6ddf6c57ed8140acddd4e27dbce03abc692bcd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/resolution.cpython-312.pyc",
          "bytes": 25164,
          "sha256": "3050d8457912b9f182d3a0a80b4693e82bd786a6d3ef34e6e0455af219a0d58d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/abstract.py",
          "bytes": 1543,
          "sha256": "08d7903e7a40b9d63bee79b33a438d4a6020465cc87f4e97f97f66bd160e0e6b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/criterion.py",
          "bytes": 1768,
          "sha256": "95c9991afe6c2873a7143fd1cd9c2f9464a3d7d31e03ee6b08ca5d7f64a0c3b6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/exceptions.py",
          "bytes": 1768,
          "sha256": "967fe3690b602e545448563adbbca21c6da00fb020697cd129a12515587b7c34"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/resolvers/resolution.py",
          "bytes": 24212,
          "sha256": "dc9ff3916fac0f7118f8194d5e3ca59fffe78e9c87e67d146494fab95ec285e0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/resolvelib/structs.py",
          "bytes": 6420,
          "sha256": "a6ef84262476201213af649078d3d16b4ad7863952b5f98efc6120021af7d34e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__init__.py",
          "bytes": 6090,
          "sha256": "751c6320bf926c5558d2adc88d232b7e00531eb9b52d90e02ceca0541c226197"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__main__.py",
          "bytes": 7896,
          "sha256": "7bf6950beb43cdaad6416f52b9932e0a006be8e0d5fe20cd5765a1db19313a5c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/__init__.cpython-312.pyc",
          "bytes": 7034,
          "sha256": "0c7094b760f3bf8ebef13dad920e40d7e69c82afa8e564297963746312349f6a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/__main__.cpython-312.pyc",
          "bytes": 9572,
          "sha256": "8923a8390c840676ed88e6f61fac19f481d13a0a97f92c8dcabe5e0ed8aa2562"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_cell_widths.cpython-312.pyc",
          "bytes": 7891,
          "sha256": "1ef53cb9d57b6a2a492fb2b9d7fb07a8b8ffb46d52ae5f42fc3aa4e845ef1acc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_emoji_codes.cpython-312.pyc",
          "bytes": 205995,
          "sha256": "3d1a14ce877042f22f5dda86b29c46f826072eb4f4ac00f917a68a082d9a428d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_emoji_replace.cpython-312.pyc",
          "bytes": 1748,
          "sha256": "929a58ee0d3e40a01b084805037774792eeabd8eab44195e548390c82eb2f09f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_export_format.cpython-312.pyc",
          "bytes": 2368,
          "sha256": "cc51b50995fe59b1fb10e52ab3ed846378985905d051a643fe13cd97e755f17b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_extension.cpython-312.pyc",
          "bytes": 556,
          "sha256": "89784cdc4729b8fd4e81f14d235913ed87d9fd180562839d05e1a9630931b035"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_fileno.cpython-312.pyc",
          "bytes": 874,
          "sha256": "5589e9d9b8535594ae4bdeeb8a8f6b1b1865bbc901da6d7dcea37d81321187a0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_inspect.cpython-312.pyc",
          "bytes": 12057,
          "sha256": "a260b38c28b96ec276e6018ae6440f3acd2fe4bfbc1d64259f46002454de8fc5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_log_render.cpython-312.pyc",
          "bytes": 4166,
          "sha256": "d542e1466375fcdd82716b1d5c592a0f1e3e12875b85721d0fa0ed93dbe555d8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_loop.cpython-312.pyc",
          "bytes": 1889,
          "sha256": "114077aa5a8daae017da7e9589a44c9fdc0a1fe1d8f080a34e255e177f9ea63b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_null_file.cpython-312.pyc",
          "bytes": 3648,
          "sha256": "795c7a91b4d443a79afe0fc009e3b99bf41c3549090dc4643e2f723d3a5c29b4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_palettes.cpython-312.pyc",
          "bytes": 5179,
          "sha256": "37f279aebd2be1ef5677a57dc925eaa9f17aeecaeb08dd812d32994d99ec6464"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_pick.cpython-312.pyc",
          "bytes": 740,
          "sha256": "9bb5c70eeec3de3d2dd6120df12d2ad2988bdfffa75cb34d0e067560cef6b03d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_ratio.cpython-312.pyc",
          "bytes": 6442,
          "sha256": "9adeed38158843230ddec0c346d70209735b7784ea8596af8cbad78b7bdeff9e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_spinners.cpython-312.pyc",
          "bytes": 13198,
          "sha256": "2001f8efa8e67f5bcab85a10c8c37a0171b4e47e5ceb0eaf6f2dd55e28c08762"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_stack.cpython-312.pyc",
          "bytes": 999,
          "sha256": "33be49e8218cb7b0ef5df8c53b602283f1b772abe2d2b23ab9b795e8f9a8cc2e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_timer.cpython-312.pyc",
          "bytes": 899,
          "sha256": "f07bb4fbffa00739d37215975ddad4ae18fd06cd8081ac03910d2b20510c2ddf"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_win32_console.cpython-312.pyc",
          "bytes": 28830,
          "sha256": "d7dbbbe5fc29a60ce2d14dc0ea3e6ce9c21c1e9a4367c64d8fdca9a38aea6bca"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_windows_renderer.cpython-312.pyc",
          "bytes": 3582,
          "sha256": "6f0a02284248ad084172dd87bdd50432338985df54ba832d75122105bd5441e0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_windows.cpython-312.pyc",
          "bytes": 2509,
          "sha256": "77df2b10b4d1f5f48a0f2e1822a47a40e383a0aa849b59f039698ff0d84bcb22"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/_wrap.cpython-312.pyc",
          "bytes": 3345,
          "sha256": "79b718343182f5aaa949411675d3b084ca00af4cd2a180b8c639d17d2c92b18c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/abc.cpython-312.pyc",
          "bytes": 1627,
          "sha256": "b959d2475ad430d65d3d4df2b4b24b1fcebff38e3fb3c422f67383530311670c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/align.cpython-312.pyc",
          "bytes": 12263,
          "sha256": "da67f81d2acb640b1cf74c75fbb7558f2b5a4eb479ad328ccacfa5fdad2b3f39"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/ansi.cpython-312.pyc",
          "bytes": 9100,
          "sha256": "3cdd6e3dd0814b8f5f4cea7b85f6b52d116fecd7250156720becd0bd32830389"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/bar.cpython-312.pyc",
          "bytes": 4306,
          "sha256": "7269092d463e018f62e0f1b5dc1e848c7ad10fa1fe328915cfed459276ba2b8d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/box.cpython-312.pyc",
          "bytes": 11710,
          "sha256": "81bf39998045675f05e74783edc956196f96106b0da10c912a9fc76dee9a223d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/cells.cpython-312.pyc",
          "bytes": 5579,
          "sha256": "c98d5f953b2c321dde28a2aa8e5cad5b4fe6c5ada103847df99fbd905ce76b9b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/color_triplet.cpython-312.pyc",
          "bytes": 1720,
          "sha256": "a33c3c78dac13c6b3a22dca629a26b61750e2600cff0f0c0283e6849d03c04bb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/color.cpython-312.pyc",
          "bytes": 26571,
          "sha256": "104756146a98af6eb76b226b37c0524baccf2288c0d7cf054b0a19a5699e4981"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/columns.cpython-312.pyc",
          "bytes": 8603,
          "sha256": "18ec5c8b4ccd908dde88412352baae6cff33842d26e059b3ef95d5958f40d41f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/console.cpython-312.pyc",
          "bytes": 115061,
          "sha256": "7756f451e2035dba24164983aee2f0b0f41079465a4ed3926474a68cf0c55e32"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/constrain.cpython-312.pyc",
          "bytes": 2277,
          "sha256": "bf95a3697417bf32be53168c00683a88e007c8a8c8c86a337dbd56c48933ceb2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/containers.cpython-312.pyc",
          "bytes": 9229,
          "sha256": "af3d44b38931261b41dc89c91ef4b187da4245229d97de2584faf7a180e6a3f2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/control.cpython-312.pyc",
          "bytes": 10815,
          "sha256": "4de7fe092899ab5976ca13864537e1a51dae4d59cb581353ec5bc05634355f98"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/default_styles.cpython-312.pyc",
          "bytes": 10540,
          "sha256": "20dcbab2f34f80ee5431d4389922cd51ab48548414bc2d89e9746bc0490c30b3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/diagnose.cpython-312.pyc",
          "bytes": 1555,
          "sha256": "6cf158ebf342642dc459826d45c3cdd31ff3f9f006d1f3d025c46ce252a78ac2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/emoji.cpython-312.pyc",
          "bytes": 4100,
          "sha256": "15aad6eadaea2fb6428d39e6c240ca5e770d62a9adf3dcb49c683e5cc8b2b434"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/errors.cpython-312.pyc",
          "bytes": 1864,
          "sha256": "12ffd02b75ba8dfa33cfecfc18390c58d15ba2b3c02d25c353f1a12e17a51c59"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/file_proxy.cpython-312.pyc",
          "bytes": 3590,
          "sha256": "c1b618b844e90123b04ecc18f06d2c9822869e9681e14146aaf7c5c49d418823"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/filesize.cpython-312.pyc",
          "bytes": 3066,
          "sha256": "d573aa5ac05694a9cb78a03d5c9ec6cbf0272e90ebb2b47227334e9ad968b3da"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/highlighter.cpython-312.pyc",
          "bytes": 9907,
          "sha256": "77c480eb8c7abb5ebe77a3d2c37efcd6a6b5e5fe647f0b3401d168f0f343fc15"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/json.cpython-312.pyc",
          "bytes": 6069,
          "sha256": "d63ae8551313b87c4bb98a872a4feb4d4e6ebd562d6e8686cde410a2098fac98"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/jupyter.cpython-312.pyc",
          "bytes": 5227,
          "sha256": "5f302c6f870fde6f40a84cdd2869ae5b03f0e1e87233929888e6a3bca2a085aa"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/layout.cpython-312.pyc",
          "bytes": 20192,
          "sha256": "a3f495bc24e45dae1e39bd0f5dadbd28adfaff7956ed3aa2bf2de7e463a0cf5f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/live_render.cpython-312.pyc",
          "bytes": 4764,
          "sha256": "2c0371e95bcef99b7f5e4e0b59ddb415f9e3a61e271aaa6a207530d68c0aff0b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/live.cpython-312.pyc",
          "bytes": 20012,
          "sha256": "71b835e78d9b437170a340ecea6e3f3dc2c8a4ae79a11714ce981b9a21b9be2b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/logging.cpython-312.pyc",
          "bytes": 14093,
          "sha256": "dc4e31867b9eba312f5a10c0f61fc200013613d6a76a4653b44a97087e1d9c3d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/markup.cpython-312.pyc",
          "bytes": 9586,
          "sha256": "ba1d42fff09d8e96432dc587f105be2dad4b5f3605e04c5043ed7046907c4b8f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/measure.cpython-312.pyc",
          "bytes": 6397,
          "sha256": "7e7e790b6f7236308d9ea012c445233b43e9e0380db6c9168dfd732d924c5567"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/padding.cpython-312.pyc",
          "bytes": 6952,
          "sha256": "f40cd43542f3d4e7b188acedb0cdc7f276a4a4be240996d2419a8cabef877caf"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/pager.cpython-312.pyc",
          "bytes": 1830,
          "sha256": "9f04f193df28b787852f04660910d3a59211f006097b01a539deec0eda86b6b3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/palette.cpython-312.pyc",
          "bytes": 5316,
          "sha256": "d65796dddec416e0fe532f8b3f1bee367790cdcd36a3f34ef8389dfeae0ef4fb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/panel.cpython-312.pyc",
          "bytes": 12743,
          "sha256": "73bb776148cc19f852a52287903435742a8afa93a6b6dc4ff38d3a4717408a65"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/pretty.cpython-312.pyc",
          "bytes": 40630,
          "sha256": "ccc02a595c5877f1ec742eccc83e64b96a1a5e5d640636ae98b4b27c854983e4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/progress_bar.cpython-312.pyc",
          "bytes": 10396,
          "sha256": "66a2ed528f7c3d13b056b758aa201f80cb22c40a9aac0241a93097f3be6a5aa9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/progress.cpython-312.pyc",
          "bytes": 74958,
          "sha256": "c30ffce7b09b8ae118ab7e2046d897e4303fec510da5e0108254161d9c24b70e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/prompt.cpython-312.pyc",
          "bytes": 16039,
          "sha256": "df6ba14f0285757c2f42e586b95e7d7c041c18851d37e5460a3aa5f519066097"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/protocol.cpython-312.pyc",
          "bytes": 1811,
          "sha256": "ec2c69f8fb7d64d8c0c2da48d32315f1d5c0577d56cf8f3d25569af8980b8182"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/region.cpython-312.pyc",
          "bytes": 586,
          "sha256": "cf66e9a2cd324994e4998e0599be8c4c0e554b3e093ec5dc4ed79dc31a82f811"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/repr.cpython-312.pyc",
          "bytes": 6632,
          "sha256": "c488dd6e01b751d490ec8bfa192a04af7924e18dcdb73411b3f635397c010f4e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/rule.cpython-312.pyc",
          "bytes": 6602,
          "sha256": "b4ebcc6139016afe51de627f7df874bf4d63621dd1ca1e5a0c506e22d498cbd4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/scope.cpython-312.pyc",
          "bytes": 3844,
          "sha256": "bf6398cbda6f68f97f76790d70fa34d0109caac1b03800bdc23bb2ceb8984357"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/screen.cpython-312.pyc",
          "bytes": 2498,
          "sha256": "370b0f4f85b823bd9e3f4f15b92c99f50bc08d6b38275e3b251ab34a46029735"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/segment.cpython-312.pyc",
          "bytes": 28556,
          "sha256": "5fc9d6b281324339f2fb5873100e5b54c8ab5bd9a9a0c66caa1b8095b7c1dbc8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/spinner.cpython-312.pyc",
          "bytes": 5942,
          "sha256": "e78a4396bfb6d96153e83e263e40d8b2b3c5052079426057cdf2fad215c6b3c1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/status.cpython-312.pyc",
          "bytes": 6095,
          "sha256": "588205755e4063f2bbee45c3dedf5bea0a5e5d5f2d39c39332f379afd4184b34"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/style.cpython-312.pyc",
          "bytes": 33436,
          "sha256": "0f741b2e8498b5eea0977a602d5ecf5b19fa3e7f042ad644a32d95133adbc9dc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/styled.cpython-312.pyc",
          "bytes": 2158,
          "sha256": "eeafb6b580dd5e472f3d88ebb01662693572474001ba72e22c3ddf6eacca22b1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/syntax.cpython-312.pyc",
          "bytes": 40982,
          "sha256": "94aade0ce8f1140242beed87d38f5d27903316cfec3607c33e1a50f7e5702347"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/table.cpython-312.pyc",
          "bytes": 43856,
          "sha256": "27ae2773d48782f73887a3ba30027cb58374355167dbf1b44aaafd35e4e8f4c8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/terminal_theme.cpython-312.pyc",
          "bytes": 3367,
          "sha256": "7a23bfacdfe9d5244ce0817cff6fc616b1cc609ec7c24f4e97da0f01110dd555"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/text.cpython-312.pyc",
          "bytes": 61229,
          "sha256": "fdf5d9fce49d15b7b213b96708a18b883774de36036d1b2a0aabba831d51a851"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/theme.cpython-312.pyc",
          "bytes": 6346,
          "sha256": "e953ed234464ed8961464d3c043111763534edd625288e16eca43f4ce23ee8e5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/themes.cpython-312.pyc",
          "bytes": 333,
          "sha256": "c2f251f6d2a211acabed5d7198c99d2ada1c3fab5f8b6e2276ab540250421c3a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/traceback.cpython-312.pyc",
          "bytes": 36192,
          "sha256": "448cf904f730efdc54e10c9835b4e373f3fc1e33e45335cb851cab090cf4a346"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/__pycache__/tree.cpython-312.pyc",
          "bytes": 11827,
          "sha256": "f1ccfaf5d3c61f947697347ad65b8b3af6de10c4c5f31ff2043d73901d6b1e18"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_cell_widths.py",
          "bytes": 10209,
          "sha256": "7db99ec9eb447478f313f571da5d6e2bbb673ce84cb365f59497cedefb0a0e90"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_emoji_codes.py",
          "bytes": 140235,
          "sha256": "86ed552fd9db55da6926b5688a356c85195c4517bfbf7763bb7326776b0a65d6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_emoji_replace.py",
          "bytes": 1064,
          "sha256": "9fe91c7adb04531d99526850adf78c35cfad79e1a1a6e490e45f153c1b32bc3a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_export_format.py",
          "bytes": 2128,
          "sha256": "448d3ca52ae6e6d052ccf32f9db4ea6c3f5621a95a3a837977833545398bab56"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_extension.py",
          "bytes": 265,
          "sha256": "5ede3b41a7022b062bbb38c38be80e06aef6e0945e0e3f429bdc548b97ebfb7e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_fileno.py",
          "bytes": 799,
          "sha256": "1d66713f90b66a331b1ebcaf01066c79f9557d0a06cec28e1f3286b0b0fcca74"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_inspect.py",
          "bytes": 9656,
          "sha256": "44e4f43cb0b618c5a26a559992a2488e662aec83518a34109284a89164da0222"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_log_render.py",
          "bytes": 3225,
          "sha256": "d41c88d0f035669c5963708624e2b9e218e5ab85fe073fdba088c8a8277c2a7b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_loop.py",
          "bytes": 1236,
          "sha256": "855ffa08b7683e6d2f6b6d96a70e332aa334458b33dd36715e3d0fa12fbd7834"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_null_file.py",
          "bytes": 1394,
          "sha256": "00318aa75cadfa4ef414c295ead9ea0aa79c07ead2273a7e590b03ecb3cbfa48"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_palettes.py",
          "bytes": 7063,
          "sha256": "71d7afd4940a67426f960b95f62a478339d3767be52335050c16f422dd8fce32"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_pick.py",
          "bytes": 423,
          "sha256": "7af0edf10378945e428b0ad421794e2429ed8ad0423ac23764b3c42005512c95"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_ratio.py",
          "bytes": 5325,
          "sha256": "20eb65efcb1009866c987cb185ee3992b91bebcbbdc55cfbcc5b175490fe6f66"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_spinners.py",
          "bytes": 19919,
          "sha256": "536af5fe0ff5cd28ec8e251d00449cda200c7378b8ae2fd2f0f60fea4439cf52"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_stack.py",
          "bytes": 351,
          "sha256": "f82f0e2bbaf19f7b0851d570c59041a5e1e12335f4788f9533731e9987da5e6d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_timer.py",
          "bytes": 417,
          "sha256": "cde9716d3ea83c566736bc163e973592d51e013f957387ee15c4592d018bb4c2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_win32_console.py",
          "bytes": 22755,
          "sha256": "05268344833004b2139ff9b499344b3ea304e6afaab8675232e60ca587982707"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_windows_renderer.py",
          "bytes": 2783,
          "sha256": "b7be192f7c6e0c23f79e64e9f691f52f92e223671a909b9045095e1c225eae59"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_windows.py",
          "bytes": 1925,
          "sha256": "681c1a0ff4b9e926e0a2922f6b2566a64d18dbcbb06360b905a6f5c25dc1a7e2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/_wrap.py",
          "bytes": 3404,
          "sha256": "1654aca26e445f42d5900dca5b2df8c879c27cbb6a5fe6487a95ca87eef4ae97"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/abc.py",
          "bytes": 890,
          "sha256": "38df84f99a924a1799f3c56b297d8cdcf5e915b18451464f31afc07f497ee1fd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/align.py",
          "bytes": 10324,
          "sha256": "760fbbb98d2e90c2cb95412c04344bbdadb6fec4202090f804ad1d9991c51ee8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/ansi.py",
          "bytes": 6921,
          "sha256": "02fb352c76d275cc8ebc339da442d952850b7018987b063be9e341a7ab85061b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/bar.py",
          "bytes": 3263,
          "sha256": "95d6d51cecca24e9df95536ebf5c52ee0e9d2d7d84df03275e474f6e9cc94dcb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/box.py",
          "bytes": 10686,
          "sha256": "9266af05cfdd9fbdcbfe0ffcbf1592c18243daecc15ce5054ed24e7e96dccdc3"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/cells.py",
          "bytes": 5130,
          "sha256": "2ab4248f9f8b821082a492d23502320198e775ce1b9c4a8e1268b962e67d5026"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/color_triplet.py",
          "bytes": 1054,
          "sha256": "de585091d25bbd63e82c33be0276089805a626f579765818342559f7b39168de"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/color.py",
          "bytes": 18211,
          "sha256": "dc74942d50e3eea4245d47455afefc24e8926737f2e72d6791c6219dadbde95d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/columns.py",
          "bytes": 7131,
          "sha256": "1d45f429c326f5db0a362d757d36e233f876883b65f3248269573195a944ceaf"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/console.py",
          "bytes": 100849,
          "sha256": "b7d6b366999131553972985505949284db26071776f880167134e5868afe135b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/constrain.py",
          "bytes": 1288,
          "sha256": "d5520fb82f0082d296adc9dc42b8c1758a80dc9556cacbba8d9a35aeb87b73b4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/containers.py",
          "bytes": 5502,
          "sha256": "73fe7a4f171e74662a0dea4704c4ee65d5088a38ad010827a31f9075ed19d6aa"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/control.py",
          "bytes": 6487,
          "sha256": "1144d25052d06f163a666a3fb1d33ee4bb37db7bc81d305f37c4cfba5a9e1d46"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/default_styles.py",
          "bytes": 8257,
          "sha256": "921405aaa6a80ecddba6b32a5a91f0f273b95291b60cde90b6e4dde8bcd9c187"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/diagnose.py",
          "bytes": 1025,
          "sha256": "7c99754c8b519f5f601b0a2ea9383ef333d45b762a401a8696dadf3d0b351fdc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/emoji.py",
          "bytes": 2367,
          "sha256": "59de1b42e6d9752cbaf8fcab45036e307b67d959258caf6e3d93d596ed9c9b1d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/errors.py",
          "bytes": 642,
          "sha256": "e693f729ce5de1027f734285b31adfca18e23d57bb275ccea9215b140cdc57e6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/file_proxy.py",
          "bytes": 1683,
          "sha256": "4e5f531cc0d9f8f9395a6f2c23580683f5390e1bac9b10fe159d1f51b714d16d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/filesize.py",
          "bytes": 2484,
          "sha256": "fe2cfd948a5182f5bb30d49e0999cb83e1f0cdb3f81844e0e78dd6a83f1216cd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/highlighter.py",
          "bytes": 9586,
          "sha256": "1bfb27fbc0ca8ccd6c1232c6fe8738a2f9169a25295af8fc6d78b4c9e7762e76"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/json.py",
          "bytes": 5031,
          "sha256": "bd512829d6b0a094630056b23f05e43013cbcbb4524ecf9fe38c124034769c9d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/jupyter.py",
          "bytes": 3252,
          "sha256": "432a0aa04ffc21d09baed8921e9f53b1348dc931d8d053b9c2113b8ce4ddf541"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/layout.py",
          "bytes": 14004,
          "sha256": "6a3912140b4456ff44153705b3ec38b997dfb7b9c45e13732fb655760ad3e6b2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/LICENSE",
          "bytes": 1056,
          "sha256": "deed7c17a4318158190a3ea239cc879a5a50271cebb98ae7025f48fbe58dca15"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/live_render.py",
          "bytes": 3521,
          "sha256": "22dff7f58773ac19bca372cbd24686a2b3c583e05f65601cac18cb8c5a246f1e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/live.py",
          "bytes": 15180,
          "sha256": "b45dee90000967f37665b19c96a67e8b02e822867c7f41c7533efd8c0c89aa3f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/logging.py",
          "bytes": 12468,
          "sha256": "e4a68f3d230ff45c5c5cf05c28ce1c19dff35bbf0f3207fe61b3159ef7d2c34a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/markup.py",
          "bytes": 8451,
          "sha256": "ddeb8628fe6ce353424306928d39c9c6eb398993078f1a483345ba7c2c6b6b7f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/measure.py",
          "bytes": 5305,
          "sha256": "1e6ac8257f2c5914c76e087c33111acbff37564a8d5bfef4b3c68a3f965c608f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/padding.py",
          "bytes": 4908,
          "sha256": "295108ded3b0a3db202b560d4ae1fffccd7f8d45a62d9c11555fca98eb55cf23"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/pager.py",
          "bytes": 828,
          "sha256": "48efc44c114a6e0de7fc080ecd79b8d52bf7e98c57032237fd1f8a398dbfb927"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/palette.py",
          "bytes": 3396,
          "sha256": "9489ef4753830d3d9fdd464c7cbd60aeaedd63fa4374a1f0e1b75480e19a3386"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/panel.py",
          "bytes": 11157,
          "sha256": "f6c425d3484f22a1f91b68002d0a3835ea45c293f493dc13facfe03a6b39a487"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/pretty.py",
          "bytes": 36391,
          "sha256": "832dd2ef6bb8151836cada28ecdd590d60c8bc1e2e9dbcdde625067609bef1f7"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/progress_bar.py",
          "bytes": 8162,
          "sha256": "9994cfa4953071f71d8100934f3de4c98f9f73bf5d74bc2dc7a1a18717e8d3ae"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/progress.py",
          "bytes": 60408,
          "sha256": "09473696453e5f9f6655d19f8cc0819197a218f2f7bb174e36384d245d93ef06"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/prompt.py",
          "bytes": 12447,
          "sha256": "974461414fb45154d5f5ed3cc56d416c88f426ad885f20a15f8942d2514dcede"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/protocol.py",
          "bytes": 1391,
          "sha256": "e611c70c3347724764f22587e7311b8becee215485e616d4da3228e3b47b9531"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/region.py",
          "bytes": 166,
          "sha256": "acd4fdc59ad56536085d90b43589f8d42250c1835b47e29e70f3b14e042f07c6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/repr.py",
          "bytes": 4431,
          "sha256": "e4c64966638d802ea4b9df905befe6d68917c0bd9a47abbacbea54714089cf6f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/rule.py",
          "bytes": 4602,
          "sha256": "d1f35a4bf68445add43117374f958ca4dfecba6b43c5f6a8af6cb7a1fd5fb419"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/scope.py",
          "bytes": 2843,
          "sha256": "4cc514f2aa35eed872a9008faa30cb62983f514d64e6a55df96c2226f9c955ab"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/screen.py",
          "bytes": 1591,
          "sha256": "628791784494871ef882ba9bd264926fd960861cac5a6147621b1b3154235cef"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/segment.py",
          "bytes": 24743,
          "sha256": "a2d9ca78a18457e591950568b1f2557850dc0f100a1e9bc9fe12f34aee65ba63"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/spinner.py",
          "bytes": 4214,
          "sha256": "a27221a4a9658d11e9a5365ab313bc91782d632087524a5280a825449de8e758"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/status.py",
          "bytes": 4424,
          "sha256": "9243e987761e019068f97fb8c0fa7c813a99c94e3ae8d2f06410383d94d37b0a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/style.py",
          "bytes": 26990,
          "sha256": "5bd09ccbc3f2f253480ad95f729fabcb3313b90686c405376afefe8397c7bb4b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/styled.py",
          "bytes": 1258,
          "sha256": "799367cc6ac8e248bfe78a606373a3d13fb1de5c5d5d3621e3faf20c1db8c015"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/syntax.py",
          "bytes": 36371,
          "sha256": "78328847097ef9e6742f0a3675ad9146d7eeb5719abeb24eeb50a5e4e912e7d5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/table.py",
          "bytes": 40049,
          "sha256": "6664fb57b30c08e60ac3b4c663d4992f26037fa25d33e5957f4ec5755b958532"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/terminal_theme.py",
          "bytes": 3370,
          "sha256": "d63e7eb9f25f9ef940a3942c8bf0026625c39b0317cea826141c8e6d3f7ec896"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/text.py",
          "bytes": 47552,
          "sha256": "00eec93c2cfafa068dd6d8552d73019ed1260cf55816014d1b5a0ceb5fec6a75"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/theme.py",
          "bytes": 3771,
          "sha256": "a0dca15e119a82d0e56c3c9eded56eddeb16396934bcd92ec45c3efee9e568ad"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/themes.py",
          "bytes": 102,
          "sha256": "d318132e8cdf69b79b62d709b43742e50917e4855411abe2a83509261e185459"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/traceback.py",
          "bytes": 35861,
          "sha256": "7345a607f2f4e3f51f65b2daa07f7cdbf53fb3b7a8b3128c5220159833dd4585"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/rich/tree.py",
          "bytes": 9451,
          "sha256": "c969d0eab02f446277a991aa06bc52d925b64ca05336b3f449d63c4313853eec"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli_w/__init__.py",
          "bytes": 169,
          "sha256": "d05f320ed5f1dd4ba7866f3be0aac070fefab2bb0cf7ccbb5b21d0c02ba565ba"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli_w/__pycache__/__init__.cpython-312.pyc",
          "bytes": 361,
          "sha256": "ddb5f13f34c0656e565dd6679304a546f3e454060647cae27a4fe012fccac025"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli_w/__pycache__/_writer.cpython-312.pyc",
          "bytes": 10383,
          "sha256": "b996e847a8c0f158ff5806c81ff0d1ca42cf3ff75195c3f6744b70c1370a7baf"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli_w/_writer.py",
          "bytes": 6961,
          "sha256": "76c89f152db161fd62efa9a64727f3f72d76e710bb67f1d0f38e592a126c617b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli_w/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli_w/py.typed",
          "bytes": 26,
          "sha256": "f0f8f2675695a10a5156fb7bd66bafbaae6a13e8d315990af862c792175e6e67"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/__init__.py",
          "bytes": 314,
          "sha256": "9eb042d7c0db5d14c2168ec4946e410de5a91c9cce86892f5e4db5e4633c6762"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/__pycache__/__init__.cpython-312.pyc",
          "bytes": 372,
          "sha256": "e44bdd204726d1b693e336707c4ae1fd688fd49e91b638f00ff6cab8d924a716"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/__pycache__/_parser.cpython-312.pyc",
          "bytes": 29846,
          "sha256": "ada9a8f66baa90abe89e47b4cf3a040f5dacd22357ceec6f37381c381096b36c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/__pycache__/_re.cpython-312.pyc",
          "bytes": 4308,
          "sha256": "d4eac015a2f32e54cf33bbc534d1170d29b47db7bafb88d41e78d66ad7e8bfc0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/__pycache__/_types.cpython-312.pyc",
          "bytes": 400,
          "sha256": "98e74d1cade28e872ab4ccb6addcba9510c55c227dba451c3ee41b7a9e93c582"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/_parser.py",
          "bytes": 26440,
          "sha256": "a412234c86bf710b361e0943276961f0e25fa6d7c36ba7a0e7eec87a3e018c7b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/_re.py",
          "bytes": 3396,
          "sha256": "a12359fe294523a72112e434d58452a14c9d050affa2417f9927474e4166bfdd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/_types.py",
          "bytes": 254,
          "sha256": "f864c6d9552a929c7032ace654ee05ef26ca75d21b027b801d77e65907138b74"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/tomli/py.typed",
          "bytes": 26,
          "sha256": "f0f8f2675695a10a5156fb7bd66bafbaae6a13e8d315990af862c792175e6e67"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__init__.py",
          "bytes": 1320,
          "sha256": "06eee4aa49a9ba784bb23e710aef204ffdb992da0f5dc4a7c1ef151e4d46989a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1471,
          "sha256": "512b929a1e22b9f0362e168d4b250873f2e20b38c2d3d8f4c1d54d8c68e260e0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__pycache__/_api.cpython-312.pyc",
          "bytes": 17551,
          "sha256": "6cad99a5d983bf1b256a3c947650f6c50984247eace19ced7cebe3f3ba5699ad"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__pycache__/_macos.cpython-312.pyc",
          "bytes": 19021,
          "sha256": "93eeb63a4e39fc4220a9ad9cf8184edeed80af693af52f15d39fe7175e29c3b9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__pycache__/_openssl.cpython-312.pyc",
          "bytes": 2290,
          "sha256": "7c943b04d581f0f620dacbd7ccb1c0e1b5fd10a5bbbedf7ac92b64953ad2cb44"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__pycache__/_ssl_constants.cpython-312.pyc",
          "bytes": 1118,
          "sha256": "97805157eb1859b6fcf74a5482abb80a33c77ac7a4ba8a8dcb199015ef8ac7a6"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/__pycache__/_windows.cpython-312.pyc",
          "bytes": 15784,
          "sha256": "7341fa23a7ddbdf1fd81e64e8c93431df1a24fd17bb85e9cbff58f60a08bd1b1"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/_api.py",
          "bytes": 11413,
          "sha256": "0982425790537edb5961fa98de6a2f74c044fbc6b3eee8444ff2d86ca4f6367e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/_macos.py",
          "bytes": 20503,
          "sha256": "9d994b90e9accd413483aaf2470055198e423b33f2b9d72c889b4359aacce4b4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/_openssl.py",
          "bytes": 2412,
          "sha256": "cc1f9242f272764b3bb50d32230acfe860f77d035249a3e2abbcf0e321794f8d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/_ssl_constants.py",
          "bytes": 1130,
          "sha256": "3540f87d529d483d36ae2efe75bd2d9ced15a8b3fd687bb3992b5c5bbb40974f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/_windows.py",
          "bytes": 17993,
          "sha256": "ac01f22980fc33bb7e6d77c6f1580e55add3a5f85585bb78ad94253b8e58b8ff"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/LICENSE",
          "bytes": 1086,
          "sha256": "33be7b7e8fa4fd19b1760e1a8ed8a668bdab852c91b692dd41424bcb725a9fca"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/truststore/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__init__.py",
          "bytes": 6979,
          "sha256": "24ca35b60d67215d40789daf10d0bf4f17e5d1ee61e86ce5f43195935ad645ba"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/__init__.cpython-312.pyc",
          "bytes": 7334,
          "sha256": "1d00ee16e20a80d8481be6cfe7e3c0915ac19dd9f833b8fc0fbcbbdec427e4fd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/_base_connection.cpython-312.pyc",
          "bytes": 6896,
          "sha256": "736ddc4918494a57b1bea514203a7ec1f333e12a6cadac9906749cbee5223e17"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/_collections.cpython-312.pyc",
          "bytes": 22755,
          "sha256": "08defa4a13259ad7a04870dab43eb725bf5f8adcce752ef87e651e7e1a602ee5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/_request_methods.cpython-312.pyc",
          "bytes": 10626,
          "sha256": "7e9bd75360c32d57063e845ebb5b2b7f63473d546b940ece565e13947f21be82"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/_version.cpython-312.pyc",
          "bytes": 663,
          "sha256": "fd094c1549168063bf83aa8767a80cbb8ea2a48ee13cf5f7da9af1f03862f5ef"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/connection.cpython-312.pyc",
          "bytes": 38916,
          "sha256": "9417e1f82db3c13786dd93e478496895e4d714dadb76b88c817fda84edf9d879"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/connectionpool.cpython-312.pyc",
          "bytes": 40118,
          "sha256": "a9831e74b4c7aed32949c104e8dd4b0b8959436cc31eed66cda24b54a7af8be2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 16628,
          "sha256": "36eb96fbb2c56faa0634940949729d46a588ed96786db9caeb169007ff705caa"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/fields.cpython-312.pyc",
          "bytes": 12017,
          "sha256": "02f7bccf21b80812c05540dc4b604606fe176c093a64f582097f347cfe274de2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/filepost.cpython-312.pyc",
          "bytes": 3503,
          "sha256": "2c5dedb8cad03021c752a6ddbe84decaf56301907ef52c2d03c3ab84fdf1e18f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/poolmanager.cpython-312.pyc",
          "bytes": 24439,
          "sha256": "da5baf12d8cf702ab79bf2d654711bf44b4bc694011f0bff29a06284ae7e3d70"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/__pycache__/response.cpython-312.pyc",
          "bytes": 57531,
          "sha256": "e4fab9de1c752593417f97ca78390cd24c15d652ecba059adb23fedb11806fcc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/_base_connection.py",
          "bytes": 5580,
          "sha256": "1f37121077b1803ad152beb48cd9e20762908ddc3ded279d0f996e45f1ed0978"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/_collections.py",
          "bytes": 17522,
          "sha256": "68e566da62a296fbaf4f579f006b6403ba62eb90b5342dc725fa45c6f6014bc0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/_request_methods.py",
          "bytes": 9931,
          "sha256": "802785f3948efd45385a83f0607228cffb70f9e33f1153a42c5a7c385b02ec30"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/_version.py",
          "bytes": 520,
          "sha256": "fa032b2a1b0f88e8f45f351ecd515ae7d7754ba4204222a0413e601a0c8cf3ec"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/connection.py",
          "bytes": 42786,
          "sha256": "668b37ab12835bdf8643a695a9f050551339b280742231f163fc575a925a1532"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/connectionpool.py",
          "bytes": 44164,
          "sha256": "b0616775d5d8c25c7b282e0908fd602af74d18b34af984c22437460021a3dd8f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 217,
          "sha256": "264ffc21a0c51de6907b11d70451fabfba6119dbc8e91845bf9df1cf6cc27aaa"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/__pycache__/pyopenssl.cpython-312.pyc",
          "bytes": 28288,
          "sha256": "b6a78cc894bed52d5f45e4cfd819952ddbd29ebc90a2af038f37fcd8ae9a49e0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/__pycache__/socks.cpython-312.pyc",
          "bytes": 8195,
          "sha256": "336bcd6bb986be275a9e4862864396632c17b33fdc8e48c0ad328c116364292a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/__init__.py",
          "bytes": 870,
          "sha256": "66bb97696295cc010976a347dcd121d26ac7af0fbed956586f4cd7d11a273590"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1009,
          "sha256": "10ea6a009075a7309430918a1d83c0ee9f8ccf8f280de668991858854b0d7ad4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/__pycache__/connection.cpython-312.pyc",
          "bytes": 10421,
          "sha256": "2d3181b5779d766a76062675e050e4279437f71e335d71c8be4af48f7f67f21c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/__pycache__/fetch.cpython-312.pyc",
          "bytes": 28678,
          "sha256": "f36d6b83af2b7913488d46921e221a293662f2cbe1901cd3e09ea04c09b3c18c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/__pycache__/request.cpython-312.pyc",
          "bytes": 1460,
          "sha256": "c13155d87640900ae674afab83a2fd942837a1e26ffcaafef3e897a7506e1b69"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/__pycache__/response.cpython-312.pyc",
          "bytes": 12378,
          "sha256": "93100e3df9a6f4a5ebbe017b891a566fbc0bb6aa130227a010370bb2bd21ce50"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/connection.py",
          "bytes": 8960,
          "sha256": "822125b01a14b0a55445b6736fc182ac99aa5b6dd79ef8f668dc90545e36b258"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/emscripten_fetch_worker.js",
          "bytes": 3677,
          "sha256": "cf5937cd9e3f84329ddfeb4def0cf3f0b1e31c2da9c4dfeebbc07793d0fd0377"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/fetch.py",
          "bytes": 23520,
          "sha256": "e7171dfbebe217165dda7072d1a2bbdddb49f53b21d7261953f4945f09f089b9"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/request.py",
          "bytes": 566,
          "sha256": "98bdbcb33cb52af137349856a2be633666aba7c830a650d4fbb8301996398344"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/emscripten/response.py",
          "bytes": 9719,
          "sha256": "083a58d0616896e47723110290cda01f9b837d80ccd042f5156afb07beb0b603"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/pyopenssl.py",
          "bytes": 19760,
          "sha256": "3e2feac2f765f37b4da6e8f5939a42a4ffe09b1964e017c5ad39407a0faa67f5"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/contrib/socks.py",
          "bytes": 7639,
          "sha256": "ad2ba495f85ae3ebeda3ef2a48b8523e67f996644f218baa740c4a7bd6e0d910"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/exceptions.py",
          "bytes": 9945,
          "sha256": "8503c7a2aa38cb0e3a7ac3525647225505d5520031580825b21e8c6f242d6be4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/fields.py",
          "bytes": 10801,
          "sha256": "6862c5015669554f856c996596f7b8021834fa91fd659050d88cfb95fa648e43"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/filepost.py",
          "bytes": 2388,
          "sha256": "53c78d67e9a928a1e1ae56c7104893c7180ad7a21e8e111aeeecf8db2a80fdd2"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/http2/__init__.py",
          "bytes": 1741,
          "sha256": "c73ac0487ed1e4035190f24ea2de651a70133aadca2aec97cc8e36adc9f09aab"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/http2/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1770,
          "sha256": "9058939d5a3ee77bcf909b3cdd97e35e03b19af4ddd7d83a47e091beda1e8aae"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/http2/__pycache__/connection.cpython-312.pyc",
          "bytes": 17006,
          "sha256": "8f70af69c5e00d370f9b67a531cf0dc8a3466407828dca1295743c9063ef1990"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/http2/__pycache__/probe.cpython-312.pyc",
          "bytes": 3681,
          "sha256": "ba54c3323acb16d8e7d295275911501149931edacb4656b0c55c925f36673820"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/http2/connection.py",
          "bytes": 12578,
          "sha256": "6c7307e9f36f6adc173eb2aaadc9fbe32037a5459ca8f0e9a672b52dc2826cff"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/http2/probe.py",
          "bytes": 3014,
          "sha256": "9e7024a9b8406a43a217be6bcfb5b4b9d677f047a1fee0fc7e357be0def71442"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/LICENSE.txt",
          "bytes": 1093,
          "sha256": "130e3a64d5fdd5d096a752694634a7d9df284469de86e5732100268041e3d686"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/poolmanager.py",
          "bytes": 23929,
          "sha256": "82b22b1131b5ae01d805a41abb5c8de31c5f2bc53d08a551626c015d6fe4752a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/py.typed",
          "bytes": 93,
          "sha256": "51a0ae3c56b71fc5006a46edfb91bc48f69c95d4ce1af26fd7ca4f8d42798036"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/response.py",
          "bytes": 53031,
          "sha256": "0f304cf9dce5eb1fe1d8464673d8b0d206ce910dfa6e8942ed61121f84eeac7f"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__init__.py",
          "bytes": 1001,
          "sha256": "faa792d1071e8af6b3bc110a0cd142008fba00271d0ce1384ccbe8ed22cd9404"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1030,
          "sha256": "b9f7c674cfdc5d096fdab4207fc64b74f650d57f4a5e41b5e0e78edf43383789"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/connection.cpython-312.pyc",
          "bytes": 4711,
          "sha256": "2e4f97aaa6f31281988dd4d73e1edb5b93c0198759ed78c8757b65703be20ffd"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/proxy.cpython-312.pyc",
          "bytes": 1242,
          "sha256": "437e4e824c901ef7d80f8788404290e021491167c15cd7afba77e41c0f4ff3ef"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/request.cpython-312.pyc",
          "bytes": 8158,
          "sha256": "8fd63cea3a0f6788f7b962ab52ec98b9cb59f8d8629968eaef11149368dac01a"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/response.cpython-312.pyc",
          "bytes": 2901,
          "sha256": "eb6b3b9e4730cca612ac8b02a52b0fea6d5995931fd5b7820cb0f33559de00dc"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/retry.cpython-312.pyc",
          "bytes": 21205,
          "sha256": "80e395b19a5f63a1b74628071768e3f82593325c9b0c349fed606f3457fa07e4"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/ssl_.cpython-312.pyc",
          "bytes": 15683,
          "sha256": "2396acf42eaa1203e3cd028cb5a58ddab423b84c0e07b8dcc1a93483f97d7664"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/ssl_match_hostname.cpython-312.pyc",
          "bytes": 5419,
          "sha256": "abf2af41a59e878b4e1e597c1af153545e73ce22e4d4a3bd4faab8ec6c4ecfaf"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/ssltransport.cpython-312.pyc",
          "bytes": 13330,
          "sha256": "31e0d73439f623605f8e93cdf522a5cabcbd2b594f98e15c44816d4fb073f333"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/timeout.cpython-312.pyc",
          "bytes": 11731,
          "sha256": "d07c6e772579e3d8e74f8e21654ec8b70a40db75db74572bfebdf2ee82fdd7c8"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/url.cpython-312.pyc",
          "bytes": 16303,
          "sha256": "7a6f963a8a7b8812ebf9a1aa809049eeb3213bf72948c2c38d2c85147492fc86"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/util.cpython-312.pyc",
          "bytes": 2019,
          "sha256": "8bfdff2dc46878801ced1e6cd5021da20490786d254e97e829b74d28ee7cdc3c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/__pycache__/wait.cpython-312.pyc",
          "bytes": 3465,
          "sha256": "cc8442d2c05ca71e6e1e2a4a82f12d44532b7f60efecd5f346e7ad49f7f5d925"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/connection.py",
          "bytes": 4444,
          "sha256": "2633bbdb69731e5ccb5cf4e4afd65605d86c7979cc5633126f50c92d5ad74a74"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/proxy.py",
          "bytes": 1148,
          "sha256": "b1e3fcf90e41e9b07474cb703e3f98719650df4bc7b8ba91bbeb48d096767f3b"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/request.py",
          "bytes": 8086,
          "sha256": "a7d2a2f5ea35b4504efa3a95ffb2a6989eb444aaa8636af86a8d1299a1cbc8eb"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/response.py",
          "bytes": 3374,
          "sha256": "bd013adfdba81218f5be98c4771bb994d22124249466477ba6a965508d0164e0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/retry.py",
          "bytes": 19577,
          "sha256": "d989d25fefc579c312843eb5331e6cebc274fdbb541d9aeb73f064155452d4fe"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/ssl_.py",
          "bytes": 17742,
          "sha256": "3aa7b7ac88545377b7195819a1bda1c6647c43464386b84448f94f3ff18b6954"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/ssl_match_hostname.py",
          "bytes": 5479,
          "sha256": "16de38289cd3cc632629f7ff6573fdd658b65785a19af132d7a3ca05cbf8bd99"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/ssltransport.py",
          "bytes": 8847,
          "sha256": "133e0ef2947fbd3f1d6a7fc5bea0584ba7600df05710c7d57ebcdc754a167e2e"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/timeout.py",
          "bytes": 10363,
          "sha256": "bec5094693b49df2a4fb2d4e2a5805198d4e34918f824699ec1ee4aee129558c"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/url.py",
          "bytes": 15256,
          "sha256": "3c40d0332a6276e75ed2701972d2cb8852bd7a937e2cf9d21fb2a938b2f0a87d"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/util.py",
          "bytes": 1146,
          "sha256": "8f795b64ad633f28b00f7e13f08809cdd5846554fee04fb4bd82098bd52378d0"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/urllib3/util/wait.py",
          "bytes": 4423,
          "sha256": "fe987c22b511deca8faa2d0ea29420254947e30ce419e3390a2c80ed7186b662"
        },
        {
          "path": "python/Lib/site-packages/pip/_vendor/vendor.txt",
          "bytes": 317,
          "sha256": "3df0c9601bfa2e0dca23cc574a4f900a4d7fdad060ab203fab8354350ed93320"
        },
        {
          "path": "python/Lib/site-packages/pip/py.typed",
          "bytes": 286,
          "sha256": "10156fbcf4539ff788a73e5ee50ced48276b317ed0c1ded53fddd14a82256762"
        },
        {
          "path": "python/Lib/site-packages/README.txt",
          "bytes": 119,
          "sha256": "cba8fece8f62c36306ba27a128f124a257710e41fc619301ee97be93586917cb"
        },
        {
          "path": "python/Lib/site.py",
          "bytes": 23198,
          "sha256": "b39ab288cc7a6d0cb3bb2655179221411340b22418e4efdee4c20175537a5fa2"
        },
        {
          "path": "python/Lib/smtplib.py",
          "bytes": 43532,
          "sha256": "f19369e751e199f5dfc05882e2f77b6a692719cebd8a18c84552544a0b93e963"
        },
        {
          "path": "python/Lib/sndhdr.py",
          "bytes": 7448,
          "sha256": "d1cb49f6545ef831a69322275ef26f6ca6964953e70d81a8a80fcca8d600ffc0"
        },
        {
          "path": "python/Lib/socket.py",
          "bytes": 37815,
          "sha256": "7d4d4c66e6f4bcc961ab462c4f08002ca97def8713a4be1c7373bdbd970a5274"
        },
        {
          "path": "python/Lib/socketserver.py",
          "bytes": 28065,
          "sha256": "ecbbe1a633801460399a8f10b39007aa0e13cdbdad507e39414000f097b769b5"
        },
        {
          "path": "python/Lib/sqlite3/__init__.py",
          "bytes": 2501,
          "sha256": "f7cc982617b68e147540ef352d38310fe4d25c2c9c2542b67d0590c871df09a8"
        },
        {
          "path": "python/Lib/sqlite3/__main__.py",
          "bytes": 3855,
          "sha256": "495a939623e825a487cde07b62a68aeefdbb1704b53a8b5388af070dc3fac690"
        },
        {
          "path": "python/Lib/sqlite3/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1891,
          "sha256": "5c5fd559a56fdd187360cc84a6431f05979ac831919dca3aa3184283f1fcedec"
        },
        {
          "path": "python/Lib/sqlite3/__pycache__/dbapi2.cpython-312.pyc",
          "bytes": 5115,
          "sha256": "de25028c83354144caf352ad367652906fd76caf25fc83ecdd921aaf1e67f250"
        },
        {
          "path": "python/Lib/sqlite3/dbapi2.py",
          "bytes": 3631,
          "sha256": "7c5c8d98df1f2c50c4062a3be2c0f0499190c179fa4fc281507a1ef763a98f28"
        },
        {
          "path": "python/Lib/sqlite3/dump.py",
          "bytes": 3538,
          "sha256": "bbd9b9d14affcb013f8bd996e30e2cfd1b214d40a37916b9a67fce5b11820eff"
        },
        {
          "path": "python/Lib/sre_compile.py",
          "bytes": 231,
          "sha256": "f7fd87f8ac9dad7d1387e2401761ec05806c5108201a6d1ede6ab2f481f6df54"
        },
        {
          "path": "python/Lib/sre_constants.py",
          "bytes": 232,
          "sha256": "87013dc0b349c2c044100f70a8daa9d713e60a527e26f6ab8ee1fc978a6d3234"
        },
        {
          "path": "python/Lib/sre_parse.py",
          "bytes": 229,
          "sha256": "c4929134532306081918f185c99305c6f55213bc16b32f8c259bc60f7f81e810"
        },
        {
          "path": "python/Lib/ssl.py",
          "bytes": 50904,
          "sha256": "039a0e3f1782e14824b1624c7ffefc2de31714b4a9994424be45a4271966097c"
        },
        {
          "path": "python/Lib/stat.py",
          "bytes": 5485,
          "sha256": "052af0327eae6941b69b05c088b3e748f79995635f80ac4cc7125eb333eb4c77"
        },
        {
          "path": "python/Lib/statistics.py",
          "bytes": 50227,
          "sha256": "5845851a5833a1436bfdfd19001f7cd6b4d95a438b76c47162897106d29449c6"
        },
        {
          "path": "python/Lib/string.py",
          "bytes": 11786,
          "sha256": "24aeae1f0526250f442022022bf98df9a823b1cb330543ee79e70e44907462e9"
        },
        {
          "path": "python/Lib/stringprep.py",
          "bytes": 12917,
          "sha256": "60b6c83581093029312efb6670b11c540090b3f78bcf72264467b494f02f21a5"
        },
        {
          "path": "python/Lib/struct.py",
          "bytes": 257,
          "sha256": "9c231f9497caf513a22dee8f790b07f969b0e45854a0bdd6dd84b492e08c2856"
        },
        {
          "path": "python/Lib/subprocess.py",
          "bytes": 88747,
          "sha256": "85d29b2bf0249f5436838298c9a60ee93508b1102e9ac43b001f8a7e7ae8f375"
        },
        {
          "path": "python/Lib/sunau.py",
          "bytes": 18478,
          "sha256": "7e4f850f6460bcd302439d6d2a9fc1bfc31f88f87ad86c508489f5612b346b7a"
        },
        {
          "path": "python/Lib/symtable.py",
          "bytes": 12477,
          "sha256": "3858ba5f1bd23175cf36a4b774c4e3d937d7cf15181fe49085b7a2f1cac76af8"
        },
        {
          "path": "python/Lib/sysconfig.py",
          "bytes": 31850,
          "sha256": "ce56212ba89be181fb90fe62496e6d2e436befaf2dffd10e87ce37d1685271a8"
        },
        {
          "path": "python/Lib/tabnanny.py",
          "bytes": 11532,
          "sha256": "5dae83b384db40d6ebadc7af0cbb8396343e8ab289ce30de784a4cb41d5fbdab"
        },
        {
          "path": "python/Lib/tarfile.py",
          "bytes": 114124,
          "sha256": "41a9f1930e5285455b4b0db2b9394247cce312c3fa1ef586a58e66c0100668d5"
        },
        {
          "path": "python/Lib/telnetlib.py",
          "bytes": 23334,
          "sha256": "9b0e127e2d0853cc90a596a7b26a2df4ee49dc66c44ac30372aae64d015fd0f9"
        },
        {
          "path": "python/Lib/tempfile.py",
          "bytes": 32386,
          "sha256": "2eea4401f4f29d0d3647ed6fc8bcf6aa1daf879c8aa407a8ea310edac9dfc317"
        },
        {
          "path": "python/Lib/textwrap.py",
          "bytes": 19718,
          "sha256": "62867e40cdea6669b361f72af4d7daf0359f207c92cbeddfc7c7506397c1f31c"
        },
        {
          "path": "python/Lib/this.py",
          "bytes": 1003,
          "sha256": "481d0cb3de511eae0b5713dad18542b07eafd9c013bb7690f7497bad49923a71"
        },
        {
          "path": "python/Lib/threading.py",
          "bytes": 60200,
          "sha256": "846f450ae794e4aab823a163f8c71d27751148af33e91dd3de886686a4e8ebfb"
        },
        {
          "path": "python/Lib/timeit.py",
          "bytes": 13464,
          "sha256": "d47d9deb6be0136d817e04d0e4824aa66c66efa01fe61cf62860fff08ecfe83a"
        },
        {
          "path": "python/Lib/tkinter/__init__.py",
          "bytes": 173168,
          "sha256": "4648028778a32184f92ba0912b64d26f3aaf583644a12326f6081125bc20164d"
        },
        {
          "path": "python/Lib/tkinter/__main__.py",
          "bytes": 148,
          "sha256": "9738a6cb9cdd8139721dd82118bd527897db5325d807222883f70fb1c5a1c27e"
        },
        {
          "path": "python/Lib/tkinter/colorchooser.py",
          "bytes": 2660,
          "sha256": "1224241dcfb4ec6aff3cafc66adeb2b2a3759397a28693173915458c50040143"
        },
        {
          "path": "python/Lib/tkinter/commondialog.py",
          "bytes": 1289,
          "sha256": "e683ab0ee9404baec656a88d637910bcb2badb4b4e5d5def2b80cc4534551e6f"
        },
        {
          "path": "python/Lib/tkinter/constants.py",
          "bytes": 1493,
          "sha256": "c01314dc51d1c8effeba2528720a65da133596d4143200c68595c02067bf1da2"
        },
        {
          "path": "python/Lib/tkinter/dialog.py",
          "bytes": 1535,
          "sha256": "4f8201d3ada7b6d0f450b417e55747adaee5f894412c4875169b0736a5ff0faa"
        },
        {
          "path": "python/Lib/tkinter/dnd.py",
          "bytes": 11644,
          "sha256": "542b804b243b502b5525a8b1f04a02a120b1db4e3599f5c7865e60693ed3672a"
        },
        {
          "path": "python/Lib/tkinter/filedialog.py",
          "bytes": 14939,
          "sha256": "d75c1eb4131db658b8622acffd8262ecbd7337425c799ea3be8d605ea6be7b94"
        },
        {
          "path": "python/Lib/tkinter/font.py",
          "bytes": 7000,
          "sha256": "a73482badacc4a69ff7fae9445793a4d858212fdef103360a478bbfd6ed2f496"
        },
        {
          "path": "python/Lib/tkinter/messagebox.py",
          "bytes": 3861,
          "sha256": "cdbf655c66778a19f0e25754a5f198a850c8bd958ce651e8fe4b2b52ad7f9c63"
        },
        {
          "path": "python/Lib/tkinter/scrolledtext.py",
          "bytes": 1816,
          "sha256": "c7cc050ec9cc3cc6a47215b5bc79b2d3e5c6ed895a4300ab0e20f6c249385e3f"
        },
        {
          "path": "python/Lib/tkinter/simpledialog.py",
          "bytes": 11753,
          "sha256": "984eb0bb02ebdf76da3cadde9f54587204f819723346a576176410b86141d15b"
        },
        {
          "path": "python/Lib/tkinter/tix.py",
          "bytes": 77032,
          "sha256": "5d7a11093a1f6510de786b0e9d67902ab33a57f637cd8f5e2603cf6c5c609a18"
        },
        {
          "path": "python/Lib/tkinter/ttk.py",
          "bytes": 56318,
          "sha256": "6c13af04d672c71abc82181961a7f7bce7b9ea79becdae37f55c78001053ce87"
        },
        {
          "path": "python/Lib/token.py",
          "bytes": 2511,
          "sha256": "1a4d994ce9744f4bfe2d964fc24d112a1e76796a08c2e45a2d73c82a8587f922"
        },
        {
          "path": "python/Lib/tokenize.py",
          "bytes": 21570,
          "sha256": "026f566ac63e60d69c8185a3880831b657accc5eac984fadf271fc99a5e5825d"
        },
        {
          "path": "python/Lib/tomllib/__init__.py",
          "bytes": 308,
          "sha256": "71f67036895f4c5acab942618af0cbd3d814451ba61e967f358d0f341a5b8f51"
        },
        {
          "path": "python/Lib/tomllib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 350,
          "sha256": "87134baf5f9dc6decc97cf15caa7630cc52c504039cc16460989807772f95d34"
        },
        {
          "path": "python/Lib/tomllib/__pycache__/_parser.cpython-312.pyc",
          "bytes": 27178,
          "sha256": "2c63a4000b78b9eaf4f8d00a3b47f7d723343f3aa55eb762ea8a3bf26e59ad8f"
        },
        {
          "path": "python/Lib/tomllib/__pycache__/_re.cpython-312.pyc",
          "bytes": 3903,
          "sha256": "42424a01015205b7fe70ddb6b80ba9fdffb31f6c4a0ae3904e27b41778a70ed5"
        },
        {
          "path": "python/Lib/tomllib/__pycache__/_types.cpython-312.pyc",
          "bytes": 361,
          "sha256": "4b4a77573552625828eef9eb0c871102194acfbc1370787c4b70133c7dbc09ec"
        },
        {
          "path": "python/Lib/tomllib/_parser.py",
          "bytes": 23117,
          "sha256": "559366e5c672449a271a6553675c5d1f699b6a3730f6c14c4e4955b184f29d86"
        },
        {
          "path": "python/Lib/tomllib/_re.py",
          "bytes": 2943,
          "sha256": "75b8e0e428594f6dca6bdcfd0c73977ddb52a4fc147dd80c5e78fc34ea25cbec"
        },
        {
          "path": "python/Lib/tomllib/_types.py",
          "bytes": 254,
          "sha256": "f864c6d9552a929c7032ace654ee05ef26ca75d21b027b801d77e65907138b74"
        },
        {
          "path": "python/Lib/trace.py",
          "bytes": 29352,
          "sha256": "cbed87376cb326ad5c02e6152597d16f4229e96ddb2d8299bfb403ba4d804ba5"
        },
        {
          "path": "python/Lib/traceback.py",
          "bytes": 46393,
          "sha256": "2c44af2848836d9af0c7b3547469695cd22586c64274d362eafcf466af284bd6"
        },
        {
          "path": "python/Lib/tracemalloc.py",
          "bytes": 18047,
          "sha256": "c2cc84a05b824df79840c98729a0e94ef8909b11c528a1b2c5a00aa436b97b25"
        },
        {
          "path": "python/Lib/tty.py",
          "bytes": 2035,
          "sha256": "1ab5e5e047130b310355e907a3306178299b9f2044fb526ac63bd116e9a16d2b"
        },
        {
          "path": "python/Lib/turtle.py",
          "bytes": 146363,
          "sha256": "5e0e21a736c0d20fc49df5f08a69f544e54efa5d9516e1b73d3bfb50da1c6323"
        },
        {
          "path": "python/Lib/turtledemo/__init__.py",
          "bytes": 314,
          "sha256": "5f465277c96c107a5af544b0a962561f97cb0bfd75906d9bf9741450ed02b0e1"
        },
        {
          "path": "python/Lib/turtledemo/__main__.py",
          "bytes": 15384,
          "sha256": "03594b9dc866cbf17c36c4b133c64975295a3bc4f242187af3ea8ea0c75b1095"
        },
        {
          "path": "python/Lib/turtledemo/bytedesign.py",
          "bytes": 4248,
          "sha256": "6deeee99e0ddb4ed29a648f95d4d33e9f3292c21dbecec301337c22a605a280f"
        },
        {
          "path": "python/Lib/turtledemo/chaos.py",
          "bytes": 951,
          "sha256": "bc8a3a9b77e90446fb7060ff68ee008ffd6b23b366052207ec225cc163b4dae5"
        },
        {
          "path": "python/Lib/turtledemo/clock.py",
          "bytes": 3304,
          "sha256": "70e6033c112f699da2b54a56f9366f31466c95af9ca3607e6b94b87eb76ee3c5"
        },
        {
          "path": "python/Lib/turtledemo/colormixer.py",
          "bytes": 1339,
          "sha256": "bbb065830edb37fd53b1c004118853176fd8da32ee532cb0d363960880920374"
        },
        {
          "path": "python/Lib/turtledemo/forest.py",
          "bytes": 2966,
          "sha256": "68cd81b7da35ca49d9066cc2cba24768cddbf90797dbd619a559cf899cde926b"
        },
        {
          "path": "python/Lib/turtledemo/fractalcurves.py",
          "bytes": 3473,
          "sha256": "29fadf34c5eabda4649848d052fa2ed3ae829e55bc3ac5933f2aedf3fb04b320"
        },
        {
          "path": "python/Lib/turtledemo/lindenmayer.py",
          "bytes": 2434,
          "sha256": "4b597f52c1cb35ae8ed540d1db2dab52276c7874febd7a659ee50f26be26f61e"
        },
        {
          "path": "python/Lib/turtledemo/minimal_hanoi.py",
          "bytes": 2051,
          "sha256": "0e458a6257fb5a4ecd2785962850fa87924b23d4ead8aebb70aab38904ff8ef5"
        },
        {
          "path": "python/Lib/turtledemo/nim.py",
          "bytes": 6513,
          "sha256": "939d1ee904a7b00579bb44719b0286e7524bf560c7ffff6d482064b41b09fdb3"
        },
        {
          "path": "python/Lib/turtledemo/paint.py",
          "bytes": 1291,
          "sha256": "81aa22d0da1d934cb47edfef1883f9fe8ef864c56d484f79f9ec4b46457d047e"
        },
        {
          "path": "python/Lib/turtledemo/peace.py",
          "bytes": 1066,
          "sha256": "b260b857164684b3065ad760fec0245ab6505c220814fb179a3d080f2bba0814"
        },
        {
          "path": "python/Lib/turtledemo/penrose.py",
          "bytes": 3380,
          "sha256": "14aeb10db966bfd4ec923a19eb96892eb2aa2723c0962c0824fe2ca9f30e300a"
        },
        {
          "path": "python/Lib/turtledemo/planet_and_moon.py",
          "bytes": 2825,
          "sha256": "cd2c5344b67dbe781cf4c7f0f1eb1b97e6d8a5bf50329bdaa4e42e7d390ea609"
        },
        {
          "path": "python/Lib/turtledemo/rosette.py",
          "bytes": 1361,
          "sha256": "61dfd5bb932cc5a0c3bb9caa8ed74889a19a8d3ee3cb6707ea8f63595ec350b0"
        },
        {
          "path": "python/Lib/turtledemo/round_dance.py",
          "bytes": 1804,
          "sha256": "4ecaac02e68f11ec1a406a6ce8a4b17e4f8af74f76157e0776360d0dd041f276"
        },
        {
          "path": "python/Lib/turtledemo/sorting_animate.py",
          "bytes": 5053,
          "sha256": "7d38adf061cecaf08edfbe8ebc194937f7f070a35e19641a472778f6d3a10927"
        },
        {
          "path": "python/Lib/turtledemo/tree.py",
          "bytes": 1401,
          "sha256": "3318448046c83c176f95a97c33b5cd82e0076bee038d72810bef3dac1085e590"
        },
        {
          "path": "python/Lib/turtledemo/turtle.cfg",
          "bytes": 160,
          "sha256": "de66698dc4f083792df6aaed1e5d94e879852d72f1f24ac09c8fb4cd144c6c88"
        },
        {
          "path": "python/Lib/turtledemo/two_canvases.py",
          "bytes": 1119,
          "sha256": "3300593114fb9286af9360cc9d871a40e5dcbea4aedc24b832607d1dd71c7b96"
        },
        {
          "path": "python/Lib/turtledemo/yinyang.py",
          "bytes": 821,
          "sha256": "0737a80b939aafcf3d8a1bf60b63e781979c749337d02b6c216680893f9fffc5"
        },
        {
          "path": "python/Lib/types.py",
          "bytes": 10993,
          "sha256": "345474ef027a1273f353da9bdc1f7c18f65335e72e681bcc0376774cc51f2405"
        },
        {
          "path": "python/Lib/typing.py",
          "bytes": 118836,
          "sha256": "be92d60fb8382bb29ead21c128825d7c96d0e8c915b44f840791e49f5a8d554c"
        },
        {
          "path": "python/Lib/unittest/__init__.py",
          "bytes": 3487,
          "sha256": "32ed48385c0377bc2900a76e9a6acc3705aeef402c72de8554b3c637420506f0"
        },
        {
          "path": "python/Lib/unittest/__main__.py",
          "bytes": 472,
          "sha256": "ff6b9a100d32001715b40d61bc4d613623b139edb1fdc3566427b83c331caae3"
        },
        {
          "path": "python/Lib/unittest/_log.py",
          "bytes": 2746,
          "sha256": "905672317ab26c656c600defce25d477728068f597f00a7f94e22e8128c323b9"
        },
        {
          "path": "python/Lib/unittest/async_case.py",
          "bytes": 5483,
          "sha256": "c600343ffa27eac746001b2f35df2e4e2e52b90f14026dcfb4c43b25dfd7b261"
        },
        {
          "path": "python/Lib/unittest/case.py",
          "bytes": 57531,
          "sha256": "45bac6d80a4fc3a0dea8340a80681e30b263f017b4a5002cb8f489a632e0f987"
        },
        {
          "path": "python/Lib/unittest/loader.py",
          "bytes": 21116,
          "sha256": "7f0af414bfa7fe8612a424b14cfcf8a3c34fcac999d976461beb738ef8b211b8"
        },
        {
          "path": "python/Lib/unittest/main.py",
          "bytes": 11991,
          "sha256": "db58280574389c0d6cba9559cc51e1787f5b418c4e85d354aa55ca43335c487a"
        },
        {
          "path": "python/Lib/unittest/mock.py",
          "bytes": 106317,
          "sha256": "1de18141992c6742bff27e77c0cbe46d53d6a5ab1850574a536910508823fc5c"
        },
        {
          "path": "python/Lib/unittest/result.py",
          "bytes": 9130,
          "sha256": "5db286bdd3821d64150377e554d7edbdd58db7bb8b950772f977e9ec1d535617"
        },
        {
          "path": "python/Lib/unittest/runner.py",
          "bytes": 10368,
          "sha256": "76d9beb9c21d0d367a1b040a921ad43f90b7971fcc8cacfccd6f9760bedf1ce2"
        },
        {
          "path": "python/Lib/unittest/signals.py",
          "bytes": 2403,
          "sha256": "f8286e818ca56e10e03745bc056cdfd31147678f9a1dc8cb6b0fe96ef9a4362a"
        },
        {
          "path": "python/Lib/unittest/suite.py",
          "bytes": 13512,
          "sha256": "ed2da92bc9f97c53403ee2d3d12cc53b16a96e85d596ebc887b5a93458f3f6bc"
        },
        {
          "path": "python/Lib/unittest/util.py",
          "bytes": 5215,
          "sha256": "fdcc640c3505d16deab9c32eae7c3f5f67c3b5e81c563dc6698fa7fcf403854d"
        },
        {
          "path": "python/Lib/urllib/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/Lib/urllib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 199,
          "sha256": "22b4934c9a2fd906a143732795163ae4ef607aafa85490d20427fded718f7a80"
        },
        {
          "path": "python/Lib/urllib/__pycache__/error.cpython-312.pyc",
          "bytes": 3695,
          "sha256": "67b7ed9d321aac4af66d0ec55848c84f766a425d09ee61accbd5bb44a23c75db"
        },
        {
          "path": "python/Lib/urllib/__pycache__/parse.cpython-312.pyc",
          "bytes": 50677,
          "sha256": "00f4f980ea9b0dfd58a896be82407a3277045192aa42aa338cedc308bd1ab926"
        },
        {
          "path": "python/Lib/urllib/__pycache__/request.cpython-312.pyc",
          "bytes": 115710,
          "sha256": "93543895011b4831ef1294b4c5d53763ed00ca61f56e78ef943a8767b7e0272c"
        },
        {
          "path": "python/Lib/urllib/__pycache__/response.cpython-312.pyc",
          "bytes": 4461,
          "sha256": "46a523680a7d76a4dd1944b3e799800a9d35a3d7d1a34a6143f0fd53c3641e84"
        },
        {
          "path": "python/Lib/urllib/error.py",
          "bytes": 2415,
          "sha256": "d12b3cc66af3f42a8ebe63e1c91d24f92c6237b6a93a3702938dffabd812d77b"
        },
        {
          "path": "python/Lib/urllib/parse.py",
          "bytes": 45676,
          "sha256": "e6af7f475262f1de335bb2e41e26adb94d6103977cf5fe1ddc430dc6a3b1623f"
        },
        {
          "path": "python/Lib/urllib/request.py",
          "bytes": 103724,
          "sha256": "6ffc7d993de64319a40fad631966bd1fd643d355a5c154c1a8b1821f49e5c470"
        },
        {
          "path": "python/Lib/urllib/response.py",
          "bytes": 2361,
          "sha256": "7e6c3b6d7a95f0d74f5968f51a87adae8a51bf42390cdfec98c7a99203e7bb76"
        },
        {
          "path": "python/Lib/urllib/robotparser.py",
          "bytes": 9468,
          "sha256": "644cc6d2b09948e8782cb1e7dea3bb39a2d83932c67e7a8eae65a711318c002c"
        },
        {
          "path": "python/Lib/uu.py",
          "bytes": 7365,
          "sha256": "dd1f5be33fb25a1b0832891ea07db4a4a2ae41b466e37e24e204604fdc6d18cf"
        },
        {
          "path": "python/Lib/uuid.py",
          "bytes": 29656,
          "sha256": "fe357bff7241e9fd6f86ee81567fd20aeec2e17460428ea9b7924bebf57301fc"
        },
        {
          "path": "python/Lib/venv/__init__.py",
          "bytes": 26750,
          "sha256": "976ba2fbc7b22cd2ed315d679aef096d8ddadebbc65492cf892ff29e41860c58"
        },
        {
          "path": "python/Lib/venv/__main__.py",
          "bytes": 145,
          "sha256": "722537c68c0622f8293d39bb6ab1288f3637d8dc45d6f9aae96e49af8145ca36"
        },
        {
          "path": "python/Lib/venv/__pycache__/__init__.cpython-312.pyc",
          "bytes": 31353,
          "sha256": "43479e33fde1184bd883cd2a794d2b029beed50fa48b7b47b3cfd14edb7b5de4"
        },
        {
          "path": "python/Lib/venv/__pycache__/__main__.cpython-312.pyc",
          "bytes": 527,
          "sha256": "e3eefadbf01d0e3a39271aba2a5176f1564d95c8b9c482c9ee994f976f088819"
        },
        {
          "path": "python/Lib/venv/scripts/common/activate",
          "bytes": 2170,
          "sha256": "aba58c76034e4c5ddf9e2351070827d3082606c302d0174d387d2b7e97811b0b"
        },
        {
          "path": "python/Lib/venv/scripts/common/Activate.ps1",
          "bytes": 9033,
          "sha256": "3795a060dea7d621320d6d841deb37591fadf7f5592c5cb2286f9867af0e91df"
        },
        {
          "path": "python/Lib/venv/scripts/nt/activate.bat",
          "bytes": 1013,
          "sha256": "ac8e386773f56be2821d6200ec3190bcc432ce2e3648ff95acd2f725070bc830"
        },
        {
          "path": "python/Lib/venv/scripts/nt/deactivate.bat",
          "bytes": 393,
          "sha256": "fb53ed45866fee40f01c907c1f67555a399f98361722d89120d05a2580e9e563"
        },
        {
          "path": "python/Lib/venv/scripts/nt/python.exe",
          "bytes": 262144,
          "sha256": "3b5cc4150dc98800ee46b09034187bb2d8ba3c8ea3368d3a46e9bb42876b58db"
        },
        {
          "path": "python/Lib/venv/scripts/nt/pythonw.exe",
          "bytes": 249856,
          "sha256": "54ec62ab209d92d2c5266725a5d18739708621847e6c000103db22091415c227"
        },
        {
          "path": "python/Lib/venv/scripts/posix/activate.csh",
          "bytes": 934,
          "sha256": "2b48fcd78f4a7f4437caa76284030d69969be6e56c25cc8acc8c9610bc8ecfcc"
        },
        {
          "path": "python/Lib/venv/scripts/posix/activate.fish",
          "bytes": 2209,
          "sha256": "179d0e20caf4c36d0c6a4457c487dceb51bd5bd379939362b76759ef324c7930"
        },
        {
          "path": "python/Lib/warnings.py",
          "bytes": 21909,
          "sha256": "6405e281882932205eae641b2d31fba7776f94517a206d289465a1caffbf310e"
        },
        {
          "path": "python/Lib/wave.py",
          "bytes": 22769,
          "sha256": "0330428ea9e45fee49acc4ae5bdca4c235f4236c51dab09f30442ccafa25c1f8"
        },
        {
          "path": "python/Lib/weakref.py",
          "bytes": 21513,
          "sha256": "56f8d313fb74019e53eb9287400702fbce788b7fe30e097b0b6e06296f3f080c"
        },
        {
          "path": "python/Lib/webbrowser.py",
          "bytes": 24207,
          "sha256": "8a7d3cea5e22f227b2fbfcdb21be2ffc3f1c940d2ea26d2da479e1efeec49388"
        },
        {
          "path": "python/Lib/wsgiref/__init__.py",
          "bytes": 657,
          "sha256": "c30e144025a63d267778d92f2f066fa592b476e789d888f79b96c059bf0bef60"
        },
        {
          "path": "python/Lib/wsgiref/handlers.py",
          "bytes": 21809,
          "sha256": "ad6af74ec157c3a9153d9b34d7ce684e2df1d329aa703990ae5cdc1a08fc6f7f"
        },
        {
          "path": "python/Lib/wsgiref/headers.py",
          "bytes": 7370,
          "sha256": "9e579ab07be58d321f820b481230a10d5ba6dc4db6512c5323051c4870465ca4"
        },
        {
          "path": "python/Lib/wsgiref/simple_server.py",
          "bytes": 5171,
          "sha256": "d435cad48b5f63c0356e1ac70755e6e35eb94b02f9844b813e5762199110bc2b"
        },
        {
          "path": "python/Lib/wsgiref/types.py",
          "bytes": 1717,
          "sha256": "ba66d30ce511a88eba9b809616c51e12bf89c67972102e7d976b18557f7a6387"
        },
        {
          "path": "python/Lib/wsgiref/util.py",
          "bytes": 5472,
          "sha256": "93783cda348368538525f52a5e9a5a43a3de93caec26b6a030ecfb3aedf98b98"
        },
        {
          "path": "python/Lib/wsgiref/validate.py",
          "bytes": 15036,
          "sha256": "4132f87dcf11a332f6ec5b051e68e59ff493dd6fdcc4f716ea72373734977a0a"
        },
        {
          "path": "python/Lib/xdrlib.py",
          "bytes": 5942,
          "sha256": "983c5e8e3090bdbeb94bf4faf841c1f8c916bcbca423863f6870a142d16a4fb8"
        },
        {
          "path": "python/Lib/xml/__init__.py",
          "bytes": 557,
          "sha256": "34296f728e7fe68cccb97a9f6edbf3bf3a686f44044c744fe85f207a92ed4811"
        },
        {
          "path": "python/Lib/xml/__pycache__/__init__.cpython-312.pyc",
          "bytes": 754,
          "sha256": "80964e1954a30f9a3106a7919f3eafd442449a73b8d745e47c3fbba7fc6b836b"
        },
        {
          "path": "python/Lib/xml/dom/__init__.py",
          "bytes": 4019,
          "sha256": "b415a6f3d3663c3ac332ee4a0f4213eadad9281508dc97410e258a03633b063a"
        },
        {
          "path": "python/Lib/xml/dom/domreg.py",
          "bytes": 3451,
          "sha256": "826b02a803930834b96b1086cbee7db1d21c684f65dd3073706dc7bb5ba1a3e8"
        },
        {
          "path": "python/Lib/xml/dom/expatbuilder.py",
          "bytes": 35693,
          "sha256": "80598dbc5970feaa36ea2b7549e3e76dd018fb80cf79e4a5e27e9e71af60c82c"
        },
        {
          "path": "python/Lib/xml/dom/minicompat.py",
          "bytes": 3367,
          "sha256": "42974c4c67803dfe80b016ff8aeea0d1e5c751703ab3aec5be765f4e534367be"
        },
        {
          "path": "python/Lib/xml/dom/minidom.py",
          "bytes": 67982,
          "sha256": "ceb557c3bc32e2a734d947dffb2452676cfb2f6d83d6b490b9e2d9f700f45d33"
        },
        {
          "path": "python/Lib/xml/dom/NodeFilter.py",
          "bytes": 936,
          "sha256": "9bfacbbb64e239a75591a7260b3ed86748eeb4366e6c40f3542753e79bace9a7"
        },
        {
          "path": "python/Lib/xml/dom/pulldom.py",
          "bytes": 11637,
          "sha256": "614b88673d496a360e6b10efe8d733c7c0826fb214470ff12f24a1e597699870"
        },
        {
          "path": "python/Lib/xml/dom/xmlbuilder.py",
          "bytes": 12420,
          "sha256": "26883dc30a461cb6a3583bd79d363858059569c04e94e3787d4d028f5fab7354"
        },
        {
          "path": "python/Lib/xml/etree/__init__.py",
          "bytes": 1605,
          "sha256": "91950edfb196c105d93886f8af7ea3c0a79e06a6b63be3e5a4ea09804e8672a6"
        },
        {
          "path": "python/Lib/xml/etree/cElementTree.py",
          "bytes": 82,
          "sha256": "d0f57acab07fe4f9c116c3392d85946bac8e78608f409cea70005f16ea019b57"
        },
        {
          "path": "python/Lib/xml/etree/ElementInclude.py",
          "bytes": 6952,
          "sha256": "8e10c99668216701224831c82f13b36d29cd408554c19e34d290c351595df4ce"
        },
        {
          "path": "python/Lib/xml/etree/ElementPath.py",
          "bytes": 14228,
          "sha256": "f9c2102cf56cf9859d34e69877ad4e8a04a0cdabb6390cf2189f04aa8101759f"
        },
        {
          "path": "python/Lib/xml/etree/ElementTree.py",
          "bytes": 74017,
          "sha256": "897618a09d05dadfa9d1707b39533526be69bf01d133747395d27fdc23db3f9f"
        },
        {
          "path": "python/Lib/xml/parsers/__init__.py",
          "bytes": 167,
          "sha256": "b88497adc30d5d5eda7789c25a2206ee9270c932d584d7ac42680325651da45c"
        },
        {
          "path": "python/Lib/xml/parsers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 364,
          "sha256": "7e28077c084d47ea38183fc6fdc1eae36fe94cac8cca19f9b0d1cac61971a4b8"
        },
        {
          "path": "python/Lib/xml/parsers/__pycache__/expat.cpython-312.pyc",
          "bytes": 463,
          "sha256": "b5f83457f2f1dd8c57fbbd14098b6daeb1de3dbe56923e75debd7d354e9d6162"
        },
        {
          "path": "python/Lib/xml/parsers/expat.py",
          "bytes": 248,
          "sha256": "64e1947747c2874117a7458bba1f07c86620cc0ed9a4a4116d262878e4a2aa09"
        },
        {
          "path": "python/Lib/xml/sax/__init__.py",
          "bytes": 3238,
          "sha256": "2f949d27b9eda6284482b43f4c202830fb35ea94f4101d70452119d3210bdbe0"
        },
        {
          "path": "python/Lib/xml/sax/_exceptions.py",
          "bytes": 4699,
          "sha256": "26564d5742496196d17a4a0ee135d28f652ec81742cf2fa4bff83e64323578ac"
        },
        {
          "path": "python/Lib/xml/sax/expatreader.py",
          "bytes": 16034,
          "sha256": "5b6750ae591cffa303b20f092b13409a92df5ee1c403adac08dd5320eafee0be"
        },
        {
          "path": "python/Lib/xml/sax/handler.py",
          "bytes": 15617,
          "sha256": "64c7aae49f1dd382a7b9012610307bfa1d43a14a5dc09a5c8da30903f6805c3d"
        },
        {
          "path": "python/Lib/xml/sax/saxutils.py",
          "bytes": 12255,
          "sha256": "3fe2cdb6386e0c4d42d37c657bbecb78b69c57aedb1610dbd8bf4043944130ab"
        },
        {
          "path": "python/Lib/xml/sax/xmlreader.py",
          "bytes": 12624,
          "sha256": "0962c8d64ac8b03148d4ae62a531f544c4fd1be2116c6f4a53b480cff463dbba"
        },
        {
          "path": "python/Lib/xmlrpc/__init__.py",
          "bytes": 38,
          "sha256": "87ad5c8954dd56fbbca04517bf87477ff4dce575170c7dd1281d7ef1f4214ac8"
        },
        {
          "path": "python/Lib/xmlrpc/__pycache__/__init__.cpython-312.pyc",
          "bytes": 182,
          "sha256": "e80f88c75756dc91b033fcabb8310dc37adecb3568c9f19b02b760b1c9b14817"
        },
        {
          "path": "python/Lib/xmlrpc/__pycache__/client.cpython-312.pyc",
          "bytes": 51576,
          "sha256": "c8c44589ca01aa09123d08c788d9d6b7e1b0bcf3d1e23a1246dad7ebb65596a1"
        },
        {
          "path": "python/Lib/xmlrpc/client.py",
          "bytes": 49331,
          "sha256": "c77e7072ab9aaab6c6f16f89f2e7d528183b816df5d9f80e490f773ab45fe238"
        },
        {
          "path": "python/Lib/xmlrpc/server.py",
          "bytes": 36822,
          "sha256": "6781c25a6224b8bafe13050d26456c8a8b480c96e7974bcf60d4deb0c4ad454c"
        },
        {
          "path": "python/Lib/zipapp.py",
          "bytes": 7543,
          "sha256": "56e098b62cef6c39944bb898326dd920b70be461fe644139e2b699977d2997a1"
        },
        {
          "path": "python/Lib/zipfile/__init__.py",
          "bytes": 89520,
          "sha256": "83031a1582b84054fdde260a372f8ed25d9dedfbfcbedcef2bc015bcca7c5332"
        },
        {
          "path": "python/Lib/zipfile/__main__.py",
          "bytes": 58,
          "sha256": "e418cdbb27adf0063e3cec28179ac6b7bdb6ac743bb49d157f450551fcf38be2"
        },
        {
          "path": "python/Lib/zipfile/__pycache__/__init__.cpython-312.pyc",
          "bytes": 101194,
          "sha256": "d09b022cfa8871ead0d2f51ed31074c0f794854a5cb921d025e21f6a4f4daed7"
        },
        {
          "path": "python/Lib/zipfile/_path/__init__.py",
          "bytes": 10860,
          "sha256": "63fc930890d38a662253bcf7ae50a1bfa06ce38bade19084f9c89f964dcd0e12"
        },
        {
          "path": "python/Lib/zipfile/_path/__pycache__/__init__.cpython-312.pyc",
          "bytes": 18955,
          "sha256": "443ca93d53ccedde4fce855ed185bb77749a62b998af479640246c318c79765b"
        },
        {
          "path": "python/Lib/zipfile/_path/__pycache__/glob.cpython-312.pyc",
          "bytes": 2000,
          "sha256": "6f3f9ca0693817ee31b4f7457e84d62139d6575506ca4ce33c37732f7285c7fd"
        },
        {
          "path": "python/Lib/zipfile/_path/glob.py",
          "bytes": 1158,
          "sha256": "64e27d3872da2ea18b901718c91297d32b9610ebdad058de8561344b0a10e8d7"
        },
        {
          "path": "python/Lib/zipimport.py",
          "bytes": 27840,
          "sha256": "a96f1d7a7b6aaf421a3cf382b94b1422f4f0ad452fdd0bb61d635b560d7a4e91"
        },
        {
          "path": "python/Lib/zoneinfo/__init__.py",
          "bytes": 703,
          "sha256": "ac7fb403e4371d07482ef2fda81dbcf6879484e9fc41d4be42c156d7e54c68a8"
        },
        {
          "path": "python/Lib/zoneinfo/_common.py",
          "bytes": 5294,
          "sha256": "67deaf0ba41aa4865e007297677207485a89b75629eea0ee5c472be8a3e83bf6"
        },
        {
          "path": "python/Lib/zoneinfo/_tzpath.py",
          "bytes": 5388,
          "sha256": "5dc473af6f6ae35e5531cc9705a1e4923aa07e7d35f6b4c275b90c6a3c2591c4"
        },
        {
          "path": "python/Lib/zoneinfo/_zoneinfo.py",
          "bytes": 24674,
          "sha256": "ebb9b679519a23252eb90541003a2fdbb3f2d7bc36713fd70672baa575dcdcb6"
        },
        {
          "path": "python/libs/_asyncio.lib",
          "bytes": 1750,
          "sha256": "389ca052edbd0c9872718ea685b45e5e795bcd22e432128afc40607916cf7611"
        },
        {
          "path": "python/libs/_bz2.lib",
          "bytes": 1682,
          "sha256": "ddb0041f8e8f22e2b8e847d4e19d993e61deb262d311ea797c09d2d18f30207e"
        },
        {
          "path": "python/libs/_ctypes_test.lib",
          "bytes": 30048,
          "sha256": "fa0117f2e37dc90f1fcc75e9b53970c2fa452663338a405f6d4ee690f9610da9"
        },
        {
          "path": "python/libs/_ctypes.lib",
          "bytes": 1732,
          "sha256": "31546b16ba03946a2b7b16c8f1bf2d6959593acebcd99842edcfa42317104798"
        },
        {
          "path": "python/libs/_decimal.lib",
          "bytes": 1750,
          "sha256": "422ca5551d26efd146052d15087d619dc9e1f103b8f5eb9bd73e800cbc1ea2bb"
        },
        {
          "path": "python/libs/_elementtree.lib",
          "bytes": 1896,
          "sha256": "0f005e3a81fa7606bdcf3b0fb5810e2caf7a4e0d9cc1320b304b6320c2bb87a0"
        },
        {
          "path": "python/libs/_hashlib.lib",
          "bytes": 1750,
          "sha256": "7f8b62460c5514598562de184d6ab6f9f2a18598bfed3f0993d1037958170820"
        },
        {
          "path": "python/libs/_lzma.lib",
          "bytes": 1698,
          "sha256": "aa106fbea846caf45b7ac904d0fa0e4959e0009bba5db519cf6703a3fa675cff"
        },
        {
          "path": "python/libs/_msi.lib",
          "bytes": 1682,
          "sha256": "35e2d59fd0e8d3d263cd4390200feaf7a7b876740ffacb9b8bf540d7dba9ff2d"
        },
        {
          "path": "python/libs/_multiprocessing.lib",
          "bytes": 1968,
          "sha256": "f4dbd9829ffd808323a96dd4f4381f8da0279b31705e1f7173971188826c4e9f"
        },
        {
          "path": "python/libs/_overlapped.lib",
          "bytes": 1800,
          "sha256": "2ad8a0eddeb1c9b0d74c5d00bb0a7d61944f7245538ae7247bb2901a4969d86a"
        },
        {
          "path": "python/libs/_queue.lib",
          "bytes": 1716,
          "sha256": "1f7ff9b4294aae710407d70c91e9e00e151c0458b2c886295044fa571e90d48a"
        },
        {
          "path": "python/libs/_socket.lib",
          "bytes": 1732,
          "sha256": "3115fb769012a7d159991a1cc9fead797ab93669f47132b97ce90e3fb1406434"
        },
        {
          "path": "python/libs/_sqlite3.lib",
          "bytes": 1750,
          "sha256": "434ceb868e1a27ee005ca331b12c15db9053343df0bb8bec837c557bb85df41c"
        },
        {
          "path": "python/libs/_ssl.lib",
          "bytes": 1682,
          "sha256": "f8fa7a22dafd834d0d065099a55bdedbe818aba1546e00c466c664ad06d41a8e"
        },
        {
          "path": "python/libs/_testbuffer.lib",
          "bytes": 1800,
          "sha256": "31f45db9e0acc53c8230dda51c1bb8ca9d45cced7780ed82c71e7574c702d351"
        },
        {
          "path": "python/libs/_testcapi.lib",
          "bytes": 1766,
          "sha256": "d0de8ba796e3378554fa0d0705dc9a0b14dbf724367fceeb46fccf88b38b5f24"
        },
        {
          "path": "python/libs/_testclinic.lib",
          "bytes": 1800,
          "sha256": "9a25911f2b78952442f8a404662dc530219e786b90077e737fae0abc0e7bb024"
        },
        {
          "path": "python/libs/_testconsole.lib",
          "bytes": 1896,
          "sha256": "4aa3697d34ac65465181502ef39da708318b9e9cdb57f936b63ce407af850252"
        },
        {
          "path": "python/libs/_testimportmultiple.lib",
          "bytes": 2596,
          "sha256": "655554ddab4dee39d30c64976a99cd2885a5c1f0947e822ee777a14a5c8381ec"
        },
        {
          "path": "python/libs/_testinternalcapi.lib",
          "bytes": 1984,
          "sha256": "abc54e8f678b3d9c9fc7a8273360c906707632cd51d22aec936d2e09ce1dd3cb"
        },
        {
          "path": "python/libs/_testmultiphase.lib",
          "bytes": 10984,
          "sha256": "1140dda41b6e65d2f3e9c87963a36abaf77d433a0e4ffe7ad6e37a71b5404a9c"
        },
        {
          "path": "python/libs/_testsinglephase.lib",
          "bytes": 3206,
          "sha256": "a559f46ae81d571a65afb1dba4472eb531986c9f605bca3a62a2434b09580e57"
        },
        {
          "path": "python/libs/_tkinter.lib",
          "bytes": 1750,
          "sha256": "7ebc1ed203b6624c6feb0bfe42adac276f43b58f9b3966528969f795674a5c1a"
        },
        {
          "path": "python/libs/_uuid.lib",
          "bytes": 1698,
          "sha256": "71c71c9809c4207dd3d7128d16b493b34210d397146cfff579b2e492389c4ab8"
        },
        {
          "path": "python/libs/_wmi.lib",
          "bytes": 1682,
          "sha256": "057cef18cabfcba14333cfa1b38a1bdc34c4d65717864982b51cf776866a6a04"
        },
        {
          "path": "python/libs/_zoneinfo.lib",
          "bytes": 1766,
          "sha256": "fa80669d91228e7c10ffd67ef6fc82d69ebe949fa25109a03e2d38e771472124"
        },
        {
          "path": "python/libs/pyexpat.lib",
          "bytes": 1732,
          "sha256": "bc7ce0dd8c266ee11687564987fe3edf21a7fb75a76b4889dc4523d02f332160"
        },
        {
          "path": "python/libs/python3.lib",
          "bytes": 186296,
          "sha256": "0311844c539715c1b8924e45147074cc5f2e6edff902bf669a4b7c0524c35d3f"
        },
        {
          "path": "python/libs/python312.lib",
          "bytes": 380762,
          "sha256": "e4138278cf48d2723946e4163198d2e5281d0ca15ff5d05b9bee73ada6394e29"
        },
        {
          "path": "python/libs/select.lib",
          "bytes": 1716,
          "sha256": "4f9e1b6c47a90d061abfec94ce4a5958d4778402514e33fde84ff9c2fea47ffb"
        },
        {
          "path": "python/libs/sqlite3.lib",
          "bytes": 67216,
          "sha256": "1841f5756be54fbad9cf8ee5edc8ad335a6c8ba5199b3f55e98be6bd03ea99a3"
        },
        {
          "path": "python/libs/unicodedata.lib",
          "bytes": 1800,
          "sha256": "b7eaa18180ddc1e35ba79828b88a5bf94b319f3695532cd1d97a26c2a4a609b1"
        },
        {
          "path": "python/libs/winsound.lib",
          "bytes": 1750,
          "sha256": "4969da7689029a3d8351be1f2641f3bb2ddf492d1d636d4f6656a0d1d29a9b3c"
        },
        {
          "path": "python/LICENSE.txt",
          "bytes": 25066,
          "sha256": "886a0ead2d89030ee62dbff52b04e47ab91998341295bb9c56fb952b4e081c7a"
        },
        {
          "path": "python/python.exe",
          "bytes": 91648,
          "sha256": "1a967738a234a3bd90e8fa8b925e20a994326e1eb8b74913026a9449a933e6db"
        },
        {
          "path": "python/python3.dll",
          "bytes": 56320,
          "sha256": "cd42200fb3a7d5bda472d617e1e7a5515798ff0a0a827b9e3aef42acc87347ed"
        },
        {
          "path": "python/python312.dll",
          "bytes": 6969856,
          "sha256": "46561f1d4e29afed8db6b8bcde7be110d56d6598ae78cc0cf10b2db8360d9c5e"
        },
        {
          "path": "python/pythonw.exe",
          "bytes": 90112,
          "sha256": "9f8994b0dae525935f62749023202b79e7937d010bb884cf97172148ef372712"
        },
        {
          "path": "python/Scripts/.empty",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/tcl/dde1.4/pkgIndex.tcl",
          "bytes": 474,
          "sha256": "64d08a3abcb271db3af043c535e045f7c325348d87a349a76864637baedd2554"
        },
        {
          "path": "python/tcl/dde1.4/tcldde14.dll",
          "bytes": 25088,
          "sha256": "6b88f753d65c1beb29e681608b49febda726090c5a5d3aa87afa15a002678d3b"
        },
        {
          "path": "python/tcl/nmake/nmakehlp.c",
          "bytes": 21940,
          "sha256": "3d4c390698ea24cb1c2ab0166c7c302ec056d841dc9f4b01979128824bcfc504"
        },
        {
          "path": "python/tcl/nmake/rules.vc",
          "bytes": 62054,
          "sha256": "8fbd0a823a6ffa95c468c6a132c9fcbfecea21f0a47600a735ccdef50bc1e2b5"
        },
        {
          "path": "python/tcl/nmake/targets.vc",
          "bytes": 2606,
          "sha256": "48f59ba7c8050de1ce04ede45f1f8a8488cfe7748bf9a0d845d550cd31451e2b"
        },
        {
          "path": "python/tcl/nmake/tcl.nmake",
          "bytes": 87,
          "sha256": "03589b111b1a9a4daca7fc3014f9f0ade84e875948be925e30726423c063089e"
        },
        {
          "path": "python/tcl/reg1.3/pkgIndex.tcl",
          "bytes": 367,
          "sha256": "1bd0fc8cba2bb1cdd5e5cfcc614b0ef4c8cf4698904d1e48c0f103519c5579e0"
        },
        {
          "path": "python/tcl/reg1.3/tclreg13.dll",
          "bytes": 22016,
          "sha256": "92ffeefcea9bc3c14e9bc3c09c57b9299d7ffbcad2e9da2ed9f9ca9d0e72255e"
        },
        {
          "path": "python/tcl/tcl8.6/auto.tcl",
          "bytes": 21523,
          "sha256": "517204ee436d08efc287abc97433c3bffcaf42ec6592a3009b9fd3b985ad772c"
        },
        {
          "path": "python/tcl/tcl8.6/clock.tcl",
          "bytes": 133439,
          "sha256": "1947f8b188ab4ab6aa72ea68a58d2d9add0894fdf320f6b074eae0f198368fb7"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/ascii.enc",
          "bytes": 1110,
          "sha256": "fb87bf197f4f485b08ea81f7534bc07d9c3a538d022424be11011a1fe3c413fd"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/big5.enc",
          "bytes": 94389,
          "sha256": "ad1ed201b69855bfd353bf969dfc55576da35a963abf1bf7fc6d8b5142a61a61"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cns11643.enc",
          "bytes": 98634,
          "sha256": "8924545cc92584169138aadb64683c07bbf846a57014c2e668d23b63f43f3610"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1250.enc",
          "bytes": 1111,
          "sha256": "e2991a6f7a7a4d8d3c4c97947298fd5bacb3eaa2f898cee17f5e21a9861b9626"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1251.enc",
          "bytes": 1111,
          "sha256": "0aa66dff8a7ae570fee83a803f8f5391d9f0c9bd6311796592d9b6e8e36be6fc"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1252.enc",
          "bytes": 1111,
          "sha256": "741859cf238c3a63bbb20ec6ed51e46451372bb221cfff438297d261d0561c2e"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1253.enc",
          "bytes": 1111,
          "sha256": "5b8d47451f847c1bde12caca3739ca29860553c0b6399ee990d51b26f9a69722"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1254.enc",
          "bytes": 1111,
          "sha256": "31639ca96a4d3602d59bd012540fe179917e0561cb11a0d0b61f1b950eb76911"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1255.enc",
          "bytes": 1111,
          "sha256": "47576cae321c80e69c7f35205639680bf28010111e86e228ed191b084fac6b91"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1256.enc",
          "bytes": 1111,
          "sha256": "29340ea8e5ad3532bf67fa77cc852f055081b1238925cb109908aa72804ccc04"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1257.enc",
          "bytes": 1111,
          "sha256": "c15ab85438728bf2c60d72b1a66af80e8b1ce3cf5eb08ba6421ff1b2f73acdf4"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp1258.enc",
          "bytes": 1111,
          "sha256": "29d93dee7c01b2264778bc6b75f6ef76ea6ac53e9f4a334d83707229e7f482d2"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp437.enc",
          "bytes": 1110,
          "sha256": "e5613c04d3d2ee44ccad85ae53a37c257674491c540836e5d942bbcc4e4a8db4"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp737.enc",
          "bytes": 1110,
          "sha256": "a0415f14f5d72ad24e9c3a5c91517a0e3d22e1adbc3505c0c6e918b961f7a07d"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp775.enc",
          "bytes": 1110,
          "sha256": "c3c6542e902dec2c44ddcfd8b5cb7abf309b0413a7ced1614dc0b20cf7c5e35f"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp850.enc",
          "bytes": 1110,
          "sha256": "13df611f429a9b331da1b34f3c718cccaf0bd4ab44f71a9c632197987b4d643b"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp852.enc",
          "bytes": 1110,
          "sha256": "f3a18a8c7934f6586f023477e08d3f9d5ead9a45e9e58a3f8d018af9bb13f868"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp855.enc",
          "bytes": 1110,
          "sha256": "e64fd2e639da6f654d9bfbb2266f9432259a6a55941622f5cddc3797e382eb0a"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp857.enc",
          "bytes": 1110,
          "sha256": "b6cd5c6f2b54d89142679d599ed0a5dee6955a3b3f6b6673e46afe7a5a303cdc"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp860.enc",
          "bytes": 1110,
          "sha256": "804efa345c5bbbad2449c318a7a3f5b31f4234712aad23dc49b3fb5aa33b7a57"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp861.enc",
          "bytes": 1110,
          "sha256": "4b7e76aeb75289faca76434ea6e9874e9504ad2bc3d8d47550eadbcc8294857e"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp862.enc",
          "bytes": 1110,
          "sha256": "6c15cb256b1c22170292589c6f589e64e164eb36ec7e84f0bd48149babb7c5fc"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp863.enc",
          "bytes": 1110,
          "sha256": "232d6fe34d7151920232eaae9c515f36400ab64136dcc5b802d6245ac6f5d56b"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp864.enc",
          "bytes": 1110,
          "sha256": "81bebfd9a61e9f17495763b68d57742fab2a1a43871015699a2c8e5fded4ec19"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp865.enc",
          "bytes": 1110,
          "sha256": "ada1a52064ee93ebe6f8a5d101d01f8776038e12f21a5ca1c006ee833577c705"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp866.enc",
          "bytes": 1110,
          "sha256": "32a45deba933c7ed99141535087a4c99ba79802175e3f762aca6eb941157f85a"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp869.enc",
          "bytes": 1110,
          "sha256": "afe6ed6eb5d07c45b6b928a48bc5ef57efcf61602d36ff9fbde4a8ea3fa6df75"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp874.enc",
          "bytes": 1110,
          "sha256": "4f05f31ca026bbfeeee49ed86504cb060784137a9cfae0e5954d276e837ab5de"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp932.enc",
          "bytes": 49008,
          "sha256": "6d1b512110beaf2cd1296ac878f51d567848ab4a1ced4f18c72806bb136b3d23"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp936.enc",
          "bytes": 134671,
          "sha256": "b6ec2be0504ca62b9d1b6857f6baa13ffac5a567d4432f4eab98adc830f5d9c3"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp949.enc",
          "bytes": 132551,
          "sha256": "477f8b79b67f4a22c963ee65b9b387dbd8e4b8f62d800b0a51d2276580c6adbb"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/cp950.enc",
          "bytes": 93330,
          "sha256": "f80e05533d1a1494c32f9412e9ad2d9c11faf9ae0668a6f9d1fa5ceedc6870e2"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/dingbats.enc",
          "bytes": 1113,
          "sha256": "eb9b262e4d179268e6f017c0d4ef0e7034e31a5b4893595d150640ca1f6a1c45"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/ebcdic.enc",
          "bytes": 1073,
          "sha256": "165be658ab7d61ffc3df1e2f1438c2f9fcee6808a756316302157f44e6d3acd7"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/euc-cn.enc",
          "bytes": 86971,
          "sha256": "1700af47dc012a48cec89cf1dfae6d1d0d2f40ed731eff6ca55296a055a11c00"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/euc-jp.enc",
          "bytes": 83890,
          "sha256": "a3c916ba16bcac9faa5a1ccc62aca61452d581cd8ba3ee07ec39122c697274c9"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/euc-kr.enc",
          "bytes": 95451,
          "sha256": "5448643398685456a11cbb93af2321f70b8659e2fff3ccc534b4d53bd2f38c89"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/gb12345.enc",
          "bytes": 88033,
          "sha256": "b4894aedd2d5b5ae54b6d2840f7c89a88e9308efd288f179e65936e172ef4b0d"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/gb1988.enc",
          "bytes": 1111,
          "sha256": "acd50951f81566c8d823670f9957b2479102eb5ae4cf558453e1d8436a9e31ff"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/gb2312-raw.enc",
          "bytes": 85912,
          "sha256": "c445e4c9f676ae997d2dda2bbc107b746f3547d85f39479951c56f46275ee355"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/gb2312.enc",
          "bytes": 86971,
          "sha256": "1700af47dc012a48cec89cf1dfae6d1d0d2f40ed731eff6ca55296a055a11c00"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso2022-jp.enc",
          "bytes": 204,
          "sha256": "98074c85650a420a095ada9138da3a8a0aa4027be47ea1e97a596f319eb084e9"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso2022-kr.enc",
          "bytes": 122,
          "sha256": "234811fc8b0f8ff2b847d9cc3982f1699df1d21a43c74dce45ba855d22520007"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso2022.enc",
          "bytes": 240,
          "sha256": "741b4c842557eed2952936204d0ae9c35fa3a0f02f826d94c50c46976291797c"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-1.enc",
          "bytes": 1114,
          "sha256": "a9cb4f4ca111608f882729bc5eb1c2f15530c515ef02dd2ca62f2d8dc5a210cf"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-10.enc",
          "bytes": 1115,
          "sha256": "48f4a239c25354f0e9f83a39f15d4632bb18a9c33e60c671c67307159917eced"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-11.enc",
          "bytes": 1115,
          "sha256": "21e769c5a66e4d12d6e7db24022e92af1ec0d0331fe3c8c605654f239c0f3640"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-13.enc",
          "bytes": 1115,
          "sha256": "3271d39d7b4dcd841e8e5d5153d1b8837718b88fefec73dc37d314816eefe5e5"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-14.enc",
          "bytes": 1115,
          "sha256": "f0a5675027fb1ca34b4e4128d24c2968cd275890569a32a86afa4994ce4983e0"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-15.enc",
          "bytes": 1115,
          "sha256": "c74e8e23a0ff0d5dea7c318ca20dc817da4e57b0dd61b3361fc0d5098a9316fe"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-16.enc",
          "bytes": 1115,
          "sha256": "640d977ec1d22b555c5075798da009e3523e8f55f29be22a3050cd1b4ef7b80e"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-2.enc",
          "bytes": 1114,
          "sha256": "76949b03f57041b07f41902bd7505ab3594d79aa8f7bdeed5f0481004b10cbc3"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-3.enc",
          "bytes": 1114,
          "sha256": "1f51e7bda64d466c16fee9a120bbe3353a10ceb9dab119ffa326779ba78d8c5d"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-4.enc",
          "bytes": 1114,
          "sha256": "66b3cf994f0b5e0103d13e812958320afb555c91e3f81b579d4cbf231e6a0805"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-5.enc",
          "bytes": 1114,
          "sha256": "3130bf26da0c840c1e02203a90c3b1c38966fb203130e2fbb3dd7cb3865a3539"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-6.enc",
          "bytes": 1114,
          "sha256": "cb71909bf01a3a7a4c7396359da06d206b58a42ad68192ce37169d6640d46e13"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-7.enc",
          "bytes": 1114,
          "sha256": "76f6bc85fc9cb89bc3f94d36275ab23c740ba17fd36ec8907479da3a885415ea"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-8.enc",
          "bytes": 1114,
          "sha256": "865e3665743b5faba3e1ad6aa55515a666bd05da6266879d9b66c98905daff3c"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/iso8859-9.enc",
          "bytes": 1114,
          "sha256": "cf51e867dde2f19553d98feec45a075c4b4f480fb1edadb3d8dad1ebea9299f3"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/jis0201.enc",
          "bytes": 1112,
          "sha256": "61b14a7c312366f79bb45f02c6b7ee362e6f51cbad5e479e563c7f7e785db654"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/jis0208.enc",
          "bytes": 81772,
          "sha256": "f6b1c6ac5f5fc4e990a7a1aac16a406012040936431befe7d2b6cd1da9e422c4"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/jis0212.enc",
          "bytes": 72133,
          "sha256": "785cfc5f5d9cb06db8061730ab0016a0f70d0b59f6787d2a3cbb8d5779c99706"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/koi8-r.enc",
          "bytes": 1111,
          "sha256": "0e43244bfc4f33facb844b9e00270a1a4c24dc59b8a9b95104e2d788bb2f59fd"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/koi8-u.enc",
          "bytes": 1111,
          "sha256": "ed04d5b977b8c8944d8760b713ff061292da5634bcbb67cdfb1c3a6ff5378c81"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/ksc5601.enc",
          "bytes": 94393,
          "sha256": "9b27fe7e7054f36e279993f19e52e18ac03360d117ae80c42b4e984a97c590aa"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macCentEuro.enc",
          "bytes": 1116,
          "sha256": "81eca6840b87f2def9fcdd171a55c2d71a49386d88401ce927ae57d7ddd7aaaa"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macCroatian.enc",
          "bytes": 1116,
          "sha256": "bbe6f5ebb5eab08c91df7d524faf39b03aa8b9f84c67aba0553a84ec56668cb9"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macCyrillic.enc",
          "bytes": 1116,
          "sha256": "76efe571adda7aed467f146cb0bd3a2351f2a720508ea0642c419f5347789caa"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macDingbats.enc",
          "bytes": 1116,
          "sha256": "062e31d48dc33160999074e49205e08c3655dff91c2c87f254522e6ebce2dd96"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macGreek.enc",
          "bytes": 1113,
          "sha256": "1aabe561b5c944abd11c293d4acac0f3a4a5a9e84a0342d066f4e3e992348895"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macIceland.enc",
          "bytes": 1115,
          "sha256": "6fd08ce6fba521d51e8058de5c2dbd6583b80306a8be7d015361f76314e70a35"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macJapan.enc",
          "bytes": 48813,
          "sha256": "47007d9ebf4d34c6ce3599e50afc7c1cf8129b88994de2c2a857c09003f9cd2b"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macRoman.enc",
          "bytes": 1113,
          "sha256": "c83d971d6bc0284ef323c197896e38c57a5ff44784e451ec2997eda70c0dd85c"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macRomania.enc",
          "bytes": 1115,
          "sha256": "0b805daf21d37d702617a8c72c7345f857695108d905ff378791f291cea150f0"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macThai.enc",
          "bytes": 1112,
          "sha256": "a1802a2feb01b255ec7c17425eee4525372df8ce226f4047d149172eb438f913"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macTurkish.enc",
          "bytes": 1115,
          "sha256": "afb66138ebe9b87d8b070fe3b6e7d1a05ed508571e9e5b166c3314069d59b4e4"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/macUkraine.enc",
          "bytes": 1115,
          "sha256": "f7e11736c9ff30102b31ec72272754110193b347433f4b364921e8f131c92bf0"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/shiftjis.enc",
          "bytes": 42552,
          "sha256": "4a15ed210126bcdae32543f60eb1a0677f985f32d49fce923b9fae8c5bcf3da4"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/symbol.enc",
          "bytes": 1111,
          "sha256": "9660537a7b62996478555c6f57c1962c78fb3972f19370b2e395c44842818a1f"
        },
        {
          "path": "python/tcl/tcl8.6/encoding/tis-620.enc",
          "bytes": 1112,
          "sha256": "50b62381d6edd4219f4292bfdc365954491b23360de7c08033e7218a3d29c970"
        },
        {
          "path": "python/tcl/tcl8.6/history.tcl",
          "bytes": 8235,
          "sha256": "5123db837eadf45712ea7d449bc40bfd3e8e16d3d71e7d0ce9a32f164973d767"
        },
        {
          "path": "python/tcl/tcl8.6/http1.0/http.tcl",
          "bytes": 10066,
          "sha256": "8c474095a3aba7df5b488f3d35240d6de729e57153980c2a898728b8c407a727"
        },
        {
          "path": "python/tcl/tcl8.6/http1.0/pkgIndex.tcl",
          "bytes": 746,
          "sha256": "77265723959c092897c2449c5b7768ca72d0efcd8c505bddbb7a84f6aa401339"
        },
        {
          "path": "python/tcl/tcl8.6/init.tcl",
          "bytes": 25633,
          "sha256": "331bcf0f9f635bd57c3384f2237260d074708b0975c700cfcbdb285f5f59ab1f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/af_za.msg",
          "bytes": 257,
          "sha256": "1548988458bbf0dfccc23b7487cec0e9c64e4cc8e045723e50bec37c454a8c81"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/af.msg",
          "bytes": 1038,
          "sha256": "a1eaca556bc0cfbd219376287c72d9dbbfab76ecf9bf204fd02d40d341baf7da"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ar_in.msg",
          "bytes": 265,
          "sha256": "2e04b96da002519d28125918a22ff2bb9659a668a7bcad34d85dddecec8dc0b4"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ar_jo.msg",
          "bytes": 1851,
          "sha256": "5adbb3d37c3369e5fc80d6a462c82598d5a22faef0e8df6b3148231d2c6a7f73"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ar_lb.msg",
          "bytes": 1851,
          "sha256": "1fc13070cf661488e90fece84274c46b1f4cc7e1565eab8f829ccaa65108dfca"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ar_sy.msg",
          "bytes": 1851,
          "sha256": "294f3e46c55453edad44567e1330f9b43e69a07fa0655b24dd2780a4490c1194"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ar.msg",
          "bytes": 2018,
          "sha256": "b69d0061a728d59f89ff8621312789cd9f540bf2e2ed297804d22f6278561d85"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/be.msg",
          "bytes": 2157,
          "sha256": "a636a82c7d00ccdc0af2496043ffa320f17b0d48a1232708810d3bb1453e881e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/bg.msg",
          "bytes": 1871,
          "sha256": "cfe4e44a3a751f113847667ec9ea741e762bbde0d4284822cb337df0f92c1aca"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/bn_in.msg",
          "bytes": 265,
          "sha256": "b3d8a4632290b0f3da690e47c1fdf06a8b9e171a96e938afdb0dd52cf806ce54"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/bn.msg",
          "bytes": 2335,
          "sha256": "890ea6521deb1b3c3913ccd92562f6360e064daee2e2b0356a6dd97a46264a1f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ca.msg",
          "bytes": 1152,
          "sha256": "3be295dcc8fcdc767fed0c68e3867359c18e7e57d7db6c07236b5bc572ad328e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/cs.msg",
          "bytes": 1354,
          "sha256": "afea12a16a6fa750ea610245133b90f178ba714848f89aec37429a3e7b06be1a"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/da.msg",
          "bytes": 1208,
          "sha256": "0d422a991bca13fe9033118691cfedab0f372222ebb0bc92baf8e914ee816b84"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/de_at.msg",
          "bytes": 847,
          "sha256": "1c02d14140196623297f858e2eef00b4159e1c6fafe044ec65a48c9c24d46540"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/de_be.msg",
          "bytes": 1276,
          "sha256": "532845cd15ec821c1939d000c648694a64e8ca8f0c14bad5d79682cf991481ce"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/de.msg",
          "bytes": 1276,
          "sha256": "4c27733502066e8391654d1d372f92bf0484c5a3821e121ae8aa5b99378c99ae"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/el.msg",
          "bytes": 2304,
          "sha256": "8b23e0e2f0f319bb9a2dfdccdc565ff79a62fa85094811189b6bc41594232b6b"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_au.msg",
          "bytes": 307,
          "sha256": "705c66c14b6de682ec7408eabdba0800c626629e64458971bc8a4cbd3d5db111"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_be.msg",
          "bytes": 312,
          "sha256": "bc87754a253c1036e423fa553da182dbc56f62a13eda811d8cd9e8afa40404a6"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_bw.msg",
          "bytes": 257,
          "sha256": "ec48f18995d46f82b1cc71ea285174505a50e3ba2017bcce2d807149b7543fd0"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_ca.msg",
          "bytes": 295,
          "sha256": "3cf2d0937fd95264549cf5c768b898f01d4875a3eb4a85d457d758bc11dfec6e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_gb.msg",
          "bytes": 286,
          "sha256": "c2ce5b74f9e9c190b21c5df4106303b7b794481228fb9a57065b9c822a1059c3"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_hk.msg",
          "bytes": 329,
          "sha256": "563450a38db6c6a1911bc04f4f55b816910b3e768b1465a69f9b3bd27292dbee"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_ie.msg",
          "bytes": 286,
          "sha256": "9e0dcee86a03b7bdd831e0008868a9b874c506315bf01df3982ad3813fd3ba8e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_in.msg",
          "bytes": 318,
          "sha256": "adea3a1ab8aa84237ddb2f276abdb96dcb4c51932e920d1a5e336904e1138664"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_nz.msg",
          "bytes": 307,
          "sha256": "ec305b7cb393421e6826d8f4fea749d3902eba53bfa488f2b463412f4070b9ed"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_ph.msg",
          "bytes": 329,
          "sha256": "3a9c22b07906544c04f7a29b800fce87c09d7fdf5c251236925115cf251a3890"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_sg.msg",
          "bytes": 257,
          "sha256": "d565679ae9aacbfe3b5273fe29bd46f46ffbb63c837d7925c11356d267f5ff82"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_za.msg",
          "bytes": 251,
          "sha256": "67c253e2a187aa814809418e5b7a21f3a1f9fb5073458a59d80290f58c6c1eb4"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/en_zw.msg",
          "bytes": 257,
          "sha256": "6f4754ce29dfa4f0e7957923249151ce8277395d1af9f102d61b185f85899e4e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/eo.msg",
          "bytes": 1285,
          "sha256": "98d52cab5ca65789d1dc37949b65baf0272ab87bccbb4d4982c3af380d5406ab"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_ar.msg",
          "bytes": 248,
          "sha256": "b97dcea4fec3e14632b1511d8c4f9e5a157d97b4ebbc7c6ee100c3558cb2947f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_bo.msg",
          "bytes": 257,
          "sha256": "b47f55539db6f64304dea080d6f9a39165f1b9d4704dcba4c182dbd3aa31a11b"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_cl.msg",
          "bytes": 257,
          "sha256": "9d1a2a6eba673c6f6d964dbcddf228cb64978f282e70e494b60d74e16a1db9cb"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_co.msg",
          "bytes": 257,
          "sha256": "5fac53acfb305c055afd0ba824742a78cb506046b26dac21c73f0bb60c2b889a"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_cr.msg",
          "bytes": 257,
          "sha256": "a33dc22330d087b8567670b4915c334ff1741ee03f05d616cc801ecfda1d9e64"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_do.msg",
          "bytes": 257,
          "sha256": "8dc2f857e91912ed46a94eb6b37dd6170ea7bcddcd41cb85c0926a74ee12fcc1"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_ec.msg",
          "bytes": 257,
          "sha256": "52ab5a6c9dd4f130a75c049b3af8f54b84071fc190374bccf5fa0e1f3b91eb21"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_gt.msg",
          "bytes": 257,
          "sha256": "19b4d3025156c060a16328370a3fdb9f141298decfc8f97be606f6438fece2ee"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_hn.msg",
          "bytes": 257,
          "sha256": "07873d4d59bb41000706a844859c73d26b1ff794058aa83cffca804981a24038"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_mx.msg",
          "bytes": 257,
          "sha256": "a0f57137d2c0abdc933e03cfb188f5632176c195ceadb9dc80d469c8dc6cedc6"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_ni.msg",
          "bytes": 257,
          "sha256": "6250663da1378e54bedcef206583d212bc0d61d04d070495238d33715bb20cae"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_pa.msg",
          "bytes": 257,
          "sha256": "ebb661c1c09e7d4f6fbcc4b2dad0f41442b1ffdd27f003abdc0375dd316e57d7"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_pe.msg",
          "bytes": 257,
          "sha256": "90c130b66958cf63cb3ddd2c633e58444357dbab44c56831dd794cbd2eb1aed0"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_pr.msg",
          "bytes": 257,
          "sha256": "f790e8e48dc079dcd7deb58170561006a31294f7e4acbf9cf2abfa3db9e3fa9e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_py.msg",
          "bytes": 257,
          "sha256": "70263f7eb22822dfee8849b7ac4418ed9331275a71e77236b59226396505cdff"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_sv.msg",
          "bytes": 257,
          "sha256": "26a38b3745c95673d21babb987f1d41ee08dda945c670f5432ba0ce6f893c0e9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_uy.msg",
          "bytes": 257,
          "sha256": "1291b58810739ea0651493dd7887f5ee3e14bdb806e06dd4bb8ae2520c742eda"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es_ve.msg",
          "bytes": 257,
          "sha256": "91191517403c712299919f9c797f952502e33cb6961d1dbee3a7c9e8d2b170b9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/es.msg",
          "bytes": 1232,
          "sha256": "e9a6fe8cce7c808487da505176984d02f7d644425934cedb10b521fe1e796202"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/et.msg",
          "bytes": 1258,
          "sha256": "4bee224c21b0483cff39be145c671aa20cb7872c8727fd918c0e8eca2bbeb172"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/eu_es.msg",
          "bytes": 294,
          "sha256": "d45cc432e5743e6cec34e9a1e0f91a9d5c315cda409e0826b51ad9d908479eb6"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/eu.msg",
          "bytes": 1032,
          "sha256": "6889b57d29b670c6cfb7b5a3f2f1749d12c802e8e9629014d06ce23c034c7ef1"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fa_in.msg",
          "bytes": 2009,
          "sha256": "6b56545c1ae1de53bc2389bb7ae59f115bade24f907e384e079491dc77d6541d"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fa_ir.msg",
          "bytes": 426,
          "sha256": "3d9779c27e8960143d00961f6e82124120fd47b7f3cb82db3df21cdd9090c707"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fa.msg",
          "bytes": 1711,
          "sha256": "86898728b275288693b200568dc927c3ff5b9050690876c4441a8339dae06386"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fi.msg",
          "bytes": 1195,
          "sha256": "9929a6b7139bd7e0f29487f7888a83e4c4f5e9ce0352738cfca94ee2ddf3bd6b"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fo_fo.msg",
          "bytes": 286,
          "sha256": "c3dccf5e5904c24d4ad9aaa36160a78f5397a7452510c0c0e61de4de863305cb"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fo.msg",
          "bytes": 1033,
          "sha256": "2ec9b03469fa38b260915c93318f446ea5e12b9090bd441936b57552eba1e3c9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fr_be.msg",
          "bytes": 286,
          "sha256": "aad828bcbb512fbd9902dcdd3812247a74913cc574deb07da95a7bbe74b1fe48"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fr_ca.msg",
          "bytes": 286,
          "sha256": "0624df9a56723ddb89e59736c20a5837dea2206a789ebe7eef19ad287590ca45"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fr_ch.msg",
          "bytes": 288,
          "sha256": "290ca6eb74baeac4e2420d0755d148849f89ee87e37860f25cbb7b8afa3edcbc"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/fr.msg",
          "bytes": 1257,
          "sha256": "96b1e1e12cd13a56722ebf27d362c70b467342fa1282a40b89fb16b5105a0480"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ga_ie.msg",
          "bytes": 286,
          "sha256": "3f9615c617d3cdbc1e127b3efee785b0cb5e92e17b7dabac80da2beaf076362c"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ga.msg",
          "bytes": 1188,
          "sha256": "880806867acabd9b39e3029a5add26b690cc5709082d43b0959eba725ea07ab5"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/gl_es.msg",
          "bytes": 257,
          "sha256": "b5688ca07d713227b713655877710258cd503617e8df79293a971649e3134f05"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/gl.msg",
          "bytes": 997,
          "sha256": "34d61b49dbf9584893051ffb458d6de9e7e2e7774ac0011f70c4dd4184eba81c"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/gv_gb.msg",
          "bytes": 257,
          "sha256": "86cabf3b9360c0e686cc4cbeb843e971c28bc6d35210ed378b54eb58cc41f3d5"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/gv.msg",
          "bytes": 1084,
          "sha256": "404795f2c88d0038f9ed0b5120a251d26edf8b236e1b1698bc71acd4dc75ac45"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/he.msg",
          "bytes": 1990,
          "sha256": "787da79af58872bf45ab09e3b6a920a4496b5bd8a4f3c7f010cf013ec2e8efe0"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/hi_in.msg",
          "bytes": 257,
          "sha256": "5a3bf0dd61bfb5a2bf75e96b11e0e3528ffab720a0bf1923853606f8caf0e76d"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/hi.msg",
          "bytes": 1777,
          "sha256": "192f4a8e77e1627712f85533c9896ef6a040157c7bd56df3a4a7fa56ad6746c2"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/hr.msg",
          "bytes": 1171,
          "sha256": "105a9180bc5d23738183374fa0ea8dd80484bf3947e1432e515bdc2913c017d9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/hu.msg",
          "bytes": 1381,
          "sha256": "993475532f89e1ea7214adb265294040862305612d680cff01dd20615b731ccc"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/id_id.msg",
          "bytes": 257,
          "sha256": "ba7fc0c0452d3e482db6e19bdf512caced639ba72b92ed8f66d80b52fea11ac0"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/id.msg",
          "bytes": 961,
          "sha256": "41c0c3d3b4491e9b36e719466503efcd325175cb7824c4a5055cb113d347be0f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/is.msg",
          "bytes": 1305,
          "sha256": "778be3d6bfe2dffb64ff1afb9ec8351a3343b314cf93a68e8f7fd1073ee122bb"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/it_ch.msg",
          "bytes": 250,
          "sha256": "24b5f303f5c7af6f63fdc23adb4d713087ae74b6d18c117d787af03374c5f57e"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/it.msg",
          "bytes": 1294,
          "sha256": "1d72170b9f9028a237364f7cd7ea8b48bd4770e61922205ce862300103b13de5"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ja.msg",
          "bytes": 1689,
          "sha256": "2b6d15a191437f1b84fa7023e34153b61e6bf1de1452ea921e9ccbbe5d4beb1c"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/kl_gl.msg",
          "bytes": 286,
          "sha256": "3027cfe9ebd2172cefc15c025786cad47a6e2894bf0474afc1b0c341e70202aa"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/kl.msg",
          "bytes": 1025,
          "sha256": "96ff17f1cff976e4e204d3616d1efced4d0f907c5e6a0f04b4536cb4ad1190c9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ko_kr.msg",
          "bytes": 354,
          "sha256": "4cac8fb43d290a63a4d3215f22228b358ab4fa174f08712dd6c5b64c5e485071"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ko.msg",
          "bytes": 1621,
          "sha256": "ef6fb319c398eea79b3a951319f831f3b186d556565d17d738e5f9b4b77570f2"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/kok_in.msg",
          "bytes": 260,
          "sha256": "644f2b6d4ba27af14891b781def60f708a9f18fc2f73566649b631a6dea3ef09"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/kok.msg",
          "bytes": 1997,
          "sha256": "9d215e31a39fed45b3657144e5f73c942e59e500036ce16b1fff201fd6358595"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/kw_gb.msg",
          "bytes": 257,
          "sha256": "edac14d929d1c6559ec46e9b460f8f44a189b78fb915f2d641104549cbd94188"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/kw.msg",
          "bytes": 1013,
          "sha256": "eab468ac5bf1833d4f8cd658789413d4a46cad16b63fb9b906cff6dc9ea26251"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/lt.msg",
          "bytes": 1307,
          "sha256": "855b652fcc8066ba45c7dc8dbfd3807d1b4759ea8d71c523567f47bf445d1de6"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/lv.msg",
          "bytes": 1271,
          "sha256": "7e90d2008b220db19c796c7107ad69d263b8ac8c7bddfb879230699d978e9a0a"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/mk.msg",
          "bytes": 2157,
          "sha256": "4c0eb07f0fcb36dd12a3f7edd6531616611abf62bf7705b5a37cc59098221d5d"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/mr_in.msg",
          "bytes": 257,
          "sha256": "b7b1d379355a1d278e13ef557a887a662e84fb6a9b62b8e19a27927926270ef9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/mr.msg",
          "bytes": 1846,
          "sha256": "ae873bf5484eacbbe179913d43451be53378fa701b5d81594d052266b8a09af0"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ms_my.msg",
          "bytes": 265,
          "sha256": "f5b859d8dd2a2b5f756e39b0dfeb26b95878d2f54ba3ce46c56f0f26cf2b554b"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ms.msg",
          "bytes": 957,
          "sha256": "970b2f3ecc04980fcc2f9531ca6ce2bf36bc12942cb614bf70313b4cb0508985"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/mt.msg",
          "bytes": 717,
          "sha256": "7dbc4e82d82fde8cdf522fa10e082289d46b0c1a4a7d7a5fa83ff116677f052b"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/nb.msg",
          "bytes": 1209,
          "sha256": "534c5dacef12f818faf4ed806997a559f95d591f1b6236b0c30b07a107dd13f3"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/nl_be.msg",
          "bytes": 286,
          "sha256": "77a69dd60d171b321512b14794e75a66ff753410c007997b310790d86e09b057"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/nl.msg",
          "bytes": 1129,
          "sha256": "9e2fe3851cf13ec79a9b10a09b01ceb0a26044ae0dc90a4e00be57745e854c79"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/nn.msg",
          "bytes": 1200,
          "sha256": "06fa2d6d8c59d0b8eac2ede5ab0ddb8b6e095d1a023b1966fce3b65916fa14fb"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/pl.msg",
          "bytes": 1263,
          "sha256": "61462c325db0065352d8155307f949869862a86cac67ad7bb6703f57a7fa2ff3"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/pt_br.msg",
          "bytes": 286,
          "sha256": "320be7d5b730091e6fa35f196314737261c8e154577dcf6ac8c2057d44394ad7"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/pt.msg",
          "bytes": 1177,
          "sha256": "6f6eeeddcf232bdcb952592a144810ced44a1cbb4bcc2c062d5f98d441505380"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ro.msg",
          "bytes": 1224,
          "sha256": "25ed6ac7a353e23b954b98611ae3b7e56bdcf2b0cb0db358253cfb8bebbb831c"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ru_ua.msg",
          "bytes": 248,
          "sha256": "13e4e79a0ed82034bade0cff8def5de1222f6968108ad710662bdb7daf36d7e1"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ru.msg",
          "bytes": 2091,
          "sha256": "bb35bb6f07baef72c329ec3e95d6527a2736070ee2ffe5de227e1ff0332390f8"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sh.msg",
          "bytes": 1212,
          "sha256": "e65d6e5e837df0a2df0db77bce45334bbc27efff9023c37119e75d49932d9d6c"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sk.msg",
          "bytes": 1255,
          "sha256": "976813f6c53c9bebbf976b0f560fd7fc5e4ec4c574d7e1cd31f9a4056765cb7a"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sl.msg",
          "bytes": 1216,
          "sha256": "11a6264676dbed87e4f718075127e32e107854f35f141642454f484984084486"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sq.msg",
          "bytes": 1321,
          "sha256": "1f4efd78f6b45b65f73f09b2f52fc13c2a7c4138dcb7664804878d197b6ebdf9"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sr.msg",
          "bytes": 2087,
          "sha256": "fa00a7b22c9941f6c2b893f22b703dcb159ca2f2e4005fd6a74a632aeb786bfa"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sv.msg",
          "bytes": 1219,
          "sha256": "483916b51bd7e071e88f9ec36aaf3e08fea823991532f832de491c6c40b55a9f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/sw.msg",
          "bytes": 1040,
          "sha256": "1da068c9aa02ef14a2440758c6040d632d96044a20ec501dbb9e40d8592e0e7f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ta_in.msg",
          "bytes": 257,
          "sha256": "4978a193076de56944236f7f1dcecacff739536dfb3dbefc1f7fe2b97a8aeaf4"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/ta.msg",
          "bytes": 1874,
          "sha256": "aefdc4255890d5b3ffe5cee1b457b7d711283c2287aba644155c10956012f6c1"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/te_in.msg",
          "bytes": 419,
          "sha256": "b110feedda21eccefa624bef8e1476e9f221fb253880ac370967ae4d0237ca7a"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/te.msg",
          "bytes": 2149,
          "sha256": "9e96c7123100234a7018533764502985a208f2eb3314f5b6332d46016725a63f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/th.msg",
          "bytes": 2359,
          "sha256": "48beaf693bf5b6eed15234db0d375b97e6d576a749e9048420c153e6cafc0259"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/tr.msg",
          "bytes": 1183,
          "sha256": "4b85b345d6c43f7257c6849a60a492397fd5fd9d82df3a2252189d7a1eccbb64"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/uk.msg",
          "bytes": 2165,
          "sha256": "7093da7e39ceb6d3f51eb6cf1cca2d7f3680ed7b8fe4a5f0ceceef6beb21ac77"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/vi.msg",
          "bytes": 1471,
          "sha256": "e9b7aecd456f1d2288604c982b5ded0dcf71dca968c0b0eaff4ca16cc3b73ec2"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/zh_cn.msg",
          "bytes": 319,
          "sha256": "4c8a855700fefe8ee21b08030ff4159d8011ae50353f063229c42de6292475cf"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/zh_hk.msg",
          "bytes": 780,
          "sha256": "7e1c5bd9ec1a17bb851b0dcabd0dfa9ff9d64b89603d9d3fbeaac609172346ae"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/zh_sg.msg",
          "bytes": 347,
          "sha256": "500546b3211d454659d845b4ab9aef226125100df40407c49530de17cdd4363f"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/zh_tw.msg",
          "bytes": 354,
          "sha256": "dba0584b8e1925b439f06e0bf0965e97afb7eb39e70e0e4c9b70769ebc5f996c"
        },
        {
          "path": "python/tcl/tcl8.6/msgs/zh.msg",
          "bytes": 3385,
          "sha256": "eb247f5184a59414d3df7e3eca51f5998c248cfb27d2c02e62a7a30ab35197a7"
        },
        {
          "path": "python/tcl/tcl8.6/opt0.4/optparse.tcl",
          "bytes": 33777,
          "sha256": "67a157f1873d606b53dc4d894bd8e71f6b1a0dd66177b9513bd039b348b40349"
        },
        {
          "path": "python/tcl/tcl8.6/opt0.4/pkgIndex.tcl",
          "bytes": 620,
          "sha256": "6a4abd2c519a745325c26fb23be7bbf95252d653a24806eb37fd4aa6a6479afe"
        },
        {
          "path": "python/tcl/tcl8.6/package.tcl",
          "bytes": 23995,
          "sha256": "f46ab61cdebe3aa45fa7e61a48930d64a0d0e7e94d04d6bf244f48c36cafe948"
        },
        {
          "path": "python/tcl/tcl8.6/parray.tcl",
          "bytes": 844,
          "sha256": "e269029c8263e3cbc1920c3604ecdcf15edccb208a0d68f9eb42b73954d620c0"
        },
        {
          "path": "python/tcl/tcl8.6/safe.tcl",
          "bytes": 42223,
          "sha256": "c21dce3ab31893118bbed01e559070f1d3541877fee331bd45f5bf4300ed9654"
        },
        {
          "path": "python/tcl/tcl8.6/tclIndex",
          "bytes": 5617,
          "sha256": "ddf7e42def37888ad0a564aa4f8ca95f4eec942cebebfca851d35515104d5c89"
        },
        {
          "path": "python/tcl/tcl8.6/tm.tcl",
          "bytes": 12204,
          "sha256": "4b7ed9fd2363d6876092db3f720cbddf97e72b86b519403539ba96e1c815ed8f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Abidjan",
          "bytes": 147,
          "sha256": "7213997bb9cf9d384a7002b8c8efef25c01aba6083d9835a16d583d5dcee40a0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Accra",
          "bytes": 183,
          "sha256": "6040827afed8cef45f252fbd7e3e862c0b5e9d06c1c98c58bad61dfe67bd57cc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Addis_Ababa",
          "bytes": 189,
          "sha256": "e11fd8ad8572b684333810cfdc23b92e1acf619875866985e288d92f8277d07f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Algiers",
          "bytes": 1080,
          "sha256": "e6874647561ce1c5fd1f650c9b167f77ac5b24fd2026046399a9043cf998e5c4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Asmara",
          "bytes": 184,
          "sha256": "064eb7f9a1fa05a317c6bdca6b102bc1560d980758f9e4ddb010c9e7dc068ecb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Asmera",
          "bytes": 184,
          "sha256": "76939852a98ea7bf156d0ac18b434cc610daf5232322c0fbb066cd52c5b72af7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Bamako",
          "bytes": 184,
          "sha256": "f6d1ba22115a6565b6d6abeb578f001ddb41e673c422c8ea70d0df77b24115f6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Bangui",
          "bytes": 178,
          "sha256": "5047a507d22b68c9349eb6a48c41c80db4c69f98f99c6574059dea87178e36c0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Banjul",
          "bytes": 184,
          "sha256": "77e610a02ccece3045b09d07a9be6100f5aa9c3c2aeb543535c9ae941194f4e4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Bissau",
          "bytes": 176,
          "sha256": "2a870e534de67713c27f2f3b9bf26fa7498c240cf633988ce76dbdac5b69214d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Blantyre",
          "bytes": 183,
          "sha256": "8f700409b8eee33ace5f050414971ffee0270949842e58e9299bb5cd6ccf34de"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Brazzaville",
          "bytes": 183,
          "sha256": "596db2d64cdd6250642cb65514d5bcb52f3e3ea83f50d8915d9d4fdea008f440"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Bujumbura",
          "bytes": 184,
          "sha256": "9a15867255b43a954ca60da11660f157553aab6a15c50acd49d182276e0cf4cc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Cairo",
          "bytes": 3852,
          "sha256": "8698b0a53d858aea7c495edf759ef0e6c63f7e07a256599393dec7b7a7413734"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Casablanca",
          "bytes": 5532,
          "sha256": "8776eedfdfee09c4c833593127cefac9c33e2487ab9bf4bf8c73e5e11b4e5613"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Ceuta",
          "bytes": 7536,
          "sha256": "8827f7311ede69a9679bdf2b7418dbf350a2fc8f973e8b1e1e4390d4d5c6d2e8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Conakry",
          "bytes": 185,
          "sha256": "3176c99fc45337cbce0cd516de4b02b8baa47d00e84f698122a2add57797984e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Dakar",
          "bytes": 183,
          "sha256": "d50f9732757b284bac75526f2cfa585df7f6974160827afb0ff66124c7cfd361"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Dar_es_Salaam",
          "bytes": 191,
          "sha256": "ab69948637416219a3d458777990fa4568bebc89388884bbf129c0e1370a560b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Djibouti",
          "bytes": 186,
          "sha256": "e7f7560ccd65d53c446adae7128a74d37e17dd0b907a2f2fd85322fb8707b497"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Douala",
          "bytes": 178,
          "sha256": "fcf2dad148f4d2951320ea99730c56d5eb43d505f37416be4bad265ce2902706"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/El_Aaiun",
          "bytes": 5235,
          "sha256": "5fb102a95b3c004aab8371840b1a04ac352f48ff9e9eafdeaaf21960b0f3caa6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Freetown",
          "bytes": 186,
          "sha256": "bc53a4d489f48f14c594c4b0e52079b34e043a5751bbc7df254a560352243575"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Gaborone",
          "bytes": 183,
          "sha256": "653af88955c4418d973e2f8681a99552eb7be95bca64c736072f488462f7b373"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Harare",
          "bytes": 181,
          "sha256": "06b82c524585192e0e8fc69dcc1cf86183a8c5ef404645dc413fcf3f8c16b0ab"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Johannesburg",
          "bytes": 309,
          "sha256": "5eef6475e1312051037fcae3354e32dc0910be7a5116b71f8ccbe1cca08d3f1c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Juba",
          "bytes": 1127,
          "sha256": "f2646e15488abf2e960759cefe5705416e71da71bb8407b26196244fd1a3394f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Kampala",
          "bytes": 185,
          "sha256": "8ea3028ce2b025f0c457dc8f7601279ca5af565a88b9fe80208f9f1030f2b0d0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Khartoum",
          "bytes": 1131,
          "sha256": "f475db8a857a46b310b12c21d6a9bc6ca9ff2960da429a9d57fa375f9439e13b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Kigali",
          "bytes": 181,
          "sha256": "73feb807006897b4b485cb82394867444e890265efe960ec66d6c0e325da9372"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Kinshasa",
          "bytes": 180,
          "sha256": "611375c4901ad6c4844c2bb7d02fb17f34996f49e642546a6784d6f0b28530cc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Lagos",
          "bytes": 235,
          "sha256": "dcc9f52f539a67dfd7abafde072acdae2b67754c559c8a5fe61979f5a286a066"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Libreville",
          "bytes": 182,
          "sha256": "ab3e797548c7663cf9aba7fe163635ff7cab9e6cb61fa1644c0f7b4b5cce8b99"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Lome",
          "bytes": 182,
          "sha256": "eaca9124f17e5b11f27d11fa6141d19eb3ac23e155e155b73467bdaa3bc99aa7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Luanda",
          "bytes": 178,
          "sha256": "4c2fd1e44dfaaf0c0dd2eb56b84b538f1e2d84b301ab2cfb8ee7759783501444"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Lubumbashi",
          "bytes": 185,
          "sha256": "24384eec359fd24d181aaef3c017e3c345490a8d352b29d19b1b143a29a811c2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Lusaka",
          "bytes": 181,
          "sha256": "b00801a7279741434d9c2d7ec7322dd93b85ea4f5c9976ab3a43f0ab142e1553"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Malabo",
          "bytes": 178,
          "sha256": "35d56effe9e7e60f17b32bd30486e566b635f0ae7a8948d77395b8e6332e26f1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Maputo",
          "bytes": 149,
          "sha256": "fe6b6a4be1b61f7f909a3f6137530dfe6d1754499a4d9b0d1ce4952fff0ae62d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Maseru",
          "bytes": 199,
          "sha256": "1d80fd86cb733d57d88ecd404e702f750b233ed0ccbfbfffeed1aad3b7f1cb04"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Mbabane",
          "bytes": 200,
          "sha256": "547197c09c1987350ae5720a4eec7e8d8f4b9f4a0559726e225e13c707f7c564"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Mogadishu",
          "bytes": 187,
          "sha256": "25e221be49dec5547a74aeb91b0041859c59bc866987272a447ab2343d1cc30c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Monrovia",
          "bytes": 208,
          "sha256": "2bf0d90610211651127402680519b29ab50b15d344263d0c1a22edebe5e01e27"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Nairobi",
          "bytes": 277,
          "sha256": "bd8e9765174431c0d403249d3e881c949c83966e9f8162552da88ae53132467b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Ndjamena",
          "bytes": 208,
          "sha256": "9ada5f5afb25e823e1f0e8ad2489aaa1c09f01356634a9403670d7ab21ca2e2c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Niamey",
          "bytes": 178,
          "sha256": "b517120ad8db3f21eab4e44a78001ee856eb4ea35852c54cca96d38887debcfa"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Nouakchott",
          "bytes": 188,
          "sha256": "64caf2bf9d45095df97f419714d5617cf6300acdb544b621dce1d594aa9b910c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Ouagadougou",
          "bytes": 189,
          "sha256": "03b9c1fe350b5e9f6f333f9519fa394dcc562308d9388a903af3d3fecebdc762"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Porto-Novo",
          "bytes": 182,
          "sha256": "8fb8692db9281ae2b087d704168bfd47d3d0901781fef65bfd62fcb213ba6b50"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Sao_Tome",
          "bytes": 234,
          "sha256": "ba1d60df2b41320f92a123a714e17e576c89383526b96e0541a464c3fba415b7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Timbuktu",
          "bytes": 186,
          "sha256": "9d8009acab019b32b1e87ab10e0ac3765abcabe8066318da8ca4905d41562f72"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Tripoli",
          "bytes": 954,
          "sha256": "b447b6b1c351e77f22a2d77c0437f2bbb7d8bdfdfdc3d6285e0d260519cc7110"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Tunis",
          "bytes": 1111,
          "sha256": "0760d1028e733888e43e7f1e057217dc2b52786029fcec67b27eb69cc6a54938"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Africa/Windhoek",
          "bytes": 1649,
          "sha256": "dfc3d1fc182b315b31d999bc103c264bd205eb16f971c8636003a71170d7bd7c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Adak",
          "bytes": 8447,
          "sha256": "77231d179260c08690a70aee6c2517e4b621ed4794d9aeea7040539f4ff05111"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Anchorage",
          "bytes": 8685,
          "sha256": "de7fbe2b3ed780c6b82099e1e249dd41f4452a3adb9dd807b1d0ec06049c2302"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Anguilla",
          "bytes": 202,
          "sha256": "f38610019c0a2c18ac71f5aa108b9647d9b5c01dcb55211afb8312308c41fe70"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Antigua",
          "bytes": 201,
          "sha256": "561e58e11dc5a86cae04b5cb40f43efcff9abc0c841fac094619e9c5e0b403f8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Araguaina",
          "bytes": 1782,
          "sha256": "b1327cbec20a21e3ff873e28a2edfa271ee3a5c01933779300eabd6b185da010"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Buenos_Aires",
          "bytes": 2048,
          "sha256": "bc86ac89121ec4aa302f6259ccc97effd7022dc6cee3b291c57da72b6ea0c558"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Catamarca",
          "bytes": 2077,
          "sha256": "a516bb0937977ef949d47b3c8675e30f1ca6c34f8bd298dcf6ebb943580d5317"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/ComodRivadavia",
          "bytes": 242,
          "sha256": "8ccd6fc77d55582938f1912b1ba66035882d1bfc18a797c631e5e89abfbf570b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Cordoba",
          "bytes": 2043,
          "sha256": "fa75e274240a341c6bfe3539cfdc114d125aeaea3161d3c2409347cf8046042a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Jujuy",
          "bytes": 2041,
          "sha256": "43eb79abc03cbac661c563de1bc09d9dd855cbc72dd2b6467ea98f0f90421ba9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/La_Rioja",
          "bytes": 2106,
          "sha256": "2b018b791e48269fa9eda12662ffec3e2dc33603a918e8b735b8d7d6beb3b3aa"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Mendoza",
          "bytes": 2077,
          "sha256": "dc39400bbfd5bdddc174fe099194806fbfd3fc3aa20e670d67be0ac35fe97ad4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Rio_Gallegos",
          "bytes": 2080,
          "sha256": "a05b6708deff0607396bfc6661c2287341c3432841ae353d94a67ac742b5fafa"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Salta",
          "bytes": 2011,
          "sha256": "caefc60f2f36ef9ffe0c5921c3c392de1e95755683a96c1c4ec0ba2c242a4d84"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/San_Juan",
          "bytes": 2106,
          "sha256": "41b2c25e42146a76934b866061bb3245b8ada0ff4e1bfba6f8842a30bdd5c132"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/San_Luis",
          "bytes": 2081,
          "sha256": "a43b35f25e54ef359d046e33281c0a978f0ee8811c93a6809f1f65750878bbb6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Tucuman",
          "bytes": 2105,
          "sha256": "0f7db23e1280fc19a1fb716e09a9699ada2aae24084cad472b4c325cc9783ccf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Argentina/Ushuaia",
          "bytes": 2075,
          "sha256": "10b6ff51314d8ee1d010187d8805c4e3d71b778bc6decb26e66193a5bb3e9ea2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Aruba",
          "bytes": 199,
          "sha256": "7490cd66408b8a14c549278fe67dc3338fe9e458f423f01ccbea00b5e6f6cef6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Asuncion",
          "bytes": 7944,
          "sha256": "eaefe21276ee60c7f876c1d65039999ac069339dcdb82a23fc9206c274510575"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Atikokan",
          "bytes": 187,
          "sha256": "518beb6e54ae811f8c725ea8cc42787d48fc605a3476d6e7a00a1b5733cbd6ac"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Atka",
          "bytes": 177,
          "sha256": "1d6fee336e71fffb64874a830c976867c071ebf6b133c296b32f87e3e7d814c9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Bahia",
          "bytes": 2012,
          "sha256": "64f1ec14f6b43ff10b564f839152e88df9262f0947d1db347557fa902f6fd48c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Bahia_Banderas",
          "bytes": 6847,
          "sha256": "b24ae5fa20f5329644529f660eec8baa3b966f9730af58f1c21e94c02ae17228"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Barbados",
          "bytes": 648,
          "sha256": "fd5e04136506c6543a9acdc890a30bcf0d561148e1063ec857e3913de1eba404"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Belem",
          "bytes": 1031,
          "sha256": "549625ccb30bd0e025bac47668ba3aa0cdd8569e5887e483c8d62b5b7302fa50"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Belize",
          "bytes": 3284,
          "sha256": "e07f45264e28fd5aa54bd48cb701658509829cf989ec9bd79498d070a1ba270f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Blanc-Sablon",
          "bytes": 206,
          "sha256": "facd0a835d1f425cd323ee453ade231810b2d1cf6eba227ba1b50522ae3879f7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Boa_Vista",
          "bytes": 1199,
          "sha256": "10592ea1cb0d02c06a61059ec601f70a706a5053ac923b9eed29388d5e71ef3a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Bogota",
          "bytes": 246,
          "sha256": "b6adc16815dc95e537548ca3572d7f93626a6d1dc390dd4cbabab5ab855bba30"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Boise",
          "bytes": 8605,
          "sha256": "93af910cb2ad2203b71c1ad49d56df4a4a14d07f885afd4e755271f1372a517c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Buenos_Aires",
          "bytes": 239,
          "sha256": "defc5c9da2d4d4146145a50d692a6bff698c3b0a1f19efd82ad0ee7678f39fcf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Cambridge_Bay",
          "bytes": 7739,
          "sha256": "3e0506a54b562dbc3aa6889ddd39b327fe0b85c63b00f0b39d606921a0936a59"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Campo_Grande",
          "bytes": 2918,
          "sha256": "6d5bd1355016b03edea58df98bec26281cd372725b2dcb60b4d748d2fb4346c8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Cancun",
          "bytes": 1412,
          "sha256": "fd6c370f82e5cfe374637e0e222e72570857ac3f85143beeef9c3d0e7a6c0d04"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Caracas",
          "bytes": 284,
          "sha256": "d558c25f165e956e980aa8f554ab3bf24e91b51eadbd2b1065ef6dfda0e2f984"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Catamarca",
          "bytes": 227,
          "sha256": "37cd6bdaa6c6eedfac3288ca1c11f5cbbe8a17e5f2e790e7635a64b867afbd87"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Cayenne",
          "bytes": 185,
          "sha256": "873285f3e13cb68dd28eb109ecad8d260e11a9ff6df6a4e8e0d4c00b0182695b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Cayman",
          "bytes": 185,
          "sha256": "c38c49ae1c3e67bd2118002dcfcc3c0efb6892fb9b0106908a9282c414d0bf2e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Chicago",
          "bytes": 11372,
          "sha256": "c7707af88d650f90839e7258356e39d85228b33b6dbcc5c065c3d8733ae28cee"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Chihuahua",
          "bytes": 6814,
          "sha256": "a816dc1c4c2fb7509a50cb209d748dac27c5f858a2842d7e12b2ec620fea988b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Coral_Harbour",
          "bytes": 192,
          "sha256": "c8cbf5a29cc1d0827390ca6e98b2efcf90743c6dd0eca143b300050dd4164041"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Cordoba",
          "bytes": 219,
          "sha256": "28b84710eadef7ad5e7fa63ef519a9d93996d3bb91dd9018333de3ac4d8fb8dd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Costa_Rica",
          "bytes": 431,
          "sha256": "e3061dc6fa9f869f013351a9fdf420448592d7f959c2b4404093432508146f7e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Creston",
          "bytes": 189,
          "sha256": "a01ddb460420c8765ce8ef7a7d031abd7bdb17cfa548e7c3b8574c388aa21e17"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Cuiaba",
          "bytes": 2912,
          "sha256": "2d8281cf3fd9e859c5206f781e264854fa876cb36562a08c6c01343c65f8a508"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Curacao",
          "bytes": 201,
          "sha256": "accf08cf53c9431e226714df8bede3c91baf62d5bd7b98ca8b50d7258124d129"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Danmarkshavn",
          "bytes": 1128,
          "sha256": "968c56f1d0106e1d92c7b094eef528b6ee1ffa3d7a18be2f2ba59178c2c0f1e0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Dawson",
          "bytes": 2967,
          "sha256": "30e875343c81c8de473e6313a27c55315f38e7ccdbd2cee5783ec54d269d5807"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Dawson_Creek",
          "bytes": 1940,
          "sha256": "540804becdeab92340ef02d32a62bfd550b71a3db8d829be426ee4d210004643"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Denver",
          "bytes": 8920,
          "sha256": "3fe2ee8c05c5d6f268b58bd9fc3e3a845dea257473b29f7b3fb403e917448f3c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Detroit",
          "bytes": 8430,
          "sha256": "84f6897b87d3978d30d35097b78c55434ce55eb65d6e488a391dfc3b3bb5a8fe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Dominica",
          "bytes": 202,
          "sha256": "3da98aa7d3085845779be8ed6c93ccbda92191f17ca67bbf779803e21da2abf3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Edmonton",
          "bytes": 8600,
          "sha256": "026d51d73d30a3710288f440e0c337e44e3a14d0aa2d7b6c6e53af43fc72a90c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Eirunepe",
          "bytes": 1230,
          "sha256": "48fc987e5999ea79f24797e0450fe4dab7cf320dfad7a47a8a1e037077ec42c9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/El_Salvador",
          "bytes": 279,
          "sha256": "c02c6e79398553bd07bea0be4b7f0ebdd8bc821595909cffb49de4290a0d1d0f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Ensenada",
          "bytes": 190,
          "sha256": "3e363bf82545f24cce8cfa6eec97ba6e1c2a7730b2a9ce6c48f784821d308a5d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Fort_Nelson",
          "bytes": 4578,
          "sha256": "ab15023807e7c7d1026c9970d190f1b405d48952464025242c2bb6c6bbb8391a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Fort_Wayne",
          "bytes": 231,
          "sha256": "c8948616262cf6990739343abbbd237e572db49310099e21dd8f9e317f7d11b3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Fortaleza",
          "bytes": 1423,
          "sha256": "c0a836bdaf07f0376b7b0833a0ab3d52ba6e3e1d6f95e247e1ad351cd1096066"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Glace_Bay",
          "bytes": 8372,
          "sha256": "58c207cbd9de7a7bb15e48a62cea9f15da184b945133dee88eff29fd8b66b29e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Godthab",
          "bytes": 180,
          "sha256": "5fb2cfba25ce2f49d4c3911aff8e7e1ff84efc2d01f5783772e88246bfbc56ac"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Goose_Bay",
          "bytes": 10353,
          "sha256": "52d2478289682bf95bfb93d64d679e888c9d23c0f68dfff7e6e34bfc44b3d892"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Grand_Turk",
          "bytes": 7522,
          "sha256": "560b39485ced4c2a0e85a66eb875331e5879104187d92cb7f05c2f635e34ac99"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Grenada",
          "bytes": 201,
          "sha256": "ebed070e8e67c5f12ff6e03fe508be90789f17c793dfe61237b4045b8222580f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Guadeloupe",
          "bytes": 204,
          "sha256": "6cb1930532831d12057fcb484c60db64a60a4f6d8195dafd464826923116a294"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Guatemala",
          "bytes": 399,
          "sha256": "14f6a98d602f3648c816b110f3a0ba375e1ffe8fa06beeab419dc1abfa6edcaf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Guayaquil",
          "bytes": 249,
          "sha256": "6806aa5814bdc679c6ef653c518d2699114be71d973f49c0864f622038dc2048"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Guyana",
          "bytes": 248,
          "sha256": "4078d2e361d04a66f22f652e3810cdf7f630cf89399b47e4ec7b1d32b400fd85"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Halifax",
          "bytes": 11124,
          "sha256": "01e11c7b07925d05e9e1876c310a2b87e0e80ef115d062225212e472b7a964f1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Havana",
          "bytes": 8729,
          "sha256": "96b62bfbf0c05cf970245597c691f89ebf631175796459642a85287f131d0215"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Hermosillo",
          "bytes": 616,
          "sha256": "7391a186f8de1fdd5a61b3887e65dcdb4a2186bfd36bbffb464b63d9775e922a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Indianapolis",
          "bytes": 7230,
          "sha256": "4b114545167326f066ab3a798180896b43ac6fdc3b80d32bcc917b5a4a2359eb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Knox",
          "bytes": 8755,
          "sha256": "f1253f5f3f5aacd1a5e1f4636dd4e083f4b2a8bd995cf3e684cdd384641849f1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Marengo",
          "bytes": 7273,
          "sha256": "675162381639598e7100e90663d42780f8ee1cb62bd6da5b948b494f98c02fe3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Petersburg",
          "bytes": 7611,
          "sha256": "23b8fa75ce0a9555dfd84549723a12679ff7fc5faa58e4b745ba3c547071ff53"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Tell_City",
          "bytes": 7100,
          "sha256": "d368123db703b55244700876906775837d408c274c5a5801d80b77eadb6d5853"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Vevay",
          "bytes": 6563,
          "sha256": "0623233aa39a1a82038a56df255adf49e648777375b8499491c8897ebea1cdf1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Vincennes",
          "bytes": 7226,
          "sha256": "b8452b6aa739a78ac6d03806463b03d4175639593e19faa3ca4b0d0fb77f18c9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indiana/Winamac",
          "bytes": 7410,
          "sha256": "4b293fdb7680c4597b8c885333719214492ecf09bd5ea342d1ec15f2bf9c8605"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Indianapolis",
          "bytes": 233,
          "sha256": "437da148b94dba4cea402169878541db9c3419abab6750d1c36625dd3053019e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Inuvik",
          "bytes": 7638,
          "sha256": "5a1f7f5edad0251b73c33e7b5ddee194646e9d3992b169dc1a64d155765d472c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Iqaluit",
          "bytes": 7671,
          "sha256": "afc4627879f4a618f5e3ba9ea123f3212e161f4ccfd0df46f3b6b7cd2e2c0d7e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Jamaica",
          "bytes": 847,
          "sha256": "4b9d5177cba057cd53d53120a49b8a47eccb00150018581a84851e9d5437d643"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Jujuy",
          "bytes": 211,
          "sha256": "4a0495852cd4d0652b82fb57024645916db8f192eef9a82afd580d87f4d496ed"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Juneau",
          "bytes": 8682,
          "sha256": "5fbe6a1fa2d3dfe23c7378e425f32bebca44735da25ea075a7e5ce24bfd4049d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Kentucky/Louisville",
          "bytes": 9553,
          "sha256": "9eb1f2b19c44a55d6cc9fd1465baf6535856941c067831e4b5e0494665014bf5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Kentucky/Monticello",
          "bytes": 8558,
          "sha256": "1c6c7fb0ae628eb6bb305b51859c4e5594a6b0876c386ed9c1c3355e7cb37ae1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Knox_IN",
          "bytes": 204,
          "sha256": "d66e77e6ff789d4d6ca13cdb204b977e1fe64be9afee7b41f2c17ed8217fd025"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Kralendijk",
          "bytes": 204,
          "sha256": "5af9b28c48661fdc81762d249b716ba077f0a40ecf431d34a893bb7eaba57965"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/La_Paz",
          "bytes": 218,
          "sha256": "5488d98aa3c29d710c6af92c42ace36550a5bff78c155cdf8769ee31f71cf033"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Lima",
          "bytes": 460,
          "sha256": "6e01002f264df9a6fc247f95399f4f42dccc7ab890b0c259de93dcc97dec89ce"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Los_Angeles",
          "bytes": 9726,
          "sha256": "da3f7572f04e6ae78b8f044761e6f48d37ee259a9c1fe15a67072cc64a299fdb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Louisville",
          "bytes": 228,
          "sha256": "f85c1253f4c1d3e85757d3dea4fd3c61f1aa7be6baae8cb8579278412905acb2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Lower_Princes",
          "bytes": 207,
          "sha256": "1e786229b84ce86db6316b24c85f7cf4cfe66011f973053ad0e108bfcc9a9de2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Maceio",
          "bytes": 1539,
          "sha256": "f65c5957d434a87324aad35991e7666e426a20c40432540d9a3cb1eee9141761"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Managua",
          "bytes": 611,
          "sha256": "f0f0cce8de92d848a62b56ef48e01d763b80153c077230c435d464cf1733ba38"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Manaus",
          "bytes": 1166,
          "sha256": "dc54e6d4fe14458b0462fa0e15b960fd4290930adc0d13453bf49b436ed8c143"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Marigot",
          "bytes": 201,
          "sha256": "5c26d7ce93f91cc4f5ed87e9388b1b180ef9d84681044fd23cc01a628a1284ca"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Martinique",
          "bytes": 251,
          "sha256": "d411fb42798e93b106275ec0e054f8f3c4e9fb49431c656448739c7f20c46ede"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Matamoros",
          "bytes": 6745,
          "sha256": "6738b94878d0cf4d88206858aba03d18b0a2de71d8f051b7d19c2c367dd59d79"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Mazatlan",
          "bytes": 6841,
          "sha256": "f1e4e853758a3d79013d5b24ae45fdfd41a7c110949a5c5db96cf14b479fa741"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Mendoza",
          "bytes": 219,
          "sha256": "d6b308a1619f2de450dacbfef0e11b237df7375a80c90899dd02b827688cb4b8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Menominee",
          "bytes": 8410,
          "sha256": "b0863f8b66f0848020651b69e7997307d62209259ae653fdc1a0fafc8e793068"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Merida",
          "bytes": 6651,
          "sha256": "2b4facfc69a195c646842a8b47afe76d755ceedad536dee7ece79302baf97223"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Metlakatla",
          "bytes": 6705,
          "sha256": "2574831391092ad44d7b2806eef30d59ce3bae872111917dd39ec51efdd62e5f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Mexico_City",
          "bytes": 7035,
          "sha256": "3458eaf721c1cdf565b5addb487b4f1b93fa46744e9e5fc91d74787173b233a4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Miquelon",
          "bytes": 7080,
          "sha256": "1b131ac968f95652667bd7eb1f6d667c8f679b31270d82b4b4271e787386ccca"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Moncton",
          "bytes": 10507,
          "sha256": "d977d045de5cdaeb41189b91963e03ef845ca4b45e496649b4cb541ee1b5dd22"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Monterrey",
          "bytes": 6714,
          "sha256": "63813975bc90a2ae8a6500d7a3173a3c81c060f8b5aaa3e86d5fdc4d5f06abd8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Montevideo",
          "bytes": 2936,
          "sha256": "214f97a3bcb2378cce23d280ea6a3b691604f82e383628f666be585bb8494932"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Montreal",
          "bytes": 190,
          "sha256": "97f48948ef5108fe1f42d548ea47c88d4b51bf1896ee92634c7ed55555b06dbd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Montserrat",
          "bytes": 204,
          "sha256": "6c3ee46983a3daa91c9adf4b18d6b4b80f1505b0057569b66d5b465d4c09b9c1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Nassau",
          "bytes": 188,
          "sha256": "a889810b8bb42cd206d8f8961164ad03ccfbb1924d583075489f78afa10eaf67"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/New_York",
          "bytes": 11373,
          "sha256": "7ba7da179aa7df26ac25e7accd9bd83784174445285a0d9ccbd7d6a9aa34f4bc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Nipigon",
          "bytes": 8100,
          "sha256": "bb4ba3c15c626f6f94ac026a7c3d5dfe3854b17cbfa3f540ffaffd9d5b491083"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Nome",
          "bytes": 8680,
          "sha256": "8e971c9560cce548b46626d072e62ab0f4c9682bf6a6abfb4d0e8d63745402fe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Noronha",
          "bytes": 1397,
          "sha256": "9011c76295e6b17cc1973876b497bee21b9e6562fb25df66140f811a1ffa9765"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/North_Dakota/Beulah",
          "bytes": 8557,
          "sha256": "d0d8b108453265b60f525a4ec04de9555087cd6ac5ddba980b3a96cf0fcd68d1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/North_Dakota/Center",
          "bytes": 8557,
          "sha256": "abc2b6c97d9e9fba37ac582adba2ce996890d090060e083405d75cdaed9eabe0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/North_Dakota/New_Salem",
          "bytes": 8560,
          "sha256": "8803ff7c81c933b57178b9d3c502fb4268d9aa594a3c638a7f17af60b12d300d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Nuuk",
          "bytes": 7429,
          "sha256": "12917daaa60134bfe56e6979bb27b58a3f295c32bae02b233e849bced6b8bca2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Ojinaga",
          "bytes": 6843,
          "sha256": "549e92bdec98d21c5c4a996f954671a2f0262463415bf294d122500246309bc4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Panama",
          "bytes": 186,
          "sha256": "990213dde00adceb74c8d1ecaf81b9c77963e4ab1f35767f7349236fc8e917df"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Pangnirtung",
          "bytes": 7736,
          "sha256": "1fb962ecc1e5f02e1001c70460fff720b114554f9aa7956d6da154dbea87b4d7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Paramaribo",
          "bytes": 253,
          "sha256": "b3ee44b3526bedfc25b806371d3c465fdbd6cc647f30bf093750651e4a0c1be4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Phoenix",
          "bytes": 496,
          "sha256": "dfa0ec91804b789a1a7e1b1977710435d2589a5b54c1579c8e1f5bf96d2fd007"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Port_of_Spain",
          "bytes": 207,
          "sha256": "a4952380c89a6903ffe5bf8707b94b1bb72568ffd03db04bf4d98e38ac82eeb7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Port-au-Prince",
          "bytes": 6613,
          "sha256": "a89c580899ad2ff8df45a783bb90d501dc32c28b92931ca18abd13453e76244b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Porto_Acre",
          "bytes": 201,
          "sha256": "52921eea2a1925df06cea4638ed4128faaa8fba40ed4e0741650b419e5152dcb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Porto_Velho",
          "bytes": 1051,
          "sha256": "e6e6f6753e7d443052a64d4db07b8d443ce13a573946e7d0a19cdd4bba4a2f04"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Puerto_Rico",
          "bytes": 283,
          "sha256": "2981248a9f14ebfc8791ec5453170376cbd549557e495ea0e331cc18556c958e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Punta_Arenas",
          "bytes": 3698,
          "sha256": "22418567d55a0e38cab005665271d9279a384856fdf0ce5a9aeabdcd66ccbc72"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Rainy_River",
          "bytes": 8104,
          "sha256": "b1630fa919d652f30d23253e1c561bb76fb4d28844a2f614d08b0a25b17cfb27"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Rankin_Inlet",
          "bytes": 7614,
          "sha256": "aa8866d58beab07548180628ff423887bbf48aadb1b55392b288f7310f94a9b1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Recife",
          "bytes": 1420,
          "sha256": "a36ad4614fc9a2a433712b555156ede03980b88eb91d8dc7e8b10451d6d7f7d3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Regina",
          "bytes": 1781,
          "sha256": "50105e788288cf4c680b29bbdcde94d8713a5361b38c6c469fd97cf05503ff7d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Resolute",
          "bytes": 7610,
          "sha256": "643cc43e3f906779c040e1f0c20e78d6e95cc7301b3c7370a8adbcbd76a8c5e8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Rio_Branco",
          "bytes": 1112,
          "sha256": "28082d20872b61d6098d31d1c40f12464a946a933cd9af74475c5af384210890"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Rosario",
          "bytes": 219,
          "sha256": "0117d33d4f326aa536162d36a02439fbd5f2eb3b4f540b5ba91ed7747ddac180"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Santa_Isabel",
          "bytes": 194,
          "sha256": "3b4c2f3a5b9cd22a73f05187c032723d07bb53c9946d04d35e1ba1cb90ca0a62"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Santarem",
          "bytes": 1079,
          "sha256": "4a397bd937de1d7e6a941d18001b34d4cd195aefd08951c30c7ee8e48656aa0e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Santiago",
          "bytes": 8871,
          "sha256": "b2d7fd4db34800c9ef9bd73cddb1105543cced05f3e2ac99f3e5e2f6cf340ae2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Santo_Domingo",
          "bytes": 616,
          "sha256": "2217e72b11a90f2d679c175de3cc0f2fed4c280c9ff9707cffaf118bf9a06a4b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Sao_Paulo",
          "bytes": 2900,
          "sha256": "0e7ba1c5a3fa3dabdaa226bfe1e8d797a3835ea554828881ab5e365eda09b92e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Scoresbysund",
          "bytes": 6839,
          "sha256": "158bd9e4eb0b9dff3f2d3e2dba72f217b73423012dd33a688fd57852124e884a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Shiprock",
          "bytes": 187,
          "sha256": "bf4fab3ae72cc7fa4f9e34cf0551a85c54a084cd826df5d9cc684de6188e84db"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Sitka",
          "bytes": 8651,
          "sha256": "abb08435cae80119068a85984bffe9c1596f4fb90f07cc01124c907e5162c189"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/St_Barthelemy",
          "bytes": 207,
          "sha256": "353cdbd46ba8c7472a93e9e800a69105801f6784b22ec50a59294cdc3be40e18"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/St_Johns",
          "bytes": 11289,
          "sha256": "e2917204b0c843c32051bb371cf6d0ad272c02720b9c0d913ac072c8abe1ec64"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/St_Kitts",
          "bytes": 202,
          "sha256": "edb9457a7c64e47062bdc6458fd3bcfcd6c37820f1a2bc89dfe99ed77355011f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/St_Lucia",
          "bytes": 202,
          "sha256": "6727a509bb937cb3446d41b57826de70c7028e96f088ab5b7f803beaa18279e8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/St_Thomas",
          "bytes": 203,
          "sha256": "974aeed3d79124b50265c83d84f23cbe4f0328d00c75f42dd3abc5d4c0a78de1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/St_Vincent",
          "bytes": 204,
          "sha256": "6b19404d295964ef66f47802836bb728fce8e6481115797c0b5f200c354d7c8a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Swift_Current",
          "bytes": 874,
          "sha256": "939b25c9412b9e25d73f552e87826999fc8c929770e66491d1e4530046d3e758"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Tegucigalpa",
          "bytes": 341,
          "sha256": "1f0503579b0dddbaf88814a278127d9cd7019edd3c35f4cbfc0ef11c0edafe5b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Thule",
          "bytes": 6890,
          "sha256": "7fb0cbb101d3b6fbb6b9dad5446bbf9e6aec65ec38472739e604f68f6aa9ab7b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Thunder_Bay",
          "bytes": 8330,
          "sha256": "0f95ce0a36415b43e7b5e6cd790d3bd9ef6d53f4b7aa0235360c0847cbb3f0c1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Tijuana",
          "bytes": 8755,
          "sha256": "fe3681f580ed7f3f2fd21f510dff1bef81bd521737f5846fa15fd309e44e69be"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Toronto",
          "bytes": 11248,
          "sha256": "5a98c6bedda4df608051d702a8e037093a8068e1b85f8f55d42b4468f45662a5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Tortola",
          "bytes": 201,
          "sha256": "46a236ec38f3a122d414208328a462b2a937392ecc6c55f673fb7a402f118d96"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Vancouver",
          "bytes": 9815,
          "sha256": "00b5fb8f37dff43925c501aeab039f39f058e002572c4203286317046cc1d700"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Virgin",
          "bytes": 200,
          "sha256": "561d9d04b0ce0f96a9c351c7d5c30aa1d5a42a3d70066cd9af0da6cbc5388dbe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Whitehorse",
          "bytes": 2971,
          "sha256": "8e0bc71bd7146145dde3c064ae205df08124fe2402853a9655b0eb799e90f31f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Winnipeg",
          "bytes": 9695,
          "sha256": "f3fc5f6d93d1d9eb0f3ded33873f33c47f841797d96439966f8e0a5a189941fa"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Yakutat",
          "bytes": 8683,
          "sha256": "79b44f245d86a4ec299d1a9a2edb2ab92d50ab5a7c1c03759d283ac4070f9005"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/America/Yellowknife",
          "bytes": 7737,
          "sha256": "b33838f12640c64ba4f10f50657ec4d8d5b30fd226da4aca21b169b53ad30576"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Casey",
          "bytes": 478,
          "sha256": "04247acb2b4fa126d13f4573ff74d15a89cf42b2c5cd7e688d5bb1c1fd3972bf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Davis",
          "bytes": 324,
          "sha256": "2f36d2e13d7e251322b7a7b30f39645393525ceb49a2b5c26f27797f2aaf4d7f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/DumontDUrville",
          "bytes": 214,
          "sha256": "96f2ab9a9ffcd10598fdf105f68460cc4b4ebc1f18054d1bc8e39df6ad24d1ac"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Macquarie",
          "bytes": 8447,
          "sha256": "c4ea7f1c0b5a0fae653419f1c6d058bddd745a3cdba11900005c157df23ddc01"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Mawson",
          "bytes": 180,
          "sha256": "aca533b8bc82296373edec82f6e0aa45a34d817c7c18ff5e8e94b81c0bd30259"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/McMurdo",
          "bytes": 195,
          "sha256": "e9d99293c5b275d8e0d7b066084177edf670d5b52b81e87608bab02025f33155"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Palmer",
          "bytes": 2613,
          "sha256": "1637381a20e9d5c6a530f110bdb08d9515e675c9206f000407d8511074948e61"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Rothera",
          "bytes": 151,
          "sha256": "943f10d8e836773f0b7acd13ed8422c0b27813c7bbe0b09b57697d1d70d21ece"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/South_Pole",
          "bytes": 198,
          "sha256": "88057832175bb642b23fc99f788a2f78a24005cf1f84a7b1b5e8c84fb8f4d4c1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Syowa",
          "bytes": 178,
          "sha256": "2488805de4fea42305689f679f1ae2d80b1e934e657fea329ad39a82dac63022"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Troll",
          "bytes": 5370,
          "sha256": "6fd5ab8b7b308cdcea4b747a81d8675988ae218813c91714fc4ca97919cebea5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Antarctica/Vostok",
          "bytes": 150,
          "sha256": "1efdae8a23ba4ee37e7992f3c9dcada6c2e95af82a955a4c6597e7295c950855"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Arctic/Longyearbyen",
          "bytes": 181,
          "sha256": "944a38702a5176a082755897f1e4b1c88d5721cb499245e2fe51d2cfd849a23f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Aden",
          "bytes": 171,
          "sha256": "8fcddb246932baed880b70c0ca867057e7989aea55eddc174430e1055cd1058d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Almaty",
          "bytes": 1637,
          "sha256": "06dc608c0b8cdd69cce66a6bf86f141c46df39cb45312e684e46f19ed8caff15"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Amman",
          "bytes": 7301,
          "sha256": "aa5e87c065e5aa4516f1aa50e1840ee22683d3b4c25a4e00ca92c53f96c6d062"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Anadyr",
          "bytes": 2086,
          "sha256": "d9df64fda4638f7604624b0f68a885d5abadb1de12af1af5581c2af7dd971562"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Aqtau",
          "bytes": 1665,
          "sha256": "96b510af9b8c6bc1dfa84e9ed5e072f3fd484eeb66bbebc7b6826ed859ed9027"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Aqtobe",
          "bytes": 1666,
          "sha256": "991638fa2ab2a2f7a091a23d78d99306ee73a740f1a03fbac448edcab55a0e38"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ashgabat",
          "bytes": 878,
          "sha256": "13745bfa25e6e2d8d0fabae42cb7c37cf9f974cfb343d4fe84e4e2d64a25926b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ashkhabad",
          "bytes": 182,
          "sha256": "2c752f641b98e3c05b14ae31330d1f198daa4a7e354ba9670c7754926bfb891a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Atyrau",
          "bytes": 1666,
          "sha256": "4b7b118e6ae72d41740cf0cb2bd8e970700758dcbc0dd6f298199d841df8408e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Baghdad",
          "bytes": 1702,
          "sha256": "d20b75d2604c3b742c1629c5ee02cff6783e472249982b272b68f2a6de9bdc38"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Bahrain",
          "bytes": 171,
          "sha256": "3d437037fbf2bbdf969c8e71967080947f24860d431b39f5d8f23151316abcd5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Baku",
          "bytes": 2149,
          "sha256": "873e8f08b87610d0dafe239d32345248a4595c6b13d1da83ec214d78e88fa12c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Bangkok",
          "bytes": 181,
          "sha256": "6e72ba908f250fd45d554a12e3e7b3bd2f1c02a6c2431f806fd2a054f843aa90"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Barnaul",
          "bytes": 2117,
          "sha256": "992f93a7975f8cd4e94d96b3ba1ecfb3585e52a53f4442a15993402d3f955f66"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Beirut",
          "bytes": 8024,
          "sha256": "17af14646d562afe17dccfd1d2fba95c122f3e0263906a36eb48bff04acf233e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Bishkek",
          "bytes": 1669,
          "sha256": "1d5e9a8f6a04273af741f648ef10718b004a60d7884fe432ddf85a8f558bea98"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Brunei",
          "bytes": 182,
          "sha256": "a4216b59f2478de7e88a99e2b11bbbd93070477d7e62bfd453d1ca430ebb4834"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Calcutta",
          "bytes": 178,
          "sha256": "1baef7850111d2c33b2a766a8ae804534aba1711bf80a4087a89656ddd8469d5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Chita",
          "bytes": 2086,
          "sha256": "10b6f435b05d887176a4d90ca5ac957f327f62f36f15d6f6e4f81844662429b9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Choibalsan",
          "bytes": 1619,
          "sha256": "94b2c14ef45c695ef6b19d94722e1bcbb629a595f2866dba80f00a66721040b5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Chongqing",
          "bytes": 182,
          "sha256": "a87382dc5f3c3141547a65e3746af1daf94b51468b96da6cef30e95754c97d37"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Chungking",
          "bytes": 182,
          "sha256": "d6d2b4a761c547f1f853ae901ac71ab49fbe825037079c4e0c89dc940ae4a822"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Colombo",
          "bytes": 369,
          "sha256": "e5b5e6d607a15da65cb00c92c35a63eaf25f547e64cb34bb419cb8cfc2714b1b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Dacca",
          "bytes": 169,
          "sha256": "b3ad560f66ea330e54a147017e6e6ab64452a5255d097b962d540836d7b19ee7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Damascus",
          "bytes": 8311,
          "sha256": "7d44f4c16e862752d399999b9f0b1e4e8ed5d80c1322a980094801dd8a4a03eb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Dhaka",
          "bytes": 364,
          "sha256": "bfc4562055cc4355e79f9efaa580a4c6a658285916159a5d390a0cda96a97e98"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Dili",
          "bytes": 235,
          "sha256": "8bc2e0d77ac35b6d63e11b820ac45ec23a4195ed773680c600c772fdf4b953f8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Dubai",
          "bytes": 148,
          "sha256": "3db174f1568bc23bf467a3dc7baf8a2a2952b70653d4de54f4db391ec50b6925"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Dushanbe",
          "bytes": 820,
          "sha256": "550db44595f59d0f151be4af70d6fece20580ab687ef45de2a0a75fb2515ac80"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Famagusta",
          "bytes": 7597,
          "sha256": "8cfe85c48fc22033411432f8b75ee4c097a5d84897698cb1afd5ab51c47ff5a3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Gaza",
          "bytes": 8427,
          "sha256": "f030e2b3dbca556c36602fbf234c7db7d4f222d02cfab192288e91e6a1bf3c90"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Harbin",
          "bytes": 179,
          "sha256": "12811a7944b892e3d1c0b4b09057cc1899f28081b3cd47ffd248ba49ba308af0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Hebron",
          "bytes": 8402,
          "sha256": "2c126ba5f78cf7a13fbdfe00f647bb29e2ac104b89ab51b39281047d9b2e45a7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ho_Chi_Minh",
          "bytes": 395,
          "sha256": "fe977368691f4fa43d068cd8d989f39d2aec46d199d7d629b8dd3ecf7423a335"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Hong_Kong",
          "bytes": 2226,
          "sha256": "ee9a6997bc1aad4a8fa95db312774c3f37fbb895549230c30fc66c02cc170eb6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Hovd",
          "bytes": 1583,
          "sha256": "ca88a45e954a9854c680b399e69e4858bf5e861fabfadc19d62d97b734b25415"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Irkutsk",
          "bytes": 2089,
          "sha256": "61baaad6315ffbdaed6f266880165b06eccaf72f660b7fb01c8b654f3952d68e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Istanbul",
          "bytes": 187,
          "sha256": "1f77c4bd27574e1d2066885def01806a02d3e444424a219a8ec5c114f89665e5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Jakarta",
          "bytes": 370,
          "sha256": "2f39d9f93761b85c254f458317a7de2b4184be9459f2193a85c08662e801269a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Jayapura",
          "bytes": 213,
          "sha256": "761c1e80febf46d6d6215cebf211f121974156d9bce2fb4258c1074c6ed2ce22"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Jerusalem",
          "bytes": 8135,
          "sha256": "0bdc2c693134199c2ecd374cc01468813db29df47422c706a3ea2be5ecca177a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kabul",
          "bytes": 180,
          "sha256": "a59c95c038f2e945d685d96fa9b859ce82a643a1b7f56eb36b2c809de91cd4ba"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kamchatka",
          "bytes": 2060,
          "sha256": "6e0278e389072437bc07a5032cd58e9e5b1b2bdb20918632c422efa97bc43abf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Karachi",
          "bytes": 457,
          "sha256": "4e7f7acae8b4018a835328744f680c8054771805bb0bb07678a09737963c090d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kashgar",
          "bytes": 174,
          "sha256": "7b2251f0a41cbadf45d69f24604834167b14d8d33b510e635719ab404cabbce2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kathmandu",
          "bytes": 185,
          "sha256": "f0a0816e62036637f75081cbf17a1e6b8fbc2d86aec3cd2e234bbbdd6ec9f109"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Katmandu",
          "bytes": 184,
          "sha256": "9acc9586b6f8b53bfe8b242283a434a9a9633d60559ebfdee263b4c8915d50ca"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Khandyga",
          "bytes": 2119,
          "sha256": "33203d7fb7f3d1f848640ece0642a2305e1863b4d47413075e2e7e40bd7418e7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kolkata",
          "bytes": 336,
          "sha256": "6d464564ed2efc9dada1586d4fc99fe333726d2be15a00e30c2391f588896463"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Krasnoyarsk",
          "bytes": 2062,
          "sha256": "53b8d5e7fb1bd67fece66a933d9bdbb773f14a8c04d316a2a1b00ec6dbc151dd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kuala_Lumpur",
          "bytes": 375,
          "sha256": "25a8328b309b68da85c7a800086a1e4d3c62b96ad97fef24fc429a14c50e762b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kuching",
          "bytes": 669,
          "sha256": "6e35e560675b0b5322474900d4ec8326c504788c1f82e533b09785deeff092df"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Kuwait",
          "bytes": 173,
          "sha256": "8e0c60a9aa64fb8602edc35311f7436b04853970a21c1f6c871494a09aad5787"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Macao",
          "bytes": 169,
          "sha256": "4308d741c83b263c7c9fb8ec692a7b7b502135e407b265b12ea7ef92523455c0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Macau",
          "bytes": 2217,
          "sha256": "fbcb92cecb1cb0bc284adc30d70c5f57b3afc992136a0d898abc64490bb700fb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Magadan",
          "bytes": 2088,
          "sha256": "0c6eeeb7975a95c2b0678d137e6a735238d244a37fa11078050051511de499fe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Makassar",
          "bytes": 243,
          "sha256": "30d8ab00e32ece51442c0310e650d89d6989e0809600ee334cb10c506d84bf9d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Manila",
          "bytes": 421,
          "sha256": "070d61a0e39643a700aba89a8a4be5733ba456958966098405e11ecdfa854d76"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Muscat",
          "bytes": 170,
          "sha256": "011b7de1c9f7ec241b224bc864d8ae66acb433fbc8ad939e4dbeb12be6390243"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Nicosia",
          "bytes": 7625,
          "sha256": "3c3e4844c70d361893ef022d6c3c8e38b243e91d40c5a726c924355476816f25"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Novokuznetsk",
          "bytes": 2063,
          "sha256": "96a445d47d834c28480d1e2036eca4962b35afa494c219065d4879f71c1830db"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Novosibirsk",
          "bytes": 2121,
          "sha256": "ef799077291f6b3b19e0aec88f224bb592faad09d30740f2376d3d20f2169639"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Omsk",
          "bytes": 2055,
          "sha256": "2605cd1e26e4ab48bcb4399bb5b17bad115a47f87ba3dd54b55bb50c3fe82606"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Oral",
          "bytes": 1664,
          "sha256": "933bbcd7ae0bf59a5b4a6e0ef74c237feedc42e6a3aeb2158131aa70fba6fe47"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Phnom_Penh",
          "bytes": 180,
          "sha256": "dcee88876d00396918f43deca421b6c9b02f84b5866a2ce16e641b814b390a9f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Pontianak",
          "bytes": 369,
          "sha256": "ac8370aedf5fe3fe1e80710ce117dee23815be377d418e4b4f3259a1930e8dbf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Pyongyang",
          "bytes": 273,
          "sha256": "29ba17f756f5c0bba30febf44e620504d04921c832bd1cb56e1b60ef288b57df"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Qatar",
          "bytes": 176,
          "sha256": "18cca69f933795ce3f7db31506efc063e6ce1dfdcab32aa387c398456d7f7e1f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Qostanay",
          "bytes": 1668,
          "sha256": "4191629b874c988291e8fd13e675a3ed685d677f6541313975fc4610e47f1dcd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Qyzylorda",
          "bytes": 1670,
          "sha256": "cd6b067aa3ef6935b4e89ca36e6a03fcb97f1e0ee61a7b5d46c06bf4de140774"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Rangoon",
          "bytes": 174,
          "sha256": "e4d2c38d8e7377a528291a88129cdac40ca4d40a5f1cd8adb98228527556906e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Riyadh",
          "bytes": 148,
          "sha256": "411e31d09ffa48e44169c42661ae2f7fc142460bcaa216837d8c4740983ca7bd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Saigon",
          "bytes": 188,
          "sha256": "c695981a0df691c3f4509999fbc52858adc75024cccbdefbe1094fed17e809e4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Sakhalin",
          "bytes": 2117,
          "sha256": "d7d0ea5cef908442ab0d777a4b097bed18540cd5280ff63f33dd989e27e72908"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Samarkand",
          "bytes": 879,
          "sha256": "35e4b905723891281d9a6a0a1fd3760a3a48136e1419c686be31ace83bf7aa9d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Seoul",
          "bytes": 985,
          "sha256": "c4f82c94650572fe4d03bc1fe54ced8f4bf55dfbee855d52de3ea6378240af93"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Shanghai",
          "bytes": 981,
          "sha256": "3aabb42d9efe95d906b7f34640e7815919a1a20979ebb6ec1527fcaa3b09b22a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Singapore",
          "bytes": 372,
          "sha256": "05c76b58a4e356fd358e24fbc71fae98dcb18c441c8d8cbb13a18d4f6e406062"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Srednekolymsk",
          "bytes": 2064,
          "sha256": "705d6d8360c2dcd51e909e39e1910fe876145220d151031612da36b247207395"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Taipei",
          "bytes": 1344,
          "sha256": "389c9d3ee2970665d0d8c5cb61b8b790c5fbddc0df0bf2b9753046f5953a477f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Tashkent",
          "bytes": 878,
          "sha256": "4445f3f892c7267a6867009cc1a3f0b0548d0240408375a9d15360b28993c2a9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Tbilisi",
          "bytes": 1729,
          "sha256": "b637bb0e49144c717e99e93540cb2c4d3695d63b91fe42547f2f0aa006498693"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Tehran",
          "bytes": 7250,
          "sha256": "a78655218a749f4abca436be818e84d3277220ff3e69be20a786aadf8ac744f9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Tel_Aviv",
          "bytes": 184,
          "sha256": "07537a30e6236d9e334dafd5c4d352d25fdef95d6dc7496f5d93efab74d9ebb1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Thimbu",
          "bytes": 176,
          "sha256": "37459c17b59639df62b3f3943751902ce6aaf1f11b7630069db45052ebefb5b9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Thimphu",
          "bytes": 180,
          "sha256": "b797c74e3840298c3cd8149fc8aa4bce839efe79e7c3310986ff23c965607929"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Tokyo",
          "bytes": 388,
          "sha256": "3da522fa88541a375d53f30a0b62dc4a305fa0315fee534b7998c9e0a239450a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Tomsk",
          "bytes": 2116,
          "sha256": "6b64a01d0f0b5ec7a1410c3bd6883ba7cc133e9f073d40e8bfece037e3a3fa24"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ujung_Pandang",
          "bytes": 186,
          "sha256": "732751845acedbffd3c6170f4b94cb20b25bfdcfcc5eea19f4be439f5c5b573a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ulaanbaatar",
          "bytes": 1590,
          "sha256": "a56a26981163a717cf388a423cfe7a2bad1be8652be2e338670cbc0c0a70e5e9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ulan_Bator",
          "bytes": 192,
          "sha256": "d17fdaf17b3dac3a1310e2332f61585598185e64ced799abd68249eb5b698591"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Urumqi",
          "bytes": 149,
          "sha256": "c445b8030deddded0aff5cc692cc323b63be8c14bbd42dc3fde90ad4f9d14785"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Ust-Nera",
          "bytes": 2058,
          "sha256": "9d639c0fc69b3beebc96969092f9590eb48e7946e901b225bf245e165973b9a8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Vientiane",
          "bytes": 179,
          "sha256": "18f5e4fe8247f676278ac5f1912ac401dc48df5b756d22e76ff1cfa702f88da7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Vladivostok",
          "bytes": 2062,
          "sha256": "2558c96e25359c72f168dac6fb3c16c54f8fd7d0724eeb1671156d4a1f42ac6c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Yakutsk",
          "bytes": 2058,
          "sha256": "3bef13638c46f16435d326c675907e61bb68c8173153ced3359e983be0e413e5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Yangon",
          "bytes": 244,
          "sha256": "2526557810747e78e713ae09bc305621a80faeecf8d441632e7825738d4c79cb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Yekaterinburg",
          "bytes": 2095,
          "sha256": "2c78699efc60758b8f8d0d1deedfded5e65c65ebf3082b23e60bdea8bf8fbcfe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Asia/Yerevan",
          "bytes": 2029,
          "sha256": "20871fa6aa959ddfb73d846271b4a568627b564cfc08a11bdd84b98c2f2019a3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Azores",
          "bytes": 9879,
          "sha256": "6b3609be4e93d21a2ab492594edd387931e2c787e8471c9f2d3a677f34002d8f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Bermuda",
          "bytes": 8784,
          "sha256": "099c3befba3b4c00ae19bc53d475a52b32fac9b36ec823c8eaefc7d00f78f388"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Canary",
          "bytes": 6856,
          "sha256": "2026944dcdebc52f64405e35119f4cf97ea9aa1e769498730880b03f29a2b885"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Cape_Verde",
          "bytes": 246,
          "sha256": "2ea59acdb5bbdd3c6abceea456838a5ca57371a3d2bb93604b37f998ed8b9d4d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Faeroe",
          "bytes": 186,
          "sha256": "64fb8cad17cd36666c7027aad01344fef659b13699eef1942365842f8ed2170e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Faroe",
          "bytes": 6796,
          "sha256": "795f438e7f01342d5f25eccdd09fce65c03c5d2d561b9b5191301d57ec16b850"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Jan_Mayen",
          "bytes": 180,
          "sha256": "9152d10450cebce4aaea3f3c8a50e4077a881e0b06b193a5886f06a453803112"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Madeira",
          "bytes": 9709,
          "sha256": "b2a0d0ddc26806a05b2be806ca3f938db12a3fa40110b8b21fd3f04efed3a531"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Reykjavik",
          "bytes": 2035,
          "sha256": "e77b9d50af6c2550ca0517b4a6de64a8a159ad0c77f1294c4212b6e20221b099"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/South_Georgia",
          "bytes": 160,
          "sha256": "51bfabcb3388107753a3c1a8cf31118e6627132baa09b9878d9e7cedbebb4886"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/St_Helena",
          "bytes": 189,
          "sha256": "1c9ca8966fc8bd0be70f4a187e17e56fb99139bc88c392e82ba2e23e23111c54"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Atlantic/Stanley",
          "bytes": 2256,
          "sha256": "f0e99ef01f140cd5aafe16803a657922207e6f7f6af10b0ae795790916c302c4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/ACT",
          "bytes": 190,
          "sha256": "df7cbddcbb2f5926a07d19a35739e5b8dcd9733c037f7d1ff95753c28d574674"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Adelaide",
          "bytes": 8372,
          "sha256": "5c43d3152982bcfd5b9f51d0e909cf3a558bed1c270feffe030531d38d6f91b7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Brisbane",
          "bytes": 674,
          "sha256": "0d3c39edab34a8db31a658a1549772f7d69eb57565e40aa87b707953a2d854a4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Broken_Hill",
          "bytes": 8437,
          "sha256": "734f295bd0b558bdf6178de62151b8913699d08ab2b1d101c55b8debc410074c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Canberra",
          "bytes": 195,
          "sha256": "5fe3ced97293fe0573d5ece0cef59ce5ddb4c57bc568ae7199e77b01d3ade17c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Currie",
          "bytes": 193,
          "sha256": "1dd4ec4ed4f854e2ef6162b2f28c89208710f8ec5aabb95ffa9425d3fbbcab13"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Darwin",
          "bytes": 437,
          "sha256": "ac004fd4b3c536406991ec13ebb3e64e0ec0c7b264bc18c0700c8fa545868155"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Eucla",
          "bytes": 759,
          "sha256": "79d0c770a304360db33f3d1ef7b3935f1e4e8125893e0dce683ac35a51302cfb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Hobart",
          "bytes": 8734,
          "sha256": "d813f6a97befc22ca4f24c59eb755d269b9c68a449cc7cf0d2c61f911860ebe7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/LHI",
          "bytes": 199,
          "sha256": "4d84e4040fbc529c9e0366bb74d0cfadeeeeda0dfcc6c2c9204ded6c6455cac3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Lindeman",
          "bytes": 824,
          "sha256": "01b278309353849cc2fdf62a30e2ff483833d5713cf5e329252738be6f2c0a84"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Lord_Howe",
          "bytes": 7764,
          "sha256": "76d1f1ed67b8f8d6903789c2fddf79590a83677972d416f5f3c9687614ec6238"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Melbourne",
          "bytes": 8341,
          "sha256": "f21b9ea51c0d41bad0420fe0601e5a4b491fb895856f4bddf6541d704469d92f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/North",
          "bytes": 192,
          "sha256": "a983c9cad7e542caed43b083e68cd2b782959a4b54015f374c29250d3acf9b8d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/NSW",
          "bytes": 190,
          "sha256": "73d7c9e207e61acf8df7242bdcd84488189033e22a84873a953b65de02fa1b0b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Perth",
          "bytes": 739,
          "sha256": "fc1b54ca261074e47a8a486feac12dd04d46166d1d2b44163bd8791bec32d275"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Queensland",
          "bytes": 203,
          "sha256": "dda669b9bfb3e08fc23ce67030148b9e4740824add8de02580d6afd31ce05bab"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/South",
          "bytes": 198,
          "sha256": "d9dcfdc377901ec0c0feb9cea743c2c1425273f69a1baa7bf3b74fec5885b267"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Sydney",
          "bytes": 8338,
          "sha256": "fc453486325ade1d31f14087b76d4936f3a6d551abd1db6fcac129bdb043951c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Tasmania",
          "bytes": 195,
          "sha256": "c94fa7a7640cd00963ee8ff1a3d9dcda2075408739d998edbf7cfc998db764fd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Victoria",
          "bytes": 204,
          "sha256": "dbef9c5bdd290fec5fa740d697143332d3ca1fc373cf1df736f1883ac9ba3298"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/West",
          "bytes": 188,
          "sha256": "75abb7f20c4a0b618138aa190af33ceaf2a6d2c707da6c1314e4bff2f9904f58"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Australia/Yancowinna",
          "bytes": 212,
          "sha256": "55a9264d0414644a1be342106ae86086a6659596dc9322a74fc4d1ddb41f7c60"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Brazil/Acre",
          "bytes": 194,
          "sha256": "2f594239a434052d36053a2b3eab134eadbad06eb6737e67cf72166dab157537"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Brazil/DeNoronha",
          "bytes": 190,
          "sha256": "a676562a90ff8587a775f6f0e3be05d870456a56d25b5330816bf9043c8d475b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Brazil/East",
          "bytes": 191,
          "sha256": "961fb3ab99a63b1e9704b737eab2d588b5a39d253a213e175cc678bedffd498d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Brazil/West",
          "bytes": 182,
          "sha256": "0500c9a248c8ce9030ea30d0af9dd95dc465480baf60646c0b7c511fa23c6d1f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Atlantic",
          "bytes": 189,
          "sha256": "6dc6354d761cbe7820c9186568cab87ad48ca925507f6a740357195b60e16d87"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Central",
          "bytes": 191,
          "sha256": "db32e83949d62478d229e9fb57bb1624d21b3a9ccee4cd55335f8262c01d820a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/East-Saskatchewan",
          "bytes": 195,
          "sha256": "27cceb515f9b2ab2d441f7c1533064ad13c89a6a009c3f2f14842b217075e231"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Eastern",
          "bytes": 188,
          "sha256": "22844994ae893f3236a091b050e932e84a5218ec0d01f72595e17ccc471fa564"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Mountain",
          "bytes": 192,
          "sha256": "d7a203e60ff19dcdeaad14121720de51da73392d25b40ffa301c1935cdf89517"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Newfoundland",
          "bytes": 196,
          "sha256": "87f42f45fd7d059ca47650d445420de8320f3a7c1cbc7671fbfa8a8881274433"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Pacific",
          "bytes": 194,
          "sha256": "5c4fd46054b190a6d4b92585b4dae4e3a8233ee2996d14472835ddd264911dc6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Saskatchewan",
          "bytes": 190,
          "sha256": "46ba00ae3a07a4dc83d6cb517d87c9cbba491b3421fe9ad6c74cac5695eb73f7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Canada/Yukon",
          "bytes": 195,
          "sha256": "a1b1af37dc89c6ba663e4e967a18409ae4e0fa9ef1b908d0461368da31001c09"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/CET",
          "bytes": 7736,
          "sha256": "e2aea7cfd428a43d9db938bcc476623adc1250bd8057013a7fff5f89d7ff8efc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Chile/Continental",
          "bytes": 194,
          "sha256": "5b40167dd0c0b5c293861070c4ac249f78ddf8bad798dd0165e3ae894c9b9570"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Chile/EasterIsland",
          "bytes": 189,
          "sha256": "1e2da1862e0e0f131b7c6eb12fac5f920852c61c162993a30bc843a464a5aad4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/CST6CDT",
          "bytes": 8505,
          "sha256": "73a9841f233aa657afb6ced8a86a37d55fe5582dd996b9b28975d218bccc078f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Cuba",
          "bytes": 175,
          "sha256": "6f4f2d7f5bca4e5183460c0153d2b98f5239a99f149de6638b311c73cedb1329"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/EET",
          "bytes": 7440,
          "sha256": "64e284f9f7a36cc0a352809141d76e73a99344a9f30cffea254cbb9d2c589ada"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Egypt",
          "bytes": 170,
          "sha256": "936b6484469351def8fafe8ec180862729f5e43bde4e53e2e9636e221b54c3c2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Eire",
          "bytes": 172,
          "sha256": "b78a833337efec8b5f64622f1bfda21fcb79cf290e9cf32a54b206eb20c6fde9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/EST",
          "bytes": 111,
          "sha256": "6344be02529c1cc5f7b5fe14b7e9bbced4dde68a24b824601eebcae207abfdf2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/EST5EDT",
          "bytes": 8505,
          "sha256": "0be6161403bc5a96bfab174f2c3fcba8a677d4349699b408e9872b9dd0fe15ce"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT",
          "bytes": 110,
          "sha256": "66b0df8888883bff44b18728b48cdf24aaed0bb745d601f3422c4f2d4063e0ac"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-0",
          "bytes": 159,
          "sha256": "eff27b3dee9306641ff344801e06bb33ff768cdccfe2409fa8af752ff6d39f66"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-1",
          "bytes": 115,
          "sha256": "b4bf883fbe9246ef4079179a746b1f9e59f2c77d4f598794b60732d198dc6044"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-10",
          "bytes": 117,
          "sha256": "ef3046d7789cae069b5473d053f3ef0157248f8a359a1282ee02ba613a75fc94"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-11",
          "bytes": 117,
          "sha256": "ccdeadbd18be81e59a669a460a14afcbff733c3a5d164fc2b6b93deaf009b78a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-12",
          "bytes": 117,
          "sha256": "23b61b18c653e25f7245b0bb6e04ad347e038585b145962fd1eeace26f118d54"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-13",
          "bytes": 117,
          "sha256": "a9f1ad5a7cb5ed43c5e6e8a7a9b887329890abb75b9fc9483b8543a367457ebe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-14",
          "bytes": 117,
          "sha256": "a37a7160027bd38356764c4d1aa5b9b17f8d5dc3cfb81ef2ed399e44c41734ce"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-2",
          "bytes": 115,
          "sha256": "7211bf8329b2388563ed8fa8c5140099a171b8a303a9473e9a6f3af0c5d239cb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-3",
          "bytes": 116,
          "sha256": "bfc86d65b0b94725dce4c88edc4300141abbca4b6cdecf037c437df49f0c1d6a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-4",
          "bytes": 116,
          "sha256": "02e2eeaf88ee179ef63dd29acc7384a4b46de1e3a151c1f3a5dd31bbb5a05aee"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-5",
          "bytes": 116,
          "sha256": "3a2c75dca11d1167126f0d44a8682420faf75b0b82b3dcfc35a9f028a9a759e8"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-6",
          "bytes": 116,
          "sha256": "d22c87321373ec0efb0f312925476cd0747323ef303e17621a871bf814c8abb1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-7",
          "bytes": 116,
          "sha256": "70cb3a766a2e84148b68613d68687d263d3592ed4b6e672797fb20801eca8231"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-8",
          "bytes": 116,
          "sha256": "80c85d59416cec91db3dac5fdd2fd7b91d6fc74a37bbbef6ff58f6f6816e8fc9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT-9",
          "bytes": 116,
          "sha256": "57395bb968afa5a041eada4b684b82f0379a9333f9522d69f069a79fdea2b8d7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+0",
          "bytes": 159,
          "sha256": "64466ea3759301e88c29ad1a833cdcbbc495eb4a5a3ac45e7b2987fecd6702bd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+1",
          "bytes": 116,
          "sha256": "3be1ec71d2cc88fa9a3db7dc0476475f33fe5bcbe6bc35c0f083859766466c32"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+10",
          "bytes": 118,
          "sha256": "e61e826e6fbc2396ef152640698098f4477d4ffdfe5f791f62250c3ec5865304"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+11",
          "bytes": 118,
          "sha256": "143528946275ddc8b894218d3f1be56c950f740828cec13166c3d7e8e1b6bb7e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+12",
          "bytes": 118,
          "sha256": "a93eafac2c1089c608c8536127d0e8b53d8c7cfd13ae7dd69339e12a89f803c6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+2",
          "bytes": 116,
          "sha256": "ad5833153446960bde0653a22ae2111bf80cfd61c3010993ce87b81d40c75c72"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+3",
          "bytes": 117,
          "sha256": "c7bee4c71905eddb40baf42c0cd0dc70bb9f298eaab8b9367d484b8431dd084a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+4",
          "bytes": 117,
          "sha256": "26d1ef512cc5797fc63ba2b83c7d6271025f4d4f5c904d9fa8e97f053393d9a7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+5",
          "bytes": 117,
          "sha256": "054910bddfc44d9b806bbd3008c30547fa57ecd3c043418c406a725158144688"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+6",
          "bytes": 117,
          "sha256": "d53bb247e0e429a6243ab9a9bdcae1ee1cf5f271d79748a843631906ab63a988"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+7",
          "bytes": 117,
          "sha256": "6ba5779e35d581b409f53b14b6e28ecc16f536ffedd45ddbc8dae4b8c28f66e7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+8",
          "bytes": 117,
          "sha256": "ca87559b154b165e83482aee3d753ba8e38abca347a005e8504c566433cf4cb3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT+9",
          "bytes": 117,
          "sha256": "a0987a1d078b0993fb3b07208e3f4538a2319dcdddeb2faea32fc463deafb8db"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/GMT0",
          "bytes": 158,
          "sha256": "ab742f93be44bd68ab8fe84505fa28120f1808765d9baed32a3490af7c83d35b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/Greenwich",
          "bytes": 163,
          "sha256": "f89167b6117838d9679c0397496b6d96d3a7beaef0bd99406abacdbdb658fbcc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/UCT",
          "bytes": 157,
          "sha256": "0856d14dbbc53d46460bcd530bd070e9e8966d1c96ba01ba556e215a98c09cd4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/Universal",
          "bytes": 163,
          "sha256": "a2b62c5914de169a68a018a5b47c1253dbca10a251862d17b0781ecfd19b6192"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/UTC",
          "bytes": 110,
          "sha256": "4d74d9ec2397b1708fef47806294b0bca26679f3a63149ae24e4e0c641976970"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Etc/Zulu",
          "bytes": 158,
          "sha256": "bbd6e93206ff3b7017afbe63905b4c932c422b582f3ce2a79a7b885d390ee555"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Amsterdam",
          "bytes": 9102,
          "sha256": "5808f77cab37ed4f52f0a02ff0b75ea194f8799a2165695ca3650579cad498d9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Andorra",
          "bytes": 6927,
          "sha256": "f0b48da7ca3659450d87cc0ddfddfd28b464543df1ee40d935c44d5cd7c9b9b3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Astrakhan",
          "bytes": 2063,
          "sha256": "4b5fb0af225974d117374028285f20a02b833ff4136e6bfae7b65e6d6d28829e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Athens",
          "bytes": 7954,
          "sha256": "47353319419505aab205c23f8c97ea0b12e5ded2113147794f77b67349aff52f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Belfast",
          "bytes": 182,
          "sha256": "557023674f6e8376707517103ee69c1debbe53cdd4bcab11e763cc53b9cb1908"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Belgrade",
          "bytes": 7309,
          "sha256": "74b225511b518b0ced972cbb33d694697712ccb96a6d81e0f50ada28cf6e2c92"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Berlin",
          "bytes": 8020,
          "sha256": "7e7111f06288069b52a4e1ca0b016216df9328fb3b1560a740146497ccdd4d24"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Bratislava",
          "bytes": 185,
          "sha256": "1d7c539aaa1e3ad5ef3574a629523b5b781f1a91d352c9b39b8de7316756026e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Brussels",
          "bytes": 9223,
          "sha256": "1402a2072adc9ebb35f4c0368d2e9a7a11493626c667c022614ffb7cc05b6cb6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Bucharest",
          "bytes": 7974,
          "sha256": "c560d45104a8dd73fc7370b5ac1615e22043dbc93dfb46a9ecc6468c2d38b19a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Budapest",
          "bytes": 8287,
          "sha256": "b58f3e9066b8b57eb037d509636aa67a06acc8348be6c48482d87cdc49844a4e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Busingen",
          "bytes": 183,
          "sha256": "f511a80ab70ff93a0eb9f29293f73df952b773bb33eb85d581e4fb1fe06e4f05"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Chisinau",
          "bytes": 8096,
          "sha256": "2bd1c0ab412a5e9c97f533c4d06b773d045215b92568a4e89adc93c7462d62ec"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Copenhagen",
          "bytes": 7722,
          "sha256": "c6abc78ad0f03f903e04db41067b555f9e589e321e253a01ed819189c6fffc0e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Dublin",
          "bytes": 9810,
          "sha256": "930f4e37b6d60b6701cba95eea1f6053d85e5f9de6bbe287a0d43e24b9d63fb0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Gibraltar",
          "bytes": 9509,
          "sha256": "0524a31131405347c1d5d86c5ee38a2064ab055c030ab3b43f25db3b28ffd8d2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Guernsey",
          "bytes": 183,
          "sha256": "f7046808a8e80b7ae449d1a49ae3e480096736b7d3f554a240c7dfb10f82076a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Helsinki",
          "bytes": 7368,
          "sha256": "5b5c0a9261a414ea8dc34f594ee05bee16f695488b230857d2b569a6b603bc39"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Isle_of_Man",
          "bytes": 186,
          "sha256": "2f1151b0528a5325443379d4e7cce32c00213722ad9df764e1dc90198084b076"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Istanbul",
          "bytes": 3683,
          "sha256": "08061a80fc0f1ef375eefe784eacdf0812e289fd67e8613bdec36209985ca1d7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Jersey",
          "bytes": 181,
          "sha256": "97eb33915ed7c9c34144f8f42357fab2262b3cd45287f3cffd26c33d65f7651e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Kaliningrad",
          "bytes": 2512,
          "sha256": "2387d26df5429df9867f42f7d4f872dc146643b4b3cc57da7298c18561de8bfe"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Kiev",
          "bytes": 7453,
          "sha256": "08b137b7b933393f8f4574615a370013288e5297937b5c59d4179744273fab26"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Kirov",
          "bytes": 2029,
          "sha256": "60884d4b8b17a9ab8fb5697da95f62e570755348109c661d783d56cd047bbe9e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Lisbon",
          "bytes": 9878,
          "sha256": "9fac9812411f88014779d34722f3e0d2750e45bf21595df1ae14cb9ccfd3f33f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Ljubljana",
          "bytes": 190,
          "sha256": "713a842197516d618f2d86977262542a1ca334d7df6026539fa2f2980dbf4cd3"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/London",
          "bytes": 10211,
          "sha256": "d04c4e25df4de1c1cfe1ef84b3b6dd746cf08a271ab0958f22c7d580a3ed10e6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Luxembourg",
          "bytes": 9139,
          "sha256": "380e49d38f6abe946a90a9343a277ed28492eb800747d6d14f4639fd3ea80ede"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Madrid",
          "bytes": 8517,
          "sha256": "5337c9843c56deec6b91c4468c76ec1c896e80421b72b583b69de5579063e09a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Malta",
          "bytes": 8724,
          "sha256": "c5c240baaece8235d1fbdd251c1a67cb2d2fc8195dd5bbe37ff9cff0445fcda2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Mariehamn",
          "bytes": 190,
          "sha256": "6136c3cfa4a767e7c9dda23a283ad98b72e9868f192e6a8e3bfe6396f6989bd1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Minsk",
          "bytes": 2177,
          "sha256": "8c95ea696ea578def726502ac181af475a676030878f56b4e2d667757bbd1c49"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Monaco",
          "bytes": 9186,
          "sha256": "654b92e8b9e8fbdc967d094b48110908f458454d7057f680ac745b9c8d48fcc1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Moscow",
          "bytes": 2430,
          "sha256": "31f9c3c2f17b3ee4fa6d9ee6a86bf407ac0377de4d666c65e86ce5ac591f829f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Nicosia",
          "bytes": 179,
          "sha256": "fc93b7516933edfdc211ac0822ee88bf7acad1c58a0643b15294f82eb0f14414"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Oslo",
          "bytes": 7922,
          "sha256": "5a28b5cec79b57d4856e3f05615245e6f74df6388b48bf3f605b792ca3bd972d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Paris",
          "bytes": 9152,
          "sha256": "ae61491c4a587f56426a9f2118e31060276f2b0231e750c461781577551ca196"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Podgorica",
          "bytes": 190,
          "sha256": "b87630ff459de07eb16cd0c2452660772e3ffc4eeb8419ea77a013b6f63a5900"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Prague",
          "bytes": 8038,
          "sha256": "5d3afed5c1b07c6c6635d6bdeb28a0fb4d11a61f25f26c91227b2254be5f4aa0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Riga",
          "bytes": 7658,
          "sha256": "8b64a42bafd90f9255cacfdbac603d638dd7c18dc27249f9c9b515e1da634424"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Rome",
          "bytes": 8813,
          "sha256": "dcd2d9144507311e573568598e1ffd0e0574fb677aa0dafc5641d80a19eb6e58"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Samara",
          "bytes": 2118,
          "sha256": "8f395352aa05d35e7d13380e73659a0d5b56ffc17e3f4e40e4f678a902f0e49b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/San_Marino",
          "bytes": 179,
          "sha256": "b6856a0e38c2404f7d5fa1821559503f8ae70923a562f0d993124d131515f395"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Sarajevo",
          "bytes": 189,
          "sha256": "bc00d953c2f3e55e40eda13838ab66b9e9d0bdad620e4eb917637761abb06fb1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Saratov",
          "bytes": 2061,
          "sha256": "ab90363dee5077c39ec55fe8e519593ff08223e5a8e593f6cce01fb5b8b35bae"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Simferopol",
          "bytes": 2389,
          "sha256": "4186a873a6218ff746957a0aaed1d61fc28ff5ed6d44bf38f36b5120a21c06c6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Skopje",
          "bytes": 187,
          "sha256": "52f20858433261b15797b64f0a09cee95d552ef93b5daa7c141bfab6d718c345"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Sofia",
          "bytes": 7654,
          "sha256": "6415f279cb143ea598cf8272263ac5b502827b10ceeb242b39e6efcc23a2ee12"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Stockholm",
          "bytes": 7308,
          "sha256": "12447ce016745fc14584cb5f753e918c23eca5d028ca50042e0714cf3783608a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Tallinn",
          "bytes": 7549,
          "sha256": "6f3594ccda78b02b2ee14c8fae29e668e47193af2dfcf5af1ecd210f13bce9ce"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Tirane",
          "bytes": 7675,
          "sha256": "c62686bf598138fefb72e8cc6632ba75a5fe147f2a30124ee3583be1f732e38d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Tiraspol",
          "bytes": 189,
          "sha256": "fdd53fdb5f754bbba8ff98f0b1555fe0baeb7852843220a7cf93a190b641a9ad"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Ulyanovsk",
          "bytes": 2119,
          "sha256": "9fa9d09509b4f8f5a9c8e422dba02605070c3ebdaeb7c1df8527c8eef5e3632d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Uzhgorod",
          "bytes": 7541,
          "sha256": "747f543b7a875214f8eebfdae3182d91b1e93ceb57b58d2b7657672f949b13a9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Vaduz",
          "bytes": 180,
          "sha256": "06b235bf047fc2303102bc3dc609a5754a6103321d28440b74eec1c9e3d24642"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Vatican",
          "bytes": 176,
          "sha256": "c203e94465bd1d91018fc7670437226ef9a4bb41d59dde49095363865ca33d00"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Vienna",
          "bytes": 7930,
          "sha256": "a8165313c9b51daef130401439cba60daa9887fc5eaa61a5afd4f7bad1ad934f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Vilnius",
          "bytes": 7485,
          "sha256": "b762db4a068dc79fa57691e070d7026086e5a6d2fc273d5c1872e7c8e3711533"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Volgograd",
          "bytes": 2123,
          "sha256": "22968d40dac2b669e6d2bc43ed6b16c8a9ca3e1f9dacbf8b246299c3c24cc397"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Warsaw",
          "bytes": 8662,
          "sha256": "f9dc10ec2ae2cc810a6c08837059b34be651900ba4e1cedb93c209972ccfb5a2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Zagreb",
          "bytes": 187,
          "sha256": "a49b3894eb84f003eb357647d6a40ceaf6213523196cc1ec24eefd7d9d6d3c3e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Zaporozhye",
          "bytes": 7490,
          "sha256": "f0045f64f64a2c40088f2960616ab8e0aabb8d6309f489fee842056fb8412f72"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Europe/Zurich",
          "bytes": 7305,
          "sha256": "95afa61e439ca38551306d8fdb11c2788d935c42768d0407c9e4337f105a3e93"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/GB",
          "bytes": 170,
          "sha256": "e20d829c605a7c5b2a96b83c3480df28c964a13381a8bd2c72c2a37295131fa7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/GB-Eire",
          "bytes": 175,
          "sha256": "c9334480d0a970254b6ba6ff22e958dc8dd8bf06288229461a551c7c094c3f1d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/GMT",
          "bytes": 153,
          "sha256": "747c15cdc239855d5380b7a7f47112f2a26c61b0bf300eeb9711e6521550d189"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/GMT-0",
          "bytes": 155,
          "sha256": "944c86f516141ddc3aec1ae4a963e9769879c48ed12daddf4ed63a01313acd00"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/GMT+0",
          "bytes": 155,
          "sha256": "be48462ccfbb3aee19597f082a17c2c5d2fd8bb1c9122245efab0a51f8f413b0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/GMT0",
          "bytes": 154,
          "sha256": "54850a5f488205db01fbb46e2da9fff951c4571029ea64d35932ddea5346daaf"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Greenwich",
          "bytes": 159,
          "sha256": "9e7a8daa26ce36e8f7d7f13460915c063ee98e2a4db276ad9d15ca5c7c06815f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Hongkong",
          "bytes": 179,
          "sha256": "359c9c02a9fa3de10ba48fa0ab47d8d7aff3b47f950cfaf5eb68f842ea52ab21"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/HST",
          "bytes": 111,
          "sha256": "8d710699af319e0ddb83e9f3a32d07ae8082ea2f7eabbd345effffb0f563062e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Iceland",
          "bytes": 190,
          "sha256": "e4ab3a08ed590d907f9741d4b8fe27e552b19fe0257f14ce2ed5289d5685974c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Antananarivo",
          "bytes": 190,
          "sha256": "1b1177ce4d59d7cbcae9b0421eb00ad341ecb299bd15773d4ed077f0f2ce7b38"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Chagos",
          "bytes": 180,
          "sha256": "11044ad7cb0848cc734d2a67128aa6ac07cb89268399aa0a71a99024de4b8879"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Christmas",
          "bytes": 154,
          "sha256": "cb43deafad0f8bf7de8567841790a58d358ef2b210bb2022686b3eb7f97b2e5b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Cocos",
          "bytes": 152,
          "sha256": "71194b896cc00967ebbe3f9f4609f8c5cd73ce56b2529646a7a6ac679bb03400"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Comoro",
          "bytes": 184,
          "sha256": "53fa58e32dc2e4abb574b2f78011815eeb7f89f453cc63c6b6c1460abbb4ca5c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Kerguelen",
          "bytes": 149,
          "sha256": "c7afde6978d8ce5413730d370e2776e2acc7d96570a6034eb504c0f42ca5d1e7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Mahe",
          "bytes": 149,
          "sha256": "8e1d0f7268a5ee75e8a7c17fd6e1a9880bad18a612346c29d70b462024d7371e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Maldives",
          "bytes": 183,
          "sha256": "9fac69dc609cc6074ecd67e0be8ae62e33d8d9c7f055a3e0dee1430c7ffc54f6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Mauritius",
          "bytes": 272,
          "sha256": "a2b1b93cbeecbd900ed71e61a4932509eb52688e97a6015dad067066d0d42072"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Mayotte",
          "bytes": 185,
          "sha256": "845c45fd7b6f0604b03a3c72db117878b568fb537bca078304727964157b96ab"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Indian/Reunion",
          "bytes": 152,
          "sha256": "e039b16caab8f5d8f85625e0cc1d0fe42369715f2a4810bdf7f9cf19a28b5603"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Iran",
          "bytes": 166,
          "sha256": "fe7f4453cb5f6b81b23c1c795356b91fe319f0762be7868fafe361db1f9c2a2b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Israel",
          "bytes": 177,
          "sha256": "805105f5f17b78929f8476bae83ed972128633ff6f74b7748b063e3c810c27a6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Jamaica",
          "bytes": 181,
          "sha256": "f01b00d52bd7b2694bf5cb55a17028c30a41bd22a774ca54740e8b1dde4fcb2e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Japan",
          "bytes": 164,
          "sha256": "98dbd07ae3b9251b9091f4d265336ce98bdfb492af863c1f3ff25248a2cadf35"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Kwajalein",
          "bytes": 189,
          "sha256": "85e95363acf468043cd5146927a97b2d9e3b141eda0a7993dada9382d1d6dd54"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Libya",
          "bytes": 176,
          "sha256": "f776839c1999056e6a0d2ecfdf9054fc309454afdff8e8bc803f33ec423b7361"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/MET",
          "bytes": 7736,
          "sha256": "df45f5414f1636b1856c7534bb5f3d4387c32d56283a68bb47d8c48c1ddad5bc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Mexico/BajaNorte",
          "bytes": 190,
          "sha256": "f8ca38a845cd01bf785ee222277dad9325ab6bd17e44a362c450855aeb522814"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Mexico/BajaSur",
          "bytes": 191,
          "sha256": "2e6e32a40487f0146b59150b66ff74901ca853b12d47922819af23eea5b4149c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Mexico/General",
          "bytes": 200,
          "sha256": "2dff1b83fecfad5c27ec47b206696c29b91398f8185b5d406a66fa9e0aeca93f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/MST",
          "bytes": 111,
          "sha256": "e57746d5db479a8b30973f2bc16e2b8dfb6e2bfaecbff0fb956f04526e4b935b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/MST7MDT",
          "bytes": 8505,
          "sha256": "a5deb89d59613d9a54c1e146056a805b3de9f2a2593aec2b8a25f863328699c0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Navajo",
          "bytes": 177,
          "sha256": "2cc8ce235f2ee3160e6afd04a4e28aa0312494ebb6fed08d8cc81d414ec540ee"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/NZ",
          "bytes": 179,
          "sha256": "e22d629d53c54960ad156c377de0ae461c27f554990a3d1305724ca8f869bce4"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/NZ-CHAT",
          "bytes": 181,
          "sha256": "83f4ca3522b64f9b151edefae53e0f28c2e6c4ce16d0982186b3344f2a268724"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Apia",
          "bytes": 909,
          "sha256": "983884249acc11c3fe740d78e72b1a89be9c8b077283549bf6bcd8c93fa71731"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Auckland",
          "bytes": 8772,
          "sha256": "201cfadb00fbcd3283249dad73872ed75c5bec07f5a5b157726638c20728b833"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Bougainville",
          "bytes": 280,
          "sha256": "2d3bfded297214ba25cfd8c6f508d0c8b1a1cd7d46701a78ec5e510076185eb6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Chatham",
          "bytes": 8165,
          "sha256": "ca0eef84dbc5964ef2265e9252237be58bb8d75c34817cc2305cccfaec7e690c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Chuuk",
          "bytes": 305,
          "sha256": "492df366bb0a7d29d2db4a9c40cf0c15cb47343ff908d1aa86092c8e84e4434b"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Easter",
          "bytes": 8203,
          "sha256": "84b815988d1a5ac16f3ec52844bdce7a8e8707800c782235b5928473eef9b433"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Efate",
          "bytes": 789,
          "sha256": "332372e5efb46123fbb66f9f32f91b59ebd88adb956249db3f14caab01ce2655"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Enderbury",
          "bytes": 188,
          "sha256": "790e6b48b261d6def7d183cc8f38fb8d8a6e3efb8844281efabb2dfd621e53b5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Fakaofo",
          "bytes": 185,
          "sha256": "336058dca4802c79ed43f6177adb73085d4fa0754b94051cae2a19346b0c4904"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Fiji",
          "bytes": 5636,
          "sha256": "a29faaee67bc07f5df858dac070f03e45e29b67a5f9de6dd992e79a9601979b7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Funafuti",
          "bytes": 154,
          "sha256": "b2acf1461318a0b21653b6f21de5e54651a417a469aad0dbf8099626040beb51"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Galapagos",
          "bytes": 247,
          "sha256": "192545659f971084adc8489a2b96a6439ff391599dc962aa13375accfb3c09d9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Gambier",
          "bytes": 155,
          "sha256": "190e02a0c00d165fa45c73aef9c0d6c82b1720e7406e5610dd860aed10a021a5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Guadalcanal",
          "bytes": 157,
          "sha256": "161762334dff48b1d58824911e1ff4171386ea18234dd3dd5b0798515593086a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Guam",
          "bytes": 733,
          "sha256": "42cb69abc83415f63ca7d2a3e5314a41817aee3206eccc7172c50a74b1597db0"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Honolulu",
          "bytes": 344,
          "sha256": "69319015799d32d3cf7c0a3e9991b4b1f3e0c5d1b4fbf400517350cca9d2c3b7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Johnston",
          "bytes": 193,
          "sha256": "6e52b361ac8a6a578c709f6d58aa7535f06c0cb1707081c2d5a63fa8545d955c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Kanton",
          "bytes": 208,
          "sha256": "0b1345555ec2b4738cc4debfe496c287966f238386263032ff1e27912ccbfba6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Kiritimati",
          "bytes": 219,
          "sha256": "4f7235b956a5a01676be05275e086d5157ebc24fd91022e87817020669f915f7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Kosrae",
          "bytes": 394,
          "sha256": "b528e5e712e5f878603183e7ccff55e5db97cb47d7628bcb635342796317b899"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Kwajalein",
          "bytes": 304,
          "sha256": "38133be70100d7dc244a680827879e6b240646c7c0b68f58652051e681a71985"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Majuro",
          "bytes": 333,
          "sha256": "67ea1a2a84e0fa686c04ef327e7eeaccc15e21bed79a801e64bb57fe4184509a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Marquesas",
          "bytes": 159,
          "sha256": "ae0b5055c6e57516f23749b13681205ead376e682959716a457b1377af8160ba"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Midway",
          "bytes": 194,
          "sha256": "f62c6a2dec1e9ec78115d5f14e5b9db7c86f788662d2e68f7e6714f4a05dc974"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Nauru",
          "bytes": 244,
          "sha256": "22c367f3219b5fc736260d9dbfef5fcb767f1a6bda991c9352f790a3d1ffe884"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Niue",
          "bytes": 184,
          "sha256": "869cca656be88e4e7481c75737c3656bab6924ad1751505815ac719c59269842"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Norfolk",
          "bytes": 5139,
          "sha256": "5d16c3ef1db996c1b8e33ad884c33946f77da872f35f41ec3bd5b288f43cc9af"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Noumea",
          "bytes": 326,
          "sha256": "238683c027d2319c33d975a837e9fc9d24dd53b1a67108edbf7abdf0db050881"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Pago_Pago",
          "bytes": 188,
          "sha256": "cca96640ab3bc707224fa86d9af66f9d53a204a97b370b2785ba8208688bf8b6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Palau",
          "bytes": 183,
          "sha256": "97de6c2c717bfead00f83b5d39d654c32cee580226f5f084484ebad57bbce7ff"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Pitcairn",
          "bytes": 188,
          "sha256": "5d363729a986e24c79f4b817cc88d2b22accce3add20138d51c4422c4297ad6f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Pohnpei",
          "bytes": 338,
          "sha256": "88d62b644bb96a9318427b4ca56db37c8217da449328c801ed77007be9420f9c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Ponape",
          "bytes": 188,
          "sha256": "edc43ef78691a1b22d111bc4390ea442b893e61771a6fd76bdae1d46c5904c0c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Port_Moresby",
          "bytes": 190,
          "sha256": "124c137b091d9d54d5e0579131485428faae040acc978d20d6a8c8e4de9889aa"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Rarotonga",
          "bytes": 969,
          "sha256": "5ab006a686e564e30c94884ff8a9d728aec74681da8772e9722b6fe203630b5d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Saipan",
          "bytes": 179,
          "sha256": "4f6a1c20a11e186012466091cd4b3c09d89d35e7560f93874dec2d7f99365589"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Samoa",
          "bytes": 193,
          "sha256": "98d06302efc18fad7751f7e5a059fe4abafbc361fdc365fe1eb576209d92c658"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Tahiti",
          "bytes": 154,
          "sha256": "440a87ddb4f304dcbeaed1b0de8f6058840e597918b688e0782f584da03b1bbc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Tarawa",
          "bytes": 152,
          "sha256": "91aa5da8d5d1e72b1f561d0aeab4b07e02edd4eb95ae8c9f1c503c820460599f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Tongatapu",
          "bytes": 451,
          "sha256": "ecc9d2e7ad7b5e5d6599cf442941595c99c4d69e802a4ddb4da321898cdde91d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Truk",
          "bytes": 180,
          "sha256": "bdd8c779af9d671ad7f20832fff8eb3b25c9989a619c23337743f112ff4c8764"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Wake",
          "bytes": 150,
          "sha256": "2d18d9ab10c9d8947a88d486d0bc0b0523049a2ed2ca2fbdfa0577e40f189d13"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Wallis",
          "bytes": 152,
          "sha256": "a3d83e6c504eac75c4cd87b696f0df2703d0a78df27d8b1fac161acb07f2a9de"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Pacific/Yap",
          "bytes": 179,
          "sha256": "e348a2d02966cf9599b5f6f1f5b6c3412113def548bd322f0c22376106e12d92"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Poland",
          "bytes": 174,
          "sha256": "c27e1179b55bf0c7db6f1c334c0c20c4afa4dbb84db6f46244b118f7eab9c76e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Portugal",
          "bytes": 176,
          "sha256": "efd666f3062d52c5d0b4f83b1a206e6840c1eaec356cd77a0a71c7edfa78c964"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/PRC",
          "bytes": 171,
          "sha256": "6a5baa9ca54b2a2c6d21287443be0b1064aa79b5c4c62939933f8a0ad842b73e"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/PST8PDT",
          "bytes": 8505,
          "sha256": "d148708f1e70eefa51e88e5823776cbe710535d4d6d6356e7753a44463a1c5ab"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/ROC",
          "bytes": 165,
          "sha256": "9aec39777013b23d63d0509ebb2f01d57a2c1592264dbb19ce2c61c7d7ddd8de"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/ROK",
          "bytes": 162,
          "sha256": "63153b40225270adb7cd248788ca9f18c6debaf222b3165bbab633337592df44"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Singapore",
          "bytes": 180,
          "sha256": "b9443fb17f0128ddb9f2df657dc5d2df176f64c61b0d02b272e5dfb108537678"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/AST4",
          "bytes": 201,
          "sha256": "978c4e5256057ce7374ad7929605090fc749b55558495bd0112fb0bb743fa9c2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/AST4ADT",
          "bytes": 192,
          "sha256": "0114c111f5bcd838a28f2e16e01ecb79d8afc8cbf639a672889ed0d692fc6cdc"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/CST6",
          "bytes": 186,
          "sha256": "30428b85b37898ad98b65be5b6a8bd599331d9a1b49605fc6521464228e32f8f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/CST6CDT",
          "bytes": 192,
          "sha256": "44bef7d4660a9a873eb762e3fdc651d31d97893545de643fa1b2d05991c090a1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/EST5",
          "bytes": 204,
          "sha256": "798f92e5dda65818c887750016d19e6ee9445adfe0fcb7acb11281293a09c2c7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/EST5EDT",
          "bytes": 195,
          "sha256": "d159140114a13c69f073cfe9ad0b67d713e8811cbff773a3d1681fc38ea0e699"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/HST10",
          "bytes": 193,
          "sha256": "bf62c8650bba258000f62f16b0c7cbb66f4fd63f8cfdaf54273bb88a02a6c8d6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/MST7",
          "bytes": 189,
          "sha256": "febe49fae260e5595b6f1b21a0a3458d8a50aca72f4551bf10c1edb2758e0304"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/MST7MDT",
          "bytes": 189,
          "sha256": "64556a7b20e425c79375c2a7ccf72b2b5223a7de4ff4c99a5c039db3456c63f6"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/PST8",
          "bytes": 192,
          "sha256": "0b8227afc94082c985e8e125df83e5efade7cd9ca399800d7b8e8b2beae22c7d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/PST8PDT",
          "bytes": 204,
          "sha256": "d51d9549835e9c058f836c8952932cb53c10f7f194cd87452e9b13494d1c54c9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/YST9",
          "bytes": 189,
          "sha256": "55710efded5b5830b2f3a2a072037c5251e1766f318707ed7cd5eb03037fed43"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/SystemV/YST9YDT",
          "bytes": 198,
          "sha256": "da20018de301f879e4f026405c69fa0370eb10184fe1c84a4f1504079d5dafa1"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Turkey",
          "bytes": 180,
          "sha256": "8471a5575b9d9e47412d851a18a26c4405480540aabc8daed5f81be0c714c07c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/UCT",
          "bytes": 153,
          "sha256": "356a9bb6f831971c295cf4dce0f0cdc9edf94fd686ca3d3195e5f031a0b67cba"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Universal",
          "bytes": 159,
          "sha256": "b7b0b82f471d64704e1d6f84646e6b7b2bd9cab793fad00f9c9b0595143c0ab7"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Alaska",
          "bytes": 189,
          "sha256": "ced56f09d68be00555219594c7b2f3e7efe8323201fb3e2aa0e1fa9a6467d5af"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Aleutian",
          "bytes": 176,
          "sha256": "a4f1398cf84d0ae09bf19288770756622d1710ccbfbfe79e0d3239497731287d"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Arizona",
          "bytes": 184,
          "sha256": "9503403f231ba33415a5f2f0fdd3771ce7ff78534ce83c16a8db5bc333b4ad8a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Central",
          "bytes": 184,
          "sha256": "b6ac9fae0ab69d58ecfd6b9a84f3c6d3e1a594e40ceec94e2a0a7855781e173a"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/East-Indiana",
          "bytes": 228,
          "sha256": "5d86f8d36598516fb2342a18a87db2701babd265b0671cc9321c48db22c7eca5"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Eastern",
          "bytes": 187,
          "sha256": "2ffcad8cbef5ecdc74db3ee773e4b18abc8efa9c09c4ea8f3a45a08badaf91a9"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Hawaii",
          "bytes": 186,
          "sha256": "529bb43efda6c1584feaea789b590cef1397e33457ab3845f3101b1fc126e0fb"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Indiana-Starke",
          "bytes": 206,
          "sha256": "5827b6a6d50cf0fb75d6ba6e36282591ad25e1f0be636dcfc5d09bda29a107fd"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Michigan",
          "bytes": 185,
          "sha256": "b4e4269c4febfeff26750b297a590226c0a6872519a6bfde36f6dc3f6f756349"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Mountain",
          "bytes": 182,
          "sha256": "3763bf520d3c97148c34dcfbdf70dec2636d4e38241555900c058efee3bd1256"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Pacific",
          "bytes": 196,
          "sha256": "54e5f126d4e7cc13555841a61ff66c0350621c089f475638a393930b3fb4918c"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Pacific-New",
          "bytes": 200,
          "sha256": "b14c515d5823e7f6e4c67892fa376d54db748fab139c4d40db50f22d113bae4f"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/US/Samoa",
          "bytes": 188,
          "sha256": "e51fc51c65ffeab514d7636271157ee8941bdacf602cbc380f5d60b5fa674e87"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/UTC",
          "bytes": 153,
          "sha256": "dee28ff84e3fc495ed3547d5e5e9fafdacc36a67329e747d434248ed45bf1755"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/W-SU",
          "bytes": 172,
          "sha256": "f7da75b585f45ab501b2889e272ff47b1c4a1d668e40aed7463eb0e8054028c2"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/WET",
          "bytes": 6945,
          "sha256": "7e6e2369c19dd19a41be27bb8ad8df5be8b0096ed045c8b2c2d2f0916d494079"
        },
        {
          "path": "python/tcl/tcl8.6/tzdata/Zulu",
          "bytes": 154,
          "sha256": "a06e8cccf97cc8fb545dfdb4c89b5e5c8edf0360547bdc1823b4ac47b1556c31"
        },
        {
          "path": "python/tcl/tcl8.6/word.tcl",
          "bytes": 5030,
          "sha256": "678f891615e2209a8ecba17857922a9723e78709adb983032e89ca706000c44d"
        },
        {
          "path": "python/tcl/tcl8/8.4/platform-1.0.18.tm",
          "bytes": 11423,
          "sha256": "c96140d154c3bdc0a13a06c8b8b7628dfcd014df827704d1dbcb2b3b38349605"
        },
        {
          "path": "python/tcl/tcl8/8.4/platform/shell-1.1.4.tm",
          "bytes": 6218,
          "sha256": "0a6b4b109cfdfc4b40fbdefdb2282f9b1af3cc2f9624dd39958eebd78781afb2"
        },
        {
          "path": "python/tcl/tcl8/8.5/msgcat-1.6.1.tm",
          "bytes": 35136,
          "sha256": "6774519f179872ec5292523f2788b77b2b839e15665037e097a0d4edddd1c6fb"
        },
        {
          "path": "python/tcl/tcl8/8.5/tcltest-2.5.3.tm",
          "bytes": 107041,
          "sha256": "f6931f88ae2a4e63d77eec83e58f5944d66c7ef5f335a51064e8023e0c842971"
        },
        {
          "path": "python/tcl/tcl8/8.6/http-2.9.5.tm",
          "bytes": 115215,
          "sha256": "226347b0fae4a3ed9237ce64c998c2a88b4fdd3d7f85a081b7cab3e863feb13d"
        },
        {
          "path": "python/tcl/tcl86t.lib",
          "bytes": 185936,
          "sha256": "29d65ab5e5c70edd2d65d560971493ef760827ba223faedcf0740a011bc6c88e"
        },
        {
          "path": "python/tcl/tclConfig.sh",
          "bytes": 7731,
          "sha256": "1924c93f3bbe7bdd32a3598c13ba6ed31d307d0da2ffda116ec3e5c03c472cd9"
        },
        {
          "path": "python/tcl/tclooConfig.sh",
          "bytes": 792,
          "sha256": "f4d7d687dac5033b04bcf6c9cf3014b8139c79e730f6c431c437108a9bb3ceeb"
        },
        {
          "path": "python/tcl/tclstub86.lib",
          "bytes": 9464,
          "sha256": "22c7537b4d69ab562ec22736e75506512636ef84aeae0fbbea911c8a1891cc77"
        },
        {
          "path": "python/tcl/tix8.4.3/Balloon.tcl",
          "bytes": 13870,
          "sha256": "8d859fad46257a6ce45170ec2740bda483ae71d1cae244bb6d605b8fb0397a35"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/act_fold.gif",
          "bytes": 90,
          "sha256": "486a8b71c0f9241a5bff2b275e8f011349076bf4fdd777ed1458eb050c0633bb"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/act_fold.xbm",
          "bytes": 226,
          "sha256": "7feb01403909a62e682c5a2832dd1f63d11fcf847c0abf0bd2e11b6acde589b1"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/act_fold.xpm",
          "bytes": 458,
          "sha256": "4a636d32b87244f7948859eee4acd512d85ec245cd5a81c8cbeb4fe12b8d74ce"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/balarrow.xbm",
          "bytes": 127,
          "sha256": "ed4c68519e2d603725cec0f0d892c740a257ec2f38cf0344ec819abd62e9b26a"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/cbxarrow.xbm",
          "bytes": 269,
          "sha256": "ce68aac68ba116cfb47b9f3556c058ce30c92f0832341c2632c9cd4d8be8ad5f"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/ck_def.xbm",
          "bytes": 260,
          "sha256": "592d27ca23ad113c37a16e7da7d67ea28a51571fe24a8baca4838915ddcba641"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/ck_off.xbm",
          "bytes": 260,
          "sha256": "b9d25190c0042f8f25ab0539424df8adeddb5f12bcb9c8ef7d0039ce63cdb93b"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/ck_on.xbm",
          "bytes": 257,
          "sha256": "6fdf18b2c0603c9c6db89134ca7baec9bd3bdfd58f6f592c74614cd81053cadc"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/cross.xbm",
          "bytes": 260,
          "sha256": "b6a9a5a3ef3742bc0f601a0aae673f00e1a88f0b999fa7d6b620473164db2aab"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/decr.xbm",
          "bytes": 103,
          "sha256": "ed764b336a07336d12dd28f0a75940b2e2d47a23ad8371c377560e91bcab192c"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/drop.xbm",
          "bytes": 334,
          "sha256": "9a896927b99efa61981b769bc685e6d411180fe31dc4979fa5d576fc1c7e26dc"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/file.gif",
          "bytes": 76,
          "sha256": "1ad2fbc604ec60116849574bc4dc371f8cb5796e14571ea2684c8bab99b4c467"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/file.xbm",
          "bytes": 238,
          "sha256": "ef733ad2da584a41a4d1bf5525e080c60a5f2f332e7d583ab0003d23e1cdcb71"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/file.xpm",
          "bytes": 316,
          "sha256": "520e7d4a55e1ab59720faf0a7bf31e54fc3b50f3b569c38c458d1943bf0bf731"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/folder.gif",
          "bytes": 79,
          "sha256": "4e03a2fe3cd8a5d64eb924d1561ff838f473c10c3d8d97fbde6762f3a1b44611"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/folder.xbm",
          "bytes": 220,
          "sha256": "e7d82aab810ced6c2026994de6caf5cfa7c2aeba2349701fe914f1dc9ee59378"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/folder.xpm",
          "bytes": 439,
          "sha256": "797aba91bc16d98770751cd17b44a9d40758c442f251e2155b77ca1c42e32ccd"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/harddisk.xbm",
          "bytes": 910,
          "sha256": "0112cd468574b726ee78db9eb9e104882705a204f942ddae14f3c5df2b3987be"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/hourglas.mask",
          "bytes": 985,
          "sha256": "4be19ef1f480d8dfa650c3d0ed635a34d5b08da3a8f9726f28c91834d967272c"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/hourglas.xbm",
          "bytes": 956,
          "sha256": "8ab90aa067db1aedd294b46fa7f47c2320e4a4c5c922445436d7fcc2ec1239a5"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/incr.xbm",
          "bytes": 103,
          "sha256": "12fd1f428aaf57523785319da1df9f6271c86f44adaea467f5020688facc7101"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/info.gif",
          "bytes": 159,
          "sha256": "b007a8c582991388b12891a8b46445de6809ef6d52aaa43bf8d946ac8f9f6d43"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/info.xpm",
          "bytes": 1296,
          "sha256": "60528b4c52b71859000a4688c93490f2c8ad60a4d53324c830cd011d123ebb3b"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/maximize.xbm",
          "bytes": 290,
          "sha256": "120312587a98b09f2462b64684e9aafdc2407c8b15254a1c2b184e58aa518273"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minimize.xbm",
          "bytes": 290,
          "sha256": "63e1b654a0a98a8e291093655eb15e385048134fd80506850b352b6f0df2b0a6"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minus.gif",
          "bytes": 57,
          "sha256": "401e41b99d8c8d2eafa41571b8d321aa419a4ca7ab8136fbe1b0adb86084d3a6"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minus.xbm",
          "bytes": 203,
          "sha256": "e33fa6675c7ecd3df86d581a2d6618e1d311418312167185a7da4c60bb82c862"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minus.xpm",
          "bytes": 215,
          "sha256": "a7980153da9b4706e1368f760950f50853739f1c6c29c4a59ab0c4df5f188a3f"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minusarm.gif",
          "bytes": 59,
          "sha256": "cfe867e18c427aa88d5e2404a01aa22d042212222e8304b25275a400e650d1d8"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minusarm.xbm",
          "bytes": 212,
          "sha256": "079c3e9257032eabb0f6e400b13540e5cbc93fecee5eeab58b463a2b5e2de279"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/minusarm.xpm",
          "bytes": 235,
          "sha256": "6a848c63bc2e49ebe2cff0518879a24c680f0322d672e0b171a709af317d3eb2"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/mktransgif.tcl",
          "bytes": 263,
          "sha256": "e32db60b06f6c696668e9922c3f4494e6ae5e5987e0f7bf54e43d7ddeef92dfb"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/network.xbm",
          "bytes": 907,
          "sha256": "cd590da62995aee324d238ecfc8a018932cfb47f3b409c54c8ee141419c9993c"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/no_entry.gif",
          "bytes": 176,
          "sha256": "5acb672d97f4adf4ae8d31b3968a1a17dfa66c35d74a1da262f14c12615d3f56"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/no_entry.xpm",
          "bytes": 1313,
          "sha256": "fbc7cf43867aa7cd42ab3b5ee444787aac11000bdd56ea1c612f287706e75201"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/openfile.xbm",
          "bytes": 226,
          "sha256": "997e09f07f38db012faeb93ff9a2ecb797da126a033ee70bb4e53b40068ac887"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/openfold.gif",
          "bytes": 84,
          "sha256": "b1a7e8a341a1f795f0890116f68368ff4bb0f1e0ce73691719dc24e3927463ad"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/openfold.xbm",
          "bytes": 226,
          "sha256": "93c13e84f98d290ef701259404220c081bdd319c03614a13cff23118dbdd08d8"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/openfold.xpm",
          "bytes": 439,
          "sha256": "917ee346574fa9f63b0a407af52d44fb2a1645f870047599816d944c76105f47"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/plus.gif",
          "bytes": 58,
          "sha256": "16ea40fed8c12bbf64b072bacf6b1c8ca80ce26e08fee7860b98cc9cce44fa64"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/plus.xbm",
          "bytes": 200,
          "sha256": "38aabbddd20ce0f3cec8a4fae12076d3a6af6b66adbbe631b243df7c1905d372"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/plus.xpm",
          "bytes": 214,
          "sha256": "f8a13e2dc9d1e2d64fc97a1459355035275eaef5246041ece0aa6433727fa213"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/plusarm.gif",
          "bytes": 60,
          "sha256": "6fc4098826ca6e02ed0be4060014861e494913e6684abec63b022d60c1c73011"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/plusarm.xbm",
          "bytes": 209,
          "sha256": "d203e21013532585774695fa825cc5e9fdd61cbb6d003d5a81ea5708f632943d"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/plusarm.xpm",
          "bytes": 227,
          "sha256": "29028826c570486b84309eac36a44ff4ec075f4bc6524fcf670bb15a6ac2d9d3"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/resize1.xbm",
          "bytes": 313,
          "sha256": "e922248c4442f0dc2649395fa3daf6e632fe2535c80f0b08cf3e437da90c6a40"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/resize2.xbm",
          "bytes": 313,
          "sha256": "da1a4e91a087f0ba61ac8a6041e196cdcd83e4bf439ba40d184e35017961b70b"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/restore.xbm",
          "bytes": 287,
          "sha256": "ef817004da4f01a79b2b7d938d9958b86bc20b3ce25d19ed67d4a73373781ad6"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/srcfile.gif",
          "bytes": 79,
          "sha256": "36cb7cca5a262c77937b45b9ed3eac3cacc85181c133c45913fac7481221197d"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/srcfile.xbm",
          "bytes": 247,
          "sha256": "369b3ab49934fc1042a6334c1582f98f5571e8dd946b371ab9eb62124608043a"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/srcfile.xpm",
          "bytes": 312,
          "sha256": "3890463645a661c5de044fab923cd5e3ffa2a02869ba6f750230de74da58eb12"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/system.xbm",
          "bytes": 284,
          "sha256": "9b6cb3257d649d1f5fb3b244b9c1e69f0e0435421e8ebe1994097e1b4020b0fe"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/textfile.gif",
          "bytes": 79,
          "sha256": "3b53a7da944e77d00ebb1b352ece6b6e50572e0222678087b86bb163a3969150"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/textfile.xbm",
          "bytes": 250,
          "sha256": "b5dca68ab0947b6c797ba946911b3925fded77a97992079bda14b81a338c799f"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/textfile.xpm",
          "bytes": 320,
          "sha256": "6d30e5711ba26d348c2fe18c510fd4997d1a9e78e32085060f0ccd87674a0bfc"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/tick.xbm",
          "bytes": 257,
          "sha256": "70920a3c0f5135827ccea0b18368f330dca166b6c1530d687a6d85a7f4d24276"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/warning.gif",
          "bytes": 180,
          "sha256": "4855ae49469c2c9aa238564d41c57e75ccd4a391156b273a042096382cd3c732"
        },
        {
          "path": "python/tcl/tix8.4.3/bitmaps/warning.xpm",
          "bytes": 1300,
          "sha256": "a74c0abaa65318caa8d118955ac0cce9c81e585ae2079c635c16d911debbf3fa"
        },
        {
          "path": "python/tcl/tix8.4.3/BtnBox.tcl",
          "bytes": 2791,
          "sha256": "e7d18e16f26125a2bdb3c972aac52897a7d3e8630a0da541916bffcfcdafa624"
        },
        {
          "path": "python/tcl/tix8.4.3/ChkList.tcl",
          "bytes": 5326,
          "sha256": "c60d13aa1304a2fadf5abe57ae426c5ce92b5d88eabb4f9d088a58d75966f4f2"
        },
        {
          "path": "python/tcl/tix8.4.3/CObjView.tcl",
          "bytes": 8098,
          "sha256": "6fc5e7d99e1eac0bc9ade139c76bc8d0fce72760ecd500d43cf390e69d6e5118"
        },
        {
          "path": "python/tcl/tix8.4.3/ComboBox.tcl",
          "bytes": 37829,
          "sha256": "c794fd78fc3ceecbe92f021526750c6640a34bc38b361f55f84b97f64a34a15d"
        },
        {
          "path": "python/tcl/tix8.4.3/Compat.tcl",
          "bytes": 903,
          "sha256": "d225201425fa2345b1014561a039140f24c3503c47d621fa38f07be72d40726b"
        },
        {
          "path": "python/tcl/tix8.4.3/Console.tcl",
          "bytes": 15923,
          "sha256": "98e52fb9406b39ba950106b69a137506022868fdc34e34539aa38d5e86aad2a5"
        },
        {
          "path": "python/tcl/tix8.4.3/Control.tcl",
          "bytes": 12884,
          "sha256": "053533c4fa7798d427252714834fa3f0645bca63ca26f2492a44efab87342afa"
        },
        {
          "path": "python/tcl/tix8.4.3/DefSchm.tcl",
          "bytes": 3116,
          "sha256": "88c55e1607aa54af15d8926df4eb3a53e4db3145c0db2cfa179bee78cdf87755"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/about.xpm",
          "bytes": 2360,
          "sha256": "24805c306d3a88dc8274fa0c4225093a7404720fc0d8b294fc803d444965f0d4"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/bold.xbm",
          "bytes": 290,
          "sha256": "cb91ddbcca2dde4df8520a857370efdb5568f544113306de43662e1b814c6a3d"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/capital.xbm",
          "bytes": 299,
          "sha256": "e52e47bbc624e9e9c27acbd652565c2840aa7e53e6c841006dfb2c619d6ed828"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/centerj.xbm",
          "bytes": 299,
          "sha256": "2b5d6f8592e2bc6f4c4c56947d21e37c91f5f5c3e5795ae408b632d284efa35e"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/code.xpm",
          "bytes": 642,
          "sha256": "ef34bfc2d0ed60c004ac50237481be5e57932638a7495dc5c8fbe08134a4e29c"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/combobox.xbm",
          "bytes": 910,
          "sha256": "ca2dc0dab17cf9ae12b98a242d14ecd4f86324c13bd974c48f7bc93903114492"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/combobox.xpm",
          "bytes": 2367,
          "sha256": "7479460890f5e0d184b484b39d34cbdbc423f13c88b59376bff60a441dda9dfc"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/drivea.xbm",
          "bytes": 904,
          "sha256": "459e941ecd87984672bf1255da19a8de74f114e173e838f6b85ac734e7ef5fd1"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/drivea.xpm",
          "bytes": 1414,
          "sha256": "05164d5becdda54104b20bc8f7358f627be9f2602d6b3e344a3033d92e73d148"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/exit.xpm",
          "bytes": 2341,
          "sha256": "06b4bec92f4b28afc161359e66a76cf20c32409d98d5b4d2201679bad5fd9300"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/filebox.xbm",
          "bytes": 907,
          "sha256": "3c88d5a7bd7d3715c883fc14f03749cb273bc591a654fa57ee2e857ba6865919"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/filebox.xpm",
          "bytes": 2359,
          "sha256": "55f5f55324bda873d0ac1888823f1fd078ba8d7910159026c66540538f0a41a7"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/harddisk.xbm",
          "bytes": 904,
          "sha256": "459e941ecd87984672bf1255da19a8de74f114e173e838f6b85ac734e7ef5fd1"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/harddisk.xpm",
          "bytes": 1414,
          "sha256": "05164d5becdda54104b20bc8f7358f627be9f2602d6b3e344a3033d92e73d148"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/italic.xbm",
          "bytes": 296,
          "sha256": "19476ddc404a077fb5d07044453d003fc7043f7cb3e4942525631ce19e129491"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/justify.xbm",
          "bytes": 299,
          "sha256": "09ef1cec38c60bf480d4a955ca60a67e78b27571025fd7fe9de43650aa22a044"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/leftj.xbm",
          "bytes": 293,
          "sha256": "cc37ebc5f953c8dc851960de244de639def70d79065859e908d6444cbe50a6e5"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/netw.xbm",
          "bytes": 898,
          "sha256": "9efee21d14731a4d7b3bd7d9e3c02198bca7195173e009c25ef54a7538c93780"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/netw.xpm",
          "bytes": 1431,
          "sha256": "068e6f025c1e4bb5b019ff51416fcedd4e5d211d5fca99412b19ded1295b2556"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/network.xbm",
          "bytes": 898,
          "sha256": "9efee21d14731a4d7b3bd7d9e3c02198bca7195173e009c25ef54a7538c93780"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/network.xpm",
          "bytes": 1431,
          "sha256": "068e6f025c1e4bb5b019ff51416fcedd4e5d211d5fca99412b19ded1295b2556"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/optmenu.xpm",
          "bytes": 2337,
          "sha256": "bad1392a412bdc5b8c9da18bcfb5e92d7623875ffd49e321dd8f322039238302"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/rightj.xbm",
          "bytes": 296,
          "sha256": "58b8d96204593545ee5673cf4d5e09b14c7b922bc95dfd0af7310691cd5e5631"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/select.xpm",
          "bytes": 2408,
          "sha256": "b13247f797e9ba8d9ee80b3ad356bf7f24fdad80386a7ab3937dbfd25323ee95"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/tix.gif",
          "bytes": 11042,
          "sha256": "db223d088b0b41ea77614ec7fbfcde1132f68b2e1c3e40c7c1871a541df625ac"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/bitmaps/underlin.xbm",
          "bytes": 305,
          "sha256": "4b14b64e1d86de5a5528978f0c5457127b983f41bbbff39caa4a03c1e466b51c"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/MkChoose.tcl",
          "bytes": 9221,
          "sha256": "15855b365f76e23cec3629ad97d7fc52ba673538026d11851cf59d2f725d0443"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/MkDirLis.tcl",
          "bytes": 2087,
          "sha256": "1f55ab4debd9928f5735e6b819fa9e59461649e69aa708c94ab617e4c3068c3c"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/MkSample.tcl",
          "bytes": 7008,
          "sha256": "3fa4e078758eb8a77158b9b7136aa8608f23753a0e541f97082c434508eefab3"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/MkScroll.tcl",
          "bytes": 5283,
          "sha256": "73ebeeca09e42a09b52b9b9cda74dc7b1442189e55d695e40f080111bae5d1b4"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/AllSampl.tcl",
          "bytes": 5001,
          "sha256": "8109f373097ed5de015e9fbfdf6fc8ce38e0f62b04d6ba103584ae773967afbf"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/ArrowBtn.tcl",
          "bytes": 4952,
          "sha256": "996236d970676ef16c670f7b13aefcd17805bec57abad679c6bff36908bf3061"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Balloon.tcl",
          "bytes": 1769,
          "sha256": "89b2310e8294fd5cf42d6f8def61a4634090dcc825e4524b34015e56f76ee0d6"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/BtnBox.tcl",
          "bytes": 2051,
          "sha256": "6844a0af067a3c68d1a953cf8cb21cbef2fa9c04985deb4abea643bfd35c1993"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/ChkList.tcl",
          "bytes": 5487,
          "sha256": "7f8f6f64db23da5c647e80b9fa3dcee09226d01cc2cb7ae2b9d54065c710599e"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/CmpImg.tcl",
          "bytes": 2023,
          "sha256": "5dc11a3dc49afdb95d7fc693c45d939cab0cda1027a8507dea015fdf5b8cc6a3"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/CmpImg1.tcl",
          "bytes": 6163,
          "sha256": "aa89dae58d3b9b9a10a162f5b71ad72f3f25f89f464ae516539344603fb75bc3"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/CmpImg2.tcl",
          "bytes": 4649,
          "sha256": "fcbd3916070c96685686a53ad1d96c71cd318cb4412a589c3339c0e32dabf7a0"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/CmpImg3.tcl",
          "bytes": 2621,
          "sha256": "e7b212552a1894aa206d893d7482db1043f540a0ccf6e75c1149224d750c4f02"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/CmpImg4.tcl",
          "bytes": 4430,
          "sha256": "1e9f30e018befa4975c07c316925a6dd44c12513b33e7728f634a5c9fb47438a"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/CObjView.tcl",
          "bytes": 2654,
          "sha256": "f0816b6a13f3e73dd47f5efb4d8821cfff3a51e5b259dca240f8897546413b08"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/ComboBox.tcl",
          "bytes": 3665,
          "sha256": "41bed1e52e830d86c1cc69c2054e3e4078a17c29aec0f89e217d39a6a3f9ad96"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Control.tcl",
          "bytes": 3721,
          "sha256": "00603e5e7409dda458d5d11f45fc2e77e71e93ee846b2b1021a429002145dd45"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/DirDlg.tcl",
          "bytes": 2587,
          "sha256": "771000f308bab1fb8b6878f98d3bb051582c1a28baa0202e9d61730f25036517"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/DirList.tcl",
          "bytes": 2848,
          "sha256": "e18eba1750aa57f3a447a43141f9d7b3e96da2a9af8604b1dab7d75959239ae4"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/DirTree.tcl",
          "bytes": 2825,
          "sha256": "8c1e0d2fe64ce8dd844d812a1aaddd3a509b01d2520dc00a8ae64a0b8d3f9a78"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/DragDrop.tcl",
          "bytes": 1662,
          "sha256": "2ca6a4bb39b6de4decabc03077dc2ce035364fd8ed597069246f020ad451cbc8"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/DynTree.tcl",
          "bytes": 3916,
          "sha256": "32e4def921ad1727e7b0cebbf17e0dbcbda2f20e4b5a6271afe4c31dc7acaf17"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/EditGrid.tcl",
          "bytes": 7019,
          "sha256": "94ff581a620a08c4c5ac9ac16a7efdd6dae05f9d16d9aebdbe3e3f0cad7ea712"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/EFileDlg.tcl",
          "bytes": 3226,
          "sha256": "976507a1bb4130f3057ceb9abe14d3d8d1df162234f185b1336f9c28323606e9"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/FileDlg.tcl",
          "bytes": 3111,
          "sha256": "f92751d5ac23ba3c11d8c5db5ffc48e4853c3dd9452dacfa7340dfead62dfd17"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/FileEnt.tcl",
          "bytes": 2295,
          "sha256": "a89e7acbf7edb46b8bcd0adc2c7e679d8f0cf586e2190e0131d6dc938087bdd2"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/HList1.tcl",
          "bytes": 4794,
          "sha256": "783589db01d682d4cf114562799a93225f44334af8757eb628d32e57955d81ee"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/LabEntry.tcl",
          "bytes": 2867,
          "sha256": "88899f54110824d56d7fb57f5ecd5b97eaa7984c13e53dcec05d1ba1f3e8b8b7"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/LabFrame.tcl",
          "bytes": 2872,
          "sha256": "8441a5c63a17c64dd25f1e0d4ec18f9bbf404b123a3b99028d3d24e4c7729aae"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/ListNBK.tcl",
          "bytes": 3026,
          "sha256": "c572f3afd878913df6567c94c0fdb5c4257097fc1b93549f8a1302060f04484f"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Meter.tcl",
          "bytes": 2242,
          "sha256": "80c41b77b7de14ad5a0f6d91f3722912dcbeb5b04fa2fa040f7aab013ea1d12e"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/NoteBook.tcl",
          "bytes": 3711,
          "sha256": "26c4d9cfcd0dd1fbce26f84b060da7e785f855910bbb8744abbb8a301505546b"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/OptMenu.tcl",
          "bytes": 3250,
          "sha256": "e9db817c08731f0a67dc7351502ba046bece067e781e910fc2fa0d4094557352"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/PanedWin.tcl",
          "bytes": 4335,
          "sha256": "009a882ecabc3ada6e381d4d6ef0118bfdb6d1f7fc7bc6d3dbc5baa7fab47651"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/PopMenu.tcl",
          "bytes": 2436,
          "sha256": "0e9d20c60e5ffcfad32b3dc011cc36071c722ed10188b0732c2c0e7af3e18afa"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Sample.tcl",
          "bytes": 1065,
          "sha256": "e4c09fafc512d7c43674534cc52c8c08b9e6dfb023a39416ab723cb339be9ac1"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Select.tcl",
          "bytes": 3433,
          "sha256": "047a63479cec283e73987346cb9af9dd0157f39afb4669509c5bf7ebbc1d16de"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SGrid0.tcl",
          "bytes": 3573,
          "sha256": "988106b37c6e5993693d18a03368d0e1a84b8f95114b1832201c6361ff3c9e1c"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SGrid1.tcl",
          "bytes": 5633,
          "sha256": "cb0388c09b46aeb8828b36e6c3dd804456339731346c4839b2d6e87aba31e6c8"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SHList.tcl",
          "bytes": 3208,
          "sha256": "5884fea04ec99096d649ad1c7d389d179c05b6cdd5641667270c1e2b73d3990c"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SHList2.tcl",
          "bytes": 5092,
          "sha256": "c4f0a6c494c789b5e5b5f3ce4454b116da9a57b92caae28ea767280e1fd66f55"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SListBox.tcl",
          "bytes": 2949,
          "sha256": "2b2735cbb38b8732aa0c6f21cd551daba46b7f87af90dacdb62ce1e504cb2b8a"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/StdBBox.tcl",
          "bytes": 2351,
          "sha256": "df32e7616d982d73278fba4e418e9fd78777caeff9c08a0e8c1b86b3962e8910"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SText.tcl",
          "bytes": 2617,
          "sha256": "215b50d920b10740acc10ddf4f6ebfe5123ef8806d5099c1906d424cdaca0525"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/STList1.tcl",
          "bytes": 1612,
          "sha256": "95d4ee51467f8b4f8ea2ec1031f122181f12f66a1f408d343c55c4c6b5150f3d"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/STList2.tcl",
          "bytes": 2473,
          "sha256": "a96ed8063a1579c0895b9ae8d93e77de2120d93fe751a4fea58d2babbff1b20b"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/STList3.tcl",
          "bytes": 3090,
          "sha256": "b7f04fc61aaa7167bf7c1aa8be5ba59556015e30b084f1eab9a5f040ac4d9d3a"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/SWindow.tcl",
          "bytes": 2807,
          "sha256": "63bbfc5cb9977fe801da0fd33352027c13def4ce851ea7f4b2255fbea36ef5a5"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Tree.tcl",
          "bytes": 2744,
          "sha256": "22396dd36fbdab8ea59ee5a8de697398a63a86a1763cea84b9d7f9d5405d5407"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Xpm.tcl",
          "bytes": 3009,
          "sha256": "a5cd5eed2739fcd01d7f2f5942c65f8e3d3deff281c4a8e8fbba80df37e379ba"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/samples/Xpm1.tcl",
          "bytes": 3557,
          "sha256": "74634645297a240d0c216d6455c2fe918af2857a1f0975a3ff0b11b6f1633193"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/tclIndex",
          "bytes": 3897,
          "sha256": "d94e63965733460544427beb671228ed11123ffa51ae8d1d28fb04ad2b81f88b"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/tixwidgets.tcl",
          "bytes": 9356,
          "sha256": "a4c9022069cf000a5ee4a77dc537acb107fdff1d3672f7b044870983fb6327b2"
        },
        {
          "path": "python/tcl/tix8.4.3/demos/widget",
          "bytes": 13761,
          "sha256": "82fc32fc51612270de8d70cc14a20ab2428f50a782df707d2aca1083f0455f91"
        },
        {
          "path": "python/tcl/tix8.4.3/DialogS.tcl",
          "bytes": 4471,
          "sha256": "0101a4a368908409e8d2ee3cbf4dad1691b28ae68354676002962e4ba6de31fa"
        },
        {
          "path": "python/tcl/tix8.4.3/DirBox.tcl",
          "bytes": 5632,
          "sha256": "ce99218b3ac5eaff04883f0ab4e7f6aec39c9c7f13b2a9ada78b8b6b257fa702"
        },
        {
          "path": "python/tcl/tix8.4.3/DirDlg.tcl",
          "bytes": 2301,
          "sha256": "22185ff1362e6a9be6f363d096503bbd4dc120ba6c64e562c6c15ec5699754e9"
        },
        {
          "path": "python/tcl/tix8.4.3/DirList.tcl",
          "bytes": 7336,
          "sha256": "8447068c3dfff842005c7d40103b90fa7707d3b1818f6f0cc7385dafd9f54ec5"
        },
        {
          "path": "python/tcl/tix8.4.3/DirTree.tcl",
          "bytes": 9322,
          "sha256": "fadec5d82ab5755f5a9461e5c6eb9d5a2a6cac4d5aa7bf6e70ac0989cdf9e30f"
        },
        {
          "path": "python/tcl/tix8.4.3/DragDrop.tcl",
          "bytes": 4191,
          "sha256": "3eb7eaefe9e626ddf9f13ff022a325bcaad3433adcf0528d076a89d3c93b6b3d"
        },
        {
          "path": "python/tcl/tix8.4.3/DtlList.tcl",
          "bytes": 1051,
          "sha256": "4173db98595abf7ad6082192e147d21274f6d6d240f97a32b229aa573849bb1e"
        },
        {
          "path": "python/tcl/tix8.4.3/EFileBox.tcl",
          "bytes": 11826,
          "sha256": "26bec1eb5d705e17f4700e0889ec902417b50dec5a9570e5225216d413d0d115"
        },
        {
          "path": "python/tcl/tix8.4.3/EFileDlg.tcl",
          "bytes": 1783,
          "sha256": "e52a51a4dfa9ecea0b57010407ef5584363d947d6eaf417e1ff404876050372a"
        },
        {
          "path": "python/tcl/tix8.4.3/Event.tcl",
          "bytes": 5448,
          "sha256": "9519af49109264b006305ece5f6847f1e7b82e6f88812174d1d7be6d8e00db9e"
        },
        {
          "path": "python/tcl/tix8.4.3/FileBox.tcl",
          "bytes": 14904,
          "sha256": "b7c9c936e2cf490272a9b0f821c36cb3bb58f251b428e74c071cea9b31a1b726"
        },
        {
          "path": "python/tcl/tix8.4.3/FileCbx.tcl",
          "bytes": 2591,
          "sha256": "6c00108d75ef779467551dad23e141a7a670050d3320d4765d1b0b56a8573258"
        },
        {
          "path": "python/tcl/tix8.4.3/FileDlg.tcl",
          "bytes": 2260,
          "sha256": "4ba9f99f0074b1e26a36b1dcee801850b795b422bc6716467d92a80dbc17a2b5"
        },
        {
          "path": "python/tcl/tix8.4.3/FileEnt.tcl",
          "bytes": 7589,
          "sha256": "29dd4c57ec57052045df06245ab582522a4e55eeed69036e9288e9c208e84b9f"
        },
        {
          "path": "python/tcl/tix8.4.3/FloatEnt.tcl",
          "bytes": 3308,
          "sha256": "1d042097dbe2a3b8940bacb8bb5f5746e52bb2cb224441859fea9d5a4bbc0074"
        },
        {
          "path": "python/tcl/tix8.4.3/fs.tcl",
          "bytes": 4165,
          "sha256": "f6283544be918381872d3b483d6ef1fe240a6dcd45ab013a28eb9866644a08f1"
        },
        {
          "path": "python/tcl/tix8.4.3/Grid.tcl",
          "bytes": 22787,
          "sha256": "bf9dd6af9feb5f50c9c47766263d6a11e8780dd78644892518a4b7c8dfbfe412"
        },
        {
          "path": "python/tcl/tix8.4.3/HList.tcl",
          "bytes": 19065,
          "sha256": "913020628f9116a78afd4f615f7eb707511a489499b4bfbfaf6eed76a052a3fa"
        },
        {
          "path": "python/tcl/tix8.4.3/HListDD.tcl",
          "bytes": 4704,
          "sha256": "c3e2afae1e4d072934c8ee5ec2d6fff8a07515026a82122569b709915edeaa67"
        },
        {
          "path": "python/tcl/tix8.4.3/IconView.tcl",
          "bytes": 6382,
          "sha256": "f184720a70d0e71aaf6199304a6bb2073efa180571d097585dc7f219fa35a37a"
        },
        {
          "path": "python/tcl/tix8.4.3/Init.tcl",
          "bytes": 6431,
          "sha256": "69c1294fbf03f83d84c541efef1fdcb915f668de86532b00a793a33082b50b14"
        },
        {
          "path": "python/tcl/tix8.4.3/LabEntry.tcl",
          "bytes": 2229,
          "sha256": "4e6fd36cd91d0cf5fa66ba426ac0d3d8d081bca1f2a63c4cdee9c7cfe1054ac1"
        },
        {
          "path": "python/tcl/tix8.4.3/LabFrame.tcl",
          "bytes": 1230,
          "sha256": "ccbdb56014474f646ca69b8efff19183b1c46185c4b3de1ea5c6766107d1a853"
        },
        {
          "path": "python/tcl/tix8.4.3/LabWidg.tcl",
          "bytes": 4108,
          "sha256": "d7f6c2b4b93eb9969b8f40d6cb268abffd1d7ade4270016a7a4166489c837720"
        },
        {
          "path": "python/tcl/tix8.4.3/ListNBk.tcl",
          "bytes": 3734,
          "sha256": "868912a8bbb69d8ef266347c40955eeab186e60d83d1ba17cc28e305a1dbd14d"
        },
        {
          "path": "python/tcl/tix8.4.3/Makefile",
          "bytes": 66,
          "sha256": "ce1660f59b8eb4ef49b6659a839b98d833a163d4e48838cc40689b63b8e6e40f"
        },
        {
          "path": "python/tcl/tix8.4.3/Meter.tcl",
          "bytes": 3251,
          "sha256": "69f2e71bf5030bc04efe0249ba153c19625faaa898c7c2fba82ff94e1ea4e19d"
        },
        {
          "path": "python/tcl/tix8.4.3/MultView.tcl",
          "bytes": 3861,
          "sha256": "ed25f5447d10d516e063f76b124e56d5cf7d83f15aaa8e3997c966d6ef913247"
        },
        {
          "path": "python/tcl/tix8.4.3/NoteBook.tcl",
          "bytes": 6407,
          "sha256": "7e0c454c4015be7807c8a5f3265f1bdf4df7711c55f6e17322fff716366509f0"
        },
        {
          "path": "python/tcl/tix8.4.3/OldUtil.tcl",
          "bytes": 3164,
          "sha256": "86608d55ba5a374e5f34c3d0309138c58658ce437072da5e470d9faf59bae712"
        },
        {
          "path": "python/tcl/tix8.4.3/OptMenu.tcl",
          "bytes": 9786,
          "sha256": "d3b5df03dc0ef449d75e91acaaed9bd7e6a1d30cef079e5bd50479892e6b0a71"
        },
        {
          "path": "python/tcl/tix8.4.3/PanedWin.tcl",
          "bytes": 29562,
          "sha256": "4883f6355fdcf66fe229f10cb33a2c5609cf2de7ac5e241875ad828f7add03aa"
        },
        {
          "path": "python/tcl/tix8.4.3/pkgIndex.tcl",
          "bytes": 154,
          "sha256": "64c64e7b58a13810daff8fc3aca3aa26d790269a6c9f54e161c2fb987a30e5f2"
        },
        {
          "path": "python/tcl/tix8.4.3/PopMenu.tcl",
          "bytes": 5739,
          "sha256": "2565b9f95ffb0aa2eddcdd1c5efd05f480deabba11425c217647504674f67628"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/10Point.fs",
          "bytes": 664,
          "sha256": "5ae702df92cedd70cddc9ef51f756bde17e23f1c5cf6a5d3fc2b9559e05b26fe"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/10Point.fsc",
          "bytes": 2090,
          "sha256": "c0d99286eae3e39f121acb971830813298b7f98b01e1341f362302c1378a4d83"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/12Point.fs",
          "bytes": 663,
          "sha256": "73696fdf63c9c8cd83624ee3a1e95d18688db9c8f5b2fba767e9abac5b321e55"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/12Point.fsc",
          "bytes": 2089,
          "sha256": "3241edc24ad328801ca6f65db7f7566cfaf17a38a3be907b5620d9d9fa885aee"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/14Point.fs",
          "bytes": 661,
          "sha256": "8820f5ec1f4a756235f227ac00e524e0b974341f0f796fc2b269a8f6a832cfec"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/14Point.fsc",
          "bytes": 2155,
          "sha256": "718ff155cbdeb67468939b93a9efdba9585f526d40526b80d4dde98ef7254c6b"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Bisque.cs",
          "bytes": 1063,
          "sha256": "25a34d43afdff0dbb6ef04308ac0b97cc89343e4ee065ecb61c7d3369b83c589"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Bisque.csc",
          "bytes": 22877,
          "sha256": "3ba01c10024b474c2f6b61a6d54c92fd9f95ec4c03a2f3ae6cb806a401004ac0"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Blue.cs",
          "bytes": 1080,
          "sha256": "38dc4760292c2c3182b893e48cdc028502bf97e8d12b8f62596f8296d6526595"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Blue.csc",
          "bytes": 22890,
          "sha256": "209c569c02c014a3ad40faad4603d8248c9aa457339bea9eea0fd83850717d64"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Gray.cs",
          "bytes": 1081,
          "sha256": "192dfa09f01124f8eec3e46e2ba26bf5291f91b723c2515645dfb3c10859b307"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Gray.csc",
          "bytes": 22891,
          "sha256": "86bce61b378d6ee3bbc306ad40ada70f46c528966b3b3f28df7d0d702d26f04f"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Makefile",
          "bytes": 882,
          "sha256": "830a896c087a5d6dd7ece2396fa8eb7424b80f7de1e4b7747b87798139f58848"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Old12Pt.fs",
          "bytes": 555,
          "sha256": "06c0685af83fcb93d8e9c9fe05b3b87e6ff97bfd07bc22b68858eb66f3df1d24"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/Old14Pt.fs",
          "bytes": 512,
          "sha256": "27c79803b703e84d2c228dd365b52eeb66c2ae95ed21a5419dcb476b5b029ecf"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/pkgIndex.tcl",
          "bytes": 271,
          "sha256": "1c9e2e43331a73b84fee2a7be29eda696ddb650412ba62a11ef97ba53b021a64"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/SGIGray.cs",
          "bytes": 1064,
          "sha256": "d875f29b4a7c0e462396c40bb9b5b2798d777d53e3dc51280c11222ff5b40e25"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/SGIGray.csc",
          "bytes": 22876,
          "sha256": "feb596c01617784556b7e11d3fb29f0f6453d4da3a46e60405109f90e9f4e573"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TixGray.cs",
          "bytes": 1062,
          "sha256": "ba5807e0ab2867b6e31fb2539b61c4f1253474a07767dced095c806e61d2aa4c"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TixGray.csc",
          "bytes": 22878,
          "sha256": "4805333c38118a33b9f7918601fbf23b66ead7280a21f962165eaf8e788e32d0"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/tixmkpref",
          "bytes": 10032,
          "sha256": "9c87861571ba882cecabb5a00cb771b3ed3cd2dd87851c2bc26c9a05abba6ed1"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TK.cs",
          "bytes": 1059,
          "sha256": "776ae50d94a64df358ae46d8fa8c5eb493fdc664696167548a0311d0e897c6e9"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TK.csc",
          "bytes": 2095,
          "sha256": "85b07443a34f2d04c6603654f2d0b7637c7ec4b2394cc025114804b47bfc205c"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TK.fs",
          "bytes": 522,
          "sha256": "59a38ddde6ab3349dae5a81f4e5c889e99a8752336fe5599ff0a385c71fa129b"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TK.fsc",
          "bytes": 588,
          "sha256": "8d60dbd699430f60471971f7431e2ae769a46da938dbfe79765375a30ce2f176"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TkWin.cs",
          "bytes": 2314,
          "sha256": "153f6332172525be0ee58a80bf8515d400d0d829078caa3e1fe3bdb7f6b5c389"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TkWin.csc",
          "bytes": 22635,
          "sha256": "88edda70c62895ad58df9bb8f2af3e8246c134269eeb9855ab1d70ea7b7b92b0"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TkWin.fs",
          "bytes": 406,
          "sha256": "b51bf585a338ab96bff080855182a5e29330ee2cf7716463914f017fa7ac02ba"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/TkWin.fsc",
          "bytes": 1708,
          "sha256": "9fe061aa39e450768c58e77aa39b0ea9c980e60d8f9505afa9934d5439b6758a"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.cs",
          "bytes": 1497,
          "sha256": "638882f34bb3caeef3f0f1bd4997a123de116af0b16289e62a537e4e63f6827a"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.csc",
          "bytes": 14882,
          "sha256": "f32a52bacaf45cee173d6d4982a39a9734ba510db15f081d5cb6a9f2ff955700"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.fs",
          "bytes": 778,
          "sha256": "3c95d51b28cdf09c97990e6ba11b1f3e294419ed678771e2054115e7fb002bb4"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.fsc",
          "bytes": 2241,
          "sha256": "77722943e8b234fdaba9b85206a3188913fc1d423faf45cbff87d3164ee63e52"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.py",
          "bytes": 3597,
          "sha256": "3a639975edd8a50c6d9ad0dc1fd50c2cb9213f1f8d2879ba661c6a9ce78b3dd3"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.tcl",
          "bytes": 34898,
          "sha256": "186de6b0a494b36ae97ba9237f9ffa03f38f670e855ba0e72bf0ef192e52ebe4"
        },
        {
          "path": "python/tcl/tix8.4.3/pref/WmDefault.txt",
          "bytes": 4466,
          "sha256": "1800c8ec457feaef748762c8059251e5c8f160f004b7a83e1f9a50da5b68e6b3"
        },
        {
          "path": "python/tcl/tix8.4.3/Primitiv.tcl",
          "bytes": 10955,
          "sha256": "ef1ff46f0169258ae2f0ac0fd840d3f58231c6825060b787a3f0f8a5052752d9"
        },
        {
          "path": "python/tcl/tix8.4.3/ResizeH.tcl",
          "bytes": 13752,
          "sha256": "9cd973d3de2385a0f665ce1c8bf2a8ada490f6eb396a4e620dce31e72a0d120f"
        },
        {
          "path": "python/tcl/tix8.4.3/Select.tcl",
          "bytes": 7504,
          "sha256": "b67b23f24c5f4334bb9da6c0db8fd664f2903879ca64bd1804993df9e1635af8"
        },
        {
          "path": "python/tcl/tix8.4.3/SGrid.tcl",
          "bytes": 6178,
          "sha256": "eb657acb453c6e4c2e60edcae955b76ec61f07951186f14b901d35a6163922fc"
        },
        {
          "path": "python/tcl/tix8.4.3/Shell.tcl",
          "bytes": 1129,
          "sha256": "f23170ab8c06c831c16d4437abfe5937fedd3e4810ed5bc1be39b1c73c6efe7d"
        },
        {
          "path": "python/tcl/tix8.4.3/SHList.tcl",
          "bytes": 3933,
          "sha256": "b16b5135862e52f427d684ec6507b6d13426575fe80b4efbbe2e6ba70579bde9"
        },
        {
          "path": "python/tcl/tix8.4.3/SimpDlg.tcl",
          "bytes": 1204,
          "sha256": "a937709b31c0c7da5f3fac25a962945755c64a1aab66f226f09d28fcaa4b78b0"
        },
        {
          "path": "python/tcl/tix8.4.3/SListBox.tcl",
          "bytes": 7433,
          "sha256": "5a223998f63d38ec72bf3e9933e7aec7761bdf7b41b07a0b533eb82085af1e05"
        },
        {
          "path": "python/tcl/tix8.4.3/StackWin.tcl",
          "bytes": 2076,
          "sha256": "6a959445d5f7257e471275328a965de8c65cd89d6bc6fabe8008ee2bff3a75eb"
        },
        {
          "path": "python/tcl/tix8.4.3/StatBar.tcl",
          "bytes": 1395,
          "sha256": "879632d5829f53a37efb21bc953eaebe353983bf0a56fd94b42cb83e57fefec6"
        },
        {
          "path": "python/tcl/tix8.4.3/StdBBox.tcl",
          "bytes": 1727,
          "sha256": "84a04d9dfa793893de0ac79577b6e3d7e73bf6b587de122b486355b12de4f467"
        },
        {
          "path": "python/tcl/tix8.4.3/StdShell.tcl",
          "bytes": 1222,
          "sha256": "aeba32e5813152fc4318068d5a6f5d40f68fea5124c981b8520d829057d21b26"
        },
        {
          "path": "python/tcl/tix8.4.3/SText.tcl",
          "bytes": 3297,
          "sha256": "2682daa8f67c0438696d365284e7cdd57c7c461462b15756755ad5281afec44f"
        },
        {
          "path": "python/tcl/tix8.4.3/STList.tcl",
          "bytes": 2521,
          "sha256": "4b8b15a65b697f7417b2b37e8dcea0b182d5ed243d968ee744a2e6537691518b"
        },
        {
          "path": "python/tcl/tix8.4.3/SWidget.tcl",
          "bytes": 10213,
          "sha256": "7965659057591e4bc091fa276fdfd58670d99d70d264e4a54ac74c3a80e84e04"
        },
        {
          "path": "python/tcl/tix8.4.3/SWindow.tcl",
          "bytes": 7182,
          "sha256": "13e80a6d76aeb91e2fbf5d36d831f3cde55e7b8f54ea5611c5c49fa648179339"
        },
        {
          "path": "python/tcl/tix8.4.3/Tix.tcl",
          "bytes": 10135,
          "sha256": "63fc95a796f3cca4c7f91545e22370b09e52321fc5505379fb4769c22d565bbe"
        },
        {
          "path": "python/tcl/tix8.4.3/tix84.dll",
          "bytes": 370688,
          "sha256": "f3f650a920d4639c2a7a7c937be4740f0081a6fd7e9b8a4e0d37459afce8c4e3"
        },
        {
          "path": "python/tcl/tix8.4.3/tix84.lib",
          "bytes": 34156,
          "sha256": "c538f53e9b662201e7ba7d29295b0e5e24feab94d0982570507fdf6fa7506154"
        },
        {
          "path": "python/tcl/tix8.4.3/TList.tcl",
          "bytes": 18962,
          "sha256": "3e6a976cc1fee5512cedb6ebe8c2d41af922b5650c0ea183e694a3da691dc44c"
        },
        {
          "path": "python/tcl/tix8.4.3/Tree.tcl",
          "bytes": 4890,
          "sha256": "c5bee47b3ad77318370f226fb9199b2330f8ac2de156b37da09dfdffdcb7ef96"
        },
        {
          "path": "python/tcl/tix8.4.3/Utils.tcl",
          "bytes": 11230,
          "sha256": "e879818465f3b7eb33c6121d7f104b1342ee2dc04a2968a112d2c6db620ee903"
        },
        {
          "path": "python/tcl/tix8.4.3/Variable.tcl",
          "bytes": 2664,
          "sha256": "b7449919f74570a9a60453a5e85c9996342b50cf922bb9d643ee81b680c21ed4"
        },
        {
          "path": "python/tcl/tix8.4.3/VResize.tcl",
          "bytes": 5280,
          "sha256": "a5b2edeb99e70cbeff4b7322b6a8958334330d23c1f178fe2ef1a7ad2de4ee33"
        },
        {
          "path": "python/tcl/tix8.4.3/VStack.tcl",
          "bytes": 10081,
          "sha256": "74793e12d762da6483d955f4d3e32096f093906e51e69916b5c383bab663b019"
        },
        {
          "path": "python/tcl/tix8.4.3/VTree.tcl",
          "bytes": 4605,
          "sha256": "e3f96013e5bc6342a8b2023b1eed5b5688dd8e2c84ba1bfd12719162deb9675f"
        },
        {
          "path": "python/tcl/tix8.4.3/WInfo.tcl",
          "bytes": 1005,
          "sha256": "83caabac9926ac5a7cf5dee949199e721f79fadffd1b8a7f81f7f634f658b0ee"
        },
        {
          "path": "python/tcl/tk8.6/bgerror.tcl",
          "bytes": 8806,
          "sha256": "8822365ee279bebf7a36cfdedba1114762f894781f4635170cc5d85ff5b17923"
        },
        {
          "path": "python/tcl/tk8.6/button.tcl",
          "bytes": 21612,
          "sha256": "1f5dd8d81b26f16e772e92fd2a22accb785004d0ed3447e54f87005d9c6a07a5"
        },
        {
          "path": "python/tcl/tk8.6/choosedir.tcl",
          "bytes": 9960,
          "sha256": "35b208e8570b0d1e0ca1c911d4fe02ee3b0cfe5667cf1bdec006cf9d043122ba"
        },
        {
          "path": "python/tcl/tk8.6/clrpick.tcl",
          "bytes": 22112,
          "sha256": "e7aa73828a731dcc9541308aa53ff3cf550a0952fd42c4d86d831f87fb47cdcf"
        },
        {
          "path": "python/tcl/tk8.6/comdlg.tcl",
          "bytes": 8690,
          "sha256": "c7da292ccf5f413e599c3491c331ffd58cf273f8477facb097e6f36cf1f32a08"
        },
        {
          "path": "python/tcl/tk8.6/console.tcl",
          "bytes": 33942,
          "sha256": "9d023dbf3b0fcd25e13502b34f8be63f64da592fa612ebd31c08af4ac27338d6"
        },
        {
          "path": "python/tcl/tk8.6/demos/anilabel.tcl",
          "bytes": 6830,
          "sha256": "15f62112d522570d1bd80aef38ebd292c3886d0e975f883c1f6ec4dcd315c07a"
        },
        {
          "path": "python/tcl/tk8.6/demos/aniwave.tcl",
          "bytes": 3598,
          "sha256": "c4f59254d921b440bb3f6b6cc6fa1b2d24f9d8547a286b98285ec4f0c45702c9"
        },
        {
          "path": "python/tcl/tk8.6/demos/arrow.tcl",
          "bytes": 8351,
          "sha256": "818bd1a13b4afc9ab897da219cfc174c477d1aa55f9db5da005d4e5ae1a03806"
        },
        {
          "path": "python/tcl/tk8.6/demos/bind.tcl",
          "bytes": 3156,
          "sha256": "941ee3f0080d24d6942160813acf9bacab5c52f082756023cd05e3ea28e71b02"
        },
        {
          "path": "python/tcl/tk8.6/demos/bitmap.tcl",
          "bytes": 1463,
          "sha256": "b6c1f7b01f04b7880616e2affe948fc4645bae51a1df7f51e545e0896845f8fe"
        },
        {
          "path": "python/tcl/tk8.6/demos/browse",
          "bytes": 1821,
          "sha256": "d5a6843453fa7beec0589e07351799708b27ca0d3fef640190de01344259f11d"
        },
        {
          "path": "python/tcl/tk8.6/demos/button.tcl",
          "bytes": 1551,
          "sha256": "6ff1e752e51d72d8079b499865afd3c3cb9f4c4fd69e48c0e5ec5d701aa6a1d5"
        },
        {
          "path": "python/tcl/tk8.6/demos/check.tcl",
          "bytes": 2349,
          "sha256": "a5b535512fe3c68183faaa55fb1029b7de651bec1fd0e7f50064d8d73e080ffd"
        },
        {
          "path": "python/tcl/tk8.6/demos/clrpick.tcl",
          "bytes": 1485,
          "sha256": "7e7fd178c20f07b96ff51cb375e6ad422807d026a0c5b57deb5e5acad2661783"
        },
        {
          "path": "python/tcl/tk8.6/demos/colors.tcl",
          "bytes": 5101,
          "sha256": "fde271dc94cc6d81ec874188e80fcdd8854a40fb1c45f6ecbfb9cce8991a7d3c"
        },
        {
          "path": "python/tcl/tk8.6/demos/combo.tcl",
          "bytes": 2024,
          "sha256": "85ba1d5d4265cc2949b011a0ca7823e600d0dfa38b5155876e892c125499a8e2"
        },
        {
          "path": "python/tcl/tk8.6/demos/cscroll.tcl",
          "bytes": 5208,
          "sha256": "93c15445de222a3afd54414d1564e4052b08b413aa1c39b70688c85cda63e30b"
        },
        {
          "path": "python/tcl/tk8.6/demos/ctext.tcl",
          "bytes": 6381,
          "sha256": "6f7dac4ff555c9ccaabeef89a17f234dc4b5ca818848b99089fe42d5da4704ee"
        },
        {
          "path": "python/tcl/tk8.6/demos/dialog1.tcl",
          "bytes": 999,
          "sha256": "61c48d3c23d6a2a3c0c5229ae9838884f77fa7c2514f53634791210f3a13a97f"
        },
        {
          "path": "python/tcl/tk8.6/demos/dialog2.tcl",
          "bytes": 846,
          "sha256": "247082a303e8d699011d6126361a842dcf53164ae9699d2fda0492d691d96c53"
        },
        {
          "path": "python/tcl/tk8.6/demos/en.msg",
          "bytes": 3964,
          "sha256": "3b3d80f5e884a94c27a97fd46ddf2947feedc7c960bbfa359bdea6ddd1e0df87"
        },
        {
          "path": "python/tcl/tk8.6/demos/entry1.tcl",
          "bytes": 1435,
          "sha256": "9675cae23d2481e8edd23b6393cd1bba39815858ac4ddb2a73358eb0c2d1ec8a"
        },
        {
          "path": "python/tcl/tk8.6/demos/entry2.tcl",
          "bytes": 2137,
          "sha256": "cf8be7001f870ee5d5279337483368dcfe9d5e52022f29523cf13e185744af89"
        },
        {
          "path": "python/tcl/tk8.6/demos/entry3.tcl",
          "bytes": 6287,
          "sha256": "251b02601ca72e97378201085cef6a1a174ba1e16b60e735b508dd37f51f0f0e"
        },
        {
          "path": "python/tcl/tk8.6/demos/filebox.tcl",
          "bytes": 2432,
          "sha256": "277669c033ffe1450f762892e31f9ded824776e5e70d6132eeb167fd15533f9b"
        },
        {
          "path": "python/tcl/tk8.6/demos/floor.tcl",
          "bytes": 81174,
          "sha256": "fc7e5d5fc0e84cfe7b9b1875b401bd471ea0a9773f1e8d06a92e67cb1edde61f"
        },
        {
          "path": "python/tcl/tk8.6/demos/fontchoose.tcl",
          "bytes": 1777,
          "sha256": "9bf3d1f798589c269ecfd2b76dde820fff0be027e42c34d4bb13a6b78a5c4f05"
        },
        {
          "path": "python/tcl/tk8.6/demos/form.tcl",
          "bytes": 1084,
          "sha256": "9b1de253d0bd2e679a4759f2c9c486105813c95a7f55696914d6c8874e91c6a1"
        },
        {
          "path": "python/tcl/tk8.6/demos/goldberg.tcl",
          "bytes": 58431,
          "sha256": "0b1bb7e4a679199610dc99863c0a4aef59cb8cf2b3d3a5cd97cf567ec9cc1026"
        },
        {
          "path": "python/tcl/tk8.6/demos/hello",
          "bytes": 531,
          "sha256": "741bbaf0dc065eb4fcc7b655e0f830bce6c9d9c22cf61ac9f18c17986819f414"
        },
        {
          "path": "python/tcl/tk8.6/demos/hscale.tcl",
          "bytes": 1542,
          "sha256": "0ab4ebc5f7af945bcb81aabbf0f7839d88d3347c0f1988e2a6366eee090564f5"
        },
        {
          "path": "python/tcl/tk8.6/demos/icon.tcl",
          "bytes": 2114,
          "sha256": "f8818b41f8661ac17db45d622855909865b8a5cb210fc1b22f3375f3511ed47c"
        },
        {
          "path": "python/tcl/tk8.6/demos/image1.tcl",
          "bytes": 1037,
          "sha256": "fcc89527b6027b143da4449d13baad8eb1604a7b86d4824a865465ef6f40ac3b"
        },
        {
          "path": "python/tcl/tk8.6/demos/image2.tcl",
          "bytes": 3467,
          "sha256": "8e60cec6bbaf17048bc2c1b6b147d2c85a7014b744eb7f7efe533d9ef3932d58"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/earth.gif",
          "bytes": 51712,
          "sha256": "88af7ae24fd08d5eb144e938a4381d28638bc50d15c8e5f3e30ca73b0fba961f"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/earthmenu.png",
          "bytes": 8157,
          "sha256": "9bf8d96016039d7fdb2ffc506743724636a70ed5925199aab64ca20820963bde"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/earthris.gif",
          "bytes": 6343,
          "sha256": "c2da473e55d8317bd1f983638adb729bff1461de590d76f99d8b3430c71e0f6e"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/flagdown.xbm",
          "bytes": 1913,
          "sha256": "70ab05927c40337b1d9a8fc15edc220ba4482d8c886f26b0f5c306071e06851d"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/flagup.xbm",
          "bytes": 1907,
          "sha256": "3d3d30b674eef51449465d387700bf8608931db54f67a93e015b9a4042f1e29c"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/gray25.xbm",
          "bytes": 281,
          "sha256": "b637798957ed022067685e95c95e8c5e12c27b3443de3a8e5aa3ee0bb583bc28"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/letters.xbm",
          "bytes": 1910,
          "sha256": "e82e3b9655519682ace59d217a004141dea420b5acb8eca08682066895855740"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/noletter.xbm",
          "bytes": 1916,
          "sha256": "c6af489117974f9c43b681e340e0a25b7f0f97b7f615e8cb3062c26a3fb7b40e"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/ouster.png",
          "bytes": 54257,
          "sha256": "a2fe354dfcb09b9eeb488128f4ac0b498766faf4a8becf65bbcd779bdb9c4c8f"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/pattern.xbm",
          "bytes": 278,
          "sha256": "c5da801fa4ada674d951e154a4531a17f3201cee4af025800d3ccf98de860cad"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/tcllogo.gif",
          "bytes": 2341,
          "sha256": "72f6b34d3c8f424ff0a290a793fcfbf34fd5630a916cd02e0a5dda0144b5957f"
        },
        {
          "path": "python/tcl/tk8.6/demos/images/teapot.ppm",
          "bytes": 196623,
          "sha256": "786f29b88771e439187dd2e86ad4d255dd185e0c1ea3f8c37d21770fd1df253a"
        },
        {
          "path": "python/tcl/tk8.6/demos/items.tcl",
          "bytes": 10792,
          "sha256": "db098afb912829ef09a31c7a95c2a1c14f3ce0ff70c1271604d89b7c2143123d"
        },
        {
          "path": "python/tcl/tk8.6/demos/ixset",
          "bytes": 8400,
          "sha256": "7ddeea934b567e8e5bee08e2a3767ddf40f015ab251bddd79a841cfec548e694"
        },
        {
          "path": "python/tcl/tk8.6/demos/knightstour.tcl",
          "bytes": 9391,
          "sha256": "8b4d0e72f828ad3a5420bf71f05a212ec32bd500c4645ca12a48dec4e0486a05"
        },
        {
          "path": "python/tcl/tk8.6/demos/label.tcl",
          "bytes": 1419,
          "sha256": "6334ab83c8e2d2ba95debe678d5583ba7c74925e542047a4fe05554e69cf16e9"
        },
        {
          "path": "python/tcl/tk8.6/demos/labelframe.tcl",
          "bytes": 1923,
          "sha256": "fb7f34effeff03dda13c4088fececa6d266ffbd87d3dad075a424c89305889e0"
        },
        {
          "path": "python/tcl/tk8.6/demos/license.terms",
          "bytes": 2307,
          "sha256": "0d1e4405f6273f091732764ed89b57066be63ce64869be6c71ea337dc4f2f9b5"
        },
        {
          "path": "python/tcl/tk8.6/demos/mclist.tcl",
          "bytes": 4476,
          "sha256": "737c1c78127865b8f3a359ec8f6d8675146547e043d9874f6e49d44680ed1c8a"
        },
        {
          "path": "python/tcl/tk8.6/demos/menu.tcl",
          "bytes": 7659,
          "sha256": "43e808c17c0078972ede7e8926413e64d7287992c2b8ef5d4b04d554b89799da"
        },
        {
          "path": "python/tcl/tk8.6/demos/menubu.tcl",
          "bytes": 4566,
          "sha256": "a9e0117d3f18153169bcf98e7363bd0112cea5762a43ff0fa83e9c681454d3a9"
        },
        {
          "path": "python/tcl/tk8.6/demos/msgbox.tcl",
          "bytes": 2060,
          "sha256": "652e236850c86d7f924514255174738ba71a1f7a7ba739aae6734ebd328d5428"
        },
        {
          "path": "python/tcl/tk8.6/demos/nl.msg",
          "bytes": 6875,
          "sha256": "f527e0117feb1c9aca6d06dda1226c201e6deaf89efca171175d08e80a9712ab"
        },
        {
          "path": "python/tcl/tk8.6/demos/paned1.tcl",
          "bytes": 1162,
          "sha256": "d98e8a9bc5332d9dbf4f00382f840af90ce95204b05326c56cc079c27182d811"
        },
        {
          "path": "python/tcl/tk8.6/demos/paned2.tcl",
          "bytes": 2318,
          "sha256": "c7684877a618c5bab0d0293662d76e5fdb231b479d8d9c0cb759e9af586ce6b2"
        },
        {
          "path": "python/tcl/tk8.6/demos/pendulum.tcl",
          "bytes": 7820,
          "sha256": "a00d1f68fbca9877a9f2269e324552a746f6a3babfb651cba0d39ba2bba0e8c5"
        },
        {
          "path": "python/tcl/tk8.6/demos/plot.tcl",
          "bytes": 2854,
          "sha256": "897e231aea6c393571494dc4279f3d2d0206a7405740c2f601a1ca01b076e1a1"
        },
        {
          "path": "python/tcl/tk8.6/demos/puzzle.tcl",
          "bytes": 2684,
          "sha256": "f28b48fbe10e92fcb9f871017a40487d4e0d2880f456821ad2ad1b4e3549c100"
        },
        {
          "path": "python/tcl/tk8.6/demos/radio.tcl",
          "bytes": 2818,
          "sha256": "5dcfe813b024ded726e728e75e8ec718b1a2491d4dac47adb2ae432af0cd1f57"
        },
        {
          "path": "python/tcl/tk8.6/demos/README",
          "bytes": 2126,
          "sha256": "ba3178afafccb3ccccbd9b0bfa311973bd79c1d143f2ea14a3af1c6a82f7ccec"
        },
        {
          "path": "python/tcl/tk8.6/demos/rmt",
          "bytes": 5526,
          "sha256": "dbd680e536b4eb2a2d733f96bbf3b5712e66a4a9e0a49f440f4668c6ac1b719a"
        },
        {
          "path": "python/tcl/tk8.6/demos/rolodex",
          "bytes": 8501,
          "sha256": "b995670a0afe039aa2051e5fc3ca27a3a42fb1c359f3a32603500385037029c2"
        },
        {
          "path": "python/tcl/tk8.6/demos/ruler.tcl",
          "bytes": 5508,
          "sha256": "fd94b05bc5e28e8e7a932af964e9544389b5ccd76498916762240e48d382d121"
        },
        {
          "path": "python/tcl/tk8.6/demos/sayings.tcl",
          "bytes": 2317,
          "sha256": "cdd24db3c873d29539ab345a2d4035e22be2360bb61b4d1be8313fc129c57f6d"
        },
        {
          "path": "python/tcl/tk8.6/demos/search.tcl",
          "bytes": 4542,
          "sha256": "bea80b1b64879f571576e21deb3d909b95418eac230376f3df68f757a7eddf02"
        },
        {
          "path": "python/tcl/tk8.6/demos/spin.tcl",
          "bytes": 1873,
          "sha256": "77c7708062e226c7b55d81b89481ea088935759449dc4af754399bf609f5bebd"
        },
        {
          "path": "python/tcl/tk8.6/demos/square",
          "bytes": 1385,
          "sha256": "5fb92b6033f2d05915b984076971db0ef87bad1e463591f5ba9507bdaeb95966"
        },
        {
          "path": "python/tcl/tk8.6/demos/states.tcl",
          "bytes": 2102,
          "sha256": "12efe21106986b06d1f65bd2734514707fa70a7a8282bbd59c681ba02b0c9361"
        },
        {
          "path": "python/tcl/tk8.6/demos/style.tcl",
          "bytes": 7098,
          "sha256": "798f10af8f6dfdcb4f95d075224e6de051565d401aa28604a45005a592efb263"
        },
        {
          "path": "python/tcl/tk8.6/demos/tclIndex",
          "bytes": 5365,
          "sha256": "eb7a61ebdcf654c2ab1ad5b9444a115e40c90e8c88a8dc5b7b4870286ddb9241"
        },
        {
          "path": "python/tcl/tk8.6/demos/tcolor",
          "bytes": 11608,
          "sha256": "cf3f2cf7a612675f640ca71744a5cb5437e94a70bcbfdb899ff3c257d3868eb1"
        },
        {
          "path": "python/tcl/tk8.6/demos/text.tcl",
          "bytes": 4404,
          "sha256": "bfbed67317a86fbce94321754ecad255b2de3ff5b7c735682daeabaaa9f0086a"
        },
        {
          "path": "python/tcl/tk8.6/demos/textpeer.tcl",
          "bytes": 2250,
          "sha256": "440f52dbedf0c2e4754c93971d478425c9e78f71db19df3274720903647c9e15"
        },
        {
          "path": "python/tcl/tk8.6/demos/timer",
          "bytes": 1139,
          "sha256": "4a0410f3c13a47eb52d55e781fb54b13d5a0dbeb88ba88ea6e9e74019ae21ddc"
        },
        {
          "path": "python/tcl/tk8.6/demos/toolbar.tcl",
          "bytes": 3364,
          "sha256": "9c2d3b5fa57a402508fc9a4d9464cdaca10504cf85da8a2742693c42998cba64"
        },
        {
          "path": "python/tcl/tk8.6/demos/tree.tcl",
          "bytes": 3267,
          "sha256": "62052568d2cca5ed1d9ff6ccaf3821601f8201106fab9095c20bc19585215535"
        },
        {
          "path": "python/tcl/tk8.6/demos/ttkbut.tcl",
          "bytes": 3489,
          "sha256": "e1e26aa0622d79b6532b54e4ece6d9136d36c96dd6dacea1eddebf2bb07cb9cc"
        },
        {
          "path": "python/tcl/tk8.6/demos/ttkmenu.tcl",
          "bytes": 2444,
          "sha256": "4a96e4e93976351658fefb2e4bc7371f68d4ae3bd1775f590938abed0ade103f"
        },
        {
          "path": "python/tcl/tk8.6/demos/ttknote.tcl",
          "bytes": 2374,
          "sha256": "b8ab22ddd00a2583ecb7bc6e0f71a800dffe71d587567b1aaa571af9440175e0"
        },
        {
          "path": "python/tcl/tk8.6/demos/ttkpane.tcl",
          "bytes": 4289,
          "sha256": "e1c472dcc79ab4826796848e320fc8769bc9daf6fe0378995054686a006d2c14"
        },
        {
          "path": "python/tcl/tk8.6/demos/ttkprogress.tcl",
          "bytes": 1582,
          "sha256": "340104a560226fd7e82de93b58e3ba4a56423c3d3f8c94b440287edc3ff5119e"
        },
        {
          "path": "python/tcl/tk8.6/demos/ttkscale.tcl",
          "bytes": 1459,
          "sha256": "2baa67e262de37b50615a9999c624ee05ce02b255334516c548ea845f7d4c470"
        },
        {
          "path": "python/tcl/tk8.6/demos/twind.tcl",
          "bytes": 12005,
          "sha256": "36b00de2b67c0974873787b4ff033f169f7201ab88e926fb4058f5cbb0298284"
        },
        {
          "path": "python/tcl/tk8.6/demos/unicodeout.tcl",
          "bytes": 4851,
          "sha256": "a5cc2cd45093b91cefaca4842055b89aa193cdc8a8c21ac5b049d15a7a1d044d"
        },
        {
          "path": "python/tcl/tk8.6/demos/vscale.tcl",
          "bytes": 1523,
          "sha256": "4c54f3b13268f6f96898b974b5bd185dcb59384096a3b1a3deff93b5361eea1a"
        },
        {
          "path": "python/tcl/tk8.6/demos/widget",
          "bytes": 24794,
          "sha256": "01bef967805998261dc10784f974d86679a8c2d51b49cd1461ffc9b9340a034f"
        },
        {
          "path": "python/tcl/tk8.6/dialog.tcl",
          "bytes": 5988,
          "sha256": "1c977052c1d8293cc5fe4198a538beca9bc821af85e76e4eefbfb75b33ce8bed"
        },
        {
          "path": "python/tcl/tk8.6/entry.tcl",
          "bytes": 18401,
          "sha256": "af1de90270693273b52fc735da6b5cd5ca794f5afd4cf03ffd95147161098048"
        },
        {
          "path": "python/tcl/tk8.6/focus.tcl",
          "bytes": 5035,
          "sha256": "8872f236d7e824aec0acd4bacc00fdd7ec9bc5534814ecf2160610c10647b7c5"
        },
        {
          "path": "python/tcl/tk8.6/fontchooser.tcl",
          "bytes": 16467,
          "sha256": "48c6d9eabb028a57291c009e1b02756d1ea6a18f9aca7066c59bc3c5d881d3a6"
        },
        {
          "path": "python/tcl/tk8.6/iconlist.tcl",
          "bytes": 17421,
          "sha256": "c8b4b2130c6ad658331c59f41d8bdbab44e0011781214a0b0be78c4920536b2e"
        },
        {
          "path": "python/tcl/tk8.6/icons.tcl",
          "bytes": 11037,
          "sha256": "1264940e62b9a37967925418e9d0dc0befd369e8c181b9bab3d1607e3cc14b85"
        },
        {
          "path": "python/tcl/tk8.6/images/logo.eps",
          "bytes": 34991,
          "sha256": "76207d8dfde189a29dc0e76adb7eaaa606b96bc6c1c831f34d1c85b1c5b51dd3"
        },
        {
          "path": "python/tcl/tk8.6/images/logo100.gif",
          "bytes": 2341,
          "sha256": "72f6b34d3c8f424ff0a290a793fcfbf34fd5630a916cd02e0a5dda0144b5957f"
        },
        {
          "path": "python/tcl/tk8.6/images/logo64.gif",
          "bytes": 1670,
          "sha256": "138c240382304f350383b02ed56c69103a9431c0544eb1ec5dcd7dec7a555dd9"
        },
        {
          "path": "python/tcl/tk8.6/images/logoLarge.gif",
          "bytes": 11000,
          "sha256": "0f404764d07a6ae2ef9e1e0e8eaac278b7d488d61cf1c084146f2f33b485f2ed"
        },
        {
          "path": "python/tcl/tk8.6/images/logoMed.gif",
          "bytes": 3889,
          "sha256": "4d0bd3228ab4cc3e5159f4337be969ec7b7334e265c99b7633e3daf3c3fcfb62"
        },
        {
          "path": "python/tcl/tk8.6/images/pwrdLogo.eps",
          "bytes": 29706,
          "sha256": "87fd9e46dbb5f2bf1529afb411182c9fb9c58e23d830c66a233af0c256bb8eff"
        },
        {
          "path": "python/tcl/tk8.6/images/pwrdLogo100.gif",
          "bytes": 1615,
          "sha256": "bcc0e6458249433e8cba6c58122b7c0efa9557cbc8fb5f9392eed5d2579fc70b"
        },
        {
          "path": "python/tcl/tk8.6/images/pwrdLogo150.gif",
          "bytes": 2489,
          "sha256": "5fc25c30aee76477f1c4e922931cc806823df059525583ff5705705d9e913c1c"
        },
        {
          "path": "python/tcl/tk8.6/images/pwrdLogo175.gif",
          "bytes": 2981,
          "sha256": "62866e95501c436b329a15432355743c6efd64a37cfb65bcece465ab63ecf240"
        },
        {
          "path": "python/tcl/tk8.6/images/pwrdLogo200.gif",
          "bytes": 3491,
          "sha256": "bad9116386343f4a4c394bdb87146e49f674f687d52bb847bd9e8198fda382cc"
        },
        {
          "path": "python/tcl/tk8.6/images/pwrdLogo75.gif",
          "bytes": 1171,
          "sha256": "462a8ff8fd051a8100e8c6c086f497e4056ace5b20b44791f4aab964b010a448"
        },
        {
          "path": "python/tcl/tk8.6/images/README",
          "bytes": 329,
          "sha256": "c6db098ebd8a622164d37d4ab0a8c205db1a83ac3065d5cde3cb5fb61925d283"
        },
        {
          "path": "python/tcl/tk8.6/images/tai-ku.gif",
          "bytes": 5473,
          "sha256": "e538f8f4934ca6e1ce29416d292171f28e67da6c72ed9d236ba42f37445ea41e"
        },
        {
          "path": "python/tcl/tk8.6/license.terms",
          "bytes": 2307,
          "sha256": "0d1e4405f6273f091732764ed89b57066be63ce64869be6c71ea337dc4f2f9b5"
        },
        {
          "path": "python/tcl/tk8.6/listbox.tcl",
          "bytes": 15255,
          "sha256": "47c75f9f8348bf8f2c086c57b97b73741218100ca38d10b8abdf2051c95b9801"
        },
        {
          "path": "python/tcl/tk8.6/megawidget.tcl",
          "bytes": 9862,
          "sha256": "848258b946c002e2696ca3815a1589c8120af5cc41fbc11bbd9a3f5754cc21af"
        },
        {
          "path": "python/tcl/tk8.6/menu.tcl",
          "bytes": 39499,
          "sha256": "d1283f67e435aab0bdbe9fdaa540a162043f8d652c02fe79f3843a451f123d89"
        },
        {
          "path": "python/tcl/tk8.6/mkpsenc.tcl",
          "bytes": 30840,
          "sha256": "c5bdca3aba671f03dc4624ab5fd260490f5002491d6c619142ccf5a1a744528a"
        },
        {
          "path": "python/tcl/tk8.6/msgbox.tcl",
          "bytes": 16786,
          "sha256": "a07e3a3809ced3c6c9c1e171dca5ad1f28357734cd41b2b9dd9f58085b3d2842"
        },
        {
          "path": "python/tcl/tk8.6/msgs/cs.msg",
          "bytes": 4235,
          "sha256": "4dffbeedbf0d66d84b13088016d1a782ceaad4ded27be1e38842f8969c0e533f"
        },
        {
          "path": "python/tcl/tk8.6/msgs/da.msg",
          "bytes": 3987,
          "sha256": "feef8f8ad33bb3362c845a25d6ed273c398051047d899b31790474614c7afd2d"
        },
        {
          "path": "python/tcl/tk8.6/msgs/de.msg",
          "bytes": 4914,
          "sha256": "c0f574b14068a049e93421c73873d750c98de28b7b77aa42fe72cbe0270a4186"
        },
        {
          "path": "python/tcl/tk8.6/msgs/el.msg",
          "bytes": 8784,
          "sha256": "3f6f155864fe59a341bfd869735e54dd21cee21bbd038433d9b271ad77ba3f7e"
        },
        {
          "path": "python/tcl/tk8.6/msgs/en_gb.msg",
          "bytes": 66,
          "sha256": "01238293356e82f1d298896491f8b299bb7dc9c34f299c9e756254c736da612b"
        },
        {
          "path": "python/tcl/tk8.6/msgs/en.msg",
          "bytes": 3377,
          "sha256": "4a33b44b2e220e28eaae7fac407cafe43d97c270da58fa5f3b699a1760bfb2a4"
        },
        {
          "path": "python/tcl/tk8.6/msgs/eo.msg",
          "bytes": 3991,
          "sha256": "37fc66686349a955935cb24b0bd524e91823d2a631e63d54fdf17733c7502cbe"
        },
        {
          "path": "python/tcl/tk8.6/msgs/es.msg",
          "bytes": 4024,
          "sha256": "d2842b80f1b521eff2d2656a69274b5f2a8f4f5831af2e8ee73e3c37389f981f"
        },
        {
          "path": "python/tcl/tk8.6/msgs/fr.msg",
          "bytes": 3877,
          "sha256": "3f2ceb4a33695ab6b56e27f61a4c60c029935bb026497d99cb2c246bcb4a63c4"
        },
        {
          "path": "python/tcl/tk8.6/msgs/hu.msg",
          "bytes": 4678,
          "sha256": "e063ad7ca93f37728a65e4cd7c0433950f22607d307949f6cb056446afeaa4fe"
        },
        {
          "path": "python/tcl/tk8.6/msgs/it.msg",
          "bytes": 3765,
          "sha256": "806930f283fd097195c7850e3486b3815d1564529b4f8e5fa6d26f3175183bc1"
        },
        {
          "path": "python/tcl/tk8.6/msgs/nl.msg",
          "bytes": 4557,
          "sha256": "0914fba42361227d14fa281e8a9cbf57c16200b4da1e61cc3402ef0113a512c7"
        },
        {
          "path": "python/tcl/tk8.6/msgs/pl.msg",
          "bytes": 4932,
          "sha256": "eaceb1f08de0863ccf726881e07fe5b135ea09646c5253e0cbf7ddb987eb0d92"
        },
        {
          "path": "python/tcl/tk8.6/msgs/pt.msg",
          "bytes": 3987,
          "sha256": "d687f71f0432bb0d02efdf576e526d2c19d4136f76c41a3224a2f034168f3f34"
        },
        {
          "path": "python/tcl/tk8.6/msgs/ru.msg",
          "bytes": 7289,
          "sha256": "8715e9927ba925ae8099edf71a3d701fe396fc0e4df039cea7dc84120e101f47"
        },
        {
          "path": "python/tcl/tk8.6/msgs/sv.msg",
          "bytes": 3908,
          "sha256": "a6821a13d34fb31f1827294b82c4bf9586bb255ca14f78c3ace11181f42ef211"
        },
        {
          "path": "python/tcl/tk8.6/obsolete.tcl",
          "bytes": 5772,
          "sha256": "540eeecba17207a56290baffdae882bbd4f88364791204ad5d14c7bedd022ccc"
        },
        {
          "path": "python/tcl/tk8.6/optMenu.tcl",
          "bytes": 1629,
          "sha256": "40ca505c9784b0767d4854485c5c311829594a4fcbdfd7251e60e6bb7ea74fd1"
        },
        {
          "path": "python/tcl/tk8.6/palette.tcl",
          "bytes": 8418,
          "sha256": "849b4c57e4644e51beaeaeb3ae59b7ff067e582ecd10f1b2caf6b6e72f11f506"
        },
        {
          "path": "python/tcl/tk8.6/panedwindow.tcl",
          "bytes": 5370,
          "sha256": "aa4f87e41ac8297f51150f2a9f787607690d01793456b93f0939c54d394731f9"
        },
        {
          "path": "python/tcl/tk8.6/pkgIndex.tcl",
          "bytes": 376,
          "sha256": "3f2539e85e2a9017913e61fe2600b499315e1a6f249a4ff90e0b530a1eeb8898"
        },
        {
          "path": "python/tcl/tk8.6/safetk.tcl",
          "bytes": 7632,
          "sha256": "579701605669aadffbcdb7e3545c68442495428ee6e93c2d3a3133583bcd3d33"
        },
        {
          "path": "python/tcl/tk8.6/scale.tcl",
          "bytes": 8056,
          "sha256": "0da2dc955ffd71062a21c3b747d9d59d66a5b09a907b9ed220be1b2342205a05"
        },
        {
          "path": "python/tcl/tk8.6/scrlbar.tcl",
          "bytes": 13188,
          "sha256": "eec90404f702d3cfbfaec0f13bf5ed1ebeb736bee12d7e69770181a25401c61f"
        },
        {
          "path": "python/tcl/tk8.6/spinbox.tcl",
          "bytes": 16526,
          "sha256": "2ff791a44406dc8339c7da6116e6ec92289bee5fc1367d378f48094f4abea277"
        },
        {
          "path": "python/tcl/tk8.6/tclIndex",
          "bytes": 20523,
          "sha256": "b04b1a675572e6fcd12c5fe82c4fd0930395548436ff93d848bf340ae202e7e3"
        },
        {
          "path": "python/tcl/tk8.6/tearoff.tcl",
          "bytes": 5309,
          "sha256": "a4a8568633f827b54326640e6d1c3fde4978edc9e9fa1fb1d7b58f189df1b1dc"
        },
        {
          "path": "python/tcl/tk8.6/text.tcl",
          "bytes": 34961,
          "sha256": "4a42ad370e0cd93d4133b49788c0b0e1c7cd78383e88bacb51cb751e8bfda15e"
        },
        {
          "path": "python/tcl/tk8.6/tk.tcl",
          "bytes": 24266,
          "sha256": "0f617d96cbf213296d7a5f7fcffbb4ae1149840d7d045211ef932e8dd66683e9"
        },
        {
          "path": "python/tcl/tk8.6/tkfbox.tcl",
          "bytes": 39613,
          "sha256": "595a0b05eb2cbd4cf489e57624b509fc3b4885e6410ca6416e7521d23694373d"
        },
        {
          "path": "python/tcl/tk8.6/ttk/altTheme.tcl",
          "bytes": 3713,
          "sha256": "ae0437fb4e0ebd31322e4eaca626c12abde602da483bb39d0c5ee1bc00ab0af4"
        },
        {
          "path": "python/tcl/tk8.6/ttk/aquaTheme.tcl",
          "bytes": 3838,
          "sha256": "e199cc9c429b35a09721d0a22543c3729e2b8462e68dfa158c0cec9c70a0d79d"
        },
        {
          "path": "python/tcl/tk8.6/ttk/button.tcl",
          "bytes": 3014,
          "sha256": "e38a9d1f437981aa6bf0bdd074d57b769a4140c0f7d9aff51743fe4ecc6dfddf"
        },
        {
          "path": "python/tcl/tk8.6/ttk/clamTheme.tcl",
          "bytes": 4809,
          "sha256": "cffc59931fdd1683ad23895e92522cf49b099128753fcdff34374024e42cf995"
        },
        {
          "path": "python/tcl/tk8.6/ttk/classicTheme.tcl",
          "bytes": 3864,
          "sha256": "424bba4fb6836feebe34f6c176ed666dce51d2fba9a8d7aa756abcbbad3fc1e3"
        },
        {
          "path": "python/tcl/tk8.6/ttk/combobox.tcl",
          "bytes": 12718,
          "sha256": "68eed4af6d2ec5b3ea24b1122a704b040366cbe2f458103137479352ffa1475a"
        },
        {
          "path": "python/tcl/tk8.6/ttk/cursors.tcl",
          "bytes": 4827,
          "sha256": "7a2ed9d78fabcafff16694f2f4a2e36ff5aa313f912d6e93484f3bcd0466ad91"
        },
        {
          "path": "python/tcl/tk8.6/ttk/defaults.tcl",
          "bytes": 4553,
          "sha256": "49ae8faf169165bddaf01d50b52943ebab3656e9468292b7890be143d0fcbc91"
        },
        {
          "path": "python/tcl/tk8.6/ttk/entry.tcl",
          "bytes": 17617,
          "sha256": "830cc3009a735e92db70d53210c4928dd35caab5051ed14dec67e06ae25cbe28"
        },
        {
          "path": "python/tcl/tk8.6/ttk/fonts.tcl",
          "bytes": 5732,
          "sha256": "b94c319e5a557a5665b1676d602b6495c0887c5bacf7fa5b776200112978bb7b"
        },
        {
          "path": "python/tcl/tk8.6/ttk/menubutton.tcl",
          "bytes": 6641,
          "sha256": "972b13854d0e9b84de338d6753f0f11f3a8534e7d0e51838796dae5a1e2e3085"
        },
        {
          "path": "python/tcl/tk8.6/ttk/notebook.tcl",
          "bytes": 5825,
          "sha256": "22264d8d138e2c0e9a950305b4f08557c5a73f054f8215c0d8ce03854042be76"
        },
        {
          "path": "python/tcl/tk8.6/ttk/panedwindow.tcl",
          "bytes": 2290,
          "sha256": "4d08a7e29eef731876951ef01dfa51654b6275fa3daadb1f48ff4bbeac238eb5"
        },
        {
          "path": "python/tcl/tk8.6/ttk/progress.tcl",
          "bytes": 1138,
          "sha256": "697cc0a75ae31fe9c2d85fb25dca0afa5d0df9c523a2dfad2e4a36893be75fba"
        },
        {
          "path": "python/tcl/tk8.6/ttk/scale.tcl",
          "bytes": 2787,
          "sha256": "b909add0b87fa8ee08fd731041907212a8a0939d37d2ff9b2f600cd67dabd4bb"
        },
        {
          "path": "python/tcl/tk8.6/ttk/scrollbar.tcl",
          "bytes": 3285,
          "sha256": "6eaa336b13815a7fc18bcd6b9adf722e794da2888d053c229044784c8c8e9de8"
        },
        {
          "path": "python/tcl/tk8.6/ttk/sizegrip.tcl",
          "bytes": 2503,
          "sha256": "e92d77b5cdca2206376db2129e87e3d744b3d5e31fde6c0bbd44a494a6845ce1"
        },
        {
          "path": "python/tcl/tk8.6/ttk/spinbox.tcl",
          "bytes": 5003,
          "sha256": "df286bb59f471aa1e19df39af0ef7aa84df9f04dc4a439a747dd8ba43c300150"
        },
        {
          "path": "python/tcl/tk8.6/ttk/treeview.tcl",
          "bytes": 10180,
          "sha256": "c88b60ffb0f72e095f6fc9786930add7f9ed049eabc713f889f9a7da516e188c"
        },
        {
          "path": "python/tcl/tk8.6/ttk/ttk.tcl",
          "bytes": 4993,
          "sha256": "2c48343b1a47f472d1a6b9ee8d670ce7fb428db0db7244dc323ff4c7a8b4f64b"
        },
        {
          "path": "python/tcl/tk8.6/ttk/utils.tcl",
          "bytes": 8624,
          "sha256": "d58610a34301bb6e61a60bec69a7cecf4c45c6a034a9fc123977174b586278be"
        },
        {
          "path": "python/tcl/tk8.6/ttk/vistaTheme.tcl",
          "bytes": 9710,
          "sha256": "ec5f203c69df390e9b99944cf3526d6e77dc6f68e9b1a029f326a41afed1ef81"
        },
        {
          "path": "python/tcl/tk8.6/ttk/winTheme.tcl",
          "bytes": 2865,
          "sha256": "ae82bccce708ff9c303cbcb3d4cc3ff5577a60d5b23822ea79e3e07cce3cbbd1"
        },
        {
          "path": "python/tcl/tk8.6/ttk/xpTheme.tcl",
          "bytes": 2103,
          "sha256": "aedb21c6b2909a4bb4686837d2126e521a8cc2b38414a4540387b801ebd75466"
        },
        {
          "path": "python/tcl/tk8.6/unsupported.tcl",
          "bytes": 10521,
          "sha256": "b463b366f139ddf7fed31f34c6d2341f9f27845a1a358011dfc801e1333b1828"
        },
        {
          "path": "python/tcl/tk8.6/xmfbox.tcl",
          "bytes": 27064,
          "sha256": "1ed57e32ce9c419bce36b483a91410ddf4c997caf62d20e42048fc350f8c3f60"
        },
        {
          "path": "python/tcl/tk86t.lib",
          "bytes": 125062,
          "sha256": "584edf3e098277bfb49425b2d8a256867a9ce011e2e5f2e4098614cb176bf1a9"
        },
        {
          "path": "python/tcl/tkstub86.lib",
          "bytes": 7836,
          "sha256": "d61c11087a59d29c71304790167714d176ed859c968799297f9993c3af5ea0cc"
        },
        {
          "path": "python/vcruntime140_1.dll",
          "bytes": 49792,
          "sha256": "1f2d41c4aa5db0bc33ebf7b66d72943a817d7ce6cbe880502a9403823633093f"
        },
        {
          "path": "python/vcruntime140.dll",
          "bytes": 124544,
          "sha256": "d5e4d9a3e835fa679450145d6a7d94e36573a509317111904d9b3712c30d9066"
        }
      ],
      "license": {
        "name": "Python Software Foundation License Version 2",
        "url": "https://docs.python.org/3/license.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/python-312-3.12.14-20260901.spdx.json",
        "sha256": "9e4ff6e502ab5e24a423b6853495bdc07ac624c16e375cec2e0f8d719e82eaed"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "4htUVRXyvF+sijgrh7704/xAy18WNpGdPO0B5N3bbwgRGuE2s6dJyP9NUKsbeCmxn6UTA8tauffT1I9koF+PCw=="
    },
    {
      "protocolVersion": 1,
      "id": "xhs-archive",
      "moduleId": "xhs-archive",
      "groupId": "archive",
      "displayName": "小红书内容归档运行时",
      "purpose": "固定版本的 XHS-Downloader 本地解析 Worker 与离线依赖；只在设置中安装，不会在提交归档任务时下载。",
      "dependencyIds": [
        "python-312"
      ],
      "taskToolIds": [
        "xhs-archive"
      ],
      "installConditions": [
        "需要 Python 3.12 共享运行时；安装后独立构建虚拟环境。",
        "归档时需要联网访问小红书及媒体源；登录浏览器可复用系统 Chrome/Edge，或在设置中单独安装。"
      ],
      "version": "2.7-afaf2fb",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/xhs-archive-2.7-afaf2fb.tar.gz",
        "bytes": 31999323,
        "sha256": "0ded3d422f749649e664231a6a69b568aa4daf4caafb16311f0ece7bba199369",
        "format": "tar.gz"
      },
      "installedBytes": 800000000,
      "files": [
        {
          "path": "requirements.lock",
          "bytes": 30557,
          "sha256": "ff7c554d06717f3f4cb1ccde88b50f4f3076c7bf4aaa9d371db6613fb8db26c6"
        },
        {
          "path": "source/LICENSE",
          "bytes": 35149,
          "sha256": "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986"
        },
        {
          "path": "source/requirements.txt",
          "bytes": 906,
          "sha256": "9c0ea9861801f4577df15c602013ef9ad1ff1e0be567b197439a03f80d6b3a5e"
        },
        {
          "path": "source/source/__init__.py",
          "bytes": 184,
          "sha256": "8e358fa2671e93b504ec8b88affd0888e6b0bd43aca9749e6f0a0b32b36ed3a6"
        },
        {
          "path": "source/source/application/__init__.py",
          "bytes": 40,
          "sha256": "f3b5408d971d958878240588e362e95ca374e1891b953879a0617fb94c3bc593"
        },
        {
          "path": "source/source/application/app.py",
          "bytes": 30016,
          "sha256": "2f45b9ea427db6bfdc522b22ac3c90536cf4e29c51060f8ce1232507115bd449"
        },
        {
          "path": "source/source/application/download.py",
          "bytes": 9933,
          "sha256": "871ef396e06d1aa61ca26015c915a1597fff987bcb264a5e05f6cac03e5b3f77"
        },
        {
          "path": "source/source/application/explore.py",
          "bytes": 3196,
          "sha256": "776ff8956e7859f8481c72dc2d07f0b95173fec3f8ac84e04bd2beeb8d572a3b"
        },
        {
          "path": "source/source/application/image.py",
          "bytes": 1979,
          "sha256": "c7c743d420203edb143b3cbe51f94c49e236f70d8819ff370a1c39189735bf37"
        },
        {
          "path": "source/source/application/request.py",
          "bytes": 3436,
          "sha256": "46d042f8aeb62bc956fe5b7f41e74e562a3dff0bd6d057d45a5f34813abd59f1"
        },
        {
          "path": "source/source/application/user_posted.py",
          "bytes": 1838,
          "sha256": "50736fb09f1d55d5fb6fa3f74065dcdfcd4a8eb3865298a250b95d89de974c07"
        },
        {
          "path": "source/source/application/video.py",
          "bytes": 1534,
          "sha256": "351116108303a5a56ac441532f48c4c6770a4a92bea71c2e5d972f3cb060a68f"
        },
        {
          "path": "source/source/CLI/__init__.py",
          "bytes": 41,
          "sha256": "efcc505c05545d5656a09fda13064cf13b53ace5ad1fc7b5ab6ba69f157a8680"
        },
        {
          "path": "source/source/CLI/main.py",
          "bytes": 9698,
          "sha256": "44f180f5e45ca0a3dc1a7c5d08f22dd5312e0ef9ae5406300b0b65c0908e3231"
        },
        {
          "path": "source/source/expansion/__init__.py",
          "bytes": 359,
          "sha256": "21b02526e92e97e9e930874946d502d813b4f2862a78b3605225504cf6ac266b"
        },
        {
          "path": "source/source/expansion/browser.py",
          "bytes": 3458,
          "sha256": "21d628232e8e99a3794a94dd76572a28edbe67a4f44c6a776a9001f5c1c20137"
        },
        {
          "path": "source/source/expansion/cleaner.py",
          "bytes": 3191,
          "sha256": "0b74865c2b99a4c596842c48be9af088e153f6e563cdeba5027114ccb4a2628b"
        },
        {
          "path": "source/source/expansion/converter.py",
          "bytes": 2078,
          "sha256": "0b0a33714424dd6bc00e0b1996744e747ba987c4c1a3e0167d0e18b8d2deb629"
        },
        {
          "path": "source/source/expansion/error.py",
          "bytes": 184,
          "sha256": "3c27f524bb66f90589a64ad3c20b2a0c7e68aacc1c61fe024bfd6ba3ed686705"
        },
        {
          "path": "source/source/expansion/file_folder.py",
          "bytes": 564,
          "sha256": "d0beddcdc3fc280d12613710533e782b6e16f95da82f5942843a483c9315ec74"
        },
        {
          "path": "source/source/expansion/namespace.py",
          "bytes": 2522,
          "sha256": "bef3c377922b691ac7e6617305b809590c23391812aaff132cc1e5161de894e8"
        },
        {
          "path": "source/source/expansion/pyi_rth_beartype.py",
          "bytes": 2977,
          "sha256": "6faad21fd770eb3afe52384eb6438d2612ce748a15ab094b07774342158e358e"
        },
        {
          "path": "source/source/expansion/truncate.py",
          "bytes": 845,
          "sha256": "0b8e6702dfedca1e0e2b451df8d9a5aa7489c1184c5e2e34ab25d7a7f3255454"
        },
        {
          "path": "source/source/locale/en_US/LC_MESSAGES/xhs.mo",
          "bytes": 17712,
          "sha256": "3cc618150361c4e6bb933d985aadeeaae94aabcec016efbd9159d75b59279219"
        },
        {
          "path": "source/source/locale/en_US/LC_MESSAGES/xhs.po",
          "bytes": 30978,
          "sha256": "f8891f823612b96159376dbd1424d054c8fd6e20c74e62be1567a2a387d1c5c1"
        },
        {
          "path": "source/source/locale/generate_path.py",
          "bytes": 546,
          "sha256": "ac28dc9298b50dfbbae5b0b18347c712f81cfe28b56c3118012fd68b5626771b"
        },
        {
          "path": "source/source/locale/po_to_mo.py",
          "bytes": 567,
          "sha256": "8ed6620496d5c79985676501dc7b1edec86dd7e255ffa5ae60c248262dc2dfa9"
        },
        {
          "path": "source/source/locale/README.md",
          "bytes": 1463,
          "sha256": "78618a054e33ac03b198cee47aac023f6cb1b4ddb7fa12fb8b50c8628115309b"
        },
        {
          "path": "source/source/locale/xhs.pot",
          "bytes": 21165,
          "sha256": "83779c002a2c613d0aef74f71b1c7db243a61daba33e2bfbe5c6a9d05e8b666d"
        },
        {
          "path": "source/source/locale/zh_CN/LC_MESSAGES/xhs.mo",
          "bytes": 3488,
          "sha256": "0a6028cc48dcaecc11fddc757f41ccca1ee97dd57fb70c13673e8188a2283ff7"
        },
        {
          "path": "source/source/locale/zh_CN/LC_MESSAGES/xhs.po",
          "bytes": 24447,
          "sha256": "ec7bb598526f2d28424730274cbca1ef4c9d12e37a68bc38be53c1143ec65a51"
        },
        {
          "path": "source/source/module/__init__.py",
          "bytes": 751,
          "sha256": "24aa21706dcf7af7552a08979b69bff64352f5ac9eaa31c87828f327b7b96b82"
        },
        {
          "path": "source/source/module/extend.py",
          "bytes": 48,
          "sha256": "a7bd61f6e9e58b4fba72653b30c945fc35f23342f915b493c76a6ca66a57ec75"
        },
        {
          "path": "source/source/module/manager.py",
          "bytes": 9172,
          "sha256": "2a8db77f327644d03c98fae9f4a6a15055e204e967c1c7e49dfc161ad00e6a99"
        },
        {
          "path": "source/source/module/mapping.py",
          "bytes": 5543,
          "sha256": "4e7078c0c2c59e59f75da4614f5aede37a0adebf2672a263179a165191830546"
        },
        {
          "path": "source/source/module/model.py",
          "bytes": 311,
          "sha256": "7a5d834dc7825fae3206b46d279f12a4226d4a0b1f6356e6efb6323d46f699c2"
        },
        {
          "path": "source/source/module/recorder.py",
          "bytes": 5810,
          "sha256": "5824241c80ec6de4df5ce196304c57e4968c9c2d9f66dd95ae7606e5fc21c2cf"
        },
        {
          "path": "source/source/module/script.py",
          "bytes": 1134,
          "sha256": "08f318fc08130aae68ffa3ba7cedc97919a3b8a0d18db9733edc057e1115d3c2"
        },
        {
          "path": "source/source/module/settings.py",
          "bytes": 3992,
          "sha256": "6b2d8bbec49d390bf7badd07ac61ac3936cd820eec90df1c45439cc38973e3fd"
        },
        {
          "path": "source/source/module/static.py",
          "bytes": 2410,
          "sha256": "13c3e2a6416fe99bd92807e34eabddcaf9104674a0bc157146775901df55eca0"
        },
        {
          "path": "source/source/module/tools.py",
          "bytes": 1441,
          "sha256": "f3a03a65048c8ebbe910a1a6534169e429ef19292dc88a7230946df436286da7"
        },
        {
          "path": "source/source/translation/__init__.py",
          "bytes": 42,
          "sha256": "b5755ab0c7fa03c7cb7a0b677c96c52a34ecb5f8ce5cb27069e6505caff0f67e"
        },
        {
          "path": "source/source/translation/translate.py",
          "bytes": 2450,
          "sha256": "e3ed9ccf2b2903d7863ab7ffe294d6078e54037b1eb1981dd82b1ee8bd14ce58"
        },
        {
          "path": "source/source/TUI/__init__.py",
          "bytes": 60,
          "sha256": "5cf8f24672ddde5dce42f1e3dabb70d41fc17b05e90b78f93d914412c774a6e1"
        },
        {
          "path": "source/source/TUI/about.py",
          "bytes": 2384,
          "sha256": "ace44b097530646f6979bfe67fbff46b865b82592c50f53c8ea54998071b1e85"
        },
        {
          "path": "source/source/TUI/app.py",
          "bytes": 3328,
          "sha256": "ce40b12f39c744fba33bf1cc237690822dccfc63c430b1bd8b2238c24d8b0d03"
        },
        {
          "path": "source/source/TUI/index.py",
          "bytes": 4389,
          "sha256": "0a9faa9685478db34170630aa2bc0821a6ae1164673a43dee2e8633ed3a98e09"
        },
        {
          "path": "source/source/TUI/loading.py",
          "bytes": 491,
          "sha256": "fca0be6d1c9b01edbe6947c13d4cd8d50ddbcdc4b795650bd9dd9fb46d2f93db"
        },
        {
          "path": "source/source/TUI/monitor.py",
          "bytes": 1545,
          "sha256": "37367a5b2cb585ccefeec961332f71e46baaf6216a04a770d0b6c72cd916a701"
        },
        {
          "path": "source/source/TUI/progress.py",
          "bytes": 175,
          "sha256": "52ebc412c50818f37dcb09a45655b3aaeccbeb2107c05a1dea1374f131d489e9"
        },
        {
          "path": "source/source/TUI/record.py",
          "bytes": 1576,
          "sha256": "325f4312f78d0a1a69ec1394e8aa19f63634956b24d948c959f94dd742a2b39e"
        },
        {
          "path": "source/source/TUI/setting.py",
          "bytes": 9322,
          "sha256": "8de0dad18a4e9c22aee222957e86cb2831b7105b462d0a2ea100a92a85c988a7"
        },
        {
          "path": "source/source/TUI/update.py",
          "bytes": 2721,
          "sha256": "878fbe3813fac08379a61779e172c20092d9469843ca5b15b62d106739057c0f"
        },
        {
          "path": "wheelhouse/aiofiles-25.1.0-py3-none-any.whl",
          "bytes": 14668,
          "sha256": "abe311e527c862958650f9438e859c1fa7568a141b22abcd015e120e86a85695"
        },
        {
          "path": "wheelhouse/aiosqlite-0.22.1-py3-none-any.whl",
          "bytes": 17405,
          "sha256": "21c002eb13823fad740196c5a2e9d8e62f6243bd9e7e4a1f87fb5e44ecb4fceb"
        },
        {
          "path": "wheelhouse/annotated_doc-0.0.4-py3-none-any.whl",
          "bytes": 5303,
          "sha256": "571ac1dc6991c450b25a9c2d84a3705e2ae7a53467b5d111c24fa8baabbed320"
        },
        {
          "path": "wheelhouse/annotated_types-0.7.0-py3-none-any.whl",
          "bytes": 13643,
          "sha256": "1f02e8b43a8fbbc3f3e0d4f0f4bfc8131bcb4eebe8849b8e5c773f3a1c582a53"
        },
        {
          "path": "wheelhouse/anyio-4.12.1-py3-none-any.whl",
          "bytes": 113592,
          "sha256": "d405828884fc140aa80a3c667b8beed277f1dfedec42ba031bd6ac3db606ab6c"
        },
        {
          "path": "wheelhouse/attrs-25.4.0-py3-none-any.whl",
          "bytes": 67615,
          "sha256": "adcf7e2a1fb3b36ac48d97835bb6d8ade15b8dcce26aba8bf1d14847b57a3373"
        },
        {
          "path": "wheelhouse/authlib-1.6.7-py2.py3-none-any.whl",
          "bytes": 244115,
          "sha256": "c637340d9a02789d2efa1d003a7437d10d3e565237bcb5fcbc6c134c7b95bab0"
        },
        {
          "path": "wheelhouse/beartype-0.22.9-py3-none-any.whl",
          "bytes": 1333658,
          "sha256": "d16c9bbc61ea14637596c5f6fbff2ee99cbe3573e46a716401734ef50c3060c2"
        },
        {
          "path": "wheelhouse/cachetools-7.0.0-py3-none-any.whl",
          "bytes": 13487,
          "sha256": "d52fef60e6e964a1969cfb61ccf6242a801b432790fe520d78720d757c81cbd2"
        },
        {
          "path": "wheelhouse/certifi-2026.1.4-py3-none-any.whl",
          "bytes": 152900,
          "sha256": "9943707519e4add1115f44c2bc244f782c0249876bf51b6599fee1ffbedd685c"
        },
        {
          "path": "wheelhouse/cffi-2.0.0-cp312-cp312-win_amd64.whl",
          "bytes": 183557,
          "sha256": "da68248800ad6320861f129cd9c1bf96ca849a2771a59e0344e88681905916f5"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.4.4-cp312-cp312-win_amd64.whl",
          "bytes": 107131,
          "sha256": "a79cfe37875f822425b89a82333404539ae63dbdddf97f84dcbc3d339aae9525"
        },
        {
          "path": "wheelhouse/click-8.3.1-py3-none-any.whl",
          "bytes": 108274,
          "sha256": "981153a64e25f12d547d3426c367a4857371575ee7ad18df2a6183ab0545b2a6"
        },
        {
          "path": "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "bytes": 22228,
          "sha256": "9acb47f6afd73f60dc1df93bb801b472f05ff42fa6c84167d25cb206be1fbf4a"
        },
        {
          "path": "wheelhouse/colorama-0.4.6-py2.py3-none-any.whl",
          "bytes": 25335,
          "sha256": "4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6"
        },
        {
          "path": "wheelhouse/croniter-6.0.0-py2.py3-none-any.whl",
          "bytes": 25468,
          "sha256": "2f878c3856f17896979b2a4379ba1f09c83e374931ea15cc835c5dd2eee9b368"
        },
        {
          "path": "wheelhouse/cryptography-46.0.4-cp311-abi3-win_amd64.whl",
          "bytes": 3478614,
          "sha256": "6225d3ebe26a55dbc8ead5ad1265c0403552a63336499564675b29eb3184c09b"
        },
        {
          "path": "wheelhouse/cyclopts-4.5.1-py3-none-any.whl",
          "bytes": 199807,
          "sha256": "0642c93601e554ca6b7b9abd81093847ea4448b2616280f2a0952416574e8c7a"
        },
        {
          "path": "wheelhouse/diskcache-5.6.3-py3-none-any.whl",
          "bytes": 45550,
          "sha256": "5e31b2d5fbad117cc363ebaf6b689474db18a1f6438bc82358b024abd4c2ca19"
        },
        {
          "path": "wheelhouse/dnspython-2.8.0-py3-none-any.whl",
          "bytes": 331094,
          "sha256": "01d9bbc4a2d76bf0db7c1f729812ded6d912bd318d3b1cf81d30c0f845dbf3af"
        },
        {
          "path": "wheelhouse/docstring_parser-0.17.0-py3-none-any.whl",
          "bytes": 36896,
          "sha256": "cf2569abd23dce8099b300f9b4fa8191e9582dda731fd533daf54c4551658708"
        },
        {
          "path": "wheelhouse/docutils-0.22.4-py3-none-any.whl",
          "bytes": 633196,
          "sha256": "d0013f540772d1420576855455d050a2180186c91c15779301ac2ccb3eeb68de"
        },
        {
          "path": "wheelhouse/email_validator-2.3.0-py3-none-any.whl",
          "bytes": 35604,
          "sha256": "80f13f623413e6b197ae73bb10bf4eb0908faf509ad8362c5edeb0be7fd450b4"
        },
        {
          "path": "wheelhouse/emoji-2.15.0-py3-none-any.whl",
          "bytes": 608433,
          "sha256": "205296793d66a89d88af4688fa57fd6496732eb48917a87175a023c8138995eb"
        },
        {
          "path": "wheelhouse/exceptiongroup-1.3.1-py3-none-any.whl",
          "bytes": 16740,
          "sha256": "a7a39a3bd276781e98394987d3a5701d0c4edffb633bb7a5144577f82c773598"
        },
        {
          "path": "wheelhouse/fakeredis-2.33.0-py3-none-any.whl",
          "bytes": 119605,
          "sha256": "de535f3f9ccde1c56672ab2fdd6a8efbc4f2619fc2f1acc87b8737177d71c965"
        },
        {
          "path": "wheelhouse/fastapi-0.128.5-py3-none-any.whl",
          "bytes": 103677,
          "sha256": "bceec0de8aa6564599c5bcc0593b0d287703562c848271fca8546fd2c87bf4dd"
        },
        {
          "path": "wheelhouse/fastmcp-2.14.5-py3-none-any.whl",
          "bytes": 417784,
          "sha256": "d81e8ec813f5089d3624bec93944beaefa86c0c3a4ef1111cbef676a761ebccf"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/h2-4.3.0-py3-none-any.whl",
          "bytes": 61779,
          "sha256": "c438f029a25f7945c69e0ccf0fb951dc3f73a5f6412981daee861431b70e2bdd"
        },
        {
          "path": "wheelhouse/hpack-4.1.0-py3-none-any.whl",
          "bytes": 34357,
          "sha256": "157ac792668d995c657d93111f46b4535ed114f0c9c8d672271bbec7eae1b496"
        },
        {
          "path": "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "bytes": 78784,
          "sha256": "2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"
        },
        {
          "path": "wheelhouse/httpx_sse-0.4.3-py3-none-any.whl",
          "bytes": 8960,
          "sha256": "0ac1c9fe3c0afad2e0ebb25a934a59f4c7823b60792691f779fad2c5568830fc"
        },
        {
          "path": "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "bytes": 73517,
          "sha256": "d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"
        },
        {
          "path": "wheelhouse/hyperframe-6.1.0-py3-none-any.whl",
          "bytes": 13007,
          "sha256": "b03380493a519fce58ea5af42e4a42317bf9bd425596f7a0835ffce80f1a42e5"
        },
        {
          "path": "wheelhouse/idna-3.11-py3-none-any.whl",
          "bytes": 71008,
          "sha256": "771a87f49d9defaf64091e6e6fe9c18d4833f140bd19464795bc32d966ca37ea"
        },
        {
          "path": "wheelhouse/importlib_metadata-8.7.1-py3-none-any.whl",
          "bytes": 27865,
          "sha256": "5a1f80bf1daa489495071efbb095d75a634cf28a8bc299581244063b53176151"
        },
        {
          "path": "wheelhouse/jaraco_context-6.1.0-py3-none-any.whl",
          "bytes": 7065,
          "sha256": "a43b5ed85815223d0d3cfdb6d7ca0d2bc8946f28f30b6f3216bda070f68badda"
        },
        {
          "path": "wheelhouse/jaraco_functools-4.4.0-py3-none-any.whl",
          "bytes": 10481,
          "sha256": "9eec1e36f45c818d9bf307c8948eb03b2b56cd44087b3cdc989abca1f20b9176"
        },
        {
          "path": "wheelhouse/jaraco.classes-3.4.0-py3-none-any.whl",
          "bytes": 6777,
          "sha256": "f662826b6bed8cace05e7ff873ce0f9283b5c924470fe664fff1c2f00f581790"
        },
        {
          "path": "wheelhouse/jsonref-1.1.0-py3-none-any.whl",
          "bytes": 9425,
          "sha256": "590dc7773df6c21cbf948b5dac07a72a251db28b0238ceecce0a2abfa8ec30a9"
        },
        {
          "path": "wheelhouse/jsonschema_path-0.3.4-py3-none-any.whl",
          "bytes": 14810,
          "sha256": "f502191fdc2b22050f9a81c9237be9d27145b9001c55842bece5e94e382e52f8"
        },
        {
          "path": "wheelhouse/jsonschema_specifications-2025.9.1-py3-none-any.whl",
          "bytes": 18437,
          "sha256": "98802fee3a11ee76ecaca44429fda8a41bff98b00a0f2838151b113f210cc6fe"
        },
        {
          "path": "wheelhouse/jsonschema-4.26.0-py3-none-any.whl",
          "bytes": 90630,
          "sha256": "d489f15263b8d200f8387e64b4c3a75f06629559fb73deb8fdfb525f2dab50ce"
        },
        {
          "path": "wheelhouse/keyring-25.7.0-py3-none-any.whl",
          "bytes": 39160,
          "sha256": "be4a0b195f149690c166e850609a477c532ddbfbaed96a404d4e43f8d5e2689f"
        },
        {
          "path": "wheelhouse/linkify_it_py-2.0.3-py3-none-any.whl",
          "bytes": 19820,
          "sha256": "6bcbc417b0ac14323382aef5c5192c0075bf8a9d6b41820a2b66371eac6b6d79"
        },
        {
          "path": "wheelhouse/lupa-2.6-cp312-cp312-win_amd64.whl",
          "bytes": 1688529,
          "sha256": "c735a1ce8ee60edb0fe71d665f1e6b7c55c6021f1d340eb8c865952c602cd36f"
        },
        {
          "path": "wheelhouse/lxml-6.0.2-cp312-cp312-win_amd64.whl",
          "bytes": 4011793,
          "sha256": "72c87e5ee4e58a8354fb9c7c84cbf95a1c8236c127a5d1b7683f04bed8361e1f"
        },
        {
          "path": "wheelhouse/markdown_it_py-4.0.0-py3-none-any.whl",
          "bytes": 87321,
          "sha256": "87327c59b172c5011896038353a81343b6754500a08cd7a4973bb48c6d578147"
        },
        {
          "path": "wheelhouse/mcp-1.26.0-py3-none-any.whl",
          "bytes": 233615,
          "sha256": "904a21c33c25aa98ddbeb47273033c435e595bbacfdb177f4bd87f6dceebe1ca"
        },
        {
          "path": "wheelhouse/mdit_py_plugins-0.5.0-py3-none-any.whl",
          "bytes": 57205,
          "sha256": "07a08422fc1936a5d26d146759e9155ea466e842f5ab2f7d2266dd084c8dab1f"
        },
        {
          "path": "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "bytes": 9979,
          "sha256": "84008a41e51615a49fc9966191ff91509e3c40b939176e643fd50a5c2196b8f8"
        },
        {
          "path": "wheelhouse/more_itertools-10.8.0-py3-none-any.whl",
          "bytes": 69667,
          "sha256": "52d4362373dcf7c52546bc4af9a86ee7c4579df9a8dc268be0a2f949d376cc9b"
        },
        {
          "path": "wheelhouse/openapi_pydantic-0.5.1-py3-none-any.whl",
          "bytes": 96381,
          "sha256": "a3a09ef4586f5bd760a8df7f43028b60cafb6d9f61de2acba9574766255ab146"
        },
        {
          "path": "wheelhouse/opentelemetry_api-1.39.1-py3-none-any.whl",
          "bytes": 66356,
          "sha256": "2edd8463432a7f8443edce90972169b195e7d6a05500cd29e6d13898187c9950"
        },
        {
          "path": "wheelhouse/packaging-26.0-py3-none-any.whl",
          "bytes": 74366,
          "sha256": "b36f1fef9334a5588b4166f8bcd26a14e521f2b55e6b9de3aaa80d3ff7a37529"
        },
        {
          "path": "wheelhouse/pathable-0.4.4-py3-none-any.whl",
          "bytes": 9592,
          "sha256": "5ae9e94793b6ef5a4cbe0a7ce9dbbefc1eec38df253763fd0aeeacf2762dbbc2"
        },
        {
          "path": "wheelhouse/pathvalidate-3.3.1-py3-none-any.whl",
          "bytes": 24305,
          "sha256": "5263baab691f8e1af96092fa5137ee17df5bdfbd6cff1fcac4d6ef4bc2e1735f"
        },
        {
          "path": "wheelhouse/platformdirs-4.5.1-py3-none-any.whl",
          "bytes": 18731,
          "sha256": "d03afa3963c806a9bed9d5125c8f4cb2fdaf74a55ab60e5d59b3fde758104d31"
        },
        {
          "path": "wheelhouse/prometheus_client-0.24.1-py3-none-any.whl",
          "bytes": 64057,
          "sha256": "150db128af71a5c2482b36e588fc8a6b95e498750da4b17065947c16070f4055"
        },
        {
          "path": "wheelhouse/py_key_value_aio-0.3.0-py3-none-any.whl",
          "bytes": 96342,
          "sha256": "1c781915766078bfd608daa769fefb97e65d1d73746a3dfb640460e322071b64"
        },
        {
          "path": "wheelhouse/py_key_value_shared-0.3.0-py3-none-any.whl",
          "bytes": 19560,
          "sha256": "5b0efba7ebca08bb158b1e93afc2f07d30b8f40c2fc12ce24a4c0d84f42f9298"
        },
        {
          "path": "wheelhouse/pycparser-3.0-py3-none-any.whl",
          "bytes": 48172,
          "sha256": "b727414169a36b7d524c1c3e31839a521725078d7b2ff038656844266160a992"
        },
        {
          "path": "wheelhouse/pydantic_core-2.41.5-cp312-cp312-win_amd64.whl",
          "bytes": 2020145,
          "sha256": "1962293292865bca8e54702b08a4f26da73adc83dd1fcf26fbc875b35d81c815"
        },
        {
          "path": "wheelhouse/pydantic_settings-2.12.0-py3-none-any.whl",
          "bytes": 51880,
          "sha256": "fddb9fd99a5b18da837b29710391e945b1e30c135477f484084ee513adb93809"
        },
        {
          "path": "wheelhouse/pydantic-2.12.5-py3-none-any.whl",
          "bytes": 463580,
          "sha256": "e561593fccf61e8a20fc46dfc2dfe075b8be7d0188df33f221ad1f0139180f9d"
        },
        {
          "path": "wheelhouse/pydocket-0.17.5-py3-none-any.whl",
          "bytes": 93355,
          "sha256": "544d7c2625a33e52528ac24db25794841427dfc2cf30b9c558ac387c77746241"
        },
        {
          "path": "wheelhouse/pygments-2.19.2-py3-none-any.whl",
          "bytes": 1225217,
          "sha256": "86540386c03d588bb81d44bc3928634ff26449851e99741617ecb9037ee5ec0b"
        },
        {
          "path": "wheelhouse/pyjwt-2.11.0-py3-none-any.whl",
          "bytes": 28224,
          "sha256": "94a6bde30eb5c8e04fee991062b534071fd1439ef58d2adc9ccb823e7bcd0469"
        },
        {
          "path": "wheelhouse/pyperclip-1.11.0-py3-none-any.whl",
          "bytes": 11063,
          "sha256": "299403e9ff44581cb9ba2ffeed69c7aa96a008622ad0c46cb575ca75b5b84273"
        },
        {
          "path": "wheelhouse/python_dateutil-2.9.0.post0-py2.py3-none-any.whl",
          "bytes": 229892,
          "sha256": "a8b2bc7bffae282281c8140a97d3aa9c14da0b136dfe83f850eea9a5f7470427"
        },
        {
          "path": "wheelhouse/python_dotenv-1.2.1-py3-none-any.whl",
          "bytes": 21230,
          "sha256": "b81ee9561e9ca4004139c6cbba3a238c32b03e4894671e181b671e8cb8425d61"
        },
        {
          "path": "wheelhouse/python_json_logger-4.0.0-py3-none-any.whl",
          "bytes": 15548,
          "sha256": "af09c9daf6a813aa4cc7180395f50f2a9e5fa056034c9953aec92e381c5ba1e2"
        },
        {
          "path": "wheelhouse/python_multipart-0.0.22-py3-none-any.whl",
          "bytes": 24579,
          "sha256": "2b2cd894c83d21bf49d702499531c7bafd057d730c201782048f7945d82de155"
        },
        {
          "path": "wheelhouse/pytz-2025.2-py2.py3-none-any.whl",
          "bytes": 509225,
          "sha256": "5ddf76296dd8c44c26eb8f4b6f35488f3ccbf6fbbd7adee0b7262d43f0ec2f00"
        },
        {
          "path": "wheelhouse/pywin32_ctypes-0.2.3-py3-none-any.whl",
          "bytes": 30756,
          "sha256": "8a1513379d709975552d202d942d9837758905c8d01eb82b8bcc30918929e7b8"
        },
        {
          "path": "wheelhouse/pywin32-311-cp312-cp312-win_amd64.whl",
          "bytes": 9495040,
          "sha256": "b8c095edad5c211ff31c05223658e71bf7116daa0ecf3ad85f3201ea3190d067"
        },
        {
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 154003,
          "sha256": "5fcd34e47f6e0b794d17de1b4ff496c00986e1c83f7ab2fb8fcfe9616ff7477b"
        },
        {
          "path": "wheelhouse/redis-7.1.0-py3-none-any.whl",
          "bytes": 354159,
          "sha256": "23c52b208f92b56103e17c5d06bdc1a6c2c0b3106583985a76a18f83b265de2b"
        },
        {
          "path": "wheelhouse/referencing-0.36.2-py3-none-any.whl",
          "bytes": 26775,
          "sha256": "e8699adbbf8b5c7de96d8ffa0eb5c158b3beafce084968e2ea8bb08c6794dcd0"
        },
        {
          "path": "wheelhouse/requests-2.32.5-py3-none-any.whl",
          "bytes": 64738,
          "sha256": "2462f94637a34fd532264295e186976db0f5d453d1cdd31473c85a6a161affb6"
        },
        {
          "path": "wheelhouse/rich_rst-1.3.2-py3-none-any.whl",
          "bytes": 12567,
          "sha256": "a99b4907cbe118cf9d18b0b44de272efa61f15117c61e39ebdc431baf5df722a"
        },
        {
          "path": "wheelhouse/rich-14.3.2-py3-none-any.whl",
          "bytes": 309963,
          "sha256": "08e67c3e90884651da3239ea668222d19bea7b589149d8014a21c633420dbb69"
        },
        {
          "path": "wheelhouse/rpds_py-0.30.0-cp312-cp312-win_amd64.whl",
          "bytes": 240463,
          "sha256": "a090322ca841abd453d43456ac34db46e8b05fd9b3b4ac0c78bcde8b089f959b"
        },
        {
          "path": "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "bytes": 9755,
          "sha256": "7ecfff8f2fd72616f7481040475a65b2bf8af90a56c89140852d1120324e8686"
        },
        {
          "path": "wheelhouse/six-1.17.0-py2.py3-none-any.whl",
          "bytes": 11050,
          "sha256": "4721f391ed90541fddacab5acf947aa0d3dc7d27b2e1e8eda2be8970586c3274"
        },
        {
          "path": "wheelhouse/socksio-1.0.0-py3-none-any.whl",
          "bytes": 12763,
          "sha256": "95dc1f15f9b34e8d7b16f06d74b8ccf48f609af32ab33c608d08761c5dcbb1f3"
        },
        {
          "path": "wheelhouse/sortedcontainers-2.4.0-py2.py3-none-any.whl",
          "bytes": 29575,
          "sha256": "a163dcaede0f1c021485e957a39245190e74249897e2ae4b2aa38595db237ee0"
        },
        {
          "path": "wheelhouse/sse_starlette-3.2.0-py3-none-any.whl",
          "bytes": 12763,
          "sha256": "5876954bd51920fc2cd51baee47a080eb88a37b5b784e615abb0b283f801cdbf"
        },
        {
          "path": "wheelhouse/starlette-0.52.1-py3-none-any.whl",
          "bytes": 74272,
          "sha256": "0029d43eb3d273bc4f83a08720b4912ea4b071087a3b48db01b7c839f7954d74"
        },
        {
          "path": "wheelhouse/textual-7.5.0-py3-none-any.whl",
          "bytes": 718164,
          "sha256": "849dfee9d705eab3b2d07b33152b7bd74fb1f5056e002873cc448bce500c6374"
        },
        {
          "path": "wheelhouse/typer-0.21.1-py3-none-any.whl",
          "bytes": 47381,
          "sha256": "7985e89081c636b88d172c2ee0cfe33c253160994d47bdfdc302defd7d1f1d01"
        },
        {
          "path": "wheelhouse/typing_extensions-4.15.0-py3-none-any.whl",
          "bytes": 44614,
          "sha256": "f0fa19c6845758ab08074a0cfa8b7aecb71c999ca73d62883bc25cc018c4e548"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.2-py3-none-any.whl",
          "bytes": 14611,
          "sha256": "4ed1cacbdc298c220f1bd249ed5287caa16f34d44ef4e9c3d0cbad5b521545e7"
        },
        {
          "path": "wheelhouse/uc_micro_py-1.0.3-py3-none-any.whl",
          "bytes": 6229,
          "sha256": "db1dffff340817673d7b466ec86114a9dc0e9d4d9b5ba229d9d60e5c12600cd5"
        },
        {
          "path": "wheelhouse/urllib3-2.6.3-py3-none-any.whl",
          "bytes": 131584,
          "sha256": "bf272323e553dfb2e87d9bfd225ca7b0f467b919d7bbd355436d3fd37cb0acd4"
        },
        {
          "path": "wheelhouse/uvicorn-0.40.0-py3-none-any.whl",
          "bytes": 68502,
          "sha256": "c6c8f55bc8bf13eb6fa9ff87ad62308bbbc33d0b67f84293151efe87e0d5f2ee"
        },
        {
          "path": "wheelhouse/websockets-16.0-cp312-cp312-win_amd64.whl",
          "bytes": 178693,
          "sha256": "5569417dc80977fc8c2d43a86f78e0a5a22fee17565d78621b6bb264a115d4ea"
        },
        {
          "path": "wheelhouse/zipp-3.23.0-py3-none-any.whl",
          "bytes": 10276,
          "sha256": "071652d6115ed432f5ce1d34c336c0adfd6a884660d1e9712a256d3d3bd4b14e"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/python.exe",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "ff7c554d06717f3f4cb1ccde88b50f4f3076c7bf4aaa9d371db6613fb8db26c6",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "GPL-3.0",
        "url": "https://www.gnu.org/licenses/gpl-3.0.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/xhs-archive-2.7-afaf2fb.spdx.json",
        "sha256": "134c9ad17a350a4de3e335cfc4627b20e071895001be5f7bb0dae566373d99be"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "IwhayqpHyuPf3mtuJqKc6XeKHI+PtRRgLEKH3RIVvAamSIKc86kkjh6HOoGCe7fQ+75oODpt1Fs32XKOcLYSCg=="
    },
    {
      "protocolVersion": 1,
      "id": "xhs-browser",
      "moduleId": "xhs-browser",
      "groupId": "archive",
      "displayName": "小红书登录浏览器（Chromium）",
      "purpose": "安装与桌面版 Playwright 固定版本匹配的 Chromium，仅用于小红书扫码登录；系统 Chrome/Edge 可直接复用，无需重复安装。",
      "dependencyIds": [],
      "taskToolIds": [],
      "installConditions": [
        "可选能力；如果本机已安装 Chrome 或 Edge，可直接复用。",
        "扫码登录需要联网；卸载此包会保留应用内登录资料和历史存档。"
      ],
      "version": "1.63.0-chromium-1243",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/xhs-browser-1.63.0-chromium-1243.tar.gz",
        "bytes": 209088995,
        "sha256": "bc83e88844a27e1cf4fd2b01a15439c27a9c2ab4f5cafe415873b0bf91ae36c1",
        "format": "tar.gz"
      },
      "installedBytes": 500000000,
      "files": [
        {
          "path": "browser/153.0.8010.12.manifest",
          "bytes": 226,
          "sha256": "e1d2a45582f9427029098886cd82f68d85d77b18e7fa79be855d8ffd1986c131"
        },
        {
          "path": "browser/ABOUT",
          "bytes": 257,
          "sha256": "122b32f3ee3f1e8d65c774f5257fc6cc2127b666148ced0ce2efa3ea57e1d93c"
        },
        {
          "path": "browser/chrome_100_percent.pak",
          "bytes": 737731,
          "sha256": "035254b60209846763bd19b380d37f59133d6b4670276cc975937eafa72d7eee"
        },
        {
          "path": "browser/chrome_200_percent.pak",
          "bytes": 1286352,
          "sha256": "b2a299c385f75e333849ca41385ffafc9925a604ca54f3cf9066074fb8b19ae2"
        },
        {
          "path": "browser/chrome_elf.dll",
          "bytes": 2729984,
          "sha256": "eadf93b6299493818f9b1be3acc3fb5592f38eebc2558b101ee9c9ef9979d2d5"
        },
        {
          "path": "browser/chrome_proxy.exe",
          "bytes": 2553344,
          "sha256": "ebd42fcdfdbf0190e5529b52007e8db63f90278be0fc9f50b90335816ad0658b"
        },
        {
          "path": "browser/chrome_pwa_launcher.exe",
          "bytes": 3182592,
          "sha256": "6cecc8211f28dbc4de35a273bfca52a7ad412369b3619742464a2affaa3a8b41"
        },
        {
          "path": "browser/chrome_wer.dll",
          "bytes": 115200,
          "sha256": "90c58e67e7bb45eb9be5f7dccc7f5057c74df410a502470789a9a4bd5ddf2571"
        },
        {
          "path": "browser/chrome.dll",
          "bytes": 301124096,
          "sha256": "0b69d34d08e1112d5e7de94e389d20e209a890e931863c734378b39b7394da13"
        },
        {
          "path": "browser/chrome.exe",
          "bytes": 4508160,
          "sha256": "9b07943f834485b43c9d54caea2951c78715f9f07070a80ab6658465ebd3e711"
        },
        {
          "path": "browser/D3DCompiler_47.dll",
          "bytes": 4753864,
          "sha256": "f5c95e919b4ffa1ac71049cd45b9f986d2965e6888395ca2806337985334fa56"
        },
        {
          "path": "browser/dxcompiler.dll",
          "bytes": 25830400,
          "sha256": "e90d131a9838c42d57ff50b7ea59ebbc3d5c2b03d327797535cbe34288b54f23"
        },
        {
          "path": "browser/dxil.dll",
          "bytes": 1503728,
          "sha256": "88d83e71c4f9f2a60deeaa685a6d034a182ca197b6ec53f86144335f663fd690"
        },
        {
          "path": "browser/elevated_tracing_service.exe",
          "bytes": 4485120,
          "sha256": "366c945c051d26aa7bf8bcf47e7e253150f3374c2c0242e46cd69d3574b7a8d2"
        },
        {
          "path": "browser/elevation_service.exe",
          "bytes": 3840512,
          "sha256": "c1578332b06ead38adc70199f9d60028d9e57b44b3007bea85c098e564e11ee6"
        },
        {
          "path": "browser/First Run",
          "bytes": 8,
          "sha256": "839adbaaca1c43dd4575c502ada96ebb4651f1a69b6fc5e42679beb47584181e"
        },
        {
          "path": "browser/hyphen-data/hyph-af.hyb",
          "bytes": 72640,
          "sha256": "5487ee44a4cd706d0086522e90c59c76cdf2ac68ce506fd3eae6054b9220c0cf"
        },
        {
          "path": "browser/hyphen-data/hyph-as.hyb",
          "bytes": 703,
          "sha256": "c2784e33158a807135850f7125a7eaabe472b3cfc7afb82c74f02da69ea250fe"
        },
        {
          "path": "browser/hyphen-data/hyph-be.hyb",
          "bytes": 6098,
          "sha256": "25b7cfa039f82ac92990e1789de40988d490db9b613852fb24036b38ff87893c"
        },
        {
          "path": "browser/hyphen-data/hyph-bg.hyb",
          "bytes": 3467,
          "sha256": "7593f0395081e3eeb2d8516d10746608afd826cffd4e7e37d53936993d200a13"
        },
        {
          "path": "browser/hyphen-data/hyph-bn.hyb",
          "bytes": 703,
          "sha256": "c2784e33158a807135850f7125a7eaabe472b3cfc7afb82c74f02da69ea250fe"
        },
        {
          "path": "browser/hyphen-data/hyph-cs.hyb",
          "bytes": 64245,
          "sha256": "97a4755fe9e653a08969f1933e3db19c712078b227bd5aa6799093abc5a0edc3"
        },
        {
          "path": "browser/hyphen-data/hyph-cu.hyb",
          "bytes": 52842,
          "sha256": "2baee19d5024ff87dcf3a1b9d0da1b3ac5a1e506adeead3b96a4de5395d0290e"
        },
        {
          "path": "browser/hyphen-data/hyph-cy.hyb",
          "bytes": 35913,
          "sha256": "4d0569fe2f4b41b3164cf610310e1d996fd2c553cc39de6062e50f4e033cc207"
        },
        {
          "path": "browser/hyphen-data/hyph-da.hyb",
          "bytes": 6967,
          "sha256": "86fdfc8db62cdaa11f615dad3712da1f4708294e029a4aad0fc285d4ea16c4bd"
        },
        {
          "path": "browser/hyphen-data/hyph-de-1901.hyb",
          "bytes": 121393,
          "sha256": "8c5fa4b29519d17593e923bc6a9a284df7a6d07fac42f897110b8fb2e0baeef5"
        },
        {
          "path": "browser/hyphen-data/hyph-de-1996.hyb",
          "bytes": 120412,
          "sha256": "d673805547a0228d2f57a5ad551b8760cfcc521f38c49284ed3976e3515bca49"
        },
        {
          "path": "browser/hyphen-data/hyph-de-ch-1901.hyb",
          "bytes": 120218,
          "sha256": "8223a912160354e05735522fdb339dc59b353ad5d1e4f4cfa94898dc348e748f"
        },
        {
          "path": "browser/hyphen-data/hyph-el.hyb",
          "bytes": 4219,
          "sha256": "76ae3454fb0045adb83094832578aa4749ce4dc694c4edcf85b419c1e2d9bcd3"
        },
        {
          "path": "browser/hyphen-data/hyph-en-gb.hyb",
          "bytes": 46607,
          "sha256": "ae4b78009d18e849d87458677151ee3aad1608ad72ec050dfd2421d22e7d031f"
        },
        {
          "path": "browser/hyphen-data/hyph-en-us.hyb",
          "bytes": 59802,
          "sha256": "03727cd6f4aa71b203c4c74ca6987ac7d87f13037337ac6f4b6996c2a0dc5f8c"
        },
        {
          "path": "browser/hyphen-data/hyph-es.hyb",
          "bytes": 14995,
          "sha256": "137461792537a2e56a6475e81e2b9ad7a2bdabf1f4738fae186dca3022357349"
        },
        {
          "path": "browser/hyphen-data/hyph-et.hyb",
          "bytes": 21421,
          "sha256": "10079c66014dd2e6abfef5a018e6553fd5a036afb96bd2a235440a188f88b15e"
        },
        {
          "path": "browser/hyphen-data/hyph-eu.hyb",
          "bytes": 665,
          "sha256": "e2778a4fc7b8f064a32b6a44bc29f10e264d9d6214b8edb8ebd1f5f6d68e2eb2"
        },
        {
          "path": "browser/hyphen-data/hyph-fr.hyb",
          "bytes": 8165,
          "sha256": "00bd8b2d398d77575da2bfbbc5ec641aad7f2a87d4a31186ec169e85a27de5b7"
        },
        {
          "path": "browser/hyphen-data/hyph-ga.hyb",
          "bytes": 35824,
          "sha256": "1e3043f395bfb2a4c43d0480ba2f168ed622881cc3482359ca6e99821e983be8"
        },
        {
          "path": "browser/hyphen-data/hyph-gl.hyb",
          "bytes": 9289,
          "sha256": "89d98eff14e2cf1c2314efdf392339e62d7e786f100202a7377bf7b22095a0c5"
        },
        {
          "path": "browser/hyphen-data/hyph-gu.hyb",
          "bytes": 655,
          "sha256": "af0edb67c2219b803c3eb6c1dee6f2d41a3fe00468a9da8be8ef5056d701abf3"
        },
        {
          "path": "browser/hyphen-data/hyph-hi.hyb",
          "bytes": 687,
          "sha256": "f4df224d459fd111698dd5a13613c5bbf0ed11f04278d60230d028010eac0c42"
        },
        {
          "path": "browser/hyphen-data/hyph-hr.hyb",
          "bytes": 3031,
          "sha256": "d5f066a5657f1d7c39d053956df204b7926f40d2fe4f69573af09d909066e26c"
        },
        {
          "path": "browser/hyphen-data/hyph-hu.hyb",
          "bytes": 317251,
          "sha256": "8b3a16268cc932b226c17ff405b3cfb6eb38a9511a2043d653dc03729efceac1"
        },
        {
          "path": "browser/hyphen-data/hyph-hy.hyb",
          "bytes": 605,
          "sha256": "9b34dfca85cb27546829f104f137757efb274934c1e9d4991f55ad564962a76a"
        },
        {
          "path": "browser/hyphen-data/hyph-it.hyb",
          "bytes": 2512,
          "sha256": "f9c027d7fd44b01cd5e1cdf802e20c63560673098af18bea0930ba9af334e0f7"
        },
        {
          "path": "browser/hyphen-data/hyph-ka.hyb",
          "bytes": 9996,
          "sha256": "2472271c7955c67e9fdb86d0cd3c5d88f5e598da4f44b6741284b2bbcb2e4d52"
        },
        {
          "path": "browser/hyphen-data/hyph-kn.hyb",
          "bytes": 711,
          "sha256": "2b999d0a152f804601aa8f38ff0d3a6e5949977bf1daa76fa888acae21526287"
        },
        {
          "path": "browser/hyphen-data/hyph-la.hyb",
          "bytes": 1839,
          "sha256": "fd4b6f36135cd3b932e350ec2017dfd89d2e36ac226f54e4c8f2e4bc6db0593d"
        },
        {
          "path": "browser/hyphen-data/hyph-lt.hyb",
          "bytes": 7774,
          "sha256": "6fe2da26a96834fb9aecbe586d40f728df0ef676a4f235450054e66841b9e2ca"
        },
        {
          "path": "browser/hyphen-data/hyph-lv.hyb",
          "bytes": 38602,
          "sha256": "65962ccb5055e4c693e5ac493d6affdc810ec168eb2942f5705b7f4e464f9993"
        },
        {
          "path": "browser/hyphen-data/hyph-ml.hyb",
          "bytes": 776,
          "sha256": "90572db8f49b01ec6a102732cdf14fc3f07d363cbe0d261103e583043164e888"
        },
        {
          "path": "browser/hyphen-data/hyph-mn-cyrl.hyb",
          "bytes": 5142,
          "sha256": "0d2731f16aa2c90faec8e63260358cbccede403faf95e3af8c66bc2db0729ca0"
        },
        {
          "path": "browser/hyphen-data/hyph-mr.hyb",
          "bytes": 687,
          "sha256": "f4df224d459fd111698dd5a13613c5bbf0ed11f04278d60230d028010eac0c42"
        },
        {
          "path": "browser/hyphen-data/hyph-mul-ethi.hyb",
          "bytes": 3740,
          "sha256": "f2fac1bd069ffe5cd1112d94cc31137ed38a1b161093ecd74c9c1688428b688b"
        },
        {
          "path": "browser/hyphen-data/hyph-nb.hyb",
          "bytes": 145263,
          "sha256": "c2771fbb1bfff7db5e267dc7a4505a9675c6b98cfe7a8f7ae5686d7a5a2b3dd0"
        },
        {
          "path": "browser/hyphen-data/hyph-nl.hyb",
          "bytes": 77080,
          "sha256": "5ebde398944b461cf940f0520c5a49c0882b6f36f9ac5cda0538c8c8b44fb7ca"
        },
        {
          "path": "browser/hyphen-data/hyph-nn.hyb",
          "bytes": 145263,
          "sha256": "5bcbb58eaf65f13f6d039244d942f37c127344e3a0a2e6c32d08236945132809"
        },
        {
          "path": "browser/hyphen-data/hyph-or.hyb",
          "bytes": 647,
          "sha256": "4e9cd302baffc4ea3e9652327ea24072ebf37b5c4fc0719292bdac10aaad665b"
        },
        {
          "path": "browser/hyphen-data/hyph-pa.hyb",
          "bytes": 607,
          "sha256": "470329d28faa484f945d78ffefb176dcb6f2032c753e25bc014106ad24b2c68a"
        },
        {
          "path": "browser/hyphen-data/hyph-pt.hyb",
          "bytes": 1414,
          "sha256": "f6fbf1bcb260cc86256fc494f388f7b27d10865fbf8f61517dee25af4d58d6e8"
        },
        {
          "path": "browser/hyphen-data/hyph-ru.hyb",
          "bytes": 19886,
          "sha256": "336ce2048ffd31b7bcaf435e53badfaf0579e405042d49adbc0823f6be5f9614"
        },
        {
          "path": "browser/hyphen-data/hyph-sk.hyb",
          "bytes": 64103,
          "sha256": "138c5990961da21993653f54a413ddacb8921d6d70b892b7ca154d6e8ad2028c"
        },
        {
          "path": "browser/hyphen-data/hyph-sl.hyb",
          "bytes": 6631,
          "sha256": "ad746c68562603ac3b15e89da03c76e081c08e7d9c8d4c9f64763e53d696c77c"
        },
        {
          "path": "browser/hyphen-data/hyph-sq.hyb",
          "bytes": 2013,
          "sha256": "bc29c9401ce952414cbaebc5c8ee1d27c1706c6f77807b5ff713e2124438b3ca"
        },
        {
          "path": "browser/hyphen-data/hyph-sv.hyb",
          "bytes": 72119,
          "sha256": "56642aa5a37625ff9d034761d16b034d4ba5be74090cbd825956bbce2775ecd1"
        },
        {
          "path": "browser/hyphen-data/hyph-ta.hyb",
          "bytes": 554,
          "sha256": "40fda94856a86f065de8baa6184ea63dcdb011ee4ca498a7c1fee44c99314c67"
        },
        {
          "path": "browser/hyphen-data/hyph-te.hyb",
          "bytes": 703,
          "sha256": "516fa9654fa3aeaab480d40eaf6ad78fc039086bd8edc144be3d59525edcac29"
        },
        {
          "path": "browser/hyphen-data/hyph-tk.hyb",
          "bytes": 2712,
          "sha256": "77fdaed29bd842aaa976ab7ef81b617a15c0a2d1ebd1161c1bf26b79a108b5cd"
        },
        {
          "path": "browser/hyphen-data/hyph-uk.hyb",
          "bytes": 19417,
          "sha256": "1c626abe40d43f6d56a01b5b40305d7c7d6481f616eac00a3f3aaaaca8388786"
        },
        {
          "path": "browser/hyphen-data/hyph-und-ethi.hyb",
          "bytes": 3484,
          "sha256": "1de83cb787dfaf53fb7e6e8db3aae5008ad24ebdd28be02031306ea9e9f3e285"
        },
        {
          "path": "browser/hyphen-data/manifest.json",
          "bytes": 77,
          "sha256": "aeb0e502811ddb8d2561e81e2e82a013152d8b49de59e4b0c04669982138d641"
        },
        {
          "path": "browser/icudtl.dat",
          "bytes": 10823536,
          "sha256": "a3c6d7824935e87fed17e94c2d84b7683ef360ebc5c4ea92e2ca70f361bc9314"
        },
        {
          "path": "browser/IwaKeyDistribution/iwa-key-distribution.pb",
          "bytes": 3519,
          "sha256": "cf2be19520e0398b4b0ef38bef4940102bc9133d913dc990753cf2a38296e317"
        },
        {
          "path": "browser/IwaKeyDistribution/manifest.json",
          "bytes": 113,
          "sha256": "4ad5de58e7812aa71fa80dcf959f6dcd97a2b82f5319558d69d9860a95efc97e"
        },
        {
          "path": "browser/libEGL.dll",
          "bytes": 453120,
          "sha256": "b1b3c144d8b6e0ed4eed5472fd3daab2bf247b974e25e3f8fe69a06083d07bf8"
        },
        {
          "path": "browser/libGLESv2.dll",
          "bytes": 453120,
          "sha256": "81378414d5abb245e38860228648064cd7988859641226fae3e8aa0dc2584e94"
        },
        {
          "path": "browser/locales/af_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/af_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/af_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/af.pak",
          "bytes": 549250,
          "sha256": "e63a7034abfff73173cf1047a78963e742472075934452aa35e8fcc20e93c086"
        },
        {
          "path": "browser/locales/am_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/am_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/am_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/am.pak",
          "bytes": 886152,
          "sha256": "034baf3f8a973a39b70dfde61973a3e51cd26bb35506c2ffa1933b62a8cbc0b6"
        },
        {
          "path": "browser/locales/ar_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ar_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ar_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ar.pak",
          "bytes": 986595,
          "sha256": "819903bd19661f59a851edbd03efc458ace58beb34d00fdd272c6b0c74933b4c"
        },
        {
          "path": "browser/locales/bg_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/bg_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/bg_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/bg.pak",
          "bytes": 1018139,
          "sha256": "19f45279c1916990fa53ee04eb0cdea46455181c257cf1d2423ddcff38223785"
        },
        {
          "path": "browser/locales/bn_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/bn_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/bn_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/bn.pak",
          "bytes": 1297180,
          "sha256": "c5cd5ea5840917a305476ecea8c3f97316b2b8c2d384f313fe18c12939a53647"
        },
        {
          "path": "browser/locales/ca_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ca_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ca_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ca.pak",
          "bytes": 626198,
          "sha256": "358b7915ef2578caa461b74b0c455993e039914ec8a917ec474e8b99b73cb82d"
        },
        {
          "path": "browser/locales/cs_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/cs_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/cs_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/cs.pak",
          "bytes": 642463,
          "sha256": "f7c8c5c2edf5a33fb3cfaa8302b62e1950bf07dee41485d295c58011b2021cae"
        },
        {
          "path": "browser/locales/da_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/da_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/da_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/da.pak",
          "bytes": 579820,
          "sha256": "497fc29520761c34a009ef96805436b441a281c9a4f94ff219ad42e4e1209408"
        },
        {
          "path": "browser/locales/de_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/de_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/de_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/de.pak",
          "bytes": 629329,
          "sha256": "9952c087e1e520529ef566f50309420aa58394d0e26fe97a0db0289b247db0f5"
        },
        {
          "path": "browser/locales/el_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/el_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/el_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/el.pak",
          "bytes": 1118488,
          "sha256": "dcb3c13ff584b8f20ea659fa1761206e25b53704c1898439ee0b6e2f09b0928f"
        },
        {
          "path": "browser/locales/en-GB_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/en-GB_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/en-GB_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/en-GB.pak",
          "bytes": 500340,
          "sha256": "377c1ee1512b0c8ef4a590082596d56942208d398dd578364dcd18dbf9542a5e"
        },
        {
          "path": "browser/locales/en-US_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/en-US_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/en-US_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/en-US.pak",
          "bytes": 506221,
          "sha256": "86be4cb68c6f5c56e4566f48077dac2371631a9c927f4617181921cc65c798b7"
        },
        {
          "path": "browser/locales/es_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/es_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/es_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/es-419_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/es-419_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/es-419_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/es-419.pak",
          "bytes": 612905,
          "sha256": "71701c3fc9fc7d44bd4bf1ad6f035a4dae20bd1d906e4b2c12135ae162920c71"
        },
        {
          "path": "browser/locales/es.pak",
          "bytes": 608691,
          "sha256": "ab4060c2acc527fac90cd03299ed7fdfb9a0d77bdee69784c75eeece64f28198"
        },
        {
          "path": "browser/locales/et_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/et_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/et_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/et.pak",
          "bytes": 558003,
          "sha256": "38233453e272ad16029d74ab289b875b2596eda33a5ab4ed707add59bd22f495"
        },
        {
          "path": "browser/locales/fa_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fa_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fa_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fa.pak",
          "bytes": 918688,
          "sha256": "6c4d3e7b8c724fecdafe212d31989b665f1356f5b28274f5c0186b12ae351270"
        },
        {
          "path": "browser/locales/fi_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fi_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fi_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fi.pak",
          "bytes": 566676,
          "sha256": "b6431096fd874fe412649057e679c1bd4698c3c7f3dd45813e2a54e9fc0c71ec"
        },
        {
          "path": "browser/locales/fil_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fil_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fil_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fil.pak",
          "bytes": 641082,
          "sha256": "deec89da3d33c7c2c5bf6015cd360deea8d3f4781265c8144d2e7a9aa6986dcd"
        },
        {
          "path": "browser/locales/fr_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fr_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fr_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/fr.pak",
          "bytes": 665917,
          "sha256": "3216623c901ddac0efccf1c0efc91be8fd7faea051f96d468c9199f4dd04f47e"
        },
        {
          "path": "browser/locales/gu_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/gu_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/gu_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/gu.pak",
          "bytes": 1289444,
          "sha256": "a5f1accd18b3cff5deebaca294249c58eff92c3d3617d8527307bb79ea4a6093"
        },
        {
          "path": "browser/locales/he_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/he_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/he_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/he.pak",
          "bytes": 805746,
          "sha256": "1caef1e216a5a9b6d709036b707fded62c3339d60b220898e27872dfbd0be14d"
        },
        {
          "path": "browser/locales/hi_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hi_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hi_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hi.pak",
          "bytes": 1372229,
          "sha256": "83f873ed01656295aab16c500e2afd8a5ec5804423b7e4b9d9aa85e7f44a4963"
        },
        {
          "path": "browser/locales/hr_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hr_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hr_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hr.pak",
          "bytes": 618549,
          "sha256": "a4f24b1a0ffd1c91ccdaa1ca78aed149688e7399872ce547923d6f1bd83d4967"
        },
        {
          "path": "browser/locales/hu_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hu_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hu_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/hu.pak",
          "bytes": 663088,
          "sha256": "c1072e4e9e85503ac0a910d51e7fcfdf0c584462319b4430acfa3c27fa569d10"
        },
        {
          "path": "browser/locales/id_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/id_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/id_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/id.pak",
          "bytes": 548666,
          "sha256": "c427bc11a3068106704988e6d74c45f9559f7bb57fb37e17b57eb5e74290255d"
        },
        {
          "path": "browser/locales/it_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/it_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/it_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/it.pak",
          "bytes": 607419,
          "sha256": "8e03c35f7d80adcb6ef935dd10e4d00b054326307269d8f55d3e611e42604d1b"
        },
        {
          "path": "browser/locales/ja_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ja_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ja_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ja.pak",
          "bytes": 734920,
          "sha256": "07035a88cb98296d608238b3803052eb136e3edc9a28041fa5db1e49b2fb0365"
        },
        {
          "path": "browser/locales/kn_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/kn_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/kn_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/kn.pak",
          "bytes": 1476030,
          "sha256": "d6abdd02308a6ba02fa4cb5dbc2d8828424d03324fb8b8a373555b960cade9e3"
        },
        {
          "path": "browser/locales/ko_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ko_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ko_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ko.pak",
          "bytes": 625300,
          "sha256": "e58208da7799d48f6d416b4ab120fa571cc05e11ede01f597b39cda81abe9e90"
        },
        {
          "path": "browser/locales/lt_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/lt_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/lt_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/lt.pak",
          "bytes": 672783,
          "sha256": "6a318f74f398168b463798bba54121e845c4a9a80317152231922a0b2b7db62d"
        },
        {
          "path": "browser/locales/lv_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/lv_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/lv_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/lv.pak",
          "bytes": 669278,
          "sha256": "7639659bd8959753bb1e597427d301c171dca4cda0131256fe8d819a42a8fb67"
        },
        {
          "path": "browser/locales/ml_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ml_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ml_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ml.pak",
          "bytes": 1518924,
          "sha256": "5f705fb984fcfbc6cf9df4067bea3a88b74cc620f57273eb910d0d45ffc3bdb2"
        },
        {
          "path": "browser/locales/mr_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/mr_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/mr_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/mr.pak",
          "bytes": 1258815,
          "sha256": "18b0dc7a1e465a7f94931281a341d8591c5921a48411674822a32ea4a8af0244"
        },
        {
          "path": "browser/locales/ms_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ms_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ms_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ms.pak",
          "bytes": 576664,
          "sha256": "7a0930dded2fbcd3a30fc9fe00837e56df3cdb8ed5cc6f0d7b0fb200e2ef6843"
        },
        {
          "path": "browser/locales/nb_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/nb_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/nb_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/nb.pak",
          "bytes": 552411,
          "sha256": "97662be512e1ba9b0867cada79c3b0e8cabc4750438629c0e5504abe221560d6"
        },
        {
          "path": "browser/locales/nl_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/nl_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/nl_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/nl.pak",
          "bytes": 576177,
          "sha256": "7623e55836aa422cf2c83be35a7e3a4e4d41567ecb5a8690a99565df4f81ad2a"
        },
        {
          "path": "browser/locales/pl_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pl_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pl_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pl.pak",
          "bytes": 643607,
          "sha256": "863d2234f84bafb8c6a064e4f204daa2017c48d065df49fd2f1bfb44fca043b1"
        },
        {
          "path": "browser/locales/pt-BR_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pt-BR_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pt-BR_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pt-BR.pak",
          "bytes": 602421,
          "sha256": "ba9491e6a8d837f7eb9b1ba52eb51ed96cff74de3d7e1912e7678fc5828ccd74"
        },
        {
          "path": "browser/locales/pt-PT_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pt-PT_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pt-PT_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/pt-PT.pak",
          "bytes": 606281,
          "sha256": "c1710973c4a8488f92dbadd2ffc0ea18427497ffeed05fa5d326618993498820"
        },
        {
          "path": "browser/locales/ro_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ro_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ro_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ro.pak",
          "bytes": 628181,
          "sha256": "9fa52e84f1103d2b1c563b4e04205bb54eb712383aee0d8a4e9e0cf3d392698b"
        },
        {
          "path": "browser/locales/ru_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ru_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ru_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ru.pak",
          "bytes": 1036098,
          "sha256": "1ba30143cd73b950f6f4fa58e62491b2352a4f24b3da3bb222c00f46b9bc23c7"
        },
        {
          "path": "browser/locales/sk_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sk_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sk_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sk.pak",
          "bytes": 652994,
          "sha256": "91abd7a29db21f9d98b3018cd4ee6209663b1cb1cfcc9543240fbd882497ce7c"
        },
        {
          "path": "browser/locales/sl_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sl_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sl_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sl.pak",
          "bytes": 623531,
          "sha256": "c8a43f0cdf378014ab2abd0588641d2d0f89b0ab7695428b743da706c902114a"
        },
        {
          "path": "browser/locales/sr_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sr_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sr_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sr.pak",
          "bytes": 958478,
          "sha256": "f1eec03267e05df1896314e34efc318608d016fb754adaee995e574fd133b06e"
        },
        {
          "path": "browser/locales/sv_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sv_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sv_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sv.pak",
          "bytes": 559321,
          "sha256": "b59b72179b1cc284dd31912b3d7ffed7cd5b1ec183f60f94554a0cca857fd2cc"
        },
        {
          "path": "browser/locales/sw_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sw_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sw_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/sw.pak",
          "bytes": 591102,
          "sha256": "b18aa06710480ba2f9ae3dc5d46ded1b347e8bb81250cbcd2eaf2b383a24cef8"
        },
        {
          "path": "browser/locales/ta_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ta_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ta_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ta.pak",
          "bytes": 1512590,
          "sha256": "d8fa15bb30cfc16c1ee1bfa39928c037da8c3f7fc4a0546ae5f0a80863fd0943"
        },
        {
          "path": "browser/locales/te_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/te_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/te_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/te.pak",
          "bytes": 1401999,
          "sha256": "3485d143f8723eb5e8c93616a607a7342dfd283c9d3f021a37d9398c524f6f17"
        },
        {
          "path": "browser/locales/th_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/th_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/th_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/th.pak",
          "bytes": 1175060,
          "sha256": "1ad587441f6c8f499c8d04252666adcd34a14b634e90a27078bc87b146490093"
        },
        {
          "path": "browser/locales/tr_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/tr_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/tr_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/tr.pak",
          "bytes": 602416,
          "sha256": "c92d00a4ecae7374e47b70f89243f12e4b286b830fb1f46f6574eadb17767368"
        },
        {
          "path": "browser/locales/uk_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/uk_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/uk_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/uk.pak",
          "bytes": 1043395,
          "sha256": "467f54b07ffc8db46aba899834c2a1cbcac631756c9d037972b0dc56fab7e5b1"
        },
        {
          "path": "browser/locales/ur_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ur_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ur_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/ur.pak",
          "bytes": 900239,
          "sha256": "e283393bfa88ae6ae61e4b53b44dffaa5223dfc43355c84996531d8e92a7cad3"
        },
        {
          "path": "browser/locales/vi_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/vi_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/vi_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/vi.pak",
          "bytes": 716953,
          "sha256": "36577b162ca8afe73718d3fa1f0b8cbada379a62a69ea51441c6a2af0f7b6512"
        },
        {
          "path": "browser/locales/zh-CN_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/zh-CN_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/zh-CN_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/zh-CN.pak",
          "bytes": 514477,
          "sha256": "f4e590cb55d3e2d15ce5868289f0b70419f747d8fd7383aaa7176f5808e90036"
        },
        {
          "path": "browser/locales/zh-TW_FEMININE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/zh-TW_MASCULINE.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/zh-TW_NEUTER.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/locales/zh-TW.pak",
          "bytes": 508095,
          "sha256": "8628ec255c329cc3fb2c89401f3f5b3fc5461a96f75e7ae6910efbf1db76ca0f"
        },
        {
          "path": "browser/MEIPreload/manifest.json",
          "bytes": 238,
          "sha256": "44844cf3dde6e80087ae0e6bf0d9326d7ef7d23326d24ac83af0850be26923d2"
        },
        {
          "path": "browser/MEIPreload/preloaded_data.pb",
          "bytes": 8254,
          "sha256": "c6070a157b4e28d16fbccbd233e93846ddb070c85e1a1bc64469b7a5f1424fad"
        },
        {
          "path": "browser/notification_helper.exe",
          "bytes": 2786304,
          "sha256": "082bbd227a9b58282b54a20c3ffa52a669d47b130dff7551c0ce1cd4953905c2"
        },
        {
          "path": "browser/PrivacySandboxAttestationsPreloaded/manifest.json",
          "bytes": 122,
          "sha256": "51c311a4ba03140bcd1c827f8d93dba50cadda736925903b26e95609275dbffd"
        },
        {
          "path": "browser/PrivacySandboxAttestationsPreloaded/privacy-sandbox-attestations.dat",
          "bytes": 7624,
          "sha256": "59e345dc13aedee9ea46b92e58300ecaca944aaea9384c7af885400ac2ae8806"
        },
        {
          "path": "browser/resources.pak",
          "bytes": 22880170,
          "sha256": "2071780bbb6e0a69add3778d36f99ba301c49cbfe813979a6a1280086170ba32"
        },
        {
          "path": "browser/resources/accessibility/reading_mode_gdocs_helper_manifest.json",
          "bytes": 2400,
          "sha256": "4d9a116e7657ddcc9848e5e01e16162300a0a8781cdcbe79bde3ca47ff184a55"
        },
        {
          "path": "browser/resources/accessibility/reading_mode_gdocs_helper/content.js",
          "bytes": 439,
          "sha256": "6c0aeaaf9a71ad68aa45764c111e70bb23aa0fbf406644a375b6b709cbbe4b6e"
        },
        {
          "path": "browser/resources/accessibility/reading_mode_gdocs_helper/gdocs_script.js",
          "bytes": 1425,
          "sha256": "d291adabcfcb1a4a4a2ffacdd9d04fdb473ab0d6903556bef7446be9c3646d86"
        },
        {
          "path": "browser/setup.exe",
          "bytes": 6154240,
          "sha256": "1b18972e19dedd6a8adc33d1ddbf91fffcc202d27e273920305922e6f5321db9"
        },
        {
          "path": "browser/v8_context_snapshot.bin",
          "bytes": 747232,
          "sha256": "b2d11433e1851180d3e1cdeb6b13273dcb68f269650f2983b4eeb425c1755603"
        },
        {
          "path": "browser/vk_swiftshader_icd.json",
          "bytes": 106,
          "sha256": "32d83ff113fef532a9f97e0d2831f8656628ab1c99e9060f0332b1532839afd9"
        },
        {
          "path": "browser/vk_swiftshader.dll",
          "bytes": 5419008,
          "sha256": "5a2da21f1ad080d29d6d60e55bfa368a33e69718e3470a293d8a46d3f7e70e8a"
        },
        {
          "path": "browser/vulkan-1.dll",
          "bytes": 986624,
          "sha256": "0ddf3ef0d813a5e82251ca94c7ca8d1aec5210a209805c7fec910e7686e9e1f6"
        }
      ],
      "license": {
        "name": "BSD-3-Clause",
        "url": "https://opensource.org/license/bsd-3-clause/"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/xhs-browser-1.63.0-chromium-1243.spdx.json",
        "sha256": "c6bd285c59e718925ee82430092801a34a7448d162baf665fc6f7d8b52115485"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "Z2wtAMxWAgshD2S/TwN2jUUyniYFHJURZorkChZJuDQekAm0OL1JuqS1XZadmuMl/OciUYskFrOXR8QjpDOYBQ=="
    },
    {
      "protocolVersion": 1,
      "id": "xhs-translation",
      "moduleId": "xhs-translation",
      "groupId": "translation",
      "displayName": "小红书中英离线翻译",
      "purpose": "安装 CTranslate2 CPU 翻译 Worker、哈希锁定依赖和固定版本 OPUS-MT 模型；翻译能力可单独管理，不影响中文归档。",
      "dependencyIds": [
        "python-312"
      ],
      "taskToolIds": [
        "xhs-translation"
      ],
      "installConditions": [
        "需要 Python 3.12 共享运行时；模型随能力包安装，之后可离线翻译。",
        "首次下载约 250 MB，安装后预计占用约 500 MB。"
      ],
      "version": "1.0.0-ct2-cf109095",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/xhs-translation-1.0.0-ct2-cf109095.tar.gz",
        "bytes": 181112891,
        "sha256": "d77a05e293b5a391f93c35b43bcc72d6a01e1a65e2140676f17f0b5beb1813a2",
        "format": "tar.gz"
      },
      "installedBytes": 500000000,
      "files": [
        {
          "path": "model/config.json",
          "bytes": 215,
          "sha256": "ce02c0c0d02f285d2ff34c80b0867ccb5c4a3b250a275e6d1d2884f5499a6e46"
        },
        {
          "path": "model/generation_config.json",
          "bytes": 293,
          "sha256": "81f06422302b9f4666f20c6f20f43b904e38ccce9326a208f82ff97c2c9699e5"
        },
        {
          "path": "model/manifest.json",
          "bytes": 1377,
          "sha256": "e4c1a8fe3ab2f668c0ca07022ea4699f2cd2951a2acb0b14a92e911db51ffc8c"
        },
        {
          "path": "model/model.bin",
          "bytes": 155502615,
          "sha256": "a188bc45bce24635a1eb0cc42ad0b43afdad806b86af9beb3065bba11f3b212c"
        },
        {
          "path": "model/shared_vocabulary.json",
          "bytes": 1303998,
          "sha256": "acbf13516c56af2bb78ebdb770c2e4648fd8232ddd17af75298119cbfa7ee33d"
        },
        {
          "path": "model/source.spm",
          "bytes": 804677,
          "sha256": "e27a3a1b539f4959ec72ea60e453f49156289f95d4e6000b29332efc45616203"
        },
        {
          "path": "model/target.spm",
          "bytes": 806530,
          "sha256": "6a881f4717cd7265f53fea54fd3dc689c767c05338fac7a4590f3088cb2d7855"
        },
        {
          "path": "model/tokenizer_config.json",
          "bytes": 44,
          "sha256": "53cc7a6f05224f287476af4798d96b1b85da2edae60257e58633f092c7b5b823"
        },
        {
          "path": "model/vocab.json",
          "bytes": 1617902,
          "sha256": "c0f79ee4c413ccb24cd808a0c727eec85b2130f23c82802cc1caeb07b5f0d458"
        },
        {
          "path": "requirements.lock",
          "bytes": 32932,
          "sha256": "8ae7a0cf46f5c9a2401cdd5a84d66bad6dc17eb1b085cbc23a68760c2991a997"
        },
        {
          "path": "scripts/xhs-translation-worker.py",
          "bytes": 4923,
          "sha256": "1a5ec0e86ca81f53eda8c4aecae93b9fd6d6a86fcc9c7cd12ce707046db1c427"
        },
        {
          "path": "wheelhouse/annotated_doc-0.0.5-py3-none-any.whl",
          "bytes": 5302,
          "sha256": "117bac03a25ede5df5440e855b32d556049ca169ead221505badf432fed4b101"
        },
        {
          "path": "wheelhouse/annotated_types-0.8.0-py3-none-any.whl",
          "bytes": 13427,
          "sha256": "f072f4d804ea359e4eaf198b1af7a8b0943881a87f31bb764f8bf219bb9419e0"
        },
        {
          "path": "wheelhouse/anyio-4.15.1-py3-none-any.whl",
          "bytes": 132079,
          "sha256": "6152fdbbf9a77fdec97731721bebf7c4c44f7c29b424b0065826173efc7ed101"
        },
        {
          "path": "wheelhouse/click-8.5.0-py3-none-any.whl",
          "bytes": 125251,
          "sha256": "255bc9599cf7748b4b1a446ccc735421bd08a2ae529a8b88597d3de5664ee360"
        },
        {
          "path": "wheelhouse/ctranslate2-4.8.2-cp312-cp312-win_amd64.whl",
          "bytes": 19222069,
          "sha256": "d94421d565d0de61c032998f737a18942b0f2bef40c0424b1846ec6f67300105"
        },
        {
          "path": "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "bytes": 131954,
          "sha256": "bfb91aa2d334c61cb35ba9a116fc123b3d3df31640b801cf57a7a78ec3f603b3"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/idna-3.20-py3-none-any.whl",
          "bytes": 69583,
          "sha256": "ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c"
        },
        {
          "path": "wheelhouse/numpy-2.5.3-cp312-cp312-win_amd64.whl",
          "bytes": 12567828,
          "sha256": "0a59a421a32580a009e8a1751345bf829631b990dc1794b80514ab722b435def"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-win_amd64.whl",
          "bytes": 2043140,
          "sha256": "5e81740c09e310f5aa5cbd3e434a01c154d4bef93241c7877b39f211d2b78ba8"
        },
        {
          "path": "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "bytes": 472589,
          "sha256": "346a034f080da3755d8e9cb5e00e8b07de1d39e4f6e2c87d8ab7cafa0b269a73"
        },
        {
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-win_amd64.whl",
          "bytes": 154003,
          "sha256": "5fcd34e47f6e0b794d17de1b4ff496c00986e1c83f7ab2fb8fcfe9616ff7477b"
        },
        {
          "path": "wheelhouse/sentencepiece-0.2.2-cp312-cp312-win_amd64.whl",
          "bytes": 1248030,
          "sha256": "7c6e7bf684dc12145bfa685d3060beaea55139134ba848289bee514ed42e7383"
        },
        {
          "path": "wheelhouse/starlette-1.7.0-py3-none-any.whl",
          "bytes": 78980,
          "sha256": "67f8e99895493dd2911a03f11314af6ceebeae4e704bb9f43dfc6a9db151c93e"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.4-py3-none-any.whl",
          "bytes": 14750,
          "sha256": "65b8397ba37ccbce054456aaccddfc91e6e3083c92824df348d96ca832f3f147"
        },
        {
          "path": "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "bytes": 79871,
          "sha256": "f86e41a149d7d05a9969337e3946a9c171c06a5d42680896daaba624aeac8da1"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/python.exe",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "8ae7a0cf46f5c9a2401cdd5a84d66bad6dc17eb1b085cbc23a68760c2991a997",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "Apache-2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/xhs-translation-1.0.0-ct2-cf109095.spdx.json",
        "sha256": "1a2e484348646af7ea1c648713a4c1e1590c273f635e0be87b7c8aa4058cc471"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "i0xONsOobODjCn5Qur2lQYkkBzTN6K2UqQhe7GMp/M2BWVlEuln1aczscDh5xlzjoQG3QQvEaManw1DrTbOVCg=="
    }
  ],
  "trustedPublicKeys": {
    "ed25519-f372f170675a31f5015c6a38": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAbwknGXr7/yg9ybMEeb3ykpTSKiE9REB/Ft3uorMVZh0=\n-----END PUBLIC KEY-----\n",
    "ed25519-80154152cb788d65d9e6b661": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAkkENxOAwwVlHdJPkLjqYZ1XzaY+knV55v7Po3otcktg=\n-----END PUBLIC KEY-----\n"
  }
} satisfies ComponentCatalog;
