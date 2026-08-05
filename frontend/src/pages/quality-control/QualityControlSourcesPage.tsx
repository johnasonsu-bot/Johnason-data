import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Transfer,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TransferItem } from "antd/es/transfer";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";
import { StatusTag } from "../../components/ui/StatusTag";
import { testDataSourceConnection } from "../../services/platform";
import {
  createQualitySource,
  deleteQualitySource,
  fetchQualitySourceMonitor,
  fetchQualitySourceTables,
  fetchQualitySources,
  saveQualitySourceMonitor,
  updateQualitySource,
  type QualityMonitorSourcePayload,
  type QualitySourcePayload,
} from "../../services/qualityControl";
import type { DataSourceTable, QualityMonitorSourceRecord } from "../../types/api";
import {
  buildConnectionConfigFromForm,
  DATABASE_SOURCE_TYPE_OPTIONS,
  DATASOURCE_CODE_PATTERN,
  getApiFieldErrorMessage,
  getDefaultPort,
  normalizeDatasourceCode,
  normalizeDatasourceType,
} from "../../utils/datasource";

type MonitorFormValues = QualityMonitorSourcePayload;

type QualitySourceFormValues = {
  sourceName?: string;
  sourceCode?: string;
  sourceType?: string;
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  password?: string;
  schema?: string;
  jdbcUrl?: string;
  driverClassName?: string;
  status?: "active" | "inactive";
};

const sourceTypeOptions = [
  ...DATABASE_SOURCE_TYPE_OPTIONS,
  { value: "gaussdb", label: "GaussDB" },
  { value: "jdbc", label: "JDBC" },
  { value: "hive", label: "Hive" },
  { value: "api", label: "API" },
  { value: "sftp", label: "SFTP" },
  { value: "kafka", label: "Kafka" },
  { value: "other", label: "其他" },
];

function getScopeLabel(value?: string) {
  return value === "manual" ? "手工选表" : "全表纳管";
}

