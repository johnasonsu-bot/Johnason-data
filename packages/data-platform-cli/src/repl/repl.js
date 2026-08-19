const readline = require("node:readline/promises");

function tokenize(line) {
  const tokens = [];
  let value = "";
  let quote = null;
  let escaped = false;
  for (const character of line.trim()) {
    if (escaped) {
      value += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else value += character;
    } else if (character === "\"" || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (value) {
        tokens.push(value);
        value = "";
      }
    } else {
      value += character;
    }
  }
  if (escaped || quote) throw new SyntaxError("Unterminated escape or quote");
  if (value) tokens.push(value);
  return tokens;
}

function promptFor(context = {}) {
  return `data-platform[${context.profile || "-"}/${context.project || "-"}]> `;
}

async function runRepl({ input, output, executeArgv, getContext = () => ({}) }) {
  if (!input || !output || typeof executeArgv !== "function") throw new TypeError("input, output, and executeArgv are required");
  const terminal = Boolean(input.isTTY && output.isTTY);
  const terminalInterface = readline.createInterface({ input, output, terminal });
  try {
    output.write(promptFor(getContext()));
    for await (const line of terminalInterface) {
      const trimmed = line.trim();
      if (!trimmed) {
        output.write(promptFor(getContext()));
        continue;
      }
      if (trimmed === "exit" || trimmed === "quit") {
        output.write("Goodbye\n");
        break;
      }
      if (trimmed === "context") {
        output.write(`${JSON.stringify(getContext())}\n`);
        output.write(promptFor(getContext()));
        continue;
      }
      let tokens;
      try {
        tokens = tokenize(trimmed);
      } catch (error) {
        output.write(`${JSON.stringify({ success: false, error: { code: "INPUT_INVALID", message: error.message } })}\n`);
        output.write(promptFor(getContext()));
        continue;
      }
      await executeArgv(tokens[0] === "help" ? ["--help", ...tokens.slice(1)] : tokens);
      output.write(promptFor(getContext()));
    }
  } finally {
    terminalInterface.close();
  }
}

module.exports = { runRepl, tokenize, promptFor };
