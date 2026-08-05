function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

const incubationAssetMap = require("./data-lab.incubation-asset-map");

const INDUSTRY_RESEARCH_CATALOG = {
  bank_regulatory: {
    industryLabel: "银行监管报送",
    subdomain: "prudential-reporting",
    businessObjects: ["法人机构", "分支机构", "监管报表", "风险指标", "问题单", "整改任务"],
    businessActions: ["报送", "复核", "提交", "整改", "审批"],
    businessResults: ["资本充足率", "流动性指标", "预警结果", "监管反馈"],
    canonicalModules: ["institution_dimension", "prudential_report", "risk_exposure_snapshot", "exception_case"],
    candidateTables: ["institution_dimension", "reporting_branch", "reporting_contact", "prudential_report", "report_metric_item", "risk_exposure_snapshot", "anti_money_alert", "exception_case", "rectification_task", "submission_log", "approval_flow"],
    dictSuggestions: ["branch_type_dict", "report_code_dict"],
    relationSuggestions: ["institution_dimension->reporting_branch", "reporting_branch->prudential_report", "prudential_report->exception_case"],
    complianceHints: ["报送编码需符合监管规则", "资本充足率和流动性指标需保持真实合理"],
  },
  traffic: {
    industryLabel: "交通治理",
    subdomain: "urban-traffic-control",
    businessObjects: ["车主", "车辆", "违法事件", "检查卡口", "事故案件", "执法文书"],
    businessActions: ["登记", "抓拍", "检查", "调度", "缴款", "送达"],
    businessResults: ["违法处理状态", "缴款状态", "检查结果", "案件状态"],
    canonicalModules: ["owner_profile", "vehicle_archive", "violation_record", "checkpoint_inspection", "accident_case"],
    candidateTables: ["owner_profile", "vehicle_archive", "registration_record", "violation_record", "penalty_payment", "checkpoint_inspection", "accident_case", "dispatch_task", "patrol_log", "enforcement_document"],
    dictSuggestions: ["vehicle_type_dict", "violation_code_dict"],
    relationSuggestions: ["owner_profile->vehicle_archive", "vehicle_archive->violation_record", "accident_case->dispatch_task"],
    complianceHints: ["车牌号与身份证号需保持有效", "违法处理和缴款时间链路需一致"],
  },
  ecommerce: {
    industryLabel: "电商零售",
    subdomain: "retail-commerce",
    businessObjects: ["客户", "门店", "商品", "订单", "支付", "履约"],
    businessActions: ["注册", "下单", "支付", "退款", "发货", "结算"],
    businessResults: ["订单状态", "支付状态", "退款状态", "履约状态"],
    canonicalModules: ["customer_profile", "merchant_store", "product_spu", "order_header", "payment_record", "logistics_delivery"],
    candidateTables: ["customer_profile", "customer_address", "merchant_store", "product_spu", "product_sku", "inventory_snapshot", "order_header", "order_item", "payment_record", "refund_ticket", "logistics_delivery"],
    dictSuggestions: ["category_dict", "channel_dict"],
    relationSuggestions: ["customer_profile->order_header", "merchant_store->order_header", "order_header->payment_record"],
    complianceHints: ["手机号、邮箱、地址和订单状态需符合真实业务习惯", "订单金额与支付金额关系需保持一致"],
  },
  education: {
    industryLabel: "教育治理",
    subdomain: "student-lifecycle",
    businessObjects: ["校区", "学生", "监护人", "教职工", "课程", "账单"],
    businessActions: ["入学", "排课", "收费", "通行", "借阅", "通知"],
    businessResults: ["学籍状态", "账单状态", "通行结果", "借阅状态"],
    canonicalModules: ["campus_dimension", "student_profile", "guardian_contact", "staff_profile", "student_enrollment", "tuition_bill"],
    candidateTables: ["campus_dimension", "student_profile", "guardian_contact", "staff_profile", "course_catalog", "class_schedule", "student_enrollment", "tuition_bill", "campus_access_log", "library_borrow_record"],
    dictSuggestions: ["school_type_dict", "term_code_dict"],
    relationSuggestions: ["campus_dimension->student_profile", "student_profile->student_enrollment", "student_profile->tuition_bill"],
    complianceHints: ["学号、身份证和学期编码需保持有效", "入学与收费时间链路需合理"],
  },
  finance_fund: {
    industryLabel: "基金金融",
    subdomain: "fund-operations",
    businessObjects: ["基金产品", "投资者账户", "申购订单", "赎回订单", "净值快照", "交易流水"],
    businessActions: ["申购", "赎回", "确认", "结算", "估值", "划转"],
    businessResults: ["订单状态", "交易状态", "净值结果", "持仓金额"],
    canonicalModules: ["fund_product", "fund_account", "fund_subscription_order", "fund_redemption_order", "fund_nav_snapshot", "fund_trading_flow"],
    candidateTables: ["fund_product", "fund_account", "fund_subscription_order", "fund_redemption_order", "fund_nav_snapshot", "fund_trading_flow"],
    dictSuggestions: ["fund_type_dict", "fund_risk_level_dict"],
    relationSuggestions: ["fund_product->fund_subscription_order", "fund_account->fund_subscription_order", "fund_product->fund_nav_snapshot"],
    complianceHints: ["基金编码、账户编码和净值日期需真实有效", "申购赎回金额需与持仓和交易流水一致"],
  },
  logistics_express: {
    industryLabel: "快递物流",
    subdomain: "express-fulfillment",
    businessObjects: ["运单", "包裹", "线路", "中转记录", "签收记录", "异常工单"],
    businessActions: ["揽收", "分拣", "中转", "配送", "签收", "处置"],
    businessResults: ["运单状态", "中转状态", "签收状态", "异常状态"],
    canonicalModules: ["logistics_waybill", "logistics_package_item", "logistics_delivery_route", "logistics_transfer_record", "logistics_sign_record", "logistics_exception_ticket"],
    candidateTables: ["logistics_waybill", "logistics_package_item", "logistics_delivery_route", "logistics_transfer_record", "logistics_sign_record", "logistics_exception_ticket"],
    dictSuggestions: ["logistics_transport_mode_dict", "logistics_exception_type_dict"],
    relationSuggestions: ["logistics_waybill->logistics_package_item", "logistics_waybill->logistics_transfer_record", "logistics_waybill->logistics_sign_record"],
    complianceHints: ["运单编码、联系电话和线路时间需合理一致", "包裹重量、签收状态和异常状态需互相匹配"],
  },
};

