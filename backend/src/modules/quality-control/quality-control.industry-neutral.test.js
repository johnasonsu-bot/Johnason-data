const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serviceSource = fs.readFileSync(path.join(__dirname, "quality-control.service.js"), "utf8");
const normalizerSource = fs.readFileSync(path.join(__dirname, "quality-control.rule-normalizer.js"), "utf8");
const recommendationSource = serviceSource.slice(
  serviceSource.indexOf("const QUALITY_STRATEGY_DEFAULT_SYSTEM_PROMPT"),
  serviceSource.indexOf("function normalizeAdvancedRules("),
);
const service = require("./quality-control.service");

test("策略推荐不再包含行业语义硬编码", () => {
  const forbiddenSymbols = [
    "extractSemanticTags",
    "scoreReferenceEntityMatch",
    "inferHeuristicAdvancedRules",
    "SEMANTIC_REFERENCE_CONFIGS",
    "ORG_CODE_PATTERNS",
    "CERT_TYPE_PATTERNS",
  ];
  forbiddenSymbols.forEach((symbol) => {
    assert.equal(recommendationSource.includes(symbol), false, `${symbol} 不应出现在策略推荐链路`);
    assert.equal(normalizerSource.includes(symbol), false, `${symbol} 不应出现在规则标准化链路`);
  });

  const forbiddenBusinessTriggers = /申请|发放|支付|缴费|就业|证件|国籍|行政区划|机构编码|订单|库存|身份证/;
  assert.doesNotMatch(recommendationSource, forbiddenBusinessTriggers);
  assert.doesNotMatch(normalizerSource, forbiddenBusinessTriggers);
});

test("策略推荐以模型语义分析和通用证据为约束", () => {
  assert.match(recommendationSource, /面向多行业/);
  assert.match(recommendationSource, /禁止使用预置行业知识/);
  assert.match(recommendationSource, /不得套用固定角色枚举/);
  assert.match(recommendationSource, /用户明确选择的参考表/);
  assert.match(recommendationSource, /areFieldTypesCompatible/);
  assert.match(recommendationSource, /getSampleOverlap/);
});

test("未选择参考表时不再按内置语义扫描关联表", () => {
  assert.doesNotMatch(normalizerSource, /buildReferenceTableCandidates/);
  assert.match(normalizerSource, /selectedNames\.has\(table\.fullTableName\)/);
  assert.match(normalizerSource, /selectedSimpleNames\.has\(table\.tableName\)/);
});

test("相同来源系统、名称语义和样例覆盖形成字典强证据兜底", () => {
  const field = {
    columnName: "process_stage",
    columnComment: "处理阶段",
    sampleValues: ["A", "B"],
    enumCandidateValues: ["A", "B"],
  };
  const dictionaries = [
    {
      id: 1,
      dictCode: "common_process_stage",
      dictName: "流程处理阶段字典",
      sourceSystemCode: "SYS_A",
      items: [
        { itemValue: "A", itemLabel: "阶段甲" },
        { itemValue: "B", itemLabel: "阶段乙" },
        { itemValue: "C", itemLabel: "阶段丙" },
      ],
    },
    {
      id: 2,
      dictCode: "other_process_stage",
      dictName: "流程处理阶段字典",
      sourceSystemCode: "SYS_B",
      items: [{ itemValue: "A" }, { itemValue: "B" }],
    },
  ];

  const match = service.__test.findStrongDictionaryMatch(field, { systemCode: "SYS_A" }, dictionaries);
  assert.equal(match?.dictionary.id, 1);
  assert.equal(match?.sampleCoverage, 1);
  assert.ok(match?.nameSimilarity > 0);
  assert.equal(service.__test.hasSpecificDictionarySemanticMatch(field, dictionaries[0]), true);

  const result = service.__test.applyStrongDictionaryFallback(
    field,
    { systemCode: "SYS_A" },
    dictionaries,
    { valueRangeSnapshot: { mode: "none" }, recommendationReason: "模型未选择字典" }
  );
  assert.deepEqual(result.valueRangeSnapshot.allowedValues, ["A", "B", "C"]);
  assert.equal(result.valueRangeSnapshot.sourceId, 1);
  assert.match(result.assetEvidence, /同来源系统/);
});

