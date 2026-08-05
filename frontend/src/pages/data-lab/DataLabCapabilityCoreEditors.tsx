import { Form, Input, InputNumber, Select, Space, Switch } from "antd";
import type { FormInstance } from "antd";
import {
  AnyRecord,
  可编辑列表表格,
  parse布尔值,
  片段标题,
  useStructuredField,
  标签列表,
  标签输入,
  表格渲染,
} from "./DataLabCapabilityEditorCommon";

export function RecognitionStructuredEditor({ form }: { form: FormInstance }) {
  const [recognition, setRecognition] = useStructuredField<AnyRecord>(form, "recognition", {});
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="行业识别" description="维护别名、命中词、负例词和默认子场景，保存后会直接参与场景识别。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="行业别名">
          <标签输入 value={Array.isArray(recognition.aliases) ? recognition.aliases : []} onChange={(aliases) => setRecognition({ ...recognition, aliases })} placeholder="输入行业别名后回车" />
        </Form.Item>
        <Form.Item label="命中关键词">
          <标签输入 value={Array.isArray(recognition.keywords) ? recognition.keywords : []} onChange={(keywords) => setRecognition({ ...recognition, keywords })} placeholder="输入识别关键词后回车" />
        </Form.Item>
        <Form.Item label="排除关键词">
          <标签输入 value={Array.isArray(recognition.negativeKeywords) ? recognition.negativeKeywords : []} onChange={(negativeKeywords) => setRecognition({ ...recognition, negativeKeywords })} placeholder="输入负例词后回车" />
        </Form.Item>
        <Form.Item label="默认子场景">
          <Input value={String(recognition.defaultSubScenario || "")} onChange={(event) => setRecognition({ ...recognition, defaultSubScenario: event.target.value })} placeholder="例如：反洗钱整改闭环" />
        </Form.Item>
      </Form>
    </Space>
  );
}