function buildRichnessRules(industry) {
  const base = {
    minCoreTables: 6,
    minDictTables: 2,
    minRelations: 4,
    masterFieldCountMin: 20,
    detailFieldCountMin: 18,
    flowFieldCountMin: 18,
    logFieldCountMin: 18,
    requireAuditFields: true,
    requireRegionFields: true,
    requireBusinessNo: true,
  };
  if (industry === "finance_fund" || industry === "logistics_express") {
    return { ...base, minRelations: 5 };
  }
  return base;
}

function normalizeModuleToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCandidateTableSpec(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const tableName = String(item).trim();
    return tableName ? { tableName, tableLabel: "", tableComment: "", fields: [], description: "" } : null;
  }
  if (typeof item !== "object") return null;
  const tableName = String(item.tableName || item.name || item.label || "").trim();
  if (!tableName) return null;
  const tableLabel = String(item.tableLabel || item.tableNameZh || item.label || "").trim();
  const tableComment = String(item.tableComment || item.comment || "").trim();
  const description = String(item.description || item.summary || tableComment || "").trim();
  return {
    tableName,
    tableLabel,
    tableComment,
    fields: Array.isArray(item.fields) ? item.fields.map((field) => String(field || "").trim()).filter(Boolean) : [],
    description,
  };
}

function normalizeDictSuggestionSpec(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const tableName = String(item).trim();
    return tableName ? { tableName, dictType: tableName.replace(/_dict$/i, ""), dictName: tableName, tableComment: "", fields: [], values: [] } : null;
  }
  if (typeof item !== "object") return null;
  const dictName = String(item.dictName || item.tableName || item.name || "").trim();
  if (!dictName) return null;
  return {
    tableName: String(item.tableName || dictName).trim(),
    dictType: String(item.dictType || item.tableName || dictName).trim(),
    dictName,
    tableComment: String(item.tableComment || item.description || item.summary || "").trim(),
    fields: Array.isArray(item.fields) ? item.fields.map((field) => String(field || "").trim()).filter(Boolean) : [],
    values: Array.isArray(item.values) ? item.values.map((field) => String(field || "").trim()).filter(Boolean) : [],
    description: String(item.description || item.summary || "").trim(),
  };
}

