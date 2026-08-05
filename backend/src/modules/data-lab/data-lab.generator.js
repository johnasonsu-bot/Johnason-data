const { randomUUID } = require("crypto");
const scenarioEngine = require("./data-lab.scenario-engine");
const educationSupport = require("./data-lab.education-support");
const extendedRuleEngine = require("./data-lab.extended-rule-engine");
const ruleMatching = require("./data-lab.rule-matching");
const incubationAssetMap = require("./data-lab.incubation-asset-map");

const SAMPLE_NAMES = ["张伟", "王芳", "李娜", "刘洋", "陈晨", "周敏", "黄磊", "赵雪", "吴涛", "徐静"];
const SAMPLE_CITIES = ["上海市", "北京市", "杭州市", "南京市", "成都市", "深圳市", "苏州市", "武汉市"];
const SAMPLE_STREETS = ["人民路", "中山路", "解放路", "滨江大道", "科技园路", "青年路"];
const SAMPLE_COMPANIES = ["星海科技", "凌云数据", "明日互联", "远航商贸", "智域服务"];

const REALISM_LOCATION_CORPUS = [
  {
    code: "310000",
    provinceName: "\u4e0a\u6d77\u5e02",
    cityName: "\u4e0a\u6d77\u5e02",
    districts: ["\u6d66\u4e1c\u65b0\u533a", "\u5f90\u6c47\u533a", "\u95f5\u884c\u533a", "\u957f\u5b81\u533a"],
    streets: ["\u4e16\u7eaa\u5927\u9053", "\u6c5f\u5b81\u8def", "\u6dee\u6d77\u4e2d\u8def", "\u66f9\u6768\u8def"],
    compounds: ["\u8054\u6d0b\u82b1\u56ed", "\u661f\u6cb3\u6e7e", "\u4ec1\u6052\u6ee8\u6c5f\u56ed", "\u745e\u8679\u65b0\u57ce"],
    officeSuffixes: ["\u8425\u4e1a\u90e8", "\u8fd0\u8425\u4e2d\u5fc3", "\u670d\u52a1\u4e2d\u5fc3"],
  },
  {
    code: "330100",
    provinceName: "\u6d59\u6c5f\u7701",
    cityName: "\u676d\u5dde\u5e02",
    districts: ["\u897f\u6e56\u533a", "\u4f59\u676d\u533a", "\u6ee8\u6c5f\u533a", "\u4e0a\u57ce\u533a"],
    streets: ["\u6587\u4e00\u897f\u8def", "\u6559\u5de5\u8def", "\u6ee8\u76db\u8def", "\u5f69\u8679\u5927\u9053"],
    compounds: ["\u84dd\u8272\u94b1\u6c5f", "\u4e07\u5bb6\u82b1\u57ce", "\u8377\u98ce\u82d1", "\u5fb7\u4fe1\u4e91\u5ddd"],
    officeSuffixes: ["\u5206\u62e8\u4e2d\u5fc3", "\u8425\u8fd0\u90e8", "\u4ea4\u4ed8\u4e2d\u5fc3"],
  },
  {
    code: "320100",
    provinceName: "\u6c5f\u82cf\u7701",
    cityName: "\u5357\u4eac\u5e02",
    districts: ["\u9f13\u697c\u533a", "\u5efa\u90ba\u533a", "\u6c5f\u5b81\u533a", "\u79e6\u6dee\u533a"],
    streets: ["\u6c5f\u4e1c\u4e2d\u8def", "\u73e0\u6c5f\u8def", "\u4e2d\u5c71\u5357\u8def", "\u96c6\u5e86\u95e8\u5927\u8857"],
    compounds: ["\u91d1\u9675\u4e16\u7eaa\u82b1\u56ed", "\u5929\u6da6\u57ce", "\u94f6\u57ce\u4e1c\u82d1", "\u4e07\u79d1\u91d1\u57df\u84dd\u6e7e"],
    officeSuffixes: ["\u7f51\u70b9", "\u4f5c\u4e1a\u533a", "\u670d\u52a1\u7ad9"],
  },
  {
    code: "440300",
    provinceName: "\u5e7f\u4e1c\u7701",
    cityName: "\u6df1\u5733\u5e02",
    districts: ["\u5357\u5c71\u533a", "\u798f\u7530\u533a", "\u9f99\u534e\u533a", "\u9f99\u5c97\u533a"],
    streets: ["\u79d1\u82d1\u8def", "\u6df1\u5357\u5927\u9053", "\u6c11\u6cbb\u5927\u9053", "\u7b0b\u5c97\u8def"],
    compounds: ["\u4e07\u8c61\u5929\u5730", "\u661f\u6cb3\u4e16\u754c", "\u524d\u6d77\u5929\u5883", "\u6da6\u5e9c\u82b1\u56ed"],
    officeSuffixes: ["\u5206\u62e8\u4e2d\u5fc3", "\u8425\u4e1a\u90e8", "\u8fd0\u8425\u57fa\u5730"],
  },
  {
    code: "510100",
    provinceName: "\u56db\u5ddd\u7701",
    cityName: "\u6210\u90fd\u5e02",
    districts: ["\u9ad8\u65b0\u533a", "\u6b66\u4faf\u533a", "\u9526\u6c5f\u533a", "\u6210\u534e\u533a"],
    streets: ["\u5929\u5e9c\u5927\u9053", "\u4e00\u73af\u8def", "\u9526\u57ce\u5927\u9053", "\u5409\u5e86\u4e00\u8def"],
    compounds: ["\u9526\u57ce\u82b1\u56ed", "\u4e2d\u6d77\u56fd\u9645", "\u4e1c\u90ca\u8bb0\u5fc6", "\u84dd\u5149\u516c\u56ed\u60a6\u5ead"],
    officeSuffixes: ["\u96c6\u6563\u4e2d\u5fc3", "\u8fd0\u8425\u90e8", "\u914d\u9001\u7ad9"],
  },
];
const REALISM_GENERIC_COMPOUNDS = ["\u661f\u6cb3\u82b1\u56ed", "\u4e2d\u6d77\u57ce", "\u6da6\u5e9c", "\u91d1\u57df\u84dd\u6e7e", "\u5929\u8a89\u57ce"];
const REALISM_GENERIC_STREETS = ["\u4eba\u6c11\u8def", "\u4e2d\u5c71\u8def", "\u5efa\u8bbe\u8def", "\u9752\u5e74\u8def", "\u79d1\u6280\u8def", "\u5b66\u9662\u8def"];
const REALISM_GENERIC_OFFICES = ["\u8425\u4e1a\u90e8", "\u670d\u52a1\u4e2d\u5fc3", "\u5206\u62e8\u4e2d\u5fc3", "\u6570\u636e\u4e2d\u5fc3", "\u8fd0\u8425\u90e8"];

function sanitizeIdentifier(value, maxLength = 48) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, maxLength) || "scene";
}

const CHINESE_TABLE_TOKEN_MAP = [
  ["客户信息", "customer_profile"],
  ["承运商信息", "carrier_profile"],
  ["网点信息", "site_profile"],
  ["位置轨迹", "tracking_record"],
  ["运单主", "waybill_header"],
  ["运单明细", "waybill_item"],
  ["货物信息", "cargo_profile"],
  ["车辆信息", "vehicle_profile"],
  ["司机信息", "driver_profile"],
  ["运输任务", "transport_task"],
  ["仓库库存", "warehouse_inventory"],
  ["运输路线", "transport_route"],
  ["费用明细", "cost_detail"],
  ["轨迹记录", "tracking_record"],
  ["轨迹节点", "tracking_node"],
  ["异常事件", "exception_event"],
  ["异常记录", "exception_record"],
  ["结算对账", "settlement_statement"],
  ["结算单", "settlement_statement"],
  ["结算账单", "settlement_statement"],
  ["操作日志", "operation_log"],
  ["地址字典", "address"],
  ["地址字典", "address_dict"],
  ["货物类型", "cargo_type"],
  ["运输状态", "transport_status"],
  ["费用类型", "cost_type"],
  ["行政区划", "region"],
  ["支付方式", "payment_method"],
  ["票种", "ticket_type"],
  ["投诉类型", "complaint_type"],
  ["调度指令", "dispatch_instruction"],
  ["线路类型", "route_type"],
  ["车辆类型", "vehicle_type"],
  ["驾驶员状态", "driver_status"],
  ["驾驶员职称", "driver_title"],
  ["驾驶员资质", "driver_qualification"],
  ["车辆状态", "vehicle_status"],
  ["线路状态", "route_status"],
  ["站点类型", "station_type"],
  ["结算状态", "settlement_status"],
  ["事件类型", "event_type"],
  ["维修类型", "maintenance_type"],
  ["维修项目", "maintenance_item"],
  ["故障类型", "fault_type"],
  ["事件等级", "event_level"],
  ["稽查结果", "inspection_result"],
  ["告警类型", "alert_type"],
  ["告警级别", "alert_level"],
  ["监控事件类型", "monitor_event_type"],
  ["运营指标", "operation_metric"],
  ["报表类型", "report_type"],
  ["异常类型", "exception_type"],
  ["安全事件", "safety_event"],
  ["投诉建议", "complaint_feedback"],
  ["成本核算", "cost_report"],
  ["实时位置", "location_log"],
  ["实时监控", "monitor_log"],
  ["运营日报", "operation_report_daily"],
  ["驾驶员信息", "driver_profile"],
  ["驾驶员档案", "driver_profile"],
  ["维修工单", "maintenance_work_order"],
  ["车辆维修记录", "vehicle_maintenance_record"],
  ["票务交易记录", "fare_transaction_record"],
  ["上下客记录", "boarding_alighting_record"],
  ["行车计划", "trip_plan"],
  ["里程油耗", "mileage_energy_record"],
  ["收入日报", "revenue_daily_report"],
  ["成本明细", "cost_detail_record"],
  ["客运统计", "passenger_service_stats"],
  ["运营效率", "operation_efficiency"],
  ["月报", "monthly_report"],
  ["用户操作日志", "user_operation_log"],
  ["IC卡", "ic_card"],
  ["移动支付", "mobile_payment"],
  ["公交车辆", "bus_vehicle"],
  ["公交线路", "bus_route"],
  ["公交站点", "bus_station"],
  ["到离站", "arrival_departure"],
  ["站点信息", "bus_station"],
  ["班次计划", "trip_plan"],
  ["车辆调度", "vehicle_dispatch"],
  ["司机排班", "driver_roster"],
  ["客流统计", "passenger_flow_stats"],
  ["公交", "bus"],
  ["巴士", "bus"],
  ["线路", "route"],
  ["站点", "station"],
  ["站台", "station"],
  ["班次", "trip"],
  ["发车", "departure"],
  ["到站", "arrival"],
  ["调度", "dispatch"],
  ["排班", "roster"],
  ["司机", "driver"],
  ["驾驶员", "driver"],
  ["车辆", "vehicle"],
  ["车队", "fleet"],
  ["客流", "passenger_flow"],
  ["票务", "fare"],
  ["刷卡", "swipe"],
  ["交易", "transaction"],
  ["维保", "maintenance"],
  ["保养", "maintenance"],
  ["异常", "exception"],
  ["运营", "operation"],
  ["执行", "execution"],
  ["计划", "plan"],
  // railway
  ["列车状态", "train_status"],
  ["列车时刻", "train_schedule"],
  ["列车班次", "train_schedule"],
  ["列车运行", "train_operation"],
  ["列车", "train"],
  ["铁路", "railway"],
  ["高铁", "high_speed_rail"],
  ["动车", "emu_train"],
  ["机车", "locomotive"],
  ["车次", "train_no"],
  ["旅客", "passenger"],
  ["乘客", "passenger"],
  ["旅客票", "passenger_ticket"],
  ["购票", "ticket_purchase"],
  ["检票", "ticket_check"],
  ["票检", "ticket_check"],
  ["退票", "ticket_refund"],
  ["改签", "ticket_change"],
  ["货运单", "freight_waybill"],
  ["货运", "freight"],
  ["运单", "waybill"],
  ["货物类型", "cargo_type"],
  ["货物", "cargo"],
  ["乘务", "crew"],
  ["乘务员", "crew_member"],
  ["车组", "train_crew"],
  ["滚动股", "rolling_stock"],
  ["车辆档案", "rolling_stock"],
  ["设备维修", "maintenance_log"],
  ["维修记录", "maintenance_log"],
  ["安全检查", "safety_inspection"],
  ["财务结算", "financial_settlement"],
  ["结算", "settlement"],
  ["财务", "financial"],
  ["客流量", "passenger_flow"],
  ["车站信息", "station_info"],
  ["车站等级", "station_grade"],
  ["车站", "station"],
  ["记录", "record"],
  ["日志", "log"],
  ["工单", "work_order"],
  ["告警", "alert"],
  ["设备", "device"],
  ["统计", "stats"],
];

function buildStableChineseSlug(value, maxLength = 48) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("到离站")) {
    return "arrival_departure_log".slice(0, maxLength);
  }
  if (raw.includes("站点信息")) {
    return "bus_station".slice(0, maxLength);
  }
  if (raw.includes("班次计划")) {
    return "trip_plan".slice(0, maxLength);
  }
  if (raw.includes("车辆调度")) {
    return "vehicle_dispatch".slice(0, maxLength);
  }
  if (raw.includes("司机排班")) {
    return "driver_roster".slice(0, maxLength);
  }
  if (raw.includes("客流统计")) {
    return "passenger_flow_stats".slice(0, maxLength);
  }
  if (raw.includes("安全事件")) {
    return "safety_event_record".slice(0, maxLength);
  }
  if (raw.includes("线路类型")) {
    return "route_type".slice(0, maxLength);
  }
  if (raw.includes("客户信息")) {
    return "customer_profile".slice(0, maxLength);
  }
  if (raw.includes("承运商信息")) {
    return "carrier_profile".slice(0, maxLength);
  }
  if (raw.includes("网点信息")) {
    return "site_profile".slice(0, maxLength);
  }
  if (raw.includes("位置轨迹")) {
    return "tracking_record".slice(0, maxLength);
  }
  if (raw.includes("运单主")) {
    return "waybill_header".slice(0, maxLength);
  }
  if (raw.includes("运单明细")) {
    return "waybill_item".slice(0, maxLength);
  }
  if (raw.includes("货物信息")) {
    return "cargo_profile".slice(0, maxLength);
  }
  if (raw.includes("车辆信息")) {
    return "vehicle_profile".slice(0, maxLength);
  }
  if (raw.includes("司机信息")) {
    return "driver_profile".slice(0, maxLength);
  }
  if (raw.includes("运输任务")) {
    return "transport_task".slice(0, maxLength);
  }
  if (raw.includes("仓库库存")) {
    return "warehouse_inventory".slice(0, maxLength);
  }
  if (raw.includes("运输路线")) {
    return "transport_route".slice(0, maxLength);
  }
  if (raw.includes("费用明细")) {
    return "cost_detail".slice(0, maxLength);
  }
  if (raw.includes("轨迹记录")) {
    return "tracking_record".slice(0, maxLength);
  }
  if (raw.includes("轨迹节点")) {
    return "tracking_node".slice(0, maxLength);
  }
  if (raw.includes("异常事件")) {
    return "exception_event".slice(0, maxLength);
  }
  if (raw.includes("异常记录")) {
    return "exception_record".slice(0, maxLength);
  }
  if (raw.includes("结算对账")) {
    return "settlement_statement".slice(0, maxLength);
  }
  if (raw.includes("结算单")) {
    return "settlement_statement".slice(0, maxLength);
  }
  if (raw.includes("结算账单")) {
    return "settlement_statement".slice(0, maxLength);
  }
  if (raw.includes("操作日志")) {
    return "operation_log".slice(0, maxLength);
  }
  if (raw.includes("地址字典")) {
    return "address_dict".slice(0, maxLength);
  }
  if (raw.includes("货物类型")) {
    return "cargo_type".slice(0, maxLength);
  }
  if (raw.includes("运输状态")) {
    return "transport_status".slice(0, maxLength);
  }
  if (raw.includes("费用类型")) {
    return "cost_type".slice(0, maxLength);
  }
  if (raw.includes("车辆类型")) {
    return "vehicle_type".slice(0, maxLength);
  }
  if (raw.includes("线路状态")) {
    return "route_status".slice(0, maxLength);
  }
  if (raw.includes("行政区划")) {
    return "region".slice(0, maxLength);
  }
  if (raw.includes("调度指令")) {
    return "dispatch_instruction".slice(0, maxLength);
  }
  if (raw.includes("投诉类型")) {
    return "complaint_type".slice(0, maxLength);
  }
  if (raw.includes("票种")) {
    return "ticket_type".slice(0, maxLength);
  }
  if (raw.includes("支付方式")) {
    return "payment_method".slice(0, maxLength);
  }
  if (raw.includes("结算状态")) {
    return "settlement_status".slice(0, maxLength);
  }
  if (raw.includes("车辆状态")) {
    return "vehicle_status".slice(0, maxLength);
  }
  if (raw.includes("驾驶员状态")) {
    return "driver_status".slice(0, maxLength);
  }
  if (raw.includes("驾驶员职称")) {
    return "driver_title".slice(0, maxLength);
  }
  if (raw.includes("驾驶员资质")) {
    return "driver_qualification".slice(0, maxLength);
  }
  if (raw.includes("站点类型")) {
    return "station_type".slice(0, maxLength);
  }
  if (raw.includes("维修类型")) {
    return "maintenance_type".slice(0, maxLength);
  }
  if (raw.includes("维修项目")) {
    return "maintenance_item".slice(0, maxLength);
  }
  if (raw.includes("异常类型")) {
    return "exception_type".slice(0, maxLength);
  }
  if (raw.includes("故障类型")) {
    return "fault_type".slice(0, maxLength);
  }
  if (raw.includes("事件等级")) {
    return "event_level".slice(0, maxLength);
  }
  if (raw.includes("事件类型")) {
    return "event_type".slice(0, maxLength);
  }
  if (raw.includes("监控事件类型")) {
    return "monitor_event_type".slice(0, maxLength);
  }
  if (raw.includes("报表类型")) {
    return "report_type".slice(0, maxLength);
  }
  if (raw.includes("稽查结果")) {
    return "inspection_result".slice(0, maxLength);
  }
  if (raw.includes("告警类型")) {
    return "alert_type".slice(0, maxLength);
  }
  if (raw.includes("告警级别")) {
    return "alert_level".slice(0, maxLength);
  }
  if (raw.includes("运营指标")) {
    return "operation_metric".slice(0, maxLength);
  }
  if (raw.includes("实时监控")) {
    return "vehicle_monitor_log".slice(0, maxLength);
  }
  if (raw.includes("实时位置")) {
    return "vehicle_location_log".slice(0, maxLength);
  }
  if (raw.includes("运营日报")) {
    return "operation_report_daily".slice(0, maxLength);
  }
  if (raw.includes("投诉建议")) {
    return "passenger_complaint_feedback".slice(0, maxLength);
  }
  if (raw.includes("成本核算")) {
    return "operation_cost_report".slice(0, maxLength);
  }
  if (raw.includes("驾驶员信息")) {
    return "driver_profile".slice(0, maxLength);
  }
  if (raw.includes("驾驶员档案")) {
    return "driver_profile".slice(0, maxLength);
  }
  if (raw.includes("运营排班")) {
    return "operation_roster".slice(0, maxLength);
  }
  if (raw.includes("车辆维修记录")) {
    return "vehicle_maintenance_record".slice(0, maxLength);
  }
  if (raw.includes("维修工单")) {
    return "vehicle_maintenance_work_order".slice(0, maxLength);
  }
  if (raw.includes("票务交易记录")) {
    return "fare_transaction_record".slice(0, maxLength);
  }
  if (raw.includes("上下客记录")) {
    return "boarding_alighting_record".slice(0, maxLength);
  }
  if (raw.includes("行车计划")) {
    return "trip_plan".slice(0, maxLength);
  }
  if (raw.includes("里程油耗")) {
    return "mileage_energy_record".slice(0, maxLength);
  }
  if (raw.includes("收入日报")) {
    return "revenue_daily_report".slice(0, maxLength);
  }
  if (raw.includes("成本明细")) {
    return "cost_detail_record".slice(0, maxLength);
  }
  if (raw.includes("客运统计")) {
    return "passenger_service_stats".slice(0, maxLength);
  }
  if (raw.includes("运营效率")) {
    return "operation_efficiency".slice(0, maxLength);
  }
  if (raw.includes("用户操作日志")) {
    return "user_operation_log".slice(0, maxLength);
  }
  if (raw.includes("公交车辆")) {
    return "bus_vehicle".slice(0, maxLength);
  }
  if (raw.includes("公交线路")) {
    return "bus_route".slice(0, maxLength);
  }
  if (raw.includes("公交站点")) {
    return "bus_station".slice(0, maxLength);
  }
  const tokens = [];
  CHINESE_TABLE_TOKEN_MAP.forEach(([keyword, slug]) => {
    if (raw.includes(keyword) && !tokens.includes(slug)) {
      tokens.push(slug);
    }
  });
  const base = tokens.slice(0, 4).join("_");
  if (base) {
    return base.slice(0, maxLength);
  }
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(index);
    hash |= 0;
  }
  const suffix = Math.abs(hash).toString(36).slice(0, 8);
  return `scene_${suffix}`.slice(0, maxLength);
}

function normalizeSceneCode(sceneName, fallback = "scene") {
  return sanitizeIdentifier(
    String(sceneName || "")
      .replace(/婚姻|结婚|登记/g, "marriage")
      .replace(/电商|订单|商城/g, "ecommerce")
      .replace(/客户|crm|销售/g, "crm")
      .replace(/用户/g, "user"),
    32
  ) || fallback;
}

function relation(fromTable, fromField, toTable, toField, relationType) {
  return { fromTable, fromField, toTable, toField, relationType };
}

function dictTable(tableName, tableComment, values) {
  return {
    tableName,
    tableComment,
    values: values.map(([dictKey, dictValue], index) => ({ dictKey, dictValue, sortOrder: index + 1 }))
  };
}

function pkField(fieldName, fieldType, fieldComment) {
  return {
    fieldName,
    fieldType,
    fieldLength: fieldType.includes("BIGINT") ? null : 64,
    nullable: false,
    primaryKey: true,
    uniqueKey: true,
    foreignKey: false,
    foreignRefTable: "",
    foreignRefField: "",
    defaultValue: null,
    fieldComment,
    businessSemantic: "PRIMARY_KEY",
    validationRule: "NOT_NULL",
    dirtyRuleCandidates: ["DUPLICATE_VALUE", "NULL_VALUE"]
  };
}

function fkField(fieldName, fieldType, fieldComment, foreignRefTable, foreignRefField) {
  return {
    fieldName,
    fieldType,
    fieldLength: fieldType.includes("BIGINT") ? null : 64,
    nullable: false,
    primaryKey: false,
    uniqueKey: false,
    foreignKey: true,
    foreignRefTable,
    foreignRefField,
    defaultValue: null,
    fieldComment,
    businessSemantic: "FOREIGN_KEY",
    validationRule: "FK_EXISTS",
    dirtyRuleCandidates: ["MISSING_FK", "NULL_VALUE"]
  };
}

function varcharField(fieldName, fieldLength, fieldComment, businessSemantic, nullable = true, uniqueKey = false) {
  return {
    fieldName,
    fieldType: "VARCHAR",
    fieldLength,
    nullable,
    primaryKey: false,
    uniqueKey,
    foreignKey: false,
    foreignRefTable: "",
    foreignRefField: "",
    defaultValue: null,
    fieldComment,
    businessSemantic,
    validationRule: nullable ? "" : "NOT_NULL",
    dirtyRuleCandidates: ["LEADING_SPACES", "NULL_VALUE", "INVALID_FORMAT"]
  };
}

function datetimeField(fieldName, fieldComment) {
  return {
    fieldName,
    fieldType: "DATETIME",
    fieldLength: null,
    nullable: false,
    primaryKey: false,
    uniqueKey: false,
    foreignKey: false,
    foreignRefTable: "",
    foreignRefField: "",
    defaultValue: null,
    fieldComment,
    businessSemantic: "DATETIME",
    validationRule: "VALID_DATETIME",
    dirtyRuleCandidates: ["INVALID_TIME", "NULL_VALUE"]
  };
}

function nullableDatetimeField(fieldName, fieldComment) {
  return {
    ...datetimeField(fieldName, fieldComment),
    nullable: true,
    validationRule: "",
  };
}

function numberField(fieldName, fieldType, fieldComment, businessSemantic) {
  return {
    fieldName,
    fieldType,
    fieldLength: null,
    nullable: false,
    primaryKey: false,
    uniqueKey: false,
    foreignKey: false,
    foreignRefTable: "",
    foreignRefField: "",
    defaultValue: null,
    fieldComment,
    businessSemantic,
    validationRule: "VALID_NUMBER",
    dirtyRuleCandidates: ["NULL_VALUE", "OUT_OF_RANGE"]
  };
}

function decimalField(fieldName, fieldComment, businessSemantic = "AMOUNT") {
  return numberField(fieldName, "DECIMAL(18,2)", fieldComment, businessSemantic);
}

function intField(fieldName, fieldComment, businessSemantic = "NUMBER") {
  return numberField(fieldName, "INT", fieldComment, businessSemantic);
}

function codeField(fieldName, fieldComment, businessSemantic = "TEXT", uniqueKey = false) {
  return varcharField(fieldName, 64, fieldComment, businessSemantic, false, uniqueKey);
}

function longTextField(fieldName, fieldComment, businessSemantic = "TEXT") {
  return varcharField(fieldName, 255, fieldComment, businessSemantic);
}

function addAuditFields(prefix = "") {
  return [
    varcharField(`${prefix}data_status`, 32, "数据状态", "DICT_STATUS", false),
    codeField(`${prefix}source_system`, "来源系统"),
    codeField(`${prefix}etl_batch_no`, "装载批次号"),
    datetimeField(`${prefix}created_at`, "创建时间"),
    datetimeField(`${prefix}updated_at`, "更新时间"),
  ];
}

function addRegionFields() {
  return [
    codeField("province_code", "省份编码", "DICT_REGION"),
    varcharField("province_name", 64, "省份名称", "TEXT"),
    codeField("city_code", "城市编码", "DICT_REGION"),
    varcharField("city_name", 64, "城市名称", "TEXT"),
    codeField("district_code", "区县编码", "DICT_REGION"),
    varcharField("district_name", 64, "区县名称", "TEXT"),
  ];
}

function addContactFields(prefix = "") {
  return [
    varcharField(`${prefix}contact_name`, 64, "联系人姓名", "PERSON_NAME"),
    varcharField(`${prefix}contact_mobile`, 16, "联系人手机号", "PHONE"),
    varcharField(`${prefix}contact_email`, 128, "联系人邮箱", "EMAIL"),
  ];
}

function ensureMinimumFieldCount(tables, minCount = 20) {
  return (tables || []).map((table) => {
    const nextTable = {
      ...table,
      fields: [...(table.fields || [])],
    };
    let index = 1;
    while (nextTable.fields.length < minCount) {
      const fieldName = `ext_field_${String(index).padStart(2, "0")}`;
      if (!nextTable.fields.find((field) => field.fieldName === fieldName)) {
        nextTable.fields.push(varcharField(fieldName, 128, `扩展字段${index}`, "TEXT"));
      }
      index += 1;
    }
    return nextTable;
  });
}

function buildMarriageTemplate() {
  return {
    tables: [
      {
        tableName: "user_info",
        tableComment: "用户信息表",
        businessRole: "MASTER",
        generationPriority: 2,
        fields: [
          pkField("user_id", "BIGINT", "用户主键"),
          varcharField("user_name", 64, "用户姓名", "PERSON_NAME"),
          varcharField("id_card_no", 18, "身份证号", "ID_CARD", false, true),
          varcharField("mobile", 16, "手机号", "PHONE", false, true),
          varcharField("email", 128, "邮箱", "EMAIL"),
          varcharField("province_code", 32, "省份编码", "DICT_REGION"),
          varcharField("city_code", 32, "城市编码", "DICT_REGION"),
          datetimeField("register_time", "注册时间"),
          datetimeField("updated_at", "更新时间")
        ]
      },
      {
        tableName: "register_apply",
        tableComment: "婚姻登记预约申请表",
        businessRole: "DETAIL",
        generationPriority: 3,
        fields: [
          pkField("apply_id", "BIGINT", "申请主键"),
          fkField("user_id", "BIGINT", "关联用户", "user_info", "user_id"),
          varcharField("apply_no", 64, "预约编号", "ORDER_NO", false, true),
          varcharField("register_office", 128, "登记机关", "OFFICE"),
          varcharField("apply_status", 32, "预约状态", "DICT_STATUS"),
          datetimeField("appointment_time", "预约时间"),
          datetimeField("submit_time", "提交时间"),
          varcharField("remark", 255, "备注", "TEXT")
        ]
      },
      {
        tableName: "audit_log",
        tableComment: "审核日志表",
        businessRole: "LOG",
        generationPriority: 4,
        fields: [
          pkField("log_id", "BIGINT", "日志主键"),
          fkField("apply_id", "BIGINT", "关联预约", "register_apply", "apply_id"),
          varcharField("audit_result", 32, "审核结果", "DICT_AUDIT"),
          varcharField("auditor_name", 64, "审核人", "PERSON_NAME"),
          datetimeField("audit_time", "审核时间"),
          varcharField("audit_remark", 255, "审核意见", "TEXT")
        ]
      }
    ],
    dictTables: [
      dictTable("region_dict", "地区字典", [["310000", "上海市"], ["320100", "南京市"], ["330100", "杭州市"], ["440300", "深圳市"]]),
      dictTable("status_dict", "状态字典", [["SUBMITTED", "已提交"], ["APPROVED", "已通过"], ["REJECTED", "已拒绝"], ["EXPIRED", "已过期"]])
    ],
    relations: [relation("user_info", "user_id", "register_apply", "user_id", "1:N"), relation("register_apply", "apply_id", "audit_log", "apply_id", "1:N")],
    modelExplanation: "婚姻登记场景优先生成用户、预约和审核日志三类核心表，并补齐地区与状态字典。"
  };
}

function buildEcommerceTemplate() {
  return {
    tables: [
      {
        tableName: "customer_info",
        tableComment: "客户信息表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("customer_id", "BIGINT", "客户主键"),
          varcharField("customer_name", 64, "客户姓名", "PERSON_NAME"),
          varcharField("mobile", 16, "手机号", "PHONE", false, true),
          varcharField("email", 128, "邮箱", "EMAIL"),
          datetimeField("register_time", "注册时间")
        ]
      },
      {
        tableName: "product_info",
        tableComment: "商品信息表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("product_id", "BIGINT", "商品主键"),
          varcharField("product_name", 128, "商品名称", "PRODUCT_NAME"),
          varcharField("category_code", 32, "品类编码", "DICT_CATEGORY"),
          numberField("sale_price", "DECIMAL(12,2)", "销售金额", "AMOUNT"),
          numberField("stock_qty", "INT", "库存数量", "NUMBER")
        ]
      },
      {
        tableName: "order_info",
        tableComment: "订单表",
        businessRole: "DETAIL",
        generationPriority: 2,
        fields: [
          pkField("order_id", "BIGINT", "订单主键"),
          fkField("customer_id", "BIGINT", "客户主键", "customer_info", "customer_id"),
          varcharField("order_no", 64, "订单编号", "ORDER_NO", false, true),
          varcharField("order_status", 32, "订单状态", "DICT_STATUS"),
          numberField("order_amount", "DECIMAL(12,2)", "订单金额", "AMOUNT"),
          datetimeField("order_time", "下单时间")
        ]
      },
      {
        tableName: "payment_record",
        tableComment: "支付记录表",
        businessRole: "FLOW",
        generationPriority: 3,
        fields: [
          pkField("payment_id", "BIGINT", "支付主键"),
          fkField("order_id", "BIGINT", "订单主键", "order_info", "order_id"),
          varcharField("pay_channel", 32, "支付渠道", "DICT_CHANNEL"),
          varcharField("pay_status", 32, "支付状态", "DICT_STATUS"),
          numberField("pay_amount", "DECIMAL(12,2)", "支付金额", "AMOUNT"),
          datetimeField("pay_time", "支付时间")
        ]
      }
    ],
    dictTables: [
      dictTable("category_dict", "商品分类字典", [["ELECTRONIC", "电子产品"], ["HOME", "家居用品"], ["BOOK", "图书音像"], ["FOOD", "食品酒水"]]),
      dictTable("channel_dict", "支付渠道字典", [["WECHAT", "微信支付"], ["ALIPAY", "支付宝"], ["CARD", "银行卡"]])
    ],
    relations: [relation("customer_info", "customer_id", "order_info", "customer_id", "1:N"), relation("order_info", "order_id", "payment_record", "order_id", "1:N")],
    modelExplanation: "电商场景采用客户、商品、订单、支付四层结构，便于同时覆盖存量、增量与实时事件。"
  };
}

function buildCrmTemplate() {
  return {
    tables: [
      {
        tableName: "customer_profile",
        tableComment: "客户档案表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("customer_id", "BIGINT", "客户主键"),
          varcharField("customer_name", 128, "客户名称", "COMPANY_NAME"),
          varcharField("industry_code", 32, "行业编码", "DICT_INDUSTRY"),
          varcharField("contact_name", 64, "联系人", "PERSON_NAME"),
          varcharField("contact_mobile", 16, "联系人手机号", "PHONE"),
          datetimeField("created_at", "创建时间")
        ]
      },
      {
        tableName: "opportunity_info",
        tableComment: "商机表",
        businessRole: "DETAIL",
        generationPriority: 2,
        fields: [
          pkField("opportunity_id", "BIGINT", "商机主键"),
          fkField("customer_id", "BIGINT", "客户主键", "customer_profile", "customer_id"),
          varcharField("opportunity_name", 128, "商机名称", "TEXT"),
          varcharField("stage_code", 32, "阶段编码", "DICT_STAGE"),
          numberField("expected_amount", "DECIMAL(12,2)", "预计金额", "AMOUNT"),
          datetimeField("created_at", "创建时间")
        ]
      },
      {
        tableName: "follow_record",
        tableComment: "跟进记录表",
        businessRole: "LOG",
        generationPriority: 3,
        fields: [
          pkField("record_id", "BIGINT", "记录主键"),
          fkField("opportunity_id", "BIGINT", "商机主键", "opportunity_info", "opportunity_id"),
          varcharField("follow_type", 32, "跟进类型", "DICT_STAGE"),
          varcharField("sales_name", 64, "销售姓名", "PERSON_NAME"),
          datetimeField("follow_time", "跟进时间"),
          varcharField("follow_summary", 255, "跟进摘要", "TEXT")
        ]
      }
    ],
    dictTables: [
      dictTable("industry_dict", "行业字典", [["MANUFACTURING", "制造业"], ["FINANCE", "金融业"], ["RETAIL", "零售业"], ["PUBLIC", "公共服务"]]),
      dictTable("stage_dict", "阶段字典", [["NEW", "初始线索"], ["FOLLOWING", "跟进中"], ["PROPOSAL", "方案阶段"], ["WON", "赢单"], ["LOST", "输单"]])
    ],
    relations: [relation("customer_profile", "customer_id", "opportunity_info", "customer_id", "1:N"), relation("opportunity_info", "opportunity_id", "follow_record", "opportunity_id", "1:N")],
    modelExplanation: "CRM 场景以客户档案为主表，向商机与跟进日志扩展，适合做销售漏斗和行为数据实验。"
  };
}

