import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import {
  createLabDataSource,
  deleteLabDataSource,
  deployBusinessSystemInstancePhysicalModel,
  fetchBusinessSystemInstances,
  fetchBusinessSystemInstancePhysicalVersions,
  fetchLabDataSourceColumns,
  fetchLabDataSourceSampleRows,
  fetchLabDataSourceTables,
  fetchLabDataSources,
  generateBusinessSystemInstanceGenerationPlan,
  testLabDataSourceConnection,
  updateLabDataSource,
  type LabBusinessSystemGenerationPlanGeneratePayload,
} from "../../services/dataLab";
import type {
  DataSourceColumn,
  DataSourceRecord,
  DataSourceSampleRow,
  DataSourceTable,
  LabBusinessSystemInstanceRecord,
  LabBusinessSystemPhysicalModelVersionRecord,
} from "../../types/api";
import {
  buildConnectionConfigFromForm,
  DATABASE_SOURCE_TYPE_OPTIONS,
  DATASOURCE_CODE_PATTERN,
  getApiFieldErrorMessage,
  getApiFieldErrors,
  getDefaultPort,
  isScenarioDatabaseSource,
  normalizeDatasourceCode,
  normalizeDatasourceType,
  toScenarioDbType,
} from "../../utils/datasource";

const sourceTypeOptions = [
  ...DATABASE_SOURCE_TYPE_OPTIONS,
  { value: "gaussdb", label: "GaussDB" },
  { value: "jdbc", label: "JDBC" },
  { value: "hive", label: "Hive" },
  { value: "kafka", label: "Kafka" },
  { value: "other", label: "Other" },
];

const defaultPorts: Record<string, number> = {
  mysql: 3306,
  postgresql: 5432,
  gaussdb: 5432,
  jdbc: 0,
  hive: 10000,
  kafka: 9092,
  other: 0,
};

type ScenarioDbType = "mysql" | "postgresql";

type PhysicalVersionOption = {
  label: string;
  value: number;
  disabled?: boolean;
};

type DeployFormValues = {
  instanceId?: number;
  physicalVersionNo?: number;
  summary?: string;
};

type LoadFormValues = LabBusinessSystemGenerationPlanGeneratePayload & {
  instanceId?: number;
  physicalVersionNo?: number;
};

function formatLocalDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function getConnectionStatusMeta(status?: DataSourceRecord["connectionStatus"]) {
  switch (status) {
    case "online":
      return { color: "green", label: "在线" };
    case "offline":
      return { color: "red", label: "离线" };
    case "disabled":
      return { color: "default", label: "已停用" };
    default:
      return { color: "gold", label: "未探测" };
  }
}

function getConfigStatusMeta(status?: string) {
  return status === "active" ? { color: "green", label: "启用" } : { color: "default", label: "停用" };
}

function normalizeConnectionConfig(values: Record<string, unknown>) {
  return buildConnectionConfigFromForm(values);
}

function normalizeScenarioDbType(value?: string | null): ScenarioDbType {
  return String(value || "").trim().toLowerCase() === "postgres" || String(value || "").trim().toLowerCase() === "postgresql"
    ? "postgresql"
    : "mysql";
}

function getScenarioSourceDbType(record?: DataSourceRecord | null): ScenarioDbType | null {
  if (!record || !isScenarioDatabaseSource(record)) {
    return null;
  }
  return toScenarioDbType(record);
}

function buildPhysicalVersionOptions(
  versions: LabBusinessSystemPhysicalModelVersionRecord[],
  sourceDbType: ScenarioDbType | null
): PhysicalVersionOption[] {
  return versions.map((item) => {
    const versionDbType = normalizeScenarioDbType(item.dbType);
    const mismatch = Boolean(sourceDbType && versionDbType !== sourceDbType);
    return {
      value: item.versionNo,
      disabled: mismatch,
      label: `V${item.versionNo} / ${versionDbType.toUpperCase()}${mismatch ? " / 数据库类型不匹配" : ""}`,
    };
  });
}

const datasourceCodeRules = [
  { required: true, whitespace: true, message: "请输入编码" },
  { min: 2, message: "编码至少 2 个字符" },
  { pattern: DATASOURCE_CODE_PATTERN, message: "编码仅支持字母、数字和下划线" },
];

