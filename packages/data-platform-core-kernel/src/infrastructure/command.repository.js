const crypto = require("node:crypto");

function createCommandRepository(connection) {
  if (!connection || typeof connection.query !== "function") throw new TypeError("transaction connection is required");
  return {
    async acceptCommand(input) {
      const projectId = input.projectId ?? null;
      if (input.idempotencyKey) {
        const [existing] = await connection.query(
          "SELECT id, status, result_ref AS resultRef FROM cli_commands WHERE project_id <=> ? AND capability_id = ? AND idempotency_key = ? LIMIT 1 FOR UPDATE",
          [projectId, input.capabilityId, input.idempotencyKey],
        );
        if (existing[0]) return { ...existing[0], duplicate: true };
      }
      const id = input.commandId || crypto.randomUUID();
      await connection.query(
        "INSERT INTO cli_commands (id, project_id, capability_id, module_name, module_version, actor_id, idempotency_key, input_digest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, projectId, input.capabilityId, input.moduleName, input.moduleVersion, input.actorId, input.idempotencyKey || null, input.inputDigest],
      );
      return { id, status: "accepted", resultRef: null, duplicate: false };
    },
    async completeCommand(commandId, resultRef) {
      await connection.query(
        "UPDATE cli_commands SET status = 'succeeded', result_ref = ?, completed_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
        [resultRef || null, commandId],
      );
    },
  };
}

module.exports = { createCommandRepository };