function buildTrafficTemplate() {
  return {
    tables: [
      {
        tableName: "vehicle_archive",
        tableComment: "车辆档案表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("vehicle_id", "BIGINT", "车辆主键"),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE", false, true),
          varcharField("vehicle_type", 32, "车辆类型", "DICT_VEHICLE_TYPE", false),
          varcharField("owner_name", 64, "所有人姓名", "PERSON_NAME", false),
          varcharField("register_city_code", 32, "登记城市编码", "DICT_REGION", false),
          varcharField("owner_mobile", 16, "车主手机号", "PHONE"),
          datetimeField("registered_at", "登记时间"),
        ],
      },
      {
        tableName: "violation_record",
        tableComment: "违法记录表",
        businessRole: "DETAIL",
        generationPriority: 2,
        fields: [
          pkField("violation_id", "BIGINT", "违法主键"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          varcharField("violation_code", 32, "违法代码", "DICT_VIOLATION_CODE", false),
          varcharField("violation_desc", 128, "违法行为描述", "TEXT", false),
          numberField("violation_points", "INT", "记分", "NUMBER"),
          numberField("fine_amount", "DECIMAL(12,2)", "罚款金额", "AMOUNT"),
          varcharField("road_name", 128, "违法路段", "ROAD_NAME", false),
          varcharField("violation_status", 32, "处理状态", "DICT_STATUS", false),
          datetimeField("capture_time", "抓拍时间"),
        ],
      },
      {
        tableName: "checkpoint_inspection",
        tableComment: "路检路查记录表",
        businessRole: "FLOW",
        generationPriority: 3,
        fields: [
          pkField("inspection_id", "BIGINT", "检查主键"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          varcharField("station_name", 128, "检查站名称", "STATION_NAME", false),
          varcharField("lane_no", 16, "车道号", "TEXT", false),
          varcharField("officer_name", 64, "执勤人员", "PERSON_NAME", false),
          varcharField("inspection_result", 32, "检查结果", "DICT_STATUS", false),
          datetimeField("inspection_time", "检查时间"),
        ],
      },
    ],
    dictTables: [
      dictTable("vehicle_type_dict", "车辆类型字典", [["SEDAN", "小型客车"], ["SUV", "运动型客车"], ["NEW_ENERGY", "新能源车"], ["TRUCK", "货运车辆"], ["BUS", "营运客车"]]),
      dictTable("violation_code_dict", "违法代码字典", [["1344", "违反禁令标志指示"], ["1625", "驾驶时拨打接听手持电话"], ["1116", "不按导向车道行驶"], ["1302", "违停"], ["1352", "未礼让行人"], ["1362", "闯红灯"]]),
    ],
    relations: [relation("vehicle_archive", "vehicle_id", "violation_record", "vehicle_id", "1:N"), relation("vehicle_archive", "vehicle_id", "checkpoint_inspection", "vehicle_id", "1:N")],
    modelExplanation: "交通管理场景围绕车辆档案、违法记录和路检路查构建，适合模拟执法检查、卡口通行与违章处理。",
  };
}

function buildBankRegulatoryTemplate() {
  return {
    tables: [
      {
        tableName: "reporting_branch",
        tableComment: "报送机构表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("branch_id", "BIGINT", "机构主键"),
          varcharField("branch_code", 32, "机构编码", "TEXT", false, true),
          varcharField("branch_name", 128, "机构名称", "COMPANY_NAME", false),
          varcharField("branch_type", 32, "机构类型", "DICT_BRANCH_TYPE", false),
          varcharField("region_code", 32, "地区编码", "DICT_REGION", false),
          datetimeField("established_at", "设立时间"),
        ],
      },
      {
        tableName: "prudential_report",
        tableComment: "审慎监管报表",
        businessRole: "DETAIL",
        generationPriority: 2,
        fields: [
          pkField("report_id", "BIGINT", "报表主键"),
          fkField("branch_id", "BIGINT", "机构主键", "reporting_branch", "branch_id"),
          varcharField("report_code", 64, "报表编码", "DICT_REPORT_CODE", false),
          varcharField("report_period", 32, "报送期间", "TEXT", false),
          numberField("total_assets", "DECIMAL(18,2)", "总资产", "AMOUNT"),
          numberField("loan_balance", "DECIMAL(18,2)", "贷款余额", "AMOUNT"),
          numberField("capital_adequacy_ratio", "DECIMAL(6,2)", "资本充足率", "NUMBER"),
          numberField("liquidity_coverage_ratio", "DECIMAL(6,2)", "流动性覆盖率", "NUMBER"),
          numberField("npl_ratio", "DECIMAL(6,2)", "不良贷款率", "NUMBER"),
          varcharField("report_status", 32, "报送状态", "DICT_STATUS", false),
          datetimeField("submit_time", "提交时间"),
        ],
      },
      {
        tableName: "exception_case",
        tableComment: "监管问题单",
        businessRole: "FLOW",
        generationPriority: 3,
        fields: [
          pkField("case_id", "BIGINT", "问题单主键"),
          fkField("report_id", "BIGINT", "报表主键", "prudential_report", "report_id"),
          varcharField("issue_type", 64, "问题类型", "DICT_STAGE", false),
          varcharField("issue_level", 32, "问题级别", "DICT_STAGE", false),
          varcharField("disposal_status", 32, "处置状态", "DICT_STATUS", false),
          varcharField("checker_name", 64, "核查人员", "PERSON_NAME", false),
          datetimeField("disposed_at", "处置时间"),
        ],
      },
    ],
    dictTables: [
      dictTable("branch_type_dict", "机构类型字典", [["一级分行", "一级分行"], ["二级分行", "二级分行"], ["中心支行", "中心支行"], ["营业部", "营业部"], ["普惠金融中心", "普惠金融中心"]]),
      dictTable("report_code_dict", "监管报表字典", [["1104-G01", "资产质量报送"], ["1104-G21", "大额风险暴露报送"], ["1104-G31", "流动性风险报送"], ["EAST-贷款质量", "EAST贷款质量核查"], ["AML-大额交易", "反洗钱大额交易报送"]]),
    ],
    relations: [relation("reporting_branch", "branch_id", "prudential_report", "branch_id", "1:N"), relation("prudential_report", "report_id", "exception_case", "report_id", "1:N")],
    modelExplanation: "银行监管报送场景围绕机构、审慎报表和监管问题单构建，适合模拟监管报送和核查闭环。",
  };
}

