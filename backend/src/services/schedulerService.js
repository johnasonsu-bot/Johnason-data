const cron = require("node-cron");
const { v4: uuidv4 } = require("uuid");
const AppError = require("../common/errors/app-error");
const dataxService = require("./dataxService");
const repository = require("../modules/ingestion-tasks/ingestion-task.repository");
const dataSourceMetadata = require("../modules/data-sources/data-source.metadata");
const mysql = require("mysql2/promise");
const { createPostgresLikeClient } = require("../common/utils/db-client");
const hiveService = require("./hiveService");
const streamIngestionRunner = require("./streamIngestionRunner");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
  resolveDatasourceConnection,
} = require("../common/utils/datasource-dialect");

const scheduledTasks = new Map();
const PROGRESS_PERSIST_INTERVAL_MS = 30000;

function startScheduler() {
  console.log("[Scheduler] Starting scheduler service...");
  loadScheduledTasks();
}

async function loadScheduledTasks() {
  try {
    const recoveredCount = await repository.reconcileLatestRunningJobRunsAfterRestart();
    if (recoveredCount > 0) {
      console.log(`[Scheduler] Recovered ${recoveredCount} stale running job records after restart`);
    }

    const tasks = await repository.getScheduledTasks();
    console.log(`[Scheduler] Found ${tasks.length} scheduled tasks to load`);

    for (const task of tasks) {
      await scheduleTask(task);
    }

    console.log(`[Scheduler] Loaded ${scheduledTasks.size} scheduled tasks`);
  } catch (error) {
    console.error("[Scheduler] Failed to load scheduled tasks:", error);
  }
}

async function scheduleTask(task) {
  if (!task.scheduleConfig) {
    console.warn(`[Scheduler] Task ${task.id} has no schedule config, skipping`);
    return false;
  }

  const { scheduleType, timezone } = task.scheduleConfig;

  if (scheduleType === "manual") {
    return false;
  }

  const taskKey = task.id.toString();

  if (scheduledTasks.has(taskKey)) {
    unscheduleTask(task.id);
  }

  const cronExpr = buildCronExpression(task.scheduleConfig);

  if (!cron.validate(cronExpr)) {
    console.error(`[Scheduler] Invalid cron expression for task ${task.id}: ${cronExpr}`);
    return false;
  }

  const jobId = uuidv4();
  const scheduledJob = cron.schedule(
    cronExpr,
    async () => {
      const latestTask = await repository.getTaskById(task.id);

      if (!latestTask) {
        console.warn(`[Scheduler] Scheduled task ${task.id} no longer exists, skipping`);
        return;
      }

      console.log(`[Scheduler] Executing scheduled task ${latestTask.id} (${latestTask.taskName})`);
      await executeScheduledTask(latestTask);
    },
    {
      scheduled: true,
      timezone: timezone || "Asia/Shanghai"
    }
  );

  scheduledTasks.set(taskKey, {
    job: scheduledJob,
    taskId: task.id,
    taskCode: task.taskCode,
    jobId
  });

  console.log(`[Scheduler] Scheduled task ${task.id} with cron: ${cronExpr}`);
  return true;
}

async function unscheduleTask(taskId) {
  const taskKey = taskId.toString();
  const scheduled = scheduledTasks.get(taskKey);

  if (scheduled) {
    scheduled.job.stop();
    scheduledTasks.delete(taskKey);
    console.log(`[Scheduler] Unscheduled task ${taskId}`);
    return true;
  }

  return false;
}

async function runTaskNow(taskId) {
  const task = await repository.getTaskById(taskId);

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (task.status === "running") {
    throw new Error(`Task ${taskId} is already running`);
  }

  await assertTaskDependenciesSatisfied(task);

  await repository.updateTaskStatus(taskId, "running");
  const refreshedTask = await repository.getTaskById(taskId);

  void executeScheduledTask(refreshedTask).catch((error) => {
    console.error(`[Scheduler] Background run failed for task ${taskId}:`, error);
  });

  return refreshedTask;
}

async function stopTaskRun(taskId) {
  const runningJobRun = await repository.getLatestRunningJobRun(taskId);
  if (!runningJobRun) {
    return {
      cancelled: false,
      reason: "no_running_job"
    };
  }

  const executionInfo = runningJobRun.executionInfo || {};
  const nestedExecutionInfo = executionInfo.executionInfo || executionInfo.result || {};
  const processJobId =
    executionInfo.processJobId ||
    nestedExecutionInfo.processJobId ||
    executionInfo.runId ||
    null;

  if (!processJobId) {
    return {
      cancelled: false,
      reason: "missing_process_job_id",
      runId: runningJobRun.id
    };
  }

  const cancelled = dataxService.cancelJob(processJobId);
  if (!cancelled) {
    return {
      cancelled: false,
      reason: "job_not_found_in_memory",
      runId: runningJobRun.id,
      processJobId
    };
  }

  await repository.updateJobRun(runningJobRun.id, {
    runStatus: "cancelled",
    endTime: new Date(),
    errorMessage: "任务已手动停止",
    executionInfo: {
      ...executionInfo,
      processJobId,
      cancelled: true,
      cancelledAt: new Date().toISOString()
    }
  });

  return {
    cancelled: true,
    runId: runningJobRun.id,
    processJobId
  };
}

