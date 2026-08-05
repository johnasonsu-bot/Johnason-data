const path = require("path");
const bcrypt = require("bcryptjs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const AppError = require("../../common/errors/app-error");
const env = require("../../config/env");
const repository = require("./system-management.repository");
const projectSpaceRepository = require("../project-spaces/project-space.repository");
const runtime = require("./system-management.runtime");
const AGENT_SCRIPT = path.resolve(__dirname, "../../scripts/system-service-agent.js");
const KAFKA_DEMO_PUMP_SCRIPT = path.resolve(__dirname, "../../scripts/kafka-demo-pump.js");
const execFileAsync = promisify(execFile);

function normalizeConfig(payload = {}) {
  return payload.config || {};
}

function normalizeServicePayload(payload, existingRecord) {
  return {
    serviceKey: payload.serviceKey,
    serviceName: payload.serviceName,
    serviceCategory: payload.serviceCategory,
    serviceType: payload.serviceType,
    manageMode: payload.manageMode,
    host: payload.host || null,
    port: payload.port || null,
    autoStart: Boolean(payload.autoStart),
    status: payload.status,
    isCore: existingRecord?.isCore || false,
    notes: payload.notes || null,
    config: normalizeConfig(payload)
  };
}

function ensureMutableService(record) {
  if (!record) {
    throw new AppError("Service not found.", 404);
  }
}

function validateCoreServiceMutation(record, payload) {
  if (!record?.isCore) {
    return;
  }

  if (
    payload.serviceKey !== record.serviceKey ||
    payload.serviceType !== record.serviceType ||
    payload.manageMode !== record.manageMode
  ) {
    throw new AppError("Core services cannot change key, type, or manage mode.", 400);
  }
}

async function listServices() {
  const services = await repository.listServiceConfigs();
  const enriched = await Promise.all(
    services.map(async (service) => ({
      ...service,
      runtime: await runtime.getServiceRuntime(service)
    }))
  );

  return enriched;
}

async function createService(payload) {
  const existing = await repository.getServiceConfigByKey(payload.serviceKey);
  if (existing) {
    throw new AppError("Service key already exists.", 409);
  }

  return repository.createServiceConfig(normalizeServicePayload(payload));
}

async function updateService(id, payload) {
  const existing = await repository.getServiceConfigById(id);
  ensureMutableService(existing);
  validateCoreServiceMutation(existing, payload);

  const conflict = await repository.getServiceConfigByKey(payload.serviceKey);
  if (conflict && conflict.id !== id) {
    throw new AppError("Service key already exists.", 409);
  }

  const row = await repository.updateServiceConfig(id, normalizeServicePayload(payload, existing));
  if (!row) {
    throw new AppError("Service not found.", 404);
  }

  return row;
}

async function deleteService(id) {
  const existing = await repository.getServiceConfigById(id);
  ensureMutableService(existing);

  if (existing.isCore) {
    throw new AppError("Core services cannot be deleted.", 400);
  }

  const deleted = await repository.deleteServiceConfig(id);
  if (!deleted) {
    throw new AppError("Service not found.", 404);
  }
}

async function getServiceOrThrow(id) {
  const service = await repository.getServiceConfigById(id);
  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  return service;
}

function scheduleAgent(action, envOverrides) {
  runtime.spawnDetached(process.execPath, [AGENT_SCRIPT], {
    cwd: path.resolve(__dirname, "../../.."),
    env: {
      ACTION: action,
      NODE_ENV: env.nodeEnv,
      ...envOverrides
    }
  });
}

async function executeServiceAction(id, action) {
  const service = await getServiceOrThrow(id);

  if (!["start", "stop", "restart"].includes(action)) {
    throw new AppError("Unsupported service action.", 400);
  }

  if (service.serviceType === "backend") {
    if (action === "start") {
      throw new AppError("Cannot start the backend service from the current backend session.", 400);
    }

    scheduleAgent(action === "stop" ? "stop-service" : "restart-service", {
      SERVICE_JSON: JSON.stringify(service),
      TARGET_PID: String(process.pid)
    });

    return {
      accepted: true,
      action,
      serviceKey: service.serviceKey,
      message: action === "stop" ? "Backend stop request accepted." : "Backend restart request accepted."
    };
  }

  if (action === "start") {
    await runtime.startManagedService(service);
  } else if (action === "stop") {
    await runtime.stopManagedService(service);
  } else {
    await runtime.restartManagedService(service);
  }

  return {
    accepted: true,
    action,
    serviceKey: service.serviceKey,
    runtime: await runtime.getServiceRuntime(service)
  };
}

async function restartWebStack() {
  const backendService = await repository.getServiceConfigByKey("backend");
  const frontendService = await repository.getServiceConfigByKey("frontend");

  if (!backendService || !frontendService) {
    throw new AppError("Backend or frontend service config is missing.", 404);
  }

  scheduleAgent("restart-web-stack", {
    BACKEND_SERVICE_JSON: JSON.stringify(backendService),
    FRONTEND_SERVICE_JSON: JSON.stringify(frontendService),
    TARGET_PID: String(process.pid)
  });

  return {
    accepted: true,
    message: "Docker 服务栈重启指令已提交。"
  };
}

async function startDefaultServices() {
  const services = await repository.listServiceConfigs();
  const defaults = services.filter((item) => item.autoStart && item.status === "active" && item.serviceKey !== "backend");

  for (const service of defaults) {
    await runtime.startManagedService(service);
  }

  return {
    accepted: true,
    startedServiceKeys: defaults.map((item) => item.serviceKey)
  };
}

async function runKafkaDemoPump(payload = {}) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [KAFKA_DEMO_PUMP_SCRIPT], {
      cwd: path.resolve(__dirname, "../../.."),
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 1024 * 1024 * 16,
      env: {
        ...process.env,
        DB_HOST: "127.0.0.1",
        DB_PORT: String(env.db.port),
        DB_USER: env.db.user,
        DB_PASSWORD: env.db.password,
        DB_NAME: env.db.database,
        ...(payload.topic ? { KAFKA_TOPIC: String(payload.topic) } : {}),
        ...(payload.mysqlTable ? { MYSQL_TARGET_TABLE: String(payload.mysqlTable) } : {}),
        ...(payload.hiveTable ? { HIVE_TARGET_TABLE: String(payload.hiveTable) } : {}),
        ...(payload.maxMessages ? { KAFKA_MAX_MESSAGES: String(payload.maxMessages) } : {})
      }
    });

    return JSON.parse(String(stdout || "{}").trim() || "{}");
  } catch (error) {
    throw new AppError(`Kafka 示例执行失败: ${error.message}`, 500);
  }
}

