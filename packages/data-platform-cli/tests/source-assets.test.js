const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const inventory = require("../../../docs/cli/source/api-inventory.json");
const bindings = require("../../../docs/superpowers/specs/data-platform-cli-handler-bindings.json");

function sha256(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

test("three acceptance source assets match the architecture-approved fingerprints", () => {
  assert.equal(sha256("docs/cli/source/api-inventory.json"), "6cd896d1e38fb54ebd8317842eb618c4a28ede4eecf5e09f5bfb16374d696d0f");
  assert.equal(sha256("docs/cli/source/PROJECT_OPERATION_MANUAL.md"), "619cf9c139ebd49788acd8a1a7440d5d8574cb9034b4bb7e13de1a14ca8db350");
  assert.equal(sha256("docs/cli/source/project-operation-knowledge-graph.html"), "1fa8acde4615bc6bed8af23ad277fde1089643781bbb1414dd45d5302c03468f");
});

test("inventory totals and every route handler binding are complete", () => {
  assert.deepEqual(inventory.summary, { moduleCount: 23, routeCount: 596, frontendPathCount: 84, routeFiles: 24 });
  assert.deepEqual(bindings.gates, { expected: 596, bound: 596, unresolved: 0 });
  assert.equal(new Set(bindings.bindings.map((entry) => entry.apiKey)).size, 596);
  assert.ok(bindings.bindings.every((entry) => entry.status === "bound" && entry.handlerCalls.length > 0));
});