function buildCronExpression(scheduleConfig = {}) {
  const {
    scheduleType,
    cronExpression,
    intervalMs,
    runTime,
    weekDays,
    monthDay
  } = scheduleConfig;

  if (scheduleType === "cron" && cronExpression) {
    return cronExpression;
  }

  if (scheduleType === "interval" && intervalMs) {
    const seconds = Math.max(1, Math.floor(intervalMs / 1000));
    if (seconds < 60) {
      return `*/${seconds} * * * * *`;
    }

    const minutes = Math.max(1, Math.floor(seconds / 60));
    return `*/${minutes} * * * *`;
  }

  const { hour, minute } = parseRunTime(runTime);

  if (scheduleType === "daily") {
    return `${minute} ${hour} * * *`;
  }

  if (scheduleType === "weekly") {
    const normalizedWeekDays = Array.isArray(weekDays) && weekDays.length > 0 ? weekDays.join(",") : "1";
    return `${minute} ${hour} * * ${normalizedWeekDays}`;
  }

  if (scheduleType === "monthly") {
    const normalizedMonthDay = Number(monthDay || 1);
    return `${minute} ${hour} ${normalizedMonthDay} * *`;
  }

  return cronExpression || "0 0 * * *";
}

function parseRunTime(runTime) {
  if (typeof runTime !== "string" || !runTime.includes(":")) {
    return { hour: 0, minute: 0 };
  }

  const [hourText, minuteText] = runTime.split(":");
  const hour = Math.min(23, Math.max(0, Number(hourText) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteText) || 0));
  return { hour, minute };
}

async function executeScheduledTask(task) {
  const runId = uuidv4();
  console.log(`[Scheduler] Starting job run ${runId} for task ${task.id}`);
  const processJobId = `${task.taskCode}_${Date.now()}`;
  const retryCount = Math.max(0, Number(task.scheduleConfig?.retryCount) || 0);
  const retryIntervalMs = Math.max(1000, Number(task.scheduleConfig?.retryIntervalMs) || 1000);

  const jobRun = await repository.createJobRun({
    taskId: task.id,
    projectId: task.projectId || null,
    runStatus: "running",
    startTime: new Date(),
    executionInfo: { runId, processJobId, scheduled: true }
  });

  try {
    await assertTaskDependenciesSatisfied(task);
    const result = await executeTaskWithRetry(task, jobRun, processJobId, {
      runId,
      retryCount,
      retryIntervalMs
    });

    if (result.cancelled) {
      await repository.updateJobRun(jobRun.id, {
        runStatus: "cancelled",
        endTime: new Date(),
        recordsCount: result.recordsCount || 0,
        errorMessage: "任务已手动停止",
        executionInfo: {
          runId,
          processJobId,
          scheduled: true,
          retryCount,
          attempts: result.attempts,
          retried: result.attempts > 1,
          attemptHistory: result.attemptHistory,
          ...result
        }
      });

      await restoreTaskStatusAfterRun(task.id, "active");

      console.log(`[Scheduler] Task ${task.id} cancelled`);
      return result;
    }

    await repository.updateJobRun(jobRun.id, {
      runStatus: "completed",
      endTime: new Date(),
      recordsCount: result.recordsCount || 0,
      executionInfo: {
        runId,
        processJobId,
        scheduled: true,
        retryCount,
        attempts: result.attempts,
        retried: result.attempts > 1,
        attemptHistory: result.attemptHistory,
        ...result
      }
    });

    await restoreTaskStatusAfterRun(task.id, "active");

    console.log(`[Scheduler] Task ${task.id} completed successfully`);
    return result;
  } catch (error) {
    if (isTaskCancellationError(error)) {
      console.log(`[Scheduler] Task ${task.id} cancelled:`, error.message);

      await repository.updateJobRun(jobRun.id, {
        runStatus: "cancelled",
        endTime: new Date(),
        errorMessage: error.message || "任务已手动停止",
        executionInfo: {
          runId,
          processJobId,
          scheduled: true,
          cancelled: true,
          cancelledAt: new Date().toISOString(),
          result: error.executionInfo || null
        }
      });

      await restoreTaskStatusAfterRun(task.id, "active");
      return {
        cancelled: true,
        errorMessage: error.message || "任务已手动停止"
      };
    }

    console.error(`[Scheduler] Task ${task.id} failed:`, error.message);

    await repository.updateJobRun(jobRun.id, {
      runStatus: "failed",
      endTime: new Date(),
      errorMessage: error.message,
      executionInfo: {
        runId,
        processJobId,
        scheduled: true,
        retryCount,
        attempts: Array.isArray(error.attemptHistory) ? error.attemptHistory.length : 1,
        retried: retryCount > 0,
        attemptHistory: error.attemptHistory || [],
        error: {
          message: error.message,
          stack: error.stack || null
        },
        result: error.executionInfo || null
      }
    });

    await restoreTaskStatusAfterRun(task.id, "active");

    throw error;
  }
}

