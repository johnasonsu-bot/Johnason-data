const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { pool } = require("../config/database");

const TASK_CONFIG_RECOMMENDATION_PROMPT = `
你是资深数据集成架构师，负责为“创建接入任务”生成可直接落地的推荐配置。

[输入前提]
1. 用户会先选择：来源数据源、来源表、目标数据源。
2. 当前场景默认推荐：targetTableMode = create，也就是“自动创建目标表”。
3. ownerName 直接使用当前系统登录用户，不要虚构其他负责人。
4. 你必须综合来源表结构、索引、约束、样例数据、当前表单上下文和目标数据源信息给出建议。

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
要求：只有在确实适合分区写入时才填写，否则返回 null。

10. incrementalConfig.mode（增量模式）
可选值：timestamp | id | cdc | null
要求：仅当 syncMode 为 incremental 或 cdc 时填写合理值；否则返回 null。

11. incrementalConfig.cursorColumn（增量游标字段）
要求：若使用 incremental，必须选择来源表中真实存在且稳定可用的字段。

12. incrementalConfig.startValue（增量起始值）
要求：给出合理起始值。
规则：timestamp 类型可给出标准时间字符串，id 类型可给出 0 或其他合理起点；不用时返回 null。

13. cdcColumns（CDC 监听字段）
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
4. 如果某项无法确定，优先返回保守且可执行的默认值。`.trim();

const DATA_SOURCE_RESEARCH_PROMPT = `
你是资深数据接入架构师。请基于数据库探查证据完成表分类和接入建议。

输出必须是 JSON 对象，不要输出 Markdown。
字段固定为：
{
  "summary": "总体结论",
  "tableDecisions": [
    {
      "tableName": "表名",
      "category": "business|dictionary|relation|log|temporary|low_value",
      "confidence": 0.88,
      "priority": "high|medium|low",
      "evidence": ["判断依据"],
      "risks": ["风险提示"],
      "suggestedMode": "full|incremental|partition|manual_review"
    }
  ],
  "recommendedTables": ["建议优先接入表"],
  "deferredTables": ["建议暂缓表"],
  "governanceSuggestions": ["治理建议"],
  "ingestionSuggestions": ["接入建议"]
}`.trim();

const DATA_MAP_RESOURCE_CONTENT_PROFILE_PROMPT = `
你是企业数据目录和元数据治理专家。你会收到一个数据地图资源的基础信息、字段结构、样例画像和血缘摘要。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 不要编造样例中不存在的字段或业务事实。
3. 如无法确定业务含义，要给出保守判断和原因。
4. 本阶段只生成资源内容画像，不输出字段级 fieldInsights，不输出数据标准对标结论。
5. 本阶段不输出数据脱敏策略，不做分级分类结论。

输出结构固定为：
{
  "summary": "资源内容摘要",
  "businessMeaning": "业务含义，说明表承载的业务对象和业务活动",
  "businessGrain": "数据粒度判断，说明每行数据代表的业务粒度",
  "usageSuggestions": ["结合字段、样例、血缘给出的使用建议"],
  "qualityFindings": ["质量或元数据问题"],
  "riskNotes": ["风险提示"],
  "tags": ["业务标签"]
}`.trim();

const DATA_MAP_RESOURCE_FIELD_PROFILE_PROMPT = `
你是企业数据目录字段画像和数据标准对标专家。你会收到一个数据地图资源的字段结构、字段画像、样例值和标准数据元候选。

要求：
1. 只输出 JSON 对象，不要输出 Markdown。
2. 不要编造样例中不存在的字段或业务事实。
3. fieldInsights 必须覆盖输入中的每个字段。
4. featureTags 只能使用 primary_key、foreign_key、system_time、business_time、dictionary_value，一个字段可以返回多个特征标签；无法判断时返回空数组。
5. 特征标签必须综合字段名、字段描述、字段类型、是否必填、是否主键、空值率、样例值等证据判断，优先依据实际样例数据特征，不要只按字段名做机械匹配。
6. standardElementCode 必须且只能从该字段的 standardElementCandidates 中选择；候选不合适时返回空字符串。
7. issueTags 重点标注空值率异常、样例值缺失、疑似字典值不规范、字段描述缺失等问题；不要输出语义标签。

特征标签含义：
1. primary_key：主键或样例表现为唯一标识。
2. foreign_key：引用其他实体、字典、区域、机构等对象的关联键。
3. system_time：创建、更新、删除、同步、ETL、加载等系统审计时间。
4. business_time：业务事件、生效、登记、出生、到期等业务时间。
5. dictionary_value：代码、枚举、状态、级别、类型、标志等字典值。

输出结构固定为：
{
  "fieldInsights": [
    {
      "columnName": "字段名",
      "aiBusinessName": "字段中文业务名",
      "aiBusinessMeaning": "字段业务含义",
      "featureTags": ["特征标签，可多个或空数组"],
      "issueTags": ["问题标签"],
      "standardElementCode": "标准数据元编码或空字符串",
      "standardElementConfidence": 0.7,
      "standardElementEvidence": ["匹配依据"]
    }
  ]
}`.trim();

const DATA_MAP_RESOURCE_CONTENT_PROFILE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    businessMeaning: { type: "string" },
    businessGrain: { type: "string" },
    usageSuggestions: { type: "array", items: { type: "string" } },
    qualityFindings: { type: "array", items: { type: "string" } },
    riskNotes: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } }
  }
};

const DATA_MAP_RESOURCE_FIELD_PROFILE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    fieldInsights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          columnName: { type: "string" },
          aiBusinessName: { type: "string" },
          aiBusinessMeaning: { type: "string" },
          featureTags: { type: "array", items: { type: "string", enum: ["primary_key", "foreign_key", "system_time", "business_time", "dictionary_value"] }, maxItems: 5 },
          issueTags: { type: "array", items: { type: "string" } },
          standardElementCode: { type: "string" },
          standardElementConfidence: { type: "number" },
          standardElementEvidence: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
};

