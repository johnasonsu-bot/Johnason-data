const AppError = require("../../common/errors/app-error");
const repository = require("./data-source.repository");
const { testDatabaseConnection } = require("./data-source.test-connection");
const previewService = require("./data-source.preview");
const { inferDatasourceDialect, normalizeDatasourceType } = require("../../common/utils/datasource-dialect");

function shouldCheckConnectivity(dataSource) {
  if (!dataSource || dataSource.status !== "active") {
    return false;
  }

  const sourceType = normalizeDatasourceType(dataSource.sourceType);
  const dialect = inferDatasourceDialect(sourceType, dataSource.connectionConfig || {});
  return ["mysql", "postgresql", "oracle", "dm", "hive", "kafka", "clickhouse", "ftp", "api"].includes(dialect)
    || ["gaussdb", "jdbc", "ftp"].includes(sourceType);
}

async function appendConnectivityStatus(dataSource) {
  const checkedAt = new Date().toISOString();

  if (dataSource.status !== "active") {
    return {
      ...dataSource,
      connectionStatus: "disabled",
      connectionMessage: "数据源已停用，未执行连通性检测",
      lastCheckedAt: checkedAt,
    };
  }

  if (!shouldCheckConnectivity(dataSource)) {
    return {
      ...dataSource,
      connectionStatus: "unknown",
      connectionMessage: `${dataSource.sourceType} 类型暂不支持自动探活`,
      lastCheckedAt: checkedAt,
    };
  }

  const result = await testDatabaseConnection(dataSource.connectionConfig, dataSource.sourceType);
  return {
    ...dataSource,
    connectionStatus: result.success ? "online" : "offline",
    connectionMessage: result.error || result.message,
    lastCheckedAt: checkedAt,
  };
}

async function listDataSources(options = {}) {
  const rows = await repository.listDataSources(options.sourceDomain, options.sourceIds);

  if (!options.includeConnectivity) {
    return rows;
  }

  return Promise.all(rows.map((row) => appendConnectivityStatus(row)));
}

async function listReferencedTasks(id) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return repository.listReferencedTasks(id);
}

async function createDataSource(payload) {
  try {
    return await repository.createDataSource(payload);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("数据源编码已存在", 409);
    }

    throw error;
  }
}

async function updateDataSource(id, payload) {
  try {
    const row = await repository.updateDataSource(id, payload);

    if (!row) {
      throw new AppError("数据源不存在", 404);
    }

    return row;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new AppError("数据源编码已存在", 409);
    }

    throw error;
  }
}

async function deleteDataSource(id) {
  const dataSource = await repository.getDataSourceById(id);
  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  const references = await repository.listReferencedTasks(id);
  const taskReferences = references.filter((item) => String(item.referenceType || "task") === "task");
  const jobReferences = references.filter((item) => String(item.referenceType || "") === "job");

  if (taskReferences.length > 0) {
    throw new AppError("数据源仍被接入任务引用，无法删除", 409, {
      referenceType: "task",
      referenceCount: taskReferences.length,
    });
  }

  if (jobReferences.length > 0) {
    await repository.deleteReferencedJobsBySourceId(id);
  }

  try {
    const deleted = await repository.deleteDataSource(id);

    if (!deleted) {
      throw new AppError("数据源不存在", 404);
    }
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      throw new AppError("数据源仍被接入任务或接入作业引用，无法删除", 409);
    }

    throw error;
  }
}

async function testConnection(payload) {
  const { sourceType, connectionConfig } = payload;

  if (!connectionConfig) {
    throw new AppError("缺少连接配置信息", 400);
  }

  return testDatabaseConnection(connectionConfig, sourceType);
}

async function listTables(id, options = {}) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return previewService.listObjects(dataSource, options);
}

async function listColumns(id, tableName) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return previewService.listColumns(dataSource, tableName);
}

async function sampleRows(id, tableName, limit) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return previewService.sampleRows(dataSource, tableName, limit);
}

module.exports = {
  listDataSources,
  listReferencedTasks,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  listTables,
  listColumns,
  sampleRows,
};
