const fs = require("node:fs");
const path = require("node:path");
const AppError = require("../../common/errors/app-error");
const { convertOfficeToPdf } = require("./libreoffice-preview");
const {
  MAX_TEXT_PREVIEW_BYTES,
  classifyPreview,
  injectSandboxCsp,
} = require("./system-knowledge-base.preview");

const ALLOWED_VARIANTS = new Set(["original", "text", "pdf"]);

function normalizeContentVariant(value) {
  const variant = String(value || "original").trim().toLowerCase();
  if (!ALLOWED_VARIANTS.has(variant)) {
    throw new AppError(`不支持的预览格式: ${variant}`, 400);
  }
  return variant;
}

function buildInlineContentDisposition(fileName) {
  const safeName = path.basename(String(fileName || "download"));
  const extension = path.extname(safeName).replace(/[^.a-zA-Z0-9]/g, "");
  const fallback = `download${extension}`;
  const encoded = encodeURIComponent(safeName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

async function defaultReadText(filePath) {
  return fs.promises.readFile(filePath, "utf8");
}

async function resolveDocumentContent(document, requestedVariant, dependencies = {}) {
  const variant = normalizeContentVariant(requestedVariant);
  const resolvePath = dependencies.resolvePath || ((record) => record?.filePath);
  const sourcePath = resolvePath(document);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new AppError("知识库原始文件不存在", 404);
  }
  const classification = classifyPreview(document?.fileName, document?.fileType);
  if (variant === "original") {
    const stat = fs.statSync(sourcePath);
    return {
      mode: "file",
      path: sourcePath,
      fileName: document.fileName,
      mimeType: classification.mimeType,
      size: stat.size,
      converted: false,
    };
  }
  if (variant === "text") {
    const readText = dependencies.readText || defaultReadText;
    let content = String(await readText(sourcePath, document?.fileType) || "");
    if (classification.kind === "html") content = injectSandboxCsp(content);
    const truncated = Buffer.byteLength(content, "utf8") > MAX_TEXT_PREVIEW_BYTES;
    if (truncated) content = Buffer.from(content, "utf8").subarray(0, MAX_TEXT_PREVIEW_BYTES).toString("utf8");
    return {
      mode: "text",
      content,
      fileName: document.fileName,
      mimeType: classification.mimeType,
      size: Buffer.byteLength(content, "utf8"),
      converted: classification.kind === "table" && !["csv"].includes(String(document?.fileType || "").toLowerCase()),
      truncated,
    };
  }
  if (classification.kind === "pdf") {
    const stat = fs.statSync(sourcePath);
    return { mode: "file", path: sourcePath, fileName: document.fileName, mimeType: "application/pdf", size: stat.size, converted: false };
  }
  if (classification.kind !== "office") {
    throw new AppError(`文件类型 ${document?.fileType || "unknown"} 不支持转换为 PDF`, 400);
  }
  const convertOffice = dependencies.convertOffice || convertOfficeToPdf;
  const converted = await convertOffice({
    sourcePath,
    documentId: document.id,
    updatedAt: document.updatedAt,
    cacheDir: dependencies.cacheDir,
  });
  const stat = fs.statSync(converted.path);
  return {
    mode: "file",
    path: converted.path,
    fileName: `${path.parse(document.fileName).name}.pdf`,
    mimeType: "application/pdf",
    size: stat.size,
    converted: true,
    cacheHit: Boolean(converted.cacheHit),
  };
}

module.exports = {
  buildInlineContentDisposition,
  normalizeContentVariant,
  resolveDocumentContent,
};
