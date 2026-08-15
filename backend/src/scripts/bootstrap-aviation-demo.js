/*
 * Idempotent aviation demo bootstrap.
 *
 * The script deliberately reads database credentials from the process
 * environment. No API key, token or password is stored in source control.
 * It materializes the same ontology JSON used by the knowledge graph into
 * standards, data-map, modelling and reporting assets for project 7.
 */
const fs = require("node:fs");
const path = require("node:path");
const { pool } = require("../config/database");
const { decryptSecret } = require("../modules/data-development/data-development.utils");

const PROJECT_ID = Number(process.env.AVIATION_PROJECT_ID || 7);
const CREATED_BY = "aviation-demo-bootstrap";
const ROOT_DIR = path.resolve(__dirname, "../../../");
const KNOWLEDGE_BASE = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "scripts/aviation_ontology_knowledge_base.json"), "utf8"));
const FIELD_LINEAGE = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "scripts/aviation_ontology_field_lineage.json"), "utf8"));

const FIELD_LABELS = {
  entity_id: "实体标识",
  flight_segment_id: "航班架次标识",
  flight_no: "航班号",
  dep_airport: "起飞机场 ICAO",
  arr_airport: "到达机场 ICAO",
  std: "计划起飞时间",
  sta: "计划到达时间",
  atd: "实际起飞时间",
  flight_status: "航班状态",
  tail_no: "航空器机尾号",
  carrier_code: "承运人代码",
  source_record_id: "来源记录标识",
  business_key: "跨来源业务唯一键",
  delay_code_raw: "源系统延误原因代码",
  delay_code_std: "标准延误原因代码",
  delay_category_cn: "延误原因分类",
  delay_minutes: "延误分钟数",
  record_source: "记录来源",
  source_updated_at: "来源更新时间",
  ingested_at: "平台接入时间",
  aircraft_model: "机型",
  cabin_class: "客舱宽窄体分类",
  remain_flight_hours: "剩余可飞小时",
  has_mel_defect: "是否存在 MEL 缺陷",
  mel_defect: "MEL 缺陷描述",
  current_station: "当前机场 ICAO",
  tail_status: "航空器状态",
  crew_id: "机组成员编号",
  crew_name: "机组成员姓名",
  crew_role: "机组角色",
  qualified_model: "可执飞机型",
  duty_start: "值勤开始时间",
  duty_hours: "连续值勤小时",
  duty_limit_hours: "值勤上限小时",
  rest_hours: "已休息小时",
  rest_min_hours: "最低休息小时",
  assigned_flight_no: "分配航班号",
  compliance_flag: "值勤合规标记",
  airport_icao: "机场 ICAO",
  observe_time: "气象观测时间",
  weather_phenomenon: "天气现象",
  visibility_m: "能见度（米）",
  wind_gust_kt: "阵风（节）",
  severity_level: "天气严重等级",
  flight_category: "飞行规则类别",
  runway_id: "跑道编号",
  slot_hour: "容量小时",
  declared_capacity: "公布容量",
  available_capacity: "可用容量",
  capacity_ratio: "容量比例",
  restriction_reason: "容量限制原因",
};

const CONCEPT_TABLES = {
  FlightSegment: { table: "ods_flight_schedule", label: "航班架次", role: "fact" },
  AircraftTail: { table: "ods_aircraft_tail", label: "航空器机尾", role: "dimension" },
  CrewMember: { table: "ods_crew_roster", label: "机组成员", role: "dimension" },
  WeatherEvent: { table: "ods_weather_metar", label: "气象事件", role: "fact" },
  RunwayCapacity: { table: "ods_runway_slot", label: "跑道容量", role: "fact" },
};
const CONCEPT_CODES = {
  FlightSegment: "FLIGHT",
  AircraftTail: "AIRCRAFT",
  CrewMember: "CREW",
  WeatherEvent: "WEATHER",
  RunwayCapacity: "RUNWAY",
};

function json(value) {
  return JSON.stringify(value ?? {});
}

function unique(values) {
  return [...new Set(values)];
}

function inferStandardDataType(fieldName) {
  const name = String(fieldName || "").toLowerCase();
  if (/(minutes|hours|capacity|count|ratio|latitude|longitude|speed|temperature|dewpoint|altimeter|elevation)/.test(name)) return "decimal";
  if (/(time|date|atd|std|sta|updated|ingested|observed|fetched)/.test(name)) return "datetime";
  return "string";
}

function buildAviationStandardSpecs() {
  const sourceFields = FIELD_LINEAGE.fieldMappings.map((item) => ({
    concept: item.concept,
    field: item.conceptField,
    sourceTable: item.source?.table,
    sourceField: item.source?.field,
    transform: item.transform,
    keyRole: item.keyRole,
  }));
  const extras = [
    { concept: "FlightSegment", field: "flight_segment_id", sourceTable: "ods_flight_schedule", sourceField: "flight_segment_id", transform: "direct", keyRole: "PK" },
    { concept: "FlightSegment", field: "business_key", sourceTable: "ods_flight_schedule", sourceField: "business_key", transform: "direct", keyRole: "BUSINESS_KEY" },
    { concept: "FlightSegment", field: "source_updated_at", sourceTable: "ods_flight_schedule", sourceField: "source_updated_at", transform: "direct", keyRole: "INCREMENTAL_CURSOR" },
    { concept: "FlightSegment", field: "record_source", sourceTable: "ods_flight_schedule", sourceField: "record_source", transform: "direct", keyRole: "SOURCE_ATTRIBUTE" },
    { concept: "FlightSegment", field: "ingested_at", sourceTable: "ods_flight_schedule", sourceField: "ingested_at", transform: "direct", keyRole: "AUDIT_FIELD" },
  ];
  const byIdentifier = new Map();
  for (const item of [...sourceFields, ...extras]) {
    const identifier = `AVIATION.${CONCEPT_CODES[item.concept] || String(item.concept).toUpperCase()}.${String(item.field).toUpperCase()}`;
    if (!byIdentifier.has(identifier)) byIdentifier.set(identifier, item);
  }
  return [...byIdentifier.entries()].map(([elementIdentifier, item], index) => ({
    elementIdentifier,
    elementCode: `HB${String(index + 1).padStart(5, "0")}`,
    elementNameCn: FIELD_LABELS[item.field] || item.field,
    elementNameEn: item.field,
    objectClass: item.concept,
    propertyName: item.field,
    representationTerm: inferStandardDataType(item.field),
    definition: `${CONCEPT_TABLES[item.concept]?.label || item.concept}的${FIELD_LABELS[item.field] || item.field}，来源字段 ${item.sourceTable}.${item.sourceField}。`,
    dataType: inferStandardDataType(item.field),
    keyRole: item.keyRole,
    sourceTable: item.sourceTable,
    sourceField: item.sourceField,
    transform: item.transform,
  }));
}

