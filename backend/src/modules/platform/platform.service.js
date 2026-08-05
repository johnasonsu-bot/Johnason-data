const platformRepository = require("./platform.repository");

async function getOverview() {
  const metrics = await platformRepository.getModuleMetrics();

  return {
    modules: [
      {
        key: "data-ingestion",
        name: "数据接入",
        description: "统一管理数据库、文件、接口、消息等多源异构数据接入链路。",
        capabilities: ["数据源登记", "接入任务配置", "全量/增量同步", "运行监控"],
        total: metrics.ingestionJobCount
      },
      {
        key: "quality-control",
        name: "质量管控",
        description: "围绕质量规则、检测策略、执行任务和问题分析建立数据质量闭环。",
        capabilities: ["规则管理", "策略配置", "质量检测", "问题追踪"],
        total: metrics.qualityRuleCount
      },
      {
        key: "data-processing",
        name: "数据处理",
        description: "提供数据清洗、转换、标准化和调度编排的数据加工能力。",
        capabilities: ["SQL分析", "SQL任务", "ETL 编排", "清洗标准化", "调度管理"],
        total: metrics.processingJobCount
      },
      {
        key: "data-modeling",
        name: "数据建模",
        description: "沉淀行业场景、逻辑模型、物理模型和样本方案等结构化数据资产。",
        capabilities: ["场景模板", "逻辑模型", "物理模型", "样本方案"],
        total: metrics.dataModelCount
      },
      {
        key: "data-service",
        name: "数据服务",
        description: "通过 API、数据集和服务目录向上层应用提供统一的数据消费出口。",
        capabilities: ["服务编目", "统一鉴权", "发布审批", "访问统计"],
        total: metrics.serviceApiCount
      }
    ],
    stats: [
      { key: "dataSourceCount", label: "数据源", value: metrics.dataSourceCount },
      { key: "ingestionJobCount", label: "接入任务", value: metrics.ingestionJobCount },
      { key: "qualityRuleCount", label: "质量规则", value: metrics.qualityRuleCount },
      { key: "processingJobCount", label: "处理任务", value: metrics.processingJobCount },
      { key: "dataModelCount", label: "建模资产", value: metrics.dataModelCount },
      { key: "serviceApiCount", label: "数据服务", value: metrics.serviceApiCount },
    ]
  };
}

module.exports = {
  getOverview
};
