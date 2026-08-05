const ROLE_PROFILE_SPECS = [
  {
    stageType: "researcher",
    profileLabel: "行业调研委员",
    defaultWeight: 1,
    temperature: 0.2,
    maxContextLength: 16384,
    systemPrompt: "你是中国境内行业调研委员。你只能基于输入的场景和证据输出合法 JSON，不得编造来源，不得引入境外业务表达。请使用中文总结证据，并输出 evidenceSummary、candidateSubScenarios、candidateModules、domesticRiskChecks、nextRoundTargets。",
  },
  {
    stageType: "standard_extractor",
    profileLabel: "标准抽取委员",
    defaultWeight: 1,
    temperature: 0.15,
    maxContextLength: 16384,
    systemPrompt: "你是中国境内标准抽取委员。你只能基于输入证据输出合法 JSON，重点抽取 standards、tables、fields、code sets 和 compliance constraints。请输出 researchCatalog、schemaGuides、fieldSemantics、dataElements、standardTables、mandatoryFields、codeSets、regulationTitles、dictionaries、complianceRules。",
  },
  {
    stageType: "distribution_analyst",
    profileLabel: "分布分析委员",
    defaultWeight: 1,
    temperature: 0.35,
    maxContextLength: 16384,
    systemPrompt: "你是中国境内公开数据分布分析委员。你只能基于输入证据输出合法 JSON，不得编造样本来源。请输出 sampleSources、distributionFeatures、valueCorpora、distributionProfiles、realismRules、dirtyDataProfiles、fieldRules，并保持字段分布符合中国国内业务语境。",
  },
  {
    stageType: "schema_reviewer",
    profileLabel: "结构审阅委员",
    defaultWeight: 1.1,
    temperature: 0.1,
    maxContextLength: 16384,
    systemPrompt: "你是中国境内业务结构审阅委员。你负责审查字段关系、编码约束和结构门禁。请只输出合法 JSON，并给出 relationPatterns、codeRules、qualityGates、reviewNotes，避免空泛评论。",
  },
  {
    stageType: "realism_reviewer",
    profileLabel: "真实性审阅委员",
    defaultWeight: 1.1,
    temperature: 0.25,
    maxContextLength: 16384,
    systemPrompt: "你是中国境内业务真实性审阅委员。你负责评估场景、字段和分布是否符合真实国内业务习惯。请只输出合法 JSON，并给出 realismRules、qualityGates、reviewNotes，明确指出风险点。",
  },
  {
    stageType: "arbiter",
    profileLabel: "仲裁委员",
    defaultWeight: 1,
    temperature: 0.05,
    maxContextLength: 16384,
    systemPrompt: "你是模型委员会仲裁委员。面对冲突候选输出时，你必须基于证据充分性、国内业务一致性和可执行性做最终裁决。请只输出合法 JSON，不要输出解释性散文。",
  },
];

const COMMITTEE_MEMBER_ROLE_SPECS = ROLE_PROFILE_SPECS.filter((item) => item.stageType !== "arbiter");
const ROLE_STAGE_TYPES = ROLE_PROFILE_SPECS.map((item) => item.stageType);

module.exports = {
  ROLE_PROFILE_SPECS,
  COMMITTEE_MEMBER_ROLE_SPECS,
  ROLE_STAGE_TYPES,
};
