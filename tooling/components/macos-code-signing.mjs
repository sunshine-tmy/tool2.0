import { execFileSync } from "node:child_process";

/**
 * 中文模块说明：在最终目录布局上验证原生代码签名，并为无效的单体 Mach-O 补齐 ad-hoc 签名。
 */
export function ensureStrictCodeSignature(filePath, { run = execFileSync } = {}) {
  if (verify(filePath, run)) return { status: "verified-existing" };

  run("/usr/bin/codesign", ["--force", "--sign", "-", "--timestamp=none", filePath], {
    stdio: "inherit",
    timeout: 60_000
  });
  if (!verify(filePath, run)) throw new Error(`ad-hoc 签名后仍无法验证原生文件：${filePath}`);
  return { status: "ad-hoc" };
}

/** 中文模块说明：在保留固定 Framework 内链的最终 Chromium .app 上重新签名并验证嵌套代码。 */
export function reSignAndVerifyMacOSAppBundle(bundlePath, { run = execFileSync } = {}) {
  run("/usr/bin/xattr", ["-cr", bundlePath], { stdio: "inherit", timeout: 60_000 });
  let attributes = run("/usr/bin/xattr", ["-lr", bundlePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000
  });
  const lines = String(attributes).split(/\r?\n/u);
  for (const line of lines) {
    const match = /^(.*): (com\.apple\.(?:FinderInfo|ResourceFork))(?::.*)?$/u.exec(line);
    if (match) run("/usr/bin/xattr", ["-d", match[2], match[1]], { stdio: "inherit", timeout: 60_000 });
  }
  if (lines.some((line) => /\bcom\.apple\.(?:FinderInfo|ResourceFork)\b/u.test(line))) {
    attributes = run("/usr/bin/xattr", ["-lr", bundlePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000
    });
  }
  const forbiddenAttribute = String(attributes)
    .split(/\r?\n/u)
    .find((line) => /\bcom\.apple\.(?:FinderInfo|ResourceFork)\b/u.test(line));
  if (forbiddenAttribute) {
    throw new Error(`Chromium .app 最终布局仍包含禁止签名的 Finder/resource fork 元数据：${forbiddenAttribute}`);
  }
  try {
    run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", bundlePath], {
      encoding: "utf8",
      timeout: 2 * 60_000
    });
  } catch (error) {
    const diagnostic = String(error?.stderr ?? error?.message ?? "");
    if (/bundle format is ambiguous/u.test(diagnostic)) {
      throw new Error(
        `Chromium framework 在保留内部链接后无法签名，已停止该能力包制作；只评审 Google Chrome for Testing Framework.framework 内的五条固定相对链接，不得放宽全局归档链接规则。${diagnostic}`
      );
    }
    throw error;
  }
  if (!verify(bundlePath, run, { deep: true })) {
    throw new Error(`Chromium .app ad-hoc 签名后仍无法通过 framework 验证：${bundlePath}`);
  }
}

export function verifyStrictCodeSignature(filePath, { deep = false, run = execFileSync } = {}) {
  return verify(filePath, run, { deep });
}

function verify(path, run, { deep = false } = {}) {
  try {
    run("/usr/bin/codesign", ["--verify", ...(deep ? ["--deep"] : []), "--strict", path], {
      stdio: "ignore",
      timeout: 60_000
    });
    return true;
  } catch (error) {
    if (Number.isInteger(error?.status)) return false;
    throw error;
  }
}
