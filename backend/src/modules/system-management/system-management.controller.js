const { sendSuccess } = require("../../common/utils/response");
const service = require("./system-management.service");
const databaseDriverService = require("./database-driver.service");

async function listServices(req, res) {
  const rows = await service.listServices();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createService(req, res) {
  const row = await service.createService(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateService(req, res) {
  const row = await service.updateService(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteService(req, res) {
  await service.deleteService(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function operateService(req, res) {
  const result = await service.executeServiceAction(Number(req.params.id), req.params.action);
  return sendSuccess(res, result);
}

async function restartWebStack(req, res) {
  const result = await service.restartWebStack();
  return sendSuccess(res, result);
}

async function startDefaultServices(req, res) {
  const result = await service.startDefaultServices();
  return sendSuccess(res, result);
}

async function runKafkaDemoPump(req, res) {
  const result = await service.runKafkaDemoPump(req.body || {});
  return sendSuccess(res, result);
}

async function listRoles(req, res) {
  const rows = await service.listSystemRoles();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createRole(req, res) {
  const row = await service.createSystemRole(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateRole(req, res) {
  const row = await service.updateSystemRole(Number(req.params.id), req.validatedBody);
  return sendSuccess(res, row);
}

async function deleteRole(req, res) {
  await service.deleteSystemRole(Number(req.params.id));
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function listUsers(req, res) {
  const rows = await service.listSystemUsers();
  return sendSuccess(res, rows, { total: rows.length });
}

async function createUser(req, res) {
  const row = await service.createSystemUser(req.validatedBody);
  return sendSuccess(res, row, null, 201);
}

async function updateUser(req, res) {
  const row = await service.updateSystemUser(Number(req.params.id), req.validatedBody, req.user);
  return sendSuccess(res, row);
}

async function deleteUser(req, res) {
  await service.deleteSystemUser(Number(req.params.id), req.user);
  return sendSuccess(res, { id: Number(req.params.id) });
}

async function getResources(req, res) {
  const snapshot = await service.getSystemResources(req.query.period);
  return sendSuccess(res, snapshot);
}

async function getDatabaseArchitecture(req, res) {
  const result = await service.getDatabaseArchitecture();
  return sendSuccess(res, result);
}


async function listDatabaseDrivers(req, res) {
  return sendSuccess(res, await databaseDriverService.listDrivers());
}

async function uploadDatabaseDriver(req, res) {
  try {
    const row = await databaseDriverService.uploadDriver(req.file, req.body || {}, req.user);
    return sendSuccess(res, row, null, 201);
  } finally {
    if (req.file?.path) {
      try { require("fs").unlinkSync(req.file.path); } catch {}
    }
  }
}

async function uploadAndActivateDatabaseDriver(req, res) {
  try {
    return sendSuccess(res, await databaseDriverService.uploadAndActivateDriver(req.file, req.body || {}, req.user));
  } finally {
    if (req.file?.path) {
      try { require("fs").unlinkSync(req.file.path); } catch {}
    }
  }
}

async function validateDatabaseDriver(req, res) {
  return sendSuccess(res, await databaseDriverService.validateDriver(Number(req.params.id), req.user));
}

async function activateDatabaseDriver(req, res) {
  return sendSuccess(res, await databaseDriverService.activateDriver(Number(req.params.id), req.body?.targets, req.user));
}

async function rollbackDatabaseDriver(req, res) {
  return sendSuccess(res, await databaseDriverService.rollbackDriver(req.body?.databaseType, req.body?.target, req.user));
}

async function deactivateDatabaseDriver(req, res) {
  return sendSuccess(res, await databaseDriverService.deactivateDriver(req.body?.databaseType, req.body?.target, req.user));
}

async function deleteDatabaseDriver(req, res) {
  return sendSuccess(res, await databaseDriverService.deleteDriver(Number(req.params.id), req.user));
}

async function listDatabaseDriverLogs(req, res) {
  return sendSuccess(res, await databaseDriverService.listLogs(Number(req.params.id)));
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
  operateService,
  restartWebStack,
  startDefaultServices,
  runKafkaDemoPump,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getResources,
  getDatabaseArchitecture,
  listDatabaseDrivers,
  uploadDatabaseDriver,
  uploadAndActivateDatabaseDriver,
  validateDatabaseDriver,
  activateDatabaseDriver,
  rollbackDatabaseDriver,
  deactivateDatabaseDriver,
  deleteDatabaseDriver,
  listDatabaseDriverLogs,
};
