const AppError = require("../../common/errors/app-error");
const dataSourceRepository = require("../data-sources/data-source.repository");
const dataSourcePreview = require("../data-sources/data-source.preview");
const ingestionAiConfigService = require("../ingestion-ai-configs/ingestion-ai-config.service");
const modelProviderService = require("../model-providers/model-provider.service");

const DEFAULT_TASK_CONFIG_SYSTEM_PROMPT = `
你是资深数据集成架构师，负责为“创建接入任务”生成可直接落地的推荐配置。

[输入前提]
1. 用户会先选择：来源数据源、来源表、目标数据源。
2. 当前场景默认推荐：targetTableMode = create，也就是“自动创建目标表”。
3. ownerName 直接使用当前系统登录用户，不要虚构其他负责人。
4. 你必须综合来源对象结构、索引、约束、样例数据、当前表单上下文和目标数据源信息给出建议。
5. 来源对象可能是数据库表、Kafka Topic 或 FTP 文件/目录。Kafka/FTP 场景要基于样例消息或样例文件推断字段。

[字段填写要求]
1. taskName（任务名称）
要求：名称清晰、业务化，能体现同步对象和动作，适合直接展示给业务或运维人员。

2. taskCode（任务编码）
要求：必须生成。
格式：仅允许小写字母、数字、下划线。
规则：禁止空格、中文、短横线和其他特殊字符。
建议：优先体现来源系统、来源表或业务主题，长度控制在 64 个字符以内。

3. ownerName（负责人）
要求：固定填写当前系统登录用户，不要改写成其他人名，不要留空。

4. description（任务说明）
要求：用 1 到 3 句概括任务目的、来源对象、目标用途和关键同步策略，便于后续维护。

5. syncMode（同步模式）
可选值：full | incremental | cdc
要求：根据来源表特征选择最合理模式。
规则：如果存在稳定更新时间、时间戳或递增主键，优先推荐 incremental；只有明确适合变更捕获时才推荐 cdc；否则推荐 full。
Kafka 来源固定推荐 full，含义为批量消费 Topic 消息；FTP 来源只能推荐 full 或 incremental，full 表示每次读取匹配文件，incremental 表示只读取新增或变化文件。

6. targetTableMode（目标表模式）
要求：固定返回 create。

7. targetTable（目标表名）
要求：必须生成目标表名。
格式：仅允许小写字母、数字、下划线。
建议：名称体现业务语义，可带 ods、dwd、ads 等分层前缀。

8. writeMode（写入模式）
可选值：append | replace | overwrite | partition_overwrite
要求：结合同步模式和目标表用途推荐最合适策略，并保持可执行。

9. partitionMode / partitionColumn / partitionValue（分区写入配置）
要求：只有在确实适合分区写入时才填写；否则返回 null。

10. incrementalConfig.mode（增量模式）
可选值：timestamp | id | cdc | null
要求：仅当 syncMode 为 incremental 或 cdc 时填写合理值；否则返回 null。

11. incrementalConfig.cursorColumn（增量游标字段）
要求：若使用 incremental，必须选择来源表中真实存在且稳定可用的字段。

12. incrementalConfig.startValue（增量起始值）
要求：给出合理起始值。
规则：timestamp 类型可给出标准时间字符串；id 类型可给出 0 或其他合理起点；不用时返回 null。

13. cdcColumns（CDC监听字段）
要求：仅当 syncMode = cdc 时返回建议监听字段数组；否则返回空数组。

14. fieldMappings（字段映射）
要求：必须尽量完整。
规则：sourceField 必须来自来源表真实字段；targetField 必须可作为新建目标表字段名；
enabled 表示该字段是否参与同步；dataType 尽量给出准确类型；isPrimaryKey 根据来源主键判断；defaultValue 无明确需要时返回 null。

15. transformRules（转换规则）
要求：仅在确有必要时生成转换规则；无必要时返回空数组，不要为了凑数强行生成。

16. scheduleConfig（调度配置）
要求：默认推荐 manual，除非场景明确需要自动调度。

17. reasoning（推荐依据）
要求：返回数组，简要说明每项关键推荐依据，便于人工审核。

[输出纪律]
1. 输出必须是 JSON，不要输出 Markdown，不要输出解释性前缀。
2. 所有字段必须严格按既定结构返回。
3. 不要编造来源表中不存在的字段名。
4. 如果某项无法确定，优先返回保守且可执行的默认值。
`.trim();