async function assertTaskDependenciesSatisfied(task) {
  const dependencyTaskIds = Array.isArray(task.scheduleConfig?.dependencyTaskIds)
    ? task.scheduleConfig.dependencyTaskIds
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    : [];

  if (!dependencyTaskIds.length) {
    return;
  }

  const dependencyTasks = await Promise.all(
    dependencyTaskIds.map((dependencyTaskId) => repository.getTaskById(dependencyTaskId))
  );

  for (let index = 0; index < dependencyTaskIds.length; index += 1) {
    const dependencyTaskId = dependencyTaskIds[index];
    const dependencyTask = dependencyTasks[index];

    if (!dependencyTask) {
      throw new AppError(`依赖任务不存在: ${dependencyTaskId}`, 400, { dependencyTaskId });
    }

    await repository.reconcileTerminalRunningJobRuns(dependencyTaskId);
    await repository.reconcileHistoricalRunningJobRuns(dependencyTaskId);

    const latestJobRun = await repository.getLatestJobRun(dependencyTaskId);
    if (!latestJobRun) {
      throw new AppError(`依赖任务【${dependencyTask.taskName}】尚无成功运行记录，当前任务不能执行`, 400, {
        dependencyTaskId,
        dependencyTaskName: dependencyTask.taskName,
        dependencyRunStatus: "not_run"
      });
    }

    if (latestJobRun.runStatus !== "completed") {
      throw new AppError(`依赖任务【${dependencyTask.taskName}】最近一次运行状态为${translateRunStatus(latestJobRun.runStatus)}，当前任务不能执行`, 400, {
        dependencyTaskId,
        dependencyTaskName: dependencyTask.taskName,
        dependencyRunStatus: latestJobRun.runStatus,
        dependencyRunId: latestJobRun.id
      });
    }
  }
}

async function executeTaskWithRetry(task, jobRun, processJobId, options = {}) {
  const retryCount = Math.max(0, Number(options.retryCount) || 0);
  const retryIntervalMs = Math.max(1000, Number(options.retryIntervalMs) || 1000);
  const runId = options.runId || null;
  const attemptHistory = [];

  for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
    try {
      const result = await executeTask(task, jobRun, processJobId);
      return {
        ...result,
        attempts: attempt,
        attemptHistory
      };
    } catch (error) {
      if (isTaskCancellationError(error)) {
        error.attemptHistory = attemptHistory;
        throw error;
      }

      attemptHistory.push({
        attempt,
        failedAt: new Date().toISOString(),
        message: error.message
      });

      if (attempt > retryCount) {
        error.attemptHistory = attemptHistory;
        throw error;
      }

      await repository.updateJobRun(jobRun.id, {
        executionInfo: {
          ...(jobRun.executionInfo || {}),
          runId,
          processJobId,
          scheduled: true,
          retryCount,
          attempts: attempt,
          retried: true,
          nextRetryAt: new Date(Date.now() + retryIntervalMs).toISOString(),
          attemptHistory
        }
      });

      await delay(retryIntervalMs);
    }
  }

  throw new Error("任务重试流程异常结束");
}