function buildAviationLogicalModel() {
  const tables = Object.entries(CONCEPT_TABLES).map(([concept, spec]) => {
    const entity = KNOWLEDGE_BASE.entities.find((item) => item.id === concept);
    const lineageFields = FIELD_LINEAGE.fieldMappings.filter((item) => item.concept === concept);
    const fields = unique([...(entity?.core_fields || []), ...lineageFields.map((item) => item.conceptField)]).map((field) => ({
      fieldName: field,
      fieldType: inferStandardDataType(field),
      required: ["flight_segment_id", "tail_no", "crew_id", "airport_icao", "flight_no"].includes(field),
      businessSemantic: FIELD_LABELS[field] || field,
      fieldComment: FIELD_LABELS[field] || field,
    }));
    const keyField = entity?.key?.split("#")[0] || fields[0]?.fieldName;
    return {
      tableName: concept,
      tableLabel: spec.label,
      tableComment: `${spec.label}概念实体，映射物理表 ${spec.table}`,
      businessRole: spec.role,
      keyInfoItems: [{ keyType: "PRIMARY_KEY", fields: entity?.key ? entity.key.split("#") : [keyField], note: "来自航空本体字段级血缘" }],
      sourceRefs: [spec.table, "scripts/aviation_ontology_field_lineage.json"],
      physicalTableName: spec.table,
      fields,
    };
  });
  const relations = KNOWLEDGE_BASE.relations.map((item) => ({
    relationName: item.id,
    fromTable: item.source,
    fromField: item.join.includes("flight_no") ? "flight_no" : item.id === "operatedBy" ? "tail_no" : "airport_icao",
    toTable: item.target,
    toField: item.id === "operatedBy" ? "tail_no" : item.id === "staffedBy" ? "assigned_flight_no" : item.id === "impacts" ? "dep_airport" : "id",
    relationType: item.id === "staffedBy" ? "N:N" : "N:1",
    joinCondition: item.join,
    sourceRef: item.view,
  }));
  const logicalModel = {
    meta: { domain: "aviation_ontology_demo", source: "field-lineage-and-er" },
    modules: [{ moduleKey: "aviation_operations", moduleLabel: "航空运行核心域", summary: "航班、机务、机组、气象与跑道容量的统一语义模型", tableNames: tables.map((item) => item.tableName) }],
    tables,
    relations,
    dictTables: [{ dictType: "delay_code", dictName: "CODA 延误原因字典", categoryCode: "AVIATION_DELAY", sourceRefs: ["dim_delay_code_coda"], items: KNOWLEDGE_BASE.dictionaries.map((item) => ({ itemCode: item.code, itemLabel: item.name, valueRange: item.values })) }],
    rules: KNOWLEDGE_BASE.rules,
  };
  logicalModel.summary = {
    moduleCount: logicalModel.modules.length,
    tableCount: logicalModel.tables.length,
    dictCount: logicalModel.dictTables.length,
    relationCount: logicalModel.relations.length,
  };
  return logicalModel;
}

function buildAviationReportDataset() {
  return {
    datasetName: "航空延误处置分析数据集",
    datasetCode: "aviation_delay_disposal_analysis",
    datasetType: "sql",
    sourceTable: null,
    sourceSql: `WITH weather_window AS (
  SELECT DISTINCT ON (w.airport_icao, substr(w.observe_time, 1, 13))
         w.airport_icao, w.observe_time, w.report_type, w.weather_phenomenon,
         w.visibility_m, w.wind_gust_kt, w.severity_level
  FROM ods_weather_metar w
  WHERE w.severity_level = 'SEVERE'
  ORDER BY w.airport_icao, substr(w.observe_time, 1, 13), w.observe_time DESC
), flight_base AS (
  SELECT f.flight_segment_id, f.flight_no, f.dep_airport, f.arr_airport, f.flight_status,
         COALESCE(NULLIF(f.delay_minutes::text, '')::numeric, 0) AS delay_minutes,
         COALESCE(d.category_cn, '天气影响') AS delay_category,
         w.weather_phenomenon,
         f.std
  FROM ods_flight_schedule f
  JOIN weather_window w
    ON w.airport_icao = f.dep_airport
   AND substr(w.observe_time, 1, 13) = substr(f.std, 1, 13)
  LEFT JOIN dim_delay_code_coda d ON d.raw_code = COALESCE(f.delay_code_raw, '')
)
SELECT delay_category, weather_phenomenon,
       COUNT(*) AS flight_count,
       COUNT(*) AS weather_affected_flight_count,
       SUM(CASE WHEN delay_minutes > 0 THEN 1 ELSE 0 END) AS delayed_flight_count,
       SUM(delay_minutes) AS delay_minutes,
       ROUND(AVG(delay_minutes), 1) AS avg_delay_minutes,
       SUM(CASE WHEN delay_minutes >= 30 THEN 1 ELSE 0 END) AS severe_delay_count
FROM flight_base
GROUP BY delay_category, weather_phenomenon
ORDER BY delayed_flight_count DESC, delay_category, weather_phenomenon`,
    fields: [
      { columnName: "delay_category", label: "延误原因分类", dataType: "string", role: "category", visible: true },
      { columnName: "weather_phenomenon", label: "天气现象", dataType: "string", role: "category", visible: true },
      { columnName: "flight_count", label: "航班数", dataType: "integer", role: "metric", aggregation: "sum", visible: true },
      { columnName: "weather_affected_flight_count", label: "受天气影响航班数", dataType: "integer", role: "metric", aggregation: "sum", visible: true },
      { columnName: "delayed_flight_count", label: "延误航班数", dataType: "integer", role: "metric", aggregation: "sum", visible: true },
      { columnName: "delay_minutes", label: "延误分钟总数", dataType: "integer", role: "metric", aggregation: "sum", visible: true },
      { columnName: "avg_delay_minutes", label: "平均延误分钟", dataType: "decimal", role: "metric", aggregation: "avg", visible: true },
      { columnName: "severe_delay_count", label: "严重延误数", dataType: "integer", role: "metric", aggregation: "sum", visible: true },
    ],
    queryConfig: { limit: 100, refreshIntervalSec: 300 },
    description: "连接强雷暴天气窗口与航班计划，统计受天气影响的航班和延误处置强度。",
  };
}