export function DataLabSourcesPage() {
  const { token } = useAuth();
  const [form] = Form.useForm();
  const [deployForm] = Form.useForm<DeployFormValues>();
  const [loadForm] = Form.useForm<LoadFormValues>();
  const currentSourceType = Form.useWatch("sourceType", form);
  const selectedDeployInstanceId = Form.useWatch("instanceId", deployForm);
  const selectedLoadInstanceId = Form.useWatch("instanceId", loadForm);
  const jdbcMode = normalizeDatasourceType(currentSourceType) === "jdbc";

  const [records, setRecords] = useState<DataSourceRecord[]>([]);
  const [instances, setInstances] = useState<LabBusinessSystemInstanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataSourceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sourceCodeCustomized, setSourceCodeCustomized] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDataSource, setPreviewDataSource] = useState<DataSourceRecord | null>(null);
  const [previewTables, setPreviewTables] = useState<DataSourceTable[]>([]);
  const [previewTableName, setPreviewTableName] = useState("");
  const [previewColumns, setPreviewColumns] = useState<DataSourceColumn[]>([]);
  const [previewRows, setPreviewRows] = useState<DataSourceSampleRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployVersionOptions, setDeployVersionOptions] = useState<PhysicalVersionOption[]>([]);
  const [loadingDeployVersions, setLoadingDeployVersions] = useState(false);
  const [selectedDeploySource, setSelectedDeploySource] = useState<DataSourceRecord | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loadVersionOptions, setLoadVersionOptions] = useState<PhysicalVersionOption[]>([]);
  const [loadingLoadVersions, setLoadingLoadVersions] = useState(false);
  const [selectedLoadSource, setSelectedLoadSource] = useState<DataSourceRecord | null>(null);

  const deployableInstanceOptions = useMemo(
    () =>
      instances.map((item) => ({
        label: `${item.instanceName} (${item.instanceCode})`,
        value: item.id,
      })),
    [instances]
  );

  function applyFormFieldErrors(error: unknown) {
    const fields = Object.entries(getApiFieldErrors(error))
      .filter(([, errors]) => Array.isArray(errors) && errors.length > 0)
      .map(([name, errors]) => ({
        name,
        errors: (errors || []).map((item) => String(item)),
      }));

    if (fields.length === 0) {
      return false;
    }

    form.setFields(fields);
    return true;
  }

  async function loadData(options?: { silent?: boolean; background?: boolean }) {
    if (!token) return;
    if (!options?.background) setLoading(true);
    try {
      const response = await fetchLabDataSources(token, { includeConnectivity: true });
      setRecords(response.data);
    } catch (error: any) {
      if (!options?.silent) {
        message.error(`加载数据源失败: ${error.message || "未知错误"}`);
      }
    } finally {
      if (!options?.background) setLoading(false);
    }
  }

  async function loadInstances(options?: { silent?: boolean }) {
    if (!token) return;
    setLoadingInstances(true);
    try {
      const response = await fetchBusinessSystemInstances(token);
      setInstances(response.data);
    } catch (error: any) {
      if (!options?.silent) {
        message.error(`加载业务实例失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setLoadingInstances(false);
    }
  }

  useEffect(() => {
    void loadData();
    void loadInstances({ silent: true });
  }, [token]);

  function resetModal() {
    form.resetFields();
    setEditingRecord(null);
    setTestResult(null);
    setSourceCodeCustomized(false);
  }

  function closeModal() {
    setOpen(false);
    resetModal();
  }

  function resetDeployModal() {
    setDeployOpen(false);
    setSelectedDeploySource(null);
    setDeployVersionOptions([]);
    deployForm.resetFields();
  }

  function resetLoadModal() {
    setLoadOpen(false);
    setSelectedLoadSource(null);
    setLoadVersionOptions([]);
    loadForm.resetFields();
  }

  function openCreateModal() {
    resetModal();
    form.setFieldsValue({
      sourceType: "postgresql",
      ownerName: "数据建模",
      status: "active",
      port: getDefaultPort("postgresql"),
    });
    setOpen(true);
  }

  function openEditModal(record: DataSourceRecord) {
    resetModal();
    setEditingRecord(record);
    setSourceCodeCustomized(true);
    form.setFieldsValue({
      sourceName: record.sourceName,
      sourceCode: record.sourceCode,
      sourceType: record.sourceType,
      ownerName: record.ownerName,
      status: record.status,
      host: record.connectionConfig?.host,
      port: record.connectionConfig?.port ?? defaultPorts[record.sourceType] ?? getDefaultPort(record.sourceType),
      databaseName: record.connectionConfig?.database,
      username: record.connectionConfig?.username,
      password: record.connectionConfig?.password,
      jdbcUrl: record.connectionConfig?.jdbcUrl,
      schema: record.connectionConfig?.schema,
      driverClassName: record.connectionConfig?.driverClassName,
    });
    setOpen(true);
  }

  function openDeployModal(record: DataSourceRecord) {
    if (!isScenarioDatabaseSource(record)) {
      message.warning("仅支持已启用的 MySQL / PostgreSQL 数据源部署物理模型");
      return;
    }
    setSelectedDeploySource(record);
    deployForm.resetFields();
    deployForm.setFieldsValue({ summary: "" });
    setDeployVersionOptions([]);
    setDeployOpen(true);
    if (instances.length === 0) {
      void loadInstances();
    }
  }

  function openLoadModal(record: DataSourceRecord) {
    if (!isScenarioDatabaseSource(record)) {
      message.warning("仅支持已启用的 MySQL / PostgreSQL 数据源装载样本数据");
      return;
    }
    setSelectedLoadSource(record);
    loadForm.resetFields();
    loadForm.setFieldsValue({
      initialDataVolume: 1000,
      incrementalDataVolume: 100,
      incrementCycleDays: 1,
      sampleRowsPerTable: 5,
      timelineDays: 30,
      timelineStartAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      summary: "",
    });
    setLoadVersionOptions([]);
    setLoadOpen(true);
    if (instances.length === 0) {
      void loadInstances();
    }
  }

  function handleSourceCodeBlur() {
    form.setFieldValue("sourceCode", normalizeDatasourceCode(form.getFieldValue("sourceCode")));
  }

  function handleFormValuesChange(changedValues: Record<string, unknown>) {
    if ("sourceType" in changedValues) {
      form.setFieldValue("port", defaultPorts[String(changedValues.sourceType)] ?? getDefaultPort(changedValues.sourceType));
      if (normalizeDatasourceType(changedValues.sourceType) !== "jdbc") {
        form.setFieldsValue({
          jdbcUrl: undefined,
          schema: undefined,
          driverClassName: undefined,
        });
      }
    }

    if ("sourceCode" in changedValues) {
      setSourceCodeCustomized(true);
      if (form.getFieldError("sourceCode").length > 0) {
        form.setFields([{ name: "sourceCode", errors: [] }]);
      }
    }

    if ("sourceName" in changedValues && !editingRecord && !sourceCodeCustomized) {
      form.setFieldValue("sourceCode", normalizeDatasourceCode(changedValues.sourceName));
      if (form.getFieldError("sourceCode").length > 0) {
        form.setFields([{ name: "sourceCode", errors: [] }]);
      }
    }
  }

  async function loadPreviewData(record: DataSourceRecord, tableName: string) {
    if (!token) return;
    if (normalizeDatasourceType(record.sourceType) === "ftp") {
      const rowsResponse = await fetchLabDataSourceSampleRows(token, record.id, tableName);
      setPreviewRows(rowsResponse.data);
      setPreviewColumns(inferColumnsFromRows(rowsResponse.data));
      return;
    }
    const [columnsResponse, rowsResponse] = await Promise.all([
      fetchLabDataSourceColumns(token, record.id, tableName),
      fetchLabDataSourceSampleRows(token, record.id, tableName),
    ]);
    setPreviewColumns(columnsResponse.data);
    setPreviewRows(rowsResponse.data);
  }

  function inferColumnsFromRows(rows: DataSourceSampleRow[]): DataSourceColumn[] {
    const firstRow = rows.find((row) => row && typeof row === "object");
    if (!firstRow) return [];
    return Object.keys(firstRow).map((columnName, index) => ({
      columnName,
      ordinalPosition: index + 1,
      dataType: "string",
      columnType: "string",
      isNullable: true,
      isPrimaryKey: false,
      columnComment: "",
    }));
  }

  async function openPreviewModal(record: DataSourceRecord) {
    if (!token) return;
    setPreviewDataSource(record);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewTables([]);
    setPreviewTableName("");
    setPreviewColumns([]);
    setPreviewRows([]);
    try {
      const tablesResponse = await fetchLabDataSourceTables(token, record.id);
      const tables = tablesResponse.data;
      setPreviewTables(tables);
      const nextTable = tables[0]?.tableName || "";
      setPreviewTableName(nextTable);
      if (nextTable) {
        await loadPreviewData(record, nextTable);
      }
    } catch (error: any) {
      message.error(`加载预览数据失败: ${error.message || "未知错误"}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePreviewTableChange(tableName: string) {
    if (!previewDataSource) return;
    setPreviewTableName(tableName);
    setPreviewLoading(true);
    try {
      await loadPreviewData(previewDataSource, tableName);
    } catch (error: any) {
      message.error(`加载表预览失败: ${error.message || "未知错误"}`);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadPhysicalVersionsForModal(params: {
    instanceId?: number;
    source: DataSourceRecord | null;
    formRef: typeof deployForm | typeof loadForm;
    setOptions: (options: PhysicalVersionOption[]) => void;
    setLoadingState: (value: boolean) => void;
    errorTitle: string;
  }) {
    if (!token || !params.instanceId) {
      params.setOptions([]);
      params.formRef.setFieldValue("physicalVersionNo", undefined);
      return;
    }

    params.setLoadingState(true);
    try {
      const response = await fetchBusinessSystemInstancePhysicalVersions(token, Number(params.instanceId));
      const options = buildPhysicalVersionOptions(response.data, getScenarioSourceDbType(params.source));
      params.setOptions(options);
      const currentValue = Number(params.formRef.getFieldValue("physicalVersionNo") || 0);
      const hasCurrent = options.some((item) => item.value === currentValue && !item.disabled);
      if (!hasCurrent) {
        params.formRef.setFieldValue("physicalVersionNo", options.find((item) => !item.disabled)?.value);
      }
    } catch (error: any) {
      params.setOptions([]);
      params.formRef.setFieldValue("physicalVersionNo", undefined);
      message.error(`${params.errorTitle}: ${error.message || "未知错误"}`);
    } finally {
      params.setLoadingState(false);
    }
  }

  useEffect(() => {
    if (!deployOpen) {
      return;
    }
    void loadPhysicalVersionsForModal({
      instanceId: selectedDeployInstanceId,
      source: selectedDeploySource,
      formRef: deployForm,
      setOptions: setDeployVersionOptions,
      setLoadingState: setLoadingDeployVersions,
      errorTitle: "加载物理模型版本失败",
    });
  }, [deployForm, deployOpen, selectedDeployInstanceId, selectedDeploySource, token]);

  useEffect(() => {
    if (!loadOpen) {
      return;
    }
    void loadPhysicalVersionsForModal({
      instanceId: selectedLoadInstanceId,
      source: selectedLoadSource,
      formRef: loadForm,
      setOptions: setLoadVersionOptions,
      setLoadingState: setLoadingLoadVersions,
      errorTitle: "加载可装载物理版本失败",
    });
  }, [loadForm, loadOpen, selectedLoadInstanceId, selectedLoadSource, token]);

  async function handleTestConnection() {
    if (!token) return;
    try {
      const values = (await form.validateFields(["sourceType", "host", "port", "databaseName", "username", "password", "jdbcUrl", "schema", "driverClassName"])) as Record<string, unknown>;
      setTesting(true);
      setTestResult(null);
      const response = await testLabDataSourceConnection(token, {
        sourceType: values.sourceType,
        connectionConfig: normalizeConnectionConfig(values),
      });
      setTestResult(response.data);
      if (response.data.success) {
        message.success(response.data.message);
      } else {
        message.error(response.data.message);
      }
    } catch (error: any) {
      if (error?.errorFields) {
        message.error("请补全连接信息后再测试");
      } else {
        message.error(`测试连接失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;

    let values: Record<string, unknown>;
    try {
      values = (await form.validateFields()) as Record<string, unknown>;
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`表单校验失败: ${error?.message || "未知错误"}`);
      }
      return;
    }

    const payload = {
      sourceName: String(values.sourceName ?? "").trim(),
      sourceCode: String(values.sourceCode ?? "").trim(),
      sourceType: values.sourceType,
      ownerName: String(values.ownerName ?? "").trim(),
      status: values.status,
      connectionConfig: normalizeConnectionConfig(values),
    };

    setSubmitting(true);
    try {
      if (editingRecord) {
        await updateLabDataSource(token, editingRecord.id, payload);
        message.success("数据源更新成功");
      } else {
        await createLabDataSource(token, payload);
        message.success("数据源创建成功");
      }
      closeModal();
      await loadData();
    } catch (error: any) {
      const actionText = editingRecord ? "更新" : "创建";
      const errorMessage = getApiFieldErrorMessage(error, "未知错误");
      if (applyFormFieldErrors(error)) {
        message.error(errorMessage);
      } else {
        message.error(`${actionText}失败: ${errorMessage}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeploySubmit(values: DeployFormValues) {
    if (!token || !selectedDeploySource || !values.instanceId || !values.physicalVersionNo) {
      return;
    }
    setDeploying(true);
    try {
      const response = await deployBusinessSystemInstancePhysicalModel(token, Number(values.instanceId), {
        physicalVersionNo: Number(values.physicalVersionNo),
        targetDataSourceId: selectedDeploySource.id,
        summary: values.summary,
      });
      message.success(`物理模型已部署: V${response.data.version?.versionNo || values.physicalVersionNo}`);
      resetDeployModal();
      await Promise.all([loadData({ background: true }), loadInstances({ silent: true })]);
    } catch (error: any) {
      message.error(`部署模型失败: ${error.message || "未知错误"}`);
    } finally {
      setDeploying(false);
    }
  }

  async function handleLoadDataSubmit(values: LoadFormValues) {
    if (!token || !selectedLoadSource || !values.instanceId || !values.physicalVersionNo) {
      return;
    }
    setLoadingData(true);
    try {
      const response = await generateBusinessSystemInstanceGenerationPlan(token, Number(values.instanceId), {
        physicalVersionNo: Number(values.physicalVersionNo),
        targetDataSourceId: selectedLoadSource.id,
        initialDataVolume: values.initialDataVolume,
        incrementalDataVolume: values.incrementalDataVolume,
        incrementCycleDays: values.incrementCycleDays,
        sampleRowsPerTable: values.sampleRowsPerTable,
        timelineStartAt: values.timelineStartAt,
        timelineDays: values.timelineDays,
        summary: values.summary,
      });
      message.success(`样本数据装载完成: V${response.data.version?.versionNo || "-"}`);
      resetLoadModal();
      await Promise.all([loadData({ background: true }), loadInstances({ silent: true })]);
    } catch (error: any) {
      message.error(`装载数据失败: ${error.message || "未知错误"}`);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleDelete(record: DataSourceRecord) {
    if (!token) return;
    setDeletingId(record.id);
    try {
      await deleteLabDataSource(token, record.id);
      message.success("数据源删除成功");
      await loadData();
    } catch (error: any) {
      message.error(`删除失败: ${error.message || "未知错误"}`);
    } finally {
      setDeletingId(null);
    }
  }

  function renderScenarioAction(record: DataSourceRecord, label: string, onClick: () => void) {
    if (isScenarioDatabaseSource(record)) {
      return (
        <Button type="link" onClick={onClick}>
          {label}
        </Button>
      );
    }
    return (
      <Tooltip title="仅支持已启用的 MySQL / PostgreSQL 数据源">
        <Button type="link" disabled>
          {label}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Row justify="end" align="middle">
        <Col>
          <Space>
            <Button onClick={() => void Promise.all([loadData(), loadInstances({ silent: true })])} loading={loading || loadingInstances}>
              刷新状态
            </Button>
            <Button type="primary" onClick={openCreateModal}>
              添加数据源
            </Button>
          </Space>
        </Col>
      </Row>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={records}
          pagination={{ pageSize: 6 }}
          columns={[
            { title: "名称", dataIndex: "sourceName", key: "sourceName" },
            { title: "编码", dataIndex: "sourceCode", key: "sourceCode" },
            { title: "类型", dataIndex: "sourceType", key: "sourceType" },
            { title: "负责人", dataIndex: "ownerName", key: "ownerName" },
            {
              title: "配置状态",
              dataIndex: "status",
              key: "status",
              render: (value: string) => {
                const meta = getConfigStatusMeta(value);
                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              title: "连通状态",
              key: "connectionStatus",
              render: (_: unknown, record) => {
                const meta = getConnectionStatusMeta(record.connectionStatus);
                return (
                  <Space direction="vertical" size={0}>
                    <Tag color={meta.color}>{meta.label}</Tag>
                    {record.lastCheckedAt ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {formatLocalDateTime(record.lastCheckedAt)}
                      </Typography.Text>
                    ) : null}
                    {record.connectionMessage ? (
                      <Tooltip title={record.connectionMessage}>
                        <Typography.Text type="secondary" ellipsis style={{ maxWidth: 240, display: "inline-block", fontSize: 12 }}>
                          {record.connectionMessage}
                        </Typography.Text>
                      </Tooltip>
                    ) : null}
                  </Space>
                );
              },
            },
            { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", render: formatLocalDateTime },
            {
              title: "操作",
              key: "actions",
              render: (_: unknown, record) => (
                <Space size="small" wrap>
                  <Button type="link" onClick={() => openEditModal(record)}>
                    编辑
                  </Button>
                  <Button type="link" onClick={() => void openPreviewModal(record)}>
                    预览数据
                  </Button>
                  {renderScenarioAction(record, "部署模型", () => openDeployModal(record))}
                  {renderScenarioAction(record, "装载数据", () => openLoadModal(record))}
                  <Popconfirm title="确认删除该数据源？" onConfirm={() => void handleDelete(record)}>
                    <Button type="link" danger loading={deletingId === record.id}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editingRecord ? "编辑数据源" : "新建数据源"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
        width={760}
        footer={[
          <Button key="test" onClick={() => void handleTestConnection()} loading={testing}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={closeModal}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {editingRecord ? "保存" : "创建"}
          </Button>,
        ]}
      >
        <Form layout="vertical" form={form} onValuesChange={handleFormValuesChange}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceName" label="数据源名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sourceCode" label="数据源编码" rules={datasourceCodeRules}>
                <Input onBlur={handleSourceCodeBlur} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceType" label="数据源类型" rules={[{ required: true, message: "请选择类型" }]}>
                <Select options={sourceTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="配置状态" rules={[{ required: true, message: "请选择状态" }]}>
                <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
            连接信息
          </Typography.Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="host" label="主机地址" rules={jdbcMode ? [] : [{ required: true, message: "请输入主机地址" }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="port" label="端口" rules={jdbcMode ? [] : [{ required: true, message: "请输入端口" }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="databaseName" label="数据库">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="用户名">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="password" label="密码">
                <Input.Password />
              </Form.Item>
            </Col>
            {jdbcMode ? (
              <Col span={12}>
                <Form.Item name="schema" label="Schema">
                  <Input placeholder="public" />
                </Form.Item>
              </Col>
            ) : null}
          </Row>
          {jdbcMode ? (
            <>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="jdbcUrl" label="JDBC URL" rules={[{ required: true, message: "请输入 JDBC URL" }]}>
                    <Input placeholder="jdbc:postgresql://host:5432/db" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="driverClassName" label="Driver Class">
                    <Input placeholder="org.postgresql.Driver" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : null}
          {testResult ? <Alert message={testResult.message} type={testResult.success ? "success" : "error"} showIcon style={{ marginTop: 16 }} /> : null}
        </Form>
      </Modal>

      <Modal
        open={previewOpen}
        title={`样例数据预览${previewDataSource ? ` - ${previewDataSource.sourceName}` : ""}`}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        width={1200}
      >
        <Space direction="vertical" size={16} style={{ display: "flex" }}>
          <Select
            value={previewTableName || undefined}
            placeholder="请选择要预览的表"
            options={previewTables.map((item) => ({ label: item.tableComment ? `${item.tableName} (${item.tableComment})` : item.tableName, value: item.tableName }))}
            onChange={(value) => void handlePreviewTableChange(value)}
          />
          <Table
            rowKey={(_, index) => String(index)}
            loading={previewLoading}
            dataSource={previewRows}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 960 }}
            columns={previewColumns.map((column) => ({
              title: column.columnName,
              dataIndex: column.columnName,
              key: column.columnName,
              render: (value: unknown) => (value === null || value === undefined || value === "" ? "-" : String(value)),
            }))}
          />
        </Space>
      </Modal>

      <Modal
        open={deployOpen}
        title="部署物理模型"
        onCancel={resetDeployModal}
        onOk={() => void deployForm.submit()}
        confirmLoading={deploying}
        destroyOnHidden
        width={720}
      >
        <Form form={deployForm} layout="vertical" onFinish={(values) => void handleDeploySubmit(values)}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="部署会按所选物理模型重建目标表结构"
            description="系统会在当前数据源中创建或替换同名表。只有数据库类型一致的物理模型版本才允许部署。"
          />
          <Form.Item label="目标数据源">
            <Input
              disabled
              value={selectedDeploySource ? `${selectedDeploySource.sourceName} (${selectedDeploySource.sourceCode}) / ${String(getScenarioSourceDbType(selectedDeploySource) || "").toUpperCase()}` : ""}
            />
          </Form.Item>
          <Form.Item name="instanceId" label="业务实例" rules={[{ required: true, message: "请选择业务实例" }]}>
            <Select showSearch optionFilterProp="label" loading={loadingInstances} options={deployableInstanceOptions} />
          </Form.Item>
          <Form.Item name="physicalVersionNo" label="物理模型版本" rules={[{ required: true, message: "请选择物理模型版本" }]}>
            <Select loading={loadingDeployVersions} options={deployVersionOptions} placeholder="请选择与当前数据源类型一致的版本" />
          </Form.Item>
          <Form.Item name="summary" label="部署说明">
            <Input placeholder="例如：部署到 PostgreSQL 测试库，重建电商零售物理表结构" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={loadOpen}
        title="装载样本数据"
        onCancel={resetLoadModal}
        onOk={() => void loadForm.submit()}
        confirmLoading={loadingData}
        destroyOnHidden
        width={720}
      >
        <Form form={loadForm} layout="vertical" onFinish={(values) => void handleLoadDataSubmit(values)}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="从当前数据源直接装载样本数据"
            description="目标数据源已固定为当前数据源。仅允许选择数据库类型一致的物理模型版本，装载参数用于控制数据规模和时间范围。"
          />
          <Form.Item label="目标数据源">
            <Input
              disabled
              value={selectedLoadSource ? `${selectedLoadSource.sourceName} (${selectedLoadSource.sourceCode}) / ${String(getScenarioSourceDbType(selectedLoadSource) || "").toUpperCase()}` : ""}
            />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Form.Item name="instanceId" label="业务实例" rules={[{ required: true, message: "请选择业务实例" }]}>
              <Select showSearch optionFilterProp="label" loading={loadingInstances} options={deployableInstanceOptions} />
            </Form.Item>
            <Form.Item name="physicalVersionNo" label="物理模型版本" rules={[{ required: true, message: "请选择物理模型版本" }]}>
              <Select loading={loadingLoadVersions} options={loadVersionOptions} placeholder="请选择与当前数据源类型一致的版本" />
            </Form.Item>
            <Form.Item name="sampleRowsPerTable" label="每表样本行数" rules={[{ required: true, message: "请输入样本行数" }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="initialDataVolume" label="初始数据总量" rules={[{ required: true, message: "请输入初始数据总量" }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="incrementalDataVolume" label="周期增量总量" rules={[{ required: true, message: "请输入周期增量总量" }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="incrementCycleDays" label="增量周期(天)" rules={[{ required: true, message: "请输入增量周期" }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="timelineDays" label="时间跨度(天)" rules={[{ required: true, message: "请输入时间跨度" }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="timelineStartAt" label="时间起点">
              <Input placeholder="YYYY-MM-DD" />
            </Form.Item>
          </div>
          <Form.Item name="summary" label="装载说明">
            <Input placeholder="例如：装载 1000 条初始样本，按 30 天时间线写入当前 PostgreSQL 数据源" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
