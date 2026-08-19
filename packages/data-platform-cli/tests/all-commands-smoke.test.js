const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");

const { createCapabilityCatalog } = require("@johnason/data-platform-core");
const { createProgram } = require("../src/main");

test("every generated command parses and invokes its default shared-core capability", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "data-platform-all-commands-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const runtime = {
    catalog: createCapabilityCatalog(),
    async executeCapability(capabilityId) {
      calls.push(capabilityId);
      return { data: Buffer.from("ok") };
    },
  };
  const stdin = Readable.from([]);
  stdin.isTTY = false;
  const sink = { write() {} };
  const { definitions } = createProgram({ runtime, stdout: sink, stderr: sink });

  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const argv = ["--json", ...definition.command.split(" ")];
    if (definition.requiresYes) argv.push("--yes");
    if (definition.requiresOutput) argv.push("--output", path.join(root, `${index}.out`));
    if (definition.command === "auth login") argv.push("--username", "smoke", "--password-stdin");
    const before = calls.length;
    const created = createProgram({ runtime, stdin, stdout: sink, stderr: sink, secretReader: async () => "not-persisted" });
    await created.program.parseAsync(argv, { from: "user" });
    assert.equal(calls.length, before + 1, definition.command);
    assert.equal(calls.at(-1), definition.capabilityIds[0], definition.command);
  }
  assert.equal(definitions.length, 570);
  assert.equal(calls.length, definitions.length);
});