export function QualityControlSourcesPage() {
  const { token, user } = useAuth();
  const [monitorForm] = Form.useForm<MonitorFormValues>();
  const [sourceForm] = Form.useForm<QualitySourceFormValues>();
  const tableScope = (Form.useWatch("scopeMode", monitorForm) as MonitorFormValues["scopeMode"] | undefined) || "all";
  const selectedTables = (Form.useWatch("selectedTables", monitorForm) as string[] | undefined) || [];
  const currentSourceType = Form.useWatch("sourceType", sourceForm) || "postgresql";
  const jdbcMode = normalizeDatasourceType(currentSourceType) === "jdbc";

  const [records, setRecords] = useState<QualityMonitorSourceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [currentSource, setCurrentSource] = useState<QualityMonitorSourceRecord | null>(null);
  const [tableOptions, setTableOptions] = useState<DataSourceTable[]>([]);

  const [sourceOpen, setSourceOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<QualityMonitorSourceRecord | null>(null);
  const [sourceSubmitting, setSourceSubmitting] = useState(false);
  const [sourceTesting, setSourceTesting] = useState(false);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchQualitySources(token);
      setRecords(response.data);
    } catch (error: any) {
      message.error(error.message || "加载质量数据源失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    if (!sourceOpen || editingSource) return;
    const nextPort = getDefaultPort(currentSourceType);
    if (nextPort > 0) {
      sourceForm.setFieldValue("port", nextPort);
    }
  }, [currentSourceType, editingSource, sourceForm, sourceOpen]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return records;
    return records.filter((item) =>
      `${item.sourceName} ${item.sourceCode} ${item.sourceType}`.toLowerCase().includes(normalizedKeyword)
    );
  }, [keyword, records]);

  const transferDataSource = useMemo<TransferItem[]>(
    () => tableOptions.map((item) => ({
      key: item.tableName,
      title: item.tableName,
      description: item.tableComment || "",
    })),
    [tableOptions],
  );

  const kpis = useMemo(() => {
    const monitoredCount = records.filter((item) => item.id).length;
    const selectedTableCount = records.reduce((sum, item) => sum + Number(item.selectedTableCount || 0), 0);
    const databaseTableCount = records.reduce((sum, item) => sum + Number(item.databaseTableCount || 0), 0);
    const submittedStrategyCount = records.reduce((sum, item) => sum + Number(item.submittedStrategyCount || 0), 0);

    return [
      { key: "databaseTables", title: "数据库表数量", value: databaseTableCount, icon: <DatabaseOutlined /> },
      { key: "monitored", title: "已纳管数据源", value: monitoredCount, icon: <SettingOutlined /> },
      { key: "selected", title: "已选表数", value: selectedTableCount, icon: <DatabaseOutlined /> },
      { key: "submitted", title: "提交策略数量", value: submittedStrategyCount, icon: <ReloadOutlined /> },
    ];
  }, [records]);

  function resetSourceModal() {
    setSourceOpen(false);
    setEditingSource(null);
    sourceForm.resetFields();
  }

  function openCreateSourceModal() {
    setEditingSource(null);
    sourceForm.resetFields();
    sourceForm.setFieldsValue({
      sourceType: "postgresql",
      port: getDefaultPort("postgresql"),
      status: "active",
    });
    setSourceOpen(true);
  }

  function openEditSourceModal(record: QualityMonitorSourceRecord) {
    setEditingSource(record);
    sourceForm.resetFields();
    sourceForm.setFieldsValue({
      sourceName: record.sourceName,
      sourceCode: record.sourceCode,
      sourceType: record.sourceType,
      host: String(record.connectionConfig?.host || ""),
      port: Number(record.connectionConfig?.port || getDefaultPort(record.sourceType)),
      databaseName: String(record.connectionConfig?.database || ""),
      username: String(record.connectionConfig?.username || ""),
      password: String(record.connectionConfig?.password || ""),
      schema: String(record.connectionConfig?.schema || ""),
      jdbcUrl: String(record.connectionConfig?.jdbcUrl || ""),
      driverClassName: String(record.connectionConfig?.driverClassName || ""),
      status: record.status === "inactive" ? "inactive" : "active",
    });
    setSourceOpen(true);
  }

  async function handleTestConnection() {
    if (!token) return;
    try {
      const values = await sourceForm.validateFields();
      setSourceTesting(true);
      const response = await testDataSourceConnection(token, {
        sourceType: values.sourceType,
        connectionConfig: buildConnectionConfigFromForm(values as Record<string, unknown>),
      });
      message.success(response.data.message || "连接测试成功");
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiFieldErrorMessage(error, "连接测试失败"));
    } finally {
      setSourceTesting(false);
    }
  }

  async function handleSaveSource() {
    if (!token) return;
    try {
      const values = await sourceForm.validateFields();
      const payload: QualitySourcePayload = {
        sourceName: String(values.sourceName || "").trim(),
        sourceCode: normalizeDatasourceCode(values.sourceCode || ""),
        sourceType: String(values.sourceType || ""),
        status: values.status || "active",
        ownerName: user?.displayName || user?.username || "system",
        connectionConfig: buildConnectionConfigFromForm(values as Record<string, unknown>),
      };
      setSourceSubmitting(true);
      if (editingSource) {
        await updateQualitySource(token, editingSource.sourceId, payload);
        message.success("质量数据源已更新");
      } else {
        await createQualitySource(token, payload);
        message.success("质量数据源已创建");
      }
      resetSourceModal();
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(getApiFieldErrorMessage(error, "保存质量数据源失败"));
    } finally {
      setSourceSubmitting(false);
    }
  }

  async function openMonitorConfig(record: QualityMonitorSourceRecord) {
    if (!token) return;
    setCurrentSource(record);
    setConfigOpen(true);
    setTableLoading(true);
    try {
      const [monitorResponse, tablesResponse] = await Promise.all([
        fetchQualitySourceMonitor(token, record.sourceId),
        fetchQualitySourceTables(token, record.sourceId),
      ]);
      setTableOptions(tablesResponse.data);
      const monitor = monitorResponse.data.monitorSource;
      monitorForm.setFieldsValue({
        scopeMode: monitor?.scopeMode || "all",
        selectedTables: monitor?.selectedTables || [],
        detailTableName: monitor?.detailTableName || "medata_quality_issue_detail",
        statsTableName: monitor?.statsTableName || "medata_quality_issue_stats",
        status: monitor?.status === "inactive" ? "inactive" : "active",
      });
    } catch (error: any) {
      message.error(error.message || "加载监控范围配置失败");
    } finally {
      setTableLoading(false);
    }
  }

  async function handleSubmit() {
    if (!token || !currentSource) return;
    try {
      const values = await monitorForm.validateFields();
      setSubmitting(true);
      await saveQualitySourceMonitor(token, currentSource.sourceId, values);
      message.success("监控范围已保存");
      setConfigOpen(false);
      setCurrentSource(null);
      setTableOptions([]);
      monitorForm.resetFields();
      await loadData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || "保存监控范围失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSource(sourceId: number) {
    if (!token) return;
    try {
      await deleteQualitySource(token, sourceId);
      message.success("质量数据源已删除");
      await loadData();
    } catch (error: any) {
      const references = Array.isArray(error?.details?.references) ? error.details.references : [];
      if (references.length > 0) {
        const referenceText = references
          .map((item: any) => `${item.taskName || item.taskCode || "未命名任务"}${item.taskCode ? `（${item.taskCode}）` : ""}`)
          .join("、");
        message.error(`数据源仍被任务引用，无法删除：${referenceText}`);
        return;
      }
      message.error(getApiFieldErrorMessage(error, "删除质量数据源失败"));
    }
  }

  const columns: ColumnsType<QualityMonitorSourceRecord> = [
    { title: "数据源名称", dataIndex: "sourceName", key: "sourceName", width: 220, ellipsis: true },
    { title: "数据源编码", dataIndex: "sourceCode", key: "sourceCode", width: 150, ellipsis: true },
    { title: "类型", dataIndex: "sourceType", key: "sourceType", width: 100 },
    {
      title: "监控范围",
      key: "scopeMode",
      width: 100,
      render: (_value, record) => (record.id ? getScopeLabel(record.scopeMode) : "-"),
    },
    {
      title: "数据库表数量",
      dataIndex: "databaseTableCount",
      key: "databaseTableCount",
      width: 100,
      render: (value) => (value === null || value === undefined ? "-" : Number(value)),
    },
    {
      title: "已选表数",
      key: "selectedTableCount",
      width: 90,
      render: (_value, record) => (record.scopeMode === "all" ? "全部" : Number(record.selectedTableCount || 0)),
    },
    {
      title: "提交策略数量",
      dataIndex: "submittedStrategyCount",
      key: "submittedStrategyCount",
      width: 110,
      render: (value) => Number(value || 0),
    },
    {
      title: "操作",
      key: "actions",
      width: 240,
      render: (_value, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEditSourceModal(record)}>
            编辑数据源
          </Button>
          <Button type="link" onClick={() => void openMonitorConfig(record)}>
            维护监控范围
          </Button>
          <Popconfirm
            title={record.sourceDomain === "quality" ? "确认删除该质量数据源？" : "历史共享数据源暂不支持直接删除"}
            disabled={record.sourceDomain !== "quality"}
            onConfirm={() => void handleDeleteSource(record.sourceId)}
          >
            <Button type="link" danger icon={<DeleteOutlined />} disabled={record.sourceDomain !== "quality"}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <PageToolbar
        left={(
          <Input.Search
            allowClear
            className="toolbar-search"
            placeholder="搜索数据源名称、编码或类型"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        )}
        right={(
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateSourceModal}>
              新建数据源
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              刷新
            </Button>
          </Space>
        )}
      />

      <div className="app-page-body">
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {kpis.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} />
          ))}
        </div>

        <DataTableCard<QualityMonitorSourceRecord>
          title="质量数据源目录"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 条</Typography.Text>}
          tableProps={{
            rowKey: "sourceId",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1080 },
          }}
        />
      </div>

      <Modal
        open={sourceOpen}
        title={editingSource ? "编辑质量数据源" : "新建质量数据源"}
        onCancel={resetSourceModal}
        onOk={() => void handleSaveSource()}
        confirmLoading={sourceSubmitting}
        width={760}
        destroyOnHidden
        footer={[
          <Button key="test" onClick={() => void handleTestConnection()} loading={sourceTesting}>测试连接</Button>,
          <Button key="cancel" onClick={resetSourceModal}>取消</Button>,
          <Button key="submit" type="primary" onClick={() => void handleSaveSource()} loading={sourceSubmitting}>保存</Button>,
        ]}
      >
        <Form form={sourceForm} layout="vertical">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            <Form.Item name="sourceName" label="数据源名称" rules={[{ required: true, message: "请输入数据源名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="sourceCode"
              label="数据源编码"
              rules={[
                { required: true, whitespace: true, message: "请输入数据源编码" },
                { min: 2, message: "编码至少 2 个字符" },
                { pattern: DATASOURCE_CODE_PATTERN, message: "编码仅支持字母数字下划线" },
              ]}
              normalize={(value) => normalizeDatasourceCode(value)}
            >
              <Input />
            </Form.Item>
            <Form.Item name="sourceType" label="类型" rules={[{ required: true, message: "请选择数据源类型" }]}>
              <Select options={sourceTypeOptions} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} />
            </Form.Item>
          </div>

          {jdbcMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Form.Item name="jdbcUrl" label="JDBC URL" rules={[{ required: true, message: "请输入 JDBC URL" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="driverClassName" label="驱动类">
                <Input />
              </Form.Item>
              <Form.Item name="username" label="用户名">
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码">
                <Input.Password />
              </Form.Item>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <Form.Item name="host" label="主机地址" rules={[{ required: true, message: "请输入主机地址" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="port" label="端口">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="databaseName" label="数据库" rules={[{ required: true, message: "请输入数据库名称" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="schema" label="Schema">
                <Input />
              </Form.Item>
              <Form.Item name="username" label="用户名">
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码">
                <Input.Password />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        open={configOpen}
        title={currentSource ? `监控范围配置 - ${currentSource.sourceName}` : "监控范围配置"}
        onCancel={() => {
          setConfigOpen(false);
          setCurrentSource(null);
          setTableOptions([]);
          monitorForm.resetFields();
        }}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={1100}
        destroyOnHidden
      >
        <Form form={monitorForm} layout="vertical">
          <Space align="start" size={16} style={{ width: "100%" }} wrap>
            <Form.Item name="scopeMode" label="监控范围" style={{ minWidth: 180 }}>
              <Select
                options={[
                  { label: "全表纳管", value: "all" },
                  { label: "手工选表", value: "manual" },
                ]}
              />
            </Form.Item>

            <Form.Item name="detailTableName" label="问题明细表" style={{ minWidth: 260 }}>
              <Input />
            </Form.Item>

            <Form.Item name="statsTableName" label="问题统计表" style={{ minWidth: 260 }}>
              <Input />
            </Form.Item>

            <Form.Item name="status" label="状态" style={{ minWidth: 120 }}>
              <Select
                options={[
                  { label: "启用", value: "active" },
                  { label: "停用", value: "inactive" },
                ]}
              />
            </Form.Item>
          </Space>

          {tableScope === "manual" ? (
            <Form.Item
              name="selectedTables"
              label={`手工选表${selectedTables.length ? `（已选 ${selectedTables.length} 张）` : ""}`}
              rules={[{ required: true, message: "请至少选择一张表" }]}
            >
              <Transfer
                dataSource={transferDataSource}
                targetKeys={selectedTables}
                onChange={(nextTargetKeys) => monitorForm.setFieldValue("selectedTables", nextTargetKeys)}
                titles={["可选表", "已选表"]}
                showSearch
                oneWay
                disabled={tableLoading}
                listStyle={{ width: 440, height: 360 }}
                render={(item) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{item.title}</Typography.Text>
                    {item.description ? <Typography.Text type="secondary">{item.description}</Typography.Text> : null}
                  </Space>
                )}
                filterOption={(inputValue, item) =>
                  `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(inputValue.toLowerCase())
                }
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
