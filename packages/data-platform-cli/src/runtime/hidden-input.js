const readline = require("node:readline");

function defaultSetEcho(input) {
  if (!input?.isTTY || typeof input.setRawMode !== "function") return () => {};
  const previous = input.isRaw === true;
  return (enabled) => input.setRawMode(enabled ? previous : true);
}

function readLine(input) {
  return new Promise((resolve, reject) => {
    const interface_ = readline.createInterface({ input, terminal: false });
    interface_.once("line", (line) => {
      interface_.close();
      resolve(line);
    });
    interface_.once("error", reject);
  });
}

async function readHiddenInput({
  prompt = "Password: ",
  input = process.stdin,
  output = process.stderr,
  setEcho,
  read,
} = {}) {
  if (!output || typeof output.write !== "function") throw new TypeError("Hidden input output must expose write()");
  const echo = setEcho || defaultSetEcho(input);
  const reader = read || (() => readLine(input));
  output.write(prompt);
  echo(false);
  try {
    return await reader();
  } finally {
    echo(true);
    if (input?.isTTY) output.write("\n");
  }
}

module.exports = { readHiddenInput };
