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
        files: ["src"],
        ...fixture.package,
      }, null, 2));
      fs.writeFileSync(path.join(packageDirectory, "src/index.js"), fixture.source ?? "module.exports = {};\n");
      for (const [relativePath, contents] of Object.entries(fixture.files ?? {})) {
        const filePath = path.join(packageDirectory, relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, contents);
      }
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
      ...options.package,
    },
    source: options.source,
    files: options.files,
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

test("reports TRANSPORT_IMPORT when a module declares Commander", () => withFixture([
  packageFixture("packages/module", "@fixture/data-platform-module-auth", {
    dependencies: { commander: "15.0.0" },
  }),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["TRANSPORT_IMPORT"]);
}));

test("reports TRANSPORT_IMPORT when a module requires an Express subpath without declaring it", () => withFixture([
  packageFixture("packages/module", "@fixture/data-platform-module-auth", {
    source: 'require("express/lib/application");\n',
  }),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["TRANSPORT_IMPORT"]);
}));

test("reports TRANSPORT_IMPORT when the kernel requires a Commander subpath without declaring it", () => withFixture([
  packageFixture("packages/kernel", "@fixture/data-platform-core-kernel", {
    source: 'require("commander/esm.mjs");\n',
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
  packageFixture("packages/module-a", "@fixture/data-platform-module-a", {
    dependencies: { "@fixture/data-platform-module-b": "0.1.0" },
    source: 'require("@fixture/data-platform-module-b/src");\n',
  }),
  packageFixture("packages/module-b", "@fixture/data-platform-module-b"),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["REVERSE_DEPENDENCY", "SOURCE_PATH_IMPORT"]);
}));

test("reports REVERSE_DEPENDENCY when the kernel depends on a core module", () => withFixture([
  packageFixture("packages/kernel", "@fixture/data-platform-core-kernel", {
    dependencies: { "@fixture/data-platform-module-a": "0.1.0" },
  }),
  packageFixture("packages/module-a", "@fixture/data-platform-module-a"),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["REVERSE_DEPENDENCY"]);
}));

test("reports CYCLE for circular internal package dependencies", () => withFixture([
  packageFixture("packages/module-a", "@fixture/data-platform-module-a", {
    dependencies: { "@fixture/data-platform-module-b": "0.1.0" },
  }),
  packageFixture("packages/module-b", "@fixture/data-platform-module-b", {
    dependencies: { "@fixture/data-platform-module-a": "0.1.0" },
  }),
], (root) => {
  const result = scanPackageBoundaries(root);
  assert.deepEqual(violationCodes(result), ["CYCLE", "REVERSE_DEPENDENCY", "REVERSE_DEPENDENCY"]);
  assert.deepEqual(result.cycles, [[
    "packages/module-a",
    "packages/module-b",
    "packages/module-a",
  ]]);
}));

test("reports NON_EXACT_VERSION for a direct dependency version that is not an exact semver", () => withFixture([
  packageFixture("packages/module", "@fixture/data-platform-module-auth", {
    dependencies: { caret: "^3.24.1", workspace: "workspace:*", local: "file:../local", git: "git+https://example.com/package.git" },
    package: { peerDependencies: { peer: "^1.0.0" } },
  }),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), [
    "NON_EXACT_VERSION",
    "NON_EXACT_VERSION",
    "NON_EXACT_VERSION",
    "NON_EXACT_VERSION",
    "NON_EXACT_VERSION",
  ]);
}));

