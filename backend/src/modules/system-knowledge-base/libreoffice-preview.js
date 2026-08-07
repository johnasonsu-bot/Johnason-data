const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 60_000;

function findLibreOfficeBinary(options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const exists = options.exists || fs.existsSync;
  const candidates = [];
  if (env.LIBREOFFICE_BIN) candidates.push(env.LIBREOFFICE_BIN);
  const executableNames = platform === "win32" ? ["soffice.exe"] : ["soffice", "libreoffice"];
  String(env.PATH || "").split(path.delimiter).filter(Boolean).forEach((directory) => {
    executableNames.forEach((name) => candidates.push(path.join(directory, name)));
  });
  if (platform === "darwin") {
    candidates.push(
      "/opt/homebrew/bin/soffice",
      "/usr/local/bin/soffice",
      "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    );
  } else if (platform === "linux") {
    candidates.push("/usr/bin/soffice", "/usr/bin/libreoffice", "/opt/libreoffice/program/soffice");
  } else if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    );
  }
  return candidates.find((candidate) => candidate && exists(candidate)) || null;
}

function buildCacheKey(documentId, updatedAt, sourcePath) {
  return crypto.createHash("sha256")
    .update(`${Number(documentId) || 0}:${String(updatedAt || "")}:${path.basename(String(sourcePath || ""))}`)
    .digest("hex")
    .slice(0, 20);
}

async function defaultRunCommand(binary, args, options) {
  return execFileAsync(binary, args, {
    timeout: options.timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
}

async function convertOfficeToPdf(options) {
  const sourcePath = path.resolve(String(options?.sourcePath || ""));
  const binary = Object.hasOwn(options || {}, "binary")
    ? options.binary
    : findLibreOfficeBinary();
  if (!binary) {
    throw new Error("LibreOffice 未安装，无法生成 Office 文件预览；请运行仓库中的预览依赖安装脚本");
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Office 原始文件不存在: ${path.basename(sourcePath)}`);
  }

  const cacheRoot = path.resolve(options.cacheDir || path.resolve(process.cwd(), "runtime/system-knowledge-base-preview-cache"));
  const cacheKey = buildCacheKey(options.documentId, options.updatedAt, sourcePath);
  const conversionDir = path.join(cacheRoot, `document-${Number(options.documentId) || 0}-${cacheKey}`);
  const outputFileName = `${path.parse(sourcePath).name}.pdf`;
  const outputPath = path.join(conversionDir, outputFileName);
  fs.mkdirSync(conversionDir, { recursive: true });

  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    return { path: outputPath, converted: true, cacheHit: true };
  }

  const profileDir = path.join(conversionDir, "libreoffice-profile");
  fs.mkdirSync(profileDir, { recursive: true });
  const args = [
    "--headless",
    "--nologo",
    "--nodefault",
    "--nofirststartwizard",
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    "--convert-to",
    "pdf",
    "--outdir",
    conversionDir,
    sourcePath,
  ];
  const runCommand = options.runCommand || defaultRunCommand;
  await runCommand(binary, args, { timeoutMs: Number(options.timeoutMs || DEFAULT_TIMEOUT_MS) });
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 0) {
    throw new Error(`LibreOffice 转换未生成 PDF: ${path.basename(sourcePath)}`);
  }
  return { path: outputPath, converted: true, cacheHit: false };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  convertOfficeToPdf,
  findLibreOfficeBinary,
};
