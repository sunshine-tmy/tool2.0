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
      "displayName": "参考音色克隆（CPU / MPS）",
      "purpose": "使用固定 Chatterbox Multilingual V3 模型；CPU 与已验证的 Apple Silicon MPS 均可运行。",
      "dependencyIds": [
        "ffmpeg",
        "python-312"
      ],
      "taskToolIds": [
        "chatterbox"
      ],
      "installConditions": [
        "首次安装需下载固定模型与 Apple Silicon Python 3.12 wheel，实际归档和解压空间以 Mac 能力包清单为准。",
        "MPS 仅在模型探针通过时开放；选择 MPS 后失败会返回错误，不静默切换 CPU。",
        "固定源码提交、Mac 哈希锁定依赖与模型均随包安装，生成时无需联网。"
      ],
      "version": "1.0.0-py312-mps1-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/chatterbox-1.0.0-py312-mps1-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 257769695,
        "sha256": "883c3ef031a43bb04b87ae73a7249ac2202f4c393ade5def8af224890ea3e78a",
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
          "wheelhouse/antlr4_python3_runtime-4.9.3-py3-none-any.whl",
          "wheelhouse/anyio-4.16.0-py3-none-any.whl",
          "wheelhouse/audioread-3.1.0-py3-none-any.whl",
          "wheelhouse/catalogue-2.0.10-py3-none-any.whl",
          "wheelhouse/certifi-2026.10.23-py3-none-any.whl",
          "wheelhouse/cffi-2.1.1-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/cfgv-3.5.0-py2.py3-none-any.whl",
          "wheelhouse/charset_normalizer-3.5.2-cp312-cp312-macosx_10_13_universal2.whl",
          "wheelhouse/click-8.5.1-py3-none-any.whl",
          "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "wheelhouse/conformer-0.3.2-py3-none-any.whl",
          "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "wheelhouse/deprecated-3.0.1-py3-none-any.whl",
          "wheelhouse/diffusers-0.38.0-py3-none-any.whl",
          "wheelhouse/distlib-0.4.4-py2.py3-none-any.whl",
          "wheelhouse/einops-0.8.2-py3-none-any.whl",
          "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "wheelhouse/filelock-4.2.9-py3-none-any.whl",
          "wheelhouse/fsspec-2026.9.0-py3-none-any.whl",
          "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "wheelhouse/hf_xet-1.8.0-cp38-abi3-macosx_11_0_arm64.whl",
          "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "wheelhouse/huggingface_hub-1.31.0-py3-none-any.whl",
          "wheelhouse/identify-2.6.20-py2.py3-none-any.whl",
          "wheelhouse/idna-3.20-py3-none-any.whl",
          "wheelhouse/importlib_metadata-10.1.0-py3-none-any.whl",
          "wheelhouse/jaconv-0.5.0-py3-none-any.whl",
          "wheelhouse/jinja2-3.1.6-py3-none-any.whl",
          "wheelhouse/joblib-1.6.0-py3-none-any.whl",
          "wheelhouse/lazy_loader-0.6-py3-none-any.whl",
          "wheelhouse/librosa-0.11.0-py3-none-any.whl",
          "wheelhouse/llvmlite-0.50.0-cp312-cp312-macosx_12_0_arm64.whl",
          "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "wheelhouse/markupsafe-3.0.4-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "wheelhouse/ml_dtypes-0.5.4-cp312-cp312-macosx_10_13_universal2.whl",
          "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "wheelhouse/msgpack-1.2.4-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/narwhals-2.28.0-py3-none-any.whl",
          "wheelhouse/networkx-3.7-py3-none-any.whl",
          "wheelhouse/nodeenv-1.12.0-py3-none-any.whl",
          "wheelhouse/numba-0.68.1-cp312-cp312-macosx_12_0_arm64.whl",
          "wheelhouse/numpy-1.26.4-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/omegaconf-2.3.1-py3-none-any.whl",
          "wheelhouse/onnx-1.23.2-cp312-abi3-macosx_13_0_universal2.whl",
          "wheelhouse/packaging-26.3-py3-none-any.whl",
          "wheelhouse/pillow-13.0.0-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/platformdirs-4.14.5-py3-none-any.whl",
          "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "wheelhouse/pre_commit-4.7.0-py2.py3-none-any.whl",
          "wheelhouse/protobuf-7.36.2-cp310-abi3-macosx_10_9_universal2.whl",
          "wheelhouse/pycparser-3.12-py3-none-any.whl",
          "wheelhouse/pydantic_core-2.46.5-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "wheelhouse/pygments-2.21.0-py3-none-any.whl",
          "wheelhouse/pykakasi-2.3.0-py3-none-any.whl",
          "wheelhouse/pyloudnorm-0.2.0-py3-none-any.whl",
          "wheelhouse/python_discovery-1.9.5-py3-none-any.whl",
          "wheelhouse/pyyaml-6.0.3-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/regex-2026.11.9-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "wheelhouse/resemble_perth-1.0.1-py3-none-any.whl",
          "wheelhouse/rich-15.0.0-py3-none-any.whl",
          "wheelhouse/s3tokenizer-0.3.0-py3-none-any.whl",
          "wheelhouse/safetensors-0.8.0-cp310-abi3-macosx_11_0_arm64.whl",
          "wheelhouse/scikit_learn-1.9.1-cp312-cp312-macosx_12_0_arm64.whl",
          "wheelhouse/scipy-1.17.1-cp312-cp312-macosx_14_0_arm64.whl",
          "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "wheelhouse/shellingham-1.5.4-py2.py3-none-any.whl",
          "wheelhouse/soundfile-0.14.0-py2.py3-none-macosx_11_0_arm64.whl",
          "wheelhouse/soxr-1.1.0-cp312-abi3-macosx_11_0_arm64.whl",
          "wheelhouse/spacy_pkuseg-1.0.1-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/srsly-2.5.6-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/starlette-1.6.0-py3-none-any.whl",
          "wheelhouse/sympy-1.13.1-py3-none-any.whl",
          "wheelhouse/threadpoolctl-3.8.0-py3-none-any.whl",
          "wheelhouse/tokenizers-0.23.3-cp310-abi3-macosx_11_0_arm64.whl",
          "wheelhouse/torch-2.6.0-cp312-none-macosx_11_0_arm64.whl",
          "wheelhouse/torchaudio-2.6.0-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "wheelhouse/transformers-5.17.0-py3-none-any.whl",
          "wheelhouse/typer-0.28.0-py3-none-any.whl",
          "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "wheelhouse/typing_inspection-0.4.5-py3-none-any.whl",
          "wheelhouse/urllib3-2.8.0-py3-none-any.whl",
          "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "wheelhouse/virtualenv-21.15.6-py3-none-any.whl",
          "wheelhouse/wrapt-2.5.2-cp312-cp312-macosx_11_0_arm64.whl",
          "wheelhouse/zipp-4.1.2-py3-none-any.whl"
        ]
      },
      "additionalArchives": [
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/chatterbox-1.0.0-py312-mps1-darwin-arm64.1-model-t3-darwin-arm64.tar.gz",
          "bytes": 1980678922,
          "sha256": "54f58d9feeed3a286c537c5c66e8b65bf6d9dc1f7d131b12654bcb58515fd682",
          "format": "tar.gz",
          "filePaths": [
            "models/chatterbox/t3_mtl23ls_v3.safetensors"
          ]
        },
        {
          "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/chatterbox-1.0.0-py312-mps1-darwin-arm64.1-model-s3gen-darwin-arm64.tar.gz",
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
          "bytes": 146750,
          "sha256": "5be58171ce22d603d97d415d8d4864c0dea0c2ac0ae4eae427098bc184bf63a2"
        },
        {
          "path": "scripts/chatterbox-worker.py",
          "bytes": 28894,
          "sha256": "144c8032c97d922f46e46cf869338cbeda6703d2ac410153ae8bc29c9db086fd"
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
          "bytes": 1067,
          "sha256": "4248e910a928849fe5815a0f9236e17fa07768d95b9193212752c464b93d6caa"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/METADATA",
          "bytes": 16200,
          "sha256": "109171c91f02aad970bfaaea50adbc60b225aaf4301cb6cfeb17a76d5aef4207"
        },
        {
          "path": "vendor/chatterbox_tts-0.1.7.dist-info/RECORD",
          "bytes": 8979,
          "sha256": "5617492b304cad83991c1a8604234dcc7861d69e2ae1a02a42de9a71f06296d2"
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
          "sha256": "98e75747d0b7c0c568bfb71263c3d8f970b3a374a6996087bc642be5cb09a1aa"
        },
        {
          "path": "vendor/chatterbox/__init__.py",
          "bytes": 300,
          "sha256": "dab20a9fb088c06cba044bc3b0ba2c52a914d5b5d51e6266bfd220d23f1bea41"
        },
        {
          "path": "vendor/chatterbox/models/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/__init__.py",
          "bytes": 68,
          "sha256": "1eb98b785c481502e515676da0e65afbfd8fa2254ae303b6fa9714db6a52730c"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/configs.py",
          "bytes": 220,
          "sha256": "15a84f5819e0fe1371ae4f5ac7e3cfb56df52cf36704401586efddd0383697fb"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/const.py",
          "bytes": 34,
          "sha256": "0a3a957453060ca081a427e71559889f65e45181e6d7befa649e7314cd90e516"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/decoder.py",
          "bytes": 13171,
          "sha256": "40d093fd61549a09f5f71d74081585df1e3871b3a8e6b6fafde12bb447701810"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/f0_predictor.py",
          "bytes": 1993,
          "sha256": "917825eec353b9601b9f7af0c0e3603eb1061d8b641539225e78c910d7bc2255"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/flow_matching.py",
          "bytes": 10786,
          "sha256": "63fc979521e1b758f0e8f3bee00a496a53184a714ef1a7a723b319a58158d612"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/flow.py",
          "bytes": 8178,
          "sha256": "1e9bc8219eb0832b6db2b86bf7e4085dc9d0c0de47e5c496eb94bbd38b01511d"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/hifigan.py",
          "bytes": 17652,
          "sha256": "e49f4723323937493ecf5f6c7f1934f57766ef46c74eaf7c60bf456a1c6fe897"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/decoder.py",
          "bytes": 14435,
          "sha256": "a9f35df7b3eb1c7defb8744626b32ef0504a519a066f3240fde90393a39b3488"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/flow_matching.py",
          "bytes": 4556,
          "sha256": "56614b92aad52f713c198ae089d47e6a7df13450f3cf5d1144f65fb34c35107d"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/text_encoder.py",
          "bytes": 14965,
          "sha256": "a1e993ad219d95dee864e010d8415e7057abb6131a21550093d83db0279b01cb"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/matcha/transformer.py",
          "bytes": 13237,
          "sha256": "66ff2092d974a99b251b9d8e5c08bbcecceaedfaf41e2bd8af2b4bc7a56dcbea"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/s3gen.py",
          "bytes": 13189,
          "sha256": "b3ea20b6f3f98dacfa3c2c99502bbf3dfbe7a77362f2ce0d16783d4324e6fc96"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/activation.py",
          "bytes": 3089,
          "sha256": "a4a96caea9f7b05111286de5ea760bdfdf9c4e53448f53420857dc04a50440c2"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/attention.py",
          "bytes": 14415,
          "sha256": "28c38f1e3ea1aeac1526e98f8349d9f068e25f1f6ae246c60badc3d540d62794"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/convolution.py",
          "bytes": 5230,
          "sha256": "eb5f41f324a97225c73b9c430af8bb231bd77386ef18450bb0fd329f469ab4e1"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/embedding.py",
          "bytes": 11399,
          "sha256": "3646e748783fe6c069b424cc9cbfe81bc54a5ccfea1ae7041df398a603cccd3e"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/encoder_layer.py",
          "bytes": 9602,
          "sha256": "1920582be2c9b7cf7835e7b539118ec1eb9da8f2c711c6257f8598b3792951b9"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/positionwise_feed_forward.py",
          "bytes": 4219,
          "sha256": "6e8038e3bcc8ca086ddca508fb9b9d40bf3ab98bebabcf5c94935d032329d0f8"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/subsampling.py",
          "bytes": 12666,
          "sha256": "31fc0347a851abc1205dfd4cf68099c0c416589c3e99a07b250e8630cece19d0"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/transformer/upsample_encoder.py",
          "bytes": 13694,
          "sha256": "1794ff01b678791ad665d7b0c0999448e760fc1dcb3bc8208de5f58510c1f68c"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/class_utils.py",
          "bytes": 2334,
          "sha256": "02f3cb3a55ee124c279777245b09061fa15a8182e6e7d7762f8fa45c0a631948"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/intmeanflow.py",
          "bytes": 951,
          "sha256": "df3c73d77244518c7b90224c2a5180bf0435d27868f598cb876cfcf812aa5285"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/mask.py",
          "bytes": 7666,
          "sha256": "902c85fbbd1e30a0cb9792cdcf1b9acd97804bd5cb3b5d6a440dc236f274bb3e"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/utils/mel.py",
          "bytes": 2556,
          "sha256": "afbb6fe14c30e104cb2617230daa2a6770f97452948b2e6f6eea4a4c2f4ff3ba"
        },
        {
          "path": "vendor/chatterbox/models/s3gen/xvector.py",
          "bytes": 14141,
          "sha256": "c7c759920cbf1aac9f12e0a15c1bf3d38da51ca9d3ea7a7b53cf740c86fe17fa"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/__init__.py",
          "bytes": 595,
          "sha256": "7357ce9a0349bae51e8e8cabcdd01ba8534dd6a2373c1e092291ecb716414fe0"
        },
        {
          "path": "vendor/chatterbox/models/s3tokenizer/s3tokenizer.py",
          "bytes": 5155,
          "sha256": "76eae9f95b14608c4847c9d7acfcf08138c365640b0d4589de01e742b0e5eb43"
        },
        {
          "path": "vendor/chatterbox/models/t3/__init__.py",
          "bytes": 19,
          "sha256": "cfecc1c7df7d22398157d40605abfa64f30ef9b697190dc4f57b229299f70538"
        },
        {
          "path": "vendor/chatterbox/models/t3/inference/t3_hf_backend.py",
          "bytes": 3990,
          "sha256": "2d8407cf500ec1e6b707b060861145bb7802741328d76ec341280c06c7f3f2b5"
        },
        {
          "path": "vendor/chatterbox/models/t3/llama_configs.py",
          "bytes": 1809,
          "sha256": "2501a407224b283f07ffdf4f93b6139fdb8977075ff4f3d79c72bbd7709b759c"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/cond_enc.py",
          "bytes": 3293,
          "sha256": "d8128803091423141051caf295de6208113da987fe537de5566c4b84e19df847"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/learned_pos_emb.py",
          "bytes": 1099,
          "sha256": "2ec5b09ce94d71261e9c25833a08f666bd6e2d5439b2314123e035c02df8b7af"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/perceiver.py",
          "bytes": 7719,
          "sha256": "f9c4b0130652e94d05873ead931ecd399a9dd644b7a17edf1b76d7d7f2bfbf42"
        },
        {
          "path": "vendor/chatterbox/models/t3/modules/t3_config.py",
          "bytes": 1245,
          "sha256": "e07d8c09f85242f061a036cb1ac56de5b49cd5444790e8ac35098df44348801f"
        },
        {
          "path": "vendor/chatterbox/models/t3/t3.py",
          "bytes": 18116,
          "sha256": "bfb689c9018a329aa3a1a364aaa6d03a68a97b7352cbc394a13d4711742f9a0a"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/__init__.py",
          "bytes": 48,
          "sha256": "6759fb8b4f6d50b8e4ab8ddd0e39d44e1ca7196544f93311b385a7eeea6c38c2"
        },
        {
          "path": "vendor/chatterbox/models/tokenizers/tokenizer.py",
          "bytes": 10202,
          "sha256": "e169f02f14b008e8e7a4f29df66ecafaa29972ff4a38724b51545b8563861889"
        },
        {
          "path": "vendor/chatterbox/models/utils.py",
          "bytes": 148,
          "sha256": "c30615629f906acf71c67104a78d36f682c635e55b808d7d8022d47a2738b225"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/__init__.py",
          "bytes": 56,
          "sha256": "adf1bcef74e90dae0fcb5c2945103cbc0bd9af15cc9be4288f960ad7d22ce678"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/config.py",
          "bytes": 406,
          "sha256": "0b41d794a16fd94929b37fd229dc61d3634178a11046a6b5834e109109a8e3c8"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/melspec.py",
          "bytes": 1940,
          "sha256": "0f5fea173841c5150fa6ea9236160798c8ee24afba724d65da61dce78a4d48e8"
        },
        {
          "path": "vendor/chatterbox/models/voice_encoder/voice_encoder.py",
          "bytes": 10555,
          "sha256": "4b12e9d49cbb7ce81e6731c02d4f37a9b763ef7419dba95a7e66ea078d49a9c3"
        },
        {
          "path": "vendor/chatterbox/mtl_tts.py",
          "bytes": 11721,
          "sha256": "936759044e54cffe8c68b91b32e01da0bc032a1e084f769f0403080d86ad153c"
        },
        {
          "path": "vendor/chatterbox/tts_turbo.py",
          "bytes": 9828,
          "sha256": "19b531951f0ea68102327f379b2b9eb986d37d4a3eae30ef58716c7d61abf98e"
        },
        {
          "path": "vendor/chatterbox/tts.py",
          "bytes": 8924,
          "sha256": "7896787bc17e20eafcd1dce7b8a4a6ea3a6478baab771c60d63e9e81f5564195"
        },
        {
          "path": "vendor/chatterbox/vc.py",
          "bytes": 3520,
          "sha256": "4093a7edf32b1174999b00a74b5b83de193763c65249b0d5288d5f45f3ac2d71"
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
          "path": "wheelhouse/antlr4_python3_runtime-4.9.3-py3-none-any.whl",
          "bytes": 144591,
          "sha256": "c58068bafb119566be88d8877a36794c96d52da62e50a1dc3a345ecdfdf955f3"
        },
        {
          "path": "wheelhouse/anyio-4.16.0-py3-none-any.whl",
          "bytes": 134521,
          "sha256": "c66ae634e0b8228396b801741beb3294326d4b6102f7bba4041c0dfb58c29026"
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
          "path": "wheelhouse/certifi-2026.10.23-py3-none-any.whl",
          "bytes": 135082,
          "sha256": "e9b54de76e530bb6cf0ccd036787103acb58fd42ba930ea8bf948ddbaa2f61d1"
        },
        {
          "path": "wheelhouse/cffi-2.1.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 184719,
          "sha256": "f81b3b8f3d4e343550fa4baa0e479bba9f2d29ce9c2e9b51d1ce1718d7442fcf"
        },
        {
          "path": "wheelhouse/cfgv-3.5.0-py2.py3-none-any.whl",
          "bytes": 7445,
          "sha256": "a8dc6b26ad22ff227d2634a65cb388215ce6cc96bbcc5cfde7641ae87e8dacc0"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.5.2-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 367780,
          "sha256": "ed2a239c0ea213acc1908150a3037257083c7c083128f1a4cec2ec4b97dca491"
        },
        {
          "path": "wheelhouse/click-8.5.1-py3-none-any.whl",
          "bytes": 126163,
          "sha256": "8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37"
        },
        {
          "path": "wheelhouse/cloudpickle-3.1.2-py3-none-any.whl",
          "bytes": 22228,
          "sha256": "9acb47f6afd73f60dc1df93bb801b472f05ff42fa6c84167d25cb206be1fbf4a"
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
          "path": "wheelhouse/deprecated-3.0.1-py3-none-any.whl",
          "bytes": 22191,
          "sha256": "eda314c115e8bc0fe52b90a6869e19240ac3cedb7449adfdba5981cf9ef693e1"
        },
        {
          "path": "wheelhouse/diffusers-0.38.0-py3-none-any.whl",
          "bytes": 5245919,
          "sha256": "18e53f9e539096320470f62c6360a6fd5727ff28cffda566265316e13fcdb612"
        },
        {
          "path": "wheelhouse/distlib-0.4.4-py2.py3-none-any.whl",
          "bytes": 472099,
          "sha256": "cf09d55b1e85a89576b036aeb71550bfd68320f3f21761ca329eadadad918638"
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
          "path": "wheelhouse/filelock-4.2.9-py3-none-any.whl",
          "bytes": 164734,
          "sha256": "a379c50a729e5b68c8519a4d26489f755d9769960a236ecd838190e2a78db2e9"
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
          "path": "wheelhouse/hf_xet-1.8.0-cp38-abi3-macosx_11_0_arm64.whl",
          "bytes": 3600947,
          "sha256": "3e8934784425781f0f779b91044df441f3a7af4dab47375d7e3aeaecbb8eecb4"
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
          "path": "wheelhouse/importlib_metadata-10.1.0-py3-none-any.whl",
          "bytes": 32221,
          "sha256": "cf45ce66a929c64e994185a809c04840d0501db17e663810d993d0f4829265c7"
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
          "path": "wheelhouse/llvmlite-0.50.0-cp312-cp312-macosx_12_0_arm64.whl",
          "bytes": 40534277,
          "sha256": "55f50a6b7c0b8de88b05d6bc407d70a60486ce024013997dc97e202bd187c75b"
        },
        {
          "path": "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "bytes": 91687,
          "sha256": "9f7ebbcd14fe59494226453aed97c1070d83f8d24b6fc3a3bcf9a38092641c4a"
        },
        {
          "path": "wheelhouse/markupsafe-3.0.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 12050,
          "sha256": "0930db9bdc62d22944e10b066448bb65dc9abe9112880c7cab8da54db4284d5f"
        },
        {
          "path": "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "bytes": 9979,
          "sha256": "84008a41e51615a49fc9966191ff91509e3c40b939176e643fd50a5c2196b8f8"
        },
        {
          "path": "wheelhouse/ml_dtypes-0.5.4-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 676927,
          "sha256": "a174837a64f5b16cab6f368171a1a03a27936b31699d167684073ff1c4237dac"
        },
        {
          "path": "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "bytes": 536198,
          "sha256": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c"
        },
        {
          "path": "wheelhouse/msgpack-1.2.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 90573,
          "sha256": "112933726919f4239646cca9572e2c2fa5626358c670da8440aac09403100a48"
        },
        {
          "path": "wheelhouse/narwhals-2.28.0-py3-none-any.whl",
          "bytes": 490591,
          "sha256": "1f69d6385ec30e2fa6e1fdeb37c562ecabd0f713f6f3e3b58a668c5c9df9567f"
        },
        {
          "path": "wheelhouse/networkx-3.7-py3-none-any.whl",
          "bytes": 2142205,
          "sha256": "e3fd2c13a7814cee3746340d8d7f8598a67f16a58bf47fb7f8793fab6efca1b0"
        },
        {
          "path": "wheelhouse/nodeenv-1.12.0-py3-none-any.whl",
          "bytes": 39442,
          "sha256": "80644d65c10cc2be12e3e4b54b3367ff288c7ad24ae75c2dcc65454fc7449d4d"
        },
        {
          "path": "wheelhouse/numba-0.68.1-cp312-cp312-macosx_12_0_arm64.whl",
          "bytes": 2762483,
          "sha256": "7de5e5d00e6c8967fc861be2a015eb8ad701ab3cf65d7f4a2c4d950990cf65d3"
        },
        {
          "path": "wheelhouse/numpy-1.26.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 13685868,
          "sha256": "03a8c78d01d9781b28a6989f6fa1bb2c4f2d51201cf99d3dd875df6fbd96b23b"
        },
        {
          "path": "wheelhouse/omegaconf-2.3.1-py3-none-any.whl",
          "bytes": 79502,
          "sha256": "3d701d14e9a8828f1edd28bb70b725908b34277cdd72cf7d6a83f94dadc6b6a0"
        },
        {
          "path": "wheelhouse/onnx-1.23.2-cp312-abi3-macosx_13_0_universal2.whl",
          "bytes": 9725612,
          "sha256": "1b8680ce1e6a9a4736374a9dce4de14ea8ee05e0dccf0784a78a6e5646bdc1f6"
        },
        {
          "path": "wheelhouse/packaging-26.3-py3-none-any.whl",
          "bytes": 129956,
          "sha256": "d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c"
        },
        {
          "path": "wheelhouse/pillow-13.0.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 4852329,
          "sha256": "fc481f742ccda20e9ed760b8f978dff50f2a4e9bc253ac167fb0a05b0783ef52"
        },
        {
          "path": "wheelhouse/platformdirs-4.14.5-py3-none-any.whl",
          "bytes": 35402,
          "sha256": "8e778c6fa421516f4d3369449f8df3b0e1b72c0e0005fe88e3ec772d0a14e750"
        },
        {
          "path": "wheelhouse/pooch-1.9.0-py3-none-any.whl",
          "bytes": 67175,
          "sha256": "f265597baa9f760d25ceb29d0beb8186c243d6607b0f60b83ecf14078dbc703b"
        },
        {
          "path": "wheelhouse/pre_commit-4.7.0-py2.py3-none-any.whl",
          "bytes": 226261,
          "sha256": "2e229038ad3656081b70c27913157e4b636ef306f643f024a8a8e3f0f7b2f877"
        },
        {
          "path": "wheelhouse/protobuf-7.36.2-cp310-abi3-macosx_10_9_universal2.whl",
          "bytes": 456039,
          "sha256": "cbc70b17ee27e28894c7fee8bb04be1abead49e936bc70eb60052531eee2079e"
        },
        {
          "path": "wheelhouse/pycparser-3.12-py3-none-any.whl",
          "bytes": 62600,
          "sha256": "a076f3f489b39b43ed13563a1dafe42447445bec2e294154ec5c57fcdda4c85e"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1922874,
          "sha256": "a39ac25a9a2fa4072efdb429833c4a4c8009a51ff9eea3eeae131713cd27991e"
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
          "path": "wheelhouse/python_discovery-1.9.5-py3-none-any.whl",
          "bytes": 44377,
          "sha256": "a1fae8fca11e4bc61e38491c2aafff29e430b3c5e272d51ae52fb895bc4c0fac"
        },
        {
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 173973,
          "sha256": "fc09d0aa354569bc501d4e787133afc08552722d3ab34836a80547331bb5d4a0"
        },
        {
          "path": "wheelhouse/regex-2026.11.9-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 294199,
          "sha256": "2255e173ffb8da59f26ec3529bf7e8531320e71575b27c3fb062747eb3a12e1f"
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
          "path": "wheelhouse/safetensors-0.8.0-cp310-abi3-macosx_11_0_arm64.whl",
          "bytes": 484562,
          "sha256": "c80201d22cbf405b80647a60ada77bba06c8fba2da2743ba1e89cdcc39a81f25"
        },
        {
          "path": "wheelhouse/scikit_learn-1.9.1-cp312-cp312-macosx_12_0_arm64.whl",
          "bytes": 8295541,
          "sha256": "8c14ce41d561f7749f990b41d6703fe02c4669fbc485e598e069e0a1967b488e"
        },
        {
          "path": "wheelhouse/scipy-1.17.1-cp312-cp312-macosx_14_0_arm64.whl",
          "bytes": 20344366,
          "sha256": "cc90d2e9c7e5c7f1a482c9875007c095c3194b1cfedca3c2f3291cdc2bc7c086"
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
          "path": "wheelhouse/soundfile-0.14.0-py2.py3-none-macosx_11_0_arm64.whl",
          "bytes": 1103726,
          "sha256": "d828d35a059626da52f1415b5faee610aeab393319cb3fc4a9aef47b619fc14c"
        },
        {
          "path": "wheelhouse/soxr-1.1.0-cp312-abi3-macosx_11_0_arm64.whl",
          "bytes": 165457,
          "sha256": "d6a7ad82b8d5f3fcc04b1d2ca055562b96af571e1d4fa7c6c61d0fb509ac43b4"
        },
        {
          "path": "wheelhouse/spacy_pkuseg-1.0.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 2424096,
          "sha256": "bacafcf24c6c1a93c6ca73e984f5febee2640b9e0fc7785b9a3316581afdcb50"
        },
        {
          "path": "wheelhouse/srsly-2.5.6-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 690411,
          "sha256": "f83c773e94bed633463b966b720c1f998c23959d41f34f95059ea81f9aff3b1d"
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
          "path": "wheelhouse/threadpoolctl-3.8.0-py3-none-any.whl",
          "bytes": 32091,
          "sha256": "f1b49c82704d50f13ffae019c727b0fa4f6791a58f48f06a09c45face1be66da"
        },
        {
          "path": "wheelhouse/tokenizers-0.23.3-cp310-abi3-macosx_11_0_arm64.whl",
          "bytes": 3101381,
          "sha256": "68649e97d5b43c44c031d8d848874a6eecae8f8fe40ea989aa777a5a83aca716"
        },
        {
          "path": "wheelhouse/torch-2.6.0-cp312-none-macosx_11_0_arm64.whl",
          "bytes": 66532538,
          "sha256": "9a610afe216a85a8b9bc9f8365ed561535c93e804c2a317ef7fabcc5deda0989"
        },
        {
          "path": "wheelhouse/torchaudio-2.6.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1812899,
          "sha256": "7d0e4b08c42325bf4b887de9a25c44ed882997001740e1bd7d901f65581cf1ab"
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
          "path": "wheelhouse/typer-0.28.0-py3-none-any.whl",
          "bytes": 123253,
          "sha256": "afd18929180b706c5e9a239f53c3c8136903553c0c2d460598bbaa924191d4ab"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.5-py3-none-any.whl",
          "bytes": 14874,
          "sha256": "bc210535442b39e1bf2805e0c7a17dfd6a4ace760c84c7f7d16245d23a6b1c39"
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
          "path": "wheelhouse/virtualenv-21.15.6-py3-none-any.whl",
          "bytes": 5680963,
          "sha256": "4b99ab9b95ff11043939bb4cad2fa0449175fa5a478372864f62160cb6c1a7ed"
        },
        {
          "path": "wheelhouse/wrapt-2.5.2-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 106264,
          "sha256": "e57d79e3338b3cecee1dd80d6ef8f945f8ea7b92f0d8d5591f840ffa0afc14dc"
        },
        {
          "path": "wheelhouse/zipp-4.1.2-py3-none-any.whl",
          "bytes": 10581,
          "sha256": "b30cb6cd253122169c47de245ca24a86bac2a5d3802ba15bf7ba6414eb9e144d"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/bin/python3.12",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "5be58171ce22d603d97d415d8d4864c0dea0c2ac0ae4eae427098bc184bf63a2",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "MIT",
        "url": "https://opensource.org/license/mit/"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/chatterbox-1.0.0-py312-mps1-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "486be27328f0d504716c5bb97ee12b1168823e7a853c3cb1f319e8173ace6888"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "0Ii0NVNyuXyo10zX4I4S6Qv0OFDUKJY6YnuUm3lLBJYQtirlJzhttK/Fn5iDGMogs18f8/Db+fy7hIwRVYQYDQ=="
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
      "version": "1.0.0-anonymous-27468de-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/douyin-archive-1.0.0-anonymous-27468de-darwin-arm64.1-darwin-arm64.tar.gz",
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
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/douyin-archive-1.0.0-anonymous-27468de-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "a6ac51507135561fad2f318df46a1a9d3e61ef24ddb09c62f98047592d480ae6"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "32Wc7LMJXNhCre4UFjuTz8PKhqE+i72YQlolXn4LTSzuSr3nD1LlIGEC68qKLE9o+1XUXdPMPaELWuVMRw2BBg=="
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
      "version": "7.3.1-py312-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/edge-tts-7.3.1-py312-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 1276624,
        "sha256": "7edb673cc581da30cf2755d8a142626c6797b8e0fba55bad4fd3a8bb5db1ec2b",
        "format": "tar.gz"
      },
      "installedBytes": 180000000,
      "files": [
        {
          "path": "requirements.lock",
          "bytes": 63115,
          "sha256": "c61acb4e6ee4f9adfe7730b874ba0100d6c09623cdeffdac45364741649bff41"
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
          "path": "wheelhouse/aiohttp-3.14.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 548067,
          "sha256": "d079c0a0135c36e7beb6f1c88087c8f108dc5891cdd0b5eafa778421bda70ed2"
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
          "path": "wheelhouse/certifi-2026.10.23-py3-none-any.whl",
          "bytes": 135082,
          "sha256": "e9b54de76e530bb6cf0ccd036787103acb58fd42ba930ea8bf948ddbaa2f61d1"
        },
        {
          "path": "wheelhouse/edge_tts-7.3.1-py3-none-any.whl",
          "bytes": 38908,
          "sha256": "2a3c79d6235a7a736d681233823ce5492e829b43eb47beae49aa181237a8f9a4"
        },
        {
          "path": "wheelhouse/frozenlist-1.8.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 50448,
          "sha256": "f833670942247a14eafbb675458b4e61c82e002a148f49e68257b79296e865c4"
        },
        {
          "path": "wheelhouse/idna-3.20-py3-none-any.whl",
          "bytes": 69583,
          "sha256": "ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c"
        },
        {
          "path": "wheelhouse/multidict-7.2.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 103911,
          "sha256": "d37773029ba034a2cc970b6eeb67dad3bff9d894393c51f6bb1c6b4f563a032c"
        },
        {
          "path": "wheelhouse/propcache-0.5.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 52460,
          "sha256": "87a3caecf8095e48dc72f84bfa42e23a848cf410cc9cc13031fba4869b706a21"
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
          "path": "wheelhouse/yarl-1.25.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 104325,
          "sha256": "e029648f9c951db30e98a7d7ec90835db88ec4b32820efe2a9bdc2287e032eb6"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/bin/python3.12",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "c61acb4e6ee4f9adfe7730b874ba0100d6c09623cdeffdac45364741649bff41",
        "expectedPythonVersion": "3.12"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/edge-tts-7.3.1-py312-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "42bac5fedc5a6f9d50b7533d69b306dcc1d267c6fbbe3a0e75c28bd9d75e3295"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "Z9z4vJqp+GiJEd1AyxZbYySW7YlakLj0cgbSqskcHpBKkeTvEmEyxQN3pR8xs9j++U1OQ9D80BWCelvtb2jjAA=="
    },
    {
      "protocolVersion": 1,
      "id": "ffmpeg",
      "moduleId": "ffmpeg",
      "groupId": "shared",
      "displayName": "FFmpeg（共享媒体运行时）",
      "purpose": "为视频解析和参考音色能力提供平台对应的 FFmpeg、FFprobe 及必需运行时库。",
      "dependencyIds": [],
      "taskToolIds": [],
      "installConditions": [
        "安装使用媒体处理的能力时需要；安装后可由多个能力共享。"
      ],
      "version": "8.1.2-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/ffmpeg-8.1.2-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 23427122,
        "sha256": "4ccfdbb8752fb2ed278b5572fc98dbb1e93cd4598e189a26cd44bfadbeb6a534",
        "format": "tar.gz"
      },
      "installedBytes": 300000000,
      "files": [
        {
          "path": "bin/ffmpeg",
          "bytes": 23680872,
          "sha256": "f47a8ffd2d3110d1b3c0a4cfa1bf72973f0d7ce8432a2af56bc61e8c9407aa72",
          "executable": true
        },
        {
          "path": "bin/ffprobe",
          "bytes": 23505768,
          "sha256": "89f24747ebef1def4820fefbe68cd3fdf289d9f3f5ea08644e2076dca6427867",
          "executable": true
        },
        {
          "path": "CAPABILITIES.json",
          "bytes": 31030,
          "sha256": "878fc65fdaa50c951e27dcfe26cd6385ce2f2e1018ea35f637f02d8e34f9c7ec"
        },
        {
          "path": "licenses/COPYING.FFmpeg.GPLv2",
          "bytes": 18092,
          "sha256": "8177f97513213526df2cf6184d8ff986c675afb514d4e68a404010521b880643"
        },
        {
          "path": "licenses/COPYING.FFmpeg.LGPLv2.1",
          "bytes": 26517,
          "sha256": "246041b6ecf9bc32d718a62c57877c78b5eb397b6467e74ed7ae2626ab189c30"
        },
        {
          "path": "licenses/COPYING.LAME.LGPLv2",
          "bytes": 25281,
          "sha256": "e64f9c5a18f56828c10a575df13ade641aa3af4512a7afe6c411256943b57aaf"
        },
        {
          "path": "licenses/COPYING.libogg.txt",
          "bytes": 1466,
          "sha256": "d2ab5758336489da61c12cc5bb757da5339c4ae9001f9bb0562b4370249af814"
        },
        {
          "path": "licenses/COPYING.libopus.txt",
          "bytes": 1945,
          "sha256": "01e1167d54a096d123cf6dfbbeb19587278845c6481d2d66d545669846079551"
        },
        {
          "path": "licenses/COPYING.libvorbis.txt",
          "bytes": 1470,
          "sha256": "ec1815db59fcd302846df949d7424876cb2e2dc5ed1606c5fb0b36787b1cf43a"
        },
        {
          "path": "licenses/COPYING.x264.GPLv2",
          "bytes": 17992,
          "sha256": "32b1062f7da84967e7019d01ab805935caa7ab7321a7ced0e30ebe75e5df1670"
        },
        {
          "path": "licenses/LICENSE.FFmpeg.txt",
          "bytes": 4346,
          "sha256": "2e1d16c72fd74e12063776371da757322f8b77589386532f4fd8634bde7de1af"
        },
        {
          "path": "licenses/NOTICE.LAME.txt",
          "bytes": 503,
          "sha256": "5c1f8d44f1eacbea3e1c31ff6ee11a4e1690ccbed4ee4af16de3b6eb61dc69a8"
        },
        {
          "path": "PROVENANCE.json",
          "bytes": 6785,
          "sha256": "28b84ba45ffb8e0523cd334b04a5bfa34692a02fbc1b476ed799dd9e3bffc71c"
        },
        {
          "path": "SMOKE-RESULTS.json",
          "bytes": 358,
          "sha256": "025e115ae603b068b98f04fb46edcb22f09704171ad52fef7641828c51e57169"
        },
        {
          "path": "SOURCE_LOCK.json",
          "bytes": 2296,
          "sha256": "979820184858901ea4e099f127cc53b96bb3b3043a2573281104e2ebd8b23820"
        }
      ],
      "license": {
        "name": "GPL-3.0",
        "url": "https://www.gnu.org/licenses/gpl-3.0.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/ffmpeg-8.1.2-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "7fab9ee3f07172a9419e338c28b39044de35ee820d23bfab370b19de197cb6a6"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "BM+X0yzgQ/dQReuYjmo6wkLSaQyMfT9HfPVqkHSavz+De3otMefQ1gj9/mKWa2w1HXPfqqtkzg8BQ9kqnBwFBQ=="
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
        "该 Mac 版本使用 CPU；安装空间按签名 Mac 能力包的压缩归档和保守解压预留量计算。",
        "水印智能提示使用固定版本 PP-OCRv5 中文检测与识别模型；所有模型均随能力包离线安装，处理过程中不下载文件。"
      ],
      "version": "1.0.0-py312-cpu1-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/image-ai-1.0.0-py312-cpu1-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 1671558662,
        "sha256": "b67e9c83b109a33e05436d1e8d68e1f193dcaa3f7a870e00483b24c79ab755ec",
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
          "bytes": 303080,
          "sha256": "dbe1a7b1695276a85a430b5237241d363104e87954c2f24307f68a1dee96f827"
        },
        {
          "path": "scripts/image-ai-worker.py",
          "bytes": 37519,
          "sha256": "b3eefdb32ea6192d34fd0e06872327db998629d47a17ee336dceef0b6983e603"
        },
        {
          "path": "wheelhouse/absl_py-2.5.1-py3-none-any.whl",
          "bytes": 137673,
          "sha256": "721200f2f0e9960f2ca9dc3a2a706b201f5f75d812c158f059cbbe29eeafbdb8"
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
          "path": "wheelhouse/aiohttp-3.14.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 548067,
          "sha256": "d079c0a0135c36e7beb6f1c88087c8f108dc5891cdd0b5eafa778421bda70ed2"
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
          "path": "wheelhouse/anyio-4.16.0-py3-none-any.whl",
          "bytes": 134521,
          "sha256": "c66ae634e0b8228396b801741beb3294326d4b6102f7bba4041c0dfb58c29026"
        },
        {
          "path": "wheelhouse/astor-0.8.1-py2.py3-none-any.whl",
          "bytes": 27488,
          "sha256": "070a54e890cefb5b3739d19f30f5a5ec840ffc9c50ffa7d23cc9fc1a38ebbfc5"
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
          "path": "wheelhouse/certifi-2026.10.23-py3-none-any.whl",
          "bytes": 135082,
          "sha256": "e9b54de76e530bb6cf0ccd036787103acb58fd42ba930ea8bf948ddbaa2f61d1"
        },
        {
          "path": "wheelhouse/cffi-2.1.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 184719,
          "sha256": "f81b3b8f3d4e343550fa4baa0e479bba9f2d29ce9c2e9b51d1ce1718d7442fcf"
        },
        {
          "path": "wheelhouse/chardet-7.7.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1185195,
          "sha256": "7df40e5267a4e9952ecb39cc23109c389fca61fc27a6e807ec9ea894a41e83d7"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.5.2-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 367780,
          "sha256": "ed2a239c0ea213acc1908150a3037257083c7c083128f1a4cec2ec4b97dca491"
        },
        {
          "path": "wheelhouse/click-8.5.1-py3-none-any.whl",
          "bytes": 126163,
          "sha256": "8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37"
        },
        {
          "path": "wheelhouse/coloredlogs-15.0.1-py2.py3-none-any.whl",
          "bytes": 46018,
          "sha256": "612ee75c546f53e92e70049c9dbfcc18c935a2b9a53b66085ce9ef6a6e5c0934"
        },
        {
          "path": "wheelhouse/colorlog-6.12.0-py3-none-any.whl",
          "bytes": 12239,
          "sha256": "30d392604e9110045a2c2aeefc27d7a017abbab63f3a8aee594eac0801df784e"
        },
        {
          "path": "wheelhouse/contourpy-1.4.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 284921,
          "sha256": "c76f3a5318164db7d9401132fc1b5364b784c613c93fa506e3b5e6d1bf353ec8"
        },
        {
          "path": "wheelhouse/crc32c-2.9.post0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 61714,
          "sha256": "b789d6b69c94fed1e119d81905955b9f218434b39e0c197d599a7256e8af7435"
        },
        {
          "path": "wheelhouse/cryptography-50.0.2-cp311-abi3-macosx_11_0_arm64.whl",
          "bytes": 3914904,
          "sha256": "fa8f5efb344d6908a1ce62f4a24e2e5780f825d6f53f5f50ec5ffacac72936cb"
        },
        {
          "path": "wheelhouse/cycler-0.12.1-py3-none-any.whl",
          "bytes": 8321,
          "sha256": "85cef7cff222d8644161529808465972e51340599459b8ac3ccbac5a854e0d30"
        },
        {
          "path": "wheelhouse/cython-3.1.3-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 2844261,
          "sha256": "93dd0f62a3f8e93166d8584f8b243180d681ba8fed1f530b55d5f70c348c5797"
        },
        {
          "path": "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "bytes": 10365,
          "sha256": "f47fe6fdbd2edd623ecfe36875d37aba411624e2670dd395dddae1358689bb3c"
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
          "path": "wheelhouse/filelock-4.2.9-py3-none-any.whl",
          "bytes": 164734,
          "sha256": "a379c50a729e5b68c8519a4d26489f755d9769960a236ecd838190e2a78db2e9"
        },
        {
          "path": "wheelhouse/filterpy-2.0.0-py3-none-any.whl",
          "bytes": 111361,
          "sha256": "c5028eaf31a7181d2d5565a5447e9b1cda746c99b317f62d89018fc791ef1f7e"
        },
        {
          "path": "wheelhouse/flatbuffers-25.12.19-py2.py3-none-any.whl",
          "bytes": 26661,
          "sha256": "7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4"
        },
        {
          "path": "wheelhouse/fonttools-4.68.0-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 3143556,
          "sha256": "f265c85432c398d86f26add143423924a4747879b2dce001a3ffe0a5fed30638"
        },
        {
          "path": "wheelhouse/frozenlist-1.8.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 50448,
          "sha256": "f833670942247a14eafbb675458b4e61c82e002a148f49e68257b79296e865c4"
        },
        {
          "path": "wheelhouse/fsspec-2026.9.0-py3-none-any.whl",
          "bytes": 221738,
          "sha256": "8dd6e646e99ea382bd85f97a45e6b526a442d79423a7dc673f1e2756d05fcb5f"
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
          "path": "wheelhouse/grpcio-1.85.1-cp312-cp312-macosx_11_0_universal2.whl",
          "bytes": 12633025,
          "sha256": "658a9d89c5736bf4aa3ef4ecbc79528e26d8e23c5e1c83417d2870a1a06063e5"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/hf_xet-1.8.0-cp38-abi3-macosx_11_0_arm64.whl",
          "bytes": 3600947,
          "sha256": "3e8934784425781f0f779b91044df441f3a7af4dab47375d7e3aeaecbb8eecb4"
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
          "path": "wheelhouse/huggingface_hub-1.33.0-py3-none-any.whl",
          "bytes": 846435,
          "sha256": "04e434b06e100eddbce9a6e817d72693a7884b10a79bd67ab48080d5c07eb899"
        },
        {
          "path": "wheelhouse/humanfriendly-10.0-py2.py3-none-any.whl",
          "bytes": 86794,
          "sha256": "1697e1a8a8f550fd43c2865cd84542fc175a61dcb779b6fee18cf6b6ccba1477"
        },
        {
          "path": "wheelhouse/idna-3.20-py3-none-any.whl",
          "bytes": 69583,
          "sha256": "ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c"
        },
        {
          "path": "wheelhouse/imageio-2.38.1-py3-none-any.whl",
          "bytes": 328389,
          "sha256": "36d23eb7423d2fb63f637098758edb3d2df3687f7125e0a5ce8596572022dcf9"
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
          "path": "wheelhouse/kiwisolver-1.5.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 64660,
          "sha256": "1798e83840c3f627246104c4d8a9639c60fa068adf9ce92b61791781fa8a68c1"
        },
        {
          "path": "wheelhouse/lazy_loader-0.6-py3-none-any.whl",
          "bytes": 8791,
          "sha256": "77253be3391b06124a0e16105bd663b6c54470af1a9ca8e1cf026f38d58ed056"
        },
        {
          "path": "wheelhouse/llvmlite-0.50.0-cp312-cp312-macosx_12_0_arm64.whl",
          "bytes": 40534277,
          "sha256": "55f50a6b7c0b8de88b05d6bc407d70a60486ce024013997dc97e202bd187c75b"
        },
        {
          "path": "wheelhouse/lmdb-3.0.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 196902,
          "sha256": "bba67fbf79532bc6ad19bf98a2fc179b3c712e148820c1ced42d928a7a73228b"
        },
        {
          "path": "wheelhouse/markdown_it_py-4.2.0-py3-none-any.whl",
          "bytes": 91687,
          "sha256": "9f7ebbcd14fe59494226453aed97c1070d83f8d24b6fc3a3bcf9a38092641c4a"
        },
        {
          "path": "wheelhouse/markdown-3.11.3-py3-none-any.whl",
          "bytes": 116758,
          "sha256": "e1a31a112232504d753e5c01bb8c2de90d3f0ba986b063e10770cf7695b09e73"
        },
        {
          "path": "wheelhouse/markupsafe-3.0.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 12050,
          "sha256": "0930db9bdc62d22944e10b066448bb65dc9abe9112880c7cab8da54db4284d5f"
        },
        {
          "path": "wheelhouse/matplotlib-3.11.2-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 9305583,
          "sha256": "ef31985c4dedb5f1424e1aec6849a47dd37689cb7fa3c20b1b82187f26806261"
        },
        {
          "path": "wheelhouse/mdurl-0.1.2-py3-none-any.whl",
          "bytes": 9979,
          "sha256": "84008a41e51615a49fc9966191ff91509e3c40b939176e643fd50a5c2196b8f8"
        },
        {
          "path": "wheelhouse/modelscope_hub-0.7.0-py3-none-any.whl",
          "bytes": 304179,
          "sha256": "c71dc5cbe24421008171e1d4fc0da49fec7dd81c41ba8b05a70e86064abe3f0e"
        },
        {
          "path": "wheelhouse/modelscope-1.40.3-py3-none-any.whl",
          "bytes": 6062711,
          "sha256": "a2d9e239e58de7c1162da4a54472defb98f4c076900dd7ebfed3370c694e2cb8"
        },
        {
          "path": "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "bytes": 536198,
          "sha256": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c"
        },
        {
          "path": "wheelhouse/multidict-7.2.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 103911,
          "sha256": "d37773029ba034a2cc970b6eeb67dad3bff9d894393c51f6bb1c6b4f563a032c"
        },
        {
          "path": "wheelhouse/networkx-3.7-py3-none-any.whl",
          "bytes": 2142205,
          "sha256": "e3fd2c13a7814cee3746340d8d7f8598a67f16a58bf47fb7f8793fab6efca1b0"
        },
        {
          "path": "wheelhouse/numba-0.68.1-cp312-cp312-macosx_12_0_arm64.whl",
          "bytes": 2762483,
          "sha256": "7de5e5d00e6c8967fc861be2a015eb8ad701ab3cf65d7f4a2c4d950990cf65d3"
        },
        {
          "path": "wheelhouse/numpy-2.3.5-cp312-cp312-macosx_14_0_arm64.whl",
          "bytes": 5088378,
          "sha256": "612a95a17655e213502f60cfb9bf9408efdc9eb1d5f50535cc6eb365d11b42b5"
        },
        {
          "path": "wheelhouse/onnxruntime-1.23.2-cp312-cp312-macosx_13_0_arm64.whl",
          "bytes": 17195929,
          "sha256": "b8f029a6b98d3cf5be564d52802bb50a8489ab73409fa9db0bf583eabb7c2321"
        },
        {
          "path": "wheelhouse/opencv_contrib_python-4.10.0.84-cp37-abi3-macosx_11_0_arm64.whl",
          "bytes": 63667391,
          "sha256": "ee4b0919026d8c533aeb69b16c6ec4a891a2f6844efaa14121bf68838753209c"
        },
        {
          "path": "wheelhouse/opencv_python_headless-4.11.0.86-cp37-abi3-macosx_13_0_arm64.whl",
          "bytes": 37326460,
          "sha256": "48128188ade4a7e517237c8e1e11a9cdf5c282761473383e77beb875bb1e61ca"
        },
        {
          "path": "wheelhouse/opencv_python-5.0.0.93-cp37-abi3-macosx_13_0_arm64.whl",
          "bytes": 48322443,
          "sha256": "198a75138241810206a17c829dbcc40a7cb1841cda538ca86cbbfc6c7d95f898"
        },
        {
          "path": "wheelhouse/opt_einsum-3.3.0-py3-none-any.whl",
          "bytes": 65486,
          "sha256": "2455e59e3947d3c275477df7f5205b30635e266fe6dc300e3d9f9646bfcea147"
        },
        {
          "path": "wheelhouse/packaging-26.3-py3-none-any.whl",
          "bytes": 129956,
          "sha256": "d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c"
        },
        {
          "path": "wheelhouse/paddleocr-3.7.0-py3-none-any.whl",
          "bytes": 146750,
          "sha256": "c0f0a81ad4112727f30c6fcf986ac0ef6a120d31ee0991a01fae0357ee32d338"
        },
        {
          "path": "wheelhouse/paddlepaddle-3.0.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 96946375,
          "sha256": "8677e8d42ff66f74fbca32ff32d8b64bbe3d56ed29a92d43dc418f0f168fcb69"
        },
        {
          "path": "wheelhouse/paddlex-3.7.2-py3-none-any.whl",
          "bytes": 2239708,
          "sha256": "f1678bf650bbaccfd8f0d4e49d0ae631b4685c829fdae6e802ccd90d4fcb9a7f"
        },
        {
          "path": "wheelhouse/pandas-2.2.3-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 11363475,
          "sha256": "a5a1595fe639f5988ba6a8e5bc9649af3baf26df3998a0abe56c02609392e0a4"
        },
        {
          "path": "wheelhouse/pillow-12.3.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 4780323,
          "sha256": "ffd0c5368496f41b0944be820fcb7a838aa6e623d250b01acf2643939c3f99d7"
        },
        {
          "path": "wheelhouse/platformdirs-4.14.5-py3-none-any.whl",
          "bytes": 35402,
          "sha256": "8e778c6fa421516f4d3369449f8df3b0e1b72c0e0005fe88e3ec772d0a14e750"
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
          "path": "wheelhouse/propcache-0.5.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 52460,
          "sha256": "87a3caecf8095e48dc72f84bfa42e23a848cf410cc9cc13031fba4869b706a21"
        },
        {
          "path": "wheelhouse/protobuf-7.36.2-cp310-abi3-macosx_10_9_universal2.whl",
          "bytes": 456039,
          "sha256": "cbc70b17ee27e28894c7fee8bb04be1abead49e936bc70eb60052531eee2079e"
        },
        {
          "path": "wheelhouse/psutil-7.2.2-cp36-abi3-macosx_11_0_arm64.whl",
          "bytes": 129859,
          "sha256": "1a7b04c10f32cc88ab39cbf606e117fd74721c831c98a27dc04578deb0c16979"
        },
        {
          "path": "wheelhouse/py_cpuinfo-9.0.0-py3-none-any.whl",
          "bytes": 22335,
          "sha256": "859625bc251f64e21f077d099d4162689c762b5d6a4c3c97553d56241c9674d5"
        },
        {
          "path": "wheelhouse/pyclipper-1.4.0-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 265676,
          "sha256": "222ac96c8b8281b53d695b9c4fedc674f56d6d4320ad23f1bdbd168f4e316140"
        },
        {
          "path": "wheelhouse/pycparser-3.12-py3-none-any.whl",
          "bytes": 62600,
          "sha256": "a076f3f489b39b43ed13563a1dafe42447445bec2e294154ec5c57fcdda4c85e"
        },
        {
          "path": "wheelhouse/pycryptodome-4.4.0-cp39-abi3-macosx_10_9_universal2.whl",
          "bytes": 1790964,
          "sha256": "99494a2ab8137a9a6967db30e21f54f6dfa70327d8e72863638dece6d6a16374"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1922874,
          "sha256": "a39ac25a9a2fa4072efdb429833c4a4c8009a51ff9eea3eeae131713cd27991e"
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
          "path": "wheelhouse/pyparsing-3.3.3-py3-none-any.whl",
          "bytes": 126420,
          "sha256": "ece8c00a69cf01b45d0b1dedabb469c90d8caf996d4fda40f147627a122849a4"
        },
        {
          "path": "wheelhouse/pypdfium2-5.15.1-py3-none-macosx_13_0_arm64.whl",
          "bytes": 3710594,
          "sha256": "8cb84f21ed36428ecf483e136ccbe71fc258ee730eae87d69baa3e178e56c8d6"
        },
        {
          "path": "wheelhouse/python_bidi-0.6.12-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 264197,
          "sha256": "ad46555d7d089c51e6b700d615d7eb3ee3dfa9eb792c3620fc94124edce4d8c7"
        },
        {
          "path": "wheelhouse/python_dateutil-4.0.0-py3-none-any.whl",
          "bytes": 92853,
          "sha256": "a5e246f79eb80475e691bf93862cead98decd8a498cf53ba0516fcdc0f50dc1c"
        },
        {
          "path": "wheelhouse/pytz-2026.6-py2.py3-none-any.whl",
          "bytes": 506321,
          "sha256": "7fed3fee8fd6bd4a2b7b75a8d56021d0624127bf69bd5691f115db929ac570b3"
        },
        {
          "path": "wheelhouse/PyYAML-6.0.2-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 173302,
          "sha256": "ce826d6ef20b1bc864f0a68340c8b3287705cae2f8b4b1d932177dcc76721725"
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
          "path": "wheelhouse/regex-2026.11.9-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 294199,
          "sha256": "2255e173ffb8da59f26ec3529bf7e8531320e71575b27c3fb062747eb3a12e1f"
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
          "path": "wheelhouse/rpds_py-2026.9.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 341380,
          "sha256": "e21c1429e205828ea886a2293a4a2c8e01f4c25d9893ca330e97a6cf73f52e7b"
        },
        {
          "path": "wheelhouse/ruamel_yaml-0.19.1-py3-none-any.whl",
          "bytes": 118102,
          "sha256": "27592957fedf6e0b62f281e96effd28043345e0e66001f97683aa9a40c667c93"
        },
        {
          "path": "wheelhouse/safetensors-0.8.0-cp310-abi3-macosx_11_0_arm64.whl",
          "bytes": 484562,
          "sha256": "c80201d22cbf405b80647a60ada77bba06c8fba2da2743ba1e89cdcc39a81f25"
        },
        {
          "path": "wheelhouse/scikit_image-0.26.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 12061567,
          "sha256": "3409e89d66eff5734cd2b672d1c48d2759360057e714e1d92a11df82c87cba37"
        },
        {
          "path": "wheelhouse/scipy-1.18.1-cp312-cp312-macosx_14_0_arm64.whl",
          "bytes": 20475078,
          "sha256": "7bbf207c4453ce1ad2e00b17313852b33310b83090c2311bdaf97f93c0380d12"
        },
        {
          "path": "wheelhouse/setuptools-80.9.0-py3-none-any.whl",
          "bytes": 1201486,
          "sha256": "062d34222ad13e0cc312a4c02d73f059e86a4acbfbdea8f8f76b28c99f306922"
        },
        {
          "path": "wheelhouse/shapely-2.2.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1584868,
          "sha256": "c36ccbff5c3374c349c370bfdac22c7676b268b4a707c98e9031f498965aa02d"
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
          "path": "wheelhouse/tifffile-2026.11.8-py3-none-any.whl",
          "bytes": 278909,
          "sha256": "bb41732b357a7fa3077db439961ea1ec3a88d2fda4b45fd3ea9f7786690f6049"
        },
        {
          "path": "wheelhouse/tokenizers-0.23.3-cp310-abi3-macosx_11_0_arm64.whl",
          "bytes": 3101381,
          "sha256": "68649e97d5b43c44c031d8d848874a6eecae8f8fe40ea989aa777a5a83aca716"
        },
        {
          "path": "wheelhouse/torch-2.6.0-cp312-none-macosx_11_0_arm64.whl",
          "bytes": 66532538,
          "sha256": "9a610afe216a85a8b9bc9f8365ed561535c93e804c2a317ef7fabcc5deda0989"
        },
        {
          "path": "wheelhouse/torchvision-0.21.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1784140,
          "sha256": "97a5814a93c793aaf0179cfc7f916024f4b63218929aee977b645633d074a49f"
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
          "path": "wheelhouse/typer-0.28.0-py3-none-any.whl",
          "bytes": 123253,
          "sha256": "afd18929180b706c5e9a239f53c3c8136903553c0c2d460598bbaa924191d4ab"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.5-py3-none-any.whl",
          "bytes": 14874,
          "sha256": "bc210535442b39e1bf2805e0c7a17dfd6a4ace760c84c7f7d16245d23a6b1c39"
        },
        {
          "path": "wheelhouse/tzdata-2026.6-py2.py3-none-any.whl",
          "bytes": 348210,
          "sha256": "0a10eec6e13ef16b627fabed9a5f2ba61a62b1c67f327305f4e7e412a70b4aec"
        },
        {
          "path": "wheelhouse/ujson-6.1.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 54244,
          "sha256": "dd11ae29a61d0e2844937047eb14a970a790e76d306affc70d661446af4707f9"
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
          "path": "wheelhouse/wcwidth-0.9.4-cp310-abi3-macosx_11_0_arm64.whl",
          "bytes": 618904,
          "sha256": "f279f32c8e206a9092fa350e53ca0c2bd8072e45b1c9fd31bb6d476b59b591c4"
        },
        {
          "path": "wheelhouse/werkzeug-3.1.9-py3-none-any.whl",
          "bytes": 228700,
          "sha256": "6392e50c78460ba618e5b21f08a71f59c99ce99cdc6cf6e3dd7e6ccca8754fab"
        },
        {
          "path": "wheelhouse/yapf-0.43.0-py3-none-any.whl",
          "bytes": 256158,
          "sha256": "224faffbc39c428cb095818cf6ef5511fdab6f7430a10783fdfb292ccf2852ca"
        },
        {
          "path": "wheelhouse/yarl-1.25.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 104325,
          "sha256": "e029648f9c951db30e98a7d7ec90835db88ec4b32820efe2a9bdc2287e032eb6"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/bin/python3.12",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "dbe1a7b1695276a85a430b5237241d363104e87954c2f24307f68a1dee96f827",
        "expectedPythonVersion": "3.12"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/image-ai-1.0.0-py312-cpu1-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "1a3fe5cd3375c87e25a813cdd204f20a67e0c6a219326d1b17161b4308bfe6dc"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "r36YYMj9iZNpblXOIfjlqfhxg6OJ2IoiGcNns16wRfUoatVIxgWSnr8oaU4bDYUSl96m9MpMP5MmozaCvCTJBw=="
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
      "version": "3.12.14-20260924-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/python-312-3.12.14-20260924-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 43181934,
        "sha256": "0150b2f0f52f6978dab54d64aea9e7d308f30505b497a6f8eb03498f30a520d1",
        "format": "tar.gz"
      },
      "installedBytes": 300000000,
      "files": [
        {
          "path": "python/bin/2to3",
          "bytes": 158,
          "sha256": "f48f1c0840af7b30dac604fc0cd720b882a233b9eb571677a4df108a9eeaf32c",
          "executable": true
        },
        {
          "path": "python/bin/2to3-3.12",
          "bytes": 158,
          "sha256": "f48f1c0840af7b30dac604fc0cd720b882a233b9eb571677a4df108a9eeaf32c",
          "executable": true
        },
        {
          "path": "python/bin/idle3",
          "bytes": 156,
          "sha256": "4ee1fe32bc385f4a8c0126daef3d45fe83febf4d91b20669305392e01bcc343d",
          "executable": true
        },
        {
          "path": "python/bin/idle3.12",
          "bytes": 156,
          "sha256": "4ee1fe32bc385f4a8c0126daef3d45fe83febf4d91b20669305392e01bcc343d",
          "executable": true
        },
        {
          "path": "python/bin/pip",
          "bytes": 234,
          "sha256": "2512b888ea03cb94e56eaf7db265a58cb13ac0fa21b2c6ed4a44ea95fda5bed3",
          "executable": true
        },
        {
          "path": "python/bin/pip3",
          "bytes": 234,
          "sha256": "2512b888ea03cb94e56eaf7db265a58cb13ac0fa21b2c6ed4a44ea95fda5bed3",
          "executable": true
        },
        {
          "path": "python/bin/pip3.12",
          "bytes": 234,
          "sha256": "2512b888ea03cb94e56eaf7db265a58cb13ac0fa21b2c6ed4a44ea95fda5bed3",
          "executable": true
        },
        {
          "path": "python/bin/pydoc3",
          "bytes": 141,
          "sha256": "b09b14b62a6976902b026cb58d8fb6c1fad5fc824913e01035a8802ec3e594be",
          "executable": true
        },
        {
          "path": "python/bin/pydoc3.12",
          "bytes": 141,
          "sha256": "b09b14b62a6976902b026cb58d8fb6c1fad5fc824913e01035a8802ec3e594be",
          "executable": true
        },
        {
          "path": "python/bin/python",
          "bytes": 18066512,
          "sha256": "042454a41d6c32f2be126c4bbae2a4b8a54488c66f4b07379cd24dee75f93abb",
          "executable": true
        },
        {
          "path": "python/bin/python3",
          "bytes": 18066512,
          "sha256": "042454a41d6c32f2be126c4bbae2a4b8a54488c66f4b07379cd24dee75f93abb",
          "executable": true
        },
        {
          "path": "python/bin/python3-config",
          "bytes": 2100,
          "sha256": "2b10c2f47d035259835eab4c68c34b026184d52b548dbe6886911fa548648948",
          "executable": true
        },
        {
          "path": "python/bin/python3.12",
          "bytes": 18066512,
          "sha256": "042454a41d6c32f2be126c4bbae2a4b8a54488c66f4b07379cd24dee75f93abb",
          "executable": true
        },
        {
          "path": "python/bin/python3.12-config",
          "bytes": 2100,
          "sha256": "2b10c2f47d035259835eab4c68c34b026184d52b548dbe6886911fa548648948",
          "executable": true
        },
        {
          "path": "python/include/python3.12/abstract.h",
          "bytes": 32616,
          "sha256": "8f0b27427f4e16b4295b2ab1a7bb499bf86748fafbd1959e220c506ed59f774f"
        },
        {
          "path": "python/include/python3.12/bltinmodule.h",
          "bytes": 264,
          "sha256": "1b5101b4b85409fd910032713906800bbb83580503036469c2a60ac8e80b8f72"
        },
        {
          "path": "python/include/python3.12/boolobject.h",
          "bytes": 1136,
          "sha256": "84289d5b1a1b7ed6c547f4f081fba70e90a9d60dfa2d2b3155c33cdd2af41340"
        },
        {
          "path": "python/include/python3.12/bytearrayobject.h",
          "bytes": 1466,
          "sha256": "0e93963caf43a057fb293ae5183d1b8bb45c9f57926ce8308f67a0f452843e85"
        },
        {
          "path": "python/include/python3.12/bytesobject.h",
          "bytes": 2619,
          "sha256": "de8551db9323e7dc463717a624f2d35dacd17cdf0c7a7f6299128dd06348cf30"
        },
        {
          "path": "python/include/python3.12/ceval.h",
          "bytes": 6267,
          "sha256": "9531cce1b80e804d46a9ef31bd22605f54d0ae0609dc3470946a4d8d4270af3a"
        },
        {
          "path": "python/include/python3.12/codecs.h",
          "bytes": 7071,
          "sha256": "0ca3c6e55e7ff62872b47aeeb7379d784b03ebfc61bbd029b67485fe783baac5"
        },
        {
          "path": "python/include/python3.12/compile.h",
          "bytes": 448,
          "sha256": "1f10c818b29007e6a4446505a1140dd77ca6618ad81e87b502f4e22f4b274406"
        },
        {
          "path": "python/include/python3.12/complexobject.h",
          "bytes": 728,
          "sha256": "9356805a24503256cd8914d7b7700357e01f471c211f9241c81981d89d6c3af8"
        },
        {
          "path": "python/include/python3.12/cpython/abstract.h",
          "bytes": 7870,
          "sha256": "07d8b3b9c7db77e30adef4c4d9c7a4453b8eb1f48341ed5394bd5eebe239c9fd"
        },
        {
          "path": "python/include/python3.12/cpython/bytearrayobject.h",
          "bytes": 1163,
          "sha256": "ae5e099856657f3b8606701df312866eaa88992f6cfd9f8567456e1588efceb1"
        },
        {
          "path": "python/include/python3.12/cpython/bytesobject.h",
          "bytes": 4660,
          "sha256": "5ba5010b9aa79f401196740da7c653590f5f4eec6b4f33e99de5412a969fcc8a"
        },
        {
          "path": "python/include/python3.12/cpython/cellobject.h",
          "bytes": 1076,
          "sha256": "844f06178bbce2e9377a46ccc80e2aae85a73750932576a6cc4de934cc508cea"
        },
        {
          "path": "python/include/python3.12/cpython/ceval.h",
          "bytes": 1650,
          "sha256": "b08c549971f1006e681267dd8a88481353ce4bd89b9d859f81b72cf9bf867895"
        },
        {
          "path": "python/include/python3.12/cpython/classobject.h",
          "bytes": 2245,
          "sha256": "b38a0ecdebeae2a4d28dfe8a5f2833f676d38be9561ca4bdfdf5087bbe2f9332"
        },
        {
          "path": "python/include/python3.12/cpython/code.h",
          "bytes": 16188,
          "sha256": "d11649dd957102deb64de35f078f061735343f5c9a5c9c429a09722cd6a2931c"
        },
        {
          "path": "python/include/python3.12/cpython/compile.h",
          "bytes": 2660,
          "sha256": "32d7397c6fa5478feb2a4101641fca6dba3ac77abe4deed5c0f713a6cd6564f5"
        },
        {
          "path": "python/include/python3.12/cpython/complexobject.h",
          "bytes": 1248,
          "sha256": "a4c110008e4d791a4577ce6ebee33bc512ec3e3db918bd2c296f00dd79379fcb"
        },
        {
          "path": "python/include/python3.12/cpython/context.h",
          "bytes": 1965,
          "sha256": "9e34d54a789cbf0d78d5ebb126e8384342c08dd81d944d10e3d8f0de0bbba10a"
        },
        {
          "path": "python/include/python3.12/cpython/descrobject.h",
          "bytes": 1642,
          "sha256": "a1ee0124142fe91204d0c5e85169b55341b2167111a1447e3a8ed50f9bd5a12f"
        },
        {
          "path": "python/include/python3.12/cpython/dictobject.h",
          "bytes": 4686,
          "sha256": "5ac16d73f22038b12bd06904cf02a14bbdd723234d1d899354f1a041e8659505"
        },
        {
          "path": "python/include/python3.12/cpython/fileobject.h",
          "bytes": 818,
          "sha256": "16ab872cbe2bb3351ce3090873440903b1460c1d68aed483c70c31edc4140ba2"
        },
        {
          "path": "python/include/python3.12/cpython/fileutils.h",
          "bytes": 232,
          "sha256": "d7a2f703c6fba2efabd0b1cc916ad36074363a27a000987cfad17e21f04d44f1"
        },
        {
          "path": "python/include/python3.12/cpython/floatobject.h",
          "bytes": 900,
          "sha256": "f1c53f5b87f221db66004b836aa2fc9462aa46c2fbe46b417a8ddc803ce2f585"
        },
        {
          "path": "python/include/python3.12/cpython/frameobject.h",
          "bytes": 1108,
          "sha256": "e1421b58c6a25efb56f423a749c313e3f5392f58cc0c7f4f09b0412217a4a734"
        },
        {
          "path": "python/include/python3.12/cpython/funcobject.h",
          "bytes": 7188,
          "sha256": "11077e0acca3c026f706327c29d73ef629f5d6bfbd97b2178d672b80f8792497"
        },
        {
          "path": "python/include/python3.12/cpython/genobject.h",
          "bytes": 3316,
          "sha256": "24f9bd2f19341dc73c7deebca17117ea3a94fd89865c0c6548e1bf5882f51d95"
        },
        {
          "path": "python/include/python3.12/cpython/import.h",
          "bytes": 1623,
          "sha256": "f3a6cb7ea774d2ffcb64c834dffaf008e8f9f3f10b23600d5522d82176cb241c"
        },
        {
          "path": "python/include/python3.12/cpython/initconfig.h",
          "bytes": 7820,
          "sha256": "86e3b9d1de6f310415912e2cdfdc276e311c026ec7fdf6190893f6313cd860a3"
        },
        {
          "path": "python/include/python3.12/cpython/interpreteridobject.h",
          "bytes": 387,
          "sha256": "8fc79784d556245d7b7f382063ef3797e3aebd0a6b375a95027dd63a5dfa30b6"
        },
        {
          "path": "python/include/python3.12/cpython/listobject.h",
          "bytes": 1633,
          "sha256": "0ccca44b405add7a8c19d7a5e7701e06ab904cce5c430016b50f7968aef296fe"
        },
        {
          "path": "python/include/python3.12/cpython/longintrepr.h",
          "bytes": 4889,
          "sha256": "e2acf37f668089278081539473eeedc8537b848fcd2eb91f53172701c014b9c3"
        },
        {
          "path": "python/include/python3.12/cpython/longobject.h",
          "bytes": 4679,
          "sha256": "b443782d6b69a2cfd141ac13ac8b7a8d69e47bfdae9df984de4991b2d248b8b8"
        },
        {
          "path": "python/include/python3.12/cpython/memoryobject.h",
          "bytes": 2272,
          "sha256": "62f414f21611a31f453af7c8326b309aad8f79166087a951844921c50cc84dc7"
        },
        {
          "path": "python/include/python3.12/cpython/methodobject.h",
          "bytes": 2276,
          "sha256": "5beb9f3b68ac72efe403a1b0a3fbbb14a5606a49a2840b9c7e9ff243d82d79b9"
        },
        {
          "path": "python/include/python3.12/cpython/modsupport.h",
          "bytes": 4336,
          "sha256": "a8d08132874d9d642ade82e62e87a510577b7bd4ab0685a90b044cc3b005232d"
        },
        {
          "path": "python/include/python3.12/cpython/object.h",
          "bytes": 21212,
          "sha256": "f412fd84202ef228e6bf239c9a5a408b8d8623481a15452f8f3331dfc6342134"
        },
        {
          "path": "python/include/python3.12/cpython/objimpl.h",
          "bytes": 3316,
          "sha256": "d99f0cff4297590a49f6616dbf1b04a06c745bed0a280ae35acc56fb3c47f2f3"
        },
        {
          "path": "python/include/python3.12/cpython/odictobject.h",
          "bytes": 1311,
          "sha256": "97dc6296e890463fc6994247e885df65cd4024dc1b05facfdc984c37d646b919"
        },
        {
          "path": "python/include/python3.12/cpython/picklebufobject.h",
          "bytes": 848,
          "sha256": "7040fb48462296c903f2f0d24d2b54e0de63cf7512dcf8d3048a0cadf7d94fd0"
        },
        {
          "path": "python/include/python3.12/cpython/pthread_stubs.h",
          "bytes": 3505,
          "sha256": "0f3108e0430ee937098c86352d2ced6e3ec7f5cb5bc7e06eebee58cf779fcd89"
        },
        {
          "path": "python/include/python3.12/cpython/pyctype.h",
          "bytes": 1387,
          "sha256": "10b5ccbc210fd2832e9c34849a3952e8db75f0016add89188358b1da6a8f3dbb"
        },
        {
          "path": "python/include/python3.12/cpython/pydebug.h",
          "bytes": 1413,
          "sha256": "83d72e867b4fc9ac87efdfcb41c3d30ec20fa239fe6a74d1b85aa92e1f8d9506"
        },
        {
          "path": "python/include/python3.12/cpython/pyerrors.h",
          "bytes": 4276,
          "sha256": "1f5070d787263e3aa8845dc90b38aaeb0945be83ef2ba993a40b4af926daacad"
        },
        {
          "path": "python/include/python3.12/cpython/pyfpe.h",
          "bytes": 444,
          "sha256": "ea7bfa7d891a0b5372d8b40a57d1b466b7824296e5c3f8d50b1a7cde084429b7"
        },
        {
          "path": "python/include/python3.12/cpython/pyframe.h",
          "bytes": 1479,
          "sha256": "0c7ea17874b967892de6f6623aa426d5eaf267a56e6bbb84b3fefa40e59ec1b8"
        },
        {
          "path": "python/include/python3.12/cpython/pylifecycle.h",
          "bytes": 3423,
          "sha256": "02505815b8bc3e33fe31a11f4f7f960826aa1dce2c4cee6d62d2a0394470c9bf"
        },
        {
          "path": "python/include/python3.12/cpython/pymem.h",
          "bytes": 3379,
          "sha256": "8a3795a9350b10548e8ad6d37dad69be2abd3870a751e67faa32a19a090608db"
        },
        {
          "path": "python/include/python3.12/cpython/pystate.h",
          "bytes": 17228,
          "sha256": "11494795dd1d6945fbf8036af5ccf247463e94d405a760924a1c78f78ebfc4ec"
        },
        {
          "path": "python/include/python3.12/cpython/pythonrun.h",
          "bytes": 4903,
          "sha256": "3290ea064e7450aaf43320a5fcac22d9b36acfab43d1d2c3381ade4b726ced8f"
        },
        {
          "path": "python/include/python3.12/cpython/pythread.h",
          "bytes": 1418,
          "sha256": "09edccc28c784f8bb85fb77583107ac1fb52fc748946596a03cc36a9296a70dd"
        },
        {
          "path": "python/include/python3.12/cpython/pytime.h",
          "bytes": 12402,
          "sha256": "a01714df4c0efdb9e20b26da6d1fc0e5a56619677c60c291f148db5e3cf2faa4"
        },
        {
          "path": "python/include/python3.12/cpython/setobject.h",
          "bytes": 2146,
          "sha256": "c965bf093325e20c319af5183a8e5723d4d0b373cb6d1b8781df8c1e588963c0"
        },
        {
          "path": "python/include/python3.12/cpython/sysmodule.h",
          "bytes": 489,
          "sha256": "d4936db24692cccadb19c11accda260787f95e5658f88cfc752d9a49344ee051"
        },
        {
          "path": "python/include/python3.12/cpython/traceback.h",
          "bytes": 444,
          "sha256": "7898a3c168973e1119fb3b57f144be627c1468082ab0b91d001dd876dd1dbcb6"
        },
        {
          "path": "python/include/python3.12/cpython/tupleobject.h",
          "bytes": 1377,
          "sha256": "301c0720038f50d8e9087b38cf1392524abf9e28262b677d841fc1a7e172c3f3"
        },
        {
          "path": "python/include/python3.12/cpython/unicodeobject.h",
          "bytes": 35296,
          "sha256": "edfa102633ee0e3cc42652a36912b568ae0cea8bb72360cc97876f170504209c"
        },
        {
          "path": "python/include/python3.12/cpython/warnings.h",
          "bytes": 564,
          "sha256": "b758a2e42b0c497ea811464f579603d14fc30b50bd6ebe064d8d2a7df7e2bd76"
        },
        {
          "path": "python/include/python3.12/cpython/weakrefobject.h",
          "bytes": 2032,
          "sha256": "be0ab05169da7efcd13aba0ddc58604a80328d4e60349df6d4efdd1bf363e1a2"
        },
        {
          "path": "python/include/python3.12/datetime.h",
          "bytes": 9769,
          "sha256": "f3d8192cada0f490a67233e615e5974f062501b2876147118ddb042ee4a7f988"
        },
        {
          "path": "python/include/python3.12/descrobject.h",
          "bytes": 3080,
          "sha256": "2956a488f4c4c61341e361dac949cfa4a217e0fbd0097892513b02363c9570a7"
        },
        {
          "path": "python/include/python3.12/dictobject.h",
          "bytes": 3860,
          "sha256": "08f92e2a4421d3e81fa0fa1b60cbe97f2d69897226368481b0ffc41eeb202356"
        },
        {
          "path": "python/include/python3.12/dynamic_annotations.h",
          "bytes": 22471,
          "sha256": "3e4366f7d082835049730358d277a5ad7a60e16d1601f5622f0a045a37c152ac"
        },
        {
          "path": "python/include/python3.12/enumobject.h",
          "bytes": 253,
          "sha256": "2244fe250db9995068fe74dce0e23fd70c12b03fd94751d98b773be8f64896b6"
        },
        {
          "path": "python/include/python3.12/errcode.h",
          "bytes": 1779,
          "sha256": "e09ffcbb80580103d52992eb5fd8fd01b9930fda5e8f3874bfb9ee7aa2fe99fa"
        },
        {
          "path": "python/include/python3.12/exports.h",
          "bytes": 1267,
          "sha256": "d02e9937f747660b218062bcdab504b706cad264b4df993f749d9118f2f7b65c"
        },
        {
          "path": "python/include/python3.12/fileobject.h",
          "bytes": 1650,
          "sha256": "133e57cf705cbdaa79a0c115b27e748cc24dedb51ea17b441ff65d05df28a674"
        },
        {
          "path": "python/include/python3.12/fileutils.h",
          "bytes": 507,
          "sha256": "51ae1c2ca70a8005206f653121d1ba3247f59421c96399739845d687980e9b01"
        },
        {
          "path": "python/include/python3.12/floatobject.h",
          "bytes": 1532,
          "sha256": "50d23b4026d270e543d2dd52059bb409569218bf6c3c219dbe836077ee0ca868"
        },
        {
          "path": "python/include/python3.12/frameobject.h",
          "bytes": 336,
          "sha256": "969cd93065ce79b81bbc67a65d31b742e23f30bf79d6e44a306963d552ed0c35"
        },
        {
          "path": "python/include/python3.12/genericaliasobject.h",
          "bytes": 334,
          "sha256": "0e53a0b18c114be68eccea9ffd1dd577e204b1f0ada4d3aedc8e7ee0c80fc7f8"
        },
        {
          "path": "python/include/python3.12/import.h",
          "bytes": 3033,
          "sha256": "4113e1b6afa760c3decce2bb765835adda19861394974cfe301e1ccb482e2b94"
        },
        {
          "path": "python/include/python3.12/internal/pycore_abstract.h",
          "bytes": 611,
          "sha256": "75ecd34cdcd06fc64fcfa550f66975d755619e7cf06fdae8ecbe2de6ec49ce39"
        },
        {
          "path": "python/include/python3.12/internal/pycore_asdl.h",
          "bytes": 3035,
          "sha256": "b29dace0f84849c4a24bc3745523a36911cd192bad7ec6fb48aba8facff51d3e"
        },
        {
          "path": "python/include/python3.12/internal/pycore_ast_state.h",
          "bytes": 6749,
          "sha256": "1d76a7b5207c653a86dec97aab5ba1fcc5c75e94333662792a692cb68e5b26c6"
        },
        {
          "path": "python/include/python3.12/internal/pycore_ast.h",
          "bytes": 31288,
          "sha256": "064b6778fa758fb2580fb8770f77dd0d1eb19323df0e345373788c75754910cf"
        },
        {
          "path": "python/include/python3.12/internal/pycore_atexit.h",
          "bytes": 1149,
          "sha256": "8c5c88b8452894cf8a5f243ceb9021060f0fe8f5689cbc3e705c19c5edc0798a"
        },
        {
          "path": "python/include/python3.12/internal/pycore_atomic_funcs.h",
          "bytes": 2438,
          "sha256": "9d5cfa13ad863a0cc1b0ab06861c1f8cfbdc7d730b9c4603e5777a608263d399"
        },
        {
          "path": "python/include/python3.12/internal/pycore_atomic.h",
          "bytes": 16979,
          "sha256": "95e7118e799ad3faafc8e58a29b2d1f1a4bb94e1aac3273e042f379f8e12d4e6"
        },
        {
          "path": "python/include/python3.12/internal/pycore_bitutils.h",
          "bytes": 6062,
          "sha256": "86628b9cbefe4ff000e1190cd36f37b70a2dad6a4e9231cc2466a84579cc2139"
        },
        {
          "path": "python/include/python3.12/internal/pycore_blocks_output_buffer.h",
          "bytes": 8688,
          "sha256": "03fed5054d0d78e3711e73995e484fefb81495c063a5b9ef555c0395d7fc1ebc"
        },
        {
          "path": "python/include/python3.12/internal/pycore_bytes_methods.h",
          "bytes": 3384,
          "sha256": "1534326dbf027e9bb472be5ccf8b82fab48f3282cc7f6a61629b801fc80afc00"
        },
        {
          "path": "python/include/python3.12/internal/pycore_bytesobject.h",
          "bytes": 1339,
          "sha256": "d3ecf25cf0f0e9815ac24f496e5ccbbf8d57a10e570da81e84f2b5f6e95b59b8"
        },
        {
          "path": "python/include/python3.12/internal/pycore_call.h",
          "bytes": 3920,
          "sha256": "5e780aed2dc991455a0e528fc7baca8df61d2e4bec4e137d7e788668b5750ec5"
        },
        {
          "path": "python/include/python3.12/internal/pycore_ceval_state.h",
          "bytes": 2744,
          "sha256": "f29e3d6dcac96b0067a17845df8483013230805db10c6f3c5ecd02b9134640e7"
        },
        {
          "path": "python/include/python3.12/internal/pycore_ceval.h",
          "bytes": 5265,
          "sha256": "1af22b50c9ececfc4c3a5f37ecb70cc1c0eefad5a2656e6e22fc088cae54e226"
        },
        {
          "path": "python/include/python3.12/internal/pycore_code.h",
          "bytes": 15835,
          "sha256": "48e78dd1a12e6afa6e54e26f8e7c4f56e20689b84189d503507c7f6c36819092"
        },
        {
          "path": "python/include/python3.12/internal/pycore_compile.h",
          "bytes": 3453,
          "sha256": "4d386629f5e0ea801a01122833f11363cf9f1584aef6e9692ffd0b95eda37cbc"
        },
        {
          "path": "python/include/python3.12/internal/pycore_condvar.h",
          "bytes": 2909,
          "sha256": "97c4cb5f0a32cd967dd5d54d4ddaed9323c7c2439cd6ffbba9f7d48064b97b26"
        },
        {
          "path": "python/include/python3.12/internal/pycore_context.h",
          "bytes": 1301,
          "sha256": "974d6bafbe0164d60dd1bc4f09b5eac9bcc9e2d9066924ba2a2ba6d502f115b5"
        },
        {
          "path": "python/include/python3.12/internal/pycore_descrobject.h",
          "bytes": 499,
          "sha256": "d9be424b5c2d109b51338016acab6132f299c0640fc069fb0e1d48575089574e"
        },
        {
          "path": "python/include/python3.12/internal/pycore_dict_state.h",
          "bytes": 1095,
          "sha256": "5a15c2bb4020ce4a1d7a4c651e0f98b4becd910f89cd7c4089c80a0419ec4f1c"
        },
        {
          "path": "python/include/python3.12/internal/pycore_dict.h",
          "bytes": 6384,
          "sha256": "4d51e7184d50a5f8785a1cbdc9f6eb36b86201158ae6e3527884ce2b5dd504bf"
        },
        {
          "path": "python/include/python3.12/internal/pycore_dtoa.h",
          "bytes": 1615,
          "sha256": "c83a4aa972a4845cdf36abdac4769ea30e877aae1997fc4999d020bc3e183c1e"
        },
        {
          "path": "python/include/python3.12/internal/pycore_emscripten_signal.h",
          "bytes": 562,
          "sha256": "1acd47a1c09e365be8c7fa51db31307021cc2e471471fc199e26f317df58c4b8"
        },
        {
          "path": "python/include/python3.12/internal/pycore_exceptions.h",
          "bytes": 842,
          "sha256": "4590af737d53afcbd7d559434190d2d8ff4f5cd0e923837721aea5ebb000ef68"
        },
        {
          "path": "python/include/python3.12/internal/pycore_faulthandler.h",
          "bytes": 2220,
          "sha256": "6444dce1924eae011d27385183ad1a5de6908501cedce2e1531abd834c68cae7"
        },
        {
          "path": "python/include/python3.12/internal/pycore_fileutils_windows.h",
          "bytes": 2724,
          "sha256": "9e976ea0f3457c8b40db0a3b2cfea9e9684737f75282400ec0040ae0df1e6385"
        },
        {
          "path": "python/include/python3.12/internal/pycore_fileutils.h",
          "bytes": 7910,
          "sha256": "ea9cac693c87dc049f199cecd2844592ee08d0283dc0b059c4caab517932af73"
        },
        {
          "path": "python/include/python3.12/internal/pycore_floatobject.h",
          "bytes": 1578,
          "sha256": "021fef24c4b7e7390c793af7ccf12ddd94b1871e27d26997b37eb3093d5380b5"
        },
        {
          "path": "python/include/python3.12/internal/pycore_flowgraph.h",
          "bytes": 4630,
          "sha256": "c58cdc30ce8c853404f55881813ec69d6dbf921f2769ec9e289b5155b7a349db"
        },
        {
          "path": "python/include/python3.12/internal/pycore_format.h",
          "bytes": 480,
          "sha256": "253cc77e6d11ba20d297813e064650fa965b3653f150bd85f805b94db5f3a98d"
        },
        {
          "path": "python/include/python3.12/internal/pycore_frame.h",
          "bytes": 9255,
          "sha256": "23d66ba6ef2936ecca96dc427be5e022712ae25c3f4b3df2abd2ca46b1ee5f39"
        },
        {
          "path": "python/include/python3.12/internal/pycore_function.h",
          "bytes": 611,
          "sha256": "8fad970bd3f31347aed72b92acd17270dbb6ec5333ab5ed6fe43dc9cf2527841"
        },
        {
          "path": "python/include/python3.12/internal/pycore_gc.h",
          "bytes": 7658,
          "sha256": "d0349a94dafb16ec4c05ba5a94d3b9e6cec53fe7b5e0d74216ea31996546f9a3"
        },
        {
          "path": "python/include/python3.12/internal/pycore_genobject.h",
          "bytes": 1186,
          "sha256": "a940f41da1e8d9d12c9c438ea0b4f24e72abc494447bcecd9423b76f54e3402a"
        },
        {
          "path": "python/include/python3.12/internal/pycore_getopt.h",
          "bytes": 490,
          "sha256": "e93393067b66b557b0300e05c10ee904d4be54cadfb214c5328a9225ad199452"
        },
        {
          "path": "python/include/python3.12/internal/pycore_gil.h",
          "bytes": 1565,
          "sha256": "cf455aacd5651e5b43547ebe69bb324eab84238d92665df53c1df32434bd0d9b"
        },
        {
          "path": "python/include/python3.12/internal/pycore_global_objects_fini_generated.h",
          "bytes": 115361,
          "sha256": "7fe489effdce5c7b74273742e1c5d6c3d84ce7328480efe00dad9051bfa47c03"
        },
        {
          "path": "python/include/python3.12/internal/pycore_global_objects.h",
          "bytes": 3035,
          "sha256": "ce857a319514b1682eb054bf4a017974b0bf211092819b25f23e877a228090df"
        },
        {
          "path": "python/include/python3.12/internal/pycore_global_strings.h",
          "bytes": 25438,
          "sha256": "da08d01f47b89ef7bc83893ba7b32a0b690fd3ac5a5922dffa7a649ceb900d91"
        },
        {
          "path": "python/include/python3.12/internal/pycore_hamt.h",
          "bytes": 3742,
          "sha256": "074b31c2f5701cac43d8dc3e4ede40b2befc6dddfcaa2862cfc8f76234c30ae8"
        },
        {
          "path": "python/include/python3.12/internal/pycore_hashtable.h",
          "bytes": 4286,
          "sha256": "690488a7e50ad743e1bb685702fbcfac866ace89d2417a247c1171afdc222261"
        },
        {
          "path": "python/include/python3.12/internal/pycore_import.h",
          "bytes": 6358,
          "sha256": "e5b179692f05707e7fb182b908ed46f9a75f4a751b20501a74de2a440c387e1d"
        },
        {
          "path": "python/include/python3.12/internal/pycore_initconfig.h",
          "bytes": 5706,
          "sha256": "caf13e2c290ae8375636d0e1f3b1851a90396b3747da650d058c282b8743b558"
        },
        {
          "path": "python/include/python3.12/internal/pycore_instruments.h",
          "bytes": 2998,
          "sha256": "dcdb0593cfa908c036d6661f1a776db48642c0fedd243da88161f45ff3c3e3fa"
        },
        {
          "path": "python/include/python3.12/internal/pycore_interp.h",
          "bytes": 9086,
          "sha256": "23f5d7884f9e0b212fe79879bbcdc5a2c23c22283db38cadbac6f108bf0f1b75"
        },
        {
          "path": "python/include/python3.12/internal/pycore_intrinsics.h",
          "bytes": 1397,
          "sha256": "e6d6d1eae51b508196615094a4c17189e9822eacb5c0e94102e78aa7136dd9a8"
        },
        {
          "path": "python/include/python3.12/internal/pycore_list.h",
          "bytes": 1980,
          "sha256": "470a62bb98b383b85ec738a6577424e6cdd51ae235f4e5ea06c5afdedb6e1652"
        },
        {
          "path": "python/include/python3.12/internal/pycore_long.h",
          "bytes": 7805,
          "sha256": "84c0c7bd7ba0c2fbbfb106561e32328e478d8350afe756af6a4862c95d921a06"
        },
        {
          "path": "python/include/python3.12/internal/pycore_memoryobject.h",
          "bytes": 383,
          "sha256": "c845bb546019ed9999403018740ee5b26f83f8d888c5288895897cb2bd1b5eec"
        },
        {
          "path": "python/include/python3.12/internal/pycore_moduleobject.h",
          "bytes": 1192,
          "sha256": "55a8f42968545a349d8e0b43cd1822b22ae2cf9fa0fb098c6bb843e7af76e165"
        },
        {
          "path": "python/include/python3.12/internal/pycore_namespace.h",
          "bytes": 392,
          "sha256": "466fe0e3f48e954d8bfe9e0c73fc9378cf79ca37710778ba6698e1c365304956"
        },
        {
          "path": "python/include/python3.12/internal/pycore_object_state.h",
          "bytes": 1016,
          "sha256": "572c053ce17edd206c776e7138965fa1f7485127e05c68ce9ad0232e3a821692"
        },
        {
          "path": "python/include/python3.12/internal/pycore_object.h",
          "bytes": 14917,
          "sha256": "56c99d065465adb1255cbb064a3b8bc52698393965982cfd9fd6adf54adc60f5"
        },
        {
          "path": "python/include/python3.12/internal/pycore_obmalloc_init.h",
          "bytes": 2085,
          "sha256": "33853ff5ffac15a8622ff6920ff2bd0bf83d1df7ea6d1563916d05992b3203fb"
        },
        {
          "path": "python/include/python3.12/internal/pycore_obmalloc.h",
          "bytes": 27284,
          "sha256": "d8738004c5dbb5520f401919ed55181a48a9e64a3b51930309fc99fb9d219576"
        },
        {
          "path": "python/include/python3.12/internal/pycore_opcode_utils.h",
          "bytes": 2686,
          "sha256": "98dfb250812d554278dedee98a2e9cb05b2583b22d2af8ba1aeda6b130a21b40"
        },
        {
          "path": "python/include/python3.12/internal/pycore_opcode.h",
          "bytes": 20081,
          "sha256": "432e30c6145dff72096325d17192d0eff9895b367d4590f782e2d8b9d5f78cd6"
        },
        {
          "path": "python/include/python3.12/internal/pycore_parser.h",
          "bytes": 1358,
          "sha256": "91189a016020eb7de0b1ab8ae38145dbec6b561ae5c75cea15980cb76255ba5b"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pathconfig.h",
          "bytes": 606,
          "sha256": "ff96c74aae60eba62bec8c6d52f34471caf07792186bc16d76e7a783f61aa0ed"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pyarena.h",
          "bytes": 2733,
          "sha256": "d4f4e513bae78ff985f51ca48fb7d1a4d57055c59393a1eb661e55e6ec3ba61f"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pyerrors.h",
          "bytes": 3110,
          "sha256": "87b6e1741b1d6c4fd7b370b41b06df113109a84f2308d01c4793315a538274b4"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pyhash.h",
          "bytes": 709,
          "sha256": "7c631d06afad90fa9c2ddc8dc04b7c2855ee5aa6e7ece0b22d0a966a702abf73"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pylifecycle.h",
          "bytes": 3365,
          "sha256": "f6a91e690b8e5d3dca52dcdff63d36a6ad9ad85b7ee1edfc14215cc0483059fa"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pymath.h",
          "bytes": 8600,
          "sha256": "6dd3ea0f9a84bfa3a2eb0a2b7fa1af1dc8aadad3e74305e13f194a1586815376"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pymem_init.h",
          "bytes": 2654,
          "sha256": "82a1418ee1867e5e9a2717e8a1acfec2e2ff3ef07225e30be7c8cd8f6e29a7ba"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pymem.h",
          "bytes": 3040,
          "sha256": "ad0b35bbf5e665e90223499f8954bfcf36448b1634d54501b0c84d08680323ca"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pystate.h",
          "bytes": 4982,
          "sha256": "c06823811bf5dd3d84f40d6a087452da5915e3ad277afef2202c9e86e833ce00"
        },
        {
          "path": "python/include/python3.12/internal/pycore_pythread.h",
          "bytes": 2075,
          "sha256": "ba04eed4d18d6110982cc58800fda11f3899c61fed644ff9e52a4adedb7b750a"
        },
        {
          "path": "python/include/python3.12/internal/pycore_range.h",
          "bytes": 346,
          "sha256": "824c5023a85a9c1c2dd50fecf442d12c7b2966e0e71a2d291f6f17f7fd8c29bc"
        },
        {
          "path": "python/include/python3.12/internal/pycore_runtime_init_generated.h",
          "bytes": 45751,
          "sha256": "b240fe061c8e45cf069e35828cc5d07c53f03890c308789bf11442cf6427e31d"
        },
        {
          "path": "python/include/python3.12/internal/pycore_runtime_init.h",
          "bytes": 5912,
          "sha256": "819bbcf74ae8c370aadcf0270469d895f1fefe5d012da847135081b3a77ac768"
        },
        {
          "path": "python/include/python3.12/internal/pycore_runtime.h",
          "bytes": 8429,
          "sha256": "d47fe4de4c245e2f90ce73792337565cae6ce95d8e2cd08bcda43ec92832b1ac"
        },
        {
          "path": "python/include/python3.12/internal/pycore_signal.h",
          "bytes": 2611,
          "sha256": "186835a8702a10bb1f3f63185d50874f24885716707717f620d3ffd0a2039679"
        },
        {
          "path": "python/include/python3.12/internal/pycore_sliceobject.h",
          "bytes": 414,
          "sha256": "e8b9ba794081a75bf73f0eb64089a766b5bd04b076d4368a14a83ff43ce909be"
        },
        {
          "path": "python/include/python3.12/internal/pycore_strhex.h",
          "bytes": 937,
          "sha256": "45783d1137fc33a8d9e457692227e8395a93b27c76205f50ad7bd8f00fe7aefb"
        },
        {
          "path": "python/include/python3.12/internal/pycore_structseq.h",
          "bytes": 923,
          "sha256": "e1c1be3681fec8c1146d5a084869c1bbabcbe68223382cdab8536c8b88958891"
        },
        {
          "path": "python/include/python3.12/internal/pycore_symtable.h",
          "bytes": 7035,
          "sha256": "0eeea2ae4b12aaa38bfb8f15f404771306dd4ff92f6f766be10be8129b00e2fc"
        },
        {
          "path": "python/include/python3.12/internal/pycore_sysmodule.h",
          "bytes": 999,
          "sha256": "668e205cf1d4807953f1240d0e2420169c068607b94b05505179f8d6cce2d5e4"
        },
        {
          "path": "python/include/python3.12/internal/pycore_time.h",
          "bytes": 388,
          "sha256": "6838118a537e71edaf76290da15cbf2da19499df1ee4e30b15f35bb4b9257b70"
        },
        {
          "path": "python/include/python3.12/internal/pycore_token.h",
          "bytes": 3050,
          "sha256": "91c75ef718b8e8be2383fdcea502c1e63ebfa6d681afd45672e379ea7e5d3668"
        },
        {
          "path": "python/include/python3.12/internal/pycore_traceback.h",
          "bytes": 3501,
          "sha256": "3f9dfb009dc161f2d979f5af76d660611264b5d0b1b4adeeae10d30ee0999ede"
        },
        {
          "path": "python/include/python3.12/internal/pycore_tracemalloc.h",
          "bytes": 3075,
          "sha256": "61ac9b846ae579c667d20034c9c4004a07ab3ff039848ddeeec8d9c39ff1331a"
        },
        {
          "path": "python/include/python3.12/internal/pycore_tuple.h",
          "bytes": 2197,
          "sha256": "de5677ac0809abf2744ebdd94768b6974e75ea62cc2cee44c4f433e2b818f953"
        },
        {
          "path": "python/include/python3.12/internal/pycore_typeobject.h",
          "bytes": 4731,
          "sha256": "7cbcc82334920ed3711f7cd761114d39168697bcf4d8ba85583cf4b25cc2c46a"
        },
        {
          "path": "python/include/python3.12/internal/pycore_typevarobject.h",
          "bytes": 763,
          "sha256": "b925204918e577bfb667a64f5f56e410cba0bc518207ed8535d1fcf1bdd6ab00"
        },
        {
          "path": "python/include/python3.12/internal/pycore_ucnhash.h",
          "bytes": 898,
          "sha256": "6d9077e875703e5db7daf293a6c7ea3d43d1ee84dec137a950f17a26e9348eb5"
        },
        {
          "path": "python/include/python3.12/internal/pycore_unicodeobject_generated.h",
          "bytes": 125516,
          "sha256": "87ac08146e99b7729b46e451af19d355f9e48952585dc67a07d3c788a20d3766"
        },
        {
          "path": "python/include/python3.12/internal/pycore_unicodeobject.h",
          "bytes": 2657,
          "sha256": "e171f3303be9a161db66cb8ab942ebe75976a5cc815a633ac6c38dba31d76d60"
        },
        {
          "path": "python/include/python3.12/internal/pycore_unionobject.h",
          "bytes": 682,
          "sha256": "f1c5bbdf5660e54872ff1555c179cf6c80f8e04cac41e974b7964e21f82be18c"
        },
        {
          "path": "python/include/python3.12/internal/pycore_warnings.h",
          "bytes": 740,
          "sha256": "3229b207245cb9442f09991df7084c8e4cb87cb073a14a2d520bd92634371fcb"
        },
        {
          "path": "python/include/python3.12/interpreteridobject.h",
          "bytes": 333,
          "sha256": "b497c869333bdf1f79a580a36e9a0ed64fee226daa1d2d45bdfe16c01e52d73c"
        },
        {
          "path": "python/include/python3.12/intrcheck.h",
          "bytes": 772,
          "sha256": "696fe17618c579a8cbaad9b86175f60d43ea0b9e8aaaa1d65ad256d53dc163c1"
        },
        {
          "path": "python/include/python3.12/iterobject.h",
          "bytes": 597,
          "sha256": "6b16711d2bb6cee55e4288f84142d592eebf07321e32998a5abe2c06deeb77b0"
        },
        {
          "path": "python/include/python3.12/listobject.h",
          "bytes": 1782,
          "sha256": "f4cad9a1f48d27a9a7f56702ab0fe785013eb336ea919197600d86a6e54fa5bf"
        },
        {
          "path": "python/include/python3.12/longobject.h",
          "bytes": 3739,
          "sha256": "0567b258763af5e6cb0ecba02135b41b012425a673d4da8c87db1333ac638901"
        },
        {
          "path": "python/include/python3.12/marshal.h",
          "bytes": 827,
          "sha256": "d7f5760ef6496776cee99aca5491789f6ab261a78b156b5758538ea15e1827e5"
        },
        {
          "path": "python/include/python3.12/memoryobject.h",
          "bytes": 1081,
          "sha256": "efb734845a1366d77f6351cbb954c08681d4acfe6a53e41e82dd45fa881e0090"
        },
        {
          "path": "python/include/python3.12/methodobject.h",
          "bytes": 5076,
          "sha256": "059e19bd8d418c8bf1481e301340f989317ba7b56de94729a19aae26fee3da62"
        },
        {
          "path": "python/include/python3.12/modsupport.h",
          "bytes": 6515,
          "sha256": "064d1440d862d08f296c1cbe868e417af12b34f770be515461211f5beade04ff"
        },
        {
          "path": "python/include/python3.12/moduleobject.h",
          "bytes": 3559,
          "sha256": "5eb48f5d99322d7912a5c6f2b3a974e283c7a6045f79a503d7e09f3ac15b42ec"
        },
        {
          "path": "python/include/python3.12/object.h",
          "bytes": 37155,
          "sha256": "68b97095c521fcb3fab7193e166870b0c040c8f19ac50efb42088364862503a7"
        },
        {
          "path": "python/include/python3.12/objimpl.h",
          "bytes": 9238,
          "sha256": "8828a8db3e9f14b5ca2d59b1d8c05f6bf54fae26736ae039b7420c886142dba2"
        },
        {
          "path": "python/include/python3.12/opcode.h",
          "bytes": 12808,
          "sha256": "4e8c6eee859813845b3a9dfe9e08ca4cc607a7f884048f5a6cebef6bdcc5d33d"
        },
        {
          "path": "python/include/python3.12/osdefs.h",
          "bytes": 737,
          "sha256": "8372e9c507949a88ed3cad5fd0a830190d60a1655e9a3f59ef4d0832c06a041c"
        },
        {
          "path": "python/include/python3.12/osmodule.h",
          "bytes": 291,
          "sha256": "c013935b48f48ca8ce249a4d482c55e3fb6f1cfe786c5a32a57969bb74a779d9"
        },
        {
          "path": "python/include/python3.12/patchlevel.h",
          "bytes": 1301,
          "sha256": "66ff726e200a2eba15cfedee752bf6a59e20d6741a7c45f7a2c424dea649f473"
        },
        {
          "path": "python/include/python3.12/py_curses.h",
          "bytes": 2473,
          "sha256": "1aa826cacb9f07611155906d711403a7675ce573d61c888786178bb574dc3087"
        },
        {
          "path": "python/include/python3.12/pybuffer.h",
          "bytes": 5282,
          "sha256": "c95edd830772e922f60f976ac0d98470b48a443ba198b0866a4096003c0740a4"
        },
        {
          "path": "python/include/python3.12/pycapsule.h",
          "bytes": 1727,
          "sha256": "6929a47483ea5bb1a7b9b490a876b21beefed11061c94b2963b2608b7f542728"
        },
        {
          "path": "python/include/python3.12/pyconfig.h",
          "bytes": 56114,
          "sha256": "04612b368816a50a8a4213b8ee6d50bc2b517fb7287ed1f2f88eefe98e8b9812"
        },
        {
          "path": "python/include/python3.12/pydtrace.h",
          "bytes": 2404,
          "sha256": "7ac591e56e12936a32e3b0b85dae803f8f00bdc91abe01799ca2e4ce69548555"
        },
        {
          "path": "python/include/python3.12/pyerrors.h",
          "bytes": 13017,
          "sha256": "59bf06c7ba877ec76d09a41aac75e385a2723545388b105864f48f295e2524e0"
        },
        {
          "path": "python/include/python3.12/pyexpat.h",
          "bytes": 3295,
          "sha256": "d3564a35c027eb7a0e4ddbf8659769bf4be61b0c39666c79c555249fa8b0d099"
        },
        {
          "path": "python/include/python3.12/pyframe.h",
          "bytes": 551,
          "sha256": "58513e7017805ee5c49a329a552f72a6be6d88ce2bcfa344f5130582fa75ecb6"
        },
        {
          "path": "python/include/python3.12/pyhash.h",
          "bytes": 4252,
          "sha256": "a6bfc2bdb7d20abd9ee39d1a4ded6308632bf5d7534683d4032e4b7de2d8b355"
        },
        {
          "path": "python/include/python3.12/pylifecycle.h",
          "bytes": 2249,
          "sha256": "d313c5f3fe805606061ea78982ca5d5a9f09e687210c8b0fbcb50db596106691"
        },
        {
          "path": "python/include/python3.12/pymacconfig.h",
          "bytes": 2810,
          "sha256": "5dcd4fa505975be42c35a4707ab7cb5b6ddf2e896bb8fbb8c1fd9047e5183a3d"
        },
        {
          "path": "python/include/python3.12/pymacro.h",
          "bytes": 6656,
          "sha256": "c82a7ed12ffe85aa119e917a486a388cb0fc345719a7330bf1e2951d2d4f5282"
        },
        {
          "path": "python/include/python3.12/pymath.h",
          "bytes": 1688,
          "sha256": "eeea8396e1acd271ba83a568ba572ead47493e492ce998756fe1256bf917b3f9"
        },
        {
          "path": "python/include/python3.12/pymem.h",
          "bytes": 3914,
          "sha256": "54a5315d7861e989c5099f168d946f5a421337efcd5d44896201016e92a81348"
        },
        {
          "path": "python/include/python3.12/pyport.h",
          "bytes": 25593,
          "sha256": "1cb92172d631c9176c32caec8a330c74a544e4a5a2f1e82c15b0f2411fb87bb7"
        },
        {
          "path": "python/include/python3.12/pystate.h",
          "bytes": 4635,
          "sha256": "065426aaa5fada90d61a17757fbc2e8ce3fb9cc203992990c4ca3cee7f9f80be"
        },
        {
          "path": "python/include/python3.12/pystats.h",
          "bytes": 2741,
          "sha256": "b93db83e29f09ff06b15bf39a21e53de82858ba92cbf48332d1ada1ac028d6f8"
        },
        {
          "path": "python/include/python3.12/pystrcmp.h",
          "bytes": 436,
          "sha256": "f401d8338fb6ecf5f12768ee95cd09c262f880b2ee522ca344b890dbdcde4c88"
        },
        {
          "path": "python/include/python3.12/pystrtod.h",
          "bytes": 1557,
          "sha256": "8c8e9d1d279216f1c08f0aedac5de49a9b8852a3f838f21e298300e969474ef4"
        },
        {
          "path": "python/include/python3.12/Python.h",
          "bytes": 2854,
          "sha256": "729ef157f6026e6e1b3104593f87dddc597c3b83b60c7c2965878c62a56c6f7d"
        },
        {
          "path": "python/include/python3.12/pythonrun.h",
          "bytes": 1313,
          "sha256": "4749ef95e910632a1d04b912c4f1d615c9d10567cbaf52a2ab2c68c7c3a38d94"
        },
        {
          "path": "python/include/python3.12/pythread.h",
          "bytes": 4875,
          "sha256": "cd063073710988ea21b54588473542e5f3b2be06f637dc5a028aefd5a7949144"
        },
        {
          "path": "python/include/python3.12/pytypedefs.h",
          "bytes": 851,
          "sha256": "26d09a78c44998e8c0a74ed2d14e5346e4b922892eb79288049b7ac5b6a1e751"
        },
        {
          "path": "python/include/python3.12/rangeobject.h",
          "bytes": 630,
          "sha256": "36547ab5862e82b09cbed7b786a4cfc86af1dec5a3778c50825bb266c9a6aec9"
        },
        {
          "path": "python/include/python3.12/setobject.h",
          "bytes": 1557,
          "sha256": "7ff1b984647598b19ff593b0fa40d44cf5d7bc37d386dd9fac059e560f4a31ca"
        },
        {
          "path": "python/include/python3.12/sliceobject.h",
          "bytes": 2518,
          "sha256": "527719b92e4fa9d5b371c30bc87bc0304ec20099b18c446ad1aa49fd61e5e387"
        },
        {
          "path": "python/include/python3.12/structmember.h",
          "bytes": 1645,
          "sha256": "9d4c39dee96e228f60cc8a6960b9e7049875ddbee15541a75629c07777916342"
        },
        {
          "path": "python/include/python3.12/structseq.h",
          "bytes": 1398,
          "sha256": "067f8663a922eb142a3fd12ff18eaa756553bef8a68eaa863f80419dbb8d1ffe"
        },
        {
          "path": "python/include/python3.12/sysmodule.h",
          "bytes": 1729,
          "sha256": "09b6f415d4054fee4eb8375a94a724e102bc9a40633d16a437960671b1a9a1b4"
        },
        {
          "path": "python/include/python3.12/traceback.h",
          "bytes": 585,
          "sha256": "ea59d511687f7f8643c7b8b0996e26f2c92bcc954639c6f98d08f6564b61d06d"
        },
        {
          "path": "python/include/python3.12/tracemalloc.h",
          "bytes": 2285,
          "sha256": "1f40865be2187f8a532d01ac70bfd874848d63ab777ba38251ea1c445f7fced9"
        },
        {
          "path": "python/include/python3.12/tupleobject.h",
          "bytes": 1615,
          "sha256": "d8de8d64e4b5c466c3bdd04f5664f0eba64a9198b30b5a29409d74a5b5f1def7"
        },
        {
          "path": "python/include/python3.12/typeslots.h",
          "bytes": 2342,
          "sha256": "77fe4a71f5e5974c40fd3485d3c9aeb8b7ccf33969cd26feb58c64eda5f86f1d"
        },
        {
          "path": "python/include/python3.12/unicodeobject.h",
          "bytes": 35164,
          "sha256": "5cc1350da2b00f5187065004a1f5d66764e86a0f20f8faba7d0eadf913297d93"
        },
        {
          "path": "python/include/python3.12/warnings.h",
          "bytes": 1129,
          "sha256": "18fde34b12247460de805fc259ea7f14305fce4779d244c0a7bdc7c73b8f6b51"
        },
        {
          "path": "python/include/python3.12/weakrefobject.h",
          "bytes": 1234,
          "sha256": "031b4bc091cf442b4305f7c5ac9713f32101a5e40617f3cb56c632cb7b15fb5b"
        },
        {
          "path": "python/lib/itcl4.3.8/itcl.tcl",
          "bytes": 5162,
          "sha256": "75db5e1e5695215a6cf0b8bd241c984b575c4493747eef9a8c307513ca7832c4"
        },
        {
          "path": "python/lib/itcl4.3.8/itclConfig.sh",
          "bytes": 3072,
          "sha256": "6475bd7b3470deadd38c4c691581860226ddb8b40b073043e999f050aaf5c640"
        },
        {
          "path": "python/lib/itcl4.3.8/itclHullCmds.tcl",
          "bytes": 19377,
          "sha256": "015378168f4431e23ef8df19ff4f03d1e772a91b02e625e584da257d4ae6fad3"
        },
        {
          "path": "python/lib/itcl4.3.8/itclWidget.tcl",
          "bytes": 12113,
          "sha256": "cfe9a5eb616e1a8d5c97d5ff1ebdd6a69e0a033c6b9b05a8ce371f41edd38c92"
        },
        {
          "path": "python/lib/itcl4.3.8/libitcl4.3.8.dylib",
          "bytes": 299856,
          "sha256": "aee2341883cd009dc6f06ba289d0591b2f0c1c8bda8f0790683d0eb94b0dd270"
        },
        {
          "path": "python/lib/itcl4.3.8/libitclstub.a",
          "bytes": 1840,
          "sha256": "9427be6597438b914fd1778984a46dcdcce4ecca38094491f2594b463acdb95c"
        },
        {
          "path": "python/lib/itcl4.3.8/libitclstub4.3.8.a",
          "bytes": 1840,
          "sha256": "9427be6597438b914fd1778984a46dcdcce4ecca38094491f2594b463acdb95c"
        },
        {
          "path": "python/lib/itcl4.3.8/libtcl9itcl4.3.8.dylib",
          "bytes": 300224,
          "sha256": "819c2e28780cd16ab4747f4dd068ad94f07408b89920820c7b9bc4670dba1df3"
        },
        {
          "path": "python/lib/itcl4.3.8/pkgIndex.tcl",
          "bytes": 441,
          "sha256": "90a59fed78e87097f37c391e2c6803b44a67c4221a9d89c3c459892ed6798dbe"
        },
        {
          "path": "python/lib/libpython3.12.dylib",
          "bytes": 18066352,
          "sha256": "6dc5ae8f35934e05c135f9072ab005586873e95cd5cdeed67ce725753890230a",
          "executable": true
        },
        {
          "path": "python/lib/libtcl9.0.dylib",
          "bytes": 2040560,
          "sha256": "6040e117926e34ea64cbef2e5cb0b3bb414bfef22e229bed84ca881a5bb4969b",
          "executable": true
        },
        {
          "path": "python/lib/libtcl9tk9.0.dylib",
          "bytes": 1839968,
          "sha256": "7f511b47e49010bbca24fc13033152fb91e35e6d6283ce054e81f868829d9ce1",
          "executable": true
        },
        {
          "path": "python/lib/pkgconfig/python-3.12-embed.pc",
          "bytes": 321,
          "sha256": "2cf793203fe4379336bea855c76bb74f15a866f9f6df007ca28439534fae0267"
        },
        {
          "path": "python/lib/pkgconfig/python-3.12.pc",
          "bytes": 307,
          "sha256": "fe4f913a3bf44f5b22bebf6d7a579e520fcce093801947d738856751b7c5297a"
        },
        {
          "path": "python/lib/pkgconfig/python3-embed.pc",
          "bytes": 321,
          "sha256": "2cf793203fe4379336bea855c76bb74f15a866f9f6df007ca28439534fae0267"
        },
        {
          "path": "python/lib/pkgconfig/python3.pc",
          "bytes": 307,
          "sha256": "fe4f913a3bf44f5b22bebf6d7a579e520fcce093801947d738856751b7c5297a"
        },
        {
          "path": "python/lib/python3.12/__future__.py",
          "bytes": 5218,
          "sha256": "981d4c398849f9ebcab72300d9c1fe288fd6d7f28957b3b3fa3a493a5836d95c"
        },
        {
          "path": "python/lib/python3.12/__hello__.py",
          "bytes": 227,
          "sha256": "a8ce70b199497950f0f06def93115a6814daf1f961934457f59046909901487f"
        },
        {
          "path": "python/lib/python3.12/__phello__/__init__.py",
          "bytes": 97,
          "sha256": "56f7ed595e767c558ded05def14b682893105daf504500c3443b458ca2431bc6"
        },
        {
          "path": "python/lib/python3.12/__phello__/spam.py",
          "bytes": 97,
          "sha256": "56f7ed595e767c558ded05def14b682893105daf504500c3443b458ca2431bc6"
        },
        {
          "path": "python/lib/python3.12/__pycache__/__future__.cpython-312.pyc",
          "bytes": 4766,
          "sha256": "065cbc3929dec8fecefd11e94572fc0181ce76600ac14493ef3b45a1740d00d8"
        },
        {
          "path": "python/lib/python3.12/__pycache__/_compat_pickle.cpython-312.pyc",
          "bytes": 7261,
          "sha256": "ae0f51eade27755098bf26b68ea97f7dc09a9f641321c876c4280431ce0093fc"
        },
        {
          "path": "python/lib/python3.12/__pycache__/_compression.cpython-312.pyc",
          "bytes": 7557,
          "sha256": "c3e23b1a5a343f090d3c812ecbde85dc01f7f3e1046e3159a1f5bb97a5092890"
        },
        {
          "path": "python/lib/python3.12/__pycache__/_markupbase.cpython-312.pyc",
          "bytes": 12341,
          "sha256": "2b5f78213ba99c499c15d20521fb49672b513a81d4d43eacbeff67beb3d87d94"
        },
        {
          "path": "python/lib/python3.12/__pycache__/_osx_support.cpython-312.pyc",
          "bytes": 17756,
          "sha256": "ae02d73c9850b52d206a548305552cfee00c69b0c3b8e85e05a229c086285ecf"
        },
        {
          "path": "python/lib/python3.12/__pycache__/_sysconfigdata__darwin_darwin.cpython-312.pyc",
          "bytes": 62178,
          "sha256": "e216d6266f9068b03fe775f4a2418ef05a38327ef662ed0bd06718bda7e903ea"
        },
        {
          "path": "python/lib/python3.12/__pycache__/_weakrefset.cpython-312.pyc",
          "bytes": 11816,
          "sha256": "858da9ce5b3aade467dabfd541fa805037baa34670b90a656f4c2aaab304d272"
        },
        {
          "path": "python/lib/python3.12/__pycache__/argparse.cpython-312.pyc",
          "bytes": 101117,
          "sha256": "1ce11aa079bd082107edfd5657525a33989290942f17c397f47e795327580fda"
        },
        {
          "path": "python/lib/python3.12/__pycache__/ast.cpython-312.pyc",
          "bytes": 99813,
          "sha256": "867ec13ee77c3f45c1865d295c746ee1a47e6f120347c2db5b67f55d3a0768c5"
        },
        {
          "path": "python/lib/python3.12/__pycache__/base64.cpython-312.pyc",
          "bytes": 24476,
          "sha256": "f801997902544b48d352d6f106f7a0729cdd57884eed91d70318d85656a8d2b1"
        },
        {
          "path": "python/lib/python3.12/__pycache__/bisect.cpython-312.pyc",
          "bytes": 3720,
          "sha256": "18d6526ce12ffcce5dcf9657600a4e7c9e569a1b5ccfd2a27b214b5ecb0d5a54"
        },
        {
          "path": "python/lib/python3.12/__pycache__/bz2.cpython-312.pyc",
          "bytes": 15212,
          "sha256": "83f9f6ad17d3f621ae77106ed5fef5ac70ffb1874c55c122aba80ee3fa0b4a79"
        },
        {
          "path": "python/lib/python3.12/__pycache__/calendar.cpython-312.pyc",
          "bytes": 39964,
          "sha256": "551de48810360a1695929842ef7914d168220c84bd4a92bf03287be8c128ff46"
        },
        {
          "path": "python/lib/python3.12/__pycache__/colorsys.cpython-312.pyc",
          "bytes": 4704,
          "sha256": "306415347a0ab4d4bda4382486f1552c31a025641141fb1480ee8f8716c1c09f"
        },
        {
          "path": "python/lib/python3.12/__pycache__/compileall.cpython-312.pyc",
          "bytes": 20409,
          "sha256": "5f421d353ee968e597c575185ba43df43b944512e632cb90d46319b3432079f2"
        },
        {
          "path": "python/lib/python3.12/__pycache__/configparser.cpython-312.pyc",
          "bytes": 63925,
          "sha256": "65b42c225cc26fb3a0e83da7acbbee1eb64c3546817b1b7dd343c68cab0e5cc4"
        },
        {
          "path": "python/lib/python3.12/__pycache__/contextlib.cpython-312.pyc",
          "bytes": 30429,
          "sha256": "4861a3e24a1274d0e12905e920544bfc82e8b70d297e3fc293d19b840a586889"
        },
        {
          "path": "python/lib/python3.12/__pycache__/copy.cpython-312.pyc",
          "bytes": 9819,
          "sha256": "a811dc8c392dd3e9a085a676f508fbba65b1d225f8a70828a45eb2601b43218d"
        },
        {
          "path": "python/lib/python3.12/__pycache__/copyreg.cpython-312.pyc",
          "bytes": 7478,
          "sha256": "f4f49530e1ff765271019abc5f7059de6fd3eeff1d28c438522e44ed82702194"
        },
        {
          "path": "python/lib/python3.12/__pycache__/csv.cpython-312.pyc",
          "bytes": 18362,
          "sha256": "c0ad8dbd57945a8ef8eb013b00879924865c97423ed89aa78b447326444b9d80"
        },
        {
          "path": "python/lib/python3.12/__pycache__/dataclasses.cpython-312.pyc",
          "bytes": 44953,
          "sha256": "78186a106a785af330ad4cf84a7aa002624a2ee070f0a726ba756486d9278bdb"
        },
        {
          "path": "python/lib/python3.12/__pycache__/datetime.cpython-312.pyc",
          "bytes": 488,
          "sha256": "e151bf49a3f90737da946bf69fec0a593f4730b383112b7d15149bb254478472"
        },
        {
          "path": "python/lib/python3.12/__pycache__/decimal.cpython-312.pyc",
          "bytes": 2993,
          "sha256": "6ea4074d011b75582f65fbf46d55ca1cd46f6d99aa9c9c8f34d63c70956d8c10"
        },
        {
          "path": "python/lib/python3.12/__pycache__/dis.cpython-312.pyc",
          "bytes": 34520,
          "sha256": "6daa2056f5080aff57b3142bb66bcc3c017272b4318ba1ce211e089e9fd9f2e8"
        },
        {
          "path": "python/lib/python3.12/__pycache__/enum.cpython-312.pyc",
          "bytes": 80423,
          "sha256": "6150b422d29a10d4141d57d2c1c97d5af9c3bc23c287f26571abdb0c3603b63a"
        },
        {
          "path": "python/lib/python3.12/__pycache__/filecmp.cpython-312.pyc",
          "bytes": 14727,
          "sha256": "b4141c85c05760596ff0436c1c7b96aec848a145a34225c67570d13f77c4c2f0"
        },
        {
          "path": "python/lib/python3.12/__pycache__/fnmatch.cpython-312.pyc",
          "bytes": 6559,
          "sha256": "b349ab8dd97f16355e1e61bbac8a1913e6579b463b323ea5eb5b3309a6a8f225"
        },
        {
          "path": "python/lib/python3.12/__pycache__/fractions.cpython-312.pyc",
          "bytes": 36817,
          "sha256": "7b7ba88727c56adc9ffe724087572bdb879a6291ced48e8ae98c43022a0691a5"
        },
        {
          "path": "python/lib/python3.12/__pycache__/functools.cpython-312.pyc",
          "bytes": 40421,
          "sha256": "6ea84310141a77beff6b855868931c0299a3cace3114912fc02d2760587fefbb"
        },
        {
          "path": "python/lib/python3.12/__pycache__/getopt.cpython-312.pyc",
          "bytes": 8421,
          "sha256": "11290ee0f9438572cd08010666735b8856db9fa7c0983fa979627489d24db717"
        },
        {
          "path": "python/lib/python3.12/__pycache__/getpass.cpython-312.pyc",
          "bytes": 6893,
          "sha256": "45555c16c293b78be3f219297fa323a0e7656ad46095284e2502761ae1290c38"
        },
        {
          "path": "python/lib/python3.12/__pycache__/gettext.cpython-312.pyc",
          "bytes": 21845,
          "sha256": "32860bb5ac91b360d614a19f48667f57eff0bc8d21087018d442fe9430df9b72"
        },
        {
          "path": "python/lib/python3.12/__pycache__/glob.cpython-312.pyc",
          "bytes": 9863,
          "sha256": "d30d7bb103dd237c07a487582e1f3bc25f6e4c3e48063953167d62e553413a71"
        },
        {
          "path": "python/lib/python3.12/__pycache__/gzip.cpython-312.pyc",
          "bytes": 32415,
          "sha256": "53b00d5e1e3d7dbe5a80286458c3bcdba376101e74cb72b37d6930b0f097483e"
        },
        {
          "path": "python/lib/python3.12/__pycache__/hashlib.cpython-312.pyc",
          "bytes": 8142,
          "sha256": "02e642b982f7d6710e54d858d6b2e1fb5b75d82208183f38a28777bdde993304"
        },
        {
          "path": "python/lib/python3.12/__pycache__/heapq.cpython-312.pyc",
          "bytes": 18000,
          "sha256": "a61e9059586a7422f0b107ee7634a7ba416cbb8b62c78844165d737f812d9a42"
        },
        {
          "path": "python/lib/python3.12/__pycache__/hmac.cpython-312.pyc",
          "bytes": 10753,
          "sha256": "56eb47bd81261f25de21b02eff59541474bfb86cc14987209b4f8bd06b1dda56"
        },
        {
          "path": "python/lib/python3.12/__pycache__/inspect.cpython-312.pyc",
          "bytes": 134442,
          "sha256": "8eb73945460cb351dec59b4de61ea425b50d8eda4f0cbcc3b0f0b95916150fab"
        },
        {
          "path": "python/lib/python3.12/__pycache__/ipaddress.cpython-312.pyc",
          "bytes": 93855,
          "sha256": "64e8cc184e5fa5a0dff49a25d9eb4d90f855ac7bfb0e534133db8df111e6f6fe"
        },
        {
          "path": "python/lib/python3.12/__pycache__/keyword.cpython-312.pyc",
          "bytes": 1120,
          "sha256": "e049c5b9f9ee15ac58f9b4222ecdec7c258963ff13f322875d4403f05e8dd701"
        },
        {
          "path": "python/lib/python3.12/__pycache__/linecache.cpython-312.pyc",
          "bytes": 6628,
          "sha256": "fb72726e4f4eaeeefde80e1d8bb29f66e06d0ec581147abcd783a17972c49883"
        },
        {
          "path": "python/lib/python3.12/__pycache__/locale.cpython-312.pyc",
          "bytes": 59567,
          "sha256": "c4eccd00ec98c18deec5982e70532266f652945190b29d6a7185acce51586803"
        },
        {
          "path": "python/lib/python3.12/__pycache__/lzma.cpython-312.pyc",
          "bytes": 15934,
          "sha256": "aec7f8c4b0e487e0add8f050c3c353526e3d5db3b934e0e4b572c876e81a14d0"
        },
        {
          "path": "python/lib/python3.12/__pycache__/mimetypes.cpython-312.pyc",
          "bytes": 24508,
          "sha256": "5c11e0203018260e17715bb5d1e5f1851176dc4904f3c9be4505adf9f65a9222"
        },
        {
          "path": "python/lib/python3.12/__pycache__/netrc.cpython-312.pyc",
          "bytes": 8917,
          "sha256": "80058691354d33f2843d7263798c0c2058dff80e01a2a7a8f8be34b691fdc060"
        },
        {
          "path": "python/lib/python3.12/__pycache__/numbers.cpython-312.pyc",
          "bytes": 14029,
          "sha256": "b6fc33ff96cc1af07719b3f208875e27a70be61b2ff9c24a7dd2b541c263368b"
        },
        {
          "path": "python/lib/python3.12/__pycache__/opcode.cpython-312.pyc",
          "bytes": 14795,
          "sha256": "0f0e7bcf45130dbfec93cfddbd9a73770033f0e8d371b07082d9d02b0cb0ee61"
        },
        {
          "path": "python/lib/python3.12/__pycache__/operator.cpython-312.pyc",
          "bytes": 17431,
          "sha256": "c2da408e842ae12d50eda5311c6e37e01c1de191d5fc28c8b937db76c3a96ce5"
        },
        {
          "path": "python/lib/python3.12/__pycache__/optparse.cpython-312.pyc",
          "bytes": 67503,
          "sha256": "541b27d292aadb7b5137285d78b963aaffefdf8b0aa8904ddfafce277eae5adb"
        },
        {
          "path": "python/lib/python3.12/__pycache__/pathlib.cpython-312.pyc",
          "bytes": 61777,
          "sha256": "7b44f83796f894396e29456648dce814f2dd6bef0d2f13458395db89fb5a3505"
        },
        {
          "path": "python/lib/python3.12/__pycache__/pickle.cpython-312.pyc",
          "bytes": 77776,
          "sha256": "0a3c287ef17fd98a29dda4a5dca68ce47bd8caf64de0b3beef69f952e364b97d"
        },
        {
          "path": "python/lib/python3.12/__pycache__/pkgutil.cpython-312.pyc",
          "bytes": 19949,
          "sha256": "98ed90079d5822e59aaf1e83efa9d582d2d0c468df0916b53e8bc5c9141378aa"
        },
        {
          "path": "python/lib/python3.12/__pycache__/platform.cpython-312.pyc",
          "bytes": 41641,
          "sha256": "ca083c5875dc31658a5924ba6ea3dbfb3d6ec8ad1bcba190c6d67560f8855122"
        },
        {
          "path": "python/lib/python3.12/__pycache__/plistlib.cpython-312.pyc",
          "bytes": 41274,
          "sha256": "24ed9283a990bf16d2002bba5254de86568714d6ba0017b6062be3d89ad3c2a8"
        },
        {
          "path": "python/lib/python3.12/__pycache__/py_compile.cpython-312.pyc",
          "bytes": 10090,
          "sha256": "d3b9562c0055ec55323cad8a3f6d94019eca980ab652bd1373451468a3379c03"
        },
        {
          "path": "python/lib/python3.12/__pycache__/queue.cpython-312.pyc",
          "bytes": 14721,
          "sha256": "42942c392e627443ce0bebab5ae3d70c3733e8f4fa239c0b9d927c624ca535f1"
        },
        {
          "path": "python/lib/python3.12/__pycache__/quopri.cpython-312.pyc",
          "bytes": 9365,
          "sha256": "5cbea04d7ded075a818068407e865af712e4793398c480a841158aa53215f4a5"
        },
        {
          "path": "python/lib/python3.12/__pycache__/random.cpython-312.pyc",
          "bytes": 33224,
          "sha256": "03ae5c671a4439ebb19c0175c956c9859e2c24a1cf4770535657fc73822640af"
        },
        {
          "path": "python/lib/python3.12/__pycache__/reprlib.cpython-312.pyc",
          "bytes": 10305,
          "sha256": "b7ee0128d1d2a0f9c9554d8969819bb7a0a3f6d5d1245df0f5a19bfa202abb0b"
        },
        {
          "path": "python/lib/python3.12/__pycache__/selectors.cpython-312.pyc",
          "bytes": 26182,
          "sha256": "627f8d26747b10ac62e3fe4591797b1de2fef0a248323c88e784cfd8b9f88a3f"
        },
        {
          "path": "python/lib/python3.12/__pycache__/shlex.cpython-312.pyc",
          "bytes": 14231,
          "sha256": "db39a1e40e581768f93d62124cef0ef7b158b1f02c81eaa9ef132b4315c74086"
        },
        {
          "path": "python/lib/python3.12/__pycache__/shutil.cpython-312.pyc",
          "bytes": 65394,
          "sha256": "242a4b03313f765308be7d5c9ce3dadf59142c21a5b420c79b5c079335d34959"
        },
        {
          "path": "python/lib/python3.12/__pycache__/signal.cpython-312.pyc",
          "bytes": 4536,
          "sha256": "5ea5736d8bcd12be795868870e0b905a370d5168a683300ef6d33d38e1d70671"
        },
        {
          "path": "python/lib/python3.12/__pycache__/socket.cpython-312.pyc",
          "bytes": 42024,
          "sha256": "e152656595e78b0723b2ea171c64a2779e2b1922e110faf79b0d5530795e3d10"
        },
        {
          "path": "python/lib/python3.12/__pycache__/socketserver.cpython-312.pyc",
          "bytes": 34419,
          "sha256": "296cfcf2b42826a99ebaa258e7a8d534fb2b72753994057b2ed492d9058b013f"
        },
        {
          "path": "python/lib/python3.12/__pycache__/ssl.cpython-312.pyc",
          "bytes": 64137,
          "sha256": "af280a21fe5f988418c234f775ad5d89cd3f3f08228e260b86aab256eda7f409"
        },
        {
          "path": "python/lib/python3.12/__pycache__/string.cpython-312.pyc",
          "bytes": 11541,
          "sha256": "f841af616e1d5e9cadd457d1da27b7d0c4abcca6ac8ff334fbb833d0e12a36b5"
        },
        {
          "path": "python/lib/python3.12/__pycache__/stringprep.cpython-312.pyc",
          "bytes": 25226,
          "sha256": "db4ad1b834fd76ebe5041b748e66e2311ae4ec0572bf1e9c24e787f8d7fcd295"
        },
        {
          "path": "python/lib/python3.12/__pycache__/struct.cpython-312.pyc",
          "bytes": 404,
          "sha256": "f3224b397be9beaf41f23aecfdd07d517646ec3d354058388b61b0c52528de30"
        },
        {
          "path": "python/lib/python3.12/__pycache__/subprocess.cpython-312.pyc",
          "bytes": 79133,
          "sha256": "6963bd813cb5c27f15d1edad11fcdcb96e48a0e70d689f80d067b5d2d19e463b"
        },
        {
          "path": "python/lib/python3.12/__pycache__/sysconfig.cpython-312.pyc",
          "bytes": 29505,
          "sha256": "eb8bdbbdec575635d760f96c33fed1187be8531b4bdb2fc14095e60dde9156bc"
        },
        {
          "path": "python/lib/python3.12/__pycache__/tarfile.cpython-312.pyc",
          "bytes": 124644,
          "sha256": "9f87fa1c2b2ba27841e359fa74807217fcf3e7d2179cd27266314f0c189d914a"
        },
        {
          "path": "python/lib/python3.12/__pycache__/tempfile.cpython-312.pyc",
          "bytes": 40679,
          "sha256": "4ccb66aeff806452a321ca8bc55c2b6adbb81aca50ef5f8e50f99b196026ea69"
        },
        {
          "path": "python/lib/python3.12/__pycache__/textwrap.cpython-312.pyc",
          "bytes": 18359,
          "sha256": "a988a12a901611432e9359ffba0a907b1756fdd2a755eb3c50c51f68a17904de"
        },
        {
          "path": "python/lib/python3.12/__pycache__/threading.cpython-312.pyc",
          "bytes": 65295,
          "sha256": "10042bcfff5e77f0560c1f851b86bf65acbaf2533d2576fe276ca11f491ab41c"
        },
        {
          "path": "python/lib/python3.12/__pycache__/token.cpython-312.pyc",
          "bytes": 3648,
          "sha256": "5bb12ea7f0750d4ab364a9da1af5c08c9050ccc7474243bacea8bc29d3a099f1"
        },
        {
          "path": "python/lib/python3.12/__pycache__/tokenize.cpython-312.pyc",
          "bytes": 25455,
          "sha256": "27c100acc0bfdf59cfc141d4a084eb3cbd80b8e4ffb4a16aff9d275da1f4abe9"
        },
        {
          "path": "python/lib/python3.12/__pycache__/traceback.cpython-312.pyc",
          "bytes": 51546,
          "sha256": "7d8ced9c71ab499f3ba625fb52cd309cf74d0c9ec6159167dbd98844338cd543"
        },
        {
          "path": "python/lib/python3.12/__pycache__/types.cpython-312.pyc",
          "bytes": 15024,
          "sha256": "98ba777c0d1beb6a5210216028d0d972fd1bd2ff568beed2b864e09cdf66dc8f"
        },
        {
          "path": "python/lib/python3.12/__pycache__/typing.cpython-312.pyc",
          "bytes": 142465,
          "sha256": "8c43ef9f806dec0202c1586c1cc115b8d317d7511fdc8c9d28841d296a451923"
        },
        {
          "path": "python/lib/python3.12/__pycache__/uuid.cpython-312.pyc",
          "bytes": 33048,
          "sha256": "eab203f5ae62822161d6deff7bb599b2ec6c5be74a893ea4e3cf5eb92d496d28"
        },
        {
          "path": "python/lib/python3.12/__pycache__/warnings.cpython-312.pyc",
          "bytes": 23906,
          "sha256": "884c29f4720e24044d4c0b8dd966d888c581d60deb24a20d2a9be33e65ea84cc"
        },
        {
          "path": "python/lib/python3.12/__pycache__/weakref.cpython-312.pyc",
          "bytes": 31290,
          "sha256": "759dddddb1124d981d48d5289ed7c5523a7d7ad688b3f5748982ff51fa560faf"
        },
        {
          "path": "python/lib/python3.12/_aix_support.py",
          "bytes": 4021,
          "sha256": "0982f187c62fbfc1e8d368c8eb4104b56df71009a6b2823565a699e7b4cd945c"
        },
        {
          "path": "python/lib/python3.12/_collections_abc.py",
          "bytes": 32089,
          "sha256": "d4945c8410c4bab351741b04bca3de066f7c27ed7e38df89e206a96617102ffb"
        },
        {
          "path": "python/lib/python3.12/_compat_pickle.py",
          "bytes": 8761,
          "sha256": "12c8356a3d40bd0a336f13d7c6e2bed50d5c1a876563766a3175a6b328b5855e"
        },
        {
          "path": "python/lib/python3.12/_compression.py",
          "bytes": 5681,
          "sha256": "3ad5d60627477a60939ee44fc1bb3a05dbe8fb52f0f75039b8f5d8f1a278b981"
        },
        {
          "path": "python/lib/python3.12/_markupbase.py",
          "bytes": 14653,
          "sha256": "cb14dd6f2e2439eb70b806cd49d19911363d424c2b6b9f4b73c9c08022d47030"
        },
        {
          "path": "python/lib/python3.12/_osx_support.py",
          "bytes": 22023,
          "sha256": "363d3240acbba18a270bd3161f1ddb478f8492dc14fc451b2dc314db5c5ee09c"
        },
        {
          "path": "python/lib/python3.12/_py_abc.py",
          "bytes": 6189,
          "sha256": "f9c6fe3dd9b51bd7d93f867356e9d362600c924febfd903ee1c6e298860dca92"
        },
        {
          "path": "python/lib/python3.12/_pydatetime.py",
          "bytes": 92087,
          "sha256": "a03268abe53ccab406fa29cdfcf75b89f7f485d9e6523e00c448ff7a9961dd26"
        },
        {
          "path": "python/lib/python3.12/_pydecimal.py",
          "bytes": 227283,
          "sha256": "87a3372df4c4269adcdac5725e04675d306abcfa8d65e8dda59c1846e3d202ac"
        },
        {
          "path": "python/lib/python3.12/_pyio.py",
          "bytes": 93593,
          "sha256": "22a2730be3230802593c75c930387e635809c6d82420e5234ef8d9cd1166ac8d"
        },
        {
          "path": "python/lib/python3.12/_pylong.py",
          "bytes": 10790,
          "sha256": "05da132ba902633430bf12b5007fa1983630de423e29402998e9edc349bdf591"
        },
        {
          "path": "python/lib/python3.12/_sitebuiltins.py",
          "bytes": 3128,
          "sha256": "b9388bc1d6d12ed6be12da420ab1feca40f99c0e33ec315d92b1e01cb69b25bc"
        },
        {
          "path": "python/lib/python3.12/_strptime.py",
          "bytes": 28393,
          "sha256": "dcec0ad5efc41dd29fb125b477530ef22c70da117b59fa49cec39aae04e1f868"
        },
        {
          "path": "python/lib/python3.12/_sysconfigdata__darwin_darwin.py",
          "bytes": 49614,
          "sha256": "332227b9bd1ef9af924cf4e32ede391db7703862cd66286ebdd83957c8eb3f40"
        },
        {
          "path": "python/lib/python3.12/_threading_local.py",
          "bytes": 7220,
          "sha256": "e1bf3dae66d0bfa63c8bb8a1d10c611203c35c636f7f5191fd56105788ef29cb"
        },
        {
          "path": "python/lib/python3.12/_weakrefset.py",
          "bytes": 5893,
          "sha256": "91895a451d06e9f521a1171b31b9b19bc9740f35af00d4fa106338ab7167c9ac"
        },
        {
          "path": "python/lib/python3.12/abc.py",
          "bytes": 6538,
          "sha256": "e558702a95cdce3febd289da021715d2b92bc43995b8a1bc58dfa1c3d8010287"
        },
        {
          "path": "python/lib/python3.12/aifc.py",
          "bytes": 34211,
          "sha256": "e027e8a33567890ad7f84fea3be423cc0f6e49a33a31bbf279c2d0f64b6f8345"
        },
        {
          "path": "python/lib/python3.12/antigravity.py",
          "bytes": 500,
          "sha256": "8a5ee63e1b79ba2733e7ff4290b6eefea60e7f3a1ccb6bb519535aaf92b44967"
        },
        {
          "path": "python/lib/python3.12/argparse.py",
          "bytes": 101155,
          "sha256": "7cc582dcb3b76e2c957f78a3f74e9809d6c311d6aab7bcaa2c9954d0cbff5f30"
        },
        {
          "path": "python/lib/python3.12/ast.py",
          "bytes": 64452,
          "sha256": "b515c23dbbc459329d3b802a3aac742cc456d7472e66f7ed6e9dc97e40596d7d"
        },
        {
          "path": "python/lib/python3.12/asyncio/__init__.py",
          "bytes": 1220,
          "sha256": "61102f2b5f8fb832f0558cb66391f227970b3dd34ea2a621455587b4295e89a1"
        },
        {
          "path": "python/lib/python3.12/asyncio/__main__.py",
          "bytes": 3491,
          "sha256": "c1e67c3b5f5d964029b407e71397d9d93d8b545abde482ffb0eab02dd16ad820"
        },
        {
          "path": "python/lib/python3.12/asyncio/base_events.py",
          "bytes": 78567,
          "sha256": "53b71bbbd79e7fb2251460119afc379ebd71bbc599d9018313cc62ef218ae795"
        },
        {
          "path": "python/lib/python3.12/asyncio/base_futures.py",
          "bytes": 1974,
          "sha256": "2f3798c4b82f5ac77647908b157c924f734f36871d98970e72849ea9a9a07856"
        },
        {
          "path": "python/lib/python3.12/asyncio/base_subprocess.py",
          "bytes": 8869,
          "sha256": "d69ba8f97bf8c89564cadce49427574ddb98103a5db6f04b98798240332e7adf"
        },
        {
          "path": "python/lib/python3.12/asyncio/base_tasks.py",
          "bytes": 2672,
          "sha256": "56efac65b63db927af336fa55eb5bda93c97a2defa4734ea8d695ed20fd6712a"
        },
        {
          "path": "python/lib/python3.12/asyncio/constants.py",
          "bytes": 1413,
          "sha256": "873fc2f9e66313c3c19c337269e704f204b59f9e91d6ecbec59f68335484d338"
        },
        {
          "path": "python/lib/python3.12/asyncio/coroutines.py",
          "bytes": 3342,
          "sha256": "2feec17557c230a80cc2a6391bbb1c44b9f3341820b05667e36a4eb12b749436"
        },
        {
          "path": "python/lib/python3.12/asyncio/events.py",
          "bytes": 29339,
          "sha256": "6a18b7eee5926622c146e61a7eb39726b4656e07ca41d36b06936ffb2354f0ed"
        },
        {
          "path": "python/lib/python3.12/asyncio/exceptions.py",
          "bytes": 1752,
          "sha256": "a5971f88be14cd1417d59adf539ae48c5d818f95362a4e0eb00017e3690ab37b"
        },
        {
          "path": "python/lib/python3.12/asyncio/format_helpers.py",
          "bytes": 2404,
          "sha256": "6377b672b3f4ba8b6f0f7a5f0ea00cde24c8cddc0ca764e3329f302763477f59"
        },
        {
          "path": "python/lib/python3.12/asyncio/futures.py",
          "bytes": 14340,
          "sha256": "f6daaf2a051fc61ea146811d7d4b4db1cac31d7f4777aa4d10617812d78bd943"
        },
        {
          "path": "python/lib/python3.12/asyncio/locks.py",
          "bytes": 18995,
          "sha256": "5234295a0456e9a6ba2e80446848b602cd9195bca4fca2c711c6e3f41989cd86"
        },
        {
          "path": "python/lib/python3.12/asyncio/log.py",
          "bytes": 124,
          "sha256": "80e4cc3ded4b138baba486519e7444801a23d6ac35f229d336a407a96af7e8d2"
        },
        {
          "path": "python/lib/python3.12/asyncio/mixins.py",
          "bytes": 481,
          "sha256": "8f4a3e16eca845ebfba422550cbcee7340ec8166d2bff6b750a8ed0de6b9ae3c"
        },
        {
          "path": "python/lib/python3.12/asyncio/proactor_events.py",
          "bytes": 33500,
          "sha256": "62d15e99315cae52e8548f487391ae6c46827bf8e5b4bcf3382c777a494a759b"
        },
        {
          "path": "python/lib/python3.12/asyncio/protocols.py",
          "bytes": 6957,
          "sha256": "1d1b49988c338b4ef06e30f9e92d9db2e00080c341f0a3f573bb8312deb8aff6"
        },
        {
          "path": "python/lib/python3.12/asyncio/queues.py",
          "bytes": 7974,
          "sha256": "8f020744ebd1f557dcb051a1530b504447660df906c2127a94bbcc8450ea7ef9"
        },
        {
          "path": "python/lib/python3.12/asyncio/runners.py",
          "bytes": 7230,
          "sha256": "739e0ecbb335cfec821a39f9e225583b5911bb6e3894ef93782005f852c54263"
        },
        {
          "path": "python/lib/python3.12/asyncio/selector_events.py",
          "bytes": 48332,
          "sha256": "b77c4b8a85f1e1e2882a2bf3bd85a4b1c1fcfd7cb37ed0d8d8eb5f9a2ea44231"
        },
        {
          "path": "python/lib/python3.12/asyncio/sslproto.py",
          "bytes": 31899,
          "sha256": "6c7fa1b81dc41850281cbf284c99ca18e824939fa5778860327040f3a80f6218"
        },
        {
          "path": "python/lib/python3.12/asyncio/staggered.py",
          "bytes": 7077,
          "sha256": "3998d04fcff2c8052af03f3f34dbd3bd510b2dadddd5f2629a2c1cccbecd136d"
        },
        {
          "path": "python/lib/python3.12/asyncio/streams.py",
          "bytes": 27619,
          "sha256": "6ec5c70fd95b0d51cc1e81cd21e8abe8c1b69650148d6bb75ab4aa4797319bd4"
        },
        {
          "path": "python/lib/python3.12/asyncio/subprocess.py",
          "bytes": 7737,
          "sha256": "7b70605716334f63cc482123b2aaa3b7c5bb7138eeab63a037bd8068d43307c1"
        },
        {
          "path": "python/lib/python3.12/asyncio/taskgroups.py",
          "bytes": 9559,
          "sha256": "1d2bcd2da66524b45024841b94100cd6e7a7825a1b8f8ee125bf16b4ad0ca9bc"
        },
        {
          "path": "python/lib/python3.12/asyncio/tasks.py",
          "bytes": 37362,
          "sha256": "6f6aad82d597fea1800004075b9a2481604da0035f1143af1eb267823ec460e3"
        },
        {
          "path": "python/lib/python3.12/asyncio/threads.py",
          "bytes": 790,
          "sha256": "39d37295383641565f0c08bd992e2f661dc8051eb17e890b834fce96bde0910e"
        },
        {
          "path": "python/lib/python3.12/asyncio/timeouts.py",
          "bytes": 5321,
          "sha256": "3e40ca0dca3e54776579797837cd4936d73d04aae09fe0cf83ce1e5449d00163"
        },
        {
          "path": "python/lib/python3.12/asyncio/transports.py",
          "bytes": 10722,
          "sha256": "940108bc133de399f38928cad3274f463096168d8a3ee5148f2478d3cb636f1c"
        },
        {
          "path": "python/lib/python3.12/asyncio/trsock.py",
          "bytes": 2475,
          "sha256": "c0eac37debcc51b702b808f6b7ed3e417343f5ff5f57125dad600a27eb082328"
        },
        {
          "path": "python/lib/python3.12/asyncio/unix_events.py",
          "bytes": 53124,
          "sha256": "1fff06cce78763800f05f4d2bebfcdbc07ebf9564ca7e7222e0d91e39dee08c9"
        },
        {
          "path": "python/lib/python3.12/asyncio/windows_events.py",
          "bytes": 32587,
          "sha256": "163927e5834c10c6c106d81cf3cfd568fd1ced7fa34d857836447d3c4cc7a9d3"
        },
        {
          "path": "python/lib/python3.12/asyncio/windows_utils.py",
          "bytes": 5060,
          "sha256": "e6fcffefa2521666bc2aed0f5caf8e862c1c1014ad12d2ab5fbce09c2df9c6f0"
        },
        {
          "path": "python/lib/python3.12/base64.py",
          "bytes": 20635,
          "sha256": "8d1f608dbf030d11d6ec4df9e4c55b73fb68cdfbd9f53a7c91684a93b55564b5",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/bdb.py",
          "bytes": 33573,
          "sha256": "171ba6b07dc5d3b9f718f3890fedc97e1fe750e39855f4342d71514169ccc29a"
        },
        {
          "path": "python/lib/python3.12/bisect.py",
          "bytes": 3423,
          "sha256": "f1cf7b85fc36b5da249813fc5ab97d9464f8cc1bc817f7146206fa2713e35999"
        },
        {
          "path": "python/lib/python3.12/bz2.py",
          "bytes": 11847,
          "sha256": "76ab3252924e71e859d7d90e8d3db13b6554975cfcac0fdadced4de7f8779330"
        },
        {
          "path": "python/lib/python3.12/calendar.py",
          "bytes": 25864,
          "sha256": "0010004d32c694e4afa554db2434952040819c09c438e88d465dcf6d9fb63718"
        },
        {
          "path": "python/lib/python3.12/cgi.py",
          "bytes": 34479,
          "sha256": "a3fed254b9eb19e736b5c70da8056cadf6b276e57d0e95a0bae3793df38f3ee0",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/cgitb.py",
          "bytes": 12421,
          "sha256": "08bbcca13a431551da73a2144c13f21e68cb79ac82223fbe5e60fcf89ce10f9c"
        },
        {
          "path": "python/lib/python3.12/chunk.py",
          "bytes": 5500,
          "sha256": "4817eb94eeb8835c3325433f68f17e0ebbf7c96065ecf6aba3af7852f9a5314b"
        },
        {
          "path": "python/lib/python3.12/cmd.py",
          "bytes": 14873,
          "sha256": "fb82a8c4e44e5b559c88d516d79051534cec69a463df97defe05ac8a261f0a0d"
        },
        {
          "path": "python/lib/python3.12/code.py",
          "bytes": 10962,
          "sha256": "dab54e60985a3770782a7f031b6a80f91009c372465a09cdd1221b2ca03080eb"
        },
        {
          "path": "python/lib/python3.12/codecs.py",
          "bytes": 36870,
          "sha256": "7b7839e53a77961153240aecfe11edc8054d05b1dedd83894450dae21ec05785"
        },
        {
          "path": "python/lib/python3.12/codeop.py",
          "bytes": 5908,
          "sha256": "3fb545862a1f9030c0d8f1ae6c72457d14a26d67a9b45de455e49900ff84a3a9"
        },
        {
          "path": "python/lib/python3.12/collections/__init__.py",
          "bytes": 52378,
          "sha256": "7fdb04dd248ab37909f46d2085bfee56b32d7e91e49ad3a2fad99c453295659b"
        },
        {
          "path": "python/lib/python3.12/collections/__pycache__/__init__.cpython-312.pyc",
          "bytes": 73016,
          "sha256": "d1ed67ee0977c6f6d9698d85ae67241cd0c2b2e6fd9e243d6fe6546bd77a8fe0"
        },
        {
          "path": "python/lib/python3.12/collections/__pycache__/abc.cpython-312.pyc",
          "bytes": 328,
          "sha256": "66da4faa6a137f9b925cec9bf8d3544a40ef6960f64d92babe1e0a53a607d28b"
        },
        {
          "path": "python/lib/python3.12/collections/abc.py",
          "bytes": 119,
          "sha256": "9cb4208f99128a0489b6c8e6c61637617dd7d4250c59e065491957eda084dd10"
        },
        {
          "path": "python/lib/python3.12/colorsys.py",
          "bytes": 4062,
          "sha256": "65e3dfbf7bad61d4d7d7731a69dd7e75a347fd350d91327a51010a94e6fd2f1d"
        },
        {
          "path": "python/lib/python3.12/compileall.py",
          "bytes": 20507,
          "sha256": "588f003bb5088ce380f3c335febaec1318811d275e5554b106655c4ceebabcfb"
        },
        {
          "path": "python/lib/python3.12/concurrent/__init__.py",
          "bytes": 38,
          "sha256": "87ad5c8954dd56fbbca04517bf87477ff4dce575170c7dd1281d7ef1f4214ac8"
        },
        {
          "path": "python/lib/python3.12/concurrent/futures/__init__.py",
          "bytes": 1583,
          "sha256": "9b597f6de7da771109ca7bf96a1af5ea4d5fda69b27b39312d34966d987f73cd"
        },
        {
          "path": "python/lib/python3.12/concurrent/futures/_base.py",
          "bytes": 22833,
          "sha256": "8c6d5f09f7c535d40fa1c30ebfcb35e0601c2abf32286a82cf151af7ddf72473"
        },
        {
          "path": "python/lib/python3.12/concurrent/futures/process.py",
          "bytes": 35854,
          "sha256": "66b4fe880563a604ac4a094b72c6535b56b3bb8b14f4b6025705d53d28816fba"
        },
        {
          "path": "python/lib/python3.12/concurrent/futures/thread.py",
          "bytes": 8946,
          "sha256": "fe940a20adc4d3e66a8ea42a4c7e6c16957b011e8ada50c4e7a7bddbcbbffa0d"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/config.c",
          "bytes": 8257,
          "sha256": "08504bdc670d117ed3510331d851168307dff3a6f4ae007103966f79b7968c19"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/config.c.in",
          "bytes": 1752,
          "sha256": "5c76ef60a799f420b09b047dc1087728e5ed08ba82f6c7664c4d4f1d1d715b21"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/install-sh",
          "bytes": 15358,
          "sha256": "3d7488bebd0cfc9b5c440c55d5b44f1c6e2e3d3e19894821bae4a27f9307f1d2",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/Makefile",
          "bytes": 181912,
          "sha256": "04bdb16d960d69d2e7d85a748c284fdbe24ff55b03db802cde811fb4204b2987"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/makesetup",
          "bytes": 9312,
          "sha256": "0615264cbe9f3a4fce27de0054839ea814f2fe6f6091a0e17b18b5b15c665cfa",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/python-config.py",
          "bytes": 2100,
          "sha256": "2b10c2f47d035259835eab4c68c34b026184d52b548dbe6886911fa548648948",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/python.o",
          "bytes": 4992,
          "sha256": "43df253b77c9b7a28e469c5c1d35cee64f208fe937b5624075521f9ea64d2587"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/Setup",
          "bytes": 11525,
          "sha256": "17c83234ffe6302e7eaf62a363571fe6cc240b8b97bed7e503b85429fd10a5ca"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/Setup.bootstrap",
          "bytes": 902,
          "sha256": "2917936af36bd7d641c737f72f68599fd13c26a28faebba7c07799879b1b9b31"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/Setup.local",
          "bytes": 903,
          "sha256": "dc7c6e43f7b2b235ad6c52ee715c2192e2bd1b5c24b6b6d3e4c6c35b3dfd9a8b"
        },
        {
          "path": "python/lib/python3.12/config-3.12-darwin/Setup.stdlib",
          "bytes": 6343,
          "sha256": "15b3eea469139893928bcae8d29425d86f31d19ce3495210c3ec397764b8e099"
        },
        {
          "path": "python/lib/python3.12/configparser.py",
          "bytes": 54205,
          "sha256": "cf5318e0c45a2e206b4ec74d4d66493185ed26c3736a86b0ebdf8f3a3e365a1a"
        },
        {
          "path": "python/lib/python3.12/contextlib.py",
          "bytes": 27637,
          "sha256": "8b7a477f978a8532852fd81e241c78182516bc4975d672d580a5848a76e11eb6"
        },
        {
          "path": "python/lib/python3.12/contextvars.py",
          "bytes": 129,
          "sha256": "5ed260be8d1f4fe92261b7810b4bb1e8539c42093d7493f677d076e1a87f459a"
        },
        {
          "path": "python/lib/python3.12/copy.py",
          "bytes": 8412,
          "sha256": "cbd25547933176fcf6bb05c2adc9f4796d15ac20b9b82dcf890daea7203daeab"
        },
        {
          "path": "python/lib/python3.12/copyreg.py",
          "bytes": 7614,
          "sha256": "c8eda41f05c6bf95a4da4726a530409d2485ae060b8d019b3a8034389a15d3e9"
        },
        {
          "path": "python/lib/python3.12/cProfile.py",
          "bytes": 6556,
          "sha256": "c4c3edb84862431dffd6c044f5c02bb27f94e5b79a708bce195a7981efcb43bc",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/crypt.py",
          "bytes": 3913,
          "sha256": "208df2ff33c19056345dcf5474abef1a58da799e2f3bab09d1d28b77ad3c623d"
        },
        {
          "path": "python/lib/python3.12/csv.py",
          "bytes": 17132,
          "sha256": "2fd2a39ec59a5cbcd71596a93205001e593c65dc2ca3bef6028f148372028a88"
        },
        {
          "path": "python/lib/python3.12/ctypes/__init__.py",
          "bytes": 18268,
          "sha256": "e048845f8f5c14a5fc873526a27da4a19d4eed25ab2f2a01fa6e0b79faca78d0"
        },
        {
          "path": "python/lib/python3.12/ctypes/__pycache__/__init__.cpython-312.pyc",
          "bytes": 23610,
          "sha256": "c37d0555ed3e14c0434eca8f9ae91e0f8b28ac4aa78e48550f9fcb964a8d0b2b"
        },
        {
          "path": "python/lib/python3.12/ctypes/__pycache__/_endian.cpython-312.pyc",
          "bytes": 3435,
          "sha256": "fed535625fa37d45ce36e7a1d6b6e3b4ec6c6a79313f909a69d440ea9f83bf2c"
        },
        {
          "path": "python/lib/python3.12/ctypes/__pycache__/util.cpython-312.pyc",
          "bytes": 16332,
          "sha256": "479db9c3cec780cfda55e1d370237783a62e5529b9fd37a43bd3a4ee28d14a36"
        },
        {
          "path": "python/lib/python3.12/ctypes/_aix.py",
          "bytes": 12505,
          "sha256": "540e2821fa36981bde5c6ffb8f972474b06db4a37c1854c0e0e379b75d2b0fa3"
        },
        {
          "path": "python/lib/python3.12/ctypes/_endian.py",
          "bytes": 2535,
          "sha256": "c5d692bdce10dfee242752620061bab684633bc72445a3def484961ef1bdbf3a"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/__init__.py",
          "bytes": 154,
          "sha256": "1e77c01eec8f167ed10b754f153c0c743c8e5196ae9c81dffc08f129ab56dbfd"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 378,
          "sha256": "2915a9b09e8e9395e1aa0916e91deddf0149594eeb075486594cb8d70ec4c4b0"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/__pycache__/dyld.cpython-312.pyc",
          "bytes": 6814,
          "sha256": "36eb94134a45d7f9d70673e6bc03ea0711d7c132ed7ab5035cf4bb915e86895e"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/__pycache__/dylib.cpython-312.pyc",
          "bytes": 1341,
          "sha256": "90e560354443ec58d2dbc135d7f75efe84039b1b5a9bde228e522babf351f7d7"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/__pycache__/framework.cpython-312.pyc",
          "bytes": 1471,
          "sha256": "d21dfa3743e1d4dd7a86103ba970bb77fa050eeb5ae23bd35794f46727669b8a"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/dyld.py",
          "bytes": 5024,
          "sha256": "eb8e7b17f1533bc3e86e23e8695f7a5e4b7a99ef1b1575d10af54f389161b655"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/dylib.py",
          "bytes": 960,
          "sha256": "f19ee056b18165cc6735efab0b4ca3508be9405b9646c38113316c15e8278a6f"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/fetch_macholib",
          "bytes": 84,
          "sha256": "a9f6faacdb1aa00ac2f68043cd445171de9639a732b861bd5e64090a2865ab23",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/fetch_macholib.bat",
          "bytes": 75,
          "sha256": "7497fbdbb98afca4ac455e3a057c59bcdebaf1280e25c94741dc301f05cb53e5"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/framework.py",
          "bytes": 1105,
          "sha256": "302439e40d9cbdd61b8b7cffd0b7e1278a6811b635044ee366a36e0d991f62da"
        },
        {
          "path": "python/lib/python3.12/ctypes/macholib/README.ctypes",
          "bytes": 296,
          "sha256": "dc29d1da83b6a0a09a41647e4111eee878ed079c2d6b54a98fd6d8b88dd581f2"
        },
        {
          "path": "python/lib/python3.12/ctypes/util.py",
          "bytes": 13959,
          "sha256": "a54310b64a080b0103f3de5df86b21d884bc2985760f3596ab85d458eae8cba5"
        },
        {
          "path": "python/lib/python3.12/ctypes/wintypes.py",
          "bytes": 5629,
          "sha256": "5c4d9ba1a21683838ed1d1f007b6038304e42aacf34c576e820311d26cb243f3"
        },
        {
          "path": "python/lib/python3.12/curses/__init__.py",
          "bytes": 3369,
          "sha256": "d8730e360dd00ec046bdd85cae41fe83c907c6ae3716a964158fce8f31ab28b0"
        },
        {
          "path": "python/lib/python3.12/curses/ascii.py",
          "bytes": 2543,
          "sha256": "780dd8bbaf0ee7e832f164c1772953e694a9cd1031d1ab1471af65344d3645e6"
        },
        {
          "path": "python/lib/python3.12/curses/has_key.py",
          "bytes": 5634,
          "sha256": "15a052812d9ae80124bb25b3f5b9ffae38e2b03073774e163abf3d773140cfb3"
        },
        {
          "path": "python/lib/python3.12/curses/panel.py",
          "bytes": 87,
          "sha256": "13ef404a30da1825a612ca3e453db88c305d45deef4441c4c9e2ef7ee0ef50c7"
        },
        {
          "path": "python/lib/python3.12/curses/textpad.py",
          "bytes": 7754,
          "sha256": "6fd91c3fd9f4a6f213979a2c1df6b737c49c95d9c3acf22cf40cfdb1f88fb737"
        },
        {
          "path": "python/lib/python3.12/dataclasses.py",
          "bytes": 62085,
          "sha256": "d242aea5fcf6408b1c1f622442f88f68b9526ce1f8bd2890d74a144677c427d9"
        },
        {
          "path": "python/lib/python3.12/datetime.py",
          "bytes": 268,
          "sha256": "ef20dc6b3554cd585dddffdc573f1f9a7a54c522f2a3fb4576c44edbb1e14238"
        },
        {
          "path": "python/lib/python3.12/dbm/__init__.py",
          "bytes": 5882,
          "sha256": "389407b292f30c38a334599d2546ca1fea316b038a5252f985bbccfce6c8453b"
        },
        {
          "path": "python/lib/python3.12/dbm/dumb.py",
          "bytes": 11594,
          "sha256": "c99202d9eb4e25a023715a1b804c886fdb7d9f957730959bb071a57d607443b5"
        },
        {
          "path": "python/lib/python3.12/dbm/gnu.py",
          "bytes": 72,
          "sha256": "36cd4904f50e00c4df4ad9d450b3970e150957425f47c00cf979ba73eff49778"
        },
        {
          "path": "python/lib/python3.12/dbm/ndbm.py",
          "bytes": 70,
          "sha256": "1bcc2d9b2fad1901f3421a174eeecb5b8ccc6763283b87bbe0705b404c71904b"
        },
        {
          "path": "python/lib/python3.12/decimal.py",
          "bytes": 2805,
          "sha256": "c3e37c55ef72b3dd6cb7b466a907b966467b6a9c58d85302193e64cbb5fd53d0"
        },
        {
          "path": "python/lib/python3.12/difflib.py",
          "bytes": 83368,
          "sha256": "3eb2d371b4a171b063921de6bbf115108bc39de8bf72866315868ce2599213b7"
        },
        {
          "path": "python/lib/python3.12/dis.py",
          "bytes": 30227,
          "sha256": "44c0b389c96124d8fb5cb0bc41c7a2aa7a6848ef4001b4000dcbd858efa4a1a2"
        },
        {
          "path": "python/lib/python3.12/doctest.py",
          "bytes": 106749,
          "sha256": "8fb954ef7e775270461f1baf1331749cab6765a4006d0183cb8a0dfede1bbdc8"
        },
        {
          "path": "python/lib/python3.12/email/__init__.py",
          "bytes": 1764,
          "sha256": "e4f46e3414c4602c9abb8b404a45e84412fc49dbe38a3d163f9575132dc7c93e"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1981,
          "sha256": "e8948098d5af516dc7b6104781766738fcdafc1039598f829cbd9f1287b2de4c"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/_encoded_words.cpython-312.pyc",
          "bytes": 8368,
          "sha256": "219eae54241737136023f42610c643bbcd385ac36cf08c0a395309401d52eff6"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/_header_value_parser.cpython-312.pyc",
          "bytes": 133994,
          "sha256": "cdef1a685f27bb0350a80e2624b3c43c93a1ef027e36007399d12d0b31db2998"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/_parseaddr.cpython-312.pyc",
          "bytes": 23307,
          "sha256": "899552b89665447a4edf4bc914bcd9fb6838315812e3a77e5ca0b26097e05d23"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/_policybase.cpython-312.pyc",
          "bytes": 18696,
          "sha256": "8e0ba5f41ea673ce9a301f161355a63d9b94567acebb72cfb1c9e595228be653"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/base64mime.cpython-312.pyc",
          "bytes": 4007,
          "sha256": "1419011d044d04aa6cccea19850012015c21642ccb35581fdef844d1b2c4edc8"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/charset.cpython-312.pyc",
          "bytes": 15305,
          "sha256": "0dfd428018574babb63544a596911f3988aee9f7387247e1829d36a38d487a65"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/encoders.cpython-312.pyc",
          "bytes": 2151,
          "sha256": "a50294f71d393b36f1e7015f08308778f69d9a35a3b665f348d56636e0a2ea8d"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/errors.cpython-312.pyc",
          "bytes": 7083,
          "sha256": "61049d4491dd8b87c8e531b1c1226912ed6e3746a4269bfc197284114822934c"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/feedparser.cpython-312.pyc",
          "bytes": 19860,
          "sha256": "b680bfb89392858342864ea76302f99c2cdf58db9a378cc59bcf347b485eabbb"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/generator.cpython-312.pyc",
          "bytes": 21294,
          "sha256": "6a4d507561045d623dc67fc73f20267a6bb47e678b45b8bee5460807f0d63948"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/header.cpython-312.pyc",
          "bytes": 24571,
          "sha256": "8fec76598b40a7fee9652e65b381bc4e10d3e8c63b99b4d7ca32936d516adc49"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/headerregistry.cpython-312.pyc",
          "bytes": 31027,
          "sha256": "32d4bcd3b0dd9a92e0af86af4f2f9e727effdb86e8cc5ba14af8983a2291dbec"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/iterators.cpython-312.pyc",
          "bytes": 2861,
          "sha256": "632ec02c913ef095995be243e5eadd2612fef01236bc0fe64aa39f0d7bb0f284"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/message.cpython-312.pyc",
          "bytes": 53171,
          "sha256": "fbc3e566b302068c0d3558ba3035e193f322d6656291ed573a7ce8109de2458c"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/parser.cpython-312.pyc",
          "bytes": 6808,
          "sha256": "038eba845cf129321e5ce9eff5b5e2ab3ed6d8c8e43100054e90a55f40f123ec"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/quoprimime.cpython-312.pyc",
          "bytes": 10012,
          "sha256": "545b9a5e09ee874726d1892c24841678f3fe828ed6b0c6193e2b05eaa05acc63"
        },
        {
          "path": "python/lib/python3.12/email/__pycache__/utils.cpython-312.pyc",
          "bytes": 16032,
          "sha256": "be82d3218b80367528e8ac00f87a499b523052b067f0215b2c5f278a75ac0cf3"
        },
        {
          "path": "python/lib/python3.12/email/_encoded_words.py",
          "bytes": 8541,
          "sha256": "4178321600c0a19ca04cfe8542ce44487f339d15d89a473b58cea63c0b230217"
        },
        {
          "path": "python/lib/python3.12/email/_header_value_parser.py",
          "bytes": 111685,
          "sha256": "fde2476258d76ae53259f377778cdacdbaca421c2424acada1ef5a94245892cb"
        },
        {
          "path": "python/lib/python3.12/email/_parseaddr.py",
          "bytes": 17821,
          "sha256": "4308932872acbf4a674312a45a49b870e48026e3dfedc878ee2f512ddf2f30ba"
        },
        {
          "path": "python/lib/python3.12/email/_policybase.py",
          "bytes": 15535,
          "sha256": "284be073d7fe99d1021958e6dbeefe4c98a6c00021ea465d01aac71338d1579f"
        },
        {
          "path": "python/lib/python3.12/email/architecture.rst",
          "bytes": 9561,
          "sha256": "f2b2ba7497fd02d13abcfc2a98099283a94b09e8b4f2c1c822ecacde3bec3eae"
        },
        {
          "path": "python/lib/python3.12/email/base64mime.py",
          "bytes": 3551,
          "sha256": "e2b4b87a5f42a8c5780e343f675513bbcc6abdd23fa14f8f1a7d4f7d72304770"
        },
        {
          "path": "python/lib/python3.12/email/charset.py",
          "bytes": 17063,
          "sha256": "a90653f13a4dc5eb3205079dda1d62561a8bf9a7b45585f5dbf90aa31a966680"
        },
        {
          "path": "python/lib/python3.12/email/contentmanager.py",
          "bytes": 10588,
          "sha256": "2d81026aef17e4786b15d9ec0629304987e3f275a0fd0a421a81b4ed87234b2c"
        },
        {
          "path": "python/lib/python3.12/email/encoders.py",
          "bytes": 1778,
          "sha256": "690b275529788cc48e8f541a2aef321dc31e92f75764ac7924896db72d8a9555"
        },
        {
          "path": "python/lib/python3.12/email/errors.py",
          "bytes": 3814,
          "sha256": "dbfb4bbfc85e9d556d3385dc6356518846d8a122bc643b171ea61b6e8dc42c8b"
        },
        {
          "path": "python/lib/python3.12/email/feedparser.py",
          "bytes": 22796,
          "sha256": "6046239fcdd6977d1c25841581cabedaeec8046cc5fedcb8ff2d6450a36442bd"
        },
        {
          "path": "python/lib/python3.12/email/generator.py",
          "bytes": 21403,
          "sha256": "1cf088e6632b61b7c428caa8b5007b18e405fba68055716a11bd3ceb55c0d4c7"
        },
        {
          "path": "python/lib/python3.12/email/header.py",
          "bytes": 24092,
          "sha256": "4d9baa908ad5288dd8fad8cf20b3802ffac77ba1642727804a633b201c56e5ca"
        },
        {
          "path": "python/lib/python3.12/email/headerregistry.py",
          "bytes": 20819,
          "sha256": "fada56c25b6a457c6a62af43f9f929bbc29424103ce65f40f114adb4fdf3d39f"
        },
        {
          "path": "python/lib/python3.12/email/iterators.py",
          "bytes": 2129,
          "sha256": "1080a2d03779176d6d45f6ecd976dbe69f5579f7e4e83b75224c3f92fd258102"
        },
        {
          "path": "python/lib/python3.12/email/message.py",
          "bytes": 48396,
          "sha256": "ba32efea2602ea52e73028a2817afddccccacc4385b9800896556d5c22db2b90"
        },
        {
          "path": "python/lib/python3.12/email/mime/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/email/mime/application.py",
          "bytes": 1321,
          "sha256": "b82a944ccba03e7e7eec46232e50ffe4ce2c32f4b0e26662e6bde30d533584ae"
        },
        {
          "path": "python/lib/python3.12/email/mime/audio.py",
          "bytes": 3094,
          "sha256": "856263b25a3384a7450a1a0b9869fb897b84f893b2e7147c7e045ae50d132cd3"
        },
        {
          "path": "python/lib/python3.12/email/mime/base.py",
          "bytes": 914,
          "sha256": "9a7b36653b5657525a0aeeaa72d4a0b09f598e6edc29c139c2dc2612b7d29fb8"
        },
        {
          "path": "python/lib/python3.12/email/mime/image.py",
          "bytes": 3726,
          "sha256": "460be5b50cfcaab8e72a73f24f14ab062cedf1a40a775b8b0d80c13aed44bb5e"
        },
        {
          "path": "python/lib/python3.12/email/mime/message.py",
          "bytes": 1315,
          "sha256": "30fccea73b874b5ddaccbd3c64936833749ff039f08d40524c1b0b25b8e8e2b8"
        },
        {
          "path": "python/lib/python3.12/email/mime/multipart.py",
          "bytes": 1619,
          "sha256": "8bf2beca6de95d66f12968380a428d3bb0a28a8a6ea2078da521511e1ed80a38"
        },
        {
          "path": "python/lib/python3.12/email/mime/nonmultipart.py",
          "bytes": 689,
          "sha256": "4eb9ad32603d66fc9d55aebcc4d3cf759edd9e95a591d38690659afb2e57b050"
        },
        {
          "path": "python/lib/python3.12/email/mime/text.py",
          "bytes": 1394,
          "sha256": "71c56a41675a36801259c9946f7b7bf838e6c29c453ba8c34d89401f2b972d6c"
        },
        {
          "path": "python/lib/python3.12/email/parser.py",
          "bytes": 4975,
          "sha256": "88890ea9994c55ff7d6c1fd570fece2785f51ed407ee95df4aff946e250bcd66"
        },
        {
          "path": "python/lib/python3.12/email/policy.py",
          "bytes": 10614,
          "sha256": "35fcbece24fac56fdefe15c93351eefda47c3440204746b8519e71d4633b0f3e"
        },
        {
          "path": "python/lib/python3.12/email/quoprimime.py",
          "bytes": 9864,
          "sha256": "77b454bd3ba3b5e3776be28ae3a0fd8de5d1e50d5b8ee10dd539c37c2bd68082"
        },
        {
          "path": "python/lib/python3.12/email/utils.py",
          "bytes": 16071,
          "sha256": "65d259aded3b7d29609d320decdb59cb0a0f7f0e5c453e1d3c380e8a4a5d61c9"
        },
        {
          "path": "python/lib/python3.12/encodings/__init__.py",
          "bytes": 5884,
          "sha256": "78c4744d407690f321565488710b5aaf6486b5afa8d185637aa1e7633ab59cd8"
        },
        {
          "path": "python/lib/python3.12/encodings/__pycache__/__init__.cpython-312.pyc",
          "bytes": 5854,
          "sha256": "4ae72fc541712d9d827ec639d6f7e6e299b4ba99daf8ce7425b1e49571cfc0ba"
        },
        {
          "path": "python/lib/python3.12/encodings/__pycache__/aliases.cpython-312.pyc",
          "bytes": 12487,
          "sha256": "66dab7c3dc845dd5daddc96640e551f5b93dcc6babe4b75dcdfed43bcbf23b6c"
        },
        {
          "path": "python/lib/python3.12/encodings/__pycache__/cp437.cpython-312.pyc",
          "bytes": 13346,
          "sha256": "ae13be76d006daaefa6f02d62087e229a586aa055b560dbd73ef9f1c442afa00"
        },
        {
          "path": "python/lib/python3.12/encodings/__pycache__/idna.cpython-312.pyc",
          "bytes": 9943,
          "sha256": "fb1e342d185b93cc62623127f18531ac46e4a6ec8f95d76f916730386f266652"
        },
        {
          "path": "python/lib/python3.12/encodings/__pycache__/utf_8_sig.cpython-312.pyc",
          "bytes": 6807,
          "sha256": "ea50a00737ee53ff644813aba90440d08b8b297fff444764907c92e303af28c3"
        },
        {
          "path": "python/lib/python3.12/encodings/__pycache__/utf_8.cpython-312.pyc",
          "bytes": 2226,
          "sha256": "b87b3996fe7242847e515e5c1a61991eab74ecb75b22b519c3d70fc1cceb1412"
        },
        {
          "path": "python/lib/python3.12/encodings/aliases.py",
          "bytes": 15677,
          "sha256": "6fdcc49ba23a0203ae6cf28e608f8e6297d7c4d77d52e651db3cb49b9564c6d2"
        },
        {
          "path": "python/lib/python3.12/encodings/ascii.py",
          "bytes": 1248,
          "sha256": "578aa1173f7cc60dad2895071287fe6182bd14787b3fbf47a6c7983dfe3675e3"
        },
        {
          "path": "python/lib/python3.12/encodings/base64_codec.py",
          "bytes": 1533,
          "sha256": "cf9ac7a464f541492486241d1b4bf33e37b45c6499275cc4d69c5a8e564e5976"
        },
        {
          "path": "python/lib/python3.12/encodings/big5.py",
          "bytes": 1019,
          "sha256": "98fac6f86a20dd05da197e2058176ebfd47edee7074c3248f5f48fe0fb672d7c"
        },
        {
          "path": "python/lib/python3.12/encodings/big5hkscs.py",
          "bytes": 1039,
          "sha256": "21d051a00fb5c6a86ba187e0c50e811d659ce00991fd5f5b408f71ebb2ef0f16"
        },
        {
          "path": "python/lib/python3.12/encodings/bz2_codec.py",
          "bytes": 2249,
          "sha256": "1181a2a89102a2b1d2b2f1f4473236d5d1ececdd0be8fdaa498a3dbe21a185ab"
        },
        {
          "path": "python/lib/python3.12/encodings/charmap.py",
          "bytes": 2084,
          "sha256": "1b8b5fdb36ce3becc62a6115ed904a17083949ec8aaef5a80f7078cec232f43b"
        },
        {
          "path": "python/lib/python3.12/encodings/cp037.py",
          "bytes": 13121,
          "sha256": "fda6ca994d710e4e0c760e0204c29a4273fc0f14ebe3169306d2eb54c9953f58"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1006.py",
          "bytes": 13568,
          "sha256": "eaded38b427841bdf280e878f1e26da506e743eaa9429075332af60cce429473"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1026.py",
          "bytes": 13113,
          "sha256": "f5227237dd7ce5005b16a8e4d8342f0d193193c878e3cf35b9305d22b3b1aaf9"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1125.py",
          "bytes": 34597,
          "sha256": "f84c7d30ce222e6a50cff1a4c9737173411da108cbd2c9bb57c854480103c470"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1140.py",
          "bytes": 13105,
          "sha256": "3379d78b244aa905ffe1171a968caaf41b9a0154d1ddc76c05a2abaca2b289fd"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1250.py",
          "bytes": 13686,
          "sha256": "ebcec1adf9167863fb0bab29708c546300c80a77ef07838c9e0437a59e265970"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1251.py",
          "bytes": 13361,
          "sha256": "d57f8cfa34494c5acb6692ddb31f616ae2dd89a075d2af6d36b0b7ec2ffe7af1"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1252.py",
          "bytes": 13511,
          "sha256": "19aa5bee667f5fb387924a813aec9fa1dda47769d09e8483a748bdb202be6a84"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1253.py",
          "bytes": 13094,
          "sha256": "8c27696dcfb6894b378869bc89f113703fbd1e9b13a83934463d5999b055d1e8"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1254.py",
          "bytes": 13502,
          "sha256": "06517ec2f74f1c6562d0a1a500c48ba43f2e6e9d0c3d28356d747f274f1a4c8d"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1255.py",
          "bytes": 12466,
          "sha256": "54a1b5087578fa78e5bdd0afa6a9e80e8c5467c1e4226cf6e586cfe7a674a653"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1256.py",
          "bytes": 12814,
          "sha256": "ad3768ac2fef2a646b3301c20af705f4d4a1544f22fa8a84241bada27ab84133"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1257.py",
          "bytes": 13374,
          "sha256": "d9149d2925b3f719809ef2297e541461079f15c658af207a3e498be314ab2c6b"
        },
        {
          "path": "python/lib/python3.12/encodings/cp1258.py",
          "bytes": 13364,
          "sha256": "672e05b51952a82c8dbd5603769195fcedf565e457bb86c0d5bae04955d04630"
        },
        {
          "path": "python/lib/python3.12/encodings/cp273.py",
          "bytes": 14132,
          "sha256": "6c6aec3b213ea3aebc2c526dd4d121c95d4a25a2fc928a87cd80f8448988185f"
        },
        {
          "path": "python/lib/python3.12/encodings/cp424.py",
          "bytes": 12055,
          "sha256": "30414c2186ea0802bbf3db034122ddec1f8a10061b97c50871e14b74ee36d0ca"
        },
        {
          "path": "python/lib/python3.12/encodings/cp437.py",
          "bytes": 34564,
          "sha256": "5c2a5015cd36cf7f561269f33dec4c323093d3d88b0673969accdabdcb9ce2cb"
        },
        {
          "path": "python/lib/python3.12/encodings/cp500.py",
          "bytes": 13121,
          "sha256": "630f503f9110d98ea3e1529f2f965ebc275a2f78d3de47f8e9b69d35589d764b"
        },
        {
          "path": "python/lib/python3.12/encodings/cp720.py",
          "bytes": 13686,
          "sha256": "395496001271b92efe5df07fc0ae7c3410d1dd2bdfebbd3e4d8e806c8166beb0"
        },
        {
          "path": "python/lib/python3.12/encodings/cp737.py",
          "bytes": 34681,
          "sha256": "be3ca1785a3970ec62310710eaf7de82932181b04d06fe4528f8adaba9fb8c4b"
        },
        {
          "path": "python/lib/python3.12/encodings/cp775.py",
          "bytes": 34476,
          "sha256": "e0dba85b99329d7f16907e620adada06be5216abcb964406c827b569b2cf1aeb"
        },
        {
          "path": "python/lib/python3.12/encodings/cp850.py",
          "bytes": 34105,
          "sha256": "257e29f235e2a8790dd68cee45668776648bab809ce8584f893cdd8fd007993c"
        },
        {
          "path": "python/lib/python3.12/encodings/cp852.py",
          "bytes": 35002,
          "sha256": "cc6faaa9dc4a933127da0aaacd1dc7a44c09266051af56bfe3215ff228636b6b"
        },
        {
          "path": "python/lib/python3.12/encodings/cp855.py",
          "bytes": 33850,
          "sha256": "7b25c61c9e8c47b218d3fbb801541a2861926ac712843d2113fff90e2074f5ba"
        },
        {
          "path": "python/lib/python3.12/encodings/cp856.py",
          "bytes": 12423,
          "sha256": "2e52ec5cb1eafa6739b5569b0b98ee89df5f7358b84ccdc8da64e86f017d359f"
        },
        {
          "path": "python/lib/python3.12/encodings/cp857.py",
          "bytes": 33908,
          "sha256": "8d1b769058bfccdb3c6c70c49a104f5081a2fcc9fad68f7b5eb3e4f67f0b33da"
        },
        {
          "path": "python/lib/python3.12/encodings/cp858.py",
          "bytes": 34015,
          "sha256": "a24930c4a6ad0ff66dde9a69f2027e4b92c2c9c61dcda2992e940654c606577b"
        },
        {
          "path": "python/lib/python3.12/encodings/cp860.py",
          "bytes": 34681,
          "sha256": "2dfae7e31d3d9aa3013cff44a4d7ad842f257ac63765a9998436701b629cd86a"
        },
        {
          "path": "python/lib/python3.12/encodings/cp861.py",
          "bytes": 34633,
          "sha256": "701930d77a2177497586e99bc3fe60f2d4beffb645608f167c76874a72ff405e"
        },
        {
          "path": "python/lib/python3.12/encodings/cp862.py",
          "bytes": 33370,
          "sha256": "15a2844b6ed9544c6400cf7299b42d0c2bef93c9bee70a9e89f66b8610ad6d6d"
        },
        {
          "path": "python/lib/python3.12/encodings/cp863.py",
          "bytes": 34252,
          "sha256": "a3d57f61fce1b98fc81ea8e4ebebaf402fae40bbcdd35d4b8297b9bb49a79aa2"
        },
        {
          "path": "python/lib/python3.12/encodings/cp864.py",
          "bytes": 33663,
          "sha256": "15ad8f1fdfdd842c7522241372e7eddda7df687e815692a89157c5f256f21a08"
        },
        {
          "path": "python/lib/python3.12/encodings/cp865.py",
          "bytes": 34618,
          "sha256": "bdbaded987242ed2a8de7133ec2f61ddcc1c2e9de27816ab7cd0a4c678a3a907"
        },
        {
          "path": "python/lib/python3.12/encodings/cp866.py",
          "bytes": 34396,
          "sha256": "9efcc8e85bbd1687272a0991f6d0429a4c06679db2d114b2ac95db27a70f9d13"
        },
        {
          "path": "python/lib/python3.12/encodings/cp869.py",
          "bytes": 32965,
          "sha256": "52582d9fb769b24eac7154f18d7dae856588297d6da98f37fb5efd8da883826d"
        },
        {
          "path": "python/lib/python3.12/encodings/cp874.py",
          "bytes": 12595,
          "sha256": "fe4752fa2e65741e08a563a31ff914fe71068942ce9c6f4070b1dfd7b25e5e7f"
        },
        {
          "path": "python/lib/python3.12/encodings/cp875.py",
          "bytes": 12854,
          "sha256": "2fe72632015db2cba2bb4367055551da6fe22051b96d170c7b96fa271c46b257"
        },
        {
          "path": "python/lib/python3.12/encodings/cp932.py",
          "bytes": 1023,
          "sha256": "99748e28113d2d49f5d666b49b78accd2c6e10a7852f7dd6dece9b5b71aa83c4"
        },
        {
          "path": "python/lib/python3.12/encodings/cp949.py",
          "bytes": 1023,
          "sha256": "950a7d29467ce0590b4a1137830d43d88d8f20e4035dcaaa8b2a5c3c3f1de962"
        },
        {
          "path": "python/lib/python3.12/encodings/cp950.py",
          "bytes": 1023,
          "sha256": "27811178b450731fc955b1247656a605d04e5ee98e0d585e4596b94b703a27f6"
        },
        {
          "path": "python/lib/python3.12/encodings/euc_jis_2004.py",
          "bytes": 1051,
          "sha256": "9fa426cd9f17629f6320700ed18baa94839304cf1bcabbee7edb501747dc055d"
        },
        {
          "path": "python/lib/python3.12/encodings/euc_jisx0213.py",
          "bytes": 1051,
          "sha256": "e28315910da20218dae8b7d5becd81de1e283dfd8b0415a4980d67065de73a0b"
        },
        {
          "path": "python/lib/python3.12/encodings/euc_jp.py",
          "bytes": 1027,
          "sha256": "b453a439787b0efa031e43416a7d852a6be705c985e1200693eb96d87ea79cdc"
        },
        {
          "path": "python/lib/python3.12/encodings/euc_kr.py",
          "bytes": 1027,
          "sha256": "633a1a5504bfad04b1ec9c96d44d4ebb3bb99066a218318e7d67d866e20887a6"
        },
        {
          "path": "python/lib/python3.12/encodings/gb18030.py",
          "bytes": 1031,
          "sha256": "6c10b4dc49bc63724e539137ede6936304fcca1c97c28d16d89f381e10849521"
        },
        {
          "path": "python/lib/python3.12/encodings/gb2312.py",
          "bytes": 1027,
          "sha256": "3d2d567d8d079b78f3f3b566ed52ad2f38af61bf832b7dc28858b0039a032d6b"
        },
        {
          "path": "python/lib/python3.12/encodings/gbk.py",
          "bytes": 1015,
          "sha256": "eff9b8cbc9ad2ef2e10e96afa83d3db1f775ea044aed275b7a35574ae0d8645b"
        },
        {
          "path": "python/lib/python3.12/encodings/hex_codec.py",
          "bytes": 1508,
          "sha256": "fc5f0a31b59efe990b86efb98936769f33dd91d912ce55b49a5a4cfc516cd047"
        },
        {
          "path": "python/lib/python3.12/encodings/hp_roman8.py",
          "bytes": 13475,
          "sha256": "c43cce763d12e8f71a63dbc16641bd87147eaf5f9d9054ea856864b216b2735b"
        },
        {
          "path": "python/lib/python3.12/encodings/hz.py",
          "bytes": 1011,
          "sha256": "025a9531e3046e52d3e039c0be04f9a5a74651d7683a13c7c7ebd4c7dfb5996a"
        },
        {
          "path": "python/lib/python3.12/encodings/idna.py",
          "bytes": 9710,
          "sha256": "9ca58e82d12b171f25d57239ad237dae5c44214a70f2f4f39358c2759b8b9013"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_jp_1.py",
          "bytes": 1061,
          "sha256": "63bacad13a979a5519fcaa4f1e1e07b2c7415005167fac3a689408c7d886fabd"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_jp_2.py",
          "bytes": 1061,
          "sha256": "5d4248181548b0fc89a9f5ee9cf52ebecb235708ba87d47896ad14130884ef9f"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_jp_2004.py",
          "bytes": 1073,
          "sha256": "b4d1468bcd608b46f38cb0c6ef115510dcf9aa0f71e590792f407efc6e165164"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_jp_3.py",
          "bytes": 1061,
          "sha256": "3aceaa5661909de14e2861d864443b8472460ce39b99cce5c6965346d47aa5ac"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_jp_ext.py",
          "bytes": 1069,
          "sha256": "f4c9ed8f3031995faa224bcb10153d2b6144944477d1f27d1a6cc4a879fac34c"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_jp.py",
          "bytes": 1053,
          "sha256": "461a0e7f72eccb8b29f351c4e7926cfbda58e0edd6d0770bd82e0b36c5febe77"
        },
        {
          "path": "python/lib/python3.12/encodings/iso2022_kr.py",
          "bytes": 1053,
          "sha256": "1c86362e17944f0bcf68db02f4995bdeea605867795fff7ab4079073f96705e4"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_1.py",
          "bytes": 13176,
          "sha256": "b5cebd515e057d670bf54e10b8a6f162ef3daa7f21b146aee3249160caf3c32d"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_10.py",
          "bytes": 13589,
          "sha256": "54c886b41819ebb7f4fb34b8dbae1c45f4fc0864f019ecd772676ccfac5fae7b"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_11.py",
          "bytes": 12335,
          "sha256": "ed5a964470a241b4da7a6cfb718e4149d09644933af38f0497602baab6e563ef"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_13.py",
          "bytes": 13271,
          "sha256": "7312237e8e5d201d920b4130f057cfdf1b0be9baafaa246826e6d93204fcc206"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_14.py",
          "bytes": 13652,
          "sha256": "82778b995a0ee87c5f1180fcc52900359eee15bd9a6e3a0e25f0d963e0b2a343"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_15.py",
          "bytes": 13212,
          "sha256": "01976a81811873dc9a0c79db9fc00d1c30103487f3c6bc3a6d81b4043cd48e02"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_16.py",
          "bytes": 13557,
          "sha256": "b5ac8f5a5d8f84c0f903b2b7c342184758d590d8bcf810d561f942fe5b372d66"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_2.py",
          "bytes": 13404,
          "sha256": "2b57cab6111cae9021505e3ae1b2adbbfc344ec48165fda322f6b069fbb18adc"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_3.py",
          "bytes": 13089,
          "sha256": "4ffdf89004bf0c5230caa7079f7ca3142fc112f8b923ddb2c7358369d2d3c242"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_4.py",
          "bytes": 13376,
          "sha256": "87bd130daa0eaef3e4cb465e10cffb2bcd194ff74097e0c186b4b8eb7be41ac5"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_5.py",
          "bytes": 13015,
          "sha256": "9961d96cc7b9fdf011ebcaaeaeca7b50b8670fadbd7b75fde66192f8c1f68f30"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_6.py",
          "bytes": 10833,
          "sha256": "4840e68014346517680f593ca22f67133c39ba7e46f34b9be62c980a728448c6"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_7.py",
          "bytes": 12844,
          "sha256": "b352eca3b819488f64fb3338fd93f39c1e30f32bb13f2f9c577925e58f2960e4"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_8.py",
          "bytes": 11036,
          "sha256": "4cf9e8a8bbe04accb1c1a80853efb19ae0772d18f81e270adefc1b2386cb368e"
        },
        {
          "path": "python/lib/python3.12/encodings/iso8859_9.py",
          "bytes": 13156,
          "sha256": "84d9b15263e81685f7513c5ab45caf80b2f73c301c68e659f7162c1b1882d359"
        },
        {
          "path": "python/lib/python3.12/encodings/johab.py",
          "bytes": 1023,
          "sha256": "9586615917afd3d848c1c4328656603b2834af6115f2aec932fccc935e1a60fb"
        },
        {
          "path": "python/lib/python3.12/encodings/koi8_r.py",
          "bytes": 13779,
          "sha256": "4d4e353aee8039bb71e2145a6e68fe1e6833a1b4250b70ee0ac5ec70bbb8c51d"
        },
        {
          "path": "python/lib/python3.12/encodings/koi8_t.py",
          "bytes": 13193,
          "sha256": "9c9043814abdbe7dc39ff98f3857d5d110a84c978ad2304158d810a4e9eacef1"
        },
        {
          "path": "python/lib/python3.12/encodings/koi8_u.py",
          "bytes": 13762,
          "sha256": "d449f9858e357fa8c2edbd4b9fe739337e9f201cac3ded20f99bfcecd4970ff7"
        },
        {
          "path": "python/lib/python3.12/encodings/kz1048.py",
          "bytes": 13723,
          "sha256": "76beb30e98a911f72f97609a2373782573c17c88a5fb3537db338aa382979ffc"
        },
        {
          "path": "python/lib/python3.12/encodings/latin_1.py",
          "bytes": 1264,
          "sha256": "b75503e532a27c636477396c855209ff5f3036536d2a4bede0a576c89382b60c"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_arabic.py",
          "bytes": 36467,
          "sha256": "5eafd9a3136abfbd8ed52df9c90203c7a283e7429ed60502a87a02511e0fb777"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_croatian.py",
          "bytes": 13633,
          "sha256": "a880cd05c82a8d11a29c65ee86a396def3344465dd71441b0bb4a73826024953"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_cyrillic.py",
          "bytes": 13454,
          "sha256": "83616786a1c6308b03a0dc82536908d24d0974b2248d67393d613fe558cea4bd"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_farsi.py",
          "bytes": 15170,
          "sha256": "f5763c38fb4ab0423fafe2fdca34d6f9932ac7f1a74c0cd8109d60234c7dc624"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_greek.py",
          "bytes": 13721,
          "sha256": "63016a323ddf98cb3aa9cfa78f3bab4768bedbfe9a5262a36a5aecb13d291f6e"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_iceland.py",
          "bytes": 13498,
          "sha256": "753cc1ac635caa7e1b4630fbcebef8db8db332c098154a5b11f652912bf64f37"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_latin2.py",
          "bytes": 14118,
          "sha256": "31670da18ce8b5394cd53fe6bf216268e7e8eae4c0247532e420e2e103727d50"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_roman.py",
          "bytes": 13480,
          "sha256": "230367d96aef8e8d7f185b4acfb84923714f39ddbcbf9cf38a06bf6f5d621c22"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_romanian.py",
          "bytes": 13661,
          "sha256": "49630cf035c19e896a123ed6e5fee18b5e485123daf2f15da38bf727ff387bee"
        },
        {
          "path": "python/lib/python3.12/encodings/mac_turkish.py",
          "bytes": 13513,
          "sha256": "99758a5cad2825cb3be3fa5d031e0821e4eba910a46f417fd890207b9b6be77b"
        },
        {
          "path": "python/lib/python3.12/encodings/mbcs.py",
          "bytes": 1211,
          "sha256": "f6ed445ed537c9f856d8defe8b56505727737d0dc9348d0a877abedab4bdd864"
        },
        {
          "path": "python/lib/python3.12/encodings/oem.py",
          "bytes": 1019,
          "sha256": "481656d3a35f792d0e5109e3f821e6dbfcf097163a19b0cdfcbff3b3db99292f"
        },
        {
          "path": "python/lib/python3.12/encodings/palmos.py",
          "bytes": 13519,
          "sha256": "eccf7418adefcc2a59e9a07fc4e34363bd62f7e878d48c8a02730a8ed1c584c8"
        },
        {
          "path": "python/lib/python3.12/encodings/ptcp154.py",
          "bytes": 14015,
          "sha256": "0eabcb2c287d335e86b71b0abe5718bd6ddc9aaee234f0f0f2363845d2926d8d"
        },
        {
          "path": "python/lib/python3.12/encodings/punycode.py",
          "bytes": 6883,
          "sha256": "34edc8fb1c50e4d1cbaa1e008bb491cd7c12116c316e51974f333fe7b628eb7c"
        },
        {
          "path": "python/lib/python3.12/encodings/quopri_codec.py",
          "bytes": 1525,
          "sha256": "502a213c34c05a94ed063ee03f47680bd6efbb35036e06fb4dc809bf398cfa64"
        },
        {
          "path": "python/lib/python3.12/encodings/raw_unicode_escape.py",
          "bytes": 1332,
          "sha256": "fa6328486b8f5a5cbd10e377e80adb8cf94acbbe19c38b4e1bf708d831a80a3a"
        },
        {
          "path": "python/lib/python3.12/encodings/rot_13.py",
          "bytes": 2448,
          "sha256": "14767f475acdc0bf48e6272280dd15b80efaecafb93c06be21136f83dd1ee7e4",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/encodings/shift_jis_2004.py",
          "bytes": 1059,
          "sha256": "d21c5930f21063ea78fea3b0f76dfb8fd92858d2a4a200064a52126a43dd1a99"
        },
        {
          "path": "python/lib/python3.12/encodings/shift_jis.py",
          "bytes": 1039,
          "sha256": "ad4ac50ebf58294304e412cc0f1b12980988dd6edc414e4110029c0a1abbe966"
        },
        {
          "path": "python/lib/python3.12/encodings/shift_jisx0213.py",
          "bytes": 1059,
          "sha256": "2c8d0b93bb36edf31c1236b1b4d1c0008553868bd2fc9137570115b96b834f2e"
        },
        {
          "path": "python/lib/python3.12/encodings/tis_620.py",
          "bytes": 12300,
          "sha256": "647c4719e2c1a7375105e15a89b377c66f6b699977dcabbb71d923a4607b7902"
        },
        {
          "path": "python/lib/python3.12/encodings/undefined.py",
          "bytes": 1299,
          "sha256": "85bba5c5e1007cd8c1ade5c0214bcc825396d2bbd02054e62a9f162104748b64"
        },
        {
          "path": "python/lib/python3.12/encodings/unicode_escape.py",
          "bytes": 1304,
          "sha256": "507e7ca8f18df639fd823d7cc23ce4028a3550ceefdfa40b3c76f81d1a94531d"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_16_be.py",
          "bytes": 1037,
          "sha256": "3357196f3fa52433326a6626880e34964e00c5570aee50e9a0a0a7c6d86f6e4f"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_16_le.py",
          "bytes": 1037,
          "sha256": "3aedaf3eb49769282daef1eaedfd4fa1c31fe5eebeff67fe2307c89dc2e2fd80"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_16.py",
          "bytes": 5236,
          "sha256": "6c36257f7b8d214473560d195e71bccef0c69a53e1e52d2800b7a7890aad7e58"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_32_be.py",
          "bytes": 930,
          "sha256": "cbba20e1f6d0879c7c4293446c371a9f79e7c90bf3c78a77a9b8fc72b18915dd"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_32_le.py",
          "bytes": 930,
          "sha256": "9134b91047d85b442898d59effe23e7e0cf4167ca341ae31119a731dbf880a7b"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_32.py",
          "bytes": 5129,
          "sha256": "2072eece5f6026ad2d3549ab193a9e38894ea15ca9d5b3cd408fd6b116acc0c2"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_7.py",
          "bytes": 946,
          "sha256": "9ff32314f4f1fa074f206bbf7fdb851504e5313128636d73b4bf75b886e4a87d"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_8_sig.py",
          "bytes": 4133,
          "sha256": "1ef3da8d8aa08149e7f274dc64dbfce2155da812e5258ca8e8f832428d3b5c2d"
        },
        {
          "path": "python/lib/python3.12/encodings/utf_8.py",
          "bytes": 1005,
          "sha256": "ba0cac060269583523ca9506473a755203037c57d466a11aa89a30a5f6756f3d"
        },
        {
          "path": "python/lib/python3.12/encodings/uu_codec.py",
          "bytes": 2851,
          "sha256": "45ba92000718abf85f158563c755205e100356ce1b4ab9444b4d0a3d21f061a3"
        },
        {
          "path": "python/lib/python3.12/encodings/zlib_codec.py",
          "bytes": 2204,
          "sha256": "6ef01e8d3a5fe1cc52f7b5ae008df12f1dbce7304111bf8d4758f1bfc0115759"
        },
        {
          "path": "python/lib/python3.12/ensurepip/__init__.py",
          "bytes": 9445,
          "sha256": "90f6c76cd9ef7ed6daa198bb9ef771139683487f1b061211be7aa511831b2028"
        },
        {
          "path": "python/lib/python3.12/ensurepip/__main__.py",
          "bytes": 88,
          "sha256": "ee735f518d0fc4dfec81f7aa3da1e052372ed4202c0da4eddd2587840beaecd7"
        },
        {
          "path": "python/lib/python3.12/ensurepip/__pycache__/__init__.cpython-312.pyc",
          "bytes": 9550,
          "sha256": "10e381d0ab3033354a144788d5899f20ee395eac8f2e6aec2957c0f2e180bd47"
        },
        {
          "path": "python/lib/python3.12/ensurepip/__pycache__/__main__.cpython-312.pyc",
          "bytes": 387,
          "sha256": "634665bab1f77973b0f802358e020c79d434f99f1a540dcd0986da246e2c296e"
        },
        {
          "path": "python/lib/python3.12/ensurepip/_bundled/pip-25.0.1-py3-none-any.whl",
          "bytes": 1841526,
          "sha256": "c46efd13b6aa8279f33f2864459c8ce587ea6a1a59ee20de055868d8f7688f7f"
        },
        {
          "path": "python/lib/python3.12/ensurepip/_uninstall.py",
          "bytes": 808,
          "sha256": "3a6e95d01c45e2e47c05df3c81073b895c97c1eb0e5b90ab175d6d9263fc81f2"
        },
        {
          "path": "python/lib/python3.12/enum.py",
          "bytes": 81540,
          "sha256": "f35e542d8c4c1d2b5e910138d726fa48774925f3c4dc5462793ebcb66aa55501"
        },
        {
          "path": "python/lib/python3.12/filecmp.py",
          "bytes": 10381,
          "sha256": "803d8494d5ae72f986f3dedaa30360fcc4467f9cb7b3106cf0d434d87a033d60"
        },
        {
          "path": "python/lib/python3.12/fileinput.py",
          "bytes": 15714,
          "sha256": "b0cd2a3f01c96f594b6038e52bd83d489bfa081cc757103c70aab4e5b2c4fe1f"
        },
        {
          "path": "python/lib/python3.12/fnmatch.py",
          "bytes": 5999,
          "sha256": "6683da36e47af523f3f41e18ad244d837783e19e98911cc0b7415dea81494ebc"
        },
        {
          "path": "python/lib/python3.12/fractions.py",
          "bytes": 38147,
          "sha256": "d52d1ab9d5be26924e4914a5e40069c992bbfa68f773694c2e5ee8452d0766a0"
        },
        {
          "path": "python/lib/python3.12/ftplib.py",
          "bytes": 35240,
          "sha256": "fb32563e0157d25e1a4b72cdbb5607893014d1accc2dbb986b2e3a61aebfe26e"
        },
        {
          "path": "python/lib/python3.12/functools.py",
          "bytes": 37940,
          "sha256": "de4a1d37c795e2a065124b5c49357893433bc6bb111b41277ccc9930ef08d4c9"
        },
        {
          "path": "python/lib/python3.12/genericpath.py",
          "bytes": 5572,
          "sha256": "2b0b35d2206778af4081cf81dd9b513876e72c35a55bec941402e1fa62b1f1aa"
        },
        {
          "path": "python/lib/python3.12/getopt.py",
          "bytes": 7488,
          "sha256": "0ce875700c8798193b8e2748f7a27fc542cc4d525a1e6fc403767450ec92be99"
        },
        {
          "path": "python/lib/python3.12/getpass.py",
          "bytes": 5990,
          "sha256": "e74fd445337ff503223dd8aa4bdd7d04917067d00c796a10bedb7a1381a4960a"
        },
        {
          "path": "python/lib/python3.12/gettext.py",
          "bytes": 21320,
          "sha256": "a5c249a522b6b8e3aa6f1b12a8bcc09508b99ad612b58d2fc973db27ea3b7cc3"
        },
        {
          "path": "python/lib/python3.12/glob.py",
          "bytes": 8732,
          "sha256": "c9e5f9ae0752660ede63328a456f58f87c29500b31f58c1b813458b00fceb6d5"
        },
        {
          "path": "python/lib/python3.12/graphlib.py",
          "bytes": 9648,
          "sha256": "2a29e0adee584dc76251afef1236d7bedf250aca27911f91a4d442133ce81117"
        },
        {
          "path": "python/lib/python3.12/gzip.py",
          "bytes": 25402,
          "sha256": "ea6e194b9df26398bf0d5215e63320c7b9d801b2d8b723fb9c80619df48076e9"
        },
        {
          "path": "python/lib/python3.12/hashlib.py",
          "bytes": 9349,
          "sha256": "6dbdebf270868b391080e21dc9687eddfaf321c965ad979f68d3f5c423c613ab"
        },
        {
          "path": "python/lib/python3.12/heapq.py",
          "bytes": 23024,
          "sha256": "6d43277e5c76fc0f073cd388fcff852d14d068f6bb6d4886c340f8b75a1229a9"
        },
        {
          "path": "python/lib/python3.12/hmac.py",
          "bytes": 7716,
          "sha256": "7facd1330e5487ed995eda5c8619df0d3e32f69cb619f97662372fb76325746e"
        },
        {
          "path": "python/lib/python3.12/html/__init__.py",
          "bytes": 4775,
          "sha256": "923d82d821e75e8d235392c10c145ab8587927b3faf9c952bbd48081eebd8522"
        },
        {
          "path": "python/lib/python3.12/html/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4443,
          "sha256": "56f9b09643026659ef1724f0c6c054d69febe340a2cc8e6abf0fe36ee79c3f4a"
        },
        {
          "path": "python/lib/python3.12/html/__pycache__/entities.cpython-312.pyc",
          "bytes": 97727,
          "sha256": "40733956fd3d6c95f6efb4a67bd37aa733975b74a6d6d75a0058fa575b8370ef"
        },
        {
          "path": "python/lib/python3.12/html/__pycache__/parser.cpython-312.pyc",
          "bytes": 22524,
          "sha256": "c3b0fe8ae9a8d6ac14620dbbaaf0ae87a79a8e6745a2e3dfad6f50b97c766d4b"
        },
        {
          "path": "python/lib/python3.12/html/entities.py",
          "bytes": 75512,
          "sha256": "d9c65fb2828dbc1f3e399058a341d51e9375ec5bca95a8e92599c41bd5b78bde"
        },
        {
          "path": "python/lib/python3.12/html/parser.py",
          "bytes": 22048,
          "sha256": "a4c5558209ffe6d677dbe18e4a4b2d34672c73aee46e39b1d118846afa62a9ff"
        },
        {
          "path": "python/lib/python3.12/http/__init__.py",
          "bytes": 8308,
          "sha256": "17f4f6832cfc84b5b9600414bab80b77e67ccb611bdfed10a3f2beca9d0d568b"
        },
        {
          "path": "python/lib/python3.12/http/__pycache__/__init__.cpython-312.pyc",
          "bytes": 9549,
          "sha256": "f5b8d28374ebac24cc6d5844428857d926216524d99ea8f11960d756b12eccbd"
        },
        {
          "path": "python/lib/python3.12/http/__pycache__/client.cpython-312.pyc",
          "bytes": 58858,
          "sha256": "7b254574e7318d2700ed9ba15afb09f843d1046a071e7b3bddff0654a0f031b4"
        },
        {
          "path": "python/lib/python3.12/http/__pycache__/cookiejar.cpython-312.pyc",
          "bytes": 81478,
          "sha256": "7c5dbb176db4e98c1a5965de2c498b2ca7d9e832a500dc580084dac54917080c"
        },
        {
          "path": "python/lib/python3.12/http/__pycache__/cookies.cpython-312.pyc",
          "bytes": 22576,
          "sha256": "8eb9bf8aa2ff2a586cc35dc0bcac37b963655f7b1dc04d8a5c00dd19fc0e5e8e"
        },
        {
          "path": "python/lib/python3.12/http/client.py",
          "bytes": 59574,
          "sha256": "c2c0694155837d72fc710a4138e5d1e53ae1a652b117a2e23a5b1b0db527a0f9"
        },
        {
          "path": "python/lib/python3.12/http/cookiejar.py",
          "bytes": 77438,
          "sha256": "2a64dbc46edd0173600f32d195531741de562522da28bc76c2f97dccceb37ddb"
        },
        {
          "path": "python/lib/python3.12/http/cookies.py",
          "bytes": 21568,
          "sha256": "6387f676095ae5374943eff99fbcd2d9c681172c00209fadf54c311cf7228149"
        },
        {
          "path": "python/lib/python3.12/http/server.py",
          "bytes": 49202,
          "sha256": "12f8db637047c12ec053bfaa6671ad1cb7ca9ca8d1dae82b562e5866c5b02990"
        },
        {
          "path": "python/lib/python3.12/idlelib/__init__.py",
          "bytes": 396,
          "sha256": "3f8058df4fec56eb20ff67ff84c86fd3d9697e2384c5a290ed696f6d3187aa45"
        },
        {
          "path": "python/lib/python3.12/idlelib/__main__.py",
          "bytes": 107,
          "sha256": "26699e80e7e8ba278a649881b80e8c7301c729d04d2f8fb2268365b10a48a91e"
        },
        {
          "path": "python/lib/python3.12/idlelib/autocomplete_w.py",
          "bytes": 20863,
          "sha256": "91170b060749d0b3c8f2ab31499104028bedf971e5575155d43392d5c8dae5d6"
        },
        {
          "path": "python/lib/python3.12/idlelib/autocomplete.py",
          "bytes": 9354,
          "sha256": "0d36f7694a50cbaa22d9bf03b91fa0658a147bd90dd867714a9b411febb36427"
        },
        {
          "path": "python/lib/python3.12/idlelib/autoexpand.py",
          "bytes": 3216,
          "sha256": "c8eb28ef7addf5a664a7e3addfbfebe29040a8695e1db515828305aacba2ee4e"
        },
        {
          "path": "python/lib/python3.12/idlelib/browser.py",
          "bytes": 8588,
          "sha256": "b607102a6e2ff7de241744008144a5480e2925098694be2a46003d8f60da0f52"
        },
        {
          "path": "python/lib/python3.12/idlelib/calltip_w.py",
          "bytes": 7083,
          "sha256": "077e9d0d95946296077d5c95f343e242a7d250a6efece4afc58759b5e984e6c3"
        },
        {
          "path": "python/lib/python3.12/idlelib/calltip.py",
          "bytes": 7267,
          "sha256": "3a723fdf88c0018dfadd19757142a643b01b785c6df17a50bbe21463663ab590"
        },
        {
          "path": "python/lib/python3.12/idlelib/ChangeLog",
          "bytes": 56360,
          "sha256": "b7f42699e5e5a7c82ebdf2a2962946b7228c933ece0ea7c0d7789f21a7dd7e64"
        },
        {
          "path": "python/lib/python3.12/idlelib/codecontext.py",
          "bytes": 11420,
          "sha256": "628a13325b3bf2f76dea9254b20178b3232261f83c660f0e33785e6215dd6492"
        },
        {
          "path": "python/lib/python3.12/idlelib/colorizer.py",
          "bytes": 14783,
          "sha256": "4de77a632286cf7cb616a2cf50dcd16a99d452fe7b16bf94c34950be97f293c2"
        },
        {
          "path": "python/lib/python3.12/idlelib/config_key.py",
          "bytes": 15230,
          "sha256": "856bd4b2c1fd7275856d3869cad8975f7770edbf021a93c64816a41c2322c2fa"
        },
        {
          "path": "python/lib/python3.12/idlelib/config-extensions.def",
          "bytes": 2266,
          "sha256": "e75df0b77ff61253be457af636d5eb7c55a3ff2b6a733beea844d2b294972ebf"
        },
        {
          "path": "python/lib/python3.12/idlelib/config-highlight.def",
          "bytes": 2864,
          "sha256": "609eada44ff4aa9d5cd10ad8b4c29bb76db8ebc74912a0ae86f5ea3cd19b7547"
        },
        {
          "path": "python/lib/python3.12/idlelib/config-keys.def",
          "bytes": 10910,
          "sha256": "bee81ba5c5abec1e35e313268f8d8fe72d305d0ad73abfba3d2ea1e2b2308710"
        },
        {
          "path": "python/lib/python3.12/idlelib/config-main.def",
          "bytes": 3168,
          "sha256": "e783704ad5cd9b3f44c026f55c98be2c52190bf9b7832251283f3e953ba80f87"
        },
        {
          "path": "python/lib/python3.12/idlelib/config.py",
          "bytes": 38403,
          "sha256": "c1e1557b1fa2a161d42f6231ee36ef090b07bffe58839b3c58f008e39d4fa856"
        },
        {
          "path": "python/lib/python3.12/idlelib/configdialog.py",
          "bytes": 105310,
          "sha256": "eaf4a08fbd3a8b92fd77a6c3cd5be824c570b38340c3a9afe4f36580320a3d48"
        },
        {
          "path": "python/lib/python3.12/idlelib/CREDITS.txt",
          "bytes": 2148,
          "sha256": "4fca8182cab71d43991f3d9370a5a9df1389dab5626c19e0e0f1510a0dd84852"
        },
        {
          "path": "python/lib/python3.12/idlelib/debugger_r.py",
          "bytes": 12115,
          "sha256": "ddc797740231f068ca7c7c8610e799d72ad11af670d9bc0b6f9e04fe2ba222d1"
        },
        {
          "path": "python/lib/python3.12/idlelib/debugger.py",
          "bytes": 20991,
          "sha256": "6e595d5a388e46b6b6e24490e970a3d355ec116a16a064bfca6ed86d4b17dcb4"
        },
        {
          "path": "python/lib/python3.12/idlelib/debugobj_r.py",
          "bytes": 1082,
          "sha256": "4e583b43fdf9bd4a731d70e074ee597aba03f3c8c36302bdc7e74650fb1fcc11"
        },
        {
          "path": "python/lib/python3.12/idlelib/debugobj.py",
          "bytes": 4177,
          "sha256": "aae9e2468a3d05366480864dc56689c65896757faf3b0364b8eef9feb4876a43"
        },
        {
          "path": "python/lib/python3.12/idlelib/delegator.py",
          "bytes": 1044,
          "sha256": "c2b31919d27056fc3aaa8f4ef798fbdf162665175fa9216d665f58ba2e4a464d"
        },
        {
          "path": "python/lib/python3.12/idlelib/dynoption.py",
          "bytes": 1993,
          "sha256": "29933f56722b2efb5cf451825a7fe50f357983e68f6a261afdf89b52f778e488"
        },
        {
          "path": "python/lib/python3.12/idlelib/editor.py",
          "bytes": 69561,
          "sha256": "c564a1d52a311436e1242b959d1553599b3744d6ff7da1bf5dec28613bdae260"
        },
        {
          "path": "python/lib/python3.12/idlelib/extend.txt",
          "bytes": 3632,
          "sha256": "4b2c5af0c4f8e67f875b9f6a5a957b84a7b8732b73678953be4825232813a608"
        },
        {
          "path": "python/lib/python3.12/idlelib/filelist.py",
          "bytes": 3871,
          "sha256": "64e194e4514141414ecb231ac165ed861749bb0d31d0758c7c3a823ce154abe1"
        },
        {
          "path": "python/lib/python3.12/idlelib/format.py",
          "bytes": 15777,
          "sha256": "dc2b00fb239f38543bf973d94daef2c52457b905d4d89c640993823127b7923c"
        },
        {
          "path": "python/lib/python3.12/idlelib/grep.py",
          "bytes": 7521,
          "sha256": "f30014ca750f79c7742bbe9d363368a6fa8b484112dc5a1450f858792a1d2fb1"
        },
        {
          "path": "python/lib/python3.12/idlelib/help_about.py",
          "bytes": 9023,
          "sha256": "2f89f495a3ed95143ce74ba380fe34f779daf4598fec4c775c46cb43745a4fef"
        },
        {
          "path": "python/lib/python3.12/idlelib/help.html",
          "bytes": 60566,
          "sha256": "a60a5a7dca96fdf993126b74ed36b7f5dd5de81990600fbcd18ae2a67712c9e4"
        },
        {
          "path": "python/lib/python3.12/idlelib/help.py",
          "bytes": 11843,
          "sha256": "78e392dc7543838cd72e68baf51c0da2fe51669a381d04cd1304b927404155f5"
        },
        {
          "path": "python/lib/python3.12/idlelib/history.py",
          "bytes": 4065,
          "sha256": "f91f1568d083bdbc856d38ef48493bcb138c6a492d523385b300a5bac30133e6"
        },
        {
          "path": "python/lib/python3.12/idlelib/HISTORY.txt",
          "bytes": 10313,
          "sha256": "12a6e0d745e08d55616e65a91f26e3bf9585ca64b8cec04a1daf865e855b655d"
        },
        {
          "path": "python/lib/python3.12/idlelib/hyperparser.py",
          "bytes": 12889,
          "sha256": "18563d2b4c248aed70b7f29fd903fd51d1b5aceb3dc93c23f9a54141eed7a9b0"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/folder.gif",
          "bytes": 120,
          "sha256": "7c98d566a13fd599d1c11a375f387fef69b6c595c4f18c5d88c188a860be0e55"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_16.gif",
          "bytes": 634,
          "sha256": "fe3af292b38660a8a58b1a8b4fa4240aa190602e7e9a700ea0536b3181fc968e"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_16.png",
          "bytes": 1031,
          "sha256": "78fb3fb0ec11f61bc6cf0947f3c3923aa18e1c6513684058ed0fa01ac858143e"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_256.png",
          "bytes": 39205,
          "sha256": "3f517467d12e0e3ecf20f9bd68ce4bd18a2b8088f32308fd978fd80e87d3628b"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_32.gif",
          "bytes": 1019,
          "sha256": "fe70991cfccd1267922e94d91e02e9a58d2d29fd3382a2f4975280b9023cb7b9"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_32.png",
          "bytes": 2036,
          "sha256": "797cd05f1964d57c4c6c248ac7f7ea6a38019ada32a9ab7e6c28d060f87b03de"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_48.gif",
          "bytes": 1388,
          "sha256": "37484901eb40eefa846308e1da3ff6f240ea98f769a2afc3cf4fdba00327ecbe"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle_48.png",
          "bytes": 3977,
          "sha256": "a09f433197c8870b12bb7859cc4c3fe2068908cb1ddbd4880ab0f6fee91b6c23"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/idle.ico",
          "bytes": 57746,
          "sha256": "7f13eeb5dca39d05e24b9eb069c6dcb2748633822d67288a8bf8b7e21cdddf55"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/minusnode.gif",
          "bytes": 75,
          "sha256": "efa5aa1d1e3439ab85425bd2aa3a25b9e6c21309e672690cfb32219e1eb7a7f3"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/openfolder.gif",
          "bytes": 125,
          "sha256": "9a59e2abf1840156e9db8f85a38822fd56ab79a139eb95ec86f1fba1bb87326b"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/plusnode.gif",
          "bytes": 78,
          "sha256": "6ace9e90a2bcb16d06c4d78837137f2c14bc26b3bd9f24b7b6afeadb689bdafb"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/python.gif",
          "bytes": 380,
          "sha256": "158c31382f8e5b41fded0c2aa9cc66a382928b003cdd8b5b0518836ad9c89377"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/README.txt",
          "bytes": 1935,
          "sha256": "3feadfa48fb8e9025fccc91bff9ac494519137ed4a7d9b8f4e6847165b43de4e"
        },
        {
          "path": "python/lib/python3.12/idlelib/Icons/tk.gif",
          "bytes": 72,
          "sha256": "7f16cb2e322891dbd9101302c09ffda0c2a3a72d053bb8c0927d507414c59cad"
        },
        {
          "path": "python/lib/python3.12/idlelib/idle.bat",
          "bytes": 177,
          "sha256": "15a3977f0d2c6a8e87db2ef7050ea10afb3a88b064bf5ef95439924e42464114"
        },
        {
          "path": "python/lib/python3.12/idlelib/idle.py",
          "bytes": 454,
          "sha256": "33ffa2f718e123fd1c4e536bb4a471978515787ee9fbf7806a92073a787a733a"
        },
        {
          "path": "python/lib/python3.12/idlelib/idle.pyw",
          "bytes": 570,
          "sha256": "26101d297127132c5e9634499f41ad00e125ea308343a20b278bee9e9225eb5c"
        },
        {
          "path": "python/lib/python3.12/idlelib/iomenu.py",
          "bytes": 16159,
          "sha256": "7004f1ab2cfa5994e453f426507170ec37c1c4a5b9837ba319e5eaebf1a29c34"
        },
        {
          "path": "python/lib/python3.12/idlelib/macosx.py",
          "bytes": 9290,
          "sha256": "e6c687754bb60cd1015a413073b4d85b5e5bc7993c1acbfbc92d70600a83132e"
        },
        {
          "path": "python/lib/python3.12/idlelib/mainmenu.py",
          "bytes": 3938,
          "sha256": "092fad4454f593d7bf2e5e1e746acade92bb346d06476ba527f162f843ae3208"
        },
        {
          "path": "python/lib/python3.12/idlelib/multicall.py",
          "bytes": 18652,
          "sha256": "efb7d9bddcae17fab2108cb714c240c82d1368087b6d2b91e02ec224ddebce12"
        },
        {
          "path": "python/lib/python3.12/idlelib/NEWS2x.txt",
          "bytes": 27172,
          "sha256": "c89a3b513501ebace8e428aea68dce39d0af9f29196e08fc9ea49c99605e79e7"
        },
        {
          "path": "python/lib/python3.12/idlelib/News3.txt",
          "bytes": 56500,
          "sha256": "608bda1a7d2c95b3898328e7749725fd6c17d3039a9bab5b51de0bc70fca1200"
        },
        {
          "path": "python/lib/python3.12/idlelib/outwin.py",
          "bytes": 5705,
          "sha256": "a24f67d1ebe5e1dce84de0009d0caefaa1c795280507e1b0b7f0ea63d2ea68b4"
        },
        {
          "path": "python/lib/python3.12/idlelib/parenmatch.py",
          "bytes": 7204,
          "sha256": "f122e13c385a135cbbbe8b1d87efeed43ddd3e0be9ddd8aa24b267b61fac4287"
        },
        {
          "path": "python/lib/python3.12/idlelib/pathbrowser.py",
          "bytes": 3093,
          "sha256": "42a4e008922c991049f1b42ca18700b65f2f8d0ab6dd12cc22671771e90c2065"
        },
        {
          "path": "python/lib/python3.12/idlelib/percolator.py",
          "bytes": 3568,
          "sha256": "42fe72c167eb3a2795cbe64c498d7cbe1de05132be29a99a58226ae83efb31d4"
        },
        {
          "path": "python/lib/python3.12/idlelib/pyparse.py",
          "bytes": 19864,
          "sha256": "21c6bf43370998d5a5a6670f7b13409335e9a2c1a350ed586bbe63be5f226648"
        },
        {
          "path": "python/lib/python3.12/idlelib/pyshell.py",
          "bytes": 62194,
          "sha256": "a99a92f60190271720a5e3109126c937c435c6f181438038b97b20330f0b8c0b",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/idlelib/query.py",
          "bytes": 15067,
          "sha256": "faea5edd6b8693e6a32107054ad0de3be4d28e6aacb7792f86cbbe146131373b"
        },
        {
          "path": "python/lib/python3.12/idlelib/README.txt",
          "bytes": 11653,
          "sha256": "4f2dc8ffdbfc7837b60edc32ac2f593a220f4abf0ea00cc477382ad8ecf8eb3d"
        },
        {
          "path": "python/lib/python3.12/idlelib/redirector.py",
          "bytes": 6777,
          "sha256": "7911a7534eb0c73ee3e2464c5f8498109653f73ebed8fa903780c5fd7ca00754"
        },
        {
          "path": "python/lib/python3.12/idlelib/replace.py",
          "bytes": 9841,
          "sha256": "ea13db39aa89df369b36200c7301874a5636403e8270b1862f946e2fff081b84"
        },
        {
          "path": "python/lib/python3.12/idlelib/rpc.py",
          "bytes": 21078,
          "sha256": "8d0cb6e11c8dcc5dbda89b9a582bfaa74fe2b661dde442b02eb61b8fc47d9eb3"
        },
        {
          "path": "python/lib/python3.12/idlelib/run.py",
          "bytes": 21654,
          "sha256": "49a87a54dda2a595720d90f93a70045ac017f2dc826e578e2d2bb5360739db8e"
        },
        {
          "path": "python/lib/python3.12/idlelib/runscript.py",
          "bytes": 8273,
          "sha256": "b92740fddc7b1d603b1736a135bd15518081f20c0db1e1a779cab715ee9120fe"
        },
        {
          "path": "python/lib/python3.12/idlelib/scrolledlist.py",
          "bytes": 4478,
          "sha256": "25b0ad247977f6079226052e2b76dd4c127bf50f2f5e8ffbd1fe10bc631bfca9"
        },
        {
          "path": "python/lib/python3.12/idlelib/search.py",
          "bytes": 5567,
          "sha256": "c53ff4d4814d97d0d95b7e15030d3ae8c732366ed84c2b300183e933270df724"
        },
        {
          "path": "python/lib/python3.12/idlelib/searchbase.py",
          "bytes": 7852,
          "sha256": "d6db91e0d9aa869289f11677bcad7184be70fdb942d37b341cd9de6643f82f87"
        },
        {
          "path": "python/lib/python3.12/idlelib/searchengine.py",
          "bytes": 7415,
          "sha256": "11b0c8df926e4f6bd2e26d0264b2d902c41bcc70d68a4a830df1ea2da2c2a6cc"
        },
        {
          "path": "python/lib/python3.12/idlelib/sidebar.py",
          "bytes": 20338,
          "sha256": "760f14ebb0312adb289cda0562c9eff70982a0acde5d9d9d0b591390cd4a581e"
        },
        {
          "path": "python/lib/python3.12/idlelib/squeezer.py",
          "bytes": 12834,
          "sha256": "112221334fee94a88cba2ca7ac455e1bd6ab796397cbe036b1e8a98bc0787e30"
        },
        {
          "path": "python/lib/python3.12/idlelib/stackviewer.py",
          "bytes": 4016,
          "sha256": "ee053a65298e2ec2f4628d8269a33362816271fd81fab4e550a621493c26a76f"
        },
        {
          "path": "python/lib/python3.12/idlelib/statusbar.py",
          "bytes": 1474,
          "sha256": "3f4dc0f27b0c23e488d022abe8461529ce8a1b4eaf9dbfd97123ef2c502f684e"
        },
        {
          "path": "python/lib/python3.12/idlelib/textview.py",
          "bytes": 6808,
          "sha256": "eace58159e9636bb1456885c21f5ed474e203090139e5dd3457ac72ad5552006"
        },
        {
          "path": "python/lib/python3.12/idlelib/TODO.txt",
          "bytes": 8477,
          "sha256": "97a1d6cafad64ba55456ea99b46ebb3a1ef6af4babee8f3cc8877084c2e772d0"
        },
        {
          "path": "python/lib/python3.12/idlelib/tooltip.py",
          "bytes": 6665,
          "sha256": "f2779d85a9a1ddf302364e9087ceacf270938f24f3c13f3332a1bdda0414d296"
        },
        {
          "path": "python/lib/python3.12/idlelib/tree.py",
          "bytes": 16773,
          "sha256": "eaa604df6184f7efc90edf4cd725db718508898d87c17699fe812690c09d9093"
        },
        {
          "path": "python/lib/python3.12/idlelib/undo.py",
          "bytes": 11016,
          "sha256": "291fda98995bb4688fbe05fd3fa689e21aade3627c4c16e8971ed353f6cc3107"
        },
        {
          "path": "python/lib/python3.12/idlelib/util.py",
          "bytes": 1312,
          "sha256": "91cfc9e882b1b67a166a8a98a139904c40d6d62efad754b9b344f91cf82e1495"
        },
        {
          "path": "python/lib/python3.12/idlelib/window.py",
          "bytes": 2616,
          "sha256": "ca31d8c01c9b468fcad0a4e529c8e205c1e4ecf30520545db654d466bd7158bd"
        },
        {
          "path": "python/lib/python3.12/idlelib/zoomheight.py",
          "bytes": 4203,
          "sha256": "5f6ff83cb0df3ee5e7d997ffe23efb341b994bfbaf00b79a4832d54231a095dd"
        },
        {
          "path": "python/lib/python3.12/idlelib/zzdummy.py",
          "bytes": 2005,
          "sha256": "5e248f0ea4f35052d23bb2c43564aa567b8cebaf91fd63ba0be8fef2f4167945"
        },
        {
          "path": "python/lib/python3.12/imaplib.py",
          "bytes": 54040,
          "sha256": "ab3d485f7ee89deaf132533cd135888326be3c92a88ede79a16fa4c0e4709632"
        },
        {
          "path": "python/lib/python3.12/imghdr.py",
          "bytes": 4398,
          "sha256": "c1bb52ea0816db4c5f3420655ab4a476fb3829709141e91f1a56b9c6fe286d56"
        },
        {
          "path": "python/lib/python3.12/importlib/__init__.py",
          "bytes": 4784,
          "sha256": "d540b5ac137fcb3e26a8d5f2939649e34373c6685f98a30a9f682cf231be5854"
        },
        {
          "path": "python/lib/python3.12/importlib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4638,
          "sha256": "85e4fba33db7071d4e39deaf12d002a3e7ecefba2568cd6dab0759a9e2f35c0c"
        },
        {
          "path": "python/lib/python3.12/importlib/__pycache__/_abc.cpython-312.pyc",
          "bytes": 1705,
          "sha256": "b06d3a5e10c4af433697a29ba8e04682190bd4138049e84da73ea7cf2c614b40"
        },
        {
          "path": "python/lib/python3.12/importlib/__pycache__/abc.cpython-312.pyc",
          "bytes": 10473,
          "sha256": "4dcc410f1827a4ce1768817aca22539c083b9e1c7ffd8cb8fd83151d7d2bece7"
        },
        {
          "path": "python/lib/python3.12/importlib/__pycache__/readers.cpython-312.pyc",
          "bytes": 524,
          "sha256": "0db996836edc11043ed7431380b7de2dc4e9aa06c2c56a23158397d3a5e80eb5"
        },
        {
          "path": "python/lib/python3.12/importlib/_abc.py",
          "bytes": 1354,
          "sha256": "80aab7931dc999dee581c8b8b56fcd973fe156335a96ceeaf6acfc03cebf10e8"
        },
        {
          "path": "python/lib/python3.12/importlib/_bootstrap_external.py",
          "bytes": 69428,
          "sha256": "e6ad72f3f0f9b65c99ab52598cd02ab748511dcdce1dd51f18dace9be9a680c6"
        },
        {
          "path": "python/lib/python3.12/importlib/_bootstrap.py",
          "bytes": 57057,
          "sha256": "d112d54b7831cf4a818d4841d5ff8003b54df220a6dabafa61f67d7c7a5603f7"
        },
        {
          "path": "python/lib/python3.12/importlib/abc.py",
          "bytes": 7612,
          "sha256": "5f9cb36ca1bce9d5df00bc8d4d7f46b7ea2353dfa99292ad7f099affddfb5d03"
        },
        {
          "path": "python/lib/python3.12/importlib/machinery.py",
          "bytes": 880,
          "sha256": "d045cd7ecf2a12b6ecbfbef79eb114e87ef2ebd756f5b705f73e6f3266e3dede"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__init__.py",
          "bytes": 28757,
          "sha256": "1a26dfee8cb302b729501e944626f77e2cbcc4675038f3d18c2d8534751b3e8b"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/__init__.cpython-312.pyc",
          "bytes": 48499,
          "sha256": "f0104d15f116d7285dddb2c0c2577e5ca7c9635ac2b5e9274292878a573ee0e0"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/_adapters.cpython-312.pyc",
          "bytes": 3900,
          "sha256": "ad400cac66fc8402a2557f3e9ba630aced93959f9b7c980b383d95be4fd8bf78"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/_collections.cpython-312.pyc",
          "bytes": 1943,
          "sha256": "ce6678f8ec3b6876eda3b7054fecd5f04742583626872930f1aec7f212e13867"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/_functools.cpython-312.pyc",
          "bytes": 3505,
          "sha256": "6f1f1120a88ec8bbba10303ba290402932878b69e8d82da9414630d310374a02"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/_itertools.cpython-312.pyc",
          "bytes": 2418,
          "sha256": "9a147e6e08eda96bd48362e8ecffc48218667ab469d785c43bbc27e868ae88cc"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/_meta.cpython-312.pyc",
          "bytes": 3343,
          "sha256": "a729b1185a903dc9f7357b72a9db316f9550f44ad404833fb685be0b03e6b4ac"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/__pycache__/_text.cpython-312.pyc",
          "bytes": 3904,
          "sha256": "af85350fa8731c5ee1df76d1482eb6a3549f5735ed7a1ba2d727b939de8d293d"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/_adapters.py",
          "bytes": 2406,
          "sha256": "de9a880abc4513af1b69ce150cd5a5093201c39131717cdc2ba6b19f4364c163"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/_collections.py",
          "bytes": 743,
          "sha256": "089d0e4c21c88d6034648552e2fa0e440b27d91e11d9c40112d3ec6442690126"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/_functools.py",
          "bytes": 2895,
          "sha256": "3ec636fb8aeb297e1155e442d681a9d65075a660bd78a37cf3f7fe6c3f6e3a80"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/_itertools.py",
          "bytes": 2068,
          "sha256": "72faffdaff0145bc5c225e71e6575fa9d1e3848f188bcb3cca4e741bf9e6ea34"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/_meta.py",
          "bytes": 1590,
          "sha256": "bd3504040497cd049e6b529bde0b461f63cd2be3070f2d0815d4dd7609b266c8"
        },
        {
          "path": "python/lib/python3.12/importlib/metadata/_text.py",
          "bytes": 2166,
          "sha256": "1c2b0592c66924b7933f734493f9e0ac079755146d4ebb7287d78e001a113f80"
        },
        {
          "path": "python/lib/python3.12/importlib/readers.py",
          "bytes": 327,
          "sha256": "d0d57d118d64916f7e6edb04f8bd1a760a1abb879125899ef50a36d09ef54df4"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__init__.py",
          "bytes": 532,
          "sha256": "4146e1d00d56a783d4087f15257f0c284fae52e71fa3f20613fa268d911bf6d5"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/__init__.cpython-312.pyc",
          "bytes": 716,
          "sha256": "a586d1dfaa13f98cf20680ec876587a232616d95571f6e74a0782fcafd2fa1fe"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/_adapters.cpython-312.pyc",
          "bytes": 9690,
          "sha256": "3b5589324d85d04c39501becda010117f14be8eeb82449be1a21b3ab5957800f"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/_common.cpython-312.pyc",
          "bytes": 8810,
          "sha256": "4920cd6db434664561fb362f75cda4a930910f739eb0ae6fa9c8cae17a3a6c01"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/_itertools.cpython-312.pyc",
          "bytes": 1601,
          "sha256": "43170aca84c24ed88426ce1466ed1d462405ae34c57afbe5ac3f86771e6da372"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/_legacy.cpython-312.pyc",
          "bytes": 4922,
          "sha256": "8c7c4a0191555ba04504e6a2de8287c266ffd76ee3c322a5d182b8de8f61e3a3"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/abc.cpython-312.pyc",
          "bytes": 8982,
          "sha256": "a1c22dadc280117689cbe3eda6ed762e9f69323e093957fe8717cd0b495cfb23"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/__pycache__/readers.cpython-312.pyc",
          "bytes": 9060,
          "sha256": "5ba326c250219cb8e8843fa76e7345c407a6c69d204f3bd34197294b293afe6c"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/_adapters.py",
          "bytes": 4482,
          "sha256": "be9ac919b51e1db6a35fa5c2b8c3fa27794caea0a2f8ffcc4e5ce225447b8df9"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/_common.py",
          "bytes": 5486,
          "sha256": "a0de4a899a2aa787b052f92f516b39f80b183c3f0d409d1305cc6dc374f18870"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/_itertools.py",
          "bytes": 1277,
          "sha256": "7838ac57a46a88d64ea202d25dfe8b3861ce61cefd14680faca34bcc52e60ab5"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/_legacy.py",
          "bytes": 2949,
          "sha256": "79c566fdf1a61129683e38e8c11a660d6233dd84422456ae5dd230e658a7857f"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/abc.py",
          "bytes": 5203,
          "sha256": "a726c48590b21ba5532f0c654735991571bc0ecafe88145cb8891d82cd364e5e"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/readers.py",
          "bytes": 4370,
          "sha256": "10884a02b4a97636887fcedc7bae248a4ff42f3e52abb80d613cc0b2190b6ce9"
        },
        {
          "path": "python/lib/python3.12/importlib/resources/simple.py",
          "bytes": 2584,
          "sha256": "090dd3888305889b3ff34a3eef124bd44a5b5145676b8f8d183ad24d0dc75b66"
        },
        {
          "path": "python/lib/python3.12/importlib/simple.py",
          "bytes": 354,
          "sha256": "8e687aeeb1db537d2717cb0352c5f126ff7d4095c6de6dc7f00d5103f3009c40"
        },
        {
          "path": "python/lib/python3.12/importlib/util.py",
          "bytes": 10994,
          "sha256": "671f2995653f673f6d5056a1089debef473bc28ae7114f7a8db71475733d6876"
        },
        {
          "path": "python/lib/python3.12/inspect.py",
          "bytes": 127125,
          "sha256": "5c54ebf0bfdc25397750e5d0f63800751650ee50e65325ff3ea4069c9bfa5f75"
        },
        {
          "path": "python/lib/python3.12/io.py",
          "bytes": 3582,
          "sha256": "7cec3cb8ac004058dd0a5af246e6d950fb59c7ddd0058fda48bcb3fcb98d8822"
        },
        {
          "path": "python/lib/python3.12/ipaddress.py",
          "bytes": 81414,
          "sha256": "ba8d3389ff084fcb232b48204ec04f2b3ea4bd0eadf7b18c814947d185de2c64"
        },
        {
          "path": "python/lib/python3.12/json/__init__.py",
          "bytes": 14020,
          "sha256": "d5d41e2c29049515d295d81a6d40b4890fbec8d8482cfb401630f8ef2f77e4d5"
        },
        {
          "path": "python/lib/python3.12/json/__pycache__/__init__.cpython-312.pyc",
          "bytes": 13677,
          "sha256": "7b07a46939673a0f3420df392329c8ce28e8f5b644ed1bfeb73b0c9ff79ac06c"
        },
        {
          "path": "python/lib/python3.12/json/__pycache__/decoder.cpython-312.pyc",
          "bytes": 13975,
          "sha256": "4644f7ea6bba3b74dde366ef92ba9ad6ee428b75239be2f3328b70b1c73c06ac"
        },
        {
          "path": "python/lib/python3.12/json/__pycache__/encoder.cpython-312.pyc",
          "bytes": 15150,
          "sha256": "838ae4001655d41150ed7fda490d30218a0e29fcb2ace5c68e1ab75a4420229b"
        },
        {
          "path": "python/lib/python3.12/json/__pycache__/scanner.cpython-312.pyc",
          "bytes": 3392,
          "sha256": "2210c3abb27ddf9a529a195ee329d499bdd8a8d3eb206d9fc7c113a3f9daa495"
        },
        {
          "path": "python/lib/python3.12/json/decoder.py",
          "bytes": 12525,
          "sha256": "382cd02af6f7efede5a6d4abbcda1015e5c7a75794b0016022878f9cf32a24f6"
        },
        {
          "path": "python/lib/python3.12/json/encoder.py",
          "bytes": 16075,
          "sha256": "52bfb1b66029cc70fa3bd7fe11df9f2e03922d413407a341b387a22c987f24f8"
        },
        {
          "path": "python/lib/python3.12/json/scanner.py",
          "bytes": 2434,
          "sha256": "572958017eae8842eeddd0e3d18d3c56cc0a197348224915e1d87ce937841764"
        },
        {
          "path": "python/lib/python3.12/json/tool.py",
          "bytes": 3339,
          "sha256": "d5174b728b376a12cff3f17472d6b9b609c1d3926f7ee02d74d60c80afd60c77"
        },
        {
          "path": "python/lib/python3.12/keyword.py",
          "bytes": 1073,
          "sha256": "18c2be738c04ad20ad375f6a71db34b3823c7f40b0340f5294d0e89f3c9b093b"
        },
        {
          "path": "python/lib/python3.12/lib-dynload/_crypt.cpython-312-darwin.so",
          "bytes": 50720,
          "sha256": "3d4334d4041412a4842ea469b2b6b7a899a62cdf52f26a58ab18fb8973c95fce",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/lib-dynload/_dbm.cpython-312-darwin.so",
          "bytes": 53952,
          "sha256": "16372abd9400b9399e50e8b6ae92b5ae98bc9dafee75d6d59e77324dcd3e6f27",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/lib-dynload/_tkinter.cpython-312-darwin.so",
          "bytes": 100096,
          "sha256": "320a9db3673380a56c5269ba28ce9d20588d6c422a530f02a761825af92a2c10",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/lib-dynload/.empty",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/lib2to3/__init__.py",
          "bytes": 156,
          "sha256": "5373a81ab198cda8e95652dff46ecfee197a0b8901e8432ab448d97b8bc37f87"
        },
        {
          "path": "python/lib/python3.12/lib2to3/__main__.py",
          "bytes": 67,
          "sha256": "c7b09f90e66dea194ad63dc02c6425dff977d16f1f21a157b7475905c219a707"
        },
        {
          "path": "python/lib/python3.12/lib2to3/btm_matcher.py",
          "bytes": 6623,
          "sha256": "a1aa5d35558acf4b6016054963285cb145f97a764926bea07cbd674563f3248d"
        },
        {
          "path": "python/lib/python3.12/lib2to3/btm_utils.py",
          "bytes": 9945,
          "sha256": "c0653eb497a1a48195dd9c4ecbbf87e4eab31188be29ab1640e353209741588c"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixer_base.py",
          "bytes": 6690,
          "sha256": "c795a53ca849c42212c8ec33a74284e0377df852eb4ea599aba62d5af1df282a"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixer_util.py",
          "bytes": 15206,
          "sha256": "306d0b2ea8169bdca711c6a31c0b1a3ce710d38ae2b6568ef519aa38451af608"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/__init__.py",
          "bytes": 47,
          "sha256": "836cdb388117cf81e78d9fa2a141cca1b14b0179733322e710067749a1b16fe9"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_apply.py",
          "bytes": 2346,
          "sha256": "b5171e32758a78450854f40867775d4aca58665bc920ebece04fcfcc153af02a"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_asserts.py",
          "bytes": 984,
          "sha256": "4c77972812cb5ec0a72afbce3e1d618c27ef7b239329c5c952c2bcbe77dba5dd"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_basestring.py",
          "bytes": 320,
          "sha256": "d041443d6499a735bb78fec9da1bf33b3d034b5192c98bc273b16a44692fc88f"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_buffer.py",
          "bytes": 590,
          "sha256": "2da37b49c30d6a0b4db43146ebb4ac8e5ffcb9814816b4742e464cb856977883"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_dict.py",
          "bytes": 3760,
          "sha256": "38f460596ebfb64046aab3d9a65935bd4c76a470118fb7d10a088dc0ecdc53ea"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_except.py",
          "bytes": 3344,
          "sha256": "7ff6f560c3c3d7a5d9ceef5ba31c556341f7ce1bc1b52d96b063f6c2c4765651"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_exec.py",
          "bytes": 979,
          "sha256": "9e0893327205dea12004e88d18c580286e7977e081b5eda7baf5b7bc93bc6c52"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_execfile.py",
          "bytes": 2048,
          "sha256": "6ff65db1192099457cb3d9f2618a893c6ac430028550284f3a34d5c08042b0eb"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_exitfunc.py",
          "bytes": 2495,
          "sha256": "ef4f18f651d32410c43644c27590903d41e38e763b0e108e6c685a3412a7d29c"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_filter.py",
          "bytes": 2765,
          "sha256": "2c7f0121193395750eab2b2abf5059d9a3b1a61f81763f52511265d7bca5cb21"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_funcattrs.py",
          "bytes": 644,
          "sha256": "111df53fac6a121d61abe33883a68e731820ddc4864b0a4c1000cf2ac5f019cd"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_future.py",
          "bytes": 547,
          "sha256": "baba8cafb48dd9181a0e1f7b0f20b585ce2925e8f347e00b87407a256bb16663"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_getcwdu.py",
          "bytes": 451,
          "sha256": "5bc5252f683a401e7d81c5911617c4af1a1bcdf99a51c4bf1cfccb00446ff220"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_has_key.py",
          "bytes": 3196,
          "sha256": "32943d3b921c1c3f0d3776d19e5120806990b817bc99a7e22799847abfda1f63"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_idioms.py",
          "bytes": 4876,
          "sha256": "600e34faf36e14307e59d55088e3979881d497b8fc9d77659e77709f9e8bafd7"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_import.py",
          "bytes": 3256,
          "sha256": "803baf96f9603c957eb974f252b0ad9829c889a293e0ce6829db1bce3da6dd4e"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_imports.py",
          "bytes": 5684,
          "sha256": "cdf7ee6d85e2b148230984cfc4ea3f193be458958ea42ef290854a9672a64370"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_imports2.py",
          "bytes": 289,
          "sha256": "b6f3c628839ffe7fd72569dd6ca2210e18edae3e180002747ea011b76b7ec0ef"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_input.py",
          "bytes": 708,
          "sha256": "10c5ef3b45a4ee7e88af8852181916a788aae2bea52b08f3473815c1c43598d1"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_intern.py",
          "bytes": 1144,
          "sha256": "8d29a162536b99c91bd2f9259dda7f39fec751949d6354d2c1f2e5d070c87d66"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_isinstance.py",
          "bytes": 1608,
          "sha256": "8408c92b99f50d8c4978b47a2b2155588e315f2ebbe58c160dcdcdcb89e19914"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_itertools_imports.py",
          "bytes": 2086,
          "sha256": "2e419cfbd7f2a326ae7fa10873aa377112ebec32545238fdf988acb088c3cdb7"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_itertools.py",
          "bytes": 1548,
          "sha256": "578a51b9935020b03a510de15ece55fcd02c9474f37a54c158fb97ba5fd15af1"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_long.py",
          "bytes": 476,
          "sha256": "306b80e0a72c0d16dd934b7d51ab0c9a4224f83be5d6cbad8a7158a0a5d73551"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_map.py",
          "bytes": 3640,
          "sha256": "b82c0762c44adf2af7745c030afe291e2badfe360925046c8e58d85340717696"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_metaclass.py",
          "bytes": 8197,
          "sha256": "45a30c866aa2ff69e089da147ed09986aad4516b5e5dd943f8dfcb7d3946a3e1"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_methodattrs.py",
          "bytes": 606,
          "sha256": "8d60082f98ce52ee4955099bfd447cbadfa0e9b24ccb8d135cecc833168d44e8"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_ne.py",
          "bytes": 571,
          "sha256": "4f9cb1388ba86f29422d20979d3423fdf3541ba35a17ed44d6f4a517ff784ecd"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_next.py",
          "bytes": 3174,
          "sha256": "5c7d86d9f81b2498486d626c7feced1b92f23171cf9e42881abb78de1a93bccd"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_nonzero.py",
          "bytes": 591,
          "sha256": "c2cd7e3ba44508643a20eec4ea4c19f2f1adfd36f6b974d7c143e449571ae736"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_numliterals.py",
          "bytes": 768,
          "sha256": "1c4dd0f7881999abde6cf4d232836fa3e55fc41a7d5aa2b9866092f65707db7f"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_operator.py",
          "bytes": 3426,
          "sha256": "023872fe9f03a25387cf2c17fc950cf0f990353df66e603c3a1cd3199dbccd86"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_paren.py",
          "bytes": 1226,
          "sha256": "53734f1d7778ad28a4ec3ab4415923e2da8f230de4cd527589829f570e9f254d"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_print.py",
          "bytes": 2844,
          "sha256": "cf2690f1b502249289f52cd544190db0b94d59df5eca139829cd2bf0742e9dba"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_raise.py",
          "bytes": 2926,
          "sha256": "c38ffec5862597ee8f9dac50385af943ee312bfc394366be08b2fc12563ca1a5"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_raw_input.py",
          "bytes": 454,
          "sha256": "ce04cbaa76d414949afc230360dd9a29ff579bd868cc7f8805230d126ac9ce9b"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_reduce.py",
          "bytes": 837,
          "sha256": "9a03910a6c183586e1db01863fcde6417d06745fb3e63032333d71c5e82e7919"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_reload.py",
          "bytes": 1081,
          "sha256": "17570148167e43b2155b6e1c814a3cca9e3ef53750c504932a9c7d62a8b68a3f"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_renames.py",
          "bytes": 2221,
          "sha256": "8b71472317bf3adabf819e665c725d03e3064baa45f6ffbfd78cca83eaa46e8d"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_repr.py",
          "bytes": 613,
          "sha256": "d16930b7ef8577747cfef602aba854c64ce85d4ae1e54a18a456eaa202643e3d"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_set_literal.py",
          "bytes": 1697,
          "sha256": "33f2c0b6e16357e083c3a98877e7317abe1578a44c288e5979c9d96fb5aa6727"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_standarderror.py",
          "bytes": 449,
          "sha256": "ce7eb37bc7fb29aa138b1cec6656ae8b4886cbfa700e119a1bb8484284cb717a"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_sys_exc.py",
          "bytes": 1034,
          "sha256": "0143830586d09d702ca3eeaa8f86698e5fd18af69fd28147e71a1a77600d356a"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_throw.py",
          "bytes": 1582,
          "sha256": "fec731ed523d5cdfa21893833b52b2844eabfd1549792c1c9f8ceac2d0e8e901"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_tuple_params.py",
          "bytes": 5565,
          "sha256": "f3307d4750d0657d9c42b857d5f37bdb5824f9358939da7d16d13f61eb8abc72"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_types.py",
          "bytes": 1774,
          "sha256": "a0a133cfc78e82e1f71ce628408e7d10a38552ba3e3228ebd113838c1ce44484"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_unicode.py",
          "bytes": 1256,
          "sha256": "01b2a9b1084b6a0424f27eec488c761f75f053a409608ec36a9ee0ede0d38097"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_urllib.py",
          "bytes": 8367,
          "sha256": "3d1c04d976ff4d2841025a785aaab0cc4ee06c9c9b4e09d1e2456949fa273856"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_ws_comma.py",
          "bytes": 1090,
          "sha256": "5e7a16daec0b2619110516804bf90cac459a4d0315198fd4eff69c36c54378dd"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_xrange.py",
          "bytes": 2694,
          "sha256": "60d8ce92db6f399606d2e40a3c631ba566127e8cd637ebbf35b822672139cab2"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_xreadlines.py",
          "bytes": 689,
          "sha256": "e8c2f19f7047bfc7539fd78839929004d8fe0efba1fbcbd9d712d285e43834ba"
        },
        {
          "path": "python/lib/python3.12/lib2to3/fixes/fix_zip.py",
          "bytes": 1289,
          "sha256": "55ce115556c7513dd967364dc6a40c39210c874e8168cf090ddd6dc606df34cb"
        },
        {
          "path": "python/lib/python3.12/lib2to3/Grammar.txt",
          "bytes": 8696,
          "sha256": "508e62e787dd756eb0a4eb1b8d128320ca02cd246ab14cc8ce0a476dc88cc5b6"
        },
        {
          "path": "python/lib/python3.12/lib2to3/Grammar3.12.14.final.0.pickle",
          "bytes": 15313,
          "sha256": "97c8ed74d091fcfd23498029bb819c29d096c3dcb1326edee5dfb0591ade2e4b"
        },
        {
          "path": "python/lib/python3.12/lib2to3/main.py",
          "bytes": 11854,
          "sha256": "8f5dfa77b8c8b375daba8bb88aaa195395674311e2513b29575a70821e3aa0b8"
        },
        {
          "path": "python/lib/python3.12/lib2to3/patcomp.py",
          "bytes": 7054,
          "sha256": "a033a3eb91a39f96747d4300aa3394965e529c71896cd6503dd27e6b685eede5"
        },
        {
          "path": "python/lib/python3.12/lib2to3/PatternGrammar.txt",
          "bytes": 793,
          "sha256": "ee5ba5db3b6722a0e2fbe2560ebc1c883e72328ef9c3b4da1c7c5d1cc649bce3"
        },
        {
          "path": "python/lib/python3.12/lib2to3/PatternGrammar3.12.14.final.0.pickle",
          "bytes": 1225,
          "sha256": "36ee934395b9209737b13893ddaff05fad8e239c2fdfac29d401d3fceeb30768"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/__init__.py",
          "bytes": 143,
          "sha256": "858eb0f50533bd3bd16fe32815f77fabfed92ede885070b6cb15827ec66ea500"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/conv.py",
          "bytes": 9642,
          "sha256": "e2946a686c12e02248fafb1a57e7514e0c22bdb2b4a66e644215c86fedc37bff"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/driver.py",
          "bytes": 5969,
          "sha256": "57af5e220cd6c6b75e8dead2cea395ead2297dd98e398ad705ca2bce0e9e6594"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/grammar.py",
          "bytes": 5552,
          "sha256": "4898d446d6ae73f7259a3f91839eca1a3380670a9f378b80780707f714fad17c"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/literals.py",
          "bytes": 1635,
          "sha256": "84bc9d5387a2e20fab844e530358571afa39fa3fc0e8024270b5f7d8ac5a595a"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/parse.py",
          "bytes": 8155,
          "sha256": "e245e005e524ab445a570df31f70c6fd7b901ee3b0b68bd3bcf4b41b37fa7bb6"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/pgen.py",
          "bytes": 13830,
          "sha256": "8fe2ac7e0303f0110d75832d746e6661fcd5373fa498d929163f557fd1027434"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/token.py",
          "bytes": 1302,
          "sha256": "7ee05616410d46d8caed0cb0755bf780c62cccf17e3c93c8ccb8dcaaa1e7094c",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/lib2to3/pgen2/tokenize.py",
          "bytes": 21119,
          "sha256": "aaa0b98f6a65e08e9f8e34358198e329d29554a0d4b5f5059924a252eeb0f5c4"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pygram.py",
          "bytes": 1305,
          "sha256": "b49d77876a9d1822ff6be04daf464341a8e4c0c3414240abf519254de2a97a48"
        },
        {
          "path": "python/lib/python3.12/lib2to3/pytree.py",
          "bytes": 27974,
          "sha256": "e53689352fb4fc83d85a09369650389ee01db802ad872a8abfc0bf6603ec38b9"
        },
        {
          "path": "python/lib/python3.12/lib2to3/refactor.py",
          "bytes": 27507,
          "sha256": "6e9a4262fb65cd4d277f009df73ffa5748f5fe3b963d3c5395c160d5f88b089b"
        },
        {
          "path": "python/lib/python3.12/LICENSE.txt",
          "bytes": 13936,
          "sha256": "3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf"
        },
        {
          "path": "python/lib/python3.12/linecache.py",
          "bytes": 5800,
          "sha256": "9eb9194707991b49f9fea67a5222b0e6a0e49c865cdffc69fbc80a1f829e77fb"
        },
        {
          "path": "python/lib/python3.12/locale.py",
          "bytes": 78599,
          "sha256": "3988c5419552d5b9f0bef3695102376f79357f0f440e9cd1f32c501f966e6ef3"
        },
        {
          "path": "python/lib/python3.12/logging/__init__.py",
          "bytes": 83437,
          "sha256": "43f86bbc08fdd5c7b6e697abffe1381f534a92bb32e1f1aee8360d6a142592a1"
        },
        {
          "path": "python/lib/python3.12/logging/__pycache__/__init__.cpython-312.pyc",
          "bytes": 95467,
          "sha256": "64de9a08938c6a3a137ede2322cdd94a7755732ba545b9f6343a821c4ea9f1af"
        },
        {
          "path": "python/lib/python3.12/logging/__pycache__/config.cpython-312.pyc",
          "bytes": 43842,
          "sha256": "0c4cdd439b097dfdde70df27f910be47703fae1a5d4a8d1cc4d63c1670d6bb4c"
        },
        {
          "path": "python/lib/python3.12/logging/__pycache__/handlers.cpython-312.pyc",
          "bytes": 67235,
          "sha256": "fc6a9de4c6798e9d5b38cd24802c08cb7d487f2b175ccdc5711ead660da844e3"
        },
        {
          "path": "python/lib/python3.12/logging/config.py",
          "bytes": 42798,
          "sha256": "6b4bdac4318ee794f667a5d5df30040abf70b9786ec5ed8bf597bd8ad0b71d27"
        },
        {
          "path": "python/lib/python3.12/logging/handlers.py",
          "bytes": 62596,
          "sha256": "e0d31066e1d11142dc795af60351ea3610c2a08ff1cedf705743ce4522517495"
        },
        {
          "path": "python/lib/python3.12/lzma.py",
          "bytes": 13277,
          "sha256": "58fb9d2fdc8a8af7b25e218f17ea3b51bdfa53bdf40f440ab33c605974ca5c2e"
        },
        {
          "path": "python/lib/python3.12/mailbox.py",
          "bytes": 78911,
          "sha256": "1c356f03e8df0b99d9d40a08ac7f3f5f71e9626c3ee1149cbed7307968ba0a4f"
        },
        {
          "path": "python/lib/python3.12/mailcap.py",
          "bytes": 9333,
          "sha256": "d3242c92bfedb13c7cf5e7aa116e9a38c07e9c6de58f53d03f72a469e9448ca6"
        },
        {
          "path": "python/lib/python3.12/mimetypes.py",
          "bytes": 23037,
          "sha256": "ed21537405f4b076318f966b810ae1d9415e16315603ad8003b1ecb24baf5950"
        },
        {
          "path": "python/lib/python3.12/modulefinder.py",
          "bytes": 23699,
          "sha256": "e07ab000c3698a7530af2c52955ac8bb7647140d22dca1c30f83443faa191e0f"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/__init__.py",
          "bytes": 916,
          "sha256": "a5a42976033c7d63ee2740acceef949a3582dcb0e0442845f9717e1be771c68b"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/connection.py",
          "bytes": 41398,
          "sha256": "c2f2d6f3d32d48d4d8c51a7d7c98766a04e958cae72a67c7f905438a7c332bdd"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/context.py",
          "bytes": 11673,
          "sha256": "63f15d3169f4453eb80af4ce673a193a0670941206673ab5192ea16a17e8419f"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/dummy/__init__.py",
          "bytes": 3061,
          "sha256": "9127a40ea0ff342cb414383b5e7c594a05be2dd835fe246bd3bb0dc036a32a90"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/dummy/connection.py",
          "bytes": 1598,
          "sha256": "d63dd1979fde9c133efe430ee870e6ba6de43c0a0513866ce3ce475791fe57ab"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/forkserver.py",
          "bytes": 12202,
          "sha256": "11c9f2e90ae7b0d5882a608ecc074047c10c7360834b026865696a0439bf873f"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/heap.py",
          "bytes": 11626,
          "sha256": "f6bb79bb99b9ae484935f0d68822e9603a1622dd0b6c4966c79db232a93ba614"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/managers.py",
          "bytes": 47893,
          "sha256": "2cb074d33a3085904e1702b0b521b22fd3428d499fc656cd740e338f6e129333"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/pool.py",
          "bytes": 32760,
          "sha256": "418cd41ea5c341e66c6979a38070f6f552cbbdf0539073022b6d15c67e53f480"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/popen_fork.py",
          "bytes": 2377,
          "sha256": "0a09db57e7fab7061c01a61778feea6e2b6bb02ccbc150332f2960b05258ef95"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/popen_forkserver.py",
          "bytes": 2230,
          "sha256": "0588ad0e5a36718b4377dc2a2a97864a10986c25a33dc3bfed12595711b0cdab"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/popen_spawn_posix.py",
          "bytes": 2029,
          "sha256": "97b5d25aa479516894489877e6a7921252ee35f51e118c2f1f91f32919e7caa8"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/popen_spawn_win32.py",
          "bytes": 4515,
          "sha256": "6ef8efd9cd4e99c64a6778f7ad0957e924de9eb4aa167337ed121a2621b1ffaa"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/process.py",
          "bytes": 12139,
          "sha256": "67f0c2a7a3a83c92dd024705bac18619a2e123c9df77c414beb81035ea4a0e18"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/queues.py",
          "bytes": 12693,
          "sha256": "f4721a323ab2981a172dd2b853d2cfeded696e9716fba340cf6e168f5ed95f83"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/reduction.py",
          "bytes": 9512,
          "sha256": "4999f8b9ae7b3e8a7f5de302612b4131498dc2e238a2c47f894905c1c63294fe"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/resource_sharer.py",
          "bytes": 5145,
          "sha256": "bba3c7f2b76a9cf4e8ceb642801c405411da95adf91947d81b0043586038290e"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/resource_tracker.py",
          "bytes": 11077,
          "sha256": "f9d73a8145f8026ec48ebe4127e7e84960e297cb2e247159f8df4f858cfccbf6"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/shared_memory.py",
          "bytes": 18458,
          "sha256": "51301e70710220e1c494ff5383ac94442a38a4a6622f2eb94e40128c45de1aeb"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/sharedctypes.py",
          "bytes": 6306,
          "sha256": "77ef522912474652490b7df523112858e51721e63dcf109b8567a35ce9b31b0d"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/spawn.py",
          "bytes": 9644,
          "sha256": "ebf9fa40eb622384c37690d8c78e7208744df031155ab4ceedab0fc791a1669b"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/synchronize.py",
          "bytes": 12272,
          "sha256": "78ff49cff58c0c590324e5097241371f25d61d592c598a8b2c2788f2de32a53e"
        },
        {
          "path": "python/lib/python3.12/multiprocessing/util.py",
          "bytes": 14261,
          "sha256": "6752c4515ec69f82e9df64e017da490c3754e51d818c270ea1ad2d64e09268be"
        },
        {
          "path": "python/lib/python3.12/netrc.py",
          "bytes": 6922,
          "sha256": "229da6d0cbe6a10295be6c64ac3806420ea018124c09e4887410548fc2fc8b5d"
        },
        {
          "path": "python/lib/python3.12/nntplib.py",
          "bytes": 41087,
          "sha256": "6a76a94b951b273aa87335d7c9c4d7273e4c59485c784b057f681443b32d9004"
        },
        {
          "path": "python/lib/python3.12/ntpath.py",
          "bytes": 30404,
          "sha256": "6c0d55ee892f98ef87b1ed3c50c9dfc7e267a98d2db47e08d3dc67529af56725"
        },
        {
          "path": "python/lib/python3.12/nturl2path.py",
          "bytes": 2374,
          "sha256": "560e42264a337d0d41b42713fbda072890997161aca8b7397cca8967a23f8b63"
        },
        {
          "path": "python/lib/python3.12/numbers.py",
          "bytes": 11467,
          "sha256": "ac381960a3dc1db0498b0bd43d8ef278d6599713121a186b153ff09d9552e0db"
        },
        {
          "path": "python/lib/python3.12/opcode.py",
          "bytes": 13174,
          "sha256": "192f6008508f28d3273bff42eaea9b01c8394dab1607cd36aea778bdd166c3a6"
        },
        {
          "path": "python/lib/python3.12/operator.py",
          "bytes": 10965,
          "sha256": "b2af20f67667203c1730e686cc5d0427becc94db4c97f1d3efe3ed2158473f6a"
        },
        {
          "path": "python/lib/python3.12/optparse.py",
          "bytes": 60369,
          "sha256": "07d224301cba312fa0697bff9cd5a4bb4f778a90629632091b3f4ae874d89af5"
        },
        {
          "path": "python/lib/python3.12/os.py",
          "bytes": 40821,
          "sha256": "54c43a1fc69c979c70d8f7d097174cee163bfe59937723ee353043dd4a0211e1"
        },
        {
          "path": "python/lib/python3.12/pathlib.py",
          "bytes": 51052,
          "sha256": "10ba48ae8063cfe7589436041d0d4628c05f427c7709cf8e75e486f8930cc32c"
        },
        {
          "path": "python/lib/python3.12/pdb.py",
          "bytes": 70298,
          "sha256": "c87944ee79327e534816bf8fb72b79b89ad9ef9d3664d2a7b90f8fb961450f25",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/pickle.py",
          "bytes": 66911,
          "sha256": "7e3447b6d993a6306a7893fd2fba916010ed79f8e09ceb56158a550fa8099a14"
        },
        {
          "path": "python/lib/python3.12/pickletools.py",
          "bytes": 94052,
          "sha256": "a4242b8728b0c29d15d9534fac4f7303d9c562a8edb65c87f6bc09f764953412"
        },
        {
          "path": "python/lib/python3.12/pipes.py",
          "bytes": 8978,
          "sha256": "153f2d249d954b5536c6a049202617ff43ba2f9b109c426e06676c577ddedc61"
        },
        {
          "path": "python/lib/python3.12/pkgutil.py",
          "bytes": 18281,
          "sha256": "44300bc77f6f52ef2ad74d26e5053309c04f49eaa91c099356eb61426cde504f"
        },
        {
          "path": "python/lib/python3.12/platform.py",
          "bytes": 43388,
          "sha256": "f5ff83f15c841792be42709a6710dc8d7a9f72791c1ae4cad719b1fb0abe0a05",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/plistlib.py",
          "bytes": 28582,
          "sha256": "7f427a3b717507598c73bae26ff09d3fb7664540d9b7209ca97be80c76648069"
        },
        {
          "path": "python/lib/python3.12/poplib.py",
          "bytes": 14619,
          "sha256": "e1596878e408b1702dea74ca55f13b367f93b12fd9950fc62f70d8e7b47fce83"
        },
        {
          "path": "python/lib/python3.12/posixpath.py",
          "bytes": 17356,
          "sha256": "03825681086638649a43480954f7f6a16b4da3bd41ece956864ae96e4f795cd9"
        },
        {
          "path": "python/lib/python3.12/pprint.py",
          "bytes": 24158,
          "sha256": "1585c8d74d7f485590db2af46680ae0a73737ca9fb66022b2bcbbc4c4925e203"
        },
        {
          "path": "python/lib/python3.12/profile.py",
          "bytes": 23093,
          "sha256": "dee2125b2a0913fcfd0330b75d7fb752f2dbbe1bf43e479fb0cba117b9ae6e17",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/pstats.py",
          "bytes": 29289,
          "sha256": "476a7f4298d02d7445f65f464b1eeca3b1de7a74ce104e91f75c10a7eb1f9aee"
        },
        {
          "path": "python/lib/python3.12/pty.py",
          "bytes": 6137,
          "sha256": "ddbb1749387539c2929957c7ec1235fd201d7ec15d285fe5246e88b35c722a4a"
        },
        {
          "path": "python/lib/python3.12/py_compile.py",
          "bytes": 7837,
          "sha256": "3464f04938b57a7aafbc5c394ccd4c46823ee607f7fe36b48b91ecbc30ff4e48"
        },
        {
          "path": "python/lib/python3.12/pyclbr.py",
          "bytes": 11396,
          "sha256": "e8ca09333701ba41244e20b8c2c37b7ed0499b88c4b2ca82cac51ef89ca9e647"
        },
        {
          "path": "python/lib/python3.12/pydoc_data/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/pydoc_data/_pydoc.css",
          "bytes": 1325,
          "sha256": "038d4bf51b4d373284640f3658d70eaa856def24d8d02b8e29b289beaabf1cc9"
        },
        {
          "path": "python/lib/python3.12/pydoc_data/topics.py",
          "bytes": 519590,
          "sha256": "4988d3eec54b7ac896baf8774cace20f9c76696590f6fe52a2c26c3e2751212b"
        },
        {
          "path": "python/lib/python3.12/pydoc.py",
          "bytes": 113508,
          "sha256": "d181676eadd154121c64ffdc908b0fe520da2be4095fd13f8b4c6d1bb1897797",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/queue.py",
          "bytes": 11496,
          "sha256": "f6c37fc37cd7440979f7d22d40ee818fa3b714c573610c08fa52911d541193f0"
        },
        {
          "path": "python/lib/python3.12/quopri.py",
          "bytes": 7184,
          "sha256": "a1cd7f3b22033d32151209886cc855d4b71cc4c83530769f920097582339013a",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/random.py",
          "bytes": 34689,
          "sha256": "de48263a837339c7e01cf9f3c4d756696e0e0775f7778eb9cf81ad5b00134569"
        },
        {
          "path": "python/lib/python3.12/re/__init__.py",
          "bytes": 16315,
          "sha256": "8ff3c37c63b917fcf8dc8d50993a502292a3dc159e41de4f4018c72a53d1c07b"
        },
        {
          "path": "python/lib/python3.12/re/__pycache__/__init__.cpython-312.pyc",
          "bytes": 18009,
          "sha256": "4c7f852dd2acb1f5ad8eff03453a322051bfe86114999b923f728a8cc4b3b5fa"
        },
        {
          "path": "python/lib/python3.12/re/__pycache__/_casefix.cpython-312.pyc",
          "bytes": 1895,
          "sha256": "00ceb8133811cf95e984cacf00f656c648c31e425efea5e76eda0d6a7643e526"
        },
        {
          "path": "python/lib/python3.12/re/__pycache__/_compiler.cpython-312.pyc",
          "bytes": 26573,
          "sha256": "7d141ce44c2a3a97d73d4d7aa5888ab042e7985e1d06d4b4f3af67e708f8e0b1"
        },
        {
          "path": "python/lib/python3.12/re/__pycache__/_constants.cpython-312.pyc",
          "bytes": 5382,
          "sha256": "f339e41c419d62797ca027434a5f0a385308cad19e79073357a228f63aba5202"
        },
        {
          "path": "python/lib/python3.12/re/__pycache__/_parser.cpython-312.pyc",
          "bytes": 42026,
          "sha256": "bfc4b20b460fa5cea953599b9aa009d36e30cbf9604e09ec83ee62b92259b86c"
        },
        {
          "path": "python/lib/python3.12/re/_casefix.py",
          "bytes": 5444,
          "sha256": "1b12d9136f23db6c3f6f26053fefc15ca964b886838c7b9c1fabf8d2efc1e5c8"
        },
        {
          "path": "python/lib/python3.12/re/_compiler.py",
          "bytes": 26399,
          "sha256": "c75620761098a70ed75b9accef63ef2881d8abb6d4e5cbfd10074bd165eefe4d"
        },
        {
          "path": "python/lib/python3.12/re/_constants.py",
          "bytes": 5930,
          "sha256": "fa4fdb200f238f9e7817b63892b0d69833d8165134801e775e10cc113348a375"
        },
        {
          "path": "python/lib/python3.12/re/_parser.py",
          "bytes": 41201,
          "sha256": "a51a85b37cf3f44ba7ff25754da5f31306e4ccfa6eb3c017f9d37bdf4e770840"
        },
        {
          "path": "python/lib/python3.12/reprlib.py",
          "bytes": 7148,
          "sha256": "e177bc70da83a7fbcde6fd261dc15da34e8a20873b1cccd4f9a1f8f27cca3779"
        },
        {
          "path": "python/lib/python3.12/rlcompleter.py",
          "bytes": 7827,
          "sha256": "fee9ad9c55529be48329b78e982fbba0201bd218326eaf80a87996c9f8c805bb"
        },
        {
          "path": "python/lib/python3.12/runpy.py",
          "bytes": 12885,
          "sha256": "81e07da29bb2235111079bb64efea7d291639c5d2cf163e7af187d6a38cef389"
        },
        {
          "path": "python/lib/python3.12/sched.py",
          "bytes": 6351,
          "sha256": "56588f00a68ef953014f41baf36e0dbb7ed7793f8aa883ebcb1a8bd3787c06a6"
        },
        {
          "path": "python/lib/python3.12/secrets.py",
          "bytes": 1984,
          "sha256": "277000574358a6ecda4bb40e73332ae81a3bc1c8e1fa36f50e5c6a7d4d3f0f17"
        },
        {
          "path": "python/lib/python3.12/selectors.py",
          "bytes": 19671,
          "sha256": "1eeb102373e18c96311203f30c516e785bd8642275aa0bd66e43a284c9692385"
        },
        {
          "path": "python/lib/python3.12/shelve.py",
          "bytes": 8560,
          "sha256": "b978c6f0ffa901b041d6518afed03f2938a62168066013ee7d23baac31c356c0"
        },
        {
          "path": "python/lib/python3.12/shlex.py",
          "bytes": 13353,
          "sha256": "f927227de5ba5b1b2bdd75e3d9c8cb72b602b3bba3cc8edbf8fb554de0dc1fd7"
        },
        {
          "path": "python/lib/python3.12/shutil.py",
          "bytes": 56198,
          "sha256": "53496e06742fe008fee2bccc8caeac77473e69923bec05358bd43eea467db1f8"
        },
        {
          "path": "python/lib/python3.12/signal.py",
          "bytes": 2495,
          "sha256": "0363c964c90ac0b3e515de5749205e6e6454051a1211058375d84d91eab6071a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/direct_url.json",
          "bytes": 261,
          "sha256": "3de680aab81a1d6dff92bd2eff79a0c841c8f8d18504b3a4412f9c01acba622f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/entry_points.txt",
          "bytes": 84,
          "sha256": "5617fcb34218817dfb9ad778bc62fbdc13dcc5d2a7a9e0853f3079f9ddf4c7ca"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/INSTALLER",
          "bytes": 4,
          "sha256": "ceebae7b8927a3227e5303cf5e0f1f7b34bb542ad7250ac03fbcde36ec2f1508"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/AUTHORS.txt",
          "bytes": 12139,
          "sha256": "4eb1fb1705e2def898e81bcba19c3aac80620d27ba3569d6a6df7b4629d1b5c2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/LICENSE.txt",
          "bytes": 1093,
          "sha256": "634300a669d49aeae65b12c6c48c924c51a4cdf3d1ff086dc3456dc8bcaa2104"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/cachecontrol/LICENSE.txt",
          "bytes": 558,
          "sha256": "86eeee87be2a43f3ff1f56496f451f69243926f025fedbb033666c304c4c161b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/certifi/LICENSE",
          "bytes": 989,
          "sha256": "e93716da6b9c0d5a4a1df60fe695b370f0695603d21f6f83f053e42cfc10caf7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/distlib/LICENSE.txt",
          "bytes": 14531,
          "sha256": "808e10c8a6ab8deb149ff9b3fb19f447a808094606d712a9ca57fead3552599d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/distro/LICENSE",
          "bytes": 11325,
          "sha256": "cb5e8e7e5f4a3988e1063c142c60dc2df75605f4c46515e776e3aca6df976e14"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/idna/LICENSE.md",
          "bytes": 1541,
          "sha256": "1a9a4f0e3d479a27240ddd59a9137a66ab4a0f9dfdc8ca6188cc0bfd85187f04"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/msgpack/COPYING",
          "bytes": 614,
          "sha256": "492dedba85da5872f78e6091bcd1fea474d660d35acb4dee964b8aab3f007427"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/packaging/LICENSE",
          "bytes": 197,
          "sha256": "cad1ef5bd340d73e074ba614d26f7deaca5c7940c3d8c34852e65c4909686c48"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/packaging/LICENSE.APACHE",
          "bytes": 10174,
          "sha256": "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/packaging/LICENSE.BSD",
          "bytes": 1344,
          "sha256": "b70e7e9b742f1cc6f948b34c16aa39ffece94196364bc88ff0d2180f0028fac5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/pkg_resources/LICENSE",
          "bytes": 1023,
          "sha256": "86da0f01aeae46348a3c3d465195dc1ceccde79f79e87769a64b8da04b2a4741"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/platformdirs/LICENSE",
          "bytes": 1089,
          "sha256": "29e0fd62e929850e86eb28c3fdccf0cefdf4fa94879011cffb3d0d4bed6d4db6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/pygments/LICENSE",
          "bytes": 1331,
          "sha256": "a9d66f1d526df02e29dce73436d34e56e8632f46c275bbdffc70569e882f9f17"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/pyproject_hooks/LICENSE",
          "bytes": 1081,
          "sha256": "1b22b049b5267d6dfc23a67bf4a84d8ec04b9fdfb1a51d360e42b4342c8b4154"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/requests/LICENSE",
          "bytes": 10142,
          "sha256": "09e8a9bcec8067104652c168685ab0931e7868f9c8284b66f5ae6edae5f1130b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/resolvelib/LICENSE",
          "bytes": 751,
          "sha256": "f388fd38cad13112c1dc0f669bbe80e7f84541edbafb72f3030d2ca7642c3c9d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/rich/LICENSE",
          "bytes": 1056,
          "sha256": "deed7c17a4318158190a3ea239cc879a5a50271cebb98ae7025f48fbe58dca15"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/tomli_w/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/tomli/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/truststore/LICENSE",
          "bytes": 1086,
          "sha256": "33be7b7e8fa4fd19b1760e1a8ed8a668bdab852c91b692dd41424bcb725a9fca"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/licenses/src/pip/_vendor/urllib3/LICENSE.txt",
          "bytes": 1093,
          "sha256": "130e3a64d5fdd5d096a752694634a7d9df284469de86e5732100268041e3d686"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/METADATA",
          "bytes": 4617,
          "sha256": "3a561005822841f2c45f442f6c7a7505172c8c376c9fe274d876c8ac912968cb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/RECORD",
          "bytes": 69068,
          "sha256": "40748259e345452deec0f406e28e1427a0543d996f33b05916097a341d8fe6fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/REQUESTED",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip-26.2.1.dist-info/WHEEL",
          "bytes": 82,
          "sha256": "1b68144734c4b66791f27add5d425f3620775585718a03d0f9b110ba3a4d88db"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/__init__.py",
          "bytes": 355,
          "sha256": "04aa76ceab0f4341e292daae35637f2f8718b183313cc2fb588d1304cb9c0443"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/__main__.py",
          "bytes": 874,
          "sha256": "ace651b6b5e30c1cd8db89e26b14e777d6471d62fb07411ac1574ba09de723a7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/__pip-runner__.py",
          "bytes": 1451,
          "sha256": "ef6d0cb7a874ed471ee76bfcd04385fff2586aea0bc3d6fb3dfb3fe41f758ac8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/__pycache__/__init__.cpython-312.pyc",
          "bytes": 683,
          "sha256": "50b591d636fa71095f7dfe9818291af423e2252d7b36dba3161f757bbf0e8539"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/__pycache__/__main__.cpython-312.pyc",
          "bytes": 908,
          "sha256": "29b29bca5bf270c65efb4e8d60d0b80148ad53411cc25cb2a8e0682f3966fae7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/__init__.py",
          "bytes": 511,
          "sha256": "4bb8bd0e7f5a4994b4306fb65abbdeddd57d4c898fcef427e638e1a7db7fb9fd",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/__pycache__/__init__.cpython-312.pyc",
          "bytes": 783,
          "sha256": "147a5c5311c479b10edaea64e2ba9aff5a7930a2b6a638829fcdd376d95e471b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/__pycache__/cache.cpython-312.pyc",
          "bytes": 12531,
          "sha256": "df46fa08099dbadb023c34959a7bc3441851b6ae06278f6832539e0cbe01120c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/__pycache__/configuration.cpython-312.pyc",
          "bytes": 18227,
          "sha256": "a52586f5aa5e0e06ce99093f8a353362928ac2ec39507c1da91438a03bb684b2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 51313,
          "sha256": "7215f482c1afb7ba556b6b35cb0591e5f3dd497e767b00a7ab4963ac1080ae42"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/__pycache__/pyproject.cpython-312.pyc",
          "bytes": 4118,
          "sha256": "20d4f53b9ee09e145fd8f9a360c6b889fbf103b70aadb9c2c2749882bf384993"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__init__.py",
          "bytes": 788,
          "sha256": "008e71d8a7efd5ec46d486ec347b885756a0a8d82cb538ff2d6a5bc162eaf289"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__pycache__/__init__.cpython-312.pyc",
          "bytes": 892,
          "sha256": "b8e2442b1c41b130469733f4c1bb240e8830f2e3096e31ee92f10e0f8153b47e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__pycache__/base.cpython-312.pyc",
          "bytes": 4975,
          "sha256": "1619a4dae4704e748643b2ed5b835fad9f406a10b6263ec10ed3757c1d537b4c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__pycache__/installer.cpython-312.pyc",
          "bytes": 13599,
          "sha256": "5153fb695895635932b42a5cd7514115de3a9a5eede3b23026f157ba15714f63"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__pycache__/noop.cpython-312.pyc",
          "bytes": 2072,
          "sha256": "3c47050d7d413b094b436b32bfe55ace6ef6c9b16156156b9af44526f0692b30"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__pycache__/venv.cpython-312.pyc",
          "bytes": 6757,
          "sha256": "2c156862a190553ad85c8afbdac111a3e956502d9acf25d2f3836e3d7d4cd7e9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/__pycache__/virtual.cpython-312.pyc",
          "bytes": 7430,
          "sha256": "8523d190bf06ff4e2d17fc11b5d7316d6d51d97740b0b1fd71534d758543527e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/base.py",
          "bytes": 3440,
          "sha256": "ed11d6e57f9049558778aeffe547a2f466ead2ad690171c5f6dabb323df0b53b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/installer.py",
          "bytes": 13046,
          "sha256": "78c532b5009d06243d4e091a19e4c0ceafc8541a8b1f20fd389fe43532238dc3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/noop.py",
          "bytes": 1001,
          "sha256": "15793d6454d3374b3571e71913ac9c3766739c187be4e93623741717c1d3a3a2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/venv.py",
          "bytes": 5692,
          "sha256": "3ec0e5d0fa6607d8d135a21ac21cba5e4f51f16718a00a202d2d9a7e667d0107"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/build_env/virtual.py",
          "bytes": 4858,
          "sha256": "1ec551cf3860046cb2d3a0d90683b43d6ff790811a732f52e132391f5abbd879"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cache.py",
          "bytes": 10457,
          "sha256": "7aa31055fa43f31ec67023b4574cfbde69e33c8b926a9305a10fd6444ee22d8f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__init__.py",
          "bytes": 131,
          "sha256": "22a83fb4a03bef55ee30ed4fe2dfec0c79d228fce451bf43d03aae9c09b0fe4a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/__init__.cpython-312.pyc",
          "bytes": 307,
          "sha256": "ac158846199e8aa4ab3e11fd201b27cb3b12609fac8ed92647945a03d9c972ae"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/autocompletion.cpython-312.pyc",
          "bytes": 9127,
          "sha256": "93d0d3695a7310350e2d347680259cf200a98a176a6663238062f2a0c3e6276b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/base_command.cpython-312.pyc",
          "bytes": 11477,
          "sha256": "e755966d751e3c82276aaec46064907baa12327e25ca8271d4b1bf2cdba1f9df"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/cmdoptions.cpython-312.pyc",
          "bytes": 40581,
          "sha256": "52a834d17a1ad09cd3172870b67d76a5272e0b357dca492ac12052a02068daf9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/command_context.cpython-312.pyc",
          "bytes": 1845,
          "sha256": "a1bad7b106449f7b19d9519a8955d050a4e37a331aa1d5d7e99aa57131c1f4e5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/index_command.cpython-312.pyc",
          "bytes": 9012,
          "sha256": "913621ce1915d7554bf425a974665e4fd93363db494c671ab8d1c2d421d783e3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/main_parser.cpython-312.pyc",
          "bytes": 4942,
          "sha256": "dd84ef5f7ba5577605916b609e4ee9ffc03db99e91137a7d39acd30137264e1e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/main.cpython-312.pyc",
          "bytes": 2269,
          "sha256": "4515e9d68e7312c5908d7802f0a78b92ea15710e273b7ec0d44e7a338883694b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/parser.cpython-312.pyc",
          "bytes": 18692,
          "sha256": "fe2f9f874f9718cc133a0d14e0fd90381902b07d11cf8fc6d6559937c1e5b2fd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/progress_bars.cpython-312.pyc",
          "bytes": 6130,
          "sha256": "12e5f67b4de157e59e20b88f8f3f03b842578b88b74e76e9c942989db8e59f4d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/req_command.cpython-312.pyc",
          "bytes": 17968,
          "sha256": "6b8eab098329bdea9a5400a9238884dc1956db7133a53db734222320063dbe20"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/spinners.cpython-312.pyc",
          "bytes": 11280,
          "sha256": "d9e629f9e700aac0b3613d1d32ad74d78ccf59cfbbcc1833251d54a4111b7641"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/__pycache__/status_codes.cpython-312.pyc",
          "bytes": 436,
          "sha256": "c1b00228d5a7070dc2d6f96ce399e228fba052f723ebe1b6a985249fd81984b0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/autocompletion.py",
          "bytes": 7353,
          "sha256": "805b6688584771c8b3cb1e093c99c42a293eb9fb54ee4c2b52f9bbd9c4853c72"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/base_command.py",
          "bytes": 9431,
          "sha256": "c85e7f990108acb1b61b49efca6652d272e18838380744fcf56e625fbf07e79f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/cmdoptions.py",
          "bytes": 41180,
          "sha256": "681371688cb8615e007e302aac6f11a1915cbfb9305b3440ce0e669d998e183c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/command_context.py",
          "bytes": 817,
          "sha256": "926bb711665b7c17a06b5a036a69c625303f51a7a384840db8c8f609598c5eed"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/index_command.py",
          "bytes": 7504,
          "sha256": "fd0cdcf681e706eb55bc3d30c587077ded2e259a9158eb488391da4299d235e3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/main_parser.py",
          "bytes": 4368,
          "sha256": "ecf8447d9f005e2594a537c1fca24c9e0236b05f17217979d9a948d4b67f7bf3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/main.py",
          "bytes": 3209,
          "sha256": "3b5d20bb306a176332900699628eacb9ad3dedd5ea0b79e8ccaa1db533a91c37"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/parser.py",
          "bytes": 14147,
          "sha256": "5af447b88d8c745a75f3b056ad8fc3d7b2f4d9ab2af639829e783cd5a7f9d924"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/progress_bars.py",
          "bytes": 4706,
          "sha256": "d77537018dc36307442303d82ed527e41e107292540292d60a47c9faefcfab36"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/req_command.py",
          "bytes": 18952,
          "sha256": "c16fa645c3ea3dccdeab1a7d490ff287761fad101802510065ec6d94b7036d47"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/spinners.py",
          "bytes": 7362,
          "sha256": "109cd921937252d2658e9dfe5a372cc88aeac56f8752c7d6ce1b96f389ff4eac"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/cli/status_codes.py",
          "bytes": 136,
          "sha256": "f5084d7ba847aac8b0e72e70b9f88d2813a02635741c5dc8dcfd8adb59e3f8e3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/__init__.py",
          "bytes": 4026,
          "sha256": "68d7826d0bab1968a17e142aec1a9a2d71ea5834348b7234e0e4bb9312baa654"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4149,
          "sha256": "5d15f90ce2f40c08ddec32545a78d1931b408e55079c0b7e410949bc2705c21d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/__pycache__/download.cpython-312.pyc",
          "bytes": 7639,
          "sha256": "86636ce549df89e722d2571da4e60b0c035ae3ce9a6baaad256fd52e19f715d0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/cache.py",
          "bytes": 9251,
          "sha256": "60b66b2d636f0a1974a489819284991860f77dbd8c7dd606a58178274690b3ac"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/check.py",
          "bytes": 2244,
          "sha256": "85514141ecd0df38f813276859b1508ff69f3d4a6932deebf493c0958db653a6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/completion.py",
          "bytes": 4565,
          "sha256": "2e3bd1219e905220d724bdc838c15e0fefc9f7b1df8cc1a0124d23dad586bb55"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/configuration.py",
          "bytes": 10132,
          "sha256": "e4ce8a337d06de2ea830702c5544963f813dddc492250a09e9ebd4442ef9e04f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/debug.py",
          "bytes": 6556,
          "sha256": "b42594384cb3d877652c64efccda926480094244180b2e7ccc14dd7c85b2cd2a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/download.py",
          "bytes": 5404,
          "sha256": "72e5c48fd3e6a19e240acc66fc1699fce92622c57f825b8b88e552b8e3b6312d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/freeze.py",
          "bytes": 3100,
          "sha256": "2e0f043a89319d166bc1d2d62602e9056c4d52defe1eb9169440b4e5efaf070c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/hash.py",
          "bytes": 1679,
          "sha256": "18ef6944ddf05c2da441aa2f2b9ed368b60131cdc896d387f763ba404c3a604d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/help.py",
          "bytes": 1108,
          "sha256": "073dcb7233505e4cf80aefffa4be0267cea8e3e1cd2d98f535959d949863baed"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/index.py",
          "bytes": 5608,
          "sha256": "9f2fe11b35ee647ce3b2ae0220987fe987d9195266ec6ecba9041d29389b27f4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/inspect.py",
          "bytes": 3185,
          "sha256": "8a200cf89b8bfd9d7e40fdf8720025a193d2af9d0c73bc00bee1434731d0ad09"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/install.py",
          "bytes": 33761,
          "sha256": "0d11142c0f9319b08a86a0412e4adb0cacedc90e79ed06c37ba649518ba1db29"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/list.py",
          "bytes": 13908,
          "sha256": "5be172c574eb1c986a465e19a2a169ebcff9180c02f4662e63a7e115325d1f35"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/lock.py",
          "bytes": 5987,
          "sha256": "561a4d45622d2ddab2c12388a97837bee2327f9f5ca33874f7e67a67d70c88b3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/search.py",
          "bytes": 5782,
          "sha256": "cdb32c5ff6004a3ea45c0e972018130efd1b18ae75c46f825772329d925c13e7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/show.py",
          "bytes": 8247,
          "sha256": "f75fd79638421d6c8235fa0505ae1775a71bba6420a0d6e191c1c793f81c5bd6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/uninstall.py",
          "bytes": 3868,
          "sha256": "0ac3a286abdbe9903a3baecbef4a177a82c778e7cdccc33cf07f60fbd6a8720c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/commands/wheel.py",
          "bytes": 6187,
          "sha256": "e66dcdbd529ab6a2c3395a02ff858e1620c3aef4118c1e768e46efa5b640a6e8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/configuration.py",
          "bytes": 14562,
          "sha256": "d1e11d875c5394e1e1a02ad3b701d83390c48fb05b4e684868268d363decac13"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/__init__.py",
          "bytes": 858,
          "sha256": "1eaea4b7a8170608cd8ade614d358b03378234e2a807e374a46612a9e86b962f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/__pycache__/__init__.cpython-312.pyc",
          "bytes": 973,
          "sha256": "7550bc45d3fa7bda5434d8d42b7dfed7549071fab87fb2e50e0ea9ceec7c6b7f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/__pycache__/base.cpython-312.pyc",
          "bytes": 3032,
          "sha256": "8bdb545a20c877c9708133ca54322cb35698d6e9e9f01de03f37192bb89f32e8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/__pycache__/installed.cpython-312.pyc",
          "bytes": 1872,
          "sha256": "f0c0714fe3f42a4368c2fda8dc3a2279a01ed0103343a3e1df143d5f57ba0633"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/__pycache__/sdist.cpython-312.pyc",
          "bytes": 9699,
          "sha256": "068fb608cc0c2e8130a583c20ef6ce3f1252465116162d97857f84c0d5ff072e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/__pycache__/wheel.cpython-312.pyc",
          "bytes": 2421,
          "sha256": "af1e8fa6f4b2a927ef6bfcd16a5bb2cf22c1ffcc2b67f86350482b71499ddc2d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/base.py",
          "bytes": 1907,
          "sha256": "06361ace0d8485b120aced56fc90fa8c46480d5954a40fd6664a94f8dbc20644"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/installed.py",
          "bytes": 994,
          "sha256": "40f0e10aa73e1931a259900038569528c1138359bf918b9fe9104ef596650ea6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/sdist.py",
          "bytes": 7783,
          "sha256": "8687fce556ee5dafcdc9dbc5663eb33ad9f1b8f635e6db2e089562acbb8d4fe5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/distributions/wheel.py",
          "bytes": 1429,
          "sha256": "a8e315633293ded26c3b442e9dd2e3003705896fd1383ba2e0ae755d1a8caeef"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/exceptions.py",
          "bytes": 38302,
          "sha256": "65dbb5ee955b0f5788ff28e0e7665dd32800583cbc2ed5d2d40b5fbe7d693edb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/__init__.py",
          "bytes": 29,
          "sha256": "b73c0c1ff7e141eb9bc0ca877528af6ac83571181349b360d8288c567ccc9b25"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/__pycache__/__init__.cpython-312.pyc",
          "bytes": 261,
          "sha256": "ed03710f97e7a6e670e12beb237612212594f79f5d1851c796d778e34f6fa701"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/__pycache__/collector.cpython-312.pyc",
          "bytes": 22032,
          "sha256": "d0495ac6204d95dc22dbedb175f077ead9c669b9ec97776305a221d4304a73a3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/__pycache__/package_finder.cpython-312.pyc",
          "bytes": 45605,
          "sha256": "2fc1bd92e3cf6d4695e6b34c015c278067976fb1ca6a70b85e868ce4dc6e872a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/__pycache__/sources.cpython-312.pyc",
          "bytes": 12318,
          "sha256": "2770a2ecc16935c9bc073cd872928b649b3e812705bd15c7bfc004dfaf69fb62"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/collector.py",
          "bytes": 16578,
          "sha256": "6eef8d0554e821ec9811b72fd3f82d227031b022b7134c88e897bacb10301399"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/package_finder.py",
          "bytes": 43149,
          "sha256": "46858ae6b3e439c98e7625845e19e4f5a6850e06a3e10104ef415e42892a65fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/index/sources.py",
          "bytes": 8621,
          "sha256": "7eaa95962f772ebf87364fb0143ebbcb27d9cd2e96783912646bf5445c3add01"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/__init__.py",
          "bytes": 14022,
          "sha256": "88ff725599ffe223ee35c694361d80fef24b72f519fbccb8cef28b0d512a68cd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/__pycache__/__init__.cpython-312.pyc",
          "bytes": 15176,
          "sha256": "30ed22e6bcb05ee9e9d9285a08f7db02e20d60a141981f4490a6fbb4f720236e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/__pycache__/_sysconfig.cpython-312.pyc",
          "bytes": 8075,
          "sha256": "2ec73fc14df422e6f62280e6bb6568e9d55a9a1f5c4ffc2879e2562da7d3ebba"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/__pycache__/base.cpython-312.pyc",
          "bytes": 3740,
          "sha256": "dcfc7f248955a5477fab351d440e34539e211c227ad3d798ce02d49f00e65c92"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/_distutils.py",
          "bytes": 5975,
          "sha256": "8e9163e15d34ac3f48477bc0f53aab1a4c1c74d545739f0bb028596af81ef496"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/_sysconfig.py",
          "bytes": 7788,
          "sha256": "1e8658435b15403dc8469402a784e975340b36b0c517323dcd18d7ad36272566"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/locations/base.py",
          "bytes": 2548,
          "sha256": "e6655c5e1f639d27a910edb9686d94faa65682ecdea0e3c86d3d264620430cc1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/main.py",
          "bytes": 338,
          "sha256": "d5c1ea8ec7c50ab3057f7079b70ce87314c951d1cc2e85d4a72e6526816a522f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/__init__.py",
          "bytes": 5824,
          "sha256": "be9f8903189683ffa5e45f004f425c7b2ef6b949e1f020f0c2897df8a92d1d9f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/__pycache__/__init__.cpython-312.pyc",
          "bytes": 6793,
          "sha256": "3ee3a164223f5547019aa963cf9d9d4fb7d62f878e65e354c2cdb0e0bb4bcb1e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/__pycache__/_json.cpython-312.pyc",
          "bytes": 2905,
          "sha256": "c89b838d40666f768089d87a91aee0747932883595a84e267f535f9b81891c33"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/__pycache__/base.cpython-312.pyc",
          "bytes": 34468,
          "sha256": "5b7dafd052121d37f108e6067c8ca7e00f6a0ee40b2ea3ea3e6eef1c3c77951d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/_json.py",
          "bytes": 2711,
          "sha256": "84dbe73073972c0c8d9738ab5a13cbf4dc760af0aa6b589199ae8eb2ad587d5f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/base.py",
          "bytes": 25642,
          "sha256": "fe8f653321e689ae046bd7e171ec81f6ba778d4514f24ec59a585707b37dfed3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/__init__.py",
          "bytes": 135,
          "sha256": "8d4522768c671dc7c84c71da0161b51b68b97dd058925bffb89723a36c7b5581"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 390,
          "sha256": "d1bdd9cc26751f29a81bbdc8e3b8276c7bb133a4afb989094fd8c71d38f76a74"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/__pycache__/_compat.cpython-312.pyc",
          "bytes": 4269,
          "sha256": "fdff74ea49eb05438bc5b250f5d9d8be7aee78b7be104e9535ad964cdfdc9a53"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/__pycache__/_dists.cpython-312.pyc",
          "bytes": 12931,
          "sha256": "944fffe310d4bd911dda00c3d6f38a0c344015a4e672ce6668ae7480b3fdebdd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/__pycache__/_envs.cpython-312.pyc",
          "bytes": 8192,
          "sha256": "fa0857ccd5093a5123201637ea38fb1a73a3f891fb9707a51e98d4ce625e6f21"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/_compat.py",
          "bytes": 2804,
          "sha256": "b27795878ffa5b14192b8963765df2955b8ffaad2db52a9b825f665add079ce8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/_dists.py",
          "bytes": 8717,
          "sha256": "6a45f9c622c1ff776f6de6f68072fc8bbc0e462d35fc29edcb41e72854001746"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/importlib/_envs.py",
          "bytes": 5590,
          "sha256": "ba50910c45d87a29f04b90172fe42e8fb0b812b936d241e12300661363f70580"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/metadata/pkg_resources.py",
          "bytes": 10544,
          "sha256": "34eefa66b7d1dbe2ca253c9a5eb990a0686624c02b00bbda72b9591d58920d3f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__init__.py",
          "bytes": 62,
          "sha256": "023982101c57fcc1fd7ff8d58c818d08524a60261e4847b5f32caf371e2e44a4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/__init__.cpython-312.pyc",
          "bytes": 295,
          "sha256": "fe86a7dd3e7004010fe1a979ad6aed1df060379abeac24f462aa13ae598e3317"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/candidate.cpython-312.pyc",
          "bytes": 1754,
          "sha256": "94504f97d3c2b1d0a705f20270b81126a0317bae73838e302cd8e4426da8f1aa"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/direct_url.cpython-312.pyc",
          "bytes": 1997,
          "sha256": "f3e4e83a9936b2e124d83f3458bcbb26e3ae8335d91ac1a54d26aabb224c2d98"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/format_control.cpython-312.pyc",
          "bytes": 4156,
          "sha256": "447c7cb620ee450d8ac50c09a7938ed065b3787ace7f37156b5d7fc832d3394e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/index.cpython-312.pyc",
          "bytes": 1726,
          "sha256": "e9aaa016925edd89fca46cd93b3f6942606f108d407063bbb07a03a485162e96"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/link.cpython-312.pyc",
          "bytes": 28524,
          "sha256": "a6f15bfd0d2163ebcd603717a1782096e20a8d54fbd37306cbb56f2f4899b8f6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/release_control.cpython-312.pyc",
          "bytes": 4242,
          "sha256": "2546c19bda941d4df5054f5427f19be8a4cd126913abc614762fa6f526888bbe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/scheme.cpython-312.pyc",
          "bytes": 1041,
          "sha256": "48eb75bcbea68d4da1763bc86775a6e1cd9ac1f5b6f231278992f1812ba9087d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/search_scope.cpython-312.pyc",
          "bytes": 4966,
          "sha256": "da6787605765a87d3a5251bd48e652f6cea579836075840ffe5dc9bf2c3f8a96"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/selection_prefs.cpython-312.pyc",
          "bytes": 1820,
          "sha256": "71369e6e32c250593fd29b6a7ca163312b8b8b3aeec9fba37980dc603da0c3d9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/target_python.cpython-312.pyc",
          "bytes": 4886,
          "sha256": "86e2b8acefbb95fefcd1eff140eac589f5800fe3c407c6c6ddc3f9fde92b3b67"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/__pycache__/wheel.cpython-312.pyc",
          "bytes": 4701,
          "sha256": "af27c118dcd2eeed15dee0b7e7a39d4855f72fe875e10355c3a9fb04856e0bcf"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/candidate.py",
          "bytes": 824,
          "sha256": "32f00d649887930e98e13fa861233cef5d06eb2601e3f0f0a1fa03ec1026ae73"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/direct_url.py",
          "bytes": 944,
          "sha256": "f514b74d0017927c0b77c24e3995a56c157a59916cf6a9fe600624d1543c47f4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/format_control.py",
          "bytes": 2471,
          "sha256": "3f07a6606d4bdbb04cd1fd4a3fad6b9b6e304a110d172c6a943d535aedf86a57"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/index.py",
          "bytes": 1030,
          "sha256": "b589cbf28c468b8692356babd261bc0c03fbac2eb2ba16bf33024ef31c3472b2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/installation_report.py",
          "bytes": 2846,
          "sha256": "5383255d6141fbc7afff285eb8c3bd4f69bfcb96f80be84ecd56a81d5a1b977f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/link.py",
          "bytes": 23474,
          "sha256": "4925ed14edd802b794618d91d0faad2976c07b5bd5f41aade6bfea3cddb5f331"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/release_control.py",
          "bytes": 3365,
          "sha256": "df5261f991ec4c80592defbbb8f36860b8914965c08c42358c6371c2a2ca7780"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/scheme.py",
          "bytes": 558,
          "sha256": "1be3bd28495a6dc5ea6cfc1f13feba9735f97c66a18771aee83024cfff59849c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/search_scope.py",
          "bytes": 4461,
          "sha256": "fe2f868ffc3f170640bd3b3b5a18ec9410c3ef427ef219887635c1c88f2e1194"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/selection_prefs.py",
          "bytes": 1503,
          "sha256": "d2d79e930495c56e4c3a4d163c6e4da2fc39abf5c98f18a371def99193ba13d8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/target_python.py",
          "bytes": 4243,
          "sha256": "2347854be7a26b793086b3af82ca61159b4d001d88c1767d4abf5fa7a22304fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/models/wheel.py",
          "bytes": 2920,
          "sha256": "d5275f0ef37b00b4ec6f267d10eb0dcb518f8ab3f59fa1231f2ccfad9c8b4a1f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__init__.py",
          "bytes": 49,
          "sha256": "14ccb4e8ffffcba8cc8d473ccf765c41d285fa9999db3335e3fbc17873c68542"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/__init__.cpython-312.pyc",
          "bytes": 283,
          "sha256": "547cde6dbb690060ea3240a30c0a824073d1d417aa08f65475ccecafca6e925b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/auth.cpython-312.pyc",
          "bytes": 22032,
          "sha256": "7a2ab99db6e80dbdb98812bfc04f2c9ba62b48d1a8bc5b34239514ee53a45ff2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/cache.cpython-312.pyc",
          "bytes": 7960,
          "sha256": "b90fd83bc5040b44f1f96d822a0ef09779fabdca247c8601e4b61bcc7cb0aef1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/download.cpython-312.pyc",
          "bytes": 16990,
          "sha256": "9d54cd7d9c4ece74300defb805e33f7ad7399c997a533e5c9694eec89b081b9b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/lazy_wheel.cpython-312.pyc",
          "bytes": 11594,
          "sha256": "b30fc23896ebeaf8955b07b98c0f232d1fc6e73bc02a9fb3ede49b6910a7d74d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/session.cpython-312.pyc",
          "bytes": 19936,
          "sha256": "d9bdd1020a98058f4ac64e4fb93cc3b58bbf01743febd817794d44f586f96a39"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/__pycache__/utils.cpython-312.pyc",
          "bytes": 6827,
          "sha256": "fc8f83a1acb3462a9952b0445700e44dc9d2823111047e4c67710782885eff0d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/auth.py",
          "bytes": 21545,
          "sha256": "4c1a707bbcdc68fb8174195d8c039985fdb496691a729220180f80a8b72bf1e5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/cache.py",
          "bytes": 4862,
          "sha256": "e8394c5c9ee96f7e4cd6f82d4cad3e2ff9221c91717fbb7dceb7de27dbea3b7e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/download.py",
          "bytes": 14618,
          "sha256": "495ae629aa39ebb95fb3c45a09dcae3a2b73211099a7d45fdd17038ffa3cbe48"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/lazy_wheel.py",
          "bytes": 7646,
          "sha256": "cbd81592c7490928e72df633b3f9b70d8500b65de173f93ec453c305df4380eb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/session.py",
          "bytes": 19924,
          "sha256": "d8aa8cbf91eefcf1516119030614a321ba9bb01a74957bf8b6aa0b2a73362baa"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/utils.py",
          "bytes": 8128,
          "sha256": "393035bf016dbb611ed735aba8bcac0694501938ef5f10892544c4ab2ee135c0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/network/xmlrpc.py",
          "bytes": 1830,
          "sha256": "ffe467937bce7dff2e17d8401a64fa48b00b7e563580c05c6c6c12d767dbfd8e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/__pycache__/__init__.cpython-312.pyc",
          "bytes": 229,
          "sha256": "8a9bb0f1d05ec23543d1eec14c3139b085dbfb5d7debd4c4b6b368630146551f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/__pycache__/prepare.cpython-312.pyc",
          "bytes": 32403,
          "sha256": "c7b4626a3ee439878e50178926dc9bf752a1eca16fc37850477940ada581eaad"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/__pycache__/__init__.cpython-312.pyc",
          "bytes": 235,
          "sha256": "d7cd09efffa660e95ed6106ed16de9299e6f9557319b54bbe9091f0667c4b4f9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/__pycache__/build_tracker.cpython-312.pyc",
          "bytes": 7610,
          "sha256": "fef55193cf240a8ea2afe144a94fd750504f2c923db03c774affe4d5321a07e9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/__pycache__/metadata_editable.cpython-312.pyc",
          "bytes": 1938,
          "sha256": "edb4eef756cc7720ad30700efb746a9f41a162000be305584fdf1b160e2a0bc6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/__pycache__/metadata.cpython-312.pyc",
          "bytes": 1884,
          "sha256": "5845cb1f25406bb4a0ae053f6f12fb2b4e2d8e04b4a3bd416212536273ec78ac"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/build_tracker.py",
          "bytes": 4771,
          "sha256": "5b76f972690c58f684e902307f3b136b2268efe3a5c451d60f17cfb9ac7529c1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/metadata_editable.py",
          "bytes": 1509,
          "sha256": "a16b9d32c9e3cb89683bf272ee0e0df67c6c9da117fe20e5551802cbba6ed6bb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/metadata.py",
          "bytes": 1421,
          "sha256": "20d1da7a245f3a22d80970297c3351a3d0b0db12385704dcd0a22dbdf75f3a39"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/wheel_editable.py",
          "bytes": 1478,
          "sha256": "ab791f12572533a16eb556c5c04f3b24e4e9556b798b10dfdff5241c02157f3e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/build/wheel.py",
          "bytes": 1136,
          "sha256": "ddb3fe9cd889e12f09bcc6819f27acb17414061c53aadd46071e8343588f2436"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/check.py",
          "bytes": 5891,
          "sha256": "93b9938cb6f9c996e2758c3c36df6fbbbfeed4bd5e90b3b350409e378a9c36c0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/freeze.py",
          "bytes": 9854,
          "sha256": "3c3758fb2fd9b596492c029c6963c8191280196ec35d1e3c7f468c454d23ec10"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/install/__init__.py",
          "bytes": 50,
          "sha256": "6a4f941137103ca94565a5a860a5aee505576e9141be0d2c5dcde2d0ee2f4986"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/install/wheel.py",
          "bytes": 29078,
          "sha256": "aa11702524a12e6e2ab98f3322cb3fb7e6df7f4615e3d1d334029fbb87d2a627"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/operations/prepare.py",
          "bytes": 35030,
          "sha256": "ccb9153120eef5c511d0a9c39b76d9dd0bc879a12b8492abaf5d3d5320cc94a4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/pyproject.py",
          "bytes": 4555,
          "sha256": "27eb135aa0be5dfb0a420cfd9b56f2a4c5993c722db121f320dfcd59e2119a13"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__init__.py",
          "bytes": 3140,
          "sha256": "c77b81ed95be97f30e3e6f25745f068b4761e42f16db7741ff0387d8d996a457"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4087,
          "sha256": "a24352a4d7e6217e8df8aa34a872a4b4618019a9f0cf09af13a5b0ed7918dece"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/constructors.cpython-312.pyc",
          "bytes": 24831,
          "sha256": "f0a1ad8487e90eef915c930bc4469883e74a199b39befd0ab3be59c64e898f21"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/pep723.cpython-312.pyc",
          "bytes": 2718,
          "sha256": "c8ca77de5851eb14766031540393b7f08df6a6d10b16d5d5a61c380fab1a360d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/req_dependency_group.cpython-312.pyc",
          "bytes": 4655,
          "sha256": "08fedbc28a7719a8a40c784c07abf90d2367aa65728c25b0b7b5bf27e4c6fe75"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/req_file.cpython-312.pyc",
          "bytes": 24516,
          "sha256": "89d392fcf3e8149d83513aafc5ad4f33c4159973449a01380a0c76bf7d8a739c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/req_install.cpython-312.pyc",
          "bytes": 35188,
          "sha256": "3d2ec4628c80641e6810e3377f7d9be18121bd15d2686fe2face0c592070f49c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/req_set.cpython-312.pyc",
          "bytes": 5464,
          "sha256": "e824a77d46ec8cbc82d90080725aeb2a88b2303fd7c00f28ffee5490578a8ca5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/__pycache__/req_uninstall.cpython-312.pyc",
          "bytes": 31609,
          "sha256": "6b3c66376470634b7cfa0440e32f32141e38b436bb5ba3ca1dd59579e7174924"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/constructors.py",
          "bytes": 22276,
          "sha256": "7f020b8373a220afdfd77454197e73432cf861ab14329ecc0babbdb8fbe81b3c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/pep723.py",
          "bytes": 1242,
          "sha256": "26c1b5a7709a55c5bc7237250f69038fb77daad56b35069ebd8fd49ca874d2d9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/req_dependency_group.py",
          "bytes": 3145,
          "sha256": "3eb58ab65c08f316d69d610a8d7b3d464ae9431dbf874d8005e7d84f465d7908"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/req_file.py",
          "bytes": 20644,
          "sha256": "7661814b167d763d5e3aad8d5eff786e8af4bb59fc3f8f80be624bfaf63322c1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/req_install.py",
          "bytes": 32173,
          "sha256": "af6f3dfff58d55a4f1a51b4b154cf716936f746bfcc986bcec6f9090fe43b097"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/req_set.py",
          "bytes": 2828,
          "sha256": "6b092a2179d80383eb9ac8f441bdf386a75b61499777ed68d0ff8a6779af450b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/req/req_uninstall.py",
          "bytes": 24276,
          "sha256": "b791d262e2e82f19c5ee3adc2010e34c43feb238ebf0ee1f668b84a8e91533f7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/__pycache__/__init__.cpython-312.pyc",
          "bytes": 229,
          "sha256": "427b9cbb5c51b33b090e893e1a04387b4b95b87336afdc868feae7c7ecc7af7d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/__pycache__/base.cpython-312.pyc",
          "bytes": 1190,
          "sha256": "fbffb796f6965d6bdc40484385e7cb1fb692f46c2f8bad11041d8d4e2cd62c6d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/base.py",
          "bytes": 573,
          "sha256": "27d16ade414e8c58fd8014a1610b6574414fad11925adb29fab3bdac87385b88"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/legacy/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/legacy/resolver.py",
          "bytes": 24110,
          "sha256": "d8254b2192e6fe75e47c94ede512ad21b231bc2927f466af7f8629f5cd488c35"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 240,
          "sha256": "44d657549a3d8f0029155b98a28e4ddb8d58330f6a20bc27e51eb3e12d223d20"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/base.cpython-312.pyc",
          "bytes": 9765,
          "sha256": "97847bad48af6595913833933fb4395787a4d5dc51f6912e632bbd4207bd13a8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/candidates.cpython-312.pyc",
          "bytes": 29699,
          "sha256": "87e85bd7b66a7031b075c207e7ee977cd0c2929f9fc5a659881e0d1e49f879d4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/factory.cpython-312.pyc",
          "bytes": 36195,
          "sha256": "b05be3cdd93e53008be6c1aa0b808c07c0cc3317e13d3223f3793f183c2438d5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/found_candidates.cpython-312.pyc",
          "bytes": 6744,
          "sha256": "8a5cf098e86bb1fbf74782c5d301016010c4006afed6a545d12faded71870d6b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/provider.cpython-312.pyc",
          "bytes": 12788,
          "sha256": "b94c02f6e11d99b31ec8aa5102e2f3eda19f671e1497694f3dde15444ec88b29"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/reporter.cpython-312.pyc",
          "bytes": 5843,
          "sha256": "0361811a8c5b193ba2c98071aa7f0c6f7811aa8f8ab91550d0cc3993510e5f09"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/requirements.cpython-312.pyc",
          "bytes": 14798,
          "sha256": "d060c7c18f654238abdabc07d6160378ca33e2fc4b108ef685869876194622c6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/__pycache__/resolver.cpython-312.pyc",
          "bytes": 12797,
          "sha256": "20e49299aa021963e8b36fc5bfa18925979ade67844481baa56618531df8b13d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/base.py",
          "bytes": 5900,
          "sha256": "7e8ee88e842d8239901f971add5c8a2403b7a79b079e284c0f0efd67cff7d7e5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/candidates.py",
          "bytes": 20848,
          "sha256": "484929107e93eb397b55eec3c3da084bab674448fed54feae14fb6c441f42127"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/factory.py",
          "bytes": 36162,
          "sha256": "aeac270f819611d5601bb9c63fa3868f8f77ca2196ea366bd1c5bf9ac30e2bf5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/found_candidates.py",
          "bytes": 6005,
          "sha256": "179e58b577a42946d5c298655ec91ad352e4753195831d6a38d94b2bb057f873"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/provider.py",
          "bytes": 12310,
          "sha256": "364c78035e8c380c630a3f63166f309a5324e5c6d687560adbe518593284242c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/reporter.py",
          "bytes": 3918,
          "sha256": "b440bb305f08a865385b0f6deb56157cd14ab68690a5bebe0302d9a6d273d551"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/requirements.py",
          "bytes": 8239,
          "sha256": "23397d9fc9dcd7cf250350523d2f10c5fb9d7c340f1e09e0c3e8a3ea15edd274"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/resolution/resolvelib/resolver.py",
          "bytes": 13849,
          "sha256": "c0cdc27114d83dd8e74356a2dd83fa86d166904df6a35c71d9182353eca40237"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/self_outdated_check.py",
          "bytes": 8097,
          "sha256": "f57c4e5cfaac66529c7933f6b594bb23bad78e8767a9ddc6ac843c534fcbf013"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/__init__.cpython-312.pyc",
          "bytes": 224,
          "sha256": "f008caaa1d0429105afa66f11249cbb632cbc9450ba8941759111ab4669cb1b1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/_log.cpython-312.pyc",
          "bytes": 1895,
          "sha256": "2a017d42a5f4cec7c01922c9b070a717e681c1633b1de7af3e5bce5939f210ce"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/appdirs.cpython-312.pyc",
          "bytes": 2484,
          "sha256": "ba0f3920f6a458e80bdfb2d74eba995832d412f62991d66ed23cb0c2a999d87a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/compat.cpython-312.pyc",
          "bytes": 3561,
          "sha256": "b6589f153084269eb6c8f8300d0a27569cf9c3820c3721274f64ce9b46890ad0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/compatibility_tags.cpython-312.pyc",
          "bytes": 6676,
          "sha256": "505e1c6251647934219cc1eab7d837532861629d8d77ca32f139620db4963fa0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/datetime.cpython-312.pyc",
          "bytes": 1572,
          "sha256": "cb9c224c7773a97e8716fa9ba9e618096643b94986812cc4226c84480a8a2b09"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/deprecation.cpython-312.pyc",
          "bytes": 5099,
          "sha256": "885f2e4b2dc3e49ffec02ea3088efdc731460c167415c5b5682619da1e20a429"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/direct_url_helpers.cpython-312.pyc",
          "bytes": 3736,
          "sha256": "a2624dde2c44a4caf35423843112409126aba7c353d7e4ded51b1bddfb3a53f5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/egg_link.cpython-312.pyc",
          "bytes": 3173,
          "sha256": "407de4cf9c5df7fa374c3db8927a0d2de074eda7a9bd3c0196fe2efbccbceefe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/filesystem.cpython-312.pyc",
          "bytes": 10113,
          "sha256": "aa2adc594a698e03cb63ce31872d177618399894fbcbe767e409aaf53108f0a3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/filetypes.cpython-312.pyc",
          "bytes": 1158,
          "sha256": "d92c12a21276bb0c75908f14d88147f2f435af8e6c384fafc06377e3f4ddf69e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/glibc.cpython-312.pyc",
          "bytes": 2379,
          "sha256": "8c05f45be832e87c45a6c5e38cf46ff1df3c6fa5fefa3ba22216a38732b3f1d9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/hashes.cpython-312.pyc",
          "bytes": 7485,
          "sha256": "eddfe4f2718be8a015d6da8b217fcebd801c43cdd3c93f25fe2d06ded486e66a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/logging.cpython-312.pyc",
          "bytes": 15283,
          "sha256": "49fa7411bab9b1670a45b1cf171d1237f5ea4410ff6dad893191b4a8b1bb8580"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/misc.cpython-312.pyc",
          "bytes": 33875,
          "sha256": "a5b61bcc9a36cb922eace719db87263262e070fb4dac613bd0c28f237a81caa9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/packaging.cpython-312.pyc",
          "bytes": 1914,
          "sha256": "be3b5da5b394a4b50660de5dda938875c37c23a3913b9e4d6629a25866c87f75"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/pylock.cpython-312.pyc",
          "bytes": 11622,
          "sha256": "cc4748967299d66ae8af3d875640fbf6cc21b3aab44b16f668aded7f26484bff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/retry.cpython-312.pyc",
          "bytes": 2028,
          "sha256": "756d4717d87b18710e03ef1793a821053a1b5e9d8b8c9afa6fe0ad282f466ae8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/subprocess.cpython-312.pyc",
          "bytes": 8535,
          "sha256": "81f7ba59589b8fc07529c8e7775052f79514062a09b8f48d564fcdac75576239"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/temp_dir.cpython-312.pyc",
          "bytes": 11933,
          "sha256": "4e4844a9071f4e4882f7789fad7477856dd6f72343f8fe474d9c502e42267bf1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/unpacking.cpython-312.pyc",
          "bytes": 16081,
          "sha256": "0005b6b96ab3882ebf3ab27d03c0ca019119ba43cdfc9aa6ea2e949da11e2078"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/urls.cpython-312.pyc",
          "bytes": 2102,
          "sha256": "418c58cc1626044c83750d538b8917412c25149e8873718731c13f6c7b3da56a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/virtualenv.cpython-312.pyc",
          "bytes": 2963,
          "sha256": "2a7c05582fe52fecc1d06c7cc720ef79cd65162e0763dd0129835b811a3b2be7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/__pycache__/wheel.cpython-312.pyc",
          "bytes": 5895,
          "sha256": "2d12fd84d360070ee7725456b8a99420f21312c41e8c4f0424eb0940784090f6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/_jaraco_text.py",
          "bytes": 3350,
          "sha256": "335e6e50f221e4da4fd6d754181c516aeeaad59004b48f3e5f22c4113b1c15f1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/_log.py",
          "bytes": 1015,
          "sha256": "fa31cb384fd31da673e4115c0a7a122fd11802d2749d77a6e3db3da1fe23bcac"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/appdirs.py",
          "bytes": 1681,
          "sha256": "2ebcc33d930a561d2bb9bb42c7dbeedd79596cb092ba0e954a3e10b2fb7ae810"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/compat.py",
          "bytes": 2601,
          "sha256": "8b62546571aba8ff99a03f2de20c1c90103729835458296ebd10d749cb6ce5f1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/compatibility_tags.py",
          "bytes": 6630,
          "sha256": "0e23522eaa6eaee5d46a6190c0e2765990720c62d319a5e2f4ef977fc7ce8b7e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/datetime.py",
          "bytes": 868,
          "sha256": "92e24e7f5996f06e6d44537a8d66ab75d752fbda92691e7794ad639b1dcd4d96"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/deprecation.py",
          "bytes": 4537,
          "sha256": "21016e9996be5d62775283e75f876ec1b7fbf424f33990ff564d4f922bc0bb88"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/direct_url_helpers.py",
          "bytes": 3363,
          "sha256": "58208f2679a83c7cfb92261e3eb11c5407a7da50e9093f56415226a071d608ef"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/egg_link.py",
          "bytes": 2459,
          "sha256": "6167ecadb99f72b7d682a418cba3ae223b326fd21f2f5abfdafe33b26b355a32"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/entrypoints.py",
          "bytes": 3324,
          "sha256": "b8f8c0c9284a39b768b63423254ce9ad0eabdf142f0c86705187c71ea67b0e89"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/filesystem.py",
          "bytes": 6812,
          "sha256": "82283bddb38e4b53670c1f781030ef7439c78d0a1e473fd395f40f88257b31ed"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/filetypes.py",
          "bytes": 689,
          "sha256": "b0431adfca9aaa3bf1d5989ddce0805236b7d4138153e512b9230f06f537ca3a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/glibc.py",
          "bytes": 3726,
          "sha256": "b0487c44924b612751bd3a803b84c754f3c0f9848354b0f8488f52a3e6f15f55"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/hashes.py",
          "bytes": 5040,
          "sha256": "dfcf9b08e2521e2a6943bafd46db6b307c5bda6bf710046dd46c3c905996ef78"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/logging.py",
          "bytes": 13919,
          "sha256": "8464e306e223359c72755eafb38c28c406e190723c2fef6e08ed78382bcf940f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/misc.py",
          "bytes": 25408,
          "sha256": "dbc2d6405bc55a6ae926a31c574b2889fd719e5dff81bdb9077806fe2539ce13"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/packaging.py",
          "bytes": 1601,
          "sha256": "b39b6952616e9b05741fd2524f3af2ac863827040cf29686b7b4a6ede370b766"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/pylock.py",
          "bytes": 10290,
          "sha256": "5d04d9d60821ef27e91df45d6ef8d201ed6978eb60d99db116b51e67bc25e13b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/retry.py",
          "bytes": 1488,
          "sha256": "a0e2b754680a44ac529170cf0117fbddc9d04b7843b6713df9f7808380253591"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/subprocess.py",
          "bytes": 9001,
          "sha256": "9ea373da9dc6e1000d08205c68992a210bd0518039d13c23667a188e2c8fc6cf"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/temp_dir.py",
          "bytes": 9303,
          "sha256": "4c388bf41cc4a767876a540b1f4ae1c8cde6db1bb274483d73ab758786d3e65f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/unpacking.py",
          "bytes": 14789,
          "sha256": "e62f529fffd2344961a025e72edd92bd0690f929d3cdc51a0c7d7f248d531d4c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/urls.py",
          "bytes": 1647,
          "sha256": "2505ab440a171c1a4fb18f408a3eb56ec6633102c272ecab50ed51e96fc1c08a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/virtualenv.py",
          "bytes": 2272,
          "sha256": "f687782ec71e0f29d44ac2d31175e0b6e9a5510f15bcaa7ce9bdb1ccad18bb78"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/utils/wheel.py",
          "bytes": 4468,
          "sha256": "61d46e8fa322706f90f4c834dc56d4bf55932da9ba2dcec08228d8e2fa15ca2b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__init__.py",
          "bytes": 596,
          "sha256": "500aafce96e2d156d9a3751beac904799030fa8a08651fb35ff5a909bc720a85"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__pycache__/__init__.cpython-312.pyc",
          "bytes": 563,
          "sha256": "064be3b97252683e217d98799df8100d1b7d9f0953699930268948e80af4b696"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__pycache__/bazaar.cpython-312.pyc",
          "bytes": 5182,
          "sha256": "6b6b50e34b60e0c67511007f797a8a8f9b1b33aab29c0295277a77fa68aa5f9f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__pycache__/git.cpython-312.pyc",
          "bytes": 20137,
          "sha256": "2290d08b34a6fb6aa628841353d39a915c7e313002623882ee36521c708ae57e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__pycache__/mercurial.cpython-312.pyc",
          "bytes": 7789,
          "sha256": "d70ac47a8b9177372eff2a602c1a418193d6965d5aa3c3f168844ca4d1281cae"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__pycache__/subversion.cpython-312.pyc",
          "bytes": 12369,
          "sha256": "2e62e29b5bdc0bf5447e7d962b24d19a521c78a5cfc2d9b9ddba61190b644565"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/__pycache__/versioncontrol.cpython-312.pyc",
          "bytes": 28943,
          "sha256": "5bdc98560415b11c9926502b9700ddf1a984189c66907b4b35640803bfb08166"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/bazaar.py",
          "bytes": 3734,
          "sha256": "dd6d5e1e3918c76bdce9ba1e6f634187823fae51805ccfafaf37cd84b9b54718"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/git.py",
          "bytes": 19273,
          "sha256": "2f9daba8937ef8aab4923011f3ff528bc44911c36550b25d93a562a60f1995f0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/mercurial.py",
          "bytes": 5575,
          "sha256": "c3564958b2aa34fd689c48e47e39700559cca8f64d488111f1aca341c9d3ab8c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/subversion.py",
          "bytes": 11787,
          "sha256": "b9481d3efc66bc407c430b63af41dcd178058db88d8b971bbc8e2f0112ce257a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/vcs/versioncontrol.py",
          "bytes": 22579,
          "sha256": "26c5204c6e770e424fcb99975411fbbaa78543268bebdef4ee26edb39b820580"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_internal/wheel_builder.py",
          "bytes": 9146,
          "sha256": "91d3ef01cc5f92703c07fe20ea13c38c1ec2e2eccbfdc57955d7b63a3d88a739"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/__init__.py",
          "bytes": 4907,
          "sha256": "5b3bac3d319620c790416495274876ada7c69154daf56289d874fedbe12866b5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/__pycache__/__init__.cpython-312.pyc",
          "bytes": 4626,
          "sha256": "03f163e7be793ea13d228f84f68b60376e90cd1463324250cc893f0f2cb97add"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/bom.cdx.json",
          "bytes": 5319,
          "sha256": "797e200aa7fff16fad9fb2deeaece50a2b2bec623eb6c3759176eee6cee19328"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__init__.py",
          "bytes": 820,
          "sha256": "1b1c11926fd3401b4f6697e954af6be92f5d032d835675600d51c929388f6759"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/__init__.cpython-312.pyc",
          "bytes": 955,
          "sha256": "590f8ae289363d0b5c08dab7ca0b1ca51a0437c3eb3d8d372042eb5c5a5c0c4c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/adapter.cpython-312.pyc",
          "bytes": 6726,
          "sha256": "f14aa7ec6761b136dc3dbb00ecb178e645eb13bd6c5b3ec3aa1e760758648123"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/cache.cpython-312.pyc",
          "bytes": 3820,
          "sha256": "a37b484b6ac11c60cb34af795d3b0ed9ebe17c42f348e1bfb6b3061d99fa8c9b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/controller.cpython-312.pyc",
          "bytes": 16486,
          "sha256": "d28f3d4058f97dd71137c10b7d1729762de94e8de28b09dfa50cb43d62a88bd7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/filewrapper.cpython-312.pyc",
          "bytes": 4428,
          "sha256": "7d517875deec43331e77d79ebb931ebfe3d9473247da73a07548cec9433c4285"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/serialize.cpython-312.pyc",
          "bytes": 5294,
          "sha256": "025df6eb8be968226b965db082f7e181eab3caf91dfa9a25a575d279dd81aaac"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/__pycache__/wrapper.cpython-312.pyc",
          "bytes": 1707,
          "sha256": "068cca0636f6fda52fda17736ae1a25eb59f5190ae5e16d03e392d0a8c8e2a56"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/_cmd.py",
          "bytes": 1737,
          "sha256": "8a2b2dd84a7326f0d5221300c57abc8859d306c89901dea2a65c5f98d6e83729"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/adapter.py",
          "bytes": 6586,
          "sha256": "5be1d6fa5d358320ac9f190ec826eac7bb31ad662805b2ab0ec2a455540de8d1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/cache.py",
          "bytes": 1953,
          "sha256": "397c2fec59f60309ca3626a12479e3b6f68a2e776f54bbfffb33be96d955f6a2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/caches/__init__.py",
          "bytes": 303,
          "sha256": "76daebae82b90670034751968c2675f5a674b45b0c7ef141b4b410535b29fda8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/caches/__pycache__/__init__.cpython-312.pyc",
          "bytes": 468,
          "sha256": "5045807098d07881a6cf422fbd7db1563a7524a744bdf2608ce1154bd9eea20f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/caches/__pycache__/file_cache.cpython-312.pyc",
          "bytes": 7067,
          "sha256": "78742e039e70374c0028d294326a9054be8ddb238c4e7c8dfb643e82a4102893"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/caches/__pycache__/redis_cache.cpython-312.pyc",
          "bytes": 2766,
          "sha256": "11aefef4cd26021bbf746d66b13198cf1894e5f359718a3e3e4d909c3b66b544"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/caches/file_cache.py",
          "bytes": 4117,
          "sha256": "77cba9166cbfcf06829a56d61150652d715d76df19c3c739485a7178e66c75fc"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/caches/redis_cache.py",
          "bytes": 1386,
          "sha256": "f6b9aac2d62efe58d5916ebfa0ba9b0bb11a5ff6bc613ff22ee9daf9e4b4760a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/controller.py",
          "bytes": 19102,
          "sha256": "c416ae0bebd44aee46b09b310f8f96f8968aaaa6c1cf430de99bfc3c0d8df212"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/filewrapper.py",
          "bytes": 4354,
          "sha256": "0e1c42feb4a4f9b78a75bb1885fbc1503a2f4075fdaf78071ff8cff7eabf98a9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/heuristics.py",
          "bytes": 4881,
          "sha256": "82a31753cc34810b8442249dbb7620fb4bddf645bb9eb58a6cb71aef9ae17861"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/LICENSE.txt",
          "bytes": 558,
          "sha256": "86eeee87be2a43f3ff1f56496f451f69243926f025fedbb033666c304c4c161b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/serialize.py",
          "bytes": 5163,
          "sha256": "1d0776225950d391f33e454b3174c5dae5f99a31108c3064c42a94254383a599"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/cachecontrol/wrapper.py",
          "bytes": 1417,
          "sha256": "86c19cee0f101904d3fb87fcb60cf700ce6ac12720e853b405274b491744be95"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/__init__.py",
          "bytes": 94,
          "sha256": "f96d51ff2f1609a4a44f5b5d8eec47ff34c1658d581fac5081d3759db05a8ce1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/__main__.py",
          "bytes": 255,
          "sha256": "d64dc2afde6f0b1c464460e58eb5b7c0c76965d2f73617f4bb59fe936a9db026"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/__pycache__/__init__.cpython-312.pyc",
          "bytes": 351,
          "sha256": "13d695c228573eb40fb51381291884b56e14f9c082a9757f6a80d5104e9dc73f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/__pycache__/core.cpython-312.pyc",
          "bytes": 2115,
          "sha256": "7d1a0726dc0bedc3f5b654f03eb0d3ea5f8698d7ddb915ff093be559798f163d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/cacert.pem",
          "bytes": 234354,
          "sha256": "bbc7e9c01d7551bb8a159b5dedd989b8ee3ce105aff522b68eb1b01bf854cab0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/core.py",
          "bytes": 3442,
          "sha256": "82efc40952359b746ad32b69b0d13ad6181019c29a380b7d46cf46f0ab1308e2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/LICENSE",
          "bytes": 989,
          "sha256": "e93716da6b9c0d5a4a1df60fe695b370f0695603d21f6f83f053e42cfc10caf7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/certifi/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distlib/__init__.py",
          "bytes": 625,
          "sha256": "b66613841d719a07d18d1b72cbc60fd22d329ab1769fa795b307302ba3986dc7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distlib/compat.py",
          "bytes": 40605,
          "sha256": "1d3ce1398f7c73f7f231513bc6d56e659f80564378f9119eb3e8569afbb0aae9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distlib/LICENSE.txt",
          "bytes": 14531,
          "sha256": "808e10c8a6ab8deb149ff9b3fb19f447a808094606d712a9ca57fead3552599d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distlib/resources.py",
          "bytes": 11350,
          "sha256": "c19b7f024a3c4d8f8be9920098fe3627b30d5f45d3105ea090cd0e9b917b50f6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distlib/scripts.py",
          "bytes": 18835,
          "sha256": "ad59b803e61f1900e9b0e4703b2ec0c1ea724536b2bb2eab73e32768230101c3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distlib/util.py",
          "bytes": 68167,
          "sha256": "9f64035ef0745edc2bb5e872827c1d2e02e42e26b9f2c663ce064f2b20faac01"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distro/__init__.py",
          "bytes": 981,
          "sha256": "d9f1e317e49f80fbe3c8d67588787fc23a96751fd8a393831f0642d232c13e17"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distro/__main__.py",
          "bytes": 64,
          "sha256": "6eef5ddd389fa0a72264572a441bb2815dc64ae4e19d50ff9b620ae1ccfde95b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distro/distro.py",
          "bytes": 49430,
          "sha256": "5ea6de7da7008434f8cebfedae76c0d79798f2f74ae064e08609af506ac433fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distro/LICENSE",
          "bytes": 11325,
          "sha256": "cb5e8e7e5f4a3988e1063c142c60dc2df75605f4c46515e776e3aca6df976e14"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/distro/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__init__.py",
          "bytes": 868,
          "sha256": "30fa8d0cb65b5ea19a35d5f1005862a853ca1105e3bb68cd42109ecbafb97893"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__main__.py",
          "bytes": 83,
          "sha256": "e0930aeba5a3e2e2d94ca6c5fac4f72c0c4eb2be9bba283becf98e909091471c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__pycache__/__init__.cpython-312.pyc",
          "bytes": 919,
          "sha256": "2e844281d6f29ad6a12ff404418e3a675f9253ffe6bc737a7bdda88e9797d1ce"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__pycache__/core.cpython-312.pyc",
          "bytes": 28089,
          "sha256": "71c19f9b27f643d2e7a1bfc9c458e9c823aae538d2e4616e58498fb491e405f4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__pycache__/idnadata.cpython-312.pyc",
          "bytes": 22066,
          "sha256": "7891ff8f4c822494442bc18acad89e2420a472eaa07a914453eb29d757dbe64e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__pycache__/intranges.cpython-312.pyc",
          "bytes": 2624,
          "sha256": "6ce55335fe1a7182198ef9796b6bd200bbadd44ab6db00f6f322cc726c550425"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/__pycache__/package_data.cpython-312.pyc",
          "bytes": 250,
          "sha256": "11cd4e83c70590e286d1f9421106c0bb3f36af098ec18b433ffebba7d50fd134"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/cli.py",
          "bytes": 4139,
          "sha256": "b30a892cc35cf14ceceb42b388da5b5a71eeaa51b75914302526e8e27f310c0a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/codec.py",
          "bytes": 5040,
          "sha256": "2516e8f9fee91242dd59e887f3d67bd94478541621bca0c5ad005e357eac4431"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/compat.py",
          "bytes": 1353,
          "sha256": "01ea40dfd71e447c647c73f8d7e16f296e4a8be7f83df519f7445432508d766a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/core.py",
          "bytes": 24685,
          "sha256": "49f3abd713b73e8134443631edb31c8809e38b28c93db3f0ffddc007921460ec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/idnadata.py",
          "bytes": 44862,
          "sha256": "01ffa6a3c5819a48402ba4f25ca3901fcf0e5f49903432ad74bed45ad429a699"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/intranges.py",
          "bytes": 1851,
          "sha256": "838f6c70b4a4a89b4084b98e3836bb8551eb8928e66fad2d893b04a287097412"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/LICENSE.md",
          "bytes": 1541,
          "sha256": "1a9a4f0e3d479a27240ddd59a9137a66ab4a0f9dfdc8ca6188cc0bfd85187f04"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/package_data.py",
          "bytes": 21,
          "sha256": "4de23de04a8014015a5df049c2c38f50c2e7dbdebdba2acf6be0da79a71e0325"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/idna/uts46data.py",
          "bytes": 234325,
          "sha256": "8ee8cdcf942a58c7097fe5d82efe17d6306f6f9165234b7af9ed6620bb206cf9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/__init__.py",
          "bytes": 1109,
          "sha256": "440f2072a2b5ed8a64c419cdc172556b5a1ad8bca058381f1759c0d4d3f0de6a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1772,
          "sha256": "7a36a85884255a7965caa6757d65070333ff724f09a307db16e08f8b112efa2c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 2058,
          "sha256": "a55d59ec6f1a57c400dc41bb605bcc389cefb2f655fa184f4d278f53779f5797"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/__pycache__/ext.cpython-312.pyc",
          "bytes": 8326,
          "sha256": "59b5049630923bdeeb503afbb06b79b0d7aacd4d3c775911145baeb40256df3e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/__pycache__/fallback.cpython-312.pyc",
          "bytes": 41523,
          "sha256": "05a9d5c4274bcd4860c51f347d160c48428c04dc269439c11c8c3991f64e57ee"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/COPYING",
          "bytes": 614,
          "sha256": "492dedba85da5872f78e6091bcd1fea474d660d35acb4dee964b8aab3f007427"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/exceptions.py",
          "bytes": 1081,
          "sha256": "7424d67a2f1da64accb100dc8d093be004e5f47b08047d326edf3338f36a3187"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/ext.py",
          "bytes": 5726,
          "sha256": "92d789bf4de7f6d633779a28df1628a554e8e2f45a031a27050409857a21659a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/msgpack/fallback.py",
          "bytes": 32390,
          "sha256": "d20d4fce9d2fb66044989e70f45decffe24c55444ff114b81b571ce5345a02c2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__init__.py",
          "bytes": 494,
          "sha256": "42130474fbb65e882b2735774b42964bab7b97423d93c11e0d1265e1f9f0f3bb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/__init__.cpython-312.pyc",
          "bytes": 591,
          "sha256": "08eeb86e0343c34623e7824ccd3ad979fc0678f372c34ada9987d834d7af4f4f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/_elffile.cpython-312.pyc",
          "bytes": 4971,
          "sha256": "9e74a7ea996bde61cc5a1b6fdbe21234a12635f6346381376e9b780dd4c5cebc"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/_manylinux.cpython-312.pyc",
          "bytes": 9890,
          "sha256": "a1110ca0572f79dc93ead556f0a1d302356056bb9fda0f8a13815ff52d58b9a4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/_musllinux.cpython-312.pyc",
          "bytes": 4599,
          "sha256": "5c01731ff140e990d634ed7d6a5ee63291e7babdab6b0ba4d2669a264e36d760"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/_parser.cpython-312.pyc",
          "bytes": 15608,
          "sha256": "dee03e255cf205ae26f7786d8f54b43567e6ad164f9941da64175a017577b432"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/_tokenizer.cpython-312.pyc",
          "bytes": 8483,
          "sha256": "874e4a05998f7474d4a85c08cdd7dcbc1a49fd697eda00f365d8e1fef3536262"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/dependency_groups.cpython-312.pyc",
          "bytes": 11048,
          "sha256": "15f6f0cd7fcbe5b845dee0cff1be57ee29c5e01973ad42402e4cd296a43a117f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/direct_url.cpython-312.pyc",
          "bytes": 14560,
          "sha256": "0659e2d9dfa643b6fd862a69b9e4918b755b7101f8f58ebab76ece26a6f6d157"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/errors.cpython-312.pyc",
          "bytes": 4457,
          "sha256": "1007e40e227788f42679a1b02eb60222647c34f0478953084e11b681d4e44259"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/markers.cpython-312.pyc",
          "bytes": 17494,
          "sha256": "63f2d7302479f39bb6d2664c91499f70240464515960c2cf992198250e0c69c6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/pylock.cpython-312.pyc",
          "bytes": 37438,
          "sha256": "d7d9de4e1e5b9e984d46b535cc0eb4c65234930bb94655af5a8bec2859f9f982"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/requirements.cpython-312.pyc",
          "bytes": 6135,
          "sha256": "f5adf5f240c7e2b059d52b84bd074db8c494114c6de8b54125a0a1b9cc343923"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/specifiers.cpython-312.pyc",
          "bytes": 75818,
          "sha256": "4641a44b0a966c4dcd8ef70d86db019efbed7562623633bbd766a5fb220c2a17"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/tags.cpython-312.pyc",
          "bytes": 37399,
          "sha256": "48125e13442067dde9d550c369c8aeb3ef4c7d30263d72f01aab3d43d8aac602"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/utils.cpython-312.pyc",
          "bytes": 11087,
          "sha256": "65002aecb0c1e6c15b7cb4e19294eb9c212dc3a5f7d6ff6f833f9626b69a42cd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/__pycache__/version.cpython-312.pyc",
          "bytes": 41832,
          "sha256": "c81c941ce76c7d7838f920187a6568acc60992edc013af8ef1549d0605657f0f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/_elffile.py",
          "bytes": 3211,
          "sha256": "fac2a4a6d62acd8c36fb1dd007225ae66078adf3d6bb5a719191d1c755801426"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/_manylinux.py",
          "bytes": 9559,
          "sha256": "1dfea707470eadac84b3debea77a085c08069c5aaebf6d033b997ea36fd79efd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/_musllinux.py",
          "bytes": 2707,
          "sha256": "67ab308c7dcc03b5d2dea5e798c37b40f86a3f77e7a18234790d7c7bdf878001"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/_parser.py",
          "bytes": 11698,
          "sha256": "29fda7b03c38739e17f36a58f1b6b8174d81bdee8eca018c0232fe05e82a71ec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/_structures.py",
          "bytes": 1109,
          "sha256": "eb48d16c5efca7ccf930a9cd77a700a6b80e69d0891d5d03966526441a8565cb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/_tokenizer.py",
          "bytes": 5391,
          "sha256": "b455365abf996497406e45cb109a3ba9440325a2247dfb7d0ea6a27e210d0fb0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/dependency_groups.py",
          "bytes": 10218,
          "sha256": "5d92005452bdb871b84421a9ae6267dd522751631eb3185afe4cad26e30ef5e6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/direct_url.py",
          "bytes": 10917,
          "sha256": "78a99b0e23cfd6c2d5e0c8ff902499aaa927ac8c953bd4abec9a45f0a0a3a785"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/errors.py",
          "bytes": 2680,
          "sha256": "ea17c461701ff2ffc817ae7e94569d24e30889e04fdb120ab721178c6d67188b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/LICENSE",
          "bytes": 197,
          "sha256": "cad1ef5bd340d73e074ba614d26f7deaca5c7940c3d8c34852e65c4909686c48"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/LICENSE.APACHE",
          "bytes": 10174,
          "sha256": "0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/LICENSE.BSD",
          "bytes": 1344,
          "sha256": "b70e7e9b742f1cc6f948b34c16aa39ffece94196364bc88ff0d2180f0028fac5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/licenses/__init__.py",
          "bytes": 7293,
          "sha256": "fc9c745d1883ff9f296a5b169f22eb2ee879f59a4608f20f5cb29d668f4e26f4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/licenses/_spdx.py",
          "bytes": 51122,
          "sha256": "596ec35e2ca0ebcba9fd8343ff0a51625af548786257815f24b41f7e08613314"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/markers.py",
          "bytes": 17067,
          "sha256": "422c4155c6fd0f61e3c04622ba1a4d91baa4f739cf45b53cccd5f4911d5122b5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/metadata.py",
          "bytes": 38770,
          "sha256": "72b021d04dc654656a3e5bba11d445b1a1be63a518ce74d4aa3b8629118fbfa7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/pylock.py",
          "bytes": 33890,
          "sha256": "1bfd609dc4e60db44b6358e8e150c8f54c3e6f9204ae1fd0f55fc16d5253983f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/requirements.py",
          "bytes": 4395,
          "sha256": "43e05d107556e4aefce46057b7b45c3f8504b1d20a5a8585aa5ac78d1e16579d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/specifiers.py",
          "bytes": 71550,
          "sha256": "dd705c4ac966f984041043bfcebbf817a751e70471b3812b26f274be33417c63"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/tags.py",
          "bytes": 34236,
          "sha256": "00d607671610569f4194e41838753902b0cd548a53165e0a95ba1c6150569c5b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/utils.py",
          "bytes": 9848,
          "sha256": "33bf8930a89cdac3f562d57ff1a5bb795181fb1dc00ee282892aec55e09dd94a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/packaging/version.py",
          "bytes": 38393,
          "sha256": "31cbbb4dfe98d62d20438157bf8b7483c71b2f98e8004b218e0229cffdaf2122"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pkg_resources/__init__.py",
          "bytes": 124451,
          "sha256": "bdb4c9d3faee5201b1423944aacaee16688d3d5ca1dadf6afb3c930d3d39df12"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pkg_resources/LICENSE",
          "bytes": 1023,
          "sha256": "86da0f01aeae46348a3c3d465195dc1ceccde79f79e87769a64b8da04b2a4741"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__init__.py",
          "bytes": 32389,
          "sha256": "80198bfc9fca74f80a8b03377470a8fb2fbc09b4b4e9009ad5722127d6c881ec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__main__.py",
          "bytes": 1773,
          "sha256": "0d0d68d44d65d0686e8ad8f8b9024a00fc2470a6c6ce4cced2c6e1cddf516d47"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__pycache__/__init__.cpython-312.pyc",
          "bytes": 29904,
          "sha256": "0ca7c31100f5d77e2711d3c70a6e2b5ffc51d1007bd2d6d2d4a42fe931b7c704"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__pycache__/_xdg.cpython-312.pyc",
          "bytes": 13550,
          "sha256": "bb39987b9b74b43d872ac338d1701ecd2fd3a5a477e3764f72ef136a4f866dbf"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__pycache__/api.cpython-312.pyc",
          "bytes": 20902,
          "sha256": "cb798f1a88657a38bb96208db6163ed7a3574b48738362f6b2c1ba7bb511918a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__pycache__/macos.cpython-312.pyc",
          "bytes": 14420,
          "sha256": "cbf6ab13beaec36f9065720dbf4f4a1a81ec5cb2867ebc1ed85b5c5a74c0bb6a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/__pycache__/version.cpython-312.pyc",
          "bytes": 683,
          "sha256": "fb2733c58fd52a2ce25ecdd7d67729637df8907b3531f5af2ab2a18b8be51278"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/_xdg.py",
          "bytes": 7894,
          "sha256": "e70e92d3bbd569b1113a169407f5fb8b48662cd6dd62d0bd684bcf6ec1084bc3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/android.py",
          "bytes": 11566,
          "sha256": "0418f7c1fc3e75fb95c6c0ac2acbc5072295b2944381fbfc8302338691352514"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/api.py",
          "bytes": 14887,
          "sha256": "11a22c1605c6bbc7034dbe3558cde1b1efd2ac8a0e521b7cfd30a8e5774e3923"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/LICENSE",
          "bytes": 1089,
          "sha256": "29e0fd62e929850e86eb28c3fdccf0cefdf4fa94879011cffb3d0d4bed6d4db6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/macos.py",
          "bytes": 9538,
          "sha256": "3d6b9d78364063d52ec0b3ffe6b3777b149116d61d639e368438636a1e1d4960"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/unix.py",
          "bytes": 13317,
          "sha256": "5fb0a2a75c4e1c53a7495bdea8a5b35353fb8e7e33b831a9460995c499e4e2f9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/version.py",
          "bytes": 522,
          "sha256": "749bdd9bb2ffef0a1b11cc6b36826d1fb0ad998706fd5479c8d9ad06c849fb1b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/platformdirs/windows.py",
          "bytes": 15798,
          "sha256": "60e75218d85da719bfc9d66aeee1bbe22f665f6fd659b70c480e1fa1b5f02f43"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__init__.py",
          "bytes": 2986,
          "sha256": "5e777fedf254a94ffa0f46f15d6d2a4bd33f384f46e955bc60d3db18b5a82b04"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__main__.py",
          "bytes": 356,
          "sha256": "22a010ffcdfa2afd824f1f2be887ba76e450b9848f97ce6c6d8a2613022c635e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/__init__.cpython-312.pyc",
          "bytes": 3525,
          "sha256": "051475149c045f1bfebb5398be2837944127935c15f2ef1d4241086c8b2740eb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/filter.cpython-312.pyc",
          "bytes": 3258,
          "sha256": "34f675b0a3990a223cf0ed417707544cda912ca3188aa9cbe8b7994b0c34b813"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/lexer.cpython-312.pyc",
          "bytes": 38483,
          "sha256": "e15c3fc7e410a146298728b0de72753610c5d8c89f3b1a862448133367fe6d6a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/modeline.cpython-312.pyc",
          "bytes": 1596,
          "sha256": "399632a16a99ce5e576cc806230158f768d862a25c4d994eef11c3e134ab3e9a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/plugin.cpython-312.pyc",
          "bytes": 2723,
          "sha256": "453f245ccd22fe34937214535e37fcb327128a1feff7196f84d9644bd010304b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/regexopt.cpython-312.pyc",
          "bytes": 4484,
          "sha256": "eeea9dc55e2064267fc352ae5c8d42a58bd339936a45a094c269965ae917675e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/style.cpython-312.pyc",
          "bytes": 6730,
          "sha256": "c0e9c6523e9084e74d92d2d7f4e0144ee416ec4417722c0f4526faeb644ef95a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/token.cpython-312.pyc",
          "bytes": 8226,
          "sha256": "ef0ee6be88de3be9b6da0a0330c253b43f2c38ab2f47654972e54958e3586bff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/__pycache__/util.cpython-312.pyc",
          "bytes": 14111,
          "sha256": "52ecdb659cf3f9a6afeacdc61c5828c9b28841e1a178a69c7de619e02e7f1986"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/console.py",
          "bytes": 1721,
          "sha256": "0b5f3d240c210b5421d002a0b21cdbd70543cc5a819efd55678e644c40c83b7d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/filter.py",
          "bytes": 1913,
          "sha256": "d5d9db92ad80742dc0907b770da5f09ce91304b0a1975911ea76922f09ebfed7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/filters/__init__.py",
          "bytes": 40397,
          "sha256": "3eb77ac542bfee4c34ad0bff3973d8dfcef5473c2d58a1a9fe0ed275d6070578"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/filters/__pycache__/__init__.cpython-312.pyc",
          "bytes": 37950,
          "sha256": "77679a9c11d62a39bc73683ba0c826f823cd7de8643855ae830585dba360d4d9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/formatter.py",
          "bytes": 4393,
          "sha256": "12e0173d7e9cdd74240adde50f456148f4990721bb61093c1eb0b0c657fe0994"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/formatters/__init__.py",
          "bytes": 5388,
          "sha256": "1182c30888011cbfc392e84d4506651e94b6fd4139f8c7ec18bd6131c39af79c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/formatters/_mapping.py",
          "bytes": 4176,
          "sha256": "d42c37ec5b9094d69c9f144a9ad94f5f89f22e85fdfedb64a39670b1c354659e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/lexer.py",
          "bytes": 35394,
          "sha256": "c125c3cedd9f359252ae57dd21f9ca56585e469164b3390f9a0c0125ebdb04da"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/lexers/__init__.py",
          "bytes": 12118,
          "sha256": "b3c23fb55968b6b33c7054c69678f0e39518e6c8f98e10f0750cce3a387380d8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/lexers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 14658,
          "sha256": "cd89132a72b1afb27aeafc35efdb21b7f850313e8d494225c433e8410862105f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/lexers/__pycache__/_mapping.cpython-312.pyc",
          "bytes": 70164,
          "sha256": "222304faa8330096ccca14ffbc5907ec30f702937680f684bb706f1773bf5af3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/lexers/_mapping.py",
          "bytes": 77934,
          "sha256": "c060188ce069ac3559034d5ea1cc1c2c9e8bf1b88cf6b3f68f1c2bd5b409f7a3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/lexers/python.py",
          "bytes": 54250,
          "sha256": "4eac9f40e3e10983f1df96a940beb90808fd93ee01c6eccbabc3037dd9b68ef1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/LICENSE",
          "bytes": 1331,
          "sha256": "a9d66f1d526df02e29dce73436d34e56e8632f46c275bbdffc70569e882f9f17"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/modeline.py",
          "bytes": 1008,
          "sha256": "99ef20e6bc9289dbcfb4c04eac3cb63b5b0ca99774da5047318e4a0d979f530b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/plugin.py",
          "bytes": 1928,
          "sha256": "3facc8c3ebe4490d24d56287af36c14e3a7094264f6d1fba41efdd3bd06376ed"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/regexopt.py",
          "bytes": 3308,
          "sha256": "776853bdace5a30e73cd920e0959df7841b6098d06ad8fe2807d6409249fee8c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/scanner.py",
          "bytes": 3095,
          "sha256": "0eda0b8b5a4e2a936efba8e26a42694902d48bf7a9dbd490421bfba00c1858c1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/sphinxext.py",
          "bytes": 7984,
          "sha256": "45f9699df5c1e2b64b63267e390fe2827b553a507c8c6e36c456201152321dff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/style.py",
          "bytes": 6423,
          "sha256": "c094973978de84663123a7b70c6694b4e35e5ae8664dfb307e4cacacbf566acd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/styles/__init__.py",
          "bytes": 2045,
          "sha256": "91874218af2067557cc1f1501133b3a4f9994c9d67301d1bd6236553c74743d1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/styles/__pycache__/__init__.cpython-312.pyc",
          "bytes": 2701,
          "sha256": "d0a0f9810262dc7d172c2047dc65026a67587dd87411a507f8332b4c47139092"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/styles/__pycache__/_mapping.cpython-312.pyc",
          "bytes": 3682,
          "sha256": "5f9826ecb899cea97e171eca99ab7537c8d6bdbfaa0e3d818a3399ef1f59efee"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/styles/_mapping.py",
          "bytes": 3312,
          "sha256": "ea5a2f154136f6dcfa12c5775d8638860a3327bab524bedc7cedd43a58274bcc"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/token.py",
          "bytes": 6229,
          "sha256": "0d58a5e53da5b479138104d4632d5d32d8328a08dabc2b35ca913841fd82ac6a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/unistring.py",
          "bytes": 63211,
          "sha256": "678c381df395521b9e09445191f840a90d9bfbaf54ce4858e31b877af604cb98"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pygments/util.py",
          "bytes": 10046,
          "sha256": "ce4f77e6d252a70480f73c4d995d53ba17043f431f6e85e24594864272cf12a9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/__init__.py",
          "bytes": 691,
          "sha256": "70f07f6bd2d7cf9c6fb116d7d68daac807632dab5925d43f2dce4c70d5fe5fb6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/__pycache__/__init__.cpython-312.pyc",
          "bytes": 781,
          "sha256": "32e28f76b3c4a2c4a6e8da031624b82de1929b06f800fce53c7775319d2774db"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/__pycache__/_impl.cpython-312.pyc",
          "bytes": 18080,
          "sha256": "5120fc2709781db5a4463af16c0f99484e0499a41a02c27216af23e6fe23740c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/_impl.py",
          "bytes": 14936,
          "sha256": "8d8fab6b19e6c91c81e7baee022b6b25153311ec6e021193a6033282ac7aed9e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/_in_process/__init__.py",
          "bytes": 557,
          "sha256": "30934fa5f23170ef85821c6905bc641b5ac58907fa1ce51b5785399aad07167b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/_in_process/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1110,
          "sha256": "38dcccf95953340d9bc538662e25086cc77465c03d6d630bb96b2e3de7ec515d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/_in_process/_in_process.py",
          "bytes": 12216,
          "sha256": "a9c5cc866c7ffcc209ab5d201875b7980e1397c772f18cc731c7309cda0a970d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/LICENSE",
          "bytes": 1081,
          "sha256": "1b22b049b5267d6dfc23a67bf4a84d8ec04b9fdfb1a51d360e42b4342c8b4154"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/pyproject_hooks/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/README.rst",
          "bytes": 9222,
          "sha256": "b7b2229e36a2bb0521f35d9799502940725bf294f0df753c03d511ab2e86945e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__init__.py",
          "bytes": 5873,
          "sha256": "9c2d9ab6d17076860dfa813afaf416e1c8aebc8bbb2763ff4d4d6a4360dcb9e1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/__init__.cpython-312.pyc",
          "bytes": 5648,
          "sha256": "878cf5bd9617375dcad185339a80603e05ede0017a794a251e4043edf048fb46"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/__version__.cpython-312.pyc",
          "bytes": 618,
          "sha256": "cae32d26033de78747096fbf0ce87f7fd594861ffc30158542282c8cbd5ab905"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/_internal_utils.cpython-312.pyc",
          "bytes": 2162,
          "sha256": "a79ea089d03838158a62695ce2e464d545f9cb7b54539c1465de585de5513a18"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/_types.cpython-312.pyc",
          "bytes": 7300,
          "sha256": "a9c6dfbb2767ddfe9faed3834c95ca33470d01eee806fc34c1b5c2c2a0451183"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/adapters.cpython-312.pyc",
          "bytes": 29729,
          "sha256": "82f27cb7031b6f0b289955d4111553ce571dc11661e6d5af0c1947bbfbc03af3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/api.cpython-312.pyc",
          "bytes": 8080,
          "sha256": "f1e10e0ea0b7dff707afbfa1a232e39d7dca1dc317ab244f9db0e81ab9b97aba"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/auth.cpython-312.pyc",
          "bytes": 15820,
          "sha256": "53af85633436072e6fdf9cf2e20f7053c048f1b734f55cd2f124be430b7bf76e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/certs.cpython-312.pyc",
          "bytes": 712,
          "sha256": "c2aa3671817a58aa83b063b59a4086e343fc3a3d7f8ae51502301ccc289b222f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/compat.cpython-312.pyc",
          "bytes": 2084,
          "sha256": "2108fa2a68b1307a15b148a8d794ceb2b741ab91add041d05d5d0480b9cbbcbf"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/cookies.cpython-312.pyc",
          "bytes": 28399,
          "sha256": "208c0a043099c3bceadd4674e6c96e6026971675b14dfbd76313af641dbc4d35"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 7998,
          "sha256": "dfefc8a0023f30b2cfa6d5d311f69b9c8f22446fcc2cae42b6f9b3fdcb63e6b0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/hooks.cpython-312.pyc",
          "bytes": 1619,
          "sha256": "e88f60a4e716c2a8ff204afdaabc8f0c80707f49a8e3a8958905c450b7c244b3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/models.cpython-312.pyc",
          "bytes": 42016,
          "sha256": "92435f9a425dd21a74b132c86d6ec117e429825a3cc36b2b6d57ef7809a6b792"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/packages.cpython-312.pyc",
          "bytes": 1300,
          "sha256": "c2981aa09151c3721e44a2c60f5585f6fdf8d67e1397cab0eeeaaefed4214102"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/sessions.cpython-312.pyc",
          "bytes": 31942,
          "sha256": "7dbded8c72f3bd115afd3bb9722e182dbbb5a8a9ed351025be329c3128a3f612"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/status_codes.cpython-312.pyc",
          "bytes": 6174,
          "sha256": "88697c3f5eecae1f9456a0f2197246f895356a551d4c392a652413bca7800161"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/structures.cpython-312.pyc",
          "bytes": 7319,
          "sha256": "ff39b0afa59544fabb09e4bc5aad09dd477003bd38b39ed54a9483fd1c23e1b5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__pycache__/utils.cpython-312.pyc",
          "bytes": 40075,
          "sha256": "8442df1407770c23eed10faa4ddba9b1e0540dfb5dea53d0d28df958f388eaca"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/__version__.py",
          "bytes": 435,
          "sha256": "abba90670b0370a3dc40d97c2dea46a35d4bec941ff10d7c3cf3098ef04a17f9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/_internal_utils.py",
          "bytes": 1542,
          "sha256": "4c7d8d132c9898fc7d715e473f3ac74785ddc4ab96d2c9240f87835dc6d981ff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/_types.py",
          "bytes": 5838,
          "sha256": "d06df79f54a279c0cc3faec596c446246d5ad14edfd529eb328defbd62a44a89"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/adapters.py",
          "bytes": 28208,
          "sha256": "e6448a857949b91fde9eb3a3777921486a51063d56a82874f10b2cbb408467c3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/api.py",
          "bytes": 7152,
          "sha256": "4d15480ac046f089209798e8650476ef4a28ebe6f81b400758f8ef42ec6b5509"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/auth.py",
          "bytes": 12233,
          "sha256": "e93951a552d4c3c5fd9b84a5e1d49b03caaba4723c4ff112da6053600ec85a65"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/certs.py",
          "bytes": 442,
          "sha256": "783d46d11a0c677900d25c9d930ee8a3496670aaaf0f5861cfac8e96048a9bcc"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/compat.py",
          "bytes": 2035,
          "sha256": "d5485e146a2671e59eedacac81ba185b1704387fc7a501662a12323e201a9e88"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/cookies.py",
          "bytes": 21549,
          "sha256": "0a1ce6140f2b9420522c5080e356e689fa796c2522f55ca10826f5ed8e0a723c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/exceptions.py",
          "bytes": 4576,
          "sha256": "026eb2e27728069b6999eb0e8d1c5ce628ae043623c7750dd684550653604721"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/help.py",
          "bytes": 4114,
          "sha256": "4d559e8e40913b029ec471c1e38282652afe734a395da90d2fb2d3d54265472f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/hooks.py",
          "bytes": 1138,
          "sha256": "ebd8a02475d31a0e473a8f553e9501ff43645b9563885ad52844e7a63f0d76ab"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/LICENSE",
          "bytes": 10142,
          "sha256": "09e8a9bcec8067104652c168685ab0931e7868f9c8284b66f5ae6edae5f1130b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/models.py",
          "bytes": 41848,
          "sha256": "f7d77b585e29477e4d1e8f63adb1a2068719dcb08cb25a155340c0710e3dc774"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/packages.py",
          "bytes": 1057,
          "sha256": "fd94030894c9f123f79155ae9d2a81b1164d3f38f673558556a6ddaf4f29cf75"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/sessions.py",
          "bytes": 34248,
          "sha256": "96fbb30bbbf06a59a5268d13b57885149756aa3f31695b5c15e41dd7bb2f67a6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/status_codes.py",
          "bytes": 4351,
          "sha256": "1950f47c89cf18019787e07d8ce48f66d6b38e622f7d94d70a90247fee6c040e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/structures.py",
          "bytes": 4134,
          "sha256": "ba9460c39078f25e6f1d2a24ac941ac6f8d2ee97197fa8c8d0c262d8a1e67a02"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/requests/utils.py",
          "bytes": 36334,
          "sha256": "bbb3080b2cd04ef7d46b76ac83d9c1bdcae785220f11ceaa8494b18861b04ce9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/__init__.py",
          "bytes": 541,
          "sha256": "ca85fe778493bf01860a24111397090bd0ad7abebd4a0560a82971382bd23fb3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 668,
          "sha256": "ee6f51459d6bffdb4f372fb14695410b84d9e27a1df7f3228b2968a975947ea5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/__pycache__/providers.cpython-312.pyc",
          "bytes": 10159,
          "sha256": "ec803fcd487e1e37b23b39a601be4b92e33021a54d22b4222f78d372ff7c5bc2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/__pycache__/reporters.cpython-312.pyc",
          "bytes": 3323,
          "sha256": "e5d15fefa3253b3cc295a8d0b6c2408d08cf6f307372c0f9eb2ae81531f8cf23"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/__pycache__/structs.cpython-312.pyc",
          "bytes": 12478,
          "sha256": "aca26eef635c71d4abc712d7c1de91db60d457aca6d84ccd458d418ee464de80"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/LICENSE",
          "bytes": 751,
          "sha256": "f388fd38cad13112c1dc0f669bbe80e7f84541edbafb72f3030d2ca7642c3c9d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/providers.py",
          "bytes": 8914,
          "sha256": "a485896c874927d185b4d6edc131f421ae37563ea16021098f60ce2ee7b5e453"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/reporters.py",
          "bytes": 2037,
          "sha256": "a4d25fe271712e901e2b1941522d86123d1ad888f59e2918d1469b4ca5deb13e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/__init__.py",
          "bytes": 640,
          "sha256": "ef6f0cdc4be69cf6d55d2ec4c5796fda432ee9bef012ca0fbad11f97eb9593f2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 773,
          "sha256": "e1c092c0fac2f31d073d182e25decf92b04959f2f60f175ab951d3ed79585326"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/abstract.cpython-312.pyc",
          "bytes": 2479,
          "sha256": "e54fc487243e9ff8133de057146feaece5e431a3d8f66beb0d6e9849262006c8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/criterion.cpython-312.pyc",
          "bytes": 3310,
          "sha256": "2aaf17d7980018941450f16ab7e0fff5c57db8887aa24f542e7e1f79e73211e1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 4117,
          "sha256": "7387dcef6283f956a41a31907a8e90073f3b035ff0c2b71431b579deb26ad18e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/__pycache__/resolution.cpython-312.pyc",
          "bytes": 25179,
          "sha256": "51343ae5e323f5c7db84ac2d8c77f391c5315e1810f1093490bffe8a9873a1ff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/abstract.py",
          "bytes": 1543,
          "sha256": "08d7903e7a40b9d63bee79b33a438d4a6020465cc87f4e97f97f66bd160e0e6b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/criterion.py",
          "bytes": 1768,
          "sha256": "95c9991afe6c2873a7143fd1cd9c2f9464a3d7d31e03ee6b08ca5d7f64a0c3b6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/exceptions.py",
          "bytes": 1768,
          "sha256": "967fe3690b602e545448563adbbca21c6da00fb020697cd129a12515587b7c34"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/resolvers/resolution.py",
          "bytes": 24212,
          "sha256": "dc9ff3916fac0f7118f8194d5e3ca59fffe78e9c87e67d146494fab95ec285e0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/resolvelib/structs.py",
          "bytes": 6420,
          "sha256": "a6ef84262476201213af649078d3d16b4ad7863952b5f98efc6120021af7d34e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__init__.py",
          "bytes": 6090,
          "sha256": "751c6320bf926c5558d2adc88d232b7e00531eb9b52d90e02ceca0541c226197"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__main__.py",
          "bytes": 7896,
          "sha256": "7bf6950beb43cdaad6416f52b9932e0a006be8e0d5fe20cd5765a1db19313a5c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/__init__.cpython-312.pyc",
          "bytes": 7049,
          "sha256": "f8b99009335d009b497b8d3bfdf6a53b606ccd7e32edf8b16eb04dcfb811f7a8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_cell_widths.cpython-312.pyc",
          "bytes": 7906,
          "sha256": "cc0aceb4286daed9ed6244e1dc25993abf47084d6dc734bbd47bc6ab8322e01d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_emoji_codes.cpython-312.pyc",
          "bytes": 206010,
          "sha256": "3a1421b7ddd5090d4bc0d833ef65af93ad1ddb1fd5efcf3fde0964d3a578608f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_emoji_replace.cpython-312.pyc",
          "bytes": 1763,
          "sha256": "8e2fc3a0e365d72c2726ccb7ca5b2f40c1715eb4d5be035b94907e8364496697"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_export_format.cpython-312.pyc",
          "bytes": 2383,
          "sha256": "ced6abe339d68402cb673936aae04df43805818fe1bdbc6ecd5095b98c49b173"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_extension.cpython-312.pyc",
          "bytes": 571,
          "sha256": "0b73d135ba4ba089cd866d84f2095648c62a9e478190cd390abd560920f56e6b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_fileno.cpython-312.pyc",
          "bytes": 889,
          "sha256": "d32c8797199d172badc39a5351b128d34f9f1fea85dfefe41180b164836c7945"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_log_render.cpython-312.pyc",
          "bytes": 4181,
          "sha256": "596eb1c68a90262730df85f86c0da66cf55e31a72ea7350899b45806c36e5b8a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_loop.cpython-312.pyc",
          "bytes": 1904,
          "sha256": "3b49772537e0dbb9fcfb6efa76f791d587185472c63c78a79c6cf97d5b424e25"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_null_file.cpython-312.pyc",
          "bytes": 3663,
          "sha256": "bf4f2387d564e8dd08fb11510788e89e3ce711c78ca9b0b7883e055990a98425"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_palettes.cpython-312.pyc",
          "bytes": 5194,
          "sha256": "58181d6c46906f7595dacf2fdb6c203e784cc722c46af2936f971ea90dc9c86d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_pick.cpython-312.pyc",
          "bytes": 755,
          "sha256": "4936ee6337cc76a062f96364c803e90624e502f46b75b1ee5b02f3f214b09d7f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_ratio.cpython-312.pyc",
          "bytes": 6457,
          "sha256": "0194fda57d2292601256bcb2d3b0d63bb48fe8b65d16405312e6ff51f7da8b20"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_spinners.cpython-312.pyc",
          "bytes": 13213,
          "sha256": "587c8bbfdd66cefc75db549d6df6bb0f8870e5ede6f935a1e93c936fba174ae3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/_wrap.cpython-312.pyc",
          "bytes": 3360,
          "sha256": "62990e332faa097bc6c7b6fa2a4ad4812ad4d7405a4f0df7a0ffe1ba7838b78a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/abc.cpython-312.pyc",
          "bytes": 1642,
          "sha256": "104dc55f60b917c2476a38dae76514b02d748dbbb8c8a38d61a3e9c938a24d36"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/align.cpython-312.pyc",
          "bytes": 12278,
          "sha256": "9e284e9ad68c2efec4165c846ec8cb79125ca233e2f00a99d4722c11e5ad6fcd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/ansi.cpython-312.pyc",
          "bytes": 9115,
          "sha256": "228741b80167c19d3de0fc3d09e2427d42aca1c6d561682ef8c1834f2f563104"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/box.cpython-312.pyc",
          "bytes": 11725,
          "sha256": "c2afc18484cd73881d9c12c64906986f7a75442acdccb1dcededda4d6c97ae6d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/cells.cpython-312.pyc",
          "bytes": 5594,
          "sha256": "83ac6376d3d2e8cf1735f2ff0cdac17ed15d72057a13b6d8144d02ea54c929fa"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/color_triplet.cpython-312.pyc",
          "bytes": 1735,
          "sha256": "fe23d4ad2b9e1587ae78ac402d7c5994520f08e1db3dd8d645f7ff8d56747764"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/color.cpython-312.pyc",
          "bytes": 26586,
          "sha256": "810187052e53467a1a098db90e4fb4585c2b19fe15cfc2eb38c3efd1dffe3a01"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/columns.cpython-312.pyc",
          "bytes": 8618,
          "sha256": "529bb938280232e81012c6ab72305c42bfb84b9ff70ed28a0021fd0709a2501e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/console.cpython-312.pyc",
          "bytes": 115076,
          "sha256": "3438598a06722ce33927aee73ab1a621d964613ab7c12cfdc0b1241dd1b6882e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/constrain.cpython-312.pyc",
          "bytes": 2292,
          "sha256": "090df90373d8d6d27f6b91ae32a38673ef9c4c1a528d359022a5d6218d4f6a7a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/containers.cpython-312.pyc",
          "bytes": 9244,
          "sha256": "7a78df29ca7c6dbdd2a74782ec871ac245b0c1211a412666c0845929d53d42be"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/control.cpython-312.pyc",
          "bytes": 10830,
          "sha256": "53d4a968b90c96eacdf6ab0e50ebe0ce1f3454dcdcc89a21d591ed1c6957845a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/default_styles.cpython-312.pyc",
          "bytes": 10555,
          "sha256": "61dc0a0d37172a74c6fecfbc9761c20e9dc2139913785983aa718d9bc03fb681"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/emoji.cpython-312.pyc",
          "bytes": 4115,
          "sha256": "fdd9ae714ce75abc73874f3cf008024c47b7904e0f318a48b70b87d86b71e00a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/errors.cpython-312.pyc",
          "bytes": 1879,
          "sha256": "0275917ce97a4b9d1a5fdcb245d8f12713b83ef95752e5788b723478a5e2711e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/file_proxy.cpython-312.pyc",
          "bytes": 3605,
          "sha256": "bccb9370e273cd9e63e23f3eed0a12d4f002d309721c0fc0d9a8c7e30757f3ff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/filesize.cpython-312.pyc",
          "bytes": 3081,
          "sha256": "fd10bfd97cd8e372ee17eb84a8b23a203997a16a719a48c2443a4439ed9ca713"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/highlighter.cpython-312.pyc",
          "bytes": 9922,
          "sha256": "9bb299ba3e2d9b6219b7a9e94550cb89ca329828dc50c10dd9ff6b4d626697f7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/jupyter.cpython-312.pyc",
          "bytes": 5242,
          "sha256": "854f6b42ae7a0ef6a7fee2dbe289502319ad7b0e1d8f48ec472093b4a0be0e0e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/live_render.cpython-312.pyc",
          "bytes": 4779,
          "sha256": "2792249375131f3f24acfd2c47e559cb0f0dedbf0705d6a6c6322ddff07070d5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/live.cpython-312.pyc",
          "bytes": 20027,
          "sha256": "0031005ec4b21446e063bc79b73ccedf9cd7d403d6aab67b424b4db1b8b79c0f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/logging.cpython-312.pyc",
          "bytes": 14108,
          "sha256": "6b34928642a82eb81bc4d455bec8cefbe27439e4a1937b8830681736bcf57745"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/markup.cpython-312.pyc",
          "bytes": 9601,
          "sha256": "2d176f21763dc89821b4b9c62e5b5ac8b5b9f962396e60631bddde9fb60f085b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/measure.cpython-312.pyc",
          "bytes": 6412,
          "sha256": "b25b79f36ee5ca8bb2ead72ce325eb616036765cdbe74879d63eec15e942c2fa"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/padding.cpython-312.pyc",
          "bytes": 6967,
          "sha256": "37cbf88f150b72896a57203f9b0bd6840c68337fdf3ccc51693896aab998b312"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/pager.cpython-312.pyc",
          "bytes": 1845,
          "sha256": "800eb9557c3fc5392a9d6abd67613a215d0d61204ed5de6ed6bf8ed2e1f66ad7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/palette.cpython-312.pyc",
          "bytes": 5331,
          "sha256": "0b45638cc252a10e570731976c9d9ef5736c0f244ed0e142dba6b9254166b82f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/panel.cpython-312.pyc",
          "bytes": 12758,
          "sha256": "ba868952e26de7156e8907fd35e1df932ab05cae907338ca21586d018ab0b916"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/pretty.cpython-312.pyc",
          "bytes": 40645,
          "sha256": "542ff2e44045c0d5991ad4c9df1b6b76d01ecfcf84f0ecb5b8b8fa94d978546a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/progress_bar.cpython-312.pyc",
          "bytes": 10411,
          "sha256": "33aaacada5a4aacff6bf6209a97b208d94457065701caf4828d0452c39202e21"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/progress.cpython-312.pyc",
          "bytes": 74973,
          "sha256": "8542119f58321d23fb4ca819dd072d673eef257c5dbc38adb64a888feac0cb9f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/protocol.cpython-312.pyc",
          "bytes": 1826,
          "sha256": "2c35012baffb5f8626393f66012f955fb178d7d6df0ad9369ee0c7db0f6f3137"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/region.cpython-312.pyc",
          "bytes": 601,
          "sha256": "f0a1dddd2f6bec1288016cda95ff304089b36471ffd834583b7ce25220b2018f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/repr.cpython-312.pyc",
          "bytes": 6647,
          "sha256": "dea9e1a1166301590f263af70b8cabd201441c5de3edc3ba46c870ac3e0cd456"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/scope.cpython-312.pyc",
          "bytes": 3859,
          "sha256": "8427052e5dc4d852b02111aaa47037d8cff70b5603cc06335b19e41c51c61b92"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/screen.cpython-312.pyc",
          "bytes": 2513,
          "sha256": "c246d22c5f92131a57aabacb4fe9e0689312d392a5e28d3faaf1144f71bd11e3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/segment.cpython-312.pyc",
          "bytes": 28571,
          "sha256": "0b3ea547af224f16aad1440ea5b3015a755bd6655a2ee963da188fa717fe3142"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/spinner.cpython-312.pyc",
          "bytes": 5957,
          "sha256": "03e0cb3f8efd3bf49aa6d79bfb59709dcedff5389bae15afbcac251ddce18979"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/style.cpython-312.pyc",
          "bytes": 33451,
          "sha256": "543c4bb72b93b54422797741ae50443e934a370c36bc3618222eb685d1d360f8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/styled.cpython-312.pyc",
          "bytes": 2173,
          "sha256": "701ec103eb3e341a6e28895c1e445693f910010745f1006c1163abe464c68290"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/syntax.cpython-312.pyc",
          "bytes": 40997,
          "sha256": "384a40a21b788cf7b27852cb7acf33d09ab5791adacce0d12cb0af163980ed62"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/table.cpython-312.pyc",
          "bytes": 43871,
          "sha256": "c534740b76e85c9b1f5615f0fb33d8a4d8ef331b7efa3216c7689b82bfc4a31d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/terminal_theme.cpython-312.pyc",
          "bytes": 3382,
          "sha256": "b3318109319a80019130a6f1347866f0f629fae4fb2a5e05be1433c32370940c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/text.cpython-312.pyc",
          "bytes": 61244,
          "sha256": "ca0911002664316fbafcf1fa990346750527f145176a2afed2dd49185ec2e57b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/theme.cpython-312.pyc",
          "bytes": 6361,
          "sha256": "bace2a8412d09baf6ebfa34dafdd9d845cb1a637c4606301dbfcd1f74a29b49a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/themes.cpython-312.pyc",
          "bytes": 348,
          "sha256": "2beb21c9f4132f53a08795687903fc9271ea277c12cb7250f7f31f6a73150500"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/__pycache__/traceback.cpython-312.pyc",
          "bytes": 36207,
          "sha256": "56c91abd7b70662010dbe6bc9b148ec12039a97a30463377c1d9bacb16189571"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_cell_widths.py",
          "bytes": 10209,
          "sha256": "7db99ec9eb447478f313f571da5d6e2bbb673ce84cb365f59497cedefb0a0e90"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_emoji_codes.py",
          "bytes": 140235,
          "sha256": "86ed552fd9db55da6926b5688a356c85195c4517bfbf7763bb7326776b0a65d6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_emoji_replace.py",
          "bytes": 1064,
          "sha256": "9fe91c7adb04531d99526850adf78c35cfad79e1a1a6e490e45f153c1b32bc3a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_export_format.py",
          "bytes": 2128,
          "sha256": "448d3ca52ae6e6d052ccf32f9db4ea6c3f5621a95a3a837977833545398bab56"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_extension.py",
          "bytes": 265,
          "sha256": "5ede3b41a7022b062bbb38c38be80e06aef6e0945e0e3f429bdc548b97ebfb7e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_fileno.py",
          "bytes": 799,
          "sha256": "1d66713f90b66a331b1ebcaf01066c79f9557d0a06cec28e1f3286b0b0fcca74"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_inspect.py",
          "bytes": 9656,
          "sha256": "44e4f43cb0b618c5a26a559992a2488e662aec83518a34109284a89164da0222"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_log_render.py",
          "bytes": 3225,
          "sha256": "d41c88d0f035669c5963708624e2b9e218e5ab85fe073fdba088c8a8277c2a7b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_loop.py",
          "bytes": 1236,
          "sha256": "855ffa08b7683e6d2f6b6d96a70e332aa334458b33dd36715e3d0fa12fbd7834"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_null_file.py",
          "bytes": 1394,
          "sha256": "00318aa75cadfa4ef414c295ead9ea0aa79c07ead2273a7e590b03ecb3cbfa48"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_palettes.py",
          "bytes": 7063,
          "sha256": "71d7afd4940a67426f960b95f62a478339d3767be52335050c16f422dd8fce32"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_pick.py",
          "bytes": 423,
          "sha256": "7af0edf10378945e428b0ad421794e2429ed8ad0423ac23764b3c42005512c95"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_ratio.py",
          "bytes": 5325,
          "sha256": "20eb65efcb1009866c987cb185ee3992b91bebcbbdc55cfbcc5b175490fe6f66"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_spinners.py",
          "bytes": 19919,
          "sha256": "536af5fe0ff5cd28ec8e251d00449cda200c7378b8ae2fd2f0f60fea4439cf52"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_stack.py",
          "bytes": 351,
          "sha256": "f82f0e2bbaf19f7b0851d570c59041a5e1e12335f4788f9533731e9987da5e6d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_timer.py",
          "bytes": 417,
          "sha256": "cde9716d3ea83c566736bc163e973592d51e013f957387ee15c4592d018bb4c2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_win32_console.py",
          "bytes": 22755,
          "sha256": "05268344833004b2139ff9b499344b3ea304e6afaab8675232e60ca587982707"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_windows_renderer.py",
          "bytes": 2783,
          "sha256": "b7be192f7c6e0c23f79e64e9f691f52f92e223671a909b9045095e1c225eae59"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_windows.py",
          "bytes": 1925,
          "sha256": "681c1a0ff4b9e926e0a2922f6b2566a64d18dbcbb06360b905a6f5c25dc1a7e2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/_wrap.py",
          "bytes": 3404,
          "sha256": "1654aca26e445f42d5900dca5b2df8c879c27cbb6a5fe6487a95ca87eef4ae97"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/abc.py",
          "bytes": 890,
          "sha256": "38df84f99a924a1799f3c56b297d8cdcf5e915b18451464f31afc07f497ee1fd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/align.py",
          "bytes": 10324,
          "sha256": "760fbbb98d2e90c2cb95412c04344bbdadb6fec4202090f804ad1d9991c51ee8"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/ansi.py",
          "bytes": 6921,
          "sha256": "02fb352c76d275cc8ebc339da442d952850b7018987b063be9e341a7ab85061b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/bar.py",
          "bytes": 3263,
          "sha256": "95d6d51cecca24e9df95536ebf5c52ee0e9d2d7d84df03275e474f6e9cc94dcb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/box.py",
          "bytes": 10686,
          "sha256": "9266af05cfdd9fbdcbfe0ffcbf1592c18243daecc15ce5054ed24e7e96dccdc3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/cells.py",
          "bytes": 5130,
          "sha256": "2ab4248f9f8b821082a492d23502320198e775ce1b9c4a8e1268b962e67d5026"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/color_triplet.py",
          "bytes": 1054,
          "sha256": "de585091d25bbd63e82c33be0276089805a626f579765818342559f7b39168de"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/color.py",
          "bytes": 18211,
          "sha256": "dc74942d50e3eea4245d47455afefc24e8926737f2e72d6791c6219dadbde95d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/columns.py",
          "bytes": 7131,
          "sha256": "1d45f429c326f5db0a362d757d36e233f876883b65f3248269573195a944ceaf"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/console.py",
          "bytes": 100849,
          "sha256": "b7d6b366999131553972985505949284db26071776f880167134e5868afe135b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/constrain.py",
          "bytes": 1288,
          "sha256": "d5520fb82f0082d296adc9dc42b8c1758a80dc9556cacbba8d9a35aeb87b73b4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/containers.py",
          "bytes": 5502,
          "sha256": "73fe7a4f171e74662a0dea4704c4ee65d5088a38ad010827a31f9075ed19d6aa"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/control.py",
          "bytes": 6487,
          "sha256": "1144d25052d06f163a666a3fb1d33ee4bb37db7bc81d305f37c4cfba5a9e1d46"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/default_styles.py",
          "bytes": 8257,
          "sha256": "921405aaa6a80ecddba6b32a5a91f0f273b95291b60cde90b6e4dde8bcd9c187"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/diagnose.py",
          "bytes": 1025,
          "sha256": "7c99754c8b519f5f601b0a2ea9383ef333d45b762a401a8696dadf3d0b351fdc"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/emoji.py",
          "bytes": 2367,
          "sha256": "59de1b42e6d9752cbaf8fcab45036e307b67d959258caf6e3d93d596ed9c9b1d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/errors.py",
          "bytes": 642,
          "sha256": "e693f729ce5de1027f734285b31adfca18e23d57bb275ccea9215b140cdc57e6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/file_proxy.py",
          "bytes": 1683,
          "sha256": "4e5f531cc0d9f8f9395a6f2c23580683f5390e1bac9b10fe159d1f51b714d16d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/filesize.py",
          "bytes": 2484,
          "sha256": "fe2cfd948a5182f5bb30d49e0999cb83e1f0cdb3f81844e0e78dd6a83f1216cd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/highlighter.py",
          "bytes": 9586,
          "sha256": "1bfb27fbc0ca8ccd6c1232c6fe8738a2f9169a25295af8fc6d78b4c9e7762e76"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/json.py",
          "bytes": 5031,
          "sha256": "bd512829d6b0a094630056b23f05e43013cbcbb4524ecf9fe38c124034769c9d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/jupyter.py",
          "bytes": 3252,
          "sha256": "432a0aa04ffc21d09baed8921e9f53b1348dc931d8d053b9c2113b8ce4ddf541"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/layout.py",
          "bytes": 14004,
          "sha256": "6a3912140b4456ff44153705b3ec38b997dfb7b9c45e13732fb655760ad3e6b2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/LICENSE",
          "bytes": 1056,
          "sha256": "deed7c17a4318158190a3ea239cc879a5a50271cebb98ae7025f48fbe58dca15"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/live_render.py",
          "bytes": 3521,
          "sha256": "22dff7f58773ac19bca372cbd24686a2b3c583e05f65601cac18cb8c5a246f1e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/live.py",
          "bytes": 15180,
          "sha256": "b45dee90000967f37665b19c96a67e8b02e822867c7f41c7533efd8c0c89aa3f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/logging.py",
          "bytes": 12468,
          "sha256": "e4a68f3d230ff45c5c5cf05c28ce1c19dff35bbf0f3207fe61b3159ef7d2c34a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/markup.py",
          "bytes": 8451,
          "sha256": "ddeb8628fe6ce353424306928d39c9c6eb398993078f1a483345ba7c2c6b6b7f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/measure.py",
          "bytes": 5305,
          "sha256": "1e6ac8257f2c5914c76e087c33111acbff37564a8d5bfef4b3c68a3f965c608f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/padding.py",
          "bytes": 4908,
          "sha256": "295108ded3b0a3db202b560d4ae1fffccd7f8d45a62d9c11555fca98eb55cf23"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/pager.py",
          "bytes": 828,
          "sha256": "48efc44c114a6e0de7fc080ecd79b8d52bf7e98c57032237fd1f8a398dbfb927"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/palette.py",
          "bytes": 3396,
          "sha256": "9489ef4753830d3d9fdd464c7cbd60aeaedd63fa4374a1f0e1b75480e19a3386"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/panel.py",
          "bytes": 11157,
          "sha256": "f6c425d3484f22a1f91b68002d0a3835ea45c293f493dc13facfe03a6b39a487"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/pretty.py",
          "bytes": 36391,
          "sha256": "832dd2ef6bb8151836cada28ecdd590d60c8bc1e2e9dbcdde625067609bef1f7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/progress_bar.py",
          "bytes": 8162,
          "sha256": "9994cfa4953071f71d8100934f3de4c98f9f73bf5d74bc2dc7a1a18717e8d3ae"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/progress.py",
          "bytes": 60408,
          "sha256": "09473696453e5f9f6655d19f8cc0819197a218f2f7bb174e36384d245d93ef06"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/prompt.py",
          "bytes": 12447,
          "sha256": "974461414fb45154d5f5ed3cc56d416c88f426ad885f20a15f8942d2514dcede"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/protocol.py",
          "bytes": 1391,
          "sha256": "e611c70c3347724764f22587e7311b8becee215485e616d4da3228e3b47b9531"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/region.py",
          "bytes": 166,
          "sha256": "acd4fdc59ad56536085d90b43589f8d42250c1835b47e29e70f3b14e042f07c6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/repr.py",
          "bytes": 4431,
          "sha256": "e4c64966638d802ea4b9df905befe6d68917c0bd9a47abbacbea54714089cf6f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/rule.py",
          "bytes": 4602,
          "sha256": "d1f35a4bf68445add43117374f958ca4dfecba6b43c5f6a8af6cb7a1fd5fb419"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/scope.py",
          "bytes": 2843,
          "sha256": "4cc514f2aa35eed872a9008faa30cb62983f514d64e6a55df96c2226f9c955ab"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/screen.py",
          "bytes": 1591,
          "sha256": "628791784494871ef882ba9bd264926fd960861cac5a6147621b1b3154235cef"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/segment.py",
          "bytes": 24743,
          "sha256": "a2d9ca78a18457e591950568b1f2557850dc0f100a1e9bc9fe12f34aee65ba63"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/spinner.py",
          "bytes": 4214,
          "sha256": "a27221a4a9658d11e9a5365ab313bc91782d632087524a5280a825449de8e758"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/status.py",
          "bytes": 4424,
          "sha256": "9243e987761e019068f97fb8c0fa7c813a99c94e3ae8d2f06410383d94d37b0a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/style.py",
          "bytes": 26990,
          "sha256": "5bd09ccbc3f2f253480ad95f729fabcb3313b90686c405376afefe8397c7bb4b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/styled.py",
          "bytes": 1258,
          "sha256": "799367cc6ac8e248bfe78a606373a3d13fb1de5c5d5d3621e3faf20c1db8c015"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/syntax.py",
          "bytes": 36371,
          "sha256": "78328847097ef9e6742f0a3675ad9146d7eeb5719abeb24eeb50a5e4e912e7d5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/table.py",
          "bytes": 40049,
          "sha256": "6664fb57b30c08e60ac3b4c663d4992f26037fa25d33e5957f4ec5755b958532"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/terminal_theme.py",
          "bytes": 3370,
          "sha256": "d63e7eb9f25f9ef940a3942c8bf0026625c39b0317cea826141c8e6d3f7ec896"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/text.py",
          "bytes": 47552,
          "sha256": "00eec93c2cfafa068dd6d8552d73019ed1260cf55816014d1b5a0ceb5fec6a75"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/theme.py",
          "bytes": 3771,
          "sha256": "a0dca15e119a82d0e56c3c9eded56eddeb16396934bcd92ec45c3efee9e568ad"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/themes.py",
          "bytes": 102,
          "sha256": "d318132e8cdf69b79b62d709b43742e50917e4855411abe2a83509261e185459"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/traceback.py",
          "bytes": 35861,
          "sha256": "7345a607f2f4e3f51f65b2daa07f7cdbf53fb3b7a8b3128c5220159833dd4585"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/rich/tree.py",
          "bytes": 9451,
          "sha256": "c969d0eab02f446277a991aa06bc52d925b64ca05336b3f449d63c4313853eec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli_w/__init__.py",
          "bytes": 169,
          "sha256": "d05f320ed5f1dd4ba7866f3be0aac070fefab2bb0cf7ccbb5b21d0c02ba565ba"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli_w/_writer.py",
          "bytes": 6961,
          "sha256": "76c89f152db161fd62efa9a64727f3f72d76e710bb67f1d0f38e592a126c617b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli_w/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli_w/py.typed",
          "bytes": 26,
          "sha256": "f0f8f2675695a10a5156fb7bd66bafbaae6a13e8d315990af862c792175e6e67"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli/__init__.py",
          "bytes": 314,
          "sha256": "9eb042d7c0db5d14c2168ec4946e410de5a91c9cce86892f5e4db5e4633c6762"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli/_parser.py",
          "bytes": 26440,
          "sha256": "a412234c86bf710b361e0943276961f0e25fa6d7c36ba7a0e7eec87a3e018c7b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli/_re.py",
          "bytes": 3396,
          "sha256": "a12359fe294523a72112e434d58452a14c9d050affa2417f9927474e4166bfdd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli/_types.py",
          "bytes": 254,
          "sha256": "f864c6d9552a929c7032ace654ee05ef26ca75d21b027b801d77e65907138b74"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli/LICENSE",
          "bytes": 1072,
          "sha256": "b80816b0d530b8accb4c2211783790984a6e3b61922c2b5ee92f3372ab2742fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/tomli/py.typed",
          "bytes": 26,
          "sha256": "f0f8f2675695a10a5156fb7bd66bafbaae6a13e8d315990af862c792175e6e67"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/__init__.py",
          "bytes": 1320,
          "sha256": "06eee4aa49a9ba784bb23e710aef204ffdb992da0f5dc4a7c1ef151e4d46989a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1486,
          "sha256": "10725752b6dc516974886c39ebaed7a0beceade788013192ca13bb127d5f8a60"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/__pycache__/_api.cpython-312.pyc",
          "bytes": 17566,
          "sha256": "b7156177f3decdf7150d294ce89e97432fc4baed6aa7ebab29aa08e6ab9c0dbb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/__pycache__/_macos.cpython-312.pyc",
          "bytes": 19021,
          "sha256": "8dde0358c526b97366bcac9f02f0425888c29433744794abd37c23bffbb77c9f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/__pycache__/_ssl_constants.cpython-312.pyc",
          "bytes": 1133,
          "sha256": "e41b3a86fc3cbc14bf618ce312358ce8be8e7bc1e495c4191a2d7a053ff95aec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/_api.py",
          "bytes": 11413,
          "sha256": "0982425790537edb5961fa98de6a2f74c044fbc6b3eee8444ff2d86ca4f6367e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/_macos.py",
          "bytes": 20503,
          "sha256": "9d994b90e9accd413483aaf2470055198e423b33f2b9d72c889b4359aacce4b4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/_openssl.py",
          "bytes": 2412,
          "sha256": "cc1f9242f272764b3bb50d32230acfe860f77d035249a3e2abbcf0e321794f8d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/_ssl_constants.py",
          "bytes": 1130,
          "sha256": "3540f87d529d483d36ae2efe75bd2d9ced15a8b3fd687bb3992b5c5bbb40974f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/_windows.py",
          "bytes": 17993,
          "sha256": "ac01f22980fc33bb7e6d77c6f1580e55add3a5f85585bb78ad94253b8e58b8ff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/LICENSE",
          "bytes": 1086,
          "sha256": "33be7b7e8fa4fd19b1760e1a8ed8a668bdab852c91b692dd41424bcb725a9fca"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/truststore/py.typed",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__init__.py",
          "bytes": 6979,
          "sha256": "24ca35b60d67215d40789daf10d0bf4f17e5d1ee61e86ce5f43195935ad645ba"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/__init__.cpython-312.pyc",
          "bytes": 7349,
          "sha256": "9df50f9f15c270c6c6027874d6a73688283e5164346df28a2d03e2a19367b1b3"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/_base_connection.cpython-312.pyc",
          "bytes": 6911,
          "sha256": "be72213227efba14557256fe5599a133cf29cbc2f08c80c2a00a0295c8783451"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/_collections.cpython-312.pyc",
          "bytes": 22770,
          "sha256": "52c5195ad55c5622aec7fe1fcc8d01bfd0cbe4d0ceff740b4107e2e9bed462d9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/_request_methods.cpython-312.pyc",
          "bytes": 10641,
          "sha256": "4cc5f29a110e214cbd6132db6eedfc5ed7eedf6326e553e70ec156ca5f949f04"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/_version.cpython-312.pyc",
          "bytes": 678,
          "sha256": "73902c4139bbffaa72a316e4d76bb3e60f44c45b6f465bfc3a31d7e88e9d0215"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/connection.cpython-312.pyc",
          "bytes": 38931,
          "sha256": "33e17c402c8e8663d69b555c1a47dba2d039d6835443e989a7ab85abd29c6410"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/connectionpool.cpython-312.pyc",
          "bytes": 40133,
          "sha256": "c1032527e3f3648b198bfdaaeea8025d8f09d4b1ab5bd49a36f5cda3f2f550f2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/exceptions.cpython-312.pyc",
          "bytes": 16643,
          "sha256": "d8d326c2b09b9c4949537a9bffbef331313ac7b6c39c5577c478a39e35dc4a5d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/fields.cpython-312.pyc",
          "bytes": 12032,
          "sha256": "3fd9c647bc4711d3da58016584ca5ed0a8f219d8bab591d86e41ce692cc09238"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/filepost.cpython-312.pyc",
          "bytes": 3518,
          "sha256": "a65ce2644194c0a80b4762625ed573df91df3fa598f62775f27fa35bd648d018"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/poolmanager.cpython-312.pyc",
          "bytes": 24454,
          "sha256": "1879e597d6d6ecb0b74eb05860ad6b4d39b237b9b609813877bb0e0ceb7b90d6"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/__pycache__/response.cpython-312.pyc",
          "bytes": 57546,
          "sha256": "50450aac2bed64f17576edb3f44463e2b997758b44d2c0402ce1373a309aec73"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/_base_connection.py",
          "bytes": 5580,
          "sha256": "1f37121077b1803ad152beb48cd9e20762908ddc3ded279d0f996e45f1ed0978"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/_collections.py",
          "bytes": 17522,
          "sha256": "68e566da62a296fbaf4f579f006b6403ba62eb90b5342dc725fa45c6f6014bc0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/_request_methods.py",
          "bytes": 9931,
          "sha256": "802785f3948efd45385a83f0607228cffb70f9e33f1153a42c5a7c385b02ec30"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/_version.py",
          "bytes": 520,
          "sha256": "fa032b2a1b0f88e8f45f351ecd515ae7d7754ba4204222a0413e601a0c8cf3ec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/connection.py",
          "bytes": 42786,
          "sha256": "668b37ab12835bdf8643a695a9f050551339b280742231f163fc575a925a1532"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/connectionpool.py",
          "bytes": 44164,
          "sha256": "b0616775d5d8c25c7b282e0908fd602af74d18b34af984c22437460021a3dd8f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 232,
          "sha256": "920dca2b53355921cc4ffa41257138d700ade7ecef66054ebc3d474348fc5cc1"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/__pycache__/socks.cpython-312.pyc",
          "bytes": 8210,
          "sha256": "c3bd9df8e19d2eb2d61b69a557c10e4962f57715c669a5e06aaac28cbf171bb9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/emscripten/__init__.py",
          "bytes": 870,
          "sha256": "66bb97696295cc010976a347dcd121d26ac7af0fbed956586f4cd7d11a273590"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/emscripten/connection.py",
          "bytes": 8960,
          "sha256": "822125b01a14b0a55445b6736fc182ac99aa5b6dd79ef8f668dc90545e36b258"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/emscripten/emscripten_fetch_worker.js",
          "bytes": 3677,
          "sha256": "cf5937cd9e3f84329ddfeb4def0cf3f0b1e31c2da9c4dfeebbc07793d0fd0377"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/emscripten/fetch.py",
          "bytes": 23520,
          "sha256": "e7171dfbebe217165dda7072d1a2bbdddb49f53b21d7261953f4945f09f089b9"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/emscripten/request.py",
          "bytes": 566,
          "sha256": "98bdbcb33cb52af137349856a2be633666aba7c830a650d4fbb8301996398344"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/emscripten/response.py",
          "bytes": 9719,
          "sha256": "083a58d0616896e47723110290cda01f9b837d80ccd042f5156afb07beb0b603"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/pyopenssl.py",
          "bytes": 19760,
          "sha256": "3e2feac2f765f37b4da6e8f5939a42a4ffe09b1964e017c5ad39407a0faa67f5"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/contrib/socks.py",
          "bytes": 7639,
          "sha256": "ad2ba495f85ae3ebeda3ef2a48b8523e67f996644f218baa740c4a7bd6e0d910"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/exceptions.py",
          "bytes": 9945,
          "sha256": "8503c7a2aa38cb0e3a7ac3525647225505d5520031580825b21e8c6f242d6be4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/fields.py",
          "bytes": 10801,
          "sha256": "6862c5015669554f856c996596f7b8021834fa91fd659050d88cfb95fa648e43"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/filepost.py",
          "bytes": 2388,
          "sha256": "53c78d67e9a928a1e1ae56c7104893c7180ad7a21e8e111aeeecf8db2a80fdd2"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/http2/__init__.py",
          "bytes": 1741,
          "sha256": "c73ac0487ed1e4035190f24ea2de651a70133aadca2aec97cc8e36adc9f09aab"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/http2/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1785,
          "sha256": "cd613352f8834cafdee3b561393ae7cfac59782114d1f53a0a97bea4b8255736"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/http2/__pycache__/probe.cpython-312.pyc",
          "bytes": 3696,
          "sha256": "754d8061243f6ad5de8f63ce3a83c463400f909b8776b58c82bd54cef8487561"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/http2/connection.py",
          "bytes": 12578,
          "sha256": "6c7307e9f36f6adc173eb2aaadc9fbe32037a5459ca8f0e9a672b52dc2826cff"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/http2/probe.py",
          "bytes": 3014,
          "sha256": "9e7024a9b8406a43a217be6bcfb5b4b9d677f047a1fee0fc7e357be0def71442"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/LICENSE.txt",
          "bytes": 1093,
          "sha256": "130e3a64d5fdd5d096a752694634a7d9df284469de86e5732100268041e3d686"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/poolmanager.py",
          "bytes": 23929,
          "sha256": "82b22b1131b5ae01d805a41abb5c8de31c5f2bc53d08a551626c015d6fe4752a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/py.typed",
          "bytes": 93,
          "sha256": "51a0ae3c56b71fc5006a46edfb91bc48f69c95d4ce1af26fd7ca4f8d42798036"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/response.py",
          "bytes": 53031,
          "sha256": "0f304cf9dce5eb1fe1d8464673d8b0d206ce910dfa6e8942ed61121f84eeac7f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__init__.py",
          "bytes": 1001,
          "sha256": "faa792d1071e8af6b3bc110a0cd142008fba00271d0ce1384ccbe8ed22cd9404"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1045,
          "sha256": "80b821804f9cd9f7efdf356c7bc2c7357bb6ed9f71b14240474f1fe05fed81dc"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/connection.cpython-312.pyc",
          "bytes": 4726,
          "sha256": "3388cf690612062ca67a7bc22b63d7567dd36845312ceb32190b864a37f09d0a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/proxy.cpython-312.pyc",
          "bytes": 1257,
          "sha256": "1faa12d3c5f630061dcb5b1ba1ec76530d40c5333bf64abf19641901a66bf8ac"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/request.cpython-312.pyc",
          "bytes": 8173,
          "sha256": "10bb960558d7a3b09579d3b7cdbe05ad79d3643ea32cbca39191aa92e9b9c0cd"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/response.cpython-312.pyc",
          "bytes": 2916,
          "sha256": "9b8cc56065ee9bffe00a65cf99a0e6a097181a89937f8bd7f462d27ccc526bc4"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/retry.cpython-312.pyc",
          "bytes": 21220,
          "sha256": "343959560c5faa3ab13ab2e105bca8b9462469aff1ee0e85316b8720ebee6b88"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/ssl_.cpython-312.pyc",
          "bytes": 15698,
          "sha256": "cecbbcc7f2cb674b5d8fe180b5ba5c4eb35fbc299e82b0d6bbee422e4563417f"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/ssl_match_hostname.cpython-312.pyc",
          "bytes": 5434,
          "sha256": "cc5421228928db797141a697e01fd8ec61cc841762b5bef4c1c4cd055beb440c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/ssltransport.cpython-312.pyc",
          "bytes": 13345,
          "sha256": "a5a6ba5f8a65d8c57da8b8e7c362f24dcd56c5499fb82f2fa9471f344fc7b37e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/timeout.cpython-312.pyc",
          "bytes": 11746,
          "sha256": "46f235b4ab4fcef9aba87e44eb686d9cc4b8d8ca3f267b6c5843d8fa0cae9be7"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/url.cpython-312.pyc",
          "bytes": 16318,
          "sha256": "53dea2bbcbe1efa0f295064e99f216941c127408bc42268acc3b7bfbcd9a596a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/util.cpython-312.pyc",
          "bytes": 2034,
          "sha256": "551c32d2adbdc09182d146a7fb35c6224151c0e92c06ee44bb3aa969f038db9a"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/__pycache__/wait.cpython-312.pyc",
          "bytes": 3480,
          "sha256": "02543c29914b80e7e68f177c7ec9bb2d2f574f716e5dc960f44ac709efbc28ec"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/connection.py",
          "bytes": 4444,
          "sha256": "2633bbdb69731e5ccb5cf4e4afd65605d86c7979cc5633126f50c92d5ad74a74"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/proxy.py",
          "bytes": 1148,
          "sha256": "b1e3fcf90e41e9b07474cb703e3f98719650df4bc7b8ba91bbeb48d096767f3b"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/request.py",
          "bytes": 8086,
          "sha256": "a7d2a2f5ea35b4504efa3a95ffb2a6989eb444aaa8636af86a8d1299a1cbc8eb"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/response.py",
          "bytes": 3374,
          "sha256": "bd013adfdba81218f5be98c4771bb994d22124249466477ba6a965508d0164e0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/retry.py",
          "bytes": 19577,
          "sha256": "d989d25fefc579c312843eb5331e6cebc274fdbb541d9aeb73f064155452d4fe"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/ssl_.py",
          "bytes": 17742,
          "sha256": "3aa7b7ac88545377b7195819a1bda1c6647c43464386b84448f94f3ff18b6954"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/ssl_match_hostname.py",
          "bytes": 5479,
          "sha256": "16de38289cd3cc632629f7ff6573fdd658b65785a19af132d7a3ca05cbf8bd99"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/ssltransport.py",
          "bytes": 8847,
          "sha256": "133e0ef2947fbd3f1d6a7fc5bea0584ba7600df05710c7d57ebcdc754a167e2e"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/timeout.py",
          "bytes": 10363,
          "sha256": "bec5094693b49df2a4fb2d4e2a5805198d4e34918f824699ec1ee4aee129558c"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/url.py",
          "bytes": 15256,
          "sha256": "3c40d0332a6276e75ed2701972d2cb8852bd7a937e2cf9d21fb2a938b2f0a87d"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/util.py",
          "bytes": 1146,
          "sha256": "8f795b64ad633f28b00f7e13f08809cdd5846554fee04fb4bd82098bd52378d0"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/urllib3/util/wait.py",
          "bytes": 4423,
          "sha256": "fe987c22b511deca8faa2d0ea29420254947e30ce419e3390a2c80ed7186b662"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/_vendor/vendor.txt",
          "bytes": 317,
          "sha256": "3df0c9601bfa2e0dca23cc574a4f900a4d7fdad060ab203fab8354350ed93320"
        },
        {
          "path": "python/lib/python3.12/site-packages/pip/py.typed",
          "bytes": 286,
          "sha256": "10156fbcf4539ff788a73e5ee50ced48276b317ed0c1ded53fddd14a82256762"
        },
        {
          "path": "python/lib/python3.12/site-packages/README.txt",
          "bytes": 119,
          "sha256": "cba8fece8f62c36306ba27a128f124a257710e41fc619301ee97be93586917cb"
        },
        {
          "path": "python/lib/python3.12/site.py",
          "bytes": 23198,
          "sha256": "b39ab288cc7a6d0cb3bb2655179221411340b22418e4efdee4c20175537a5fa2"
        },
        {
          "path": "python/lib/python3.12/smtplib.py",
          "bytes": 43532,
          "sha256": "f19369e751e199f5dfc05882e2f77b6a692719cebd8a18c84552544a0b93e963",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/sndhdr.py",
          "bytes": 7448,
          "sha256": "d1cb49f6545ef831a69322275ef26f6ca6964953e70d81a8a80fcca8d600ffc0"
        },
        {
          "path": "python/lib/python3.12/socket.py",
          "bytes": 37815,
          "sha256": "7d4d4c66e6f4bcc961ab462c4f08002ca97def8713a4be1c7373bdbd970a5274"
        },
        {
          "path": "python/lib/python3.12/socketserver.py",
          "bytes": 28065,
          "sha256": "ecbbe1a633801460399a8f10b39007aa0e13cdbdad507e39414000f097b769b5"
        },
        {
          "path": "python/lib/python3.12/sqlite3/__init__.py",
          "bytes": 2501,
          "sha256": "f7cc982617b68e147540ef352d38310fe4d25c2c9c2542b67d0590c871df09a8"
        },
        {
          "path": "python/lib/python3.12/sqlite3/__main__.py",
          "bytes": 3855,
          "sha256": "495a939623e825a487cde07b62a68aeefdbb1704b53a8b5388af070dc3fac690"
        },
        {
          "path": "python/lib/python3.12/sqlite3/__pycache__/__init__.cpython-312.pyc",
          "bytes": 1906,
          "sha256": "4310157e195cf615d9adf098b7ade59c4be848519241f0413c8d7b5fb5e52cf8"
        },
        {
          "path": "python/lib/python3.12/sqlite3/__pycache__/dbapi2.cpython-312.pyc",
          "bytes": 5130,
          "sha256": "d675e9de0e8f43391896c3f90dcfd78a12fa251e78b0b87646413627a72e4a23"
        },
        {
          "path": "python/lib/python3.12/sqlite3/dbapi2.py",
          "bytes": 3631,
          "sha256": "7c5c8d98df1f2c50c4062a3be2c0f0499190c179fa4fc281507a1ef763a98f28"
        },
        {
          "path": "python/lib/python3.12/sqlite3/dump.py",
          "bytes": 3538,
          "sha256": "bbd9b9d14affcb013f8bd996e30e2cfd1b214d40a37916b9a67fce5b11820eff"
        },
        {
          "path": "python/lib/python3.12/sre_compile.py",
          "bytes": 231,
          "sha256": "f7fd87f8ac9dad7d1387e2401761ec05806c5108201a6d1ede6ab2f481f6df54"
        },
        {
          "path": "python/lib/python3.12/sre_constants.py",
          "bytes": 232,
          "sha256": "87013dc0b349c2c044100f70a8daa9d713e60a527e26f6ab8ee1fc978a6d3234"
        },
        {
          "path": "python/lib/python3.12/sre_parse.py",
          "bytes": 229,
          "sha256": "c4929134532306081918f185c99305c6f55213bc16b32f8c259bc60f7f81e810"
        },
        {
          "path": "python/lib/python3.12/ssl.py",
          "bytes": 51655,
          "sha256": "db62eeaae59c6e7087dcafb28087cd0bb092087381edc556f97c8cb614484380"
        },
        {
          "path": "python/lib/python3.12/stat.py",
          "bytes": 5485,
          "sha256": "052af0327eae6941b69b05c088b3e748f79995635f80ac4cc7125eb333eb4c77"
        },
        {
          "path": "python/lib/python3.12/statistics.py",
          "bytes": 50227,
          "sha256": "5845851a5833a1436bfdfd19001f7cd6b4d95a438b76c47162897106d29449c6"
        },
        {
          "path": "python/lib/python3.12/string.py",
          "bytes": 11786,
          "sha256": "24aeae1f0526250f442022022bf98df9a823b1cb330543ee79e70e44907462e9"
        },
        {
          "path": "python/lib/python3.12/stringprep.py",
          "bytes": 12917,
          "sha256": "60b6c83581093029312efb6670b11c540090b3f78bcf72264467b494f02f21a5"
        },
        {
          "path": "python/lib/python3.12/struct.py",
          "bytes": 257,
          "sha256": "9c231f9497caf513a22dee8f790b07f969b0e45854a0bdd6dd84b492e08c2856"
        },
        {
          "path": "python/lib/python3.12/subprocess.py",
          "bytes": 88747,
          "sha256": "85d29b2bf0249f5436838298c9a60ee93508b1102e9ac43b001f8a7e7ae8f375"
        },
        {
          "path": "python/lib/python3.12/sunau.py",
          "bytes": 18478,
          "sha256": "7e4f850f6460bcd302439d6d2a9fc1bfc31f88f87ad86c508489f5612b346b7a"
        },
        {
          "path": "python/lib/python3.12/symtable.py",
          "bytes": 12477,
          "sha256": "3858ba5f1bd23175cf36a4b774c4e3d937d7cf15181fe49085b7a2f1cac76af8"
        },
        {
          "path": "python/lib/python3.12/sysconfig.py",
          "bytes": 31850,
          "sha256": "ce56212ba89be181fb90fe62496e6d2e436befaf2dffd10e87ce37d1685271a8"
        },
        {
          "path": "python/lib/python3.12/tabnanny.py",
          "bytes": 11532,
          "sha256": "5dae83b384db40d6ebadc7af0cbb8396343e8ab289ce30de784a4cb41d5fbdab",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/tarfile.py",
          "bytes": 114124,
          "sha256": "41a9f1930e5285455b4b0db2b9394247cce312c3fa1ef586a58e66c0100668d5",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/telnetlib.py",
          "bytes": 23334,
          "sha256": "9b0e127e2d0853cc90a596a7b26a2df4ee49dc66c44ac30372aae64d015fd0f9"
        },
        {
          "path": "python/lib/python3.12/tempfile.py",
          "bytes": 32386,
          "sha256": "2eea4401f4f29d0d3647ed6fc8bcf6aa1daf879c8aa407a8ea310edac9dfc317"
        },
        {
          "path": "python/lib/python3.12/textwrap.py",
          "bytes": 19718,
          "sha256": "62867e40cdea6669b361f72af4d7daf0359f207c92cbeddfc7c7506397c1f31c"
        },
        {
          "path": "python/lib/python3.12/this.py",
          "bytes": 1003,
          "sha256": "481d0cb3de511eae0b5713dad18542b07eafd9c013bb7690f7497bad49923a71"
        },
        {
          "path": "python/lib/python3.12/threading.py",
          "bytes": 60200,
          "sha256": "846f450ae794e4aab823a163f8c71d27751148af33e91dd3de886686a4e8ebfb"
        },
        {
          "path": "python/lib/python3.12/timeit.py",
          "bytes": 13464,
          "sha256": "d47d9deb6be0136d817e04d0e4824aa66c66efa01fe61cf62860fff08ecfe83a",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/tkinter/__init__.py",
          "bytes": 173168,
          "sha256": "4648028778a32184f92ba0912b64d26f3aaf583644a12326f6081125bc20164d"
        },
        {
          "path": "python/lib/python3.12/tkinter/__main__.py",
          "bytes": 148,
          "sha256": "9738a6cb9cdd8139721dd82118bd527897db5325d807222883f70fb1c5a1c27e"
        },
        {
          "path": "python/lib/python3.12/tkinter/colorchooser.py",
          "bytes": 2660,
          "sha256": "1224241dcfb4ec6aff3cafc66adeb2b2a3759397a28693173915458c50040143"
        },
        {
          "path": "python/lib/python3.12/tkinter/commondialog.py",
          "bytes": 1289,
          "sha256": "e683ab0ee9404baec656a88d637910bcb2badb4b4e5d5def2b80cc4534551e6f"
        },
        {
          "path": "python/lib/python3.12/tkinter/constants.py",
          "bytes": 1493,
          "sha256": "c01314dc51d1c8effeba2528720a65da133596d4143200c68595c02067bf1da2"
        },
        {
          "path": "python/lib/python3.12/tkinter/dialog.py",
          "bytes": 1535,
          "sha256": "4f8201d3ada7b6d0f450b417e55747adaee5f894412c4875169b0736a5ff0faa"
        },
        {
          "path": "python/lib/python3.12/tkinter/dnd.py",
          "bytes": 11644,
          "sha256": "542b804b243b502b5525a8b1f04a02a120b1db4e3599f5c7865e60693ed3672a"
        },
        {
          "path": "python/lib/python3.12/tkinter/filedialog.py",
          "bytes": 14939,
          "sha256": "d75c1eb4131db658b8622acffd8262ecbd7337425c799ea3be8d605ea6be7b94"
        },
        {
          "path": "python/lib/python3.12/tkinter/font.py",
          "bytes": 7000,
          "sha256": "a73482badacc4a69ff7fae9445793a4d858212fdef103360a478bbfd6ed2f496"
        },
        {
          "path": "python/lib/python3.12/tkinter/messagebox.py",
          "bytes": 3861,
          "sha256": "cdbf655c66778a19f0e25754a5f198a850c8bd958ce651e8fe4b2b52ad7f9c63"
        },
        {
          "path": "python/lib/python3.12/tkinter/scrolledtext.py",
          "bytes": 1816,
          "sha256": "c7cc050ec9cc3cc6a47215b5bc79b2d3e5c6ed895a4300ab0e20f6c249385e3f"
        },
        {
          "path": "python/lib/python3.12/tkinter/simpledialog.py",
          "bytes": 11753,
          "sha256": "984eb0bb02ebdf76da3cadde9f54587204f819723346a576176410b86141d15b"
        },
        {
          "path": "python/lib/python3.12/tkinter/tix.py",
          "bytes": 77032,
          "sha256": "5d7a11093a1f6510de786b0e9d67902ab33a57f637cd8f5e2603cf6c5c609a18"
        },
        {
          "path": "python/lib/python3.12/tkinter/ttk.py",
          "bytes": 56318,
          "sha256": "6c13af04d672c71abc82181961a7f7bce7b9ea79becdae37f55c78001053ce87"
        },
        {
          "path": "python/lib/python3.12/token.py",
          "bytes": 2511,
          "sha256": "1a4d994ce9744f4bfe2d964fc24d112a1e76796a08c2e45a2d73c82a8587f922"
        },
        {
          "path": "python/lib/python3.12/tokenize.py",
          "bytes": 21570,
          "sha256": "026f566ac63e60d69c8185a3880831b657accc5eac984fadf271fc99a5e5825d"
        },
        {
          "path": "python/lib/python3.12/tomllib/__init__.py",
          "bytes": 308,
          "sha256": "71f67036895f4c5acab942618af0cbd3d814451ba61e967f358d0f341a5b8f51"
        },
        {
          "path": "python/lib/python3.12/tomllib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 365,
          "sha256": "eaee391728833753ba6bfbe5bf0d8a7900632cd9b009690e0e388c2f455e761d"
        },
        {
          "path": "python/lib/python3.12/tomllib/__pycache__/_parser.cpython-312.pyc",
          "bytes": 27193,
          "sha256": "5cd12f5d77305421f345dd87d0dc3896ef4a59e69ad622cd573848db23995631"
        },
        {
          "path": "python/lib/python3.12/tomllib/__pycache__/_re.cpython-312.pyc",
          "bytes": 3918,
          "sha256": "e6def8b3e1acfd5aa1687f3428d44727700fec20115243486dae9f9f5b0b8b77"
        },
        {
          "path": "python/lib/python3.12/tomllib/__pycache__/_types.cpython-312.pyc",
          "bytes": 376,
          "sha256": "4a919e394ddabd34027b1a1f15e0bb9938602534c2634034b59ea2db531f079a"
        },
        {
          "path": "python/lib/python3.12/tomllib/_parser.py",
          "bytes": 23117,
          "sha256": "559366e5c672449a271a6553675c5d1f699b6a3730f6c14c4e4955b184f29d86"
        },
        {
          "path": "python/lib/python3.12/tomllib/_re.py",
          "bytes": 2943,
          "sha256": "75b8e0e428594f6dca6bdcfd0c73977ddb52a4fc147dd80c5e78fc34ea25cbec"
        },
        {
          "path": "python/lib/python3.12/tomllib/_types.py",
          "bytes": 254,
          "sha256": "f864c6d9552a929c7032ace654ee05ef26ca75d21b027b801d77e65907138b74"
        },
        {
          "path": "python/lib/python3.12/trace.py",
          "bytes": 29352,
          "sha256": "cbed87376cb326ad5c02e6152597d16f4229e96ddb2d8299bfb403ba4d804ba5",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/traceback.py",
          "bytes": 46393,
          "sha256": "2c44af2848836d9af0c7b3547469695cd22586c64274d362eafcf466af284bd6"
        },
        {
          "path": "python/lib/python3.12/tracemalloc.py",
          "bytes": 18047,
          "sha256": "c2cc84a05b824df79840c98729a0e94ef8909b11c528a1b2c5a00aa436b97b25"
        },
        {
          "path": "python/lib/python3.12/tty.py",
          "bytes": 2035,
          "sha256": "1ab5e5e047130b310355e907a3306178299b9f2044fb526ac63bd116e9a16d2b"
        },
        {
          "path": "python/lib/python3.12/turtle.py",
          "bytes": 146363,
          "sha256": "5e0e21a736c0d20fc49df5f08a69f544e54efa5d9516e1b73d3bfb50da1c6323"
        },
        {
          "path": "python/lib/python3.12/turtledemo/__init__.py",
          "bytes": 314,
          "sha256": "5f465277c96c107a5af544b0a962561f97cb0bfd75906d9bf9741450ed02b0e1"
        },
        {
          "path": "python/lib/python3.12/turtledemo/__main__.py",
          "bytes": 15384,
          "sha256": "03594b9dc866cbf17c36c4b133c64975295a3bc4f242187af3ea8ea0c75b1095",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/bytedesign.py",
          "bytes": 4248,
          "sha256": "6deeee99e0ddb4ed29a648f95d4d33e9f3292c21dbecec301337c22a605a280f",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/chaos.py",
          "bytes": 951,
          "sha256": "bc8a3a9b77e90446fb7060ff68ee008ffd6b23b366052207ec225cc163b4dae5"
        },
        {
          "path": "python/lib/python3.12/turtledemo/clock.py",
          "bytes": 3304,
          "sha256": "70e6033c112f699da2b54a56f9366f31466c95af9ca3607e6b94b87eb76ee3c5",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/colormixer.py",
          "bytes": 1339,
          "sha256": "bbb065830edb37fd53b1c004118853176fd8da32ee532cb0d363960880920374"
        },
        {
          "path": "python/lib/python3.12/turtledemo/forest.py",
          "bytes": 2966,
          "sha256": "68cd81b7da35ca49d9066cc2cba24768cddbf90797dbd619a559cf899cde926b",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/fractalcurves.py",
          "bytes": 3473,
          "sha256": "29fadf34c5eabda4649848d052fa2ed3ae829e55bc3ac5933f2aedf3fb04b320",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/lindenmayer.py",
          "bytes": 2434,
          "sha256": "4b597f52c1cb35ae8ed540d1db2dab52276c7874febd7a659ee50f26be26f61e",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/minimal_hanoi.py",
          "bytes": 2051,
          "sha256": "0e458a6257fb5a4ecd2785962850fa87924b23d4ead8aebb70aab38904ff8ef5",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/nim.py",
          "bytes": 6513,
          "sha256": "939d1ee904a7b00579bb44719b0286e7524bf560c7ffff6d482064b41b09fdb3"
        },
        {
          "path": "python/lib/python3.12/turtledemo/paint.py",
          "bytes": 1291,
          "sha256": "81aa22d0da1d934cb47edfef1883f9fe8ef864c56d484f79f9ec4b46457d047e",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/peace.py",
          "bytes": 1066,
          "sha256": "b260b857164684b3065ad760fec0245ab6505c220814fb179a3d080f2bba0814",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/penrose.py",
          "bytes": 3380,
          "sha256": "14aeb10db966bfd4ec923a19eb96892eb2aa2723c0962c0824fe2ca9f30e300a",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/planet_and_moon.py",
          "bytes": 2825,
          "sha256": "cd2c5344b67dbe781cf4c7f0f1eb1b97e6d8a5bf50329bdaa4e42e7d390ea609",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/rosette.py",
          "bytes": 1361,
          "sha256": "61dfd5bb932cc5a0c3bb9caa8ed74889a19a8d3ee3cb6707ea8f63595ec350b0"
        },
        {
          "path": "python/lib/python3.12/turtledemo/round_dance.py",
          "bytes": 1804,
          "sha256": "4ecaac02e68f11ec1a406a6ce8a4b17e4f8af74f76157e0776360d0dd041f276"
        },
        {
          "path": "python/lib/python3.12/turtledemo/sorting_animate.py",
          "bytes": 5053,
          "sha256": "7d38adf061cecaf08edfbe8ebc194937f7f070a35e19641a472778f6d3a10927",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/tree.py",
          "bytes": 1401,
          "sha256": "3318448046c83c176f95a97c33b5cd82e0076bee038d72810bef3dac1085e590",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/turtledemo/turtle.cfg",
          "bytes": 160,
          "sha256": "de66698dc4f083792df6aaed1e5d94e879852d72f1f24ac09c8fb4cd144c6c88"
        },
        {
          "path": "python/lib/python3.12/turtledemo/two_canvases.py",
          "bytes": 1119,
          "sha256": "3300593114fb9286af9360cc9d871a40e5dcbea4aedc24b832607d1dd71c7b96"
        },
        {
          "path": "python/lib/python3.12/turtledemo/yinyang.py",
          "bytes": 821,
          "sha256": "0737a80b939aafcf3d8a1bf60b63e781979c749337d02b6c216680893f9fffc5",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/types.py",
          "bytes": 10993,
          "sha256": "345474ef027a1273f353da9bdc1f7c18f65335e72e681bcc0376774cc51f2405"
        },
        {
          "path": "python/lib/python3.12/typing.py",
          "bytes": 118836,
          "sha256": "be92d60fb8382bb29ead21c128825d7c96d0e8c915b44f840791e49f5a8d554c"
        },
        {
          "path": "python/lib/python3.12/unittest/__init__.py",
          "bytes": 3487,
          "sha256": "32ed48385c0377bc2900a76e9a6acc3705aeef402c72de8554b3c637420506f0"
        },
        {
          "path": "python/lib/python3.12/unittest/__main__.py",
          "bytes": 472,
          "sha256": "ff6b9a100d32001715b40d61bc4d613623b139edb1fdc3566427b83c331caae3"
        },
        {
          "path": "python/lib/python3.12/unittest/_log.py",
          "bytes": 2746,
          "sha256": "905672317ab26c656c600defce25d477728068f597f00a7f94e22e8128c323b9"
        },
        {
          "path": "python/lib/python3.12/unittest/async_case.py",
          "bytes": 5483,
          "sha256": "c600343ffa27eac746001b2f35df2e4e2e52b90f14026dcfb4c43b25dfd7b261"
        },
        {
          "path": "python/lib/python3.12/unittest/case.py",
          "bytes": 57531,
          "sha256": "45bac6d80a4fc3a0dea8340a80681e30b263f017b4a5002cb8f489a632e0f987"
        },
        {
          "path": "python/lib/python3.12/unittest/loader.py",
          "bytes": 21116,
          "sha256": "7f0af414bfa7fe8612a424b14cfcf8a3c34fcac999d976461beb738ef8b211b8"
        },
        {
          "path": "python/lib/python3.12/unittest/main.py",
          "bytes": 11991,
          "sha256": "db58280574389c0d6cba9559cc51e1787f5b418c4e85d354aa55ca43335c487a"
        },
        {
          "path": "python/lib/python3.12/unittest/mock.py",
          "bytes": 106317,
          "sha256": "1de18141992c6742bff27e77c0cbe46d53d6a5ab1850574a536910508823fc5c"
        },
        {
          "path": "python/lib/python3.12/unittest/result.py",
          "bytes": 9130,
          "sha256": "5db286bdd3821d64150377e554d7edbdd58db7bb8b950772f977e9ec1d535617"
        },
        {
          "path": "python/lib/python3.12/unittest/runner.py",
          "bytes": 10368,
          "sha256": "76d9beb9c21d0d367a1b040a921ad43f90b7971fcc8cacfccd6f9760bedf1ce2"
        },
        {
          "path": "python/lib/python3.12/unittest/signals.py",
          "bytes": 2403,
          "sha256": "f8286e818ca56e10e03745bc056cdfd31147678f9a1dc8cb6b0fe96ef9a4362a"
        },
        {
          "path": "python/lib/python3.12/unittest/suite.py",
          "bytes": 13512,
          "sha256": "ed2da92bc9f97c53403ee2d3d12cc53b16a96e85d596ebc887b5a93458f3f6bc"
        },
        {
          "path": "python/lib/python3.12/unittest/util.py",
          "bytes": 5215,
          "sha256": "fdcc640c3505d16deab9c32eae7c3f5f67c3b5e81c563dc6698fa7fcf403854d"
        },
        {
          "path": "python/lib/python3.12/urllib/__init__.py",
          "bytes": 0,
          "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "path": "python/lib/python3.12/urllib/__pycache__/__init__.cpython-312.pyc",
          "bytes": 214,
          "sha256": "41ae57fb7b67bbe8963cf500f244aa58d910eb54cc050d979c1119df941f6842"
        },
        {
          "path": "python/lib/python3.12/urllib/__pycache__/error.cpython-312.pyc",
          "bytes": 3710,
          "sha256": "17ab62d2f98dcb49e666d23b8b6677351f050614d959065cb22463c3f490e7e6"
        },
        {
          "path": "python/lib/python3.12/urllib/__pycache__/parse.cpython-312.pyc",
          "bytes": 50692,
          "sha256": "5b02a12ebd4cd865f623190afa2ccba3c66b2bf4d4c9548dff4700c35bb642a9"
        },
        {
          "path": "python/lib/python3.12/urllib/__pycache__/request.cpython-312.pyc",
          "bytes": 115725,
          "sha256": "1ac16a960a90eda991047a832cec5367c30f8cb8ee921527a26c14b903f38ccd"
        },
        {
          "path": "python/lib/python3.12/urllib/__pycache__/response.cpython-312.pyc",
          "bytes": 4476,
          "sha256": "aa7e218dcb030ca32deef5d415d98fbdb52791f696db4d28eae55cf19dd601ec"
        },
        {
          "path": "python/lib/python3.12/urllib/error.py",
          "bytes": 2415,
          "sha256": "d12b3cc66af3f42a8ebe63e1c91d24f92c6237b6a93a3702938dffabd812d77b"
        },
        {
          "path": "python/lib/python3.12/urllib/parse.py",
          "bytes": 45676,
          "sha256": "e6af7f475262f1de335bb2e41e26adb94d6103977cf5fe1ddc430dc6a3b1623f"
        },
        {
          "path": "python/lib/python3.12/urllib/request.py",
          "bytes": 103724,
          "sha256": "6ffc7d993de64319a40fad631966bd1fd643d355a5c154c1a8b1821f49e5c470"
        },
        {
          "path": "python/lib/python3.12/urllib/response.py",
          "bytes": 2361,
          "sha256": "7e6c3b6d7a95f0d74f5968f51a87adae8a51bf42390cdfec98c7a99203e7bb76"
        },
        {
          "path": "python/lib/python3.12/urllib/robotparser.py",
          "bytes": 9468,
          "sha256": "644cc6d2b09948e8782cb1e7dea3bb39a2d83932c67e7a8eae65a711318c002c"
        },
        {
          "path": "python/lib/python3.12/uu.py",
          "bytes": 7365,
          "sha256": "dd1f5be33fb25a1b0832891ea07db4a4a2ae41b466e37e24e204604fdc6d18cf"
        },
        {
          "path": "python/lib/python3.12/uuid.py",
          "bytes": 29656,
          "sha256": "fe357bff7241e9fd6f86ee81567fd20aeec2e17460428ea9b7924bebf57301fc"
        },
        {
          "path": "python/lib/python3.12/venv/__init__.py",
          "bytes": 26750,
          "sha256": "976ba2fbc7b22cd2ed315d679aef096d8ddadebbc65492cf892ff29e41860c58"
        },
        {
          "path": "python/lib/python3.12/venv/__main__.py",
          "bytes": 145,
          "sha256": "722537c68c0622f8293d39bb6ab1288f3637d8dc45d6f9aae96e49af8145ca36"
        },
        {
          "path": "python/lib/python3.12/venv/__pycache__/__init__.cpython-312.pyc",
          "bytes": 31368,
          "sha256": "e8629fb3611fc52431784c052e386a7d1ecc5792d25fb8fb65e1bab9eb3460c3"
        },
        {
          "path": "python/lib/python3.12/venv/__pycache__/__main__.cpython-312.pyc",
          "bytes": 542,
          "sha256": "75f23102ea14446faa450cbee7b7a40ddd79af10f8db9fc24e438596e51202ff"
        },
        {
          "path": "python/lib/python3.12/venv/scripts/common/activate",
          "bytes": 2170,
          "sha256": "aba58c76034e4c5ddf9e2351070827d3082606c302d0174d387d2b7e97811b0b"
        },
        {
          "path": "python/lib/python3.12/venv/scripts/common/Activate.ps1",
          "bytes": 9033,
          "sha256": "3795a060dea7d621320d6d841deb37591fadf7f5592c5cb2286f9867af0e91df"
        },
        {
          "path": "python/lib/python3.12/venv/scripts/posix/activate.csh",
          "bytes": 934,
          "sha256": "2b48fcd78f4a7f4437caa76284030d69969be6e56c25cc8acc8c9610bc8ecfcc"
        },
        {
          "path": "python/lib/python3.12/venv/scripts/posix/activate.fish",
          "bytes": 2209,
          "sha256": "179d0e20caf4c36d0c6a4457c487dceb51bd5bd379939362b76759ef324c7930"
        },
        {
          "path": "python/lib/python3.12/warnings.py",
          "bytes": 21909,
          "sha256": "6405e281882932205eae641b2d31fba7776f94517a206d289465a1caffbf310e"
        },
        {
          "path": "python/lib/python3.12/wave.py",
          "bytes": 22769,
          "sha256": "0330428ea9e45fee49acc4ae5bdca4c235f4236c51dab09f30442ccafa25c1f8"
        },
        {
          "path": "python/lib/python3.12/weakref.py",
          "bytes": 21513,
          "sha256": "56f8d313fb74019e53eb9287400702fbce788b7fe30e097b0b6e06296f3f080c"
        },
        {
          "path": "python/lib/python3.12/webbrowser.py",
          "bytes": 24207,
          "sha256": "8a7d3cea5e22f227b2fbfcdb21be2ffc3f1c940d2ea26d2da479e1efeec49388",
          "executable": true
        },
        {
          "path": "python/lib/python3.12/wsgiref/__init__.py",
          "bytes": 657,
          "sha256": "c30e144025a63d267778d92f2f066fa592b476e789d888f79b96c059bf0bef60"
        },
        {
          "path": "python/lib/python3.12/wsgiref/handlers.py",
          "bytes": 21809,
          "sha256": "ad6af74ec157c3a9153d9b34d7ce684e2df1d329aa703990ae5cdc1a08fc6f7f"
        },
        {
          "path": "python/lib/python3.12/wsgiref/headers.py",
          "bytes": 7370,
          "sha256": "9e579ab07be58d321f820b481230a10d5ba6dc4db6512c5323051c4870465ca4"
        },
        {
          "path": "python/lib/python3.12/wsgiref/simple_server.py",
          "bytes": 5171,
          "sha256": "d435cad48b5f63c0356e1ac70755e6e35eb94b02f9844b813e5762199110bc2b"
        },
        {
          "path": "python/lib/python3.12/wsgiref/types.py",
          "bytes": 1717,
          "sha256": "ba66d30ce511a88eba9b809616c51e12bf89c67972102e7d976b18557f7a6387"
        },
        {
          "path": "python/lib/python3.12/wsgiref/util.py",
          "bytes": 5472,
          "sha256": "93783cda348368538525f52a5e9a5a43a3de93caec26b6a030ecfb3aedf98b98"
        },
        {
          "path": "python/lib/python3.12/wsgiref/validate.py",
          "bytes": 15036,
          "sha256": "4132f87dcf11a332f6ec5b051e68e59ff493dd6fdcc4f716ea72373734977a0a"
        },
        {
          "path": "python/lib/python3.12/xdrlib.py",
          "bytes": 5942,
          "sha256": "983c5e8e3090bdbeb94bf4faf841c1f8c916bcbca423863f6870a142d16a4fb8"
        },
        {
          "path": "python/lib/python3.12/xml/__init__.py",
          "bytes": 557,
          "sha256": "34296f728e7fe68cccb97a9f6edbf3bf3a686f44044c744fe85f207a92ed4811"
        },
        {
          "path": "python/lib/python3.12/xml/__pycache__/__init__.cpython-312.pyc",
          "bytes": 769,
          "sha256": "d75c7c0c91db9900d23cd7ceab9501161ac038c189017ec52f874104a4f3d361"
        },
        {
          "path": "python/lib/python3.12/xml/dom/__init__.py",
          "bytes": 4019,
          "sha256": "b415a6f3d3663c3ac332ee4a0f4213eadad9281508dc97410e258a03633b063a"
        },
        {
          "path": "python/lib/python3.12/xml/dom/domreg.py",
          "bytes": 3451,
          "sha256": "826b02a803930834b96b1086cbee7db1d21c684f65dd3073706dc7bb5ba1a3e8"
        },
        {
          "path": "python/lib/python3.12/xml/dom/expatbuilder.py",
          "bytes": 35693,
          "sha256": "80598dbc5970feaa36ea2b7549e3e76dd018fb80cf79e4a5e27e9e71af60c82c"
        },
        {
          "path": "python/lib/python3.12/xml/dom/minicompat.py",
          "bytes": 3367,
          "sha256": "42974c4c67803dfe80b016ff8aeea0d1e5c751703ab3aec5be765f4e534367be"
        },
        {
          "path": "python/lib/python3.12/xml/dom/minidom.py",
          "bytes": 67982,
          "sha256": "ceb557c3bc32e2a734d947dffb2452676cfb2f6d83d6b490b9e2d9f700f45d33"
        },
        {
          "path": "python/lib/python3.12/xml/dom/NodeFilter.py",
          "bytes": 936,
          "sha256": "9bfacbbb64e239a75591a7260b3ed86748eeb4366e6c40f3542753e79bace9a7"
        },
        {
          "path": "python/lib/python3.12/xml/dom/pulldom.py",
          "bytes": 11637,
          "sha256": "614b88673d496a360e6b10efe8d733c7c0826fb214470ff12f24a1e597699870"
        },
        {
          "path": "python/lib/python3.12/xml/dom/xmlbuilder.py",
          "bytes": 12420,
          "sha256": "26883dc30a461cb6a3583bd79d363858059569c04e94e3787d4d028f5fab7354"
        },
        {
          "path": "python/lib/python3.12/xml/etree/__init__.py",
          "bytes": 1605,
          "sha256": "91950edfb196c105d93886f8af7ea3c0a79e06a6b63be3e5a4ea09804e8672a6"
        },
        {
          "path": "python/lib/python3.12/xml/etree/cElementTree.py",
          "bytes": 82,
          "sha256": "d0f57acab07fe4f9c116c3392d85946bac8e78608f409cea70005f16ea019b57"
        },
        {
          "path": "python/lib/python3.12/xml/etree/ElementInclude.py",
          "bytes": 6952,
          "sha256": "8e10c99668216701224831c82f13b36d29cd408554c19e34d290c351595df4ce"
        },
        {
          "path": "python/lib/python3.12/xml/etree/ElementPath.py",
          "bytes": 14228,
          "sha256": "f9c2102cf56cf9859d34e69877ad4e8a04a0cdabb6390cf2189f04aa8101759f"
        },
        {
          "path": "python/lib/python3.12/xml/etree/ElementTree.py",
          "bytes": 74017,
          "sha256": "897618a09d05dadfa9d1707b39533526be69bf01d133747395d27fdc23db3f9f"
        },
        {
          "path": "python/lib/python3.12/xml/parsers/__init__.py",
          "bytes": 167,
          "sha256": "b88497adc30d5d5eda7789c25a2206ee9270c932d584d7ac42680325651da45c"
        },
        {
          "path": "python/lib/python3.12/xml/parsers/__pycache__/__init__.cpython-312.pyc",
          "bytes": 379,
          "sha256": "6e048078e8b0ad7479fb00b0e6d502cf66e1a3cf10334516d915a37e04a65750"
        },
        {
          "path": "python/lib/python3.12/xml/parsers/__pycache__/expat.cpython-312.pyc",
          "bytes": 478,
          "sha256": "366730a33bcde55255b2be118b72571736dde758fc506a68dc9052098599c96a"
        },
        {
          "path": "python/lib/python3.12/xml/parsers/expat.py",
          "bytes": 248,
          "sha256": "64e1947747c2874117a7458bba1f07c86620cc0ed9a4a4116d262878e4a2aa09"
        },
        {
          "path": "python/lib/python3.12/xml/sax/__init__.py",
          "bytes": 3238,
          "sha256": "2f949d27b9eda6284482b43f4c202830fb35ea94f4101d70452119d3210bdbe0"
        },
        {
          "path": "python/lib/python3.12/xml/sax/_exceptions.py",
          "bytes": 4699,
          "sha256": "26564d5742496196d17a4a0ee135d28f652ec81742cf2fa4bff83e64323578ac"
        },
        {
          "path": "python/lib/python3.12/xml/sax/expatreader.py",
          "bytes": 16034,
          "sha256": "5b6750ae591cffa303b20f092b13409a92df5ee1c403adac08dd5320eafee0be"
        },
        {
          "path": "python/lib/python3.12/xml/sax/handler.py",
          "bytes": 15617,
          "sha256": "64c7aae49f1dd382a7b9012610307bfa1d43a14a5dc09a5c8da30903f6805c3d"
        },
        {
          "path": "python/lib/python3.12/xml/sax/saxutils.py",
          "bytes": 12255,
          "sha256": "3fe2cdb6386e0c4d42d37c657bbecb78b69c57aedb1610dbd8bf4043944130ab"
        },
        {
          "path": "python/lib/python3.12/xml/sax/xmlreader.py",
          "bytes": 12624,
          "sha256": "0962c8d64ac8b03148d4ae62a531f544c4fd1be2116c6f4a53b480cff463dbba"
        },
        {
          "path": "python/lib/python3.12/xmlrpc/__init__.py",
          "bytes": 38,
          "sha256": "87ad5c8954dd56fbbca04517bf87477ff4dce575170c7dd1281d7ef1f4214ac8"
        },
        {
          "path": "python/lib/python3.12/xmlrpc/__pycache__/__init__.cpython-312.pyc",
          "bytes": 197,
          "sha256": "8ff57043c0c61b43dc7b95905294f5c134cd016911c744815b7c9955b94bfbd1"
        },
        {
          "path": "python/lib/python3.12/xmlrpc/__pycache__/client.cpython-312.pyc",
          "bytes": 51591,
          "sha256": "cbd65e2cc67aa13b32897946a719380c8022b70a60c4149d97fd71d50483461d"
        },
        {
          "path": "python/lib/python3.12/xmlrpc/client.py",
          "bytes": 49331,
          "sha256": "c77e7072ab9aaab6c6f16f89f2e7d528183b816df5d9f80e490f773ab45fe238"
        },
        {
          "path": "python/lib/python3.12/xmlrpc/server.py",
          "bytes": 36822,
          "sha256": "6781c25a6224b8bafe13050d26456c8a8b480c96e7974bcf60d4deb0c4ad454c"
        },
        {
          "path": "python/lib/python3.12/zipapp.py",
          "bytes": 7543,
          "sha256": "56e098b62cef6c39944bb898326dd920b70be461fe644139e2b699977d2997a1"
        },
        {
          "path": "python/lib/python3.12/zipfile/__init__.py",
          "bytes": 89520,
          "sha256": "83031a1582b84054fdde260a372f8ed25d9dedfbfcbedcef2bc015bcca7c5332"
        },
        {
          "path": "python/lib/python3.12/zipfile/__main__.py",
          "bytes": 58,
          "sha256": "e418cdbb27adf0063e3cec28179ac6b7bdb6ac743bb49d157f450551fcf38be2"
        },
        {
          "path": "python/lib/python3.12/zipfile/__pycache__/__init__.cpython-312.pyc",
          "bytes": 101209,
          "sha256": "ae12a6b0fb4fd5e5a46cf2b611f36983a39dfae9ab4b7690058a33dd4c7e611e"
        },
        {
          "path": "python/lib/python3.12/zipfile/_path/__init__.py",
          "bytes": 10860,
          "sha256": "63fc930890d38a662253bcf7ae50a1bfa06ce38bade19084f9c89f964dcd0e12"
        },
        {
          "path": "python/lib/python3.12/zipfile/_path/__pycache__/__init__.cpython-312.pyc",
          "bytes": 18970,
          "sha256": "9790e8ff1af6c58ff5b0be5c441e3efa4317404e28a9df10f1392569cbaa0142"
        },
        {
          "path": "python/lib/python3.12/zipfile/_path/__pycache__/glob.cpython-312.pyc",
          "bytes": 2015,
          "sha256": "4cf430fcf039256c585c3fac87ed3f6dce4c7c9351e334a89d1cc9bb071782e3"
        },
        {
          "path": "python/lib/python3.12/zipfile/_path/glob.py",
          "bytes": 1158,
          "sha256": "64e27d3872da2ea18b901718c91297d32b9610ebdad058de8561344b0a10e8d7"
        },
        {
          "path": "python/lib/python3.12/zipimport.py",
          "bytes": 27840,
          "sha256": "a96f1d7a7b6aaf421a3cf382b94b1422f4f0ad452fdd0bb61d635b560d7a4e91"
        },
        {
          "path": "python/lib/python3.12/zoneinfo/__init__.py",
          "bytes": 703,
          "sha256": "ac7fb403e4371d07482ef2fda81dbcf6879484e9fc41d4be42c156d7e54c68a8"
        },
        {
          "path": "python/lib/python3.12/zoneinfo/_common.py",
          "bytes": 5294,
          "sha256": "67deaf0ba41aa4865e007297677207485a89b75629eea0ee5c472be8a3e83bf6"
        },
        {
          "path": "python/lib/python3.12/zoneinfo/_tzpath.py",
          "bytes": 5388,
          "sha256": "5dc473af6f6ae35e5531cc9705a1e4923aa07e7d35f6b4c275b90c6a3c2591c4"
        },
        {
          "path": "python/lib/python3.12/zoneinfo/_zoneinfo.py",
          "bytes": 24674,
          "sha256": "ebb9b679519a23252eb90541003a2fdbb3f2d7bc36713fd70672baa575dcdcb6"
        },
        {
          "path": "python/lib/tcl9.0/auto.tcl",
          "bytes": 22931,
          "sha256": "629dc86958aa1c5f8697a638f296c706458e7a3418d2d81a2e81ce945f3828c6"
        },
        {
          "path": "python/lib/tcl9.0/clock.tcl",
          "bytes": 60997,
          "sha256": "6b286804649120c7c249d8c2941cee8e1da59211132d985ad97b8ab196073546"
        },
        {
          "path": "python/lib/tcl9.0/cookiejar0.2/cookiejar.tcl",
          "bytes": 21330,
          "sha256": "9d0811415b98c15bbb5c8f86ec3b92e812dac61e3f4d564f7e0dd0b066ba632a"
        },
        {
          "path": "python/lib/tcl9.0/cookiejar0.2/idna.tcl",
          "bytes": 7453,
          "sha256": "fa329853cd186ea405f4bec122913f1e4286c54488d0ffd445f7f120c71583fe"
        },
        {
          "path": "python/lib/tcl9.0/cookiejar0.2/pkgIndex.tcl",
          "bytes": 214,
          "sha256": "7d6f5e0236fad3b60cf5b7b10fa5629effcebead382083a7d9543c9526095d1f"
        },
        {
          "path": "python/lib/tcl9.0/cookiejar0.2/public_suffix_list.dat.gz",
          "bytes": 70835,
          "sha256": "22b8b49a17178863832dbbb646946b38f0f879cb1cd5cb3e7490e62a055fc623"
        },
        {
          "path": "python/lib/tcl9.0/encoding/ascii.enc",
          "bytes": 1090,
          "sha256": "a2b03c43e2bb86bd50b022fe961bfb0e0ed632edaf838454ace8a565e827160c"
        },
        {
          "path": "python/lib/tcl9.0/encoding/big5.enc",
          "bytes": 92873,
          "sha256": "65175eb63b96c5d5436a83bffac26d6efed0c4b90e6a95a8b66476105bbbd49a"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cns11643.enc",
          "bytes": 97050,
          "sha256": "0a95f67f90b1cdd407a78ea4032af9eb996fc38864c46d74b42b3a7f7eda0c8a"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1250.enc",
          "bytes": 1091,
          "sha256": "852fba18eddf59ca2d70e1398a59686fbb1c9fb473d759382935bb17c4258156"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1251.enc",
          "bytes": 1091,
          "sha256": "acac49a21371cd35adfcb969b5edffc43689fd9b3becdc7367e4b26674a25ccb"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1252.enc",
          "bytes": 1091,
          "sha256": "73bc277663125f376973065cfc3c9d834c74b1ad72c8d284978e19ea00d2de7d"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1253.enc",
          "bytes": 1091,
          "sha256": "04b00244838fc509d16b395d5888db572cba8bd57ae11462940f96be39ab390c"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1254.enc",
          "bytes": 1091,
          "sha256": "499fc6830e99a8087cae8cebc5777a94ba278cd0f950d206d059f68824b4fe3c"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1255.enc",
          "bytes": 1091,
          "sha256": "2cf2e3f75cf30853a80282fd284297309616835bf218f200cb9a7400c5ed8173"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1256.enc",
          "bytes": 1091,
          "sha256": "bbacea81d4f7a3a7f3c036273a4534d31dbf8b6b5cca2bcc4c00cb1593cf03d8"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1257.enc",
          "bytes": 1091,
          "sha256": "50d0ff658100b103805a66e381f77a5bd612ed548d94eedc97a472ddf53fbf4b"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp1258.enc",
          "bytes": 1091,
          "sha256": "5515ba9a9787bb80148216f3b3d99047c1577b14db529a0d29b484a1f900685b"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp165.enc",
          "bytes": 1090,
          "sha256": "644bc93a948341eb8e2ecb09ec1870d03375e5af69115b094b66dec80d1bba9c"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp437.enc",
          "bytes": 1090,
          "sha256": "d707a1f03514806e714f01cbfcb7c9f9973acdc80c2d67bbd4e6f85223a50952"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp737.enc",
          "bytes": 1090,
          "sha256": "8bfca34869b3f9a3b2fc71b02cbac41512af6d1f8ab17d2564e65320f88ede10"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp775.enc",
          "bytes": 1090,
          "sha256": "44fb04b5c72b584b6283a99b34789690c627b5083c5df6e8b5b7ab2c68903c06"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp850.enc",
          "bytes": 1090,
          "sha256": "55aa2d13b789b3125f5c9d0dc5b6e3a90d79426d3b7825dcd604f56d4c6e36a2"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp852.enc",
          "bytes": 1090,
          "sha256": "5266b6f18c3144cfadbcb7b1d27f0a7eaa1c641fd3b33905e42e4549fd373770"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp855.enc",
          "bytes": 1090,
          "sha256": "e3f071c63ac43af66061506ef2c574c35f7bf48553fb5158ae41d9230c1a10df"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp857.enc",
          "bytes": 1090,
          "sha256": "e39985c6a238086b54427475519c9e0285750707db521d1820e639723c01c36f"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp860.enc",
          "bytes": 1090,
          "sha256": "6db59139627d29abd36f38ed2e0de2a6b234a7d7e681c7dbaf8b888f1cac49a5"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp861.enc",
          "bytes": 1090,
          "sha256": "a43a5b58bfc57bd723b12bbdea9f6e1a921360b36d2d52c420f37299788442d3"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp862.enc",
          "bytes": 1090,
          "sha256": "aea716d490c35439621a8f00ca7e4397ef1c70428e206c5036b7af25f1c3d82f"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp863.enc",
          "bytes": 1090,
          "sha256": "13b5cb481e0216a8fc28bfa9d0f6b060cdf5c457b3e12435ca826eb2ef52b068"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp864.enc",
          "bytes": 1090,
          "sha256": "338f9a4e70dd3d0b9be292a630db51a9090379afcc9c2c6da0332cffa7868752"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp865.enc",
          "bytes": 1090,
          "sha256": "407fc0fe06d2a057e9ba0109ea9356cab38f27756d135ef3b06a85705b616f50"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp866.enc",
          "bytes": 1090,
          "sha256": "82633643cd326543915acc5d28a634b5795274cd39974d3955e51d7330ba9338"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp869.enc",
          "bytes": 1090,
          "sha256": "a25cdbba0d29fba9cc2982456f39397797ec05de91cabe39f44974b63f186e05"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp874.enc",
          "bytes": 1090,
          "sha256": "f0ec3dcb2e20957de7e35f815d212e819ebc28c1ce4bd17e0529cee94db1ef1d"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp932.enc",
          "bytes": 48207,
          "sha256": "a797d602482055705b0bc2c8e64eb72899841addd2d5ee05dcab7e077ce55ef8"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp936.enc",
          "bytes": 132509,
          "sha256": "619330192984a80f93ac6f2e4e5eaa463fd3dddc75c1f65f3975f33e0dd7a0bb"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp949.enc",
          "bytes": 130423,
          "sha256": "dc9384c3d367b75f73e5ae82cbbf2e815ff98621ac26c323ea5e8580a336d193"
        },
        {
          "path": "python/lib/tcl9.0/encoding/cp950.enc",
          "bytes": 91831,
          "sha256": "1ef0ff7cfbd4d52059a21c0b880fd7a5b1003d6f1bb1fd490f0b2d3d9ce328c4"
        },
        {
          "path": "python/lib/tcl9.0/encoding/dingbats.enc",
          "bytes": 1093,
          "sha256": "909a196858cb8bccdd88c74440a878c84a0f8af7b61acafadfd6cb7bccd13139"
        },
        {
          "path": "python/lib/tcl9.0/encoding/ebcdic.enc",
          "bytes": 1091,
          "sha256": "b5e5c2ac0d0ae2c11c9568e97c692a2f9c1bfbfe2c92e663a48b0f2583cb873a"
        },
        {
          "path": "python/lib/tcl9.0/encoding/euc-cn.enc",
          "bytes": 85574,
          "sha256": "579bd7804e9e387bb9ed9ba88af79d142eaf0e46e0f7273779320c64fcec3039"
        },
        {
          "path": "python/lib/tcl9.0/encoding/euc-jp.enc",
          "bytes": 82537,
          "sha256": "ee20bda6c47b4d0baaca43a1438256ee8c8549eb7dfae1860b2f93eead18b6ed"
        },
        {
          "path": "python/lib/tcl9.0/encoding/euc-kr.enc",
          "bytes": 93918,
          "sha256": "4a88667d0f6d91110f87875cd827da3f4db23b49b35db0051ce218380d8f0142"
        },
        {
          "path": "python/lib/tcl9.0/encoding/gb12345.enc",
          "bytes": 86619,
          "sha256": "0c0df17bfece897a1da7765c822453b09866573028cecced13e2efee02bcccc4"
        },
        {
          "path": "python/lib/tcl9.0/encoding/gb1988.enc",
          "bytes": 1091,
          "sha256": "ebb084b998266362c9eb1bea7b0aafe04967a6447ae6b2483a83c9cbe1da51da"
        },
        {
          "path": "python/lib/tcl9.0/encoding/gb2312-raw.enc",
          "bytes": 84532,
          "sha256": "ec11bfd49c715cd89fb9d387a07cf54261e0f4a1ccec1a810e02c7b38ad2f285"
        },
        {
          "path": "python/lib/tcl9.0/encoding/gb2312.enc",
          "bytes": 85574,
          "sha256": "546392237f47d71cee1daa1aae287d94d93216a1fabd648b50f59ddce7e8ae35"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso2022-jp.enc",
          "bytes": 192,
          "sha256": "e12928e8b5754d49d0d3e799135de2b480ba84b5dbaa0e350d9846fa67f943ec"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso2022-kr.enc",
          "bytes": 115,
          "sha256": "6ac0f1845a56a1a537b9a6d9bcb724dddf3d3a5e61879ae925931b1c0534fbb7"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso2022.enc",
          "bytes": 226,
          "sha256": "753dda518a7e9f6dc0309721b1faae58c9661f545801da9f04728391f70be2d0"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-1.enc",
          "bytes": 1094,
          "sha256": "754ef6bf3a564228ab0b56dde391521dcc1a6c83cfb95d4b761141e71d2e8e87"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-10.enc",
          "bytes": 1095,
          "sha256": "79f6470d9bebd30832b3a9ca59cd1fdca28c5be6373bd01d949eee1ba51aa7a8"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-11.enc",
          "bytes": 1095,
          "sha256": "ad939139ff7140970bde3d91180f7c4d703d7fcf67a02c71392de1980dc560e4"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-13.enc",
          "bytes": 1095,
          "sha256": "33c6072a006ba4e9513d7b7fd3d08b1c745ca1079b6d796c36b2a5ae8e4ae02b"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-14.enc",
          "bytes": 1095,
          "sha256": "8d737283289baf8c08ef1dd7e47a6c775dace480419c5e2a92d6c0e85bb5b381"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-15.enc",
          "bytes": 1095,
          "sha256": "c7b0377f30e42048492e4710fe5a0a54fa9865395b8a6748f7dac53b901284f9"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-16.enc",
          "bytes": 1095,
          "sha256": "c40ca014b88f97ae62ae1a816c5963b1ed432a77d84d89c3a764ba15c8a23708"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-2.enc",
          "bytes": 1094,
          "sha256": "0e0732480338a229cc3ad4cdde09021a0a81902dc6edfb5f12203e2aff44668f"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-3.enc",
          "bytes": 1094,
          "sha256": "73342c27cf55f625d3db90c5fc8e7340ffdf85a51872dbfb1d0a8cb1e43ec5da"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-4.enc",
          "bytes": 1094,
          "sha256": "17745bdd299779e91d41db0cee26cdc7132da3666907a94210b591ced5a55adb"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-5.enc",
          "bytes": 1094,
          "sha256": "bc5ed164d15321404bbdcad0d647c322ffab1659462182dbd3945439d9ecbae7"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-6.enc",
          "bytes": 1094,
          "sha256": "f502e07ae3f19ccdc31e434049cfc733dd5df85487c0160b0331e40241ad0274"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-7.enc",
          "bytes": 1094,
          "sha256": "013b3b2911c66bc1ca54e510814af4954c310da10737f9b2a2474d714be2ab39"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-8.enc",
          "bytes": 1094,
          "sha256": "e1d207917aa3483d9110e24a0cc0cd1e0e5843c8bfc901cfee7a6d872dd945a9"
        },
        {
          "path": "python/lib/tcl9.0/encoding/iso8859-9.enc",
          "bytes": 1094,
          "sha256": "1cdcf510c38464e5284edcfaec334e3fc516236c1ca3b9ab91ca878c23866914"
        },
        {
          "path": "python/lib/tcl9.0/encoding/jis0201.enc",
          "bytes": 1092,
          "sha256": "867ae0cbf181b80a0e4644eeaab6332fdd3877a24ed29696c6e5060d8b790eee"
        },
        {
          "path": "python/lib/tcl9.0/encoding/jis0208.enc",
          "bytes": 80453,
          "sha256": "118ea160ef29e11b46dec57af2c44405934dd8a7c49d2bc8b90c94e8baa6138b"
        },
        {
          "path": "python/lib/tcl9.0/encoding/jis0212.enc",
          "bytes": 70974,
          "sha256": "24a9d379fda39f2bcc0580ca3e0bd2e99ae279af5e2841c9e7dbe7f931d19cc0"
        },
        {
          "path": "python/lib/tcl9.0/encoding/koi8-r.enc",
          "bytes": 1091,
          "sha256": "7142b1120b993d6091197574090fe04be3ea64ffc3ad5a167a4b5e0b42c9f062"
        },
        {
          "path": "python/lib/tcl9.0/encoding/koi8-ru.enc",
          "bytes": 1092,
          "sha256": "087f597d223a0835262b0fb963924628fc7316ba2dffb28b73c1fe0db001f531"
        },
        {
          "path": "python/lib/tcl9.0/encoding/koi8-t.enc",
          "bytes": 1091,
          "sha256": "b54215edddcbf3c2ba13cb4ba16fa9a152a035b75a4aacfddfa46d1581f2db42"
        },
        {
          "path": "python/lib/tcl9.0/encoding/koi8-u.enc",
          "bytes": 1091,
          "sha256": "cbaf0e6426c8d1766815528ccf10a438b1f3e4c5b105761da3ae810a094f2a62"
        },
        {
          "path": "python/lib/tcl9.0/encoding/ksc5601.enc",
          "bytes": 92877,
          "sha256": "0f8b530ad0decbf8dd81da8291b8b0f976c643b5a292db84680b31ecfbe5d00a"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macCentEuro.enc",
          "bytes": 1096,
          "sha256": "8f3089f4b2ca47b7ac4cb78375b2bfac01268113a7c67d020f8b5b7f2c25bbda"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macCroatian.enc",
          "bytes": 1096,
          "sha256": "8d0b6a882b742c5cce938241328606c111dda0cb83334ebedcda17605f3641ae"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macCyrillic.enc",
          "bytes": 1096,
          "sha256": "eb135a89519f2e004282ded21b11c3af7ccb2320c9772f2df7d1a4a1b674e491"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macDingbats.enc",
          "bytes": 1096,
          "sha256": "fa365a695d5610cf5c2aeb288432d4cea40ce63c99e68c447d6ac15b47102cd5"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macGreek.enc",
          "bytes": 1093,
          "sha256": "f7bff98228ded981ec9a4d1d0da62247a8d23f158926e3acbec3cce379c998c2"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macIceland.enc",
          "bytes": 1095,
          "sha256": "633f5e3e75bf1590c94ab9cbf3538d0f0a7a319db9016993908452d903d9c4fd"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macJapan.enc",
          "bytes": 48028,
          "sha256": "a8be085ab3afb537dbb4930acb693e67f736b7805cbd648b274bcf7007dead34"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macRoman.enc",
          "bytes": 1093,
          "sha256": "68f22bad30daa81b215925416c1cc83360b3bb87efc342058929731ac678ff37"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macRomania.enc",
          "bytes": 1095,
          "sha256": "71ae80adfb437b7bc88f3c76fd37074449b3526e7aa5776d2b9fd5a43c066fa8"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macThai.enc",
          "bytes": 1092,
          "sha256": "cead5eb2b0b44ef4003fbcb2e49ca0503992ba1d6540d11acbbb84fdbbd6e79a"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macTurkish.enc",
          "bytes": 1095,
          "sha256": "f703b7f74cc6f5faa959f51c757c94623677e27013bcae23befba01a392646d9"
        },
        {
          "path": "python/lib/tcl9.0/encoding/macUkraine.enc",
          "bytes": 1095,
          "sha256": "4c94e7fbe183379805056d960ab624d78879e43278262e4d6b98ab78e5fefea8"
        },
        {
          "path": "python/lib/tcl9.0/encoding/shiftjis.enc",
          "bytes": 41862,
          "sha256": "fbf9b3ded58d966c42c463feed6363e7de774a5fb9d39c0c9dda1dd3eb26768c"
        },
        {
          "path": "python/lib/tcl9.0/encoding/symbol.enc",
          "bytes": 1091,
          "sha256": "e05e07d65b6a073acffbda743f3860fcbc0e8cfe34a300646f4687042df0bc63"
        },
        {
          "path": "python/lib/tcl9.0/encoding/tis-620.enc",
          "bytes": 1092,
          "sha256": "7219d1bf862cab7a61468118ad56abe63e826186395134efd74a4acba18dd959"
        },
        {
          "path": "python/lib/tcl9.0/foreachline.tcl",
          "bytes": 608,
          "sha256": "5073f9015583f00b25354a7877f55c68d93674ae11384ee042e3b094a8a900e8"
        },
        {
          "path": "python/lib/tcl9.0/history.tcl",
          "bytes": 7899,
          "sha256": "ca38bb6652bbc562a3a82d2919f4e900cc5deedfb3582fa4503c573754ccf007"
        },
        {
          "path": "python/lib/tcl9.0/icu.tcl",
          "bytes": 3861,
          "sha256": "bc125ef0732af6e67367e324c0b3de87e03f04f48c72c42fbb8f77b7b5849a8d"
        },
        {
          "path": "python/lib/tcl9.0/init.tcl",
          "bytes": 23574,
          "sha256": "8c5907793b2b8aa05e8d8cf39c0cb7f033c01ca1b8be683e7159774d1a01357a"
        },
        {
          "path": "python/lib/tcl9.0/install.tcl",
          "bytes": 7312,
          "sha256": "5508d98832c4f3cf52b297511206c5dd020111f1dfbe358eee023ee1bff3e012"
        },
        {
          "path": "python/lib/tcl9.0/opt0.4/optparse.tcl",
          "bytes": 30413,
          "sha256": "3d14ecf300f9fdd21875e22ce348988f852c177c4bf25fb6a7f37ba4be9fca73"
        },
        {
          "path": "python/lib/tcl9.0/opt0.4/pkgIndex.tcl",
          "bytes": 625,
          "sha256": "9eaa82aeb3d308b655b69660380829c54a6bbc011280667ac8cf0e5882132846"
        },
        {
          "path": "python/lib/tcl9.0/package.tcl",
          "bytes": 24081,
          "sha256": "473bf551d3156a144d6483ce730c72add640168a3ab426b3ee0b122f6d06a96e"
        },
        {
          "path": "python/lib/tcl9.0/parray.tcl",
          "bytes": 814,
          "sha256": "b8677236d4e687e686426718e78d3984146d2f318e5b34cbd43824206e85a40a"
        },
        {
          "path": "python/lib/tcl9.0/readfile.tcl",
          "bytes": 599,
          "sha256": "eff41b30c70251d068e24d1500ad504404d692f8d48ab74cf8f99bb4dba64414"
        },
        {
          "path": "python/lib/tcl9.0/safe.tcl",
          "bytes": 46995,
          "sha256": "0d3e8ddb147d713206139b7c4c915f11d0a53aebeee3a5ca3e7aebf26854e238"
        },
        {
          "path": "python/lib/tcl9.0/tclAppInit.c",
          "bytes": 4852,
          "sha256": "b055dfdc5744814a27ebdce6a466d56a269776ac6d0739d6f4f39d9f2db4e4dc"
        },
        {
          "path": "python/lib/tcl9.0/tclIndex",
          "bytes": 9866,
          "sha256": "a44757ba1e8499c88f71ee63979980f9db851793643ee21879e9b53873461b1c"
        },
        {
          "path": "python/lib/tcl9.0/tm.tcl",
          "bytes": 11904,
          "sha256": "7c1de0bc512b362c26d489bd332f3d883041d98c2ed1cc99b4d64cd97e646786"
        },
        {
          "path": "python/lib/tcl9.0/word.tcl",
          "bytes": 4764,
          "sha256": "3a481eacbcca1c611843cdc387ac51be0b8ac98a994cbe8fa43091fee35b207e"
        },
        {
          "path": "python/lib/tcl9.0/writefile.tcl",
          "bytes": 911,
          "sha256": "b454723873db2e587ac1323bcebff2e8929f5dc98a6fe001ed34fcaf0c2aa320"
        },
        {
          "path": "python/lib/tcl9/9.0/http-2.10.2.tm",
          "bytes": 180243,
          "sha256": "56372f15e8f73234b7fb2b68f597d5a56a42d995416cdf65fe0c2da1c114e5a9"
        },
        {
          "path": "python/lib/tcl9/9.0/msgcat-1.7.1.tm",
          "bytes": 37407,
          "sha256": "80301481addb70362ffd4eb1c301471a41e59987d39dbbc2a6096ddfb415071e"
        },
        {
          "path": "python/lib/tcl9/9.0/platform-1.1.0.tm",
          "bytes": 11052,
          "sha256": "4af798475ffe6a0af32f0202a7cbc7b07b59de5ddcd7f89fcbdd1b07ffe5f6e1"
        },
        {
          "path": "python/lib/tcl9/9.0/platform/shell-1.1.4.tm",
          "bytes": 5975,
          "sha256": "54337e9db387e5f3c0a714ae225d3d915da83751d5be4a9e177e9b726d3f92d6"
        },
        {
          "path": "python/lib/tcl9/9.0/tcltest-2.5.11.tm",
          "bytes": 105217,
          "sha256": "03da6ebf2e314e6c931430761cc47cf586ded9210f9c5afed804858a78034e67"
        },
        {
          "path": "python/lib/thread3.0.6/libtcl9thread3.0.6.dylib",
          "bytes": 138768,
          "sha256": "26ebe32d24fae28eea9b5e3f788e301fca8b1487060dbb3bf1c64cd1b1d2386a"
        },
        {
          "path": "python/lib/thread3.0.6/libthread3.0.6.dylib",
          "bytes": 138768,
          "sha256": "6448665438d2a4888b8bc7561b971e61805c8b0f0e0ede6ebad389b78d364e5d"
        },
        {
          "path": "python/lib/thread3.0.6/pkgIndex.tcl",
          "bytes": 2163,
          "sha256": "3bff57e67e9277049d464999e09f4568cc84cdf0afbad27ea99ea7f74806480f"
        },
        {
          "path": "python/lib/thread3.0.6/ttrace.tcl",
          "bytes": 24364,
          "sha256": "261d96832df31668c944e0989b077fbf093ed49558f164bddf01b6a260da15b9"
        },
        {
          "path": "python/lib/tk9.0/bgerror.tcl",
          "bytes": 8924,
          "sha256": "391d0b6ab287c01887db14a270fd7456caf9dea8163806d2a6910b085c1c9c64"
        },
        {
          "path": "python/lib/tk9.0/button.tcl",
          "bytes": 20834,
          "sha256": "7fba8f38b382468ae412541d63ab75223822fac023febb0b46532f2fa8d7fff9"
        },
        {
          "path": "python/lib/tk9.0/choosedir.tcl",
          "bytes": 9681,
          "sha256": "1536eae9e69ba05da9951a7125e836534423014700a09ec63c82d9cbbe9cb244"
        },
        {
          "path": "python/lib/tk9.0/clrpick.tcl",
          "bytes": 21550,
          "sha256": "c91f2715d02624249aff12c9ed7825d65964c21bcf5c0c32b0331c9260b07dc9"
        },
        {
          "path": "python/lib/tk9.0/comdlg.tcl",
          "bytes": 8355,
          "sha256": "fed47f393ff89f299d83ff482d3aa4ae61ced53dd75f3819a52c8e69b9a318cf"
        },
        {
          "path": "python/lib/tk9.0/console.tcl",
          "bytes": 32084,
          "sha256": "dc90799d3fb1828944f8394a9846b3d4a9e10d280bdff5bacbf02b82f0bd284b"
        },
        {
          "path": "python/lib/tk9.0/dialog.tcl",
          "bytes": 5800,
          "sha256": "463fdecfc1af0f70c8f0dba06a4865ce2a3311c2a52308df23891f0fcbc4f6ad"
        },
        {
          "path": "python/lib/tk9.0/entry.tcl",
          "bytes": 18659,
          "sha256": "8904b3e1fc746afdd4e3731d80dac785d5e8cab1ad954eeec525800be8c8ed85"
        },
        {
          "path": "python/lib/tk9.0/focus.tcl",
          "bytes": 4856,
          "sha256": "2b6f3cfb78c0a1d1e88dbdf9afe8eb80e5f5a0035f7d0f18981a327dd79d8377"
        },
        {
          "path": "python/lib/tk9.0/fontchooser.tcl",
          "bytes": 15648,
          "sha256": "8b78e74195f9e13e82349e0472c241db3382b6c4524a936d5cfe9ad3e6aab61b"
        },
        {
          "path": "python/lib/tk9.0/iconbadges.tcl",
          "bytes": 13046,
          "sha256": "e5015ee51106c53e623013ba6b6bcf17f6bec9686909bd3af44db9a58062ece2"
        },
        {
          "path": "python/lib/tk9.0/iconlist.tcl",
          "bytes": 16403,
          "sha256": "0e7c03224247b03ca1db39d01f58498b0356e2e483630f79f629e0b0c50d392f"
        },
        {
          "path": "python/lib/tk9.0/icons.tcl",
          "bytes": 2380,
          "sha256": "1082bdba6aeb87061d7147097b969edb8b458377078928bfdcc627778a710822"
        },
        {
          "path": "python/lib/tk9.0/images/logo.eps",
          "bytes": 32891,
          "sha256": "0dbef0fdf9c232ea53d9676b43eda981fd13f75366bd26898394f5da5923076a"
        },
        {
          "path": "python/lib/tk9.0/images/logo100.gif",
          "bytes": 2341,
          "sha256": "72f6b34d3c8f424ff0a290a793fcfbf34fd5630a916cd02e0a5dda0144b5957f"
        },
        {
          "path": "python/lib/tk9.0/images/logo64.gif",
          "bytes": 1670,
          "sha256": "138c240382304f350383b02ed56c69103a9431c0544eb1ec5dcd7dec7a555dd9"
        },
        {
          "path": "python/lib/tk9.0/images/logoLarge.gif",
          "bytes": 11000,
          "sha256": "0f404764d07a6ae2ef9e1e0e8eaac278b7d488d61cf1c084146f2f33b485f2ed"
        },
        {
          "path": "python/lib/tk9.0/images/logoMed.gif",
          "bytes": 3889,
          "sha256": "4d0bd3228ab4cc3e5159f4337be969ec7b7334e265c99b7633e3daf3c3fcfb62"
        },
        {
          "path": "python/lib/tk9.0/images/pwrdLogo.eps",
          "bytes": 27800,
          "sha256": "4928cb22d8fd8abd96f6803437bb8b9cb786170a840e824f5ea41810a8d02691"
        },
        {
          "path": "python/lib/tk9.0/images/pwrdLogo100.gif",
          "bytes": 1615,
          "sha256": "bcc0e6458249433e8cba6c58122b7c0efa9557cbc8fb5f9392eed5d2579fc70b"
        },
        {
          "path": "python/lib/tk9.0/images/pwrdLogo150.gif",
          "bytes": 2489,
          "sha256": "5fc25c30aee76477f1c4e922931cc806823df059525583ff5705705d9e913c1c"
        },
        {
          "path": "python/lib/tk9.0/images/pwrdLogo175.gif",
          "bytes": 2981,
          "sha256": "62866e95501c436b329a15432355743c6efd64a37cfb65bcece465ab63ecf240"
        },
        {
          "path": "python/lib/tk9.0/images/pwrdLogo200.gif",
          "bytes": 3491,
          "sha256": "bad9116386343f4a4c394bdb87146e49f674f687d52bb847bd9e8198fda382cc"
        },
        {
          "path": "python/lib/tk9.0/images/pwrdLogo75.gif",
          "bytes": 1171,
          "sha256": "462a8ff8fd051a8100e8c6c086f497e4056ace5b20b44791f4aab964b010a448"
        },
        {
          "path": "python/lib/tk9.0/images/README",
          "bytes": 322,
          "sha256": "2695adff8e900c31b4d86414d22b8a49d6dd865ca3dd99678fa355cdc46093a8"
        },
        {
          "path": "python/lib/tk9.0/images/tai-ku.gif",
          "bytes": 5473,
          "sha256": "e538f8f4934ca6e1ce29416d292171f28e67da6c72ed9d236ba42f37445ea41e"
        },
        {
          "path": "python/lib/tk9.0/listbox.tcl",
          "bytes": 13771,
          "sha256": "5cb48eecb7389ad0868e42d8a5a1ef86f193d6461b32210c54e5a69705bca1bf"
        },
        {
          "path": "python/lib/tk9.0/megawidget.tcl",
          "bytes": 9570,
          "sha256": "eeb4dfdc6bb2256c83c0374782cc6afe1578232b32b4cb216faccdb975f42958"
        },
        {
          "path": "python/lib/tk9.0/menu.tcl",
          "bytes": 38199,
          "sha256": "4ab1819b71532aeb493c63df54b572fe7ce3f474f1e449714b25c6dadd302ab8"
        },
        {
          "path": "python/lib/tk9.0/mkpsenc.tcl",
          "bytes": 29352,
          "sha256": "0ac9d11d4046ef4d8e6d219f6941bf69c6ae448c6a1c2f7fc382f84b5786f660"
        },
        {
          "path": "python/lib/tk9.0/msgbox.tcl",
          "bytes": 17249,
          "sha256": "1da78ffbd719cc38cfbeb2aeb0a1b18e46ba4477963c2fc7a0c22f4d3254a187"
        },
        {
          "path": "python/lib/tk9.0/optMenu.tcl",
          "bytes": 1580,
          "sha256": "2805d470102800d8af66fee3c030feeb45b4e969c37414838acb086e5fe14dcd"
        },
        {
          "path": "python/lib/tk9.0/palette.tcl",
          "bytes": 9491,
          "sha256": "59709065d66d690b50cd8b5a6dd99fa5e92a90e94d4e9df0c107eff1198f4e01"
        },
        {
          "path": "python/lib/tk9.0/panedwindow.tcl",
          "bytes": 5162,
          "sha256": "813d5da099883418818d9a9eb8dea0d38e1eebe29b903f794bedba64e7304a32"
        },
        {
          "path": "python/lib/tk9.0/pkgIndex.tcl",
          "bytes": 223,
          "sha256": "2721c3193aed2e07e1e8b617876b800e988bc1cdde5c0e7f5564601fede1daad"
        },
        {
          "path": "python/lib/tk9.0/print.tcl",
          "bytes": 42536,
          "sha256": "973d400c618b83956ca0ab88ec7711f03c18e9311cfe3d204fa600e2f139d01a"
        },
        {
          "path": "python/lib/tk9.0/safetk.tcl",
          "bytes": 7372,
          "sha256": "318c663c2ff6e8fd2c33e8cf0918342b0431a9151c1e05d8037f4ee7bfc6add1"
        },
        {
          "path": "python/lib/tk9.0/scale.tcl",
          "bytes": 7928,
          "sha256": "43b1e9c6f29e6a9fa09186fc51029a95dd4dc70a0cf0ddf92af058083fd4567c"
        },
        {
          "path": "python/lib/tk9.0/scaling.tcl",
          "bytes": 6496,
          "sha256": "20c4f15b4859e029122901abdbb6b95fe744094fb982f6168e4d55135e69efe7"
        },
        {
          "path": "python/lib/tk9.0/scrlbar.tcl",
          "bytes": 14282,
          "sha256": "ba1c40064864b01a25a3edd869b05b2dae745ddda8b12721db6980563a4b040f"
        },
        {
          "path": "python/lib/tk9.0/spinbox.tcl",
          "bytes": 16029,
          "sha256": "7239b27458867b25ec2fde06f2ea8833d481f1cfaf5804e7977f8d5a10bbb57b"
        },
        {
          "path": "python/lib/tk9.0/systray.tcl",
          "bytes": 14489,
          "sha256": "36b25a0a9cf4a9f1897aa90e145235aeb69e4146a761510d7475b16fc104b339"
        },
        {
          "path": "python/lib/tk9.0/tclIndex",
          "bytes": 20142,
          "sha256": "f083821ef84fa181a8e7cb95018490d3661b17fee06897e738eeb92823da0234"
        },
        {
          "path": "python/lib/tk9.0/tearoff.tcl",
          "bytes": 4439,
          "sha256": "7e0262027b3923105262ada30dcc285124397e3929eb1b198b429ddda81e73ff"
        },
        {
          "path": "python/lib/tk9.0/text.tcl",
          "bytes": 36150,
          "sha256": "03448f1557595e4487d86a68b93129b81f5e256301ddcc6b3742a40adca87b66"
        },
        {
          "path": "python/lib/tk9.0/tk.tcl",
          "bytes": 26717,
          "sha256": "a8a68093d26a32b78cc58b074fb4cd29b5a3312b4898be452395d7e2ce635cf1"
        },
        {
          "path": "python/lib/tk9.0/tkAppInit.c",
          "bytes": 5543,
          "sha256": "620e519f26d3c1c147e4c703c2c36b39d4f8704c6d7df8d499c41350d683fcfa"
        },
        {
          "path": "python/lib/tk9.0/tkfbox.tcl",
          "bytes": 37326,
          "sha256": "f4a89638d5145cb5a356a7eca38999356070e70392d74aab3e0da16470b2cfc5"
        },
        {
          "path": "python/lib/tk9.0/ttk/altTheme.tcl",
          "bytes": 5618,
          "sha256": "a92d5585c91f1c2e4bb8e92cf874e99d61bbdbecad1c2b9a9511d5a13e20238c"
        },
        {
          "path": "python/lib/tk9.0/ttk/aquaTheme.tcl",
          "bytes": 8137,
          "sha256": "25a38de6dbd4b9f8fb64635d55a5a0da4bc6b3b3d256bcb94b84303a99cf645d"
        },
        {
          "path": "python/lib/tk9.0/ttk/button.tcl",
          "bytes": 2916,
          "sha256": "58c4c1ac28e7a4da35df11a40ce9d7dc69b7ff56882c69a50d2947f47449076a"
        },
        {
          "path": "python/lib/tk9.0/ttk/clamTheme.tcl",
          "bytes": 6792,
          "sha256": "4d4c1a399553d4198ea822fbe73cf21c2c1fb60a4edd4069cad0ecf58dc614c3"
        },
        {
          "path": "python/lib/tk9.0/ttk/classicTheme.tcl",
          "bytes": 5285,
          "sha256": "8156dadbff4efde1cf4c48286e73aa915f7d8869583660e28d4eb608fdb6ebf7"
        },
        {
          "path": "python/lib/tk9.0/ttk/combobox.tcl",
          "bytes": 15488,
          "sha256": "56999ea89dd3b97f64c11de9b515fc2a71ee3dbaee927c6fd45d37be4fdee133"
        },
        {
          "path": "python/lib/tk9.0/ttk/cursors.tcl",
          "bytes": 4439,
          "sha256": "685b7f1737c606841f2a797f989b0153f88bbb62e80210c00524ef8526073682"
        },
        {
          "path": "python/lib/tk9.0/ttk/defaults.tcl",
          "bytes": 8025,
          "sha256": "8a2d71b2d98bc05ae8ce68fe888ebefeaee5e788734f8ea9bc0ab7aeab02bced"
        },
        {
          "path": "python/lib/tk9.0/ttk/entry.tcl",
          "bytes": 18034,
          "sha256": "081ae003913a17172782a9ae48c08f7433a6e3f02e51e52ed46cc99a62f4d694"
        },
        {
          "path": "python/lib/tk9.0/ttk/fonts.tcl",
          "bytes": 5031,
          "sha256": "235fbff958f5f420d86fdc40063441625ab3838f4a35d2210a9e1f43c30cdc78"
        },
        {
          "path": "python/lib/tk9.0/ttk/menubutton.tcl",
          "bytes": 6202,
          "sha256": "98fdf67d20188be9074e04a1ce4d91c4dc0562bc4762598ac42520d4d0eb100f"
        },
        {
          "path": "python/lib/tk9.0/ttk/notebook.tcl",
          "bytes": 7464,
          "sha256": "6aa711938fd62ff90535ab71d9091440c66f7c9ef028fe1db883acc38f0d58e4"
        },
        {
          "path": "python/lib/tk9.0/ttk/panedwindow.tcl",
          "bytes": 2028,
          "sha256": "5cdd719102c4f978cbd225ff9ea81256967839c26b2460c93a94702b94b9cc80"
        },
        {
          "path": "python/lib/tk9.0/ttk/progress.tcl",
          "bytes": 1218,
          "sha256": "440dfbd799945c9ee8abf275ef8715ef0663f278cc3117f6dd033fabca6c295b"
        },
        {
          "path": "python/lib/tk9.0/ttk/scale.tcl",
          "bytes": 2580,
          "sha256": "419012f3c07d4ae138f324b40b2e19178d3f7d277d85078451fbf4cfbed6125a"
        },
        {
          "path": "python/lib/tk9.0/ttk/scrollbar.tcl",
          "bytes": 2956,
          "sha256": "eab2c42fdd826b37b7308d4834ddef063b5f8125f21b00677746c03f66e2351e"
        },
        {
          "path": "python/lib/tk9.0/ttk/sizegrip.tcl",
          "bytes": 2353,
          "sha256": "a7132288dda9b5acc5f7751ba6eec8399f60988a2bebd480982a8c0a6418a27f"
        },
        {
          "path": "python/lib/tk9.0/ttk/spinbox.tcl",
          "bytes": 5309,
          "sha256": "b6522ed8a2f1bb6d999a2e010c6ec276f770ba39432615eb7fc0635c431dd956"
        },
        {
          "path": "python/lib/tk9.0/ttk/treeview.tcl",
          "bytes": 11898,
          "sha256": "cdc70e8b5f49cc77daf2866a69fbe2b37a0e3f12742e405eb5c1b31fe3a9d62d"
        },
        {
          "path": "python/lib/tk9.0/ttk/ttk.tcl",
          "bytes": 6408,
          "sha256": "ccfae8b866f51fdc5ce415a82300c8a85423228d99b80c61453c242989127f1c"
        },
        {
          "path": "python/lib/tk9.0/ttk/utils.tcl",
          "bytes": 7293,
          "sha256": "c7886c6bcf00c33c2ae165a9cdafb9eb65ef0a1ca93e91f54d9f7783e089c038"
        },
        {
          "path": "python/lib/tk9.0/ttk/vistaTheme.tcl",
          "bytes": 9491,
          "sha256": "7fb0dabbcf6044447d422ec552ba42776b8bf9c2b100c1ea62849abcca1aa13c"
        },
        {
          "path": "python/lib/tk9.0/ttk/winTheme.tcl",
          "bytes": 4054,
          "sha256": "f85a87d14deab7ab5d7306be8a0b3deaad2c81e7111eefce10e14b863bf06eff"
        },
        {
          "path": "python/lib/tk9.0/ttk/xpTheme.tcl",
          "bytes": 3299,
          "sha256": "6d6f529ed6055e74e9324aeeaeca1060a46180cdc561b55cc52a74cc710bff6f"
        },
        {
          "path": "python/lib/tk9.0/xmfbox.tcl",
          "bytes": 25855,
          "sha256": "8051bca4e346a27eb1d0e361bbfa10ff5aff9a4c8c7ef14f283a050656da1624"
        },
        {
          "path": "python/share/man/man1/python.1",
          "bytes": 20124,
          "sha256": "482786a0d83d8536eddc78aafdf702d247ddc1f33d45115bdfe86c92a3d6043f"
        },
        {
          "path": "python/share/man/man1/python3.1",
          "bytes": 20124,
          "sha256": "482786a0d83d8536eddc78aafdf702d247ddc1f33d45115bdfe86c92a3d6043f"
        },
        {
          "path": "python/share/man/man1/python3.12.1",
          "bytes": 20124,
          "sha256": "482786a0d83d8536eddc78aafdf702d247ddc1f33d45115bdfe86c92a3d6043f"
        }
      ],
      "license": {
        "name": "Python Software Foundation License Version 2",
        "url": "https://docs.python.org/3/license.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/python-312-3.12.14-20260924-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "826b20324acb9f2ce41a18df8e04746a9d9626dae9b21683c888161dfc47f2b4"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "uxEOWl9a24cJSkRSU4W9R5a1o5ywApusrFu6g3yXpeIb/H63QGEyvb4/DyTVuW5DWFNzaHx5aomLI6fGO/sLDw=="
    },
    {
      "protocolVersion": 1,
      "id": "video-ai",
      "moduleId": "video-ai",
      "groupId": "media",
      "displayName": "视频去字幕（CPU / MPS）",
      "purpose": "自动检测并修复视频中的硬字幕区域，支持批量任务与手动框选；快速修复和字幕检测运行于 CPU，已验收的 STTN MPS 与 ProPainter Hybrid FP16 共用本能力包。",
      "dependencyIds": [
        "python-312",
        "ffmpeg"
      ],
      "taskToolIds": [
        "video-ai"
      ],
      "installConditions": [
        "安装与处理全程离线；Worker、基础模型、OCR 和 M01 冻结的 STTN / ProPainter 源码与权重均随包安装。",
        "STTN MPS 与 ProPainter Hybrid FP16 仅在签名支持定义、资源摘要及运行时设备探针全部匹配时开放。",
        "ProPainter 源码与权重继续受随包 S-Lab 许可约束，仅限非商业研究用途；个人安装不会改变许可范围。",
        "磁盘需求以 Mac 能力包 manifest 的下载归档大小和解压预留量为准；视频合成复用共享 FFmpeg 组件。"
      ],
      "version": "1.1.0-py312-mps1-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/video-ai-1.1.0-py312-mps1-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 802268827,
        "sha256": "beeec5a2538183e130fc56318af537ef27881c9ab189ae12770c182b33da1230",
        "format": "tar.gz"
      },
      "installedBytes": 6000000000,
      "files": [
        {
          "path": "models/video-ai/big-lama.pt",
          "bytes": 205803670,
          "sha256": "7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c"
        },
        {
          "path": "models/video-ai/engines/propainter/LICENSE",
          "bytes": 1853,
          "sha256": "4d3e4d1250afaffa460be8e56d54a7310394d81fdd4710775fadbc837fac1251"
        },
        {
          "path": "models/video-ai/engines/propainter/PROVENANCE.json",
          "bytes": 5676,
          "sha256": "2191ae5d965797f82a567562a1870cbe7191d7e19930d476cb17fb07112c0a10"
        },
        {
          "path": "models/video-ai/engines/propainter/sequence-bundle.json",
          "bytes": 4781,
          "sha256": "831b87ac48d76e877897be56d518c58ead544fe8ceabd1d00719bb98ca195468"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/misc.py",
          "bytes": 4638,
          "sha256": "a766303c91f160ebca1757e71fa3fb4710f56ff3ec25c5dfbed8266698052670"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/base_module.py",
          "bytes": 5583,
          "sha256": "495659e684e3177fda3d5f018c65949df8180e074b9d6a4b5a580b9aec333a49"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/deformconv.py",
          "bytes": 1696,
          "sha256": "cfcb91be57c1795e54077d1de16d78f46298a212e66715078b644678b84581b0"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/flow_comp_raft.py",
          "bytes": 10071,
          "sha256": "a72d2f63ba207571dbc16882a8e2b2ae53520d17f85ee49398d5338a16b6e41a"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/flow_loss_utils.py",
          "bytes": 5654,
          "sha256": "b08e4441fbb2d611dc5c3bb7bf5d5da830fd9f3c947442eb133ba3a12c0138e4"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/sparse_transformer.py",
          "bytes": 15866,
          "sha256": "e29d3dcda72ee18d7aa897df26b79621b22dcb459f996c569afb4e6fa6e44674"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/modules/spectral_norm.py",
          "bytes": 12358,
          "sha256": "f94c800f3ecd5b54e791e251def514c8bc2b2d962cc0db709fcb8af286f46267"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/propainter.py",
          "bytes": 22108,
          "sha256": "428c1ce9a8c9a834be0ad9710cdf2ec0590b7b822f80aad07404572184e5b5dc"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/model/recurrent_flow_completion.py",
          "bytes": 12816,
          "sha256": "cec37d6404d370845b2a592b1d7d9ce79061df725ade0b7576fb0de59a2ea54c"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/__init__.py",
          "bytes": 54,
          "sha256": "4eef12ccfcfa5793551dd8dcd62037ea0032fb131a1bacf71a0ba1984639805b"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/corr.py",
          "bytes": 3640,
          "sha256": "1aa5456656c26f9fe77100edb1f6134ada2c5ef731bd5470efd3cd5962b48333"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/extractor.py",
          "bytes": 8847,
          "sha256": "f6b65d4f4df27001d9c11194f71b84a9799de3231f9d1672cbcf3a052fec79dc"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/raft.py",
          "bytes": 4870,
          "sha256": "d104c88d546bb30eb0bd115f93fec21480927f32e5eeb67ffea906cb1d444a93"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/update.py",
          "bytes": 5224,
          "sha256": "824855a3f625810a9fe8efe50a87a4d9da8b9ff4c6b8990ff64c77470895ea4e"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/utils/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/propainter/vendor/RAFT/utils/utils.py",
          "bytes": 2451,
          "sha256": "bfab8e6787032ea5cd15a57cbeee534fd11c454dc2c2babb86138c6fe7642fb0"
        },
        {
          "path": "models/video-ai/engines/propainter/weights/ProPainter.pth",
          "bytes": 157780510,
          "sha256": "12c070c4b48f374c91d8a2a17851140b85c159621080989f9e191bbc18bd6591"
        },
        {
          "path": "models/video-ai/engines/propainter/weights/raft-things.pth",
          "bytes": 21108000,
          "sha256": "fcfa4125d6418f4de95d84aec20a3c5f4e205101715a79f193243c186ac9a7e1"
        },
        {
          "path": "models/video-ai/engines/propainter/weights/recurrent_flow_completion.pth",
          "bytes": 20348681,
          "sha256": "22939a1a7900da878dbe1ccd011d646b1bfb30b8290039d8ff0e0c2fefbfd283"
        },
        {
          "path": "models/video-ai/engines/sttn/LICENSE",
          "bytes": 1079,
          "sha256": "150988a0cdb5352aa232ab31507331f73bd1dd8a6e45c9bbe4eca9155ecaf79c"
        },
        {
          "path": "models/video-ai/engines/sttn/PROVENANCE.json",
          "bytes": 1239,
          "sha256": "2de59f7ba1e2635c6322b809367a8147cb5f3fe45e88c7dc787ebe8d2692b17e"
        },
        {
          "path": "models/video-ai/engines/sttn/sequence-bundle.json",
          "bytes": 1698,
          "sha256": "a463ef3477ed831a57f878ff353c6af83891fd242746d053af2785a5baa08f75"
        },
        {
          "path": "models/video-ai/engines/sttn/vendor/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/sttn/vendor/core/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/sttn/vendor/core/spectral_norm.py",
          "bytes": 11942,
          "sha256": "555b77358e434429f27dedcdf4c07db914785767ebcd76e8ffa37d4d390d40cf"
        },
        {
          "path": "models/video-ai/engines/sttn/vendor/model/__init__.py",
          "bytes": 30,
          "sha256": "f35cd89087253da790bfcf4f488fd782d2c77d0597ad839be7d56506a00296b9"
        },
        {
          "path": "models/video-ai/engines/sttn/vendor/model/sttn.py",
          "bytes": 12771,
          "sha256": "35eabef3fe1f2c5d563d68c67876e0d1ef3263e33af575e79e36f04fbddb114f"
        },
        {
          "path": "models/video-ai/engines/sttn/weights/sttn.pth",
          "bytes": 66252587,
          "sha256": "25b0c2c30042d82efd1893bd42ec726764262d94115393a1718f8d65d2a7817b"
        },
        {
          "path": "models/video-ai/ocr/detection/inference.json",
          "bytes": 229777,
          "sha256": "05feef1acb00aa4cd7362b15f7f501fc4f99d7b1fa73c1c871e0c7b1504b0f5c"
        },
        {
          "path": "models/video-ai/ocr/detection/inference.pdiparams",
          "bytes": 4692937,
          "sha256": "afa1820cb16c1fd0dad589d0f8b389139061c1ef6d68019685fd07be997dda5b"
        },
        {
          "path": "models/video-ai/ocr/detection/inference.yml",
          "bytes": 903,
          "sha256": "98069072e1b6b37d727fd9d9f11725faa46d6ea0de012f2ed26caea011c37699"
        },
        {
          "path": "models/video-ai/ocr/recognition/inference.json",
          "bytes": 217724,
          "sha256": "24587345250c7332d0fc6f9a44e794d078cdaeb64c302fef906f325619de2569"
        },
        {
          "path": "models/video-ai/ocr/recognition/inference.pdiparams",
          "bytes": 16458665,
          "sha256": "2460da90875937c94db97eba74ae3d9e5d4c4c57c42f1f41531c09a26bcc771a"
        },
        {
          "path": "models/video-ai/ocr/recognition/inference.yml",
          "bytes": 148345,
          "sha256": "5dfeb2777f6d0db8177d8128a8acfcf6e6276dc4ac73ea3bf0dc06d6a5e85d8e"
        },
        {
          "path": "PROVENANCE.json",
          "bytes": 8786,
          "sha256": "f0460289155d4f8a424eaec81aa76b5546b6aea9784d31e05e83b4a246a5d205"
        },
        {
          "path": "requirements.lock",
          "bytes": 216593,
          "sha256": "0e7fb967e8a5daae9109497b80dc8408fa5aead0cacaffed996f6667a6e93194"
        },
        {
          "path": "scripts/video_ai_device.py",
          "bytes": 2943,
          "sha256": "28648afc81cedfdd49ec80a8704276f9e1aeb6f49f62a57393b651a1f2b284a7"
        },
        {
          "path": "scripts/video_ai_engine_assets.py",
          "bytes": 17499,
          "sha256": "9fc8a836d8d88990248dd6eb16f47541c8916c676ade713ca3d62d17a4b309d2"
        },
        {
          "path": "scripts/video_ai_propainter.py",
          "bytes": 25454,
          "sha256": "c0b57605336fb14e19f1aa744633da5b99ece50b7296e2138a4c33a64d22753b"
        },
        {
          "path": "scripts/video_ai_sequence.py",
          "bytes": 11295,
          "sha256": "b7dbcb25058d19989216acfd5ba3d4701a4f29b5c1839b1a853937a2e544c76d"
        },
        {
          "path": "scripts/video_ai_sttn.py",
          "bytes": 11726,
          "sha256": "f9bae102c9bb4f9f74177471bffdb4188b156ec208e6af9b2449805cbe73f9b1"
        },
        {
          "path": "scripts/video-ai-sequence-support-macos.json",
          "bytes": 5898,
          "sha256": "c78e3cd5adaa022d353166ec4afebde64de578849dea4f70b0df0e9696d63880"
        },
        {
          "path": "scripts/video-ai-worker.py",
          "bytes": 66690,
          "sha256": "c1b993f1d9563a24ca7b8dad419e2358ecda7c96ee6e07c6183922bab1d9abaf"
        },
        {
          "path": "wheelhouse/aiohappyeyeballs-2.7.1-py3-none-any.whl",
          "bytes": 15038,
          "sha256": "9243213661e29250eb41368e5daa826fc017156c3b8a11440826b2e3ed376472"
        },
        {
          "path": "wheelhouse/aiohttp-3.14.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 548067,
          "sha256": "d079c0a0135c36e7beb6f1c88087c8f108dc5891cdd0b5eafa778421bda70ed2"
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
          "path": "wheelhouse/anyio-4.16.0-py3-none-any.whl",
          "bytes": 134521,
          "sha256": "c66ae634e0b8228396b801741beb3294326d4b6102f7bba4041c0dfb58c29026"
        },
        {
          "path": "wheelhouse/astor-0.8.1-py2.py3-none-any.whl",
          "bytes": 27488,
          "sha256": "070a54e890cefb5b3739d19f30f5a5ec840ffc9c50ffa7d23cc9fc1a38ebbfc5"
        },
        {
          "path": "wheelhouse/attrs-26.1.0-py3-none-any.whl",
          "bytes": 67548,
          "sha256": "c647aa4a12dfbad9333ca4e71fe62ddc36f4e63b2d260a37a8b83d2f043ac309"
        },
        {
          "path": "wheelhouse/bce_python_sdk-0.9.79-py3-none-any.whl",
          "bytes": 440268,
          "sha256": "71799ac8740505e0759d30873f6f1a478fa8f83aedf425d511f1419a5f30082e"
        },
        {
          "path": "wheelhouse/certifi-2026.10.23-py3-none-any.whl",
          "bytes": 135082,
          "sha256": "e9b54de76e530bb6cf0ccd036787103acb58fd42ba930ea8bf948ddbaa2f61d1"
        },
        {
          "path": "wheelhouse/cffi-2.1.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 184719,
          "sha256": "f81b3b8f3d4e343550fa4baa0e479bba9f2d29ce9c2e9b51d1ce1718d7442fcf"
        },
        {
          "path": "wheelhouse/chardet-7.7.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1185195,
          "sha256": "7df40e5267a4e9952ecb39cc23109c389fca61fc27a6e807ec9ea894a41e83d7"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.5.2-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 367780,
          "sha256": "ed2a239c0ea213acc1908150a3037257083c7c083128f1a4cec2ec4b97dca491"
        },
        {
          "path": "wheelhouse/click-8.5.1-py3-none-any.whl",
          "bytes": 126163,
          "sha256": "8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37"
        },
        {
          "path": "wheelhouse/colorlog-6.12.0-py3-none-any.whl",
          "bytes": 12239,
          "sha256": "30d392604e9110045a2c2aeefc27d7a017abbab63f3a8aee594eac0801df784e"
        },
        {
          "path": "wheelhouse/crc32c-2.9.post0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 61714,
          "sha256": "b789d6b69c94fed1e119d81905955b9f218434b39e0c197d599a7256e8af7435"
        },
        {
          "path": "wheelhouse/cryptography-50.0.2-cp311-abi3-macosx_11_0_arm64.whl",
          "bytes": 3914904,
          "sha256": "fa8f5efb344d6908a1ce62f4a24e2e5780f825d6f53f5f50ec5ffacac72936cb"
        },
        {
          "path": "wheelhouse/decorator-5.3.1-py3-none-any.whl",
          "bytes": 10365,
          "sha256": "f47fe6fdbd2edd623ecfe36875d37aba411624e2670dd395dddae1358689bb3c"
        },
        {
          "path": "wheelhouse/einops-0.8.1-py3-none-any.whl",
          "bytes": 64359,
          "sha256": "919387eb55330f5757c6bea9165c5ff5cfe63a642682ea788a6d472576d81737"
        },
        {
          "path": "wheelhouse/fastapi-0.141.1-py3-none-any.whl",
          "bytes": 131954,
          "sha256": "bfb91aa2d334c61cb35ba9a116fc123b3d3df31640b801cf57a7a78ec3f603b3"
        },
        {
          "path": "wheelhouse/filelock-4.2.9-py3-none-any.whl",
          "bytes": 164734,
          "sha256": "a379c50a729e5b68c8519a4d26489f755d9769960a236ecd838190e2a78db2e9"
        },
        {
          "path": "wheelhouse/frozenlist-1.8.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 50448,
          "sha256": "f833670942247a14eafbb675458b4e61c82e002a148f49e68257b79296e865c4"
        },
        {
          "path": "wheelhouse/fsspec-2026.9.0-py3-none-any.whl",
          "bytes": 221738,
          "sha256": "8dd6e646e99ea382bd85f97a45e6b526a442d79423a7dc673f1e2756d05fcb5f"
        },
        {
          "path": "wheelhouse/future-1.0.0-py3-none-any.whl",
          "bytes": 491326,
          "sha256": "929292d34f5872e70396626ef385ec22355a1fae8ad29e1a734c3e43f9fbc216"
        },
        {
          "path": "wheelhouse/h11-0.16.0-py3-none-any.whl",
          "bytes": 37515,
          "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"
        },
        {
          "path": "wheelhouse/hf_xet-1.8.0-cp38-abi3-macosx_11_0_arm64.whl",
          "bytes": 3600947,
          "sha256": "3e8934784425781f0f779b91044df441f3a7af4dab47375d7e3aeaecbb8eecb4"
        },
        {
          "path": "wheelhouse/httpcore-1.0.9-py3-none-any.whl",
          "bytes": 78784,
          "sha256": "2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"
        },
        {
          "path": "wheelhouse/httpcore2-2.16.0-py3-none-any.whl",
          "bytes": 85070,
          "sha256": "5c4358319f2602d984ad93182c9fee5160f22e9da7babdda870a5e7c4e2dc34f"
        },
        {
          "path": "wheelhouse/httpx-0.28.1-py3-none-any.whl",
          "bytes": 73517,
          "sha256": "d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"
        },
        {
          "path": "wheelhouse/httpx2-2.16.0-py3-none-any.whl",
          "bytes": 97880,
          "sha256": "fd2c5d7909e8d86fe92d53020c310ca0e4e431b838c207c5754b9bbf0308d49a"
        },
        {
          "path": "wheelhouse/huggingface_hub-2.4.0-py3-none-any.whl",
          "bytes": 857021,
          "sha256": "42ecfd93ede47bdd333daebbf66a32d7bfe2e18752754fe4d2d4f98a0179d801"
        },
        {
          "path": "wheelhouse/idna-3.20-py3-none-any.whl",
          "bytes": 69583,
          "sha256": "ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c"
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
          "path": "wheelhouse/markupsafe-3.0.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 12050,
          "sha256": "0930db9bdc62d22944e10b066448bb65dc9abe9112880c7cab8da54db4284d5f"
        },
        {
          "path": "wheelhouse/modelscope_hub-0.7.0-py3-none-any.whl",
          "bytes": 304179,
          "sha256": "c71dc5cbe24421008171e1d4fc0da49fec7dd81c41ba8b05a70e86064abe3f0e"
        },
        {
          "path": "wheelhouse/modelscope-1.40.3-py3-none-any.whl",
          "bytes": 6062711,
          "sha256": "a2d9e239e58de7c1162da4a54472defb98f4c076900dd7ebfed3370c694e2cb8"
        },
        {
          "path": "wheelhouse/mpmath-1.3.0-py3-none-any.whl",
          "bytes": 536198,
          "sha256": "a0b2b9fe80bbcd81a6647ff13108738cfb482d481d826cc0e02f5b35e5c88d2c"
        },
        {
          "path": "wheelhouse/multidict-7.2.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 103911,
          "sha256": "d37773029ba034a2cc970b6eeb67dad3bff9d894393c51f6bb1c6b4f563a032c"
        },
        {
          "path": "wheelhouse/networkx-3.7-py3-none-any.whl",
          "bytes": 2142205,
          "sha256": "e3fd2c13a7814cee3746340d8d7f8598a67f16a58bf47fb7f8793fab6efca1b0"
        },
        {
          "path": "wheelhouse/numpy-2.3.5-cp312-cp312-macosx_14_0_arm64.whl",
          "bytes": 5088378,
          "sha256": "612a95a17655e213502f60cfb9bf9408efdc9eb1d5f50535cc6eb365d11b42b5"
        },
        {
          "path": "wheelhouse/opencv_contrib_python-4.10.0.84-cp37-abi3-macosx_11_0_arm64.whl",
          "bytes": 63667391,
          "sha256": "ee4b0919026d8c533aeb69b16c6ec4a891a2f6844efaa14121bf68838753209c"
        },
        {
          "path": "wheelhouse/opencv_python_headless-4.11.0.86-cp37-abi3-macosx_13_0_arm64.whl",
          "bytes": 37326460,
          "sha256": "48128188ade4a7e517237c8e1e11a9cdf5c282761473383e77beb875bb1e61ca"
        },
        {
          "path": "wheelhouse/opt_einsum-3.3.0-py3-none-any.whl",
          "bytes": 65486,
          "sha256": "2455e59e3947d3c275477df7f5205b30635e266fe6dc300e3d9f9646bfcea147"
        },
        {
          "path": "wheelhouse/packaging-26.3-py3-none-any.whl",
          "bytes": 129956,
          "sha256": "d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c"
        },
        {
          "path": "wheelhouse/paddleocr-3.7.0-py3-none-any.whl",
          "bytes": 146750,
          "sha256": "c0f0a81ad4112727f30c6fcf986ac0ef6a120d31ee0991a01fae0357ee32d338"
        },
        {
          "path": "wheelhouse/paddlepaddle-3.0.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 96946375,
          "sha256": "8677e8d42ff66f74fbca32ff32d8b64bbe3d56ed29a92d43dc418f0f168fcb69"
        },
        {
          "path": "wheelhouse/paddlex-3.7.2-py3-none-any.whl",
          "bytes": 2239708,
          "sha256": "f1678bf650bbaccfd8f0d4e49d0ae631b4685c829fdae6e802ccd90d4fcb9a7f"
        },
        {
          "path": "wheelhouse/pandas-3.1.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 11173287,
          "sha256": "3b10ae67d301ea84d0969388557cf8b90ea7870def14fd743614bde890104163"
        },
        {
          "path": "wheelhouse/pillow-12.3.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 4780323,
          "sha256": "ffd0c5368496f41b0944be820fcb7a838aa6e623d250b01acf2643939c3f99d7"
        },
        {
          "path": "wheelhouse/prettytable-3.18.0-py3-none-any.whl",
          "bytes": 37357,
          "sha256": "b3346e0e6f79180833aebaac088ae926340586cf6d7d991b9eb125b65f72313a"
        },
        {
          "path": "wheelhouse/propcache-0.5.4-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 52460,
          "sha256": "87a3caecf8095e48dc72f84bfa42e23a848cf410cc9cc13031fba4869b706a21"
        },
        {
          "path": "wheelhouse/protobuf-7.36.2-cp310-abi3-macosx_10_9_universal2.whl",
          "bytes": 456039,
          "sha256": "cbc70b17ee27e28894c7fee8bb04be1abead49e936bc70eb60052531eee2079e"
        },
        {
          "path": "wheelhouse/psutil-7.2.2-cp36-abi3-macosx_11_0_arm64.whl",
          "bytes": 129859,
          "sha256": "1a7b04c10f32cc88ab39cbf606e117fd74721c831c98a27dc04578deb0c16979"
        },
        {
          "path": "wheelhouse/py_cpuinfo-9.0.0-py3-none-any.whl",
          "bytes": 22335,
          "sha256": "859625bc251f64e21f077d099d4162689c762b5d6a4c3c97553d56241c9674d5"
        },
        {
          "path": "wheelhouse/pyclipper-1.4.0-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 265676,
          "sha256": "222ac96c8b8281b53d695b9c4fedc674f56d6d4320ad23f1bdbd168f4e316140"
        },
        {
          "path": "wheelhouse/pycparser-3.12-py3-none-any.whl",
          "bytes": 62600,
          "sha256": "a076f3f489b39b43ed13563a1dafe42447445bec2e294154ec5c57fcdda4c85e"
        },
        {
          "path": "wheelhouse/pycryptodome-4.4.0-cp39-abi3-macosx_10_9_universal2.whl",
          "bytes": 1790964,
          "sha256": "99494a2ab8137a9a6967db30e21f54f6dfa70327d8e72863638dece6d6a16374"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1922874,
          "sha256": "a39ac25a9a2fa4072efdb429833c4a4c8009a51ff9eea3eeae131713cd27991e"
        },
        {
          "path": "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "bytes": 472589,
          "sha256": "346a034f080da3755d8e9cb5e00e8b07de1d39e4f6e2c87d8ab7cafa0b269a73"
        },
        {
          "path": "wheelhouse/pypdfium2-5.15.1-py3-none-macosx_13_0_arm64.whl",
          "bytes": 3710594,
          "sha256": "8cb84f21ed36428ecf483e136ccbe71fc258ee730eae87d69baa3e178e56c8d6"
        },
        {
          "path": "wheelhouse/python_bidi-0.6.12-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 264197,
          "sha256": "ad46555d7d089c51e6b700d615d7eb3ee3dfa9eb792c3620fc94124edce4d8c7"
        },
        {
          "path": "wheelhouse/python_dateutil-4.0.0-py3-none-any.whl",
          "bytes": 92853,
          "sha256": "a5e246f79eb80475e691bf93862cead98decd8a498cf53ba0516fcdc0f50dc1c"
        },
        {
          "path": "wheelhouse/PyYAML-6.0.2-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 173302,
          "sha256": "ce826d6ef20b1bc864f0a68340c8b3287705cae2f8b4b1d932177dcc76721725"
        },
        {
          "path": "wheelhouse/requests-2.34.2-py3-none-any.whl",
          "bytes": 73075,
          "sha256": "2a0d60c172f83ac6ab31e4554906c0f3b3588d37b5cb939b1c061f4907e278e0"
        },
        {
          "path": "wheelhouse/ruamel_yaml-0.19.1-py3-none-any.whl",
          "bytes": 118102,
          "sha256": "27592957fedf6e0b62f281e96effd28043345e0e66001f97683aa9a40c667c93"
        },
        {
          "path": "wheelhouse/scipy-1.17.1-cp312-cp312-macosx_14_0_arm64.whl",
          "bytes": 20344366,
          "sha256": "cc90d2e9c7e5c7f1a482c9875007c095c3194b1cfedca3c2f3291cdc2bc7c086"
        },
        {
          "path": "wheelhouse/setuptools-84.2.1-py3-none-any.whl",
          "bytes": 876263,
          "sha256": "ca140b45d5325a9478f880e351484f62fef15f336462e449ca0c03c873d589c2"
        },
        {
          "path": "wheelhouse/shapely-2.2.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1584868,
          "sha256": "c36ccbff5c3374c349c370bfdac22c7676b268b4a707c98e9031f498965aa02d"
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
          "path": "wheelhouse/torch-2.6.0-cp312-none-macosx_11_0_arm64.whl",
          "bytes": 66532538,
          "sha256": "9a610afe216a85a8b9bc9f8365ed561535c93e804c2a317ef7fabcc5deda0989"
        },
        {
          "path": "wheelhouse/torchvision-0.21.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1784140,
          "sha256": "97a5814a93c793aaf0179cfc7f916024f4b63218929aee977b645633d074a49f"
        },
        {
          "path": "wheelhouse/tqdm-4.70.1-py3-none-any.whl",
          "bytes": 80199,
          "sha256": "c293e525e6fef9c20e8728fd4612df02a0aa31bb5fe91ecd93e123b1b7bffa73"
        },
        {
          "path": "wheelhouse/truststore-0.10.5-py3-none-any.whl",
          "bytes": 19017,
          "sha256": "9aaaedaefaf06d8b206278cf8b5012bc897f485a874503501e12d776df78951c"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.5-py3-none-any.whl",
          "bytes": 14874,
          "sha256": "bc210535442b39e1bf2805e0c7a17dfd6a4ace760c84c7f7d16245d23a6b1c39"
        },
        {
          "path": "wheelhouse/tzdata-2026.6-py2.py3-none-any.whl",
          "bytes": 348210,
          "sha256": "0a10eec6e13ef16b627fabed9a5f2ba61a62b1c67f327305f4e7e412a70b4aec"
        },
        {
          "path": "wheelhouse/ujson-6.1.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 54244,
          "sha256": "dd11ae29a61d0e2844937047eb14a970a790e76d306affc70d661446af4707f9"
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
          "path": "wheelhouse/wcwidth-0.9.4-cp310-abi3-macosx_11_0_arm64.whl",
          "bytes": 618904,
          "sha256": "f279f32c8e206a9092fa350e53ca0c2bd8072e45b1c9fd31bb6d476b59b591c4"
        },
        {
          "path": "wheelhouse/yarl-1.25.1-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 104325,
          "sha256": "e029648f9c951db30e98a7d7ec90835db88ec4b32820efe2a9bdc2287e032eb6"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/bin/python3.12",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "0e7fb967e8a5daae9109497b80dc8408fa5aead0cacaffed996f6667a6e93194",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "MIT components + LicenseRef-S-Lab-1.0 (ProPainter non-commercial research use only)",
        "url": "https://github.com/sczhou/ProPainter/blob/326782529a63d997cab80ab21439b92ed422b3d3/LICENSE"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/video-ai-1.1.0-py312-mps1-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "c3f9088ddfa14427aedb39c4410407706495160dcb17bc3c11831f9a734274c9"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "WoKepIHFsXV08sWq1olQwploixEOKHPwGGEdb0lu/1Ej5qd88MnCArqtT0RsfeVQG3jdRR/fJz1RWUgeL+9dDw=="
    },
    {
      "protocolVersion": 1,
      "id": "video-interpolation",
      "moduleId": "video-interpolation",
      "groupId": "media",
      "displayName": "智能补帧（RIFE）",
      "purpose": "为归档视频编辑提供 RIFE 中间帧生成、慢动作平滑与最高 120 FPS 输出。",
      "dependencyIds": [
        "ffmpeg"
      ],
      "taskToolIds": [
        "media-archive-audio-edit"
      ],
      "installConditions": [
        "程序与 rife-v4.6 模型来自固定上游版本，处理时离线运行，不自动下载模型。",
        "GPU 推理使用 Vulkan；设备资源不足时重试低占用 CPU 模式。无需 CUDA 或 PyTorch 环境。",
        "未安装此能力时仍可使用 FFmpeg 兼容补帧；是否允许 AI 失败后使用兼容引擎由用户设置。"
      ],
      "version": "1.0.0-rife46-20221029-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/video-interpolation-1.0.0-rife46-20221029-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 18499675,
        "sha256": "a0338818293cacb7ab6cd95bd23ce06bcfba9ee61ca345728c5a4616133a4dc6",
        "format": "tar.gz"
      },
      "installedBytes": 150000000,
      "files": [
        {
          "path": "bin/rife-ncnn-vulkan",
          "bytes": 26003696,
          "sha256": "d5f5310d509e93ba62aeeebffbb1c9c7a3ea9db0f2c3a66fbc0eb406f51c47bd",
          "executable": true
        },
        {
          "path": "licenses/LICENSE",
          "bytes": 1072,
          "sha256": "a73beab18143600af0b10c6050a953ec233775ce31c2bf3373a794db535329fd"
        },
        {
          "path": "models/rife-v4.6/flownet.bin",
          "bytes": 10614320,
          "sha256": "f334ed2260149ce0188a6dcf049844e8b0cdd912e01cbcfb63553157d2508958"
        },
        {
          "path": "models/rife-v4.6/flownet.param",
          "bytes": 16532,
          "sha256": "724569596bcd1e7b9fa50455c604777ebed99746d2ef40aa86e31b5725f1053c"
        },
        {
          "path": "upstream.json",
          "bytes": 90,
          "sha256": "0b91e7d47652db6c25febe53430faa70435b914080dbd034ad518c9eb42ab2fb"
        }
      ],
      "license": {
        "name": "MIT",
        "url": "https://github.com/nihui/rife-ncnn-vulkan/blob/master/LICENSE"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/video-interpolation-1.0.0-rife46-20221029-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "169ed36716756e58c2783c7879960ecf0d947fbacd7b439ebc39f1dbb956dcfa"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "k4Gver1nNuW/PdsDs7rwg8qbjPXyrofOAuwTzTjAUyrhwnzdbQeWHJk07AvxkL0KsWJnvbY0LaOstpQFV8OZAQ=="
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
      "version": "2.7-afaf2fb-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/xhs-archive-2.7-afaf2fb-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 30193263,
        "sha256": "81458ad3d702b01dd120ac9f284ff0e181f12b7dd378e69c0dc9822e36363b32",
        "format": "tar.gz"
      },
      "installedBytes": 800000000,
      "files": [
        {
          "path": "requirements.lock",
          "bytes": 97327,
          "sha256": "2cba0ff7855b2da2330398430199957d8557177b57cd937f024a681e22feac2a"
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
          "path": "wheelhouse/cffi-2.0.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 181048,
          "sha256": "8eca2a813c1cb7ad4fb74d368c2ffbbb4789d377ee5bb8df98373c2cc0dee76c"
        },
        {
          "path": "wheelhouse/charset_normalizer-3.4.4-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 208425,
          "sha256": "0a98e6759f854bd25a58a73fa88833fba3b7c491169f86ce1180c948ab3fd394"
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
          "path": "wheelhouse/croniter-6.0.0-py2.py3-none-any.whl",
          "bytes": 25468,
          "sha256": "2f878c3856f17896979b2a4379ba1f09c83e374931ea15cc835c5dd2eee9b368"
        },
        {
          "path": "wheelhouse/cryptography-46.0.4-cp311-abi3-macosx_10_9_universal2.whl",
          "bytes": 7173686,
          "sha256": "281526e865ed4166009e235afadf3a4c4cba6056f99336a99efba65336fd5485"
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
          "path": "wheelhouse/lupa-2.6-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 951707,
          "sha256": "47ce718817ef1cc0c40d87c3d5ae56a800d61af00fbc0fad1ca9be12df2f3b56"
        },
        {
          "path": "wheelhouse/lxml-6.0.2-cp312-cp312-macosx_10_13_universal2.whl",
          "bytes": 8661887,
          "sha256": "a59f5448ba2ceccd06995c95ea59a7674a10de0810f2ce90c9006f3cbc044456"
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
          "path": "wheelhouse/pydantic_core-2.41.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1896003,
          "sha256": "070259a8818988b9a84a449a2a7337c7f430a22acc0859c6b110aa7212a6d9c0"
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
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 173973,
          "sha256": "fc09d0aa354569bc501d4e787133afc08552722d3ab34836a80547331bb5d4a0"
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
          "path": "wheelhouse/rpds_py-0.30.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 359053,
          "sha256": "6abc8880d9d036ecaafe709079969f56e876fcf107f7a8e9920ba6d5a3878d05"
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
          "path": "wheelhouse/websockets-16.0-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 175328,
          "sha256": "86890e837d61574c92a97496d590968b23c2ef0aeb8a9bc9421d174cd378ae39"
        },
        {
          "path": "wheelhouse/zipp-3.23.0-py3-none-any.whl",
          "bytes": 10276,
          "sha256": "071652d6115ed432f5ce1d34c336c0adfd6a884660d1e9712a256d3d3bd4b14e"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/bin/python3.12",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "2cba0ff7855b2da2330398430199957d8557177b57cd937f024a681e22feac2a",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "GPL-3.0",
        "url": "https://www.gnu.org/licenses/gpl-3.0.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/xhs-archive-2.7-afaf2fb-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "ffa3f6ef05e8d31f7176bba4757d1a6a862f9210c5ac5092b6827132f39f93a9"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "z3Hb1LFF59Hjtf3GlpOaiXOIPtgt3GiaBgULe4XwHdR0Hw4xIST2XZyqL8JkPRVlVdr0/bTxzSLX+oZd/T/kCw=="
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
      "version": "1.63.0-chromium-1243-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/xhs-browser-1.63.0-chromium-1243-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 182442328,
        "sha256": "f5121c9146699ddb009341ffeb2eb4f267de0db459edfe10043306decf7af121",
        "format": "tar.gz"
      },
      "installedBytes": 500000000,
      "files": [
        {
          "path": "browser/browser-launcher.json",
          "bytes": 110,
          "sha256": "0e1d7d3c79e61fa815c9579e0bd06251fa0f927102c6a117a5e81e84d6e2f962"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/_CodeSignature/CodeResources",
          "bytes": 24268,
          "sha256": "480e0561d28c78e077e494b332670f483b28bb428f0e5dce246b1ebe26bcf642"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/_CodeSignature/CodeResources",
          "bytes": 90217,
          "sha256": "7bef611bdc59fdc6db42b03fa25013cefa6fa85d314d77ea24f620a68cf9d754"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Google Chrome for Testing Framework",
          "bytes": 246092400,
          "sha256": "a63d59c034a8b49a113dd765ff16229ca69af35040f0b9775eb757a9c7688857",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/app_mode_loader",
          "bytes": 1027312,
          "sha256": "b6cb069172a2fa52181192c2aac76b59967f4ae94f7aa6557c160a3adb7d3029",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/chrome_crashpad_handler",
          "bytes": 1593472,
          "sha256": "6c4f374f369e9b610819e8ac9f2802a34c7bc01abe4a79e372cc9140b10a8e56",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/_CodeSignature/CodeResources",
          "bytes": 3035,
          "sha256": "20018074a922b7f79cabf242ef26ab7ddbbe4e0f169ca3a7f2427db691db0073"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/Info.plist",
          "bytes": 1905,
          "sha256": "6e56d3dbc07b38d64b3055a6e36fda359c47c9a847d51afcdc20188950845f52"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/MacOS/Google Chrome for Testing Helper (Alerts)",
          "bytes": 87952,
          "sha256": "d11d6e0db18c83b7bbbf85e4f3a713725b3134677fbe011a20b5e0ea459e64f5",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/Resources/app.icns",
          "bytes": 94689,
          "sha256": "3be5d5276c19c48925acc2c6a7896ce238d73b1ca8b74c30724799e2d28223ae"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/Resources/Assets.car",
          "bytes": 1362712,
          "sha256": "e70466610b4bdbb61098baf07d342e8e21a67c34cfd2c53e400d3e588ed2cc4c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Alerts).app/Contents/Resources/base.lproj/InfoPlist.strings",
          "bytes": 96,
          "sha256": "b978a9cb5bd3109d3198f4f8387517511326986f2549b2a5bb968816f61ebda0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/_CodeSignature/CodeResources",
          "bytes": 3035,
          "sha256": "20018074a922b7f79cabf242ef26ab7ddbbe4e0f169ca3a7f2427db691db0073"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/Info.plist",
          "bytes": 1932,
          "sha256": "4afa80a05c03a542af26ae71dfcdd1aeb2f1083d6bbdfef87ac32495f7b63682"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/MacOS/Google Chrome for Testing Helper (Aperitif Alerts)",
          "bytes": 51744,
          "sha256": "bb24eaf7f12cc717991b17142889048e990a6a4debe502dc6386d36eb164ec75",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/Resources/app.icns",
          "bytes": 94689,
          "sha256": "3be5d5276c19c48925acc2c6a7896ce238d73b1ca8b74c30724799e2d28223ae"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/Resources/Assets.car",
          "bytes": 1362712,
          "sha256": "e70466610b4bdbb61098baf07d342e8e21a67c34cfd2c53e400d3e588ed2cc4c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Alerts).app/Contents/Resources/base.lproj/InfoPlist.strings",
          "bytes": 96,
          "sha256": "b978a9cb5bd3109d3198f4f8387517511326986f2549b2a5bb968816f61ebda0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif GPU).app/Contents/_CodeSignature/CodeResources",
          "bytes": 2200,
          "sha256": "6686de10a28a2fe11b36cbb86dcbacc827cfc4ea116b4dabf1845e5aee629e9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif GPU).app/Contents/Info.plist",
          "bytes": 1606,
          "sha256": "9b36e299406c05ed06fc52da812204008861b3fb6dab9ef16d8bc0d9c489d334"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif GPU).app/Contents/MacOS/Google Chrome for Testing Helper (Aperitif GPU)",
          "bytes": 51712,
          "sha256": "e1844dbdef20a20b4d47d5632cf67a4e521c8699c6a8c79c727fd564028fccf6",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif GPU).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Renderer).app/Contents/_CodeSignature/CodeResources",
          "bytes": 2200,
          "sha256": "6686de10a28a2fe11b36cbb86dcbacc827cfc4ea116b4dabf1845e5aee629e9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Renderer).app/Contents/Info.plist",
          "bytes": 1630,
          "sha256": "5f250733ae64bb63ede1556fbf68ad9ac24c7b6079bae0c625827e157894f676"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Renderer).app/Contents/MacOS/Google Chrome for Testing Helper (Aperitif Renderer)",
          "bytes": 51712,
          "sha256": "177a22323e7a32987dcbd3654da7ceb61e3be30eb196437aeac2783078902eb7",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif Renderer).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif).app/Contents/_CodeSignature/CodeResources",
          "bytes": 2200,
          "sha256": "6686de10a28a2fe11b36cbb86dcbacc827cfc4ea116b4dabf1845e5aee629e9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif).app/Contents/Info.plist",
          "bytes": 1594,
          "sha256": "b4c2ea501c08684729822a22955fc9185f674c7253535586fd34c6dcec817ec7"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif).app/Contents/MacOS/Google Chrome for Testing Helper (Aperitif)",
          "bytes": 51712,
          "sha256": "67c697ff34556ef07100cc9ed06cb232132b71b33f4248597a32cc27d878e338",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Aperitif).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (GPU).app/Contents/_CodeSignature/CodeResources",
          "bytes": 2200,
          "sha256": "6686de10a28a2fe11b36cbb86dcbacc827cfc4ea116b4dabf1845e5aee629e9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (GPU).app/Contents/Info.plist",
          "bytes": 1579,
          "sha256": "94bb98d8698b723dd29b3860aeff2605d793f2ded32fd06d07e1a75dd19fd3d7"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (GPU).app/Contents/MacOS/Google Chrome for Testing Helper (GPU)",
          "bytes": 87920,
          "sha256": "53baa3c1434ec219e5dfb4d36849958f36cdd376bf24fdf0f6a89a312419f020",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (GPU).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Renderer).app/Contents/_CodeSignature/CodeResources",
          "bytes": 2200,
          "sha256": "6686de10a28a2fe11b36cbb86dcbacc827cfc4ea116b4dabf1845e5aee629e9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Renderer).app/Contents/Info.plist",
          "bytes": 1603,
          "sha256": "042db49efa9827bbc6523dbc7d0f5e97dbd7e47b14f1efefc428054083b80667"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Renderer).app/Contents/MacOS/Google Chrome for Testing Helper (Renderer)",
          "bytes": 87920,
          "sha256": "321f8ea5f38f68a43b15d09934e47bc795eacb67dd414efed27afa8097ca4a00",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper (Renderer).app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper.app/Contents/_CodeSignature/CodeResources",
          "bytes": 2200,
          "sha256": "6686de10a28a2fe11b36cbb86dcbacc827cfc4ea116b4dabf1845e5aee629e9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper.app/Contents/Info.plist",
          "bytes": 1561,
          "sha256": "52494f768a0de269d4bc10daeccb378881804cfd1f2f88a4db8cf55f0c292746"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper.app/Contents/MacOS/Google Chrome for Testing Helper",
          "bytes": 87920,
          "sha256": "2a12351ebba5c31f6b57f4571afb3e4190cbfffaf763d585572f00b9f6952d17",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/Google Chrome for Testing Helper.app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "82502191c9484b04d685374f9879a0066069c49b8acae7a04b01d38d07e8eca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Helpers/web_app_shortcut_copier",
          "bytes": 51632,
          "sha256": "935216f0144f8cae0ca2d42b8410a304ef4e0f7696b8c5ac1519ca7c09ff6d97",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/IwaKeyDistribution/iwa-key-distribution.pb",
          "bytes": 3519,
          "sha256": "cf2be19520e0398b4b0ef38bef4940102bc9133d913dc990753cf2a38296e317"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/IwaKeyDistribution/manifest.json",
          "bytes": 113,
          "sha256": "4ad5de58e7812aa71fa80dcf959f6dcd97a2b82f5319558d69d9860a95efc97e"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/libaperitif.dylib",
          "bytes": 69760,
          "sha256": "ce1aba3e6bf8b564b018b9669ad20c5ff4a2086a65c95d70e628bd78db55fdb9",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/libvk_swiftshader.dylib",
          "bytes": 16376112,
          "sha256": "a992e2126966d15be0345d1bc59abb7ca61cc0072f8bba57e052bd0b6026d81c",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/libvulkan.dylib",
          "bytes": 499472,
          "sha256": "b2f0778061f6bf9619404ff79c813454175787d562cbf3fb2c7ae7615e0bc1fc",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/MEIPreload/manifest.json",
          "bytes": 238,
          "sha256": "44844cf3dde6e80087ae0e6bf0d9326d7ef7d23326d24ac83af0850be26923d2"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/MEIPreload/preloaded_data.pb",
          "bytes": 8254,
          "sha256": "c6070a157b4e28d16fbccbd233e93846ddb070c85e1a1bc64469b7a5f1424fad"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/PrivacySandboxAttestationsPreloaded/manifest.json",
          "bytes": 122,
          "sha256": "51c311a4ba03140bcd1c827f8d93dba50cadda736925903b26e95609275dbffd"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/PrivacySandboxAttestationsPreloaded/privacy-sandbox-attestations.dat",
          "bytes": 7624,
          "sha256": "59e345dc13aedee9ea46b92e58300ecaca944aaea9384c7af885400ac2ae8806"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/vk_swiftshader_icd.json",
          "bytes": 110,
          "sha256": "d717d915e31e7c27948b80b36ab34e2d897888114c5c7d0af835f93eb53e58f5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/WidevineCdm/_platform_specific/mac_arm64/libwidevinecdm.dylib",
          "bytes": 20416896,
          "sha256": "e1e9f6b0c77f4251542a2f49dda419c85eda88c5d9ef2721d5d594dc195a6e5f"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/WidevineCdm/LICENSE",
          "bytes": 473,
          "sha256": "20de375707692099b3132084695377ce5fec0aec05813dedcce094b8eda44386"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Libraries/WidevineCdm/manifest.json",
          "bytes": 833,
          "sha256": "620fadefec2d3e2351720ca916f674752869d88d18c3886bc268cd1522726277"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/af_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/af_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/af_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/af.lproj/locale.pak",
          "bytes": 625231,
          "sha256": "afa9f19aa751f5c50370ee113edee543cdc9204fe9795be7c508fdadd178eab7"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/am_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/am_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/am_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/am.lproj/locale.pak",
          "bytes": 1011458,
          "sha256": "8e9a7fa3ec39e289a4a613c95fc56258f22cea016b7c9fe32cfcd1739349228a"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/app_mode-Info.plist",
          "bytes": 1599,
          "sha256": "e4429cf1cc8a8fb93189790aa004463977980546f46e70465ee2e49c27f0e8f4"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ar_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ar_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ar_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ar.lproj/locale.pak",
          "bytes": 1123404,
          "sha256": "aefce838f193f61a3a3159f1b664f1a20884bf44f65ea9e697f75123b0bf41a7"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bg_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bg_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bg_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bg.lproj/locale.pak",
          "bytes": 1159125,
          "sha256": "1ca55021156905a1c8cbee72b24879c607736673fb12ab53894c00ef6d7d410b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bn_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bn_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bn_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/bn.lproj/locale.pak",
          "bytes": 1483357,
          "sha256": "d99bf1038a811ce82b77710b0e4ce01d6434ac216087eb2082c430ca05920c05"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ca_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ca_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ca_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ca.lproj/locale.pak",
          "bytes": 714311,
          "sha256": "97362012a2280971cd5c6715773d1f643d6050b90931ca2204641005fb734206"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/chrome_100_percent.pak",
          "bytes": 680751,
          "sha256": "cbf4b4968a6e05428b6de4f7b42865f9f9d11050029f35dbed46aa4654048146"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/chrome_200_percent.pak",
          "bytes": 1354433,
          "sha256": "b9d07f24416af627c19f2406657eecc6a5ee14b3387de3b162a7a5ab4451d7b3"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/cs_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/cs_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/cs_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/cs.lproj/locale.pak",
          "bytes": 734549,
          "sha256": "44b74bc49de46ae97a402b295c68594111cb8cbff4a3c7b7fcb7eab1a0f3c4c5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/da_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/da_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/da_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/da.lproj/locale.pak",
          "bytes": 660419,
          "sha256": "44d7691f52eece131a5153de70fa40ee9e381a02d31c97e25bff1cc2f184a2df"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/de_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/de_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/de_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/de.lproj/locale.pak",
          "bytes": 716122,
          "sha256": "62ccde7edc8995bde1b1e0db2254fc3243d845d032f21d44c16044b7e363c941"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/el_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/el_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/el_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/el.lproj/locale.pak",
          "bytes": 1272374,
          "sha256": "cd38bfe6497a85aa01410f362319aff7d7d50a3d3e8cfa1e47326564c157ffb2"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_GB_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_GB_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_GB_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_GB.lproj/locale.pak",
          "bytes": 572008,
          "sha256": "fcf01ae38acb892503bd733ec0e225bf4e9eac67aa6137779735e6b7b0c725b5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/en.lproj/locale.pak",
          "bytes": 580153,
          "sha256": "58f3093e202dbddd2b580bc91a2d69619d4eab3806fbeb3196a8b318cfc1f53a"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_419_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_419_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_419_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_419.lproj/locale.pak",
          "bytes": 700260,
          "sha256": "3e25f1054c0aadef1288c47ee19cf791859f2c9acf69c2f3941995bfe8a6f57b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/es.lproj/locale.pak",
          "bytes": 694580,
          "sha256": "e807e1b2f66d747a5a19615a6837304aa6c38e30a691a8b078e62986ead4ddbd"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/et_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/et_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/et_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/et.lproj/locale.pak",
          "bytes": 636666,
          "sha256": "533ce0cff9b96b1b456ed08a844ca3323a4b4ca253210496cec9a21fa32a3def"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fa_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fa_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fa_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fa.lproj/locale.pak",
          "bytes": 1047177,
          "sha256": "90852bffcfd7f1a2f74f117991229af806d2b6a2b28245617f14d094a3be4bda"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fi_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fi_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fi_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fi.lproj/locale.pak",
          "bytes": 647501,
          "sha256": "2581c052fc4ddd585c1863cc74a31172e821de86a02d4d4e6cb2c60da9fe8f9b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fil_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fil_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fil_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fil.lproj/locale.pak",
          "bytes": 732364,
          "sha256": "361a2b90018bc3eeb6a17500c0fbb24b2cac6a83ed683dd2f799aeabd234a1e8"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fr_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fr_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fr_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/fr.lproj/locale.pak",
          "bytes": 759116,
          "sha256": "f2de0191978edc53586b9e002219cd5627c7d8424db67715f5f51f2ec25dc006"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/gpu_shader_cache.bin",
          "bytes": 968826,
          "sha256": "d3fc3a27c1d9a651f5d470e0f6ef2e06094ec5ad58c68b497b22b312442fdb8d"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/gu_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/gu_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/gu_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/gu.lproj/locale.pak",
          "bytes": 1469797,
          "sha256": "d041a7f87e1175c995635da8f43501a90bfb729fae730ac9741b56e5fb4c6429"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/he_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/he_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/he_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/he.lproj/locale.pak",
          "bytes": 918808,
          "sha256": "2006b98fc21a62592d08fc0148b683cd96f8c81228e823f2c93dc3c283c7c36e"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hi_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hi_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hi_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hi.lproj/locale.pak",
          "bytes": 1565450,
          "sha256": "948dc5cebc9b66a630f6e0358f8b6199b2024a21de2d7c15667f9d499b98e93f"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hr_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hr_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hr_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hr.lproj/locale.pak",
          "bytes": 706085,
          "sha256": "e9c0cfee7f0ecb1a4d52cf24352e7e6a3f6d56b2fccb15396deae4509c71d3b0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hu_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hu_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hu_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/hu.lproj/locale.pak",
          "bytes": 755228,
          "sha256": "028c07bd0298e9b1a95c6dec68214ff20e462f272f0de23a6819d9c9c756a694"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/icudtl.dat",
          "bytes": 10823536,
          "sha256": "a3c6d7824935e87fed17e94c2d84b7683ef360ebc5c4ea92e2ca70f361bc9314"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/id_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/id_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/id_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/id.lproj/locale.pak",
          "bytes": 628605,
          "sha256": "b535e526ea3cec7b7a1198b3993087d3563bbf02ddcb0e02ca89852bb44ed739"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/Info.plist",
          "bytes": 1098,
          "sha256": "e5edd40ee378b93da927d87f6de4fec953f0eaa18fba4e51f102f92042168dd6"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/install.sh",
          "bytes": 6377,
          "sha256": "1b541faca17a7a1a124d9e288fd27bf66785f3667d788243383ab17700489b69",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/it_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/it_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/it_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/it.lproj/locale.pak",
          "bytes": 691059,
          "sha256": "1214012eed34ca730af5e571d47cd5c4c730cdb02db2e387795e9b5605ae00a3"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ja_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ja_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ja_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ja.lproj/locale.pak",
          "bytes": 836314,
          "sha256": "6781e27565533c197abb0b1c4f94e37cfbcad8e8b8801c4b9f123f1102da95dd"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/kn_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/kn_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/kn_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/kn.lproj/locale.pak",
          "bytes": 1686096,
          "sha256": "de0a1ab8428c90d0a21cc418c59ed917ea9ebf1837f1660e9dfcfb240cd91aa3"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ko_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ko_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ko_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ko.lproj/locale.pak",
          "bytes": 710892,
          "sha256": "a72d6ad133dc7b16787e0f2c58b8803507862a3b401cf20e849d28625038355e"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lt_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lt_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lt_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lt.lproj/locale.pak",
          "bytes": 769932,
          "sha256": "34c1caa4937d50f144cc40eebd1637dc8eeba195e617c7b960dd85fa470e130d"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lv_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lv_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lv_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/lv.lproj/locale.pak",
          "bytes": 766707,
          "sha256": "c2b74312b7fb60740e8c6a5bbde1f104a759598f151d4ae4f4514317880d1830"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ml_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ml_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ml_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ml.lproj/locale.pak",
          "bytes": 1733550,
          "sha256": "558481ba24300b5c52ac109e8322ae77a1595be1aa6a1ddbf25984089d984618"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/mr_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/mr_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/mr_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/mr.lproj/locale.pak",
          "bytes": 1436175,
          "sha256": "0379f77ecc226c66408f49176eb230ccc1052fa076280f3302935ac299096af5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ms_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ms_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ms_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ms.lproj/locale.pak",
          "bytes": 660241,
          "sha256": "179f0890a895e08cede8a37a4e06bfc8dcae40b54a02ec12756a2a00f61d545b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nb_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nb_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nb_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nb.lproj/locale.pak",
          "bytes": 628945,
          "sha256": "ec0a012d030800bb7975b0a474abf81a65347a135ad11fd023757080bae582c6"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nl_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nl_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nl_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/nl.lproj/locale.pak",
          "bytes": 655924,
          "sha256": "85e68cfdab2e71a521154d372523551e5d05d5190c7586acd336c969201a839f"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pl_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pl_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pl_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pl.lproj/locale.pak",
          "bytes": 734450,
          "sha256": "b3deafa84a745fc741daf8d6f4a687955ca018ea994bd98ee91e31eb956beb48"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/product_logo_32.png",
          "bytes": 2018,
          "sha256": "ae841ee4a539c13ac00e29c6e0f85369f2e280b22659a876093bd61cd34be172"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_BR_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_BR_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_BR_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_BR.lproj/locale.pak",
          "bytes": 688065,
          "sha256": "fd687bebb21efd2dddf7e3524da7cb1686ab6a20d109b4ced0718201f6f9090c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_PT_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_PT_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_PT_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/pt_PT.lproj/locale.pak",
          "bytes": 692176,
          "sha256": "8b983809e6890a31a16b82454eb988baeaf52a36831b32ab9c4435a57914f87d"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/resources.pak",
          "bytes": 19490972,
          "sha256": "4a2955e9c0ace1b6993330ed8e725557379973d93f91ee19daa6e2c5306170bf"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ro_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ro_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ro_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ro.lproj/locale.pak",
          "bytes": 717176,
          "sha256": "d7bb9c4dd42771b0391d53512240deea90b453f164927ba73faaadece64cb37b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ru_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ru_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ru_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ru.lproj/locale.pak",
          "bytes": 1183974,
          "sha256": "2b89b1c8b1241297b951fb077e86d98876865d47b9d2ffa6fba8ec0dd51e4fcd"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sk_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sk_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sk_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sk.lproj/locale.pak",
          "bytes": 746517,
          "sha256": "53401a5fae57dfc98f3cd2dbe9b32be10116ad225759c18cefcc6d25e9a77d10"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sl_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sl_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sl_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sl.lproj/locale.pak",
          "bytes": 713025,
          "sha256": "13edac533517735463306cc0560b940eea18c229e981b348c8dcd43684a1ffbb"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sr_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sr_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sr_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sr.lproj/locale.pak",
          "bytes": 1094505,
          "sha256": "5737976b35d13c5cf2b4785dc9306727c0380be041f5fafad3d06040dd15da98"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sv_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sv_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sv_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sv.lproj/locale.pak",
          "bytes": 639178,
          "sha256": "fcfc91c9faeefdad121547d07d2157c86c18e4124840e90f6505e211d6541713"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sw_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sw_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sw_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/sw.lproj/locale.pak",
          "bytes": 677451,
          "sha256": "85ea39e49f83cbb2d187a9790541ba05dfaabb67f857b97b86259f75060f02ab"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ta_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ta_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ta_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ta.lproj/locale.pak",
          "bytes": 1724136,
          "sha256": "045f4eb37d5f78ee5f29d42d8c75254bd963581cebbd4417c915adf8140203ca"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/te_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/te_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/te_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/te.lproj/locale.pak",
          "bytes": 1598718,
          "sha256": "8f2e1afd8c9772bf30def544e21165136ed6f347cbf5ffa1e20912df667476fa"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/th_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/th_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/th_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/th.lproj/locale.pak",
          "bytes": 1337013,
          "sha256": "e99b1c16f829cc428640976b45a1b7c489792d4610d52fc70da7541b11a5e444"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/tr_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/tr_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/tr_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/tr.lproj/locale.pak",
          "bytes": 689804,
          "sha256": "f2ff88209524f2563f03d7b2f537a740eeda86c7959eaab9b8544aa47e622d59"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/uk_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/uk_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/uk_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/uk.lproj/locale.pak",
          "bytes": 1193534,
          "sha256": "52edd38d742af5e7a149e31ef4f89475961e5692cee20a652d579a59aa1548e0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ur_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ur_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ur_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/ur.lproj/locale.pak",
          "bytes": 1025305,
          "sha256": "82e7f145e18328133e6702de4865ab3c9fcb1eecb0268453990335b609be366b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/v8_context_snapshot.arm64.bin",
          "bytes": 747232,
          "sha256": "f98e96bc94b1e28bb9af13e7efdf52435a481b917559dc1b68e6c9305f6ec720"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/vi_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/vi_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/vi_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/vi.lproj/locale.pak",
          "bytes": 817228,
          "sha256": "6d8afe2122914a3f798243775a6f167dc77e85fefabdcde2bfd41c662e3c65d8"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_CN_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_CN_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_CN_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_CN.lproj/locale.pak",
          "bytes": 587411,
          "sha256": "5b961e59dae49506004a5d1e2887f89438b651d45f224f54e8720548f95afa19"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_TW_FEMININE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_TW_MASCULINE.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_TW_NEUTER.lproj/locale.pak",
          "bytes": 18,
          "sha256": "ca73097bd968b363b7145e86b64f3c595e533808b0763dc8863a27fc363cfa51"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/153.0.8010.12/Resources/zh_TW.lproj/locale.pak",
          "bytes": 580695,
          "sha256": "f3b37f25e73d4dcd5f5d5bce4982314e970c58cba260c690268cd60c7bab01b2"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Info.plist",
          "bytes": 18239,
          "sha256": "cccac1e14b0e8ce0db816d5dda95ab102a56c5c6b6739ce3352f5ed5ea8a243b"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
          "bytes": 70240,
          "sha256": "723e6a2bf4e2aee5cc32ccc095451dbaaa956c52ec98d8da339accaec71141e2",
          "executable": true
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/PkgInfo",
          "bytes": 8,
          "sha256": "2e923178639849f5232473c3ae9fa451a9df4bc41751b2bf2d40045bc13ddcff"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/af.lproj/InfoPlist.strings",
          "bytes": 1076,
          "sha256": "02227de854f5c9829e46ccfeb7f63c8216a903bca8126c93823b89533717ea2a"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/am.lproj/InfoPlist.strings",
          "bytes": 1726,
          "sha256": "4a3f63dae239d23705975acea8a10ed39b1998bb1762c9f891cfebe91ea178a2"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/app.icns",
          "bytes": 94689,
          "sha256": "3be5d5276c19c48925acc2c6a7896ce238d73b1ca8b74c30724799e2d28223ae"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ar.lproj/InfoPlist.strings",
          "bytes": 1971,
          "sha256": "a6d96c509ddf42d089ee431988898ea28d4e62b9c14def018d1ca09919009e21"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/Assets.car",
          "bytes": 1362712,
          "sha256": "e70466610b4bdbb61098baf07d342e8e21a67c34cfd2c53e400d3e588ed2cc4c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/bg.lproj/InfoPlist.strings",
          "bytes": 1776,
          "sha256": "e251946be05b1070dee3f265c0b7d32cd939bf40a75046c2f31b32127d4da24f"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/bn.lproj/InfoPlist.strings",
          "bytes": 2299,
          "sha256": "78ed0ac72136e190fbe7aed8cbf7495a01737a35352303afad5286ac859cc286"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ca.lproj/InfoPlist.strings",
          "bytes": 1138,
          "sha256": "55ce3ef2ab3ac671d59c9cd224e391618f4e98a7e7ca3dd2ad8f68a7d44006a5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/com.google.chrome.for.testing.manifest/Contents/Resources/com.google.chrome.for.testing.manifest",
          "bytes": 173989,
          "sha256": "bac2704000370920247170201df12d627f1441ca7b26a5c331a7cec878cea443"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/com.google.chrome.for.testing.manifest/Contents/Resources/en.lproj/Localizable.strings",
          "bytes": 382096,
          "sha256": "09b9dd7f6bc5ae3eb07b12fb7606d9dcc4b585813dda9d1936dec1ae6465229e"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/cs.lproj/InfoPlist.strings",
          "bytes": 1195,
          "sha256": "d7b10fcc2ef1193b76588581a62c9bc4b68cdac99a37153f4ba0979cc0118348"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/da.lproj/InfoPlist.strings",
          "bytes": 1062,
          "sha256": "871524e862ef49accfdcfc39cbc8b1a2a653096a7d5c0381dd4807a3a7e7822e"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/de.lproj/InfoPlist.strings",
          "bytes": 1128,
          "sha256": "d9a98ca65f82b8690730e649c56a4ff6ff136f2039f2cc1859bc37c3434f7566"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/el.lproj/InfoPlist.strings",
          "bytes": 1963,
          "sha256": "dd0636fabbfcf0ca4de7556ebd859798c833d41e1bcecc25fc32708aab967aa0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/en_GB.lproj/InfoPlist.strings",
          "bytes": 1119,
          "sha256": "856af00b2f3c28e30846d21fe98766e4ce38d0da34fd57fa6fac618a90d7c5e9"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/en.lproj/InfoPlist.strings",
          "bytes": 1119,
          "sha256": "8d3e9f197d543ea031a0d0706c7f4a7e76c879c3faa77768d282b01adf9c5b04"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/es_419.lproj/InfoPlist.strings",
          "bytes": 1203,
          "sha256": "bde55d41e980e8293e052841c4ae0d45e018d0cf9faafd8553012c9acf442206"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/es.lproj/InfoPlist.strings",
          "bytes": 1219,
          "sha256": "538466f1b5ce800fb62e552d28ba2b81917fb7464cdc2c82a7c6cae772b9ffce"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/et.lproj/InfoPlist.strings",
          "bytes": 1268,
          "sha256": "9846d944cf9705799b076e1733069d000691c50b23c75c795ba87f8ccf4be8fc"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/fa.lproj/InfoPlist.strings",
          "bytes": 1799,
          "sha256": "501164c57cda85ede28d0e401d0741c1b657b8c7c34df16f6a7bfd87907a0ef1"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/fi.lproj/InfoPlist.strings",
          "bytes": 1187,
          "sha256": "03886853dcada778ff4abba96f8dfe73d74bfc1aa2882e6dc0ea8597ce48e905"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/fil.lproj/InfoPlist.strings",
          "bytes": 1294,
          "sha256": "ab7a609207c556fee9690c98a342ee01db3ff875b33d15d7bc6e10de23cf7214"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/fr.lproj/InfoPlist.strings",
          "bytes": 1496,
          "sha256": "14ffdfc83f419ee39daec421730a291dcdcda5ef6e4dbd0a5651f99f9f71ee42"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/gu.lproj/InfoPlist.strings",
          "bytes": 2098,
          "sha256": "987f97136cffaa1ab32cdfccddaa783ef2c915b43a32bcb541f307c4ad0c3e95"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/he.lproj/InfoPlist.strings",
          "bytes": 1330,
          "sha256": "d529e1dcf25ed1fbd4b229bb132b0647f36f43947f9a69509e4cf55cb762402c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/hi.lproj/InfoPlist.strings",
          "bytes": 2138,
          "sha256": "c6a26eaf3127e323962052923bcd7506b7093ab4b75a6c6dd2d9d2a4690c5a78"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/hr.lproj/InfoPlist.strings",
          "bytes": 1164,
          "sha256": "d9d198f91f54c9f437fb9af81462b6d9fe65048cd458d9e45dca773a62d8c403"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/hu.lproj/InfoPlist.strings",
          "bytes": 1319,
          "sha256": "0cf68ae57aba14d9d493dbfd8c7ff163ed042f9b52e0c77e777abc9109b18ca0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/id.lproj/InfoPlist.strings",
          "bytes": 1179,
          "sha256": "3e05c633b722d47bf9f1da3c22eb4ebc0f053f0974d5984c54d5d67239a52b97"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/it.lproj/InfoPlist.strings",
          "bytes": 1243,
          "sha256": "264a797e15e23e0d06d508d64374a7e8c870c0f11afd1768063de5ad205daf55"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ja.lproj/InfoPlist.strings",
          "bytes": 1608,
          "sha256": "e10583ad9f6aa38d8f19fc0860966889e2fbe0241f424ea2a5c10b5db3e884c9"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/kn.lproj/InfoPlist.strings",
          "bytes": 2829,
          "sha256": "d63f11576ceaa4a249d56c994e88aa5c17ef97010286d24a053d84dba9ff5486"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ko.lproj/InfoPlist.strings",
          "bytes": 1478,
          "sha256": "b877507f261b78f3009e316408e4c566eb0fc1d396d4697ee8fa0c3a2450bea1"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/lt.lproj/InfoPlist.strings",
          "bytes": 1471,
          "sha256": "ab718839e86f4b34589e8dd6b4db70acc70ed44541a6be5f718da781a011da99"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/lv.lproj/InfoPlist.strings",
          "bytes": 1283,
          "sha256": "519443f058265718723dc68df9c384527310e1cb92f6d6fbe781d7697855bc3a"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ml.lproj/InfoPlist.strings",
          "bytes": 2711,
          "sha256": "c165dcca86deac19c6f1ff85111ae57db1b3b11517c29d0d734ef5835d0a6b9c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/mr.lproj/InfoPlist.strings",
          "bytes": 2184,
          "sha256": "c79bb2bff1918cccb3a3938ffae32c5be084b1c84770e8ceeaf1beba308405b5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ms.lproj/InfoPlist.strings",
          "bytes": 1276,
          "sha256": "0e3f193d48bb4ab584e3cf1c9fdbb6fea995e34ad014da908aa0a36f1129687c"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/nb.lproj/InfoPlist.strings",
          "bytes": 1108,
          "sha256": "9e2a7de5ae1476e3dbed2ef4b615a8b17c475d7338db57b9acac4994a949a333"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/nl.lproj/InfoPlist.strings",
          "bytes": 1111,
          "sha256": "1b792075d62a5960039aa049b7b2348e24a74ea88fbb6531ced2990b6c795fa6"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/pl.lproj/InfoPlist.strings",
          "bytes": 1213,
          "sha256": "7c332eee9e3f09e830c9d384d6522652d1d058d5c711d6ed4e1c3d8da7bbadc5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/pt_BR.lproj/InfoPlist.strings",
          "bytes": 1141,
          "sha256": "6851a0af4dbe2431465ba9cbf8712331246a6748d42e6d6d147f724bfe041f01"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/pt_PT.lproj/InfoPlist.strings",
          "bytes": 1213,
          "sha256": "3809bc9e8ec6f0bb8a1fa32a6d8226455fac32782dc4fd6b68adb64746babddf"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ro.lproj/InfoPlist.strings",
          "bytes": 1236,
          "sha256": "efc85030711d839b6691b1d98f593c36274e2ca23b335c037cdf8386cb2a8c24"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ru.lproj/InfoPlist.strings",
          "bytes": 1774,
          "sha256": "28f16c35bf419db0f929c0214f0b2574fed9e11602246616383f96d5c4d7e009"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/scripting.sdef",
          "bytes": 16777,
          "sha256": "cd0453c2e166a0b664f8ea1d1ac04b53a54eed14835569b6104a7823dbb950f2"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/sk.lproj/InfoPlist.strings",
          "bytes": 1163,
          "sha256": "8d423094891f98392e086968cc23606bcbcdac7ade962c179abe0b260ec0aa9e"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/sl.lproj/InfoPlist.strings",
          "bytes": 1253,
          "sha256": "ecf9a4c658226afa7a66c992d581bf5e6022f05491d014384215ab73f7d365bd"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/sr.lproj/InfoPlist.strings",
          "bytes": 1601,
          "sha256": "6f3aa351ff7ecd17891d0a3177493195ce225b8c5265ec73cc5f38d70ee7ae20"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/sv.lproj/InfoPlist.strings",
          "bytes": 1153,
          "sha256": "0d6e7191baf721b3da07bee7a69c25245baab60076ca73b585eca58ef9252813"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/sw.lproj/InfoPlist.strings",
          "bytes": 1164,
          "sha256": "53ee30f5f4fbe924e3d4044bdba100636f6a2b6bd4fb05acd2bdb1b8c71cc3ca"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ta.lproj/InfoPlist.strings",
          "bytes": 2522,
          "sha256": "b3fd9ff34aa0ef81acf5345b98d5526f739126c18d55360d44a42cd82b45c5c2"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/te.lproj/InfoPlist.strings",
          "bytes": 2862,
          "sha256": "22144cb37df59e45674d95e915a32a656281f9299a1f1ae9caf9002a9073cc09"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/th.lproj/InfoPlist.strings",
          "bytes": 2324,
          "sha256": "993ff7a6398ceabc5fba8007fd25416e49a0758a15caa703d8b8cb12d69b22e0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/tr.lproj/InfoPlist.strings",
          "bytes": 1346,
          "sha256": "ff8331dc93130a031fac49e8a6eef129a59d239a709a9c8d824fec2523b3e9b6"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/uk.lproj/InfoPlist.strings",
          "bytes": 1647,
          "sha256": "62fff42c1cca7ac496d7b46bd67e7d4326192808fdd287b19e59e80f30d957cd"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/ur.lproj/InfoPlist.strings",
          "bytes": 1613,
          "sha256": "837469e5ae825fad0300ad190a1b7e58392cd1a4fb45718ad52c0c7769c267e5"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/vi.lproj/InfoPlist.strings",
          "bytes": 1523,
          "sha256": "c58ce010cd96f44b0d6caf1beb692e1c22a0be0e4f7779655aa5e2481f7826c0"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/zh_CN.lproj/InfoPlist.strings",
          "bytes": 1257,
          "sha256": "7276b6a73b9f20cf8ed01260789dd863ebb473fd8f71de4cac7158536986e121"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Resources/zh_TW.lproj/InfoPlist.strings",
          "bytes": 1103,
          "sha256": "bafe661cfc1ba307ac19e61855a8a8492ac7f692162736081c32dca44f27a7b0"
        }
      ],
      "links": [
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Google Chrome for Testing Framework",
          "target": "Versions/Current/Google Chrome for Testing Framework"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Helpers",
          "target": "Versions/Current/Helpers"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Libraries",
          "target": "Versions/Current/Libraries"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Resources",
          "target": "Versions/Current/Resources"
        },
        {
          "path": "browser/Google Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework/Versions/Current",
          "target": "153.0.8010.12"
        }
      ],
      "license": {
        "name": "BSD-3-Clause",
        "url": "https://opensource.org/license/bsd-3-clause/"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/xhs-browser-1.63.0-chromium-1243-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "6adcd9576bf8670697b60ae1f0d91bd5c335a3341880ffbfd9a05f8fe976c245"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "SM0USWFQWiQlj4O3a1Do6ZcAJa8rDH4QHLVUgccei1DBd93AJMtNG7jtG9DwHW1NcdL196l3U6o+IWNiPBHuDg=="
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
      "version": "1.0.0-ct2-cf109095-darwin-arm64.1",
      "platform": "darwin-arm64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/xhs-translation-1.0.0-ct2-cf109095-darwin-arm64.1-darwin-arm64.tar.gz",
        "bytes": 156178982,
        "sha256": "110cbfe4eb6806dcaa1053060f5a372ca079ac082555b2d747d612cfb2730b01",
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
          "bytes": 33020,
          "sha256": "597d474c7682276e61137e87af65b8810b544802e765a9a0a3daec28fbbc8083"
        },
        {
          "path": "scripts/xhs-translation-worker.py",
          "bytes": 4970,
          "sha256": "97a498051ac6b7e1cb1f4b83cd97620e285ce27c24b08484b12ecc8137201793"
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
          "path": "wheelhouse/anyio-4.16.0-py3-none-any.whl",
          "bytes": 134521,
          "sha256": "c66ae634e0b8228396b801741beb3294326d4b6102f7bba4041c0dfb58c29026"
        },
        {
          "path": "wheelhouse/click-8.5.1-py3-none-any.whl",
          "bytes": 126163,
          "sha256": "8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37"
        },
        {
          "path": "wheelhouse/ctranslate2-4.8.2-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1271613,
          "sha256": "fedda669421a57f8164568ee86ea265727016988d310fcc2e24ca30e9ec457cd"
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
          "path": "wheelhouse/numpy-2.5.4-cp312-cp312-macosx_14_0_arm64.whl",
          "bytes": 5451717,
          "sha256": "9cb18a327b49c5c337f972b03682f6a49855525faaf3c0d3e9c96cd0fd8880a8"
        },
        {
          "path": "wheelhouse/pydantic_core-2.46.5-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1922874,
          "sha256": "a39ac25a9a2fa4072efdb429833c4a4c8009a51ff9eea3eeae131713cd27991e"
        },
        {
          "path": "wheelhouse/pydantic-2.13.5-py3-none-any.whl",
          "bytes": 472589,
          "sha256": "346a034f080da3755d8e9cb5e00e8b07de1d39e4f6e2c87d8ab7cafa0b269a73"
        },
        {
          "path": "wheelhouse/pyyaml-6.0.3-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 173973,
          "sha256": "fc09d0aa354569bc501d4e787133afc08552722d3ab34836a80547331bb5d4a0"
        },
        {
          "path": "wheelhouse/sentencepiece-0.2.2-cp312-cp312-macosx_11_0_arm64.whl",
          "bytes": 1347176,
          "sha256": "38111ed1f79268f399c505028023d5eaaf0ab4e5eafceb709468b0d3323e7838"
        },
        {
          "path": "wheelhouse/starlette-1.10.0-py3-none-any.whl",
          "bytes": 80571,
          "sha256": "478c0ab3b4ced6e82719849c118fa406f0278a3499c1a898cd15cd31bdc38ce4"
        },
        {
          "path": "wheelhouse/typing_extensions-4.16.0-py3-none-any.whl",
          "bytes": 45571,
          "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8"
        },
        {
          "path": "wheelhouse/typing_inspection-0.4.5-py3-none-any.whl",
          "bytes": 14874,
          "sha256": "bc210535442b39e1bf2805e0c7a17dfd6a4ace760c84c7f7d16245d23a6b1c39"
        },
        {
          "path": "wheelhouse/uvicorn-0.52.4-py3-none-any.whl",
          "bytes": 79871,
          "sha256": "f86e41a149d7d05a9969337e3946a9c171c06a5d42680896daaba624aeac8da1"
        }
      ],
      "pythonEnvironment": {
        "pythonComponentId": "python-312",
        "pythonExecutablePath": "python/bin/python3.12",
        "wheelhousePath": "wheelhouse",
        "requirementsLockPath": "requirements.lock",
        "requirementsLockSha256": "597d474c7682276e61137e87af65b8810b544802e765a9a0a3daec28fbbc8083",
        "expectedPythonVersion": "3.12"
      },
      "license": {
        "name": "Apache-2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/xhs-translation-1.0.0-ct2-cf109095-darwin-arm64.1-darwin-arm64.spdx.json",
        "sha256": "23b6158da0e87c61d60c8c16a56bc8dfcd882dd9c00085819fd269070a8fb09e"
      },
      "keyId": "ed25519-f372f170675a31f5015c6a38",
      "signature": "03mMVfHEK9ey+wGOKlIeU5hwurwMcdUg1p8CHNJGi8BaIPWbyXGd/SAy18/g7fvMv9xvdgFrdkO2unpa/QHkDQ=="
    }
  ],
  "trustedPublicKeys": {
    "ed25519-f372f170675a31f5015c6a38": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAbwknGXr7/yg9ybMEeb3ykpTSKiE9REB/Ft3uorMVZh0=\n-----END PUBLIC KEY-----\n"
  }
} satisfies ComponentCatalog;
