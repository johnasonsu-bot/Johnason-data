const crypto = require("crypto");
const XLSX = require("xlsx");
const { pool } = require("../../config/database");
const AppError = require("../../common/errors/app-error");
const { getCurrentProjectId } = require("../../common/utils/project-context");

const TEMPLATE_VERSION = "v1";
const IMPORT_TYPES = new Set(["bundle", "elements", "value-domains"]);
const IMPORT_STRATEGIES = new Set(["append", "update", "merge", "overwrite"]);

const sheetDefinitions = {
  catalogs: {
    name: "标准目录",
    headers: ["目录编码*", "目录名称*", "父级目录编码", "目录类型", "责任人", "描述", "排序号", "状态"],
    sample: ["CUSTOMER", "客户主题", "", "业务主题", "张三", "客户相关标准", "10", "启用"],
  },
  references: {
    name: "引用标准",
    headers: ["标准编码*", "标准名称*", "标准类型", "标准号", "发布方", "生效日期", "标准网址", "描述", "状态"],
    sample: ["GB-T-DEMO", "示例引用标准", "国家标准", "GB/T 00000", "示例机构", "2026-01-01", "", "示例数据", "启用"],
  },
  domains: {
    name: "值域",
    headers: ["值域编码*", "值域名称*", "值域类型", "值类型", "数据类型", "最小值", "最大值", "正则表达式", "格式表达式", "单位", "引用标准编码", "引用条款", "描述", "状态"],
    sample: ["CUSTOMER_STATUS", "客户状态", "枚举", "字符串", "string", "", "", "", "", "", "GB-T-DEMO", "", "客户状态代码集", "启用"],
  },
  items: {
    name: "值域代码项",
    headers: ["值域编码*", "代码*", "代码名称*", "代码值", "代码含义", "排序号", "状态"],
    sample: ["CUSTOMER_STATUS", "ACTIVE", "正常", "1", "正常客户", "1", "启用"],
  },
  elements: {
    name: "数据元",
    headers: [
      "标准编码*", "数据元标识符*", "中文名称*", "英文名称", "标准类型", "目录编码", "对象类", "属性", "表示词",
      "业务定义", "数据类型*", "最大长度", "数值精度", "小数位", "日期时间精度", "格式", "单位", "值域编码",
      "引用标准编码", "引用条款", "别名", "标签", "责任人", "数据管家", "生命周期状态", "状态",
    ],
    sample: ["QB00001", "customer_status", "客户状态", "Customer Status", "企业标准", "CUSTOMER", "客户", "状态", "代码", "客户当前状态", "string", "32", "", "", "", "", "", "CUSTOMER_STATUS", "GB-T-DEMO", "", "客户状态", "客户,状态", "张三", "李四", "草稿", "启用"],
  },
};

const labelMaps = {
  status: { "启用": "active", "停用": "inactive", active: "active", inactive: "inactive" },
  standardType: { "国家标准": "national", "行业标准": "industry", "企业标准": "enterprise", national: "national", industry: "industry", enterprise: "enterprise" },
  catalogType: { "根目录": "root", "业务主题": "business_domain", "技术主题": "technical", root: "root", business_domain: "business_domain", technical: "technical" },
  domainType: { "枚举": "enumeration", "范围": "range", "正则": "regex", "引用表": "reference", "自由文本": "free_text", enumeration: "enumeration", range: "range", regex: "regex", reference: "reference", free_text: "free_text" },
  valueType: { "字符串": "string", "数字": "number", "日期": "date", "日期时间": "datetime", "布尔": "boolean", string: "string", number: "number", date: "date", datetime: "datetime", boolean: "boolean" },
  lifecycle: { "草稿": "draft", "待审核": "review", "已发布": "published", "已废弃": "deprecated", draft: "draft", review: "review", published: "published", deprecated: "deprecated" },
};

function requireProjectId() {
  const projectId = getCurrentProjectId();
  if (!projectId) throw new AppError("当前请求未选择项目空间", 400);
  return projectId;
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function nullable(value) {
  const text = clean(value);
  return text || null;
}

function numberOrNull(value) {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return Number.isInteger(number) ? number : null;
}

function splitList(value) {
  return clean(value).split(/[,，;；]/).map((item) => item.trim()).filter(Boolean);
}

function mapped(group, value, fallback) {
  const text = clean(value);
  return labelMaps[group][text] || fallback;
}

function rowValue(row, header) {
  return row[header] ?? row[`${header}*`] ?? "";
}

function workbookRows(workbook, definition) {
  const sheet = workbook.Sheets[definition.name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }).map((row, index) => ({
    rowNumber: index + 2,
    row,
  })).filter(({ row }) => Object.values(row).some((value) => clean(value)));
}

