const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildInlineContentDisposition,
  normalizeContentVariant,
  resolveDocumentContent,
} = require("./system-knowledge-base.content");

test("rejects preview variants outside the allowlist", () => {
  assert.equal(normalizeContentVariant("original"), "original");
  assert.equal(normalizeContentVariant("PDF"), "pdf");
  assert.throws(() => normalizeContentVariant("../../private"), /不支持的预览格式/);
});

test("resolves original files without trusting a client path", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-content-"));
  const sourcePath = path.join(directory, "lineage.sql");
  fs.writeFileSync(sourcePath, "select 1");
  const result = await resolveDocumentContent(
    { id: 2, fileName: "lineage.sql", fileType: "sql", filePath: "/untrusted/db/path.sql", fileSize: 8 },
    "original",
    { resolvePath: () => sourcePath },
  );
  assert.equal(result.mode, "file");
  assert.equal(result.path, sourcePath);
  assert.equal(result.mimeType, "text/plain; charset=utf-8");
});

test("returns sandboxed HTML through the text variant", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-html-"));
  const sourcePath = path.join(directory, "graph.html");
  fs.writeFileSync(sourcePath, "<html><head></head><body></body></html>");
  const result = await resolveDocumentContent(
    { id: 3, fileName: "graph.html", fileType: "html", fileSize: 100 },
    "text",
    {
      resolvePath: () => sourcePath,
      readText: async () => "<html><head></head><body><script>window.ok=1</script></body></html>",
    },
  );
  assert.equal(result.mode, "text");
  assert.match(result.content, /connect-src 'none'/);
  assert.equal(result.mimeType, "text/html; charset=utf-8");
});

test("converts Office documents only for the PDF variant", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-office-"));
  const sourcePath = path.join(directory, "slides.pptx");
  const pdfPath = path.join(directory, "slides.pdf");
  fs.writeFileSync(sourcePath, "pptx");
  fs.writeFileSync(pdfPath, "%PDF");
  const result = await resolveDocumentContent(
    { id: 4, fileName: "slides.pptx", fileType: "pptx", updatedAt: "2026-08-07" },
    "pdf",
    {
      resolvePath: () => sourcePath,
      convertOffice: async () => ({ path: pdfPath, converted: true, cacheHit: false }),
    },
  );
  assert.equal(result.path, pdfPath);
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.converted, true);
});

test("builds an inline content disposition for unicode file names", () => {
  const value = buildInlineContentDisposition("航空 延误报告.pdf");
  assert.match(value, /^inline; filename="download\.pdf";/);
  assert.match(value, /filename\*=UTF-8''%E8%88%AA%E7%A9%BA%20%E5%BB%B6%E8%AF%AF%E6%8A%A5%E5%91%8A\.pdf/);
});