async function listSystemUsers() {
  return repository.listUsers();
}

async function listSystemRoles() {
  return repository.listRoles();
}

async function resolveRoleOrThrow(roleId) {
  const role = await repository.getRoleById(roleId);
  if (!role) {
    throw new AppError("Role not found.", 400);
  }
  if (role.status !== "active") {
    throw new AppError("Inactive roles cannot be assigned to users.", 400);
  }
  return role;
}

function normalizeRolePayloadPermissions(payload) {
  const permissions = payload.permissions || { modules: [] };
  const roleCode = String(payload.roleCode || "").toLowerCase();
  const roleType = String(payload.roleType || "").toLowerCase();
  const modules = Array.isArray(permissions.modules) ? permissions.modules.filter(Boolean) : [];

  if (roleCode === "viewer" || roleType === "viewer") {
    return {
      modules,
      mode: "readonly",
      actions: ["read"]
    };
  }

  return { modules };
}

async function createSystemRole(payload) {
  const existing = await repository.getRoleByCode(payload.roleCode);
  if (existing) {
    throw new AppError("Role code already exists.", 409);
  }

  return repository.createRole({
    roleName: payload.roleName,
    roleCode: payload.roleCode,
    roleType: payload.roleType,
    permissions: normalizeRolePayloadPermissions(payload),
    status: payload.status,
    isSystem: false
  });
}

async function updateSystemRole(id, payload) {
  const existing = await repository.getRoleById(id);
  if (!existing) {
    throw new AppError("Role not found.", 404);
  }

  if (existing.isSystem && payload.roleCode !== existing.roleCode) {
    throw new AppError("System roles cannot change role code.", 400);
  }

  const conflict = await repository.getRoleByCode(payload.roleCode);
  if (conflict && conflict.id !== id) {
    throw new AppError("Role code already exists.", 409);
  }

  return repository.updateRole(id, {
    roleName: payload.roleName,
    roleCode: existing.isSystem ? existing.roleCode : payload.roleCode,
    roleType: payload.roleType,
    permissions: normalizeRolePayloadPermissions({
      ...payload,
      roleCode: existing.isSystem ? existing.roleCode : payload.roleCode
    }),
    status: payload.status
  });
}

async function deleteSystemRole(id) {
  const existing = await repository.getRoleById(id);
  if (!existing) {
    throw new AppError("Role not found.", 404);
  }

  if (existing.isSystem) {
    throw new AppError("Built-in system roles cannot be deleted.", 400);
  }

  const userCount = await repository.countUsersByRoleId(id);
  if (userCount > 0) {
    throw new AppError("The role is still assigned to users and cannot be deleted.", 409);
  }

  const deleted = await repository.deleteRole(id);
  if (!deleted) {
    throw new AppError("Role not found.", 404);
  }
}

