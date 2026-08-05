import {
  ApiOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { DataTableCard } from "../../components/ui/DataTableCard";
import { FormSection } from "../../components/ui/FormSection";
import { PageToolbar } from "../../components/ui/PageToolbar";
import { StatCard } from "../../components/ui/StatCard";
import { StatusTag } from "../../components/ui/StatusTag";
import {
  createReportingDataSource,
  deleteReportingDataSource,
  fetchReportingDataSources,
  testReportingDataSourceConnection,
  updateReportingDataSource,
} from "../../services/reporting";
import type { ReportingDataSourceRecord } from "../../types/api";
import {
  buildConnectionConfigFromForm,
  DATABASE_SOURCE_TYPE_OPTIONS,
  DATASOURCE_CODE_PATTERN,
  getDefaultPort,
  normalizeDatasourceCode,
  normalizeDatasourceType,
} from "../../utils/datasource";

const sourceTypeOptions = [
  ...DATABASE_SOURCE_TYPE_OPTIONS,
  { value: "gaussdb", label: "GaussDB" },
  { value: "hive", label: "Hive" },
  { value: "jdbc", label: "JDBC" },
];

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function ReportingDataSourcesPage() {
  const { token } = useAuth();
  const [form] = Form.useForm();
  const sourceType = Form.useWatch("sourceType", form);
  const jdbcMode = normalizeDatasourceType(sourceType) === "jdbc";

  const [records, setRecords] = useState<ReportingDataSourceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReportingDataSourceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  async function loadData() {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetchReportingDataSources(token);
      setRecords(response.data || []);
    } catch (error: any) {
      message.error(`加载报表数据源失败: ${error.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token]);

  const filteredRecords = useMemo(() => records.filter((item) => {
    const matchedKeyword = !keyword || `${item.sourceName} ${item.sourceCode} ${item.ownerName}`.toLowerCase().includes(keyword.toLowerCase());
    const matchedStatus = !statusFilter || item.status === statusFilter;
    return matchedKeyword && matchedStatus;
  }), [keyword, records, statusFilter]);

  const kpiItems = useMemo(() => [
    { key: "total", title: "报表数据源", value: records.length, icon: <DatabaseOutlined />, description: "独立存储，不与其他模块共用连接" },
    { key: "active", title: "启用中", value: records.filter((item) => item.status === "active").length, icon: <ApiOutlined />, description: "当前可用于报表开发的连接" },
    { key: "dataset", title: "已关联数据集", value: records.reduce((sum, item) => sum + Number(item.datasetCount || 0), 0), icon: <ReloadOutlined />, description: "报表数据集引用总量" },
  ], [records]);

  function resetModal() {
    form.resetFields();
    setEditingRecord(null);
    setTestResult(null);
  }

  function closeModal() {
    setOpen(false);
    resetModal();
  }

  function openCreateModal() {
    resetModal();
    form.setFieldsValue({
      sourceType: "mysql",
      ownerName: "报表平台主管",
      status: "active",
      port: getDefaultPort("mysql"),
    });
    setOpen(true);
  }

  function openEditModal(record: ReportingDataSourceRecord) {
    resetModal();
    setEditingRecord(record);
    form.setFieldsValue({
      sourceName: record.sourceName,
      sourceCode: record.sourceCode,
      sourceType: record.sourceType,
      ownerName: record.ownerName,
      status: record.status,
      host: record.connectionConfig?.host,
      port: record.connectionConfig?.port || getDefaultPort(record.sourceType),
      databaseName: record.connectionConfig?.database,
      username: record.connectionConfig?.username,
      password: record.connectionConfig?.password,
      jdbcUrl: record.connectionConfig?.jdbcUrl,
      schema: record.connectionConfig?.schema,
      driverClassName: record.connectionConfig?.driverClassName,
    });
    setOpen(true);
  }

  async function handleTestConnection() {
    if (!token) return;
    try {
      const values = await form.validateFields(["sourceType", "host", "port", "databaseName", "username", "password", "jdbcUrl", "schema", "driverClassName"]);
      setTesting(true);
      const response = await testReportingDataSourceConnection(token, {
        sourceType: values.sourceType,
        connectionConfig: buildConnectionConfigFromForm(values),
      });
      setTestResult(response.data);
      if (response.data.success) {
        message.success(response.data.message);
      } else {
        message.error(response.data.message);
      }
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`连接测试失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit() {
    if (!token) return;
    try {
      const values = await form.validateFields();
      const payload = {
        sourceName: String(values.sourceName || "").trim(),
        sourceCode: normalizeDatasourceCode(values.sourceCode),
        sourceType: values.sourceType,
        ownerName: String(values.ownerName || "").trim(),
        status: values.status,
        connectionConfig: buildConnectionConfigFromForm(values),
      };
      setSubmitting(true);
      if (editingRecord) {
        await updateReportingDataSource(token, editingRecord.id, payload);
        message.success("报表数据源已更新");
      } else {
        await createReportingDataSource(token, payload);
        message.success("报表数据源已创建");
      }
      closeModal();
      await loadData();
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(`保存失败: ${error.message || "未知错误"}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const columns: ColumnsType<ReportingDataSourceRecord> = [
    { title: "名称", dataIndex: "sourceName", key: "sourceName", width: 180 },
    { title: "编码", dataIndex: "sourceCode", key: "sourceCode", width: 180 },
    { title: "类型", dataIndex: "sourceType", key: "sourceType", width: 120 },
    { title: "数据集数", dataIndex: "datasetCount", key: "datasetCount", width: 120 },
    { title: "负责人", dataIndex: "ownerName", key: "ownerName", width: 140 },
    { title: "状态", dataIndex: "status", key: "status", width: 120, render: (value: string) => <StatusTag status={value} /> },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", width: 180, render: (value: string) => formatTime(value) },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openEditModal(record)}>编辑</Button>
          <Button
            danger
            type="link"
            onClick={() => {
              Modal.confirm({
                title: `确认删除报表数据源“${record.sourceName}”？`,
                content: "删除后报表数据集将无法继续使用该连接。",
                okText: "删除",
                cancelText: "取消",
                okButtonProps: { danger: true },
                onOk: async () => {
                  if (!token) return;
                  try {
                    await deleteReportingDataSource(token, record.id);
                    message.success("报表数据源已删除");
                    await loadData();
                  } catch (error: any) {
                    message.error(`删除失败: ${error.message || "未知错误"}`);
                  }
                },
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="app-page">
      <div className="app-page-body">
        <PageToolbar
          left={(
            <>
              <Input.Search allowClear className="toolbar-search" placeholder="搜索名称、编码、负责人" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <Select
                allowClear
                style={{ width: 160 }}
                placeholder="状态"
                value={statusFilter}
                options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]}
                onChange={setStatusFilter}
              />
            </>
          )}
          right={(
            <>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建数据源</Button>
            </>
          )}
        />

        <div className="kpi-grid">
          {kpiItems.map((item) => (
            <StatCard key={item.key} title={item.title} value={item.value} icon={item.icon} description={item.description} />
          ))}
        </div>

        <DataTableCard<ReportingDataSourceRecord>
          title="报表数据源目录"
          extra={<Typography.Text type="secondary">共 {filteredRecords.length} 条记录</Typography.Text>}
          tableProps={{
            rowKey: "id",
            loading,
            columns,
            dataSource: filteredRecords,
            pagination: { pageSize: 8, showSizeChanger: false },
            scroll: { x: 1320 },
          }}
        />
      </div>

      <Modal
        open={open}
        title={editingRecord ? "编辑报表数据源" : "新建报表数据源"}
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={820}
        destroyOnHidden
        footer={[
          <Button key="test" onClick={() => void handleTestConnection()} loading={testing}>测试连接</Button>,
          <Button key="cancel" onClick={closeModal}>取消</Button>,
          <Button key="submit" type="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {editingRecord ? "保存" : "创建"}
          </Button>,
        ]}
      >
        <Form
          layout="vertical"
          form={form}
          onValuesChange={(changedValues) => {
            if ("sourceType" in changedValues) {
              form.setFieldValue("port", getDefaultPort(changedValues.sourceType));
            }
            if ("sourceName" in changedValues && !editingRecord && !form.getFieldValue("sourceCode")) {
              form.setFieldValue("sourceCode", normalizeDatasourceCode(changedValues.sourceName));
            }
          }}
        >
          <Row gutter={16}>
            <Col span={24}>
              <FormSection title="基础信息" description="独立维护报表平台的数据连接，不与其他模块复用。">
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="sourceName" label="数据源名称" rules={[{ required: true, message: "请输入名称" }]}><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="sourceCode" label="数据源编码" rules={[{ required: true, message: "请输入编码" }, { pattern: DATASOURCE_CODE_PATTERN, message: "编码仅支持字母、数字和下划线" }]}><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="sourceType" label="数据源类型" rules={[{ required: true, message: "请选择类型" }]}><Select options={sourceTypeOptions} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="ownerName" label="负责人" rules={[{ required: true, message: "请输入负责人" }]}><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}><Select options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} /></Form.Item></Col>
                </Row>
              </FormSection>
            </Col>
            <Col span={24}>
              <FormSection title="连接信息" description="支持主机端口模式，也支持 JDBC 模式。">
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="host" label="主机地址" rules={jdbcMode ? [] : [{ required: true, message: "请输入主机地址" }]}><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="port" label="端口" rules={jdbcMode ? [] : [{ required: true, message: "请输入端口" }]}><Input type="number" /></Form.Item></Col>
                  <Col span={12}><Form.Item name="databaseName" label="数据库"><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="username" label="用户名"><Input /></Form.Item></Col>
                  <Col span={12}><Form.Item name="password" label="密码"><Input.Password /></Form.Item></Col>
                  {jdbcMode ? (
                    <>
                      <Col span={24}><Form.Item name="jdbcUrl" label="JDBC URL" rules={[{ required: true, message: "请输入 JDBC URL" }]}><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="schema" label="Schema"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="driverClassName" label="Driver Class"><Input /></Form.Item></Col>
                    </>
                  ) : null}
                </Row>
                {testResult ? <Alert type={testResult.success ? "success" : "error"} showIcon message={testResult.message} /> : null}
              </FormSection>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