export function ResearchCatalogStructuredEditor({ form }: { form: FormInstance }) {
  const [researchCatalog, setResearchCatalog] = useStructuredField<AnyRecord>(form, "researchCatalog", {});
  const richnessRules = researchCatalog.richnessRules && typeof researchCatalog.richnessRules === "object"
    ? researchCatalog.richnessRules as AnyRecord
    : {};
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="调研规划" description="维护行业对象、动作、结果、候选表和关系建议，保存后会并入自动调研结果。" />
      <Form layout="vertical" colon={false}>
        <Space style={{ width: "100%" }} size={16} align="start">
          <Form.Item label="行业展示名称" style={{ flex: 1 }}>
            <Input value={String(researchCatalog.industryLabel || "")} onChange={(event) => setResearchCatalog({ ...researchCatalog, industryLabel: event.target.value })} />
          </Form.Item>
          <Form.Item label="业务子域" style={{ flex: 1 }}>
            <Input value={String(researchCatalog.subdomain || "")} onChange={(event) => setResearchCatalog({ ...researchCatalog, subdomain: event.target.value })} />
          </Form.Item>
        </Space>
        <Form.Item label="业务对象">
          <标签输入 value={Array.isArray(researchCatalog.businessObjects) ? researchCatalog.businessObjects : []} onChange={(businessObjects) => setResearchCatalog({ ...researchCatalog, businessObjects })} placeholder="如：客户、门店、试驾车辆" />
        </Form.Item>
        <Form.Item label="业务动作">
          <标签输入 value={Array.isArray(researchCatalog.businessActions) ? researchCatalog.businessActions : []} onChange={(businessActions) => setResearchCatalog({ ...researchCatalog, businessActions })} placeholder="如：邀约、试驾、签约、交付" />
        </Form.Item>
        <Form.Item label="业务结果">
          <标签输入 value={Array.isArray(researchCatalog.businessResults) ? researchCatalog.businessResults : []} onChange={(businessResults) => setResearchCatalog({ ...researchCatalog, businessResults })} placeholder="如：成单、退款、整改完成" />
        </Form.Item>
        <Form.Item label="核心模块">
          <标签输入 value={Array.isArray(researchCatalog.canonicalModules) ? researchCatalog.canonicalModules : []} onChange={(canonicalModules) => setResearchCatalog({ ...researchCatalog, canonicalModules })} placeholder="如：线索管理、试驾管理、订单管理" />
        </Form.Item>
        <Form.Item label="候选表">
          <标签输入 value={Array.isArray(researchCatalog.candidateTables) ? researchCatalog.candidateTables : []} onChange={(candidateTables) => setResearchCatalog({ ...researchCatalog, candidateTables })} placeholder="如：sales_order、test_drive_appointment" />
        </Form.Item>
        <Form.Item label="建议字典表">
          <标签输入 value={Array.isArray(researchCatalog.dictSuggestions) ? researchCatalog.dictSuggestions : []} onChange={(dictSuggestions) => setResearchCatalog({ ...researchCatalog, dictSuggestions })} placeholder="如：vehicle_brand_dict" />
        </Form.Item>
        <Form.Item label="建议关系">
          <标签输入 value={Array.isArray(researchCatalog.relationSuggestions) ? researchCatalog.relationSuggestions : []} onChange={(relationSuggestions) => setResearchCatalog({ ...researchCatalog, relationSuggestions })} placeholder="如：customer_profile->sales_order" />
        </Form.Item>
        <Form.Item label="数据规则提示">
          <标签输入 value={Array.isArray(researchCatalog.dataRules) ? researchCatalog.dataRules : []} onChange={(dataRules) => setResearchCatalog({ ...researchCatalog, dataRules })} placeholder="如：订单金额随车型等级分层分布" />
        </Form.Item>
        <Form.Item label="合规提示">
          <标签输入 value={Array.isArray(researchCatalog.complianceHints) ? researchCatalog.complianceHints : []} onChange={(complianceHints) => setResearchCatalog({ ...researchCatalog, complianceHints })} placeholder="如：身份证号需要脱敏" />
        </Form.Item>
        <Space style={{ width: "100%" }} size={16} align="start">
          <Form.Item label="核心表最少数量" style={{ flex: 1 }}>
            <InputNumber style={{ width: "100%" }} min={0} value={Number(richnessRules.minCoreTables || 0)} onChange={(value) => setResearchCatalog({ ...researchCatalog, richnessRules: { ...richnessRules, minCoreTables: Number(value || 0) } })} />
          </Form.Item>
          <Form.Item label="关系最少数量" style={{ flex: 1 }}>
            <InputNumber style={{ width: "100%" }} min={0} value={Number(richnessRules.minRelationCount || 0)} onChange={(value) => setResearchCatalog({ ...researchCatalog, richnessRules: { ...richnessRules, minRelationCount: Number(value || 0) } })} />
          </Form.Item>
          <Form.Item label="字典表最少数量" style={{ flex: 1 }}>
            <InputNumber style={{ width: "100%" }} min={0} value={Number(richnessRules.minDictTables || 0)} onChange={(value) => setResearchCatalog({ ...researchCatalog, richnessRules: { ...richnessRules, minDictTables: Number(value || 0) } })} />
          </Form.Item>
        </Space>
        <Form.Item label="规划摘要">
          <Input.TextArea rows={4} value={String(researchCatalog.summary || "")} onChange={(event) => setResearchCatalog({ ...researchCatalog, summary: event.target.value })} />
        </Form.Item>
      </Form>
    </Space>
  );
}

