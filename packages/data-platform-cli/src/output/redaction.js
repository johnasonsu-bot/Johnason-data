const SENSITIVE_KEY = /password|secret|token|authorization|api[-_]?key|credential/i;
const URI_AUTHORITY_PASSWORD = /\b([a-z][a-z\d+.-]*:\/\/[^/\s@]*?):[^@/\s?#]*(@)/gi;

const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";
const UNSERIALIZABLE = "[UNSERIALIZABLE]";
const BINARY = "[BINARY]";

function redactUriAuthorityPasswords(value) {
  return value.replace(URI_AUTHORITY_PASSWORD, `$1:${REDACTED}$2`);
}

function assign(target, key, value) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

function redact(value, seen = new WeakSet()) {
  if (value === null) return null;
  if (typeof value === "string") return redactUriAuthorityPasswords(value);
  if (typeof value === "bigint") return String(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "boolean") return value;
  if (["undefined", "function", "symbol"].includes(typeof value)) return UNSERIALIZABLE;
  try {
    if (Buffer.isBuffer(value) || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return BINARY;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? UNSERIALIZABLE : value.toISOString();
  } catch {
    return UNSERIALIZABLE;
  }
  if (seen.has(value)) return CIRCULAR;

  seen.add(value);
  if (Array.isArray(value)) {
    try {
      const result = value.map((item) => redact(item, seen));
      seen.delete(value);
      return result;
    } catch {
      seen.delete(value);
      return UNSERIALIZABLE;
    }
  }

  const result = {};
  let keys;
  try {
    keys = value instanceof Error
      ? [...new Set(["name", "message", "code", "retryable", "details", ...Object.keys(value)])]
      : Object.keys(value);
  } catch {
    seen.delete(value);
    return UNSERIALIZABLE;
  }
  for (const key of keys) {
    if (SENSITIVE_KEY.test(key)) {
      assign(result, key, REDACTED);
      continue;
    }
    let child;
    try {
      child = value[key];
    } catch {
      assign(result, key, UNSERIALIZABLE);
      continue;
    }
    if (child !== undefined || Object.prototype.hasOwnProperty.call(value, key)) {
      assign(result, key, redact(child, seen));
    }
  }
  seen.delete(value);
  return result;
}

module.exports = {
  BINARY,
  CIRCULAR,
  REDACTED,
  SENSITIVE_KEY,
  UNSERIALIZABLE,
  redact,
  redactUriAuthorityPasswords,
};