function buildAviationWeatherAdjustmentDataset() {
  const fields = [
    ["flight_segment_id", "航班架次标识", "string"],
    ["flight_no", "航班号", "string"],
    ["dep_airport", "起飞机场 ICAO", "string"],
    ["arr_airport", "到达机场 ICAO", "string"],
    ["segment_type", "航段类型", "string"],
    ["std", "计划起飞时间", "datetime"],
    ["sta", "计划到达时间", "datetime"],
    ["atd", "实际起飞时间", "datetime"],
    ["flight_status", "航班状态", "string"],
    ["delay_code_raw", "原始延误原因代码", "string"],
    ["delay_code_std", "标准延误原因代码", "string"],
    ["delay_category_cn", "延误原因分类", "string"],
    ["delay_minutes", "延误分钟数", "decimal"],
    ["tail_no", "航空器机尾号", "string"],
    ["carrier_code", "承运人代码", "string"],
    ["weather_airport_icao", "天气机场 ICAO", "string"],
    ["weather_observe_time", "天气观测时间", "datetime"],
    ["weather_report_type", "天气报文类型", "string"],
    ["weather_raw_report", "原始天气报文", "string"],
    ["weather_phenomenon", "天气现象", "string"],
    ["visibility_m", "能见度（米）", "decimal"],
    ["wind_gust_kt", "阵风（节）", "decimal"],
    ["severity_level", "天气严重等级", "string"],
    ["runway_id", "跑道编号", "string"],
    ["slot_hour", "跑道容量小时", "datetime"],
    ["declared_capacity", "公布容量", "decimal"],
    ["available_capacity", "可用容量", "decimal"],
    ["capacity_ratio", "容量比例", "decimal"],
    ["restriction_reason", "容量限制原因", "string"],
    ["adjustment_type", "调整类型", "string"],
    ["recommended_action", "建议处置动作", "string"],
    ["impact_evidence", "天气影响证据", "string"],
  ].map(([columnName, label, dataType]) => ({ columnName, label, dataType, visible: true }));
  return {
    datasetName: "受天气影响需调整的航班全字段",
    datasetCode: "aviation_weather_adjustment_flights",
    datasetType: "sql",
    sourceTable: null,
    sourceSql: `WITH weather_window AS (
  SELECT DISTINCT ON (w.airport_icao, substr(w.observe_time, 1, 13))
         w.airport_icao, w.observe_time, w.report_type, w.raw_report, w.weather_phenomenon,
         w.visibility_m, w.wind_gust_kt, w.severity_level
  FROM ods_weather_metar w
  WHERE w.severity_level = 'SEVERE'
  ORDER BY w.airport_icao, substr(w.observe_time, 1, 13), w.observe_time DESC
), runway_window AS (
  SELECT DISTINCT ON (r.airport_icao, substr(r.slot_hour, 1, 13))
         r.airport_icao, r.runway_id, r.slot_hour, r.declared_capacity,
         r.available_capacity, r.capacity_ratio, r.restriction_reason
  FROM ods_runway_slot r
  ORDER BY r.airport_icao, substr(r.slot_hour, 1, 13), r.slot_hour DESC
)
SELECT f.flight_segment_id, f.flight_no, f.dep_airport, f.arr_airport, f.segment_type,
       f.std, f.sta, f.atd, f.flight_status, f.delay_code_raw,
       d.coda_code AS delay_code_std, d.category_cn AS delay_category_cn,
       COALESCE(NULLIF(f.delay_minutes::text, '')::numeric, 0) AS delay_minutes,
       f.tail_no, f.carrier_code,
       w.airport_icao AS weather_airport_icao, w.observe_time AS weather_observe_time,
       w.report_type AS weather_report_type, w.raw_report AS weather_raw_report,
       w.weather_phenomenon, w.visibility_m, w.wind_gust_kt, w.severity_level,
       r.runway_id, r.slot_hour, NULLIF(r.declared_capacity::text, '')::numeric AS declared_capacity,
       NULLIF(r.available_capacity::text, '')::numeric AS available_capacity,
       NULLIF(r.capacity_ratio::text, '')::numeric AS capacity_ratio, r.restriction_reason,
       CASE WHEN COALESCE(NULLIF(f.delay_minutes::text, '')::numeric, 0) > 0
            THEN 'WEATHER_DELAYED_FLIGHT'
            WHEN COALESCE(r.restriction_reason, '') <> ''
            THEN 'RUNWAY_CAPACITY_ADJUSTMENT'
            ELSE 'WEATHER_IMPACT_REVIEW' END AS adjustment_type,
       CASE WHEN COALESCE(NULLIF(f.delay_minutes::text, '')::numeric, 0) > 0
            THEN '申请后移时隙并通知旅客'
            WHEN COALESCE(r.restriction_reason, '') <> ''
            THEN '申请下一可用跑道时隙'
            ELSE '复核航班放行条件' END AS recommended_action,
       'WeatherEvent impacts FlightSegment：起飞机场与天气观测小时匹配' AS impact_evidence
FROM ods_flight_schedule f
JOIN weather_window w
  ON w.airport_icao = f.dep_airport
 AND substr(w.observe_time, 1, 13) = substr(f.std, 1, 13)
LEFT JOIN runway_window r
  ON r.airport_icao = f.dep_airport
 AND substr(r.slot_hour, 1, 13) = substr(f.std, 1, 13)
LEFT JOIN dim_delay_code_coda d ON d.raw_code = COALESCE(f.delay_code_raw, '')
WHERE w.severity_level = 'SEVERE'
ORDER BY f.std, f.flight_no`,
    fields,
    queryConfig: { limit: 100, refreshIntervalSec: 300 },
    description: "展示受强雷暴影响、需要调整的航班全字段、天气证据、跑道容量和建议处置动作。",
  };
}

