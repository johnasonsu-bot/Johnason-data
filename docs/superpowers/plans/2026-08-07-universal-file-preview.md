# Universal File Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable authenticated browser file preview capability and use it first in the system knowledge-base document list.

**Architecture:** The backend classifies files, exposes a metadata-compatible preview response and streams original or converted content without exposing filesystem paths. The frontend uses a renderer registry in `UniversalFilePreview`, fetching protected content as text or Blob and routing it to isolated HTML, Markdown, Monaco, table, PDF, image, media, or fallback renderers.

**Tech Stack:** Express, Node.js streams and child processes, LibreOffice headless conversion, React 19, Ant Design, Monaco Editor, marked, DOMPurify, Vitest, Node test runner.

## Global Constraints

- Interactive HTML runs only in `sandbox="allow-scripts"` without `allow-same-origin`, forms, popups, or top navigation.
- Preview requests require existing platform authentication and project scope; API responses never expose absolute file paths.
- LibreOffice must be represented as a deployable dependency through repository installation assets and runtime capability detection.
- Existing `previewText` and chunk fields remain backward compatible.
- Unsupported or failed conversions degrade to file metadata, parsed text, and download instead of breaking the page.
- Runtime caches, generated build-info files, and unrelated dirty-worktree changes must not be committed.

---

### Task 1: Backend file classification and safe preview descriptors

**Files:**
- Create: `backend/src/modules/system-knowledge-base/system-knowledge-base.preview.js`
- Create: `backend/src/modules/system-knowledge-base/system-knowledge-base.preview.test.js`

**Interfaces:**
- Produces: `classifyPreview(fileName, fileType)` returning `{ kind, mimeType, language, preferredVariant }`.
- Produces: `buildPreviewDescriptor(document, options)` returning a path-free client descriptor.
- Produces: `injectSandboxCsp(html)` for isolated HTML source documents.

- [ ] **Step 1: Write failing classification and descriptor tests**

```js
test("classifies aviation knowledge files without exposing filePath", () => {
  const descriptor = buildPreviewDescriptor({ id: 9, fileName: "lineage.sql", fileType: "sql", filePath: "/private/a.sql", fileSize: 12 });
  assert.equal(descriptor.kind, "code");
  assert.equal(descriptor.language, "sql");
  assert.equal(Object.hasOwn(descriptor, "filePath"), false);
});

test("injects a network-restricting CSP into interactive HTML", () => {
  const value = injectSandboxCsp("<!doctype html><html><head></head><body></body></html>");
  assert.match(value, /connect-src 'none'/);
  assert.match(value, /script-src 'unsafe-inline' blob:/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd backend && node --test src/modules/system-knowledge-base/system-knowledge-base.preview.test.js`

Expected: FAIL because `system-knowledge-base.preview.js` does not exist.

- [ ] **Step 3: Implement the minimal classifier and descriptor**

Implement literal extension maps for HTML, Markdown, JSON, code/text, CSV/Excel, Office, PDF, images, audio, video, and unsupported files. Ensure the returned object contains only safe document metadata and a relative content endpoint.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `cd backend && node --test src/modules/system-knowledge-base/system-knowledge-base.preview.test.js`

Expected: PASS.

### Task 2: LibreOffice discovery, conversion, and repository installation dependency

**Files:**
- Create: `backend/src/modules/system-knowledge-base/libreoffice-preview.js`
- Create: `backend/src/modules/system-knowledge-base/libreoffice-preview.test.js`
- Create: `backend/Dockerfile`
- Create: `scripts/install-preview-dependencies.sh`
- Create: `scripts/install-preview-dependencies.ps1`
- Modify: `backend/package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `findLibreOfficeBinary(env, platform)` returning a verified executable path or `null`.
- Produces: `convertOfficeToPdf({ sourcePath, documentId, updatedAt, cacheDir, timeoutMs })` returning `{ path, converted, cacheHit }`.

- [ ] **Step 1: Write failing binary-discovery and cached-conversion tests**

```js
test("honors an explicit LIBREOFFICE_BIN before PATH candidates", () => {
  const result = findLibreOfficeBinary({ LIBREOFFICE_BIN: "/opt/libreoffice/program/soffice" }, "linux", (candidate) => candidate === "/opt/libreoffice/program/soffice");
  assert.equal(result, "/opt/libreoffice/program/soffice");
});

