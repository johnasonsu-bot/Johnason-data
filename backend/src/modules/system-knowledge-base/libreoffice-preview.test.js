const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  convertOfficeToPdf,
  findLibreOfficeBinary,
} = require("./libreoffice-preview");

test("prefers an explicit LIBREOFFICE_BIN when it exists", () => {
  const value = findLibreOfficeBinary({
    env: { LIBREOFFICE_BIN: "/opt/libreoffice/program/soffice", PATH: "" },
    platform: "linux",
    exists: (candidate) => candidate === "/opt/libreoffice/program/soffice",
  });
  assert.equal(value, "/opt/libreoffice/program/soffice");
});

test("returns a valid cached PDF without running a conversion", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "office-preview-cache-"));
  const sourcePath = path.join(cacheDir, "sample.docx");
  fs.writeFileSync(sourcePath, "docx fixture");
  const first = await convertOfficeToPdf({
    sourcePath,
    documentId: 3,
    updatedAt: "2026-08-07T00:00:00.000Z",
    cacheDir,
    binary: "/usr/bin/soffice",
    runCommand: async (_binary, args) => {
      const outputDir = args[args.indexOf("--outdir") + 1];
      fs.writeFileSync(path.join(outputDir, "sample.pdf"), "%PDF-converted");
    },
  });
  const second = await convertOfficeToPdf({
    sourcePath,
    documentId: 3,
    updatedAt: "2026-08-07T00:00:00.000Z",
    cacheDir,
    binary: "/usr/bin/soffice",
    runCommand: async () => {
      throw new Error("cached preview must not convert again");
    },
  });
  assert.equal(first.cacheHit, false);
  assert.equal(second.cacheHit, true);
  assert.equal(fs.readFileSync(second.path, "utf8"), "%PDF-converted");
});

test("fails with an actionable message when LibreOffice is unavailable", async () => {
  await assert.rejects(
    () => convertOfficeToPdf({ sourcePath: "/tmp/missing.docx", documentId: 4, cacheDir: os.tmpdir(), binary: null }),
    /LibreOffice 未安装/,
  );
});