test("accepts a Web and CLI to aggregate to modules to kernel dependency graph", () => withFixture([
  packageFixture("frontend", "@fixture/data-platform-web", {
    dependencies: { "@fixture/data-platform-core": "0.1.0" },
  }),
  packageFixture("packages/cli", "@fixture/data-platform-cli", {
    dependencies: { "@fixture/data-platform-core": "0.1.0" },
  }),
  packageFixture("packages/core", "@fixture/data-platform-core", {
    dependencies: { "@fixture/data-platform-module-a": "0.1.0" },
  }),
  packageFixture("packages/module-a", "@fixture/data-platform-module-a", {
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

test("reports REVERSE_DEPENDENCY for consumer source imports of kernel or module without manifest dependencies", () => {
  for (const target of ["@fixture/data-platform-core-kernel", "@fixture/data-platform-module-auth"]) {
    withFixture([
      packageFixture("packages/cli", "@fixture/data-platform-cli", { source: `require("${target}");\n` }),
      packageFixture("packages/kernel", "@fixture/data-platform-core-kernel"),
      packageFixture("packages/module", "@fixture/data-platform-module-auth"),
    ], (root) => {
      assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["REVERSE_DEPENDENCY"]);
    });
  }
});

test("reports REVERSE_DEPENDENCY for an otherwise valid internal require omitted from the manifest", () => withFixture([
  packageFixture("packages/cli", "@fixture/data-platform-cli", { source: 'require("@fixture/data-platform-core");\n' }),
  packageFixture("packages/core", "@fixture/data-platform-core"),
], (root) => {
  assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["REVERSE_DEPENDENCY"]);
}));

test("reports REVERSE_DEPENDENCY for module-to-module, module-to-aggregate, and module-to-consumer dependencies", () => {
  for (const [targetName, targetDirectory] of [
    ["@fixture/data-platform-module-b", "packages/module-b"],
    ["@fixture/data-platform-core", "packages/core"],
    ["@fixture/data-platform-daemon", "packages/daemon"],
  ]) {
    withFixture([
      packageFixture("packages/module-a", "@fixture/data-platform-module-a", { dependencies: { [targetName]: "0.1.0" } }),
      packageFixture(targetDirectory, targetName),
    ], (root) => {
      assert.deepEqual(violationCodes(scanPackageBoundaries(root)), ["REVERSE_DEPENDENCY"]);
    });
  }
});

test("scans published bin files and ignores tests and generated files", () => withFixture([
  packageFixture("packages/cli", "@fixture/data-platform-cli", {
    package: { files: ["bin", "src", "tests", "generated"], bin: { "fixture-cli": "bin/run.js" } },
    files: {
      "bin/run.js": 'require("../../backend/src");\n',
      "tests/ignored.js": 'require("../../backend/src");\n',
      "generated/ignored.js": 'require("../../backend/src");\n',
    },
  }),
  packageFixture("backend", "@fixture/data-platform-backend"),
], (root) => {
  assert.deepEqual(scanPackageBoundaries(root).sourceImports, [{
    from: "packages/cli/bin/run.js",
    target: "../../backend/src",
  }]);
}));

test("scans a string bin entry without traversing unpublished package-root files", () => withFixture([
  packageFixture("packages/cli", "@fixture/data-platform-cli", {
    package: { files: ["bin"], main: "bin/run.js", bin: "bin/run.js" },
    files: {
      "bin/run.js": 'require("../../backend/src");\n',
      "unpublished.js": 'require("../../backend/src");\n',
    },
  }),
  packageFixture("backend", "@fixture/data-platform-backend"),
], (root) => {
  assert.deepEqual(scanPackageBoundaries(root).sourceImports, [{
    from: "packages/cli/bin/run.js",
    target: "../../backend/src",
  }]);
}));

test("returns deterministic output regardless of fixture creation order", () => {
  const fixtures = [
    packageFixture("packages/cli", "@fixture/data-platform-cli", { source: 'require("@fixture/data-platform-core-kernel");\n' }),
    packageFixture("packages/kernel", "@fixture/data-platform-core-kernel", { source: 'require("express/lib/application");\n' }),
  ];
  const normal = withFixture(fixtures, scanPackageBoundaries);
  const reversed = withFixture([...fixtures].reverse(), scanPackageBoundaries);
  assert.deepEqual(normal, reversed);
});