function normalizeCandidateTableSpecs(value) {
  return uniq((Array.isArray(value) ? value : []).map((item) => normalizeCandidateTableSpec(item)).filter(Boolean).map((item) => JSON.stringify(item)))
    .map((item) => JSON.parse(item));
}

function normalizeDictSuggestionSpecs(value) {
  return uniq((Array.isArray(value) ? value : []).map((item) => normalizeDictSuggestionSpec(item)).filter(Boolean).map((item) => JSON.stringify(item)))
    .map((item) => JSON.parse(item));
}

function buildActivePlannerModules(scenarioProfile, modulePlan) {
  const plannerSource = scenarioProfile?.referenceModulePlanner && typeof scenarioProfile.referenceModulePlanner === "object"
    ? scenarioProfile.referenceModulePlanner
    : scenarioProfile?.modulePlanner;
  const plannerModules = Array.isArray(plannerSource?.modules) ? plannerSource.modules : [];
  const matchedModuleKeys = new Set(
    (Array.isArray(modulePlan?.matchedModules) ? modulePlan.matchedModules : [])
      .flatMap((item) => [item?.moduleKey, item?.moduleLabel, item?.moduleName])
      .map(normalizeModuleToken)
      .filter(Boolean)
  );
  if (matchedModuleKeys.size > 0) {
    return plannerModules.filter((item) => {
      const tokens = [item?.moduleKey, item?.moduleLabel, item?.summary].map(normalizeModuleToken).filter(Boolean);
      return tokens.some((token) => matchedModuleKeys.has(token));
    });
  }
  const subScenario = normalizeModuleToken(scenarioProfile?.subScenario || scenarioProfile?.subtype);
  if (subScenario) {
    const scoped = plannerModules.filter((item) => {
      const texts = [item?.moduleKey, item?.moduleLabel, item?.summary, ...(Array.isArray(item?.hints) ? item.hints : [])]
        .map(normalizeModuleToken)
        .filter(Boolean);
      return texts.some((text) => text.includes(subScenario) || subScenario.includes(text));
    });
    if (scoped.length > 0) {
      return scoped;
    }
  }
  return plannerModules;
}

function filterRelationSuggestionsByTables(relationSuggestions, selectedTables) {
  const tableSet = new Set((selectedTables || []).map((item) => String(item || "").trim()).filter(Boolean));
  if (tableSet.size === 0) {
    return Array.isArray(relationSuggestions) ? relationSuggestions : [];
  }
  return (Array.isArray(relationSuggestions) ? relationSuggestions : []).filter((item) => {
    const text = String(item || "").trim();
    const matched = text.match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
    if (!matched) return false;
    const fromTable = String(matched[1] || "").trim();
    const toTable = String(matched[2] || "").trim();
    return tableSet.has(fromTable) || tableSet.has(toTable);
  });
}

function expandSupportTables(industry, selectedTables) {
  const tableSet = new Set((selectedTables || []).map((item) => String(item || "").trim()).filter(Boolean));
  if (String(industry || "") === "traffic") {
    if (tableSet.has("appeal_application") || tableSet.has("appeal_review_case") || tableSet.has("review_decision_notice")) {
      ["violation_record", "vehicle_archive", "owner_profile", "enforcement_document", "checkpoint_inspection"].forEach((item) => tableSet.add(item));
    }
    if (tableSet.has("violation_record")) {
      ["vehicle_archive", "owner_profile", "registration_record"].forEach((item) => tableSet.add(item));
    }
  }
  if (String(industry || "") === "ecommerce") {
    if (tableSet.has("order_header")) {
      ["customer_profile", "merchant_store", "product_spu", "product_sku", "inventory_snapshot", "order_item", "payment_record", "refund_ticket", "logistics_delivery"].forEach((item) => tableSet.add(item));
    }
    if (tableSet.has("live_stream_session")) {
      ["merchant_store", "product_spu", "product_sku", "order_header"].forEach((item) => tableSet.add(item));
    }
  }
  return Array.from(tableSet);
}

