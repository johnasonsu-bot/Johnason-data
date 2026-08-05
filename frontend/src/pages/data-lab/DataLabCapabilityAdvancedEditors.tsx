import { Form, Input, InputNumber, Select, Space, Switch } from "antd";
import type { FormInstance } from "antd";
import {
  AnyRecord,
  format权重项,
  parse权重项,
  parse布尔值,
  可编辑列表表格,
  通用状态选项,
  片段标题,
  useStructuredField,
  标签列表,
  标签输入,
  表格渲染,
} from "./DataLabCapabilityEditorCommon";

export function DistributionProfilesStructuredEditor({ form }: { form: FormInstance }) {
  const [distributionProfiles, setDistributionProfiles] = useStructuredField<AnyRecord>(form, "distributionProfiles", {});
  const channelWeights = Array.isArray(distributionProfiles.channelWeights) ? distributionProfiles.channelWeights : [];
  const regionWeights = Array.isArray(distributionProfiles.regionWeights) ? distributionProfiles.regionWeights : [];
  const customerLevelWeights = Array.isArray(distributionProfiles.customerLevelWeights) ? distributionProfiles.customerLevelWeights : [];
  const stateWeights = Array.isArray(distributionProfiles.stateWeights) ? distributionProfiles.stateWeights : [];

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="分布画像" description="维护渠道、区域、客户等级和状态分布，作为后续数据生成的行业偏好。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="分布说明">
          <Input.TextArea rows={3} value={String(distributionProfiles.summary || "")} onChange={(event) => setDistributionProfiles({ ...distributionProfiles, summary: event.target.value })} />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="渠道分布"
        addText="新增渠道权重"
        dataSource={channelWeights}
        onChange={(next) => setDistributionProfiles({ ...distributionProfiles, channelWeights: next })}
        columns={[
          { title: "渠道编码", dataIndex: "code", width: 180 },
          { title: "渠道名称", dataIndex: "label", width: 180 },
          { title: "权重", dataIndex: "weight", width: 100 },
        ]}
        fields={[
          { name: "code", label: "渠道编码", required: true },
          { name: "label", label: "渠道名称", required: true },
          { name: "weight", label: "权重", type: "number", required: true, min: 0, initialValue: 1 },
        ]}
      />
      <可编辑列表表格
        modalTitle="区域分布"
        addText="新增区域权重"
        dataSource={regionWeights}
        onChange={(next) => setDistributionProfiles({ ...distributionProfiles, regionWeights: next })}
        columns={[
          { title: "区域编码", dataIndex: "code", width: 180 },
          { title: "区域名称", dataIndex: "label", width: 180 },
          { title: "权重", dataIndex: "weight", width: 100 },
        ]}
        fields={[
          { name: "code", label: "区域编码", required: true },
          { name: "label", label: "区域名称", required: true },
          { name: "weight", label: "权重", type: "number", required: true, min: 0, initialValue: 1 },
        ]}
      />
      <可编辑列表表格
        modalTitle="客户等级分布"
        addText="新增客户等级权重"
        dataSource={customerLevelWeights}
        onChange={(next) => setDistributionProfiles({ ...distributionProfiles, customerLevelWeights: next })}
        columns={[
          { title: "客户等级", dataIndex: "level", width: 180 },
          { title: "权重", dataIndex: "weight", width: 100 },
        ]}
        fields={[
          { name: "level", label: "客户等级", required: true, placeholder: "如：高意向、已成交" },
          { name: "weight", label: "权重", type: "number", required: true, min: 0, initialValue: 1 },
        ]}
      />
      <可编辑列表表格
        modalTitle="状态分布"
        addText="新增状态权重"
        dataSource={stateWeights}
        onChange={(next) => setDistributionProfiles({ ...distributionProfiles, stateWeights: next })}
        columns={[
          { title: "实体类型", dataIndex: "entityType", width: 180 },
          { title: "状态值", dataIndex: "status", width: 180 },
          { title: "权重", dataIndex: "weight", width: 100 },
        ]}
        fields={[
          { name: "entityType", label: "实体类型", required: true, placeholder: "如：sales_order" },
          { name: "status", label: "状态值", required: true, placeholder: "如：已成交" },
          { name: "weight", label: "权重", type: "number", required: true, min: 0, initialValue: 1 },
        ]}
      />
    </Space>
  );
}

