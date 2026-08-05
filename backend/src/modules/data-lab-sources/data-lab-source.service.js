const AppError = require("../../common/errors/app-error");
const repository = require("./data-lab-source.repository");
const { testDatabaseConnection } = require("../data-sources/data-source.test-connection");
const metadataService = require("../data-sources/data-source.metadata");
const { inferDatasourceDialect, normalizeDatasourceType } = require("../../common/utils/datasource-dialect");

function shouldCheckConnectivity(dataSource) {
  if (!dataSource || dataSource.status !== "active") {
    return false;
  }

  const sourceType = normalizeDatasourceType(dataSource.sourceType);
  const dialect = inferDatasourceDialect(sourceType, dataSource.connectionConfig || {});
  return ["mysql", "postgresql", "oracle", "dm", "hive", "kafka", "clickhouse"].includes(dialect)
    || ["gaussdb", "jdbc"].includes(sourceType);
}

async function appendConnectivityStatus(dataSource) {
  const checkedAt = new Date().toISOString();

  if (dataSource.status !== "active") {
    return {
      ...dataSource,
      connectionStatus: "disabled",
      connectionMessage: "数据源已停用，未执行连通性检查",
      lastCheckedAt: checkedAt
    };
  }

  if (!shouldCheckConnectivity(dataSource)) {
    return {
      ...dataSource,
      connectionStatus: "unknown",
      connectionMessage: `${dataSource.sourceType} 类型暂不支持自动探活`,
      lastCheckedAt: checkedAt
    };
  }

  const result = await testDatabaseConnection(dataSource.connectionConfig, dataSource.sourceType);
  return {
    ...dataSource,
    connectionStatus: result.success ? "online" : "offline",
    connectionMessage: result.error || result.message,
    lastCheckedAt: checkedAt
  };
}

async function listDataSources(options = {}) {
  const rows = await repository.listDataSources();

  if (!options.includeConnectivity) {
    return rows;
  }

  return Promise.all(rows.map((row) => appendConnectivityStatus(row)));
}

async function listReferencedScenes(id) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return repository.listReferencedScenes(id);
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

  const sceneReferenceCount = await repository.getSceneReferenceCount(id);
  if (sceneReferenceCount > 0) {
    throw new AppError("数据源已被数据实验室场景引用，无法删除", 409);
  }

  await repository.deleteDataSource(id);
}

async function testConnection(payload) {
  const { sourceType, connectionConfig } = payload;

  if (!connectionConfig) {
    throw new AppError("缺少连接配置信息", 400);
  }

  return testDatabaseConnection(connectionConfig, sourceType);
}

async function listTables(id) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return metadataService.listTables(dataSource);
}

async function listColumns(id, tableName) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return metadataService.listColumns(dataSource, tableName);
}

async function sampleRows(id, tableName, limit) {
  const dataSource = await repository.getDataSourceById(id);

  if (!dataSource) {
    throw new AppError("数据源不存在", 404);
  }

  return metadataService.sampleRows(dataSource, tableName, limit);
}

module.exports = {
  listDataSources,
  listReferencedScenes,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testConnection,
  listTables,
  listColumns,
  sampleRows
};