async function recommendTaskConfig(payload) {
  const source = await dataSourceRepository.getDataSourceById(payload.sourceId);
  if (!source) {
    throw new AppError("来源数据源不存在", 404);
  }

  const target = payload.targetSourceId ? await dataSourceRepository.getDataSourceById(payload.targetSourceId) : null;
  const sourceProfile = await dataSourcePreview.inspectObjectProfile(source, payload.sourceTable, { sampleSize: 20 });
  const targetProfile = target && payload.targetTable && payload.targetTableMode === "existing"
    ? await dataSourcePreview.inspectObjectProfile(target, payload.targetTable, { sampleSize: 20 })
    : null;

  const aiConfig = await ingestionAiConfigService.getActiveConfigByCode("task_config_recommendation");
  const provider = await resolveDefaultProvider(aiConfig);
  const completion = await modelProviderService.generateChatCompletion(
    provider,
    ensureJsonObjectPrompt(
      buildTaskRecommendationPrompt(payload, source, sourceProfile, target, targetProfile, resolveTaskRecommendationSystemPrompt(aiConfig?.systemPrompt)),
      provider
    ),
    {
      temperature: aiConfig?.temperature ?? 0.1,
      maxTokens: Number(aiConfig?.maxTokens || 1200),
      timeoutMs: Number(aiConfig?.timeoutMs || 120000),
      responseFormat: { type: "json_object" }
    }
  );

  return {
    modelProviderId: provider.id,
    modelProviderName: provider.configName,
    modelName: provider.modelName,
    recommendation: await parseRecommendationResult(completion.content, sourceProfile, payload, source, target, provider)
  };
}

function resolveTaskRecommendationSystemPrompt(systemPromptOverride = "") {
  const normalized = String(systemPromptOverride || "").trim();
  if (!normalized) {
    return "";
  }

  const questionMarkCount = (normalized.match(/\?/g) || []).length;
  const chineseCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (normalized.match(/[A-Za-z]/g) || []).length;

  if (questionMarkCount >= 20 && chineseCount < 20 && latinCount < 80) {
    return "";
  }

  return normalized;
}

async function resolveDefaultProvider(aiConfig) {
  if (aiConfig?.defaultModelProviderId) {
    const provider = await modelProviderService.getModelProviderById(aiConfig.defaultModelProviderId);
    return modelProviderService.applyModelSelection(provider, {
      modelName: aiConfig.defaultModelName,
      modelVersion: aiConfig.defaultModelVersion,
    });
  }

  const providers = await modelProviderService.getActiveChatModelProviders();
  if (!providers.length) {
    throw new AppError("未找到可用的对话模型，请先在AI配置管理中维护任务配置场景默认模型", 400);
  }

  return providers[0];
}

function buildTaskRecommendationPrompt(payload, source, sourceProfile, target, targetProfile, systemPromptOverride = "") {
  const compactSourceProfile = compactTableProfileForPrompt(sourceProfile);
  const compactTargetProfile = compactTableProfileForPrompt(targetProfile);

  return [
    {
      role: "system",
      content:
        (systemPromptOverride || DEFAULT_TASK_CONFIG_SYSTEM_PROMPT) +
        " 输出必须是 JSON，不要输出 Markdown。字段结构固定为 taskName、taskCode、ownerName、description、syncMode、targetTableMode、targetTable、writeMode、partitionMode、partitionColumn、partitionValue、incrementalConfig、cdcColumns、fieldMappings、transformRules、scheduleConfig、reasoning。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          currentForm: payload,
          sourceDataSource: {
            id: source.id,
            sourceName: source.sourceName,
            sourceCode: source.sourceCode,
            sourceType: source.sourceType,
            sourceObjectType: resolveSourceObjectType(source),
            database: source.connectionConfig?.database
          },
          sourceTableProfile: compactSourceProfile,
          targetDataSource: target
            ? {
                id: target.id,
                sourceName: target.sourceName,
                sourceCode: target.sourceCode,
                sourceType: target.sourceType,
                database: target.connectionConfig?.database
              }
            : null,
          targetTableProfile: compactTargetProfile,
          outputSchema: {
            taskName: "推荐的任务名称",
            taskCode: "推荐的任务编码，使用小写字母、数字和下划线",
            ownerName: "当前登录用户负责人",
            description: "推荐说明",
            syncMode: "full | incremental | cdc",
            targetTableMode: "create",
            targetTable: "推荐目标表名",
            writeMode: "append | replace | overwrite | partition_overwrite",
            partitionMode: "latest | custom | null",
            partitionColumn: "分区字段或 null",
            partitionValue: "分区值或 null",
            incrementalConfig: {
              mode: "timestamp | id | cdc | null",
              cursorColumn: "增量字段或 null",
              startValue: "推荐起始值或 null"
            },
            cdcColumns: ["CDC字段数组，可为空"],
            fieldMappings: [
              {
                sourceField: "来源字段",
                targetField: "目标字段",
                enabled: true,
                dataType: "字段类型",
                isPrimaryKey: false,
                defaultValue: null
              }
            ],
            transformRules: [
              {
                field: "字段名",
                transformType: "rename | uppercase | lowercase | trim | date_format | custom",
                config: {}
              }
            ],
            scheduleConfig: {
              scheduleType: "manual | interval | daily | weekly | monthly | null",
              intervalSeconds: null,
              runTime: null,
              weekDays: [],
              monthDay: null,
              timezone: "Asia/Shanghai"
            },
            reasoning: ["推荐依据，数组"]
          }
        },
        null,
        2
      )
    }
  ];
}