function buildCoreSupportRelations(industry, selectedTables) {
  const tableSet = new Set((selectedTables || []).map((item) => String(item || "").trim()).filter(Boolean));
  const relations = [];
  if (String(industry || "") === "traffic") {
    if (tableSet.has("appeal_application") || tableSet.has("appeal_review_case") || tableSet.has("review_decision_notice")) {
      relations.push(
        "owner_profile->vehicle_archive",
        "vehicle_archive->registration_record",
        "vehicle_archive->violation_record",
        "violation_record->penalty_payment",
        "violation_record->enforcement_document",
        "checkpoint_inspection->enforcement_document"
      );
    }
  }
  if (String(industry || "") === "ecommerce") {
    if (tableSet.has("order_header") || tableSet.has("payment_record") || tableSet.has("refund_ticket")) {
      relations.push(
        "customer_profile->order_header",
        "merchant_store->order_header",
        "order_header->order_item",
        "order_header->payment_record",
        "order_header->refund_ticket",
        "order_header->logistics_delivery"
      );
    }
  }
  return uniq(relations);
}

function buildSceneScopedResearchPack(researchPack, scenarioProfile, modulePlan) {
  const activePlannerModules = buildActivePlannerModules(scenarioProfile, modulePlan);
  const matchedModules = Array.isArray(modulePlan?.matchedModules) ? modulePlan.matchedModules : [];
  const selectedModuleKeys = new Set(
    [...matchedModules.flatMap((item) => [item?.moduleKey, item?.moduleLabel, item?.moduleName]), ...activePlannerModules.flatMap((item) => [item?.moduleKey, item?.moduleLabel])]
      .map(normalizeModuleToken)
      .filter(Boolean)
  );
  if (selectedModuleKeys.size === 0) {
    return researchPack;
  }
  const selectedModuleTables = uniq([
    ...matchedModules.flatMap((item) => item?.expectedTables || item?.focusTables || []),
    ...activePlannerModules.flatMap((item) => item?.expectedTables || item?.focusTables || []),
    ...Array.from(selectedModuleKeys).flatMap((moduleKey) => incubationAssetMap.findIndustryModuleAssets(scenarioProfile?.industry, moduleKey)?.tables || []),
  ]);
  const supportTables = expandSupportTables(scenarioProfile?.industry, selectedModuleTables);
  const filteredRelations = filterRelationSuggestionsByTables(researchPack?.relationSuggestions || [], supportTables);
  const finalTables = uniq([
    ...supportTables,
    ...filteredRelations.flatMap((item) => {
      const matched = String(item || "").match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
      return matched ? [matched[1].trim(), matched[2].trim()] : [];
    }),
  ]);
  const moduleAssets = Array.from(selectedModuleKeys)
    .map((moduleKey) => incubationAssetMap.findIndustryModuleAssets(scenarioProfile?.industry, moduleKey))
    .filter(Boolean);
  const moduleRelations = uniq(moduleAssets.flatMap((item) => Array.isArray(item.relations) ? item.relations : []));
  const coreSupportRelations = buildCoreSupportRelations(scenarioProfile?.industry, supportTables);
  const finalRelations = uniq([...moduleRelations, ...coreSupportRelations]);
  return {
    ...researchPack,
    canonicalModules: uniq([
      ...(Array.isArray(researchPack?.canonicalModules) ? researchPack.canonicalModules.filter((item) => selectedModuleKeys.has(normalizeModuleToken(item))) : []),
      ...Array.from(selectedModuleKeys),
    ]),
    candidateTables: uniq([
      ...finalTables,
      ...finalRelations.flatMap((item) => {
        const matched = String(item || "").match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
        return matched ? [matched[1].trim(), matched[2].trim()] : [];
      }),
    ]),
    relationSuggestions: finalRelations,
    dictSuggestions: uniq([
      ...(Array.isArray(researchPack?.dictSuggestions) ? researchPack.dictSuggestions : []),
      ...moduleAssets.flatMap((item) => Array.isArray(item.dictSuggestions) ? item.dictSuggestions : []),
    ]),
    candidateTableSpecs: normalizeCandidateTableSpecs([
      ...(Array.isArray(researchPack?.candidateTableSpecs) ? researchPack.candidateTableSpecs : []),
      ...finalTables.map((tableName) => ({ tableName })),
    ]),
    dictSuggestionSpecs: normalizeDictSuggestionSpecs([
      ...(Array.isArray(researchPack?.dictSuggestionSpecs) ? researchPack.dictSuggestionSpecs : []),
      ...(Array.isArray(researchPack?.dictSuggestions) ? researchPack.dictSuggestions : []),
    ]),
  };
}