test("字典强证据兜底拒绝跨系统、低覆盖或无名称语义的候选", () => {
  const baseField = {
    columnName: "process_stage",
    columnComment: "处理阶段",
    sampleValues: ["A", "B"],
    enumCandidateValues: ["A", "B"],
  };
  const dictionary = {
    id: 1,
    dictCode: "common_process_stage",
    dictName: "流程处理阶段字典",
    sourceSystemCode: "SYS_A",
    items: [{ itemValue: "A" }, { itemValue: "C" }],
  };

  assert.equal(service.__test.findStrongDictionaryMatch(baseField, { systemCode: "SYS_B" }, [dictionary]), null);
  assert.equal(service.__test.findStrongDictionaryMatch(baseField, { systemCode: "SYS_A" }, [dictionary]), null);
  assert.equal(service.__test.findStrongDictionaryMatch(
    { ...baseField, columnName: "unrelated", columnComment: "无关属性" },
    { systemCode: "SYS_A" },
    [{ ...dictionary, items: [{ itemValue: "A" }, { itemValue: "B" }] }]
  ), null);
  assert.equal(service.__test.hasSpecificDictionarySemanticMatch(
    { columnName: "registration_status", columnComment: "登记状态" },
    { dictCode: "process_status", dictName: "处理状态字典" }
  ), false);
});

test("策略推荐仅按字段相关度加载受控数量的同系统字典候选", () => {
  const profile = {
    fields: Array.from({ length: 6 }, (_, index) => ({
      columnName: `process_stage_${index}`,
      columnComment: `处理阶段 ${index}`,
    })),
  };
  const dictionaries = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    dictCode: `process_stage_${index}`,
    dictName: `处理阶段 ${index} 字典`,
    dictDesc: "流程处理阶段",
  }));

  const selected = service.__test.selectDictionaryCandidates(profile, dictionaries);
  assert.ok(selected.length > 0);
  assert.ok(selected.length <= 12);
  assert.equal(new Set(selected.map((item) => item.id)).size, selected.length);
});

test("字段有效值率使用已取样数据计算，不再对全部字段做全表聚合", () => {
  const rates = service.__test.computeSampleValueRates(
    [{ columnName: "code" }, { columnName: "name" }],
    [
      { code: "A", name: "甲" },
      { code: "", name: "乙" },
      { code: null, name: "  " },
      { code: "B", name: undefined },
    ]
  );
  assert.equal(rates.code, 0.5);
  assert.equal(rates.name, 0.5);
});

test("推荐失败原因可区分模型超时、限流和无效 JSON", () => {
  assert.equal(service.__test.classifyRecommendationError(new Error("request timeout")).code, "MODEL_TIMEOUT");
  assert.equal(service.__test.classifyRecommendationError(new Error("HTTP 429")).code, "MODEL_RATE_LIMITED");
  assert.equal(service.__test.classifyRecommendationError(new Error("模型输出达到 Token 上限")).code, "MODEL_OUTPUT_TRUNCATED");
  assert.equal(service.__test.classifyRecommendationError(new Error("invalid JSON")).code, "MODEL_INVALID_JSON");
});

test("策略推荐尊重模型管理中的 Token 和超时配置", () => {
  assert.deepEqual(
    service.__test.resolveRecommendationModelLimits({ maxTokens: 20000, timeoutMs: 90000 }, { thinkingEnabled: false }),
    { maxTokens: 20000, timeoutMs: 90000 },
  );
  assert.deepEqual(
    service.__test.resolveRecommendationModelLimits({ maxTokens: 50000, timeoutMs: 180000 }, { thinkingEnabled: true }),
    { maxTokens: 32000, timeoutMs: 120000 },
  );
  assert.deepEqual(
    service.__test.resolveRecommendationModelLimits({ maxTokens: null, timeoutMs: null }, { thinkingEnabled: false }),
    { maxTokens: 8192, timeoutMs: 60000 },
  );
});