function compactTableProfileForPrompt(profile) {
  if (!profile) {
    return null;
  }

  return {
    tableName: profile.tableName || "",
    tableComment: profile.tableComment || "",
    columns: Array.isArray(profile.columns)
      ? profile.columns.slice(0, 60).map((item) => ({
          columnName: item.columnName,
          dataType: item.dataType,
          columnType: item.columnType,
          isNullable: item.isNullable,
          isPrimaryKey: item.isPrimaryKey,
          columnComment: item.columnComment || "",
        }))
      : [],
    indexes: Array.isArray(profile.indexes)
      ? profile.indexes.slice(0, 20).map((item) => ({
          indexName: item.indexName,
          unique: item.unique,
          indexType: item.indexType,
          columns: Array.isArray(item.columns) ? item.columns.slice(0, 10) : [],
        }))
      : [],
    constraints: Array.isArray(profile.constraints)
      ? profile.constraints.slice(0, 20).map((item) => ({
          constraintName: item.constraintName,
          constraintType: item.constraintType,
          columns: Array.isArray(item.columns) ? item.columns.slice(0, 10) : [],
          references: Array.isArray(item.references) ? item.references.slice(0, 5) : [],
        }))
      : [],
    sampleRows: Array.isArray(profile.sampleRows)
      ? profile.sampleRows.slice(0, 5).map(compactSampleRowForPrompt)
      : [],
  };
}

function compactSampleRowForPrompt(row) {
  const entries = Object.entries(row || {}).slice(0, 20).map(([key, value]) => [
    key,
    typeof value === "string" ? value.slice(0, 120) : value,
  ]);

  return Object.fromEntries(entries);
}

async function parseRecommendationResult(content, sourceProfile, payload, source, target, provider) {
  const normalized = String(content || "").trim();
  if (!normalized) {
    throw new AppError("AI未返回任务配置推荐结果", 400);
  }

  try {
    const parsed = await parseRecommendationPayload(normalized, provider);
    return normalizeRecommendationPayload(parsed, sourceProfile, payload, source, target);
  } catch (error) {
    throw new AppError(`AI任务配置推荐结果解析失败: ${error.message || "未知错误"}`, 400);
  }
}

async function parseRecommendationPayload(content, provider) {
  const direct = tryParseJson(content);
  if (direct) {
    return direct;
  }

  const repaired = await repairRecommendationPayload(provider, content);
  if (repaired) {
    return repaired;
  }

  throw new Error("无法将模型输出解析为合法 JSON");
}

function normalizeRecommendationPayload(parsed, sourceProfile, payload, source, target) {
  const sourceColumns = Array.isArray(sourceProfile?.columns) ? sourceProfile.columns : [];
  const sourceColumnMap = new Map(sourceColumns.map((item) => [item.columnName, item]));
  const fieldMappings = Array.isArray(parsed.fieldMappings) ? parsed.fieldMappings : [];
  const taskName = parsed.taskName || "";
  const taskCode = parsed.taskCode || buildFallbackTaskCode(parsed, payload, source, target);
  const normalizedTargetType = String(target?.sourceType || "").toLowerCase();
  const normalizedSourceType = resolveSourceObjectType(source);
  const syncMode = normalizeSyncModeBySource(parsed.syncMode, normalizedSourceType);

  return {
    taskName,
    taskCode,
    ownerName: payload.ownerName || parsed.ownerName || "",
    description: parsed.description || "",
    syncMode,
    targetTableMode: normalizeEnum(parsed.targetTableMode, ["existing", "create"], "create"),
    targetTable: parsed.targetTable || "",
    writeMode: normalizeWriteMode(parsed.writeMode, normalizedTargetType),
    partitionMode: normalizeNullableEnum(parsed.partitionMode, ["latest", "custom"]),
    partitionColumn: parsed.partitionColumn || null,
    partitionValue: parsed.partitionValue || null,
    incrementalConfig: parsed.incrementalConfig
      ? {
          mode: normalizeNullableEnum(parsed.incrementalConfig.mode, ["timestamp", "id", "cdc"]),
          cursorColumn: parsed.incrementalConfig.cursorColumn || null,
          startValue: parsed.incrementalConfig.startValue ?? null
        }
      : null,
    cdcColumns: Array.isArray(parsed.cdcColumns) ? parsed.cdcColumns.map(String).filter(Boolean) : [],
    fieldMappings: fieldMappings
      .map((item) => ({
        sourceField: String(item.sourceField || ""),
        targetField: String(item.targetField || ""),
        enabled: item.enabled !== false,
        dataType: item.dataType || sourceColumnMap.get(String(item.sourceField || ""))?.dataType,
        isPrimaryKey: Boolean(item.isPrimaryKey),
        defaultValue: item.defaultValue ?? undefined
      }))
      .filter((item) => item.sourceField),
    transformRules: Array.isArray(parsed.transformRules) ? parsed.transformRules : [],
    scheduleConfig: parsed.scheduleConfig || null,
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.map(String).filter(Boolean) : []
  };
}

