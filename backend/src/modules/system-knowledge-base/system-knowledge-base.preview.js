const path = require("node:path");

const HTML_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

const TYPE_MAP = Object.freeze({
  html: ["html", "text/html; charset=utf-8", "html", "text"],
  htm: ["html", "text/html; charset=utf-8", "html", "text"],
  md: ["markdown", "text/markdown; charset=utf-8", "markdown", "text"],
  markdown: ["markdown", "text/markdown; charset=utf-8", "markdown", "text"],
  json: ["json", "application/json; charset=utf-8", "json", "text"],
  csv: ["table", "text/csv; charset=utf-8", "csv", "text"],
  xls: ["table", "application/vnd.ms-excel", "csv", "text"],
  xlsx: ["table", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "csv", "text"],
  pdf: ["pdf", "application/pdf", null, "original"],
  doc: ["office", "application/msword", null, "pdf"],
  docx: ["office", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", null, "pdf"],
  ppt: ["office", "application/vnd.ms-powerpoint", null, "pdf"],
  pptx: ["office", "application/vnd.openxmlformats-officedocument.presentationml.presentation", null, "pdf"],
  png: ["image", "image/png", null, "original"],
  jpg: ["image", "image/jpeg", null, "original"],
  jpeg: ["image", "image/jpeg", null, "original"],
  gif: ["image", "image/gif", null, "original"],
  webp: ["image", "image/webp", null, "original"],
  bmp: ["image", "image/bmp", null, "original"],
  svg: ["image", "image/svg+xml", null, "original"],
  mp3: ["audio", "audio/mpeg", null, "original"],
  wav: ["audio", "audio/wav", null, "original"],
  ogg: ["audio", "audio/ogg", null, "original"],
  m4a: ["audio", "audio/mp4", null, "original"],
  mp4: ["video", "video/mp4", null, "original"],
  webm: ["video", "video/webm", null, "original"],
  mov: ["video", "video/quicktime", null, "original"],
});

const CODE_TYPES = Object.freeze({
  sql: ["text/plain; charset=utf-8", "sql"],
  txt: ["text/plain; charset=utf-8", "plaintext"],
  log: ["text/plain; charset=utf-8", "plaintext"],
  yaml: ["application/yaml; charset=utf-8", "yaml"],
  yml: ["application/yaml; charset=utf-8", "yaml"],
  xml: ["application/xml; charset=utf-8", "xml"],
  js: ["text/javascript; charset=utf-8", "javascript"],
  jsx: ["text/javascript; charset=utf-8", "javascript"],
  ts: ["text/typescript; charset=utf-8", "typescript"],
  tsx: ["text/typescript; charset=utf-8", "typescript"],
  css: ["text/css; charset=utf-8", "css"],
  scss: ["text/x-scss; charset=utf-8", "scss"],
  sh: ["text/x-shellscript; charset=utf-8", "shell"],
  py: ["text/x-python; charset=utf-8", "python"],
  java: ["text/x-java-source; charset=utf-8", "java"],
});

function resolveExtension(fileName, fileType) {
  const explicit = String(fileType || "").trim().toLowerCase().replace(/^\./, "");
  if (explicit) return explicit;
  return path.extname(String(fileName || "")).replace(/^\./, "").toLowerCase();
}

function classifyPreview(fileName, fileType) {
  const extension = resolveExtension(fileName, fileType);
  if (TYPE_MAP[extension]) {
    const [kind, mimeType, language, preferredVariant] = TYPE_MAP[extension];
    return { kind, mimeType, language, preferredVariant };
  }
  if (CODE_TYPES[extension]) {
    const [mimeType, language] = CODE_TYPES[extension];
    return { kind: "code", mimeType, language, preferredVariant: "text" };
  }
  return { kind: "unsupported", mimeType: "application/octet-stream", language: null, preferredVariant: "original" };
}

function buildPreviewDescriptor(document, options = {}) {
  const classification = classifyPreview(document?.fileName, document?.fileType);
  const variant = options.preferredVariant || classification.preferredVariant;
  const id = Number(document?.id);
  return {
    ...classification,
    fileName: String(document?.fileName || ""),
    fileSize: Number(document?.fileSize || 0),
    contentUrl: `/system-knowledge-bases/documents/${id}/content?variant=${encodeURIComponent(variant)}`,
    converted: Boolean(options.converted),
    fallbackReason: options.fallbackReason || null,
    maxPreviewBytes: MAX_TEXT_PREVIEW_BYTES,
  };
}

function injectSandboxCsp(html) {
  const source = String(html || "");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}">`;
  if (/<head(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<head(?:\s[^>]*)?>/i, (value) => `${value}${meta}`);
  }
  if (/<html(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<html(?:\s[^>]*)?>/i, (value) => `${value}<head>${meta}</head>`);
  }
  return `<!doctype html><html><head>${meta}</head><body>${source}</body></html>`;
}

function parseSingleRange(headerValue, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(headerValue || "").trim());
  const totalSize = Number(size);
  if (!match || !Number.isSafeInteger(totalSize) || totalSize <= 0) return null;
  if (!match[1] && !match[2]) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : totalSize - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= totalSize) return null;
    end = Math.min(end, totalSize - 1);
  }
  return { start, end };
}

module.exports = {
  HTML_CSP,
  MAX_TEXT_PREVIEW_BYTES,
  buildPreviewDescriptor,
  classifyPreview,
  injectSandboxCsp,
  parseSingleRange,
};