async function createSystemUser(payload) {
  const existing = await repository.getUserCredentialByUsername(payload.username);
  if (existing) {
    throw new AppError("Username already exists.", 409);
  }

  const role = await resolveRoleOrThrow(payload.roleId);
  const passwordHash = await bcrypt.hash(payload.password, env.bcryptSaltRounds);

  const user = await repository.createUser({
    username: payload.username,
    passwordHash,
    displayName: payload.displayName,
    roleId: role.id,
    roleCode: role.roleCode,
    status: payload.status
  });
  const defaultProject = await projectSpaceRepository.ensureDefaultProject();
  await projectSpaceRepository.ensureUserMembership(
    defaultProject.id,
    user.id,
    role.roleCode === "admin" ? "owner" : "developer"
  );
  return user;
}

async function updateSystemUser(id, payload, currentUser) {
  const existing = await repository.getUserById(id);
  if (!existing) {
    throw new AppError("User not found.", 404);
  }

  const conflict = await repository.getUserCredentialByUsername(payload.username);
  if (conflict && conflict.id !== id) {
    throw new AppError("Username already exists.", 409);
  }

  const role = await resolveRoleOrThrow(payload.roleId);
  if (existing.roleCode === "admin" && (payload.status !== "active" || role.roleCode !== "admin")) {
    const adminCount = await repository.countActiveAdminUsers();
    if (adminCount <= 1) {
      throw new AppError("At least one active admin account must remain.", 400);
    }
  }

  if (currentUser?.sub === id && payload.status !== "active") {
    throw new AppError("Cannot disable the currently signed-in user.", 400);
  }

  const passwordHash = payload.password
    ? await bcrypt.hash(payload.password, env.bcryptSaltRounds)
    : null;

  return repository.updateUser(id, {
    username: payload.username,
    displayName: payload.displayName,
    roleId: role.id,
    roleCode: role.roleCode,
    status: payload.status,
    passwordHash
  });
}

async function deleteSystemUser(id, currentUser) {
  const existing = await repository.getUserById(id);
  if (!existing) {
    throw new AppError("User not found.", 404);
  }

  if (currentUser?.sub === id) {
    throw new AppError("Cannot delete the currently signed-in user.", 400);
  }

  if (existing.roleCode === "admin") {
    const adminCount = await repository.countActiveAdminUsers();
    if (adminCount <= 1) {
      throw new AppError("At least one admin account must remain.", 400);
    }
  }

  const deleted = await repository.deleteUser(id);
  if (!deleted) {
    throw new AppError("User not found.", 404);
  }
}

async function getSystemResources(period) {
  return runtime.getResourceSnapshot(period);
}

async function getDatabaseArchitecture() {
  const mysqlService = await repository.getServiceConfigByKey("mysql");
  const mysqlRuntime = mysqlService ? await runtime.getServiceRuntime(mysqlService) : null;

  return {
    strategy: "平台元数据库当前统一使用一套 MySQL，新能力优先在现有实例内按职责收口。",
    instances: [
      {
        key: "mysql-meta",
        name: "Platform MySQL",
        engine: "mysql",
        host: env.db.host,
        port: env.db.port,
        status: mysqlRuntime?.state || "stopped",
        ready: mysqlRuntime?.reachable || false,
        databases: ["medata"],
        scope: "平台控制面与传统业务型元数据",
        boundaries: ["用户与权限", "系统服务配置", "数据源管理", "接入任务配置"],
        services: [{ name: "MeData Backend", serviceKey: "backend", database: "medata", purpose: "平台主元数据库" }]
      }
    ],
    placementRules: [
      {
        category: "平台控制面服务",
        target: "mysql",
        examples: ["用户管理", "角色管理", "服务治理", "系统管理", "任务配置"],
        reason: "结构稳定，事务清晰，适合配置型数据。"
      },
      {
        category: "新增服务",
        target: "mysql",
        examples: ["在单机单库架构下优先收口到 MySQL"],
        reason: "当前产品面向单机交付与轻量化演进，元数据库暂不再引入第二套核心实例。"
      }
    ]
  };
}


module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
  executeServiceAction,
  restartWebStack,
  startDefaultServices,
  runKafkaDemoPump,
  listSystemUsers,
  listSystemRoles,
  createSystemRole,
  updateSystemRole,
  deleteSystemRole,
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  getSystemResources,
  getDatabaseArchitecture,
};