export function ModulePlannerStructuredEditor({ form }: { form: FormInstance }) {
  const [modulePlanner, setModulePlanner] = useStructuredField<AnyRecord>(form, "modulePlanner", {});
  const modules = Array.isArray(modulePlanner.modules) ? modulePlanner.modules : [];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="模块规划" description="维护模块定义、关注表和期望表，保存后会参与模块规划与表设计引导。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="模块规划摘要">
          <Input.TextArea rows={3} value={String(modulePlanner.summary || "")} onChange={(event) => setModulePlanner({ ...modulePlanner, summary: event.target.value })} />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="模块定义"
        addText="新增模块"
        dataSource={modules}
        onChange={(next) => setModulePlanner({ ...modulePlanner, modules: next })}
        columns={[
          { title: "模块编码", dataIndex: "moduleKey", width: 180 },
          { title: "模块名称", dataIndex: "moduleLabel", width: 180 },
          { title: "关注表", render: (_value, record) => <标签列表 values={record.focusTables} /> },
          { title: "期望表", render: (_value, record) => <标签列表 values={record.expectedTables} /> },
        ]}
        fields={[
          { name: "moduleKey", label: "模块编码", required: true, placeholder: "如：sales_order_flow" },
          { name: "moduleLabel", label: "模块名称", required: true, placeholder: "如：销售订单流程" },
          { name: "summary", label: "模块说明", type: "textarea", rows: 3 },
          { name: "focusTables", label: "关注表", type: "tags", placeholder: "输入表名后回车" },
          { name: "expectedTables", label: "期望表", type: "tags", placeholder: "输入表名后回车" },
          { name: "hints", label: "规划提示词", type: "tags", placeholder: "输入提示词后回车" },
        ]}
      />
    </Space>
  );
}

export function SchemaGuidesStructuredEditor({ form }: { form: FormInstance }) {
  const [schemaGuides, setSchemaGuides] = useStructuredField<AnyRecord>(form, "schemaGuides", {});
  const requiredFieldsByTable = schemaGuides.requiredFieldsByTable && typeof schemaGuides.requiredFieldsByTable === "object"
    ? schemaGuides.requiredFieldsByTable as Record<string, unknown>
    : {};
  const tableRows = Object.entries(requiredFieldsByTable).map(([tableName, fields]) => ({
    tableName,
    fields: Array.isArray(fields) ? fields : [],
  }));

  function 保存按表必备字段(rows: AnyRecord[]) {
    const next = rows.reduce<Record<string, string[]>>((result, item) => {
      const tableName = String(item.tableName || "").trim();
      if (!tableName) return result;
      result[tableName] = Array.isArray(item.fields) ? item.fields.map(String).filter(Boolean) : [];
      return result;
    }, {});
    setSchemaGuides({ ...schemaGuides, requiredFieldsByTable: next });
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="表设计约束" description="维护公共必备字段、按表必备字段、禁用字段和审计字段开关，保存后会参与表设计。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="公共必备字段">
          <标签输入 value={Array.isArray(schemaGuides.commonRequiredFields) ? schemaGuides.commonRequiredFields : []} onChange={(commonRequiredFields) => setSchemaGuides({ ...schemaGuides, commonRequiredFields })} placeholder="如：created_at、updated_at" />
        </Form.Item>
        <Form.Item label="需要地区字段的表">
          <标签输入 value={Array.isArray(schemaGuides.regionFieldTables) ? schemaGuides.regionFieldTables : []} onChange={(regionFieldTables) => setSchemaGuides({ ...schemaGuides, regionFieldTables })} placeholder="如：sales_store、delivery_record" />
        </Form.Item>
        <Form.Item label="禁用字段模式">
          <标签输入 value={Array.isArray(schemaGuides.forbiddenFieldPatterns) ? schemaGuides.forbiddenFieldPatterns : []} onChange={(forbiddenFieldPatterns) => setSchemaGuides({ ...schemaGuides, forbiddenFieldPatterns })} placeholder="如：^ext_field_" />
        </Form.Item>
        <Form.Item label="自动补审计字段">
          <Switch checked={parse布尔值(schemaGuides.requireAuditFields)} onChange={(requireAuditFields) => setSchemaGuides({ ...schemaGuides, requireAuditFields })} />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="按表必备字段"
        addText="新增表约束"
        dataSource={tableRows}
        onChange={保存按表必备字段}
        columns={[
          { title: "表名", dataIndex: "tableName", width: 220 },
          { title: "必备字段", render: (_value, record) => <标签列表 values={record.fields} /> },
        ]}
        fields={[
          { name: "tableName", label: "表名", required: true, placeholder: "如：sales_order" },
          { name: "fields", label: "必备字段", type: "tags", placeholder: "输入字段名后回车" },
        ]}
      />
    </Space>
  );
}

