const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildPreviewDescriptor,
  classifyPreview,
  injectSandboxCsp,
  parseSingleRange,
} = require("./system-knowledge-base.preview");

test("classifies aviation knowledge-base files by browser renderer", () => {
  assert.deepEqual(classifyPreview("decision.html"), {
    kind: "html",
    mimeType: "text/html; charset=utf-8",
    language: "html",
    preferredVariant: "text",
  });
  assert.equal(classifyPreview("knowledge.md").kind, "markdown");
  assert.equal(classifyPreview("lineage.sql").language, "sql");
  assert.equal(classifyPreview("lineage.json").kind, "json");
  assert.equal(classifyPreview("manual.pdf").kind, "pdf");
  assert.equal(classifyPreview("slides.pptx").kind, "office");
  assert.equal(classifyPreview("unknown.bin").kind, "unsupported");
});

test("builds a client descriptor without exposing the filesystem path", () => {
  const descriptor = buildPreviewDescriptor({
    id: 9,
    fileName: "aviation_ontology_field_lineage.sql",
    fileType: "sql",
    filePath: "/Users/private/runtime/lineage.sql",
    fileSize: 128,
  });
  assert.equal(descriptor.kind, "code");
  assert.equal(descriptor.language, "sql");
  assert.equal(descriptor.fileName, "aviation_ontology_field_lineage.sql");
  assert.equal(descriptor.contentUrl, "/system-knowledge-bases/documents/9/content?variant=text");
  assert.equal(Object.hasOwn(descriptor, "filePath"), false);
  assert.doesNotMatch(JSON.stringify(descriptor), /\/Users\/private/);
});

test("injects a restrictive CSP into interactive HTML", () => {
  const value = injectSandboxCsp("<!doctype html><html><head><title>Graph</title></head><body></body></html>");
  assert.match(value, /default-src 'none'/);
  assert.match(value, /connect-src 'none'/);
  assert.match(value, /script-src 'unsafe-inline' blob:/);
  assert.equal((value.match(/Content-Security-Policy/g) || []).length, 1);
});

test("parses a bounded single byte range", () => {
  assert.deepEqual(parseSingleRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(parseSingleRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.equal(parseSingleRange("bytes=100-120", 100), null);
  assert.equal(parseSingleRange("bytes=0-1,4-5", 100), null);
});