export function RealismRulesStructuredEditor({ form }: { form: FormInstance }) {
  const [realismRules, setRealismRules] = useStructuredField<AnyRecord[]>(form, "realismRules", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="真实感规则" description="维护真实感检查点，后续会用于真实性校验和人工评审。" />
      <可编辑列表表格
        modalTitle="真实感规则"
        addText="新增真实感规则"
        dataSource={realismRules}
        onChange={setRealismRules}
        columns={[
          { title: "规则编码", dataIndex: "ruleCode", width: 160 },
          { title: "规则名称", dataIndex: "ruleName", width: 200 },
          { title: "目标类型", dataIndex: "targetType", width: 140 },
          { title: "严重级别", dataIndex: "severity", width: 100 },
          { title: "说明", dataIndex: "description" },
        ]}
        fields={[
          { name: "ruleCode", label: "规则编码", required: true },
          { name: "ruleName", label: "规则名称", required: true },
          { name: "targetType", label: "目标类型", required: true, type: "select", initialValue: "field", options: [{ label: "字段", value: "field" }, { label: "表", value: "table" }, { label: "场景", value: "scene" }] },
          { name: "severity", label: "严重级别", type: "select", initialValue: "medium", options: [{ label: "低", value: "low" }, { label: "中", value: "medium" }, { label: "高", value: "high" }] },
          { name: "description", label: "规则说明", type: "textarea", rows: 3, required: true },
        ]}
      />
    </Space>
  );
}

export function DirtyDataProfilesStructuredEditor({ form }: { form: FormInstance }) {
  const [dirtyDataProfiles, setDirtyDataProfiles] = useStructuredField<AnyRecord>(form, "dirtyDataProfiles", {});
  const injectionRules = Array.isArray(dirtyDataProfiles.injectionRules) ? dirtyDataProfiles.injectionRules : [];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="脏数据画像" description="维护脏数据开关、默认比例和注入规则，作为后续造数的脏数据来源。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="启用脏数据画像">
          <Switch checked={parse布尔值(dirtyDataProfiles.enabled)} onChange={(enabled) => setDirtyDataProfiles({ ...dirtyDataProfiles, enabled })} />
        </Form.Item>
        <Form.Item label="默认脏数据比例">
          <InputNumber style={{ width: "100%" }} min={0} max={1} step={0.01} value={Number(dirtyDataProfiles.defaultRatio || 0)} onChange={(value) => setDirtyDataProfiles({ ...dirtyDataProfiles, defaultRatio: Number(value || 0) })} />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="脏数据注入规则"
        addText="新增注入规则"
        dataSource={injectionRules}
        onChange={(next) => setDirtyDataProfiles({ ...dirtyDataProfiles, injectionRules: next })}
        columns={[
          { title: "表名", dataIndex: "tableName", width: 180 },
          { title: "字段名", dataIndex: "fieldName", width: 180 },
          { title: "异常类型", dataIndex: "dirtyType", width: 160 },
          { title: "比例", dataIndex: "ratio", width: 100 },
          { title: "示例值", dataIndex: "sampleValue" },
        ]}
        fields={[
          { name: "tableName", label: "表名", placeholder: "可不填写，留空代表全局生效" },
          { name: "fieldName", label: "字段名", required: true },
          { name: "dirtyType", label: "异常类型", required: true, placeholder: "如：空值、格式错误、越界值" },
          { name: "ratio", label: "比例", type: "number", required: true, min: 0, max: 1, step: 0.01, initialValue: 0.05 },
          { name: "sampleValue", label: "示例异常值" },
        ]}
      />
    </Space>
  );
}