test("returns a valid cached PDF without launching conversion", async () => {
  const result = await convertOfficeToPdf({ sourcePath, documentId: 3, updatedAt: "2026-08-07T00:00:00Z", cacheDir, runCommand });
  assert.equal(result.cacheHit, true);
  assert.equal(runCommand.calls, 0);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd backend && node --test src/modules/system-knowledge-base/libreoffice-preview.test.js`

Expected: FAIL because the conversion module does not exist.

- [ ] **Step 3: Implement discovery and bounded headless conversion**

Use `execFile` with an argument array, a fixed cache directory, a timeout, and a generated LibreOffice user profile. Never compose a shell command from a filename. Validate that the converted path remains inside the cache directory.

- [ ] **Step 4: Add deployable installation assets**

The Debian-based `backend/Dockerfile` installs `libreoffice-core`, `libreoffice-writer`, `libreoffice-calc`, `libreoffice-impress`, and Chinese fonts. The shell installer supports Homebrew and apt; PowerShell supports winget with a clear failure message. Add `npm run setup:preview` and document `LIBREOFFICE_BIN`.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `cd backend && node --test src/modules/system-knowledge-base/libreoffice-preview.test.js`

Expected: PASS without invoking the real binary in unit tests.

### Task 3: Authenticated content stream and backward-compatible preview API

**Files:**
- Modify: `backend/src/modules/system-knowledge-base/system-knowledge-base.service.js`
- Modify: `backend/src/modules/system-knowledge-base/system-knowledge-base.controller.js`
- Modify: `backend/src/modules/system-knowledge-base/system-knowledge-base.routes.js`
- Create: `backend/src/modules/system-knowledge-base/system-knowledge-base.content.test.js`

**Interfaces:**
- Extends: `getKnowledgeDocumentPreview(documentId)` with `viewer`.
- Produces: `resolveKnowledgeDocumentContent(documentId, variant)` returning `{ path, mimeType, fileName, size, converted }`.
- Produces route: `GET /system-knowledge-bases/documents/:documentId/content?variant=original|pdf|text`.

- [ ] **Step 1: Write failing service-boundary tests**

Test that unknown variants are rejected, missing original files return 404, Office `pdf` uses the converter, and returned metadata excludes database `filePath`.

- [ ] **Step 2: Run the test and verify RED**

Run: `cd backend && node --test src/modules/system-knowledge-base/system-knowledge-base.content.test.js`

Expected: FAIL because `resolveKnowledgeDocumentContent` is not exported.

- [ ] **Step 3: Implement minimal content resolution and streaming**

Reuse `resolveExistingKnowledgeDocumentPath`, validate the allowlisted variant, and implement single-range responses for PDF and media. Set `Content-Type`, escaped inline `Content-Disposition`, `Accept-Ranges`, `X-Content-Type-Options: nosniff`, and a restrictive CSP for HTML.

- [ ] **Step 4: Extend existing preview response**

Attach `viewer: buildPreviewDescriptor(document)` while preserving `previewText`, `chunks`, `totalChunks`, `previewSource`, and `truncated` exactly.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `cd backend && node --test src/modules/system-knowledge-base/system-knowledge-base.preview.test.js src/modules/system-knowledge-base/libreoffice-preview.test.js src/modules/system-knowledge-base/system-knowledge-base.content.test.js`

Expected: PASS.

### Task 4: Frontend renderer registry and secure content helpers

**Files:**
- Create: `frontend/src/components/file-preview/filePreview.ts`
- Create: `frontend/src/components/file-preview/filePreview.test.ts`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/systemKnowledgeBases.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Produces: `resolvePreviewRenderer(viewer)` returning a renderer key.
- Produces: `buildSandboxedHtml(source)` injecting a local-only CSP.
- Produces: `fetchSystemKnowledgeDocumentContent(token, id, variant)` returning a `Blob`.

- [ ] **Step 1: Write failing renderer and sandbox tests**

```ts
it("routes SQL to the Monaco code renderer", () => {
  expect(resolvePreviewRenderer({ kind: "code", language: "sql" })).toBe("code");
});

it("builds interactive HTML that blocks platform-origin privileges", () => {
  const result = buildSandboxedHtml("<html><body><script>window.ok=1</script></body></html>");
  expect(result).toContain("connect-src 'none'");
  expect(result).not.toContain("allow-same-origin");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && npx vitest run src/components/file-preview/filePreview.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement registry, content helpers, and API types**

Add direct `marked` and `dompurify` dependencies even if present transitively. Define the `SystemKnowledgeDocumentViewer` contract to match the backend exactly.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `cd frontend && npx vitest run src/components/file-preview/filePreview.test.ts`

Expected: PASS.

### Task 5: UniversalFilePreview public component

**Files:**
- Create: `frontend/src/components/file-preview/UniversalFilePreview.tsx`
- Create: `frontend/src/components/file-preview/index.ts`
- Modify: `frontend/src/styles/index.css`
- Test: `frontend/src/components/file-preview/filePreview.test.ts`

**Interfaces:**
- Produces: `<UniversalFilePreview open preview token onClose onDownload />`.
- Consumes: `SystemKnowledgeDocumentPreview.viewer` and authenticated content helper.

- [ ] **Step 1: Add failing pure behavior tests**

Add tests for JSON formatting, CSV parsing with quoted commas, Markdown sanitization, and Blob URL cleanup bookkeeping through exported pure helpers.

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && npx vitest run src/components/file-preview/filePreview.test.ts`

Expected: FAIL on the newly referenced helpers.

- [ ] **Step 3: Implement the minimal public preview component**

Use Monaco for code and JSON, DOMPurify after `marked.parse` for Markdown, Ant Design Table for CSV, `srcDoc` plus `sandbox="allow-scripts"` for HTML, and fetched Blob URLs for PDF, images, audio, and video. Office descriptors request the `pdf` variant. Unsupported files show metadata, fallback text, and download.

- [ ] **Step 4: Run unit test and frontend build**

Run: `cd frontend && npx vitest run src/components/file-preview/filePreview.test.ts && npm run build`

Expected: PASS and successful Vite build.

### Task 6: Knowledge-base integration and end-to-end verification

**Files:**
- Modify: `frontend/src/pages/system/SystemKnowledgeBasePage.tsx`
- Modify: `docs/superpowers/plans/2026-08-07-universal-file-preview.md`
- Create: `docs/change-logs/2026-08-07-universal-file-preview-change-log.md`

**Interfaces:**
- Replaces the plain preview Modal with `UniversalFilePreview` while retaining existing upload, reparse, download, and delete behavior.

- [ ] **Step 1: Wire the public component into the knowledge-base page**

Keep `fetchSystemKnowledgeDocumentPreview` as the metadata request and pass its result into the public component. Add loading and error feedback around the preview action.

- [ ] **Step 2: Run focused and regression tests**

Run: `cd backend && node --test src/modules/system-knowledge-base/*.test.js`

Run: `cd frontend && npx vitest run src/components/file-preview/filePreview.test.ts src/pages/reporting/charts/echarts-word-cloud.test.ts`

Run: `cd frontend && npm run build`

Expected: all commands pass.

- [ ] **Step 3: Start services and perform browser acceptance**

Open the aviation semantic knowledge base and preview its two HTML files, SQL, both JSON files, and both Markdown files. Upload or use local samples for PDF, image, DOCX, XLSX, and PPTX. Confirm HTML interactivity, sandbox attributes, Office-to-PDF conversion, fallback behavior, download, and absence of console errors.

- [ ] **Step 4: Refresh the changed-file inventory**

Run `git status --short`, `git diff --stat`, and `git diff --check`. Write one structured delivery file at `docs/change-logs/2026-08-07-universal-file-preview-change-log.md` containing the original source file, original problem, implemented solution, source-code/configuration/dependency classification, test command, test result, and delivery status for every change. Separate committed feature files from unrelated pre-existing changes and include the final feature-file inventory in the same file.

- [ ] **Step 5: Commit coherent implementation slices**

Stage only files listed in this plan. Do not stage runtime caches, generated Vite files, build-info files, or unrelated dirty changes.
