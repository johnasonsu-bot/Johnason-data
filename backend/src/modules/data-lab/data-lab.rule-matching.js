const SEMANTIC_CLASS_DEFINITIONS = [
  { key: "PHONE", patterns: ["mobile", "phone", "telephone", "contact_mobile", "mobile_no", "手机号", "联系电话", "电话"] },
  { key: "EMAIL", patterns: ["email", "mail", "邮箱", "电子邮箱"] },
  { key: "ID_CARD", patterns: ["id_card", "cert_no", "identity_no", "身份证", "证件号"] },
  { key: "PERSON_NAME", patterns: ["name", "real_name", "person_name", "customer_name", "user_name", "姓名", "客户名称", "姓名拼音"] },
  { key: "ADDRESS", patterns: ["address", "addr", "location", "contact_address", "地址", "所在地", "联系地址"] },
  { key: "AMOUNT", patterns: ["amount", "amt", "price", "fee", "balance", "capital", "money", "金额", "余额", "价格", "费用", "资本"] },
  { key: "DATETIME", patterns: ["time", "date", "datetime", "created_at", "updated_at", "日期", "时间", "时点"] },
  { key: "STATUS", patterns: ["status", "state", "result", "flag", "状态", "结果", "标识"] },
  { key: "TYPE", patterns: ["type", "category", "kind", "类型", "类别"] },
  { key: "REGION", patterns: ["city", "province", "district", "region", "area", "城市", "省份", "地区", "区县"] },
  { key: "PLATE_NO", patterns: ["plate", "plate_no", "license_plate", "车牌", "车牌号"] },
  { key: "VIN", patterns: ["vin", "vehicle_identification", "车架号", "vin码"] },
  { key: "ORG_CODE", patterns: ["org_code", "org_no", "license_no", "统一社会信用代码", "机构代码", "组织机构代码"] },
  { key: "BANK_ACCOUNT", patterns: ["account_no", "bank_account", "acct_no", "银行卡", "银行账号", "账户号"] },
  { key: "PERCENT", patterns: ["ratio", "rate", "pct", "percent", "比例", "比率", "占比"] },
  { key: "CODE", patterns: ["code", "no", "number", "编号", "编码", "流水号", "单号"] },
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+={}|[\]\\:;"'<>,.?/，。；：“”‘’【】（）！￥…—\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function collectTextParts(entity = {}) {
  const ruleConfig = entity.ruleConfig && typeof entity.ruleConfig === "object" ? entity.ruleConfig : {};
  return [
    entity.fieldName,
    entity.tableName,
    entity.fieldComment,
    entity.businessSemantic,
    entity.validationRule,
    entity.ruleName,
    entity.ruleCode,
    entity.issueCategory,
    ruleConfig.targetField,
    ruleConfig.pattern,
    ruleConfig.description,
  ].filter(Boolean).map((item) => String(item));
}

function inferSemanticClassesFromEntity(entity = {}) {
  const text = collectTextParts(entity).join(" ").toLowerCase();
  const result = new Set();
  SEMANTIC_CLASS_DEFINITIONS.forEach((definition) => {
    if (definition.patterns.some((pattern) => text.includes(String(pattern).toLowerCase()))) {
      result.add(definition.key);
    }
  });
  return [...result];
}

function buildFieldSemanticMap(fields, modelSemanticMap = {}) {
  const map = new Map();
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    const key = `${field.tableName}.${field.fieldName}`;
    const modelClasses = Array.isArray(modelSemanticMap[key]) ? modelSemanticMap[key] : [];
    const heuristicClasses = inferSemanticClassesFromEntity(field);
    map.set(key, [...new Set([...heuristicClasses, ...modelClasses])]);
  });
  return map;
}

function getRuleSemanticClasses(rule) {
  return inferSemanticClassesFromEntity(rule);
}

