const presets = require("../../scripts/data-lab-enhancement-presets");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getDictCodes(dictionaries, dictType, limit = 8) {
  return asArray(dictionaries)
    .filter((item) => String(item?.dictType || "").trim() === dictType)
    .map((item) => String(item?.itemCode || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildValueEntry(tableName, fieldName, values) {
  return {
    tableName,
    fieldName,
    values: asArray(values).filter((item) => item !== null && item !== undefined && item !== ""),
  };
}

function buildEcommerceSeed(roundNo = 1) {
  const preset = presets.ecommercePackage(roundNo);
  const dictionaries = asArray(preset.dictionaries);
  const extraFieldRules = [
    { tableName: "customer_profile", fieldName: "register_channel", generatorType: "ENUM", ruleConfig: { dictType: "register_channel" }, status: "active" },
    { tableName: "order_header", fieldName: "order_status", generatorType: "ENUM", ruleConfig: { dictType: "order_status" }, status: "active" },
    { tableName: "refund_ticket", fieldName: "refund_status", generatorType: "ENUM", ruleConfig: { dictType: "refund_status" }, status: "active" },
  ];
  const extraComplianceRules = [
    { ruleCode: "EC_ORDER_STATUS_ENUM", ruleName: "订单状态枚举", tableName: "order_header", fieldName: "order_status", ruleType: "ENUM_ALLOWED", ruleConfig: { allowedValues: getDictCodes(dictionaries, "order_status", 12) }, issueCategory: "合规性", severity: "high", status: "active" },
    { ruleCode: "EC_REFUND_STATUS_ENUM", ruleName: "退款状态枚举", tableName: "refund_ticket", fieldName: "refund_status", ruleType: "ENUM_ALLOWED", ruleConfig: { allowedValues: getDictCodes(dictionaries, "refund_status", 12) }, issueCategory: "合规性", severity: "high", status: "active" },
  ];
  const entries = [
    buildValueEntry("customer_profile", "member_level", getDictCodes(dictionaries, "member_level")),
    buildValueEntry("customer_profile", "register_channel", getDictCodes(dictionaries, "register_channel")),
    buildValueEntry("order_header", "order_status", getDictCodes(dictionaries, "order_status")),
    buildValueEntry("payment_record", "pay_channel", getDictCodes(dictionaries, "payment_channel")),
    buildValueEntry("merchant_store", "store_type", getDictCodes(dictionaries, "store_type")),
    buildValueEntry("logistics_delivery", "delivery_mode", getDictCodes(dictionaries, "delivery_mode")),
    buildValueEntry("logistics_delivery", "courier_company", getDictCodes(dictionaries, "courier_company")),
    buildValueEntry("refund_ticket", "refund_reason", getDictCodes(dictionaries, "refund_reason")),
    buildValueEntry("refund_ticket", "refund_status", getDictCodes(dictionaries, "refund_status")),
    buildValueEntry("product_spu", "preferred_category", getDictCodes(dictionaries, "preferred_category")),
  ];
  return {
    dictionaries,
    distributionRules: asArray(preset.distributionRules),
    fieldRules: [...asArray(preset.fieldRules), ...extraFieldRules],
    complianceRules: [...asArray(preset.complianceRules), ...extraComplianceRules],
    pluginBindings: asArray(preset.pluginBindings),
    extendedRules: asArray(preset.extendedRules),
    valueCorpora: { entries },
  };
}

function buildTrafficSeed(roundNo = 1) {
  const preset = presets.trafficPackage(roundNo);
  const dictionaries = asArray(preset.dictionaries);
  const extraFieldRules = [
    { tableName: "vehicle_archive", fieldName: "vehicle_type", generatorType: "ENUM", ruleConfig: { dictType: "vehicle_type" }, status: "active" },
    { tableName: "violation_record", fieldName: "violation_code", generatorType: "ENUM", ruleConfig: { dictType: "violation_code" }, status: "active" },
    { tableName: "violation_record", fieldName: "violation_status", generatorType: "ENUM", ruleConfig: { dictType: "violation_status" }, status: "active" },
    { tableName: "penalty_payment", fieldName: "payment_channel", generatorType: "ENUM", ruleConfig: { dictType: "payment_channel" }, status: "active" },
  ];
  const extraComplianceRules = [
    { ruleCode: "TR_VIOLATION_ENUM", ruleName: "违法代码枚举", tableName: "violation_record", fieldName: "violation_code", ruleType: "ENUM_ALLOWED", ruleConfig: { allowedValues: getDictCodes(dictionaries, "violation_code", 12) }, issueCategory: "合规性", severity: "high", status: "active" },
    { ruleCode: "TR_STATUS_ENUM", ruleName: "违法状态枚举", tableName: "violation_record", fieldName: "violation_status", ruleType: "ENUM_ALLOWED", ruleConfig: { allowedValues: getDictCodes(dictionaries, "violation_status", 12) }, issueCategory: "合规性", severity: "high", status: "active" },
  ];
  const entries = [
    buildValueEntry("vehicle_archive", "vehicle_type", getDictCodes(dictionaries, "vehicle_type")),
    buildValueEntry("violation_record", "violation_code", getDictCodes(dictionaries, "violation_code")),
    buildValueEntry("violation_record", "violation_status", getDictCodes(dictionaries, "violation_status")),
    buildValueEntry("checkpoint_inspection", "inspection_result", getDictCodes(dictionaries, "inspection_result")),
    buildValueEntry("penalty_payment", "payment_channel", getDictCodes(dictionaries, "payment_channel")),
    buildValueEntry("checkpoint_inspection", "station_name", getDictCodes(dictionaries, "station_name")),
    buildValueEntry("violation_record", "road_name", getDictCodes(dictionaries, "road_name")),
    buildValueEntry("highway_weight_check_record", "road_name", getDictCodes(dictionaries, "road_name")),
    buildValueEntry("owner_profile", "vehicle_type", getDictCodes(dictionaries, "vehicle_type")),
    buildValueEntry("overload_vehicle_record", "vehicle_type", getDictCodes(dictionaries, "vehicle_type")),
  ];
  return {
    dictionaries,
    distributionRules: asArray(preset.distributionRules),
    fieldRules: [...asArray(preset.fieldRules), ...extraFieldRules],
    complianceRules: [...asArray(preset.complianceRules), ...extraComplianceRules],
    pluginBindings: asArray(preset.pluginBindings),
    extendedRules: asArray(preset.extendedRules),
    valueCorpora: { entries },
  };
}

function getIndustryRuleAssetSeed(industry, roundNo = 1) {
  const normalized = String(industry || "").trim().toLowerCase();
  if (normalized === "traffic") {
    return buildTrafficSeed(roundNo);
  }
  if (normalized === "ecommerce") {
    return buildEcommerceSeed(roundNo);
  }
  return {
    dictionaries: [],
    distributionRules: [],
    fieldRules: [],
    complianceRules: [],
    pluginBindings: [],
    extendedRules: [],
    valueCorpora: { entries: [] },
  };
}

module.exports = {
  getIndustryRuleAssetSeed,
};
