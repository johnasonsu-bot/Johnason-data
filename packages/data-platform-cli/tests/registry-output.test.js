const test = require("node:test");
const assert = require("node:assert/strict");

const { redact, errorEnvelope, exitCodeFor, writeNdjsonText } = require("../src/output");

test("recursively redacts credentials and URI passwords", () => {
  assert.deepEqual(redact({
    password: "x",
    nested: { token: "y", host: "db", uri: "mysql://alice:secret@db/platform" },
  }), {
    password: "[REDACTED]",
    nested: { token: "[REDACTED]", host: "db", uri: "mysql://alice:[REDACTED]@db/platform" },
  });
});

test("error envelopes are redacted", () => {
  const value = errorEnvelope(Object.assign(new Error("failed mysql://alice:pw@db/platform"), {
    details: { authorization: "Bearer signed" },
  }));
  assert.equal(value.error.details.authorization, "[REDACTED]");
  assert.match(value.error.message, /\[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(value), /signed|alice:pw/);
});

test("maps stable exit codes", () => {
  assert.equal(exitCodeFor({ code: "INPUT_INVALID" }), 2);
  assert.equal(exitCodeFor({ code: "SESSION_INVALID" }), 3);
  assert.equal(exitCodeFor({ code: "MODULE_PERMISSION_FORBIDDEN" }), 4);
  assert.equal(exitCodeFor({ statusCode: 404 }), 5);
  assert.equal(exitCodeFor({ statusCode: 409 }), 6);
  assert.equal(exitCodeFor({ code: "KEYCHAIN_UNAVAILABLE" }), 7);
  assert.equal(exitCodeFor({ code: "PARTIAL_SUCCESS" }), 8);
  assert.equal(exitCodeFor(new Error("unknown")), 1);
});

test("renders collected NDJSON buffers line by line with redaction", async () => {
  let output = "";
  await writeNdjsonText({ write(chunk) { output += chunk; } }, Buffer.from('{"event":"row","token":"hidden"}\n{"event":"done"}\n'));
  const lines = output.trim().split("\n").map(JSON.parse);
  assert.deepEqual(lines, [
    { event: "row", token: "[REDACTED]" },
    { event: "done" },
  ]);
});