export function TrainingAssetsStructuredEditor({ form }: { form: FormInstance }) {
  const [trainingAssets, setTrainingAssets] = useStructuredField<AnyRecord>(form, "trainingAssets", {});
  const samples = Array.isArray(trainingAssets.samples) ? trainingAssets.samples : [];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="训练资产" description="维护训练样本和经验备注，后续用于行业孵化和回归验证。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="训练备注">
          <Input.TextArea rows={3} value={String(trainingAssets.notes || "")} onChange={(event) => setTrainingAssets({ ...trainingAssets, notes: event.target.value })} />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="训练样本"
        addText="新增训练样本"
        dataSource={samples}
        onChange={(next) => setTrainingAssets({ ...trainingAssets, samples: next })}
        columns={[
          { title: "样本名称", dataIndex: "sampleName", width: 180 },
          { title: "场景名称", dataIndex: "sceneName", width: 180 },
          { title: "期望表", render: (_value, record) => <标签列表 values={record.expectedTables} /> },
          { title: "期望模块", render: (_value, record) => <标签列表 values={record.expectedModules} /> },
        ]}
        fields={[
          { name: "sampleName", label: "样本名称", required: true },
          { name: "sceneName", label: "场景名称", required: true },
          { name: "sceneDesc", label: "场景描述", type: "textarea", rows: 3 },
          { name: "knowledgeText", label: "知识文本", type: "textarea", rows: 5 },
          { name: "expectedTables", label: "期望表", type: "tags", placeholder: "输入表名后回车" },
          { name: "expectedModules", label: "期望模块", type: "tags", placeholder: "输入模块后回车" },
        ]}
      />
    </Space>
  );
}

export function EvaluationRubricStructuredEditor({ form }: { form: FormInstance }) {
  const [evaluationRubric, setEvaluationRubric] = useStructuredField<AnyRecord>(form, "evaluationRubric", {});
  const dimensions = Array.isArray(evaluationRubric.dimensions) ? evaluationRubric.dimensions : [];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="评估标准" description="维护评分维度和通过线，后续用于训练评估和质量判定。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="总通过分">
          <InputNumber style={{ width: "100%" }} min={0} max={100} value={Number(evaluationRubric.passScore || 0)} onChange={(value) => setEvaluationRubric({ ...evaluationRubric, passScore: Number(value || 0) })} />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="评分维度"
        addText="新增评分维度"
        dataSource={dimensions}
        onChange={(next) => setEvaluationRubric({ ...evaluationRubric, dimensions: next })}
        columns={[
          { title: "维度编码", dataIndex: "dimensionKey", width: 160 },
          { title: "维度名称", dataIndex: "dimensionLabel", width: 180 },
          { title: "权重", dataIndex: "weight", width: 100 },
          { title: "单项通过分", dataIndex: "passScore", width: 120 },
        ]}
        fields={[
          { name: "dimensionKey", label: "维度编码", required: true },
          { name: "dimensionLabel", label: "维度名称", required: true },
          { name: "weight", label: "权重", type: "number", required: true, min: 0, max: 100, initialValue: 10 },
          { name: "passScore", label: "单项通过分", type: "number", required: true, min: 0, max: 100, initialValue: 60 },
        ]}
      />
    </Space>
  );
}

