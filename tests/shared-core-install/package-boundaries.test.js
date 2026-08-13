const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { scanPackageBoundaries } = require("../../scripts/check-core-package-boundaries");

function withFixture(packages, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "core-boundaries-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "fixture-root",
    private: true,
    workspaces: ["packages/*", "backend", "frontend"],
  }, null, 2));

  try {
    for (const fixture of packages) {
      const packageDirectory = path.join(root, fixture.directory);
      fs.mkdirSync(path.join(packageDirectory, "src"), { recursive: true });
      fs.writeFileSync(path.join(packageDirectory, "package.json"), JSON.stringify({
        version: "0.1.0",
        main: "src/index.js",
        ...fixture.package,
      }, null, 2));
      fs.writeFileSync(path.join(packageDirectory, "src/index.js"), fixture.source ?? "module.exports = {};\n");
    }
    return callback(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function packageFixture(directory, name, options = {}) {
  return {
    directory,
    package: {
      name,
      dependencies: options.dependencies ?? {},
    },
    source: options.source,
  };
}

function violationCodes(result) {
  return result.violations.map(({ code }) => code);
}

test("reports TRANSPORT_IMPORT when the kernel imports Express", () => withFixture([
  packageFixture("packages/kernel", "@fixture/data-platform-core-kernel", {
    dependencies: { express: "4.21.2" },
    source: 'require("express");\n',
  }),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["TRANSPORT_IMPORT"]);
}));

test("reports TRANSPORT_IMPORT when the kernel declares Express without loading it", () => withFixture([
  packageFixture("packages/kernel", "@fixture/data-platform-core-kernel", {
    dependencies: { express: "4.21.2" },
  }),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["TRANSPORT_IMPORT"]);
}));

test("reports SOURCE_PATH_IMPORT when the CLI imports backend source", () => withFixture([
  packageFixture("packages/cli", "@fixture/data-platform-cli", {
    source: 'require("../../backend/src");\n',
  }),
  packageFixture("backend", "@fixture/data-platform-backend"),
], (root) => {
  const result = scanPackageBoundaries(root);
  assert.deepEqual(violationCodes(result), ["SOURCE_PATH_IMPORT"]);
  assert.deepEqual(result.sourceImports, [{
    from: "packages/cli/src/index.js",
    target: "../../backend/src",
  }]);
}));

test("reports SOURCE_PATH_IMPORT when a module imports another module's src directory", () => withFixture([
  packageFixture("packages/module-a", "@fixture/data-platform-core-module-a", {
    dependencies: { "@fixture/data-platform-core-module-b": "0.1.0" },
    source: 'require("@fixture/data-platform-core-module-b/src");\n',
  }),
  packageFixture("packages/module-b", "@fixture/data-platform-core-module-b"),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["SOURCE_PATH_IMPORT"]);
}));

test("reports REVERSE_DEPENDENCY when the kernel depends on a core module", () => withFixture([
  packageFixture("packages/kernel", "@fixture/data-platform-core-kernel", {
    dependencies: { "@fixture/data-platform-core-module-a": "0.1.0" },
  }),
  packageFixture("packages/module-a", "@fixture/data-platform-core-module-a"),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["REVERSE_DEPENDENCY"]);
}));

test("reports CYCLE for circular internal package dependencies", () => withFixture([
  packageFixture("packages/module-a", "@fixture/data-platform-core-module-a", {
    dependencies: { "@fixture/data-platform-core-module-b": "0.1.0" },
  }),
  packageFixture("packages/module-b", "@fixture/data-platform-core-module-b", {
    dependencies: { "@fixture/data-platform-core-module-a": "0.1.0" },
  }),
], (root) => {
  const result = scanPackageBoundaries(root);
  assert.deepEqual(violationCodes(result), ["CYCLE"]);
  assert.deepEqual(result.cycles, [[
    "packages/module-a",
    "packages/module-b",
    "packages/module-a",
  ]]);
}));

test("reports NON_EXACT_VERSION for a direct dependency version that is not an exact semver", () => withFixture([
  packageFixture("packages/module", "@fixture/data-platform-core-module", {
    dependencies: { zod: "^3.24.1" },
  }),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["NON_EXACT_VERSION"]);
}));

test("accepts a Web and CLI to aggregate to modules to kernel dependency graph", () => withFixture([
  packageFixture("frontend", "@fixture/data-platform-web", {
    dependencies: { "@fixture/data-platform-core": "0.1.0" },
  }),
  packageFixture("packages/cli", "@fixture/data-platform-cli", {
    dependencies: { "@fixture/data-platform-core": "0.1.0" },
  }),
  packageFixture("packages/core", "@fixture/data-platform-core", {
    dependencies: { "@fixture/data-platform-core-module-a": "0.1.0" },
  }),
  packageFixture("packages/module-a", "@fixture/data-platform-core-module-a", {
    dependencies: { "@fixture/data-platform-core-kernel": "0.1.0" },
  }),
  packageFixture("packages/kernel", "@fixture/data-platform-core-kernel"),
], (root) => {
  assert.deepEqual(scanPackageBoundaries(root), {
    violations: [],
    cycles: [],
    sourceImports: [],
  });
}));
