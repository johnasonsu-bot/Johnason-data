const { pool } = require("../../config/database");

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function mapPackage(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    fileSize: Number(row.fileSize || 0),
    targets: parseJson(row.targets, []),
  };
}

function mapBinding(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    packageId: Number(row.packageId),
    previousPackageId: row.previousPackageId ? Number(row.previousPackageId) : null,
  };
}

async function listPackages() {
  const [rows] = await pool.query(`
    SELECT id, database_type AS databaseType, driver_name AS driverName, version,
           driver_class AS driverClass, original_file_name AS originalFileName,
           file_path AS filePath, file_size AS fileSize, sha256, targets_json AS targets,
           validation_status AS validationStatus, validation_message AS validationMessage,
           java_version AS javaVersion, uploaded_by AS uploadedBy, uploaded_by_name AS uploadedByName,
           created_at AS createdAt, updated_at AS updatedAt
      FROM system_database_driver_packages
     ORDER BY created_at DESC, id DESC
  `);
  return rows.map(mapPackage);
}

async function getPackageById(id) {
  const [rows] = await pool.query(`
    SELECT id, database_type AS databaseType, driver_name AS driverName, version,
           driver_class AS driverClass, original_file_name AS originalFileName,
           file_path AS filePath, file_size AS fileSize, sha256, targets_json AS targets,
           validation_status AS validationStatus, validation_message AS validationMessage,
           java_version AS javaVersion, uploaded_by AS uploadedBy, uploaded_by_name AS uploadedByName,
           created_at AS createdAt, updated_at AS updatedAt
      FROM system_database_driver_packages WHERE id = ? LIMIT 1
  `, [id]);
  return mapPackage(rows[0]);
}

async function getPackageByHash(databaseType, sha256) {
  const [rows] = await pool.query(
    "SELECT id FROM system_database_driver_packages WHERE database_type = ? AND sha256 = ? LIMIT 1",
    [databaseType, sha256],
  );
  return rows[0] || null;
}

async function createPackage(payload) {
  const [result] = await pool.query(`
    INSERT INTO system_database_driver_packages
      (database_type, driver_name, version, driver_class, original_file_name, file_path,
       file_size, sha256, targets_json, validation_status, uploaded_by, uploaded_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `, [
    payload.databaseType,
    payload.driverName,
    payload.version,
    payload.driverClass,
    payload.originalFileName,
    payload.filePath,
    payload.fileSize,
    payload.sha256,
    JSON.stringify(payload.targets),
    payload.uploadedBy,
    payload.uploadedByName,
  ]);
  return getPackageById(result.insertId);
}

async function updateValidation(id, payload) {
  await pool.query(`
    UPDATE system_database_driver_packages
       SET validation_status = ?, validation_message = ?, java_version = ?,
           driver_class = COALESCE(?, driver_class)
     WHERE id = ?
  `, [payload.status, payload.message || null, payload.javaVersion || null, payload.driverClass || null, id]);
  return getPackageById(id);
}

async function listBindings() {
  const [rows] = await pool.query(`
    SELECT b.id, b.database_type AS databaseType, b.target, b.package_id AS packageId,
           b.previous_package_id AS previousPackageId, b.status,
           b.activated_by AS activatedBy, b.activated_by_name AS activatedByName,
           b.activated_at AS activatedAt,
           p.driver_name AS driverName, p.version, p.driver_class AS driverClass,
           p.file_path AS filePath, p.sha256
      FROM system_database_driver_bindings b
      JOIN system_database_driver_packages p ON p.id = b.package_id
     ORDER BY b.database_type, b.target
  `);
  return rows.map(mapBinding);
}

async function replaceBindings(driverPackage, targets, user) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const target of targets) {
      const [currentRows] = await connection.query(
        "SELECT package_id AS packageId FROM system_database_driver_bindings WHERE database_type = ? AND target = ? FOR UPDATE",
        [driverPackage.databaseType, target],
      );
      const previousPackageId = currentRows[0]?.packageId || null;
      await connection.query(`
        INSERT INTO system_database_driver_bindings
          (database_type, target, package_id, previous_package_id, status, activated_by, activated_by_name, activated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          previous_package_id = package_id,
          package_id = VALUES(package_id),
          status = 'active',
          activated_by = VALUES(activated_by),
          activated_by_name = VALUES(activated_by_name),
          activated_at = NOW()
      `, [driverPackage.databaseType, target, driverPackage.id, previousPackageId, user.id || null, user.username || "system"]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return listBindings();
}

async function rollbackBinding(databaseType, target, user) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`
      SELECT package_id AS packageId, previous_package_id AS previousPackageId
        FROM system_database_driver_bindings
       WHERE database_type = ? AND target = ? FOR UPDATE
    `, [databaseType, target]);
    const current = rows[0];
    if (!current?.previousPackageId) {
      await connection.rollback();
      return null;
    }
    await connection.query(`
      UPDATE system_database_driver_bindings
         SET package_id = ?, previous_package_id = ?, activated_by = ?, activated_by_name = ?, activated_at = NOW()
       WHERE database_type = ? AND target = ?
    `, [current.previousPackageId, current.packageId, user.id || null, user.username || "system", databaseType, target]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return listBindings();
}

async function deactivateBinding(databaseType, target) {
  const [result] = await pool.query(
    "DELETE FROM system_database_driver_bindings WHERE database_type = ? AND target = ?",
    [databaseType, target],
  );
  return result.affectedRows > 0;
}

async function deletePackage(id) {
  const [result] = await pool.query("DELETE FROM system_database_driver_packages WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

async function createOperationLog(payload) {
  await pool.query(`
    INSERT INTO system_database_driver_operation_logs
      (package_id, database_type, action, status, detail_json, operator_user_id, operator_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    payload.packageId || null,
    payload.databaseType,
    payload.action,
    payload.status,
    JSON.stringify(payload.detail || {}),
    payload.user?.id || null,
    payload.user?.username || "system",
  ]);
}

async function listOperationLogs(packageId, limit = 100) {
  const params = [];
  let where = "";
  if (packageId) {
    where = "WHERE package_id = ?";
    params.push(packageId);
  }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 500));
  const [rows] = await pool.query(`
    SELECT id, package_id AS packageId, database_type AS databaseType, action, status,
           detail_json AS detail, operator_user_id AS operatorUserId, operator_name AS operatorName,
           created_at AS createdAt
      FROM system_database_driver_operation_logs
      ${where}
     ORDER BY created_at DESC, id DESC LIMIT ?
  `, params);
  return rows.map((row) => ({ ...row, detail: parseJson(row.detail, {}) }));
}

module.exports = {
  createOperationLog,
  createPackage,
  deactivateBinding,
  deletePackage,
  getPackageByHash,
  getPackageById,
  listBindings,
  listOperationLogs,
  listPackages,
  replaceBindings,
  rollbackBinding,
  updateValidation,
};