const ASSET_SEARCH_AI_DEFAULTS = {
  asset_search_query_interpretation: {
    sceneName: "资产检索查询理解",
    description: "用于把自然语言检索请求解析为结构化检索意图。",
    temperature: 0.1,
    maxTokens: 900,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业资产检索的查询理解助手。",
      "你只能理解用户检索需求，不能查询数据库，不能生成 SQL，不能编造资产。",
      "输出必须是 JSON 对象，不要 Markdown，不要解释。",
      "字段固定为：intent、assetTypes、sourceModules、keywords、chineseKeywords、englishKeywords、fieldKeywords。",
      "assetTypes 只能从 table、field、datasource、ingestion_task、quality_rule、quality_strategy、quality_result、service_api、service_app 中选择。",
      "sourceModules 只能从 data_map、ingestion、quality、services 中选择。",
      "如果无法确定类型或模块，返回空数组，交由系统结构化召回兜底。",
    ].join("\n"),
  },
  asset_search_query_expansion: {
    sceneName: "资产检索关键词扩展",
    description: "用于基于原始查询和结构化意图生成保守的中英文检索词。",
    temperature: 0.1,
    maxTokens: 700,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业资产检索的关键词扩展助手。",
      "你只能输出检索关键词，不能查询数据库，不能生成 SQL，不能编造资产。",
      "扩展词必须贴近用户原始需求，优先包含字段注释、中文业务词、常见英文列名、缩写或同义表达。",
      "输出必须是 JSON 对象，不要 Markdown，不要解释。",
      "字段固定为：expandedKeywords、fieldKeywords、tableKeywords、serviceKeywords。",
      "每个数组最多 12 个字符串。",
    ].join("\n"),
  },
  asset_search_result_rerank: {
    sceneName: "资产检索结果重排",
    description: "用于在系统已召回且已授权的候选资产内进行相关性重排。",
    temperature: 0.1,
    maxTokens: 1400,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业资产检索的候选结果重排助手。",
      "你只能基于输入候选资产排序，必须引用候选结果 id，不能新增候选外资产。",
      "不能查询数据库，不能生成 SQL，不能绕过权限。",
      "输出必须是 JSON 对象，不要 Markdown，不要解释。",
      "字段固定为：rankedResults。",
      "rankedResults 每项字段固定为 id、score、reason、relevant；id 必须来自候选列表，score 为 0 到 100。",
      "relevant 表示候选是否满足用户检索意图；不相关候选必须 relevant=false 且 score<=20。",
    ].join("\n"),
  },
  asset_search_result_summary: {
    sceneName: "资产检索结果总结",
    description: "用于基于最终授权结果生成可追溯的检索总结和推荐结果。",
    temperature: 0.2,
    maxTokens: 1200,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业资产检索的结果总结助手。",
      "你只能总结输入结果，必须引用候选结果 id，不能生成候选之外的资产。",
      "不能查询数据库，不能生成 SQL，不能绕过权限。",
      "总结必须能从结果明细追溯，不要泄露输入之外的信息。",
      "输出必须是 JSON 对象，不要 Markdown，不要解释。",
      "字段固定为：summary、suggestions、recommendedResults。",
      "recommendedResults 每项字段固定为 id、reason；id 必须来自候选列表。",
    ].join("\n"),
  },
};

const DEV_SQL_DEFAULTS = {
  sql_generate: {
    sceneName: "SQL 生成",
    description: "用于根据自然语言需求与当前数据源元数据生成 SQL。",
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业级 SQL 生成助手。",
      "必须严格依据当前连接数据源的真实表和字段生成 SQL。",
      "SQL 必须符合当前数据库类型/方言。",
      "优先直接满足用户需求，不要发散到无关建议。",
      "如果信息不足，只指出缺什么，不要臆造。",
    ].join("\n"),
  },
  sql_analyze: {
    sceneName: "SQL 问题分析",
    description: "用于分析 SQL 报错、语义问题和修复建议。",
    temperature: 0.1,
    maxTokens: 1600,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业级 SQL 问题分析助手。",
      "必须严格依据当前连接数据源的真实表和字段分析问题。",
      "分析和修复建议必须符合当前数据库类型/方言。",
      "优先定位最主要问题，再给最必要的修复建议。",
      "不要给无关扩展说明。",
    ].join("\n"),
  },
  sql_rewrite: {
    sceneName: "SQL 改写",
    description: "用于在原 SQL 基础上按新增需求进行最小改动改写。",
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业级 SQL 改写助手。",
      "必须严格依据当前连接数据源的真实表和字段改写 SQL。",
      "改写结果必须符合当前数据库类型/方言。",
      "优先最小改动，保留原 SQL 主要逻辑和口径。",
      "不要做无关重构。",
    ].join("\n"),
  },
  sql_optimize: {
    sceneName: "SQL 优化",
    description: "用于分析 SQL 性能问题并提供优化建议。",
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业级 SQL 优化助手。",
      "必须严格依据当前连接数据源的真实表和字段优化 SQL。",
      "优化建议和优化后 SQL 必须符合当前数据库类型/方言。",
      "优先指出最主要的性能瓶颈，并给最有效的优化方案。",
      "不要堆砌泛泛建议。",
    ].join("\n"),
  },
  sql_explain: {
    sceneName: "SQL 解释",
    description: "用于解释 SQL 逻辑、口径和结果粒度。",
    temperature: 0.1,
    maxTokens: 1200,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业级 SQL 解释助手。",
      "必须基于当前连接数据源的真实元数据理解 SQL。",
      "解释时优先说明用途、结果粒度、关键过滤条件。",
      "回答尽量简洁，不要过度发散。",
    ].join("\n"),
  },
  sql_data_research: {
    sceneName: "数据调研",
    description: "用于基于所选表结构、字段注释和样例数据生成贴合业务场景的数据分析方向。",
    temperature: 0.2,
    maxTokens: 1800,
    timeoutMs: 30000,
    systemPrompt: [
      "你是企业数据开发工作台中的数据调研助手。",
      "必须严格依据用户所选表的真实结构、字段注释和样例数据理解业务，不允许臆造不存在的表、字段或业务事实。",
      "必须只给出三条分析方向，每条都是一项明确、完整、可以直接用于后续生成 SQL 的业务分析需求。",
      "每条必须完整说明标题、业务问题、分析对象、分析维度、核心指标、统计口径、数据依据和业务价值。",
      "分析方向要聚焦能够支持业务判断或行动的实际问题，不要套用空泛的规模、趋势、异常模板。",
      "禁止把字段、维度、指标、机构名称或枚举值单独拆成分析方向。",
      "如果样例或注释不足，应明确说明判断依据和限制。",
      "数据调研阶段不要生成 SQL。",
    ].join("\n"),
  },
};