export function OverridePoliciesStructuredEditor({ form }: { form: FormInstance }) {
  const [overridePolicies, setOverridePolicies] = useStructuredField<AnyRecord>(form, "overridePolicies", {});
  const fieldPolicies = Array.isArray(overridePolicies.fieldPolicies) ? overridePolicies.fieldPolicies : [];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="覆盖策略" description="维护能力包冲突时的合并和覆盖规则，后续用于多包叠加时的优先级控制。" />
      <Form layout="vertical" colon={false}>
        <Space style={{ width: "100%" }} size={16} align="start">
          <Form.Item label="合并策略" style={{ flex: 1 }}>
            <Select value={String(overridePolicies.mergeStrategy || "merge")} options={[{ label: "合并", value: "merge" }, { label: "覆盖", value: "replace" }, { label: "仅追加", value: "append" }]} onChange={(mergeStrategy) => setOverridePolicies({ ...overridePolicies, mergeStrategy })} />
          </Form.Item>
          <Form.Item label="冲突处理" style={{ flex: 1 }}>
            <Select value={String(overridePolicies.conflictPolicy || "high_priority_wins")} options={[{ label: "高优先级覆盖", value: "high_priority_wins" }, { label: "保留已有", value: "keep_existing" }, { label: "人工确认", value: "manual_review" }]} onChange={(conflictPolicy) => setOverridePolicies({ ...overridePolicies, conflictPolicy })} />
          </Form.Item>
        </Space>
        <Form.Item label="优先级顺序">
          <标签输入 value={Array.isArray(overridePolicies.priorityOrder) ? overridePolicies.priorityOrder : []} onChange={(priorityOrder) => setOverridePolicies({ ...overridePolicies, priorityOrder })} placeholder="如：profile、sub_scenario、industry、default" />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="字段级覆盖策略"
        addText="新增字段策略"
        dataSource={fieldPolicies}
        onChange={(next) => setOverridePolicies({ ...overridePolicies, fieldPolicies: next })}
        columns={[
          { title: "字段名", dataIndex: "fieldName", width: 220 },
          { title: "策略", dataIndex: "policy", width: 180 },
          { title: "说明", dataIndex: "note" },
        ]}
        fields={[
          { name: "fieldName", label: "字段名", required: true },
          { name: "policy", label: "策略", type: "select", required: true, initialValue: "replace", options: [{ label: "覆盖", value: "replace" }, { label: "追加", value: "append" }, { label: "禁止覆盖", value: "protect" }] },
          { name: "note", label: "说明", type: "textarea", rows: 2 },
        ]}
      />
    </Space>
  );
}

export function DictionariesStructuredEditor({ form }: { form: FormInstance }) {
  const [dictionaries, setDictionaries] = useStructuredField<AnyRecord[]>(form, "dictionaries", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="词库" description="维护行业词典和权重，保存后会参与词典值域和识别能力。" />
      <可编辑列表表格
        modalTitle="词库项"
        addText="新增词库项"
        dataSource={dictionaries}
        onChange={setDictionaries}
        columns={[
          { title: "词典类型", dataIndex: "dictType", width: 180 },
          { title: "编码", dataIndex: "itemCode", width: 180 },
          { title: "显示名称", dataIndex: "itemLabel", width: 180 },
          { title: "权重", dataIndex: "weight", width: 100 },
          { title: "状态", render: (_value, record) => record.status === "inactive" ? "停用" : "有效" },
        ]}
        fields={[
          { name: "dictType", label: "词典类型", required: true, placeholder: "如：city、payment_channel" },
          { name: "itemCode", label: "编码", required: true },
          { name: "itemLabel", label: "显示名称", required: true },
          { name: "weight", label: "权重", type: "number", required: true, min: 0, initialValue: 1 },
          { name: "sortOrder", label: "排序", type: "number", min: 0, initialValue: 0 },
          { name: "status", label: "状态", type: "select", initialValue: "active", options: 通用状态选项 },
        ]}
        normalize={(values) => ({
          dictType: values.dictType,
          itemCode: values.itemCode,
          itemLabel: values.itemLabel,
          itemValue: {},
          weight: Number(values.weight || 1),
          sortOrder: Number(values.sortOrder || 0),
          status: values.status || "active",
        })}
      />
    </Space>
  );
}

