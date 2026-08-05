function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function createSeededRandom(seed) {
  let current = seed % 2147483647;
  if (current <= 0) {
    current += 2147483646;
  }
  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
}

function pickOne(items, random) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const position = Math.floor(random() * items.length);
  return items[position];
}

function pickWeighted(items, random) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const totalWeight = items.reduce((sum, item) => sum + Number(item.weight || 1), 0);
  let cursor = random() * totalWeight;
  for (const item of items) {
    cursor -= Number(item.weight || 1);
    if (cursor <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

const CUSTOMER_FAMILY_NAMES = ["张", "王", "李", "刘", "陈", "杨", "黄", "赵", "周", "吴", "徐", "孙"];
const CUSTOMER_GIVEN_NAMES = ["晨", "悦", "涵", "宁", "宇", "琪", "妍", "哲", "轩", "然", "琳", "涛", "洁", "博"];
const CUSTOMER_EMAIL_DOMAINS = ["qq.com", "163.com", "126.com", "foxmail.com", "yeah.net", "aliyun.com", "sina.com", "outlook.com"];
const CITY_OPTIONS = [
  { code: "310000", name: "上海", districts: ["浦东新区", "徐汇区", "闵行区"] },
  { code: "330100", name: "杭州", districts: ["滨江区", "余杭区", "西湖区"] },
  { code: "320100", name: "南京", districts: ["建邺区", "江宁区", "鼓楼区"] },
  { code: "440300", name: "深圳", districts: ["南山区", "福田区", "龙华区"] },
  { code: "510100", name: "成都", districts: ["高新区", "武侯区", "锦江区"] },
];

const ECOMMERCE_CATEGORIES = [
  {
    code: "ELECTRONIC",
    label: "手机数码",
    weight: 34,
    products: [
      { brand: "Apple", series: "iPhone 15", storage: ["128GB", "256GB", "512GB"], colors: ["黑色", "银色", "深空灰"] },
      { brand: "HUAWEI", series: "Mate 60 Pro", storage: ["256GB", "512GB"], colors: ["钛金色", "深空灰", "远峰蓝"] },
      { brand: "Xiaomi", series: "Xiaomi 14", storage: ["256GB", "512GB"], colors: ["黑色", "银色", "远峰蓝"] },
      { brand: "OPPO", series: "Find X7", storage: ["256GB", "512GB"], colors: ["银色", "黑色", "深空灰"] },
      { brand: "vivo", series: "X100", storage: ["128GB", "256GB", "512GB"], colors: ["远峰蓝", "钛金色", "深空灰"] },
    ],
    storage: ["128GB", "256GB", "512GB"],
    colors: ["黑色", "银色", "深空灰", "远峰蓝", "钛金色"],
    priceRange: [3999, 11999],
    stockRange: [60, 600],
    titlePattern: "{brand} {series} {storage} {color}",
  },
  {
    code: "HOME",
    label: "家电家居",
    weight: 26,
    products: [
      { brand: "美的", series: "变频空调", storage: [""], colors: ["白色", "冰川银"] },
      { brand: "海尔", series: "双开门冰箱", storage: [""], colors: ["冰川银", "曜石黑"] },
      { brand: "格力", series: "云锦挂机空调", storage: [""], colors: ["白色"] },
      { brand: "小米", series: "空气净化器 4 Lite", storage: [""], colors: ["白色", "深灰"] },
      { brand: "追觅", series: "扫地机器人 S20", storage: [""], colors: ["白色", "曜石黑"] },
    ],
    storage: [""],
    colors: ["白色", "深灰", "曜石黑", "冰川银"],
    priceRange: [899, 6999],
    stockRange: [20, 180],
    titlePattern: "{brand}{series} {color}",
  },
  {
    code: "FOOD",
    label: "食品酒水",
    weight: 20,
    products: [
      { brand: "良品铺子", series: "每日坚果礼盒", storage: ["500g", "750g"], colors: [""] },
      { brand: "三只松鼠", series: "卤味零食组合", storage: ["500g", "750g"], colors: [""] },
      { brand: "元气森林", series: "气泡水组合", storage: ["12瓶", "24瓶"], colors: [""] },
      { brand: "王小卤", series: "虎皮凤爪礼盒", storage: ["500g", "750g"], colors: [""] },
      { brand: "认养一头牛", series: "纯牛奶早餐装", storage: ["12盒", "24盒"], colors: [""] },
    ],
    storage: ["500g", "750g", "12瓶", "24盒"],
    colors: [""],
    priceRange: [29, 299],
    stockRange: [120, 1200],
    titlePattern: "{brand}{series} {storage}",
  },
  {
    code: "APPAREL",
    label: "服饰鞋包",
    weight: 20,
    products: [
      { brand: "安踏", series: "男款跑步鞋", storage: ["42码", "43码"], colors: ["黑灰", "月光白"] },
      { brand: "李宁", series: "训练长裤", storage: ["L", "XL"], colors: ["黑灰", "海军蓝"] },
      { brand: "Nike", series: "休闲卫衣", storage: ["L", "XL"], colors: ["黑灰", "奶油杏"] },
      { brand: "Adidas", series: "轻量背包", storage: ["均码"], colors: ["黑灰", "海军蓝"] },
      { brand: "波司登", series: "女款羽绒服", storage: ["L", "XL"], colors: ["月光白", "奶油杏"] },
    ],
    storage: ["42码", "L", "XL", "均码"],
    colors: ["黑灰", "月光白", "海军蓝", "奶油杏"],
    priceRange: [129, 1599],
    stockRange: [40, 400],
    titlePattern: "{brand}{series} {storage} {color}",
  },
];

const PAYMENT_CHANNELS = [
  { code: "WECHAT", label: "微信支付", weight: 45 },
  { code: "ALIPAY", label: "支付宝", weight: 35 },
  { code: "CARD", label: "银行卡", weight: 12 },
  { code: "WALLET", label: "钱包余额", weight: 8 },
];

const ORDER_STATUS_OPTIONS = [
  { code: "PAID", weight: 28 },
  { code: "SHIPPED", weight: 22 },
  { code: "COMPLETED", weight: 26 },
  { code: "REFUNDED", weight: 10 },
  { code: "PENDING_PAYMENT", weight: 8 },
  { code: "CLOSED", weight: 6 },
];

const TRAFFIC_VEHICLE_TYPES = [
  { code: "SEDAN", label: "小型客车", weight: 34 },
  { code: "SUV", label: "运动型客车", weight: 26 },
  { code: "NEW_ENERGY", label: "新能源车", weight: 18 },
  { code: "TRUCK", label: "货运车辆", weight: 12 },
  { code: "BUS", label: "营运客车", weight: 10 },
];

const TRAFFIC_VIOLATION_CODES = [
  { code: "1344", label: "违反禁令标志指示", points: 1, fineRange: [100, 200], weight: 20 },
  { code: "1625", label: "驾驶时拨打接听手持电话", points: 3, fineRange: [100, 200], weight: 16 },
  { code: "1116", label: "机动车通过有灯控路口时不按所需行进方向驶入导向车道", points: 2, fineRange: [100, 200], weight: 12 },
  { code: "1302", label: "机动车违反规定停放、临时停车", points: 0, fineRange: [50, 200], weight: 24 },
  { code: "1352", label: "遇行人正在通过人行横道时未停车让行", points: 3, fineRange: [200, 500], weight: 10 },
  { code: "1362", label: "驾驶机动车违反道路交通信号灯通行", points: 6, fineRange: [200, 500], weight: 18 },
];

const TRAFFIC_STATION_NAMES = ["延安高架检查站", "虹桥枢纽卡口", "外环高速卡点", "世纪大道执法岗", "人民路路检岗"];
const TRAFFIC_ROAD_NAMES = ["延安东路", "世纪大道", "中山北路", "人民路", "沪闵高架", "龙华东路"];
const TRAFFIC_VIOLATION_STATUS = [
  { code: "待处理", weight: 18 },
  { code: "已裁决", weight: 22 },
  { code: "已缴款", weight: 44 },
  { code: "复核中", weight: 10 },
  { code: "已撤销", weight: 6 },
];
const TRAFFIC_INSPECTION_RESULTS = [
  { code: "正常放行", weight: 72 },
  { code: "现场警示", weight: 16 },
  { code: "暂扣证件", weight: 8 },
  { code: "移交处理", weight: 4 },
];

const BANK_BRANCH_TYPES = [
  { code: "一级分行", label: "一级分行", weight: 12 },
  { code: "二级分行", label: "二级分行", weight: 24 },
  { code: "中心支行", label: "中心支行", weight: 18 },
  { code: "营业部", label: "营业部", weight: 28 },
  { code: "普惠金融中心", label: "普惠金融中心", weight: 18 },
];

const BANK_INSTITUTION_NAMES = ["中国工商银行", "中国建设银行", "中国农业银行", "中国银行", "招商银行", "交通银行"];
const BANK_REPORT_CODES = [
  { code: "1104-G01", label: "资产质量报送", weight: 28 },
  { code: "1104-G21", label: "大额风险暴露报送", weight: 16 },
  { code: "1104-G31", label: "流动性风险报送", weight: 22 },
  { code: "EAST-贷款质量", label: "EAST贷款质量核查", weight: 18 },
  { code: "AML-大额交易", label: "反洗钱大额交易报送", weight: 16 },
];

const BANK_REPORT_STATUS = [
  { code: "已提交", weight: 48 },
  { code: "已接收", weight: 26 },
  { code: "已退回", weight: 8 },
  { code: "补正中", weight: 10 },
  { code: "已归档", weight: 8 },
];

const BANK_ISSUE_TYPES = [
  { code: "数据口径不一致", label: "数据口径不一致", weight: 30 },
  { code: "报表校验失败", label: "报表校验失败", weight: 24 },
  { code: "风险指标异常波动", label: "风险指标异常波动", weight: 18 },
  { code: "大额交易说明不足", label: "大额交易说明不足", weight: 16 },
  { code: "字段缺失", label: "字段缺失", weight: 12 },
];

const BANK_ISSUE_LEVELS = [
  { code: "一般", label: "一般", weight: 52 },
  { code: "关注", label: "关注", weight: 28 },
  { code: "重要", label: "重要", weight: 14 },
  { code: "重大", label: "重大", weight: 6 },
];

const FUND_PRODUCT_TYPES = [
  { code: "EQUITY", label: "股票型基金", weight: 24 },
  { code: "BOND", label: "债券型基金", weight: 20 },
  { code: "MIXED", label: "混合型基金", weight: 22 },
  { code: "INDEX", label: "指数型基金", weight: 14 },
  { code: "MONEY_MARKET", label: "货币型基金", weight: 12 },
  { code: "QDII", label: "QDII基金", weight: 8 },
];

const FUND_RISK_LEVELS = [
  { code: "R1", label: "低风险", weight: 18 },
  { code: "R2", label: "中低风险", weight: 24 },
  { code: "R3", label: "中风险", weight: 26 },
  { code: "R4", label: "中高风险", weight: 20 },
  { code: "R5", label: "高风险", weight: 12 },
];

const FUND_INVESTOR_TYPES = [
  { code: "PERSONAL", label: "Personal Investor", weight: 82 },
  { code: "INSTITUTION", label: "Institutional Investor", weight: 18 },
];

const FUND_TRADE_CHANNELS = [
  { code: "BANK", label: "Bank", weight: 36 },
  { code: "APP", label: "Mobile App", weight: 28 },
  { code: "THIRD_PARTY", label: "Third Party Platform", weight: 22 },
  { code: "DIRECT", label: "Direct Sales", weight: 14 },
];

const FUND_ORDER_STATUS = [
  { code: "ACCEPTED", label: "Accepted", weight: 18 },
  { code: "CONFIRMED", label: "Confirmed", weight: 44 },
  { code: "SETTLED", label: "Settled", weight: 24 },
  { code: "FAILED", label: "Failed", weight: 6 },
  { code: "CANCELLED", label: "Cancelled", weight: 8 },
];

const FUND_COMPANY_NAMES = ["华夏基金", "易方达基金", "华夏基金管理", "广发基金", "嘉实基金", "博时基金"];

const LOGISTICS_EXPRESS_COMPANIES = [
  { code: "SF", label: "顺丰速运", weight: 28 },
  { code: "JD", label: "京东物流", weight: 20 },
  { code: "ZTO", label: "中通快递", weight: 16 },
  { code: "YTO", label: "圆通速递", weight: 14 },
  { code: "STO", label: "申通快递", weight: 12 },
  { code: "YUNDA", label: "韵达速递", weight: 10 },
];

const LOGISTICS_TRANSPORT_MODES = [
  { code: "GROUND", label: "陆运", weight: 52 },
  { code: "AIR", label: "空运", weight: 18 },
  { code: "RAIL", label: "铁路", weight: 10 },
  { code: "SAME_CITY", label: "同城配送", weight: 12 },
  { code: "COLD_CHAIN", label: "冷链运输", weight: 8 },
];

const LOGISTICS_WAYBILL_STATUS = [
  { code: "CREATED", label: "Created", weight: 12 },
  { code: "COLLECTED", label: "Collected", weight: 18 },
  { code: "IN_TRANSIT", label: "In Transit", weight: 32 },
  { code: "OUT_FOR_DELIVERY", label: "Out For Delivery", weight: 16 },
  { code: "SIGNED", label: "Signed", weight: 18 },
  { code: "EXCEPTION", label: "Exception", weight: 4 },
];

const LOGISTICS_EXCEPTION_TYPES = [
  { code: "DELAY", label: "Delay", weight: 34 },
  { code: "ADDRESS_ERROR", label: "Address Error", weight: 20 },
  { code: "PACKAGE_DAMAGE", label: "Package Damage", weight: 16 },
  { code: "CUSTOMER_REJECT", label: "Customer Reject", weight: 14 },
  { code: "LOST", label: "Lost", weight: 8 },
  { code: "OTHER", label: "Other", weight: 8 },
];

const ECOMMERCE_MEMBER_LEVELS = [
  { code: "普通会员", label: "普通会员", weight: 42 },
  { code: "银卡会员", label: "银卡会员", weight: 24 },
  { code: "金卡会员", label: "金卡会员", weight: 18 },
  { code: "黑金会员", label: "黑金会员", weight: 10 },
  { code: "企业客户", label: "企业客户", weight: 6 },
];

const ECOMMERCE_REGISTER_CHANNELS = [
  { code: "APP", label: "APP", weight: 38 },
  { code: "小程序", label: "小程序", weight: 28 },
  { code: "H5", label: "H5", weight: 18 },
  { code: "门店导购", label: "门店导购", weight: 10 },
  { code: "企业采购", label: "企业采购", weight: 6 },
];

const ECOMMERCE_RISK_LEVELS = [
  { code: "低风险", label: "低风险", weight: 78 },
  { code: "中风险", label: "中风险", weight: 17 },
  { code: "高风险", label: "高风险", weight: 5 },
];

const ECOMMERCE_STORE_TYPES = [
  { code: "中心仓", label: "中心仓", weight: 18 },
  { code: "城市仓", label: "城市仓", weight: 26 },
  { code: "前置仓", label: "前置仓", weight: 24 },
  { code: "品牌旗舰店", label: "品牌旗舰店", weight: 20 },
  { code: "直营网店", label: "直营网店", weight: 12 },
];

const ECOMMERCE_PRODUCT_TYPES = [
  { code: "标品", label: "标品", weight: 52 },
  { code: "套装", label: "套装", weight: 16 },
  { code: "配件", label: "配件", weight: 14 },
  { code: "礼盒", label: "礼盒", weight: 10 },
  { code: "服务商品", label: "服务商品", weight: 8 },
];

const ECOMMERCE_SHELF_STATUS = [
  { code: "在售", label: "在售", weight: 74 },
  { code: "预售", label: "预售", weight: 10 },
  { code: "暂时缺货", label: "暂时缺货", weight: 9 },
  { code: "停售", label: "停售", weight: 7 },
];

const ECOMMERCE_ORDER_CHANNELS = [
  { code: "APP", label: "APP", weight: 34 },
  { code: "小程序", label: "小程序", weight: 30 },
  { code: "H5", label: "H5", weight: 14 },
  { code: "门店POS", label: "门店POS", weight: 12 },
  { code: "企业商城", label: "企业商城", weight: 10 },
];

const ECOMMERCE_ORDER_SOURCES = [
  { code: "搜索", label: "搜索", weight: 26 },
  { code: "推荐", label: "推荐", weight: 22 },
  { code: "活动会场", label: "活动会场", weight: 18 },
  { code: "直播间", label: "直播间", weight: 14 },
  { code: "购物车", label: "购物车", weight: 12 },
  { code: "企业采购", label: "企业采购", weight: 8 },
];

const ECOMMERCE_PAYMENT_STATUS = [
  { code: "支付成功", label: "支付成功", weight: 78 },
  { code: "待支付", label: "待支付", weight: 10 },
  { code: "支付失败", label: "支付失败", weight: 5 },
  { code: "已关闭", label: "已关闭", weight: 4 },
  { code: "已退款", label: "已退款", weight: 3 },
];

const ECOMMERCE_DELIVERY_STATUS = [
  { code: "待出库", label: "待出库", weight: 18 },
  { code: "已出库", label: "已出库", weight: 20 },
  { code: "运输中", label: "运输中", weight: 26 },
  { code: "已签收", label: "已签收", weight: 28 },
  { code: "配送异常", label: "配送异常", weight: 8 },
];

const ECOMMERCE_INVOICE_STATUS = [
  { code: "无需开票", label: "无需开票", weight: 48 },
  { code: "待开票", label: "待开票", weight: 18 },
  { code: "已开票", label: "已开票", weight: 28 },
  { code: "已作废", label: "已作废", weight: 6 },
];

const ECOMMERCE_REFUND_REASONS = [
  { code: "七天无理由", label: "七天无理由", weight: 26 },
  { code: "商品与描述不符", label: "商品与描述不符", weight: 20 },
  { code: "物流破损", label: "物流破损", weight: 14 },
  { code: "重复下单", label: "重复下单", weight: 12 },
  { code: "质量问题", label: "质量问题", weight: 18 },
  { code: "发票需求变更", label: "发票需求变更", weight: 10 },
];

const ECOMMERCE_REFUND_STATUS = [
  { code: "待审核", label: "待审核", weight: 20 },
  { code: "退款中", label: "退款中", weight: 22 },
  { code: "退款成功", label: "退款成功", weight: 48 },
  { code: "退款关闭", label: "退款关闭", weight: 10 },
];

const ECOMMERCE_COURIERS = [
  { code: "顺丰速运", label: "顺丰速运", weight: 28 },
  { code: "京东物流", label: "京东物流", weight: 24 },
  { code: "中通快递", label: "中通快递", weight: 18 },
  { code: "圆通速递", label: "圆通速递", weight: 16 },
  { code: "菜鸟速递", label: "菜鸟速递", weight: 14 },
];

const ECOMMERCE_DELIVERY_MODES = [
  { code: "快递配送", label: "快递配送", weight: 62 },
  { code: "同城即时达", label: "同城即时达", weight: 18 },
  { code: "门店自提", label: "门店自提", weight: 12 },
  { code: "大件送装", label: "大件送装", weight: 8 },
];

const TRAFFIC_FUEL_TYPES = [
  { code: "汽油", label: "汽油", weight: 46 },
  { code: "柴油", label: "柴油", weight: 18 },
  { code: "混动", label: "混动", weight: 16 },
  { code: "纯电", label: "纯电", weight: 20 },
];

const TRAFFIC_INSURANCE_STATUS = [
  { code: "有效", label: "有效", weight: 88 },
  { code: "临近到期", label: "临近到期", weight: 8 },
  { code: "已过期", label: "已过期", weight: 4 },
];

const TRAFFIC_OPERATION_TYPES = [
  { code: "非营运", label: "非营运", weight: 74 },
  { code: "网约营运", label: "网约营运", weight: 12 },
  { code: "货运营运", label: "货运营运", weight: 9 },
  { code: "客运营运", label: "客运营运", weight: 5 },
];

const TRAFFIC_PAYMENT_CHANNELS = [
  { code: "支付宝", label: "支付宝", weight: 40 },
  { code: "微信支付", label: "微信支付", weight: 34 },
  { code: "银联柜面", label: "银联柜面", weight: 16 },
  { code: "交管12123", label: "交管12123", weight: 10 },
];

const TRAFFIC_PAYMENT_STATUS = [
  { code: "缴款成功", label: "缴款成功", weight: 72 },
  { code: "待缴款", label: "待缴款", weight: 18 },
  { code: "缴款失败", label: "缴款失败", weight: 4 },
  { code: "已冲正", label: "已冲正", weight: 6 },
];

const TRAFFIC_ACCIDENT_LEVELS = [
  { code: "轻微事故", label: "轻微事故", weight: 48 },
  { code: "一般事故", label: "一般事故", weight: 34 },
  { code: "较大事故", label: "较大事故", weight: 14 },
  { code: "重大事故", label: "重大事故", weight: 4 },
];

const TRAFFIC_CASE_STATUS = [
  { code: "处理中", label: "处理中", weight: 38 },
  { code: "待认定", label: "待认定", weight: 14 },
  { code: "已结案", label: "已结案", weight: 42 },
  { code: "已移交", label: "已移交", weight: 6 },
];

const TRAFFIC_SOURCE_CHANNELS = [
  { code: "110报警", label: "110报警", weight: 22 },
  { code: "视频巡查", label: "视频巡查", weight: 20 },
  { code: "卡口预警", label: "卡口预警", weight: 16 },
  { code: "现场发现", label: "现场发现", weight: 24 },
  { code: "群众举报", label: "群众举报", weight: 18 },
];

const TRAFFIC_DOCUMENT_TYPES = [
  { code: "违法处理通知书", label: "违法处理通知书", weight: 44 },
  { code: "现场处罚决定书", label: "现场处罚决定书", weight: 24 },
  { code: "强制措施凭证", label: "强制措施凭证", weight: 18 },
  { code: "事故认定书", label: "事故认定书", weight: 14 },
];

const BANK_INSTITUTION_TYPES = [
  { code: "国有大型银行", label: "国有大型银行", weight: 22 },
  { code: "股份制商业银行", label: "股份制商业银行", weight: 30 },
  { code: "城市商业银行", label: "城市商业银行", weight: 22 },
  { code: "农村商业银行", label: "农村商业银行", weight: 18 },
  { code: "民营银行", label: "民营银行", weight: 8 },
];

const BANK_REPORT_FREQUENCY = [
  { code: "月报", label: "月报", weight: 26 },
  { code: "季报", label: "季报", weight: 34 },
  { code: "半年报", label: "半年报", weight: 14 },
  { code: "年报", label: "年报", weight: 10 },
  { code: "日报", label: "日报", weight: 16 },
];

const BANK_DISPOSAL_STATUS = [
  { code: "待整改", label: "待整改", weight: 18 },
  { code: "整改中", label: "整改中", weight: 34 },
  { code: "已关闭", label: "已关闭", weight: 42 },
  { code: "升级处理", label: "升级处理", weight: 6 },
];

const BANK_TASK_STATUS = [
  { code: "待执行", label: "待执行", weight: 18 },
  { code: "整改中", label: "整改中", weight: 40 },
  { code: "已完成", label: "已完成", weight: 38 },
  { code: "已延期", label: "已延期", weight: 4 },
];

const BANK_ALERT_STATUS = [
  { code: "待核查", label: "待核查", weight: 22 },
  { code: "核查中", label: "核查中", weight: 26 },
  { code: "已排除", label: "已排除", weight: 34 },
  { code: "已上报", label: "已上报", weight: 18 },
];

const BANK_REVIEW_RESULTS = [
  { code: "正常", label: "正常", weight: 66 },
  { code: "可疑", label: "可疑", weight: 16 },
  { code: "需补充说明", label: "需补充说明", weight: 18 },
];

const BANK_SUBMIT_CHANNELS = [
  { code: "监管专网", label: "监管专网", weight: 54 },
  { code: "报送平台", label: "报送平台", weight: 30 },
  { code: "邮件补正", label: "邮件补正", weight: 10 },
  { code: "专线传输", label: "专线传输", weight: 6 },
];

const BANK_APPROVAL_RESULTS = [
  { code: "通过", label: "通过", weight: 68 },
  { code: "退回", label: "退回", weight: 18 },
  { code: "补充材料", label: "补充材料", weight: 14 },
];

const MAINLAND_MOBILE_PREFIXES = ["130", "131", "132", "133", "135", "136", "137", "138", "139", "150", "151", "152", "155", "156", "157", "158", "159", "180", "181", "182", "183", "185", "186", "187", "188", "189"];
const MAINLAND_CONSERVATIVE_MOBILE_PREFIXES = MAINLAND_MOBILE_PREFIXES;

const EDUCATION_SCHOOL_TYPES = [
  { code: "PUBLIC_PRIMARY", label: "Public Primary School", weight: 22 },
  { code: "PUBLIC_JUNIOR", label: "Public Junior High School", weight: 20 },
  { code: "PUBLIC_HIGH", label: "Public High School", weight: 16 },
  { code: "PRIVATE_K12", label: "Private K12 School", weight: 12 },
  { code: "VOCATIONAL_COLLEGE", label: "Vocational College", weight: 10 },
  { code: "PUBLIC_UNIVERSITY", label: "Public University", weight: 20 },
];

const EDUCATION_STAGES = [
  { code: "PRIMARY", label: "Primary", weight: 22 },
  { code: "JUNIOR", label: "Junior High", weight: 18 },
  { code: "HIGH", label: "Senior High", weight: 16 },
  { code: "VOCATIONAL", label: "Vocational", weight: 12 },
  { code: "UNDERGRAD", label: "Undergraduate", weight: 24 },
  { code: "POSTGRAD", label: "Postgraduate", weight: 8 },
];

const EDUCATION_GRADE_CODES = [
  { code: "P1", label: "Primary Year 1", weight: 10 },
  { code: "P2", label: "Primary Year 2", weight: 10 },
  { code: "P3", label: "Primary Year 3", weight: 10 },
  { code: "P4", label: "Primary Year 4", weight: 10 },
  { code: "P5", label: "Primary Year 5", weight: 10 },
  { code: "P6", label: "Primary Year 6", weight: 10 },
  { code: "J1", label: "Junior Year 1", weight: 8 },
  { code: "J2", label: "Junior Year 2", weight: 8 },
  { code: "J3", label: "Junior Year 3", weight: 8 },
  { code: "H1", label: "High Year 1", weight: 7 },
  { code: "H2", label: "High Year 2", weight: 7 },
  { code: "H3", label: "High Year 3", weight: 7 },
  { code: "UG1", label: "Undergraduate Year 1", weight: 6 },
  { code: "UG2", label: "Undergraduate Year 2", weight: 6 },
  { code: "UG3", label: "Undergraduate Year 3", weight: 6 },
  { code: "UG4", label: "Undergraduate Year 4", weight: 6 },
  { code: "PG1", label: "Postgraduate Year 1", weight: 3 },
  { code: "PG2", label: "Postgraduate Year 2", weight: 3 },
];

const EDUCATION_TERM_CODES = [
  { code: "2025_FALL", label: "2025 Fall", weight: 24 },
  { code: "2026_SPRING", label: "2026 Spring", weight: 28 },
  { code: "2026_SUMMER", label: "2026 Summer", weight: 10 },
  { code: "2026_FALL", label: "2026 Fall", weight: 38 },
];

const EDUCATION_SUBJECTS = [
  { code: "CHINESE", label: "Chinese", weight: 14 },
  { code: "MATH", label: "Mathematics", weight: 14 },
  { code: "ENGLISH", label: "English", weight: 13 },
  { code: "PHYSICS", label: "Physics", weight: 8 },
  { code: "CHEMISTRY", label: "Chemistry", weight: 6 },
  { code: "BIOLOGY", label: "Biology", weight: 6 },
  { code: "HISTORY", label: "History", weight: 5 },
  { code: "GEOGRAPHY", label: "Geography", weight: 5 },
  { code: "POLITICS", label: "Politics", weight: 5 },
  { code: "COMPUTER", label: "Computer Science", weight: 8 },
  { code: "PE", label: "Physical Education", weight: 8 },
  { code: "ART", label: "Arts", weight: 4 },
  { code: "MUSIC", label: "Music", weight: 4 },
];

const EDUCATION_STAFF_ROLES = [
  { code: "HEADMASTER", label: "Headmaster", weight: 4 },
  { code: "TEACHER", label: "Teacher", weight: 48 },
  { code: "COUNSELOR", label: "Counselor", weight: 8 },
  { code: "ACADEMIC_AFFAIRS", label: "Academic Affairs", weight: 10 },
  { code: "FINANCE", label: "Finance", weight: 8 },
  { code: "LIBRARIAN", label: "Librarian", weight: 6 },
  { code: "SECURITY", label: "Security Officer", weight: 6 },
  { code: "LOGISTICS", label: "Logistics", weight: 10 },
];

const EDUCATION_BILL_STATUS = [
  { code: "PENDING", label: "Pending", weight: 20 },
  { code: "PARTIAL", label: "Partial", weight: 12 },
  { code: "PAID", label: "Paid", weight: 56 },
  { code: "OVERDUE", label: "Overdue", weight: 8 },
  { code: "REFUNDED", label: "Refunded", weight: 4 },
];

const EDUCATION_ACCESS_RESULTS = [
  { code: "PASS", label: "Pass", weight: 84 },
  { code: "LATE", label: "Late", weight: 8 },
  { code: "DENY", label: "Denied", weight: 3 },
  { code: "MANUAL_RELEASE", label: "Manual Release", weight: 5 },
];

const EDUCATION_BORROW_STATUS = [
  { code: "BORROWING", label: "Borrowing", weight: 20 },
  { code: "RETURNED", label: "Returned", weight: 68 },
  { code: "OVERDUE", label: "Overdue", weight: 12 },
];

const EDUCATION_SUBTYPE_OVERRIDES = {
  student_lifecycle: {
    focusModules: ["student_profile", "guardian_contact", "student_enrollment"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 24, PUBLIC_JUNIOR: 22, PUBLIC_HIGH: 16, PRIVATE_K12: 14, VOCATIONAL_COLLEGE: 8, PUBLIC_UNIVERSITY: 16 },
    subjectWeights: { CHINESE: 16, MATH: 16, ENGLISH: 15, PE: 8 },
  },
  staff_hr: {
    focusModules: ["staff_profile", "class_schedule", "course_catalog"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 18, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 18, PRIVATE_K12: 12, VOCATIONAL_COLLEGE: 10, PUBLIC_UNIVERSITY: 24 },
    staffRoleWeights: { HEADMASTER: 4, TEACHER: 52, COUNSELOR: 10, ACADEMIC_AFFAIRS: 12, FINANCE: 6, LIBRARIAN: 4, SECURITY: 4, LOGISTICS: 8 },
  },
  tuition_billing: {
    focusModules: ["student_enrollment", "tuition_bill"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 20, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 16, PRIVATE_K12: 18, VOCATIONAL_COLLEGE: 12, PUBLIC_UNIVERSITY: 16 },
    billStatusWeights: { PENDING: 18, PARTIAL: 14, PAID: 54, OVERDUE: 10, REFUNDED: 4 },
  },
  class_scheduling: {
    focusModules: ["course_catalog", "class_schedule", "staff_profile"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 18, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 20, PRIVATE_K12: 12, VOCATIONAL_COLLEGE: 12, PUBLIC_UNIVERSITY: 20 },
    subjectWeights: { CHINESE: 14, MATH: 14, ENGLISH: 14, PHYSICS: 8, CHEMISTRY: 7, BIOLOGY: 7, COMPUTER: 10, PE: 8, ART: 6, MUSIC: 6 },
  },
  parent_school: {
    focusModules: ["student_profile", "guardian_contact", "campus_access_log"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 28, PUBLIC_JUNIOR: 24, PUBLIC_HIGH: 14, PRIVATE_K12: 16, VOCATIONAL_COLLEGE: 6, PUBLIC_UNIVERSITY: 12 },
  },
  campus_security: {
    focusModules: ["campus_dimension", "campus_access_log", "staff_profile"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 22, PUBLIC_JUNIOR: 20, PUBLIC_HIGH: 16, PRIVATE_K12: 14, VOCATIONAL_COLLEGE: 8, PUBLIC_UNIVERSITY: 20 },
    accessResultWeights: { PASS: 80, LATE: 10, DENY: 4, MANUAL_RELEASE: 6 },
  },
  library_service: {
    focusModules: ["student_profile", "library_borrow_record", "course_catalog"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 16, PUBLIC_JUNIOR: 16, PUBLIC_HIGH: 18, PRIVATE_K12: 10, VOCATIONAL_COLLEGE: 12, PUBLIC_UNIVERSITY: 28 },
    borrowStatusWeights: { BORROWING: 18, RETURNED: 68, OVERDUE: 14 },
  },
  general: {
    focusModules: ["student_profile", "staff_profile", "class_schedule", "tuition_bill", "campus_access_log", "library_borrow_record"],
    schoolTypeWeights: { PUBLIC_PRIMARY: 20, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 16, PRIVATE_K12: 12, VOCATIONAL_COLLEGE: 10, PUBLIC_UNIVERSITY: 24 },
  },
};

const ECOMMERCE_SUBTYPE_OVERRIDES = {
  electronics: {
    preferredCategories: ["ELECTRONIC", "HOME"],
    categoryWeights: { ELECTRONIC: 58, HOME: 22, FOOD: 8, APPAREL: 12 },
  },
  food: {
    preferredCategories: ["FOOD", "APPAREL"],
    categoryWeights: { FOOD: 56, APPAREL: 18, ELECTRONIC: 14, HOME: 12 },
  },
  apparel: {
    preferredCategories: ["APPAREL", "ELECTRONIC"],
    categoryWeights: { APPAREL: 54, ELECTRONIC: 20, HOME: 10, FOOD: 16 },
  },
  home: {
    preferredCategories: ["HOME", "ELECTRONIC"],
    categoryWeights: { HOME: 52, ELECTRONIC: 26, FOOD: 8, APPAREL: 14 },
  },
  general: {
    preferredCategories: ["ELECTRONIC", "HOME", "FOOD", "APPAREL"],
    categoryWeights: { ELECTRONIC: 34, HOME: 26, FOOD: 20, APPAREL: 20 },
  },
};

const SCENARIO_DEFINITIONS = [
  {
    industry: "education",
    subScenario: "student_lifecycle",
    keywords: [
      { pattern: /\beducation\b|\bschool\b|\bstudent\b|\bteacher\b|\bcampus\b|\bclass\b|\bcurriculum\b|\btuition\b|\blibrary\b|\bguardian\b/, weight: 6 },
      { pattern: /教育|学校|学生|教师|校园|班级|课程|学籍|学费|图书馆|家校|门禁/, weight: 6 },
    ],
  },
  {
    industry: "ecommerce",
    subScenario: "retail-commerce",
    keywords: [
      { pattern: /\becommerce\b|\bonline retail\b|\bproduct\b|\border\b|\bpayment\b|\brefund\b|\bsku\b|\bcart\b/, weight: 6 },
      { pattern: /\bretail\b|\bmerchant\b|\bgmv\b|\buv\b|\bconversion\b|\banchor\b|\bsession\b/, weight: 6 },
      { pattern: /电商|订单|支付|退款|商品|商城|购物车|售后|sku|商家/, weight: 6 },
    ],
  },
  {
    industry: "crm",
    subScenario: "sales-crm",
    keywords: [
      { pattern: /\bcrm\b|\blead\b|\bopportunity\b|\bsales\b|\bcustomer\b/, weight: 5 },
      { pattern: /客户|线索|商机|销售|跟进/, weight: 5 },
    ],
  },
  {
    industry: "marriage",
    subScenario: "civil-registration",
    keywords: [
      { pattern: /\bmarriage\b|\bappointment\b|\bregistration\b/, weight: 5 },
      { pattern: /婚姻|登记|预约|民政/, weight: 5 },
    ],
  },
  {
    industry: "traffic",
    subScenario: "urban-traffic-control",
    keywords: [
      { pattern: /\btraffic\b|\bvehicle\b|\bviolation\b|\bcheckpoint\b|\broad\b|\bintersection\b/, weight: 6 },
      { pattern: /交通|车辆|违法|卡口|路口|高架|违章|交警|检查站/, weight: 6 },
    ],
  },
  {
    industry: "bank_regulatory",
    subScenario: "prudential-reporting",
    keywords: [
      { pattern: /\bbank\b|\bregulatory\b|\breport\b|\bprudential\b|\baml\b|\brisk\b/, weight: 6 },
      { pattern: /银行|监管|报送|报表|审慎|反洗钱|风险暴露|资产质量/, weight: 6 },
    ],
  },
];

SCENARIO_DEFINITIONS.push(
  {
    industry: "finance_fund",
    subScenario: "fund-operations",
    keywords: [
      { pattern: /\bfund\b|\bnav\b|\bsubscription\b|\bredemption\b|\basset management\b|\bportfolio\b/, weight: 6 },
      { pattern: /\bwealth\b|\binvestor\b|\bholding\b|\btransfer agent\b/, weight: 5 },
      { pattern: /鍩洪噾|鍑€鍊?|鐢宠喘|璧庡洖|鎶曡祫浜?|鎸佷粨|鍩洪噾鍏徃|浜ゆ槗纭/, weight: 6 },
    ],
  },
  {
    industry: "logistics_express",
    subScenario: "express-fulfillment",
    keywords: [
      { pattern: /\blogistics\b|\bexpress\b|\bwaybill\b|\bparcel\b|\bdelivery\b|\btransfer\b|\bsort\b/, weight: 6 },
      { pattern: /\bcourier\b|\bsign\b|\bwarehouse\b|\blast mile\b/, weight: 5 },
      { pattern: /蹇€?|鐗╂祦|杩愬崟|鍖呰９|閰嶉€?|涓浆|鍒嗘嫧|绛炬敹|蹇€掑憳/, weight: 6 },
    ],
  }
);

function fallbackRecognizeIndustry(input) {
  const haystack = `${input.sceneName || ""} ${input.sceneDesc || ""} ${input.knowledgeText || ""}`;
  if (/\becommerce\b|\bonline retail\b|\bretail\b|\bmerchant\b|\bgmv\b|\buv\b|\bconversion\b|\banchor\b|\bsession\b|鐢靛晢|闆跺敭|鍟嗗|鎴愪氦棰?|璁块棶閲?|杞寲|涓绘挱|鍦烘/.test(haystack)) {
    return { industry: "ecommerce", subScenario: "retail-commerce" };
  }
  if (/\btraffic\b|\bvehicle\b|\bcheckpoint\b|\bviolation\b|交通|车辆|车主|驾驶人|违章|违法|卡口|过车|驾照|学车|事故/.test(haystack)) {
    return { industry: "traffic", subScenario: "urban-traffic-control" };
  }
  if (/\bbank\b|\bregulatory\b|\breport\b|\bloan\b|\baccount\b|银行|监管|报送|报表|贷款|账户|整改|反洗钱/.test(haystack)) {
    return { industry: "bank_regulatory", subScenario: "prudential-reporting" };
  }
  if (/\becommerce\b|\border\b|\bpayment\b|\brefund\b|\blive stream\b|电商|零售|订单|支付|退款|直播|采购|商品/.test(haystack)) {
    return { industry: "ecommerce", subScenario: "retail-commerce" };
  }
  if (/\beducation\b|\bschool\b|\bstudent\b|\bteacher\b|\bdormitory\b|教育|学校|学生|教师|学籍|收费|宿舍|家校|图书/.test(haystack)) {
    return { industry: "education", subScenario: "student_lifecycle" };
  }
  return null;
}

function fallbackRecognizeIndustryV2(input) {
  const haystack = `${input.sceneName || ""} ${input.sceneDesc || ""} ${input.knowledgeText || ""}`;
  if (/finance_fund|fund[-_ ]operations|fund product|subscription|redemption|基金|净值|申购|赎回|投资人|持仓/.test(haystack)) {
    return { industry: "finance_fund", subScenario: "fund-operations" };
  }
  if (/logistics_express|express[-_ ]fulfillment|waybill|courier|parcel|delivery|快递|物流|运单|包裹|配送|中转|分拨|签收/.test(haystack)) {
    return { industry: "logistics_express", subScenario: "express-fulfillment" };
  }
  if (/\becommerce\b|\bonline retail\b|\bretail\b|\bmerchant\b|\bgmv\b|\buv\b|\bconversion\b|\banchor\b|\bsession\b|电商|零售|商家|成交额|访问量|转化|主播|场次/.test(haystack)) {
    return { industry: "ecommerce", subScenario: "retail-commerce" };
  }
  if (/\bfund\b|\bnav\b|\bsubscription\b|\bredemption\b|\basset management\b|\bportfolio\b|\binvestor\b|\bholding\b|基金|净值|申购|赎回|投资人|持仓|基金公司|交易确认/.test(haystack)) {
    return { industry: "finance_fund", subScenario: "fund-operations" };
  }
  if (/\blogistics\b|\bexpress\b|\bwaybill\b|\bparcel\b|\bdelivery\b|\btransfer\b|\bsort\b|\bcourier\b|\bsign\b|\bwarehouse\b|快递|物流|运单|包裹|配送|中转|分拨|签收|快递员/.test(haystack)) {
    return { industry: "logistics_express", subScenario: "express-fulfillment" };
  }
  if (/\btraffic\b|\bvehicle\b|\bcheckpoint\b|\bviolation\b|交通|车辆|车主|驾驶人|违章|违法|卡口|过车|驾照|学车|事故/.test(haystack)) {
    return { industry: "traffic", subScenario: "urban-traffic-control" };
  }
  if (/\bbank\b|\bregulatory\b|\breport\b|\bloan\b|\baccount\b|银行|监管|报送|报表|贷款|账户|整改|反洗钱/.test(haystack)) {
    return { industry: "bank_regulatory", subScenario: "prudential-reporting" };
  }
  if (/\beducation\b|\bschool\b|\bstudent\b|\bteacher\b|\bdormitory\b|教育|学校|学生|教师|学籍|收费|宿舍|家校|图书/.test(haystack)) {
    return { industry: "education", subScenario: "student_lifecycle" };
  }
  return null;
}

function recognizeScenarioByManagedProfiles(input, managedProfiles = []) {
  const haystack = normalizeText(`${input.sceneName || ""} ${input.sceneDesc || ""} ${input.knowledgeText || ""}`);
  const candidates = (managedProfiles || [])
    .filter((item) => item && item.status === "active" && item.recognition && typeof item.recognition === "object")
    .map((item) => {
      const recognition = item.recognition || {};
      const keywords = Array.isArray(recognition.keywords) ? recognition.keywords : [];
      const aliases = Array.isArray(recognition.aliases) ? recognition.aliases : [];
      const negativeKeywords = Array.isArray(recognition.negativeKeywords) ? recognition.negativeKeywords : [];
      const subScenarios = Array.isArray(recognition.subScenarios) ? recognition.subScenarios : [];
      const allPositive = [...keywords, ...aliases];
      const matchedPositive = allPositive.filter((token) => token && haystack.includes(normalizeText(token)));
      const matchedNegative = negativeKeywords.filter((token) => token && haystack.includes(normalizeText(token)));
      const score = matchedPositive.length * 3 - matchedNegative.length * 4;
      return {
        industry: item.industry,
        subScenario: item.subScenario || subScenarios[0] || recognition.defaultSubScenario || "generic",
        score,
        signals: matchedPositive.slice(0, 12).map((token) => `managed:${token}`),
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    return null;
  }

  const winner = candidates[0];
  const runnerUp = candidates[1];
  const confidence = Math.min(0.99, Math.max(0.4, winner.score / Math.max(1, winner.score + (runnerUp?.score || 0))));
  return {
    industry: winner.industry,
    subScenario: winner.subScenario,
    confidence,
    signals: winner.signals,
  };
}

function recognizeScenario(input) {
  const managedRecognition = recognizeScenarioByManagedProfiles(input, input.managedProfiles || []);
  if (managedRecognition) {
    return managedRecognition;
  }
  const sceneName = normalizeText(input.sceneName);
  const sceneDesc = normalizeText(input.sceneDesc);
  const knowledgeText = normalizeText(input.knowledgeText);
  const candidates = SCENARIO_DEFINITIONS.map((definition) => {
    let score = 0;
    const signals = [];
    for (const keyword of definition.keywords) {
      if (keyword.pattern.test(sceneName)) {
        score += keyword.weight * 3;
        signals.push(`scene:${keyword.pattern}`);
      }
      if (keyword.pattern.test(sceneDesc)) {
        score += keyword.weight * 2;
        signals.push(`desc:${keyword.pattern}`);
      }
      if (keyword.pattern.test(knowledgeText)) {
        score += keyword.weight;
        signals.push(`kb:${keyword.pattern}`);
      }
    }
    return { ...definition, score, signals };
  });

  candidates.sort((left, right) => right.score - left.score);
  const winner = candidates[0];
  const runnerUp = candidates[1];

  if (!winner || winner.score <= 0) {
    const fallback = fallbackRecognizeIndustryV2(input);
    if (fallback) {
      return {
        industry: fallback.industry,
        subScenario: fallback.subScenario,
        confidence: 0.45,
        signals: ["fallback:industry-keywords"],
      };
    }
    return {
      industry: "generic",
      subScenario: "generic",
      confidence: 0.2,
      signals: [],
    };
  }

  const confidence = Math.min(0.98, Math.max(0.35, winner.score / Math.max(1, winner.score + (runnerUp?.score || 0))));
  return {
    industry: winner.industry,
    subScenario: winner.subScenario,
    confidence,
    signals: winner.signals.slice(0, 12),
  };
}

function detectEcommerceSubtype(input) {
  const haystack = normalizeText(`${input.sceneName} ${input.sceneDesc} ${input.knowledgeText}`);
  if (/手机|数码|3c|iphone|mate|xiaomi/.test(haystack)) return "electronics";
  if (/零食|食品|酒水|饮料|坚果|乳饮/.test(haystack)) return "food";
  if (/服饰|鞋|包|羽绒服|跑步鞋|卫衣/.test(haystack)) return "apparel";
  if (/家电|空调|冰箱|洗衣机|净化器|扫地/.test(haystack)) return "home";
  return "general";
}

function detectEducationSubtype(input) {
  const haystack = normalizeText(`${input.sceneName} ${input.sceneDesc} ${input.knowledgeText}`);
  if (/\bteacher\b|\bstaff\b|\bhr\b|\bpersonnel\b|教师|教职工|人事/.test(haystack)) return "staff_hr";
  if (/\btuition\b|\bbilling\b|\bfee\b|\bpayment\b|学费|收费|缴费|账单/.test(haystack)) return "tuition_billing";
  if (/\bclass\b|\bschedule\b|\bcourse\b|\bcurriculum\b|排课|课程|教务|课表/.test(haystack)) return "class_scheduling";
  if (/\bguardian\b|\bparent\b|\bhome-school\b|\bmessage\b|家长|家校|联系人/.test(haystack)) return "parent_school";
  if (/\baccess\b|\bsecurity\b|\bgate\b|\bcampus card\b|门禁|安防|出入/.test(haystack)) return "campus_security";
  if (/\blibrary\b|\bborrow\b|\bbook\b|图书|借阅/.test(haystack)) return "library_service";
  return "student_lifecycle";
}

const INDUSTRY_DYNAMIC_MODULE_KEYWORDS = {
  bank_regulatory: [
    { moduleKey: "customer_account", pattern: /\baccount\b|\bdeposit\b|\bledger\b|账户|存款|台账|流水/ },
    { moduleKey: "loan_contract", pattern: /\bloan\b|\bcredit\b|\bcontract\b|贷款|授信|借据|合同/ },
  ],
  traffic: [
    { moduleKey: "driver_training", pattern: /\bdriver training\b|\blicense learning\b|\bdriving school\b|\blearning record\b|驾照学习|驾驶学习|驾驶培训|学车|驾考|科目一|科目二|科目三|科目四/ },
    { moduleKey: "checkpoint_vehicle_pass", pattern: /\bcheckpoint pass\b|\bvehicle pass\b|\bpass record\b|\bgantry\b|\bcheckpoint vehicle\b|卡口过车|过车记录|卡口通行|车辆过车|车辆通行|卡口抓拍/ },
  ],
  ecommerce: [
    { moduleKey: "live_stream", pattern: /\blive stream\b|\blivestream\b|\binfluencer\b|\bstreaming\b|直播带货|直播零售|主播|直播间/ },
    { moduleKey: "enterprise_procurement", pattern: /\benterprise procurement\b|\bb2b\b|\bbulk order\b|\bwholesale\b|企业采购|大宗采购|批发订单|团购采购/ },
  ],
  education: [
    { moduleKey: "parent_communication", pattern: /\bparent communication\b|\bhome-school\b|\bmessage\b|\bnotice\b|家校互通|家校沟通|家长通知|班级通知/ },
    { moduleKey: "dormitory_management", pattern: /\bdormitory\b|\bbed\b|\bresidence\b|\bboarding\b|宿舍|住宿|床位|住校/ },
  ],
};

const INDUSTRY_DYNAMIC_MODULE_HINTS = {
  bank_regulatory: {
    customer_account: {
      hints: ["customer_account", "customer account", "account ledger", "deposit account", "账户", "账户台账", "账户流水", "存款账户"],
      keywords: ["account", "ledger", "deposit", "账户", "台账", "流水", "存款"],
      minHits: 2,
    },
    loan_contract: {
      hints: ["loan_contract", "loan contract", "credit contract", "贷款合同", "授信合同", "借据合同"],
      keywords: ["loan", "credit", "contract", "贷款", "授信", "合同", "借据"],
      minHits: 2,
    },
  },
  traffic: {
    driver_training: {
      hints: ["driver_training", "driver training", "license learning", "driving school", "驾照学习", "驾驶培训", "驾驶学习", "学车", "驾考"],
      keywords: ["driver", "training", "license", "school", "learn", "驾照", "驾驶", "培训", "学车", "驾考", "科目"],
      minHits: 2,
    },
    checkpoint_vehicle_pass: {
      hints: ["checkpoint_vehicle_pass", "checkpoint pass", "vehicle pass", "gantry pass", "卡口过车", "过车记录", "卡口通行", "卡口抓拍"],
      keywords: ["checkpoint", "pass", "gantry", "vehicle", "卡口", "过车", "通行", "抓拍"],
      minHits: 2,
    },
  },
  ecommerce: {
    live_stream: {
      hints: ["live_stream", "live stream", "livestream", "live commerce", "直播带货", "直播零售", "直播间", "主播带货"],
      keywords: ["live", "stream", "livestream", "commerce", "直播", "带货", "主播", "直播间"],
      minHits: 2,
    },
    enterprise_procurement: {
      hints: ["enterprise_procurement", "enterprise procurement", "b2b procurement", "bulk order", "企业采购", "大宗采购", "批发订单", "团购采购"],
      keywords: ["enterprise", "procurement", "bulk", "wholesale", "b2b", "企业", "采购", "批发", "大宗", "团购"],
      minHits: 2,
    },
  },
  education: {
    parent_communication: {
      hints: ["parent_communication", "parent communication", "home-school", "guardian notice", "家校沟通", "家长通知", "家校互通", "班级通知"],
      keywords: ["parent", "guardian", "communication", "notice", "message", "家长", "监护人", "家校", "沟通", "通知", "消息"],
      minHits: 2,
    },
    dormitory_management: {
      hints: ["dormitory_management", "dormitory", "boarding", "bed allocation", "宿舍管理", "住宿管理", "住校", "床位管理"],
      keywords: ["dormitory", "boarding", "bed", "residence", "宿舍", "住宿", "住校", "床位"],
      minHits: 2,
    },
  },
};

const INDUSTRY_DYNAMIC_MODULE_METADATA = {
  bank_regulatory: {
    customer_account: {
      moduleName: "customer_account",
      moduleLabel: "Customer Account Ledger",
      summary: "Plan customer account ledger, balance, and branch ownership.",
      focusTables: ["customer_account", "reporting_branch", "reporting_contact"],
      expectedTables: ["customer_account"],
      concepts: {
        objects: ["customer", "branch"],
        actions: ["maintain", "report"],
        results: ["balance", "freeze"],
      },
    },
    loan_contract: {
      moduleName: "loan_contract",
      moduleLabel: "Loan Contract Lifecycle",
      summary: "Plan loan contract, overdue days, and branch exposure linkage.",
      focusTables: ["loan_contract_record", "reporting_branch", "prudential_report"],
      expectedTables: ["loan_contract_record"],
      concepts: {
        objects: ["borrower", "branch", "contract"],
        actions: ["grant", "sign", "track"],
        results: ["overdue", "maturity"],
      },
    },
  },
  traffic: {
    driver_training: {
      moduleName: "driver_training",
      moduleLabel: "Driver Training Progress",
      summary: "Plan driver training progress, exam stages, and driving school records.",
      focusTables: ["driver_training_record", "owner_profile", "vehicle_archive"],
      expectedTables: ["driver_training_record"],
      concepts: {
        objects: ["driver", "coach", "exam"],
        actions: ["enroll", "practice", "schedule"],
        results: ["hours", "progress", "certificate"],
      },
    },
    checkpoint_vehicle_pass: {
      moduleName: "checkpoint_vehicle_pass",
      moduleLabel: "Checkpoint Vehicle Pass",
      summary: "Plan checkpoint vehicle pass records, alerts, and capture devices.",
      focusTables: ["checkpoint_vehicle_pass_record", "vehicle_archive", "owner_profile"],
      expectedTables: ["checkpoint_vehicle_pass_record"],
      concepts: {
        objects: ["vehicle", "checkpoint", "device"],
        actions: ["pass", "capture", "monitor"],
        results: ["alert", "speed", "evidence"],
      },
    },
  },
  ecommerce: {
    live_stream: {
      moduleName: "live_stream",
      moduleLabel: "Live Stream Commerce",
      summary: "Plan live stream sessions, UV conversion, and GMV results.",
      focusTables: ["live_stream_session", "merchant_store", "payment_record"],
      expectedTables: ["live_stream_session"],
      concepts: {
        objects: ["host", "session", "store"],
        actions: ["broadcast", "promote", "convert"],
        results: ["traffic", "gmv", "order"],
      },
    },
    enterprise_procurement: {
      moduleName: "enterprise_procurement",
      moduleLabel: "Enterprise Procurement",
      summary: "Plan enterprise procurement orders, contract status, and warehouse delivery.",
      focusTables: ["enterprise_procurement_order", "merchant_store", "customer_profile"],
      expectedTables: ["enterprise_procurement_order"],
      concepts: {
        objects: ["enterprise", "contract", "warehouse"],
        actions: ["procure", "deliver", "settle"],
        results: ["bulk_order", "delivery", "settlement"],
      },
    },
  },
  education: {
    parent_communication: {
      moduleName: "parent_communication",
      moduleLabel: "Parent Communication",
      summary: "Plan parent communication, notice delivery, and guardian response.",
      focusTables: ["parent_communication_record", "student_profile", "guardian_contact"],
      expectedTables: ["parent_communication_record"],
      concepts: {
        objects: ["student", "guardian", "teacher"],
        actions: ["notify", "communicate", "reply"],
        results: ["notice_receipt", "response", "feedback"],
      },
    },
    dormitory_management: {
      moduleName: "dormitory_management",
      moduleLabel: "Dormitory Management",
      summary: "Plan dormitory residents, bed allocation, and campus lodging status.",
      focusTables: ["dormitory_resident_record", "student_profile", "campus_dimension"],
      expectedTables: ["dormitory_resident_record"],
      concepts: {
        objects: ["student", "dormitory", "bed"],
        actions: ["checkin", "allocate", "manage"],
        results: ["resident_status", "bed_assignment", "lodging"],
      },
    },
  },
};

const INDUSTRY_BUSINESS_CONCEPT_LEXICON = {
  bank_regulatory: {
    objects: {
      customer: { label: "customer", tokens: ["customer", "client", "account holder", "客户", "户主"] },
      branch: { label: "branch", tokens: ["branch", "sub-branch", "outlet", "支行", "分支机构", "网点"] },
      borrower: { label: "borrower", tokens: ["borrower", "credit user", "借款人", "授信客户"] },
      contract: { label: "contract", tokens: ["contract", "agreement", "借据", "合同", "协议"] },
    },
    actions: {
      maintain: { label: "maintain", tokens: ["maintain", "manage", "update", "维护", "管理", "更新"] },
      report: { label: "report", tokens: ["report", "submit", "declare", "报送", "上报", "申报"] },
      grant: { label: "grant", tokens: ["grant", "issue", "disburse", "放款", "发放", "授信"] },
      sign: { label: "sign", tokens: ["sign", "approve", "execute", "签约", "签署", "审批"] },
      track: { label: "track", tokens: ["track", "monitor", "follow", "跟踪", "监控", "追踪"] },
    },
    results: {
      balance: { label: "balance", tokens: ["balance", "available balance", "余额", "可用余额"] },
      freeze: { label: "freeze", tokens: ["freeze", "frozen", "hold amount", "冻结", "冻结金额"] },
      overdue: { label: "overdue", tokens: ["overdue", "delinquent", "past due", "逾期", "欠息"] },
      maturity: { label: "maturity", tokens: ["maturity", "due date", "repayment date", "到期", "到期日"] },
      settlement: { label: "settlement", tokens: ["settlement", "clearing", "结算", "清算"] },
    },
  },
  traffic: {
    objects: {
      driver: { label: "driver", tokens: ["driver", "trainee", "learner", "驾驶人", "学员"] },
      coach: { label: "coach", tokens: ["coach", "instructor", "trainer", "教练", "带教"] },
      exam: { label: "exam", tokens: ["exam", "subject test", "theory test", "考试", "科目考试"] },
      vehicle: { label: "vehicle", tokens: ["vehicle", "car", "plate", "车辆", "机动车"] },
      checkpoint: { label: "checkpoint", tokens: ["checkpoint", "gantry", "gate", "卡口", "门架"] },
      device: { label: "device", tokens: ["device", "camera", "sensor", "设备", "抓拍机"] },
    },
    actions: {
      enroll: { label: "enroll", tokens: ["enroll", "register", "apply", "报名", "登记"] },
      practice: { label: "practice", tokens: ["practice", "train", "learn", "练习", "培训", "学时"] },
      schedule: { label: "schedule", tokens: ["schedule", "arrange", "plan", "安排", "排期"] },
      pass: { label: "pass", tokens: ["pass", "transit", "travel through", "通行", "过车"] },
      capture: { label: "capture", tokens: ["capture", "snap", "photograph", "抓拍", "采集"] },
      monitor: { label: "monitor", tokens: ["monitor", "watch", "inspect", "监测", "监控", "巡检"] },
    },
    results: {
      hours: { label: "hours", tokens: ["hours", "practice hours", "study hours", "学时", "训练时长"] },
      progress: { label: "progress", tokens: ["progress", "status", "completion", "进度", "完成情况"] },
      certificate: { label: "certificate", tokens: ["license", "certificate", "credential", "证照", "驾驶证"] },
      alert: { label: "alert", tokens: ["alert", "warning", "hit", "预警", "告警", "布控"] },
      speed: { label: "speed", tokens: ["speed", "overspeed", "velocity", "速度", "超速"] },
      evidence: { label: "evidence", tokens: ["evidence", "image", "snapshot", "证据", "图片", "影像"] },
    },
  },
  ecommerce: {
    objects: {
      host: { label: "host", tokens: ["host", "anchor", "streamer", "主播", "达人"] },
      session: { label: "session", tokens: ["session", "show", "campaign", "场次", "直播场"] },
      store: { label: "store", tokens: ["store", "merchant", "shop", "门店", "商家", "店铺"] },
      enterprise: { label: "enterprise", tokens: ["enterprise", "company", "business buyer", "企业", "公司", "采购方"] },
      contract: { label: "contract", tokens: ["contract", "agreement", "quote", "合同", "协议", "报价单"] },
      warehouse: { label: "warehouse", tokens: ["warehouse", "fulfillment center", "stock center", "仓库", "仓配"] },
    },
    actions: {
      broadcast: { label: "broadcast", tokens: ["broadcast", "showcase", "present", "开播", "展示", "讲解"] },
      promote: { label: "promote", tokens: ["promote", "recommend", "advertise", "推广", "种草", "推荐"] },
      convert: { label: "convert", tokens: ["convert", "purchase", "order", "转化", "下单", "成交"] },
      procure: { label: "procure", tokens: ["procure", "buy in bulk", "source", "采购", "集采", "批量购买"] },
      deliver: { label: "deliver", tokens: ["deliver", "ship", "fulfill", "交付", "发货", "履约"] },
      settle: { label: "settle", tokens: ["settle", "invoice", "pay", "结算", "开票", "付款"] },
    },
    results: {
      traffic: { label: "traffic", tokens: ["traffic", "uv", "visitors", "流量", "访客", "曝光"] },
      gmv: { label: "gmv", tokens: ["gmv", "sales amount", "merchandise value", "成交额", "销售额"] },
      order: { label: "order", tokens: ["order", "order count", "订单", "订单量"] },
      bulk_order: { label: "bulk_order", tokens: ["bulk order", "b2b order", "大宗订单", "企业订单"] },
      delivery: { label: "delivery", tokens: ["delivery", "fulfillment", "交付", "履约"] },
      settlement: { label: "settlement", tokens: ["settlement", "invoice", "payment receipt", "结算", "回款"] },
    },
  },
  education: {
    objects: {
      student: { label: "student", tokens: ["student", "learner", "pupil", "学生", "学员"] },
      guardian: { label: "guardian", tokens: ["guardian", "parent", "family", "监护人", "家长", "家庭"] },
      teacher: { label: "teacher", tokens: ["teacher", "advisor", "class adviser", "教师", "班主任"] },
      dormitory: { label: "dormitory", tokens: ["dormitory", "boarding", "residence hall", "宿舍", "住宿"] },
      bed: { label: "bed", tokens: ["bed", "room", "roommate", "床位", "寝室", "房间"] },
    },
    actions: {
      notify: { label: "notify", tokens: ["notify", "send notice", "announce", "通知", "发送公告"] },
      communicate: { label: "communicate", tokens: ["communicate", "sync", "contact", "沟通", "联系", "互通"] },
      reply: { label: "reply", tokens: ["reply", "acknowledge", "confirm", "回复", "回执", "确认"] },
      checkin: { label: "checkin", tokens: ["check in", "move in", "入住", "入宿", "报到入住"] },
      allocate: { label: "allocate", tokens: ["allocate", "assign", "arrange", "分配", "安排"] },
      manage: { label: "manage", tokens: ["manage", "supervise", "maintain", "管理", "维护"] },
    },
    results: {
      notice_receipt: { label: "notice_receipt", tokens: ["receipt", "signed", "delivery status", "送达", "签收"] },
      response: { label: "response", tokens: ["response", "feedback", "follow-up", "反馈", "回复"] },
      feedback: { label: "feedback", tokens: ["feedback", "comment", "message result", "意见", "回访"] },
      resident_status: { label: "resident_status", tokens: ["resident status", "boarding status", "住宿状态", "入住状态"] },
      bed_assignment: { label: "bed_assignment", tokens: ["bed assignment", "room assignment", "床位分配", "寝室分配"] },
      lodging: { label: "lodging", tokens: ["lodging", "stay", "住宿", "住校"] },
    },
  },
};

function collectMatchedTokens(haystack, tokens) {
  const matched = new Set();
  (tokens || []).forEach((token) => {
    const normalized = normalizeText(token);
    if (normalized && haystack.includes(normalized)) {
      matched.add(normalized);
    }
  });
  return Array.from(matched);
}

function collectConceptMatches(haystack, definitions) {
  return Object.entries(definitions || {})
    .map(([key, definition]) => {
      const matchedTokens = collectMatchedTokens(haystack, definition.tokens);
      return matchedTokens.length > 0
        ? { key, label: definition.label || key, matchedTokens }
        : null;
    })
    .filter(Boolean);
}

function countKeywordHits(haystack, keywords) {
  return collectMatchedTokens(haystack, keywords).length;
}

function extractIndustryBusinessConcepts(input, industry) {
  const lexicon = INDUSTRY_BUSINESS_CONCEPT_LEXICON[industry];
  if (!lexicon) {
    return null;
  }
  const haystack = normalizeText(`${input.sceneName} ${input.sceneDesc} ${input.knowledgeText}`);
  const objects = collectConceptMatches(haystack, lexicon.objects);
  const actions = collectConceptMatches(haystack, lexicon.actions);
  const results = collectConceptMatches(haystack, lexicon.results);
  const totalMatches = objects.length + actions.length + results.length;
  const summary = totalMatches > 0
    ? `Extracted concepts: objects=${objects.map((item) => item.key).join(",") || "none"}; actions=${actions.map((item) => item.key).join(",") || "none"}; results=${results.map((item) => item.key).join(",") || "none"}.`
    : "No business concepts extracted from current scenario text.";
  return { industry, objects, actions, results, totalMatches, summary };
}

function buildModuleConceptOverlap(moduleConcepts, conceptPlan) {
  if (!moduleConcepts || !conceptPlan) {
    return { matched: false, score: 0, reasons: [], overlap: { objects: [], actions: [], results: [] } };
  }
  const overlap = {
    objects: (conceptPlan.objects || []).filter((item) => (moduleConcepts.objects || []).includes(item.key)),
    actions: (conceptPlan.actions || []).filter((item) => (moduleConcepts.actions || []).includes(item.key)),
    results: (conceptPlan.results || []).filter((item) => (moduleConcepts.results || []).includes(item.key)),
  };
  const objectScore = overlap.objects.length * 2;
  const actionScore = overlap.actions.length * 2;
  const resultScore = overlap.results.length * 2;
  const fullChainBonus = overlap.objects.length > 0 && overlap.actions.length > 0 && overlap.results.length > 0 ? 2 : 0;
  const score = objectScore + actionScore + resultScore + fullChainBonus;
  const matched = overlap.objects.length > 0 && (overlap.actions.length > 0 || overlap.results.length > 0) && score >= 4;
  const reasons = [];
  if (overlap.objects.length > 0) reasons.push(`concept-object:${overlap.objects.map((item) => item.key).join("|")}`);
  if (overlap.actions.length > 0) reasons.push(`concept-action:${overlap.actions.map((item) => item.key).join("|")}`);
  if (overlap.results.length > 0) reasons.push(`concept-result:${overlap.results.map((item) => item.key).join("|")}`);
  return { matched, score, reasons, overlap };
}

function mergeConceptEntryLists(primary = [], secondary = []) {
  const merged = new Map();
  [...primary, ...secondary].forEach((item) => {
    if (!item?.key) return;
    const current = merged.get(item.key) || { key: item.key, label: item.label || item.key, matchedTokens: [] };
    current.label = current.label || item.label || item.key;
    current.matchedTokens = [...new Set([...(current.matchedTokens || []), ...((item.matchedTokens || []).filter(Boolean))])];
    merged.set(item.key, current);
  });
  return Array.from(merged.values());
}

function summarizeConceptPlan(industry, objects, actions, results) {
  const totalMatches = objects.length + actions.length + results.length;
  const summary = totalMatches > 0
    ? `Extracted concepts: objects=${objects.map((item) => item.key).join(",") || "none"}; actions=${actions.map((item) => item.key).join(",") || "none"}; results=${results.map((item) => item.key).join(",") || "none"}.`
    : "No business concepts extracted from current scenario text.";
  return { industry, objects, actions, results, totalMatches, summary };
}

function buildEmptyConceptPlan(industry, summary = "No business concepts extracted from current scenario text.") {
  return { industry, objects: [], actions: [], results: [], totalMatches: 0, summary };
}

function parseDelimitedValues(value) {
  return String(value || "")
    .split(/[,;|，；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractKnowledgeKeywords(knowledgeText, limit = 12) {
  return [...new Set(String(knowledgeText || "").match(/[A-Za-z0-9_\u4e00-\u9fa5-]{2,}/g) || [])]
    .slice(0, limit);
}

function normalizeKnowledgeLine(line) {
  return String(line || "")
    .replace(/^\s*[#>*\-\d.、]+\s*/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKnowledgeHeadlineLines(knowledgeText, limit = 10) {
  const lines = String(knowledgeText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map(normalizeKnowledgeLine)
    .filter((line) => line.length >= 4 && line.length <= 160);
  return [...new Set(lines)].slice(0, limit);
}

function extractKnowledgeKeyValueLines(knowledgeText, limit = 12) {
  const lines = String(knowledgeText || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter((line) => /[:=：]/.test(line))
    .map(normalizeKnowledgeLine)
    .filter((line) => line.length >= 4 && line.length <= 200);
  return [...new Set(lines)].slice(0, limit);
}

function buildKnowledgePlanningSummary(knowledgeText, industry) {
  const text = String(knowledgeText || "").trim();
  const headlineLines = extractKnowledgeHeadlineLines(text);
  const keyValueLines = extractKnowledgeKeyValueLines(text);
  const keywords = extractKnowledgeKeywords(text);
  const conciseText = [...new Set([...headlineLines, ...keyValueLines])]
    .filter(Boolean)
    .slice(0, 16)
    .join("\n");
  const summary = conciseText
    ? `Knowledge summary captured ${Math.min(16, headlineLines.length + keyValueLines.length)} lines and ${keywords.length} keywords.`
    : "Knowledge summary is empty.";
  return {
    industry,
    headlineLines,
    keyValueLines,
    keywords,
    conciseText,
    summary,
  };
}

function normalizeKnowledgePlanningSummary(summary, industry) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const knowledgeSummary = summary.knowledgeSummary && typeof summary.knowledgeSummary === "object"
    ? {
      industry: summary.knowledgeSummary.industry || industry,
      headlineLines: Array.isArray(summary.knowledgeSummary.headlineLines) ? summary.knowledgeSummary.headlineLines : [],
      keyValueLines: Array.isArray(summary.knowledgeSummary.keyValueLines) ? summary.knowledgeSummary.keyValueLines : [],
      keywords: Array.isArray(summary.knowledgeSummary.keywords) ? summary.knowledgeSummary.keywords : [],
      conciseText: String(summary.knowledgeSummary.conciseText || ""),
      summary: String(summary.knowledgeSummary.summary || ""),
    }
    : buildKnowledgePlanningSummary("", industry);
  const moduleHints = summary.moduleHints && typeof summary.moduleHints === "object"
    ? {
      matchedModules: Array.isArray(summary.moduleHints.matchedModules) ? summary.moduleHints.matchedModules : [],
      reasonsByModule: summary.moduleHints.reasonsByModule && typeof summary.moduleHints.reasonsByModule === "object" ? summary.moduleHints.reasonsByModule : {},
      explicitModules: Array.isArray(summary.moduleHints.explicitModules) ? summary.moduleHints.explicitModules : [],
    }
    : { matchedModules: [], reasonsByModule: {}, explicitModules: [] };
  const tableHints = summary.tableHints && typeof summary.tableHints === "object"
    ? {
      explicitTables: Array.isArray(summary.tableHints.explicitTables) ? summary.tableHints.explicitTables : [],
      matchedTables: Array.isArray(summary.tableHints.matchedTables) ? summary.tableHints.matchedTables : [],
    }
    : { explicitTables: [], matchedTables: [] };
  const conceptSource = summary.conceptPlan && typeof summary.conceptPlan === "object"
    ? summary.conceptPlan
    : buildEmptyConceptPlan(industry, "No structured business concepts extracted from cached knowledge summary.");
  const conceptPlan = summarizeConceptPlan(
    conceptSource.industry || industry,
    Array.isArray(conceptSource.objects) ? conceptSource.objects : [],
    Array.isArray(conceptSource.actions) ? conceptSource.actions : [],
    Array.isArray(conceptSource.results) ? conceptSource.results : []
  );
  conceptPlan.summary = String(conceptSource.summary || conceptPlan.summary || "");
  return {
    knowledgeSummary,
    moduleHints,
    tableHints,
    conceptPlan,
    summary: String(summary.summary || ""),
  };
}

function extractKnowledgeLineValues(knowledgeText, labels) {
  const lines = String(knowledgeText || "").split(/\r?\n/);
  const values = [];
  lines.forEach((line) => {
    const matchedLabel = labels.find((label) => new RegExp(`${label}\\s*[:=]`, "i").test(line));
    if (!matchedLabel) {
      return;
    }
    const segment = line.replace(new RegExp(`.*?${matchedLabel}\\s*[:=]\\s*`, "i"), "");
    values.push(...parseDelimitedValues(segment));
  });
  return [...new Set(values)];
}

function extractKnowledgeModuleHints(knowledgeText, industry) {
  const text = String(knowledgeText || "");
  const haystack = normalizeText(text);
  const definitions = getIndustryDynamicModuleDefinitions(industry);
  const explicitModules = extractKnowledgeLineValues(text, ["module", "modules", "业务模块", "模块"]);
  const matched = new Set();
  const reasonsByModule = new Map();

  definitions.forEach((definition) => {
    const reasons = [];
    if (explicitModules.some((item) => normalizeText(item) === normalizeText(definition.moduleKey))) {
      reasons.push("knowledge-module:explicit");
    }
    if (explicitModules.some((item) => normalizeText(item) === normalizeText(definition.moduleName || ""))) {
      reasons.push("knowledge-module:name");
    }
    if (haystack.includes(normalizeText(definition.moduleKey))) {
      reasons.push("knowledge-module:key");
    }
    if ((definition.hints || []).some((hint) => haystack.includes(normalizeText(hint)))) {
      reasons.push("knowledge-module:hint");
    }
    if ((definition.focusTables || []).some((tableName) => haystack.includes(normalizeText(tableName)))) {
      reasons.push("knowledge-module:focus-table");
    }
    if (reasons.length > 0) {
      matched.add(definition.moduleKey);
      reasonsByModule.set(definition.moduleKey, [...new Set(reasons)]);
    }
  });

  return {
    matchedModules: Array.from(matched),
    reasonsByModule: Object.fromEntries(reasonsByModule.entries()),
    explicitModules,
  };
}

function extractKnowledgeTableHints(knowledgeText, industry) {
  const text = String(knowledgeText || "");
  const haystack = normalizeText(text);
  const explicitTables = extractKnowledgeLineValues(text, ["focus", "tables", "table", "核心表", "关注表", "表"]);
  const knownTables = new Set();
  getIndustryDynamicModuleDefinitions(industry).forEach((definition) => {
    [...(definition.focusTables || []), ...(definition.expectedTables || [])].forEach((tableName) => knownTables.add(tableName));
  });

  const matchedTables = new Set();
  explicitTables.forEach((item) => {
    const normalized = normalizeText(item);
    for (const tableName of knownTables) {
      if (normalized === normalizeText(tableName)) {
        matchedTables.add(tableName);
      }
    }
  });
  for (const tableName of knownTables) {
    if (haystack.includes(normalizeText(tableName))) {
      matchedTables.add(tableName);
    }
  }
  return {
    explicitTables,
    matchedTables: Array.from(matchedTables),
  };
}

function extractKnowledgeBusinessConcepts(knowledgeText, industry) {
  const lexicon = INDUSTRY_BUSINESS_CONCEPT_LEXICON[industry];
  if (!lexicon) {
    return null;
  }
  const text = String(knowledgeText || "");
  if (!text.trim()) {
    return buildEmptyConceptPlan(industry, "No structured business concepts extracted from knowledge text.");
  }
  const objectValues = extractKnowledgeLineValues(text, ["objects", "object", "业务对象", "对象"]);
  const actionValues = extractKnowledgeLineValues(text, ["actions", "action", "业务动作", "动作"]);
  const resultValues = extractKnowledgeLineValues(text, ["results", "result", "业务结果", "结果"]);
  const objectPlan = collectConceptMatches(normalizeText(objectValues.join(" ")), lexicon.objects);
  const actionPlan = collectConceptMatches(normalizeText(actionValues.join(" ")), lexicon.actions);
  const resultPlan = collectConceptMatches(normalizeText(resultValues.join(" ")), lexicon.results);
  const plan = summarizeConceptPlan(industry, objectPlan, actionPlan, resultPlan);
  if (plan.totalMatches > 0) {
    plan.summary = `Knowledge concepts: objects=${plan.objects.map((item) => item.key).join(",") || "none"}; actions=${plan.actions.map((item) => item.key).join(",") || "none"}; results=${plan.results.map((item) => item.key).join(",") || "none"}.`;
  } else {
    plan.summary = "No structured business concepts extracted from knowledge text.";
  }
  return plan;
}

function mergeConceptPlans(industry, ...plans) {
  const mergedObjects = mergeConceptEntryLists(...plans.map((plan) => plan?.objects || []));
  const mergedActions = mergeConceptEntryLists(...plans.map((plan) => plan?.actions || []));
  const mergedResults = mergeConceptEntryLists(...plans.map((plan) => plan?.results || []));
  return summarizeConceptPlan(industry, mergedObjects, mergedActions, mergedResults);
}

function extractKnowledgePlanningSignals(knowledgeText, industry) {
  const knowledgeSummary = buildKnowledgePlanningSummary(knowledgeText, industry);
  const analysisText = knowledgeSummary.conciseText || String(knowledgeText || "");
  const moduleHints = extractKnowledgeModuleHints(analysisText, industry);
  const tableHints = extractKnowledgeTableHints(analysisText, industry);
  const conceptPlan = extractKnowledgeBusinessConcepts(analysisText, industry);
  const summaryParts = [];
  if (knowledgeSummary.summary) {
    summaryParts.push(knowledgeSummary.summary);
  }
  if (moduleHints.matchedModules.length > 0) {
    summaryParts.push(`knowledge-modules=${moduleHints.matchedModules.join(",")}`);
  }
  if (tableHints.matchedTables.length > 0) {
    summaryParts.push(`knowledge-tables=${tableHints.matchedTables.join(",")}`);
  }
  if (conceptPlan?.totalMatches > 0) {
    summaryParts.push(conceptPlan.summary);
  }
  return {
    knowledgeSummary,
    moduleHints,
    tableHints,
    conceptPlan,
    summary: summaryParts.length > 0 ? `Knowledge signals: ${summaryParts.join("; ")}.` : "No structured knowledge signals extracted.",
  };
}

function getScenarioPlanningContext(input, industry) {
  const sceneConceptPlan = extractIndustryBusinessConcepts({
    sceneName: input.sceneName,
    sceneDesc: input.sceneDesc,
    knowledgeText: "",
  }, industry) || buildEmptyConceptPlan(industry);
  const knowledgeSignals = normalizeKnowledgePlanningSummary(input.knowledgePlanningSummary, industry)
    || extractKnowledgePlanningSignals(input.knowledgeText, industry);
  const conceptPlan = mergeConceptPlans(industry, sceneConceptPlan, knowledgeSignals.conceptPlan);
  return {
    sceneHaystack: normalizeText(`${input.sceneName} ${input.sceneDesc}`),
    knowledgeHaystack: normalizeText(`${input.knowledgeText}`),
    haystack: normalizeText(`${input.sceneName} ${input.sceneDesc} ${input.knowledgeText}`),
    sceneConceptPlan,
    knowledgeSignals,
    conceptPlan,
  };
}

function getIndustryDynamicModuleDefinition(industry, moduleKey) {
  const patternDef = (INDUSTRY_DYNAMIC_MODULE_KEYWORDS[industry] || []).find((item) => item.moduleKey === moduleKey) || null;
  if (!patternDef) {
    return null;
  }
  return {
    industry,
    moduleKey,
    ...(INDUSTRY_DYNAMIC_MODULE_METADATA[industry]?.[moduleKey] || {}),
    ...(INDUSTRY_DYNAMIC_MODULE_HINTS[industry]?.[moduleKey] || {}),
    pattern: patternDef.pattern,
  };
}

function getIndustryDynamicModuleDefinitions(industry) {
  return (INDUSTRY_DYNAMIC_MODULE_KEYWORDS[industry] || [])
    .map((item) => getIndustryDynamicModuleDefinition(industry, item.moduleKey))
    .filter(Boolean);
}

function buildDynamicModuleCandidate(input, industry, moduleKey, selectedSet = new Set(), planningContext = null) {
  const definition = getIndustryDynamicModuleDefinition(industry, moduleKey);
  if (!definition) {
    return null;
  }
  const activePlanningContext = planningContext || getScenarioPlanningContext(input, industry);
  const haystack = activePlanningContext.sceneHaystack;
  const directHit = definition.pattern ? definition.pattern.test(haystack) : false;
  const matchedHints = collectMatchedTokens(haystack, definition.hints);
  const matchedKeywords = collectMatchedTokens(haystack, definition.keywords);
  const matchedTables = collectMatchedTokens(haystack, definition.focusTables);
  const conceptOverlap = buildModuleConceptOverlap(definition.concepts, activePlanningContext.conceptPlan);
  const knowledgeModuleReasons = activePlanningContext.knowledgeSignals?.moduleHints?.reasonsByModule?.[moduleKey] || [];
  const knowledgeTables = (definition.focusTables || []).filter((tableName) => (activePlanningContext.knowledgeSignals?.tableHints?.matchedTables || []).includes(tableName));
  const strongKnowledgeModuleReasons = knowledgeModuleReasons.filter((reason) => reason !== "knowledge-module:focus-table");
  const strongKnowledgeSignal = strongKnowledgeModuleReasons.length > 0 || knowledgeTables.length >= 2;
  const selected = selectedSet.has(moduleKey);
  const matched = directHit
    || matchedHints.length > 0
    || matchedKeywords.length >= Number(definition.minHits || 2)
    || matchedTables.length > 0
    || strongKnowledgeSignal
    || conceptOverlap.matched
    || selected;
  const score = (directHit ? 6 : 0)
    + Math.min(4, matchedHints.length)
    + Math.min(4, matchedKeywords.length)
    + Math.min(4, matchedTables.length * 2)
    + Math.min(4, strongKnowledgeModuleReasons.length * 2)
    + Math.min(4, knowledgeTables.length)
    + conceptOverlap.score
    + (selected ? 2 : 0);
  const reasons = [];
  if (directHit) reasons.push("pattern");
  if (matchedHints.length > 0) reasons.push(`hint:${matchedHints.join("|")}`);
  if (matchedKeywords.length > 0) reasons.push(`keyword:${matchedKeywords.join("|")}`);
  if (matchedTables.length > 0) reasons.push(`table:${matchedTables.join("|")}`);
  reasons.push(...strongKnowledgeModuleReasons);
  if (knowledgeTables.length >= 2) reasons.push(`knowledge-table:${knowledgeTables.join("|")}`);
  reasons.push(...conceptOverlap.reasons);
  if (selected) reasons.push("profile");
  return {
    moduleKey,
    moduleName: definition.moduleName || moduleKey,
    moduleLabel: definition.moduleLabel || moduleKey,
    summary: definition.summary || "",
    focusTables: definition.focusTables || [],
    expectedTables: definition.expectedTables || [],
    score,
    matched,
    selected,
    reasons,
    conceptOverlap: {
      objects: (conceptOverlap.overlap.objects || []).map((item) => item.key),
      actions: (conceptOverlap.overlap.actions || []).map((item) => item.key),
      results: (conceptOverlap.overlap.results || []).map((item) => item.key),
      score: conceptOverlap.score,
    },
    knowledgeOverlap: {
      moduleReasons: strongKnowledgeModuleReasons,
      tables: knowledgeTables,
    },
  };
}

function collectRequestedModules(input, industry) {
  const planningContext = getScenarioPlanningContext(input, industry);
  return getIndustryDynamicModuleDefinitions(industry)
    .map((item) => buildDynamicModuleCandidate(input, industry, item.moduleKey, new Set(), planningContext))
    .filter((item) => item && item.matched)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.moduleKey);
}

function buildScenarioModulePlan(input, profile) {
  const moduleIndustry = profile?.referenceIndustry || profile?.industry;
  if (!moduleIndustry || moduleIndustry === "generic") {
    return null;
  }
  const selectedSet = new Set(Array.isArray(profile.requestedModules) ? profile.requestedModules.filter(Boolean) : []);
  const planningContext = getScenarioPlanningContext(input, moduleIndustry);
  const candidates = getIndustryDynamicModuleDefinitions(moduleIndustry)
    .map((item) => buildDynamicModuleCandidate(input, moduleIndustry, item.moduleKey, selectedSet, planningContext))
    .concat(
      (Array.isArray(profile?.referenceModulePlanner?.modules) ? profile.referenceModulePlanner.modules : Array.isArray(profile?.modulePlanner?.modules) ? profile.modulePlanner.modules : []).map((item) => {
        const sceneText = `${input?.sceneName || ""} ${input?.sceneDesc || ""} ${input?.knowledgeText || ""}`.toLowerCase();
        const moduleKey = String(item?.moduleKey || item?.moduleLabel || item?.summary || "").trim();
        const moduleLabel = String(item?.moduleLabel || item?.moduleKey || "").trim();
        if (!moduleKey) return null;
        const matchTokens = [
          moduleKey,
          moduleLabel,
          ...(Array.isArray(item?.hints) ? item.hints : []),
        ].map((token) => String(token || "").trim()).filter(Boolean);
        const matchedTokens = matchTokens.filter((token) => sceneText.includes(String(token).toLowerCase()));
        const score = matchedTokens.length > 0 ? (0.55 + Math.min(0.35, matchedTokens.length * 0.08)) : 0;
        return {
          moduleKey,
          moduleName: moduleLabel || moduleKey,
          moduleLabel: moduleLabel || moduleKey,
          summary: item?.summary || `${moduleLabel || moduleKey} 模块`,
          focusTables: Array.isArray(item?.focusTables) ? item.focusTables : [],
          expectedTables: Array.isArray(item?.expectedTables) ? item.expectedTables : [],
          score,
          reasons: matchedTokens.map((token) => `managed-module=${token}`),
          selected: matchedTokens.length > 0,
          conceptOverlap: matchedTokens,
          knowledgeOverlap: matchedTokens,
          matched: matchedTokens.length > 0,
          source: "managed_profile",
        };
      }).filter(Boolean)
    )
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (Number(right.selected) !== Number(left.selected)) {
        return Number(right.selected) - Number(left.selected);
      }
      return left.moduleKey.localeCompare(right.moduleKey);
    });
  const matchedModules = Array.from(new Map(candidates.filter((item) => item.matched).map((item) => [item.moduleKey, item])).values());
  const suggestedModules = Array.from(new Map(candidates.filter((item) => !item.matched && item.score > 0).map((item) => [item.moduleKey, item])).values()).slice(0, 3);
  const summary = matchedModules.length > 0
    ? `Dynamic planner selected ${matchedModules.map((item) => item.moduleKey).join(", ")}.`
    : "Dynamic planner did not select any registered extension module.";
  return {
    industry: moduleIndustry,
    sceneConceptPlan: planningContext.sceneConceptPlan,
    knowledgeSignals: planningContext.knowledgeSignals,
    knowledgeSummary: planningContext.knowledgeSignals?.knowledgeSummary || null,
    conceptPlan: planningContext.conceptPlan,
    matchedModules: matchedModules.map((item) => ({
      moduleKey: item.moduleKey,
      moduleName: item.moduleName,
      moduleLabel: item.moduleLabel,
      summary: item.summary,
      focusTables: item.focusTables,
      expectedTables: item.expectedTables,
      score: item.score,
      reasons: item.reasons,
      selected: item.selected,
      conceptOverlap: item.conceptOverlap,
      knowledgeOverlap: item.knowledgeOverlap,
    })),
    suggestedModules: suggestedModules.map((item) => ({
      moduleKey: item.moduleKey,
      moduleName: item.moduleName,
      moduleLabel: item.moduleLabel,
      summary: item.summary,
      focusTables: item.focusTables,
      expectedTables: item.expectedTables,
      score: item.score,
      reasons: item.reasons,
      conceptOverlap: item.conceptOverlap,
      knowledgeOverlap: item.knowledgeOverlap,
    })),
    requestedModules: matchedModules.map((item) => item.moduleKey),
    summary: `${summary}${planningContext.knowledgeSignals?.summary ? ` ${planningContext.knowledgeSignals.summary}` : ""}${planningContext.conceptPlan?.summary ? ` ${planningContext.conceptPlan.summary}` : ""}`,
  };
}

function finalizeScenarioProfile(input, profile) {
  const dedupedModules = [...new Set(Array.isArray(profile?.requestedModules) ? profile.requestedModules.filter(Boolean) : [])];
  const nextProfile = { ...profile, requestedModules: dedupedModules };
  const modulePlan = buildScenarioModulePlan(input, nextProfile);
  if (!modulePlan) {
    return nextProfile;
  }
  nextProfile.requestedModules = modulePlan.requestedModules;
  nextProfile.modulePlan = modulePlan;
  nextProfile.conceptPlan = modulePlan.conceptPlan || null;
  nextProfile.knowledgeSummary = modulePlan.knowledgeSummary || null;
  return nextProfile;
}

function mergeRequestedModules(profile, industry, values) {
  const next = new Set(Array.isArray(profile?.requestedModules) ? profile.requestedModules : []);
  const hints = Array.isArray(values) ? values : [values];
  hints
    .filter((item) => item !== null && item !== undefined)
    .forEach((item) => {
      const matched = collectRequestedModules({
        sceneName: Array.isArray(item) ? item.join(" ") : String(item),
        sceneDesc: "",
        knowledgeText: "",
      }, industry);
      matched.forEach((moduleKey) => next.add(moduleKey));
    });
  return Array.from(next);
}

function buildEcommerceProfile(input, recognition) {
  const subtype = detectEcommerceSubtype(input);
  const subtypeOverride = ECOMMERCE_SUBTYPE_OVERRIDES[subtype] || ECOMMERCE_SUBTYPE_OVERRIDES.general;

  return {
    ...recognition,
    locale: "zh-CN",
    businessStyle: "consumer-retail",
    subtype,
    requestedModules: collectRequestedModules(input, "ecommerce"),
    preferredCategories: subtypeOverride.preferredCategories,
    categoryWeights: subtypeOverride.categoryWeights,
    cities: CITY_OPTIONS,
    paymentChannels: PAYMENT_CHANNELS,
    orderStatuses: ORDER_STATUS_OPTIONS,
  };
}

function buildTrafficProfile(input, recognition) {
  return {
    ...recognition,
    locale: "zh-CN",
    businessStyle: "traffic-governance",
    subtype: "urban-traffic-control",
    requestedModules: collectRequestedModules(input, "traffic"),
    cities: CITY_OPTIONS,
    vehicleTypes: TRAFFIC_VEHICLE_TYPES,
    violationCodes: TRAFFIC_VIOLATION_CODES,
    stationNames: TRAFFIC_STATION_NAMES,
    roadNames: TRAFFIC_ROAD_NAMES,
    violationStatuses: TRAFFIC_VIOLATION_STATUS,
    inspectionResults: TRAFFIC_INSPECTION_RESULTS,
  };
}

function buildBankProfile(recognition) {
  return {
    ...recognition,
    locale: "zh-CN",
    businessStyle: "prudential-reporting",
    subtype: "prudential-reporting",
    requestedModules: [],
    cities: CITY_OPTIONS,
    branchTypes: BANK_BRANCH_TYPES,
    institutionNames: BANK_INSTITUTION_NAMES,
    reportCodes: BANK_REPORT_CODES,
    reportStatuses: BANK_REPORT_STATUS,
    issueTypes: BANK_ISSUE_TYPES,
    issueLevels: BANK_ISSUE_LEVELS,
  };
}

function buildFinanceFundProfile(recognition) {
  return {
    ...recognition,
    locale: "zh-CN",
    businessStyle: "fund-operations",
    subtype: "fund-operations",
    requestedModules: [],
    cities: CITY_OPTIONS,
    fundProductTypes: FUND_PRODUCT_TYPES,
    fundRiskLevels: FUND_RISK_LEVELS,
    investorTypes: FUND_INVESTOR_TYPES,
    tradeChannels: FUND_TRADE_CHANNELS,
    orderStatuses: FUND_ORDER_STATUS,
    fundCompanies: FUND_COMPANY_NAMES,
  };
}

function buildLogisticsExpressProfile(recognition) {
  return {
    ...recognition,
    locale: "zh-CN",
    businessStyle: "express-logistics",
    subtype: "express-fulfillment",
    requestedModules: [],
    cities: CITY_OPTIONS,
    expressCompanies: LOGISTICS_EXPRESS_COMPANIES,
    transportModes: LOGISTICS_TRANSPORT_MODES,
    waybillStatuses: LOGISTICS_WAYBILL_STATUS,
    exceptionTypes: LOGISTICS_EXCEPTION_TYPES,
  };
}

function buildEducationProfile(input, recognition) {
  const subtype = detectEducationSubtype(input);
  const subtypeOverride = EDUCATION_SUBTYPE_OVERRIDES[subtype] || EDUCATION_SUBTYPE_OVERRIDES.general;
  return {
    ...recognition,
    locale: "zh-CN",
    businessStyle: "education-governance",
    subtype,
    requestedModules: collectRequestedModules(input, "education"),
    focusModules: subtypeOverride.focusModules || EDUCATION_SUBTYPE_OVERRIDES.general.focusModules,
    schoolTypes: applyWeightOverride(EDUCATION_SCHOOL_TYPES, subtypeOverride.schoolTypeWeights),
    educationStages: EDUCATION_STAGES,
    gradeCodes: EDUCATION_GRADE_CODES,
    termCodes: EDUCATION_TERM_CODES,
    subjectCodes: applyWeightOverride(EDUCATION_SUBJECTS, subtypeOverride.subjectWeights),
    staffRoles: applyWeightOverride(EDUCATION_STAFF_ROLES, subtypeOverride.staffRoleWeights),
    billStatuses: applyWeightOverride(EDUCATION_BILL_STATUS, subtypeOverride.billStatusWeights),
    accessResults: applyWeightOverride(EDUCATION_ACCESS_RESULTS, subtypeOverride.accessResultWeights),
    borrowStatuses: applyWeightOverride(EDUCATION_BORROW_STATUS, subtypeOverride.borrowStatusWeights),
    cities: CITY_OPTIONS,
  };
}

function getDistributionRuleConfig(profile, ruleType) {
  const rules = Array.isArray(profile?.distributionRules) ? profile.distributionRules : [];
  const matchedRule = rules.find((item) => item.status !== "inactive" && item.ruleType === ruleType);
  return matchedRule?.ruleConfig && typeof matchedRule.ruleConfig === "object" ? matchedRule.ruleConfig : null;
}

function applyWeightOverride(items, weightConfig) {
  if (!Array.isArray(items) || !weightConfig || typeof weightConfig !== "object") {
    return items;
  }
  return items.map((item) => ({
    ...item,
    weight: Number(weightConfig[item.code] ?? item.weight ?? 1),
  }));
}

function pickRangeValue(range, fallbackRange) {
  if (Array.isArray(range) && range.length >= 2) {
    return [Number(range[0]), Number(range[1])];
  }
  return fallbackRange;
}

function getProfileDictionaryItems(profile, dictType) {
  const dictionaries = Array.isArray(profile?.dictionaries) ? profile.dictionaries : [];
  return dictionaries
    .filter((item) => item && item.status !== "inactive" && item.dictType === dictType)
    .map((item) => ({
      code: item.itemCode,
      label: item.itemLabel,
      weight: Number(item.weight || 1),
      ...(item.itemValue || {}),
    }));
}

function getDictionaryOptions(profile, dictType, fallbackItems = []) {
  const managedItems = getProfileDictionaryItems(profile, dictType);
  return managedItems.length > 0 ? managedItems : fallbackItems;
}

function pickProfileDictionaryItem(profile, dictType, random, fallbackItems = []) {
  return pickWeighted(getDictionaryOptions(profile, dictType, fallbackItems), random)
    || pickOne(getDictionaryOptions(profile, dictType, fallbackItems), random)
    || null;
}

function pickProfileCode(profile, dictType, random, fallbackItems = [], fallbackCode = "") {
  return pickProfileDictionaryItem(profile, dictType, random, fallbackItems)?.code || fallbackCode;
}

function randomNumberBetween(minValue, maxValue, random, precision = 2) {
  const min = Number(minValue || 0);
  const max = Number(maxValue || min);
  const value = min + random() * Math.max(0, max - min);
  return Number(value.toFixed(precision));
}

function randomIntBetween(minValue, maxValue, random) {
  const min = Math.round(Number(minValue || 0));
  const max = Math.round(Number(maxValue || min));
  if (max <= min) {
    return min;
  }
  return min + Math.floor(random() * (max - min + 1));
}

function shiftTime(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000);
}

function formatPeriod(date, frequency) {
  const current = new Date(date);
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const quarter = Math.floor(current.getMonth() / 3) + 1;
  if (frequency === "季报") {
    return `${current.getFullYear()}Q${quarter}`;
  }
  if (frequency === "半年报") {
    return `${current.getFullYear()}H${quarter <= 2 ? 1 : 2}`;
  }
  if (frequency === "年报") {
    return `${current.getFullYear()}`;
  }
  if (frequency === "日报") {
    return `${current.getFullYear()}-${month}-${String(current.getDate()).padStart(2, "0")}`;
  }
  return `${current.getFullYear()}-${month}`;
}

function formatDateTime(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function getRuntimeBaseTime(runtime) {
  const baseTime = runtime?.baseTime instanceof Date ? runtime.baseTime : new Date();
  return Number.isNaN(baseTime.getTime()) ? new Date() : baseTime;
}

function padNumber(value, size) {
  return String(value).padStart(size, "0");
}

function calculateIdCardChecksum(prefix17) {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const mapping = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const digits = String(prefix17 || "").replace(/\D/g, "");
  if (digits.length !== 17) {
    return "X";
  }
  const total = digits.split("").reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
  return mapping[total % 11];
}

function buildMainlandIdCard(regionCode, birthDate, serial, gender) {
  const region = String(regionCode || "310000").padEnd(6, "0").slice(0, 6);
  const targetDate = new Date(birthDate);
  const year = targetDate.getFullYear();
  const month = padNumber(targetDate.getMonth() + 1, 2);
  const day = padNumber(targetDate.getDate(), 2);
  let sequence = 100 + (Number(serial || 0) % 899);
  if (gender === "M" && sequence % 2 === 0) sequence += 1;
  if (gender === "F" && sequence % 2 === 1) sequence += 1;
  if (sequence > 999) sequence -= 2;
  const prefix17 = `${region}${year}${month}${day}${padNumber(sequence, 3)}`;
  return `${prefix17}${calculateIdCardChecksum(prefix17)}`;
}

function buildMainlandMobile(serial, random, preferredPrefixes = null) {
  const prefixPool = Array.isArray(preferredPrefixes) && preferredPrefixes.length > 0 ? preferredPrefixes : MAINLAND_MOBILE_PREFIXES;
  const prefix = pickOne(prefixPool, random) || "138";
  const suffix = padNumber((Number(serial || 0) * 7919) % 100000000, 8);
  return `${prefix}${suffix}`;
}

function buildDomesticEmail(serial, random, prefix = "user") {
  const normalizedPrefix = String(prefix || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12) || "user";
  const account = `${normalizedPrefix}${padNumber((Number(serial || 0) * 97) % 1000000, 6)}`;
  return `${account}@${pickOne(CUSTOMER_EMAIL_DOMAINS, random) || "qq.com"}`;
}

function applyEcommercePluginBindings(profile) {
  const bindings = Array.isArray(profile?.pluginBindings) ? profile.pluginBindings.filter((item) => item.status !== "inactive") : [];
  if (bindings.length === 0) {
    return profile;
  }

  const nextProfile = { ...profile };
  for (const binding of bindings) {
    const config = binding.bindingConfig || {};
    if (binding.pluginKey === "ecommerce-default" || binding.pluginKey === "ecommerce-subtype" || config.subtype) {
      const subtype = config.subtype || nextProfile.subtype;
      const subtypeOverride = ECOMMERCE_SUBTYPE_OVERRIDES[subtype] || ECOMMERCE_SUBTYPE_OVERRIDES.general;
      nextProfile.subtype = subtype;
      nextProfile.preferredCategories = Array.isArray(config.preferredCategories) && config.preferredCategories.length > 0
        ? config.preferredCategories
        : subtypeOverride.preferredCategories;
      nextProfile.categoryWeights = {
        ...(subtypeOverride.categoryWeights || {}),
        ...(config.categoryWeights || {}),
      };
    }
    if (Array.isArray(config.businessModules) && config.businessModules.length > 0) {
      nextProfile.requestedModules = mergeRequestedModules(nextProfile, "ecommerce", config.businessModules);
    }
  }

  return nextProfile;
}

function applyTrafficPluginBindings(profile) {
  const bindings = Array.isArray(profile?.pluginBindings) ? profile.pluginBindings.filter((item) => item.status !== "inactive") : [];
  if (bindings.length === 0) return profile;
  const nextProfile = { ...profile };
  for (const binding of bindings) {
    const config = binding.bindingConfig || {};
    if (config.stationNames && Array.isArray(config.stationNames)) {
      nextProfile.stationNames = config.stationNames;
    }
    if (config.roadNames && Array.isArray(config.roadNames)) {
      nextProfile.roadNames = config.roadNames;
    }
    if (config.vehicleTypeWeights && typeof config.vehicleTypeWeights === "object") {
      nextProfile.vehicleTypes = applyWeightOverride(nextProfile.vehicleTypes, config.vehicleTypeWeights);
    }
    if (Array.isArray(config.businessModules) && config.businessModules.length > 0) {
      nextProfile.requestedModules = mergeRequestedModules(nextProfile, "traffic", config.businessModules);
    }
  }
  return nextProfile;
}

function applyBankPluginBindings(profile) {
  const bindings = Array.isArray(profile?.pluginBindings) ? profile.pluginBindings.filter((item) => item.status !== "inactive") : [];
  if (bindings.length === 0) return profile;
  const nextProfile = { ...profile };
  for (const binding of bindings) {
    const config = binding.bindingConfig || {};
    if (config.reportCodes && Array.isArray(config.reportCodes) && config.reportCodes.length > 0) {
      nextProfile.reportCodes = config.reportCodes.map((item) => {
        if (typeof item === "string") {
          const fallback = BANK_REPORT_CODES.find((entry) => entry.code === item);
          return fallback || { code: item, label: item, weight: 1 };
        }
        return item;
      });
    }
    if (config.issueTypeWeights && typeof config.issueTypeWeights === "object") {
      nextProfile.issueTypes = applyWeightOverride(nextProfile.issueTypes, config.issueTypeWeights);
    }
    if (Array.isArray(config.businessModules) && config.businessModules.length > 0) {
      nextProfile.requestedModules = mergeRequestedModules(nextProfile, "bank_regulatory", config.businessModules);
    }
  }
  return nextProfile;
}

function applyEducationPluginBindings(profile) {
  const bindings = Array.isArray(profile?.pluginBindings) ? profile.pluginBindings.filter((item) => item.status !== "inactive") : [];
  if (bindings.length === 0) return profile;
  const nextProfile = { ...profile };
  for (const binding of bindings) {
    const config = binding.bindingConfig || {};
    if (Array.isArray(config.focusModules) && config.focusModules.length > 0) {
      nextProfile.focusModules = config.focusModules.slice();
      nextProfile.requestedModules = mergeRequestedModules(nextProfile, "education", config.focusModules);
    }
    if (Array.isArray(config.campusNames) && config.campusNames.length > 0) {
      nextProfile.campusNames = config.campusNames.slice();
    }
    if (config.schoolTypeWeights && typeof config.schoolTypeWeights === "object") {
      nextProfile.schoolTypes = applyWeightOverride(nextProfile.schoolTypes, config.schoolTypeWeights);
    }
    if (config.subjectWeights && typeof config.subjectWeights === "object") {
      nextProfile.subjectCodes = applyWeightOverride(nextProfile.subjectCodes, config.subjectWeights);
    }
    if (config.staffRoleWeights && typeof config.staffRoleWeights === "object") {
      nextProfile.staffRoles = applyWeightOverride(nextProfile.staffRoles, config.staffRoleWeights);
    }
    if (config.billStatusWeights && typeof config.billStatusWeights === "object") {
      nextProfile.billStatuses = applyWeightOverride(nextProfile.billStatuses, config.billStatusWeights);
    }
    if (config.accessResultWeights && typeof config.accessResultWeights === "object") {
      nextProfile.accessResults = applyWeightOverride(nextProfile.accessResults, config.accessResultWeights);
    }
    if (config.borrowStatusWeights && typeof config.borrowStatusWeights === "object") {
      nextProfile.borrowStatuses = applyWeightOverride(nextProfile.borrowStatuses, config.borrowStatusWeights);
    }
    if (Array.isArray(config.businessModules) && config.businessModules.length > 0) {
      nextProfile.requestedModules = mergeRequestedModules(nextProfile, "education", config.businessModules);
    }
  }
  return nextProfile;
}

function buildScenarioProfile(input) {
  const recognition = recognizeScenario({ ...input, managedProfiles: [] });
  const baseProfile = recognition.industry === "education"
    ? buildEducationProfile(input, recognition)
    : recognition.industry === "ecommerce"
    ? buildEcommerceProfile(input, recognition)
    : recognition.industry === "traffic"
      ? buildTrafficProfile(input, recognition)
      : recognition.industry === "bank_regulatory"
        ? { ...buildBankProfile(recognition), requestedModules: collectRequestedModules(input, "bank_regulatory") }
        : recognition.industry === "finance_fund"
          ? buildFinanceFundProfile(recognition)
          : recognition.industry === "logistics_express"
            ? buildLogisticsExpressProfile(recognition)
        : {
          ...recognition,
          locale: "zh-CN",
          businessStyle: recognition.industry,
          cities: CITY_OPTIONS,
        };

  const mergedProfile = mergeManagedScenarioProfile(baseProfile, input.managedProfiles || [], input.boundProfileId, input);
  const effectiveIndustry = mergedProfile.referenceIndustry || mergedProfile.industry;
  if ((!Array.isArray(mergedProfile.requestedModules) || mergedProfile.requestedModules.length === 0) && effectiveIndustry && effectiveIndustry !== "generic") {
    mergedProfile.requestedModules = collectRequestedModules(input, effectiveIndustry);
  }
  const profileAfterPlugins = effectiveIndustry === "education"
    ? applyEducationPluginBindings(mergedProfile)
    : effectiveIndustry === "ecommerce"
      ? applyEcommercePluginBindings(mergedProfile)
      : effectiveIndustry === "traffic"
        ? applyTrafficPluginBindings(mergedProfile)
        : effectiveIndustry === "bank_regulatory"
          ? applyBankPluginBindings(mergedProfile)
          : mergedProfile;
  return finalizeScenarioProfile(input, profileAfterPlugins);
}

function collectManagedProfileReferenceTokens(managed) {
  const tokens = [
    managed?.industry,
    managed?.subScenario,
    managed?.profileName,
    managed?.profileDesc,
    ...(Array.isArray(managed?.pluginBindings)
      ? managed.pluginBindings.flatMap((item) => {
        const config = item?.bindingConfig && typeof item.bindingConfig === "object" ? item.bindingConfig : {};
        return [
          item?.pluginName,
          ...(Array.isArray(config.businessModules) ? config.businessModules : []),
          ...(Array.isArray(config.focusModules) ? config.focusModules : []),
        ];
      })
      : []),
    ...(Array.isArray(managed?.modulePlanner?.modules)
      ? managed.modulePlanner.modules.flatMap((item) => [
        item?.moduleLabel,
        item?.summary,
        ...(Array.isArray(item?.hints) ? item.hints : []),
      ])
      : []),
    ...(Array.isArray(managed?.modulePlanner?.categories)
      ? managed.modulePlanner.categories.flatMap((item) => [
        item?.categoryName,
        item?.description,
        ...(Array.isArray(item?.tableScopes) ? item.tableScopes : []),
      ])
      : []),
    ...(Array.isArray(managed?.researchCatalog?.businessObjects) ? managed.researchCatalog.businessObjects : []),
    ...(Array.isArray(managed?.researchCatalog?.businessActions) ? managed.researchCatalog.businessActions : []),
    ...(Array.isArray(managed?.researchCatalog?.businessResults) ? managed.researchCatalog.businessResults : []),
    ...(Array.isArray(managed?.researchCatalog?.categoryTree)
      ? managed.researchCatalog.categoryTree.flatMap((item) => [
        item?.categoryName,
        ...(Array.isArray(item?.tableScopes) ? item.tableScopes : []),
      ])
      : []),
    ...(Array.isArray(managed?.researchCatalog?.candidateTables) ? managed.researchCatalog.candidateTables : []),
    ...(Array.isArray(managed?.researchCatalog?.dictSuggestions) ? managed.researchCatalog.dictSuggestions : []),
  ];
  return [...new Set(tokens.map((item) => String(item || "").trim()).filter((item) => item.length >= 2))];
}

function assessManagedProfileCompatibility(input, baseProfile, managed) {
  const detectedIndustry = String(baseProfile?.industry || "").trim();
  const managedIndustry = String(managed?.industry || "").trim();
  if (detectedIndustry && detectedIndustry !== "generic" && managedIndustry && managedIndustry !== detectedIndustry) {
    return { compatible: false, score: 0, reasons: ["industry_mismatch"], matchedTokens: [] };
  }
  const haystack = normalizeText(`${input?.sceneName || ""} ${input?.sceneDesc || ""} ${input?.knowledgeText || ""}`);
  const tokens = collectManagedProfileReferenceTokens(managed);
  const matchedTokens = tokens.filter((token) => {
    const normalized = normalizeText(token);
    if (!normalized) return false;
    if (haystack.includes(normalized)) return true;
    if (/[\u4e00-\u9fff]/.test(normalized)) {
      for (let index = 0; index < normalized.length - 1; index += 1) {
        const fragment = normalized.slice(index, index + 2);
        if (fragment.length >= 2 && haystack.includes(fragment)) {
          return true;
        }
      }
    }
    return normalized.split(/[_\s]+/).some((part) => part.length >= 2 && haystack.includes(part));
  });
  const score = matchedTokens.length + ((detectedIndustry && detectedIndustry !== "generic" && detectedIndustry === managedIndustry) ? 2 : 0);
  if (detectedIndustry === "generic" && managedIndustry) {
    return {
      compatible: matchedTokens.length > 0,
      score: Math.max(matchedTokens.length, score),
      reasons: matchedTokens.map((token) => `scene-match:${token}`).slice(0, 8),
      matchedTokens: matchedTokens.slice(0, 12),
    };
  }
  const compatible = score >= 2 || matchedTokens.some((token) => normalizeText(token).length >= 4);
  return {
    compatible,
    score,
    reasons: matchedTokens.map((token) => `scene-match:${token}`).slice(0, 8),
    matchedTokens: matchedTokens.slice(0, 12),
  };
}

function mergeManagedScenarioProfile(baseProfile, managedProfiles, boundProfileId, input = {}) {
  if (!Array.isArray(managedProfiles) || managedProfiles.length === 0 || !boundProfileId) {
    return baseProfile;
  }

  const boundManaged = boundProfileId
    ? managedProfiles.find((item) => item && item.status === "active" && Number(item.id) === Number(boundProfileId))
    : null;
  const managed = boundManaged;
  if (!managed) {
    return baseProfile;
  }
  const compatibility = assessManagedProfileCompatibility(input, baseProfile, managed);
  if (!compatibility.compatible) {
    return {
      ...baseProfile,
      managedProfileId: managed.id,
      managedProfileCode: managed.profileCode,
      managedProfileCompatible: false,
      managedProfileReasons: compatibility.reasons,
    };
  }

  const dictionaries = Array.isArray(managed.dictionaries) ? managed.dictionaries : [];
  const byType = (dictType) => dictionaries.filter((item) => item && item.status !== "inactive" && item.dictType === dictType);
  const plannerModules = Array.isArray(managed?.modulePlanner?.modules)
    ? managed.modulePlanner.modules
    : (Array.isArray(managed?.modulePlanner?.categories)
      ? managed.modulePlanner.categories.map((item) => ({
        moduleKey: item?.categoryCode || item?.categoryName,
        moduleLabel: item?.categoryName || item?.categoryCode,
        summary: item?.description || managed?.modulePlanner?.summary || "",
        focusTables: Array.isArray(item?.tableScopes) ? item.tableScopes : [],
        expectedTables: Array.isArray(item?.tableScopes) ? item.tableScopes : [],
        hints: Array.isArray(item?.sourceRefs) ? item.sourceRefs : [],
      }))
      : []);

  const profile = {
    ...baseProfile,
    managedProfileId: managed.id,
    managedProfileCode: managed.profileCode,
    managedProfileCompatible: true,
    managedProfileReasons: compatibility.reasons,
    locale: baseProfile.locale || managed.locale,
    businessStyle: baseProfile.businessStyle,
    confidenceThreshold: managed.confidenceThreshold ?? baseProfile.confidence,
    referenceIndustry: managed.industry || baseProfile.industry,
    referenceSubScenario: managed.subScenario || null,
    referenceResearchCatalog: managed.researchCatalog || {},
    referenceModulePlanner: { modules: plannerModules, categories: Array.isArray(managed?.modulePlanner?.categories) ? managed.modulePlanner.categories : [] },
    schemaGuides: {},
    relationPatterns: [],
    stateMachines: [],
    codeRules: [],
    fieldSemantics: [],
    valueCorpora: {},
    distributionProfiles: {},
    qualityGates: {},
    realismRules: [],
    dirtyDataProfiles: {},
    trainingAssets: {},
    evaluationRubric: {},
    overridePolicies: {},
    dictionaries,
    distributionRules: [],
    fieldRules: [],
    complianceRules: [],
    pluginBindings: [],
    extendedRules: [],
  };

  const capabilityStateMachines = Array.isArray(profile.stateMachines) ? profile.stateMachines : [];
  const capabilityStateFlowRules = capabilityStateMachines.map((item, index) => ({
    ruleCategory: "state_flow",
    moduleKey: item.moduleKey || "capability_state_machine",
    ruleCode: item.ruleCode || `STATE_MACHINE_${index + 1}`,
    ruleName: item.ruleName || item.name || `State Machine ${index + 1}`,
    tableName: item.tableName || null,
    fieldName: item.fieldName || item.stateField || null,
    ruleConfig: {
      stateField: item.stateField || item.fieldName || null,
      allowedStates: Array.isArray(item.allowedStates) ? item.allowedStates : [],
      stateEffects: item.stateEffects && typeof item.stateEffects === "object" ? item.stateEffects : {},
    },
    sortOrder: Number(item.sortOrder || index),
    status: item.status || "active",
  }));

  if (profile.industry === "ecommerce") {
    const subtypeOverride = ECOMMERCE_SUBTYPE_OVERRIDES[profile.subScenario || profile.subtype || "general"] || ECOMMERCE_SUBTYPE_OVERRIDES.general;
    profile.paymentChannels = Array.isArray(profile.paymentChannels) && profile.paymentChannels.length > 0 ? profile.paymentChannels : PAYMENT_CHANNELS;
    profile.orderStatuses = Array.isArray(profile.orderStatuses) && profile.orderStatuses.length > 0 ? profile.orderStatuses : ORDER_STATUS_OPTIONS;
    profile.preferredCategories = Array.isArray(profile.preferredCategories) && profile.preferredCategories.length > 0 ? profile.preferredCategories : subtypeOverride.preferredCategories;
    profile.categoryWeights = {
      ...(subtypeOverride.categoryWeights || {}),
      ...(profile.categoryWeights || {}),
    };
  }

  const managedCities = byType("city").map((item) => ({
    code: item.itemCode,
    name: item.itemLabel,
    districts: Array.isArray(item.itemValue?.districts) ? item.itemValue.districts : [],
  }));
  if (managedCities.length > 0) {
    profile.cities = managedCities;
  }

  const managedPaymentChannels = byType("payment_channel").map((item) => ({
    code: item.itemCode,
    label: item.itemLabel,
    weight: Number(item.weight || 1),
  }));
  if (managedPaymentChannels.length > 0) {
    profile.paymentChannels = managedPaymentChannels;
  }

  const managedOrderStatuses = byType("order_status").map((item) => ({
    code: item.itemCode,
    label: item.itemLabel,
    weight: Number(item.weight || 1),
  }));
  if (managedOrderStatuses.length > 0) {
    profile.orderStatuses = managedOrderStatuses;
  }

  const preferredCategories = byType("preferred_category").map((item) => item.itemCode).filter(Boolean);
  if (preferredCategories.length > 0) {
    profile.preferredCategories = preferredCategories;
  }

  const categoryMix = byType("category_mix");
  if (categoryMix.length > 0) {
    profile.categoryWeights = categoryMix.reduce((result, item) => {
      result[item.itemCode] = Number(item.weight || 1);
      return result;
    }, {});
  }

  const vehicleTypes = byType("vehicle_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (vehicleTypes.length > 0) profile.vehicleTypes = vehicleTypes;

  const violationCodes = byType("violation_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (violationCodes.length > 0) profile.violationCodes = violationCodes;

  const stationNames = byType("station_name").map((item) => item.itemLabel).filter(Boolean);
  if (stationNames.length > 0) profile.stationNames = stationNames;

  const roadNames = byType("road_name").map((item) => item.itemLabel).filter(Boolean);
  if (roadNames.length > 0) profile.roadNames = roadNames;

  const violationStatuses = byType("violation_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
  if (violationStatuses.length > 0) profile.violationStatuses = violationStatuses;

  const inspectionResults = byType("inspection_result").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
  if (inspectionResults.length > 0) profile.inspectionResults = inspectionResults;

  const branchTypes = byType("branch_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
  if (branchTypes.length > 0) profile.branchTypes = branchTypes;

  const reportCodes = byType("report_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (reportCodes.length > 0) profile.reportCodes = reportCodes;

  const reportStatuses = byType("report_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
  if (reportStatuses.length > 0) profile.reportStatuses = reportStatuses;

  const issueTypes = byType("issue_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
  if (issueTypes.length > 0) profile.issueTypes = issueTypes;

  const issueLevels = byType("issue_level").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
  if (issueLevels.length > 0) profile.issueLevels = issueLevels;

  const schoolTypes = byType("school_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (schoolTypes.length > 0) profile.schoolTypes = schoolTypes;

  const educationStages = byType("education_stage").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (educationStages.length > 0) profile.educationStages = educationStages;

  const gradeCodes = byType("grade_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (gradeCodes.length > 0) profile.gradeCodes = gradeCodes;

  const termCodes = byType("term_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (termCodes.length > 0) profile.termCodes = termCodes;

  const subjectCodes = byType("subject_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (subjectCodes.length > 0) profile.subjectCodes = subjectCodes;

  const staffRoles = byType("staff_role").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (staffRoles.length > 0) profile.staffRoles = staffRoles;

  const billStatuses = byType("bill_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (billStatuses.length > 0) profile.billStatuses = billStatuses;

  const accessResults = byType("access_result").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (accessResults.length > 0) profile.accessResults = accessResults;

  const borrowStatuses = byType("borrow_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...(item.itemValue || {}) }));
  if (borrowStatuses.length > 0) profile.borrowStatuses = borrowStatuses;

  const campusNames = byType("campus_name").map((item) => item.itemLabel).filter(Boolean);
  if (campusNames.length > 0) profile.campusNames = campusNames;

  const extendedRules = Array.isArray(profile.extendedRules) ? profile.extendedRules.filter((item) => item && item.status !== "inactive") : [];
  const mergedExtendedRules = [...extendedRules, ...capabilityStateFlowRules];
  profile.linkageRules = mergedExtendedRules.filter((item) => item.ruleCategory === "linkage");
  profile.temporalRules = mergedExtendedRules.filter((item) => item.ruleCategory === "temporal");
  profile.cardinalityRules = mergedExtendedRules.filter((item) => item.ruleCategory === "cardinality");
  profile.stateFlowRules = mergedExtendedRules.filter((item) => item.ruleCategory === "state_flow");
  profile.codeRules = [
    ...(Array.isArray(profile.codeRules) ? profile.codeRules : []),
    ...mergedExtendedRules.filter((item) => item.ruleCategory === "code"),
  ];
  profile.extendedRules = mergedExtendedRules;

  return profile;
}

function pickEcommerceProductVariant(catalog, random) {
  const product = pickOne(catalog.products, random) || {
    brand: pickOne(catalog.brands || [], random) || "",
    series: pickOne(catalog.series || [], random) || "",
    storage: catalog.storage || [""],
    colors: catalog.colors || [""],
  };
  const brand = product.brand;
  const series = product.series;
  const storage = pickOne(product.storage || catalog.storage || [""], random) || "";
  const color = pickOne(product.colors || catalog.colors || [""], random) || "";
  const title = catalog.titlePattern
    .replace("{brand}", brand)
    .replace("{series}", series)
    .replace("{storage}", storage)
    .replace("{color}", color)
    .replace(/\s+/g, " ")
    .trim();
  return { title, brand, series, storage, color };
}

function createScenarioRuntime(profile, sceneCode, baseTime = new Date()) {
  const state = {
    profile,
    sceneCode,
    baseTime: baseTime instanceof Date ? baseTime : new Date(baseTime),
    productFacts: new Map(),
    customerFacts: new Map(),
    addressFacts: new Map(),
    storeFacts: new Map(),
    spuFacts: new Map(),
    skuFacts: new Map(),
    inventoryFacts: new Map(),
    orderFacts: new Map(),
    itemFacts: new Map(),
    paymentFacts: new Map(),
    refundFacts: new Map(),
    deliveryFacts: new Map(),
    liveStreamFacts: new Map(),
    procurementFacts: new Map(),
    ownerFacts: new Map(),
    vehicleFacts: new Map(),
    registrationFacts: new Map(),
    violationFacts: new Map(),
    penaltyFacts: new Map(),
    inspectionFacts: new Map(),
    accidentFacts: new Map(),
    dispatchFacts: new Map(),
    patrolFacts: new Map(),
    documentFacts: new Map(),
    driverTrainingFacts: new Map(),
    checkpointPassFacts: new Map(),
    institutionFacts: new Map(),
    branchFacts: new Map(),
    contactFacts: new Map(),
    reportFacts: new Map(),
    customerAccountFacts: new Map(),
    loanContractFacts: new Map(),
    metricFacts: new Map(),
    riskFacts: new Map(),
    alertFacts: new Map(),
    issueFacts: new Map(),
    taskFacts: new Map(),
    submissionFacts: new Map(),
    approvalFacts: new Map(),
    campusFacts: new Map(),
    studentFacts: new Map(),
    guardianFacts: new Map(),
    staffFacts: new Map(),
    courseFacts: new Map(),
    scheduleFacts: new Map(),
    enrollmentFacts: new Map(),
    tuitionFacts: new Map(),
    accessFacts: new Map(),
    libraryFacts: new Map(),
    parentCommunicationFacts: new Map(),
    dormitoryResidentFacts: new Map(),
    fundProductFacts: new Map(),
    fundAccountFacts: new Map(),
    fundSubscriptionFacts: new Map(),
    fundRedemptionFacts: new Map(),
    fundNavFacts: new Map(),
    fundTradeFacts: new Map(),
    logisticsWaybillFacts: new Map(),
    logisticsPackageFacts: new Map(),
    logisticsRouteFacts: new Map(),
    logisticsTransferFacts: new Map(),
    logisticsSignFacts: new Map(),
    logisticsExceptionFacts: new Map(),
  };

  return state;
}

function buildCustomerFact(serial, random, profile) {
  const city = pickOne(profile.cities, random) || profile.cities[0];
  const familyName = pickOne(CUSTOMER_FAMILY_NAMES, random) || "张";
  const givenName = `${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "悦"}`;
  const customerName = `${familyName}${givenName}`;
  const memberLevel = pickProfileCode(profile, "member_level", random, ECOMMERCE_MEMBER_LEVELS, "普通会员");
  const registerChannel = pickProfileCode(profile, "register_channel", random, ECOMMERCE_REGISTER_CHANNELS, "APP");
  const riskLevel = pickProfileCode(profile, "risk_level", random, ECOMMERCE_RISK_LEVELS, "低风险");
  const preferredCategory = pickOne(profile.preferredCategories || [], random) || "ELECTRONIC";
  const registerTime = new Date(Date.now() - serial * 17 * 24 * 60 * 60 * 1000);
  const lastLoginTime = shiftTime(registerTime, randomIntBetween(3 * 24 * 60, 180 * 24 * 60, random));
  const lastOrderTime = shiftTime(lastLoginTime, randomIntBetween(60, 45 * 24 * 60, random));

  return {
    id: serial,
    customerName,
    customerCode: `CUST${String(100000 + serial).slice(-6)}`,
    gender: serial % 2 === 0 ? "女" : "男",
    mobile: buildMainlandMobile(serial, random),
    email: buildDomesticEmail(serial, random, "buyer"),
    memberLevel,
    registerChannel,
    riskLevel,
    loyaltyScore: randomIntBetween(380, 980, random),
    totalOrderCount: randomIntBetween(1, 48, random),
    totalOrderAmount: randomNumberBetween(399, 158000, random),
    registerTime,
    lastLoginTime,
    lastOrderTime,
    preferredCategory,
    provinceCode: city.code,
    provinceName: city.name,
    cityCode: city.code,
    cityName: city.name,
    districtCode: `${city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
    districtName: pickOne(city.districts, random) || city.name,
  };
}

function buildAddressFact(serial, random, runtime) {
  const customer = pickFactByIndex(runtime.customerFacts, serial - 1);
  const city = runtime.profile.cities.find((item) => item.code === customer?.cityCode) || pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
  const addressTag = pickProfileCode(runtime.profile, "address_tag", random, [
    { code: "家", label: "家", weight: 54 },
    { code: "公司", label: "公司", weight: 28 },
    { code: "学校", label: "学校", weight: 8 },
    { code: "父母家", label: "父母家", weight: 10 },
  ], "家");
  return {
    id: serial,
    customer,
    consigneeName: customer?.customerName || `收货人${serial}`,
    consigneeMobile: customer?.mobile || buildMainlandMobile(10000 + serial, random),
    provinceCode: city.code,
    provinceName: city.name,
    cityCode: city.code,
    cityName: city.name,
    districtCode: `${city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
    districtName: pickOne(city.districts, random) || city.name,
    streetName: pickOne(["科技路", "商城路", "人民路", "青年路", "滨江大道"], random) || "科技路",
    addressDetail: `${pickOne(["星河苑", "金域华庭", "万科广场", "天街公寓", "云栖花园"], random) || "星河苑"}${(serial % 18) + 1}幢${(serial % 4) + 1}单元${(serial % 240) + 101}室`,
    postalCode: buildPostalCode(city.code, serial),
    addressTag,
    isDefault: serial % 3 === 0 ? 0 : 1,
    longitude: randomNumberBetween(120.95, 121.78, random, 6),
    latitude: randomNumberBetween(30.92, 31.58, random, 6),
    deliveryInstructions: pickOne(["工作日白天送达", "请放前台", "联系本人签收", "晚间配送优先"], random) || "联系本人签收",
  };
}

function buildStoreFact(serial, random, profile) {
  const city = pickOne(profile.cities, random) || profile.cities[0];
  const storeType = pickProfileCode(profile, "store_type", random, ECOMMERCE_STORE_TYPES, "城市仓");
  const merchantName = pickProfileCode(profile, "merchant_name", random, [
    { code: "数智零售", label: "数智零售", weight: 28 },
    { code: "星云商贸", label: "星云商贸", weight: 22 },
    { code: "新锐电器", label: "新锐电器", weight: 20 },
    { code: "优选生活", label: "优选生活", weight: 18 },
    { code: "悦享供应链", label: "悦享供应链", weight: 12 },
  ], "数智零售");
  const warehouseCode = `WH${city.code.slice(-2)}${String(200 + serial).slice(-3)}`;
  return {
    id: serial,
    storeCode: `STORE${String(100000 + serial).slice(-6)}`,
    storeName: `${city.name}${pickOne(["中心仓", "城市仓", "前置仓", "旗舰店", "体验店"], random) || "中心仓"}${(serial % 9) + 1}号`,
    merchantName,
    storeType,
    provinceCode: city.code,
    provinceName: city.name,
    cityCode: city.code,
    cityName: city.name,
    districtCode: `${city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
    districtName: pickOne(city.districts, random) || city.name,
    streetName: pickOne(["园区路", "商业街", "创新大道", "物流大道", "胜利路"], random) || "园区路",
    addressDetail: `${pickOne(["智慧仓配园", "供应链中心", "直营广场", "数智产业园"], random) || "智慧仓配园"}${(serial % 12) + 1}栋`,
    contactName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "王"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "宁"}`,
    contactMobile: buildMainlandMobile(20000 + serial, random),
    contactEmail: buildDomesticEmail(serial, random, "store"),
    warehouseCode,
    dailyOrderCapacity: randomIntBetween(300, 2800, random),
    averageDispatchMinutes: randomIntBetween(18, 160, random),
    deliveryScope: pickOne(["同城", "全省", "华东", "全国"], random) || "同城",
    ratingScore: randomNumberBetween(4.3, 4.98, random),
  };
}

function buildProductFact(serial, random, profile) {
  const preferred = ECOMMERCE_CATEGORIES.filter((item) => profile.preferredCategories.includes(item.code));
  const candidateCatalogs = preferred.length > 0 ? preferred : ECOMMERCE_CATEGORIES;
  const weightedCatalogs = candidateCatalogs.map((item) => ({
    ...item,
    weight: Number(profile.categoryWeights?.[item.code] ?? item.weight ?? 1),
  }));
  const catalog = pickWeighted(weightedCatalogs, random) || candidateCatalogs[0];
  const priceBandConfig = getDistributionRuleConfig(profile, "price_band");
  const inventoryBandConfig = getDistributionRuleConfig(profile, "inventory_band");
  const [priceMin, priceMax] = pickRangeValue(priceBandConfig?.[catalog.code], catalog.priceRange);
  const [stockMin, stockMax] = pickRangeValue(inventoryBandConfig?.[catalog.code], catalog.stockRange);
  const salePrice = randomNumberBetween(priceMin, priceMax, random);
  const stockQty = randomIntBetween(stockMin, stockMax, random);
  const marketPrice = Number((salePrice * randomNumberBetween(1.06, 1.28, random, 4)).toFixed(2));
  const costPrice = Number((salePrice * randomNumberBetween(0.58, 0.82, random, 4)).toFixed(2));
  const productType = pickProfileCode(profile, "product_type", random, ECOMMERCE_PRODUCT_TYPES, "标品");
  const shelfStatus = pickProfileCode(profile, "shelf_status", random, ECOMMERCE_SHELF_STATUS, "在售");
  const supplier = pickProfileDictionaryItem(profile, "supplier_name", random, [
    { code: "SUP001", label: "华东供应链中心", weight: 28 },
    { code: "SUP002", label: "华南品牌直供", weight: 22 },
    { code: "SUP003", label: "全国仓配联盟", weight: 20 },
    { code: "SUP004", label: "官方直营采购", weight: 18 },
    { code: "SUP005", label: "区域优选服务商", weight: 12 },
  ]) || { code: "SUP001", label: "华东供应链中心" };
  const originCountry = pickProfileCode(profile, "origin_country", random, [
    { code: "中国", label: "中国", weight: 64 },
    { code: "越南", label: "越南", weight: 10 },
    { code: "泰国", label: "泰国", weight: 8 },
    { code: "日本", label: "日本", weight: 8 },
    { code: "德国", label: "德国", weight: 10 },
  ], "中国");

  const variant = pickEcommerceProductVariant(catalog, random);
  return {
    id: serial,
    categoryCode: catalog.code,
    categoryLabel: catalog.label,
    subCategoryCode: `${catalog.code}_${String((serial % 6) + 1).padStart(2, "0")}`,
    subCategoryName: `${catalog.label}${pickOne(["核心款", "升级款", "精品款", "旗舰款"], random) || "核心款"}`,
    productName: variant.title,
    brandName: variant.brand || catalog.label,
    productLine: pickProfileCode(profile, "product_line", random, [
      { code: "标准线", label: "标准线", weight: 44 },
      { code: "高端线", label: "高端线", weight: 24 },
      { code: "爆款线", label: "爆款线", weight: 20 },
      { code: "企业采购线", label: "企业采购线", weight: 12 },
    ], "标准线"),
    productType,
    marketPrice,
    salePrice,
    costPrice,
    taxRate: randomNumberBetween(6, 13, random),
    unitName: pickProfileCode(profile, "unit_name", random, [
      { code: "件", label: "件", weight: 70 },
      { code: "台", label: "台", weight: 20 },
      { code: "套", label: "套", weight: 10 },
    ], "件"),
    originCountry,
    supplierName: supplier.label,
    supplierCode: supplier.code,
    modelNo: `MDL-${String(10000 + serial).slice(-5)}`,
    shelfStatus,
    launchDate: new Date(Date.now() - randomIntBetween(20, 520, random) * 24 * 60 * 60 * 1000),
    discontinueDate: shelfStatus === "停售"
      ? new Date(Date.now() + randomIntBetween(10, 80, random) * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + randomIntBetween(180, 960, random) * 24 * 60 * 60 * 1000),
    stockQty,
  };
}

function pickFactByIndex(map, index) {
  const values = [...map.values()];
  if (values.length === 0) {
    return null;
  }
  return values[index % values.length];
}

function findFact(map, predicate) {
  for (const value of map.values()) {
    if (predicate(value)) {
      return value;
    }
  }
  return null;
}

function buildOrderFact(serial, random, runtime, startedAt) {
  const customer = pickFactByIndex(runtime.customerFacts, serial - 1);
  const store = pickFactByIndex(runtime.storeFacts, serial - 1);
  const address = pickFactByIndex(runtime.addressFacts, serial - 1);
  const sku = pickFactByIndex(runtime.skuFacts, serial * 2 + 3) || pickFactByIndex(runtime.spuFacts, serial * 2 + 3);
  const quantity = randomIntBetween(1, 3, random);
  const weightedStatuses = applyWeightOverride(runtime.profile.orderStatuses, getDistributionRuleConfig(runtime.profile, "order_status_ratio"));
  const orderStatus = pickWeighted(weightedStatuses, random)?.code || "已支付";
  const orderChannel = pickProfileCode(runtime.profile, "order_channel", random, ECOMMERCE_ORDER_CHANNELS, "APP");
  const orderSource = pickProfileCode(runtime.profile, "order_source", random, ECOMMERCE_ORDER_SOURCES, "搜索");
  const invoiceStatus = pickProfileCode(runtime.profile, "invoice_status", random, ECOMMERCE_INVOICE_STATUS, "无需开票");
  const paymentStatus = ["待支付", "已关闭"].includes(orderStatus) ? "待支付" : orderStatus === "退款成功" ? "已退款" : "支付成功";
  const deliveryStatus = ["待支付", "已关闭"].includes(orderStatus)
    ? "待出库"
    : ["退款成功", "退款中"].includes(orderStatus)
      ? "配送异常"
      : orderStatus === "已完成"
        ? "已签收"
        : orderStatus === "已发货"
          ? "运输中"
          : "已出库";
  const orderTime = new Date(startedAt.getTime() - serial * 37 * 60 * 1000);
  const unitPrice = sku?.salePrice || 199;
  const grossAmount = Number((unitPrice * quantity).toFixed(2));
  const discountAmount = Number((grossAmount * randomNumberBetween(0.02, 0.16, random, 4)).toFixed(2));
  const freightAmount = grossAmount >= 299 ? 0 : randomNumberBetween(6, 18, random);
  const couponAmount = discountAmount > 0 ? Number((discountAmount * randomNumberBetween(0.2, 0.65, random, 4)).toFixed(2)) : 0;
  const pointsDeductionAmount = Number((Math.min(60, grossAmount * 0.02)).toFixed(2));
  const netAmount = Number((grossAmount - discountAmount + freightAmount - pointsDeductionAmount).toFixed(2));
  const payTime = shiftTime(orderTime, randomIntBetween(3, 95, random));
  const shipTime = shiftTime(payTime, randomIntBetween(40, 900, random));
  const completeTime = shiftTime(shipTime, randomIntBetween(480, 7200, random));

  return {
    id: serial,
    customerId: customer?.id || serial,
    storeId: store?.id || serial,
    orderNo: `EC${String(orderTime.getFullYear())}${String(serial).padStart(8, "0")}`,
    orderSource,
    orderChannel,
    orderStatus,
    paymentStatus,
    deliveryStatus,
    orderTime,
    payTime,
    shipTime,
    completeTime,
    grossAmount,
    discountAmount,
    freightAmount,
    netAmount,
    couponAmount,
    pointsDeductionAmount,
    invoiceStatus,
    consigneeName: address?.consigneeName || customer?.customerName || `收货人${serial}`,
    consigneeMobile: address?.consigneeMobile || customer?.mobile || buildMainlandMobile(30000 + serial, random),
    addressSnapshot: `${address?.provinceName || ""}${address?.cityName || ""}${address?.districtName || ""}${address?.streetName || ""}${address?.addressDetail || ""}`,
    provinceCode: address?.provinceCode || customer?.provinceCode || "310000",
    cityCode: address?.cityCode || customer?.cityCode || "310000",
    itemQuantity: quantity,
    sku,
  };
}

function buildPaymentFact(serial, random, runtime) {
  const order = pickFactByIndex(runtime.orderFacts, serial - 1);
  const weightedChannels = applyWeightOverride(runtime.profile.paymentChannels, getDistributionRuleConfig(runtime.profile, "payment_channel_ratio"));
  const channel = pickWeighted(weightedChannels, random)?.code || "微信支付";
  const payTime = shiftTime(order?.orderTime || new Date(), randomIntBetween(5, 120, random));
  const payStatus = order?.paymentStatus || (["待支付", "已关闭"].includes(order?.orderStatus) ? "待支付" : "支付成功");
  const refundStatus = ["退款成功", "退款中"].includes(order?.orderStatus) ? order.orderStatus : "无退款";

  return {
    id: serial,
    orderId: order?.id || serial,
    paymentNo: `PAY${String(2026000000 + serial)}`,
    payChannel: channel,
    payStatus,
    payAmount: order?.netAmount || order?.grossAmount || 99.0,
    currencyCode: "CNY",
    transactionId: `TX${String(8000000000 + serial)}`,
    merchantOrderNo: order?.orderNo || `EC${String(20260000 + serial)}`,
    acquirerCode: pickProfileCode(runtime.profile, "acquirer_code", random, [
      { code: "ALI-ACQ", label: "ALI-ACQ", weight: 34 },
      { code: "WX-ACQ", label: "WX-ACQ", weight: 32 },
      { code: "UNION-ACQ", label: "UNION-ACQ", weight: 22 },
      { code: "BANK-ACQ", label: "BANK-ACQ", weight: 12 },
    ], "ALI-ACQ"),
    bankName: pickProfileCode(runtime.profile, "bank_name", random, [
      { code: "招商银行", label: "招商银行", weight: 26 },
      { code: "中国建设银行", label: "中国建设银行", weight: 24 },
      { code: "中国工商银行", label: "中国工商银行", weight: 22 },
      { code: "中国银行", label: "中国银行", weight: 16 },
      { code: "平安银行", label: "平安银行", weight: 12 },
    ], "招商银行"),
    payerAccountMask: `****${String(1000 + serial).slice(-4)}`,
    payTime,
    callbackTime: shiftTime(payTime, randomIntBetween(1, 15, random)),
    settlementTime: shiftTime(payTime, randomIntBetween(30, 180, random)),
    refundStatus,
    riskResult: pickProfileCode(runtime.profile, "risk_result", random, [
      { code: "通过", label: "通过", weight: 88 },
      { code: "人工复核", label: "人工复核", weight: 8 },
      { code: "拦截", label: "拦截", weight: 4 },
    ], "通过"),
  };
}

function buildSkuFact(serial, random, runtime) {
  const spu = pickFactByIndex(runtime.spuFacts, serial - 1) || buildProductFact(serial, random, runtime.profile);
  const storageSpec = pickProfileCode(runtime.profile, "storage_spec", random, [
    { code: "128GB", label: "128GB", weight: 24 },
    { code: "256GB", label: "256GB", weight: 34 },
    { code: "512GB", label: "512GB", weight: 22 },
    { code: "标准装", label: "标准装", weight: 12 },
    { code: "礼盒装", label: "礼盒装", weight: 8 },
  ], "256GB");
  const sizeSpec = pickProfileCode(runtime.profile, "size_spec", random, [
    { code: "标准版", label: "标准版", weight: 38 },
    { code: "高配版", label: "高配版", weight: 26 },
    { code: "企业版", label: "企业版", weight: 10 },
    { code: "L", label: "L", weight: 16 },
    { code: "XL", label: "XL", weight: 10 },
  ], "标准版");
  const packageSpec = pickProfileCode(runtime.profile, "package_spec", random, [
    { code: "单件", label: "单件", weight: 54 },
    { code: "套装", label: "套装", weight: 16 },
    { code: "礼盒", label: "礼盒", weight: 12 },
    { code: "官方标配", label: "官方标配", weight: 18 },
  ], "单件");
  const warehouseName = pickProfileCode(runtime.profile, "warehouse_name", random, [
    { code: "上海青浦中心仓", label: "上海青浦中心仓", weight: 26 },
    { code: "杭州余杭仓", label: "杭州余杭仓", weight: 20 },
    { code: "深圳龙华仓", label: "深圳龙华仓", weight: 20 },
    { code: "南京江宁仓", label: "南京江宁仓", weight: 18 },
    { code: "成都双流仓", label: "成都双流仓", weight: 16 },
  ], "上海青浦中心仓");
  const promoPrice = Number((spu.salePrice * randomNumberBetween(0.86, 0.98, random, 4)).toFixed(2));
  const memberPrice = Number((promoPrice * randomNumberBetween(0.95, 0.99, random, 4)).toFixed(2));
  const stockQty = Math.max(spu.stockQty || 10, randomIntBetween(20, Math.max(spu.stockQty || 60, 60), random));
  const lockedStockQty = randomIntBetween(0, Math.max(2, Math.round(stockQty * 0.12)), random);
  return {
    id: serial,
    spu,
    skuCode: `SKU${String(1000000 + serial).slice(-7)}`,
    productName: spu.productName,
    brandName: spu.brandName,
    categoryCode: spu.categoryCode,
    categoryName: spu.categoryLabel,
    colorName: pickProfileCode(runtime.profile, "color_name", random, [
      { code: "黑色", label: "黑色", weight: 20 },
      { code: "白色", label: "白色", weight: 20 },
      { code: "深空灰", label: "深空灰", weight: 18 },
      { code: "银色", label: "银色", weight: 18 },
      { code: "远峰蓝", label: "远峰蓝", weight: 12 },
      { code: "奶油杏", label: "奶油杏", weight: 12 },
    ], "黑色"),
    storageSpec,
    sizeSpec,
    packageSpec,
    barcode: `69${String(1000000000 + serial).slice(-10)}`,
    weightGrams: randomIntBetween(180, 3600, random),
    volumeCm3: randomIntBetween(220, 8800, random),
    listPrice: spu.marketPrice,
    salePrice: spu.salePrice,
    promoPrice,
    memberPrice,
    stockQty,
    lockedStockQty,
    safetyStockQty: randomIntBetween(5, Math.max(10, Math.round(stockQty * 0.2)), random),
    shelfStatus: spu.shelfStatus,
    warehouseCode: `WH${String(400 + serial).slice(-3)}`,
    warehouseName,
    onlineTime: shiftTime(spu.launchDate || new Date(), randomIntBetween(60, 2400, random)),
  };
}

function buildInventoryFact(serial, random, runtime, startedAt) {
  const sku = pickFactByIndex(runtime.skuFacts, serial - 1);
  const availableQty = Math.max(1, randomIntBetween(12, sku?.stockQty || 100, random));
  const reservedQty = randomIntBetween(0, Math.max(2, Math.round(availableQty * 0.15)), random);
  const inTransitQty = randomIntBetween(0, Math.max(1, Math.round(availableQty * 0.18)), random);
  const damagedQty = randomIntBetween(0, Math.max(1, Math.round(availableQty * 0.02)), random);
  return {
    id: serial,
    sku,
    snapshotDate: new Date(startedAt.getTime() - serial * 24 * 60 * 60 * 1000),
    warehouseCode: sku?.warehouseCode || `WH${String(400 + serial).slice(-3)}`,
    warehouseName: sku?.warehouseName || "上海青浦中心仓",
    availableQty,
    reservedQty,
    inTransitQty,
    damagedQty,
    pendingPutawayQty: randomIntBetween(0, 12, random),
    cycleCountDiff: randomIntBetween(-3, 5, random),
    turnoverDays: randomIntBetween(8, 96, random),
    replenishmentStatus: pickProfileCode(runtime.profile, "replenishment_status", random, [
      { code: "正常", label: "正常", weight: 62 },
      { code: "需补货", label: "需补货", weight: 24 },
      { code: "在途补货", label: "在途补货", weight: 14 },
    ], "正常"),
    alertLevel: pickProfileCode(runtime.profile, "alert_level", random, [
      { code: "正常", label: "正常", weight: 68 },
      { code: "关注", label: "关注", weight: 22 },
      { code: "预警", label: "预警", weight: 10 },
    ], "正常"),
    supplierName: sku?.spu?.supplierName || "华东供应链中心",
    lastInboundTime: shiftTime(startedAt, -randomIntBetween(12, 160, random) * 60),
    lastOutboundTime: shiftTime(startedAt, -randomIntBetween(1, 72, random) * 60),
    stockAmount: Number((availableQty * (sku?.salePrice || 199)).toFixed(2)),
  };
}

function buildOrderItemFact(serial, random, runtime) {
  const order = pickFactByIndex(runtime.orderFacts, serial - 1);
  const sku = order?.sku || pickFactByIndex(runtime.skuFacts, serial - 1);
  const quantity = order?.itemQuantity || randomIntBetween(1, 3, random);
  const unitPrice = sku?.salePrice || 199;
  const promoPrice = Number((unitPrice * randomNumberBetween(0.86, 0.99, random, 4)).toFixed(2));
  const itemAmount = Number((promoPrice * quantity).toFixed(2));
  const discountAmount = Number(((unitPrice - promoPrice) * quantity).toFixed(2));
  return {
    id: serial,
    order,
    sku,
    quantity,
    unitPrice,
    promoPrice,
    discountAmount,
    itemAmount,
    costAmount: Number(((sku?.spu?.costPrice || unitPrice * 0.7) * quantity).toFixed(2)),
    taxAmount: Number((itemAmount * 0.06).toFixed(2)),
    warehouseCode: sku?.warehouseCode || `WH${String(400 + serial).slice(-3)}`,
    deliveryMode: pickProfileCode(runtime.profile, "delivery_mode", random, ECOMMERCE_DELIVERY_MODES, "快递配送"),
    refundFlag: ["退款中", "退款成功"].includes(order?.orderStatus) ? 1 : 0,
    qualityFlag: serial % 36 === 0 ? 1 : 0,
  };
}

function buildRefundFact(serial, random, runtime) {
  const order = pickFactByIndex(runtime.orderFacts, serial - 1);
  const payment = pickFactByIndex(runtime.paymentFacts, serial - 1);
  const reason = pickProfileCode(runtime.profile, "refund_reason", random, ECOMMERCE_REFUND_REASONS, "七天无理由");
  const refundStatus = pickProfileCode(runtime.profile, "refund_status", random, ECOMMERCE_REFUND_STATUS, order?.orderStatus === "退款成功" ? "退款成功" : "待审核");
  const ratio = reason === "七天无理由" ? randomNumberBetween(0.82, 1, random, 4) : randomNumberBetween(0.35, 0.92, random, 4);
  const refundAmount = Number(((payment?.payAmount || order?.netAmount || 99) * ratio).toFixed(2));
  const applyTime = shiftTime(order?.completeTime || order?.shipTime || order?.payTime || order?.orderTime || new Date(), randomIntBetween(360, 24 * 60 * 8, random));
  return {
    id: serial,
    order,
    payment,
    refundNo: `RF${String(2026000000 + serial)}`,
    refundReason: reason,
    refundStatus,
    refundAmount,
    applyTime,
    approveTime: shiftTime(applyTime, randomIntBetween(30, 360, random)),
    completeTime: shiftTime(applyTime, randomIntBetween(120, 960, random)),
    applicantName: order?.consigneeName || `申请人${serial}`,
    auditName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "赵"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "宁"}`,
    itemCount: order?.itemQuantity || 1,
    logisticsBackFlag: reason === "七天无理由" ? 1 : 0,
    returnWarehouseCode: payment?.payStatus === "支付成功" ? (pickFactByIndex(runtime.skuFacts, serial - 1)?.warehouseCode || "WH001") : "WH001",
    returnTrackingNo: `RT${String(5000000000 + serial)}`,
    disputeFlag: serial % 28 === 0 ? 1 : 0,
  };
}

function buildDeliveryFact(serial, random, runtime) {
  const order = pickFactByIndex(runtime.orderFacts, serial - 1);
  const item = pickFactByIndex(runtime.itemFacts, serial - 1);
  const warehouseName = item?.sku?.warehouseName || "上海青浦中心仓";
  const courierCompany = pickProfileCode(runtime.profile, "courier_company", random, ECOMMERCE_COURIERS, "顺丰速运");
  const dispatchTime = order?.shipTime || shiftTime(order?.payTime || order?.orderTime || new Date(), randomIntBetween(30, 260, random));
  const firstPickupTime = shiftTime(dispatchTime, randomIntBetween(20, 180, random));
  const deliveredTime = shiftTime(firstPickupTime, randomIntBetween(360, 3600, random));
  const signedTime = order?.completeTime || shiftTime(deliveredTime, randomIntBetween(30, 360, random));
  return {
    id: serial,
    order,
    deliveryNo: `DL${String(2026000000 + serial)}`,
    warehouseCode: item?.warehouseCode || "WH001",
    warehouseName,
    courierCompany,
    trackingNo: `SF${String(6000000000 + serial)}`,
    deliveryStatus: order?.deliveryStatus || pickProfileCode(runtime.profile, "delivery_status", random, ECOMMERCE_DELIVERY_STATUS, "运输中"),
    dispatchTime,
    firstPickupTime,
    deliveredTime,
    signedTime,
    consigneeName: order?.consigneeName || `收货人${serial}`,
    consigneeMobile: order?.consigneeMobile || buildMainlandMobile(40000 + serial, random),
    destinationProvince: order?.provinceCode || "310000",
    destinationCity: order?.cityCode || "310000",
    destinationDistrict: order?.cityCode || "310000",
    routeName: pickProfileCode(runtime.profile, "route_name", random, [
      { code: "华东次晨达", label: "华东次晨达", weight: 30 },
      { code: "长三角干线", label: "长三角干线", weight: 24 },
      { code: "华南航空件", label: "华南航空件", weight: 18 },
      { code: "同城即时履约", label: "同城即时履约", weight: 28 },
    ], "华东次晨达"),
    packageCount: Math.max(1, order?.itemQuantity || 1),
    packageWeight: randomNumberBetween(0.35, 12.8, random),
    abnormalFlag: order?.deliveryStatus === "配送异常" ? 1 : 0,
  };
}

function buildLicensePlate(cityCode, serial, random) {
  const prefixMap = {
    "310000": "沪A",
    "330100": "浙A",
    "320100": "苏A",
    "440300": "粤B",
    "510100": "川A",
  };
  const prefix = prefixMap[cityCode] || "沪A";
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const tail = `${letters[Math.floor(random() * letters.length)]}${String(10000 + serial).slice(-5)}`;
  return `${prefix}${tail}`;
}

function pickFirst(items, fallback = null) {
  return Array.isArray(items) && items.length > 0 ? items[0] : fallback;
}

function buildTrafficVehicleFact(serial, random, runtime) {
  const owner = pickFactByIndex(runtime.ownerFacts, serial - 1);
  const profile = runtime.profile;
  const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
  const city = owner?.city || pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "上海市" });
  const vehicleTypes = Array.isArray(profile.vehicleTypes) && profile.vehicleTypes.length > 0 ? profile.vehicleTypes : TRAFFIC_VEHICLE_TYPES;
  const weightedVehicleTypes = applyWeightOverride(vehicleTypes, getDistributionRuleConfig(profile, "vehicle_type_ratio"));
  const vehicleType = pickWeighted(weightedVehicleTypes, random) || pickFirst(vehicleTypes, { code: "SEDAN", label: "小型客车" });
  const brandCatalog = {
    SEDAN: ["大众", "丰田", "本田", "别克"],
    SUV: ["理想", "比亚迪", "特斯拉", "坦克"],
    NEW_ENERGY: ["比亚迪", "特斯拉", "蔚来", "小鹏"],
    TRUCK: ["东风", "解放", "陕汽", "福田"],
    BUS: ["宇通", "金龙", "中通客车", "比亚迪"],
  };
  const brandName = pickOne(brandCatalog[vehicleType.code] || ["大众"], random) || "大众";
  return {
    id: serial,
    ownerId: owner?.id || serial,
    plateNo: buildLicensePlate(city.code, serial, random),
    vehicleType: vehicleType.code,
    ownerName: owner?.ownerName || `车主${serial}`,
    registerCityCode: city.code,
    registerCityName: city.name,
    ownerMobile: owner?.ownerMobile || buildMainlandMobile(50000 + serial, random),
    brandName,
    modelName: `${brandName}${pickOne(["旗舰版", "豪华版", "标准版", "智享版"], random) || "标准版"}`,
    fuelType: pickProfileCode(profile, "fuel_type", random, TRAFFIC_FUEL_TYPES, "汽油"),
    colorName: pickProfileCode(profile, "color_name", random, [
      { code: "黑色", label: "黑色", weight: 28 },
      { code: "白色", label: "白色", weight: 24 },
      { code: "银色", label: "银色", weight: 20 },
      { code: "蓝色", label: "蓝色", weight: 16 },
      { code: "灰色", label: "灰色", weight: 12 },
    ], "白色"),
    seatCount: vehicleType.code === "BUS" ? randomIntBetween(20, 55, random) : vehicleType.code === "TRUCK" ? randomIntBetween(2, 3, random) : randomIntBetween(4, 7, random),
    loadCapacity: vehicleType.code === "TRUCK" ? randomNumberBetween(3.5, 18, random) : randomNumberBetween(0.4, 1.8, random),
    plateIssueOrg: `${city.name}公安局交通警察支队车辆管理所`,
    registeredAt: new Date(Date.now() - serial * 7 * 24 * 60 * 60 * 1000),
    annualInspectionDue: new Date(Date.now() + randomIntBetween(20, 300, random) * 24 * 60 * 60 * 1000),
    insuranceStatus: pickProfileCode(profile, "insurance_status", random, TRAFFIC_INSURANCE_STATUS, "有效"),
    operationType: pickProfileCode(profile, "operation_type", random, TRAFFIC_OPERATION_TYPES, "非营运"),
    deviceId: `DEV${String(400000 + serial)}`,
  };
}

function buildTrafficOwnerFact(serial, random, profile) {
  const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
  const city = pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "上海市" });
  const familyName = pickOne(CUSTOMER_FAMILY_NAMES, random) || "张";
  const givenName = `${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "悦"}`;
  const ownerName = `${familyName}${givenName}`;
  return {
    id: serial,
    ownerCode: `OWNER${String(100000 + serial).slice(-6)}`,
    ownerName,
    gender: serial % 2 === 0 ? "女" : "男",
    idCardNo: buildMainlandIdCard(city.code, new Date(1985 + (serial % 18), serial % 12, (serial % 27) + 1), serial, serial % 2 === 0 ? "F" : "M"),
    ownerMobile: buildMainlandMobile(100000 + serial, random),
    ownerEmail: buildDomesticEmail(serial, random, "car"),
    city,
    occupationName: pickOne(["个体经营", "企业员工", "平台司机", "物流司机", "公务员"], random) || "企业员工",
    driverLicenseType: pickOne(["C1", "C2", "B2", "A1"], random) || "C1",
  };
}

function buildTrafficViolationFact(serial, random, runtime, startedAt) {
  const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
  const owner = runtime.ownerFacts.get(vehicle?.ownerId) || pickFactByIndex(runtime.ownerFacts, serial - 1);
  const violationCodes = Array.isArray(runtime.profile.violationCodes) && runtime.profile.violationCodes.length > 0 ? runtime.profile.violationCodes : TRAFFIC_VIOLATION_CODES;
  const weightedCodes = applyWeightOverride(violationCodes, getDistributionRuleConfig(runtime.profile, "violation_code_ratio"));
  const violationCode = pickWeighted(weightedCodes, random) || pickFirst(violationCodes, { code: "1302", label: "违法停车", fineRange: [50, 200], points: 0 });
  const violationStatuses = Array.isArray(runtime.profile.violationStatuses) && runtime.profile.violationStatuses.length > 0 ? runtime.profile.violationStatuses : TRAFFIC_VIOLATION_STATUS;
  const weightedStatuses = applyWeightOverride(violationStatuses, getDistributionRuleConfig(runtime.profile, "violation_status_ratio"));
  const status = pickWeighted(weightedStatuses, random)?.code || "已缴款";
  const fineRange = pickRangeValue(violationCode.fineRange, [100, 200]);
  const points = Number(violationCode.points ?? 0);
  return {
    id: serial,
    vehicleId: vehicle?.id || serial,
    ownerId: owner?.id || serial,
    violationNo: `WF${String(2026000000 + serial)}`,
    plateNo: vehicle?.plateNo || buildLicensePlate("310000", serial, random),
    vehicleType: vehicle?.vehicleType || "SEDAN",
    violationCode: violationCode.code,
    violationDesc: violationCode.label,
    violationPoints: points,
    fineAmount: randomNumberBetween(fineRange[0], fineRange[1], random),
    roadName: pickOne(runtime.profile.roadNames, random) || "世纪大道",
    directionName: pickOne(["东向西", "西向东", "南向北", "北向南"], random) || "东向西",
    cameraName: pickOne(["电子警察", "高清卡口", "违法抓拍球机", "综合监测杆"], random) || "电子警察",
    violationStatus: status,
    captureTime: new Date(startedAt.getTime() - serial * 35 * 60 * 1000),
    noticeTime: new Date(startedAt.getTime() - serial * 33 * 60 * 1000),
    handleDeadline: new Date(startedAt.getTime() + 15 * 24 * 60 * 60 * 1000),
    lawBasis: "依据《道路交通安全法》及相关配套规定处理",
    officerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}警官`,
    ownerName: owner?.ownerName || `车主${serial}`,
    ownerMobile: owner?.ownerMobile || buildMainlandMobile(60000 + serial, random),
  };
}

function buildTrafficInspectionFact(serial, random, runtime, startedAt) {
  const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
  const inspectionResults = Array.isArray(runtime.profile.inspectionResults) && runtime.profile.inspectionResults.length > 0 ? runtime.profile.inspectionResults : TRAFFIC_INSPECTION_RESULTS;
  const weightedResults = applyWeightOverride(inspectionResults, getDistributionRuleConfig(runtime.profile, "inspection_result_ratio"));
  const result = pickWeighted(weightedResults, random)?.code || "正常放行";
  const officerName = `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}警官`;
  return {
    id: serial,
    vehicleId: vehicle?.id || serial,
    stationName: pickOne(runtime.profile.stationNames, random) || "延安高架检查站",
    roadName: pickOne(runtime.profile.roadNames, random) || "世纪大道",
    laneNo: `第${(serial % 6) + 1}车道`,
    plateNo: vehicle?.plateNo || buildLicensePlate("310000", serial, random),
    vehicleType: vehicle?.vehicleType || "SEDAN",
    officerName,
    assistOfficerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "周"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "琪"}警官`,
    inspectionResult: result,
    problemCode: result === "正常放行" ? "NONE" : `CHK-${String(100 + serial).slice(-3)}`,
    problemDesc: result === "正常放行" ? "证照齐全，予以放行" : pickOne(["驾驶人未按规定携带证件", "营运标识不完整", "车身反光标识破损"], random) || "驾驶人未按规定携带证件",
    inspectionTime: new Date(startedAt.getTime() - serial * 28 * 60 * 1000),
    releaseTime: new Date(startedAt.getTime() - serial * 25 * 60 * 1000),
    bodyCameraNo: `BWC${String(100000 + serial)}`,
    evidenceNo: `EV${String(200000 + serial)}`,
  };
}

function buildTrafficDriverTrainingFact(serial, random, runtime, startedAt) {
  const owner = pickFactByIndex(runtime.ownerFacts, serial - 1);
  const subject = pickOne([
    { code: "KM1", label: "科目一" },
    { code: "KM2", label: "科目二" },
    { code: "KM3", label: "科目三" },
    { code: "KM4", label: "科目四" },
  ], random) || { code: "KM1", label: "科目一" };
  const trainingStatus = pickOne(["报名中", "学习中", "待考试", "已完成"], random) || "学习中";
  const enrolledTime = new Date(startedAt.getTime() - serial * 9 * 24 * 60 * 60 * 1000);
  const plannedExamTime = shiftTime(enrolledTime, randomIntBetween(7 * 24 * 60, 40 * 24 * 60, random));
  const completedTime = trainingStatus === "已完成" ? shiftTime(plannedExamTime, randomIntBetween(1 * 24 * 60, 10 * 24 * 60, random)) : null;
  const totalHours = Number((16 + random() * 48).toFixed(1));
  const validHours = Number((Math.max(12, totalHours - random() * 6)).toFixed(1));
  const attendanceRate = Number((0.82 + random() * 0.18).toFixed(4));
  return {
    id: serial,
    trainingNo: `JX${String(2026000000 + serial)}`,
    schoolName: pickOne(["浦东机动车驾驶员培训中心", "虹桥驾驶培训学校", "西湖机动车培训学校", "江宁驾驶员学习中心"], random) || "浦东机动车驾驶员培训中心",
    coachName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "张"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "明"}教练`,
    coachMobile: buildMainlandMobile(61000 + serial, random),
    trainingVehicleNo: buildLicensePlate(owner?.city?.code || "310000", 9000 + serial, random),
    trainingLicenseType: owner?.driverLicenseType || pickOne(["C1", "C2", "B2", "A1"], random) || "C1",
    subjectCode: subject.code,
    trainingStatus,
    enrolledTime,
    plannedExamTime,
    completedTime,
    totalHours,
    validHours,
    attendanceRate,
    examScore: Number((68 + random() * 30).toFixed(1)),
    examResult: trainingStatus === "已完成" ? (random() > 0.18 ? "通过" : "未通过") : "未考核",
    archiveStatus: trainingStatus === "已完成" ? "已归档" : "待归档",
    remark: `${subject.label}学习记录已同步驾培台账`,
    owner,
  };
}

function buildTrafficCheckpointPassFact(serial, random, runtime, startedAt) {
  const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
  const owner = runtime.ownerFacts.get(vehicle?.ownerId) || pickFactByIndex(runtime.ownerFacts, serial - 1);
  const checkpointName = pickOne(runtime.profile.stationNames, random) || "虹桥枢纽卡口";
  const limitSpeed = pickOne([60, 80, 100, 120], random) || 80;
  const passSpeed = Number((Math.max(20, limitSpeed - 10 + random() * 35)).toFixed(1));
  const hasAlert = passSpeed > limitSpeed || serial % 19 === 0;
  return {
    id: serial,
    passNo: `GK${String(2026000000 + serial)}`,
    checkpointCode: `CP${String(100000 + serial).slice(-6)}`,
    checkpointName,
    laneNo: `车道${(serial % 6) + 1}`,
    directionName: pickOne(["东向西", "西向东", "南向北", "北向南"], random) || "东向西",
    plateNo: vehicle?.plateNo || buildLicensePlate("310000", serial, random),
    vehicleType: vehicle?.vehicleType || "SEDAN",
    plateColor: pickOne(["蓝牌", "黄牌", "绿牌"], random) || "蓝牌",
    passTime: new Date(startedAt.getTime() - serial * 18 * 60 * 1000),
    passSpeed,
    limitSpeed,
    passResult: hasAlert ? (serial % 5 === 0 ? "人工复核" : "异常预警") : "正常过车",
    plateMatchFlag: serial % 23 === 0 ? 1 : 0,
    violationFlag: hasAlert ? 1 : 0,
    captureDeviceNo: `CAM${String(300000 + serial)}`,
    imageUri: `https://mock.local/traffic/checkpoint/${serial}.jpg`,
    travelDirection: pickOne(["进城", "出城", "快速通行", "辅道通行"], random) || "进城",
    remark: `${checkpointName}卡口已记录本次过车事件`,
    vehicle,
    owner,
  };
}

function buildTrafficRegistrationFact(serial, random, runtime, startedAt) {
  const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
  const owner = pickFactByIndex(runtime.ownerFacts, serial - 1);
  return {
    id: serial,
    registrationNo: `DJ${String(2026000000 + serial)}`,
    registrationType: pickOne(["新车注册", "转移登记", "变更登记"], random) || "新车注册",
    registerOrgName: `${owner?.city?.name || "上海"}车管所`,
    approvalStatus: pickOne(["已办结", "待审核", "补充材料"], random) || "已办结",
    time: new Date(startedAt.getTime() - serial * 5 * 24 * 60 * 60 * 1000),
    vehicle,
    owner,
  };
}

function buildTrafficPaymentFact(serial, random, runtime, startedAt) {
  const violation = pickFactByIndex(runtime.violationFacts, serial - 1);
  const paidAmount = Number((violation?.fineAmount || 100).toFixed(2));
  return {
    id: serial,
    paymentNo: `JK${String(2026000000 + serial)}`,
    paymentChannel: pickProfileCode(runtime.profile, "payment_channel", random, TRAFFIC_PAYMENT_CHANNELS, "支付宝"),
    paymentStatus: violation?.violationStatus === "已缴款" ? "缴款成功" : violation?.violationStatus === "已撤销" ? "已冲正" : "待缴款",
    bankName: pickOne(["中国银行", "中国工商银行", "建设银行"], random) || "中国银行",
    payerName: violation?.ownerName || `缴款人${serial}`,
    payerMobile: violation?.ownerMobile || buildMainlandMobile(70000 + serial, random),
    receiptNo: `PZ${String(300000 + serial)}`,
    refundFlag: serial % 15 === 0 ? 1 : 0,
    reconcileStatus: "已对账",
    paymentTime: new Date(startedAt.getTime() - serial * 70 * 60 * 1000),
    settlementTime: new Date(startedAt.getTime() - serial * 68 * 60 * 1000),
    violation,
    paidAmount,
  };
}

function buildTrafficAccidentFact(serial, random, runtime, startedAt) {
  const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
  return {
    id: serial,
    accidentNo: `SG${String(2026000000 + serial)}`,
    accidentType: pickOne(["追尾事故", "剐蹭事故", "单车事故", "路口碰撞"], random) || "追尾事故",
    accidentLevel: pickProfileCode(runtime.profile, "accident_level", random, TRAFFIC_ACCIDENT_LEVELS, "一般事故"),
    roadName: pickOne(runtime.profile.roadNames, random) || "世纪大道",
    weatherDesc: pickOne(["晴", "多云", "小雨"], random) || "晴",
    roadCondition: pickOne(["干燥", "湿滑", "拥堵"], random) || "干燥",
    injuryCount: serial % 10 === 0 ? 1 : 0,
    deathCount: 0,
    lossAmount: Number((2000 + random() * 30000).toFixed(2)),
    liabilityType: pickOne(["全责", "主责", "同责"], random) || "全责",
    caseStatus: pickProfileCode(runtime.profile, "case_status", random, TRAFFIC_CASE_STATUS, "处理中"),
    occurTime: new Date(startedAt.getTime() - serial * 80 * 60 * 1000),
    reportTime: new Date(startedAt.getTime() - serial * 79 * 60 * 1000),
    closeTime: new Date(startedAt.getTime() - serial * 40 * 60 * 1000),
    handleOfficer: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}警官`,
    vehicle,
  };
}

function buildTrafficDispatchFact(serial, random, runtime, startedAt) {
  const accident = pickFactByIndex(runtime.accidentFacts, serial - 1);
  const vehicle = accident?.vehicle || pickFactByIndex(runtime.vehicleFacts, serial - 1);
  return {
    id: serial,
    dispatchNo: `PD${String(2026000000 + serial)}`,
    dispatchType: accident ? "事故处置" : "违法处置",
    dispatchStatus: pickOne(["已完成", "处理中", "待接单"], random) || "已完成",
    stationName: pickOne(runtime.profile.stationNames, random) || "世纪大道执法岗",
    targetRoadName: pickOne(runtime.profile.roadNames, random) || "世纪大道",
    dutyTeamName: pickOne(["一大队", "二大队", "机动中队"], random) || "一大队",
    leaderName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "王"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "涛"}警官`,
    officerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "陈"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "琪"}警官`,
    dispatchTime: new Date(startedAt.getTime() - serial * 90 * 60 * 1000),
    acceptTime: new Date(startedAt.getTime() - serial * 88 * 60 * 1000),
    arriveTime: new Date(startedAt.getTime() - serial * 84 * 60 * 1000),
    finishTime: new Date(startedAt.getTime() - serial * 60 * 60 * 1000),
    priorityLevel: pickOne(["高", "中", "普通"], random) || "中",
    sourceChannel: pickProfileCode(runtime.profile, "source_channel", random, TRAFFIC_SOURCE_CHANNELS, "现场发现"),
    accident,
    vehicle,
  };
}

function buildTrafficPatrolFact(serial, random, runtime, startedAt) {
  const dispatch = pickFactByIndex(runtime.dispatchFacts, serial - 1);
  return {
    id: serial,
    logNo: `XL${String(2026000000 + serial)}`,
    stationName: dispatch?.stationName || pickOne(runtime.profile.stationNames, random) || "延安高架检查站",
    roadName: dispatch?.targetRoadName || pickOne(runtime.profile.roadNames, random) || "世纪大道",
    checkpointName: pickOne(runtime.profile.stationNames, random) || "虹桥枢纽卡口",
    officerName: dispatch?.officerName || `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "周"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "轩"}警官`,
    eventType: pickOne(["巡逻发现违停", "例行检查", "高峰疏导", "事故处置回访"], random) || "例行检查",
    eventResult: pickOne(["已处理", "持续关注", "转派处置"], random) || "已处理",
    eventTime: new Date(startedAt.getTime() - serial * 30 * 60 * 1000),
    gpsTrackId: `GPS${String(500000 + serial)}`,
    longitude: Number((121.30 + random() * 0.25).toFixed(6)),
    latitude: Number((31.15 + random() * 0.25).toFixed(6)),
    dispatch,
  };
}

function buildTrafficDocumentFact(serial, random, runtime, startedAt) {
  const violation = pickFactByIndex(runtime.violationFacts, serial - 1);
  const inspection = pickFactByIndex(runtime.inspectionFacts, serial - 1);
  return {
    id: serial,
    documentNo: `WS${String(2026000000 + serial)}`,
    documentType: pickProfileCode(runtime.profile, "document_type", random, TRAFFIC_DOCUMENT_TYPES, "违法处理通知书"),
    issueOrgName: `${pickOne(CITY_OPTIONS, random)?.name || "上海"}交警支队`,
    issueTime: new Date(startedAt.getTime() - serial * 75 * 60 * 1000),
    serveTime: new Date(startedAt.getTime() - serial * 70 * 60 * 1000),
    serveMode: pickOne(["现场送达", "邮寄送达", "电子送达"], random) || "现场送达",
    signStatus: pickOne(["已签收", "拒签", "待送达"], random) || "已签收",
    appealFlag: serial % 12 === 0 ? "已申诉" : "未申诉",
    archiveNo: `ARC${String(600000 + serial)}`,
    violation,
    inspection,
  };
}

function buildBankBranchFact(serial, random, profile) {
  const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
  const institutionNames = Array.isArray(profile.institutionNames) && profile.institutionNames.length > 0 ? profile.institutionNames : ["中国银行"];
  const branchTypes = Array.isArray(profile.branchTypes) && profile.branchTypes.length > 0 ? profile.branchTypes : BANK_BRANCH_TYPES;
  const city = pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "上海市" });
  const institutionName = pickOne(institutionNames, random) || pickFirst(institutionNames, "中国银行");
  const branchType = pickWeighted(branchTypes, random) || pickFirst(branchTypes, { code: "营业部", label: "营业部" });
  return {
    id: serial,
    branchCode: `BR${city.code.slice(-2)}${String(1000 + serial).slice(-4)}`,
    branchName: `${institutionName}${city.name}${branchType.label}`,
    branchType: branchType.code,
    regionCode: city.code,
    establishedAt: new Date(Date.now() - serial * 30 * 24 * 60 * 60 * 1000),
  };
}

function buildBankReportFact(serial, random, runtime, startedAt) {
  const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
  const reportCodePool = Array.isArray(runtime.profile.reportCodes) && runtime.profile.reportCodes.length > 0 ? runtime.profile.reportCodes : BANK_REPORT_CODES;
  const weightedReportCodes = applyWeightOverride(reportCodePool, getDistributionRuleConfig(runtime.profile, "report_code_ratio"));
  const reportCode = pickWeighted(weightedReportCodes, random) || reportCodePool[0] || { code: "1104-G01", label: "资产质量报送" };
  const reportStatusPool = Array.isArray(runtime.profile.reportStatuses) && runtime.profile.reportStatuses.length > 0 ? runtime.profile.reportStatuses : BANK_REPORT_STATUS;
  const weightedReportStatuses = applyWeightOverride(reportStatusPool, getDistributionRuleConfig(runtime.profile, "report_status_ratio"));
  const reportStatus = pickWeighted(weightedReportStatuses, random)?.code || "已提交";
  const totalAssetsBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "total_assets_band"), [5e8, 8e9]);
  const loanBalanceBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "loan_balance_band"), [2e8, 5e9]);
  const capitalBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "capital_ratio_band"), [10.5, 16.5]);
  const liquidityBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "liquidity_ratio_band"), [120, 220]);
  const nplBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "npl_ratio_band"), [0.8, 2.8]);
  const tier1Band = pickRangeValue(getDistributionRuleConfig(runtime.profile, "tier1_capital_ratio_band"), [8.5, 13.5]);
  const coreTier1Band = pickRangeValue(getDistributionRuleConfig(runtime.profile, "core_tier1_ratio_band"), [7.5, 12.5]);
  const provisionBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "provision_coverage_band"), [160, 320]);
  const exposureBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "large_exposure_ratio_band"), [8, 28]);
  const depositBand = pickRangeValue(getDistributionRuleConfig(runtime.profile, "deposit_balance_band"), [3e8, 5e9]);
  const reportFreq = pickProfileCode(runtime.profile, "report_freq", random, BANK_REPORT_FREQUENCY, "季报");
  const submitTime = new Date(startedAt.getTime() - serial * 12 * 60 * 60 * 1000);
  return {
    id: serial,
    branchId: branch?.id || serial,
    reportCode: reportCode.code,
    reportName: reportCode.label,
    reportPeriod: formatPeriod(submitTime, reportFreq),
    reportFreq,
    totalAssets: randomNumberBetween(totalAssetsBand[0], totalAssetsBand[1], random),
    loanBalance: randomNumberBetween(loanBalanceBand[0], loanBalanceBand[1], random),
    depositBalance: randomNumberBetween(depositBand[0], depositBand[1], random),
    capitalAdequacyRatio: randomNumberBetween(capitalBand[0], capitalBand[1], random),
    tier1CapitalRatio: randomNumberBetween(tier1Band[0], tier1Band[1], random),
    coreTier1Ratio: randomNumberBetween(coreTier1Band[0], coreTier1Band[1], random),
    liquidityCoverageRatio: randomNumberBetween(liquidityBand[0], liquidityBand[1], random),
    nplRatio: randomNumberBetween(nplBand[0], nplBand[1], random),
    provisionCoverageRatio: randomNumberBetween(provisionBand[0], provisionBand[1], random),
    largeExposureRatio: randomNumberBetween(exposureBand[0], exposureBand[1], random),
    reportStatus,
    submitTime,
    receiveTime: shiftTime(submitTime, randomIntBetween(10, 180, random)),
  };
}

function buildBankIssueFact(serial, random, runtime, startedAt) {
  const report = pickFactByIndex(runtime.reportFacts, serial - 1);
  const issueTypePool = Array.isArray(runtime.profile.issueTypes) && runtime.profile.issueTypes.length > 0 ? runtime.profile.issueTypes : BANK_ISSUE_TYPES;
  const weightedIssueTypes = applyWeightOverride(issueTypePool, getDistributionRuleConfig(runtime.profile, "issue_type_ratio"));
  const issueType = pickWeighted(weightedIssueTypes, random) || issueTypePool[0];
  const issueLevelPool = Array.isArray(runtime.profile.issueLevels) && runtime.profile.issueLevels.length > 0 ? runtime.profile.issueLevels : BANK_ISSUE_LEVELS;
  const weightedIssueLevels = applyWeightOverride(issueLevelPool, getDistributionRuleConfig(runtime.profile, "issue_level_ratio"));
  const issueLevel = pickWeighted(weightedIssueLevels, random)?.code || "一般";
  const checkerName = `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "王"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "涛"}专员`;
  const identifiedAt = new Date(startedAt.getTime() - serial * 6 * 60 * 60 * 1000);
  return {
    id: serial,
    reportId: report?.id || serial,
    caseNo: `CASE${String(600000 + serial)}`,
    issueType: issueType.code,
    issueLevel,
    disposalStatus: pickProfileCode(runtime.profile, "disposal_status", random, BANK_DISPOSAL_STATUS, "整改中"),
    checkerName,
    ownerDepartment: pickOne(["风险管理部", "数据管理部", "监管报送部", "反洗钱中心"], random) || "监管报送部",
    issueDesc: `${issueType.label || issueType.code}，需在监管时限内完成复核与补正`,
    identifiedAt,
    dueAt: shiftTime(identifiedAt, randomIntBetween(24 * 60, 24 * 60 * 15, random)),
    disposedAt: shiftTime(identifiedAt, randomIntBetween(2 * 24 * 60, 20 * 24 * 60, random)),
  };
}

function buildBankInstitutionFact(serial, random, profile) {
  const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
  const institutionNames = Array.isArray(profile.institutionNames) && profile.institutionNames.length > 0 ? profile.institutionNames : ["中国银行"];
  const city = pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "上海市" });
  const institutionName = pickOne(institutionNames, random) || pickFirst(institutionNames, "中国银行");
  const isStateOwnedBank = /工商|建设|农业|中国银行|交通/.test(institutionName);
  const institutionType = isStateOwnedBank
    ? "国有大型银行分支机构"
    : /招商/.test(institutionName)
      ? "股份制商业银行分支机构"
      : "商业银行分支机构";
  const legalInstitutionName = isStateOwnedBank
    ? `${institutionName}${city.name}分行`
    : `${institutionName.replace(/股份有限公司/g, "")}股份有限公司${city.name}分行`;
  const establishedAt = new Date(getRuntimeBaseTime({ baseTime: profile?.baseTime }).getTime() - randomIntBetween(6 * 365, 28 * 365, random) * 24 * 60 * 60 * 1000);
  return {
    id: serial,
    institutionCode: `INST${String(100000 + serial).slice(-6)}`,
    institutionName: legalInstitutionName,
    institutionType,
    licenseNo: `JX${String(3000000000 + serial)}`,
    orgCode: `91310${String(100000000 + serial)}`,
    city,
    regulatorName: `国家金融监督管理总局${city.name}监管局`,
    institutionStatus: "正常经营",
    establishedAt,
    businessStartAt: new Date(establishedAt.getTime() + randomIntBetween(30, 360, random) * 24 * 60 * 60 * 1000),
    registeredCapital: Number((5e8 + random() * 3e9).toFixed(2)),
    employeeCount: randomIntBetween(420, 3600, random),
  };
}

function buildBankBranchDetailFact(serial, random, runtime) {
  const institution = pickFactByIndex(runtime.institutionFacts, serial - 1);
  const cityOptions = Array.isArray(runtime.profile.cities) && runtime.profile.cities.length > 0 ? runtime.profile.cities : CITY_OPTIONS;
  const city = institution?.city || pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "上海市" });
  const branchTypePool = Array.isArray(runtime.profile.branchTypes) && runtime.profile.branchTypes.length > 0 ? runtime.profile.branchTypes : BANK_BRANCH_TYPES;
  const branchType = pickWeighted(branchTypePool, random) || branchTypePool[0];
  const establishedAt = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(1 * 365, 18 * 365, random) * 24 * 60 * 60 * 1000);
  const institutionNames = Array.isArray(runtime.profile.institutionNames) && runtime.profile.institutionNames.length > 0 ? runtime.profile.institutionNames : ["中国银行"];
  const institutionName = String(institution?.institutionName || pickOne(institutionNames, random) || pickFirst(institutionNames, "中国银行") || "").trim();
  const branchNameBase = institutionName.includes(city.name) ? institutionName : `${institutionName}${city.name}`;
  return {
    id: serial,
    branchCode: `BR${String(200000 + serial).slice(-6)}`,
    branchName: `${branchNameBase}${branchType.label}`,
    branchType: branchType.code,
    regionCode: city.code,
    regionName: city.name,
    governanceLevel: pickProfileCode(runtime.profile, "governance_level", random, [
      { code: "一级经营单元", label: "一级经营单元", weight: 38 },
      { code: "二级经营单元", label: "二级经营单元", weight: 42 },
      { code: "三级经营单元", label: "三级经营单元", weight: 20 },
    ], "一级经营单元"),
    reportingFlag: pickProfileCode(runtime.profile, "reporting_flag", random, [
      { code: "纳入报送", label: "纳入报送", weight: 94 },
      { code: "观察名单", label: "观察名单", weight: 6 },
    ], "纳入报送"),
    establishedAt,
    assetScale: Number((8e8 + random() * 4e9).toFixed(2)),
    loanScale: Number((5e8 + random() * 2.5e9).toFixed(2)),
    depositScale: Number((6e8 + random() * 3e9).toFixed(2)),
    contactName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}`,
    contactMobile: buildMainlandMobile(80000 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
    contactEmail: buildDomesticEmail(serial, random, "branch"),
    institution,
  };
}

function buildBankContactFact(serial, random, runtime) {
  const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
  return {
    id: serial,
    contactName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "周"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "宇"}`,
    contactRole: pickProfileCode(runtime.profile, "contact_role", random, [
      { code: "监管报送专员", label: "监管报送专员", weight: 38 },
      { code: "风险管理专员", label: "风险管理专员", weight: 26 },
      { code: "合规经理", label: "合规经理", weight: 22 },
      { code: "反洗钱专员", label: "反洗钱专员", weight: 14 },
    ], "监管报送专员"),
    contactMobile: buildMainlandMobile(90000 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
    contactEmail: buildDomesticEmail(serial, random, "report"),
    departmentName: pickProfileCode(runtime.profile, "department_name", random, [
      { code: "风险管理部", label: "风险管理部", weight: 30 },
      { code: "合规管理部", label: "合规管理部", weight: 24 },
      { code: "监管报送部", label: "监管报送部", weight: 30 },
      { code: "反洗钱中心", label: "反洗钱中心", weight: 16 },
    ], "监管报送部"),
    dutyScope: pickProfileCode(runtime.profile, "duty_scope", random, [
      { code: "审慎报表报送", label: "审慎报表报送", weight: 36 },
      { code: "EAST核查反馈", label: "EAST核查反馈", weight: 24 },
      { code: "问题单整改跟踪", label: "问题单整改跟踪", weight: 22 },
      { code: "反洗钱报送", label: "反洗钱报送", weight: 18 },
    ], "审慎报表报送"),
    primaryContactFlag: serial % 3 === 0 ? 0 : 1,
    officePhone: buildMainlandMobile(95000 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
    onboardTime: new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(60, 2200, random) * 24 * 60 * 60 * 1000),
    branch,
  };
}

function buildBankMetricFact(serial, random, runtime) {
  const report = pickFactByIndex(runtime.reportFacts, serial - 1);
  const metricCatalog = [
    { name: "资本充足率", category: "资本类", unit: "%" },
    { name: "一级资本充足率", category: "资本类", unit: "%" },
    { name: "核心一级资本充足率", category: "资本类", unit: "%" },
    { name: "不良贷款率", category: "资产质量类", unit: "%" },
    { name: "拨备覆盖率", category: "资产质量类", unit: "%" },
    { name: "流动性覆盖率", category: "流动性类", unit: "%" },
    { name: "大额风险暴露比例", category: "集中度类", unit: "%" },
  ];
  const metric = pickOne(metricCatalog, random) || metricCatalog[0];
  const metricValue = metric.name.includes("不良")
    ? randomNumberBetween(0.8, 2.8, random)
    : metric.name.includes("拨备")
      ? randomNumberBetween(180, 320, random)
      : metric.name.includes("流动性")
        ? randomNumberBetween(130, 200, random)
        : metric.name.includes("大额风险")
          ? randomNumberBetween(8, 28, random)
          : randomNumberBetween(8.5, 16, random);
  const warningThreshold = metric.name.includes("不良")
    ? 2.0
    : metric.name.includes("拨备")
      ? 180
      : metric.name.includes("流动性")
        ? 100
        : metric.name.includes("大额风险")
          ? 25
          : 10.5;
  const benchmarkValue = metric.name.includes("不良")
    ? 1.4
    : metric.name.includes("拨备")
      ? 240
      : metric.name.includes("流动性")
        ? 150
        : metric.name.includes("大额风险")
          ? 18
          : 12.2;
  return {
    id: serial,
    metricCode: `MT${String(1000 + serial)}`,
    metricName: metric.name,
    metricCategory: metric.category,
    metricValue,
    metricUnit: metric.unit,
    warningThreshold,
    benchmarkValue,
    warningFlag: metric.name.includes("不良") ? (metricValue > warningThreshold ? 1 : 0) : (metricValue < warningThreshold ? 1 : 0),
    metricStatus: metric.name.includes("不良")
      ? (metricValue > warningThreshold ? "预警" : "正常")
      : (metricValue < warningThreshold ? "预警" : "正常"),
    calculatedAt: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 4 * 60 * 60 * 1000),
    report,
  };
}

function buildBankRiskExposureFact(serial, random, runtime) {
  const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
  return {
    id: serial,
    snapshotPeriod: `2026-${String((serial % 12) + 1).padStart(2, "0")}`,
    creditRiskExposure: Number((2e8 + random() * 2e9).toFixed(2)),
    marketRiskExposure: Number((1e8 + random() * 8e8).toFixed(2)),
    operationalRiskExposure: Number((5e7 + random() * 5e8).toFixed(2)),
    liquidityGapAmount: Number((1e7 + random() * 2e8).toFixed(2)),
    concentrationRatio: Number((8 + random() * 25).toFixed(2)),
    riskLevel: pickProfileCode(runtime.profile, "risk_level", random, [
      { code: "正常", label: "正常", weight: 68 },
      { code: "关注", label: "关注", weight: 22 },
      { code: "预警", label: "预警", weight: 10 },
    ], "正常"),
    snapshotTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 24 * 60 * 60 * 1000),
    branch,
  };
}

function buildBankAlertFact(serial, random, runtime) {
  const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
  return {
    id: serial,
    alertNo: `AML${String(200000 + serial)}`,
    alertType: pickProfileCode(runtime.profile, "alert_type", random, [
      { code: "大额交易预警", label: "大额交易预警", weight: 42 },
      { code: "高频交易预警", label: "高频交易预警", weight: 24 },
      { code: "异常账户预警", label: "异常账户预警", weight: 18 },
      { code: "跨境资金预警", label: "跨境资金预警", weight: 16 },
    ], "大额交易预警"),
    transactionAmount: Number((3e5 + random() * 5e6).toFixed(2)),
    currencyCode: "CNY",
    counterpartyName: `${pickOne(BANK_INSTITUTION_NAMES, random) || "中国银行"}交易对手${serial}`,
    alertStatus: pickProfileCode(runtime.profile, "alert_status", random, BANK_ALERT_STATUS, "待核查"),
    reviewResult: pickProfileCode(runtime.profile, "review_result", random, BANK_REVIEW_RESULTS, "正常"),
    alertTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 2 * 60 * 60 * 1000),
    reviewTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 60 * 60 * 1000),
    branch,
  };
}

function buildBankTaskFact(serial, random, runtime) {
  const issue = pickFactByIndex(runtime.issueFacts, serial - 1);
  return {
    id: serial,
    taskNo: `ZG${String(300000 + serial)}`,
    taskType: pickProfileCode(runtime.profile, "task_type", random, [
      { code: "数据补录", label: "数据补录", weight: 34 },
      { code: "口径修正", label: "口径修正", weight: 26 },
      { code: "指标复核", label: "指标复核", weight: 22 },
      { code: "报送更正", label: "报送更正", weight: 18 },
    ], "数据补录"),
    taskStatus: pickProfileCode(runtime.profile, "task_status", random, BANK_TASK_STATUS, "整改中"),
    ownerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "王"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "琳"}`,
    ownerMobile: buildMainlandMobile(110000 + serial, random),
    ownerDepartment: pickProfileCode(runtime.profile, "department_name", random, [
      { code: "风险管理部", label: "风险管理部", weight: 34 },
      { code: "数据管理部", label: "数据管理部", weight: 22 },
      { code: "合规管理部", label: "合规管理部", weight: 24 },
      { code: "监管报送部", label: "监管报送部", weight: 20 },
    ], "风险管理部"),
    createTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 3 * 24 * 60 * 60 * 1000),
    startTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 2 * 24 * 60 * 60 * 1000),
    finishTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 24 * 60 * 60 * 1000),
    issue,
  };
}

function buildBankSubmissionLogFact(serial, random, runtime) {
  const report = pickFactByIndex(runtime.reportFacts, serial - 1);
  return {
    id: serial,
    submitBatchNo: `SUB${String(500000 + serial)}`,
    submitChannel: pickProfileCode(runtime.profile, "submit_channel", random, BANK_SUBMIT_CHANNELS, "监管专网"),
    logStatus: pickProfileCode(runtime.profile, "log_status", random, [
      { code: "已发送", label: "已发送", weight: 42 },
      { code: "已接收", label: "已接收", weight: 32 },
      { code: "待重试", label: "待重试", weight: 12 },
      { code: "已退回", label: "已退回", weight: 14 },
    ], "已发送"),
    messageType: pickProfileCode(runtime.profile, "message_type", random, [
      { code: "正式报送", label: "正式报送", weight: 54 },
      { code: "补正报送", label: "补正报送", weight: 28 },
      { code: "重报", label: "重报", weight: 18 },
    ], "正式报送"),
    messageSummary: `${report?.reportCode || "1104"} 报送摘要 ${serial}`,
    eventTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 5 * 60 * 60 * 1000),
    report,
  };
}

function buildBankApprovalFact(serial, random, runtime) {
  const report = pickFactByIndex(runtime.reportFacts, serial - 1);
  return {
    id: serial,
    approvalNo: `AP${String(700000 + serial)}`,
    approvalNode: pickProfileCode(runtime.profile, "approval_node", random, [
      { code: "机构复核", label: "机构复核", weight: 38 },
      { code: "分行审批", label: "分行审批", weight: 32 },
      { code: "总行备案", label: "总行备案", weight: 18 },
      { code: "监管反馈", label: "监管反馈", weight: 12 },
    ], "机构复核"),
    approverName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "陈"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "然"}`,
    approvalResult: pickProfileCode(runtime.profile, "approval_result", random, BANK_APPROVAL_RESULTS, "通过"),
    approvalTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 7 * 60 * 60 * 1000),
    report,
  };
}

function buildBankCustomerAccountFact(serial, random, runtime) {
  const branch = pickFactByIndex(runtime.branchFacts, serial - 1) || buildBankBranchDetailFact(serial, random, runtime);
  const customerType = pickOne(["PERSONAL", "ENTERPRISE"], random) || "PERSONAL";
  const gender = serial % 2 === 0 ? "F" : "M";
  const birthDate = new Date(1972 + (serial % 20), serial % 12, (serial % 27) + 1);
  const customerName = customerType === "ENTERPRISE"
    ? `${pickOne(["Huaxin", "Jinyun", "Ronghe", "Xingzhou", "Haicheng"], random) || "Huaxin"}${(serial % 9) + 1} Holdings`
    : `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Li"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ming"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yue"}`;
  const accountType = pickOne(["CURRENT", "FIXED", "SETTLEMENT"], random) || "CURRENT";
  const accountStatus = serial % 19 === 0 ? "FROZEN" : serial % 29 === 0 ? "CLOSED" : "ACTIVE";
  const balanceAmount = randomNumberBetween(customerType === "ENTERPRISE" ? 800000 : 5000, customerType === "ENTERPRISE" ? 28000000 : 900000, random);
  const freezeAmount = Number((accountStatus === "FROZEN"
    ? balanceAmount * randomNumberBetween(0.2, 0.6, random, 4)
    : balanceAmount * randomNumberBetween(0, 0.08, random, 4)).toFixed(2));
  const availableAmount = Number(Math.max(0, balanceAmount - freezeAmount).toFixed(2));
  const openDate = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(30, 2400, random) * 24 * 60 * 60 * 1000);
  return {
    id: serial,
    branch,
    accountNo: `ACC${String(600000000 + serial)}`,
    accountType,
    customerName,
    customerType,
    idNo: customerType === "ENTERPRISE"
      ? `91310${String(100000000 + serial).slice(-9)}`
      : buildMainlandIdCard(branch?.regionCode || "310000", birthDate, 700000 + serial, gender),
    mobile: buildMainlandMobile(800000 + serial, random),
    currencyCode: pickOne(["CNY", "USD", "HKD"], random) || "CNY",
    openDate,
    closeDate: accountStatus === "CLOSED" ? shiftTime(openDate, randomIntBetween(120 * 24 * 60, 1400 * 24 * 60, random)) : null,
    accountStatus,
    balanceAmount,
    availableAmount,
    freezeAmount,
    riskLevel: pickOne(["LOW", "MEDIUM", "HIGH"], random) || "LOW",
    managerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Zhou"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yu"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Han"}`,
    regionCode: branch?.regionCode || "310000",
    regionName: branch?.regionName || branch?.branchName || "Shanghai",
    remark: `${customerType} account profile synchronized`,
  };
}

function buildBankLoanContractFact(serial, random, runtime) {
  const branch = pickFactByIndex(runtime.branchFacts, serial - 1) || buildBankBranchDetailFact(serial, random, runtime);
  const account = pickFactByIndex(runtime.customerAccountFacts, serial - 1) || buildBankCustomerAccountFact(serial, random, runtime);
  const contractStatus = pickOne(["ACTIVE", "OVERDUE", "SETTLED"], random) || "ACTIVE";
  const loanAmount = randomNumberBetween(account.customerType === "ENTERPRISE" ? 600000 : 80000, account.customerType === "ENTERPRISE" ? 18000000 : 2500000, random);
  const disbursementDate = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(30, 1600, random) * 24 * 60 * 60 * 1000);
  const maturityDate = shiftTime(disbursementDate, randomIntBetween(180 * 24 * 60, 1825 * 24 * 60, random));
  const outstandingAmount = Number((contractStatus === "SETTLED"
    ? loanAmount * randomNumberBetween(0, 0.03, random, 4)
    : contractStatus === "OVERDUE"
      ? loanAmount * randomNumberBetween(0.28, 0.82, random, 4)
      : loanAmount * randomNumberBetween(0.12, 0.66, random, 4)).toFixed(2));
  return {
    id: serial,
    branch,
    account,
    contractNo: `LON${String(700000000 + serial)}`,
    borrowerName: account.customerName,
    borrowerType: account.customerType,
    loanType: pickOne(["WORKING_CAPITAL", "MORTGAGE", "CONSUMER", "CREDIT_LINE"], random) || "WORKING_CAPITAL",
    loanAmount,
    interestRate: randomNumberBetween(2.8, 7.6, random, 4),
    disbursementDate,
    maturityDate,
    outstandingAmount,
    overdueDays: contractStatus === "OVERDUE" ? randomIntBetween(1, 180, random) : 0,
    collateralType: pickOne(["MORTGAGE", "PLEDGE", "GUARANTEE", "CREDIT"], random) || "GUARANTEE",
    repaymentMethod: pickOne(["AMORTIZED", "BULLET", "MONTHLY_INTEREST"], random) || "AMORTIZED",
    contractStatus,
    managerName: account.managerName,
    riskClassification: contractStatus === "OVERDUE" ? pickOne(["SUBSTANDARD", "DOUBTFUL"], random) || "SUBSTANDARD" : pickOne(["NORMAL", "MENTION"], random) || "NORMAL",
    remark: `${contractStatus} loan contract linked with branch reporting`,
  };
}

function buildEcommerceLiveStreamFact(serial, random, runtime, startedAt) {
  const store = pickFactByIndex(runtime.storeFacts, serial - 1) || buildStoreFact(serial, random, runtime.profile);
  const sessionStatus = serial % 11 === 0 ? "RUNNING" : serial % 17 === 0 ? "PLANNED" : "FINISHED";
  const startTime = new Date(startedAt.getTime() - randomIntBetween(2, 240, random) * 60 * 1000);
  const durationMinutes = randomIntBetween(45, 240, random);
  const endTime = shiftTime(startTime, durationMinutes);
  const viewerCount = randomIntBetween(1200, 48000, random);
  const uvCount = Math.max(300, Math.round(viewerCount * randomNumberBetween(0.55, 0.92, random, 4)));
  const orderCount = Math.max(20, Math.round(uvCount * randomNumberBetween(0.015, 0.18, random, 4)));
  const avgOrderAmount = randomNumberBetween(69, 880, random);
  const orderAmount = Number((orderCount * avgOrderAmount).toFixed(2));
  return {
    id: serial,
    store,
    sessionNo: `LS${String(500000000 + serial)}`,
    hostName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Lin"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Qi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yao"}`,
    channelName: pickOne(["Douyin", "Taobao Live", "Kuaishou", "Video Account"], random) || "Douyin",
    startTime,
    endTime,
    viewerCount,
    orderCount,
    orderAmount,
    refundAmount: Number((orderAmount * randomNumberBetween(0.01, 0.08, random, 4)).toFixed(2)),
    productCount: randomIntBetween(6, 48, random),
    sessionStatus,
    trafficSource: pickOne(["RECOMMENDATION", "FOLLOWER", "PAID_AD", "SEARCH", "PRIVATE_DOMAIN"], random) || "RECOMMENDATION",
    conversionRate: Number((orderCount / Math.max(1, uvCount)).toFixed(4)),
    uvCount,
    remark: `${sessionStatus} live stream for ${store.storeName}`,
  };
}

function buildEcommerceEnterpriseProcurementFact(serial, random, runtime, startedAt) {
  const store = pickFactByIndex(runtime.storeFacts, serial - 1) || buildStoreFact(serial, random, runtime.profile);
  const customer = pickFactByIndex(runtime.customerFacts, serial - 1) || buildCustomerFact(serial, random, runtime.profile);
  const orderStatus = pickOne(["SIGNED", "PAID", "DELIVERING", "COMPLETED"], random) || "SIGNED";
  const orderAmount = randomNumberBetween(12000, 680000, random);
  const paidAmount = Number((orderStatus === "SIGNED"
    ? orderAmount * randomNumberBetween(0, 0.3, random, 4)
    : orderStatus === "PAID"
      ? orderAmount * randomNumberBetween(0.7, 1, random, 4)
      : orderAmount).toFixed(2));
  const signedTime = new Date(startedAt.getTime() - randomIntBetween(2 * 24 * 60, 180 * 24 * 60, random) * 60 * 1000);
  const deliveryPlanTime = shiftTime(signedTime, randomIntBetween(3 * 24 * 60, 28 * 24 * 60, random));
  return {
    id: serial,
    store,
    customer,
    procurementNo: `B2B${String(400000000 + serial)}`,
    buyerCompanyName: `${pickOne(["Huanyu", "Jinzhi", "Yunke", "Xingtu", "Jiahang"], random) || "Huanyu"} Procurement ${((serial % 9) + 1)}`,
    buyerContact: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Qian"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Fan"}`,
    buyerMobile: buildMainlandMobile(900000 + serial, random),
    contractNo: `CTR${String(300000000 + serial)}`,
    orderStatus,
    signedTime,
    deliveryPlanTime,
    settlementTime: orderStatus === "SIGNED" ? null : shiftTime(deliveryPlanTime, randomIntBetween(1 * 24 * 60, 15 * 24 * 60, random)),
    orderAmount,
    paidAmount,
    invoiceType: pickOne(["VAT_SPECIAL", "VAT_GENERAL", "NORMAL"], random) || "VAT_SPECIAL",
    itemCount: randomIntBetween(5, 200, random),
    warehouseCode: store.warehouseCode || `WH${String(200 + serial).slice(-3)}`,
    deliveryStatus: orderStatus === "SIGNED" ? "PENDING" : orderStatus === "PAID" ? "READY" : orderStatus === "DELIVERING" ? "DELIVERING" : "DELIVERED",
    remark: `${orderStatus} enterprise procurement order`,
  };
}

function buildEducationParentCommunicationFact(serial, random, runtime, startedAt) {
  const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
  const guardian = findFact(runtime.guardianFacts, (item) => item.student?.id === student.id)
    || pickFactByIndex(runtime.guardianFacts, serial - 1)
    || buildEducationGuardianFact(serial, random, runtime);
  const staff = pickFactByIndex(runtime.staffFacts, serial - 1) || buildEducationStaffFact(serial, random, runtime);
  const replyStatus = pickOne(["PENDING", "READ", "REPLIED"], random) || "READ";
  const sendTime = new Date(startedAt.getTime() - randomIntBetween(2 * 60, 18 * 24 * 60, random) * 60 * 1000);
  const readTime = replyStatus === "PENDING" ? null : shiftTime(sendTime, randomIntBetween(5, 1440, random));
  return {
    id: serial,
    student,
    guardian,
    staff,
    messageNo: `MSG${String(200000000 + serial)}`,
    messageChannel: pickOne(["APP", "WECHAT", "SMS", "PHONE"], random) || "APP",
    messageType: pickOne(["NOTICE", "ATTENDANCE", "PERFORMANCE", "SAFETY", "PAYMENT"], random) || "NOTICE",
    title: pickOne(["Attendance Reminder", "Safety Notice", "Class Update", "Payment Reminder", "Parent Feedback"], random) || "Class Update",
    contentSummary: pickOne([
      "Guardian follow-up required for recent class notice",
      "Daily attendance status has been updated",
      "Parent confirmation needed for school activity",
      "Tuition reminder and payment instruction",
      "Weekly performance feedback summary",
    ], random) || "Guardian follow-up required for recent class notice",
    senderName: staff.staffName,
    sendTime,
    readTime,
    replyTime: replyStatus === "REPLIED" && readTime ? shiftTime(readTime, randomIntBetween(10, 960, random)) : null,
    replyStatus,
    urgencyLevel: pickOne(["LOW", "MEDIUM", "HIGH"], random) || "LOW",
    handleTeacher: staff.staffName,
    archiveStatus: replyStatus === "REPLIED" ? "ARCHIVED" : "PENDING",
    remark: `${replyStatus} parent communication record`,
  };
}

function buildEducationDormitoryResidentFact(serial, random, runtime, startedAt) {
  const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
  const campus = student.campus || pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
  const residentStatus = serial % 17 === 0 ? "CHECKOUT" : serial % 23 === 0 ? "LEAVE" : "ACTIVE";
  const checkinTime = new Date(startedAt.getTime() - randomIntBetween(15 * 24 * 60, 420 * 24 * 60, random) * 60 * 1000);
  return {
    id: serial,
    student,
    campus,
    residentNo: `DOR${String(100000000 + serial)}`,
    dormitoryNo: `D${padNumber((serial % 12) + 1, 2)}-${padNumber((serial % 20) + 101, 3)}`,
    buildingNo: `B${padNumber((serial % 8) + 1, 2)}`,
    roomNo: `${padNumber((serial % 18) + 201, 3)}`,
    bedNo: `${String.fromCharCode(65 + (serial % 6))}${(serial % 2) + 1}`,
    checkinTime,
    checkoutTime: residentStatus === "CHECKOUT" ? shiftTime(checkinTime, randomIntBetween(30 * 24 * 60, 260 * 24 * 60, random)) : null,
    residentStatus,
    managerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Sun"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Tong"}`,
    electricityBalance: randomNumberBetween(20, 180, random),
    hygieneScore: randomNumberBetween(72, 99, random, 1),
    disciplineScore: randomNumberBetween(75, 100, random, 1),
    weekendLeaveFlag: serial % 4 === 0 ? 1 : 0,
    accessCardNo: student.accessCardNo,
    remark: `${residentStatus} dormitory resident record`,
  };
}

function generateEcommerceRow(table, serial, runtime, startedAt) {
  const random = createSeededRandom(hashString(`${runtime.sceneCode}:${table.tableName}:${serial}`));

  if (table.tableName === "customer_profile" || table.tableName === "customer_info") {
    const fact = buildCustomerFact(serial, random, runtime.profile);
    runtime.customerFacts.set(fact.id, fact);
    return {
      customer_id: fact.id,
      customer_code: fact.customerCode,
      customer_name: fact.customerName,
      gender: fact.gender,
      mobile: fact.mobile,
      email: fact.email,
      member_level: fact.memberLevel,
      register_channel: fact.registerChannel,
      risk_level: fact.riskLevel,
      loyalty_score: fact.loyaltyScore,
      total_order_count: fact.totalOrderCount,
      total_order_amount: fact.totalOrderAmount,
      register_time: formatDateTime(fact.registerTime),
      last_login_time: formatDateTime(fact.lastLoginTime),
      last_order_time: formatDateTime(fact.lastOrderTime),
      preferred_category: fact.preferredCategory,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
    };
  }

  if (table.tableName === "customer_address") {
    const fact = buildAddressFact(serial, random, runtime);
    runtime.addressFacts.set(fact.id, fact);
    return {
      address_id: fact.id,
      customer_id: fact.customer?.id || serial,
      consignee_name: fact.consigneeName,
      consignee_mobile: fact.consigneeMobile,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      street_name: fact.streetName,
      address_detail: fact.addressDetail,
      postal_code: fact.postalCode,
      address_tag: fact.addressTag,
      is_default: fact.isDefault,
      longitude: fact.longitude,
      latitude: fact.latitude,
      delivery_instructions: fact.deliveryInstructions,
    };
  }

  if (table.tableName === "merchant_store") {
    const fact = buildStoreFact(serial, random, runtime.profile);
    runtime.storeFacts.set(fact.id, fact);
    return {
      store_id: fact.id,
      store_code: fact.storeCode,
      store_name: fact.storeName,
      merchant_name: fact.merchantName,
      store_type: fact.storeType,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      street_name: fact.streetName,
      address_detail: fact.addressDetail,
      contact_name: fact.contactName,
      contact_mobile: fact.contactMobile,
      contact_email: fact.contactEmail,
      warehouse_code: fact.warehouseCode,
      daily_order_capacity: fact.dailyOrderCapacity,
      average_dispatch_minutes: fact.averageDispatchMinutes,
      delivery_scope: fact.deliveryScope,
      rating_score: fact.ratingScore,
    };
  }

  if (table.tableName === "product_spu" || table.tableName === "product_info") {
    const fact = buildProductFact(serial, random, runtime.profile);
    runtime.spuFacts.set(fact.id, fact);
    runtime.productFacts.set(fact.id, fact);
    return {
      spu_id: fact.id,
      spu_code: `SPU${String(1000000 + serial).slice(-7)}`,
      product_name: fact.productName,
      brand_name: fact.brandName,
      category_code: fact.categoryCode,
      category_name: fact.categoryLabel,
      sub_category_code: fact.subCategoryCode,
      sub_category_name: fact.subCategoryName,
      product_line: fact.productLine,
      product_type: fact.productType,
      market_price: fact.marketPrice,
      sale_price: fact.salePrice,
      cost_price: fact.costPrice,
      tax_rate: fact.taxRate,
      unit_name: fact.unitName,
      origin_country: fact.originCountry,
      supplier_name: fact.supplierName,
      supplier_code: fact.supplierCode,
      model_no: fact.modelNo,
      shelf_status: fact.shelfStatus,
      launch_date: formatDateTime(fact.launchDate),
      discontinue_date: fact.discontinueDate ? formatDateTime(fact.discontinueDate) : null,
      stock_qty: fact.stockQty,
    };
  }

  if (table.tableName === "product_sku") {
    const fact = buildSkuFact(serial, random, runtime);
    runtime.skuFacts.set(fact.id, fact);
    return {
      sku_id: fact.id,
      spu_id: fact.spu?.id || serial,
      sku_code: fact.skuCode,
      product_name: fact.productName,
      brand_name: fact.brandName,
      category_code: fact.categoryCode,
      category_name: fact.categoryName,
      color_name: fact.colorName,
      storage_spec: fact.storageSpec,
      size_spec: fact.sizeSpec,
      package_spec: fact.packageSpec,
      barcode: fact.barcode,
      weight_grams: fact.weightGrams,
      volume_cm3: fact.volumeCm3,
      list_price: fact.listPrice,
      sale_price: fact.salePrice,
      promo_price: fact.promoPrice,
      member_price: fact.memberPrice,
      stock_qty: fact.stockQty,
      locked_stock_qty: fact.lockedStockQty,
      safety_stock_qty: fact.safetyStockQty,
      shelf_status: fact.shelfStatus,
      warehouse_code: fact.warehouseCode,
      warehouse_name: fact.warehouseName,
      online_time: formatDateTime(fact.onlineTime),
    };
  }

  if (table.tableName === "inventory_snapshot") {
    const fact = buildInventoryFact(serial, random, runtime, startedAt);
    runtime.inventoryFacts.set(fact.id, fact);
    return {
      snapshot_id: fact.id,
      sku_id: fact.sku?.id || serial,
      snapshot_date: formatDateTime(fact.snapshotDate),
      warehouse_code: fact.warehouseCode,
      warehouse_name: fact.warehouseName,
      available_qty: fact.availableQty,
      reserved_qty: fact.reservedQty,
      in_transit_qty: fact.inTransitQty,
      damaged_qty: fact.damagedQty,
      pending_putaway_qty: fact.pendingPutawayQty,
      cycle_count_diff: fact.cycleCountDiff,
      turnover_days: fact.turnoverDays,
      replenishment_status: fact.replenishmentStatus,
      alert_level: fact.alertLevel,
      supplier_name: fact.supplierName,
      last_inbound_time: formatDateTime(fact.lastInboundTime),
      last_outbound_time: formatDateTime(fact.lastOutboundTime),
      stock_amount: fact.stockAmount,
    };
  }

  if (table.tableName === "order_header" || table.tableName === "order_info") {
    const fact = buildOrderFact(serial, random, runtime, startedAt);
    runtime.orderFacts.set(fact.id, fact);
    return {
      order_id: fact.id,
      customer_id: fact.customerId,
      store_id: fact.storeId,
      order_no: fact.orderNo,
      order_source: fact.orderSource,
      order_channel: fact.orderChannel,
      order_status: fact.orderStatus,
      payment_status: fact.paymentStatus,
      delivery_status: fact.deliveryStatus,
      order_time: formatDateTime(fact.orderTime),
      pay_time: fact.payTime ? formatDateTime(fact.payTime) : null,
      ship_time: fact.shipTime ? formatDateTime(fact.shipTime) : null,
      complete_time: fact.completeTime ? formatDateTime(fact.completeTime) : null,
      gross_amount: fact.grossAmount,
      discount_amount: fact.discountAmount,
      freight_amount: fact.freightAmount,
      net_amount: fact.netAmount,
      coupon_amount: fact.couponAmount,
      points_deduction_amount: fact.pointsDeductionAmount,
      invoice_status: fact.invoiceStatus,
      consignee_name: fact.consigneeName,
      consignee_mobile: fact.consigneeMobile,
      address_snapshot: fact.addressSnapshot,
      province_code: fact.provinceCode,
      city_code: fact.cityCode,
      order_amount: fact.netAmount,
    };
  }

  if (table.tableName === "order_item") {
    const fact = buildOrderItemFact(serial, random, runtime);
    runtime.itemFacts.set(fact.id, fact);
    return {
      item_id: fact.id,
      order_id: fact.order?.id || serial,
      sku_id: fact.sku?.id || serial,
      spu_id: fact.sku?.spu?.id || serial,
      product_name: fact.sku?.productName || `商品${serial}`,
      brand_name: fact.sku?.brandName || "品牌",
      category_code: fact.sku?.categoryCode || "ELECTRONIC",
      category_name: fact.sku?.categoryName || "手机数码",
      quantity: fact.quantity,
      unit_price: fact.unitPrice,
      promo_price: fact.promoPrice,
      discount_amount: fact.discountAmount,
      item_amount: fact.itemAmount,
      cost_amount: fact.costAmount,
      tax_amount: fact.taxAmount,
      warehouse_code: fact.warehouseCode,
      delivery_mode: fact.deliveryMode,
      refund_flag: fact.refundFlag,
      quality_flag: fact.qualityFlag,
    };
  }

  if (table.tableName === "payment_record") {
    const fact = buildPaymentFact(serial, random, runtime);
    runtime.paymentFacts.set(fact.id, fact);
    return {
      payment_id: fact.id,
      order_id: fact.orderId,
      payment_no: fact.paymentNo,
      pay_channel: fact.payChannel,
      pay_status: fact.payStatus,
      pay_amount: fact.payAmount,
      currency_code: fact.currencyCode,
      transaction_id: fact.transactionId,
      merchant_order_no: fact.merchantOrderNo,
      acquirer_code: fact.acquirerCode,
      bank_name: fact.bankName,
      payer_account_mask: fact.payerAccountMask,
      pay_time: formatDateTime(fact.payTime),
      callback_time: formatDateTime(fact.callbackTime),
      settlement_time: formatDateTime(fact.settlementTime),
      refund_status: fact.refundStatus,
      risk_result: fact.riskResult,
    };
  }

  if (table.tableName === "refund_ticket" || table.tableName.includes("refund")) {
    const fact = buildRefundFact(serial, random, runtime);
    runtime.refundFacts.set(fact.id, fact);
    return {
      refund_id: fact.id,
      order_id: fact.order?.id || serial,
      payment_id: fact.payment?.id || serial,
      refund_no: fact.refundNo,
      refund_reason: fact.refundReason,
      refund_status: fact.refundStatus,
      refund_amount: fact.refundAmount,
      apply_time: formatDateTime(fact.applyTime),
      approve_time: formatDateTime(fact.approveTime),
      complete_time: formatDateTime(fact.completeTime),
      applicant_name: fact.applicantName,
      audit_name: fact.auditName,
      item_count: fact.itemCount,
      logistics_back_flag: fact.logisticsBackFlag,
      return_warehouse_code: fact.returnWarehouseCode,
      return_tracking_no: fact.returnTrackingNo,
      dispute_flag: fact.disputeFlag,
    };
  }

  if (table.tableName === "logistics_delivery") {
    const fact = buildDeliveryFact(serial, random, runtime);
    runtime.deliveryFacts.set(fact.id, fact);
    return {
      delivery_id: fact.id,
      order_id: fact.order?.id || serial,
      delivery_no: fact.deliveryNo,
      warehouse_code: fact.warehouseCode,
      warehouse_name: fact.warehouseName,
      courier_company: fact.courierCompany,
      tracking_no: fact.trackingNo,
      delivery_status: fact.deliveryStatus,
      dispatch_time: formatDateTime(fact.dispatchTime),
      first_pickup_time: formatDateTime(fact.firstPickupTime),
      delivered_time: formatDateTime(fact.deliveredTime),
      signed_time: formatDateTime(fact.signedTime),
      consignee_name: fact.consigneeName,
      consignee_mobile: fact.consigneeMobile,
      destination_province: fact.destinationProvince,
      destination_city: fact.destinationCity,
      destination_district: fact.destinationDistrict,
      route_name: fact.routeName,
      package_count: fact.packageCount,
      package_weight: fact.packageWeight,
      abnormal_flag: fact.abnormalFlag,
    };
  }

  if (table.tableName === "live_stream_session") {
    const fact = buildEcommerceLiveStreamFact(serial, random, runtime, startedAt);
    runtime.liveStreamFacts.set(fact.id, fact);
    return {
      session_id: fact.id,
      store_id: fact.store.id,
      session_no: fact.sessionNo,
      host_name: fact.hostName,
      channel_name: fact.channelName,
      start_time: formatDateTime(fact.startTime),
      end_time: formatDateTime(fact.endTime),
      viewer_count: fact.viewerCount,
      order_count: fact.orderCount,
      order_amount: fact.orderAmount,
      refund_amount: fact.refundAmount,
      product_count: fact.productCount,
      session_status: fact.sessionStatus,
      traffic_source: fact.trafficSource,
      conversion_rate: fact.conversionRate,
      uv_count: fact.uvCount,
      remark: fact.remark,
    };
  }

  if (table.tableName === "enterprise_procurement_order") {
    const fact = buildEcommerceEnterpriseProcurementFact(serial, random, runtime, startedAt);
    runtime.procurementFacts.set(fact.id, fact);
    return {
      procurement_id: fact.id,
      store_id: fact.store.id,
      customer_id: fact.customer.id,
      procurement_no: fact.procurementNo,
      buyer_company_name: fact.buyerCompanyName,
      buyer_contact: fact.buyerContact,
      buyer_mobile: fact.buyerMobile,
      contract_no: fact.contractNo,
      order_status: fact.orderStatus,
      signed_time: formatDateTime(fact.signedTime),
      delivery_plan_time: formatDateTime(fact.deliveryPlanTime),
      settlement_time: fact.settlementTime ? formatDateTime(fact.settlementTime) : null,
      order_amount: fact.orderAmount,
      paid_amount: fact.paidAmount,
      invoice_type: fact.invoiceType,
      item_count: fact.itemCount,
      warehouse_code: fact.warehouseCode,
      delivery_status: fact.deliveryStatus,
      remark: fact.remark,
    };
  }

  return null;
}

function generateTrafficRow(table, serial, runtime, startedAt) {
  const random = createSeededRandom(hashString(`${runtime.sceneCode}:${table.tableName}:${serial}`));

  if (table.tableName === "owner_profile") {
    const fact = buildTrafficOwnerFact(serial, random, runtime.profile);
    runtime.ownerFacts.set(fact.id, fact);
    return {
      owner_id: fact.id,
      owner_code: fact.ownerCode,
      owner_name: fact.ownerName,
      gender: fact.gender,
      id_card_no: fact.idCardNo,
      owner_mobile: fact.ownerMobile,
      owner_email: fact.ownerEmail,
      province_code: fact.city.code,
      province_name: fact.city.name,
      city_code: fact.city.code,
      city_name: fact.city.name,
      district_code: `${fact.city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
      district_name: pickOne(fact.city.districts, random) || fact.city.name,
      residence_address: `${fact.city.name}${pickOne(fact.city.districts, random) || fact.city.name}${pickOne(["人民路", "中山路", "青年路", "滨江路"], random) || "人民路"}${(serial % 180) + 1}号`,
      occupation_name: fact.occupationName,
      driver_license_type: fact.driverLicenseType,
      first_license_time: formatDateTime(new Date(startedAt.getTime() - randomIntBetween(8 * 365, 22 * 365, random) * 24 * 60 * 60 * 1000)),
      expire_license_time: formatDateTime(new Date(startedAt.getTime() + randomIntBetween(150, 1800, random) * 24 * 60 * 60 * 1000)),
      credit_status: pickProfileCode(runtime.profile, "credit_status", random, [
        { code: "正常", label: "正常", weight: 84 },
        { code: "关注", label: "关注", weight: 12 },
        { code: "限制", label: "限制", weight: 4 },
      ], "正常"),
      historical_violation_count: randomIntBetween(0, 22, random),
      historical_accident_count: randomIntBetween(0, 5, random),
    };
  }

  if (table.tableName === "vehicle_archive") {
    const fact = buildTrafficVehicleFact(serial, random, runtime);
    runtime.vehicleFacts.set(fact.id, fact);
    return {
      vehicle_id: fact.id,
      owner_id: fact.ownerId,
      plate_no: fact.plateNo,
      vehicle_vin: `VIN${String(9000000000 + serial)}`,
      engine_no: `ENG${String(700000000 + serial)}`,
      vehicle_type: fact.vehicleType,
      brand_name: fact.brandName,
      model_name: fact.modelName,
      fuel_type: fact.fuelType,
      color_name: fact.colorName,
      seat_count: fact.seatCount,
      load_capacity: fact.loadCapacity,
      register_city_code: fact.registerCityCode,
      register_city_name: fact.registerCityName,
      plate_issue_org: fact.plateIssueOrg,
      registered_at: formatDateTime(fact.registeredAt),
      annual_inspection_due: formatDateTime(fact.annualInspectionDue),
      insurance_status: fact.insuranceStatus,
      operation_type: fact.operationType,
      device_id: fact.deviceId,
    };
  }

  if (table.tableName === "registration_record") {
    const fact = buildTrafficRegistrationFact(serial, random, runtime, startedAt);
    runtime.registrationFacts.set(fact.id, fact);
    return {
      registration_id: fact.id,
      vehicle_id: fact.vehicle?.id || serial,
      owner_id: fact.owner?.id || serial,
      registration_no: fact.registrationNo,
      registration_type: fact.registrationType,
      registration_time: formatDateTime(fact.time),
      register_org_name: fact.registerOrgName,
      plate_no: fact.vehicle?.plateNo || buildLicensePlate("310000", serial, random),
      vehicle_type: fact.vehicle?.vehicleType || "SEDAN",
      brand_name: fact.vehicle?.brandName || "大众",
      model_name: fact.vehicle?.modelName || "标准版",
      vehicle_vin: `VIN${String(9000000000 + serial)}`,
      engine_no: `ENG${String(700000000 + serial)}`,
      owner_name: fact.owner?.ownerName || `车主${serial}`,
      owner_mobile: fact.owner?.ownerMobile || buildMainlandMobile(120000 + serial, random),
      approval_status: fact.approvalStatus,
      remark: "资料齐全，已归档",
    };
  }

  if (table.tableName === "violation_record") {
    const fact = buildTrafficViolationFact(serial, random, runtime, startedAt);
    runtime.violationFacts.set(fact.id, fact);
    return {
      violation_id: fact.id,
      vehicle_id: fact.vehicleId,
      owner_id: fact.ownerId,
      violation_no: fact.violationNo,
      plate_no: fact.plateNo,
      vehicle_type: fact.vehicleType,
      violation_code: fact.violationCode,
      violation_desc: fact.violationDesc,
      violation_points: fact.violationPoints,
      fine_amount: fact.fineAmount,
      road_name: fact.roadName,
      direction_name: fact.directionName,
      camera_name: fact.cameraName,
      violation_status: fact.violationStatus,
      capture_time: formatDateTime(fact.captureTime),
      notice_time: formatDateTime(fact.noticeTime),
      handle_deadline: formatDateTime(fact.handleDeadline),
      law_basis: fact.lawBasis,
      officer_name: fact.officerName,
      remark: `${fact.violationDesc}，已生成处理流水`,
    };
  }

  if (table.tableName === "penalty_payment") {
    const fact = buildTrafficPaymentFact(serial, random, runtime, startedAt);
    runtime.penaltyFacts.set(fact.id, fact);
    return {
      payment_id: fact.id,
      violation_id: fact.violation?.id || serial,
      payment_no: fact.paymentNo,
      plate_no: fact.violation?.plateNo || buildLicensePlate("310000", serial, random),
      receivable_amount: fact.violation?.fineAmount || fact.paidAmount,
      paid_amount: fact.paidAmount,
      payment_channel: fact.paymentChannel,
      payment_status: fact.paymentStatus,
      payment_time: formatDateTime(fact.paymentTime),
      settlement_time: formatDateTime(fact.settlementTime),
      bank_name: fact.bankName,
      payer_name: fact.payerName,
      payer_mobile: fact.payerMobile,
      receipt_no: fact.receiptNo,
      refund_flag: fact.refundFlag,
      reconcile_status: fact.reconcileStatus,
    };
  }

  if (table.tableName === "checkpoint_inspection") {
    const fact = buildTrafficInspectionFact(serial, random, runtime, startedAt);
    runtime.inspectionFacts.set(fact.id, fact);
    return {
      inspection_id: fact.id,
      vehicle_id: fact.vehicleId,
      station_name: fact.stationName,
      road_name: fact.roadName,
      lane_no: fact.laneNo,
      plate_no: fact.plateNo,
      vehicle_type: fact.vehicleType,
      inspection_result: fact.inspectionResult,
      problem_code: fact.problemCode,
      problem_desc: fact.problemDesc,
      officer_name: fact.officerName,
      assist_officer_name: fact.assistOfficerName,
      inspection_time: formatDateTime(fact.inspectionTime),
      release_time: formatDateTime(fact.releaseTime),
      body_camera_no: fact.bodyCameraNo,
      evidence_no: fact.evidenceNo,
      remark: fact.problemDesc,
    };
  }

  if (table.tableName === "driver_training_record") {
    const fact = buildTrafficDriverTrainingFact(serial, random, runtime, startedAt);
    runtime.driverTrainingFacts.set(fact.id, fact);
    return {
      training_id: fact.id,
      owner_id: fact.owner?.id || serial,
      training_no: fact.trainingNo,
      school_name: fact.schoolName,
      coach_name: fact.coachName,
      coach_mobile: fact.coachMobile,
      training_vehicle_no: fact.trainingVehicleNo,
      training_license_type: fact.trainingLicenseType,
      subject_code: fact.subjectCode,
      training_status: fact.trainingStatus,
      enrolled_time: formatDateTime(fact.enrolledTime),
      plan_exam_time: formatDateTime(fact.plannedExamTime),
      completed_time: fact.completedTime ? formatDateTime(fact.completedTime) : null,
      total_hours: fact.totalHours,
      valid_hours: fact.validHours,
      attendance_rate: fact.attendanceRate,
      exam_score: fact.examScore,
      exam_result: fact.examResult,
      archive_status: fact.archiveStatus,
      remark: fact.remark,
    };
  }

  if (table.tableName === "checkpoint_vehicle_pass_record") {
    const fact = buildTrafficCheckpointPassFact(serial, random, runtime, startedAt);
    runtime.checkpointPassFacts.set(fact.id, fact);
    return {
      pass_id: fact.id,
      vehicle_id: fact.vehicle?.id || serial,
      owner_id: fact.owner?.id || serial,
      pass_no: fact.passNo,
      checkpoint_code: fact.checkpointCode,
      checkpoint_name: fact.checkpointName,
      lane_no: fact.laneNo,
      direction_name: fact.directionName,
      plate_no: fact.plateNo,
      vehicle_type: fact.vehicleType,
      plate_color: fact.plateColor,
      pass_time: formatDateTime(fact.passTime),
      pass_speed: fact.passSpeed,
      limit_speed: fact.limitSpeed,
      pass_result: fact.passResult,
      plate_match_flag: fact.plateMatchFlag,
      violation_flag: fact.violationFlag,
      capture_device_no: fact.captureDeviceNo,
      image_uri: fact.imageUri,
      travel_direction: fact.travelDirection,
      remark: fact.remark,
    };
  }

  if (table.tableName === "accident_case") {
    const fact = buildTrafficAccidentFact(serial, random, runtime, startedAt);
    runtime.accidentFacts.set(fact.id, fact);
    return {
      accident_id: fact.id,
      vehicle_id: fact.vehicle?.id || serial,
      accident_no: fact.accidentNo,
      plate_no: fact.vehicle?.plateNo || buildLicensePlate("310000", serial, random),
      accident_type: fact.accidentType,
      accident_level: fact.accidentLevel,
      road_name: fact.roadName,
      weather_desc: fact.weatherDesc,
      road_condition: fact.roadCondition,
      injury_count: fact.injuryCount,
      death_count: fact.deathCount,
      loss_amount: fact.lossAmount,
      liability_type: fact.liabilityType,
      case_status: fact.caseStatus,
      occur_time: formatDateTime(fact.occurTime),
      report_time: formatDateTime(fact.reportTime),
      close_time: formatDateTime(fact.closeTime),
      handle_officer: fact.handleOfficer,
      remark: `${fact.accidentType}，当前状态${fact.caseStatus}`,
    };
  }

  if (table.tableName === "dispatch_task") {
    const fact = buildTrafficDispatchFact(serial, random, runtime, startedAt);
    runtime.dispatchFacts.set(fact.id, fact);
    return {
      dispatch_id: fact.id,
      dispatch_no: fact.dispatchNo,
      vehicle_id: fact.vehicle?.id || serial,
      accident_id: fact.accident?.id || null,
      dispatch_type: fact.dispatchType,
      dispatch_status: fact.dispatchStatus,
      station_name: fact.stationName,
      target_road_name: fact.targetRoadName,
      duty_team_name: fact.dutyTeamName,
      leader_name: fact.leaderName,
      officer_name: fact.officerName,
      dispatch_time: formatDateTime(fact.dispatchTime),
      accept_time: formatDateTime(fact.acceptTime),
      arrive_time: formatDateTime(fact.arriveTime),
      finish_time: formatDateTime(fact.finishTime),
      priority_level: fact.priorityLevel,
      source_channel: fact.sourceChannel,
      remark: "已按辖区规则派单处置",
    };
  }

  if (table.tableName === "patrol_log") {
    const fact = buildTrafficPatrolFact(serial, random, runtime, startedAt);
    runtime.patrolFacts.set(fact.id, fact);
    return {
      log_id: fact.id,
      dispatch_id: fact.dispatch?.id || serial,
      vehicle_id: fact.dispatch?.vehicle?.id || serial,
      log_no: fact.logNo,
      station_name: fact.stationName,
      road_name: fact.roadName,
      checkpoint_name: fact.checkpointName,
      officer_name: fact.officerName,
      event_type: fact.eventType,
      event_result: fact.eventResult,
      event_time: formatDateTime(fact.eventTime),
      gps_track_id: fact.gpsTrackId,
      longitude: fact.longitude,
      latitude: fact.latitude,
      remark: `${fact.eventType}，结果${fact.eventResult}`,
    };
  }

  if (table.tableName === "enforcement_document") {
    const fact = buildTrafficDocumentFact(serial, random, runtime, startedAt);
    runtime.documentFacts.set(fact.id, fact);
    return {
      document_id: fact.id,
      violation_id: fact.violation?.id || null,
      inspection_id: fact.inspection?.id || null,
      document_no: fact.documentNo,
      document_type: fact.documentType,
      plate_no: fact.violation?.plateNo || fact.inspection?.plateNo || buildLicensePlate("310000", serial, random),
      owner_name: fact.violation?.ownerName || `车主${serial}`,
      officer_name: fact.violation?.officerName || fact.inspection?.officerName || `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "晨"}警官`,
      issue_org_name: fact.issueOrgName,
      issue_time: formatDateTime(fact.issueTime),
      serve_time: formatDateTime(fact.serveTime),
      serve_mode: fact.serveMode,
      sign_status: fact.signStatus,
      appeal_flag: fact.appealFlag,
      archive_no: fact.archiveNo,
      remark: "文书已同步归档",
    };
  }

  return null;
}

function generateBankRow(table, serial, runtime, startedAt) {
  const random = createSeededRandom(hashString(`${runtime.sceneCode}:${table.tableName}:${serial}`));

  if (table.tableName === "institution_dimension") {
    const fact = buildBankInstitutionFact(serial, random, runtime.profile);
    runtime.institutionFacts.set(fact.id, fact);
    return {
      institution_id: fact.id,
      institution_code: fact.institutionCode,
      institution_name: fact.institutionName,
      institution_type: fact.institutionType,
      license_no: fact.licenseNo,
      org_code: fact.orgCode,
      province_code: fact.city.code,
      province_name: fact.city.name,
      city_code: fact.city.code,
      city_name: fact.city.name,
      district_code: `${fact.city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
      district_name: pickOne(fact.city.districts, random) || fact.city.name,
      regulator_name: fact.regulatorName,
      institution_status: fact.institutionStatus,
      established_at: formatDateTime(fact.establishedAt),
      business_start_at: formatDateTime(fact.businessStartAt),
      registered_capital: fact.registeredCapital,
      employee_count: fact.employeeCount,
    };
  }

  if (table.tableName === "reporting_branch") {
    const fact = buildBankBranchDetailFact(serial, random, runtime);
    runtime.branchFacts.set(fact.id, fact);
    return {
      branch_id: fact.id,
      institution_id: fact.institution?.id || serial,
      branch_code: fact.branchCode,
      branch_name: fact.branchName,
      branch_type: fact.branchType,
      region_code: fact.regionCode,
      region_name: fact.regionName,
      governance_level: fact.governanceLevel,
      reporting_flag: fact.reportingFlag,
      established_at: formatDateTime(fact.establishedAt),
      asset_scale: fact.assetScale,
      loan_scale: fact.loanScale,
      deposit_scale: fact.depositScale,
      contact_name: fact.contactName,
      contact_mobile: fact.contactMobile,
      contact_email: fact.contactEmail,
    };
  }

  if (table.tableName === "reporting_contact") {
    const fact = buildBankContactFact(serial, random, runtime);
    runtime.contactFacts.set(fact.id, fact);
    return {
      contact_id: fact.id,
      branch_id: fact.branch?.id || serial,
      contact_name: fact.contactName,
      contact_role: fact.contactRole,
      contact_mobile: fact.contactMobile,
      contact_email: fact.contactEmail,
      department_name: fact.departmentName,
      duty_scope: fact.dutyScope,
      primary_contact_flag: fact.primaryContactFlag,
      office_phone: fact.officePhone,
      onboard_time: formatDateTime(fact.onboardTime),
      backup_contact_name: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "宁"}`,
      backup_contact_mobile: buildMainlandMobile(130000 + serial, random),
      report_deadline_day: (serial % 20) + 5,
      contact_status: serial % 17 === 0 ? "停用" : "正常",
    };
  }

  if (table.tableName === "prudential_report") {
    const fact = buildBankReportFact(serial, random, runtime, startedAt);
    runtime.reportFacts.set(fact.id, fact);
    return {
      report_id: fact.id,
      branch_id: fact.branchId,
      report_code: fact.reportCode,
      report_name: fact.reportName,
      report_period: fact.reportPeriod,
      report_freq: fact.reportFreq,
      total_assets: fact.totalAssets,
      loan_balance: fact.loanBalance,
      deposit_balance: fact.depositBalance,
      capital_adequacy_ratio: fact.capitalAdequacyRatio,
      tier1_capital_ratio: fact.tier1CapitalRatio,
      core_tier1_ratio: fact.coreTier1Ratio,
      liquidity_coverage_ratio: fact.liquidityCoverageRatio,
      npl_ratio: fact.nplRatio,
      provision_coverage_ratio: fact.provisionCoverageRatio,
      large_exposure_ratio: fact.largeExposureRatio,
      report_status: fact.reportStatus,
      submit_time: formatDateTime(fact.submitTime),
      receive_time: formatDateTime(fact.receiveTime),
    };
  }

  if (table.tableName === "report_metric_item") {
    const fact = buildBankMetricFact(serial, random, runtime);
    runtime.metricFacts.set(fact.id, fact);
    return {
      metric_id: fact.id,
      report_id: fact.report?.id || serial,
      metric_code: fact.metricCode,
      metric_name: fact.metricName,
      metric_category: fact.metricCategory,
      metric_value: fact.metricValue,
      metric_unit: fact.metricUnit,
      warning_threshold: fact.warningThreshold,
      benchmark_value: fact.benchmarkValue,
      warning_flag: fact.warningFlag,
      metric_status: fact.metricStatus,
      calculated_at: formatDateTime(fact.calculatedAt),
      metric_source_system: serial % 2 === 0 ? "风险管理系统" : "监管报送平台",
      metric_owner_name: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "周"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "琪"}`,
      deviation_rate: Number(Math.abs(Number(fact.metricValue) - Number(fact.benchmarkValue || 0)).toFixed(2)),
    };
  }

  if (table.tableName === "risk_exposure_snapshot") {
    const fact = buildBankRiskExposureFact(serial, random, runtime);
    runtime.riskFacts.set(fact.id, fact);
    return {
      snapshot_id: fact.id,
      branch_id: fact.branch?.id || serial,
      snapshot_period: fact.snapshotPeriod,
      credit_risk_exposure: fact.creditRiskExposure,
      market_risk_exposure: fact.marketRiskExposure,
      operational_risk_exposure: fact.operationalRiskExposure,
      liquidity_gap_amount: fact.liquidityGapAmount,
      concentration_ratio: fact.concentrationRatio,
      risk_level: fact.riskLevel,
      snapshot_time: formatDateTime(fact.snapshotTime),
      risk_owner_department: pickOne(["风险管理部", "监管报送部", "授信管理部"], random) || "风险管理部",
      stress_test_result: fact.riskLevel === "预警" ? "压力情景下资本承压" : "压力测试通过",
      capital_buffer_amount: Number((fact.creditRiskExposure * 0.08).toFixed(2)),
      early_warning_level: fact.riskLevel,
      disposal_suggestion: fact.riskLevel === "预警" ? "提高资本缓冲并压降集中度" : "维持现行策略并持续监测",
    };
  }

  if (table.tableName === "anti_money_alert") {
    const fact = buildBankAlertFact(serial, random, runtime);
    runtime.alertFacts.set(fact.id, fact);
    return {
      alert_id: fact.id,
      branch_id: fact.branch?.id || serial,
      alert_no: fact.alertNo,
      alert_type: fact.alertType,
      transaction_amount: fact.transactionAmount,
      currency_code: fact.currencyCode,
      counterparty_name: fact.counterpartyName,
      alert_status: fact.alertStatus,
      review_result: fact.reviewResult,
      alert_time: formatDateTime(fact.alertTime),
      review_time: formatDateTime(fact.reviewTime),
      customer_name: `${pickOne(["华东贸易", "宏达实业", "远航供应链", "智联科技"], random) || "华东贸易"}${serial}号`,
      customer_no: `CIF${String(600000 + serial)}`,
      counterparty_bank_name: pickOne(["中国银行", "交通银行", "招商银行", "建设银行"], random) || "中国银行",
      report_required_status: fact.alertStatus === "已上报" ? "已上报" : "待评估",
    };
  }

  if (table.tableName === "exception_case") {
    const fact = buildBankIssueFact(serial, random, runtime, startedAt);
    runtime.issueFacts.set(fact.id, fact);
    return {
      case_id: fact.id,
      report_id: fact.reportId,
      case_no: fact.caseNo,
      issue_type: fact.issueType,
      issue_level: fact.issueLevel,
      disposal_status: fact.disposalStatus,
      checker_name: fact.checkerName,
      owner_department: fact.ownerDepartment,
      issue_desc: fact.issueDesc,
      identified_at: formatDateTime(fact.identifiedAt),
      due_at: formatDateTime(fact.dueAt),
      disposed_at: formatDateTime(fact.disposedAt),
      regulator_feedback_no: `FB${String(700000 + serial)}`,
      rectification_status: fact.disposalStatus === "已关闭" ? "已完成" : "持续整改",
      recheck_result: fact.disposalStatus === "已关闭" ? "通过" : "待复核",
    };
  }

  if (table.tableName === "rectification_task") {
    const fact = buildBankTaskFact(serial, random, runtime);
    runtime.taskFacts.set(fact.id, fact);
    return {
      task_id: fact.id,
      case_id: fact.issue?.id || serial,
      task_no: fact.taskNo,
      task_type: fact.taskType,
      task_status: fact.taskStatus,
      owner_name: fact.ownerName,
      owner_mobile: fact.ownerMobile,
      owner_department: fact.ownerDepartment,
      create_time: formatDateTime(fact.createTime),
      start_time: formatDateTime(fact.startTime),
      finish_time: formatDateTime(fact.finishTime),
      task_priority: pickOne(["高", "中", "普通"], random) || "中",
      due_date: formatDateTime(new Date(fact.finishTime.getTime() + 2 * 24 * 60 * 60 * 1000)),
      accept_result: "已受理",
      verify_result: fact.taskStatus === "已完成" ? "通过" : "待验证",
    };
  }

  if (table.tableName === "submission_log") {
    const fact = buildBankSubmissionLogFact(serial, random, runtime);
    runtime.submissionFacts.set(fact.id, fact);
    return {
      log_id: fact.id,
      report_id: fact.report?.id || serial,
      submit_batch_no: fact.submitBatchNo,
      submit_channel: fact.submitChannel,
      log_status: fact.logStatus,
      message_type: fact.messageType,
      message_summary: fact.messageSummary,
      event_time: formatDateTime(fact.eventTime),
      receive_code: `ACK${String(800000 + serial)}`,
      receive_message: fact.logStatus === "已退回" ? "校验失败需补正" : "报文已接收",
      retry_count: fact.logStatus === "已退回" ? 1 : 0,
      operator_name: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "杨"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "宁"}`,
      trace_id: `TRACE${String(900000000 + serial)}`,
      payload_checksum: `CHK${String(500000000 + serial)}`,
      archive_status: fact.logStatus === "已接收" ? "已归档" : "待归档",
    };
  }

  if (table.tableName === "approval_flow") {
    const fact = buildBankApprovalFact(serial, random, runtime);
    runtime.approvalFacts.set(fact.id, fact);
    return {
      approval_id: fact.id,
      report_id: fact.report?.id || serial,
      approval_no: fact.approvalNo,
      approval_node: fact.approvalNode,
      approver_name: fact.approverName,
      approval_result: fact.approvalResult,
      approval_time: formatDateTime(fact.approvalTime),
      approval_comment: fact.approvalResult === "通过" ? "口径一致，同意报送" : "请补充支撑材料",
      next_node: fact.approvalResult === "通过" ? "总行备案" : "机构复核",
      node_status: fact.approvalResult === "通过" ? "已完成" : "待处理",
      approver_department: pickOne(["风险管理部", "监管报送部", "合规管理部"], random) || "风险管理部",
      escalation_status: fact.approvalResult === "退回" ? "未升级" : "无需升级",
      archive_status: fact.approvalResult === "通过" ? "已归档" : "待归档",
      callback_status: fact.approvalResult === "通过" ? "已回执" : "待回执",
      process_instance_no: `PROC${String(600000000 + serial)}`,
    };
  }

  if (table.tableName === "customer_account") {
    const fact = buildBankCustomerAccountFact(serial, random, runtime);
    runtime.customerAccountFacts.set(fact.id, fact);
    return {
      account_id: fact.id,
      branch_id: fact.branch?.id || serial,
      account_no: fact.accountNo,
      account_type: fact.accountType,
      customer_name: fact.customerName,
      customer_type: fact.customerType,
      id_no: fact.idNo,
      mobile: fact.mobile,
      currency_code: fact.currencyCode,
      open_date: formatDateTime(fact.openDate),
      close_date: fact.closeDate ? formatDateTime(fact.closeDate) : null,
      account_status: fact.accountStatus,
      balance_amount: fact.balanceAmount,
      available_amount: fact.availableAmount,
      freeze_amount: fact.freezeAmount,
      risk_level: fact.riskLevel,
      manager_name: fact.managerName,
      region_code: fact.regionCode,
      region_name: fact.regionName,
      remark: fact.remark,
    };
  }

  if (table.tableName === "loan_contract_record") {
    const fact = buildBankLoanContractFact(serial, random, runtime);
    runtime.loanContractFacts.set(fact.id, fact);
    return {
      contract_id: fact.id,
      branch_id: fact.branch?.id || serial,
      contract_no: fact.contractNo,
      borrower_name: fact.borrowerName,
      borrower_type: fact.borrowerType,
      loan_type: fact.loanType,
      loan_amount: fact.loanAmount,
      interest_rate: fact.interestRate,
      disbursement_date: formatDateTime(fact.disbursementDate),
      maturity_date: formatDateTime(fact.maturityDate),
      outstanding_amount: fact.outstandingAmount,
      overdue_days: fact.overdueDays,
      collateral_type: fact.collateralType,
      repayment_method: fact.repaymentMethod,
      contract_status: fact.contractStatus,
      manager_name: fact.managerName,
      risk_classification: fact.riskClassification,
      remark: fact.remark,
    };
  }

  return null;
}

function buildFundProductFact(serial, random, profile, baseTime = new Date()) {
  const company = pickOne(profile.fundCompanies || FUND_COMPANY_NAMES, random) || "华夏基金";
  const fundType = pickWeighted(profile.fundProductTypes || FUND_PRODUCT_TYPES, random) || FUND_PRODUCT_TYPES[0];
  const defaultRiskLevels = fundType.code === "BOND"
    ? FUND_RISK_LEVELS.filter((item) => ["R1", "R2", "R3"].includes(item.code))
    : fundType.code === "MONEY_MARKET"
      ? FUND_RISK_LEVELS.filter((item) => ["R1", "R2"].includes(item.code))
      : fundType.code === "INDEX"
        ? FUND_RISK_LEVELS.filter((item) => ["R2", "R3", "R4"].includes(item.code))
        : FUND_RISK_LEVELS;
  const riskLevel = pickWeighted(defaultRiskLevels, random) || defaultRiskLevels[0] || FUND_RISK_LEVELS[0];
  const anchorTime = baseTime instanceof Date ? baseTime : new Date(baseTime);
  const establishedAt = new Date(anchorTime.getTime() - randomIntBetween(180, 3200, random) * 24 * 60 * 60 * 1000);
  const scaleBands = fundType.code === "BOND"
    ? [8e8, 3.2e10]
    : fundType.code === "MONEY_MARKET"
      ? [3e9, 6.5e10]
      : [5e8, 4.2e10];
  const latestScaleAmount = randomNumberBetween(scaleBands[0], scaleBands[1], random);
  const holderCount = Math.max(1800, Math.round(latestScaleAmount / randomNumberBetween(25000, 220000, random)));
  const fundCodeBase = ((hashString(`${company}:${fundType.code}`) + serial * 37) % 900000) + 100000;
  const managementFeeRate = fundType.code === "BOND"
    ? randomNumberBetween(0.15, 0.8, random, 4)
    : fundType.code === "MONEY_MARKET"
      ? randomNumberBetween(0.12, 0.5, random, 4)
      : randomNumberBetween(0.35, 1.8, random, 4);
  const custodyFeeRate = fundType.code === "BOND"
    ? randomNumberBetween(0.05, 0.2, random, 4)
    : randomNumberBetween(0.05, 0.3, random, 4);
  return {
    id: serial,
    fundCode: String(fundCodeBase).padStart(6, "0"),
    fundName: `${company}${fundType.label}${["一号", "精选", "稳健", "成长", "价值", "远航"][serial % 6]}`,
    fundType: fundType.code,
    riskLevel: riskLevel.code,
    managementCompany: company,
    custodianBank: pickOne(BANK_INSTITUTION_NAMES, random) || "中国银行",
    investmentStyle: pickOne(["成长型", "价值型", "稳健型", "增强指数"], random) || "成长型",
    currencyCode: "CNY",
    establishedAt,
    openDate: shiftTime(establishedAt, randomIntBetween(15 * 24 * 60, 120 * 24 * 60, random)),
    closeDate: shiftTime(establishedAt, randomIntBetween(1200 * 24 * 60, 3600 * 24 * 60, random)),
    managementFeeRate,
    custodyFeeRate,
    initialNav: randomNumberBetween(0.95, 1.2, random, 4),
    latestScaleAmount,
    holderCount,
    status: serial % 29 === 0 ? "已清盘" : "正常运作",
  };
}

function buildFundAccountFact(serial, random, runtime) {
  const city = pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
  const investorType = pickWeighted(runtime.profile.investorTypes || FUND_INVESTOR_TYPES, random) || FUND_INVESTOR_TYPES[0];
  const gender = serial % 2 === 0 ? "F" : "M";
  const birthDate = new Date(1970 + (serial % 25), serial % 12, (serial % 27) + 1);
  const investorName = investorType.code === "PERSONAL"
    ? `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "明"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "悦"}`
    : `${pickOne(["华信", "金瑞", "启明", "融泰", "星桥"], random) || "华信"}投资${((serial % 9) + 1)}号`;
  const openTime = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(60, 2400, random) * 24 * 60 * 60 * 1000);
  return {
    id: serial,
    accountNo: `FA${padNumber(200000 + serial, 6)}`,
    investorName,
    investorType: investorType.code,
    certificateType: investorType.code === "PERSONAL" ? "ID_CARD" : "UNIFIED_SOCIAL_CREDIT_CODE",
    certificateNo: investorType.code === "PERSONAL"
      ? buildMainlandIdCard(city.code, birthDate, 910000 + serial, gender)
      : `91310${String(100000000 + serial).slice(-9)}`,
    mobile: buildMainlandMobile(910000 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
    email: buildDomesticEmail(910000 + serial, random, "fund"),
    provinceCode: city.code,
    provinceName: city.name,
    cityCode: city.code,
    cityName: city.name,
    districtCode: `${city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
    districtName: pickOne(city.districts, random) || city.name,
    openChannel: pickWeighted(runtime.profile.tradeChannels || FUND_TRADE_CHANNELS, random)?.code || "APP",
    riskAssessmentLevel: pickWeighted(runtime.profile.fundRiskLevels || FUND_RISK_LEVELS, random)?.code || "R3",
    openTime,
    lastTradeTime: shiftTime(openTime, randomIntBetween(10 * 24 * 60, 800 * 24 * 60, random)),
    totalHoldingAmount: randomNumberBetween(20000, investorType.code === "PERSONAL" ? 8e6 : 1.5e8, random),
    availableBalance: randomNumberBetween(1000, investorType.code === "PERSONAL" ? 3e6 : 3e7, random),
    frozenAmount: randomNumberBetween(0, investorType.code === "PERSONAL" ? 2e5 : 5e6, random),
    accountStatus: serial % 37 === 0 ? "DORMANT" : "ACTIVE",
  };
}

function buildFundSubscriptionFact(serial, random, runtime, startedAt) {
  const fund = pickFactByIndex(runtime.fundProductFacts, serial - 1) || buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
  const account = pickFactByIndex(runtime.fundAccountFacts, serial - 1) || buildFundAccountFact(serial, random, runtime);
  const orderStatus = pickWeighted(runtime.profile.orderStatuses || FUND_ORDER_STATUS, random) || FUND_ORDER_STATUS[0];
  const applyAmount = randomNumberBetween(1000, account.investorType === "PERSONAL" ? 200000 : 5000000, random);
  const applyNav = randomNumberBetween(0.9, 3.5, random, 4);
  const confirmShare = Number((applyAmount / Math.max(applyNav, 0.01)).toFixed(2));
  const applyTime = new Date(startedAt.getTime() - serial * 7 * 60 * 60 * 1000);
  return {
    id: serial,
    fund,
    account,
    subscriptionNo: `SUB${String(300000000 + serial)}`,
    channelCode: pickWeighted(runtime.profile.tradeChannels || FUND_TRADE_CHANNELS, random)?.code || "APP",
    applyTime,
    confirmTime: shiftTime(applyTime, randomIntBetween(4 * 60, 48 * 60, random)),
    settlementTime: shiftTime(applyTime, randomIntBetween(1 * 24 * 60, 3 * 24 * 60, random)),
    applyAmount,
    confirmAmount: Number((applyAmount * randomNumberBetween(0.98, 1, random, 4)).toFixed(2)),
    subscriptionFee: Number((applyAmount * randomNumberBetween(0.001, 0.015, random, 4)).toFixed(2)),
    confirmShare,
    applyNav,
    orderStatus: orderStatus.code,
    paymentStatus: orderStatus.code === "FAILED" ? "FAILED" : orderStatus.code === "CANCELLED" ? "CANCELLED" : "SUCCESS",
    sourceSystem: pickOne(["基金直销平台", "银行代销渠道", "财富管理平台"], random) || "基金直销平台",
    salesAgent: pickOne(["直销柜台", "银行渠道", "第三方代销"], random) || "直销柜台",
    remark: `${fund.fundCode}申购交易`,
  };
}

function buildFundRedemptionFact(serial, random, runtime, startedAt) {
  const fund = pickFactByIndex(runtime.fundProductFacts, serial - 1) || buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
  const account = pickFactByIndex(runtime.fundAccountFacts, serial - 1) || buildFundAccountFact(serial, random, runtime);
  const orderStatus = pickWeighted(runtime.profile.orderStatuses || FUND_ORDER_STATUS, random) || FUND_ORDER_STATUS[1];
  const applyShare = randomNumberBetween(100, account.investorType === "PERSONAL" ? 100000 : 3000000, random, 2);
  const exitNav = randomNumberBetween(0.9, 3.5, random, 4);
  const applyTime = new Date(startedAt.getTime() - serial * 9 * 60 * 60 * 1000);
  return {
    id: serial,
    fund,
    account,
    redemptionNo: `RED${String(400000000 + serial)}`,
    applyTime,
    confirmTime: shiftTime(applyTime, randomIntBetween(4 * 60, 72 * 60, random)),
    paymentTime: shiftTime(applyTime, randomIntBetween(2 * 24 * 60, 6 * 24 * 60, random)),
    applyShare,
    confirmShare: Number((applyShare * randomNumberBetween(0.98, 1, random, 4)).toFixed(2)),
    confirmAmount: Number((applyShare * exitNav).toFixed(2)),
    feeAmount: Number((applyShare * exitNav * randomNumberBetween(0.0005, 0.01, random, 4)).toFixed(2)),
    exitNav,
    holdingDays: randomIntBetween(5, 1200, random),
    orderStatus: orderStatus.code,
    paymentStatus: orderStatus.code === "FAILED" ? "FAILED" : "SUCCESS",
    bankAccountMask: `****${String(1000 + serial).slice(-4)}`,
    remark: `${fund.fundCode}赎回交易`,
  };
}

function buildFundNavFact(serial, random, runtime, startedAt) {
  const fund = pickFactByIndex(runtime.fundProductFacts, serial - 1) || buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
  const navDate = new Date(startedAt.getTime() - serial * 24 * 60 * 60 * 1000);
  const stockPositionRatio = randomNumberBetween(12, 82, random, 2);
  const remainingPosition = Math.max(8, Number((100 - stockPositionRatio).toFixed(2)));
  const bondPositionRatio = randomNumberBetween(5, Math.max(5, remainingPosition - 2), random, 2);
  const cashRatio = Number(Math.max(0.5, 100 - stockPositionRatio - bondPositionRatio).toFixed(2));
  const subscriptionScale = randomNumberBetween(1e6, 6e8, random);
  const redemptionScale = randomNumberBetween(5e5, 4e8, random);
  return {
    id: serial,
    fund,
    navDate,
    unitNav: randomNumberBetween(0.8, 4.2, random, 4),
    accNav: randomNumberBetween(1.0, 8.5, random, 4),
    dailyChangeRate: randomNumberBetween(-4.8, 4.8, random, 4),
    subscriptionScale,
    redemptionScale,
    netInflowAmount: Number((subscriptionScale - redemptionScale).toFixed(2)),
    totalAssetAmount: randomNumberBetween(4e8, 8e10, random),
    stockPositionRatio,
    bondPositionRatio,
    cashRatio,
    holderCount: randomIntBetween(500, 180000, random),
    pricingStatus: "已确认",
  };
}

function buildFundTradeFlowFact(serial, random, runtime, startedAt) {
  const subscription = pickFactByIndex(runtime.fundSubscriptionFacts, serial - 1);
  const redemption = pickFactByIndex(runtime.fundRedemptionFacts, serial - 1);
  const isRedemptionFlow = Boolean(redemption && serial % 2 === 0);
  const resolvedTradeType = isRedemptionFlow ? "\u8d4e\u56de" : "\u7533\u8d2d";
  const resolvedReference = isRedemptionFlow ? redemption : (subscription || buildFundSubscriptionFact(serial, random, runtime, startedAt));
  return {
    id: serial,
    fund: resolvedReference.fund,
    account: resolvedReference.account,
    tradeFlowNo: `TF${String(500000000 + serial)}`,
    tradeType: resolvedTradeType,
    channelCode: resolvedReference.channelCode || pickWeighted(runtime.profile.tradeChannels || FUND_TRADE_CHANNELS, random)?.code || "BANK",
    tradeTime: resolvedReference.applyTime,
    confirmTime: resolvedReference.confirmTime,
    tradeAmount: resolvedReference.confirmAmount || resolvedReference.applyAmount,
    tradeShare: resolvedReference.confirmShare,
    feeAmount: resolvedReference.subscriptionFee || resolvedReference.feeAmount || 0,
    postTradeHolding: randomNumberBetween(5000, 2e7, random),
    tradeStatus: resolvedReference.orderStatus,
    operatorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738b"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5b81"}`,
    sourceSystem: resolvedReference.sourceSystem || "鍩洪噾鐩撮攢骞冲彴",
    remark: `${resolvedTradeType}\u6d41\u6c34`,
  };
}

function buildLogisticsWaybillFact(serial, random, runtime, startedAt) {
  const city = pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
  const company = pickWeighted(runtime.profile.expressCompanies || LOGISTICS_EXPRESS_COMPANIES, random) || LOGISTICS_EXPRESS_COMPANIES[0];
  const transportMode = pickWeighted(runtime.profile.transportModes || LOGISTICS_TRANSPORT_MODES, random) || LOGISTICS_TRANSPORT_MODES[0];
  const status = pickWeighted(runtime.profile.waybillStatuses || LOGISTICS_WAYBILL_STATUS, random) || LOGISTICS_WAYBILL_STATUS[0];
  const createTime = new Date(startedAt.getTime() - serial * 3 * 60 * 60 * 1000);
  return {
    id: serial,
    company,
    city,
    waybillNo: `${company.code}${String(600000000 + serial)}`,
    transportMode: transportMode.code,
    senderName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Li"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Na"}`,
    senderMobile: buildMainlandMobile(920000 + serial, random),
    receiverName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Chen"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Wei"}`,
    receiverMobile: buildMainlandMobile(930000 + serial, random),
    provinceCode: city.code,
    provinceName: city.name,
    cityCode: city.code,
    cityName: city.name,
    districtCode: `${city.code.slice(0, 4)}${String((serial % 90) + 10).padStart(2, "0")}`,
    districtName: pickOne(city.districts, random) || city.name,
    pickupAddress: `${city.name}${pickOne(city.districts, random) || city.name}${pickOne(["科技路", "人民路", "创业大道", "解放路"], random) || "科技路"}${(serial % 90) + 1}号`,
    deliveryAddress: `${city.name}${pickOne(city.districts, random) || city.name}${pickOne(["学院路", "和平路", "新华路", "建设路"], random) || "学院路"}${(serial % 120) + 1}号`,
    weightKg: randomNumberBetween(0.2, 35, random, 2),
    volumeCm3: randomNumberBetween(200, 220000, random, 2),
    freightAmount: randomNumberBetween(8, 380, random),
    waybillStatus: status.code,
    createTime,
    collectTime: shiftTime(createTime, randomIntBetween(15, 240, random)),
    deliveryDeadline: shiftTime(createTime, randomIntBetween(12 * 60, 96 * 60, random)),
  };
}

function buildLogisticsPackageFact(serial, random, runtime) {
  const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, getRuntimeBaseTime(runtime));
  return {
    id: serial,
    waybill,
    packageNo: `${waybill.waybillNo}-${(serial % 3) + 1}`,
    itemCategory: pickOne(["数码产品", "日用品", "食品", "文件资料", "医药用品"], random) || "日用品",
    itemName: pickOne(["手机配件", "笔记本电脑", "零食礼盒", "合同文件", "保健品"], random) || "手机配件",
    itemQuantity: randomIntBetween(1, 12, random),
    itemWeightKg: randomNumberBetween(0.1, 12, random, 2),
    declaredAmount: randomNumberBetween(50, 20000, random),
    packageType: pickOne(["纸箱", "编织袋", "木箱", "文件封"], random) || "纸箱",
    fragileFlag: serial % 5 === 0 ? "是" : "否",
    temperatureRequire: pickOne(["常温", "冷藏", "冷冻"], random) || "常温",
    securityCheckStatus: "已安检",
    insuranceFlag: serial % 4 === 0 ? "是" : "否",
    insuredAmount: serial % 4 === 0 ? randomNumberBetween(500, 5000, random) : 0,
    remark: `${waybill.waybillNo}包裹明细`,
  };
}

function buildLogisticsRouteFact(serial, random, runtime, options = {}) {
  const city = options.originCity || pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
  const mode = options.transportMode || pickWeighted(runtime.profile.transportModes || LOGISTICS_TRANSPORT_MODES, random) || LOGISTICS_TRANSPORT_MODES[0];
  const cityCandidates = (runtime.profile.cities || []).filter((item) => item.code !== city.code);
  const destination = mode.code === "SAME_CITY"
    ? city
    : (options.destinationCity || pickOne(cityCandidates, random) || runtime.profile.cities[1] || city);
  const distanceKm = mode.code === "SAME_CITY"
    ? randomNumberBetween(3, 45, random, 1)
    : randomNumberBetween(80, 2400, random, 1);
  const plannedDurationHours = mode.code === "SAME_CITY"
    ? randomIntBetween(1, 8, random)
    : mode.code === "AIR"
      ? randomIntBetween(4, 16, random)
      : randomIntBetween(8, 72, random);
  const plannedStopCount = mode.code === "SAME_CITY"
    ? randomIntBetween(0, 3, random)
    : randomIntBetween(1, 8, random);
  const routeLevel = mode.code === "SAME_CITY"
    ? "末端配送"
    : pickOne(["干线", "支线"], random) || "干线";
  return {
    id: serial,
    routeCode: `RT${padNumber(700000 + serial, 6)}`,
    routeName: `${city.name}-${destination.name}-${mode.label}`,
    originSite: `${city.name}分拨中心`,
    destinationSite: `${destination.name}配送中心`,
    transportMode: mode.code,
    sortCenterName: `${pickOne([city.name, destination.name], random)}集散中心`,
    distanceKm,
    plannedDurationHours,
    plannedStopCount,
    routeLevel,
    routeStatus: "启用",
    effectiveTime: new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(30, 540, random) * 24 * 60 * 60 * 1000),
    expireTime: new Date(getRuntimeBaseTime(runtime).getTime() + randomIntBetween(120, 720, random) * 24 * 60 * 60 * 1000),
    remark: "标准物流线路",
  };
}

function buildLogisticsTransferFact(serial, random, runtime, startedAt) {
  const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, startedAt);
  const preferredMode = (runtime.profile.transportModes || LOGISTICS_TRANSPORT_MODES).find((item) => item.code === waybill.transportMode) || { code: waybill.transportMode, label: waybill.transportMode };
  const route = pickFactByIndex(runtime.logisticsRouteFacts, serial - 1) || buildLogisticsRouteFact(serial, random, runtime, {
    originCity: waybill.city,
    destinationCity: preferredMode.code === "SAME_CITY" ? waybill.city : undefined,
    transportMode: preferredMode,
  });
  const arriveTime = new Date(startedAt.getTime() - serial * 2 * 60 * 60 * 1000);
  return {
    id: serial,
    waybill,
    route,
    transferNo: `TR${String(800000000 + serial)}`,
    currentSite: route.originSite,
    nextSite: route.destinationSite,
    transportMode: route.transportMode,
    scanType: pickOne(["到达扫描", "发出扫描", "分拣扫描"], random) || "到达扫描",
    arriveTime,
    departTime: shiftTime(arriveTime, randomIntBetween(20, 360, random)),
    stayMinutes: randomIntBetween(20, 360, random),
    transferStatus: pickOne(["已完成", "待发运", "已装车"], random) || "已完成",
    operatorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "赵"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "雷"}`,
    vehicleNo: `VH${padNumber(1000 + serial, 5)}`,
    remark: `${waybill.waybillNo}中转记录`,
  };
}

function buildLogisticsSignFact(serial, random, runtime, startedAt) {
  const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, startedAt);
  const outboundTime = new Date(startedAt.getTime() - serial * 90 * 60 * 1000);
  const signStatusOptions = waybill.waybillStatus === "EXCEPTION"
    ? ["\u7b7e\u6536\u5931\u8d25"]
    : ["\u5df2\u7b7e\u6536", "\u5ba2\u6237\u81ea\u63d0", "\u7b7e\u6536\u5931\u8d25"];
  /*
  const signStatusOptions = waybill.waybillStatus === "EXCEPTION" ? ["绛炬敹澶辫触"] : ["宸茬鏀?, "瀹㈡埛鑷彁", "绛炬敹澶辫触"];
  */
  const resolvedSignStatus = pickOne(signStatusOptions, random) || signStatusOptions[0];
  /*
  const failedSign = resolvedSignStatus === "绛炬敹澶辫触";
  */
  const failedSign = resolvedSignStatus === "\u7b7e\u6536\u5931\u8d25";
  const deliverTime = shiftTime(outboundTime, randomIntBetween(15, 480, random));
  const signStatus = waybill.waybillStatus === "EXCEPTION" ? "签收失败" : pickOne(["已签收", "客户自提", "签收失败"], random) || "已签收";
  return {
    id: serial,
    waybill,
    signNo: `SG${String(900000000 + serial)}`,
    courierName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "孙"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "鹏"}`,
    courierMobile: buildMainlandMobile(940000 + serial, random),
    outboundTime,
    deliverTime: shiftTime(outboundTime, randomIntBetween(15, 480, random)),
    signTime: signStatus === "绛炬敹澶辫触" ? null : shiftTime(outboundTime, randomIntBetween(20, 520, random)),
    signStatus,
    signerName: signStatus === "绛炬敹澶辫触" ? "" : waybill.receiverName,
    signerRelation: pickOne(["本人", "家属", "前台", "保安"], random) || "本人",
    signMethod: pickOne(["拍照签收", "电子签名", "验证码签收"], random) || "拍照签收",
    deliverTime,
    signTime: failedSign ? null : shiftTime(deliverTime, randomIntBetween(10, 180, random)),
    signStatus: resolvedSignStatus,
    signerName: failedSign ? "" : waybill.receiverName,
    proofNo: `PF${padNumber(200000 + serial, 6)}`,
    distanceToReceiverKm: randomNumberBetween(0.1, 28, random, 2),
    remark: `${waybill.waybillNo}签收记录`,
  };
}

function buildLogisticsExceptionFact(serial, random, runtime, startedAt) {
  const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, startedAt);
  const exceptionType = pickWeighted(runtime.profile.exceptionTypes || LOGISTICS_EXCEPTION_TYPES, random) || LOGISTICS_EXCEPTION_TYPES[0];
  const discoverTime = new Date(startedAt.getTime() - serial * 4 * 60 * 60 * 1000);
  return {
    id: serial,
    waybill,
    exceptionNo: `EX${String(100000000 + serial)}`,
    exceptionType: exceptionType.code,
    exceptionLevel: pickOne(["一般", "重要", "紧急"], random) || "重要",
    responsibleSite: `${waybill.cityName}营业部`,
    discoverTime,
    closeTime: shiftTime(discoverTime, randomIntBetween(2 * 60, 72 * 60, random)),
    exceptionStatus: pickOne(["待处理", "处理中", "已关闭"], random) || "处理中",
    customerFeedback: pickOne(["延误投诉", "地址有误", "包裹破损", "要求再次派送"], random) || "延误投诉",
    handlingOwner: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "刘"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "强"}`,
    solutionType: pickOne(["重新派送", "赔付处理", "退回寄件方", "联系客户确认"], random) || "重新派送",
    compensationAmount: randomNumberBetween(0, 600, random),
    overtimeFlag: serial % 6 === 0 ? 1 : 0,
    remark: `${waybill.waybillNo}异常工单`,
  };
}

function generateFinanceFundRow(table, serial, runtime, startedAt) {
  const random = createSeededRandom(hashString(`${runtime.sceneCode}:${table.tableName}:${serial}`));

  if (table.tableName === "fund_product") {
    const fact = buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
    runtime.fundProductFacts.set(fact.id, fact);
    return {
      fund_id: fact.id,
      fund_code: fact.fundCode,
      fund_name: fact.fundName,
      fund_type: fact.fundType,
      risk_level: fact.riskLevel,
      management_company: fact.managementCompany,
      custodian_bank: fact.custodianBank,
      investment_style: fact.investmentStyle,
      currency_code: fact.currencyCode,
      established_at: formatDateTime(fact.establishedAt),
      open_date: formatDateTime(fact.openDate),
      close_date: formatDateTime(fact.closeDate),
      management_fee_rate: fact.managementFeeRate,
      custody_fee_rate: fact.custodyFeeRate,
      initial_nav: fact.initialNav,
      latest_scale_amount: fact.latestScaleAmount,
      holder_count: fact.holderCount,
      status: fact.status,
    };
  }

  if (table.tableName === "fund_account") {
    const fact = buildFundAccountFact(serial, random, runtime);
    runtime.fundAccountFacts.set(fact.id, fact);
    return {
      account_id: fact.id,
      account_no: fact.accountNo,
      investor_name: fact.investorName,
      investor_type: fact.investorType,
      certificate_type: fact.certificateType,
      certificate_no: fact.certificateNo,
      mobile: fact.mobile,
      email: fact.email,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      open_channel: fact.openChannel,
      risk_assessment_level: fact.riskAssessmentLevel,
      open_time: formatDateTime(fact.openTime),
      last_trade_time: formatDateTime(fact.lastTradeTime),
      total_holding_amount: fact.totalHoldingAmount,
      available_balance: fact.availableBalance,
      frozen_amount: fact.frozenAmount,
      account_status: fact.accountStatus,
    };
  }

  if (table.tableName === "fund_subscription_order") {
    const fact = buildFundSubscriptionFact(serial, random, runtime, startedAt);
    runtime.fundSubscriptionFacts.set(fact.id, fact);
    return {
      subscription_id: fact.id,
      fund_id: fact.fund.id,
      account_id: fact.account.id,
      subscription_no: fact.subscriptionNo,
      channel_code: fact.channelCode,
      apply_time: formatDateTime(fact.applyTime),
      confirm_time: formatDateTime(fact.confirmTime),
      settlement_time: formatDateTime(fact.settlementTime),
      apply_amount: fact.applyAmount,
      confirm_amount: fact.confirmAmount,
      subscription_fee: fact.subscriptionFee,
      confirm_share: fact.confirmShare,
      apply_nav: fact.applyNav,
      order_status: fact.orderStatus,
      payment_status: fact.paymentStatus,
      order_source_system: fact.sourceSystem,
      sales_agent: fact.salesAgent,
      remark: fact.remark,
    };
  }

  if (table.tableName === "fund_redemption_order") {
    const fact = buildFundRedemptionFact(serial, random, runtime, startedAt);
    runtime.fundRedemptionFacts.set(fact.id, fact);
    return {
      redemption_id: fact.id,
      fund_id: fact.fund.id,
      account_id: fact.account.id,
      redemption_no: fact.redemptionNo,
      apply_time: formatDateTime(fact.applyTime),
      confirm_time: formatDateTime(fact.confirmTime),
      payment_time: formatDateTime(fact.paymentTime),
      apply_share: fact.applyShare,
      confirm_share: fact.confirmShare,
      confirm_amount: fact.confirmAmount,
      fee_amount: fact.feeAmount,
      exit_nav: fact.exitNav,
      holding_days: fact.holdingDays,
      order_status: fact.orderStatus,
      payment_status: fact.paymentStatus,
      bank_account_mask: fact.bankAccountMask,
      remark: fact.remark,
    };
  }

  if (table.tableName === "fund_nav_snapshot") {
    const fact = buildFundNavFact(serial, random, runtime, startedAt);
    runtime.fundNavFacts.set(fact.id, fact);
    return {
      snapshot_id: fact.id,
      fund_id: fact.fund.id,
      nav_date: formatDateTime(fact.navDate),
      unit_nav: fact.unitNav,
      acc_nav: fact.accNav,
      daily_change_rate: fact.dailyChangeRate,
      subscription_scale: fact.subscriptionScale,
      redemption_scale: fact.redemptionScale,
      net_inflow_amount: fact.netInflowAmount,
      total_asset_amount: fact.totalAssetAmount,
      stock_position_ratio: fact.stockPositionRatio,
      bond_position_ratio: fact.bondPositionRatio,
      cash_ratio: fact.cashRatio,
      holder_count: fact.holderCount,
      pricing_status: fact.pricingStatus,
    };
  }

  if (table.tableName === "fund_trading_flow") {
    const fact = buildFundTradeFlowFact(serial, random, runtime, startedAt);
    runtime.fundTradeFacts.set(fact.id, fact);
    return {
      trade_flow_id: fact.id,
      fund_id: fact.fund.id,
      account_id: fact.account.id,
      trade_flow_no: fact.tradeFlowNo,
      trade_type: fact.tradeType,
      channel_code: fact.channelCode,
      trade_time: formatDateTime(fact.tradeTime),
      confirm_time: formatDateTime(fact.confirmTime),
      trade_amount: fact.tradeAmount,
      trade_share: fact.tradeShare,
      fee_amount: fact.feeAmount,
      post_trade_holding: fact.postTradeHolding,
      trade_status: fact.tradeStatus,
      operator_name: fact.operatorName,
      trade_source_system: fact.sourceSystem,
      remark: fact.remark,
    };
  }

  return null;
}

function generateLogisticsExpressRow(table, serial, runtime, startedAt) {
  const random = createSeededRandom(hashString(`${runtime.sceneCode}:${table.tableName}:${serial}`));

  if (table.tableName === "logistics_waybill") {
    const fact = buildLogisticsWaybillFact(serial, random, runtime, startedAt);
    runtime.logisticsWaybillFacts.set(fact.id, fact);
    return {
      waybill_id: fact.id,
      waybill_no: fact.waybillNo,
      express_company: fact.company.label,
      transport_mode: fact.transportMode,
      sender_name: fact.senderName,
      sender_mobile: fact.senderMobile,
      receiver_name: fact.receiverName,
      receiver_mobile: fact.receiverMobile,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      pickup_address: fact.pickupAddress,
      delivery_address: fact.deliveryAddress,
      weight_kg: fact.weightKg,
      volume_cm3: fact.volumeCm3,
      freight_amount: fact.freightAmount,
      waybill_status: fact.waybillStatus,
      create_time: formatDateTime(fact.createTime),
      collect_time: formatDateTime(fact.collectTime),
      delivery_deadline: formatDateTime(fact.deliveryDeadline),
    };
  }

  if (table.tableName === "logistics_package_item") {
    const fact = buildLogisticsPackageFact(serial, random, runtime);
    runtime.logisticsPackageFacts.set(fact.id, fact);
    return {
      package_id: fact.id,
      waybill_id: fact.waybill.id,
      package_no: fact.packageNo,
      item_category: fact.itemCategory,
      item_name: fact.itemName,
      item_quantity: fact.itemQuantity,
      item_weight_kg: fact.itemWeightKg,
      declared_amount: fact.declaredAmount,
      package_type: fact.packageType,
      fragile_flag: fact.fragileFlag,
      temperature_require: fact.temperatureRequire,
      security_check_status: fact.securityCheckStatus,
      insurance_flag: fact.insuranceFlag,
      insured_amount: fact.insuredAmount,
      remark: fact.remark,
    };
  }

  if (table.tableName === "logistics_delivery_route") {
    const fact = buildLogisticsRouteFact(serial, random, runtime);
    runtime.logisticsRouteFacts.set(fact.id, fact);
    return {
      route_id: fact.id,
      route_code: fact.routeCode,
      route_name: fact.routeName,
      origin_site: fact.originSite,
      destination_site: fact.destinationSite,
      transport_mode: fact.transportMode,
      sort_center_name: fact.sortCenterName,
      distance_km: fact.distanceKm,
      planned_duration_hours: fact.plannedDurationHours,
      planned_stop_count: fact.plannedStopCount,
      route_level: fact.routeLevel,
      route_status: fact.routeStatus,
      effective_time: formatDateTime(fact.effectiveTime),
      expire_time: formatDateTime(fact.expireTime),
      remark: fact.remark,
    };
  }

  if (table.tableName === "logistics_transfer_record") {
    const fact = buildLogisticsTransferFact(serial, random, runtime, startedAt);
    runtime.logisticsTransferFacts.set(fact.id, fact);
    return {
      transfer_id: fact.id,
      waybill_id: fact.waybill.id,
      route_id: fact.route.id,
      transfer_no: fact.transferNo,
      current_site: fact.currentSite,
      next_site: fact.nextSite,
      transport_mode: fact.transportMode,
      scan_type: fact.scanType,
      arrive_time: formatDateTime(fact.arriveTime),
      depart_time: formatDateTime(fact.departTime),
      stay_minutes: fact.stayMinutes,
      transfer_status: fact.transferStatus,
      operator_name: fact.operatorName,
      vehicle_no: fact.vehicleNo,
      remark: fact.remark,
    };
  }

  if (table.tableName === "logistics_sign_record") {
    const fact = buildLogisticsSignFact(serial, random, runtime, startedAt);
    runtime.logisticsSignFacts.set(fact.id, fact);
    return {
      sign_id: fact.id,
      waybill_id: fact.waybill.id,
      sign_no: fact.signNo,
      courier_name: fact.courierName,
      courier_mobile: fact.courierMobile,
      outbound_time: formatDateTime(fact.outboundTime),
      deliver_time: formatDateTime(fact.deliverTime),
      sign_time: fact.signTime ? formatDateTime(fact.signTime) : null,
      sign_status: fact.signStatus,
      signer_name: fact.signerName,
      signer_relation: fact.signerRelation,
      sign_method: fact.signMethod,
      proof_no: fact.proofNo,
      distance_to_receiver_km: fact.distanceToReceiverKm,
      remark: fact.remark,
    };
  }

  if (table.tableName === "logistics_exception_ticket") {
    const fact = buildLogisticsExceptionFact(serial, random, runtime, startedAt);
    runtime.logisticsExceptionFacts.set(fact.id, fact);
    return {
      exception_id: fact.id,
      waybill_id: fact.waybill.id,
      exception_no: fact.exceptionNo,
      exception_type: fact.exceptionType,
      exception_level: fact.exceptionLevel,
      responsible_site: fact.responsibleSite,
      discover_time: formatDateTime(fact.discoverTime),
      close_time: formatDateTime(fact.closeTime),
      exception_status: fact.exceptionStatus,
      customer_feedback: fact.customerFeedback,
      handling_owner: fact.handlingOwner,
      solution_type: fact.solutionType,
      compensation_amount: fact.compensationAmount,
      overtime_flag: fact.overtimeFlag,
      remark: fact.remark,
    };
  }

  return null;
}

function getEducationStageFromGrade(gradeCode) {
  const code = String(gradeCode || "");
  if (code.startsWith("PG")) return "POSTGRAD";
  if (code.startsWith("UG")) return "UNDERGRAD";
  if (code.startsWith("P")) return "PRIMARY";
  if (code.startsWith("J")) return "JUNIOR";
  if (code.startsWith("H")) return "HIGH";
  return "VOCATIONAL";
}

function getEducationGradeOffset(gradeCode) {
  const code = String(gradeCode || "");
  if (code.startsWith("PG")) return 16 + Math.max(0, Number(code.slice(2) || 1) - 1);
  if (code.startsWith("UG")) return 12 + Math.max(0, Number(code.slice(2) || 1) - 1);
  if (code.startsWith("P")) return Math.max(0, Number(code.slice(1) || 1) - 1);
  if (code.startsWith("J")) return 6 + Math.max(0, Number(code.slice(1) || 1) - 1);
  if (code.startsWith("H")) return 9 + Math.max(0, Number(code.slice(1) || 1) - 1);
  return 12;
}

function findOptionLabel(options, code, fallback = "") {
  return (Array.isArray(options) ? options.find((item) => item.code === code) : null)?.label || fallback || code;
}

function buildAreaCode(cityCode) {
  const mapping = {
    "310000": "021",
    "320100": "025",
    "330100": "0571",
    "440300": "0755",
    "510100": "028",
  };
  return mapping[cityCode] || "010";
}

function buildPostalCode(cityCode, serial) {
  const mapping = {
    "310000": 200000,
    "320100": 210000,
    "330100": 310000,
    "440300": 518000,
    "510100": 610000,
  };
  return padNumber((mapping[cityCode] || 100000) + (Number(serial || 0) % 200), 6);
}

function buildEducationCampusFact(serial, random, profile) {
  const city = pickOne(profile.cities, random) || profile.cities[0];
  const weightedSchoolTypes = applyWeightOverride(profile.schoolTypes || EDUCATION_SCHOOL_TYPES, getDistributionRuleConfig(profile, "school_type_ratio"));
  const schoolType = pickWeighted(weightedSchoolTypes, random) || weightedSchoolTypes[0] || EDUCATION_SCHOOL_TYPES[0];
  const stageOptions = Array.isArray(profile.educationStages) && profile.educationStages.length > 0 ? profile.educationStages : EDUCATION_STAGES;
  const stage = pickWeighted(stageOptions, random) || stageOptions[0] || EDUCATION_STAGES[0];
  const campusName = Array.isArray(profile.campusNames) && profile.campusNames.length > 0
    ? profile.campusNames[(serial - 1) % profile.campusNames.length]
    : `${city.name}${pickOne(["实验", "育才", "博雅", "星河", "文澜"], random) || "实验"}${schoolType.label}`;
  return {
    id: serial,
    city,
    campusCode: `CAMP${city.code.slice(-4)}${padNumber(serial, 3)}`,
    schoolCode: `SCH${city.code.slice(0, 4)}${padNumber(serial, 5)}`,
    campusName,
    schoolName: campusName,
    schoolType: schoolType.code,
    educationStage: stage.code,
    districtCode: `${city.code.slice(0, 4)}${padNumber((serial % 90) + 10, 2)}`,
    districtName: pickOne(city.districts, random) || city.name,
    campusAddress: `${city.name}${pickOne(["教育路", "文汇路", "学院路", "书香大道", "育才路"], random) || "教育路"}${(serial % 180) + 18}号`,
    postalCode: buildPostalCode(city.code, serial),
    officePhone: buildMainlandMobile(150000 + serial, random),
    principalName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "李"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "明"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "轩"}`,
    principalMobile: buildMainlandMobile(500000 + serial, random),
    supportHotline: buildMainlandMobile(160000 + serial, random),
    capacityCount: randomIntBetween(800, 38000, random),
    status: serial % 17 === 0 ? "SUSPENDED" : "ACTIVE",
    establishedAt: new Date(1995 + (serial % 20), serial % 12, (serial % 27) + 1),
    campusCardPrefix: `AC${city.code.slice(-2)}${padNumber(serial % 90, 2)}`,
    libraryCardPrefix: `LIB${city.code.slice(-2)}${padNumber(serial % 90, 2)}`,
  };
}

function buildEducationStudentFact(serial, random, runtime) {
  const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
  const gender = serial % 2 === 0 ? "F" : "M";
  const familyName = pickOne(CUSTOMER_FAMILY_NAMES, random) || "王";
  const givenName = `${pickOne(CUSTOMER_GIVEN_NAMES, random) || "若"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "安"}`;
  const gradeOptions = Array.isArray(runtime.profile.gradeCodes) && runtime.profile.gradeCodes.length > 0 ? runtime.profile.gradeCodes : EDUCATION_GRADE_CODES;
  const stageSpecificGrades = gradeOptions.filter((item) => getEducationStageFromGrade(item.code) === campus.educationStage);
  const grade = pickWeighted(stageSpecificGrades.length > 0 ? stageSpecificGrades : gradeOptions, random) || gradeOptions[0];
  const gradeOffset = getEducationGradeOffset(grade.code);
  const entranceYear = 2026 - gradeOffset;
  const expectedGraduationYear = entranceYear + (campus.educationStage === "PRIMARY" ? 6 : campus.educationStage === "JUNIOR" ? 3 : campus.educationStage === "HIGH" ? 3 : campus.educationStage === "UNDERGRAD" ? 4 : 2);
  const ageBase = campus.educationStage === "PRIMARY" ? 7 : campus.educationStage === "JUNIOR" ? 13 : campus.educationStage === "HIGH" ? 16 : campus.educationStage === "UNDERGRAD" ? 19 : 23;
  const birthDate = new Date(2026 - ageBase, serial % 12, (serial % 27) + 1);
  const classNo = padNumber((serial % 12) + 1, 2);
  const districtName = pickOne(campus.city.districts, random) || campus.city.name;
  return {
    id: serial,
    campus,
    studentNo: `STU${String(entranceYear)}${campus.campusCode.slice(-3)}${grade.code}${padNumber((serial % 900) + 100, 3)}`,
    studentName: `${familyName}${givenName}`,
    gender,
    birthDate,
    idCardNo: buildMainlandIdCard(campus.city.code, birthDate, serial, gender),
    studentMobile: buildMainlandMobile(200000 + serial, random),
    studentEmail: buildDomesticEmail(serial, random, "student"),
    educationStage: campus.educationStage,
    gradeCode: grade.code,
    classCode: `${grade.code}${classNo}`,
    className: `${findOptionLabel(gradeOptions, grade.code, grade.code)} Class ${Number(classNo)}`,
    entranceYear,
    expectedGraduationYear,
    studentStatus: serial % 41 === 0 ? "LEAVE" : serial % 29 === 0 ? "SUSPENDED" : "ACTIVE",
    accessCardNo: `${campus.campusCardPrefix}${padNumber(10000 + serial, 5)}`,
    libraryCardNo: `${campus.libraryCardPrefix}${padNumber(10000 + serial, 5)}`,
    guardianName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "张"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "伟"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "华"}`,
    guardianMobile: buildMainlandMobile(300000 + serial, random),
    provinceCode: campus.city.code,
    provinceName: campus.city.name,
    cityCode: campus.city.code,
    cityName: campus.city.name,
    districtCode: campus.districtCode,
    districtName,
    homeAddress: `${campus.city.name}${districtName}${pickOne(["书香苑", "学府里", "文澜花园", "星河城", "锦绣家园"], random) || "学府里"}${(serial % 20) + 1}栋${(serial % 4) + 1}单元${(serial % 260) + 101}室`,
    postalCode: buildPostalCode(campus.city.code, serial),
  };
}

function buildEducationGuardianFact(serial, random, runtime) {
  const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
  const relationType = pickOne(["FATHER", "MOTHER", "GRANDFATHER", "GRANDMOTHER", "AUNT"], random) || "MOTHER";
  return {
    id: serial,
    student,
    guardianNo: `GDN${student.studentNo.slice(-8)}${padNumber((serial % 80) + 10, 2)}`,
    guardianName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "陈"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "佳"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "宁"}`,
    relationType,
    guardianMobile: buildMainlandMobile(400000 + serial, random),
    guardianEmail: buildDomesticEmail(serial, random, "guardian"),
    emergencyPhone: buildMainlandMobile(140000 + serial, random),
    occupationName: pickOne(["Civil Servant", "Teacher", "Engineer", "Operator", "Self-employed"], random) || "Engineer",
    companyName: `${pickOne(["智联科技", "锦程服务", "远航贸易", "星河实业", "华誉工程"], random) || "智慧服务"}${(serial % 8) + 1}`,
    provinceCode: student.provinceCode,
    provinceName: student.provinceName,
    cityCode: student.cityCode,
    cityName: student.cityName,
    districtCode: student.districtCode,
    districtName: student.districtName,
    addressDetail: student.homeAddress,
    primaryFlag: relationType === "MOTHER" || relationType === "FATHER" ? 1 : 0,
    messageChannel: pickOne(["SMS", "WECHAT", "APP"], random) || "WECHAT",
    lastContactTime: new Date(Date.now() - randomIntBetween(1, 45, random) * 24 * 60 * 60 * 1000),
  };
}

function buildEducationStaffFact(serial, random, runtime) {
  const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
  const role = pickWeighted(runtime.profile.staffRoles || EDUCATION_STAFF_ROLES, random) || EDUCATION_STAFF_ROLES[0];
  const subject = pickWeighted(runtime.profile.subjectCodes || EDUCATION_SUBJECTS, random) || EDUCATION_SUBJECTS[0];
  const gender = serial % 2 === 0 ? "F" : "M";
  const birthDate = new Date(1976 + (serial % 20), serial % 12, (serial % 27) + 1);
  return {
    id: serial,
    campus,
    staffNo: `EMP${campus.campusCode.slice(-3)}${role.code.slice(0, 2)}${padNumber(10000 + serial, 5)}`,
    staffName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Li"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ming"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yu"}`,
    gender,
    idCardNo: buildMainlandIdCard(campus.city.code, birthDate, 5000 + serial, gender),
    staffMobile: buildMainlandMobile(600000 + serial, random),
    staffEmail: buildDomesticEmail(serial, random, "staff"),
    roleCode: role.code,
    subjectCode: role.code === "TEACHER" || role.code === "COUNSELOR" ? subject.code : "GENERAL",
    titleName: role.code === "HEADMASTER" ? "Headmaster" : role.code === "TEACHER" ? pickOne(["Senior Teacher", "Associate Teacher", "Lecturer"], random) || "Lecturer" : pickOne(["Manager", "Officer", "Specialist"], random) || "Officer",
    departmentName: role.code === "FINANCE" ? "Finance Office" : role.code === "ACADEMIC_AFFAIRS" ? "Academic Affairs Office" : role.code === "LIBRARIAN" ? "Library" : role.code === "SECURITY" ? "Campus Security" : "Teaching Department",
    hireDate: new Date(2006 + (serial % 14), serial % 12, (serial % 27) + 1),
    employmentStatus: serial % 37 === 0 ? "LEAVE" : "ACTIVE",
    teacherLicenseNo: role.code === "TEACHER" ? `TLC${campus.city.code.slice(-4)}${padNumber(200000 + serial, 6)}` : "",
    accessCardNo: `${campus.campusCardPrefix}${padNumber(50000 + serial, 5)}`,
    officeLocation: `${pickOne(["Teaching Building A", "Teaching Building B", "Innovation Center", "Admin Building"], random) || "Teaching Building A"}-${(serial % 8) + 1}${String.fromCharCode(65 + (serial % 6))}`,
    provinceCode: campus.city.code,
    provinceName: campus.city.name,
    cityCode: campus.city.code,
    cityName: campus.city.name,
    districtCode: campus.districtCode,
    districtName: campus.districtName,
    homeAddress: `${campus.city.name}${campus.districtName}${pickOne(["Scholar Garden", "Moonlight Court", "Lakeview Home", "Jade Residence"], random) || "Scholar Garden"}${(serial % 18) + 1}栋${(serial % 3) + 1}单元${(serial % 200) + 101}室`,
    postalCode: buildPostalCode(campus.city.code, serial),
    supervisorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Zhou"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Si"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yuan"}`,
  };
}

function buildEducationCourseFact(serial, random, runtime) {
  const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
  const subject = pickWeighted(runtime.profile.subjectCodes || EDUCATION_SUBJECTS, random) || EDUCATION_SUBJECTS[0];
  const grade = pickWeighted(runtime.profile.gradeCodes || EDUCATION_GRADE_CODES, random) || EDUCATION_GRADE_CODES[0];
  const term = pickWeighted(runtime.profile.termCodes || EDUCATION_TERM_CODES, random) || EDUCATION_TERM_CODES[0];
  const teacher = pickFactByIndex(runtime.staffFacts, serial - 1);
  return {
    id: serial,
    campus,
    courseCode: `CRS${campus.campusCode.slice(-3)}${subject.code.slice(0, 3)}${padNumber(serial, 4)}`,
    courseName: `${findOptionLabel(runtime.profile.subjectCodes || EDUCATION_SUBJECTS, subject.code, subject.code)} ${findOptionLabel(runtime.profile.gradeCodes || EDUCATION_GRADE_CODES, grade.code, grade.code)}`,
    subjectCode: subject.code,
    educationStage: getEducationStageFromGrade(grade.code),
    gradeCode: grade.code,
    termCode: term.code,
    creditValue: getEducationStageFromGrade(grade.code) === "UNDERGRAD" ? randomNumberBetween(1, 4, random, 1) : randomNumberBetween(0.5, 2, random, 1),
    totalPeriods: randomIntBetween(16, 96, random),
    weeklyPeriods: randomIntBetween(1, 6, random),
    courseType: pickOne(["REQUIRED", "ELECTIVE", "LAB"], random) || "REQUIRED",
    assessmentType: pickOne(["EXAM", "ASSESSMENT", "PRACTICE"], random) || "EXAM",
    textbookVersion: pickOne(["2023 Curriculum", "2024 Curriculum", "School Edition"], random) || "2024 Curriculum",
    leadTeacherId: teacher?.id || serial,
    teacherName: teacher?.staffName || `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Wu"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Hao"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ran"}`,
    classroomType: pickOne(["NORMAL", "LAB", "MULTIMEDIA"], random) || "NORMAL",
    enrollmentLimit: getEducationStageFromGrade(grade.code) === "UNDERGRAD" ? randomIntBetween(40, 120, random) : randomIntBetween(28, 56, random),
    status: serial % 19 === 0 ? "PAUSED" : "ACTIVE",
  };
}

function buildEducationScheduleFact(serial, random, runtime, startedAt) {
  const course = pickFactByIndex(runtime.courseFacts, serial - 1) || buildEducationCourseFact(serial, random, runtime);
  const staff = pickFactByIndex(runtime.staffFacts, serial - 1) || buildEducationStaffFact(serial, random, runtime);
  const weekday = (serial % 5) + 1;
  const sectionStart = (serial % 5) + 1;
  const startHour = 8 + ((sectionStart - 1) * 2);
  const startTime = new Date(startedAt.getTime() + weekday * 24 * 60 * 60 * 1000 + startHour * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 90 * 60 * 1000);
  return {
    id: serial,
    course,
    staff,
    scheduleNo: `SCD${course.termCode.replace(/_/g, "")}${padNumber(serial, 4)}`,
    termCode: course.termCode,
    gradeCode: course.gradeCode,
    classCode: `${course.gradeCode}${padNumber((serial % 10) + 1, 2)}`,
    className: `${findOptionLabel(runtime.profile.gradeCodes || EDUCATION_GRADE_CODES, course.gradeCode, course.gradeCode)} Class ${(serial % 10) + 1}`,
    weekNo: (serial % 18) + 1,
    weekdayNo: weekday,
    sectionStart,
    sectionEnd: sectionStart + 1,
    startTime,
    endTime,
    classroomCode: `RM${padNumber((serial % 80) + 100, 3)}`,
    classroomName: `${pickOne(["Teaching Building A", "Teaching Building B", "Science Building", "Library Annex"], random) || "Teaching Building A"}-${(serial % 12) + 1}0${(serial % 8) + 1}`,
    teachingMode: pickOne(["OFFLINE", "HYBRID", "ONLINE"], random) || "OFFLINE",
    attendanceRequired: 1,
    scheduleStatus: serial % 23 === 0 ? "RESCHEDULED" : "ACTIVE",
    generatedBy: "AUTO_ENGINE",
  };
}

function buildEducationEnrollmentFact(serial, random, runtime, startedAt) {
  const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
  const staff = pickFactByIndex(runtime.staffFacts, serial - 1) || buildEducationStaffFact(serial, random, runtime);
  const academicYear = `${student.entranceYear}-${student.entranceYear + 1}`;
  const reportDate = new Date(startedAt.getTime() - randomIntBetween(5, 120, random) * 24 * 60 * 60 * 1000);
  const graduationDate = new Date(student.expectedGraduationYear, 6, 1);
  return {
    id: serial,
    student,
    campus: student.campus,
    enrollmentNo: `ENR${student.studentNo.slice(-10)}${padNumber((serial % 80) + 10, 2)}`,
    academicYear,
    termCode: pickWeighted(runtime.profile.termCodes || EDUCATION_TERM_CODES, random)?.code || "2026_FALL",
    educationStage: student.educationStage,
    gradeCode: student.gradeCode,
    classCode: student.classCode,
    className: student.className,
    entranceYear: student.entranceYear,
    counselorId: staff.id,
    counselorName: staff.staffName,
    registrationStatus: student.studentStatus === "ACTIVE" ? "REGISTERED" : student.studentStatus,
    dormitoryNo: student.educationStage === "UNDERGRAD" || student.educationStage === "POSTGRAD" ? `D${(serial % 8) + 1}-${(serial % 18) + 101}` : "",
    bedNo: student.educationStage === "UNDERGRAD" || student.educationStage === "POSTGRAD" ? String((serial % 6) + 1) : "",
    scholarshipFlag: serial % 9 === 0 ? 1 : 0,
    subsidyAmount: serial % 9 === 0 ? randomNumberBetween(1000, 8000, random) : 0,
    enrollmentDate: new Date(student.entranceYear, 8, 1),
    reportDate,
    graduationDate,
  };
}

function buildEducationTuitionFact(serial, random, runtime, startedAt) {
  const enrollment = pickFactByIndex(runtime.enrollmentFacts, serial - 1) || buildEducationEnrollmentFact(serial, random, runtime, startedAt);
  const student = enrollment.student;
  const billStatus = pickWeighted(runtime.profile.billStatuses || EDUCATION_BILL_STATUS, random) || EDUCATION_BILL_STATUS[0];
  const schoolType = student.campus.schoolType;
  const baseAmount = schoolType === "PUBLIC_UNIVERSITY"
    ? randomNumberBetween(4800, 9800, random)
    : schoolType === "PRIVATE_K12"
      ? randomNumberBetween(12000, 36000, random)
      : randomNumberBetween(1800, 8600, random);
  const discountAmount = serial % 7 === 0 ? randomNumberBetween(200, 3200, random) : 0;
  const receivableAmount = Number(baseAmount.toFixed(2));
  const paidAmount = billStatus.code === "PAID"
    ? Number((receivableAmount - discountAmount).toFixed(2))
    : billStatus.code === "PARTIAL"
      ? Number(((receivableAmount - discountAmount) * randomNumberBetween(0.2, 0.8, random, 4)).toFixed(2))
      : 0;
  const dueTime = new Date(startedAt.getTime() + randomIntBetween(3, 50, random) * 24 * 60 * 60 * 1000);
  const payTime = paidAmount > 0 ? new Date(dueTime.getTime() - randomIntBetween(0, 15, random) * 24 * 60 * 60 * 1000) : null;
  return {
    id: serial,
    student,
    campus: student.campus,
    billNo: `FEE${student.campus.campusCode.slice(-3)}${String(20260000 + serial)}`,
    termCode: enrollment.termCode,
    academicYear: enrollment.academicYear,
    feeCategory: pickOne(["TUITION", "BOARDING", "TEXTBOOK", "TRAINING"], random) || "TUITION",
    receivableAmount,
    discountAmount: Number(discountAmount.toFixed(2)),
    paidAmount,
    arrearsAmount: Number(Math.max(0, receivableAmount - discountAmount - paidAmount).toFixed(2)),
    billStatus: billStatus.code,
    payChannel: pickOne(["BANK", "WECHAT", "ALIPAY", "CAMPUS_POS"], random) || "WECHAT",
    collectorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Hu"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Fan"}`,
    invoiceNo: `INV${String(88000000 + serial)}`,
    dueTime,
    payTime,
    refundTime: billStatus.code === "REFUNDED" ? new Date((payTime || dueTime).getTime() + 5 * 24 * 60 * 60 * 1000) : null,
    payerName: student.guardianName,
    payerMobile: student.guardianMobile,
    campusAccountNo: `EDU${student.campus.city.code.slice(-4)}${padNumber(100000 + serial, 8)}`,
  };
}

function buildEducationAccessFact(serial, random, runtime, startedAt) {
  const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
  const student = pickFactByIndex(runtime.studentFacts, serial - 1);
  const staff = pickFactByIndex(runtime.staffFacts, serial - 1);
  const useStaff = serial % 5 === 0 && staff;
  const holder = useStaff ? staff : student || staff || buildEducationStudentFact(serial, random, runtime);
  const holderType = useStaff ? "STAFF" : "STUDENT";
  const entryTime = new Date(startedAt.getTime() + randomIntBetween(1, 90, random) * 60 * 1000);
  const stayMinutes = randomIntBetween(5, 720, random);
  const accessResult = pickWeighted(runtime.profile.accessResults || EDUCATION_ACCESS_RESULTS, random) || EDUCATION_ACCESS_RESULTS[0];
  return {
    id: serial,
    campus,
    accessNo: `ACS${campus.campusCode.slice(-3)}${String(700000 + serial)}`,
    holderType,
    holderId: holder.id,
    cardNo: holder.accessCardNo || holder.libraryCardNo || `CARD${padNumber(serial, 8)}`,
    holderName: holder.studentName || holder.staffName || holder.guardianName,
    holderMobile: holder.studentMobile || holder.staffMobile || holder.guardianMobile || buildMainlandMobile(700000 + serial, random),
    gateCode: `GATE${padNumber((serial % 18) + 1, 2)}`,
    gateName: pickOne(["North Gate", "South Gate", "Dormitory Gate", "Library Gate", "Teaching Gate"], random) || "North Gate",
    accessResult: accessResult.code,
    deviceCode: `DEV${campus.city.code.slice(-2)}${padNumber((serial % 90) + 10, 3)}`,
    entryTime,
    exitTime: accessResult.code === "DENY" ? null : new Date(entryTime.getTime() + stayMinutes * 60 * 1000),
    stayMinutes: accessResult.code === "DENY" ? 0 : stayMinutes,
    alarmFlag: accessResult.code === "DENY" ? 1 : 0,
    dutyOfficer: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Gao"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Zhi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Cheng"}`,
    remark: accessResult.code === "LATE" ? "Late arrival" : accessResult.code === "DENY" ? "Manual verification required" : "Normal access",
  };
}

function buildEducationLibraryFact(serial, random, runtime, startedAt) {
  const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
  const student = pickFactByIndex(runtime.studentFacts, serial - 1);
  const staff = pickFactByIndex(runtime.staffFacts, serial - 1);
  const borrowerType = serial % 6 === 0 && staff ? "STAFF" : "STUDENT";
  const borrower = borrowerType === "STAFF" ? staff : student || staff || buildEducationStudentFact(serial, random, runtime);
  const borrowStatus = pickWeighted(runtime.profile.borrowStatuses || EDUCATION_BORROW_STATUS, random) || EDUCATION_BORROW_STATUS[0];
  const borrowTime = new Date(startedAt.getTime() - randomIntBetween(1, 40, random) * 24 * 60 * 60 * 1000);
  const dueTime = new Date(borrowTime.getTime() + randomIntBetween(15, 45, random) * 24 * 60 * 60 * 1000);
  const returnTime = borrowStatus.code === "RETURNED" ? new Date(borrowTime.getTime() + randomIntBetween(3, 30, random) * 24 * 60 * 60 * 1000) : null;
  const overdueDays = borrowStatus.code === "OVERDUE" ? randomIntBetween(1, 20, random) : 0;
  const category = pickOne(["LITERATURE", "SCIENCE", "ENGINEERING", "HISTORY", "ARTS"], random) || "LITERATURE";
  return {
    id: serial,
    campus,
    borrowerType,
    borrowerId: borrower.id,
    borrowerName: borrower.studentName || borrower.staffName || "Reader",
    cardNo: borrower.libraryCardNo || borrower.accessCardNo || `LIB${padNumber(serial, 8)}`,
    borrowNo: `BOR${campus.campusCode.slice(-3)}${String(600000 + serial)}`,
    isbnCode: `9787${padNumber(10000000 + serial, 8)}`,
    bookCode: `BK${padNumber(300000 + serial, 6)}`,
    bookName: `${pickOne(["Data Science", "Modern History", "Advanced Mathematics", "Campus Literature", "Programming Practice"], random) || "Data Science"} Vol.${(serial % 8) + 1}`,
    categoryCode: category,
    authorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Guo"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Xiao"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ning"}`,
    publisherName: pickOne(["Education Press", "Campus Press", "Science Press", "University Press"], random) || "Education Press",
    borrowTime,
    dueTime,
    returnTime,
    borrowStatus: borrowStatus.code,
    renewCount: borrowStatus.code === "BORROWING" ? serial % 2 : borrowStatus.code === "OVERDUE" ? (serial % 3) + 1 : serial % 2,
    overdueDays,
    fineAmount: overdueDays > 0 ? Number((overdueDays * 0.5).toFixed(2)) : 0,
    operatorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Peng"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Shu"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Lin"}`,
    shelfCode: `S${padNumber((serial % 18) + 1, 2)}-${String.fromCharCode(65 + (serial % 6))}-${padNumber((serial % 80) + 10, 2)}`,
  };
}

function generateEducationRow(table, serial, runtime, startedAt) {
  const random = createSeededRandom(hashString(`${runtime.sceneCode}:${table.tableName}:${serial}`));

  if (table.tableName === "campus_dimension") {
    const fact = buildEducationCampusFact(serial, random, runtime.profile);
    runtime.campusFacts.set(fact.id, fact);
    return {
      campus_id: fact.id,
      campus_code: fact.campusCode,
      campus_name: fact.campusName,
      school_code: fact.schoolCode,
      school_name: fact.schoolName,
      school_type: fact.schoolType,
      education_stage: fact.educationStage,
      province_code: fact.city.code,
      province_name: fact.city.name,
      city_code: fact.city.code,
      city_name: fact.city.name,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      campus_address: fact.campusAddress,
      postal_code: fact.postalCode,
      office_phone: fact.officePhone,
      principal_name: fact.principalName,
      principal_mobile: fact.principalMobile,
      support_hotline: fact.supportHotline,
      capacity_count: fact.capacityCount,
      campus_status: fact.status,
      established_at: formatDateTime(fact.establishedAt),
      campus_card_prefix: fact.campusCardPrefix,
      library_card_prefix: fact.libraryCardPrefix,
    };
  }

  if (table.tableName === "student_profile") {
    const fact = buildEducationStudentFact(serial, random, runtime);
    runtime.studentFacts.set(fact.id, fact);
    return {
      student_id: fact.id,
      campus_id: fact.campus.id,
      student_no: fact.studentNo,
      student_name: fact.studentName,
      gender: fact.gender,
      birth_date: formatDateTime(fact.birthDate),
      id_card_no: fact.idCardNo,
      student_mobile: fact.studentMobile,
      student_email: fact.studentEmail,
      education_stage: fact.educationStage,
      grade_code: fact.gradeCode,
      class_code: fact.classCode,
      class_name: fact.className,
      entrance_year: fact.entranceYear,
      expected_graduation_year: fact.expectedGraduationYear,
      student_status: fact.studentStatus,
      access_card_no: fact.accessCardNo,
      library_card_no: fact.libraryCardNo,
      guardian_name: fact.guardianName,
      guardian_mobile: fact.guardianMobile,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      home_address: fact.homeAddress,
      postal_code: fact.postalCode,
    };
  }

  if (table.tableName === "guardian_contact") {
    const fact = buildEducationGuardianFact(serial, random, runtime);
    runtime.guardianFacts.set(fact.id, fact);
    return {
      guardian_id: fact.id,
      student_id: fact.student.id,
      guardian_no: fact.guardianNo,
      guardian_name: fact.guardianName,
      relation_type: fact.relationType,
      guardian_mobile: fact.guardianMobile,
      guardian_email: fact.guardianEmail,
      emergency_phone: fact.emergencyPhone,
      occupation_name: fact.occupationName,
      company_name: fact.companyName,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      address_detail: fact.addressDetail,
      primary_flag: fact.primaryFlag,
      message_channel: fact.messageChannel,
      last_contact_time: formatDateTime(fact.lastContactTime),
    };
  }

  if (table.tableName === "staff_profile") {
    const fact = buildEducationStaffFact(serial, random, runtime);
    runtime.staffFacts.set(fact.id, fact);
    return {
      staff_id: fact.id,
      campus_id: fact.campus.id,
      staff_no: fact.staffNo,
      staff_name: fact.staffName,
      gender: fact.gender,
      id_card_no: fact.idCardNo,
      staff_mobile: fact.staffMobile,
      staff_email: fact.staffEmail,
      role_code: fact.roleCode,
      subject_code: fact.subjectCode,
      title_name: fact.titleName,
      department_name: fact.departmentName,
      hire_date: formatDateTime(fact.hireDate),
      employment_status: fact.employmentStatus,
      teacher_license_no: fact.teacherLicenseNo,
      access_card_no: fact.accessCardNo,
      office_location: fact.officeLocation,
      province_code: fact.provinceCode,
      province_name: fact.provinceName,
      city_code: fact.cityCode,
      city_name: fact.cityName,
      district_code: fact.districtCode,
      district_name: fact.districtName,
      home_address: fact.homeAddress,
      postal_code: fact.postalCode,
      supervisor_name: fact.supervisorName,
    };
  }

  if (table.tableName === "course_catalog") {
    const fact = buildEducationCourseFact(serial, random, runtime);
    runtime.courseFacts.set(fact.id, fact);
    return {
      course_id: fact.id,
      campus_id: fact.campus.id,
      course_code: fact.courseCode,
      course_name: fact.courseName,
      subject_code: fact.subjectCode,
      education_stage: fact.educationStage,
      grade_code: fact.gradeCode,
      term_code: fact.termCode,
      credit_value: fact.creditValue,
      total_periods: fact.totalPeriods,
      weekly_periods: fact.weeklyPeriods,
      course_type: fact.courseType,
      assessment_type: fact.assessmentType,
      textbook_version: fact.textbookVersion,
      lead_teacher_id: fact.leadTeacherId,
      teacher_name: fact.teacherName,
      classroom_type: fact.classroomType,
      enrollment_limit: fact.enrollmentLimit,
      course_status: fact.status,
    };
  }

  if (table.tableName === "class_schedule") {
    const fact = buildEducationScheduleFact(serial, random, runtime, startedAt);
    runtime.scheduleFacts.set(fact.id, fact);
    return {
      schedule_id: fact.id,
      course_id: fact.course.id,
      staff_id: fact.staff.id,
      campus_id: fact.course.campus.id,
      schedule_no: fact.scheduleNo,
      term_code: fact.termCode,
      grade_code: fact.gradeCode,
      class_code: fact.classCode,
      class_name: fact.className,
      week_no: fact.weekNo,
      weekday_no: fact.weekdayNo,
      section_start: fact.sectionStart,
      section_end: fact.sectionEnd,
      start_time: formatDateTime(fact.startTime),
      end_time: formatDateTime(fact.endTime),
      classroom_code: fact.classroomCode,
      classroom_name: fact.classroomName,
      teaching_mode: fact.teachingMode,
      attendance_required: fact.attendanceRequired,
      schedule_status: fact.scheduleStatus,
      generated_by: fact.generatedBy,
    };
  }

  if (table.tableName === "student_enrollment") {
    const fact = buildEducationEnrollmentFact(serial, random, runtime, startedAt);
    runtime.enrollmentFacts.set(fact.id, fact);
    return {
      enrollment_id: fact.id,
      student_id: fact.student.id,
      campus_id: fact.campus.id,
      enrollment_no: fact.enrollmentNo,
      academic_year: fact.academicYear,
      term_code: fact.termCode,
      education_stage: fact.educationStage,
      grade_code: fact.gradeCode,
      class_code: fact.classCode,
      class_name: fact.className,
      entrance_year: fact.entranceYear,
      counselor_id: fact.counselorId,
      counselor_name: fact.counselorName,
      registration_status: fact.registrationStatus,
      dormitory_no: fact.dormitoryNo,
      bed_no: fact.bedNo,
      scholarship_flag: fact.scholarshipFlag,
      subsidy_amount: fact.subsidyAmount,
      enrollment_date: formatDateTime(fact.enrollmentDate),
      report_date: formatDateTime(fact.reportDate),
      graduation_date: formatDateTime(fact.graduationDate),
    };
  }

  if (table.tableName === "tuition_bill") {
    const fact = buildEducationTuitionFact(serial, random, runtime, startedAt);
    runtime.tuitionFacts.set(fact.id, fact);
    return {
      bill_id: fact.id,
      student_id: fact.student.id,
      campus_id: fact.campus.id,
      bill_no: fact.billNo,
      term_code: fact.termCode,
      academic_year: fact.academicYear,
      fee_category: fact.feeCategory,
      receivable_amount: fact.receivableAmount,
      discount_amount: fact.discountAmount,
      paid_amount: fact.paidAmount,
      arrears_amount: fact.arrearsAmount,
      bill_status: fact.billStatus,
      pay_channel: fact.payChannel,
      collector_name: fact.collectorName,
      invoice_no: fact.invoiceNo,
      due_time: formatDateTime(fact.dueTime),
      pay_time: fact.payTime ? formatDateTime(fact.payTime) : null,
      refund_time: fact.refundTime ? formatDateTime(fact.refundTime) : null,
      payer_name: fact.payerName,
      payer_mobile: fact.payerMobile,
      campus_account_no: fact.campusAccountNo,
    };
  }

  if (table.tableName === "campus_access_log") {
    const fact = buildEducationAccessFact(serial, random, runtime, startedAt);
    runtime.accessFacts.set(fact.id, fact);
    return {
      access_id: fact.id,
      campus_id: fact.campus.id,
      access_no: fact.accessNo,
      holder_type: fact.holderType,
      holder_id: fact.holderId,
      card_no: fact.cardNo,
      holder_name: fact.holderName,
      holder_mobile: fact.holderMobile,
      gate_code: fact.gateCode,
      gate_name: fact.gateName,
      access_result: fact.accessResult,
      device_code: fact.deviceCode,
      entry_time: formatDateTime(fact.entryTime),
      exit_time: fact.exitTime ? formatDateTime(fact.exitTime) : null,
      stay_minutes: fact.stayMinutes,
      alarm_flag: fact.alarmFlag,
      duty_officer: fact.dutyOfficer,
      remark: fact.remark,
    };
  }

  if (table.tableName === "library_borrow_record") {
    const fact = buildEducationLibraryFact(serial, random, runtime, startedAt);
    runtime.libraryFacts.set(fact.id, fact);
    return {
      borrow_id: fact.id,
      campus_id: fact.campus.id,
      borrower_type: fact.borrowerType,
      borrower_id: fact.borrowerId,
      borrower_name: fact.borrowerName,
      card_no: fact.cardNo,
      borrow_no: fact.borrowNo,
      isbn_code: fact.isbnCode,
      book_code: fact.bookCode,
      book_name: fact.bookName,
      category_code: fact.categoryCode,
      author_name: fact.authorName,
      publisher_name: fact.publisherName,
      borrow_time: formatDateTime(fact.borrowTime),
      due_time: formatDateTime(fact.dueTime),
      return_time: fact.returnTime ? formatDateTime(fact.returnTime) : null,
      borrow_status: fact.borrowStatus,
      renew_count: fact.renewCount,
      overdue_days: fact.overdueDays,
      fine_amount: fact.fineAmount,
      operator_name: fact.operatorName,
      shelf_code: fact.shelfCode,
    };
  }

  if (table.tableName === "parent_communication_record") {
    const fact = buildEducationParentCommunicationFact(serial, random, runtime, startedAt);
    runtime.parentCommunicationFacts.set(fact.id, fact);
    return {
      communication_id: fact.id,
      student_id: fact.student.id,
      guardian_id: fact.guardian.id,
      message_no: fact.messageNo,
      message_channel: fact.messageChannel,
      message_type: fact.messageType,
      title: fact.title,
      content_summary: fact.contentSummary,
      sender_name: fact.senderName,
      send_time: formatDateTime(fact.sendTime),
      read_time: fact.readTime ? formatDateTime(fact.readTime) : null,
      reply_time: fact.replyTime ? formatDateTime(fact.replyTime) : null,
      reply_status: fact.replyStatus,
      urgency_level: fact.urgencyLevel,
      handle_teacher: fact.handleTeacher,
      archive_status: fact.archiveStatus,
      remark: fact.remark,
    };
  }

  if (table.tableName === "dormitory_resident_record") {
    const fact = buildEducationDormitoryResidentFact(serial, random, runtime, startedAt);
    runtime.dormitoryResidentFacts.set(fact.id, fact);
    return {
      resident_id: fact.id,
      student_id: fact.student.id,
      campus_id: fact.campus.id,
      resident_no: fact.residentNo,
      dormitory_no: fact.dormitoryNo,
      building_no: fact.buildingNo,
      room_no: fact.roomNo,
      bed_no: fact.bedNo,
      checkin_time: formatDateTime(fact.checkinTime),
      checkout_time: fact.checkoutTime ? formatDateTime(fact.checkoutTime) : null,
      resident_status: fact.residentStatus,
      manager_name: fact.managerName,
      electricity_balance: fact.electricityBalance,
      hygiene_score: fact.hygieneScore,
      discipline_score: fact.disciplineScore,
      weekend_leave_flag: fact.weekendLeaveFlag,
      access_card_no: fact.accessCardNo,
      remark: fact.remark,
    };
  }

  return null;
}

function generateScenarioRow({ profile, table, serial, runtime, startedAt }) {
  if (!profile) {
    return null;
  }
  if (profile.industry === "education") return generateEducationRow(table, serial, runtime, startedAt);
  if (profile.industry === "ecommerce") return generateEcommerceRow(table, serial, runtime, startedAt);
  if (profile.industry === "traffic") return generateTrafficRow(table, serial, runtime, startedAt);
  if (profile.industry === "bank_regulatory") return generateBankRow(table, serial, runtime, startedAt);
  if (profile.industry === "finance_fund") return generateFinanceFundRow(table, serial, runtime, startedAt);
  if (profile.industry === "logistics_express") return generateLogisticsExpressRow(table, serial, runtime, startedAt);
  return null;
}

module.exports = {
  buildScenarioProfile,
  buildScenarioModulePlan,
  extractIndustryBusinessConcepts,
  extractKnowledgePlanningSignals,
  normalizeKnowledgePlanningSummary,
  createScenarioRuntime,
  generateScenarioRow,
};