function parseWorkbook(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    return {
      catalogs: workbookRows(workbook, sheetDefinitions.catalogs),
      references: workbookRows(workbook, sheetDefinitions.references),
      domains: workbookRows(workbook, sheetDefinitions.domains),
      items: workbookRows(workbook, sheetDefinitions.items),
      elements: workbookRows(workbook, sheetDefinitions.elements),
    };
  } catch {
    throw new AppError("Excel 文件无法解析，请使用系统下载的模板", 400);
  }
}

function mapCatalog(entry) {
  const row = entry.row;
  return { ...entry, code: clean(rowValue(row, "目录编码")), payload: {
    catalogCode: clean(rowValue(row, "目录编码")), catalogName: clean(rowValue(row, "目录名称")), parentCode: clean(rowValue(row, "父级目录编码")),
    catalogType: mapped("catalogType", rowValue(row, "目录类型"), "business_domain"), ownerName: nullable(rowValue(row, "责任人")),
    description: nullable(rowValue(row, "描述")), sortOrder: integerOrNull(rowValue(row, "排序号")) ?? 0, status: mapped("status", rowValue(row, "状态"), "active"),
  } };
}

function mapReference(entry) {
  const row = entry.row;
  return { ...entry, code: clean(rowValue(row, "标准编码")), payload: {
    standardCode: clean(rowValue(row, "标准编码")), standardName: clean(rowValue(row, "标准名称")),
    standardType: mapped("standardType", rowValue(row, "标准类型"), "enterprise"), standardNo: nullable(rowValue(row, "标准号")),
    publisher: nullable(rowValue(row, "发布方")), effectiveDate: nullable(rowValue(row, "生效日期")), standardUrl: nullable(rowValue(row, "标准网址")),
    description: nullable(rowValue(row, "描述")), status: mapped("status", rowValue(row, "状态"), "active"),
  } };
}

function mapDomain(entry) {
  const row = entry.row;
  return { ...entry, code: clean(rowValue(row, "值域编码")), payload: {
    domainCode: clean(rowValue(row, "值域编码")), domainName: clean(rowValue(row, "值域名称")), domainType: mapped("domainType", rowValue(row, "值域类型"), "enumeration"),
    valueType: mapped("valueType", rowValue(row, "值类型"), "string"), dataType: nullable(rowValue(row, "数据类型")), minValue: numberOrNull(rowValue(row, "最小值")),
    maxValue: numberOrNull(rowValue(row, "最大值")), regexPattern: nullable(rowValue(row, "正则表达式")), formatPattern: nullable(rowValue(row, "格式表达式")),
    unit: nullable(rowValue(row, "单位")), referenceCode: clean(rowValue(row, "引用标准编码")), referenceClause: nullable(rowValue(row, "引用条款")),
    description: nullable(rowValue(row, "描述")), status: mapped("status", rowValue(row, "状态"), "active"),
  } };
}

function mapItem(entry) {
  const row = entry.row;
  const domainCode = clean(rowValue(row, "值域编码"));
  const itemCode = clean(rowValue(row, "代码"));
  return { ...entry, code: `${domainCode}:${itemCode}`, payload: {
    domainCode, itemCode, itemLabel: clean(rowValue(row, "代码名称")), itemValue: nullable(rowValue(row, "代码值")),
    itemMeaning: nullable(rowValue(row, "代码含义")), sortOrder: integerOrNull(rowValue(row, "排序号")) ?? 0,
    status: mapped("status", rowValue(row, "状态"), "active"),
  } };
}

function mapElement(entry) {
  const row = entry.row;
  return { ...entry, code: clean(rowValue(row, "标准编码")), payload: {
    elementCode: clean(rowValue(row, "标准编码")), elementIdentifier: clean(rowValue(row, "数据元标识符")), elementNameCn: clean(rowValue(row, "中文名称")),
    elementNameEn: nullable(rowValue(row, "英文名称")), standardType: mapped("standardType", rowValue(row, "标准类型"), "enterprise"), catalogCode: clean(rowValue(row, "目录编码")),
    objectClass: nullable(rowValue(row, "对象类")), propertyName: nullable(rowValue(row, "属性")), representationTerm: nullable(rowValue(row, "表示词")), definition: nullable(rowValue(row, "业务定义")),
    dataType: clean(rowValue(row, "数据类型")) || "string", maxLength: integerOrNull(rowValue(row, "最大长度")), numericPrecision: integerOrNull(rowValue(row, "数值精度")),
    numericScale: integerOrNull(rowValue(row, "小数位")), datetimePrecision: nullable(rowValue(row, "日期时间精度")), formatPattern: nullable(rowValue(row, "格式")), unit: nullable(rowValue(row, "单位")),
    valueDomainCode: clean(rowValue(row, "值域编码")), referenceCode: clean(rowValue(row, "引用标准编码")), referenceClause: nullable(rowValue(row, "引用条款")),
    aliases: splitList(rowValue(row, "别名")), tags: splitList(rowValue(row, "标签")), ownerName: nullable(rowValue(row, "责任人")), stewardName: nullable(rowValue(row, "数据管家")),
    lifecycleStatus: mapped("lifecycle", rowValue(row, "生命周期状态"), "draft"), status: mapped("status", rowValue(row, "状态"), "active"),
  } };
}

