const crypto = require("node:crypto");

const sensitiveKey = /(?:password|passphrase|token|secret|authorization|cookie|credential|api[_-]?key|access[_-]?key|private[_-]?key)/i;
const uriAuthorityPassword = /\b([a-z][a-z\d+.-]*:\/\/[^/\s@]*?):[^@/\s?#]*(@)/gi;
const oracleJdbcPassword = /(jdbc:oracle:thin:[^:/;@\s]+\/)[^@;\s]+(@)/gi;
const keyValueSecret = /(^|[;?&\s])((?:password|pwd|passphrase|secret|token|api[_-]?key|access[_-]?key)\s*=\s*)[^;&\s]*/gi;

function redactString(value) {
  return value
    .replace(/(bearer\s+)[^\s,;]+/ig, "$1[REDACTED]")
    .replace(uriAuthorityPassword, "$1:[REDACTED]$2")
    .replace(oracleJdbcPassword, "$1[REDACTED]$2")
    .replace(keyValueSecret, "$1$2[REDACTED]");
}

function normalizeContract(value, seen = new WeakSet()) {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || typeof value === "function" || typeof value === "symbol" || value === undefined) {
    throw new TypeError("Contract contains a non-JSON value");
  }
  if (typeof value !== "object") throw new TypeError("Contract contains an unsupported value");
  if (seen.has(value)) throw new TypeError("Contract contains a cycle");
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => normalizeContract(item, seen));
    return Object.fromEntries(Object.keys(value).sort().map((key) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : normalizeContract(value[key], seen),
    ]));
  } finally {
    seen.delete(value);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function serializeRedactedContract(value) {
  const normalized = normalizeContract(value);
  const json = JSON.stringify(normalized);
  return Object.freeze({
    json,
    sha256: crypto.createHash("sha256").update(json).digest("hex"),
    value: deepFreeze(normalized),
  });
}

function nonEmpty(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${label} is required`);
  return value.trim();
}

function digest(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${label} must be SHA-256`);
  return value.toLowerCase();
}

function projectScope(projectId) {
  if (projectId === undefined || projectId === null) return 0;
  const value = Number(projectId);
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("projectId must be a non-negative integer");
  return value;
}

function rowsFrom(result) {
  return Array.isArray(result?.[0]) ? result[0] : [];
}

async function findAcceptedCommand(input, connection) {
  const [rows] = await connection.execute(
    `SELECT command_id, status, result_ref, result_sha256
     FROM cli_commands
     WHERE project_id = ? AND capability_id = ? AND idempotency_key = ?
     FOR UPDATE`,
    [input.projectId, input.capabilityId, input.idempotencyKey],
  );
  return rows?.[0] || null;
}

function acceptedResult(row) {
  return Object.freeze({
    accepted: false,
    commandId: row.command_id,
    status: row.status,
    resultRef: row.result_ref,
    resultSha256: row.result_sha256,
  });
}

async function acceptCommand(candidate, connection) {
  if (!connection || typeof connection.execute !== "function") throw new TypeError("connection must expose execute");
  const input = {
    idempotencyKey: nonEmpty(candidate?.idempotencyKey, "idempotencyKey"),
    capabilityId: nonEmpty(candidate?.capabilityId, "capabilityId"),
    actor: serializeRedactedContract(candidate?.actor || {}),
    projectId: projectScope(candidate?.projectId),
    inputDigest: digest(candidate?.inputDigest, "inputDigest"),
  };
  const commandId = crypto.randomUUID();
  try {
    await connection.execute(
      `INSERT INTO cli_commands
       (command_id, project_id, capability_id, idempotency_key, actor_json, input_digest, status)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, 'accepted')`,
      [commandId, input.projectId, input.capabilityId, input.idempotencyKey, input.actor.json, input.inputDigest],
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_ENTRY") throw error;
    const original = await findAcceptedCommand(input, connection);
    if (!original) throw error;
    return acceptedResult(original);
  }
  return Object.freeze({ accepted: true, commandId, status: "accepted", resultRef: null, resultSha256: null });
}

async function completeCommand(candidate, connection) {
  const commandId = nonEmpty(candidate?.commandId, "commandId");
  const resultRef = nonEmpty(candidate?.resultRef, "resultRef");
  const result = serializeRedactedContract(candidate?.result ?? {});
  const [write] = await connection.execute(
    `UPDATE cli_commands
     SET status = 'succeeded', result_ref = ?, result_json = CAST(? AS JSON), result_sha256 = ?, completed_at = CURRENT_TIMESTAMP(3)
     WHERE command_id = ? AND status = 'accepted'`,
    [resultRef, result.json, result.sha256, commandId],
  );
  if (write?.affectedRows !== 1) throw new Error("Command result could not be fixed");
  return Object.freeze({ commandId, status: "succeeded", resultRef, resultSha256: result.sha256 });
}

async function appendAuditFact(candidate, connection) {
  const auditId = nonEmpty(candidate?.auditId, "auditId");
  const commandId = nonEmpty(candidate?.commandId, "commandId");
  const capabilityId = nonEmpty(candidate?.capabilityId, "capabilityId");
  const outcome = nonEmpty(candidate?.outcome, "outcome");
  const actor = serializeRedactedContract(candidate?.actor || {});
  const detail = serializeRedactedContract(candidate?.detail || {});
  await connection.execute(
    `INSERT INTO cli_audit_facts
     (audit_id, command_id, project_id, capability_id, actor_json, outcome, detail_json, detail_sha256)
     VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, CAST(? AS JSON), ?)`,
    [auditId, commandId, projectScope(candidate?.projectId), capabilityId, actor.json, outcome, detail.json, detail.sha256],
  );
  return Object.freeze({ auditId, commandId, detailSha256: detail.sha256 });
}

module.exports = {
  acceptCommand,
  appendAuditFact,
  completeCommand,
  serializeRedactedContract,
};