function buildAviationReportWidgetSpecs({ summaryDatasetId, detailDatasetId, chartIds }) {
  const detailColumns = buildAviationWeatherAdjustmentDataset().fields.map((field) => ({
    key: field.columnName,
    title: field.label,
    dataIndex: field.columnName,
  }));
  return [
    ["delay-kpi", "受天气影响航班数", "kpi", null, Number(summaryDatasetId), { x: 0, y: 0, w: 3, h: 2 }, { metric: "weather_affected_flight_count", fieldMap: { valueField: "weather_affected_flight_count", nameField: "weather_phenomenon" }, title: "受天气影响航班数" }],
    ["delay-category", "天气影响原因分布", "chart", chartIds[0], Number(summaryDatasetId), { x: 0, y: 2, w: 6, h: 4 }, { title: "强雷暴窗口内的天气影响航班", fieldMap: { xField: "delay_category", yField: "weather_affected_flight_count" } }],
    ["delay-severity", "天气影响处置强度", "chart", chartIds[1], Number(summaryDatasetId), { x: 6, y: 2, w: 6, h: 4 }, { title: "平均延误与严重延误", fieldMap: { xField: "delay_category", yField: "avg_delay_minutes", y2Field: "severe_delay_count" } }],
    ["decision-table", "受天气影响需调整的航班全字段", "table", null, Number(detailDatasetId), { x: 0, y: 6, w: 12, h: 5 }, { title: "受天气影响需调整的航班全字段", columns: detailColumns, table: { pageSize: 20 } }],
  ];
}

async function findOne(db, sql, params) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