function error(sheetName, entry, fieldName, message, rawValue = "") {
  return { sheetName, rowNumber: entry.rowNumber, businessCode: entry.code || null, fieldName, rawValue: clean(rawValue), errorType: "validation", errorMessage: message };
}

async function loadExisting(projectId) {
  const tables = [
    ["catalogs", `SELECT c.id, c.catalog_code AS code, p.catalog_code AS parentCode
      FROM std_catalogs c
      LEFT JOIN std_catalogs p ON p.id = c.parent_id AND p.project_id = c.project_id
      WHERE c.project_id = ? AND c.status <> 'deleted'`],
    ["references", "SELECT id, standard_code AS code FROM std_reference_standards WHERE project_id = ? AND status <> 'deleted'"],
    ["domains", "SELECT id, domain_code AS code FROM std_value_domains WHERE project_id = ? AND status <> 'deleted'"],
    ["elements", "SELECT id, element_code AS code, element_identifier AS identifier, lifecycle_status AS lifecycleStatus, current_version_no AS currentVersionNo FROM std_data_elements WHERE project_id = ? AND status <> 'deleted'"],
    ["items", `SELECT i.id, CONCAT(d.domain_code, ':', i.item_code) AS code FROM std_value_domain_items i JOIN std_value_domains d ON d.id = i.domain_id WHERE i.project_id = ? AND d.project_id = ? AND i.status <> 'deleted'`],
  ];
  const result = {};
  for (const [key, sql] of tables) {
    const params = key === "items" ? [projectId, projectId] : [projectId];
    const [rows] = await pool.query(sql, params);
    result[key] = new Map(rows.map((row) => [String(row.code).toUpperCase(), row]));
  }
  result.identifiers = new Map([...result.elements.values()].map((row) => [String(row.identifier).toUpperCase(), row]));
  return result;
}

function decideAction(strategy, existing) {
  if (strategy === "append") return existing ? "error" : "create";
  if (strategy === "update") return existing ? "update" : "error";
  return existing ? "update" : "create";
}