function translateRunStatus(status) {
  if (status === "completed") {
    return "成功";
  }
  if (status === "failed") {
    return "失败";
  }
  if (status === "running") {
    return "运行中";
  }
  if (status === "cancelled") {
    return "已取消";
  }
  return status || "未知";
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function restoreTaskStatusAfterRun(taskId, fallbackStatus = "active") {
  const latestTask = await repository.getTaskById(taskId);
  const latestStatus = latestTask?.status;
  const nextStatus = latestStatus === "paused" || latestStatus === "stopped"
    ? latestStatus
    : fallbackStatus;
  await repository.updateTaskStatus(taskId, nextStatus);
}

function isTaskCancellationError(error) {
  return Boolean(
    error?.cancelled ||
    error?.executionInfo?.status === "cancelled" ||
    error?.executionInfo?.cancelled === true
  );
}

async function executeTask(task, jobRun, processJobId) {
  const sourceRuntime = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
  if (["kafka", "ftp", "api"].includes(sourceRuntime.dialect)) {
    return streamIngestionRunner.executeStreamTask(task, jobRun, processJobId);
  }

  const incrementalRuntime = await prepareIncrementalRuntime(task);
  const targetRuntime = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "mysql");
  const targetType = targetRuntime.dialect;

  if (targetType === "hive") {
    const result = await executeHiveTargetTask(task, incrementalRuntime);

    if (incrementalRuntime && incrementalRuntime.nextCursorValue !== undefined && incrementalRuntime.nextCursorValue !== null) {
      await repository.updateTask(task.id, {
        incrementalConfig: {
          ...(task.incrementalConfig || {}),
          mode: incrementalRuntime.mode,
          cursorColumn: incrementalRuntime.cursorColumn,
          ...(incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {}),
          ...(incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {}),
          ...(task.incrementalConfig?.startValue !== undefined ? { startValue: task.incrementalConfig.startValue } : {}),
          lastValue: incrementalRuntime.nextCursorValue,
          lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
          lastRunEndValue: incrementalRuntime.nextCursorValue,
          lastRunAt: new Date().toISOString()
        }
      });
    }

    return {
      success: true,
      recordsCount: result.recordsCount || 0,
      metrics: result.metrics || {},
      executionInfo: {
        ...result.executionInfo,
        incremental: incrementalRuntime
          ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            }
          : null
      }
    };
  }

  if (targetRuntime.sourceType === "gaussdb") {
    const result = await executeGaussDbTargetTask(task, incrementalRuntime);

    if (incrementalRuntime && incrementalRuntime.nextCursorValue !== undefined && incrementalRuntime.nextCursorValue !== null) {
      await repository.updateTask(task.id, {
        incrementalConfig: {
          ...(task.incrementalConfig || {}),
          mode: incrementalRuntime.mode,
          cursorColumn: incrementalRuntime.cursorColumn,
          ...(incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {}),
          ...(incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {}),
          ...(task.incrementalConfig?.startValue !== undefined ? { startValue: task.incrementalConfig.startValue } : {}),
          lastValue: incrementalRuntime.nextCursorValue,
          lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
          lastRunEndValue: incrementalRuntime.nextCursorValue,
          lastRunAt: new Date().toISOString()
        }
      });
    }

    return {
      success: true,
      recordsCount: result.recordsCount || 0,
      metrics: result.metrics || {},
      executionInfo: {
        ...result.executionInfo,
        incremental: incrementalRuntime
          ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            }
          : null
      }
    };
  }

  if (sourceRuntime.sourceType === "gaussdb") {
    const result = await executeGaussDbSourceTask(task, incrementalRuntime);

    if (incrementalRuntime && incrementalRuntime.nextCursorValue !== undefined && incrementalRuntime.nextCursorValue !== null) {
      await repository.updateTask(task.id, {
        incrementalConfig: {
          ...(task.incrementalConfig || {}),
          mode: incrementalRuntime.mode,
          cursorColumn: incrementalRuntime.cursorColumn,
          ...(incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {}),
          ...(incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {}),
          ...(task.incrementalConfig?.startValue !== undefined ? { startValue: task.incrementalConfig.startValue } : {}),
          lastValue: incrementalRuntime.nextCursorValue,
          lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
          lastRunEndValue: incrementalRuntime.nextCursorValue,
          lastRunAt: new Date().toISOString()
        }
      });
    }

    return {
      success: true,
      recordsCount: result.recordsCount || 0,
      metrics: result.metrics || {},
      executionInfo: {
        ...result.executionInfo,
        incremental: incrementalRuntime
          ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            }
          : null
      }
    };
  }

  const jobConfig = buildJobConfig(task, incrementalRuntime);
  const jobJson = dataxService.buildDataXJob(jobConfig);

  let lastProgressPersistAt = 0;

  const result = await dataxService.executeJob(processJobId, jobJson, {
    onProgress: ({ metrics }) => {
      if (!jobRun) {
        return;
      }

      const now = Date.now();
      if (now - lastProgressPersistAt < PROGRESS_PERSIST_INTERVAL_MS) {
        return;
      }
      lastProgressPersistAt = now;

      repository.updateJobRun(jobRun.id, {
        recordsCount: metrics.totalRecords || 0,
        executionInfo: {
          runId: jobRun.executionInfo?.runId || processJobId,
          processJobId,
          scheduled: true,
          progressAt: new Date().toISOString(),
          metrics
        }
      }).catch((error) => {
        console.error(`[Scheduler] Failed to persist progress for task ${task.id}:`, error.message);
      });
    }
  });

  if (result.success) {
    if (result.cancelled || result.result?.status === "cancelled") {
      return {
        cancelled: true,
        recordsCount: result.result?.metrics?.totalRecords || 0,
        metrics: result.result?.metrics || {},
        executionInfo: result.result || null
      };
    }

    if (incrementalRuntime && incrementalRuntime.nextCursorValue !== undefined && incrementalRuntime.nextCursorValue !== null) {
      await repository.updateTask(task.id, {
        incrementalConfig: {
          ...(task.incrementalConfig || {}),
          mode: incrementalRuntime.mode,
          cursorColumn: incrementalRuntime.cursorColumn,
          ...(incrementalRuntime.mode === "timestamp" ? { timestampColumn: incrementalRuntime.cursorColumn } : {}),
          ...(incrementalRuntime.mode === "id" ? { idColumn: incrementalRuntime.cursorColumn } : {}),
          ...(task.incrementalConfig?.startValue !== undefined ? { startValue: task.incrementalConfig.startValue } : {}),
          lastValue: incrementalRuntime.nextCursorValue,
          lastRunStartValue: incrementalRuntime.previousCursorValue ?? null,
          lastRunEndValue: incrementalRuntime.nextCursorValue,
          lastRunAt: new Date().toISOString()
        }
      });
    }

    return {
      success: true,
      recordsCount: result.result?.metrics?.totalRecords || 0,
      metrics: result.result?.metrics || {},
      executionInfo: {
        ...(result.result || {}),
        incremental: incrementalRuntime
          ? {
              mode: incrementalRuntime.mode,
              cursorColumn: incrementalRuntime.cursorColumn,
              previousCursorValue: incrementalRuntime.previousCursorValue ?? null,
              nextCursorValue: incrementalRuntime.nextCursorValue ?? null,
              whereClause: incrementalRuntime.whereClause
            }
          : null
      }
    };
  } else {
    const error = new Error(result.error || "Task execution failed");
    error.executionInfo = result.result || null;
    error.cancelled = result.cancelled === true || result.result?.status === "cancelled";
    throw error;
  }
}