export function DistributionRulesStructuredEditor({ form }: { form: FormInstance }) {
  const [distributionRules, setDistributionRules] = useStructuredField<AnyRecord[]>(form, "distributionRules", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="分布规则" description="维护权重覆盖规则，保存后会参与行业分布控制。" />
      <可编辑列表表格
        modalTitle="分布规则"
        addText="新增分布规则"
        dataSource={distributionRules}
        onChange={setDistributionRules}
        columns={[
          { title: "规则类型", dataIndex: "ruleType", width: 160 },
          { title: "规则名称", dataIndex: "ruleName", width: 180 },
          { title: "规则编码", dataIndex: "ruleCode", width: 180 },
          { title: "权重项", render: (_value, record) => <标签列表 values={format权重项(record.ruleConfig?.weights || record.ruleConfig)} /> },
        ]}
        fields={[
          { name: "ruleType", label: "规则类型", required: true, placeholder: "如：vehicle_type_weights" },
          { name: "ruleName", label: "规则名称", required: true },
          { name: "ruleCode", label: "规则编码", required: true },
          { name: "weightItems", label: "权重项", type: "tags", placeholder: "格式：编码:权重，例如 suv:40" },
          { name: "status", label: "状态", type: "select", initialValue: "active", options: 通用状态选项 },
        ]}
        toFormValues={(record) => ({
          ruleType: record?.ruleType,
          ruleName: record?.ruleName,
          ruleCode: record?.ruleCode,
          weightItems: format权重项(record?.ruleConfig?.weights || record?.ruleConfig),
          status: record?.status || "active",
        })}
        normalize={(values) => ({
          ruleType: values.ruleType,
          ruleName: values.ruleName,
          ruleCode: values.ruleCode,
          ruleConfig: { weights: parse权重项(Array.isArray(values.weightItems) ? values.weightItems : []) },
          status: values.status || "active",
        })}
      />
    </Space>
  );
}

export function FieldRulesStructuredEditor({ form }: { form: FormInstance }) {
  const [fieldRules, setFieldRules] = useStructuredField<AnyRecord[]>(form, "fieldRules", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="字段规则" description="维护字段生成器和生成约束，保存后会参与字段值生成。" />
      <可编辑列表表格
        modalTitle="字段规则"
        addText="新增字段规则"
        dataSource={fieldRules}
        onChange={setFieldRules}
        columns={[
          { title: "表名", dataIndex: "tableName", width: 160 },
          { title: "字段名", dataIndex: "fieldName", width: 180 },
          { title: "生成器", dataIndex: "generatorType", width: 160 },
          { title: "示例样式", render: (_value, record) => 表格渲染(record.ruleConfig?.samplePattern || "-") },
        ]}
        fields={[
          { name: "tableName", label: "表名", placeholder: "可不填写，留空代表全局生效" },
          { name: "fieldName", label: "字段名", required: true },
          { name: "generatorType", label: "生成器类型", required: true, type: "select", options: [{ label: "文本", value: "text" }, { label: "编号", value: "code" }, { label: "枚举", value: "enum" }, { label: "时间", value: "datetime" }, { label: "金额", value: "amount" }] },
          { name: "samplePattern", label: "示例样式", placeholder: "如：SO202604040001" },
          { name: "nullRatio", label: "空值比例", type: "number", min: 0, max: 1, step: 0.01, initialValue: 0 },
          { name: "status", label: "状态", type: "select", initialValue: "active", options: 通用状态选项 },
        ]}
        toFormValues={(record) => ({
          tableName: record?.tableName,
          fieldName: record?.fieldName,
          generatorType: record?.generatorType,
          samplePattern: record?.ruleConfig?.samplePattern,
          nullRatio: record?.ruleConfig?.nullRatio ?? 0,
          status: record?.status || "active",
        })}
        normalize={(values) => ({
          tableName: values.tableName,
          fieldName: values.fieldName,
          generatorType: values.generatorType,
          ruleConfig: {
            samplePattern: values.samplePattern || "",
            nullRatio: Number(values.nullRatio || 0),
          },
          status: values.status || "active",
        })}
      />
    </Space>
  );
}

