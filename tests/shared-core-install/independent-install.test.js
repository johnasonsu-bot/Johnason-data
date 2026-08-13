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

function writeKernelFileAuditor(auditorPath) {
  fs.writeFileSync(auditorPath, [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    'const prefix = fs.realpathSync(process.env.KERNEL_PREFIX);',
    'function audit(filePath) {',
    '  if (typeof filePath !== "string" && !Buffer.isBuffer(filePath)) return;',
    '  const resolved = path.resolve(String(filePath));',
    '  if (resolved !== prefix && !resolved.startsWith(prefix + path.sep)) {',
    '    throw new Error(`kernel-install-audit: prefix escape: ${resolved}`);',
    '  }',
    '}',
    'function guard(container, method) {',
    '  const original = container[method];',
    '  container[method] = function guardedFileAccess(...args) {',
    '    audit(args[0]);',
    '    return original.apply(this, args);',
    '  };',
    '}',
    'for (const method of ["openSync", "readFileSync", "open", "readFile"]) guard(fs, method);',
    'for (const method of ["open", "readFile"]) guard(fs.promises, method);',
  ].join("\n"));
}

test("kernel tarball installs and loads without files outside its temporary prefix", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kernel-independent-install-"));
  const tarballs = path.join(temporaryRoot, "tarballs");
  const prefix = path.join(temporaryRoot, "prefix");
  const consumer = path.join(temporaryRoot, "consumer");
  const auditor = path.join(temporaryRoot, "audit-kernel-files.cjs");
  const outsideFile = path.join(temporaryRoot, "outside.txt");
  fs.mkdirSync(tarballs);
  fs.mkdirSync(consumer);
  fs.writeFileSync(outsideFile, "outside the install prefix\n");
  writeKernelFileAuditor(auditor);

  try {
    const pack = run("npm", ["pack", "--pack-destination", tarballs], { cwd: kernelDirectory });
    assert.equal(pack.status, 0, pack.stderr);
    const tarball = path.join(tarballs, fs.readdirSync(tarballs).find((file) => file.endsWith(".tgz")));

    const install = run("npm", ["install", "--prefix", prefix, "--ignore-scripts", tarball]);
    assert.equal(install.status, 0, install.stderr);

    const load = run(process.execPath, ["--require", auditor, "-e", [
      'const value = require("@johnason/data-platform-core-kernel");',
      'const prefix = require("node:fs").realpathSync(process.env.KERNEL_PREFIX);',
      'const auditor = require("node:fs").realpathSync(process.env.KERNEL_AUDITOR);',
      'for (const file of Object.keys(require.cache)) {',
      '  if (file === auditor) continue;',
      '  if (!file.startsWith(prefix + require("node:path").sep)) throw new Error(`loaded outside prefix: ${file}`);',
      '}',
      'if (typeof value.validateModuleManifest !== "function") throw new Error("kernel did not load");',
    ].join("\n")], {
      cwd: consumer,
      env: {
        KERNEL_PREFIX: prefix,
        KERNEL_AUDITOR: auditor,
        NODE_PATH: path.join(prefix, "node_modules"),
      },
    });
    assert.equal(load.status, 0, load.stderr);

    const escapeAttempt = run(process.execPath, ["--require", auditor, "-e", 'require("node:fs").readFileSync(process.env.OUTSIDE_FILE);'], {
      cwd: consumer,
      env: {
        KERNEL_PREFIX: prefix,
        KERNEL_AUDITOR: auditor,
        NODE_PATH: path.join(prefix, "node_modules"),
        OUTSIDE_FILE: outsideFile,
      },
    });
    assert.notEqual(escapeAttempt.status, 0, escapeAttempt.stderr);
    assert.match(escapeAttempt.stderr, /kernel-install-audit/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
