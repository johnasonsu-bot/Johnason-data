const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const evidencePath = path.resolve(__dirname, "../../../evidence/module-acceptance/project-spaces/0.1.0/legacy-accepted.json");
const secretShapedKey = /secret|password|token|credential|authorization|storage(?:path)?/i;

function exactKeys(value, keys, location) {
  assert.equal(value && typeof value === "object" && !Array.isArray(value), true, `${location} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${location} keys`);
  for (const key of Object.keys(value)) assert.equal(secretShapedKey.test(key), false, `${location}.${key} is secret-shaped`);
}

function validateEvidence(value) {
  exactKeys(value, ["package", "version", "status", "tarball", "packManifest", "registry", "commands", "readback", "generatedAt"], "evidence");
  assert.equal(value.package, "@johnason/data-platform-module-project-spaces");
  assert.equal(value.version, "0.1.0");
  assert.equal(value.status, "legacy-accepted");
  assert.match(value.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  exactKeys(value.tarball, ["filename", "bytes", "sha512"], "tarball");
  assert.match(value.tarball.filename, /^johnason-data-platform-module-project-spaces-0\.1\.0\.tgz$/);
  assert.equal(Number.isSafeInteger(value.tarball.bytes) && value.tarball.bytes > 0, true);
  assert.match(value.tarball.sha512, /^[a-f0-9]{128}$/);
  exactKeys(value.packManifest, ["fileCount", "files", "unpackedBytes"], "packManifest");
  assert.deepEqual(value.packManifest.files, ["package.json", "src/index.js", "src/project-policy.js", "src/project-space.repository.js", "src/project-space.service.js"]);
  assert.equal(value.packManifest.fileCount, value.packManifest.files.length);
  assert.equal(Number.isSafeInteger(value.packManifest.unpackedBytes) && value.packManifest.unpackedBytes > 0, true);
  exactKeys(value.registry, ["url"], "registry");
  const registryUrl = new URL(value.registry.url);
  assert.equal(registryUrl.protocol, "http:");
  assert.equal(registryUrl.hostname, "127.0.0.1");
  assert.equal(registryUrl.username, "");
  assert.equal(registryUrl.password, "");
  assert.equal(registryUrl.pathname, "/");
  assert.equal(registryUrl.search, "");
  assert.equal(registryUrl.hash, "");
  exactKeys(value.commands, ["pack", "publish", "tag", "readback"], "commands");
  for (const command of Object.values(value.commands)) {
    exactKeys(command, ["exitStatus"], "command");
    assert.equal(command.exitStatus, 0);
  }
  exactKeys(value.readback, ["version", "tag", "integrity"], "readback");
  assert.equal(value.readback.version, value.version);
  assert.equal(value.readback.tag, value.status);
  assert.equal(value.readback.integrity, `sha512-${Buffer.from(value.tarball.sha512, "hex").toString("base64")}`);
}

test("project legacy acceptance evidence is complete, non-secret, and has matching SHA-512 integrity", () => {
  validateEvidence(JSON.parse(fs.readFileSync(evidencePath, "utf8")));
});

test("project legacy acceptance evidence rejects unexpected and secret-shaped fields", () => {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.throws(() => validateEvidence({ ...evidence, token: "forbidden" }), /keys|secret-shaped/);
  assert.throws(() => validateEvidence({ ...evidence, registry: { ...evidence.registry, storagePath: "forbidden" } }), /keys|secret-shaped/);
});