export function ComplianceRulesStructuredEditor({ form }: { form: FormInstance }) {
  const [complianceRules, setComplianceRules] = useStructuredField<AnyRecord[]>(form, "complianceRules", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="合规规则" description="维护字段级合规检查规则，保存后会参与质量扫描。" />
      <可编辑列表表格
        modalTitle="合规规则"
        addText="新增合规规则"
        dataSource={complianceRules}
        onChange={setComplianceRules}
        columns={[
          { title: "规则编码", dataIndex: "ruleCode", width: 160 },
          { title: "规则名称", dataIndex: "ruleName", width: 180 },
          { title: "表名", dataIndex: "tableName", width: 160 },
          { title: "字段名", dataIndex: "fieldName", width: 180 },
          { title: "级别", dataIndex: "severity", width: 100 },
        ]}
        fields={[
          { name: "ruleCode", label: "规则编码", required: true },
          { name: "ruleName", label: "规则名称", required: true },
          { name: "tableName", label: "表名", required: true },
          { name: "fieldName", label: "字段名", required: true },
          { name: "ruleType", label: "规则类型", required: true, placeholder: "如：regex、required、range" },
          { name: "ruleValue", label: "规则值", placeholder: "如：^1[3-9][0-9]{9}$" },
          { name: "issueCategory", label: "问题分类", initialValue: "合规性" },
          { name: "severity", label: "严重级别", type: "select", initialValue: "medium", options: [{ label: "低", value: "low" }, { label: "中", value: "medium" }, { label: "高", value: "high" }] },
          { name: "status", label: "状态", type: "select", initialValue: "active", options: 通用状态选项 },
        ]}
        toFormValues={(record) => ({
          ruleCode: record?.ruleCode,
          ruleName: record?.ruleName,
          tableName: record?.tableName,
          fieldName: record?.fieldName,
          ruleType: record?.ruleType,
          ruleValue: record?.ruleConfig?.value || record?.ruleConfig?.pattern || "",
          issueCategory: record?.issueCategory || "合规性",
          severity: record?.severity || "medium",
          status: record?.status || "active",
        })}
        normalize={(values) => ({
          ruleCode: values.ruleCode,
          ruleName: values.ruleName,
          tableName: values.tableName,
          fieldName: values.fieldName,
          ruleType: values.ruleType,
          ruleConfig: {
            value: values.ruleValue || "",
          },
          issueCategory: values.issueCategory || "合规性",
          severity: values.severity || "medium",
          status: values.status || "active",
        })}
      />
    </Space>
  );
}

export function PluginBindingsStructuredEditor({ form }: { form: FormInstance }) {
  const [pluginBindings, setPluginBindings] = useStructuredField<AnyRecord[]>(form, "pluginBindings", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="插件绑定" description="维护插件与行业能力包的绑定关系，保存后会参与场景画像增强。" />
      <可编辑列表表格
        modalTitle="插件绑定"
        addText="新增插件绑定"
        dataSource={pluginBindings}
        onChange={setPluginBindings}
        columns={[
          { title: "插件标识", dataIndex: "pluginKey", width: 180 },
          { title: "插件名称", dataIndex: "pluginName", width: 180 },
          { title: "绑定范围", dataIndex: "bindingScope", width: 120 },
          { title: "业务模块", render: (_value, record) => <标签列表 values={record.bindingConfig?.businessModules} /> },
        ]}
        fields={[
          { name: "pluginKey", label: "插件标识", required: true },
          { name: "pluginName", label: "插件名称", required: true },
          { name: "bindingScope", label: "绑定范围", type: "select", initialValue: "industry", options: [{ label: "行业级", value: "industry" }, { label: "子场景级", value: "sub_scenario" }, { label: "增强包级", value: "profile" }] },
          { name: "subtype", label: "业务子类型" },
          { name: "businessModules", label: "业务模块", type: "tags", placeholder: "输入模块编码后回车" },
          { name: "preferredCategories", label: "优先类别", type: "tags", placeholder: "输入类别后回车" },
          { name: "status", label: "状态", type: "select", initialValue: "active", options: 通用状态选项 },
        ]}
        toFormValues={(record) => ({
          pluginKey: record?.pluginKey,
          pluginName: record?.pluginName,
          bindingScope: record?.bindingScope || "industry",
          subtype: record?.bindingConfig?.subtype || "",
          businessModules: Array.isArray(record?.bindingConfig?.businessModules) ? record.bindingConfig.businessModules : [],
          preferredCategories: Array.isArray(record?.bindingConfig?.preferredCategories) ? record.bindingConfig.preferredCategories : [],
          status: record?.status || "active",
        })}
        normalize={(values) => ({
          pluginKey: values.pluginKey,
          pluginName: values.pluginName,
          bindingScope: values.bindingScope || "industry",
          bindingConfig: {
            subtype: values.subtype || "",
            businessModules: Array.isArray(values.businessModules) ? values.businessModules : [],
            preferredCategories: Array.isArray(values.preferredCategories) ? values.preferredCategories : [],
          },
          status: values.status || "active",
        })}
      />
    </Space>
  );
}

