const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "../..");
const kernelDirectory = path.join(workspaceRoot, "packages/data-platform-core-kernel");

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

test("kernel tarball installs and loads without files outside its temporary prefix", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kernel-independent-install-"));
  const tarballs = path.join(temporaryRoot, "tarballs");
  const prefix = path.join(temporaryRoot, "prefix");
  const consumer = path.join(temporaryRoot, "consumer");
  fs.mkdirSync(tarballs);
  fs.mkdirSync(consumer);

  try {
    const pack = run("npm", ["pack", "--pack-destination", tarballs], { cwd: kernelDirectory });
    assert.equal(pack.status, 0, pack.stderr);
    const tarball = path.join(tarballs, fs.readdirSync(tarballs).find((file) => file.endsWith(".tgz")));

    const install = run("npm", ["install", "--prefix", prefix, "--ignore-scripts", tarball]);
    assert.equal(install.status, 0, install.stderr);

    const load = run(process.execPath, ["-e", [
      'const value = require("@johnason/data-platform-core-kernel");',
      'const prefix = require("node:fs").realpathSync(process.env.KERNEL_PREFIX);',
      'for (const file of Object.keys(require.cache)) {',
      '  if (!file.startsWith(prefix + require("node:path").sep)) throw new Error(`loaded outside prefix: ${file}`);',
      '}',
      'if (typeof value.validateModuleManifest !== "function") throw new Error("kernel did not load");',
    ].join("\n")], {
      cwd: consumer,
      env: {
        KERNEL_PREFIX: prefix,
        NODE_PATH: path.join(prefix, "node_modules"),
      },
    });
    assert.equal(load.status, 0, load.stderr);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