const GENERIC_SCENE_HINT_PATTERNS = [
  { pattern: /公交线路|线路/g, object: "公交线路", action: "线路规划", result: "线路执行结果", table: "公交线路表" },
  { pattern: /站点|站台/g, object: "公交站点", action: "站点配置", result: "站点服务状态", table: "站点信息表" },
  { pattern: /班次计划|班次/g, object: "班次计划", action: "班次编排", result: "班次执行结果", table: "班次计划表" },
  { pattern: /车辆调度|调度/g, object: "调度任务", action: "车辆调度", result: "调度执行结果", table: "车辆调度表" },
  { pattern: /司机排班|排班/g, object: "司机班表", action: "司机排班", result: "排班执行结果", table: "司机排班表" },
  { pattern: /到离站记录|到站记录|离站记录/g, object: "到离站记录", action: "到离站记录", result: "到离站时刻结果", table: "到离站记录表" },
  { pattern: /票务交易|刷卡|票务/g, object: "票务交易", action: "票务结算", result: "票务交易结果", table: "票务交易表" },
  { pattern: /客流统计|客流/g, object: "客流统计", action: "客流统计", result: "客流统计结果", table: "客流统计表" },
  { pattern: /维保|保养|维修/g, object: "车辆维保", action: "维保处理", result: "维保完成状态", table: "车辆维保表" },
  { pattern: /异常|告警/g, object: "运营异常", action: "异常处置", result: "异常处置结果", table: "运营异常表" },
];

function extractGenericSceneDrivenHints(sceneName, sceneDesc) {
  const rawText = `${sceneName || ""} ${sceneDesc || ""}`;
  const normalized = normalizeModuleToken(rawText);
  const objects = [];
  const actions = [];
  const results = [];
  const candidateTables = [];
  GENERIC_SCENE_HINT_PATTERNS.forEach((item) => {
    if (item.pattern.test(rawText)) {
      objects.push(item.object);
      actions.push(item.action);
      results.push(item.result);
      candidateTables.push(item.table);
    }
  });
  const relationSuggestions = [];
  if (candidateTables.includes("公交线路表") && candidateTables.includes("站点信息表")) {
    relationSuggestions.push("公交线路表->站点信息表");
  }
  if (candidateTables.includes("班次计划表") && candidateTables.includes("到离站记录表")) {
    relationSuggestions.push("班次计划表->到离站记录表");
  }
  if (candidateTables.includes("车辆调度表") && candidateTables.includes("班次计划表")) {
    relationSuggestions.push("车辆调度表->班次计划表");
  }
  if (candidateTables.includes("司机排班表") && candidateTables.includes("班次计划表")) {
    relationSuggestions.push("司机排班表->班次计划表");
  }
  if (candidateTables.includes("票务交易表") && candidateTables.includes("客流统计表")) {
    relationSuggestions.push("票务交易表->客流统计表");
  }
  return {
    sceneHintText: normalized,
    businessObjects: uniq(objects),
    businessActions: uniq(actions),
    businessResults: uniq(results),
    candidateTables: uniq(candidateTables),
    relationSuggestions: uniq(relationSuggestions),
  };
}

function filterSceneRelevantValues(values, sceneHintText) {
  const hintText = normalizeModuleToken(sceneHintText);
  return uniq(
    (Array.isArray(values) ? values : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => {
        const normalized = normalizeModuleToken(item);
        if (!normalized) return false;
        if (hintText.includes(normalized)) return true;
        return normalized.split(/[_\s]+/).some((token) => token.length >= 2 && hintText.includes(token));
      })
  );
}

