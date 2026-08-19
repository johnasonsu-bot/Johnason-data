const crypto = require("node:crypto");
const { redact } = require("./value-utils");

function createAuditRepository(connection) {
  if (!connection || typeof connection.query !== "function") throw new TypeError("transaction connection is required");
  return {
    async appendAudit(input) {
      const id = input.auditId || crypto.randomUUID();
      await connection.query(
        "INSERT INTO cli_audit_facts (id, command_id, project_id, actor_id, capability_id, action, outcome, input_digest, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, input.commandId || null, input.projectId ?? null, input.actorId, input.capabilityId, input.action, input.outcome, input.inputDigest, JSON.stringify(redact(input.details || {}))],
      );
      return { id };
    },
  };
}

module.exports = { createAuditRepository };
