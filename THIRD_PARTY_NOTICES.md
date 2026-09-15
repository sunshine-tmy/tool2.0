# Third-party notices

## XHS-Downloader

The optional “小红书内容归档” runtime uses XHS-Downloader 2.7:

- Project: <https://github.com/JoeanAmier/XHS-Downloader>
- Pinned commit: `afaf2fb459980fccef9eec74e304a39af2c49cab`
- License: GNU General Public License v3.0

The source archive and its `LICENSE` file are downloaded together into `.runtime/xhs-downloader` only when this module is first used. The integration runs as an isolated local Python process and is intended here for personal local use. Review the upstream project, license, and the platform terms before redistribution or other use.

## Local Chinese-to-English translation

The optional bilingual archive uses the `Helsinki-NLP/opus-mt-zh-en` model (CC-BY-4.0; license text: <https://creativecommons.org/licenses/by/4.0/>), pinned to revision `cf109095479db38d6df799875e34039d4938aaa6`, converted to a CPU INT8 CTranslate2 package. Runtime dependencies are pinned to CTranslate2 4.8.2 (MIT), SentencePiece 0.2.2 (Apache-2.0), FastAPI 0.141.1 (MIT), Uvicorn 0.52.4 (BSD-3-Clause) and Pydantic 2.13.5 (MIT). The model and its license are downloaded locally on first translation; model files are not stored in Git. Translation runs only on `127.0.0.1` and does not send archive text to an online API.

If the configured Release Asset is unavailable, the runtime uses the pinned pre-converted recovery artifact `gaudi/opus-mt-zh-en-ctranslate2` at revision `05d8fc158397bae0c65b8d46c858b6c18e094c12`. It is derived from the same OPUS-MT model; its repository is marked Apache-2.0 and retains the original model attribution and license terms. The recovery files are downloaded only to `.runtime/xhs-translate` and are never committed.
