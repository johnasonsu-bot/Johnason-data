const { redact } = require("./redaction");

function safeGet(value, key) {
  try {
    return value?.[key];
  } catch {
    return undefined;
  }
}

function successEnvelope(data, options = {}) {
  return {
    success: true,
    data: redact(data),
    meta: options.meta === undefined ? null : redact(options.meta),
    auditId: options.auditId ?? null,
  };
}

function errorEnvelope(error, auditId = null) {
  const candidate = error && (typeof error === "object" || typeof error === "function") ? error : {};
  const code = safeGet(candidate, "code");
  const message = safeGet(candidate, "message");
  const details = safeGet(candidate, "details");
  const publicError = {
    code: typeof code === "string" && code.length > 0 ? code : "INTERNAL_ERROR",
    message: typeof message === "string" && message.length > 0 ? redact(message) : "Internal error",
    retryable: safeGet(candidate, "retryable") === true,
  };
  if (details !== undefined) publicError.details = redact(details);
  return {
    success: false,
    error: publicError,
    auditId: auditId ?? null,
  };
}

function exitCodeFor(error) {
  if (safeGet(error, "success") === true) return 0;
  const statusCode = Number(safeGet(error, "statusCode") ?? safeGet(error, "status"));
  const code = String(safeGet(error, "code") || "").toUpperCase();

  if (statusCode === 207 || code === "PARTIAL_SUCCESS") return 8;
  if ([400, 422].includes(statusCode) || /(?:^|_)(?:INVALID|VALIDATION_FAILED|BAD_REQUEST)$/.test(code)) return 2;
  if (statusCode === 401 || /(?:UNAUTHENTICATED|AUTHENTICATION_REQUIRED|AUTH_REQUIRED)$/.test(code)) return 3;
  if (statusCode === 403 || /(?:FORBIDDEN|PERMISSION_DENIED|READ_ONLY_DENIED)$/.test(code)) return 4;
  if (statusCode === 404 || /(?:^|_)NOT_FOUND$/.test(code)) return 5;
  if (statusCode === 409 || /(?:CONFLICT|NOT_UNIQUE|ALREADY_EXISTS|DUPLICATE)$/.test(code)) return 6;
  if ([502, 503, 504].includes(statusCode)
    || ["DEPENDENCY_UNAVAILABLE", "DATABASE_UNAVAILABLE", "DATABASE_RUNTIME_MISSING", "KEYCHAIN_UNAVAILABLE"].includes(code)) return 7;
  return 1;
}

module.exports = { errorEnvelope, exitCodeFor, successEnvelope };