export function RelationPatternsStructuredEditor({ form }: { form: FormInstance }) {
  const [relationPatterns, setRelationPatterns] = useStructuredField<AnyRecord[]>(form, "relationPatterns", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="关系模式" description="维护标准主从关系，保存后会参与关系推导和外键补全。" />
      <可编辑列表表格
        modalTitle="关系模式"
        addText="新增关系"
        dataSource={relationPatterns}
        onChange={setRelationPatterns}
        columns={[
          { title: "主表", dataIndex: "fromTable", width: 180 },
          { title: "主键字段", dataIndex: "fromField", width: 150 },
          { title: "从表", dataIndex: "toTable", width: 180 },
          { title: "外键字段", dataIndex: "toField", width: 150 },
          { title: "关系类型", dataIndex: "relationType", width: 100 },
        ]}
        fields={[
          { name: "fromTable", label: "主表", required: true },
          { name: "fromField", label: "主键字段" },
          { name: "toTable", label: "从表", required: true },
          { name: "toField", label: "外键字段" },
          { name: "relationType", label: "关系类型", type: "select", initialValue: "1:N", options: [{ label: "一对多", value: "1:N" }, { label: "一对一", value: "1:1" }, { label: "多对多", value: "N:M" }] },
        ]}
      />
    </Space>
  );
}

export function CodeRulesStructuredEditor({ form }: { form: FormInstance }) {
  const [codeRules, setCodeRules] = useStructuredField<AnyRecord[]>(form, "codeRules", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="编码规则" description="维护关键业务编号规则，保存后会补进表设计。" />
      <可编辑列表表格
        modalTitle="编码规则"
        addText="新增编码规则"
        dataSource={codeRules}
        onChange={setCodeRules}
        columns={[
          { title: "表名", dataIndex: "tableName", width: 180 },
          { title: "字段名", dataIndex: "fieldName", width: 180 },
          { title: "规则名称", dataIndex: "ruleName", width: 220 },
          { title: "正则/样式", render: (_value, record) => 表格渲染(record.ruleConfig?.pattern || record.pattern || "-") },
        ]}
        fields={[
          { name: "tableName", label: "表名", required: true },
          { name: "fieldName", label: "字段名", required: true },
          { name: "ruleName", label: "规则名称", required: true, placeholder: "如：销售订单号规则" },
          { name: "pattern", label: "正则/样式", placeholder: "如：SO[0-9]{8}" },
          { name: "prefix", label: "编号前缀", placeholder: "如：SO" },
        ]}
        toFormValues={(record) => ({
          tableName: record?.tableName,
          fieldName: record?.fieldName || record?.ruleConfig?.targetField,
          ruleName: record?.ruleName,
          pattern: record?.ruleConfig?.pattern || record?.pattern,
          prefix: record?.ruleConfig?.prefix,
        })}
        normalize={(values) => ({
          tableName: values.tableName,
          fieldName: values.fieldName,
          ruleName: values.ruleName,
          ruleConfig: {
            targetField: values.fieldName,
            pattern: values.pattern || "",
            prefix: values.prefix || "",
          },
          status: "active",
        })}
      />
    </Space>
  );
}

