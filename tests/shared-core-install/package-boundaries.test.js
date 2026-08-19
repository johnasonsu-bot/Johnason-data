const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { scanPackageBoundaries } = require("../../scripts/check-core-package-boundaries");

function fixture(t, packages) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-boundary-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [directory, files] of Object.entries(packages)) {
    const packageDir = path.join(root, "packages", directory);
    fs.mkdirSync(path.join(packageDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify(files.package));
    fs.writeFileSync(path.join(packageDir, "src/index.js"), files.source || "module.exports = {};\n");
  }
  return root;
}

test("valid aggregate to module to kernel graph has no violations", (t) => {
  const root = fixture(t, {
    kernel: { package: { name: "@x/kernel", version: "1.0.0" } },
    module: { package: { name: "@x/module-a", version: "1.0.0", dependencies: { "@x/kernel": "1.0.0" } } },
    core: { package: { name: "@x/core", version: "1.0.0", dependencies: { "@x/module-a": "1.0.0" } } },
    cli: { package: { name: "@x/cli", version: "1.0.0", dependencies: { "@x/core": "1.0.0" } } },
  });
  assert.deepEqual(scanPackageBoundaries(root).violations, []);
});

test("detects transport, source path, reverse, version, and cycle violations", (t) => {
  const root = fixture(t, {
    kernel: { package: { name: "@x/kernel", version: "1.0.0", dependencies: { "@x/module-a": "1.0.0", express: "4.0.0" } }, source: 'require("express");' },
    "module-a": { package: { name: "@x/module-a", version: "1.0.0", dependencies: { "@x/module-b": "^1.0.0" } }, source: 'require("@x/module-b/src/private");' },
    "module-b": { package: { name: "@x/module-b", version: "1.0.0", dependencies: { "@x/module-a": "1.0.0" } } },
  });
  const codes = new Set(scanPackageBoundaries(root).violations.map((entry) => entry.code));
  for (const code of ["TRANSPORT_IMPORT", "SOURCE_PATH_IMPORT", "REVERSE_DEPENDENCY", "NON_EXACT_VERSION", "CYCLE"]) {
    assert.ok(codes.has(code), code);
  }
});
