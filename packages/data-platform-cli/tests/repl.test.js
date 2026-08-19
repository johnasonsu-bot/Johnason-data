const test = require("node:test");
const assert = require("node:assert/strict");
const { PassThrough, Readable } = require("node:stream");

const { runRepl, tokenize, promptFor } = require("../src/repl/repl");
const { main } = require("../src/main");

function capture({ tty = false } = {}) {
  let value = "";
  const stream = new PassThrough();
  stream.isTTY = tty;
  stream.on("data", (chunk) => { value += chunk; });
  return { stream, value: () => value };
}

test("REPL tokenizes quotes and escapes without shell evaluation", () => {
  assert.deepEqual(tokenize("project resolve --name 'Flight Ops' --code A\\ B"), ["project", "resolve", "--name", "Flight Ops", "--code", "A B"]);
  assert.throws(() => tokenize("project resolve 'broken"), /unterminated/i);
});

test("REPL reuses argv execution and exposes profile/project context", async () => {
  const input = Readable.from(["context\nproject resolve --name 'Flight Ops'\nexit\n"]);
  const output = capture();
  const calls = [];
  await runRepl({
    input,
    output: output.stream,
    getContext: () => ({ profile: "dev", project: 9 }),
    executeArgv: async (argv) => { calls.push(argv); },
  });
  assert.deepEqual(calls, [["project", "resolve", "--name", "Flight Ops"]]);
  assert.match(output.value(), /"profile":"dev"/);
  assert.match(output.value(), /Goodbye/);
  assert.equal(promptFor({ profile: "dev", project: 9 }), "data-platform[dev/9]> ");
});

test("JSON mode without a command fails once and never enters REPL", async () => {
  const input = Readable.from(["exit\n"]);
  input.isTTY = true;
  const output = capture({ tty: true });
  const errors = capture();
  const code = await main(["--json"], {
    runtime: { catalog: new Map(), executeCapability() {} },
    stdin: input,
    stdout: output.stream,
    stderr: errors.stream,
  });
  assert.equal(code, 2);
  assert.equal(output.value().trim().split("\n").length, 1);
  assert.equal(JSON.parse(output.value()).error.code, "COMMAND_REQUIRED");
  assert.doesNotMatch(output.value(), /Goodbye|data-platform\[/);
});