function buildRichTrafficTemplate() {
  return {
    tables: [
      {
        tableName: "owner_profile",
        tableComment: "车主档案表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("owner_id", "BIGINT", "车主主键"),
          codeField("owner_code", "车主编码", "TEXT", true),
          varcharField("owner_name", 64, "车主姓名", "PERSON_NAME", false),
          varcharField("gender", 16, "性别", "TEXT"),
          varcharField("id_card_no", 18, "身份证号", "ID_CARD", false, true),
          varcharField("owner_mobile", 16, "车主手机号", "PHONE", false),
          varcharField("owner_email", 128, "车主邮箱", "EMAIL"),
          ...addRegionFields(),
          varcharField("residence_address", 255, "居住地址", "TEXT"),
          varcharField("occupation_name", 64, "职业名称", "TEXT"),
          varcharField("driver_license_type", 32, "准驾车型", "TEXT"),
          datetimeField("first_license_time", "初领证时间"),
          datetimeField("expire_license_time", "驾驶证到期时间"),
          varcharField("credit_status", 32, "信用状态", "DICT_STATUS"),
          intField("historical_violation_count", "历史违法次数"),
          intField("historical_accident_count", "历史事故次数"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "vehicle_archive",
        tableComment: "车辆档案表",
        businessRole: "MASTER",
        generationPriority: 2,
        fields: [
          pkField("vehicle_id", "BIGINT", "车辆主键"),
          fkField("owner_id", "BIGINT", "车主主键", "owner_profile", "owner_id"),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE", false, true),
          codeField("vehicle_vin", "车架号", "TEXT", true),
          codeField("engine_no", "发动机号"),
          varcharField("vehicle_type", 32, "车辆类型", "DICT_VEHICLE_TYPE", false),
          varcharField("brand_name", 64, "品牌名称", "COMPANY_NAME"),
          varcharField("model_name", 128, "车型名称", "TEXT"),
          varcharField("fuel_type", 32, "能源类型", "TEXT"),
          varcharField("color_name", 32, "车身颜色", "TEXT"),
          intField("seat_count", "座位数"),
          decimalField("load_capacity", "核载重量", "NUMBER"),
          codeField("register_city_code", "登记城市编码", "DICT_REGION"),
          varcharField("register_city_name", 64, "登记城市名称", "TEXT"),
          varcharField("plate_issue_org", 128, "号牌核发机关", "TEXT"),
          datetimeField("registered_at", "登记时间"),
          datetimeField("annual_inspection_due", "年检到期时间"),
          varcharField("insurance_status", 32, "保险状态", "DICT_STATUS"),
          varcharField("operation_type", 32, "营运类型", "TEXT"),
          codeField("device_id", "车载设备编号"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "registration_record",
        tableComment: "车辆登记流水表",
        businessRole: "FLOW",
        generationPriority: 3,
        fields: [
          pkField("registration_id", "BIGINT", "登记流水主键"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          fkField("owner_id", "BIGINT", "车主主键", "owner_profile", "owner_id"),
          codeField("registration_no", "登记流水号", "TEXT", true),
          varcharField("registration_type", 32, "登记类型", "TEXT"),
          datetimeField("registration_time", "登记时间"),
          varcharField("register_org_name", 128, "登记机构名称", "TEXT"),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
          varcharField("vehicle_type", 32, "车辆类型", "DICT_VEHICLE_TYPE"),
          varcharField("brand_name", 64, "品牌名称", "COMPANY_NAME"),
          varcharField("model_name", 128, "车型名称", "TEXT"),
          codeField("vehicle_vin", "车架号"),
          codeField("engine_no", "发动机号"),
          varcharField("owner_name", 64, "车主姓名", "PERSON_NAME"),
          varcharField("owner_mobile", 16, "车主手机号", "PHONE"),
          varcharField("approval_status", 32, "审批状态", "DICT_STATUS"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "violation_record",
        tableComment: "违法记录表",
        businessRole: "DETAIL",
        generationPriority: 4,
        fields: [
          pkField("violation_id", "BIGINT", "违法主键"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          fkField("owner_id", "BIGINT", "车主主键", "owner_profile", "owner_id"),
          codeField("violation_no", "违法流水号", "TEXT", true),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
          varcharField("vehicle_type", 32, "车辆类型", "DICT_VEHICLE_TYPE"),
          varcharField("violation_code", 32, "违法代码", "DICT_VIOLATION_CODE", false),
          varcharField("violation_desc", 128, "违法行为描述", "TEXT", false),
          numberField("violation_points", "INT", "记分", "NUMBER"),
          decimalField("fine_amount", "罚款金额"),
          varcharField("road_name", 128, "违法路段", "TEXT"),
          varcharField("direction_name", 64, "行驶方向", "TEXT"),
          varcharField("camera_name", 128, "抓拍设备", "TEXT"),
          varcharField("violation_status", 32, "处理状态", "DICT_STATUS"),
          datetimeField("capture_time", "抓拍时间"),
          datetimeField("notice_time", "告知时间"),
          datetimeField("handle_deadline", "处理截止时间"),
          varcharField("law_basis", 255, "法律依据", "TEXT"),
          varcharField("officer_name", 64, "执法人员", "PERSON_NAME"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "penalty_payment",
        tableComment: "处罚缴款表",
        businessRole: "FLOW",
        generationPriority: 5,
        fields: [
          pkField("payment_id", "BIGINT", "缴款主键"),
          fkField("violation_id", "BIGINT", "违法主键", "violation_record", "violation_id"),
          codeField("payment_no", "缴款流水号", "TEXT", true),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
          decimalField("receivable_amount", "应缴金额"),
          decimalField("paid_amount", "实缴金额"),
          varcharField("payment_channel", 32, "缴款渠道", "DICT_CHANNEL"),
          varcharField("payment_status", 32, "缴款状态", "DICT_STATUS"),
          datetimeField("payment_time", "缴款时间"),
          datetimeField("settlement_time", "清算时间"),
          varcharField("bank_name", 64, "缴款银行", "TEXT"),
          varcharField("payer_name", 64, "缴款人", "PERSON_NAME"),
          varcharField("payer_mobile", 16, "缴款人手机号", "PHONE"),
          codeField("receipt_no", "票据号", "TEXT", true),
          varcharField("refund_flag", 32, "退款标记", "DICT_STATUS"),
          varcharField("reconcile_status", 32, "对账状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "checkpoint_inspection",
        tableComment: "路检路查记录表",
        businessRole: "FLOW",
        generationPriority: 6,
        fields: [
          pkField("inspection_id", "BIGINT", "检查主键"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          varcharField("station_name", 128, "检查站名称", "TEXT", false),
          varcharField("road_name", 128, "道路名称", "TEXT"),
          varcharField("lane_no", 16, "车道号", "TEXT"),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
          varcharField("vehicle_type", 32, "车辆类型", "DICT_VEHICLE_TYPE"),
          varcharField("inspection_result", 32, "检查结果", "DICT_STATUS"),
          varcharField("problem_code", 64, "问题代码", "TEXT"),
          varcharField("problem_desc", 255, "问题描述", "TEXT"),
          varcharField("officer_name", 64, "执勤人员", "PERSON_NAME"),
          varcharField("assist_officer_name", 64, "协勤人员", "PERSON_NAME"),
          datetimeField("inspection_time", "检查时间"),
          datetimeField("release_time", "放行时间"),
          varcharField("body_camera_no", 64, "执法记录仪编号", "TEXT"),
          varcharField("evidence_no", 64, "证据编号", "TEXT"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "accident_case",
        tableComment: "事故案件表",
        businessRole: "DETAIL",
        generationPriority: 7,
        fields: [
          pkField("accident_id", "BIGINT", "事故主键"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          codeField("accident_no", "事故编号", "TEXT", true),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
          varcharField("accident_type", 32, "事故类型", "TEXT"),
          varcharField("accident_level", 32, "事故等级", "DICT_STAGE"),
          varcharField("road_name", 128, "事故路段", "TEXT"),
          varcharField("weather_desc", 64, "天气情况", "TEXT"),
          varcharField("road_condition", 64, "路面情况", "TEXT"),
          intField("injury_count", "伤人数"),
          intField("death_count", "死亡人数"),
          decimalField("loss_amount", "财产损失金额"),
          varcharField("liability_type", 32, "责任类型", "DICT_STATUS"),
          varcharField("case_status", 32, "案件状态", "DICT_STATUS"),
          datetimeField("occur_time", "发生时间"),
          datetimeField("report_time", "报警时间"),
          datetimeField("close_time", "结案时间"),
          varcharField("handle_officer", 64, "处理民警", "PERSON_NAME"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "dispatch_task",
        tableComment: "警情派单表",
        businessRole: "FLOW",
        generationPriority: 8,
        fields: [
          pkField("dispatch_id", "BIGINT", "派单主键"),
          codeField("dispatch_no", "派单编号", "TEXT", true),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          fkField("accident_id", "BIGINT", "事故主键", "accident_case", "accident_id"),
          varcharField("dispatch_type", 32, "派单类型", "TEXT"),
          varcharField("dispatch_status", 32, "派单状态", "DICT_STATUS"),
          varcharField("station_name", 128, "派单站点", "TEXT"),
          varcharField("target_road_name", 128, "目标路段", "TEXT"),
          varcharField("duty_team_name", 128, "值班班组", "TEXT"),
          varcharField("leader_name", 64, "带班人员", "PERSON_NAME"),
          varcharField("officer_name", 64, "处置人员", "PERSON_NAME"),
          datetimeField("dispatch_time", "派发时间"),
          datetimeField("accept_time", "接单时间"),
          datetimeField("arrive_time", "到场时间"),
          datetimeField("finish_time", "完成时间"),
          varcharField("priority_level", 32, "优先级", "DICT_STAGE"),
          varcharField("source_channel", 32, "来源渠道", "DICT_CHANNEL"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "patrol_log",
        tableComment: "巡逻日志表",
        businessRole: "LOG",
        generationPriority: 9,
        fields: [
          pkField("log_id", "BIGINT", "日志主键"),
          fkField("dispatch_id", "BIGINT", "派单主键", "dispatch_task", "dispatch_id"),
          fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
          codeField("log_no", "日志编号", "TEXT", true),
          varcharField("station_name", 128, "站点名称", "TEXT"),
          varcharField("road_name", 128, "巡逻路段", "TEXT"),
          varcharField("checkpoint_name", 128, "检查卡口", "TEXT"),
          varcharField("officer_name", 64, "执勤人员", "PERSON_NAME"),
          varcharField("event_type", 64, "事件类型", "TEXT"),
          varcharField("event_result", 32, "事件结果", "DICT_STATUS"),
          datetimeField("event_time", "事件时间"),
          varcharField("gps_track_id", 64, "轨迹编号", "TEXT"),
          decimalField("longitude", "经度", "NUMBER"),
          decimalField("latitude", "纬度", "NUMBER"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "enforcement_document",
        tableComment: "执法文书表",
        businessRole: "FLOW",
        generationPriority: 10,
        fields: [
          pkField("document_id", "BIGINT", "文书主键"),
          fkField("violation_id", "BIGINT", "违法主键", "violation_record", "violation_id"),
          fkField("inspection_id", "BIGINT", "检查主键", "checkpoint_inspection", "inspection_id"),
          codeField("document_no", "文书编号", "TEXT", true),
          varcharField("document_type", 64, "文书类型", "TEXT"),
          varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
          varcharField("owner_name", 64, "车主姓名", "PERSON_NAME"),
          varcharField("officer_name", 64, "执法人员", "PERSON_NAME"),
          varcharField("issue_org_name", 128, "出具机构", "TEXT"),
          datetimeField("issue_time", "出具时间"),
          datetimeField("serve_time", "送达时间"),
          varcharField("serve_mode", 32, "送达方式", "TEXT"),
          varcharField("sign_status", 32, "签收状态", "DICT_STATUS"),
          varcharField("appeal_flag", 32, "申诉标记", "DICT_STATUS"),
          codeField("archive_no", "归档编号"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
    ],
    dictTables: [
      dictTable("vehicle_type_dict", "车辆类型字典", [["SEDAN", "小型客车"], ["SUV", "运动型客车"], ["NEW_ENERGY", "新能源车"], ["TRUCK", "货运车辆"], ["BUS", "营运客车"]]),
      dictTable("violation_code_dict", "违法代码字典", [["1362", "闯红灯"], ["1625", "驾驶时拨打接听手持电话"], ["1302", "违法停车"], ["1116", "不按导向车道行驶"]]),
    ],
    relations: [
      relation("owner_profile", "owner_id", "vehicle_archive", "owner_id", "1:N"),
      relation("vehicle_archive", "vehicle_id", "registration_record", "vehicle_id", "1:N"),
      relation("vehicle_archive", "vehicle_id", "violation_record", "vehicle_id", "1:N"),
      relation("violation_record", "violation_id", "penalty_payment", "violation_id", "1:N"),
      relation("vehicle_archive", "vehicle_id", "checkpoint_inspection", "vehicle_id", "1:N"),
      relation("vehicle_archive", "vehicle_id", "accident_case", "vehicle_id", "1:N"),
      relation("accident_case", "accident_id", "dispatch_task", "accident_id", "1:N"),
      relation("dispatch_task", "dispatch_id", "patrol_log", "dispatch_id", "1:N"),
      relation("violation_record", "violation_id", "enforcement_document", "violation_id", "1:N"),
    ],
    modelExplanation: "增强交通治理场景围绕车主、车辆、登记、违法、缴款、检查、事故、派单、巡逻、文书构建完整治理链路。",
  };
}

function hasRequestedModule(profile, moduleKey) {
  return Array.isArray(profile?.requestedModules) && profile.requestedModules.includes(moduleKey);
}

function appendUniqueTables(target, tables) {
  (tables || []).forEach((table) => {
    if (!target.find((item) => item.tableName === table.tableName)) {
      target.push(table);
    }
  });
}

function appendUniqueDictTables(target, tables) {
  (tables || []).forEach((table) => {
    if (!target.find((item) => item.tableName === table.tableName)) {
      target.push(table);
    }
  });
}

function appendUniqueRelations(target, relations) {
  (relations || []).forEach((item) => {
    const exists = target.find((current) =>
      current.fromTable === item.fromTable
      && current.fromField === item.fromField
      && current.toTable === item.toTable
      && current.toField === item.toField
    );
    if (!exists) {
      target.push(item);
    }
  });
}

function buildDynamicModulesForProfile(profile) {
  const modules = { tables: [], dictTables: [], relations: [], explanations: [] };

  if (profile?.industry === "traffic") {
    if (hasRequestedModule(profile, "driver_training")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "driver_training_record",
          tableComment: "驾驶证学习记录表",
          businessRole: "FLOW",
          generationPriority: 11,
          fields: [
            pkField("training_id", "BIGINT", "学习记录主键"),
            fkField("owner_id", "BIGINT", "驾驶人主键", "owner_profile", "owner_id"),
            codeField("training_no", "学习记录编号", "TEXT", true),
            varcharField("school_name", 128, "驾校名称", "TEXT", false),
            varcharField("coach_name", 64, "教练姓名", "PERSON_NAME", false),
            varcharField("coach_mobile", 16, "教练手机号", "PHONE"),
            varcharField("training_vehicle_no", 16, "教学车辆号牌", "LICENSE_PLATE"),
            varcharField("training_license_type", 32, "学习准驾车型", "TEXT"),
            varcharField("subject_code", 32, "考试科目编码", "DICT_STAGE", false),
            varcharField("training_status", 32, "学习状态", "DICT_STATUS", false),
            datetimeField("enrolled_time", "报名时间"),
            datetimeField("plan_exam_time", "计划考试时间"),
            nullableDatetimeField("completed_time", "完成时间"),
            decimalField("total_hours", "累计学时", "NUMBER"),
            decimalField("valid_hours", "有效学时", "NUMBER"),
            decimalField("attendance_rate", "到课率", "NUMBER"),
            decimalField("exam_score", "模拟考试成绩", "NUMBER"),
            varcharField("exam_result", 32, "考试结果", "DICT_STATUS"),
            varcharField("archive_status", 32, "归档状态", "DICT_STATUS"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueDictTables(modules.dictTables, [
        dictTable("training_subject_dict", "驾考科目字典", [["KM1", "科目一"], ["KM2", "科目二"], ["KM3", "科目三"], ["KM4", "科目四"]]),
      ]);
      appendUniqueRelations(modules.relations, [
        relation("owner_profile", "owner_id", "driver_training_record", "owner_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充驾驶证学习记录模块");
    }

    if (hasRequestedModule(profile, "checkpoint_vehicle_pass")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "checkpoint_vehicle_pass_record",
          tableComment: "卡口过车记录表",
          businessRole: "LOG",
          generationPriority: 12,
          fields: [
            pkField("pass_id", "BIGINT", "过车记录主键"),
            fkField("vehicle_id", "BIGINT", "车辆主键", "vehicle_archive", "vehicle_id"),
            fkField("owner_id", "BIGINT", "驾驶人主键", "owner_profile", "owner_id"),
            codeField("pass_no", "过车流水号", "TEXT", true),
            codeField("checkpoint_code", "卡口编码", "DICT_REGION"),
            varcharField("checkpoint_name", 128, "卡口名称", "TEXT", false),
            varcharField("lane_no", 16, "车道号", "TEXT"),
            varcharField("direction_name", 64, "通行方向", "TEXT"),
            varcharField("plate_no", 16, "车牌号", "LICENSE_PLATE"),
            varcharField("vehicle_type", 32, "车辆类型", "DICT_VEHICLE_TYPE"),
            varcharField("plate_color", 32, "号牌颜色", "TEXT"),
            datetimeField("pass_time", "过车时间"),
            decimalField("pass_speed", "过车速度", "NUMBER"),
            decimalField("limit_speed", "限速值", "NUMBER"),
            varcharField("pass_result", 32, "过车结果", "DICT_STATUS"),
            intField("plate_match_flag", "套牌疑似标记"),
            intField("violation_flag", "违法疑似标记"),
            codeField("capture_device_no", "抓拍设备编号"),
            varcharField("image_uri", 255, "抓拍图片地址", "TEXT"),
            varcharField("travel_direction", 64, "行驶方向", "TEXT"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueDictTables(modules.dictTables, [
        dictTable("checkpoint_pass_result_dict", "卡口过车结果字典", [["PASS", "正常过车"], ["ALERT", "异常预警"], ["REVIEW", "人工复核"]]),
      ]);
      appendUniqueRelations(modules.relations, [
        relation("vehicle_archive", "vehicle_id", "checkpoint_vehicle_pass_record", "vehicle_id", "1:N"),
        relation("owner_profile", "owner_id", "checkpoint_vehicle_pass_record", "owner_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充卡口过车记录模块");
    }
  }

  if (profile?.industry === "bank_regulatory") {
    if (hasRequestedModule(profile, "customer_account")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "customer_account",
          tableComment: "客户账户台账表",
          businessRole: "MASTER",
          generationPriority: 11,
          fields: [
            pkField("account_id", "BIGINT", "账户主键"),
            fkField("branch_id", "BIGINT", "报送机构主键", "reporting_branch", "branch_id"),
            codeField("account_no", "账号", "TEXT", true),
            varcharField("account_type", 32, "账户类型", "DICT_STATUS", false),
            varcharField("customer_name", 128, "客户名称", "TEXT", false),
            varcharField("customer_type", 32, "客户类型", "DICT_STATUS"),
            varcharField("id_no", 32, "证件号码", "TEXT"),
            varcharField("mobile", 16, "联系电话", "PHONE"),
            varcharField("currency_code", 16, "币种", "TEXT"),
            datetimeField("open_date", "开户日期"),
            nullableDatetimeField("close_date", "销户日期"),
            varcharField("account_status", 32, "账户状态", "DICT_STATUS"),
            decimalField("balance_amount", "账户余额"),
            decimalField("available_amount", "可用余额"),
            decimalField("freeze_amount", "冻结金额"),
            varcharField("risk_level", 32, "风险等级", "DICT_STAGE"),
            varcharField("manager_name", 64, "客户经理", "PERSON_NAME"),
            varcharField("region_code", 32, "归属区域编码", "DICT_REGION"),
            varcharField("region_name", 64, "归属区域名称", "TEXT"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueRelations(modules.relations, [
        relation("reporting_branch", "branch_id", "customer_account", "branch_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充客户账户台账模块");
    }

    if (hasRequestedModule(profile, "loan_contract")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "loan_contract_record",
          tableComment: "贷款合同记录表",
          businessRole: "DETAIL",
          generationPriority: 12,
          fields: [
            pkField("contract_id", "BIGINT", "合同主键"),
            fkField("branch_id", "BIGINT", "报送机构主键", "reporting_branch", "branch_id"),
            codeField("contract_no", "贷款合同号", "TEXT", true),
            varcharField("borrower_name", 128, "借款人名称", "TEXT", false),
            varcharField("borrower_type", 32, "借款人类型", "DICT_STATUS"),
            varcharField("loan_type", 32, "贷款类型", "DICT_STATUS"),
            decimalField("loan_amount", "贷款金额"),
            decimalField("interest_rate", "贷款利率", "NUMBER"),
            datetimeField("disbursement_date", "放款日期"),
            datetimeField("maturity_date", "到期日期"),
            decimalField("outstanding_amount", "贷款余额"),
            intField("overdue_days", "逾期天数"),
            varcharField("collateral_type", 32, "担保方式", "TEXT"),
            varcharField("repayment_method", 32, "还款方式", "TEXT"),
            varcharField("contract_status", 32, "合同状态", "DICT_STATUS"),
            varcharField("manager_name", 64, "经办客户经理", "PERSON_NAME"),
            varcharField("risk_classification", 32, "五级分类", "DICT_STAGE"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueRelations(modules.relations, [
        relation("reporting_branch", "branch_id", "loan_contract_record", "branch_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充贷款合同记录模块");
    }
  }

  if (profile?.industry === "ecommerce") {
    if (hasRequestedModule(profile, "live_stream")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "live_stream_session",
          tableComment: "直播带货场次表",
          businessRole: "FLOW",
          generationPriority: 11,
          fields: [
            pkField("session_id", "BIGINT", "场次主键"),
            fkField("store_id", "BIGINT", "门店主键", "merchant_store", "store_id"),
            codeField("session_no", "直播场次编号", "TEXT", true),
            varcharField("host_name", 64, "主播姓名", "PERSON_NAME", false),
            varcharField("channel_name", 64, "直播渠道", "TEXT"),
            datetimeField("start_time", "开播时间"),
            datetimeField("end_time", "结束时间"),
            intField("viewer_count", "观看人数"),
            intField("order_count", "成交订单数"),
            decimalField("order_amount", "成交金额"),
            decimalField("refund_amount", "退款金额"),
            intField("product_count", "上架商品数"),
            varcharField("session_status", 32, "场次状态", "DICT_STATUS"),
            varcharField("traffic_source", 64, "流量来源", "TEXT"),
            decimalField("conversion_rate", "转化率", "NUMBER"),
            intField("uv_count", "独立访客数"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueRelations(modules.relations, [
        relation("merchant_store", "store_id", "live_stream_session", "store_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充直播带货场次模块");
    }

    if (hasRequestedModule(profile, "enterprise_procurement")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "enterprise_procurement_order",
          tableComment: "企业采购订单表",
          businessRole: "DETAIL",
          generationPriority: 12,
          fields: [
            pkField("procurement_id", "BIGINT", "采购订单主键"),
            fkField("store_id", "BIGINT", "门店主键", "merchant_store", "store_id"),
            fkField("customer_id", "BIGINT", "客户主键", "customer_profile", "customer_id"),
            codeField("procurement_no", "采购订单号", "TEXT", true),
            varcharField("buyer_company_name", 128, "采购企业名称", "COMPANY_NAME", false),
            varcharField("buyer_contact", 64, "采购联系人", "PERSON_NAME"),
            varcharField("buyer_mobile", 16, "采购联系人手机号", "PHONE"),
            codeField("contract_no", "采购合同号", "TEXT", true),
            varcharField("order_status", 32, "采购状态", "DICT_STATUS"),
            datetimeField("signed_time", "签约时间"),
            datetimeField("delivery_plan_time", "计划交付时间"),
            datetimeField("settlement_time", "结算时间"),
            decimalField("order_amount", "采购金额"),
            decimalField("paid_amount", "已付款金额"),
            varcharField("invoice_type", 32, "发票类型", "TEXT"),
            intField("item_count", "商品件数"),
            codeField("warehouse_code", "出库仓编码"),
            varcharField("delivery_status", 32, "交付状态", "DICT_STATUS"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueRelations(modules.relations, [
        relation("merchant_store", "store_id", "enterprise_procurement_order", "store_id", "1:N"),
        relation("customer_profile", "customer_id", "enterprise_procurement_order", "customer_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充企业采购订单模块");
    }
  }

  if (profile?.industry === "education") {
    if (hasRequestedModule(profile, "parent_communication")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "parent_communication_record",
          tableComment: "家校沟通记录表",
          businessRole: "FLOW",
          generationPriority: 11,
          fields: [
            pkField("communication_id", "BIGINT", "沟通记录主键"),
            fkField("student_id", "BIGINT", "学生主键", "student_profile", "student_id"),
            fkField("guardian_id", "BIGINT", "监护人主键", "guardian_contact", "guardian_id"),
            codeField("message_no", "消息编号", "TEXT", true),
            varcharField("message_channel", 32, "沟通渠道", "DICT_STATUS"),
            varcharField("message_type", 32, "沟通类型", "DICT_STAGE"),
            varcharField("title", 128, "消息标题", "TEXT"),
            varcharField("content_summary", 255, "内容摘要", "TEXT"),
            varcharField("sender_name", 64, "发送人", "PERSON_NAME"),
            datetimeField("send_time", "发送时间"),
            nullableDatetimeField("read_time", "阅读时间"),
            nullableDatetimeField("reply_time", "回复时间"),
            varcharField("reply_status", 32, "回复状态", "DICT_STATUS"),
            varcharField("urgency_level", 32, "紧急程度", "DICT_STAGE"),
            varcharField("handle_teacher", 64, "经办教师", "PERSON_NAME"),
            varcharField("archive_status", 32, "归档状态", "DICT_STATUS"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueRelations(modules.relations, [
        relation("student_profile", "student_id", "parent_communication_record", "student_id", "1:N"),
        relation("guardian_contact", "guardian_id", "parent_communication_record", "guardian_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充家校沟通记录模块");
    }

    if (hasRequestedModule(profile, "dormitory_management")) {
      appendUniqueTables(modules.tables, [
        {
          tableName: "dormitory_resident_record",
          tableComment: "宿舍住宿记录表",
          businessRole: "DETAIL",
          generationPriority: 12,
          fields: [
            pkField("resident_id", "BIGINT", "住宿记录主键"),
            fkField("student_id", "BIGINT", "学生主键", "student_profile", "student_id"),
            fkField("campus_id", "BIGINT", "校区主键", "campus_dimension", "campus_id"),
            codeField("resident_no", "住宿记录号", "TEXT", true),
            varcharField("dormitory_no", 32, "宿舍号", "TEXT"),
            varcharField("building_no", 32, "楼栋号", "TEXT"),
            varcharField("room_no", 32, "房间号", "TEXT"),
            varcharField("bed_no", 32, "床位号", "TEXT"),
            datetimeField("checkin_time", "入住时间"),
            nullableDatetimeField("checkout_time", "退宿时间"),
            varcharField("resident_status", 32, "住宿状态", "DICT_STATUS"),
            varcharField("manager_name", 64, "宿管姓名", "PERSON_NAME"),
            decimalField("electricity_balance", "电费余额"),
            decimalField("hygiene_score", "卫生评分", "NUMBER"),
            decimalField("discipline_score", "纪律评分", "NUMBER"),
            intField("weekend_leave_flag", "周末离宿标记"),
            codeField("access_card_no", "住宿门禁卡号"),
            varcharField("remark", 255, "备注", "TEXT"),
            ...addAuditFields(),
          ],
        },
      ]);
      appendUniqueRelations(modules.relations, [
        relation("student_profile", "student_id", "dormitory_resident_record", "student_id", "1:N"),
        relation("campus_dimension", "campus_id", "dormitory_resident_record", "campus_id", "1:N"),
      ]);
      modules.explanations.push("按场景描述补充宿舍住宿记录模块");
    }
  }

  return modules;
}

function augmentTemplateByProfile(template, profile) {
  const nextTemplate = {
    ...template,
    tables: [...(template.tables || [])],
    dictTables: [...(template.dictTables || [])],
    relations: [...(template.relations || [])],
  };
  const modules = buildDynamicModulesForProfile(profile);
  appendUniqueTables(nextTemplate.tables, modules.tables);
  appendUniqueDictTables(nextTemplate.dictTables, modules.dictTables);
  appendUniqueRelations(nextTemplate.relations, modules.relations);
  if (modules.explanations.length > 0) {
    nextTemplate.modelExplanation = `${template.modelExplanation || ""}；${modules.explanations.join("；")}`;
  }
  return nextTemplate;
}

function buildRichBankRegulatoryTemplate() {
  return {
    tables: [
      {
        tableName: "institution_dimension",
        tableComment: "法人机构维表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("institution_id", "BIGINT", "机构主键"),
          codeField("institution_code", "机构编码", "TEXT", true),
          varcharField("institution_name", 128, "机构名称", "COMPANY_NAME", false),
          varcharField("institution_type", 32, "机构类型", "TEXT"),
          varcharField("license_no", 64, "金融许可证号", "TEXT", false, true),
          varcharField("org_code", 64, "统一社会信用代码", "TEXT", true),
          ...addRegionFields(),
          varcharField("regulator_name", 128, "属地监管机构", "TEXT"),
          varcharField("institution_status", 32, "机构状态", "DICT_STATUS"),
          datetimeField("established_at", "设立时间"),
          datetimeField("business_start_at", "开业时间"),
          decimalField("registered_capital", "注册资本"),
          decimalField("employee_count", "员工人数", "NUMBER"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "reporting_branch",
        tableComment: "报送机构表",
        businessRole: "MASTER",
        generationPriority: 2,
        fields: [
          pkField("branch_id", "BIGINT", "机构主键"),
          fkField("institution_id", "BIGINT", "法人机构主键", "institution_dimension", "institution_id"),
          codeField("branch_code", "机构编码", "TEXT", true),
          varcharField("branch_name", 128, "机构名称", "COMPANY_NAME", false),
          varcharField("branch_type", 32, "机构类型", "DICT_BRANCH_TYPE", false),
          codeField("region_code", "地区编码", "DICT_REGION"),
          varcharField("region_name", 64, "地区名称", "TEXT"),
          varcharField("governance_level", 32, "管理层级", "TEXT"),
          varcharField("reporting_flag", 32, "报送标记", "DICT_STATUS"),
          datetimeField("established_at", "设立时间"),
          decimalField("asset_scale", "资产规模"),
          decimalField("loan_scale", "贷款规模"),
          decimalField("deposit_scale", "存款规模"),
          ...addContactFields(),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "reporting_contact",
        tableComment: "报送联系人表",
        businessRole: "DETAIL",
        generationPriority: 3,
        fields: [
          pkField("contact_id", "BIGINT", "联系人主键"),
          fkField("branch_id", "BIGINT", "机构主键", "reporting_branch", "branch_id"),
          varcharField("contact_name", 64, "联系人姓名", "PERSON_NAME", false),
          varcharField("contact_role", 64, "岗位名称", "TEXT"),
          varcharField("contact_mobile", 16, "联系人手机号", "PHONE"),
          varcharField("contact_email", 128, "联系人邮箱", "EMAIL"),
          varcharField("department_name", 128, "部门名称", "TEXT"),
          varcharField("duty_scope", 128, "职责范围", "TEXT"),
          intField("primary_contact_flag", "主联系人标记"),
          varcharField("office_phone", 16, "办公联系人手机号", "PHONE"),
          datetimeField("onboard_time", "上岗时间"),
          varcharField("backup_contact_name", 64, "备份联系人", "PERSON_NAME"),
          varcharField("backup_contact_mobile", 16, "备份联系人手机号", "PHONE"),
          intField("report_deadline_day", "报送截止日"),
          varcharField("contact_status", 32, "联系人状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "prudential_report",
        tableComment: "审慎监管报表",
        businessRole: "DETAIL",
        generationPriority: 4,
        fields: [
          pkField("report_id", "BIGINT", "报表主键"),
          fkField("branch_id", "BIGINT", "机构主键", "reporting_branch", "branch_id"),
          codeField("report_code", "报表编码", "DICT_REPORT_CODE"),
          varcharField("report_name", 128, "报表名称", "TEXT"),
          varcharField("report_period", 32, "报送期间", "TEXT"),
          varcharField("report_freq", 32, "报送频率", "TEXT"),
          decimalField("total_assets", "总资产"),
          decimalField("loan_balance", "贷款余额"),
          decimalField("deposit_balance", "存款余额"),
          decimalField("capital_adequacy_ratio", "资本充足率", "NUMBER"),
          decimalField("tier1_capital_ratio", "一级资本充足率", "NUMBER"),
          decimalField("core_tier1_ratio", "核心一级资本充足率", "NUMBER"),
          decimalField("liquidity_coverage_ratio", "流动性覆盖率", "NUMBER"),
          decimalField("npl_ratio", "不良贷款率", "NUMBER"),
          decimalField("provision_coverage_ratio", "拨备覆盖率", "NUMBER"),
          decimalField("large_exposure_ratio", "大额风险暴露比例", "NUMBER"),
          varcharField("report_status", 32, "报送状态", "DICT_STATUS"),
          datetimeField("submit_time", "提交时间"),
          datetimeField("receive_time", "接收时间"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "report_metric_item",
        tableComment: "报表指标明细表",
        businessRole: "FLOW",
        generationPriority: 5,
        fields: [
          pkField("metric_id", "BIGINT", "指标主键"),
          fkField("report_id", "BIGINT", "报表主键", "prudential_report", "report_id"),
          codeField("metric_code", "指标编码", "TEXT"),
          varcharField("metric_name", 128, "指标名称", "TEXT"),
          varcharField("metric_category", 64, "指标分类", "TEXT"),
          decimalField("metric_value", "指标值", "NUMBER"),
          varcharField("metric_unit", 32, "指标单位", "TEXT"),
          decimalField("warning_threshold", "预警阈值", "NUMBER"),
          decimalField("benchmark_value", "基准值", "NUMBER"),
          intField("warning_flag", "预警标记"),
          varcharField("metric_status", 32, "指标状态", "DICT_STATUS"),
          datetimeField("calculated_at", "计算时间"),
          varcharField("metric_source_system", 64, "指标来源系统", "TEXT"),
          varcharField("metric_owner_name", 64, "指标责任人", "PERSON_NAME"),
          decimalField("deviation_rate", "偏离率", "NUMBER"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "risk_exposure_snapshot",
        tableComment: "风险暴露快照表",
        businessRole: "FLOW",
        generationPriority: 6,
        fields: [
          pkField("snapshot_id", "BIGINT", "快照主键"),
          fkField("branch_id", "BIGINT", "机构主键", "reporting_branch", "branch_id"),
          varcharField("snapshot_period", 32, "快照期间", "TEXT"),
          decimalField("credit_risk_exposure", "信用风险暴露"),
          decimalField("market_risk_exposure", "市场风险暴露"),
          decimalField("operational_risk_exposure", "操作风险暴露"),
          decimalField("liquidity_gap_amount", "流动性缺口"),
          decimalField("concentration_ratio", "集中度比例", "NUMBER"),
          varcharField("risk_level", 32, "风险级别", "DICT_STATUS"),
          datetimeField("snapshot_time", "快照时间"),
          varcharField("risk_owner_department", 128, "风险归口部门", "TEXT"),
          varcharField("stress_test_result", 64, "压力测试结果", "TEXT"),
          decimalField("capital_buffer_amount", "资本缓冲金额"),
          varcharField("early_warning_level", 32, "预警等级", "DICT_STATUS"),
          varcharField("disposal_suggestion", 255, "处置建议", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "anti_money_alert",
        tableComment: "反洗钱预警表",
        businessRole: "FLOW",
        generationPriority: 7,
        fields: [
          pkField("alert_id", "BIGINT", "预警主键"),
          fkField("branch_id", "BIGINT", "机构主键", "reporting_branch", "branch_id"),
          codeField("alert_no", "预警编号", "TEXT", true),
          varcharField("alert_type", 64, "预警类型", "TEXT"),
          decimalField("transaction_amount", "交易金额"),
          varcharField("currency_code", 32, "币种", "TEXT"),
          varcharField("counterparty_name", 128, "交易对手名称", "COMPANY_NAME"),
          varcharField("alert_status", 32, "预警状态", "DICT_STATUS"),
          varcharField("review_result", 32, "审核结果", "DICT_STATUS"),
          datetimeField("alert_time", "预警时间"),
          datetimeField("review_time", "审核时间"),
          varcharField("customer_name", 128, "客户名称", "COMPANY_NAME"),
          codeField("customer_no", "客户编号", "TEXT"),
          varcharField("counterparty_bank_name", 128, "对手银行名称", "COMPANY_NAME"),
          varcharField("report_required_status", 32, "是否需上报", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "exception_case",
        tableComment: "监管问题单",
        businessRole: "DETAIL",
        generationPriority: 8,
        fields: [
          pkField("case_id", "BIGINT", "问题单主键"),
          fkField("report_id", "BIGINT", "报表主键", "prudential_report", "report_id"),
          codeField("case_no", "问题单编号", "TEXT", true),
          varcharField("issue_type", 64, "问题类型", "TEXT"),
          varcharField("issue_level", 32, "问题级别", "DICT_STATUS"),
          varcharField("disposal_status", 32, "处置状态", "DICT_STATUS"),
          varcharField("checker_name", 64, "核查人员", "PERSON_NAME"),
          varcharField("owner_department", 128, "责任部门", "TEXT"),
          varcharField("issue_desc", 255, "问题描述", "TEXT"),
          datetimeField("identified_at", "识别时间"),
          datetimeField("due_at", "整改截止时间"),
          datetimeField("disposed_at", "处置时间"),
          codeField("regulator_feedback_no", "监管反馈编号", "TEXT"),
          varcharField("rectification_status", 32, "整改标记", "DICT_STATUS"),
          varcharField("recheck_result", 32, "复核结果", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "rectification_task",
        tableComment: "整改任务表",
        businessRole: "FLOW",
        generationPriority: 9,
        fields: [
          pkField("task_id", "BIGINT", "任务主键"),
          fkField("case_id", "BIGINT", "问题单主键", "exception_case", "case_id"),
          codeField("task_no", "整改任务号", "TEXT", true),
          varcharField("task_type", 64, "任务类型", "TEXT"),
          varcharField("task_status", 32, "任务状态", "DICT_STATUS"),
          varcharField("owner_name", 64, "责任人", "PERSON_NAME"),
          varcharField("owner_mobile", 16, "责任人手机号", "PHONE"),
          varcharField("owner_department", 128, "责任部门", "TEXT"),
          datetimeField("create_time", "创建时间"),
          datetimeField("start_time", "开始时间"),
          datetimeField("finish_time", "完成时间"),
          varcharField("task_priority", 32, "任务优先级", "DICT_STATUS"),
          datetimeField("due_date", "任务截止时间"),
          varcharField("accept_result", 32, "受理结果", "DICT_STATUS"),
          varcharField("verify_result", 32, "验证结果", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "submission_log",
        tableComment: "报送流水日志",
        businessRole: "LOG",
        generationPriority: 10,
        fields: [
          pkField("log_id", "BIGINT", "日志主键"),
          fkField("report_id", "BIGINT", "报表主键", "prudential_report", "report_id"),
          codeField("submit_batch_no", "报送批次号", "TEXT", true),
          varcharField("submit_channel", 32, "报送渠道", "DICT_CHANNEL"),
          varcharField("log_status", 32, "日志状态", "DICT_STATUS"),
          varcharField("message_type", 64, "消息类型", "TEXT"),
          varcharField("message_summary", 255, "消息摘要", "TEXT"),
          datetimeField("event_time", "事件时间"),
          codeField("receive_code", "接收回执码", "TEXT"),
          varcharField("receive_message", 255, "接收回执信息", "TEXT"),
          intField("retry_count", "重试次数"),
          varcharField("operator_name", 64, "操作人", "PERSON_NAME"),
          codeField("trace_id", "链路追踪号", "TEXT"),
          codeField("payload_checksum", "报文校验码", "TEXT"),
          varcharField("archive_status", 32, "归档状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "approval_flow",
        tableComment: "审批流转表",
        businessRole: "FLOW",
        generationPriority: 11,
        fields: [
          pkField("approval_id", "BIGINT", "审批主键"),
          fkField("report_id", "BIGINT", "报表主键", "prudential_report", "report_id"),
          codeField("approval_no", "审批编号", "TEXT", true),
          varcharField("approval_node", 64, "审批节点", "TEXT"),
          varcharField("approver_name", 64, "审批人", "PERSON_NAME"),
          varcharField("approval_result", 32, "审批结果", "DICT_STATUS"),
          datetimeField("approval_time", "审批时间"),
          varcharField("approval_comment", 255, "审批意见", "TEXT"),
          varcharField("next_node", 64, "下一节点", "TEXT"),
          varcharField("node_status", 32, "节点状态", "DICT_STATUS"),
          varcharField("approver_department", 128, "审批部门", "TEXT"),
          varcharField("escalation_status", 32, "升级状态", "DICT_STATUS"),
          varcharField("archive_status", 32, "归档状态", "DICT_STATUS"),
          varcharField("callback_status", 32, "回执状态", "DICT_STATUS"),
          codeField("process_instance_no", "流程实例号", "TEXT"),
          ...addAuditFields(),
        ],
      },
    ],
    dictTables: [
      dictTable("branch_type_dict", "机构类型字典", [["一级分行", "一级分行"], ["二级分行", "二级分行"], ["营业部", "营业部"]]),
      dictTable("report_code_dict", "报表编码字典", [["1104-G01", "资产质量报送"], ["1104-G31", "流动性风险报送"], ["EAST-贷款质量", "EAST贷款质量核查"]]),
    ],
    relations: [
      relation("institution_dimension", "institution_id", "reporting_branch", "institution_id", "1:N"),
      relation("reporting_branch", "branch_id", "reporting_contact", "branch_id", "1:N"),
      relation("reporting_branch", "branch_id", "prudential_report", "branch_id", "1:N"),
      relation("prudential_report", "report_id", "report_metric_item", "report_id", "1:N"),
      relation("reporting_branch", "branch_id", "risk_exposure_snapshot", "branch_id", "1:N"),
      relation("reporting_branch", "branch_id", "anti_money_alert", "branch_id", "1:N"),
      relation("prudential_report", "report_id", "exception_case", "report_id", "1:N"),
      relation("exception_case", "case_id", "rectification_task", "case_id", "1:N"),
      relation("prudential_report", "report_id", "submission_log", "report_id", "1:N"),
      relation("prudential_report", "report_id", "approval_flow", "report_id", "1:N"),
    ],
    modelExplanation: "增强银行监管报送场景围绕法人机构、报送机构、监管报表、风险快照、反洗钱预警、问题单和整改流转构建完整链路。",
  };
}

function buildRichFinanceFundTemplate() {
  return {
    tables: [
      {
        tableName: "fund_product",
        tableComment: "基金产品表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("fund_id", "BIGINT", "基金主键"),
          codeField("fund_code", "基金代码", "TEXT", true),
          varcharField("fund_name", 128, "基金名称", "TEXT", false),
          varcharField("fund_type", 32, "基金类型", "DICT_STAGE"),
          varcharField("risk_level", 32, "风险等级", "DICT_STAGE"),
          varcharField("management_company", 128, "基金公司", "COMPANY_NAME"),
          varcharField("custodian_bank", 128, "托管银行", "COMPANY_NAME"),
          varcharField("investment_style", 64, "投资风格", "TEXT"),
          varcharField("currency_code", 16, "币种", "TEXT"),
          datetimeField("established_at", "成立日期"),
          datetimeField("open_date", "开放日期"),
          datetimeField("close_date", "封闭到期日"),
          decimalField("management_fee_rate", "管理费率", "NUMBER"),
          decimalField("custody_fee_rate", "托管费率", "NUMBER"),
          decimalField("initial_nav", "初始净值", "NUMBER"),
          decimalField("latest_scale_amount", "最新规模"),
          intField("holder_count", "持有人数量"),
          varcharField("status", 32, "产品状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "fund_account",
        tableComment: "基金账户表",
        businessRole: "MASTER",
        generationPriority: 2,
        fields: [
          pkField("account_id", "BIGINT", "账户主键"),
          codeField("account_no", "账户编号", "TEXT", true),
          varcharField("investor_name", 128, "投资者名称", "TEXT", false),
          varcharField("investor_type", 32, "投资者类型", "DICT_STAGE"),
          varcharField("certificate_type", 32, "证件类型", "TEXT"),
          varcharField("certificate_no", 64, "证件号码", "TEXT", false, true),
          varcharField("mobile", 16, "手机号", "PHONE"),
          varcharField("email", 128, "邮箱", "EMAIL"),
          ...addRegionFields(),
          varcharField("open_channel", 32, "开户渠道", "DICT_CHANNEL"),
          varcharField("risk_assessment_level", 32, "风险测评等级", "DICT_STAGE"),
          datetimeField("open_time", "开户时间"),
          datetimeField("last_trade_time", "最后交易时间"),
          decimalField("total_holding_amount", "总持有金额"),
          decimalField("available_balance", "可用余额"),
          decimalField("frozen_amount", "冻结金额"),
          varcharField("account_status", 32, "账户状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "fund_subscription_order",
        tableComment: "基金申购订单表",
        businessRole: "DETAIL",
        generationPriority: 3,
        fields: [
          pkField("subscription_id", "BIGINT", "申购订单主键"),
          fkField("fund_id", "BIGINT", "基金主键", "fund_product", "fund_id"),
          fkField("account_id", "BIGINT", "账户主键", "fund_account", "account_id"),
          codeField("subscription_no", "申购订单号", "TEXT", true),
          varcharField("channel_code", 32, "交易渠道", "DICT_CHANNEL"),
          datetimeField("apply_time", "申请时间"),
          datetimeField("confirm_time", "确认时间"),
          datetimeField("settlement_time", "结算时间"),
          decimalField("apply_amount", "申请金额"),
          decimalField("confirm_amount", "确认金额"),
          decimalField("subscription_fee", "申购费"),
          decimalField("confirm_share", "确认份额", "NUMBER"),
          decimalField("apply_nav", "申请净值", "NUMBER"),
          varcharField("order_status", 32, "订单状态", "DICT_STATUS"),
          varcharField("payment_status", 32, "支付状态", "DICT_STATUS"),
          varcharField("order_source_system", 64, "订单来源系统", "TEXT"),
          varcharField("sales_agent", 128, "销售机构", "TEXT"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "fund_redemption_order",
        tableComment: "基金赎回订单表",
        businessRole: "DETAIL",
        generationPriority: 4,
        fields: [
          pkField("redemption_id", "BIGINT", "赎回订单主键"),
          fkField("fund_id", "BIGINT", "基金主键", "fund_product", "fund_id"),
          fkField("account_id", "BIGINT", "账户主键", "fund_account", "account_id"),
          codeField("redemption_no", "赎回订单号", "TEXT", true),
          datetimeField("apply_time", "申请时间"),
          datetimeField("confirm_time", "确认时间"),
          datetimeField("payment_time", "到账时间"),
          decimalField("apply_share", "申请份额", "NUMBER"),
          decimalField("confirm_share", "确认份额", "NUMBER"),
          decimalField("confirm_amount", "确认金额"),
          decimalField("fee_amount", "手续费"),
          decimalField("exit_nav", "赎回净值", "NUMBER"),
          intField("holding_days", "持有天数"),
          varcharField("order_status", 32, "订单状态", "DICT_STATUS"),
          varcharField("payment_status", 32, "到账状态", "DICT_STATUS"),
          varcharField("bank_account_mask", 64, "到账银行卡脱敏", "TEXT"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "fund_nav_snapshot",
        tableComment: "基金净值快照表",
        businessRole: "FLOW",
        generationPriority: 5,
        fields: [
          pkField("snapshot_id", "BIGINT", "净值快照主键"),
          fkField("fund_id", "BIGINT", "基金主键", "fund_product", "fund_id"),
          codeField("nav_date", "净值日期", "TEXT"),
          decimalField("unit_nav", "单位净值", "NUMBER"),
          decimalField("acc_nav", "累计净值", "NUMBER"),
          decimalField("daily_change_rate", "日涨跌幅", "NUMBER"),
          decimalField("subscription_scale", "申购规模"),
          decimalField("redemption_scale", "赎回规模"),
          decimalField("net_inflow_amount", "净申购金额"),
          decimalField("total_asset_amount", "总资产"),
          decimalField("stock_position_ratio", "股票仓位", "NUMBER"),
          decimalField("bond_position_ratio", "债券仓位", "NUMBER"),
          decimalField("cash_ratio", "现金比例", "NUMBER"),
          intField("holder_count", "持有人数量"),
          varcharField("pricing_status", 32, "估值状态", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "fund_trading_flow",
        tableComment: "基金交易流水表",
        businessRole: "LOG",
        generationPriority: 6,
        fields: [
          pkField("trade_flow_id", "BIGINT", "交易流水主键"),
          fkField("fund_id", "BIGINT", "基金主键", "fund_product", "fund_id"),
          fkField("account_id", "BIGINT", "账户主键", "fund_account", "account_id"),
          codeField("trade_flow_no", "交易流水号", "TEXT", true),
          varcharField("trade_type", 32, "交易类型", "DICT_STAGE"),
          varcharField("channel_code", 32, "交易渠道", "DICT_CHANNEL"),
          datetimeField("trade_time", "交易时间"),
          datetimeField("confirm_time", "确认时间"),
          decimalField("trade_amount", "交易金额"),
          decimalField("trade_share", "交易份额", "NUMBER"),
          decimalField("fee_amount", "手续费"),
          decimalField("post_trade_holding", "交易后持有金额"),
          varcharField("trade_status", 32, "交易状态", "DICT_STATUS"),
          varcharField("operator_name", 64, "操作员", "PERSON_NAME"),
          varcharField("trade_source_system", 64, "交易来源系统", "TEXT"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
    ],
    dictTables: [
      dictTable("fund_type_dict", "基金类型字典", [["EQUITY", "股票型"], ["BOND", "债券型"], ["MIXED", "混合型"], ["INDEX", "指数型"]]),
      dictTable("fund_risk_level_dict", "基金风险等级字典", [["R1", "低风险"], ["R2", "中低风险"], ["R3", "中风险"], ["R4", "中高风险"], ["R5", "高风险"]]),
    ],
    relations: [
      relation("fund_product", "fund_id", "fund_subscription_order", "fund_id", "1:N"),
      relation("fund_account", "account_id", "fund_subscription_order", "account_id", "1:N"),
      relation("fund_product", "fund_id", "fund_redemption_order", "fund_id", "1:N"),
      relation("fund_account", "account_id", "fund_redemption_order", "account_id", "1:N"),
      relation("fund_product", "fund_id", "fund_nav_snapshot", "fund_id", "1:N"),
      relation("fund_product", "fund_id", "fund_trading_flow", "fund_id", "1:N"),
      relation("fund_account", "account_id", "fund_trading_flow", "account_id", "1:N"),
    ],
    modelExplanation: "金融基金场景围绕基金产品、投资者账户、申购赎回、净值快照和交易流水构建完整投资业务链路。",
  };
}

function buildRichLogisticsExpressTemplate() {
  return {
    tables: [
      {
        tableName: "logistics_waybill",
        tableComment: "快递运单表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("waybill_id", "BIGINT", "运单主键"),
          codeField("waybill_no", "运单号", "TEXT", true),
          varcharField("express_company", 64, "快递公司", "COMPANY_NAME"),
          varcharField("transport_mode", 32, "运输方式", "DICT_STAGE"),
          varcharField("sender_name", 64, "寄件人", "PERSON_NAME"),
          varcharField("sender_mobile", 16, "寄件人手机号", "PHONE"),
          varcharField("receiver_name", 64, "收件人", "PERSON_NAME"),
          varcharField("receiver_mobile", 16, "收件人手机号", "PHONE"),
          ...addRegionFields(),
          varcharField("pickup_address", 255, "寄件地址", "TEXT"),
          varcharField("delivery_address", 255, "收件地址", "TEXT"),
          decimalField("weight_kg", "重量", "NUMBER"),
          decimalField("volume_cm3", "体积", "NUMBER"),
          decimalField("freight_amount", "运费"),
          varcharField("waybill_status", 32, "运单状态", "DICT_STATUS"),
          datetimeField("create_time", "创建时间"),
          datetimeField("collect_time", "揽收时间"),
          datetimeField("delivery_deadline", "承诺时效"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "logistics_package_item",
        tableComment: "快递包裹明细表",
        businessRole: "DETAIL",
        generationPriority: 2,
        fields: [
          pkField("package_id", "BIGINT", "包裹主键"),
          fkField("waybill_id", "BIGINT", "运单主键", "logistics_waybill", "waybill_id"),
          codeField("package_no", "包裹号", "TEXT", true),
          varcharField("item_category", 64, "物品分类", "TEXT"),
          varcharField("item_name", 128, "物品名称", "TEXT"),
          intField("item_quantity", "数量"),
          decimalField("item_weight_kg", "单件重量", "NUMBER"),
          decimalField("declared_amount", "声明价值"),
          varcharField("package_type", 32, "包装类型", "TEXT"),
          varcharField("fragile_flag", 32, "易碎标记", "DICT_STATUS"),
          varcharField("temperature_require", 32, "温控要求", "TEXT"),
          varcharField("security_check_status", 32, "安检状态", "DICT_STATUS"),
          varcharField("insurance_flag", 32, "保价标记", "DICT_STATUS"),
          decimalField("insured_amount", "保价金额"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "logistics_delivery_route",
        tableComment: "快递线路规划表",
        businessRole: "MASTER",
        generationPriority: 3,
        fields: [
          pkField("route_id", "BIGINT", "线路主键"),
          codeField("route_code", "线路编码", "TEXT", true),
          varcharField("route_name", 128, "线路名称", "TEXT"),
          varcharField("origin_site", 128, "始发网点", "TEXT"),
          varcharField("destination_site", 128, "目的网点", "TEXT"),
          varcharField("transport_mode", 32, "运输方式", "DICT_STAGE"),
          varcharField("sort_center_name", 128, "分拨中心", "TEXT"),
          decimalField("distance_km", "里程", "NUMBER"),
          intField("planned_duration_hours", "计划时长"),
          intField("planned_stop_count", "中转节点数"),
          varcharField("route_level", 32, "线路等级", "DICT_STAGE"),
          varcharField("route_status", 32, "线路状态", "DICT_STATUS"),
          datetimeField("effective_time", "生效时间"),
          datetimeField("expire_time", "失效时间"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "logistics_transfer_record",
        tableComment: "快递中转记录表",
        businessRole: "FLOW",
        generationPriority: 4,
        fields: [
          pkField("transfer_id", "BIGINT", "中转记录主键"),
          fkField("waybill_id", "BIGINT", "运单主键", "logistics_waybill", "waybill_id"),
          fkField("route_id", "BIGINT", "线路主键", "logistics_delivery_route", "route_id"),
          codeField("transfer_no", "中转流水号", "TEXT", true),
          varcharField("current_site", 128, "当前网点", "TEXT"),
          varcharField("next_site", 128, "下一网点", "TEXT"),
          varcharField("transport_mode", 32, "运输方式", "DICT_STAGE"),
          varcharField("scan_type", 32, "扫描类型", "TEXT"),
          datetimeField("arrive_time", "到达时间"),
          datetimeField("depart_time", "发出时间"),
          intField("stay_minutes", "停留时长"),
          varcharField("transfer_status", 32, "中转状态", "DICT_STATUS"),
          varcharField("operator_name", 64, "操作员", "PERSON_NAME"),
          codeField("vehicle_no", "运输车次号"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "logistics_sign_record",
        tableComment: "快递签收记录表",
        businessRole: "FLOW",
        generationPriority: 5,
        fields: [
          pkField("sign_id", "BIGINT", "签收记录主键"),
          fkField("waybill_id", "BIGINT", "运单主键", "logistics_waybill", "waybill_id"),
          codeField("sign_no", "签收流水号", "TEXT", true),
          varcharField("courier_name", 64, "派件员", "PERSON_NAME"),
          varcharField("courier_mobile", 16, "派件员手机号", "PHONE"),
          datetimeField("outbound_time", "出站时间"),
          datetimeField("deliver_time", "派送时间"),
          nullableDatetimeField("sign_time", "签收时间"),
          varcharField("sign_status", 32, "签收状态", "DICT_STATUS"),
          varcharField("signer_name", 64, "签收人", "TEXT"),
          varcharField("signer_relation", 32, "签收关系", "TEXT"),
          varcharField("sign_method", 32, "签收方式", "TEXT"),
          codeField("proof_no", "签收凭证号"),
          decimalField("distance_to_receiver_km", "派送距离", "NUMBER"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "logistics_exception_ticket",
        tableComment: "快递异常工单表",
        businessRole: "DETAIL",
        generationPriority: 6,
        fields: [
          pkField("exception_id", "BIGINT", "异常工单主键"),
          fkField("waybill_id", "BIGINT", "运单主键", "logistics_waybill", "waybill_id"),
          codeField("exception_no", "异常工单号", "TEXT", true),
          varcharField("exception_type", 64, "异常类型", "DICT_STAGE"),
          varcharField("exception_level", 32, "异常级别", "DICT_STAGE"),
          varcharField("responsible_site", 128, "责任网点", "TEXT"),
          datetimeField("discover_time", "发现时间"),
          datetimeField("close_time", "关闭时间"),
          varcharField("exception_status", 32, "异常状态", "DICT_STATUS"),
          varcharField("customer_feedback", 255, "客户反馈", "TEXT"),
          varcharField("handling_owner", 64, "处理人", "PERSON_NAME"),
          varcharField("solution_type", 64, "处理方案", "TEXT"),
          decimalField("compensation_amount", "赔付金额"),
          intField("overtime_flag", "是否超时"),
          varcharField("remark", 255, "备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
    ],
    dictTables: [
      dictTable("logistics_transport_mode_dict", "运输方式字典", [["GROUND", "陆运"], ["AIR", "空运"], ["RAIL", "铁路"], ["SAME_CITY", "同城配送"]]),
      dictTable("logistics_exception_type_dict", "异常类型字典", [["DELAY", "延误"], ["ADDRESS_ERROR", "地址异常"], ["PACKAGE_DAMAGE", "包裹破损"], ["LOST", "丢件"]]),
    ],
    relations: [
      relation("logistics_waybill", "waybill_id", "logistics_package_item", "waybill_id", "1:N"),
      relation("logistics_waybill", "waybill_id", "logistics_transfer_record", "waybill_id", "1:N"),
      relation("logistics_delivery_route", "route_id", "logistics_transfer_record", "route_id", "1:N"),
      relation("logistics_waybill", "waybill_id", "logistics_sign_record", "waybill_id", "1:N"),
      relation("logistics_waybill", "waybill_id", "logistics_exception_ticket", "waybill_id", "1:N"),
    ],
    modelExplanation: "快递物流场景围绕运单、包裹、线路、中转、签收和异常工单构建完整履约与客服链路。",
  };
}

function buildRichEcommerceTemplate() {
  return {
    tables: [
      {
        tableName: "customer_profile",
        tableComment: "客户主档表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [
          pkField("customer_id", "BIGINT", "客户主键"),
          codeField("customer_code", "客户编码", "TEXT", true),
          varcharField("customer_name", 64, "客户姓名", "PERSON_NAME", false),
          varcharField("gender", 16, "性别", "DICT_STATUS"),
          varcharField("mobile", 16, "手机号", "PHONE", false, true),
          varcharField("email", 128, "邮箱", "EMAIL"),
          varcharField("member_level", 32, "会员等级", "DICT_STAGE"),
          varcharField("register_channel", 32, "注册渠道", "DICT_CHANNEL"),
          varcharField("risk_level", 32, "风险等级", "DICT_STAGE"),
          intField("loyalty_score", "忠诚度分值"),
          intField("total_order_count", "累计订单数"),
          decimalField("total_order_amount", "累计订单金额"),
          datetimeField("register_time", "注册时间"),
          datetimeField("last_login_time", "最近登录时间"),
          datetimeField("last_order_time", "最近下单时间"),
          varcharField("preferred_category", 64, "偏好类目", "DICT_CATEGORY"),
          ...addRegionFields(),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "customer_address",
        tableComment: "客户收货地址表",
        businessRole: "DETAIL",
        generationPriority: 2,
        fields: [
          pkField("address_id", "BIGINT", "地址主键"),
          fkField("customer_id", "BIGINT", "客户主键", "customer_profile", "customer_id"),
          varcharField("consignee_name", 64, "收货人姓名", "PERSON_NAME", false),
          varcharField("consignee_mobile", 16, "收货人手机号", "PHONE", false),
          ...addRegionFields(),
          varcharField("street_name", 128, "街道名称", "TEXT"),
          varcharField("address_detail", 255, "详细地址", "TEXT"),
          codeField("postal_code", "邮政编码"),
          varcharField("address_tag", 32, "地址标签", "TEXT"),
          intField("is_default", "是否默认地址"),
          decimalField("longitude", "经度", "NUMBER"),
          decimalField("latitude", "纬度", "NUMBER"),
          varcharField("delivery_instructions", 255, "配送备注", "TEXT"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "merchant_store",
        tableComment: "商家门店表",
        businessRole: "MASTER",
        generationPriority: 2,
        fields: [
          pkField("store_id", "BIGINT", "门店主键"),
          codeField("store_code", "门店编码", "TEXT", true),
          varcharField("store_name", 128, "门店名称", "TEXT", false),
          varcharField("merchant_name", 128, "商家名称", "COMPANY_NAME", false),
          varcharField("store_type", 32, "门店类型", "DICT_STAGE"),
          ...addRegionFields(),
          varcharField("street_name", 128, "街道名称", "TEXT"),
          varcharField("address_detail", 255, "详细地址", "TEXT"),
          ...addContactFields(""),
          codeField("warehouse_code", "所属仓编码"),
          intField("daily_order_capacity", "日处理单量"),
          intField("average_dispatch_minutes", "平均出库分钟数"),
          varcharField("delivery_scope", 128, "配送范围", "TEXT"),
          decimalField("rating_score", "门店评分", "NUMBER"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "product_spu",
        tableComment: "商品SPU主数据表",
        businessRole: "MASTER",
        generationPriority: 3,
        fields: [
          pkField("spu_id", "BIGINT", "SPU主键"),
          codeField("spu_code", "SPU编码", "TEXT", true),
          varcharField("product_name", 128, "商品名称", "PRODUCT_NAME", false),
          varcharField("brand_name", 64, "品牌名称", "COMPANY_NAME", false),
          codeField("category_code", "一级类目编码", "DICT_CATEGORY"),
          varcharField("category_name", 64, "一级类目名称", "TEXT"),
          codeField("sub_category_code", "二级类目编码", "DICT_CATEGORY"),
          varcharField("sub_category_name", 64, "二级类目名称", "TEXT"),
          varcharField("product_line", 64, "产品线", "TEXT"),
          varcharField("product_type", 64, "产品类型", "TEXT"),
          decimalField("market_price", "市场价"),
          decimalField("sale_price", "销售价"),
          decimalField("cost_price", "成本价"),
          decimalField("tax_rate", "税率", "NUMBER"),
          varcharField("unit_name", 32, "计量单位", "TEXT"),
          varcharField("origin_country", 64, "原产地", "TEXT"),
          varcharField("supplier_name", 128, "供应商名称", "COMPANY_NAME"),
          codeField("supplier_code", "供应商编码"),
          codeField("model_no", "型号"),
          varcharField("shelf_status", 32, "上架状态", "DICT_STATUS"),
          datetimeField("launch_date", "上市时间"),
          datetimeField("discontinue_date", "下架时间"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "product_sku",
        tableComment: "商品SKU表",
        businessRole: "MASTER",
        generationPriority: 4,
        fields: [
          pkField("sku_id", "BIGINT", "SKU主键"),
          fkField("spu_id", "BIGINT", "SPU主键", "product_spu", "spu_id"),
          codeField("sku_code", "SKU编码", "TEXT", true),
          varcharField("product_name", 128, "商品名称", "PRODUCT_NAME", false),
          varcharField("brand_name", 64, "品牌名称", "COMPANY_NAME"),
          codeField("category_code", "类目编码", "DICT_CATEGORY"),
          varcharField("category_name", 64, "类目名称", "TEXT"),
          varcharField("color_name", 32, "颜色", "TEXT"),
          varcharField("storage_spec", 32, "存储规格", "TEXT"),
          varcharField("size_spec", 32, "尺码规格", "TEXT"),
          varcharField("package_spec", 64, "包装规格", "TEXT"),
          codeField("barcode", "条码", "TEXT", true),
          decimalField("weight_grams", "重量克数", "NUMBER"),
          decimalField("volume_cm3", "体积", "NUMBER"),
          decimalField("list_price", "挂牌价"),
          decimalField("sale_price", "销售价"),
          decimalField("promo_price", "促销价"),
          decimalField("member_price", "会员价"),
          intField("stock_qty", "库存数量"),
          intField("locked_stock_qty", "锁定库存"),
          intField("safety_stock_qty", "安全库存"),
          varcharField("shelf_status", 32, "上架状态", "DICT_STATUS"),
          codeField("warehouse_code", "仓编码"),
          varcharField("warehouse_name", 64, "仓名称", "TEXT"),
          datetimeField("online_time", "上架时间"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "inventory_snapshot",
        tableComment: "库存快照表",
        businessRole: "FLOW",
        generationPriority: 5,
        fields: [
          pkField("snapshot_id", "BIGINT", "快照主键"),
          fkField("sku_id", "BIGINT", "SKU主键", "product_sku", "sku_id"),
          datetimeField("snapshot_date", "快照时间"),
          codeField("warehouse_code", "仓编码"),
          varcharField("warehouse_name", 64, "仓名称", "TEXT"),
          intField("available_qty", "可用库存"),
          intField("reserved_qty", "预占库存"),
          intField("in_transit_qty", "在途库存"),
          intField("damaged_qty", "残损库存"),
          intField("pending_putaway_qty", "待上架库存"),
          intField("cycle_count_diff", "盘点差异数"),
          decimalField("turnover_days", "周转天数", "NUMBER"),
          varcharField("replenishment_status", 32, "补货状态", "DICT_STATUS"),
          varcharField("alert_level", 32, "预警等级", "DICT_STAGE"),
          varcharField("supplier_name", 128, "供应商名称", "COMPANY_NAME"),
          datetimeField("last_inbound_time", "最近入库时间"),
          datetimeField("last_outbound_time", "最近出库时间"),
          decimalField("stock_amount", "库存金额"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "order_header",
        tableComment: "订单头表",
        businessRole: "DETAIL",
        generationPriority: 6,
        fields: [
          pkField("order_id", "BIGINT", "订单主键"),
          fkField("customer_id", "BIGINT", "客户主键", "customer_profile", "customer_id"),
          fkField("store_id", "BIGINT", "门店主键", "merchant_store", "store_id"),
          codeField("order_no", "订单编号", "ORDER_NO", true),
          varcharField("order_source", 32, "订单来源", "DICT_CHANNEL"),
          varcharField("order_channel", 32, "下单渠道", "DICT_CHANNEL"),
          varcharField("order_status", 32, "订单状态", "DICT_STATUS"),
          varcharField("payment_status", 32, "支付状态", "DICT_STATUS"),
          varcharField("delivery_status", 32, "配送状态", "DICT_STATUS"),
          datetimeField("order_time", "下单时间"),
          datetimeField("pay_time", "支付时间"),
          datetimeField("ship_time", "发货时间"),
          datetimeField("complete_time", "完成时间"),
          decimalField("gross_amount", "商品总额"),
          decimalField("discount_amount", "优惠金额"),
          decimalField("freight_amount", "运费金额"),
          decimalField("net_amount", "实付金额"),
          decimalField("coupon_amount", "优惠券金额"),
          decimalField("points_deduction_amount", "积分抵扣金额"),
          varcharField("invoice_status", 32, "发票状态", "DICT_STATUS"),
          varcharField("consignee_name", 64, "收货人姓名", "PERSON_NAME"),
          varcharField("consignee_mobile", 16, "收货人手机号", "PHONE"),
          varcharField("address_snapshot", 255, "地址快照", "TEXT"),
          codeField("province_code", "省份编码", "DICT_REGION"),
          codeField("city_code", "城市编码", "DICT_REGION"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "order_item",
        tableComment: "订单明细表",
        businessRole: "DETAIL",
        generationPriority: 7,
        fields: [
          pkField("item_id", "BIGINT", "明细主键"),
          fkField("order_id", "BIGINT", "订单主键", "order_header", "order_id"),
          fkField("sku_id", "BIGINT", "SKU主键", "product_sku", "sku_id"),
          fkField("spu_id", "BIGINT", "SPU主键", "product_spu", "spu_id"),
          varcharField("product_name", 128, "商品名称", "PRODUCT_NAME"),
          varcharField("brand_name", 64, "品牌名称", "COMPANY_NAME"),
          codeField("category_code", "类目编码", "DICT_CATEGORY"),
          varcharField("category_name", 64, "类目名称", "TEXT"),
          intField("quantity", "购买数量"),
          decimalField("unit_price", "销售单价"),
          decimalField("promo_price", "促销单价"),
          decimalField("discount_amount", "优惠金额"),
          decimalField("item_amount", "明细金额"),
          decimalField("cost_amount", "成本金额"),
          decimalField("tax_amount", "税额"),
          codeField("warehouse_code", "发货仓编码"),
          varcharField("delivery_mode", 32, "配送方式", "TEXT"),
          intField("refund_flag", "退款标记"),
          intField("quality_flag", "质检标记"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "payment_record",
        tableComment: "支付流水表",
        businessRole: "FLOW",
        generationPriority: 8,
        fields: [
          pkField("payment_id", "BIGINT", "支付主键"),
          fkField("order_id", "BIGINT", "订单主键", "order_header", "order_id"),
          codeField("payment_no", "支付流水号", "TEXT", true),
          varcharField("pay_channel", 32, "支付渠道", "DICT_CHANNEL"),
          varcharField("pay_status", 32, "支付状态", "DICT_STATUS"),
          decimalField("pay_amount", "支付金额"),
          codeField("currency_code", "币种"),
          codeField("transaction_id", "交易流水号", "TEXT", true),
          codeField("merchant_order_no", "商户订单号"),
          codeField("acquirer_code", "收单机构编码"),
          varcharField("bank_name", 64, "发卡行名称", "TEXT"),
          varcharField("payer_account_mask", 64, "付款账户脱敏", "TEXT"),
          datetimeField("pay_time", "支付时间"),
          datetimeField("callback_time", "回调时间"),
          datetimeField("settlement_time", "清算时间"),
          varcharField("refund_status", 32, "退款状态", "DICT_STATUS"),
          varcharField("risk_result", 32, "风控结果", "DICT_STATUS"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "refund_ticket",
        tableComment: "退款单表",
        businessRole: "FLOW",
        generationPriority: 9,
        fields: [
          pkField("refund_id", "BIGINT", "退款主键"),
          fkField("order_id", "BIGINT", "订单主键", "order_header", "order_id"),
          fkField("payment_id", "BIGINT", "支付主键", "payment_record", "payment_id"),
          codeField("refund_no", "退款单号", "TEXT", true),
          varcharField("refund_reason", 128, "退款原因", "TEXT"),
          varcharField("refund_status", 32, "退款状态", "DICT_STATUS"),
          decimalField("refund_amount", "退款金额"),
          datetimeField("apply_time", "申请时间"),
          datetimeField("approve_time", "审核时间"),
          datetimeField("complete_time", "完成时间"),
          varcharField("applicant_name", 64, "申请人", "PERSON_NAME"),
          varcharField("audit_name", 64, "审核人", "PERSON_NAME"),
          intField("item_count", "商品件数"),
          intField("logistics_back_flag", "是否退回物流"),
          codeField("return_warehouse_code", "退回仓编码"),
          codeField("return_tracking_no", "退回运单号"),
          intField("dispute_flag", "争议标记"),
          ...addAuditFields(),
        ],
      },
      {
        tableName: "logistics_delivery",
        tableComment: "物流履约表",
        businessRole: "FLOW",
        generationPriority: 10,
        fields: [
          pkField("delivery_id", "BIGINT", "履约主键"),
          fkField("order_id", "BIGINT", "订单主键", "order_header", "order_id"),
          codeField("delivery_no", "履约单号", "TEXT", true),
          codeField("warehouse_code", "仓编码"),
          varcharField("warehouse_name", 64, "仓名称", "TEXT"),
          varcharField("courier_company", 64, "快递公司", "TEXT"),
          codeField("tracking_no", "运单号", "TEXT", true),
          varcharField("delivery_status", 32, "履约状态", "DICT_STATUS"),
          datetimeField("dispatch_time", "发运时间"),
          datetimeField("first_pickup_time", "首次揽收时间"),
          datetimeField("delivered_time", "妥投时间"),
          datetimeField("signed_time", "签收时间"),
          varcharField("consignee_name", 64, "收货人姓名", "PERSON_NAME"),
          varcharField("consignee_mobile", 16, "收货人手机号", "PHONE"),
          varcharField("destination_province", 64, "目的省份", "TEXT"),
          varcharField("destination_city", 64, "目的城市", "TEXT"),
          varcharField("destination_district", 64, "目的区县", "TEXT"),
          varcharField("route_name", 128, "配送路由", "TEXT"),
          intField("package_count", "包裹件数"),
          decimalField("package_weight", "包裹重量", "NUMBER"),
          intField("abnormal_flag", "异常标记"),
          ...addAuditFields(),
        ],
      },
    ],
    dictTables: [
      dictTable("category_dict", "商品分类字典", [["ELECTRONIC", "手机数码"], ["HOME", "家电家居"], ["FOOD", "食品酒水"], ["APPAREL", "服饰鞋包"]]),
      dictTable("channel_dict", "渠道字典", [["APP", "APP"], ["MINI_PROGRAM", "小程序"], ["WEB", "网页"], ["STORE", "门店"]]),
    ],
    relations: [
      relation("customer_profile", "customer_id", "customer_address", "customer_id", "1:N"),
      relation("product_spu", "spu_id", "product_sku", "spu_id", "1:N"),
      relation("product_sku", "sku_id", "inventory_snapshot", "sku_id", "1:N"),
      relation("customer_profile", "customer_id", "order_header", "customer_id", "1:N"),
      relation("merchant_store", "store_id", "order_header", "store_id", "1:N"),
      relation("order_header", "order_id", "order_item", "order_id", "1:N"),
      relation("order_header", "order_id", "payment_record", "order_id", "1:N"),
      relation("order_header", "order_id", "refund_ticket", "order_id", "1:N"),
      relation("order_header", "order_id", "logistics_delivery", "order_id", "1:N"),
    ],
    modelExplanation: "增强电商场景围绕客户、商品、库存、订单、支付、退款和履约构建完整零售链路。",
  };
}

function buildGenericTemplate() {
  return {
    tables: [
      {
        tableName: "entity_info",
        tableComment: "主体信息表",
        businessRole: "MASTER",
        generationPriority: 1,
        fields: [pkField("entity_id", "BIGINT", "主键"), varcharField("entity_name", 128, "主体名称", "TEXT"), varcharField("mobile", 16, "手机号", "PHONE"), varcharField("email", 128, "邮箱", "EMAIL"), datetimeField("created_at", "创建时间")]
      },
      {
        tableName: "event_record",
        tableComment: "事件记录表",
        businessRole: "FLOW",
        generationPriority: 2,
        fields: [pkField("event_id", "BIGINT", "事件主键"), fkField("entity_id", "BIGINT", "主体主键", "entity_info", "entity_id"), varcharField("event_type", 64, "事件类型", "DICT_STATUS"), varcharField("event_status", 32, "事件状态", "DICT_STATUS"), datetimeField("event_time", "事件时间"), varcharField("remark", 255, "备注", "TEXT")]
      }
    ],
    dictTables: [dictTable("event_status_dict", "状态字典", [["NEW", "新建"], ["RUNNING", "运行中"], ["SUCCESS", "成功"], ["FAILED", "失败"]])],
    relations: [relation("entity_info", "entity_id", "event_record", "entity_id", "1:N")],
    modelExplanation: "通用模板默认生成主体表和事件流转表，便于快速起步并支持自然语言继续细化。"
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitResearchTableTokens(tableName) {
  return String(tableName || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function singularizeToken(token) {
  const value = String(token || "").toLowerCase();
  if (!value) return "item";
  if (value.endsWith("ies") && value.length > 3) return `${value.slice(0, -3)}y`;
  if (value.endsWith("ses") && value.length > 3) return value.slice(0, -2);
  if (value.endsWith("s") && !value.endsWith("ss") && value.length > 2) return value.slice(0, -1);
  return value;
}

function resolveResearchEntityName(tableName) {
  const tokens = splitResearchTableTokens(tableName);
  if (tokens.length === 0) return "entity";
  const last = tokens[tokens.length - 1];
  const previous = tokens[tokens.length - 2];
  const suffixes = new Set(["profile", "info", "record", "note", "application", "activity", "service", "appointment", "order", "pool", "model", "inventory", "performance", "showroom"]);
  if (suffixes.has(last) && previous) {
    return singularizeToken(previous);
  }
  return singularizeToken(last);
}

function humanizeResearchTableName(tableName) {
  const tokenMap = {
    leads: "线索",
    lead: "线索",
    pool: "池",
    customer: "客户",
    profile: "档案",
    sales: "销售",
    consultant: "顾问",
    store: "门店",
    showroom: "展厅",
    vehicle: "车辆",
    model: "车型",
    inventory: "库存",
    test: "试驾",
    drive: "试驾",
    appointment: "预约",
    record: "记录",
    opportunity: "商机",
    quotation: "报价",
    quote: "报价",
    order: "订单",
    finance: "金融",
    application: "申请",
    delivery: "交付",
    note: "单",
    charging: "充电",
    pile: "桩",
    service: "服务",
    follow: "跟进",
    marketing: "营销",
    activity: "活动",
    performance: "绩效",
    contract: "合同",
    violation: "违法",
    status: "状态",
    inspection: "检查",
    result: "结果",
    document: "文书",
    type: "类型",
    reason: "原因",
    review: "复核",
    appeal: "申诉",
    payment: "支付",
    channel: "渠道",
    archive: "归档",
    filing: "备案",
    evidence: "证据",
    driver: "驾驶员",
    risk: "风险",
    warning: "预警",
    highway: "高速",
    weight: "称重",
    overload: "超限",
    checkpoint: "卡口",
    device: "设备",
    notice: "通知",
    delivery: "交付",
    acceptance: "受理",
    committee: "审议",
    agency: "机构",
    officer: "人员",
    process: "流程",
    tracking: "跟踪",
    law: "执法",
    enforcement: "执法",
    reconcile: "对账",
    battery: "电池",
    safety: "安全",
    energy: "能源",
    new: "新",
    temporary: "临时",
    stop: "临停",
    school: "学校",
    zone: "护学",
    night: "夜间",
    team: "班组",
    schedule: "排班",
    capture: "抓拍",
    camera: "视频",
    control: "布控",
    node: "节点",
    code: "代码",
    dict: "字典",
    // railway / transit / logistics
    train: "列车",
    railway: "铁路",
    rail: "铁路",
    locomotive: "机车",
    freight: "货运",
    waybill: "运单",
    cargo: "货物",
    passenger: "旅客",
    ticket: "票务",
    fare: "票价",
    crew: "乘务",
    staff: "员工",
    rolling: "车辆",
    stock: "档案",
    maintenance: "维修",
    repair: "维修",
    inspection: "检查",
    financial: "财务",
    settlement: "结算",
    flow: "流量",
    info: "信息",
    station: "车站",
    platform: "站台",
    route: "线路",
    line: "线路",
    log: "日志",
    event: "事件",
    monitor: "监控",
    fault: "故障",
    alarm: "告警",
    alert: "预警",
    report: "报表",
    stats: "统计",
    summary: "汇总",
    detail: "明细",
    config: "配置",
    rule: "规则",
    plan: "计划",
    task: "任务",
    assignment: "分配",
    dispatch: "调度",
    audit: "审计",
    user: "用户",
    role: "角色",
    permission: "权限",
    dept: "部门",
    department: "部门",
    org: "机构",
    employee: "员工",
    contact: "联系人",
    address: "地址",
    region: "区域",
    area: "区域",
    project: "项目",
    resource: "资源",
    asset: "资产",
    equipment: "设备",
    item: "条目",
    category: "分类",
    tag: "标签",
    comment: "备注",
    attachment: "附件",
    file: "文件",
    image: "图片",
    video: "视频",
    message: "消息",
    notification: "通知",
    feedback: "反馈",
    complaint: "投诉",
    survey: "调查",
    workflow: "流程",
    approval: "审批",
    signature: "签名",
    template: "模板",
  };
  const tokens = splitResearchTableTokens(tableName);
  const label = tokens.map((token) => tokenMap[token] || token).join("");
  return label || String(tableName || "业务");
}

function buildResearchTableComment(tableName) {
  return `${humanizeResearchTableName(tableName)}表`;
}

const TABLE_COMMENT_OVERRIDES = {
  bus_route: "公交线路表",
  bus_station: "公交站点表",
  bus_vehicle: "公交车辆档案表",
  driver: "驾驶员档案表",
  driver_roster: "司机排班表",
  trip_plan: "班次计划表",
  vehicle_dispatch: "车辆调度表",
  arrival_departure_log: "到离站记录表",
  fare_transaction: "票务交易表",
  fare_transaction_record: "票务交易记录表",
  passenger_flow_stats: "客流统计表",
  route_station: "线路站点映射表",
  operation_company: "运营公司表",
  operation_report: "运营报表表",
  operation_stats: "运营统计表",
  vehicle_maintenance_record: "车辆维保记录表",
  dispatch_record: "调度指令记录表",
  violation_image_evidence: "违法图像证据表",
  violation_notice_record: "违法告知记录表",
  violation_code_dict: "违法代码字典表",
  checkpoint_info: "检查点信息表",
  checkpoint_device_archive: "卡口设备档案表",
  checkpoint_vehicle_pass_record: "卡口车辆通行记录表",
  accident_evidence_material: "事故证据材料表",
  accident_disposal_record: "事故处置记录表",
  patrol_team_schedule: "巡逻班组排班表",
  payment_reconcile_record: "缴款对账记录表",
  payment_channel_dict: "支付渠道字典表",
  camera_network_node: "卡口视频网络节点表",
  camera_capture_record: "卡口抓拍记录表",
  control_warning_rule: "布控预警规则表",
  notice_delivery_record: "通知送达记录表",
  document_archive_file: "文书归档文件表",
  night_patrol_schedule: "夜间巡逻排班表",
  night_patrol_event: "夜间巡逻事件表",
  school_zone_info: "校区护学点位表",
  school_zone_control_record: "校区交通管控记录表",
  temporary_stop_inspection: "临停检查记录表",
  new_energy_vehicle_filing: "新能源车辆备案表",
  battery_safety_inspection: "电池安全检查表",
  vehicle_pass_feature: "车辆通行特征表",
  driver_profile: "驾驶员档案表",
  driver_license_record: "驾驶证信息记录表",
  driver_risk_profile: "驾驶员风险画像表",
  key_vehicle_watchlist: "重点车辆布控名单表",
  warning_event_record: "预警事件记录表",
  vehicle_risk_profile: "车辆风险画像表",
  appeal_application: "违法申诉申请表",
  appeal_acceptance_record: "申诉受理记录表",
  appeal_review_case: "复核案件表",
  review_evidence_material: "复核证据材料表",
  review_decision_notice: "复核决定通知书表",
  document_revoke_record: "文书撤销记录表",
  electronic_archive_file: "电子卷宗档案表",
  highway_weight_check_record: "高速称重检查记录表",
  highway_entry_checkpoint: "高速入口卡口表",
  overload_vehicle_record: "超限车辆记录表",
  review_committee_meeting: "复核审议会议记录表",
  process_tracking_log: "申诉流程跟踪日志表",
  law_enforcement_agency: "执法机构信息表",
  revoke_reason_dict: "撤销原因字典表",
  review_status_dict: "复核状态字典表",
  violation_type_dict: "违法类型字典表",
  delivery_channel_dict: "交付渠道字典表",
};

function humanizeIdentifier(value) {
  const tokenMap = {
    owner: "车主", vehicle: "车辆", registration: "登记", violation: "违法", penalty: "处罚", payment: "缴款",
    checkpoint: "检查点", inspection: "检查", accident: "事故", dispatch: "派单", patrol: "巡逻", document: "文书",
    image: "图像", evidence: "证据", material: "材料", notice: "告知", code: "编码", no: "编号", info: "信息",
    archive: "档案", device: "设备", pass: "通行", team: "班组", schedule: "排班", channel: "渠道", camera: "摄像",
    capture: "抓拍", control: "布控", warning: "预警", night: "夜间", school: "学校", zone: "护学", temporary: "临时",
    stop: "临停", new: "新", energy: "能源", battery: "电池", safety: "安全", feature: "特征", driver: "驾驶员",
    license: "驾驶证", risk: "风险", key: "重点", watchlist: "名单", appeal: "申诉", acceptance: "受理", review: "复核",
    decision: "决定", revoke: "撤销", electronic: "电子", file: "文件", highway: "高速", weight: "称重", entry: "入口",
    overload: "超限", law: "执法", enforcement: "执法", agency: "机构", committee: "委员会", meeting: "会议", process: "流程",
    tracking: "跟踪", log: "日志", record: "记录", profile: "档案", status: "状态", type: "类型", result: "结果",
    amount: "金额", time: "时间", name: "名称", reason: "原因", application: "申请", id: "主键",
  };
  const tokens = String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.map((token) => tokenMap[token] || token).join("") || String(value || "字段");
}

function containsLatinWord(value) {
  return /[A-Za-z]{2,}/.test(String(value || ""));
}

function localizeTableComment(tableName, currentComment) {
  const override = TABLE_COMMENT_OVERRIDES[String(tableName || "").trim()];
  if (override) return override;
  if (String(tableName || "").trim().toLowerCase().endsWith("_dict")) {
    const dictLabel = `${humanizeResearchTableName(String(tableName || "").trim().replace(/_dict$/i, ""))}字典表`;
    if (!containsLatinWord(dictLabel)) {
      return dictLabel;
    }
  }
  const current = String(currentComment || "").trim();
  if (current && !containsLatinWord(current)) return current;
  const fallback = `${humanizeResearchTableName(tableName)}表`;
  return containsLatinWord(fallback) ? "业务数据表" : fallback;
}

function localizeFieldComment(tableName, field) {
  const current = String(field?.fieldComment || "").trim();
  if (current && !containsLatinWord(current)) return current;
  if (field?.primaryKey) return `${humanizeResearchTableName(tableName)}主键`;
  if (field?.foreignKey) return `${humanizeIdentifier(field?.fieldName || "").replace(/主键$/, "") || "关联"}主键`;
  if (String(field?.fieldName || "").toLowerCase().endsWith("_no")) return `${humanizeIdentifier(field?.fieldName || "").replace(/编号$/, "")}编号`;
  if (String(field?.fieldName || "").toLowerCase().endsWith("_code")) return `${humanizeIdentifier(field?.fieldName || "").replace(/编码$/, "")}编码`;
  return humanizeIdentifier(field?.fieldName || "");
}

function applyChineseLocalizationToTemplate(template) {
  const nextTemplate = cloneJson(template);
  nextTemplate.tables = (nextTemplate.tables || []).map((table) => ({
    ...table,
    tableComment: localizeTableComment(table.tableName, table.tableComment),
    fields: (table.fields || []).map((field) => ({
      ...field,
      fieldComment: localizeFieldComment(table.tableName, field),
    })),
  }));
  nextTemplate.dictTables = (nextTemplate.dictTables || []).map((table) => ({
    ...table,
    tableComment: localizeTableComment(table.tableName, table.tableComment),
  }));
  return nextTemplate;
}

function appendFieldIfMissing(fields, field) {
  if (!field || !field.fieldName) return;
  if (!fields.find((item) => item.fieldName === field.fieldName)) {
    fields.push(field);
  }
}

function appendFieldsIfMissing(fields, fieldList) {
  (fieldList || []).forEach((field) => appendFieldIfMissing(fields, field));
}

function deriveResearchBusinessRole(tableName, relationStats = {}) {
  const tokens = splitResearchTableTokens(tableName);
  const joined = tokens.join("_");
  if (/(record|log|follow|history|performance)/.test(joined)) return "LOG";
  if (/(appointment|application|service|inventory|delivery|payment|quotation|activity)/.test(joined)) return "FLOW";
  if (/(order|opportunity|contract|note)/.test(joined)) return "DETAIL";
  if (Number(relationStats.incoming || 0) === 0 && Number(relationStats.outgoing || 0) > 0) return "MASTER";
  if (Number(relationStats.incoming || 0) > 0 && Number(relationStats.outgoing || 0) > 0) return "DETAIL";
  return "MASTER";
}

function buildResearchPrimaryKeyField(tableName) {
  const entity = resolveResearchEntityName(tableName);
  return pkField(`${entity}_id`, "BIGINT", `${humanizeResearchTableName(tableName)}主键`);
}

function buildResearchCodeField(tableName) {
  const entity = resolveResearchEntityName(tableName);
  const codeName = /(order|application|appointment|quotation|record|note|service|activity)/.test(String(tableName || ""))
    ? `${entity}_no`
    : `${entity}_code`;
  return codeField(codeName, `${humanizeResearchTableName(tableName)}编码`, "TEXT", true);
}

function buildResearchHeuristicFields(tableName, businessRole) {
  const tokens = splitResearchTableTokens(tableName);
  const tokenSet = new Set(tokens);
  const fields = [];

  appendFieldIfMissing(fields, buildResearchPrimaryKeyField(tableName));
  appendFieldIfMissing(fields, buildResearchCodeField(tableName));

  if (tokenSet.has("lead") || tokenSet.has("leads") || tokenSet.has("pool")) {
    appendFieldsIfMissing(fields, [
      varcharField("lead_name", 128, "线索名称", "TEXT"),
      varcharField("lead_source", 32, "线索来源", "DICT_STAGE"),
      varcharField("customer_name", 64, "客户姓名", "PERSON_NAME"),
      varcharField("customer_mobile", 16, "客户手机号", "PHONE"),
      varcharField("intention_level", 32, "意向等级", "DICT_STAGE"),
      datetimeField("assign_time", "分配时间"),
      datetimeField("latest_follow_time", "最近跟进时间"),
    ]);
  }

  if (tokenSet.has("customer") || tokenSet.has("profile")) {
    appendFieldsIfMissing(fields, [
      varcharField("customer_name", 128, "客户名称", "TEXT", false),
      varcharField("customer_level", 32, "客户等级", "DICT_STAGE"),
      varcharField("contact_name", 64, "联系人", "PERSON_NAME"),
      varcharField("contact_mobile", 16, "联系电话", "PHONE"),
      varcharField("contact_email", 128, "联系邮箱", "EMAIL"),
    ]);
  }

  if (tokenSet.has("carrier")) {
    appendFieldsIfMissing(fields, [
      varcharField("carrier_name", 128, "承运商名称", "TEXT", false),
      codeField("carrier_code", "承运商编码", "TEXT", true),
      varcharField("carrier_type", 32, "承运商类型", "DICT_STAGE"),
      varcharField("contact_name", 64, "联系人", "PERSON_NAME"),
      varcharField("contact_mobile", 16, "联系电话", "PHONE"),
      varcharField("qualification_level", 32, "资质等级", "DICT_STAGE"),
    ]);
  }

  if (tokenSet.has("site")) {
    appendFieldsIfMissing(fields, [
      varcharField("site_name", 128, "网点名称", "TEXT", false),
      varcharField("site_type", 32, "网点类型", "DICT_STAGE"),
      varcharField("site_address", 255, "网点地址", "TEXT"),
      varcharField("manager_name", 64, "负责人", "PERSON_NAME"),
      varcharField("contact_mobile", 16, "联系电话", "PHONE"),
      intField("capacity", "处理能力"),
    ]);
  }

  if (tokenSet.has("waybill")) {
    appendFieldsIfMissing(fields, [
      codeField("waybill_no", "运单号", "TEXT", true),
      varcharField("transport_status", 32, "运输状态", "DICT_STATUS"),
      varcharField("sender_name", 64, "发货人", "PERSON_NAME"),
      varcharField("receiver_name", 64, "收货人", "PERSON_NAME"),
      decimalField("weight", "重量", "NUMBER"),
      decimalField("volume", "体积", "NUMBER"),
      datetimeField("create_time", "创建时间"),
      datetimeField("update_time", "更新时间"),
    ]);
  }

  if (tokenSet.has("cargo")) {
    appendFieldsIfMissing(fields, [
      varcharField("cargo_name", 128, "货物名称", "TEXT", false),
      varcharField("cargo_type", 32, "货物类型", "DICT_STAGE"),
      decimalField("cargo_weight", "货物重量", "NUMBER"),
      decimalField("cargo_volume", "货物体积", "NUMBER"),
      varcharField("packaging_type", 32, "包装类型", "DICT_STAGE"),
      varcharField("special_requirement", 255, "特殊要求", "TEXT"),
    ]);
  }

  if (tokenSet.has("warehouse")) {
    appendFieldsIfMissing(fields, [
      varcharField("warehouse_name", 128, "仓库名称", "TEXT", false),
      varcharField("warehouse_type", 32, "仓库类型", "DICT_STAGE"),
      varcharField("warehouse_address", 255, "仓库地址", "TEXT"),
      intField("inventory_qty", "库存数量"),
      intField("available_qty", "可用数量"),
      intField("locked_qty", "冻结数量"),
    ]);
  }

  if (tokenSet.has("transport") || tokenSet.has("route")) {
    appendFieldsIfMissing(fields, [
      codeField("route_no", "线路编号", "TEXT", true),
      varcharField("origin_site", 128, "起始网点", "TEXT"),
      varcharField("destination_site", 128, "目的网点", "TEXT"),
      datetimeField("planned_departure_time", "计划发车时间"),
      datetimeField("planned_arrival_time", "计划到达时间"),
      varcharField("transport_mode", 32, "运输方式", "DICT_STAGE"),
    ]);
  }

  if (tokenSet.has("tracking")) {
    appendFieldsIfMissing(fields, [
      datetimeField("track_time", "轨迹时间"),
      varcharField("track_event", 64, "轨迹事件", "DICT_STAGE"),
      varcharField("current_site", 128, "当前网点", "TEXT"),
      varcharField("next_site", 128, "下一网点", "TEXT"),
      varcharField("location_gps", 64, "定位坐标", "TEXT"),
      varcharField("track_status", 32, "轨迹状态", "DICT_STATUS"),
    ]);
  }

  if (tokenSet.has("settlement")) {
    appendFieldsIfMissing(fields, [
      codeField("settlement_no", "结算单号", "TEXT", true),
      varcharField("settlement_status", 32, "结算状态", "DICT_STATUS"),
      decimalField("total_amount", "结算金额"),
      decimalField("settled_amount", "已结金额"),
      datetimeField("settlement_time", "结算时间"),
      varcharField("payer_name", 128, "付款方", "TEXT"),
    ]);
  }

  if (tokenSet.has("cost")) {
    appendFieldsIfMissing(fields, [
      varcharField("cost_type", 32, "费用类型", "DICT_STAGE"),
      decimalField("cost_amount", "费用金额"),
      varcharField("cost_owner", 64, "费用承担方", "TEXT"),
      datetimeField("cost_time", "费用发生时间"),
      varcharField("invoice_no", 64, "发票号", "TEXT"),
    ]);
  }

  if (tokenSet.has("sales") && tokenSet.has("consultant")) {
    appendFieldsIfMissing(fields, [
      varcharField("consultant_name", 64, "销售顾问姓名", "PERSON_NAME", false),
      codeField("employee_no", "员工编号", "TEXT", true),
      varcharField("mobile", 16, "手机号", "PHONE"),
      varcharField("position_name", 64, "岗位名称", "TEXT"),
    ]);
  }

  if (tokenSet.has("store") || tokenSet.has("showroom")) {
    appendFieldsIfMissing(fields, [
      varcharField("store_name", 128, "门店名称", "TEXT", false),
      varcharField("showroom_name", 128, "展厅名称", "TEXT"),
      varcharField("manager_name", 64, "负责人", "PERSON_NAME"),
      varcharField("contact_mobile", 16, "联系电话", "PHONE"),
      varcharField("address_detail", 255, "详细地址", "TEXT"),
    ]);
    appendFieldsIfMissing(fields, addRegionFields());
  }

  if (tokenSet.has("vehicle") || tokenSet.has("model")) {
    appendFieldsIfMissing(fields, [
      varcharField("brand_name", 64, "品牌名称", "TEXT"),
      varcharField("series_name", 64, "车系名称", "TEXT"),
      varcharField("model_name", 128, "车型名称", "TEXT"),
      varcharField("energy_type", 32, "能源类型", "DICT_STAGE"),
      decimalField("guide_price", "指导价"),
      decimalField("range_km", "续航里程", "NUMBER"),
    ]);
  }

  if (tokenSet.has("route")) {
    appendFieldsIfMissing(fields, [
      varcharField("route_name", 128, "线路名称", "TEXT", false),
      varcharField("route_type", 32, "线路类型", "DICT_STAGE"),
      varcharField("start_station_name", 128, "首站名称", "TEXT"),
      varcharField("end_station_name", 128, "末站名称", "TEXT"),
      varcharField("service_direction", 32, "行驶方向", "TEXT"),
      datetimeField("first_departure_time", "首班时间"),
      datetimeField("last_departure_time", "末班时间"),
    ]);
  }

  if (tokenSet.has("station")) {
    appendFieldsIfMissing(fields, [
      varcharField("station_name", 128, "站点名称", "TEXT", false),
      varcharField("station_type", 32, "站点类型", "DICT_STAGE"),
      varcharField("station_address", 255, "站点地址", "TEXT"),
      decimalField("longitude", "经度", "NUMBER"),
      decimalField("latitude", "纬度", "NUMBER"),
      intField("transfer_line_count", "换乘线路数"),
    ]);
  }

  if (tokenSet.has("trip") || tokenSet.has("plan")) {
    appendFieldsIfMissing(fields, [
      codeField("trip_no", "班次编号", "TEXT", true),
      varcharField("service_date", 32, "运营日期", "TEXT"),
      datetimeField("planned_departure_time", "计划发车时间"),
      datetimeField("planned_arrival_time", "计划到站时间"),
      varcharField("dispatch_status", 32, "调度状态", "DICT_STATUS"),
      intField("planned_capacity", "计划运力"),
    ]);
  }

  if (tokenSet.has("dispatch")) {
    appendFieldsIfMissing(fields, [
      codeField("dispatch_no", "调度指令编号", "TEXT", true),
      varcharField("dispatch_type", 32, "调度类型", "DICT_STAGE"),
      datetimeField("dispatch_time", "调度时间"),
      varcharField("dispatch_status", 32, "执行状态", "DICT_STATUS"),
      varcharField("dispatcher_name", 64, "调度员姓名", "PERSON_NAME"),
      varcharField("dispatch_reason", 255, "调度原因", "TEXT"),
    ]);
  }

  if (tokenSet.has("driver")) {
    appendFieldsIfMissing(fields, [
      varcharField("driver_name", 64, "司机姓名", "PERSON_NAME", false),
      codeField("employee_no", "员工编号", "TEXT", true),
      varcharField("mobile", 16, "手机号", "PHONE"),
      varcharField("license_type", 32, "准驾车型", "DICT_STAGE"),
      datetimeField("license_expire_time", "证照到期时间"),
      varcharField("attendance_status", 32, "出勤状态", "DICT_STATUS"),
    ]);
  }

  if (tokenSet.has("roster")) {
    appendFieldsIfMissing(fields, [
      codeField("roster_no", "排班编号", "TEXT", true),
      varcharField("shift_code", 32, "班次编码", "TEXT"),
      varcharField("service_date", 32, "排班日期", "TEXT"),
      datetimeField("shift_start_time", "班次开始时间"),
      datetimeField("shift_end_time", "班次结束时间"),
      varcharField("roster_status", 32, "排班状态", "DICT_STATUS"),
    ]);
  }

  if (tokenSet.has("arrival") || tokenSet.has("departure")) {
    appendFieldsIfMissing(fields, [
      codeField("trip_no", "班次编号", "TEXT"),
      varcharField("station_name", 128, "站点名称", "TEXT"),
      datetimeField("arrival_time", "到站时间"),
      datetimeField("departure_time", "离站时间"),
      intField("delay_minutes", "晚点分钟数"),
      intField("boarding_count", "上车人数"),
      intField("alighting_count", "下车人数"),
    ]);
  }

  if (tokenSet.has("fare") || tokenSet.has("transaction")) {
    appendFieldsIfMissing(fields, [
      codeField("transaction_no", "交易流水号", "TEXT", true),
      varcharField("payment_channel", 32, "支付渠道", "DICT_STAGE"),
      varcharField("ticket_type", 32, "票种类型", "DICT_STAGE"),
      decimalField("transaction_amount", "交易金额"),
      datetimeField("transaction_time", "交易时间"),
      varcharField("route_name", 128, "所属线路", "TEXT"),
    ]);
  }

  if (tokenSet.has("passenger") || tokenSet.has("flow")) {
    appendFieldsIfMissing(fields, [
      varcharField("stat_date", 32, "统计日期", "TEXT"),
      varcharField("peak_period", 32, "客流时段", "TEXT"),
      intField("boarding_count", "上客人数"),
      intField("alighting_count", "下客人数"),
      intField("transfer_count", "换乘人数"),
      decimalField("load_factor", "满载率", "NUMBER"),
    ]);
  }

  if (tokenSet.has("monitor")) {
    appendFieldsIfMissing(fields, [
      datetimeField("monitor_time", "监控时间"),
      decimalField("longitude", "经度", "NUMBER"),
      decimalField("latitude", "纬度", "NUMBER"),
      decimalField("speed_kmh", "速度", "NUMBER"),
      varcharField("online_status", 32, "在线状态", "DICT_STATUS"),
      varcharField("alert_level", 32, "告警级别", "DICT_STAGE"),
    ]);
  }

  if (tokenSet.has("log")) {
    appendFieldsIfMissing(fields, [
      datetimeField("event_time", "事件时间"),
      varcharField("event_type", 64, "事件类型", "DICT_STAGE"),
      varcharField("event_status", 32, "事件状态", "DICT_STATUS"),
      varcharField("event_summary", 255, "事件摘要", "TEXT"),
    ]);
  }

  if (tokenSet.has("report") || tokenSet.has("stats") || tokenSet.has("daily")) {
    appendFieldsIfMissing(fields, [
      varcharField("stat_date", 32, "统计日期", "TEXT"),
      varcharField("report_period", 32, "统计周期", "TEXT"),
      intField("route_count", "线路数"),
      intField("trip_count", "班次数"),
      intField("passenger_count", "客运量"),
      decimalField("income_amount", "营收金额"),
      decimalField("punctuality_rate", "准点率", "NUMBER"),
      intField("complaint_count", "投诉数"),
    ]);
  }

  if (tokenSet.has("maintenance")) {
    appendFieldsIfMissing(fields, [
      codeField("maintenance_no", "维保工单号", "TEXT", true),
      varcharField("maintenance_type", 32, "维保类型", "DICT_STAGE"),
      datetimeField("maintenance_start_time", "维保开始时间"),
      datetimeField("maintenance_end_time", "维保结束时间"),
      varcharField("maintenance_status", 32, "维保状态", "DICT_STATUS"),
      decimalField("maintenance_cost", "维保费用"),
    ]);
  }

  if (tokenSet.has("complaint")) {
    appendFieldsIfMissing(fields, [
      codeField("complaint_no", "投诉单号", "TEXT", true),
      varcharField("complaint_type", 32, "投诉类型", "DICT_STAGE"),
      datetimeField("complaint_time", "投诉时间"),
      varcharField("complaint_status", 32, "处理状态", "DICT_STATUS"),
      varcharField("passenger_name", 64, "乘客姓名", "PERSON_NAME"),
      varcharField("complaint_summary", 255, "投诉摘要", "TEXT"),
    ]);
  }

  if (tokenSet.has("inventory")) {
    appendFieldsIfMissing(fields, [
      codeField("vin_code", "VIN码", "TEXT", true),
      varcharField("color_name", 32, "车身颜色", "TEXT"),
      decimalField("battery_capacity_kwh", "电池容量", "NUMBER"),
      varcharField("inventory_status", 32, "库存状态", "DICT_STATUS"),
      datetimeField("stock_in_time", "入库时间"),
    ]);
  }

  if (tokenSet.has("test") || tokenSet.has("drive")) {
    appendFieldsIfMissing(fields, [
      datetimeField("appointment_time", "预约时间"),
      datetimeField("drive_time", "试驾时间"),
      varcharField("drive_status", 32, "试驾状态", "DICT_STATUS"),
      varcharField("route_name", 128, "试驾路线", "TEXT"),
      decimalField("feedback_score", "反馈评分", "NUMBER"),
    ]);
  }

  if (tokenSet.has("opportunity")) {
    appendFieldsIfMissing(fields, [
      varcharField("opportunity_name", 128, "商机名称", "TEXT", false),
      varcharField("stage_code", 32, "阶段编码", "DICT_STAGE"),
      varcharField("intention_level", 32, "意向等级", "DICT_STAGE"),
      decimalField("expected_amount", "预计金额"),
      datetimeField("expected_sign_time", "预计签约时间"),
    ]);
  }

  if (tokenSet.has("quotation") || tokenSet.has("quote")) {
    appendFieldsIfMissing(fields, [
      codeField("quotation_no", "报价单号", "TEXT", true),
      decimalField("quote_amount", "报价金额"),
      decimalField("discount_amount", "优惠金额"),
      datetimeField("valid_until", "报价有效期"),
      varcharField("quote_status", 32, "报价状态", "DICT_STATUS"),
    ]);
  }

  if (tokenSet.has("order") || tokenSet.has("contract")) {
    appendFieldsIfMissing(fields, [
      codeField("order_no", "订单编号", "TEXT", true),
      varcharField("order_status", 32, "订单状态", "DICT_STATUS"),
      decimalField("order_amount", "订单金额"),
      decimalField("paid_amount", "已付金额"),
      datetimeField("sign_time", "签约时间"),
      datetimeField("delivery_plan_time", "计划交付时间"),
    ]);
  }

  if (tokenSet.has("finance") || tokenSet.has("application")) {
    appendFieldsIfMissing(fields, [
      codeField("application_no", "申请编号", "TEXT", true),
      varcharField("finance_type", 32, "金融类型", "DICT_STAGE"),
      decimalField("loan_amount", "贷款金额"),
      decimalField("interest_rate", "利率", "NUMBER"),
      intField("period_months", "分期期数"),
      varcharField("approval_status", 32, "审批状态", "DICT_STATUS"),
      datetimeField("submit_time", "提交时间"),
      datetimeField("approve_time", "审批时间"),
    ]);
  }

  if (tokenSet.has("delivery") || tokenSet.has("note")) {
    appendFieldsIfMissing(fields, [
      codeField("delivery_no", "交付编号", "TEXT", true),
      varcharField("delivery_status", 32, "交付状态", "DICT_STATUS"),
      codeField("vin_code", "VIN码", "TEXT", true),
      datetimeField("planned_delivery_time", "计划交付时间"),
      datetimeField("actual_delivery_time", "实际交付时间"),
    ]);
  }

  if (tokenSet.has("charging") || tokenSet.has("pile") || tokenSet.has("service")) {
    appendFieldsIfMissing(fields, [
      codeField("service_no", "服务编号", "TEXT", true),
      varcharField("installation_address", 255, "安装地址", "TEXT"),
      varcharField("survey_result", 64, "勘测结果", "TEXT"),
      varcharField("installation_status", 32, "安装状态", "DICT_STATUS"),
      datetimeField("appointment_time", "预约时间"),
      datetimeField("complete_time", "完成时间"),
    ]);
  }

  if (tokenSet.has("follow")) {
    appendFieldsIfMissing(fields, [
      varcharField("follow_type", 32, "跟进类型", "DICT_STAGE"),
      datetimeField("follow_time", "跟进时间"),
      datetimeField("next_follow_time", "下次跟进时间"),
      varcharField("follow_summary", 255, "跟进摘要", "TEXT"),
      varcharField("result_status", 32, "结果状态", "DICT_STATUS"),
    ]);
  }

  if (tokenSet.has("marketing") || tokenSet.has("activity")) {
    appendFieldsIfMissing(fields, [
      codeField("activity_no", "活动编号", "TEXT", true),
      varcharField("activity_name", 128, "活动名称", "TEXT", false),
      varcharField("activity_channel", 32, "活动渠道", "DICT_STAGE"),
      decimalField("budget_amount", "预算金额"),
      datetimeField("start_time", "开始时间"),
      datetimeField("end_time", "结束时间"),
    ]);
  }

  if (tokenSet.has("performance")) {
    appendFieldsIfMissing(fields, [
      codeField("performance_no", "绩效编号", "TEXT", true),
      datetimeField("stat_date", "统计日期"),
      intField("order_count", "订单数"),
      decimalField("order_amount", "订单金额"),
      decimalField("conversion_rate", "转化率", "NUMBER"),
    ]);
  }

  if (businessRole === "MASTER") {
    appendFieldsIfMissing(fields, [
      varcharField("business_status", 32, "业务状态", "DICT_STATUS"),
    ]);
  }

  appendFieldsIfMissing(fields, addAuditFields());
  appendFieldIfMissing(fields, varcharField("remark", 255, "备注", "TEXT"));

  return fields;
}

function buildFieldsFromPlanningSpec(spec, tableName) {
  const plannedFields = Array.isArray(spec?.fields) ? spec.fields : [];
  if (plannedFields.length === 0) {
    return null;
  }
  const fields = [];
  const normalizedTableName = String(tableName || "").trim();
  appendFieldIfMissing(fields, buildResearchPrimaryKeyField(normalizedTableName));
  plannedFields.forEach((fieldName, index) => {
    const normalized = sanitizeIdentifier(fieldName, 64);
    if (!normalized) return;
    if (fields.some((item) => item.fieldName === normalized)) return;
    const lower = String(fieldName).toLowerCase();
    if (/(id|编号|编码|code|no)/i.test(lower) && !/time|日期/.test(lower)) {
      appendFieldIfMissing(fields, codeField(normalized, fieldName, "TEXT", /id|编号|编码|code|no/i.test(lower)));
      return;
    }
    if (/时间|time|date|日期/i.test(lower)) {
      appendFieldIfMissing(fields, datetimeField(normalized, fieldName));
      return;
    }
    if (/金额|费用|price|amount|fee/i.test(lower)) {
      appendFieldIfMissing(fields, decimalField(normalized, fieldName));
      return;
    }
    if (/数量|人数|count|num/i.test(lower)) {
      appendFieldIfMissing(fields, intField(normalized, fieldName));
      return;
    }
    appendFieldIfMissing(fields, varcharField(normalized, 128, fieldName, "TEXT", index !== 0));
  });
  appendFieldsIfMissing(fields, addAuditFields());
  appendFieldIfMissing(fields, varcharField("remark", 255, "备注", "TEXT"));
  return fields;
}

function normalizeSuggestionIdentifier(rawLabel, maxLength = 48) {
  const raw = String(rawLabel || "").trim();
  const normalizedRaw = raw.replace(/字典表|字典/g, "").trim();
  const sanitized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, maxLength);
  if ((sanitized === "" || sanitized === "dict" || sanitized === "scene" || sanitized === "table") && /[\u4e00-\u9fff]/.test(raw)) {
    return buildStableChineseSlug(normalizedRaw || raw, maxLength);
  }
  return sanitized;
}

function buildResearchDictTable(dictTableName, fallbackTemplate) {
  const suggestion = typeof dictTableName === "object" && dictTableName !== null ? dictTableName : { tableName: dictTableName };
  const rawLabel = String(suggestion.dictName || suggestion.tableName || "").trim();
  const sanitized = normalizeSuggestionIdentifier(rawLabel, 48);
  const resolvedTableName = sanitized
    ? (sanitized.endsWith("_dict") ? sanitized : `${sanitized}_dict`)
    : `${buildStableChineseSlug(rawLabel, 40)}_dict`;
  const fallback = (fallbackTemplate?.dictTables || []).find((item) => item.tableName === resolvedTableName);
  if (fallback) {
    return cloneJson(fallback);
  }

  const name = rawLabel.toLowerCase();
  let values = [["DEFAULT", "默认值"], ["OPTION_A", "选项A"], ["OPTION_B", "选项B"]];
  if (name.includes("线路类型")) {
    values = [["MAIN", "主干线"], ["BRANCH", "支线"], ["LOOP", "环线"], ["NIGHT", "夜班线"]];
  } else if (name.includes("车辆类型")) {
    values = [["SINGLE", "单机车"], ["ARTICULATED", "铰接车"], ["DOUBLE", "双层车"], ["ELECTRIC", "纯电公交"]];
  } else if (name.includes("行政区划")) {
    values = [["310000", "上海市"], ["310100", "主城区"], ["310104", "徐汇区"], ["310115", "浦东新区"]];
  } else if (name.includes("调度指令")) {
    values = [["ADD_BUS", "加车"], ["SHORT_TURN", "区间折返"], ["DISPATCH", "临时调度"], ["RECOVER", "恢复正常"]];
  } else if (name.includes("投诉类型")) {
    values = [["DELAY", "晚点"], ["SERVICE", "服务态度"], ["FARE", "票务问题"], ["SAFETY", "安全问题"]];
  }
  if (name.includes("status")) {
    values = [["NEW", "新建"], ["PROCESSING", "处理中"], ["COMPLETED", "已完成"], ["CANCELLED", "已取消"]];
  } else if (name.includes("stage")) {
    values = [["INITIAL", "初始"], ["FOLLOWING", "跟进中"], ["NEGOTIATING", "洽谈中"], ["CLOSED", "已关闭"]];
  } else if (name.includes("source")) {
    values = [["ONLINE", "线上"], ["STORE", "门店"], ["EVENT", "活动"], ["REFERRAL", "转介绍"]];
  } else if (name.includes("level")) {
    values = [["HIGH", "高"], ["MEDIUM", "中"], ["LOW", "低"]];
  } else if (name.includes("energy")) {
    values = [["BEV", "纯电"], ["PHEV", "插混"], ["REEV", "增程"]];
  } else if (name.includes("brand")) {
    values = [["TESLA", "特斯拉"], ["BYD", "比亚迪"], ["NIO", "蔚来"], ["XPENG", "小鹏"]];
  } else if (name.includes("finance")) {
    values = [["LOAN", "贷款"], ["LEASE", "融资租赁"], ["CASH", "全款"]];
  } else if (name.includes("follow")) {
    values = [["PHONE", "电话"], ["WECHAT", "微信"], ["STORE_VISIT", "到店"], ["TEST_DRIVE", "试驾"]];
  } else if (name.includes("channel")) {
    values = [["APP", "APP"], ["STORE", "门店"], ["PHONE", "电话"], ["PARTNER", "合作渠道"]];
  }
  return dictTable(resolvedTableName, `${humanizeResearchTableName(String(suggestion.tableName || "").replace(/_dict$/i, ""))}字典`, values);
}

function buildFieldFromCapabilitySpec(spec, tableName, index = 0) {
  const source = typeof spec === "string" ? { fieldName: spec } : (spec || {});
  const fieldName = sanitizeIdentifier(source.fieldName || source.name || `field_${index + 1}`, 64);
  const fieldType = String(source.fieldType || source.type || "VARCHAR").toUpperCase();
  return {
    fieldName,
    fieldType: fieldType.includes("VARCHAR")
      ? "VARCHAR"
      : fieldType.includes("DATETIME")
        ? "DATETIME"
        : fieldType.includes("DATE")
          ? "DATE"
          : fieldType.includes("DECIMAL")
            ? fieldType
            : fieldType.includes("BIGINT")
              ? "BIGINT"
              : fieldType.includes("INT")
                ? "INT"
                : fieldType.includes("JSON")
                  ? "JSON"
                  : fieldType.includes("TEXT")
                    ? "TEXT"
                    : "VARCHAR",
    fieldLength: source.fieldLength ?? (fieldType.includes("VARCHAR") ? 128 : null),
    nullable: source.nullable ?? true,
    primaryKey: Boolean(source.primaryKey),
    uniqueKey: Boolean(source.uniqueKey),
    foreignKey: Boolean(source.foreignKey),
    foreignRefTable: source.foreignRefTable || source.refTable || "",
    foreignRefField: source.foreignRefField || source.refField || "",
    defaultValue: source.defaultValue ?? null,
    fieldComment: source.fieldComment || source.comment || `${humanizeResearchTableName(tableName)}${humanizeIdentifier(fieldName)}`,
    businessSemantic: source.businessSemantic || source.semantic || "",
    validationRule: source.validationRule || "",
    dirtyRuleCandidates: Array.isArray(source.dirtyRuleCandidates) ? source.dirtyRuleCandidates : [],
  };
}

function getCapabilityFieldSemanticEntries(profile, tableName) {
  const items = Array.isArray(profile?.fieldSemantics) ? profile.fieldSemantics : [];
  return items.filter((item) => {
    const targetTable = sanitizeIdentifier(item?.tableName || "", 48);
    return targetTable ? targetTable === tableName : true;
  });
}

function applyFieldSemanticsToTemplate(template, profile) {
  const nextTemplate = cloneJson(template);
  nextTemplate.tables = (nextTemplate.tables || []).map((table) => {
    const nextTable = { ...table, fields: [...(table.fields || [])] };
    const semanticEntries = getCapabilityFieldSemanticEntries(profile, nextTable.tableName);
    semanticEntries.forEach((entry, index) => {
      appendFieldIfMissing(nextTable.fields, buildFieldFromCapabilitySpec({
        fieldName: entry.fieldName,
        fieldType: entry.fieldType || entry.dataType || "VARCHAR",
        fieldLength: entry.fieldLength ?? null,
        nullable: entry.nullable,
        uniqueKey: entry.uniqueKey,
        primaryKey: entry.primaryKey,
        foreignKey: entry.foreignKey,
        foreignRefTable: entry.foreignRefTable,
        foreignRefField: entry.foreignRefField,
        fieldComment: entry.fieldComment || entry.comment,
        businessSemantic: entry.businessSemantic || entry.semanticType,
        validationRule: entry.validationRule,
      }, nextTable.tableName, index));
    });
    return nextTable;
  });
  return nextTemplate;
}

function getCapabilityCorporaCandidates(profile, tableName, fieldName) {
  const corpora = profile?.valueCorpora && typeof profile.valueCorpora === "object" ? profile.valueCorpora : {};
  const entries = Array.isArray(corpora.entries) ? corpora.entries : [];
  const fieldEntries = entries
    .filter((item) => item && item.fieldName === fieldName && (!item.tableName || sanitizeIdentifier(item.tableName, 48) === tableName))
    .flatMap((item) => Array.isArray(item.values) ? item.values : []);

  const fieldValues = corpora.fields && typeof corpora.fields === "object" && Array.isArray(corpora.fields[fieldName])
    ? corpora.fields[fieldName]
    : [];
  const tableFieldValues = corpora.tableFields
    && typeof corpora.tableFields === "object"
    && corpora.tableFields[tableName]
    && typeof corpora.tableFields[tableName] === "object"
    && Array.isArray(corpora.tableFields[tableName][fieldName])
      ? corpora.tableFields[tableName][fieldName]
      : [];
  return [...fieldEntries, ...tableFieldValues, ...fieldValues].filter((item) => item !== null && item !== undefined && item !== "");
}

function parseCapabilityRelationPatterns(profile) {
  return (Array.isArray(profile?.relationPatterns) ? profile.relationPatterns : [])
    .map((item) => ({
      fromTable: sanitizeIdentifier(item?.fromTable || item?.parentTable || "", 48),
      toTable: sanitizeIdentifier(item?.toTable || item?.childTable || "", 48),
      fromField: item?.fromField || item?.parentKeyField || null,
      toField: item?.toField || item?.childForeignKeyField || null,
      relationType: item?.relationType || "1:N",
    }))
    .filter((item) => item.fromTable && item.toTable);
}

function applySchemaGuidesToTemplate(template, profile) {
  const guides = profile?.schemaGuides && typeof profile.schemaGuides === "object" ? profile.schemaGuides : {};
  const commonRequiredFields = Array.isArray(guides.commonRequiredFields) ? guides.commonRequiredFields : [];
  const requiredFieldsByTable = guides.requiredFieldsByTable && typeof guides.requiredFieldsByTable === "object"
    ? guides.requiredFieldsByTable
    : {};
  const requiredAuditFields = guides.requireAuditFields === true;
  const regionFieldTables = Array.isArray(guides.regionFieldTables) ? guides.regionFieldTables.map((item) => sanitizeIdentifier(item, 48)) : [];
  const forbiddenFieldPatterns = Array.isArray(guides.forbiddenFieldPatterns) ? guides.forbiddenFieldPatterns : [];
  const nextTemplate = cloneJson(template);

  nextTemplate.tables = (nextTemplate.tables || []).map((table) => {
    const nextTable = { ...table, fields: [...(table.fields || [])] };
    commonRequiredFields.forEach((field, index) => appendFieldIfMissing(nextTable.fields, buildFieldFromCapabilitySpec(field, nextTable.tableName, index)));
    const tableRequiredFields = Array.isArray(requiredFieldsByTable[nextTable.tableName]) ? requiredFieldsByTable[nextTable.tableName] : [];
    tableRequiredFields.forEach((field, index) => appendFieldIfMissing(nextTable.fields, buildFieldFromCapabilitySpec(field, nextTable.tableName, commonRequiredFields.length + index)));
    if (requiredAuditFields) {
      appendFieldsIfMissing(nextTable.fields, addAuditFields());
    }
    if (regionFieldTables.includes(nextTable.tableName)) {
      appendFieldsIfMissing(nextTable.fields, addRegionFields());
    }
    if (forbiddenFieldPatterns.length > 0) {
      nextTable.fields = nextTable.fields.filter((field) => {
        const name = String(field.fieldName || "");
        return !forbiddenFieldPatterns.some((pattern) => {
          try {
            return new RegExp(String(pattern), "i").test(name);
          } catch {
            return String(pattern).toLowerCase() === name.toLowerCase();
          }
        });
      });
    }
    return nextTable;
  });

  return nextTemplate;
}

function applyCapabilityCodeRulesToTemplate(template, profile) {
  const codeRules = Array.isArray(profile?.codeRules) ? profile.codeRules : [];
  if (codeRules.length === 0) return template;
  const nextTemplate = cloneJson(template);
  nextTemplate.tables = (nextTemplate.tables || []).map((table) => {
    const nextTable = { ...table, fields: [...(table.fields || [])] };
    codeRules
      .filter((rule) => sanitizeIdentifier(rule?.tableName || "", 48) === nextTable.tableName)
      .forEach((rule) => {
        const targetField = sanitizeIdentifier(rule?.fieldName || rule?.targetField || rule?.ruleConfig?.targetField || "", 64);
        if (!targetField) return;
        if (!nextTable.fields.find((field) => field.fieldName === targetField)) {
          appendFieldIfMissing(nextTable.fields, codeField(targetField, rule.ruleName || `${humanizeIdentifier(targetField)}编码`, "TEXT", true));
        }
      });
    return nextTable;
  });
  return nextTemplate;
}

function parseResearchRelationSuggestions(researchPack) {
  return [...new Set((researchPack?.relationSuggestions || []).map((item) => String(item || "").trim()).filter(Boolean))]
    .map((item) => {
      const matched = item.match(/([a-zA-Z0-9_]+)\s*(?:->|=>|→)\s*([a-zA-Z0-9_]+)/);
      if (!matched) return null;
      return { fromTable: matched[1], toTable: matched[2] };
    })
    .filter(Boolean);
}

function normalizeIndustryResearchTableName(tableName, industry) {
  const rawLabel = String(tableName || "").trim();
  const raw = String(rawLabel || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 48);
  if (!raw && /[\u4e00-\u9fff]/.test(rawLabel)) {
    return buildStableChineseSlug(rawLabel, 48);
  }
  if (!raw) return "";
  const genericNames = new Set(["scene", "fact", "fact_", "dim", "dim_", "rpt", "data", "dataset", "record", "table", "tables"]);
  if (genericNames.has(raw)) return "";

  const aliasByIndustry = {
    ecommerce: {
      spu: "product_spu",
      sku: "product_sku",
      dim_spu: "product_spu",
      dim_sku: "product_sku",
      customer: "customer_profile",
      member: "customer_profile",
      order: "order_header",
      payment: "payment_record",
      refund: "refund_ticket",
      store: "merchant_store",
      merchant: "merchant_store",
      delivery: "logistics_delivery",
      logistics: "logistics_delivery",
      inventory: "inventory_snapshot",
      product: "product_spu",
    },
    traffic: {
      vehicle: "vehicle_archive",
      owner: "owner_profile",
      violation: "violation_record",
      payment: "penalty_payment",
      inspection: "checkpoint_inspection",
      checkpoint: "checkpoint_inspection",
      accident: "accident_case",
      dispatch: "dispatch_task",
      patrol: "patrol_log",
      document: "enforcement_document",
      registration: "registration_record",
    },
  };

  const aliasMap = aliasByIndustry[String(industry || "").toLowerCase()] || {};
  if (aliasMap[raw]) return aliasMap[raw];
  if (/^dim_/.test(raw)) {
    const suffix = raw.replace(/^dim_/, "");
    if (aliasMap[suffix]) return aliasMap[suffix];
  }
  if (/^fact_/.test(raw)) {
    const suffix = raw.replace(/^fact_/, "");
    if (aliasMap[suffix]) return aliasMap[suffix];
  }
  return raw;
}

function normalizeResearchCandidateTables(candidateTables, industry) {
  return [...new Set((candidateTables || [])
    .map((item) => normalizeIndustryResearchTableName(item, industry))
    .filter(Boolean))];
}

function parseResearchRelationSuggestionsV2(researchPack) {
  return [...new Set((researchPack?.relationSuggestions || []).map((item) => String(item || "").trim()).filter(Boolean))]
    .map((item) => {
      const matched = item.match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
      if (!matched) return null;
      return { fromTable: matched[1].trim(), toTable: matched[2].trim() };
    })
    .filter(Boolean);
}

function normalizeIndustryResearchTableNameV2(tableName, industry) {
  const rawLabel = String(tableName || "").trim();
  const chineseMapped = incubationAssetMap.mapChineseResearchTableAlias(industry, rawLabel);
  if (chineseMapped) return chineseMapped;
  return normalizeIndustryResearchTableName(rawLabel, industry);
}

function normalizeResearchCandidateTablesV2(candidateTables, industry) {
  return [...new Set((candidateTables || [])
    .map((item) => normalizeIndustryResearchTableNameV2(item, industry))
    .filter(Boolean))];
}

function buildActivePlannerModulesForSchema(profile) {
  const plannerModules = Array.isArray(profile?.modulePlanner?.modules) ? profile.modulePlanner.modules : [];
  const matchedKeys = new Set(
    (Array.isArray(profile?.modulePlan?.matchedModules) ? profile.modulePlan.matchedModules : [])
      .flatMap((item) => [item?.moduleKey, item?.moduleLabel, item?.moduleName])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  if (matchedKeys.size > 0) {
    return plannerModules.filter((item) => {
      const tokens = [item?.moduleKey, item?.moduleLabel, item?.summary].map((value) => String(value || "").trim()).filter(Boolean);
      return tokens.some((token) => matchedKeys.has(token));
    });
  }
  return plannerModules;
}

function buildSceneScopedCandidateTablesForSchema(profile, baseCandidateTables) {
  const activeModules = buildActivePlannerModulesForSchema(profile);
  if (!Array.isArray(activeModules) || activeModules.length === 0) {
    return normalizeResearchCandidateTablesV2(baseCandidateTables || [], profile?.industry);
  }
  const selectedTables = [...new Set(activeModules.flatMap((item) => [...(item?.expectedTables || []), ...(item?.focusTables || [])]).map((value) => normalizeIndustryResearchTableNameV2(value, profile?.industry)).filter(Boolean))];
  if (selectedTables.length === 0) {
    return normalizeResearchCandidateTablesV2(baseCandidateTables || [], profile?.industry);
  }
  const supportTables = new Set(selectedTables);
  if (String(profile?.industry || "") === "traffic") {
    if (selectedTables.some((item) => ["appeal_application", "appeal_review_case", "review_decision_notice", "enforcement_document"].includes(item))) {
      ["violation_record", "vehicle_archive", "owner_profile", "checkpoint_inspection", "penalty_payment", "registration_record", "violation_image_evidence", "violation_notice_record", "notice_delivery_record"].forEach((item) => supportTables.add(item));
    }
  }
  if (String(profile?.industry || "") === "ecommerce") {
    if (selectedTables.some((item) => ["order_header", "payment_record", "refund_ticket", "logistics_delivery"].includes(item))) {
      ["customer_profile", "customer_address", "merchant_store", "product_spu", "product_sku", "inventory_snapshot", "order_item"].forEach((item) => supportTables.add(item));
    }
  }
  return [...supportTables];
}

function filterProfileByCandidateTables(profile, candidateTables) {
  const tableSet = new Set((candidateTables || []).map((item) => String(item || "").trim()).filter(Boolean));
  if (tableSet.size === 0) {
    return profile;
  }
  const nextProfile = { ...profile };
  nextProfile.fieldSemantics = (Array.isArray(profile?.fieldSemantics) ? profile.fieldSemantics : []).filter((item) => {
    const tableName = String(item?.tableName || "").trim();
    return !tableName || tableSet.has(tableName);
  });
  nextProfile.codeRules = (Array.isArray(profile?.codeRules) ? profile.codeRules : []).filter((item) => {
    const tableName = String(item?.tableName || "").trim();
    return !tableName || tableSet.has(tableName);
  });
  nextProfile.stateMachines = (Array.isArray(profile?.stateMachines) ? profile.stateMachines : []).filter((item) => {
    const tableName = String(item?.tableName || "").trim();
    return !tableName || tableSet.has(tableName);
  });
  nextProfile.relationPatterns = (Array.isArray(profile?.relationPatterns) ? profile.relationPatterns : []).filter((item) => {
    const fromTable = String(item?.fromTable || item?.parentTable || "").trim();
    const toTable = String(item?.toTable || item?.childTable || "").trim();
    return (!fromTable || tableSet.has(fromTable)) && (!toTable || tableSet.has(toTable));
  });
  if (nextProfile.schemaGuides && typeof nextProfile.schemaGuides === "object" && nextProfile.schemaGuides.requiredFieldsByTable && typeof nextProfile.schemaGuides.requiredFieldsByTable === "object") {
    nextProfile.schemaGuides = {
      ...nextProfile.schemaGuides,
      requiredFieldsByTable: Object.fromEntries(
        Object.entries(nextProfile.schemaGuides.requiredFieldsByTable)
          .filter(([tableName]) => tableSet.has(String(tableName || "").trim()))
      ),
    };
  }
  return nextProfile;
}

function buildResearchDrivenTemplate(researchPack, profile, fallbackTemplate) {
  const candidateTables = buildSceneScopedCandidateTablesForSchema(profile, researchPack?.candidateTables || []);
  const sceneScopedProfile = filterProfileByCandidateTables(profile, candidateTables);
  const relationPairs = [...parseResearchRelationSuggestionsV2(researchPack), ...parseCapabilityRelationPatterns(sceneScopedProfile)]
    .map((pair) => ({
      ...pair,
      fromTable: normalizeIndustryResearchTableNameV2(pair.fromTable, profile?.industry),
      toTable: normalizeIndustryResearchTableNameV2(pair.toTable, profile?.industry),
    }))
    .filter((pair) => pair.fromTable && pair.toTable && pair.fromTable !== pair.toTable);
  const plannerModules = buildActivePlannerModulesForSchema(sceneScopedProfile);
  plannerModules.forEach((module) => {
    const assets = incubationAssetMap.findIndustryModuleAssets(sceneScopedProfile?.industry, module?.moduleKey || module?.moduleLabel || module?.summary);
    if (!assets) return;
    (assets.tables || []).forEach((tableName) => {
      const normalized = normalizeIndustryResearchTableNameV2(tableName, sceneScopedProfile?.industry);
      if (normalized && !candidateTables.includes(normalized)) candidateTables.push(normalized);
    });
    (assets.relations || []).forEach((value) => {
      const matched = String(value || "").match(/(.+?)\s*(?:->|=>|→)\s*(.+)/);
      if (!matched) return;
      const fromTable = normalizeIndustryResearchTableNameV2(matched[1].trim(), sceneScopedProfile?.industry);
      const toTable = normalizeIndustryResearchTableNameV2(matched[2].trim(), sceneScopedProfile?.industry);
      if (fromTable && toTable && fromTable !== toTable) {
        relationPairs.push({ fromTable, toTable });
      }
    });
  });
  relationPairs.forEach((pair) => {
    if (!candidateTables.includes(pair.fromTable)) candidateTables.push(pair.fromTable);
    if (!candidateTables.includes(pair.toTable)) candidateTables.push(pair.toTable);
  });
  if (candidateTables.length === 0) {
    return null;
  }

  const relationStats = candidateTables.reduce((result, tableName) => {
    result[tableName] = { incoming: 0, outgoing: 0 };
    return result;
  }, {});

  relationPairs.forEach((pair) => {
    if (relationStats[pair.fromTable]) relationStats[pair.fromTable].outgoing += 1;
    if (relationStats[pair.toTable]) relationStats[pair.toTable].incoming += 1;
  });

  const fallbackTableMap = new Map((fallbackTemplate?.tables || []).map((table) => [table.tableName, cloneJson(table)]));
  const candidateTableSpecMap = new Map(
    (Array.isArray(researchPack?.candidateTableSpecs) ? researchPack.candidateTableSpecs : [])
      .map((item) => [normalizeIndustryResearchTableNameV2(item?.tableName, sceneScopedProfile?.industry), item])
      .filter((item) => item[0])
  );
  const tables = candidateTables.map((tableName, index) => {
    const fallback = fallbackTableMap.get(tableName);
    if (fallback) {
      return {
        ...fallback,
        generationPriority: index + 1,
      };
    }
    const businessRole = deriveResearchBusinessRole(tableName, relationStats[tableName]);
    const spec = candidateTableSpecMap.get(tableName);
    const planningFields = buildFieldsFromPlanningSpec(spec, tableName);
    return {
      tableName,
      tableComment: (spec?.tableComment && !/^[A-Za-z\s]+$/.test(spec.tableComment))
        ? spec.tableComment
        : (spec?.description && !/^[A-Za-z\s]+$/.test(spec.description))
        ? spec.description
        : buildResearchTableComment(tableName),
      businessRole,
      generationPriority: index + 1,
      fields: planningFields || buildResearchHeuristicFields(tableName, businessRole),
    };
  });

  const tableMap = new Map(tables.map((table) => [table.tableName, table]));
  const relations = [];
  relationPairs.forEach((pair) => {
    const parent = tableMap.get(pair.fromTable);
    const child = tableMap.get(pair.toTable);
    if (!parent || !child) return;
    const parentPk = pair.fromField
      ? ((parent.fields || []).find((field) => field.fieldName === pair.fromField) || buildResearchPrimaryKeyField(parent.tableName))
      : ((parent.fields || []).find((field) => field.primaryKey) || buildResearchPrimaryKeyField(parent.tableName));
    const fkName = pair.toField || parentPk.fieldName;
    appendFieldIfMissing(child.fields, fkField(fkName, "BIGINT", `${humanizeResearchTableName(parent.tableName)}主键`, parent.tableName, parentPk.fieldName));
    appendUniqueRelations(relations, [relation(parent.tableName, parentPk.fieldName, child.tableName, fkName, pair.relationType || "1:N")]);
  });

  const dictSuggestionMap = new Map();
  const rawDictSuggestions = Array.isArray(researchPack?.dictSuggestionSpecs) && researchPack.dictSuggestionSpecs.length > 0
    ? researchPack.dictSuggestionSpecs
    : (Array.isArray(researchPack?.dictSuggestions) ? researchPack.dictSuggestions : []);
  rawDictSuggestions.forEach((item, index) => {
    const suggestion = typeof item === "object" && item !== null
      ? { tableName: item.tableName || item.table || item.name || "", dictName: item.dictName || item.tableName || item.table || item.name || "", ...item }
      : { tableName: item, dictName: item };
    const rawLabel = String(suggestion.dictName || suggestion.tableName || "").trim();
    const tableName = normalizeSuggestionIdentifier(rawLabel, 48);
    const key = tableName || `${buildStableChineseSlug(rawLabel || `dict_${index + 1}`, 40)}_dict`;
    if (!key) return;
    dictSuggestionMap.set(key, suggestion);
  });
  const dictTables = Array.from(dictSuggestionMap.values()).map((item) => buildResearchDictTable(item, fallbackTemplate));

  const guidedTemplate = applyFieldSemanticsToTemplate(applySchemaGuidesToTemplate({
    tables,
    dictTables,
    relations,
    modelExplanation: researchPack?.summary || fallbackTemplate?.modelExplanation || "基于场景调研生成表设计。",
  }, sceneScopedProfile), sceneScopedProfile);

  return applyChineseLocalizationToTemplate(applyCapabilityCodeRulesToTemplate(guidedTemplate, sceneScopedProfile));
}

function inferScenarioTemplate(input) {
  const profile = scenarioEngine.buildScenarioProfile(input);
  if (profile.industry === "marriage") return { template: augmentTemplateByProfile(buildMarriageTemplate(), profile), profile };
  if (profile.industry === "education") {
    return {
      template: augmentTemplateByProfile(educationSupport.buildEducationTemplate({
        relation,
        dictTable,
        pkField,
        fkField,
        varcharField,
        datetimeField,
        intField,
        decimalField,
        codeField,
        addAuditFields,
        addRegionFields,
      }), profile),
      profile,
    };
  }
  if (profile.industry === "ecommerce") return { template: augmentTemplateByProfile(buildRichEcommerceTemplate(), profile), profile };
  if (profile.industry === "crm") return { template: augmentTemplateByProfile(buildCrmTemplate(), profile), profile };
  if (profile.industry === "traffic") return { template: augmentTemplateByProfile(buildRichTrafficTemplate(), profile), profile };
  if (profile.industry === "bank_regulatory") return { template: augmentTemplateByProfile(buildRichBankRegulatoryTemplate(), profile), profile };
  if (profile.industry === "finance_fund") return { template: augmentTemplateByProfile(buildRichFinanceFundTemplate(), profile), profile };
  if (profile.industry === "logistics_express") return { template: augmentTemplateByProfile(buildRichLogisticsExpressTemplate(), profile), profile };
  return { template: null, profile };
}

function generateSchemaPayload(input) {
  const { template: fallbackTemplate, profile } = inferScenarioTemplate(input);
  const autoResearchFallbackTemplate = input.autoResearchMode ? null : fallbackTemplate;
  const researchTemplate = buildResearchDrivenTemplate(input.researchPack, profile, autoResearchFallbackTemplate);
  const template = researchTemplate || autoResearchFallbackTemplate;
  if (!template || !Array.isArray(template.tables) || template.tables.length === 0) {
    throw new Error("NO_SCENE_SPECIFIC_SCHEMA_TEMPLATE");
  }
  return {
    sceneName: input.sceneName,
    scenarioProfile: profile,
    researchPack: input.researchPack || null,
    autoResearchMode: Boolean(input.autoResearchMode),
    modulePlan: profile.modulePlan || null,
    conceptPlan: profile.conceptPlan || profile.modulePlan?.conceptPlan || null,
    knowledgeSummary: profile.knowledgeSummary || profile.modulePlan?.knowledgeSummary || null,
    tables: (template.tables || []).map((table) => ({
      ...table,
      fields: [...(table.fields || [])],
    })),
    dictTables: template.dictTables,
    relations: template.relations,
    modelExplanation: template.modelExplanation,
    planningExplanation: [profile.modulePlan?.summary, input.researchPack?.summary].filter(Boolean).join(" ") || null,
    adjustments: [],
  };
}

function applySchemaAdjustment(schema, adjustmentPrompt) {
  const next = JSON.parse(JSON.stringify(schema));
  const prompt = String(adjustmentPrompt || "").trim();
  const summaries = [];
  const addTableMatch = prompt.match(/增加(?:一个)?(.+?)表/);
  if (addTableMatch) {
    const tableToken = sanitizeIdentifier(addTableMatch[1]);
    next.tables.push({ tableName: tableToken, tableComment: `${addTableMatch[1]}表`, businessRole: "DETAIL", generationPriority: next.tables.length + 1, fields: [pkField(`${tableToken}_id`, "BIGINT", "主键"), varcharField("biz_code", 64, "业务编码", "ORDER_NO", false, true), varcharField("biz_name", 128, "业务名称", "TEXT"), datetimeField("created_at", "创建时间")] });
    summaries.push(`新增表 ${tableToken}`);
  }
  const addFieldMatch = prompt.match(/(.+?)表增加(.+?)字段/);
  if (addFieldMatch) {
    const tableToken = sanitizeIdentifier(addFieldMatch[1]);
    const fieldToken = sanitizeIdentifier(addFieldMatch[2]);
    const target = next.tables.find((item) => item.tableName === tableToken || item.tableComment.includes(addFieldMatch[1]));
    if (target && !target.fields.find((item) => item.fieldName === fieldToken)) {
      target.fields.push(varcharField(fieldToken, 128, `${addFieldMatch[2]}字段`, "TEXT"));
      summaries.push(`在 ${target.tableName} 新增字段 ${fieldToken}`);
    }
  }
  const deleteFieldMatch = prompt.match(/删除(.+?)字段/);
  if (deleteFieldMatch) {
    const fieldToken = sanitizeIdentifier(deleteFieldMatch[1]);
    next.tables.forEach((table) => {
      const before = table.fields.length;
      table.fields = table.fields.filter((field) => field.fieldName !== fieldToken);
      if (before !== table.fields.length) summaries.push(`从 ${table.tableName} 删除字段 ${fieldToken}`);
    });
  }
  if (/手机号.*唯一/.test(prompt)) {
    next.tables.forEach((table) => {
      const mobileField = table.fields.find((field) => field.fieldName === "mobile" || field.fieldName === "contact_mobile");
      if (mobileField) mobileField.uniqueKey = true;
    });
    summaries.push("将手机号字段设为唯一");
  }
  if (/邮箱/.test(prompt) && /增加/.test(prompt)) {
    next.tables.forEach((table) => {
      if (table.businessRole === "MASTER" && !table.fields.find((field) => field.fieldName === "email")) {
        table.fields.push(varcharField("email", 128, "邮箱", "EMAIL"));
        summaries.push(`在 ${table.tableName} 新增邮箱字段`);
      }
    });
  }
  next.adjustments = [...(next.adjustments || []), { prompt, at: new Date().toISOString(), summary: summaries.join("；") || "已记录调整" }];
  return { schema: next, summary: summaries.join("；") || "根据当前描述记录了一次调整，但未匹配到明确结构变更" };
}

function inferFieldGenerator(field) {
  const semantic = String(field.businessSemantic || "").toUpperCase();
  const fieldName = String(field.fieldName || "").toLowerCase();
  const rawType = String(field.fieldType || "").toUpperCase();
  if (field.primaryKey) return "SEQUENCE_ID";
  if (field.foreignKey) return "FK_REFERENCE";
  if (semantic.includes("ID_CARD") || fieldName.includes("id_card")) return "ID_CARD";
  if (semantic.includes("PHONE") || fieldName.includes("mobile")) return "PHONE";
  if (semantic.includes("EMAIL") || fieldName.includes("email")) return "EMAIL";
  if (semantic.includes("PERSON_NAME") || fieldName.includes("name")) return "CN_NAME";
  if (semantic.includes("AMOUNT") || fieldName.includes("amount") || fieldName.includes("price")) return "AMOUNT";
  if (semantic.includes("DATETIME") || rawType.includes("DATE") || rawType.includes("TIME")) return "DATETIME";
  if (semantic.includes("DICT") || fieldName.includes("status") || fieldName.includes("type")) return "ENUM";
  if ((fieldName.endsWith("_id") || fieldName === "id") && (rawType.includes("INT") || rawType.includes("DECIMAL") || rawType.includes("NUM"))) return "NUMBER_RANGE";
  if (rawType.includes("INT") || rawType.includes("DECIMAL") || rawType.includes("NUM")) return "NUMBER_RANGE";
  return "TEXT_TEMPLATE";
}

function classifyStrategyTableBucket(table) {
  const tableName = String(table?.tableName || "").toLowerCase();
  const businessRole = String(table?.businessRole || "").toUpperCase();
  if (/refund|exception|alert|approval|document|accident|task/.test(tableName)) return "sparse";
  if (businessRole === "LOG") return "log";
  if (businessRole === "FLOW") return "flow";
  if (businessRole === "MASTER") return "master";
  if (businessRole === "DETAIL") return "detail";
  return "detail";
}

function allocateExactRows(totalRows, items, minimumRows, weightSelector) {
  const total = Math.max(0, Math.round(Number(totalRows || 0)));
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  if (total === 0) {
    return items.map(() => 0);
  }
  const safeMinimum = Math.max(0, Math.round(Number(minimumRows || 0)));
  const base = Math.min(safeMinimum, Math.floor(total / items.length));
  const weighted = items.map((item, index) => ({
    index,
    weight: Math.max(0, Number(weightSelector(item, index) || 0)),
    value: base,
    fraction: 0,
  }));
  const baseRemaining = total - base * items.length;
  const totalWeight = weighted.reduce((sum, item) => sum + (item.weight || 1), 0) || weighted.length;
  let remaining = baseRemaining;
  weighted.forEach((item) => {
    const exact = baseRemaining > 0 ? (baseRemaining * (item.weight || 1)) / totalWeight : 0;
    const whole = Math.floor(exact);
    item.value += whole;
    item.fraction = exact - whole;
    remaining -= whole;
  });
  weighted
    .slice()
    .sort((left, right) => {
      if (right.fraction !== left.fraction) {
        return right.fraction - left.fraction;
      }
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }
      return left.index - right.index;
    })
    .slice(0, Math.max(0, remaining))
    .forEach((item) => {
      weighted[item.index].value += 1;
    });
  return weighted.map((item) => item.value);
}

function hashText(value) {
  return String(value || "").split("").reduce((hash, ch) => ((hash * 131) + ch.charCodeAt(0)) % 2147483647, 7);
}

function containsChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function pickRealismLocation(profile, seed = 1) {
  const profileCities = Array.isArray(profile?.cities) && profile.cities.length > 0 ? profile.cities : [];
  const candidate = profileCities[(Math.max(1, Number(seed || 1)) - 1) % Math.max(1, profileCities.length)] || REALISM_LOCATION_CORPUS[(Math.max(1, Number(seed || 1)) - 1) % REALISM_LOCATION_CORPUS.length];
  const matchedCorpus = REALISM_LOCATION_CORPUS.find((item) => item.code === candidate?.code || item.cityName === candidate?.name) || {};
  return {
    code: candidate?.code || matchedCorpus.code || "310000",
    provinceName: matchedCorpus.provinceName || candidate?.provinceName || candidate?.name || "\u4e0a\u6d77\u5e02",
    cityName: candidate?.name || matchedCorpus.cityName || "\u4e0a\u6d77\u5e02",
    districts: Array.isArray(candidate?.districts) && candidate.districts.length > 0 ? candidate.districts : (matchedCorpus.districts || ["\u6d66\u4e1c\u65b0\u533a"]),
    streets: matchedCorpus.streets || REALISM_GENERIC_STREETS,
    compounds: matchedCorpus.compounds || REALISM_GENERIC_COMPOUNDS,
    officeSuffixes: matchedCorpus.officeSuffixes || REALISM_GENERIC_OFFICES,
  };
}

function buildChineseAddressValue(profile, seed = 1, options = {}) {
  const location = pickRealismLocation(profile, seed);
  const district = options.districtName || location.districts[hashText(`${location.code}:${seed}:district`) % location.districts.length] || location.cityName;
  const streets = Array.isArray(options.streetOptions) && options.streetOptions.length > 0 ? options.streetOptions : location.streets;
  const compounds = Array.isArray(options.compounds) && options.compounds.length > 0 ? options.compounds : location.compounds;
  const street = streets[hashText(`${location.code}:${seed}:street`) % streets.length] || REALISM_GENERIC_STREETS[0];
  const compound = compounds[hashText(`${location.code}:${seed}:compound`) % compounds.length] || REALISM_GENERIC_COMPOUNDS[0];
  const streetNo = (Math.max(1, Number(seed || 1)) % 160) + 1;
  const buildingNo = (Math.max(1, Number(seed || 1)) % 18) + 1;
  const unitNo = (Math.max(1, Number(seed || 1)) % 4) + 1;
  const roomNo = (Math.max(1, Number(seed || 1)) % 220) + 101;
  if (options.style === "site") {
    return `${location.cityName}${district}${street}${streetNo}号`;
  }
  return `${location.cityName}${district}${street}${streetNo}号${compound}${buildingNo}栋${unitNo}单元${roomNo}室`;
}

function buildRealisticOfficeName(profile, seed = 1) {
  const location = pickRealismLocation(profile, seed);
  const suffixes = location.officeSuffixes || REALISM_GENERIC_OFFICES;
  const suffix = suffixes[hashText(`${location.code}:${seed}:office`) % suffixes.length] || REALISM_GENERIC_OFFICES[0];
  return `${location.cityName}${suffix}`;
}

function buildProvinceCodeFromCityCode(cityCode) {
  const normalized = String(cityCode || "").replace(/\D/g, "");
  if (normalized.length !== 6) return String(cityCode || "");
  if (normalized.endsWith("0000")) return normalized;
  return `${normalized.slice(0, 2)}0000`;
}

function buildPostalCodeFromRegionCode(regionCode, seed = 1) {
  const location = REALISM_LOCATION_CORPUS.find((item) => item.code === String(regionCode || ""));
  const baseMap = {
    "310000": 200000,
    "320100": 210000,
    "330100": 310000,
    "440300": 518000,
    "510100": 610000,
  };
  const base = baseMap[String(regionCode || "")] || baseMap[location?.code || ""] || 100000;
  return String(base + (Math.max(1, Number(seed || 1)) % 200)).padStart(6, "0");
}

function buildRealisticFundCode(sceneCode, tableName, serial) {
  const numeric = ((hashText(`${sceneCode}:${tableName}:fund`) + (Math.max(1, Number(serial || 1)) * 37)) % 900000) + 100000;
  return String(numeric).padStart(6, "0");
}

function looksSequentialIdentifier(value) {
  return /^[A-Z]{1,6}\d{6,}$/i.test(String(value || "").trim()) || /^\d{8,}$/.test(String(value || "").trim());
}

function shouldNormalizeBusinessIdentifier(fieldName) {
  return /(^|_)(order_no|apply_no|payment_no|refund_no|delivery_no|case_no|session_no|batch_no|contract_no|account_no|waybill_no|package_no|route_code|transfer_no|sign_no|exception_no|student_no|staff_no|course_code|classroom_code|resident_no|proof_no)$/.test(String(fieldName || "").toLowerCase())
    || String(fieldName || "").toLowerCase() === "etl_batch_no";
}

function buildNonSequentialBusinessIdentifier(fieldName, currentValue, sceneCode, tableName, serial, startedAt) {
  const normalizedFieldName = String(fieldName || "").replace(/[^a-z]/gi, "");
  const existingPrefix = String(currentValue || "").trim().match(/^[A-Za-z]+/)?.[0];
  const prefix = String(existingPrefix || normalizedFieldName.slice(0, 4) || "NO").toUpperCase().slice(0, 6);
  const datePart = new Date(startedAt || Date.now()).toISOString().slice(2, 10).replace(/-/g, "");
  const hashPart = String(hashText(`${sceneCode}:${tableName}:${fieldName}`) % 900).padStart(3, "0");
  const serialPart = String((((Math.max(1, Number(serial || 1)) * 7919) + hashText(`${fieldName}:${tableName}`)) % 900000) + 100000).slice(-6);
  return `${prefix}${datePart}${hashPart}${serialPart}`;
}

function buildLongPrimaryKey(sceneCode, tableName, tableOrder, serial) {
  const orderPart = Math.max(1, Number(tableOrder || 1));
  const scenePart = (hashText(`${sceneCode}:${tableName}`) % 9000) + 1000;
  const serialPart = (((Math.max(1, Number(serial || 1)) * 7919) + hashText(tableName)) % 90000000) + 10000000;
  return Number((orderPart * 1000000000000) + (scenePart * 100000000) + serialPart);
}

function generateStrategyPayload(scene, schema, options = {}) {
  const initVolume = Number(options.initVolume || scene.initVolume || 1000);
  const incrVolume = Number(options.incrVolume || scene.incrVolume || 100);
  const dirtyRatio = Number(options.dirtyRatio ?? scene.dirtyRatio ?? 0);
  const dirtyEnabled = dirtyRatio > 0;
  const realtimeEnabled = Boolean(options.realtimeEnabled ?? scene.realtimeEnabled);
  const sceneCode = scene.sceneCode || normalizeSceneCode(scene.sceneName);
  const orderedTables = [...schema.tables].sort((a, b) => (a.generationPriority || 1) - (b.generationPriority || 1));
  const totalWeight = orderedTables.reduce((sum, table) => sum + Math.max(1, 6 - (table.generationPriority || 1)), 0);
  const initAllocations = allocateExactRows(initVolume, orderedTables, 5, (table) => Math.max(1, 6 - (table.generationPriority || 1)));
  const incrAllocations = allocateExactRows(incrVolume, orderedTables, 0, (table) => Math.max(1, 6 - (table.generationPriority || 1)));
  const scenarioProfile = schema.scenarioProfile || scenarioEngine.buildScenarioProfile({
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    knowledgeText: "",
  });
  const fieldRules = Array.isArray(scenarioProfile.fieldRules) ? scenarioProfile.fieldRules.filter((item) => item.status !== "inactive") : [];
  const strategyFields = orderedTables.flatMap((table) => (table.fields || []).map((field) => ({
    tableName: table.tableName,
    fieldName: field.fieldName,
    fieldComment: field.fieldComment,
    businessSemantic: field.businessSemantic,
    fieldType: field.fieldType,
  })));
  const fieldSemanticMap = ruleMatching.buildFieldSemanticMap(strategyFields);
  return extendedRuleEngine.applyCardinalityRulesToStrategy({
    sceneCode,
    scenarioProfile,
    globalConfig: {
      initVolume,
      incrementVolume: incrVolume,
      incrementCycle: options.incrCycle || scene.incrCycle || "DAILY",
      realtimeEnabled,
      dirtyEnabled,
      dirtyRatio,
      dirtyProfile: options.dirtyProfile || {
        COMPLETENESS: 26,
        CONSISTENCY: 24,
        ACCURACY: 22,
        COMPLIANCE: 18,
        TIMELINESS: 10,
        UNIQUENESS: 8,
      },
      distributionMode: options.distributionMode || "BUSINESS_REALISTIC",
      startTime: options.startTime || new Date().toISOString(),
    },
    tableGenerationOrder: orderedTables.map((item) => item.tableName),
    tables: orderedTables.map((table, index) => {
      const initRows = Number(initAllocations[index] || 0);
      const incrRows = Number(incrAllocations[index] || 0);
      return {
        tableName: table.tableName,
        businessRole: table.businessRole,
        initRows,
        incrRows,
        dependsOn: table.fields.filter((field) => field.foreignKey).map((field) => field.foreignRefTable),
        writeMode: realtimeEnabled && table.businessRole !== "MASTER" ? "MYSQL_AND_KAFKA" : "MYSQL_ONLY",
        topicName: `lab.scene.${sceneCode}.${table.tableName}`,
        fieldGenerators: table.fields.map((field) => {
          const matchedRule = ruleMatching.matchFieldRuleForField(fieldRules, {
            tableName: table.tableName,
            fieldName: field.fieldName,
            fieldComment: field.fieldComment,
            businessSemantic: field.businessSemantic,
            fieldType: field.fieldType,
          }, { fieldSemanticMap })?.rule;
          return {
            fieldName: field.fieldName,
            generatorType: matchedRule?.generatorType || inferFieldGenerator(field),
            nullable: field.nullable,
            dirtyRules: field.dirtyRuleCandidates || [],
          };
        })
      };
    }),
    strategyExplanation: `按 ${orderedTables.length} 张业务表自动分配存量 ${initVolume} 行、增量 ${incrVolume} 行，并保留 Kafka 实时事件映射。`
  }, scenarioProfile);
}

function applyStrategyAdjustment(strategy, adjustmentPrompt) {
  const next = JSON.parse(JSON.stringify(strategy));
  const prompt = String(adjustmentPrompt || "");
  const summaries = [];
  const bucketOverrides = {};
  const incrMatch = prompt.match(/增量.*?(\d+)/);
  const incrAscii = prompt.match(/INCR_ROWS\s*=\s*(\d+)/i);
  const incrValue = incrAscii ? Number(incrAscii[1]) : incrMatch ? Number(incrMatch[1]) : null;
  if (incrValue !== null) {
    next.globalConfig.incrementVolume = incrValue;
    summaries.push(`调整增量规模为 ${incrValue}`);
  }
  const initMatch = prompt.match(/存量.*?(\d+)/);
  const initAscii = prompt.match(/INIT_ROWS\s*=\s*(\d+)/i);
  const initValue = initAscii ? Number(initAscii[1]) : initMatch ? Number(initMatch[1]) : null;
  if (initValue !== null) {
    next.globalConfig.initVolume = initValue;
    summaries.push(`调整存量规模为 ${initValue}`);
  }
  const allMatch = prompt.match(/每张表.*?(\d+)/);
  if (allMatch) {
    bucketOverrides.master = Number(allMatch[1]);
    bucketOverrides.detail = Number(allMatch[1]);
    bucketOverrides.flow = Number(allMatch[1]);
    bucketOverrides.log = Number(allMatch[1]);
    bucketOverrides.sparse = Number(allMatch[1]);
    summaries.push(`统一各表存量为 ${allMatch[1]}`);
  }
  const masterMatch = prompt.match(/主数据表.*?(\d+)/);
  if (masterMatch) bucketOverrides.master = Number(masterMatch[1]);
  const detailMatch = prompt.match(/主交易表.*?(\d+)/);
  if (detailMatch) bucketOverrides.detail = Number(detailMatch[1]);
  const flowMatch = prompt.match(/辅助流水表.*?(\d+)/);
  if (flowMatch) bucketOverrides.flow = Number(flowMatch[1]);
  const logMatch = prompt.match(/日志表.*?(\d+)/);
  if (logMatch) bucketOverrides.log = Number(logMatch[1]);
  const sparseMatch = prompt.match(/稀疏异常表.*?(\d+)/);
  if (sparseMatch) bucketOverrides.sparse = Number(sparseMatch[1]);
  const masterAscii = prompt.match(/MASTER_ROWS\s*=\s*(\d+)/i);
  if (masterAscii) bucketOverrides.master = Number(masterAscii[1]);
  const detailAscii = prompt.match(/DETAIL_ROWS\s*=\s*(\d+)/i);
  if (detailAscii) bucketOverrides.detail = Number(detailAscii[1]);
  const flowAscii = prompt.match(/FLOW_ROWS\s*=\s*(\d+)/i);
  if (flowAscii) bucketOverrides.flow = Number(flowAscii[1]);
  const logAscii = prompt.match(/LOG_ROWS\s*=\s*(\d+)/i);
  if (logAscii) bucketOverrides.log = Number(logAscii[1]);
  const sparseAscii = prompt.match(/SPARSE_ROWS\s*=\s*(\d+)/i);
  if (sparseAscii) bucketOverrides.sparse = Number(sparseAscii[1]);
  if (Object.keys(bucketOverrides).length > 0) {
    next.tables.forEach((table) => {
      const bucket = classifyStrategyTableBucket(table);
      if (bucketOverrides[bucket] !== undefined) {
        table.initRows = Number(bucketOverrides[bucket]);
      }
      if (incrValue !== null) {
        const incrBase = incrValue;
        if (bucket === "master" || bucket === "detail") table.incrRows = incrBase;
        else if (bucket === "flow") table.incrRows = Math.max(1, Math.round(incrBase * 0.7));
        else if (bucket === "log") table.incrRows = Math.max(1, Math.round(incrBase * 0.5));
        else table.incrRows = Math.max(1, Math.round(incrBase * 0.35));
      }
    });
    summaries.push("已按业务角色重排表级存量/增量");
  }
  if (/实时/.test(prompt) && /启用|开启/.test(prompt)) {
    next.globalConfig.realtimeEnabled = true;
    next.tables.forEach((table) => {
      if (table.writeMode === "MYSQL_ONLY") table.writeMode = "MYSQL_AND_KAFKA";
    });
    summaries.push("启用实时流");
  }
  if (/脏数据/.test(prompt) && /关闭|禁用/.test(prompt)) {
    next.globalConfig.dirtyEnabled = false;
    next.globalConfig.dirtyRatio = 0;
    summaries.push("关闭脏数据注入");
  }
  return { strategy: next, summary: summaries.join("；") || "已记录策略调整" };
}

function buildPhysicalTableName(sceneCode, tableName) {
  const sceneToken = sanitizeIdentifier(sceneCode, 16);
  const sceneHash = String(hashText(sceneCode)).slice(-8);
  const tableToken = sanitizeIdentifier(tableName, 32);
  return `scene_${sceneToken}_${sceneHash}_${tableToken}`;
}

function mapMysqlFieldType(field) {
  const rawType = String(field.fieldType || "VARCHAR").toUpperCase();
  if (rawType.includes("DECIMAL")) return rawType;
  if (rawType.includes("DATETIME")) return "DATETIME";
  if (rawType === "DATE") return "DATE";
  if (rawType.includes("BIGINT")) return "BIGINT";
  if (rawType === "INT" || rawType.includes("INTEGER")) return "INT";
  if (rawType.includes("TEXT")) return "TEXT";
  if (rawType.includes("JSON")) return "JSON";
  if (rawType === "VARCHAR") return `VARCHAR(${Number(field.fieldLength || 128)})`;
  return rawType;
}

function buildDDLStatements(sceneCode, schema) {
  return schema.tables.map((table) => {
    const physicalTableName = buildPhysicalTableName(sceneCode, table.tableName);
    const fieldSqlList = table.fields.map((field) => {
      const parts = [`\`${field.fieldName}\` ${mapMysqlFieldType(field)}`];
      parts.push(field.nullable ? "NULL" : "NOT NULL");
      if (field.defaultValue !== null && field.defaultValue !== undefined && field.defaultValue !== "") parts.push(`DEFAULT '${String(field.defaultValue).replace(/'/g, "''")}'`);
      if (field.fieldComment) parts.push(`COMMENT '${String(field.fieldComment).replace(/'/g, "''")}'`);
      return parts.join(" ");
    });
    const primaryKeys = table.fields.filter((field) => field.primaryKey).map((field) => `\`${field.fieldName}\``);
    if (primaryKeys.length > 0) fieldSqlList.push(`PRIMARY KEY (${primaryKeys.join(", ")})`);
    table.fields.filter((field) => field.uniqueKey && !field.primaryKey).forEach((field) => fieldSqlList.push(`UNIQUE KEY \`uk_${sanitizeIdentifier(field.fieldName, 24)}\` (\`${field.fieldName}\`)`));
    table.fields.filter((field) => field.foreignKey).forEach((field) => fieldSqlList.push(`KEY \`idx_${sanitizeIdentifier(field.fieldName, 24)}\` (\`${field.fieldName}\`)`));
    return { logicalTableName: table.tableName, physicalTableName, ddl: `CREATE TABLE IF NOT EXISTS \`medata_lab\`.\`${physicalTableName}\` (\n  ${fieldSqlList.join(",\n  ")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${String(table.tableComment || table.tableName).replace(/'/g, "''")}';` };
  });
}

function buildSceneTopics(sceneCode, strategy) {
  const prefix = `lab.scene.${sceneCode}`;
  const base = [{ topicName: `${prefix}.master`, topicType: "MASTER", writeMode: "MYSQL_AND_KAFKA" }, { topicName: `${prefix}.event`, topicType: "EVENT", writeMode: "MYSQL_AND_KAFKA" }, { topicName: `${prefix}.log`, topicType: "LOG", writeMode: "MYSQL_AND_KAFKA" }];
  const tableTopics = (strategy.tables || []).filter((table) => table.writeMode !== "MYSQL_ONLY").map((table) => ({ topicName: table.topicName || `${prefix}.${table.tableName}`, topicType: "TABLE", writeMode: table.writeMode }));
  return [...base, ...tableTopics];
}

function topologicalSortTables(schema) {
  const tables = schema.tables || [];
  const dependencyMap = new Map(tables.map((table) => [table.tableName, new Set()]));
  tables.forEach((table) => {
    table.fields.filter((field) => field.foreignKey && field.foreignRefTable).forEach((field) => dependencyMap.get(table.tableName).add(field.foreignRefTable));
  });
  const visited = new Set();
  const temp = new Set();
  const result = [];
  function visit(tableName) {
    if (visited.has(tableName) || temp.has(tableName)) return;
    temp.add(tableName);
    (dependencyMap.get(tableName) || new Set()).forEach((dep) => visit(dep));
    temp.delete(tableName);
    visited.add(tableName);
    const found = tables.find((item) => item.tableName === tableName);
    if (found) result.push(found);
  }
  tables.forEach((table) => visit(table.tableName));
  return result;
}

function generateFieldValue({ sceneCode, table, field, index, startedAt, pkPools, baseOffsets, generatorType, profile }) {
  const semantic = String(field.businessSemantic || "").toUpperCase();
  const fieldName = String(field.fieldName || "").toLowerCase();
  const rawType = String(field.fieldType || "").toUpperCase();
  const serial = Number(baseOffsets?.[table.tableName] || 0) + index + 1;
  const resolvedGeneratorType = String(generatorType || "").toUpperCase();
  const corporaCandidates = getCapabilityCorporaCandidates(profile, table.tableName, field.fieldName);
  if (field.primaryKey) {
    return serial;
  }
  if (field.foreignKey) {
    const pool = pkPools.get(field.foreignRefTable) || [1];
    if (!Array.isArray(pool) || pool.length === 0) {
      return 1;
    }
    const candidate = pool[index % pool.length];
    return candidate === undefined || candidate === null ? pool[0] ?? 1 : candidate;
  }
  if (corporaCandidates.length > 0) {
    const selected = corporaCandidates[index % corporaCandidates.length];
    return selected && typeof selected === "object" && "value" in selected ? selected.value : selected;
  }
  if (resolvedGeneratorType === "ID_CARD" || semantic.includes("ID_CARD") || fieldName.includes("id_card")) return `320101${String(19900101 + (serial % 2700)).padStart(8, "0")}${String(100 + (serial % 800)).padStart(3, "0")}X`;
  if (resolvedGeneratorType === "PHONE" || semantic.includes("PHONE") || fieldName.includes("mobile") || fieldName.includes("phone")) {
    return `1${String(3000000000 + serial * 7919).slice(-10)}`;
  }
  if (resolvedGeneratorType === "EMAIL" || semantic.includes("EMAIL") || fieldName.includes("email")) {
    const domains = ["qq.com", "163.com", "126.com", "foxmail.com", "yeah.net", "aliyun.com", "sina.com", "outlook.com"];
    const prefix = String(fieldName || "user").replace(/[^a-z0-9]+/g, "").slice(0, 10) || "user";
    return `${prefix}${String(100000 + (serial % 900000))}@${domains[serial % domains.length]}`;
  }
  if (resolvedGeneratorType === "CN_NAME" || semantic.includes("PERSON_NAME")) return SAMPLE_NAMES[index % SAMPLE_NAMES.length];
  if (resolvedGeneratorType === "COMPANY_NAME" || semantic.includes("COMPANY_NAME")) return `${SAMPLE_COMPANIES[index % SAMPLE_COMPANIES.length]}${(index % 9) + 1}号`;
  if (resolvedGeneratorType === "PRODUCT_NAME" || semantic.includes("PRODUCT_NAME")) return `样例商品-${(serial % 50) + 1}`;
  if (fieldName === "gender") return serial % 2 === 0 ? "女" : "男";
  if (fieldName.includes("plate_no")) return `牌照${String(100000 + serial).slice(-6)}`;
  if (fieldName.includes("station_name")) return Array.isArray(profile?.stationNames) && profile.stationNames.length > 0 ? profile.stationNames[index % profile.stationNames.length] : `检查站${(index % 5) + 1}`;
  if (fieldName.includes("road_name")) return Array.isArray(profile?.roadNames) && profile.roadNames.length > 0 ? profile.roadNames[index % profile.roadNames.length] : `道路${(index % 9) + 1}`;
  if (fieldName.includes("vehicle_type")) return Array.isArray(profile?.vehicleTypes) && profile.vehicleTypes.length > 0 ? profile.vehicleTypes[index % profile.vehicleTypes.length].code : "SEDAN";
  if (fieldName.includes("branch_type")) return Array.isArray(profile?.branchTypes) && profile.branchTypes.length > 0 ? profile.branchTypes[index % profile.branchTypes.length].code : "营业部";
  if (fieldName.includes("report_code")) return Array.isArray(profile?.reportCodes) && profile.reportCodes.length > 0 ? profile.reportCodes[index % profile.reportCodes.length].code : "1104-G01";
  if (fieldName.includes("issue_type")) return Array.isArray(profile?.issueTypes) && profile.issueTypes.length > 0 ? profile.issueTypes[index % profile.issueTypes.length].code : "数据口径不一致";
  if (fieldName.includes("issue_level")) return Array.isArray(profile?.issueLevels) && profile.issueLevels.length > 0 ? profile.issueLevels[index % profile.issueLevels.length].code : "一般";
  if (fieldName.includes("payment_channel") || fieldName === "pay_channel") return Array.isArray(profile?.paymentChannels) && profile.paymentChannels.length > 0 ? profile.paymentChannels[index % profile.paymentChannels.length].code : "WECHAT";
  if (fieldName.includes("report_status")) return Array.isArray(profile?.reportStatuses) && profile.reportStatuses.length > 0 ? profile.reportStatuses[index % profile.reportStatuses.length].code : "已提交";
  if (fieldName.includes("violation_status")) return Array.isArray(profile?.violationStatuses) && profile.violationStatuses.length > 0 ? profile.violationStatuses[index % profile.violationStatuses.length].code : "已缴款";
  if (fieldName.includes("inspection_result")) return Array.isArray(profile?.inspectionResults) && profile.inspectionResults.length > 0 ? profile.inspectionResults[index % profile.inspectionResults.length].code : "正常放行";
  if (fieldName.includes("driver_license_type")) return ["C1", "C2", "B2", "A1"][serial % 4];
  if (fieldName.includes("serve_mode")) return ["现场送达", "邮寄送达", "电子送达"][serial % 3];
  if (fieldName.includes("delivery_mode")) return ["快递配送", "即时配送", "到店自提"][serial % 3];
  if (fieldName.includes("priority_level")) return ["高", "中", "普通"][serial % 3];
  if (fieldName.includes("source_channel") || fieldName.includes("order_channel") || fieldName.includes("order_source") || fieldName.includes("submit_channel")) return ["APP", "MINI_PROGRAM", "WEB", "STORE"][serial % 4];
  if (fieldName.includes("approval_result")) return ["通过", "退回", "补充材料"][serial % 3];
  if (fieldName.includes("review_result")) return ["正常", "可疑", "需补充说明"][serial % 3];
  if (fieldName.includes("task_status") || fieldName.includes("disposal_status")) return ["待执行", "整改中", "已完成"][serial % 3];
  if (fieldName.includes("accident_level")) return ["一般事故", "简易事故", "轻微事故"][serial % 3];
  if (fieldName.includes("liability_type")) return ["全责", "主责", "同责"][serial % 3];
  if (fieldName.includes("registration_type")) return ["新车注册", "转移登记", "变更登记"][serial % 3];
  if (fieldName.includes("approval_status")) return ["已办结", "待审核", "补充材料"][serial % 3];
  if (fieldName.includes("fuel_type")) return ["汽油", "柴油", "混动", "纯电"][serial % 4];
  if (fieldName.includes("color_name")) return ["黑色", "白色", "银色", "蓝色"][serial % 4];
  if (fieldName.includes("metric_unit")) return ["%", "万元", "亿元"][serial % 3];
  if (fieldName.includes("metric_status")) return ["正常", "预警", "关注"][serial % 3];
  if (fieldName.includes("institution_type")) return ["国有大型银行", "股份制商业银行", "城商行"][serial % 3];
  if (fieldName.includes("governance_level")) return ["一级经营单元", "二级经营单元"][serial % 2];
  if (fieldName.includes("report_freq")) return ["月报", "季报", "日报"][serial % 3];
  if (fieldName.includes("message_type")) return ["正式报送", "补正报送", "重报"][serial % 3];
  if (fieldName.includes("event_type")) return ["巡逻发现", "例行检查", "事故处置"][serial % 3];
  if (fieldName.includes("currency_code")) return "CNY";
  if (fieldName === "source_system" && profile?.industry === "education") return ["SIS", "EDU_OA", "FINANCE_CENTER", "ACCESS_CTRL", "LIBRARY_SYS"][serial % 5];
  if (fieldName === "data_status") return "正常";
  if (fieldName === "source_system") {
    if (profile?.industry === "ecommerce") return ["OMS", "WMS", "CRM", "支付中台"][serial % 4];
    if (profile?.industry === "traffic") return ["交警执法平台", "综合指挥平台", "卡口监测平台", "车驾管平台"][serial % 4];
    if (profile?.industry === "bank_regulatory") return ["监管报送平台", "EAST校验平台", "风险管理系统", "反洗钱监测系统"][serial % 4];
    return "业务系统";
  }
  if (fieldName === "etl_batch_no") return buildNonSequentialBusinessIdentifier(fieldName, "", sceneCode, table.tableName, serial, startedAt);
  if (fieldName.includes("province_name")) return pickRealismLocation(profile, serial).provinceName;
  if (fieldName.includes("city_name")) return pickRealismLocation(profile, serial).cityName;
  if (fieldName.includes("district_name")) {
    const location = pickRealismLocation(profile, serial);
    return location.districts[serial % location.districts.length] || location.cityName;
  }
  if (fieldName.includes("street_name")) {
    const location = pickRealismLocation(profile, serial);
    return location.streets[serial % location.streets.length] || REALISM_GENERIC_STREETS[0];
  }
  if (fieldName.includes("address_detail")) return buildChineseAddressValue(profile, serial);
  if (semantic.includes("ORDER_NO")) return buildNonSequentialBusinessIdentifier(fieldName, "", sceneCode, table.tableName, serial, startedAt);
  if (shouldNormalizeBusinessIdentifier(fieldName)) return buildNonSequentialBusinessIdentifier(fieldName, "", sceneCode, table.tableName, serial, startedAt);
  if (resolvedGeneratorType === "AMOUNT" || semantic.includes("AMOUNT")) return Number((99 + (serial % 15) * 17.5).toFixed(2));
  if (resolvedGeneratorType === "NUMBER_RANGE" || semantic.includes("NUMBER")) return 10 + (serial % 90);
  if (resolvedGeneratorType === "ENUM" || semantic.includes("DICT_STATUS")) return ["SUBMITTED", "APPROVED", "REJECTED", "NEW", "RUNNING", "SUCCESS"][serial % 6];
  if (semantic.includes("DICT_CHANNEL")) return ["WECHAT", "ALIPAY", "CARD"][serial % 3];
  if (semantic.includes("DICT_CATEGORY")) return ["ELECTRONIC", "HOME", "BOOK", "FOOD"][serial % 4];
  if (semantic.includes("DICT_INDUSTRY")) return ["MANUFACTURING", "FINANCE", "RETAIL", "PUBLIC"][serial % 4];
  if (semantic.includes("DICT_STAGE")) return ["NEW", "FOLLOWING", "PROPOSAL", "WON", "LOST"][serial % 5];
  if (semantic.includes("DICT_REGION")) return ["310000", "320100", "330100", "440300"][serial % 4];
  if (fieldName.includes("status")) return ["NEW", "RUNNING", "SUCCESS", "FAILED", "APPROVED", "REJECTED"][serial % 6];
  if ((fieldName.endsWith("_id") || fieldName === "id") && (rawType.includes("INT") || rawType.includes("DECIMAL") || rawType.includes("NUM"))) return serial;
  if (rawType.includes("DECIMAL") || rawType.includes("NUM")) return Number((50 + (serial % 10) * 3.5).toFixed(2));
  if (rawType.includes("INT")) return 10 + (serial % 90);
  if (semantic.includes("DATETIME") || rawType.includes("DATE") || rawType.includes("TIME")) return new Date(startedAt.getTime() + serial * 6 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  if (fieldName.includes("address")) return buildChineseAddressValue(profile, serial, { style: fieldName.includes("pickup_") || fieldName.includes("delivery_") || fieldName.includes("campus_") ? "site" : undefined });
  if (fieldName.includes("office")) return buildRealisticOfficeName(profile, serial);
  if (fieldName.includes("address")) return `${SAMPLE_CITIES[serial % SAMPLE_CITIES.length]}${SAMPLE_STREETS[serial % SAMPLE_STREETS.length]}${(serial % 200) + 1}号`;
  if (fieldName.includes("office")) return `${SAMPLE_CITIES[serial % SAMPLE_CITIES.length]}婚姻登记中心`;
  return `${table.tableName}_${field.fieldName}_${serial}`;
}

function calculateTargetDirtyCellCount(totalFieldCells, dirtyRatio) {
  return Math.max(0, Math.round(Number(totalFieldCells || 0) * Math.max(0, Number(dirtyRatio || 0))));
}

const DIRTY_CATEGORY_WEIGHTS = {
  COMPLETENESS: 26,
  CONSISTENCY: 24,
  ACCURACY: 22,
  COMPLIANCE: 18,
  TIMELINESS: 10,
  UNIQUENESS: 8,
};

function isNumericField(field) {
  return /INT|DECIMAL|NUMERIC|NUMBER/.test(String(field?.fieldType || "").toUpperCase());
}

function isDateField(field) {
  return /DATE|TIME/.test(String(field?.fieldType || "").toUpperCase()) || String(field?.businessSemantic || "").toUpperCase().includes("DATETIME");
}

function isTextField(field) {
  return !isNumericField(field) && !isDateField(field);
}

function getFieldNameTokens(fieldName) {
  return String(fieldName || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function hasFieldNameToken(fieldName, token) {
  return getFieldNameTokens(fieldName).includes(String(token || "").toLowerCase());
}

function isNumericSensitiveField(fieldName) {
  const tokens = getFieldNameTokens(fieldName);
  return ["amount", "price", "balance", "capital", "ratio", "qty", "count", "score", "value"].some((token) => tokens.includes(token));
}

function parseRealismTime(value) {
  if (!value) return null;
  const time = new Date(String(value)).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatRealismTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function clampNumericValue(value, minValue, maxValue, precision = 2) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  const bounded = Math.min(Math.max(numeric, minValue), maxValue);
  return Number(bounded.toFixed(precision));
}

function ensureSequentialTimes(row, fields, startedAt, serial, stepMinutes = 30) {
  const presentFields = fields.filter((fieldName) => row[fieldName] !== undefined && row[fieldName] !== null && row[fieldName] !== "");
  if (presentFields.length < 2) {
    return;
  }
  let previous = parseRealismTime(row[presentFields[0]]);
  if (previous === null) {
    previous = new Date(startedAt || Date.now()).getTime() - (Math.max(1, Number(serial || 1)) * stepMinutes * 60000 * presentFields.length);
    row[presentFields[0]] = formatRealismTime(previous);
  }
  for (let index = 1; index < presentFields.length; index += 1) {
    const fieldName = presentFields[index];
    const current = parseRealismTime(row[fieldName]);
    if (current === null || current <= previous) {
      previous += stepMinutes * 60000;
      row[fieldName] = formatRealismTime(previous);
      continue;
    }
    previous = current;
  }
}

function applyGenericAmountFixes(row) {
  if (row.balance_amount !== undefined && row.freeze_amount !== undefined && row.available_amount !== undefined) {
    const balance = Math.max(0, Number(row.balance_amount || 0));
    const freeze = Math.max(0, Math.min(balance, Number(row.freeze_amount || 0)));
    row.balance_amount = Number(balance.toFixed(2));
    row.freeze_amount = Number(freeze.toFixed(2));
    row.available_amount = Number(Math.max(0, balance - freeze).toFixed(2));
  }
  if (row.order_amount !== undefined && row.paid_amount !== undefined) {
    const orderAmount = Math.max(0, Number(row.order_amount || 0));
    row.order_amount = Number(orderAmount.toFixed(2));
    row.paid_amount = Number(Math.min(orderAmount, Math.max(0, Number(row.paid_amount || 0))).toFixed(2));
  }
  if (row.loan_amount !== undefined && row.outstanding_amount !== undefined) {
    const loanAmount = Math.max(0, Number(row.loan_amount || 0));
    row.loan_amount = Number(loanAmount.toFixed(2));
    row.outstanding_amount = Number(Math.min(loanAmount, Math.max(0, Number(row.outstanding_amount || 0))).toFixed(2));
  }
  if (row.apply_amount !== undefined && row.confirm_amount !== undefined) {
    const applyAmount = Math.max(0, Number(row.apply_amount || 0));
    row.apply_amount = Number(applyAmount.toFixed(2));
    row.confirm_amount = Number(Math.min(applyAmount, Math.max(0, Number(row.confirm_amount || 0))).toFixed(2));
  }
  if (row.apply_share !== undefined && row.confirm_share !== undefined) {
    const applyShare = Math.max(0, Number(row.apply_share || 0));
    row.apply_share = Number(applyShare.toFixed(2));
    row.confirm_share = Number(Math.min(applyShare, Math.max(0, Number(row.confirm_share || 0))).toFixed(2));
  }
  if (row.receivable_amount !== undefined && row.discount_amount !== undefined && row.paid_amount !== undefined && row.arrears_amount !== undefined) {
    const receivable = Math.max(0, Number(row.receivable_amount || 0));
    const discount = Math.max(0, Math.min(receivable, Number(row.discount_amount || 0)));
    const paid = Math.max(0, Math.min(receivable - discount, Number(row.paid_amount || 0)));
    row.receivable_amount = Number(receivable.toFixed(2));
    row.discount_amount = Number(discount.toFixed(2));
    row.paid_amount = Number(paid.toFixed(2));
    row.arrears_amount = Number(Math.max(0, receivable - discount - paid).toFixed(2));
  }
}

function applyRatioBounds(row) {
  Object.keys(row || {}).forEach((fieldName) => {
    const lowerName = String(fieldName || "").toLowerCase();
    if (row[fieldName] === null || row[fieldName] === undefined || row[fieldName] === "") {
      return;
    }
    if (lowerName.includes("conversion_rate")) {
      row[fieldName] = clampNumericValue(row[fieldName], 0.001, 0.95, 4);
      return;
    }
    if (lowerName.includes("daily_change_rate")) {
      row[fieldName] = clampNumericValue(row[fieldName], -9.99, 9.99, 4);
      return;
    }
    if (lowerName.includes("management_fee_rate")) {
      row[fieldName] = clampNumericValue(row[fieldName], 0.01, 3, 4);
      return;
    }
    if (lowerName.includes("custody_fee_rate")) {
      row[fieldName] = clampNumericValue(row[fieldName], 0.005, 1, 4);
      return;
    }
    if (lowerName.includes("interest_rate")) {
      row[fieldName] = clampNumericValue(row[fieldName], 1.5, 24, 4);
      return;
    }
    if (lowerName.includes("capital_adequacy_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 10.5, 20, 2);
      return;
    }
    if (lowerName.includes("tier1_capital_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 8, 18, 2);
      return;
    }
    if (lowerName.includes("core_tier1_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 7, 16, 2);
      return;
    }
    if (lowerName.includes("liquidity_coverage_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 100, 320, 2);
      return;
    }
    if (lowerName.includes("provision_coverage_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 100, 400, 2);
      return;
    }
    if (lowerName.includes("npl_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 0.1, 10, 2);
      return;
    }
    if (lowerName.includes("stock_position_ratio") || lowerName.includes("bond_position_ratio") || lowerName.includes("cash_ratio") || lowerName.includes("concentration_ratio") || lowerName.includes("large_exposure_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 0, 100, 2);
      return;
    }
    if (lowerName.endsWith("_ratio")) {
      row[fieldName] = clampNumericValue(row[fieldName], 0, 100, 2);
    }
  });
}

function normalizePortfolioRatios(row, fields) {
  const existingFields = fields.filter((fieldName) => row[fieldName] !== undefined && row[fieldName] !== null);
  if (existingFields.length < 2) {
    return;
  }
  const total = existingFields.reduce((sum, fieldName) => sum + Math.max(0, Number(row[fieldName] || 0)), 0);
  if (!total || total <= 100) {
    return;
  }
  const scale = 98 / total;
  existingFields.forEach((fieldName, index) => {
    const precision = index === existingFields.length - 1 ? 2 : 2;
    row[fieldName] = Number((Math.max(0, Number(row[fieldName] || 0)) * scale).toFixed(precision));
  });
}

function normalizeInstitutionNaming(row, profile, seed) {
  const cityCode = String(row.city_code || row.cityCode || row.region_code || row.regionCode || "");
  const location = pickRealismLocation(profile, seed);
  const cityName = String(row.city_name || row.cityName || row.region_name || row.regionName || location.cityName || "");
  const compactCityName = cityName.replace(/市$/g, "") || cityName;
  const provinceCode = buildProvinceCodeFromCityCode(cityCode || location.code);
  const provinceLocation = REALISM_LOCATION_CORPUS.find((item) => item.code === String(cityCode || location.code)) || location;
  if (row.province_code !== undefined) row.province_code = provinceCode;
  if (row.province_name !== undefined) row.province_name = provinceLocation.provinceName || location.provinceName;
  if (row.regulator_name !== undefined && (!containsChineseText(row.regulator_name) || String(row.regulator_name).includes("分局"))) {
    row.regulator_name = `国家金融监督管理总局${compactCityName || location.cityName}监管局`;
  }
  if (row.institution_name !== undefined) {
    let baseName = String(row.institution_name || "").replace(/股份有限公司/g, "").replace(/分行.*/g, "").replace(/\s+/g, "");
    [cityName, compactCityName].filter(Boolean).forEach((token) => {
      baseName = baseName.replace(token, "");
    });
    if (/工商|建设|农业|中国银行/.test(baseName)) {
      row.institution_name = `${baseName}${compactCityName || location.cityName}分行`;
      if (row.institution_type !== undefined) row.institution_type = "国有大型银行分支机构";
    } else {
      row.institution_name = `${baseName}股份有限公司${compactCityName || location.cityName}分行`;
      if (row.institution_type !== undefined) row.institution_type = "股份制商业银行分支机构";
    }
  }
  if (row.branch_name !== undefined) {
    const branchType = String(row.branch_type || row.branchType || "");
    let institutionName = String(row.institution_name || row.branch_name || "").replace(/\s+/g, "");
    [cityName, compactCityName].filter(Boolean).forEach((token) => {
      institutionName = institutionName.replace(new RegExp(`${token}(?=.*${token})`, "g"), "");
    });
    const compactBase = institutionName.includes(compactCityName) ? institutionName : `${institutionName}${compactCityName || location.cityName}`;
    row.branch_name = branchType && !compactBase.endsWith(branchType) ? `${compactBase}${branchType}` : compactBase;
  }
}

function normalizeRouteSemantic(row) {
  const transportMode = String(row.transport_mode || row.transportMode || "");
  const originSite = String(row.origin_site || row.originSite || "");
  const destinationSite = String(row.destination_site || row.destinationSite || "");
  const originCity = originSite.replace(/(分拨中心|配送中心|集散中心|营业部|服务站).*/g, "");
  const destinationCity = destinationSite.replace(/(分拨中心|配送中心|集散中心|营业部|服务站).*/g, "");
  if (transportMode === "SAME_CITY") {
    if (originCity && destinationCity && originCity !== destinationCity) {
      const nextDestination = `${originCity}配送中心`;
      if (row.destination_site !== undefined) row.destination_site = nextDestination;
      if (row.destinationSite !== undefined) row.destinationSite = nextDestination;
      if (row.next_site !== undefined) row.next_site = nextDestination;
    }
    if (row.route_level !== undefined) row.route_level = "末端配送";
    if (row.distance_km !== undefined) row.distance_km = clampNumericValue(row.distance_km, 1, 60, 1);
    if (row.planned_duration_hours !== undefined) row.planned_duration_hours = Math.min(8, Math.max(1, Number(row.planned_duration_hours || 0)));
    if (row.planned_stop_count !== undefined) row.planned_stop_count = Math.min(3, Math.max(0, Number(row.planned_stop_count || 0)));
  } else if (originCity && destinationCity && originCity === destinationCity) {
    const nextDestination = `${originCity === "上海" ? "杭州" : "上海"}配送中心`;
    if (row.destination_site !== undefined) row.destination_site = nextDestination;
    if (row.destinationSite !== undefined) row.destinationSite = nextDestination;
    if (row.next_site !== undefined) row.next_site = nextDestination;
    if (row.route_level !== undefined && row.route_level === "末端配送") row.route_level = "干线";
  }
}

function applyRealismFixRules(row, table, profile, startedAt, sceneCode, serial) {
  const tableName = String(table?.tableName || "");
  const seed = Math.max(1, Number(serial || 1));
  const fallbackLocation = pickRealismLocation(profile, seed);
  const resolvedCityCode = row.city_code || row.cityCode || row.region_code || row.regionCode || fallbackLocation.code;
  const location = REALISM_LOCATION_CORPUS.find((item) => item.code === String(resolvedCityCode || "")) || fallbackLocation;
  const derivedProvinceCode = buildProvinceCodeFromCityCode(resolvedCityCode || location.code);
  const derivedProvinceLocation = REALISM_LOCATION_CORPUS.find((item) => item.code === String(resolvedCityCode || location.code)) || location;

  Object.keys(row || {}).forEach((fieldName) => {
    const lowerName = String(fieldName || "").toLowerCase();
    const value = row[fieldName];
    const isPhoneLikeField = lowerName.includes("phone") || lowerName.includes("mobile") || lowerName.includes("hotline");
    if (shouldNormalizeBusinessIdentifier(lowerName) && looksSequentialIdentifier(value)) {
      row[fieldName] = buildNonSequentialBusinessIdentifier(lowerName, value, sceneCode, tableName, seed, startedAt);
    }
    if (lowerName === "fund_code" && !/^\d{6}$/.test(String(value || ""))) {
      row[fieldName] = buildRealisticFundCode(sceneCode, tableName, seed);
    }
    if (/address|address_detail|street_name|residence_address|home_address|campus_address|pickup_address|delivery_address/.test(lowerName)) {
      if (!containsChineseText(value) || /\b(road|street|avenue|court|garden|building|room|suite|district)\b/i.test(String(value || ""))) {
        row[fieldName] = buildChineseAddressValue(profile, seed + hashText(lowerName), {
          style: lowerName.includes("pickup_") || lowerName.includes("delivery_") || lowerName.includes("campus_") ? "site" : undefined,
          districtName: row.district_name || row.districtName,
        });
      }
    }
    if (lowerName.includes("province_code") && value) row[fieldName] = derivedProvinceCode;
    if (lowerName.includes("province_name")) {
      const expectedProvinceName = derivedProvinceLocation.provinceName || location.provinceName;
      if (!containsChineseText(value) || String(value || "") === String(row.city_name || row.cityName || "")) {
        row[fieldName] = expectedProvinceName;
      }
    }
    if (lowerName.includes("city_name") && (!containsChineseText(value) || !String(value || "").includes(location.cityName))) row[fieldName] = location.cityName;
    if (lowerName.includes("district_name")) {
      const expectedDistrict = location.districts[seed % location.districts.length] || location.cityName;
      if (!containsChineseText(value) || String(value || "") !== expectedDistrict) {
        row[fieldName] = expectedDistrict;
      }
    }
    if (lowerName.includes("postal_code")) {
      row[fieldName] = buildPostalCodeFromRegionCode(row.city_code || row.cityCode || row.region_code || row.regionCode || location.code, seed);
    }
    if (lowerName.includes("office") && !isPhoneLikeField && !containsChineseText(value)) row[fieldName] = buildRealisticOfficeName(profile, seed + hashText(lowerName));
  });

  applyGenericAmountFixes(row);
  applyRatioBounds(row);

  if (tableName === "prudential_report") {
    row.capital_adequacy_ratio = clampNumericValue(row.capital_adequacy_ratio, 10.5, 20, 2);
    row.tier1_capital_ratio = clampNumericValue(Math.min(Number(row.tier1_capital_ratio || 0), Number(row.capital_adequacy_ratio || 0) - 0.4), 8, 18, 2);
    row.core_tier1_ratio = clampNumericValue(Math.min(Number(row.core_tier1_ratio || 0), Number(row.tier1_capital_ratio || 0) - 0.3), 7, 16, 2);
    ensureSequentialTimes(row, ["submit_time", "receive_time"], startedAt, seed, 30);
  }

  if (tableName === "fund_nav_snapshot") {
    normalizePortfolioRatios(row, ["stock_position_ratio", "bond_position_ratio", "cash_ratio"]);
  }

  if (tableName === "fund_subscription_order") {
    ensureSequentialTimes(row, ["apply_time", "confirm_time", "settlement_time"], startedAt, seed, 180);
  }

  if (tableName === "fund_redemption_order") {
    ensureSequentialTimes(row, ["apply_time", "confirm_time", "payment_time"], startedAt, seed, 240);
  }

  if (tableName === "fund_trading_flow") {
    ensureSequentialTimes(row, ["trade_time", "confirm_time"], startedAt, seed, 180);
  }

  if (tableName === "fund_product") {
    if (row.fund_code !== undefined) row.fund_code = buildRealisticFundCode(sceneCode, tableName, seed);
  }

  if (tableName === "logistics_waybill") {
    ensureSequentialTimes(row, ["create_time", "collect_time", "delivery_deadline"], startedAt, seed, 180);
    row.weight_kg = clampNumericValue(row.weight_kg, 0.1, 60, 2);
    row.freight_amount = clampNumericValue(row.freight_amount, 5, 500, 2);
  }

  if (tableName === "logistics_transfer_record") {
    ensureSequentialTimes(row, ["arrive_time", "depart_time"], startedAt, seed, 45);
    const arrive = parseRealismTime(row.arrive_time);
    const depart = parseRealismTime(row.depart_time);
    if (arrive !== null && depart !== null) {
      row.stay_minutes = Math.max(20, Math.round((depart - arrive) / 60000));
    }
    normalizeRouteSemantic(row);
  }

  if (tableName === "logistics_sign_record") {
    ensureSequentialTimes(row, ["outbound_time", "deliver_time"], startedAt, seed, 30);
    if (String(row.sign_status || "").includes("\u5931\u8d25")) {
      row.sign_time = null;
      row.signer_name = "";
    } else {
      ensureSequentialTimes(row, ["deliver_time", "sign_time"], startedAt, seed, 20);
    }
  }

  if (tableName === "logistics_exception_ticket") {
    ensureSequentialTimes(row, ["discover_time", "close_time"], startedAt, seed, 240);
    row.compensation_amount = clampNumericValue(row.compensation_amount, 0, 2000, 2);
  }

  if (tableName === "logistics_delivery_route") {
    normalizeRouteSemantic(row);
  }

  if (tableName === "order_header") {
    ensureSequentialTimes(row, ["order_time", "pay_time", "ship_time", "complete_time"], startedAt, seed, 120);
  }

  if (tableName === "payment_record") {
    ensureSequentialTimes(row, ["pay_time", "callback_time", "settlement_time"], startedAt, seed, 20);
  }

  if (tableName === "refund_ticket") {
    ensureSequentialTimes(row, ["apply_time", "approve_time", "complete_time"], startedAt, seed, 180);
  }

  if (tableName === "parent_communication_record") {
    ensureSequentialTimes(row, ["send_time", "read_time", "reply_time"], startedAt, seed, 30);
  }

  if (tableName === "dormitory_resident_record") {
    ensureSequentialTimes(row, ["checkin_time", "checkout_time"], startedAt, seed, 12 * 60);
  }

  if (tableName === "institution_dimension" || tableName === "reporting_branch") {
    normalizeInstitutionNaming(row, profile, seed);
  }

  return row;
}

function getGeneratedRows(generatedTables, tableName) {
  return generatedTables.find((item) => item.table?.tableName === tableName || item.tableName === tableName)?.rows || [];
}

function buildRowMap(rows, keyField) {
  return new Map((rows || []).filter((row) => row && row[keyField] !== undefined && row[keyField] !== null).map((row) => [String(row[keyField]), row]));
}

function toDateKey(value) {
  const time = parseRealismTime(value);
  if (time === null) return "";
  return formatRealismTime(time).slice(0, 10);
}

function setTimeWindow(row, earliestTime, latestTime) {
  if (earliestTime !== null && row.created_at !== undefined) {
    row.created_at = formatRealismTime(Math.min(earliestTime, parseRealismTime(row.created_at) ?? earliestTime));
  }
  if (latestTime !== null && row.updated_at !== undefined) {
    const currentUpdated = parseRealismTime(row.updated_at);
    row.updated_at = formatRealismTime(Math.max(latestTime, currentUpdated ?? latestTime));
  }
}

function alignRowAuditWindow(row, candidateFields = []) {
  const timestamps = candidateFields.map((fieldName) => parseRealismTime(row[fieldName])).filter((value) => value !== null);
  if (timestamps.length === 0) return;
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  setTimeWindow(row, earliest, latest);
}

function applyFundCrossTableConsistency(generatedTables) {
  const fundRows = getGeneratedRows(generatedTables, "fund_product");
  const navRows = getGeneratedRows(generatedTables, "fund_nav_snapshot");
  const subscriptionRows = getGeneratedRows(generatedTables, "fund_subscription_order");
  const redemptionRows = getGeneratedRows(generatedTables, "fund_redemption_order");
  const flowRows = getGeneratedRows(generatedTables, "fund_trading_flow");
  const fundMap = buildRowMap(fundRows, "fund_id");
  const navByFundDate = new Map();
  const latestNavByFund = new Map();

  navRows.forEach((row) => {
    const key = `${row.fund_id}|${row.nav_date}`;
    navByFundDate.set(key, row);
    latestNavByFund.set(String(row.fund_id), row);
    if (row.acc_nav !== undefined && row.unit_nav !== undefined) {
      row.acc_nav = clampNumericValue(Math.max(Number(row.acc_nav || 0), Number(row.unit_nav || 0)), 0.5, 99, 4);
    }
    const fund = fundMap.get(String(row.fund_id));
    if (fund && String(fund.fund_type) === "BOND") {
      row.stock_position_ratio = clampNumericValue(row.stock_position_ratio, 0, 20, 2);
      row.bond_position_ratio = clampNumericValue(Math.max(Number(row.bond_position_ratio || 0), 60), 60, 95, 2);
      row.cash_ratio = clampNumericValue(Math.max(0.5, 100 - Number(row.stock_position_ratio || 0) - Number(row.bond_position_ratio || 0)), 0.5, 20, 2);
    }
    if (fund && String(fund.fund_type) === "MONEY_MARKET") {
      row.stock_position_ratio = 0;
      row.bond_position_ratio = clampNumericValue(row.bond_position_ratio, 0, 40, 2);
      row.cash_ratio = clampNumericValue(Math.max(60, 100 - Number(row.bond_position_ratio || 0)), 60, 100, 2);
    }
    alignRowAuditWindow(row, ["nav_date"]);
  });

  subscriptionRows.forEach((row) => {
    const nav = navByFundDate.get(`${row.fund_id}|${toDateKey(row.apply_time)}`) || latestNavByFund.get(String(row.fund_id));
    if (nav && row.apply_nav !== undefined) {
      row.apply_nav = Number(Number(nav.unit_nav || 1).toFixed(4));
    }
    const normalizedStatus = String(row.order_status || "").toUpperCase();
    ensureSequentialTimes(row, ["apply_time", "confirm_time", "settlement_time"], parseRealismTime(row.apply_time) || Date.now(), 1, 180);
    if (normalizedStatus === "CANCELLED" || normalizedStatus === "FAILED" || normalizedStatus === "ACCEPTED") {
      row.confirm_amount = 0;
      row.confirm_share = 0;
      row.payment_status = normalizedStatus === "FAILED" ? "FAILED" : normalizedStatus === "CANCELLED" ? "CANCELLED" : "PENDING";
    } else {
      row.payment_status = "SUCCESS";
      row.confirm_amount = clampNumericValue(Math.min(Number(row.apply_amount || 0), Number(row.confirm_amount || row.apply_amount || 0)), 0, Number(row.apply_amount || 0), 2);
      row.confirm_share = Number((Number(row.confirm_amount || 0) / Math.max(Number(row.apply_nav || 1), 0.0001)).toFixed(2));
    }
    alignRowAuditWindow(row, ["apply_time", "confirm_time", "settlement_time"]);
  });

  redemptionRows.forEach((row) => {
    const nav = navByFundDate.get(`${row.fund_id}|${toDateKey(row.apply_time)}`) || latestNavByFund.get(String(row.fund_id));
    if (nav && row.exit_nav !== undefined) {
      row.exit_nav = Number(Number(nav.unit_nav || 1).toFixed(4));
    }
    const normalizedStatus = String(row.order_status || "").toUpperCase();
    ensureSequentialTimes(row, ["apply_time", "confirm_time", "payment_time"], parseRealismTime(row.apply_time) || Date.now(), 1, 240);
    if (normalizedStatus === "CANCELLED" || normalizedStatus === "FAILED" || normalizedStatus === "ACCEPTED") {
      row.confirm_amount = 0;
      row.confirm_share = 0;
      row.payment_status = normalizedStatus === "FAILED" ? "FAILED" : normalizedStatus === "CANCELLED" ? "CANCELLED" : "PENDING";
    } else {
      row.payment_status = "SUCCESS";
      row.confirm_amount = clampNumericValue(Number((Math.max(Number(row.confirm_share || row.apply_share || 0), 0) * Math.max(Number(row.exit_nav || 1), 0.0001)).toFixed(2)), 0, 999999999, 2);
      row.confirm_share = clampNumericValue(Math.min(Number(row.apply_share || 0), Number(row.confirm_share || row.apply_share || 0)), 0, Number(row.apply_share || 0), 2);
    }
    alignRowAuditWindow(row, ["apply_time", "confirm_time", "payment_time"]);
  });

  let subscriptionCursor = 0;
  let redemptionCursor = 0;
  flowRows.forEach((row) => {
    const useRedemption = String(row.trade_type || "").includes("赎");
    const source = useRedemption
      ? redemptionRows[redemptionCursor++ % Math.max(1, redemptionRows.length)]
      : subscriptionRows[subscriptionCursor++ % Math.max(1, subscriptionRows.length)];
    if (!source) return;
    row.fund_id = source.fund_id;
    row.account_id = source.account_id;
    row.trade_type = useRedemption ? "赎回" : "申购";
    row.channel_code = source.channel_code || row.channel_code;
    row.trade_time = source.apply_time || row.trade_time;
    row.confirm_time = source.confirm_time || row.confirm_time;
    row.trade_amount = source.confirm_amount || source.apply_amount || row.trade_amount;
    row.trade_share = source.confirm_share || source.apply_share || row.trade_share;
    row.fee_amount = source.fee_amount || source.subscription_fee || row.fee_amount;
    row.trade_status = source.order_status || row.trade_status;
    row.trade_source_system = source.source_system || row.trade_source_system || row.source_system;
    row.remark = `${row.trade_type}流水`;
    alignRowAuditWindow(row, ["trade_time", "confirm_time"]);
  });
}

function applyBankCrossTableConsistency(generatedTables) {
  const branchRows = getGeneratedRows(generatedTables, "reporting_branch");
  const reportRows = getGeneratedRows(generatedTables, "prudential_report");
  const metricRows = getGeneratedRows(generatedTables, "report_metric_item");
  const alertRows = getGeneratedRows(generatedTables, "anti_money_alert");
  const issueRows = getGeneratedRows(generatedTables, "exception_case");
  const taskRows = getGeneratedRows(generatedTables, "rectification_task");
  const submissionRows = getGeneratedRows(generatedTables, "submission_log");
  const contactRows = getGeneratedRows(generatedTables, "reporting_contact");
  const reportMap = buildRowMap(reportRows, "report_id");
  const issueMap = buildRowMap(issueRows, "case_id");

  branchRows.forEach((row) => {
    row.asset_scale = clampNumericValue(Math.max(Number(row.asset_scale || 0), Number(row.loan_scale || 0) * 1.15), 1, 999999999999, 2);
    alignRowAuditWindow(row, []);
  });

  reportRows.forEach((row) => {
    row.total_assets = clampNumericValue(Math.max(Number(row.total_assets || 0), Number(row.loan_balance || 0) * 1.12), 1, 999999999999, 2);
    row.capital_adequacy_ratio = clampNumericValue(row.capital_adequacy_ratio, 10.5, 18, 2);
    row.tier1_capital_ratio = clampNumericValue(Math.min(Number(row.tier1_capital_ratio || 0), Number(row.capital_adequacy_ratio || 0) - 0.2), 8, 16, 2);
    row.core_tier1_ratio = clampNumericValue(Math.min(Number(row.core_tier1_ratio || 0), Number(row.tier1_capital_ratio || 0) - 0.2), 7.2, 15, 2);
    row.liquidity_coverage_ratio = clampNumericValue(row.liquidity_coverage_ratio, 100, 180, 2);
    row.provision_coverage_ratio = clampNumericValue(row.provision_coverage_ratio, 120, 260, 2);
    ensureSequentialTimes(row, ["submit_time", "receive_time"], parseRealismTime(row.submit_time) || Date.now(), 1, 60);
    alignRowAuditWindow(row, ["submit_time", "receive_time"]);
  });

  metricRows.forEach((row) => {
    const report = reportMap.get(String(row.report_id));
    if (!report) return;
    const metricName = String(row.metric_name || "");
    if (metricName.includes("核心一级资本充足率")) row.metric_value = report.core_tier1_ratio;
    else if (metricName.includes("一级资本充足率")) row.metric_value = report.tier1_capital_ratio;
    else if (metricName.includes("资本充足率")) row.metric_value = report.capital_adequacy_ratio;
    else if (metricName.includes("流动性覆盖率")) row.metric_value = report.liquidity_coverage_ratio;
    else if (metricName.includes("不良贷款率")) row.metric_value = report.npl_ratio;
    else if (metricName.includes("拨备覆盖率")) row.metric_value = report.provision_coverage_ratio;
    else if (metricName.includes("大额风险暴露比例")) row.metric_value = report.large_exposure_ratio;
    row.benchmark_value = clampNumericValue(Number(row.metric_value || 0) * 0.92, 0, 999999, 2);
    row.deviation_rate = clampNumericValue(Math.abs(Number(row.metric_value || 0) - Number(row.benchmark_value || 0)), 0, 100, 2);
    row.warning_flag = Number(row.metric_value || 0) > Number(row.warning_threshold || 0) && metricName.includes("不良") ? 1 : Number(row.metric_value || 0) < Number(row.warning_threshold || 0) ? 1 : 0;
    row.metric_status = row.warning_flag ? "预警" : "正常";
    alignRowAuditWindow(row, ["calculated_at"]);
  });

  alertRows.forEach((row) => {
    if (String(row.review_result || "") === "正常") {
      row.alert_status = "已排除";
      row.report_required_status = "无需上报";
    } else if (String(row.alert_status || "") === "待核查") {
      row.report_required_status = "待评估";
    }
    ensureSequentialTimes(row, ["alert_time", "review_time"], parseRealismTime(row.alert_time) || Date.now(), 1, 90);
    alignRowAuditWindow(row, ["alert_time", "review_time"]);
  });

  issueRows.forEach((row) => {
    ensureSequentialTimes(row, ["identified_at", "due_at", "disposed_at"], parseRealismTime(row.identified_at) || Date.now(), 1, 24 * 60);
    if (String(row.disposal_status || "") === "已关闭") {
      row.rectification_status = "已完成";
      row.recheck_result = "通过";
    } else {
      row.rectification_status = "持续整改";
      row.recheck_result = "待复核";
    }
    alignRowAuditWindow(row, ["identified_at", "due_at", "disposed_at"]);
  });

  taskRows.forEach((row) => {
    const issue = issueMap.get(String(row.case_id));
    const baseTime = parseRealismTime(issue?.identified_at) || parseRealismTime(row.create_time) || Date.now();
    ensureSequentialTimes(row, ["create_time", "start_time", "finish_time", "due_date"], baseTime, 1, 12 * 60);
    if (issue?.due_at && parseRealismTime(row.due_date) !== parseRealismTime(issue.due_at)) {
      row.due_date = issue.due_at;
    }
    row.verify_result = String(row.task_status || "") === "已完成" ? "通过" : "待验证";
    alignRowAuditWindow(row, ["create_time", "start_time", "finish_time", "due_date"]);
  });

  submissionRows.forEach((row) => {
    if (String(row.log_status || "") === "待重试" && Number(row.retry_count || 0) < 1) row.retry_count = 1;
    if (String(row.log_status || "") === "已接收") row.archive_status = "已归档";
    alignRowAuditWindow(row, ["event_time"]);
  });

  contactRows.forEach((row, index) => {
    const areaCode = String(row.region_code || row.regionCode || row.city_code || row.cityCode || "510100").startsWith("5101") ? "028"
      : String(row.region_code || row.city_code || "").startsWith("3301") ? "0571"
      : String(row.region_code || row.city_code || "").startsWith("3201") ? "025"
      : String(row.region_code || row.city_code || "").startsWith("4403") ? "0755"
      : "021";
    row.office_phone = `${areaCode}-${String(6000000 + ((index + 1) % 3000000)).slice(-7)}`;
  });
}

function applyLogisticsCrossTableConsistency(generatedTables) {
  const waybillRows = getGeneratedRows(generatedTables, "logistics_waybill");
  const routeRows = getGeneratedRows(generatedTables, "logistics_delivery_route");
  const transferRows = getGeneratedRows(generatedTables, "logistics_transfer_record");
  const signRows = getGeneratedRows(generatedTables, "logistics_sign_record");
  const exceptionRows = getGeneratedRows(generatedTables, "logistics_exception_ticket");
  const routeMap = buildRowMap(routeRows, "route_id");
  const waybillMap = buildRowMap(waybillRows, "waybill_id");
  const signByWaybill = new Map();
  const exceptionByWaybill = new Map();

  routeRows.forEach((row) => {
    normalizeRouteSemantic(row);
    alignRowAuditWindow(row, ["effective_time", "expire_time"]);
  });

  transferRows.forEach((row) => {
    const route = routeMap.get(String(row.route_id));
    const waybill = waybillMap.get(String(row.waybill_id));
    if (route) {
      row.current_site = route.origin_site;
      row.next_site = route.destination_site;
      row.transport_mode = route.transport_mode;
    }
    if (waybill) {
      const baseCity = String(waybill.city_name || waybill.cityName || "").replace(/市$/g, "") || "本地";
      row.transport_mode = waybill.transport_mode || row.transport_mode;
      row.current_site = `${baseCity}分拨中心`;
      row.next_site = `${baseCity}配送中心`;
    }
    const collectTime = parseRealismTime(waybill?.collect_time);
    const arriveTime = Math.max(parseRealismTime(row.arrive_time) || collectTime || Date.now(), collectTime || 0);
    row.arrive_time = formatRealismTime(arriveTime);
    row.depart_time = formatRealismTime(arriveTime + Math.max(20, Number(row.stay_minutes || 20)) * 60000);
    row.transfer_status = parseRealismTime(row.depart_time) > arriveTime ? "已完成" : row.transfer_status;
    alignRowAuditWindow(row, ["arrive_time", "depart_time"]);
  });

  signRows.forEach((row) => {
    signByWaybill.set(String(row.waybill_id), row);
    if (String(row.sign_status || "") === "客户自提") {
      row.courier_name = "";
      row.courier_mobile = "";
      row.sign_method = "站点自提";
      row.distance_to_receiver_km = 0;
    }
    if (String(row.sign_status || "").includes("失败")) {
      row.sign_time = null;
      row.signer_name = "";
      row.signer_relation = "";
      row.sign_method = "";
    }
    ensureSequentialTimes(row, ["outbound_time", "deliver_time", "sign_time"], parseRealismTime(row.outbound_time) || Date.now(), 1, 30);
    alignRowAuditWindow(row, ["outbound_time", "deliver_time", "sign_time"]);
  });

  exceptionRows.forEach((row) => {
    exceptionByWaybill.set(String(row.waybill_id), row);
    const feedbackMap = {
      DELAY: "延误投诉",
      ADDRESS_ERROR: "地址有误",
      PACKAGE_DAMAGE: "包裹破损",
      CUSTOMER_REJECT: "客户拒收",
      LOST: "丢件投诉",
    };
    if (feedbackMap[String(row.exception_type || "")]) {
      row.customer_feedback = feedbackMap[String(row.exception_type || "")];
    }
    ensureSequentialTimes(row, ["discover_time", "close_time"], parseRealismTime(row.discover_time) || Date.now(), 1, 360);
    if (String(row.exception_status || "") !== "已关闭") {
      row.exception_status = "已关闭";
    }
    alignRowAuditWindow(row, ["discover_time", "close_time"]);
  });

  waybillRows.forEach((row) => {
    const sign = signByWaybill.get(String(row.waybill_id));
    const exception = exceptionByWaybill.get(String(row.waybill_id));
    if (sign && !String(sign.sign_status || "").includes("失败")) {
      row.waybill_status = "SIGNED";
    } else if (exception) {
      row.waybill_status = "EXCEPTION";
    } else if (sign) {
      row.waybill_status = "EXCEPTION";
    }
    alignRowAuditWindow(row, ["create_time", "collect_time", "delivery_deadline"]);
  });
}

function applyEcommerceCrossTableConsistency(generatedTables) {
  const orderRows = getGeneratedRows(generatedTables, "order_header");
  const itemRows = getGeneratedRows(generatedTables, "order_item");
  const paymentRows = getGeneratedRows(generatedTables, "payment_record");
  const refundRows = getGeneratedRows(generatedTables, "refund_ticket");
  const deliveryRows = getGeneratedRows(generatedTables, "logistics_delivery");
  const orderMap = buildRowMap(orderRows, "order_id");
  const paymentMap = buildRowMap(paymentRows, "order_id");
  const deliveryMap = buildRowMap(deliveryRows, "order_id");

  itemRows.forEach((row) => {
    row.discount_amount = clampNumericValue((Number(row.unit_price || 0) - Number(row.promo_price || 0)) * Number(row.quantity || 0), 0, 999999999, 2);
    row.item_amount = clampNumericValue(Number(row.promo_price || 0) * Number(row.quantity || 0), 0, 999999999, 2);
    alignRowAuditWindow(row, []);
  });

  orderRows.forEach((row) => {
    ensureSequentialTimes(row, ["order_time", "pay_time", "ship_time", "complete_time"], parseRealismTime(row.order_time) || Date.now(), 1, 120);
    const payment = paymentMap.get(String(row.order_id));
    const delivery = deliveryMap.get(String(row.order_id));
    if (payment) {
      row.payment_status = payment.pay_status;
      row.pay_time = payment.pay_time || row.pay_time;
    }
    if (delivery) {
      row.delivery_status = delivery.delivery_status;
      row.ship_time = delivery.dispatch_time || row.ship_time;
      row.complete_time = delivery.signed_time || row.complete_time;
    }
    const hasPay = String(row.payment_status || "").includes("成功");
    const hasShip = Boolean(row.ship_time);
    const hasComplete = Boolean(row.complete_time);
    row.order_status = hasComplete ? "COMPLETED" : hasShip ? "SHIPPED" : hasPay ? "PAID" : "PENDING_PAYMENT";
    alignRowAuditWindow(row, ["order_time", "pay_time", "ship_time", "complete_time"]);
  });

  paymentRows.forEach((row) => {
    const order = orderMap.get(String(row.order_id));
    if (!order) return;
    row.pay_amount = order.order_amount || order.net_amount || row.pay_amount;
    row.pay_time = order.pay_time || row.pay_time;
    ensureSequentialTimes(row, ["pay_time", "callback_time", "settlement_time"], parseRealismTime(row.pay_time) || Date.now(), 1, 20);
    if (String(row.pay_channel || "").includes("WECHAT")) row.acquirer_code = "WX-ACQ";
    if (String(row.pay_channel || "").includes("ALIPAY")) row.acquirer_code = "ALI-ACQ";
    if (String(row.risk_result || "") === "拦截") row.pay_status = "支付失败";
    alignRowAuditWindow(row, ["pay_time", "callback_time", "settlement_time"]);
  });

  refundRows.forEach((row) => {
    const order = orderMap.get(String(row.order_id));
    const payment = paymentMap.get(String(row.order_id));
    if (order) {
      const baseTime = parseRealismTime(order.complete_time || order.ship_time || order.pay_time || order.order_time) || Date.now();
      row.apply_time = formatRealismTime(baseTime + 12 * 60 * 60000);
      row.refund_amount = clampNumericValue(Math.min(Number(row.refund_amount || 0), Number(order.order_amount || order.net_amount || row.refund_amount || 0)), 0, Number(order.order_amount || order.net_amount || row.refund_amount || 0), 2);
    }
    if (payment) row.payment_id = payment.payment_id;
    ensureSequentialTimes(row, ["apply_time", "approve_time", "complete_time"], parseRealismTime(row.apply_time) || Date.now(), 1, 180);
    if (String(row.refund_status || "") === "待审核") {
      row.refund_status = "退款中";
    }
    if (String(row.refund_status || "").includes("成功")) {
      row.refund_status = "退款成功";
    }
    alignRowAuditWindow(row, ["apply_time", "approve_time", "complete_time"]);
  });

  deliveryRows.forEach((row) => {
    const order = orderMap.get(String(row.order_id));
    if (!order) return;
    row.dispatch_time = order.ship_time || row.dispatch_time;
    row.signed_time = order.complete_time || row.signed_time;
    row.delivery_status = String(order.order_status || "").includes("COMPLETED") ? "已签收" : String(order.order_status || "").includes("SHIPPED") ? "已出库" : row.delivery_status;
    alignRowAuditWindow(row, ["dispatch_time", "first_pickup_time", "delivered_time", "signed_time"]);
  });
}

function applyCrossTableConsistencyRules(generatedTables, profile) {
  if (!profile?.industry) return;
  if (profile.industry === "finance_fund") applyFundCrossTableConsistency(generatedTables);
  if (profile.industry === "bank_regulatory") applyBankCrossTableConsistency(generatedTables);
  if (profile.industry === "logistics_express") applyLogisticsCrossTableConsistency(generatedTables);
  if (profile.industry === "ecommerce") applyEcommerceCrossTableConsistency(generatedTables);
}

function formatDirtyDate(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function pickDirtyField(fields, predicate) {
  return (fields || []).find((field) => !field.primaryKey && !field.foreignKey && predicate(field));
}

function pickDirtyCategory(categories, dirtyProfile) {
  const weights = categories.map((category) => ({
    category,
    weight: Number((dirtyProfile || {})[category] ?? DIRTY_CATEGORY_WEIGHTS[category] ?? 1),
  }));
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * Math.max(total, 1);
  for (const item of weights) {
    cursor -= item.weight;
    if (cursor <= 0) return item.category;
  }
  return weights[0]?.category || "ACCURACY";
}

function buildGenericDirtyPlans(row, fields, serial, startedAt) {
  const plans = [];
  const textRequiredField = pickDirtyField(fields, (field) => !field.nullable && !field.uniqueKey && isTextField(field) && row[field.fieldName] !== undefined && row[field.fieldName] !== null);
  if (textRequiredField) {
    plans.push({
      category: "COMPLETENESS",
      rule: "EMPTY_REQUIRED_TEXT",
      fieldName: textRequiredField.fieldName,
      apply: () => { row[textRequiredField.fieldName] = " "; },
    });
  }

  const nullableField = pickDirtyField(fields, (field) => field.nullable && row[field.fieldName] !== undefined);
  if (nullableField) {
    plans.push({
      category: "COMPLETENESS",
      rule: "NULL_OPTIONAL_FIELD",
      fieldName: nullableField.fieldName,
      apply: () => { row[nullableField.fieldName] = null; },
    });
  }

  const phoneField = pickDirtyField(fields, (field) => String(field.fieldName).includes("mobile") || String(field.businessSemantic || "").toUpperCase().includes("PHONE"));
  if (phoneField) {
    plans.push({
      category: "ACCURACY",
      rule: "PHONE_FORMAT_INVALID",
      fieldName: phoneField.fieldName,
      apply: () => { row[phoneField.fieldName] = `9${String(100000000 + serial).slice(-9)}`; },
    });
  }

  const emailField = pickDirtyField(fields, (field) => String(field.fieldName).includes("email") || String(field.businessSemantic || "").toUpperCase().includes("EMAIL"));
  if (emailField) {
    plans.push({
      category: "ACCURACY",
      rule: "EMAIL_FORMAT_INVALID",
      fieldName: emailField.fieldName,
      apply: () => { row[emailField.fieldName] = `invalid_mail_${serial}`; },
    });
  }

  const idField = pickDirtyField(fields, (field) => String(field.fieldName).includes("id_card") || String(field.businessSemantic || "").toUpperCase().includes("ID_CARD"));
  if (idField) {
    plans.push({
      category: "COMPLIANCE",
      rule: "ID_CARD_FORMAT_INVALID",
      fieldName: idField.fieldName,
      apply: () => { row[idField.fieldName] = `32010${String(19880101 + (serial % 8000)).padStart(8, "0")}${String(serial % 900).padStart(3, "0")}Z`; },
    });
  }

  const enumField = pickDirtyField(fields, (field) => String(field.businessSemantic || "").toUpperCase().includes("DICT") || String(field.fieldName).includes("status") || String(field.fieldName).includes("type"));
  if (enumField) {
    plans.push({
      category: "COMPLIANCE",
      rule: "ENUM_SCOPE_INVALID",
      fieldName: enumField.fieldName,
      apply: () => { row[enumField.fieldName] = "__INVALID_ENUM__"; },
    });
  }

  const amountField = pickDirtyField(fields, (field) => isNumericField(field) && isNumericSensitiveField(field.fieldName));
  if (amountField) {
    plans.push({
      category: "ACCURACY",
      rule: "NUMERIC_OUT_OF_RANGE",
      fieldName: amountField.fieldName,
      apply: () => {
        const fieldName = String(amountField.fieldName);
        if (hasFieldNameToken(fieldName, "ratio")) row[amountField.fieldName] = 180;
        else if (hasFieldNameToken(fieldName, "qty") || hasFieldNameToken(fieldName, "count")) row[amountField.fieldName] = -7;
        else row[amountField.fieldName] = -9999.99;
      },
    });
  }

  const maskedField = pickDirtyField(fields, (field) => String(field.fieldName).includes("mask"));
  if (maskedField) {
    plans.push({
      category: "COMPLIANCE",
      rule: "MASKING_COMPLIANCE_BROKEN",
      fieldName: maskedField.fieldName,
      apply: () => { row[maskedField.fieldName] = "6222021234567890123"; },
    });
  }

  const plateField = pickDirtyField(fields, (field) => String(field.fieldName).includes("plate_no"));
  if (plateField) {
    plans.push({
      category: "COMPLIANCE",
      rule: "LICENSE_PLATE_INVALID",
      fieldName: plateField.fieldName,
      apply: () => { row[plateField.fieldName] = `ABC${String(10000 + serial).slice(-5)}`; },
    });
  }

  const barcodeField = pickDirtyField(fields, (field) => String(field.fieldName).includes("barcode"));
  if (barcodeField) {
    plans.push({
      category: "COMPLIANCE",
      rule: "BARCODE_INVALID",
      fieldName: barcodeField.fieldName,
      apply: () => { row[barcodeField.fieldName] = `BC${serial}`; },
    });
  }

  const postalField = pickDirtyField(fields, (field) => String(field.fieldName).includes("postal_code"));
  if (postalField) {
    plans.push({
      category: "ACCURACY",
      rule: "POSTAL_CODE_INVALID",
      fieldName: postalField.fieldName,
      apply: () => { row[postalField.fieldName] = "ABCDE1"; },
    });
  }

  const orgField = pickDirtyField(fields, (field) => String(field.fieldName).includes("org_code"));
  if (orgField) {
    plans.push({
      category: "COMPLIANCE",
      rule: "ORG_CODE_INVALID",
      fieldName: orgField.fieldName,
      apply: () => { row[orgField.fieldName] = `ORG-${serial}`; },
    });
  }

  const uniqueTextField = pickDirtyField(fields, (field) => field.uniqueKey && isTextField(field));
  if (uniqueTextField) {
    plans.push({
      category: "UNIQUENESS",
      rule: "SEMANTIC_DUPLICATE",
      fieldName: uniqueTextField.fieldName,
      apply: () => { row[uniqueTextField.fieldName] = ` ${String(row[uniqueTextField.fieldName] || "").trim()} `; },
    });
  }

  const dateField = pickDirtyField(fields, (field) => isDateField(field));
  if (dateField) {
    plans.push({
      category: "TIMELINESS",
      rule: "UNREASONABLE_TIME",
      fieldName: dateField.fieldName,
      apply: () => { row[dateField.fieldName] = "1990-01-01 00:00:00"; },
    });
  }

  return plans;
}

function legacyBuildScenarioDirtyPlans_UNUSED(row, table, serial, startedAt) {
  const plans = [];
  const tableName = String(table?.tableName || "");
  const getTime = (fieldName) => new Date(String(row[fieldName] || startedAt)).getTime();

  if (tableName === "order_header") {
    plans.push({
      category: "CONSISTENCY",
      rule: "ORDER_PAY_BEFORE_ORDER",
      fieldName: "pay_time",
      apply: () => { row.pay_time = formatDirtyDate(new Date(getTime("order_time") - 2 * 60 * 60 * 1000)); },
    });
    plans.push({
      category: "CONSISTENCY",
      rule: "ORDER_STATUS_PAYMENT_CONFLICT",
      fieldName: "payment_status",
      apply: () => { row.order_status = "已完成"; row.payment_status = "待支付"; row.delivery_status = "待出库"; },
    });
  }

  if (tableName === "order_item") {
    plans.push({
      category: "CONSISTENCY",
      rule: "ORDER_ITEM_AMOUNT_MISMATCH",
      fieldName: "item_amount",
      apply: () => { row.item_amount = Number(row.item_amount || 0) + 777.77; },
    });
  }

  if (tableName === "payment_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "PAYMENT_TIME_SEQUENCE_INVALID",
      fieldName: "settlement_time",
      apply: () => { row.settlement_time = row.pay_time; row.callback_time = formatDirtyDate(new Date(getTime("pay_time") - 30 * 60 * 1000)); },
    });
  }

  if (tableName === "refund_ticket") {
    plans.push({
      category: "CONSISTENCY",
      rule: "REFUND_AMOUNT_EXCEEDS_PAYMENT",
      fieldName: "refund_amount",
      apply: () => { row.refund_amount = Number(row.refund_amount || 0) + 3000; },
    });
    plans.push({
      category: "TIMELINESS",
      rule: "REFUND_TIME_SEQUENCE_INVALID",
      fieldName: "complete_time",
      apply: () => { row.complete_time = row.apply_time; row.approve_time = formatDirtyDate(new Date(getTime("apply_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "logistics_delivery") {
    plans.push({
      category: "CONSISTENCY",
      rule: "DELIVERY_TIME_SEQUENCE_INVALID",
      fieldName: "signed_time",
      apply: () => { row.signed_time = row.dispatch_time; row.delivered_time = formatDirtyDate(new Date(getTime("dispatch_time") - 2 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "violation_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "VIOLATION_NOTICE_SEQUENCE_INVALID",
      fieldName: "handle_deadline",
      apply: () => { row.handle_deadline = row.notice_time; row.notice_time = formatDirtyDate(new Date(getTime("capture_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "checkpoint_inspection") {
    plans.push({
      category: "TIMELINESS",
      rule: "INSPECTION_RELEASE_BEFORE_CHECK",
      fieldName: "release_time",
      apply: () => { row.release_time = formatDirtyDate(new Date(getTime("inspection_time") - 10 * 60 * 1000)); },
    });
  }

  if (tableName === "accident_case") {
    plans.push({
      category: "TIMELINESS",
      rule: "ACCIDENT_CLOSE_BEFORE_OCCUR",
      fieldName: "close_time",
      apply: () => { row.close_time = formatDirtyDate(new Date(getTime("occur_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "enforcement_document") {
    plans.push({
      category: "TIMELINESS",
      rule: "DOCUMENT_SERVE_BEFORE_ISSUE",
      fieldName: "serve_time",
      apply: () => { row.serve_time = formatDirtyDate(new Date(getTime("issue_time") - 30 * 60 * 1000)); },
    });
  }

  if (tableName === "prudential_report") {
    plans.push({
      category: "CONSISTENCY",
      rule: "BANK_RATIO_HIERARCHY_INVALID",
      fieldName: "core_tier1_ratio",
      apply: () => { row.core_tier1_ratio = 15.5; row.tier1_capital_ratio = 11.2; row.capital_adequacy_ratio = 10.1; },
    });
    plans.push({
      category: "TIMELINESS",
      rule: "BANK_RECEIVE_BEFORE_SUBMIT",
      fieldName: "receive_time",
      apply: () => { row.receive_time = formatDirtyDate(new Date(getTime("submit_time") - 2 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "report_metric_item") {
    plans.push({
      category: "ACCURACY",
      rule: "BANK_METRIC_OUTLIER",
      fieldName: "metric_value",
      apply: () => { row.metric_value = String(row.metric_name || "").includes("率") ? 180 : -99; },
    });
  }

  if (tableName === "risk_exposure_snapshot") {
    plans.push({
      category: "ACCURACY",
      rule: "RISK_CONCENTRATION_OVERFLOW",
      fieldName: "concentration_ratio",
      apply: () => { row.concentration_ratio = 160; row.early_warning_level = "正常"; },
    });
  }

  if (tableName === "anti_money_alert") {
    plans.push({
      category: "CONSISTENCY",
      rule: "AML_STATUS_CONFLICT",
      fieldName: "report_required_status",
      apply: () => { row.alert_status = "已排除"; row.review_result = "可疑"; row.report_required_status = "待评估"; },
    });
  }

  if (tableName === "exception_case") {
    plans.push({
      category: "TIMELINESS",
      rule: "CASE_DEADLINE_INVALID",
      fieldName: "due_at",
      apply: () => { row.due_at = formatDirtyDate(new Date(getTime("identified_at") - 24 * 60 * 60 * 1000)); row.disposed_at = formatDirtyDate(new Date(getTime("identified_at") - 2 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "rectification_task") {
    plans.push({
      category: "TIMELINESS",
      rule: "TASK_FINISH_BEFORE_START",
      fieldName: "finish_time",
      apply: () => { row.finish_time = formatDirtyDate(new Date(getTime("start_time") - 60 * 60 * 1000)); row.verify_result = "通过"; },
    });
  }

  if (tableName === "submission_log") {
    plans.push({
      category: "CONSISTENCY",
      rule: "SUBMISSION_LOG_RETRY_CONFLICT",
      fieldName: "retry_count",
      apply: () => { row.log_status = "已接收"; row.retry_count = 3; row.archive_status = "待归档"; },
    });
  }

  if (tableName === "approval_flow") {
    plans.push({
      category: "CONSISTENCY",
      rule: "APPROVAL_NEXT_NODE_CONFLICT",
      fieldName: "next_node",
      apply: () => { row.approval_result = "通过"; row.next_node = "机构复核"; row.node_status = "待处理"; },
    });
  }

  plans.push(...educationSupport.buildEducationDirtyPlans(row, table, startedAt));
  return plans;
}

function legacyInjectDirtyValue_UNUSED(row, table, fields, profile, startedAt, serial, dirtyProfile = {}) {
  const plans = [
    ...buildGenericDirtyPlans(row, fields, serial, startedAt),
    ...buildScenarioDirtyPlans(row, table, serial, startedAt),
  ];
  if (plans.length === 0) return row;
  const categories = [...new Set(plans.map((item) => item.category))];
  const selectedCategory = pickDirtyCategory(categories, dirtyProfile);
  const candidates = plans.filter((item) => item.category === selectedCategory);
  const selectedPlan = candidates[Math.floor(Math.random() * candidates.length)] || plans[0];
  selectedPlan.apply();
  row.__dirtyFlag = true;
  row.__dirtyCategory = selectedPlan.category;
  row.__dirtyRule = selectedPlan.rule;
  row.__dirtyField = selectedPlan.fieldName || null;
  return row;
}

function buildScenarioDirtyPlans(row, table, serial, startedAt) {
  const plans = [];
  const tableName = String(table?.tableName || "");
  const getTime = (fieldName) => new Date(String(row[fieldName] || startedAt)).getTime();

  if (tableName === "order_header") {
    plans.push({
      category: "CONSISTENCY",
      rule: "ORDER_PAY_BEFORE_ORDER",
      fieldName: "pay_time",
      apply: () => { row.pay_time = formatDirtyDate(new Date(getTime("order_time") - 2 * 60 * 60 * 1000)); },
    });
    plans.push({
      category: "CONSISTENCY",
      rule: "ORDER_STATUS_PAYMENT_CONFLICT",
      fieldName: "payment_status",
      apply: () => { row.payment_status = "待支付"; },
    });
  }

  if (tableName === "order_item") {
    plans.push({
      category: "CONSISTENCY",
      rule: "ORDER_ITEM_AMOUNT_MISMATCH",
      fieldName: "item_amount",
      apply: () => { row.item_amount = Number(row.item_amount || 0) + 777.77; },
    });
  }

  if (tableName === "payment_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "PAYMENT_SETTLEMENT_BEFORE_PAY",
      fieldName: "settlement_time",
      apply: () => { row.settlement_time = formatDirtyDate(new Date(getTime("pay_time") - 30 * 60 * 1000)); },
    });
  }

  if (tableName === "refund_ticket") {
    plans.push({
      category: "CONSISTENCY",
      rule: "REFUND_AMOUNT_EXCEEDS_PAYMENT",
      fieldName: "refund_amount",
      apply: () => { row.refund_amount = Number(row.refund_amount || 0) + 3000; },
    });
    plans.push({
      category: "TIMELINESS",
      rule: "REFUND_APPROVE_BEFORE_APPLY",
      fieldName: "approve_time",
      apply: () => { row.approve_time = formatDirtyDate(new Date(getTime("apply_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "logistics_delivery") {
    plans.push({
      category: "CONSISTENCY",
      rule: "DELIVERY_SIGN_BEFORE_DISPATCH",
      fieldName: "signed_time",
      apply: () => { row.signed_time = formatDirtyDate(new Date(getTime("dispatch_time") - 2 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "live_stream_session") {
    plans.push({
      category: "TIMELINESS",
      rule: "LIVE_SESSION_END_BEFORE_START",
      fieldName: "end_time",
      apply: () => { row.end_time = formatDirtyDate(new Date(getTime("start_time") - 30 * 60 * 1000)); },
    });
    plans.push({
      category: "ACCURACY",
      rule: "LIVE_SESSION_CONVERSION_OVERFLOW",
      fieldName: "conversion_rate",
      apply: () => { row.conversion_rate = 1.28; },
    });
  }

  if (tableName === "enterprise_procurement_order") {
    plans.push({
      category: "CONSISTENCY",
      rule: "PROCUREMENT_PAID_EXCEEDS_ORDER",
      fieldName: "paid_amount",
      apply: () => { row.paid_amount = Number(row.order_amount || 0) + 8888.88; },
    });
    plans.push({
      category: "TIMELINESS",
      rule: "PROCUREMENT_SETTLEMENT_BEFORE_SIGN",
      fieldName: "settlement_time",
      apply: () => { row.settlement_time = formatDirtyDate(new Date(getTime("signed_time") - 24 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "violation_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "VIOLATION_NOTICE_SEQUENCE_INVALID",
      fieldName: "notice_time",
      apply: () => { row.notice_time = formatDirtyDate(new Date(getTime("capture_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "checkpoint_inspection") {
    plans.push({
      category: "TIMELINESS",
      rule: "INSPECTION_RELEASE_BEFORE_CHECK",
      fieldName: "release_time",
      apply: () => { row.release_time = formatDirtyDate(new Date(getTime("inspection_time") - 10 * 60 * 1000)); },
    });
  }

  if (tableName === "accident_case") {
    plans.push({
      category: "TIMELINESS",
      rule: "ACCIDENT_CLOSE_BEFORE_OCCUR",
      fieldName: "close_time",
      apply: () => { row.close_time = formatDirtyDate(new Date(getTime("occur_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "enforcement_document") {
    plans.push({
      category: "TIMELINESS",
      rule: "DOCUMENT_SERVE_BEFORE_ISSUE",
      fieldName: "serve_time",
      apply: () => { row.serve_time = formatDirtyDate(new Date(getTime("issue_time") - 30 * 60 * 1000)); },
    });
  }

  if (tableName === "prudential_report") {
    plans.push({
      category: "CONSISTENCY",
      rule: "BANK_RATIO_HIERARCHY_INVALID",
      fieldName: "core_tier1_ratio",
      apply: () => { row.core_tier1_ratio = Number(row.tier1_capital_ratio || 0) + 5; },
    });
    plans.push({
      category: "TIMELINESS",
      rule: "BANK_RECEIVE_BEFORE_SUBMIT",
      fieldName: "receive_time",
      apply: () => { row.receive_time = formatDirtyDate(new Date(getTime("submit_time") - 2 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "report_metric_item") {
    plans.push({
      category: "ACCURACY",
      rule: "BANK_METRIC_OUTLIER",
      fieldName: "metric_value",
      apply: () => { row.metric_value = 180; },
    });
  }

  if (tableName === "risk_exposure_snapshot") {
    plans.push({
      category: "ACCURACY",
      rule: "RISK_CONCENTRATION_OVERFLOW",
      fieldName: "concentration_ratio",
      apply: () => { row.concentration_ratio = 160; },
    });
    plans.push({
      category: "CONSISTENCY",
      rule: "RISK_LEVEL_INCONSISTENT",
      fieldName: "early_warning_level",
      apply: () => { row.early_warning_level = "正常"; },
    });
  }

  if (tableName === "anti_money_alert") {
    plans.push({
      category: "CONSISTENCY",
      rule: "AML_STATUS_CONFLICT",
      fieldName: "report_required_status",
      apply: () => { row.report_required_status = "待评估"; },
    });
  }

  if (tableName === "exception_case") {
    plans.push({
      category: "TIMELINESS",
      rule: "CASE_DEADLINE_INVALID",
      fieldName: "due_at",
      apply: () => { row.due_at = formatDirtyDate(new Date(getTime("identified_at") - 24 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "rectification_task") {
    plans.push({
      category: "TIMELINESS",
      rule: "TASK_FINISH_BEFORE_START",
      fieldName: "finish_time",
      apply: () => { row.finish_time = formatDirtyDate(new Date(getTime("start_time") - 60 * 60 * 1000)); },
    });
  }

  if (tableName === "submission_log") {
    plans.push({
      category: "CONSISTENCY",
      rule: "SUBMISSION_LOG_RETRY_CONFLICT",
      fieldName: "retry_count",
      apply: () => { row.retry_count = 3; },
    });
  }

  if (tableName === "approval_flow") {
    plans.push({
      category: "CONSISTENCY",
      rule: "APPROVAL_NEXT_NODE_CONFLICT",
      fieldName: "next_node",
      apply: () => { row.next_node = "机构复核"; },
    });
  }

  if (tableName === "customer_account") {
    plans.push({
      category: "CONSISTENCY",
      rule: "ACCOUNT_AVAILABLE_EXCEEDS_BALANCE",
      fieldName: "available_amount",
      apply: () => { row.available_amount = Number(row.balance_amount || 0) + 18888.88; },
    });
  }

  if (tableName === "loan_contract_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "LOAN_MATURITY_BEFORE_DISBURSEMENT",
      fieldName: "maturity_date",
      apply: () => { row.maturity_date = formatDirtyDate(new Date(getTime("disbursement_date") - 7 * 24 * 60 * 60 * 1000)); },
    });
  }

  if (tableName === "parent_communication_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "PARENT_REPLY_BEFORE_SEND",
      fieldName: "reply_time",
      apply: () => { row.reply_time = formatDirtyDate(new Date(getTime("send_time") - 15 * 60 * 1000)); },
    });
  }

  if (tableName === "dormitory_resident_record") {
    plans.push({
      category: "TIMELINESS",
      rule: "DORM_CHECKOUT_BEFORE_CHECKIN",
      fieldName: "checkout_time",
      apply: () => { row.checkout_time = formatDirtyDate(new Date(getTime("checkin_time") - 12 * 60 * 60 * 1000)); },
    });
  }

  return plans;
}

function collectDirtyPlans(row, table, fields, profile, startedAt, serial) {
  return [
    ...buildGenericDirtyPlans(row, fields, serial, startedAt),
    ...buildScenarioDirtyPlans(row, table, serial, startedAt),
  ];
}

function applyDirtyPlan(row, selectedPlan) {
  if (!selectedPlan) return row;
  selectedPlan.apply();
  row.__dirtyFlag = true;
  row.__dirtyCells = Array.isArray(row.__dirtyCells) ? row.__dirtyCells : [];
  row.__dirtyCells.push({
    fieldName: selectedPlan.fieldName || null,
    category: selectedPlan.category,
    rule: selectedPlan.rule,
  });
  row.__dirtyCategory = selectedPlan.category;
  row.__dirtyRule = selectedPlan.rule;
  row.__dirtyField = selectedPlan.fieldName || null;
  return row;
}

function buildDirtyCandidates(rows, table, fields, profile, startedAt, baseOffset = 0) {
  const candidates = [];
  rows.forEach((row, rowIndex) => {
    const serial = Number(baseOffset || 0) + rowIndex + 1;
    const plans = collectDirtyPlans(row, table, fields, profile, startedAt, serial);
    const planMap = new Map();
    plans.forEach((plan) => {
      if (!plan.fieldName) return;
      if (!planMap.has(plan.fieldName)) {
        planMap.set(plan.fieldName, []);
      }
      planMap.get(plan.fieldName).push(plan);
    });
    for (const [fieldName, fieldPlans] of planMap.entries()) {
      candidates.push({ row, rowIndex, fieldName, plans: fieldPlans });
    }
  });
  return candidates;
}

function selectDirtyCellPlans(candidates, targetCount, dirtyRatio, dirtyProfile = {}) {
  const selected = [];
  const remaining = [...(candidates || [])];
  const selectedFieldCounts = new Map();
  const fieldCapacity = new Map();
  remaining.forEach((item) => {
    const key = `${item.plans[0]?.category || "UNKNOWN"}::${item.fieldName}`;
    fieldCapacity.set(key, Number(fieldCapacity.get(key) || 0) + 1);
  });
  while (selected.length < targetCount && remaining.length > 0) {
    const categories = [...new Set(remaining.flatMap((item) => item.plans.map((plan) => plan.category)))];
    const selectedCategory = pickDirtyCategory(categories, dirtyProfile);
    const categoryCandidates = remaining.filter((item) => item.plans.some((plan) => plan.category === selectedCategory));
    const candidatePool = categoryCandidates.length > 0 ? categoryCandidates : remaining;
    let lowestRatio = Number.POSITIVE_INFINITY;
    let balancedCandidates = [];
    candidatePool.forEach((item) => {
      const fieldKey = `${selectedCategory}::${item.fieldName}`;
      const used = Number(selectedFieldCounts.get(fieldKey) || 0);
      const capacity = Math.max(1, Number(fieldCapacity.get(fieldKey) || 1));
      const fieldCap = Math.max(1, Math.round(capacity * Math.max(0, Number(dirtyRatio || 0))));
      if (used >= fieldCap) {
        return;
      }
      const ratio = used / capacity;
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        balancedCandidates = [item];
      } else if (ratio === lowestRatio) {
        balancedCandidates.push(item);
      }
    });
    if (balancedCandidates.length === 0) {
      break;
    }
    const pickedCell = balancedCandidates[Math.floor(Math.random() * balancedCandidates.length)];
    const matchedPlans = pickedCell.plans.filter((plan) => plan.category === selectedCategory);
    const planPool = matchedPlans.length > 0 ? matchedPlans : pickedCell.plans;
    const selectedPlan = planPool[Math.floor(Math.random() * planPool.length)];
    selected.push({ row: pickedCell.row, plan: selectedPlan });
    const selectedFieldKey = `${selectedCategory}::${pickedCell.fieldName}`;
    selectedFieldCounts.set(selectedFieldKey, Number(selectedFieldCounts.get(selectedFieldKey) || 0) + 1);
    const remainingIndex = remaining.findIndex((item) => item.rowIndex === pickedCell.rowIndex && item.fieldName === pickedCell.fieldName);
    if (remainingIndex >= 0) {
      remaining.splice(remainingIndex, 1);
    }
  }
  return selected;
}

function generateRowsForScene(scene, schema, strategy, mode = "INIT", options = {}) {
  const strategyMap = new Map((strategy.tables || []).map((table) => [table.tableName, table]));
  const pkPools = new Map();
  const pkRemap = new Map();
  const orderedTables = topologicalSortTables(schema);
  const sceneCode = scene.sceneCode || normalizeSceneCode(scene.sceneName);
  const startedAt = new Date(strategy.globalConfig?.startTime || Date.now());
  const baseOffsets = options.baseOffsets || {};
  const generatedTables = [];
  const topicMessages = [];
  const scenarioProfile = strategy.scenarioProfile || schema.scenarioProfile || scenarioEngine.buildScenarioProfile({
    sceneName: scene.sceneName,
    sceneDesc: scene.sceneDesc,
    knowledgeText: "",
  });
  const scenarioRuntime = scenarioEngine.createScenarioRuntime(scenarioProfile, sceneCode, startedAt);
  const dirtyCandidates = [];
  let totalFieldCells = 0;

  for (const [tableOrder, table] of orderedTables.entries()) {
    const strategyTable = strategyMap.get(table.tableName) || {};
    const rowCount = Number(mode === "INIT" ? strategyTable.initRows : strategyTable.incrRows) || 0;
    const rows = [];
    const primaryKeyField = table.fields.find((field) => field.primaryKey) || table.fields[0];
    for (let index = 0; index < rowCount; index += 1) {
      const row = {};
      const serial = Number(baseOffsets?.[table.tableName] || 0) + index + 1;
      const scenarioRow = scenarioEngine.generateScenarioRow({
        profile: scenarioProfile,
        table,
        serial,
        runtime: scenarioRuntime,
        startedAt,
      }) || {};
      table.fields.forEach((field) => {
        const configuredGenerator = strategyTable.fieldGenerators?.find((item) => item.fieldName === field.fieldName)?.generatorType;
        const scenarioValue = Object.prototype.hasOwnProperty.call(scenarioRow, field.fieldName)
          ? scenarioRow[field.fieldName]
          : undefined;
        row[field.fieldName] = (scenarioValue === undefined || scenarioValue === null)
          ? generateFieldValue({ sceneCode, table, field, index, startedAt, pkPools, baseOffsets, generatorType: configuredGenerator, profile: scenarioProfile })
          : scenarioValue;
      });
      table.fields.forEach((field) => {
        if (!field.foreignKey) return;
        const parentRemap = pkRemap.get(field.foreignRefTable);
        const currentValue = row[field.fieldName];
        if (parentRemap && parentRemap.has(currentValue)) {
          row[field.fieldName] = parentRemap.get(currentValue);
        }
      });
      extendedRuleEngine.applyRowLevelRules(row, table, scenarioProfile, { serial, startedAt, sceneCode });
      applyRealismFixRules(row, table, scenarioProfile, startedAt, sceneCode, serial);
      if (primaryKeyField) {
        const oldPk = row[primaryKeyField.fieldName];
        const newPk = buildLongPrimaryKey(sceneCode, table.tableName, tableOrder + 1, serial);
        row[primaryKeyField.fieldName] = newPk;
        if (!pkRemap.has(table.tableName)) {
          pkRemap.set(table.tableName, new Map());
        }
        pkRemap.get(table.tableName).set(oldPk, newPk);
      }
      rows.push(row);
    }

    pkPools.set(table.tableName, rows.map((row) => row[primaryKeyField.fieldName]).filter((value) => value !== undefined && value !== null));
    totalFieldCells += rows.length * (table.fields || []).length;
    if (strategy.globalConfig?.dirtyEnabled && Number(strategy.globalConfig?.dirtyRatio || 0) > 0) {
      dirtyCandidates.push(...buildDirtyCandidates(rows, table, table.fields, scenarioProfile, startedAt, Number(baseOffsets?.[table.tableName] || 0)));
    }
    generatedTables.push({ table, strategyTable, rows, physicalTableName: buildPhysicalTableName(sceneCode, table.tableName) });
  }

  extendedRuleEngine.applyDatasetRules(generatedTables, scenarioProfile);
  applyCrossTableConsistencyRules(generatedTables, scenarioProfile);

  if (strategy.globalConfig?.dirtyEnabled && Number(strategy.globalConfig?.dirtyRatio || 0) > 0 && dirtyCandidates.length > 0) {
    const targetDirtyCells = Math.min(dirtyCandidates.length, calculateTargetDirtyCellCount(totalFieldCells, strategy.globalConfig?.dirtyRatio || 0));
    const selectedPlans = selectDirtyCellPlans(dirtyCandidates, targetDirtyCells, strategy.globalConfig?.dirtyRatio || 0, strategy.globalConfig?.dirtyProfile || {});
    selectedPlans.forEach(({ row, plan }) => applyDirtyPlan(row, plan));
  }

  const rowsByTable = [];
  for (const item of generatedTables) {
    const writeMode = item.strategyTable.writeMode || "MYSQL_ONLY";
    if (writeMode !== "MYSQL_ONLY") {
      const topicName = item.strategyTable.topicName || `lab.scene.${sceneCode}.${item.table.tableName}`;
      item.rows.slice(0, Math.min(item.rows.length, 200)).forEach((row, rowIndex) => {
        topicMessages.push({
          topicName,
          message: {
            sceneCode,
            tableName: item.physicalTableName,
            eventType: mode === "REALTIME" ? "EVENT" : "INSERT",
            eventTime: new Date(startedAt.getTime() + rowIndex * 60 * 1000).toISOString(),
            traceId: randomUUID(),
            data: row,
            dirtyFlag: Boolean(row.__dirtyFlag),
            dirtyCellCount: Array.isArray(row.__dirtyCells) ? row.__dirtyCells.length : 0,
            version: 1,
          },
        });
      });
    }
    rowsByTable.push({ tableName: item.table.tableName, physicalTableName: item.physicalTableName, rows: item.rows });
  }

  return { rowsByTable, topicMessages };
}

function buildQualityReportPayload(scene, tableStats, kafkaStats) {
  const totalIssues = tableStats.reduce((sum, item) => sum + Number(item.dirtyRows || 0), 0);
  const totalRows = tableStats.reduce((sum, item) => sum + Number(item.rowCount || 0), 0);
  const dirtyRate = totalRows > 0 ? totalIssues / totalRows : 0;
  const score = Math.max(15, Number((100 - Math.min(85, dirtyRate * 100)).toFixed(2)));
  return { reportCode: `quality_${scene.id}`, score, summary: { totalRows, totalIssues, dirtyRate, sceneStatus: scene.status, generatedAt: new Date().toISOString() }, tableStats, fieldIssues: tableStats.flatMap((item) => (item.issueFields || []).map((fieldName) => ({ tableName: item.tableName, fieldName, issueType: "DIRTY_VALUE" }))), dirtyDistribution: tableStats.map((item) => ({ tableName: item.tableName, dirtyRows: item.dirtyRows || 0 })), kafkaStats };
}

module.exports = {
  normalizeSceneCode,
  sanitizeIdentifier,
  inferScenarioTemplate,
  generateSchemaPayload,
  generateStrategyPayload,
  applySchemaAdjustment,
  applyStrategyAdjustment,
  buildPhysicalTableName,
  buildDDLStatements,
  buildSceneTopics,
  generateRowsForScene,
  buildQualityReportPayload
};