test("策略推荐兼容识别主流模型协议的输出截断状态", () => {
  const cases = [
    { raw: { choices: [{ finish_reason: "length" }] } },
    { raw: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } } },
    { raw: { stop_reason: "max_tokens" } },
  ];
  for (const response of cases) {
    assert.equal(service.__test.isRecommendationModelOutputTruncated(response), true);
  }
  assert.equal(service.__test.isRecommendationModelOutputTruncated({ raw: { choices: [{ finish_reason: "stop" }] } }), false);
});

test("模型失败时仍依据数据库非空约束生成字段级基础规则", () => {
  const strategy = service.__test.inferHeuristicStrategy({
    columnName: "record_name",
    columnComment: "记录名称",
    dataType: "varchar",
    isNullable: false,
    isPrimaryKey: false,
    valueRate: 1,
    sampleValues: ["样例"],
  });
  assert.equal(strategy.nonNullCheck, true);
  assert.match(strategy.recommendationReason, /非空字段/);
});

test("策略推荐可解析代码块或附加说明中的 JSON 对象", () => {
  assert.deepEqual(
    service.__test.tryParseModelJsonObject('```json\n{"summary":"ok","fields":[]}\n```'),
    { summary: "ok", fields: [] }
  );
  assert.deepEqual(
    service.__test.tryParseModelJsonObject('推荐如下：\n{"summary":"ok","advancedRules":[]}\n请审核'),
    { summary: "ok", advancedRules: [] }
  );
  assert.equal(service.__test.tryParseModelJsonObject('{"summary":'), null);
});

test("模型只推荐跨表存在性时仍补充有证据的跨表一致性规则", () => {
  const profile = {
    fields: [
      { columnName: "record_id", dataType: "text", valueRate: 1, sampleValues: ["R1", "R2"] },
      { columnName: "record_name", dataType: "text", valueRate: 1, sampleValues: ["甲", "乙"] },
      { columnName: "record_state", dataType: "text", valueRate: 1, sampleValues: ["A", "B"] },
    ],
    relatedTableMetadata: [{
      tableName: "reference_records",
      fullTableName: "reference_records",
      columns: [
        { columnName: "record_id", dataType: "text", sampleValues: ["R1", "R2"] },
        { columnName: "record_name", dataType: "text", sampleValues: ["甲", "乙"] },
        { columnName: "record_state", dataType: "text", sampleValues: ["A", "B"] },
      ],
    }],
  };
  const settings = {
    monitorDirections: ["consistency", "relationship"],
    referenceTables: ["reference_records"],
    keyFields: ["record_id"],
    ruleStrength: "balanced",
  };
  const aiRules = [{
    ruleId: "model_lookup",
    ruleCategory: "cross_table_lookup",
    config: { refTable: "reference_records", localFields: ["record_id"], refFields: ["record_id"] },
  }];

  const supplementalRules = service.__test.mergeSelectedReferenceRules(profile, settings, aiRules);
  assert.equal(supplementalRules.some((rule) => rule.ruleCategory === "cross_table_lookup"), false);
  const consistencyRule = supplementalRules.find((rule) => rule.ruleCategory === "cross_table_consistency");
  assert.ok(consistencyRule);
  assert.deepEqual(consistencyRule.config.localFields, ["record_id"]);
  assert.deepEqual(consistencyRule.config.comparePairs, [
    { localField: "record_name", refField: "record_name" },
    { localField: "record_state", refField: "record_state" },
  ]);
});

test("旧参照完整性编码统一归并为一致性", () => {
  const settings = service.__test.normalizeRecommendationSettings({
    monitorDirections: ["validity", "relationship", "referential_integrity", "consistency", "structure"],
  });
  assert.deepEqual(settings.monitorDirections, ["validity", "consistency"]);
});