const REPORTING_AI_DEFAULTS = {
  chart_analysis_suggestion: {
    sceneName: "数据分析需求建议",
    description: "用于在报表开发中基于数据源元数据、候选表字段和随机样例数据生成贴合业务场景的分析需求。",
    temperature: 0.2,
    maxTokens: 1600,
    timeoutMs: 30000,
    inputSchema: {
      datasource: "报表数据源、数据库类型和可用表结构",
      tables: "候选表与字段结构，最多 5 张表",
      tableSamples: "候选表随机样例数据，每表最多 50 行，每个字段值最多 100 字符",
      analysisDirection: "用户输入的分析方向，可为空",
      selectedTables: "用户限定的表范围，最多 5 张表",
      promptVariables: ["${datasource}", "${tables}", "${tableSamples}", "${analysisDirection}", "${dialect}", "${sceneCode}"],
    },
    systemPrompt: [
      "你是报表平台中的数据分析需求规划助手。",
      "必须基于当前报表数据源元数据、候选表字段和随机样例数据，结合用户分析方向生成可落到 SQL 和图表的分析需求。",
      "每条建议要贴合业务场景，明确分析对象、统计口径、维度、指标、筛选范围和推荐图表方向。",
      "不要编造不存在的表或字段；如果信息不足，给出保守可执行的需求并说明限制。",
      "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    ].join("\n"),
  },
  chart_sql_plan: {
    sceneName: "自然语言生成查询 SQL",
    description: "用于在报表开发中根据自然语言需求、表结构和随机样例数据生成只读 SQL。",
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 30000,
    inputSchema: {
      datasource: "报表数据源、数据库类型和可用表结构",
      prompt: "用户的报表分析需求",
      selectedTables: "用户限定的表范围，最多 5 张表",
      tableSamples: "候选表随机样例数据，每表最多 50 行，每个字段值最多 100 字符",
      currentSql: "用户当前已审核或修改的 SQL，可为空",
      promptVariables: ["${datasource}", "${tables}", "${tableSamples}", "${prompt}", "${currentSql}", "${dialect}", "${sceneCode}"],
    },
    systemPrompt: [
      "你是报表平台中的自然语言转 SQL 助手。",
      "必须严格依据当前报表数据源元数据和随机样例数据生成 SQL，不允许臆造不存在的表或字段。",
      "只允许生成单条只读查询 SQL，必须符合当前数据库方言。",
      "优先生成适合报表图表使用的聚合查询，字段别名要清晰稳定。",
      "可以参考随机样例数据理解字段业务含义，但仍以字段结构为准。",
      "如果需求信息不足，返回需要追问的内容，不要强行猜测。",
      "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    ].join("\n"),
  },
  chart_sql_revision: {
    sceneName: "二次修改查询 SQL",
    description: "用于在报表开发中根据用户补充要求、当前 SQL、查询结果画像和样例数据二次修改只读 SQL。",
    temperature: 0.1,
    maxTokens: 1800,
    timeoutMs: 30000,
    inputSchema: {
      datasource: "报表数据源、数据库类型和可用表结构",
      prompt: "用户原始报表分析需求",
      selectedTables: "用户限定的表范围，最多 5 张表",
      tableSamples: "候选表随机样例数据，每表最多 50 行，每个字段值最多 100 字符",
      currentSql: "用户当前已审核或执行的 SQL",
      revisionInstruction: "用户本次希望调整 SQL 的补充要求",
      lastQueryProfile: "上次查询结果字段画像，可为空",
      lastError: "上次执行错误，可为空",
      promptVariables: ["${datasource}", "${tables}", "${tableSamples}", "${prompt}", "${currentSql}", "${revisionInstruction}", "${lastQueryProfile}", "${lastError}", "${dialect}", "${sceneCode}"],
    },
    systemPrompt: [
      "你是报表平台中的 SQL 二次修改助手。",
      "必须基于用户当前 SQL、补充要求、表结构、随机样例数据和查询结果画像做最小必要修改。",
      "只允许生成单条只读查询 SQL，必须符合当前数据库方言。",
      "不要编造不存在的表或字段，不要输出 SELECT *。",
      "可以参考随机样例数据理解字段业务含义，但仍以字段结构为准。",
      "如果无法安全修改，返回需要追问的内容，不要强行猜测。",
      "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    ].join("\n"),
  },
  chart_recommendation: {
    sceneName: "查询结果推荐图表",
    description: "用于根据查询结果字段画像和报表图表资产推荐图表类型与字段映射。",
    temperature: 0.1,
    maxTokens: 1600,
    timeoutMs: 30000,
    inputSchema: {
      profile: "SQL 查询结果字段画像、样例数据、维度指标识别",
      chartFamilies: "当前报表平台支持的图表族与资产",
      prompt: "用户原始分析需求",
      sourceSql: "用户最终审核执行的 SQL",
      promptVariables: ["${profile}", "${sampleRows}", "${fallbackRecommendations}", "${prompt}", "${supportedChartFamilies}", "${sceneCode}"],
    },
    systemPrompt: [
      "你是报表平台中的图表推荐助手。",
      "必须结合查询结果字段画像和当前平台支持的图表族推荐可落地的图表。",
      "推荐要优先选择字段映射明确、用户容易审核的图表。",
      "不要推荐当前平台不支持的图表类型，不要编造字段。",
      "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    ].join("\n"),
  },
  chart_field_mapping: {
    sceneName: "图表字段智能映射",
    description: "用于根据查询结果字段画像、样例数据和目标图表资产要求，智能分配分类字段、指标字段等映射。",
    temperature: 0.1,
    maxTokens: 1200,
    timeoutMs: 30000,
    inputSchema: {
      profile: "查询结果字段画像",
      sampleRows: "查询样例数据",
      chartAsset: "目标图表资产与字段映射要求",
      currentFieldMap: "当前默认字段映射",
      prompt: "用户原始分析需求",
      promptVariables: ["${profile}", "${sampleRows}", "${chartAsset}", "${currentFieldMap}", "${prompt}", "${sceneCode}"],
    },
    systemPrompt: [
      "你是报表平台中的图表字段映射助手。",
      "必须根据目标图表资产的字段要求，从查询结果中分配最合适的分类字段、指标字段、时间字段等。",
      "要综合字段名、字段角色、样例数据和用户需求理解，不要只按数据类型机械猜测。",
      "只能使用查询结果中存在的字段名，不要编造字段。",
      "输出必须是 JSON 对象，不要 Markdown，不要代码块。",
    ].join("\n"),
  },
};

const DEFAULT_ROLE_DEFINITIONS = [
  {
    roleName: "System Administrator",
    roleCode: "admin",
    roleType: "admin",
    isSystem: 1,
    permissions: {
      modules: [
        "overview",
        "ingestion",
        "quality",
        "processing",
        "data_map",
        "standards",
        "services",
        "reporting",
        "data_modeling",
        "system_services",
        "system_users",
        "system_roles",
        "system_models",
        "system_projects"
      ]
    }
  },
  {
    roleName: "Developer",
    roleCode: "developer",
    roleType: "developer",
    isSystem: 1,
    permissions: {
      modules: ["overview", "ingestion", "quality", "processing", "data_map", "standards", "services", "reporting", "data_modeling"]
    }
  },
  {
    roleName: "运维",
    roleCode: "operator",
    roleType: "operator",
    isSystem: 1,
    permissions: {
      modules: ["overview", "quality", "data_map", "standards", "services", "reporting", "data_modeling", "system_services", "system_users", "system_projects"]
    }
  },
  {
    roleName: "只读用户",
    roleCode: "viewer",
    roleType: "viewer",
    isSystem: 1,
    permissions: {
      modules: ["overview", "quality", "data_map", "standards", "services", "reporting", "data_modeling"],
      mode: "readonly",
      actions: ["read"]
    }
  }
];

async function getDefaultProjectId() {
  const [rows] = await pool.query("SELECT id FROM project_spaces WHERE project_code = 'default' LIMIT 1");
  if (rows.length > 0) {
    return Number(rows[0].id);
  }

  const [adminRows] = await pool.query(
    "SELECT id, display_name AS displayName FROM users WHERE role_code = 'admin' ORDER BY id ASC LIMIT 1"
  );
  const owner = adminRows[0] || {};
  const [result] = await pool.query(
    `INSERT INTO project_spaces
      (project_name, project_code, project_type, description, owner_user_id, owner_name, status, resource_config_json, settings_json, created_by)
     VALUES ('默认项目', 'default', 'standard', '历史数据和未指定项目的默认工作空间', ?, ?, 'active', JSON_OBJECT(), JSON_OBJECT(), 'system')`,
    [owner.id || null, owner.displayName || "system"]
  );
  return Number(result.insertId);
}

async function seedSystemRoles() {
  for (const role of DEFAULT_ROLE_DEFINITIONS) {
    const [rows] = await pool.query(
      "SELECT id FROM system_roles WHERE role_code = ? LIMIT 1",
      [role.roleCode]
    );

    if (rows.length > 0) {
      continue;
    }

    await pool.query(
      `INSERT INTO system_roles (role_name, role_code, role_type, permissions_json, status, is_system)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [role.roleName, role.roleCode, role.roleType, JSON.stringify(role.permissions), role.isSystem]
    );
  }
}

async function seedAdminUser() {
  await seedSystemRoles();

  const [roleRows] = await pool.query(
    "SELECT id, role_code FROM system_roles WHERE role_code = 'admin' LIMIT 1"
  );
  const adminRole = roleRows[0] || null;
  const [rows] = await pool.query(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    ["admin"]
  );

  if (rows.length > 0) {
    if (adminRole) {
      await pool.query(
        "UPDATE users SET role_id = ?, role_code = ? WHERE username = ?",
        [adminRole.id, adminRole.role_code, "admin"]
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash("Admin@123", env.bcryptSaltRounds);

  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role_code, status)
     VALUES (?, ?, ?, ?, ?)`,
    ["admin", passwordHash, "System Administrator", "admin", "active"]
  );

  if (adminRole) {
    await pool.query(
      "UPDATE users SET role_id = ?, role_code = ? WHERE username = ?",
      [adminRole.id, adminRole.role_code, "admin"]
    );
  }
}

async function seedDemoDataSources() {
  const defaultProjectId = await getDefaultProjectId();
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM data_sources");
  const [ingestionRows] = await pool.query("SELECT COUNT(*) AS total FROM ingestion_data_sources");

  if (rows[0].total === 0) {
    await pool.query(
      `INSERT INTO data_sources (project_id, source_name, source_code, source_type, connection_config, owner_name, status)
       VALUES
       (?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?)`,
      [
        defaultProjectId, "HIS Main Database", "his_mysql", "mysql", JSON.stringify({ host: "localhost", port: 3306, database: "his" }), "Architecture Team", "active",
        defaultProjectId, "LIS Sample Files", "lis_sftp", "sftp", JSON.stringify({ host: "10.10.10.12", port: 22, path: "/upload/lis" }), "Data Integration Team", "active",
        defaultProjectId, "Medical Insurance API", "mi_api", "api", JSON.stringify({ baseUrl: "https://api.example.com/settlement" }), "Service Governance Team", "inactive"
      ]
    );
  }

  if (ingestionRows[0].total === 0) {
    await pool.query(
      `INSERT IGNORE INTO ingestion_data_sources
        (id, project_id, source_name, source_code, source_type, connection_config, owner_name, status, created_at, updated_at)
       SELECT id, project_id, source_name, source_code, source_type, connection_config, owner_name, status, created_at, updated_at
       FROM data_sources
       WHERE source_domain <> 'quality' AND source_domain <> 'quality_shadow'`
    );
  }
}

async function seedDemoLabDataSources() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM data_lab_sources");
  if (rows[0].total > 0) {
    return;
  }

  await pool.query(
    `INSERT INTO data_lab_sources
      (id, project_id, source_name, source_code, source_type, connection_config, owner_name, status, created_at, updated_at)
     SELECT id, project_id, source_name, source_code, source_type, connection_config, owner_name, status, created_at, updated_at
     FROM data_sources`
  );
}

async function ensureIngestionAiScene(sceneName, sceneCode, systemPrompt, description, options = {}) {
  const [rows] = await pool.query(
    `SELECT id, system_prompt AS systemPrompt
     FROM ingestion_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );

  if (rows.length > 0) {
    const existingPrompt = String(rows[0].systemPrompt || "");
    const shouldReplacePrompt = Boolean(
      options.replacePrompt
      || !existingPrompt.trim()
      || (typeof options.replacePromptWhen === "function" && options.replacePromptWhen(existingPrompt))
    );

    await pool.query(
      `UPDATE ingestion_ai_configs
       SET scene_name = ?,
           description = ?,
           system_prompt = CASE WHEN ? THEN ? ELSE system_prompt END
       WHERE scene_code = ?`,
      [sceneName, description, shouldReplacePrompt ? 1 : 0, systemPrompt || "", sceneCode]
    );
    return;
  }

  await pool.query(
    `INSERT INTO ingestion_ai_configs
    (scene_name, scene_code, default_model_provider_id, system_prompt, description, owner_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sceneName, sceneCode, null, systemPrompt, description, "System Administrator", "active"]
  );
}

async function ensureServiceAiScene(sceneName, sceneCode, systemPrompt, description, options = {}) {
  const [rows] = await pool.query(
    `SELECT id, system_prompt AS systemPrompt
     FROM service_ai_configs
     WHERE scene_code = ?
     LIMIT 1`,
    [sceneCode]
  );

  if (rows.length > 0) {
    const existingPrompt = String(rows[0].systemPrompt || "");
    const shouldReplacePrompt = Boolean(
      options.replacePrompt
      || !existingPrompt.trim()
      || (typeof options.replacePromptWhen === "function" && options.replacePromptWhen(existingPrompt))
    );
    await pool.query(
      `UPDATE service_ai_configs
       SET scene_name = ?,
           description = ?,
           system_prompt = CASE WHEN ? THEN ? ELSE system_prompt END
       WHERE scene_code = ?`,
      [sceneName, description, shouldReplacePrompt ? 1 : 0, systemPrompt || "", sceneCode]
    );
    return;
  }

  await pool.query(
    `INSERT INTO service_ai_configs
      (scene_name, scene_code, default_model_provider_id, system_prompt, description, owner_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sceneName, sceneCode, null, systemPrompt, description, "System Administrator", "active"]
  );
}

async function ensureDevAiScene(sceneName, sceneCode, systemPrompt, description, defaults = {}) {
  const [rows] = await pool.query("SELECT id FROM dev_ai_configs WHERE scene_code = ? LIMIT 1", [sceneCode]);

  if (rows.length > 0) {
    await pool.query(
      `UPDATE dev_ai_configs
       SET scene_name = ?,
           description = ?,
           temperature = CASE WHEN temperature IS NULL THEN ? ELSE temperature END,
           max_tokens = CASE WHEN max_tokens IS NULL THEN ? ELSE max_tokens END,
           timeout_ms = CASE WHEN timeout_ms IS NULL THEN ? ELSE timeout_ms END,
           system_prompt = CASE WHEN system_prompt IS NULL OR system_prompt = '' THEN ? ELSE system_prompt END
       WHERE scene_code = ?`,
      [
        sceneName,
        description,
        defaults.temperature ?? null,
        defaults.maxTokens ?? null,
        defaults.timeoutMs ?? null,
        systemPrompt || "",
        sceneCode,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO dev_ai_configs
    (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version, temperature, max_tokens, timeout_ms, system_prompt, description, owner_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sceneName,
      sceneCode,
      null,
      null,
      null,
      defaults.temperature ?? null,
      defaults.maxTokens ?? null,
      defaults.timeoutMs ?? null,
      systemPrompt,
      description,
      "System Administrator",
      "active",
    ]
  );
}

async function ensureDataMapAiScene(sceneName, sceneCode, systemPrompt, description, defaults = {}) {
  const [rows] = await pool.query(
    "SELECT id, system_prompt AS systemPrompt, output_schema_json AS outputSchemaJson FROM dm_ai_configs WHERE scene_code = ? LIMIT 1",
    [sceneCode]
  );

  if (rows.length > 0) {
    const existingPrompt = String(rows[0].systemPrompt || "");
    const shouldReplacePrompt = Boolean(
      defaults.replacePrompt
      || !existingPrompt.trim()
      || (typeof defaults.replacePromptWhen === "function" && defaults.replacePromptWhen(existingPrompt))
    );
    let nextOutputSchema = defaults.outputSchema || {};
    let shouldReplaceOutputSchema = shouldReplacePrompt;
    try {
      const existingOutputSchema = rows[0].outputSchemaJson ? JSON.parse(rows[0].outputSchemaJson) : {};
      const hasExistingSchema = Object.keys(existingOutputSchema).length > 0;
      const shouldReplaceSchemaByRule = typeof defaults.replaceOutputSchemaWhen === "function"
        ? defaults.replaceOutputSchemaWhen(existingOutputSchema)
        : false;
      shouldReplaceOutputSchema = shouldReplaceOutputSchema || !hasExistingSchema || shouldReplaceSchemaByRule;
      nextOutputSchema = shouldReplaceOutputSchema ? (defaults.outputSchema || {}) : existingOutputSchema;
    } catch {
      nextOutputSchema = defaults.outputSchema || {};
      shouldReplaceOutputSchema = true;
    }
    await pool.query(
      `UPDATE dm_ai_configs
       SET scene_name = ?,
           description = ?,
           temperature = CASE WHEN temperature IS NULL THEN ? ELSE temperature END,
           max_tokens = CASE WHEN max_tokens IS NULL THEN ? ELSE max_tokens END,
           timeout_ms = CASE WHEN timeout_ms IS NULL THEN ? ELSE timeout_ms END,
           output_schema_json = CASE WHEN ? THEN ? ELSE output_schema_json END,
           system_prompt = CASE WHEN ? THEN ? ELSE system_prompt END,
           user_prompt_template = CASE WHEN user_prompt_template IS NULL OR user_prompt_template = '' THEN ? ELSE user_prompt_template END
       WHERE scene_code = ?`,
      [
        sceneName,
        description,
        defaults.temperature ?? null,
        defaults.maxTokens ?? null,
        defaults.timeoutMs ?? null,
        shouldReplaceOutputSchema ? 1 : 0,
        JSON.stringify(nextOutputSchema || {}),
        shouldReplacePrompt ? 1 : 0,
        systemPrompt || "",
        defaults.userPromptTemplate || "",
        sceneCode,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO dm_ai_configs
    (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version, temperature, max_tokens, timeout_ms, system_prompt, user_prompt_template, output_schema_json, description, owner_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sceneName,
      sceneCode,
      null,
      null,
      null,
      defaults.temperature ?? null,
      defaults.maxTokens ?? null,
      defaults.timeoutMs ?? null,
      systemPrompt,
      defaults.userPromptTemplate || "",
      JSON.stringify(defaults.outputSchema || {}),
      description,
      "System Administrator",
      "active",
    ]
  );
}

async function ensureAssetSearchAiScene(sceneCode, defaults = {}) {
  const [rows] = await pool.query(
    "SELECT id, system_prompt AS systemPrompt FROM asset_search_ai_configs WHERE scene_code = ? LIMIT 1",
    [sceneCode]
  );

  if (rows.length > 0) {
    const existingPrompt = String(rows[0].systemPrompt || "");
    const shouldReplacePrompt = !existingPrompt.trim();
    await pool.query(
      `UPDATE asset_search_ai_configs
       SET scene_name = ?,
           description = ?,
           temperature = CASE WHEN temperature IS NULL THEN ? ELSE temperature END,
           max_tokens = CASE WHEN max_tokens IS NULL THEN ? ELSE max_tokens END,
           timeout_ms = CASE WHEN timeout_ms IS NULL THEN ? ELSE timeout_ms END,
           system_prompt = CASE WHEN ? THEN ? ELSE system_prompt END
       WHERE scene_code = ?`,
      [
        defaults.sceneName,
        defaults.description,
        defaults.temperature ?? null,
        defaults.maxTokens ?? null,
        defaults.timeoutMs ?? null,
        shouldReplacePrompt ? 1 : 0,
        defaults.systemPrompt || "",
        sceneCode,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO asset_search_ai_configs
    (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version, temperature, max_tokens, timeout_ms, system_prompt, description, owner_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      defaults.sceneName,
      sceneCode,
      null,
      null,
      null,
      defaults.temperature ?? null,
      defaults.maxTokens ?? null,
      defaults.timeoutMs ?? null,
      defaults.systemPrompt || "",
      defaults.description || "",
      "System Administrator",
      "active",
    ]
  );
}

async function ensureReportingAiScene(sceneName, sceneCode, systemPrompt, description, defaults = {}) {
  const [rows] = await pool.query("SELECT id, input_schema_json AS inputSchemaJson FROM reporting_ai_configs WHERE scene_code = ? LIMIT 1", [sceneCode]);

  if (rows.length > 0) {
    let nextInputSchema = defaults.inputSchema || {};
    try {
      const existingInputSchema = rows[0].inputSchemaJson ? JSON.parse(rows[0].inputSchemaJson) : {};
      const defaultVariables = Array.isArray(defaults.inputSchema?.promptVariables) ? defaults.inputSchema.promptVariables : [];
      const existingVariables = Array.isArray(existingInputSchema.promptVariables) ? existingInputSchema.promptVariables : [];
      nextInputSchema = {
        ...defaults.inputSchema,
        ...existingInputSchema,
        promptVariables: Array.from(new Set([...existingVariables, ...defaultVariables])),
      };
    } catch {
      nextInputSchema = defaults.inputSchema || {};
    }
    await pool.query(
      `UPDATE reporting_ai_configs
       SET scene_name = ?,
           description = ?,
           temperature = CASE WHEN temperature IS NULL THEN ? ELSE temperature END,
           max_tokens = CASE WHEN max_tokens IS NULL THEN ? ELSE max_tokens END,
           timeout_ms = CASE WHEN timeout_ms IS NULL THEN ? ELSE timeout_ms END,
           input_schema_json = ?,
           system_prompt = CASE WHEN system_prompt IS NULL OR system_prompt = '' THEN ? ELSE system_prompt END
       WHERE scene_code = ?`,
      [
        sceneName,
        description,
        defaults.temperature ?? null,
        defaults.maxTokens ?? null,
        defaults.timeoutMs ?? null,
        JSON.stringify(nextInputSchema || {}),
        systemPrompt || "",
        sceneCode,
      ]
    );
    return;
  }

  await pool.query(
    `INSERT INTO reporting_ai_configs
    (scene_name, scene_code, default_model_provider_id, default_model_name, default_model_version, temperature, max_tokens, timeout_ms, input_schema_json, system_prompt, description, owner_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sceneName,
      sceneCode,
      null,
      null,
      null,
      defaults.temperature ?? null,
      defaults.maxTokens ?? null,
      defaults.timeoutMs ?? null,
      JSON.stringify(defaults.inputSchema || {}),
      systemPrompt,
      description,
      "System Administrator",
      "active",
    ]
  );
}

async function seedBuiltinAiConfigs() {
  await pool.query(
    `DELETE FROM dev_ai_configs
     WHERE scene_code IN ('sql_copilot')`
  );

  await ensureIngestionAiScene(
    "Log Analysis",
    "log_analysis",
    "You are a senior data integration troubleshooting assistant. Analyze task context and failure logs, identify the most likely root cause, and provide actionable troubleshooting suggestions.",
    "Used to analyze ingestion task failures and provide troubleshooting guidance."
  );

  await ensureIngestionAiScene(
    "Task Config Recommendation",
    "task_config_recommendation",
    TASK_CONFIG_RECOMMENDATION_PROMPT,
    "Used to generate configuration recommendations for ingestion tasks."
  );

  await ensureIngestionAiScene(
    "API 接口文档解析",
    "api_document_parser",
    [
      "你是数据接入平台的 API 接口文档解析助手。",
      "基于用户文字和接口文档提取可执行的 API 接入配置；不得编造参数、认证信息或响应字段。",
      "认证密钥、Token、密码仅识别名称、位置和类型，value 必须返回空字符串。",
      "只输出 JSON 对象，不要 Markdown。若信息不足，在 missingItems 和 assumptions 中说明。",
    ].join("\\n"),
    "Used to parse API documentation and generate a reviewable ingestion configuration proposal."
  );

  await ensureIngestionAiScene(
    "数据源调研",
    "data_source_research",
    DATA_SOURCE_RESEARCH_PROMPT,
    "Used to classify source tables and generate pre-ingestion research suggestions."
  );

  await ensureIngestionAiScene(
    "文件上传",
    "file_upload_naming",
    [
      "你是文件上传入库场景中的字段命名助手。",
      "你的职责是把中文业务字段名转换成适合数据库落表的英文技术名。",
      "优先输出简洁、稳定、可维护的技术名，默认采用 snake_case 风格。",
      "禁止输出中文、空格、短横线和特殊字符。",
      "如果字段已经是规范英文名，可直接保留或做最小规范化。",
      "回答必须严格基于输入字段，不要编造额外字段。",
      "如果要求输出 JSON，必须只输出 JSON 对象，不要 Markdown，不要解释。",
    ].join("\n"),
    "Used to generate English technical names and naming suggestions for file upload fields."
  );

  await ensureDataMapAiScene(
    "资源内容画像分析",
    "resource_content_profile",
    DATA_MAP_RESOURCE_CONTENT_PROFILE_PROMPT,
    "用于数据地图资源详情页基于字段画像、样例数据和血缘关系生成内容画像分析。",
    {
      temperature: 0.1,
      maxTokens: 2200,
      timeoutMs: 30000,
      userPromptTemplate: "请基于以下 JSON 证据生成资源内容画像：\n{{resourceEvidence}}",
      outputSchema: DATA_MAP_RESOURCE_CONTENT_PROFILE_OUTPUT_SCHEMA,
      replacePromptWhen(existingPrompt) {
        const prompt = String(existingPrompt || "");
        return prompt.includes("fieldInsights")
          || prompt.includes("featureTags")
          || prompt.includes("最多返回一个")
          || prompt.includes("单个特征标签")
          || prompt.includes("\"businessName\"")
          || prompt.includes("\"businessMeaning\"");
      },
      replaceOutputSchemaWhen(existingSchema) {
        return JSON.stringify(existingSchema || {}).includes("fieldInsights");
      },
    }
  );

  await ensureDataMapAiScene(
    "资源字段信息分析",
    "resource_field_profile",
    DATA_MAP_RESOURCE_FIELD_PROFILE_PROMPT,
    "用于数据地图资源详情页基于字段结构、样例画像和标准数据元候选生成字段信息分析。",
    {
      temperature: 0.1,
      maxTokens: 2200,
      timeoutMs: 30000,
      userPromptTemplate: "请基于以下 JSON 证据生成字段信息分析：\n{{resourceEvidence}}",
      outputSchema: DATA_MAP_RESOURCE_FIELD_PROFILE_OUTPUT_SCHEMA,
      replacePromptWhen(existingPrompt) {
        return String(existingPrompt || "").includes("semanticTags");
      },
      replaceOutputSchemaWhen(existingSchema) {
        const schemaText = JSON.stringify(existingSchema || {});
        return !schemaText.includes("fieldInsights") || !schemaText.includes("aiBusinessName") || schemaText.includes("semanticTags");
      },
    }
  );

  for (const [sceneCode, defaults] of Object.entries(ASSET_SEARCH_AI_DEFAULTS)) {
    await ensureAssetSearchAiScene(sceneCode, defaults);
  }

  await ensureServiceAiScene(
    "服务开发推荐",
    "service_config_recommendation",
    [
      "你是资深数据服务架构师，负责为“数据服务 / 表转 API 或 SQL 转 API”生成可直接落地的推荐配置。",
      "你必须综合数据源类型、表结构或 SQL 结果字段、样例数据与当前表单上下文，给出服务名称、服务编码、接口路径、请求方式、查询参数和返回字段建议。",
      "服务编码只允许小写字母、数字、下划线，可为空时自动生成合理建议。",
      "输出必须是 JSON，不要输出 Markdown，不要解释。",
      "字段固定为：serviceName、serviceCode、servicePath、requestMethod、serviceType、description、queryFields、responseFieldNames、reasoning。",
      "queryFields 中可包含 requirementMode(required|optional|one_of_group) 与 requiredGroup。",
      "如果信息不足，优先返回保守且可执行的建议。",
    ].join("\n"),
    "Used to recommend API service configuration in the data service module."
  );

  await ensureDevAiScene(
    DEV_SQL_DEFAULTS.sql_generate.sceneName,
    "sql_generate",
    DEV_SQL_DEFAULTS.sql_generate.systemPrompt,
    DEV_SQL_DEFAULTS.sql_generate.description,
    DEV_SQL_DEFAULTS.sql_generate
  );

  await ensureDevAiScene(
    DEV_SQL_DEFAULTS.sql_analyze.sceneName,
    "sql_analyze",
    DEV_SQL_DEFAULTS.sql_analyze.systemPrompt,
    DEV_SQL_DEFAULTS.sql_analyze.description,
    DEV_SQL_DEFAULTS.sql_analyze
  );

  await ensureDevAiScene(
    DEV_SQL_DEFAULTS.sql_rewrite.sceneName,
    "sql_rewrite",
    DEV_SQL_DEFAULTS.sql_rewrite.systemPrompt,
    DEV_SQL_DEFAULTS.sql_rewrite.description,
    DEV_SQL_DEFAULTS.sql_rewrite
  );

  await ensureDevAiScene(
    DEV_SQL_DEFAULTS.sql_optimize.sceneName,
    "sql_optimize",
    DEV_SQL_DEFAULTS.sql_optimize.systemPrompt,
    DEV_SQL_DEFAULTS.sql_optimize.description,
    DEV_SQL_DEFAULTS.sql_optimize
  );

  await ensureDevAiScene(
    DEV_SQL_DEFAULTS.sql_explain.sceneName,
    "sql_explain",
    DEV_SQL_DEFAULTS.sql_explain.systemPrompt,
    DEV_SQL_DEFAULTS.sql_explain.description,
    DEV_SQL_DEFAULTS.sql_explain
  );

  await ensureDevAiScene(
    DEV_SQL_DEFAULTS.sql_data_research.sceneName,
    "sql_data_research",
    DEV_SQL_DEFAULTS.sql_data_research.systemPrompt,
    DEV_SQL_DEFAULTS.sql_data_research.description,
    DEV_SQL_DEFAULTS.sql_data_research
  );

  await ensureReportingAiScene(
    REPORTING_AI_DEFAULTS.chart_analysis_suggestion.sceneName,
    "chart_analysis_suggestion",
    REPORTING_AI_DEFAULTS.chart_analysis_suggestion.systemPrompt,
    REPORTING_AI_DEFAULTS.chart_analysis_suggestion.description,
    REPORTING_AI_DEFAULTS.chart_analysis_suggestion
  );

  await ensureReportingAiScene(
    REPORTING_AI_DEFAULTS.chart_sql_plan.sceneName,
    "chart_sql_plan",
    REPORTING_AI_DEFAULTS.chart_sql_plan.systemPrompt,
    REPORTING_AI_DEFAULTS.chart_sql_plan.description,
    REPORTING_AI_DEFAULTS.chart_sql_plan
  );

  await ensureReportingAiScene(
    REPORTING_AI_DEFAULTS.chart_sql_revision.sceneName,
    "chart_sql_revision",
    REPORTING_AI_DEFAULTS.chart_sql_revision.systemPrompt,
    REPORTING_AI_DEFAULTS.chart_sql_revision.description,
    REPORTING_AI_DEFAULTS.chart_sql_revision
  );

  await ensureReportingAiScene(
    REPORTING_AI_DEFAULTS.chart_recommendation.sceneName,
    "chart_recommendation",
    REPORTING_AI_DEFAULTS.chart_recommendation.systemPrompt,
    REPORTING_AI_DEFAULTS.chart_recommendation.description,
    REPORTING_AI_DEFAULTS.chart_recommendation
  );
  await ensureReportingAiScene(
    REPORTING_AI_DEFAULTS.chart_field_mapping.sceneName,
    "chart_field_mapping",
    REPORTING_AI_DEFAULTS.chart_field_mapping.systemPrompt,
    REPORTING_AI_DEFAULTS.chart_field_mapping.description,
    REPORTING_AI_DEFAULTS.chart_field_mapping
  );
}

async function seedPlatformAssets() {
  const [sourceRows] = await pool.query("SELECT id, project_id AS projectId FROM ingestion_data_sources ORDER BY id ASC LIMIT 1");
  const sourceId = sourceRows[0]?.id;

  if (!sourceId) {
    return;
  }
  const projectId = Number(sourceRows[0]?.projectId) || await getDefaultProjectId();

  const [ingestionRows] = await pool.query("SELECT COUNT(*) AS total FROM ingestion_jobs");
  if (ingestionRows[0].total === 0) {
    await pool.query(
      `INSERT INTO ingestion_jobs
      (project_id, job_name, job_code, source_id, schedule_type, cron_expression, sync_mode, target_table, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        projectId, "Outpatient Daily Sync", "ingest_outpatient_daily", sourceId, "cron", "0 0 2 * * *", "incremental", "ods_outpatient", "running",
        projectId, "Inpatient Full Sync", "ingest_inpatient_full", sourceId, "manual", null, "full", "ods_inpatient", "draft"
      ]
    );
  }

  const [processingRows] = await pool.query("SELECT COUNT(*) AS total FROM processing_jobs");
  if (processingRows[0].total === 0) {
    await pool.query(
      `INSERT INTO processing_jobs
      (job_name, job_code, input_source, output_target, process_type, process_config, schedule_type, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        "患者主数据清洗", "process_patient_master", "ods_outpatient", "dwd_patient_master", "etl", JSON.stringify({ rules: ["dedup", "normalize"] }), "cron", "running",
        "收费主题宽表构建", "process_charge_wide", "ods_charge", "ads_charge_wide", "aggregation", JSON.stringify({ metrics: ["amount", "times"] }), "manual", "draft"
      ]
    );
  }

  await seedBuiltinAiConfigs();

  const [serviceRows] = await pool.query("SELECT COUNT(*) AS total FROM service_apis");
  if (serviceRows[0].total === 0) {
    const defaultProjectId = await getDefaultProjectId();
    await pool.query(
      `INSERT INTO service_apis
      (project_id, service_name, service_code, service_path, request_method, data_domain, auth_type, status, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        defaultProjectId, "Patient Profile Query", "svc_patient_profile", "/api/data/patient/profile", "GET", "patient", "token", "online", "Provide unified patient profile lookup",
        defaultProjectId, "门诊指标看板", "svc_outpatient_metrics", "/api/data/metrics/outpatient", "GET", "metrics", "token", "offline", "提供门诊主题指标输出"
      ]
    );
  }
}

function getSystemServiceSeeds() {
  return [
    {
      serviceKey: "backend",
      serviceName: "Backend API",
      serviceCategory: "application",
      serviceType: "backend",
      manageMode: "docker",
      host: "127.0.0.1",
      port: env.port,
      autoStart: 1,
      isCore: 1,
      notes: "默认通过 Docker 容器运行，适用于统一部署链路",
      config: {
        containerName: "medata-backend",
        readyUrl: `http://127.0.0.1:${env.port}/api/health`
      }
    },
    {
      serviceKey: "frontend",
      serviceName: "Frontend Web",
      serviceCategory: "application",
      serviceType: "frontend",
      manageMode: "docker",
      host: "127.0.0.1",
      port: 8080,
      autoStart: 1,
      isCore: 1,
      notes: "默认通过 Docker 容器运行，适用于统一部署链路",
      config: {
        containerName: "medata-frontend",
        readyUrl: "http://127.0.0.1:8080"
      }
    },
    {
      serviceKey: "mysql",
      serviceName: "Project MySQL",
      serviceCategory: "database",
      serviceType: "mysql",
      manageMode: "docker",
      host: env.db.host,
      port: env.db.port,
      autoStart: 1,
      isCore: 1,
      notes: "项目主数据库，默认通过 Docker 容器运行",
      config: {
        containerName: "medata-mysql"
      }
    },
    {
      serviceKey: "hive",
      serviceName: "Embedded Hive",
      serviceCategory: "database",
      serviceType: "hive",
      manageMode: "docker",
      host: "hive",
      port: 10000,
      autoStart: 1,
      isCore: 1,
      notes: "单机内置 HiveServer2，适合项目演示与开发联调；不包含完整 HDFS 集群",
      config: {
        containerName: "medata-hive"
      }
    },
    {
      serviceKey: "kafka",
      serviceName: "Embedded Kafka",
      serviceCategory: "platform",
      serviceType: "kafka",
      manageMode: "docker",
      host: "kafka",
      port: 9092,
      autoStart: 1,
      isCore: 1,
      notes: "单机 KRaft Kafka，适合项目内置消息队列与联调",
      config: {
        containerName: "medata-kafka"
      }
    }
  ];
}

async function seedSystemServiceConfigs() {
  const services = getSystemServiceSeeds();
  const removedServiceKeys = ["oracle", "sqlserver"];

  await pool.query(
    `DELETE FROM system_service_configs
     WHERE service_key IN (${removedServiceKeys.map(() => "?").join(", ")})
       AND is_core = 1`,
    removedServiceKeys
  );

  for (const service of services) {
    const [rows] = await pool.query(
      "SELECT id FROM system_service_configs WHERE service_key = ? LIMIT 1",
      [service.serviceKey]
    );

    if (rows.length > 0) {
      await pool.query(
        `UPDATE system_service_configs
         SET service_name = ?, service_category = ?, service_type = ?, manage_mode = ?,
             host = ?, port = ?, is_core = ?, notes = ?, config_json = ?
         WHERE service_key = ?`,
        [
          service.serviceName,
          service.serviceCategory,
          service.serviceType,
          service.manageMode,
          service.host,
          service.port,
          service.isCore,
          service.notes,
          JSON.stringify(service.config || {}),
          service.serviceKey
        ]
      );
      continue;
    }

    await pool.query(
      `INSERT INTO system_service_configs
        (service_key, service_name, service_category, service_type, manage_mode, host, port, auto_start, status, is_core, notes, config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        service.serviceKey,
        service.serviceName,
        service.serviceCategory,
        service.serviceType,
        service.manageMode,
        service.host,
        service.port,
        service.autoStart,
        "active",
        service.isCore,
        service.notes,
        JSON.stringify(service.config || {})
      ]
    );
  }
}

function getDefaultScenarioEnhancementSeeds() {
  return [];
}

async function seedScenarioEnhancementProfiles() {
  for (const seed of getDefaultScenarioEnhancementSeeds()) {
    const [rows] = await pool.query("SELECT id FROM lab_scenario_profile WHERE profile_code = ? LIMIT 1", [seed.profileCode]);
    let profileId = rows[0]?.id;

    if (profileId) {
      await pool.query(
        `UPDATE lab_scenario_profile
         SET profile_name = ?, industry = ?, sub_scenario = ?, profile_desc = ?, locale = ?, business_style = ?,
             confidence_threshold = ?, priority = ?, status = 'active', is_system = 1
         WHERE id = ?`,
        [seed.profileName, seed.industry, seed.subScenario, seed.profileDesc, seed.locale, seed.businessStyle, seed.confidenceThreshold, seed.priority, profileId]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO lab_scenario_profile
          (profile_name, profile_code, industry, sub_scenario, profile_desc, locale, business_style, confidence_threshold, priority, status, is_system, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
        [seed.profileName, seed.profileCode, seed.industry, seed.subScenario, seed.profileDesc, seed.locale, seed.businessStyle, seed.confidenceThreshold, seed.priority, "System Administrator"]
      );
      profileId = result.insertId;
    }

    await pool.query("DELETE FROM lab_scenario_dictionary WHERE profile_id = ?", [profileId]);
    for (const item of seed.dictionaries) {
      await pool.query(
        `INSERT INTO lab_scenario_dictionary (profile_id, dict_type, item_code, item_label, item_value_json, weight, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [profileId, item.dictType, item.itemCode, item.itemLabel, JSON.stringify(item.itemValue || {}), item.weight, item.sortOrder, item.status]
      );
    }

    await pool.query("DELETE FROM lab_scenario_distribution_rule WHERE profile_id = ?", [profileId]);
    for (const item of seed.distributionRules) {
      await pool.query(
        `INSERT INTO lab_scenario_distribution_rule (profile_id, rule_type, rule_name, rule_code, rule_config_json, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [profileId, item.ruleType, item.ruleName, item.ruleCode, JSON.stringify(item.ruleConfig || {}), item.status]
      );
    }

    await pool.query("DELETE FROM lab_scenario_field_rule WHERE profile_id = ?", [profileId]);
    for (const item of seed.fieldRules) {
      await pool.query(
        `INSERT INTO lab_scenario_field_rule (profile_id, table_name, field_name, generator_type, rule_config_json, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [profileId, item.tableName, item.fieldName, item.generatorType, JSON.stringify(item.ruleConfig || {}), item.status]
      );
    }

    await pool.query("DELETE FROM lab_scenario_plugin_binding WHERE profile_id = ?", [profileId]);
    for (const item of seed.pluginBindings) {
      await pool.query(
        `INSERT INTO lab_scenario_plugin_binding (profile_id, plugin_key, plugin_name, binding_scope, binding_config_json, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [profileId, item.pluginKey, item.pluginName, item.bindingScope, JSON.stringify(item.bindingConfig || {}), item.status]
      );
    }
  }
}

module.exports = {
  seedSystemRoles,
  seedAdminUser,
  seedDemoDataSources,
  seedDemoLabDataSources,
  seedBuiltinAiConfigs,
  seedPlatformAssets,
  seedSystemServiceConfigs,
  seedScenarioEnhancementProfiles
};

