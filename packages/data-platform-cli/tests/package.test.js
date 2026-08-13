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