function validateEntries(parsed, existing, strategy) {
  const errors = [];
  const seen = { catalogs: new Set(), references: new Set(), domains: new Set(), items: new Set(), elements: new Set(), identifiers: new Set() };
  const allCodes = {
    catalogs: new Set([...existing.catalogs.keys(), ...parsed.catalogs.map((entry) => entry.code.toUpperCase())]),
    references: new Set([...existing.references.keys(), ...parsed.references.map((entry) => entry.code.toUpperCase())]),
    domains: new Set([...existing.domains.keys(), ...parsed.domains.map((entry) => entry.code.toUpperCase())]),
  };
  const groups = [
    ["catalogs", "标准目录", "目录编码", "目录名称"], ["references", "引用标准", "标准编码", "标准名称"],
    ["domains", "值域", "值域编码", "值域名称"], ["items", "值域代码项", "值域编码和代码", "代码名称"],
    ["elements", "数据元", "标准编码", "中文名称"],
  ];
  for (const [key, sheetName, codeField, nameField] of groups) {
    for (const entry of parsed[key]) {
      const normalized = entry.code.toUpperCase();
      if (!entry.code) errors.push(error(sheetName, entry, codeField, `${codeField}不能为空`));
      if (seen[key].has(normalized)) errors.push(error(sheetName, entry, codeField, `文件内${codeField}重复`));
      seen[key].add(normalized);
      const nameValue = key === "items" ? entry.payload.itemLabel : key === "elements" ? entry.payload.elementNameCn : key === "catalogs" ? entry.payload.catalogName : key === "references" ? entry.payload.standardName : entry.payload.domainName;
      if (!nameValue) errors.push(error(sheetName, entry, nameField, `${nameField}不能为空`));
      const action = decideAction(strategy, existing[key].get(normalized));
      if (action === "error") errors.push(error(sheetName, entry, codeField, strategy === "append" ? "当前项目中已存在，追加模式不允许修改" : "当前项目中不存在，更新模式不允许新增"));
      entry.action = action;
    }
  }

  for (const entry of parsed.catalogs) {
    if (entry.payload.parentCode && !allCodes.catalogs.has(entry.payload.parentCode.toUpperCase())) errors.push(error("标准目录", entry, "父级目录编码", "父级目录不存在"));
    if (entry.payload.parentCode && entry.payload.parentCode.toUpperCase() === entry.code.toUpperCase()) errors.push(error("标准目录", entry, "父级目录编码", "父级目录不能是自身"));
  }
  const catalogParents = new Map([...existing.catalogs.entries()].map(([code, row]) => [code, clean(row.parentCode).toUpperCase() || null]));
  for (const entry of parsed.catalogs) catalogParents.set(entry.code.toUpperCase(), entry.payload.parentCode?.toUpperCase() || null);
  for (const entry of parsed.catalogs) {
    const origin = entry.code.toUpperCase();
    const visited = new Set([origin]);
    let current = catalogParents.get(origin);
    while (current) {
      if (visited.has(current)) {
        errors.push(error("标准目录", entry, "父级目录编码", "目录层级存在循环引用"));
        break;
      }
      visited.add(current);
      current = catalogParents.get(current);
    }
  }
  for (const entry of parsed.domains) {
    if (entry.payload.referenceCode && !allCodes.references.has(entry.payload.referenceCode.toUpperCase())) errors.push(error("值域", entry, "引用标准编码", "引用标准不存在"));
    if (entry.payload.domainType === "range" && entry.payload.minValue !== null && entry.payload.maxValue !== null && entry.payload.minValue > entry.payload.maxValue) errors.push(error("值域", entry, "最小值", "最小值不能大于最大值"));
  }
  for (const entry of parsed.items) {
    if (!entry.payload.domainCode || !allCodes.domains.has(entry.payload.domainCode.toUpperCase())) errors.push(error("值域代码项", entry, "值域编码", "值域不存在"));
    if (!entry.payload.itemCode) errors.push(error("值域代码项", entry, "代码", "代码不能为空"));
  }
  for (const entry of parsed.elements) {
    const payload = entry.payload;
    if (!/^(GB|HB|QB)\d{5}$/i.test(payload.elementCode)) errors.push(error("数据元", entry, "标准编码", "标准编码必须采用 GB/HB/QB 加五位流水号"));
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(payload.elementIdentifier)) errors.push(error("数据元", entry, "数据元标识符", "标识符仅支持以字母开头的字母、数字和下划线"));
    const identifierKey = payload.elementIdentifier.toUpperCase();
    if (seen.identifiers.has(identifierKey)) errors.push(error("数据元", entry, "数据元标识符", "文件内数据元标识符重复"));
    seen.identifiers.add(identifierKey);
    const identifierOwner = existing.identifiers.get(identifierKey);
    const codeOwner = existing.elements.get(entry.code.toUpperCase());
    if (identifierOwner && Number(identifierOwner.id) !== Number(codeOwner?.id || 0)) errors.push(error("数据元", entry, "数据元标识符", "标识符已被其他数据元使用"));
    if (!payload.dataType) errors.push(error("数据元", entry, "数据类型", "数据类型不能为空"));
    if (payload.catalogCode && !allCodes.catalogs.has(payload.catalogCode.toUpperCase())) errors.push(error("数据元", entry, "目录编码", "标准目录不存在"));
    if (payload.valueDomainCode && !allCodes.domains.has(payload.valueDomainCode.toUpperCase())) errors.push(error("数据元", entry, "值域编码", "值域不存在"));
    if (payload.referenceCode && !allCodes.references.has(payload.referenceCode.toUpperCase())) errors.push(error("数据元", entry, "引用标准编码", "引用标准不存在"));
  }
  return errors;
}

function normalizeParsed(rows) {
  return {
    catalogs: rows.catalogs.map(mapCatalog), references: rows.references.map(mapReference), domains: rows.domains.map(mapDomain),
    items: rows.items.map(mapItem), elements: rows.elements.map(mapElement),
  };
}

function summarize(parsed, errors) {
  const entries = Object.values(parsed).flat();
  return {
    totalRows: entries.length,
    createRows: entries.filter((entry) => entry.action === "create").length,
    updateRows: entries.filter((entry) => entry.action === "update").length,
    errorRows: new Set(errors.map((item) => `${item.sheetName}:${item.rowNumber}`)).size,
    sheetCounts: Object.fromEntries(Object.entries(parsed).map(([key, rows]) => [key, rows.length])),
  };
}