async function executeHiveTargetTask(task, incrementalRuntime = null) {
  const sourceRows = await fetchSourceRows(task, incrementalRuntime);
  const fieldMappings = task.fieldMappings || [];
  const targetColumns = fieldMappings.map((item) => ({
    columnName: item.targetField,
    dataType: item.dataType || "string"
  }));
  const transformedRows = sourceRows.map((row) => Object.fromEntries(
    fieldMappings.map((mapping) => [mapping.targetField, row[mapping.sourceField]])
  ));

  await hiveService.loadRows(
    task.targetConnectionConfig || {},
    task.targetTable,
    targetColumns,
    transformedRows,
    {
      writeMode: task.targetConfig?.writeMode || "append",
      fileType: task.targetConfig?.fileType || "parquet"
    }
  );

  return {
    recordsCount: transformedRows.length,
    metrics: {
      totalRecords: transformedRows.length,
      errorRecords: 0
    },
    executionInfo: {
      engine: "hive-driver",
      writeMode: task.targetConfig?.writeMode || "append",
      targetTable: task.targetTable
    }
  };
}

async function executeGaussDbSourceTask(task, incrementalRuntime = null) {
  const sourceRows = await fetchSourceRows(task, incrementalRuntime);
  const fieldMappings = task.fieldMappings || [];
  const targetColumns = fieldMappings.map((item) => item.targetField).filter(Boolean);
  const transformedRows = sourceRows.map((row) => Object.fromEntries(
    fieldMappings.map((mapping) => [mapping.targetField, row[mapping.sourceField]])
  ));
  const targetRuntime = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "mysql");

  if (targetRuntime.dialect !== "mysql") {
    throw new Error(`Unsupported GaussDB source target dialect: ${targetRuntime.dialect}`);
  }

  await writeMysqlRows(targetRuntime, task.targetTable, targetColumns, transformedRows, {
    writeMode: task.targetConfig?.writeMode || "append"
  });

  return {
    recordsCount: transformedRows.length,
    metrics: {
      totalRecords: transformedRows.length,
      errorRecords: 0
    },
    executionInfo: {
      engine: "node-opengauss-to-mysql",
      writeMode: task.targetConfig?.writeMode || "append",
      targetTable: task.targetTable
    }
  };
}

async function writeMysqlRows(connectionConfig, tableName, targetColumns, rows, options = {}) {
  const writeMode = String(options.writeMode || "append").toLowerCase();
  const connection = await mysql.createConnection({
    host: connectionConfig.host,
    port: Number(connectionConfig.port),
    database: connectionConfig.database,
    user: connectionConfig.username,
    password: connectionConfig.password,
    connectTimeout: 5000
  });

  try {
    const qualifiedTable = dataSourceMetadata.escapeIdentifier(tableName, "mysql");
    if (writeMode === "overwrite") {
      await connection.query(`TRUNCATE TABLE ${qualifiedTable}`);
    }

    if (rows.length > 0 && targetColumns.length > 0) {
      await insertMysqlRows(connection, qualifiedTable, targetColumns, rows, {
        replace: writeMode === "replace"
      });
    }
  } finally {
    await connection.end();
  }
}

