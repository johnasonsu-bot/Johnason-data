const assert = require("node:assert/strict");
const { Readable, Writable } = require("node:stream");
const test = require("node:test");

const { main } = require("../src/main");
const { runRepl, tokenizeCommandLine } = require("../src/repl/repl");

function capture({ isTTY = true } = {}) {
  let value = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      value += String(chunk);
      callback();
    },
  });
  stream.isTTY = isTTY;
  return { stream, value: () => value };
}

function registry(commands = ["auth login", "project list", "system doctor"]) {
  return Object.freeze({
    values() { return commands.map((command) => Object.freeze({ command })); },
  });
}

test("REPL shows profile/project context, executes shared argv, and exits cleanly", async () => {
  const output = capture();
  const calls = [];
  await runRepl({
    registry: registry(),
    executeArgv: async (argv) => { calls.push(argv); return 0; },
    input: Readable.from(["context\n", "project list --json\n", "exit\n"]),
    output: output.stream,
    getContext: async () => ({ profile: "dev", projectCode: "aviation" }),
  });

  assert.deepEqual(calls, [["project", "list", "--json"]]);
  assert.match(output.value(), /data-platform\[dev\/aviation\]> /);
  assert.match(output.value(), /"profile":"dev"/);
  assert.match(output.value(), /Goodbye/);
});

test("quoted tokenizer handles local escapes and rejects unfinished input without shell evaluation", () => {
  assert.deepEqual(tokenizeCommandLine("project resolve --name 'Air Traffic' --code air\\ space"), [
    "project", "resolve", "--name", "Air Traffic", "--code", "air space",
  ]);
  assert.deepEqual(tokenizeCommandLine("auth login --username \"a\\\"lice\""), [
    "auth", "login", "--username", "a\"lice",
  ]);
  assert.throws(() => tokenizeCommandLine("project resolve --name 'unfinished"), /unterminated quote/i);
  assert.throws(() => tokenizeCommandLine("project resolve trailing\\"), /unfinished escape/i);
});

test("help is registry-derived and EOF ends the session", async () => {
  const output = capture();
  let executions = 0;
  await runRepl({
    registry: registry(["project list", "auth profile"]),
    executeArgv: async () => { executions += 1; },
    input: Readable.from(["help\n"]),
    output: output.stream,
    getContext: () => ({ profile: "dev", projectId: 42 }),
  });

  assert.equal(executions, 0);
  assert.match(output.value(), /auth profile/);
  assert.match(output.value(), /project list/);
  assert.match(output.value(), /Goodbye/);
});

test("executor and parser errors are rendered safely and the next line still runs", async () => {
  const output = capture();
  const calls = [];
  await runRepl({
    registry: registry(),
    executeArgv: async (argv) => {
      calls.push(argv);
      if (argv[0] === "fail") throw Object.assign(new Error("dependency unavailable"), { code: "DEPENDENCY_UNAVAILABLE" });
      return 0;
    },
    input: Readable.from(["fail now\n", "project resolve --name 'unfinished\n", "project list\n", "quit\n"]),
    output: output.stream,
    getContext: () => ({ profile: "dev", projectId: 42 }),
  });

  assert.deepEqual(calls, [["fail", "now"], ["project", "list"]]);
  assert.match(output.value(), /DEPENDENCY_UNAVAILABLE: dependency unavailable/);
  assert.match(output.value(), /INVALID_INPUT: Unterminated quote/);
});

test("sensitive arguments are neither echoed nor leaked through executor diagnostics", async () => {
  const output = capture();
  await runRepl({
    registry: registry(),
    executeArgv: async (argv) => {
      throw new Error(`rejected credential ${argv.at(-1)}`);
    },
    input: Readable.from(["auth login --password ultra-secret\n", "exit\n"]),
    output: output.stream,
    getContext: () => ({ profile: "dev", projectId: 42 }),
  });

  assert.equal(output.value().includes("ultra-secret"), false);
  assert.match(output.value(), /\[REDACTED\]/);
});

test("main enters the real REPL hook only for no-argv TTY input", async () => {
  const output = capture();
  const input = Readable.from(["exit\n"]);
  input.isTTY = true;
  let hookArguments;
  const runReplHook = async (options) => {
    hookArguments = options;
    return runRepl(options);
  };
  const dependencies = {
    stdin: input,
    stdout: output.stream,
    stderr: capture({ isTTY: false }).stream,
    createCommands: () => [],
    runRepl: runReplHook,
    getContext: () => ({ profile: "dev", projectId: 42 }),
  };

  assert.equal(await main([], dependencies), 0);
  assert.equal(typeof hookArguments.executeArgv, "function");
  assert.equal(hookArguments.input, input);
  assert.equal(hookArguments.output, output.stream);
  assert.match(output.value(), /data-platform\[dev\/42\]> /);
});

test("JSON without a subcommand never enters REPL and exits 2", async () => {
  let replCalls = 0;
  const output = capture();
  const input = Readable.from([]);
  input.isTTY = true;
  assert.equal(await main(["--json"], {
    stdin: input,
    stdout: output.stream,
    stderr: capture({ isTTY: false }).stream,
    createCommands: () => [],
    async runRepl() { replCalls += 1; },
  }), 2);
  assert.equal(replCalls, 0);
});