async function previewImport(file, options = {}) {
  if (!file?.buffer) throw new AppError("请选择 Excel 文件", 400);
  const importType = IMPORT_TYPES.has(options.importType) ? options.importType : "bundle";
  const strategy = IMPORT_STRATEGIES.has(options.strategy) ? options.strategy : "merge";
  const projectId = requireProjectId();
  const parsed = normalizeParsed(parseWorkbook(file.buffer));
  if (importType === "elements") parsed.catalogs = parsed.references = parsed.domains = parsed.items = [];
  if (importType === "value-domains") parsed.catalogs = parsed.references = parsed.elements = [];
  if (Object.values(parsed).every((rows) => rows.length === 0)) throw new AppError("Excel 中未识别到当前导入范围的数据，请使用系统模板并保留表头", 400);
  const existing = await loadExisting(projectId);
  const errors = validateEntries(parsed, existing, strategy);
  return { importType, strategy, templateVersion: TEMPLATE_VERSION, summary: summarize(parsed, errors), errors: errors.slice(0, 500) };
}

async function createBatch(projectId, file, options, userName) {
  const [result] = await pool.query(
    `INSERT INTO std_import_batches
      (project_id, import_type, import_strategy, template_version, source_file_name, source_file_size, source_file_hash, status, created_by, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, NOW())`,
    [projectId, options.importType, options.strategy, TEMPLATE_VERSION, file.originalname || "data-standards.xlsx", file.size || file.buffer.length, crypto.createHash("sha256").update(file.buffer).digest("hex"), userName],
  );
  return Number(result.insertId);
}

