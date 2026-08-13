const readline = require("node:readline/promises");
const { redact, REDACTED } = require("../output/redaction");

const SENSITIVE_OPTION = /(?:password|secret|token|authorization|api[-_]?key|credential)/i;

function inputError(message) {
  const error = new Error(message);
  error.code = "INVALID_INPUT";
  error.statusCode = 400;
  return error;
}

function tokenizeCommandLine(line) {
  if (typeof line !== "string") throw new TypeError("REPL input must be a string");
  const argv = [];
  let token = "";
  let quote = null;
  let escaping = false;
  let started = false;

  for (const character of line) {
    if (escaping) {
      token += character;
      escaping = false;
      started = true;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      started = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
      started = true;
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (started) {
        argv.push(token);
        token = "";
        started = false;
      }
      continue;
    }
    token += character;
    started = true;
  }

  if (escaping) throw inputError("Unfinished escape sequence");
  if (quote) throw inputError("Unterminated quote");
  if (started) argv.push(token);
  return argv;
}

function safeGet(value, key) {
  try {
    return value?.[key];
  } catch {
    return undefined;
  }
}

function sensitiveValues(argv) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (typeof option !== "string" || !option.startsWith("--") || !SENSITIVE_OPTION.test(option)) continue;
    const separator = option.indexOf("=");
    if (separator >= 0) values.push(option.slice(separator + 1));
    else if (typeof argv[index + 1] === "string" && !argv[index + 1].startsWith("--")) values.push(argv[index + 1]);
  }
  return values.filter((value) => value.length > 0);
}

function replaceSensitiveValues(value, argv) {
  let safeValue = value;
  for (const secret of sensitiveValues(argv)) safeValue = safeValue.split(secret).join(REDACTED);
  return safeValue;
}

function renderError(error, argv = []) {
  const rawCode = safeGet(error, "code");
  const code = typeof rawCode === "string" && rawCode.length > 0 ? rawCode : "INTERNAL_ERROR";
  const rawMessage = safeGet(error, "message");
  const message = typeof rawMessage === "string" && rawMessage.length > 0 ? redact(rawMessage) : "Internal error";
  return `${code}: ${replaceSensitiveValues(message, argv)}`;
}

function contextParts(context) {
  const profile = typeof context?.profile === "string" ? context.profile : context?.profile?.name;
  const project = context?.projectCode
    ?? context?.project?.projectCode
    ?? context?.project?.code
    ?? context?.projectId
    ?? context?.project?.id;
  return { profile: profile || "-", project: project ?? "-" };
}

function promptFor(context) {
  const { profile, project } = contextParts(context);
  return `data-platform[${profile}/${project}]> `;
}

function helpText(registry) {
  const definitions = registry.values();
  const commands = [...new Set(definitions.map((definition) => definition.command))].sort();
  return ["Commands:", "  help", "  context", ...commands.map((command) => `  ${command}`), "  exit", "  quit"].join("\n");
}

async function runRepl({ registry, executeArgv, input, output, getContext = () => ({}) } = {}) {
  if (!registry || typeof registry.values !== "function") throw new TypeError("REPL registry must expose values()");
  if (typeof executeArgv !== "function") throw new TypeError("REPL executeArgv must be a function");
  if (!input || typeof input.on !== "function") throw new TypeError("REPL input must be a readable stream");
  if (!output || typeof output.write !== "function") throw new TypeError("REPL output must expose write()");
  if (typeof getContext !== "function") throw new TypeError("REPL getContext must be a function");

  const lines = readline.createInterface({ input, terminal: false, historySize: 0, crlfDelay: Infinity });
  let closedByCommand = false;
  try {
    output.write(promptFor(await getContext()));
    for await (const line of lines) {
      let argv = [];
      try {
        argv = tokenizeCommandLine(line);
        if (argv.length === 0) {
          output.write(promptFor(await getContext()));
          continue;
        }
        if (argv.length === 1 && ["exit", "quit"].includes(argv[0])) {
          closedByCommand = true;
          break;
        }
        if (argv.length === 1 && argv[0] === "help") output.write(`${helpText(registry)}\n`);
        else if (argv.length === 1 && argv[0] === "context") output.write(`${JSON.stringify(redact(await getContext()))}\n`);
        else await executeArgv(argv);
      } catch (error) {
        output.write(`${renderError(error, argv)}\n`);
      }
      output.write(promptFor(await getContext()));
    }
  } finally {
    lines.close();
  }
  if (closedByCommand || input.readableEnded) output.write("Goodbye\n");
}

module.exports = { runRepl, tokenizeCommandLine };
