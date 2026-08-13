const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const EVIDENCE_PATH = path.resolve(
  __dirname,
  "../../../evidence/module-acceptance/auth/0.1.0/legacy-accepted.json",
);
const SECRET_SHAPED_KEY = /secret|password|token|credential|authorization|storage(?:path)?/i;

function assertExactKeys(value, keys, location) {
  assert.equal(value && typeof value === "object" && !Array.isArray(value), true, `${location} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${location} keys`);
  for (const key of Object.keys(value)) assert.equal(SECRET_SHAPED_KEY.test(key), false, `${location}.${key} is secret-shaped`);
}

function validateLegacyAcceptedEvidence(value) {
  assertExactKeys(value, ["package", "version", "status", "tarball", "packManifest", "registry", "commands", "readback", "generatedAt"], "evidence");
  assert.equal(value.package, "@johnason/data-platform-module-auth");
  assert.equal(value.version, "0.1.0");
  assert.equal(value.status, "legacy-accepted");
  assert.match(value.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

  assertExactKeys(value.tarball, ["filename", "bytes", "sha512"], "tarball");
  assert.match(value.tarball.filename, /^johnason-data-platform-module-auth-0\.1\.0\.tgz$/);
  assert.equal(Number.isSafeInteger(value.tarball.bytes) && value.tarball.bytes > 0, true);
  assert.match(value.tarball.sha512, /^[a-f0-9]{128}$/);

  assertExactKeys(value.packManifest, ["fileCount", "files", "unpackedBytes"], "packManifest");
  assert.equal(value.packManifest.fileCount, value.packManifest.files.length);
  assert.equal(Number.isSafeInteger(value.packManifest.unpackedBytes) && value.packManifest.unpackedBytes > 0, true);
  assert.deepEqual(value.packManifest.files, [
    "package.json",
    "src/auth-session.repository.js",
    "src/auth.repository.js",
    "src/auth.service.js",
    "src/index.js",
    "src/session-policy.js",
  ]);

  assertExactKeys(value.registry, ["url"], "registry");
  const registryUrl = new URL(value.registry.url);
  assert.equal(registryUrl.protocol, "http:");
  assert.equal(registryUrl.hostname, "127.0.0.1");
  assert.equal(registryUrl.port, "4873");
  assert.equal(registryUrl.username, "");
  assert.equal(registryUrl.password, "");
  assert.equal(registryUrl.pathname, "/");
  assert.equal(registryUrl.search, "");
  assert.equal(registryUrl.hash, "");

  assertExactKeys(value.commands, ["pack", "publish", "tag", "readback"], "commands");
  for (const [name, result] of Object.entries(value.commands)) {
    assertExactKeys(result, ["exitStatus"], `commands.${name}`);
    assert.equal(result.exitStatus, 0, `commands.${name} exit status`);
  }

  assertExactKeys(value.readback, ["version", "tag", "integrity"], "readback");
  assert.equal(value.readback.version, value.version);
  assert.equal(value.readback.tag, value.status);
  assert.equal(value.readback.integrity, `sha512-${Buffer.from(value.tarball.sha512, "hex").toString("base64")}`);
}

test("legacy acceptance evidence is complete, non-secret, and has matching SHA-512 integrity", () => {
  validateLegacyAcceptedEvidence(JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8")));
});

test("legacy acceptance evidence rejects unexpected and secret-shaped fields", () => {
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8"));
  assert.throws(() => validateLegacyAcceptedEvidence({ ...evidence, token: "do-not-store" }), /keys|secret-shaped/);
  assert.throws(() => validateLegacyAcceptedEvidence({ ...evidence, registry: { ...evidence.registry, storagePath: "/private" } }), /keys|secret-shaped/);
});