function resolveSourceObjectType(source) {
  const raw = String(source?.sourceType || source?.connectionConfig?.dialect || "").toLowerCase();
  if (raw.includes("kafka")) return "kafka";
  if (raw.includes("ftp")) return "ftp";
  if (raw.includes("postgres")) return "postgresql";
  if (raw.includes("mysql")) return "mysql";
  return raw || "unknown";
}

function normalizeSyncModeBySource(value, sourceType) {
  const normalized = normalizeEnum(value, ["full", "incremental", "cdc"], "full");
  if (sourceType === "kafka") return "full";
  if (sourceType === "ftp") return normalized === "incremental" ? "incremental" : "full";
  return normalized;
}

async function repairRecommendationPayload(provider, rawText) {
  try {
    const response = await modelProviderService.generateChatCompletion(
      provider,
      ensureJsonObjectPrompt([
        {
          role: "system",
          content: "你是 JSON 修复助手。请把输入内容整理成一个合法 JSON 对象，只输出 JSON，不要 Markdown，不要解释。字段固定为：taskName、taskCode、ownerName、description、syncMode、targetTableMode、targetTable、writeMode、partitionMode、partitionColumn、partitionValue、incrementalConfig、cdcColumns、fieldMappings、transformRules、scheduleConfig、reasoning。"
        },
        {
          role: "user",
          content: JSON.stringify({ rawText }, null, 2)
        }
      ], provider),
      {
        temperature: 0,
        maxTokens: 1800,
        timeoutMs: 120000,
        responseFormat: { type: "json_object" }
      }
    );
    return tryParseJson(response.content);
  } catch (_error) {
    return null;
  }
}

function buildFallbackTaskCode(parsed, payload, source, target) {
  const candidates = [
    parsed?.taskCode,
    parsed?.taskName,
    payload?.taskCode,
    payload?.taskName,
    payload?.sourceTable,
    source?.sourceCode && target?.sourceCode
      ? `${source.sourceCode}_${target.sourceCode}_${payload?.sourceTable || "task"}`
      : null,
    source?.sourceCode && payload?.sourceTable
      ? `${source.sourceCode}_${payload.sourceTable}`
      : null,
    "ingestion_task"
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");

    if (normalized) {
      return normalized.slice(0, 64);
    }
  }

  return "ingestion_task";
}

function extractJsonObject(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("invalid json");
  }
  return content.slice(start, end + 1);
}

function tryParseJson(content) {
  const normalized = String(content || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(extractJsonObject(normalized));
  } catch (_error) {
    return null;
  }
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = String(value || "").toLowerCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeNullableEnum(value, allowedValues) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const normalized = String(value).toLowerCase();
  return allowedValues.includes(normalized) ? normalized : null;
}

function normalizeWriteMode(value, targetType = "") {
  const normalized = String(value || "").toLowerCase();
  const normalizedTargetType = String(targetType || "").toLowerCase() === "postgres" ? "postgresql" : String(targetType || "").toLowerCase();

  if (normalizedTargetType === "postgresql") {
    return ["append", "overwrite"].includes(normalized) ? normalized : "append";
  }

  if (normalizedTargetType === "hive") {
    return ["append", "overwrite", "partition_overwrite"].includes(normalized) ? normalized : "append";
  }

  if (normalizedTargetType === "mysql") {
    return ["append", "replace", "overwrite"].includes(normalized) ? normalized : "append";
  }

  return ["append", "replace", "overwrite", "partition_overwrite"].includes(normalized) ? normalized : "append";
}

function ensureJsonObjectPrompt(messages = [], provider = null) {
  const providerText = `${provider?.providerType || ""} ${provider?.configName || ""} ${provider?.modelName || ""}`.toLowerCase();
  if (!providerText.includes("deepseek")) {
    return messages;
  }
  return (Array.isArray(messages) ? messages : []).map((item, index, list) => {
    if (!item || typeof item !== "object") return item;
    if (index === 0 || index === list.length - 1) {
      return {
        ...item,
        content: `${String(item.content || "").trim()}\n\nReturn valid JSON only. The response must be a JSON object.`,
      };
    }
    return item;
  });
}

module.exports = {
  recommendTaskConfig
};