test("策略推荐默认启用全部六个监控方向", () => {
  const settings = service.__test.normalizeRecommendationSettings({});
  assert.deepEqual(settings.monitorDirections, ["completeness", "uniqueness", "validity", "consistency", "timeliness", "stability"]);
});

test("字段级推荐严格遵守用户选择的监控方向", () => {
  const strategy = {
    columnName: "record_code",
    isPrimaryKey: true,
    nonNullCheck: true,
    duplicateCheck: true,
    complianceRuleCodes: ["format_rule"],
    valueRangeSnapshot: { mode: "list", sourceType: "dictionary", sourceId: 1, allowedValues: ["A", "B"] },
  };
  const validityOnly = service.__test.applyFieldRecommendationControls(strategy, {
    monitorDirections: ["validity"],
    keyFields: ["record_code"],
    tableKind: "master",
    ruleStrength: "strict",
  });
  assert.equal(validityOnly.nonNullCheck, false);
  assert.equal(validityOnly.duplicateCheck, false);
  assert.deepEqual(validityOnly.complianceRuleCodes, ["format_rule"]);
  assert.equal(validityOnly.valueRangeSnapshot.mode, "list");

  const completenessOnly = service.__test.applyFieldRecommendationControls(strategy, {
    monitorDirections: ["completeness"],
    keyFields: ["record_code"],
    tableKind: "master",
    ruleStrength: "strict",
  });
  assert.equal(completenessOnly.nonNullCheck, true);
  assert.equal(completenessOnly.duplicateCheck, false);
  assert.deepEqual(completenessOnly.complianceRuleCodes, []);
  assert.equal(completenessOnly.valueRangeSnapshot.mode, "none");
});

test("模型高级规则同时受监控方向和规则强度约束", () => {
  const settings = { monitorDirections: ["stability"], ruleStrength: "basic" };
  assert.equal(service.__test.getAdvancedRuleControlExclusion({
    ruleCategory: "volume_anomaly",
    recommendationMeta: { confidence: "high" },
  }, settings, true), "");
  assert.match(service.__test.getAdvancedRuleControlExclusion({
    ruleCategory: "freshness",
    recommendationMeta: { confidence: "high" },
  }, settings, true), /未选择/);
  assert.match(service.__test.getAdvancedRuleControlExclusion({
    ruleCategory: "volume_anomaly",
    recommendationMeta: { confidence: "medium" },
  }, settings, true), /高置信度/);
  assert.equal(service.__test.getAdvancedRuleControlExclusion({
    ruleCategory: "cross_table_lookup",
    recommendationMeta: { confidence: "high" },
  }, { monitorDirections: ["consistency"], ruleStrength: "balanced" }, true), "");
});

test("规则强度控制动态规则覆盖数量和阈值", () => {
  const profile = {
    tableName: "generic_records",
    fields: [
      { columnName: "key_a", valueRate: 1, sampleValues: ["A", "B"], isPrimaryKey: true },
      { columnName: "key_b", valueRate: 1, sampleValues: ["1", "2"], isNullable: false },
      { columnName: "key_c", valueRate: 1, sampleValues: ["X", "Y"], isNullable: false },
    ],
    sampleRows: [],
  };
  const baseSettings = {
    monitorDirections: ["stability"],
    keyFields: ["key_a", "key_b", "key_c"],
    orderField: "",
    tableKind: "general",
    baselineMode: "recent_avg",
    lookbackBatches: 7,
    minHistoryBatches: 3,
    warmupPolicy: "collect_only",
    warmupThreshold: null,
  };
  const basic = service.__test.inferMonitoringDirectionRules(profile, { ...baseSettings, ruleStrength: "basic" });
  const strict = service.__test.inferMonitoringDirectionRules(profile, { ...baseSettings, ruleStrength: "strict" });
  assert.ok(strict.length > basic.length);
  assert.equal(basic.find((rule) => rule.ruleCategory === "volume_anomaly").config.thresholdPercent, 40);
  assert.equal(strict.find((rule) => rule.ruleCategory === "volume_anomaly").config.thresholdPercent, 20);
});