export function ExtendedRulesStructuredEditor({ form }: { form: FormInstance }) {
  const [extendedRules, setExtendedRules] = useStructuredField<AnyRecord[]>(form, "extendedRules", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="扩展规则" description="维护联动、时序、状态流和编码等补充规则，保存后会并入规则引擎。" />
      <可编辑列表表格
        modalTitle="扩展规则"
        addText="新增扩展规则"
        dataSource={extendedRules}
        onChange={setExtendedRules}
        columns={[
          { title: "规则分类", dataIndex: "ruleCategory", width: 120 },
          { title: "模块编码", dataIndex: "moduleKey", width: 160 },
          { title: "规则编码", dataIndex: "ruleCode", width: 160 },
          { title: "规则名称", dataIndex: "ruleName", width: 180 },
          { title: "表名", dataIndex: "tableName", width: 160 },
        ]}
        fields={[
          { name: "ruleCategory", label: "规则分类", type: "select", initialValue: "linkage", options: [{ label: "联动", value: "linkage" }, { label: "时序", value: "temporal" }, { label: "基数", value: "cardinality" }, { label: "状态流", value: "state_flow" }, { label: "编码", value: "code" }] },
          { name: "moduleKey", label: "模块编码", required: true },
          { name: "ruleCode", label: "规则编码", required: true },
          { name: "ruleName", label: "规则名称", required: true },
          { name: "industryScope", label: "行业范围" },
          { name: "sceneScope", label: "子场景范围" },
          { name: "tableName", label: "表名" },
          { name: "fieldName", label: "字段名" },
          { name: "description", label: "规则说明", type: "textarea", rows: 3 },
          { name: "sortOrder", label: "排序", type: "number", min: 0, initialValue: 0 },
          { name: "status", label: "状态", type: "select", initialValue: "active", options: 通用状态选项 },
        ]}
        toFormValues={(record) => ({
          ruleCategory: record?.ruleCategory,
          moduleKey: record?.moduleKey,
          ruleCode: record?.ruleCode,
          ruleName: record?.ruleName,
          industryScope: record?.industryScope,
          sceneScope: record?.sceneScope,
          tableName: record?.tableName,
          fieldName: record?.fieldName,
          description: record?.ruleConfig?.description || "",
          sortOrder: record?.sortOrder ?? 0,
          status: record?.status || "active",
        })}
        normalize={(values) => ({
          ruleCategory: values.ruleCategory,
          moduleKey: values.moduleKey,
          ruleCode: values.ruleCode,
          ruleName: values.ruleName,
          industryScope: values.industryScope || null,
          sceneScope: values.sceneScope || null,
          tableName: values.tableName || null,
          fieldName: values.fieldName || null,
          ruleConfig: {
            description: values.description || "",
          },
          sortOrder: Number(values.sortOrder || 0),
          status: values.status || "active",
        })}
      />
    </Space>
  );
}