function calculateRuleFieldScore(rule, field, fieldSemanticMap) {
  if (!rule || !field) return 0;
  const normalizedRuleField = normalizeText(rule.fieldName);
  const normalizedField = normalizeText(field.fieldName);
  const normalizedRuleTarget = normalizeText(rule?.ruleConfig?.targetField);
  let score = 0;

  if (normalizedRuleField && normalizedRuleField === normalizedField) {
    score = Math.max(score, 1);
  }
  if (normalizedRuleTarget && normalizedRuleTarget === normalizedField) {
    score = Math.max(score, 0.98);
  }
  if (normalizedRuleField && normalizedField && (normalizedField.includes(normalizedRuleField) || normalizedRuleField.includes(normalizedField))) {
    score = Math.max(score, 0.9);
  }

  const ruleClasses = getRuleSemanticClasses(rule);
  const fieldClasses = fieldSemanticMap.get(`${field.tableName}.${field.fieldName}`) || [];
  const overlap = ruleClasses.filter((item) => fieldClasses.includes(item));
  if (overlap.length > 0) {
    score = Math.max(score, 0.82 + Math.min(0.08, overlap.length * 0.03));
  }

  const fieldTexts = collectTextParts(field).join(" ").toLowerCase();
  const ruleTexts = collectTextParts(rule).join(" ").toLowerCase();
  if (fieldTexts && ruleTexts) {
    const tokens = [...new Set(ruleTexts.split(/[_\s]+/).filter((item) => item && item.length >= 2))];
    const shared = tokens.filter((token) => fieldTexts.includes(token));
    if (shared.length >= 2) {
      score = Math.max(score, 0.72);
    } else if (shared.length === 1) {
      score = Math.max(score, 0.62);
    }
  }

  if (rule.tableName && field.tableName && normalizeText(rule.tableName) === normalizeText(field.tableName)) {
    score += 0.08;
  }

  return Math.min(1, score);
}

function matchFieldRuleForField(fieldRules, field, options = {}) {
  const activeRules = Array.isArray(fieldRules) ? fieldRules.filter((item) => item && item.status !== "inactive") : [];
  const fieldSemanticMap = options.fieldSemanticMap || buildFieldSemanticMap([field], options.modelSemanticMap || {});
  let bestRule = null;
  let bestScore = 0;
  activeRules.forEach((rule) => {
    const score = calculateRuleFieldScore(rule, field, fieldSemanticMap);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  });
  if (bestScore < Number(options.threshold || 0.6)) {
    return null;
  }
  return { rule: bestRule, score: Number(bestScore.toFixed(4)) };
}

function matchComplianceRulesForField(complianceRules, field, options = {}) {
  const activeRules = Array.isArray(complianceRules) ? complianceRules.filter((item) => item && item.status !== "inactive") : [];
  const fieldSemanticMap = options.fieldSemanticMap || buildFieldSemanticMap([field], options.modelSemanticMap || {});
  const threshold = Number(options.threshold || 0.58);
  return activeRules
    .map((rule) => ({ rule, score: calculateRuleFieldScore(rule, field, fieldSemanticMap) }))
    .filter((item) => item.score >= threshold)
    .sort((left, right) => right.score - left.score);
}

function buildSemanticClassPrompt(fields) {
  return {
    semanticClasses: SEMANTIC_CLASS_DEFINITIONS.map((item) => item.key),
    fields: (Array.isArray(fields) ? fields : []).map((field) => ({
      key: `${field.tableName}.${field.fieldName}`,
      tableName: field.tableName,
      fieldName: field.fieldName,
      fieldComment: field.fieldComment || "",
      businessSemantic: field.businessSemantic || "",
      fieldType: field.fieldType || "",
    })),
  };
}

module.exports = {
  buildFieldSemanticMap,
  buildSemanticClassPrompt,
  inferSemanticClassesFromEntity,
  matchFieldRuleForField,
  matchComplianceRulesForField,
  SEMANTIC_CLASS_DEFINITIONS,
};
