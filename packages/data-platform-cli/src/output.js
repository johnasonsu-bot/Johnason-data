const secretKey = /password|secret|token|authorization|api[-_]?key|credential/i;
const uriPassword = /([a-z][a-z0-9+.-]*:\/\/[^:/\s]+:)([^@/\s]+)(@)/gi;

function redact(value, seen = new WeakSet()) {
  if (typeof value === "string") return value.replace(uriPassword, "$1[REDACTED]$3");
  if (!value || typeof value !== "object") return value;
  if (Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, seen));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    secretKey.test(key) ? "[REDACTED]" : redact(child, seen),
  ]));
}

function envelope(data, metadata = {}) {
  return {
    success: true,
    data: redact(data),
    ...redact(metadata),
  };
}

function errorEnvelope(error) {
  return redact({
    success: false,
    error: {
      code: error.code || "CLI_EXECUTION_FAILED",
      message: error.message || "Command failed",
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  });
}

function exitCodeFor(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  const code = String(error?.code || "").toUpperCase();
  if (status === 401 || /UNAUTHENTICATED|SESSION_|TOKEN_|USER_DISABLED/.test(code)) return 3;
  if (status === 403 || /FORBIDDEN|PERMISSION/.test(code)) return 4;
  if (status === 404 || /NOT_FOUND/.test(code)) return 5;
  if (status === 409 || /CONFLICT|DUPLICATE|ALREADY_EXISTS/.test(code)) return 6;
  if (status === 503 || /UNAVAILABLE|CONNECTION|DRIVER_MISSING|KEYCHAIN|DEPENDENCY|RUNTIME_SECRET_MISSING/.test(code)) return 7;
  if (/PARTIAL/.test(code)) return 8;
  if (status === 400 || error instanceof SyntaxError || code.startsWith("COMMANDER.") || /INVALID|REQUIRED|MISSING|CONFLICT|PROFILE_REQUIRED|UNKNOWN_COMMAND|API_ALIAS/.test(code)) return 2;
  return 1;
}

function writeJson(stream, value) {
  stream.write(`${JSON.stringify(redact(value))}\n`);
}

function writeNdjson(stream, value) {
  if (value && typeof value[Symbol.asyncIterator] === "function") {
    return (async () => {
      for await (const item of value) writeJson(stream, item);
    })();
  }
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) writeJson(stream, item);
  return Promise.resolve();
}

function writeNdjsonText(stream, value) {
  const content = Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { writeJson(stream, JSON.parse(line)); } catch { writeJson(stream, line); }
  }
  return Promise.resolve();
}

module.exports = { redact, envelope, errorEnvelope, exitCodeFor, writeJson, writeNdjson, writeNdjsonText };