export function StateMachinesStructuredEditor({ form }: { form: FormInstance }) {
  const [stateMachines, setStateMachines] = useStructuredField<AnyRecord[]>(form, "stateMachines", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="状态机" description="维护状态字段、允许状态和状态副作用，保存后会进入状态流转规则。" />
      <可编辑列表表格
        modalTitle="状态机规则"
        addText="新增状态机"
        dataSource={stateMachines}
        onChange={setStateMachines}
        columns={[
          { title: "规则编码", dataIndex: "ruleCode", width: 160 },
          { title: "规则名称", dataIndex: "ruleName", width: 180 },
          { title: "表名", dataIndex: "tableName", width: 160 },
          { title: "状态字段", dataIndex: "stateField", width: 160 },
          { title: "允许状态", render: (_value, record) => <标签列表 values={record.allowedStates} /> },
        ]}
        fields={[
          { name: "moduleKey", label: "模块编码", placeholder: "如：sales_order_flow" },
          { name: "ruleCode", label: "规则编码", required: true },
          { name: "ruleName", label: "规则名称", required: true },
          { name: "tableName", label: "表名", required: true },
          { name: "stateField", label: "状态字段", required: true },
          { name: "allowedStates", label: "允许状态", type: "tags", placeholder: "如：待跟进、已邀约、已成单" },
          { name: "effects", label: "状态副作用", type: "tags", placeholder: "如：已签约->生成订单" },
          { name: "sortOrder", label: "排序", type: "number", min: 0, initialValue: 0 },
        ]}
        toFormValues={(record) => ({
          moduleKey: record?.moduleKey,
          ruleCode: record?.ruleCode,
          ruleName: record?.ruleName,
          tableName: record?.tableName,
          stateField: record?.stateField || record?.fieldName,
          allowedStates: Array.isArray(record?.allowedStates) ? record.allowedStates : [],
          effects: Array.isArray(record?.stateEffects?.notes) ? record.stateEffects.notes : [],
          sortOrder: record?.sortOrder ?? 0,
        })}
        normalize={(values) => ({
          moduleKey: values.moduleKey || "capability_state_machine",
          ruleCode: values.ruleCode,
          ruleName: values.ruleName,
          tableName: values.tableName,
          stateField: values.stateField,
          allowedStates: Array.isArray(values.allowedStates) ? values.allowedStates : [],
          stateEffects: {
            notes: Array.isArray(values.effects) ? values.effects : [],
          },
          sortOrder: Number(values.sortOrder || 0),
          status: "active",
        })}
      />
    </Space>
  );
}

export function FieldSemanticsStructuredEditor({ form }: { form: FormInstance }) {
  const [fieldSemantics, setFieldSemantics] = useStructuredField<AnyRecord[]>(form, "fieldSemantics", []);
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="字段语义" description="维护字段类型、注释和主外键语义，保存后会参与字段补全。" />
      <可编辑列表表格
        modalTitle="字段语义"
        addText="新增字段语义"
        dataSource={fieldSemantics}
        onChange={setFieldSemantics}
        columns={[
          { title: "表名", dataIndex: "tableName", width: 160 },
          { title: "字段名", dataIndex: "fieldName", width: 180 },
          { title: "字段类型", dataIndex: "fieldType", width: 120 },
          { title: "业务语义", dataIndex: "businessSemantic", width: 160 },
          { title: "字段说明", dataIndex: "fieldComment" },
        ]}
        fields={[
          { name: "tableName", label: "表名", required: true },
          { name: "fieldName", label: "字段名", required: true },
          { name: "fieldType", label: "字段类型", required: true, type: "select", options: ["BIGINT", "INT", "VARCHAR", "TEXT", "DATETIME", "DATE", "DECIMAL(18,2)", "JSON"].map((value) => ({ label: value, value })) },
          { name: "fieldLength", label: "长度", type: "number", min: 0 },
          { name: "fieldComment", label: "字段说明", required: true },
          { name: "businessSemantic", label: "业务语义", placeholder: "如：客户手机号、订单编号" },
          { name: "nullable", label: "允许为空", type: "switch", initialValue: true },
          { name: "uniqueKey", label: "唯一键", type: "switch", initialValue: false },
          { name: "primaryKey", label: "主键", type: "switch", initialValue: false },
          { name: "foreignKey", label: "外键", type: "switch", initialValue: false },
          { name: "foreignRefTable", label: "关联主表" },
          { name: "foreignRefField", label: "关联字段" },
        ]}
      />
    </Space>
  );
}

export function ValueCorporaStructuredEditor({ form }: { form: FormInstance }) {
  const [valueCorpora, setValueCorpora] = useStructuredField<AnyRecord>(form, "valueCorpora", {});
  const entries = Array.isArray(valueCorpora.entries) ? valueCorpora.entries : [];
  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="行业词料" description="维护字段专属值域，保存后会优先用于字段值生成。" />
      <可编辑列表表格
        modalTitle="行业词料"
        addText="新增词料"
        dataSource={entries}
        onChange={(next) => setValueCorpora({ ...valueCorpora, entries: next })}
        columns={[
          { title: "表名", dataIndex: "tableName", width: 180 },
          { title: "字段名", dataIndex: "fieldName", width: 180 },
          { title: "词料值", render: (_value, record) => <标签列表 values={record.values} /> },
        ]}
        fields={[
          { name: "tableName", label: "表名", placeholder: "为空表示全局字段词料" },
          { name: "fieldName", label: "字段名", required: true },
          { name: "values", label: "词料值", type: "tags", placeholder: "如：比亚迪、蔚来、小鹏" },
        ]}
      />
    </Space>
  );
}