async function ensureCatalog(db, code, name, parentId = null, description = "") {
  const existing = await findOne(db, "SELECT id FROM std_catalogs WHERE project_id = ? AND catalog_code = ? LIMIT 1", [PROJECT_ID, code]);
  if (existing) return Number(existing.id);
  const [result] = await db.query(
    `INSERT INTO std_catalogs (project_id,parent_id,catalog_name,catalog_code,catalog_type,owner_name,description,sort_order,status,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [PROJECT_ID, parentId, name, code, parentId ? "business_domain" : "root", "航空数据治理组", description, 10, "active", CREATED_BY]
  );
  return Number(result.insertId);
}

async function ensureReferenceStandard(db) {
  const existing = await findOne(db, "SELECT id FROM std_reference_standards WHERE project_id = ? AND standard_code = ? LIMIT 1", [PROJECT_ID, "HB_AVIATION_2026"]);
  if (existing) return Number(existing.id);
  const [result] = await db.query(
    `INSERT INTO std_reference_standards
       (project_id,standard_code,standard_name,standard_type,standard_no,publisher,effective_date,description,status,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [PROJECT_ID, "HB_AVIATION_2026", "航空运行数据元与编码项目基线", "industry", "HB/T AVIATION-2026", "航空运行控制中心", "2026-08-01", "依据航空本体知识库、METAR 与 CODA 延误编码形成的行业数据标准基线。", "active", CREATED_BY]
  );
  return Number(result.insertId);
}

async function seedStandards(db) {
  const root = await ensureCatalog(db, "AVIATION.ROOT", "航空业数据标准", null, "航空运行、气象、机务和机组数据标准目录");
  const catalogIds = new Map();
  for (const [concept, spec] of Object.entries(CONCEPT_TABLES)) {
    catalogIds.set(concept, await ensureCatalog(db, `AVIATION.${concept.toUpperCase()}`, spec.label, root, `${spec.label}及其物理表字段标准`));
  }
  const referenceId = await ensureReferenceStandard(db);
  const domainSpecs = [
    ["AVIATION.FLIGHT.STATUS", "航班状态值域", ["SCHEDULED", "DEPARTED", "ARRIVED", "CANCELLED", "DELAYED"]],
    ["AVIATION.FLIGHT.SOURCE", "航班记录来源值域", ["MANUAL", "AVIATIONSTACK"]],
    ["AVIATION.DELAY.CODA", "CODA 延误原因值域", unique(KNOWLEDGE_BASE.dictionaries.flatMap((item) => item.values))],
    ["AVIATION.WEATHER.CATEGORY", "飞行规则类别值域", ["VFR", "MVFR", "IFR", "LIFR", "NO_CURRENT_REPORT"]],
  ];
  const domains = new Map();
  for (const [domainCode, domainName, values] of domainSpecs) {
    const current = await findOne(db, "SELECT id FROM std_value_domains WHERE project_id = ? AND domain_code = ? LIMIT 1", [PROJECT_ID, domainCode]);
    let domainId = current ? Number(current.id) : null;
    if (!domainId) {
      const [result] = await db.query(
        `INSERT INTO std_value_domains (project_id,domain_code,domain_name,domain_type,value_type,data_type,description,status,created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [PROJECT_ID, domainCode, domainName, "enumeration", "string", "string", "航空本体知识库值域", "active", CREATED_BY]
      );
      domainId = Number(result.insertId);
    }
    domains.set(domainCode, domainId);
    for (const [index, value] of values.filter(Boolean).entries()) {
      const exists = await findOne(db, "SELECT id FROM std_value_domain_items WHERE project_id = ? AND domain_id = ? AND item_code = ? LIMIT 1", [PROJECT_ID, domainId, String(value)]);
      if (!exists) {
        await db.query(
          `INSERT INTO std_value_domain_items (project_id,domain_id,item_code,item_label,item_value,item_meaning,sort_order,status)
           VALUES (?,?,?,?,?,?,?,?)`,
          [PROJECT_ID, domainId, String(value), String(value), String(value), domainName, index + 1, "active"]
        );
      }
    }
  }
  const specs = buildAviationStandardSpecs();
  const elementIds = new Map();
  for (const spec of specs) {
    const catalogId = catalogIds.get(spec.objectClass) || root;
    const valueDomainId = spec.propertyName === "flight_status" ? domains.get("AVIATION.FLIGHT.STATUS")
      : spec.propertyName === "record_source" ? domains.get("AVIATION.FLIGHT.SOURCE")
        : spec.propertyName === "flight_category" ? domains.get("AVIATION.WEATHER.CATEGORY")
          : spec.propertyName.startsWith("delay_") ? domains.get("AVIATION.DELAY.CODA") : null;
    const current = await findOne(db, "SELECT id FROM std_data_elements WHERE project_id = ? AND element_identifier = ? LIMIT 1", [PROJECT_ID, spec.elementIdentifier]);
    let elementId = current ? Number(current.id) : null;
    const values = [PROJECT_ID, spec.elementIdentifier, spec.elementCode, spec.elementNameCn, spec.elementNameEn, catalogId, spec.objectClass, spec.propertyName, spec.representationTerm, json([]), spec.definition, spec.dataType, valueDomainId || null, referenceId, "HB_AVIATION_2026", json([spec.elementNameEn]), json(["航空", "本体", spec.keyRole]), "航空数据治理组", "航空运行控制中心", "published", 1, "active", CREATED_BY];
    if (!elementId) {
      const [result] = await db.query(
        `INSERT INTO std_data_elements
          (project_id,element_identifier,element_code,element_name_cn,element_name_en,catalog_id,object_class,property_name,representation_term,qualifiers_json,definition,data_type,value_domain_id,reference_standard_id,reference_clause,aliases_json,tags_json,owner_name,steward_name,lifecycle_status,current_version_no,status,created_by,published_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
        values
      );
      elementId = Number(result.insertId);
    }
    elementIds.set(spec.elementIdentifier, elementId);
    const version = await findOne(db, "SELECT id FROM std_data_element_versions WHERE project_id = ? AND element_id = ? AND version_no = 1 LIMIT 1", [PROJECT_ID, elementId]);
    if (!version) {
      await db.query(
        `INSERT INTO std_data_element_versions (project_id,element_id,version_no,version_status,snapshot_json,change_summary,created_by,published_at)
         VALUES (?,?,?,?,?,?,?,NOW())`,
        [PROJECT_ID, elementId, 1, "published", json({ ...spec, catalogId, valueDomainId, referenceStandardId: referenceId }), "航空本体标准基线", CREATED_BY]
      );
    }
  }
  return { elementIds, count: specs.length };
}

async function createSourceMetadataClient() {
  const password = String(process.env.AVIATION_PG_PASSWORD || "");
  if (!password) return null;
  const { Client } = require("pg");
  const client = new Client({
    host: process.env.AVIATION_PG_HOST || "127.0.0.1",
    port: Number(process.env.AVIATION_PG_PORT || 44124),
    database: process.env.AVIATION_PG_DATABASE || "ods",
    user: process.env.AVIATION_PG_USER || "postgres",
    password,
  });
  await client.connect();
  return client;
}

async function loadPhysicalMetadata() {
  const tableNames = unique([
    ...Object.values(CONCEPT_TABLES).map((item) => item.table),
    ...FIELD_LINEAGE.fieldMappings.map((item) => item.source?.table),
    "meta_resource_registry", "ods_china_airport_current_weather", "stg_aviationweather_current_metar", "ods_action_log", "ods_pax_connection", "ods_runway_slot", "ods_dict_mobile_code", "dim_delay_code_coda",
  ].filter(Boolean));
  const client = await createSourceMetadataClient();
  if (!client) return [];
  try {
    const result = await client.query(`
      SELECT c.table_name, c.column_name, c.ordinal_position, c.data_type, c.udt_name,
             c.is_nullable, c.column_default,
             obj_description((quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass, 'pg_class') AS table_comment,
             col_description((quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass::oid, c.ordinal_position) AS column_comment
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = ANY($1)
      ORDER BY c.table_name, c.ordinal_position`, [tableNames]);
    const tables = new Map();
    for (const row of result.rows) {
      if (!tables.has(row.table_name)) tables.set(row.table_name, { tableName: row.table_name, tableComment: row.table_comment || `航空本体物理表 ${row.table_name}`, fields: [] });
      tables.get(row.table_name).fields.push({
        columnName: row.column_name,
        ordinalPosition: Number(row.ordinal_position),
        dataType: row.data_type,
        columnType: row.udt_name || row.data_type,
        isNullable: row.is_nullable === "YES",
        columnDefault: row.column_default,
        columnComment: row.column_comment || FIELD_LABELS[row.column_name] || row.column_name,
        isPrimaryKey: false,
      });
    }
    const pkResult = await client.query(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema, table_name)
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = ANY($1)`, [tableNames]);
    for (const row of pkResult.rows) {
      const table = tables.get(row.table_name);
      const field = table?.fields.find((item) => item.columnName === row.column_name);
      if (field) field.isPrimaryKey = true;
    }
    for (const table of tables.values()) {
      const countResult = await client.query(`SELECT COUNT(*)::bigint AS count FROM public."${table.tableName.replace(/"/g, '""')}"`);
      table.rowCount = Number(countResult.rows[0]?.count || 0);
    }
    return [...tables.values()];
  } finally {
    await client.end();
  }
}

