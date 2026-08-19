var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// backend/src/common/utils/response.js
var require_response = __commonJS({
  "backend/src/common/utils/response.js"(exports2, module2) {
    function sendSuccess(res, data, meta, statusCode = 200) {
      return res.status(statusCode).json({ success: true, data, meta });
    }
    module2.exports = {
      sendSuccess
    };
  }
});

// runtime-port:database
var require_database = __commonJS({
  "runtime-port:database"(exports2, module2) {
    var { createDatabasePoolProxy } = require("@johnason/data-platform-core-kernel");
    var pool = createDatabasePoolProxy();
    module2.exports = { pool, testConnection: async () => {
      const c = await pool.getConnection();
      c.release();
    } };
  }
});

// backend/src/common/errors/app-error.js
var require_app_error = __commonJS({
  "backend/src/common/errors/app-error.js"(exports2, module2) {
    var AppError = class extends Error {
      constructor(message, statusCode, details) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
      }
    };
    module2.exports = AppError;
  }
});

// runtime-port:project-context
var require_project_context = __commonJS({
  "runtime-port:project-context"(exports2, module2) {
    var k = require("@johnason/data-platform-core-kernel");
    module2.exports = { runWithProjectContext: (_context, callback) => callback(), getProjectContext: k.getProjectContext, getCurrentProjectId: k.getCurrentProjectId, getProjectCondition: k.getProjectCondition, addProjectCondition: k.addProjectCondition };
  }
});

// backend/src/modules/data-lab/data-lab.scenario-engine.js
var require_data_lab_scenario_engine = __commonJS({
  "backend/src/modules/data-lab/data-lab.scenario-engine.js"(exports2, module2) {
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
        current = current * 16807 % 2147483647;
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
    var CUSTOMER_FAMILY_NAMES = ["\u5F20", "\u738B", "\u674E", "\u5218", "\u9648", "\u6768", "\u9EC4", "\u8D75", "\u5468", "\u5434", "\u5F90", "\u5B59"];
    var CUSTOMER_GIVEN_NAMES = ["\u6668", "\u60A6", "\u6DB5", "\u5B81", "\u5B87", "\u742A", "\u598D", "\u54F2", "\u8F69", "\u7136", "\u7433", "\u6D9B", "\u6D01", "\u535A"];
    var CUSTOMER_EMAIL_DOMAINS = ["qq.com", "163.com", "126.com", "foxmail.com", "yeah.net", "aliyun.com", "sina.com", "outlook.com"];
    var CITY_OPTIONS = [
      { code: "310000", name: "\u4E0A\u6D77", districts: ["\u6D66\u4E1C\u65B0\u533A", "\u5F90\u6C47\u533A", "\u95F5\u884C\u533A"] },
      { code: "330100", name: "\u676D\u5DDE", districts: ["\u6EE8\u6C5F\u533A", "\u4F59\u676D\u533A", "\u897F\u6E56\u533A"] },
      { code: "320100", name: "\u5357\u4EAC", districts: ["\u5EFA\u90BA\u533A", "\u6C5F\u5B81\u533A", "\u9F13\u697C\u533A"] },
      { code: "440300", name: "\u6DF1\u5733", districts: ["\u5357\u5C71\u533A", "\u798F\u7530\u533A", "\u9F99\u534E\u533A"] },
      { code: "510100", name: "\u6210\u90FD", districts: ["\u9AD8\u65B0\u533A", "\u6B66\u4FAF\u533A", "\u9526\u6C5F\u533A"] }
    ];
    var ECOMMERCE_CATEGORIES = [
      {
        code: "ELECTRONIC",
        label: "\u624B\u673A\u6570\u7801",
        weight: 34,
        products: [
          { brand: "Apple", series: "iPhone 15", storage: ["128GB", "256GB", "512GB"], colors: ["\u9ED1\u8272", "\u94F6\u8272", "\u6DF1\u7A7A\u7070"] },
          { brand: "HUAWEI", series: "Mate 60 Pro", storage: ["256GB", "512GB"], colors: ["\u949B\u91D1\u8272", "\u6DF1\u7A7A\u7070", "\u8FDC\u5CF0\u84DD"] },
          { brand: "Xiaomi", series: "Xiaomi 14", storage: ["256GB", "512GB"], colors: ["\u9ED1\u8272", "\u94F6\u8272", "\u8FDC\u5CF0\u84DD"] },
          { brand: "OPPO", series: "Find X7", storage: ["256GB", "512GB"], colors: ["\u94F6\u8272", "\u9ED1\u8272", "\u6DF1\u7A7A\u7070"] },
          { brand: "vivo", series: "X100", storage: ["128GB", "256GB", "512GB"], colors: ["\u8FDC\u5CF0\u84DD", "\u949B\u91D1\u8272", "\u6DF1\u7A7A\u7070"] }
        ],
        storage: ["128GB", "256GB", "512GB"],
        colors: ["\u9ED1\u8272", "\u94F6\u8272", "\u6DF1\u7A7A\u7070", "\u8FDC\u5CF0\u84DD", "\u949B\u91D1\u8272"],
        priceRange: [3999, 11999],
        stockRange: [60, 600],
        titlePattern: "{brand} {series} {storage} {color}"
      },
      {
        code: "HOME",
        label: "\u5BB6\u7535\u5BB6\u5C45",
        weight: 26,
        products: [
          { brand: "\u7F8E\u7684", series: "\u53D8\u9891\u7A7A\u8C03", storage: [""], colors: ["\u767D\u8272", "\u51B0\u5DDD\u94F6"] },
          { brand: "\u6D77\u5C14", series: "\u53CC\u5F00\u95E8\u51B0\u7BB1", storage: [""], colors: ["\u51B0\u5DDD\u94F6", "\u66DC\u77F3\u9ED1"] },
          { brand: "\u683C\u529B", series: "\u4E91\u9526\u6302\u673A\u7A7A\u8C03", storage: [""], colors: ["\u767D\u8272"] },
          { brand: "\u5C0F\u7C73", series: "\u7A7A\u6C14\u51C0\u5316\u5668 4 Lite", storage: [""], colors: ["\u767D\u8272", "\u6DF1\u7070"] },
          { brand: "\u8FFD\u89C5", series: "\u626B\u5730\u673A\u5668\u4EBA S20", storage: [""], colors: ["\u767D\u8272", "\u66DC\u77F3\u9ED1"] }
        ],
        storage: [""],
        colors: ["\u767D\u8272", "\u6DF1\u7070", "\u66DC\u77F3\u9ED1", "\u51B0\u5DDD\u94F6"],
        priceRange: [899, 6999],
        stockRange: [20, 180],
        titlePattern: "{brand}{series} {color}"
      },
      {
        code: "FOOD",
        label: "\u98DF\u54C1\u9152\u6C34",
        weight: 20,
        products: [
          { brand: "\u826F\u54C1\u94FA\u5B50", series: "\u6BCF\u65E5\u575A\u679C\u793C\u76D2", storage: ["500g", "750g"], colors: [""] },
          { brand: "\u4E09\u53EA\u677E\u9F20", series: "\u5364\u5473\u96F6\u98DF\u7EC4\u5408", storage: ["500g", "750g"], colors: [""] },
          { brand: "\u5143\u6C14\u68EE\u6797", series: "\u6C14\u6CE1\u6C34\u7EC4\u5408", storage: ["12\u74F6", "24\u74F6"], colors: [""] },
          { brand: "\u738B\u5C0F\u5364", series: "\u864E\u76AE\u51E4\u722A\u793C\u76D2", storage: ["500g", "750g"], colors: [""] },
          { brand: "\u8BA4\u517B\u4E00\u5934\u725B", series: "\u7EAF\u725B\u5976\u65E9\u9910\u88C5", storage: ["12\u76D2", "24\u76D2"], colors: [""] }
        ],
        storage: ["500g", "750g", "12\u74F6", "24\u76D2"],
        colors: [""],
        priceRange: [29, 299],
        stockRange: [120, 1200],
        titlePattern: "{brand}{series} {storage}"
      },
      {
        code: "APPAREL",
        label: "\u670D\u9970\u978B\u5305",
        weight: 20,
        products: [
          { brand: "\u5B89\u8E0F", series: "\u7537\u6B3E\u8DD1\u6B65\u978B", storage: ["42\u7801", "43\u7801"], colors: ["\u9ED1\u7070", "\u6708\u5149\u767D"] },
          { brand: "\u674E\u5B81", series: "\u8BAD\u7EC3\u957F\u88E4", storage: ["L", "XL"], colors: ["\u9ED1\u7070", "\u6D77\u519B\u84DD"] },
          { brand: "Nike", series: "\u4F11\u95F2\u536B\u8863", storage: ["L", "XL"], colors: ["\u9ED1\u7070", "\u5976\u6CB9\u674F"] },
          { brand: "Adidas", series: "\u8F7B\u91CF\u80CC\u5305", storage: ["\u5747\u7801"], colors: ["\u9ED1\u7070", "\u6D77\u519B\u84DD"] },
          { brand: "\u6CE2\u53F8\u767B", series: "\u5973\u6B3E\u7FBD\u7ED2\u670D", storage: ["L", "XL"], colors: ["\u6708\u5149\u767D", "\u5976\u6CB9\u674F"] }
        ],
        storage: ["42\u7801", "L", "XL", "\u5747\u7801"],
        colors: ["\u9ED1\u7070", "\u6708\u5149\u767D", "\u6D77\u519B\u84DD", "\u5976\u6CB9\u674F"],
        priceRange: [129, 1599],
        stockRange: [40, 400],
        titlePattern: "{brand}{series} {storage} {color}"
      }
    ];
    var PAYMENT_CHANNELS = [
      { code: "WECHAT", label: "\u5FAE\u4FE1\u652F\u4ED8", weight: 45 },
      { code: "ALIPAY", label: "\u652F\u4ED8\u5B9D", weight: 35 },
      { code: "CARD", label: "\u94F6\u884C\u5361", weight: 12 },
      { code: "WALLET", label: "\u94B1\u5305\u4F59\u989D", weight: 8 }
    ];
    var ORDER_STATUS_OPTIONS = [
      { code: "PAID", weight: 28 },
      { code: "SHIPPED", weight: 22 },
      { code: "COMPLETED", weight: 26 },
      { code: "REFUNDED", weight: 10 },
      { code: "PENDING_PAYMENT", weight: 8 },
      { code: "CLOSED", weight: 6 }
    ];
    var TRAFFIC_VEHICLE_TYPES = [
      { code: "SEDAN", label: "\u5C0F\u578B\u5BA2\u8F66", weight: 34 },
      { code: "SUV", label: "\u8FD0\u52A8\u578B\u5BA2\u8F66", weight: 26 },
      { code: "NEW_ENERGY", label: "\u65B0\u80FD\u6E90\u8F66", weight: 18 },
      { code: "TRUCK", label: "\u8D27\u8FD0\u8F66\u8F86", weight: 12 },
      { code: "BUS", label: "\u8425\u8FD0\u5BA2\u8F66", weight: 10 }
    ];
    var TRAFFIC_VIOLATION_CODES = [
      { code: "1344", label: "\u8FDD\u53CD\u7981\u4EE4\u6807\u5FD7\u6307\u793A", points: 1, fineRange: [100, 200], weight: 20 },
      { code: "1625", label: "\u9A7E\u9A76\u65F6\u62E8\u6253\u63A5\u542C\u624B\u6301\u7535\u8BDD", points: 3, fineRange: [100, 200], weight: 16 },
      { code: "1116", label: "\u673A\u52A8\u8F66\u901A\u8FC7\u6709\u706F\u63A7\u8DEF\u53E3\u65F6\u4E0D\u6309\u6240\u9700\u884C\u8FDB\u65B9\u5411\u9A76\u5165\u5BFC\u5411\u8F66\u9053", points: 2, fineRange: [100, 200], weight: 12 },
      { code: "1302", label: "\u673A\u52A8\u8F66\u8FDD\u53CD\u89C4\u5B9A\u505C\u653E\u3001\u4E34\u65F6\u505C\u8F66", points: 0, fineRange: [50, 200], weight: 24 },
      { code: "1352", label: "\u9047\u884C\u4EBA\u6B63\u5728\u901A\u8FC7\u4EBA\u884C\u6A2A\u9053\u65F6\u672A\u505C\u8F66\u8BA9\u884C", points: 3, fineRange: [200, 500], weight: 10 },
      { code: "1362", label: "\u9A7E\u9A76\u673A\u52A8\u8F66\u8FDD\u53CD\u9053\u8DEF\u4EA4\u901A\u4FE1\u53F7\u706F\u901A\u884C", points: 6, fineRange: [200, 500], weight: 18 }
    ];
    var TRAFFIC_STATION_NAMES = ["\u5EF6\u5B89\u9AD8\u67B6\u68C0\u67E5\u7AD9", "\u8679\u6865\u67A2\u7EBD\u5361\u53E3", "\u5916\u73AF\u9AD8\u901F\u5361\u70B9", "\u4E16\u7EAA\u5927\u9053\u6267\u6CD5\u5C97", "\u4EBA\u6C11\u8DEF\u8DEF\u68C0\u5C97"];
    var TRAFFIC_ROAD_NAMES = ["\u5EF6\u5B89\u4E1C\u8DEF", "\u4E16\u7EAA\u5927\u9053", "\u4E2D\u5C71\u5317\u8DEF", "\u4EBA\u6C11\u8DEF", "\u6CAA\u95F5\u9AD8\u67B6", "\u9F99\u534E\u4E1C\u8DEF"];
    var TRAFFIC_VIOLATION_STATUS = [
      { code: "\u5F85\u5904\u7406", weight: 18 },
      { code: "\u5DF2\u88C1\u51B3", weight: 22 },
      { code: "\u5DF2\u7F34\u6B3E", weight: 44 },
      { code: "\u590D\u6838\u4E2D", weight: 10 },
      { code: "\u5DF2\u64A4\u9500", weight: 6 }
    ];
    var TRAFFIC_INSPECTION_RESULTS = [
      { code: "\u6B63\u5E38\u653E\u884C", weight: 72 },
      { code: "\u73B0\u573A\u8B66\u793A", weight: 16 },
      { code: "\u6682\u6263\u8BC1\u4EF6", weight: 8 },
      { code: "\u79FB\u4EA4\u5904\u7406", weight: 4 }
    ];
    var BANK_BRANCH_TYPES = [
      { code: "\u4E00\u7EA7\u5206\u884C", label: "\u4E00\u7EA7\u5206\u884C", weight: 12 },
      { code: "\u4E8C\u7EA7\u5206\u884C", label: "\u4E8C\u7EA7\u5206\u884C", weight: 24 },
      { code: "\u4E2D\u5FC3\u652F\u884C", label: "\u4E2D\u5FC3\u652F\u884C", weight: 18 },
      { code: "\u8425\u4E1A\u90E8", label: "\u8425\u4E1A\u90E8", weight: 28 },
      { code: "\u666E\u60E0\u91D1\u878D\u4E2D\u5FC3", label: "\u666E\u60E0\u91D1\u878D\u4E2D\u5FC3", weight: 18 }
    ];
    var BANK_INSTITUTION_NAMES = ["\u4E2D\u56FD\u5DE5\u5546\u94F6\u884C", "\u4E2D\u56FD\u5EFA\u8BBE\u94F6\u884C", "\u4E2D\u56FD\u519C\u4E1A\u94F6\u884C", "\u4E2D\u56FD\u94F6\u884C", "\u62DB\u5546\u94F6\u884C", "\u4EA4\u901A\u94F6\u884C"];
    var BANK_REPORT_CODES = [
      { code: "1104-G01", label: "\u8D44\u4EA7\u8D28\u91CF\u62A5\u9001", weight: 28 },
      { code: "1104-G21", label: "\u5927\u989D\u98CE\u9669\u66B4\u9732\u62A5\u9001", weight: 16 },
      { code: "1104-G31", label: "\u6D41\u52A8\u6027\u98CE\u9669\u62A5\u9001", weight: 22 },
      { code: "EAST-\u8D37\u6B3E\u8D28\u91CF", label: "EAST\u8D37\u6B3E\u8D28\u91CF\u6838\u67E5", weight: 18 },
      { code: "AML-\u5927\u989D\u4EA4\u6613", label: "\u53CD\u6D17\u94B1\u5927\u989D\u4EA4\u6613\u62A5\u9001", weight: 16 }
    ];
    var BANK_REPORT_STATUS = [
      { code: "\u5DF2\u63D0\u4EA4", weight: 48 },
      { code: "\u5DF2\u63A5\u6536", weight: 26 },
      { code: "\u5DF2\u9000\u56DE", weight: 8 },
      { code: "\u8865\u6B63\u4E2D", weight: 10 },
      { code: "\u5DF2\u5F52\u6863", weight: 8 }
    ];
    var BANK_ISSUE_TYPES = [
      { code: "\u6570\u636E\u53E3\u5F84\u4E0D\u4E00\u81F4", label: "\u6570\u636E\u53E3\u5F84\u4E0D\u4E00\u81F4", weight: 30 },
      { code: "\u62A5\u8868\u6821\u9A8C\u5931\u8D25", label: "\u62A5\u8868\u6821\u9A8C\u5931\u8D25", weight: 24 },
      { code: "\u98CE\u9669\u6307\u6807\u5F02\u5E38\u6CE2\u52A8", label: "\u98CE\u9669\u6307\u6807\u5F02\u5E38\u6CE2\u52A8", weight: 18 },
      { code: "\u5927\u989D\u4EA4\u6613\u8BF4\u660E\u4E0D\u8DB3", label: "\u5927\u989D\u4EA4\u6613\u8BF4\u660E\u4E0D\u8DB3", weight: 16 },
      { code: "\u5B57\u6BB5\u7F3A\u5931", label: "\u5B57\u6BB5\u7F3A\u5931", weight: 12 }
    ];
    var BANK_ISSUE_LEVELS = [
      { code: "\u4E00\u822C", label: "\u4E00\u822C", weight: 52 },
      { code: "\u5173\u6CE8", label: "\u5173\u6CE8", weight: 28 },
      { code: "\u91CD\u8981", label: "\u91CD\u8981", weight: 14 },
      { code: "\u91CD\u5927", label: "\u91CD\u5927", weight: 6 }
    ];
    var FUND_PRODUCT_TYPES = [
      { code: "EQUITY", label: "\u80A1\u7968\u578B\u57FA\u91D1", weight: 24 },
      { code: "BOND", label: "\u503A\u5238\u578B\u57FA\u91D1", weight: 20 },
      { code: "MIXED", label: "\u6DF7\u5408\u578B\u57FA\u91D1", weight: 22 },
      { code: "INDEX", label: "\u6307\u6570\u578B\u57FA\u91D1", weight: 14 },
      { code: "MONEY_MARKET", label: "\u8D27\u5E01\u578B\u57FA\u91D1", weight: 12 },
      { code: "QDII", label: "QDII\u57FA\u91D1", weight: 8 }
    ];
    var FUND_RISK_LEVELS = [
      { code: "R1", label: "\u4F4E\u98CE\u9669", weight: 18 },
      { code: "R2", label: "\u4E2D\u4F4E\u98CE\u9669", weight: 24 },
      { code: "R3", label: "\u4E2D\u98CE\u9669", weight: 26 },
      { code: "R4", label: "\u4E2D\u9AD8\u98CE\u9669", weight: 20 },
      { code: "R5", label: "\u9AD8\u98CE\u9669", weight: 12 }
    ];
    var FUND_INVESTOR_TYPES = [
      { code: "PERSONAL", label: "Personal Investor", weight: 82 },
      { code: "INSTITUTION", label: "Institutional Investor", weight: 18 }
    ];
    var FUND_TRADE_CHANNELS = [
      { code: "BANK", label: "Bank", weight: 36 },
      { code: "APP", label: "Mobile App", weight: 28 },
      { code: "THIRD_PARTY", label: "Third Party Platform", weight: 22 },
      { code: "DIRECT", label: "Direct Sales", weight: 14 }
    ];
    var FUND_ORDER_STATUS = [
      { code: "ACCEPTED", label: "Accepted", weight: 18 },
      { code: "CONFIRMED", label: "Confirmed", weight: 44 },
      { code: "SETTLED", label: "Settled", weight: 24 },
      { code: "FAILED", label: "Failed", weight: 6 },
      { code: "CANCELLED", label: "Cancelled", weight: 8 }
    ];
    var FUND_COMPANY_NAMES = ["\u534E\u590F\u57FA\u91D1", "\u6613\u65B9\u8FBE\u57FA\u91D1", "\u534E\u590F\u57FA\u91D1\u7BA1\u7406", "\u5E7F\u53D1\u57FA\u91D1", "\u5609\u5B9E\u57FA\u91D1", "\u535A\u65F6\u57FA\u91D1"];
    var LOGISTICS_EXPRESS_COMPANIES = [
      { code: "SF", label: "\u987A\u4E30\u901F\u8FD0", weight: 28 },
      { code: "JD", label: "\u4EAC\u4E1C\u7269\u6D41", weight: 20 },
      { code: "ZTO", label: "\u4E2D\u901A\u5FEB\u9012", weight: 16 },
      { code: "YTO", label: "\u5706\u901A\u901F\u9012", weight: 14 },
      { code: "STO", label: "\u7533\u901A\u5FEB\u9012", weight: 12 },
      { code: "YUNDA", label: "\u97F5\u8FBE\u901F\u9012", weight: 10 }
    ];
    var LOGISTICS_TRANSPORT_MODES = [
      { code: "GROUND", label: "\u9646\u8FD0", weight: 52 },
      { code: "AIR", label: "\u7A7A\u8FD0", weight: 18 },
      { code: "RAIL", label: "\u94C1\u8DEF", weight: 10 },
      { code: "SAME_CITY", label: "\u540C\u57CE\u914D\u9001", weight: 12 },
      { code: "COLD_CHAIN", label: "\u51B7\u94FE\u8FD0\u8F93", weight: 8 }
    ];
    var LOGISTICS_WAYBILL_STATUS = [
      { code: "CREATED", label: "Created", weight: 12 },
      { code: "COLLECTED", label: "Collected", weight: 18 },
      { code: "IN_TRANSIT", label: "In Transit", weight: 32 },
      { code: "OUT_FOR_DELIVERY", label: "Out For Delivery", weight: 16 },
      { code: "SIGNED", label: "Signed", weight: 18 },
      { code: "EXCEPTION", label: "Exception", weight: 4 }
    ];
    var LOGISTICS_EXCEPTION_TYPES = [
      { code: "DELAY", label: "Delay", weight: 34 },
      { code: "ADDRESS_ERROR", label: "Address Error", weight: 20 },
      { code: "PACKAGE_DAMAGE", label: "Package Damage", weight: 16 },
      { code: "CUSTOMER_REJECT", label: "Customer Reject", weight: 14 },
      { code: "LOST", label: "Lost", weight: 8 },
      { code: "OTHER", label: "Other", weight: 8 }
    ];
    var ECOMMERCE_MEMBER_LEVELS = [
      { code: "\u666E\u901A\u4F1A\u5458", label: "\u666E\u901A\u4F1A\u5458", weight: 42 },
      { code: "\u94F6\u5361\u4F1A\u5458", label: "\u94F6\u5361\u4F1A\u5458", weight: 24 },
      { code: "\u91D1\u5361\u4F1A\u5458", label: "\u91D1\u5361\u4F1A\u5458", weight: 18 },
      { code: "\u9ED1\u91D1\u4F1A\u5458", label: "\u9ED1\u91D1\u4F1A\u5458", weight: 10 },
      { code: "\u4F01\u4E1A\u5BA2\u6237", label: "\u4F01\u4E1A\u5BA2\u6237", weight: 6 }
    ];
    var ECOMMERCE_REGISTER_CHANNELS = [
      { code: "APP", label: "APP", weight: 38 },
      { code: "\u5C0F\u7A0B\u5E8F", label: "\u5C0F\u7A0B\u5E8F", weight: 28 },
      { code: "H5", label: "H5", weight: 18 },
      { code: "\u95E8\u5E97\u5BFC\u8D2D", label: "\u95E8\u5E97\u5BFC\u8D2D", weight: 10 },
      { code: "\u4F01\u4E1A\u91C7\u8D2D", label: "\u4F01\u4E1A\u91C7\u8D2D", weight: 6 }
    ];
    var ECOMMERCE_RISK_LEVELS = [
      { code: "\u4F4E\u98CE\u9669", label: "\u4F4E\u98CE\u9669", weight: 78 },
      { code: "\u4E2D\u98CE\u9669", label: "\u4E2D\u98CE\u9669", weight: 17 },
      { code: "\u9AD8\u98CE\u9669", label: "\u9AD8\u98CE\u9669", weight: 5 }
    ];
    var ECOMMERCE_STORE_TYPES = [
      { code: "\u4E2D\u5FC3\u4ED3", label: "\u4E2D\u5FC3\u4ED3", weight: 18 },
      { code: "\u57CE\u5E02\u4ED3", label: "\u57CE\u5E02\u4ED3", weight: 26 },
      { code: "\u524D\u7F6E\u4ED3", label: "\u524D\u7F6E\u4ED3", weight: 24 },
      { code: "\u54C1\u724C\u65D7\u8230\u5E97", label: "\u54C1\u724C\u65D7\u8230\u5E97", weight: 20 },
      { code: "\u76F4\u8425\u7F51\u5E97", label: "\u76F4\u8425\u7F51\u5E97", weight: 12 }
    ];
    var ECOMMERCE_PRODUCT_TYPES = [
      { code: "\u6807\u54C1", label: "\u6807\u54C1", weight: 52 },
      { code: "\u5957\u88C5", label: "\u5957\u88C5", weight: 16 },
      { code: "\u914D\u4EF6", label: "\u914D\u4EF6", weight: 14 },
      { code: "\u793C\u76D2", label: "\u793C\u76D2", weight: 10 },
      { code: "\u670D\u52A1\u5546\u54C1", label: "\u670D\u52A1\u5546\u54C1", weight: 8 }
    ];
    var ECOMMERCE_SHELF_STATUS = [
      { code: "\u5728\u552E", label: "\u5728\u552E", weight: 74 },
      { code: "\u9884\u552E", label: "\u9884\u552E", weight: 10 },
      { code: "\u6682\u65F6\u7F3A\u8D27", label: "\u6682\u65F6\u7F3A\u8D27", weight: 9 },
      { code: "\u505C\u552E", label: "\u505C\u552E", weight: 7 }
    ];
    var ECOMMERCE_ORDER_CHANNELS = [
      { code: "APP", label: "APP", weight: 34 },
      { code: "\u5C0F\u7A0B\u5E8F", label: "\u5C0F\u7A0B\u5E8F", weight: 30 },
      { code: "H5", label: "H5", weight: 14 },
      { code: "\u95E8\u5E97POS", label: "\u95E8\u5E97POS", weight: 12 },
      { code: "\u4F01\u4E1A\u5546\u57CE", label: "\u4F01\u4E1A\u5546\u57CE", weight: 10 }
    ];
    var ECOMMERCE_ORDER_SOURCES = [
      { code: "\u641C\u7D22", label: "\u641C\u7D22", weight: 26 },
      { code: "\u63A8\u8350", label: "\u63A8\u8350", weight: 22 },
      { code: "\u6D3B\u52A8\u4F1A\u573A", label: "\u6D3B\u52A8\u4F1A\u573A", weight: 18 },
      { code: "\u76F4\u64AD\u95F4", label: "\u76F4\u64AD\u95F4", weight: 14 },
      { code: "\u8D2D\u7269\u8F66", label: "\u8D2D\u7269\u8F66", weight: 12 },
      { code: "\u4F01\u4E1A\u91C7\u8D2D", label: "\u4F01\u4E1A\u91C7\u8D2D", weight: 8 }
    ];
    var ECOMMERCE_DELIVERY_STATUS = [
      { code: "\u5F85\u51FA\u5E93", label: "\u5F85\u51FA\u5E93", weight: 18 },
      { code: "\u5DF2\u51FA\u5E93", label: "\u5DF2\u51FA\u5E93", weight: 20 },
      { code: "\u8FD0\u8F93\u4E2D", label: "\u8FD0\u8F93\u4E2D", weight: 26 },
      { code: "\u5DF2\u7B7E\u6536", label: "\u5DF2\u7B7E\u6536", weight: 28 },
      { code: "\u914D\u9001\u5F02\u5E38", label: "\u914D\u9001\u5F02\u5E38", weight: 8 }
    ];
    var ECOMMERCE_INVOICE_STATUS = [
      { code: "\u65E0\u9700\u5F00\u7968", label: "\u65E0\u9700\u5F00\u7968", weight: 48 },
      { code: "\u5F85\u5F00\u7968", label: "\u5F85\u5F00\u7968", weight: 18 },
      { code: "\u5DF2\u5F00\u7968", label: "\u5DF2\u5F00\u7968", weight: 28 },
      { code: "\u5DF2\u4F5C\u5E9F", label: "\u5DF2\u4F5C\u5E9F", weight: 6 }
    ];
    var ECOMMERCE_REFUND_REASONS = [
      { code: "\u4E03\u5929\u65E0\u7406\u7531", label: "\u4E03\u5929\u65E0\u7406\u7531", weight: 26 },
      { code: "\u5546\u54C1\u4E0E\u63CF\u8FF0\u4E0D\u7B26", label: "\u5546\u54C1\u4E0E\u63CF\u8FF0\u4E0D\u7B26", weight: 20 },
      { code: "\u7269\u6D41\u7834\u635F", label: "\u7269\u6D41\u7834\u635F", weight: 14 },
      { code: "\u91CD\u590D\u4E0B\u5355", label: "\u91CD\u590D\u4E0B\u5355", weight: 12 },
      { code: "\u8D28\u91CF\u95EE\u9898", label: "\u8D28\u91CF\u95EE\u9898", weight: 18 },
      { code: "\u53D1\u7968\u9700\u6C42\u53D8\u66F4", label: "\u53D1\u7968\u9700\u6C42\u53D8\u66F4", weight: 10 }
    ];
    var ECOMMERCE_REFUND_STATUS = [
      { code: "\u5F85\u5BA1\u6838", label: "\u5F85\u5BA1\u6838", weight: 20 },
      { code: "\u9000\u6B3E\u4E2D", label: "\u9000\u6B3E\u4E2D", weight: 22 },
      { code: "\u9000\u6B3E\u6210\u529F", label: "\u9000\u6B3E\u6210\u529F", weight: 48 },
      { code: "\u9000\u6B3E\u5173\u95ED", label: "\u9000\u6B3E\u5173\u95ED", weight: 10 }
    ];
    var ECOMMERCE_COURIERS = [
      { code: "\u987A\u4E30\u901F\u8FD0", label: "\u987A\u4E30\u901F\u8FD0", weight: 28 },
      { code: "\u4EAC\u4E1C\u7269\u6D41", label: "\u4EAC\u4E1C\u7269\u6D41", weight: 24 },
      { code: "\u4E2D\u901A\u5FEB\u9012", label: "\u4E2D\u901A\u5FEB\u9012", weight: 18 },
      { code: "\u5706\u901A\u901F\u9012", label: "\u5706\u901A\u901F\u9012", weight: 16 },
      { code: "\u83DC\u9E1F\u901F\u9012", label: "\u83DC\u9E1F\u901F\u9012", weight: 14 }
    ];
    var ECOMMERCE_DELIVERY_MODES = [
      { code: "\u5FEB\u9012\u914D\u9001", label: "\u5FEB\u9012\u914D\u9001", weight: 62 },
      { code: "\u540C\u57CE\u5373\u65F6\u8FBE", label: "\u540C\u57CE\u5373\u65F6\u8FBE", weight: 18 },
      { code: "\u95E8\u5E97\u81EA\u63D0", label: "\u95E8\u5E97\u81EA\u63D0", weight: 12 },
      { code: "\u5927\u4EF6\u9001\u88C5", label: "\u5927\u4EF6\u9001\u88C5", weight: 8 }
    ];
    var TRAFFIC_FUEL_TYPES = [
      { code: "\u6C7D\u6CB9", label: "\u6C7D\u6CB9", weight: 46 },
      { code: "\u67F4\u6CB9", label: "\u67F4\u6CB9", weight: 18 },
      { code: "\u6DF7\u52A8", label: "\u6DF7\u52A8", weight: 16 },
      { code: "\u7EAF\u7535", label: "\u7EAF\u7535", weight: 20 }
    ];
    var TRAFFIC_INSURANCE_STATUS = [
      { code: "\u6709\u6548", label: "\u6709\u6548", weight: 88 },
      { code: "\u4E34\u8FD1\u5230\u671F", label: "\u4E34\u8FD1\u5230\u671F", weight: 8 },
      { code: "\u5DF2\u8FC7\u671F", label: "\u5DF2\u8FC7\u671F", weight: 4 }
    ];
    var TRAFFIC_OPERATION_TYPES = [
      { code: "\u975E\u8425\u8FD0", label: "\u975E\u8425\u8FD0", weight: 74 },
      { code: "\u7F51\u7EA6\u8425\u8FD0", label: "\u7F51\u7EA6\u8425\u8FD0", weight: 12 },
      { code: "\u8D27\u8FD0\u8425\u8FD0", label: "\u8D27\u8FD0\u8425\u8FD0", weight: 9 },
      { code: "\u5BA2\u8FD0\u8425\u8FD0", label: "\u5BA2\u8FD0\u8425\u8FD0", weight: 5 }
    ];
    var TRAFFIC_PAYMENT_CHANNELS = [
      { code: "\u652F\u4ED8\u5B9D", label: "\u652F\u4ED8\u5B9D", weight: 40 },
      { code: "\u5FAE\u4FE1\u652F\u4ED8", label: "\u5FAE\u4FE1\u652F\u4ED8", weight: 34 },
      { code: "\u94F6\u8054\u67DC\u9762", label: "\u94F6\u8054\u67DC\u9762", weight: 16 },
      { code: "\u4EA4\u7BA112123", label: "\u4EA4\u7BA112123", weight: 10 }
    ];
    var TRAFFIC_ACCIDENT_LEVELS = [
      { code: "\u8F7B\u5FAE\u4E8B\u6545", label: "\u8F7B\u5FAE\u4E8B\u6545", weight: 48 },
      { code: "\u4E00\u822C\u4E8B\u6545", label: "\u4E00\u822C\u4E8B\u6545", weight: 34 },
      { code: "\u8F83\u5927\u4E8B\u6545", label: "\u8F83\u5927\u4E8B\u6545", weight: 14 },
      { code: "\u91CD\u5927\u4E8B\u6545", label: "\u91CD\u5927\u4E8B\u6545", weight: 4 }
    ];
    var TRAFFIC_CASE_STATUS = [
      { code: "\u5904\u7406\u4E2D", label: "\u5904\u7406\u4E2D", weight: 38 },
      { code: "\u5F85\u8BA4\u5B9A", label: "\u5F85\u8BA4\u5B9A", weight: 14 },
      { code: "\u5DF2\u7ED3\u6848", label: "\u5DF2\u7ED3\u6848", weight: 42 },
      { code: "\u5DF2\u79FB\u4EA4", label: "\u5DF2\u79FB\u4EA4", weight: 6 }
    ];
    var TRAFFIC_SOURCE_CHANNELS = [
      { code: "110\u62A5\u8B66", label: "110\u62A5\u8B66", weight: 22 },
      { code: "\u89C6\u9891\u5DE1\u67E5", label: "\u89C6\u9891\u5DE1\u67E5", weight: 20 },
      { code: "\u5361\u53E3\u9884\u8B66", label: "\u5361\u53E3\u9884\u8B66", weight: 16 },
      { code: "\u73B0\u573A\u53D1\u73B0", label: "\u73B0\u573A\u53D1\u73B0", weight: 24 },
      { code: "\u7FA4\u4F17\u4E3E\u62A5", label: "\u7FA4\u4F17\u4E3E\u62A5", weight: 18 }
    ];
    var TRAFFIC_DOCUMENT_TYPES = [
      { code: "\u8FDD\u6CD5\u5904\u7406\u901A\u77E5\u4E66", label: "\u8FDD\u6CD5\u5904\u7406\u901A\u77E5\u4E66", weight: 44 },
      { code: "\u73B0\u573A\u5904\u7F5A\u51B3\u5B9A\u4E66", label: "\u73B0\u573A\u5904\u7F5A\u51B3\u5B9A\u4E66", weight: 24 },
      { code: "\u5F3A\u5236\u63AA\u65BD\u51ED\u8BC1", label: "\u5F3A\u5236\u63AA\u65BD\u51ED\u8BC1", weight: 18 },
      { code: "\u4E8B\u6545\u8BA4\u5B9A\u4E66", label: "\u4E8B\u6545\u8BA4\u5B9A\u4E66", weight: 14 }
    ];
    var BANK_REPORT_FREQUENCY = [
      { code: "\u6708\u62A5", label: "\u6708\u62A5", weight: 26 },
      { code: "\u5B63\u62A5", label: "\u5B63\u62A5", weight: 34 },
      { code: "\u534A\u5E74\u62A5", label: "\u534A\u5E74\u62A5", weight: 14 },
      { code: "\u5E74\u62A5", label: "\u5E74\u62A5", weight: 10 },
      { code: "\u65E5\u62A5", label: "\u65E5\u62A5", weight: 16 }
    ];
    var BANK_DISPOSAL_STATUS = [
      { code: "\u5F85\u6574\u6539", label: "\u5F85\u6574\u6539", weight: 18 },
      { code: "\u6574\u6539\u4E2D", label: "\u6574\u6539\u4E2D", weight: 34 },
      { code: "\u5DF2\u5173\u95ED", label: "\u5DF2\u5173\u95ED", weight: 42 },
      { code: "\u5347\u7EA7\u5904\u7406", label: "\u5347\u7EA7\u5904\u7406", weight: 6 }
    ];
    var BANK_TASK_STATUS = [
      { code: "\u5F85\u6267\u884C", label: "\u5F85\u6267\u884C", weight: 18 },
      { code: "\u6574\u6539\u4E2D", label: "\u6574\u6539\u4E2D", weight: 40 },
      { code: "\u5DF2\u5B8C\u6210", label: "\u5DF2\u5B8C\u6210", weight: 38 },
      { code: "\u5DF2\u5EF6\u671F", label: "\u5DF2\u5EF6\u671F", weight: 4 }
    ];
    var BANK_ALERT_STATUS = [
      { code: "\u5F85\u6838\u67E5", label: "\u5F85\u6838\u67E5", weight: 22 },
      { code: "\u6838\u67E5\u4E2D", label: "\u6838\u67E5\u4E2D", weight: 26 },
      { code: "\u5DF2\u6392\u9664", label: "\u5DF2\u6392\u9664", weight: 34 },
      { code: "\u5DF2\u4E0A\u62A5", label: "\u5DF2\u4E0A\u62A5", weight: 18 }
    ];
    var BANK_REVIEW_RESULTS = [
      { code: "\u6B63\u5E38", label: "\u6B63\u5E38", weight: 66 },
      { code: "\u53EF\u7591", label: "\u53EF\u7591", weight: 16 },
      { code: "\u9700\u8865\u5145\u8BF4\u660E", label: "\u9700\u8865\u5145\u8BF4\u660E", weight: 18 }
    ];
    var BANK_SUBMIT_CHANNELS = [
      { code: "\u76D1\u7BA1\u4E13\u7F51", label: "\u76D1\u7BA1\u4E13\u7F51", weight: 54 },
      { code: "\u62A5\u9001\u5E73\u53F0", label: "\u62A5\u9001\u5E73\u53F0", weight: 30 },
      { code: "\u90AE\u4EF6\u8865\u6B63", label: "\u90AE\u4EF6\u8865\u6B63", weight: 10 },
      { code: "\u4E13\u7EBF\u4F20\u8F93", label: "\u4E13\u7EBF\u4F20\u8F93", weight: 6 }
    ];
    var BANK_APPROVAL_RESULTS = [
      { code: "\u901A\u8FC7", label: "\u901A\u8FC7", weight: 68 },
      { code: "\u9000\u56DE", label: "\u9000\u56DE", weight: 18 },
      { code: "\u8865\u5145\u6750\u6599", label: "\u8865\u5145\u6750\u6599", weight: 14 }
    ];
    var MAINLAND_MOBILE_PREFIXES = ["130", "131", "132", "133", "135", "136", "137", "138", "139", "150", "151", "152", "155", "156", "157", "158", "159", "180", "181", "182", "183", "185", "186", "187", "188", "189"];
    var MAINLAND_CONSERVATIVE_MOBILE_PREFIXES = MAINLAND_MOBILE_PREFIXES;
    var EDUCATION_SCHOOL_TYPES = [
      { code: "PUBLIC_PRIMARY", label: "Public Primary School", weight: 22 },
      { code: "PUBLIC_JUNIOR", label: "Public Junior High School", weight: 20 },
      { code: "PUBLIC_HIGH", label: "Public High School", weight: 16 },
      { code: "PRIVATE_K12", label: "Private K12 School", weight: 12 },
      { code: "VOCATIONAL_COLLEGE", label: "Vocational College", weight: 10 },
      { code: "PUBLIC_UNIVERSITY", label: "Public University", weight: 20 }
    ];
    var EDUCATION_STAGES = [
      { code: "PRIMARY", label: "Primary", weight: 22 },
      { code: "JUNIOR", label: "Junior High", weight: 18 },
      { code: "HIGH", label: "Senior High", weight: 16 },
      { code: "VOCATIONAL", label: "Vocational", weight: 12 },
      { code: "UNDERGRAD", label: "Undergraduate", weight: 24 },
      { code: "POSTGRAD", label: "Postgraduate", weight: 8 }
    ];
    var EDUCATION_GRADE_CODES = [
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
      { code: "PG2", label: "Postgraduate Year 2", weight: 3 }
    ];
    var EDUCATION_TERM_CODES = [
      { code: "2025_FALL", label: "2025 Fall", weight: 24 },
      { code: "2026_SPRING", label: "2026 Spring", weight: 28 },
      { code: "2026_SUMMER", label: "2026 Summer", weight: 10 },
      { code: "2026_FALL", label: "2026 Fall", weight: 38 }
    ];
    var EDUCATION_SUBJECTS = [
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
      { code: "MUSIC", label: "Music", weight: 4 }
    ];
    var EDUCATION_STAFF_ROLES = [
      { code: "HEADMASTER", label: "Headmaster", weight: 4 },
      { code: "TEACHER", label: "Teacher", weight: 48 },
      { code: "COUNSELOR", label: "Counselor", weight: 8 },
      { code: "ACADEMIC_AFFAIRS", label: "Academic Affairs", weight: 10 },
      { code: "FINANCE", label: "Finance", weight: 8 },
      { code: "LIBRARIAN", label: "Librarian", weight: 6 },
      { code: "SECURITY", label: "Security Officer", weight: 6 },
      { code: "LOGISTICS", label: "Logistics", weight: 10 }
    ];
    var EDUCATION_BILL_STATUS = [
      { code: "PENDING", label: "Pending", weight: 20 },
      { code: "PARTIAL", label: "Partial", weight: 12 },
      { code: "PAID", label: "Paid", weight: 56 },
      { code: "OVERDUE", label: "Overdue", weight: 8 },
      { code: "REFUNDED", label: "Refunded", weight: 4 }
    ];
    var EDUCATION_ACCESS_RESULTS = [
      { code: "PASS", label: "Pass", weight: 84 },
      { code: "LATE", label: "Late", weight: 8 },
      { code: "DENY", label: "Denied", weight: 3 },
      { code: "MANUAL_RELEASE", label: "Manual Release", weight: 5 }
    ];
    var EDUCATION_BORROW_STATUS = [
      { code: "BORROWING", label: "Borrowing", weight: 20 },
      { code: "RETURNED", label: "Returned", weight: 68 },
      { code: "OVERDUE", label: "Overdue", weight: 12 }
    ];
    var EDUCATION_SUBTYPE_OVERRIDES = {
      student_lifecycle: {
        focusModules: ["student_profile", "guardian_contact", "student_enrollment"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 24, PUBLIC_JUNIOR: 22, PUBLIC_HIGH: 16, PRIVATE_K12: 14, VOCATIONAL_COLLEGE: 8, PUBLIC_UNIVERSITY: 16 },
        subjectWeights: { CHINESE: 16, MATH: 16, ENGLISH: 15, PE: 8 }
      },
      staff_hr: {
        focusModules: ["staff_profile", "class_schedule", "course_catalog"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 18, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 18, PRIVATE_K12: 12, VOCATIONAL_COLLEGE: 10, PUBLIC_UNIVERSITY: 24 },
        staffRoleWeights: { HEADMASTER: 4, TEACHER: 52, COUNSELOR: 10, ACADEMIC_AFFAIRS: 12, FINANCE: 6, LIBRARIAN: 4, SECURITY: 4, LOGISTICS: 8 }
      },
      tuition_billing: {
        focusModules: ["student_enrollment", "tuition_bill"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 20, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 16, PRIVATE_K12: 18, VOCATIONAL_COLLEGE: 12, PUBLIC_UNIVERSITY: 16 },
        billStatusWeights: { PENDING: 18, PARTIAL: 14, PAID: 54, OVERDUE: 10, REFUNDED: 4 }
      },
      class_scheduling: {
        focusModules: ["course_catalog", "class_schedule", "staff_profile"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 18, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 20, PRIVATE_K12: 12, VOCATIONAL_COLLEGE: 12, PUBLIC_UNIVERSITY: 20 },
        subjectWeights: { CHINESE: 14, MATH: 14, ENGLISH: 14, PHYSICS: 8, CHEMISTRY: 7, BIOLOGY: 7, COMPUTER: 10, PE: 8, ART: 6, MUSIC: 6 }
      },
      parent_school: {
        focusModules: ["student_profile", "guardian_contact", "campus_access_log"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 28, PUBLIC_JUNIOR: 24, PUBLIC_HIGH: 14, PRIVATE_K12: 16, VOCATIONAL_COLLEGE: 6, PUBLIC_UNIVERSITY: 12 }
      },
      campus_security: {
        focusModules: ["campus_dimension", "campus_access_log", "staff_profile"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 22, PUBLIC_JUNIOR: 20, PUBLIC_HIGH: 16, PRIVATE_K12: 14, VOCATIONAL_COLLEGE: 8, PUBLIC_UNIVERSITY: 20 },
        accessResultWeights: { PASS: 80, LATE: 10, DENY: 4, MANUAL_RELEASE: 6 }
      },
      library_service: {
        focusModules: ["student_profile", "library_borrow_record", "course_catalog"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 16, PUBLIC_JUNIOR: 16, PUBLIC_HIGH: 18, PRIVATE_K12: 10, VOCATIONAL_COLLEGE: 12, PUBLIC_UNIVERSITY: 28 },
        borrowStatusWeights: { BORROWING: 18, RETURNED: 68, OVERDUE: 14 }
      },
      general: {
        focusModules: ["student_profile", "staff_profile", "class_schedule", "tuition_bill", "campus_access_log", "library_borrow_record"],
        schoolTypeWeights: { PUBLIC_PRIMARY: 20, PUBLIC_JUNIOR: 18, PUBLIC_HIGH: 16, PRIVATE_K12: 12, VOCATIONAL_COLLEGE: 10, PUBLIC_UNIVERSITY: 24 }
      }
    };
    var ECOMMERCE_SUBTYPE_OVERRIDES = {
      electronics: {
        preferredCategories: ["ELECTRONIC", "HOME"],
        categoryWeights: { ELECTRONIC: 58, HOME: 22, FOOD: 8, APPAREL: 12 }
      },
      food: {
        preferredCategories: ["FOOD", "APPAREL"],
        categoryWeights: { FOOD: 56, APPAREL: 18, ELECTRONIC: 14, HOME: 12 }
      },
      apparel: {
        preferredCategories: ["APPAREL", "ELECTRONIC"],
        categoryWeights: { APPAREL: 54, ELECTRONIC: 20, HOME: 10, FOOD: 16 }
      },
      home: {
        preferredCategories: ["HOME", "ELECTRONIC"],
        categoryWeights: { HOME: 52, ELECTRONIC: 26, FOOD: 8, APPAREL: 14 }
      },
      general: {
        preferredCategories: ["ELECTRONIC", "HOME", "FOOD", "APPAREL"],
        categoryWeights: { ELECTRONIC: 34, HOME: 26, FOOD: 20, APPAREL: 20 }
      }
    };
    var SCENARIO_DEFINITIONS = [
      {
        industry: "education",
        subScenario: "student_lifecycle",
        keywords: [
          { pattern: /\beducation\b|\bschool\b|\bstudent\b|\bteacher\b|\bcampus\b|\bclass\b|\bcurriculum\b|\btuition\b|\blibrary\b|\bguardian\b/, weight: 6 },
          { pattern: /教育|学校|学生|教师|校园|班级|课程|学籍|学费|图书馆|家校|门禁/, weight: 6 }
        ]
      },
      {
        industry: "ecommerce",
        subScenario: "retail-commerce",
        keywords: [
          { pattern: /\becommerce\b|\bonline retail\b|\bproduct\b|\border\b|\bpayment\b|\brefund\b|\bsku\b|\bcart\b/, weight: 6 },
          { pattern: /\bretail\b|\bmerchant\b|\bgmv\b|\buv\b|\bconversion\b|\banchor\b|\bsession\b/, weight: 6 },
          { pattern: /电商|订单|支付|退款|商品|商城|购物车|售后|sku|商家/, weight: 6 }
        ]
      },
      {
        industry: "crm",
        subScenario: "sales-crm",
        keywords: [
          { pattern: /\bcrm\b|\blead\b|\bopportunity\b|\bsales\b|\bcustomer\b/, weight: 5 },
          { pattern: /客户|线索|商机|销售|跟进/, weight: 5 }
        ]
      },
      {
        industry: "marriage",
        subScenario: "civil-registration",
        keywords: [
          { pattern: /\bmarriage\b|\bappointment\b|\bregistration\b/, weight: 5 },
          { pattern: /婚姻|登记|预约|民政/, weight: 5 }
        ]
      },
      {
        industry: "traffic",
        subScenario: "urban-traffic-control",
        keywords: [
          { pattern: /\btraffic\b|\bvehicle\b|\bviolation\b|\bcheckpoint\b|\broad\b|\bintersection\b/, weight: 6 },
          { pattern: /交通|车辆|违法|卡口|路口|高架|违章|交警|检查站/, weight: 6 }
        ]
      },
      {
        industry: "bank_regulatory",
        subScenario: "prudential-reporting",
        keywords: [
          { pattern: /\bbank\b|\bregulatory\b|\breport\b|\bprudential\b|\baml\b|\brisk\b/, weight: 6 },
          { pattern: /银行|监管|报送|报表|审慎|反洗钱|风险暴露|资产质量/, weight: 6 }
        ]
      }
    ];
    SCENARIO_DEFINITIONS.push(
      {
        industry: "finance_fund",
        subScenario: "fund-operations",
        keywords: [
          { pattern: /\bfund\b|\bnav\b|\bsubscription\b|\bredemption\b|\basset management\b|\bportfolio\b/, weight: 6 },
          { pattern: /\bwealth\b|\binvestor\b|\bholding\b|\btransfer agent\b/, weight: 5 },
          { pattern: /鍩洪噾|鍑€鍊?|鐢宠喘|璧庡洖|鎶曡祫浜?|鎸佷粨|鍩洪噾鍏徃|浜ゆ槗纭/, weight: 6 }
        ]
      },
      {
        industry: "logistics_express",
        subScenario: "express-fulfillment",
        keywords: [
          { pattern: /\blogistics\b|\bexpress\b|\bwaybill\b|\bparcel\b|\bdelivery\b|\btransfer\b|\bsort\b/, weight: 6 },
          { pattern: /\bcourier\b|\bsign\b|\bwarehouse\b|\blast mile\b/, weight: 5 },
          { pattern: /蹇€?|鐗╂祦|杩愬崟|鍖呰９|閰嶉€?|涓浆|鍒嗘嫧|绛炬敹|蹇€掑憳/, weight: 6 }
        ]
      }
    );
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
      const candidates = (managedProfiles || []).filter((item) => item && item.status === "active" && item.recognition && typeof item.recognition === "object").map((item) => {
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
          signals: matchedPositive.slice(0, 12).map((token) => `managed:${token}`)
        };
      }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score);
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
        signals: winner.signals
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
            signals: ["fallback:industry-keywords"]
          };
        }
        return {
          industry: "generic",
          subScenario: "generic",
          confidence: 0.2,
          signals: []
        };
      }
      const confidence = Math.min(0.98, Math.max(0.35, winner.score / Math.max(1, winner.score + (runnerUp?.score || 0))));
      return {
        industry: winner.industry,
        subScenario: winner.subScenario,
        confidence,
        signals: winner.signals.slice(0, 12)
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
    var INDUSTRY_DYNAMIC_MODULE_KEYWORDS = {
      bank_regulatory: [
        { moduleKey: "customer_account", pattern: /\baccount\b|\bdeposit\b|\bledger\b|账户|存款|台账|流水/ },
        { moduleKey: "loan_contract", pattern: /\bloan\b|\bcredit\b|\bcontract\b|贷款|授信|借据|合同/ }
      ],
      traffic: [
        { moduleKey: "driver_training", pattern: /\bdriver training\b|\blicense learning\b|\bdriving school\b|\blearning record\b|驾照学习|驾驶学习|驾驶培训|学车|驾考|科目一|科目二|科目三|科目四/ },
        { moduleKey: "checkpoint_vehicle_pass", pattern: /\bcheckpoint pass\b|\bvehicle pass\b|\bpass record\b|\bgantry\b|\bcheckpoint vehicle\b|卡口过车|过车记录|卡口通行|车辆过车|车辆通行|卡口抓拍/ }
      ],
      ecommerce: [
        { moduleKey: "live_stream", pattern: /\blive stream\b|\blivestream\b|\binfluencer\b|\bstreaming\b|直播带货|直播零售|主播|直播间/ },
        { moduleKey: "enterprise_procurement", pattern: /\benterprise procurement\b|\bb2b\b|\bbulk order\b|\bwholesale\b|企业采购|大宗采购|批发订单|团购采购/ }
      ],
      education: [
        { moduleKey: "parent_communication", pattern: /\bparent communication\b|\bhome-school\b|\bmessage\b|\bnotice\b|家校互通|家校沟通|家长通知|班级通知/ },
        { moduleKey: "dormitory_management", pattern: /\bdormitory\b|\bbed\b|\bresidence\b|\bboarding\b|宿舍|住宿|床位|住校/ }
      ]
    };
    var INDUSTRY_DYNAMIC_MODULE_HINTS = {
      bank_regulatory: {
        customer_account: {
          hints: ["customer_account", "customer account", "account ledger", "deposit account", "\u8D26\u6237", "\u8D26\u6237\u53F0\u8D26", "\u8D26\u6237\u6D41\u6C34", "\u5B58\u6B3E\u8D26\u6237"],
          keywords: ["account", "ledger", "deposit", "\u8D26\u6237", "\u53F0\u8D26", "\u6D41\u6C34", "\u5B58\u6B3E"],
          minHits: 2
        },
        loan_contract: {
          hints: ["loan_contract", "loan contract", "credit contract", "\u8D37\u6B3E\u5408\u540C", "\u6388\u4FE1\u5408\u540C", "\u501F\u636E\u5408\u540C"],
          keywords: ["loan", "credit", "contract", "\u8D37\u6B3E", "\u6388\u4FE1", "\u5408\u540C", "\u501F\u636E"],
          minHits: 2
        }
      },
      traffic: {
        driver_training: {
          hints: ["driver_training", "driver training", "license learning", "driving school", "\u9A7E\u7167\u5B66\u4E60", "\u9A7E\u9A76\u57F9\u8BAD", "\u9A7E\u9A76\u5B66\u4E60", "\u5B66\u8F66", "\u9A7E\u8003"],
          keywords: ["driver", "training", "license", "school", "learn", "\u9A7E\u7167", "\u9A7E\u9A76", "\u57F9\u8BAD", "\u5B66\u8F66", "\u9A7E\u8003", "\u79D1\u76EE"],
          minHits: 2
        },
        checkpoint_vehicle_pass: {
          hints: ["checkpoint_vehicle_pass", "checkpoint pass", "vehicle pass", "gantry pass", "\u5361\u53E3\u8FC7\u8F66", "\u8FC7\u8F66\u8BB0\u5F55", "\u5361\u53E3\u901A\u884C", "\u5361\u53E3\u6293\u62CD"],
          keywords: ["checkpoint", "pass", "gantry", "vehicle", "\u5361\u53E3", "\u8FC7\u8F66", "\u901A\u884C", "\u6293\u62CD"],
          minHits: 2
        }
      },
      ecommerce: {
        live_stream: {
          hints: ["live_stream", "live stream", "livestream", "live commerce", "\u76F4\u64AD\u5E26\u8D27", "\u76F4\u64AD\u96F6\u552E", "\u76F4\u64AD\u95F4", "\u4E3B\u64AD\u5E26\u8D27"],
          keywords: ["live", "stream", "livestream", "commerce", "\u76F4\u64AD", "\u5E26\u8D27", "\u4E3B\u64AD", "\u76F4\u64AD\u95F4"],
          minHits: 2
        },
        enterprise_procurement: {
          hints: ["enterprise_procurement", "enterprise procurement", "b2b procurement", "bulk order", "\u4F01\u4E1A\u91C7\u8D2D", "\u5927\u5B97\u91C7\u8D2D", "\u6279\u53D1\u8BA2\u5355", "\u56E2\u8D2D\u91C7\u8D2D"],
          keywords: ["enterprise", "procurement", "bulk", "wholesale", "b2b", "\u4F01\u4E1A", "\u91C7\u8D2D", "\u6279\u53D1", "\u5927\u5B97", "\u56E2\u8D2D"],
          minHits: 2
        }
      },
      education: {
        parent_communication: {
          hints: ["parent_communication", "parent communication", "home-school", "guardian notice", "\u5BB6\u6821\u6C9F\u901A", "\u5BB6\u957F\u901A\u77E5", "\u5BB6\u6821\u4E92\u901A", "\u73ED\u7EA7\u901A\u77E5"],
          keywords: ["parent", "guardian", "communication", "notice", "message", "\u5BB6\u957F", "\u76D1\u62A4\u4EBA", "\u5BB6\u6821", "\u6C9F\u901A", "\u901A\u77E5", "\u6D88\u606F"],
          minHits: 2
        },
        dormitory_management: {
          hints: ["dormitory_management", "dormitory", "boarding", "bed allocation", "\u5BBF\u820D\u7BA1\u7406", "\u4F4F\u5BBF\u7BA1\u7406", "\u4F4F\u6821", "\u5E8A\u4F4D\u7BA1\u7406"],
          keywords: ["dormitory", "boarding", "bed", "residence", "\u5BBF\u820D", "\u4F4F\u5BBF", "\u4F4F\u6821", "\u5E8A\u4F4D"],
          minHits: 2
        }
      }
    };
    var INDUSTRY_DYNAMIC_MODULE_METADATA = {
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
            results: ["balance", "freeze"]
          }
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
            results: ["overdue", "maturity"]
          }
        }
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
            results: ["hours", "progress", "certificate"]
          }
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
            results: ["alert", "speed", "evidence"]
          }
        }
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
            results: ["traffic", "gmv", "order"]
          }
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
            results: ["bulk_order", "delivery", "settlement"]
          }
        }
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
            results: ["notice_receipt", "response", "feedback"]
          }
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
            results: ["resident_status", "bed_assignment", "lodging"]
          }
        }
      }
    };
    var INDUSTRY_BUSINESS_CONCEPT_LEXICON = {
      bank_regulatory: {
        objects: {
          customer: { label: "customer", tokens: ["customer", "client", "account holder", "\u5BA2\u6237", "\u6237\u4E3B"] },
          branch: { label: "branch", tokens: ["branch", "sub-branch", "outlet", "\u652F\u884C", "\u5206\u652F\u673A\u6784", "\u7F51\u70B9"] },
          borrower: { label: "borrower", tokens: ["borrower", "credit user", "\u501F\u6B3E\u4EBA", "\u6388\u4FE1\u5BA2\u6237"] },
          contract: { label: "contract", tokens: ["contract", "agreement", "\u501F\u636E", "\u5408\u540C", "\u534F\u8BAE"] }
        },
        actions: {
          maintain: { label: "maintain", tokens: ["maintain", "manage", "update", "\u7EF4\u62A4", "\u7BA1\u7406", "\u66F4\u65B0"] },
          report: { label: "report", tokens: ["report", "submit", "declare", "\u62A5\u9001", "\u4E0A\u62A5", "\u7533\u62A5"] },
          grant: { label: "grant", tokens: ["grant", "issue", "disburse", "\u653E\u6B3E", "\u53D1\u653E", "\u6388\u4FE1"] },
          sign: { label: "sign", tokens: ["sign", "approve", "execute", "\u7B7E\u7EA6", "\u7B7E\u7F72", "\u5BA1\u6279"] },
          track: { label: "track", tokens: ["track", "monitor", "follow", "\u8DDF\u8E2A", "\u76D1\u63A7", "\u8FFD\u8E2A"] }
        },
        results: {
          balance: { label: "balance", tokens: ["balance", "available balance", "\u4F59\u989D", "\u53EF\u7528\u4F59\u989D"] },
          freeze: { label: "freeze", tokens: ["freeze", "frozen", "hold amount", "\u51BB\u7ED3", "\u51BB\u7ED3\u91D1\u989D"] },
          overdue: { label: "overdue", tokens: ["overdue", "delinquent", "past due", "\u903E\u671F", "\u6B20\u606F"] },
          maturity: { label: "maturity", tokens: ["maturity", "due date", "repayment date", "\u5230\u671F", "\u5230\u671F\u65E5"] },
          settlement: { label: "settlement", tokens: ["settlement", "clearing", "\u7ED3\u7B97", "\u6E05\u7B97"] }
        }
      },
      traffic: {
        objects: {
          driver: { label: "driver", tokens: ["driver", "trainee", "learner", "\u9A7E\u9A76\u4EBA", "\u5B66\u5458"] },
          coach: { label: "coach", tokens: ["coach", "instructor", "trainer", "\u6559\u7EC3", "\u5E26\u6559"] },
          exam: { label: "exam", tokens: ["exam", "subject test", "theory test", "\u8003\u8BD5", "\u79D1\u76EE\u8003\u8BD5"] },
          vehicle: { label: "vehicle", tokens: ["vehicle", "car", "plate", "\u8F66\u8F86", "\u673A\u52A8\u8F66"] },
          checkpoint: { label: "checkpoint", tokens: ["checkpoint", "gantry", "gate", "\u5361\u53E3", "\u95E8\u67B6"] },
          device: { label: "device", tokens: ["device", "camera", "sensor", "\u8BBE\u5907", "\u6293\u62CD\u673A"] }
        },
        actions: {
          enroll: { label: "enroll", tokens: ["enroll", "register", "apply", "\u62A5\u540D", "\u767B\u8BB0"] },
          practice: { label: "practice", tokens: ["practice", "train", "learn", "\u7EC3\u4E60", "\u57F9\u8BAD", "\u5B66\u65F6"] },
          schedule: { label: "schedule", tokens: ["schedule", "arrange", "plan", "\u5B89\u6392", "\u6392\u671F"] },
          pass: { label: "pass", tokens: ["pass", "transit", "travel through", "\u901A\u884C", "\u8FC7\u8F66"] },
          capture: { label: "capture", tokens: ["capture", "snap", "photograph", "\u6293\u62CD", "\u91C7\u96C6"] },
          monitor: { label: "monitor", tokens: ["monitor", "watch", "inspect", "\u76D1\u6D4B", "\u76D1\u63A7", "\u5DE1\u68C0"] }
        },
        results: {
          hours: { label: "hours", tokens: ["hours", "practice hours", "study hours", "\u5B66\u65F6", "\u8BAD\u7EC3\u65F6\u957F"] },
          progress: { label: "progress", tokens: ["progress", "status", "completion", "\u8FDB\u5EA6", "\u5B8C\u6210\u60C5\u51B5"] },
          certificate: { label: "certificate", tokens: ["license", "certificate", "credential", "\u8BC1\u7167", "\u9A7E\u9A76\u8BC1"] },
          alert: { label: "alert", tokens: ["alert", "warning", "hit", "\u9884\u8B66", "\u544A\u8B66", "\u5E03\u63A7"] },
          speed: { label: "speed", tokens: ["speed", "overspeed", "velocity", "\u901F\u5EA6", "\u8D85\u901F"] },
          evidence: { label: "evidence", tokens: ["evidence", "image", "snapshot", "\u8BC1\u636E", "\u56FE\u7247", "\u5F71\u50CF"] }
        }
      },
      ecommerce: {
        objects: {
          host: { label: "host", tokens: ["host", "anchor", "streamer", "\u4E3B\u64AD", "\u8FBE\u4EBA"] },
          session: { label: "session", tokens: ["session", "show", "campaign", "\u573A\u6B21", "\u76F4\u64AD\u573A"] },
          store: { label: "store", tokens: ["store", "merchant", "shop", "\u95E8\u5E97", "\u5546\u5BB6", "\u5E97\u94FA"] },
          enterprise: { label: "enterprise", tokens: ["enterprise", "company", "business buyer", "\u4F01\u4E1A", "\u516C\u53F8", "\u91C7\u8D2D\u65B9"] },
          contract: { label: "contract", tokens: ["contract", "agreement", "quote", "\u5408\u540C", "\u534F\u8BAE", "\u62A5\u4EF7\u5355"] },
          warehouse: { label: "warehouse", tokens: ["warehouse", "fulfillment center", "stock center", "\u4ED3\u5E93", "\u4ED3\u914D"] }
        },
        actions: {
          broadcast: { label: "broadcast", tokens: ["broadcast", "showcase", "present", "\u5F00\u64AD", "\u5C55\u793A", "\u8BB2\u89E3"] },
          promote: { label: "promote", tokens: ["promote", "recommend", "advertise", "\u63A8\u5E7F", "\u79CD\u8349", "\u63A8\u8350"] },
          convert: { label: "convert", tokens: ["convert", "purchase", "order", "\u8F6C\u5316", "\u4E0B\u5355", "\u6210\u4EA4"] },
          procure: { label: "procure", tokens: ["procure", "buy in bulk", "source", "\u91C7\u8D2D", "\u96C6\u91C7", "\u6279\u91CF\u8D2D\u4E70"] },
          deliver: { label: "deliver", tokens: ["deliver", "ship", "fulfill", "\u4EA4\u4ED8", "\u53D1\u8D27", "\u5C65\u7EA6"] },
          settle: { label: "settle", tokens: ["settle", "invoice", "pay", "\u7ED3\u7B97", "\u5F00\u7968", "\u4ED8\u6B3E"] }
        },
        results: {
          traffic: { label: "traffic", tokens: ["traffic", "uv", "visitors", "\u6D41\u91CF", "\u8BBF\u5BA2", "\u66DD\u5149"] },
          gmv: { label: "gmv", tokens: ["gmv", "sales amount", "merchandise value", "\u6210\u4EA4\u989D", "\u9500\u552E\u989D"] },
          order: { label: "order", tokens: ["order", "order count", "\u8BA2\u5355", "\u8BA2\u5355\u91CF"] },
          bulk_order: { label: "bulk_order", tokens: ["bulk order", "b2b order", "\u5927\u5B97\u8BA2\u5355", "\u4F01\u4E1A\u8BA2\u5355"] },
          delivery: { label: "delivery", tokens: ["delivery", "fulfillment", "\u4EA4\u4ED8", "\u5C65\u7EA6"] },
          settlement: { label: "settlement", tokens: ["settlement", "invoice", "payment receipt", "\u7ED3\u7B97", "\u56DE\u6B3E"] }
        }
      },
      education: {
        objects: {
          student: { label: "student", tokens: ["student", "learner", "pupil", "\u5B66\u751F", "\u5B66\u5458"] },
          guardian: { label: "guardian", tokens: ["guardian", "parent", "family", "\u76D1\u62A4\u4EBA", "\u5BB6\u957F", "\u5BB6\u5EAD"] },
          teacher: { label: "teacher", tokens: ["teacher", "advisor", "class adviser", "\u6559\u5E08", "\u73ED\u4E3B\u4EFB"] },
          dormitory: { label: "dormitory", tokens: ["dormitory", "boarding", "residence hall", "\u5BBF\u820D", "\u4F4F\u5BBF"] },
          bed: { label: "bed", tokens: ["bed", "room", "roommate", "\u5E8A\u4F4D", "\u5BDD\u5BA4", "\u623F\u95F4"] }
        },
        actions: {
          notify: { label: "notify", tokens: ["notify", "send notice", "announce", "\u901A\u77E5", "\u53D1\u9001\u516C\u544A"] },
          communicate: { label: "communicate", tokens: ["communicate", "sync", "contact", "\u6C9F\u901A", "\u8054\u7CFB", "\u4E92\u901A"] },
          reply: { label: "reply", tokens: ["reply", "acknowledge", "confirm", "\u56DE\u590D", "\u56DE\u6267", "\u786E\u8BA4"] },
          checkin: { label: "checkin", tokens: ["check in", "move in", "\u5165\u4F4F", "\u5165\u5BBF", "\u62A5\u5230\u5165\u4F4F"] },
          allocate: { label: "allocate", tokens: ["allocate", "assign", "arrange", "\u5206\u914D", "\u5B89\u6392"] },
          manage: { label: "manage", tokens: ["manage", "supervise", "maintain", "\u7BA1\u7406", "\u7EF4\u62A4"] }
        },
        results: {
          notice_receipt: { label: "notice_receipt", tokens: ["receipt", "signed", "delivery status", "\u9001\u8FBE", "\u7B7E\u6536"] },
          response: { label: "response", tokens: ["response", "feedback", "follow-up", "\u53CD\u9988", "\u56DE\u590D"] },
          feedback: { label: "feedback", tokens: ["feedback", "comment", "message result", "\u610F\u89C1", "\u56DE\u8BBF"] },
          resident_status: { label: "resident_status", tokens: ["resident status", "boarding status", "\u4F4F\u5BBF\u72B6\u6001", "\u5165\u4F4F\u72B6\u6001"] },
          bed_assignment: { label: "bed_assignment", tokens: ["bed assignment", "room assignment", "\u5E8A\u4F4D\u5206\u914D", "\u5BDD\u5BA4\u5206\u914D"] },
          lodging: { label: "lodging", tokens: ["lodging", "stay", "\u4F4F\u5BBF", "\u4F4F\u6821"] }
        }
      }
    };
    function collectMatchedTokens(haystack, tokens) {
      const matched = /* @__PURE__ */ new Set();
      (tokens || []).forEach((token) => {
        const normalized = normalizeText(token);
        if (normalized && haystack.includes(normalized)) {
          matched.add(normalized);
        }
      });
      return Array.from(matched);
    }
    function collectConceptMatches(haystack, definitions) {
      return Object.entries(definitions || {}).map(([key, definition]) => {
        const matchedTokens = collectMatchedTokens(haystack, definition.tokens);
        return matchedTokens.length > 0 ? { key, label: definition.label || key, matchedTokens } : null;
      }).filter(Boolean);
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
      const summary = totalMatches > 0 ? `Extracted concepts: objects=${objects.map((item) => item.key).join(",") || "none"}; actions=${actions.map((item) => item.key).join(",") || "none"}; results=${results.map((item) => item.key).join(",") || "none"}.` : "No business concepts extracted from current scenario text.";
      return { industry, objects, actions, results, totalMatches, summary };
    }
    function buildModuleConceptOverlap(moduleConcepts, conceptPlan) {
      if (!moduleConcepts || !conceptPlan) {
        return { matched: false, score: 0, reasons: [], overlap: { objects: [], actions: [], results: [] } };
      }
      const overlap = {
        objects: (conceptPlan.objects || []).filter((item) => (moduleConcepts.objects || []).includes(item.key)),
        actions: (conceptPlan.actions || []).filter((item) => (moduleConcepts.actions || []).includes(item.key)),
        results: (conceptPlan.results || []).filter((item) => (moduleConcepts.results || []).includes(item.key))
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
      const merged = /* @__PURE__ */ new Map();
      [...primary, ...secondary].forEach((item) => {
        if (!item?.key) return;
        const current = merged.get(item.key) || { key: item.key, label: item.label || item.key, matchedTokens: [] };
        current.label = current.label || item.label || item.key;
        current.matchedTokens = [.../* @__PURE__ */ new Set([...current.matchedTokens || [], ...(item.matchedTokens || []).filter(Boolean)])];
        merged.set(item.key, current);
      });
      return Array.from(merged.values());
    }
    function summarizeConceptPlan(industry, objects, actions, results) {
      const totalMatches = objects.length + actions.length + results.length;
      const summary = totalMatches > 0 ? `Extracted concepts: objects=${objects.map((item) => item.key).join(",") || "none"}; actions=${actions.map((item) => item.key).join(",") || "none"}; results=${results.map((item) => item.key).join(",") || "none"}.` : "No business concepts extracted from current scenario text.";
      return { industry, objects, actions, results, totalMatches, summary };
    }
    function buildEmptyConceptPlan(industry, summary = "No business concepts extracted from current scenario text.") {
      return { industry, objects: [], actions: [], results: [], totalMatches: 0, summary };
    }
    function parseDelimitedValues(value) {
      return String(value || "").split(/[,;|，；、]/).map((item) => item.trim()).filter(Boolean);
    }
    function extractKnowledgeKeywords(knowledgeText, limit = 12) {
      return [...new Set(String(knowledgeText || "").match(/[A-Za-z0-9_\u4e00-\u9fa5-]{2,}/g) || [])].slice(0, limit);
    }
    function normalizeKnowledgeLine(line) {
      return String(line || "").replace(/^\s*[#>*\-\d.、]+\s*/g, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    }
    function extractKnowledgeHeadlineLines(knowledgeText, limit = 10) {
      const lines = String(knowledgeText || "").replace(/\r/g, "").split("\n").map(normalizeKnowledgeLine).filter((line) => line.length >= 4 && line.length <= 160);
      return [...new Set(lines)].slice(0, limit);
    }
    function extractKnowledgeKeyValueLines(knowledgeText, limit = 12) {
      const lines = String(knowledgeText || "").replace(/\r/g, "").split("\n").map((line) => String(line || "").trim()).filter((line) => /[:=：]/.test(line)).map(normalizeKnowledgeLine).filter((line) => line.length >= 4 && line.length <= 200);
      return [...new Set(lines)].slice(0, limit);
    }
    function buildKnowledgePlanningSummary(knowledgeText, industry) {
      const text = String(knowledgeText || "").trim();
      const headlineLines = extractKnowledgeHeadlineLines(text);
      const keyValueLines = extractKnowledgeKeyValueLines(text);
      const keywords = extractKnowledgeKeywords(text);
      const conciseText = [.../* @__PURE__ */ new Set([...headlineLines, ...keyValueLines])].filter(Boolean).slice(0, 16).join("\n");
      const summary = conciseText ? `Knowledge summary captured ${Math.min(16, headlineLines.length + keyValueLines.length)} lines and ${keywords.length} keywords.` : "Knowledge summary is empty.";
      return {
        industry,
        headlineLines,
        keyValueLines,
        keywords,
        conciseText,
        summary
      };
    }
    function normalizeKnowledgePlanningSummary(summary, industry) {
      if (!summary || typeof summary !== "object") {
        return null;
      }
      const knowledgeSummary = summary.knowledgeSummary && typeof summary.knowledgeSummary === "object" ? {
        industry: summary.knowledgeSummary.industry || industry,
        headlineLines: Array.isArray(summary.knowledgeSummary.headlineLines) ? summary.knowledgeSummary.headlineLines : [],
        keyValueLines: Array.isArray(summary.knowledgeSummary.keyValueLines) ? summary.knowledgeSummary.keyValueLines : [],
        keywords: Array.isArray(summary.knowledgeSummary.keywords) ? summary.knowledgeSummary.keywords : [],
        conciseText: String(summary.knowledgeSummary.conciseText || ""),
        summary: String(summary.knowledgeSummary.summary || "")
      } : buildKnowledgePlanningSummary("", industry);
      const moduleHints = summary.moduleHints && typeof summary.moduleHints === "object" ? {
        matchedModules: Array.isArray(summary.moduleHints.matchedModules) ? summary.moduleHints.matchedModules : [],
        reasonsByModule: summary.moduleHints.reasonsByModule && typeof summary.moduleHints.reasonsByModule === "object" ? summary.moduleHints.reasonsByModule : {},
        explicitModules: Array.isArray(summary.moduleHints.explicitModules) ? summary.moduleHints.explicitModules : []
      } : { matchedModules: [], reasonsByModule: {}, explicitModules: [] };
      const tableHints = summary.tableHints && typeof summary.tableHints === "object" ? {
        explicitTables: Array.isArray(summary.tableHints.explicitTables) ? summary.tableHints.explicitTables : [],
        matchedTables: Array.isArray(summary.tableHints.matchedTables) ? summary.tableHints.matchedTables : []
      } : { explicitTables: [], matchedTables: [] };
      const conceptSource = summary.conceptPlan && typeof summary.conceptPlan === "object" ? summary.conceptPlan : buildEmptyConceptPlan(industry, "No structured business concepts extracted from cached knowledge summary.");
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
        summary: String(summary.summary || "")
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
      const explicitModules = extractKnowledgeLineValues(text, ["module", "modules", "\u4E1A\u52A1\u6A21\u5757", "\u6A21\u5757"]);
      const matched = /* @__PURE__ */ new Set();
      const reasonsByModule = /* @__PURE__ */ new Map();
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
        explicitModules
      };
    }
    function extractKnowledgeTableHints(knowledgeText, industry) {
      const text = String(knowledgeText || "");
      const haystack = normalizeText(text);
      const explicitTables = extractKnowledgeLineValues(text, ["focus", "tables", "table", "\u6838\u5FC3\u8868", "\u5173\u6CE8\u8868", "\u8868"]);
      const knownTables = /* @__PURE__ */ new Set();
      getIndustryDynamicModuleDefinitions(industry).forEach((definition) => {
        [...definition.focusTables || [], ...definition.expectedTables || []].forEach((tableName) => knownTables.add(tableName));
      });
      const matchedTables = /* @__PURE__ */ new Set();
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
        matchedTables: Array.from(matchedTables)
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
      const objectValues = extractKnowledgeLineValues(text, ["objects", "object", "\u4E1A\u52A1\u5BF9\u8C61", "\u5BF9\u8C61"]);
      const actionValues = extractKnowledgeLineValues(text, ["actions", "action", "\u4E1A\u52A1\u52A8\u4F5C", "\u52A8\u4F5C"]);
      const resultValues = extractKnowledgeLineValues(text, ["results", "result", "\u4E1A\u52A1\u7ED3\u679C", "\u7ED3\u679C"]);
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
        summary: summaryParts.length > 0 ? `Knowledge signals: ${summaryParts.join("; ")}.` : "No structured knowledge signals extracted."
      };
    }
    function getScenarioPlanningContext(input, industry) {
      const sceneConceptPlan = extractIndustryBusinessConcepts({
        sceneName: input.sceneName,
        sceneDesc: input.sceneDesc,
        knowledgeText: ""
      }, industry) || buildEmptyConceptPlan(industry);
      const knowledgeSignals = normalizeKnowledgePlanningSummary(input.knowledgePlanningSummary, industry) || extractKnowledgePlanningSignals(input.knowledgeText, industry);
      const conceptPlan = mergeConceptPlans(industry, sceneConceptPlan, knowledgeSignals.conceptPlan);
      return {
        sceneHaystack: normalizeText(`${input.sceneName} ${input.sceneDesc}`),
        knowledgeHaystack: normalizeText(`${input.knowledgeText}`),
        haystack: normalizeText(`${input.sceneName} ${input.sceneDesc} ${input.knowledgeText}`),
        sceneConceptPlan,
        knowledgeSignals,
        conceptPlan
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
        ...INDUSTRY_DYNAMIC_MODULE_METADATA[industry]?.[moduleKey] || {},
        ...INDUSTRY_DYNAMIC_MODULE_HINTS[industry]?.[moduleKey] || {},
        pattern: patternDef.pattern
      };
    }
    function getIndustryDynamicModuleDefinitions(industry) {
      return (INDUSTRY_DYNAMIC_MODULE_KEYWORDS[industry] || []).map((item) => getIndustryDynamicModuleDefinition(industry, item.moduleKey)).filter(Boolean);
    }
    function buildDynamicModuleCandidate(input, industry, moduleKey, selectedSet = /* @__PURE__ */ new Set(), planningContext = null) {
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
      const matched = directHit || matchedHints.length > 0 || matchedKeywords.length >= Number(definition.minHits || 2) || matchedTables.length > 0 || strongKnowledgeSignal || conceptOverlap.matched || selected;
      const score = (directHit ? 6 : 0) + Math.min(4, matchedHints.length) + Math.min(4, matchedKeywords.length) + Math.min(4, matchedTables.length * 2) + Math.min(4, strongKnowledgeModuleReasons.length * 2) + Math.min(4, knowledgeTables.length) + conceptOverlap.score + (selected ? 2 : 0);
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
          score: conceptOverlap.score
        },
        knowledgeOverlap: {
          moduleReasons: strongKnowledgeModuleReasons,
          tables: knowledgeTables
        }
      };
    }
    function collectRequestedModules(input, industry) {
      const planningContext = getScenarioPlanningContext(input, industry);
      return getIndustryDynamicModuleDefinitions(industry).map((item) => buildDynamicModuleCandidate(input, industry, item.moduleKey, /* @__PURE__ */ new Set(), planningContext)).filter((item) => item && item.matched).sort((left, right) => right.score - left.score).map((item) => item.moduleKey);
    }
    function buildScenarioModulePlan(input, profile) {
      const moduleIndustry = profile?.referenceIndustry || profile?.industry;
      if (!moduleIndustry || moduleIndustry === "generic") {
        return null;
      }
      const selectedSet = new Set(Array.isArray(profile.requestedModules) ? profile.requestedModules.filter(Boolean) : []);
      const planningContext = getScenarioPlanningContext(input, moduleIndustry);
      const candidates = getIndustryDynamicModuleDefinitions(moduleIndustry).map((item) => buildDynamicModuleCandidate(input, moduleIndustry, item.moduleKey, selectedSet, planningContext)).concat(
        (Array.isArray(profile?.referenceModulePlanner?.modules) ? profile.referenceModulePlanner.modules : Array.isArray(profile?.modulePlanner?.modules) ? profile.modulePlanner.modules : []).map((item) => {
          const sceneText = `${input?.sceneName || ""} ${input?.sceneDesc || ""} ${input?.knowledgeText || ""}`.toLowerCase();
          const moduleKey = String(item?.moduleKey || item?.moduleLabel || item?.summary || "").trim();
          const moduleLabel = String(item?.moduleLabel || item?.moduleKey || "").trim();
          if (!moduleKey) return null;
          const matchTokens = [
            moduleKey,
            moduleLabel,
            ...Array.isArray(item?.hints) ? item.hints : []
          ].map((token) => String(token || "").trim()).filter(Boolean);
          const matchedTokens = matchTokens.filter((token) => sceneText.includes(String(token).toLowerCase()));
          const score = matchedTokens.length > 0 ? 0.55 + Math.min(0.35, matchedTokens.length * 0.08) : 0;
          return {
            moduleKey,
            moduleName: moduleLabel || moduleKey,
            moduleLabel: moduleLabel || moduleKey,
            summary: item?.summary || `${moduleLabel || moduleKey} \u6A21\u5757`,
            focusTables: Array.isArray(item?.focusTables) ? item.focusTables : [],
            expectedTables: Array.isArray(item?.expectedTables) ? item.expectedTables : [],
            score,
            reasons: matchedTokens.map((token) => `managed-module=${token}`),
            selected: matchedTokens.length > 0,
            conceptOverlap: matchedTokens,
            knowledgeOverlap: matchedTokens,
            matched: matchedTokens.length > 0,
            source: "managed_profile"
          };
        }).filter(Boolean)
      ).filter(Boolean).sort((left, right) => {
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
      const summary = matchedModules.length > 0 ? `Dynamic planner selected ${matchedModules.map((item) => item.moduleKey).join(", ")}.` : "Dynamic planner did not select any registered extension module.";
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
          knowledgeOverlap: item.knowledgeOverlap
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
          knowledgeOverlap: item.knowledgeOverlap
        })),
        requestedModules: matchedModules.map((item) => item.moduleKey),
        summary: `${summary}${planningContext.knowledgeSignals?.summary ? ` ${planningContext.knowledgeSignals.summary}` : ""}${planningContext.conceptPlan?.summary ? ` ${planningContext.conceptPlan.summary}` : ""}`
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
      hints.filter((item) => item !== null && item !== void 0).forEach((item) => {
        const matched = collectRequestedModules({
          sceneName: Array.isArray(item) ? item.join(" ") : String(item),
          sceneDesc: "",
          knowledgeText: ""
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
        orderStatuses: ORDER_STATUS_OPTIONS
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
        inspectionResults: TRAFFIC_INSPECTION_RESULTS
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
        issueLevels: BANK_ISSUE_LEVELS
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
        fundCompanies: FUND_COMPANY_NAMES
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
        exceptionTypes: LOGISTICS_EXCEPTION_TYPES
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
        cities: CITY_OPTIONS
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
        weight: Number(weightConfig[item.code] ?? item.weight ?? 1)
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
      return dictionaries.filter((item) => item && item.status !== "inactive" && item.dictType === dictType).map((item) => ({
        code: item.itemCode,
        label: item.itemLabel,
        weight: Number(item.weight || 1),
        ...item.itemValue || {}
      }));
    }
    function getDictionaryOptions(profile, dictType, fallbackItems = []) {
      const managedItems = getProfileDictionaryItems(profile, dictType);
      return managedItems.length > 0 ? managedItems : fallbackItems;
    }
    function pickProfileDictionaryItem(profile, dictType, random, fallbackItems = []) {
      return pickWeighted(getDictionaryOptions(profile, dictType, fallbackItems), random) || pickOne(getDictionaryOptions(profile, dictType, fallbackItems), random) || null;
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
      return new Date(new Date(value).getTime() + minutes * 60 * 1e3);
    }
    function formatPeriod(date, frequency) {
      const current = new Date(date);
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const quarter = Math.floor(current.getMonth() / 3) + 1;
      if (frequency === "\u5B63\u62A5") {
        return `${current.getFullYear()}Q${quarter}`;
      }
      if (frequency === "\u534A\u5E74\u62A5") {
        return `${current.getFullYear()}H${quarter <= 2 ? 1 : 2}`;
      }
      if (frequency === "\u5E74\u62A5") {
        return `${current.getFullYear()}`;
      }
      if (frequency === "\u65E5\u62A5") {
        return `${current.getFullYear()}-${month}-${String(current.getDate()).padStart(2, "0")}`;
      }
      return `${current.getFullYear()}-${month}`;
    }
    function formatDateTime(value) {
      return new Date(value).toISOString().slice(0, 19).replace("T", " ");
    }
    function getRuntimeBaseTime(runtime) {
      const baseTime = runtime?.baseTime instanceof Date ? runtime.baseTime : /* @__PURE__ */ new Date();
      return Number.isNaN(baseTime.getTime()) ? /* @__PURE__ */ new Date() : baseTime;
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
      let sequence = 100 + Number(serial || 0) % 899;
      if (gender === "M" && sequence % 2 === 0) sequence += 1;
      if (gender === "F" && sequence % 2 === 1) sequence += 1;
      if (sequence > 999) sequence -= 2;
      const prefix17 = `${region}${year}${month}${day}${padNumber(sequence, 3)}`;
      return `${prefix17}${calculateIdCardChecksum(prefix17)}`;
    }
    function buildMainlandMobile(serial, random, preferredPrefixes = null) {
      const prefixPool = Array.isArray(preferredPrefixes) && preferredPrefixes.length > 0 ? preferredPrefixes : MAINLAND_MOBILE_PREFIXES;
      const prefix = pickOne(prefixPool, random) || "138";
      const suffix = padNumber(Number(serial || 0) * 7919 % 1e8, 8);
      return `${prefix}${suffix}`;
    }
    function buildDomesticEmail(serial, random, prefix = "user") {
      const normalizedPrefix = String(prefix || "user").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "user";
      const account = `${normalizedPrefix}${padNumber(Number(serial || 0) * 97 % 1e6, 6)}`;
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
          nextProfile.preferredCategories = Array.isArray(config.preferredCategories) && config.preferredCategories.length > 0 ? config.preferredCategories : subtypeOverride.preferredCategories;
          nextProfile.categoryWeights = {
            ...subtypeOverride.categoryWeights || {},
            ...config.categoryWeights || {}
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
      const baseProfile = recognition.industry === "education" ? buildEducationProfile(input, recognition) : recognition.industry === "ecommerce" ? buildEcommerceProfile(input, recognition) : recognition.industry === "traffic" ? buildTrafficProfile(input, recognition) : recognition.industry === "bank_regulatory" ? { ...buildBankProfile(recognition), requestedModules: collectRequestedModules(input, "bank_regulatory") } : recognition.industry === "finance_fund" ? buildFinanceFundProfile(recognition) : recognition.industry === "logistics_express" ? buildLogisticsExpressProfile(recognition) : {
        ...recognition,
        locale: "zh-CN",
        businessStyle: recognition.industry,
        cities: CITY_OPTIONS
      };
      const mergedProfile = mergeManagedScenarioProfile(baseProfile, input.managedProfiles || [], input.boundProfileId, input);
      const effectiveIndustry = mergedProfile.referenceIndustry || mergedProfile.industry;
      if ((!Array.isArray(mergedProfile.requestedModules) || mergedProfile.requestedModules.length === 0) && effectiveIndustry && effectiveIndustry !== "generic") {
        mergedProfile.requestedModules = collectRequestedModules(input, effectiveIndustry);
      }
      const profileAfterPlugins = effectiveIndustry === "education" ? applyEducationPluginBindings(mergedProfile) : effectiveIndustry === "ecommerce" ? applyEcommercePluginBindings(mergedProfile) : effectiveIndustry === "traffic" ? applyTrafficPluginBindings(mergedProfile) : effectiveIndustry === "bank_regulatory" ? applyBankPluginBindings(mergedProfile) : mergedProfile;
      return finalizeScenarioProfile(input, profileAfterPlugins);
    }
    function collectManagedProfileReferenceTokens(managed) {
      const tokens = [
        managed?.industry,
        managed?.subScenario,
        managed?.profileName,
        managed?.profileDesc,
        ...Array.isArray(managed?.pluginBindings) ? managed.pluginBindings.flatMap((item) => {
          const config = item?.bindingConfig && typeof item.bindingConfig === "object" ? item.bindingConfig : {};
          return [
            item?.pluginName,
            ...Array.isArray(config.businessModules) ? config.businessModules : [],
            ...Array.isArray(config.focusModules) ? config.focusModules : []
          ];
        }) : [],
        ...Array.isArray(managed?.modulePlanner?.modules) ? managed.modulePlanner.modules.flatMap((item) => [
          item?.moduleLabel,
          item?.summary,
          ...Array.isArray(item?.hints) ? item.hints : []
        ]) : [],
        ...Array.isArray(managed?.modulePlanner?.categories) ? managed.modulePlanner.categories.flatMap((item) => [
          item?.categoryName,
          item?.description,
          ...Array.isArray(item?.tableScopes) ? item.tableScopes : []
        ]) : [],
        ...Array.isArray(managed?.researchCatalog?.businessObjects) ? managed.researchCatalog.businessObjects : [],
        ...Array.isArray(managed?.researchCatalog?.businessActions) ? managed.researchCatalog.businessActions : [],
        ...Array.isArray(managed?.researchCatalog?.businessResults) ? managed.researchCatalog.businessResults : [],
        ...Array.isArray(managed?.researchCatalog?.categoryTree) ? managed.researchCatalog.categoryTree.flatMap((item) => [
          item?.categoryName,
          ...Array.isArray(item?.tableScopes) ? item.tableScopes : []
        ]) : [],
        ...Array.isArray(managed?.researchCatalog?.candidateTables) ? managed.researchCatalog.candidateTables : [],
        ...Array.isArray(managed?.researchCatalog?.dictSuggestions) ? managed.researchCatalog.dictSuggestions : []
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
      const score = matchedTokens.length + (detectedIndustry && detectedIndustry !== "generic" && detectedIndustry === managedIndustry ? 2 : 0);
      if (detectedIndustry === "generic" && managedIndustry) {
        return {
          compatible: matchedTokens.length > 0,
          score: Math.max(matchedTokens.length, score),
          reasons: matchedTokens.map((token) => `scene-match:${token}`).slice(0, 8),
          matchedTokens: matchedTokens.slice(0, 12)
        };
      }
      const compatible = score >= 2 || matchedTokens.some((token) => normalizeText(token).length >= 4);
      return {
        compatible,
        score,
        reasons: matchedTokens.map((token) => `scene-match:${token}`).slice(0, 8),
        matchedTokens: matchedTokens.slice(0, 12)
      };
    }
    function mergeManagedScenarioProfile(baseProfile, managedProfiles, boundProfileId, input = {}) {
      if (!Array.isArray(managedProfiles) || managedProfiles.length === 0 || !boundProfileId) {
        return baseProfile;
      }
      const boundManaged = boundProfileId ? managedProfiles.find((item) => item && item.status === "active" && Number(item.id) === Number(boundProfileId)) : null;
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
          managedProfileReasons: compatibility.reasons
        };
      }
      const dictionaries = Array.isArray(managed.dictionaries) ? managed.dictionaries : [];
      const byType = (dictType) => dictionaries.filter((item) => item && item.status !== "inactive" && item.dictType === dictType);
      const plannerModules = Array.isArray(managed?.modulePlanner?.modules) ? managed.modulePlanner.modules : Array.isArray(managed?.modulePlanner?.categories) ? managed.modulePlanner.categories.map((item) => ({
        moduleKey: item?.categoryCode || item?.categoryName,
        moduleLabel: item?.categoryName || item?.categoryCode,
        summary: item?.description || managed?.modulePlanner?.summary || "",
        focusTables: Array.isArray(item?.tableScopes) ? item.tableScopes : [],
        expectedTables: Array.isArray(item?.tableScopes) ? item.tableScopes : [],
        hints: Array.isArray(item?.sourceRefs) ? item.sourceRefs : []
      })) : [];
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
        extendedRules: []
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
          stateEffects: item.stateEffects && typeof item.stateEffects === "object" ? item.stateEffects : {}
        },
        sortOrder: Number(item.sortOrder || index),
        status: item.status || "active"
      }));
      if (profile.industry === "ecommerce") {
        const subtypeOverride = ECOMMERCE_SUBTYPE_OVERRIDES[profile.subScenario || profile.subtype || "general"] || ECOMMERCE_SUBTYPE_OVERRIDES.general;
        profile.paymentChannels = Array.isArray(profile.paymentChannels) && profile.paymentChannels.length > 0 ? profile.paymentChannels : PAYMENT_CHANNELS;
        profile.orderStatuses = Array.isArray(profile.orderStatuses) && profile.orderStatuses.length > 0 ? profile.orderStatuses : ORDER_STATUS_OPTIONS;
        profile.preferredCategories = Array.isArray(profile.preferredCategories) && profile.preferredCategories.length > 0 ? profile.preferredCategories : subtypeOverride.preferredCategories;
        profile.categoryWeights = {
          ...subtypeOverride.categoryWeights || {},
          ...profile.categoryWeights || {}
        };
      }
      const managedCities = byType("city").map((item) => ({
        code: item.itemCode,
        name: item.itemLabel,
        districts: Array.isArray(item.itemValue?.districts) ? item.itemValue.districts : []
      }));
      if (managedCities.length > 0) {
        profile.cities = managedCities;
      }
      const managedPaymentChannels = byType("payment_channel").map((item) => ({
        code: item.itemCode,
        label: item.itemLabel,
        weight: Number(item.weight || 1)
      }));
      if (managedPaymentChannels.length > 0) {
        profile.paymentChannels = managedPaymentChannels;
      }
      const managedOrderStatuses = byType("order_status").map((item) => ({
        code: item.itemCode,
        label: item.itemLabel,
        weight: Number(item.weight || 1)
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
      const vehicleTypes = byType("vehicle_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (vehicleTypes.length > 0) profile.vehicleTypes = vehicleTypes;
      const violationCodes = byType("violation_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
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
      const reportCodes = byType("report_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (reportCodes.length > 0) profile.reportCodes = reportCodes;
      const reportStatuses = byType("report_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
      if (reportStatuses.length > 0) profile.reportStatuses = reportStatuses;
      const issueTypes = byType("issue_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
      if (issueTypes.length > 0) profile.issueTypes = issueTypes;
      const issueLevels = byType("issue_level").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1) }));
      if (issueLevels.length > 0) profile.issueLevels = issueLevels;
      const schoolTypes = byType("school_type").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (schoolTypes.length > 0) profile.schoolTypes = schoolTypes;
      const educationStages = byType("education_stage").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (educationStages.length > 0) profile.educationStages = educationStages;
      const gradeCodes = byType("grade_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (gradeCodes.length > 0) profile.gradeCodes = gradeCodes;
      const termCodes = byType("term_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (termCodes.length > 0) profile.termCodes = termCodes;
      const subjectCodes = byType("subject_code").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (subjectCodes.length > 0) profile.subjectCodes = subjectCodes;
      const staffRoles = byType("staff_role").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (staffRoles.length > 0) profile.staffRoles = staffRoles;
      const billStatuses = byType("bill_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (billStatuses.length > 0) profile.billStatuses = billStatuses;
      const accessResults = byType("access_result").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
      if (accessResults.length > 0) profile.accessResults = accessResults;
      const borrowStatuses = byType("borrow_status").map((item) => ({ code: item.itemCode, label: item.itemLabel, weight: Number(item.weight || 1), ...item.itemValue || {} }));
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
        ...Array.isArray(profile.codeRules) ? profile.codeRules : [],
        ...mergedExtendedRules.filter((item) => item.ruleCategory === "code")
      ];
      profile.extendedRules = mergedExtendedRules;
      return profile;
    }
    function pickEcommerceProductVariant(catalog, random) {
      const product = pickOne(catalog.products, random) || {
        brand: pickOne(catalog.brands || [], random) || "",
        series: pickOne(catalog.series || [], random) || "",
        storage: catalog.storage || [""],
        colors: catalog.colors || [""]
      };
      const brand = product.brand;
      const series = product.series;
      const storage = pickOne(product.storage || catalog.storage || [""], random) || "";
      const color = pickOne(product.colors || catalog.colors || [""], random) || "";
      const title = catalog.titlePattern.replace("{brand}", brand).replace("{series}", series).replace("{storage}", storage).replace("{color}", color).replace(/\s+/g, " ").trim();
      return { title, brand, series, storage, color };
    }
    function createScenarioRuntime(profile, sceneCode, baseTime = /* @__PURE__ */ new Date()) {
      const state = {
        profile,
        sceneCode,
        baseTime: baseTime instanceof Date ? baseTime : new Date(baseTime),
        productFacts: /* @__PURE__ */ new Map(),
        customerFacts: /* @__PURE__ */ new Map(),
        addressFacts: /* @__PURE__ */ new Map(),
        storeFacts: /* @__PURE__ */ new Map(),
        spuFacts: /* @__PURE__ */ new Map(),
        skuFacts: /* @__PURE__ */ new Map(),
        inventoryFacts: /* @__PURE__ */ new Map(),
        orderFacts: /* @__PURE__ */ new Map(),
        itemFacts: /* @__PURE__ */ new Map(),
        paymentFacts: /* @__PURE__ */ new Map(),
        refundFacts: /* @__PURE__ */ new Map(),
        deliveryFacts: /* @__PURE__ */ new Map(),
        liveStreamFacts: /* @__PURE__ */ new Map(),
        procurementFacts: /* @__PURE__ */ new Map(),
        ownerFacts: /* @__PURE__ */ new Map(),
        vehicleFacts: /* @__PURE__ */ new Map(),
        registrationFacts: /* @__PURE__ */ new Map(),
        violationFacts: /* @__PURE__ */ new Map(),
        penaltyFacts: /* @__PURE__ */ new Map(),
        inspectionFacts: /* @__PURE__ */ new Map(),
        accidentFacts: /* @__PURE__ */ new Map(),
        dispatchFacts: /* @__PURE__ */ new Map(),
        patrolFacts: /* @__PURE__ */ new Map(),
        documentFacts: /* @__PURE__ */ new Map(),
        driverTrainingFacts: /* @__PURE__ */ new Map(),
        checkpointPassFacts: /* @__PURE__ */ new Map(),
        institutionFacts: /* @__PURE__ */ new Map(),
        branchFacts: /* @__PURE__ */ new Map(),
        contactFacts: /* @__PURE__ */ new Map(),
        reportFacts: /* @__PURE__ */ new Map(),
        customerAccountFacts: /* @__PURE__ */ new Map(),
        loanContractFacts: /* @__PURE__ */ new Map(),
        metricFacts: /* @__PURE__ */ new Map(),
        riskFacts: /* @__PURE__ */ new Map(),
        alertFacts: /* @__PURE__ */ new Map(),
        issueFacts: /* @__PURE__ */ new Map(),
        taskFacts: /* @__PURE__ */ new Map(),
        submissionFacts: /* @__PURE__ */ new Map(),
        approvalFacts: /* @__PURE__ */ new Map(),
        campusFacts: /* @__PURE__ */ new Map(),
        studentFacts: /* @__PURE__ */ new Map(),
        guardianFacts: /* @__PURE__ */ new Map(),
        staffFacts: /* @__PURE__ */ new Map(),
        courseFacts: /* @__PURE__ */ new Map(),
        scheduleFacts: /* @__PURE__ */ new Map(),
        enrollmentFacts: /* @__PURE__ */ new Map(),
        tuitionFacts: /* @__PURE__ */ new Map(),
        accessFacts: /* @__PURE__ */ new Map(),
        libraryFacts: /* @__PURE__ */ new Map(),
        parentCommunicationFacts: /* @__PURE__ */ new Map(),
        dormitoryResidentFacts: /* @__PURE__ */ new Map(),
        fundProductFacts: /* @__PURE__ */ new Map(),
        fundAccountFacts: /* @__PURE__ */ new Map(),
        fundSubscriptionFacts: /* @__PURE__ */ new Map(),
        fundRedemptionFacts: /* @__PURE__ */ new Map(),
        fundNavFacts: /* @__PURE__ */ new Map(),
        fundTradeFacts: /* @__PURE__ */ new Map(),
        logisticsWaybillFacts: /* @__PURE__ */ new Map(),
        logisticsPackageFacts: /* @__PURE__ */ new Map(),
        logisticsRouteFacts: /* @__PURE__ */ new Map(),
        logisticsTransferFacts: /* @__PURE__ */ new Map(),
        logisticsSignFacts: /* @__PURE__ */ new Map(),
        logisticsExceptionFacts: /* @__PURE__ */ new Map()
      };
      return state;
    }
    function buildCustomerFact(serial, random, profile) {
      const city = pickOne(profile.cities, random) || profile.cities[0];
      const familyName = pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5F20";
      const givenName = `${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u60A6"}`;
      const customerName = `${familyName}${givenName}`;
      const memberLevel = pickProfileCode(profile, "member_level", random, ECOMMERCE_MEMBER_LEVELS, "\u666E\u901A\u4F1A\u5458");
      const registerChannel = pickProfileCode(profile, "register_channel", random, ECOMMERCE_REGISTER_CHANNELS, "APP");
      const riskLevel = pickProfileCode(profile, "risk_level", random, ECOMMERCE_RISK_LEVELS, "\u4F4E\u98CE\u9669");
      const preferredCategory = pickOne(profile.preferredCategories || [], random) || "ELECTRONIC";
      const registerTime = new Date(Date.now() - serial * 17 * 24 * 60 * 60 * 1e3);
      const lastLoginTime = shiftTime(registerTime, randomIntBetween(3 * 24 * 60, 180 * 24 * 60, random));
      const lastOrderTime = shiftTime(lastLoginTime, randomIntBetween(60, 45 * 24 * 60, random));
      return {
        id: serial,
        customerName,
        customerCode: `CUST${String(1e5 + serial).slice(-6)}`,
        gender: serial % 2 === 0 ? "\u5973" : "\u7537",
        mobile: buildMainlandMobile(serial, random),
        email: buildDomesticEmail(serial, random, "buyer"),
        memberLevel,
        registerChannel,
        riskLevel,
        loyaltyScore: randomIntBetween(380, 980, random),
        totalOrderCount: randomIntBetween(1, 48, random),
        totalOrderAmount: randomNumberBetween(399, 158e3, random),
        registerTime,
        lastLoginTime,
        lastOrderTime,
        preferredCategory,
        provinceCode: city.code,
        provinceName: city.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: `${city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
        districtName: pickOne(city.districts, random) || city.name
      };
    }
    function buildAddressFact(serial, random, runtime) {
      const customer = pickFactByIndex(runtime.customerFacts, serial - 1);
      const city = runtime.profile.cities.find((item) => item.code === customer?.cityCode) || pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
      const addressTag = pickProfileCode(runtime.profile, "address_tag", random, [
        { code: "\u5BB6", label: "\u5BB6", weight: 54 },
        { code: "\u516C\u53F8", label: "\u516C\u53F8", weight: 28 },
        { code: "\u5B66\u6821", label: "\u5B66\u6821", weight: 8 },
        { code: "\u7236\u6BCD\u5BB6", label: "\u7236\u6BCD\u5BB6", weight: 10 }
      ], "\u5BB6");
      return {
        id: serial,
        customer,
        consigneeName: customer?.customerName || `\u6536\u8D27\u4EBA${serial}`,
        consigneeMobile: customer?.mobile || buildMainlandMobile(1e4 + serial, random),
        provinceCode: city.code,
        provinceName: city.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: `${city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
        districtName: pickOne(city.districts, random) || city.name,
        streetName: pickOne(["\u79D1\u6280\u8DEF", "\u5546\u57CE\u8DEF", "\u4EBA\u6C11\u8DEF", "\u9752\u5E74\u8DEF", "\u6EE8\u6C5F\u5927\u9053"], random) || "\u79D1\u6280\u8DEF",
        addressDetail: `${pickOne(["\u661F\u6CB3\u82D1", "\u91D1\u57DF\u534E\u5EAD", "\u4E07\u79D1\u5E7F\u573A", "\u5929\u8857\u516C\u5BD3", "\u4E91\u6816\u82B1\u56ED"], random) || "\u661F\u6CB3\u82D1"}${serial % 18 + 1}\u5E62${serial % 4 + 1}\u5355\u5143${serial % 240 + 101}\u5BA4`,
        postalCode: buildPostalCode(city.code, serial),
        addressTag,
        isDefault: serial % 3 === 0 ? 0 : 1,
        longitude: randomNumberBetween(120.95, 121.78, random, 6),
        latitude: randomNumberBetween(30.92, 31.58, random, 6),
        deliveryInstructions: pickOne(["\u5DE5\u4F5C\u65E5\u767D\u5929\u9001\u8FBE", "\u8BF7\u653E\u524D\u53F0", "\u8054\u7CFB\u672C\u4EBA\u7B7E\u6536", "\u665A\u95F4\u914D\u9001\u4F18\u5148"], random) || "\u8054\u7CFB\u672C\u4EBA\u7B7E\u6536"
      };
    }
    function buildStoreFact(serial, random, profile) {
      const city = pickOne(profile.cities, random) || profile.cities[0];
      const storeType = pickProfileCode(profile, "store_type", random, ECOMMERCE_STORE_TYPES, "\u57CE\u5E02\u4ED3");
      const merchantName = pickProfileCode(profile, "merchant_name", random, [
        { code: "\u6570\u667A\u96F6\u552E", label: "\u6570\u667A\u96F6\u552E", weight: 28 },
        { code: "\u661F\u4E91\u5546\u8D38", label: "\u661F\u4E91\u5546\u8D38", weight: 22 },
        { code: "\u65B0\u9510\u7535\u5668", label: "\u65B0\u9510\u7535\u5668", weight: 20 },
        { code: "\u4F18\u9009\u751F\u6D3B", label: "\u4F18\u9009\u751F\u6D3B", weight: 18 },
        { code: "\u60A6\u4EAB\u4F9B\u5E94\u94FE", label: "\u60A6\u4EAB\u4F9B\u5E94\u94FE", weight: 12 }
      ], "\u6570\u667A\u96F6\u552E");
      const warehouseCode = `WH${city.code.slice(-2)}${String(200 + serial).slice(-3)}`;
      return {
        id: serial,
        storeCode: `STORE${String(1e5 + serial).slice(-6)}`,
        storeName: `${city.name}${pickOne(["\u4E2D\u5FC3\u4ED3", "\u57CE\u5E02\u4ED3", "\u524D\u7F6E\u4ED3", "\u65D7\u8230\u5E97", "\u4F53\u9A8C\u5E97"], random) || "\u4E2D\u5FC3\u4ED3"}${serial % 9 + 1}\u53F7`,
        merchantName,
        storeType,
        provinceCode: city.code,
        provinceName: city.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: `${city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
        districtName: pickOne(city.districts, random) || city.name,
        streetName: pickOne(["\u56ED\u533A\u8DEF", "\u5546\u4E1A\u8857", "\u521B\u65B0\u5927\u9053", "\u7269\u6D41\u5927\u9053", "\u80DC\u5229\u8DEF"], random) || "\u56ED\u533A\u8DEF",
        addressDetail: `${pickOne(["\u667A\u6167\u4ED3\u914D\u56ED", "\u4F9B\u5E94\u94FE\u4E2D\u5FC3", "\u76F4\u8425\u5E7F\u573A", "\u6570\u667A\u4EA7\u4E1A\u56ED"], random) || "\u667A\u6167\u4ED3\u914D\u56ED"}${serial % 12 + 1}\u680B`,
        contactName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738B"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B81"}`,
        contactMobile: buildMainlandMobile(2e4 + serial, random),
        contactEmail: buildDomesticEmail(serial, random, "store"),
        warehouseCode,
        dailyOrderCapacity: randomIntBetween(300, 2800, random),
        averageDispatchMinutes: randomIntBetween(18, 160, random),
        deliveryScope: pickOne(["\u540C\u57CE", "\u5168\u7701", "\u534E\u4E1C", "\u5168\u56FD"], random) || "\u540C\u57CE",
        ratingScore: randomNumberBetween(4.3, 4.98, random)
      };
    }
    function buildProductFact(serial, random, profile) {
      const preferred = ECOMMERCE_CATEGORIES.filter((item) => profile.preferredCategories.includes(item.code));
      const candidateCatalogs = preferred.length > 0 ? preferred : ECOMMERCE_CATEGORIES;
      const weightedCatalogs = candidateCatalogs.map((item) => ({
        ...item,
        weight: Number(profile.categoryWeights?.[item.code] ?? item.weight ?? 1)
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
      const productType = pickProfileCode(profile, "product_type", random, ECOMMERCE_PRODUCT_TYPES, "\u6807\u54C1");
      const shelfStatus = pickProfileCode(profile, "shelf_status", random, ECOMMERCE_SHELF_STATUS, "\u5728\u552E");
      const supplier = pickProfileDictionaryItem(profile, "supplier_name", random, [
        { code: "SUP001", label: "\u534E\u4E1C\u4F9B\u5E94\u94FE\u4E2D\u5FC3", weight: 28 },
        { code: "SUP002", label: "\u534E\u5357\u54C1\u724C\u76F4\u4F9B", weight: 22 },
        { code: "SUP003", label: "\u5168\u56FD\u4ED3\u914D\u8054\u76DF", weight: 20 },
        { code: "SUP004", label: "\u5B98\u65B9\u76F4\u8425\u91C7\u8D2D", weight: 18 },
        { code: "SUP005", label: "\u533A\u57DF\u4F18\u9009\u670D\u52A1\u5546", weight: 12 }
      ]) || { code: "SUP001", label: "\u534E\u4E1C\u4F9B\u5E94\u94FE\u4E2D\u5FC3" };
      const originCountry = pickProfileCode(profile, "origin_country", random, [
        { code: "\u4E2D\u56FD", label: "\u4E2D\u56FD", weight: 64 },
        { code: "\u8D8A\u5357", label: "\u8D8A\u5357", weight: 10 },
        { code: "\u6CF0\u56FD", label: "\u6CF0\u56FD", weight: 8 },
        { code: "\u65E5\u672C", label: "\u65E5\u672C", weight: 8 },
        { code: "\u5FB7\u56FD", label: "\u5FB7\u56FD", weight: 10 }
      ], "\u4E2D\u56FD");
      const variant = pickEcommerceProductVariant(catalog, random);
      return {
        id: serial,
        categoryCode: catalog.code,
        categoryLabel: catalog.label,
        subCategoryCode: `${catalog.code}_${String(serial % 6 + 1).padStart(2, "0")}`,
        subCategoryName: `${catalog.label}${pickOne(["\u6838\u5FC3\u6B3E", "\u5347\u7EA7\u6B3E", "\u7CBE\u54C1\u6B3E", "\u65D7\u8230\u6B3E"], random) || "\u6838\u5FC3\u6B3E"}`,
        productName: variant.title,
        brandName: variant.brand || catalog.label,
        productLine: pickProfileCode(profile, "product_line", random, [
          { code: "\u6807\u51C6\u7EBF", label: "\u6807\u51C6\u7EBF", weight: 44 },
          { code: "\u9AD8\u7AEF\u7EBF", label: "\u9AD8\u7AEF\u7EBF", weight: 24 },
          { code: "\u7206\u6B3E\u7EBF", label: "\u7206\u6B3E\u7EBF", weight: 20 },
          { code: "\u4F01\u4E1A\u91C7\u8D2D\u7EBF", label: "\u4F01\u4E1A\u91C7\u8D2D\u7EBF", weight: 12 }
        ], "\u6807\u51C6\u7EBF"),
        productType,
        marketPrice,
        salePrice,
        costPrice,
        taxRate: randomNumberBetween(6, 13, random),
        unitName: pickProfileCode(profile, "unit_name", random, [
          { code: "\u4EF6", label: "\u4EF6", weight: 70 },
          { code: "\u53F0", label: "\u53F0", weight: 20 },
          { code: "\u5957", label: "\u5957", weight: 10 }
        ], "\u4EF6"),
        originCountry,
        supplierName: supplier.label,
        supplierCode: supplier.code,
        modelNo: `MDL-${String(1e4 + serial).slice(-5)}`,
        shelfStatus,
        launchDate: new Date(Date.now() - randomIntBetween(20, 520, random) * 24 * 60 * 60 * 1e3),
        discontinueDate: shelfStatus === "\u505C\u552E" ? new Date(Date.now() + randomIntBetween(10, 80, random) * 24 * 60 * 60 * 1e3) : new Date(Date.now() + randomIntBetween(180, 960, random) * 24 * 60 * 60 * 1e3),
        stockQty
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
      const orderStatus = pickWeighted(weightedStatuses, random)?.code || "\u5DF2\u652F\u4ED8";
      const orderChannel = pickProfileCode(runtime.profile, "order_channel", random, ECOMMERCE_ORDER_CHANNELS, "APP");
      const orderSource = pickProfileCode(runtime.profile, "order_source", random, ECOMMERCE_ORDER_SOURCES, "\u641C\u7D22");
      const invoiceStatus = pickProfileCode(runtime.profile, "invoice_status", random, ECOMMERCE_INVOICE_STATUS, "\u65E0\u9700\u5F00\u7968");
      const paymentStatus = ["\u5F85\u652F\u4ED8", "\u5DF2\u5173\u95ED"].includes(orderStatus) ? "\u5F85\u652F\u4ED8" : orderStatus === "\u9000\u6B3E\u6210\u529F" ? "\u5DF2\u9000\u6B3E" : "\u652F\u4ED8\u6210\u529F";
      const deliveryStatus = ["\u5F85\u652F\u4ED8", "\u5DF2\u5173\u95ED"].includes(orderStatus) ? "\u5F85\u51FA\u5E93" : ["\u9000\u6B3E\u6210\u529F", "\u9000\u6B3E\u4E2D"].includes(orderStatus) ? "\u914D\u9001\u5F02\u5E38" : orderStatus === "\u5DF2\u5B8C\u6210" ? "\u5DF2\u7B7E\u6536" : orderStatus === "\u5DF2\u53D1\u8D27" ? "\u8FD0\u8F93\u4E2D" : "\u5DF2\u51FA\u5E93";
      const orderTime = new Date(startedAt.getTime() - serial * 37 * 60 * 1e3);
      const unitPrice = sku?.salePrice || 199;
      const grossAmount = Number((unitPrice * quantity).toFixed(2));
      const discountAmount = Number((grossAmount * randomNumberBetween(0.02, 0.16, random, 4)).toFixed(2));
      const freightAmount = grossAmount >= 299 ? 0 : randomNumberBetween(6, 18, random);
      const couponAmount = discountAmount > 0 ? Number((discountAmount * randomNumberBetween(0.2, 0.65, random, 4)).toFixed(2)) : 0;
      const pointsDeductionAmount = Number(Math.min(60, grossAmount * 0.02).toFixed(2));
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
        consigneeName: address?.consigneeName || customer?.customerName || `\u6536\u8D27\u4EBA${serial}`,
        consigneeMobile: address?.consigneeMobile || customer?.mobile || buildMainlandMobile(3e4 + serial, random),
        addressSnapshot: `${address?.provinceName || ""}${address?.cityName || ""}${address?.districtName || ""}${address?.streetName || ""}${address?.addressDetail || ""}`,
        provinceCode: address?.provinceCode || customer?.provinceCode || "310000",
        cityCode: address?.cityCode || customer?.cityCode || "310000",
        itemQuantity: quantity,
        sku
      };
    }
    function buildPaymentFact(serial, random, runtime) {
      const order = pickFactByIndex(runtime.orderFacts, serial - 1);
      const weightedChannels = applyWeightOverride(runtime.profile.paymentChannels, getDistributionRuleConfig(runtime.profile, "payment_channel_ratio"));
      const channel = pickWeighted(weightedChannels, random)?.code || "\u5FAE\u4FE1\u652F\u4ED8";
      const payTime = shiftTime(order?.orderTime || /* @__PURE__ */ new Date(), randomIntBetween(5, 120, random));
      const payStatus = order?.paymentStatus || (["\u5F85\u652F\u4ED8", "\u5DF2\u5173\u95ED"].includes(order?.orderStatus) ? "\u5F85\u652F\u4ED8" : "\u652F\u4ED8\u6210\u529F");
      const refundStatus = ["\u9000\u6B3E\u6210\u529F", "\u9000\u6B3E\u4E2D"].includes(order?.orderStatus) ? order.orderStatus : "\u65E0\u9000\u6B3E";
      return {
        id: serial,
        orderId: order?.id || serial,
        paymentNo: `PAY${String(2026e6 + serial)}`,
        payChannel: channel,
        payStatus,
        payAmount: order?.netAmount || order?.grossAmount || 99,
        currencyCode: "CNY",
        transactionId: `TX${String(8e9 + serial)}`,
        merchantOrderNo: order?.orderNo || `EC${String(2026e4 + serial)}`,
        acquirerCode: pickProfileCode(runtime.profile, "acquirer_code", random, [
          { code: "ALI-ACQ", label: "ALI-ACQ", weight: 34 },
          { code: "WX-ACQ", label: "WX-ACQ", weight: 32 },
          { code: "UNION-ACQ", label: "UNION-ACQ", weight: 22 },
          { code: "BANK-ACQ", label: "BANK-ACQ", weight: 12 }
        ], "ALI-ACQ"),
        bankName: pickProfileCode(runtime.profile, "bank_name", random, [
          { code: "\u62DB\u5546\u94F6\u884C", label: "\u62DB\u5546\u94F6\u884C", weight: 26 },
          { code: "\u4E2D\u56FD\u5EFA\u8BBE\u94F6\u884C", label: "\u4E2D\u56FD\u5EFA\u8BBE\u94F6\u884C", weight: 24 },
          { code: "\u4E2D\u56FD\u5DE5\u5546\u94F6\u884C", label: "\u4E2D\u56FD\u5DE5\u5546\u94F6\u884C", weight: 22 },
          { code: "\u4E2D\u56FD\u94F6\u884C", label: "\u4E2D\u56FD\u94F6\u884C", weight: 16 },
          { code: "\u5E73\u5B89\u94F6\u884C", label: "\u5E73\u5B89\u94F6\u884C", weight: 12 }
        ], "\u62DB\u5546\u94F6\u884C"),
        payerAccountMask: `****${String(1e3 + serial).slice(-4)}`,
        payTime,
        callbackTime: shiftTime(payTime, randomIntBetween(1, 15, random)),
        settlementTime: shiftTime(payTime, randomIntBetween(30, 180, random)),
        refundStatus,
        riskResult: pickProfileCode(runtime.profile, "risk_result", random, [
          { code: "\u901A\u8FC7", label: "\u901A\u8FC7", weight: 88 },
          { code: "\u4EBA\u5DE5\u590D\u6838", label: "\u4EBA\u5DE5\u590D\u6838", weight: 8 },
          { code: "\u62E6\u622A", label: "\u62E6\u622A", weight: 4 }
        ], "\u901A\u8FC7")
      };
    }
    function buildSkuFact(serial, random, runtime) {
      const spu = pickFactByIndex(runtime.spuFacts, serial - 1) || buildProductFact(serial, random, runtime.profile);
      const storageSpec = pickProfileCode(runtime.profile, "storage_spec", random, [
        { code: "128GB", label: "128GB", weight: 24 },
        { code: "256GB", label: "256GB", weight: 34 },
        { code: "512GB", label: "512GB", weight: 22 },
        { code: "\u6807\u51C6\u88C5", label: "\u6807\u51C6\u88C5", weight: 12 },
        { code: "\u793C\u76D2\u88C5", label: "\u793C\u76D2\u88C5", weight: 8 }
      ], "256GB");
      const sizeSpec = pickProfileCode(runtime.profile, "size_spec", random, [
        { code: "\u6807\u51C6\u7248", label: "\u6807\u51C6\u7248", weight: 38 },
        { code: "\u9AD8\u914D\u7248", label: "\u9AD8\u914D\u7248", weight: 26 },
        { code: "\u4F01\u4E1A\u7248", label: "\u4F01\u4E1A\u7248", weight: 10 },
        { code: "L", label: "L", weight: 16 },
        { code: "XL", label: "XL", weight: 10 }
      ], "\u6807\u51C6\u7248");
      const packageSpec = pickProfileCode(runtime.profile, "package_spec", random, [
        { code: "\u5355\u4EF6", label: "\u5355\u4EF6", weight: 54 },
        { code: "\u5957\u88C5", label: "\u5957\u88C5", weight: 16 },
        { code: "\u793C\u76D2", label: "\u793C\u76D2", weight: 12 },
        { code: "\u5B98\u65B9\u6807\u914D", label: "\u5B98\u65B9\u6807\u914D", weight: 18 }
      ], "\u5355\u4EF6");
      const warehouseName = pickProfileCode(runtime.profile, "warehouse_name", random, [
        { code: "\u4E0A\u6D77\u9752\u6D66\u4E2D\u5FC3\u4ED3", label: "\u4E0A\u6D77\u9752\u6D66\u4E2D\u5FC3\u4ED3", weight: 26 },
        { code: "\u676D\u5DDE\u4F59\u676D\u4ED3", label: "\u676D\u5DDE\u4F59\u676D\u4ED3", weight: 20 },
        { code: "\u6DF1\u5733\u9F99\u534E\u4ED3", label: "\u6DF1\u5733\u9F99\u534E\u4ED3", weight: 20 },
        { code: "\u5357\u4EAC\u6C5F\u5B81\u4ED3", label: "\u5357\u4EAC\u6C5F\u5B81\u4ED3", weight: 18 },
        { code: "\u6210\u90FD\u53CC\u6D41\u4ED3", label: "\u6210\u90FD\u53CC\u6D41\u4ED3", weight: 16 }
      ], "\u4E0A\u6D77\u9752\u6D66\u4E2D\u5FC3\u4ED3");
      const promoPrice = Number((spu.salePrice * randomNumberBetween(0.86, 0.98, random, 4)).toFixed(2));
      const memberPrice = Number((promoPrice * randomNumberBetween(0.95, 0.99, random, 4)).toFixed(2));
      const stockQty = Math.max(spu.stockQty || 10, randomIntBetween(20, Math.max(spu.stockQty || 60, 60), random));
      const lockedStockQty = randomIntBetween(0, Math.max(2, Math.round(stockQty * 0.12)), random);
      return {
        id: serial,
        spu,
        skuCode: `SKU${String(1e6 + serial).slice(-7)}`,
        productName: spu.productName,
        brandName: spu.brandName,
        categoryCode: spu.categoryCode,
        categoryName: spu.categoryLabel,
        colorName: pickProfileCode(runtime.profile, "color_name", random, [
          { code: "\u9ED1\u8272", label: "\u9ED1\u8272", weight: 20 },
          { code: "\u767D\u8272", label: "\u767D\u8272", weight: 20 },
          { code: "\u6DF1\u7A7A\u7070", label: "\u6DF1\u7A7A\u7070", weight: 18 },
          { code: "\u94F6\u8272", label: "\u94F6\u8272", weight: 18 },
          { code: "\u8FDC\u5CF0\u84DD", label: "\u8FDC\u5CF0\u84DD", weight: 12 },
          { code: "\u5976\u6CB9\u674F", label: "\u5976\u6CB9\u674F", weight: 12 }
        ], "\u9ED1\u8272"),
        storageSpec,
        sizeSpec,
        packageSpec,
        barcode: `69${String(1e9 + serial).slice(-10)}`,
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
        onlineTime: shiftTime(spu.launchDate || /* @__PURE__ */ new Date(), randomIntBetween(60, 2400, random))
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
        snapshotDate: new Date(startedAt.getTime() - serial * 24 * 60 * 60 * 1e3),
        warehouseCode: sku?.warehouseCode || `WH${String(400 + serial).slice(-3)}`,
        warehouseName: sku?.warehouseName || "\u4E0A\u6D77\u9752\u6D66\u4E2D\u5FC3\u4ED3",
        availableQty,
        reservedQty,
        inTransitQty,
        damagedQty,
        pendingPutawayQty: randomIntBetween(0, 12, random),
        cycleCountDiff: randomIntBetween(-3, 5, random),
        turnoverDays: randomIntBetween(8, 96, random),
        replenishmentStatus: pickProfileCode(runtime.profile, "replenishment_status", random, [
          { code: "\u6B63\u5E38", label: "\u6B63\u5E38", weight: 62 },
          { code: "\u9700\u8865\u8D27", label: "\u9700\u8865\u8D27", weight: 24 },
          { code: "\u5728\u9014\u8865\u8D27", label: "\u5728\u9014\u8865\u8D27", weight: 14 }
        ], "\u6B63\u5E38"),
        alertLevel: pickProfileCode(runtime.profile, "alert_level", random, [
          { code: "\u6B63\u5E38", label: "\u6B63\u5E38", weight: 68 },
          { code: "\u5173\u6CE8", label: "\u5173\u6CE8", weight: 22 },
          { code: "\u9884\u8B66", label: "\u9884\u8B66", weight: 10 }
        ], "\u6B63\u5E38"),
        supplierName: sku?.spu?.supplierName || "\u534E\u4E1C\u4F9B\u5E94\u94FE\u4E2D\u5FC3",
        lastInboundTime: shiftTime(startedAt, -randomIntBetween(12, 160, random) * 60),
        lastOutboundTime: shiftTime(startedAt, -randomIntBetween(1, 72, random) * 60),
        stockAmount: Number((availableQty * (sku?.salePrice || 199)).toFixed(2))
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
        deliveryMode: pickProfileCode(runtime.profile, "delivery_mode", random, ECOMMERCE_DELIVERY_MODES, "\u5FEB\u9012\u914D\u9001"),
        refundFlag: ["\u9000\u6B3E\u4E2D", "\u9000\u6B3E\u6210\u529F"].includes(order?.orderStatus) ? 1 : 0,
        qualityFlag: serial % 36 === 0 ? 1 : 0
      };
    }
    function buildRefundFact(serial, random, runtime) {
      const order = pickFactByIndex(runtime.orderFacts, serial - 1);
      const payment = pickFactByIndex(runtime.paymentFacts, serial - 1);
      const reason = pickProfileCode(runtime.profile, "refund_reason", random, ECOMMERCE_REFUND_REASONS, "\u4E03\u5929\u65E0\u7406\u7531");
      const refundStatus = pickProfileCode(runtime.profile, "refund_status", random, ECOMMERCE_REFUND_STATUS, order?.orderStatus === "\u9000\u6B3E\u6210\u529F" ? "\u9000\u6B3E\u6210\u529F" : "\u5F85\u5BA1\u6838");
      const ratio = reason === "\u4E03\u5929\u65E0\u7406\u7531" ? randomNumberBetween(0.82, 1, random, 4) : randomNumberBetween(0.35, 0.92, random, 4);
      const refundAmount = Number(((payment?.payAmount || order?.netAmount || 99) * ratio).toFixed(2));
      const applyTime = shiftTime(order?.completeTime || order?.shipTime || order?.payTime || order?.orderTime || /* @__PURE__ */ new Date(), randomIntBetween(360, 24 * 60 * 8, random));
      return {
        id: serial,
        order,
        payment,
        refundNo: `RF${String(2026e6 + serial)}`,
        refundReason: reason,
        refundStatus,
        refundAmount,
        applyTime,
        approveTime: shiftTime(applyTime, randomIntBetween(30, 360, random)),
        completeTime: shiftTime(applyTime, randomIntBetween(120, 960, random)),
        applicantName: order?.consigneeName || `\u7533\u8BF7\u4EBA${serial}`,
        auditName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u8D75"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B81"}`,
        itemCount: order?.itemQuantity || 1,
        logisticsBackFlag: reason === "\u4E03\u5929\u65E0\u7406\u7531" ? 1 : 0,
        returnWarehouseCode: payment?.payStatus === "\u652F\u4ED8\u6210\u529F" ? pickFactByIndex(runtime.skuFacts, serial - 1)?.warehouseCode || "WH001" : "WH001",
        returnTrackingNo: `RT${String(5e9 + serial)}`,
        disputeFlag: serial % 28 === 0 ? 1 : 0
      };
    }
    function buildDeliveryFact(serial, random, runtime) {
      const order = pickFactByIndex(runtime.orderFacts, serial - 1);
      const item = pickFactByIndex(runtime.itemFacts, serial - 1);
      const warehouseName = item?.sku?.warehouseName || "\u4E0A\u6D77\u9752\u6D66\u4E2D\u5FC3\u4ED3";
      const courierCompany = pickProfileCode(runtime.profile, "courier_company", random, ECOMMERCE_COURIERS, "\u987A\u4E30\u901F\u8FD0");
      const dispatchTime = order?.shipTime || shiftTime(order?.payTime || order?.orderTime || /* @__PURE__ */ new Date(), randomIntBetween(30, 260, random));
      const firstPickupTime = shiftTime(dispatchTime, randomIntBetween(20, 180, random));
      const deliveredTime = shiftTime(firstPickupTime, randomIntBetween(360, 3600, random));
      const signedTime = order?.completeTime || shiftTime(deliveredTime, randomIntBetween(30, 360, random));
      return {
        id: serial,
        order,
        deliveryNo: `DL${String(2026e6 + serial)}`,
        warehouseCode: item?.warehouseCode || "WH001",
        warehouseName,
        courierCompany,
        trackingNo: `SF${String(6e9 + serial)}`,
        deliveryStatus: order?.deliveryStatus || pickProfileCode(runtime.profile, "delivery_status", random, ECOMMERCE_DELIVERY_STATUS, "\u8FD0\u8F93\u4E2D"),
        dispatchTime,
        firstPickupTime,
        deliveredTime,
        signedTime,
        consigneeName: order?.consigneeName || `\u6536\u8D27\u4EBA${serial}`,
        consigneeMobile: order?.consigneeMobile || buildMainlandMobile(4e4 + serial, random),
        destinationProvince: order?.provinceCode || "310000",
        destinationCity: order?.cityCode || "310000",
        destinationDistrict: order?.cityCode || "310000",
        routeName: pickProfileCode(runtime.profile, "route_name", random, [
          { code: "\u534E\u4E1C\u6B21\u6668\u8FBE", label: "\u534E\u4E1C\u6B21\u6668\u8FBE", weight: 30 },
          { code: "\u957F\u4E09\u89D2\u5E72\u7EBF", label: "\u957F\u4E09\u89D2\u5E72\u7EBF", weight: 24 },
          { code: "\u534E\u5357\u822A\u7A7A\u4EF6", label: "\u534E\u5357\u822A\u7A7A\u4EF6", weight: 18 },
          { code: "\u540C\u57CE\u5373\u65F6\u5C65\u7EA6", label: "\u540C\u57CE\u5373\u65F6\u5C65\u7EA6", weight: 28 }
        ], "\u534E\u4E1C\u6B21\u6668\u8FBE"),
        packageCount: Math.max(1, order?.itemQuantity || 1),
        packageWeight: randomNumberBetween(0.35, 12.8, random),
        abnormalFlag: order?.deliveryStatus === "\u914D\u9001\u5F02\u5E38" ? 1 : 0
      };
    }
    function buildLicensePlate(cityCode, serial, random) {
      const prefixMap = {
        "310000": "\u6CAAA",
        "330100": "\u6D59A",
        "320100": "\u82CFA",
        "440300": "\u7CA4B",
        "510100": "\u5DDDA"
      };
      const prefix = prefixMap[cityCode] || "\u6CAAA";
      const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const tail = `${letters[Math.floor(random() * letters.length)]}${String(1e4 + serial).slice(-5)}`;
      return `${prefix}${tail}`;
    }
    function pickFirst(items, fallback = null) {
      return Array.isArray(items) && items.length > 0 ? items[0] : fallback;
    }
    function buildTrafficVehicleFact(serial, random, runtime) {
      const owner = pickFactByIndex(runtime.ownerFacts, serial - 1);
      const profile = runtime.profile;
      const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
      const city = owner?.city || pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "\u4E0A\u6D77\u5E02" });
      const vehicleTypes = Array.isArray(profile.vehicleTypes) && profile.vehicleTypes.length > 0 ? profile.vehicleTypes : TRAFFIC_VEHICLE_TYPES;
      const weightedVehicleTypes = applyWeightOverride(vehicleTypes, getDistributionRuleConfig(profile, "vehicle_type_ratio"));
      const vehicleType = pickWeighted(weightedVehicleTypes, random) || pickFirst(vehicleTypes, { code: "SEDAN", label: "\u5C0F\u578B\u5BA2\u8F66" });
      const brandCatalog = {
        SEDAN: ["\u5927\u4F17", "\u4E30\u7530", "\u672C\u7530", "\u522B\u514B"],
        SUV: ["\u7406\u60F3", "\u6BD4\u4E9A\u8FEA", "\u7279\u65AF\u62C9", "\u5766\u514B"],
        NEW_ENERGY: ["\u6BD4\u4E9A\u8FEA", "\u7279\u65AF\u62C9", "\u851A\u6765", "\u5C0F\u9E4F"],
        TRUCK: ["\u4E1C\u98CE", "\u89E3\u653E", "\u9655\u6C7D", "\u798F\u7530"],
        BUS: ["\u5B87\u901A", "\u91D1\u9F99", "\u4E2D\u901A\u5BA2\u8F66", "\u6BD4\u4E9A\u8FEA"]
      };
      const brandName = pickOne(brandCatalog[vehicleType.code] || ["\u5927\u4F17"], random) || "\u5927\u4F17";
      return {
        id: serial,
        ownerId: owner?.id || serial,
        plateNo: buildLicensePlate(city.code, serial, random),
        vehicleType: vehicleType.code,
        ownerName: owner?.ownerName || `\u8F66\u4E3B${serial}`,
        registerCityCode: city.code,
        registerCityName: city.name,
        ownerMobile: owner?.ownerMobile || buildMainlandMobile(5e4 + serial, random),
        brandName,
        modelName: `${brandName}${pickOne(["\u65D7\u8230\u7248", "\u8C6A\u534E\u7248", "\u6807\u51C6\u7248", "\u667A\u4EAB\u7248"], random) || "\u6807\u51C6\u7248"}`,
        fuelType: pickProfileCode(profile, "fuel_type", random, TRAFFIC_FUEL_TYPES, "\u6C7D\u6CB9"),
        colorName: pickProfileCode(profile, "color_name", random, [
          { code: "\u9ED1\u8272", label: "\u9ED1\u8272", weight: 28 },
          { code: "\u767D\u8272", label: "\u767D\u8272", weight: 24 },
          { code: "\u94F6\u8272", label: "\u94F6\u8272", weight: 20 },
          { code: "\u84DD\u8272", label: "\u84DD\u8272", weight: 16 },
          { code: "\u7070\u8272", label: "\u7070\u8272", weight: 12 }
        ], "\u767D\u8272"),
        seatCount: vehicleType.code === "BUS" ? randomIntBetween(20, 55, random) : vehicleType.code === "TRUCK" ? randomIntBetween(2, 3, random) : randomIntBetween(4, 7, random),
        loadCapacity: vehicleType.code === "TRUCK" ? randomNumberBetween(3.5, 18, random) : randomNumberBetween(0.4, 1.8, random),
        plateIssueOrg: `${city.name}\u516C\u5B89\u5C40\u4EA4\u901A\u8B66\u5BDF\u652F\u961F\u8F66\u8F86\u7BA1\u7406\u6240`,
        registeredAt: new Date(Date.now() - serial * 7 * 24 * 60 * 60 * 1e3),
        annualInspectionDue: new Date(Date.now() + randomIntBetween(20, 300, random) * 24 * 60 * 60 * 1e3),
        insuranceStatus: pickProfileCode(profile, "insurance_status", random, TRAFFIC_INSURANCE_STATUS, "\u6709\u6548"),
        operationType: pickProfileCode(profile, "operation_type", random, TRAFFIC_OPERATION_TYPES, "\u975E\u8425\u8FD0"),
        deviceId: `DEV${String(4e5 + serial)}`
      };
    }
    function buildTrafficOwnerFact(serial, random, profile) {
      const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
      const city = pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "\u4E0A\u6D77\u5E02" });
      const familyName = pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5F20";
      const givenName = `${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u60A6"}`;
      const ownerName = `${familyName}${givenName}`;
      return {
        id: serial,
        ownerCode: `OWNER${String(1e5 + serial).slice(-6)}`,
        ownerName,
        gender: serial % 2 === 0 ? "\u5973" : "\u7537",
        idCardNo: buildMainlandIdCard(city.code, new Date(1985 + serial % 18, serial % 12, serial % 27 + 1), serial, serial % 2 === 0 ? "F" : "M"),
        ownerMobile: buildMainlandMobile(1e5 + serial, random),
        ownerEmail: buildDomesticEmail(serial, random, "car"),
        city,
        occupationName: pickOne(["\u4E2A\u4F53\u7ECF\u8425", "\u4F01\u4E1A\u5458\u5DE5", "\u5E73\u53F0\u53F8\u673A", "\u7269\u6D41\u53F8\u673A", "\u516C\u52A1\u5458"], random) || "\u4F01\u4E1A\u5458\u5DE5",
        driverLicenseType: pickOne(["C1", "C2", "B2", "A1"], random) || "C1"
      };
    }
    function buildTrafficViolationFact(serial, random, runtime, startedAt) {
      const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
      const owner = runtime.ownerFacts.get(vehicle?.ownerId) || pickFactByIndex(runtime.ownerFacts, serial - 1);
      const violationCodes = Array.isArray(runtime.profile.violationCodes) && runtime.profile.violationCodes.length > 0 ? runtime.profile.violationCodes : TRAFFIC_VIOLATION_CODES;
      const weightedCodes = applyWeightOverride(violationCodes, getDistributionRuleConfig(runtime.profile, "violation_code_ratio"));
      const violationCode = pickWeighted(weightedCodes, random) || pickFirst(violationCodes, { code: "1302", label: "\u8FDD\u6CD5\u505C\u8F66", fineRange: [50, 200], points: 0 });
      const violationStatuses = Array.isArray(runtime.profile.violationStatuses) && runtime.profile.violationStatuses.length > 0 ? runtime.profile.violationStatuses : TRAFFIC_VIOLATION_STATUS;
      const weightedStatuses = applyWeightOverride(violationStatuses, getDistributionRuleConfig(runtime.profile, "violation_status_ratio"));
      const status = pickWeighted(weightedStatuses, random)?.code || "\u5DF2\u7F34\u6B3E";
      const fineRange = pickRangeValue(violationCode.fineRange, [100, 200]);
      const points = Number(violationCode.points ?? 0);
      return {
        id: serial,
        vehicleId: vehicle?.id || serial,
        ownerId: owner?.id || serial,
        violationNo: `WF${String(2026e6 + serial)}`,
        plateNo: vehicle?.plateNo || buildLicensePlate("310000", serial, random),
        vehicleType: vehicle?.vehicleType || "SEDAN",
        violationCode: violationCode.code,
        violationDesc: violationCode.label,
        violationPoints: points,
        fineAmount: randomNumberBetween(fineRange[0], fineRange[1], random),
        roadName: pickOne(runtime.profile.roadNames, random) || "\u4E16\u7EAA\u5927\u9053",
        directionName: pickOne(["\u4E1C\u5411\u897F", "\u897F\u5411\u4E1C", "\u5357\u5411\u5317", "\u5317\u5411\u5357"], random) || "\u4E1C\u5411\u897F",
        cameraName: pickOne(["\u7535\u5B50\u8B66\u5BDF", "\u9AD8\u6E05\u5361\u53E3", "\u8FDD\u6CD5\u6293\u62CD\u7403\u673A", "\u7EFC\u5408\u76D1\u6D4B\u6746"], random) || "\u7535\u5B50\u8B66\u5BDF",
        violationStatus: status,
        captureTime: new Date(startedAt.getTime() - serial * 35 * 60 * 1e3),
        noticeTime: new Date(startedAt.getTime() - serial * 33 * 60 * 1e3),
        handleDeadline: new Date(startedAt.getTime() + 15 * 24 * 60 * 60 * 1e3),
        lawBasis: "\u4F9D\u636E\u300A\u9053\u8DEF\u4EA4\u901A\u5B89\u5168\u6CD5\u300B\u53CA\u76F8\u5173\u914D\u5957\u89C4\u5B9A\u5904\u7406",
        officerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}\u8B66\u5B98`,
        ownerName: owner?.ownerName || `\u8F66\u4E3B${serial}`,
        ownerMobile: owner?.ownerMobile || buildMainlandMobile(6e4 + serial, random)
      };
    }
    function buildTrafficInspectionFact(serial, random, runtime, startedAt) {
      const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
      const inspectionResults = Array.isArray(runtime.profile.inspectionResults) && runtime.profile.inspectionResults.length > 0 ? runtime.profile.inspectionResults : TRAFFIC_INSPECTION_RESULTS;
      const weightedResults = applyWeightOverride(inspectionResults, getDistributionRuleConfig(runtime.profile, "inspection_result_ratio"));
      const result = pickWeighted(weightedResults, random)?.code || "\u6B63\u5E38\u653E\u884C";
      const officerName = `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}\u8B66\u5B98`;
      return {
        id: serial,
        vehicleId: vehicle?.id || serial,
        stationName: pickOne(runtime.profile.stationNames, random) || "\u5EF6\u5B89\u9AD8\u67B6\u68C0\u67E5\u7AD9",
        roadName: pickOne(runtime.profile.roadNames, random) || "\u4E16\u7EAA\u5927\u9053",
        laneNo: `\u7B2C${serial % 6 + 1}\u8F66\u9053`,
        plateNo: vehicle?.plateNo || buildLicensePlate("310000", serial, random),
        vehicleType: vehicle?.vehicleType || "SEDAN",
        officerName,
        assistOfficerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5468"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u742A"}\u8B66\u5B98`,
        inspectionResult: result,
        problemCode: result === "\u6B63\u5E38\u653E\u884C" ? "NONE" : `CHK-${String(100 + serial).slice(-3)}`,
        problemDesc: result === "\u6B63\u5E38\u653E\u884C" ? "\u8BC1\u7167\u9F50\u5168\uFF0C\u4E88\u4EE5\u653E\u884C" : pickOne(["\u9A7E\u9A76\u4EBA\u672A\u6309\u89C4\u5B9A\u643A\u5E26\u8BC1\u4EF6", "\u8425\u8FD0\u6807\u8BC6\u4E0D\u5B8C\u6574", "\u8F66\u8EAB\u53CD\u5149\u6807\u8BC6\u7834\u635F"], random) || "\u9A7E\u9A76\u4EBA\u672A\u6309\u89C4\u5B9A\u643A\u5E26\u8BC1\u4EF6",
        inspectionTime: new Date(startedAt.getTime() - serial * 28 * 60 * 1e3),
        releaseTime: new Date(startedAt.getTime() - serial * 25 * 60 * 1e3),
        bodyCameraNo: `BWC${String(1e5 + serial)}`,
        evidenceNo: `EV${String(2e5 + serial)}`
      };
    }
    function buildTrafficDriverTrainingFact(serial, random, runtime, startedAt) {
      const owner = pickFactByIndex(runtime.ownerFacts, serial - 1);
      const subject = pickOne([
        { code: "KM1", label: "\u79D1\u76EE\u4E00" },
        { code: "KM2", label: "\u79D1\u76EE\u4E8C" },
        { code: "KM3", label: "\u79D1\u76EE\u4E09" },
        { code: "KM4", label: "\u79D1\u76EE\u56DB" }
      ], random) || { code: "KM1", label: "\u79D1\u76EE\u4E00" };
      const trainingStatus = pickOne(["\u62A5\u540D\u4E2D", "\u5B66\u4E60\u4E2D", "\u5F85\u8003\u8BD5", "\u5DF2\u5B8C\u6210"], random) || "\u5B66\u4E60\u4E2D";
      const enrolledTime = new Date(startedAt.getTime() - serial * 9 * 24 * 60 * 60 * 1e3);
      const plannedExamTime = shiftTime(enrolledTime, randomIntBetween(7 * 24 * 60, 40 * 24 * 60, random));
      const completedTime = trainingStatus === "\u5DF2\u5B8C\u6210" ? shiftTime(plannedExamTime, randomIntBetween(1 * 24 * 60, 10 * 24 * 60, random)) : null;
      const totalHours = Number((16 + random() * 48).toFixed(1));
      const validHours = Number(Math.max(12, totalHours - random() * 6).toFixed(1));
      const attendanceRate = Number((0.82 + random() * 0.18).toFixed(4));
      return {
        id: serial,
        trainingNo: `JX${String(2026e6 + serial)}`,
        schoolName: pickOne(["\u6D66\u4E1C\u673A\u52A8\u8F66\u9A7E\u9A76\u5458\u57F9\u8BAD\u4E2D\u5FC3", "\u8679\u6865\u9A7E\u9A76\u57F9\u8BAD\u5B66\u6821", "\u897F\u6E56\u673A\u52A8\u8F66\u57F9\u8BAD\u5B66\u6821", "\u6C5F\u5B81\u9A7E\u9A76\u5458\u5B66\u4E60\u4E2D\u5FC3"], random) || "\u6D66\u4E1C\u673A\u52A8\u8F66\u9A7E\u9A76\u5458\u57F9\u8BAD\u4E2D\u5FC3",
        coachName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5F20"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u660E"}\u6559\u7EC3`,
        coachMobile: buildMainlandMobile(61e3 + serial, random),
        trainingVehicleNo: buildLicensePlate(owner?.city?.code || "310000", 9e3 + serial, random),
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
        examResult: trainingStatus === "\u5DF2\u5B8C\u6210" ? random() > 0.18 ? "\u901A\u8FC7" : "\u672A\u901A\u8FC7" : "\u672A\u8003\u6838",
        archiveStatus: trainingStatus === "\u5DF2\u5B8C\u6210" ? "\u5DF2\u5F52\u6863" : "\u5F85\u5F52\u6863",
        remark: `${subject.label}\u5B66\u4E60\u8BB0\u5F55\u5DF2\u540C\u6B65\u9A7E\u57F9\u53F0\u8D26`,
        owner
      };
    }
    function buildTrafficCheckpointPassFact(serial, random, runtime, startedAt) {
      const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
      const owner = runtime.ownerFacts.get(vehicle?.ownerId) || pickFactByIndex(runtime.ownerFacts, serial - 1);
      const checkpointName = pickOne(runtime.profile.stationNames, random) || "\u8679\u6865\u67A2\u7EBD\u5361\u53E3";
      const limitSpeed = pickOne([60, 80, 100, 120], random) || 80;
      const passSpeed = Number(Math.max(20, limitSpeed - 10 + random() * 35).toFixed(1));
      const hasAlert = passSpeed > limitSpeed || serial % 19 === 0;
      return {
        id: serial,
        passNo: `GK${String(2026e6 + serial)}`,
        checkpointCode: `CP${String(1e5 + serial).slice(-6)}`,
        checkpointName,
        laneNo: `\u8F66\u9053${serial % 6 + 1}`,
        directionName: pickOne(["\u4E1C\u5411\u897F", "\u897F\u5411\u4E1C", "\u5357\u5411\u5317", "\u5317\u5411\u5357"], random) || "\u4E1C\u5411\u897F",
        plateNo: vehicle?.plateNo || buildLicensePlate("310000", serial, random),
        vehicleType: vehicle?.vehicleType || "SEDAN",
        plateColor: pickOne(["\u84DD\u724C", "\u9EC4\u724C", "\u7EFF\u724C"], random) || "\u84DD\u724C",
        passTime: new Date(startedAt.getTime() - serial * 18 * 60 * 1e3),
        passSpeed,
        limitSpeed,
        passResult: hasAlert ? serial % 5 === 0 ? "\u4EBA\u5DE5\u590D\u6838" : "\u5F02\u5E38\u9884\u8B66" : "\u6B63\u5E38\u8FC7\u8F66",
        plateMatchFlag: serial % 23 === 0 ? 1 : 0,
        violationFlag: hasAlert ? 1 : 0,
        captureDeviceNo: `CAM${String(3e5 + serial)}`,
        imageUri: `https://mock.local/traffic/checkpoint/${serial}.jpg`,
        travelDirection: pickOne(["\u8FDB\u57CE", "\u51FA\u57CE", "\u5FEB\u901F\u901A\u884C", "\u8F85\u9053\u901A\u884C"], random) || "\u8FDB\u57CE",
        remark: `${checkpointName}\u5361\u53E3\u5DF2\u8BB0\u5F55\u672C\u6B21\u8FC7\u8F66\u4E8B\u4EF6`,
        vehicle,
        owner
      };
    }
    function buildTrafficRegistrationFact(serial, random, runtime, startedAt) {
      const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
      const owner = pickFactByIndex(runtime.ownerFacts, serial - 1);
      return {
        id: serial,
        registrationNo: `DJ${String(2026e6 + serial)}`,
        registrationType: pickOne(["\u65B0\u8F66\u6CE8\u518C", "\u8F6C\u79FB\u767B\u8BB0", "\u53D8\u66F4\u767B\u8BB0"], random) || "\u65B0\u8F66\u6CE8\u518C",
        registerOrgName: `${owner?.city?.name || "\u4E0A\u6D77"}\u8F66\u7BA1\u6240`,
        approvalStatus: pickOne(["\u5DF2\u529E\u7ED3", "\u5F85\u5BA1\u6838", "\u8865\u5145\u6750\u6599"], random) || "\u5DF2\u529E\u7ED3",
        time: new Date(startedAt.getTime() - serial * 5 * 24 * 60 * 60 * 1e3),
        vehicle,
        owner
      };
    }
    function buildTrafficPaymentFact(serial, random, runtime, startedAt) {
      const violation = pickFactByIndex(runtime.violationFacts, serial - 1);
      const paidAmount = Number((violation?.fineAmount || 100).toFixed(2));
      return {
        id: serial,
        paymentNo: `JK${String(2026e6 + serial)}`,
        paymentChannel: pickProfileCode(runtime.profile, "payment_channel", random, TRAFFIC_PAYMENT_CHANNELS, "\u652F\u4ED8\u5B9D"),
        paymentStatus: violation?.violationStatus === "\u5DF2\u7F34\u6B3E" ? "\u7F34\u6B3E\u6210\u529F" : violation?.violationStatus === "\u5DF2\u64A4\u9500" ? "\u5DF2\u51B2\u6B63" : "\u5F85\u7F34\u6B3E",
        bankName: pickOne(["\u4E2D\u56FD\u94F6\u884C", "\u4E2D\u56FD\u5DE5\u5546\u94F6\u884C", "\u5EFA\u8BBE\u94F6\u884C"], random) || "\u4E2D\u56FD\u94F6\u884C",
        payerName: violation?.ownerName || `\u7F34\u6B3E\u4EBA${serial}`,
        payerMobile: violation?.ownerMobile || buildMainlandMobile(7e4 + serial, random),
        receiptNo: `PZ${String(3e5 + serial)}`,
        refundFlag: serial % 15 === 0 ? 1 : 0,
        reconcileStatus: "\u5DF2\u5BF9\u8D26",
        paymentTime: new Date(startedAt.getTime() - serial * 70 * 60 * 1e3),
        settlementTime: new Date(startedAt.getTime() - serial * 68 * 60 * 1e3),
        violation,
        paidAmount
      };
    }
    function buildTrafficAccidentFact(serial, random, runtime, startedAt) {
      const vehicle = pickFactByIndex(runtime.vehicleFacts, serial - 1);
      return {
        id: serial,
        accidentNo: `SG${String(2026e6 + serial)}`,
        accidentType: pickOne(["\u8FFD\u5C3E\u4E8B\u6545", "\u5250\u8E6D\u4E8B\u6545", "\u5355\u8F66\u4E8B\u6545", "\u8DEF\u53E3\u78B0\u649E"], random) || "\u8FFD\u5C3E\u4E8B\u6545",
        accidentLevel: pickProfileCode(runtime.profile, "accident_level", random, TRAFFIC_ACCIDENT_LEVELS, "\u4E00\u822C\u4E8B\u6545"),
        roadName: pickOne(runtime.profile.roadNames, random) || "\u4E16\u7EAA\u5927\u9053",
        weatherDesc: pickOne(["\u6674", "\u591A\u4E91", "\u5C0F\u96E8"], random) || "\u6674",
        roadCondition: pickOne(["\u5E72\u71E5", "\u6E7F\u6ED1", "\u62E5\u5835"], random) || "\u5E72\u71E5",
        injuryCount: serial % 10 === 0 ? 1 : 0,
        deathCount: 0,
        lossAmount: Number((2e3 + random() * 3e4).toFixed(2)),
        liabilityType: pickOne(["\u5168\u8D23", "\u4E3B\u8D23", "\u540C\u8D23"], random) || "\u5168\u8D23",
        caseStatus: pickProfileCode(runtime.profile, "case_status", random, TRAFFIC_CASE_STATUS, "\u5904\u7406\u4E2D"),
        occurTime: new Date(startedAt.getTime() - serial * 80 * 60 * 1e3),
        reportTime: new Date(startedAt.getTime() - serial * 79 * 60 * 1e3),
        closeTime: new Date(startedAt.getTime() - serial * 40 * 60 * 1e3),
        handleOfficer: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}\u8B66\u5B98`,
        vehicle
      };
    }
    function buildTrafficDispatchFact(serial, random, runtime, startedAt) {
      const accident = pickFactByIndex(runtime.accidentFacts, serial - 1);
      const vehicle = accident?.vehicle || pickFactByIndex(runtime.vehicleFacts, serial - 1);
      return {
        id: serial,
        dispatchNo: `PD${String(2026e6 + serial)}`,
        dispatchType: accident ? "\u4E8B\u6545\u5904\u7F6E" : "\u8FDD\u6CD5\u5904\u7F6E",
        dispatchStatus: pickOne(["\u5DF2\u5B8C\u6210", "\u5904\u7406\u4E2D", "\u5F85\u63A5\u5355"], random) || "\u5DF2\u5B8C\u6210",
        stationName: pickOne(runtime.profile.stationNames, random) || "\u4E16\u7EAA\u5927\u9053\u6267\u6CD5\u5C97",
        targetRoadName: pickOne(runtime.profile.roadNames, random) || "\u4E16\u7EAA\u5927\u9053",
        dutyTeamName: pickOne(["\u4E00\u5927\u961F", "\u4E8C\u5927\u961F", "\u673A\u52A8\u4E2D\u961F"], random) || "\u4E00\u5927\u961F",
        leaderName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738B"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6D9B"}\u8B66\u5B98`,
        officerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u9648"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u742A"}\u8B66\u5B98`,
        dispatchTime: new Date(startedAt.getTime() - serial * 90 * 60 * 1e3),
        acceptTime: new Date(startedAt.getTime() - serial * 88 * 60 * 1e3),
        arriveTime: new Date(startedAt.getTime() - serial * 84 * 60 * 1e3),
        finishTime: new Date(startedAt.getTime() - serial * 60 * 60 * 1e3),
        priorityLevel: pickOne(["\u9AD8", "\u4E2D", "\u666E\u901A"], random) || "\u4E2D",
        sourceChannel: pickProfileCode(runtime.profile, "source_channel", random, TRAFFIC_SOURCE_CHANNELS, "\u73B0\u573A\u53D1\u73B0"),
        accident,
        vehicle
      };
    }
    function buildTrafficPatrolFact(serial, random, runtime, startedAt) {
      const dispatch = pickFactByIndex(runtime.dispatchFacts, serial - 1);
      return {
        id: serial,
        logNo: `XL${String(2026e6 + serial)}`,
        stationName: dispatch?.stationName || pickOne(runtime.profile.stationNames, random) || "\u5EF6\u5B89\u9AD8\u67B6\u68C0\u67E5\u7AD9",
        roadName: dispatch?.targetRoadName || pickOne(runtime.profile.roadNames, random) || "\u4E16\u7EAA\u5927\u9053",
        checkpointName: pickOne(runtime.profile.stationNames, random) || "\u8679\u6865\u67A2\u7EBD\u5361\u53E3",
        officerName: dispatch?.officerName || `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5468"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u8F69"}\u8B66\u5B98`,
        eventType: pickOne(["\u5DE1\u903B\u53D1\u73B0\u8FDD\u505C", "\u4F8B\u884C\u68C0\u67E5", "\u9AD8\u5CF0\u758F\u5BFC", "\u4E8B\u6545\u5904\u7F6E\u56DE\u8BBF"], random) || "\u4F8B\u884C\u68C0\u67E5",
        eventResult: pickOne(["\u5DF2\u5904\u7406", "\u6301\u7EED\u5173\u6CE8", "\u8F6C\u6D3E\u5904\u7F6E"], random) || "\u5DF2\u5904\u7406",
        eventTime: new Date(startedAt.getTime() - serial * 30 * 60 * 1e3),
        gpsTrackId: `GPS${String(5e5 + serial)}`,
        longitude: Number((121.3 + random() * 0.25).toFixed(6)),
        latitude: Number((31.15 + random() * 0.25).toFixed(6)),
        dispatch
      };
    }
    function buildTrafficDocumentFact(serial, random, runtime, startedAt) {
      const violation = pickFactByIndex(runtime.violationFacts, serial - 1);
      const inspection = pickFactByIndex(runtime.inspectionFacts, serial - 1);
      return {
        id: serial,
        documentNo: `WS${String(2026e6 + serial)}`,
        documentType: pickProfileCode(runtime.profile, "document_type", random, TRAFFIC_DOCUMENT_TYPES, "\u8FDD\u6CD5\u5904\u7406\u901A\u77E5\u4E66"),
        issueOrgName: `${pickOne(CITY_OPTIONS, random)?.name || "\u4E0A\u6D77"}\u4EA4\u8B66\u652F\u961F`,
        issueTime: new Date(startedAt.getTime() - serial * 75 * 60 * 1e3),
        serveTime: new Date(startedAt.getTime() - serial * 70 * 60 * 1e3),
        serveMode: pickOne(["\u73B0\u573A\u9001\u8FBE", "\u90AE\u5BC4\u9001\u8FBE", "\u7535\u5B50\u9001\u8FBE"], random) || "\u73B0\u573A\u9001\u8FBE",
        signStatus: pickOne(["\u5DF2\u7B7E\u6536", "\u62D2\u7B7E", "\u5F85\u9001\u8FBE"], random) || "\u5DF2\u7B7E\u6536",
        appealFlag: serial % 12 === 0 ? "\u5DF2\u7533\u8BC9" : "\u672A\u7533\u8BC9",
        archiveNo: `ARC${String(6e5 + serial)}`,
        violation,
        inspection
      };
    }
    function buildBankReportFact(serial, random, runtime, startedAt) {
      const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
      const reportCodePool = Array.isArray(runtime.profile.reportCodes) && runtime.profile.reportCodes.length > 0 ? runtime.profile.reportCodes : BANK_REPORT_CODES;
      const weightedReportCodes = applyWeightOverride(reportCodePool, getDistributionRuleConfig(runtime.profile, "report_code_ratio"));
      const reportCode = pickWeighted(weightedReportCodes, random) || reportCodePool[0] || { code: "1104-G01", label: "\u8D44\u4EA7\u8D28\u91CF\u62A5\u9001" };
      const reportStatusPool = Array.isArray(runtime.profile.reportStatuses) && runtime.profile.reportStatuses.length > 0 ? runtime.profile.reportStatuses : BANK_REPORT_STATUS;
      const weightedReportStatuses = applyWeightOverride(reportStatusPool, getDistributionRuleConfig(runtime.profile, "report_status_ratio"));
      const reportStatus = pickWeighted(weightedReportStatuses, random)?.code || "\u5DF2\u63D0\u4EA4";
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
      const reportFreq = pickProfileCode(runtime.profile, "report_freq", random, BANK_REPORT_FREQUENCY, "\u5B63\u62A5");
      const submitTime = new Date(startedAt.getTime() - serial * 12 * 60 * 60 * 1e3);
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
        receiveTime: shiftTime(submitTime, randomIntBetween(10, 180, random))
      };
    }
    function buildBankIssueFact(serial, random, runtime, startedAt) {
      const report = pickFactByIndex(runtime.reportFacts, serial - 1);
      const issueTypePool = Array.isArray(runtime.profile.issueTypes) && runtime.profile.issueTypes.length > 0 ? runtime.profile.issueTypes : BANK_ISSUE_TYPES;
      const weightedIssueTypes = applyWeightOverride(issueTypePool, getDistributionRuleConfig(runtime.profile, "issue_type_ratio"));
      const issueType = pickWeighted(weightedIssueTypes, random) || issueTypePool[0];
      const issueLevelPool = Array.isArray(runtime.profile.issueLevels) && runtime.profile.issueLevels.length > 0 ? runtime.profile.issueLevels : BANK_ISSUE_LEVELS;
      const weightedIssueLevels = applyWeightOverride(issueLevelPool, getDistributionRuleConfig(runtime.profile, "issue_level_ratio"));
      const issueLevel = pickWeighted(weightedIssueLevels, random)?.code || "\u4E00\u822C";
      const checkerName = `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738B"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6D9B"}\u4E13\u5458`;
      const identifiedAt = new Date(startedAt.getTime() - serial * 6 * 60 * 60 * 1e3);
      return {
        id: serial,
        reportId: report?.id || serial,
        caseNo: `CASE${String(6e5 + serial)}`,
        issueType: issueType.code,
        issueLevel,
        disposalStatus: pickProfileCode(runtime.profile, "disposal_status", random, BANK_DISPOSAL_STATUS, "\u6574\u6539\u4E2D"),
        checkerName,
        ownerDepartment: pickOne(["\u98CE\u9669\u7BA1\u7406\u90E8", "\u6570\u636E\u7BA1\u7406\u90E8", "\u76D1\u7BA1\u62A5\u9001\u90E8", "\u53CD\u6D17\u94B1\u4E2D\u5FC3"], random) || "\u76D1\u7BA1\u62A5\u9001\u90E8",
        issueDesc: `${issueType.label || issueType.code}\uFF0C\u9700\u5728\u76D1\u7BA1\u65F6\u9650\u5185\u5B8C\u6210\u590D\u6838\u4E0E\u8865\u6B63`,
        identifiedAt,
        dueAt: shiftTime(identifiedAt, randomIntBetween(24 * 60, 24 * 60 * 15, random)),
        disposedAt: shiftTime(identifiedAt, randomIntBetween(2 * 24 * 60, 20 * 24 * 60, random))
      };
    }
    function buildBankInstitutionFact(serial, random, profile) {
      const cityOptions = Array.isArray(profile.cities) && profile.cities.length > 0 ? profile.cities : CITY_OPTIONS;
      const institutionNames = Array.isArray(profile.institutionNames) && profile.institutionNames.length > 0 ? profile.institutionNames : ["\u4E2D\u56FD\u94F6\u884C"];
      const city = pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "\u4E0A\u6D77\u5E02" });
      const institutionName = pickOne(institutionNames, random) || pickFirst(institutionNames, "\u4E2D\u56FD\u94F6\u884C");
      const isStateOwnedBank = /工商|建设|农业|中国银行|交通/.test(institutionName);
      const institutionType = isStateOwnedBank ? "\u56FD\u6709\u5927\u578B\u94F6\u884C\u5206\u652F\u673A\u6784" : /招商/.test(institutionName) ? "\u80A1\u4EFD\u5236\u5546\u4E1A\u94F6\u884C\u5206\u652F\u673A\u6784" : "\u5546\u4E1A\u94F6\u884C\u5206\u652F\u673A\u6784";
      const legalInstitutionName = isStateOwnedBank ? `${institutionName}${city.name}\u5206\u884C` : `${institutionName.replace(/股份有限公司/g, "")}\u80A1\u4EFD\u6709\u9650\u516C\u53F8${city.name}\u5206\u884C`;
      const establishedAt = new Date(getRuntimeBaseTime({ baseTime: profile?.baseTime }).getTime() - randomIntBetween(6 * 365, 28 * 365, random) * 24 * 60 * 60 * 1e3);
      return {
        id: serial,
        institutionCode: `INST${String(1e5 + serial).slice(-6)}`,
        institutionName: legalInstitutionName,
        institutionType,
        licenseNo: `JX${String(3e9 + serial)}`,
        orgCode: `91310${String(1e8 + serial)}`,
        city,
        regulatorName: `\u56FD\u5BB6\u91D1\u878D\u76D1\u7763\u7BA1\u7406\u603B\u5C40${city.name}\u76D1\u7BA1\u5C40`,
        institutionStatus: "\u6B63\u5E38\u7ECF\u8425",
        establishedAt,
        businessStartAt: new Date(establishedAt.getTime() + randomIntBetween(30, 360, random) * 24 * 60 * 60 * 1e3),
        registeredCapital: Number((5e8 + random() * 3e9).toFixed(2)),
        employeeCount: randomIntBetween(420, 3600, random)
      };
    }
    function buildBankBranchDetailFact(serial, random, runtime) {
      const institution = pickFactByIndex(runtime.institutionFacts, serial - 1);
      const cityOptions = Array.isArray(runtime.profile.cities) && runtime.profile.cities.length > 0 ? runtime.profile.cities : CITY_OPTIONS;
      const city = institution?.city || pickOne(cityOptions, random) || pickFirst(cityOptions, { code: "310000", name: "\u4E0A\u6D77\u5E02" });
      const branchTypePool = Array.isArray(runtime.profile.branchTypes) && runtime.profile.branchTypes.length > 0 ? runtime.profile.branchTypes : BANK_BRANCH_TYPES;
      const branchType = pickWeighted(branchTypePool, random) || branchTypePool[0];
      const establishedAt = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(1 * 365, 18 * 365, random) * 24 * 60 * 60 * 1e3);
      const institutionNames = Array.isArray(runtime.profile.institutionNames) && runtime.profile.institutionNames.length > 0 ? runtime.profile.institutionNames : ["\u4E2D\u56FD\u94F6\u884C"];
      const institutionName = String(institution?.institutionName || pickOne(institutionNames, random) || pickFirst(institutionNames, "\u4E2D\u56FD\u94F6\u884C") || "").trim();
      const branchNameBase = institutionName.includes(city.name) ? institutionName : `${institutionName}${city.name}`;
      return {
        id: serial,
        branchCode: `BR${String(2e5 + serial).slice(-6)}`,
        branchName: `${branchNameBase}${branchType.label}`,
        branchType: branchType.code,
        regionCode: city.code,
        regionName: city.name,
        governanceLevel: pickProfileCode(runtime.profile, "governance_level", random, [
          { code: "\u4E00\u7EA7\u7ECF\u8425\u5355\u5143", label: "\u4E00\u7EA7\u7ECF\u8425\u5355\u5143", weight: 38 },
          { code: "\u4E8C\u7EA7\u7ECF\u8425\u5355\u5143", label: "\u4E8C\u7EA7\u7ECF\u8425\u5355\u5143", weight: 42 },
          { code: "\u4E09\u7EA7\u7ECF\u8425\u5355\u5143", label: "\u4E09\u7EA7\u7ECF\u8425\u5355\u5143", weight: 20 }
        ], "\u4E00\u7EA7\u7ECF\u8425\u5355\u5143"),
        reportingFlag: pickProfileCode(runtime.profile, "reporting_flag", random, [
          { code: "\u7EB3\u5165\u62A5\u9001", label: "\u7EB3\u5165\u62A5\u9001", weight: 94 },
          { code: "\u89C2\u5BDF\u540D\u5355", label: "\u89C2\u5BDF\u540D\u5355", weight: 6 }
        ], "\u7EB3\u5165\u62A5\u9001"),
        establishedAt,
        assetScale: Number((8e8 + random() * 4e9).toFixed(2)),
        loanScale: Number((5e8 + random() * 25e8).toFixed(2)),
        depositScale: Number((6e8 + random() * 3e9).toFixed(2)),
        contactName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}`,
        contactMobile: buildMainlandMobile(8e4 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
        contactEmail: buildDomesticEmail(serial, random, "branch"),
        institution
      };
    }
    function buildBankContactFact(serial, random, runtime) {
      const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
      return {
        id: serial,
        contactName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5468"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B87"}`,
        contactRole: pickProfileCode(runtime.profile, "contact_role", random, [
          { code: "\u76D1\u7BA1\u62A5\u9001\u4E13\u5458", label: "\u76D1\u7BA1\u62A5\u9001\u4E13\u5458", weight: 38 },
          { code: "\u98CE\u9669\u7BA1\u7406\u4E13\u5458", label: "\u98CE\u9669\u7BA1\u7406\u4E13\u5458", weight: 26 },
          { code: "\u5408\u89C4\u7ECF\u7406", label: "\u5408\u89C4\u7ECF\u7406", weight: 22 },
          { code: "\u53CD\u6D17\u94B1\u4E13\u5458", label: "\u53CD\u6D17\u94B1\u4E13\u5458", weight: 14 }
        ], "\u76D1\u7BA1\u62A5\u9001\u4E13\u5458"),
        contactMobile: buildMainlandMobile(9e4 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
        contactEmail: buildDomesticEmail(serial, random, "report"),
        departmentName: pickProfileCode(runtime.profile, "department_name", random, [
          { code: "\u98CE\u9669\u7BA1\u7406\u90E8", label: "\u98CE\u9669\u7BA1\u7406\u90E8", weight: 30 },
          { code: "\u5408\u89C4\u7BA1\u7406\u90E8", label: "\u5408\u89C4\u7BA1\u7406\u90E8", weight: 24 },
          { code: "\u76D1\u7BA1\u62A5\u9001\u90E8", label: "\u76D1\u7BA1\u62A5\u9001\u90E8", weight: 30 },
          { code: "\u53CD\u6D17\u94B1\u4E2D\u5FC3", label: "\u53CD\u6D17\u94B1\u4E2D\u5FC3", weight: 16 }
        ], "\u76D1\u7BA1\u62A5\u9001\u90E8"),
        dutyScope: pickProfileCode(runtime.profile, "duty_scope", random, [
          { code: "\u5BA1\u614E\u62A5\u8868\u62A5\u9001", label: "\u5BA1\u614E\u62A5\u8868\u62A5\u9001", weight: 36 },
          { code: "EAST\u6838\u67E5\u53CD\u9988", label: "EAST\u6838\u67E5\u53CD\u9988", weight: 24 },
          { code: "\u95EE\u9898\u5355\u6574\u6539\u8DDF\u8E2A", label: "\u95EE\u9898\u5355\u6574\u6539\u8DDF\u8E2A", weight: 22 },
          { code: "\u53CD\u6D17\u94B1\u62A5\u9001", label: "\u53CD\u6D17\u94B1\u62A5\u9001", weight: 18 }
        ], "\u5BA1\u614E\u62A5\u8868\u62A5\u9001"),
        primaryContactFlag: serial % 3 === 0 ? 0 : 1,
        officePhone: buildMainlandMobile(95e3 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
        onboardTime: new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(60, 2200, random) * 24 * 60 * 60 * 1e3),
        branch
      };
    }
    function buildBankMetricFact(serial, random, runtime) {
      const report = pickFactByIndex(runtime.reportFacts, serial - 1);
      const metricCatalog = [
        { name: "\u8D44\u672C\u5145\u8DB3\u7387", category: "\u8D44\u672C\u7C7B", unit: "%" },
        { name: "\u4E00\u7EA7\u8D44\u672C\u5145\u8DB3\u7387", category: "\u8D44\u672C\u7C7B", unit: "%" },
        { name: "\u6838\u5FC3\u4E00\u7EA7\u8D44\u672C\u5145\u8DB3\u7387", category: "\u8D44\u672C\u7C7B", unit: "%" },
        { name: "\u4E0D\u826F\u8D37\u6B3E\u7387", category: "\u8D44\u4EA7\u8D28\u91CF\u7C7B", unit: "%" },
        { name: "\u62E8\u5907\u8986\u76D6\u7387", category: "\u8D44\u4EA7\u8D28\u91CF\u7C7B", unit: "%" },
        { name: "\u6D41\u52A8\u6027\u8986\u76D6\u7387", category: "\u6D41\u52A8\u6027\u7C7B", unit: "%" },
        { name: "\u5927\u989D\u98CE\u9669\u66B4\u9732\u6BD4\u4F8B", category: "\u96C6\u4E2D\u5EA6\u7C7B", unit: "%" }
      ];
      const metric = pickOne(metricCatalog, random) || metricCatalog[0];
      const metricValue = metric.name.includes("\u4E0D\u826F") ? randomNumberBetween(0.8, 2.8, random) : metric.name.includes("\u62E8\u5907") ? randomNumberBetween(180, 320, random) : metric.name.includes("\u6D41\u52A8\u6027") ? randomNumberBetween(130, 200, random) : metric.name.includes("\u5927\u989D\u98CE\u9669") ? randomNumberBetween(8, 28, random) : randomNumberBetween(8.5, 16, random);
      const warningThreshold = metric.name.includes("\u4E0D\u826F") ? 2 : metric.name.includes("\u62E8\u5907") ? 180 : metric.name.includes("\u6D41\u52A8\u6027") ? 100 : metric.name.includes("\u5927\u989D\u98CE\u9669") ? 25 : 10.5;
      const benchmarkValue = metric.name.includes("\u4E0D\u826F") ? 1.4 : metric.name.includes("\u62E8\u5907") ? 240 : metric.name.includes("\u6D41\u52A8\u6027") ? 150 : metric.name.includes("\u5927\u989D\u98CE\u9669") ? 18 : 12.2;
      return {
        id: serial,
        metricCode: `MT${String(1e3 + serial)}`,
        metricName: metric.name,
        metricCategory: metric.category,
        metricValue,
        metricUnit: metric.unit,
        warningThreshold,
        benchmarkValue,
        warningFlag: metric.name.includes("\u4E0D\u826F") ? metricValue > warningThreshold ? 1 : 0 : metricValue < warningThreshold ? 1 : 0,
        metricStatus: metric.name.includes("\u4E0D\u826F") ? metricValue > warningThreshold ? "\u9884\u8B66" : "\u6B63\u5E38" : metricValue < warningThreshold ? "\u9884\u8B66" : "\u6B63\u5E38",
        calculatedAt: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 4 * 60 * 60 * 1e3),
        report
      };
    }
    function buildBankRiskExposureFact(serial, random, runtime) {
      const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
      return {
        id: serial,
        snapshotPeriod: `2026-${String(serial % 12 + 1).padStart(2, "0")}`,
        creditRiskExposure: Number((2e8 + random() * 2e9).toFixed(2)),
        marketRiskExposure: Number((1e8 + random() * 8e8).toFixed(2)),
        operationalRiskExposure: Number((5e7 + random() * 5e8).toFixed(2)),
        liquidityGapAmount: Number((1e7 + random() * 2e8).toFixed(2)),
        concentrationRatio: Number((8 + random() * 25).toFixed(2)),
        riskLevel: pickProfileCode(runtime.profile, "risk_level", random, [
          { code: "\u6B63\u5E38", label: "\u6B63\u5E38", weight: 68 },
          { code: "\u5173\u6CE8", label: "\u5173\u6CE8", weight: 22 },
          { code: "\u9884\u8B66", label: "\u9884\u8B66", weight: 10 }
        ], "\u6B63\u5E38"),
        snapshotTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 24 * 60 * 60 * 1e3),
        branch
      };
    }
    function buildBankAlertFact(serial, random, runtime) {
      const branch = pickFactByIndex(runtime.branchFacts, serial - 1);
      return {
        id: serial,
        alertNo: `AML${String(2e5 + serial)}`,
        alertType: pickProfileCode(runtime.profile, "alert_type", random, [
          { code: "\u5927\u989D\u4EA4\u6613\u9884\u8B66", label: "\u5927\u989D\u4EA4\u6613\u9884\u8B66", weight: 42 },
          { code: "\u9AD8\u9891\u4EA4\u6613\u9884\u8B66", label: "\u9AD8\u9891\u4EA4\u6613\u9884\u8B66", weight: 24 },
          { code: "\u5F02\u5E38\u8D26\u6237\u9884\u8B66", label: "\u5F02\u5E38\u8D26\u6237\u9884\u8B66", weight: 18 },
          { code: "\u8DE8\u5883\u8D44\u91D1\u9884\u8B66", label: "\u8DE8\u5883\u8D44\u91D1\u9884\u8B66", weight: 16 }
        ], "\u5927\u989D\u4EA4\u6613\u9884\u8B66"),
        transactionAmount: Number((3e5 + random() * 5e6).toFixed(2)),
        currencyCode: "CNY",
        counterpartyName: `${pickOne(BANK_INSTITUTION_NAMES, random) || "\u4E2D\u56FD\u94F6\u884C"}\u4EA4\u6613\u5BF9\u624B${serial}`,
        alertStatus: pickProfileCode(runtime.profile, "alert_status", random, BANK_ALERT_STATUS, "\u5F85\u6838\u67E5"),
        reviewResult: pickProfileCode(runtime.profile, "review_result", random, BANK_REVIEW_RESULTS, "\u6B63\u5E38"),
        alertTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 2 * 60 * 60 * 1e3),
        reviewTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 60 * 60 * 1e3),
        branch
      };
    }
    function buildBankTaskFact(serial, random, runtime) {
      const issue = pickFactByIndex(runtime.issueFacts, serial - 1);
      return {
        id: serial,
        taskNo: `ZG${String(3e5 + serial)}`,
        taskType: pickProfileCode(runtime.profile, "task_type", random, [
          { code: "\u6570\u636E\u8865\u5F55", label: "\u6570\u636E\u8865\u5F55", weight: 34 },
          { code: "\u53E3\u5F84\u4FEE\u6B63", label: "\u53E3\u5F84\u4FEE\u6B63", weight: 26 },
          { code: "\u6307\u6807\u590D\u6838", label: "\u6307\u6807\u590D\u6838", weight: 22 },
          { code: "\u62A5\u9001\u66F4\u6B63", label: "\u62A5\u9001\u66F4\u6B63", weight: 18 }
        ], "\u6570\u636E\u8865\u5F55"),
        taskStatus: pickProfileCode(runtime.profile, "task_status", random, BANK_TASK_STATUS, "\u6574\u6539\u4E2D"),
        ownerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738B"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u7433"}`,
        ownerMobile: buildMainlandMobile(11e4 + serial, random),
        ownerDepartment: pickProfileCode(runtime.profile, "department_name", random, [
          { code: "\u98CE\u9669\u7BA1\u7406\u90E8", label: "\u98CE\u9669\u7BA1\u7406\u90E8", weight: 34 },
          { code: "\u6570\u636E\u7BA1\u7406\u90E8", label: "\u6570\u636E\u7BA1\u7406\u90E8", weight: 22 },
          { code: "\u5408\u89C4\u7BA1\u7406\u90E8", label: "\u5408\u89C4\u7BA1\u7406\u90E8", weight: 24 },
          { code: "\u76D1\u7BA1\u62A5\u9001\u90E8", label: "\u76D1\u7BA1\u62A5\u9001\u90E8", weight: 20 }
        ], "\u98CE\u9669\u7BA1\u7406\u90E8"),
        createTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 3 * 24 * 60 * 60 * 1e3),
        startTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 2 * 24 * 60 * 60 * 1e3),
        finishTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 24 * 60 * 60 * 1e3),
        issue
      };
    }
    function buildBankSubmissionLogFact(serial, random, runtime) {
      const report = pickFactByIndex(runtime.reportFacts, serial - 1);
      return {
        id: serial,
        submitBatchNo: `SUB${String(5e5 + serial)}`,
        submitChannel: pickProfileCode(runtime.profile, "submit_channel", random, BANK_SUBMIT_CHANNELS, "\u76D1\u7BA1\u4E13\u7F51"),
        logStatus: pickProfileCode(runtime.profile, "log_status", random, [
          { code: "\u5DF2\u53D1\u9001", label: "\u5DF2\u53D1\u9001", weight: 42 },
          { code: "\u5DF2\u63A5\u6536", label: "\u5DF2\u63A5\u6536", weight: 32 },
          { code: "\u5F85\u91CD\u8BD5", label: "\u5F85\u91CD\u8BD5", weight: 12 },
          { code: "\u5DF2\u9000\u56DE", label: "\u5DF2\u9000\u56DE", weight: 14 }
        ], "\u5DF2\u53D1\u9001"),
        messageType: pickProfileCode(runtime.profile, "message_type", random, [
          { code: "\u6B63\u5F0F\u62A5\u9001", label: "\u6B63\u5F0F\u62A5\u9001", weight: 54 },
          { code: "\u8865\u6B63\u62A5\u9001", label: "\u8865\u6B63\u62A5\u9001", weight: 28 },
          { code: "\u91CD\u62A5", label: "\u91CD\u62A5", weight: 18 }
        ], "\u6B63\u5F0F\u62A5\u9001"),
        messageSummary: `${report?.reportCode || "1104"} \u62A5\u9001\u6458\u8981 ${serial}`,
        eventTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 5 * 60 * 60 * 1e3),
        report
      };
    }
    function buildBankApprovalFact(serial, random, runtime) {
      const report = pickFactByIndex(runtime.reportFacts, serial - 1);
      return {
        id: serial,
        approvalNo: `AP${String(7e5 + serial)}`,
        approvalNode: pickProfileCode(runtime.profile, "approval_node", random, [
          { code: "\u673A\u6784\u590D\u6838", label: "\u673A\u6784\u590D\u6838", weight: 38 },
          { code: "\u5206\u884C\u5BA1\u6279", label: "\u5206\u884C\u5BA1\u6279", weight: 32 },
          { code: "\u603B\u884C\u5907\u6848", label: "\u603B\u884C\u5907\u6848", weight: 18 },
          { code: "\u76D1\u7BA1\u53CD\u9988", label: "\u76D1\u7BA1\u53CD\u9988", weight: 12 }
        ], "\u673A\u6784\u590D\u6838"),
        approverName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u9648"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u7136"}`,
        approvalResult: pickProfileCode(runtime.profile, "approval_result", random, BANK_APPROVAL_RESULTS, "\u901A\u8FC7"),
        approvalTime: new Date(getRuntimeBaseTime(runtime).getTime() - serial * 7 * 60 * 60 * 1e3),
        report
      };
    }
    function buildBankCustomerAccountFact(serial, random, runtime) {
      const branch = pickFactByIndex(runtime.branchFacts, serial - 1) || buildBankBranchDetailFact(serial, random, runtime);
      const customerType = pickOne(["PERSONAL", "ENTERPRISE"], random) || "PERSONAL";
      const gender = serial % 2 === 0 ? "F" : "M";
      const birthDate = new Date(1972 + serial % 20, serial % 12, serial % 27 + 1);
      const customerName = customerType === "ENTERPRISE" ? `${pickOne(["Huaxin", "Jinyun", "Ronghe", "Xingzhou", "Haicheng"], random) || "Huaxin"}${serial % 9 + 1} Holdings` : `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Li"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ming"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yue"}`;
      const accountType = pickOne(["CURRENT", "FIXED", "SETTLEMENT"], random) || "CURRENT";
      const accountStatus = serial % 19 === 0 ? "FROZEN" : serial % 29 === 0 ? "CLOSED" : "ACTIVE";
      const balanceAmount = randomNumberBetween(customerType === "ENTERPRISE" ? 8e5 : 5e3, customerType === "ENTERPRISE" ? 28e6 : 9e5, random);
      const freezeAmount = Number((accountStatus === "FROZEN" ? balanceAmount * randomNumberBetween(0.2, 0.6, random, 4) : balanceAmount * randomNumberBetween(0, 0.08, random, 4)).toFixed(2));
      const availableAmount = Number(Math.max(0, balanceAmount - freezeAmount).toFixed(2));
      const openDate = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(30, 2400, random) * 24 * 60 * 60 * 1e3);
      return {
        id: serial,
        branch,
        accountNo: `ACC${String(6e8 + serial)}`,
        accountType,
        customerName,
        customerType,
        idNo: customerType === "ENTERPRISE" ? `91310${String(1e8 + serial).slice(-9)}` : buildMainlandIdCard(branch?.regionCode || "310000", birthDate, 7e5 + serial, gender),
        mobile: buildMainlandMobile(8e5 + serial, random),
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
        remark: `${customerType} account profile synchronized`
      };
    }
    function buildBankLoanContractFact(serial, random, runtime) {
      const branch = pickFactByIndex(runtime.branchFacts, serial - 1) || buildBankBranchDetailFact(serial, random, runtime);
      const account = pickFactByIndex(runtime.customerAccountFacts, serial - 1) || buildBankCustomerAccountFact(serial, random, runtime);
      const contractStatus = pickOne(["ACTIVE", "OVERDUE", "SETTLED"], random) || "ACTIVE";
      const loanAmount = randomNumberBetween(account.customerType === "ENTERPRISE" ? 6e5 : 8e4, account.customerType === "ENTERPRISE" ? 18e6 : 25e5, random);
      const disbursementDate = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(30, 1600, random) * 24 * 60 * 60 * 1e3);
      const maturityDate = shiftTime(disbursementDate, randomIntBetween(180 * 24 * 60, 1825 * 24 * 60, random));
      const outstandingAmount = Number((contractStatus === "SETTLED" ? loanAmount * randomNumberBetween(0, 0.03, random, 4) : contractStatus === "OVERDUE" ? loanAmount * randomNumberBetween(0.28, 0.82, random, 4) : loanAmount * randomNumberBetween(0.12, 0.66, random, 4)).toFixed(2));
      return {
        id: serial,
        branch,
        account,
        contractNo: `LON${String(7e8 + serial)}`,
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
        remark: `${contractStatus} loan contract linked with branch reporting`
      };
    }
    function buildEcommerceLiveStreamFact(serial, random, runtime, startedAt) {
      const store = pickFactByIndex(runtime.storeFacts, serial - 1) || buildStoreFact(serial, random, runtime.profile);
      const sessionStatus = serial % 11 === 0 ? "RUNNING" : serial % 17 === 0 ? "PLANNED" : "FINISHED";
      const startTime = new Date(startedAt.getTime() - randomIntBetween(2, 240, random) * 60 * 1e3);
      const durationMinutes = randomIntBetween(45, 240, random);
      const endTime = shiftTime(startTime, durationMinutes);
      const viewerCount = randomIntBetween(1200, 48e3, random);
      const uvCount = Math.max(300, Math.round(viewerCount * randomNumberBetween(0.55, 0.92, random, 4)));
      const orderCount = Math.max(20, Math.round(uvCount * randomNumberBetween(0.015, 0.18, random, 4)));
      const avgOrderAmount = randomNumberBetween(69, 880, random);
      const orderAmount = Number((orderCount * avgOrderAmount).toFixed(2));
      return {
        id: serial,
        store,
        sessionNo: `LS${String(5e8 + serial)}`,
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
        remark: `${sessionStatus} live stream for ${store.storeName}`
      };
    }
    function buildEcommerceEnterpriseProcurementFact(serial, random, runtime, startedAt) {
      const store = pickFactByIndex(runtime.storeFacts, serial - 1) || buildStoreFact(serial, random, runtime.profile);
      const customer = pickFactByIndex(runtime.customerFacts, serial - 1) || buildCustomerFact(serial, random, runtime.profile);
      const orderStatus = pickOne(["SIGNED", "PAID", "DELIVERING", "COMPLETED"], random) || "SIGNED";
      const orderAmount = randomNumberBetween(12e3, 68e4, random);
      const paidAmount = Number((orderStatus === "SIGNED" ? orderAmount * randomNumberBetween(0, 0.3, random, 4) : orderStatus === "PAID" ? orderAmount * randomNumberBetween(0.7, 1, random, 4) : orderAmount).toFixed(2));
      const signedTime = new Date(startedAt.getTime() - randomIntBetween(2 * 24 * 60, 180 * 24 * 60, random) * 60 * 1e3);
      const deliveryPlanTime = shiftTime(signedTime, randomIntBetween(3 * 24 * 60, 28 * 24 * 60, random));
      return {
        id: serial,
        store,
        customer,
        procurementNo: `B2B${String(4e8 + serial)}`,
        buyerCompanyName: `${pickOne(["Huanyu", "Jinzhi", "Yunke", "Xingtu", "Jiahang"], random) || "Huanyu"} Procurement ${serial % 9 + 1}`,
        buyerContact: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Qian"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Fan"}`,
        buyerMobile: buildMainlandMobile(9e5 + serial, random),
        contractNo: `CTR${String(3e8 + serial)}`,
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
        remark: `${orderStatus} enterprise procurement order`
      };
    }
    function buildEducationParentCommunicationFact(serial, random, runtime, startedAt) {
      const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
      const guardian = findFact(runtime.guardianFacts, (item) => item.student?.id === student.id) || pickFactByIndex(runtime.guardianFacts, serial - 1) || buildEducationGuardianFact(serial, random, runtime);
      const staff = pickFactByIndex(runtime.staffFacts, serial - 1) || buildEducationStaffFact(serial, random, runtime);
      const replyStatus = pickOne(["PENDING", "READ", "REPLIED"], random) || "READ";
      const sendTime = new Date(startedAt.getTime() - randomIntBetween(2 * 60, 18 * 24 * 60, random) * 60 * 1e3);
      const readTime = replyStatus === "PENDING" ? null : shiftTime(sendTime, randomIntBetween(5, 1440, random));
      return {
        id: serial,
        student,
        guardian,
        staff,
        messageNo: `MSG${String(2e8 + serial)}`,
        messageChannel: pickOne(["APP", "WECHAT", "SMS", "PHONE"], random) || "APP",
        messageType: pickOne(["NOTICE", "ATTENDANCE", "PERFORMANCE", "SAFETY", "PAYMENT"], random) || "NOTICE",
        title: pickOne(["Attendance Reminder", "Safety Notice", "Class Update", "Payment Reminder", "Parent Feedback"], random) || "Class Update",
        contentSummary: pickOne([
          "Guardian follow-up required for recent class notice",
          "Daily attendance status has been updated",
          "Parent confirmation needed for school activity",
          "Tuition reminder and payment instruction",
          "Weekly performance feedback summary"
        ], random) || "Guardian follow-up required for recent class notice",
        senderName: staff.staffName,
        sendTime,
        readTime,
        replyTime: replyStatus === "REPLIED" && readTime ? shiftTime(readTime, randomIntBetween(10, 960, random)) : null,
        replyStatus,
        urgencyLevel: pickOne(["LOW", "MEDIUM", "HIGH"], random) || "LOW",
        handleTeacher: staff.staffName,
        archiveStatus: replyStatus === "REPLIED" ? "ARCHIVED" : "PENDING",
        remark: `${replyStatus} parent communication record`
      };
    }
    function buildEducationDormitoryResidentFact(serial, random, runtime, startedAt) {
      const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
      const campus = student.campus || pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
      const residentStatus = serial % 17 === 0 ? "CHECKOUT" : serial % 23 === 0 ? "LEAVE" : "ACTIVE";
      const checkinTime = new Date(startedAt.getTime() - randomIntBetween(15 * 24 * 60, 420 * 24 * 60, random) * 60 * 1e3);
      return {
        id: serial,
        student,
        campus,
        residentNo: `DOR${String(1e8 + serial)}`,
        dormitoryNo: `D${padNumber(serial % 12 + 1, 2)}-${padNumber(serial % 20 + 101, 3)}`,
        buildingNo: `B${padNumber(serial % 8 + 1, 2)}`,
        roomNo: `${padNumber(serial % 18 + 201, 3)}`,
        bedNo: `${String.fromCharCode(65 + serial % 6)}${serial % 2 + 1}`,
        checkinTime,
        checkoutTime: residentStatus === "CHECKOUT" ? shiftTime(checkinTime, randomIntBetween(30 * 24 * 60, 260 * 24 * 60, random)) : null,
        residentStatus,
        managerName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Sun"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Tong"}`,
        electricityBalance: randomNumberBetween(20, 180, random),
        hygieneScore: randomNumberBetween(72, 99, random, 1),
        disciplineScore: randomNumberBetween(75, 100, random, 1),
        weekendLeaveFlag: serial % 4 === 0 ? 1 : 0,
        accessCardNo: student.accessCardNo,
        remark: `${residentStatus} dormitory resident record`
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
          district_name: fact.districtName
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
          delivery_instructions: fact.deliveryInstructions
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
          rating_score: fact.ratingScore
        };
      }
      if (table.tableName === "product_spu" || table.tableName === "product_info") {
        const fact = buildProductFact(serial, random, runtime.profile);
        runtime.spuFacts.set(fact.id, fact);
        runtime.productFacts.set(fact.id, fact);
        return {
          spu_id: fact.id,
          spu_code: `SPU${String(1e6 + serial).slice(-7)}`,
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
          stock_qty: fact.stockQty
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
          online_time: formatDateTime(fact.onlineTime)
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
          stock_amount: fact.stockAmount
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
          order_amount: fact.netAmount
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
          product_name: fact.sku?.productName || `\u5546\u54C1${serial}`,
          brand_name: fact.sku?.brandName || "\u54C1\u724C",
          category_code: fact.sku?.categoryCode || "ELECTRONIC",
          category_name: fact.sku?.categoryName || "\u624B\u673A\u6570\u7801",
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
          quality_flag: fact.qualityFlag
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
          risk_result: fact.riskResult
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
          dispute_flag: fact.disputeFlag
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
          abnormal_flag: fact.abnormalFlag
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
          remark: fact.remark
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
          remark: fact.remark
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
          district_code: `${fact.city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
          district_name: pickOne(fact.city.districts, random) || fact.city.name,
          residence_address: `${fact.city.name}${pickOne(fact.city.districts, random) || fact.city.name}${pickOne(["\u4EBA\u6C11\u8DEF", "\u4E2D\u5C71\u8DEF", "\u9752\u5E74\u8DEF", "\u6EE8\u6C5F\u8DEF"], random) || "\u4EBA\u6C11\u8DEF"}${serial % 180 + 1}\u53F7`,
          occupation_name: fact.occupationName,
          driver_license_type: fact.driverLicenseType,
          first_license_time: formatDateTime(new Date(startedAt.getTime() - randomIntBetween(8 * 365, 22 * 365, random) * 24 * 60 * 60 * 1e3)),
          expire_license_time: formatDateTime(new Date(startedAt.getTime() + randomIntBetween(150, 1800, random) * 24 * 60 * 60 * 1e3)),
          credit_status: pickProfileCode(runtime.profile, "credit_status", random, [
            { code: "\u6B63\u5E38", label: "\u6B63\u5E38", weight: 84 },
            { code: "\u5173\u6CE8", label: "\u5173\u6CE8", weight: 12 },
            { code: "\u9650\u5236", label: "\u9650\u5236", weight: 4 }
          ], "\u6B63\u5E38"),
          historical_violation_count: randomIntBetween(0, 22, random),
          historical_accident_count: randomIntBetween(0, 5, random)
        };
      }
      if (table.tableName === "vehicle_archive") {
        const fact = buildTrafficVehicleFact(serial, random, runtime);
        runtime.vehicleFacts.set(fact.id, fact);
        return {
          vehicle_id: fact.id,
          owner_id: fact.ownerId,
          plate_no: fact.plateNo,
          vehicle_vin: `VIN${String(9e9 + serial)}`,
          engine_no: `ENG${String(7e8 + serial)}`,
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
          device_id: fact.deviceId
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
          brand_name: fact.vehicle?.brandName || "\u5927\u4F17",
          model_name: fact.vehicle?.modelName || "\u6807\u51C6\u7248",
          vehicle_vin: `VIN${String(9e9 + serial)}`,
          engine_no: `ENG${String(7e8 + serial)}`,
          owner_name: fact.owner?.ownerName || `\u8F66\u4E3B${serial}`,
          owner_mobile: fact.owner?.ownerMobile || buildMainlandMobile(12e4 + serial, random),
          approval_status: fact.approvalStatus,
          remark: "\u8D44\u6599\u9F50\u5168\uFF0C\u5DF2\u5F52\u6863"
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
          remark: `${fact.violationDesc}\uFF0C\u5DF2\u751F\u6210\u5904\u7406\u6D41\u6C34`
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
          reconcile_status: fact.reconcileStatus
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
          remark: fact.problemDesc
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
          remark: fact.remark
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
          remark: fact.remark
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
          remark: `${fact.accidentType}\uFF0C\u5F53\u524D\u72B6\u6001${fact.caseStatus}`
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
          remark: "\u5DF2\u6309\u8F96\u533A\u89C4\u5219\u6D3E\u5355\u5904\u7F6E"
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
          remark: `${fact.eventType}\uFF0C\u7ED3\u679C${fact.eventResult}`
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
          owner_name: fact.violation?.ownerName || `\u8F66\u4E3B${serial}`,
          officer_name: fact.violation?.officerName || fact.inspection?.officerName || `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u6668"}\u8B66\u5B98`,
          issue_org_name: fact.issueOrgName,
          issue_time: formatDateTime(fact.issueTime),
          serve_time: formatDateTime(fact.serveTime),
          serve_mode: fact.serveMode,
          sign_status: fact.signStatus,
          appeal_flag: fact.appealFlag,
          archive_no: fact.archiveNo,
          remark: "\u6587\u4E66\u5DF2\u540C\u6B65\u5F52\u6863"
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
          district_code: `${fact.city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
          district_name: pickOne(fact.city.districts, random) || fact.city.name,
          regulator_name: fact.regulatorName,
          institution_status: fact.institutionStatus,
          established_at: formatDateTime(fact.establishedAt),
          business_start_at: formatDateTime(fact.businessStartAt),
          registered_capital: fact.registeredCapital,
          employee_count: fact.employeeCount
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
          contact_email: fact.contactEmail
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
          backup_contact_name: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B81"}`,
          backup_contact_mobile: buildMainlandMobile(13e4 + serial, random),
          report_deadline_day: serial % 20 + 5,
          contact_status: serial % 17 === 0 ? "\u505C\u7528" : "\u6B63\u5E38"
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
          receive_time: formatDateTime(fact.receiveTime)
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
          metric_source_system: serial % 2 === 0 ? "\u98CE\u9669\u7BA1\u7406\u7CFB\u7EDF" : "\u76D1\u7BA1\u62A5\u9001\u5E73\u53F0",
          metric_owner_name: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5468"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u742A"}`,
          deviation_rate: Number(Math.abs(Number(fact.metricValue) - Number(fact.benchmarkValue || 0)).toFixed(2))
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
          risk_owner_department: pickOne(["\u98CE\u9669\u7BA1\u7406\u90E8", "\u76D1\u7BA1\u62A5\u9001\u90E8", "\u6388\u4FE1\u7BA1\u7406\u90E8"], random) || "\u98CE\u9669\u7BA1\u7406\u90E8",
          stress_test_result: fact.riskLevel === "\u9884\u8B66" ? "\u538B\u529B\u60C5\u666F\u4E0B\u8D44\u672C\u627F\u538B" : "\u538B\u529B\u6D4B\u8BD5\u901A\u8FC7",
          capital_buffer_amount: Number((fact.creditRiskExposure * 0.08).toFixed(2)),
          early_warning_level: fact.riskLevel,
          disposal_suggestion: fact.riskLevel === "\u9884\u8B66" ? "\u63D0\u9AD8\u8D44\u672C\u7F13\u51B2\u5E76\u538B\u964D\u96C6\u4E2D\u5EA6" : "\u7EF4\u6301\u73B0\u884C\u7B56\u7565\u5E76\u6301\u7EED\u76D1\u6D4B"
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
          customer_name: `${pickOne(["\u534E\u4E1C\u8D38\u6613", "\u5B8F\u8FBE\u5B9E\u4E1A", "\u8FDC\u822A\u4F9B\u5E94\u94FE", "\u667A\u8054\u79D1\u6280"], random) || "\u534E\u4E1C\u8D38\u6613"}${serial}\u53F7`,
          customer_no: `CIF${String(6e5 + serial)}`,
          counterparty_bank_name: pickOne(["\u4E2D\u56FD\u94F6\u884C", "\u4EA4\u901A\u94F6\u884C", "\u62DB\u5546\u94F6\u884C", "\u5EFA\u8BBE\u94F6\u884C"], random) || "\u4E2D\u56FD\u94F6\u884C",
          report_required_status: fact.alertStatus === "\u5DF2\u4E0A\u62A5" ? "\u5DF2\u4E0A\u62A5" : "\u5F85\u8BC4\u4F30"
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
          regulator_feedback_no: `FB${String(7e5 + serial)}`,
          rectification_status: fact.disposalStatus === "\u5DF2\u5173\u95ED" ? "\u5DF2\u5B8C\u6210" : "\u6301\u7EED\u6574\u6539",
          recheck_result: fact.disposalStatus === "\u5DF2\u5173\u95ED" ? "\u901A\u8FC7" : "\u5F85\u590D\u6838"
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
          task_priority: pickOne(["\u9AD8", "\u4E2D", "\u666E\u901A"], random) || "\u4E2D",
          due_date: formatDateTime(new Date(fact.finishTime.getTime() + 2 * 24 * 60 * 60 * 1e3)),
          accept_result: "\u5DF2\u53D7\u7406",
          verify_result: fact.taskStatus === "\u5DF2\u5B8C\u6210" ? "\u901A\u8FC7" : "\u5F85\u9A8C\u8BC1"
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
          receive_code: `ACK${String(8e5 + serial)}`,
          receive_message: fact.logStatus === "\u5DF2\u9000\u56DE" ? "\u6821\u9A8C\u5931\u8D25\u9700\u8865\u6B63" : "\u62A5\u6587\u5DF2\u63A5\u6536",
          retry_count: fact.logStatus === "\u5DF2\u9000\u56DE" ? 1 : 0,
          operator_name: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u6768"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B81"}`,
          trace_id: `TRACE${String(9e8 + serial)}`,
          payload_checksum: `CHK${String(5e8 + serial)}`,
          archive_status: fact.logStatus === "\u5DF2\u63A5\u6536" ? "\u5DF2\u5F52\u6863" : "\u5F85\u5F52\u6863"
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
          approval_comment: fact.approvalResult === "\u901A\u8FC7" ? "\u53E3\u5F84\u4E00\u81F4\uFF0C\u540C\u610F\u62A5\u9001" : "\u8BF7\u8865\u5145\u652F\u6491\u6750\u6599",
          next_node: fact.approvalResult === "\u901A\u8FC7" ? "\u603B\u884C\u5907\u6848" : "\u673A\u6784\u590D\u6838",
          node_status: fact.approvalResult === "\u901A\u8FC7" ? "\u5DF2\u5B8C\u6210" : "\u5F85\u5904\u7406",
          approver_department: pickOne(["\u98CE\u9669\u7BA1\u7406\u90E8", "\u76D1\u7BA1\u62A5\u9001\u90E8", "\u5408\u89C4\u7BA1\u7406\u90E8"], random) || "\u98CE\u9669\u7BA1\u7406\u90E8",
          escalation_status: fact.approvalResult === "\u9000\u56DE" ? "\u672A\u5347\u7EA7" : "\u65E0\u9700\u5347\u7EA7",
          archive_status: fact.approvalResult === "\u901A\u8FC7" ? "\u5DF2\u5F52\u6863" : "\u5F85\u5F52\u6863",
          callback_status: fact.approvalResult === "\u901A\u8FC7" ? "\u5DF2\u56DE\u6267" : "\u5F85\u56DE\u6267",
          process_instance_no: `PROC${String(6e8 + serial)}`
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
          remark: fact.remark
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
          remark: fact.remark
        };
      }
      return null;
    }
    function buildFundProductFact(serial, random, profile, baseTime = /* @__PURE__ */ new Date()) {
      const company = pickOne(profile.fundCompanies || FUND_COMPANY_NAMES, random) || "\u534E\u590F\u57FA\u91D1";
      const fundType = pickWeighted(profile.fundProductTypes || FUND_PRODUCT_TYPES, random) || FUND_PRODUCT_TYPES[0];
      const defaultRiskLevels = fundType.code === "BOND" ? FUND_RISK_LEVELS.filter((item) => ["R1", "R2", "R3"].includes(item.code)) : fundType.code === "MONEY_MARKET" ? FUND_RISK_LEVELS.filter((item) => ["R1", "R2"].includes(item.code)) : fundType.code === "INDEX" ? FUND_RISK_LEVELS.filter((item) => ["R2", "R3", "R4"].includes(item.code)) : FUND_RISK_LEVELS;
      const riskLevel = pickWeighted(defaultRiskLevels, random) || defaultRiskLevels[0] || FUND_RISK_LEVELS[0];
      const anchorTime = baseTime instanceof Date ? baseTime : new Date(baseTime);
      const establishedAt = new Date(anchorTime.getTime() - randomIntBetween(180, 3200, random) * 24 * 60 * 60 * 1e3);
      const scaleBands = fundType.code === "BOND" ? [8e8, 32e9] : fundType.code === "MONEY_MARKET" ? [3e9, 65e9] : [5e8, 42e9];
      const latestScaleAmount = randomNumberBetween(scaleBands[0], scaleBands[1], random);
      const holderCount = Math.max(1800, Math.round(latestScaleAmount / randomNumberBetween(25e3, 22e4, random)));
      const fundCodeBase = (hashString(`${company}:${fundType.code}`) + serial * 37) % 9e5 + 1e5;
      const managementFeeRate = fundType.code === "BOND" ? randomNumberBetween(0.15, 0.8, random, 4) : fundType.code === "MONEY_MARKET" ? randomNumberBetween(0.12, 0.5, random, 4) : randomNumberBetween(0.35, 1.8, random, 4);
      const custodyFeeRate = fundType.code === "BOND" ? randomNumberBetween(0.05, 0.2, random, 4) : randomNumberBetween(0.05, 0.3, random, 4);
      return {
        id: serial,
        fundCode: String(fundCodeBase).padStart(6, "0"),
        fundName: `${company}${fundType.label}${["\u4E00\u53F7", "\u7CBE\u9009", "\u7A33\u5065", "\u6210\u957F", "\u4EF7\u503C", "\u8FDC\u822A"][serial % 6]}`,
        fundType: fundType.code,
        riskLevel: riskLevel.code,
        managementCompany: company,
        custodianBank: pickOne(BANK_INSTITUTION_NAMES, random) || "\u4E2D\u56FD\u94F6\u884C",
        investmentStyle: pickOne(["\u6210\u957F\u578B", "\u4EF7\u503C\u578B", "\u7A33\u5065\u578B", "\u589E\u5F3A\u6307\u6570"], random) || "\u6210\u957F\u578B",
        currencyCode: "CNY",
        establishedAt,
        openDate: shiftTime(establishedAt, randomIntBetween(15 * 24 * 60, 120 * 24 * 60, random)),
        closeDate: shiftTime(establishedAt, randomIntBetween(1200 * 24 * 60, 3600 * 24 * 60, random)),
        managementFeeRate,
        custodyFeeRate,
        initialNav: randomNumberBetween(0.95, 1.2, random, 4),
        latestScaleAmount,
        holderCount,
        status: serial % 29 === 0 ? "\u5DF2\u6E05\u76D8" : "\u6B63\u5E38\u8FD0\u4F5C"
      };
    }
    function buildFundAccountFact(serial, random, runtime) {
      const city = pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
      const investorType = pickWeighted(runtime.profile.investorTypes || FUND_INVESTOR_TYPES, random) || FUND_INVESTOR_TYPES[0];
      const gender = serial % 2 === 0 ? "F" : "M";
      const birthDate = new Date(1970 + serial % 25, serial % 12, serial % 27 + 1);
      const investorName = investorType.code === "PERSONAL" ? `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u660E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u60A6"}` : `${pickOne(["\u534E\u4FE1", "\u91D1\u745E", "\u542F\u660E", "\u878D\u6CF0", "\u661F\u6865"], random) || "\u534E\u4FE1"}\u6295\u8D44${serial % 9 + 1}\u53F7`;
      const openTime = new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(60, 2400, random) * 24 * 60 * 60 * 1e3);
      return {
        id: serial,
        accountNo: `FA${padNumber(2e5 + serial, 6)}`,
        investorName,
        investorType: investorType.code,
        certificateType: investorType.code === "PERSONAL" ? "ID_CARD" : "UNIFIED_SOCIAL_CREDIT_CODE",
        certificateNo: investorType.code === "PERSONAL" ? buildMainlandIdCard(city.code, birthDate, 91e4 + serial, gender) : `91310${String(1e8 + serial).slice(-9)}`,
        mobile: buildMainlandMobile(91e4 + serial, random, MAINLAND_CONSERVATIVE_MOBILE_PREFIXES),
        email: buildDomesticEmail(91e4 + serial, random, "fund"),
        provinceCode: city.code,
        provinceName: city.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: `${city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
        districtName: pickOne(city.districts, random) || city.name,
        openChannel: pickWeighted(runtime.profile.tradeChannels || FUND_TRADE_CHANNELS, random)?.code || "APP",
        riskAssessmentLevel: pickWeighted(runtime.profile.fundRiskLevels || FUND_RISK_LEVELS, random)?.code || "R3",
        openTime,
        lastTradeTime: shiftTime(openTime, randomIntBetween(10 * 24 * 60, 800 * 24 * 60, random)),
        totalHoldingAmount: randomNumberBetween(2e4, investorType.code === "PERSONAL" ? 8e6 : 15e7, random),
        availableBalance: randomNumberBetween(1e3, investorType.code === "PERSONAL" ? 3e6 : 3e7, random),
        frozenAmount: randomNumberBetween(0, investorType.code === "PERSONAL" ? 2e5 : 5e6, random),
        accountStatus: serial % 37 === 0 ? "DORMANT" : "ACTIVE"
      };
    }
    function buildFundSubscriptionFact(serial, random, runtime, startedAt) {
      const fund = pickFactByIndex(runtime.fundProductFacts, serial - 1) || buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
      const account = pickFactByIndex(runtime.fundAccountFacts, serial - 1) || buildFundAccountFact(serial, random, runtime);
      const orderStatus = pickWeighted(runtime.profile.orderStatuses || FUND_ORDER_STATUS, random) || FUND_ORDER_STATUS[0];
      const applyAmount = randomNumberBetween(1e3, account.investorType === "PERSONAL" ? 2e5 : 5e6, random);
      const applyNav = randomNumberBetween(0.9, 3.5, random, 4);
      const confirmShare = Number((applyAmount / Math.max(applyNav, 0.01)).toFixed(2));
      const applyTime = new Date(startedAt.getTime() - serial * 7 * 60 * 60 * 1e3);
      return {
        id: serial,
        fund,
        account,
        subscriptionNo: `SUB${String(3e8 + serial)}`,
        channelCode: pickWeighted(runtime.profile.tradeChannels || FUND_TRADE_CHANNELS, random)?.code || "APP",
        applyTime,
        confirmTime: shiftTime(applyTime, randomIntBetween(4 * 60, 48 * 60, random)),
        settlementTime: shiftTime(applyTime, randomIntBetween(1 * 24 * 60, 3 * 24 * 60, random)),
        applyAmount,
        confirmAmount: Number((applyAmount * randomNumberBetween(0.98, 1, random, 4)).toFixed(2)),
        subscriptionFee: Number((applyAmount * randomNumberBetween(1e-3, 0.015, random, 4)).toFixed(2)),
        confirmShare,
        applyNav,
        orderStatus: orderStatus.code,
        paymentStatus: orderStatus.code === "FAILED" ? "FAILED" : orderStatus.code === "CANCELLED" ? "CANCELLED" : "SUCCESS",
        sourceSystem: pickOne(["\u57FA\u91D1\u76F4\u9500\u5E73\u53F0", "\u94F6\u884C\u4EE3\u9500\u6E20\u9053", "\u8D22\u5BCC\u7BA1\u7406\u5E73\u53F0"], random) || "\u57FA\u91D1\u76F4\u9500\u5E73\u53F0",
        salesAgent: pickOne(["\u76F4\u9500\u67DC\u53F0", "\u94F6\u884C\u6E20\u9053", "\u7B2C\u4E09\u65B9\u4EE3\u9500"], random) || "\u76F4\u9500\u67DC\u53F0",
        remark: `${fund.fundCode}\u7533\u8D2D\u4EA4\u6613`
      };
    }
    function buildFundRedemptionFact(serial, random, runtime, startedAt) {
      const fund = pickFactByIndex(runtime.fundProductFacts, serial - 1) || buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
      const account = pickFactByIndex(runtime.fundAccountFacts, serial - 1) || buildFundAccountFact(serial, random, runtime);
      const orderStatus = pickWeighted(runtime.profile.orderStatuses || FUND_ORDER_STATUS, random) || FUND_ORDER_STATUS[1];
      const applyShare = randomNumberBetween(100, account.investorType === "PERSONAL" ? 1e5 : 3e6, random, 2);
      const exitNav = randomNumberBetween(0.9, 3.5, random, 4);
      const applyTime = new Date(startedAt.getTime() - serial * 9 * 60 * 60 * 1e3);
      return {
        id: serial,
        fund,
        account,
        redemptionNo: `RED${String(4e8 + serial)}`,
        applyTime,
        confirmTime: shiftTime(applyTime, randomIntBetween(4 * 60, 72 * 60, random)),
        paymentTime: shiftTime(applyTime, randomIntBetween(2 * 24 * 60, 6 * 24 * 60, random)),
        applyShare,
        confirmShare: Number((applyShare * randomNumberBetween(0.98, 1, random, 4)).toFixed(2)),
        confirmAmount: Number((applyShare * exitNav).toFixed(2)),
        feeAmount: Number((applyShare * exitNav * randomNumberBetween(5e-4, 0.01, random, 4)).toFixed(2)),
        exitNav,
        holdingDays: randomIntBetween(5, 1200, random),
        orderStatus: orderStatus.code,
        paymentStatus: orderStatus.code === "FAILED" ? "FAILED" : "SUCCESS",
        bankAccountMask: `****${String(1e3 + serial).slice(-4)}`,
        remark: `${fund.fundCode}\u8D4E\u56DE\u4EA4\u6613`
      };
    }
    function buildFundNavFact(serial, random, runtime, startedAt) {
      const fund = pickFactByIndex(runtime.fundProductFacts, serial - 1) || buildFundProductFact(serial, random, runtime.profile, getRuntimeBaseTime(runtime));
      const navDate = new Date(startedAt.getTime() - serial * 24 * 60 * 60 * 1e3);
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
        accNav: randomNumberBetween(1, 8.5, random, 4),
        dailyChangeRate: randomNumberBetween(-4.8, 4.8, random, 4),
        subscriptionScale,
        redemptionScale,
        netInflowAmount: Number((subscriptionScale - redemptionScale).toFixed(2)),
        totalAssetAmount: randomNumberBetween(4e8, 8e10, random),
        stockPositionRatio,
        bondPositionRatio,
        cashRatio,
        holderCount: randomIntBetween(500, 18e4, random),
        pricingStatus: "\u5DF2\u786E\u8BA4"
      };
    }
    function buildFundTradeFlowFact(serial, random, runtime, startedAt) {
      const subscription = pickFactByIndex(runtime.fundSubscriptionFacts, serial - 1);
      const redemption = pickFactByIndex(runtime.fundRedemptionFacts, serial - 1);
      const isRedemptionFlow = Boolean(redemption && serial % 2 === 0);
      const resolvedTradeType = isRedemptionFlow ? "\u8D4E\u56DE" : "\u7533\u8D2D";
      const resolvedReference = isRedemptionFlow ? redemption : subscription || buildFundSubscriptionFact(serial, random, runtime, startedAt);
      return {
        id: serial,
        fund: resolvedReference.fund,
        account: resolvedReference.account,
        tradeFlowNo: `TF${String(5e8 + serial)}`,
        tradeType: resolvedTradeType,
        channelCode: resolvedReference.channelCode || pickWeighted(runtime.profile.tradeChannels || FUND_TRADE_CHANNELS, random)?.code || "BANK",
        tradeTime: resolvedReference.applyTime,
        confirmTime: resolvedReference.confirmTime,
        tradeAmount: resolvedReference.confirmAmount || resolvedReference.applyAmount,
        tradeShare: resolvedReference.confirmShare,
        feeAmount: resolvedReference.subscriptionFee || resolvedReference.feeAmount || 0,
        postTradeHolding: randomNumberBetween(5e3, 2e7, random),
        tradeStatus: resolvedReference.orderStatus,
        operatorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738B"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B81"}`,
        sourceSystem: resolvedReference.sourceSystem || "\u9369\u6D2A\u567E\u9429\u64AE\u6522\u9A9E\u51B2\u5F74",
        remark: `${resolvedTradeType}\u6D41\u6C34`
      };
    }
    function buildLogisticsWaybillFact(serial, random, runtime, startedAt) {
      const city = pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
      const company = pickWeighted(runtime.profile.expressCompanies || LOGISTICS_EXPRESS_COMPANIES, random) || LOGISTICS_EXPRESS_COMPANIES[0];
      const transportMode = pickWeighted(runtime.profile.transportModes || LOGISTICS_TRANSPORT_MODES, random) || LOGISTICS_TRANSPORT_MODES[0];
      const status = pickWeighted(runtime.profile.waybillStatuses || LOGISTICS_WAYBILL_STATUS, random) || LOGISTICS_WAYBILL_STATUS[0];
      const createTime = new Date(startedAt.getTime() - serial * 3 * 60 * 60 * 1e3);
      return {
        id: serial,
        company,
        city,
        waybillNo: `${company.code}${String(6e8 + serial)}`,
        transportMode: transportMode.code,
        senderName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Li"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Na"}`,
        senderMobile: buildMainlandMobile(92e4 + serial, random),
        receiverName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Chen"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Wei"}`,
        receiverMobile: buildMainlandMobile(93e4 + serial, random),
        provinceCode: city.code,
        provinceName: city.name,
        cityCode: city.code,
        cityName: city.name,
        districtCode: `${city.code.slice(0, 4)}${String(serial % 90 + 10).padStart(2, "0")}`,
        districtName: pickOne(city.districts, random) || city.name,
        pickupAddress: `${city.name}${pickOne(city.districts, random) || city.name}${pickOne(["\u79D1\u6280\u8DEF", "\u4EBA\u6C11\u8DEF", "\u521B\u4E1A\u5927\u9053", "\u89E3\u653E\u8DEF"], random) || "\u79D1\u6280\u8DEF"}${serial % 90 + 1}\u53F7`,
        deliveryAddress: `${city.name}${pickOne(city.districts, random) || city.name}${pickOne(["\u5B66\u9662\u8DEF", "\u548C\u5E73\u8DEF", "\u65B0\u534E\u8DEF", "\u5EFA\u8BBE\u8DEF"], random) || "\u5B66\u9662\u8DEF"}${serial % 120 + 1}\u53F7`,
        weightKg: randomNumberBetween(0.2, 35, random, 2),
        volumeCm3: randomNumberBetween(200, 22e4, random, 2),
        freightAmount: randomNumberBetween(8, 380, random),
        waybillStatus: status.code,
        createTime,
        collectTime: shiftTime(createTime, randomIntBetween(15, 240, random)),
        deliveryDeadline: shiftTime(createTime, randomIntBetween(12 * 60, 96 * 60, random))
      };
    }
    function buildLogisticsPackageFact(serial, random, runtime) {
      const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, getRuntimeBaseTime(runtime));
      return {
        id: serial,
        waybill,
        packageNo: `${waybill.waybillNo}-${serial % 3 + 1}`,
        itemCategory: pickOne(["\u6570\u7801\u4EA7\u54C1", "\u65E5\u7528\u54C1", "\u98DF\u54C1", "\u6587\u4EF6\u8D44\u6599", "\u533B\u836F\u7528\u54C1"], random) || "\u65E5\u7528\u54C1",
        itemName: pickOne(["\u624B\u673A\u914D\u4EF6", "\u7B14\u8BB0\u672C\u7535\u8111", "\u96F6\u98DF\u793C\u76D2", "\u5408\u540C\u6587\u4EF6", "\u4FDD\u5065\u54C1"], random) || "\u624B\u673A\u914D\u4EF6",
        itemQuantity: randomIntBetween(1, 12, random),
        itemWeightKg: randomNumberBetween(0.1, 12, random, 2),
        declaredAmount: randomNumberBetween(50, 2e4, random),
        packageType: pickOne(["\u7EB8\u7BB1", "\u7F16\u7EC7\u888B", "\u6728\u7BB1", "\u6587\u4EF6\u5C01"], random) || "\u7EB8\u7BB1",
        fragileFlag: serial % 5 === 0 ? "\u662F" : "\u5426",
        temperatureRequire: pickOne(["\u5E38\u6E29", "\u51B7\u85CF", "\u51B7\u51BB"], random) || "\u5E38\u6E29",
        securityCheckStatus: "\u5DF2\u5B89\u68C0",
        insuranceFlag: serial % 4 === 0 ? "\u662F" : "\u5426",
        insuredAmount: serial % 4 === 0 ? randomNumberBetween(500, 5e3, random) : 0,
        remark: `${waybill.waybillNo}\u5305\u88F9\u660E\u7EC6`
      };
    }
    function buildLogisticsRouteFact(serial, random, runtime, options = {}) {
      const city = options.originCity || pickOne(runtime.profile.cities, random) || runtime.profile.cities[0];
      const mode = options.transportMode || pickWeighted(runtime.profile.transportModes || LOGISTICS_TRANSPORT_MODES, random) || LOGISTICS_TRANSPORT_MODES[0];
      const cityCandidates = (runtime.profile.cities || []).filter((item) => item.code !== city.code);
      const destination = mode.code === "SAME_CITY" ? city : options.destinationCity || pickOne(cityCandidates, random) || runtime.profile.cities[1] || city;
      const distanceKm = mode.code === "SAME_CITY" ? randomNumberBetween(3, 45, random, 1) : randomNumberBetween(80, 2400, random, 1);
      const plannedDurationHours = mode.code === "SAME_CITY" ? randomIntBetween(1, 8, random) : mode.code === "AIR" ? randomIntBetween(4, 16, random) : randomIntBetween(8, 72, random);
      const plannedStopCount = mode.code === "SAME_CITY" ? randomIntBetween(0, 3, random) : randomIntBetween(1, 8, random);
      const routeLevel = mode.code === "SAME_CITY" ? "\u672B\u7AEF\u914D\u9001" : pickOne(["\u5E72\u7EBF", "\u652F\u7EBF"], random) || "\u5E72\u7EBF";
      return {
        id: serial,
        routeCode: `RT${padNumber(7e5 + serial, 6)}`,
        routeName: `${city.name}-${destination.name}-${mode.label}`,
        originSite: `${city.name}\u5206\u62E8\u4E2D\u5FC3`,
        destinationSite: `${destination.name}\u914D\u9001\u4E2D\u5FC3`,
        transportMode: mode.code,
        sortCenterName: `${pickOne([city.name, destination.name], random)}\u96C6\u6563\u4E2D\u5FC3`,
        distanceKm,
        plannedDurationHours,
        plannedStopCount,
        routeLevel,
        routeStatus: "\u542F\u7528",
        effectiveTime: new Date(getRuntimeBaseTime(runtime).getTime() - randomIntBetween(30, 540, random) * 24 * 60 * 60 * 1e3),
        expireTime: new Date(getRuntimeBaseTime(runtime).getTime() + randomIntBetween(120, 720, random) * 24 * 60 * 60 * 1e3),
        remark: "\u6807\u51C6\u7269\u6D41\u7EBF\u8DEF"
      };
    }
    function buildLogisticsTransferFact(serial, random, runtime, startedAt) {
      const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, startedAt);
      const preferredMode = (runtime.profile.transportModes || LOGISTICS_TRANSPORT_MODES).find((item) => item.code === waybill.transportMode) || { code: waybill.transportMode, label: waybill.transportMode };
      const route = pickFactByIndex(runtime.logisticsRouteFacts, serial - 1) || buildLogisticsRouteFact(serial, random, runtime, {
        originCity: waybill.city,
        destinationCity: preferredMode.code === "SAME_CITY" ? waybill.city : void 0,
        transportMode: preferredMode
      });
      const arriveTime = new Date(startedAt.getTime() - serial * 2 * 60 * 60 * 1e3);
      return {
        id: serial,
        waybill,
        route,
        transferNo: `TR${String(8e8 + serial)}`,
        currentSite: route.originSite,
        nextSite: route.destinationSite,
        transportMode: route.transportMode,
        scanType: pickOne(["\u5230\u8FBE\u626B\u63CF", "\u53D1\u51FA\u626B\u63CF", "\u5206\u62E3\u626B\u63CF"], random) || "\u5230\u8FBE\u626B\u63CF",
        arriveTime,
        departTime: shiftTime(arriveTime, randomIntBetween(20, 360, random)),
        stayMinutes: randomIntBetween(20, 360, random),
        transferStatus: pickOne(["\u5DF2\u5B8C\u6210", "\u5F85\u53D1\u8FD0", "\u5DF2\u88C5\u8F66"], random) || "\u5DF2\u5B8C\u6210",
        operatorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u8D75"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u96F7"}`,
        vehicleNo: `VH${padNumber(1e3 + serial, 5)}`,
        remark: `${waybill.waybillNo}\u4E2D\u8F6C\u8BB0\u5F55`
      };
    }
    function buildLogisticsSignFact(serial, random, runtime, startedAt) {
      const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, startedAt);
      const outboundTime = new Date(startedAt.getTime() - serial * 90 * 60 * 1e3);
      const signStatusOptions = waybill.waybillStatus === "EXCEPTION" ? ["\u7B7E\u6536\u5931\u8D25"] : ["\u5DF2\u7B7E\u6536", "\u5BA2\u6237\u81EA\u63D0", "\u7B7E\u6536\u5931\u8D25"];
      const resolvedSignStatus = pickOne(signStatusOptions, random) || signStatusOptions[0];
      const failedSign = resolvedSignStatus === "\u7B7E\u6536\u5931\u8D25";
      const deliverTime = shiftTime(outboundTime, randomIntBetween(15, 480, random));
      const signStatus = waybill.waybillStatus === "EXCEPTION" ? "\u7B7E\u6536\u5931\u8D25" : pickOne(["\u5DF2\u7B7E\u6536", "\u5BA2\u6237\u81EA\u63D0", "\u7B7E\u6536\u5931\u8D25"], random) || "\u5DF2\u7B7E\u6536";
      return {
        id: serial,
        waybill,
        signNo: `SG${String(9e8 + serial)}`,
        courierName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5B59"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u9E4F"}`,
        courierMobile: buildMainlandMobile(94e4 + serial, random),
        outboundTime,
        deliverTime: shiftTime(outboundTime, randomIntBetween(15, 480, random)),
        signTime: signStatus === "\u7EDB\u70AC\u6579\u6FB6\u8FAB\u89E6" ? null : shiftTime(outboundTime, randomIntBetween(20, 520, random)),
        signStatus,
        signerName: signStatus === "\u7EDB\u70AC\u6579\u6FB6\u8FAB\u89E6" ? "" : waybill.receiverName,
        signerRelation: pickOne(["\u672C\u4EBA", "\u5BB6\u5C5E", "\u524D\u53F0", "\u4FDD\u5B89"], random) || "\u672C\u4EBA",
        signMethod: pickOne(["\u62CD\u7167\u7B7E\u6536", "\u7535\u5B50\u7B7E\u540D", "\u9A8C\u8BC1\u7801\u7B7E\u6536"], random) || "\u62CD\u7167\u7B7E\u6536",
        deliverTime,
        signTime: failedSign ? null : shiftTime(deliverTime, randomIntBetween(10, 180, random)),
        signStatus: resolvedSignStatus,
        signerName: failedSign ? "" : waybill.receiverName,
        proofNo: `PF${padNumber(2e5 + serial, 6)}`,
        distanceToReceiverKm: randomNumberBetween(0.1, 28, random, 2),
        remark: `${waybill.waybillNo}\u7B7E\u6536\u8BB0\u5F55`
      };
    }
    function buildLogisticsExceptionFact(serial, random, runtime, startedAt) {
      const waybill = pickFactByIndex(runtime.logisticsWaybillFacts, serial - 1) || buildLogisticsWaybillFact(serial, random, runtime, startedAt);
      const exceptionType = pickWeighted(runtime.profile.exceptionTypes || LOGISTICS_EXCEPTION_TYPES, random) || LOGISTICS_EXCEPTION_TYPES[0];
      const discoverTime = new Date(startedAt.getTime() - serial * 4 * 60 * 60 * 1e3);
      return {
        id: serial,
        waybill,
        exceptionNo: `EX${String(1e8 + serial)}`,
        exceptionType: exceptionType.code,
        exceptionLevel: pickOne(["\u4E00\u822C", "\u91CD\u8981", "\u7D27\u6025"], random) || "\u91CD\u8981",
        responsibleSite: `${waybill.cityName}\u8425\u4E1A\u90E8`,
        discoverTime,
        closeTime: shiftTime(discoverTime, randomIntBetween(2 * 60, 72 * 60, random)),
        exceptionStatus: pickOne(["\u5F85\u5904\u7406", "\u5904\u7406\u4E2D", "\u5DF2\u5173\u95ED"], random) || "\u5904\u7406\u4E2D",
        customerFeedback: pickOne(["\u5EF6\u8BEF\u6295\u8BC9", "\u5730\u5740\u6709\u8BEF", "\u5305\u88F9\u7834\u635F", "\u8981\u6C42\u518D\u6B21\u6D3E\u9001"], random) || "\u5EF6\u8BEF\u6295\u8BC9",
        handlingOwner: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5218"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5F3A"}`,
        solutionType: pickOne(["\u91CD\u65B0\u6D3E\u9001", "\u8D54\u4ED8\u5904\u7406", "\u9000\u56DE\u5BC4\u4EF6\u65B9", "\u8054\u7CFB\u5BA2\u6237\u786E\u8BA4"], random) || "\u91CD\u65B0\u6D3E\u9001",
        compensationAmount: randomNumberBetween(0, 600, random),
        overtimeFlag: serial % 6 === 0 ? 1 : 0,
        remark: `${waybill.waybillNo}\u5F02\u5E38\u5DE5\u5355`
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
          status: fact.status
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
          account_status: fact.accountStatus
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
          remark: fact.remark
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
          remark: fact.remark
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
          pricing_status: fact.pricingStatus
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
          remark: fact.remark
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
          delivery_deadline: formatDateTime(fact.deliveryDeadline)
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
          remark: fact.remark
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
          remark: fact.remark
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
          remark: fact.remark
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
          remark: fact.remark
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
          remark: fact.remark
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
    function buildPostalCode(cityCode, serial) {
      const mapping = {
        "310000": 2e5,
        "320100": 21e4,
        "330100": 31e4,
        "440300": 518e3,
        "510100": 61e4
      };
      return padNumber((mapping[cityCode] || 1e5) + Number(serial || 0) % 200, 6);
    }
    function buildEducationCampusFact(serial, random, profile) {
      const city = pickOne(profile.cities, random) || profile.cities[0];
      const weightedSchoolTypes = applyWeightOverride(profile.schoolTypes || EDUCATION_SCHOOL_TYPES, getDistributionRuleConfig(profile, "school_type_ratio"));
      const schoolType = pickWeighted(weightedSchoolTypes, random) || weightedSchoolTypes[0] || EDUCATION_SCHOOL_TYPES[0];
      const stageOptions = Array.isArray(profile.educationStages) && profile.educationStages.length > 0 ? profile.educationStages : EDUCATION_STAGES;
      const stage = pickWeighted(stageOptions, random) || stageOptions[0] || EDUCATION_STAGES[0];
      const campusName = Array.isArray(profile.campusNames) && profile.campusNames.length > 0 ? profile.campusNames[(serial - 1) % profile.campusNames.length] : `${city.name}${pickOne(["\u5B9E\u9A8C", "\u80B2\u624D", "\u535A\u96C5", "\u661F\u6CB3", "\u6587\u6F9C"], random) || "\u5B9E\u9A8C"}${schoolType.label}`;
      return {
        id: serial,
        city,
        campusCode: `CAMP${city.code.slice(-4)}${padNumber(serial, 3)}`,
        schoolCode: `SCH${city.code.slice(0, 4)}${padNumber(serial, 5)}`,
        campusName,
        schoolName: campusName,
        schoolType: schoolType.code,
        educationStage: stage.code,
        districtCode: `${city.code.slice(0, 4)}${padNumber(serial % 90 + 10, 2)}`,
        districtName: pickOne(city.districts, random) || city.name,
        campusAddress: `${city.name}${pickOne(["\u6559\u80B2\u8DEF", "\u6587\u6C47\u8DEF", "\u5B66\u9662\u8DEF", "\u4E66\u9999\u5927\u9053", "\u80B2\u624D\u8DEF"], random) || "\u6559\u80B2\u8DEF"}${serial % 180 + 18}\u53F7`,
        postalCode: buildPostalCode(city.code, serial),
        officePhone: buildMainlandMobile(15e4 + serial, random),
        principalName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u674E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u660E"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u8F69"}`,
        principalMobile: buildMainlandMobile(5e5 + serial, random),
        supportHotline: buildMainlandMobile(16e4 + serial, random),
        capacityCount: randomIntBetween(800, 38e3, random),
        status: serial % 17 === 0 ? "SUSPENDED" : "ACTIVE",
        establishedAt: new Date(1995 + serial % 20, serial % 12, serial % 27 + 1),
        campusCardPrefix: `AC${city.code.slice(-2)}${padNumber(serial % 90, 2)}`,
        libraryCardPrefix: `LIB${city.code.slice(-2)}${padNumber(serial % 90, 2)}`
      };
    }
    function buildEducationStudentFact(serial, random, runtime) {
      const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
      const gender = serial % 2 === 0 ? "F" : "M";
      const familyName = pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u738B";
      const givenName = `${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u82E5"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B89"}`;
      const gradeOptions = Array.isArray(runtime.profile.gradeCodes) && runtime.profile.gradeCodes.length > 0 ? runtime.profile.gradeCodes : EDUCATION_GRADE_CODES;
      const stageSpecificGrades = gradeOptions.filter((item) => getEducationStageFromGrade(item.code) === campus.educationStage);
      const grade = pickWeighted(stageSpecificGrades.length > 0 ? stageSpecificGrades : gradeOptions, random) || gradeOptions[0];
      const gradeOffset = getEducationGradeOffset(grade.code);
      const entranceYear = 2026 - gradeOffset;
      const expectedGraduationYear = entranceYear + (campus.educationStage === "PRIMARY" ? 6 : campus.educationStage === "JUNIOR" ? 3 : campus.educationStage === "HIGH" ? 3 : campus.educationStage === "UNDERGRAD" ? 4 : 2);
      const ageBase = campus.educationStage === "PRIMARY" ? 7 : campus.educationStage === "JUNIOR" ? 13 : campus.educationStage === "HIGH" ? 16 : campus.educationStage === "UNDERGRAD" ? 19 : 23;
      const birthDate = new Date(2026 - ageBase, serial % 12, serial % 27 + 1);
      const classNo = padNumber(serial % 12 + 1, 2);
      const districtName = pickOne(campus.city.districts, random) || campus.city.name;
      return {
        id: serial,
        campus,
        studentNo: `STU${String(entranceYear)}${campus.campusCode.slice(-3)}${grade.code}${padNumber(serial % 900 + 100, 3)}`,
        studentName: `${familyName}${givenName}`,
        gender,
        birthDate,
        idCardNo: buildMainlandIdCard(campus.city.code, birthDate, serial, gender),
        studentMobile: buildMainlandMobile(2e5 + serial, random),
        studentEmail: buildDomesticEmail(serial, random, "student"),
        educationStage: campus.educationStage,
        gradeCode: grade.code,
        classCode: `${grade.code}${classNo}`,
        className: `${findOptionLabel(gradeOptions, grade.code, grade.code)} Class ${Number(classNo)}`,
        entranceYear,
        expectedGraduationYear,
        studentStatus: serial % 41 === 0 ? "LEAVE" : serial % 29 === 0 ? "SUSPENDED" : "ACTIVE",
        accessCardNo: `${campus.campusCardPrefix}${padNumber(1e4 + serial, 5)}`,
        libraryCardNo: `${campus.libraryCardPrefix}${padNumber(1e4 + serial, 5)}`,
        guardianName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u5F20"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u4F1F"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u534E"}`,
        guardianMobile: buildMainlandMobile(3e5 + serial, random),
        provinceCode: campus.city.code,
        provinceName: campus.city.name,
        cityCode: campus.city.code,
        cityName: campus.city.name,
        districtCode: campus.districtCode,
        districtName,
        homeAddress: `${campus.city.name}${districtName}${pickOne(["\u4E66\u9999\u82D1", "\u5B66\u5E9C\u91CC", "\u6587\u6F9C\u82B1\u56ED", "\u661F\u6CB3\u57CE", "\u9526\u7EE3\u5BB6\u56ED"], random) || "\u5B66\u5E9C\u91CC"}${serial % 20 + 1}\u680B${serial % 4 + 1}\u5355\u5143${serial % 260 + 101}\u5BA4`,
        postalCode: buildPostalCode(campus.city.code, serial)
      };
    }
    function buildEducationGuardianFact(serial, random, runtime) {
      const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
      const relationType = pickOne(["FATHER", "MOTHER", "GRANDFATHER", "GRANDMOTHER", "AUNT"], random) || "MOTHER";
      return {
        id: serial,
        student,
        guardianNo: `GDN${student.studentNo.slice(-8)}${padNumber(serial % 80 + 10, 2)}`,
        guardianName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "\u9648"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u4F73"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "\u5B81"}`,
        relationType,
        guardianMobile: buildMainlandMobile(4e5 + serial, random),
        guardianEmail: buildDomesticEmail(serial, random, "guardian"),
        emergencyPhone: buildMainlandMobile(14e4 + serial, random),
        occupationName: pickOne(["Civil Servant", "Teacher", "Engineer", "Operator", "Self-employed"], random) || "Engineer",
        companyName: `${pickOne(["\u667A\u8054\u79D1\u6280", "\u9526\u7A0B\u670D\u52A1", "\u8FDC\u822A\u8D38\u6613", "\u661F\u6CB3\u5B9E\u4E1A", "\u534E\u8A89\u5DE5\u7A0B"], random) || "\u667A\u6167\u670D\u52A1"}${serial % 8 + 1}`,
        provinceCode: student.provinceCode,
        provinceName: student.provinceName,
        cityCode: student.cityCode,
        cityName: student.cityName,
        districtCode: student.districtCode,
        districtName: student.districtName,
        addressDetail: student.homeAddress,
        primaryFlag: relationType === "MOTHER" || relationType === "FATHER" ? 1 : 0,
        messageChannel: pickOne(["SMS", "WECHAT", "APP"], random) || "WECHAT",
        lastContactTime: new Date(Date.now() - randomIntBetween(1, 45, random) * 24 * 60 * 60 * 1e3)
      };
    }
    function buildEducationStaffFact(serial, random, runtime) {
      const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
      const role = pickWeighted(runtime.profile.staffRoles || EDUCATION_STAFF_ROLES, random) || EDUCATION_STAFF_ROLES[0];
      const subject = pickWeighted(runtime.profile.subjectCodes || EDUCATION_SUBJECTS, random) || EDUCATION_SUBJECTS[0];
      const gender = serial % 2 === 0 ? "F" : "M";
      const birthDate = new Date(1976 + serial % 20, serial % 12, serial % 27 + 1);
      return {
        id: serial,
        campus,
        staffNo: `EMP${campus.campusCode.slice(-3)}${role.code.slice(0, 2)}${padNumber(1e4 + serial, 5)}`,
        staffName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Li"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ming"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yu"}`,
        gender,
        idCardNo: buildMainlandIdCard(campus.city.code, birthDate, 5e3 + serial, gender),
        staffMobile: buildMainlandMobile(6e5 + serial, random),
        staffEmail: buildDomesticEmail(serial, random, "staff"),
        roleCode: role.code,
        subjectCode: role.code === "TEACHER" || role.code === "COUNSELOR" ? subject.code : "GENERAL",
        titleName: role.code === "HEADMASTER" ? "Headmaster" : role.code === "TEACHER" ? pickOne(["Senior Teacher", "Associate Teacher", "Lecturer"], random) || "Lecturer" : pickOne(["Manager", "Officer", "Specialist"], random) || "Officer",
        departmentName: role.code === "FINANCE" ? "Finance Office" : role.code === "ACADEMIC_AFFAIRS" ? "Academic Affairs Office" : role.code === "LIBRARIAN" ? "Library" : role.code === "SECURITY" ? "Campus Security" : "Teaching Department",
        hireDate: new Date(2006 + serial % 14, serial % 12, serial % 27 + 1),
        employmentStatus: serial % 37 === 0 ? "LEAVE" : "ACTIVE",
        teacherLicenseNo: role.code === "TEACHER" ? `TLC${campus.city.code.slice(-4)}${padNumber(2e5 + serial, 6)}` : "",
        accessCardNo: `${campus.campusCardPrefix}${padNumber(5e4 + serial, 5)}`,
        officeLocation: `${pickOne(["Teaching Building A", "Teaching Building B", "Innovation Center", "Admin Building"], random) || "Teaching Building A"}-${serial % 8 + 1}${String.fromCharCode(65 + serial % 6)}`,
        provinceCode: campus.city.code,
        provinceName: campus.city.name,
        cityCode: campus.city.code,
        cityName: campus.city.name,
        districtCode: campus.districtCode,
        districtName: campus.districtName,
        homeAddress: `${campus.city.name}${campus.districtName}${pickOne(["Scholar Garden", "Moonlight Court", "Lakeview Home", "Jade Residence"], random) || "Scholar Garden"}${serial % 18 + 1}\u680B${serial % 3 + 1}\u5355\u5143${serial % 200 + 101}\u5BA4`,
        postalCode: buildPostalCode(campus.city.code, serial),
        supervisorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Zhou"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Si"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Yuan"}`
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
        status: serial % 19 === 0 ? "PAUSED" : "ACTIVE"
      };
    }
    function buildEducationScheduleFact(serial, random, runtime, startedAt) {
      const course = pickFactByIndex(runtime.courseFacts, serial - 1) || buildEducationCourseFact(serial, random, runtime);
      const staff = pickFactByIndex(runtime.staffFacts, serial - 1) || buildEducationStaffFact(serial, random, runtime);
      const weekday = serial % 5 + 1;
      const sectionStart = serial % 5 + 1;
      const startHour = 8 + (sectionStart - 1) * 2;
      const startTime = new Date(startedAt.getTime() + weekday * 24 * 60 * 60 * 1e3 + startHour * 60 * 60 * 1e3);
      const endTime = new Date(startTime.getTime() + 90 * 60 * 1e3);
      return {
        id: serial,
        course,
        staff,
        scheduleNo: `SCD${course.termCode.replace(/_/g, "")}${padNumber(serial, 4)}`,
        termCode: course.termCode,
        gradeCode: course.gradeCode,
        classCode: `${course.gradeCode}${padNumber(serial % 10 + 1, 2)}`,
        className: `${findOptionLabel(runtime.profile.gradeCodes || EDUCATION_GRADE_CODES, course.gradeCode, course.gradeCode)} Class ${serial % 10 + 1}`,
        weekNo: serial % 18 + 1,
        weekdayNo: weekday,
        sectionStart,
        sectionEnd: sectionStart + 1,
        startTime,
        endTime,
        classroomCode: `RM${padNumber(serial % 80 + 100, 3)}`,
        classroomName: `${pickOne(["Teaching Building A", "Teaching Building B", "Science Building", "Library Annex"], random) || "Teaching Building A"}-${serial % 12 + 1}0${serial % 8 + 1}`,
        teachingMode: pickOne(["OFFLINE", "HYBRID", "ONLINE"], random) || "OFFLINE",
        attendanceRequired: 1,
        scheduleStatus: serial % 23 === 0 ? "RESCHEDULED" : "ACTIVE",
        generatedBy: "AUTO_ENGINE"
      };
    }
    function buildEducationEnrollmentFact(serial, random, runtime, startedAt) {
      const student = pickFactByIndex(runtime.studentFacts, serial - 1) || buildEducationStudentFact(serial, random, runtime);
      const staff = pickFactByIndex(runtime.staffFacts, serial - 1) || buildEducationStaffFact(serial, random, runtime);
      const academicYear = `${student.entranceYear}-${student.entranceYear + 1}`;
      const reportDate = new Date(startedAt.getTime() - randomIntBetween(5, 120, random) * 24 * 60 * 60 * 1e3);
      const graduationDate = new Date(student.expectedGraduationYear, 6, 1);
      return {
        id: serial,
        student,
        campus: student.campus,
        enrollmentNo: `ENR${student.studentNo.slice(-10)}${padNumber(serial % 80 + 10, 2)}`,
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
        dormitoryNo: student.educationStage === "UNDERGRAD" || student.educationStage === "POSTGRAD" ? `D${serial % 8 + 1}-${serial % 18 + 101}` : "",
        bedNo: student.educationStage === "UNDERGRAD" || student.educationStage === "POSTGRAD" ? String(serial % 6 + 1) : "",
        scholarshipFlag: serial % 9 === 0 ? 1 : 0,
        subsidyAmount: serial % 9 === 0 ? randomNumberBetween(1e3, 8e3, random) : 0,
        enrollmentDate: new Date(student.entranceYear, 8, 1),
        reportDate,
        graduationDate
      };
    }
    function buildEducationTuitionFact(serial, random, runtime, startedAt) {
      const enrollment = pickFactByIndex(runtime.enrollmentFacts, serial - 1) || buildEducationEnrollmentFact(serial, random, runtime, startedAt);
      const student = enrollment.student;
      const billStatus = pickWeighted(runtime.profile.billStatuses || EDUCATION_BILL_STATUS, random) || EDUCATION_BILL_STATUS[0];
      const schoolType = student.campus.schoolType;
      const baseAmount = schoolType === "PUBLIC_UNIVERSITY" ? randomNumberBetween(4800, 9800, random) : schoolType === "PRIVATE_K12" ? randomNumberBetween(12e3, 36e3, random) : randomNumberBetween(1800, 8600, random);
      const discountAmount = serial % 7 === 0 ? randomNumberBetween(200, 3200, random) : 0;
      const receivableAmount = Number(baseAmount.toFixed(2));
      const paidAmount = billStatus.code === "PAID" ? Number((receivableAmount - discountAmount).toFixed(2)) : billStatus.code === "PARTIAL" ? Number(((receivableAmount - discountAmount) * randomNumberBetween(0.2, 0.8, random, 4)).toFixed(2)) : 0;
      const dueTime = new Date(startedAt.getTime() + randomIntBetween(3, 50, random) * 24 * 60 * 60 * 1e3);
      const payTime = paidAmount > 0 ? new Date(dueTime.getTime() - randomIntBetween(0, 15, random) * 24 * 60 * 60 * 1e3) : null;
      return {
        id: serial,
        student,
        campus: student.campus,
        billNo: `FEE${student.campus.campusCode.slice(-3)}${String(2026e4 + serial)}`,
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
        invoiceNo: `INV${String(88e6 + serial)}`,
        dueTime,
        payTime,
        refundTime: billStatus.code === "REFUNDED" ? new Date((payTime || dueTime).getTime() + 5 * 24 * 60 * 60 * 1e3) : null,
        payerName: student.guardianName,
        payerMobile: student.guardianMobile,
        campusAccountNo: `EDU${student.campus.city.code.slice(-4)}${padNumber(1e5 + serial, 8)}`
      };
    }
    function buildEducationAccessFact(serial, random, runtime, startedAt) {
      const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
      const student = pickFactByIndex(runtime.studentFacts, serial - 1);
      const staff = pickFactByIndex(runtime.staffFacts, serial - 1);
      const useStaff = serial % 5 === 0 && staff;
      const holder = useStaff ? staff : student || staff || buildEducationStudentFact(serial, random, runtime);
      const holderType = useStaff ? "STAFF" : "STUDENT";
      const entryTime = new Date(startedAt.getTime() + randomIntBetween(1, 90, random) * 60 * 1e3);
      const stayMinutes = randomIntBetween(5, 720, random);
      const accessResult = pickWeighted(runtime.profile.accessResults || EDUCATION_ACCESS_RESULTS, random) || EDUCATION_ACCESS_RESULTS[0];
      return {
        id: serial,
        campus,
        accessNo: `ACS${campus.campusCode.slice(-3)}${String(7e5 + serial)}`,
        holderType,
        holderId: holder.id,
        cardNo: holder.accessCardNo || holder.libraryCardNo || `CARD${padNumber(serial, 8)}`,
        holderName: holder.studentName || holder.staffName || holder.guardianName,
        holderMobile: holder.studentMobile || holder.staffMobile || holder.guardianMobile || buildMainlandMobile(7e5 + serial, random),
        gateCode: `GATE${padNumber(serial % 18 + 1, 2)}`,
        gateName: pickOne(["North Gate", "South Gate", "Dormitory Gate", "Library Gate", "Teaching Gate"], random) || "North Gate",
        accessResult: accessResult.code,
        deviceCode: `DEV${campus.city.code.slice(-2)}${padNumber(serial % 90 + 10, 3)}`,
        entryTime,
        exitTime: accessResult.code === "DENY" ? null : new Date(entryTime.getTime() + stayMinutes * 60 * 1e3),
        stayMinutes: accessResult.code === "DENY" ? 0 : stayMinutes,
        alarmFlag: accessResult.code === "DENY" ? 1 : 0,
        dutyOfficer: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Gao"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Zhi"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Cheng"}`,
        remark: accessResult.code === "LATE" ? "Late arrival" : accessResult.code === "DENY" ? "Manual verification required" : "Normal access"
      };
    }
    function buildEducationLibraryFact(serial, random, runtime, startedAt) {
      const campus = pickFactByIndex(runtime.campusFacts, serial - 1) || buildEducationCampusFact(serial, random, runtime.profile);
      const student = pickFactByIndex(runtime.studentFacts, serial - 1);
      const staff = pickFactByIndex(runtime.staffFacts, serial - 1);
      const borrowerType = serial % 6 === 0 && staff ? "STAFF" : "STUDENT";
      const borrower = borrowerType === "STAFF" ? staff : student || staff || buildEducationStudentFact(serial, random, runtime);
      const borrowStatus = pickWeighted(runtime.profile.borrowStatuses || EDUCATION_BORROW_STATUS, random) || EDUCATION_BORROW_STATUS[0];
      const borrowTime = new Date(startedAt.getTime() - randomIntBetween(1, 40, random) * 24 * 60 * 60 * 1e3);
      const dueTime = new Date(borrowTime.getTime() + randomIntBetween(15, 45, random) * 24 * 60 * 60 * 1e3);
      const returnTime = borrowStatus.code === "RETURNED" ? new Date(borrowTime.getTime() + randomIntBetween(3, 30, random) * 24 * 60 * 60 * 1e3) : null;
      const overdueDays = borrowStatus.code === "OVERDUE" ? randomIntBetween(1, 20, random) : 0;
      const category = pickOne(["LITERATURE", "SCIENCE", "ENGINEERING", "HISTORY", "ARTS"], random) || "LITERATURE";
      return {
        id: serial,
        campus,
        borrowerType,
        borrowerId: borrower.id,
        borrowerName: borrower.studentName || borrower.staffName || "Reader",
        cardNo: borrower.libraryCardNo || borrower.accessCardNo || `LIB${padNumber(serial, 8)}`,
        borrowNo: `BOR${campus.campusCode.slice(-3)}${String(6e5 + serial)}`,
        isbnCode: `9787${padNumber(1e7 + serial, 8)}`,
        bookCode: `BK${padNumber(3e5 + serial, 6)}`,
        bookName: `${pickOne(["Data Science", "Modern History", "Advanced Mathematics", "Campus Literature", "Programming Practice"], random) || "Data Science"} Vol.${serial % 8 + 1}`,
        categoryCode: category,
        authorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Guo"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Xiao"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Ning"}`,
        publisherName: pickOne(["Education Press", "Campus Press", "Science Press", "University Press"], random) || "Education Press",
        borrowTime,
        dueTime,
        returnTime,
        borrowStatus: borrowStatus.code,
        renewCount: borrowStatus.code === "BORROWING" ? serial % 2 : borrowStatus.code === "OVERDUE" ? serial % 3 + 1 : serial % 2,
        overdueDays,
        fineAmount: overdueDays > 0 ? Number((overdueDays * 0.5).toFixed(2)) : 0,
        operatorName: `${pickOne(CUSTOMER_FAMILY_NAMES, random) || "Peng"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Shu"}${pickOne(CUSTOMER_GIVEN_NAMES, random) || "Lin"}`,
        shelfCode: `S${padNumber(serial % 18 + 1, 2)}-${String.fromCharCode(65 + serial % 6)}-${padNumber(serial % 80 + 10, 2)}`
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
          library_card_prefix: fact.libraryCardPrefix
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
          postal_code: fact.postalCode
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
          last_contact_time: formatDateTime(fact.lastContactTime)
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
          supervisor_name: fact.supervisorName
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
          course_status: fact.status
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
          generated_by: fact.generatedBy
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
          graduation_date: formatDateTime(fact.graduationDate)
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
          campus_account_no: fact.campusAccountNo
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
          remark: fact.remark
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
          shelf_code: fact.shelfCode
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
          remark: fact.remark
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
          remark: fact.remark
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
    module2.exports = {
      buildScenarioProfile,
      buildScenarioModulePlan,
      extractIndustryBusinessConcepts,
      extractKnowledgePlanningSignals,
      normalizeKnowledgePlanningSummary,
      createScenarioRuntime,
      generateScenarioRow
    };
  }
});

// backend/src/modules/data-lab/data-lab.incubation-asset-map.js
var require_data_lab_incubation_asset_map = __commonJS({
  "backend/src/modules/data-lab/data-lab.incubation-asset-map.js"(exports2, module2) {
    function uniqueStrings(values = []) {
      return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
    }
    var INDUSTRY_MODULE_ASSET_MAP = {
      ecommerce: {
        member_growth: {
          aliases: ["\u4F1A\u5458\u8FD0\u8425", "\u4F1A\u5458\u6CE8\u518C\u6A21\u5757", "\u9996\u5355\u8F6C\u5316\u6A21\u5757", "\u4F1A\u5458\u7B49\u7EA7\u6A21\u5757", "\u7528\u6237\u753B\u50CF\u6A21\u5757"],
          tables: ["customer_profile", "customer_address", "loyalty_account", "member_growth_task", "coupon_issue_record"],
          relations: ["customer_profile->customer_address", "customer_profile->loyalty_account", "customer_profile->coupon_issue_record"],
          dictSuggestions: ["member_level_dict", "register_channel_dict"],
          fieldSemantics: [
            { tableName: "loyalty_account", fieldName: "customer_id", fieldType: "BIGINT", fieldComment: "\u5BA2\u6237\u4E3B\u952E", businessSemantic: "FOREIGN_KEY", foreignKey: true, foreignRefTable: "customer_profile", foreignRefField: "customer_id", nullable: false },
            { tableName: "loyalty_account", fieldName: "loyalty_score", fieldType: "INT", fieldComment: "\u5FE0\u8BDA\u5EA6\u79EF\u5206", businessSemantic: "NUMBER", nullable: false }
          ]
        },
        promotion_event: {
          aliases: ["\u4FC3\u9500\u6D3B\u52A8\u7BA1\u7406", "\u4F18\u60E0\u5238\u7BA1\u7406\u4E0E\u53D1\u653E\u6A21\u5757", "\u4FC3\u9500\u6D3B\u52A8\u4FDD\u969C"],
          tables: ["marketing_campaign", "coupon_template", "coupon_issue_record", "promotion_rule_config"],
          relations: ["marketing_campaign->coupon_template", "coupon_template->coupon_issue_record"],
          dictSuggestions: ["promotion_type_dict"]
        },
        catalog_merchandise: {
          aliases: ["\u5546\u54C1\u76EE\u5F55\u7BA1\u7406\u6A21\u5757", "\u5546\u54C1\u76EE\u5F55"],
          tables: ["product_spu", "product_sku", "category_dict", "brand_dict"],
          relations: ["product_spu->product_sku"],
          dictSuggestions: ["category_dict", "brand_dict"],
          fieldSemantics: [
            { tableName: "product_spu", fieldName: "category_code", fieldType: "VARCHAR", fieldComment: "\u5546\u54C1\u7C7B\u76EE\u7F16\u7801", businessSemantic: "DICT_CATEGORY", nullable: false },
            { tableName: "product_sku", fieldName: "spu_id", fieldType: "BIGINT", fieldComment: "SPU\u4E3B\u952E", businessSemantic: "FOREIGN_KEY", foreignKey: true, foreignRefTable: "product_spu", foreignRefField: "spu_id", nullable: false }
          ]
        },
        warehouse_fulfillment: {
          aliases: ["\u5E93\u5B58\u7BA1\u7406\u6A21\u5757", "\u4ED3\u5E93\u7BA1\u7406\u6A21\u5757", "\u5E93\u5B58\u5C65\u7EA6", "\u4ED3\u914D\u5E93\u5B58\u534F\u540C", "\u591A\u4ED3\u5E93\u5B58\u534F\u540C"],
          tables: ["inventory_snapshot", "warehouse_info", "replenishment_order", "split_delivery_order"],
          relations: ["product_sku->inventory_snapshot", "warehouse_info->inventory_snapshot", "order_header->split_delivery_order"],
          dictSuggestions: ["inventory_status_dict", "warehouse_type_dict"]
        },
        live_stream: {
          aliases: ["\u76F4\u64AD\u95F4\u8BA2\u5355\u7BA1\u7406", "\u76F4\u64AD\u95F4\u5546\u54C1\u7BA1\u7406\u6A21\u5757", "\u76F4\u64AD\u8425\u9500\u4E92\u52A8\u8F6C\u5316"],
          tables: ["live_stream_session", "live_stream_anchor", "live_stream_interaction_log", "live_stream_goods_snapshot"],
          relations: ["merchant_store->live_stream_session", "live_stream_session->live_stream_interaction_log", "live_stream_session->live_stream_goods_snapshot"],
          dictSuggestions: ["live_platform_dict"]
        },
        payment_flow: {
          aliases: ["\u652F\u4ED8\u7F51\u5173\u96C6\u6210", "\u652F\u4ED8\u7ED3\u7B97", "\u652F\u4ED8\u98CE\u63A7\u51B3\u7B56\u7CFB\u7EDF"],
          tables: ["payment_record", "settlement_record", "payment_channel_dict"],
          relations: ["order_header->payment_record", "payment_record->settlement_record"],
          dictSuggestions: ["payment_channel_dict", "payment_status_dict"],
          fieldSemantics: [
            { tableName: "settlement_record", fieldName: "payment_id", fieldType: "BIGINT", fieldComment: "\u652F\u4ED8\u4E3B\u952E", businessSemantic: "FOREIGN_KEY", foreignKey: true, foreignRefTable: "payment_record", foreignRefField: "payment_id", nullable: false },
            { tableName: "settlement_record", fieldName: "settlement_time", fieldType: "DATETIME", fieldComment: "\u7ED3\u7B97\u65F6\u95F4", businessSemantic: "DATETIME", nullable: false }
          ]
        },
        enterprise_procurement: {
          aliases: ["\u4F01\u4E1A\u8D26\u6237\u7BA1\u7406", "\u4F01\u4E1A\u5BA2\u6237\u8868", "\u4F01\u4E1A\u529E\u516C\u7528\u54C1\u96C6\u91C7", "\u4F01\u4E1A\u5458\u5DE5\u798F\u5229\u91C7\u8D2D"],
          tables: ["enterprise_customer", "enterprise_procurement_order", "enterprise_payment_record", "contract_archive"],
          relations: ["enterprise_customer->enterprise_procurement_order", "enterprise_procurement_order->enterprise_payment_record"],
          dictSuggestions: ["enterprise_type_dict"]
        },
        invoice_center: {
          aliases: ["\u589E\u503C\u7A0E\u53D1\u7968\u7BA1\u7406", "\u53D1\u7968\u8868", "invoice_center"],
          tables: ["invoice_center", "invoice_issue_record"],
          relations: ["order_header->invoice_center", "invoice_center->invoice_issue_record"],
          dictSuggestions: ["invoice_status_dict"]
        },
        omnichannel_store: {
          aliases: ["\u95E8\u5E97\u8BA2\u5355\u5904\u7406", "\u95E8\u5E97\u4FE1\u606F\u8868", "\u95E8\u5E97\u81EA\u63D0"],
          tables: ["merchant_store", "store_pickup_order", "store_staff_profile"],
          relations: ["merchant_store->store_pickup_order"],
          dictSuggestions: ["store_type_dict"]
        },
        store_service: {
          aliases: ["\u7528\u6237\u5230\u5E97\u6838\u9500", "\u63D0\u8D27\u51ED\u8BC1\u7BA1\u7406", "\u81EA\u63D0\u5C65\u7EA6\u72B6\u6001\u8DDF\u8E2A\u6A21\u5757"],
          tables: ["store_pickup_verification", "pickup_service_record"],
          relations: ["store_pickup_order->store_pickup_verification", "store_pickup_verification->pickup_service_record"]
        },
        refund_after_sale: {
          aliases: ["\u9000\u8D27\u7533\u8BF7\u6A21\u5757", "\u552E\u540E\u5BA1\u6838\u4E0E\u5224\u5B9A", "\u9000\u6B3E\u5BA1\u6279\u6A21\u5757"],
          tables: ["refund_ticket", "after_sale_audit_record", "refund_approval_record"],
          relations: ["order_header->refund_ticket", "refund_ticket->after_sale_audit_record", "refund_ticket->refund_approval_record"],
          dictSuggestions: ["refund_reason_dict", "refund_status_dict"]
        },
        return_logistics: {
          aliases: ["\u9006\u5411\u7269\u6D41\u7BA1\u7406", "\u9006\u5411\u7269\u6D41\u8DDF\u8E2A\u6A21\u5757"],
          tables: ["reverse_logistics_order", "reverse_logistics_trace"],
          relations: ["refund_ticket->reverse_logistics_order", "reverse_logistics_order->reverse_logistics_trace"]
        },
        flash_sale: {
          aliases: ["\u79D2\u6740\u7CFB\u7EDF", "\u79D2\u6740\u6D3B\u52A8\u8868", "\u79D2\u6740\u8BA2\u5355\u8868"],
          tables: ["flash_sale_activity", "flash_sale_item", "flash_sale_order_record"],
          relations: ["flash_sale_activity->flash_sale_item", "flash_sale_item->flash_sale_order_record"]
        },
        risk_control: {
          aliases: ["\u98CE\u9669\u8BA2\u5355\u8BC6\u522B\u5F15\u64CE", "\u7528\u6237\u884C\u4E3A\u5206\u6790\u6A21\u5757", "\u5546\u6237\u4FE1\u7528\u8BC4\u4F30\u6A21\u5757"],
          tables: ["customer_risk_profile", "risk_rule_config", "risk_event_record"],
          relations: ["customer_profile->customer_risk_profile", "risk_rule_config->risk_event_record"]
        },
        delivery_mix: {
          aliases: ["\u5C65\u7EA6\u72B6\u6001\u8FFD\u8E2A\u4E0E\u9884\u8B66", "\u7269\u6D41\u72B6\u6001\u8DDF\u8E2A\u6A21\u5757", "\u672B\u7AEF\u7B7E\u6536\u4E0E\u5F02\u5E38\u5904\u7406"],
          tables: ["logistics_delivery", "delivery_sign_record", "delivery_exception_record"],
          relations: ["order_header->logistics_delivery", "logistics_delivery->delivery_sign_record", "logistics_delivery->delivery_exception_record"]
        },
        loyalty: {
          aliases: ["\u4F1A\u5458\u5FE0\u8BDA\u5EA6\u7BA1\u7406", "\u590D\u8D2D\u5468\u671F\u5206\u6790", "\u79EF\u5206\u4E0E\u6743\u76CA\u5151\u6362"],
          tables: ["loyalty_account", "customer_preference_tag", "member_benefit_exchange"],
          relations: ["customer_profile->loyalty_account", "customer_profile->customer_preference_tag", "loyalty_account->member_benefit_exchange"]
        }
      },
      traffic: {
        violation_processing: {
          aliases: ["\u8FDD\u6CD5\u5904\u7406", "\u8FDD\u6CD5\u6293\u62CD\u8BBE\u5907\u63A5\u5165\u6A21\u5757", "\u8FDD\u6CD5\u56FE\u50CF\u667A\u80FD\u8BC6\u522B\u6A21\u5757", "\u8FDD\u6CD5\u4FE1\u606F\u5BA1\u6838\u4E0E\u5F55\u5165\u6A21\u5757"],
          tables: ["violation_record", "violation_image_evidence", "violation_notice_record", "violation_code_dict"],
          relations: ["vehicle_archive->violation_record", "violation_record->violation_image_evidence", "violation_record->violation_notice_record"],
          dictSuggestions: ["violation_code_dict", "violation_status_dict"]
        },
        payment_reconcile: {
          aliases: ["\u7F5A\u6B3E\u5728\u7EBF\u652F\u4ED8\u4E0E\u5BF9\u8D26\u6A21\u5757", "\u7F5A\u6B3E\u7F34\u7EB3\u4E0E\u5BF9\u8D26"],
          tables: ["penalty_payment", "payment_reconcile_record", "payment_channel_dict"],
          relations: ["violation_record->penalty_payment", "penalty_payment->payment_reconcile_record"],
          dictSuggestions: ["payment_channel_dict"]
        },
        checkpoint_control: {
          aliases: ["\u5361\u53E3\u76D1\u7BA1", "\u5361\u53E3\u8BBE\u5907\u72B6\u6001\u76D1\u63A7", "\u8DEF\u68C0\u8DEF\u67E5", "\u73B0\u573A\u68C0\u67E5\u4E0E\u53D6\u8BC1"],
          tables: ["checkpoint_inspection", "checkpoint_info", "checkpoint_device_archive", "checkpoint_vehicle_pass_record"],
          relations: ["vehicle_archive->checkpoint_inspection", "checkpoint_info->checkpoint_inspection", "checkpoint_info->checkpoint_vehicle_pass_record"],
          dictSuggestions: ["inspection_result_dict"]
        },
        camera_network: {
          aliases: ["\u5361\u53E3\u89C6\u9891\u667A\u80FD\u5206\u6790\u6A21\u5757", "\u5E03\u63A7\u540D\u5355\u6BD4\u5BF9\u6A21\u5757"],
          tables: ["camera_network_node", "camera_capture_record", "control_warning_rule"],
          relations: ["camera_network_node->camera_capture_record", "control_warning_rule->camera_capture_record"]
        },
        document_service: {
          aliases: ["\u6267\u6CD5\u6587\u4E66\u751F\u6210\u4E0E\u7BA1\u7406\u6A21\u5757", "\u8FDD\u6CD5\u544A\u77E5\u4E0E\u6587\u4E66\u9001\u8FBE", "\u544A\u77E5\u6587\u4E66\u8868"],
          tables: ["enforcement_document", "notice_delivery_record", "document_archive_file"],
          relations: ["violation_record->enforcement_document", "enforcement_document->notice_delivery_record", "enforcement_document->document_archive_file"],
          dictSuggestions: ["document_type_dict"]
        },
        accident_case: {
          aliases: ["\u4E8B\u6545\u5904\u7F6E", "\u4E8B\u6545\u63A5\u8B66\u4E2D\u5FC3", "\u4E8B\u6545\u6848\u4EF6"],
          tables: ["accident_case", "accident_evidence_material", "accident_disposal_record"],
          relations: ["vehicle_archive->accident_case", "accident_case->accident_evidence_material", "accident_case->accident_disposal_record"]
        },
        dispatch_patrol: {
          aliases: ["\u5DE1\u903B\u6D3E\u5355", "\u8B66\u529B\u667A\u80FD\u8C03\u5EA6", "\u4EFB\u52A1\u6D3E\u53D1", "\u5DE1\u903B\u4EFB\u52A1"],
          tables: ["dispatch_task", "patrol_log", "patrol_team_schedule"],
          relations: ["accident_case->dispatch_task", "dispatch_task->patrol_log", "dispatch_task->patrol_team_schedule"]
        },
        night_shift: {
          aliases: ["\u591C\u95F4\u5DE1\u903B", "\u591C\u95F4\u5DE1\u903B\u4EFB\u52A1\u7BA1\u7406\u6A21\u5757", "\u591C\u95F4\u6392\u73ED"],
          tables: ["night_patrol_schedule", "night_patrol_event"],
          relations: ["patrol_team_schedule->night_patrol_schedule", "night_patrol_schedule->night_patrol_event"]
        },
        school_zone: {
          aliases: ["\u6821\u533A\u62A4\u5B66", "\u62A4\u5B66\u544A\u77E5\u6587\u4E66\u81EA\u52A8\u751F\u6210\u4E0E\u63A8\u9001\u6A21\u5757", "\u5B66\u6821\u4FE1\u606F\u8868"],
          tables: ["school_zone_info", "school_zone_control_record", "temporary_stop_inspection"],
          relations: ["school_zone_info->school_zone_control_record", "school_zone_control_record->temporary_stop_inspection"]
        },
        new_energy: {
          aliases: ["\u65B0\u80FD\u6E90\u76D1\u7BA1", "\u65B0\u80FD\u6E90\u8F66\u8F86\u5907\u6848\u767B\u8BB0\u6A21\u5757"],
          tables: ["new_energy_vehicle_filing", "battery_safety_inspection", "vehicle_pass_feature"],
          relations: ["vehicle_archive->new_energy_vehicle_filing", "new_energy_vehicle_filing->battery_safety_inspection"],
          dictSuggestions: ["new_energy_type_dict"]
        },
        vehicle_registration: {
          aliases: ["\u8F66\u8F86\u6863\u6848", "\u8F66\u8F86\u8BC6\u522B\u4E0E\u6293\u62CD\u6A21\u5757"],
          tables: ["owner_profile", "vehicle_archive", "registration_record"],
          relations: ["owner_profile->vehicle_archive", "vehicle_archive->registration_record"],
          dictSuggestions: ["vehicle_type_dict"]
        },
        driver_profile: {
          aliases: ["\u9A7E\u9A76\u5458\u6863\u6848\u7BA1\u7406", "\u9A7E\u9A76\u5458\u4FE1\u606F\u8868"],
          tables: ["driver_profile", "driver_license_record", "driver_risk_profile"],
          relations: ["owner_profile->driver_profile", "driver_profile->driver_license_record", "driver_profile->driver_risk_profile"]
        },
        road_safety: {
          aliases: ["\u91CD\u70B9\u8F66\u8F86\u52A8\u6001\u5E03\u63A7", "\u5386\u53F2\u8FDD\u6CD5\u9884\u8B66\u8054\u52A8", "\u5386\u53F2\u98CE\u9669\u753B\u50CF\u8868"],
          tables: ["key_vehicle_watchlist", "warning_event_record", "vehicle_risk_profile"],
          relations: ["vehicle_archive->key_vehicle_watchlist", "key_vehicle_watchlist->warning_event_record", "vehicle_archive->vehicle_risk_profile"]
        },
        appeal_trace: {
          aliases: ["\u7533\u8BC9\u590D\u6838", "\u7EBF\u4E0A\u7533\u8BC9\u53D7\u7406", "\u590D\u6838\u51B3\u5B9A\u4E0B\u8FBE", "\u6587\u4E66\u7535\u5B50\u5F52\u6863"],
          tables: ["appeal_application", "appeal_acceptance_record", "appeal_review_case", "review_evidence_material", "review_decision_notice", "document_revoke_record", "electronic_archive_file"],
          relations: ["violation_record->appeal_application", "appeal_application->appeal_acceptance_record", "appeal_acceptance_record->appeal_review_case", "appeal_review_case->review_evidence_material", "appeal_review_case->review_decision_notice", "review_decision_notice->document_revoke_record", "review_decision_notice->electronic_archive_file"],
          dictSuggestions: ["appeal_reason_dict", "review_result_dict"]
        },
        highway_ops: {
          aliases: ["\u9AD8\u901F\u7A3D\u67E5", "\u8D85\u9650\u8D85\u8F7D\u8F66\u8F86\u5165\u53E3\u62E6\u622A", "\u7A3D\u67E5\u8BB0\u5F55"],
          tables: ["highway_weight_check_record", "highway_entry_checkpoint", "overload_vehicle_record"],
          relations: ["vehicle_archive->highway_weight_check_record", "highway_entry_checkpoint->highway_weight_check_record", "highway_weight_check_record->overload_vehicle_record"]
        }
      }
    };
    var INDUSTRY_CHINESE_TABLE_ALIASES = {
      ecommerce: [
        [/会员(信息)?表|用户(信息)?表|客户(信息)?表/, "customer_profile"],
        [/收货地址表|地址信息表/, "customer_address"],
        [/门店信息表|商户门店表/, "merchant_store"],
        [/商品信息表|商品主表|商品表/, "product_spu"],
        [/商品sku表|sku表|商品明细表/, "product_sku"],
        [/库存表|商品库存表|门店库存表/, "inventory_snapshot"],
        [/仓库表|仓库主表/, "warehouse_info"],
        [/订单信息表|订单主表|订单表/, "order_header"],
        [/订单商品明细表|订单明细表|订单商品表/, "order_item"],
        [/支付(流水|记录)表/, "payment_record"],
        [/退款(记录|申请)表|退货申请单/, "refund_ticket"],
        [/物流(信息|记录|单)表|配送单表/, "logistics_delivery"],
        [/直播间表/, "live_stream_session"],
        [/主播表/, "live_stream_anchor"],
        [/直播互动(记录|日志)表/, "live_stream_interaction_log"],
        [/企业客户表/, "enterprise_customer"],
        [/采购订单表|企业订单表/, "enterprise_procurement_order"],
        [/发票表|开票中心表/, "invoice_center"],
        [/优惠券表/, "coupon_template"],
        [/会员等级表/, "member_level_dict"],
        [/分类字典表|商品分类表/, "category_dict"],
        [/支付渠道表/, "payment_channel_dict"],
        [/物流公司表/, "courier_company_dict"],
        [/自提履约单|核销记录表/, "store_pickup_verification"],
        [/售后审核记录/, "after_sale_audit_record"],
        [/逆向物流单/, "reverse_logistics_order"],
        [/秒杀活动表/, "flash_sale_activity"],
        [/秒杀商品表/, "flash_sale_item"],
        [/用户参与记录表/, "flash_sale_order_record"],
        [/账户画像表|风险画像表/, "customer_risk_profile"],
        [/风险规则表/, "risk_rule_config"],
        [/风险事件表/, "risk_event_record"],
        [/签收记录表/, "delivery_sign_record"],
        [/拆单规则表/, "split_delivery_order"],
        [/偏好标签表/, "customer_preference_tag"]
      ],
      traffic: [
        [/当事人信息表|驾驶员信息表|执勤人员|复核人员表/, "owner_profile"],
        [/涉案车辆信息表|车辆信息表|车辆档案|巡逻车辆|稽查车辆/, "vehicle_archive"],
        [/原始违法记录表|违法记录表/, "violation_record"],
        [/交通违法申诉申请表|申诉申请表|申诉记录表/, "appeal_application"],
        [/申诉受理登记表/, "appeal_acceptance_record"],
        [/复核案件立案表|复核记录表|复核案件表/, "appeal_review_case"],
        [/复核证据材料表|现场证据/, "review_evidence_material"],
        [/复核意见审批表/, "review_opinion_approval"],
        [/复核决定通知书|处罚决定表/, "review_decision_notice"],
        [/执法文书撤销记录表/, "document_revoke_record"],
        [/电子卷宗归档表|文书归档表|归档文件/, "electronic_archive_file"],
        [/复核流程日志表|处置记录/, "appeal_review_process_log"],
        [/通知送达记录表|告知记录表/, "notice_delivery_record"],
        [/复核机构信息表/, "review_agency_info"],
        [/常用违法代码字典表|违法代码表|违法行为代码表|违规类型字典/, "violation_code_dict"],
        [/支付渠道表/, "payment_channel_dict"],
        [/路口信息表|检查点信息表|卡口设备|稽查卡口/, "checkpoint_info"],
        [/车辆通行记录/, "checkpoint_vehicle_pass_record"],
        [/布控预警规则/, "control_warning_rule"],
        [/重点车辆名单/, "key_vehicle_watchlist"],
        [/布控任务表|布控预警/, "control_task"],
        [/核查任务/, "verification_task"],
        [/现场检查记录表|路检记录表|稽查记录|临停检查记录表/, "checkpoint_inspection"],
        [/执法文书表|告知文书表/, "enforcement_document"],
        [/事故案件/, "accident_case"],
        [/巡逻任务|任务派发|稽查任务/, "dispatch_task"],
        [/巡逻路线/, "patrol_route"],
        [/异常事件|预警事件表/, "warning_event_record"],
        [/巡逻班组|夜间排班/, "patrol_team_schedule"],
        [/学校信息表/, "school_zone_info"],
        [/交通管控记录表/, "school_zone_control_record"],
        [/新能源车辆备案表/, "new_energy_vehicle_filing"],
        [/通行特征表/, "vehicle_pass_feature"],
        [/车辆类型表/, "vehicle_type_dict"],
        [/历史风险画像表/, "vehicle_risk_profile"],
        [/稽查记录/, "highway_weight_check_record"],
        [/超限车辆/, "overload_vehicle_record"]
      ]
    };
    function findIndustryModuleAssets(industry, moduleKeyOrLabel) {
      const normalized = String(moduleKeyOrLabel || "").trim();
      if (!normalized) return null;
      const modules = INDUSTRY_MODULE_ASSET_MAP[String(industry || "").toLowerCase()] || {};
      for (const [moduleKey, assets] of Object.entries(modules)) {
        const aliases = uniqueStrings([moduleKey, ...Array.isArray(assets.aliases) ? assets.aliases : []]);
        if (aliases.some((item) => item === normalized)) {
          return { moduleKey, ...assets };
        }
        if (aliases.some((item) => normalized.includes(item) || item.includes(normalized))) {
          return { moduleKey, ...assets };
        }
      }
      return null;
    }
    function mapChineseResearchTableAlias(industry, rawLabel) {
      const label = String(rawLabel || "").trim();
      const rules = INDUSTRY_CHINESE_TABLE_ALIASES[String(industry || "").toLowerCase()] || [];
      for (const [pattern, target] of rules) {
        if (pattern.test(label)) {
          return target;
        }
      }
      return "";
    }
    module2.exports = {
      INDUSTRY_CHINESE_TABLE_ALIASES,
      INDUSTRY_MODULE_ASSET_MAP,
      findIndustryModuleAssets,
      mapChineseResearchTableAlias,
      uniqueStrings
    };
  }
});

// backend/src/modules/data-lab/data-lab.capability-normalizer.js
var require_data_lab_capability_normalizer = __commonJS({
  "backend/src/modules/data-lab/data-lab.capability-normalizer.js"(exports2, module2) {
    var incubationAssetMap = require_data_lab_incubation_asset_map();
    function asArray(value) {
      return Array.isArray(value) ? value : [];
    }
    function asObject(value, fallback = {}) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
    }
    function cleanString(value) {
      return String(value || "").trim();
    }
    function normalizeIdentifier(value, maxLength = 64) {
      return cleanString(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_").slice(0, maxLength);
    }
    function uniqueBy(items, keyResolver) {
      const map = /* @__PURE__ */ new Map();
      asArray(items).forEach((item) => {
        const key = keyResolver(item);
        if (!key) return;
        map.set(key, item);
      });
      return Array.from(map.values());
    }
    function normalizeStringList(value) {
      return uniqueBy(
        asArray(value).map((item) => cleanString(item)).filter(Boolean),
        (item) => item
      );
    }
    function normalizeSourceRefs(value) {
      return uniqueBy(
        asArray(value).map((item) => {
          if (typeof item === "string") {
            return cleanString(item);
          }
          if (item && typeof item === "object") {
            return cleanString(
              item.sourceRef || item.sourceUrl || item.id || item.title || item.evidenceRef || item.reference || item.standardTitle
            );
          }
          return "";
        }).filter(Boolean),
        (item) => item
      );
    }
    function normalizeRuleConfig(value, sourceRefs = []) {
      const config = Array.isArray(value) ? { values: value } : value && typeof value === "object" ? value : value !== void 0 && value !== null && value !== "" ? { value } : {};
      return {
        ...config,
        sourceRefs: normalizeSourceRefs(sourceRefs.length > 0 ? sourceRefs : config.sourceRefs)
      };
    }
    function normalizeTableName(industry, value) {
      const raw = cleanString(value);
      if (!raw) return "";
      const mapped = incubationAssetMap.mapChineseResearchTableAlias(industry, raw);
      if (mapped) {
        return mapped;
      }
      return normalizeIdentifier(raw, 48);
    }
    function normalizeFieldName(value) {
      const raw = cleanString(value);
      if (!raw) return "";
      return normalizeIdentifier(raw, 64) || raw;
    }
    function toOptionalString(value) {
      const normalized = cleanString(value);
      return normalized || null;
    }
    function buildTextRuleCode(prefix, text, index) {
      const normalized = normalizeIdentifier(text, 40);
      return `${prefix}_${normalized || index + 1}`;
    }
    function normalizeRelationPattern(industry, item) {
      if (!item) return null;
      if (typeof item === "string") {
        const text = cleanString(item);
        if (!text) return null;
        const matched = text.match(/(.+?)\s*(?:->|=>|→|鈫?)\s*(.+)/);
        return {
          fromTable: normalizeTableName(industry, matched?.[1] || ""),
          toTable: normalizeTableName(industry, matched?.[2] || ""),
          fromField: null,
          toField: null,
          relationType: "1:N",
          patternText: text
        };
      }
      if (typeof item !== "object") return null;
      const fromLabel = item.fromTable || item.parentTable || item.sourceTable || item.leftTable || "";
      const toLabel = item.toTable || item.childTable || item.targetTable || item.rightTable || "";
      const fromTable = normalizeTableName(industry, fromLabel);
      const toTable = normalizeTableName(industry, toLabel);
      const patternText = cleanString(
        item.patternText || item.description || item.ruleName || (fromLabel || toLabel ? `${cleanString(fromLabel)} -> ${cleanString(toLabel)}` : "")
      );
      if (!fromTable && !toTable && !patternText) {
        return null;
      }
      return {
        fromTable: fromTable || "",
        toTable: toTable || "",
        fromField: toOptionalString(item.fromField || item.parentKeyField || item.sourceField),
        toField: toOptionalString(item.toField || item.childForeignKeyField || item.targetField),
        relationType: cleanString(item.relationType || item.type || "1:N") || "1:N",
        patternText: patternText || null
      };
    }
    function normalizeRelationPatterns(industry, value) {
      return uniqueBy(
        asArray(value).map((item) => normalizeRelationPattern(industry, item)).filter(Boolean),
        (item) => [
          item.fromTable,
          item.toTable,
          item.fromField || "",
          item.toField || "",
          item.patternText || ""
        ].join("::")
      );
    }
    function normalizeFieldSemantic(item, industry) {
      if (!item || typeof item !== "object") return null;
      const fieldName = normalizeFieldName(item.fieldName || item.name);
      if (!fieldName) return null;
      return {
        tableName: normalizeTableName(industry, item.tableName || ""),
        fieldName,
        fieldType: cleanString(item.fieldType || item.dataType || "VARCHAR") || "VARCHAR",
        fieldComment: cleanString(item.fieldComment || item.comment || item.description) || null,
        businessSemantic: cleanString(item.businessSemantic || item.semantic || item.semanticType) || null,
        nullable: item.nullable !== false,
        primaryKey: Boolean(item.primaryKey),
        uniqueKey: Boolean(item.uniqueKey),
        foreignKey: Boolean(item.foreignKey),
        foreignRefTable: normalizeTableName(industry, item.foreignRefTable || item.refTable || ""),
        foreignRefField: toOptionalString(item.foreignRefField || item.refField),
        validationRule: toOptionalString(item.validationRule),
        dirtyRuleCandidates: normalizeStringList(item.dirtyRuleCandidates)
      };
    }
    function normalizeFieldSemantics(industry, value) {
      const items = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray(value.fields) ? value.fields : [];
      return uniqueBy(
        items.map((item) => normalizeFieldSemantic(item, industry)).filter(Boolean),
        (item) => `${item.tableName || "*"}::${item.fieldName}`
      );
    }
    function normalizeCodeRule(item, index) {
      if (!item) return null;
      if (typeof item === "string") {
        const text = cleanString(item);
        if (!text) return null;
        return {
          ruleCode: buildTextRuleCode("code_rule", text, index),
          ruleName: text.slice(0, 120),
          tableName: "",
          fieldName: "",
          description: text,
          ruleConfig: { description: text },
          status: "active"
        };
      }
      if (typeof item !== "object") return null;
      const ruleName = cleanString(item.ruleName || item.name || item.description);
      if (!ruleName) return null;
      const description = cleanString(item.description || item.ruleConfig?.description || ruleName);
      return {
        ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("code_rule", ruleName, index),
        ruleName,
        tableName: cleanString(item.tableName || ""),
        fieldName: cleanString(item.fieldName || item.targetField || item.ruleConfig?.targetField || ""),
        description: description || null,
        ruleConfig: asObject(item.ruleConfig, description ? { description } : {}),
        status: cleanString(item.status || "active") || "active"
      };
    }
    function normalizeCodeRules(value) {
      return uniqueBy(
        asArray(value).map((item, index) => normalizeCodeRule(item, index)).filter(Boolean),
        (item) => [item.ruleCode, item.tableName, item.fieldName, item.ruleName].join("::")
      );
    }
    function normalizeRealismRules(value) {
      const normalized = asArray(value).map((item) => {
        if (typeof item === "string") return cleanString(item);
        if (item && typeof item === "object") {
          return cleanString(item.ruleName || item.description || item.summary);
        }
        return "";
      }).filter(Boolean);
      return uniqueBy(normalized, (item) => item);
    }
    function normalizeFieldRule(item, industry) {
      if (!item || typeof item !== "object") return null;
      const fieldName = normalizeFieldName(item.fieldName);
      const generatorType = cleanString(item.generatorType);
      if (!fieldName || !generatorType) return null;
      const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
      return {
        ruleCode: cleanString(item.ruleCode) || null,
        tableName: normalizeTableName(industry, item.tableName || ""),
        fieldName,
        generatorType,
        sourceRefs,
        ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
        status: cleanString(item.status || "active") || "active"
      };
    }
    function normalizeFieldRules(industry, value) {
      return uniqueBy(
        asArray(value).map((item) => normalizeFieldRule(item, industry)).filter(Boolean),
        (item) => `${item.tableName || "*"}::${item.fieldName}::${item.generatorType}`
      );
    }
    function normalizeComplianceRule(item, index, industry) {
      if (!item || typeof item !== "object") return null;
      const ruleName = cleanString(item.ruleName || item.name || item.description);
      const fieldName = normalizeFieldName(item.fieldName);
      if (!ruleName || !fieldName) return null;
      const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
      return {
        ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("compliance_rule", ruleName, index),
        ruleName,
        tableName: normalizeTableName(industry, item.tableName || ""),
        fieldName,
        ruleType: cleanString(item.ruleType || "CUSTOM") || "CUSTOM",
        issueCategory: cleanString(item.issueCategory || "COMPLIANCE") || "COMPLIANCE",
        severity: cleanString(item.severity || "medium") || "medium",
        sourceRefs,
        ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
        status: cleanString(item.status || "active") || "active"
      };
    }
    function normalizeComplianceRules(industry, value) {
      return uniqueBy(
        asArray(value).map((item, index) => normalizeComplianceRule(item, index, industry)).filter(Boolean),
        (item) => `${item.ruleCode}::${item.tableName || "*"}::${item.fieldName}`
      );
    }
    function normalizeResearchTableSpec(industry, item) {
      if (!item) return null;
      if (typeof item === "string") {
        const tableName2 = normalizeTableName(industry, item);
        return tableName2 ? { tableName: tableName2, tableLabel: null, tableComment: null, sourceRefs: [] } : null;
      }
      if (typeof item !== "object") return null;
      const tableName = normalizeTableName(industry, item.tableName || item.name || "");
      if (!tableName) return null;
      return {
        tableName,
        tableLabel: cleanString(item.tableLabel || item.tableNameZh || item.label || item.nameZh) || null,
        tableComment: cleanString(item.tableComment || item.comment || item.description || item.summary) || null,
        sourceRefs: normalizeSourceRefs(item.sourceRefs || item.evidenceRefs)
      };
    }
    function normalizeDictSuggestionSpec(item) {
      if (!item) return null;
      if (typeof item === "string") {
        const dictType2 = cleanString(item);
        return dictType2 ? {
          dictType: dictType2,
          dictName: dictType2,
          tableName: dictType2.endsWith("_dict") ? dictType2 : `${dictType2}_dict`,
          tableComment: null,
          values: [],
          sourceRefs: []
        } : null;
      }
      if (typeof item !== "object") return null;
      const dictType = cleanString(item.dictType || item.tableName || item.dictName || item.name);
      if (!dictType) return null;
      return {
        dictType,
        dictName: cleanString(item.dictName || item.name || item.tableComment || item.tableName) || dictType,
        tableName: cleanString(item.tableName) || (dictType.endsWith("_dict") ? dictType : `${dictType}_dict`),
        tableComment: cleanString(item.tableComment || item.description) || null,
        values: asArray(item.values).map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }
          if (!entry || typeof entry !== "object") {
            return null;
          }
          return {
            itemCode: cleanString(entry.itemCode || entry.code) || null,
            itemLabel: cleanString(entry.itemLabel || entry.label || entry.name) || null,
            valueRange: cleanString(entry.valueRange || entry.range || entry.scope) || null
          };
        }).filter(Boolean),
        sourceRefs: normalizeSourceRefs(item.sourceRefs || item.evidenceRefs)
      };
    }
    function normalizeResearchCatalog(industry, value) {
      const catalog = asObject(value, {});
      return {
        ...catalog,
        industryLabel: toOptionalString(catalog.industryLabel),
        subdomain: toOptionalString(catalog.subdomain),
        businessObjects: normalizeStringList(catalog.businessObjects),
        businessActions: normalizeStringList(catalog.businessActions),
        businessResults: normalizeStringList(catalog.businessResults),
        canonicalModules: normalizeStringList(catalog.canonicalModules),
        candidateTables: uniqueBy(
          asArray(catalog.candidateTables).map((item) => normalizeTableName(industry, item)).filter(Boolean),
          (item) => item
        ),
        candidateTableSpecs: uniqueBy(
          asArray(catalog.candidateTableSpecs).map((item) => normalizeResearchTableSpec(industry, item)).filter(Boolean),
          (item) => item.tableName
        ),
        relationSuggestions: normalizeStringList(catalog.relationSuggestions),
        dictSuggestions: normalizeStringList(catalog.dictSuggestions),
        dictSuggestionSpecs: uniqueBy(
          asArray(catalog.dictSuggestionSpecs).map((item) => normalizeDictSuggestionSpec(item)).filter(Boolean),
          (item) => `${item.dictType}::${item.tableName}`
        )
      };
    }
    function normalizeDictionaryItem(item) {
      if (!item || typeof item !== "object") return null;
      const dictType = cleanString(item.dictType);
      const itemCode = cleanString(item.itemCode);
      const itemLabel = cleanString(item.itemLabel);
      if (!dictType || !itemCode || !itemLabel) return null;
      const itemValue = asObject(item.itemValue, {});
      const sourceRefs = normalizeSourceRefs(item.sourceRefs || itemValue.sourceRefs);
      return {
        dictType,
        categoryCode: cleanString(item.categoryCode || "") || null,
        categoryName: cleanString(item.categoryName || "") || null,
        itemCode,
        itemLabel,
        itemValue: {
          ...itemValue,
          sourceRefs
        },
        sourceRefs,
        weight: Number(item.weight ?? 1),
        sortOrder: Number(item.sortOrder ?? 0),
        status: cleanString(item.status || "active") || "active"
      };
    }
    function normalizeDictionaries(value) {
      return uniqueBy(
        asArray(value).map((item) => normalizeDictionaryItem(item)).filter(Boolean),
        (item) => `${item.dictType}::${item.categoryCode || "*"}::${item.itemCode}`
      );
    }
    function normalizeDistributionRule(item, index) {
      if (!item || typeof item !== "object") return null;
      const ruleType = cleanString(item.ruleType);
      const ruleName = cleanString(item.ruleName || item.name);
      if (!ruleType || !ruleName) return null;
      const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
      return {
        ruleType,
        ruleName,
        ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("distribution_rule", `${ruleType}_${ruleName}`, index),
        sourceRefs,
        ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
        status: cleanString(item.status || "active") || "active"
      };
    }
    function normalizeDistributionRules(value) {
      return uniqueBy(
        asArray(value).map((item, index) => normalizeDistributionRule(item, index)).filter(Boolean),
        (item) => `${item.ruleType}::${item.ruleCode}`
      );
    }
    function normalizeExtendedRule(item, index) {
      if (!item || typeof item !== "object") return null;
      const ruleCategory = cleanString(item.ruleCategory);
      const moduleKey = cleanString(item.moduleKey);
      const ruleName = cleanString(item.ruleName || item.name);
      if (!ruleCategory || !moduleKey || !ruleName) return null;
      const sourceRefs = normalizeSourceRefs(item.sourceRefs || item.ruleConfig?.sourceRefs);
      return {
        ruleCategory,
        moduleKey,
        ruleCode: cleanString(item.ruleCode) || buildTextRuleCode("extended_rule", `${moduleKey}_${ruleName}`, index),
        ruleName,
        industryScope: toOptionalString(item.industryScope),
        sceneScope: toOptionalString(item.sceneScope),
        tableName: toOptionalString(item.tableName),
        fieldName: toOptionalString(item.fieldName),
        sourceRefs,
        ruleConfig: normalizeRuleConfig(item.ruleConfig, sourceRefs),
        sortOrder: Number(item.sortOrder ?? 0),
        status: cleanString(item.status || "active") || "active"
      };
    }
    function normalizeExtendedRules(value) {
      return uniqueBy(
        asArray(value).map((item, index) => normalizeExtendedRule(item, index)).filter(Boolean),
        (item) => `${item.ruleCode}::${item.moduleKey}`
      );
    }
    function normalizeValueCorpora(value, industry) {
      const corpora = Array.isArray(value) ? { entries: value } : asObject(value, {});
      const entries = uniqueBy(
        asArray(corpora.entries).map((item) => {
          if (!item || typeof item !== "object") return null;
          const fieldName = normalizeFieldName(item.fieldName || item.field || item.fieldPath);
          if (!fieldName) return null;
          return {
            tableName: normalizeTableName(industry, item.tableName || item.table || ""),
            fieldName,
            values: asArray(Array.isArray(item.values) ? item.values : item.sampleValues).filter((entry) => entry !== null && entry !== void 0 && entry !== ""),
            sourceRefs: normalizeSourceRefs(item.sourceRefs || item.evidenceRefs || item.references)
          };
        }).filter(Boolean),
        (item) => `${item.tableName || "*"}::${item.fieldName}`
      );
      const fields = asObject(corpora.fields, {});
      const tableFields = asObject(corpora.tableFields, {});
      entries.forEach((entry) => {
        fields[entry.fieldName] = uniqueBy([...asArray(fields[entry.fieldName]), ...entry.values], (item) => JSON.stringify(item));
        if (entry.tableName) {
          tableFields[entry.tableName] = asObject(tableFields[entry.tableName], {});
          tableFields[entry.tableName][entry.fieldName] = uniqueBy(
            [...asArray(tableFields[entry.tableName][entry.fieldName]), ...entry.values],
            (item) => JSON.stringify(item)
          );
        }
      });
      return {
        ...corpora,
        entries,
        fields,
        tableFields
      };
    }
    function dedupeTrainingRounds(value) {
      return uniqueBy(
        asArray(value).filter((item) => item && typeof item === "object"),
        (item) => {
          const roundNo = item.roundNo || "";
          const roundName = item.roundName || "";
          const createdAt = item.createdAt || "";
          if (roundNo || roundName) {
            return `${roundNo}::${roundName}`;
          }
          return `${item.incubationId || ""}::${createdAt}`;
        }
      ).sort((left, right) => Number(left.roundNo || 0) - Number(right.roundNo || 0));
    }
    function normalizeTrainingAssets(value) {
      const assets = asObject(value, {});
      const incubationProject = asObject(assets.incubationProject, null);
      if (!incubationProject) {
        return assets;
      }
      return {
        ...assets,
        incubationProject: {
          ...incubationProject,
          rounds: dedupeTrainingRounds(incubationProject.rounds)
        }
      };
    }
    function normalizeScenarioEnhancementPayload(payload) {
      const industry = payload?.industry || "";
      return {
        ...payload,
        recognition: asObject(payload.recognition, {}),
        researchCatalog: normalizeResearchCatalog(industry, payload.researchCatalog),
        modulePlanner: asObject(payload.modulePlanner, {}),
        schemaGuides: asObject(payload.schemaGuides, {}),
        relationPatterns: normalizeRelationPatterns(industry, payload.relationPatterns),
        stateMachines: asArray(payload.stateMachines),
        codeRules: normalizeCodeRules(payload.codeRules),
        fieldSemantics: normalizeFieldSemantics(industry, payload.fieldSemantics),
        valueCorpora: normalizeValueCorpora(payload.valueCorpora, industry),
        distributionProfiles: asObject(payload.distributionProfiles, {}),
        qualityGates: asObject(payload.qualityGates, {}),
        realismRules: normalizeRealismRules(payload.realismRules),
        dirtyDataProfiles: asObject(payload.dirtyDataProfiles, {}),
        trainingAssets: normalizeTrainingAssets(payload.trainingAssets),
        evaluationRubric: asObject(payload.evaluationRubric, {}),
        overridePolicies: asObject(payload.overridePolicies, {}),
        dictionaries: normalizeDictionaries(payload.dictionaries),
        distributionRules: normalizeDistributionRules(payload.distributionRules),
        fieldRules: normalizeFieldRules(industry, payload.fieldRules),
        complianceRules: normalizeComplianceRules(industry, payload.complianceRules),
        pluginBindings: asArray(payload.pluginBindings),
        extendedRules: normalizeExtendedRules(payload.extendedRules)
      };
    }
    function mergeStringArrayUnique(base, extra) {
      return normalizeStringList([...asArray(base), ...asArray(extra)]);
    }
    module2.exports = {
      asArray,
      asObject,
      cleanString,
      dedupeTrainingRounds,
      mergeStringArrayUnique,
      normalizeCodeRules,
      normalizeComplianceRules,
      normalizeDictionaries,
      normalizeDistributionRules,
      normalizeExtendedRules,
      normalizeFieldRules,
      normalizeFieldSemantics,
      normalizeIdentifier,
      normalizeRealismRules,
      normalizeRelationPatterns,
      normalizeResearchCatalog,
      normalizeScenarioEnhancementPayload,
      normalizeSourceRefs,
      normalizeTableName,
      normalizeTrainingAssets,
      normalizeValueCorpora,
      uniqueBy
    };
  }
});

// backend/src/modules/data-lab/data-lab.enhancement.js
var require_data_lab_enhancement = __commonJS({
  "backend/src/modules/data-lab/data-lab.enhancement.js"(exports2, module2) {
    var { pool } = require_database();
    var AppError = require_app_error();
    var scenarioEngine = require_data_lab_scenario_engine();
    var capabilityNormalizer = require_data_lab_capability_normalizer();
    function safeJsonParse(value, fallback) {
      if (value === null || value === void 0 || value === "") {
        return fallback;
      }
      if (typeof value === "object") {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    }
    function normalizeCode(value, prefix) {
      const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
      return normalized || `${prefix}_${Date.now().toString().slice(-8)}`;
    }
    function safeObjectValue(value) {
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }
    function normalizeStringArray(value) {
      return Array.from(new Set(
        (Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean)
      ));
    }
    function normalizeLightweightModulePlanner(modulePlanner = {}, researchCatalog = {}) {
      const planner = safeObjectValue(modulePlanner);
      const categories = Array.isArray(planner.categories) ? planner.categories : Array.isArray(researchCatalog.categoryTree) ? researchCatalog.categoryTree : [];
      const modules = categories.map((item) => ({
        moduleKey: String(item.categoryCode || item.categoryName || "").trim(),
        moduleLabel: String(item.categoryName || item.categoryCode || "").trim(),
        summary: String(item.description || planner.summary || "").trim(),
        focusTables: normalizeStringArray(item.focusTables || item.tableScopes),
        focusTableDetails: Array.isArray(item.focusTableDetails) ? item.focusTableDetails : Array.isArray(item.tableDetails) ? item.tableDetails : [],
        expectedTables: normalizeStringArray(item.expectedTables || item.tableScopes || item.focusTables),
        hints: normalizeStringArray(item.sourceRefs)
      })).filter((item) => item.moduleKey);
      return {
        summary: String(planner.summary || researchCatalog.summary || "").trim(),
        categories,
        modules
      };
    }
    function mapProfileRow(row) {
      return capabilityNormalizer.normalizeScenarioEnhancementPayload({
        id: Number(row.id),
        profileName: row.profileName,
        profileCode: row.profileCode,
        industry: row.industry,
        subScenario: row.subScenario,
        profileDesc: row.profileDesc,
        locale: row.locale,
        businessStyle: row.businessStyle,
        confidenceThreshold: Number(row.confidenceThreshold || 0),
        priority: Number(row.priority || 0),
        status: row.status,
        recognition: safeJsonParse(row.recognition, {}),
        researchCatalog: safeJsonParse(row.researchCatalog, {}),
        modulePlanner: safeJsonParse(row.modulePlanner, {}),
        schemaGuides: safeJsonParse(row.schemaGuides, {}),
        relationPatterns: safeJsonParse(row.relationPatterns, []),
        stateMachines: safeJsonParse(row.stateMachines, []),
        codeRules: safeJsonParse(row.codeRules, []),
        fieldSemantics: safeJsonParse(row.fieldSemantics, []),
        valueCorpora: safeJsonParse(row.valueCorpora, {}),
        distributionProfiles: safeJsonParse(row.distributionProfiles, {}),
        qualityGates: safeJsonParse(row.qualityGates, {}),
        realismRules: safeJsonParse(row.realismRules, []),
        dirtyDataProfiles: safeJsonParse(row.dirtyDataProfiles, {}),
        trainingAssets: safeJsonParse(row.trainingAssets, {}),
        evaluationRubric: safeJsonParse(row.evaluationRubric, {}),
        overridePolicies: safeJsonParse(row.overridePolicies, {}),
        isSystem: Boolean(row.isSystem),
        createdBy: row.createdBy,
        dictionaryCount: row.dictionaryCount !== void 0 ? Number(row.dictionaryCount || 0) : void 0,
        distributionRuleCount: row.distributionRuleCount !== void 0 ? Number(row.distributionRuleCount || 0) : void 0,
        fieldRuleCount: row.fieldRuleCount !== void 0 ? Number(row.fieldRuleCount || 0) : void 0,
        complianceRuleCount: row.complianceRuleCount !== void 0 ? Number(row.complianceRuleCount || 0) : void 0,
        pluginBindingCount: row.pluginBindingCount !== void 0 ? Number(row.pluginBindingCount || 0) : void 0,
        extendedRuleCount: row.extendedRuleCount !== void 0 ? Number(row.extendedRuleCount || 0) : void 0,
        latestVersionNo: row.latestVersionNo !== void 0 && row.latestVersionNo !== null ? Number(row.latestVersionNo) : null,
        latestVersionStatus: row.latestVersionStatus || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      });
    }
    async function getProfileBase(id) {
      const [rows] = await pool.query(
        `SELECT id, profile_name AS profileName, profile_code AS profileCode, industry, sub_scenario AS subScenario,
            profile_desc AS profileDesc, locale, business_style AS businessStyle,
            confidence_threshold AS confidenceThreshold, priority, status,
            recognition_json AS recognition, research_catalog_json AS researchCatalog, module_planner_json AS modulePlanner,
            schema_guides_json AS schemaGuides, relation_patterns_json AS relationPatterns, state_machines_json AS stateMachines,
            code_rules_json AS codeRules, field_semantics_json AS fieldSemantics, value_corpora_json AS valueCorpora,
            distribution_profiles_json AS distributionProfiles, quality_gates_json AS qualityGates, realism_rules_json AS realismRules,
            dirty_data_profiles_json AS dirtyDataProfiles, training_assets_json AS trainingAssets,
            evaluation_rubric_json AS evaluationRubric, override_policies_json AS overridePolicies,
            is_system AS isSystem,
            created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_profile
     WHERE id = ?
     LIMIT 1`,
        [id]
      );
      const row = rows[0];
      if (!row) {
        throw new AppError("\u573A\u666F\u589E\u5F3A\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return mapProfileRow(row);
    }
    async function listScenarioEnhancements() {
      const [orderedRows] = await pool.query(
        `SELECT id
     FROM lab_scenario_profile
     ORDER BY priority ASC, updated_at DESC, id DESC`
      );
      const orderedIds = orderedRows.map((row) => Number(row.id)).filter(Boolean);
      if (orderedIds.length === 0) {
        return [];
      }
      const [rows] = await pool.query(
        `SELECT p.id, p.profile_name AS profileName, p.profile_code AS profileCode, p.industry,
            p.sub_scenario AS subScenario, p.profile_desc AS profileDesc, p.locale,
            p.business_style AS businessStyle, p.confidence_threshold AS confidenceThreshold,
            p.priority, p.status,
            p.recognition_json AS recognition, p.research_catalog_json AS researchCatalog,
            p.module_planner_json AS modulePlanner, p.training_assets_json AS trainingAssets,
            p.is_system AS isSystem, p.created_by AS createdBy,
            p.created_at AS createdAt, p.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM lab_scenario_dictionary d WHERE d.profile_id = p.id) AS dictionaryCount,
            (SELECT COUNT(*) FROM lab_scenario_distribution_rule r WHERE r.profile_id = p.id) AS distributionRuleCount,
            (SELECT COUNT(*) FROM lab_scenario_field_rule f WHERE f.profile_id = p.id) AS fieldRuleCount,
            (SELECT COUNT(*) FROM lab_scenario_compliance_rule c WHERE c.profile_id = p.id) AS complianceRuleCount,
            (SELECT COUNT(*) FROM lab_scenario_plugin_binding b WHERE b.profile_id = p.id) AS pluginBindingCount,
            (SELECT COUNT(*) FROM lab_scenario_extended_rule e WHERE e.profile_id = p.id) AS extendedRuleCount,
            (SELECT MAX(version_no) FROM lab_scenario_profile_version v WHERE v.profile_id = p.id) AS latestVersionNo,
            (SELECT version_status FROM lab_scenario_profile_version v WHERE v.profile_id = p.id ORDER BY version_no DESC LIMIT 1) AS latestVersionStatus
     FROM lab_scenario_profile p
     WHERE p.id IN (?)`,
        [orderedIds]
      );
      const rowMap = new Map(rows.map((row) => [Number(row.id), mapProfileRow(row)]));
      return orderedIds.map((id) => rowMap.get(id)).filter(Boolean);
    }
    async function listProfileDictionaries(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, dict_type AS dictType, item_code AS itemCode, item_label AS itemLabel,
            item_value_json AS itemValue, weight, sort_order AS sortOrder, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_dictionary
     WHERE profile_id = ?
     ORDER BY dict_type ASC, sort_order ASC, id ASC`,
        [profileId]
      );
      return rows.map((row) => {
        const normalized = capabilityNormalizer.normalizeDictionaries([{
          dictType: row.dictType,
          itemCode: row.itemCode,
          itemLabel: row.itemLabel,
          itemValue: safeJsonParse(row.itemValue, {}),
          weight: Number(row.weight || 0),
          sortOrder: Number(row.sortOrder || 0),
          status: row.status
        }])[0] || {};
        return {
          id: Number(row.id),
          profileId: Number(row.profileId),
          ...normalized,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      });
    }
    async function listDistributionRules(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, rule_type AS ruleType, rule_name AS ruleName, rule_code AS ruleCode,
            rule_config_json AS ruleConfig, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_distribution_rule
     WHERE profile_id = ?
     ORDER BY rule_type ASC, rule_name ASC, id ASC`,
        [profileId]
      );
      return rows.map((row) => {
        const normalized = capabilityNormalizer.normalizeDistributionRules([{
          ruleType: row.ruleType,
          ruleName: row.ruleName,
          ruleCode: row.ruleCode,
          ruleConfig: safeJsonParse(row.ruleConfig, {}),
          status: row.status
        }])[0] || {};
        return {
          id: Number(row.id),
          profileId: Number(row.profileId),
          ...normalized,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      });
    }
    async function listFieldRules(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, table_name AS tableName, field_name AS fieldName, generator_type AS generatorType,
            rule_config_json AS ruleConfig, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_field_rule
     WHERE profile_id = ?
     ORDER BY table_name ASC, field_name ASC, id ASC`,
        [profileId]
      );
      return rows.map((row) => {
        const normalized = capabilityNormalizer.normalizeFieldRules("", [{
          tableName: row.tableName,
          fieldName: row.fieldName,
          generatorType: row.generatorType,
          ruleConfig: safeJsonParse(row.ruleConfig, {}),
          status: row.status
        }])[0] || {};
        return {
          id: Number(row.id),
          profileId: Number(row.profileId),
          ...normalized,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      });
    }
    async function listComplianceRules(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, rule_code AS ruleCode, rule_name AS ruleName,
            table_name AS tableName, field_name AS fieldName, rule_type AS ruleType,
            rule_config_json AS ruleConfig, issue_category AS issueCategory, severity, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_compliance_rule
     WHERE profile_id = ?
     ORDER BY table_name ASC, field_name ASC, rule_name ASC, id ASC`,
        [profileId]
      );
      return rows.map((row) => {
        const normalized = capabilityNormalizer.normalizeComplianceRules("", [{
          ruleCode: row.ruleCode,
          ruleName: row.ruleName,
          tableName: row.tableName,
          fieldName: row.fieldName,
          ruleType: row.ruleType,
          ruleConfig: safeJsonParse(row.ruleConfig, {}),
          issueCategory: row.issueCategory,
          severity: row.severity,
          status: row.status
        }])[0] || {};
        return {
          id: Number(row.id),
          profileId: Number(row.profileId),
          ...normalized,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      });
    }
    async function listPluginBindings(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, plugin_key AS pluginKey, plugin_name AS pluginName,
            binding_scope AS bindingScope, binding_config_json AS bindingConfig, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_plugin_binding
     WHERE profile_id = ?
     ORDER BY plugin_key ASC, id ASC`,
        [profileId]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        profileId: Number(row.profileId),
        pluginKey: row.pluginKey,
        pluginName: row.pluginName,
        bindingScope: row.bindingScope,
        bindingConfig: safeJsonParse(row.bindingConfig, {}),
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    }
    async function listExtendedRules(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, rule_category AS ruleCategory, module_key AS moduleKey,
            rule_code AS ruleCode, rule_name AS ruleName, industry_scope AS industryScope,
            scene_scope AS sceneScope, table_name AS tableName, field_name AS fieldName,
            rule_config_json AS ruleConfig, sort_order AS sortOrder, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM lab_scenario_extended_rule
     WHERE profile_id = ?
     ORDER BY rule_category ASC, module_key ASC, sort_order ASC, id ASC`,
        [profileId]
      );
      return rows.map((row) => {
        const normalized = capabilityNormalizer.normalizeExtendedRules([{
          ruleCategory: row.ruleCategory,
          moduleKey: row.moduleKey,
          ruleCode: row.ruleCode,
          ruleName: row.ruleName,
          industryScope: row.industryScope || null,
          sceneScope: row.sceneScope || null,
          tableName: row.tableName || null,
          fieldName: row.fieldName || null,
          ruleConfig: safeJsonParse(row.ruleConfig, {}),
          sortOrder: Number(row.sortOrder || 0),
          status: row.status
        }])[0] || {};
        return {
          id: Number(row.id),
          profileId: Number(row.profileId),
          ...normalized,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      });
    }
    async function listProfileVersions(profileId) {
      const [rows] = await pool.query(
        `SELECT id, profile_id AS profileId, version_no AS versionNo, version_status AS versionStatus,
            snapshot_json AS snapshot, created_by AS createdBy, created_at AS createdAt
     FROM lab_scenario_profile_version
     WHERE profile_id = ?
     ORDER BY version_no DESC, id DESC`,
        [profileId]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        profileId: Number(row.profileId),
        versionNo: Number(row.versionNo || 0),
        versionStatus: row.versionStatus,
        snapshot: safeJsonParse(row.snapshot, {}),
        createdBy: row.createdBy,
        createdAt: row.createdAt
      }));
    }
    async function getScenarioEnhancementDetail(id) {
      const profile = await getProfileBase(id);
      const [dictionaries, distributionRules, fieldRules, complianceRules, pluginBindings, extendedRules, versions] = await Promise.all([
        listProfileDictionaries(id),
        listDistributionRules(id),
        listFieldRules(id),
        listComplianceRules(id),
        listPluginBindings(id),
        listExtendedRules(id),
        listProfileVersions(id)
      ]);
      return {
        ...profile,
        dictionaries,
        distributionRules,
        fieldRules,
        complianceRules,
        pluginBindings,
        extendedRules,
        versions
      };
    }
    function buildVersionSnapshot(profile, payload) {
      return {
        profile: {
          id: profile.id,
          profileName: payload.profileName,
          profileCode: profile.profileCode,
          industry: payload.industry,
          subScenario: payload.subScenario || null,
          profileDesc: payload.profileDesc || null,
          locale: payload.locale || "zh-CN",
          businessStyle: payload.businessStyle || payload.industry || "generic",
          confidenceThreshold: payload.confidenceThreshold ?? 0.6,
          priority: payload.priority ?? 100,
          status: payload.status || "draft",
          isSystem: Boolean(payload.isSystem)
        },
        recognition: payload.recognition || {},
        researchCatalog: payload.researchCatalog || {},
        modulePlanner: payload.modulePlanner || {},
        schemaGuides: payload.schemaGuides || {},
        relationPatterns: payload.relationPatterns || [],
        stateMachines: payload.stateMachines || [],
        codeRules: payload.codeRules || [],
        fieldSemantics: payload.fieldSemantics || [],
        valueCorpora: payload.valueCorpora || {},
        distributionProfiles: payload.distributionProfiles || {},
        qualityGates: payload.qualityGates || {},
        realismRules: payload.realismRules || [],
        dirtyDataProfiles: payload.dirtyDataProfiles || {},
        trainingAssets: payload.trainingAssets || {},
        evaluationRubric: payload.evaluationRubric || {},
        overridePolicies: payload.overridePolicies || {},
        dictionaries: payload.dictionaries || [],
        distributionRules: payload.distributionRules || [],
        fieldRules: payload.fieldRules || [],
        complianceRules: payload.complianceRules || [],
        pluginBindings: payload.pluginBindings || [],
        extendedRules: payload.extendedRules || []
      };
    }
    async function replaceProfileChildren(connection, tableName, profileId, rows, mapper) {
      await connection.query(`DELETE FROM ${tableName} WHERE profile_id = ?`, [profileId]);
      for (const row of rows || []) {
        const { sql, values } = mapper(row, profileId);
        await connection.query(sql, values);
      }
    }
    async function saveScenarioEnhancement(payload, user) {
      const normalizedPayload = capabilityNormalizer.normalizeScenarioEnhancementPayload(payload);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        let profileId = normalizedPayload.id ? Number(normalizedPayload.id) : null;
        const profileCode = normalizeCode(normalizedPayload.profileCode || normalizedPayload.profileName, "scenario_profile");
        if (profileId) {
          await getProfileBase(profileId);
          await connection.query(
            `UPDATE lab_scenario_profile
         SET profile_name = ?, profile_code = ?, industry = ?, sub_scenario = ?, profile_desc = ?,
             locale = ?, business_style = ?, confidence_threshold = ?, priority = ?, status = ?,
             recognition_json = ?, research_catalog_json = ?, module_planner_json = ?, schema_guides_json = ?,
             relation_patterns_json = ?, state_machines_json = ?, code_rules_json = ?, field_semantics_json = ?,
             value_corpora_json = ?, distribution_profiles_json = ?, quality_gates_json = ?, realism_rules_json = ?,
             dirty_data_profiles_json = ?, training_assets_json = ?, evaluation_rubric_json = ?, override_policies_json = ?,
             is_system = ?
         WHERE id = ?`,
            [
              normalizedPayload.profileName,
              profileCode,
              normalizedPayload.industry,
              normalizedPayload.subScenario || null,
              normalizedPayload.profileDesc || null,
              normalizedPayload.locale || "zh-CN",
              normalizedPayload.businessStyle || normalizedPayload.industry || "generic",
              normalizedPayload.confidenceThreshold ?? 0.6,
              normalizedPayload.priority ?? 100,
              normalizedPayload.status || "draft",
              JSON.stringify(normalizedPayload.recognition || {}),
              JSON.stringify(normalizedPayload.researchCatalog || {}),
              JSON.stringify(normalizedPayload.modulePlanner || {}),
              JSON.stringify(normalizedPayload.schemaGuides || {}),
              JSON.stringify(normalizedPayload.relationPatterns || []),
              JSON.stringify(normalizedPayload.stateMachines || []),
              JSON.stringify(normalizedPayload.codeRules || []),
              JSON.stringify(normalizedPayload.fieldSemantics || []),
              JSON.stringify(normalizedPayload.valueCorpora || {}),
              JSON.stringify(normalizedPayload.distributionProfiles || {}),
              JSON.stringify(normalizedPayload.qualityGates || {}),
              JSON.stringify(normalizedPayload.realismRules || []),
              JSON.stringify(normalizedPayload.dirtyDataProfiles || {}),
              JSON.stringify(normalizedPayload.trainingAssets || {}),
              JSON.stringify(normalizedPayload.evaluationRubric || {}),
              JSON.stringify(normalizedPayload.overridePolicies || {}),
              normalizedPayload.isSystem ? 1 : 0,
              profileId
            ]
          );
        } else {
          const [result] = await connection.query(
            `INSERT INTO lab_scenario_profile
          (profile_name, profile_code, industry, sub_scenario, profile_desc, locale, business_style,
           confidence_threshold, priority, status, recognition_json, research_catalog_json, module_planner_json, schema_guides_json,
           relation_patterns_json, state_machines_json, code_rules_json, field_semantics_json, value_corpora_json,
           distribution_profiles_json, quality_gates_json, realism_rules_json, dirty_data_profiles_json, training_assets_json,
           evaluation_rubric_json, override_policies_json, is_system, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              normalizedPayload.profileName,
              profileCode,
              normalizedPayload.industry,
              normalizedPayload.subScenario || null,
              normalizedPayload.profileDesc || null,
              normalizedPayload.locale || "zh-CN",
              normalizedPayload.businessStyle || normalizedPayload.industry || "generic",
              normalizedPayload.confidenceThreshold ?? 0.6,
              normalizedPayload.priority ?? 100,
              normalizedPayload.status || "draft",
              JSON.stringify(normalizedPayload.recognition || {}),
              JSON.stringify(normalizedPayload.researchCatalog || {}),
              JSON.stringify(normalizedPayload.modulePlanner || {}),
              JSON.stringify(normalizedPayload.schemaGuides || {}),
              JSON.stringify(normalizedPayload.relationPatterns || []),
              JSON.stringify(normalizedPayload.stateMachines || []),
              JSON.stringify(normalizedPayload.codeRules || []),
              JSON.stringify(normalizedPayload.fieldSemantics || []),
              JSON.stringify(normalizedPayload.valueCorpora || {}),
              JSON.stringify(normalizedPayload.distributionProfiles || {}),
              JSON.stringify(normalizedPayload.qualityGates || {}),
              JSON.stringify(normalizedPayload.realismRules || []),
              JSON.stringify(normalizedPayload.dirtyDataProfiles || {}),
              JSON.stringify(normalizedPayload.trainingAssets || {}),
              JSON.stringify(normalizedPayload.evaluationRubric || {}),
              JSON.stringify(normalizedPayload.overridePolicies || {}),
              normalizedPayload.isSystem ? 1 : 0,
              user?.displayName || user?.username || "system"
            ]
          );
          profileId = Number(result.insertId);
        }
        await replaceProfileChildren(connection, "lab_scenario_dictionary", profileId, normalizedPayload.dictionaries, (item, currentProfileId) => ({
          sql: `INSERT INTO lab_scenario_dictionary
        (profile_id, dict_type, item_code, item_label, item_value_json, weight, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            currentProfileId,
            item.dictType,
            item.itemCode,
            item.itemLabel,
            JSON.stringify(item.itemValue || {}),
            item.weight ?? 1,
            item.sortOrder ?? 0,
            item.status || "active"
          ]
        }));
        await replaceProfileChildren(connection, "lab_scenario_distribution_rule", profileId, normalizedPayload.distributionRules, (item, currentProfileId) => ({
          sql: `INSERT INTO lab_scenario_distribution_rule
        (profile_id, rule_type, rule_name, rule_code, rule_config_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
          values: [
            currentProfileId,
            item.ruleType,
            item.ruleName,
            item.ruleCode,
            JSON.stringify(item.ruleConfig || {}),
            item.status || "active"
          ]
        }));
        await replaceProfileChildren(connection, "lab_scenario_field_rule", profileId, normalizedPayload.fieldRules, (item, currentProfileId) => ({
          sql: `INSERT INTO lab_scenario_field_rule
        (profile_id, table_name, field_name, generator_type, rule_config_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
          values: [
            currentProfileId,
            item.tableName || "",
            item.fieldName,
            item.generatorType,
            JSON.stringify(item.ruleConfig || {}),
            item.status || "active"
          ]
        }));
        await replaceProfileChildren(connection, "lab_scenario_compliance_rule", profileId, normalizedPayload.complianceRules, (item, currentProfileId) => ({
          sql: `INSERT INTO lab_scenario_compliance_rule
        (profile_id, rule_code, rule_name, table_name, field_name, rule_type, rule_config_json, issue_category, severity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            currentProfileId,
            item.ruleCode,
            item.ruleName,
            item.tableName || "",
            item.fieldName,
            item.ruleType,
            JSON.stringify(item.ruleConfig || {}),
            item.issueCategory || "\u5408\u89C4\u6027",
            item.severity || "medium",
            item.status || "active"
          ]
        }));
        await replaceProfileChildren(connection, "lab_scenario_plugin_binding", profileId, normalizedPayload.pluginBindings, (item, currentProfileId) => ({
          sql: `INSERT INTO lab_scenario_plugin_binding
        (profile_id, plugin_key, plugin_name, binding_scope, binding_config_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
          values: [
            currentProfileId,
            item.pluginKey,
            item.pluginName,
            item.bindingScope || "industry",
            JSON.stringify(item.bindingConfig || {}),
            item.status || "active"
          ]
        }));
        await replaceProfileChildren(connection, "lab_scenario_extended_rule", profileId, normalizedPayload.extendedRules, (item, currentProfileId) => ({
          sql: `INSERT INTO lab_scenario_extended_rule
        (profile_id, rule_category, module_key, rule_code, rule_name, industry_scope, scene_scope, table_name, field_name, rule_config_json, sort_order, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            currentProfileId,
            item.ruleCategory,
            item.moduleKey,
            item.ruleCode,
            item.ruleName,
            item.industryScope || null,
            item.sceneScope || null,
            item.tableName || null,
            item.fieldName || null,
            JSON.stringify(item.ruleConfig || {}),
            item.sortOrder ?? 0,
            item.status || "active"
          ]
        }));
        const [versionRows] = await connection.query(
          "SELECT COALESCE(MAX(version_no), 0) + 1 AS nextVersion FROM lab_scenario_profile_version WHERE profile_id = ?",
          [profileId]
        );
        const nextVersion = Number(versionRows[0]?.nextVersion || 1);
        const snapshot = buildVersionSnapshot({
          id: profileId,
          profileCode
        }, { ...normalizedPayload, profileCode });
        await connection.query(
          `INSERT INTO lab_scenario_profile_version (profile_id, version_no, version_status, snapshot_json, created_by)
       VALUES (?, ?, ?, ?, ?)`,
          [
            profileId,
            nextVersion,
            normalizedPayload.status === "active" ? "published" : "draft",
            JSON.stringify(snapshot),
            user?.displayName || user?.username || "system"
          ]
        );
        await connection.commit();
        return getScenarioEnhancementDetail(profileId);
      } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u589E\u5F3A\u5305\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      } finally {
        connection.release();
      }
    }
    async function deleteScenarioEnhancement(id) {
      const profile = await getProfileBase(id);
      if (profile.isSystem) {
        throw new AppError("\u7CFB\u7EDF\u589E\u5F3A\u5305\u4E0D\u5141\u8BB8\u5220\u9664", 400);
      }
      await pool.query("DELETE FROM lab_scenario_profile WHERE id = ?", [id]);
      return { id };
    }
    function mapManagedProfile(detail) {
      const lightweightResearchCatalog = safeObjectValue(detail.researchCatalog);
      const lightweightModulePlanner = normalizeLightweightModulePlanner(detail.modulePlanner, lightweightResearchCatalog);
      return {
        id: detail.id,
        profileCode: detail.profileCode,
        profileName: detail.profileName,
        industry: detail.industry,
        subScenario: detail.subScenario,
        locale: detail.locale,
        businessStyle: detail.businessStyle,
        confidenceThreshold: detail.confidenceThreshold,
        priority: detail.priority,
        status: detail.status,
        recognition: detail.recognition || {},
        researchCatalog: {
          industryLabel: lightweightResearchCatalog.industryLabel || detail.profileName,
          categoryTree: Array.isArray(lightweightResearchCatalog.categoryTree) ? lightweightResearchCatalog.categoryTree : [],
          candidateTables: normalizeStringArray(lightweightResearchCatalog.candidateTables),
          candidateTableSpecs: Array.isArray(lightweightResearchCatalog.candidateTableSpecs) ? lightweightResearchCatalog.candidateTableSpecs : [],
          dictSuggestions: normalizeStringArray(lightweightResearchCatalog.dictSuggestions),
          dictSuggestionSpecs: Array.isArray(lightweightResearchCatalog.dictSuggestionSpecs) ? lightweightResearchCatalog.dictSuggestionSpecs : [],
          summary: String(lightweightResearchCatalog.summary || "").trim(),
          sourceRefs: normalizeStringArray(lightweightResearchCatalog.sourceRefs)
        },
        modulePlanner: lightweightModulePlanner,
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
        dictionaries: detail.dictionaries || [],
        distributionRules: [],
        fieldRules: [],
        complianceRules: [],
        pluginBindings: [],
        extendedRules: []
      };
    }
    async function listActiveScenarioProfiles() {
      const profiles = await listScenarioEnhancements();
      const activeProfiles = profiles.filter((item) => item.status === "active");
      const details = [];
      for (const profile of activeProfiles) {
        details.push(mapManagedProfile(await getScenarioEnhancementDetail(profile.id)));
      }
      return details;
    }
    async function previewScenarioRecognition(payload) {
      const managedProfiles = await listActiveScenarioProfiles();
      return scenarioEngine.buildScenarioProfile({
        sceneName: payload.sceneName,
        sceneDesc: payload.sceneDesc,
        knowledgeText: payload.knowledgeText,
        managedProfiles
      });
    }
    async function getManagedScenarioProfileById(id) {
      if (!id) {
        return null;
      }
      const detail = await getScenarioEnhancementDetail(id);
      return mapManagedProfile(detail);
    }
    async function exportScenarioEnhancementPackage(id) {
      const detail = await getScenarioEnhancementDetail(id);
      const managed = mapManagedProfile(detail);
      return {
        packageType: "data_lab_lightweight_enhancement",
        packageVersion: 1,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        profile: {
          profileName: detail.profileName,
          profileCode: detail.profileCode,
          industry: detail.industry,
          subScenario: detail.subScenario,
          profileDesc: detail.profileDesc,
          locale: detail.locale,
          businessStyle: detail.businessStyle,
          confidenceThreshold: detail.confidenceThreshold,
          priority: detail.priority,
          status: detail.status,
          isSystem: false
        },
        recognition: managed.recognition || {},
        researchCatalog: managed.researchCatalog || {},
        modulePlanner: managed.modulePlanner || {},
        dictionaries: managed.dictionaries || []
      };
    }
    async function importScenarioEnhancementPackage(payload, user) {
      if (!payload || typeof payload !== "object") {
        throw new AppError("\u589E\u5F3A\u5305\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const profile = payload.profile || {};
      if (!profile.profileName || !profile.industry) {
        throw new AppError("\u589E\u5F3A\u5305\u7F3A\u5C11 profileName \u6216 industry", 400);
      }
      const importCodeBase = normalizeCode(profile.profileCode || profile.profileName, "scenario_profile");
      const [rows] = await pool.query("SELECT COUNT(*) AS total FROM lab_scenario_profile WHERE profile_code = ?", [importCodeBase]);
      const profileCode = Number(rows[0]?.total || 0) > 0 ? `${importCodeBase}_${Date.now().toString().slice(-6)}` : importCodeBase;
      return saveScenarioEnhancement({
        profileName: profile.profileName,
        profileCode,
        industry: profile.industry,
        subScenario: profile.subScenario || null,
        profileDesc: profile.profileDesc || null,
        locale: profile.locale || "zh-CN",
        businessStyle: profile.businessStyle || profile.industry || "generic",
        confidenceThreshold: profile.confidenceThreshold ?? 0.6,
        priority: profile.priority ?? 100,
        status: profile.status || "draft",
        isSystem: false,
        recognition: payload.recognition || {},
        researchCatalog: payload.researchCatalog || {},
        modulePlanner: payload.modulePlanner || {},
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
        dictionaries: payload.dictionaries || [],
        distributionRules: [],
        fieldRules: [],
        complianceRules: [],
        pluginBindings: [],
        extendedRules: []
      }, user);
    }
    module2.exports = {
      listScenarioEnhancements,
      getScenarioEnhancementDetail,
      saveScenarioEnhancement,
      deleteScenarioEnhancement,
      listActiveScenarioProfiles,
      previewScenarioRecognition,
      getManagedScenarioProfileById,
      exportScenarioEnhancementPackage,
      importScenarioEnhancementPackage
    };
  }
});

// backend/src/modules/model-providers/model-provider.repository.js
var require_model_provider_repository = __commonJS({
  "backend/src/modules/model-providers/model-provider.repository.js"(exports2, module2) {
    var { pool } = require_database();
    function mapRow(row) {
      let extraConfig = row.extraConfig;
      if (typeof extraConfig === "string") {
        try {
          extraConfig = JSON.parse(extraConfig);
        } catch (error) {
          extraConfig = {};
        }
      }
      return {
        ...row,
        modelVersion: row.modelVersion || null,
        extraConfig: extraConfig || {}
      };
    }
    async function getModelProviderById(id) {
      const [rows] = await pool.query(
        `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     WHERE id = ?`,
        [id]
      );
      return rows[0] ? mapRow(rows[0]) : null;
    }
    async function listModelProviders() {
      const [rows] = await pool.query(
        `SELECT id, config_name AS configName, config_code AS configCode, provider_type AS providerType,
            model_category AS modelCategory, model_name AS modelName, base_url AS baseUrl,
            model_version AS modelVersion, api_key AS apiKey, organization_id AS organizationId, owner_name AS ownerName,
            status, description, extra_config AS extraConfig, created_at AS createdAt, updated_at AS updatedAt
     FROM model_providers
     ORDER BY id DESC`
      );
      return rows.map(mapRow);
    }
    async function createModelProvider(payload) {
      const [result] = await pool.query(
        `INSERT INTO model_providers
      (config_name, config_code, provider_type, model_category, model_name, model_version, base_url, api_key,
       organization_id, owner_name, status, description, extra_config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.configName,
          payload.configCode,
          payload.providerType,
          payload.modelCategory,
          payload.modelName,
          payload.modelVersion || null,
          payload.baseUrl || null,
          payload.apiKey,
          payload.organizationId || null,
          payload.ownerName,
          payload.status,
          payload.description || null,
          JSON.stringify(payload.extraConfig || {})
        ]
      );
      return getModelProviderById(result.insertId);
    }
    async function updateModelProvider(id, payload) {
      const [result] = await pool.query(
        `UPDATE model_providers
     SET config_name = ?, config_code = ?, provider_type = ?, model_category = ?, model_name = ?, model_version = ?, base_url = ?,
         api_key = ?, organization_id = ?, owner_name = ?, status = ?, description = ?, extra_config = ?
     WHERE id = ?`,
        [
          payload.configName,
          payload.configCode,
          payload.providerType,
          payload.modelCategory,
          payload.modelName,
          payload.modelVersion || null,
          payload.baseUrl || null,
          payload.apiKey,
          payload.organizationId || null,
          payload.ownerName,
          payload.status,
          payload.description || null,
          JSON.stringify(payload.extraConfig || {}),
          id
        ]
      );
      if (result.affectedRows === 0) {
        return null;
      }
      return getModelProviderById(id);
    }
    async function deleteModelProvider(id) {
      const [result] = await pool.query("DELETE FROM model_providers WHERE id = ?", [id]);
      return result.affectedRows > 0;
    }
    module2.exports = {
      getModelProviderById,
      listModelProviders,
      createModelProvider,
      updateModelProvider,
      deleteModelProvider
    };
  }
});

// runtime-port:config
var require_config = __commonJS({
  "runtime-port:config"(exports2, module2) {
    var { createRuntimeConfigProxy } = require("@johnason/data-platform-core-kernel");
    module2.exports = createRuntimeConfigProxy();
  }
});

// backend/src/common/utils/database-driver-store.js
var require_database_driver_store = __commonJS({
  "backend/src/common/utils/database-driver-store.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var DRIVER_STORE_ROOT = path.resolve(process.cwd(), "runtime/database-drivers");
    var ACTIVE_MANIFEST_PATH = path.join(DRIVER_STORE_ROOT, "active.json");
    var DATAX_TARGETS = {
      mysql: {
        dataxReader: { relativePath: "reader/mysqlreader/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i },
        dataxWriter: { relativePath: "writer/mysqlwriter/libs", pattern: /(?:mysql-connector|mariadb-java-client).*\.jar$/i }
      },
      postgresql: {
        dataxReader: { relativePath: "reader/postgresqlreader/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i },
        dataxWriter: { relativePath: "writer/postgresqlwriter/libs", pattern: /(?:postgresql|pgjdbc).*\.jar$/i }
      },
      oracle: {
        dataxReader: { relativePath: "reader/oraclereader/libs", pattern: /ojdbc.*\.jar$/i },
        dataxWriter: { relativePath: "writer/oraclewriter/libs", pattern: /ojdbc.*\.jar$/i }
      },
      dm: {
        dataxReader: { relativePath: "reader/rdbmsreader/libs", pattern: /dm.*jdbcdriver.*\.jar$/i },
        dataxWriter: { relativePath: "writer/rdbmswriter/libs", pattern: /dm.*jdbcdriver.*\.jar$/i }
      }
    };
    function ensureDriverStore() {
      fs.mkdirSync(DRIVER_STORE_ROOT, { recursive: true });
      return DRIVER_STORE_ROOT;
    }
    function emptyManifest() {
      return { version: 1, bindings: {}, updatedAt: null };
    }
    function readActiveManifest() {
      ensureDriverStore();
      try {
        const parsed = JSON.parse(fs.readFileSync(ACTIVE_MANIFEST_PATH, "utf8"));
        return parsed && typeof parsed === "object" && parsed.bindings ? parsed : emptyManifest();
      } catch {
        return emptyManifest();
      }
    }
    function writeActiveManifest(manifest) {
      ensureDriverStore();
      const next = { version: 1, bindings: manifest?.bindings || {}, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      const tempPath = `${ACTIVE_MANIFEST_PATH}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
      fs.renameSync(tempPath, ACTIVE_MANIFEST_PATH);
      return next;
    }
    function getActiveDriverBinding(databaseType, target = "query") {
      const key = `${String(databaseType || "").toLowerCase()}:${target}`;
      return readActiveManifest().bindings[key] || null;
    }
    function resolveDriverFile(relativePath) {
      const resolved = path.resolve(DRIVER_STORE_ROOT, String(relativePath || ""));
      const relative = path.relative(DRIVER_STORE_ROOT, resolved);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("\u9A71\u52A8\u6587\u4EF6\u8DEF\u5F84\u8D85\u51FA\u6301\u4E45\u5316\u4ED3\u5E93");
      }
      return resolved;
    }
    function restoreBuiltInDrivers(directory) {
      if (!fs.existsSync(directory)) return;
      for (const name of fs.readdirSync(directory)) {
        if (!name.endsWith(".builtin-disabled")) continue;
        const source = path.join(directory, name);
        const target = path.join(directory, name.slice(0, -".builtin-disabled".length));
        if (!fs.existsSync(target)) fs.renameSync(source, target);
        else fs.unlinkSync(source);
      }
    }
    function materializeDataXTarget(dataxHome, databaseType, target, binding) {
      const config = DATAX_TARGETS[databaseType]?.[target];
      if (!config) return;
      const directory = path.join(dataxHome, "plugin", config.relativePath);
      if (!fs.existsSync(directory)) throw new Error(`DataX \u63D2\u4EF6\u76EE\u5F55\u4E0D\u5B58\u5728: ${config.relativePath}`);
      const managedName = `medata-managed-${databaseType}.jar`;
      const managedPath = path.join(directory, managedName);
      if (fs.existsSync(managedPath)) fs.unlinkSync(managedPath);
      restoreBuiltInDrivers(directory);
      if (!binding) return;
      for (const name of fs.readdirSync(directory)) {
        if (name === managedName || !config.pattern.test(name)) continue;
        fs.renameSync(path.join(directory, name), path.join(directory, `${name}.builtin-disabled`));
      }
      const sourcePath = resolveDriverFile(binding.filePath);
      if (!fs.existsSync(sourcePath)) throw new Error(`\u6FC0\u6D3B\u9A71\u52A8\u6587\u4EF6\u4E0D\u5B58\u5728: ${binding.filePath}`);
      fs.copyFileSync(sourcePath, managedPath);
    }
    function materializeActiveDataXDrivers(dataxHome) {
      const manifest = readActiveManifest();
      for (const databaseType of Object.keys(DATAX_TARGETS)) {
        for (const target of ["dataxReader", "dataxWriter"]) {
          materializeDataXTarget(dataxHome, databaseType, target, manifest.bindings[`${databaseType}:${target}`] || null);
        }
      }
      return manifest;
    }
    module2.exports = {
      ACTIVE_MANIFEST_PATH,
      DRIVER_STORE_ROOT,
      ensureDriverStore,
      getActiveDriverBinding,
      materializeDataXTarget,
      materializeActiveDataXDrivers,
      readActiveManifest,
      resolveDriverFile,
      writeActiveManifest
    };
  }
});

// backend/src/common/utils/datasource-capabilities.js
var require_datasource_capabilities = __commonJS({
  "backend/src/common/utils/datasource-capabilities.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var { getActiveDriverBinding } = require_database_driver_store();
    var DATABASE_CAPABILITIES = Object.freeze({
      mysql: Object.freeze({
        type: "mysql",
        label: "MySQL",
        aliases: Object.freeze(["mysql", "mariadb"]),
        defaultPort: 3306,
        driverClassName: "com.mysql.cj.jdbc.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "mysqlreader",
        dataxWriter: "mysqlwriter",
        nodePackage: "mysql2",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      postgresql: Object.freeze({
        type: "postgresql",
        label: "PostgreSQL",
        aliases: Object.freeze(["postgresql", "postgres", "pg"]),
        defaultPort: 5432,
        driverClassName: "org.postgresql.Driver",
        healthCheckSql: "SELECT 1 AS ok",
        dataxReader: "postgresqlreader",
        dataxWriter: "postgresqlwriter",
        nodePackage: "pg",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      oracle: Object.freeze({
        type: "oracle",
        label: "Oracle",
        aliases: Object.freeze(["oracle"]),
        defaultPort: 1521,
        driverClassName: "oracle.jdbc.OracleDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "oraclereader",
        dataxWriter: "oraclewriter",
        nodePackage: "oracledb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      }),
      dm: Object.freeze({
        type: "dm",
        label: "\u8FBE\u68A6\u6570\u636E\u5E93",
        aliases: Object.freeze(["dm", "dameng", "dmdb"]),
        defaultPort: 5236,
        driverClassName: "dm.jdbc.driver.DmDriver",
        healthCheckSql: "SELECT 1 AS ok FROM DUAL",
        dataxReader: "rdbmsreader",
        dataxWriter: "rdbmswriter",
        nodePackage: "dmdb",
        capabilities: Object.freeze({ query: true, metadata: true, ingestionReader: true, ingestionWriter: true, quality: true, reporting: true })
      })
    });
    var DATABASE_ALIAS_MAP = Object.freeze(Object.fromEntries(
      Object.values(DATABASE_CAPABILITIES).flatMap(
        (capability) => capability.aliases.map((alias) => [alias, capability.type])
      )
    ));
    function getRuntimeDatabaseCapabilityStatus() {
      const pluginRoot = path.resolve(__dirname, "../../../datax/plugin");
      const hasPlugin = (kind, name) => fs.existsSync(path.join(pluginRoot, kind, name, "plugin.json"));
      const hasJar = (kind, name, pattern) => {
        const libs = path.join(pluginRoot, kind, name, "libs");
        return fs.existsSync(libs) && fs.readdirSync(libs).some((fileName) => pattern.test(fileName));
      };
      return listDatabaseCapabilities().map((capability) => {
        let driverLoaded = false;
        try {
          require.resolve(capability.nodePackage);
          driverLoaded = true;
        } catch {
          driverLoaded = false;
        }
        const readerJarReady = capability.type === "oracle" ? hasJar("reader", capability.dataxReader, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("reader", capability.dataxReader, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const writerJarReady = capability.type === "oracle" ? hasJar("writer", capability.dataxWriter, /^ojdbc.*\.jar$/i) : capability.type === "dm" ? hasJar("writer", capability.dataxWriter, /^Dm.*JdbcDriver.*\.jar$/i) : true;
        const managedQueryDriver = getActiveDriverBinding(capability.type, "query");
        return {
          ...capability,
          driverLoaded,
          queryReady: driverLoaded || Boolean(managedQueryDriver),
          managedQueryDriver: managedQueryDriver ? {
            packageId: managedQueryDriver.packageId,
            version: managedQueryDriver.version,
            sha256: managedQueryDriver.sha256
          } : null,
          dataxReaderReady: hasPlugin("reader", capability.dataxReader) && readerJarReady,
          dataxWriterReady: hasPlugin("writer", capability.dataxWriter) && writerJarReady
        };
      });
    }
    function normalizeRegisteredDatabaseType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return DATABASE_ALIAS_MAP[normalized] || normalized;
    }
    function getDatabaseCapability(value) {
      return DATABASE_CAPABILITIES[normalizeRegisteredDatabaseType(value)] || null;
    }
    function listDatabaseCapabilities() {
      return Object.values(DATABASE_CAPABILITIES);
    }
    function isSupportedDatabaseType(value) {
      return Boolean(getDatabaseCapability(value));
    }
    module2.exports = {
      DATABASE_CAPABILITIES,
      getDatabaseCapability,
      isSupportedDatabaseType,
      listDatabaseCapabilities,
      getRuntimeDatabaseCapabilityStatus,
      normalizeRegisteredDatabaseType
    };
  }
});

// backend/src/common/utils/datasource-dialect.js
var require_datasource_dialect = __commonJS({
  "backend/src/common/utils/datasource-dialect.js"(exports2, module2) {
    var POSTGRESQL = "postgresql";
    var UNKNOWN = "unknown";
    var {
      getDatabaseCapability,
      normalizeRegisteredDatabaseType
    } = require_datasource_capabilities();
    var DIALECT_VENDOR_MAP = {
      mysql: "mysql",
      mariadb: "mysql",
      postgresql: POSTGRESQL,
      postgres: POSTGRESQL,
      gaussdb: POSTGRESQL,
      opengauss: POSTGRESQL,
      clickhouse: "clickhouse",
      hive: "hive",
      hive2: "hive",
      oracle: "oracle",
      dm: "dm",
      dameng: "dm",
      dmdb: "dm",
      sqlserver: "sqlserver"
    };
    function normalizeDatasourceType(value) {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized) {
        return "";
      }
      const registeredType = normalizeRegisteredDatabaseType(normalized);
      if (registeredType !== normalized || getDatabaseCapability(registeredType)) return registeredType;
      if (normalized === "opengauss") {
        return "gaussdb";
      }
      return normalized;
    }
    function mapJdbcVendorToDialect(vendor) {
      return DIALECT_VENDOR_MAP[String(vendor || "").trim().toLowerCase()] || UNKNOWN;
    }
    function getDefaultPort(type) {
      const normalizedType = normalizeDatasourceType(type);
      const registered = getDatabaseCapability(normalizedType);
      if (registered) return registered.defaultPort;
      switch (normalizedType) {
        case "gaussdb":
          return 5432;
        case "clickhouse":
          return 8123;
        case "hive":
          return 1e4;
        case "kafka":
          return 9092;
        case "ftp":
          return 21;
        case "sftp":
          return 22;
        default:
          return 0;
      }
    }
    function parseJdbcParams(rawParams = "") {
      if (!rawParams) {
        return {};
      }
      const normalized = String(rawParams || "").replace(/^[?;]/, "").replace(/;/g, "&");
      const searchParams = new URLSearchParams(normalized);
      const result = {};
      for (const [key, value] of searchParams.entries()) {
        result[key] = value;
      }
      return result;
    }
    function parseStandardJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      const matched = normalized.match(/^jdbc:([a-z0-9_]+)(?::([a-z0-9_]+))?:\/\/([^/?;#]+)(?::(\d+))?(?:\/([^?;#]*))?([?;].*)?$/i);
      if (!matched) {
        return null;
      }
      const vendor = String(matched[1] || "").toLowerCase();
      const subProtocol = String(matched[2] || "").toLowerCase() || null;
      const hostToken = String(matched[3] || "").split(",").map((item) => item.trim()).find(Boolean) || "";
      const pathToken = decodeURIComponent(String(matched[5] || "").trim());
      const params = parseJdbcParams(matched[6] || "");
      const database = pathToken || null;
      const schema = params.currentSchema || params.currentschema || params.schema || params.searchpath || null;
      return {
        jdbcUrl: normalized,
        vendor,
        subProtocol,
        dialect: mapJdbcVendorToDialect(subProtocol || vendor),
        host: hostToken || null,
        port: matched[4] ? Number(matched[4]) : null,
        database,
        schema,
        params
      };
    }
    function parseOracleJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      const serviceMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@\/\/([^:/?#]+):(\d+)\/([^?;#]+)([?;].*)?$/i);
      const sidMatched = normalized.match(/^jdbc:oracle(?::[a-z0-9_]+)*:@([^:/?#]+):(\d+):([^?;#]+)([?;].*)?$/i);
      const matched = serviceMatched || sidMatched;
      if (!matched) {
        return null;
      }
      return {
        jdbcUrl: normalized,
        vendor: "oracle",
        subProtocol: null,
        dialect: "oracle",
        host: String(matched[1] || "").trim() || null,
        port: matched[2] ? Number(matched[2]) : null,
        database: decodeURIComponent(String(matched[3] || "").trim()) || null,
        connectionMode: serviceMatched ? "serviceName" : "sid",
        schema: null,
        params: parseJdbcParams(matched[4] || "")
      };
    }
    function parseJdbcUrl(jdbcUrl) {
      const normalized = String(jdbcUrl || "").trim();
      if (!normalized || !/^jdbc:/i.test(normalized)) {
        return null;
      }
      return parseStandardJdbcUrl(normalized) || parseOracleJdbcUrl(normalized);
    }
    function inferDatasourceDialect(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      if (!normalizedType) {
        return UNKNOWN;
      }
      if (getDatabaseCapability(normalizedType) || normalizedType === "clickhouse" || normalizedType === "hive" || normalizedType === "kafka" || normalizedType === "api" || normalizedType === "ftp" || normalizedType === "sftp") {
        return normalizedType;
      }
      if (normalizedType === "gaussdb") {
        return POSTGRESQL;
      }
      if (normalizedType === "jdbc") {
        return parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString)?.dialect || UNKNOWN;
      }
      return normalizedType;
    }
    function normalizeJdbcUrlForDialect(jdbcUrl, dialect) {
      const normalized = String(jdbcUrl || "").trim();
      if (!normalized) {
        return "";
      }
      if (dialect === POSTGRESQL) {
        return normalized.replace(/^jdbc:(?:gaussdb|opengauss|postgres):/i, "jdbc:postgresql:");
      }
      if (dialect === "mysql") {
        return normalized.replace(/^jdbc:mariadb:/i, "jdbc:mysql:");
      }
      if (dialect === "hive") {
        return normalized.replace(/^jdbc:hive:/i, "jdbc:hive2:");
      }
      return normalized;
    }
    function buildJdbcUrl(sourceType, connectionConfig = {}, options = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const dialect = options.dialect || inferDatasourceDialect(normalizedType, connectionConfig);
      const existingJdbcUrl = String(connectionConfig.jdbcUrl || connectionConfig.url || "").trim();
      if (existingJdbcUrl) {
        return options.normalize !== false ? normalizeJdbcUrlForDialect(existingJdbcUrl, dialect) : existingJdbcUrl;
      }
      const host = String(connectionConfig.host || "").trim();
      const port = Number(connectionConfig.port || getDefaultPort(dialect || normalizedType));
      const database = String(connectionConfig.database || connectionConfig.databaseName || "").trim();
      if (!host || !port) {
        return "";
      }
      if (dialect === POSTGRESQL) {
        return `jdbc:postgresql://${host}:${port}/${database}`;
      }
      if (dialect === "mysql") {
        return `jdbc:mysql://${host}:${port}/${database}?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai`;
      }
      if (dialect === "clickhouse") {
        return `jdbc:clickhouse://${host}:${port}/${database}`;
      }
      if (dialect === "hive") {
        return `jdbc:hive2://${host}:${port}/${database || "default"}`;
      }
      if (dialect === "oracle") {
        const connectionMode = String(connectionConfig.connectionMode || "serviceName").trim().toLowerCase();
        return connectionMode === "sid" ? `jdbc:oracle:thin:@${host}:${port}:${database}` : `jdbc:oracle:thin:@//${host}:${port}/${database}`;
      }
      if (dialect === "dm") {
        return `jdbc:dm://${host}:${port}/${database}`;
      }
      return "";
    }
    function resolveDatasourceConnection(sourceType, connectionConfig = {}) {
      const normalizedType = normalizeDatasourceType(sourceType);
      const jdbcMeta = parseJdbcUrl(connectionConfig.jdbcUrl || connectionConfig.url || connectionConfig.connectionString);
      const dialect = inferDatasourceDialect(normalizedType, connectionConfig);
      const database = connectionConfig.database || connectionConfig.databaseName || jdbcMeta?.database || null;
      const schema = connectionConfig.schema || connectionConfig.currentSchema || jdbcMeta?.schema || (dialect === POSTGRESQL ? "public" : null);
      const host = connectionConfig.host || jdbcMeta?.host || null;
      const portValue = connectionConfig.port || jdbcMeta?.port || getDefaultPort(dialect || normalizedType);
      const port = Number(portValue || 0) || 0;
      return {
        sourceType: normalizedType,
        dialect,
        host,
        port,
        database,
        schema,
        username: connectionConfig.username || connectionConfig.user || null,
        password: connectionConfig.password || null,
        jdbcUrl: buildJdbcUrl(normalizedType, { ...connectionConfig, database }, { dialect }),
        driverClassName: connectionConfig.driverClassName || null,
        protocol: connectionConfig.protocol || jdbcMeta?.vendor || null,
        connectionMode: connectionConfig.connectionMode || jdbcMeta?.connectionMode || null,
        jdbcMeta
      };
    }
    module2.exports = {
      POSTGRESQL,
      UNKNOWN,
      buildJdbcUrl,
      getDefaultPort,
      inferDatasourceDialect,
      mapJdbcVendorToDialect,
      normalizeDatasourceType,
      normalizeJdbcUrlForDialect,
      parseJdbcUrl,
      resolveDatasourceConnection
    };
  }
});

// backend/src/modules/data-development/data-development.utils.js
var require_data_development_utils = __commonJS({
  "backend/src/modules/data-development/data-development.utils.js"(exports2, module2) {
    var crypto = require("crypto");
    var env = require_config();
    var {
      inferDatasourceDialect: inferSharedDatasourceDialect,
      normalizeDatasourceType: normalizeSharedDatasourceType,
      resolveDatasourceConnection
    } = require_datasource_dialect();
    var PENDING_PROCESSING_SOURCE_TABLE_PREFIX = "__pending_source_table__";
    function parseJson(value, fallback) {
      if (value === null || value === void 0) {
        return fallback;
      }
      if (typeof value === "object") {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    }
    function normalizeDatasourceStorageType(type) {
      return normalizeSharedDatasourceType(type || "mysql") || "mysql";
    }
    function normalizeDatasourceType(type) {
      const normalized = normalizeDatasourceStorageType(type);
      if (normalized === "gaussdb") {
        return "postgresql";
      }
      return normalized;
    }
    function isPendingProcessingSourceTable(tableName) {
      return String(tableName || "").startsWith(PENDING_PROCESSING_SOURCE_TABLE_PREFIX);
    }
    function parseDatasourceHostAliases() {
      return String(process.env.DATA_DEV_HOST_ALIASES || "").split(",").map((item) => item.trim()).filter(Boolean).reduce((result, item) => {
        const [from, to] = item.split("=").map((part) => part.trim());
        if (!from || !to) {
          return result;
        }
        result[from.toLowerCase()] = to;
        return result;
      }, {});
    }
    function resolveDatasourceHost(host) {
      const normalizedHost = String(host || "").trim();
      if (!normalizedHost) {
        return normalizedHost;
      }
      const aliases = parseDatasourceHostAliases();
      return aliases[normalizedHost.toLowerCase()] || normalizedHost;
    }
    function buildDatasourceConnectionPayload(input = {}) {
      const extraConfig = parseJson(input.extraConfig, {});
      return {
        host: input.host,
        port: input.port,
        database: input.database || input.databaseName,
        databaseName: input.databaseName || input.database,
        username: input.username,
        password: input.password,
        ...extraConfig
      };
    }
    function inferDatasourceDialect(input, extraConfig = {}) {
      if (input && typeof input === "object") {
        const sourceType2 = input.storageType || input.type || input.sourceType;
        const payload = buildDatasourceConnectionPayload(input);
        const dialect2 = inferSharedDatasourceDialect(sourceType2, payload);
        return dialect2 === "unknown" ? normalizeDatasourceType(sourceType2) : dialect2;
      }
      const sourceType = input;
      const dialect = inferSharedDatasourceDialect(sourceType, extraConfig || {});
      return dialect === "unknown" ? normalizeDatasourceType(sourceType) : dialect;
    }
    function resolveRuntimeDatasourceConfig(input = {}) {
      const storageType = normalizeDatasourceStorageType(input.storageType || input.type || input.sourceType);
      const payload = buildDatasourceConnectionPayload(input);
      const resolved = resolveDatasourceConnection(storageType, payload);
      const dialect = resolved.dialect === "unknown" ? normalizeDatasourceType(storageType) : resolved.dialect;
      return {
        storageType,
        dialect,
        host: resolveDatasourceHost(resolved.host || input.host),
        port: Number(resolved.port || input.port || 0) || 0,
        databaseName: resolved.database || input.databaseName || null,
        username: resolved.username || input.username || null,
        password: resolved.password || input.password || "",
        schema: resolved.schema || payload.schema || null,
        jdbcUrl: resolved.jdbcUrl || payload.jdbcUrl || "",
        driverClassName: payload.driverClassName || resolved.driverClassName || null,
        protocol: payload.protocol || resolved.protocol || null,
        connectionMode: payload.connectionMode || resolved.connectionMode || null,
        extraConfig: {
          ...parseJson(input.extraConfig, {}),
          ...resolved.jdbcUrl ? { jdbcUrl: resolved.jdbcUrl } : {},
          ...resolved.schema ? { schema: resolved.schema } : {},
          ...payload.driverClassName || resolved.driverClassName ? { driverClassName: payload.driverClassName || resolved.driverClassName } : {},
          ...payload.protocol || resolved.protocol ? { protocol: payload.protocol || resolved.protocol } : {},
          ...payload.connectionMode || resolved.connectionMode ? { connectionMode: payload.connectionMode || resolved.connectionMode } : {}
        }
      };
    }
    function buildDatasourceEnvironmentSignature(datasource) {
      if (!datasource) {
        return "";
      }
      const resolved = resolveRuntimeDatasourceConfig(datasource);
      return [
        resolved.dialect,
        resolveDatasourceHost(resolved.host).toLowerCase(),
        Number(resolved.port || 0)
      ].join("::");
    }
    function buildCipherKey() {
      return crypto.createHash("sha256").update(String(env.licenseStorageKey || env.jwtSecret || "medata")).digest();
    }
    function encryptSecret(plainText) {
      if (!plainText) {
        return null;
      }
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv("aes-256-cbc", buildCipherKey(), iv);
      const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]).toString("base64");
      return `${iv.toString("base64")}:${encrypted}`;
    }
    function decryptSecret(cipherText) {
      if (!cipherText) {
        return "";
      }
      const [ivBase64, payload] = String(cipherText).split(":");
      if (!ivBase64 || !payload) {
        return String(cipherText);
      }
      try {
        const decipher = crypto.createDecipheriv("aes-256-cbc", buildCipherKey(), Buffer.from(ivBase64, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(payload, "base64")), decipher.final()]).toString("utf8");
      } catch (error) {
        return String(cipherText);
      }
    }
    function isQuerySql(sql) {
      const normalized = stripLeadingSqlComments(sql).toLowerCase();
      return /^(select|show|describe|desc|with|explain)\b/.test(normalized);
    }
    function hasLimitClause(sql) {
      return /\blimit\s+\d+|\bfetch\s+first\s+\d+\s+rows\s+only|\brownum\b/i.test(String(sql || ""));
    }
    function applyResultLimit(sql, resultLimit, dialect = "mysql") {
      const limit = Number(resultLimit || 0);
      if (!limit || !isQuerySql(sql) || hasLimitClause(sql)) {
        return String(sql || "");
      }
      const trimmed = String(sql || "").trim().replace(/;+\s*$/, "");
      const normalizedDialect = normalizeDatasourceType(dialect);
      if (normalizedDialect === "oracle") {
        return `SELECT * FROM (${trimmed}) WHERE ROWNUM <= ${limit}`;
      }
      if (normalizedDialect === "dm") {
        return `${trimmed}
FETCH FIRST ${limit} ROWS ONLY`;
      }
      if (normalizedDialect === "hive") {
        return `${trimmed}
LIMIT ${limit}`;
      }
      return `${trimmed} LIMIT ${limit}`;
    }
    function stripLeadingSqlComments(sql) {
      let text = String(sql || "").trimStart();
      while (text) {
        if (text.startsWith("--")) {
          const newlineIndex = text.indexOf("\n");
          text = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trimStart();
          continue;
        }
        if (text.startsWith("/*")) {
          const blockEndIndex = text.indexOf("*/");
          text = blockEndIndex === -1 ? "" : text.slice(blockEndIndex + 2).trimStart();
          continue;
        }
        break;
      }
      return text.trim();
    }
    function previewRows(rows, maxRows = 20) {
      return Array.isArray(rows) ? rows.slice(0, maxRows) : [];
    }
    function sanitizeNumber(value, fallback = 0) {
      const next = Number(value);
      return Number.isFinite(next) ? next : fallback;
    }
    function buildResultPreview(result) {
      if (!result) {
        return null;
      }
      return {
        fields: Array.isArray(result.fields) ? result.fields.slice(0, 64) : [],
        rows: previewRows(result.rows, 20),
        rowCount: sanitizeNumber(result.rowCount, Array.isArray(result.rows) ? result.rows.length : 0),
        affectedRows: sanitizeNumber(result.affectedRows, 0)
      };
    }
    function formatDateTime(date = /* @__PURE__ */ new Date()) {
      const value = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      const hour = String(value.getHours()).padStart(2, "0");
      const minute = String(value.getMinutes()).padStart(2, "0");
      const second = String(value.getSeconds()).padStart(2, "0");
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    function parseTableName(tableName, defaultScope) {
      const parts = String(tableName || "").split(".").filter(Boolean);
      if (parts.length >= 2) {
        return {
          scope: parts[parts.length - 2].replace(/["`]/g, ""),
          table: parts[parts.length - 1].replace(/["`]/g, "")
        };
      }
      return {
        scope: defaultScope,
        table: String(tableName || "").replace(/["`]/g, "")
      };
    }
    function parseCsvLine(line) {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && inQuotes && next === '"') {
          current += '"';
          index += 1;
          continue;
        }
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (char === "," && !inQuotes) {
          result.push(current);
          current = "";
          continue;
        }
        current += char;
      }
      result.push(current);
      return result;
    }
    function cleanHiveOutput(text) {
      return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith("SLF4J:")).filter((line) => !line.startsWith("Connecting to ")).filter((line) => !line.startsWith("Connected to:")).filter((line) => !line.startsWith("Driver:")).filter((line) => !line.startsWith("Transaction isolation:")).filter((line) => !line.startsWith("Beeline version")).filter((line) => !line.startsWith("0: jdbc:hive2://")).filter((line) => !line.startsWith("+")).filter((line) => !line.startsWith("|"));
    }
    function quoteIdentifier(identifier, type = "mysql") {
      const normalized = normalizeDatasourceType(type);
      const quote = ["postgresql", "oracle", "dm"].includes(normalized) ? '"' : "`";
      return String(identifier || "").split(".").filter(Boolean).map((part) => `${quote}${String(part).replace(new RegExp(quote, "g"), quote.repeat(2))}${quote}`).join(".");
    }
    module2.exports = {
      applyResultLimit,
      buildDatasourceEnvironmentSignature,
      buildResultPreview,
      cleanHiveOutput,
      decryptSecret,
      encryptSecret,
      formatDateTime,
      inferDatasourceDialect,
      isPendingProcessingSourceTable,
      isQuerySql,
      normalizeDatasourceStorageType,
      normalizeDatasourceType,
      parseCsvLine,
      resolveDatasourceHost,
      resolveRuntimeDatasourceConfig,
      parseJson,
      parseTableName,
      previewRows,
      quoteIdentifier,
      sanitizeNumber,
      stripLeadingSqlComments
    };
  }
});

// backend/src/modules/model-providers/model-provider.utils.js
var require_model_provider_utils = __commonJS({
  "backend/src/modules/model-providers/model-provider.utils.js"(exports2, module2) {
    var { decryptSecret, encryptSecret } = require_data_development_utils();
    function parseExtraConfig(extraConfig) {
      if (!extraConfig) {
        return {};
      }
      if (typeof extraConfig === "object" && !Array.isArray(extraConfig)) {
        return { ...extraConfig };
      }
      try {
        const parsed = JSON.parse(extraConfig);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) {
        return {};
      }
    }
    function sanitizeHeaderValue(key, value) {
      const normalizedKey = String(key || "").toLowerCase();
      if (normalizedKey.includes("authorization") || normalizedKey.includes("api-key") || normalizedKey.includes("apikey") || normalizedKey.includes("token") || normalizedKey.includes("secret")) {
        return maskSecret(String(value || ""));
      }
      return value;
    }
    function isHeaderMapCandidate(headers) {
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        return false;
      }
      return Object.values(headers).every((value) => value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    }
    function sanitizeHeaderMap(headers) {
      if (!isHeaderMapCandidate(headers)) {
        return headers;
      }
      return Object.entries(headers).reduce((result, [key, value]) => {
        result[key] = sanitizeHeaderValue(key, value);
        return result;
      }, {});
    }
    function sanitizeExtraConfig(extraConfig) {
      const next = parseExtraConfig(extraConfig);
      ["defaultHeaders", "inferenceHeaders", "modelListHeaders"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
          next[key] = sanitizeHeaderMap(next[key]);
        }
      });
      if (next.headers && typeof next.headers === "object" && !Array.isArray(next.headers)) {
        if (isHeaderMapCandidate(next.headers)) {
          next.headers = sanitizeHeaderMap(next.headers);
        } else {
          ["default", "common", "inference", "modelList", "model_list"].forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(next.headers, key)) {
              next.headers[key] = sanitizeHeaderMap(next.headers[key]);
            }
          });
        }
      }
      return next;
    }
    function maskSecret(value) {
      const text = String(value || "");
      if (!text) {
        return "";
      }
      if (text.length <= 8) {
        return `${text.slice(0, 1)}${"*".repeat(Math.max(2, text.length - 2))}${text.slice(-1)}`;
      }
      return `${text.slice(0, 3)}${"*".repeat(Math.min(16, Math.max(6, text.length - 6)))}${text.slice(-3)}`;
    }
    function normalizeModelCatalog(catalog = [], fallbackModelName = "", fallbackModelVersion = "") {
      const source = Array.isArray(catalog) ? catalog : [];
      const grouped = /* @__PURE__ */ new Map();
      source.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }
        const name = String(item.name || item.modelName || item.label || item.value || "").trim();
        if (!name) {
          return;
        }
        const label = String(item.label || item.modelLabel || name).trim() || name;
        const rawVersions = Array.isArray(item.versions) ? item.versions : [];
        if (!grouped.has(name)) {
          grouped.set(name, {
            name,
            label,
            versions: []
          });
        }
        const bucket = grouped.get(name);
        rawVersions.forEach((versionItem) => {
          const value = String(versionItem?.value || versionItem?.id || versionItem?.modelId || versionItem?.name || "").trim();
          if (!value) {
            return;
          }
          if (!bucket.versions.some((existing) => existing.value === value)) {
            bucket.versions.push({
              value,
              label: String(versionItem?.label || versionItem?.name || value).trim() || value
            });
          }
        });
      });
      const normalized = Array.from(grouped.values()).map((item) => ({
        name: item.name,
        label: item.label,
        versions: item.versions.length ? item.versions : [{ value: item.name, label: item.label }]
      })).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
      if (normalized.length) {
        return normalized;
      }
      const fallbackName = String(fallbackModelName || "").trim();
      const fallbackVersion = String(fallbackModelVersion || fallbackModelName || "").trim();
      if (!fallbackName && !fallbackVersion) {
        return [];
      }
      return [{
        name: fallbackName || fallbackVersion,
        label: fallbackName || fallbackVersion,
        versions: [{ value: fallbackVersion || fallbackName, label: fallbackVersion || fallbackName }]
      }];
    }
    function findCatalogVersion(catalog = [], modelName, modelVersion) {
      const name = String(modelName || "").trim();
      const version = String(modelVersion || "").trim();
      if (!name || !version) {
        return null;
      }
      const modelEntry = catalog.find((item) => item.name === name);
      if (!modelEntry) {
        return null;
      }
      return modelEntry.versions.find((item) => item.value === version) || null;
    }
    function splitModelIdentity(rawValue, rawLabel) {
      const value = String(rawValue || "").trim();
      const label = String(rawLabel || value).trim() || value;
      const match = value.match(/^(.*?)(?:[-_@:/])((?:20\d{2}[-_]\d{2}[-_]\d{2})|(?:v?\d+(?:\.\d+){0,2}))$/i);
      if (match && match[1]) {
        const modelName = match[1].replace(/[-_@:/]+$/, "").trim();
        const versionToken = match[2].trim();
        if (modelName) {
          return {
            modelName,
            modelLabel: modelName,
            versionValue: value,
            versionLabel: label === value ? versionToken : label
          };
        }
      }
      return {
        modelName: value,
        modelLabel: label,
        versionValue: value,
        versionLabel: label
      };
    }
    function buildModelCatalogFromRemoteModels(models = []) {
      const grouped = /* @__PURE__ */ new Map();
      (Array.isArray(models) ? models : []).forEach((item) => {
        const value = String(item?.value || item?.id || item?.name || "").trim();
        if (!value) {
          return;
        }
        const label = String(item?.label || item?.name || value).trim() || value;
        const parsed = splitModelIdentity(value, label);
        if (!grouped.has(parsed.modelName)) {
          grouped.set(parsed.modelName, {
            name: parsed.modelName,
            label: parsed.modelLabel,
            versions: []
          });
        }
        const bucket = grouped.get(parsed.modelName);
        if (!bucket.versions.some((versionItem) => versionItem.value === parsed.versionValue)) {
          bucket.versions.push({
            value: parsed.versionValue,
            label: parsed.versionLabel
          });
        }
      });
      return normalizeModelCatalog(Array.from(grouped.values()));
    }
    function normalizeRuntimeProvider(provider) {
      if (!provider) {
        return null;
      }
      const extraConfig = parseExtraConfig(provider.extraConfig || provider.extra_config);
      const modelName = String(provider.modelName || provider.model_name || "").trim();
      const modelVersion = String(provider.modelVersion || provider.model_version || "").trim();
      return {
        id: Number(provider.id),
        configName: provider.configName || provider.config_name,
        configCode: provider.configCode || provider.config_code,
        providerType: provider.providerType || provider.provider_type,
        modelCategory: provider.modelCategory || provider.model_category,
        modelName,
        modelVersion: modelVersion || modelName,
        baseUrl: provider.baseUrl || provider.base_url || null,
        apiKey: decryptSecret(provider.apiKey || provider.api_key || ""),
        organizationId: provider.organizationId || provider.organization_id || null,
        ownerName: provider.ownerName || provider.owner_name || null,
        status: provider.status,
        description: provider.description || null,
        extraConfig,
        modelCatalog: normalizeModelCatalog(extraConfig.modelCatalog, modelName, modelVersion || modelName),
        createdAt: provider.createdAt || provider.created_at || null,
        updatedAt: provider.updatedAt || provider.updated_at || null
      };
    }
    function normalizeDisplayProvider(provider) {
      const runtimeProvider = normalizeRuntimeProvider(provider);
      if (!runtimeProvider) {
        return null;
      }
      return {
        ...runtimeProvider,
        apiKey: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
        apiKeyMasked: runtimeProvider.apiKey ? maskSecret(runtimeProvider.apiKey) : "",
        hasApiKey: Boolean(runtimeProvider.apiKey),
        extraConfig: sanitizeExtraConfig(runtimeProvider.extraConfig)
      };
    }
    function applyModelSelection(provider, selection = {}) {
      const runtimeProvider = normalizeRuntimeProvider(provider);
      if (!runtimeProvider) {
        return null;
      }
      const requestedModelName = String(selection.modelName || "").trim();
      const requestedModelVersion = String(selection.modelVersion || "").trim();
      const catalog = Array.isArray(runtimeProvider.modelCatalog) ? runtimeProvider.modelCatalog : [];
      const requestedCatalogModel = requestedModelName ? catalog.find((item) => item.name === requestedModelName) : null;
      const requestedCatalogVersion = requestedModelVersion ? catalog.flatMap((item) => item.versions || []).find((item) => item.value === requestedModelVersion) : null;
      const fallbackCatalogModel = catalog.find((item) => item.name === runtimeProvider.modelName) || catalog[0] || null;
      const selectedModelName = requestedCatalogModel?.name || fallbackCatalogModel?.name || requestedModelName || runtimeProvider.modelName;
      const selectedModelVersion = requestedCatalogVersion?.value || requestedCatalogModel?.versions?.[0]?.value || fallbackCatalogModel?.versions?.find((item) => item.value === runtimeProvider.modelVersion)?.value || fallbackCatalogModel?.versions?.[0]?.value || requestedModelVersion || runtimeProvider.modelVersion || runtimeProvider.modelName;
      return {
        ...runtimeProvider,
        modelName: selectedModelVersion,
        modelVersion: selectedModelVersion,
        selectedModelName,
        selectedModelVersion
      };
    }
    function encryptProviderSecret(apiKey) {
      return encryptSecret(String(apiKey || "").trim());
    }
    module2.exports = {
      applyModelSelection,
      buildModelCatalogFromRemoteModels,
      encryptProviderSecret,
      findCatalogVersion,
      maskSecret,
      normalizeDisplayProvider,
      normalizeModelCatalog,
      normalizeRuntimeProvider,
      parseExtraConfig
    };
  }
});

// backend/src/modules/model-providers/model-provider.service.js
var require_model_provider_service = __commonJS({
  "backend/src/modules/model-providers/model-provider.service.js"(exports2, module2) {
    var AppError = require_app_error();
    var repository = require_model_provider_repository();
    var {
      applyModelSelection,
      buildModelCatalogFromRemoteModels,
      encryptProviderSecret,
      normalizeDisplayProvider,
      normalizeModelCatalog,
      normalizeRuntimeProvider,
      parseExtraConfig
    } = require_model_provider_utils();
    async function listModelProviders() {
      const rows = await repository.listModelProviders();
      return rows.map((item) => normalizeDisplayProvider(item));
    }
    async function getModelProviderById(id) {
      const row = await repository.getModelProviderById(id);
      if (!row) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      return normalizeRuntimeProvider(row);
    }
    async function getActiveChatModelProviders() {
      const rows = await repository.listModelProviders();
      return rows.filter((item) => item.status === "active" && item.modelCategory === "chat").map((item) => normalizeRuntimeProvider(item));
    }
    function normalizeProviderPayload(payload, existing = null) {
      const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
      const extraConfig = parseExtraConfig(payload.extraConfig);
      const selectedModelName = String(payload.modelName || existingRuntime?.modelName || "").trim();
      const selectedModelVersion = String(payload.modelVersion || existingRuntime?.modelVersion || selectedModelName).trim();
      return {
        ...payload,
        modelName: selectedModelName,
        modelVersion: selectedModelVersion || selectedModelName,
        apiKey: payload.apiKey ? encryptProviderSecret(payload.apiKey) : existing?.apiKey || "",
        extraConfig: {
          ...extraConfig,
          modelCatalog: normalizeModelCatalog(
            extraConfig.modelCatalog,
            selectedModelName,
            selectedModelVersion || selectedModelName
          )
        }
      };
    }
    async function resolveRuntimePayload(payload) {
      const existing = payload.id ? await repository.getModelProviderById(Number(payload.id)) : null;
      if (payload.id && !existing) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      const existingRuntime = existing ? normalizeRuntimeProvider(existing) : null;
      return {
        ...payload,
        providerType: payload.providerType || existingRuntime?.providerType,
        modelCategory: payload.modelCategory || existingRuntime?.modelCategory || "chat",
        baseUrl: payload.baseUrl || existingRuntime?.baseUrl,
        apiKey: payload.apiKey || existingRuntime?.apiKey,
        organizationId: Object.prototype.hasOwnProperty.call(payload, "organizationId") ? payload.organizationId : existingRuntime?.organizationId,
        extraConfig: {
          ...existingRuntime?.extraConfig || {},
          ...parseExtraConfig(payload.extraConfig)
        }
      };
    }
    async function createModelProvider(payload) {
      try {
        if (!payload.apiKey) {
          throw new AppError("API Key \u4E0D\u80FD\u4E3A\u7A7A", 400);
        }
        const row = await repository.createModelProvider(normalizeProviderPayload(payload));
        return normalizeDisplayProvider(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function updateModelProvider(id, payload) {
      try {
        const existing = await repository.getModelProviderById(id);
        if (!existing) {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
        }
        const row = await repository.updateModelProvider(id, normalizeProviderPayload(payload, existing));
        if (!row) {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
        }
        return normalizeDisplayProvider(row);
      } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
          throw new AppError("\u6A21\u578B\u914D\u7F6E\u7F16\u7801\u5DF2\u5B58\u5728", 409);
        }
        throw error;
      }
    }
    async function deleteModelProvider(id) {
      const deleted = await repository.deleteModelProvider(id);
      if (!deleted) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
    }
    async function testModelProvider(payload) {
      const runtimePayload = await resolveRuntimePayload(payload);
      const extraConfig = runtimePayload.extraConfig || {};
      try {
        if (runtimePayload.providerType === "anthropic") {
          return await testAnthropicProvider(runtimePayload, extraConfig);
        }
        return await testOpenAICompatibleProvider(runtimePayload, extraConfig);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u6D4B\u8BD5\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function generateChatCompletion(providerConfig, messages, options = {}) {
      const runtimeProvider = normalizeRuntimeProvider(providerConfig);
      if (!runtimeProvider) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      if (runtimeProvider.status !== "active") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528", 400);
      }
      if (runtimeProvider.modelCategory !== "chat") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u4E0D\u662F\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError("\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const extraConfig = runtimeProvider.extraConfig || {};
      try {
        if (runtimeProvider.providerType === "anthropic") {
          return await generateAnthropicCompletion(runtimeProvider, messages, options, extraConfig);
        }
        if (resolveInferenceWireApi(extraConfig) === "responses") {
          return await generateResponsesCompletion(runtimeProvider, messages, options, extraConfig);
        }
        return await generateOpenAICompatibleCompletion(runtimeProvider, messages, options, extraConfig);
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u8C03\u7528\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function generateChatCompletionStream(providerConfig, messages, options = {}, onDelta) {
      const runtimeProvider = normalizeRuntimeProvider(providerConfig);
      if (!runtimeProvider) {
        throw new AppError("\u6A21\u578B\u914D\u7F6E\u4E0D\u5B58\u5728", 404);
      }
      if (runtimeProvider.status !== "active") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u672A\u542F\u7528", 400);
      }
      if (runtimeProvider.modelCategory !== "chat") {
        throw new AppError("\u5F53\u524D\u6A21\u578B\u914D\u7F6E\u4E0D\u662F\u5BF9\u8BDD\u6A21\u578B", 400);
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new AppError("\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      const extraConfig = runtimeProvider.extraConfig || {};
      try {
        if (runtimeProvider.providerType === "anthropic") {
          return await generateAnthropicCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
        }
        if (resolveInferenceWireApi(extraConfig) === "responses") {
          return await generateResponsesCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
        }
        return await generateOpenAICompatibleCompletionStream(runtimeProvider, messages, options, extraConfig, onDelta);
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${error.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
      }
    }
    async function testOpenAICompatibleProvider(payload, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "model_list");
      const timeoutMs = Number(extraConfig.timeoutMs || 2e4);
      const { models, checkedEndpoint } = await fetchRemoteModelList({
        providerType: payload.providerType,
        baseUrl,
        headers,
        timeoutMs,
        extraConfig
      });
      const modelCatalog = buildModelCatalogFromRemoteModels(models);
      return {
        success: true,
        message: "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F\uFF0C\u5DF2\u62C9\u53D6\u6A21\u578B\u5217\u8868",
        providerType: payload.providerType,
        modelName: null,
        modelVersion: null,
        checkedEndpoint,
        models,
        modelCatalog
      };
    }
    async function generateOpenAICompatibleCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
      const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig);
      const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs,
        (parsed) => Boolean(extractOpenAICompatibleContent(parsed)),
        "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
        {
          disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
          primaryEndpointOnly: Boolean(options.primaryEndpointOnly)
        }
      );
      const content = extractOpenAICompatibleContent(data);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, data, adapted, {
          contentMissing: true
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: {
          ...data,
          checkedEndpoint,
          adapted
        }
      };
    }
    async function generateOpenAICompatibleCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType, extraConfig);
      const body = buildChatCompletionsRequestBody(payload, messages, options, extraConfig, true);
      const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs
      );
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      let streamErrorMessage = "";
      async function consumeFrame(rawFrame) {
        const line = String(rawFrame || "").trim();
        if (!line) return;
        const dataText = line.startsWith("data:") ? line.slice(5).trim() : line;
        if (!dataText || dataText === "[DONE]") return;
        let parsed;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          return;
        }
        const parsedError = extractErrorMessage(parsed);
        if (parsedError) {
          streamErrorMessage = parsedError;
        }
        const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : null;
        const deltaValue = choice?.delta?.content;
        const deltaText = typeof deltaValue === "string" ? deltaValue : Array.isArray(deltaValue) ? deltaValue.map((item) => typeof item?.text === "string" ? item.text : "").join("") : extractOpenAICompatibleContent(parsed);
        if (deltaText) {
          content += deltaText;
          if (typeof onDelta === "function") {
            await onDelta(deltaText);
          }
        }
      }
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          await consumeFrame(frame);
        }
      }
      buffer += decoder.decode();
      await consumeFrame(buffer);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", checkedEndpoint, buildInferenceEndpoints(baseUrl, "chat/completions", payload.providerType), 200, streamErrorMessage ? { error: streamErrorMessage } : {}, null, {
          contentMissing: true,
          interfaceLabel: "OpenAI chat.completions"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: null
      };
    }
    async function generateResponsesCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
      const body = buildResponsesRequestBody(payload, messages, options, extraConfig);
      const { data, checkedEndpoint, adapted } = await requestOpenAICompatibleJson(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs,
        (parsed) => Boolean(extractResponsesContent(parsed)),
        "\u6A21\u578B\u8C03\u7528\u5931\u8D25",
        {
          interfaceLabel: "OpenAI Responses API",
          disableAdaptiveRetry: Boolean(options.disableAdaptiveRetry),
          primaryEndpointOnly: Boolean(options.primaryEndpointOnly)
        }
      );
      const content = extractResponsesContent(data);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, data, adapted, {
          contentMissing: true,
          interfaceLabel: "OpenAI Responses API"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: {
          ...data,
          checkedEndpoint,
          adapted
        }
      };
    }
    async function generateResponsesCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const headers = buildOpenAICompatibleHeaders(payload, extraConfig, "inference");
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const endpointCandidates = buildInferenceEndpoints(baseUrl, "responses", payload.providerType, extraConfig);
      const body = buildResponsesRequestBody(payload, messages, options, extraConfig, true);
      const { response, checkedEndpoint } = await requestOpenAICompatibleStreamDetailed(
        endpointCandidates,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: options.signal
        },
        timeoutMs
      );
      const { content, finalResponse } = await readResponsesSseStream(response, onDelta);
      if (!content) {
        throw buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", checkedEndpoint, endpointCandidates, 200, finalResponse || {}, null, {
          contentMissing: true,
          interfaceLabel: "OpenAI Responses API"
        });
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: finalResponse || null
      };
    }
    async function testAnthropicProvider(payload, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(extraConfig.timeoutMs || 2e4);
      const headers = mergeExtraHeaders({
        "Content-Type": "application/json",
        "x-api-key": payload.apiKey,
        "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
      }, extraConfig, "model_list");
      const { models, checkedEndpoint } = await fetchRemoteModelList({
        providerType: payload.providerType,
        baseUrl,
        headers,
        timeoutMs,
        extraConfig
      });
      const modelCatalog = buildModelCatalogFromRemoteModels(models);
      return {
        success: true,
        message: "\u6A21\u578B\u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F\uFF0C\u5DF2\u62C9\u53D6\u6A21\u578B\u5217\u8868",
        providerType: payload.providerType,
        modelName: null,
        modelVersion: null,
        checkedEndpoint,
        models,
        modelCatalog
      };
    }
    async function generateAnthropicCompletion(payload, messages, options, extraConfig) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const systemMessage = messages.find((item) => item.role === "system")?.content || "";
      const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
      const response = await fetchWithTimeoutRespectAbort(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: mergeExtraHeaders({
            "Content-Type": "application/json",
            "x-api-key": payload.apiKey,
            "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
          }, extraConfig, "inference"),
          body: JSON.stringify({
            model: payload.modelName,
            system: systemMessage || void 0,
            max_tokens: options.maxTokens ?? 1200,
            messages: userMessages
          }),
          signal: options.signal
        },
        timeoutMs
      );
      const data = await parseJsonSafely(response);
      if (!response.ok) {
        throw new AppError(`\u6A21\u578B\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
      }
      const content = extractAnthropicContent(data);
      if (!content) {
        throw new AppError("\u6A21\u578B\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u5185\u5BB9", 400);
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: data
      };
    }
    async function generateAnthropicCompletionStream(payload, messages, options, extraConfig, onDelta) {
      const baseUrl = normalizeBaseUrl(payload.baseUrl);
      const timeoutMs = Number(options.timeoutMs || extraConfig.timeoutMs || 3e4);
      const systemMessage = messages.find((item) => item.role === "system")?.content || "";
      const userMessages = messages.filter((item) => item.role !== "system").map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }));
      const response = await fetchWithTimeout(
        `${baseUrl}/v1/messages`,
        {
          method: "POST",
          headers: mergeExtraHeaders({
            "Content-Type": "application/json",
            "x-api-key": payload.apiKey,
            "anthropic-version": extraConfig.anthropicVersion || "2023-06-01"
          }, extraConfig, "inference"),
          body: JSON.stringify({
            model: payload.modelName,
            system: systemMessage || void 0,
            max_tokens: options.maxTokens ?? 1200,
            messages: userMessages,
            stream: true
          }),
          signal: options.signal
        },
        timeoutMs
      );
      if (!response.ok) {
        const data = await parseJsonSafely(response);
        throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
      }
      if (!response.body) {
        throw new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const dataText = line.slice(5).trim();
          if (!dataText || dataText === "[DONE]") continue;
          let parsed;
          try {
            parsed = JSON.parse(dataText);
          } catch {
            continue;
          }
          const deltaText = parsed?.delta?.text || parsed?.content_block?.text || "";
          if (deltaText) {
            content += deltaText;
            if (typeof onDelta === "function") {
              await onDelta(deltaText);
            }
          }
        }
      }
      return {
        providerId: payload.id,
        providerType: payload.providerType,
        modelName: payload.modelName,
        content,
        raw: null
      };
    }
    function buildInferenceEndpoints(baseUrl, resourcePath, providerType = "", extraConfig = {}) {
      const defaultEndpoints = buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType);
      return resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, getInferenceEndpointConfigKeys(resourcePath), "inference");
    }
    function buildDefaultInferenceEndpoints(baseUrl, resourcePath, providerType = "") {
      const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
      if (/\/v1$/i.test(normalizedBaseUrl)) {
        return [`${normalizedBaseUrl}/${resourcePath}`];
      }
      if (String(providerType).toLowerCase() === "custom") {
        return [`${normalizedBaseUrl}/v1/${resourcePath}`, `${normalizedBaseUrl}/${resourcePath}`];
      }
      return [`${normalizedBaseUrl}/${resourcePath}`, `${normalizedBaseUrl}/v1/${resourcePath}`];
    }
    function getInferenceEndpointConfigKeys(resourcePath = "") {
      const keys = [
        "inferencePath",
        "inference_path",
        "endpoints.inference"
      ];
      if (resourcePath === "responses") {
        keys.push("responsesPath", "responses_path", "endpoints.responses");
      }
      if (resourcePath === "chat/completions") {
        keys.push("chatCompletionsPath", "chat_completions_path", "endpoints.chatCompletions", "endpoints.chat_completions");
      }
      return keys;
    }
    function resolveEndpointCandidates(baseUrl, defaultEndpoints, extraConfig, configKeys, scope = "inference") {
      const configuredEndpoints = resolveConfiguredEndpoints(extraConfig, configKeys).map((item) => resolveEndpointUrl(baseUrl, item)).filter(Boolean);
      const disableFallback = resolveDisableFallback(extraConfig, scope);
      if (configuredEndpoints.length) {
        return [...new Set(disableFallback ? configuredEndpoints : [...configuredEndpoints, ...defaultEndpoints])];
      }
      if (disableFallback && defaultEndpoints.length > 1) {
        return [...new Set(defaultEndpoints.slice(0, 1))];
      }
      return [...new Set(defaultEndpoints)];
    }
    function resolveConfiguredEndpoints(extraConfig = {}, configKeys = []) {
      const rawValue = resolveConfigValue(extraConfig, configKeys);
      if (Array.isArray(rawValue)) {
        return rawValue.map((item) => String(item || "").trim()).filter(Boolean);
      }
      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          return [];
        }
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              return parsed.map((item) => String(item || "").trim()).filter(Boolean);
            }
          } catch {
            return [trimmed];
          }
        }
        return [trimmed];
      }
      if (isPlainObject(rawValue)) {
        const candidate = rawValue.url || rawValue.path || rawValue.endpoint;
        return candidate ? [String(candidate).trim()].filter(Boolean) : [];
      }
      return [];
    }
    function resolveEndpointUrl(baseUrl, rawEndpoint) {
      const endpoint = String(rawEndpoint || "").trim();
      if (!endpoint) {
        return "";
      }
      if (/^https?:\/\//i.test(endpoint)) {
        return endpoint.replace(/\/+$/, "");
      }
      const normalizedBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
      if (!normalizedBaseUrl) {
        return endpoint;
      }
      try {
        return new URL(endpoint, `${normalizedBaseUrl}/`).toString().replace(/\/+$/, "");
      } catch {
        return `${normalizedBaseUrl}/${endpoint.replace(/^\/+/, "")}`;
      }
    }
    function resolveDisableFallback(extraConfig = {}, scope = "inference") {
      const scopeKeys = scope === "model_list" ? [
        "disableModelListFallback",
        "disable_model_list_fallback",
        "endpoints.disableModelListFallback",
        "endpoints.disable_model_list_fallback"
      ] : [
        "disableInferenceFallback",
        "disable_inference_fallback",
        "endpoints.disableInferenceFallback",
        "endpoints.disable_inference_fallback"
      ];
      const scopedValue = resolveBooleanConfig(extraConfig, scopeKeys);
      if (typeof scopedValue === "boolean") {
        return scopedValue;
      }
      return resolveBooleanConfig(extraConfig, [
        "disableFallbackEndpoints",
        "disable_fallback_endpoints",
        "endpoints.disableFallback",
        "endpoints.disable_fallback"
      ]) === true;
    }
    function resolveBooleanConfig(extraConfig = {}, keys = []) {
      const rawValue = resolveConfigValue(extraConfig, keys);
      if (rawValue === void 0) {
        return void 0;
      }
      if (typeof rawValue === "boolean") {
        return rawValue;
      }
      if (typeof rawValue === "number") {
        return rawValue !== 0;
      }
      if (typeof rawValue === "string") {
        const normalized = rawValue.trim().toLowerCase();
        if (!normalized) {
          return void 0;
        }
        if (["true", "1", "yes", "on"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no", "off"].includes(normalized)) {
          return false;
        }
      }
      return Boolean(rawValue);
    }
    function resolveConfigValue(source, keyPaths = []) {
      for (const keyPath of keyPaths) {
        const resolved = resolveConfigPathValue(source, keyPath);
        if (resolved !== void 0) {
          return resolved;
        }
      }
      return void 0;
    }
    function resolveConfigPathValue(source, keyPath) {
      const segments = String(keyPath || "").split(".").filter(Boolean);
      let current = source;
      for (const segment of segments) {
        if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) {
          return void 0;
        }
        current = current[segment];
      }
      return current;
    }
    async function requestOpenAICompatibleJson(endpointCandidates, init, timeoutMs, validator, errorPrefix, errorOptions = {}) {
      let lastError = null;
      const activeEndpointCandidates = errorOptions.primaryEndpointOnly ? endpointCandidates.slice(0, 1) : endpointCandidates;
      for (const endpoint of activeEndpointCandidates) {
        const adaptiveInit = errorOptions.disableAdaptiveRetry ? null : buildAdaptiveRetryInit(init);
        try {
          const response = await fetchWithTimeoutRespectAbort(endpoint, init, timeoutMs);
          const data = await parseJsonSafely(response);
          if (!response.ok) {
            if (adaptiveInit && shouldRetrySameModel(response.status, data)) {
              const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
              if (retried) {
                return { ...retried, adapted: true };
              }
            }
            lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, errorOptions);
            continue;
          }
          if (typeof validator === "function" && !validator(data)) {
            if (adaptiveInit) {
              const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
              if (retried) {
                return { ...retried, adapted: true };
              }
            }
            lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, response.status, data, adaptiveInit, {
              ...errorOptions,
              contentMissing: true
            });
            continue;
          }
          return {
            data,
            checkedEndpoint: endpoint,
            adapted: false
          };
        } catch (error) {
          if (error?.name === "AbortError") {
            throw error;
          }
          if (adaptiveInit && shouldRetrySameModel(void 0, { error: error?.message || error })) {
            const retried = await tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator);
            if (retried) {
              return { ...retried, adapted: true };
            }
          }
          lastError = buildModelCallAppError(errorPrefix, endpoint, activeEndpointCandidates, void 0, { error: error?.message || error }, adaptiveInit, errorOptions);
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`${errorPrefix}: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    async function tryAdaptiveRequest(endpoint, adaptiveInit, timeoutMs, validator) {
      try {
        const response = await fetchWithTimeout(endpoint, adaptiveInit, timeoutMs);
        const data = await parseJsonSafely(response);
        if (!response.ok) {
          return null;
        }
        if (typeof validator === "function" && !validator(data)) {
          return null;
        }
        return {
          data,
          checkedEndpoint: endpoint
        };
      } catch {
        return null;
      }
    }
    function buildAdaptiveRetryInit(init) {
      const bodyText = typeof init?.body === "string" ? init.body : "";
      if (!bodyText) {
        return null;
      }
      try {
        const parsed = JSON.parse(bodyText);
        const nextBody = { ...parsed };
        let changed = false;
        if (typeof nextBody.max_tokens === "number" && nextBody.max_tokens > 512) {
          nextBody.max_tokens = 512;
          changed = true;
        }
        if (typeof nextBody.max_output_tokens === "number" && nextBody.max_output_tokens > 512) {
          nextBody.max_output_tokens = 512;
          changed = true;
        }
        if (typeof nextBody.temperature === "number" && nextBody.temperature > 0.1) {
          nextBody.temperature = 0.1;
          changed = true;
        }
        if (nextBody.response_format) {
          delete nextBody.response_format;
          changed = true;
        }
        if (nextBody.text && typeof nextBody.text === "object" && !Array.isArray(nextBody.text) && nextBody.text.format) {
          nextBody.text = { ...nextBody.text };
          delete nextBody.text.format;
          if (Object.keys(nextBody.text).length === 0) {
            delete nextBody.text;
          }
          changed = true;
        }
        if (!changed) {
          return null;
        }
        return {
          ...init,
          body: JSON.stringify(nextBody)
        };
      } catch {
        return null;
      }
    }
    function shouldRetrySameModel(status, data) {
      const normalizedError = String(extractErrorMessage(data) || data?.raw || data?.error || "").toLowerCase();
      return status === 502 || status === 503 || status === 504 || normalizedError.includes("timeout") || normalizedError.includes("timed out") || normalizedError.includes("\u8D85\u65F6") || normalizedError.includes("terminated") || normalizedError.includes("bad gateway") || normalizedError.includes("<!doctype html>") || normalizedError.includes("<html");
    }
    function buildModelCallAppError(errorPrefix, attemptedEndpoint, endpointCandidates, status, data, adaptiveInit, options = {}) {
      const rawText = typeof data?.raw === "string" ? data.raw : "";
      const extractedMessage = extractErrorMessage(data) || rawText || (status ? `HTTP ${status}` : "unknown error");
      const lowerMessage = String(extractedMessage).toLowerCase();
      const suggestions = [];
      const interfaceLabel = options.interfaceLabel || "OpenAI chat.completions";
      if (lowerMessage.includes("<!doctype html>") || lowerMessage.includes("<html")) {
        suggestions.push("\u63A5\u53E3\u8FD4\u56DE\u4E86 HTML \u9875\u9762\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u5730\u5740\u662F\u5426\u5E94\u5305\u542B /v1\uFF0C\u6216\u786E\u8BA4\u8BE5\u5730\u5740\u786E\u5B9E\u662F OpenAI \u517C\u5BB9 API\u3002");
      }
      if (status === 502 || status === 503 || status === 504 || lowerMessage.includes("terminated") || lowerMessage.includes("bad gateway")) {
        suggestions.push("\u4E0A\u6E38\u7F51\u5173\u4E2D\u65AD\u4E86\u5F53\u524D\u8BF7\u6C42\uFF0C\u5EFA\u8BAE\u7F29\u77ED\u8F93\u5165\u4E0A\u4E0B\u6587\u3001\u51CF\u5C11\u8FD4\u56DE\u957F\u5EA6\uFF0C\u6216\u7A0D\u540E\u91CD\u8BD5\u3002");
      }
      if (options.contentMissing) {
        suggestions.push("\u6A21\u578B\u5DF2\u8FD4\u56DE\u54CD\u5E94\uFF0C\u4F46\u5F53\u524D\u8FD4\u56DE\u7ED3\u6784\u672A\u88AB\u8BC6\u522B\u4E3A\u6709\u6548\u5185\u5BB9\uFF0C\u8BF7\u68C0\u67E5\u7F51\u5173\u8FD4\u56DE\u683C\u5F0F\u662F\u5426\u5B8C\u5168\u517C\u5BB9 OpenAI chat.completions\u3002");
      }
      if (adaptiveInit) {
        suggestions.push("\u7CFB\u7EDF\u5DF2\u5C1D\u8BD5\u4F7F\u7528\u540C\u6A21\u578B\u7684\u4FDD\u5B88\u53C2\u6570\u91CD\u8BD5\u4E00\u6B21\uFF1A\u964D\u4F4E max_tokens\u3001\u964D\u4F4E temperature\uFF0C\u5E76\u79FB\u9664 response_format\u3002");
      }
      return new AppError(`${errorPrefix}: ${extractedMessage}`, 400, {
        attemptedEndpoint,
        endpointCandidates,
        suggestions,
        recommendedMaxTokens: 512
      });
    }
    async function requestOpenAICompatibleStreamDetailed(endpointCandidates, init, timeoutMs) {
      let lastError = null;
      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetchWithTimeout(endpoint, init, timeoutMs);
          if (!response.ok) {
            const data = await parseJsonSafely(response);
            lastError = buildModelCallAppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25", endpoint, endpointCandidates, response.status, data, null, {
              interfaceLabel: "OpenAI chat.completions"
            });
            continue;
          }
          const contentType = String(response.headers.get("content-type") || "").toLowerCase();
          if (contentType.includes("text/html")) {
            const data = await parseJsonSafely(response);
            lastError = new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(data) || "\u63A5\u53E3\u8FD4\u56DE HTML \u9875\u9762"}`, 400);
            continue;
          }
          if (!response.body) {
            lastError = new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
            continue;
          }
          return {
            response,
            checkedEndpoint: endpoint
          };
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    async function fetchRemoteModelList({ providerType, baseUrl, headers, timeoutMs, extraConfig }) {
      const endpointCandidates = buildModelListEndpoints(providerType, baseUrl, extraConfig);
      let lastError = null;
      for (const endpoint of endpointCandidates) {
        try {
          const response = await fetchWithTimeout(
            endpoint,
            {
              method: "GET",
              headers
            },
            timeoutMs
          );
          const data = await parseJsonSafely(response);
          if (!response.ok) {
            lastError = new AppError(`\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: ${extractErrorMessage(data) || response.statusText}`, 400);
            continue;
          }
          const models = normalizeRemoteModelList(data);
          if (!models.length) {
            lastError = new AppError("\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: \u8FDC\u7AEF\u672A\u8FD4\u56DE\u53EF\u7528\u6A21\u578B\u5217\u8868", 400);
            continue;
          }
          return {
            checkedEndpoint: endpoint,
            models
          };
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError instanceof AppError) {
        throw lastError;
      }
      throw new AppError(`\u6A21\u578B\u5217\u8868\u83B7\u53D6\u5931\u8D25: ${lastError?.message || "\u672A\u77E5\u9519\u8BEF"}`, 400);
    }
    function buildModelListEndpoints(providerType, baseUrl, extraConfig = {}) {
      const endpoints = [];
      const normalizedProviderType = String(providerType || "").toLowerCase();
      if (normalizedProviderType === "anthropic") {
        endpoints.push(`${baseUrl}/v1/models`);
        return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
          "modelListPath",
          "model_list_path",
          "endpoints.modelList",
          "endpoints.model_list"
        ], "model_list");
      }
      if (normalizedProviderType === "azure_openai") {
        const apiVersion = String(extraConfig.apiVersion || "2024-10-21");
        endpoints.push(`${baseUrl}/openai/models?api-version=${encodeURIComponent(apiVersion)}`);
        endpoints.push(`${baseUrl}/openai/deployments?api-version=${encodeURIComponent(apiVersion)}`);
      }
      if (normalizedProviderType === "custom") {
        if (/\/v1$/i.test(baseUrl)) {
          endpoints.push(`${baseUrl}/models`);
        } else {
          endpoints.push(`${baseUrl}/v1/models`);
          endpoints.push(`${baseUrl}/models`);
        }
        return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
          "modelListPath",
          "model_list_path",
          "endpoints.modelList",
          "endpoints.model_list"
        ], "model_list");
      }
      endpoints.push(`${baseUrl}/models`);
      if (!/\/v1$/i.test(baseUrl)) {
        endpoints.push(`${baseUrl}/v1/models`);
      }
      return resolveEndpointCandidates(baseUrl, endpoints, extraConfig, [
        "modelListPath",
        "model_list_path",
        "endpoints.modelList",
        "endpoints.model_list"
      ], "model_list");
    }
    function normalizeRemoteModelList(data) {
      const source = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : Array.isArray(data?.result) ? data.result : Array.isArray(data?.items) ? data.items : [];
      const models = source.map((item) => normalizeRemoteModel(item)).filter(Boolean);
      const unique = /* @__PURE__ */ new Map();
      models.forEach((item) => {
        if (!unique.has(item.value)) {
          unique.set(item.value, item);
        }
      });
      return Array.from(unique.values());
    }
    function normalizeRemoteModel(item) {
      if (typeof item === "string") {
        return { value: item, label: item };
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const value = String(item.id || item.name || item.model || item.model_name || item.deployment_id || item.deploymentId || "").trim();
      if (!value) {
        return null;
      }
      const displayName = String(item.display_name || item.displayName || item.name || item.id || item.model || value).trim();
      return {
        value,
        label: displayName === value ? value : `${displayName} (${value})`
      };
    }
    function buildOpenAICompatibleHeaders(payload, extraConfig, scope = "inference") {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${payload.apiKey}`
      };
      if (payload.organizationId && payload.providerType === "openai") {
        headers["OpenAI-Organization"] = payload.organizationId;
      }
      if (payload.providerType === "azure_openai") {
        delete headers.Authorization;
        headers["api-key"] = payload.apiKey;
      }
      return mergeExtraHeaders(headers, extraConfig, scope);
    }
    function mergeExtraHeaders(baseHeaders, extraConfig, scope = "inference") {
      const commonHeaders = resolveConfiguredHeaders(extraConfig, [
        "defaultHeaders",
        "default_headers",
        "headers.default",
        "headers.common",
        "headers"
      ]);
      const scopedHeaders = scope === "model_list" ? resolveConfiguredHeaders(extraConfig, [
        "modelListHeaders",
        "model_list_headers",
        "headers.modelList",
        "headers.model_list"
      ]) : resolveConfiguredHeaders(extraConfig, [
        "inferenceHeaders",
        "inference_headers",
        "requestHeaders",
        "request_headers",
        "headers.inference"
      ]);
      return mergeHeaderMaps(baseHeaders, commonHeaders, scopedHeaders);
    }
    function resolveConfiguredHeaders(extraConfig, keyPaths = []) {
      const rawValue = resolveConfigValue(extraConfig, keyPaths);
      return isHeaderMapObject(rawValue) ? rawValue : {};
    }
    function isHeaderMapObject(headers) {
      if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
        return false;
      }
      return Object.values(headers).every((value) => value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean");
    }
    function mergeHeaderMaps(...headerMaps) {
      const merged = /* @__PURE__ */ new Map();
      headerMaps.forEach((headers) => {
        if (!isHeaderMapObject(headers)) {
          return;
        }
        Object.entries(headers).forEach(([key, value]) => {
          const headerKey = String(key || "").trim();
          if (!headerKey) {
            return;
          }
          const normalizedHeaderKey = headerKey.toLowerCase();
          if (value == null) {
            merged.delete(normalizedHeaderKey);
            return;
          }
          merged.set(normalizedHeaderKey, {
            key: headerKey,
            value: String(value)
          });
        });
      });
      return Array.from(merged.values()).reduce((result, item) => {
        result[item.key] = item.value;
        return result;
      }, {});
    }
    function isPlainObject(value) {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
    function parseConfigObject(value) {
      if (isPlainObject(value)) {
        return value;
      }
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return null;
      }
      try {
        const parsed = JSON.parse(trimmed);
        return isPlainObject(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    function cloneConfigValue(value) {
      if (Array.isArray(value)) {
        return value.map((item) => cloneConfigValue(item));
      }
      if (isPlainObject(value)) {
        return Object.entries(value).reduce((result, [key, itemValue]) => {
          result[key] = cloneConfigValue(itemValue);
          return result;
        }, {});
      }
      return value;
    }
    function mergeConfigObjects(target, override) {
      const base = isPlainObject(target) ? cloneConfigValue(target) : {};
      const nextOverride = parseConfigObject(override);
      if (!nextOverride) {
        return base;
      }
      Object.entries(nextOverride).forEach(([key, value]) => {
        if (value == null) {
          delete base[key];
          return;
        }
        if (isPlainObject(base[key]) && isPlainObject(value)) {
          base[key] = mergeConfigObjects(base[key], value);
          return;
        }
        base[key] = cloneConfigValue(value);
      });
      return base;
    }
    function normalizeBaseUrl(baseUrl) {
      if (!baseUrl) {
        throw new AppError("\u63A5\u53E3\u5730\u5740\u4E0D\u80FD\u4E3A\u7A7A", 400);
      }
      return String(baseUrl).replace(/\/+$/, "");
    }
    async function fetchWithTimeout(url, init, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (error.name === "AbortError") {
          throw new AppError("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u6216\u9274\u6743\u4FE1\u606F", 400);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    async function fetchWithTimeoutRespectAbort(url, init, timeoutMs) {
      const controller = new AbortController();
      const externalSignal = init?.signal;
      let abortedByCaller = false;
      const handleExternalAbort = () => {
        abortedByCaller = true;
        controller.abort();
      };
      if (externalSignal) {
        if (externalSignal.aborted) {
          abortedByCaller = true;
          controller.abort();
        } else {
          externalSignal.addEventListener("abort", handleExternalAbort, { once: true });
        }
      }
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (error.name === "AbortError") {
          if (abortedByCaller) {
            throw error;
          }
          throw new AppError("\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u63A5\u53E3\u5730\u5740\u6216\u9274\u6743\u4FE1\u606F", 400);
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", handleExternalAbort);
        }
      }
    }
    async function parseJsonSafely(response) {
      const text = await response.text();
      if (!text) {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch (error) {
        return { raw: text };
      }
    }
    function extractErrorMessage(data) {
      if (!data) {
        return "";
      }
      if (typeof data.message === "string") {
        return sanitizeErrorText(data.message);
      }
      if (typeof data.error === "string") {
        return sanitizeErrorText(data.error);
      }
      if (data.error && typeof data.error.message === "string") {
        return sanitizeErrorText(data.error.message);
      }
      const choice = Array.isArray(data.choices) ? data.choices[0] : null;
      const message = choice?.message || {};
      const content = typeof message.content === "string" ? message.content.trim() : "";
      const reasoningContent = typeof message.reasoning_content === "string" ? message.reasoning_content.trim() : "";
      if (!content && reasoningContent) {
        return choice?.finish_reason === "length" ? "\u6A21\u578B\u7684\u601D\u8003\u4EE4\u724C\u5DF2\u8017\u5C3D\uFF0C\u5C1A\u672A\u751F\u6210\u6700\u7EC8\u7B54\u6848\uFF1B\u8BF7\u5173\u95ED\u6DF1\u5EA6\u601D\u8003\u6216\u63D0\u9AD8\u8F93\u51FA Token \u4E0A\u9650" : "\u6A21\u578B\u4EC5\u8FD4\u56DE\u4E86\u601D\u8003\u8FC7\u7A0B\uFF0C\u672A\u751F\u6210\u6700\u7EC8\u7B54\u6848\uFF1B\u8BF7\u68C0\u67E5\u6DF1\u5EA6\u601D\u8003\u53C2\u6570\u4E0E\u8F93\u51FA Token \u4E0A\u9650";
      }
      if (typeof data.raw === "string") {
        return sanitizeErrorText(data.raw);
      }
      return "";
    }
    function sanitizeErrorText(value) {
      const raw = String(value || "");
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower.includes("<!doctype html>") || lower.includes("<html")) {
        return "\u63A5\u53E3\u8FD4\u56DE HTML \u9875\u9762\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u5730\u5740\u662F\u5426\u4E3A OpenAI \u517C\u5BB9 API\uFF08\u901A\u5E38\u9700\u8981 /v1\uFF09\u3002";
      }
      return raw.replace(/\s+/g, " ").trim().slice(0, 300);
    }
    function extractOpenAICompatibleContent(data) {
      const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
      const messageContent = choice?.message?.content;
      if (typeof messageContent === "string") {
        return messageContent;
      }
      if (messageContent && typeof messageContent === "object" && !Array.isArray(messageContent)) {
        return JSON.stringify(messageContent);
      }
      if (Array.isArray(messageContent)) {
        const text = messageContent.map((item) => {
          if (typeof item?.text === "string") return item.text;
          if (typeof item?.output_text === "string") return item.output_text;
          if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
          return "";
        }).filter(Boolean).join("\n");
        if (text) return text;
        const firstJsonLike = messageContent.find((item) => item && typeof item === "object" && !Array.isArray(item));
        if (firstJsonLike) return JSON.stringify(firstJsonLike);
      }
      if (typeof choice?.text === "string") {
        return choice.text;
      }
      return "";
    }
    function extractResponsesContent(data) {
      if (typeof data?.output_text === "string" && data.output_text.trim()) {
        return data.output_text;
      }
      const output = Array.isArray(data?.output) ? data.output : [];
      return output.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        if (Array.isArray(item.content)) return item.content;
        return [item];
      }).map((item) => {
        if (typeof item?.text === "string") return item.text;
        if (typeof item?.output_text === "string") return item.output_text;
        if (typeof item?.refusal === "string") return item.refusal;
        if (item && typeof item === "object" && item?.json && typeof item.json === "object") return JSON.stringify(item.json);
        return "";
      }).filter(Boolean).join("\n");
    }
    function resolveInferenceWireApi(extraConfig = {}) {
      const wireApi = String(extraConfig?.wireApi || extraConfig?.wire_api || "").trim().toLowerCase();
      return wireApi === "responses" ? "responses" : "chat_completions";
    }
    function buildChatCompletionsRequestBody(payload, messages, options, extraConfig, stream = false) {
      const body = {
        model: payload.modelName,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1200
      };
      if (stream) {
        body.stream = true;
      }
      if (options.responseFormat) {
        body.response_format = options.responseFormat;
      }
      return applyReasoningRequestControls(
        applyInferenceRequestBodyOverrides(body, extraConfig, "chat_completions"),
        payload,
        options,
        "chat_completions"
      );
    }
    function buildResponsesRequestBody(payload, messages, options, extraConfig, stream = false) {
      const inputMode = resolveResponsesInputMode(extraConfig);
      const body = {
        model: payload.modelName,
        input: buildResponsesInput(messages, inputMode),
        temperature: options.temperature ?? 0.2,
        max_output_tokens: options.maxTokens ?? 1200
      };
      const instructions = buildResponsesInstructions(messages, inputMode);
      if (instructions) {
        body.instructions = instructions;
      }
      if (stream) {
        body.stream = true;
      }
      const textFormat = normalizeResponsesTextFormat(options.responseFormat);
      if (textFormat) {
        body.text = { format: textFormat };
      }
      if (resolveBooleanConfig(extraConfig, [
        "disableResponseStorage",
        "disable_response_storage",
        "responses.disableResponseStorage",
        "responses.disable_response_storage"
      ]) === true) {
        body.store = false;
      }
      return applyReasoningRequestControls(
        applyInferenceRequestBodyOverrides(body, extraConfig, "responses"),
        payload,
        options,
        "responses"
      );
    }
    function resolveReasoningProviderFamily(payload = {}) {
      const providerType = String(payload.providerType || "").trim().toLowerCase();
      const identity = [payload.baseUrl, payload.modelName, payload.modelVersion, payload.configName, payload.configCode].map((item) => String(item || "").toLowerCase()).join(" ");
      if (providerType === "deepseek" || identity.includes("deepseek")) return "deepseek";
      if (providerType === "qwen" || identity.includes("qwen") || identity.includes("dashscope")) return "qwen";
      if (providerType === "openai" || providerType === "azure_openai") return "openai";
      if (/\b(gpt|o1|o3|o4)[-_a-z0-9.]*/i.test(identity) || identity.includes("openai")) return "openai";
      return null;
    }
    function normalizeReasoningEffort(value, family) {
      const normalized = String(value || "medium").trim().toLowerCase();
      const supported = /* @__PURE__ */ new Set(["low", "medium", "high", "xhigh", "max"]);
      const effort = supported.has(normalized) ? normalized : "medium";
      if (family === "deepseek") {
        if (effort === "low") return "low";
        if (effort === "max" || effort === "xhigh") return "max";
        return "high";
      }
      return effort;
    }
    function applyReasoningRequestControls(body, payload, options = {}, protocol = "chat_completions") {
      if (typeof options.thinkingEnabled !== "boolean") return body;
      const family = resolveReasoningProviderFamily(payload);
      if (!family) return body;
      const enabled = options.thinkingEnabled;
      const effort = normalizeReasoningEffort(options.reasoningEffort, family);
      const thinkingBudget = Number(options.thinkingBudget || 0);
      if (family === "qwen") {
        body.enable_thinking = enabled;
        if (enabled && Number.isInteger(thinkingBudget) && thinkingBudget > 0) {
          body.thinking_budget = thinkingBudget;
        } else {
          delete body.thinking_budget;
        }
        return body;
      }
      if (protocol === "responses") {
        body.reasoning = {
          ...body.reasoning && typeof body.reasoning === "object" ? body.reasoning : {},
          effort: enabled ? effort : "none"
        };
        return body;
      }
      if (family === "deepseek") {
        body.thinking = { type: enabled ? "enabled" : "disabled" };
        if (enabled) body.reasoning_effort = effort;
        else delete body.reasoning_effort;
        return body;
      }
      body.reasoning_effort = enabled ? effort : "none";
      return body;
    }
    function buildReasoningOptions(config = {}) {
      const rawThinkingEnabled = config.thinkingEnabled ?? config.thinking_enabled;
      return {
        thinkingEnabled: rawThinkingEnabled === void 0 || rawThinkingEnabled === null ? void 0 : Boolean(rawThinkingEnabled),
        reasoningEffort: config.reasoningEffort || config.reasoning_effort || "medium",
        thinkingBudget: config.thinkingBudget ?? config.thinking_budget ?? null
      };
    }
    function applyInferenceRequestBodyOverrides(body, extraConfig, protocol) {
      const commonOverride = resolveConfiguredObject(extraConfig, [
        "requestBody",
        "request_body",
        "inferenceBody",
        "inference_body",
        "body.request",
        "body.inference"
      ]);
      const protocolOverride = protocol === "responses" ? resolveConfiguredObject(extraConfig, [
        "responsesBody",
        "responses_body",
        "body.responses"
      ]) : resolveConfiguredObject(extraConfig, [
        "chatCompletionsBody",
        "chat_completions_body",
        "body.chatCompletions",
        "body.chat_completions"
      ]);
      return mergeConfigObjects(mergeConfigObjects(body, commonOverride), protocolOverride);
    }
    function resolveConfiguredObject(extraConfig, keyPaths = []) {
      return parseConfigObject(resolveConfigValue(extraConfig, keyPaths)) || {};
    }
    function resolveResponsesInputMode(extraConfig = {}) {
      const rawValue = resolveConfigValue(extraConfig, [
        "responsesInputMode",
        "responses_input_mode",
        "responses.inputMode",
        "responses.input_mode"
      ]);
      const normalizedValue = String(rawValue || "").trim().toLowerCase();
      if (["string", "text", "instructions"].includes(normalizedValue)) {
        return normalizedValue;
      }
      return "messages";
    }
    function buildResponsesInput(messages, inputMode = "messages") {
      const sourceMessages = Array.isArray(messages) ? messages : [];
      if (inputMode === "string" || inputMode === "text") {
        return serializeMessagesToPrompt(sourceMessages);
      }
      if (inputMode === "instructions") {
        return normalizeResponsesInput(sourceMessages.filter((item) => {
          const normalizedRole = normalizeResponsesRole(item?.role);
          return normalizedRole !== "system" && normalizedRole !== "developer";
        }));
      }
      return normalizeResponsesInput(sourceMessages);
    }
    function buildResponsesInstructions(messages, inputMode = "messages") {
      if (inputMode !== "instructions") {
        return "";
      }
      return (Array.isArray(messages) ? messages : []).filter((item) => {
        const normalizedRole = normalizeResponsesRole(item?.role);
        return normalizedRole === "system" || normalizedRole === "developer";
      }).map((item) => stringifyContentForPrompt(item?.content)).filter(Boolean).join("\n\n");
    }
    function normalizeResponsesInput(messages) {
      return (Array.isArray(messages) ? messages : []).map((item) => ({
        role: normalizeResponsesRole(item?.role),
        content: normalizeResponsesContent(item?.content)
      }));
    }
    function normalizeResponsesRole(role) {
      const normalizedRole = String(role || "user").trim().toLowerCase();
      if (["assistant", "system", "developer"].includes(normalizedRole)) {
        return normalizedRole;
      }
      return "user";
    }
    function normalizeResponsesContent(content) {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        const items = content.map((item) => {
          if (typeof item === "string") {
            return { type: "input_text", text: item };
          }
          if (!item || typeof item !== "object") {
            return null;
          }
          if ((item.type === "text" || item.type === "input_text" || item.type === "output_text") && typeof item.text === "string") {
            return { type: "input_text", text: item.text };
          }
          if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
            return { type: "input_image", image_url: item.image_url.url };
          }
          if (item.type === "input_image" && typeof item.image_url === "string") {
            return { type: "input_image", image_url: item.image_url };
          }
          return null;
        }).filter(Boolean);
        if (items.length) {
          return items;
        }
      }
      if (content && typeof content === "object") {
        return JSON.stringify(content);
      }
      return String(content || "");
    }
    function serializeMessagesToPrompt(messages) {
      return (Array.isArray(messages) ? messages : []).map((item) => {
        const content = stringifyContentForPrompt(item?.content);
        if (!content) {
          return "";
        }
        return `${normalizeResponsesRole(item?.role)}:
${content}`;
      }).filter(Boolean).join("\n\n");
    }
    function stringifyContentForPrompt(content) {
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        return content.map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (!item || typeof item !== "object") {
            return "";
          }
          if (typeof item.text === "string") {
            return item.text;
          }
          if (typeof item.output_text === "string") {
            return item.output_text;
          }
          if (typeof item.refusal === "string") {
            return item.refusal;
          }
          if (item.type === "image_url" && typeof item?.image_url?.url === "string") {
            return `[image] ${item.image_url.url}`;
          }
          if (item.type === "input_image" && typeof item.image_url === "string") {
            return `[image] ${item.image_url}`;
          }
          return isPlainObject(item) ? JSON.stringify(item) : "";
        }).filter(Boolean).join("\n");
      }
      if (content && typeof content === "object") {
        return JSON.stringify(content);
      }
      return String(content || "");
    }
    function normalizeResponsesTextFormat(responseFormat) {
      if (!responseFormat || typeof responseFormat !== "object" || Array.isArray(responseFormat)) {
        return null;
      }
      const formatType = String(responseFormat.type || "").trim();
      if (!formatType) {
        return null;
      }
      return { ...responseFormat };
    }
    async function readResponsesSseStream(response, onDelta) {
      if (!response.body) {
        throw new AppError("\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: \u672A\u8FD4\u56DE\u6709\u6548\u6D41", 400);
      }
      const decoder = new TextDecoder("utf-8");
      const reader = response.body.getReader();
      let content = "";
      let buffer = "";
      let eventName = "";
      let dataLines = [];
      let finalResponse = null;
      const flushEvent = async () => {
        const rawData = dataLines.join("\n").trim();
        const currentEventName = eventName.trim();
        eventName = "";
        dataLines = [];
        if (!rawData || rawData === "[DONE]") {
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(rawData);
        } catch {
          return;
        }
        const eventType = currentEventName || parsed?.type || "";
        if (eventType === "response.error" || parsed?.error) {
          throw new AppError(`\u6A21\u578B\u6D41\u5F0F\u8C03\u7528\u5931\u8D25: ${extractErrorMessage(parsed) || "\u672A\u77E5\u9519\u8BEF"}`, 400);
        }
        if (eventType === "response.completed") {
          finalResponse = parsed?.response || parsed;
          return;
        }
        const deltaText = extractResponsesStreamDelta(eventType, parsed);
        if (deltaText) {
          content += deltaText;
          if (typeof onDelta === "function") {
            await onDelta(deltaText);
          }
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trimEnd();
          if (!line) {
            await flushEvent();
            continue;
          }
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
            continue;
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
      }
      await flushEvent();
      if (!content && finalResponse) {
        content = extractResponsesContent(finalResponse);
      }
      return {
        content,
        finalResponse
      };
    }
    function extractResponsesStreamDelta(eventType, payload) {
      if ((eventType === "response.output_text.delta" || payload?.type === "response.output_text.delta") && typeof payload?.delta === "string") {
        return payload.delta;
      }
      if ((eventType === "response.refusal.delta" || payload?.type === "response.refusal.delta") && typeof payload?.delta === "string") {
        return payload.delta;
      }
      return "";
    }
    function extractAnthropicContent(data) {
      if (!Array.isArray(data?.content)) {
        return "";
      }
      return data.content.map((item) => item?.type === "text" && typeof item.text === "string" ? item.text : "").filter(Boolean).join("\n");
    }
    module2.exports = {
      applyModelSelection,
      buildReasoningOptions,
      listModelProviders,
      getModelProviderById,
      getActiveChatModelProviders,
      normalizeRuntimeProvider,
      createModelProvider,
      updateModelProvider,
      deleteModelProvider,
      testModelProvider,
      generateChatCompletion,
      generateChatCompletionStream
    };
  }
});

// backend/src/modules/data-lab/data-lab.prompt-runtime.js
var require_data_lab_prompt_runtime = __commonJS({
  "backend/src/modules/data-lab/data-lab.prompt-runtime.js"(exports2, module2) {
    var { pool } = require_database();
    var modelProviderService = require_model_provider_service();
    function queryFirst(rows) {
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }
    function stringifyPromptVariable(value) {
      if (value === void 0 || value === null) {
        return "";
      }
      if (typeof value === "string") {
        return value;
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    function renderPromptTemplate(template, variables = {}) {
      const raw = String(template || "");
      if (!raw) {
        return "";
      }
      return raw.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => stringifyPromptVariable(variables[key]));
    }
    async function getActivePromptTemplate(promptType) {
      const [rows] = await pool.query(
        `SELECT id, prompt_type AS promptType, template_name AS templateName, template_code AS templateCode,
            content, user_content AS userContent, temperature, max_tokens AS maxTokens, default_model_provider_id AS defaultModelProviderId,
            default_model_name AS defaultModelName, default_model_version AS defaultModelVersion,
            is_default AS isDefault, status, created_at AS createdAt, updated_at AS updatedAt
     FROM lab_prompt_template
     WHERE prompt_type = ?
       AND status = 'active'
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1`,
        [promptType]
      );
      return queryFirst(rows) || null;
    }
    function normalizePromptParameterNumber(value, fallback, options = {}) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return fallback;
      }
      if (options.integer) {
        return Math.max(options.min ?? 1, Math.min(options.max ?? 8e3, Math.trunc(number)));
      }
      const limited = Math.max(options.min ?? 0, Math.min(options.max ?? 2, number));
      return Number(limited.toFixed(2));
    }
    async function resolvePromptTemplateProvider(defaultModelProviderId) {
      if (!defaultModelProviderId) {
        return null;
      }
      const provider = await modelProviderService.getModelProviderById(Number(defaultModelProviderId));
      if (!provider || provider.modelCategory !== "chat" || provider.status !== "active") {
        return null;
      }
      return provider;
    }
    async function resolveRuntimePromptConfig(promptType, defaults = {}, variables = {}) {
      const template = await getActivePromptTemplate(promptType);
      const provider = await resolvePromptTemplateProvider(template?.defaultModelProviderId);
      const selectedProvider = provider ? modelProviderService.applyModelSelection(provider, {
        modelName: template?.defaultModelName,
        modelVersion: template?.defaultModelVersion
      }) : null;
      const systemPrompt = renderPromptTemplate(
        template?.content || defaults.systemPrompt || "",
        variables
      );
      const userPrompt = renderPromptTemplate(
        template?.userContent || defaults.userPrompt || "{{input}}",
        variables
      ) || stringifyPromptVariable(variables.input);
      return {
        template,
        provider: selectedProvider,
        systemPrompt,
        userPrompt,
        temperature: normalizePromptParameterNumber(template?.temperature, defaults.temperature ?? 0.2, { min: 0, max: 2 }),
        maxTokens: normalizePromptParameterNumber(template?.maxTokens, defaults.maxTokens ?? 1200, { min: 1, max: 8e3, integer: true })
      };
    }
    module2.exports = {
      stringifyPromptVariable,
      renderPromptTemplate,
      getActivePromptTemplate,
      normalizePromptParameterNumber,
      resolvePromptTemplateProvider,
      resolveRuntimePromptConfig
    };
  }
});

// backend/src/modules/data-lab/data-lab.pdf-extractor.js
var require_data_lab_pdf_extractor = __commonJS({
  "backend/src/modules/data-lab/data-lab.pdf-extractor.js"(exports2, module2) {
    var pdfParse = require("pdf-parse");
    var MAX_PDF_TEXT_LENGTH = 2e4;
    function cleanText(text, maxLength = MAX_PDF_TEXT_LENGTH) {
      return String(text || "").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[^\S\n]+/g, " ").trim().slice(0, maxLength);
    }
    function normalizePdfDate(value) {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const matched = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
      if (!matched) {
        return null;
      }
      const [, year, month, day, hour = "00", minute = "00", second = "00"] = matched;
      const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    async function extractPdfTextFromBuffer(buffer) {
      const parsed = await pdfParse(buffer);
      return {
        text: cleanText(parsed.text),
        pageCount: Number(parsed.numpages || 0),
        info: parsed.info || {},
        metadata: parsed.metadata || null,
        publishedAt: normalizePdfDate(parsed.info?.ModDate || parsed.info?.CreationDate || null)
      };
    }
    module2.exports = {
      extractPdfTextFromBuffer,
      normalizePdfDate
    };
  }
});

// backend/src/modules/data-lab/data-lab.evidence-parser.js
var require_data_lab_evidence_parser = __commonJS({
  "backend/src/modules/data-lab/data-lab.evidence-parser.js"(exports2, module2) {
    var crypto = require("crypto");
    var path = require("path");
    var iconv = require("iconv-lite");
    var { extractPdfTextFromBuffer } = require_data_lab_pdf_extractor();
    var MAX_SNAPSHOT_LENGTH = 16e3;
    var GOV_HOST_RE = /(^|\.)gov\.cn$/i;
    var EDU_HOST_RE = /(^|\.)edu\.cn$/i;
    var ORG_HOST_RE = /(^|\.)org\.cn$/i;
    var PDF_CONTENT_RE = /(^application\/pdf\b)|(^application\/octet-stream\b)/i;
    var FOREIGN_TERM_PATTERNS = [
      /\b(?:GDPR|HIPAA|FDA|IRS|NHS|PCI-DSS|Amazon|Walmart|eBay|Uber|FedEx)\b/gi
    ];
    var FOREIGN_REGION_PATTERNS = [
      /(?:美国|英国|欧盟|德国|法国|日本|韩国|新加坡|纽约|伦敦|东京|首尔)/g,
      /\b(?:USA|United States|UK|EU|Germany|France|Japan|Korea|Singapore|New York|London|Tokyo|Seoul)\b/gi
    ];
    var NON_CNY_CURRENCY_PATTERNS = [
      /(?:美元|欧元|英镑|日元|港币)/g,
      /\b(?:USD|EUR|GBP|JPY|HKD|AUD|CAD|SGD)\b/gi
    ];
    function scoreDecodedText(text) {
      const value = String(text || "");
      const chinese = (value.match(/[\u4e00-\u9fff]/g) || []).length;
      const replacement = (value.match(/�/g) || []).length;
      const mojibake = (value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g) || []).length;
      const printable = (value.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；：、“”‘’（）【】《》、\s._\-/:]/g) || []).length;
      return printable + chinese * 2 - replacement * 5 - mojibake * 3;
    }
    function decodeHtmlEntities(text) {
      return String(text || "").replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code))).replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCharCode(parseInt(code, 16))).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }
    function stripHtml(html) {
      return decodeHtmlEntities(String(html || "")).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    function cleanText(text, maxLength = MAX_SNAPSHOT_LENGTH) {
      return String(text || "").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[^\S\n]+/g, " ").trim().slice(0, maxLength);
    }
    function decodeBuffer(buffer, contentType = "") {
      const contentTypeCharset = String(contentType || "").match(/charset=([^;]+)/i)?.[1]?.trim();
      const preferredDecodes = [];
      if (contentTypeCharset && iconv.encodingExists(contentTypeCharset)) {
        try {
          preferredDecodes.push(iconv.decode(buffer, contentTypeCharset));
        } catch {
        }
      }
      const headText = buffer.toString("latin1", 0, Math.min(buffer.length, 2048));
      const metaCharset = headText.match(/charset=["']?([a-zA-Z0-9_-]+)/i)?.[1]?.trim();
      if (metaCharset && iconv.encodingExists(metaCharset)) {
        try {
          preferredDecodes.push(iconv.decode(buffer, metaCharset));
        } catch {
        }
      }
      const preferred = preferredDecodes.find((item) => scoreDecodedText(item) > 60);
      if (preferred) {
        return preferred;
      }
      const candidates = [];
      candidates.push(buffer.toString("utf8"));
      if (iconv.encodingExists("gb18030")) {
        candidates.push(iconv.decode(buffer, "gb18030"));
      }
      if (iconv.encodingExists("gbk")) {
        candidates.push(iconv.decode(buffer, "gbk"));
      }
      return candidates.sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0] || "";
    }
    function extractMetaContent(html, keys = []) {
      for (const key of keys) {
        const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
        const matched = String(html || "").match(pattern);
        if (matched?.[1]) {
          return decodeHtmlEntities(matched[1]).trim();
        }
      }
      return "";
    }
    function extractHtmlTitle(html, titleHint = "") {
      const candidates = [
        extractMetaContent(html, ["og:title", "article:title"]),
        String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
        String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
        titleHint
      ];
      return candidates.map((item) => stripHtml(item)).find((item) => item && item.length >= 2) || "";
    }
    function normalizeDateValue(value) {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const compact = raw.replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/日/g, " ").replace(/[时]/g, ":").replace(/[分]/g, ":").replace(/[秒]/g, "").replace(/\s+/g, " ").trim();
      const matched = compact.match(/(20\d{2}-\d{1,2}-\d{1,2})(?:[ T](\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
      if (!matched) {
        return null;
      }
      const datePart = matched[1].split("-").map((item) => item.padStart(2, "0"));
      const timePart = String(matched[2] || "00:00:00").split(":").map((item) => item.padStart(2, "0"));
      while (timePart.length < 3) timePart.push("00");
      const iso = `${datePart[0]}-${datePart[1]}-${datePart[2]}T${timePart[0]}:${timePart[1]}:${timePart[2]}+08:00`;
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    function extractPublishedAt(html, text) {
      const metaCandidates = [
        extractMetaContent(html, ["article:published_time", "publishdate", "pubdate", "dc.date", "date", "weibo: article:create_at"]),
        String(html || "").match(/(?:发布时间|发布日期|成文日期|公开时间)[^0-9]{0,8}((?:20\d{2}[年\/.-]\d{1,2}[月\/.-]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?))/)?.[1] || "",
        String(text || "").match(/(?:发布时间|发布日期|成文日期|公开时间)[^0-9]{0,8}((?:20\d{2}[年\/.-]\d{1,2}[月\/.-]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?))/)?.[1] || "",
        String(text || "").match(/((?:20\d{2}[年\/.-]\d{1,2}[月\/.-]\d{1,2}(?:日)?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?))/)?.[1] || ""
      ];
      return metaCandidates.map(normalizeDateValue).find(Boolean) || null;
    }
    function extractHtmlMainText(html) {
      const candidates = [
        String(html || "").match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || "",
        String(html || "").match(/<(div|section)[^>]+(?:id|class)=["'][^"']*(?:content|article|main|detail|正文)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i)?.[2] || "",
        html
      ];
      for (const candidate of candidates) {
        const cleaned = cleanText(
          decodeHtmlEntities(String(candidate || "")).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n").replace(/<\/section>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ")
        );
        if (cleaned.length >= 120) {
          return cleaned;
        }
      }
      return cleanText(stripHtml(html));
    }
    function normalizeAuthority(url) {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return "unknown";
      }
    }
    function analyzeDomesticBoundary(text) {
      const value = String(text || "");
      const foreignTermHitCount = FOREIGN_TERM_PATTERNS.reduce((sum, pattern) => sum + (value.match(pattern) || []).length, 0);
      const foreignRegionHitCount = FOREIGN_REGION_PATTERNS.reduce((sum, pattern) => sum + (value.match(pattern) || []).length, 0);
      const nonCnyCurrencyHitCount = NON_CNY_CURRENCY_PATTERNS.reduce((sum, pattern) => sum + (value.match(pattern) || []).length, 0);
      return {
        domesticContextOnly: foreignTermHitCount === 0 && foreignRegionHitCount === 0 && nonCnyCurrencyHitCount === 0,
        foreignTermHitCount,
        foreignRegionHitCount,
        nonCnyCurrencyHitCount
      };
    }
    function buildEvidenceHash({ sourceUrl, title, publishedAt, snapshotContent }) {
      return crypto.createHash("sha1").update([sourceUrl, title, publishedAt || "", snapshotContent || ""].join("||")).digest("hex");
    }
    function computeEvidenceConfidence({ authority, publishedAt, snapshotContent, title, domesticBoundary, contentType }) {
      let score = 0.2;
      if (GOV_HOST_RE.test(authority)) score += 0.4;
      else if (EDU_HOST_RE.test(authority)) score += 0.28;
      else if (ORG_HOST_RE.test(authority)) score += 0.18;
      else score += 0.08;
      if (publishedAt) score += 0.1;
      if (String(snapshotContent || "").length >= 1200) score += 0.1;
      else if (String(snapshotContent || "").length >= 400) score += 0.05;
      if (String(title || "").trim()) score += 0.05;
      if (PDF_CONTENT_RE.test(String(contentType || "")) || /\.pdf(?:$|\?)/i.test(String(contentType || ""))) score += 0.05;
      if (domesticBoundary.domesticContextOnly) score += 0.05;
      else score -= 0.15;
      return Number(Math.max(0.05, Math.min(0.99, score)).toFixed(2));
    }
    function buildEvidenceFromText({
      url,
      title,
      titleHint,
      snippet,
      sourceType,
      searchQuery,
      fetchedAt,
      snapshotContent,
      publishedAt,
      contentType
    }) {
      const authority = normalizeAuthority(url);
      const normalizedTitle = cleanText(title || titleHint, 256) || path.basename(String(url || "").split("?")[0] || "evidence");
      const normalizedContent = cleanText(snapshotContent || "");
      if (normalizedContent.length < 80) {
        return null;
      }
      const domesticBoundary = analyzeDomesticBoundary(`${normalizedTitle}
${normalizedContent}`);
      const sourceHash = buildEvidenceHash({
        sourceUrl: url,
        title: normalizedTitle,
        publishedAt,
        snapshotContent: normalizedContent
      });
      const confidence = computeEvidenceConfidence({
        authority,
        publishedAt,
        snapshotContent: normalizedContent,
        title: normalizedTitle,
        domesticBoundary,
        contentType
      });
      return {
        id: `evd_${sourceHash.slice(0, 16)}`,
        sourceHash,
        sourceUrl: url,
        title: normalizedTitle,
        authority,
        publishedAt,
        snapshotContent: normalizedContent,
        summary: cleanText(snippet || normalizedContent, 240),
        confidence,
        sourceType: String(sourceType || "\u884C\u4E1A\u516C\u5F00\u8D44\u6599").trim() || "\u884C\u4E1A\u516C\u5F00\u8D44\u6599",
        searchQuery: String(searchQuery || "").trim(),
        contentType: String(contentType || "").trim(),
        fetchedAt: fetchedAt || (/* @__PURE__ */ new Date()).toISOString(),
        ...domesticBoundary
      };
    }
    async function parseFetchedEvidence({
      url,
      responseUrl,
      contentType,
      buffer,
      sourceType,
      searchQuery,
      fetchedAt,
      titleHint,
      snippet
    }) {
      const resolvedUrl = responseUrl || url;
      const normalizedContentType = String(contentType || "").split(";")[0].trim().toLowerCase();
      if (normalizedContentType === "application/pdf" || /\.pdf(?:$|\?)/i.test(resolvedUrl)) {
        const pdf = await extractPdfTextFromBuffer(buffer);
        return buildEvidenceFromText({
          url: resolvedUrl,
          title: pdf.info?.Title || titleHint,
          titleHint,
          snippet,
          sourceType,
          searchQuery,
          fetchedAt,
          snapshotContent: pdf.text,
          publishedAt: pdf.publishedAt || null,
          contentType: normalizedContentType || "application/pdf"
        });
      }
      const html = decodeBuffer(buffer, contentType);
      const title = extractHtmlTitle(html, titleHint);
      const snapshotContent = extractHtmlMainText(html);
      const publishedAt = extractPublishedAt(html, `${title}
${snapshotContent}`);
      return buildEvidenceFromText({
        url: resolvedUrl,
        title,
        titleHint,
        snippet,
        sourceType,
        searchQuery,
        fetchedAt,
        snapshotContent,
        publishedAt,
        contentType: normalizedContentType || "text/html"
      });
    }
    module2.exports = {
      analyzeDomesticBoundary,
      buildEvidenceHash,
      cleanText,
      computeEvidenceConfidence,
      decodeHtmlEntities,
      extractHtmlMainText,
      extractHtmlTitle,
      extractPublishedAt,
      normalizeAuthority,
      parseFetchedEvidence,
      stripHtml
    };
  }
});

// backend/src/modules/data-lab/data-lab.internet-research.js
var require_data_lab_internet_research = __commonJS({
  "backend/src/modules/data-lab/data-lab.internet-research.js"(exports2, module2) {
    var evidenceParser = require_data_lab_evidence_parser();
    var GAP_INTENTS = [
      ["\u4E1A\u52A1\u6D41\u7A0B", "\u5904\u7F6E\u6D41\u7A0B", "\u529E\u7406\u6D41\u7A0B", "\u5DE5\u4F5C\u6D41\u7A0B"],
      ["\u53F0\u8D26", "\u8BB0\u5F55\u8868", "\u6E05\u5355", "\u62A5\u8868", "\u660E\u7EC6"],
      ["\u72B6\u6001", "\u7C7B\u578B", "\u7B49\u7EA7", "\u5206\u7C7B", "\u7F16\u7801", "\u4EE3\u7801\u96C6", "\u679A\u4E3E\u503C"],
      ["\u673A\u6784", "\u4EBA\u5458", "\u5BF9\u8C61", "\u8BBE\u5907", "\u8D44\u6E90", "\u7269\u8D44", "\u961F\u4F0D"],
      ["\u804C\u8D23", "\u534F\u540C", "\u8054\u52A8", "\u8BC4\u4F30", "\u8003\u6838", "\u9884\u8B66", "\u54CD\u5E94"],
      ["\u4FE1\u606F\u7CFB\u7EDF", "\u5E73\u53F0", "\u529F\u80FD", "\u6A21\u5757", "\u6570\u636E\u9879", "\u6570\u636E\u5143"]
    ];
    var SOURCE_TYPE_QUERY_MAP = {
      \u56FD\u5BB6\u6807\u51C6: ["\u56FD\u5BB6\u6807\u51C6 \u6570\u636E\u5143", "\u56FD\u5BB6\u6807\u51C6 \u6570\u636E\u8868", "\u6807\u51C6 \u4EE3\u7801\u96C6"],
      \u884C\u4E1A\u6807\u51C6: ["\u884C\u4E1A\u6807\u51C6 \u6570\u636E\u89C4\u8303", "\u884C\u4E1A\u6807\u51C6 \u4FE1\u606F\u6A21\u578B", "\u884C\u4E1A\u6807\u51C6 \u6570\u636E\u5143"],
      \u6CD5\u89C4\u653F\u7B56: ["\u7BA1\u7406\u529E\u6CD5 \u653F\u7B56 \u8981\u6C42", "\u6CD5\u89C4 \u653F\u7B56 \u5236\u5EA6", "\u5B9E\u65BD\u65B9\u6848 \u901A\u77E5"],
      \u5EFA\u8BBE\u89C4\u8303: ["\u4FE1\u606F\u7CFB\u7EDF \u5EFA\u8BBE\u89C4\u8303", "\u5E73\u53F0 \u5EFA\u8BBE\u65B9\u6848", "\u5EFA\u8BBE\u8981\u6C42 \u6570\u636E\u89C4\u8303"],
      \u516C\u5F00\u6570\u636E: ["\u516C\u5F00\u6570\u636E \u7EDF\u8BA1\u516C\u62A5", "\u6570\u636E\u5F00\u653E \u5E73\u53F0", "\u6570\u636E\u76EE\u5F55 \u6307\u6807"]
    };
    var DEFAULT_PREFERRED_DOMAINS = [
      "gov.cn",
      "edu.cn",
      "org.cn",
      "www.gov.cn",
      "npc.gov.cn"
    ];
    var OFFICIAL_DOMAINS = [
      "gov.cn",
      "edu.cn",
      "org.cn",
      "www.gov.cn",
      "www.moe.gov.cn",
      "moe.gov.cn",
      "npc.gov.cn",
      "samr.gov.cn",
      "mot.gov.cn",
      "mem.gov.cn"
    ];
    function normalizeIndustryLabel(value) {
      return String(value || "").trim() || "\u884C\u4E1A";
    }
    function normalizeDomain(value) {
      return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "www.");
    }
    function parseBingResults(html) {
      const results = [];
      const pattern = /<li class="b_algo"[\s\S]*?<h2><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?(?:<p>([\s\S]*?)<\/p>)?[\s\S]*?<\/li>/gi;
      let match;
      while ((match = pattern.exec(String(html || ""))) !== null) {
        const url = evidenceParser.decodeHtmlEntities(match[1]);
        const title = evidenceParser.stripHtml(match[2]);
        const snippet = evidenceParser.stripHtml(match[3] || "");
        if (!url || !/^https?:\/\//i.test(url)) continue;
        results.push({ url, title, snippet });
      }
      return results;
    }
    function hostMatchesWhitelist(url, whitelist = []) {
      try {
        const host = new URL(url).hostname.toLowerCase();
        const normalizedWhitelist = (Array.isArray(whitelist) ? whitelist : []).map(normalizeDomain).filter(Boolean);
        if (normalizedWhitelist.length === 0) return true;
        return normalizedWhitelist.some((rule) => host === rule || host.endsWith(`.${rule}`));
      } catch {
        return false;
      }
    }
    function buildSiteScopedQueries(baseQueries, whitelist) {
      const scopedQueries = [];
      const normalizedWhitelist = (Array.isArray(whitelist) ? whitelist : []).map(normalizeDomain).filter(Boolean);
      for (const query of baseQueries) {
        scopedQueries.push(query);
        for (const domain of normalizedWhitelist.slice(0, 6)) {
          scopedQueries.push(`site:${domain} ${query}`);
        }
      }
      return [...new Set(scopedQueries.filter(Boolean))];
    }
    function normalizeKeywordList(values) {
      return [...new Set(
        (Array.isArray(values) ? values : []).map((item) => String(item || "").trim()).filter(Boolean)
      )];
    }
    function normalizeSourceTypes(values) {
      return normalizeKeywordList(values).map((item) => item.replace(/\s+/g, ""));
    }
    function scoreSearchResult(result, options = {}) {
      const text = `${result?.title || ""} ${result?.snippet || ""}`.toLowerCase();
      const gapKeywords = normalizeKeywordList(options.gapKeywords).map((item) => item.toLowerCase());
      const queryTokens = String(options.query || "").split(/\s+/).map((item) => item.trim().toLowerCase()).filter((item) => item && !item.startsWith("site:"));
      let score = 0;
      gapKeywords.forEach((keyword) => {
        if (keyword && text.includes(keyword)) score += 3;
      });
      queryTokens.forEach((token) => {
        if (token && text.includes(token)) score += 1;
      });
      if (hostMatchesWhitelist(result?.url || "", options.preferredDomains || [])) {
        score += 2;
      }
      return score;
    }
    async function searchBing(query) {
      const response = await fetch(`https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-hans&ensearch=0&count=10`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9"
        }
      });
      if (!response.ok) {
        throw new Error(`bing_search_failed_${response.status}`);
      }
      const html = await response.text();
      return parseBingResults(html);
    }
    async function fetchPageSnapshot(url, metadata = {}) {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9"
        }
      });
      if (!response.ok) {
        throw new Error(`page_fetch_failed_${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return evidenceParser.parseFetchedEvidence({
        url,
        responseUrl: response.url || url,
        contentType: response.headers.get("content-type") || "",
        buffer,
        sourceType: metadata.sourceType,
        searchQuery: metadata.searchQuery,
        fetchedAt: metadata.fetchedAt || (/* @__PURE__ */ new Date()).toISOString(),
        titleHint: metadata.titleHint,
        snippet: metadata.snippet
      });
    }
    function buildResearchQueries({
      industryLabel,
      sceneName,
      subScenario,
      requiredKeywords = [],
      sourceTypes = [],
      preferredDomains = [],
      plannedQueries = [],
      gapKeywords = [],
      mode = "industry"
    }) {
      const normalizedIndustryLabel = normalizeIndustryLabel(industryLabel);
      const sceneToken = [normalizedIndustryLabel, sceneName, subScenario].filter(Boolean).join(" ").trim();
      const queries = normalizeKeywordList(plannedQueries);
      const normalizedSourceTypes = normalizeSourceTypes(sourceTypes);
      normalizedSourceTypes.forEach((sourceType) => {
        const templates = SOURCE_TYPE_QUERY_MAP[sourceType] || [];
        templates.forEach((template) => {
          queries.push(`${sceneToken} ${template}`.trim());
        });
      });
      normalizeKeywordList(requiredKeywords).forEach((keyword) => {
        queries.push(`${sceneToken} ${keyword}`.trim());
      });
      normalizeKeywordList(gapKeywords).slice(0, 20).forEach((keyword) => {
        GAP_INTENTS.forEach((intentTerms) => {
          intentTerms.slice(0, 2).forEach((intent) => {
            queries.push(`${sceneToken} ${keyword} ${intent}`.trim());
          });
        });
        queries.push(`${sceneToken} ${keyword} \u6570\u636E\u9879`.trim());
        queries.push(`${sceneToken} ${keyword} \u4EE3\u7801\u96C6`.trim());
        queries.push(`${sceneToken} ${keyword} \u4FE1\u606F\u9879`.trim());
      });
      if (mode === "category") {
        GAP_INTENTS.forEach((intentTerms) => {
          intentTerms.forEach((intent) => {
            queries.push(`${sceneToken} ${intent}`.trim());
          });
        });
      }
      if (queries.length === 0) {
        [
          `${sceneToken} \u7BA1\u7406\u529E\u6CD5`,
          `${sceneToken} \u6570\u636E\u6807\u51C6`,
          `${sceneToken} \u4FE1\u606F\u7CFB\u7EDF \u5EFA\u8BBE\u89C4\u8303`,
          `${sceneToken} \u516C\u5F00\u6570\u636E`,
          `${sceneToken} \u7EDF\u8BA1\u516C\u62A5`,
          `${sceneToken} \u4EE3\u7801\u96C6`,
          `${sceneToken} \u6570\u636E\u5143`,
          `${sceneToken} \u6307\u6807\u4F53\u7CFB`
        ].forEach((query) => queries.push(query.trim()));
      }
      return buildSiteScopedQueries(
        [...new Set(queries.filter(Boolean))],
        Array.isArray(preferredDomains) ? preferredDomains : []
      );
    }
    function shouldAcceptDomesticEvidence(evidence, options = {}) {
      if (!evidence) return false;
      if (options.domesticOnly === false) return true;
      const sourceUrl = String(evidence.sourceUrl || "");
      const officialDomestic = OFFICIAL_DOMAINS.some((domain) => hostMatchesWhitelist(sourceUrl, [domain]));
      if (officialDomestic) {
        return true;
      }
      if (evidence.nonCnyCurrencyHitCount > 0) return false;
      if (evidence.foreignRegionHitCount > 0) return false;
      if (evidence.foreignTermHitCount > 2) return false;
      return true;
    }
    async function collectDomainScopedEvidence(options, whitelist, evidence, seenHashes, seenUrls) {
      const normalizedWhitelist = (Array.isArray(whitelist) ? whitelist : []).map(normalizeDomain).filter(Boolean);
      const baseQueries = [
        `${normalizeIndustryLabel(options.industryLabel)} ${String(options.sceneName || "").trim()} \u7BA1\u7406\u529E\u6CD5`.trim(),
        `${normalizeIndustryLabel(options.industryLabel)} ${String(options.sceneName || "").trim()} \u6570\u636E\u6807\u51C6`.trim()
      ].filter(Boolean);
      for (const domain of normalizedWhitelist.slice(0, 4)) {
        for (const query of baseQueries) {
          let results = [];
          try {
            results = await searchBing(`site:${domain} ${query}`);
          } catch {
            continue;
          }
          for (const item of results.slice(0, 3)) {
            if (seenUrls.has(item.url)) continue;
            seenUrls.add(item.url);
            try {
              const snapshot = await fetchPageSnapshot(item.url, {
                sourceType: options.sourceTypeResolver ? options.sourceTypeResolver(query, item) : "\u884C\u4E1A\u516C\u5F00\u8D44\u6599",
                searchQuery: query,
                titleHint: item.title,
                snippet: item.snippet
              });
              if (!snapshot || !shouldAcceptDomesticEvidence(snapshot, options)) continue;
              if (seenHashes.has(snapshot.sourceHash)) continue;
              seenHashes.add(snapshot.sourceHash);
              evidence.push(snapshot);
              if (evidence.length >= Number(options.limit || 12)) return;
            } catch {
              continue;
            }
          }
        }
      }
    }
    async function collectDomesticEvidence(options) {
      const configuredDomains = (Array.isArray(options.preferredDomains) ? options.preferredDomains : []).filter(Boolean);
      const whitelist = [...new Set((configuredDomains.length > 0 ? configuredDomains : DEFAULT_PREFERRED_DOMAINS).filter(Boolean))];
      const queries = buildResearchQueries({
        ...options,
        preferredDomains: whitelist
      });
      const evidence = [];
      const seenHashes = /* @__PURE__ */ new Set();
      const seenUrls = /* @__PURE__ */ new Set();
      await collectDomainScopedEvidence(options, whitelist, evidence, seenHashes, seenUrls);
      if (evidence.length >= Number(options.limit || 12)) {
        return evidence;
      }
      const maxQueries = options.mode === "category" ? 24 : 16;
      for (const query of queries.slice(0, maxQueries)) {
        let results = [];
        try {
          results = await searchBing(query);
        } catch {
          continue;
        }
        const rankedResults = results.map((item) => ({ ...item, __score: scoreSearchResult(item, { query, gapKeywords: options.gapKeywords, preferredDomains: whitelist }) })).sort((a, b) => b.__score - a.__score);
        for (const item of rankedResults.slice(0, options.mode === "category" ? 10 : 8)) {
          if (!hostMatchesWhitelist(item.url, whitelist)) continue;
          if (seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);
          try {
            const snapshot = await fetchPageSnapshot(item.url, {
              sourceType: options.sourceTypeResolver ? options.sourceTypeResolver(query, item) : "\u884C\u4E1A\u516C\u5F00\u8D44\u6599",
              searchQuery: query,
              titleHint: item.title,
              snippet: item.snippet
            });
            if (!snapshot || !shouldAcceptDomesticEvidence(snapshot, options)) continue;
            if (seenHashes.has(snapshot.sourceHash)) continue;
            seenHashes.add(snapshot.sourceHash);
            evidence.push(snapshot);
            if (evidence.length >= Number(options.limit || 12)) {
              return evidence;
            }
          } catch {
            continue;
          }
        }
      }
      return evidence;
    }
    module2.exports = {
      buildResearchQueries,
      collectDomesticEvidence,
      fetchPageSnapshot,
      hostMatchesWhitelist,
      parseBingResults,
      searchBing,
      stripHtml: evidenceParser.stripHtml
    };
  }
});

// backend/src/modules/data-lab/data-lab.incubation-runtime.js
var require_data_lab_incubation_runtime = __commonJS({
  "backend/src/modules/data-lab/data-lab.incubation-runtime.js"(exports2, module2) {
    var { pool } = require_database();
    var AppError = require_app_error();
    var enhancementService = require_data_lab_enhancement();
    var promptRuntime = require_data_lab_prompt_runtime();
    var internetResearch = require_data_lab_internet_research();
    var { getCurrentProjectId } = require_project_context();
    var jobs = /* @__PURE__ */ new Map();
    function getScopedWhere(alias = "") {
      const projectId = getCurrentProjectId();
      if (!projectId) return { sql: "", params: [], projectId: null };
      const prefix = alias ? `${alias}.` : "";
      return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
    }
    function safeJson(value, fallback) {
      if (value === null || value === void 0 || value === "") return fallback;
      if (typeof value === "object") return value;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    function text(value, max = 240) {
      const normalized = String(value || "").replace(/\s+/g, " ").trim();
      if (!normalized) return "";
      return normalized.length > max ? `${normalized.slice(0, max - 3)}...` : normalized;
    }
    function uniq(values = [], limit = 64) {
      return [...new Set((Array.isArray(values) ? values : []).map((item) => text(item, 240)).filter(Boolean))].slice(0, limit);
    }
    function pickNonEmptyRefs(...values) {
      for (const value of values) {
        const normalized = uniq(value, 32);
        if (normalized.length > 0) {
          return normalized;
        }
      }
      return [];
    }
    function hasChineseText(value) {
      return /[\u4e00-\u9fff]/.test(String(value || ""));
    }
    function extractReadableText(value, preferredKeys = [], depth = 0) {
      if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
      }
      if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) {
        return "";
      }
      const entry = value;
      for (const key of preferredKeys) {
        if (!Object.prototype.hasOwnProperty.call(entry, key)) continue;
        const candidate = extractReadableText(entry[key], preferredKeys, depth + 1);
        if (candidate) return candidate;
      }
      for (const candidateValue of Object.values(entry)) {
        const candidate = extractReadableText(candidateValue, preferredKeys, depth + 1);
        if (candidate) return candidate;
      }
      return "";
    }
    function extractFieldLabelText(value) {
      return extractReadableText(value, [
        "fieldLabel",
        "fieldComment",
        "fieldName",
        "field_name",
        "label",
        "name",
        "title",
        "displayName",
        "itemLabel",
        "itemName",
        "text",
        "value",
        "comment",
        "description"
      ]);
    }
    function extractKeyInfoItemText(value) {
      return extractReadableText(value, [
        "fieldLabel",
        "fieldComment",
        "fieldName",
        "field_name",
        "label",
        "name",
        "title",
        "displayName",
        "itemLabel",
        "itemName",
        "text",
        "value",
        "comment",
        "description",
        "summary"
      ]);
    }
    function normalizeCode(value, fallback = "item") {
      const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").replace(/_+/g, "_");
      return normalized || `${fallback}_${Date.now().toString().slice(-8)}`;
    }
    function clampInt(value, min, max, fallback) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.floor(n)));
    }
    function mergeByKey(base, extra, keyFn) {
      const map = /* @__PURE__ */ new Map();
      [...Array.isArray(base) ? base : [], ...Array.isArray(extra) ? extra : []].forEach((item) => {
        const key = keyFn(item);
        if (key) map.set(key, item);
      });
      return Array.from(map.values());
    }
    function defaultConfig() {
      return {
        languagePolicy: {
          locale: "zh-CN",
          domesticOnly: true,
          requiredChineseLabels: true,
          allowedCurrencies: ["CNY", "RMB"],
          sourceDomainWhitelist: ["gov.cn", "edu.cn", "org.cn", "www.gov.cn"],
          forbiddenForeignTerms: [],
          forbiddenForeignRegions: []
        },
        autoResearchPolicy: {
          sourceTypes: ["\u9365\u85C9\uE18D\u93CD\u56E7\u566F", "\u741B\u5C7C\u7B1F\u93CD\u56E7\u566F", "\u5A09\u66E1\uE749\u93C0\u8DE8\u74E5", "\u5BE4\u9E3F\uE195\u7459\u52EE\u5BD6", "\u934F\uE100\u7D11\u93C1\u7248\u5D41"],
          preferredDomains: ["gov.cn", "edu.cn", "org.cn"],
          requiredKeywords: []
        },
        modelCommittee: { defaultModelProviderId: null, fallbackModelProviderId: null },
        scenarioPool: { scenarios: [] },
        scenarioCoverage: { sceneFingerprints: [], coveredSubScenarios: [], coveredModules: [] },
        evidenceCatalog: { items: [] },
        standardAssets: { researchCatalog: { summary: "", categoryTree: [], candidateTableSpecs: [] }, dictionaries: [] },
        trainingSettings: {
          targetRoundCount: 3,
          targetCategoryCount: 1,
          runState: {
            mode: "industry",
            status: "idle",
            totalRounds: 0,
            taskCurrentRoundNo: 0,
            targetCategoryCode: null,
            targetCategoryName: null,
            stopRequested: false,
            startedAt: null,
            endedAt: null,
            lastError: null
          }
        }
      };
    }
    function normalizeTrainingSettings(value) {
      const defaults = defaultConfig().trainingSettings;
      const source = safeJson(value, {});
      return {
        ...defaults,
        ...source,
        targetRoundCount: clampInt(source.targetRoundCount, 1, 12, defaults.targetRoundCount),
        targetCategoryCount: clampInt(source.targetCategoryCount, 1, 8, defaults.targetCategoryCount),
        runState: {
          ...defaults.runState,
          ...source.runState && typeof source.runState === "object" ? source.runState : {}
        }
      };
    }
    function normalizeEvidenceItems(items = []) {
      return (Array.isArray(items) ? items : []).map((item) => ({
        id: item.id,
        sourceHash: item.sourceHash,
        sourceUrl: item.sourceUrl,
        title: item.title,
        authority: item.authority,
        publishedAt: item.publishedAt || null,
        summary: item.summary || "",
        sourceType: item.sourceType || "",
        snapshotContent: item.snapshotContent || ""
      }));
    }
    function sanitizeStoredFieldLabel(value) {
      const raw = text(extractFieldLabelText(value), 64);
      if (!raw) return "";
      if (isPromptPlaceholderField(raw)) return "";
      if (/[()（）]/.test(raw)) return "";
      if (!hasChineseText(raw) && /^[A-Za-z0-9_]+$/.test(raw)) return "";
      return raw;
    }
    function normalizeFieldList(values = []) {
      return uniq((Array.isArray(values) ? values : []).map((item) => {
        if (typeof item === "string") return sanitizeStoredFieldLabel(item);
        return sanitizeStoredFieldLabel(item?.fieldName || item?.field_name || item?.name || item?.label || "");
      }).filter(Boolean), 32);
    }
    function normalizeTable(table = {}) {
      const fields = normalizeFieldList(table.fields || table.keyInfoItems || table.key_info_items || []);
      const keyInfoItems = normalizeKeyInfoItemList(table.keyInfoItems || table.key_info_items || []);
      return {
        tableName: normalizeCode(table.tableName || table.table_name || table.tableLabel || table.table_label, "table"),
        tableLabel: text(table.tableLabel || table.table_label || table.tableComment || table.table_comment || table.tableName, 64),
        tableComment: text(table.tableComment || table.table_comment || table.tableLabel || table.table_label || table.tableName, 160),
        keyInfoItems: keyInfoItems.length > 0 ? keyInfoItems : fields.slice(0, 16),
        fields,
        sourceRefs: pickNonEmptyRefs(table.sourceRefs, table.source_refs)
      };
    }
    function isPromptPlaceholderField(value) {
      const raw = String(value || "").trim();
      if (!raw) return true;
      return /^field[_-]?\d+$/i.test(raw) || /^FIELD\d+$/i.test(raw) || /^\[object\s+[^\]]+\]$/i.test(raw) || /^(object_object|table_object|dict_object|unknown|tbd)$/i.test(raw);
    }
    function sanitizePromptKeyInfoItem(value) {
      const raw = text(extractKeyInfoItemText(value), 64);
      if (!raw) return "";
      if (isPromptPlaceholderField(raw)) return "";
      if (/[A-Za-z_]/.test(raw)) return "";
      if (/[()（）]/.test(raw)) return "";
      if (/[,:;：；]/.test(raw)) return "";
      if (/作为|用于|关联|对应|分为|说明|唯一标识/.test(raw)) return "";
      if (/^(主键|外键)$/.test(raw)) return "";
      return raw;
    }
    function sanitizeStoredKeyInfoItem(value) {
      const raw = text(extractKeyInfoItemText(value), 64);
      if (!raw) return "";
      if (isPromptPlaceholderField(raw)) return "";
      if (/[()（）]/.test(raw)) return "";
      if (!hasChineseText(raw) && /^[A-Za-z0-9_]+$/.test(raw)) return "";
      if (/[,:;：；]/.test(raw)) return "";
      if (/作为|用于|分为|说明|唯一标识|业务规则|取值说明|主键说明|关联说明/.test(raw) && raw.length > 8) return "";
      return raw;
    }
    function normalizeKeyInfoItemList(values = [], limit = 16) {
      return uniq((Array.isArray(values) ? values : []).map((item) => sanitizeStoredKeyInfoItem(item)).filter(Boolean), limit);
    }
    function sanitizePromptFieldLabel(value) {
      const raw = text(extractFieldLabelText(value), 64);
      if (!raw) return "";
      if (isPromptPlaceholderField(raw)) return "";
      if (/[A-Za-z_]/.test(raw)) return "";
      if (/[()（）]/.test(raw)) return "";
      return raw;
    }
    function buildPromptTableSnapshot(table = {}) {
      const keyInfoItems = uniq((Array.isArray(table.keyInfoItems) ? table.keyInfoItems : []).map(sanitizePromptKeyInfoItem).filter(Boolean), 12);
      const fields = uniq((Array.isArray(table.fields) ? table.fields : []).map(sanitizePromptFieldLabel).filter(Boolean), 16);
      const promptFields = fields.length > 0 ? fields : keyInfoItems;
      return {
        tableName: text(table.tableName, 64),
        tableLabel: text(table.tableLabel, 64),
        tableComment: text(table.tableComment, 160),
        fields: promptFields,
        keyInfoItems,
        sourceRefs: uniq(table.sourceRefs || table.source_refs, 12)
      };
    }
    function buildGenericGapProfile(targetCategory, dictionaryItems = []) {
      const tableHints = (Array.isArray(targetCategory?.tableDetails) ? targetCategory.tableDetails : []).flatMap((item) => [
        item?.tableName,
        item?.tableLabel,
        item?.tableComment
      ]);
      const dictHints = (Array.isArray(dictionaryItems) ? dictionaryItems : []).flatMap((item) => [
        item?.dictType,
        item?.dictName,
        item?.itemValue?.dictName,
        item?.itemLabel
      ]);
      const haystack = [
        targetCategory?.categoryName,
        targetCategory?.description,
        ...Array.isArray(targetCategory?.tableScopes) ? targetCategory.tableScopes : [],
        ...tableHints,
        ...dictHints
      ].map((item) => String(item || "").toLowerCase()).join(" ");
      const missingDimensions = [];
      if (!/台账|档案|record|log|ledger|detail|list/.test(haystack)) missingDimensions.push("\u53F0\u8D26\u6863\u6848");
      if (!/状态|阶段|status|phase/.test(haystack)) missingDimensions.push("\u72B6\u6001\u9636\u6BB5");
      if (!/审批|流程|audit|workflow|process|flow/.test(haystack)) missingDimensions.push("\u5BA1\u6279\u6D41\u7A0B");
      if (!/资源|设施|asset|facility|resource/.test(haystack)) missingDimensions.push("\u8D44\u6E90\u8BBE\u65BD");
      if (!/标准|规则|policy|standard|rule|spec/.test(haystack)) missingDimensions.push("\u89C4\u5219\u6807\u51C6");
      return {
        missingDimensions,
        gapKeywords: uniq(missingDimensions.map((item) => [targetCategory?.categoryName || "", item].join(" ").trim()), 24)
      };
    }
    function mergeTable(existing = {}, incoming = {}) {
      const mergedFields = normalizeFieldList([...Array.isArray(existing.fields) ? existing.fields : [], ...Array.isArray(incoming.fields) ? incoming.fields : []]);
      const mergedKeyInfoItems = normalizeKeyInfoItemList([...Array.isArray(existing.keyInfoItems) ? existing.keyInfoItems : [], ...Array.isArray(incoming.keyInfoItems) ? incoming.keyInfoItems : []]);
      return {
        tableName: existing.tableName || incoming.tableName,
        tableLabel: incoming.tableLabel || existing.tableLabel,
        tableComment: incoming.tableComment || existing.tableComment,
        keyInfoItems: mergedKeyInfoItems.length > 0 ? mergedKeyInfoItems : mergedFields.slice(0, 16),
        fields: mergedFields,
        sourceRefs: uniq([...Array.isArray(existing.sourceRefs) ? existing.sourceRefs : [], ...Array.isArray(incoming.sourceRefs) ? incoming.sourceRefs : []], 16)
      };
    }
    function normalizeCategory(category = {}, fallback = {}) {
      const tableDetails = (Array.isArray(category.tableDetails) ? category.tableDetails : Array.isArray(category.table_details) ? category.table_details : []).map(normalizeTable);
      return {
        categoryCode: normalizeCode(category.categoryCode || category.category_code || fallback.categoryCode || category.categoryName || category.category_name, "category"),
        categoryName: text(category.categoryName || category.category_name || fallback.categoryName || category.categoryCode || category.category_code, 64),
        description: text(category.description || category.desc || fallback.description || "", 240),
        tableDetails,
        tableScopes: tableDetails.map((item) => item.tableName),
        sourceRefs: pickNonEmptyRefs(
          category.sourceRefs,
          category.source_refs,
          category.evidenceRefs,
          category.evidence_refs,
          fallback.sourceRefs,
          fallback.evidenceRefs
        ),
        evidenceRefs: pickNonEmptyRefs(
          category.evidenceRefs,
          category.evidence_refs,
          category.sourceRefs,
          category.source_refs,
          fallback.evidenceRefs,
          fallback.sourceRefs
        ),
        continueIteration: category.continueIteration !== false && category.continue_iteration !== false
      };
    }
    function mergeCategory(existing = {}, incoming = {}) {
      const tableMap = /* @__PURE__ */ new Map();
      (Array.isArray(existing.tableDetails) ? existing.tableDetails : []).forEach((item) => tableMap.set(String(item.tableName || "").trim(), item));
      (Array.isArray(incoming.tableDetails) ? incoming.tableDetails : []).forEach((item) => {
        const key = String(item.tableName || "").trim();
        if (!key) return;
        tableMap.set(key, tableMap.has(key) ? mergeTable(tableMap.get(key), item) : item);
      });
      const mergedTables = Array.from(tableMap.values());
      return {
        categoryCode: existing.categoryCode || incoming.categoryCode,
        categoryName: incoming.categoryName || existing.categoryName,
        description: incoming.description || existing.description,
        tableDetails: mergedTables,
        tableScopes: mergedTables.map((item) => item.tableName),
        sourceRefs: uniq([...Array.isArray(existing.sourceRefs) ? existing.sourceRefs : [], ...Array.isArray(incoming.sourceRefs) ? incoming.sourceRefs : []], 16),
        evidenceRefs: uniq([...Array.isArray(existing.evidenceRefs) ? existing.evidenceRefs : [], ...Array.isArray(incoming.evidenceRefs) ? incoming.evidenceRefs : []], 32),
        continueIteration: incoming.continueIteration !== false && existing.continueIteration !== false
      };
    }
    function backfillCategoryEvidenceRefs(categories = [], fallbackRefs = []) {
      const refs = uniq(fallbackRefs, 32);
      if (refs.length === 0) {
        return Array.isArray(categories) ? categories : [];
      }
      return (Array.isArray(categories) ? categories : []).map((category) => {
        const categoryRefs = uniq(Array.isArray(category?.sourceRefs) ? category.sourceRefs : [], 32);
        const tableDetails = (Array.isArray(category?.tableDetails) ? category.tableDetails : []).map((table) => ({
          ...table,
          sourceRefs: uniq(
            Array.isArray(table?.sourceRefs) && table.sourceRefs.length > 0 ? table.sourceRefs : categoryRefs.length > 0 ? categoryRefs : refs,
            32
          )
        }));
        return {
          ...category,
          sourceRefs: categoryRefs.length > 0 ? categoryRefs : refs,
          evidenceRefs: uniq(
            Array.isArray(category?.evidenceRefs) && category.evidenceRefs.length > 0 ? category.evidenceRefs : categoryRefs.length > 0 ? categoryRefs : refs,
            32
          ),
          tableDetails,
          tableScopes: tableDetails.map((item) => item.tableName)
        };
      });
    }
    function normalizeDictionary(dictionary = {}, index = 0) {
      const rawItems = Array.isArray(dictionary.items) ? dictionary.items : Array.isArray(dictionary.dictItems) ? dictionary.dictItems : Array.isArray(dictionary.dict_items) ? dictionary.dict_items : Array.isArray(dictionary.newItems) ? dictionary.newItems : Array.isArray(dictionary.new_items) ? dictionary.new_items : Array.isArray(dictionary.addItems) ? dictionary.addItems : Array.isArray(dictionary.add_items) ? dictionary.add_items : [];
      return {
        dictType: normalizeCode(dictionary.dictType || dictionary.dict_type || dictionary.dictCode || dictionary.dict_code || dictionary.dictName || dictionary.dict_name, "dict"),
        dictName: text(dictionary.dictName || dictionary.dict_name || dictionary.name || `dict_${index + 1}`, 64),
        categoryCode: dictionary.categoryCode || dictionary.category_code ? normalizeCode(dictionary.categoryCode || dictionary.category_code, "category") : null,
        sourceRefs: uniq(dictionary.sourceRefs || dictionary.source_refs, 12),
        items: rawItems.map((item, itemIndex) => {
          const rawCode = String(item?.itemCode || item?.item_code || "").trim().toUpperCase();
          return {
            itemCode: /^[A-Z0-9]{2,8}$/.test(rawCode) ? rawCode : String(itemIndex + 1).padStart(2, "0"),
            itemLabel: text(item?.itemLabel || item?.item_label || item?.itemName || item?.item_name || `item_${itemIndex + 1}`, 64),
            valueRange: text(item?.valueRange || item?.value_range || "", 128) || null,
            sourceRefs: uniq(item?.sourceRefs || item?.source_refs, 12)
          };
        })
      };
    }
    function summarizeExtractionDiagnostics(root, categories, dictionaries, candidateTableSpecs) {
      const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
      return {
        rootCategoryCode: root?.categoryCode || root?.category_code || null,
        rootCategoryName: root?.categoryName || root?.category_name || null,
        rootCategoriesCount: Array.isArray(root?.categories) ? root.categories.length : 0,
        rootTableDetailsCount: Array.isArray(root?.tableDetails) ? root.tableDetails.length : Array.isArray(root?.table_details) ? root.table_details.length : 0,
        rootTableDetailsIncrementCount: Array.isArray(root?.tableDetailsIncrement) ? root.tableDetailsIncrement.length : Array.isArray(root?.table_details_increment) ? root.table_details_increment.length : 0,
        rootNewTableDetailsCount: Array.isArray(root?.newTableDetails) ? root.newTableDetails.length : Array.isArray(root?.new_table_details) ? root.new_table_details.length : 0,
        rootCandidateTableSpecsCount: Array.isArray(root?.candidateTableSpecs) ? root.candidateTableSpecs.length : Array.isArray(root?.candidate_table_specs) ? root.candidate_table_specs.length : 0,
        rootDictionariesCount: Array.isArray(root?.dictionaries) ? root.dictionaries.length : 0,
        rootDictionaryIncrementsCount: Array.isArray(root?.dictionaryIncrements) ? root.dictionaryIncrements.length : Array.isArray(root?.dictionary_increments) ? root.dictionary_increments.length : 0,
        rootNewDictionariesCount: Array.isArray(root?.newDictionaries) ? root.newDictionaries.length : Array.isArray(root?.new_dictionaries) ? root.new_dictionaries.length : 0,
        rootDictionaryItemIncrementsCount: Array.isArray(root?.dictionaryItemIncrements) ? root.dictionaryItemIncrements.length : Array.isArray(root?.dictionary_item_increments) ? root.dictionary_item_increments.length : 0,
        incrementsNewTablesCount: Array.isArray(increments?.newTables) ? increments.newTables.length : Array.isArray(increments?.new_tables) ? increments.new_tables.length : 0,
        incrementsNewDictionariesCount: Array.isArray(increments?.newDictionaries) ? increments.newDictionaries.length : Array.isArray(increments?.new_dictionaries) ? increments.new_dictionaries.length : 0,
        incrementsDictionaryItemAdditionsCount: Array.isArray(increments?.dictionaryItemAdditions) ? increments.dictionaryItemAdditions.length : Array.isArray(increments?.dictionary_item_additions) ? increments.dictionary_item_additions.length : 0,
        incrementsDictionaryItemIncrementsCount: Array.isArray(increments?.dictionaryItemIncrements) ? increments.dictionaryItemIncrements.length : Array.isArray(increments?.dictionary_item_increments) ? increments.dictionary_item_increments.length : 0,
        normalizedCategoryCount: Array.isArray(categories) ? categories.length : 0,
        normalizedTableCount: Array.isArray(candidateTableSpecs) ? candidateTableSpecs.length : 0,
        normalizedDictionaryCount: Array.isArray(dictionaries) ? dictionaries.length : 0,
        normalizedDictionaryItemCount: (Array.isArray(dictionaries) ? dictionaries : []).reduce((sum, item) => sum + (Array.isArray(item?.items) ? item.items.length : 0), 0)
      };
    }
    function buildCategoryOutputSchemaTemplate() {
      return {
        summary: "string",
        categoryCode: "string",
        categoryName: "string",
        newTables: [
          {
            tableName: "string",
            tableLabel: "string",
            tableComment: "string",
            fields: ["string"],
            keyInfoItems: ["string"],
            sourceRefs: ["string"]
          }
        ],
        newDictionaries: [
          {
            dictType: "string",
            dictName: "string",
            items: [
              {
                itemCode: "string",
                itemLabel: "string",
                valueRange: "string"
              }
            ],
            sourceRefs: ["string"]
          }
        ],
        dictionaryItemIncrements: [
          {
            dictType: "string",
            dictName: "string",
            items: [
              {
                itemCode: "string",
                itemLabel: "string",
                valueRange: "string"
              }
            ],
            sourceRefs: ["string"]
          }
        ]
      };
    }
    function buildIndustryOutputSchemaTemplate() {
      return {
        summary: "string",
        categories: [
          {
            categoryCode: "string",
            categoryName: "string",
            description: "string",
            tableDetails: [
              {
                tableName: "string",
                tableLabel: "string",
                tableComment: "string",
                fields: ["string"],
                keyInfoItems: ["string"],
                sourceRefs: ["string"]
              }
            ],
            sourceRefs: ["string"],
            evidenceRefs: ["string"]
          }
        ],
        dictionaries: [
          {
            dictType: "string",
            dictName: "string",
            categoryCode: "string",
            items: [
              {
                itemCode: "string",
                itemLabel: "string",
                valueRange: "string"
              }
            ],
            sourceRefs: ["string"]
          }
        ],
        candidateTableSpecs: [
          {
            tableName: "string",
            tableLabel: "string",
            tableComment: "string",
            fields: ["string"],
            keyInfoItems: ["string"],
            sourceRefs: ["string"]
          }
        ]
      };
    }
    function collectCategoryTableCandidates(root = {}) {
      const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
      const buckets = [
        root?.newTables,
        root?.new_tables,
        root?.tableDetails,
        root?.table_details,
        root?.tableDetailsIncrement,
        root?.table_details_increment,
        root?.newTableDetails,
        root?.new_table_details,
        root?.candidateTableSpecs,
        root?.candidate_table_specs,
        increments?.newTables,
        increments?.new_tables
      ];
      return buckets.find((item) => Array.isArray(item)) || [];
    }
    function collectCategoryNewDictionaryCandidates(root = {}) {
      const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
      const buckets = [
        root?.newDictionaries,
        root?.new_dictionaries,
        root?.dictionaries,
        root?.dictionaryIncrements,
        root?.dictionary_increments,
        increments?.newDictionaries,
        increments?.new_dictionaries,
        increments?.dictionaryIncrements,
        increments?.dictionary_increments
      ];
      return buckets.find((item) => Array.isArray(item)) || [];
    }
    function collectCategoryDictionaryIncrementCandidates(root = {}) {
      const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
      const buckets = [
        root?.dictionaryItemIncrements,
        root?.dictionary_item_increments,
        root?.dictionaryItemAdditions,
        root?.dictionary_item_additions,
        increments?.dictionaryItemIncrements,
        increments?.dictionary_item_increments,
        increments?.dictionaryItemAdditions,
        increments?.dictionary_item_additions
      ];
      return buckets.find((item) => Array.isArray(item)) || [];
    }
    function buildCanonicalIndustryOutput(parsed) {
      const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed && typeof parsed === "object" ? parsed : {};
      const categoryCandidates = Array.isArray(root?.categories) ? root.categories : Array.isArray(root?.subCategories) ? root.subCategories : Array.isArray(root?.sub_categories) ? root.sub_categories : root?.categoryCode || root?.category_code || root?.categoryName || root?.category_name ? [{
        categoryCode: root?.categoryCode || root?.category_code,
        categoryName: root?.categoryName || root?.category_name,
        description: root?.description || root?.desc || "",
        tableDetails: Array.isArray(root?.tableDetails) ? root.tableDetails : Array.isArray(root?.table_details) ? root.table_details : [],
        sourceRefs: root?.sourceRefs || root?.source_refs || [],
        evidenceRefs: root?.evidenceRefs || root?.evidence_refs || []
      }] : [];
      const categories = categoryCandidates.map((item) => ({
        categoryCode: item?.categoryCode || item?.category_code || "",
        categoryName: item?.categoryName || item?.category_name || "",
        description: item?.description || item?.desc || "",
        tableDetails: Array.isArray(item?.tableDetails) ? item.tableDetails : Array.isArray(item?.table_details) ? item.table_details : [],
        sourceRefs: Array.isArray(item?.sourceRefs) ? item.sourceRefs : Array.isArray(item?.source_refs) ? item.source_refs : [],
        evidenceRefs: Array.isArray(item?.evidenceRefs) ? item.evidenceRefs : Array.isArray(item?.evidence_refs) ? item.evidence_refs : []
      }));
      const candidateTableSpecs = Array.isArray(root?.candidateTableSpecs) ? root.candidateTableSpecs : Array.isArray(root?.candidate_table_specs) ? root.candidate_table_specs : categories.flatMap((item) => Array.isArray(item?.tableDetails) ? item.tableDetails : []);
      const dictionaries = Array.isArray(root?.dictionaries) ? root.dictionaries : [];
      return {
        summary: text(root?.summary || "", 160),
        categories,
        dictionaries,
        candidateTableSpecs
      };
    }
    function buildCanonicalCategoryOutput(parsed, options = {}) {
      const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed && typeof parsed === "object" ? parsed : {};
      const targetCategoryCode = String(options.targetCategoryCode || "").trim() || null;
      const targetCategoryName = String(options.targetCategoryName || "").trim() || null;
      return {
        summary: text(root?.summary || "", 160),
        categoryCode: text(root?.categoryCode || root?.category_code || targetCategoryCode || "", 64),
        categoryName: text(root?.categoryName || root?.category_name || targetCategoryName || "", 64),
        newTables: collectCategoryTableCandidates(root),
        newDictionaries: collectCategoryNewDictionaryCandidates(root),
        dictionaryItemIncrements: collectCategoryDictionaryIncrementCandidates(root)
      };
    }
    function validateCanonicalCategoryOutput(output, options = {}) {
      const allowedTopKeys = /* @__PURE__ */ new Set(["summary", "categoryCode", "categoryName", "newTables", "newDictionaries", "dictionaryItemIncrements"]);
      const errors = [];
      const data = output && typeof output === "object" ? output : {};
      const topKeys = Object.keys(data);
      const illegalTopKeys = topKeys.filter((key) => !allowedTopKeys.has(key));
      if (illegalTopKeys.length > 0) errors.push(`illegal top-level keys: ${illegalTopKeys.join(", ")}`);
      ["summary", "categoryCode", "categoryName"].forEach((key) => {
        if (!String(data?.[key] || "").trim()) errors.push(`missing or empty ${key}`);
      });
      ["newTables", "newDictionaries", "dictionaryItemIncrements"].forEach((key) => {
        if (!Array.isArray(data?.[key])) errors.push(`${key} must be an array`);
      });
      const expectedCode = String(options.targetCategoryCode || "").trim();
      if (expectedCode && String(data?.categoryCode || "").trim() && String(data.categoryCode).trim() !== expectedCode) {
        errors.push(`categoryCode mismatch: expected ${expectedCode}`);
      }
      const totalIncrementCount = (Array.isArray(data?.newTables) ? data.newTables.length : 0) + (Array.isArray(data?.newDictionaries) ? data.newDictionaries.length : 0) + (Array.isArray(data?.dictionaryItemIncrements) ? data.dictionaryItemIncrements.length : 0);
      if (totalIncrementCount < 1) errors.push("no increments extracted into canonical schema");
      return {
        valid: errors.length === 0,
        errors,
        topKeys,
        counts: {
          newTables: Array.isArray(data?.newTables) ? data.newTables.length : -1,
          newDictionaries: Array.isArray(data?.newDictionaries) ? data.newDictionaries.length : -1,
          dictionaryItemIncrements: Array.isArray(data?.dictionaryItemIncrements) ? data.dictionaryItemIncrements.length : -1,
          totalIncrementCount
        }
      };
    }
    function validateCanonicalIndustryOutput(output) {
      const allowedTopKeys = /* @__PURE__ */ new Set(["summary", "categories", "dictionaries", "candidateTableSpecs"]);
      const errors = [];
      const data = output && typeof output === "object" ? output : {};
      const topKeys = Object.keys(data);
      const illegalTopKeys = topKeys.filter((key) => !allowedTopKeys.has(key));
      if (illegalTopKeys.length > 0) errors.push(`illegal top-level keys: ${illegalTopKeys.join(", ")}`);
      if (!String(data?.summary || "").trim()) errors.push("missing or empty summary");
      if (!Array.isArray(data?.categories)) errors.push("categories must be an array");
      if (!Array.isArray(data?.dictionaries)) errors.push("dictionaries must be an array");
      if (!Array.isArray(data?.candidateTableSpecs)) errors.push("candidateTableSpecs must be an array");
      const categories = Array.isArray(data?.categories) ? data.categories : [];
      if (categories.length < 1) errors.push("categories must contain at least one category");
      if (categories.length > 1) errors.push("categories must contain exactly one category");
      const firstCategory = categories[0] || {};
      if (!String(firstCategory?.categoryCode || "").trim()) errors.push("missing categoryCode in categories[0]");
      if (!String(firstCategory?.categoryName || "").trim()) errors.push("missing categoryName in categories[0]");
      const categoryTableCount = Array.isArray(firstCategory?.tableDetails) ? firstCategory.tableDetails.length : 0;
      const candidateTableCount = Array.isArray(data?.candidateTableSpecs) ? data.candidateTableSpecs.length : 0;
      if (Math.max(categoryTableCount, candidateTableCount) < 1) errors.push("no table increments extracted into canonical schema");
      return {
        valid: errors.length === 0,
        errors,
        topKeys,
        counts: {
          categories: categories.length,
          categoryTableCount,
          candidateTableCount,
          dictionaries: Array.isArray(data?.dictionaries) ? data.dictionaries.length : -1
        }
      };
    }
    async function repairCategoryOutputShape(provider, promptInput, rawText, options = {}) {
      const schemaTemplate = JSON.stringify(buildCategoryOutputSchemaTemplate(), null, 2);
      const repairMessages = [
        {
          role: "system",
          content: [
            "You repair one category enhancement JSON into the required canonical schema.",
            "Preserve business meaning and increments.",
            "Return one valid JSON object only.",
            "Top-level keys must be exactly: summary, categoryCode, categoryName, newTables, newDictionaries, dictionaryItemIncrements.",
            "Do not output keys such as increments, tableDetails, tableDetailsIncrement, newTableDetails, candidateTableSpecs, dictionaries, dictionaryIncrements, dictionaryItemAdditions, dictItems, newItems, addItems.",
            "If a section has no content, return an empty array.",
            "Schema template:",
            schemaTemplate
          ].join("\n")
        },
        {
          role: "user",
          content: [
            `Target categoryCode: ${promptInput?.targetCategoryCode || ""}`,
            `Target categoryName: ${promptInput?.targetCategoryName || ""}`,
            "Rewrite the following model output into the canonical schema only. Do not change business meaning.",
            rawText
          ].join("\n\n")
        }
      ];
      return strictGenerateChatCompletion(provider, repairMessages, {
        temperature: 0,
        maxTokens: Math.min(Number(options.maxTokens || 4e3), 4e3),
        timeoutMs: Number(options.timeoutMs || 6e5)
      });
    }
    async function repairIndustryOutputShape(provider, promptInput, rawText, options = {}) {
      const schemaTemplate = JSON.stringify(buildIndustryOutputSchemaTemplate(), null, 2);
      const compactRetry = options.compactRetry === true;
      const repairMessages = [
        {
          role: "system",
          content: [
            compactRetry ? "Regenerate a complete industry-incubation JSON from the provided business context and any partial model output." : "You repair one industry-incubation JSON into the required canonical schema.",
            "Preserve business meaning and proposed increments where present.",
            "Return one valid JSON object only.",
            "Top-level keys must be exactly: summary, categories, dictionaries, candidateTableSpecs.",
            "Do not output keys such as increments, subCategories, sub_categories, newTables, newDictionaries, dictionaryItemIncrements, dictionaryItemAdditions.",
            "The categories array must contain exactly one category with a non-empty categoryCode and categoryName.",
            "The category must contain at least one concrete tableDetails entry, and candidateTableSpecs must contain at least one table.",
            "Never return empty categories or candidateTableSpecs when the business context describes a new subcategory.",
            "Schema template:",
            schemaTemplate
          ].join("\n")
        },
        {
          role: "user",
          content: [
            `Industry name: ${promptInput?.incubationName || ""}`,
            `Industry description: ${text(promptInput?.incubationDesc || "", 1200)}`,
            `Structured business context: ${JSON.stringify(promptInput || {}, null, 2)}`,
            compactRetry ? "Generate the missing category and at least one operational table from the full context. Keep identifiers in snake_case and labels/comments in Chinese." : "Rewrite the following model output into the canonical schema only. Do not change business meaning; if the output is truncated, recover the missing structure from the full context.",
            rawText
          ].join("\n\n")
        }
      ];
      return strictGenerateChatCompletion(provider, repairMessages, {
        temperature: 0,
        maxTokens: Math.min(Number(options.maxTokens || 4e3), 4e3),
        timeoutMs: Number(options.timeoutMs || 6e5)
      });
    }
    function mergeDictionary(existing = {}, incoming = {}) {
      const itemMap = /* @__PURE__ */ new Map();
      [...Array.isArray(existing.items) ? existing.items : [], ...Array.isArray(incoming.items) ? incoming.items : []].forEach((item) => {
        const key = String(item?.itemCode || item?.itemLabel || "").trim();
        if (!key) return;
        itemMap.set(key, item);
      });
      return {
        dictType: existing.dictType || incoming.dictType,
        dictName: incoming.dictName || existing.dictName,
        categoryCode: incoming.categoryCode || existing.categoryCode,
        sourceRefs: uniq([...Array.isArray(existing.sourceRefs) ? existing.sourceRefs : [], ...Array.isArray(incoming.sourceRefs) ? incoming.sourceRefs : []], 16),
        items: Array.from(itemMap.values())
      };
    }
    function parseModelJson(rawText) {
      const raw = String(rawText || "").trim();
      if (!raw) return {};
      const candidates = [raw];
      const fencedStart = raw.indexOf("```");
      if (fencedStart >= 0) {
        const fencedEnd = raw.indexOf("```", fencedStart + 3);
        if (fencedEnd > fencedStart) {
          let fenced = raw.slice(fencedStart + 3, fencedEnd).trim();
          if (fenced.toLowerCase().startsWith("json")) fenced = fenced.slice(4).trim();
          if (fenced) candidates.push(fenced);
        }
      }
      const objStart = raw.indexOf("{");
      const objEnd = raw.lastIndexOf("}");
      if (objStart >= 0 && objEnd > objStart) candidates.push(raw.slice(objStart, objEnd + 1));
      for (const candidate of candidates) {
        try {
          return JSON.parse(candidate);
        } catch {
          continue;
        }
      }
      return {};
    }
    function extractPartialSummary(rawText) {
      const raw = String(rawText || "");
      const match = raw.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)/i);
      if (!match) return "";
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1].replace(/\\n/g, " ").replace(/\\"/g, '"').trim();
      }
    }
    function buildIndustryRecoveryOutput(promptInput = {}, parsedOutput = {}, rawText = "") {
      const root = parsedOutput?.data && typeof parsedOutput.data === "object" ? parsedOutput.data : parsedOutput && typeof parsedOutput === "object" ? parsedOutput : {};
      const summary = text(root?.summary || extractPartialSummary(rawText) || promptInput?.incubationDesc || promptInput?.incubationName || "\u884C\u4E1A\u5143\u6570\u636E\u8865\u5168", 160);
      const categoryName = text(
        root?.categories?.[0]?.categoryName || root?.categoryName || root?.category_name || (summary.match(/新增子类目[：:]\s*([^。；;，,\n]+)/)?.[1] || "") || promptInput?.targetCategoryName || `${promptInput?.incubationName || "\u884C\u4E1A"}\u4E1A\u52A1`,
        64
      );
      const categoryCode = normalizeCode(
        root?.categories?.[0]?.categoryCode || root?.categoryCode || root?.category_code,
        `industry_${normalizeCode(promptInput?.industryCode || promptInput?.incubationName || "category", "category")}`
      );
      const tableName = `${categoryCode}_operations`;
      const table = {
        tableName,
        tableLabel: `${categoryName}\u4F5C\u4E1A\u8BB0\u5F55`,
        tableComment: `\u8BB0\u5F55${categoryName}\u63A5\u5378\u3001\u4F5C\u4E1A\u3001\u5806\u5B58\u53CA\u758F\u8FD0\u7B49\u6838\u5FC3\u4E1A\u52A1\u8FC7\u7A0B\u3002`,
        fields: ["\u4E1A\u52A1\u65E5\u671F", "\u4F5C\u4E1A\u5355\u53F7", "\u4F5C\u4E1A\u72B6\u6001", "\u4F5C\u4E1A\u6570\u91CF", "\u8D23\u4EFB\u5355\u4F4D"],
        keyInfoItems: ["\u4F5C\u4E1A\u5355\u53F7", "\u4E1A\u52A1\u65E5\u671F"],
        sourceRefs: Array.isArray(promptInput?.evidenceItems) ? promptInput.evidenceItems.map((item) => item?.id).filter(Boolean).slice(0, 8) : []
      };
      return {
        summary,
        categories: [{
          categoryCode,
          categoryName,
          description: summary,
          tableDetails: [table],
          sourceRefs: table.sourceRefs,
          evidenceRefs: table.sourceRefs
        }],
        dictionaries: [],
        candidateTableSpecs: [table]
      };
    }
    function extractCompletionContent(data) {
      const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
      const content = choice?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) return content.map((item) => item?.text || item?.output_text || "").join("\n");
      if (typeof choice?.text === "string") return choice.text;
      return "";
    }
    function buildProviderHeaders(provider) {
      const extraHeaders = provider?.extraConfig?.defaultHeaders && typeof provider.extraConfig.defaultHeaders === "object" ? Object.fromEntries(Object.entries(provider.extraConfig.defaultHeaders).map(([key, value]) => [key, String(value)])) : {};
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...extraHeaders
      };
      if (provider.organizationId && provider.providerType === "openai") headers["OpenAI-Organization"] = provider.organizationId;
      if (provider.providerType === "azure_openai") {
        delete headers.Authorization;
        headers["api-key"] = provider.apiKey;
      }
      return headers;
    }
    function buildProviderEndpoint(provider) {
      const baseUrl = String(provider.baseUrl || "").replace(/\/+$/, "");
      if (!baseUrl) throw new AppError("industry provider baseUrl is empty", 400);
      if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
      if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
      return `${baseUrl}/v1/chat/completions`;
    }
    async function strictGenerateChatCompletion(provider, messages, options = {}) {
      const endpoint = buildProviderEndpoint(provider);
      const timeoutMs = Number(options.timeoutMs || 6e5);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: buildProviderHeaders(provider),
          body: JSON.stringify({
            model: provider.modelName,
            messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens
          }),
          signal: controller.signal
        });
        const responseText = await response.text();
        let data = {};
        try {
          data = responseText ? JSON.parse(responseText) : {};
        } catch {
          data = { raw: responseText };
        }
        if (!response.ok) {
          const message = data?.error?.message || data?.message || response.statusText || "model_request_failed";
          throw new AppError(`model request failed: ${message}`, 400, { attemptedEndpoint: endpoint, status: response.status });
        }
        const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
        const content = extractCompletionContent(data);
        if (!content) throw new AppError("model request failed: empty content", 400, { attemptedEndpoint: endpoint, status: response.status });
        return {
          content,
          raw: {
            checkedEndpoint: endpoint,
            adapted: false,
            finishReason: choice?.finish_reason || choice?.finishReason || null,
            usage: data?.usage || null
          }
        };
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new AppError("model request failed: timeout", 400, { attemptedEndpoint: endpoint, timeoutMs });
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    function mapProject(row, rounds = []) {
      const defaults = defaultConfig();
      return {
        id: Number(row.id),
        incubationName: row.incubationName,
        incubationCode: row.incubationCode,
        industryCode: row.industryCode,
        enhancementProfileId: row.enhancementProfileId ? Number(row.enhancementProfileId) : null,
        enhancementProfileName: row.enhancementProfileName || null,
        incubationDesc: row.incubationDesc || null,
        status: row.status,
        languagePolicy: safeJson(row.languagePolicy, defaults.languagePolicy),
        autoResearchPolicy: safeJson(row.autoResearchPolicy, defaults.autoResearchPolicy),
        modelCommittee: safeJson(row.modelCommittee, defaults.modelCommittee),
        scenarioPool: safeJson(row.scenarioPool, defaults.scenarioPool),
        scenarioCoverage: safeJson(row.scenarioCoverage, defaults.scenarioCoverage),
        evidenceCatalog: safeJson(row.evidenceCatalog, defaults.evidenceCatalog),
        standardAssets: safeJson(row.standardAssets, defaults.standardAssets),
        publicDataProfiles: safeJson(row.publicDataProfiles, {}),
        trainingSettings: normalizeTrainingSettings(row.trainingSettings),
        evaluationRubric: safeJson(row.evaluationRubric, {}),
        overridePolicies: safeJson(row.overridePolicies, {}),
        latestRoundNo: Number(row.latestRoundNo || 0),
        lastSyncedAt: row.lastSyncedAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        rounds
      };
    }
    function hasOwnPayloadField(payload, key) {
      return Object.prototype.hasOwnProperty.call(payload || {}, key);
    }
    function mergeIncubationPayloadForUpdate(existing, payload) {
      const merged = { ...payload || {} };
      const fieldMap = {
        incubationName: existing.incubationName,
        incubationCode: existing.incubationCode,
        industryCode: existing.industryCode,
        enhancementProfileId: existing.enhancementProfileId,
        incubationDesc: existing.incubationDesc,
        status: existing.status,
        languagePolicy: existing.languagePolicy,
        autoResearchPolicy: existing.autoResearchPolicy,
        modelCommittee: existing.modelCommittee,
        scenarioPool: existing.scenarioPool,
        scenarioCoverage: existing.scenarioCoverage,
        evidenceCatalog: existing.evidenceCatalog,
        standardAssets: existing.standardAssets,
        publicDataProfiles: existing.publicDataProfiles,
        trainingSettings: existing.trainingSettings,
        evaluationRubric: existing.evaluationRubric,
        overridePolicies: existing.overridePolicies
      };
      const shallowMergeKeys = /* @__PURE__ */ new Set([
        "languagePolicy",
        "autoResearchPolicy",
        "modelCommittee",
        "scenarioPool",
        "scenarioCoverage",
        "evidenceCatalog",
        "standardAssets",
        "publicDataProfiles",
        "trainingSettings",
        "evaluationRubric",
        "overridePolicies"
      ]);
      Object.entries(fieldMap).forEach(([key, value]) => {
        if (!hasOwnPayloadField(payload, key)) {
          merged[key] = value;
          return;
        }
        if (shallowMergeKeys.has(key) && value && typeof value === "object" && merged[key] && typeof merged[key] === "object" && !Array.isArray(value) && !Array.isArray(merged[key])) {
          merged[key] = {
            ...value,
            ...merged[key]
          };
          if (key === "trainingSettings") {
            merged[key].runState = {
              ...value.runState && typeof value.runState === "object" ? value.runState : {},
              ...merged[key].runState && typeof merged[key].runState === "object" ? merged[key].runState : {}
            };
          }
        }
      });
      return merged;
    }
    async function appendLog(incubationId, payload = {}) {
      await pool.query(
        "INSERT INTO lab_industry_incubation_log (incubation_id, round_no, log_level, log_type, step_key, message, request_payload_json, response_payload_json, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          Number(incubationId),
          payload.roundNo ? Number(payload.roundNo) : null,
          payload.logLevel || "info",
          payload.logType || "run",
          payload.stepKey || "unknown",
          text(payload.message || payload.stepKey || "log", 500),
          JSON.stringify(payload.requestPayload || null),
          JSON.stringify(payload.responsePayload || null),
          JSON.stringify(payload.detail || null)
        ]
      );
    }
    async function getBase(id) {
      const scoped = getScopedWhere("p");
      const [rows] = await pool.query(
        `SELECT p.id, p.incubation_name AS incubationName, p.incubation_code AS incubationCode, p.industry_code AS industryCode, p.enhancement_profile_id AS enhancementProfileId, profile.profile_name AS enhancementProfileName, p.incubation_desc AS incubationDesc, p.status, p.language_policy_json AS languagePolicy, p.auto_research_policy_json AS autoResearchPolicy, p.model_committee_json AS modelCommittee, p.scenario_pool_json AS scenarioPool, p.scenario_coverage_json AS scenarioCoverage, p.evidence_catalog_json AS evidenceCatalog, p.standard_assets_json AS standardAssets, p.public_data_profiles_json AS publicDataProfiles, p.training_settings_json AS trainingSettings, p.evaluation_rubric_json AS evaluationRubric, p.override_policies_json AS overridePolicies, p.latest_round_no AS latestRoundNo, p.last_synced_at AS lastSyncedAt, p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt FROM lab_industry_incubation p LEFT JOIN lab_scenario_profile profile ON profile.id = p.enhancement_profile_id WHERE p.id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""} LIMIT 1`,
        [Number(id), ...scoped.params]
      );
      const row = rows[0];
      if (!row) throw new AppError("incubation not found", 404);
      return row;
    }
    async function listRounds(incubationId) {
      const [rows] = await pool.query(
        "SELECT id, incubation_id AS incubationId, round_no AS roundNo, round_name AS roundName, round_status AS roundStatus, selected_scenarios_json AS selectedScenarios, evidence_snapshot_json AS evidenceSnapshot, committee_snapshot_json AS committeeSnapshot, result_summary_json AS resultSummary, enhancement_delta_json AS enhancementDelta, started_at AS startedAt, ended_at AS endedAt, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt FROM lab_industry_incubation_round WHERE incubation_id = ? ORDER BY round_no DESC, id DESC",
        [Number(incubationId)]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        incubationId: Number(row.incubationId),
        roundNo: Number(row.roundNo),
        roundName: row.roundName,
        roundStatus: row.roundStatus,
        selectedScenarios: safeJson(row.selectedScenarios, []),
        evidenceSnapshot: safeJson(row.evidenceSnapshot, []),
        committeeSnapshot: safeJson(row.committeeSnapshot, {}),
        resultSummary: safeJson(row.resultSummary, {}),
        enhancementDelta: safeJson(row.enhancementDelta, {}),
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    }
    async function listIndustryIncubations() {
      const scoped = getScopedWhere("p");
      const [rows] = await pool.query(
        `SELECT p.id, p.incubation_name AS incubationName, p.incubation_code AS incubationCode, p.industry_code AS industryCode, p.enhancement_profile_id AS enhancementProfileId, profile.profile_name AS enhancementProfileName, p.incubation_desc AS incubationDesc, p.status, p.language_policy_json AS languagePolicy, p.auto_research_policy_json AS autoResearchPolicy, p.model_committee_json AS modelCommittee, p.scenario_pool_json AS scenarioPool, p.scenario_coverage_json AS scenarioCoverage, p.evidence_catalog_json AS evidenceCatalog, p.standard_assets_json AS standardAssets, p.public_data_profiles_json AS publicDataProfiles, p.training_settings_json AS trainingSettings, p.evaluation_rubric_json AS evaluationRubric, p.override_policies_json AS overridePolicies, p.latest_round_no AS latestRoundNo, p.last_synced_at AS lastSyncedAt, p.created_by AS createdBy, p.created_at AS createdAt, p.updated_at AS updatedAt FROM lab_industry_incubation p LEFT JOIN lab_scenario_profile profile ON profile.id = p.enhancement_profile_id ${scoped.sql ? `WHERE ${scoped.sql}` : ""} ORDER BY p.id ASC`,
        scoped.params
      );
      return rows.map((row) => mapProject(row));
    }
    async function getIndustryIncubationDetail(id) {
      return mapProject(await getBase(id), await listRounds(id));
    }
    async function listIndustryIncubationLogs(id) {
      const [rows] = await pool.query("SELECT id, incubation_id AS incubationId, round_no AS roundNo, log_level AS logLevel, log_type AS logType, step_key AS stepKey, message, request_payload_json AS requestPayload, response_payload_json AS responsePayload, detail_json AS detail, created_at AS createdAt FROM lab_industry_incubation_log WHERE incubation_id = ? ORDER BY id DESC LIMIT 500", [Number(id)]);
      return rows.map((row) => ({
        id: Number(row.id),
        incubationId: Number(row.incubationId),
        roundNo: row.roundNo == null ? null : Number(row.roundNo),
        logLevel: row.logLevel,
        logType: row.logType,
        stepKey: row.stepKey,
        message: row.message,
        requestPayload: safeJson(row.requestPayload, null),
        responsePayload: safeJson(row.responsePayload, null),
        detail: safeJson(row.detail, null),
        createdAt: row.createdAt
      }));
    }
    async function getIndustryIncubationStats(id) {
      const detail = await getIndustryIncubationDetail(id);
      const categories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const dictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : [];
      return {
        incubationId: detail.id,
        incubationName: detail.incubationName,
        totals: {
          categoryCount: categories.length,
          tableCount: categories.reduce((sum, item) => sum + (Array.isArray(item?.tableDetails) ? item.tableDetails.length : 0), 0),
          dictionaryGroupCount: dictionaries.length,
          dictionaryItemCount: dictionaries.reduce((sum, item) => sum + (Array.isArray(item?.items) ? item.items.length : 0), 0),
          publicDictionaryGroupCount: 0,
          publicDictionaryItemCount: 0
        },
        categories: categories.map((category) => ({
          categoryCode: String(category?.categoryCode || ""),
          categoryName: String(category?.categoryName || category?.categoryCode || ""),
          tableCount: Array.isArray(category?.tableDetails) ? category.tableDetails.length : 0,
          dictionaryGroupCount: dictionaries.filter((item) => String(item?.categoryCode || "") === String(category?.categoryCode || "")).length,
          dictionaryItemCount: dictionaries.filter((item) => String(item?.categoryCode || "") === String(category?.categoryCode || "")).reduce((sum, item) => sum + (Array.isArray(item?.items) ? item.items.length : 0), 0),
          evidenceCount: Array.isArray(category?.evidenceRefs) ? category.evidenceRefs.length : 0,
          lastRoundNo: Number(detail.latestRoundNo || 0)
        })),
        publicDictionaries: []
      };
    }
    async function saveIndustryIncubation(payload, user) {
      const projectId = getCurrentProjectId();
      if (payload.id) {
        payload = mergeIncubationPayloadForUpdate(mapProject(await getBase(Number(payload.id))), payload);
      }
      const defaults = defaultConfig();
      const normalized = {
        id: payload.id ? Number(payload.id) : null,
        incubationName: text(payload.incubationName, 128),
        incubationCode: normalizeCode(payload.incubationCode || payload.incubationName, "industry_incubation"),
        industryCode: text(payload.industryCode, 32) || String(Math.floor(1e7 + Math.random() * 9e7)),
        enhancementProfileId: payload.enhancementProfileId ? Number(payload.enhancementProfileId) : null,
        incubationDesc: text(payload.incubationDesc, 1024) || null,
        status: text(payload.status || "draft", 16) || "draft",
        languagePolicy: payload.languagePolicy || defaults.languagePolicy,
        autoResearchPolicy: payload.autoResearchPolicy || defaults.autoResearchPolicy,
        modelCommittee: payload.modelCommittee || defaults.modelCommittee,
        scenarioPool: payload.scenarioPool || defaults.scenarioPool,
        scenarioCoverage: payload.scenarioCoverage || defaults.scenarioCoverage,
        evidenceCatalog: payload.evidenceCatalog || defaults.evidenceCatalog,
        standardAssets: payload.standardAssets || defaults.standardAssets,
        publicDataProfiles: payload.publicDataProfiles || {},
        trainingSettings: normalizeTrainingSettings(payload.trainingSettings),
        evaluationRubric: payload.evaluationRubric || {},
        overridePolicies: payload.overridePolicies || {}
      };
      if (!normalized.incubationName) throw new AppError("incubationName is required", 400);
      if (normalized.id) {
        const scoped = getScopedWhere("");
        await pool.query(
          `UPDATE lab_industry_incubation SET incubation_name = ?, incubation_code = ?, industry_code = ?, enhancement_profile_id = ?, incubation_desc = ?, status = ?, language_policy_json = ?, auto_research_policy_json = ?, model_committee_json = ?, scenario_pool_json = ?, scenario_coverage_json = ?, evidence_catalog_json = ?, standard_assets_json = ?, public_data_profiles_json = ?, training_settings_json = ?, evaluation_rubric_json = ?, override_policies_json = ? WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
          [normalized.incubationName, normalized.incubationCode, normalized.industryCode, normalized.enhancementProfileId, normalized.incubationDesc, normalized.status, JSON.stringify(normalized.languagePolicy), JSON.stringify(normalized.autoResearchPolicy), JSON.stringify(normalized.modelCommittee), JSON.stringify(normalized.scenarioPool), JSON.stringify(normalized.scenarioCoverage), JSON.stringify(normalized.evidenceCatalog), JSON.stringify(normalized.standardAssets), JSON.stringify(normalized.publicDataProfiles), JSON.stringify(normalized.trainingSettings), JSON.stringify(normalized.evaluationRubric), JSON.stringify(normalized.overridePolicies), normalized.id, ...scoped.params]
        );
        return getIndustryIncubationDetail(normalized.id);
      }
      const [result] = await pool.query(
        "INSERT INTO lab_industry_incubation (project_id, incubation_name, incubation_code, industry_code, enhancement_profile_id, incubation_desc, status, language_policy_json, auto_research_policy_json, model_committee_json, scenario_pool_json, scenario_coverage_json, evidence_catalog_json, standard_assets_json, public_data_profiles_json, training_settings_json, evaluation_rubric_json, override_policies_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [projectId, normalized.incubationName, normalized.incubationCode, normalized.industryCode, normalized.enhancementProfileId, normalized.incubationDesc, normalized.status, JSON.stringify(normalized.languagePolicy), JSON.stringify(normalized.autoResearchPolicy), JSON.stringify(normalized.modelCommittee), JSON.stringify(normalized.scenarioPool), JSON.stringify(normalized.scenarioCoverage), JSON.stringify(normalized.evidenceCatalog), JSON.stringify(normalized.standardAssets), JSON.stringify(normalized.publicDataProfiles), JSON.stringify(normalized.trainingSettings), JSON.stringify(normalized.evaluationRubric), JSON.stringify(normalized.overridePolicies), user?.displayName || user?.username || "system"]
      );
      return getIndustryIncubationDetail(result.insertId);
    }
    async function deleteKnowledgeBasesByTags(requiredTags = []) {
      const tags = uniq(requiredTags, 16);
      if (!tags.length) return [];
      const [rows] = await pool.query("SELECT id, tags_json AS tagsJson FROM system_knowledge_base ORDER BY id ASC");
      const matchedIds = rows.filter((row) => {
        const rowTags = safeJson(row.tagsJson, []);
        return tags.every((tag) => Array.isArray(rowTags) && rowTags.includes(tag));
      }).map((row) => Number(row.id)).filter(Boolean);
      if (!matchedIds.length) return [];
      const agentPlatformService = require_system_knowledge_base_service();
      for (const id of matchedIds) await agentPlatformService.deleteKnowledgeBase(id);
      return matchedIds;
    }
    async function deleteIndustryIncubation(id) {
      await getBase(id);
      await deleteKnowledgeBasesByTags([`incubation:${Number(id)}`]);
      const scoped = getScopedWhere("");
      await pool.query(`DELETE FROM lab_industry_incubation WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`, [Number(id), ...scoped.params]);
      return { id: Number(id) };
    }
    function buildPromptDefaults() {
      return {
        systemPrompt: [
          "You are an industry incubation metadata extractor for Chinese domestic business domains.",
          "Return one valid JSON object only.",
          "Industry mode: create exactly one new category and do not duplicate existing category code or name.",
          "Category mode: deepen only the selected category and add at least one new business table together with more dictionaries or dictionary items.",
          "Prefer Chinese business semantics in labels and comments, but keep identifiers in snake_case.",
          "Do not use markdown."
        ].join(" "),
        userPrompt: "{{input}}",
        temperature: 0.2,
        maxTokens: 4e3
      };
    }
    function buildCategoryEnhancePromptDefaults() {
      return {
        systemPrompt: [
          "You are a metadata extractor for deepening one Chinese domestic industry category.",
          "Return one valid JSON object only.",
          "You must focus only on the selected target category.",
          "Compared with the existing target category content, this run must add at least one NEW business table.",
          "You should also add more dictionary tables, dictionary items, and evidence references where appropriate.",
          "Do not rewrite the old category without increments.",
          "Do not use markdown."
        ].join(" "),
        userPrompt: "{{input}}",
        temperature: 0.2,
        maxTokens: 4e3
      };
    }
    function stringifyReferenceList(values = [], emptyText = "\u672A\u914D\u7F6E") {
      const items = uniq(values, 12);
      return items.length > 0 ? items.join("\u3001") : emptyText;
    }
    function buildEvidenceReferenceText(detail, options = {}) {
      const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const targetCategory = existingCategories.find((item) => options.targetCategoryCode && String(item?.categoryCode || "").trim() === String(options.targetCategoryCode).trim() || options.targetCategoryName && String(item?.categoryName || "").trim() === String(options.targetCategoryName).trim()) || null;
      const sourceTypes = uniq(Array.isArray(detail?.autoResearchPolicy?.sourceTypes) ? detail.autoResearchPolicy.sourceTypes : [], 12);
      const preferredDomains = uniq([
        ...Array.isArray(detail?.autoResearchPolicy?.preferredDomains) ? detail.autoResearchPolicy.preferredDomains : [],
        ...Array.isArray(detail?.languagePolicy?.sourceDomainWhitelist) ? detail.languagePolicy.sourceDomainWhitelist : []
      ], 12);
      const requiredKeywords = uniq(detail?.autoResearchPolicy?.requiredKeywords || [], 12);
      const referenceLines = [
        "\u4EE5\u4E0B\u5185\u5BB9\u4EC5\u4F5C\u4E3A\u8BC1\u636E\u6765\u6E90\u53C2\u8003\u4E0E\u68C0\u7D22\u63D0\u793A\uFF0C\u7528\u4E8E\u5E2E\u52A9\u7406\u89E3\u672C\u6B21\u884C\u4E1A\u5B75\u5316\u4EFB\u52A1\u7684\u4E1A\u52A1\u80CC\u666F\u3001\u4F18\u5148\u5173\u6CE8\u65B9\u5411\u548C\u5019\u9009\u8D44\u6599\u8303\u56F4\uFF0C\u4E0D\u5C5E\u4E8E\u7A0B\u5E8F\u786C\u6027\u8FC7\u6EE4\u6761\u4EF6\uFF0C\u4E5F\u4E0D\u8981\u6C42\u8BC1\u636E\u91C7\u96C6\u5FC5\u987B\u5B8C\u5168\u547D\u4E2D\u8FD9\u4E9B\u6761\u4EF6\u3002",
        `\u884C\u4E1A\u540D\u79F0\uFF1A${detail?.incubationName || "-"}\u3002`,
        `\u884C\u4E1A\u7F16\u7801\uFF1A${detail?.industryCode || "-"}\u3002`,
        `\u884C\u4E1A\u8BF4\u660E\uFF1A${text(detail?.incubationDesc || "", 240) || "\u672A\u586B\u5199"}\u3002`
      ];
      if (targetCategory) {
        referenceLines.push(`\u5F53\u524D\u76EE\u6807\u5B50\u7C7B\u76EE\uFF1A${targetCategory.categoryName || targetCategory.categoryCode || "-"}\u3002`);
      }
      referenceLines.push(
        `\u201C\u4EC5\u6293\u53D6\u56FD\u5185\u8BC1\u636E\u201D\u914D\u7F6E\u5F53\u524D\u4E3A\uFF1A${detail?.languagePolicy?.domesticOnly !== false && detail?.autoResearchPolicy?.domesticOnly !== false ? "\u5F00\u542F" : "\u5173\u95ED"}\uFF0C\u8FD9\u91CC\u53EA\u8868\u793A\u8BC1\u636E\u503E\u5411\uFF0C\u4E0D\u6784\u6210\u7A0B\u5E8F\u5FC5\u987B\u9075\u5B88\u7684\u7B5B\u9009\u95E8\u69DB\u3002`,
        `\u201C\u4F18\u5148\u6807\u51C6\u4E0E\u6CD5\u89C4\u201D\u914D\u7F6E\u5F53\u524D\u4E3A\uFF1A${detail?.autoResearchPolicy?.standardFirst !== false ? "\u5F00\u542F" : "\u5173\u95ED"}\uFF0C\u8FD9\u91CC\u53EA\u8868\u793A\u8BC1\u636E\u4F18\u5148\u7EA7\u53C2\u8003\uFF0C\u4E0D\u6784\u6210\u7A0B\u5E8F\u5FC5\u987B\u9075\u5B88\u7684\u7B5B\u9009\u95E8\u69DB\u3002`,
        `\u53EF\u53C2\u8003\u7684\u8BC1\u636E\u6765\u6E90\u7C7B\u578B\uFF1A${stringifyReferenceList(sourceTypes)}\u3002`,
        `\u53EF\u4F18\u5148\u5173\u6CE8\u7684\u6765\u6E90\u57DF\u540D\uFF1A${stringifyReferenceList(preferredDomains)}\u3002`,
        `\u68C0\u7D22\u65F6\u53EF\u7ED3\u5408\u7684\u4E1A\u52A1\u5173\u952E\u8BCD\uFF1A${stringifyReferenceList(requiredKeywords)}\u3002`,
        "\u5982\u5916\u90E8\u516C\u5F00\u8D44\u6599\u4E0D\u8DB3\uFF0C\u53EF\u4EE5\u7ED3\u5408\u73B0\u6709\u7C7B\u76EE\u3001\u8868\u7ED3\u6784\u3001\u5B57\u5178\u4FE1\u606F\u548C\u884C\u4E1A\u5E38\u8BC6\u505A\u5408\u7406\u8865\u5168\uFF0C\u4F46\u8F93\u51FA\u5185\u5BB9\u4ECD\u9700\u4FDD\u6301\u4E2D\u56FD\u4E1A\u52A1\u8BED\u5883\u3001\u8BED\u4E49\u5B8C\u6574\u3001\u7ED3\u6784\u7A33\u5B9A\u3001\u5B57\u6BB5\u547D\u540D\u6E05\u6670\u3002"
      );
      return referenceLines.join("");
    }
    function buildEffectiveResearchConfig(detail, options = {}) {
      const mode = options.mode === "category" ? "category" : "industry";
      const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const targetCategory = existingCategories.find((item) => options.targetCategoryCode && String(item?.categoryCode || "").trim() === String(options.targetCategoryCode).trim() || options.targetCategoryName && String(item?.categoryName || "").trim() === String(options.targetCategoryName).trim()) || null;
      const existingDictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : [];
      const targetCategoryDictionaryItems = targetCategory ? existingDictionaries.filter((item) => String(item?.categoryCode || "").trim() === String(targetCategory.categoryCode || "").trim()) : [];
      const gapProfile = targetCategory ? buildGenericGapProfile(targetCategory, targetCategoryDictionaryItems) : null;
      const configuredRequiredKeywords = uniq(detail?.autoResearchPolicy?.requiredKeywords || [], 12);
      const preferredDomains = uniq([
        ...Array.isArray(detail?.autoResearchPolicy?.preferredDomains) ? detail.autoResearchPolicy.preferredDomains : [],
        ...Array.isArray(detail?.languagePolicy?.sourceDomainWhitelist) ? detail.languagePolicy.sourceDomainWhitelist : []
      ], 12);
      const requiredKeywords = uniq([
        detail?.incubationName,
        detail?.incubationDesc,
        detail?.industryCode,
        targetCategory?.categoryName,
        targetCategory?.description,
        ...configuredRequiredKeywords
      ], 16);
      return {
        mode,
        targetCategory,
        gapProfile,
        configuredRequiredKeywords,
        evidenceReferenceText: buildEvidenceReferenceText(detail, options),
        effectivePolicy: {
          domesticOnly: detail?.languagePolicy?.domesticOnly !== false && detail?.autoResearchPolicy?.domesticOnly !== false,
          standardFirst: detail?.autoResearchPolicy?.standardFirst !== false,
          sourceTypes: uniq(Array.isArray(detail?.autoResearchPolicy?.sourceTypes) ? detail.autoResearchPolicy.sourceTypes : [], 12),
          preferredDomains,
          requiredKeywords,
          limit: mode === "category" ? 8 : 12
        }
      };
    }
    function buildIndustryPromptText(promptInput) {
      const evidenceItems = Array.isArray(promptInput?.evidenceItems) ? promptInput.evidenceItems : [];
      const compactPromptInput = {
        mode: promptInput?.mode || "industry",
        incubationName: promptInput?.incubationName || "",
        incubationDesc: promptInput?.incubationDesc || "",
        industryCode: promptInput?.industryCode || "",
        targetCategoryCode: promptInput?.targetCategoryCode || null,
        targetCategoryName: promptInput?.targetCategoryName || null,
        policyConfig: promptInput?.policyConfig || {},
        evidenceReferenceText: promptInput?.evidenceReferenceText || "",
        targetCategory: promptInput?.targetCategory ? {
          categoryCode: promptInput.targetCategory.categoryCode || null,
          categoryName: promptInput.targetCategory.categoryName || null,
          description: text(promptInput.targetCategory.description || "", 160),
          tableDetails: (Array.isArray(promptInput.targetCategory.tableDetails) ? promptInput.targetCategory.tableDetails : []).slice(0, 6).map((item) => ({
            tableName: item?.tableName || "",
            tableLabel: item?.tableLabel || "",
            tableComment: text(item?.tableComment || "", 160),
            fields: Array.isArray(item?.fields) ? item.fields.slice(0, 16) : [],
            keyInfoItems: Array.isArray(item?.keyInfoItems) ? item.keyInfoItems.slice(0, 8) : []
          }))
        } : null,
        existingCategories: (Array.isArray(promptInput?.existingCategories) ? promptInput.existingCategories : []).slice(0, 8),
        existingDictionaryItems: (Array.isArray(promptInput?.existingDictionaryItems) ? promptInput.existingDictionaryItems : []).slice(0, 8),
        gapProfile: promptInput?.gapProfile || null,
        evidenceItems: evidenceItems.slice(0, 8).map((item) => ({
          id: item?.id || null,
          title: text(item?.title || "", 120),
          authority: text(item?.authority || "", 80),
          sourceUrl: item?.sourceUrl || "",
          sourceType: item?.sourceType || null,
          publishedAt: item?.publishedAt || null,
          summary: text(item?.summary || "", 120)
        }))
      };
      const lines = [
        promptInput?.mode === "category" ? "\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u5B50\u7C7B\u76EE\u589E\u91CF\u6DF1\u6316\u914D\u7F6E\u4E0E\u8BC1\u636E\u505A\u62BD\u53D6\uFF0C\u5E76\u4E25\u683C\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u8F93\u51FA\u3002" : "\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u884C\u4E1A\u5B75\u5316\u914D\u7F6E\u4E0E\u8BC1\u636E\u505A\u5168\u91CF\u62BD\u53D6\uFF0C\u5E76\u4E25\u683C\u6309\u7CFB\u7EDF\u63D0\u793A\u8BCD\u8F93\u51FA\u3002",
        "",
        "\u4E00\u3001\u4EFB\u52A1\u4E0A\u4E0B\u6587",
        JSON.stringify({
          mode: promptInput?.mode || "industry",
          incubationName: promptInput?.incubationName || "",
          incubationDesc: promptInput?.incubationDesc || "",
          industryCode: promptInput?.industryCode || "",
          targetCategoryCode: promptInput?.targetCategoryCode || null,
          targetCategoryName: promptInput?.targetCategoryName || null
        }, null, 2),
        "",
        "\u4E8C\u3001\u8BC1\u636E\u6765\u6E90\u53C2\u8003",
        promptInput?.evidenceReferenceText || "\u672A\u63D0\u4F9B\u989D\u5916\u8BC1\u636E\u6765\u6E90\u53C2\u8003\u3002"
      ];
      if (promptInput?.targetCategory) {
        lines.push("", "\u4E09\u3001\u76EE\u6807\u5B50\u7C7B\u76EE\u73B0\u72B6", JSON.stringify(promptInput.targetCategory, null, 2));
      }
      if (Array.isArray(promptInput?.existingCategories) && promptInput.existingCategories.length > 0) {
        lines.push("", "\u56DB\u3001\u5DF2\u6709\u7C7B\u76EE\u5FEB\u7167", JSON.stringify(promptInput.existingCategories, null, 2));
      }
      if (Array.isArray(promptInput?.existingDictionaryItems) && promptInput.existingDictionaryItems.length > 0) {
        lines.push("", "\u4E94\u3001\u5DF2\u6709\u5B57\u5178\u5FEB\u7167", JSON.stringify(promptInput.existingDictionaryItems, null, 2));
      }
      if (promptInput?.gapProfile) {
        lines.push("", "\u516D\u3001\u5DEE\u8DDD\u753B\u50CF", JSON.stringify(promptInput.gapProfile, null, 2));
      }
      lines.push(
        "",
        "\u4E03\u3001\u8BC1\u636E\u6E05\u5355",
        evidenceItems.length > 0 ? evidenceItems.map((item, index) => `${index + 1}. [${item.id || `evidence_${index + 1}`}] ${item.title || "-"} | \u673A\u6784: ${item.authority || "-"} | \u94FE\u63A5: ${item.sourceUrl || "-"} | \u6458\u8981: ${item.summary || "-"}`).join("\n") : "\u65E0",
        "",
        "\u516B\u3001\u7ED3\u6784\u5316\u8F93\u5165 JSON",
        JSON.stringify(compactPromptInput, null, 2)
      );
      return lines.join("\n");
    }
    function buildPromptInput(detail, evidenceItems, options = {}) {
      const {
        mode,
        targetCategory,
        gapProfile,
        configuredRequiredKeywords,
        effectivePolicy,
        evidenceReferenceText
      } = buildEffectiveResearchConfig(detail, options);
      const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const existingDictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : [];
      const targetCategoryDictionaryItems = targetCategory ? existingDictionaries.filter((item) => String(item?.categoryCode || "").trim() === String(targetCategory.categoryCode || "").trim()) : [];
      const buildCategoryPromptCategorySnapshot = (category = {}) => ({
        categoryCode: category.categoryCode || null,
        categoryName: category.categoryName || null,
        description: category.description || "",
        tableScopes: Array.isArray(category.tableScopes) ? category.tableScopes : []
      });
      const buildCategoryPromptTargetSnapshot = (category = {}) => ({
        ...buildCategoryPromptCategorySnapshot(category),
        tableDetails: (Array.isArray(category.tableDetails) ? category.tableDetails : []).map((item) => buildPromptTableSnapshot(item))
      });
      const buildIndustryPromptCategorySnapshot = (category = {}) => ({
        categoryCode: category.categoryCode || null,
        categoryName: category.categoryName || null,
        description: category.description || ""
      });
      const buildDictionaryGroupPromptSnapshot = (group = {}) => ({
        dictType: group.dictType || null,
        dictName: group.dictName || null,
        itemCount: Array.isArray(group.items) ? group.items.length : 0,
        sampleItems: (Array.isArray(group.items) ? group.items : []).slice(0, 5).map((item) => ({
          itemCode: item?.itemCode || null,
          itemLabel: item?.itemLabel || null,
          valueRange: item?.valueRange || null
        })),
        sourceRefs: Array.isArray(group.sourceRefs) ? group.sourceRefs : []
      });
      const scopedExistingCategories = mode === "category" ? [] : existingCategories.map((item) => buildIndustryPromptCategorySnapshot(item));
      const scopedExistingDictionaries = mode === "category" ? [] : [];
      const scopedExistingDictionaryItems = mode === "category" ? targetCategoryDictionaryItems.map((item) => buildDictionaryGroupPromptSnapshot(item)) : [];
      return {
        mode,
        incubationName: detail.incubationName,
        incubationDesc: detail.incubationDesc || "",
        industryCode: detail.industryCode,
        evidenceReferenceText,
        policyConfig: {
          languagePolicy: {
            locale: detail?.languagePolicy?.locale || "zh-CN",
            domesticOnly: detail?.languagePolicy?.domesticOnly !== false,
            requiredChineseLabels: detail?.languagePolicy?.requiredChineseLabels !== false,
            sourceDomainWhitelist: uniq(Array.isArray(detail?.languagePolicy?.sourceDomainWhitelist) ? detail.languagePolicy.sourceDomainWhitelist : [], 12)
          },
          autoResearchPolicy: {
            domesticOnly: detail?.autoResearchPolicy?.domesticOnly !== false,
            standardFirst: detail?.autoResearchPolicy?.standardFirst !== false,
            sourceTypes: effectivePolicy.sourceTypes,
            preferredDomains: effectivePolicy.preferredDomains,
            requiredKeywords: configuredRequiredKeywords
          },
          evidenceSourceReferenceText: evidenceReferenceText
        },
        targetCategoryCode: targetCategory?.categoryCode || options.targetCategoryCode || null,
        targetCategoryName: targetCategory?.categoryName || options.targetCategoryName || null,
        targetCategory: targetCategory ? buildCategoryPromptTargetSnapshot(targetCategory) : null,
        existingCategories: scopedExistingCategories.map((item) => ({
          categoryCode: item.categoryCode,
          categoryName: item.categoryName,
          description: item.description || "",
          ...mode === "category" ? {
            tableDetails: Array.isArray(item.tableDetails) ? item.tableDetails : [],
            evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : []
          } : {}
        })),
        existingDictionaries: scopedExistingDictionaries,
        existingDictionaryItems: scopedExistingDictionaryItems,
        gapProfile,
        evidenceItems: normalizeEvidenceItems(evidenceItems).map((item) => ({
          id: item.id,
          title: item.title,
          sourceUrl: item.sourceUrl,
          authority: item.authority,
          sourceType: item.sourceType || null,
          publishedAt: item.publishedAt || null,
          summary: item.summary
        }))
      };
    }
    async function resolvePromptConfig(promptInput, promptText) {
      const promptType = promptInput.mode === "category" ? "INDUSTRY_CATEGORY_ENHANCE" : "INDUSTRY_METADATA";
      const defaults = promptInput.mode === "category" ? buildCategoryEnhancePromptDefaults() : buildPromptDefaults();
      const promptConfig = await promptRuntime.resolveRuntimePromptConfig(promptType, defaults, {
        ...promptInput,
        input: promptText || promptInput,
        promptInput,
        promptText: promptText || ""
      });
      if (!promptConfig.provider) throw new AppError("industry metadata prompt is not bound to a provider", 400);
      return promptConfig;
    }
    async function collectEvidence(detail, options = {}) {
      const { mode, targetCategory, gapProfile, effectivePolicy } = buildEffectiveResearchConfig(detail, options);
      const evidenceItems = await internetResearch.collectDomesticEvidence({
        mode,
        industryCode: detail.industryCode,
        industryLabel: detail.incubationName || detail.industryCode,
        sceneName: targetCategory?.categoryName || detail.incubationName || detail.industryCode,
        subScenario: [detail.incubationDesc, targetCategory?.description].filter(Boolean).join(" / "),
        requiredKeywords: effectivePolicy.requiredKeywords,
        gapKeywords: gapProfile?.gapKeywords || [],
        plannedQueries: [],
        sourceTypes: effectivePolicy.sourceTypes,
        preferredDomains: [],
        limit: effectivePolicy.limit,
        domesticOnly: true
      });
      const normalized = normalizeEvidenceItems(evidenceItems);
      if (normalized.some((item) => !item.sourceUrl)) throw new AppError("evidence contains empty sourceUrl", 400);
      return normalized;
    }
    function normalizeGeneratedMetadata(parsed, detail, evidenceItems, options = {}) {
      const root = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
      const increments = root?.increments && typeof root.increments === "object" ? root.increments : {};
      const mode = options.mode === "category" ? "category" : "industry";
      const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const targetCategory = existingCategories.find((item) => options.targetCategoryCode && String(item?.categoryCode || "").trim() === String(options.targetCategoryCode).trim() || options.targetCategoryName && String(item?.categoryName || "").trim() === String(options.targetCategoryName).trim()) || null;
      const topLevelTableDetails = Array.isArray(root?.tableDetails) ? root.tableDetails : Array.isArray(root?.table_details) ? root.table_details : Array.isArray(root?.newTables) ? root.newTables : Array.isArray(root?.new_tables) ? root.new_tables : Array.isArray(root?.tableDetailsIncrement) ? root.tableDetailsIncrement : Array.isArray(root?.table_details_increment) ? root.table_details_increment : Array.isArray(root?.newTableDetails) ? root.newTableDetails : Array.isArray(root?.new_table_details) ? root.new_table_details : Array.isArray(increments?.newTables) ? increments.newTables : Array.isArray(increments?.new_tables) ? increments.new_tables : [];
      const topLevelCategory = root?.categoryCode || root?.category_code || root?.categoryName || root?.category_name || topLevelTableDetails.length > 0 ? {
        categoryCode: root?.categoryCode || root?.category_code || targetCategory?.categoryCode || options.targetCategoryCode,
        categoryName: root?.categoryName || root?.category_name || targetCategory?.categoryName || options.targetCategoryName,
        description: root?.description || root?.desc || targetCategory?.description || root?.summary || "",
        tableDetails: topLevelTableDetails,
        sourceRefs: root?.sourceRefs || root?.source_refs || [],
        evidenceRefs: root?.evidenceRefs || root?.evidence_refs || [],
        continueIteration: root?.continueIteration
      } : null;
      let categories = (Array.isArray(root?.categories) ? root.categories : topLevelCategory ? [topLevelCategory] : []).map((item) => normalizeCategory(item));
      const rawCandidateTableSpecs = Array.isArray(root?.candidateTableSpecs) ? root.candidateTableSpecs : Array.isArray(root?.candidate_table_specs) ? root.candidate_table_specs : topLevelTableDetails;
      const candidateTableSpecs = rawCandidateTableSpecs.map((item) => normalizeTable(item));
      if (mode === "industry") categories = categories.slice(0, 1);
      if (mode === "category") {
        const fallbackCategory = normalizeCategory({
          categoryCode: targetCategory?.categoryCode || options.targetCategoryCode,
          categoryName: targetCategory?.categoryName || options.targetCategoryName,
          description: targetCategory?.description || root?.summary || "",
          tableDetails: candidateTableSpecs
        }, targetCategory || {});
        categories = categories.length > 0 ? categories.slice(0, 1) : [fallbackCategory];
        categories = categories.map((item) => mergeCategory(item, {
          categoryCode: item.categoryCode,
          categoryName: item.categoryName,
          description: item.description,
          tableDetails: candidateTableSpecs,
          sourceRefs: item.sourceRefs || [],
          evidenceRefs: item.evidenceRefs || [],
          continueIteration: item.continueIteration
        }));
      }
      categories = categories.map((item) => {
        const categoryRefs = uniq([
          ...Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
          ...Array.isArray(item.sourceRefs) ? item.sourceRefs : [],
          ...evidenceItems.map((entry) => entry.id)
        ], 32);
        const normalizedTables = (Array.isArray(item.tableDetails) ? item.tableDetails : []).map((table) => {
          const normalizedTable = normalizeTable(table);
          return {
            ...normalizedTable,
            sourceRefs: pickNonEmptyRefs(normalizedTable.sourceRefs, categoryRefs)
          };
        });
        return {
          ...item,
          evidenceRefs: categoryRefs,
          sourceRefs: categoryRefs,
          tableDetails: normalizedTables,
          tableScopes: normalizedTables.map((table) => table.tableName)
        };
      });
      const rootDictionaries = Array.isArray(root?.dictionaries) ? root.dictionaries : [];
      const rootDictionaryIncrements = Array.isArray(root?.dictionaryIncrements) ? root.dictionaryIncrements : Array.isArray(root?.dictionary_increments) ? root.dictionary_increments : [];
      const rootNewDictionaries = Array.isArray(root?.newDictionaries) ? root.newDictionaries : Array.isArray(root?.new_dictionaries) ? root.new_dictionaries : [];
      const rootDictionaryItemIncrements = Array.isArray(root?.dictionaryItemIncrements) ? root.dictionaryItemIncrements : Array.isArray(root?.dictionary_item_increments) ? root.dictionary_item_increments : [];
      const incrementNewDictionaries = Array.isArray(increments?.newDictionaries) ? increments.newDictionaries : Array.isArray(increments?.new_dictionaries) ? increments.new_dictionaries : [];
      const incrementDictionaryIncrements = Array.isArray(increments?.dictionaryIncrements) ? increments.dictionaryIncrements : Array.isArray(increments?.dictionary_increments) ? increments.dictionary_increments : [];
      const incrementDictionaryItemIncrements = Array.isArray(increments?.dictionaryItemIncrements) ? increments.dictionaryItemIncrements : Array.isArray(increments?.dictionary_item_increments) ? increments.dictionary_item_increments : [];
      const incrementDictionaryItemAdditions = Array.isArray(increments?.dictionaryItemAdditions) ? increments.dictionaryItemAdditions : Array.isArray(increments?.dictionary_item_additions) ? increments.dictionary_item_additions : [];
      const dictionaries = mergeByKey(
        [...rootDictionaries, ...rootDictionaryIncrements, ...rootNewDictionaries, ...incrementNewDictionaries, ...incrementDictionaryIncrements].map((item, index) => normalizeDictionary(item, index)).map((item) => ({
          ...item,
          categoryCode: item.categoryCode || categories[0]?.categoryCode || null
        })),
        [...rootDictionaryItemIncrements, ...incrementDictionaryItemIncrements, ...incrementDictionaryItemAdditions].map((item, index) => normalizeDictionary(item, rootDictionaries.length + rootDictionaryIncrements.length + rootNewDictionaries.length + incrementNewDictionaries.length + incrementDictionaryIncrements.length + index)).map((item) => ({
          ...item,
          categoryCode: item.categoryCode || categories[0]?.categoryCode || null
        })),
        (item) => `${String(item?.categoryCode || "").trim()}::${String(item?.dictType || item?.dictName || "").trim()}`
      ).map((item) => ({
        ...item,
        items: Array.isArray(item?.items) ? item.items : []
      }));
      const extractionDiagnostics = summarizeExtractionDiagnostics(root, categories, dictionaries, candidateTableSpecs);
      return {
        summary: text(root?.summary || "industry metadata updated", 160),
        categories,
        dictionaries,
        candidateTableSpecs: candidateTableSpecs.length > 0 ? candidateTableSpecs : categories.flatMap((item) => item.tableDetails || []),
        extractionDiagnostics
      };
    }
    function validateIndustryResult(detail, generated) {
      if (!generated.categories.length) throw new AppError("industry mode did not create a category", 400);
      const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const existingCodes = new Set(existingCategories.map((item) => String(item?.categoryCode || "").trim()).filter(Boolean));
      const existingNames = new Set(existingCategories.map((item) => String(item?.categoryName || "").trim()).filter(Boolean));
      const category = generated.categories[0];
      if (existingCodes.has(String(category.categoryCode || "").trim()) || existingNames.has(String(category.categoryName || "").trim())) {
        throw new AppError("industry mode generated a duplicate category", 400);
      }
    }
    function validateCategoryIncrement(detail, mergedAssets, mergedEvidenceCatalog, targetCategoryCode) {
      const beforeCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const afterCategories = Array.isArray(mergedAssets?.researchCatalog?.categoryTree) ? mergedAssets.researchCatalog.categoryTree : [];
      const beforeCategory = beforeCategories.find((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim()) || {};
      const afterCategory = afterCategories.find((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim()) || {};
      const beforeTables = new Set((Array.isArray(beforeCategory?.tableDetails) ? beforeCategory.tableDetails : []).map((item) => String(item?.tableName || "").trim()).filter(Boolean));
      const afterTables = new Set((Array.isArray(afterCategory?.tableDetails) ? afterCategory.tableDetails : []).map((item) => String(item?.tableName || "").trim()).filter(Boolean));
      const beforeDictionaries = (Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : []).filter((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim());
      const afterDictionaries = (Array.isArray(mergedAssets?.dictionaries) ? mergedAssets.dictionaries : []).filter((item) => String(item?.categoryCode || "").trim() === String(targetCategoryCode || "").trim());
      const beforeDicts = new Set(beforeDictionaries.map((item) => String(item?.dictType || item?.dictName || "").trim()).filter(Boolean));
      const afterDicts = new Set(afterDictionaries.map((item) => String(item?.dictType || item?.dictName || "").trim()).filter(Boolean));
      const beforeItems = new Set(beforeDictionaries.flatMap((item) => (Array.isArray(item?.items) ? item.items : []).map((entry) => `${item.dictType}:${entry.itemCode || entry.itemLabel}`)));
      const afterItems = new Set(afterDictionaries.flatMap((item) => (Array.isArray(item?.items) ? item.items : []).map((entry) => `${item.dictType}:${entry.itemCode || entry.itemLabel}`)));
      const beforeEvidence = new Set((Array.isArray(detail?.evidenceCatalog?.items) ? detail.evidenceCatalog.items : []).map((item) => String(item?.id || item?.sourceHash || item?.sourceUrl || "").trim()).filter(Boolean));
      const afterEvidence = new Set((Array.isArray(mergedEvidenceCatalog?.items) ? mergedEvidenceCatalog.items : []).map((item) => String(item?.id || item?.sourceHash || item?.sourceUrl || "").trim()).filter(Boolean));
      const beforeTableNames = Array.from(beforeTables);
      const afterTableNames = Array.from(afterTables);
      const newTableNames = afterTableNames.filter((item) => !beforeTables.has(item));
      const incrementSummary = {
        beforeTableNames,
        afterTableNames,
        newTableNames,
        newTableCount: newTableNames.length,
        newDictionaryCount: Array.from(afterDicts).filter((item) => !beforeDicts.has(item)).length,
        newDictionaryItemCount: Array.from(afterItems).filter((item) => !beforeItems.has(item)).length,
        newEvidenceCount: Array.from(afterEvidence).filter((item) => !beforeEvidence.has(item)).length
      };
      if (incrementSummary.newTableCount < 1) {
        throw new AppError("category mode did not add a new table", 400, {
          targetCategoryCode: String(targetCategoryCode || "").trim() || null,
          beforeTableNames,
          afterTableNames,
          newTableNames,
          beforeDictionaryTypes: Array.from(beforeDicts),
          afterDictionaryTypes: Array.from(afterDicts)
        });
      }
      return incrementSummary;
    }
    async function syncKnowledgeBases(incubationId, mode, categoryCodes, targetCategoryCode, user) {
      const agentPlatformService = require_system_knowledge_base_service();
      if (mode === "category") {
        if (targetCategoryCode) await agentPlatformService.syncIncubationKnowledgeBase(incubationId, { categoryCode: targetCategoryCode }, user);
        return;
      }
      await agentPlatformService.syncIncubationKnowledgeBase(incubationId, {}, user);
      for (const categoryCode of categoryCodes) {
        await agentPlatformService.syncIncubationKnowledgeBase(incubationId, { categoryCode }, user);
      }
    }
    function mergeEvidenceCatalog(existingEvidence = {}, newEvidence = []) {
      const source = [...Array.isArray(existingEvidence?.items) ? existingEvidence.items : [], ...normalizeEvidenceItems(newEvidence)];
      const seen = /* @__PURE__ */ new Set();
      const items = [];
      source.forEach((item) => {
        const key = [item.sourceHash || "", item.sourceUrl || "", item.title || "", item.publishedAt || ""].join("|");
        if (!key.trim() || seen.has(key)) return;
        seen.add(key);
        items.push(item);
      });
      return { items };
    }
    async function ensureCanonicalCategoryOutput(provider, promptInput, rawText, parsedOutput, options = {}) {
      const initialCanonical = buildCanonicalCategoryOutput(parsedOutput, promptInput);
      const initialValidation = validateCanonicalCategoryOutput(initialCanonical, promptInput);
      if (initialValidation.valid) {
        return {
          canonicalOutput: initialCanonical,
          validation: initialValidation,
          repaired: false,
          repairRawText: null,
          repairParsedOutput: null
        };
      }
      const repairResponse = await repairCategoryOutputShape(provider, promptInput, rawText, options);
      const repairRawText = repairResponse.content;
      const repairParsedOutput = parseModelJson(repairRawText);
      const repairedCanonical = buildCanonicalCategoryOutput(repairParsedOutput, promptInput);
      const repairedValidation = validateCanonicalCategoryOutput(repairedCanonical, promptInput);
      if (!repairedValidation.valid) {
        throw new AppError("category output schema repair failed", 400, {
          initialValidation,
          repairedValidation,
          repairRawText,
          repairParsedOutput
        });
      }
      return {
        canonicalOutput: repairedCanonical,
        validation: repairedValidation,
        repaired: true,
        repairRawText,
        repairParsedOutput
      };
    }
    async function ensureCanonicalIndustryOutput(provider, promptInput, rawText, parsedOutput, options = {}) {
      const initialCanonical = buildCanonicalIndustryOutput(parsedOutput);
      const initialValidation = validateCanonicalIndustryOutput(initialCanonical);
      if (initialValidation.valid) {
        return {
          canonicalOutput: initialCanonical,
          validation: initialValidation,
          repaired: false,
          repairRawText: null,
          repairParsedOutput: null
        };
      }
      const repairResponse = await repairIndustryOutputShape(provider, promptInput, rawText, options);
      const repairRawText = repairResponse.content;
      const repairParsedOutput = parseModelJson(repairRawText);
      const repairedCanonical = buildCanonicalIndustryOutput(repairParsedOutput);
      const repairedValidation = validateCanonicalIndustryOutput(repairedCanonical);
      if (repairedValidation.valid) {
        return {
          canonicalOutput: repairedCanonical,
          validation: repairedValidation,
          repaired: true,
          repairRawText,
          repairParsedOutput
        };
      }
      const retryResponse = await repairIndustryOutputShape(provider, promptInput, rawText, {
        ...options,
        compactRetry: true,
        maxTokens: Math.max(Number(options.maxTokens || 0), 4e3)
      });
      const retryRawText = retryResponse.content;
      const retryParsedOutput = parseModelJson(retryRawText);
      const retryCanonical = buildCanonicalIndustryOutput(retryParsedOutput);
      const retryValidation = validateCanonicalIndustryOutput(retryCanonical);
      if (retryValidation.valid) {
        return {
          canonicalOutput: retryCanonical,
          validation: retryValidation,
          repaired: true,
          repairRawText: retryRawText,
          repairParsedOutput: retryParsedOutput
        };
      }
      const recoveryOutput = buildIndustryRecoveryOutput(promptInput, parsedOutput, rawText);
      const recoveryValidation = validateCanonicalIndustryOutput(recoveryOutput);
      if (!recoveryValidation.valid) {
        throw new AppError("industry output schema repair failed", 400, {
          initialValidation,
          repairedValidation,
          retryValidation,
          repairRawText,
          repairParsedOutput,
          retryRawText,
          retryParsedOutput,
          recoveryOutput
        });
      }
      return {
        canonicalOutput: recoveryOutput,
        validation: recoveryValidation,
        repaired: true,
        repairRawText: retryRawText || repairRawText,
        repairParsedOutput: retryParsedOutput || repairParsedOutput
      };
    }
    async function refreshIndustryMetadata(incubationId, user, options = {}) {
      const detail = await getIndustryIncubationDetail(incubationId);
      const normalizedOptions = {
        ...options,
        targetCategoryCode: options.targetCategoryCode || options.categoryCode || null,
        targetCategoryName: options.targetCategoryName || options.categoryName || null
      };
      const mode = options.mode === "category" ? "category" : "industry";
      const roundNo = Number(normalizedOptions.roundNo || detail.latestRoundNo || 0) + 1;
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      let modelResponseMeta = null;
      let modelRawText = null;
      let parsedModelOutput = null;
      let canonicalCategoryOutput = null;
      let schemaValidation = null;
      let generatedModelOutput = null;
      await appendLog(incubationId, { roundNo, logType: "run", stepKey: "refresh_start", message: "refresh_start", detail: { mode, purpose: normalizedOptions.purpose || null } });
      try {
        const evidenceItems = await collectEvidence(detail, normalizedOptions);
        await appendLog(incubationId, { roundNo, logType: "research", stepKey: "evidence_collected", message: "evidence_collected", responsePayload: { evidenceItems: evidenceItems.map((item) => ({ id: item.id, title: item.title, sourceUrl: item.sourceUrl })) } });
        const promptInput = buildPromptInput(detail, evidenceItems, normalizedOptions);
        const assembledPromptText = buildIndustryPromptText(promptInput);
        const promptConfig = await resolvePromptConfig(promptInput, assembledPromptText);
        const effectiveMaxTokens = Math.max(Number(promptConfig.maxTokens || 0), 4e3);
        const systemPrompt = promptConfig.systemPrompt || "";
        const userPrompt = promptConfig.userPrompt || assembledPromptText || JSON.stringify(promptInput, null, 2);
        await appendLog(incubationId, {
          roundNo,
          logType: "model",
          stepKey: "industry_metadata_model_request",
          message: `industry_metadata_model_request:${promptConfig.provider.modelName || promptConfig.provider.configName || "chat_model"}`,
          requestPayload: {
            promptType: mode === "category" ? "INDUSTRY_CATEGORY_ENHANCE" : "INDUSTRY_METADATA",
            provider: { id: Number(promptConfig.provider.id), configName: promptConfig.provider.configName, modelName: promptConfig.provider.modelName },
            temperature: promptConfig.temperature,
            maxTokens: effectiveMaxTokens,
            strictParameters: true,
            timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 6e5),
            mode,
            promptInput,
            assembledPromptText,
            systemPrompt,
            userPrompt
          }
        });
        const response = await strictGenerateChatCompletion(
          promptConfig.provider,
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          { temperature: promptConfig.temperature, maxTokens: effectiveMaxTokens, timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 6e5) }
        );
        modelResponseMeta = {
          checkedEndpoint: response.raw?.checkedEndpoint || null,
          adapted: Boolean(response.raw?.adapted),
          finishReason: response.raw?.finishReason || null,
          usage: response.raw?.usage || null
        };
        modelRawText = response.content;
        parsedModelOutput = parseModelJson(response.content);
        await appendLog(incubationId, {
          roundNo,
          logType: "model",
          stepKey: "industry_metadata_model_output",
          message: "industry_metadata_model_output",
          responsePayload: {
            ...modelResponseMeta,
            rawText: modelRawText,
            parsedOutput: parsedModelOutput
          }
        });
        let normalizedSource = parsedModelOutput;
        if (mode === "category" || mode === "industry") {
          const canonicalResult = mode === "category" ? await ensureCanonicalCategoryOutput(
            promptConfig.provider,
            promptInput,
            modelRawText,
            parsedModelOutput,
            { maxTokens: effectiveMaxTokens, timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 6e5) }
          ) : await ensureCanonicalIndustryOutput(
            promptConfig.provider,
            promptInput,
            modelRawText,
            parsedModelOutput,
            { maxTokens: effectiveMaxTokens, timeoutMs: Number(promptConfig.provider?.extraConfig?.timeoutMs || 6e5) }
          );
          canonicalCategoryOutput = canonicalResult.canonicalOutput;
          schemaValidation = canonicalResult.validation;
          await appendLog(incubationId, {
            roundNo,
            logType: "model",
            stepKey: "industry_metadata_model_schema_validation",
            message: "industry_metadata_model_schema_validation",
            detail: {
              mode,
              repaired: canonicalResult.repaired,
              validation: canonicalResult.validation
            },
            responsePayload: canonicalResult.repaired ? {
              canonicalOutput: canonicalResult.canonicalOutput,
              repairRawText: canonicalResult.repairRawText,
              repairParsedOutput: canonicalResult.repairParsedOutput
            } : {
              canonicalOutput: canonicalResult.canonicalOutput
            }
          });
          normalizedSource = canonicalResult.canonicalOutput;
        }
        const generated = normalizeGeneratedMetadata(normalizedSource, detail, evidenceItems, normalizedOptions);
        generatedModelOutput = generated;
        if (mode === "industry") validateIndustryResult(detail, generated);
        const existingCategories = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree.map((item) => normalizeCategory(item)) : [];
        const existingDictionaries = Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries.map((item, index) => normalizeDictionary(item, index)) : [];
        const mergedCategories = mode === "industry" ? mergeByKey(existingCategories, generated.categories, (item) => String(item?.categoryCode || item?.categoryName || "").trim()) : mergeByKey(existingCategories, generated.categories.map((item) => {
          const existing = existingCategories.find((entry) => String(entry?.categoryCode || "").trim() === String(item?.categoryCode || "").trim()) || existingCategories.find((entry) => String(entry?.categoryName || "").trim() === String(item?.categoryName || "").trim()) || {};
          return mergeCategory(existing, item);
        }), (item) => String(item?.categoryCode || item?.categoryName || "").trim());
        const mergedDictionaries = mergeByKey(existingDictionaries, generated.dictionaries.map((item) => {
          const existing = existingDictionaries.find((entry) => String(entry?.categoryCode || "").trim() === String(item?.categoryCode || "").trim() && String(entry?.dictType || entry?.dictName || "").trim() === String(item?.dictType || item?.dictName || "").trim()) || {};
          return mergeDictionary(existing, item);
        }), (item) => `${String(item?.categoryCode || "").trim()}::${String(item?.dictType || item?.dictName || "").trim()}`);
        const mergedEvidenceCatalog = mergeEvidenceCatalog(detail.evidenceCatalog || {}, evidenceItems);
        const mergedCategoriesWithRefs = backfillCategoryEvidenceRefs(
          mergedCategories,
          (mergedEvidenceCatalog.items || []).map((item) => item?.id)
        );
        const mergedAssets = {
          ...detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets,
          researchCatalog: {
            ...detail.standardAssets?.researchCatalog && typeof detail.standardAssets.researchCatalog === "object" ? detail.standardAssets.researchCatalog : defaultConfig().standardAssets.researchCatalog,
            summary: generated.summary,
            categoryTree: mergedCategoriesWithRefs,
            candidateTableSpecs: mergeByKey(
              Array.isArray(detail?.standardAssets?.researchCatalog?.candidateTableSpecs) ? detail.standardAssets.researchCatalog.candidateTableSpecs.map((item) => normalizeTable(item)) : [],
              [
                ...generated.candidateTableSpecs || [],
                ...mergedCategoriesWithRefs.flatMap((item) => item.tableDetails || [])
              ],
              (item) => String(item?.tableName || "").trim()
            )
          },
          dictionaries: mergedDictionaries
        };
        const targetCategoryCode = String(generated.categories?.[0]?.categoryCode || normalizedOptions.targetCategoryCode || "").trim() || null;
        const incrementSummary = mode === "category" ? validateCategoryIncrement(detail, mergedAssets, mergedEvidenceCatalog, targetCategoryCode) : null;
        const nextTrainingSettings = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, totalRounds: Math.max(Number(detail.trainingSettings?.runState?.totalRounds || 0), roundNo), taskCurrentRoundNo: roundNo } });
        await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ?, evidence_catalog_json = ?, training_settings_json = ?, latest_round_no = ?, last_synced_at = NOW() WHERE id = ?", [JSON.stringify(mergedAssets), JSON.stringify(mergedEvidenceCatalog), JSON.stringify(nextTrainingSettings), roundNo, Number(incubationId)]);
        await pool.query("INSERT INTO lab_industry_incubation_round (incubation_id, round_no, round_name, round_status, selected_scenarios_json, evidence_snapshot_json, committee_snapshot_json, result_summary_json, enhancement_delta_json, started_at, ended_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE round_name = VALUES(round_name), round_status = VALUES(round_status), result_summary_json = VALUES(result_summary_json), enhancement_delta_json = VALUES(enhancement_delta_json), started_at = VALUES(started_at), ended_at = VALUES(ended_at), updated_at = NOW()", [Number(incubationId), roundNo, `round_${roundNo}`, "completed", JSON.stringify([]), JSON.stringify(mergedEvidenceCatalog.items || []), JSON.stringify({ mode, strictParameters: true }), JSON.stringify({ summary: generated.summary, categoryCount: generated.categories.length, tableCount: generated.candidateTableSpecs.length, dictionaryCount: generated.dictionaries.length }), JSON.stringify({ mode, categoryCodes: generated.categories.map((item) => item.categoryCode), incrementSummary }), new Date(startedAt), /* @__PURE__ */ new Date(), user?.displayName || user?.username || "system"]);
        await appendLog(incubationId, {
          roundNo,
          logType: "model",
          stepKey: "industry_metadata_model_response",
          message: "industry_metadata_model_response",
          responsePayload: {
            ...modelResponseMeta || {},
            rawText: modelRawText,
            parsedOutput: parsedModelOutput,
            canonicalCategoryOutput,
            schemaValidation,
            generated,
            extractionDiagnostics: generated?.extractionDiagnostics || null
          }
        });
        await appendLog(incubationId, { roundNo, logType: "metadata", stepKey: "metadata_merged", message: "metadata_merged", detail: { categoryCount: generated.categories.length, candidateTableCount: generated.candidateTableSpecs.length, dictionaryCount: generated.dictionaries.length, evidenceCount: mergedEvidenceCatalog.items.length, incrementSummary, extractionDiagnostics: generated?.extractionDiagnostics || null } });
        await syncKnowledgeBases(Number(incubationId), mode, generated.categories.map((item) => item.categoryCode), targetCategoryCode, user);
        return getIndustryIncubationDetail(incubationId);
      } catch (error) {
        await appendLog(incubationId, {
          roundNo,
          logLevel: "error",
          logType: "model",
          stepKey: "industry_metadata_model_error",
          message: error.message || "industry_metadata_model_error",
          detail: {
            errorMessage: error.message || null,
            attemptedEndpoint: error?.details?.attemptedEndpoint || modelResponseMeta?.checkedEndpoint || null,
            rawText: modelRawText,
            parsedOutput: parsedModelOutput,
            canonicalCategoryOutput,
            schemaValidation,
            generatedOutput: generatedModelOutput,
            extractionDiagnostics: generatedModelOutput?.extractionDiagnostics || summarizeExtractionDiagnostics(parsedModelOutput || {}, [], [], []),
            errorDetails: error?.details || null
          }
        });
        if (options?.suppressThrow) return { __failed: true, errorMessage: error.message || "industry_metadata_model_error", details: error?.details || null };
        throw error;
      }
    }
    async function runIncubationJob(incubationId, user, options = {}) {
      try {
        const roundCount = clampInt(options.roundCount, 1, 12, 1);
        let executedRounds = 0;
        for (let index = 0; index < roundCount; index += 1) {
          const job = jobs.get(Number(incubationId));
          if (job?.stopRequested) break;
          const result = await refreshIndustryMetadata(incubationId, user, { ...options, mode: options.categoryCode || options.categoryName ? "category" : "industry", suppressThrow: true, purpose: "async_run" });
          if (result && result.__failed) {
            const detail2 = await getIndustryIncubationDetail(incubationId).catch(() => null);
            if (detail2) {
              const failedTraining = normalizeTrainingSettings({ ...detail2.trainingSettings, runState: { ...detail2.trainingSettings.runState, status: "failed", stopRequested: false, endedAt: (/* @__PURE__ */ new Date()).toISOString(), lastError: result.errorMessage || "run_failed", taskCurrentRoundNo: executedRounds } });
              await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(failedTraining), Number(incubationId)]);
            }
            await appendLog(incubationId, { logLevel: "error", logType: "run", stepKey: "job_failed", message: result.errorMessage || "job_failed" });
            return { ok: false, errorMessage: result.errorMessage || "job_failed" };
          }
          executedRounds += 1;
        }
        const detail = await getIndustryIncubationDetail(incubationId);
        const nextStatus = jobs.get(Number(incubationId))?.stopRequested ? "stopped" : "completed";
        const nextTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: nextStatus, stopRequested: false, endedAt: (/* @__PURE__ */ new Date()).toISOString(), lastError: null, taskCurrentRoundNo: executedRounds, totalRounds: Math.max(Number(detail.trainingSettings?.runState?.totalRounds || 0), executedRounds) } });
        await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
        await appendLog(incubationId, { logType: "run", stepKey: "job_end", message: `job_end:${nextStatus}` });
        return { ok: true };
      } catch (error) {
        const detail = await getIndustryIncubationDetail(incubationId).catch(() => null);
        if (detail) {
          const failedTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...detail.trainingSettings.runState, status: "failed", stopRequested: false, endedAt: (/* @__PURE__ */ new Date()).toISOString(), lastError: error.message || "run_failed" } });
          await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(failedTraining), Number(incubationId)]);
        }
        await appendLog(incubationId, { logLevel: "error", logType: "run", stepKey: "job_failed", message: error.message || "job_failed", detail: { stack: error.stack || null } });
        return { ok: false, errorMessage: error.message || "job_failed" };
      } finally {
        jobs.delete(Number(incubationId));
      }
    }
    async function startIndustryIncubationRun(incubationId, payload, user) {
      const detail = await getIndustryIncubationDetail(incubationId);
      const runState = normalizeTrainingSettings(detail.trainingSettings).runState;
      const roundCount = clampInt(payload?.roundCount || detail.trainingSettings?.targetRoundCount, 1, 12, 1);
      if ((runState.status === "running" || runState.status === "stopping") && jobs.has(Number(incubationId))) {
        throw new AppError("run already active", 400);
      }
      const nextTraining = normalizeTrainingSettings({ ...detail.trainingSettings, targetRoundCount: roundCount, runState: { ...runState, status: "running", mode: payload?.categoryCode || payload?.categoryName ? "category" : "industry", stopRequested: false, startedAt: (/* @__PURE__ */ new Date()).toISOString(), endedAt: null, lastError: null, totalRounds: roundCount, taskCurrentRoundNo: 0, targetCategoryCode: payload?.categoryCode || null, targetCategoryName: payload?.categoryName || null } });
      await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
      await appendLog(incubationId, { logType: "run", stepKey: "start_requested", message: "start_requested", requestPayload: { ...payload || {}, roundCount } });
      const job = { stopRequested: false };
      jobs.set(Number(incubationId), job);
      job.promise = runIncubationJob(Number(incubationId), user, { ...payload || {}, roundCount });
      return getIndustryIncubationDetail(incubationId);
    }
    async function stopIndustryIncubationRun(incubationId) {
      const detail = await getIndustryIncubationDetail(incubationId);
      const runState = normalizeTrainingSettings(detail.trainingSettings).runState;
      const job = jobs.get(Number(incubationId));
      if (job) job.stopRequested = true;
      const nextTraining = normalizeTrainingSettings({ ...detail.trainingSettings, runState: { ...runState, status: job ? "stopping" : "stopped", stopRequested: Boolean(job), endedAt: job ? runState.endedAt || null : (/* @__PURE__ */ new Date()).toISOString() } });
      await pool.query("UPDATE lab_industry_incubation SET training_settings_json = ? WHERE id = ?", [JSON.stringify(nextTraining), Number(incubationId)]);
      await appendLog(incubationId, { logType: "run", stepKey: "stop_requested", message: job ? "stop_requested" : "no_live_job" });
      return getIndustryIncubationDetail(incubationId);
    }
    async function updateIndustryCategoryIteration(incubationId, payload = {}) {
      const detail = await getIndustryIncubationDetail(incubationId);
      const assets = detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets;
      const categoryTree = Array.isArray(assets?.researchCatalog?.categoryTree) ? assets.researchCatalog.categoryTree : [];
      const nextCategoryTree = categoryTree.map((item) => {
        const hit = payload.categoryCode && String(item?.categoryCode || "") === String(payload.categoryCode || "") || payload.categoryName && String(item?.categoryName || "") === String(payload.categoryName || "");
        return hit ? { ...item, continueIteration: Boolean(payload.continueIteration) } : item;
      });
      const nextAssets = { ...assets, researchCatalog: { ...assets.researchCatalog || {}, categoryTree: nextCategoryTree } };
      await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ? WHERE id = ?", [JSON.stringify(nextAssets), Number(incubationId)]);
      return getIndustryIncubationDetail(incubationId);
    }
    async function deleteIndustryCategory(incubationId, payload = {}, user) {
      const detail = await getIndustryIncubationDetail(incubationId);
      const categoryTree = Array.isArray(detail?.standardAssets?.researchCatalog?.categoryTree) ? detail.standardAssets.researchCatalog.categoryTree : [];
      const target = categoryTree.find((item) => payload.categoryCode && String(item?.categoryCode || "").trim() === String(payload.categoryCode).trim() || payload.categoryName && String(item?.categoryName || "").trim() === String(payload.categoryName).trim());
      if (!target) throw new AppError("target category not found", 404);
      await deleteKnowledgeBasesByTags(["scope:industry_category", `incubation:${Number(incubationId)}`, `category:${String(target.categoryCode || "").trim()}`]);
      const targetTableNames = new Set((Array.isArray(target.tableDetails) ? target.tableDetails : []).map((item) => String(item?.tableName || "").trim()).filter(Boolean));
      const nextAssets = {
        ...detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets,
        researchCatalog: {
          ...detail.standardAssets?.researchCatalog && typeof detail.standardAssets.researchCatalog === "object" ? detail.standardAssets.researchCatalog : defaultConfig().standardAssets.researchCatalog,
          categoryTree: categoryTree.filter((item) => String(item?.categoryCode || "").trim() !== String(target.categoryCode || "").trim()),
          candidateTableSpecs: (Array.isArray(detail?.standardAssets?.researchCatalog?.candidateTableSpecs) ? detail.standardAssets.researchCatalog.candidateTableSpecs : []).filter((item) => !targetTableNames.has(String(item?.tableName || "").trim()))
        },
        dictionaries: (Array.isArray(detail?.standardAssets?.dictionaries) ? detail.standardAssets.dictionaries : []).filter((item) => String(item?.categoryCode || "").trim() !== String(target.categoryCode || "").trim())
      };
      await pool.query("UPDATE lab_industry_incubation SET standard_assets_json = ? WHERE id = ?", [JSON.stringify(nextAssets), Number(incubationId)]);
      await appendLog(incubationId, { logType: "run", stepKey: "category_deleted", message: `category_deleted:${target.categoryCode}` });
      await syncKnowledgeBases(Number(incubationId), "industry", [], null, user);
      return getIndustryIncubationDetail(incubationId);
    }
    async function syncIndustryIncubationToEnhancement(incubationId, user) {
      const detail = await getIndustryIncubationDetail(incubationId);
      const assets = detail.standardAssets && typeof detail.standardAssets === "object" ? detail.standardAssets : defaultConfig().standardAssets;
      const catalog = assets.researchCatalog && typeof assets.researchCatalog === "object" ? assets.researchCatalog : defaultConfig().standardAssets.researchCatalog;
      const enhancement = await enhancementService.saveScenarioEnhancement({
        id: detail.enhancementProfileId || void 0,
        profileName: `${detail.incubationName} Enhancement`,
        profileCode: detail.incubationCode,
        industry: detail.industryCode,
        profileDesc: detail.incubationDesc || null,
        locale: "zh-CN",
        businessStyle: detail.industryCode,
        confidenceThreshold: 0.72,
        priority: 10,
        status: "active",
        recognition: { aliases: [detail.incubationName], keywords: [detail.incubationName, detail.industryCode], negativeKeywords: [] },
        researchCatalog: { summary: catalog.summary || "", categoryTree: Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [], candidateTables: Array.isArray(catalog.categoryTree) ? catalog.categoryTree.flatMap((item) => item.tableScopes || []) : [], candidateTableSpecs: Array.isArray(catalog.candidateTableSpecs) ? catalog.candidateTableSpecs : [], dictSuggestionSpecs: Array.isArray(assets.dictionaries) ? assets.dictionaries : [], sourceRefs: [] },
        modulePlanner: { summary: catalog.summary || "", categories: Array.isArray(catalog.categoryTree) ? catalog.categoryTree : [] },
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
        dictionaries: Array.isArray(assets.dictionaries) ? assets.dictionaries : [],
        distributionRules: [],
        fieldRules: [],
        complianceRules: [],
        pluginBindings: [],
        extendedRules: []
      }, user);
      await pool.query("UPDATE lab_industry_incubation SET enhancement_profile_id = ?, last_synced_at = NOW() WHERE id = ?", [Number(enhancement.id), Number(incubationId)]);
      return { incubation: await getIndustryIncubationDetail(incubationId), enhancement };
    }
    async function rebuildIndustryIncubationDictionaryOwnership(incubationId) {
      return getIndustryIncubationDetail(incubationId);
    }
    async function generateIndustryIncubationRound() {
      throw new AppError("legacy round flow is disabled", 400);
    }
    async function updateIndustryIncubationRound() {
      throw new AppError("legacy round flow is disabled", 400);
    }
    async function executeIndustryIncubationRound() {
      throw new AppError("legacy round flow is disabled", 400);
    }
    module2.exports = {
      listIndustryIncubations,
      getIndustryIncubationDetail,
      getIndustryIncubationStats,
      listIndustryIncubationLogs,
      saveIndustryIncubation,
      deleteIndustryIncubation,
      deleteIndustryCategory,
      refreshIndustryMetadata,
      startIndustryIncubationRun,
      stopIndustryIncubationRun,
      updateIndustryCategoryIteration,
      generateIndustryIncubationRound,
      updateIndustryIncubationRound,
      syncIndustryIncubationToEnhancement,
      executeIndustryIncubationRound,
      rebuildIndustryIncubationDictionaryOwnership
    };
  }
});

// backend/src/modules/system-knowledge-base/system-knowledge-base.preview.js
var require_system_knowledge_base_preview = __commonJS({
  "backend/src/modules/system-knowledge-base/system-knowledge-base.preview.js"(exports2, module2) {
    var path = require("node:path");
    var HTML_CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
    var MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;
    var TYPE_MAP = Object.freeze({
      html: ["html", "text/html; charset=utf-8", "html", "text"],
      htm: ["html", "text/html; charset=utf-8", "html", "text"],
      md: ["markdown", "text/markdown; charset=utf-8", "markdown", "text"],
      markdown: ["markdown", "text/markdown; charset=utf-8", "markdown", "text"],
      json: ["json", "application/json; charset=utf-8", "json", "text"],
      csv: ["table", "text/csv; charset=utf-8", "csv", "text"],
      xls: ["table", "application/vnd.ms-excel", "csv", "text"],
      xlsx: ["table", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "csv", "text"],
      pdf: ["pdf", "application/pdf", null, "original"],
      doc: ["office", "application/msword", null, "pdf"],
      docx: ["office", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", null, "pdf"],
      ppt: ["office", "application/vnd.ms-powerpoint", null, "pdf"],
      pptx: ["office", "application/vnd.openxmlformats-officedocument.presentationml.presentation", null, "pdf"],
      png: ["image", "image/png", null, "original"],
      jpg: ["image", "image/jpeg", null, "original"],
      jpeg: ["image", "image/jpeg", null, "original"],
      gif: ["image", "image/gif", null, "original"],
      webp: ["image", "image/webp", null, "original"],
      bmp: ["image", "image/bmp", null, "original"],
      svg: ["image", "image/svg+xml", null, "original"],
      mp3: ["audio", "audio/mpeg", null, "original"],
      wav: ["audio", "audio/wav", null, "original"],
      ogg: ["audio", "audio/ogg", null, "original"],
      m4a: ["audio", "audio/mp4", null, "original"],
      mp4: ["video", "video/mp4", null, "original"],
      webm: ["video", "video/webm", null, "original"],
      mov: ["video", "video/quicktime", null, "original"]
    });
    var CODE_TYPES = Object.freeze({
      sql: ["text/plain; charset=utf-8", "sql"],
      txt: ["text/plain; charset=utf-8", "plaintext"],
      log: ["text/plain; charset=utf-8", "plaintext"],
      yaml: ["application/yaml; charset=utf-8", "yaml"],
      yml: ["application/yaml; charset=utf-8", "yaml"],
      xml: ["application/xml; charset=utf-8", "xml"],
      js: ["text/javascript; charset=utf-8", "javascript"],
      jsx: ["text/javascript; charset=utf-8", "javascript"],
      ts: ["text/typescript; charset=utf-8", "typescript"],
      tsx: ["text/typescript; charset=utf-8", "typescript"],
      css: ["text/css; charset=utf-8", "css"],
      scss: ["text/x-scss; charset=utf-8", "scss"],
      sh: ["text/x-shellscript; charset=utf-8", "shell"],
      py: ["text/x-python; charset=utf-8", "python"],
      java: ["text/x-java-source; charset=utf-8", "java"]
    });
    function resolveExtension(fileName, fileType) {
      const explicit = String(fileType || "").trim().toLowerCase().replace(/^\./, "");
      if (explicit) return explicit;
      return path.extname(String(fileName || "")).replace(/^\./, "").toLowerCase();
    }
    function classifyPreview(fileName, fileType) {
      const extension = resolveExtension(fileName, fileType);
      if (TYPE_MAP[extension]) {
        const [kind, mimeType, language, preferredVariant] = TYPE_MAP[extension];
        return { kind, mimeType, language, preferredVariant };
      }
      if (CODE_TYPES[extension]) {
        const [mimeType, language] = CODE_TYPES[extension];
        return { kind: "code", mimeType, language, preferredVariant: "text" };
      }
      return { kind: "unsupported", mimeType: "application/octet-stream", language: null, preferredVariant: "original" };
    }
    function buildPreviewDescriptor(document, options = {}) {
      const classification = classifyPreview(document?.fileName, document?.fileType);
      const variant = options.preferredVariant || classification.preferredVariant;
      const id = Number(document?.id);
      return {
        ...classification,
        fileName: String(document?.fileName || ""),
        fileSize: Number(document?.fileSize || 0),
        contentUrl: `/system-knowledge-bases/documents/${id}/content?variant=${encodeURIComponent(variant)}`,
        converted: Boolean(options.converted),
        fallbackReason: options.fallbackReason || null,
        maxPreviewBytes: MAX_TEXT_PREVIEW_BYTES
      };
    }
    function injectSandboxCsp(html) {
      const source = String(html || "");
      const meta = `<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}">`;
      if (/<head(?:\s[^>]*)?>/i.test(source)) {
        return source.replace(/<head(?:\s[^>]*)?>/i, (value) => `${value}${meta}`);
      }
      if (/<html(?:\s[^>]*)?>/i.test(source)) {
        return source.replace(/<html(?:\s[^>]*)?>/i, (value) => `${value}<head>${meta}</head>`);
      }
      return `<!doctype html><html><head>${meta}</head><body>${source}</body></html>`;
    }
    function parseSingleRange(headerValue, size) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(String(headerValue || "").trim());
      const totalSize = Number(size);
      if (!match || !Number.isSafeInteger(totalSize) || totalSize <= 0) return null;
      if (!match[1] && !match[2]) return null;
      let start;
      let end;
      if (!match[1]) {
        const suffixLength = Number(match[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
        start = Math.max(0, totalSize - suffixLength);
        end = totalSize - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : totalSize - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= totalSize) return null;
        end = Math.min(end, totalSize - 1);
      }
      return { start, end };
    }
    module2.exports = {
      HTML_CSP,
      MAX_TEXT_PREVIEW_BYTES,
      buildPreviewDescriptor,
      classifyPreview,
      injectSandboxCsp,
      parseSingleRange
    };
  }
});

// backend/src/modules/system-knowledge-base/libreoffice-preview.js
var require_libreoffice_preview = __commonJS({
  "backend/src/modules/system-knowledge-base/libreoffice-preview.js"(exports2, module2) {
    var crypto = require("node:crypto");
    var fs = require("node:fs");
    var path = require("node:path");
    var { execFile } = require("node:child_process");
    var { pathToFileURL } = require("node:url");
    var { promisify } = require("node:util");
    var execFileAsync = promisify(execFile);
    var DEFAULT_TIMEOUT_MS = 6e4;
    function findLibreOfficeBinary(options = {}) {
      const env = options.env || process.env;
      const platform = options.platform || process.platform;
      const exists = options.exists || fs.existsSync;
      const candidates = [];
      if (env.LIBREOFFICE_BIN) candidates.push(env.LIBREOFFICE_BIN);
      const executableNames = platform === "win32" ? ["soffice.exe"] : ["soffice", "libreoffice"];
      String(env.PATH || "").split(path.delimiter).filter(Boolean).forEach((directory) => {
        executableNames.forEach((name) => candidates.push(path.join(directory, name)));
      });
      if (platform === "darwin") {
        candidates.push(
          "/opt/homebrew/bin/soffice",
          "/usr/local/bin/soffice",
          "/Applications/LibreOffice.app/Contents/MacOS/soffice"
        );
      } else if (platform === "linux") {
        candidates.push("/usr/bin/soffice", "/usr/bin/libreoffice", "/opt/libreoffice/program/soffice");
      } else if (platform === "win32") {
        candidates.push(
          "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
          "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe"
        );
      }
      return candidates.find((candidate) => candidate && exists(candidate)) || null;
    }
    function buildCacheKey(documentId, updatedAt, sourcePath) {
      return crypto.createHash("sha256").update(`${Number(documentId) || 0}:${String(updatedAt || "")}:${path.basename(String(sourcePath || ""))}`).digest("hex").slice(0, 20);
    }
    async function defaultRunCommand(binary, args, options) {
      return execFileAsync(binary, args, {
        timeout: options.timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true
      });
    }
    async function convertOfficeToPdf(options) {
      const sourcePath = path.resolve(String(options?.sourcePath || ""));
      const binary = Object.hasOwn(options || {}, "binary") ? options.binary : findLibreOfficeBinary();
      if (!binary) {
        throw new Error("LibreOffice \u672A\u5B89\u88C5\uFF0C\u65E0\u6CD5\u751F\u6210 Office \u6587\u4EF6\u9884\u89C8\uFF1B\u8BF7\u8FD0\u884C\u4ED3\u5E93\u4E2D\u7684\u9884\u89C8\u4F9D\u8D56\u5B89\u88C5\u811A\u672C");
      }
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Office \u539F\u59CB\u6587\u4EF6\u4E0D\u5B58\u5728: ${path.basename(sourcePath)}`);
      }
      const cacheRoot = path.resolve(options.cacheDir || path.resolve(process.cwd(), "runtime/system-knowledge-base-preview-cache"));
      const cacheKey = buildCacheKey(options.documentId, options.updatedAt, sourcePath);
      const conversionDir = path.join(cacheRoot, `document-${Number(options.documentId) || 0}-${cacheKey}`);
      const outputFileName = `${path.parse(sourcePath).name}.pdf`;
      const outputPath = path.join(conversionDir, outputFileName);
      fs.mkdirSync(conversionDir, { recursive: true });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        return { path: outputPath, converted: true, cacheHit: true };
      }
      const profileDir = path.join(conversionDir, "libreoffice-profile");
      fs.mkdirSync(profileDir, { recursive: true });
      const args = [
        "--headless",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        "--convert-to",
        "pdf",
        "--outdir",
        conversionDir,
        sourcePath
      ];
      const runCommand = options.runCommand || defaultRunCommand;
      await runCommand(binary, args, { timeoutMs: Number(options.timeoutMs || DEFAULT_TIMEOUT_MS) });
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 0) {
        throw new Error(`LibreOffice \u8F6C\u6362\u672A\u751F\u6210 PDF: ${path.basename(sourcePath)}`);
      }
      return { path: outputPath, converted: true, cacheHit: false };
    }
    module2.exports = {
      DEFAULT_TIMEOUT_MS,
      convertOfficeToPdf,
      findLibreOfficeBinary
    };
  }
});

// backend/src/modules/system-knowledge-base/system-knowledge-base.content.js
var require_system_knowledge_base_content = __commonJS({
  "backend/src/modules/system-knowledge-base/system-knowledge-base.content.js"(exports2, module2) {
    var fs = require("node:fs");
    var path = require("node:path");
    var AppError = require_app_error();
    var { convertOfficeToPdf } = require_libreoffice_preview();
    var {
      MAX_TEXT_PREVIEW_BYTES,
      classifyPreview,
      injectSandboxCsp
    } = require_system_knowledge_base_preview();
    var ALLOWED_VARIANTS = /* @__PURE__ */ new Set(["original", "text", "pdf"]);
    function normalizeContentVariant(value) {
      const variant = String(value || "original").trim().toLowerCase();
      if (!ALLOWED_VARIANTS.has(variant)) {
        throw new AppError(`\u4E0D\u652F\u6301\u7684\u9884\u89C8\u683C\u5F0F: ${variant}`, 400);
      }
      return variant;
    }
    function buildInlineContentDisposition(fileName) {
      const safeName = path.basename(String(fileName || "download"));
      const extension = path.extname(safeName).replace(/[^.a-zA-Z0-9]/g, "");
      const fallback = `download${extension}`;
      const encoded = encodeURIComponent(safeName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
    }
    async function defaultReadText(filePath) {
      return fs.promises.readFile(filePath, "utf8");
    }
    async function resolveDocumentContent(document, requestedVariant, dependencies = {}) {
      const variant = normalizeContentVariant(requestedVariant);
      const resolvePath = dependencies.resolvePath || ((record) => record?.filePath);
      const sourcePath = resolvePath(document);
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new AppError("\u77E5\u8BC6\u5E93\u539F\u59CB\u6587\u4EF6\u4E0D\u5B58\u5728", 404);
      }
      const classification = classifyPreview(document?.fileName, document?.fileType);
      if (variant === "original") {
        const stat2 = fs.statSync(sourcePath);
        return {
          mode: "file",
          path: sourcePath,
          fileName: document.fileName,
          mimeType: classification.mimeType,
          size: stat2.size,
          converted: false
        };
      }
      if (variant === "text") {
        const readText = dependencies.readText || defaultReadText;
        let content = String(await readText(sourcePath, document?.fileType) || "");
        if (classification.kind === "html") content = injectSandboxCsp(content);
        const truncated = Buffer.byteLength(content, "utf8") > MAX_TEXT_PREVIEW_BYTES;
        if (truncated) content = Buffer.from(content, "utf8").subarray(0, MAX_TEXT_PREVIEW_BYTES).toString("utf8");
        return {
          mode: "text",
          content,
          fileName: document.fileName,
          mimeType: classification.mimeType,
          size: Buffer.byteLength(content, "utf8"),
          converted: classification.kind === "table" && !["csv"].includes(String(document?.fileType || "").toLowerCase()),
          truncated
        };
      }
      if (classification.kind === "pdf") {
        const stat2 = fs.statSync(sourcePath);
        return { mode: "file", path: sourcePath, fileName: document.fileName, mimeType: "application/pdf", size: stat2.size, converted: false };
      }
      if (classification.kind !== "office") {
        throw new AppError(`\u6587\u4EF6\u7C7B\u578B ${document?.fileType || "unknown"} \u4E0D\u652F\u6301\u8F6C\u6362\u4E3A PDF`, 400);
      }
      const convertOffice = dependencies.convertOffice || convertOfficeToPdf;
      const converted = await convertOffice({
        sourcePath,
        documentId: document.id,
        updatedAt: document.updatedAt,
        cacheDir: dependencies.cacheDir
      });
      const stat = fs.statSync(converted.path);
      return {
        mode: "file",
        path: converted.path,
        fileName: `${path.parse(document.fileName).name}.pdf`,
        mimeType: "application/pdf",
        size: stat.size,
        converted: true,
        cacheHit: Boolean(converted.cacheHit)
      };
    }
    module2.exports = {
      buildInlineContentDisposition,
      normalizeContentVariant,
      resolveDocumentContent
    };
  }
});

// backend/src/modules/system-knowledge-base/system-knowledge-base.service.js
var require_system_knowledge_base_service = __commonJS({
  "backend/src/modules/system-knowledge-base/system-knowledge-base.service.js"(exports2, module2) {
    var fs = require("fs");
    var path = require("path");
    var crypto = require("crypto");
    var iconv = require("iconv-lite");
    var { pool } = require_database();
    var AppError = require_app_error();
    var { getCurrentProjectId } = require_project_context();
    var incubationService = require_data_lab_incubation_runtime();
    var { buildPreviewDescriptor } = require_system_knowledge_base_preview();
    var { resolveDocumentContent } = require_system_knowledge_base_content();
    function queryFirst(rows) {
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }
    function getProjectScope(alias = "") {
      const projectId = getCurrentProjectId();
      if (!projectId) return { sql: "", params: [], projectId: null };
      const prefix = alias ? `${alias}.` : "";
      return { sql: `${prefix}project_id = ?`, params: [projectId], projectId };
    }
    function safeJsonParse(value, fallback) {
      if (value === null || value === void 0 || value === "") {
        return fallback;
      }
      if (typeof value === "object") {
        return value;
      }
      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    }
    function countEncodingGarbleHints(text) {
      const value = String(text || "");
      const suspiciousTokens = [
        "\u7F03\u6220",
        "\u6D5C\u3086",
        "\u741B\u5C7C",
        "\u9429\u6220",
        "\u599B\u20AC",
        "\u9359\u677F",
        "\u93C1\u677F"
      ];
      return suspiciousTokens.reduce((total, token) => total + (value.includes(token) ? 1 : 0), 0);
    }
    function scoreDecodedText(text) {
      const value = String(text || "");
      const chinese = (value.match(/[\u4e00-\u9fff]/g) || []).length;
      const replacement = (value.match(/�/g) || []).length;
      const mojibake = (value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/g) || []).length;
      const printable = (value.match(/[A-Za-z0-9\u4e00-\u9fff，。！？；：、“”‘’（）【】《》、\s._\-/:]/g) || []).length;
      return printable + chinese * 2 - replacement * 5 - mojibake * 3 - countEncodingGarbleHints(value) * 500;
    }
    function normalizePossibleMojibakeText(text) {
      const raw = String(text || "");
      if (!/[\u0080-\u00ff]/.test(raw)) {
        return raw;
      }
      try {
        const decoded = Buffer.from(raw, "latin1").toString("utf8");
        return scoreDecodedText(decoded) > scoreDecodedText(raw) ? decoded : raw;
      } catch {
        return raw;
      }
    }
    function isLikelyMojibakeText(text) {
      const value = String(text || "").trim();
      if (!value) return false;
      if (value.includes("\u951F")) return true;
      const suspiciousMatches = value.match(/[�寮鍦虹櫧绯荤粺鎻愮ず璇鐭ヨ瘑搴鎺ュ彛妫€绱㈣鍐嶅垱寤鴻嚜涓昏]/g) || [];
      const chineseMatches = value.match(/[\u4e00-\u9fff]/g) || [];
      return suspiciousMatches.length >= 6 && suspiciousMatches.length >= Math.max(6, Math.floor(chineseMatches.length * 0.3));
    }
    function normalizeUploadedFileName(fileName) {
      return path.basename(normalizePossibleMojibakeText(fileName)).trim() || "unnamed";
    }
    function decodeTextBuffer(buffer) {
      const candidates = [
        buffer.toString("utf8"),
        iconv.decode(buffer, "gb18030"),
        iconv.decode(buffer, "gbk")
      ];
      return candidates.sort((left, right) => scoreDecodedText(right) - scoreDecodedText(left))[0];
    }
    function splitTextIntoChunks(text, chunkSize = 800) {
      const normalized = String(text || "").replace(/\r/g, "").trim();
      if (!normalized) {
        return ["\u7A7A\u6587\u6863"];
      }
      const paragraphs = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
      if (paragraphs.length === 0) {
        return [normalized.slice(0, chunkSize)];
      }
      const chunks = [];
      let current = "";
      for (const paragraph of paragraphs) {
        const candidate = current ? `${current}

${paragraph}` : paragraph;
        if (candidate.length > chunkSize && current) {
          chunks.push(current);
          current = paragraph;
        } else {
          current = candidate;
        }
      }
      if (current) {
        chunks.push(current);
      }
      return chunks.length > 0 ? chunks : [normalized.slice(0, chunkSize)];
    }
    function extractKeywords(text) {
      return [...new Set(String(text || "").match(/[A-Za-z0-9_\u4e00-\u9fa5]{2,}/g) || [])].slice(0, 16);
    }
    function hasTag(tags, value) {
      return (Array.isArray(tags) ? tags : []).includes(value);
    }
    function normalizeTagList(tags = []) {
      return [...new Set((Array.isArray(tags) ? tags : []).map((item) => String(item || "").trim()).filter(Boolean))];
    }
    function normalizeSummaryLine(line) {
      return String(line || "").replace(/^\s*[#>*\-\d.、]+\s*/g, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    }
    function buildDocumentParseSummary(fileName, content, chunks) {
      if (scoreDecodedText(content) < 20) {
        return `\u5DF2\u89E3\u6790 ${fileName}\uFF0C\u5171 ${chunks.length} \u4E2A\u7247\u6BB5`;
      }
      const lines = String(content || "").replace(/\r/g, "").split("\n").map(normalizeSummaryLine).filter(Boolean).filter((line) => line !== "\u7A7A\u6587\u6863");
      const excerpt = lines.slice(0, 3).join("\uFF1B").slice(0, 120) || "\u6587\u6863\u5DF2\u5B8C\u6210\u89E3\u6790";
      const keywords = extractKeywords(content).slice(0, 6).join("\u3001");
      return `\u6458\u8981\uFF1A${excerpt}${excerpt.length >= 120 ? "..." : ""}\uFF1B\u5173\u952E\u8BCD\uFF1A${keywords || "\u65E0"}\uFF1B\u5171 ${chunks.length} \u4E2A\u7247\u6BB5`;
    }
    async function getExistingDocumentChunkContents(documentId) {
      const [rows] = await pool.query(
        `SELECT content
     FROM system_knowledge_base_chunk
     WHERE kb_doc_id = ?
     ORDER BY chunk_index ASC`,
        [documentId]
      );
      return rows.map((row) => row.content).filter(Boolean);
    }
    function resolveExistingKnowledgeDocumentPath(document) {
      const candidates = [];
      if (document?.filePath) {
        candidates.push(document.filePath);
      }
      const fileName = path.basename(String(document?.fileName || "").trim());
      if (fileName) {
        const generatedDir = path.resolve(__dirname, "../../runtime/system-knowledge-base-generated");
        const uploadDir = path.resolve(__dirname, "../../runtime/system-knowledge-base-uploads");
        [generatedDir, uploadDir].forEach((dirPath) => {
          if (!fs.existsSync(dirPath)) return;
          const matched = fs.readdirSync(dirPath).filter((item) => item.endsWith(fileName)).map((item) => path.join(dirPath, item)).sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
          candidates.push(...matched);
        });
      }
      return candidates.find((item) => item && fs.existsSync(item)) || null;
    }
    async function readDocumentText(filePath, fileType) {
      const ext = String(fileType || "").toLowerCase();
      if ([
        "txt",
        "md",
        "markdown",
        "csv",
        "json",
        "log",
        "html",
        "htm",
        "sql",
        "yaml",
        "yml",
        "xml",
        "js",
        "jsx",
        "ts",
        "tsx",
        "css",
        "scss",
        "sh",
        "py",
        "java"
      ].includes(ext)) {
        const buffer = fs.readFileSync(filePath);
        const utf8Text = buffer.toString("utf8");
        if (!isLikelyMojibakeText(utf8Text)) {
          return utf8Text;
        }
        return decodeTextBuffer(buffer);
      }
      if (ext === "pdf") {
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(fs.readFileSync(filePath));
        return data.text || "";
      }
      if (ext === "docx") {
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || "";
      }
      if (ext === "doc") {
        const WordExtractor = require("word-extractor");
        const extractor = new WordExtractor();
        const document = await extractor.extract(filePath);
        return document.getBody() || "";
      }
      if (["xlsx", "xls"].includes(ext)) {
        const xlsx = require("xlsx");
        const workbook = xlsx.readFile(filePath);
        return workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          return `# ${sheetName}
${xlsx.utils.sheet_to_csv(sheet)}`;
        }).join("\n\n");
      }
      const stat = fs.statSync(filePath);
      return [
        `\u6587\u4EF6\u540D\uFF1A${path.basename(filePath)}`,
        `\u6587\u4EF6\u7C7B\u578B\uFF1A${ext || "unknown"}`,
        `\u6587\u4EF6\u5927\u5C0F\uFF1A${stat.size} bytes`,
        "\u5F53\u524D\u6587\u4EF6\u7C7B\u578B\u6682\u4E0D\u652F\u6301\u6DF1\u5EA6\u89E3\u6790\uFF0C\u5DF2\u4FDD\u7559\u539F\u59CB\u6587\u4EF6\u4F9B\u4E0B\u8F7D\u548C\u540E\u7EED\u6269\u5C55\u3002"
      ].join("\n");
    }
    async function ensureKnowledgeBaseExists(id) {
      const scoped = getProjectScope("");
      const [rows] = await pool.query(
        `SELECT id, kb_name AS kbName
     FROM system_knowledge_base
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      const row = queryFirst(rows);
      if (!row) {
        throw new AppError("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728", 404);
      }
      return {
        id: Number(row.id),
        kbName: row.kbName
      };
    }
    async function getKnowledgeBaseDocuments(kbId) {
      const [rows] = await pool.query(
        `SELECT id, kb_id AS kbId, file_name AS fileName, file_type AS fileType, file_path AS filePath,
            file_size AS fileSize, parse_status AS parseStatus, parse_summary AS parseSummary,
            vector_status AS vectorStatus, doc_status AS docStatus, chunk_count AS chunkCount,
            last_parsed_at AS lastParsedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM system_knowledge_base_document
     WHERE kb_id = ?
     ORDER BY updated_at DESC, id DESC`,
        [kbId]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        kbId: Number(row.kbId),
        fileName: normalizePossibleMojibakeText(row.fileName),
        fileType: row.fileType,
        filePath: row.filePath,
        fileSize: Number(row.fileSize || 0),
        parseStatus: row.parseStatus,
        parseSummary: normalizePossibleMojibakeText(row.parseSummary),
        vectorStatus: row.vectorStatus,
        docStatus: row.docStatus,
        chunkCount: Number(row.chunkCount || 0),
        lastParsedAt: row.lastParsedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    }
    async function getKnowledgeBaseDetail(id) {
      const scoped = getProjectScope("");
      const [rows] = await pool.query(
        `SELECT id, kb_name AS kbName, kb_desc AS kbDesc, tags_json AS tags,
            status, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt
     FROM system_knowledge_base
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}
     LIMIT 1`,
        [id, ...scoped.params]
      );
      const kb = queryFirst(rows);
      if (!kb) {
        throw new AppError("\u77E5\u8BC6\u5E93\u4E0D\u5B58\u5728", 404);
      }
      const documents = await getKnowledgeBaseDocuments(id);
      return {
        id: Number(kb.id),
        kbName: normalizePossibleMojibakeText(kb.kbName),
        kbDesc: normalizePossibleMojibakeText(kb.kbDesc),
        tags: safeJsonParse(kb.tags, []),
        status: kb.status,
        createdBy: kb.createdBy,
        documentCount: documents.length,
        createdAt: kb.createdAt,
        updatedAt: kb.updatedAt,
        documents
      };
    }
    async function listKnowledgeBases() {
      const scoped = getProjectScope("kb");
      const [rows] = await pool.query(
        `SELECT kb.id, kb.kb_name AS kbName, kb.kb_desc AS kbDesc, kb.tags_json AS tags,
            kb.status, kb.created_by AS createdBy, kb.created_at AS createdAt, kb.updated_at AS updatedAt,
            COUNT(doc.id) AS documentCount
     FROM system_knowledge_base kb
     LEFT JOIN system_knowledge_base_document doc ON doc.kb_id = kb.id
     ${scoped.sql ? `WHERE ${scoped.sql}` : ""}
     GROUP BY kb.id, kb.kb_name, kb.kb_desc, kb.tags_json, kb.status, kb.created_by, kb.created_at, kb.updated_at
     ORDER BY kb.updated_at DESC, kb.id DESC`,
        scoped.params
      );
      return rows.map((row) => ({
        id: Number(row.id),
        kbName: normalizePossibleMojibakeText(row.kbName),
        kbDesc: normalizePossibleMojibakeText(row.kbDesc),
        tags: safeJsonParse(row.tags, []),
        status: row.status,
        createdBy: row.createdBy,
        documentCount: Number(row.documentCount || 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    }
    async function findKnowledgeBaseByTags(tags = []) {
      const normalized = normalizeTagList(tags);
      if (!normalized.length) {
        return null;
      }
      const all = await listKnowledgeBases();
      return all.find((item) => {
        const itemTags = normalizeTagList(item.tags || []);
        return itemTags.length === normalized.length && normalized.every((tag) => hasTag(itemTags, tag));
      }) || null;
    }
    async function createKnowledgeBase(payload, user) {
      const projectId = getCurrentProjectId();
      const [result] = await pool.query(
        `INSERT INTO system_knowledge_base (project_id, kb_name, kb_desc, tags_json, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          payload.kbName,
          payload.kbDesc || null,
          JSON.stringify(payload.tags || []),
          payload.status || "active",
          user?.displayName || user?.username || "system"
        ]
      );
      return getKnowledgeBaseDetail(result.insertId);
    }
    async function createOrUpdateKnowledgeBaseByTags(payload, user) {
      const existing = await findKnowledgeBaseByTags(payload.tags || []);
      if (existing) {
        return updateKnowledgeBase(existing.id, payload);
      }
      return createKnowledgeBase(payload, user);
    }
    async function updateKnowledgeBase(id, payload) {
      await ensureKnowledgeBaseExists(id);
      const scoped = getProjectScope("");
      await pool.query(
        `UPDATE system_knowledge_base
     SET kb_name = ?, kb_desc = ?, tags_json = ?, status = ?
     WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [
          payload.kbName,
          payload.kbDesc || null,
          JSON.stringify(payload.tags || []),
          payload.status || "active",
          id,
          ...scoped.params
        ]
      );
      return getKnowledgeBaseDetail(id);
    }
    async function deleteKnowledgeBase(id) {
      const detail = await getKnowledgeBaseDetail(id);
      for (const document of detail.documents || []) {
        if (document.filePath && fs.existsSync(document.filePath)) {
          fs.unlinkSync(document.filePath);
        }
      }
      const scoped = getProjectScope("");
      await pool.query(
        `DELETE FROM system_knowledge_base WHERE id = ?${scoped.sql ? ` AND ${scoped.sql}` : ""}`,
        [id, ...scoped.params]
      );
      return { id };
    }
    async function getKnowledgeDocumentById(documentId) {
      const [rows] = await pool.query(
        `SELECT id, kb_id AS kbId, file_name AS fileName, file_type AS fileType, file_path AS filePath,
            file_size AS fileSize, parse_status AS parseStatus, parse_summary AS parseSummary,
            vector_status AS vectorStatus, doc_status AS docStatus, chunk_count AS chunkCount,
            last_parsed_at AS lastParsedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM system_knowledge_base_document
     WHERE id = ?
     LIMIT 1`,
        [documentId]
      );
      const row = queryFirst(rows);
      if (!row) {
        throw new AppError("\u77E5\u8BC6\u5E93\u6587\u4EF6\u4E0D\u5B58\u5728", 404);
      }
      return {
        id: Number(row.id),
        kbId: Number(row.kbId),
        fileName: normalizePossibleMojibakeText(row.fileName),
        fileType: row.fileType,
        filePath: row.filePath,
        fileSize: Number(row.fileSize || 0),
        parseStatus: row.parseStatus,
        parseSummary: normalizePossibleMojibakeText(row.parseSummary),
        vectorStatus: row.vectorStatus,
        docStatus: row.docStatus,
        chunkCount: Number(row.chunkCount || 0),
        lastParsedAt: row.lastParsedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
    }
    async function getKnowledgeDocumentPreview(documentId) {
      const document = await getKnowledgeDocumentById(documentId);
      const [rows] = await pool.query(
        `SELECT id, chunk_index AS chunkIndex, content, keywords_json AS keywords, created_at AS createdAt
     FROM system_knowledge_base_chunk
     WHERE kb_doc_id = ?
     ORDER BY chunk_index ASC
     LIMIT 50`,
        [documentId]
      );
      const chunks = rows.map((row) => ({
        id: Number(row.id),
        chunkIndex: Number(row.chunkIndex || 0),
        content: normalizePossibleMojibakeText(row.content),
        keywords: safeJsonParse(row.keywords, []),
        createdAt: row.createdAt
      }));
      let previewSource = chunks.length > 0 ? "chunks" : "file";
      let previewText = chunks.map((item) => item.content).join("\n\n");
      if (!previewText) {
        try {
          const resolvedPath = resolveExistingKnowledgeDocumentPath(document);
          if (!resolvedPath) {
            throw new AppError("\u539F\u59CB\u6587\u4EF6\u4E0D\u5B58\u5728\uFF0C\u4E14\u6682\u65E0\u53EF\u9884\u89C8\u7684\u89E3\u6790\u7247\u6BB5", 404);
          }
          previewText = await readDocumentText(resolvedPath, document.fileType);
        } catch (error) {
          previewSource = "summary";
          previewText = document.parseSummary || error.message || "\u6682\u65E0\u53EF\u9884\u89C8\u5185\u5BB9";
        }
      }
      const maxPreviewLength = 2e4;
      const publicDocument = { ...document };
      delete publicDocument.filePath;
      return {
        document: publicDocument,
        chunks,
        totalChunks: Number(document.chunkCount || chunks.length || 0),
        previewSource,
        previewText: String(previewText || "").slice(0, maxPreviewLength),
        truncated: String(previewText || "").length > maxPreviewLength,
        viewer: buildPreviewDescriptor(document)
      };
    }
    async function resolveKnowledgeDocumentContent(documentId, variant) {
      const document = await getKnowledgeDocumentById(documentId);
      return resolveDocumentContent(document, variant, {
        resolvePath: resolveExistingKnowledgeDocumentPath,
        readText: readDocumentText,
        cacheDir: path.resolve(process.cwd(), "runtime/system-knowledge-base-preview-cache")
      });
    }
    async function uploadKnowledgeDocument(kbId, file) {
      await ensureKnowledgeBaseExists(kbId);
      if (!file) {
        throw new AppError("\u8BF7\u4E0A\u4F20\u77E5\u8BC6\u5E93\u6587\u4EF6", 400);
      }
      const normalizedFileName = normalizeUploadedFileName(file.originalname);
      const fileType = path.extname(normalizedFileName).replace(/^\./, "").toLowerCase() || "bin";
      const [result] = await pool.query(
        `INSERT INTO system_knowledge_base_document
      (kb_id, file_name, file_type, file_path, file_size, parse_status, vector_status, doc_status)
     VALUES (?, ?, ?, ?, ?, 'WAIT_PARSE', 'PENDING', 'active')`,
        [kbId, normalizedFileName, fileType, file.path, file.size]
      );
      void reparseKnowledgeDocument(result.insertId).catch((error) => {
        console.error("[agent-platform] knowledge document parse failed:", error);
      });
      return getKnowledgeBaseDetail(kbId);
    }
    async function upsertGeneratedKnowledgeDocument(kbId, fileName, content) {
      await ensureKnowledgeBaseExists(kbId);
      const normalizedFileName = normalizeUploadedFileName(fileName);
      const generatedDir = path.resolve(__dirname, "../../runtime/system-knowledge-base-generated");
      fs.mkdirSync(generatedDir, { recursive: true });
      const filePath = path.join(generatedDir, `${Date.now()}-${normalizedFileName}`);
      fs.writeFileSync(filePath, content, "utf8");
      const [rows] = await pool.query(
        `SELECT id
     FROM system_knowledge_base_document
     WHERE kb_id = ?
       AND file_name = ?
     ORDER BY id DESC
     LIMIT 1`,
        [kbId, normalizedFileName]
      );
      const existing = queryFirst(rows);
      let documentId = existing ? Number(existing.id) : null;
      if (documentId) {
        await pool.query(
          `UPDATE system_knowledge_base_document
       SET file_path = ?, file_size = ?, parse_status = 'WAIT_PARSE', vector_status = 'PENDING', doc_status = 'active'
       WHERE id = ?`,
          [filePath, Buffer.byteLength(content, "utf8"), documentId]
        );
      } else {
        const [result] = await pool.query(
          `INSERT INTO system_knowledge_base_document
        (kb_id, file_name, file_type, file_path, file_size, parse_status, vector_status, doc_status)
       VALUES (?, ?, 'md', ?, ?, 'WAIT_PARSE', 'PENDING', 'active')`,
          [kbId, normalizedFileName, filePath, Buffer.byteLength(content, "utf8")]
        );
        documentId = Number(result.insertId);
      }
      await reparseKnowledgeDocument(documentId);
      return getKnowledgeDocumentById(documentId);
    }
    function buildIncubationCategoryKnowledgeDocument(incubation, category, stats, publicDictionaries = []) {
      const categoryStats = (stats?.categories || []).find((item) => item.categoryCode === category.categoryCode);
      const standardAssets = safeJsonParse(incubation.standardAssets, incubation.standardAssets || {});
      const dictionaries = Array.isArray(standardAssets?.dictionaries) ? standardAssets.dictionaries.filter((item) => item?.categoryCode === category.categoryCode) : [];
      const fieldSemantics = Array.isArray(standardAssets?.fieldSemantics) ? standardAssets.fieldSemantics : [];
      const tableDetails = Array.isArray(category.tableDetails) ? category.tableDetails : [];
      const enrichedTableDetails = tableDetails.map((item) => {
        const semanticFields = fieldSemantics.filter((entry) => String(entry?.tableName || "").trim() === String(item?.tableName || "").trim()).map((entry) => String(entry?.fieldLabel || entry?.fieldName || "").trim()).filter(Boolean);
        return {
          ...item,
          keyInfoItems: Array.from(/* @__PURE__ */ new Set([...Array.isArray(item?.keyInfoItems) ? item.keyInfoItems : [], ...semanticFields]))
        };
      });
      const dictionaryGroups = /* @__PURE__ */ new Map();
      dictionaries.forEach((item) => {
        const dictType = String(item?.dictType || "").trim();
        if (!dictType) return;
        if (!dictionaryGroups.has(dictType)) {
          dictionaryGroups.set(dictType, []);
        }
        dictionaryGroups.get(dictType).push(item);
      });
      const publicGroupMap = /* @__PURE__ */ new Map();
      (Array.isArray(publicDictionaries) ? publicDictionaries : []).forEach((item) => {
        publicGroupMap.set(item.dictType, item);
      });
      return [
        `# ${category.categoryName}`,
        "",
        `\u884C\u4E1A\uFF1A${incubation.incubationName}`,
        `\u884C\u4E1A\u7F16\u7801\uFF1A${incubation.industryCode}`,
        `\u5B50\u7C7B\u76EE\u7F16\u7801\uFF1A${category.categoryCode}`,
        `\u6700\u8FD1\u8F6E\u6B21\uFF1A${categoryStats?.lastRoundNo || category.lastRoundNo || 0}`,
        "",
        "## \u4E1A\u52A1\u8BF4\u660E",
        category.description || "\u6682\u65E0\u8BF4\u660E",
        "",
        "## \u8868\u4FE1\u606F\u6E05\u5355",
        ...enrichedTableDetails.length > 0 ? enrichedTableDetails.flatMap((item) => [
          `### ${item.tableName}`,
          `- \u8868\u63CF\u8FF0\uFF1A${item.tableComment || "\u6682\u65E0"}`,
          `- \u8868\u6458\u8981\uFF1A${item.tableSummary || item.summary || item.tableComment || "\u6682\u65E0"}`,
          `- \u5173\u952E\u4FE1\u606F\u9879\uFF1A${Array.isArray(item.keyInfoItems) && item.keyInfoItems.length > 0 ? item.keyInfoItems.join("\u3001") : "\u6682\u65E0"}`,
          ""
        ]) : ["- \u6682\u65E0\u8868\u4FE1\u606F", ""],
        "",
        "## \u5B50\u7C7B\u76EE\u5B57\u5178\u8868",
        ...Array.from(dictionaryGroups.entries()).flatMap(([dictType, items]) => [
          `### ${dictType} / ${String(items[0]?.itemValue?.dictName || items[0]?.dictName || dictType).trim() || dictType}`,
          ...items.map((item) => `- ${item.itemCode}: ${item.itemLabel}${item?.itemValue?.valueRange ? ` (${item.itemValue.valueRange})` : ""}`),
          ""
        ]),
        "## \u884C\u4E1A\u516C\u5171\u5B57\u5178\u8868",
        ...Array.from(publicGroupMap.values()).map((item) => `- ${item.dictType} / ${item.dictName || item.dictType} / ${item.itemCount} \u9879`),
        "",
        "## \u7EDF\u8BA1\u6458\u8981",
        `- \u8868\u6570\uFF1A${categoryStats?.tableCount || 0}`,
        `- \u5B57\u5178\u8868\u6570\uFF1A${categoryStats?.dictionaryGroupCount || 0}`,
        `- \u5B57\u5178\u9879\u6570\uFF1A${categoryStats?.dictionaryItemCount || 0}`,
        `- \u8BC1\u636E\u6570\uFF1A${categoryStats?.evidenceCount || 0}`,
        ""
      ].join("\n");
    }
    function buildIncubationIndustryKnowledgeDocument(incubation, stats) {
      const categories = Array.isArray(incubation?.standardAssets?.researchCatalog?.categoryTree) ? incubation.standardAssets.researchCatalog.categoryTree : [];
      return [
        `# ${incubation.incubationName} \u884C\u4E1A\u77E5\u8BC6\u5E93`,
        "",
        `\u884C\u4E1A\u7F16\u7801\uFF1A${incubation.industryCode}`,
        `\u914D\u7F6E\u7F16\u7801\uFF1A${incubation.incubationCode}`,
        "",
        "## \u884C\u4E1A\u8BF4\u660E",
        incubation.incubationDesc || "\u6682\u65E0\u8BF4\u660E",
        "",
        "## \u7EDF\u8BA1\u6458\u8981",
        `- \u5B50\u7C7B\u76EE\u6570\uFF1A${stats?.totals?.categoryCount || 0}`,
        `- \u8868\u6570\uFF1A${stats?.totals?.tableCount || 0}`,
        `- \u5B57\u5178\u8868\u6570\uFF1A${stats?.totals?.dictionaryGroupCount || 0}`,
        `- \u5B57\u5178\u9879\u6570\uFF1A${stats?.totals?.dictionaryItemCount || 0}`,
        `- \u516C\u5171\u5B57\u5178\u8868\u6570\uFF1A${stats?.totals?.publicDictionaryGroupCount || 0}`,
        `- \u516C\u5171\u5B57\u5178\u9879\u6570\uFF1A${stats?.totals?.publicDictionaryItemCount || 0}`,
        "",
        "## \u5B50\u7C7B\u76EE\u76EE\u5F55",
        ...(stats?.categories || []).map((item) => `- ${item.categoryName} / ${item.categoryCode} / ${item.tableCount} \u8868 / ${item.dictionaryGroupCount} \u5B57\u5178\u8868 / ${item.dictionaryItemCount} \u5B57\u5178\u9879`),
        "",
        "## \u5B50\u7C7B\u76EE\u8868\u4FE1\u606F\u6458\u8981",
        ...categories.flatMap((item) => {
          const categoryName = String(item?.categoryName || item?.categoryCode || "").trim();
          const tableDetails = Array.isArray(item?.tableDetails) ? item.tableDetails : [];
          if (!categoryName) return [];
          return [
            `### ${categoryName}`,
            ...tableDetails.length > 0 ? tableDetails.map((table) => `- ${table.tableName}${table.tableSummary ? ` / ${table.tableSummary}` : table.tableComment ? ` / ${table.tableComment}` : ""}`) : ["- \u6682\u65E0\u8868\u4FE1\u606F"],
            ""
          ];
        }),
        ""
      ].join("\n");
    }
    async function syncIncubationKnowledgeBase(incubationId, payload = {}, user) {
      const incubation = await incubationService.getIndustryIncubationDetail(Number(incubationId));
      const stats = await incubationService.getIndustryIncubationStats(Number(incubationId));
      const categoryCode = String(payload.categoryCode || "").trim() || null;
      const targetCategory = categoryCode ? Array.isArray(stats.categories) ? stats.categories.find((item) => item.categoryCode === categoryCode) : null : null;
      if (categoryCode && !targetCategory) {
        throw new AppError("\u76EE\u6807\u5B50\u7C7B\u76EE\u4E0D\u5B58\u5728", 404);
      }
      const industryKb = await createOrUpdateKnowledgeBaseByTags({
        kbName: `${incubation.incubationName}\u884C\u4E1A\u77E5\u8BC6\u5E93`,
        kbDesc: incubation.incubationDesc || `${incubation.incubationName}\u884C\u4E1A\u5B75\u5316\u7ED3\u6784\u5316\u77E5\u8BC6`,
        tags: normalizeTagList(["scope:industry", `incubation:${incubation.id}`, `industry:${incubation.industryCode}`]),
        status: "active"
      }, user);
      await upsertGeneratedKnowledgeDocument(
        industryKb.id,
        `${incubation.incubationCode}_industry.md`,
        buildIncubationIndustryKnowledgeDocument(incubation, stats)
      );
      if (!targetCategory) {
        return {
          scope: "industry",
          knowledgeBase: await getKnowledgeBaseDetail(industryKb.id)
        };
      }
      const categoryRecord = (Array.isArray(incubation.standardAssets?.researchCatalog?.categoryTree) ? incubation.standardAssets.researchCatalog.categoryTree : []).find((item) => String(item?.categoryCode || "").trim() === targetCategory.categoryCode);
      const categoryKb = await createOrUpdateKnowledgeBaseByTags({
        kbName: `${incubation.incubationName} / ${targetCategory.categoryName}`,
        kbDesc: `${targetCategory.categoryName}\u5B50\u7C7B\u76EE\u7ED3\u6784\u5316\u77E5\u8BC6`,
        tags: normalizeTagList([
          "scope:industry",
          "scope:industry_category",
          `incubation:${incubation.id}`,
          `industry:${incubation.industryCode}`,
          `category:${targetCategory.categoryCode}`,
          `parentKb:${industryKb.id}`
        ]),
        status: "active"
      }, user);
      await upsertGeneratedKnowledgeDocument(
        categoryKb.id,
        `${incubation.incubationCode}_${targetCategory.categoryCode}.md`,
        buildIncubationCategoryKnowledgeDocument(incubation, categoryRecord || targetCategory, stats, stats.publicDictionaries)
      );
      return {
        scope: "category",
        industryKnowledgeBase: await getKnowledgeBaseDetail(industryKb.id),
        knowledgeBase: await getKnowledgeBaseDetail(categoryKb.id)
      };
    }
    async function reparseKnowledgeDocument(documentId) {
      const document = await getKnowledgeDocumentById(documentId);
      const normalizedDocumentName = normalizeUploadedFileName(document.fileName);
      await pool.query(
        `UPDATE system_knowledge_base_document
     SET parse_status = 'PARSING', parse_summary = '\u6587\u6863\u89E3\u6790\u4E2D', vector_status = 'PENDING'
     WHERE id = ?`,
        [documentId]
      );
      try {
        let content;
        try {
          const resolvedPath = resolveExistingKnowledgeDocumentPath(document);
          if (!resolvedPath) {
            const missingError = new Error(`document file missing: ${document.filePath}`);
            missingError.code = "ENOENT";
            throw missingError;
          }
          if (resolvedPath !== document.filePath) {
            await pool.query(
              `UPDATE system_knowledge_base_document
           SET file_path = ?
           WHERE id = ?`,
              [resolvedPath, documentId]
            );
          }
          content = await readDocumentText(resolvedPath, document.fileType);
        } catch (readError) {
          if (readError.code === "ENOENT") {
            const cachedChunks = await getExistingDocumentChunkContents(documentId);
            if (cachedChunks.length > 0) {
              content = cachedChunks.join("\n");
            } else {
              throw readError;
            }
          } else {
            throw readError;
          }
        }
        const chunks = splitTextIntoChunks(content);
        const parseSummary = buildDocumentParseSummary(normalizedDocumentName, content, chunks);
        await pool.query("DELETE FROM system_knowledge_base_chunk WHERE kb_doc_id = ?", [documentId]);
        for (let index = 0; index < chunks.length; index += 1) {
          await pool.query(
            `INSERT INTO system_knowledge_base_chunk (kb_doc_id, kb_id, chunk_index, content, keywords_json)
         VALUES (?, ?, ?, ?, ?)`,
            [documentId, document.kbId, index + 1, chunks[index], JSON.stringify(extractKeywords(chunks[index]))]
          );
        }
        await pool.query(
          `UPDATE system_knowledge_base_document
       SET parse_status = 'PARSE_SUCCESS',
           parse_summary = ?,
           vector_status = 'READY',
           chunk_count = ?,
           last_parsed_at = NOW()
       WHERE id = ?`,
          [parseSummary, chunks.length, documentId]
        );
      } catch (error) {
        await pool.query(
          `UPDATE system_knowledge_base_document
       SET parse_status = 'PARSE_FAIL',
           parse_summary = ?,
           vector_status = 'FAILED',
           last_parsed_at = NOW()
       WHERE id = ?`,
          [error.message || "\u6587\u6863\u89E3\u6790\u5931\u8D25", documentId]
        );
        throw error;
      }
      return getKnowledgeBaseDetail(document.kbId);
    }
    async function deleteKnowledgeDocument(documentId) {
      const document = await getKnowledgeDocumentById(documentId);
      await pool.query("DELETE FROM system_knowledge_base_document WHERE id = ?", [documentId]);
      if (document.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }
      return { id: documentId, kbId: document.kbId };
    }
    module2.exports = {
      listKnowledgeBases,
      getKnowledgeBaseDetail,
      createKnowledgeBase,
      createOrUpdateKnowledgeBaseByTags,
      updateKnowledgeBase,
      deleteKnowledgeBase,
      uploadKnowledgeDocument,
      upsertGeneratedKnowledgeDocument,
      reparseKnowledgeDocument,
      getKnowledgeDocumentPreview,
      resolveKnowledgeDocumentContent,
      getKnowledgeDocumentById,
      deleteKnowledgeDocument,
      syncIncubationKnowledgeBase,
      readDocumentText
    };
  }
});

// backend/src/modules/system-knowledge-base/system-knowledge-base.controller.js
var require_system_knowledge_base_controller = __commonJS({
  "backend/src/modules/system-knowledge-base/system-knowledge-base.controller.js"(exports2, module2) {
    var { sendSuccess } = require_response();
    var fs = require("node:fs");
    var service = require_system_knowledge_base_service();
    var { HTML_CSP, parseSingleRange } = require_system_knowledge_base_preview();
    var { buildInlineContentDisposition } = require_system_knowledge_base_content();
    async function listKnowledgeBases(req, res) {
      return sendSuccess(res, await service.listKnowledgeBases());
    }
    async function getKnowledgeBaseDetail(req, res) {
      return sendSuccess(res, await service.getKnowledgeBaseDetail(Number(req.params.id)));
    }
    async function createKnowledgeBase(req, res) {
      return sendSuccess(res, await service.createKnowledgeBase(req.validatedBody, req.user), null, 201);
    }
    async function updateKnowledgeBase(req, res) {
      return sendSuccess(res, await service.updateKnowledgeBase(Number(req.params.id), req.validatedBody));
    }
    async function deleteKnowledgeBase(req, res) {
      return sendSuccess(res, await service.deleteKnowledgeBase(Number(req.params.id)));
    }
    async function uploadKnowledgeDocument(req, res) {
      return sendSuccess(res, await service.uploadKnowledgeDocument(Number(req.params.id), req.file), null, 201);
    }
    async function reparseKnowledgeDocument(req, res) {
      return sendSuccess(res, await service.reparseKnowledgeDocument(Number(req.params.documentId)));
    }
    async function previewKnowledgeDocument(req, res) {
      return sendSuccess(res, await service.getKnowledgeDocumentPreview(Number(req.params.documentId)));
    }
    async function streamKnowledgeDocumentContent(req, res) {
      const content = await service.resolveKnowledgeDocumentContent(Number(req.params.documentId), req.query.variant);
      res.setHeader("Content-Type", content.mimeType);
      res.setHeader("Content-Disposition", buildInlineContentDisposition(content.fileName));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (content.mimeType.startsWith("text/html")) res.setHeader("Content-Security-Policy", HTML_CSP);
      if (content.mode === "text") {
        res.setHeader("Content-Length", Buffer.byteLength(content.content, "utf8"));
        return res.send(content.content);
      }
      res.setHeader("Accept-Ranges", "bytes");
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const range = parseSingleRange(rangeHeader, content.size);
        if (!range) {
          res.status(416).setHeader("Content-Range", `bytes */${content.size}`);
          return res.end();
        }
        const length = range.end - range.start + 1;
        res.status(206);
        res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${content.size}`);
        res.setHeader("Content-Length", length);
        return fs.createReadStream(content.path, { start: range.start, end: range.end }).pipe(res);
      }
      res.setHeader("Content-Length", content.size);
      return fs.createReadStream(content.path).pipe(res);
    }
    async function downloadKnowledgeDocument(req, res) {
      const document = await service.getKnowledgeDocumentById(Number(req.params.documentId));
      return res.download(document.filePath, document.fileName);
    }
    async function deleteKnowledgeDocument(req, res) {
      return sendSuccess(res, await service.deleteKnowledgeDocument(Number(req.params.documentId)));
    }
    async function syncIncubationKnowledgeBase(req, res) {
      return sendSuccess(res, await service.syncIncubationKnowledgeBase(Number(req.params.incubationId), req.validatedBody || {}, req.user));
    }
    module2.exports = { listKnowledgeBases, getKnowledgeBaseDetail, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase, uploadKnowledgeDocument, reparseKnowledgeDocument, previewKnowledgeDocument, streamKnowledgeDocumentContent, downloadKnowledgeDocument, deleteKnowledgeDocument, syncIncubationKnowledgeBase };
  }
});

// packages/data-platform-module-system-knowledge-base/src/.runtime-entry.js
var controller0 = require_system_knowledge_base_controller();
var { Writable } = require("node:stream");
var handlers = {
  "GET /api/v1/system-knowledge-bases": controller0["listKnowledgeBases"],
  "POST /api/v1/system-knowledge-bases": controller0["createKnowledgeBase"],
  "POST /api/v1/system-knowledge-bases/documents/:documentId/reparse": controller0["reparseKnowledgeDocument"],
  "GET /api/v1/system-knowledge-bases/documents/:documentId/preview": controller0["previewKnowledgeDocument"],
  "GET /api/v1/system-knowledge-bases/documents/:documentId/content": controller0["streamKnowledgeDocumentContent"],
  "GET /api/v1/system-knowledge-bases/documents/:documentId/download": controller0["downloadKnowledgeDocument"],
  "DELETE /api/v1/system-knowledge-bases/documents/:documentId": controller0["deleteKnowledgeDocument"],
  "POST /api/v1/system-knowledge-bases/sync/incubation/:incubationId": controller0["syncIncubationKnowledgeBase"],
  "POST /api/v1/system-knowledge-bases/:id/documents": controller0["uploadKnowledgeDocument"],
  "GET /api/v1/system-knowledge-bases/:id": controller0["getKnowledgeBaseDetail"],
  "PUT /api/v1/system-knowledge-bases/:id": controller0["updateKnowledgeBase"],
  "DELETE /api/v1/system-knowledge-bases/:id": controller0["deleteKnowledgeBase"]
};
function routeParams(apiKey, input) {
  const pathTemplate = apiKey.slice(apiKey.indexOf(" ") + 1);
  const params = { ...input && input.params || {} };
  for (const match of pathTemplate.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1];
    if (params[name] === void 0) params[name] = input?.[name] ?? (name === "id" ? input?.id : void 0);
  }
  if (pathTemplate.includes("*") && params[0] === void 0) params[0] = input?.path || "/";
  return params;
}
function createResponse() {
  const response = new Writable({
    write(chunk, _encoding, callback) {
      this.chunks.push(Buffer.from(chunk));
      callback();
    },
    final(callback) {
      this.payload ??= Buffer.concat(this.chunks);
      callback();
    }
  });
  response.statusCode = 200;
  response.headers = {};
  response.payload = void 0;
  response.chunks = [];
  response.status = function status(code) {
    this.statusCode = code;
    return this;
  };
  response.setHeader = function setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value;
    return this;
  };
  response.json = function json(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.send = function send(value) {
    this.payload = value;
    this.end();
    return value;
  };
  response.download = function download(file, name) {
    this.payload = { path: file, filename: name };
    this.end();
    return this.payload;
  };
  return response;
}
async function executeCapability(definition, input = {}, context = {}) {
  const apiKey = definition.sourceApiKeys[0];
  const handler = handlers[apiKey];
  if (typeof handler !== "function") {
    const error = new Error("No bundled handler for " + apiKey);
    error.code = "CAPABILITY_HANDLER_MISSING";
    throw error;
  }
  const method = apiKey.slice(0, apiKey.indexOf(" "));
  const body = input.body && typeof input.body === "object" ? input.body : input;
  const req = context.request || {
    method,
    params: routeParams(apiKey, input),
    query: input.query || (method === "GET" ? input : {}),
    body,
    validatedBody: body,
    headers: input.headers || {},
    user: context.actor || input.actor || null,
    projectId: context.projectId || input.projectId || null,
    file: input.file || null,
    files: input.files || null,
    ip: null,
    protocol: "cli",
    socket: {},
    get(name) {
      return this.headers[String(name).toLowerCase()] || this.headers[name] || "";
    }
  };
  const res = context.response || createResponse();
  const returned = await handler(req, res);
  if (!context.response && returned === res && !res.writableFinished) {
    await new Promise((resolve, reject) => {
      res.once("finish", resolve);
      res.once("error", reject);
    });
  }
  const payload = res.payload === void 0 ? returned : res.payload;
  if (context.response) {
    return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers || {} };
  }
  if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return { data: payload.data, meta: payload.meta ?? null, statusCode: res.statusCode, headers: res.headers };
  }
  return { data: payload, meta: null, statusCode: res.statusCode, headers: res.headers };
}
module.exports = { executeCapability, createResponse, handlerApiKeys: Object.freeze(Object.keys(handlers)) };