function buildLocalResearchPack({ sceneName, sceneDesc, scenarioProfile, modulePlan }) {
  const industry = scenarioProfile?.referenceIndustry || scenarioProfile?.industry || "generic";
  const customResearchCatalog = scenarioProfile?.referenceResearchCatalog && typeof scenarioProfile.referenceResearchCatalog === "object"
    ? scenarioProfile.referenceResearchCatalog
    : (scenarioProfile?.researchCatalog && typeof scenarioProfile.researchCatalog === "object"
      ? scenarioProfile.researchCatalog
      : {});
  const customPlannerModules = buildActivePlannerModules(scenarioProfile, modulePlan);
  const sceneDrivenHints = extractGenericSceneDrivenHints(sceneName, sceneDesc);
  const sceneText = normalizeModuleToken(`${sceneName || ""} ${sceneDesc || ""}`);
  const filterReferenceTermsByScene = (values = []) => uniq(
    (Array.isArray(values) ? values : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => {
        const normalized = normalizeModuleToken(item);
        if (!normalized) return false;
        if (sceneText.includes(normalized)) return true;
        return normalized.split(/[_\s]+/).some((token) => token.length >= 2 && sceneText.includes(token));
      })
  );
  const catalog = INDUSTRY_RESEARCH_CATALOG[industry] || {
    industryLabel: industry === "generic" ? "通用业务场景" : industry,
    subdomain: scenarioProfile?.subtype || "generic",
    businessObjects: sceneDrivenHints.businessObjects || [],
    businessActions: sceneDrivenHints.businessActions || [],
    businessResults: sceneDrivenHints.businessResults || [],
    canonicalModules: [],
    candidateTables: sceneDrivenHints.candidateTables || [],
    dictSuggestions: [],
    relationSuggestions: sceneDrivenHints.relationSuggestions || [],
    complianceHints: ["请保持主键外键可关联", "请保持时间链路和状态链路一致"],
  };
  const filteredCatalogBusinessObjects = filterReferenceTermsByScene(catalog.businessObjects);
  const filteredCatalogBusinessActions = filterReferenceTermsByScene(catalog.businessActions);
  const filteredCatalogBusinessResults = filterReferenceTermsByScene(catalog.businessResults);
  const filteredCatalogCanonicalModules = filterReferenceTermsByScene(catalog.canonicalModules);
  const filteredCatalogDictSuggestions = filterReferenceTermsByScene(catalog.dictSuggestions);
  const filteredCatalogComplianceHints = filterReferenceTermsByScene(catalog.complianceHints);
  const filteredCustomBusinessObjects = filterReferenceTermsByScene(customResearchCatalog.businessObjects);
  const filteredCustomBusinessActions = filterReferenceTermsByScene(customResearchCatalog.businessActions);
  const filteredCustomBusinessResults = filterReferenceTermsByScene(customResearchCatalog.businessResults);
  const filteredCustomCanonicalModules = filterReferenceTermsByScene(customResearchCatalog.canonicalModules);
  const filteredCustomDictSuggestions = filterReferenceTermsByScene(customResearchCatalog.dictSuggestions);
  const filteredCustomComplianceHints = filterReferenceTermsByScene(customResearchCatalog.complianceHints);
  const matchedModules = Array.isArray(modulePlan?.matchedModules)
    ? modulePlan.matchedModules.map((item) => item.moduleKey)
    : [];
  const rawPlannerTables = customPlannerModules.flatMap((item) => item.expectedTables || item.focusTables || []);
  const plannerTables = sceneDrivenHints.candidateTables.length > 0
    ? filterSceneRelevantValues(rawPlannerTables, sceneDrivenHints.sceneHintText)
    : rawPlannerTables;
  const plannerModules = customPlannerModules.map((item) => item.moduleKey || item.moduleLabel || item.summary).filter(Boolean);
  const matchedModuleTables = sceneDrivenHints.candidateTables.length > 0
    ? filterSceneRelevantValues((modulePlan?.matchedModules || []).flatMap((item) => item.expectedTables || item.focusTables || []), sceneDrivenHints.sceneHintText)
    : (modulePlan?.matchedModules || []).flatMap((item) => item.expectedTables || item.focusTables || []);
  const selectedTables = uniq([
    ...plannerTables,
    ...matchedModuleTables,
  ]);
  const filteredCustomCandidateTables = selectedTables.length > 0
    ? (Array.isArray(customResearchCatalog.candidateTables) ? customResearchCatalog.candidateTables.filter((item) => selectedTables.includes(item)) : [])
    : [];
  const filteredCustomRelationSuggestions = selectedTables.length > 0
    ? filterRelationSuggestionsByTables(customResearchCatalog.relationSuggestions, selectedTables)
    : [];
  const candidateTables = uniq([
    ...sceneDrivenHints.candidateTables,
    ...filteredCustomCandidateTables,
    ...plannerTables,
    ...matchedModuleTables,
    ...(selectedTables.length > 0 ? filterRelationSuggestionsByTables([
      ...catalog.relationSuggestions,
      ...filteredCustomRelationSuggestions,
    ], selectedTables) : []).flatMap((item) => {
      const matched = String(item || "").match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
      return matched ? [matched[1].trim(), matched[2].trim()] : [];
    }),
  ]);
  const summary = [
    `自动调研识别行业：${industry}。`,
    `业务对象：${uniq([...filteredCatalogBusinessObjects, ...sceneDrivenHints.businessObjects, ...filteredCustomBusinessObjects]).join("、") || "待补充"}。`,
    `业务动作：${uniq([...filteredCatalogBusinessActions, ...sceneDrivenHints.businessActions, ...filteredCustomBusinessActions]).join("、") || "待补充"}。`,
    `业务结果：${uniq([...filteredCatalogBusinessResults, ...sceneDrivenHints.businessResults, ...filteredCustomBusinessResults]).join("、") || "待补充"}。`,
    matchedModules.length > 0 || plannerModules.length > 0 ? `命中模块：${uniq([...matchedModules, ...plannerModules]).join("、")}。` : "",
    candidateTables.length > 0 ? `候选表：${candidateTables.join("、")}。` : "当前未形成稳定候选表，需依赖场景文本进一步推导。",
  ].filter(Boolean).join(" ");

  return {
    mode: "ZERO_CONFIG_AUTO_RESEARCH",
    industry,
    industryLabel: customResearchCatalog.industryLabel || catalog.industryLabel,
    subdomain: customResearchCatalog.subdomain || catalog.subdomain || scenarioProfile?.subtype || "generic",
    confidence: Number(scenarioProfile?.confidence || 0.6),
    sceneName,
    sceneDesc,
    businessObjects: uniq([...filteredCatalogBusinessObjects, ...sceneDrivenHints.businessObjects, ...filteredCustomBusinessObjects]),
    businessActions: uniq([...filteredCatalogBusinessActions, ...sceneDrivenHints.businessActions, ...filteredCustomBusinessActions]),
    businessResults: uniq([...filteredCatalogBusinessResults, ...sceneDrivenHints.businessResults, ...filteredCustomBusinessResults]),
    canonicalModules: uniq([
      ...filteredCatalogCanonicalModules,
      ...filteredCustomCanonicalModules,
      ...matchedModules,
      ...plannerModules,
    ]),
    candidateTables,
    candidateTableSpecs: normalizeCandidateTableSpecs([
      ...sceneDrivenHints.candidateTables.map((tableName) => ({ tableName })),
      ...filteredCustomCandidateTables.map((tableName) => ({ tableName })),
      ...plannerTables.map((tableName) => ({ tableName })),
      ...matchedModuleTables.map((tableName) => ({ tableName })),
    ]),
    fieldBundles: ["identifier", "subject", "status", "time", "organization", "region", "metrics", "audit"],
    dictSuggestions: uniq([...filteredCatalogDictSuggestions, ...filteredCustomDictSuggestions]),
    dictSuggestionSpecs: normalizeDictSuggestionSpecs(
      filteredCustomDictSuggestions
    ),
    relationSuggestions: uniq([
      ...(selectedTables.length > 0 ? filterRelationSuggestionsByTables(catalog.relationSuggestions, selectedTables) : []),
      ...filteredCustomRelationSuggestions,
    ]),
    dataRules: [
      "主键和外键必须可关联。",
      "时间链路与状态流转必须合理。",
      "每个核心业务对象都要有足够记录供预览和查询。",
      ...((Array.isArray(customResearchCatalog.dataRules) ? customResearchCatalog.dataRules : [])),
    ],
    complianceHints: uniq([...filteredCatalogComplianceHints, ...filteredCustomComplianceHints]),
    richnessRules: {
      ...buildRichnessRules(industry),
      ...((customResearchCatalog.richnessRules && typeof customResearchCatalog.richnessRules === "object") ? customResearchCatalog.richnessRules : {}),
    },
    summary: typeof customResearchCatalog.summary === "string" && customResearchCatalog.summary.trim() ? customResearchCatalog.summary.trim() : summary,
    sceneSpecificPriority: sceneDrivenHints.candidateTables.length > 0,
    sceneHintText: sceneDrivenHints.sceneHintText || sceneText,
  };
}