async function ensureDataMapResource(db, meta, ids, index) {
  const existing = await findOne(db, "SELECT id FROM dm_resources WHERE project_id = ? AND table_name = ? LIMIT 1", [PROJECT_ID, meta.tableName]);
  const resourceCode = existing ? null : `R_AV_${String(index + 1).padStart(3, "0")}`;
  if (existing) {
    await db.query(
      `UPDATE dm_resources SET catalog_id=?,department_id=?,business_system_id=?,data_source_id=?,table_comment=?,row_count=?,row_count_mode='exact',column_count=?,resource_category=?,business_tags_json=?,last_synced_at=NOW(),status='active' WHERE id=? AND project_id=?`,
      [ids.catalogId, ids.departmentId, ids.systemId, ids.dataSourceId, meta.tableComment, meta.rowCount ?? null, meta.fields.length, meta.tableName.startsWith("dim_") || meta.tableName.startsWith("ods_dict_") ? "dictionary" : "business", json(["航空", "本体Demo", meta.tableName]), existing.id, PROJECT_ID]
    );
    return Number(existing.id);
  }
  const [result] = await db.query(
    `INSERT INTO dm_resources
      (project_id,resource_code,catalog_id,department_id,business_system_id,data_source_id,table_name,table_comment,row_count,row_count_mode,column_count,resource_category,business_tags_json,source_snapshot_json,status,last_synced_at,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),?)`,
    [PROJECT_ID, resourceCode, ids.catalogId, ids.departmentId, ids.systemId, ids.dataSourceId, meta.tableName, meta.tableComment, meta.rowCount ?? null, "exact", meta.fields.length, meta.tableName.startsWith("dim_") || meta.tableName.startsWith("ods_dict_") ? "dictionary" : "business", json(["航空", "本体Demo", meta.tableName]), json({ tableName: meta.tableName, source: "aviation_ontology_knowledge_base.json" }), "active", CREATED_BY]
  );
  return Number(result.insertId);
}

