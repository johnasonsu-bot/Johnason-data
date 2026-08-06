const dataSourceMetadata = require("../modules/data-sources/data-source.metadata");

function buildConflictClause(dialect, targetColumns = [], options = {}) {
  if (dialect !== "postgresql" || String(options.writeMode || "append").toLowerCase() !== "upsert") {
    return "";
  }
  const keyFields = (Array.isArray(options.keyFields) ? options.keyFields : [])
    .map((field) => String(field || "").trim())
    .filter((field) => field && targetColumns.includes(field));
  if (!keyFields.length) {
    throw new Error("PostgreSQL upsert requires at least one keyFields entry present in field mappings");
  }
  const escapedKeys = keyFields.map((field) => dataSourceMetadata.escapeIdentifier(field, dialect));
  const updates = targetColumns
    .filter((field) => !keyFields.includes(field))
    .map((field) => {
      const escaped = dataSourceMetadata.escapeIdentifier(field, dialect);
      return `${escaped} = EXCLUDED.${escaped}`;
    });
  return updates.length
    ? ` ON CONFLICT (${escapedKeys.join(", ")}) DO UPDATE SET ${updates.join(", ")}`
    : ` ON CONFLICT (${escapedKeys.join(", ")}) DO NOTHING`;
}

function deduplicateRowsByKeys(rows = [], keyFields = []) {
  if (!keyFields.length || rows.length < 2) return rows;
  const deduplicated = [];
  const indexByKey = new Map();
  for (const row of rows) {
    const key = JSON.stringify(keyFields.map((field) => row[field] ?? null));
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, deduplicated.length);
      deduplicated.push(row);
      continue;
    }
    const existing = deduplicated[existingIndex];
    const existingTime = Date.parse(existing.source_updated_at || existing.updated_at || "");
    const candidateTime = Date.parse(row.source_updated_at || row.updated_at || "");
    if (!Number.isFinite(existingTime) || !Number.isFinite(candidateTime) || candidateTime >= existingTime) {
      deduplicated[existingIndex] = row;
    }
  }
  return deduplicated;
}

module.exports = {
  buildConflictClause,
  deduplicateRowsByKeys,
};