async function insertMysqlRows(connection, qualifiedTable, targetColumns, rows, options = {}) {
  const batchSize = 500;
  const verb = options.replace ? "REPLACE" : "INSERT";
  const columnSql = targetColumns.map((column) => dataSourceMetadata.escapeIdentifier(column, "mysql")).join(", ");

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = [];
    const rowPlaceholders = batch.map((row) => {
      const placeholders = targetColumns.map((column) => {
        values.push(row[column] === undefined ? null : row[column]);
        return "?";
      });
      return `(${placeholders.join(", ")})`;
    });

    await connection.query(
      `${verb} INTO ${qualifiedTable} (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
      values
    );
  }
}

async function executeGaussDbTargetTask(task, incrementalRuntime = null) {
  const sourceRows = await fetchSourceRows(task, incrementalRuntime);
  const fieldMappings = task.fieldMappings || [];
  const targetColumns = fieldMappings.map((item) => item.targetField).filter(Boolean);
  const transformedRows = sourceRows.map((row) => Object.fromEntries(
    fieldMappings.map((mapping) => [mapping.targetField, row[mapping.sourceField]])
  ));
  const targetConfig = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "gaussdb");
  const writeMode = String(task.targetConfig?.writeMode || "append").toLowerCase();
  const qualifiedTable = dataSourceMetadata.escapeIdentifier(task.targetTable, "gaussdb");
  const client = createPostgresLikeClient({
    host: targetConfig.host,
    port: Number(targetConfig.port),
    database: targetConfig.database,
    user: targetConfig.username,
    username: targetConfig.username,
    password: targetConfig.password,
    connectionTimeoutMillis: 5000
  }, {
    sourceType: "gaussdb"
  });

  await client.connect();
  try {
    if (writeMode === "overwrite") {
      await client.query(`TRUNCATE TABLE ${qualifiedTable}`);
    }

    if (transformedRows.length > 0 && targetColumns.length > 0) {
      await insertGaussDbRows(client, qualifiedTable, targetColumns, transformedRows);
    }
  } finally {
    await client.end();
  }

  return {
    recordsCount: transformedRows.length,
    metrics: {
      totalRecords: transformedRows.length,
      errorRecords: 0
    },
    executionInfo: {
      engine: "node-opengauss",
      writeMode,
      targetTable: task.targetTable
    }
  };
}

async function insertGaussDbRows(client, qualifiedTable, targetColumns, rows) {
  const batchSize = 200;
  const columnSql = targetColumns.map((column) => dataSourceMetadata.escapeIdentifier(column, "gaussdb")).join(", ");

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values = [];
    const rowPlaceholders = batch.map((row, rowIndex) => {
      const placeholders = targetColumns.map((column, columnIndex) => {
        values.push(row[column] === undefined ? null : row[column]);
        return `$${rowIndex * targetColumns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    await client.query(
      `INSERT INTO ${qualifiedTable} (${columnSql}) VALUES ${rowPlaceholders.join(", ")}`,
      values
    );
  }
}

async function fetchSourceRows(task, incrementalRuntime = null) {
  const connection = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
  const sourceType = connection.dialect;
  const fieldMappings = task.fieldMappings || [];
  const sourceFields = fieldMappings.length > 0
    ? [...new Set(fieldMappings.map((item) => item.sourceField))]
    : ["*"];
  const selectSql = sourceFields[0] === "*"
    ? "*"
    : sourceFields.map((field) => escapeSourceIdentifier(field, sourceType)).join(", ");
  const tableSql = escapeSourceIdentifier(task.sourceTable, sourceType);
  const whereSql = incrementalRuntime?.whereClause ? ` WHERE ${incrementalRuntime.whereClause}` : "";
  const sql = `SELECT ${selectSql} FROM ${tableSql}${whereSql}`;

  if (sourceType === "postgresql") {
    const client = createPostgresLikeClient({
      host: connection.host,
      port: Number(connection.port),
      database: connection.database,
      user: connection.username,
      username: connection.username,
      password: connection.password,
      connectionTimeoutMillis: 5000
    }, {
      sourceType: String(task.sourceType || "").trim().toLowerCase() === "gaussdb" ? "gaussdb" : "postgresql",
    });

    await client.connect();
    try {
      const result = await client.query(sql);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  if (sourceType !== "mysql") {
    throw new Error(`Unsupported ingestion source dialect: ${sourceType}`);
  }

  const conn = await mysql.createConnection({
    host: connection.host,
    port: Number(connection.port),
    database: connection.database,
    user: connection.username,
    password: connection.password,
    connectTimeout: 5000
  });

  try {
    const [rows] = await conn.query(sql);
    return rows;
  } finally {
    await conn.end();
  }
}

function escapeSourceIdentifier(identifier, sourceType = "mysql") {
  return dataSourceMetadata.escapeIdentifier(identifier, sourceType);
}

function buildJobConfig(task, incrementalRuntime = null) {
  const sourceConfig = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
  const targetConfig = parseConnectionConfig(task.targetConnectionConfig || {}, task.targetSourceType || task.targetType || "mysql");
  const targetConnection = {
    ...targetConfig,
    ...(task.targetConfig || {})
  };
  const fieldMappings = task.fieldMappings || [];
  const transformRules = task.transformRules || [];
  const sourceColumns = fieldMappings.length > 0
    ? buildReaderColumns(fieldMappings, transformRules, sourceConfig.dialect || "mysql")
    : sourceConfig.column || ["*"];

  return {
    source: {
      type: sourceConfig.dialect || "mysql",
      connection: {
        ...sourceConfig,
        table: task.sourceTable ? [task.sourceTable] : sourceConfig.table || [],
        column: sourceColumns,
        ...(incrementalRuntime?.whereClause ? { where: incrementalRuntime.whereClause } : {})
      }
    },
    writer: {
      type: targetConfig.dialect || task.targetSourceType || task.targetType,
      connection: {
        ...targetConnection,
        table: task.targetTable ? [task.targetTable] : targetConnection.table || [],
        column: fieldMappings.length > 0 ? fieldMappings.map((item) => item.targetField) : targetConnection.column || ["*"]
      }
    },
    fieldMappings,
    transformRules,
    channel: 1
  };
}

async function prepareIncrementalRuntime(task) {
  if (task.syncMode !== "incremental") {
    return null;
  }

  const incrementalConfig = task.incrementalConfig || {};
  const sourceConfig = parseConnectionConfig(task.sourceConnectionConfig || {}, task.sourceType || "mysql");
  const mode = incrementalConfig.mode || "timestamp";
  const cursorColumn = incrementalConfig.cursorColumn || incrementalConfig.timestampColumn || incrementalConfig.idColumn;

  if (!cursorColumn) {
    throw new Error("增量任务缺少增量字段配置");
  }

  const nextCursorValue = await dataSourceMetadata.getColumnMaximum(
    {
      sourceType: task.sourceType || "mysql",
      connectionConfig: task.sourceConnectionConfig || {}
    },
    task.sourceTable,
    cursorColumn
  );

  const previousCursorValue =
    incrementalConfig.lastValue !== undefined && incrementalConfig.lastValue !== null
      ? incrementalConfig.lastValue
      : incrementalConfig.startValue !== undefined
        ? incrementalConfig.startValue
        : null;

  const normalizedPreviousCursorValue = normalizeIncrementalCursorValue(mode, previousCursorValue);
  const normalizedNextCursorValue = normalizeIncrementalCursorValue(mode, nextCursorValue);

  return {
    mode,
    cursorColumn,
    previousCursorValue: normalizedPreviousCursorValue,
    nextCursorValue: normalizedNextCursorValue,
    whereClause: buildIncrementalWhereClause(
      sourceConfig.dialect || task.sourceType || "mysql",
      mode,
      cursorColumn,
      normalizedPreviousCursorValue,
      normalizedNextCursorValue
    )
  };
}

function buildIncrementalWhereClause(sourceType, mode, cursorColumn, previousCursorValue, nextCursorValue) {
  const quotedColumn = dataSourceMetadata.escapeIdentifier(cursorColumn, sourceType);

  if (nextCursorValue === null || nextCursorValue === undefined) {
    return "1 = 0";
  }

  const nextValueSql = formatIncrementalValue(sourceType, mode, nextCursorValue);
  if (previousCursorValue === null || previousCursorValue === undefined || previousCursorValue === "") {
    return `${quotedColumn} <= ${nextValueSql}`;
  }

  const previousValueSql = formatIncrementalValue(sourceType, mode, previousCursorValue);
  return `${quotedColumn} > ${previousValueSql} AND ${quotedColumn} <= ${nextValueSql}`;
}

function formatIncrementalValue(sourceType, mode, value) {
  const escaped = dataSourceMetadata.escapeValue(value);
  return escaped;
}

function normalizeIncrementalCursorValue(mode, value) {
  if (value === null || value === undefined || value === "") {
    return value;
  }

  if (mode !== "timestamp") {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  const millisecond = String(date.getMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`;
}

function parseConnectionConfig(config, sourceType = "mysql") {
  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch (e) {
      return {};
    }
  }

  if (!config) {
    return {};
  }

  const connection = config.connection && Array.isArray(config.connection)
    ? (config.connection[0] || {})
    : {};
  const mergedConfig = {
    ...config,
    jdbcUrl: config.jdbcUrl || config.url || connection.jdbcUrl,
    table: config.table || connection.table,
    column: config.column,
  };
  const normalizedType = normalizeDatasourceType(sourceType || config.dbType || config.sourceType || "mysql");
  const resolved = resolveDatasourceConnection(sourceType || normalizedType, mergedConfig);
  const dialect = inferDatasourceDialect(normalizedType, mergedConfig);

  return {
    sourceType: normalizedType,
    dialect: dialect === "unknown" ? normalizedType || "mysql" : dialect,
    username: resolved.username || mergedConfig.username,
    password: resolved.password || mergedConfig.password,
    jdbcUrl: resolved.jdbcUrl || mergedConfig.jdbcUrl || mergedConfig.url || "",
    host: resolved.host || mergedConfig.host,
    port: Number(resolved.port || mergedConfig.port || 0) || 0,
    database: resolved.database || mergedConfig.database || mergedConfig.databaseName,
    schema: resolved.schema || mergedConfig.schema || null,
    serviceName: mergedConfig.serviceName,
    sid: mergedConfig.sid,
    table: mergedConfig.table,
    column: mergedConfig.column,
    driverClassName: resolved.driverClassName || mergedConfig.driverClassName || null,
    protocol: resolved.protocol || mergedConfig.protocol || null,
  };
}

function getScheduledTaskCount() {
  return scheduledTasks.size;
}

function isTaskScheduled(taskId) {
  return scheduledTasks.has(taskId.toString());
}


function buildReaderColumns(fieldMappings, transformRules, sourceType = "mysql") {
  const customRuleMap = new Map(
    (transformRules || [])
      .filter((rule) => rule.transformType === "custom")
      .map((rule) => [rule.field, rule.config || {}])
  );

  const primaryKeyFields = fieldMappings
    .filter((item) => item.isPrimaryKey && !String(item.sourceField || "").startsWith("__custom_"))
    .map((item) => item.sourceField);

  return fieldMappings.map((mapping) => {
    const config = customRuleMap.get(mapping.targetField);
    if (!config) {
      return buildDefaultReaderColumn(mapping, sourceType);
    }

    const ruleType = String(config.ruleType || "");
    const sourceFields = Array.isArray(config.sourceFields) ? config.sourceFields.map(String).filter(Boolean) : [];
    const sql = buildCustomColumnExpression(
      ruleType,
      mapping,
      sourceFields,
      primaryKeyFields,
      config.customValue,
      sourceType
    );
    return sql || buildDefaultReaderColumn(mapping, sourceType);
  });
}

function buildDefaultReaderColumn(mapping, sourceType = "mysql") {
  const sourceField = String(mapping.sourceField || "").trim();
  if (!sourceField) {
    return sourceField;
  }
  const normalizedType = String(mapping.dataType || "").trim().toLowerCase();
  if (String(sourceType).toLowerCase() === "postgresql" && ["json", "jsonb"].includes(normalizedType)) {
    const sourceColumn = escapeSqlIdentifier(sourceField, sourceType);
    return `${sourceColumn}::text AS ${sourceColumn}`;
  }
  return sourceField;
}

function buildCustomColumnExpression(ruleType, mapping, sourceFields, primaryKeyFields, customValue, sourceType = "mysql") {
  const targetField = escapeSqlIdentifier(mapping.targetField, sourceType);
  switch (ruleType) {
    case "current_time":
      return `${getCurrentTimeExpression(sourceType)} AS ${targetField}`;
    case "random_md5":
      return `${getRandomHashExpression(sourceType)} AS ${targetField}`;
    case "primary_key_md5": {
      const fields = primaryKeyFields.length > 0 ? primaryKeyFields : [mapping.sourceField].filter(Boolean);
      return buildMd5Expression(fields, targetField, sourceType);
    }
    case "business_field_md5":
      return buildMd5Expression(sourceFields, targetField, sourceType);
    case "custom_value":
      return `${dataSourceMetadata.escapeValue(customValue ?? "")} AS ${targetField}`;
    default:
      return null;
  }
}

function buildMd5Expression(sourceFields, targetField, sourceType = "mysql") {
  const fields = (sourceFields || []).filter((field) => field && !String(field).startsWith("__custom_"));
  if (fields.length === 0) {
    return `${getRandomHashExpression(sourceType)} AS ${targetField}`;
  }

  if (String(sourceType).toLowerCase() === "postgresql") {
    const normalized = fields.map((field) => `COALESCE(CAST(${escapeSqlIdentifier(field, sourceType)} AS TEXT), '')`);
    return `MD5(CONCAT_WS('|', ${normalized.join(", ")})) AS ${targetField}`;
  }

  const normalized = fields.map((field) => `COALESCE(CAST(${escapeSqlIdentifier(field, sourceType)} AS CHAR), '')`);
  return `MD5(CONCAT_WS('|', ${normalized.join(", ")})) AS ${targetField}`;
}

function getCurrentTimeExpression(sourceType = "mysql") {
  return String(sourceType).toLowerCase() === "postgresql" ? "CURRENT_TIMESTAMP" : "NOW()";
}

function getRandomHashExpression(sourceType = "mysql") {
  if (String(sourceType).toLowerCase() === "postgresql") {
    return "MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text)";
  }
  return "MD5(UUID())";
}

function escapeSqlIdentifier(identifier, sourceType = "mysql") {
  if (String(sourceType).toLowerCase() === "postgresql") {
    return `"${String(identifier || "").replace(/"/g, "\"\"")}"`;
  }
  return `\`${String(identifier || "").replace(/`/g, "``")}\``;
}
module.exports = {
  startScheduler,
  scheduleTask,
  unscheduleTask,
  runTaskNow,
  stopTaskRun,
  loadScheduledTasks,
  getScheduledTaskCount,
  isTaskScheduled
};