async function seedDataMap(db, standardState, metadata) {
  const catalog = await findOne(db, "SELECT id FROM dm_catalogs WHERE project_id=? AND catalog_short_code='ODS' LIMIT 1", [PROJECT_ID]);
  const department = await findOne(db, "SELECT id FROM dm_departments WHERE project_id=? AND department_code='AOCC' LIMIT 1", [PROJECT_ID]);
  const system = await findOne(db, "SELECT id FROM dm_business_systems WHERE project_id=? AND system_code='AVIATION_FDE' LIMIT 1", [PROJECT_ID]);
  const source = await findOne(db, "SELECT id FROM dm_data_sources WHERE project_id=? AND source_code='dm_demo_ods' LIMIT 1", [PROJECT_ID]);
  if (!catalog || !department || !system || !source) throw new Error("航空数据地图基础目录不完整，无法生成资源");
  const resourceIds = new Map();
  for (const [index, meta] of metadata.entries()) {
    const resourceId = await ensureDataMapResource(db, meta, { catalogId: catalog.id, departmentId: department.id, systemId: system.id, dataSourceId: source.id }, index);
    resourceIds.set(meta.tableName, resourceId);
    for (const field of meta.fields) {
      const existing = await findOne(db, "SELECT id FROM dm_resource_fields WHERE resource_id=? AND column_name=? LIMIT 1", [resourceId, field.columnName]);
      const values = [field.ordinalPosition, field.dataType, field.columnType, field.isNullable ? 1 : 0, field.isPrimaryKey ? 1 : 0, field.columnDefault || null, field.columnComment || FIELD_LABELS[field.columnName] || field.columnName, FIELD_LABELS[field.columnName] || field.columnName, json(["航空", field.columnName])];
      if (existing) {
        await db.query("UPDATE dm_resource_fields SET ordinal_position=?,data_type=?,column_type=?,is_nullable=?,is_primary_key=?,column_default=?,column_comment=?,business_name=?,semantic_tags_json=?,status='active' WHERE id=?", [...values, existing.id]);
      } else {
        await db.query("INSERT INTO dm_resource_fields (resource_id,column_name,ordinal_position,data_type,column_type,is_nullable,is_primary_key,column_default,column_comment,business_name,semantic_tags_json,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", [resourceId, field.columnName, ...values]);
      }
    }
  }
  for (const relation of KNOWLEDGE_BASE.relations) {
    const sourceTable = CONCEPT_TABLES[relation.source]?.table;
    const targetTable = CONCEPT_TABLES[relation.target]?.table;
    const sourceResourceId = resourceIds.get(sourceTable);
    const targetResourceId = resourceIds.get(targetTable);
    if (!sourceResourceId || !targetResourceId) continue;
    const exists = await findOne(db, "SELECT id FROM dm_resource_lineage_edges WHERE project_id=? AND source_resource_id=? AND target_resource_id=? AND source_table_name=? AND target_table_name=? LIMIT 1", [PROJECT_ID, sourceResourceId, targetResourceId, sourceTable, targetTable]);
    if (!exists) {
      await db.query(
        `INSERT INTO dm_resource_lineage_edges (project_id,source_resource_id,target_resource_id,source_data_source_id,target_data_source_id,source_table_name,target_table_name,lineage_type,relation_level,relation_source,confidence)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [PROJECT_ID, sourceResourceId, targetResourceId, source.id, source.id, sourceTable, targetTable, "semantic", "field", "aviation_ontology_field_lineage.json", "high"]
      );
    }
  }
  const mappingSpecs = buildAviationStandardSpecs().map((spec) => ({
    concept: spec.objectClass,
    conceptField: spec.propertyName,
    source: { table: spec.sourceTable, field: spec.sourceField },
    transform: spec.transform,
    keyRole: spec.keyRole,
  }));
  for (const spec of mappingSpecs) {
    const resourceId = resourceIds.get(spec.source?.table);
    const elementId = standardState.elementIds.get(`AVIATION.${CONCEPT_CODES[spec.concept] || String(spec.concept).toUpperCase()}.${String(spec.conceptField).toUpperCase()}`);
    if (!resourceId || !elementId) continue;
    const field = await findOne(db, "SELECT * FROM dm_resource_fields WHERE resource_id=? AND column_name=? LIMIT 1", [resourceId, spec.source?.field]);
    if (!field) continue;
    const existing = await findOne(db, "SELECT id FROM std_field_mappings WHERE project_id=? AND element_id=? AND table_name=? AND column_name=? LIMIT 1", [PROJECT_ID, elementId, spec.source.table, spec.source.field]);
    const resource = await findOne(db, "SELECT resource_code AS resourceCode FROM dm_resources WHERE id=? AND project_id=? LIMIT 1", [resourceId, PROJECT_ID]);
    const mappingValues = [resourceId, resource?.resourceCode || null, json(field), "approved", 0.92, json([spec.transform, spec.keyRole, "航空本体字段级血缘"]), CREATED_BY, CREATED_BY];
    if (existing) {
      await db.query("UPDATE std_field_mappings SET resource_id=?,resource_code=?,field_snapshot_json=?,mapping_status=?,confidence=?,evidence_json=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?", [...mappingValues.slice(0, 6), mappingValues[7], existing.id]);
    } else {
      await db.query(
        "INSERT INTO std_field_mappings (project_id,element_id,source_module,resource_id,resource_code,table_name,column_name,field_snapshot_json,mapping_status,confidence,evidence_json,created_by,reviewed_by,reviewed_at) VALUES (?,?, 'data_map', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
        [PROJECT_ID, elementId, resourceId, mappingValues[1], spec.source.table, spec.source.field, ...mappingValues.slice(2)]
      );
    }
  }
  return { resourceIds };
}

function buildPhysicalModel(logicalModel) {
  const tableMap = new Map(Object.values(CONCEPT_TABLES).map((item) => [item.label, item.table]));
  const tables = logicalModel.tables.map((table) => ({
    logicalTableName: table.tableName,
    physicalTableName: CONCEPT_TABLES[table.tableName]?.table || table.tableName.toLowerCase(),
    tableKind: "business",
    tableComment: table.tableComment,
    columns: table.fields.map((field) => ({
      columnName: field.fieldName,
      columnType: field.fieldType,
      nullable: !field.required,
      primaryKey: table.keyInfoItems.some((item) => item.fields.includes(field.fieldName)),
      uniqueKey: field.fieldName === "business_key",
      foreignKey: ["tail_no", "assigned_flight_no", "dep_airport", "arr_airport"].includes(field.fieldName),
      foreignRefTable: field.fieldName === "tail_no" ? "ods_aircraft_tail" : field.fieldName.includes("airport") ? "ods_china_airport_current_weather" : null,
      foreignRefField: field.fieldName === "tail_no" || field.fieldName.includes("airport") ? (field.fieldName.includes("airport") ? "airport_icao" : field.fieldName) : null,
      fieldComment: field.fieldComment,
    })),
  }));
  const relations = logicalModel.relations.map((relation) => ({
    ...relation,
    fromPhysicalTableName: tableMap.get(relation.fromTable) || CONCEPT_TABLES[relation.fromTable]?.table,
    toPhysicalTableName: tableMap.get(relation.toTable) || CONCEPT_TABLES[relation.toTable]?.table,
  }));
  return { meta: { domain: "aviation_ontology_demo", generatedBy: CREATED_BY }, tables, relations, summary: { tableCount: tables.length, relationCount: relations.length, primaryKeyPolicy: "主键 + 业务唯一键 + 字段级外键" } };
}

async function seedModels(db) {
  const logicalModel = buildAviationLogicalModel();
  const physicalModel = buildPhysicalModel(logicalModel);
  let template = await findOne(db, "SELECT id FROM lab_business_system_template WHERE project_id=? AND template_code=? LIMIT 1", [PROJECT_ID, "AVIATION_ONTOLOGY_TEMPLATE"]);
  if (!template) {
    const [result] = await db.query("INSERT INTO lab_business_system_template (project_id,template_code,template_name,industry_code,template_desc,template_status,current_logical_version,created_by) VALUES (?,?,?,?,?,?,?,?)", [PROJECT_ID, "AVIATION_ONTOLOGY_TEMPLATE", "航空本体逻辑模型", "aviation", "依据字段级数据血缘与物理表 ER 关系构建的航空业逻辑模型。", "active", 1, CREATED_BY]);
    template = { id: result.insertId };
  }
  const logicalExists = await findOne(db, "SELECT id FROM lab_logical_model_version WHERE template_id=? AND version_no=1 LIMIT 1", [template.id]);
  if (!logicalExists) {
    await db.query("INSERT INTO lab_logical_model_version (template_id,version_no,version_status,source_asset_snapshot_json,logical_model_json,adjustment_history_json,model_summary,published_at) VALUES (?,?,?,?,?,?,?,NOW())", [template.id, 1, "published", json({ source: "aviation_ontology_field_lineage.json" }), json(logicalModel), json([]), "5 个航空本体实体、3 条字段级关系、2 条规则"]);
  } else {
    await db.query("UPDATE lab_logical_model_version SET logical_model_json=?,model_summary=?,version_status='published',published_at=COALESCE(published_at,NOW()) WHERE id=?", [json(logicalModel), "5 个航空本体实体、3 条字段级关系、2 条规则", logicalExists.id]);
  }
  let instance = await findOne(db, "SELECT id FROM lab_business_system_instance WHERE project_id=? AND instance_code=? LIMIT 1", [PROJECT_ID, "AVIATION_ONTOLOGY_PHYSICAL"]);
  if (!instance) {
    const [result] = await db.query("INSERT INTO lab_business_system_instance (project_id,instance_code,instance_name,template_id,db_type,instance_status,current_logical_version,current_physical_version,created_by) VALUES (?,?,?,?,?,?,?,?,?)", [PROJECT_ID, "AVIATION_ONTOLOGY_PHYSICAL", "航空本体物理模型", template.id, "postgresql", "active", 1, 1, CREATED_BY]);
    instance = { id: result.insertId };
  }
  const physicalExists = await findOne(db, "SELECT id FROM lab_physical_model_version WHERE instance_id=? AND version_no=1 LIMIT 1", [instance.id]);
  if (!physicalExists) {
    await db.query("INSERT INTO lab_physical_model_version (instance_id,version_no,logical_version_no,db_type,version_status,physical_model_json,ddl_bundle_json,model_summary,published_at) VALUES (?,?,?,?,?,?,?,?,NOW())", [instance.id, 1, 1, "postgresql", "published", json(physicalModel), json({ dbType: "postgresql", script: "-- 由航空本体字段级血缘生成；目标表见 physicalModel.tables" }), "航空本体物理表 ER 模型（PostgreSQL）"]);
  }
  return { templateId: Number(template.id), instanceId: Number(instance.id), logicalModel, physicalModel };
}

async function seedReport(db) {
  const source = await findOne(db, "SELECT id FROM report_data_sources WHERE project_id=? AND source_code='demo_ods' LIMIT 1", [PROJECT_ID]);
  if (!source) throw new Error("航空报表数据源不存在");
  await db.query("UPDATE report_data_sources SET connection_config=? WHERE id=? AND project_id=?", [json({ devDatasourceId: 15, schema: "public" }), source.id, PROJECT_ID]);
  const datasetSpecs = [buildAviationReportDataset(), buildAviationWeatherAdjustmentDataset()];
  const datasets = new Map();
  for (const datasetSpec of datasetSpecs) {
    let dataset = await findOne(db, "SELECT id FROM report_datasets WHERE project_id=? AND dataset_code=? LIMIT 1", [PROJECT_ID, datasetSpec.datasetCode]);
    if (!dataset) {
      const [result] = await db.query("INSERT INTO report_datasets (project_id,dataset_name,dataset_code,source_id,dataset_type,source_sql,fields_json,query_config_json,owner_name,status,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)", [PROJECT_ID, datasetSpec.datasetName, datasetSpec.datasetCode, source.id, datasetSpec.datasetType, datasetSpec.sourceSql, json(datasetSpec.fields), json(datasetSpec.queryConfig), "航空运行控制中心", "published", datasetSpec.description]);
      dataset = { id: result.insertId };
    } else {
      await db.query("UPDATE report_datasets SET dataset_name=?,source_id=?,dataset_type=?,source_sql=?,fields_json=?,query_config_json=?,status='published',description=? WHERE id=? AND project_id=?", [datasetSpec.datasetName, source.id, datasetSpec.datasetType, datasetSpec.sourceSql, json(datasetSpec.fields), json(datasetSpec.queryConfig), datasetSpec.description, dataset.id, PROJECT_ID]);
    }
    datasets.set(datasetSpec.datasetCode, Number(dataset.id));
  }
  const chartSpecs = [
    { code: "aviation_delay_category_bar", name: "延误原因分布", type: "bar", x: "delay_category", y: "delayed_flight_count" },
    { code: "aviation_delay_severity_combo", name: "延误处置强度", type: "combo", x: "delay_category", y: "avg_delay_minutes", y2: "severe_delay_count" },
  ];
  const chartIds = [];
  for (const chart of chartSpecs) {
    let asset = await findOne(db, "SELECT id FROM report_chart_assets WHERE project_id=? AND chart_code=? LIMIT 1", [PROJECT_ID, chart.code]);
    if (!asset) {
      const [result] = await db.query("INSERT INTO report_chart_assets (project_id,chart_name,chart_code,chart_type,category,render_mode,description,tags_json,config_json,option_template_json,mapping_schema_json,owner_name,status,is_builtin) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [PROJECT_ID, chart.name, chart.code, "echarts", "aviation_delay", "dataset", "航空延误处置分析图表", json(["航空", "延误", "处置"]), json({ xField: chart.x, yField: chart.y, y2Field: chart.y2 || null }), json({}), json({ xField: chart.x, yField: chart.y, y2Field: chart.y2 || null }), "航空运行控制中心", "active", 0]);
      asset = { id: result.insertId };
    }
    chartIds.push(Number(asset.id));
  }
  let dashboard = await findOne(db, "SELECT id FROM report_dashboards WHERE project_id=? AND dashboard_code='aviation_delay_disposal' LIMIT 1", [PROJECT_ID]);
  if (!dashboard) {
    const [result] = await db.query("INSERT INTO report_dashboards (project_id,dashboard_name,dashboard_code,layout_mode,theme_config_json,filter_config_json,canvas_config_json,owner_name,status,description) VALUES (?,?,?,?,?,?,?,?,?,?)", [PROJECT_ID, "航空延误处置分析报表", "aviation_delay_disposal", "grid", json({ accentColor: "#1668dc", background: "#f5f7fb" }), json({ fields: ["delay_category", "flight_status"] }), json({ width: 1440, height: 900 }), "航空运行控制中心", "published", "按照航空延误决策模拟 HTML 生成的可视化分析报表。"]);
    dashboard = { id: result.insertId };
  }
  const widgets = buildAviationReportWidgetSpecs({
    summaryDatasetId: datasets.get("aviation_delay_disposal_analysis"),
    detailDatasetId: datasets.get("aviation_weather_adjustment_flights"),
    chartIds,
  });
  for (const [key, name, type, chartId, datasetId, position, props] of widgets) {
    const existingWidget = await findOne(db, "SELECT id FROM report_dashboard_widgets WHERE dashboard_id=? AND widget_key=? LIMIT 1", [dashboard.id, key]);
    if (existingWidget) {
      await db.query("UPDATE report_dashboard_widgets SET widget_name=?,widget_type=?,dataset_id=?,chart_asset_id=?,position_json=?,props_json=?,query_params_json=? WHERE id=?", [name, type, datasetId || null, chartId || null, json(position), json(props), json({}), existingWidget.id]);
    } else {
      await db.query("INSERT INTO report_dashboard_widgets (dashboard_id,widget_key,widget_name,widget_type,dataset_id,chart_asset_id,position_json,props_json,query_params_json) VALUES (?,?,?,?,?,?,?,?,?)", [dashboard.id, key, name, type, datasetId || null, chartId || null, json(position), json(props), json({})]);
    }
  }
  return { sourceId: Number(source.id), datasetId: datasets.get("aviation_delay_disposal_analysis"), detailDatasetId: datasets.get("aviation_weather_adjustment_flights"), dashboardId: Number(dashboard.id) };
}

async function bootstrap() {
  const metadata = await loadPhysicalMetadata();
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const standards = await seedStandards(db);
    const map = metadata.length ? await seedDataMap(db, standards, metadata) : { resourceIds: new Map() };
    const models = await seedModels(db);
    const report = await seedReport(db);
    await db.commit();
    return { projectId: PROJECT_ID, standards: { count: standards.count }, dataMap: { resourceCount: map.resourceIds.size }, models: { templateId: models.templateId, instanceId: models.instanceId, relationCount: models.logicalModel.relations.length }, report };
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}

if (require.main === module) {
  bootstrap()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error("[bootstrap-aviation-demo] failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = {
  buildAviationStandardSpecs,
  buildAviationLogicalModel,
  buildAviationReportDataset,
  buildAviationWeatherAdjustmentDataset,
  buildAviationReportWidgetSpecs,
  bootstrap,
};