export function QualityGatesStructuredEditor({ form }: { form: FormInstance }) {
  const [qualityGates, setQualityGates] = useStructuredField<AnyRecord>(form, "qualityGates", {});
  const roleRows = Object.entries(qualityGates.requiredBusinessRoles && typeof qualityGates.requiredBusinessRoles === "object" ? qualityGates.requiredBusinessRoles : {})
    .map(([role, minCount]) => ({ role, minCount: Number(minCount || 0) }));

  function 保存角色要求(rows: AnyRecord[]) {
    const next = rows.reduce<Record<string, number>>((result, item) => {
      const role = String(item.role || "").trim();
      if (!role) return result;
      result[role] = Number(item.minCount || 0);
      return result;
    }, {});
    setQualityGates({ ...qualityGates, requiredBusinessRoles: next });
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <片段标题 title="质量门禁" description="维护必备表、最少字段数和脏数据上限，保存后会进入质量报告打分。" />
      <Form layout="vertical" colon={false}>
        <Form.Item label="必备表">
          <标签输入 value={Array.isArray(qualityGates.requiredTables) ? qualityGates.requiredTables : []} onChange={(requiredTables) => setQualityGates({ ...qualityGates, requiredTables })} placeholder="如：customer_profile、sales_order" />
        </Form.Item>
        <Space style={{ width: "100%" }} size={16} align="start">
          <Form.Item label="每表最少字段数" style={{ flex: 1 }}>
            <InputNumber style={{ width: "100%" }} min={0} value={Number(qualityGates.minFieldCount || 0)} onChange={(value) => setQualityGates({ ...qualityGates, minFieldCount: Number(value || 0) })} />
          </Form.Item>
          <Form.Item label="最少关系数" style={{ flex: 1 }}>
            <InputNumber style={{ width: "100%" }} min={0} value={Number(qualityGates.minRelations || 0)} onChange={(value) => setQualityGates({ ...qualityGates, minRelations: Number(value || 0) })} />
          </Form.Item>
          <Form.Item label="最少字典表数" style={{ flex: 1 }}>
            <InputNumber style={{ width: "100%" }} min={0} value={Number(qualityGates.minDictTables || 0)} onChange={(value) => setQualityGates({ ...qualityGates, minDictTables: Number(value || 0) })} />
          </Form.Item>
        </Space>
        <Form.Item label="脏数据最大占比">
          <InputNumber style={{ width: "100%" }} min={0} max={1} step={0.01} value={Number(qualityGates.maxDirtyRate || 0)} onChange={(value) => setQualityGates({ ...qualityGates, maxDirtyRate: Number(value || 0) })} />
        </Form.Item>
        <Form.Item label="禁用字段模式">
          <标签输入 value={Array.isArray(qualityGates.forbiddenFieldPatterns) ? qualityGates.forbiddenFieldPatterns : []} onChange={(forbiddenFieldPatterns) => setQualityGates({ ...qualityGates, forbiddenFieldPatterns })} placeholder="如：^tmp_|^ext_field_" />
        </Form.Item>
      </Form>
      <可编辑列表表格
        modalTitle="业务角色门禁"
        addText="新增角色要求"
        dataSource={roleRows}
        onChange={保存角色要求}
        columns={[
          { title: "业务角色", dataIndex: "role", width: 220 },
          { title: "最少表数量", dataIndex: "minCount", width: 140 },
        ]}
        fields={[
          { name: "role", label: "业务角色", required: true, placeholder: "如：customer、order、store" },
          { name: "minCount", label: "最少表数量", type: "number", required: true, min: 0, initialValue: 1 },
        ]}
      />
    </Space>
  );
}