async function saveErrors(batchId, projectId, errors, db = pool) {
  for (const item of errors) {
    await db.query(
      `INSERT INTO std_import_errors
        (project_id, batch_id, sheet_name, excel_row_number, business_code, field_name, raw_value, error_type, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, batchId, item.sheetName, item.rowNumber, item.businessCode, item.fieldName, item.rawValue, item.errorType, item.errorMessage],
    );
  }
}

async function getCodeMaps(db, projectId) {
  const result = {};
  for (const [key, table, column] of [["catalogs", "std_catalogs", "catalog_code"], ["references", "std_reference_standards", "standard_code"], ["domains", "std_value_domains", "domain_code"]]) {
    const [rows] = await db.query(`SELECT id, ${column} AS code FROM ${table} WHERE project_id = ? AND status <> 'deleted'`, [projectId]);
    result[key] = new Map(rows.map((row) => [String(row.code).toUpperCase(), Number(row.id)]));
  }
  return result;
}

async function upsertSimpleAssets(db, projectId, parsed, userName) {
  for (const entry of parsed.catalogs) {
    const p = entry.payload;
    await db.query(
      `INSERT INTO std_catalogs (project_id, parent_id, catalog_name, catalog_code, catalog_type, owner_name, description, sort_order, status, created_by)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE catalog_name=VALUES(catalog_name), catalog_type=VALUES(catalog_type), owner_name=VALUES(owner_name), description=VALUES(description), sort_order=VALUES(sort_order), status=VALUES(status)`,
      [projectId, p.catalogName, p.catalogCode, p.catalogType, p.ownerName, p.description, p.sortOrder, p.status, userName],
    );
  }
  for (const entry of parsed.references) {
    const p = entry.payload;
    await db.query(
      `INSERT INTO std_reference_standards (project_id, standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE standard_name=VALUES(standard_name), standard_type=VALUES(standard_type), standard_no=VALUES(standard_no), publisher=VALUES(publisher), effective_date=VALUES(effective_date), standard_url=VALUES(standard_url), description=VALUES(description), status=VALUES(status)`,
      [projectId, p.standardCode, p.standardName, p.standardType, p.standardNo, p.publisher, p.effectiveDate, p.standardUrl, p.description, p.status, userName],
    );
  }
}

async function executeImport(db, projectId, parsed, strategy, userName) {
  await upsertSimpleAssets(db, projectId, parsed, userName);
  let maps = await getCodeMaps(db, projectId);
  for (const entry of parsed.catalogs) {
    const parentId = entry.payload.parentCode ? maps.catalogs.get(entry.payload.parentCode.toUpperCase()) : null;
    await db.query("UPDATE std_catalogs SET parent_id = ? WHERE project_id = ? AND catalog_code = ?", [parentId || null, projectId, entry.payload.catalogCode]);
  }
  for (const entry of parsed.domains) {
    const p = entry.payload;
    await db.query(
      `INSERT INTO std_value_domains (project_id, domain_code, domain_name, domain_type, value_type, data_type, min_value, max_value, regex_pattern, format_pattern, unit, reference_standard_id, reference_clause, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE domain_name=VALUES(domain_name), domain_type=VALUES(domain_type), value_type=VALUES(value_type), data_type=VALUES(data_type), min_value=VALUES(min_value), max_value=VALUES(max_value), regex_pattern=VALUES(regex_pattern), format_pattern=VALUES(format_pattern), unit=VALUES(unit), reference_standard_id=VALUES(reference_standard_id), reference_clause=VALUES(reference_clause), description=VALUES(description), status=VALUES(status)`,
      [projectId, p.domainCode, p.domainName, p.domainType, p.valueType, p.dataType, p.minValue, p.maxValue, p.regexPattern, p.formatPattern, p.unit, p.referenceCode ? maps.references.get(p.referenceCode.toUpperCase()) : null, p.referenceClause, p.description, p.status, userName],
    );
  }
  maps = await getCodeMaps(db, projectId);
  if (strategy === "overwrite") {
    const domainIds = [...new Set([
      ...parsed.domains.map((entry) => maps.domains.get(entry.code.toUpperCase())),
      ...parsed.items.map((entry) => maps.domains.get(entry.payload.domainCode.toUpperCase())),
    ].filter(Boolean))];
    if (domainIds.length) await db.query(`DELETE FROM std_value_domain_items WHERE project_id = ? AND domain_id IN (${domainIds.map(() => "?").join(",")})`, [projectId, ...domainIds]);
  }
  for (const entry of parsed.items) {
    const p = entry.payload;
    await db.query(
      `INSERT INTO std_value_domain_items (project_id, domain_id, item_code, item_label, item_value, item_meaning, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE item_label=VALUES(item_label), item_value=VALUES(item_value), item_meaning=VALUES(item_meaning), sort_order=VALUES(sort_order), status=VALUES(status)`,
      [projectId, maps.domains.get(p.domainCode.toUpperCase()), p.itemCode, p.itemLabel, p.itemValue, p.itemMeaning, p.sortOrder, p.status],
    );
  }
  for (const entry of parsed.elements) {
    const p = entry.payload;
    const [[existingRow]] = await db.query("SELECT id, lifecycle_status AS lifecycleStatus, current_version_no AS currentVersionNo FROM std_data_elements WHERE project_id = ? AND element_code = ? LIMIT 1", [projectId, p.elementCode]);
    const versionNo = existingRow ? Number(existingRow.currentVersionNo || 1) + (existingRow.lifecycleStatus === "published" ? 1 : 0) : 1;
    const lifecycle = existingRow?.lifecycleStatus === "published" ? "draft" : p.lifecycleStatus;
    const values = [p.elementIdentifier, p.elementNameCn, p.elementNameEn, p.catalogCode ? maps.catalogs.get(p.catalogCode.toUpperCase()) : null, p.objectClass, p.propertyName, p.representationTerm, JSON.stringify([]), p.definition, p.dataType, p.maxLength, p.numericPrecision, p.numericScale, p.datetimePrecision, p.formatPattern, p.unit, p.valueDomainCode ? maps.domains.get(p.valueDomainCode.toUpperCase()) : null, p.referenceCode ? maps.references.get(p.referenceCode.toUpperCase()) : null, p.referenceClause, JSON.stringify(p.aliases), JSON.stringify(p.tags), p.ownerName, p.stewardName, lifecycle, versionNo, p.status];
    let elementId;
    if (existingRow) {
      await db.query(
        `UPDATE std_data_elements SET element_identifier=?, element_name_cn=?, element_name_en=?, catalog_id=?, object_class=?, property_name=?, representation_term=?, qualifiers_json=?, definition=?, data_type=?, max_length=?, numeric_precision_value=?, numeric_scale_value=?, datetime_precision=?, format_pattern=?, unit=?, value_domain_id=?, reference_standard_id=?, reference_clause=?, aliases_json=?, tags_json=?, owner_name=?, steward_name=?, lifecycle_status=?, current_version_no=?, status=? WHERE id=? AND project_id=?`,
        [...values, existingRow.id, projectId],
      );
      elementId = existingRow.id;
    } else {
      const [result] = await db.query(
        `INSERT INTO std_data_elements (project_id, element_code, element_identifier, element_name_cn, element_name_en, catalog_id, object_class, property_name, representation_term, qualifiers_json, definition, data_type, max_length, numeric_precision_value, numeric_scale_value, datetime_precision, format_pattern, unit, value_domain_id, reference_standard_id, reference_clause, aliases_json, tags_json, owner_name, steward_name, lifecycle_status, current_version_no, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId, p.elementCode, ...values, userName],
      );
      elementId = result.insertId;
    }
    const snapshot = { ...p, lifecycleStatus: lifecycle };
    await db.query(
      `INSERT INTO std_data_element_versions (project_id, element_id, version_no, version_status, snapshot_json, change_summary, created_by)
       VALUES (?, ?, ?, 'draft', ?, 'Excel 批量注册', ?)
       ON DUPLICATE KEY UPDATE snapshot_json=VALUES(snapshot_json), change_summary=VALUES(change_summary), created_by=VALUES(created_by)`,
      [projectId, elementId, versionNo, JSON.stringify(snapshot), userName],
    );
  }
}

async function commitImport(file, options = {}, user = {}) {
  const preview = await previewImport(file, options);
  const projectId = requireProjectId();
  const normalizedOptions = { importType: preview.importType, strategy: preview.strategy };
  const userName = user.displayName || user.username || user.sub || "system";
  const batchId = await createBatch(projectId, file, normalizedOptions, userName);
  if (preview.errors.length) {
    await saveErrors(batchId, projectId, preview.errors);
    await pool.query("UPDATE std_import_batches SET status='failed', total_rows=?, error_rows=?, summary_json=?, finished_at=NOW() WHERE id=? AND project_id=?", [preview.summary.totalRows, preview.summary.errorRows, JSON.stringify(preview.summary), batchId, projectId]);
    return { id: batchId, status: "failed", ...preview };
  }
  const parsed = normalizeParsed(parseWorkbook(file.buffer));
  if (preview.importType === "elements") parsed.catalogs = parsed.references = parsed.domains = parsed.items = [];
  if (preview.importType === "value-domains") parsed.catalogs = parsed.references = parsed.elements = [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await executeImport(connection, projectId, parsed, preview.strategy, userName);
    await connection.commit();
    await pool.query(
      "UPDATE std_import_batches SET status='success', total_rows=?, created_rows=?, updated_rows=?, summary_json=?, finished_at=NOW() WHERE id=? AND project_id=?",
      [preview.summary.totalRows, preview.summary.createRows, preview.summary.updateRows, JSON.stringify(preview.summary), batchId, projectId],
    );
    return { id: batchId, status: "success", ...preview };
  } catch (cause) {
    await connection.rollback();
    await pool.query("UPDATE std_import_batches SET status='failed', error_message=?, finished_at=NOW() WHERE id=? AND project_id=?", [String(cause.message || cause).slice(0, 4000), batchId, projectId]);
    throw cause;
  } finally {
    connection.release();
  }
}

function addSheet(workbook, definition, rows = [], includeSample = true) {
  const data = [definition.headers, ...(rows.length ? rows : includeSample ? [definition.sample] : [])];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = definition.headers.map((header) => ({ wch: Math.max(12, Math.min(32, header.length * 2 + 4)) }));
  XLSX.utils.book_append_sheet(workbook, sheet, definition.name);
}

function buildWorkbook(type = "bundle", exportRows = null) {
  const workbook = XLSX.utils.book_new();
  const instructions = XLSX.utils.aoa_to_sheet([
    ["数据标准批量注册模板", TEMPLATE_VERSION],
    ["说明", "带 * 的字段为必填项；请保持工作表名称和表头不变。"],
    ["导入策略", "追加只新增；更新只修改已有数据；合并为新增加更新；覆盖会完整替换所列值域的代码项。"],
    ["关联方式", "目录、引用标准和值域均通过业务编码关联，不填写数据库 ID。"],
  ]);
  instructions["!cols"] = [{ wch: 18 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "使用说明");
  const keys = type === "elements" ? ["elements"] : type === "value-domains" ? ["domains", "items"] : ["catalogs", "references", "domains", "items", "elements"];
  for (const key of keys) addSheet(workbook, sheetDefinitions[key], exportRows?.[key] || [], !exportRows);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

async function buildExport(type = "bundle") {
  const projectId = requireProjectId();
  const rows = {};
  const queries = {
    catalogs: `SELECT c.catalog_code, c.catalog_name, p.catalog_code AS parent_code, c.catalog_type, c.owner_name, c.description, c.sort_order, c.status FROM std_catalogs c LEFT JOIN std_catalogs p ON p.id=c.parent_id WHERE c.project_id=? AND c.status<>'deleted' ORDER BY c.sort_order,c.id`,
    references: "SELECT standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status FROM std_reference_standards WHERE project_id=? AND status<>'deleted' ORDER BY id",
    domains: `SELECT d.domain_code,d.domain_name,d.domain_type,d.value_type,d.data_type,d.min_value,d.max_value,d.regex_pattern,d.format_pattern,d.unit,r.standard_code AS reference_code,d.reference_clause,d.description,d.status FROM std_value_domains d LEFT JOIN std_reference_standards r ON r.id=d.reference_standard_id WHERE d.project_id=? AND d.status<>'deleted' ORDER BY d.id`,
    items: `SELECT d.domain_code,i.item_code,i.item_label,i.item_value,i.item_meaning,i.sort_order,i.status FROM std_value_domain_items i JOIN std_value_domains d ON d.id=i.domain_id WHERE i.project_id=? AND d.project_id=? AND i.status<>'deleted' ORDER BY d.id,i.sort_order,i.id`,
    elements: `SELECT e.element_code,e.element_identifier,e.element_name_cn,e.element_name_en,e.catalog_id,c.catalog_code,e.object_class,e.property_name,e.representation_term,e.definition,e.data_type,e.max_length,e.numeric_precision_value,e.numeric_scale_value,e.datetime_precision,e.format_pattern,e.unit,d.domain_code,r.standard_code AS reference_code,e.reference_clause,e.aliases_json,e.tags_json,e.owner_name,e.steward_name,e.lifecycle_status,e.status FROM std_data_elements e LEFT JOIN std_catalogs c ON c.id=e.catalog_id LEFT JOIN std_value_domains d ON d.id=e.value_domain_id LEFT JOIN std_reference_standards r ON r.id=e.reference_standard_id WHERE e.project_id=? AND e.status<>'deleted' ORDER BY e.id`,
  };
  const keys = type === "elements" ? ["elements"] : type === "value-domains" ? ["domains", "items"] : ["catalogs", "references", "domains", "items", "elements"];
  for (const key of keys) {
    const params = key === "items" ? [projectId, projectId] : [projectId];
    const [result] = await pool.query(queries[key], params);
    rows[key] = result.map((row) => exportRow(key, row));
  }
  return buildWorkbook(type, rows);
}

function exportRow(key, row) {
  const boolLabel = (value) => value === "active" ? "启用" : "停用";
  if (key === "catalogs") return [row.catalog_code, row.catalog_name, row.parent_code || "", Object.entries(labelMaps.catalogType).find(([, value]) => value === row.catalog_type)?.[0] || row.catalog_type, row.owner_name || "", row.description || "", row.sort_order, boolLabel(row.status)];
  if (key === "references") return [row.standard_code, row.standard_name, row.standard_type, row.standard_no || "", row.publisher || "", row.effective_date || "", row.standard_url || "", row.description || "", boolLabel(row.status)];
  if (key === "domains") return [row.domain_code, row.domain_name, row.domain_type, row.value_type, row.data_type || "", row.min_value ?? "", row.max_value ?? "", row.regex_pattern || "", row.format_pattern || "", row.unit || "", row.reference_code || "", row.reference_clause || "", row.description || "", boolLabel(row.status)];
  if (key === "items") return [row.domain_code, row.item_code, row.item_label, row.item_value || "", row.item_meaning || "", row.sort_order, boolLabel(row.status)];
  const parseJsonList = (value) => { try { return (typeof value === "string" ? JSON.parse(value) : value || []).join(","); } catch { return ""; } };
  return [row.element_code, row.element_identifier, row.element_name_cn, row.element_name_en || "", row.element_code.startsWith("GB") ? "国家标准" : row.element_code.startsWith("HB") ? "行业标准" : "企业标准", row.catalog_code || "", row.object_class || "", row.property_name || "", row.representation_term || "", row.definition || "", row.data_type, row.max_length ?? "", row.numeric_precision_value ?? "", row.numeric_scale_value ?? "", row.datetime_precision || "", row.format_pattern || "", row.unit || "", row.domain_code || "", row.reference_code || "", row.reference_clause || "", parseJsonList(row.aliases_json), parseJsonList(row.tags_json), row.owner_name || "", row.steward_name || "", row.lifecycle_status, boolLabel(row.status)];
}

async function listImportBatches() {
  const projectId = requireProjectId();
  const [rows] = await pool.query(
    `SELECT id, import_type AS importType, import_strategy AS strategy, source_file_name AS fileName, status,
            total_rows AS totalRows, created_rows AS createdRows, updated_rows AS updatedRows,
            skipped_rows AS skippedRows, error_rows AS errorRows, created_by AS createdBy,
            started_at AS startedAt, finished_at AS finishedAt, created_at AS createdAt
     FROM std_import_batches WHERE project_id=? ORDER BY id DESC LIMIT 100`,
    [projectId],
  );
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function buildErrorWorkbook(batchId) {
  const projectId = requireProjectId();
  const [rows] = await pool.query(
    `SELECT sheet_name,excel_row_number AS row_number,business_code,field_name,raw_value,error_type,error_message
     FROM std_import_errors WHERE project_id=? AND batch_id=? ORDER BY sheet_name,row_number,id`,
    [projectId, batchId],
  );
  if (!rows.length) throw new AppError("该批次没有可下载的错误明细", 404);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["工作表", "行号", "业务编码", "错误字段", "原始值", "错误类型", "错误原因"], ...rows.map((row) => [row.sheet_name, row.row_number, row.business_code || "", row.field_name || "", row.raw_value || "", row.error_type, row.error_message])]);
  sheet["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 24 }, { wch: 18 }, { wch: 30 }, { wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "错误明细");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  buildErrorWorkbook,
  buildExport,
  buildWorkbook,
  commitImport,
  listImportBatches,
  previewImport,
  __test__: { decideAction, normalizeParsed, parseWorkbook, validateEntries },
};
