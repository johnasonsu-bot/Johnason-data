const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");

test("package exposes data-platform for Node 22.20+", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  assert.equal(pkg.name, "@johnason/data-platform-cli");
  assert.equal(pkg.bin["data-platform"], "bin/data-platform.js");
  assert.equal(pkg.engines.node, ">=22.20.0");
  assert.deepEqual(pkg.files.sort(), ["README.md", "bin", "src"].sort());
});

test("workspace local installer is pinned below .local and verifies the installed catalog", () => {
  const installer = fs.readFileSync(path.resolve(packageRoot, "../../scripts/install-local-data-platform-cli.js"), "utf8");
  assert.match(installer, /\.local", "data-platform-cli/);
  assert.match(installer, /Expected 24 tarballs/);
  assert.match(installer, /counts\.capabilities !== 596 \|\| counts\.modules !== 21/);
  assert.doesNotMatch(installer, /npm", \["install", "-g"/);
});