function normalizeResearchPack(parsed, fallbackPack) {
  if (!parsed || typeof parsed !== "object") {
    return fallbackPack;
  }
  const sceneSpecificPriority = fallbackPack?.sceneSpecificPriority === true;
  const filteredBusinessObjects = sceneSpecificPriority ? filterSceneRelevantValues(parsed.businessObjects, fallbackPack.sceneHintText) : (Array.isArray(parsed.businessObjects) ? parsed.businessObjects : []);
  const filteredBusinessActions = sceneSpecificPriority ? filterSceneRelevantValues(parsed.businessActions, fallbackPack.sceneHintText) : (Array.isArray(parsed.businessActions) ? parsed.businessActions : []);
  const filteredBusinessResults = sceneSpecificPriority ? filterSceneRelevantValues(parsed.businessResults, fallbackPack.sceneHintText) : (Array.isArray(parsed.businessResults) ? parsed.businessResults : []);
  const filteredCandidateTables = sceneSpecificPriority ? filterSceneRelevantValues(parsed.candidateTables, fallbackPack.sceneHintText) : (Array.isArray(parsed.candidateTables) ? parsed.candidateTables : []);
  const filteredDictSuggestions = sceneSpecificPriority ? filterSceneRelevantValues(parsed.dictSuggestions, fallbackPack.sceneHintText) : (Array.isArray(parsed.dictSuggestions) ? parsed.dictSuggestions : []);
  const normalizedCandidateTableSpecs = normalizeCandidateTableSpecs([
    ...(Array.isArray(fallbackPack.candidateTableSpecs) ? fallbackPack.candidateTableSpecs : []),
    ...(Array.isArray(parsed.candidateTableSpecs) ? parsed.candidateTableSpecs : []),
    ...(Array.isArray(parsed.candidateTables) ? parsed.candidateTables : []),
  ]);
  const normalizedDictSuggestionSpecs = normalizeDictSuggestionSpecs([
    ...(Array.isArray(fallbackPack.dictSuggestionSpecs) ? fallbackPack.dictSuggestionSpecs : []),
    ...(Array.isArray(parsed.dictSuggestionSpecs) ? parsed.dictSuggestionSpecs : []),
    ...(Array.isArray(parsed.dictSuggestions) ? parsed.dictSuggestions : []),
  ]);
  return {
    ...fallbackPack,
    ...parsed,
    businessObjects: uniq([...(fallbackPack.businessObjects || []), ...filteredBusinessObjects]),
    businessActions: uniq([...(fallbackPack.businessActions || []), ...filteredBusinessActions]),
    businessResults: uniq([...(fallbackPack.businessResults || []), ...filteredBusinessResults]),
    canonicalModules: uniq([...(fallbackPack.canonicalModules || []), ...(Array.isArray(parsed.canonicalModules) ? parsed.canonicalModules : [])]),
    candidateTables: uniq([...(fallbackPack.candidateTables || []), ...filteredCandidateTables]),
    candidateTableSpecs: normalizedCandidateTableSpecs,
    fieldBundles: uniq([...(fallbackPack.fieldBundles || []), ...(Array.isArray(parsed.fieldBundles) ? parsed.fieldBundles : [])]),
    dictSuggestions: uniq([...(fallbackPack.dictSuggestions || []), ...filteredDictSuggestions]),
    dictSuggestionSpecs: normalizedDictSuggestionSpecs,
    relationSuggestions: uniq([...(fallbackPack.relationSuggestions || []), ...(sceneSpecificPriority ? filterRelationSuggestionsByTables(parsed.relationSuggestions, uniq([...(fallbackPack.candidateTables || []), ...filteredCandidateTables])) : (Array.isArray(parsed.relationSuggestions) ? parsed.relationSuggestions : []))]),
    dataRules: uniq([...(fallbackPack.dataRules || []), ...(Array.isArray(parsed.dataRules) ? parsed.dataRules : [])]),
    complianceHints: uniq([...(fallbackPack.complianceHints || []), ...(Array.isArray(parsed.complianceHints) ? parsed.complianceHints : [])]),
    richnessRules: {
      ...(fallbackPack.richnessRules || {}),
      ...((parsed.richnessRules && typeof parsed.richnessRules === "object") ? parsed.richnessRules : {}),
    },
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : fallbackPack.summary,
  };
}

module.exports = {
  INDUSTRY_RESEARCH_CATALOG,
  buildSceneScopedResearchPack,
  buildLocalResearchPack,
  normalizeResearchPack,
};
