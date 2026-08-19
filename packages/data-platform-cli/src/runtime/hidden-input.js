function readAll(input) {
  return new Promise((resolve, reject) => {
    let value = "";
    input.setEncoding?.("utf8");
    input.on("data", (chunk) => { value += chunk; });
    input.once("end", () => resolve(value.replace(/[\r\n]+$/, "")));
    input.once("error", reject);
  });
}

function readHiddenInput({ input = process.stdin, output = process.stderr, prompt = "Secret: " } = {}) {
  if (!input.isTTY || typeof input.setRawMode !== "function") return readAll(input);
  return new Promise((resolve, reject) => {
    let value = "";
    const previousRaw = Boolean(input.isRaw);
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(previousRaw);
      input.pause();
    };
    const onData = (chunk) => {
      const text = String(chunk);
      for (const character of text) {
        if (character === "\u0003") {
          cleanup();
          output.write("\n");
          const error = new Error("Secret input cancelled");
          error.code = "INPUT_CANCELLED";
          reject(error);
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

module.exports = { readHiddenInput };
