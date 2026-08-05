const { randomUUID } = require("crypto");
const {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");
const AppError = require("../../../common/errors/app-error");
const { pool } = require("../../../config/database");
const dataLabSourceRepository = require("../../data-lab-sources/data-lab-source.repository");
const mysqlAdapter = require("../../data-development/adapters/mysql.adapter");
const postgresAdapter = require("../../data-development/adapters/postgres.adapter");
const incubationService = require("../data-lab.incubation-runtime");
const promptRuntime = require("../data-lab.prompt-runtime");
const promptDefaults = require("../data-lab.prompt-defaults");
const { safeJsonParse } = require("../data-lab.repository");
const modelProviderService = require("../../model-providers/model-provider.service");
const {
  inferDatasourceDialect,
  normalizeDatasourceType,
  resolveDatasourceConnection,
} = require("../../../common/utils/datasource-dialect");
const { getCurrentProjectId } = require("../../../common/utils/project-context");

const templateBuildJobs = new Map();
const TEMPLATE_BUILD_JOB_LOG_LIMIT = 240;
const TEMPLATE_BUILD_JOB_TTL_MS = 30 * 60 * 1000;
const LOGICAL_MODEL_FIELD_BATCH_SIZE = 1;
const LOGICAL_MODEL_FIELD_BATCH_TIMEOUT_MS = 20000;
const LOGICAL_MODEL_RELATION_TIMEOUT_MS = 15000;
const LOGICAL_MODEL_FIELD_MAX_RETRIES = 3;

function getScopedWhere(alias = "") {
  const projectId = getCurrentProjectId();
  if (!projectId) return { sql: "", params: [], projectId: null };
  const prefix = alias ? `${alias}.` : "";
  return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
}

function normalizeCode(value, fallback = "template") {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return normalized || fallback;
}

function text(value, maxLength = 255) {
  return String(value || "").trim().slice(0, maxLength);
}

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

async function ensureUniqueTemplateCode(preferredCode, options = {}) {
  const excludeTemplateId = options?.excludeTemplateId ? Number(options.excludeTemplateId) : null;
  const baseCode = normalizeCode(preferredCode, "scenario_template");
  const sql = [
    "SELECT template_code AS templateCode",
    "FROM lab_business_system_template",
    "WHERE (template_code = ? OR template_code LIKE ?)",
    excludeTemplateId ? "AND id <> ?" : "",
  ].filter(Boolean).join(" ");
  const params = [baseCode, `${baseCode}_%`];
  if (excludeTemplateId) {
    params.push(excludeTemplateId);
  }
  const [rows] = await pool.query(sql, params);
  const existing = new Set(rows.map((item) => String(item.templateCode || "")));
  if (!existing.has(baseCode)) {
    return baseCode;
  }
  let serial = 2;
  while (existing.has(`${baseCode}_${serial}`)) {
    serial += 1;
  }
  return `${baseCode}_${serial}`;
}

async function ensureUniqueInstanceCode(preferredCode, options = {}) {
  const excludeInstanceId = options?.excludeInstanceId ? Number(options.excludeInstanceId) : null;
  const baseCode = normalizeCode(preferredCode, "business_system_instance");
  const sql = [
    "SELECT instance_code AS instanceCode",
    "FROM lab_business_system_instance",
    "WHERE (instance_code = ? OR instance_code LIKE ?)",
    excludeInstanceId ? "AND id <> ?" : "",
  ].filter(Boolean).join(" ");
  const params = [baseCode, `${baseCode}_%`];
  if (excludeInstanceId) {
    params.push(excludeInstanceId);
  }
  const [rows] = await pool.query(sql, params);
  const existing = new Set(rows.map((item) => String(item.instanceCode || "")));
  if (!existing.has(baseCode)) {
    return baseCode;
  }
  let serial = 2;
  while (existing.has(`${baseCode}_${serial}`)) {
    serial += 1;
  }
  return `${baseCode}_${serial}`;
}

async function ensureUniqueIndustryDataSourceCode(preferredCode, options = {}) {
  const excludeDataSourceId = options?.excludeDataSourceId ? Number(options.excludeDataSourceId) : null;
  const baseCode = normalizeCode(preferredCode, "industry_data_source");
  const sql = [
    "SELECT data_source_code AS dataSourceCode",
    "FROM lab_industry_data_source",
    "WHERE (data_source_code = ? OR data_source_code LIKE ?)",
    excludeDataSourceId ? "AND id <> ?" : "",
  ].filter(Boolean).join(" ");
  const params = [baseCode, `${baseCode}_%`];
  if (excludeDataSourceId) {
    params.push(excludeDataSourceId);
  }
  const [rows] = await pool.query(sql, params);
  const existing = new Set(rows.map((item) => String(item.dataSourceCode || "")));
  if (!existing.has(baseCode)) {
    return baseCode;
  }
  let serial = 2;
  while (existing.has(`${baseCode}_${serial}`)) {
    serial += 1;
  }
  return `${baseCode}_${serial}`;
}

function hashText(value) {
  let hash = 0;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function buildFieldType(fieldName) {
  const name = String(fieldName || "").toLowerCase();
  if (!name) return "STRING";
  if (name.endsWith("_id") || name.endsWith("_count") || name.endsWith("_num") || name.includes("amount") || name.includes("score") || name.includes("weight") || name.includes("distance")) {
    return "NUMBER";
  }
  if (name.endsWith("_date")) return "DATE";
  if (name.endsWith("_time") || name.endsWith("_at")) return "DATETIME";
  if (name.includes("flag") || name.startsWith("is_") || name.startsWith("has_")) return "BOOLEAN";
  return "STRING";
}

const LOGICAL_MODEL_BUILD_ALLOWED_FIELD_TYPES = new Set(["STRING", "NUMBER", "DATE", "DATETIME", "BOOLEAN", "JSON"]);
const LOGICAL_MODEL_BUILD_ALLOWED_RELATION_TYPES = new Set(["1:1", "1:N", "N:1", "N:N"]);

function isTechnicalFieldName(value) {
  return /^[a-z][a-z0-9_]{0,127}$/.test(String(value || "").trim());
}

function normalizeLogicalFieldType(value, fieldName) {
  const raw = String(value || "").trim().toUpperCase();
  if (LOGICAL_MODEL_BUILD_ALLOWED_FIELD_TYPES.has(raw)) {
    return raw;
  }
  if (["TEXT", "VARCHAR", "CHAR", "STRING_TEXT"].includes(raw)) return "STRING";
  if (["NUMBER", "INTEGER", "INT", "LONG", "BIGINT", "DECIMAL", "FLOAT", "DOUBLE"].includes(raw)) return "NUMBER";
  if (["DATEONLY"].includes(raw)) return "DATE";
  if (["DATETIME", "TIMESTAMP", "TIME"].includes(raw)) return "DATETIME";
  if (["BOOLEAN", "BOOL"].includes(raw)) return "BOOLEAN";
  if (["JSON", "OBJECT", "ARRAY"].includes(raw)) return "JSON";
  return buildFieldType(fieldName);
}

function normalizeRelationType(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (LOGICAL_MODEL_BUILD_ALLOWED_RELATION_TYPES.has(raw)) {
    return raw;
  }
  if (raw === "ONE_TO_ONE") return "1:1";
  if (raw === "ONE_TO_MANY") return "1:N";
  if (raw === "MANY_TO_ONE") return "N:1";
  if (raw === "MANY_TO_MANY") return "N:N";
  return "N:1";
}

function tryParseModelJson(textValue) {
  const raw = String(textValue || "").trim();
  if (!raw) return null;
  const candidates = [raw];
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  candidates.push(...[fencedMatch?.[1], objectMatch?.[0]].filter(Boolean));

  for (const candidate of candidates) {
    let current = String(candidate || "").trim();
    for (let depth = 0; depth < 4 && current; depth += 1) {
      try {
        const parsed = JSON.parse(current);
        if (typeof parsed === "string") {
          current = String(parsed).trim();
          continue;
        }
        return parsed;
      } catch (_nestedError) {
        break;
      }
    }
  }
  return null;
}

function isGenericTechnicalFieldName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const exactGenericNames = new Set([
    "temp",
    "misc",
    "info",
    "data",
    "field",
    "value",
    "basic_value",
    "base_info",
    "common_data",
  ]);

  if (exactGenericNames.has(normalized)) {
    return true;
  }

  return /^(field|col|data|info|value|temp|misc)_?\d+$/.test(normalized)
    || /(^|_)(basic_value|base_info|common_data)(_|$)/.test(normalized)
    || /_(field|data|info|value|temp|misc)_\d+$/.test(normalized);
}

function isValidModelTechnicalFieldName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return isTechnicalFieldName(normalized) && !isGenericTechnicalFieldName(normalized);
}

function validateModelFieldBatchOutput(tableName, sourceFieldLabels, parsed) {
  const rawTables = Array.isArray(parsed?.tables) ? parsed.tables : [];
  const normalizedTableName = String(tableName || "").trim();
  const modelTable = rawTables.find((table) =>
    String(table?.sourceTableName || table?.tableName || "").trim() === normalizedTableName
  ) || null;
  if (!modelTable) {
    throw new Error(`logical_model_field_batch_missing_table:${normalizedTableName}`);
  }
  const rawFields = Array.isArray(modelTable.fields) ? modelTable.fields : [];
  if (rawFields.length !== sourceFieldLabels.length) {
    throw new Error(`logical_model_field_batch_field_count_mismatch:${normalizedTableName}`);
  }

  const sourceLabelSet = new Set(sourceFieldLabels.map((item) => text(item, 512)).filter(Boolean));
  const matchedLabelSet = new Set();
  const technicalNames = new Set();

  rawFields.forEach((field) => {
    const sourceLabel = text(field?.sourceFieldLabel, 512);
    const technicalFieldName = text(field?.fieldName, 128);
    if (!sourceLabelSet.has(sourceLabel)) {
      throw new Error(`logical_model_field_batch_unknown_source_label:${normalizedTableName}:${sourceLabel || "empty"}`);
    }
    if (matchedLabelSet.has(sourceLabel)) {
      throw new Error(`logical_model_field_batch_duplicate_source_label:${normalizedTableName}:${sourceLabel}`);
    }
    matchedLabelSet.add(sourceLabel);

    if (!isValidModelTechnicalFieldName(technicalFieldName)) {
      throw new Error(`logical_model_field_batch_invalid_field_name:${normalizedTableName}:${sourceLabel}:${technicalFieldName || "empty"}`);
    }
    if (technicalNames.has(technicalFieldName)) {
      throw new Error(`logical_model_field_batch_duplicate_field_name:${normalizedTableName}:${technicalFieldName}`);
    }
    technicalNames.add(technicalFieldName);
  });

  sourceLabelSet.forEach((sourceLabel) => {
    if (!matchedLabelSet.has(sourceLabel)) {
      throw new Error(`logical_model_field_batch_missing_source_label:${normalizedTableName}:${sourceLabel}`);
    }
  });

  return modelTable;
}

function inferBusinessRole(tableName) {
  const normalized = String(tableName || "").toLowerCase();
  if (normalized.includes("dict") || normalized.includes("standard")) return "DICTIONARY";
  if (normalized.includes("log")) return "LOG";
  if (normalized.includes("snapshot")) return "SNAPSHOT";
  if (normalized.includes("mapping") || normalized.includes("relation") || normalized.includes("bridge")) return "BRIDGE";
  if (normalized.includes("record") || normalized.includes("event") || normalized.includes("bill") || normalized.includes("order") || normalized.includes("waybill")) return "TRANSACTION";
  return "MASTER";
}

function uniqueBy(items, selector) {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeStringArray(values, maxLength = 255) {
  if (!Array.isArray(values)) return [];
  return uniqueBy(
    values
      .map((item) => text(item, maxLength))
      .filter(Boolean)
      .map((value) => ({ value })),
    (item) => item.value
  ).map((item) => item.value);
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function cleanupTemplateBuildJobs() {
  const now = Date.now();
  for (const [jobId, job] of templateBuildJobs.entries()) {
    const finishedAt = job?.finishedAt ? new Date(job.finishedAt).getTime() : 0;
    if (finishedAt && now - finishedAt > TEMPLATE_BUILD_JOB_TTL_MS) {
      templateBuildJobs.delete(jobId);
    }
  }
}

function pushTemplateBuildJobLog(job, payload = {}) {
  if (!job) {
    return null;
  }
  const entry = {
    seq: (Array.isArray(job.logs) ? job.logs.length : 0) + 1,
    level: payload.level || "info",
    stepKey: text(payload.stepKey || "progress", 64) || "progress",
    message: text(payload.message || "", 1000),
    detail: payload.detail && typeof payload.detail === "object" && !Array.isArray(payload.detail)
      ? payload.detail
      : null,
    createdAt: new Date().toISOString(),
  };
  job.logs = Array.isArray(job.logs) ? [...job.logs, entry].slice(-TEMPLATE_BUILD_JOB_LOG_LIMIT) : [entry];
  job.updatedAt = entry.createdAt;
  return entry;
}

function summarizeTemplateBuildJob(job) {
  if (!job) {
    return null;
  }
  return {
    id: job.id,
    status: job.status,
    templateName: job.templateName,
    templateCode: job.templateCode,
    progressPercent: Number(job.progressPercent || 0),
    currentStage: job.currentStage || "queued",
    sourceCategoryCodes: Array.isArray(job.sourceCategoryCodes) ? job.sourceCategoryCodes : [],
    result: job.result || null,
    errorMessage: job.errorMessage || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt || null,
    logs: Array.isArray(job.logs) ? job.logs.map((item) => ({ ...item })) : [],
  };
}

function getTemplateBuildJobOrThrow(jobId) {
  cleanupTemplateBuildJobs();
  const job = templateBuildJobs.get(String(jobId || "").trim());
  if (!job) {
    throw new AppError("场景管理模板构建任务不存在或已过期", 404);
  }
  return job;
}

const PREVIEW_PERSON_NAMES = [
  "\u5f20\u4f1f",
  "\u738b\u82b3",
  "\u674e\u5a1c",
  "\u5218\u6d0b",
  "\u9648\u6668",
  "\u5468\u654f",
  "\u9ec4\u78ca",
  "\u8d75\u96ea",
];

const PREVIEW_COMPANY_NAMES = [
  "\u661f\u6d77\u79d1\u6280",
  "\u51cc\u4e91\u6570\u636e",
  "\u8fdc\u822a\u5546\u8d38",
  "\u667a\u57df\u670d\u52a1",
  "\u534e\u57ce\u8fd0\u8425",
];

const PREVIEW_PRODUCT_NAMES = [
  "\u667a\u80fd\u5957\u9910",
  "\u6807\u51c6\u670d\u52a1\u5305",
  "\u589e\u503c\u4ea4\u4ed8\u5305",
  "\u57fa\u7840\u4ea7\u54c1\u7ec4\u5408",
  "\u6e20\u9053\u4f18\u60e0\u5305",
];

const PREVIEW_STREET_NAMES = [
  "\u4eba\u6c11\u8def",
  "\u5efa\u8bbe\u8def",
  "\u4e2d\u5c71\u8def",
  "\u79d1\u6280\u8def",
  "\u9752\u5e74\u8def",
];

const PREVIEW_LOCATIONS = [
  {
    provinceName: "\u4e0a\u6d77\u5e02",
    provinceCode: "310000",
    cityName: "\u4e0a\u6d77\u5e02",
    cityCode: "310100",
    districtName: "\u6d66\u4e1c\u65b0\u533a",
    districtCode: "310115",
  },
  {
    provinceName: "\u6d59\u6c5f\u7701",
    provinceCode: "330000",
    cityName: "\u676d\u5dde\u5e02",
    cityCode: "330100",
    districtName: "\u4f59\u676d\u533a",
    districtCode: "330110",
  },
  {
    provinceName: "\u6c5f\u82cf\u7701",
    provinceCode: "320000",
    cityName: "\u5357\u4eac\u5e02",
    cityCode: "320100",
    districtName: "\u5efa\u90ba\u533a",
    districtCode: "320105",
  },
  {
    provinceName: "\u5e7f\u4e1c\u7701",
    provinceCode: "440000",
    cityName: "\u6df1\u5733\u5e02",
    cityCode: "440300",
    districtName: "\u5357\u5c71\u533a",
    districtCode: "440305",
  },
];

const FALLBACK_STATUS_CODES = ["NEW", "ACTIVE", "PENDING", "COMPLETED", "CLOSED"];
const CHINESE_FAMILY_NAMES = ["赵", "钱", "孙", "李", "周", "吴", "郑", "王", "冯", "陈", "褚", "卫", "蒋", "沈", "韩", "杨", "朱", "秦", "尤", "许", "何", "吕", "施", "张", "孔", "曹", "严", "华", "金", "魏", "陶", "姜", "戚", "谢", "邹", "喻", "柏", "水", "窦", "章", "云", "苏", "潘", "葛", "奚", "范", "彭", "郎"];
const CHINESE_GIVEN_NAME_PARTS = ["伟", "敏", "静", "磊", "洋", "艳", "勇", "军", "杰", "娟", "涛", "明", "超", "秀", "霞", "平", "刚", "桂", "玲", "雪", "晨", "航", "婷", "楠", "悦", "欣", "宇", "浩", "颖", "璐", "鑫", "昊", "潇", "瑶", "宁", "蕾", "辰", "菲", "博", "安", "瑞", "萌", "晨", "怡", "梓", "彤", "嘉", "可"];
const CHINESE_OCCUPATIONS = ["电商运营", "平台商家", "采购专员", "物流调度", "门店店长", "招商主管", "风控专员", "售后客服", "财务结算", "招商主管", "品牌经理", "渠道经理"];
const CHINESE_DEVICE_TYPES = ["Android", "iPhone", "HarmonyOS", "Web", "小程序"];
const CHINESE_CHANNEL_CODES = ["APP", "MINI_PROGRAM", "H5", "OFFLINE_STORE", "LIVE_ROOM"];
const CHINESE_PAYMENT_METHODS = ["ALIPAY", "WECHAT_PAY", "BANK_CARD", "ENTERPRISE_TRANSFER"];
const CHINESE_LOGISTICS_METHODS = ["同城急送", "快递配送", "门店自提", "专线运输"];
const CHINESE_ORDER_STATUS_CODES = ["CREATED", "PAID", "SHIPPED", "FINISHED", "REFUNDED", "CLOSED"];
const CHINESE_PAYMENT_STATUS_CODES = ["UNPAID", "PAYING", "PAID", "PART_REFUND", "REFUNDED"];
const CHINESE_DELIVERY_STATUS_CODES = ["PENDING", "ALLOCATED", "IN_TRANSIT", "SIGNED", "RETURNED"];
const CHINESE_CASE_STATUS_CODES = ["NEW", "ACCEPTED", "PROCESSING", "DONE", "CLOSED"];
const CHINESE_COMPLAINT_REASONS = ["商品与描述不符", "物流延误", "发票信息错误", "售后响应慢", "支付异常", "系统下单失败"];
const CHINESE_EVENT_ACTIONS = ["提交订单", "完成支付", "发起退款", "签收包裹", "提交工单", "门店核销", "风险复核"];
const CHINESE_COMPANY_SUFFIXES = ["科技有限公司", "网络科技有限公司", "供应链有限公司", "商贸有限公司", "信息服务有限公司", "数字运营有限公司"];
const CHINESE_BRAND_NAMES = ["青禾", "云岚", "澜序", "星川", "沐辰", "远澄", "嘉禾", "启辰", "禾木", "观澜"];
const CHINESE_PRODUCT_SERIES = [
  { category: "乳品冷链", productNames: ["鲜牛乳礼盒", "低温酸奶组合", "儿童成长奶", "轻食酸奶杯"] },
  { category: "生鲜配送", productNames: ["精品蔬菜包", "家庭肉类拼箱", "活鲜水产礼盒", "冷鲜鸡胸套餐"] },
  { category: "餐饮零售", productNames: ["门店饮品套券", "到店轻食套餐", "会员早餐卡", "咖啡豆礼袋"] },
  { category: "本地生活", productNames: ["洗车服务包", "家政深度保洁", "上门维修套餐", "亲子乐园通票"] },
  { category: "数码家电", productNames: ["智能路由器", "降噪蓝牙耳机", "扫拖一体机", "空气净化器"] },
];
const EMERGENCY_EVENT_SCENARIOS = [
  {
    eventTopic: "化工仓库异味投诉应急处置",
    eventType: "危化品异味投诉",
    planTopic: "危险化学品泄漏",
    resourceName: "便携式气体检测仪",
    resourceTypeLabel: "应急监测设备",
    resourceSpecification: "PID/0-2000ppm",
    disposalMeasures: "现场封控涉事仓库南侧装卸区，启用移动监测设备连续监测 VOC 浓度，并督促企业完成残液收集与吸附棉更换。",
    dispatchInfo: "调度执法车辆2辆、监测人员4人、吸附棉20包、移动风机2台，联动属地街道和园区物业同步处置。",
  },
  {
    eventTopic: "河道水体异常颜色排查",
    eventType: "水污染异常",
    planTopic: "河道突发水污染",
    resourceName: "便携式多参数水质分析仪",
    resourceTypeLabel: "应急监测设备",
    resourceSpecification: "pH/电导率/COD/氨氮一体机",
    disposalMeasures: "沿上游排口逐段排查可疑来水，布设围油栏并完成应急采样，通知污水处理站提升预处理强度。",
    dispatchInfo: "调度巡查船1艘、采样人员3人、围油栏80米、吸附棉15包，对上游3个排口开展应急排查。",
  },
  {
    eventTopic: "工业园区危废暂存间渗漏处置",
    eventType: "危废渗漏",
    planTopic: "危险废物泄漏",
    resourceName: "危废收集防渗托盘",
    resourceTypeLabel: "应急处置物资",
    resourceSpecification: "HDPE/1200mm*1000mm",
    disposalMeasures: "立即暂停危废转运作业，对渗漏点位铺设防渗膜并转移危废桶，安排第三方单位开展残液回收和场地冲洗。",
    dispatchInfo: "调度危废转运车1辆、防渗托盘12个、洗消人员6人和应急抽吸泵2台，2小时内完成场地稳控。",
  },
  {
    eventTopic: "污水处理站超标排放响应",
    eventType: "超标排放",
    planTopic: "污水站异常排放",
    resourceName: "移动式应急抽排泵",
    resourceTypeLabel: "应急工程机械",
    resourceSpecification: "80m3/h 柴油泵组",
    disposalMeasures: "切换事故应急池截流异常来水，安排运维人员复核加药系统并对在线监测设备进行校准复测。",
    dispatchInfo: "调度运维工程师3人、抽排泵1套、事故池值守人员2人，并同步上报区生态环境应急专班。",
  },
  {
    eventTopic: "建筑工地扬尘联动处置",
    eventType: "扬尘污染",
    planTopic: "扬尘污染天气应对",
    resourceName: "雾炮抑尘设备",
    resourceTypeLabel: "应急工程机械",
    resourceSpecification: "30米射程移动雾炮",
    disposalMeasures: "暂停土方作业，对裸土区域加密喷淋和苫盖，增加出入口冲洗频次并开展夜间复查。",
    dispatchInfo: "调度执法车辆1辆、雾炮车2辆、喷淋人员5人和防尘网300平方米，完成重点区域全覆盖抑尘。",
  },
];
const EMERGENCY_PLAN_TYPE_LABELS = ["总体应急预案", "专项应急预案", "部门应急预案", "企事业单位应急预案"];
const EMERGENCY_RESPONSE_LEVEL_LABELS = ["Ⅰ级（特别重大）", "Ⅱ级（重大）", "Ⅲ级（较大）", "Ⅳ级（一般）"];
const EMERGENCY_PLAN_APPROVAL_STATUS = ["已备案", "评审通过", "修订中", "生效中"];
const EMERGENCY_RESPONSE_STATUS = ["现场处置中", "持续监测中", "应急终止", "已形成复盘报告"];
const EMERGENCY_RESOURCE_MAINTENANCE_STATUS = ["保养正常", "月度点检完成", "待保养", "检修中"];
const EMERGENCY_RESOURCE_AVAILABILITY_STATUS = ["可立即调用", "预留待命", "调用中", "暂停使用"];
const EMERGENCY_RISK_LEVELS = ["一般风险", "较大风险", "重大风险", "重点监管"];
const EMERGENCY_ENTERPRISE_PREFIXES = ["绿源", "安澜", "清源", "华净", "泽润", "恒泰", "蓝峰", "瑞澄"];
const EMERGENCY_ENTERPRISE_SUFFIXES = ["化工有限公司", "环保科技有限公司", "新材料有限公司", "污水处理有限公司", "工业涂装有限公司", "资源循环有限公司"];
const EMERGENCY_PARK_SUFFIXES = ["经济技术开发区", "工业园区", "化工产业园", "临港工业区", "循环经济产业园"];
const EMERGENCY_SITE_SUFFIXES = ["装卸区", "危废暂存间", "污水处理站", "原料罐区", "码头排口", "施工工地"];
const EMERGENCY_STORAGE_ZONES = ["应急物资库A区", "监测装备库", "联防联控仓库", "危废处置备勤间", "园区应急保障库"];
const CHINESE_TOKEN_LABELS = {
  id: "主键ID",
  code: "编码",
  no: "编号",
  name: "名称",
  title: "标题",
  desc: "描述",
  remark: "备注",
  summary: "摘要",
  status: "状态",
  type: "类型",
  level: "等级",
  category: "类目",
  amount: "金额",
  price: "价格",
  fee: "费用",
  cost: "成本",
  qty: "数量",
  quantity: "数量",
  count: "数量",
  rate: "比率",
  ratio: "比例",
  score: "评分",
  phone: "手机号",
  mobile: "手机号",
  tel: "联系电话",
  email: "邮箱",
  address: "地址",
  province: "省份",
  city: "城市",
  district: "区县",
  county: "区县",
  region: "区域",
  user: "用户",
  member: "会员",
  customer: "客户",
  consumer: "消费者",
  merchant: "商户",
  seller: "商家",
  company: "企业",
  shop: "门店",
  store: "门店",
  supplier: "供应商",
  product: "商品",
  goods: "商品",
  sku: "SKU",
  item: "条目",
  order: "订单",
  trade: "交易",
  payment: "支付",
  refund: "退款",
  settlement: "结算",
  logistics: "物流",
  shipping: "配送",
  delivery: "履约",
  complaint: "投诉",
  service: "服务",
  ticket: "工单",
  task: "任务",
  event: "事件",
  record: "记录",
  log: "日志",
  env: "环境",
  eco: "生态",
  emergency: "应急",
  plan: "预案",
  response: "响应",
  resource: "资源",
  location: "地点",
  occurrence: "发生",
  preparation: "编制",
  approval: "审批",
  effective: "生效",
  version: "版本",
  content: "内容",
  attachment: "附件",
  url: "链接",
  disposal: "处置",
  measures: "措施",
  dispatch: "调度",
  info: "信息",
  report: "上报",
  responsible: "责任",
  specification: "规格",
  storage: "存放",
  maintenance: "维护",
  availability: "可用",
  inspection: "巡检",
  unit: "单位",
  risk: "风险",
  start: "开始",
  end: "结束",
  last: "最近",
  date: "日期",
  time: "时间",
  created: "创建",
  updated: "更新",
  finished: "完成",
  paid: "支付",
  shipped: "发货",
  login: "登录",
  register: "注册",
  channel: "渠道",
  source: "来源",
  device: "设备",
  operator: "操作人",
  owner: "负责人",
  contact: "联系人",
  real: "真实",
  biz: "业务",
  bizno: "业务单号",
  idcard: "身份证号",
  card: "证件号",
};

function clampInteger(value, defaultValue, min, max) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return defaultValue;
  }
  return Math.min(max, Math.max(min, Math.round(normalized)));
}

function normalizeGenerationPlanOptions(payload = {}) {
  const now = new Date();
  const defaultStartAt = new Date(now.getTime() - (29 * 24 * 60 * 60 * 1000)).toISOString();
  const candidateStartAt = text(payload?.timelineStartAt, 64) || defaultStartAt;
  const startAt = Number.isNaN(new Date(candidateStartAt).getTime())
    ? defaultStartAt
    : new Date(candidateStartAt).toISOString();
  const fallbackInitialDataVolume = clampInteger(
    Number(payload?.sharedMasterSize || 0) + Number(payload?.businessMasterSize || 0) + Number(payload?.transactionScale || 0),
    1000,
    100,
    200000
  );
  return {
    initialDataVolume: clampInteger(payload?.initialDataVolume, fallbackInitialDataVolume, 100, 200000),
    incrementalDataVolume: clampInteger(payload?.incrementalDataVolume, 100, 0, 100000),
    incrementCycleDays: clampInteger(payload?.incrementCycleDays, 1, 1, 365),
    sampleRowsPerTable: clampInteger(payload?.sampleRowsPerTable, 8, 1, 20),
    timelineStartAt: startAt,
    timelineDays: clampInteger(payload?.timelineDays, 30, 1, 3650),
  };
}

function containsChineseText(value) {
  return /[\u4e00-\u9fa5]/.test(String(value || ""));
}

function normalizeTokenList(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_")
    .filter(Boolean);
}

function buildSeed(...parts) {
  return parts.filter((item) => item !== undefined && item !== null && item !== "").join(":");
}

function seededInteger(seed, salt, min, max) {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  if (low === high) return low;
  const hashValue = parseInt(hashText(`${seed}:${salt}`), 16);
  return low + (Math.abs(hashValue) % (high - low + 1));
}

function seededPick(items, seed, salt) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const index = seededInteger(seed, salt, 0, items.length - 1);
  return items[index];
}

function formatCompactDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "20260101";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function translateIdentifierToChinese(identifier, fallbackLabel = "") {
  const tokens = normalizeTokenList(identifier);
  if (tokens.length === 0) {
    return fallbackLabel || String(identifier || "");
  }
  const labels = tokens.map((token) => CHINESE_TOKEN_LABELS[token] || token.toUpperCase());
  const uniqueLabels = [];
  for (const label of labels) {
    if (!label) continue;
    if (uniqueLabels[uniqueLabels.length - 1] !== label) {
      uniqueLabels.push(label);
    }
  }
  return uniqueLabels.join("");
}

function resolveChineseTableComment(table) {
  const preferred = [table?.tableComment, table?.tableLabel, table?.tableName].find((item) => text(item, 512));
  if (containsChineseText(preferred)) {
    return text(preferred, 512);
  }
  const translated = translateIdentifierToChinese(table?.tableName || table?.tableLabel || preferred, "业务表");
  return text(translated || "业务表", 512);
}

function resolveChineseFieldComment(field, table) {
  const preferred = [field?.fieldComment, field?.businessSemantic, field?.fieldName].find((item) => text(item, 512));
  if (containsChineseText(preferred)) {
    return text(preferred, 512);
  }
  const fieldLabel = translateIdentifierToChinese(field?.fieldName || "", "字段");
  const tableLabel = containsChineseText(table?.tableLabel) ? table.tableLabel : translateIdentifierToChinese(table?.tableName || "", "");
  if (tableLabel && fieldLabel && !fieldLabel.startsWith(tableLabel)) {
    return text(`${tableLabel}${fieldLabel}`, 512);
  }
  return text(fieldLabel || "字段", 512);
}

function normalizePlatformSourceType(sourceType, connectionConfig = {}) {
  const normalized = normalizeDatasourceType(sourceType || "mysql");
  const dialect = inferDatasourceDialect(normalized, connectionConfig || {});
  return dialect === "unknown" ? normalized || "mysql" : dialect;
}

function toAdapterConnectionConfig(dataSource) {
  const connectionConfig = dataSource?.connectionConfig && typeof dataSource.connectionConfig === "object"
    ? dataSource.connectionConfig
    : {};
  const resolved = resolveDatasourceConnection(dataSource?.sourceType, connectionConfig);
  const storageType = normalizeDatasourceType(dataSource?.storageType || dataSource?.sourceType);
  const dialect = normalizePlatformSourceType(dataSource?.sourceType, connectionConfig);
  return {
    storageType,
    sourceType: storageType,
    dialect,
    type: storageType,
    host: resolved.host || connectionConfig.host,
    port: Number(resolved.port || connectionConfig.port || 0) || 0,
    username: resolved.username || connectionConfig.username,
    password: resolved.password || connectionConfig.password,
    databaseName: resolved.database || connectionConfig.database || connectionConfig.databaseName || undefined,
    schema: resolved.schema || connectionConfig.schema || "public",
    jdbcUrl: resolved.jdbcUrl || connectionConfig.jdbcUrl || connectionConfig.url || "",
    driverClassName: resolved.driverClassName || connectionConfig.driverClassName || null,
  };
}

function buildDeployTargetSnapshot(dataSource) {
  const storageType = normalizeDatasourceType(dataSource?.storageType || dataSource?.sourceType);
  const normalizedType = normalizePlatformSourceType(dataSource?.sourceType, dataSource?.connectionConfig || {});
  const adapterConfig = toAdapterConnectionConfig(dataSource);
  return {
    targetDataSourceId: Number(dataSource.id),
    targetDataSourceName: dataSource.sourceName,
    targetDataSourceCode: dataSource.sourceCode,
    targetDataSourceType: storageType,
    targetDialect: normalizedType,
    host: adapterConfig.host,
    port: adapterConfig.port,
    databaseName: adapterConfig.databaseName || null,
    schema: adapterConfig.schema || null,
  };
}

async function getTargetDataSourceForScenario(dataSourceId) {
  const dataSource = await dataLabSourceRepository.getDataSourceById(Number(dataSourceId));
  if (!dataSource) {
    throw new AppError("目标数据源不存在", 404);
  }
  if (String(dataSource.status || "").toLowerCase() !== "active") {
    throw new AppError("目标数据源未启用，无法用于场景管理落库", 400);
  }
  const normalizedType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  if (!["mysql", "postgresql"].includes(normalizedType)) {
    throw new AppError("场景管理当前仅支持 MySQL / PostgreSQL 数据源落库", 400);
  }
  const adapterConfig = toAdapterConnectionConfig(dataSource);
  if (!adapterConfig.host || !adapterConfig.port || !adapterConfig.username || !adapterConfig.databaseName) {
    throw new AppError("目标数据源连接信息不完整，请补充主机、端口、用户名和数据库名", 400);
  }
  return {
    ...dataSource,
    storageType: normalizeDatasourceType(dataSource.sourceType),
    sourceType: normalizedType,
    connectionConfig: adapterConfig,
  };
}

function getDatabaseAdapter(sourceType, connectionConfig = {}) {
  const normalizedType = normalizePlatformSourceType(sourceType, connectionConfig);
  if (normalizedType === "mysql") return mysqlAdapter;
  if (normalizedType === "postgresql") return postgresAdapter;
  throw new AppError(`不支持的数据源类型: ${sourceType}`, 400);
}

function isNumericColumnType(columnType) {
  return /int|decimal|numeric|number|float|double/i.test(String(columnType || ""));
}

function isDateColumnType(columnType) {
  const normalized = String(columnType || "").toLowerCase();
  return normalized === "date";
}

function isDateTimeColumnType(columnType) {
  return /datetime|timestamp/i.test(String(columnType || ""));
}

function isBooleanColumnType(columnType) {
  return /boolean|tinyint\(1\)/i.test(String(columnType || ""));
}

function isJsonColumnType(columnType) {
  return /json/i.test(String(columnType || ""));
}

function formatPreviewDate(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return String(date || "");
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPreviewDateTime(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return String(date || "");
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function addDays(baseDate, days) {
  return new Date(new Date(baseDate).getTime() + (days * 24 * 60 * 60 * 1000));
}

function addHours(baseDate, hours) {
  return new Date(new Date(baseDate).getTime() + (hours * 60 * 60 * 1000));
}

function pickPreviewLocation(index) {
  return PREVIEW_LOCATIONS[index % PREVIEW_LOCATIONS.length];
}

function buildPreviewNumericId(tableName, rowIndex) {
  const seed = parseInt(hashText(tableName).slice(0, 6), 16) % 900000;
  return seed + 100000 + rowIndex + 1;
}

function buildPreviewCode(baseName, rowIndex) {
  const prefix = normalizeCode(baseName, "item").slice(0, 12).toUpperCase() || "ITEM";
  return `${prefix}_${String(rowIndex + 1).padStart(4, "0")}`;
}

function buildPreviewPhone(rowIndex) {
  return `138${String(10000000 + rowIndex).slice(-8)}`;
}

function buildPreviewEmail(baseName, rowIndex) {
  const token = normalizeCode(baseName, "user");
  return `${token}_${rowIndex + 1}@example.com`;
}

function buildPreviewIdCard(rowIndex) {
  return `31010119900101${String(1000 + rowIndex).slice(-4)}`;
}

function inferEntityTier(table) {
  const normalized = `${table?.logicalTableName || ""}_${table?.logicalLabel || ""}`.toLowerCase();
  if (/(user|customer|member|patient|student|employee|driver|vehicle|product|merchant|supplier|company|organization|org|account)/.test(normalized)) {
    return "shared_master";
  }
  if (String(table?.businessRole || "").toUpperCase() === "MASTER") {
    return "business_master";
  }
  return "event";
}

const INDUSTRY_DATA_SOURCE_THEME_META = {
  user: {
    code: "user",
    label: "\u7528\u6237\u8eab\u4efd",
    keywords: ["user", "consumer", "customer", "member", "buyer", "person", "account", "\u7528\u6237", "\u6d88\u8d39\u8005", "\u5ba2\u6237", "\u4f1a\u5458", "\u4e70\u5bb6", "\u4eba\u5458"],
  },
  merchant: {
    code: "merchant",
    label: "\u7ecf\u8425\u4e3b\u4f53",
    keywords: ["merchant", "seller", "shop", "store", "platform", "operator", "enterprise", "company", "supplier", "\u5546\u5bb6", "\u7ecf\u8425\u8005", "\u5e73\u53f0", "\u4f01\u4e1a", "\u4f9b\u5e94\u5546"],
  },
  activity: {
    code: "activity",
    label: "\u6d3b\u52a8\u4e8b\u4ef6",
    keywords: ["order", "payment", "transaction", "complaint", "work_order", "task", "inspection", "report", "record", "activity", "event", "warning", "risk", "enforcement", "log", "\u8ba2\u5355", "\u652f\u4ed8", "\u4ea4\u6613", "\u6295\u8bc9", "\u5de5\u5355", "\u4efb\u52a1", "\u68c0\u67e5", "\u62a5\u9001", "\u8bb0\u5f55", "\u9884\u8b66", "\u98ce\u9669", "\u6d3b\u52a8"],
  },
};

const DEFAULT_INDUSTRY_DATA_SOURCE_THEMES = Object.keys(INDUSTRY_DATA_SOURCE_THEME_META);

function normalizeIndustryDataSourceThemes(values) {
  const normalized = normalizeStringArray(values, 32)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => INDUSTRY_DATA_SOURCE_THEME_META[item]);
  return normalized.length > 0 ? normalized : DEFAULT_INDUSTRY_DATA_SOURCE_THEMES;
}

function normalizeComparableText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5@]/g, "");
}

function isGenericFieldName(fieldName) {
  return /^field_\d+$/i.test(String(fieldName || ""));
}

function isPrimaryKeyLike(fieldName) {
  const normalized = normalizeCode(fieldName, "");
  return normalized === "id" || normalized.endsWith("_id") || normalized.includes("primary_key");
}

function inferIndustryEntitySubtype(themeCode, textValue) {
  const textValueLower = String(textValue || "").toLowerCase();
  if (themeCode === "user") {
    if (/(consumer|customer|\u6d88\u8d39\u8005|\u5ba2\u6237)/.test(textValueLower)) return "consumer";
    if (/(member|\u4f1a\u5458)/.test(textValueLower)) return "member";
    if (/(buyer|\u4e70\u5bb6)/.test(textValueLower)) return "buyer";
    return "user";
  }
  if (themeCode === "merchant") {
    if (/(platform|\u5e73\u53f0)/.test(textValueLower)) return "platform";
    if (/(shop|store|\u5e97)/.test(textValueLower)) return "shop";
    if (/(supplier|\u4f9b\u5e94)/.test(textValueLower)) return "supplier";
    if (/(enterprise|company|operator|\u4f01\u4e1a|\u7ecf\u8425\u8005)/.test(textValueLower)) return "operator";
    return "merchant";
  }
  if (/(payment|\u652f\u4ed8)/.test(textValueLower)) return "payment";
  if (/(order|transaction|\u8ba2\u5355|\u4ea4\u6613)/.test(textValueLower)) return "transaction";
  if (/(complaint|work_order|\u6295\u8bc9|\u5de5\u5355)/.test(textValueLower)) return "complaint";
  if (/(inspection|\u68c0\u67e5)/.test(textValueLower)) return "inspection";
  if (/(report|\u62a5\u9001)/.test(textValueLower)) return "report";
  if (/(warning|risk|\u9884\u8b66|\u98ce\u9669)/.test(textValueLower)) return "warning";
  return "activity";
}

function inferIndustryThemesForTable(tablePlan, previewTable) {
  const textValue = `${tablePlan?.logicalTableName || previewTable?.logicalTableName || ""} ${tablePlan?.logicalLabel || previewTable?.logicalLabel || ""}`.toLowerCase();
  const matchedThemes = Object.values(INDUSTRY_DATA_SOURCE_THEME_META)
    .filter((theme) => theme.keywords.some((keyword) => textValue.includes(String(keyword).toLowerCase())))
    .map((theme) => theme.code);
  if (matchedThemes.length > 0) {
    return uniqueBy(matchedThemes.map((code) => ({ code })), (item) => item.code).map((item) => item.code);
  }
  if (String(tablePlan?.entityTier || "") === "event") {
    return ["activity"];
  }
  if (String(tablePlan?.entityTier || "") === "shared_master") {
    return ["merchant"];
  }
  if (String(tablePlan?.businessRole || "").toUpperCase() === "TRANSACTION") {
    return ["activity"];
  }
  return [];
}

function extractIndustryEntitySignal(row = {}, themeCode) {
  const entries = Object.entries(row)
    .filter(([fieldName, value]) => !isPrimaryKeyLike(fieldName) && value !== null && value !== undefined && value !== "");
  const priorityMatchers = [
    { type: "phone", test: (fieldName) => /(mobile|phone|tel|contact_phone|\u624b\u673a|\u7535\u8bdd)/i.test(fieldName) },
    { type: "email", test: (fieldName) => /email/i.test(fieldName) },
    { type: "id_card", test: (fieldName) => /(id_card|cert_no|identity|credential|\u8eab\u4efd|\u8bc1\u4ef6)/i.test(fieldName) },
    { type: "name", test: (fieldName) => /(name|title|\u540d\u79f0|\u59d3\u540d)/i.test(fieldName) && !isGenericFieldName(fieldName) },
    { type: "code", test: (fieldName) => /(_code|_no|code|number|serial|\u7f16\u7801|\u5355\u53f7)/i.test(fieldName) && !isGenericFieldName(fieldName) },
  ];

  for (const matcher of priorityMatchers) {
    const matchedEntry = entries.find(([fieldName]) => matcher.test(fieldName));
    if (!matchedEntry) continue;
    const normalizedValue = normalizeComparableText(matchedEntry[1]);
    if (!normalizedValue) continue;
    return {
      fingerprint: `${themeCode}:${matcher.type}:${normalizedValue}`,
      matchMethod: matcher.type,
      signalField: matchedEntry[0],
      signalValue: String(matchedEntry[1]),
    };
  }
  return null;
}

function pickIndustryEntityDisplayLabel({ row, logicalLabel, rowIndex }) {
  const entries = Object.entries(row || {})
    .filter(([fieldName, value]) => !isPrimaryKeyLike(fieldName) && value !== null && value !== undefined && value !== "");
  const preferred = entries.find(([fieldName]) => /(name|title|\u540d\u79f0|\u59d3\u540d)/i.test(fieldName) && !isGenericFieldName(fieldName))
    || entries.find(([fieldName]) => /(company|merchant|platform|shop|consumer|customer|user|activity|order|complaint|\u4f01\u4e1a|\u5546\u5bb6|\u5e73\u53f0|\u6d88\u8d39\u8005|\u7528\u6237|\u8ba2\u5355|\u6295\u8bc9)/i.test(fieldName))
    || entries[0];
  if (preferred) {
    return String(preferred[1]);
  }
  return `${logicalLabel || "\u8054\u52a8\u5b9e\u4f53"} #${rowIndex + 1}`;
}

function pickIndustryEntityAttributes(row = {}, limit = 3) {
  return Object.entries(row)
    .filter(([fieldName, value]) =>
      !isPrimaryKeyLike(fieldName)
      && value !== null
      && value !== undefined
      && value !== ""
      && typeof value !== "object"
    )
    .slice(0, limit)
    .map(([fieldName, value]) => ({
      fieldName,
      value: String(value),
    }));
}

function estimateTargetRowCount(table, sizing, dictItemCount = 0) {
  if (table?.tableKind === "DICTIONARY") {
    return dictItemCount;
  }
  const role = String(table?.businessRole || "").toUpperCase();
  if (role === "TRANSACTION") return sizing.transactionScale;
  if (role === "LOG") return sizing.transactionScale * 2;
  if (role === "BRIDGE") return Math.max(sizing.businessMasterSize, Math.round(sizing.transactionScale * 0.6));
  if (role === "SNAPSHOT") return sizing.businessMasterSize;
  return inferEntityTier(table) === "shared_master" ? sizing.sharedMasterSize : sizing.businessMasterSize;
}

const GENERIC_DICTIONARY_TOKENS = new Set(["status", "type", "category", "level", "mode", "result", "code", "name", "label"]);

function resolveSemanticCategoryFromTokens(tokens) {
  if (tokens.has("status")) return "status";
  if (tokens.has("type")) return "type";
  if (tokens.has("category")) return "category";
  if (tokens.has("level")) return "level";
  if (tokens.has("mode")) return "mode";
  if (tokens.has("result")) return "result";
  return null;
}

function inferDictionaryMatch(fieldName, dictTables) {
  const normalizedField = normalizeCode(fieldName, "");
  if (!normalizedField) return null;
  const fieldTokens = new Set(normalizedField.split("_").filter(Boolean));
  const fieldSemanticCategory = resolveSemanticCategoryFromTokens(fieldTokens);
  let bestMatch = null;

  for (const dictTable of dictTables || []) {
    const normalizedDictType = normalizeCode(dictTable?.dictType, "");
    if (!normalizedDictType) continue;
    const dictTokens = normalizedDictType.split("_").filter(Boolean);
    const dictTokenSet = new Set(dictTokens);
    const dictSemanticCategory = resolveSemanticCategoryFromTokens(dictTokenSet);
    const sharedSpecificTokens = dictTokens.filter((token) =>
      fieldTokens.has(token) && !GENERIC_DICTIONARY_TOKENS.has(token)
    );
    const sharedGenericTokens = dictTokens.filter((token) =>
      fieldTokens.has(token) && GENERIC_DICTIONARY_TOKENS.has(token)
    );
    const exactMatch = normalizedField === normalizedDictType;
    const prefixMatch = normalizedField.endsWith(normalizedDictType) || normalizedField.startsWith(normalizedDictType);
    const semanticCompatible = !fieldSemanticCategory || !dictSemanticCategory || fieldSemanticCategory === dictSemanticCategory;
    if (!exactMatch && !prefixMatch) {
      if (dictSemanticCategory && !fieldSemanticCategory) {
        continue;
      }
      if (!semanticCompatible || sharedSpecificTokens.length === 0) {
        continue;
      }
    }
    let score = 0;
    if (exactMatch) score += 12;
    if (prefixMatch) score += 8;
    score += sharedSpecificTokens.length * 4;
    score += sharedGenericTokens.length;
    if (semanticCompatible && fieldSemanticCategory && dictSemanticCategory) score += 3;
    if (score <= 0) continue;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { dictTable, score };
    }
  }

  return bestMatch?.dictTable || null;
}

function inferPrimaryKeyColumn(table) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  return columns.find((column) => column.isPrimaryKey) || columns[0] || null;
}

function sortTablesForPreview(tables, relations) {
  const tableNames = (Array.isArray(tables) ? tables : []).map((table) => String(table?.logicalTableName || "")).filter(Boolean);
  const tableNameSet = new Set(tableNames);
  const dependencyMap = new Map(tableNames.map((tableName) => [tableName, new Set()]));
  const outgoingMap = new Map(tableNames.map((tableName) => [tableName, new Set()]));

  for (const relation of relations || []) {
    const fromTable = String(relation?.fromTable || "");
    const toTable = String(relation?.toTable || "");
    if (!tableNameSet.has(fromTable) || !tableNameSet.has(toTable) || fromTable === toTable) continue;
    dependencyMap.get(fromTable).add(toTable);
    outgoingMap.get(toTable).add(fromTable);
  }

  const inDegree = new Map(tableNames.map((tableName) => [tableName, dependencyMap.get(tableName).size]));
  const queue = tableNames.filter((tableName) => inDegree.get(tableName) === 0);
  const queued = new Set(queue);
  const ordered = [];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    queued.delete(current);
    if (visited.has(current)) continue;
    visited.add(current);
    ordered.push(current);
    for (const next of outgoingMap.get(current) || []) {
      const nextDegree = Math.max(0, Number(inDegree.get(next) || 0) - 1);
      inDegree.set(next, nextDegree);
      if (nextDegree === 0 && !visited.has(next) && !queued.has(next)) {
        queue.push(next);
        queued.add(next);
      }
    }
  }

  for (const tableName of tableNames) {
    if (!ordered.includes(tableName)) {
      ordered.push(tableName);
    }
  }

  return ordered;
}

function buildGenerationPlanSummary(generationPlan, samplePreview) {
  const tablePlans = Array.isArray(generationPlan?.tablePlans) ? generationPlan.tablePlans : [];
  const previewTables = Array.isArray(samplePreview?.tables) ? samplePreview.tables : [];
  return {
    tableCount: tablePlans.length,
    businessTableCount: tablePlans.filter((item) => item.tableKind === "BUSINESS").length,
    dictionaryTableCount: tablePlans.filter((item) => item.tableKind === "DICTIONARY").length,
    targetRowCount: tablePlans.reduce((sum, item) => sum + Number(item.targetRows || 0), 0),
    incrementalRowCount: tablePlans.reduce((sum, item) => sum + Number(item.incrementalRowsPerCycle || 0), 0),
    loadedRowCount: tablePlans.reduce((sum, item) => sum + Number(item.loadedRows || 0), 0),
    previewTableCount: previewTables.length,
    previewRowCount: previewTables.reduce((sum, item) => sum + Number(item.previewRowCount || 0), 0),
    configuredInitialDataVolume: Number(generationPlan?.sizing?.initialDataVolume || 0),
    configuredIncrementalDataVolume: Number(generationPlan?.sizing?.incrementalDataVolume || 0),
    incrementCycleDays: Number(generationPlan?.sizing?.incrementCycleDays || 0),
  };
}

function buildFallbackDictionaryPreviewRows(dictTable, previewRowLimit) {
  const rowCount = Math.max(1, previewRowLimit);
  return Array.from({ length: rowCount }, (_, index) => ({
    item_code: buildPreviewCode(dictTable?.dictType || "DICT", index),
    item_label: `${dictTable?.dictName || dictTable?.dictType || "Dictionary"} ${index + 1}`,
    category_code: dictTable?.categoryCode || null,
    value_range_json: null,
    sort_order: index + 1,
  }));
}

function detectTableArchetype(table) {
  const textValue = `${table?.logicalTableName || ""} ${table?.logicalLabel || ""}`.toLowerCase();
  if (/(user|member|customer|consumer|account|profile|buyer|person|用户|会员|客户|消费者|账号)/.test(textValue)) return "user";
  if (/(merchant|seller|shop|store|supplier|company|enterprise|brand|门店|商户|商家|供应商|企业)/.test(textValue)) return "merchant";
  if (/(product|goods|sku|item|service|commodity|商品|产品|服务)/.test(textValue)) return "product";
  if (/(order|trade|bill|transaction|deal|订单|交易|账单)/.test(textValue)) return "order";
  if (/(payment|settlement|refund|pay|收款|支付|退款|结算)/.test(textValue)) return "payment";
  if (/(delivery|shipping|logistics|waybill|fulfillment|物流|配送|履约|运单)/.test(textValue)) return "logistics";
  if (/(complaint|ticket|work_order|case|service_order|工单|投诉|客诉|案件)/.test(textValue)) return "complaint";
  if (/(log|record|event|trace|audit|history|日志|记录|轨迹|事件)/.test(textValue)) return "event";
  return inferEntityTier(table) === "shared_master" ? "master" : "generic";
}

function computeTableDistributionWeight(table, mode = "initial") {
  const role = String(table?.businessRole || "").toUpperCase();
  const archetype = detectTableArchetype(table);
  const initialWeights = {
    user: 1.2,
    merchant: 1.0,
    product: 1.1,
    master: 0.9,
    order: 3.1,
    payment: 2.2,
    logistics: 1.8,
    complaint: 1.4,
    event: 2.5,
    generic: 1.0,
  };
  const incrementalWeights = {
    user: 0.2,
    merchant: 0.15,
    product: 0.25,
    master: 0.2,
    order: 3.2,
    payment: 2.6,
    logistics: 2.1,
    complaint: 1.6,
    event: 2.8,
    generic: 0.8,
  };
  const baseWeight = (mode === "incremental" ? incrementalWeights : initialWeights)[archetype] || 1;
  if (role === "DETAIL") return baseWeight + 0.8;
  if (role === "LOG") return baseWeight + 0.9;
  if (role === "BRIDGE") return baseWeight + 0.4;
  if (role === "SNAPSHOT") return Math.max(0.4, baseWeight - 0.3);
  return baseWeight;
}

function distributeVolumeByWeight(items, totalVolume, weightSelector) {
  const result = new Map(items.map((item) => [String(item?.logicalTableName || item?.tableName || ""), 0]));
  const safeTotal = Math.max(0, Number(totalVolume || 0));
  const weightedItems = items
    .map((item) => ({
      item,
      key: String(item?.logicalTableName || item?.tableName || ""),
      weight: Math.max(0, Number(weightSelector(item) || 0)),
    }))
    .filter((entry) => entry.key && entry.weight > 0);
  if (safeTotal <= 0 || weightedItems.length === 0) {
    return result;
  }
  if (safeTotal <= weightedItems.length) {
    weightedItems
      .sort((left, right) => right.weight - left.weight)
      .slice(0, safeTotal)
      .forEach((entry) => result.set(entry.key, 1));
    return result;
  }

  const sumWeight = weightedItems.reduce((sum, entry) => sum + entry.weight, 0);
  let assigned = 0;
  const remainders = [];
  for (const entry of weightedItems) {
    const quota = (safeTotal * entry.weight) / sumWeight;
    const rows = Math.max(1, Math.floor(quota));
    result.set(entry.key, rows);
    assigned += rows;
    remainders.push({ key: entry.key, remainder: quota - Math.floor(quota), weight: entry.weight });
  }

  while (assigned > safeTotal) {
    const candidate = remainders
      .filter((entry) => Number(result.get(entry.key) || 0) > 1)
      .sort((left, right) => left.remainder - right.remainder || left.weight - right.weight)[0];
    if (!candidate) break;
    result.set(candidate.key, Number(result.get(candidate.key) || 0) - 1);
    assigned -= 1;
  }

  while (assigned < safeTotal) {
    const candidate = remainders
      .sort((left, right) => right.remainder - left.remainder || right.weight - left.weight)[assigned % remainders.length];
    result.set(candidate.key, Number(result.get(candidate.key) || 0) + 1);
    assigned += 1;
  }

  return result;
}

function buildScenarioMoment(options, seed, rowIndex) {
  const dayOffset = seededInteger(seed, `day_${rowIndex}`, 0, Math.max(0, Number(options.timelineDays || 1) - 1));
  const base = addDays(options.timelineStartAt || new Date().toISOString(), dayOffset);
  base.setHours(seededInteger(seed, `hour_${rowIndex}`, 8, 21), seededInteger(seed, `minute_${rowIndex}`, 0, 59), seededInteger(seed, `second_${rowIndex}`, 0, 59), 0);
  return base;
}

function buildChineseName(seed) {
  const familyName = seededPick(CHINESE_FAMILY_NAMES, seed, "family") || "张";
  const givenLength = seededInteger(seed, "given_length", 1, 2);
  const givenName = Array.from({ length: givenLength }, (_, index) => seededPick(CHINESE_GIVEN_NAME_PARTS, seed, `given_${index}`) || "伟").join("");
  return `${familyName}${givenName}`;
}

function buildChineseMobile(seed) {
  const prefix = seededPick(["136", "137", "138", "139", "150", "151", "157", "158", "159", "166", "173", "177", "180", "181", "186", "188", "199"], seed, "mobile_prefix") || "138";
  return `${prefix}${String(seededInteger(seed, "mobile_suffix", 10000000, 99999999)).padStart(8, "0")}`;
}

function buildChineseIdCard(seed, location, birthday, gender) {
  const birth = formatCompactDate(birthday);
  const areaCode = String(location?.districtCode || location?.cityCode || "310115").padStart(6, "0").slice(0, 6);
  let sequence = String(seededInteger(seed, "id_seq", 100, 998));
  const parity = gender === "女" ? 0 : 1;
  if (Number(sequence) % 2 !== parity) {
    sequence = String(Number(sequence) + 1).padStart(3, "0");
  }
  const id17 = `${areaCode}${birth}${sequence}`;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const sum = id17
    .split("")
    .reduce((total, digit, index) => total + (Number(digit || 0) * weights[index]), 0);
  return `${id17}${checks[sum % 11]}`;
}

function buildPersonProfile(seed, rowIndex, locationOverride) {
  const gender = seededInteger(seed, "gender", 0, 1) === 0 ? "男" : "女";
  const age = seededInteger(seed, "age", 22, 52);
  const birthday = new Date();
  birthday.setFullYear(birthday.getFullYear() - age, seededInteger(seed, "birth_month", 0, 11), seededInteger(seed, "birth_day", 1, 28));
  birthday.setHours(0, 0, 0, 0);
  const location = locationOverride || pickPreviewLocation(seededInteger(seed, "location", 0, PREVIEW_LOCATIONS.length - 1));
  const name = buildChineseName(seed);
  const mobile = buildChineseMobile(seed);
  const email = `${normalizeCode(`${name}_${seededInteger(seed, "mail", 1, 9999)}`, "user")}@example.cn`;
  return {
    name,
    gender,
    age,
    mobile,
    email,
    birthday: formatPreviewDate(birthday),
    location,
    address: `${location.cityName}${location.districtName}${seededPick(PREVIEW_STREET_NAMES, seed, "street") || "人民路"}${seededInteger(seed, "street_no", 18, 299)}号${seededInteger(seed, "building", 1, 6)}栋${seededInteger(seed, "room", 101, 2608)}室`,
    occupation: seededPick(CHINESE_OCCUPATIONS, seed, "occupation") || "平台运营",
    registerAt: formatPreviewDateTime(addDays(new Date(), -seededInteger(seed, "register_days", 60, 1200))),
    lastLoginAt: formatPreviewDateTime(addDays(new Date(), -seededInteger(seed, "login_days", 0, 30))),
    idCard: buildChineseIdCard(seed, location, birthday, gender),
  };
}

function buildMerchantProfile(seed, rowIndex, locationOverride) {
  const location = locationOverride || pickPreviewLocation(seededInteger(seed, "merchant_location", 0, PREVIEW_LOCATIONS.length - 1));
  const brandName = seededPick(CHINESE_BRAND_NAMES, seed, "merchant_brand") || "青禾";
  const companySuffix = seededPick(CHINESE_COMPANY_SUFFIXES, seed, "merchant_suffix") || "科技有限公司";
  const contactSeed = buildSeed(seed, "contact");
  const contact = buildPersonProfile(contactSeed, rowIndex, location);
  const districtToken = String(location.districtName || location.cityName || "中心").replace(/区|县|市/g, "");
  const merchantName = `${districtToken}${brandName}${seededPick(["商贸", "零售", "供应链", "生活", "优选"], seed, "merchant_mid") || "零售"}${companySuffix}`;
  return {
    merchantName,
    companyName: merchantName,
    shopName: `${districtToken}${brandName}${seededPick(["旗舰店", "生活馆", "服务中心", "直营店", "体验店"], seed, "shop_type") || "旗舰店"}`,
    merchantCode: buildPreviewCode(`${brandName}_${location.cityCode}`, rowIndex),
    contactName: contact.name,
    contactPhone: contact.mobile,
    location,
    address: `${location.cityName}${location.districtName}${seededPick(PREVIEW_STREET_NAMES, seed, "merchant_street") || "建设路"}${seededInteger(seed, "merchant_no", 66, 588)}号`,
    categoryName: seededPick(["商超零售", "生鲜供应", "社区团购", "品牌直营", "本地生活"], seed, "merchant_category") || "商超零售",
    businessLicenseNo: `91${String(location.cityCode || "310100").padStart(6, "0")}${String(seededInteger(seed, "license", 1000000000, 9999999999)).padStart(10, "0")}`,
    openedAt: formatPreviewDate(addDays(new Date(), -seededInteger(seed, "opened_days", 120, 2400))),
  };
}

function buildProductProfile(seed, rowIndex) {
  const series = seededPick(CHINESE_PRODUCT_SERIES, seed, "series") || CHINESE_PRODUCT_SERIES[0];
  const brandName = seededPick(CHINESE_BRAND_NAMES, seed, "product_brand") || "观澜";
  const productName = seededPick(series.productNames, seed, "product_name") || "标准服务包";
  const unitPrice = Number((seededInteger(seed, "unit_price", 1990, 15990) / 100).toFixed(2));
  const costPrice = Number((unitPrice * (0.55 + (seededInteger(seed, "cost_rate", 0, 20) / 100))).toFixed(2));
  return {
    productName,
    categoryName: series.category,
    brandName,
    skuCode: buildPreviewCode(`${brandName}_${productName}`, rowIndex),
    productCode: buildPreviewCode(`${series.category}_${rowIndex + 1}`, rowIndex),
    unitPrice,
    costPrice,
  };
}

function buildOrderFact(seed, rowIndex, options, context) {
  const orderCreatedAt = buildScenarioMoment(options, seed, rowIndex);
  const quantity = seededInteger(seed, "quantity", 1, 6);
  const unitPrice = Number((context?.product?.unitPrice || Number((seededInteger(seed, "fallback_price", 2990, 8990) / 100).toFixed(2))));
  const discountAmount = Number(((seededInteger(seed, "discount", 0, 25) / 100) * unitPrice * quantity).toFixed(2));
  const freightAmount = Number((seededInteger(seed, "freight", 0, 1800) / 100).toFixed(2));
  const orderAmount = Number((unitPrice * quantity).toFixed(2));
  const payableAmount = Number(Math.max(0.01, orderAmount + freightAmount - discountAmount).toFixed(2));
  const orderStatus = seededPick(CHINESE_ORDER_STATUS_CODES, seed, "order_status") || "PAID";
  const paymentStatus = orderStatus === "CREATED" ? "UNPAID" : orderStatus === "REFUNDED" ? "REFUNDED" : "PAID";
  const deliveryStatus = ["SHIPPED", "FINISHED"].includes(orderStatus) ? seededPick(["IN_TRANSIT", "SIGNED"], seed, "delivery_done") || "SIGNED" : orderStatus === "REFUNDED" ? "RETURNED" : seededPick(["PENDING", "ALLOCATED"], seed, "delivery_pending") || "PENDING";
  const paidAt = orderStatus === "CREATED" ? null : addHours(orderCreatedAt, seededInteger(seed, "pay_hours", 0, 4));
  const shippedAt = ["SHIPPED", "FINISHED", "REFUNDED"].includes(orderStatus) ? addHours(orderCreatedAt, seededInteger(seed, "ship_hours", 12, 72)) : null;
  const finishedAt = orderStatus === "FINISHED" ? addHours(orderCreatedAt, seededInteger(seed, "finish_hours", 48, 168)) : null;
  const refundAmount = orderStatus === "REFUNDED" ? payableAmount : Number((seededInteger(seed, "refund_amount", 0, 0) / 100).toFixed(2));
  return {
    orderNo: `OD${formatCompactDate(orderCreatedAt)}${String(seededInteger(seed, "order_no", 100000, 999999))}`,
    tradeNo: `TR${formatCompactDate(orderCreatedAt)}${String(seededInteger(seed, "trade_no", 100000, 999999))}`,
    paymentNo: `PM${formatCompactDate(orderCreatedAt)}${String(seededInteger(seed, "payment_no", 100000, 999999))}`,
    refundNo: `RF${formatCompactDate(orderCreatedAt)}${String(seededInteger(seed, "refund_no", 100000, 999999))}`,
    logisticsNo: `YT${formatCompactDate(orderCreatedAt)}${String(seededInteger(seed, "waybill", 1000000, 9999999))}`,
    quantity,
    unitPrice,
    discountAmount,
    freightAmount,
    orderAmount,
    payableAmount,
    refundAmount,
    orderStatus,
    paymentStatus,
    deliveryStatus,
    channelCode: seededPick(CHINESE_CHANNEL_CODES, seed, "channel") || "APP",
    deviceType: seededPick(CHINESE_DEVICE_TYPES, seed, "device") || "Android",
    paymentMethod: seededPick(CHINESE_PAYMENT_METHODS, seed, "pay_method") || "ALIPAY",
    logisticsMethod: seededPick(CHINESE_LOGISTICS_METHODS, seed, "logistics_method") || "快递配送",
    createdAt: orderCreatedAt,
    paidAt,
    shippedAt,
    finishedAt,
  };
}

function buildComplaintFact(seed, rowIndex, options, context) {
  const createdAt = buildScenarioMoment(options, buildSeed(seed, "complaint"), rowIndex);
  return {
    caseNo: `CS${formatCompactDate(createdAt)}${String(seededInteger(seed, "case_no", 100000, 999999))}`,
    status: seededPick(CHINESE_CASE_STATUS_CODES, seed, "case_status") || "PROCESSING",
    reason: seededPick(CHINESE_COMPLAINT_REASONS, seed, "case_reason") || "系统下单失败",
    createdAt,
    closedAt: addHours(createdAt, seededInteger(seed, "case_close_hours", 12, 96)),
    title: `${context?.merchant?.shopName || "门店"}${seededPick(["售后咨询", "订单投诉", "履约异常", "退款申请"], seed, "case_title") || "订单投诉"}`,
  };
}

function stripAdministrativeSuffix(value) {
  return String(value || "").replace(/(省|市|区|县)$/g, "");
}

function isEmergencyScenarioContext(table, logicalTable, instance) {
  const contextText = [
    table?.logicalTableName,
    table?.logicalLabel,
    logicalTable?.tableLabel,
    instance?.templateName,
    instance?.instanceName,
  ].filter(Boolean).join(" ");
  return /(env_|eco|environment|ecology|emergency|response|应急|生态环境|突发|危废|扬尘|污水|河道)/i.test(contextText);
}

function buildEmergencyEnterpriseName(seed, location) {
  const districtToken = stripAdministrativeSuffix(location?.districtName || location?.cityName || "城区");
  const prefix = seededPick(EMERGENCY_ENTERPRISE_PREFIXES, seed, "enterprise_prefix") || "绿源";
  const suffix = seededPick(EMERGENCY_ENTERPRISE_SUFFIXES, seed, "enterprise_suffix") || "环保科技有限公司";
  return `${districtToken}${prefix}${suffix}`;
}

function buildEmergencyLocationText(seed, location) {
  const districtToken = stripAdministrativeSuffix(location?.districtName || location?.cityName || "城区");
  const parkName = `${districtToken}${seededPick(EMERGENCY_PARK_SUFFIXES, seed, "park_suffix") || "工业园区"}`;
  const streetName = seededPick(PREVIEW_STREET_NAMES, seed, "emergency_street") || "人民路";
  const streetNo = seededInteger(seed, "emergency_street_no", 18, 399);
  const siteSuffix = seededPick(EMERGENCY_SITE_SUFFIXES, seed, "site_suffix") || "装卸区";
  return `${location?.cityName || ""}${location?.districtName || ""}${parkName}${streetName}${streetNo}号${siteSuffix}`;
}

function buildEmergencyResourceQuantity(seed, resourceName) {
  if (/车/.test(resourceName)) return `${seededInteger(seed, "resource_quantity", 1, 4)}辆`;
  if (/(专家|人员|队伍)/.test(resourceName)) return `${seededInteger(seed, "resource_quantity", 4, 12)}人`;
  if (/围油栏/.test(resourceName)) return `${seededInteger(seed, "resource_quantity", 40, 120)}米`;
  if (/(棉|托盘|膜|包)/.test(resourceName)) return `${seededInteger(seed, "resource_quantity", 8, 60)}件`;
  if (/(泵|设备|仪|机)/.test(resourceName)) return `${seededInteger(seed, "resource_quantity", 1, 6)}台`;
  return `${seededInteger(seed, "resource_quantity", 2, 18)}套`;
}

function buildEmergencyProfile({ seed, rowIndex, location, options }) {
  const scenario = seededPick(EMERGENCY_EVENT_SCENARIOS, seed, "emergency_scenario") || EMERGENCY_EVENT_SCENARIOS[0];
  const enterpriseName = buildEmergencyEnterpriseName(buildSeed(seed, "enterprise"), location);
  const districtName = String(location?.districtName || location?.cityName || "城区");
  const districtToken = stripAdministrativeSuffix(districtName);
  const parkName = `${districtToken}${seededPick(EMERGENCY_PARK_SUFFIXES, seed, "park_suffix") || "工业园区"}`;
  const locationText = buildEmergencyLocationText(buildSeed(seed, "location_text"), location);
  const occurrenceTime = buildScenarioMoment(options, buildSeed(seed, "occurrence_time"), rowIndex);
  const responseStartTime = addHours(occurrenceTime, seededInteger(seed, "response_start_delay", 0, 2));
  const responseEndTime = addHours(responseStartTime, seededInteger(seed, "response_duration_hours", 6, 72));
  const approvalDate = addDays(occurrenceTime, -seededInteger(seed, "approval_days", 30, 240));
  const effectiveDate = addDays(approvalDate, seededInteger(seed, "effective_delay_days", 1, 15));
  const lastInspectionDate = addDays(occurrenceTime, -seededInteger(seed, "inspection_days", 1, 45));
  const reportUnit = seededPick([
    enterpriseName,
    `${districtName}生态环境保护综合行政执法队`,
    `${districtName}生态环境监测站`,
    `${parkName}管理委员会`,
    `${districtName}应急管理局`,
  ], seed, "report_unit") || enterpriseName;
  const preparationUnit = seededPick([
    enterpriseName,
    `${districtName}生态环境局`,
    `${districtName}生态环境监测站`,
    `${parkName}管理委员会`,
  ], seed, "preparation_unit") || enterpriseName;
  const responsibleUnit = seededPick([
    `${districtName}环境应急物资保障中心`,
    `${districtName}生态环境监测站`,
    `${parkName}应急仓储中心`,
    `${enterpriseName}应急保障组`,
  ], seed, "responsible_unit") || `${districtName}环境应急物资保障中心`;
  const planTypeLabel = seededPick(EMERGENCY_PLAN_TYPE_LABELS, seed, "plan_type") || EMERGENCY_PLAN_TYPE_LABELS[1];
  const responseLevelLabel = seededPick(EMERGENCY_RESPONSE_LEVEL_LABELS, seed, "response_level") || EMERGENCY_RESPONSE_LEVEL_LABELS[2];
  const riskLevel = seededPick(EMERGENCY_RISK_LEVELS, seed, "risk_level") || EMERGENCY_RISK_LEVELS[1];
  const approvalStatus = seededPick(EMERGENCY_PLAN_APPROVAL_STATUS, seed, "approval_status") || EMERGENCY_PLAN_APPROVAL_STATUS[0];
  const responseStatus = seededPick(EMERGENCY_RESPONSE_STATUS, seed, "response_status") || EMERGENCY_RESPONSE_STATUS[0];
  const maintenanceStatus = seededPick(EMERGENCY_RESOURCE_MAINTENANCE_STATUS, seed, "maintenance_status") || EMERGENCY_RESOURCE_MAINTENANCE_STATUS[0];
  const availabilityStatus = seededPick(EMERGENCY_RESOURCE_AVAILABILITY_STATUS, seed, "availability_status") || EMERGENCY_RESOURCE_AVAILABILITY_STATUS[0];
  const resourceTypeLabel = scenario.resourceTypeLabel || "应急处置物资";
  const version = `${occurrenceTime.getFullYear()}版 V${seededInteger(seed, "version_major", 1, 3)}.${seededInteger(seed, "version_minor", 0, 9)}`;
  const planName = text(
    planTypeLabel === "企事业单位应急预案"
      ? `${enterpriseName}${scenario.planTopic}${planTypeLabel}`
      : `${districtName}${scenario.planTopic}${planTypeLabel}`,
    120
  );
  const planContentSummary = text(
    `适用于${enterpriseName}${scenario.planTopic}场景，明确分级响应、监测布点、人员疏散、信息报送和资源调拨要求。`,
    120
  );
  return {
    scenario,
    enterpriseName,
    parkName,
    eventName: text(`${enterpriseName}${scenario.eventTopic}`, 120),
    eventType: scenario.eventType || scenario.planTopic,
    planTypeLabel,
    responseLevelLabel,
    riskLevel,
    reportUnit,
    preparationUnit,
    responsibleUnit,
    approvalStatus,
    responseStatus,
    maintenanceStatus,
    availabilityStatus,
    occurrenceTime,
    responseStartTime,
    responseEndTime,
    approvalDate,
    effectiveDate,
    lastInspectionDate,
    version,
    planName,
    planContentSummary,
    locationText,
    resourceName: scenario.resourceName,
    resourceTypeLabel,
    resourceSpecification: scenario.resourceSpecification,
    quantity: buildEmergencyResourceQuantity(buildSeed(seed, "resource_quantity"), scenario.resourceName),
    storageLocation: text(
      `${location?.cityName || ""}${location?.districtName || ""}${parkName}${seededPick(EMERGENCY_STORAGE_ZONES, seed, "storage_zone") || "应急物资库A区"}`,
      120
    ),
    disposalMeasures: text(scenario.disposalMeasures, 120),
    dispatchInfo: text(scenario.dispatchInfo, 120),
    attachmentUrl: `/archive/env-emergency/${occurrenceTime.getFullYear()}/${normalizeCode(enterpriseName, "plan")}_${formatCompactDate(approvalDate)}.pdf`,
  };
}

function findRelatedRow(relatedRows, matcher) {
  return Object.entries(relatedRows || {})
    .find(([tableName]) => matcher(String(tableName || "").toLowerCase()))?.[1] || null;
}

function buildRowBusinessContext({ table, row, rowIndex, relatedRows, options, instance, logicalTable }) {
  const archetype = detectTableArchetype({ ...table, logicalLabel: logicalTable?.tableLabel || table.logicalLabel });
  const location = pickPreviewLocation(seededInteger(buildSeed(instance?.industryCode || instance?.instanceCode || "scenario", table.logicalTableName, rowIndex), "location", 0, PREVIEW_LOCATIONS.length - 1));
  const userAnchor = row.user_id || row.member_id || row.customer_id || row.buyer_id || findRelatedRow(relatedRows, (name) => /(user|member|customer|buyer|account)/.test(name))?.id || row.id || rowIndex + 1;
  const merchantAnchor = row.merchant_id || row.shop_id || row.store_id || row.supplier_id || findRelatedRow(relatedRows, (name) => /(merchant|shop|store|seller|supplier|company)/.test(name))?.id || rowIndex + 1;
  const productAnchor = row.product_id || row.goods_id || row.sku_id || row.item_id || findRelatedRow(relatedRows, (name) => /(product|goods|sku|item|service)/.test(name))?.id || rowIndex + 1;
  const orderAnchor = row.order_id || row.trade_id || row.payment_id || row.biz_id || findRelatedRow(relatedRows, (name) => /(order|trade|payment|refund|bill|transaction)/.test(name))?.id || row.id || rowIndex + 1;
  const person = buildPersonProfile(buildSeed(instance?.industryCode || "generic", "user", userAnchor), rowIndex, location);
  const merchant = buildMerchantProfile(buildSeed(instance?.industryCode || "generic", "merchant", merchantAnchor), rowIndex, location);
  const product = buildProductProfile(buildSeed(instance?.industryCode || "generic", "product", productAnchor), rowIndex);
  const order = buildOrderFact(buildSeed(instance?.industryCode || "generic", "order", orderAnchor), rowIndex, options, { person, merchant, product });
  const complaint = buildComplaintFact(buildSeed(instance?.industryCode || "generic", "complaint", orderAnchor), rowIndex, options, { person, merchant, order });
  const emergency = isEmergencyScenarioContext(table, logicalTable, instance)
    ? buildEmergencyProfile({
      seed: buildSeed(instance?.instanceCode || instance?.industryCode || "scenario", rowIndex),
      rowIndex,
      location: merchant.location || person.location,
      options,
    })
    : null;
  return {
    archetype,
    location: merchant.location || person.location,
    person,
    merchant,
    product,
    order,
    complaint,
    emergency,
    tableLabel: logicalTable?.tableLabel || table.logicalLabel || table.logicalTableName,
    eventAction: emergency?.eventType
      || seededPick(CHINESE_EVENT_ACTIONS, buildSeed(instance?.instanceCode || "scenario", table.logicalTableName, rowIndex), "event_action")
      || "提交订单",
  };
}

function buildNarrativeText(fieldName, context, rowIndex) {
  if (context.emergency) {
    if (/(title)/i.test(fieldName)) {
      return context.emergency.eventName;
    }
    if (/(remark|desc|summary|content|note)/i.test(fieldName)) {
      return context.emergency.planContentSummary;
    }
  }
  const eventTime = formatPreviewDateTime(context.order.createdAt);
  if (/(title)/i.test(fieldName)) {
    if (context.archetype === "complaint") return context.complaint.title;
    return `${context.merchant.shopName}${context.eventAction}`;
  }
  if (/(remark|desc|summary|content|note)/i.test(fieldName)) {
    if (context.archetype === "complaint") {
      return `${context.person.name}于${formatPreviewDateTime(context.complaint.createdAt)}反馈“${context.complaint.reason}”，当前状态为${context.complaint.status}。`;
    }
    return `${context.person.name}于${eventTime}在${context.merchant.shopName}通过${context.order.channelCode}完成${context.eventAction}，订单金额${context.order.payableAmount}元。`;
  }
  return `${context.tableLabel || "业务对象"}记录${rowIndex + 1}`;
}

function buildStatusValue(fieldName, context) {
  if (context.emergency) {
    if (/(approval)/i.test(fieldName)) return context.emergency.approvalStatus;
    if (/(maintenance)/i.test(fieldName)) return context.emergency.maintenanceStatus;
    if (/(availability)/i.test(fieldName)) return context.emergency.availabilityStatus;
    if (/(response)/i.test(fieldName)) return context.emergency.responseStatus;
  }
  if (/(payment)/i.test(fieldName)) return context.order.paymentStatus;
  if (/(delivery|shipping|logistics)/i.test(fieldName)) return context.order.deliveryStatus;
  if (/(case|ticket|complaint|service)/i.test(fieldName)) return context.complaint.status;
  return context.order.orderStatus;
}

function buildEmergencyScalarValue({ normalizedField, columnType, context, table }) {
  const emergency = context.emergency;
  if (!emergency) return undefined;

  if (/(event_name|incident_name|case_name)/i.test(normalizedField)) return emergency.eventName;
  if (/(event_type|incident_type)/i.test(normalizedField)) return emergency.eventType;
  if (/(occurrence_time|occurred_at|occur_time|happen_time)/i.test(normalizedField)) return formatPreviewDateTime(emergency.occurrenceTime);
  if (/(response_start_time)/i.test(normalizedField)) return formatPreviewDateTime(emergency.responseStartTime);
  if (/(response_end_time)/i.test(normalizedField)) return formatPreviewDateTime(emergency.responseEndTime);
  if (/(^location$|event_location|incident_location|site_location)/i.test(normalizedField)) return emergency.locationText;
  if (/(report_unit|report_org|report_dept)/i.test(normalizedField)) return emergency.reportUnit;
  if (/(disposal_measures|disposal_actions|control_measures)/i.test(normalizedField)) return emergency.disposalMeasures;
  if (/(resource_dispatch_info|dispatch_info|dispatch_note)/i.test(normalizedField)) return emergency.dispatchInfo;
  if (/(plan_name)/i.test(normalizedField)) return emergency.planName;
  if (/(risk_level)/i.test(normalizedField)) return emergency.riskLevel;
  if (/(preparation_unit|prepared_by|draft_unit)/i.test(normalizedField)) return emergency.preparationUnit;
  if (/(approval_date)/i.test(normalizedField)) return formatPreviewDate(emergency.approvalDate);
  if (/(effective_date)/i.test(normalizedField)) return formatPreviewDate(emergency.effectiveDate);
  if (normalizedField === "version" || /(version_no|plan_version|revision_no)/i.test(normalizedField)) return emergency.version;
  if (/(plan_content_summary)/i.test(normalizedField)) return emergency.planContentSummary;
  if (/(attachment_url|document_url|file_url|attachment_path)/i.test(normalizedField)) return emergency.attachmentUrl;
  if (/(resource_name)/i.test(normalizedField)) return emergency.resourceName;
  if (/^(specification|spec|model)$|_(specification|spec|model)$/.test(normalizedField)) return emergency.resourceSpecification;
  if (/^quantity$/.test(normalizedField) || /(reserve_quantity|inventory_quantity|stock_quantity)/i.test(normalizedField)) return emergency.quantity;
  if (/(storage_location|warehouse_location|reserve_location)/i.test(normalizedField)) return emergency.storageLocation;
  if (/(responsible_unit|owner_unit|manage_unit|support_unit)/i.test(normalizedField)) return emergency.responsibleUnit;
  if (/(last_inspection_date|inspection_date|last_check_date)/i.test(normalizedField)) return formatPreviewDate(emergency.lastInspectionDate);
  if (/(remark|desc|summary|memo|note)/i.test(normalizedField)) {
    if (/plan/i.test(String(table?.logicalTableName || ""))) return emergency.planContentSummary;
    if (/resource/i.test(String(table?.logicalTableName || ""))) {
      return text(`${emergency.responsibleUnit}负责${emergency.resourceName}日常维护，当前状态${emergency.availabilityStatus}。`, 120);
    }
    return emergency.disposalMeasures;
  }
  if (isJsonColumnType(columnType)) {
    return {
      domain: "environment_emergency",
      eventName: emergency.eventName,
      planName: emergency.planName,
      reportUnit: emergency.reportUnit,
      responseStatus: emergency.responseStatus,
      city: context.location.cityName,
      district: context.location.districtName,
    };
  }
  return undefined;
}

function buildRealisticScalarValue({ fieldName, columnType, rowIndex, row, table, logicalTable, context }) {
  const normalizedField = normalizeCode(fieldName, "");
  const primaryKeyColumn = inferPrimaryKeyColumn(table);
  const primaryKeyName = primaryKeyColumn?.columnName || null;
  const primaryKeyValue = primaryKeyName ? row[primaryKeyName] : null;
  const location = context.location;
  const emergencyValue = buildEmergencyScalarValue({ normalizedField, columnType, context, table });
  if (emergencyValue !== undefined) {
    return emergencyValue;
  }

  if (isBooleanColumnType(columnType)) {
    return seededInteger(buildSeed(table.logicalTableName, rowIndex), normalizedField, 0, 1) === 1;
  }
  if (isDateColumnType(columnType)) {
    if (/(birth|birthday)/i.test(normalizedField)) return context.person.birthday;
    if (/(opened|register|signup)/i.test(normalizedField)) return context.merchant.openedAt;
    if (/(finish|complete|closed)/i.test(normalizedField)) return formatPreviewDate(context.complaint.closedAt);
    if (/(pay)/i.test(normalizedField) && context.order.paidAt) return formatPreviewDate(context.order.paidAt);
    return formatPreviewDate(context.order.createdAt);
  }
  if (isDateTimeColumnType(columnType)) {
    if (/(pay)/i.test(normalizedField) && context.order.paidAt) return formatPreviewDateTime(context.order.paidAt);
    if (/(ship|delivery|logistics|send)/i.test(normalizedField) && context.order.shippedAt) return formatPreviewDateTime(context.order.shippedAt);
    if (/(finish|complete|closed|resolved)/i.test(normalizedField) && context.order.finishedAt) return formatPreviewDateTime(context.order.finishedAt);
    if (/(login)/i.test(normalizedField)) return context.person.lastLoginAt;
    if (/(register|signup|opened)/i.test(normalizedField)) return context.person.registerAt;
    return formatPreviewDateTime(context.order.createdAt);
  }
  if (isJsonColumnType(columnType)) {
    return {
      source: "scenario_management",
      archetype: context.archetype,
      province: location.provinceName,
      city: location.cityName,
      amount: context.order.payableAmount,
    };
  }

  if (/(mobile|phone|tel)/i.test(normalizedField)) {
    return /(merchant|shop|store|seller|contact)/i.test(normalizedField) ? context.merchant.contactPhone : context.person.mobile;
  }
  if (/(email)/i.test(normalizedField)) return context.person.email;
  if (/(id_card|cert|identity|credential)/i.test(normalizedField)) return context.person.idCard;
  if (normalizedField.includes("province_code")) return location.provinceCode;
  if (normalizedField.includes("province_name")) return location.provinceName;
  if (normalizedField.includes("city_code")) return location.cityCode;
  if (normalizedField.includes("city_name")) return location.cityName;
  if (normalizedField.includes("district_code") || normalizedField.includes("county_code")) return location.districtCode;
  if (normalizedField.includes("district_name") || normalizedField.includes("county_name")) return location.districtName;
  if (normalizedField.includes("address")) return /(merchant|shop|store|company)/i.test(normalizedField) ? context.merchant.address : context.person.address;
  if (/(company_name|org_name|enterprise_name|supplier_name)/i.test(normalizedField)) return context.merchant.companyName;
  if (/(merchant_name|seller_name)/i.test(normalizedField)) return context.merchant.merchantName;
  if (/(shop_name|store_name)/i.test(normalizedField)) return context.merchant.shopName;
  if (/(contact_name|owner_name|sales_name|auditor_name|operator_name)/i.test(normalizedField)) return context.merchant.contactName;
  if (/(user_name|member_name|customer_name|buyer_name|real_name|person_name|consumer_name)/i.test(normalizedField)) return context.person.name;
  if (normalizedField === "name") {
    if (["merchant", "product"].includes(context.archetype)) return context.archetype === "merchant" ? context.merchant.merchantName : context.product.productName;
    return context.person.name;
  }
  if (/(gender|sex)/i.test(normalizedField)) return context.person.gender;
  if (/(birthday|birth_date)/i.test(normalizedField)) return context.person.birthday;
  if (/(age)/i.test(normalizedField)) return context.person.age;
  if (/(occupation|job|role_name)/i.test(normalizedField)) return context.person.occupation;
  if (/(product_name|goods_name|service_name)/i.test(normalizedField)) return context.product.productName;
  if (/(brand_name)/i.test(normalizedField)) return context.product.brandName;
  if (/(category_name|category_label)/i.test(normalizedField)) return context.product.categoryName;
  if (/(sku_code|sku_no)/i.test(normalizedField)) return context.product.skuCode;
  if (/(product_code|goods_code|item_code)/i.test(normalizedField)) return context.product.productCode;
  if (/(order_no|order_code|trade_no|trade_code|serial_no|biz_no)/i.test(normalizedField)) return context.order.orderNo;
  if (/(payment_no|pay_no)/i.test(normalizedField)) return context.order.paymentNo;
  if (/(refund_no)/i.test(normalizedField)) return context.order.refundNo;
  if (/(waybill_no|logistics_no|shipping_no)/i.test(normalizedField)) return context.order.logisticsNo;
  if (/(channel)/i.test(normalizedField)) return context.order.channelCode;
  if (/(device)/i.test(normalizedField)) return context.order.deviceType;
  if (/(payment_method|pay_method)/i.test(normalizedField)) return context.order.paymentMethod;
  if (/(delivery_method|logistics_method|shipping_method)/i.test(normalizedField)) return context.order.logisticsMethod;
  if (/(reason|cause)/i.test(normalizedField)) return context.complaint.reason;
  if (/(title|remark|desc|summary|content|memo|note)/i.test(normalizedField)) return buildNarrativeText(fieldName, context, rowIndex);
  if (/(status)/i.test(normalizedField)) return buildStatusValue(normalizedField, context);

  if (isNumericColumnType(columnType)) {
    if (/(quantity|qty|item_count|goods_count)/i.test(normalizedField)) return context.order.quantity;
    if (/(unit_price|sale_price|price)/i.test(normalizedField)) return context.product.unitPrice;
    if (/(cost_price|cost)/i.test(normalizedField)) return context.product.costPrice;
    if (/(discount_amount|coupon_amount)/i.test(normalizedField)) return context.order.discountAmount;
    if (/(freight_amount|postage_amount|shipping_amount)/i.test(normalizedField)) return context.order.freightAmount;
    if (/(refund_amount)/i.test(normalizedField)) return context.order.refundAmount;
    if (/(pay_amount|actual_amount|paid_amount|settlement_amount|receipt_amount)/i.test(normalizedField)) return context.order.payableAmount;
    if (/(order_amount|trade_amount|total_amount|amount|fee)/i.test(normalizedField)) return context.order.orderAmount;
    if (/(age)/i.test(normalizedField)) return context.person.age;
    if (/(score)/i.test(normalizedField)) return seededInteger(buildSeed(table.logicalTableName, rowIndex), normalizedField, 80, 99);
    if (/(rate|ratio)/i.test(normalizedField)) return Number((seededInteger(buildSeed(table.logicalTableName, rowIndex), normalizedField, 1, 95) / 100).toFixed(2));
    if (/(count)/i.test(normalizedField)) return seededInteger(buildSeed(table.logicalTableName, rowIndex), normalizedField, 1, 20);
    return buildPreviewNumericId(`${table.logicalTableName}_${normalizedField}`, rowIndex);
  }

  if (normalizedField.endsWith("_code") || normalizedField.endsWith("_no") || normalizedField === "code") {
    const codeBase = primaryKeyValue != null ? `${table.logicalTableName}_${primaryKeyValue}` : `${table.logicalTableName}_${normalizedField}`;
    return buildPreviewCode(codeBase, rowIndex);
  }
  if (normalizedField.endsWith("_name")) {
    return `${logicalTable?.tableLabel || table.logicalLabel || table.logicalTableName}样本${rowIndex + 1}`;
  }

  return `${logicalTable?.tableLabel || table.logicalLabel || table.logicalTableName}记录${rowIndex + 1}`;
}

function allocateTableVolumes(physicalTables, logicalTableMap, options) {
  const businessTables = physicalTables
    .filter((table) => table.tableKind === "BUSINESS")
    .map((table) => ({
      ...table,
      logicalLabel: logicalTableMap.get(String(table.logicalTableName || ""))?.tableLabel || table.logicalLabel || table.logicalTableName,
      businessRole: table.businessRole || logicalTableMap.get(String(table.logicalTableName || ""))?.businessRole || inferBusinessRole(table.logicalTableName),
    }));
  return {
    initialRows: distributeVolumeByWeight(businessTables, options.initialDataVolume, (table) => computeTableDistributionWeight(table, "initial")),
    incrementalRows: distributeVolumeByWeight(businessTables, options.incrementalDataVolume, (table) => computeTableDistributionWeight(table, "incremental")),
  };
}

function buildRelatedRowsForCurrentRow(tableName, rowIndex, relations, rowsByTable, row) {
  const relatedRows = {};
  const tableRelations = relations.filter((relation) => String(relation?.fromTable || "") === String(tableName || ""));
  for (const relation of tableRelations) {
    const parentRows = rowsByTable.get(String(relation?.toTable || "")) || [];
    if (parentRows.length === 0) continue;
    const parentIndex = seededInteger(
      buildSeed(tableName, rowIndex, relation?.toTable || ""),
      relation?.fromField || relation?.toField || "relation",
      0,
      parentRows.length - 1
    );
    const parentRow = parentRows[parentIndex];
    if (!parentRow) continue;
    row[String(relation?.fromField || "")] = parentRow[String(relation?.toField || "")];
    relatedRows[String(relation?.toTable || "")] = parentRow;
  }
  return relatedRows;
}

function buildQualifiedTableReference(dbType, tableName, schema) {
  if (dbType === "postgresql" && schema) {
    return `${quoteIdentifier(dbType, schema)}.${quoteIdentifier(dbType, tableName)}`;
  }
  return quoteIdentifier(dbType, tableName);
}

function buildInsertDeleteStatement(dataSource, tableName) {
  const dbType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  const qualifiedTableName = buildQualifiedTableReference(
    dbType,
    tableName,
    dbType === "postgresql" ? dataSource.connectionConfig.schema : null
  );
  return `DELETE FROM ${qualifiedTableName}`;
}

function normalizeDictionaryComparableValue(value) {
  const rawValue = String(value == null ? "" : value).trim();
  return normalizeCode(rawValue, "") || rawValue.toLowerCase();
}

function resolveDictionaryExpectedValue(fieldName, context) {
  const normalizedField = normalizeCode(fieldName, "");
  if (!normalizedField) return null;
  if (context.emergency) {
    if (/(plan_type)/i.test(normalizedField)) return context.emergency.planTypeLabel;
    if (/(response_level)/i.test(normalizedField)) return context.emergency.responseLevelLabel;
    if (/(resource_type)/i.test(normalizedField)) return context.emergency.resourceTypeLabel;
  }
  if (/(payment_status|pay_status)/i.test(normalizedField)) return context.order.paymentStatus;
  if (/(delivery_status|shipping_status|logistics_status)/i.test(normalizedField)) return context.order.deliveryStatus;
  if (/(order_status|trade_status|biz_status|status)/i.test(normalizedField)) return buildStatusValue(normalizedField, context);
  if (/(payment_method|pay_method)/i.test(normalizedField)) return context.order.paymentMethod;
  if (/(delivery_method|shipping_method|logistics_method)/i.test(normalizedField)) return context.order.logisticsMethod;
  if (/(channel)/i.test(normalizedField)) return context.order.channelCode;
  if (/(device)/i.test(normalizedField)) return context.order.deviceType;
  if (/(reason|cause)/i.test(normalizedField)) return context.complaint.reason;
  if (/(gender|sex)/i.test(normalizedField)) return context.person.gender;
  if (/(merchant_category|shop_category|store_category)/i.test(normalizedField)) return context.merchant.categoryName;
  if (/(category)/i.test(normalizedField)) return context.product.categoryName;
  return null;
}

function resolveDictionaryValue({ fieldName, dictRows, context, rowIndex }) {
  if (!Array.isArray(dictRows) || dictRows.length === 0) return null;
  const normalizedField = normalizeCode(fieldName, "");
  const preferLabelValue = Boolean(
    context.emergency
    && /(plan_type|resource_type|response_level)/i.test(normalizedField)
  );
  const preferredValue = resolveDictionaryExpectedValue(fieldName, context);
  const normalizedPreferredValue = normalizeDictionaryComparableValue(preferredValue);
  if (normalizedPreferredValue) {
    const matchedRow = dictRows.find((item) => {
      const codeValue = normalizeDictionaryComparableValue(item?.item_code);
      const labelValue = normalizeDictionaryComparableValue(item?.item_label);
      return codeValue === normalizedPreferredValue || labelValue === normalizedPreferredValue;
    });
    if (matchedRow) {
      return (preferLabelValue || /(name|label)$/.test(normalizedField)) ? matchedRow.item_label : matchedRow.item_code;
    }
  }
  const pickedRow = dictRows[seededInteger(buildSeed(fieldName, rowIndex, context.archetype), "dict_item", 0, dictRows.length - 1)];
  return (preferLabelValue || /(name|label)$/.test(normalizedField)) ? pickedRow?.item_label ?? null : pickedRow?.item_code ?? null;
}

function buildPrimaryKeyValue(table, rowIndex) {
  const primaryKeyColumn = inferPrimaryKeyColumn(table);
  if (!primaryKeyColumn?.columnName) return null;
  return isNumericColumnType(primaryKeyColumn.columnType)
    ? buildPreviewNumericId(`${table.logicalTableName}_${primaryKeyColumn.columnName}`, rowIndex)
    : buildPreviewCode(`${table.logicalTableName}_${primaryKeyColumn.columnName}`, rowIndex);
}

function buildGenerationPlanArtifacts(instance, physicalVersion, logicalModel, options) {
  const physicalModel = physicalVersion?.physicalModel && typeof physicalVersion.physicalModel === "object"
    ? physicalVersion.physicalModel
    : null;
  if (!physicalModel) {
    throw new AppError("\u7269\u7406\u6a21\u578b\u5feb\u7167\u4e0d\u5b58\u5728", 400);
  }

  const generatedAt = new Date().toISOString();
  const dictTables = Array.isArray(logicalModel?.dictTables) ? logicalModel.dictTables : [];
  const logicalTableMap = new Map(
    (Array.isArray(logicalModel?.tables) ? logicalModel.tables : []).map((table) => [String(table?.tableName || ""), table])
  );
  const dictTableMap = new Map(dictTables.map((dictTable) => [String(dictTable?.dictType || ""), dictTable]));
  const relations = Array.isArray(physicalModel?.relations) ? physicalModel.relations : [];
  const physicalTables = Array.isArray(physicalModel?.tables) ? physicalModel.tables : [];
  const physicalTableMap = new Map(physicalTables.map((table) => [String(table?.logicalTableName || ""), table]));
  const volumePlan = allocateTableVolumes(physicalTables, logicalTableMap, options);
  const initialRowsByTable = volumePlan.initialRows;
  const incrementalRowsByTable = volumePlan.incrementalRows;
  const orderedTableNames = sortTablesForPreview(physicalTables.filter((table) => table.tableKind === "BUSINESS"), relations);
  const deployTarget = physicalVersion.deployTarget || instance.deployTarget || null;
  const previewTables = [];
  const rowsByTable = new Map();
  const loadTables = [];

  for (const dictTable of dictTables) {
    const physicalTable = physicalTableMap.get(String(dictTable?.dictType || ""));
    if (!physicalTable) continue;
    const dictItems = Array.isArray(dictTable?.items) ? dictTable.items : [];
    const dictRows = (dictItems.length > 0 ? dictItems : buildFallbackDictionaryPreviewRows(dictTable, options.sampleRowsPerTable))
      .map((item, index) => ({
        item_code: item?.itemCode || buildPreviewCode(dictTable?.dictType || "DICT", index),
        item_label: item?.itemLabel || `${dictTable?.dictName || dictTable?.dictType || "Dictionary"} ${index + 1}`,
        category_code: dictTable?.categoryCode || null,
        value_range_json: item?.valueRange ?? null,
        sort_order: index + 1,
      }));
    const previewRows = dictRows.slice(0, options.sampleRowsPerTable);
    rowsByTable.set(String(dictTable?.dictType || ""), dictRows);
    loadTables.push({
      tableKind: "DICTIONARY",
      logicalTableName: String(dictTable?.dictType || ""),
      physicalTableName: physicalTable.physicalTableName,
      table: physicalTable,
      rows: dictRows,
    });
    previewTables.push({
      tableKind: "DICTIONARY",
      logicalTableName: String(dictTable?.dictType || ""),
      logicalLabel: String(dictTable?.dictName || dictTable?.dictType || ""),
      physicalTableName: physicalTable.physicalTableName,
      businessRole: "DICTIONARY",
      rowCountTarget: dictRows.length,
      previewRowCount: previewRows.length,
      columns: (Array.isArray(physicalTable.columns) ? physicalTable.columns : []).map((column) => String(column?.columnName || "")),
      rows: previewRows,
    });
  }

  for (const tableName of orderedTableNames) {
    const physicalTable = physicalTableMap.get(String(tableName || ""));
    const logicalTable = logicalTableMap.get(String(tableName || "")) || {};
    if (!physicalTable) continue;
    const rowCountTarget = Number(initialRowsByTable.get(String(tableName || "")) || 0);
    const tableRelations = relations.filter((relation) => String(relation?.fromTable || "") === String(tableName || ""));
    const dictionaryBindings = new Map();
    for (const column of physicalTable.columns || []) {
      if (isTemporalField(column)) continue;
      const sourceFieldName = String(column?.sourceFieldName || column?.columnName || "");
      const matchedDictTable = inferDictionaryMatch(sourceFieldName, dictTables);
      if (matchedDictTable) {
        dictionaryBindings.set(sourceFieldName, String(matchedDictTable?.dictType || ""));
        dictionaryBindings.set(String(column?.columnName || ""), String(matchedDictTable?.dictType || ""));
      }
    }

    const tableRows = Array.from({ length: rowCountTarget }, (_, rowIndex) => {
      const row = {};
      const primaryKeyValue = buildPrimaryKeyValue(physicalTable, rowIndex);
      const primaryKeyColumn = inferPrimaryKeyColumn(physicalTable);
      if (primaryKeyColumn?.columnName && primaryKeyValue != null) {
        row[primaryKeyColumn.columnName] = primaryKeyValue;
      }
      const relatedRows = buildRelatedRowsForCurrentRow(tableName, rowIndex, relations, rowsByTable, row);
      const context = buildRowBusinessContext({
        table: physicalTable,
        row,
        rowIndex,
        relatedRows,
        options,
        instance,
        logicalTable,
      });
      for (const column of physicalTable.columns || []) {
        const columnName = String(column?.columnName || "");
        const sourceFieldName = String(column?.sourceFieldName || columnName);
        if (!columnName) continue;
        if (row[columnName] !== undefined && row[columnName] !== null && row[columnName] !== "") {
          continue;
        }

        const relation = tableRelations.find((item) =>
          String(item?.fromField || "") === sourceFieldName || String(item?.fromField || "") === columnName
        );
        if (relation) {
          const referencedRows = rowsByTable.get(String(relation?.toTable || "")) || [];
          const referencedRow = relatedRows[String(relation?.toTable || "")]
            || referencedRows[seededInteger(
              buildSeed(tableName, rowIndex, relation?.toTable || ""),
              relation?.fromField || relation?.toField || "parent",
              0,
              Math.max(0, referencedRows.length - 1)
            )];
          const referencedValue = referencedRow?.[String(relation?.toField || "")];
          if (referencedValue !== undefined) {
            row[columnName] = referencedValue;
            continue;
          }
        }

        const dictType = dictionaryBindings.get(sourceFieldName) || dictionaryBindings.get(columnName);
        if (dictType) {
          const dictRows = rowsByTable.get(String(dictType || "")) || [];
          const dictValue = resolveDictionaryValue({
            fieldName: sourceFieldName,
            dictRows,
            context,
            rowIndex,
          });
          if (dictValue !== undefined && dictValue !== null && dictValue !== "") {
            row[columnName] = dictValue;
            continue;
          }
        }

        row[columnName] = buildRealisticScalarValue({
          fieldName: sourceFieldName,
          columnType: column?.columnType,
          rowIndex,
          row,
          table: physicalTable,
          logicalTable,
          context,
        });
      }

      if (primaryKeyColumn?.columnName && row[primaryKeyColumn.columnName] == null) {
        row[primaryKeyColumn.columnName] = buildPrimaryKeyValue(physicalTable, rowIndex);
      }

      return row;
    });

    const previewRows = tableRows.slice(0, options.sampleRowsPerTable);
    rowsByTable.set(String(tableName || ""), tableRows);
    loadTables.push({
      tableKind: "BUSINESS",
      logicalTableName: physicalTable.logicalTableName,
      physicalTableName: physicalTable.physicalTableName,
      table: physicalTable,
      rows: tableRows,
    });
    previewTables.push({
      tableKind: "BUSINESS",
      logicalTableName: physicalTable.logicalTableName,
      logicalLabel: logicalTable?.tableLabel || physicalTable.logicalLabel || physicalTable.logicalTableName,
      physicalTableName: physicalTable.physicalTableName,
      businessRole: physicalTable.businessRole || logicalTable?.businessRole || inferBusinessRole(physicalTable.logicalTableName),
      rowCountTarget,
      previewRowCount: previewRows.length,
      columns: (Array.isArray(physicalTable.columns) ? physicalTable.columns : []).map((column) => String(column?.columnName || "")),
      rows: previewRows,
    });
  }

  const physicalTablePlans = physicalTables.map((physicalTable) => {
    const dictTable = dictTableMap.get(String(physicalTable?.logicalTableName || ""));
    const logicalTable = logicalTableMap.get(String(physicalTable?.logicalTableName || ""));
    const dependencyTables = uniqueBy(
      relations
        .filter((relation) => String(relation?.fromTable || "") === String(physicalTable?.logicalTableName || ""))
        .map((relation) => ({ value: String(relation?.toTable || "") }))
        .filter((item) => item.value),
      (item) => item.value
    ).map((item) => item.value);
    const dictionaryBindings = uniqueBy(
      (Array.isArray(physicalTable?.columns) ? physicalTable.columns : [])
        .map((column) => {
          if (isTemporalField(column)) return null;
          const sourceFieldName = String(column?.sourceFieldName || column?.columnName || "");
          const matchedDictTable = inferDictionaryMatch(sourceFieldName, dictTables);
          return matchedDictTable
            ? { fieldName: sourceFieldName, dictType: String(matchedDictTable?.dictType || "") }
            : null;
        })
        .filter(Boolean),
      (item) => `${item.fieldName}:${item.dictType}`
    );
    return {
      tableKind: physicalTable.tableKind,
      logicalTableName: physicalTable.logicalTableName,
      logicalLabel: logicalTable?.tableLabel || dictTable?.dictName || physicalTable.logicalLabel || physicalTable.logicalTableName,
      physicalTableName: physicalTable.physicalTableName,
      businessRole: physicalTable.businessRole || logicalTable?.businessRole || "DICTIONARY",
      entityTier: physicalTable.tableKind === "BUSINESS" ? inferEntityTier({
        logicalTableName: physicalTable.logicalTableName,
        logicalLabel: logicalTable?.tableLabel || physicalTable.logicalLabel,
        businessRole: physicalTable.businessRole || logicalTable?.businessRole,
      }) : "dictionary",
      distributionWeight: physicalTable.tableKind === "BUSINESS"
        ? Number(computeTableDistributionWeight({
          logicalTableName: physicalTable.logicalTableName,
          logicalLabel: logicalTable?.tableLabel || physicalTable.logicalLabel,
          businessRole: physicalTable.businessRole || logicalTable?.businessRole,
        }, "initial").toFixed(2))
        : 0,
      primaryKey: inferPrimaryKeyColumn(physicalTable)?.columnName || null,
      dependencyTables,
      dictionaryBindings,
      targetRows: physicalTable.tableKind === "DICTIONARY"
        ? Number((rowsByTable.get(String(physicalTable?.logicalTableName || "")) || []).length)
        : Number(initialRowsByTable.get(String(physicalTable?.logicalTableName || "")) || 0),
      incrementalRowsPerCycle: physicalTable.tableKind === "BUSINESS"
        ? Number(incrementalRowsByTable.get(String(physicalTable?.logicalTableName || "")) || 0)
        : 0,
      loadedRows: Number((rowsByTable.get(String(physicalTable?.logicalTableName || "")) || []).length),
      previewRows: previewTables.find((item) => item.logicalTableName === physicalTable.logicalTableName)?.previewRowCount || 0,
    };
  });

  const phaseDefinitions = [
    { phaseKey: "dictionary", phaseLabel: "\u5b57\u5178\u4e0e\u53c2\u8003\u6570\u636e", filter: (item) => item.tableKind === "DICTIONARY" },
    { phaseKey: "shared_master", phaseLabel: "\u5171\u4eab\u4e3b\u6570\u636e", filter: (item) => item.entityTier === "shared_master" },
    { phaseKey: "business_master", phaseLabel: "\u7cfb\u7edf\u4e3b\u6570\u636e", filter: (item) => item.entityTier === "business_master" },
    { phaseKey: "transaction", phaseLabel: "\u4e1a\u52a1\u4e8b\u4ef6\u4e0e\u4ea4\u6613\u6d41\u7a0b", filter: (item) => item.entityTier === "event" },
  ];

  const generationPlan = {
    meta: {
      generatedAt,
      generatorMode: "scenario_realistic_v2",
      instanceId: instance.id,
      instanceName: instance.instanceName,
      instanceCode: instance.instanceCode,
      physicalVersionNo: physicalVersion.versionNo,
      logicalVersionNo: physicalVersion.logicalVersionNo,
      dbType: physicalVersion.dbType,
      deployTarget,
    },
    sizing: {
      initialDataVolume: options.initialDataVolume,
      incrementalDataVolume: options.incrementalDataVolume,
      incrementCycleDays: options.incrementCycleDays,
      sampleRowsPerTable: options.sampleRowsPerTable,
      timeline: {
        startAt: options.timelineStartAt,
        days: options.timelineDays,
      },
    },
    phases: phaseDefinitions.map((phase) => {
      const matchedTablePlans = physicalTablePlans.filter(phase.filter);
      return {
        phaseKey: phase.phaseKey,
        phaseLabel: phase.phaseLabel,
        tableCount: matchedTablePlans.length,
        targetRows: matchedTablePlans.reduce((sum, item) => sum + Number(item.targetRows || 0), 0),
        incrementalRowsPerCycle: matchedTablePlans.reduce((sum, item) => sum + Number(item.incrementalRowsPerCycle || 0), 0),
      };
    }),
    tablePlans: physicalTablePlans,
  };

  const samplePreview = {
    meta: {
      generatedAt,
      instanceId: instance.id,
      physicalVersionNo: physicalVersion.versionNo,
      sampleRowsPerTable: options.sampleRowsPerTable,
      deployTarget,
    },
    tables: previewTables,
  };

  generationPlan.summary = buildGenerationPlanSummary(generationPlan, samplePreview);
  samplePreview.summary = buildGenerationPlanSummary(generationPlan, samplePreview);

  return {
    generationPlan,
    samplePreview,
    loadTables,
  };
}

const DIRTY_CATEGORY_META = {
  D1: {
    code: "D1",
    label: "\u5173\u952e\u5b57\u6bb5\u7f3a\u5931\u4e0e\u9519\u586b",
    rootCause: "\u4eba\u5de5\u5f55\u5165\u6f0f\u586b\u6216\u56de\u586b\u9519\u8bef",
    injectionPoint: "manual_entry",
    severity: "high",
    impactScope: "single_record",
    recoverable: true,
    defaultWeight: 24,
  },
  D2: {
    code: "D2",
    label: "\u683c\u5f0f\u4e0d\u89c4\u8303\u4e0e\u7f16\u7801\u4e0d\u7edf\u4e00",
    rootCause: "ETL \u6620\u5c04\u4e0e\u683c\u5f0f\u6807\u51c6\u672a\u5bf9\u9f50",
    injectionPoint: "etl_landing",
    severity: "medium",
    impactScope: "single_field",
    recoverable: true,
    defaultWeight: 20,
  },
  D3: {
    code: "D3",
    label: "\u91cd\u590d\u4e0e\u8fd1\u91cd\u590d",
    rootCause: "\u6279\u91cf\u5bfc\u5165\u53bb\u91cd\u4e0d\u8db3",
    injectionPoint: "batch_import",
    severity: "high",
    impactScope: "entity_duplicate",
    recoverable: true,
    defaultWeight: 18,
  },
  D4: {
    code: "D4",
    label: "\u5173\u8054\u5173\u7cfb\u7f3a\u5931\u6216\u5931\u6548",
    rootCause: "\u4e3b\u6570\u636e\u6620\u5c04\u7f3a\u6f0f\u6216\u5173\u8054\u952e\u5931\u6548",
    injectionPoint: "master_data_mapping",
    severity: "high",
    impactScope: "cross_table",
    recoverable: true,
    defaultWeight: 16,
  },
  D5: {
    code: "D5",
    label: "\u72b6\u6001\u94fe\u4e0e\u65f6\u95f4\u94fe\u5f02\u5e38",
    rootCause: "\u6d41\u7a0b\u56de\u586b\u4e0e\u72b6\u6001\u63a8\u6f14\u65f6\u5e8f\u9519\u4f4d",
    injectionPoint: "workflow_callback",
    severity: "high",
    impactScope: "business_chain",
    recoverable: true,
    defaultWeight: 12,
  },
  D6: {
    code: "D6",
    label: "\u8de8\u7cfb\u7edf\u540c\u6b65\u4e0d\u4e00\u81f4",
    rootCause: "\u591a\u7cfb\u7edf\u540c\u6b65\u5ef6\u8fdf\u6216\u6807\u8bc6\u6f02\u79fb",
    injectionPoint: "system_sync",
    severity: "medium",
    impactScope: "cross_system",
    recoverable: true,
    defaultWeight: 10,
  },
};

const DEFAULT_DIRTY_CATEGORIES = Object.keys(DIRTY_CATEGORY_META);

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDirtyPlanOptions(payload = {}) {
  const focusCategories = normalizeStringArray(payload?.focusCategories, 8)
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item) => DIRTY_CATEGORY_META[item]);
  const dirtyRatio = Number(payload?.dirtyRatio);
  const normalizedDirtyRatio = Number.isFinite(dirtyRatio)
    ? Math.min(0.5, Math.max(0.01, Number(dirtyRatio.toFixed(4))))
    : 0.08;
  return {
    generationVersionNo: payload?.generationVersionNo ? Number(payload.generationVersionNo) : null,
    dirtyRatio: normalizedDirtyRatio,
    focusCategories: focusCategories.length > 0 ? focusCategories : DEFAULT_DIRTY_CATEGORIES,
  };
}

function isTemporalField(column) {
  const fieldName = String(column?.sourceFieldName || column?.columnName || "");
  return isDateColumnType(column?.columnType)
    || isDateTimeColumnType(column?.columnType)
    || /(date|time|_at)$/i.test(fieldName);
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim().toLowerCase();
}

function buildMissingReferenceValue(columnType, tableName, fieldName, rowIndex) {
  if (isNumericColumnType(columnType)) {
    return buildPreviewNumericId(`${tableName}_${fieldName}_missing_ref`, rowIndex) + 9000000;
  }
  return `MISSING_REF_${String(rowIndex + 1).padStart(4, "0")}`;
}

function buildFormatDriftValue(fieldName, columnType, truthValue, rowIndex) {
  const normalizedField = normalizeCode(fieldName, "");
  if (normalizedField.includes("mobile") || normalizedField.includes("phone")) {
    return `138-ABCD-${String(rowIndex + 1).padStart(4, "0")}`;
  }
  if (normalizedField.includes("email")) {
    return `invalid_${rowIndex + 1}#example.com`;
  }
  if (normalizedField.includes("id_card")) {
    return `ID${String(rowIndex + 1).padStart(10, "0")}`;
  }
  if (isDateColumnType(columnType) || normalizedField.endsWith("_date")) {
    return "2026/99/99";
  }
  if (isDateTimeColumnType(columnType) || normalizedField.endsWith("_time") || normalizedField.endsWith("_at")) {
    return "2026/99/99 25:61:00";
  }
  if (normalizedField.endsWith("_code") || normalizedField.endsWith("_status") || normalizedField.endsWith("_type")) {
    return ` legacy_${normalizeCode(truthValue, "value")} `;
  }
  if (isNumericColumnType(columnType)) {
    return "N/A";
  }
  return ` ${String(truthValue || "").trim()} `;
}

function buildSyncDriftValue(fieldName, columnType, truthValue, rowIndex) {
  const normalizedField = normalizeCode(fieldName, "");
  if (isNumericColumnType(columnType)) {
    return Number(buildPreviewNumericId(`${normalizedField || "sync"}_drift`, rowIndex));
  }
  if (normalizedField.includes("mobile") || normalizedField.includes("phone")) {
    return `139${String(20000000 + rowIndex).slice(-8)}`;
  }
  if (normalizedField.includes("status")) {
    return `LEGACY_${String(truthValue || "STATUS").toUpperCase()}`;
  }
  return `${String(truthValue || normalizedField || "value")}_legacy`;
}

function buildTimelineViolationValue(previousValue) {
  const parsed = new Date(previousValue);
  if (!Number.isNaN(parsed.getTime())) {
    return formatPreviewDateTime(addDays(parsed.toISOString(), -2));
  }
  return "2025-01-01 00:00:00";
}

function createDirtyCandidate(payload) {
  const categoryMeta = DIRTY_CATEGORY_META[payload.category];
  if (!categoryMeta) return null;
  if (payload.truthValue === payload.observedValue) return null;
  return {
    category: payload.category,
    categoryLabel: categoryMeta.label,
    issueCode: payload.issueCode,
    issueLabel: payload.issueLabel,
    issueDescription: payload.issueDescription,
    tableKind: payload.tableKind,
    logicalTableName: payload.logicalTableName,
    physicalTableName: payload.physicalTableName,
    rowIndex: payload.rowIndex,
    rowKey: payload.rowKey,
    fieldName: payload.fieldName,
    relatedFieldName: payload.relatedFieldName || null,
    truthValue: payload.truthValue,
    observedValue: payload.observedValue,
    severity: categoryMeta.severity,
    rootCause: categoryMeta.rootCause,
    injectionPoint: categoryMeta.injectionPoint,
    impactScope: categoryMeta.impactScope,
    recoverable: categoryMeta.recoverable,
    selectionWeight: categoryMeta.defaultWeight,
    candidateKey: `${payload.logicalTableName}:${payload.rowIndex}:${payload.fieldName}:${payload.category}`,
    cellKey: `${payload.logicalTableName}:${payload.rowIndex}:${payload.fieldName}`,
  };
}

function buildDirtyCandidatesForTable(table, physicalTable, relationFieldSet = new Set()) {
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const columns = Array.isArray(physicalTable?.columns) ? physicalTable.columns : [];
  const primaryKeyColumn = inferPrimaryKeyColumn(physicalTable);
  const primaryKeyName = String(primaryKeyColumn?.columnName || table?.columns?.[0] || "id");
  const candidates = [];
  const temporalColumns = columns.filter((column) => isTemporalField(column) && !column.isPrimaryKey);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || {};
    const rowKey = row[primaryKeyName] == null ? `${table.logicalTableName}_${rowIndex + 1}` : row[primaryKeyName];

    if (temporalColumns.length >= 2) {
      const previousColumn = temporalColumns[0];
      const currentColumn = temporalColumns[1];
      const previousValue = row[String(previousColumn.columnName || "")];
      const currentValue = row[String(currentColumn.columnName || "")];
      if (previousValue != null && currentValue != null) {
        candidates.push(createDirtyCandidate({
          category: "D5",
          issueCode: "TIME_SEQUENCE_INVALID",
          issueLabel: "\u65f6\u95f4\u94fe\u5012\u6302",
          issueDescription: `\u5c06 ${String(currentColumn.columnName || "")} \u63d0\u524d\u5230 ${String(previousColumn.columnName || "")} \u4e4b\u524d`,
          tableKind: table.tableKind,
          logicalTableName: table.logicalTableName,
          physicalTableName: table.physicalTableName,
          rowIndex,
          rowKey,
          fieldName: String(currentColumn.columnName || ""),
          relatedFieldName: String(previousColumn.columnName || ""),
          truthValue: currentValue,
          observedValue: buildTimelineViolationValue(previousValue),
        }));
      }
    }

    for (const column of columns) {
      const columnName = String(column?.columnName || "");
      if (!columnName || column?.isPrimaryKey) continue;
      const fieldName = String(column?.sourceFieldName || columnName);
      const normalizedField = normalizeCode(fieldName, "");
      const truthValue = row[columnName];
      if (truthValue === null || truthValue === undefined || truthValue === "") continue;

      const importantField = !Boolean(column?.isNullable)
        || /(_id$|_code$|_name$|status|mobile|phone|email|amount|date|time|_at$)/.test(normalizedField);
      if (importantField) {
        candidates.push(createDirtyCandidate({
          category: "D1",
          issueCode: "REQUIRED_VALUE_MISSING",
          issueLabel: "\u5173\u952e\u503c\u7f3a\u5931",
          issueDescription: `\u5c06 ${columnName} \u7f6e\u4e3a\u7a7a\u503c`,
          tableKind: table.tableKind,
          logicalTableName: table.logicalTableName,
          physicalTableName: table.physicalTableName,
          rowIndex,
          rowKey,
          fieldName: columnName,
          truthValue,
          observedValue: null,
        }));
      }

      if (
        normalizedField.includes("mobile")
        || normalizedField.includes("phone")
        || normalizedField.includes("email")
        || normalizedField.includes("id_card")
        || normalizedField.endsWith("_code")
        || normalizedField.endsWith("_status")
        || normalizedField.endsWith("_type")
        || isTemporalField(column)
      ) {
        candidates.push(createDirtyCandidate({
          category: "D2",
          issueCode: "FORMAT_DRIFT",
          issueLabel: "\u683c\u5f0f\u6f02\u79fb",
          issueDescription: `\u5c06 ${columnName} \u6539\u4e3a\u4e0d\u89c4\u8303\u683c\u5f0f`,
          tableKind: table.tableKind,
          logicalTableName: table.logicalTableName,
          physicalTableName: table.physicalTableName,
          rowIndex,
          rowKey,
          fieldName: columnName,
          truthValue,
          observedValue: buildFormatDriftValue(fieldName, column?.columnType, truthValue, rowIndex),
        }));
      }

      if (
        rowIndex > 0
        && (
          normalizedField.endsWith("_code")
          || normalizedField.endsWith("_no")
          || normalizedField.includes("mobile")
          || normalizedField.includes("phone")
          || normalizedField.includes("email")
          || normalizedField.includes("name")
        )
      ) {
        const referenceValue = rows[rowIndex - 1]?.[columnName];
        if (referenceValue != null && normalizeComparableValue(referenceValue) !== normalizeComparableValue(truthValue)) {
          candidates.push(createDirtyCandidate({
            category: "D3",
            issueCode: "SEMANTIC_DUPLICATE",
            issueLabel: "\u8fd1\u91cd\u590d\u503c",
            issueDescription: `\u5c06 ${columnName} \u590d\u5236\u4e3a\u4e0a\u4e00\u884c\u53d6\u503c`,
            tableKind: table.tableKind,
            logicalTableName: table.logicalTableName,
            physicalTableName: table.physicalTableName,
            rowIndex,
            rowKey,
            fieldName: columnName,
            truthValue,
            observedValue: referenceValue,
          }));
        }
      }

      if (relationFieldSet.has(fieldName) || relationFieldSet.has(columnName) || normalizedField.endsWith("_id")) {
        candidates.push(createDirtyCandidate({
          category: "D4",
          issueCode: "FOREIGN_KEY_MISSING",
          issueLabel: "\u5173\u8054\u952e\u5931\u6548",
          issueDescription: `\u5c06 ${columnName} \u6539\u4e3a\u4e0d\u5b58\u5728\u7684\u5173\u8054\u503c`,
          tableKind: table.tableKind,
          logicalTableName: table.logicalTableName,
          physicalTableName: table.physicalTableName,
          rowIndex,
          rowKey,
          fieldName: columnName,
          truthValue,
          observedValue: buildMissingReferenceValue(column?.columnType, table.logicalTableName, columnName, rowIndex),
        }));
      }

      if (
        normalizedField.includes("source_system")
        || normalizedField.includes("source_channel")
        || normalizedField.includes("external")
        || normalizedField.includes("status")
        || normalizedField.endsWith("_code")
        || normalizedField.includes("merchant_name")
        || normalizedField.includes("customer_name")
        || normalizedField.includes("platform_name")
      ) {
        candidates.push(createDirtyCandidate({
          category: "D6",
          issueCode: "SYNC_MAPPING_DRIFT",
          issueLabel: "\u8de8\u7cfb\u7edf\u6620\u5c04\u6f02\u79fb",
          issueDescription: `\u5c06 ${columnName} \u6539\u4e3a\u65e7\u7cfb\u7edf\u4fa7\u8868\u793a`,
          tableKind: table.tableKind,
          logicalTableName: table.logicalTableName,
          physicalTableName: table.physicalTableName,
          rowIndex,
          rowKey,
          fieldName: columnName,
          truthValue,
          observedValue: buildSyncDriftValue(fieldName, column?.columnType, truthValue, rowIndex),
        }));
      }
    }
  }

  return candidates.filter(Boolean);
}

function selectDirtyCandidates(candidates, options, targetDirtyCellCount) {
  if (!Array.isArray(candidates) || candidates.length === 0 || targetDirtyCellCount <= 0) {
    return [];
  }
  const focusCategories = Array.isArray(options?.focusCategories) && options.focusCategories.length > 0
    ? options.focusCategories
    : DEFAULT_DIRTY_CATEGORIES;
  const buckets = new Map(
    focusCategories.map((category) => [
      category,
      candidates
        .filter((item) => item.category === category)
        .sort((left, right) =>
          String(left.logicalTableName).localeCompare(String(right.logicalTableName))
          || Number(left.rowIndex) - Number(right.rowIndex)
          || String(left.fieldName).localeCompare(String(right.fieldName))
        ),
    ])
  );
  const weightTotal = focusCategories.reduce((sum, category) => sum + Number(DIRTY_CATEGORY_META[category]?.defaultWeight || 1), 0) || 1;
  const selected = [];
  const usedCandidateKeys = new Set();
  const usedCellKeys = new Set();

  for (const category of focusCategories) {
    const bucket = buckets.get(category) || [];
    const categoryQuota = Math.max(
      1,
      Math.round(targetDirtyCellCount * (Number(DIRTY_CATEGORY_META[category]?.defaultWeight || 1) / weightTotal))
    );
    let picked = 0;
    for (const candidate of bucket) {
      if (selected.length >= targetDirtyCellCount || picked >= categoryQuota) break;
      if (usedCandidateKeys.has(candidate.candidateKey) || usedCellKeys.has(candidate.cellKey)) continue;
      selected.push(candidate);
      usedCandidateKeys.add(candidate.candidateKey);
      usedCellKeys.add(candidate.cellKey);
      picked += 1;
    }
  }

  if (selected.length < targetDirtyCellCount) {
    const extras = candidates
      .filter((candidate) => !usedCandidateKeys.has(candidate.candidateKey) && !usedCellKeys.has(candidate.cellKey))
      .sort((left, right) =>
        Number(DIRTY_CATEGORY_META[right.category]?.defaultWeight || 0) - Number(DIRTY_CATEGORY_META[left.category]?.defaultWeight || 0)
        || String(left.logicalTableName).localeCompare(String(right.logicalTableName))
        || Number(left.rowIndex) - Number(right.rowIndex)
      );
    for (const candidate of extras) {
      if (selected.length >= targetDirtyCellCount) break;
      selected.push(candidate);
      usedCandidateKeys.add(candidate.candidateKey);
      usedCellKeys.add(candidate.cellKey);
    }
  }

  return selected;
}

function buildDirtyDataArtifacts(instance, generationVersion, physicalVersion, options) {
  const samplePreview = generationVersion?.samplePreview && typeof generationVersion.samplePreview === "object"
    ? generationVersion.samplePreview
    : null;
  const physicalModel = physicalVersion?.physicalModel && typeof physicalVersion.physicalModel === "object"
    ? physicalVersion.physicalModel
    : null;
  if (!samplePreview || !physicalModel) {
    throw new AppError("\u810f\u6570\u636e\u65b9\u6848\u7f3a\u5c11\u53ef\u7528\u7684\u6837\u672c\u9884\u89c8\u6216\u7269\u7406\u6a21\u578b", 400);
  }

  const generatedAt = new Date().toISOString();
  const truthPreview = deepClone(samplePreview);
  const observedPreview = deepClone(samplePreview);
  const previewTables = Array.isArray(truthPreview?.tables) ? truthPreview.tables : [];
  const observedTables = Array.isArray(observedPreview?.tables) ? observedPreview.tables : [];
  const observedTableMap = new Map(observedTables.map((table) => [String(table?.logicalTableName || ""), table]));
  const physicalTableMap = new Map(
    (Array.isArray(physicalModel?.tables) ? physicalModel.tables : []).map((table) => [String(table?.logicalTableName || ""), table])
  );
  const relationFieldMap = new Map();

  for (const relation of Array.isArray(physicalModel?.relations) ? physicalModel.relations : []) {
    const fromTable = String(relation?.fromTable || "");
    const fromField = String(relation?.fromField || "");
    if (!fromTable || !fromField) continue;
    const currentSet = relationFieldMap.get(fromTable) || new Set();
    currentSet.add(fromField);
    relationFieldMap.set(fromTable, currentSet);
  }

  const businessTables = previewTables.filter((table) => table?.tableKind === "BUSINESS");
  const totalPreviewCells = businessTables.reduce(
    (sum, table) => sum + (Array.isArray(table?.rows) ? table.rows.reduce((rowSum, row) => rowSum + Object.keys(row || {}).length, 0) : 0),
    0
  );
  const candidates = businessTables.flatMap((table) =>
    buildDirtyCandidatesForTable(
      table,
      physicalTableMap.get(String(table?.logicalTableName || "")) || {
        logicalTableName: table.logicalTableName,
        columns: (Array.isArray(table?.columns) ? table.columns : []).map((columnName) => ({
          columnName,
          sourceFieldName: columnName,
          columnType: "VARCHAR(128)",
        })),
      },
      relationFieldMap.get(String(table?.logicalTableName || "")) || new Set()
    )
  );
  const targetDirtyCellCount = Math.min(
    candidates.length,
    Math.max(1, Math.round(totalPreviewCells * Number(options?.dirtyRatio || 0.08))),
    120
  );
  const selectedCandidates = selectDirtyCandidates(candidates, options, targetDirtyCellCount);

  if (selectedCandidates.length === 0) {
    throw new AppError("\u5f53\u524d\u6837\u672c\u6570\u636e\u672a\u627e\u5230\u53ef\u6ce8\u5165\u7684\u810f\u6570\u636e\u5019\u9009\u9879", 400);
  }

  const issuePlans = [];
  const tableIssueMap = new Map();
  const affectedRowsByTable = new Map();

  for (const candidate of selectedCandidates) {
    const observedTable = observedTableMap.get(String(candidate.logicalTableName || ""));
    const observedRow = observedTable?.rows?.[candidate.rowIndex];
    if (!observedTable || !observedRow) continue;
    observedRow[candidate.fieldName] = deepClone(candidate.observedValue);
    issuePlans.push({
      issueId: `dirty_${String(issuePlans.length + 1).padStart(4, "0")}`,
      category: candidate.category,
      categoryLabel: candidate.categoryLabel,
      issueCode: candidate.issueCode,
      issueLabel: candidate.issueLabel,
      issueDescription: candidate.issueDescription,
      logicalTableName: candidate.logicalTableName,
      physicalTableName: candidate.physicalTableName,
      rowIndex: candidate.rowIndex + 1,
      rowKey: candidate.rowKey,
      fieldName: candidate.fieldName,
      relatedFieldName: candidate.relatedFieldName,
      truthValue: candidate.truthValue,
      observedValue: candidate.observedValue,
      severity: candidate.severity,
      rootCause: candidate.rootCause,
      injectionPoint: candidate.injectionPoint,
      impactScope: candidate.impactScope,
      recoverable: candidate.recoverable,
    });
    const tableKey = String(candidate.logicalTableName || "");
    tableIssueMap.set(tableKey, (tableIssueMap.get(tableKey) || 0) + 1);
    const rowSet = affectedRowsByTable.get(tableKey) || new Set();
    rowSet.add(candidate.rowIndex);
    affectedRowsByTable.set(tableKey, rowSet);
  }

  const tableIssueStats = previewTables.map((table) => {
    const logicalTableName = String(table?.logicalTableName || "");
    const dirtyIssueCount = Number(tableIssueMap.get(logicalTableName) || 0);
    const dirtyRowCount = Number((affectedRowsByTable.get(logicalTableName) || new Set()).size || 0);
    return {
      tableKind: table?.tableKind || "BUSINESS",
      logicalTableName,
      physicalTableName: table?.physicalTableName || "",
      previewRowCount: Array.isArray(table?.rows) ? table.rows.length : 0,
      dirtyIssueCount,
      dirtyRowCount,
      dirtyCellCount: dirtyIssueCount,
    };
  });

  for (const table of observedTables) {
    const logicalTableName = String(table?.logicalTableName || "");
    const stats = tableIssueStats.find((item) => item.logicalTableName === logicalTableName);
    table.dirtyIssueCount = Number(stats?.dirtyIssueCount || 0);
    table.dirtyRowCount = Number(stats?.dirtyRowCount || 0);
    table.dirtyCellCount = Number(stats?.dirtyCellCount || 0);
  }

  for (const table of previewTables) {
    const logicalTableName = String(table?.logicalTableName || "");
    const stats = tableIssueStats.find((item) => item.logicalTableName === logicalTableName);
    table.dirtyIssueCount = Number(stats?.dirtyIssueCount || 0);
    table.dirtyRowCount = Number(stats?.dirtyRowCount || 0);
    table.dirtyCellCount = Number(stats?.dirtyCellCount || 0);
  }

  const categorySummary = DEFAULT_DIRTY_CATEGORIES.map((category) => ({
    category,
    categoryLabel: DIRTY_CATEGORY_META[category].label,
    issueCount: issuePlans.filter((item) => item.category === category).length,
  })).filter((item) => item.issueCount > 0);
  const injectionPointSummary = uniqueBy(
    issuePlans.map((item) => ({ injectionPoint: item.injectionPoint })),
    (item) => item.injectionPoint
  ).map((item) => ({
    injectionPoint: item.injectionPoint,
    issueCount: issuePlans.filter((issue) => issue.injectionPoint === item.injectionPoint).length,
  }));
  const rootCauseSummary = uniqueBy(
    issuePlans.map((item) => ({ rootCause: item.rootCause })),
    (item) => item.rootCause
  ).map((item) => ({
    rootCause: item.rootCause,
    issueCount: issuePlans.filter((issue) => issue.rootCause === item.rootCause).length,
  }));
  const affectedTableCount = tableIssueStats.filter((item) => Number(item.dirtyIssueCount || 0) > 0).length;
  const affectedRowCount = [...affectedRowsByTable.values()].reduce((sum, rowSet) => sum + Number(rowSet.size || 0), 0);
  const dirtyRate = totalPreviewCells > 0 ? Number((issuePlans.length / totalPreviewCells).toFixed(4)) : 0;
  const previewRowCount = previewTables.reduce((sum, table) => sum + (Array.isArray(table?.rows) ? table.rows.length : 0), 0);

  const summary = {
    tableCount: previewTables.length,
    businessTableCount: previewTables.filter((table) => table?.tableKind === "BUSINESS").length,
    dictionaryTableCount: previewTables.filter((table) => table?.tableKind === "DICTIONARY").length,
    previewRowCount,
    totalPreviewCellCount: totalPreviewCells,
    issueCount: issuePlans.length,
    dirtyCellCount: issuePlans.length,
    affectedTableCount,
    affectedRowCount,
    dirtyRate,
    categorySummary,
    injectionPointSummary,
    rootCauseSummary,
  };

  const dirtyPlan = {
    meta: {
      generatedAt,
      instanceId: instance.id,
      instanceName: instance.instanceName,
      instanceCode: instance.instanceCode,
      generationVersionNo: generationVersion.versionNo,
      physicalVersionNo: generationVersion.physicalVersionNo,
      dirtyRatio: Number(options?.dirtyRatio || 0.08),
    },
    config: {
      dirtyRatio: Number(options?.dirtyRatio || 0.08),
      focusCategories: Array.isArray(options?.focusCategories) ? options.focusCategories : DEFAULT_DIRTY_CATEGORIES,
      categories: (Array.isArray(options?.focusCategories) ? options.focusCategories : DEFAULT_DIRTY_CATEGORIES).map((category) => DIRTY_CATEGORY_META[category]),
      selectionStrategy: "weighted_round_robin",
    },
    summary,
    issues: issuePlans,
  };

  truthPreview.summary = {
    ...(safeObject(truthPreview.summary)),
    tableCount: previewTables.length,
    previewRowCount,
  };
  observedPreview.summary = {
    ...(safeObject(observedPreview.summary)),
    ...summary,
  };

  const issuePreview = {
    meta: {
      generatedAt,
      instanceId: instance.id,
      generationVersionNo: generationVersion.versionNo,
      physicalVersionNo: generationVersion.physicalVersionNo,
    },
    summary,
    tables: tableIssueStats,
    issues: issuePlans,
  };

  return {
    dirtyPlan,
    truthPreview,
    observedPreview,
    issuePreview,
  };
}

function buildSourceAssetSnapshot(incubation, selectedCategoryCodes) {
  const categories = Array.isArray(incubation?.standardAssets?.researchCatalog?.categoryTree)
    ? incubation.standardAssets.researchCatalog.categoryTree
    : [];
  const dictionaries = Array.isArray(incubation?.standardAssets?.dictionaries)
    ? incubation.standardAssets.dictionaries
    : [];
  const codeSet = new Set((Array.isArray(selectedCategoryCodes) ? selectedCategoryCodes : []).map((item) => String(item || "").trim()).filter(Boolean));
  const selectedCategories = codeSet.size > 0
    ? categories.filter((item) => codeSet.has(String(item?.categoryCode || "").trim()))
    : categories;
  const selectedCodes = selectedCategories.map((item) => String(item?.categoryCode || "").trim()).filter(Boolean);
  const selectedCodeSet = new Set(selectedCodes);
  const selectedDictionaries = dictionaries.filter((item) => {
    const categoryCode = String(item?.categoryCode || "").trim();
    return !categoryCode || selectedCodeSet.has(categoryCode);
  });
  const candidateTableSpecs = uniqueBy(
    selectedCategories.flatMap((item) => (Array.isArray(item?.tableDetails) ? item.tableDetails : [])),
    (item) => String(item?.tableName || "").trim()
  );

  return {
    incubation: {
      id: Number(incubation?.id || 0),
      incubationName: incubation?.incubationName || "",
      industryCode: incubation?.industryCode || "",
    },
    categories: selectedCategories,
    categoryCodes: selectedCodes,
    candidateTableSpecs,
    dictionaries: selectedDictionaries,
    modulePlanner: {
      summary: incubation?.standardAssets?.researchCatalog?.summary || "",
      categories: selectedCategories.map((item) => ({
        categoryCode: item?.categoryCode || "",
        categoryName: item?.categoryName || item?.categoryCode || "",
        description: item?.description || "",
        tableScopes: Array.isArray(item?.tableScopes) ? item.tableScopes : [],
      })),
    },
  };
}

function buildRelations(tables) {
  const tableMap = new Map(
    (Array.isArray(tables) ? tables : []).map((table) => [String(table?.tableName || "").trim(), table])
  );
  const relations = [];

  for (const table of tables || []) {
    for (const field of table.fields || []) {
      const fieldName = String(field?.fieldName || "").trim();
      if (!fieldName.endsWith("_id")) continue;
      const target = [...tableMap.values()].find((candidate) =>
        candidate.tableName !== table.tableName
          && (candidate.fields || []).some((candidateField) => String(candidateField?.fieldName || "").trim() === fieldName)
      );
      if (!target) continue;
      relations.push({
        fromTable: table.tableName,
        fromField: fieldName,
        toTable: target.tableName,
        toField: fieldName,
        relationType: "N:1",
      });
    }
  }

  return uniqueBy(relations, (item) => `${item.fromTable}.${item.fromField}->${item.toTable}.${item.toField}`);
}

function buildInitialLogicalModel(payload, sourceAssetSnapshot) {
  const categories = Array.isArray(sourceAssetSnapshot?.categories) ? sourceAssetSnapshot.categories : [];
  const dictionaries = Array.isArray(sourceAssetSnapshot?.dictionaries) ? sourceAssetSnapshot.dictionaries : [];
  const candidateTableSpecs = Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs : [];

  const modules = categories.map((category) => ({
    moduleKey: String(category?.categoryCode || ""),
    moduleLabel: String(category?.categoryName || category?.categoryCode || ""),
    summary: String(category?.description || "").trim(),
    tableNames: uniqueBy(
      [
        ...(Array.isArray(category?.tableScopes) ? category.tableScopes.map((item) => ({ key: String(item || "").trim() })) : []),
        ...(Array.isArray(category?.tableDetails) ? category.tableDetails.map((item) => ({ key: String(item?.tableName || "").trim() })) : []),
      ],
      (item) => item.key
    ).map((item) => item.key),
  }));

  const tables = candidateTableSpecs.map((table, index) => ({
    tableName: String(table?.tableName || `table_${index + 1}`),
    tableLabel: String(table?.tableLabel || table?.tableName || `Table ${index + 1}`),
    tableComment: String(table?.tableComment || "").trim(),
    businessRole: inferBusinessRole(table?.tableName),
    fields: (Array.isArray(table?.fields) ? table.fields : []).map((fieldName, fieldIndex) => ({
      fieldName: String(fieldName || `field_${fieldIndex + 1}`),
      fieldType: buildFieldType(fieldName),
      required: fieldIndex === 0 || String(fieldName || "").endsWith("_id"),
      businessSemantic: String(fieldName || ""),
      fieldComment: String(fieldName || ""),
    })),
    keyInfoItems: Array.isArray(table?.keyInfoItems) ? table.keyInfoItems : [],
    sourceRefs: Array.isArray(table?.sourceRefs) ? table.sourceRefs : [],
  }));

  const dictTables = dictionaries.map((dictionary) => ({
    dictType: String(dictionary?.dictType || ""),
    dictName: String(dictionary?.dictName || dictionary?.dictType || ""),
    categoryCode: String(dictionary?.categoryCode || ""),
    sourceRefs: Array.isArray(dictionary?.sourceRefs) ? dictionary.sourceRefs : [],
    items: (Array.isArray(dictionary?.items) ? dictionary.items : []).map((item) => ({
      itemCode: String(item?.itemCode || ""),
      itemLabel: String(item?.itemLabel || ""),
      valueRange: item?.valueRange || null,
      sourceRefs: Array.isArray(item?.sourceRefs) ? item.sourceRefs : [],
    })),
  }));

  const relations = buildRelations(tables);

  return {
    meta: {
      templateName: payload.templateName,
      templateCode: payload.templateCode,
      generatedAt: new Date().toISOString(),
      generatedFrom: sourceAssetSnapshot?.incubation?.id ? "industry_incubation" : "manual",
    },
    blueprint: {
      industryCode: payload.industryCode || "",
      templateDesc: payload.templateDesc || "",
      sourceCategoryCodes: sourceAssetSnapshot?.categoryCodes || [],
      sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
    },
    modules,
    tables,
    dictTables,
    relations,
    summary: {
      moduleCount: modules.length,
      tableCount: tables.length,
      dictCount: dictTables.length,
      relationCount: relations.length,
      sourceCategoryCount: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes.length : 0,
    },
  };
}

function buildLogicalModelBuildInput(payload, sourceAssetSnapshot) {
  const categories = Array.isArray(sourceAssetSnapshot?.categories) ? sourceAssetSnapshot.categories : [];
  const candidateTableSpecs = Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs : [];
  const dictionaries = Array.isArray(sourceAssetSnapshot?.dictionaries) ? sourceAssetSnapshot.dictionaries : [];
  return {
    templateName: payload.templateName,
    templateCode: payload.templateCode,
    industryCode: payload.industryCode || "",
    templateDesc: payload.templateDesc || "",
    sourceIncubation: {
      id: Number(sourceAssetSnapshot?.incubation?.id || 0) || null,
      incubationName: String(sourceAssetSnapshot?.incubation?.incubationName || ""),
      industryCode: String(sourceAssetSnapshot?.incubation?.industryCode || payload.industryCode || ""),
    },
    sourceCategories: categories.map((category) => ({
      categoryCode: String(category?.categoryCode || ""),
      categoryName: String(category?.categoryName || category?.categoryCode || ""),
      description: String(category?.description || ""),
      tableScopes: Array.isArray(category?.tableScopes) ? category.tableScopes : [],
    })),
    sourceTables: candidateTableSpecs.map((table) => ({
      tableName: String(table?.tableName || ""),
      tableLabel: String(table?.tableLabel || table?.tableName || ""),
      tableComment: String(table?.tableComment || ""),
      keyInfoItems: Array.isArray(table?.keyInfoItems) ? table.keyInfoItems : [],
      fields: Array.isArray(table?.fields) ? table.fields : [],
      sourceRefs: Array.isArray(table?.sourceRefs) ? table.sourceRefs : [],
    })),
    sourceDictionaries: dictionaries.map((dictionary) => ({
      dictType: String(dictionary?.dictType || ""),
      dictName: String(dictionary?.dictName || dictionary?.dictType || ""),
      categoryCode: String(dictionary?.categoryCode || ""),
      items: (Array.isArray(dictionary?.items) ? dictionary.items : []).slice(0, 12).map((item) => ({
        itemCode: String(item?.itemCode || ""),
        itemLabel: String(item?.itemLabel || ""),
      })),
    })),
    outputContract: {
      allowedFieldTypes: Array.from(LOGICAL_MODEL_BUILD_ALLOWED_FIELD_TYPES),
      allowedRelationTypes: Array.from(LOGICAL_MODEL_BUILD_ALLOWED_RELATION_TYPES),
      fieldNamingRule: "fieldName 必须为英文 snake_case 技术字段名，fieldComment 必须为中文业务字段名。",
      relationRule: "relations 只允许引用 tables 中存在的 tableName 与 fieldName。",
    },
  };
}

async function getLogicalModelBuildProvider(preferredProvider = null) {
  if (preferredProvider) {
    return preferredProvider;
  }
  const [rows] = await pool.query(
    `SELECT id
       FROM model_providers
      WHERE model_category = 'chat'
        AND status = 'active'
      ORDER BY updated_at DESC, id DESC
      LIMIT 1`
  );
  if (!rows[0]?.id) {
    return null;
  }
  return modelProviderService.getModelProviderById(Number(rows[0].id));
}

function optimizeLogicalModelProvider(provider) {
  if (!provider || typeof provider !== "object") {
    return provider;
  }
  return {
    ...provider,
    extraConfig: {
      ...(provider.extraConfig || {}),
      disableInferenceFallback: true,
    },
  };
}

async function resolveLogicalModelBuildRuntimeOptions() {
  const promptConfig = await promptRuntime.resolveRuntimePromptConfig(
    "LOGICAL_MODEL_BUILD",
    {
      temperature: 0.2,
      maxTokens: 1200,
    },
    { input: "{{input}}" }
  );
  if (!promptConfig?.template) {
    throw new AppError("未配置逻辑模型构建提示词模板", 500);
  }
  if (!String(promptConfig.template?.content || "").trim()) {
    throw new AppError("逻辑模型构建系统提示词为空，请先在模型管理页面发布提示词", 500);
  }
  if (!String(promptConfig.template?.userContent || "").trim()) {
    throw new AppError("逻辑模型构建用户提示词为空，请先在模型管理页面发布提示词", 500);
  }
  const provider = optimizeLogicalModelProvider(await getLogicalModelBuildProvider(promptConfig.provider));
  return {
    provider,
    systemPrompt: promptConfig.systemPrompt,
    userPrompt: promptConfig.userPrompt,
    temperature: Number(promptConfig.temperature ?? 0.2),
    maxTokens: Number(promptConfig.maxTokens ?? 1200),
  };
}

async function resolvePhysicalDesignDocRuntimeOptions() {
  const promptConfig = await promptRuntime.resolveRuntimePromptConfig(
    "PHYSICAL_MODEL_DESIGN_DOC",
    {
      systemPrompt: promptDefaults.buildPhysicalDesignDocDefaultPrompt(),
      userPrompt: promptDefaults.buildPhysicalDesignDocDefaultUserPrompt(),
      temperature: 0.2,
      maxTokens: 2200,
    },
    { input: {} }
  );
  const provider = promptConfig.provider || optimizeLogicalModelProvider(await getLogicalModelBuildProvider());
  return {
    provider,
    systemPrompt: promptConfig.systemPrompt,
    userPrompt: promptConfig.userPrompt,
    temperature: Math.min(Number(promptConfig.temperature ?? 0.2), 0.4),
    maxTokens: Math.min(Number(promptConfig.maxTokens ?? 2200), 3200),
  };
}

function chunkArray(items, size) {
  const source = Array.isArray(items) ? items : [];
  const normalizedSize = Math.max(1, Number(size || 1));
  const result = [];
  for (let index = 0; index < source.length; index += normalizedSize) {
    result.push(source.slice(index, index + normalizedSize));
  }
  return result;
}

const TECHNICAL_FIELD_PHRASE_MAP = [
  ["统一社会信用代码", "credit_code"],
  ["社会信用代码", "credit_code"],
  ["许可证编号", "license_no"],
  ["许可申请编号", "license_application_no"],
  ["申请编号", "application_no"],
  ["审批编号", "approval_no"],
  ["审批结果", "approval_result"],
  ["审批状态", "approval_status"],
  ["审批日期", "approval_date"],
  ["审批时间", "approval_time"],
  ["申请日期", "application_date"],
  ["申请时间", "application_time"],
  ["申请人/单位名称", "applicant_name"],
  ["申请人/单位", "applicant"],
  ["申请人名称", "applicant_name"],
  ["申请人", "applicant"],
  ["单位名称", "organization_name"],
  ["单位地址", "organization_address"],
  ["证件类型", "certificate_type"],
  ["证件号码", "certificate_no"],
  ["证件编号", "certificate_no"],
  ["联系电话", "contact_phone"],
  ["联系地址", "contact_address"],
  ["联系人", "contact_name"],
  ["负责人姓名", "owner_name"],
  ["负责人", "owner_name"],
  ["手机号码", "mobile"],
  ["手机", "mobile"],
  ["电话号码", "phone"],
  ["电话", "phone"],
  ["电子邮箱", "email"],
  ["邮箱", "email"],
  ["场户名称", "farm_name"],
  ["场户编号", "farm_no"],
  ["场户地址", "farm_address"],
  ["场户", "farm"],
  ["养殖场名称", "farm_name"],
  ["养殖场地址", "farm_address"],
  ["养殖场类型", "farm_type"],
  ["养殖场", "farm"],
  ["养殖类型", "breeding_type"],
  ["养殖品种", "breeding_species"],
  ["养殖数量", "breeding_count"],
  ["养殖规模", "breeding_scale"],
  ["养殖面积", "breeding_area"],
  ["养殖", "breeding"],
  ["畜牧", "livestock"],
  ["动物疫病", "animal_epidemic"],
  ["动物防疫", "animal_quarantine"],
  ["监测结果", "monitor_result"],
  ["监测日期", "monitor_date"],
  ["监测时间", "monitor_time"],
  ["监测", "monitor"],
  ["记录编号", "record_no"],
  ["记录日期", "record_date"],
  ["记录时间", "record_time"],
  ["记录", "record"],
  ["台账编号", "ledger_no"],
  ["台账日期", "ledger_date"],
  ["台账", "ledger"],
  ["设施设备", "facility_equipment"],
  ["设施名称", "facility_name"],
  ["设备名称", "equipment_name"],
  ["设施", "facility"],
  ["设备", "equipment"],
  ["无害化处理", "harmless_disposal"],
  ["处理方式", "disposal_method"],
  ["处理结果", "disposal_result"],
  ["处理日期", "disposal_date"],
  ["处理时间", "disposal_time"],
  ["处理状态", "disposal_status"],
  ["许可类型", "license_type"],
  ["许可证", "license"],
  ["行政许可", "admin_license"],
  ["行政审批", "admin_approval"],
  ["审批", "approval"],
  ["申请", "application"],
  ["名称", "name"],
  ["编号", "no"],
  ["编码", "code"],
  ["代码", "code"],
  ["类型", "type"],
  ["状态", "status"],
  ["日期", "date"],
  ["时间", "time"],
  ["开始", "start"],
  ["结束", "end"],
  ["地址", "address"],
  ["区域", "region"],
  ["地区", "region"],
  ["品种", "species"],
  ["数量", "count"],
  ["总数", "count"],
  ["面积", "area"],
  ["重量", "weight"],
  ["金额", "amount"],
  ["比例", "ratio"],
  ["级别", "level"],
  ["来源", "source"],
  ["备注", "remark"],
  ["说明", "remark"],
  ["内容", "content"],
  ["结果", "result"],
];

function isPoorTechnicalFieldNameLegacy(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!isTechnicalFieldName(normalized)) {
    return true;
  }
  return /^field_\d+$/.test(normalized)
    || /^col\d+$/.test(normalized)
    || /^data\d*$/.test(normalized)
    || ["temp", "misc", "info", "value", "data", "field"].includes(normalized);
}

function dedupeTokensLegacy(tokens) {
  const seen = new Set();
  return tokens.filter((item) => {
    const token = normalizeCode(item, "");
    if (!token || seen.has(token)) {
      return false;
    }
    seen.add(token);
    return true;
  });
}

function buildTechnicalFieldNameFromLabelLegacy(fieldLabel, tableName, fieldIndex = 0) {
  const rawLabel = String(fieldLabel || "").trim();
  if (!rawLabel) {
    return `${normalizeCode(tableName, "field")}_field_${fieldIndex + 1}`;
  }
  const asciiCandidate = normalizeCode(rawLabel, "");
  if (asciiCandidate && /[a-z]/.test(asciiCandidate) && !isPoorTechnicalFieldNameLegacy(asciiCandidate)) {
    return asciiCandidate;
  }

  let remaining = rawLabel.replace(/[（）()【】\[\]，,：:、/\\\-]+/g, " ");
  const tokens = [];
  TECHNICAL_FIELD_PHRASE_MAP.forEach(([phrase, token]) => {
    if (remaining.includes(phrase)) {
      tokens.push(...String(token).split("_"));
      remaining = remaining.split(phrase).join(" ");
    }
  });

  if (/ID/i.test(rawLabel) && !tokens.includes("id")) {
    tokens.push("id");
  }
  if (rawLabel.includes("编号") && !tokens.includes("no")) {
    tokens.push("no");
  }
  if ((rawLabel.includes("编码") || rawLabel.includes("代码")) && !tokens.includes("code")) {
    tokens.push("code");
  }
  if (rawLabel.includes("名称") && !tokens.includes("name")) {
    tokens.push("name");
  }
  if (rawLabel.includes("状态") && !tokens.includes("status")) {
    tokens.push("status");
  }
  if ((rawLabel.includes("日期") || rawLabel.includes("时间")) && !tokens.includes("date") && !tokens.includes("time")) {
    tokens.push(rawLabel.includes("时间") ? "time" : "date");
  }

  const dedupedTokens = dedupeTokensLegacy(tokens);
  if (dedupedTokens.length > 0) {
    return normalizeCode(dedupedTokens.join("_"), "field");
  }

  const tableTokens = normalizeCode(tableName, "field").split("_").filter(Boolean).slice(-2);
  return normalizeCode(`${tableTokens.join("_") || "field"}_value_${fieldIndex + 1}`, "field");
}

function ensureUniqueTechnicalFieldNameLegacy(fieldName, usedNames) {
  const normalized = normalizeCode(fieldName, "field");
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return normalized;
  }
  let serial = 2;
  while (usedNames.has(`${normalized}_${serial}`)) {
    serial += 1;
  }
  const next = `${normalized}_${serial}`;
  usedNames.add(next);
  return next;
}

function inferLogicalFieldTypeFromSource(fieldLabel, fieldName) {
  const label = String(fieldLabel || "");
  const technicalFieldName = String(fieldName || "").toLowerCase();
  if (/是否|有无|启用|停用|标志/.test(label) || /^(is_|has_)/.test(technicalFieldName)) {
    return "BOOLEAN";
  }
  if (/日期/.test(label) && !/时间|时刻/.test(label)) {
    return "DATE";
  }
  if (/时间|时刻|更新时间|创建时间|审批时间|监测时间/.test(label) || /(_time|_at)$/.test(technicalFieldName)) {
    return "DATETIME";
  }
  if (/数量|总数|金额|面积|重量|比例|率|分值|次数|规模|容量/.test(label)) {
    return "NUMBER";
  }
  if (/编号|编码|代码|证件|证号|名称|地址|电话|手机|邮箱|状态|类型|结果/.test(label)) {
    return "STRING";
  }
  return buildFieldType(technicalFieldName);
}

function buildLogicalFieldBatchPromptLegacy() {
  return [
    "你是数据实验室场景管理的字段技术建模助手。",
    "只返回合法 JSON，不要输出 markdown，不要输出解释性文字。",
    "本轮只处理输入中的 tables 批次，不要输出 modules、dictTables、relations、warnings、summary。",
    "顶层字段固定为 tables。",
    "tables 为数组，每项必须包含 sourceTableName、tableName、businessRole、fields。",
    "tableName 必须沿用输入表名，不允许改写成其他表。",
    "fields 为数组，每项必须包含 sourceFieldLabel、fieldName、fieldType、required、fieldComment、businessSemantic。",
    "sourceFieldLabel 必须与输入 sourceFields 中的中文字段名一一对应，不允许丢失。",
    "fieldName 必须是英文 snake_case 技术字段名，禁止中文、禁止拼音整句、禁止 field_1、col1、temp、misc 等占位写法。",
    "fieldComment 必须直接返回对应中文字段名。",
    "fieldType 只能从 STRING、NUMBER、DATE、DATETIME、BOOLEAN、JSON 中选择。",
    "required 只返回 true 或 false。",
    "不要新增输入中不存在的字段。",
  ].join(" ");
}

function buildLogicalFieldBatchUserContent(promptInput, options = {}) {
  const retryReason = text(options?.retryReason, 512);
  const attemptIndex = Math.max(1, Number(options?.attemptIndex || 1));
  return [
    "请严格根据以下输入生成结果。",
    "必须保证 sourceFieldLabel 与输入 sourceFields 一一对应且顺序一致。",
    attemptIndex > 1
      ? `这是第 ${attemptIndex} 次重试。上次结果不合格，原因：${retryReason || "字段映射不完整或技术字段名不合规"}。请整体修正，不要只修一部分。`
      : "",
    JSON.stringify(promptInput, null, 2),
  ].filter(Boolean).join("\n\n");
}

function buildLogicalModelBuildUserPrompt(runtimeOptions, promptInput, fallbackBuilder, options = {}) {
  const configuredTemplate = String(runtimeOptions?.userPrompt || "").trim();
  if (!configuredTemplate) {
    return fallbackBuilder(promptInput, options);
  }
  const renderedPrompt = String(
    promptRuntime.renderPromptTemplate(configuredTemplate, { input: promptInput }) || ""
  ).trim();
  if (!renderedPrompt) {
    return fallbackBuilder(promptInput, options);
  }
  const promptParts = [renderedPrompt];
  if (!configuredTemplate.includes("{{input}}")) {
    promptParts.push(JSON.stringify(promptInput, null, 2));
  }
  const retryReason = text(options?.retryReason, 512);
  const attemptIndex = Math.max(1, Number(options?.attemptIndex || 1));
  if (attemptIndex > 1) {
    promptParts.push(`这是第 ${attemptIndex} 次重试。上次结果不合格，原因：${retryReason || "字段映射不完整或技术字段名不合规"}。请整体修正，不要只修一部分。`);
  }
  return promptParts.filter(Boolean).join("\n\n");
}

function buildLogicalFieldBatchInput(payload, sourceAssetSnapshot, tables, batchIndex, batchCount) {
  return {
    taskType: "FIELD_BATCH",
    stage: "field_generation",
    templateName: payload.templateName,
    industryCode: payload.industryCode || "",
    sourceCategoryCodes: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
    batchIndex,
    batchCount,
    outputContract: {
      topLevelFields: ["tables"],
      tableRequiredFields: ["sourceTableName", "tableName", "tableLabel", "tableComment", "businessRole", "fields"],
      fieldRequiredFields: ["sourceFieldLabel", "fieldName", "fieldType", "required", "fieldComment", "businessSemantic"],
      fieldNameRules: [
        "fieldName 必须符合主流关系型建模命名规范，优先使用 业务对象_属性 或 属性_限定词 结构。",
        "fieldName 必须是 ASCII 小写 snake_case，只能包含 a-z、0-9、下划线，且必须以字母开头。",
        "禁止输出裸字段名：name、no、code、type、status、time、date、region、value、data、info、field、temp、misc、url、weight。",
        "编号类字段要区分 *_code 与 *_no：分类编码/标准编码优先 *_code，业务单号/流水号优先 *_no。",
        "名称类字段必须带业务限定，如 product_name、brand_name，不允许只写 name。",
        "状态类字段必须带业务限定，如 order_status、approval_status，不允许只写 status。",
        "时间类字段必须表达业务语义，如 created_at、updated_at、pay_time，不允许只写 time/date。",
        "地区/国家类字段必须表达业务语义，如 origin_country、origin_region、register_region，不允许只写 region。",
        "URL 类字段必须表达资源语义，如 image_url、product_url，不允许只写 url。",
        "重量类字段必须表达业务语义，如 product_weight、gross_weight、net_weight，不允许只写 weight。",
        "除非输入明确声明允许，否则不要使用拼音缩写；优先使用稳定常见的英文业务术语。",
      ],
      preferredExamples: [
        "商品编号 -> product_code",
        "商品名称 -> product_name",
        "商品海关编码HS -> hs_code",
        "商品原产国/地区 -> origin_country_region",
        "商品零售价 -> retail_price",
        "商品计量单位 -> unit_of_measure",
        "商品品牌 -> brand_name",
        "商品规格 -> specification",
        "商品重量 -> product_weight",
        "商品图片URL -> image_url",
        "商品描述 -> product_description",
        "创建时间 -> created_at",
        "更新时间 -> updated_at",
      ],
      forbiddenPatterns: [
        "field_1",
        "col1",
        "data1",
        "temp",
        "misc",
        "common_data",
        "border_product_value_5",
      ],
      selfCheckRules: [
        "每个 fieldName 必须在脱离中文字段名后仍可理解其业务含义。",
        "如果一个名称过短、过泛或依赖表名才能猜出含义，必须补充业务限定词。",
        "sourceFieldLabel 必须与输入 sourceFields 一一对应，数量和顺序完全一致。",
      ],
    },
    tables: (Array.isArray(tables) ? tables : []).map((table) => ({
      sourceTableName: String(table?.tableName || ""),
      tableName: String(table?.tableName || ""),
      tableLabel: String(table?.tableLabel || table?.tableName || ""),
      tableComment: String(table?.tableComment || ""),
      businessRole: inferBusinessRole(table?.tableName),
      keyInfoItems: Array.isArray(table?.keyInfoItems) ? table.keyInfoItems : [],
      sourceFields: Array.isArray(table?.fields) ? table.fields : [],
    })),
  };
}

function buildLogicalRelationInput(payload, sourceAssetSnapshot, tables) {
  return {
    taskType: "RELATION_INFERENCE",
    stage: "relation_generation",
    templateName: payload.templateName,
    industryCode: payload.industryCode || "",
    sourceCategoryCodes: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
    outputContract: {
      topLevelFields: ["relations"],
      relationRequiredFields: ["fromTable", "fromField", "toTable", "toField", "relationType", "evidence"],
      relationTypeEnum: Array.from(LOGICAL_MODEL_BUILD_ALLOWED_RELATION_TYPES),
      rules: [
        "只能引用输入 tables 中真实存在的 tableName 与 fieldName。",
        "优先识别主数据表、交易表、记录表、台账表之间的稳定业务关系。",
        "没有把握时返回空数组，不要虚构关系。",
      ],
    },
    tables: (Array.isArray(tables) ? tables : []).map((table) => ({
      tableName: String(table?.tableName || ""),
      tableLabel: String(table?.tableLabel || table?.tableName || ""),
      tableComment: String(table?.tableComment || ""),
      businessRole: String(table?.businessRole || inferBusinessRole(table?.tableName || "")),
      fields: (Array.isArray(table?.fields) ? table.fields : []).map((field) => ({
        fieldName: String(field?.fieldName || ""),
        fieldComment: String(field?.fieldComment || ""),
        fieldType: String(field?.fieldType || ""),
      })),
    })),
  };
}

async function generateLogicalFieldBatchWithModelLegacy(runtimeOptions, promptInput) {
  if (!runtimeOptions?.provider) {
    return null;
  }
  const response = await modelProviderService.generateChatCompletion(
    runtimeOptions.provider,
    [
      { role: "system", content: buildLogicalFieldBatchPrompt() },
      { role: "user", content: JSON.stringify(promptInput, null, 2) },
    ],
    {
      temperature: runtimeOptions.temperature,
      maxTokens: Number(runtimeOptions.maxTokens || 1200),
      timeoutMs: LOGICAL_MODEL_FIELD_BATCH_TIMEOUT_MS,
      responseFormat: { type: "json_object" },
    }
  );
  return tryParseModelJson(response.content);
}

async function generateLogicalFieldBatchWithModel(runtimeOptions, promptInput, options = {}) {
  if (!runtimeOptions?.provider) {
    throw new AppError("未配置逻辑模型构建模型", 500);
  }
  const systemPrompt = String(runtimeOptions.systemPrompt || "");
  const userPrompt = buildLogicalModelBuildUserPrompt(runtimeOptions, promptInput, buildLogicalFieldBatchUserContent, options);
  const response = await modelProviderService.generateChatCompletion(
    runtimeOptions.provider,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: Number(runtimeOptions.temperature || 0.2),
      maxTokens: Number(runtimeOptions.maxTokens || 1200),
      timeoutMs: LOGICAL_MODEL_FIELD_BATCH_TIMEOUT_MS,
      responseFormat: { type: "json_object" },
    }
  );
  return tryParseModelJson(response.content);
}

async function generateLogicalRelationsWithModel(runtimeOptions, promptInput, options = {}) {
  if (!runtimeOptions?.provider) {
    return null;
  }
  const systemPrompt = String(runtimeOptions.systemPrompt || "");
  const userPrompt = buildLogicalModelBuildUserPrompt(
    runtimeOptions,
    promptInput,
    (input) => JSON.stringify(input, null, 2)
  );
  const response = await modelProviderService.generateChatCompletion(
    runtimeOptions.provider,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: Number(runtimeOptions.temperature || 0.2),
      maxTokens: Number(runtimeOptions.maxTokens || 1200),
      timeoutMs: LOGICAL_MODEL_RELATION_TIMEOUT_MS,
      responseFormat: { type: "json_object" },
    }
  );
  return tryParseModelJson(response.content);
}

function normalizeFieldBatchTablesLegacy(batchTables, parsed) {
  const rawTables = Array.isArray(parsed?.tables) ? parsed.tables : [];
  const modelTableMap = new Map(
    rawTables.map((table) => {
      const key = String(table?.sourceTableName || table?.tableName || "").trim();
      return [key, table];
    }).filter((item) => item[0])
  );

  return (Array.isArray(batchTables) ? batchTables : []).map((sourceTable) => {
    const sourceFieldLabels = Array.isArray(sourceTable?.fields) ? sourceTable.fields : [];
    const modelTable = modelTableMap.get(String(sourceTable?.tableName || "").trim()) || null;
    const rawFields = Array.isArray(modelTable?.fields) ? modelTable.fields : [];
    const matchedIndexes = new Set();
    const usedNames = new Set();
    const fields = sourceFieldLabels.map((sourceFieldLabel, fieldIndex) => {
      const sourceLabel = text(sourceFieldLabel, 512);
      let matchedIndex = rawFields.findIndex((field, index) => (
        !matchedIndexes.has(index)
        && text(field?.sourceFieldLabel || field?.fieldComment || field?.businessSemantic || "", 512) === sourceLabel
      ));
      if (matchedIndex < 0 && rawFields[fieldIndex] && !matchedIndexes.has(fieldIndex)) {
        matchedIndex = fieldIndex;
      }
      if (matchedIndex >= 0) {
        matchedIndexes.add(matchedIndex);
      }
      const modelField = matchedIndex >= 0 ? rawFields[matchedIndex] : null;
      const baseFieldName = !isPoorTechnicalFieldNameLegacy(modelField?.fieldName)
        ? String(modelField.fieldName || "")
        : buildTechnicalFieldNameFromLabelLegacy(sourceLabel, sourceTable?.tableName || "", fieldIndex);
      const fieldName = ensureUniqueTechnicalFieldNameLegacy(baseFieldName, usedNames);
      return {
        fieldName,
        fieldType: normalizeLogicalFieldType(
          modelField?.fieldType || inferLogicalFieldTypeFromSource(sourceLabel, fieldName),
          fieldName
        ),
        required: typeof modelField?.required === "boolean"
          ? modelField.required
          : (fieldIndex === 0 || String(fieldName || "").endsWith("_id")),
        businessSemantic: text(modelField?.businessSemantic || sourceLabel, 128),
        fieldComment: sourceLabel,
      };
    });

    return {
      tableName: String(sourceTable?.tableName || ""),
      tableLabel: text(modelTable?.tableLabel || sourceTable?.tableLabel || sourceTable?.tableName || "", 128),
      tableComment: text(modelTable?.tableComment || sourceTable?.tableComment || sourceTable?.tableLabel || sourceTable?.tableName || "", 512),
      businessRole: text(modelTable?.businessRole || inferBusinessRole(sourceTable?.tableName || ""), 32) || inferBusinessRole(sourceTable?.tableName || ""),
      sourceTableName: String(sourceTable?.tableName || ""),
      keyInfoItems: normalizeStringArray(sourceTable?.keyInfoItems, 128),
      sourceRefs: normalizeStringArray(sourceTable?.sourceRefs, 512),
      fields,
    };
  });
}

function normalizeFieldBatchTables(batchTables, parsed) {
  const rawTables = Array.isArray(parsed?.tables) ? parsed.tables : [];
  const modelTableMap = new Map(
    rawTables.map((table) => {
      const key = String(table?.sourceTableName || table?.tableName || "").trim();
      return [key, table];
    }).filter((item) => item[0])
  );

  return (Array.isArray(batchTables) ? batchTables : []).map((sourceTable) => {
    const sourceFieldLabels = Array.isArray(sourceTable?.fields) ? sourceTable.fields : [];
    const tableName = String(sourceTable?.tableName || "").trim();
    const modelTable = modelTableMap.get(tableName) || null;
    const rawFields = Array.isArray(modelTable?.fields) ? modelTable.fields : [];
    const matchedIndexes = new Set();
    const usedNames = new Set();
    const fields = sourceFieldLabels.map((sourceFieldLabel, fieldIndex) => {
      const sourceLabel = text(sourceFieldLabel, 512);
      let matchedIndex = rawFields.findIndex((field, index) => (
        !matchedIndexes.has(index)
        && text(field?.sourceFieldLabel, 512) === sourceLabel
      ));
      if (matchedIndex < 0 && rawFields[fieldIndex] && !matchedIndexes.has(fieldIndex)) {
        matchedIndex = fieldIndex;
      }
      if (matchedIndex >= 0) {
        matchedIndexes.add(matchedIndex);
      }
      const modelField = matchedIndex >= 0 ? rawFields[matchedIndex] : null;
      const candidateFieldName = String(modelField?.fieldName || "").trim().toLowerCase();
      const baseFieldName = isValidModelTechnicalFieldName(candidateFieldName)
        ? candidateFieldName
        : buildTechnicalFieldNameFromLabelLegacy(sourceLabel, sourceTable?.tableName || "", fieldIndex);
      const fieldName = ensureUniqueTechnicalFieldNameLegacy(baseFieldName, usedNames);
      return {
        fieldName,
        fieldType: normalizeLogicalFieldType(
          modelField?.fieldType || inferLogicalFieldTypeFromSource(sourceLabel, fieldName),
          fieldName
        ),
        required: typeof modelField?.required === "boolean"
          ? modelField.required
          : (fieldIndex === 0 || String(fieldName || "").endsWith("_id")),
        businessSemantic: text(modelField?.businessSemantic || sourceLabel, 128),
        fieldComment: sourceLabel,
      };
    });

    return {
      tableName: String(sourceTable?.tableName || ""),
      tableLabel: text(modelTable?.tableLabel || sourceTable?.tableLabel || sourceTable?.tableName || "", 128),
      tableComment: text(modelTable?.tableComment || sourceTable?.tableComment || sourceTable?.tableLabel || sourceTable?.tableName || "", 512),
      businessRole: text(modelTable?.businessRole || inferBusinessRole(sourceTable?.tableName || ""), 32) || inferBusinessRole(sourceTable?.tableName || ""),
      sourceTableName: String(sourceTable?.tableName || ""),
      keyInfoItems: normalizeStringArray(sourceTable?.keyInfoItems, 128),
      sourceRefs: normalizeStringArray(sourceTable?.sourceRefs, 512),
      fields,
    };
  });
}

function normalizeRelationCandidates(parsed, tables) {
  const tableFieldMap = new Map(
    (Array.isArray(tables) ? tables : []).map((table) => [
      String(table?.tableName || "").trim(),
      new Set((Array.isArray(table?.fields) ? table.fields : []).map((field) => String(field?.fieldName || "").trim()).filter(Boolean)),
    ])
  );
  return uniqueBy(
    (Array.isArray(parsed?.relations) ? parsed.relations : []).map((relation) => ({
      fromTable: text(relation?.fromTable, 128),
      fromField: text(relation?.fromField, 128),
      toTable: text(relation?.toTable, 128),
      toField: text(relation?.toField, 128),
      relationType: normalizeRelationType(relation?.relationType),
    })).filter((relation) =>
      relation.fromTable
      && relation.fromField
      && relation.toTable
      && relation.toField
      && tableFieldMap.get(relation.fromTable)?.has(relation.fromField)
      && tableFieldMap.get(relation.toTable)?.has(relation.toField)
    ),
    (relation) => `${relation.fromTable}.${relation.fromField}->${relation.toTable}.${relation.toField}`
  );
}

function normalizeBuiltLogicalModel(parsed, payload, sourceAssetSnapshot, fallback) {
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : null;
  if (!source) {
    throw new Error("logical_model_build_empty_output");
  }

  const sourceTableMap = new Map(
    (Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs : [])
      .map((table) => [String(table?.tableName || "").trim(), table])
  );
  const sourceCategoryCodes = Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [];
  const rawTables = Array.isArray(source.tables) ? source.tables : [];
  if (rawTables.length === 0) {
    throw new Error("logical_model_build_missing_tables");
  }

  let invalidFieldCount = 0;
  const tables = uniqueBy(rawTables.map((table, tableIndex) => {
    const sourceTable = sourceTableMap.get(String(table?.sourceTableName || table?.tableName || "").trim()) || sourceTableMap.get(String(table?.tableName || "").trim()) || null;
    const tableName = normalizeCode(text(table?.tableName, 128) || text(sourceTable?.tableName, 128) || `table_${tableIndex + 1}`, `table_${tableIndex + 1}`);
    const sourceFields = Array.isArray(sourceTable?.fields) ? sourceTable.fields : [];
    const fields = uniqueBy(
      (Array.isArray(table?.fields) ? table.fields : []).map((field, fieldIndex) => {
        const rawFieldName = text(field?.fieldName, 128);
      if (!isTechnicalFieldName(rawFieldName)) {
          invalidFieldCount += 1;
        }
        const fieldName = rawFieldName;
        const fieldComment = text(
          field?.fieldComment
          || field?.sourceFieldLabel
          || field?.fieldLabel
          || field?.businessSemantic
          || sourceFields[fieldIndex]
          || "",
          512
        );
        if (!fieldComment) {
          invalidFieldCount += 1;
        }
        return {
          fieldName,
          fieldType: normalizeLogicalFieldType(field?.fieldType, fieldName),
          required: field?.required === undefined || field?.required === null
            ? (fieldIndex === 0 || String(fieldName || "").endsWith("_id"))
            : Boolean(field.required),
          businessSemantic: text(field?.businessSemantic || fieldComment || sourceFields[fieldIndex] || "", 128),
          fieldComment,
        };
      }).filter((field) => field.fieldName),
      (field) => field.fieldName
    );
    if (fields.length === 0) {
      throw new Error(`logical_model_build_empty_fields:${tableName}`);
    }
    return {
      tableName,
      tableLabel: text(table?.tableLabel || sourceTable?.tableLabel || tableName, 128) || tableName,
      tableComment: text(table?.tableComment || sourceTable?.tableComment || table?.tableLabel || sourceTable?.tableLabel || tableName, 512),
      businessRole: text(table?.businessRole, 32) || inferBusinessRole(tableName),
      sourceTableName: text(table?.sourceTableName || sourceTable?.tableName || "", 128) || null,
      keyInfoItems: normalizeStringArray(table?.keyInfoItems, 128).length > 0
        ? normalizeStringArray(table?.keyInfoItems, 128)
        : normalizeStringArray(sourceTable?.keyInfoItems, 128),
      sourceRefs: normalizeStringArray(table?.sourceRefs, 512).length > 0
        ? normalizeStringArray(table?.sourceRefs, 512)
        : normalizeStringArray(sourceTable?.sourceRefs, 512),
      fields,
    };
  }), (table) => table.tableName);

  if (invalidFieldCount > 0) {
    throw new Error(`logical_model_build_invalid_field_names:${invalidFieldCount}`);
  }

  const tableFieldMap = new Map(
    tables.map((table) => [table.tableName, new Set((Array.isArray(table.fields) ? table.fields : []).map((field) => String(field?.fieldName || "").trim()).filter(Boolean))])
  );

  const relations = uniqueBy(
    (Array.isArray(source.relations) ? source.relations : []).map((relation) => ({
      fromTable: text(relation?.fromTable, 128),
      fromField: text(relation?.fromField, 128),
      toTable: text(relation?.toTable, 128),
      toField: text(relation?.toField, 128),
      relationType: normalizeRelationType(relation?.relationType),
    })).filter((relation) =>
      relation.fromTable
      && relation.fromField
      && relation.toTable
      && relation.toField
      && tableFieldMap.get(relation.fromTable)?.has(relation.fromField)
      && tableFieldMap.get(relation.toTable)?.has(relation.toField)
    ),
    (relation) => `${relation.fromTable}.${relation.fromField}->${relation.toTable}.${relation.toField}`
  );

  const modules = uniqueBy(
    (Array.isArray(source.modules) ? source.modules : []).map((module, moduleIndex) => ({
      moduleKey: text(module?.moduleKey, 64) || `module_${moduleIndex + 1}`,
      moduleLabel: text(module?.moduleLabel, 128) || text(module?.moduleKey, 64) || `module_${moduleIndex + 1}`,
      summary: text(module?.summary, 1024),
      tableNames: normalizeStringArray(module?.tableNames, 128).filter((tableName) => tableFieldMap.has(tableName)),
    })).filter((module) => module.tableNames.length > 0),
    (module) => module.moduleKey
  );

  const logicalModel = normalizeLogicalModel({
    meta: {
      templateName: payload.templateName,
      templateCode: payload.templateCode,
      generatedAt: new Date().toISOString(),
      generatedFrom: "logical_model_build_model",
    },
    blueprint: {
      industryCode: payload.industryCode || "",
      templateDesc: payload.templateDesc || "",
      sourceCategoryCodes,
      sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
    },
    modules: modules.length > 0 ? modules : fallback.modules,
    tables,
    dictTables: Array.isArray(source.dictTables) && source.dictTables.length > 0 ? source.dictTables : fallback.dictTables,
    relations: relations.length > 0 ? relations : buildRelations(tables),
  }, {
    templateName: payload.templateName,
    templateCode: payload.templateCode,
    industryCode: payload.industryCode,
    templateDesc: payload.templateDesc,
    sourceCategoryCodes,
    sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
  });
  logicalModel.summary = buildLogicalSummary(logicalModel);
  return logicalModel;
}

async function tryBuildLogicalModelWithModelLegacy(payload, sourceAssetSnapshot, options = {}) {
  const fallback = buildInitialLogicalModel(payload, sourceAssetSnapshot);
  const notify = typeof options?.onProgress === "function" ? options.onProgress : () => {};
  try {
    const runtimeOptions = await resolveLogicalModelBuildRuntimeOptions();
    const candidateTableSpecs = Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs : [];
    if (!runtimeOptions?.provider || candidateTableSpecs.length === 0) {
      notify({ level: "warning", stepKey: "logical_model_fallback", stage: "fallback", progressPercent: 100, message: "未检测到可用模型配置，已回退到规则构建。" });
      return fallback;
    }

    const tableBatches = chunkArray(candidateTableSpecs, LOGICAL_MODEL_FIELD_BATCH_SIZE);
    const normalizedTables = [];
    for (let batchIndex = 0; batchIndex < tableBatches.length; batchIndex += 1) {
      const batchTables = tableBatches[batchIndex];
      notify({
        stepKey: "field_batch_start",
        stage: "field_generation",
        progressPercent: Math.min(85, Math.round(((batchIndex + 0.2) / Math.max(tableBatches.length, 1)) * 70) + 5),
        message: `AI 正在分析第 ${batchIndex + 1}/${tableBatches.length} 批表字段，共 ${batchTables.length} 张表。`,
        detail: {
          batchIndex: batchIndex + 1,
          batchCount: tableBatches.length,
          tableNames: batchTables.map((item) => item?.tableName).filter(Boolean),
        },
      });
      let parsed = null;
      try {
        parsed = await generateLogicalFieldBatchWithModel(
          runtimeOptions,
          buildLogicalFieldBatchInput(payload, sourceAssetSnapshot, batchTables, batchIndex + 1, tableBatches.length)
        );
      } catch (error) {
        notify({
          level: "warning",
          stepKey: "field_batch_failed",
          stage: "field_generation",
          progressPercent: Math.min(88, Math.round(((batchIndex + 1) / Math.max(tableBatches.length, 1)) * 70) + 5),
          message: `第 ${batchIndex + 1} 批字段技术名生成失败，已切换为本地规则兜底。`,
          detail: { errorMessage: error?.message || "field_batch_failed" },
        });
      }
      normalizedTables.push(...normalizeFieldBatchTables(batchTables, parsed));
    }

    notify({
      stepKey: "relation_inference_start",
      stage: "relation_generation",
      progressPercent: 88,
      message: "AI 正在推断表关系并补齐ER连线。",
    });

    let relationCandidates = [];
    try {
      const relationParsed = await generateLogicalRelationsWithModel(
        runtimeOptions,
        buildLogicalRelationInput(payload, sourceAssetSnapshot, normalizedTables)
      );
      relationCandidates = normalizeRelationCandidates(relationParsed, normalizedTables);
    } catch (error) {
      notify({
        level: "warning",
        stepKey: "relation_inference_failed",
        stage: "relation_generation",
        progressPercent: 92,
        message: "表关系推断失败，已切换为本地规则补齐。",
        detail: { errorMessage: error?.message || "relation_inference_failed" },
      });
    }

    const mergedRelations = uniqueBy(
      [
        ...relationCandidates,
        ...buildRelations(normalizedTables),
      ],
      (relation) => `${relation.fromTable}.${relation.fromField}->${relation.toTable}.${relation.toField}`
    );

    const logicalModel = normalizeLogicalModel({
      meta: {
        templateName: payload.templateName,
        templateCode: payload.templateCode,
        generatedAt: new Date().toISOString(),
        generatedFrom: "logical_model_build_batched_model",
      },
      blueprint: {
        industryCode: payload.industryCode || "",
        templateDesc: payload.templateDesc || "",
        sourceCategoryCodes: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
        sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
      },
      modules: fallback.modules,
      tables: normalizedTables,
      dictTables: fallback.dictTables,
      relations: mergedRelations,
    }, {
      templateName: payload.templateName,
      templateCode: payload.templateCode,
      industryCode: payload.industryCode,
      templateDesc: payload.templateDesc,
      sourceCategoryCodes: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
      sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
    });
    logicalModel.summary = buildLogicalSummary(logicalModel);

    notify({
      stepKey: "logical_model_ready",
      stage: "finalizing",
      progressPercent: 96,
      message: `逻辑模型已完成，共生成 ${logicalModel.summary.tableCount} 张表、${logicalModel.summary.relationCount} 条关系。`,
    });

    return logicalModel;
  } catch (error) {
    notify({
      level: "warning",
      stepKey: "logical_model_fallback",
      stage: "fallback",
      progressPercent: 100,
      message: "AI 构建未成功完成，已回退到规则构建结果。",
      detail: { errorMessage: error?.message || "logical_model_build_failed" },
    });
    return fallback;
  }
}

async function tryBuildLogicalModelWithModel(payload, sourceAssetSnapshot, options = {}) {
  const fallback = buildInitialLogicalModel(payload, sourceAssetSnapshot);
  const notify = typeof options?.onProgress === "function" ? options.onProgress : () => {};
  try {
    const runtimeOptions = await resolveLogicalModelBuildRuntimeOptions();
    const candidateTableSpecs = Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs : [];
    if (!runtimeOptions?.provider) {
      throw new AppError("未配置逻辑模型构建模型", 500);
    }
    if (candidateTableSpecs.length === 0) {
      throw new AppError("未找到可用于构建逻辑模型的候选表", 400);
    }

    const tableBatches = chunkArray(candidateTableSpecs, LOGICAL_MODEL_FIELD_BATCH_SIZE);
    const normalizedTables = [];
    for (let batchIndex = 0; batchIndex < tableBatches.length; batchIndex += 1) {
      const batchTables = tableBatches[batchIndex];
      const promptInput = buildLogicalFieldBatchInput(payload, sourceAssetSnapshot, batchTables, batchIndex + 1, tableBatches.length);
      notify({
        stepKey: "field_batch_start",
        stage: "field_generation",
        progressPercent: Math.min(85, Math.round(((batchIndex + 0.2) / Math.max(tableBatches.length, 1)) * 70) + 5),
        message: `AI 正在分析第 ${batchIndex + 1}/${tableBatches.length} 张表字段，共 ${batchTables.length} 张表。`,
        detail: {
          batchIndex: batchIndex + 1,
          batchCount: tableBatches.length,
          tableNames: batchTables.map((item) => item?.tableName).filter(Boolean),
        },
      });

      let normalizedBatchTables = null;
      try {
        const parsed = await generateLogicalFieldBatchWithModel(runtimeOptions, promptInput, {
          attemptIndex: 1,
          retryReason: "",
        });
        normalizedBatchTables = normalizeFieldBatchTables(batchTables, parsed);
      } catch (error) {
        notify({
          level: "warning",
          stepKey: "field_batch_local_fallback",
          stage: "field_generation",
          progressPercent: Math.min(86, Math.round(((batchIndex + 0.7) / Math.max(tableBatches.length, 1)) * 70) + 5),
          message: `第 ${batchIndex + 1}/${tableBatches.length} 批字段技术名未通过校验，已自动切换为本地简写规则。`,
          detail: {
            batchIndex: batchIndex + 1,
            batchCount: tableBatches.length,
            tableNames: batchTables.map((item) => item?.tableName).filter(Boolean),
            fallbackMode: "pinyin_abbr",
            reason: error?.message || "field_batch_local_fallback",
          },
        });
        normalizedBatchTables = normalizeFieldBatchTablesLegacy(batchTables, { tables: [] });
      }
      normalizedTables.push(...(normalizedBatchTables || []));
    }

    notify({
      stepKey: "relation_inference_start",
      stage: "relation_generation",
      progressPercent: 88,
      message: "AI 正在推断表关系并补齐 ER 连线。",
    });

    let relationCandidates = [];
    try {
      const relationParsed = await generateLogicalRelationsWithModel(
        runtimeOptions,
        buildLogicalRelationInput(payload, sourceAssetSnapshot, normalizedTables)
      );
      relationCandidates = normalizeRelationCandidates(relationParsed, normalizedTables);
    } catch (error) {
      notify({
        level: "warning",
        stepKey: "relation_inference_failed",
        stage: "relation_generation",
        progressPercent: 92,
        message: "表关系模型推断失败，继续使用规则关系补全。",
        detail: { errorMessage: error?.message || "relation_inference_failed" },
      });
    }

    const mergedRelations = uniqueBy(
      [
        ...relationCandidates,
        ...buildRelations(normalizedTables),
      ],
      (relation) => `${relation.fromTable}.${relation.fromField}->${relation.toTable}.${relation.toField}`
    );

    const logicalModel = normalizeLogicalModel({
      meta: {
        templateName: payload.templateName,
        templateCode: payload.templateCode,
        generatedAt: new Date().toISOString(),
        generatedFrom: "logical_model_build_batched_model",
      },
      blueprint: {
        industryCode: payload.industryCode || "",
        templateDesc: payload.templateDesc || "",
        sourceCategoryCodes: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
        sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
      },
      modules: fallback.modules,
      tables: normalizedTables,
      dictTables: fallback.dictTables,
      relations: mergedRelations,
    }, {
      templateName: payload.templateName,
      templateCode: payload.templateCode,
      industryCode: payload.industryCode,
      templateDesc: payload.templateDesc,
      sourceCategoryCodes: Array.isArray(sourceAssetSnapshot?.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
      sourceIncubationId: sourceAssetSnapshot?.incubation?.id || null,
    });
    logicalModel.summary = buildLogicalSummary(logicalModel);

    notify({
      stepKey: "logical_model_ready",
      stage: "finalizing",
      progressPercent: 96,
      message: `逻辑模型已完成，共生成 ${logicalModel.summary.tableCount} 张表、${logicalModel.summary.relationCount} 条关系。`,
    });

    return logicalModel;
  } catch (error) {
    notify({
      level: "error",
      stepKey: "logical_model_build_failed",
      stage: "failed",
      progressPercent: 100,
      message: "逻辑模型构建失败，请根据错误信息修正后重试。",
      detail: { errorMessage: error?.message || "logical_model_build_failed" },
    });
    throw error;
  }
}

function buildLogicalSummary(logicalModel) {
  const modules = Array.isArray(logicalModel?.modules) ? logicalModel.modules : [];
  const tables = Array.isArray(logicalModel?.tables) ? logicalModel.tables : [];
  const dictTables = Array.isArray(logicalModel?.dictTables) ? logicalModel.dictTables : [];
  const relations = Array.isArray(logicalModel?.relations) ? logicalModel.relations : [];
  const sourceCategoryCodes = Array.isArray(logicalModel?.blueprint?.sourceCategoryCodes)
    ? logicalModel.blueprint.sourceCategoryCodes
    : [];
  return {
    moduleCount: modules.length,
    tableCount: tables.length,
    dictCount: dictTables.length,
    relationCount: relations.length,
    sourceCategoryCount: sourceCategoryCodes.length,
  };
}

function buildFallbackSourceAssetSnapshot(template) {
  return {
    incubation: {
      id: Number(template?.sourceIncubationId || 0),
      incubationName: template?.sourceIncubationName || "",
      industryCode: template?.industryCode || "",
    },
    categories: [],
    categoryCodes: Array.isArray(template?.sourceCategoryCodes) ? template.sourceCategoryCodes : [],
    candidateTableSpecs: [],
    dictionaries: [],
    modulePlanner: {
      summary: "",
      categories: [],
    },
  };
}

function normalizeLogicalModel(logicalModel, template) {
  const source = logicalModel && typeof logicalModel === "object" && !Array.isArray(logicalModel)
    ? logicalModel
    : null;
  if (!source) {
    throw new AppError("逻辑模型内容不能为空", 400);
  }

  const tables = uniqueBy(
    (Array.isArray(source.tables) ? source.tables : []).map((table, tableIndex) => {
      const tableName = text(table?.tableName, 128) || `table_${tableIndex + 1}`;
      return {
        tableName,
        tableLabel: text(table?.tableLabel, 128) || tableName,
        tableComment: text(table?.tableComment, 512),
        businessRole: text(table?.businessRole, 32) || inferBusinessRole(tableName),
        keyInfoItems: Array.isArray(table?.keyInfoItems) ? table.keyInfoItems : [],
        sourceRefs: normalizeStringArray(table?.sourceRefs, 512),
        fields: uniqueBy(
          (Array.isArray(table?.fields) ? table.fields : []).map((field, fieldIndex) => {
            const fieldName = text(field?.fieldName, 128) || `field_${fieldIndex + 1}`;
            return {
              fieldName,
              fieldType: text(field?.fieldType, 64) || buildFieldType(fieldName),
              required: Boolean(field?.required),
              businessSemantic: text(field?.businessSemantic, 128),
              fieldComment: text(field?.fieldComment, 512),
            };
          }),
          (field) => field.fieldName
        ),
      };
    }),
    (table) => table.tableName
  );
  const tableNameSet = new Set(tables.map((item) => item.tableName));

  let modules = uniqueBy(
    (Array.isArray(source.modules) ? source.modules : []).map((module, moduleIndex) => {
      const moduleKey = text(module?.moduleKey, 64) || `module_${moduleIndex + 1}`;
      return {
        moduleKey,
        moduleLabel: text(module?.moduleLabel, 128) || moduleKey,
        summary: text(module?.summary, 1024),
        tableNames: normalizeStringArray(module?.tableNames, 128).filter((tableName) => tableNameSet.has(tableName)),
      };
    }),
    (module) => module.moduleKey
  );

  if (modules.length === 0 && tables.length > 0) {
    modules = [{
      moduleKey: "core_domain",
      moduleLabel: "Core Domain",
      summary: "",
      tableNames: tables.map((table) => table.tableName),
    }];
  }

  const dictTables = uniqueBy(
    (Array.isArray(source.dictTables) ? source.dictTables : []).map((dictTable, dictIndex) => {
      const dictType = text(dictTable?.dictType, 64) || `dict_${dictIndex + 1}`;
      return {
        dictType,
        dictName: text(dictTable?.dictName, 128) || dictType,
        categoryCode: text(dictTable?.categoryCode, 128),
        sourceRefs: normalizeStringArray(dictTable?.sourceRefs, 512),
        items: uniqueBy(
          (Array.isArray(dictTable?.items) ? dictTable.items : []).map((item, itemIndex) => ({
            itemCode: text(item?.itemCode, 64) || `item_${itemIndex + 1}`,
            itemLabel: text(item?.itemLabel, 128) || text(item?.itemCode, 64) || `item_${itemIndex + 1}`,
            valueRange: item?.valueRange ?? null,
            sourceRefs: normalizeStringArray(item?.sourceRefs, 512),
          })),
          (item) => item.itemCode
        ),
      };
    }),
    (item) => item.dictType
  );

  const relations = uniqueBy(
    (Array.isArray(source.relations) && source.relations.length > 0 ? source.relations : buildRelations(tables))
      .map((relation) => ({
        fromTable: text(relation?.fromTable, 128),
        fromField: text(relation?.fromField, 128),
        toTable: text(relation?.toTable, 128),
        toField: text(relation?.toField, 128),
        relationType: text(relation?.relationType, 16) || "N:1",
      }))
      .filter((relation) => relation.fromTable && relation.fromField && relation.toTable && relation.toField),
    (relation) => `${relation.fromTable}.${relation.fromField}->${relation.toTable}.${relation.toField}`
  );

  const normalized = {
    meta: {
      templateName: template?.templateName || text(source?.meta?.templateName, 128),
      templateCode: template?.templateCode || text(source?.meta?.templateCode, 64),
      generatedAt: text(source?.meta?.generatedAt, 64) || new Date().toISOString(),
      generatedFrom: text(source?.meta?.generatedFrom, 64) || (template?.sourceIncubationId ? "industry_incubation" : "manual"),
      lastEditedAt: new Date().toISOString(),
    },
    blueprint: {
      industryCode: template?.industryCode || text(source?.blueprint?.industryCode, 64),
      templateDesc: template?.templateDesc || text(source?.blueprint?.templateDesc, 1024),
      sourceCategoryCodes: Array.isArray(template?.sourceCategoryCodes)
        ? template.sourceCategoryCodes
        : normalizeStringArray(source?.blueprint?.sourceCategoryCodes, 128),
      sourceIncubationId: template?.sourceIncubationId == null ? null : Number(template.sourceIncubationId),
    },
    modules,
    tables,
    dictTables,
    relations,
  };
  normalized.summary = buildLogicalSummary(normalized);
  return normalized;
}

function buildVersionDiffSummary(previousModel, nextModel) {
  const previousSummary = buildLogicalSummary(previousModel || {});
  const nextSummary = buildLogicalSummary(nextModel || {});
  const diffs = [];
  if (previousSummary.moduleCount !== nextSummary.moduleCount) diffs.push(`模块 ${previousSummary.moduleCount} -> ${nextSummary.moduleCount}`);
  if (previousSummary.tableCount !== nextSummary.tableCount) diffs.push(`逻辑表 ${previousSummary.tableCount} -> ${nextSummary.tableCount}`);
  if (previousSummary.dictCount !== nextSummary.dictCount) diffs.push(`字典 ${previousSummary.dictCount} -> ${nextSummary.dictCount}`);
  if (previousSummary.relationCount !== nextSummary.relationCount) diffs.push(`关系 ${previousSummary.relationCount} -> ${nextSummary.relationCount}`);
  if (previousSummary.sourceCategoryCount !== nextSummary.sourceCategoryCount) diffs.push(`来源子类目 ${previousSummary.sourceCategoryCount} -> ${nextSummary.sourceCategoryCount}`);
  return diffs.length > 0 ? diffs.join("；") : "结构数量无变化，已生成新版本快照";
}

function normalizeDbType(value) {
  const normalized = String(value || "mysql").trim().toLowerCase();
  if (normalized === "postgres") return "postgresql";
  if (!["mysql", "postgresql"].includes(normalized)) {
    throw new AppError("褰撳墠浠呮敮鎸?MySQL 鍜?PostgreSQL 鐗╃悊妯″瀷缂栬瘧", 400);
  }
  return normalized;
}

function escapeSqlComment(value) {
  return String(value || "").replace(/'/g, "''");
}

function quoteIdentifier(dbType, identifier) {
  return dbType === "postgresql"
    ? `"${String(identifier || "").replace(/"/g, "\"\"")}"`
    : `\`${String(identifier || "").replace(/`/g, "``")}\``;
}

function inferNumericType(fieldName, businessSemantic) {
  const normalizedField = String(fieldName || "").toLowerCase();
  const normalizedSemantic = String(businessSemantic || "").toLowerCase();
  if (
    normalizedField.includes("amount")
    || normalizedField.includes("price")
    || normalizedField.includes("fee")
    || normalizedField.includes("rate")
    || normalizedSemantic.includes("amount")
    || normalizedSemantic.includes("price")
    || normalizedSemantic.includes("fee")
  ) {
    return "DECIMAL(18,2)";
  }
  return "BIGINT";
}

function mapLogicalFieldToColumnType(field, dbType) {
  const rawType = String(field?.fieldType || "STRING").trim().toUpperCase();
  if (rawType.includes("DECIMAL")) return "DECIMAL(18,2)";
  if (rawType === "STRING") return "VARCHAR(128)";
  if (rawType === "NUMBER") return inferNumericType(field?.fieldName, field?.businessSemantic);
  if (rawType === "DATE") return "DATE";
  if (rawType === "DATETIME") return dbType === "postgresql" ? "TIMESTAMP" : "DATETIME";
  if (rawType === "BOOLEAN") return dbType === "postgresql" ? "BOOLEAN" : "TINYINT(1)";
  if (rawType === "JSON") return dbType === "postgresql" ? "JSONB" : "JSON";
  return rawType;
}

function buildPhysicalTableName(instanceCode, tableName) {
  return normalizeCode(tableName, "table");
}

function buildPhysicalIndexName(prefix, tableName, columnNames) {
  const prefixToken = normalizeCode(prefix, "idx").slice(0, 8) || "idx";
  const tableToken = normalizeCode(tableName, "table").slice(0, 18);
  const columnToken = normalizeCode(
    Array.isArray(columnNames) ? columnNames.join("_") : "",
    "column"
  ).slice(0, 18);
  const identifierHash = hashText(
    [prefix, tableName, ...(Array.isArray(columnNames) ? columnNames : [])].join("_")
  ).slice(-8);
  return [prefixToken, tableToken, columnToken, identifierHash].filter(Boolean).join("_");
}

function buildIndexDefinitions(columns) {
  const indexes = [];
  for (const column of columns) {
    const columnName = String(column.columnName || "");
    if (!columnName || column.isPrimaryKey) continue;
    if (columnName.endsWith("_id") || columnName.endsWith("_code") || columnName.includes("status") || columnName.includes("date") || columnName.endsWith("_at")) {
      indexes.push({
        indexName: buildPhysicalIndexName("idx", column.logicalTableName, [columnName]),
        indexType: "INDEX",
        columnNames: [columnName],
      });
    }
  }
  return uniqueBy(indexes, (item) => `${item.indexName}.${item.columnNames.join(",")}`);
}

function buildBusinessTablePhysicalDefinition(table, instance, dbType) {
  const logicalFields = Array.isArray(table?.fields) ? table.fields : [];
  const primaryKeyName = logicalFields.some((field) => String(field?.fieldName || "") === "id")
    ? "id"
    : String(logicalFields[0]?.fieldName || "id");
  const columns = logicalFields.map((field) => ({
    columnName: String(field?.fieldName || ""),
    columnType: mapLogicalFieldToColumnType(field, dbType),
    isNullable: !Boolean(field?.required) && String(field?.fieldName || "") !== primaryKeyName,
    isPrimaryKey: String(field?.fieldName || "") === primaryKeyName,
    defaultValue: field?.defaultValue ?? null,
    columnComment: resolveChineseFieldComment(field, table) || null,
    sourceFieldName: String(field?.fieldName || ""),
    logicalTableName: String(table?.tableName || ""),
  }));
  const indexes = buildIndexDefinitions(columns);
  return {
    tableKind: "BUSINESS",
    logicalTableName: table.tableName,
    logicalLabel: table.tableLabel || table.tableName,
    physicalTableName: buildPhysicalTableName(instance.instanceCode, table.tableName),
    tableComment: resolveChineseTableComment(table),
    businessRole: table?.businessRole || inferBusinessRole(table?.tableName),
    columns: columns.map((column) => ({
      columnName: column.columnName,
      columnType: column.columnType,
      isNullable: column.isNullable,
      isPrimaryKey: column.isPrimaryKey,
      defaultValue: column.defaultValue,
      columnComment: column.columnComment,
      sourceFieldName: column.sourceFieldName,
    })),
    indexes,
  };
}

function buildDictionaryTablePhysicalDefinition(dictTable, instance, dbType) {
  return {
    tableKind: "DICTIONARY",
    logicalTableName: dictTable.dictType,
    logicalLabel: dictTable.dictName || dictTable.dictType,
    physicalTableName: buildPhysicalTableName(instance.instanceCode, `dict_${dictTable.dictType}`),
    tableComment: text(`${dictTable.dictName || dictTable.dictType} 瀛楀吀琛?`, 512),
    businessRole: "DICTIONARY",
    columns: [
      { columnName: "item_code", columnType: "VARCHAR(64)", isNullable: false, isPrimaryKey: true, defaultValue: null, columnComment: "瀛楀吀椤圭紪鐮?", sourceFieldName: "itemCode" },
      { columnName: "item_label", columnType: "VARCHAR(128)", isNullable: false, isPrimaryKey: false, defaultValue: null, columnComment: "瀛楀吀椤瑰悕绉?", sourceFieldName: "itemLabel" },
      { columnName: "category_code", columnType: "VARCHAR(128)", isNullable: true, isPrimaryKey: false, defaultValue: null, columnComment: "鎵€灞炲瓙绫荤洰", sourceFieldName: "categoryCode" },
      { columnName: "value_range_json", columnType: dbType === "postgresql" ? "JSONB" : "JSON", isNullable: true, isPrimaryKey: false, defaultValue: null, columnComment: "鍊煎煙蹇収", sourceFieldName: "valueRange" },
      { columnName: "sort_order", columnType: dbType === "postgresql" ? "INTEGER" : "INT", isNullable: true, isPrimaryKey: false, defaultValue: null, columnComment: "鎺掑簭", sourceFieldName: "sortOrder" },
    ],
    indexes: [
      {
        indexName: buildPhysicalIndexName("idx", dictTable.dictType, ["category_code"]),
        indexType: "INDEX",
        columnNames: ["category_code"],
      },
    ],
  };
}

function buildDictionaryTablePhysicalDefinitionV2(dictTable, instance, dbType) {
  const rawLabel = containsChineseText(dictTable?.dictName)
    ? String(dictTable.dictName || "").trim()
    : String(translateIdentifierToChinese(dictTable?.dictType, "字典") || dictTable?.dictType || "").trim();
  const normalizedLabel = rawLabel.endsWith("字典表")
    ? rawLabel
    : rawLabel.endsWith("字典")
      ? `${rawLabel}表`
      : `${rawLabel}字典表`;
  return {
    tableKind: "DICTIONARY",
    logicalTableName: dictTable.dictType,
    logicalLabel: dictTable.dictName || dictTable.dictType,
    physicalTableName: buildPhysicalTableName(instance.instanceCode, dictTable.dictType),
    tableComment: text(normalizedLabel, 512),
    businessRole: "DICTIONARY",
    columns: [
      { columnName: "item_code", columnType: "VARCHAR(64)", isNullable: false, isPrimaryKey: true, defaultValue: null, columnComment: "字典项编码", sourceFieldName: "itemCode" },
      { columnName: "item_label", columnType: "VARCHAR(128)", isNullable: false, isPrimaryKey: false, defaultValue: null, columnComment: "字典项名称", sourceFieldName: "itemLabel" },
      { columnName: "category_code", columnType: "VARCHAR(128)", isNullable: true, isPrimaryKey: false, defaultValue: null, columnComment: "子类目编码", sourceFieldName: "categoryCode" },
      { columnName: "value_range_json", columnType: dbType === "postgresql" ? "JSONB" : "JSON", isNullable: true, isPrimaryKey: false, defaultValue: null, columnComment: "值域快照", sourceFieldName: "valueRange" },
      { columnName: "sort_order", columnType: dbType === "postgresql" ? "INTEGER" : "INT", isNullable: true, isPrimaryKey: false, defaultValue: null, columnComment: "排序号", sourceFieldName: "sortOrder" },
    ],
    indexes: [
      {
        indexName: buildPhysicalIndexName("idx", dictTable.dictType, ["category_code"]),
        indexType: "INDEX",
        columnNames: ["category_code"],
      },
    ],
  };
}

function buildTableDeploymentStatements(table, dbType, options = {}) {
  const schema = dbType === "postgresql" ? text(options?.schema, 64) || null : null;
  const replaceExisting = Boolean(options?.replaceExisting);
  const includeSchemaCreate = options?.includeSchemaCreate !== false;
  const quotedTableName = buildQualifiedTableReference(dbType, table.physicalTableName, schema);
  const tableLevelComment = text(table?.logicalLabel || table?.tableComment || table?.logicalTableName || "", 512);
  const columnLines = (Array.isArray(table?.columns) ? table.columns : []).map((column) => {
    const parts = [`${quoteIdentifier(dbType, column.columnName)} ${column.columnType}`];
    parts.push(column.isNullable ? "NULL" : "NOT NULL");
    if (!isNullDefaultExpression(column.defaultValue) && column.defaultValue !== null && column.defaultValue !== undefined && column.defaultValue !== "") {
      parts.push(`DEFAULT '${escapeSqlComment(column.defaultValue)}'`);
    }
    if (dbType !== "postgresql" && column.columnComment) {
      parts.push(`COMMENT '${escapeSqlComment(column.columnComment)}'`);
    }
    return parts.join(" ");
  });
  const primaryKeys = (table.columns || []).filter((column) => column.isPrimaryKey).map((column) => quoteIdentifier(dbType, column.columnName));
  if (primaryKeys.length > 0) {
    columnLines.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
  }

  if (dbType === "postgresql") {
    const createSql = `CREATE TABLE ${replaceExisting ? "" : "IF NOT EXISTS "}${quotedTableName} (\n  ${columnLines.join(",\n  ")}\n);`;
    const indexSql = (table.indexes || []).map((index) =>
      `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(dbType, index.indexName)} ON ${quotedTableName} (${index.columnNames.map((columnName) => quoteIdentifier(dbType, columnName)).join(", ")});`
    );
    const tableCommentSql = tableLevelComment
      ? [`COMMENT ON TABLE ${quotedTableName} IS '${escapeSqlComment(tableLevelComment)}';`]
      : [];
    const columnCommentSql = (table.columns || [])
      .filter((column) => column.columnComment)
      .map((column) => `COMMENT ON COLUMN ${quotedTableName}.${quoteIdentifier(dbType, column.columnName)} IS '${escapeSqlComment(column.columnComment)}';`);
    return [
      ...(schema && includeSchemaCreate ? [`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(dbType, schema)};`] : []),
      ...(replaceExisting ? [`DROP TABLE IF EXISTS ${quotedTableName} CASCADE;`] : []),
      createSql,
      ...indexSql,
      ...tableCommentSql,
      ...columnCommentSql,
    ];
  }

  const indexSql = (table.indexes || []).map((index) =>
    `${index.indexType === "UNIQUE" ? "UNIQUE KEY" : "KEY"} ${quoteIdentifier(dbType, index.indexName)} (${index.columnNames.map((columnName) => quoteIdentifier(dbType, columnName)).join(", ")})`
  );
  return [
    ...(replaceExisting ? [`DROP TABLE IF EXISTS ${quotedTableName};`] : []),
    `CREATE TABLE ${replaceExisting ? "" : "IF NOT EXISTS "}${quotedTableName} (\n  ${[...columnLines, ...indexSql].join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${escapeSqlComment(tableLevelComment)}';`
  ];
}

function buildTableDdl(table, dbType) {
  return buildTableDeploymentStatements(table, dbType).join("\n");
}

function buildPhysicalModelSummary(model) {
  const tables = Array.isArray(model?.tables) ? model.tables : [];
  return {
    tableCount: tables.length,
    businessTableCount: tables.filter((item) => item.tableKind === "BUSINESS").length,
    dictionaryTableCount: tables.filter((item) => item.tableKind === "DICTIONARY").length,
    columnCount: tables.reduce((sum, item) => sum + (Array.isArray(item.columns) ? item.columns.length : 0), 0),
    indexCount: tables.reduce((sum, item) => sum + (Array.isArray(item.indexes) ? item.indexes.length : 0), 0),
    relationCount: Array.isArray(model?.relations) ? model.relations.length : 0,
  };
}

function normalizePhysicalIdentifier(value, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 128);
  return normalized || normalizeCode(fallback, "item");
}

function inferPhysicalColumnType(columnName, dbType) {
  const normalizedDbType = normalizeDbType(dbType);
  const fieldType = buildFieldType(columnName);
  if (fieldType === "NUMBER") return "BIGINT";
  if (fieldType === "DATE") return "DATE";
  if (fieldType === "DATETIME") return normalizedDbType === "postgresql" ? "TIMESTAMP" : "DATETIME";
  if (fieldType === "BOOLEAN") return normalizedDbType === "postgresql" ? "BOOLEAN" : "TINYINT(1)";
  return "VARCHAR(255)";
}

function normalizePhysicalTableKind(value) {
  return String(value || "").trim().toUpperCase() === "DICTIONARY" ? "DICTIONARY" : "BUSINESS";
}

function normalizePhysicalBusinessRole(value, tableKind, logicalTableName) {
  if (tableKind === "DICTIONARY") {
    return "DICTIONARY";
  }
  const normalized = text(value, 32).toUpperCase();
  if (["MASTER", "TRANSACTION", "DETAIL", "BRIDGE", "LOG", "SNAPSHOT", "DICTIONARY"].includes(normalized)) {
    return normalized;
  }
  return inferBusinessRole(logicalTableName);
}

function normalizePhysicalDefaultValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (isNullDefaultExpression(normalized)) {
      return null;
    }
    return text(normalized, 255) || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    return text(JSON.stringify(value), 255) || null;
  }
  return text(value, 255) || null;
}

function isNullDefaultExpression(value) {
  if (value === null || value === undefined) {
    return false;
  }
  return /^null(?:::.*)?$/i.test(String(value).trim());
}

function compileEditablePhysicalModel({
  physicalModel,
  basePhysicalModel,
  instance,
  template,
  logicalVersionNo,
  dbType,
}) {
  const normalizedDbType = normalizeDbType(dbType);
  const rawTables = Array.isArray(physicalModel?.tables) ? physicalModel.tables : [];
  if (rawTables.length === 0) {
    throw new AppError("物理模型至少需要保留一张表", 400);
  }

  const tables = rawTables.map((rawTable, tableIndex) => {
    const tableKind = normalizePhysicalTableKind(rawTable?.tableKind);
    const logicalTableName = text(
      rawTable?.logicalTableName || rawTable?.logicalLabel || rawTable?.physicalTableName || `table_${tableIndex + 1}`,
      128
    ) || `table_${tableIndex + 1}`;
    const logicalLabel = text(rawTable?.logicalLabel || logicalTableName, 128) || logicalTableName;
    const physicalTableName = normalizePhysicalIdentifier(
      rawTable?.physicalTableName || logicalTableName,
      `table_${tableIndex + 1}`
    );
    const rawColumns = Array.isArray(rawTable?.columns) ? rawTable.columns : [];
    if (rawColumns.length === 0) {
      throw new AppError(`表 ${logicalTableName} 至少需要保留一个字段`, 400);
    }

    const columns = rawColumns.map((rawColumn, columnIndex) => ({
      columnName: normalizePhysicalIdentifier(
        rawColumn?.columnName || rawColumn?.sourceFieldName || `column_${columnIndex + 1}`,
        `column_${columnIndex + 1}`
      ),
      columnType: text(rawColumn?.columnType, 64).toUpperCase() || inferPhysicalColumnType(rawColumn?.columnName, normalizedDbType),
      isNullable: Boolean(rawColumn?.isNullable),
      isPrimaryKey: Boolean(rawColumn?.isPrimaryKey),
      defaultValue: normalizePhysicalDefaultValue(rawColumn?.defaultValue),
      columnComment: text(rawColumn?.columnComment, 512) || null,
      sourceFieldName: text(rawColumn?.sourceFieldName, 128) || normalizePhysicalIdentifier(rawColumn?.columnName || `column_${columnIndex + 1}`, `column_${columnIndex + 1}`),
    }));

    const duplicateColumnNames = [...new Set(
      columns
        .map((column) => String(column.columnName || ""))
        .filter((columnName, index, list) => columnName && list.indexOf(columnName) !== index)
    )];
    if (duplicateColumnNames.length > 0) {
      throw new AppError(`表 ${logicalTableName} 存在重复字段名: ${duplicateColumnNames.join(", ")}`, 400);
    }

    if (!columns.some((column) => column.isPrimaryKey)) {
      columns[0].isPrimaryKey = true;
    }
    columns.forEach((column) => {
      if (column.isPrimaryKey) {
        column.isNullable = false;
      }
    });

    const indexes = buildIndexDefinitions(columns.map((column) => ({
      ...column,
      logicalTableName,
    })));
    const normalizedTable = {
      tableKind,
      logicalTableName,
      logicalLabel,
      physicalTableName,
      tableComment: text(rawTable?.tableComment, 512) || null,
      businessRole: normalizePhysicalBusinessRole(rawTable?.businessRole, tableKind, logicalTableName),
      columns,
      indexes,
    };
    return {
      ...normalizedTable,
      deploymentStatements: buildTableDeploymentStatements(normalizedTable, normalizedDbType),
      ddl: buildTableDdl(normalizedTable, normalizedDbType),
    };
  });

  const duplicatePhysicalTableNames = [...new Set(
    tables
      .map((table) => String(table.physicalTableName || ""))
      .filter((tableName, index, list) => tableName && list.indexOf(tableName) !== index)
  )];
  if (duplicatePhysicalTableNames.length > 0) {
    throw new AppError(`存在重复物理表名: ${duplicatePhysicalTableNames.join(", ")}`, 400);
  }

  const tableNameMap = new Map(tables.map((table) => [String(table.logicalTableName || ""), String(table.physicalTableName || "")]));
  const tableFieldMap = new Map(tables.map((table) => [
    String(table.logicalTableName || ""),
    new Set(
      (Array.isArray(table.columns) ? table.columns : [])
        .flatMap((column) => [text(column?.sourceFieldName, 128), text(column?.columnName, 128)])
        .filter(Boolean)
    ),
  ]));
  const rawRelations = Array.isArray(physicalModel?.relations)
    ? physicalModel.relations
    : (Array.isArray(basePhysicalModel?.relations) ? basePhysicalModel.relations : []);
  const relations = rawRelations
    .map((relation) => {
      const fromTable = text(relation?.fromTable, 128);
      const toTable = text(relation?.toTable, 128);
      const fromField = text(relation?.fromField, 128);
      const toField = text(relation?.toField, 128);
      return {
        fromTable,
        fromField,
        toTable,
        toField,
        relationType: normalizeRelationType(relation?.relationType),
        fromPhysicalTableName: tableNameMap.get(fromTable) || null,
        toPhysicalTableName: tableNameMap.get(toTable) || null,
      };
    })
    .filter((relation) => {
      if (!relation.fromTable || !relation.toTable || !relation.fromField || !relation.toField) {
        return false;
      }
      const fromFields = tableFieldMap.get(relation.fromTable);
      const toFields = tableFieldMap.get(relation.toTable);
      return Boolean(
        relation.fromPhysicalTableName
        && relation.toPhysicalTableName
        && fromFields?.has(relation.fromField)
        && toFields?.has(relation.toField)
      );
    });

  const baseMeta = safeObject(basePhysicalModel?.meta);
  const generatedAt = new Date().toISOString();
  const nextPhysicalModel = {
    meta: {
      ...baseMeta,
      generatedAt,
      dbType: normalizedDbType,
      templateId: template.id,
      templateName: template.templateName,
      templateCode: template.templateCode,
      instanceId: instance.id,
      instanceName: instance.instanceName,
      instanceCode: instance.instanceCode,
      sourceLogicalVersion: Number(logicalVersionNo || baseMeta.sourceLogicalVersion || instance.currentLogicalVersion || 0) || null,
    },
    tables,
    relations,
  };
  nextPhysicalModel.summary = buildPhysicalModelSummary(nextPhysicalModel);
  return {
    physicalModel: nextPhysicalModel,
    ddlBundle: {
      dbType: normalizedDbType,
      generatedAt,
      script: tables.map((table) => table.ddl).join("\n\n"),
      statements: tables.map((table) => ({
        tableKind: table.tableKind,
        logicalTableName: table.logicalTableName,
        physicalTableName: table.physicalTableName,
        deploymentStatements: table.deploymentStatements,
        ddl: table.ddl,
      })),
    },
  };
}

function compilePhysicalModel(template, logicalModel, instance, dbType) {
  const normalizedDbType = normalizeDbType(dbType);
  const businessTables = (Array.isArray(logicalModel?.tables) ? logicalModel.tables : []).map((table) =>
    buildBusinessTablePhysicalDefinition(table, instance, normalizedDbType)
  );
  const dictionaryTables = (Array.isArray(logicalModel?.dictTables) ? logicalModel.dictTables : []).map((dictTable) =>
    buildDictionaryTablePhysicalDefinitionV2(dictTable, instance, normalizedDbType)
  );
  const tables = [...businessTables, ...dictionaryTables].map((table) => ({
    ...table,
    deploymentStatements: buildTableDeploymentStatements(table, normalizedDbType),
    ddl: buildTableDdl(table, normalizedDbType),
  }));
  const physicalTableNames = tables.map((table) => String(table.physicalTableName || ""));
  const duplicatePhysicalTableNames = [...new Set(
    physicalTableNames.filter((tableName, index) => tableName && physicalTableNames.indexOf(tableName) !== index)
  )];
  if (duplicatePhysicalTableNames.length > 0) {
    throw new AppError(`\u7269\u7406\u8868\u547d\u540d\u51b2\u7a81: ${duplicatePhysicalTableNames.join(", ")}`, 500);
  }
  const tableNameMap = new Map(tables.map((table) => [String(table.logicalTableName || ""), table.physicalTableName]));
  const relations = (Array.isArray(logicalModel?.relations) ? logicalModel.relations : []).map((relation) => ({
    fromTable: relation.fromTable,
    fromField: relation.fromField,
    toTable: relation.toTable,
    toField: relation.toField,
    relationType: relation.relationType || "N:1",
    fromPhysicalTableName: tableNameMap.get(String(relation.fromTable || "")) || null,
    toPhysicalTableName: tableNameMap.get(String(relation.toTable || "")) || null,
  }));
  const physicalModel = {
    meta: {
      generatedAt: new Date().toISOString(),
      dbType: normalizedDbType,
      templateId: template.id,
      templateName: template.templateName,
      templateCode: template.templateCode,
      instanceId: instance.id,
      instanceName: instance.instanceName,
      instanceCode: instance.instanceCode,
      sourceLogicalVersion: template.currentLogicalVersion,
    },
    tables,
    relations,
  };
  physicalModel.summary = buildPhysicalModelSummary(physicalModel);
  const ddlBundle = {
    dbType: normalizedDbType,
    generatedAt: physicalModel.meta.generatedAt,
    script: tables.map((table) => table.ddl).join("\n\n"),
    statements: tables.map((table) => ({
      tableKind: table.tableKind,
      logicalTableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      deploymentStatements: table.deploymentStatements,
      ddl: table.ddl,
    })),
  };
  return { physicalModel, ddlBundle };
}

function sanitizePhysicalDesignDocText(value, maxLength = 1600) {
  const normalized = String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\s*([#>*-]+|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, maxLength);
}

function normalizePhysicalDesignDocStringArray(value, maxItems = 8, itemMaxLength = 200) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[\n；;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  return rawItems
    .map((item) => sanitizePhysicalDesignDocText(item, itemMaxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildPhysicalDesignDocTitle(context) {
  return sanitizePhysicalDesignDocText(
    `${context?.instance?.instanceName || context?.template?.templateName || "业务实例"}数据库设计说明书摘要`,
    96
  );
}

function sanitizeDownloadFileName(value, fallback = "数据库设计说明书摘要") {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return normalized || fallback;
}

function buildPhysicalDesignDocFallbackSummary(context) {
  const logicalModel = context?.logicalModel || {};
  const physicalModel = context?.physicalModel || {};
  const modules = Array.isArray(logicalModel.modules) ? logicalModel.modules : [];
  const logicalTables = Array.isArray(logicalModel.tables) ? logicalModel.tables : [];
  const physicalTables = Array.isArray(physicalModel.tables) ? physicalModel.tables : [];
  const relations = Array.isArray(physicalModel.relations) ? physicalModel.relations : [];
  const moduleDesigns = (modules.length > 0 ? modules : logicalTables.slice(0, 6).map((table) => ({
    moduleLabel: table.tableLabel || table.tableName,
    summary: `${table.tableLabel || table.tableName}承担${table.businessRole || "业务"}数据管理职责。`,
    tableNames: [table.tableName],
  }))).map((module) => ({
    moduleLabel: sanitizePhysicalDesignDocText(module?.moduleLabel || "业务模块", 80),
    summary: sanitizePhysicalDesignDocText(
      module?.summary
        || `${module?.moduleLabel || "该模块"}围绕${normalizePhysicalDesignDocStringArray(module?.tableNames || [], 4, 64).join("、") || "核心业务对象"}组织数据结构。`,
      220
    ),
    tableNames: normalizePhysicalDesignDocStringArray(module?.tableNames || [], 12, 64),
  }));
  const tableHighlights = physicalTables.slice(0, 12).map((table) => {
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    return {
      tableName: String(table?.logicalTableName || "").trim(),
      summary: sanitizePhysicalDesignDocText(
        `${table?.logicalLabel || table?.logicalTableName || "业务表"}用于承载${table?.businessRole || "核心"}数据，物理表名为 ${table?.physicalTableName || "-"}。`,
        220
      ),
      keyFields: columns
        .filter((column) => column?.isPrimaryKey || String(column?.columnName || "").endsWith("_id") || String(column?.columnName || "").endsWith("_status"))
        .slice(0, 5)
        .map((column) => sanitizePhysicalDesignDocText(column?.columnComment || column?.columnName || "", 60))
        .filter(Boolean),
      usageNotes: [
        `字段总数 ${columns.length}，索引数量 ${Array.isArray(table?.indexes) ? table.indexes.length : 0}。`,
        table?.tableComment ? sanitizePhysicalDesignDocText(table.tableComment, 120) : "",
      ].filter(Boolean),
    };
  });
  return {
    documentTitle: sanitizePhysicalDesignDocText(`${context?.instance?.instanceName || context?.template?.templateName || "业务系统"}数据库设计说明书`, 96),
    systemOverview: sanitizePhysicalDesignDocText(
      `${context?.instance?.instanceName || context?.template?.templateName || "当前系统"}基于逻辑模型 V${context?.logicalVersionNo || "-"} 形成 ${String(context?.dbType || "mysql").toUpperCase()} 物理数据库设计，共包含 ${physicalTables.length} 张物理表和 ${relations.length} 条关系约束。`,
      260
    ),
    businessScope: [
      `业务模板：${context?.template?.templateName || "-"}`,
      `实例名称：${context?.instance?.instanceName || "-"}`,
      `数据库类型：${String(context?.dbType || "-").toUpperCase()}`,
      `覆盖主题：${logicalTables.length} 张逻辑表、${physicalTables.length} 张物理表`,
    ],
    designPrinciples: [
      "以逻辑模型中的业务对象、字典约束与关系链路为核心，保持业务边界清晰。",
      "物理表命名、字段类型、主键索引与部署脚本保持一致，便于实施与运维。",
      String(context?.dbType || "").toLowerCase() === "postgresql"
        ? "结合 PostgreSQL 方言生成表、索引与注释语句，兼顾结构可读性与部署一致性。"
        : "结合 MySQL 方言生成建表与索引语句，兼顾结构可读性与部署一致性。",
    ],
    moduleDesigns,
    tableHighlights,
    relationSummary: sanitizePhysicalDesignDocText(
      relations.length > 0
        ? `模型中识别出 ${relations.length} 条表间关系，主要用于承接主数据、状态记录、过程台账与字典约束之间的关联。`
        : "当前模型未显式沉淀复杂关系链路，表间关联主要通过主键、状态字段和业务编码维持。",
      220
    ),
    deploymentRecommendations: [
      "优先按物理表部署顺序创建主表、从表和字典表，保持依赖关系稳定。",
      "上线前应结合目标数据源核验字符集、时区、命名长度和 JSON 字段兼容性。",
      "建议将当前说明书与 DDL 脚本、版本号和部署记录一并归档。",
    ],
    risksAndAssumptions: [
      "说明书基于当前逻辑模型与物理模型版本生成，如后续模型调整需同步更新文档。",
      "字段取值规则、数据量规划和真实部署参数仍需结合具体实施环境复核。",
    ],
  };
}

function buildPhysicalDesignDocPromptPayload(context) {
  const logicalModel = context?.logicalModel || {};
  const physicalModel = context?.physicalModel || {};
  const logicalTables = Array.isArray(logicalModel.tables) ? logicalModel.tables : [];
  const dictTables = Array.isArray(logicalModel.dictTables) ? logicalModel.dictTables : [];
  const physicalTables = Array.isArray(physicalModel.tables) ? physicalModel.tables : [];
  return {
    instance: {
      id: context?.instance?.id || null,
      instanceName: context?.instance?.instanceName || "",
      instanceCode: context?.instance?.instanceCode || "",
      templateName: context?.template?.templateName || "",
      templateCode: context?.template?.templateCode || "",
      dbType: context?.dbType || "mysql",
      logicalVersionNo: context?.logicalVersionNo || null,
      physicalVersionNo: context?.physicalVersionNo || null,
      generationMode: context?.generationMode || "versioned",
    },
    logicalSummary: {
      moduleCount: Array.isArray(logicalModel.modules) ? logicalModel.modules.length : 0,
      businessTableCount: logicalTables.length,
      dictionaryTableCount: dictTables.length,
      relationCount: Array.isArray(logicalModel.relations) ? logicalModel.relations.length : 0,
      modules: (Array.isArray(logicalModel.modules) ? logicalModel.modules : []).map((module) => ({
        moduleKey: module?.moduleKey || "",
        moduleLabel: module?.moduleLabel || "",
        summary: module?.summary || "",
        tableNames: Array.isArray(module?.tableNames) ? module.tableNames : [],
      })),
      tables: logicalTables.map((table) => ({
        tableName: table?.tableName || "",
        tableLabel: table?.tableLabel || "",
        tableComment: table?.tableComment || "",
        businessRole: table?.businessRole || "",
        keyInfoItems: Array.isArray(table?.keyInfoItems) ? table.keyInfoItems : [],
        fields: (Array.isArray(table?.fields) ? table.fields : []).slice(0, 12).map((field) => ({
          fieldName: field?.fieldName || "",
          fieldComment: field?.fieldComment || "",
          fieldType: field?.fieldType || "",
          required: Boolean(field?.required),
          businessSemantic: field?.businessSemantic || "",
        })),
      })),
      dictTables: dictTables.map((table) => ({
        dictType: table?.dictType || "",
        dictName: table?.dictName || "",
        itemCount: Array.isArray(table?.items) ? table.items.length : 0,
      })),
      relations: (Array.isArray(logicalModel.relations) ? logicalModel.relations : []).map((relation) => ({
        fromTable: relation?.fromTable || "",
        fromField: relation?.fromField || "",
        toTable: relation?.toTable || "",
        toField: relation?.toField || "",
        relationType: relation?.relationType || "",
      })),
    },
    physicalSummary: {
      tableCount: physicalTables.length,
      relationCount: Array.isArray(physicalModel.relations) ? physicalModel.relations.length : 0,
      tables: physicalTables.map((table) => ({
        logicalTableName: table?.logicalTableName || "",
        logicalLabel: table?.logicalLabel || "",
        physicalTableName: table?.physicalTableName || "",
        tableKind: table?.tableKind || "",
        businessRole: table?.businessRole || "",
        tableComment: table?.tableComment || "",
        columnCount: Array.isArray(table?.columns) ? table.columns.length : 0,
        indexCount: Array.isArray(table?.indexes) ? table.indexes.length : 0,
        columns: (Array.isArray(table?.columns) ? table.columns : []).slice(0, 10).map((column) => ({
          columnName: column?.columnName || "",
          columnType: column?.columnType || "",
          isNullable: Boolean(column?.isNullable),
          isPrimaryKey: Boolean(column?.isPrimaryKey),
          sourceFieldName: column?.sourceFieldName || "",
          columnComment: column?.columnComment || "",
        })),
      })),
    },
    ddlSummary: {
      statementCount: Array.isArray(context?.ddlBundle?.statements) ? context.ddlBundle.statements.length : 0,
      scriptPreview: String(context?.ddlBundle?.script || "").slice(0, 2400),
    },
    userSummary: text(context?.requestSummary, 1024) || "",
  };
}

function normalizePhysicalDesignDocSummary(parsed, context) {
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : {};
  const fallback = buildPhysicalDesignDocFallbackSummary(context);
  const tableNameSet = new Set(
    (Array.isArray(context?.physicalModel?.tables) ? context.physicalModel.tables : [])
      .map((table) => String(table?.logicalTableName || "").trim())
      .filter(Boolean)
  );
  const normalizedModuleDesigns = (Array.isArray(source.moduleDesigns) ? source.moduleDesigns : fallback.moduleDesigns)
    .map((item) => ({
      moduleLabel: sanitizePhysicalDesignDocText(item?.moduleLabel || "", 80),
      summary: sanitizePhysicalDesignDocText(item?.summary || "", 240),
      tableNames: normalizePhysicalDesignDocStringArray(item?.tableNames || [], 12, 64)
        .filter((tableName) => !tableNameSet.size || tableNameSet.has(tableName)),
    }))
    .filter((item) => item.moduleLabel || item.summary || item.tableNames.length > 0);
  const normalizedTableHighlights = (Array.isArray(source.tableHighlights) ? source.tableHighlights : fallback.tableHighlights)
    .map((item) => ({
      tableName: String(item?.tableName || "").trim(),
      summary: sanitizePhysicalDesignDocText(item?.summary || "", 240),
      keyFields: normalizePhysicalDesignDocStringArray(item?.keyFields || [], 8, 60),
      usageNotes: normalizePhysicalDesignDocStringArray(item?.usageNotes || [], 6, 120),
    }))
    .filter((item) => item.tableName && tableNameSet.has(item.tableName));

  return {
    documentTitle: buildPhysicalDesignDocTitle(context),
    systemOverview: sanitizePhysicalDesignDocText(source.systemOverview || fallback.systemOverview, 320) || fallback.systemOverview,
    businessScope: normalizePhysicalDesignDocStringArray(source.businessScope || fallback.businessScope, 8, 120).length > 0
      ? normalizePhysicalDesignDocStringArray(source.businessScope || fallback.businessScope, 8, 120)
      : fallback.businessScope,
    designPrinciples: normalizePhysicalDesignDocStringArray(source.designPrinciples || fallback.designPrinciples, 8, 160).length > 0
      ? normalizePhysicalDesignDocStringArray(source.designPrinciples || fallback.designPrinciples, 8, 160)
      : fallback.designPrinciples,
    moduleDesigns: normalizedModuleDesigns.length > 0 ? normalizedModuleDesigns : fallback.moduleDesigns,
    tableHighlights: normalizedTableHighlights.length > 0 ? normalizedTableHighlights : fallback.tableHighlights,
    relationSummary: sanitizePhysicalDesignDocText(source.relationSummary || fallback.relationSummary, 240) || fallback.relationSummary,
    deploymentRecommendations: normalizePhysicalDesignDocStringArray(source.deploymentRecommendations || fallback.deploymentRecommendations, 8, 160).length > 0
      ? normalizePhysicalDesignDocStringArray(source.deploymentRecommendations || fallback.deploymentRecommendations, 8, 160)
      : fallback.deploymentRecommendations,
    risksAndAssumptions: normalizePhysicalDesignDocStringArray(source.risksAndAssumptions || fallback.risksAndAssumptions, 8, 160).length > 0
      ? normalizePhysicalDesignDocStringArray(source.risksAndAssumptions || fallback.risksAndAssumptions, 8, 160)
      : fallback.risksAndAssumptions,
  };
}

async function summarizePhysicalDesignDoc(context) {
  const fallback = buildPhysicalDesignDocFallbackSummary(context);
  const runtimeOptions = await resolvePhysicalDesignDocRuntimeOptions();
  if (!runtimeOptions?.provider) {
    return normalizePhysicalDesignDocSummary(fallback, context);
  }
  try {
    const promptPayload = buildPhysicalDesignDocPromptPayload(context);
    const response = await modelProviderService.generateChatCompletion(
      runtimeOptions.provider,
      [
        { role: "system", content: runtimeOptions.systemPrompt },
        {
          role: "user",
          content: promptRuntime.renderPromptTemplate(runtimeOptions.userPrompt, { input: promptPayload }) || JSON.stringify(promptPayload, null, 2),
        },
      ],
      { temperature: runtimeOptions.temperature, maxTokens: runtimeOptions.maxTokens }
    );
    return normalizePhysicalDesignDocSummary(tryParseModelJson(response.content), context);
  } catch (_error) {
    return normalizePhysicalDesignDocSummary(fallback, context);
  }
}

function buildPhysicalDesignDocFileName(context) {
  return `${sanitizeDownloadFileName(buildPhysicalDesignDocTitle(context))}.docx`;
}

function createPhysicalDesignDocTextRun(value, options = {}) {
  return new TextRun({
    text: String(value || ""),
    bold: Boolean(options.bold),
    italics: Boolean(options.italics),
    font: options.font || "Microsoft YaHei",
    size: Number(options.size || 22),
    color: options.color || "1F2937",
    break: Number(options.break || 0),
  });
}

function createPhysicalDesignDocParagraph(value, options = {}) {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    pageBreakBefore: Boolean(options.pageBreakBefore),
    spacing: {
      before: Number(options.before || 0),
      after: Number(options.after ?? 140),
      line: Number(options.line || 300),
    },
    children: [
      createPhysicalDesignDocTextRun(value, {
        bold: options.bold,
        size: options.size,
        color: options.color,
        font: options.font,
      }),
    ],
  });
}

function createPhysicalDesignDocBulletParagraph(value) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 280 },
    children: [createPhysicalDesignDocTextRun(value, { size: 21 })],
  });
}

function createPhysicalDesignDocTable(headers, rows, options = {}) {
  const normalizedHeaders = Array.isArray(headers) ? headers : [];
  const normalizedRows = Array.isArray(rows) ? rows : [];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: options.fixed ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "BFC6D1" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE5" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D7DDE5" },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: normalizedHeaders.map((header, index) => new TableCell({
          width: Array.isArray(options.widths) && options.widths[index]
            ? { size: Number(options.widths[index]), type: WidthType.PERCENTAGE }
            : undefined,
          children: [
            new Paragraph({
              spacing: { after: 40 },
              children: [createPhysicalDesignDocTextRun(header, { bold: true, size: Number(options.headerFontSize || 20) })],
            }),
          ],
        })),
      }),
      ...normalizedRows.map((row) => new TableRow({
        children: row.map((cell, index) => new TableCell({
          width: Array.isArray(options.widths) && options.widths[index]
            ? { size: Number(options.widths[index]), type: WidthType.PERCENTAGE }
            : undefined,
          children: [
            new Paragraph({
              spacing: { after: 40, line: 260 },
              children: [createPhysicalDesignDocTextRun(String(cell ?? "-"), {
                size: options.codeColumns?.includes(index)
                  ? Number(options.codeFontSize || 17)
                  : Number(options.fontSize || 20),
                font: options.codeColumns?.includes(index) ? "Consolas" : "Microsoft YaHei",
              })],
            }),
          ],
        })),
      })),
    ],
  });
}

function buildPhysicalDesignDocSectionParagraphs(title, content) {
  const paragraphs = [createPhysicalDesignDocParagraph(title, { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 120, after: 180 })];
  const lines = sanitizePhysicalDesignDocText(content, 4000)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    paragraphs.push(createPhysicalDesignDocParagraph("无。", { size: 22 }));
    return paragraphs;
  }
  lines.forEach((line) => {
    paragraphs.push(createPhysicalDesignDocParagraph(line, { size: 22 }));
  });
  return paragraphs;
}

async function buildPhysicalDesignDocBuffer(context, summary) {
  const physicalTables = Array.isArray(context?.physicalModel?.tables) ? context.physicalModel.tables : [];
  const physicalRelations = Array.isArray(context?.physicalModel?.relations) ? context.physicalModel.relations : [];
  const documentTitle = buildPhysicalDesignDocTitle(context);
  const logicalTableMap = new Map(
    (Array.isArray(context?.logicalModel?.tables) ? context.logicalModel.tables : [])
      .map((table) => [String(table?.tableName || "").trim(), table])
  );
  const tableHighlightMap = new Map(
    (Array.isArray(summary?.tableHighlights) ? summary.tableHighlights : [])
      .map((item) => [String(item?.tableName || "").trim(), item])
  );

  const children = [
    createPhysicalDesignDocParagraph(documentTitle, {
      alignment: AlignmentType.CENTER,
      bold: true,
      size: 34,
      after: 260,
    }),
    createPhysicalDesignDocTable(
      ["项目项", "内容"],
      [
        ["业务实例", context?.instance?.instanceName || "-"],
        ["实例编码", context?.instance?.instanceCode || "-"],
        ["业务模板", context?.template?.templateName || "-"],
        [`逻辑模型版本`, `V${context?.logicalVersionNo || "-"}`],
        ["物理模型版本", context?.physicalVersionNo ? `V${context.physicalVersionNo}` : "预览版"],
        ["数据库类型", String(context?.dbType || "-").toUpperCase()],
        ["生成时间", formatDateTime(context?.generatedAt || new Date().toISOString())],
      ],
      { widths: [26, 74] }
    ),
    ...buildPhysicalDesignDocSectionParagraphs("1. 文档概述", summary?.systemOverview || ""),
    createPhysicalDesignDocParagraph("1.1 业务范围", { heading: HeadingLevel.HEADING_2, bold: true, size: 24, after: 120 }),
    ...(summary?.businessScope || []).map((item) => createPhysicalDesignDocBulletParagraph(item)),
    createPhysicalDesignDocParagraph("1.2 设计原则", { heading: HeadingLevel.HEADING_2, bold: true, size: 24, after: 120 }),
    ...(summary?.designPrinciples || []).map((item) => createPhysicalDesignDocBulletParagraph(item)),
    createPhysicalDesignDocParagraph("2. 模块设计说明", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 120, after: 160 }),
  ];

  (Array.isArray(summary?.moduleDesigns) ? summary.moduleDesigns : []).forEach((module, index) => {
    children.push(
      createPhysicalDesignDocParagraph(`2.${index + 1} ${module.moduleLabel || `模块${index + 1}`}`, {
        heading: HeadingLevel.HEADING_2,
        bold: true,
        size: 24,
        after: 120,
      }),
      createPhysicalDesignDocParagraph(module.summary || "无。", { size: 22 })
    );
    const moduleTableNames = Array.isArray(module.tableNames) ? module.tableNames : [];
    if (moduleTableNames.length > 0) {
      children.push(createPhysicalDesignDocBulletParagraph(`涉及逻辑表：${moduleTableNames.join("、")}`));
    }
  });

  children.push(
    createPhysicalDesignDocParagraph("3. 关系与约束说明", {
      heading: HeadingLevel.HEADING_1,
      bold: true,
      size: 28,
      before: 160,
      after: 160,
    }),
    createPhysicalDesignDocParagraph(summary?.relationSummary || "无。", { size: 22 })
  );

  if (physicalRelations.length > 0) {
    children.push(createPhysicalDesignDocTable(
      ["序号", "逻辑关系", "关联字段", "关系类型", "物理落表"],
      physicalRelations.map((relation, index) => [
        String(index + 1),
        `${relation?.fromTable || "-"} -> ${relation?.toTable || "-"}`,
        `${relation?.fromField || "-"} -> ${relation?.toField || "-"}`,
        relation?.relationType || "-",
        `${relation?.fromPhysicalTableName || "-"} -> ${relation?.toPhysicalTableName || "-"}`,
      ]),
      {
        widths: [6, 24, 22, 10, 38],
        headerFontSize: 18,
        fontSize: 18,
        codeFontSize: 15,
        codeColumns: [1, 2, 4],
      }
    ));
  } else {
    children.push(createPhysicalDesignDocParagraph("当前版本未沉淀显式的表间关系记录。", { size: 22 }));
  }

  children.push(
    createPhysicalDesignDocParagraph("4. 物理表设计明细", {
      heading: HeadingLevel.HEADING_1,
      bold: true,
      size: 28,
      before: 160,
      after: 180,
    })
  );

  physicalTables.forEach((table, index) => {
    const logicalTable = logicalTableMap.get(String(table?.logicalTableName || "").trim()) || {};
    const tableHighlight = tableHighlightMap.get(String(table?.logicalTableName || "").trim()) || {};
    const columns = Array.isArray(table?.columns) ? table.columns : [];
    const indexes = Array.isArray(table?.indexes) ? table.indexes : [];

    children.push(
      createPhysicalDesignDocParagraph(`4.${index + 1} ${table?.logicalLabel || table?.logicalTableName || `表${index + 1}`}`, {
        heading: HeadingLevel.HEADING_2,
        bold: true,
        size: 24,
        pageBreakBefore: index > 0,
        after: 120,
      }),
      createPhysicalDesignDocTable(
        ["项目项", "内容"],
        [
          ["逻辑表名", table?.logicalTableName || "-"],
          ["物理表名", table?.physicalTableName || "-"],
          ["表类型", table?.tableKind || "-"],
          ["业务角色", table?.businessRole || "-"],
          ["字段数量", String(columns.length)],
          ["索引数量", String(indexes.length)],
          ["表说明", table?.tableComment || logicalTable?.tableComment || "-"],
        ],
        { widths: [24, 76], codeColumns: [1] }
      )
    );

    if (tableHighlight?.summary) {
      children.push(createPhysicalDesignDocParagraph(`设计说明：${tableHighlight.summary}`, { size: 22 }));
    }
    if (Array.isArray(tableHighlight?.keyFields) && tableHighlight.keyFields.length > 0) {
      children.push(createPhysicalDesignDocBulletParagraph(`关键字段：${tableHighlight.keyFields.join("、")}`));
    }
    if (Array.isArray(tableHighlight?.usageNotes)) {
      tableHighlight.usageNotes.forEach((item) => children.push(createPhysicalDesignDocBulletParagraph(`使用说明：${item}`)));
    }

    children.push(createPhysicalDesignDocParagraph("字段清单", { heading: HeadingLevel.HEADING_3, bold: true, size: 22, after: 100 }));
    children.push(createPhysicalDesignDocTable(
      ["序号", "字段名", "类型", "约束", "来源逻辑字段", "字段说明"],
      columns.map((column, columnIndex) => [
        String(columnIndex + 1),
        column?.columnName || "-",
        column?.columnType || "-",
        `${column?.isPrimaryKey ? "PK" : "普通"}/${column?.isNullable ? "可空" : "非空"}`,
        column?.sourceFieldName || "-",
        column?.columnComment || "-",
      ]),
      {
        widths: [6, 16, 14, 12, 18, 34],
        headerFontSize: 18,
        fontSize: 18,
        codeFontSize: 15,
        codeColumns: [1, 2, 4],
      }
    ));

    if (indexes.length > 0) {
      children.push(createPhysicalDesignDocParagraph("索引设计", { heading: HeadingLevel.HEADING_3, bold: true, size: 22, after: 100 }));
      children.push(createPhysicalDesignDocTable(
        ["序号", "索引名", "索引类型", "字段列表"],
        indexes.map((item, itemIndex) => [
          String(itemIndex + 1),
          item?.indexName || "-",
          item?.indexType || "-",
          Array.isArray(item?.columnNames) ? item.columnNames.join(", ") : "-",
        ]),
        {
          widths: [8, 26, 16, 50],
          headerFontSize: 18,
          fontSize: 18,
          codeFontSize: 15,
          codeColumns: [1, 3],
        }
      ));
    }
  });

  children.push(
    createPhysicalDesignDocParagraph("5. 部署建议与风险提示", {
      heading: HeadingLevel.HEADING_1,
      bold: true,
      size: 28,
      before: 160,
      after: 160,
    }),
    createPhysicalDesignDocParagraph("5.1 部署建议", { heading: HeadingLevel.HEADING_2, bold: true, size: 24, after: 120 }),
    ...(summary?.deploymentRecommendations || []).map((item) => createPhysicalDesignDocBulletParagraph(item)),
    createPhysicalDesignDocParagraph("5.2 风险与假设", { heading: HeadingLevel.HEADING_2, bold: true, size: 24, after: 120 }),
    ...(summary?.risksAndAssumptions || []).map((item) => createPhysicalDesignDocBulletParagraph(item)),
    createPhysicalDesignDocParagraph("附录 A. DDL 脚本", { heading: HeadingLevel.HEADING_1, bold: true, size: 28, before: 160, after: 160 })
  );

  physicalTables.forEach((table, index) => {
    children.push(
      createPhysicalDesignDocParagraph(`A.${index + 1} ${table?.physicalTableName || table?.logicalTableName || `table_${index + 1}`}`, {
        heading: HeadingLevel.HEADING_2,
        bold: true,
        size: 24,
        pageBreakBefore: index > 0,
        after: 100,
      })
    );
    String(table?.ddl || "")
      .split(/\r?\n/)
      .forEach((line) => {
        children.push(createPhysicalDesignDocParagraph(line || " ", { size: 18, font: "Consolas", after: 20 }));
      });
  });

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

async function buildPhysicalDesignDocContext(id, payload = {}) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const template = await getBusinessSystemTemplateDetail(instance.templateId);
  const preferredPhysicalVersionNo = payload?.physicalVersionNo
    ? Number(payload.physicalVersionNo)
    : Number(instance.currentPhysicalVersion || 0);
  const requestDbType = normalizeDbType(payload?.dbType || instance.dbType || "mysql");

  if (preferredPhysicalVersionNo) {
    const physicalVersion = await getBusinessSystemInstancePhysicalVersionByVersionNo(id, preferredPhysicalVersionNo);
    const logicalVersion = await getBusinessSystemTemplateLogicalVersionByVersionNo(instance.templateId, physicalVersion.logicalVersionNo);
    if (!logicalVersion?.logicalModel) {
      throw new AppError("对应的逻辑模型版本不存在，无法生成数据库设计说明书", 400);
    }
    return {
      instance,
      template,
      logicalVersionNo: Number(physicalVersion.logicalVersionNo || 0),
      physicalVersionNo: Number(physicalVersion.versionNo || 0),
      logicalModel: logicalVersion.logicalModel,
      physicalModel: safeObject(physicalVersion.physicalModel),
      ddlBundle: safeObject(physicalVersion.ddlBundle),
      dbType: normalizeDbType(physicalVersion.dbType || requestDbType),
      generatedAt: pickLatestDate(physicalVersion.updatedAt, physicalVersion.createdAt),
      generationMode: "versioned",
      requestSummary: text(payload?.summary, 1024) || "",
    };
  }

  if (!template.currentLogicalVersion || !template.currentLogicalModel) {
    throw new AppError("当前实例尚无可用逻辑模型，无法生成数据库设计说明书", 400);
  }

  const compiled = compilePhysicalModel(
    template,
    template.currentLogicalModel,
    {
      id: instance.id,
      instanceCode: instance.instanceCode,
      instanceName: instance.instanceName,
      dbType: requestDbType,
    },
    requestDbType
  );

  return {
    instance,
    template,
    logicalVersionNo: Number(template.currentLogicalVersion || 0),
    physicalVersionNo: null,
    logicalModel: template.currentLogicalModel,
    physicalModel: compiled.physicalModel,
    ddlBundle: compiled.ddlBundle,
    dbType: requestDbType,
    generatedAt: compiled?.physicalModel?.meta?.generatedAt || new Date().toISOString(),
    generationMode: "preview",
    requestSummary: text(payload?.summary, 1024) || "",
  };
}

async function exportBusinessSystemInstancePhysicalDesignDoc(id, payload = {}) {
  const context = await buildPhysicalDesignDocContext(id, payload);
  const summary = await summarizePhysicalDesignDoc(context);
  const buffer = await buildPhysicalDesignDocBuffer(context, summary);
  return {
    fileName: buildPhysicalDesignDocFileName(context),
    buffer,
  };
}

async function executeSqlStatementsOnDataSource(dataSource, statements) {
  const adapter = getDatabaseAdapter(dataSource.sourceType, dataSource.connectionConfig || {});
  const executionLogs = [];
  for (const statement of statements || []) {
    const normalizedStatement = String(statement || "").trim();
    if (!normalizedStatement) continue;
    const result = await adapter.executeStatement(dataSource.connectionConfig, normalizedStatement, {
      databaseName: dataSource.connectionConfig.databaseName,
    });
    executionLogs.push({
      sql: normalizedStatement,
      affectedRows: Number(result?.affectedRows || 0),
    });
  }
  return executionLogs;
}

async function ensureSchemaExistsOnDataSource(dataSource, dbType, schema) {
  const schemaName = text(schema, 64) || null;
  if (dbType !== "postgresql" || !schemaName || schemaName.toLowerCase() === "public") {
    return;
  }
  const adapter = getDatabaseAdapter(dataSource.sourceType, dataSource.connectionConfig || {});
  const result = await adapter.executeQuery(
    dataSource.connectionConfig,
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${escapeSqlComment(schemaName)}' LIMIT 1`,
    {
      databaseName: dataSource.connectionConfig.databaseName,
      resultLimit: 1,
    }
  );
  if (Number(result?.rowCount || 0) > 0) {
    return;
  }
  await executeSqlStatementsOnDataSource(dataSource, [
    `CREATE SCHEMA ${quoteIdentifier(dbType, schemaName)};`,
  ]);
}

async function deployPhysicalModelToDataSource(dataSource, compiled) {
  const dbType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  const schema = dbType === "postgresql" ? dataSource.connectionConfig.schema : null;
  const executionLogs = [];
  if (schema) {
    await ensureSchemaExistsOnDataSource(dataSource, dbType, schema);
  }
  for (const table of compiled?.physicalModel?.tables || []) {
    const tableStatements = buildTableDeploymentStatements(table, dbType, {
      schema,
      replaceExisting: true,
      includeSchemaCreate: false,
    });
    const tableLogs = await executeSqlStatementsOnDataSource(dataSource, tableStatements);
    executionLogs.push({
      logicalTableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      statementCount: tableLogs.length,
    });
  }
  return {
    deployedAt: new Date().toISOString(),
    targetDataSourceId: Number(dataSource.id),
    targetDataSourceName: dataSource.sourceName,
    targetDataSourceCode: dataSource.sourceCode,
    deployedTableCount: executionLogs.length,
    tables: executionLogs,
  };
}

function formatSqlValue(dbType, columnType, value) {
  if (value === null || value === undefined || value === "") {
    return "NULL";
  }
  if (isJsonColumnType(columnType)) {
    if (typeof value === "string") {
      const normalizedValue = value.trim();
      try {
        JSON.parse(normalizedValue);
        return `'${escapeSqlComment(normalizedValue)}'`;
      } catch (error) {
        return `'${escapeSqlComment(JSON.stringify(normalizedValue))}'`;
      }
    }
    return `'${escapeSqlComment(JSON.stringify(value))}'`;
  }
  if (typeof value === "boolean") {
    return dbType === "postgresql"
      ? (value ? "TRUE" : "FALSE")
      : (value ? "1" : "0");
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (value instanceof Date) {
    return `'${escapeSqlComment(formatPreviewDateTime(value))}'`;
  }
  if (typeof value === "object") {
    return `'${escapeSqlComment(JSON.stringify(value))}'`;
  }
  const normalizedValue = String(value);
  if (isNumericColumnType(columnType) && /^-?\d+(\.\d+)?$/.test(normalizedValue.trim())) {
    return normalizedValue.trim();
  }
  return `'${escapeSqlComment(normalizedValue)}'`;
}

function buildInsertStatementsForRows(dataSource, table, rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const dbType = normalizePlatformSourceType(dataSource.sourceType, dataSource.connectionConfig || {});
  const schema = dbType === "postgresql" ? dataSource.connectionConfig.schema : null;
  const batchSize = clampInteger(options?.batchSize, 200, 50, 1000);
  const qualifiedTableName = buildQualifiedTableReference(dbType, table.physicalTableName, schema);
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const primaryKeyColumns = columns.filter((column) => column.isPrimaryKey).map((column) => quoteIdentifier(dbType, column.columnName));
  const columnSql = columns.map((column) => quoteIdentifier(dbType, column.columnName)).join(", ");
  const statements = [];
  for (let start = 0; start < rows.length; start += batchSize) {
    const batchRows = rows.slice(start, start + batchSize);
    const valuesSql = batchRows.map((row) => (
      `(${columns.map((column) => formatSqlValue(dbType, column.columnType, row?.[column.columnName])).join(", ")})`
    )).join(",\n");
    if (dbType === "postgresql" && primaryKeyColumns.length > 0) {
      statements.push(
        `INSERT INTO ${qualifiedTableName} (${columnSql}) VALUES\n${valuesSql}\nON CONFLICT (${primaryKeyColumns.join(", ")}) DO NOTHING;`
      );
      continue;
    }
    if (dbType === "mysql" && primaryKeyColumns.length > 0) {
      statements.push(`INSERT IGNORE INTO ${qualifiedTableName} (${columnSql}) VALUES\n${valuesSql};`);
      continue;
    }
    statements.push(`INSERT INTO ${qualifiedTableName} (${columnSql}) VALUES\n${valuesSql};`);
  }
  return statements;
}

function dedupeLoadRowsByPrimaryKey(table, rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (sourceRows.length <= 1) {
    return { rows: sourceRows, duplicateCount: 0 };
  }

  const primaryKeyColumn = inferPrimaryKeyColumn(table);
  const primaryKeyName = String(primaryKeyColumn?.columnName || "").trim();
  const seen = new Set();
  const dedupedRows = [];
  let duplicateCount = 0;

  for (const row of sourceRows) {
    const key = primaryKeyName && row?.[primaryKeyName] != null && row?.[primaryKeyName] !== ""
      ? `pk:${String(row[primaryKeyName])}`
      : `row:${JSON.stringify(row || {})}`;
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    dedupedRows.push(row);
  }

  return { rows: dedupedRows, duplicateCount };
}

async function loadGeneratedRowsToDataSource(dataSource, loadTables) {
  const normalizedLoadTables = uniqueBy(
    Array.isArray(loadTables) ? loadTables : [],
    (item) => `${String(item?.physicalTableName || item?.table?.physicalTableName || "")}:${String(item?.logicalTableName || item?.table?.logicalTableName || "")}`
  );
  const deleteLogs = [];
  const insertLogs = [];
  for (const tableLoad of [...normalizedLoadTables].reverse()) {
    const physicalTableName = String(tableLoad?.physicalTableName || tableLoad?.table?.physicalTableName || "");
    if (!physicalTableName) continue;
    const tableLogs = await executeSqlStatementsOnDataSource(dataSource, [
      buildInsertDeleteStatement(dataSource, physicalTableName),
    ]);
    deleteLogs.push({
      logicalTableName: tableLoad?.logicalTableName || tableLoad?.table?.logicalTableName || null,
      physicalTableName,
      statementCount: tableLogs.length,
    });
  }

  for (const tableLoad of normalizedLoadTables) {
    const deduped = dedupeLoadRowsByPrimaryKey(tableLoad?.table, tableLoad?.rows);
    const insertStatements = buildInsertStatementsForRows(dataSource, tableLoad?.table, deduped.rows, { batchSize: 200 });
    const tableLogs = await executeSqlStatementsOnDataSource(dataSource, insertStatements);
    insertLogs.push({
      logicalTableName: tableLoad?.logicalTableName || tableLoad?.table?.logicalTableName || null,
      physicalTableName: tableLoad?.physicalTableName || tableLoad?.table?.physicalTableName || null,
      rowCount: Array.isArray(deduped.rows) ? deduped.rows.length : 0,
      duplicateFilteredCount: Number(deduped.duplicateCount || 0),
      statementCount: tableLogs.length,
    });
  }

  return {
    loadedAt: new Date().toISOString(),
    targetDataSourceId: Number(dataSource.id),
    targetDataSourceName: dataSource.sourceName,
    targetDataSourceCode: dataSource.sourceCode,
    deletedTableCount: deleteLogs.length,
    loadedTableCount: insertLogs.length,
    loadedRowCount: insertLogs.reduce((sum, item) => sum + Number(item.rowCount || 0), 0),
    tables: insertLogs,
  };
}

function mapPhysicalVersion(row) {
  const physicalModel = safeJsonParse(row.physicalModelJson, null);
  const ddlBundle = safeJsonParse(row.ddlBundleJson, null);
  const deployTarget = safeJsonParse(row.deployTargetJson, null);
  const physicalSummary = physicalModel?.summary || {};
  return {
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    versionNo: Number(row.versionNo),
    logicalVersionNo: Number(row.logicalVersionNo),
    dbType: row.dbType,
    versionStatus: row.versionStatus,
    modelSummary: row.modelSummary || null,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isCurrent: Number(row.currentPhysicalVersion || 0) === Number(row.versionNo || 0),
    deployTarget,
    physicalModel,
    ddlBundle,
    tableCount: Number(physicalSummary.tableCount || 0),
    businessTableCount: Number(physicalSummary.businessTableCount || 0),
    dictionaryTableCount: Number(physicalSummary.dictionaryTableCount || 0),
    columnCount: Number(physicalSummary.columnCount || 0),
    indexCount: Number(physicalSummary.indexCount || 0),
    relationCount: Number(physicalSummary.relationCount || 0),
  };
}

function mapGenerationVersion(row) {
  const generationPlan = safeJsonParse(row.planJson, null);
  const samplePreview = safeJsonParse(row.samplePreviewJson, null);
  const generationSummary = generationPlan?.summary || samplePreview?.summary || {};
  return {
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    physicalVersionNo: Number(row.physicalVersionNo),
    versionNo: Number(row.versionNo),
    versionStatus: row.versionStatus,
    modelSummary: row.modelSummary || null,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isCurrent: Number(row.currentGenerationVersion || 0) === Number(row.versionNo || 0),
    generationPlan,
    samplePreview,
    tableCount: Number(generationSummary.tableCount || 0),
    businessTableCount: Number(generationSummary.businessTableCount || 0),
    dictionaryTableCount: Number(generationSummary.dictionaryTableCount || 0),
    targetRowCount: Number(generationSummary.targetRowCount || 0),
    previewTableCount: Number(generationSummary.previewTableCount || 0),
    previewRowCount: Number(generationSummary.previewRowCount || 0),
  };
}

function mapDirtyVersion(row) {
  const dirtyPlan = safeJsonParse(row.dirtyPlanJson, null);
  const truthPreview = safeJsonParse(row.truthPreviewJson, null);
  const observedPreview = safeJsonParse(row.observedPreviewJson, null);
  const issuePreview = safeJsonParse(row.issuePreviewJson, null);
  const dirtySummary = dirtyPlan?.summary || issuePreview?.summary || observedPreview?.summary || {};
  return {
    id: Number(row.id),
    instanceId: Number(row.instanceId),
    generationVersionNo: Number(row.generationVersionNo),
    versionNo: Number(row.versionNo),
    versionStatus: row.versionStatus,
    modelSummary: row.modelSummary || null,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isCurrent: Number(row.currentDirtyVersion || 0) === Number(row.versionNo || 0),
    dirtyPlan,
    truthPreview,
    observedPreview,
    issuePreview,
    issueCount: Number(dirtySummary.issueCount || 0),
    dirtyCellCount: Number(dirtySummary.dirtyCellCount || 0),
    affectedTableCount: Number(dirtySummary.affectedTableCount || 0),
    affectedRowCount: Number(dirtySummary.affectedRowCount || 0),
    dirtyRate: Number(dirtySummary.dirtyRate || 0),
    previewRowCount: Number(dirtySummary.previewRowCount || 0),
  };
}

function mapTemplate(row) {
  const sourceCategoryCodes = safeJsonParse(row.sourceCategoryCodes, []);
  const logicalModel = safeJsonParse(row.logicalModelJson, null);
  const logicalSummary = logicalModel?.summary || {};
  return {
    id: Number(row.id),
    templateCode: row.templateCode,
    templateName: row.templateName,
    industryCode: row.industryCode,
    sourceIncubationId: row.sourceIncubationId == null ? null : Number(row.sourceIncubationId),
    sourceIncubationName: row.sourceIncubationName || null,
    sourceCategoryCodes: Array.isArray(sourceCategoryCodes) ? sourceCategoryCodes : [],
    templateDesc: row.templateDesc || null,
    templateStatus: row.templateStatus,
    currentLogicalVersion: row.currentLogicalVersion == null ? null : Number(row.currentLogicalVersion),
    currentDefaultGenerationVersion: row.currentDefaultGenerationVersion == null ? null : Number(row.currentDefaultGenerationVersion),
    currentDefaultDirtyVersion: row.currentDefaultDirtyVersion == null ? null : Number(row.currentDefaultDirtyVersion),
    logicalVersionId: row.logicalVersionId == null ? null : Number(row.logicalVersionId),
    logicalVersionNo: row.logicalVersionNo == null ? null : Number(row.logicalVersionNo),
    sourceCategoryCount: Number(logicalSummary.sourceCategoryCount || (Array.isArray(sourceCategoryCodes) ? sourceCategoryCodes.length : 0)),
    moduleCount: Number(logicalSummary.moduleCount || 0),
    logicalTableCount: Number(logicalSummary.tableCount || 0),
    dictionaryCount: Number(logicalSummary.dictCount || 0),
    relationCount: Number(logicalSummary.relationCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    currentLogicalModel: logicalModel,
  };
}

function mapInstance(row) {
  const deployTarget = safeJsonParse(row.deployTargetJson, null);
  const physicalModel = safeJsonParse(row.physicalModelJson, null);
  const ddlBundle = safeJsonParse(row.ddlBundleJson, null);
  const physicalSummary = physicalModel?.summary || {};
  return {
    id: Number(row.id),
    instanceCode: row.instanceCode,
    instanceName: row.instanceName,
    templateId: Number(row.templateId),
    templateName: row.templateName,
    templateCode: row.templateCode || null,
    industryCode: row.industryCode || null,
    dbType: row.dbType,
    deployTarget,
    instanceStatus: row.instanceStatus,
    currentLogicalVersion: row.currentLogicalVersion == null ? null : Number(row.currentLogicalVersion),
    currentPhysicalVersion: row.currentPhysicalVersion == null ? null : Number(row.currentPhysicalVersion),
    currentGenerationVersion: row.currentGenerationVersion == null ? null : Number(row.currentGenerationVersion),
    currentDirtyVersion: row.currentDirtyVersion == null ? null : Number(row.currentDirtyVersion),
    physicalVersionId: row.physicalVersionId == null ? null : Number(row.physicalVersionId),
    physicalVersionNo: row.physicalVersionNo == null ? null : Number(row.physicalVersionNo),
    currentPhysicalModel: physicalModel,
    currentDdlBundle: ddlBundle,
    physicalTableCount: Number(physicalSummary.tableCount || 0),
    businessTableCount: Number(physicalSummary.businessTableCount || 0),
    dictionaryTableCount: Number(physicalSummary.dictionaryTableCount || 0),
    columnCount: Number(physicalSummary.columnCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapIndustryDataSource(row) {
  const selectedThemes = normalizeIndustryDataSourceThemes(safeJsonParse(row.selectedThemesJson, []));
  const settings = safeJsonParse(row.settingsJson, null);
  return {
    id: Number(row.id),
    dataSourceCode: row.dataSourceCode,
    dataSourceName: row.dataSourceName,
    industryCode: row.industryCode,
    dataSourceDesc: row.dataSourceDesc || null,
    sourceStatus: row.sourceStatus,
    selectedThemes,
    settings,
    instanceCount: Number(row.instanceCount || 0),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLogicalVersion(row) {
  const logicalModel = safeJsonParse(row.logicalModelJson, null);
  const sourceAssetSnapshot = safeJsonParse(row.sourceAssetSnapshotJson, null);
  const adjustmentHistory = safeJsonParse(row.adjustmentHistoryJson, []);
  const logicalSummary = logicalModel?.summary || {};
  return {
    id: Number(row.id),
    templateId: Number(row.templateId),
    versionNo: Number(row.versionNo),
    versionStatus: row.versionStatus,
    modelSummary: row.modelSummary || null,
    diffSummary: row.diffSummary || null,
    publishedAt: row.publishedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isCurrent: Number(row.currentLogicalVersion || 0) === Number(row.versionNo || 0),
    sourceAssetSnapshot,
    adjustmentHistory: Array.isArray(adjustmentHistory) ? adjustmentHistory : [],
    logicalModel,
    moduleCount: Number(logicalSummary.moduleCount || 0),
    logicalTableCount: Number(logicalSummary.tableCount || 0),
    dictionaryCount: Number(logicalSummary.dictCount || 0),
    relationCount: Number(logicalSummary.relationCount || 0),
  };
}

async function listBusinessSystemTemplates() {
  const scoped = getScopedWhere("t");
  const [rows] = await pool.query(
    `SELECT t.id, t.template_code AS templateCode, t.template_name AS templateName, t.industry_code AS industryCode,
            t.source_incubation_id AS sourceIncubationId, t.source_category_codes_json AS sourceCategoryCodes,
            t.template_desc AS templateDesc, t.template_status AS templateStatus,
            t.current_logical_version AS currentLogicalVersion,
            t.current_default_generation_version AS currentDefaultGenerationVersion,
            t.current_default_dirty_version AS currentDefaultDirtyVersion,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt,
            incubation.incubation_name AS sourceIncubationName,
            version.id AS logicalVersionId, version.version_no AS logicalVersionNo, version.logical_model_json AS logicalModelJson
       FROM lab_business_system_template t
       LEFT JOIN lab_industry_incubation incubation ON incubation.id = t.source_incubation_id
       LEFT JOIN lab_logical_model_version version
         ON version.template_id = t.id AND version.version_no = t.current_logical_version
      ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
      ORDER BY t.updated_at DESC, t.id DESC`
    , scoped.params
  );
  return rows.map(mapTemplate);
}

async function getBusinessSystemTemplateDetail(id) {
  const scoped = getScopedWhere("t");
  const [rows] = await pool.query(
    `SELECT t.id, t.template_code AS templateCode, t.template_name AS templateName, t.industry_code AS industryCode,
            t.source_incubation_id AS sourceIncubationId, t.source_category_codes_json AS sourceCategoryCodes,
            t.template_desc AS templateDesc, t.template_status AS templateStatus,
            t.current_logical_version AS currentLogicalVersion,
            t.current_default_generation_version AS currentDefaultGenerationVersion,
            t.current_default_dirty_version AS currentDefaultDirtyVersion,
            t.created_by AS createdBy, t.created_at AS createdAt, t.updated_at AS updatedAt,
            incubation.incubation_name AS sourceIncubationName,
            version.id AS logicalVersionId, version.version_no AS logicalVersionNo, version.logical_model_json AS logicalModelJson
       FROM lab_business_system_template t
       LEFT JOIN lab_industry_incubation incubation ON incubation.id = t.source_incubation_id
       LEFT JOIN lab_logical_model_version version
         ON version.template_id = t.id AND version.version_no = t.current_logical_version
      WHERE t.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(id), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("场景管理模板不存在", 404);
  }
  return mapTemplate(rows[0]);
}

async function listBusinessSystemInstances() {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT instance.id, instance.instance_code AS instanceCode, instance.instance_name AS instanceName,
            instance.template_id AS templateId, template.template_name AS templateName, template.template_code AS templateCode,
            template.industry_code AS industryCode,
            instance.db_type AS dbType, instance.instance_status AS instanceStatus,
            instance.deploy_target_json AS deployTargetJson,
            instance.current_logical_version AS currentLogicalVersion,
            instance.current_physical_version AS currentPhysicalVersion,
            instance.current_generation_version AS currentGenerationVersion,
            instance.current_dirty_version AS currentDirtyVersion,
            instance.created_by AS createdBy, instance.created_at AS createdAt, instance.updated_at AS updatedAt,
            physical.id AS physicalVersionId, physical.version_no AS physicalVersionNo,
            physical.physical_model_json AS physicalModelJson, physical.ddl_bundle_json AS ddlBundleJson
       FROM lab_business_system_instance instance
       JOIN lab_business_system_template template ON template.id = instance.template_id
       LEFT JOIN lab_physical_model_version physical
         ON physical.instance_id = instance.id AND physical.version_no = instance.current_physical_version
      ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
      ORDER BY instance.updated_at DESC, instance.id DESC`
    , scoped.params
  );
  return rows.map(mapInstance);
}

async function getBusinessSystemInstanceDetail(id) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT instance.id, instance.instance_code AS instanceCode, instance.instance_name AS instanceName,
            instance.template_id AS templateId, template.template_name AS templateName, template.template_code AS templateCode,
            template.industry_code AS industryCode,
            instance.db_type AS dbType, instance.instance_status AS instanceStatus,
            instance.deploy_target_json AS deployTargetJson,
            instance.current_logical_version AS currentLogicalVersion,
            instance.current_physical_version AS currentPhysicalVersion,
            instance.current_generation_version AS currentGenerationVersion,
            instance.current_dirty_version AS currentDirtyVersion,
            instance.created_by AS createdBy, instance.created_at AS createdAt, instance.updated_at AS updatedAt,
            physical.id AS physicalVersionId, physical.version_no AS physicalVersionNo,
            physical.physical_model_json AS physicalModelJson, physical.ddl_bundle_json AS ddlBundleJson
       FROM lab_business_system_instance instance
       JOIN lab_business_system_template template ON template.id = instance.template_id
       LEFT JOIN lab_physical_model_version physical
         ON physical.instance_id = instance.id AND physical.version_no = instance.current_physical_version
      WHERE instance.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(id), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("涓氬姟绯荤粺瀹炰緥涓嶅瓨鍦?", 404);
  }
  return mapInstance(rows[0]);
}

async function getBusinessSystemInstanceBasicsByIds(instanceIds) {
  if (!Array.isArray(instanceIds) || instanceIds.length === 0) {
    return [];
  }
  const scoped = getScopedWhere("instance");
  const placeholders = instanceIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT instance.id,
            instance.instance_code AS instanceCode,
            instance.instance_name AS instanceName,
            instance.db_type AS dbType,
            instance.instance_status AS instanceStatus,
            instance.current_generation_version AS currentGenerationVersion,
            instance.current_dirty_version AS currentDirtyVersion,
            template.industry_code AS industryCode
       FROM lab_business_system_instance instance
       JOIN lab_business_system_template template ON template.id = instance.template_id
      WHERE instance.id IN (${placeholders})${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [...instanceIds.map((item) => Number(item)), ...scoped.params]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    instanceCode: row.instanceCode,
    instanceName: row.instanceName,
    dbType: row.dbType,
    instanceStatus: row.instanceStatus,
    currentGenerationVersion: row.currentGenerationVersion == null ? null : Number(row.currentGenerationVersion),
    currentDirtyVersion: row.currentDirtyVersion == null ? null : Number(row.currentDirtyVersion),
    industryCode: row.industryCode || null,
  }));
}

async function listIndustryDataSources() {
  const scoped = getScopedWhere("source");
  const [rows] = await pool.query(
    `SELECT source.id,
            source.data_source_code AS dataSourceCode,
            source.data_source_name AS dataSourceName,
            source.industry_code AS industryCode,
            source.data_source_desc AS dataSourceDesc,
            source.source_status AS sourceStatus,
            source.selected_themes_json AS selectedThemesJson,
            source.settings_json AS settingsJson,
            source.created_by AS createdBy,
            source.created_at AS createdAt,
            source.updated_at AS updatedAt,
            COUNT(link.instance_id) AS instanceCount
       FROM lab_industry_data_source source
       LEFT JOIN lab_industry_data_source_instance link ON link.data_source_id = source.id
      ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
      GROUP BY source.id
      ORDER BY source.updated_at DESC, source.id DESC`
    , scoped.params
  );
  return rows.map(mapIndustryDataSource);
}

async function getIndustryDataSourceBase(id) {
  const scoped = getScopedWhere("source");
  const [rows] = await pool.query(
    `SELECT source.id,
            source.data_source_code AS dataSourceCode,
            source.data_source_name AS dataSourceName,
            source.industry_code AS industryCode,
            source.data_source_desc AS dataSourceDesc,
            source.source_status AS sourceStatus,
            source.selected_themes_json AS selectedThemesJson,
            source.settings_json AS settingsJson,
            source.created_by AS createdBy,
            source.created_at AS createdAt,
            source.updated_at AS updatedAt,
            COUNT(link.instance_id) AS instanceCount
       FROM lab_industry_data_source source
       LEFT JOIN lab_industry_data_source_instance link ON link.data_source_id = source.id
      WHERE source.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      GROUP BY source.id
      LIMIT 1`,
    [Number(id), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("\u884c\u4e1a\u6570\u636e\u6e90\u4e0d\u5b58\u5728", 404);
  }
  return mapIndustryDataSource(rows[0]);
}

async function listIndustryDataSourceLinkedInstances(dataSourceId) {
  const [rows] = await pool.query(
    `SELECT instance.id, instance.instance_code AS instanceCode, instance.instance_name AS instanceName,
            instance.template_id AS templateId, template.template_name AS templateName, template.template_code AS templateCode,
            template.industry_code AS industryCode,
            instance.db_type AS dbType, instance.instance_status AS instanceStatus,
            instance.current_logical_version AS currentLogicalVersion,
            instance.current_physical_version AS currentPhysicalVersion,
            instance.current_generation_version AS currentGenerationVersion,
            instance.current_dirty_version AS currentDirtyVersion,
            instance.created_by AS createdBy, instance.created_at AS createdAt, instance.updated_at AS updatedAt,
            link.link_role AS linkRole, link.sort_order AS sortOrder
       FROM lab_industry_data_source_instance link
       JOIN lab_business_system_instance instance ON instance.id = link.instance_id
       JOIN lab_business_system_template template ON template.id = instance.template_id
      WHERE link.data_source_id = ?
      ORDER BY link.sort_order ASC, link.id ASC`,
    [Number(dataSourceId)]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    instanceCode: row.instanceCode,
    instanceName: row.instanceName,
    templateId: Number(row.templateId),
    templateName: row.templateName,
    templateCode: row.templateCode || null,
    industryCode: row.industryCode || null,
    dbType: row.dbType,
    deployTarget: null,
    instanceStatus: row.instanceStatus,
    currentLogicalVersion: row.currentLogicalVersion == null ? null : Number(row.currentLogicalVersion),
    currentPhysicalVersion: row.currentPhysicalVersion == null ? null : Number(row.currentPhysicalVersion),
    currentGenerationVersion: row.currentGenerationVersion == null ? null : Number(row.currentGenerationVersion),
    currentDirtyVersion: row.currentDirtyVersion == null ? null : Number(row.currentDirtyVersion),
    physicalVersionId: null,
    physicalVersionNo: null,
    currentPhysicalModel: null,
    currentDdlBundle: null,
    physicalTableCount: 0,
    businessTableCount: 0,
    dictionaryTableCount: 0,
    columnCount: 0,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    linkRole: row.linkRole || "member",
    sortOrder: Number(row.sortOrder || 0),
  }));
}

function buildIndustryDataSourceSummaryEmpty(selectedThemes = DEFAULT_INDUSTRY_DATA_SOURCE_THEMES) {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      instanceCount: 0,
      readyInstanceCount: 0,
      pendingInstanceCount: 0,
      themeCount: selectedThemes.length,
      sharedEntityCount: 0,
      crossSystemEntityCount: 0,
      linkageCount: 0,
      warningCount: 0,
    },
    themeCoverage: selectedThemes.map((themeCode) => ({
      themeCode,
      themeLabel: INDUSTRY_DATA_SOURCE_THEME_META[themeCode]?.label || themeCode,
      instanceCount: 0,
      tableCount: 0,
      recordCount: 0,
      sharedEntityCount: 0,
      crossSystemEntityCount: 0,
    })),
    sharedEntities: [],
    warnings: [],
    instanceAssemblies: [],
  };
}

function buildIndustryDataSourceSharedEntityRecords(entityBuckets, options = {}) {
  const includeMappings = Boolean(options.includeMappings);
  return Array.from(entityBuckets.values())
    .map((bucket) => {
      const mappings = Array.isArray(bucket.mappings) ? bucket.mappings.slice() : [];
      const instanceNames = uniqueBy(
        mappings.map((item) => ({ value: item.instanceName })),
        (item) => item.value
      ).map((item) => item.value);
      const tableNames = uniqueBy(
        mappings.map((item) => ({ value: item.logicalLabel || item.logicalTableName })),
        (item) => item.value
      ).map((item) => item.value);
      const instanceCount = new Set(mappings.map((item) => item.instanceId)).size;
      const detail = {
        themeCode: bucket.themeCode,
        themeLabel: bucket.themeLabel,
        subtype: bucket.subtype,
        canonicalName: bucket.canonicalName,
        matchMethod: bucket.matchMethod,
        instanceCount,
        linkageCount: mappings.length,
        instanceNames,
        tableNames,
        keyAttributes: Array.isArray(bucket.keyAttributes) ? bucket.keyAttributes : [],
        isCrossSystem: instanceCount > 1,
        ...(includeMappings ? {
          signalField: bucket.signalField || null,
          signalValue: bucket.signalValue || null,
          mappings: mappings
            .sort((left, right) =>
              Number(left.instanceId) - Number(right.instanceId)
              || String(left.logicalTableName).localeCompare(String(right.logicalTableName))
              || Number(left.rowIndex) - Number(right.rowIndex)
            )
            .map((mapping) => ({
              ...mapping,
              mappingId: `${Number(mapping.instanceId)}:${String(mapping.logicalTableName || "table")}:${Number(mapping.rowIndex || 0)}`,
              rowAttributes: Array.isArray(mapping.rowAttributes) ? mapping.rowAttributes : [],
            })),
        } : {}),
      };
      return detail;
    })
    .sort((left, right) =>
      Number(right.isCrossSystem) - Number(left.isCrossSystem)
      || Number(right.instanceCount) - Number(left.instanceCount)
      || Number(right.linkageCount) - Number(left.linkageCount)
      || String(left.themeCode).localeCompare(String(right.themeCode))
      || String(left.canonicalName).localeCompare(String(right.canonicalName))
    )
    .map((detail, index) => ({
      ...detail,
      entityId: `${detail.themeCode}_${detail.subtype}_${String(index + 1).padStart(4, "0")}`,
    }));
}

function stripIndustryDataSourceEntityDetail(detail) {
  const { mappings, signalField, signalValue, ...summary } = detail || {};
  return summary;
}

async function buildIndustryDataSourcePreviewBundle(dataSource, linkedInstances) {
  const selectedThemes = normalizeIndustryDataSourceThemes(dataSource?.selectedThemes);
  if (!Array.isArray(linkedInstances) || linkedInstances.length === 0) {
    return {
      preview: buildIndustryDataSourceSummaryEmpty(selectedThemes),
      sharedEntityDetails: [],
    };
  }

  const themeCoverageMap = new Map(
    selectedThemes.map((themeCode) => [
      themeCode,
      {
        themeCode,
        themeLabel: INDUSTRY_DATA_SOURCE_THEME_META[themeCode]?.label || themeCode,
        instanceIds: new Set(),
        tableKeys: new Set(),
        recordCount: 0,
      },
    ])
  );
  const entityBuckets = new Map();
  const warnings = [];
  const instanceAssemblies = [];
  let readyInstanceCount = 0;

  for (const linkedInstance of linkedInstances) {
    if (!linkedInstance?.currentGenerationVersion) {
      warnings.push({
        level: "warning",
        code: "GENERATION_PLAN_MISSING",
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instanceName,
        message: `\u5b9e\u4f8b ${linkedInstance.instanceName} \u5c1a\u672a\u751f\u6210\u6570\u636e\u65b9\u6848\uff0c\u6682\u65f6\u65e0\u6cd5\u53c2\u4e0e\u884c\u4e1a\u8054\u52a8\u9884\u89c8`,
      });
      instanceAssemblies.push({
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instanceName,
        instanceCode: linkedInstance.instanceCode,
        dbType: linkedInstance.dbType,
        currentGenerationVersion: null,
        currentDirtyVersion: linkedInstance.currentDirtyVersion,
        assemblyStatus: "pending_generation",
        readyThemeCount: 0,
        previewTableCount: 0,
        previewRowCount: 0,
        activeThemes: [],
      });
      continue;
    }

    try {
      const generationVersion = await getBusinessSystemInstanceGenerationVersionByVersionNo(
        linkedInstance.id,
        linkedInstance.currentGenerationVersion
      );
      const samplePreview = generationVersion?.samplePreview && typeof generationVersion.samplePreview === "object"
        ? generationVersion.samplePreview
        : null;
      const generationPlan = generationVersion?.generationPlan && typeof generationVersion.generationPlan === "object"
        ? generationVersion.generationPlan
        : null;
      const previewTables = Array.isArray(samplePreview?.tables) ? samplePreview.tables : [];
      const tablePlans = Array.isArray(generationPlan?.tablePlans) ? generationPlan.tablePlans : [];
      const tablePlanMap = new Map(tablePlans.map((tablePlan) => [String(tablePlan?.logicalTableName || ""), tablePlan]));
      const activeThemes = new Set();

      for (const previewTable of previewTables) {
        if (String(previewTable?.tableKind || "") !== "BUSINESS") continue;
        const rows = Array.isArray(previewTable?.rows) ? previewTable.rows : [];
        if (rows.length === 0) continue;
        const tablePlan = tablePlanMap.get(String(previewTable?.logicalTableName || "")) || {};
        const matchedThemes = inferIndustryThemesForTable(tablePlan, previewTable)
          .filter((themeCode) => selectedThemes.includes(themeCode));
        if (matchedThemes.length === 0) continue;

        const tableText = `${previewTable?.logicalTableName || ""} ${previewTable?.logicalLabel || ""}`;
        for (const themeCode of matchedThemes) {
          const coverage = themeCoverageMap.get(themeCode);
          if (coverage) {
            coverage.instanceIds.add(linkedInstance.id);
            coverage.tableKeys.add(`${linkedInstance.id}:${String(previewTable?.logicalTableName || "")}`);
            coverage.recordCount += rows.length;
          }
          activeThemes.add(themeCode);
        }

        rows.forEach((row, rowIndex) => {
          const rowValue = row && typeof row === "object" ? row : {};
          const rowKey = rowValue.id == null
            ? `${String(previewTable?.logicalTableName || "table")}_${rowIndex + 1}`
            : String(rowValue.id);

          for (const themeCode of matchedThemes) {
            const subtype = inferIndustryEntitySubtype(themeCode, tableText);
            const signal = extractIndustryEntitySignal(rowValue, themeCode);
            const fingerprint = signal
              ? `${themeCode}:${subtype}:${signal.matchMethod}:${normalizeComparableText(signal.signalValue)}`
              : `${themeCode}:${subtype}:slot:${String(rowIndex + 1).padStart(4, "0")}`;
            const bucket = entityBuckets.get(fingerprint) || {
              fingerprint,
              themeCode,
              themeLabel: INDUSTRY_DATA_SOURCE_THEME_META[themeCode]?.label || themeCode,
              subtype,
              canonicalName: pickIndustryEntityDisplayLabel({
                row: rowValue,
                logicalLabel: previewTable?.logicalLabel,
                rowIndex,
              }),
              matchMethod: signal?.matchMethod || "synthetic_slot",
              signalField: signal?.signalField || null,
              signalValue: signal?.signalValue || null,
              keyAttributes: pickIndustryEntityAttributes(rowValue),
              mappings: [],
            };
            if (!bucket.signalField && signal?.signalField) {
              bucket.signalField = signal.signalField;
              bucket.signalValue = signal.signalValue;
            }
            bucket.mappings.push({
              instanceId: linkedInstance.id,
              instanceName: linkedInstance.instanceName,
              instanceCode: linkedInstance.instanceCode,
              currentGenerationVersion: linkedInstance.currentGenerationVersion,
              currentDirtyVersion: linkedInstance.currentDirtyVersion,
              logicalTableName: String(previewTable?.logicalTableName || ""),
              logicalLabel: String(previewTable?.logicalLabel || previewTable?.logicalTableName || ""),
              rowIndex: rowIndex + 1,
              rowKey,
              displayLabel: pickIndustryEntityDisplayLabel({
                row: rowValue,
                logicalLabel: previewTable?.logicalLabel,
                rowIndex,
              }),
              rowAttributes: pickIndustryEntityAttributes(rowValue, 5),
            });
            entityBuckets.set(fingerprint, bucket);
          }
        });
      }

      readyInstanceCount += 1;
      instanceAssemblies.push({
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instanceName,
        instanceCode: linkedInstance.instanceCode,
        dbType: linkedInstance.dbType,
        currentGenerationVersion: linkedInstance.currentGenerationVersion,
        currentDirtyVersion: linkedInstance.currentDirtyVersion,
        assemblyStatus: "ready",
        readyThemeCount: activeThemes.size,
        previewTableCount: Number(generationVersion.previewTableCount || 0),
        previewRowCount: Number(generationVersion.previewRowCount || 0),
        activeThemes: Array.from(activeThemes),
      });
    } catch (error) {
      warnings.push({
        level: "error",
        code: "GENERATION_PLAN_LOAD_FAILED",
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instanceName,
        message: `\u5b9e\u4f8b ${linkedInstance.instanceName} \u7684\u6570\u636e\u65b9\u6848\u52a0\u8f7d\u5931\u8d25\uff1a${error instanceof Error ? error.message : "\u672a\u77e5\u9519\u8bef"}`,
      });
      instanceAssemblies.push({
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instanceName,
        instanceCode: linkedInstance.instanceCode,
        dbType: linkedInstance.dbType,
        currentGenerationVersion: linkedInstance.currentGenerationVersion,
        currentDirtyVersion: linkedInstance.currentDirtyVersion,
        assemblyStatus: "load_failed",
        readyThemeCount: 0,
        previewTableCount: 0,
        previewRowCount: 0,
        activeThemes: [],
      });
    }
  }

  const sharedEntityDetails = buildIndustryDataSourceSharedEntityRecords(entityBuckets, { includeMappings: true });
  const sharedEntities = sharedEntityDetails.map(stripIndustryDataSourceEntityDetail);

  const themeCoverage = Array.from(themeCoverageMap.values()).map((coverage) => ({
    themeCode: coverage.themeCode,
    themeLabel: coverage.themeLabel,
    instanceCount: coverage.instanceIds.size,
    tableCount: coverage.tableKeys.size,
    recordCount: coverage.recordCount,
    sharedEntityCount: sharedEntities.filter((item) => item.themeCode === coverage.themeCode).length,
    crossSystemEntityCount: sharedEntities.filter((item) => item.themeCode === coverage.themeCode && item.isCrossSystem).length,
  }));

  const preview = {
    generatedAt: new Date().toISOString(),
    summary: {
      instanceCount: linkedInstances.length,
      readyInstanceCount,
      pendingInstanceCount: linkedInstances.length - readyInstanceCount,
      themeCount: selectedThemes.length,
      sharedEntityCount: sharedEntities.length,
      crossSystemEntityCount: sharedEntities.filter((item) => item.isCrossSystem).length,
      linkageCount: sharedEntities.reduce((sum, item) => sum + Number(item.linkageCount || 0), 0),
      warningCount: warnings.length,
    },
    themeCoverage,
    sharedEntities: sharedEntities.slice(0, 80),
    warnings,
    instanceAssemblies,
  };

  return {
    preview,
    sharedEntityDetails,
  };
}

async function buildIndustryDataSourcePreview(dataSource, linkedInstances) {
  const bundle = await buildIndustryDataSourcePreviewBundle(dataSource, linkedInstances);
  return bundle.preview;
}

async function getIndustryDataSourceDetail(id) {
  const dataSource = await getIndustryDataSourceBase(id);
  const linkedInstances = await listIndustryDataSourceLinkedInstances(id);
  const preview = await buildIndustryDataSourcePreview(dataSource, linkedInstances);
  return {
    ...dataSource,
    linkedInstances: linkedInstances.map((instance) => {
      const assembly = preview.instanceAssemblies.find((item) => Number(item.instanceId) === Number(instance.id));
      return {
        ...instance,
        assemblyStatus: assembly?.assemblyStatus || "pending_generation",
        readyThemeCount: Number(assembly?.readyThemeCount || 0),
        previewTableCount: Number(assembly?.previewTableCount || 0),
        previewRowCount: Number(assembly?.previewRowCount || 0),
        activeThemes: Array.isArray(assembly?.activeThemes) ? assembly.activeThemes : [],
      };
    }),
    linkagePreview: preview,
  };
}

async function getIndustryDataSourceSharedEntityDetail(id, entityId) {
  const normalizedEntityId = text(entityId, 128);
  if (!normalizedEntityId) {
    throw new AppError("共享实体标识不能为空", 400);
  }
  const dataSource = await getIndustryDataSourceBase(id);
  const linkedInstances = await listIndustryDataSourceLinkedInstances(id);
  const bundle = await buildIndustryDataSourcePreviewBundle(dataSource, linkedInstances);
  const entityDetail = bundle.sharedEntityDetails.find((item) => item.entityId === normalizedEntityId);
  if (!entityDetail) {
    throw new AppError("共享实体不存在，或行业联动预览已发生变化", 404);
  }
  return {
    dataSourceId: Number(dataSource.id),
    dataSourceCode: dataSource.dataSourceCode,
    dataSourceName: dataSource.dataSourceName,
    generatedAt: bundle.preview.generatedAt,
    ...entityDetail,
  };
}

async function createIndustryDataSource(payload, user) {
  const projectId = getCurrentProjectId();
  const dataSourceName = text(payload.dataSourceName, 128);
  if (!dataSourceName) {
    throw new AppError("\u884c\u4e1a\u6570\u636e\u6e90\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a", 400);
  }
  const instanceIds = normalizeStringArray(payload.instanceIds || [], 32)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  if (instanceIds.length < 2) {
    throw new AppError("\u884c\u4e1a\u6570\u636e\u6e90\u81f3\u5c11\u9700\u8981\u9009\u62e9\u4e24\u4e2a\u4e1a\u52a1\u7cfb\u7edf\u5b9e\u4f8b", 400);
  }

  const uniqueInstanceIds = uniqueBy(instanceIds.map((item) => ({ value: item })), (item) => item.value).map((item) => item.value);
  const selectedInstances = (await getBusinessSystemInstanceBasicsByIds(uniqueInstanceIds))
    .sort((left, right) => uniqueInstanceIds.indexOf(Number(left.id)) - uniqueInstanceIds.indexOf(Number(right.id)))
    .map((item) => item || null)
    .filter(Boolean);
  if (selectedInstances.length !== uniqueInstanceIds.length) {
    throw new AppError("\u6240\u9009\u4e1a\u52a1\u7cfb\u7edf\u5b9e\u4f8b\u4e2d\u5b58\u5728\u65e0\u6548\u9879", 400);
  }

  const industryCodes = uniqueBy(
    selectedInstances.map((item) => ({ value: String(item.industryCode || "") })).filter((item) => item.value),
    (item) => item.value
  ).map((item) => item.value);
  const industryCode = text(payload.industryCode, 64) || industryCodes[0] || "generic";
  if (industryCodes.length > 1 || (industryCodes[0] && industryCodes[0] !== industryCode)) {
    throw new AppError("\u884c\u4e1a\u6570\u636e\u6e90\u53ea\u80fd\u88c5\u914d\u540c\u4e00\u884c\u4e1a\u7684\u4e1a\u52a1\u7cfb\u7edf\u5b9e\u4f8b", 400);
  }

  const dataSourceCode = await ensureUniqueIndustryDataSourceCode(payload.dataSourceCode || dataSourceName);
  const dataSourceDesc = text(payload.dataSourceDesc, 1024) || null;
  const sourceStatus = ["draft", "active", "archived"].includes(String(payload.sourceStatus || "draft"))
    ? String(payload.sourceStatus || "draft")
    : "draft";
  const selectedThemes = normalizeIndustryDataSourceThemes(payload.selectedThemes);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO lab_industry_data_source
        (project_id, data_source_code, data_source_name, industry_code, data_source_desc, source_status, selected_themes_json, settings_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        dataSourceCode,
        dataSourceName,
        industryCode,
        dataSourceDesc,
        sourceStatus,
        JSON.stringify(selectedThemes),
        JSON.stringify({
          createdFrom: "scenario_management",
          instanceCount: uniqueInstanceIds.length,
        }),
        user?.displayName || user?.username || "system",
      ]
    );
    const dataSourceId = Number(result.insertId);
    for (let index = 0; index < uniqueInstanceIds.length; index += 1) {
      await connection.query(
        `INSERT INTO lab_industry_data_source_instance
          (data_source_id, instance_id, link_role, sort_order)
         VALUES (?, ?, 'member', ?)`,
        [dataSourceId, uniqueInstanceIds[index], index + 1]
      );
    }
    await connection.commit();
    return getIndustryDataSourceDetail(dataSourceId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function rebuildIndustryDataSourcePreview(id) {
  return getIndustryDataSourceDetail(id);
}

async function deleteBusinessSystemTemplate(id) {
  const template = await getBusinessSystemTemplateDetail(id);
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS instanceCount
       FROM lab_business_system_instance
      WHERE template_id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [Number(id), ...scoped.params]
  );
  const instanceCount = Number(rows[0]?.instanceCount || 0);
  if (instanceCount > 0) {
    throw new AppError(`模板 ${template.templateName} 下仍有 ${instanceCount} 个实例，请先删除实例后再删除模板`, 400);
  }

  await pool.query(
    `DELETE FROM lab_business_system_template
      WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [Number(id), ...scoped.params]
  );
  return {
    id: Number(id),
    templateName: template.templateName,
  };
}

async function deleteBusinessSystemInstance(id) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const scoped = getScopedWhere("");
  const [rows] = await pool.query(
    `SELECT source.id, source.data_source_name AS dataSourceName
       FROM lab_industry_data_source_instance link
       JOIN lab_industry_data_source source ON source.id = link.data_source_id
      WHERE link.instance_id = ?
      ORDER BY source.updated_at DESC, source.id DESC`,
    [Number(id)]
  );
  if (rows.length > 0) {
    const names = rows.slice(0, 3).map((item) => String(item.dataSourceName || `#${item.id}`));
    const suffix = rows.length > 3 ? ` 等 ${rows.length} 个行业数据源` : "";
    throw new AppError(`实例 ${instance.instanceName} 已被行业数据源装配：${names.join("、")}${suffix}，请先删除相关行业数据源后再删除实例`, 400);
  }

  await pool.query(
    `DELETE FROM lab_business_system_instance
      WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [Number(id), ...scoped.params]
  );
  return {
    id: Number(id),
    instanceName: instance.instanceName,
  };
}

async function deleteIndustryDataSource(id) {
  const dataSource = await getIndustryDataSourceBase(id);
  const scoped = getScopedWhere("");
  await pool.query(
    `DELETE FROM lab_industry_data_source
      WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [Number(id), ...scoped.params]
  );
  return {
    id: Number(id),
    dataSourceName: dataSource.dataSourceName,
  };
}

async function getBusinessSystemTemplateLogicalVersionByVersionNo(templateId, versionNo) {
  const scoped = getScopedWhere("template");
  const [rows] = await pool.query(
    `SELECT version.id, version.template_id AS templateId, version.version_no AS versionNo,
            version.version_status AS versionStatus, version.source_asset_snapshot_json AS sourceAssetSnapshotJson,
            version.logical_model_json AS logicalModelJson, version.adjustment_history_json AS adjustmentHistoryJson,
            version.model_summary AS modelSummary, version.diff_summary AS diffSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            template.current_logical_version AS currentLogicalVersion
       FROM lab_logical_model_version version
       JOIN lab_business_system_template template ON template.id = version.template_id
      WHERE version.template_id = ? AND version.version_no = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(templateId), Number(versionNo), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("\u5bf9\u5e94\u7684\u903b\u8f91\u6a21\u578b\u7248\u672c\u4e0d\u5b58\u5728", 404);
  }
  return mapLogicalVersion(rows[0]);
}

async function getBusinessSystemInstancePhysicalVersionByVersionNo(instanceId, versionNo) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.version_no AS versionNo,
            version.logical_version_no AS logicalVersionNo, version.db_type AS dbType,
            version.deploy_target_json AS deployTargetJson, version.version_status AS versionStatus,
            version.physical_model_json AS physicalModelJson, version.ddl_bundle_json AS ddlBundleJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_physical_version AS currentPhysicalVersion
       FROM lab_physical_model_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ? AND version.version_no = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(instanceId), Number(versionNo), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("\u5bf9\u5e94\u7684\u7269\u7406\u6a21\u578b\u7248\u672c\u4e0d\u5b58\u5728", 404);
  }
  return mapPhysicalVersion(rows[0]);
}

async function getBusinessSystemInstancePhysicalVersionById(instanceId, versionId) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.version_no AS versionNo,
            version.logical_version_no AS logicalVersionNo, version.db_type AS dbType,
            version.deploy_target_json AS deployTargetJson, version.version_status AS versionStatus,
            version.physical_model_json AS physicalModelJson, version.ddl_bundle_json AS ddlBundleJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_physical_version AS currentPhysicalVersion
       FROM lab_physical_model_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ? AND version.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(instanceId), Number(versionId), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("对应的物理模型版本不存在", 404);
  }
  return mapPhysicalVersion(rows[0]);
}

async function getBusinessSystemInstanceGenerationVersionByVersionNo(instanceId, versionNo) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.physical_version_no AS physicalVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.plan_json AS planJson, version.sample_preview_json AS samplePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_generation_version AS currentGenerationVersion
       FROM lab_generation_plan_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ? AND version.version_no = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(instanceId), Number(versionNo), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("\u5bf9\u5e94\u7684\u6570\u636e\u65b9\u6848\u7248\u672c\u4e0d\u5b58\u5728", 404);
  }
  return mapGenerationVersion(rows[0]);
}

async function getBusinessSystemInstanceGenerationVersionById(instanceId, versionId) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.physical_version_no AS physicalVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.plan_json AS planJson, version.sample_preview_json AS samplePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_generation_version AS currentGenerationVersion
       FROM lab_generation_plan_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ? AND version.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(instanceId), Number(versionId), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("对应的数据方案版本不存在", 404);
  }
  return mapGenerationVersion(rows[0]);
}

async function getBusinessSystemInstanceDirtyVersionById(versionId) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.generation_version_no AS generationVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.dirty_plan_json AS dirtyPlanJson, version.truth_preview_json AS truthPreviewJson,
            version.observed_preview_json AS observedPreviewJson, version.issue_preview_json AS issuePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_dirty_version AS currentDirtyVersion
       FROM lab_dirty_data_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(versionId), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("\u5bf9\u5e94\u7684\u810f\u6570\u636e\u65b9\u6848\u7248\u672c\u4e0d\u5b58\u5728", 404);
  }
  return mapDirtyVersion(rows[0]);
}

async function getBusinessSystemInstanceDirtyVersionByVersionNo(instanceId, versionNo) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.generation_version_no AS generationVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.dirty_plan_json AS dirtyPlanJson, version.truth_preview_json AS truthPreviewJson,
            version.observed_preview_json AS observedPreviewJson, version.issue_preview_json AS issuePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_dirty_version AS currentDirtyVersion
       FROM lab_dirty_data_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ? AND version.version_no = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(instanceId), Number(versionNo), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("\u5bf9\u5e94\u7684\u810f\u6570\u636e\u65b9\u6848\u7248\u672c\u4e0d\u5b58\u5728", 404);
  }
  return mapDirtyVersion(rows[0]);
}

async function getBusinessSystemInstanceDirtyVersionByScopedId(instanceId, versionId) {
  const scoped = getScopedWhere("instance");
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.generation_version_no AS generationVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.dirty_plan_json AS dirtyPlanJson, version.truth_preview_json AS truthPreviewJson,
            version.observed_preview_json AS observedPreviewJson, version.issue_preview_json AS issuePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_dirty_version AS currentDirtyVersion
       FROM lab_dirty_data_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ? AND version.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
      LIMIT 1`,
    [Number(instanceId), Number(versionId), ...scoped.params]
  );
  if (rows.length === 0) {
    throw new AppError("对应的脏数据方案版本不存在", 404);
  }
  return mapDirtyVersion(rows[0]);
}

async function getLatestInstanceVersionNo(connection, tableName, instanceId) {
  const [rows] = await connection.query(
    `SELECT version_no AS versionNo
       FROM ${tableName}
      WHERE instance_id = ?
      ORDER BY version_no DESC, id DESC
      LIMIT 1`,
    [Number(instanceId)]
  );
  return rows[0] ? Number(rows[0].versionNo || 0) : null;
}

function toTimestamp(value) {
  if (!value) return 0;
  const timestamp = new Date(String(value)).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function pickLatestDate(...values) {
  const normalized = values
    .filter(Boolean)
    .map((value) => ({ value: String(value), time: toTimestamp(value) }))
    .sort((left, right) => right.time - left.time);
  if (normalized[0]?.time) {
    return new Date(normalized[0].time).toISOString();
  }
  return normalized[0]?.value || new Date().toISOString();
}

function buildBusinessSystemQualityGateEvaluation({ physicalVersion, generationVersion, dirtyVersion, physicalTables, previewTables, truthTables, observedTables, dirtyIssues }) {
  const results = [];
  let penalty = 0;
  const previewRowCount = (previewTables || []).reduce((sum, item) => sum + Number(item.previewRowCount || (Array.isArray(item.rows) ? item.rows.length : 0) || 0), 0);
  const truthTableCount = Array.isArray(truthTables) ? truthTables.length : 0;
  const observedTableCount = Array.isArray(observedTables) ? observedTables.length : 0;
  const traceableIssueCount = (dirtyIssues || []).filter((item) =>
    item
    && item.category
    && item.issueCode
    && item.logicalTableName
    && item.fieldName
    && item.injectionPoint
  ).length;

  results.push({
    gate: "physicalModelReady",
    passed: Boolean(physicalVersion && physicalTables.length > 0),
    actual: physicalTables.length,
    expected: 1,
  });
  if (!physicalVersion || physicalTables.length === 0) {
    penalty += 30;
  }

  results.push({
    gate: "generationPreviewReady",
    passed: Boolean(generationVersion && previewRowCount > 0),
    actual: previewRowCount,
    expected: 1,
  });
  if (!generationVersion || previewRowCount <= 0) {
    penalty += 24;
  }

  results.push({
    gate: "dirtyProfileReady",
    passed: Boolean(dirtyVersion && dirtyIssues.length > 0),
    actual: dirtyIssues.length,
    expected: 1,
  });
  if (!dirtyVersion || dirtyIssues.length === 0) {
    penalty += 18;
  }

  results.push({
    gate: "truthObservedPreviewReady",
    passed: !dirtyVersion || (truthTableCount > 0 && truthTableCount === observedTableCount),
    actual: { truthTableCount, observedTableCount },
    expected: "truth == observed > 0",
  });
  if (dirtyVersion && (truthTableCount === 0 || truthTableCount !== observedTableCount)) {
    penalty += 10;
  }

  results.push({
    gate: "versionLineageAligned",
    passed: Boolean(
      (!generationVersion || !physicalVersion || Number(generationVersion.physicalVersionNo) === Number(physicalVersion.versionNo))
      && (!dirtyVersion || !generationVersion || Number(dirtyVersion.generationVersionNo) === Number(generationVersion.versionNo))
    ),
    actual: {
      physicalVersionNo: physicalVersion?.versionNo || null,
      generationPhysicalVersionNo: generationVersion?.physicalVersionNo || null,
      generationVersionNo: generationVersion?.versionNo || null,
      dirtyGenerationVersionNo: dirtyVersion?.generationVersionNo || null,
    },
  });
  if (
    (generationVersion && physicalVersion && Number(generationVersion.physicalVersionNo) !== Number(physicalVersion.versionNo))
    || (dirtyVersion && generationVersion && Number(dirtyVersion.generationVersionNo) !== Number(generationVersion.versionNo))
  ) {
    penalty += 12;
  }

  results.push({
    gate: "dirtyIssuesTraceable",
    passed: dirtyIssues.length === 0 || traceableIssueCount === dirtyIssues.length,
    actual: traceableIssueCount,
    expected: dirtyIssues.length,
  });
  if (dirtyIssues.length > 0 && traceableIssueCount !== dirtyIssues.length) {
    penalty += 8;
  }

  return {
    results,
    penalty,
    failedCount: results.filter((item) => item.passed === false).length,
  };
}

async function buildBusinessSystemInstanceQualityReport(instanceId) {
  const instance = await getBusinessSystemInstanceDetail(instanceId);
  const physicalVersion = instance.currentPhysicalVersion
    ? await getBusinessSystemInstancePhysicalVersionByVersionNo(instanceId, instance.currentPhysicalVersion)
    : null;
  const generationVersion = instance.currentGenerationVersion
    ? await getBusinessSystemInstanceGenerationVersionByVersionNo(instanceId, instance.currentGenerationVersion)
    : null;
  const dirtyVersion = instance.currentDirtyVersion
    ? await getBusinessSystemInstanceDirtyVersionByVersionNo(instanceId, instance.currentDirtyVersion)
    : null;

  const physicalModel = safeObject(physicalVersion?.physicalModel);
  const physicalTables = Array.isArray(physicalModel.tables) ? physicalModel.tables : [];
  const physicalTableMap = new Map(physicalTables.map((table) => [String(table?.logicalTableName || ""), table]));
  const samplePreview = safeObject(generationVersion?.samplePreview);
  const previewTables = Array.isArray(samplePreview.tables) ? samplePreview.tables : [];
  const dirtyIssuePreview = safeObject(dirtyVersion?.issuePreview);
  const dirtyIssues = Array.isArray(dirtyIssuePreview.issues) ? dirtyIssuePreview.issues : [];
  const dirtyTableStats = Array.isArray(dirtyIssuePreview.tables) ? dirtyIssuePreview.tables : [];
  const truthPreview = safeObject(dirtyVersion?.truthPreview);
  const observedPreview = safeObject(dirtyVersion?.observedPreview);
  const truthTables = Array.isArray(truthPreview.tables) ? truthPreview.tables : [];
  const observedTables = Array.isArray(observedPreview.tables) ? observedPreview.tables : [];

  const issueCategoryStats = {};
  const issueTypeStats = {};
  const groupedFieldIssues = new Map();

  for (const issue of dirtyIssues) {
    const categoryKey = String(issue.category || "UNKNOWN");
    const issueTypeKey = String(issue.issueCode || "UNKNOWN");
    issueCategoryStats[categoryKey] = Number(issueCategoryStats[categoryKey] || 0) + 1;
    issueTypeStats[issueTypeKey] = Number(issueTypeStats[issueTypeKey] || 0) + 1;
    const groupKey = [
      String(issue.logicalTableName || ""),
      String(issue.fieldName || ""),
      categoryKey,
      issueTypeKey,
    ].join("|");
    if (!groupedFieldIssues.has(groupKey)) {
      groupedFieldIssues.set(groupKey, {
        tableName: String(issue.logicalTableName || "-"),
        logicalTableName: String(issue.logicalTableName || "-"),
        physicalTableName: String(issue.physicalTableName || "-"),
        fieldName: String(issue.fieldName || "-"),
        issueCategory: String(issue.categoryLabel || issue.category || "-"),
        issueCode: issueTypeKey,
        issueType: issueTypeKey,
        issueCount: 0,
        rootCause: issue.rootCause || null,
        injectionPoint: issue.injectionPoint || null,
        sampleTruthValue: issue.truthValue,
        sampleObservedValue: issue.observedValue,
      });
    }
    groupedFieldIssues.get(groupKey).issueCount += 1;
  }

  const fieldIssues = Array.from(groupedFieldIssues.values())
    .sort((left, right) =>
      String(left.tableName).localeCompare(String(right.tableName))
      || String(left.fieldName).localeCompare(String(right.fieldName))
      || String(left.issueCode).localeCompare(String(right.issueCode))
    );

  const tableStatsSource = dirtyTableStats.length > 0
    ? dirtyTableStats
    : previewTables.map((table) => ({
      tableKind: table.tableKind,
      logicalTableName: table.logicalTableName,
      physicalTableName: table.physicalTableName,
      previewRowCount: Number(table.previewRowCount || (Array.isArray(table.rows) ? table.rows.length : 0) || 0),
      dirtyIssueCount: 0,
      dirtyRowCount: 0,
      dirtyCellCount: 0,
    }));

  const tableStats = tableStatsSource.map((item) => {
    const tableName = String(item.logicalTableName || item.tableName || "-");
    const issueFields = uniqueBy(
      fieldIssues
        .filter((issue) => String(issue.tableName) === tableName)
        .map((issue) => ({ fieldName: issue.fieldName })),
      (issue) => issue.fieldName
    ).map((issue) => issue.fieldName);
    const physicalTable = physicalTableMap.get(tableName) || {};
    const fieldCount = Array.isArray(physicalTable.columns) ? physicalTable.columns.length : 0;
    const rowCount = Number(item.previewRowCount || item.rowCount || 0);
    const dirtyCellCount = Number(item.dirtyCellCount || 0);
    const totalFieldCells = rowCount * Math.max(1, fieldCount);
    return {
      tableName,
      logicalTableName: tableName,
      physicalTableName: String(item.physicalTableName || physicalTable.physicalTableName || "-"),
      tableKind: String(item.tableKind || physicalTable.tableKind || "-"),
      businessRole: String(item.businessRole || physicalTable.businessRole || "-"),
      rowCount,
      previewRowCount: rowCount,
      fieldCount,
      dirtyRows: Number(item.dirtyRowCount || item.dirtyRows || 0),
      dirtyIssueCount: Number(item.dirtyIssueCount || 0),
      dirtyCellCount,
      totalFieldCells,
      dirtyCellRate: totalFieldCells > 0 ? Number((dirtyCellCount / totalFieldCells).toFixed(4)) : 0,
      issueFields,
    };
  });

  const dirtyDistribution = tableStats.map((item) => ({
    tableName: item.tableName,
    dirtyRows: Number(item.dirtyRows || 0),
    dirtyCells: Number(item.dirtyCellCount || 0),
    issueCount: Number(item.dirtyIssueCount || 0),
  }));

  const totalRows = tableStats.reduce((sum, item) => sum + Number(item.rowCount || 0), 0);
  const totalFieldCells = tableStats.reduce((sum, item) => sum + Number(item.totalFieldCells || 0), 0);
  const totalIssueCells = tableStats.reduce((sum, item) => sum + Number(item.dirtyCellCount || 0), 0);
  const gateEvaluation = buildBusinessSystemQualityGateEvaluation({
    physicalVersion,
    generationVersion,
    dirtyVersion,
    physicalTables,
    previewTables,
    truthTables,
    observedTables,
    dirtyIssues,
  });
  const dirtyRate = totalFieldCells > 0
    ? Number((totalIssueCells / totalFieldCells).toFixed(4))
    : Number(dirtyVersion?.dirtyRate || 0);
  const score = Math.max(
    5,
    Number((100 - Math.min(70, dirtyRate * 100) - Math.min(18, Math.ceil(fieldIssues.length / 4)) - gateEvaluation.penalty).toFixed(2))
  );
  const updatedAt = pickLatestDate(
    instance.updatedAt,
    physicalVersion?.updatedAt,
    generationVersion?.updatedAt,
    dirtyVersion?.updatedAt
  );

  return {
    instanceId: Number(instance.id),
    reportCode: `instance_quality_${instance.id}_p${instance.currentPhysicalVersion || 0}_g${instance.currentGenerationVersion || 0}_d${instance.currentDirtyVersion || 0}`,
    score,
    summary: {
      reportScope: dirtyVersion ? "observed_quality" : generationVersion ? "preview_quality" : "model_readiness",
      instanceCode: instance.instanceCode,
      instanceName: instance.instanceName,
      currentPhysicalVersion: instance.currentPhysicalVersion || null,
      currentGenerationVersion: instance.currentGenerationVersion || null,
      currentDirtyVersion: instance.currentDirtyVersion || null,
      tableCount: physicalTables.length,
      businessTableCount: Number(instance.businessTableCount || 0),
      dictionaryTableCount: Number(instance.dictionaryTableCount || 0),
      columnCount: Number(instance.columnCount || 0),
      previewTableCount: tableStats.length,
      previewRowCount: totalRows,
      issueCount: dirtyIssues.length,
      totalFieldCells,
      totalIssueCells,
      dirtyRateBasis: "FIELD_CELL",
      dirtyRate,
      affectedTableCount: Number(dirtyVersion?.affectedTableCount || tableStats.filter((item) => Number(item.dirtyIssueCount || 0) > 0).length),
      affectedRowCount: Number(dirtyVersion?.affectedRowCount || tableStats.reduce((sum, item) => sum + Number(item.dirtyRows || 0), 0)),
      issueCategoryStats,
      issueTypeStats,
      qualityGates: gateEvaluation.results,
      failedGateCount: gateEvaluation.failedCount,
      gatePenalty: gateEvaluation.penalty,
      generatedAt: updatedAt,
    },
    tableStats,
    fieldIssues,
    dirtyDistribution,
    createdAt: instance.createdAt || updatedAt,
    updatedAt,
  };
}

async function listBusinessSystemInstancePhysicalVersions(id) {
  await getBusinessSystemInstanceDetail(id);
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.version_no AS versionNo,
            version.logical_version_no AS logicalVersionNo, version.db_type AS dbType,
            version.deploy_target_json AS deployTargetJson, version.version_status AS versionStatus,
            version.physical_model_json AS physicalModelJson, version.ddl_bundle_json AS ddlBundleJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_physical_version AS currentPhysicalVersion
       FROM lab_physical_model_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ?
      ORDER BY version.version_no DESC, version.id DESC`,
    [Number(id)]
  );
  return rows.map(mapPhysicalVersion);
}

async function listBusinessSystemInstanceGenerationVersions(id) {
  await getBusinessSystemInstanceDetail(id);
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.physical_version_no AS physicalVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.plan_json AS planJson, version.sample_preview_json AS samplePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_generation_version AS currentGenerationVersion
       FROM lab_generation_plan_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ?
      ORDER BY version.version_no DESC, version.id DESC`,
    [Number(id)]
  );
  return rows.map(mapGenerationVersion);
}

async function listBusinessSystemInstanceDirtyVersions(id) {
  await getBusinessSystemInstanceDetail(id);
  const [rows] = await pool.query(
    `SELECT version.id, version.instance_id AS instanceId, version.generation_version_no AS generationVersionNo,
            version.version_no AS versionNo, version.version_status AS versionStatus,
            version.dirty_plan_json AS dirtyPlanJson, version.truth_preview_json AS truthPreviewJson,
            version.observed_preview_json AS observedPreviewJson, version.issue_preview_json AS issuePreviewJson,
            version.model_summary AS modelSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            instance.current_dirty_version AS currentDirtyVersion
       FROM lab_dirty_data_version version
       JOIN lab_business_system_instance instance ON instance.id = version.instance_id
      WHERE version.instance_id = ?
      ORDER BY version.version_no DESC, version.id DESC`,
    [Number(id)]
  );
  return rows.map(mapDirtyVersion);
}

async function listBusinessSystemTemplateLogicalVersions(id) {
  await getBusinessSystemTemplateDetail(id);
  const [rows] = await pool.query(
    `SELECT version.id, version.template_id AS templateId, version.version_no AS versionNo,
            version.version_status AS versionStatus, version.source_asset_snapshot_json AS sourceAssetSnapshotJson,
            version.logical_model_json AS logicalModelJson, version.adjustment_history_json AS adjustmentHistoryJson,
            version.model_summary AS modelSummary, version.diff_summary AS diffSummary, version.published_at AS publishedAt,
            version.created_at AS createdAt, version.updated_at AS updatedAt,
            template.current_logical_version AS currentLogicalVersion
       FROM lab_logical_model_version version
       JOIN lab_business_system_template template ON template.id = version.template_id
      WHERE version.template_id = ?
      ORDER BY version.version_no DESC, version.id DESC`,
    [Number(id)]
  );
  return rows.map(mapLogicalVersion);
}

async function createBusinessSystemTemplate(payload, user) {
  const templateName = text(payload.templateName, 128);
  if (!templateName) {
    throw new AppError("模板名称不能为空", 400);
  }

  const templateCode = await ensureUniqueTemplateCode(payload.templateCode || templateName);
  let industryCode = text(payload.industryCode, 64) || "";
  const sourceIncubationId = payload.sourceIncubationId ? Number(payload.sourceIncubationId) : null;
  let sourceAssetSnapshot = {
    incubation: { id: null, incubationName: "", industryCode: industryCode || "" },
    categories: [],
    categoryCodes: [],
    candidateTableSpecs: [],
    dictionaries: [],
    modulePlanner: { summary: "", categories: [] },
  };

  if (sourceIncubationId) {
    const incubation = await incubationService.getIndustryIncubationDetail(sourceIncubationId);
    if (!incubation) {
      throw new AppError("关联的行业孵化项目不存在", 404);
    }
    sourceAssetSnapshot = buildSourceAssetSnapshot(incubation, payload.sourceCategoryCodes);
    if (Array.isArray(payload.sourceCategoryCodes) && payload.sourceCategoryCodes.length > 0 && sourceAssetSnapshot.categoryCodes.length === 0) {
      throw new AppError("未匹配到所选的孵化子类目", 400);
    }
    industryCode = industryCode || String(incubation.industryCode || "");
  }

  const normalizedPayload = {
    templateName,
    templateCode,
    industryCode: industryCode || "generic",
    templateDesc: text(payload.templateDesc, 1024) || null,
    sourceIncubationId,
    sourceCategoryCodes: Array.isArray(sourceAssetSnapshot.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
    templateStatus: ["draft", "active", "archived"].includes(String(payload.templateStatus || "draft"))
      ? String(payload.templateStatus || "draft")
      : "draft",
  };

  const logicalModel = await tryBuildLogicalModelWithModel(normalizedPayload, sourceAssetSnapshot);
  const projectId = getCurrentProjectId();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO lab_business_system_template
        (project_id, template_code, template_name, industry_code, source_incubation_id, source_category_codes_json, template_desc,
         template_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        normalizedPayload.templateCode,
        normalizedPayload.templateName,
        normalizedPayload.industryCode,
        normalizedPayload.sourceIncubationId,
        JSON.stringify(normalizedPayload.sourceCategoryCodes),
        normalizedPayload.templateDesc,
        normalizedPayload.templateStatus,
        user?.displayName || user?.username || "system",
      ]
    );

    const templateId = Number(result.insertId);
    await connection.query(
      `INSERT INTO lab_logical_model_version
        (template_id, version_no, version_status, source_asset_snapshot_json, logical_model_json, adjustment_history_json, model_summary)
       VALUES (?, 1, 'generated', ?, ?, ?, ?)`,
      [
        templateId,
        JSON.stringify(sourceAssetSnapshot),
        JSON.stringify(logicalModel),
        JSON.stringify([]),
        `初始蓝图已从 ${sourceIncubationId ? "行业孵化资产" : "手工定义"} 生成`,
      ]
    );
    await connection.query(
      "UPDATE lab_business_system_template SET current_logical_version = 1 WHERE id = ?",
      [templateId]
    );
    await connection.commit();
    return getBusinessSystemTemplateDetail(templateId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function prepareBusinessSystemTemplateContext(payload) {
  const templateName = text(payload.templateName, 128);
  if (!templateName) {
    throw new AppError("妯℃澘鍚嶇О涓嶈兘涓虹┖", 400);
  }

  const templateCode = await ensureUniqueTemplateCode(payload.templateCode || templateName);
  let industryCode = text(payload.industryCode, 64) || "";
  const sourceIncubationId = payload.sourceIncubationId ? Number(payload.sourceIncubationId) : null;
  let sourceAssetSnapshot = {
    incubation: { id: null, incubationName: "", industryCode: industryCode || "" },
    categories: [],
    categoryCodes: [],
    candidateTableSpecs: [],
    dictionaries: [],
    modulePlanner: { summary: "", categories: [] },
  };

  if (sourceIncubationId) {
    const incubation = await incubationService.getIndustryIncubationDetail(sourceIncubationId);
    if (!incubation) {
      throw new AppError("鍏宠仈鐨勮涓氬鍖栭」鐩笉瀛樺湪", 404);
    }
    sourceAssetSnapshot = buildSourceAssetSnapshot(incubation, payload.sourceCategoryCodes);
    if (Array.isArray(payload.sourceCategoryCodes) && payload.sourceCategoryCodes.length > 0 && sourceAssetSnapshot.categoryCodes.length === 0) {
      throw new AppError("鏈尮閰嶅埌鎵€閫夌殑瀛靛寲瀛愮被鐩?", 400);
    }
    industryCode = industryCode || String(incubation.industryCode || "");
  }

  return {
    normalizedPayload: {
      templateName,
      templateCode,
      industryCode: industryCode || "generic",
      templateDesc: text(payload.templateDesc, 1024) || null,
      sourceIncubationId,
      sourceCategoryCodes: Array.isArray(sourceAssetSnapshot.categoryCodes) ? sourceAssetSnapshot.categoryCodes : [],
      templateStatus: ["draft", "active", "archived"].includes(String(payload.templateStatus || "draft"))
        ? String(payload.templateStatus || "draft")
        : "draft",
    },
    sourceAssetSnapshot,
  };
}

async function persistBusinessSystemTemplate(normalizedPayload, sourceAssetSnapshot, logicalModel, user) {
  const projectId = getCurrentProjectId();
  const modelSummary = String(logicalModel?.meta?.generatedFrom || "").startsWith("logical_model_build")
    ? "初始蓝图已通过 AI 分批分析生成"
    : `鍒濆钃濆浘宸蹭粠 ${normalizedPayload.sourceIncubationId ? "琛屼笟瀛靛寲璧勪骇" : "鎵嬪伐瀹氫箟"} 鐢熸垚`;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO lab_business_system_template
        (project_id, template_code, template_name, industry_code, source_incubation_id, source_category_codes_json, template_desc,
         template_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        normalizedPayload.templateCode,
        normalizedPayload.templateName,
        normalizedPayload.industryCode,
        normalizedPayload.sourceIncubationId,
        JSON.stringify(normalizedPayload.sourceCategoryCodes),
        normalizedPayload.templateDesc,
        normalizedPayload.templateStatus,
        user?.displayName || user?.username || "system",
      ]
    );

    const templateId = Number(result.insertId);
    await connection.query(
      `INSERT INTO lab_logical_model_version
        (template_id, version_no, version_status, source_asset_snapshot_json, logical_model_json, adjustment_history_json, model_summary)
       VALUES (?, 1, 'generated', ?, ?, ?, ?)`,
      [
        templateId,
        JSON.stringify(sourceAssetSnapshot),
        JSON.stringify(logicalModel),
        JSON.stringify([]),
        modelSummary,
      ]
    );
    await connection.query(
      "UPDATE lab_business_system_template SET current_logical_version = 1 WHERE id = ?",
      [templateId]
    );
    await connection.commit();
    return getBusinessSystemTemplateDetail(templateId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function runBusinessSystemTemplateBuildJob(job, payload, user) {
  try {
    job.status = "running";
    job.currentStage = "preparing";
    job.progressPercent = 5;
    job.updatedAt = new Date().toISOString();
    pushTemplateBuildJobLog(job, { stepKey: "job_start", message: "已接收模板创建请求，正在读取行业孵化资产。" });

    const { normalizedPayload, sourceAssetSnapshot } = await prepareBusinessSystemTemplateContext(payload);
    job.templateName = normalizedPayload.templateName;
    job.templateCode = normalizedPayload.templateCode;
    job.sourceCategoryCodes = normalizedPayload.sourceCategoryCodes;
    job.progressPercent = 12;
    job.currentStage = "analyzing_source";
    pushTemplateBuildJobLog(job, {
      stepKey: "source_assets_ready",
      message: `已完成源资产整理，待分析 ${Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs.length : 0} 张候选表。`,
      detail: {
        categoryCodes: normalizedPayload.sourceCategoryCodes,
        tableCount: Array.isArray(sourceAssetSnapshot?.candidateTableSpecs) ? sourceAssetSnapshot.candidateTableSpecs.length : 0,
        dictionaryCount: Array.isArray(sourceAssetSnapshot?.dictionaries) ? sourceAssetSnapshot.dictionaries.length : 0,
      },
    });

    const logicalModel = await tryBuildLogicalModelWithModel(normalizedPayload, sourceAssetSnapshot, {
      onProgress: (event) => {
        job.currentStage = event?.stage || job.currentStage || "running";
        job.progressPercent = Math.max(Number(job.progressPercent || 0), Number(event?.progressPercent || 0));
        job.updatedAt = new Date().toISOString();
        pushTemplateBuildJobLog(job, {
          level: event?.level || "info",
          stepKey: event?.stepKey || "progress",
          message: event?.message || "AI 正在分析逻辑模型。",
          detail: event?.detail || null,
        });
      },
    });

    job.currentStage = "saving";
    job.progressPercent = 98;
    pushTemplateBuildJobLog(job, { stepKey: "template_saving", message: "逻辑模型已生成，正在写入模板与版本数据。" });
    const template = await persistBusinessSystemTemplate(normalizedPayload, sourceAssetSnapshot, logicalModel, user);
    job.status = "completed";
    job.currentStage = "completed";
    job.progressPercent = 100;
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    job.result = {
      templateId: Number(template.id),
      templateName: template.templateName,
    };
    pushTemplateBuildJobLog(job, {
      stepKey: "job_completed",
      message: `模板创建完成：${template.templateName}`,
      detail: { templateId: Number(template.id) },
    });
  } catch (error) {
    job.status = "failed";
    job.currentStage = "failed";
    job.finishedAt = new Date().toISOString();
    job.updatedAt = job.finishedAt;
    job.errorMessage = error instanceof Error ? error.message : "模板创建失败";
    pushTemplateBuildJobLog(job, {
      level: "error",
      stepKey: "job_failed",
      message: job.errorMessage,
      detail: error instanceof Error ? { stack: error.stack || null } : null,
    });
  }
}

async function startBusinessSystemTemplateBuildJob(payload, user) {
  cleanupTemplateBuildJobs();
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    status: "queued",
    templateName: text(payload?.templateName, 128) || "未命名模板",
    templateCode: text(payload?.templateCode, 64) || null,
    sourceCategoryCodes: Array.isArray(payload?.sourceCategoryCodes) ? payload.sourceCategoryCodes : [],
    progressPercent: 0,
    currentStage: "queued",
    result: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    logs: [],
  };
  pushTemplateBuildJobLog(job, { stepKey: "job_queued", message: "模板创建任务已排队，准备开始 AI 分析。" });
  templateBuildJobs.set(job.id, job);
  job.promise = Promise.resolve()
    .then(() => runBusinessSystemTemplateBuildJob(job, payload, user))
    .catch(() => null);
  return summarizeTemplateBuildJob(job);
}

async function getBusinessSystemTemplateBuildJob(jobId) {
  return summarizeTemplateBuildJob(getTemplateBuildJobOrThrow(jobId));
}

async function createBusinessSystemTemplate(payload, user) {
  const { normalizedPayload, sourceAssetSnapshot } = await prepareBusinessSystemTemplateContext(payload);
  const logicalModel = await tryBuildLogicalModelWithModel(normalizedPayload, sourceAssetSnapshot);
  return persistBusinessSystemTemplate(normalizedPayload, sourceAssetSnapshot, logicalModel, user);
}

async function createBusinessSystemInstance(payload, user) {
  const projectId = getCurrentProjectId();
  const templateId = Number(payload.templateId || 0);
  if (!templateId) {
    throw new AppError("\u8bf7\u9009\u62e9\u4e1a\u52a1\u7cfb\u7edf\u6a21\u677f", 400);
  }
  const template = await getBusinessSystemTemplateDetail(templateId);
  if (!template.currentLogicalVersion || !template.currentLogicalModel) {
    throw new AppError("\u6a21\u677f\u5c1a\u672a\u6c89\u6dc0\u53ef\u7528\u7684\u903b\u8f91\u6a21\u578b\u7248\u672c", 400);
  }

  const instanceName = text(payload.instanceName, 128);
  if (!instanceName) {
    throw new AppError("\u5b9e\u4f8b\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a", 400);
  }
  const instanceCode = await ensureUniqueInstanceCode(payload.instanceCode || instanceName);
  const dbType = normalizeDbType(payload.dbType || "mysql");
  const instanceStatus = ["draft", "active", "archived"].includes(String(payload.instanceStatus || "draft"))
    ? String(payload.instanceStatus || "draft")
    : "draft";
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO lab_business_system_instance
        (project_id, instance_code, instance_name, template_id, db_type, deploy_target_json, instance_status, current_logical_version, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        instanceCode,
        instanceName,
        templateId,
        dbType,
        null,
        instanceStatus,
        Number(template.currentLogicalVersion),
        user?.displayName || user?.username || "system",
      ]
    );
    const instanceId = Number(result.insertId);
    const instanceSnapshot = {
      id: instanceId,
      instanceCode,
      instanceName,
      dbType,
    };
    const compiled = compilePhysicalModel(template, template.currentLogicalModel, instanceSnapshot, dbType);
    await connection.query(
      `INSERT INTO lab_physical_model_version
        (instance_id, version_no, logical_version_no, db_type, deploy_target_json, version_status, physical_model_json, ddl_bundle_json, model_summary)
       VALUES (?, 1, ?, ?, ?, 'generated', ?, ?, ?)`,
      [
        instanceId,
        Number(template.currentLogicalVersion),
        dbType,
        null,
        JSON.stringify(compiled.physicalModel),
        JSON.stringify(compiled.ddlBundle),
        `\u6839\u636e\u6a21\u677f V${template.currentLogicalVersion} \u751f\u6210\u9996\u7248\u7269\u7406\u6a21\u578b`,
      ]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET current_physical_version = 1
        WHERE id = ?`,
      [instanceId]
    );
    await connection.commit();
    return getBusinessSystemInstanceDetail(instanceId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function generateBusinessSystemInstancePhysicalModel(id, payload, user) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const template = await getBusinessSystemTemplateDetail(instance.templateId);
  if (!template.currentLogicalVersion || !template.currentLogicalModel) {
    throw new AppError("模板尚未沉淀可用的逻辑模型版本", 400);
  }

  const nextDbType = normalizeDbType(payload?.dbType || instance.dbType || "mysql");
  const compiled = compilePhysicalModel(
    template,
    template.currentLogicalModel,
    {
      id: instance.id,
      instanceCode: instance.instanceCode,
      instanceName: instance.instanceName,
      dbType: nextDbType,
    },
    nextDbType
  );
  const modelSummary = text(payload?.summary, 1024)
    || `根据模板 V${template.currentLogicalVersion} 生成 ${nextDbType.toUpperCase()} 物理模型脚本`;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query(
      `SELECT version_no AS versionNo
         FROM lab_physical_model_version
        WHERE instance_id = ?
        ORDER BY version_no DESC`,
      [Number(id)]
    );
    const nextVersionNo = (versionRows.length > 0 ? Math.max(...versionRows.map((row) => Number(row.versionNo || 0))) : 0) + 1;

    const [result] = await connection.query(
      `INSERT INTO lab_physical_model_version
        (instance_id, version_no, logical_version_no, db_type, deploy_target_json, version_status, physical_model_json, ddl_bundle_json, model_summary)
       VALUES (?, ?, ?, ?, ?, 'deployed', ?, ?, ?)`,
      [
        Number(id),
        nextVersionNo,
        Number(template.currentLogicalVersion),
        nextDbType,
        null,
        JSON.stringify(compiled.physicalModel),
        JSON.stringify(compiled.ddlBundle),
        modelSummary,
      ]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET db_type = ?, deploy_target_json = NULL, current_logical_version = ?, current_physical_version = ?, current_generation_version = NULL, current_dirty_version = NULL
        WHERE id = ?`,
      [nextDbType, Number(template.currentLogicalVersion), nextVersionNo, Number(id)]
    );
    await connection.commit();

    const versions = await listBusinessSystemInstancePhysicalVersions(id);
    return {
      instance: await getBusinessSystemInstanceDetail(id),
      version: versions.find((item) => item.id === Number(result.insertId)) || null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveBusinessSystemInstancePhysicalModel(id, payload, user) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const template = await getBusinessSystemTemplateDetail(instance.templateId);
  const baseVersionNo = payload?.physicalVersionNo
    ? Number(payload.physicalVersionNo)
    : Number(instance.currentPhysicalVersion || 0);
  if (!baseVersionNo) {
    throw new AppError("请先生成可编辑的物理模型版本", 400);
  }

  const baseVersion = await getBusinessSystemInstancePhysicalVersionByVersionNo(id, baseVersionNo);
  const compiled = compileEditablePhysicalModel({
    physicalModel: safeObject(payload?.physicalModel),
    basePhysicalModel: safeObject(baseVersion?.physicalModel),
    instance,
    template,
    logicalVersionNo: baseVersion.logicalVersionNo,
    dbType: baseVersion.dbType || instance.dbType || "mysql",
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query(
      `SELECT version_no AS versionNo
         FROM lab_physical_model_version
        WHERE instance_id = ?
        ORDER BY version_no DESC`,
      [Number(id)]
    );
    const nextVersionNo = (versionRows.length > 0 ? Math.max(...versionRows.map((row) => Number(row.versionNo || 0))) : 0) + 1;
    const modelSummary = text(payload?.summary, 1024)
      || `基于物理模型 V${baseVersionNo} 手工调整并保存为 V${nextVersionNo}`;

    const [result] = await connection.query(
      `INSERT INTO lab_physical_model_version
        (instance_id, version_no, logical_version_no, db_type, deploy_target_json, version_status, physical_model_json, ddl_bundle_json, model_summary)
       VALUES (?, ?, ?, ?, ?, 'edited', ?, ?, ?)`,
      [
        Number(id),
        nextVersionNo,
        Number(baseVersion.logicalVersionNo || instance.currentLogicalVersion || 0),
        normalizeDbType(baseVersion.dbType || instance.dbType || "mysql"),
        null,
        JSON.stringify(compiled.physicalModel),
        JSON.stringify(compiled.ddlBundle),
        modelSummary,
      ]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET db_type = ?, deploy_target_json = NULL, current_logical_version = ?, current_physical_version = ?, current_generation_version = NULL, current_dirty_version = NULL
        WHERE id = ?`,
      [
        normalizeDbType(baseVersion.dbType || instance.dbType || "mysql"),
        Number(baseVersion.logicalVersionNo || instance.currentLogicalVersion || 0),
        nextVersionNo,
        Number(id),
      ]
    );
    await connection.commit();

    const versions = await listBusinessSystemInstancePhysicalVersions(id);
    return {
      instance: await getBusinessSystemInstanceDetail(id),
      version: versions.find((item) => item.id === Number(result.insertId)) || null,
      operator: user?.displayName || user?.username || "system",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deployBusinessSystemInstancePhysicalModel(id, payload, user) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const physicalVersionNo = payload?.physicalVersionNo
    ? Number(payload.physicalVersionNo)
    : Number(instance.currentPhysicalVersion || 0);
  if (!physicalVersionNo) {
    throw new AppError("请先生成可用的物理模型版本", 400);
  }

  const physicalVersion = await getBusinessSystemInstancePhysicalVersionByVersionNo(id, physicalVersionNo);
  const targetDataSource = await getTargetDataSourceForScenario(Number(payload?.targetDataSourceId || 0));
  const physicalDbType = normalizeDbType(physicalVersion.dbType || instance.dbType || "mysql");
  const targetDbType = normalizePlatformSourceType(targetDataSource.sourceType, targetDataSource.connectionConfig || {});

  if (physicalDbType !== targetDbType) {
    throw new AppError(`物理模型数据库类型与目标数据源不匹配: ${physicalDbType} != ${targetDbType}`, 400);
  }

  const deploySummary = await deployPhysicalModelToDataSource(targetDataSource, {
    physicalModel: physicalVersion.physicalModel,
  });
  const deployTarget = {
    ...buildDeployTargetSnapshot(targetDataSource),
    lastDeployment: {
      ...deploySummary,
      versionNo: physicalVersionNo,
      summary: text(payload?.summary, 1024) || null,
    },
    lastLoad: null,
  };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE lab_physical_model_version
          SET deploy_target_json = ?, version_status = 'deployed'
        WHERE instance_id = ? AND version_no = ?`,
      [JSON.stringify(deployTarget), Number(id), physicalVersionNo]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET db_type = ?, deploy_target_json = ?, current_physical_version = ?, current_generation_version = NULL, current_dirty_version = NULL
        WHERE id = ?`,
      [physicalDbType, JSON.stringify(deployTarget), physicalVersionNo, Number(id)]
    );
    await connection.commit();

    return {
      instance: await getBusinessSystemInstanceDetail(id),
      version: await getBusinessSystemInstancePhysicalVersionByVersionNo(id, physicalVersionNo),
      operator: user?.displayName || user?.username || "system",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function generateBusinessSystemInstanceGenerationPlan(id, payload, user) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const physicalVersionNo = payload?.physicalVersionNo
    ? Number(payload.physicalVersionNo)
    : Number(instance.currentPhysicalVersion || 0);
  if (!physicalVersionNo) {
    throw new AppError("请先生成可用的物理模型版本", 400);
  }

  const physicalVersion = await getBusinessSystemInstancePhysicalVersionByVersionNo(id, physicalVersionNo);
  const logicalVersion = await getBusinessSystemTemplateLogicalVersionByVersionNo(instance.templateId, physicalVersion.logicalVersionNo);
  if (!logicalVersion?.logicalModel) {
    throw new AppError("物理模型对应的逻辑模型不存在", 400);
  }

  const targetDataSourceId = Number(
    payload?.targetDataSourceId
    || physicalVersion?.deployTarget?.targetDataSourceId
    || instance?.deployTarget?.targetDataSourceId
    || 0
  );
  if (!targetDataSourceId) {
    throw new AppError("请先选择目标数据源并完成物理模型部署，再生成业务数据", 400);
  }

  const targetDataSource = await getTargetDataSourceForScenario(targetDataSourceId);
  const options = normalizeGenerationPlanOptions(payload || {});
  const compiled = buildGenerationPlanArtifacts(instance, physicalVersion, logicalVersion.logicalModel, options);
  const loadSummary = await loadGeneratedRowsToDataSource(targetDataSource, compiled.loadTables);
  const deployTarget = {
    ...buildDeployTargetSnapshot(targetDataSource),
    lastDeployment: physicalVersion?.deployTarget?.lastDeployment || null,
    lastLoad: loadSummary,
  };
  compiled.generationPlan.meta.deployTarget = deployTarget;
  compiled.generationPlan.loadSummary = loadSummary;
  compiled.samplePreview.meta.deployTarget = deployTarget;
  compiled.samplePreview.meta.loadSummary = loadSummary;
  compiled.generationPlan.summary = buildGenerationPlanSummary(compiled.generationPlan, compiled.samplePreview);
  compiled.samplePreview.summary = buildGenerationPlanSummary(compiled.generationPlan, compiled.samplePreview);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query(
      `SELECT version_no AS versionNo
         FROM lab_generation_plan_version
        WHERE instance_id = ?
        ORDER BY version_no DESC`,
      [Number(id)]
    );
    const nextVersionNo = (versionRows.length > 0 ? Math.max(...versionRows.map((row) => Number(row.versionNo || 0))) : 0) + 1;
    const modelSummary = text(payload?.summary, 1024)
      || `基于物理模型 V${physicalVersionNo} 生成业务数据并装载到 ${targetDataSource.sourceName}`;
    const [result] = await connection.query(
      `INSERT INTO lab_generation_plan_version
        (instance_id, physical_version_no, version_no, version_status, plan_json, sample_preview_json, model_summary)
       VALUES (?, ?, ?, 'generated', ?, ?, ?)`,
      [
        Number(id),
        physicalVersionNo,
        nextVersionNo,
        JSON.stringify(compiled.generationPlan),
        JSON.stringify(compiled.samplePreview),
        modelSummary,
      ]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET deploy_target_json = ?, current_generation_version = ?, current_dirty_version = NULL
        WHERE id = ?`,
      [JSON.stringify(deployTarget), nextVersionNo, Number(id)]
    );
    await connection.commit();

    const versions = await listBusinessSystemInstanceGenerationVersions(id);
    return {
      instance: await getBusinessSystemInstanceDetail(id),
      version: versions.find((item) => item.id === Number(result.insertId)) || null,
      operator: user?.displayName || user?.username || "system",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function generateBusinessSystemInstanceDirtyData(id, payload, user) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const generationVersionNo = payload?.generationVersionNo
    ? Number(payload.generationVersionNo)
    : Number(instance.currentGenerationVersion || 0);
  if (!generationVersionNo) {
    throw new AppError("\u8bf7\u5148\u751f\u6210\u53ef\u7528\u7684\u6570\u636e\u65b9\u6848\u7248\u672c", 400);
  }

  const generationVersion = await getBusinessSystemInstanceGenerationVersionByVersionNo(id, generationVersionNo);
  const physicalVersion = await getBusinessSystemInstancePhysicalVersionByVersionNo(id, generationVersion.physicalVersionNo);
  const options = normalizeDirtyPlanOptions(payload || {});
  const compiled = buildDirtyDataArtifacts(instance, generationVersion, physicalVersion, options);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query(
      `SELECT version_no AS versionNo
         FROM lab_dirty_data_version
        WHERE instance_id = ?
        ORDER BY version_no DESC`,
      [Number(id)]
    );
    const nextVersionNo = (versionRows.length > 0 ? Math.max(...versionRows.map((row) => Number(row.versionNo || 0))) : 0) + 1;
    const modelSummary = text(payload?.summary, 1024)
      || `\u57fa\u4e8e\u6570\u636e\u65b9\u6848 V${generationVersionNo} \u751f\u6210\u9ed8\u8ba4\u810f\u6570\u636e\u65b9\u6848`;
    const [result] = await connection.query(
      `INSERT INTO lab_dirty_data_version
        (instance_id, generation_version_no, version_no, version_status, dirty_plan_json, truth_preview_json, observed_preview_json, issue_preview_json, model_summary)
       VALUES (?, ?, ?, 'generated', ?, ?, ?, ?, ?)`,
      [
        Number(id),
        generationVersionNo,
        nextVersionNo,
        JSON.stringify(compiled.dirtyPlan),
        JSON.stringify(compiled.truthPreview),
        JSON.stringify(compiled.observedPreview),
        JSON.stringify(compiled.issuePreview),
        modelSummary,
      ]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET current_dirty_version = ?
        WHERE id = ?`,
      [nextVersionNo, Number(id)]
    );
    await connection.commit();

    const versions = await listBusinessSystemInstanceDirtyVersions(id);
    return {
      instance: await getBusinessSystemInstanceDetail(id),
      version: versions.find((item) => item.id === Number(result.insertId)) || null,
      operator: user?.displayName || user?.username || "system",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function patchBusinessSystemDirtyDataVersion(versionId, payload, user) {
  const currentVersion = await getBusinessSystemInstanceDirtyVersionById(versionId);
  const instance = await getBusinessSystemInstanceDetail(currentVersion.instanceId);
  const currentDirtyConfig = safeObject(currentVersion.dirtyPlan?.config);
  const generationVersionNo = payload?.generationVersionNo
    ? Number(payload.generationVersionNo)
    : Number(currentVersion.generationVersionNo || currentDirtyConfig.generationVersionNo || instance.currentGenerationVersion || 0);
  if (!generationVersionNo) {
    throw new AppError("\u8bf7\u5148\u6307\u5b9a\u53ef\u7528\u7684\u6570\u636e\u65b9\u6848\u7248\u672c", 400);
  }

  const options = normalizeDirtyPlanOptions({
    generationVersionNo,
    dirtyRatio: payload?.dirtyRatio == null ? currentDirtyConfig.dirtyRatio : payload.dirtyRatio,
    focusCategories: payload?.focusCategories == null ? currentDirtyConfig.focusCategories : payload.focusCategories,
  });
  const generationVersion = await getBusinessSystemInstanceGenerationVersionByVersionNo(currentVersion.instanceId, options.generationVersionNo);
  const physicalVersion = await getBusinessSystemInstancePhysicalVersionByVersionNo(currentVersion.instanceId, generationVersion.physicalVersionNo);
  const compiled = buildDirtyDataArtifacts(instance, generationVersion, physicalVersion, options);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const modelSummary = text(payload?.summary, 1024)
      || text(currentVersion.modelSummary, 1024)
      || `\u7f16\u8f91\u810f\u6570\u636e\u65b9\u6848 V${currentVersion.versionNo}`;
    await connection.query(
      `UPDATE lab_dirty_data_version
          SET generation_version_no = ?,
              version_status = 'edited',
              dirty_plan_json = ?,
              truth_preview_json = ?,
              observed_preview_json = ?,
              issue_preview_json = ?,
              model_summary = ?
        WHERE id = ?`,
      [
        Number(options.generationVersionNo),
        JSON.stringify(compiled.dirtyPlan),
        JSON.stringify(compiled.truthPreview),
        JSON.stringify(compiled.observedPreview),
        JSON.stringify(compiled.issuePreview),
        modelSummary,
        Number(versionId),
      ]
    );
    await connection.query(
      `UPDATE lab_business_system_instance
          SET current_dirty_version = ?
        WHERE id = ?`,
      [Number(currentVersion.versionNo), Number(currentVersion.instanceId)]
    );
    await connection.commit();

    return {
      instance: await getBusinessSystemInstanceDetail(currentVersion.instanceId),
      version: await getBusinessSystemInstanceDirtyVersionById(versionId),
      operator: user?.displayName || user?.username || "system",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteBusinessSystemInstancePhysicalVersion(id, versionId) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const currentVersion = await getBusinessSystemInstancePhysicalVersionById(id, versionId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [generationRows] = await connection.query(
      `SELECT id, version_no AS versionNo
         FROM lab_generation_plan_version
        WHERE instance_id = ? AND physical_version_no = ?`,
      [Number(id), Number(currentVersion.versionNo)]
    );
    const deletedGenerationVersionNos = generationRows.map((row) => Number(row.versionNo || 0)).filter(Boolean);

    let deletedDirtyVersionNos = [];
    if (deletedGenerationVersionNos.length > 0) {
      const [dirtyRows] = await connection.query(
        `SELECT version_no AS versionNo
           FROM lab_dirty_data_version
          WHERE instance_id = ? AND generation_version_no IN (?)`,
        [Number(id), deletedGenerationVersionNos]
      );
      deletedDirtyVersionNos = dirtyRows.map((row) => Number(row.versionNo || 0)).filter(Boolean);
      await connection.query(
        `DELETE FROM lab_dirty_data_version
          WHERE instance_id = ? AND generation_version_no IN (?)`,
        [Number(id), deletedGenerationVersionNos]
      );
      await connection.query(
        `DELETE FROM lab_generation_plan_version
          WHERE instance_id = ? AND physical_version_no = ?`,
        [Number(id), Number(currentVersion.versionNo)]
      );
    }

    await connection.query(
      `DELETE FROM lab_physical_model_version
        WHERE instance_id = ? AND id = ?`,
      [Number(id), Number(versionId)]
    );

    const nextCurrentPhysicalVersion = Number(instance.currentPhysicalVersion || 0) === Number(currentVersion.versionNo)
      ? await getLatestInstanceVersionNo(connection, "lab_physical_model_version", id)
      : (Number(instance.currentPhysicalVersion || 0) || null);
    const nextCurrentGenerationVersion = deletedGenerationVersionNos.includes(Number(instance.currentGenerationVersion || 0))
      ? await getLatestInstanceVersionNo(connection, "lab_generation_plan_version", id)
      : (Number(instance.currentGenerationVersion || 0) || null);
    const nextCurrentDirtyVersion = deletedDirtyVersionNos.includes(Number(instance.currentDirtyVersion || 0))
      ? await getLatestInstanceVersionNo(connection, "lab_dirty_data_version", id)
      : (Number(instance.currentDirtyVersion || 0) || null);

    let nextDbType = instance.dbType || currentVersion.dbType || "mysql";
    if (nextCurrentPhysicalVersion) {
      const [physicalRows] = await connection.query(
        `SELECT db_type AS dbType
           FROM lab_physical_model_version
          WHERE instance_id = ? AND version_no = ?
          LIMIT 1`,
        [Number(id), Number(nextCurrentPhysicalVersion)]
      );
      nextDbType = physicalRows[0]?.dbType || nextDbType;
    }

    await connection.query(
      `UPDATE lab_business_system_instance
          SET db_type = ?,
              deploy_target_json = ?,
              current_physical_version = ?,
              current_generation_version = ?,
              current_dirty_version = ?
        WHERE id = ?`,
      [
        nextDbType,
        Number(instance.currentPhysicalVersion || 0) === Number(currentVersion.versionNo) ? null : JSON.stringify(instance.deployTarget || null),
        nextCurrentPhysicalVersion,
        nextCurrentGenerationVersion,
        nextCurrentDirtyVersion,
        Number(id),
      ]
    );
    await connection.commit();

    return {
      id: Number(versionId),
      instanceId: Number(id),
      versionNo: Number(currentVersion.versionNo),
      deletedGenerationVersionCount: deletedGenerationVersionNos.length,
      deletedDirtyVersionCount: deletedDirtyVersionNos.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteBusinessSystemInstanceGenerationVersion(id, versionId) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const currentVersion = await getBusinessSystemInstanceGenerationVersionById(id, versionId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [dirtyRows] = await connection.query(
      `SELECT version_no AS versionNo
         FROM lab_dirty_data_version
        WHERE instance_id = ? AND generation_version_no = ?`,
      [Number(id), Number(currentVersion.versionNo)]
    );
    const deletedDirtyVersionNos = dirtyRows.map((row) => Number(row.versionNo || 0)).filter(Boolean);

    if (deletedDirtyVersionNos.length > 0) {
      await connection.query(
        `DELETE FROM lab_dirty_data_version
          WHERE instance_id = ? AND generation_version_no = ?`,
        [Number(id), Number(currentVersion.versionNo)]
      );
    }

    await connection.query(
      `DELETE FROM lab_generation_plan_version
        WHERE instance_id = ? AND id = ?`,
      [Number(id), Number(versionId)]
    );

    const nextCurrentGenerationVersion = Number(instance.currentGenerationVersion || 0) === Number(currentVersion.versionNo)
      ? await getLatestInstanceVersionNo(connection, "lab_generation_plan_version", id)
      : (Number(instance.currentGenerationVersion || 0) || null);
    const nextCurrentDirtyVersion = deletedDirtyVersionNos.includes(Number(instance.currentDirtyVersion || 0))
      ? await getLatestInstanceVersionNo(connection, "lab_dirty_data_version", id)
      : (Number(instance.currentDirtyVersion || 0) || null);

    await connection.query(
      `UPDATE lab_business_system_instance
          SET current_generation_version = ?,
              current_dirty_version = ?
        WHERE id = ?`,
      [nextCurrentGenerationVersion, nextCurrentDirtyVersion, Number(id)]
    );
    await connection.commit();

    return {
      id: Number(versionId),
      instanceId: Number(id),
      versionNo: Number(currentVersion.versionNo),
      deletedDirtyVersionCount: deletedDirtyVersionNos.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteBusinessSystemInstanceDirtyVersion(id, versionId) {
  const instance = await getBusinessSystemInstanceDetail(id);
  const currentVersion = await getBusinessSystemInstanceDirtyVersionByScopedId(id, versionId);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM lab_dirty_data_version
        WHERE instance_id = ? AND id = ?`,
      [Number(id), Number(versionId)]
    );

    const nextCurrentDirtyVersion = Number(instance.currentDirtyVersion || 0) === Number(currentVersion.versionNo)
      ? await getLatestInstanceVersionNo(connection, "lab_dirty_data_version", id)
      : (Number(instance.currentDirtyVersion || 0) || null);

    await connection.query(
      `UPDATE lab_business_system_instance
          SET current_dirty_version = ?
        WHERE id = ?`,
      [nextCurrentDirtyVersion, Number(id)]
    );
    await connection.commit();

    return {
      id: Number(versionId),
      instanceId: Number(id),
      versionNo: Number(currentVersion.versionNo),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getBusinessSystemInstanceQualityReport(id) {
  return buildBusinessSystemInstanceQualityReport(Number(id));
}

async function rebuildBusinessSystemInstanceQualityReport(id) {
  return buildBusinessSystemInstanceQualityReport(Number(id));
}

async function updateBusinessSystemTemplateBasic(id, payload) {
  await getBusinessSystemTemplateDetail(id);
  const scoped = getScopedWhere("");
  const templateName = text(payload.templateName, 128);
  if (!templateName) {
    throw new AppError("模板名称不能为空", 400);
  }

  const templateCode = await ensureUniqueTemplateCode(payload.templateCode || templateName, {
    excludeTemplateId: Number(id),
  });
  const industryCode = text(payload.industryCode, 64) || "generic";
  const templateDesc = text(payload.templateDesc, 1024) || null;
  const templateStatus = ["draft", "active", "archived"].includes(String(payload.templateStatus || "draft"))
    ? String(payload.templateStatus || "draft")
    : "draft";

  await pool.query(
    `UPDATE lab_business_system_template
        SET template_code = ?, template_name = ?, industry_code = ?, template_desc = ?, template_status = ?
      WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
    [templateCode, templateName, industryCode, templateDesc, templateStatus, Number(id), ...scoped.params]
  );

  return getBusinessSystemTemplateDetail(id);
}

async function saveBusinessSystemTemplateLogicalModel(id, payload, user) {
  const template = await getBusinessSystemTemplateDetail(id);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [versionRows] = await connection.query(
      `SELECT id, template_id AS templateId, version_no AS versionNo, version_status AS versionStatus,
              source_asset_snapshot_json AS sourceAssetSnapshotJson, logical_model_json AS logicalModelJson,
              adjustment_history_json AS adjustmentHistoryJson, model_summary AS modelSummary, diff_summary AS diffSummary,
              published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt
         FROM lab_logical_model_version
        WHERE template_id = ?
        ORDER BY version_no DESC, id DESC`,
      [Number(id)]
    );

    const currentVersionRow = versionRows.find((row) => Number(row.versionNo) === Number(template.currentLogicalVersion))
      || versionRows[0]
      || null;
    const currentLogicalModel = currentVersionRow ? safeJsonParse(currentVersionRow.logicalModelJson, null) : null;
    const sourceAssetSnapshot = currentVersionRow
      ? safeJsonParse(currentVersionRow.sourceAssetSnapshotJson, buildFallbackSourceAssetSnapshot(template))
      : buildFallbackSourceAssetSnapshot(template);
    const currentAdjustmentHistory = currentVersionRow
      ? safeJsonParse(currentVersionRow.adjustmentHistoryJson, [])
      : [];
    const nextVersionNo = (versionRows.length > 0 ? Math.max(...versionRows.map((row) => Number(row.versionNo || 0))) : 0) + 1;
    const logicalModel = normalizeLogicalModel(payload.logicalModel, template);
    const modelSummary = text(payload.summary, 1024) || `逻辑模型已保存为 V${nextVersionNo}`;
    const adjustmentHistory = [
      ...(Array.isArray(currentAdjustmentHistory) ? currentAdjustmentHistory : []),
      {
        eventType: "manual_save",
        versionNo: nextVersionNo,
        summary: modelSummary,
        operator: user?.displayName || user?.username || "system",
        occurredAt: new Date().toISOString(),
      },
    ];
    const diffSummary = buildVersionDiffSummary(currentLogicalModel, logicalModel);

    const [result] = await connection.query(
      `INSERT INTO lab_logical_model_version
        (template_id, version_no, version_status, source_asset_snapshot_json, logical_model_json, adjustment_history_json, model_summary, diff_summary)
       VALUES (?, ?, 'edited', ?, ?, ?, ?, ?)`,
      [
        Number(id),
        nextVersionNo,
        JSON.stringify(sourceAssetSnapshot),
        JSON.stringify(logicalModel),
        JSON.stringify(adjustmentHistory),
        modelSummary,
        diffSummary,
      ]
    );
    await connection.query(
      "UPDATE lab_business_system_template SET current_logical_version = ? WHERE id = ?",
      [nextVersionNo, Number(id)]
    );
    await connection.commit();

    const versions = await listBusinessSystemTemplateLogicalVersions(id);
    return {
      template: await getBusinessSystemTemplateDetail(id),
      version: versions.find((item) => item.id === Number(result.insertId)) || null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listBusinessSystemTemplates,
  getBusinessSystemTemplateDetail,
  listBusinessSystemInstances,
  getBusinessSystemInstanceDetail,
  listIndustryDataSources,
  getIndustryDataSourceDetail,
  getIndustryDataSourceSharedEntityDetail,
  startBusinessSystemTemplateBuildJob,
  getBusinessSystemTemplateBuildJob,
  createBusinessSystemTemplate,
  createBusinessSystemInstance,
  createIndustryDataSource,
  deleteBusinessSystemTemplate,
  deleteBusinessSystemInstance,
  deleteIndustryDataSource,
  listBusinessSystemTemplateLogicalVersions,
  listBusinessSystemInstancePhysicalVersions,
  listBusinessSystemInstanceGenerationVersions,
  listBusinessSystemInstanceDirtyVersions,
  updateBusinessSystemTemplateBasic,
  saveBusinessSystemTemplateLogicalModel,
  generateBusinessSystemInstancePhysicalModel,
  saveBusinessSystemInstancePhysicalModel,
  deleteBusinessSystemInstancePhysicalVersion,
  exportBusinessSystemInstancePhysicalDesignDoc,
  deployBusinessSystemInstancePhysicalModel,
  generateBusinessSystemInstanceGenerationPlan,
  deleteBusinessSystemInstanceGenerationVersion,
  generateBusinessSystemInstanceDirtyData,
  deleteBusinessSystemInstanceDirtyVersion,
  patchBusinessSystemDirtyDataVersion,
  getBusinessSystemInstanceQualityReport,
  rebuildBusinessSystemInstanceQualityReport,
  rebuildIndustryDataSourcePreview,
};

